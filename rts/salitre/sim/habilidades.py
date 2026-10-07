"""Habilidades activas: auras temporales, curaciones, andanadas, minas,
sabotajes, cargas de demolición, espolonazos, reconocimiento y emplazamiento."""

from math import isqrt

from . import combate, veterania
from .constantes import AGUA, TIERRA, TILE, vel
from .entidades import Mina, Proyectil

VEL_GRANADA = vel(10)


def error_lanzar(m, c, h):
    if h.energia and c.energia < h.energia:
        return "Energía insuficiente"
    if c.cd.get(h.id, 0) > m.tick:
        return "La habilidad aún no está lista"
    if h.tipo == "mina" and m.jugadores[c.dueno].minas >= m.cat.minas_maximas:
        return "Ya sembró el máximo de minas"
    return None


def _en_radio(m, c, radio):
    out = []
    r2 = radio * radio
    for v in m.rejilla.cerca(c.x, c.y, radio):
        if not v.vivo or v.dentro or not m.aliados(c.dueno, v.dueno):
            continue
        dx = v.x - c.x
        dy = v.y - c.y
        if dx * dx + dy * dy <= r2:
            out.append(v)
    return out


def _potenciar(m, objetivos, h):
    t = m.tick
    hasta = t + h.duracion
    for v in objetivos:
        for ef in h.efectos:
            if not ef.filtro.unidad(v.tipo):
                continue
            b = v.buffs.get(ef.campo)
            val = ef.suma
            fin = hasta
            if b is not None and b[1] > t:
                val = max(val, b[0])
                fin = max(fin, b[1])
            v.buffs[ef.campo] = (val, fin)


def lanzar(m, c, h, x, y, obj):
    t = m.tick
    err = error_lanzar(m, c, h)
    if err:
        m.ev_jugador(c.dueno, "err", err)
        return False
    k = h.tipo
    j = m.jugadores[c.dueno]
    if k == "potenciar_area":
        _potenciar(m, _en_radio(m, c, h.radio), h)
    elif k == "potenciar_propio":
        _potenciar(m, [c], h)
    elif k == "curar_area":
        curados = 0
        for v in _en_radio(m, c, h.radio):
            if v.tipo.biologica or (h.incluye_naval and v.capa == AGUA):
                antes = v.vida
                v.vida = min(v.st.vida, v.vida + h.cantidad)
                curados += v.vida - antes
        if c.es_unidad:
            veterania.por_curacion(m, c, curados)
    elif k == "revelar":
        tx, ty = m.mapa.casilla(x, y)
        m.revelados.append((j.equipo, tx, ty, h.radio / TILE, t + h.duracion))
        for q in m.jugadores:
            if q.equipo == j.equipo:
                m.ev_jugador(q.idx, "revela", x >> 4, y >> 4, h.radio >> 4)
        m._actualizar_vision()
    elif k == "bombardeo":
        n = max(1, h.proyectiles)
        intervalo = max(1, h.duracion // n)
        for i in range(n):
            ox = m.azar.rango(-h.dispersion, h.dispersion)
            oy = m.azar.rango(-h.dispersion, h.dispersion)
            m.programar(t + i * intervalo, "bomba", c.id, c.x, c.y, x + ox, y + oy,
                        h.danio, h.tipo_danio, h.radio, c.dueno)
    elif k == "mina":
        mapa = m.mapa
        i = mapa.idx_de(x, y)
        if not mapa.pasable[TIERRA][i]:
            m.ev_jugador(c.dueno, "err", "No se puede sembrar ahí")
            return False
        mina = Mina(m._nuevo_id(), c.dueno, x, y, h, t)
        m.ent[mina.id] = mina
        m.minas[mina.id] = mina
        j.minas += 1
        for q in m.jugadores:
            if q.equipo == j.equipo:
                m.ev_jugador(q.idx, "mina", mina.id, x >> 4, y >> 4)
    elif k == "sabotaje":
        if obj is None or not obj.es_edificio:
            return False
        obj.sabotaje_hasta = t + h.duracion
        m.ev_pos(obj.x, obj.y, "sabotaje", obj.id, h.duracion)
    elif k == "demolicion":
        if obj is None or not obj.es_edificio:
            return False
        m.programar(t + h.retardo, "demolicion", obj.id, h.danio, c.dueno, c.id)
        m.ev_pos(obj.x, obj.y, "carga_puesta", obj.id, h.retardo)
    elif k == "golpe":
        if obj is None or not obj.es_unidad or (h.solo_naval and obj.capa != AGUA):
            m.ev_jugador(c.dueno, "err", "Solo contra buques enemigos")
            return False
        combate.danar(m, obj, h.danio, c.id, c.dueno)
        m.ev_pos(obj.x, obj.y, "golpe", c.id, obj.id)
    elif k == "emplazar":
        if c.es_unidad and c.tipo.emplazar and not c.emplazando:
            c.emplazando = veterania.tiempo_emplazar(m, c)
            c.orden = None
            c.cola = []
            c.ruta = []
            c.ruta_meta = None
            c.casa_x, c.casa_y = c.x, c.y
    else:
        return False
    c.energia -= h.energia
    if h.enfriamiento:
        c.cd[h.id] = t + h.enfriamiento
    m.ev_pos(c.x, c.y, "hab", c.id, h.id, x >> 4, y >> 4)
    return True


def ejecutar_programado(m, accion, datos):
    if accion == "bomba":
        cid, ox, oy, x, y, danio, tipo_danio, radio, dueno = datos
        c = m.entidad(cid)
        if c is not None:
            ox, oy = c.x, c.y
        x = max(0, min(m.mapa.ancho_sub - 1, x))
        y = max(0, min(m.mapa.alto_sub - 1, y))
        dist = isqrt((x - ox) ** 2 + (y - oy) ** 2)
        vuelo = max(4, dist // VEL_GRANADA)
        m.proyectiles.append(Proyectil(ox, oy, x, y, m.tick + vuelo, danio, tipo_danio, radio,
                                       dueno, cid))
        m.ev_pos(ox, oy, "pro", cid, ox >> 4, oy >> 4, x >> 4, y >> 4, vuelo, tipo_danio)
    elif accion == "demolicion":
        oid, danio, dueno, cid = datos
        obj = m.entidad(oid)
        if obj is not None:
            m.ev_pos(obj.x, obj.y, "exp", obj.x >> 4, obj.y >> 4, TILE >> 4, "dinamita")
            combate.danar(m, obj, danio, cid, dueno, por_explosion=True)


def orden_habilidad(m, u, o):
    from .comportamiento import ir_a, punto_acceso, siguiente_orden

    h = m.cat.habilidades.get(o.dato)
    if h is None or h.id not in u.tipo.habilidades:
        siguiente_orden(u)
        return
    err = error_lanzar(m, u, h)
    if err:
        m.ev_jugador(u.dueno, "err", err)
        siguiente_orden(u)
        return
    if h.objetivo == "punto":
        if h.alcance:
            dx = o.x - u.x
            dy = o.y - u.y
            if dx * dx + dy * dy > h.alcance * h.alcance:
                r = ir_a(m, u, o.x, o.y, cerca=h.alcance)
                if r == -1:
                    siguiente_orden(u)
                if r != 1:
                    return
        lanzar(m, u, h, o.x, o.y, None)
        siguiente_orden(u)
        return
    if h.objetivo in ("unidad_enemiga", "edificio_enemigo"):
        obj = m.entidad(o.obj)
        ok = obj is not None and combate.atacable(m, u.dueno, obj)
        if ok and h.objetivo == "edificio_enemigo" and not obj.es_edificio:
            ok = False
        if ok and h.objetivo == "unidad_enemiga" and not obj.es_unidad:
            ok = False
        if not ok:
            siguiente_orden(u)
            return
        d = combate.dist_borde(u, obj)
        if d > h.alcance:
            if obj.es_unidad:
                mx, my = obj.x, obj.y
            else:
                p = punto_acceso(m, u, obj.tx, obj.ty, obj.w, obj.h)
                if p is None:
                    siguiente_orden(u)
                    return
                mx, my = p
            meta = u.ruta_meta
            if meta is None or (meta[0] - mx) ** 2 + (meta[1] - my) ** 2 > TILE * TILE:
                m.pedir_ruta(u, mx, my)
                return
            if ir_a(m, u, meta[0], meta[1]) == -1:
                siguiente_orden(u)
            return
        lanzar(m, u, h, obj.x, obj.y, obj)
        siguiente_orden(u)
        return
    lanzar(m, u, h, u.x, u.y, None)
    siguiente_orden(u)
