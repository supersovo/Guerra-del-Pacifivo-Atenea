"""Constantes de la simulación.

La simulación usa solo enteros para que sea determinista en cualquier equipo:
las posiciones se miden en subunidades (16 por píxel, 512 por casilla), el
tiempo en ticks (16 por segundo), la energía en 1/256 de punto y la vida
fraccional (regeneración, curación) en 1/64 de punto.
"""

TICKS = 16                 # ticks por segundo de juego
SUB = 16                   # subunidades por píxel
TILE_PX = 32               # píxeles por casilla
TILE = TILE_PX * SUB       # subunidades por casilla
MEDIA = TILE // 2
EFP = 256                  # energía interna por punto de energía
HFP = 64                   # vida interna por punto de vida (fracciones)
XPF = 16                   # experiencia interna por punto (un punto = 1 $ de valor de combate)

NEUTRAL = -1

# Clases de entidad
UNIDAD = 1
EDIFICIO = 2
RECURSO = 3
MINA = 4
HERIDO = 5
CONVOY = 6

# Capas de movimiento
TIERRA = 0
AGUA = 1


def ticks(segundos):
    return int(round(segundos * TICKS))


def sub(casillas):
    return int(round(casillas * TILE))


def vel(casillas_por_segundo):
    return int(round(casillas_por_segundo * TILE / TICKS))
