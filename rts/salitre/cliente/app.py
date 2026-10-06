"""Aplicación del cliente: ventana, bucle principal y cambio de escenas."""

import argparse
import logging
import os
import sys
import time
import traceback

import pygame

from .. import NOMBRE_JUEGO, VERSION, rutas
from ..contenido import catalogo as mod_cat
from .config import Config, Perfil
from .lienzo import Lienzo
from .sonido import Sonido
from .ui.ui import UI
from .ui.widgets import Evento

log = logging.getLogger("salitre.cliente")


class App:
    def __init__(self, argv=None, prueba=False):
        self.args = argv or argparse.Namespace()
        self.config = Config()
        self.perfil = Perfil()
        self.cat = mod_cat.cargar()
        cfg = self.config
        self.lz = Lienzo(cfg["ventana"], cfg["resolucion_interna"], cfg["pantalla_completa"] and not prueba,
                         cfg["vsync"] and not prueba)
        self.lz.poner_icono(icono())
        self.ui = UI(self.lz)
        self.sonido = Sonido(cfg)
        self.red = None
        self.servidor_local = None
        self.bienvenida = None
        self.lobby = None          # último estado del salón (salas, conectados, partidas)
        self.sala_actual = None    # última sala recibida
        self.en_sala = False
        self.chat_salon = []       # [(de, texto, canal)] conservado entre escenas
        self.corriendo = True
        self.escena = None
        self.reloj = pygame.time.Clock()
        self.fps = 0.0
        self.aviso_global = None
        from .escenas.portada import Portada
        self.cambiar(Portada(self))

    # ------------------------------------------------------------------
    def cambiar(self, escena):
        if self.escena is not None:
            self.escena.salir()
        self.escena = escena
        escena.entrar()

    def salir(self):
        self.corriendo = False

    def avisar(self, texto, segundos=5.0):
        self.aviso_global = (texto, time.monotonic() + segundos)

    def perdio_conexion(self, motivo):
        from .escenas.portada import Portada
        self.cerrar_red()
        self.avisar(motivo or "Se perdió la conexión con el servidor.", 8)
        self.cambiar(Portada(self))

    def cerrar_red(self):
        if self.red is not None:
            self.red.cerrar()
        self.red = None
        self.bienvenida = None
        self.lobby = None
        self.sala_actual = None
        self.en_sala = False
        self.chat_salon = []

    def anotar_chat(self, m):
        self.chat_salon.append((m.get("de", "?"), m.get("texto", ""), m.get("canal", "general")))
        del self.chat_salon[:-80]

    def detener_servidor_local(self):
        if self.servidor_local is not None:
            self.servidor_local.detener()
            self.servidor_local = None

    def iniciar_servidor_local(self, publico=False, puerto=0):
        """Arranca un servidor en este equipo. publico=True lo abre a la red (para jugar con amigos)."""
        from ..servidor.servidor import ServidorEnHilo
        self.detener_servidor_local()
        if publico:
            srv = ServidorEnHilo(host="0.0.0.0", puerto=puerto, lan=True, local=False,
                                 nombre=f"Partida de {self.config['nombre'] or 'un jugador'}")
        else:
            srv = ServidorEnHilo(host="127.0.0.1", puerto=0, lan=False, local=True,
                                 ruta_bd=str(rutas.dir_usuario() / "local.db"), minimo_registro=0)
        p = srv.iniciar()
        self.servidor_local = srv
        return p

    # ------------------------------------------------------------------
    def paso(self, dt):
        ui = self.ui
        lz = self.lz
        for ev in pygame.event.get():
            if ev.type == pygame.QUIT:
                self.salir()
                continue
            if ev.type == pygame.KEYDOWN and ev.key == pygame.K_F12:
                self.captura()
                continue
            if ev.type == pygame.KEYDOWN and ev.key == pygame.K_RETURN and ev.mod & pygame.KMOD_ALT:
                self.config["pantalla_completa"] = not self.config["pantalla_completa"]
                lz.pantalla_completa(self.config["pantalla_completa"])
                continue
            e = Evento(ev, lz)
            self.escena.manejar(e)
        self.escena.actualizar(dt)
        lz.limpiar((0, 0, 0))
        ui.comenzar()
        self.escena.dibujar()
        self._dibujar_aviso()
        ui.terminar()
        if self.config["mostrar_fps"]:
            from . import fuentes
            lz.texto(f"{self.fps:.0f} FPS", 6, 4, fuentes.cuerpo(14), (255, 255, 0), sombra=(0, 0, 0))
        lz.presentar()

    def _dibujar_aviso(self):
        if self.aviso_global is None:
            return
        texto, hasta = self.aviso_global
        if time.monotonic() > hasta:
            self.aviso_global = None
            return
        from . import fuentes
        lz = self.lz
        f = fuentes.negrita(18)
        w, h = lz.medir(texto, f)
        w = min(w, lz.W - 80)
        r = pygame.Rect((lz.W - w) // 2 - 16, lz.H - 70, w + 32, h + 14)
        lz.rect(r, (40, 16, 10), 235)
        lz.marco(r, (200, 160, 90), 1)
        lz.parrafo(texto, r.x + 16, r.y + 6, w + 4, f, (250, 236, 210))

    def captura(self):
        ruta = rutas.dir_capturas() / time.strftime("captura-%Y%m%d-%H%M%S.png")
        self.lz.captura(ruta)
        self.avisar(f"Captura guardada en {ruta}")

    def bucle(self):
        try:
            while self.corriendo:
                dt = self.reloj.tick(144) / 1000.0
                self.fps = self.reloj.get_fps()
                self.paso(min(dt, 0.1))
        finally:
            self.cerrar()

    def cerrar(self):
        try:
            self.config.guardar()
            self.cerrar_red()
            self.detener_servidor_local()
            self.perfil.cerrar()
        finally:
            from . import fuentes
            fuentes.olvidar()
            pygame.quit()


def icono():
    """Ícono de la ventana: bandera con el sol y un fusil cruzado."""
    s = pygame.Surface((64, 64), pygame.SRCALPHA)
    pygame.draw.circle(s, (150, 32, 28), (32, 32), 31)
    pygame.draw.circle(s, (230, 196, 120), (32, 32), 31, 3)
    pygame.draw.circle(s, (244, 236, 214), (32, 32), 12)
    pygame.draw.line(s, (60, 40, 24), (12, 52), (52, 12), 5)
    pygame.draw.line(s, (60, 40, 24), (12, 12), (52, 52), 5)
    return s


def main(argv=None):
    ap = argparse.ArgumentParser(prog="salitre", description=NOMBRE_JUEGO)
    ap.add_argument("--conectar", help="servidor al que conectarse al iniciar (host:puerto)")
    ap.add_argument("--nombre", help="nombre del jugador")
    ap.add_argument("--version", action="store_true")
    args = ap.parse_args(argv)
    if args.version:
        print(NOMBRE_JUEGO, VERSION)
        return 0
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s",
                        handlers=[logging.FileHandler(rutas.dir_registros() / "cliente.log", encoding="utf-8"),
                                  logging.StreamHandler(sys.stdout)])
    if sys.platform.startswith("win"):
        try:
            import ctypes
            ctypes.windll.shcore.SetProcessDpiAwareness(1)
        except (AttributeError, OSError):
            pass
    os.environ.setdefault("SDL_IME_SHOW_UI", "1")
    try:
        app = App(args)
        if args.nombre:
            app.config["nombre"] = args.nombre
        app.bucle()
    except Exception:  # noqa: BLE001 - se registra para poder ayudar al jugador
        log.error("Error fatal:\n%s", traceback.format_exc())
        raise
    return 0
