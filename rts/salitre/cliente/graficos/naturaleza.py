"""Yacimientos de salitre (caliche), pozos de agua, tamarugos y minas."""

import random

import pygame

from .sprites import Pintor, claro, oscuro


def salitre(fase=0, semilla=0):
    """Montón de caliche: costra blanca con cristales. fase 0..3 = cuánto queda."""
    rnd = random.Random(semilla)
    w, h = 68, 46
    p = Pintor(w, h)
    p.elipse(2, 22, 64, 22, (40, 30, 20, 70))
    escala = (1.0, 0.82, 0.62, 0.42)[fase]
    cx, cy = 34, 30
    base = (196, 182, 160)
    for k in range(9):
        ox = rnd.uniform(-20, 20) * escala
        oy = rnd.uniform(-6, 4) * escala
        r = rnd.uniform(6, 11) * escala
        p.elipse(cx + ox - r, cy + oy - r * 0.7, r * 2, r * 1.4, base)
    for k in range(14):
        ox = rnd.uniform(-22, 22) * escala
        oy = rnd.uniform(-12, 2) * escala
        alto = rnd.uniform(5, 11) * escala
        ancho = rnd.uniform(2.4, 4.2)
        x0, y0 = cx + ox, cy + oy
        c = claro((236, 236, 240), rnd.uniform(0, 0.6))
        p.poli([(x0 - ancho / 2, y0), (x0, y0 - alto), (x0 + ancho / 2, y0)], c)
        p.linea(x0, y0 - alto, x0 + ancho / 2, y0, (180, 186, 200), 0.5)
    return p.resultado()


def pozo():
    w, h = 104, 100
    p = Pintor(w, h)
    p.elipse(4, 18, 96, 76, (110, 90, 66))
    p.elipse(12, 24, 80, 62, (60, 118, 170))
    p.elipse(22, 32, 60, 44, (76, 140, 196))
    for k in range(12):
        import math
        a = k * math.pi / 6
        x = 52 + math.cos(a) * 44
        y = 55 + math.sin(a) * 35
        p.elipse(x - 6, y - 4, 12, 8, (150, 140, 126))
        p.elipse(x - 5, y - 4, 9, 5, (176, 166, 150))
    p.linea(36, 44, 54, 40, (220, 236, 250), 1)
    p.linea(48, 64, 70, 60, (200, 226, 246), 1)
    # brocal con roldana
    p.linea(52, 52, 52, 10, (100, 76, 52), 1.6)
    p.linea(40, 14, 64, 14, (100, 76, 52), 1.6)
    p.circ(52, 14, 3, (70, 56, 40))
    return p.resultado()


def tamarugo(variante=0):
    rnd = random.Random(variante + 11)
    w, h = 56, 64
    p = Pintor(w, h)
    p.elipse(8, 50, 42, 12, (30, 24, 16, 80))
    p.linea(28, 58, 27, 34, (96, 70, 46), 3.2)
    p.linea(27, 42, 18, 30, (96, 70, 46), 1.6)
    p.linea(27, 40, 37, 28, (96, 70, 46), 1.6)
    verde = (98, 120, 64)
    for k in range(16):
        x = 28 + rnd.uniform(-17, 17)
        y = 24 + rnd.uniform(-14, 8)
        r = rnd.uniform(6, 11)
        p.circ(x, y, r, oscuro(verde, rnd.uniform(0.75, 1.0)))
    for k in range(10):
        x = 26 + rnd.uniform(-14, 12)
        y = 18 + rnd.uniform(-12, 4)
        p.circ(x, y, rnd.uniform(3, 6), claro(verde, 0.18))
    return p.resultado()


def mina(color):
    p = Pintor(16, 12)
    p.elipse(1, 2, 14, 9, (60, 56, 50))
    p.elipse(3, 3, 10, 6, (90, 84, 76))
    p.circ(8, 6, 1.8, color)
    return p.resultado()


def sombra(w=28, h=10):
    s = pygame.Surface((w, h), pygame.SRCALPHA)
    pygame.draw.ellipse(s, (0, 0, 0, 90), (0, 0, w, h))
    return s


def anillo(w=40, h=20, grosor=2):
    s = pygame.Surface((w * 2, h * 2), pygame.SRCALPHA)
    pygame.draw.ellipse(s, (255, 255, 255, 255), (0, 0, w * 2, h * 2), grosor * 2)
    return pygame.transform.smoothscale(s, (w, h))


def bandera_reunion():
    p = Pintor(14, 22)
    p.linea(2, 21, 2, 2, (70, 54, 40), 1.2)
    p.poli([(2, 2), (13, 5.5), (2, 9)], (240, 220, 80))
    return p.resultado()
