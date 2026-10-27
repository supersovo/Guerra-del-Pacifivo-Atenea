"""Banderas de las naciones (dibujadas por código).

Chile: bandera de 1817 (estrella blanca en cantón azul). Perú: rojo-blanco-rojo
vertical. Bolivia: rojo-amarillo-verde horizontal (desde 1851). Argentina:
celeste-blanco-celeste con el sol de mayo.
"""

import math

import pygame


def superficie_bandera(nacion, w=48, h=32):
    s = pygame.Surface((w, h), pygame.SRCALPHA)
    if nacion == "chile":
        s.fill((214, 40, 40), (0, h // 2, w, h - h // 2))
        s.fill((246, 246, 246), (0, 0, w, h // 2))
        c = h // 2
        s.fill((0, 57, 166), (0, 0, c, c))
        _estrella(s, c // 2, c // 2, c * 0.36, (255, 255, 255))
    elif nacion == "peru":
        t = w // 3
        s.fill((217, 16, 35), (0, 0, t, h))
        s.fill((246, 246, 246), (t, 0, w - 2 * t, h))
        s.fill((217, 16, 35), (w - t, 0, t, h))
    elif nacion == "bolivia":
        t = h // 3
        s.fill((213, 43, 30), (0, 0, w, t))
        s.fill((249, 228, 0), (0, t, w, h - 2 * t))
        s.fill((0, 122, 51), (0, h - t, w, t))
    elif nacion == "argentina":
        t = h // 3
        s.fill((116, 172, 223), (0, 0, w, t))
        s.fill((246, 246, 246), (0, t, w, h - 2 * t))
        s.fill((116, 172, 223), (0, h - t, w, t))
        cx, cy, r = w // 2, h // 2, max(2, t // 2)
        for k in range(16):
            a = k * math.pi / 8
            pygame.draw.line(s, (246, 180, 14), (cx, cy), (cx + math.cos(a) * r * 1.7, cy + math.sin(a) * r * 1.7), 1)
        pygame.draw.circle(s, (246, 180, 14), (cx, cy), r)
    else:
        s.fill((200, 200, 200))
    pygame.draw.rect(s, (40, 30, 24), (0, 0, w, h), 1)
    return s


def _estrella(s, cx, cy, r, color):
    pts = []
    for k in range(10):
        a = -math.pi / 2 + k * math.pi / 5
        rr = r if k % 2 == 0 else r * 0.42
        pts.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr))
    pygame.draw.polygon(s, color, pts)
