"""Lógica de los edificios: colas de producción e investigación, defensas,
guarniciones (en la trinchera o en el techo de las barracas y del cuartel
general) y el ir y venir de los trabajadores del molino."""

from . import combate
from .comportamiento import deposito_cercano, direccion
from .constantes import TICKS, TIERRA, TILE

ARRANQUE_CAMILLEROS = TICKS * 4     # entre los primeros equipos de un hospital nuevo


def actualizar(m, b):
    if not b.construido:
        return
    t = m.tick
    tipo = b.tipo
    if tipo.energia_regen and b.energia < b.st.energia_max:
        b.energia = min(b.st.energia_max, b.energia + tipo.energia_regen)
    if b.ocupante and t >= b.ocupante_hasta:
        _salir_molino(m, b)
    if b.cola and b.sabotaje_hasta <= t:
        _avanzar_cola(m, b)
    if tipo.arma is not None:
        _defender(m, b)
    if b.guarnicion:
        _fuego_guarnicion(m, b)
    if tipo.camilleros:
        _hospital(m, b)
    if b.desmontando:
        b.desmontando -= 1
        if b.desmontando <= 0:
            m.desmontar(b)


def equipos_de(m, b):
    """Cuántos equipos de camilleros mantiene un hospital (los suyos más los del Servicio sanitario)."""
    return b.tipo.camilleros + m.jugadores[b.dueno].sanidad["equipos"]


def _hospital(m, b):
    """Equipos de camilleros (se reponen si caen) y pacientes que se recuperan y vuelven a filas."""
    t = m.tick
    tipo = b.tipo
    vivos = [i for i in b.camilleros if m.entidad(i) is not None]
    if len(vivos) < len(b.camilleros):
        b.camilleros_t = max(b.camilleros_t, t + tipo.reposicion)     # cayó un equipo: tarda en reponerse
    b.camilleros = vivos
    if not b.desmontando and len(vivos) < equipos_de(m, b) and t >= b.camilleros_t:
        x, y = m.punto_salida(b, TIERRA)
        u = m.crear_unidad(b.dueno, "camilleros", x, y)
        u.base_id = b.id
        u.fantasma = True
        b.camilleros.append(u.id)
        b.camilleros_t = t + ARRANQUE_CAMILLEROS
    if b.pacientes:
        m.atender_pacientes(b)


def _salir_molino(m, b):
    u = m.ent.get(b.ocupante)
    b.ocupante = 0
    if u is None or not u.vivo:
        return
    cat = m.cat
    pozo = m.ent.get(b.pozo)
    n = 0
    if pozo is not None:
        if pozo.cantidad >= cat.carga_agua:
            n = cat.carga_agua
            pozo.cantidad -= n
            if pozo.cantidad == 0:
                m.ev_jugador(b.dueno, "pozo_agotado", pozo.id)
        elif pozo.cantidad > 0:
            n = pozo.cantidad
            pozo.cantidad = 0
            m.ev_jugador(b.dueno, "pozo_agotado", pozo.id)
        else:
            n = cat.carga_agua_agotada
    u.carga = n
    u.carga_tipo = 2 if n else 0
    u.dentro = 0
    dep = deposito_cercano(m, u)
    u.x, u.y = m.punto_salida(b, TIERRA, (dep.x, dep.y) if dep is not None else None)
    u.fase = 3
    u.ruta = []
    u.ruta_meta = None


def _avanzar_cola(m, b):
    t = m.tick
    j = m.jugadores[b.dueno]
    item = b.cola[0]
    if item[0] == "u":
        ut = m.cat.unidades[item[1]]
        if not item[4]:
            if j.pob_usada + ut.poblacion > j.pob_max:
                if t - j.aviso_poblacion_t >= TICKS * 10:
                    j.aviso_poblacion_t = t
                    m.ev_jugador(j.idx, "pob")
                return
            j.pob_usada += ut.poblacion
            item[4] = True
        item[2] += 1
        if item[2] >= item[3]:
            b.cola.pop(0)
            m.producir_unidad(b, ut)
    else:
        item[2] += 1
        if item[2] >= item[3]:
            b.cola.pop(0)
            mej = m.cat.mejoras[item[1]]
            j.investigando.discard(mej.id)
            j.aplicar_mejora(mej)
            m.refrescar_stats(j)
            m.ev_jugador(j.idx, "investigado", mej.idx)


def _buscar(m, b, arma, alcance):
    mejor = None
    mejor_k = None
    radio = alcance + max(b.w, b.h) * TILE
    for e in m.rejilla.cerca(b.x, b.y, radio):
        if not e.vivo or not m.enemigos(b.dueno, e.dueno):
            continue
        if not combate.arma_puede(arma, e, m.cat) or not combate.atacable(m, b.dueno, e):
            continue
        d = combate.dist_borde_edif(b, e)
        if d > alcance:
            continue
        k = (0 if e.tipo.arma is not None else 1, d, e.id)
        if mejor_k is None or k < mejor_k:
            mejor, mejor_k = e, k
    return mejor


def _defender(m, b):
    t = m.tick
    if b.enfr > 0:
        b.enfr -= 1
    arma = b.tipo.arma
    alc = b.st.alcance
    obj = m.entidad(b.objetivo) if b.objetivo else None
    if obj is not None and (not combate.atacable(m, b.dueno, obj)
                            or combate.dist_borde_edif(b, obj) > alc):
        obj = None
    if obj is None and (t + b.id) % 8 == 0:
        obj = _buscar(m, b, arma, alc)
    b.objetivo = obj.id if obj is not None else 0
    if obj is not None and b.enfr <= 0:
        b.dir = direccion(obj.x - b.x, obj.y - b.y)
        combate.disparar(m, b, obj, b.x, b.y, b.st, arma, 0, m.mapa.nivel_en(b.x, b.y), False)
        b.enfr = b.st.enfriamiento


def _fuego_guarnicion(m, b):
    t = m.tick
    extra = b.tipo.guarnicion_alcance
    nivel = m.mapa.nivel_en(b.x, b.y)
    if b.tipo.guarnicion_vista == "techo":
        nivel = min(2, nivel + 1)       # desde el techo se dispara como desde una loma
    for k, uid in enumerate(b.guarnicion):
        u = m.ent.get(uid)
        if u is None or not u.vivo or u.tipo.arma is None:
            continue
        if u.enfr > 0:
            u.enfr -= 1
            continue
        alc = combate.alcance_unidad(u, t) + extra
        obj = m.entidad(u.objetivo) if u.objetivo else None
        if obj is not None and (not combate.atacable(m, u.dueno, obj)
                                or combate.dist_borde_edif(b, obj) > alc):
            obj = None
        if obj is None and (t + u.id) % 8 == 0:
            obj = _buscar(m, b, u.tipo.arma, alc)
        u.objetivo = obj.id if obj is not None else 0
        if obj is not None:
            combate.disparar(m, u, obj, b.x, b.y, u.st, u.tipo.arma, u.mod("danio_pct", t), nivel, False,
                             desde=(b.id, k))
            u.enfr = combate.enfriamiento_unidad(u, t)
            u.disparo_t = t
