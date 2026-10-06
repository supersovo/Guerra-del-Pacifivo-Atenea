"""Portada y menú principal."""

import pygame

from .. import fuentes
from ..graficos import paleta as P
from ..ui.widgets import Boton
from .base import Escena, FondoMenu


class Portada(Escena):
    def __init__(self, app):
        super().__init__(app)
        self.fondo = FondoMenu(self.lz)
        lz = self.lz
        ancho = 360
        x = (lz.W - ancho) // 2
        y = 170
        self.panel = pygame.Rect(x - 30, y - 24, ancho + 60, 6 * 54 + 40)
        opciones = [
            ("Escaramuza contra la IA", self.escaramuza, "principal",
             "Batalla en un mapa histórico contra uno o más ejércitos de la computadora."),
            ("Multijugador en línea", self.multijugador, "principal",
             "Juegue con sus compañeros: en la red local, por Internet o creando un servidor en su equipo."),
            ("Repeticiones", self.repeticiones, "normal",
             "Vuelva a ver sus batallas con todo el mapa a la vista."),
            ("Archivo histórico", self.archivo, "normal",
             "Naciones, héroes, unidades y batallas de la Guerra del Pacífico."),
            ("Opciones", self.opciones, "normal", "Pantalla, sonido y controles."),
            ("Salir", app.salir, "madera", None),
        ]
        for i, (texto, accion, tipo, ayuda) in enumerate(opciones):
            b = Boton((x, y + i * 54, ancho, 44), texto, accion, tipo, tooltip=(texto, ayuda) if ayuda else None,
                      fuente=fuentes.negrita(19))
            self.widgets.append(b)

    def entrar(self):
        self.app.cerrar_red()
        self.app.detener_servidor_local()

    def escaramuza(self):
        from .escaramuza import Escaramuza
        self.app.cambiar(Escaramuza(self.app))

    def multijugador(self):
        from .conectar import Conectar
        self.app.cambiar(Conectar(self.app))

    def repeticiones(self):
        from .repeticiones import Repeticiones
        self.app.cambiar(Repeticiones(self.app))

    def archivo(self):
        from .archivo import Archivo
        self.app.cambiar(Archivo(self.app))

    def opciones(self):
        from .opciones import Opciones
        self.app.cambiar(Opciones(self.app))

    def manejar(self, ev):
        if ev.type == pygame.KEYDOWN and ev.key == pygame.K_ESCAPE:
            self.app.salir()
            return True
        return super().manejar(ev)

    def dibujar(self):
        self.fondo.dibujar(self.t)
        lz = self.lz
        self.ui.estilo.panel(self.panel, "madera")
        self.dibujar_widgets()
        r = self.app.perfil.resumen()
        if r["jugadas"]:
            txt = f"Escaramuzas en este equipo: {r['jugadas']}  ·  victorias {r['victorias']}  ·  derrotas {r['derrotas']}"
            lz.texto(txt, lz.W // 2, self.panel.bottom + 10, fuentes.cuerpo(16), P.CREMA, "centro", sombra=(0, 0, 0))
        lz.texto("Homenaje a los combatientes de Chile, Perú y Bolivia (1879-1884)", 10, lz.H - 22,
                 fuentes.cursiva(14), (250, 240, 220), sombra=(0, 0, 0))
