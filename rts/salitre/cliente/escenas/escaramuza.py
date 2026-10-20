"""Escaramuza: elegir mapa, nación y rivales controlados por la IA."""

import random

import pygame

from ...contenido import mapas as mod_mapas
from ...ia.ia import DIFICULTADES
from ...red.conexion import Conexion
from .. import fuentes
from ..graficos import paleta as P
from ..graficos.banderas import superficie_bandera
from ..graficos.minimapa import superficie_mapa
from ..ui.widgets import Boton, Casilla, Desplegable, Lista
from .base import Escena, FondoMenu, titulo_panel

NACIONES = ["chile", "peru", "bolivia", "argentina"]


class Escaramuza(Escena):
    def __init__(self, app):
        super().__init__(app)
        lz = self.lz
        self.fondo = FondoMenu(lz)
        self.cfg = app.config
        self.mapas = {}
        for ident, ruta in mod_mapas.listar().items():
            try:
                self.mapas[ident] = mod_mapas.cargar(ruta)
            except mod_mapas.MapaError:
                pass
        self.p_izq = pygame.Rect(24, 140, 612, 556)
        self.p_der = pygame.Rect(648, 140, 608, 556)
        items = [(k, f"{d.nombre}  ({d.jugadores})") for k, d in self.mapas.items()]
        self.lista = Lista((self.p_izq.x + 22, self.p_izq.y + 70, 236, 300), items, self.elegir_mapa)
        self.widgets.append(self.lista)
        self.mapa = self.cfg["mapa"] if self.cfg["mapa"] in self.mapas else next(iter(self.mapas))
        self.lista.sel = self.mapa
        self.faccion = self.cfg["faccion"] if self.cfg["faccion"] in NACIONES else "chile"
        self.botones_nacion = []
        for i, n in enumerate(NACIONES):
            b = Boton((self.p_der.x + 24 + i * 140, self.p_der.y + 70, 130, 56), "",
                      lambda n=n: self.elegir_nacion(n))
            b.nacion = n
            self.botones_nacion.append(b)
        self.filas = []
        self.vel = Desplegable((self.p_der.x + 150, self.p_der.bottom - 120, 200, 30),
                               [("normal", "Normal"), ("rapida", "Rápida"), ("muy_rapida", "Muy rápida")], "normal")
        self.widgets.append(self.vel)
        self.widgets.append(Boton((self.p_der.x + 24, self.p_der.bottom - 64, 170, 44), "Volver", self.volver, "madera"))
        self.widgets.append(Boton((self.p_der.right - 264, self.p_der.bottom - 64, 240, 44), "¡A la carga!",
                                  self.comenzar, "principal", fuente=fuentes.negrita(20)))
        self.tex_banderas = {n: lz.textura(("bandera", n, 64), lambda n=n: superficie_bandera(n, 64, 40))
                             for n in NACIONES}
        self.elegir_mapa(self.mapa)

    def elegir_mapa(self, ident):
        self.mapa = ident
        d = self.mapas[ident]
        self.tex_mapa = self.lz.textura(("previa", ident), lambda: superficie_mapa(d, 3))
        for f in self.filas:
            for w in f:
                if w in self.widgets:
                    self.widgets.remove(w)
        self.filas = []
        y0 = self.p_der.y + 292
        difs = [(k, v["nombre"]) for k, v in DIFICULTADES.items()]
        for i in range(d.jugadores - 1):
            y = y0 + i * 40
            activo = Casilla((self.p_der.x + 24, y, 34, 30), "", i == 0)
            nac = Desplegable((self.p_der.x + 64, y, 150, 30),
                              [("azar", "Al azar")] + [(n, self.app.cat.facciones[n].nombre) for n in NACIONES],
                              NACIONES[(NACIONES.index(self.faccion) + 1 + i) % 4])
            dif = Desplegable((self.p_der.x + 222, y, 210, 30), difs, self.cfg["dificultad"])
            eq = Desplegable((self.p_der.x + 440, y, 140, 30), [(k, f"Equipo {k}") for k in range(1, 5)], 2)
            if i == 0:
                activo.activo = False
            fila = [activo, nac, dif, eq]
            self.filas.append(fila)
        # los desplegables se agregan al revés para que el de arriba se dibuje encima de los de abajo
        for fila in reversed(self.filas):
            self.widgets.extend(fila)

    def elegir_nacion(self, n):
        self.faccion = n

    def volver(self):
        from .portada import Portada
        self.app.cambiar(Portada(self.app))

    def manejar(self, ev):
        if ev.type == pygame.KEYDOWN and ev.key == pygame.K_ESCAPE:
            self.volver()
            return True
        for b in self.botones_nacion:
            if b.manejar(ev):
                return True
        return super().manejar(ev)

    def comenzar(self):
        rivales = []
        for activo, nac, dif, eq in self.filas:
            if not activo.valor and activo.activo:
                continue
            n = nac.valor if nac.valor != "azar" else random.choice(NACIONES)
            rivales.append({"faccion": n, "dificultad": dif.valor, "equipo": eq.valor})
        if not any(r["equipo"] != 1 for r in rivales):
            self.app.avisar("Debe haber al menos un rival en otro equipo (su equipo es el 1).")
            return
        self.cfg["mapa"] = self.mapa
        self.cfg["faccion"] = self.faccion
        if rivales:
            self.cfg["dificultad"] = rivales[0]["dificultad"]
        self.cfg.guardar()
        nombre = self.cfg["nombre"] if len(self.cfg["nombre"]) >= 3 else "Comandante"
        try:
            puerto = self.app.iniciar_servidor_local()
            red = Conexion()
            if not red.conectar_y_esperar("127.0.0.1", puerto):
                raise ConnectionError(red.error)
            red.saludar(nombre, huella=self.app.cat.huella)
            red.esperar("bienvenida", 8)
            red.enviar({"t": "partida_rapida", "mapa": self.mapa, "faccion": self.faccion, "rivales": rivales,
                        "velocidad": self.vel.valor})
        except (OSError, RuntimeError, TimeoutError, ConnectionError) as e:
            self.app.avisar(f"No se pudo iniciar la escaramuza: {e}")
            self.app.detener_servidor_local()
            return
        self.app.red = red
        from .cargando import Cargando
        self.app.cambiar(Cargando(self.app, "escaramuza",
                                  {"mapa": self.mapa, "faccion": self.faccion, "rivales": rivales}))

    def dibujar(self):
        lz = self.lz
        self.fondo.dibujar(self.t)
        est = self.ui.estilo
        est.panel(self.p_izq)
        est.panel(self.p_der)
        titulo_panel(lz, "Campo de batalla", self.p_izq)
        titulo_panel(lz, "Su nación y sus rivales", self.p_der)
        d = self.mapas[self.mapa]
        # vista previa con proporción correcta
        caja = pygame.Rect(self.p_izq.x + 272, self.p_izq.y + 70, 316, 300)
        esc = min(caja.w / self.tex_mapa.width, caja.h / self.tex_mapa.height)
        w, h = int(self.tex_mapa.width * esc), int(self.tex_mapa.height * esc)
        x, y = caja.x + (caja.w - w) // 2, caja.y + (caja.h - h) // 2
        lz.rect((x - 3, y - 3, w + 6, h + 6), (60, 40, 24))
        lz.dibujar(self.tex_mapa, x, y, w, h)
        ty = self.p_izq.y + 382
        lz.texto(d.nombre, self.p_izq.x + 24, ty, fuentes.titulo(24), P.TINTA)
        ty += 32
        ty += lz.parrafo(d.descripcion, self.p_izq.x + 24, ty, self.p_izq.w - 48, fuentes.negrita(16), P.TINTA)
        lz.parrafo(d.historia, self.p_izq.x + 24, ty + 6, self.p_izq.w - 48, fuentes.cursiva(16), P.TINTA_SUAVE,
                   max_lineas=5)
        # naciones
        for b in self.botones_nacion:
            sel = b.nacion == self.faccion
            r = b.rect
            lz.rect(r, (150, 32, 28) if sel else (90, 64, 40))
            lz.rect(r.inflate(-4, -4), P.PERGAMINO if not sel else (246, 232, 196))
            lz.dibujar(self.tex_banderas[b.nacion], r.x + 8, r.y + 8, 48, 30)
            lz.texto(self.app.cat.facciones[b.nacion].nombre, r.x + 62, r.y + 14, fuentes.negrita(17), P.TINTA)
            if sel:
                lz.marco(r, P.BRONCE_CLARO, 2)
        f = self.app.cat.facciones[self.faccion]
        yy = self.p_der.y + 138
        lz.texto(f.ejercito, self.p_der.x + 24, yy, fuentes.titulo(22), P.TINTA)
        yy += 28
        lz.parrafo(f.descripcion, self.p_der.x + 24, yy, self.p_der.w - 48, fuentes.cuerpo(16), P.TINTA, max_lineas=3)
        heroes = ", ".join(self.app.cat.unidades[h].nombre.split(" (")[0] for h in f.heroes)
        lz.parrafo("Héroes: " + heroes, self.p_der.x + 24, yy + 50, self.p_der.w - 48, fuentes.cursiva(15),
                   P.TINTA_SUAVE, max_lineas=2)
        lz.texto("Rivales (su equipo es el 1)", self.p_der.x + 24, self.p_der.y + 262, fuentes.negrita(17), P.TINTA)
        lz.texto("Velocidad", self.p_der.x + 24, self.p_der.bottom - 115, fuentes.negrita(17), P.TINTA)
        self.dibujar_widgets()
