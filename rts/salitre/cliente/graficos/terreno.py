"""Terreno del campo de batalla, pintado por bloques de 16x16 casillas.

1. Un mapa de colores de una casilla por píxel se amplía con suavizado: así
   arena, pampa y salar se funden sin bordes duros.
2. Encima, grano y detalles por casilla (guijarros, grietas del salar,
   ondas de la arena, rocas, espuma en la costa).
3. Los cambios de nivel sin rampa se dibujan como acantilados (cara de roca
   hacia el sur, borde oscuro en los demás lados).
4. Caminos y vías férreas unen las casillas vecinas.

Cada bloque es una textura de 512x512 en la GPU.
"""

import random

import pygame

from ...sim.mapa import CODIGO_MAR, CODIGO_RAMPA
from .paleta import TERRENO
from .sprites import claro, oscuro

T = 32
BLOQUE = 16

ARENA, PAMPA, SALAR, CAMINO, RAMPA, ROCA, TAMARUGO, QUEBRADA, MAR, RUINAS = range(10)


def _color_casilla(m, i):
    cod = m.terreno[i]
    c = TERRENO.get(cod, (255, 0, 255))
    if cod == TAMARUGO:
        c = TERRENO[PAMPA]
    nv = m.nivel[i]
    if cod not in (MAR,):
        f = 1.0 + 0.13 * nv
        c = (min(255, int(c[0] * f)), min(255, int(c[1] * f)), min(255, int(c[2] * f)))
    return c


class Terreno:
    def __init__(self, lz, mapa, semilla=7):
        self.lz = lz
        self.m = mapa
        self.semilla = semilla
        self.bloques = {}
        self.bw = (mapa.w + BLOQUE - 1) // BLOQUE
        self.bh = (mapa.h + BLOQUE - 1) // BLOQUE
        # mapa de colores completo (1 píxel por casilla) con margen de una casilla
        w, h = mapa.w, mapa.h
        self.colores = pygame.Surface((w + 2, h + 2))
        for y in range(-1, h + 1):
            for x in range(-1, w + 1):
                xx = min(max(x, 0), w - 1)
                yy = min(max(y, 0), h - 1)
                self.colores.set_at((x + 1, y + 1), _color_casilla(mapa, yy * w + xx))
        self._grano = self._superficie_grano()
        self._detalles = self._superficies_detalle()

    # ------------------------------------------------------------------
    def _superficie_grano(self):
        rnd = random.Random(self.semilla)
        s = pygame.Surface((BLOQUE * T, BLOQUE * T), pygame.SRCALPHA)
        for _ in range(9000):
            x, y = rnd.randrange(BLOQUE * T), rnd.randrange(BLOQUE * T)
            v = rnd.choice((0, 255))
            a = rnd.randint(10, 28)
            s.fill((v, v, v, a), (x, y, rnd.choice((1, 1, 2)), 1))
        return s

    def _superficies_detalle(self):
        rnd = random.Random(self.semilla + 1)
        d = {}
        guij = []
        for _ in range(6):
            s = pygame.Surface((T, T), pygame.SRCALPHA)
            for _ in range(rnd.randint(2, 5)):
                x, y = rnd.randint(2, T - 4), rnd.randint(2, T - 4)
                r = rnd.randint(1, 2)
                pygame.draw.circle(s, (120, 100, 80, 150), (x, y), r)
                pygame.draw.circle(s, (230, 214, 190, 120), (x - 1, y - 1), max(1, r - 1))
            guij.append(s)
        d["guijarros"] = guij
        ondas = []
        for _ in range(4):
            s = pygame.Surface((T, T), pygame.SRCALPHA)
            for k in range(rnd.randint(1, 3)):
                y = rnd.randint(4, T - 4)
                pts = [(x, y + int(2 * (1 if (x // 6) % 2 else -1))) for x in range(0, T + 1, 6)]
                pygame.draw.lines(s, (170, 140, 100, 70), False, pts, 1)
            ondas.append(s)
        d["ondas"] = ondas
        grietas = []
        for _ in range(4):
            s = pygame.Surface((T, T), pygame.SRCALPHA)
            x, y = rnd.randint(0, T), rnd.randint(0, T)
            for _ in range(6):
                nx, ny = x + rnd.randint(-10, 10), y + rnd.randint(-10, 10)
                pygame.draw.line(s, (170, 166, 156, 140), (x, y), (nx, ny), 1)
                x, y = nx, ny
            grietas.append(s)
        d["grietas"] = grietas
        rocas = []
        for k in range(4):
            s = pygame.Surface((T, T + 8), pygame.SRCALPHA)
            base = (122 + k * 4, 98 + k * 3, 78)
            pts = [(2, T + 4), (4 + rnd.randint(0, 4), 8 + rnd.randint(0, 6)), (T // 2 + rnd.randint(-4, 4), 2),
                   (T - 4 - rnd.randint(0, 4), 7 + rnd.randint(0, 6)), (T - 2, T + 4)]
            pygame.draw.polygon(s, oscuro(base, 0.8), pts)
            pygame.draw.polygon(s, base, [(p[0], p[1]) for p in pts[:3]] + [(T // 2, T)])
            pygame.draw.line(s, claro(base, 0.25), pts[1], pts[2], 2)
            for _ in range(5):
                x, y = rnd.randint(6, T - 6), rnd.randint(10, T)
                pygame.draw.line(s, oscuro(base, 0.65), (x, y), (x + rnd.randint(-4, 4), y + rnd.randint(2, 5)), 1)
            rocas.append(s)
        d["rocas"] = rocas
        return d

    # ------------------------------------------------------------------
    def bloque(self, bx, by):
        t = self.bloques.get((bx, by))
        if t is None:
            sup = self._pintar_bloque(bx, by)
            t = self.lz.textura_de(sup)
            t.blend_mode = 0   # el suelo es opaco: copiarlo sin mezclar es más rápido sin GPU
            self.bloques[(bx, by)] = t
        return t

    def _pintar_bloque(self, bx, by):
        m = self.m
        w = m.w
        x0, y0 = bx * BLOQUE, by * BLOQUE
        # 1. colores fundidos
        # smoothscale lleva el píxel X de la salida al punto X*(n-1)/salida de la entrada: con
        # salida = (n-1)*T cada casilla mide exactamente T y los bloques vecinos empalman sin costura
        recorte = pygame.Surface((BLOQUE + 2, BLOQUE + 2))
        recorte.blit(self.colores, (0, 0), (x0, y0, BLOQUE + 2, BLOQUE + 2))
        grande = pygame.transform.smoothscale(recorte, ((BLOQUE + 1) * T, (BLOQUE + 1) * T))
        sup = pygame.Surface((BLOQUE * T, BLOQUE * T))
        sup.blit(grande, (0, 0), (T // 2, T // 2, BLOQUE * T, BLOQUE * T))
        sup.blit(self._grano, (0, 0))
        d = self._detalles
        rocas = []
        for ty in range(y0, min(y0 + BLOQUE, m.h)):
            for tx in range(x0, min(x0 + BLOQUE, m.w)):
                i = ty * w + tx
                cod = m.terreno[i]
                px, py = (tx - x0) * T, (ty - y0) * T
                h = (tx * 73856093 ^ ty * 19349663 ^ self.semilla) & 0xFFFF
                if cod == PAMPA or cod == TAMARUGO:
                    if h % 3 == 0:
                        sup.blit(d["guijarros"][h % 6], (px, py))
                elif cod == ARENA:
                    if h % 4 == 0:
                        sup.blit(d["ondas"][h % 4], (px, py))
                    elif h % 7 == 0:
                        sup.blit(d["guijarros"][h % 6], (px, py))
                elif cod == SALAR:
                    sup.blit(d["grietas"][h % 4], (px, py))
                elif cod == MAR:
                    self._agua(sup, m, tx, ty, px, py, h)
                elif cod == QUEBRADA:
                    self._quebrada(sup, m, tx, ty, px, py)
                elif cod == RAMPA:
                    for k in range(3):
                        pygame.draw.line(sup, oscuro(TERRENO[RAMPA], 0.88), (px + 2, py + 8 + k * 9),
                                         (px + T - 2, py + 8 + k * 9), 1)
                elif cod == ROCA:
                    rocas.append((px, py, h))
                elif cod == RUINAS:
                    pygame.draw.rect(sup, (170, 140, 104), (px + 4, py + 6, 22, 5))
                    pygame.draw.rect(sup, (150, 120, 90), (px + 4, py + 11, 5, 14))
                    pygame.draw.rect(sup, (120, 96, 72), (px + 4, py + 6, 22, 5), 1)
        self._acantilados(sup, x0, y0)
        self._caminos(sup, x0, y0)
        for px, py, h in rocas:
            sup.blit(d["rocas"][h % 4], (px, py - 8))
        return sup

    def _agua(self, sup, m, tx, ty, px, py, h):
        w = m.w
        base = (44 + (h % 9), 92 + (h % 7), 140 + (h % 11))
        sup.fill(base, (px, py, T, T))
        rnd = random.Random(h)
        for _ in range(3):
            x, y = rnd.randint(0, T - 8), rnd.randint(2, T - 2)
            pygame.draw.line(sup, (80, 132, 176), (px + x, py + y), (px + x + rnd.randint(4, 9), py + y), 1)
        for dx, dy, borde in ((0, -1, "n"), (0, 1, "s"), (-1, 0, "o"), (1, 0, "e")):
            xx, yy = tx + dx, ty + dy
            if 0 <= xx < m.w and 0 <= yy < m.h and m.terreno[yy * w + xx] != CODIGO_MAR:
                if borde == "n":
                    pygame.draw.rect(sup, (214, 198, 160), (px, py, T, 4))
                    pygame.draw.line(sup, (236, 244, 248), (px, py + 4), (px + T, py + 4), 2)
                elif borde == "s":
                    pygame.draw.line(sup, (236, 244, 248), (px, py + T - 3), (px + T, py + T - 3), 2)
                elif borde == "o":
                    pygame.draw.line(sup, (236, 244, 248), (px + 2, py), (px + 2, py + T), 2)
                else:
                    pygame.draw.line(sup, (236, 244, 248), (px + T - 3, py), (px + T - 3, py + T), 2)

    def _quebrada(self, sup, m, tx, ty, px, py):
        w = m.w
        sup.fill((78, 56, 44), (px, py, T, T))
        for dx, dy in ((0, -1), (0, 1), (-1, 0), (1, 0)):
            xx, yy = tx + dx, ty + dy
            if 0 <= xx < m.w and 0 <= yy < m.h and m.terreno[yy * w + xx] != 7:
                if dy == -1:
                    pygame.draw.rect(sup, (130, 98, 74), (px, py, T, 7))
                    pygame.draw.line(sup, (56, 40, 32), (px, py + 7), (px + T, py + 7), 2)
                elif dy == 1:
                    pygame.draw.line(sup, (150, 120, 90), (px, py + T - 2), (px + T, py + T - 2), 2)
                elif dx == -1:
                    pygame.draw.rect(sup, (110, 82, 62), (px, py, 4, T))
                else:
                    pygame.draw.rect(sup, (110, 82, 62), (px + T - 4, py, 4, T))

    def _acantilados(self, sup, x0, y0):
        m = self.m
        w = m.w
        nv = m.nivel
        rampa = m.rampa
        for ty in range(max(0, y0 - 1), min(y0 + BLOQUE + 1, m.h)):
            for tx in range(max(0, x0 - 1), min(x0 + BLOQUE + 1, m.w)):
                i = ty * w + tx
                if rampa[i]:
                    continue
                px, py = (tx - x0) * T, (ty - y0) * T
                # cara de roca hacia el sur (la que se ve)
                if ty + 1 < m.h:
                    j = i + w
                    if nv[j] < nv[i] and not rampa[j]:
                        alto = 12 + 6 * (nv[i] - nv[j])
                        sombra = pygame.Surface((T, 10), pygame.SRCALPHA)
                        sombra.fill((40, 26, 16, 60))
                        sup.blit(sombra, (px, py + T + alto))
                        cara = pygame.Rect(px, py + T, T, alto)
                        sup.fill((112, 84, 62), cara)
                        for k in range(0, T, 5):
                            pygame.draw.line(sup, (88, 64, 48), (px + k, py + T), (px + k + 2, py + T + alto), 1)
                        pygame.draw.line(sup, (222, 196, 150), (px, py + T), (px + T, py + T), 2)
                        pygame.draw.line(sup, (70, 50, 38), (px, py + T + alto), (px + T, py + T + alto), 1)
                # borde hacia el norte, este y oeste
                for dx, dy in ((0, -1), (1, 0), (-1, 0)):
                    xx, yy = tx + dx, ty + dy
                    if not (0 <= xx < m.w and 0 <= yy < m.h):
                        continue
                    j = yy * w + xx
                    if nv[j] < nv[i] and not rampa[j]:
                        if dy == -1:
                            pygame.draw.line(sup, (70, 50, 38), (px, py), (px + T, py), 3)
                            pygame.draw.line(sup, (230, 206, 160), (px, py + 3), (px + T, py + 3), 1)
                        elif dx == 1:
                            pygame.draw.rect(sup, (100, 76, 58), (px + T - 3, py, 4, T))
                        else:
                            pygame.draw.rect(sup, (130, 100, 76), (px - 1, py, 4, T))

    def _caminos(self, sup, x0, y0):
        m = self.m
        w = m.w
        for ty in range(max(0, y0 - 1), min(y0 + BLOQUE + 1, m.h)):
            for tx in range(max(0, x0 - 1), min(x0 + BLOQUE + 1, m.w)):
                if m.terreno[ty * w + tx] != CAMINO:
                    continue
                cx, cy = (tx - x0) * T + T // 2, (ty - y0) * T + T // 2
                for dx, dy in ((1, 0), (0, 1), (1, 1), (1, -1)):
                    xx, yy = tx + dx, ty + dy
                    if 0 <= xx < m.w and 0 <= yy < m.h and m.terreno[yy * w + xx] == CAMINO:
                        nx, ny = cx + dx * T, cy + dy * T
                        pygame.draw.line(sup, (150, 124, 96), (cx, cy), (nx, ny), 12)
                for dx, dy in ((1, 0), (0, 1), (1, 1), (1, -1)):
                    xx, yy = tx + dx, ty + dy
                    if 0 <= xx < m.w and 0 <= yy < m.h and m.terreno[yy * w + xx] == CAMINO:
                        nx, ny = cx + dx * T, cy + dy * T
                        # durmientes y rieles de la vía salitrera
                        largo = max(1, int(((nx - cx) ** 2 + (ny - cy) ** 2) ** 0.5))
                        ux, uy = (nx - cx) / largo, (ny - cy) / largo
                        for k in range(0, largo, 6):
                            sx, sy = cx + ux * k, cy + uy * k
                            pygame.draw.line(sup, (96, 70, 48), (sx - uy * 6, sy + ux * 6), (sx + uy * 6, sy - ux * 6), 2)
                        for off in (-3, 3):
                            pygame.draw.line(sup, (70, 70, 74), (cx - uy * off, cy + ux * off), (nx - uy * off, ny + ux * off), 1)

    def es_mar(self, i):
        return self.m.terreno[i] == CODIGO_MAR

    def dibujar(self, lz, camx, camy, zoom, vista):
        """Dibuja los bloques visibles. camx, camy: esquina superior izquierda en píxeles del mapa."""
        tam = BLOQUE * T
        bx0 = max(0, int(camx // tam))
        by0 = max(0, int(camy // tam))
        bx1 = min(self.bw - 1, int((camx + vista.w / zoom) // tam))
        by1 = min(self.bh - 1, int((camy + vista.h / zoom) // tam))
        lado = tam * zoom
        for by in range(by0, by1 + 1):
            for bx in range(bx0, bx1 + 1):
                t = self.bloque(bx, by)
                x = vista.x + (bx * tam - camx) * zoom
                y = vista.y + (by * tam - camy) * zoom
                lz.dibujar(t, int(x), int(y), int(lado + 1), int(lado + 1))


def es_rampa(m, i):
    return m.terreno[i] == CODIGO_RAMPA
