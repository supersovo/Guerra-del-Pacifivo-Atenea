"""Tarjeta de órdenes: qué botones ofrece la selección actual.

Unidades: mover, detener, atacar, mantener, patrullar y sus habilidades;
trabajadores: recolectar, regresar, reparar y los dos menús de construcción;
edificios: lo que forman, lo que investigan y el punto de reunión.
"""

from ...red import instantanea as I

COLUMNAS = 4
FILAS = 3


class Boton:
    __slots__ = ("clave", "texto", "atajo", "icono", "accion", "dato", "activo", "costo", "descripcion",
                 "falta", "cuenta", "enfriando")

    def __init__(self, clave, texto, atajo, icono, accion, dato=None, activo=True, costo=None, descripcion="",
                 falta=""):
        self.clave = clave
        self.texto = texto
        self.atajo = (atajo or "").upper()
        self.icono = icono
        self.accion = accion
        self.dato = dato
        self.activo = activo
        self.costo = costo
        self.descripcion = descripcion
        self.falta = falta
        self.cuenta = 0
        self.enfriando = 0


def _poner(slots, i, b):
    while i < len(slots) and slots[i] is not None:
        i += 1
    if i < len(slots):
        slots[i] = b


def tarjeta(est, seleccion, submenu=None):
    cat = est.cat
    slots = [None] * (COLUMNAS * FILAS)
    ents = [est.ents[i] for i in seleccion if i in est.ents]
    propios = [e for e in ents if est.propio(e) and not e.fantasma]
    if not propios:
        return slots
    fac = est.facciones[est.yo]
    terminados = {}
    for e in est.ents.values():
        if e.dueno == est.yo and e.es_edificio and not e.fantasma and not e.fl & I.F_OBRA:
            terminados[e.tipo.id] = terminados.get(e.tipo.id, 0) + 1

    def requisitos(tipo):
        faltan = [cat.nombre(fac.id, r) for r in tipo.requisitos if not terminados.get(r)]
        return ", ".join(faltan)

    unidades = [e for e in propios if e.es_unidad and not e.tipo.autonomo]
    if not unidades and any(e.es_unidad for e in propios):
        return slots        # los camilleros actúan solos: no hay órdenes que darles
    if unidades:
        # menú de construcción de los trabajadores (o de los zapadores)
        if submenu in ("basico", "avanzado", "campana"):
            constructores = [e for e in unidades if e.tipo.trabajador or e.tipo.construye]
            permitidos = None
            if not any(e.tipo.trabajador for e in constructores):
                permitidos = set()
                for e in constructores:
                    permitidos.update(e.tipo.construye)
            k = 0
            for bid in fac.edificios:
                bt = cat.edificios[bid]
                if permitidos is not None:
                    if bid not in permitidos:
                        continue
                elif bt.menu != submenu:
                    continue
                falta = requisitos(bt)
                st = est.stats_de(bt)
                slots[k] = Boton("b:" + bid, cat.nombre(fac.id, bid), bt.atajo, ("edificio", bt), "construir", bid,
                                 not falta, st.costo, bt.descripcion, falta)
                k += 1
                if k >= len(slots) - 1:
                    break
            slots[-1] = Boton("volver", "Volver", "ESC", ("orden", "volver"), "menu", None)
            return slots
        tipos = {e.tipo.id: e.tipo for e in unidades}
        con_arma = any(t.arma is not None for t in tipos.values())
        trabajadores = any(t.trabajador for t in tipos.values())
        solo_buques = all(t.capa == 1 for t in tipos.values())
        slots[0] = Boton("mover", "Mover", "M", ("orden", "mover"), "objetivo", "mover",
                         descripcion="Marchar hasta el punto elegido sin detenerse a combatir.")
        slots[1] = Boton("detener", "Detener", "S", ("orden", "detener"), "orden", {"c": "detener"},
                         descripcion="Cancela las órdenes.")
        if con_arma:
            slots[2] = Boton("atacar", "Atacar", "A", ("orden", "atacar"), "objetivo", "atacar",
                             descripcion="Avanzar combatiendo a todo enemigo que aparezca, o atacar un blanco.")
            slots[4] = Boton("patrullar", "Patrullar", "P", ("orden", "patrullar"), "objetivo", "patrullar",
                             descripcion="Ir y volver entre dos puntos combatiendo.")
        slots[3] = Boton("mantener", "Mantener posición", "H", ("orden", "mantener"), "orden", {"c": "mantener"},
                         descripcion="No moverse: disparar solo a lo que esté a su alcance.")
        if trabajadores:
            slots[5] = Boton("recolectar", "Recolectar", "G", ("orden", "recolectar"), "objetivo", "recolectar",
                             descripcion="Extraer salitre (el Cuartel General lo compra a 1 $ por unidad) o acarrear agua desde un molino.")
            slots[6] = Boton("regresar", "Entregar carga", "D", ("orden", "regresar"), "orden", {"c": "regresar"},
                             descripcion="Llevar lo que carga al Cuartel General.")
            slots[7] = Boton("reparar", "Reparar", "R", ("orden", "reparar"), "objetivo", "reparar",
                             descripcion="Reparar edificios, cañones y buques (cuesta un 25 % del precio).")
            slots[8] = Boton("menu_basico", "Construir", "B", ("orden", "construir"), "menu", "basico",
                             descripcion="Edificios básicos: cuartel, depósito, molino, barracas, maestranza...")
            slots[9] = Boton("menu_avanzado", "Construcción avanzada", "V", ("orden", "avanzado"), "menu",
                             "avanzado", descripcion="Barracón, caballeriza, telégrafos, parque, Estado Mayor, muelle.")
        # habilidades del primer tipo (o comunes)
        hab_vistas = []
        for e in unidades:
            for hid in e.tipo.habilidades:
                if hid not in hab_vistas:
                    hab_vistas.append(hid)
        k = 8 if not trabajadores else 10
        for hid in hab_vistas:
            h = cat.habilidades[hid]
            if h.tipo == "orden_reparar" or (trabajadores and h.tipo == "menu_construir"):
                continue
            if h.tipo == "menu_construir":
                b = Boton("menu_campana", h.nombre, h.atajo or "B", ("habilidad", h), "menu", "campana",
                          descripcion=h.descripcion)
            elif h.tipo == "descargar":
                b = Boton("descargar", h.nombre, h.atajo, ("habilidad", h), "objetivo", "descargar",
                          descripcion=h.descripcion)
            elif h.tipo == "emplazar":
                b = Boton("emplazar", h.nombre, h.atajo, ("habilidad", h), "orden", {"c": "emplazar"},
                          descripcion=h.descripcion)
            else:
                accion = "orden" if h.objetivo == "ninguno" else "objetivo"
                dato = {"c": "habilidad", "h": hid} if accion == "orden" else "hab:" + hid
                cd = 0
                for e in unidades:
                    if hid in e.tipo.habilidades and isinstance(e.ex, dict):
                        cd = max(cd, e.ex.get("cd", {}).get(hid, 0))
                desc = h.descripcion
                if h.energia:
                    desc += f" Energía: {h.energia // 256}."
                if h.enfriamiento:
                    desc += f" Recarga: {h.enfriamiento // 16} s."
                b = Boton("hab:" + hid, h.nombre, h.atajo, ("habilidad", h), accion, dato, descripcion=desc)
                b.enfriando = cd
            _poner(slots, k, b)
        if solo_buques:
            slots[5] = slots[5] if slots[5] else None
        return slots
    # edificios
    edif = [e for e in propios if e.es_edificio]
    tipo = edif[0].tipo
    mismos = [e for e in edif if e.tipo.id == tipo.id]
    if any(e.fl & I.F_OBRA for e in mismos):
        slots[-1] = Boton("cancelar_obra", "Cancelar obra", "ESC", ("orden", "cancelar"), "orden",
                          {"c": "cancelar_obra"}, descripcion="Se devuelve el 75 % del costo.")
        return slots
    k = 0
    for uid in tipo.produce:
        if uid not in fac.unidades:
            continue
        ut = cat.unidades[uid]
        falta = requisitos(ut)
        if ut.heroe and uid in est.heroes:
            falta = "ya está en campaña"
        st = est.stats_de(ut)
        desc = ut.descripcion + f"  Población: {ut.poblacion}."
        slots[k] = Boton("u:" + uid, cat.nombre(fac.id, uid), ut.atajo, ("unidad", ut), "entrenar", uid,
                         not falta, st.costo, desc, falta)
        k += 1
        if k >= 11:
            break
    if tipo.investiga:
        for mid in tipo.investiga:
            m = cat.mejoras[mid]
            if mid in est.mejoras:
                continue
            if m.previa and m.previa not in est.mejoras:
                continue
            falta = ", ".join(cat.nombre(fac.id, r) for r in m.requisitos if not terminados.get(r))
            if mid in est.investigando:
                falta = "en curso"
            _poner(slots, k, Boton("m:" + mid, m.nombre, m.atajo, ("mejora", m), "investigar", mid, not falta,
                                   m.costo, m.descripcion, falta))
            k += 1
    for hid in tipo.habilidades:
        h = cat.habilidades[hid]
        _poner(slots, 8, Boton("hab:" + hid, h.nombre, h.atajo, ("habilidad", h),
                               "objetivo" if h.objetivo != "ninguno" else "orden",
                               "hab:" + hid if h.objetivo != "ninguno" else {"c": "habilidad", "h": hid},
                               descripcion=h.descripcion + (f" Energía: {h.energia // 256}." if h.energia else "")))
    if tipo.guarnicion:
        if tipo.guarnicion_vista == "trinchera":
            texto, desc = "Salir de la trinchera", "La tropa sale de la trinchera."
        else:
            texto, desc = "Bajar del techo", "Los tiradores del techo bajan y salen del edificio."
        _poner(slots, 8, Boton("vaciar", texto, "D", ("orden", "descargar"), "orden", {"c": "descargar"},
                               descripcion=desc + " Para guarnecer: seleccione infantería y haga clic derecho "
                                                  "sobre el edificio."))
    if tipo.produce:
        slots[-2] = Boton("reunion", "Punto de reunión", "Y", ("orden", "reunion"), "objetivo", "reunion",
                          descripcion="Adónde marchan las tropas recién formadas (sobre un yacimiento: a trabajar).")
    if any(isinstance(e.ex, dict) and e.ex.get("q") for e in mismos):
        slots[-1] = Boton("cancelar", "Cancelar", "ESC", ("orden", "cancelar"), "orden", {"c": "cancelar", "i": -1},
                          descripcion="Cancela lo último de la cola y devuelve los recursos.")
    return slots
