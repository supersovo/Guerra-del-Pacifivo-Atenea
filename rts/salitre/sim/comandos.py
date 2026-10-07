"""Comandos de los jugadores: se validan y se convierten en órdenes.

Todo comando llega como un diccionario JSON (de la red o de la IA). El
servidor nunca confía en el cliente: comprueba la propiedad de las unidades,
la visibilidad de los blancos, los requisitos, la población y los recursos.

    {"c": "mover", "u": [ids], "x": px, "y": py, "cola": false}
    {"c": "atacar_mover" | "patrullar", "u": [...], "x", "y"}
    {"c": "atacar", "u": [...], "t": id}
    {"c": "inteligente", "u": [...], "x", "y", "t": id|null}      (clic derecho)
    {"c": "detener" | "mantener" | "regresar", "u": [...]}
    {"c": "recolectar" | "reparar" | "cargar", "u": [...], "t": id}
    {"c": "construir", "u": [...], "e": tipo, "tx", "ty"}
    {"c": "entrenar", "e": [ids], "t": tipo, "n": 1}
    {"c": "investigar", "e": id, "m": mejora}
    {"c": "cancelar", "e": id, "i": indice}    {"c": "cancelar_obra", "e": id}
    {"c": "reunion", "e": [ids], "x", "y", "t": id|null}
    {"c": "habilidad", "u": [ids], "h": habilidad, "x", "y", "t": id|null}
    {"c": "descargar", "u": [ids], "x", "y"}     (en un edificio, "g": id saca a un solo soldado)
    {"c": "senal", "x", "y"}      {"c": "rendirse"}

Las coordenadas x, y van en píxeles del mapa.
"""

from math import isqrt

from . import combate, habilidades
from .comportamiento import siguiente_orden
from .constantes import AGUA, SUB, TIERRA, TILE
from .entidades import (ATACAR, ATACAR_MOVER, CARGAR, CONSTRUIR, CURAR, DESCARGAR, HABILIDAD,
                        MANTENER, MOVER, PATRULLAR, RECOLECTAR, REGRESAR, REPARAR, SEGUIR, Orden)

MAX_COLA = 16
MAX_SELECCION = 255


def _xy(m, cmd):
    x = int(cmd["x"]) * SUB
    y = int(cmd["y"]) * SUB
    x = max(0, min(m.mapa.ancho_sub - 1, x))
    y = max(0, min(m.mapa.alto_sub - 1, y))
    return x, y


def _propias(m, p, ids):
    out = []
    vistos = set()
    for i in list(ids)[:MAX_SELECCION]:
        i = int(i)
        if i in vistos:
            continue
        vistos.add(i)
        e = m.ent.get(i)
        if e is not None and e.vivo and e.es_unidad and e.dueno == p and not e.dentro and not e.tipo.autonomo:
            out.append(e)
    return out


def _edificios_propios(m, p, ids):
    if isinstance(ids, (int, str)):
        ids = [ids]
    out = []
    for i in list(ids)[:MAX_SELECCION]:
        e = m.ent.get(int(i))
        if e is not None and e.vivo and e.es_edificio and e.dueno == p:
            out.append(e)
    return out


def _soltar(m, u):
    """Libera el yacimiento que la unidad tuviera reservado."""
    o = u.orden
    if o is not None and o.tipo == RECOLECTAR:
        r = m.ent.get(o.obj)
        if r is not None and r.es_recurso and r.minero == u.id:
            r.minero = 0


def dar(m, u, orden, cola=False):
    if cola and u.orden is not None:
        if len(u.cola) < MAX_COLA:
            u.cola.append(orden)
        return
    _soltar(m, u)
    u.orden = orden
    u.cola = []
    u.fase = 0
    u.objetivo = 0
    u.auto = False
    u.ruta = []
    u.ruta_meta = None
    u.ruta_pend = None
    u.fantasma = False
    u.atasco = 0
    u.espera = 0


def _formacion(m, us, x, y):
    n = len(us)
    if n == 1:
        return [(x, y)]
    cx = sum(u.x for u in us) // n
    cy = sum(u.y for u in us) // n
    disp = max(isqrt((u.x - cx) ** 2 + (u.y - cy) ** 2) for u in us)
    lim = TILE * (2 + isqrt(n))
    out = []
    W, H = m.mapa.ancho_sub - 1, m.mapa.alto_sub - 1
    if disp <= lim:
        for u in us:
            out.append((max(0, min(W, x + u.x - cx)), max(0, min(H, y + u.y - cy))))
        return out
    k = isqrt(n - 1) + 1
    filas = (n + k - 1) // k
    sep = max(TILE * 3 // 4, max(u.radio for u in us) * 5 // 2)
    for i, _u in enumerate(us):
        col = i % k
        fila = i // k
        ox = (col * 2 - (k - 1)) * sep // 2
        oy = (fila * 2 - (filas - 1)) * sep // 2
        out.append((max(0, min(W, x + ox)), max(0, min(H, y + oy))))
    return out


def _mover_grupo(m, us, x, y, tipo, cola):
    destinos = _formacion(m, us, x, y)
    # Camino compartido: se calcula para la unidad más cercana al centro y las
    # demás lo reutilizan si ven su primer tramo en línea recta.
    lider_ruta = None
    if not cola and len(us) > 1:
        terrestres = [u for u in us if u.capa == TIERRA and not u.tipo.emplazar]
        if len(terrestres) > 1:
            cx = sum(u.x for u in terrestres) // len(terrestres)
            cy = sum(u.y for u in terrestres) // len(terrestres)
            lider = min(terrestres, key=lambda u: ((u.x - cx) ** 2 + (u.y - cy) ** 2, u.id))
            lider_ruta = list(m.ruta_inmediata(lider, x, y))
            lider.ruta = []
            lider.ruta_meta = None
    for u, (dx, dy) in zip(us, destinos):
        o = Orden(tipo, dx, dy)
        o.x0, o.y0 = u.x, u.y
        dar(m, u, o, cola)
        if lider_ruta and u.orden is o and u.capa == TIERRA and not u.tipo.emplazar:
            mapa = m.mapa
            if mapa.linea_libre(TIERRA, u.x, u.y, dx, dy):
                u.ruta = [(dx, dy)]
                u.ruta_meta = (dx, dy)
            else:
                # el punto más avanzado del camino del líder que se ve en línea recta
                k = None
                for i in range(len(lider_ruta) - 1, -1, -1):
                    if mapa.linea_libre(TIERRA, u.x, u.y, *lider_ruta[i]):
                        k = i
                        break
                if k is not None:
                    ruta = list(lider_ruta[k:])
                    if len(ruta) >= 2 and mapa.linea_libre(TIERRA, ruta[-2][0], ruta[-2][1], dx, dy):
                        ruta[-1] = (dx, dy)
                    elif ruta[-1] != (dx, dy):
                        ruta.append((dx, dy))
                    u.ruta = ruta
                    u.ruta_meta = (dx, dy)


def _visible_para(m, p, e):
    if e.es_recurso:
        return m.explorado[m.equipo_de(p)][m.mapa.idx_de(e.x, e.y)] == 1
    if m.aliados(p, e.dueno):
        return True
    return combate.atacable(m, p, e)


def _objetivo(m, p, cmd):
    t = cmd.get("t")
    if t is None:
        return None
    e = m.entidad(int(t))
    if e is None or not _visible_para(m, p, e):
        return None
    return e


# ----------------------------------------------------------------------
def c_mover(m, p, cmd, tipo=MOVER):
    us = _propias(m, p, cmd.get("u", []))
    if not us:
        return
    x, y = _xy(m, cmd)
    _mover_grupo(m, us, x, y, tipo, bool(cmd.get("cola")))


def c_atacar_mover(m, p, cmd):
    c_mover(m, p, cmd, ATACAR_MOVER)


def c_patrullar(m, p, cmd):
    c_mover(m, p, cmd, PATRULLAR)


def _sanitaria(u):
    """Cantineras y enfermeras: curan a la tropa propia, no combaten."""
    return bool(u.tipo.curar_ritmo) and u.tipo.arma is None


def _acompanar(m, p, sanitarias, tropa, cola):
    """En una orden de ataque las sanitarias no van hacia el enemigo: siguen a la tropa
    armada más cercana de la misma orden (y la curan); si van solas, se quedan donde están."""
    if not sanitarias:
        return
    if not tropa:
        m.ev_jugador(p, "err", "La cantinera no combate: solo atiende a la tropa propia")
        return
    for u in sanitarias:
        g = min(tropa, key=lambda v: ((v.x - u.x) ** 2 + (v.y - u.y) ** 2, v.id))
        dar(m, u, Orden(SEGUIR, obj=g.id), cola)


def c_atacar(m, p, cmd):
    us = _propias(m, p, cmd.get("u", []))
    obj = _objetivo(m, p, cmd)
    if obj is None or not m.enemigos(p, obj.dueno):
        if "x" in cmd:
            c_mover(m, p, cmd, ATACAR_MOVER)
        return
    cola = bool(cmd.get("cola"))
    sanitarias = [u for u in us if _sanitaria(u)]
    tropa = []
    for u in us:
        if _sanitaria(u):
            continue
        if u.tipo.arma is not None and combate.arma_puede(u.tipo.arma, obj, m.cat):
            dar(m, u, Orden(ATACAR, obj=obj.id), cola)
            tropa.append(u)
        elif u.capa == TIERRA or obj.capa == u.capa:
            dar(m, u, Orden(MOVER, obj.x, obj.y), cola)
    _acompanar(m, p, sanitarias, tropa, cola)


def c_detener(m, p, cmd):
    for u in _propias(m, p, cmd.get("u", [])):
        dar(m, u, None)
        siguiente_orden(u)


def c_replegar(m, p, cmd):
    """Repliegue sanitario: los seleccionados con menos de la mitad de la vida (o, si ninguno
    está tan mal, todos los heridos) van a curarse junto al hospital de campaña más cercano."""
    us = [u for u in _propias(m, p, cmd.get("u", [])) if u.tipo.biologica and u.capa == TIERRA]
    heridos = [u for u in us if u.vida * 2 < u.st.vida] or [u for u in us if u.vida < u.st.vida]
    if not heridos:
        m.ev_jugador(p, "err", "No hay heridos que replegar")
        return
    cx = sum(u.x for u in heridos) // len(heridos)
    cy = sum(u.y for u in heridos) // len(heridos)
    hosp = None
    mejor = None
    for b in m.edificios.values():
        if b.dueno != p or not b.vivo or not b.construido or not b.tipo.regen_radio:
            continue
        d = (b.x - cx) ** 2 + (b.y - cy) ** 2
        if mejor is None or d < mejor:
            hosp, mejor = b, d
    if hosp is None:
        m.ev_jugador(p, "err", "Hace falta un hospital de campaña terminado")
        return
    # frente a la puerta del hospital, dentro del radio en que cura
    _mover_grupo(m, heridos, hosp.x, hosp.y + hosp.h * TILE // 2 + TILE, MOVER, False)


def c_mantener(m, p, cmd):
    for u in _propias(m, p, cmd.get("u", [])):
        dar(m, u, Orden(MANTENER, u.x, u.y), bool(cmd.get("cola")))


def c_recolectar(m, p, cmd):
    obj = _objetivo(m, p, cmd)
    if obj is None:
        return
    for u in _propias(m, p, cmd.get("u", [])):
        if u.tipo.trabajador:
            _orden_recurso(m, u, obj, bool(cmd.get("cola")))


def _orden_recurso(m, u, obj, cola):
    if obj.es_recurso:
        if obj.rtipo == "agua":
            mol = m.entidad(obj.molino) if obj.molino else None
            if mol is None or mol.dueno != u.dueno:
                m.ev_jugador(u.dueno, "err", "Ese pozo necesita un molino de agua")
                return False
        dar(m, u, Orden(RECOLECTAR, obj=obj.id, dato=obj.rtipo), cola)
        return True
    if obj.es_edificio and obj.tipo.sobre_recurso and obj.dueno == u.dueno and obj.pozo:
        dar(m, u, Orden(RECOLECTAR, obj=obj.pozo, dato="agua"), cola)
        return True
    return False


def c_regresar(m, p, cmd):
    for u in _propias(m, p, cmd.get("u", [])):
        if u.tipo.trabajador and u.carga:
            dar(m, u, Orden(REGRESAR), bool(cmd.get("cola")))


def c_reparar(m, p, cmd):
    obj = _objetivo(m, p, cmd)
    if obj is None or obj.dueno != p:
        return
    for u in _propias(m, p, cmd.get("u", [])):
        if u.tipo.trabajador or (obj.es_edificio and obj.tipo.id in u.tipo.construye and not obj.construido):
            dar(m, u, Orden(REPARAR, obj=obj.id), bool(cmd.get("cola")))


def c_cargar(m, p, cmd):
    obj = _objetivo(m, p, cmd)
    if obj is None or not m.aliados(p, obj.dueno):
        return
    for u in _propias(m, p, cmd.get("u", [])):
        if u.capa == TIERRA:
            dar(m, u, Orden(CARGAR, obj=obj.id), bool(cmd.get("cola")))


def c_inteligente(m, p, cmd):
    us = _propias(m, p, cmd.get("u", []))
    if not us:
        return
    obj = _objetivo(m, p, cmd)
    cola = bool(cmd.get("cola"))
    if obj is None:
        c_mover(m, p, cmd)
        return
    sanitarias = []
    if obj.es_unidad or obj.es_edificio:
        if m.enemigos(p, obj.dueno):
            sanitarias = [u for u in us if _sanitaria(u)]
            us = [u for u in us if not _sanitaria(u)]
    resto = []
    tropa = []
    for u in us:
        if _inteligente_una(m, p, u, obj, cola):
            tropa.append(u)
        else:
            resto.append(u)
    _acompanar(m, p, sanitarias, tropa, cola)
    if resto:
        if "x" in cmd:
            x, y = _xy(m, cmd)
        else:
            x, y = obj.x, obj.y
        _mover_grupo(m, resto, x, y, MOVER, cola)


def _inteligente_una(m, p, u, obj, cola):
    tipo = u.tipo
    if obj.es_recurso:
        return tipo.trabajador and _orden_recurso(m, u, obj, cola)
    if obj.es_mina:
        return False
    if m.enemigos(p, obj.dueno):
        if tipo.arma is not None and combate.arma_puede(tipo.arma, obj, m.cat):
            dar(m, u, Orden(ATACAR, obj=obj.id), cola)
            return True
        return False
    # propio o aliado
    if obj is u:
        return True
    if obj.es_edificio:
        if obj.dueno == p and not obj.construido and (tipo.trabajador or obj.tipo.id in tipo.construye):
            dar(m, u, Orden(REPARAR, obj=obj.id), cola)
            return True
        if tipo.trabajador and obj.dueno == p:
            if obj.tipo.sobre_recurso and obj.construido:
                return _orden_recurso(m, u, obj, cola)
            if obj.tipo.deposito and u.carga:
                dar(m, u, Orden(REGRESAR), cola)
                return True
            if obj.vida < obj.st.vida:
                dar(m, u, Orden(REPARAR, obj=obj.id), cola)
                return True
        if obj.tipo.guarnicion and obj.construido and tipo.categoria in obj.tipo.guarnicion_categorias \
                and tipo.clase in obj.tipo.guarnicion_clases:
            dar(m, u, Orden(CARGAR, obj=obj.id), cola)
            return True
        return False
    # unidad propia o aliada
    if obj.tipo.capacidad and u.capa == TIERRA and obj.capa == AGUA:
        dar(m, u, Orden(CARGAR, obj=obj.id), cola)
        return True
    if tipo.trabajador and obj.dueno == p and obj.tipo.mecanica and obj.vida < obj.st.vida:
        dar(m, u, Orden(REPARAR, obj=obj.id), cola)
        return True
    if tipo.curar_ritmo and obj.tipo.biologica:
        dar(m, u, Orden(CURAR, obj=obj.id) if obj.vida < obj.st.vida else Orden(SEGUIR, obj=obj.id), cola)
        return True
    if u.capa == obj.capa:
        dar(m, u, Orden(SEGUIR, obj=obj.id), cola)
        return True
    return False


def c_construir(m, p, cmd):
    j = m.jugadores[p]
    tipo = m.cat.edificios.get(cmd.get("e"))
    if tipo is None:
        return
    tx, ty = int(cmd["tx"]), int(cmd["ty"])
    us = [u for u in _propias(m, p, cmd.get("u", []))
          if u.tipo.trabajador or tipo.id in u.tipo.construye]
    if not us:
        return
    err = m.validar_construccion(j, tipo, tx, ty)
    if err:
        m.ev_jugador(p, "err", err)
        return
    cx = tx * TILE + tipo.ancho * TILE // 2
    cy = ty * TILE + tipo.alto * TILE // 2
    u = min(us, key=lambda v: ((v.x - cx) ** 2 + (v.y - cy) ** 2, v.id))
    dar(m, u, Orden(CONSTRUIR, tx, ty, 0, tipo.id), bool(cmd.get("cola")))


def c_entrenar(m, p, cmd):
    j = m.jugadores[p]
    ut = m.cat.unidades.get(cmd.get("t"))
    if ut is None or ut.id not in j.faccion.unidades:
        return
    n = max(1, min(5, int(cmd.get("n", 1))))
    eds = [b for b in _edificios_propios(m, p, cmd.get("e", [])) if b.construido and ut.id in b.tipo.produce]
    if not eds:
        return
    for _ in range(n):
        if not j.requisitos(ut):
            faltan = [m.cat.nombre(j.faccion.id, r) for r in ut.requisitos if not j.tiene(r)]
            m.ev_jugador(p, "err", "Requiere: " + ", ".join(faltan))
            return
        if ut.heroe and ut.id in j.heroes:
            m.ev_jugador(p, "err", "Ese héroe ya está en campaña")
            return
        libres = [b for b in eds if len(b.cola) < 5]
        if not libres:
            m.ev_jugador(p, "err", "La cola de producción está llena")
            return
        costo = j.stats[ut.id].costo
        if not j.puede_pagar(costo):
            m.ev_jugador(p, "err", j.falta(costo))
            return
        b = min(libres, key=lambda e: (len(e.cola), e.id))
        j.pagar(costo)
        b.cola.append(["u", ut.id, 0, j.stats[ut.id].tiempo, False])
        if ut.heroe:
            j.heroes.add(ut.id)


def c_investigar(m, p, cmd):
    j = m.jugadores[p]
    mej = m.cat.mejoras.get(cmd.get("m"))
    eds = _edificios_propios(m, p, cmd.get("e", []))
    if mej is None or not eds:
        return
    eds = [b for b in eds if b.construido and mej.id in b.tipo.investiga and len(b.cola) < 5]
    if not eds:
        return
    if mej.id in j.mejoras or mej.id in j.investigando:
        m.ev_jugador(p, "err", "Ya está investigado o en curso")
        return
    if mej.previa and mej.previa not in j.mejoras:
        m.ev_jugador(p, "err", "Primero investigue el nivel anterior")
        return
    for r in mej.requisitos:
        if not j.tiene(r):
            m.ev_jugador(p, "err", "Requiere: " + m.cat.nombre(j.faccion.id, r))
            return
    if not j.puede_pagar(mej.costo):
        m.ev_jugador(p, "err", j.falta(mej.costo))
        return
    b = min(eds, key=lambda e: (len(e.cola), e.id))
    j.pagar(mej.costo)
    j.investigando.add(mej.id)
    b.cola.append(["m", mej.id, 0, mej.tiempo, False])


def c_cancelar(m, p, cmd):
    j = m.jugadores[p]
    for b in _edificios_propios(m, p, cmd.get("e", [])):
        if not b.cola:
            continue
        i = int(cmd.get("i", -1))
        if i < 0:
            i = len(b.cola) - 1
        if i >= len(b.cola):
            continue
        item = b.cola.pop(i)
        if item[0] == "u":
            ut = m.cat.unidades[item[1]]
            j.reembolsar(j.stats[ut.id].costo)
            if item[4]:
                j.pob_usada -= ut.poblacion
            if ut.heroe:
                j.heroes.discard(ut.id)
        else:
            mej = m.cat.mejoras[item[1]]
            j.reembolsar(mej.costo)
            j.investigando.discard(mej.id)
        return


def c_cancelar_obra(m, p, cmd):
    for b in _edificios_propios(m, p, cmd.get("e", [])):
        m.cancelar_obra(b)


def c_reunion(m, p, cmd):
    x, y = _xy(m, cmd)
    obj = _objetivo(m, p, cmd)
    for b in _edificios_propios(m, p, cmd.get("e", [])):
        b.reunion = (x, y, obj.id if obj is not None else 0)


def c_habilidad(m, p, cmd):
    h = m.cat.habilidades.get(cmd.get("h"))
    if h is None:
        return
    ids = cmd.get("u", [])
    lanzadores = [e for e in _propias(m, p, ids) if h.id in e.tipo.habilidades]
    lanzadores += [b for b in _edificios_propios(m, p, ids) if h.id in b.tipo.habilidades and b.construido]
    if not lanzadores:
        return
    cola = bool(cmd.get("cola"))
    if h.tipo == "emplazar":
        for c in lanzadores:
            if c.es_unidad:
                habilidades.lanzar(m, c, h, c.x, c.y, None)
        return
    if h.tipo == "descargar":
        c_descargar(m, p, cmd)
        return
    if h.tipo in ("orden_reparar", "menu_construir"):
        return
    x, y = _xy(m, cmd) if "x" in cmd else (lanzadores[0].x, lanzadores[0].y)
    obj = _objetivo(m, p, cmd)
    if h.objetivo in ("unidad_enemiga", "edificio_enemigo"):
        if obj is None or not m.enemigos(p, obj.dueno):
            m.ev_jugador(p, "err", "Elija un blanco enemigo visible")
            return
        x, y = obj.x, obj.y
    aptos = [c for c in lanzadores if habilidades.error_lanzar(m, c, h) is None]
    if not aptos:
        m.ev_jugador(p, "err", habilidades.error_lanzar(m, lanzadores[0], h))
        return
    c = min(aptos, key=lambda e: ((e.x - x) ** 2 + (e.y - y) ** 2, e.id))
    if c.es_edificio:
        habilidades.lanzar(m, c, h, x, y, obj)
        return
    if h.objetivo == "ninguno":
        habilidades.lanzar(m, c, h, x, y, obj)
        return
    o = Orden(HABILIDAD, x, y, obj.id if obj is not None else 0, h.id)
    dar(m, c, o, cola)


def c_descargar(m, p, cmd):
    ids = cmd.get("u", [])
    x, y = _xy(m, cmd) if "x" in cmd else (None, None)
    for u in _propias(m, p, ids):
        if u.tipo.capacidad and u.cargamento:
            if x is None:
                dar(m, u, Orden(DESCARGAR, u.x, u.y), bool(cmd.get("cola")))
            else:
                dar(m, u, Orden(DESCARGAR, x, y), bool(cmd.get("cola")))
    solo = cmd.get("g")
    for b in _edificios_propios(m, p, ids):
        if b.guarnicion:
            m.vaciar_guarnicion(b, int(solo) if solo is not None else None)


def c_senal(m, p, cmd):
    x, y = int(cmd["x"]), int(cmd["y"])
    for q in m.jugadores:
        if m.aliados(p, q.idx):
            m.ev_jugador(q.idx, "senal", p, x, y)


def c_rendirse(m, p, cmd):
    m.jugadores[p].rendido = True


def c_truco(m, p, cmd):
    if not m.trucos:
        return
    j = m.jugadores[p]
    j.dinero += int(cmd.get("dinero", cmd.get("salitre", 0)))
    j.agua += int(cmd.get("agua", 0))
    if cmd.get("revelar"):
        eq = j.equipo
        m.explorado[eq] = bytearray(b"\x01" * m.mapa.n)


MANEJADORES = {
    "mover": c_mover,
    "atacar_mover": c_atacar_mover,
    "patrullar": c_patrullar,
    "atacar": c_atacar,
    "detener": c_detener,
    "mantener": c_mantener,
    "replegar": c_replegar,
    "recolectar": c_recolectar,
    "regresar": c_regresar,
    "reparar": c_reparar,
    "cargar": c_cargar,
    "inteligente": c_inteligente,
    "construir": c_construir,
    "entrenar": c_entrenar,
    "investigar": c_investigar,
    "cancelar": c_cancelar,
    "cancelar_obra": c_cancelar_obra,
    "reunion": c_reunion,
    "habilidad": c_habilidad,
    "emplazar": lambda m, p, cmd: c_habilidad(m, p, dict(cmd, h="emplazar")),
    "descargar": c_descargar,
    "senal": c_senal,
    "rendirse": c_rendirse,
    "truco": c_truco,
}


def aplicar(m, p, cmd):
    if not m.jugadores[p].vivo:
        return
    f = MANEJADORES.get(cmd.get("c"))
    if f is not None:
        f(m, p, cmd)


def orden_reunion(m, u, rx, ry, obj):
    """Orden inicial de una unidad recién formada según el punto de reunión."""
    if obj is not None and u.tipo.trabajador:
        if obj.es_recurso or (obj.es_edificio and obj.tipo.sobre_recurso and obj.dueno == u.dueno):
            if _orden_recurso(m, u, obj, False):
                return
        if obj.es_edificio and obj.dueno == u.dueno and not obj.construido:
            dar(m, u, Orden(REPARAR, obj=obj.id))
            return
    if obj is not None and obj.es_unidad and obj.vivo and m.aliados(u.dueno, obj.dueno):
        if obj.tipo.capacidad and u.capa == TIERRA and obj.capa == AGUA:
            dar(m, u, Orden(CARGAR, obj=obj.id))
            return
        if u.capa == obj.capa:
            dar(m, u, Orden(SEGUIR, obj=obj.id))
            return
    dar(m, u, Orden(MOVER, rx, ry))
