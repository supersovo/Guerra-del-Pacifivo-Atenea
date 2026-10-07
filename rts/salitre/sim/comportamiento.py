"""Comportamiento de las unidades: cada tick ejecutan su orden actual.

Órdenes: mover, atacar-moviendo, atacar, mantener posición, patrullar,
recolectar, regresar con la carga, construir, reparar, seguir, curar, embarcar,
desembarcar y lanzar habilidades. Sin orden, la unidad está "en reposo": se
defiende, cura (las cantineras) o vuelve a su puesto.
"""

from math import isqrt

from . import combate, habilidades, veterania
from .constantes import AGUA, HFP, MEDIA, TICKS, TIERRA, TILE
from .entidades import (ATACAR, ATACAR_MOVER, CARGAR, CONSTRUIR, CURAR, DESCARGAR, HABILIDAD,
                        MANTENER, MOVER, PATRULLAR, RECOLECTAR, REGRESAR, REPARAR, SEGUIR, Orden)

ALCANCE_TRABAJO = TILE * 2 // 3       # distancia al borde para trabajar un edificio o yacimiento
CORREA = 10 * TILE                    # distancia máxima de persecución en reposo


def direccion(dx, dy):
    """0=E 1=SE 2=S 3=SO 4=O 5=NO 6=N 7=NE (y hacia abajo)."""
    ax = dx if dx >= 0 else -dx
    ay = dy if dy >= 0 else -dy
    if ax * 5 >= ay * 12:
        return 0 if dx >= 0 else 4
    if ay * 5 >= ax * 12:
        return 2 if dy >= 0 else 6
    if dx >= 0:
        return 1 if dy >= 0 else 7
    return 3 if dy >= 0 else 5


def velocidad(u, t):
    v = u.st.velocidad
    pct = u.mod("velocidad_pct", t)
    if pct:
        v = v * (100 + pct) // 100
    return v


def siguiente_orden(u):
    u.orden = u.cola.pop(0) if u.cola else None
    u.fase = 0
    u.objetivo = 0
    u.auto = False
    u.ruta = []
    u.ruta_meta = None
    u.ruta_pend = None
    u.fantasma = False
    if u.orden is None:
        u.casa_x, u.casa_y = u.x, u.y


# ----------------------------------------------------------------------
# Movimiento
def mover_a(m, u, nx, ny):
    """Mueve a (nx, ny) si el terreno lo permite (desliza contra los obstáculos)."""
    mapa = m.mapa
    r = u.radio
    if nx < r:
        nx = r
    elif nx > mapa.ancho_sub - r:
        nx = mapa.ancho_sub - r
    if ny < r:
        ny = r
    elif ny > mapa.alto_sub - r:
        ny = mapa.alto_sub - r
    capa = u.capa
    i0 = mapa.idx_de(u.x, u.y)
    i1 = mapa.idx_de(nx, ny)
    if i1 == i0 or _puede(mapa, capa, i0, i1):
        u.x, u.y = nx, ny
        return True
    # deslizar contra el obstáculo por el eje que sí se puede
    if nx != u.x:
        ix = mapa.idx_de(nx, u.y)
        if ix == i0 or _puede(mapa, capa, i0, ix):
            u.x = nx
            return True
    if ny != u.y:
        iy = mapa.idx_de(u.x, ny)
        if iy == i0 or _puede(mapa, capa, i0, iy):
            u.y = ny
            return True
    return False


def _puede(mapa, capa, a, b):
    if not mapa.puede_pasar(capa, a, b):
        return False
    w = mapa.w
    ay, ax = divmod(a, w)
    by, bx = divmod(b, w)
    if ax != bx and ay != by:
        c1 = ay * w + bx
        c2 = by * w + ax
        return mapa.puede_pasar(capa, a, c1) and mapa.puede_pasar(capa, a, c2)
    return True


def ir_a(m, u, x, y, cerca=0):
    """Avanza hacia (x, y) por el camino. 1 = llegó, 0 = en camino, -1 = no puede."""
    t = m.tick
    tipo = u.tipo
    if tipo.emplazar and (u.emplazada or u.emplazando):
        if u.emplazada and not u.emplazando:
            u.emplazando = veterania.tiempo_emplazar(m, u)
        return 0
    dx = x - u.x
    dy = y - u.y
    if cerca and dx * dx + dy * dy <= cerca * cerca:
        u.ruta = []
        return 1
    if u.ruta_meta != (x, y):
        m.pedir_ruta(u, x, y)
        return 0
    if u.ruta_pend is not None:
        return 0
    if not u.ruta:
        lim = max(cerca, TILE // 2)
        if dx * dx + dy * dy <= lim * lim:
            return 1
        return -1
    ruta = u.ruta
    if len(ruta) > 1:
        # Los puntos intermedios no hace falta pisarlos: si el siguiente ya se ve en
        # línea recta se va directo (evita que un grupo se atasque en el mismo punto).
        wx, wy = ruta[0]
        ex = wx - u.x
        ey = wy - u.y
        cerca_wp = ex * ex + ey * ey <= (TILE * 3 // 4) ** 2
        if (cerca_wp or (t + u.id) % 8 == 0) and m.mapa.linea_libre(u.capa, u.x, u.y, ruta[1][0], ruta[1][1]):
            ruta.pop(0)
    wx, wy = ruta[0]
    v = velocidad(u, t)
    ddx = wx - u.x
    ddy = wy - u.y
    d2 = ddx * ddx + ddy * ddy
    antes = d2
    if d2 <= v * v:
        nx, ny = wx, wy
        alcanzado = True
    else:
        d = isqrt(d2)
        nx = u.x + ddx * v // d
        ny = u.y + ddy * v // d
        alcanzado = False
    if ddx or ddy:
        u.dir = direccion(ddx, ddy)
    movio = mover_a(m, u, nx, ny)
    if movio:
        ex = wx - u.x
        ey = wy - u.y
        # si apenas se acercó al punto (resbala contra un obstáculo), cuenta como atasco
        movio = alcanzado or antes - (ex * ex + ey * ey) >= (v * v) // 8
    if movio:
        u.moviendo = True
        u.atasco = 0
        if alcanzado and u.x == wx and u.y == wy:
            u.ruta.pop(0)
            if not u.ruta:
                lim = max(cerca, TILE // 2)
                ex = x - u.x
                ey = y - u.y
                return 1 if ex * ex + ey * ey <= lim * lim else -1
    else:
        u.atasco += 1
        if u.atasco % 12 == 0:
            m.pedir_ruta(u, x, y)
        if u.atasco > 80:
            u.atasco = 0
            return -1
    return 0


def punto_acceso(m, u, tx, ty, w, h):
    """Casilla libre junto al rectángulo (tx, ty, w, h) más cercana a la unidad."""
    mapa = m.mapa
    pas = mapa.pasable[u.capa]
    reg = mapa.region[u.capa]
    i0 = mapa.idx_de(u.x, u.y)
    region = reg[i0] if pas[i0] else None
    mejor = None
    mejor_d = None
    for r in (1, 2):
        for yy in range(ty - r, ty + h + r):
            if yy < 0 or yy >= mapa.h:
                continue
            if yy == ty - r or yy == ty + h + r - 1:
                xs = range(tx - r, tx + w + r)
            else:
                xs = (tx - r, tx + w + r - 1)
            for xx in xs:
                if xx < 0 or xx >= mapa.w:
                    continue
                i = yy * mapa.w + xx
                if not pas[i] or (region is not None and reg[i] != region):
                    continue
                cx, cy = xx * TILE + MEDIA, yy * TILE + MEDIA
                d = (cx - u.x) ** 2 + (cy - u.y) ** 2
                if mejor_d is None or d < mejor_d:
                    mejor, mejor_d = (cx, cy), d
        if mejor is not None:
            return mejor
    return None


def junto_a(u, rect, margen=ALCANCE_TRABAJO):
    cx, cy = combate.punto_en_rect(u.x, u.y, rect)
    dx = cx - u.x
    dy = cy - u.y
    lim = u.radio + margen
    return dx * dx + dy * dy <= lim * lim


def acercarse_rect(m, u, ent, margen=ALCANCE_TRABAJO):
    """Lleva a la unidad junto a un edificio o yacimiento. 1 llegó, 0 en camino, -1 no puede."""
    if junto_a(u, ent.rect(), margen):
        u.ruta = []
        return 1
    p = punto_acceso(m, u, ent.tx, ent.ty, ent.w, ent.h)
    if p is None:
        return -1
    r = ir_a(m, u, p[0], p[1])
    if r == 1:
        return 1 if junto_a(u, ent.rect(), margen + TILE // 2) else -1
    return r


# ----------------------------------------------------------------------
# Combate
def radio_busqueda(u, t, atacando_moviendo=False):
    alc = combate.alcance_unidad(u, t)
    if atacando_moviendo:
        return max(alc + TILE, int(u.st.vision * TILE) * 3 // 4)
    if alc < TILE:
        return 4 * TILE
    return max(alc + TILE, min(int(u.st.vision * TILE), alc + 3 * TILE))


def buscar_objetivo(m, u, radio):
    arma = u.tipo.arma
    if arma is None:
        return None
    cat = m.cat
    p = u.dueno
    mejor = None
    mejor_k = None
    amin = u.st.alcance_min
    for e in m.rejilla.cerca(u.x, u.y, radio + TILE):
        if not m.enemigos(p, e.dueno) or not e.vivo:
            continue
        if not combate.arma_puede(arma, e, cat) or not combate.atacable(m, p, e):
            continue
        dx = e.x - u.x
        dy = e.y - u.y
        d2 = dx * dx + dy * dy
        lim = radio + u.radio + e.radio
        if d2 > lim * lim:
            continue
        if amin and isqrt(d2) - u.radio - e.radio < amin:
            continue
        prio = 0 if (e.tipo.arma is not None and not e.tipo.no_adquiere) else 1
        k = (prio, d2, e.id)
        if mejor_k is None or k < mejor_k:
            mejor, mejor_k = e, k
    for b in m.edificios_cerca(u.x, u.y, radio + 3 * TILE):
        if not b.vivo or not m.enemigos(p, b.dueno):
            continue
        if not combate.arma_puede(arma, b, cat) or not combate.atacable(m, p, b):
            continue
        d2 = combate.dist2_a(u.x, u.y, b)
        lim = radio + u.radio
        if d2 > lim * lim:
            continue
        if amin and isqrt(d2) - u.radio < amin:
            continue
        prio = 0 if (b.tipo.arma is not None or b.guarnicion) else 2
        k = (prio, d2, b.id)
        if mejor_k is None or k < mejor_k:
            mejor, mejor_k = b, k
    return mejor


def atacar(m, u, obj, puede_mover):
    """1 = combatiendo o acercándose; 0 = no puede (blanco inválido, inalcanzable)."""
    t = m.tick
    tipo = u.tipo
    arma = tipo.arma
    if arma is None or not combate.arma_puede(arma, obj, m.cat):
        return 0
    if not combate.atacable(m, u.dueno, obj):
        return 0
    alc = combate.alcance_unidad(u, t)
    d = combate.dist_borde(u, obj)
    if d <= alc:
        if d < u.st.alcance_min:
            return 0
        if u.emplazando:
            return 1
        if tipo.emplazar and not u.emplazada:
            u.emplazando = veterania.tiempo_emplazar(m, u)
            u.ruta = []
            u.ruta_meta = None
            return 1
        u.ruta = []
        u.ruta_meta = None
        u.dir = direccion(obj.x - u.x, obj.y - u.y)
        if u.enfr <= 0:
            bonus = 0
            if tipo.carga_bonus and u.mov_ticks >= tipo.carga_ticks:
                bonus = u.st.carga_pct
                u.mov_ticks = 0
                m.ev_pos(u.x, u.y, "carga", u.id)
            nivel = m.mapa.nivel_en(u.x, u.y)
            combate.disparar(m, u, obj, u.x, u.y, u.st, arma, u.mod("danio_pct", t), nivel,
                             u.mod("ignora_altura", t), bonus)
            u.enfr = combate.enfriamiento_unidad(u, t)
            u.ataco_t = t
            u.disparo_t = t
        return 1
    if not puede_mover:
        return 0
    if obj.es_unidad:
        mx, my = obj.x, obj.y
    else:
        p = punto_acceso(m, u, obj.tx, obj.ty, obj.w, obj.h)
        if p is None:
            return 0
        mx, my = p
    meta = u.ruta_meta
    if meta is None or ((meta[0] - mx) ** 2 + (meta[1] - my) ** 2 > TILE * TILE
                        and (t + u.id) % 6 == 0):
        m.pedir_ruta(u, mx, my)
        return 1
    r = ir_a(m, u, meta[0], meta[1])
    if r == -1:
        return 0
    if r == 1:
        u.ruta_meta = None
    return 1


def combatir(m, u, puede_mover, radio):
    """Combate automático: mantiene o busca blanco. True si está ocupada combatiendo."""
    t = m.tick
    obj = m.entidad(u.objetivo) if u.objetivo else None
    if obj is not None and not combate.atacable(m, u.dueno, obj):
        obj = None
    if obj is None and u.golpeado_t >= t - 4 and u.golpeado_por:
        a = m.entidad(u.golpeado_por)
        if a is not None and (a.es_unidad or a.es_edificio) and u.tipo.arma is not None \
                and combate.arma_puede(u.tipo.arma, a, m.cat) and combate.atacable(m, u.dueno, a):
            if puede_mover or combate.dist_borde(u, a) <= combate.alcance_unidad(u, t):
                obj = a
    if (t + u.buscar_t) % 8 == 0:
        if obj is None or combate.dist_borde(u, obj) > combate.alcance_unidad(u, t):
            nuevo = buscar_objetivo(m, u, radio)
            if nuevo is not None:
                obj = nuevo
    if obj is None:
        u.objetivo = 0
        return False
    u.objetivo = obj.id
    if atacar(m, u, obj, puede_mover) == 0:
        u.objetivo = 0
        return False
    return True


# ----------------------------------------------------------------------
# Curación
def es_curable(m, u, obj):
    return (obj.vivo and obj.es_unidad and not obj.dentro and obj.tipo.biologica
            and m.aliados(u.dueno, obj.dueno) and obj.vida < obj.st.vida)


def curar_paso(m, u, obj):
    if not es_curable(m, u, obj):
        return 0
    tipo = u.tipo
    if tipo.curar_costo and u.energia < tipo.curar_costo:
        return 0
    d = combate.dist_borde(u, obj)
    if d > tipo.curar_alcance:
        r = ir_a(m, u, obj.x, obj.y, cerca=tipo.curar_alcance + u.radio + obj.radio)
        if r == -1:
            return 0
        if r == 1:
            u.ruta_meta = None
        return 1
    u.ruta = []
    u.ruta_meta = None
    if obj is not u:
        u.dir = direccion(obj.x - u.x, obj.y - u.y)
    u.acum += u.st.curar_ritmo
    curados = 0
    while u.acum >= HFP and obj.vida < obj.st.vida:
        u.acum -= HFP
        obj.vida += 1
        curados += 1
        if tipo.curar_costo:
            u.energia -= tipo.curar_costo
            if u.energia < tipo.curar_costo:
                break
    if curados:
        veterania.por_curacion(m, u, curados)
    if u.acum >= HFP:
        u.acum = 0
    if (m.tick + u.id) % 12 == 0:
        m.ev_pos(u.x, u.y, "cura", u.id, obj.id)
    return 1


def buscar_herido(m, u):
    radio = u.tipo.curar_busqueda
    mejor = None
    mejor_k = None
    for v in m.rejilla.cerca(u.x, u.y, radio):
        if v is u or not es_curable(m, u, v):
            continue
        dx = v.x - u.x
        dy = v.y - u.y
        d2 = dx * dx + dy * dy
        if d2 > radio * radio:
            continue
        k = (v.vida * 100 // v.st.vida > 60, d2, v.id)
        if mejor_k is None or k < mejor_k:
            mejor, mejor_k = v, k
    return mejor


# ----------------------------------------------------------------------
# Reposo
def inactivo(m, u):
    t = m.tick
    tipo = u.tipo
    if tipo.curar_ritmo:
        obj = m.entidad(u.objetivo) if (u.objetivo and not u.auto) else None
        if obj is not None and curar_paso(m, u, obj):
            return
        u.objetivo = 0 if not u.auto else u.objetivo
        if (t + u.buscar_t) % 8 == 0:
            h = buscar_herido(m, u)
            if h is not None:
                u.objetivo = h.id
                u.auto = False
                curar_paso(m, u, h)
                return
        if tipo.arma is None:
            _volver_a_casa(m, u)
            return
    if tipo.arma is None or tipo.no_adquiere:
        return
    if u.objetivo:
        dx = u.x - u.casa_x
        dy = u.y - u.casa_y
        if dx * dx + dy * dy > CORREA * CORREA:
            u.objetivo = 0
            u.golpeado_t = -9999
    puede_mover = not tipo.emplazar
    if combatir(m, u, puede_mover, radio_busqueda(u, t)):
        u.auto = True
        return
    u.auto = False
    _volver_a_casa(m, u)


def _volver_a_casa(m, u):
    dx = u.x - u.casa_x
    dy = u.y - u.casa_y
    if dx * dx + dy * dy > (2 * TILE) ** 2 and not u.tipo.emplazar:
        r = ir_a(m, u, u.casa_x, u.casa_y, cerca=TILE)
        if r != 0:
            u.casa_x, u.casa_y = u.x, u.y
            u.ruta = []
            u.ruta_meta = None
    elif u.ruta_meta is not None:
        u.ruta = []
        u.ruta_meta = None


# ----------------------------------------------------------------------
# Economía
def deposito_cercano(m, u):
    mejor = None
    mejor_d = None
    for b in m.edificios.values():
        if b.dueno != u.dueno or not b.vivo or not b.construido or not b.tipo.deposito:
            continue
        d = combate.dist2_a(u.x, u.y, b)
        if mejor_d is None or d < mejor_d:
            mejor, mejor_d = b, d
    return mejor


def recurso_cercano(m, u, rtipo, x, y, radio, excluir=0):
    mejor = None
    mejor_k = None
    r2 = radio * radio
    for r in m.recursos.values():
        if not r.vivo or r.rtipo != rtipo or r.id == excluir:
            continue
        if rtipo == "salitre" and r.cantidad <= 0:
            continue
        if rtipo == "agua":
            mol = m.entidad(r.molino) if r.molino else None
            if mol is None or mol.dueno != u.dueno or not mol.construido:
                continue
        d = (r.x - x) ** 2 + (r.y - y) ** 2
        if d > r2:
            continue
        ocupado = 1 if (r.minero and r.minero != u.id) else 0
        k = (ocupado, d, r.id)
        if mejor_k is None or k < mejor_k:
            mejor, mejor_k = r, k
    return mejor


def _minero_valido(m, r):
    w = m.entidad(r.minero)
    return w is not None and w.orden is not None and w.orden.tipo == RECOLECTAR \
        and w.orden.obj == r.id and w.fase == 2


def depositar(m, u, dep):
    if not u.carga:
        return
    j = m.jugadores[u.dueno]
    if u.carga_tipo == 1:
        # el cuartel general compra el salitre en el acto: sale el signo $ sobre el edificio
        j.vender_salitre(u.carga)
        m.ev_pos(dep.x, dep.y, "venta", dep.id, u.carga)
    else:
        j.agua += u.carga
        j.est["agua_recolectada"] += u.carga
    u.carga = 0
    u.carga_tipo = 0


def recolectar(m, u, o):
    cat = m.cat
    u.fantasma = True
    if u.fase == 3:
        dep = deposito_cercano(m, u)
        if dep is None:
            m.ev_jugador(u.dueno, "err", "No hay un Cuartel General donde entregar")
            siguiente_orden(u)
            return
        r = acercarse_rect(m, u, dep)
        if r == 1:
            depositar(m, u, dep)
            u.fase = 0
            u.ruta = []
            u.ruta_meta = None
        elif r == -1:
            siguiente_orden(u)
        return
    res = m.entidad(o.obj)
    rtipo = o.dato or (res.rtipo if res is not None else "salitre")
    o.dato = rtipo
    if res is None or (rtipo == "salitre" and res.cantidad <= 0):
        nuevo = recurso_cercano(m, u, rtipo, u.x, u.y, 12 * TILE, o.obj)
        if nuevo is None:
            if u.carga:
                u.fase = 3
            else:
                siguiente_orden(u)
            return
        o.obj = nuevo.id
        res = nuevo
        u.fase = 0
        u.ruta_meta = None
    tipo_carga = 1 if rtipo == "salitre" else 2
    if u.carga and u.carga_tipo != tipo_carga:
        u.fase = 3
        return
    if u.carga and u.fase == 0 and u.carga_tipo == tipo_carga and (
            (tipo_carga == 1 and u.carga >= cat.carga_salitre) or tipo_carga == 2):
        u.fase = 3
        return
    u.recurso_id = res.id
    if rtipo == "salitre":
        if u.fase == 0:
            r = acercarse_rect(m, u, res)
            if r == 1:
                if res.minero in (0, u.id) or not _minero_valido(m, res):
                    res.minero = u.id
                    u.fase = 2
                    u.espera = cat.ticks_salitre
                else:
                    alt = _salitre_libre(m, u, res)
                    if alt is not None:
                        o.obj = alt.id
                        u.ruta_meta = None
                    else:
                        u.fase = 1
            elif r == -1:
                alt = _salitre_libre(m, u, res)
                if alt is not None:
                    o.obj = alt.id
                    u.ruta_meta = None
                else:
                    siguiente_orden(u)
        elif u.fase == 1:
            if res.minero == 0 or res.minero == u.id or not _minero_valido(m, res):
                res.minero = u.id
                u.fase = 2
                u.espera = cat.ticks_salitre
            elif (m.tick + u.id) % 6 == 0:
                alt = _salitre_libre(m, u, res)
                if alt is not None:
                    o.obj = alt.id
                    u.fase = 0
                    u.ruta_meta = None
        elif u.fase == 2:
            u.dir = direccion(res.x - u.x, res.y - u.y)
            u.espera -= 1
            if u.espera <= 0:
                n = min(cat.carga_salitre, res.cantidad)
                res.cantidad -= n
                u.carga = n
                u.carga_tipo = 1
                if res.minero == u.id:
                    res.minero = 0
                if res.cantidad <= 0:
                    m.agotar(res)
                u.fase = 3
                u.ruta_meta = None
        return
    # agua
    mol = m.entidad(res.molino) if res.molino else None
    if mol is None or mol.dueno != u.dueno or not mol.construido:
        m.ev_jugador(u.dueno, "err", "Ese pozo necesita un molino de agua terminado")
        siguiente_orden(u)
        return
    if u.fase in (0, 1):
        r = acercarse_rect(m, u, mol)
        if r == 1:
            if mol.ocupante == 0 or m.entidad(mol.ocupante) is None:
                mol.ocupante = u.id
                mol.ocupante_hasta = m.tick + cat.ticks_agua
                u.dentro = mol.id
                u.fase = 2
                u.ruta = []
                u.ruta_meta = None
            else:
                u.fase = 1
        elif r == -1:
            siguiente_orden(u)


def _salitre_libre(m, u, actual):
    mejor = None
    mejor_k = None
    for r in m.recursos.values():
        if r is actual or not r.vivo or r.rtipo != "salitre" or r.cantidad <= 0:
            continue
        d = (r.x - actual.x) ** 2 + (r.y - actual.y) ** 2
        if d > (6 * TILE) ** 2:
            continue
        if r.minero and r.minero != u.id and _minero_valido(m, r):
            continue
        k = ((r.x - u.x) ** 2 + (r.y - u.y) ** 2, r.id)
        if mejor_k is None or k < mejor_k:
            mejor, mejor_k = r, k
    return mejor


def regresar(m, u, o):
    if not u.carga:
        res = m.entidad(u.recurso_id)
        if res is not None:
            u.orden = Orden(RECOLECTAR, obj=res.id, dato=res.rtipo)
            u.fase = 0
        else:
            siguiente_orden(u)
        return
    u.fantasma = True
    dep = deposito_cercano(m, u)
    if dep is None:
        siguiente_orden(u)
        return
    r = acercarse_rect(m, u, dep)
    if r == 1:
        depositar(m, u, dep)
        res = m.entidad(u.recurso_id)
        if res is not None:
            u.orden = Orden(RECOLECTAR, obj=res.id, dato=res.rtipo)
            u.fase = 0
            u.ruta_meta = None
        else:
            siguiente_orden(u)
    elif r == -1:
        siguiente_orden(u)


# ----------------------------------------------------------------------
# Construcción y reparación
def construir(m, u, o):
    j = m.jugadores[u.dueno]
    tipo = m.cat.edificios.get(o.dato)
    if tipo is None:
        siguiente_orden(u)
        return
    if u.fase == 0:
        tx, ty = o.x, o.y
        rect = (tx * TILE, ty * TILE, (tx + tipo.ancho) * TILE, (ty + tipo.alto) * TILE)
        if junto_a(u, rect) or (tipo.sobre_recurso and junto_a(u, rect, TILE)):
            err = m.validar_construccion(j, tipo, tx, ty)
            if err:
                m.ev_jugador(u.dueno, "err", err)
                siguiente_orden(u)
                return
            b = m.iniciar_construccion(j, tipo, tx, ty, u)
            o.obj = b.id
            u.fase = 1
            u.ruta = []
            u.ruta_meta = None
            return
        p = punto_acceso(m, u, tx, ty, tipo.ancho, tipo.alto)
        if p is None:
            m.ev_jugador(u.dueno, "err", "No se puede llegar al lugar de la obra")
            siguiente_orden(u)
            return
        r = ir_a(m, u, p[0], p[1])
        if r == -1 or (r == 1 and not junto_a(u, rect, TILE)):
            m.ev_jugador(u.dueno, "err", "No se puede llegar al lugar de la obra")
            siguiente_orden(u)
        return
    b = m.entidad(o.obj)
    if b is None:
        siguiente_orden(u)
        return
    if b.construido:
        _tras_obra(m, u, b)
        return
    trabajar_obra(m, u, b)


def trabajar_obra(m, u, b):
    if b.constructor and b.constructor != u.id:
        otro = m.entidad(b.constructor)
        if otro is not None and otro.orden is not None and otro.orden.obj == b.id:
            siguiente_orden(u)
            return
    r = acercarse_rect(m, u, b)
    if r == -1:
        siguiente_orden(u)
        return
    if r == 0:
        return
    b.constructor = u.id
    u.dir = direccion(b.x - u.x, b.y - u.y)
    u.moviendo = False
    if m.construir_paso(b, u):
        _tras_obra(m, u, b)


def _tras_obra(m, u, b):
    if b.constructor == u.id:
        b.constructor = 0
    siguiente_orden(u)
    if u.orden is None and u.tipo.trabajador:
        if b.tipo.sobre_recurso and b.pozo:
            u.orden = Orden(RECOLECTAR, obj=b.pozo, dato="agua")
        elif b.tipo.deposito:
            res = recurso_cercano(m, u, "salitre", b.x, b.y, 12 * TILE)
            if res is not None:
                u.orden = Orden(RECOLECTAR, obj=res.id, dato="salitre")


def reparar(m, u, o):
    obj = m.entidad(o.obj)
    if obj is None or obj.dueno != u.dueno:
        siguiente_orden(u)
        return
    if obj.es_edificio and not obj.construido:
        trabajar_obra(m, u, obj)
        if obj.vivo and obj.construido and u.orden is o:
            siguiente_orden(u)
        return
    if obj.vida >= obj.st.vida or not (obj.es_edificio or obj.tipo.mecanica):
        siguiente_orden(u)
        return
    if obj.es_edificio:
        r = acercarse_rect(m, u, obj)
        if r == -1:
            siguiente_orden(u)
            return
        if r == 0:
            return
    else:
        d = combate.dist_borde(u, obj)
        margen = TILE * 3 // 2 if obj.capa == AGUA else TILE // 2
        if d > margen:
            r = ir_a(m, u, obj.x, obj.y, cerca=margen + u.radio + obj.radio)
            if r == -1:
                siguiente_orden(u)
            return
        u.ruta = []
    u.dir = direccion(obj.x - u.x, obj.y - u.y)
    j = m.jugadores[u.dueno]
    vida_max = obj.st.vida
    tiempo = obj.st.tiempo
    u.acum += vida_max * 100 // max(1, tiempo)
    cura = u.acum // 100
    u.acum %= 100
    if cura <= 0:
        return
    cura = min(cura, vida_max - obj.vida)
    costo = obj.st.costo
    # 25 % del costo para reparar el 100 % de la vida, cobrado en milésimas
    deuda_s = costo[0] * 250 * cura // vida_max
    deuda_a = costo[1] * 250 * cura // vida_max
    o.x += deuda_s
    o.y += deuda_a
    pagar_s = o.x // 1000
    pagar_a = o.y // 1000
    if j.dinero < pagar_s or j.agua < pagar_a:
        m.ev_jugador(u.dueno, "err", ("Falta dinero" if j.dinero < pagar_s else "Falta agua") + " para reparar")
        siguiente_orden(u)
        return
    j.dinero -= pagar_s
    j.agua -= pagar_a
    o.x -= pagar_s * 1000
    o.y -= pagar_a * 1000
    obj.vida += cura
    if (m.tick + u.id) % 12 == 0:
        m.ev_pos(u.x, u.y, "repara", u.id, obj.id)


# ----------------------------------------------------------------------
# Transporte
def cargar(m, u, o):
    cont = m.entidad(o.obj)
    if cont is None or not m.aliados(u.dueno, cont.dueno) or u.capa != TIERRA:
        siguiente_orden(u)
        return
    if cont.es_unidad:
        cap = cont.tipo.capacidad
        if cap <= 0 or m.espacio_usado(cont.cargamento) + u.tipo.espacio > cap:
            m.ev_jugador(u.dueno, "err", "El transporte va completo")
            siguiente_orden(u)
            return
        lim = cont.radio + u.radio + TILE * 5 // 4
        dx = cont.x - u.x
        dy = cont.y - u.y
        if dx * dx + dy * dy <= lim * lim:
            m.embarcar(cont, u)
            return
        if u.ruta_meta is None or (u.ruta_meta[0] - cont.x) ** 2 + (u.ruta_meta[1] - cont.y) ** 2 > TILE * TILE:
            m.pedir_ruta(u, cont.x, cont.y)
            return
        r = ir_a(m, u, u.ruta_meta[0], u.ruta_meta[1])
        if r != 0:
            lim2 = cont.radio + u.radio + TILE * 5 // 2
            if dx * dx + dy * dy <= lim2 * lim2:
                m.embarcar(cont, u)
            else:
                siguiente_orden(u)
        return
    # trinchera, barracas o cuartel general
    t = cont.tipo
    if not cont.construido or not t.guarnicion or u.tipo.categoria not in t.guarnicion_categorias \
            or u.tipo.clase not in t.guarnicion_clases:
        siguiente_orden(u)
        return
    if m.espacio_usado(cont.guarnicion) + u.tipo.espacio > t.guarnicion:
        nombre = m.cat.nombre(m.jugadores[cont.dueno].faccion.id, t.id)
        m.ev_jugador(u.dueno, "err", f"No queda lugar en {nombre}")
        siguiente_orden(u)
        return
    r = acercarse_rect(m, u, cont)
    if r == 1:
        m.embarcar(cont, u)
    elif r == -1:
        siguiente_orden(u)


def descargar(m, u, o):
    if not u.cargamento:
        siguiente_orden(u)
        return
    if u.fase == 0:
        p = m.punto_desembarco(u, o.x, o.y)
        if p is None:
            m.ev_jugador(u.dueno, "err", "No hay costa donde desembarcar")
            siguiente_orden(u)
            return
        o.x0, o.y0, o.obj = p
        u.fase = 1
    r = ir_a(m, u, o.x0, o.y0, cerca=TILE // 2)
    dx = o.x0 - u.x
    dy = o.y0 - u.y
    if r == 1 or dx * dx + dy * dy <= (TILE * 3 // 2) ** 2:
        m.desembarcar(u, o.obj)
        siguiente_orden(u)
    elif r == -1:
        siguiente_orden(u)


# ----------------------------------------------------------------------
def actualizar(m, u):
    t = m.tick
    tipo = u.tipo
    u.moviendo = False
    if tipo.energia_regen and u.energia < u.st.energia_max:
        u.energia = min(u.st.energia_max, u.energia + tipo.energia_regen)
    if u.enfr > 0:
        u.enfr -= 1
    reg = u.mod("regeneracion", t)
    if reg and u.vida < u.st.vida:
        u.regen += int(reg * HFP / TICKS)
        if u.regen >= HFP:
            u.vida = min(u.st.vida, u.vida + u.regen // HFP)
            u.regen %= HFP
    if u.emplazando:
        u.emplazando -= 1
        if u.emplazando == 0:
            u.emplazada = not u.emplazada
            m.ev_pos(u.x, u.y, "emplaza", u.id, 1 if u.emplazada else 0)
        _fin_tick(m, u, t)
        return
    if tipo.autonomo:
        camilleros(m, u)
        _fin_tick(m, u, t)
        return
    o = u.orden
    if o is None:
        inactivo(m, u)
    else:
        k = o.tipo
        if k == MOVER:
            if ir_a(m, u, o.x, o.y) != 0:
                siguiente_orden(u)
        elif k == ATACAR_MOVER or k == PATRULLAR:
            if tipo.curar_ritmo and _curar_en_marcha(m, u):
                u.fase = 1
            elif combatir(m, u, True, radio_busqueda(u, t, True)):
                u.fase = 1
            else:
                if u.fase == 1:
                    u.fase = 0
                    u.ruta_meta = None
                r = ir_a(m, u, o.x, o.y, cerca=TILE // 2)
                if r != 0:
                    if k == PATRULLAR:
                        o.x, o.y, o.x0, o.y0 = o.x0, o.y0, o.x, o.y
                        u.ruta_meta = None
                    else:
                        siguiente_orden(u)
        elif k == ATACAR:
            obj = m.entidad(o.obj)
            if obj is None or atacar(m, u, obj, True) == 0:
                siguiente_orden(u)
        elif k == MANTENER:
            combatir(m, u, False, combate.alcance_unidad(u, t))
            u.ruta = []
        elif k == RECOLECTAR:
            recolectar(m, u, o)
        elif k == REGRESAR:
            regresar(m, u, o)
        elif k == CONSTRUIR:
            construir(m, u, o)
        elif k == REPARAR:
            reparar(m, u, o)
        elif k == SEGUIR:
            seguir(m, u, o)
        elif k == CURAR:
            obj = m.entidad(o.obj)
            if obj is None or curar_paso(m, u, obj) == 0:
                siguiente_orden(u)
        elif k == CARGAR:
            cargar(m, u, o)
        elif k == DESCARGAR:
            descargar(m, u, o)
        elif k == HABILIDAD:
            habilidades.orden_habilidad(m, u, o)
        else:
            siguiente_orden(u)
    _fin_tick(m, u, t)


# ----------------------------------------------------------------------
# Camilleros
def _hospital_de(m, u):
    """El hospital de los camilleros (si cayó, el hospital propio más cercano)."""
    b = m.entidad(u.base_id) if u.base_id else None
    if b is not None and b.es_edificio and b.construido and b.tipo.camilleros:
        return b
    mejor = None
    mejor_d = None
    for e in m.edificios.values():
        if e.dueno != u.dueno or not e.vivo or not e.construido or not e.tipo.camilleros:
            continue
        d = (e.x - u.x) ** 2 + (e.y - u.y) ** 2
        if mejor_d is None or d < mejor_d:
            mejor, mejor_d = e, d
    u.base_id = mejor.id if mejor is not None else 0
    return mejor


def _herido_libre(m, h, u):
    if h.camillero in (0, u.id):
        return True
    c = m.entidad(h.camillero)
    return c is None or c.objetivo != h.id


def _buscar_caido(m, u, hosp):
    radio2 = hosp.tipo.camilleros_radio ** 2
    mejor = None
    mejor_k = None
    for h in m.heridos.values():
        if not h.vivo or h.dueno != u.dueno or h.camillero < 0 or not _herido_libre(m, h, u):
            continue
        if (h.x - hosp.x) ** 2 + (h.y - hosp.y) ** 2 > radio2:
            continue
        # primero los veteranos de más grado: su experiencia no se recupera
        grado = h.hoja[1] if h.hoja else 0
        k = (-grado, (h.x - u.x) ** 2 + (h.y - u.y) ** 2, h.id)
        if mejor_k is None or k < mejor_k:
            mejor, mejor_k = h, k
    return mejor


def camilleros(m, u):
    """Sin órdenes del jugador: buscan a los heridos propios cerca de su hospital, los cargan en
    la camilla y los llevan a curar; si no hay nadie que recoger, esperan junto al hospital."""
    u.fantasma = True
    hosp = _hospital_de(m, u)
    if hosp is None:
        u.ruta = []
        u.ruta_meta = None
        return
    if u.paciente:
        r = acercarse_rect(m, u, hosp)
        if r == 1:
            hosp.pacientes.append([u.paciente, hosp.tipo.recuperacion, u.paciente_hoja])
            m.ev_pos(hosp.x, hosp.y, "ingresa", hosp.id, m.cat.unidades[u.paciente].idx)
            u.paciente = None
            u.paciente_hoja = None
            u.ruta = []
            u.ruta_meta = None
        return
    h = m.ent.get(u.objetivo) if u.objetivo else None
    if h is None or not h.vivo or not h.es_herido or not _herido_libre(m, h, u):
        h = _buscar_caido(m, u, hosp)
        u.objetivo = h.id if h is not None else 0
        if h is None:
            # esperan junto al hospital, cada equipo en su lugar (a un lado y al otro de la puerta)
            lado = 1 if u.id % 2 else -1
            ex, ey = hosp.x + lado * (hosp.w * TILE // 2 - TILE // 2), hosp.y + hosp.h * TILE // 2 + TILE
            if (u.x - ex) ** 2 + (u.y - ey) ** 2 > TILE * TILE:
                if ir_a(m, u, ex, ey, cerca=TILE // 2) == -1:
                    u.ruta = []
                    u.ruta_meta = None
            else:
                u.ruta = []
                u.ruta_meta = None
            return
        h.camillero = u.id
    r = ir_a(m, u, h.x, h.y, cerca=TILE // 2)
    if r == 1:
        u.paciente = h.tipo.id
        u.paciente_hoja = h.hoja
        h.vivo = False
        m.muertos.append(h)
        m.ev_pos(h.x, h.y, "recogido", h.id, u.id)
        u.objetivo = 0
        u.ruta = []
        u.ruta_meta = None
    elif r == -1:
        h.camillero = -1        # no se llega hasta él (otra isla, quebrada): nadie más lo intenta
        u.objetivo = 0


def _curar_en_marcha(m, u):
    """Las cantineras que avanzan con la tropa curan a los heridos del camino."""
    obj = m.entidad(u.objetivo) if u.objetivo else None
    if obj is None or not es_curable(m, u, obj):
        obj = None
        if (m.tick + u.buscar_t) % 8 == 0:
            obj = buscar_herido(m, u)
    if obj is None:
        u.objetivo = 0
        return False
    u.objetivo = obj.id
    if curar_paso(m, u, obj):
        return True
    u.objetivo = 0
    return False


def seguir(m, u, o):
    obj = m.entidad(o.obj)
    if obj is None or obj.es_recurso or (obj.es_unidad and obj.dentro):
        siguiente_orden(u)
        return
    if u.tipo.curar_ritmo and obj.es_unidad and es_curable(m, u, obj):
        curar_paso(m, u, obj)
        return
    if obj.es_unidad:
        d = combate.dist_borde(u, obj)
        if d > TILE * 3 // 2:
            meta = u.ruta_meta
            if meta is None or (meta[0] - obj.x) ** 2 + (meta[1] - obj.y) ** 2 > (2 * TILE) ** 2:
                m.pedir_ruta(u, obj.x, obj.y)
            else:
                ir_a(m, u, meta[0], meta[1], cerca=TILE)
        else:
            u.ruta = []
            u.ruta_meta = None
    else:
        if acercarse_rect(m, u, obj, TILE) != 0:
            siguiente_orden(u)


def _fin_tick(m, u, t):
    tipo = u.tipo
    if u.moviendo:
        u.mov_ticks += 1
        u.quieto = 0
    else:
        u.mov_ticks = 0
        if t - u.ataco_t > 8:
            u.quieto += 1
        else:
            u.quieto = 0
    oculta = tipo.camuflaje or bool(u.mod("camuflaje", t))
    if not oculta and tipo.camuflaje_quieto and u.quieto >= tipo.camuflaje_quieto:
        oculta = True
    u.oculta = oculta


# ----------------------------------------------------------------------
def _anclada(u):
    o = u.orden
    if u.emplazada or u.emplazando:
        return True
    if o is not None and o.tipo == MANTENER:
        return True
    if o is not None and o.tipo in (CONSTRUIR, REPARAR) and u.fase >= 1 and not u.moviendo:
        return True
    return False


def separar(m):
    """Aparta a las unidades superpuestas (las que marchan empujan a las que están quietas)."""
    t = m.tick
    mapa = m.mapa
    rejilla = m.rejilla
    for u in m.unidades.values():
        if not u.vivo or u.dentro or u.fantasma:
            continue
        if not u.moviendo and (t + u.id) % 4:
            continue
        ru = u.radio
        au = _anclada(u)
        for v in rejilla.cerca(u.x, u.y, ru + TILE):
            if v is u or v.fantasma or v.capa != u.capa or not v.vivo or v.dentro:
                continue
            dx = v.x - u.x
            dy = v.y - u.y
            lim = ru + v.radio
            d2 = dx * dx + dy * dy
            if d2 >= lim * lim:
                continue
            if d2 == 0:
                k = (min(u.id, v.id) * 7 + max(u.id, v.id) * 3) % 8
                dx, dy = ((16, 0), (11, 11), (0, 16), (-11, 11), (-16, 0), (-11, -11), (0, -16), (11, -11))[k]
                if u.id > v.id:
                    dx, dy = -dx, -dy
                d = 16
            else:
                d = isqrt(d2) or 1
            # cada par puede revisarse dos veces por tick: se empuja la mitad cada vez
            emp = (lim - d) // 4 + 1
            px = dx * emp // d
            py = dy * emp // d
            av = _anclada(v)
            if au and av:
                continue
            if av:
                _empujar(mapa, u, -2 * px, -2 * py)
            elif au:
                _empujar(mapa, v, 2 * px, 2 * py)
            else:
                _empujar(mapa, u, -px, -py)
                _empujar(mapa, v, px, py)


def _empujar(mapa, u, dx, dy):
    nx = u.x + dx
    ny = u.y + dy
    r = u.radio
    if nx < r or ny < r or nx > mapa.ancho_sub - r or ny > mapa.alto_sub - r:
        return
    i0 = mapa.idx_de(u.x, u.y)
    i1 = mapa.idx_de(nx, ny)
    if i1 == i0 or (mapa.puede_pasar(u.capa, i0, i1) and _puede(mapa, u.capa, i0, i1)):
        u.x = nx
        u.y = ny
