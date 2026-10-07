"""Combate: alcance, elección de blancos, daño, explosiones y proyectiles.

Daño = daño del arma x multiplicador (tipo de ataque contra clase de armadura)
x (100 + bonificaciones %) / 100 - armadura, con un mínimo de 1. Desde un nivel
más bajo hacia uno más alto hay un 30 % de errar (ventaja de la altura).
"""

from math import isqrt

from .constantes import AGUA, TICKS, TILE
from .entidades import Proyectil

EV_DISPARO = "dis"
EV_PROYECTIL = "pro"
EV_EXPLOSION = "exp"


def punto_en_rect(x, y, rect):
    x0, y0, x1, y1 = rect
    cx = x0 if x < x0 else (x1 if x > x1 else x)
    cy = y0 if y < y0 else (y1 if y > y1 else y)
    return cx, cy


def dist2_a(x, y, e):
    """Distancia al cuadrado desde (x, y) al borde de e (sin restar el radio de una unidad)."""
    if e.es_unidad or e.es_mina:
        dx = e.x - x
        dy = e.y - y
        return dx * dx + dy * dy
    cx, cy = punto_en_rect(x, y, e.rect())
    dx = cx - x
    dy = cy - y
    return dx * dx + dy * dy


def dist_borde(a, e):
    """Distancia (entera) entre los bordes de a (unidad) y e."""
    d = isqrt(dist2_a(a.x, a.y, e))
    d -= a.radio
    if e.es_unidad:
        d -= e.radio
    return d if d > 0 else 0


def dist_borde_edif(b, e):
    """Distancia entre el borde del edificio b y el borde de e."""
    x0, y0, x1, y1 = b.rect()
    if e.es_unidad:
        cx, cy = punto_en_rect(e.x, e.y, (x0, y0, x1, y1))
        d = isqrt((cx - e.x) ** 2 + (cy - e.y) ** 2) - e.radio
    else:
        ex0, ey0, ex1, ey1 = e.rect()
        dx = max(0, ex0 - x1, x0 - ex1)
        dy = max(0, ey0 - y1, y0 - ey1)
        d = isqrt(dx * dx + dy * dy)
    return d if d > 0 else 0


def alcance_unidad(u, tick):
    a = u.st.alcance
    extra = u.mod("alcance", tick)
    if extra:
        a += int(extra * TILE)
    return a


def enfriamiento_unidad(u, tick):
    e = u.st.enfriamiento
    pct = u.mod("ataque_vel_pct", tick)
    if pct:
        e = max(1, e * 100 // (100 + pct))
    return e


def armadura_de(e, tick):
    if e.es_unidad:
        return e.st.armadura + e.mod("armadura", tick)
    return e.st.armadura


def clase_de(e):
    return e.tipo.clase


def arma_puede(arma, e, catalogo):
    """¿El arma puede dañar a la entidad e (capa y multiplicador)?"""
    if e.es_unidad:
        if e.capa == AGUA:
            if arma.objetivos == "tierra":
                return False
        elif arma.objetivos == "agua":
            return False
    elif arma.objetivos == "agua":
        return False
    return catalogo.multiplicadores[arma.tipo].get(e.tipo.clase, 100) > 0


def calcular_danio(catalogo, base, tipo_ataque, danio_pct, bonus_edif, objetivo, tick):
    mult = catalogo.multiplicadores[tipo_ataque].get(objetivo.tipo.clase, 100)
    if mult <= 0:
        return 0
    d = (base * mult * (100 + danio_pct) + 5000) // 10000
    if bonus_edif and objetivo.es_edificio:
        d = d * (100 + bonus_edif) // 100
    if objetivo.es_unidad and objetivo.tipo.cuadro and tipo_ataque == "sable":
        d = d * (100 - objetivo.tipo.cuadro) // 100
    d -= armadura_de(objetivo, tick)
    return d if d > 1 else 1


def danar(m, objetivo, d, atacante_id, dueno_atacante, por_explosion=False):
    if not objetivo.vivo or d <= 0:
        return
    t = m.tick
    if objetivo.es_unidad and objetivo.mod("inmortal", t):
        objetivo.vida = max(1, objetivo.vida - d)
    else:
        objetivo.vida -= d
    if objetivo.es_unidad:
        objetivo.golpeado_por = atacante_id
        objetivo.golpeado_t = t
    elif objetivo.es_edificio:
        objetivo.golpeado_t = t
    m.avisar_ataque(objetivo)
    if objetivo.vida <= 0:
        m.matar(objetivo, atacante_id, dueno_atacante, por_explosion)


def explotar(m, x, y, radio, base, tipo_ataque, dueno, atacante_id, danio_pct=0, bonus_edif=0,
             solo_tierra=False):
    """Daño en área: 100 % en la mitad interior del radio y 50 % en el resto. Solo a enemigos."""
    cat = m.cat
    t = m.tick
    r2 = radio * radio
    medio2 = (radio // 2) * (radio // 2)
    m.ev_pos(x, y, EV_EXPLOSION, x >> 4, y >> 4, radio >> 4, tipo_ataque)
    victimas = []
    for e in m.rejilla.cerca(x, y, radio + TILE):
        if not e.vivo or e.dentro or not m.enemigos(dueno, e.dueno):
            continue
        if solo_tierra and e.capa == AGUA:
            continue
        dx = e.x - x
        dy = e.y - y
        d2 = dx * dx + dy * dy
        lim = radio + e.radio
        if d2 <= lim * lim:
            victimas.append((e, d2 <= medio2 + e.radio * e.radio))
    for b in m.edificios_cerca(x, y, radio + 2 * TILE):
        if not b.vivo or not m.enemigos(dueno, b.dueno):
            continue
        if dist2_a(x, y, b) <= r2:
            victimas.append((b, dist2_a(x, y, b) <= medio2))
    for e, centro in victimas:
        d = calcular_danio(cat, base, tipo_ataque, danio_pct, bonus_edif, e, t)
        if not centro:
            d = max(1, d // 2)
        danar(m, e, d, atacante_id, dueno, por_explosion=True)


def atacable(m, dueno, e):
    """¿El jugador puede ver y atacar a e?"""
    if not e.vivo or not m.enemigos(dueno, e.dueno):
        return False
    if e.es_unidad:
        if e.dentro:
            return False
        if e.oculta and not m.detectado(dueno, e):
            return False
        return m.visible(dueno, e.x, e.y)
    if e.es_edificio:
        return m.visible_edificio(dueno, e)
    if e.es_mina:
        return m.detectado(dueno, e) and m.visible(dueno, e.x, e.y)
    return False


def disparar(m, atacante, objetivo, ox, oy, st, arma, danio_pct, nivel_origen, ignora_altura,
             bonus_carga=0, desde=None):
    """Efectúa un disparo de 'atacante' desde (ox, oy) contra 'objetivo'.

    desde = (id del edificio, puesto) cuando dispara un soldado guarnecido: los clientes
    no lo ven (está dentro) y dibujan el fogonazo en su puesto de la trinchera o del techo.
    """
    lugar = desde or ()
    t = m.tick
    cat = m.cat
    base = st.danio
    if bonus_carga:
        base = base * (100 + bonus_carga) // 100
    bonus_edif = atacante.tipo.bonus_edificios if atacante.es_unidad else 0
    falla = False
    if not ignora_altura:
        nv_obj = m.mapa.nivel_en(objetivo.x, objetivo.y)
        if nv_obj > nivel_origen and m.azar.prob(cat.fallo_altura):
            falla = True
    dueno = atacante.dueno
    if arma.vel_proyectil:
        tx, ty = objetivo.x, objetivo.y
        if falla:
            tx += m.azar.rango(-TILE, TILE)
            ty += m.azar.rango(-TILE, TILE)
        dx = tx - ox
        dy = ty - oy
        dist = isqrt(dx * dx + dy * dy)
        vuelo = max(2, dist // arma.vel_proyectil)
        m.proyectiles.append(Proyectil(ox, oy, tx, ty, t + vuelo, base, arma.tipo, st.salpicadura,
                                       dueno, atacante.id, 0 if st.salpicadura else objetivo.id,
                                       bonus_edif, danio_pct))
        m.ev_pos(ox, oy, EV_PROYECTIL, atacante.id, ox >> 4, oy >> 4, tx >> 4, ty >> 4, vuelo, arma.tipo, *lugar)
        return
    m.ev_pos(ox, oy, EV_DISPARO, atacante.id, objetivo.id, arma.tipo, 1 if falla else 0, *lugar)
    if falla:
        return
    d = calcular_danio(cat, base, arma.tipo, danio_pct, bonus_edif, objetivo, t)
    danar(m, objetivo, d, atacante.id, dueno)


def impacto(m, p):
    """Llega un proyectil."""
    if p.salpicadura:
        explotar(m, p.x1, p.y1, p.salpicadura, p.danio, p.tipo_danio, p.dueno, p.atacante,
                 p.danio_pct, p.bonus_edif)
        return
    obj = m.entidad(p.objetivo)
    if obj is None or not obj.vivo:
        return
    if dist2_a(p.x1, p.y1, obj) > (obj.radio + TILE // 2) ** 2:
        return
    d = calcular_danio(m.cat, p.danio, p.tipo_danio, p.danio_pct, p.bonus_edif, obj, m.tick)
    danar(m, obj, d, p.atacante, p.dueno)


__all__ = ["dist2_a", "dist_borde", "explotar", "danar", "disparar", "impacto", "atacable",
           "calcular_danio", "TICKS"]
