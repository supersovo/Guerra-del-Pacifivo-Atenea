"""Opciones: pantalla, sonido y controles. Se guardan en config.json."""

import pygame

from ... import rutas
from .. import fuentes
from ..config import PREDETERMINADA
from ..graficos import paleta as P
from ..ui.widgets import Boton, Campo, Casilla, Desplegable, Deslizador
from .base import Escena, FondoMenu, titulo_panel

TAMANOS = [(1280, 720), (1366, 768), (1600, 900), (1920, 1080), (2560, 1440)]


class Opciones(Escena):
    def __init__(self, app):
        super().__init__(app)
        lz = self.lz
        self.fondo = FondoMenu(lz)
        self.p = pygame.Rect(lz.W // 2 - 400, 140, 800, 556)
        self._crear()

    def _crear(self):
        cfg = self.app.config
        x = self.p.x + 40
        x2 = self.p.x + 420
        y = self.p.y + 100
        self.widgets = []
        self.nombre = Campo((x + 120, y - 6, 220, 32), cfg["nombre"], maximo=20, pista="su nombre")
        self.completa = Casilla((x, y + 64, 330, 30), "Pantalla completa (Alt+Enter)", cfg["pantalla_completa"],
                                self._pantalla_completa)
        ventana = tuple(cfg["ventana"])
        opciones = [(t, f"{t[0]} × {t[1]}") for t in TAMANOS]
        if ventana not in TAMANOS:
            opciones.insert(0, (ventana, f"{ventana[0]} × {ventana[1]}"))
        self.tamano = Desplegable((x + 160, y + 104, 180, 30), opciones, ventana, self._tamano)
        self.vsync = Casilla((x, y + 150, 330, 30), "Sincronía vertical (al reiniciar)", cfg["vsync"],
                             lambda v: self._fijar("vsync", v))
        self.fps = Casilla((x, y + 190, 330, 30), "Mostrar cuadros por segundo", cfg["mostrar_fps"],
                           lambda v: self._fijar("mostrar_fps", v))
        self.volumen = Deslizador((x2, y + 74, 300, 20), cfg["volumen_efectos"], self._volumen)
        self.vel_cam = Deslizador((x2, y + 174, 300, 20), cfg["velocidad_desplazamiento"],
                                  lambda v: self._fijar("velocidad_desplazamiento", round(v, 2)), 0.4, 2.5)
        self.borde = Casilla((x2, y + 210, 340, 30), "Mover la cámara con el borde", cfg["desplazar_con_borde"],
                             lambda v: self._fijar("desplazar_con_borde", v))
        self.barras = Casilla((x2, y + 248, 340, 30), "Barras de vida siempre visibles", cfg["barras_siempre"],
                              lambda v: self._fijar("barras_siempre", v))
        self.widgets += [self.nombre, self.completa, self.vsync, self.fps, self.volumen, self.vel_cam, self.borde,
                         self.barras, self.tamano]
        self.widgets.append(Boton((self.p.x + 40, self.p.bottom - 64, 200, 44), "Restablecer", self.restablecer,
                                  "madera"))
        self.widgets.append(Boton((self.p.right - 260, self.p.bottom - 64, 220, 44), "Guardar y volver",
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

    def _volumen(self, v):
        self.app.config["volumen_efectos"] = round(v, 2)
        self.app.sonido.vol = v

    def restablecer(self):
        nombre = self.app.config["nombre"]
        for k, v in PREDETERMINADA.items():
            if k not in ("nombre", "ultimo_servidor", "faccion", "mapa", "dificultad"):
                self.app.config[k] = list(v) if isinstance(v, list) else v
        self.app.config["nombre"] = nombre
        self.app.sonido.vol = self.app.config["volumen_efectos"]
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
        r = super().manejar(ev)
        if ev.type == pygame.MOUSEBUTTONUP and ev.button == 1 and self.volumen.rect.inflate(0, 10).collidepoint(ev.pos):
            self.app.sonido.reproducir("fusil", 0.8)
        return r

    def dibujar(self):
        lz = self.lz
        self.fondo.dibujar(self.t)
        self.ui.estilo.panel(self.p)
        titulo_panel(lz, "Opciones", self.p)
        x = self.p.x + 40
        x2 = self.p.x + 420
        y = self.p.y + 100
        fb = fuentes.negrita(17)
        ft = fuentes.titulo(22)
        lz.texto("Nombre", x, y, fb, P.TINTA)
        lz.texto("Pantalla", x, y + 34, ft, P.TINTA)
        lz.texto("Tamaño de la ventana", x, y + 108, fuentes.cuerpo(17), P.TINTA)
        lz.texto("Sonido", x2, y + 6, ft, P.TINTA)
        lz.texto(f"Volumen de los efectos: {int(self.app.config['volumen_efectos'] * 100)} %", x2, y + 40,
                 fuentes.cuerpo(17), P.TINTA)
        lz.texto("Cámara y combate", x2, y + 112, ft, P.TINTA)
        lz.texto(f"Velocidad de la cámara: {self.app.config['velocidad_desplazamiento']:.1f}×", x2, y + 142,
                 fuentes.cuerpo(17), P.TINTA)
        lz.texto("Carpeta de datos (configuración, repeticiones, registros y capturas):", x, y + 300,
                 fuentes.negrita(15), P.TINTA_SUAVE)
        lz.texto(str(rutas.dir_usuario()), x, y + 322, fuentes.cuerpo(15), P.TINTA_SUAVE)
        teclas = ("Teclas: flechas o borde para mover la cámara · rueda: acercar · Ctrl+1..9: grupos · "
                  "F1: trabajador ocioso · Espacio: último aviso · Intro: conversar · F10: menú")
        lz.parrafo(teclas, x, y + 352, self.p.w - 80, fuentes.cursiva(15), P.TINTA_SUAVE)
        self.dibujar_widgets()
