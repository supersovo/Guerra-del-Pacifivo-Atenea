"""Imagen reducida de un mapa (vista previa y minimapa del juego)."""

import pygame

from ...sim.mapa import TERRENOS
from .paleta import TERRENO

COLOR_CHAR = {ch: TERRENO[v[0]] for ch, v in TERRENOS.items()}


def superficie_mapa(datos, escala=2, recursos=True, inicios=True):
    w, h = datos.ancho, datos.alto
    sup = pygame.Surface((w * escala, h * escala))
    for y in range(h):
        fila_t = datos.terreno[y]
        fila_a = datos.altura[y]
        for x in range(w):
            ch = fila_t[x]
            r, g, b = COLOR_CHAR.get(ch, (255, 0, 255))
            nv = ord(fila_a[x]) - 48
            if ch == "T":
                r, g, b = (96, 120, 70)
            f = 1.0 + 0.10 * nv
            col = (min(255, int(r * f)), min(255, int(g * f)), min(255, int(b * f)))
            if y + 1 < h and fila_a[x] > datos.altura[y + 1][x] and datos.terreno[y + 1][x] != "/":
                col = (int(col[0] * 0.55), int(col[1] * 0.55), int(col[2] * 0.55))
            sup.fill(col, (x * escala, y * escala, escala, escala))
    if recursos:
        for rc in datos.recursos:
            if rc["tipo"] == "salitre":
                sup.fill((250, 250, 250), (rc["x"] * escala, rc["y"] * escala, 2 * escala, max(1, escala)))
            else:
                sup.fill((60, 150, 230), (rc["x"] * escala, rc["y"] * escala, 3 * escala, 3 * escala))
    if inicios:
        for i, (x, y) in enumerate(datos.inicios):
            r = pygame.Rect(x * escala, y * escala, 4 * escala, 3 * escala)
            pygame.draw.rect(sup, (150, 32, 28), r)
            pygame.draw.rect(sup, (250, 240, 214), r, 1)
    return sup
