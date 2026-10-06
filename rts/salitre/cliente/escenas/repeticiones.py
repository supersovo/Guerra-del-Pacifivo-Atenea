"""Repeticiones guardadas en este equipo: verlas con todo el mapa a la vista,
cambiar la velocidad (+/-) y estudiar la batalla después."""

import time
import webbrowser

import pygame

from ... import VERSION, rutas
from ...red.conexion import Conexion
from ...servidor import repeticion
from .. import fuentes
from ..graficos import paleta as P
from ..ui.widgets import Boton, Tabla
from .base import Escena, FondoMenu, titulo_panel


class Repeticiones(Escena):
    def __init__(self, app):
        super().__init__(app)
        lz = self.lz
        self.fondo = FondoMenu(lz)
        self.p = pygame.Rect(40, 140, lz.W - 80, lz.H - 170)
        self.tabla = Tabla((self.p.x + 24, self.p.y + 70, self.p.w - 48, self.p.h - 160),
                           [("Fecha", 150, "izq"), ("Campo de batalla", 260, "izq"), ("Ejércitos", 540, "izq"),
                            ("Minutos", 90, "centro"), ("Versión", 90, "centro")],
                           al_doble=lambda c: self.ver(), alto_fila=28)
        self.tabla.vacia = "Todavía no hay repeticiones: cada partida terminada se guarda sola."
        self.widgets.append(self.tabla)
        y = self.p.bottom - 64
        self.widgets.append(Boton((self.p.x + 24, y, 160, 44), "Volver", self.volver, "madera"))
        self.widgets.append(Boton((self.p.x + 200, y, 220, 44), "Abrir la carpeta", self.abrir_carpeta))
        self.b_borrar = Boton((self.p.x + 436, y, 160, 44), "Borrar", self.borrar)
        self.widgets.append(self.b_borrar)
        self.widgets.append(Boton((self.p.right - 264, y, 240, 44), "Ver la repetición", self.ver, "principal"))
        self.borrar_confirmar = None
        self.cargar()

    def cargar(self):
        self.reps = {r["nombre"]: r for r in repeticion.listar()}
        filas = []
        for r in self.reps.values():
            fecha = time.strftime("%d/%m/%Y %H:%M", time.localtime(r["fecha"])) if r["fecha"] else "?"
            filas.append((r["nombre"], [fecha, r["mapa"], " · ".join(r["jugadores"]), r["minutos"], r["version"]]))
        self.tabla.poner(filas)

    def volver(self):
        from .portada import Portada
        self.app.cambiar(Portada(self.app))

    def abrir_carpeta(self):
        carpeta = rutas.dir_repeticiones()
        try:
            webbrowser.open(carpeta.as_uri())
        except (OSError, ValueError, webbrowser.Error):
            pass
        self.app.avisar(f"Carpeta de repeticiones: {carpeta}", 8)

    def borrar(self):
        nombre = self.tabla.sel
        if nombre is None:
            self.app.avisar("Elija una repetición de la lista.")
            return
        if self.borrar_confirmar != nombre:
            self.borrar_confirmar = nombre
            self.app.avisar("Pulse «Borrar» otra vez para confirmar.", 4)
            return
        try:
            (rutas.dir_repeticiones() / (nombre + repeticion.EXTENSION)).unlink()
        except OSError as e:
            self.app.avisar(f"No se pudo borrar: {e}")
        self.borrar_confirmar = None
        self.cargar()

    def ver(self):
        nombre = self.tabla.sel
        if nombre is None:
            self.app.avisar("Elija una repetición de la lista.")
            return
        info = self.reps.get(nombre, {})
        if info.get("version") not in (None, "?") and info["version"] != VERSION:
            self.app.avisar("Esa repetición es de otra versión del juego: puede no verse bien.", 6)
        jugador = self.app.config["nombre"] if len(self.app.config["nombre"]) >= 3 else "Espectador"
        try:
            puerto = self.app.iniciar_servidor_local()
            red = Conexion()
            if not red.conectar_y_esperar("127.0.0.1", puerto):
                raise ConnectionError(red.error)
            red.saludar(jugador, huella=self.app.cat.huella)
            red.esperar("bienvenida", 8)
            red.enviar({"t": "ver_repeticion", "nombre": nombre})
        except (OSError, RuntimeError, TimeoutError, ConnectionError) as e:
            self.app.avisar(f"No se pudo abrir la repetición: {e}")
            self.app.detener_servidor_local()
            return
        self.app.red = red
        from .cargando import Cargando
        self.app.cambiar(Cargando(self.app, "repeticion"))

    def manejar(self, ev):
        if ev.type == pygame.KEYDOWN and ev.key == pygame.K_ESCAPE:
            self.volver()
            return True
        if ev.type == pygame.KEYDOWN and ev.key in (pygame.K_RETURN, pygame.K_KP_ENTER):
            self.ver()
            return True
        return super().manejar(ev)

    def dibujar(self):
        lz = self.lz
        self.fondo.dibujar(self.t)
        self.ui.estilo.panel(self.p)
        titulo_panel(lz, "Repeticiones", self.p)
        lz.texto("Doble clic para ver · durante la repetición, + y - cambian la velocidad", self.p.right - 24,
                 self.p.y + 64 - 22, fuentes.cursiva(15), P.TINTA_SUAVE, "der")
        self.dibujar_widgets()
