"""Colores del juego."""

COLORES_JUGADOR = [
    ("Rojo", (204, 44, 40)),
    ("Azul", (44, 86, 206)),
    ("Verde", (46, 150, 66)),
    ("Amarillo", (226, 194, 40)),
    ("Celeste", (96, 184, 232)),
    ("Naranja", (232, 124, 32)),
    ("Morado", (142, 64, 172)),
    ("Blanco", (236, 236, 232)),
]


def color_jugador(i):
    return COLORES_JUGADOR[i % len(COLORES_JUGADOR)][1]


def nombre_color(i):
    return COLORES_JUGADOR[i % len(COLORES_JUGADOR)][0]


# Interfaz: carta militar, pergamino, madera y bronce
TINTA = (42, 30, 20)
TINTA_SUAVE = (96, 76, 56)
PERGAMINO = (232, 219, 186)
PERGAMINO_OSCURO = (206, 188, 148)
MADERA = (58, 38, 26)
MADERA_CLARA = (92, 62, 40)
BRONCE = (188, 146, 74)
BRONCE_CLARO = (230, 196, 120)
CREMA = (244, 236, 214)
ROJO_SELLO = (150, 32, 28)
VERDE_OK = (60, 140, 60)
GRIS = (130, 124, 112)
NEGRO = (0, 0, 0)
BLANCO = (255, 255, 255)

SALITRE = (238, 236, 228)
AGUA = (70, 150, 220)

# Terreno (código de la simulación -> color base)
TERRENO = {
    0: (214, 186, 140),   # arena
    1: (194, 164, 118),   # pampa
    2: (236, 232, 220),   # salar
    3: (132, 108, 84),    # camino / vía
    4: (186, 160, 120),   # rampa
    5: (126, 100, 80),    # roca
    6: (180, 156, 112),   # tamarugo (bajo los árboles)
    7: (92, 68, 54),      # quebrada
    8: (44, 92, 140),     # mar
    9: (160, 136, 108),   # ruinas
}
AMBIENTES = {
    "desierto": {"cielo": (240, 220, 180), "tinte": (255, 255, 255)},
    "costa": {"cielo": (220, 220, 210), "tinte": (246, 246, 250)},
}
