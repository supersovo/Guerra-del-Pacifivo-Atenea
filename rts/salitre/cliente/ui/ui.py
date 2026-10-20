"""Contexto de interfaz que comparten las escenas: lienzo, estilo, ratón,
ventanas emergentes (tooltips) y dibujos diferidos (menús desplegados)."""

import pygame

from .. import fuentes
from ..graficos import paleta as P
from .estilo import Estilo

_actual = None


def ui_actual():
    return _actual


def olvidar():
    """Suelta el contexto global (al cerrar el juego, para liberar sus texturas a tiempo)."""
    global _actual
    _actual = None


class UI:
    def __init__(self, lz):
        global _actual
        self.lz = lz
        self.estilo = Estilo(lz)
        self.raton = (0, 0)
        self.diferido = []
        self.tooltip = None
        _actual = self

    def comenzar(self):
        self.raton = self.lz.raton()
        self.diferido = []
        self.tooltip = None

    def terminar(self):
        for f in self.diferido:
            f(self)
        if self.tooltip:
            self._dibujar_tooltip(*self.tooltip)

    def poner_tooltip(self, titulo, texto="", extra=None):
        self.tooltip = (titulo, texto, extra)

    def _dibujar_tooltip(self, titulo, texto, extra):
        lz = self.lz
        ft = fuentes.negrita(17)
        fc = fuentes.cuerpo(15)
        from ..lienzo import envolver
        ancho = 330
        lineas = envolver(texto, fc, ancho - 16) if texto else []
        alto = 12 + ft.get_linesize() + len(lineas) * fc.get_linesize() + (22 if extra else 0)
        x, y = self.raton
        x = min(x + 16, lz.W - ancho - 4)
        y = y - alto - 8 if y - alto - 8 > 0 else y + 20
        r = pygame.Rect(x, y, ancho, alto)
        lz.rect(r.inflate(4, 4), (20, 12, 6), 230)
        lz.rect(r, (52, 36, 24), 245)
        lz.marco(r, P.BRONCE, 1)
        lz.texto(titulo, x + 8, y + 5, ft, P.BRONCE_CLARO)
        yy = y + 6 + ft.get_linesize()
        for ln in lineas:
            lz.texto(ln, x + 8, yy, fc, P.CREMA)
            yy += fc.get_linesize()
        if extra:
            for i, (txt, col) in enumerate(extra):
                lz.texto(txt, x + 8 + i * 105, yy + 2, fc, col)
