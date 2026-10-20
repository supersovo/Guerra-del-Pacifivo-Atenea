"""Balística de la artillería: dispersión de las granadas (error circular probable) y viento.

Una pieza con 'cep' en su arma no pone la granada en el blanco: la desvía con una normal
bidimensional cuyo error circular probable (la mitad de los disparos cae dentro de ese radio)
crece con la distancia y cuesta arriba, y se reduce a la mitad con un observador adelantado
propio (espía, baqueano) cerca del blanco. El viento, además, corre todas las granadas hacia
donde sopla, más cuanto más largo es el vuelo.

Todo en enteros, para que la partida sea idéntica en cualquier equipo: la transformada de
Box-Muller se calcula con el logaritmo en base 2 por cuadrados sucesivos, la raíz cuadrada
entera (math.isqrt) y una tabla fija de senos; el azar sale solo de m.azar.
"""

from math import isqrt

from . import veterania
from .constantes import TILE

ESCALA = 1 << 14         # senos y cosenos en 1/16384
PASOS = 256              # el giro completo se divide en 256 ángulos
RUMBOS = 16              # rumbos del viento (0 = hacia el este, 4 = hacia el sur, 8 = oeste, 12 = norte)

# sen(i·π/128)·16384 para i = 0..64 (un cuarto de vuelta); el resto sale por simetría
_CUARTO = (
    0, 402, 804, 1205, 1606, 2006, 2404, 2801, 3196, 3590, 3981, 4370, 4756,
    5139, 5520, 5897, 6270, 6639, 7005, 7366, 7723, 8076, 8423, 8765, 9102, 9434,
    9760, 10080, 10394, 10702, 11003, 11297, 11585, 11866, 12140, 12406, 12665, 12916, 13160,
    13395, 13623, 13842, 14053, 14256, 14449, 14635, 14811, 14978, 15137, 15286, 15426, 15557,
    15679, 15791, 15893, 15986, 16069, 16143, 16207, 16261, 16305, 16340, 16364, 16379, 16384,
)


def seno(a):
    """Seno del ángulo a (en 1/PASOS de vuelta), en 1/ESCALA."""
    a &= PASOS - 1
    if a < 64:
        return _CUARTO[a]
    if a < 128:
        return _CUARTO[128 - a]
    if a < 192:
        return -_CUARTO[a - 128]
    return -_CUARTO[256 - a]


def coseno(a):
    return seno(a + 64)


def log2_q16(k):
    """log2(k) en punto fijo (1/65536) para un entero k >= 1: la parte entera es el largo en
    bits y la fraccionaria se obtiene bit a bit elevando la mantisa al cuadrado (exacto)."""
    n = k.bit_length() - 1
    x = (k << 30) >> n              # mantisa en [1, 2) con 30 bits de fracción
    frac = 0
    for i in range(16):
        x = (x * x) >> 30
        if x >= 1 << 31:
            x >>= 1
            frac |= 1 << (15 - i)
    return (n << 16) | frac


def desvio(azar, cep):
    """Desvío (dx, dy), en subunidades, de un disparo con error circular probable 'cep'.

    Box-Muller: con U1 y U2 uniformes, R = sqrt(-2 ln U1) y el ángulo 2π·U2 dan una normal de
    desviación típica 1 en cada eje. Como el error circular probable es sigma·sqrt(2 ln 2), el
    radio en subunidades es cep·sqrt(-log2 U1): la mitad de los disparos (U1 > 1/2) cae a menos
    de 'cep' del blanco."""
    if cep <= 0:
        return 0, 0
    k = azar.entero(1 << 16) + 1                  # U1 = k / 65536, en (0, 1]
    menos_log2 = (16 << 16) - log2_q16(k)         # -log2(U1) en 1/65536
    r = cep * isqrt(menos_log2) >> 8              # la raíz de un valor en 1/65536 queda en 1/256
    a = azar.entero(PASOS)                        # 2π·U2
    return r * coseno(a) // ESCALA, r * seno(a) // ESCALA


def observado(m, dueno, x, y):
    """¿Hay un observador adelantado (espía, baqueano) del bando que dispara cerca de (x, y)?"""
    for v in m.rejilla.cerca(x, y, m.cat.observador_max):
        r = v.tipo.observador
        if not r or not v.vivo or v.dentro or not m.aliados(dueno, v.dueno):
            continue
        dx = v.x - x
        dy = v.y - y
        if dx * dx + dy * dy <= r * r:
            return True
    return False


def cep_efectivo(m, atacante, arma, dist, nivel_origen, nivel_blanco, ignora_altura, observado_):
    """CEP = CEP base × (distancia / TILE) × (1 + penalización por tirar cuesta arriba), a la
    mitad con un observador adelantado. La penalización baja con la veteranía, como la falla
    de la fusilería cuesta arriba."""
    b = m.cat.balistica
    cep = arma.cep * dist // TILE
    if not ignora_altura and nivel_blanco > nivel_origen:
        pen = b.altura_pct * veterania.fallo_altura(m, atacante) // max(1, m.cat.fallo_altura)
        cep = cep * (100 + pen) // 100
    if observado_:
        cep = cep * b.observador_pct // 100
    return cep


def nuevo_viento(m):
    """Al comenzar la partida y cada tanto el viento rola un rumbo y cambia de fuerza (m.azar)."""
    if m.viento is None:
        m.viento = (m.azar.entero(RUMBOS), m.azar.rango(10, 60))
        return
    rumbo, fuerza = m.viento
    rumbo = (rumbo + m.azar.rango(-1, 1)) % RUMBOS
    fuerza = max(0, min(100, fuerza + m.azar.rango(-15, 15)))
    m.viento = (rumbo, fuerza)


def deriva(m, dist):
    """Cuánto corre el viento una granada que vuela 'dist' subunidades: (dx, dy)."""
    rumbo, fuerza = m.viento
    d = m.cat.balistica.viento_max * fuerza * dist // (100 * TILE)
    a = rumbo * (PASOS // RUMBOS)
    return d * coseno(a) // ESCALA, d * seno(a) // ESCALA


def punto_impacto(m, atacante, objetivo, ox, oy, arma, nivel_origen, ignora_altura):
    """Dónde cae la granada de una pieza con CEP que tira desde (ox, oy) contra 'objetivo'."""
    x, y = objetivo.x, objetivo.y
    dx = x - ox
    dy = y - oy
    dist = isqrt(dx * dx + dy * dy)
    cep = cep_efectivo(m, atacante, arma, dist, nivel_origen, m.mapa.nivel_en(x, y), ignora_altura,
                       observado(m, atacante.dueno, x, y))
    ex, ey = desvio(m.azar, cep)
    wx, wy = deriva(m, dist)
    tx = min(max(0, x + ex + wx), m.mapa.ancho_sub - 1)
    ty = min(max(0, y + ey + wy), m.mapa.alto_sub - 1)
    return tx, ty
