"""Espera el inicio de la partida (el servidor envía el mapa y los jugadores)."""

import pygame

from .. import fuentes
from ..graficos import paleta as P
from ..ui.widgets import Boton
from .base import Escena, FondoMenu


class Cargando(Escena):
    def __init__(self, app, origen, info=None):
        super().__init__(app)
        self.origen = origen
        self.info = info or {}
        self.fondo = FondoMenu(self.lz)
        lz = self.lz
        self.widgets.append(Boton((lz.W // 2 - 90, lz.H // 2 + 60, 180, 40), "Cancelar", self.cancelar, "madera"))

    def cancelar(self):
        from .portada import Portada
        self.app.cambiar(Portada(self.app))

    def actualizar(self, dt):
        super().actualizar(dt)
        for m in self.mensajes_red():
            t = m.get("t")
            if t == "inicio":
                from .juego import Juego
                self.app.cambiar(Juego(self.app, m, self.origen, self.info))
                return
            if t == "error":
                self.app.avisar(m.get("msg", "Error"))
                self.cancelar()
                return

    def manejar(self, ev):
        if ev.type == pygame.KEYDOWN and ev.key == pygame.K_ESCAPE:
            self.cancelar()
            return True
        return super().manejar(ev)

    def dibujar(self):
        lz = self.lz
        self.fondo.dibujar(self.t)
        r = pygame.Rect(lz.W // 2 - 220, lz.H // 2 - 40, 440, 160)
        self.ui.estilo.panel(r)
        puntos = "." * (int(self.t * 3) % 4)
        lz.texto("Formando las tropas" + puntos, lz.W // 2, r.y + 30, fuentes.titulo(28), P.TINTA, "centro")
        self.dibujar_widgets()
