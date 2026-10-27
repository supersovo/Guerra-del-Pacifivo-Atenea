"""Tren y carreta que traen el cuartel general al comenzar la partida.

Se dibujan vistos desde arriba, con la marcha hacia la derecha (como los
buques), y la GPU los gira según el tramo de vía o de camino que recorren.
"""

from .sprites import Pintor, claro, oscuro

HIERRO = (40, 40, 44)
LATON = (196, 160, 80)
MADERA = (120, 86, 54)
LONA = (226, 218, 196)


def locomotora(color_jugador):
    """Locomotora a vapor: caldera, chimenea, cabina y quitapiedras (48 x 22, frente a la derecha)."""
    p = Pintor(48, 22)
    p.rect(2, 4, 44, 14, (30, 30, 32), 2)                        # bastidor
    p.rect(4, 6, 28, 10, HIERRO, 3)                               # caldera
    for k in range(3):
        p.rect(8 + k * 8, 6, 1.4, 10, LATON)                      # zunchos de latón
    p.circ(30, 11, 3.6, (24, 24, 26))                             # chimenea vista desde arriba
    p.circ(30, 11, 2.0, (70, 64, 60))
    p.circ(20, 11, 1.8, LATON)                                    # domo
    p.rect(34, 4, 10, 14, (120, 40, 34), 1)                       # cabina
    p.rect(35, 5, 8, 12, (150, 54, 44), 1)
    p.poli([(2, 4), (-1, 11), (2, 18)], (90, 90, 96))             # quitapiedras
    p.rect(39, 9, 4, 4, color_jugador)                            # distintivo del jugador
    return p.resultado()


def vagon(color_jugador, carga):
    """Plataforma con la carga del cuartel general (38 x 20): cajones, lonas o la bandera."""
    p = Pintor(38, 20)
    p.rect(1, 2, 36, 16, (66, 50, 36), 1)
    p.rect(2, 3, 34, 14, MADERA)
    for k in range(5):
        p.linea(2 + k * 8, 3, 2 + k * 8, 17, oscuro(MADERA, 0.8), 0.6)
    if carga == 0:
        for (x, y) in ((5, 5), (15, 5), (5, 11), (24, 8)):
            p.rect(x, y, 8, 5, (176, 132, 82), 1)
            p.linea(x, y, x + 8, y + 5, oscuro((176, 132, 82), 0.75), 0.5)
    elif carga == 1:
        p.rect(4, 4, 30, 12, LONA, 3)
        p.linea(4, 10, 34, 10, oscuro(LONA, 0.82), 0.7)
        p.rect(16, 4, 2, 12, (90, 70, 50))
    else:
        for k in range(4):
            p.rect(4, 4 + k * 3, 30, 2.2, claro(MADERA, 0.15 * (k % 2)))
        p.rect(14, 6, 10, 8, color_jugador, 1)
    return p.resultado()


def carreta(color_jugador, paso=0):
    """Carreta toldada tirada por dos mulas (60 x 26, marcha hacia la derecha)."""
    p = Pintor(60, 26)
    for k, y in enumerate((6, 15)):
        dx = (paso if k else -paso) * 1.5
        p.elipse(36 + dx, y, 16, 6, (110, 84, 60))               # mula
        p.circ(52 + dx, y + 3, 2.6, (96, 72, 50))                # cabeza
        p.linea(52 + dx, y + 1, 55 + dx, y - 0.6, (70, 52, 36), 0.8)
        p.linea(36 + dx, y + 3, 33, 13, (60, 44, 30), 0.6)        # tiro
    p.rect(30, 12, 4, 2, (80, 60, 40))                            # lanza
    p.rect(2, 3, 30, 20, (110, 82, 52), 2)                        # caja
    p.rect(3, 4, 28, 18, LONA, 6)                                 # toldo
    for k in range(4):
        p.linea(7 + k * 7, 4, 7 + k * 7, 22, oscuro(LONA, 0.85), 0.8)
    p.rect(14, 10, 8, 6, color_jugador, 1)
    for x in (6, 24):                                             # ruedas asomando
        p.rect(x, 1, 5, 2.4, HIERRO)
        p.rect(x, 22.6, 5, 2.4, HIERRO)
    return p.resultado()
