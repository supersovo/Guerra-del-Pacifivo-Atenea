"""Opciones: pantalla, sonido y controles. Se guardan en config.json."""

import pygame

from ... import rutas
from .. import fuentes
from ..config import PREDETERMINADA
from ..graficos import paleta as P
from ..sonido import VOLUMENES
from ..ui.controles_sonido import ControlesSonido
from ..ui.widgets import Boton, Campo, Casilla, Desplegable, Deslizador
from .base import Escena, FondoMenu, titulo_panel

TAMANOS = [(1280, 720), (1366, 768), (1600, 900), (1920, 1080), (2560, 1440)]


class Opciones(Escena):
    def __init__(self, app):
        super().__init__(app)
        lz = self.lz
        self.fondo = FondoMenu(lz)
        self.p = pygame.Rect(lz.W // 2 - 510, 112, 1020, 588)
        self._crear()

    def _columnas(self):
        """x de las tres columnas (pantalla, sonido, cámara) y la y de los títulos."""
        return self.p.x + 36, self.p.x + 372, self.p.x + 700, self.p.y + 92

    def _crear(self):
        cfg = self.app.config
        x1, x2, x3, y = self._columnas()
        self.widgets = []
        self.nombre = Campo((x1 + 80, y - 6, 210, 32), cfg["nombre"], maximo=20, pista="su nombre")
        self.completa = Casilla((x1, y + 76, 290, 30), "Pantalla completa (Alt+Enter)", cfg["pantalla_completa"],
                                self._pantalla_completa)
        ventana = tuple(cfg["ventana"])
        opciones = [(t, f"{t[0]} × {t[1]}") for t in TAMANOS]
        if ventana not in TAMANOS:
            opciones.insert(0, (ventana, f"{ventana[0]} × {ventana[1]}"))
        self.tamano = Desplegable((x1 + 150, y + 116, 140, 30), opciones, ventana, self._tamano)
        self.vsync = Casilla((x1, y + 160, 290, 30), "Sincronía vertical (al reiniciar)", cfg["vsync"],
                             lambda v: self._fijar("vsync", v))
        self.fps = Casilla((x1, y + 198, 290, 30), "Mostrar cuadros por segundo", cfg["mostrar_fps"],
                           lambda v: self._fijar("mostrar_fps", v))
        self.encerrar = Casilla((x1, y + 236, 290, 30), "Encerrar el ratón en la ventana", cfg["encerrar_raton"],
                                lambda v: self._fijar("encerrar_raton", v))
        self.encerrar.tooltip = ("Encerrar el ratón en la ventana",
                                 "Durante la batalla el puntero no sale de la ventana: basta llevarlo al borde "
                                 "para mover la cámara. Queda libre en el menú (F10) y al cambiar de programa "
                                 "(Alt+Tab).")
        # sonido: cuatro volúmenes que se aplican al instante
        self.sonido = ControlesSonido(self.app, x2, y + 40, 292)
        self.voces = Casilla((x2, y + 238, 292, 30), "Voces de las tropas", cfg["voces"],
                             lambda v: self._fijar("voces", v))
        self.voces.tooltip = ("Voces de las tropas",
                              "Las unidades hablan al formarse, al elegirlas y al recibir órdenes; sin voces se oyen "
                              "toques de corneta.")
        # cámara y combate
        self.vel_cam = Deslizador((x3, y + 64, 280, 18), cfg["velocidad_desplazamiento"],
                                  lambda v: self._fijar("velocidad_desplazamiento", round(v, 2)), 0.4, 2.5)
        self.borde = Casilla((x3, y + 98, 290, 30), "Mover la cámara con el borde", cfg["desplazar_con_borde"],
                             lambda v: self._fijar("desplazar_con_borde", v))
        self.barras = Casilla((x3, y + 136, 290, 30), "Barras de vida siempre visibles", cfg["barras_siempre"],
                              lambda v: self._fijar("barras_siempre", v))
        self.sangre = Casilla((x3, y + 174, 290, 30), "Sangre en las bajas", cfg["sangre"],
                              lambda v: self._fijar("sangre", v))
        self.sangre.tooltip = ("Sangre en las bajas",
                               "Charcos y salpicaduras al caer; con artillería, dinamita o minas el cuerpo vuela en "
                               "pedazos. Desactívelo para una batalla sin sangre.")
        self.widgets += [self.nombre, self.completa, self.vsync, self.fps, self.encerrar, self.sonido, self.voces,
                         self.vel_cam, self.borde, self.barras, self.sangre, self.tamano]
        self.widgets.append(Boton((self.p.x + 36, self.p.bottom - 64, 200, 44), "Restablecer", self.restablecer,
                                  "madera"))
        self.widgets.append(Boton((self.p.right - 256, self.p.bottom - 64, 220, 44), "Guardar y volver",
                                  self.volver, "principal"))

    def _fijar(self, clave, valor):
        self.app.config[clave] = valor

    def _pantalla_completa(self, v):
        self.app.config["pantalla_completa"] = v
        self.lz.pantalla_completa(v)

    def _tamano(self, t):
        self.app.config["ventana"] = [t[0], t[1]]
        if not self.app.config["pantalla_completa"]:
            try:
                self.lz.window.size = t
            except (pygame.error, AttributeError):
                pass

    def restablecer(self):
        nombre = self.app.config["nombre"]
        for k, v in PREDETERMINADA.items():
            if k not in ("nombre", "ultimo_servidor", "faccion", "mapa", "dificultad"):
                self.app.config[k] = list(v) if isinstance(v, list) else v
        self.app.config["nombre"] = nombre
        for clave in VOLUMENES:
            self.app.sonido.fijar_volumen(clave, self.app.config[clave])
        self.lz.pantalla_completa(self.app.config["pantalla_completa"])
        self._crear()

    def volver(self):
        nombre = self.nombre.texto.strip()
        if nombre:
            self.app.config["nombre"] = nombre
        self.app.config.guardar()
        from .portada import Portada
        self.app.cambiar(Portada(self.app))

    def manejar(self, ev):
        if ev.type == pygame.KEYDOWN and ev.key == pygame.K_ESCAPE:
            self.volver()
            return True
        return super().manejar(ev)

    def dibujar(self):
        lz = self.lz
        self.fondo.dibujar(self.t)
        self.ui.estilo.panel(self.p)
        titulo_panel(lz, "Opciones", self.p)
        x1, x2, x3, y = self._columnas()
        fb = fuentes.negrita(17)
        ft = fuentes.titulo(22)
        lz.texto("Nombre", x1, y, fb, P.TINTA)
        lz.texto("Pantalla", x1, y + 44, ft, P.TINTA)
        lz.texto("Tamaño de ventana", x1, y + 120, fuentes.cuerpo(17), P.TINTA)
        lz.texto("Sonido", x2, y, ft, P.TINTA)
        lz.texto("Cámara y combate", x3, y, ft, P.TINTA)
        lz.texto(f"Velocidad de la cámara: {self.app.config['velocidad_desplazamiento']:.1f}×", x3, y + 40,
                 fuentes.cuerpo(16), P.TINTA)
        lz.linea((x2 - 18, y + 4), (x2 - 18, y + 270), (150, 120, 84))
        lz.linea((x3 - 18, y + 4), (x3 - 18, y + 270), (150, 120, 84))
        lz.texto("Carpeta de datos (configuración, repeticiones, registros y capturas):", x1, y + 300,
                 fuentes.negrita(15), P.TINTA_SUAVE)
        lz.texto(str(rutas.dir_usuario()), x1, y + 322, fuentes.cuerpo(15), P.TINTA_SUAVE)
        teclas = ("Teclas: flechas o borde para mover la cámara · rueda: acercar · Ctrl+1..9: grupos · "
                  "F1: trabajador ocioso · Espacio: último aviso · Intro: conversar · F10: menú (también con el "
                  "volumen del sonido)")
        lz.parrafo(teclas, x1, y + 352, self.p.w - 72, fuentes.cursiva(15), P.TINTA_SUAVE)
        self.dibujar_widgets()
