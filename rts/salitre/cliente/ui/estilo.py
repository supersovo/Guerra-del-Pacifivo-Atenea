"""Estilo de la interfaz: pergamino, madera tallada y remaches de bronce.

Las texturas se generan por código al iniciar (no hay imágenes externas) y se
estiran en la GPU al tamaño de cada panel.
"""

import math
import random

import pygame

from ..graficos import paleta as P


def _ruido(sup, base, var, semilla, grano=1):
    rnd = random.Random(semilla)
    w, h = sup.get_size()
    sup.fill(base)
    for y in range(0, h, grano):
        for x in range(0, w, grano):
            d = rnd.randint(-var, var)
            c = (max(0, min(255, base[0] + d)), max(0, min(255, base[1] + d)), max(0, min(255, base[2] + d - 2)))
            sup.fill(c, (x, y, grano, grano))


def superficie_pergamino(w=256, h=256, semilla=3):
    sup = pygame.Surface((w, h))
    _ruido(sup, P.PERGAMINO, 7, semilla, 2)
    rnd = random.Random(semilla + 1)
    # manchas suaves y fibras
    capa = pygame.Surface((w, h), pygame.SRCALPHA)
    for _ in range(40):
        x, y = rnd.randint(0, w), rnd.randint(0, h)
        r = rnd.randint(6, 30)
        pygame.draw.circle(capa, (150, 120, 70, rnd.randint(6, 16)), (x, y), r)
    for _ in range(120):
        x, y = rnd.randint(0, w), rnd.randint(0, h)
        pygame.draw.line(capa, (120, 96, 60, 18), (x, y), (x + rnd.randint(-8, 8), y + rnd.randint(-2, 2)))
    sup.blit(capa, (0, 0))
    # bordes tostados (viñeta)
    vin = pygame.Surface((w, h), pygame.SRCALPHA)
    for k in range(24):
        a = int(70 * (1 - k / 24) ** 2)
        pygame.draw.rect(vin, (110, 76, 36, a), (k, k, w - 2 * k, h - 2 * k), 1)
    sup.blit(vin, (0, 0))
    return sup


def superficie_madera(w=256, h=128, semilla=7):
    sup = pygame.Surface((w, h))
    _ruido(sup, P.MADERA, 5, semilla, 2)
    rnd = random.Random(semilla)
    for _ in range(60):
        y = rnd.randint(0, h)
        c = rnd.choice([(44, 28, 18), (72, 48, 32), (66, 42, 28)])
        fase = rnd.random() * 6
        paso = rnd.randint(9, 30)
        pts = [(x, y + int(3 * math.sin(x / paso + fase))) for x in range(0, w + 8, 8)]
        pygame.draw.lines(sup, c, False, pts, 1)
    return sup


class Estilo:
    def __init__(self, lz):
        self.lz = lz
        self.t_perg = lz.textura(("ui", "pergamino"), superficie_pergamino)
        self.t_madera = lz.textura(("ui", "madera"), superficie_madera)

    def panel(self, rect, tipo="pergamino", borde=True):
        r = pygame.Rect(rect)
        lz = self.lz
        if tipo == "madera":
            lz.dibujar(self.t_madera, r.x, r.y, r.w, r.h)
            if borde:
                lz.marco(r, (24, 14, 8), 2)
                lz.marco(r.inflate(-4, -4), P.BRONCE, 1, 160)
            return
        if borde:
            lz.rect(r, (28, 18, 10))
            lz.dibujar(self.t_madera, r.x + 1, r.y + 1, r.w - 2, r.h - 2)
            inner = r.inflate(-10, -10)
        else:
            inner = r
        lz.dibujar(self.t_perg, inner.x, inner.y, inner.w, inner.h)
        if borde:
            lz.marco(inner, (90, 62, 32), 1)
            self.remaches(r)

    def remaches(self, r):
        lz = self.lz
        for x, y in ((r.x + 4, r.y + 4), (r.right - 6, r.y + 4), (r.x + 4, r.bottom - 6), (r.right - 6, r.bottom - 6)):
            lz.rect((x, y, 3, 3), P.BRONCE_CLARO)

    def boton(self, rect, texto, estado="normal", fuente=None, tipo="normal", icono=None):
        """estado: normal | encima | pulsado | inactivo"""
        from .. import fuentes
        lz = self.lz
        r = pygame.Rect(rect)
        if tipo == "principal":
            base = (126, 36, 30)
            claro = (168, 56, 44)
            texto_col = P.CREMA
        elif tipo == "madera":
            base = (78, 52, 34)
            claro = (110, 76, 50)
            texto_col = P.CREMA
        else:
            base = P.PERGAMINO_OSCURO
            claro = P.PERGAMINO
            texto_col = P.TINTA
        if estado == "encima":
            base = tuple(min(255, c + 18) for c in base)
            claro = tuple(min(255, c + 18) for c in claro)
        elif estado == "pulsado":
            base = tuple(max(0, c - 22) for c in base)
            claro = base
        elif estado == "inactivo":
            base = tuple((c + 140) // 2 for c in base)
            claro = base
            texto_col = (120, 110, 96)
        lz.rect(r, (28, 18, 10))
        lz.rect(r.inflate(-2, -2), base)
        lz.rect((r.x + 2, r.y + 2, r.w - 4, max(2, r.h // 2 - 2)), claro, 110)
        lz.marco(r.inflate(-2, -2), P.BRONCE if estado != "inactivo" else P.GRIS, 1, 200)
        f = fuente or fuentes.negrita(16)
        if icono is not None:
            lz.dibujar(icono, r.x + 6, r.centery - icono.height // 2)
            lz.texto(texto, r.x + 12 + icono.width, r.centery - f.get_height() // 2, f, texto_col)
        else:
            lz.texto(texto, r.centerx, r.centery - f.get_height() // 2, f, texto_col, ancla="centro")
