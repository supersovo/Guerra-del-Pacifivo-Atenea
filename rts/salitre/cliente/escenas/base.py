"""Escena base y fondos de los menús."""

import math
import random

import pygame

from ... import NOMBRE_JUEGO, VERSION
from .. import fuentes
from ..graficos import paleta as P


class Escena:
    def __init__(self, app):
        self.app = app
        self.lz = app.lz
        self.ui = app.ui
        self.widgets = []
        self.t = 0.0

    def entrar(self):
        pass

    def salir(self):
        pass

    def manejar(self, ev):
        # un desplegable abierto tiene prioridad: sus opciones tapan a los demás controles
        for w in self.widgets:
            if getattr(w, "abierto", False) and w.manejar(ev):
                return True
        for w in reversed(self.widgets):
            if w.visible and w.manejar(ev):
                return True
        return False

    def actualizar(self, dt):
        self.t += dt
        for w in self.widgets:
            w.actualizar(dt)

    def dibujar(self):
        pass

    def dibujar_widgets(self):
        for w in self.widgets:
            if w.visible:
                w.dibujar(self.ui)
                if w.tooltip and w.encima(self.ui):
                    t = w.tooltip
                    if isinstance(t, tuple):
                        self.ui.poner_tooltip(*t)
                    else:
                        self.ui.poner_tooltip(getattr(w, "texto", ""), t)

    def mensajes_red(self):
        """Mensajes del servidor (las escenas que usan la red los procesan)."""
        red = self.app.red
        if red is None:
            return []
        msgs = red.recibir()
        if red.estado == "error":
            self.app.perdio_conexion(red.error)
        return msgs


def superficie_fondo(w, h, semilla=1879):
    """Panorama del desierto: cielo, cordillera, oficina salitrera y la pampa."""
    rnd = random.Random(semilla)
    sup = pygame.Surface((w, h))
    for y in range(h):
        f = y / h
        if f < 0.62:
            g = (f / 0.62) ** 1.4
            c = (int(104 + 136 * g), int(146 + 74 * g), int(196 - 24 * g))
        else:
            g = (f - 0.62) / 0.38
            c = (int(206 - 40 * g), int(170 - 40 * g), int(118 - 34 * g))
        pygame.draw.line(sup, c, (0, y), (w, y))
    # sol
    sol = pygame.Surface((w, h), pygame.SRCALPHA)
    for r in range(90, 0, -6):
        pygame.draw.circle(sol, (255, 236, 190, int(26 * (1 - r / 90)) + 4), (int(w * 0.76), int(h * 0.3)), r)
    pygame.draw.circle(sol, (255, 244, 214, 230), (int(w * 0.76), int(h * 0.3)), 26)
    sup.blit(sol, (0, 0))
    # cordillera de los Andes (dos planos)
    for plano, (col, altura, rug) in enumerate((((150, 134, 140), 0.40, 60), ((122, 98, 92), 0.50, 40))):
        pts = [(0, h)]
        x = 0
        y = h * altura
        while x <= w + 20:
            y += rnd.uniform(-rug, rug) * 0.5
            y = max(h * (altura - 0.16), min(h * (altura + 0.06), y))
            pts.append((x, y))
            x += rnd.randint(14, 40)
        pts.append((w, h))
        pygame.draw.polygon(sup, col, pts)
        if plano == 0:
            for (px, py) in pts[1:-1]:
                if py < h * 0.32:
                    pygame.draw.polygon(sup, (236, 232, 236), [(px - 10, py + 10), (px, py), (px + 10, py + 10)])
    # pampa con dunas
    for k in range(5):
        y0 = h * (0.6 + k * 0.08)
        col = (int(196 - k * 12), int(164 - k * 12), int(112 - k * 10))
        pts = [(0, h)]
        for x in range(0, w + 40, 30):
            pts.append((x, y0 + 14 * math.sin(x / (90 + k * 30) + k)))
        pts.append((w, h))
        pygame.draw.polygon(sup, col, pts)
    # oficina salitrera: galpones y chimenea
    bx, by = int(w * 0.16), int(h * 0.64)
    pygame.draw.rect(sup, (92, 70, 54), (bx, by - 40, 110, 40))
    pygame.draw.rect(sup, (70, 52, 40), (bx + 120, by - 26, 70, 26))
    pygame.draw.polygon(sup, (60, 44, 34), [(bx - 4, by - 40), (bx + 55, by - 62), (bx + 114, by - 40)])
    pygame.draw.rect(sup, (60, 46, 40), (bx + 80, by - 130, 12, 90))
    humo = pygame.Surface((w, h), pygame.SRCALPHA)
    for k in range(9):
        r = 7 + k * 3
        a = max(10, 90 - k * 9)
        cx = bx + 86 + k * 14 + rnd.randint(-3, 3)
        cy = by - 138 - k * 9 + rnd.randint(-3, 3)
        pygame.draw.circle(humo, (236, 232, 226, a), (cx, cy), r)
        pygame.draw.circle(humo, (250, 248, 244, a // 2), (cx - r // 3, cy - r // 3), r // 2)
    sup.blit(humo, (0, 0))
    # postes del telégrafo
    for k in range(9):
        x = int(w * 0.35 + k * w * 0.075)
        y = int(h * 0.67 + k * 3)
        alto = 70 - k * 4
        pygame.draw.line(sup, (54, 40, 30), (x, y), (x, y - alto), 3)
        pygame.draw.line(sup, (54, 40, 30), (x - 8, y - alto + 6), (x + 8, y - alto + 6), 2)
        if k:
            px = int(w * 0.35 + (k - 1) * w * 0.075)
            py = int(h * 0.67 + (k - 1) * 3) - (70 - (k - 1) * 4) + 6
            pygame.draw.line(sup, (40, 30, 24), (px, py), (x, y - alto + 6), 1)
    # columna en marcha (siluetas)
    for k in range(26):
        x = int(w * 0.40 + k * 13)
        y = int(h * 0.80 + (k % 3))
        pygame.draw.rect(sup, (48, 36, 30), (x, y - 16, 5, 16))
        pygame.draw.circle(sup, (48, 36, 30), (x + 2, y - 19), 3)
        pygame.draw.line(sup, (48, 36, 30), (x + 4, y - 15), (x + 8, y - 26), 1)
    # grano
    for _ in range(w * h // 60):
        x, y = rnd.randrange(w), rnd.randrange(h)
        c = sup.get_at((x, y))
        d = rnd.randint(-10, 10)
        sup.set_at((x, y), (max(0, min(255, c[0] + d)), max(0, min(255, c[1] + d)), max(0, min(255, c[2] + d))))
    return sup


class FondoMenu:
    def __init__(self, lz):
        self.lz = lz
        self.tex = lz.textura(("fondo", lz.W, lz.H), lambda: superficie_fondo(lz.W, lz.H))

    def dibujar(self, t=0.0, titulo=True, velo=0):
        """velo: oscurece el paisaje (pantallas con muchos paneles, para que no distraiga)."""
        lz = self.lz
        lz.dibujar(self.tex, 0, 0, lz.W, lz.H)
        if velo:
            lz.rect((0, 0, lz.W, lz.H), (30, 20, 12), velo)
        if titulo:
            ft = fuentes.titulo(58)
            lz.texto("Guerra del Pacífico", lz.W // 2, 34, ft, (250, 240, 214), "centro", sombra=(40, 20, 10))
            fs = fuentes.titulo(28)
            lz.texto("Salitre y Pólvora  ·  1879-1884", lz.W // 2, 100, fs, (246, 226, 180), "centro",
                     sombra=(40, 20, 10))
        lz.texto(f"{NOMBRE_JUEGO} {VERSION}", lz.W - 10, lz.H - 22, fuentes.cuerpo(14), (250, 240, 220), "der",
                 sombra=(0, 0, 0))


def titulo_panel(lz, texto, rect):
    f = fuentes.titulo(30)
    lz.texto(texto, rect.centerx, rect.y + 14, f, P.TINTA, "centro")
    lz.linea((rect.x + 30, rect.y + 54), (rect.right - 30, rect.y + 54), (120, 90, 60))
