"""Sala de espera: los jugadores eligen nación, equipo y color; el anfitrión
elige el mapa, agrega rivales de la IA y da la orden de iniciar el combate."""

import pygame

from ...contenido import mapas as mod_mapas
from .. import fuentes
from ..graficos import paleta as P
from ..graficos.banderas import superficie_bandera
from ..graficos.minimapa import superficie_mapa
from ..ui.widgets import Boton, Desplegable, PanelChat
from .base import Escena, FondoMenu
from .lobby import NACIONES, NOMBRE_VELOCIDAD

ALTO_FILA = 52


class SalaEspera(Escena):
    def __init__(self, app):
        super().__init__(app)
        self.fondo = FondoMenu(self.lz)
        lz = self.lz
        bien = app.bienvenida or {}
        self.mapas = {m["id"]: m for m in bien.get("mapas", [])}
        self.dificultades = bien.get("dificultades", {"normal": "Normal"})
        self.p_ran = pygame.Rect(24, 14, 836, 478)
        self.p_mapa = pygame.Rect(872, 14, lz.W - 896, 478)
        self.p_chat = pygame.Rect(24, 502, 836, 202)
        self.p_ord = pygame.Rect(872, 502, lz.W - 896, 202)
        self.chat = PanelChat(self.p_chat.inflate(-32, -54).move(0, 18), app, "sala")
        self.filas = []          # widgets de cada ranura
        self.forma = None        # para saber cuándo rehacer los controles
        self.tex_mapa = None
        self.mapa_previa = None
        po = self.p_ord
        self.b_iniciar = Boton((po.x + 16, po.y + 16, po.w - 32, 48), "¡Iniciar el combate!", self.iniciar,
                               "principal", fuente=fuentes.negrita(20))
        self.b_listo = Boton((po.x + 16, po.y + 16, po.w - 32, 48), "Estoy listo", self.alternar_listo, "principal",
                             fuente=fuentes.negrita(20))
        self.b_ia = Boton((po.x + 16, po.y + 76, po.w - 32, 40), "Agregar rival de la IA", self.agregar_ia,
                          tooltip=("Agregar IA", "Ocupa la primera ranura libre con un ejército de la computadora. "
                                                 "Después puede elegir su nación, equipo y dificultad."))
        self.b_salir = Boton((po.x + 16, po.bottom - 54, po.w - 32, 40), "Salir de la sala", self.salir_sala, "madera")
        pm = self.p_mapa
        self.d_mapa = Desplegable((pm.x + 16, pm.y + 330, pm.w - 32, 30),
                                  [(k, f"{m['nombre']} ({m['jugadores']})") for k, m in self.mapas.items()],
                                  None, self.cambiar_mapa)
        vels = bien.get("velocidades", ["normal"])
        self.d_vel = Desplegable((pm.x + 120, pm.y + 368, pm.w - 136, 30),
                                 [(v, NOMBRE_VELOCIDAD.get(v, v)) for v in vels], "normal", self.cambiar_velocidad)
        self.fijos = [self.chat, self.b_iniciar, self.b_listo, self.b_ia, self.b_salir, self.d_vel, self.d_mapa]
        self.tex_banderas = {n: lz.textura(("bandera", n, 64), lambda n=n: superficie_bandera(n, 64, 40))
                             for n in NACIONES}
        self._aplicar(app.sala_actual)

    # ------------------------------------------------------------------
    @property
    def sala(self):
        return (self.app.sala_actual or {}).get("sala") or {}

    @property
    def yo(self):
        return (self.app.sala_actual or {}).get("yo")

    @property
    def anfitrion(self):
        return bool((self.app.sala_actual or {}).get("anfitrion"))

    def _editable(self, k, r):
        return k == self.yo or (self.anfitrion and r["tipo"] == "ia")

    def _aplicar(self, m):
        if m is None:
            return
        self.app.sala_actual = m
        sala = self.sala
        ranuras = sala.get("ranuras", [])
        forma = (self.anfitrion, self.yo, tuple((r["tipo"], self._editable(k, r)) for k, r in enumerate(ranuras)))
        if forma != self.forma:
            self.forma = forma
            self._rehacer(ranuras)
        else:
            for fila, r in zip(self.filas, ranuras):
                for clave, w in fila.items():
                    if isinstance(w, Desplegable) and not w.abierto and clave in r:
                        w.valor = r[clave]
                if "color" in fila:
                    fila["color"].opciones = self._opciones_color(r)
        if not self.d_mapa.abierto:
            self.d_mapa.valor = sala.get("mapa")
        if not self.d_vel.abierto:
            self.d_vel.valor = sala.get("velocidad", "normal")
        self.d_mapa.activo = self.d_vel.activo = self.anfitrion
        self.b_iniciar.visible = self.b_ia.visible = self.anfitrion
        self.b_listo.visible = not self.anfitrion
        mia = ranuras[self.yo] if self.yo is not None and self.yo < len(ranuras) else {}
        self.b_listo.texto = "Ya no estoy listo" if mia.get("listo") else "Estoy listo"
        self.b_ia.activo = any(r["tipo"] == "abierta" for r in ranuras)
        if sala.get("mapa") != self.mapa_previa:
            self.mapa_previa = sala.get("mapa")
            self.tex_mapa = None
            try:
                datos = mod_mapas.buscar(self.mapa_previa)
                self.tex_mapa = self.lz.textura(("previa", self.mapa_previa),
                                                lambda: superficie_mapa(datos, 3))
            except mod_mapas.MapaError:
                pass

    def _opciones_color(self, r):
        usados = {x["color"] for x in self.sala.get("ranuras", []) if x["tipo"] in ("humano", "ia")}
        return [(c, P.nombre_color(c)) for c in range(len(P.COLORES_JUGADOR))
                if c not in usados or c == r["color"]]

    def _rehacer(self, ranuras):
        self.filas = []
        x0 = self.p_ran.x + 16
        y0 = self.p_ran.y + 92
        n = max(2, len(ranuras))
        for k, r in enumerate(ranuras):
            y = y0 + k * ALTO_FILA
            fila = {}
            if r["tipo"] in ("humano", "ia"):
                editable = self._editable(k, r)
                fac = Desplegable((x0 + 300, y + 8, 140, 30),
                                  [(n_, self.app.cat.facciones[n_].nombre) for n_ in NACIONES], r["faccion"],
                                  lambda v, k=k: self.ajustar(k, faccion=v))
                eq = Desplegable((x0 + 448, y + 8, 106, 30), [(e, f"Equipo {e}") for e in range(1, n + 1)],
                                 r["equipo"], lambda v, k=k: self.ajustar(k, equipo=v))
                col = Desplegable((x0 + 562, y + 8, 110, 30), self._opciones_color(r), r["color"],
                                  lambda v, k=k: self.ajustar(k, color=v))
                for w in (fac, eq, col):
                    w.activo = editable
                fila.update(faccion=fac, equipo=eq, color=col)
                if r["tipo"] == "ia":
                    dif = Desplegable((x0 + 120, y + 26, 170, 24), list(self.dificultades.items()),
                                      r["dificultad"], lambda v, k=k: self.ajustar(k, dificultad=v))
                    dif.activo = self.anfitrion
                    fila["dificultad"] = dif
            if self.anfitrion and k != self.yo:
                texto = {"abierta": "Cerrar", "cerrada": "Abrir", "ia": "Quitar", "humano": "Expulsar"}[r["tipo"]]
                fila["accion"] = Boton((x0 + 690, y + 8, 106, 30), texto, lambda k=k: self.quitar(k), "madera")
            self.filas.append(fila)
        # de abajo hacia arriba, para que cada desplegable quede encima de las filas siguientes
        self.widgets = list(self.fijos)
        for fila in reversed(self.filas):
            self.widgets.extend(fila.values())

    # -- órdenes al servidor -------------------------------------------
    def _enviar(self, msg):
        if self.app.red is not None:
            self.app.red.enviar(msg)

    def ajustar(self, k, **cambios):
        msg = {"t": "ajustar", **cambios}
        if k != self.yo:
            msg["ranura"] = k
        self._enviar(msg)

    def quitar(self, k):
        self._enviar({"t": "quitar", "ranura": k})

    def agregar_ia(self):
        mias = [r["faccion"] for r in self.sala.get("ranuras", []) if r["tipo"] in ("humano", "ia")]
        fac = next((n for n in NACIONES if n not in mias), "peru")
        self._enviar({"t": "agregar_ia", "faccion": fac, "dificultad": self.app.config["dificultad"]})

    def cambiar_mapa(self, v):
        self._enviar({"t": "mapa", "mapa": v})

    def cambiar_velocidad(self, v):
        self._enviar({"t": "mapa", "mapa": self.sala.get("mapa"), "velocidad": v})

    def alternar_listo(self):
        ranuras = self.sala.get("ranuras", [])
        mia = ranuras[self.yo] if self.yo is not None and self.yo < len(ranuras) else {}
        self._enviar({"t": "listo", "valor": not mia.get("listo", False)})

    def iniciar(self):
        self._enviar({"t": "iniciar"})

    def salir_sala(self):
        self._enviar({"t": "salir_sala"})
        self._al_salon()

    def _al_salon(self):
        self.app.en_sala = False
        self.app.sala_actual = None
        from .lobby import Lobby
        self.app.cambiar(Lobby(self.app))

    # ------------------------------------------------------------------
    def actualizar(self, dt):
        super().actualizar(dt)
        for m in self.mensajes_red():
            t = m.get("t")
            if t == "sala":
                self._aplicar(m)
            elif t == "lobby":
                self.app.lobby = m
            elif t == "chat":
                self.app.anotar_chat(m)
            elif t == "inicio":
                from .juego import Juego
                self.app.cambiar(Juego(self.app, m, "multijugador"))
                return
            elif t == "expulsado":
                self.app.avisar(m.get("msg", "Fue retirado de la sala."), 8)
                self._al_salon()
                return
            elif t in ("error", "aviso"):
                self.app.avisar(m.get("msg", "Error"), 8)

    def manejar(self, ev):
        if ev.type == pygame.KEYDOWN and ev.key == pygame.K_ESCAPE and not self.chat.campo.foco:
            self.salir_sala()
            return True
        return super().manejar(ev)

    # ------------------------------------------------------------------
    def dibujar(self):
        lz = self.lz
        self.fondo.dibujar(self.t, titulo=False, velo=120)
        est = self.ui.estilo
        sala = self.sala
        pr = self.p_ran
        est.panel(pr)
        lz.texto(sala.get("nombre", "Sala"), pr.x + 20, pr.y + 12, fuentes.titulo(30), P.TINTA)
        lz.texto(f"Anfitrión: {sala.get('anfitrion', '?')}", pr.right - 20, pr.y + 20, fuentes.cursiva(16),
                 P.TINTA_SUAVE, "der")
        x0 = pr.x + 16
        yh = pr.y + 62
        fb = fuentes.negrita(15)
        for texto, x in (("Jugador", 40), ("Nación", 300), ("Equipo", 448), ("Color", 562)):
            lz.texto(texto, x0 + x, yh, fb, P.TINTA_SUAVE)
        lz.linea((x0, yh + 22), (pr.right - 16, yh + 22), (120, 90, 60))
        for k, r in enumerate(sala.get("ranuras", [])):
            y = pr.y + 92 + k * ALTO_FILA
            fila = pygame.Rect(x0, y, pr.w - 32, ALTO_FILA - 4)
            if k == self.yo:
                lz.rect(fila, (226, 206, 160))
            if r["tipo"] in ("humano", "ia"):
                lz.rect((x0 + 6, y + 10, 26, 26), (40, 28, 18))
                lz.rect((x0 + 8, y + 12, 22, 22), P.color_jugador(r["color"]))
                nombre = r["nombre"] or "?"
                lz.texto(nombre, x0 + 40, y + 6, fuentes.negrita(18), P.TINTA)
                if r["tipo"] == "humano":
                    if sala.get("anfitrion") == r["nombre"]:
                        lz.texto("anfitrión", x0 + 40, y + 28, fuentes.cursiva(14), P.TINTA_SUAVE)
                    elif r.get("listo"):
                        lz.texto("✔ listo", x0 + 40, y + 28, fuentes.negrita(14), (40, 120, 40))
                    else:
                        lz.texto("preparándose...", x0 + 40, y + 28, fuentes.cursiva(14), P.ROJO_SELLO)
                tb = self.tex_banderas.get(r["faccion"])
                if tb is not None:
                    lz.dibujar(tb, x0 + 258, y + 12, 36, 23)
            elif r["tipo"] == "abierta":
                lz.texto("— lugar libre —", x0 + 40, y + 14, fuentes.cursiva(17), P.TINTA_SUAVE)
            else:
                lz.texto("— cerrada —", x0 + 40, y + 14, fuentes.cursiva(17), P.GRIS)
        ayuda = ("Los jugadores del mismo equipo son aliados: comparten la visión. "
                 "El anfitrión inicia cuando todos están listos.")
        lz.parrafo(ayuda, x0, pr.bottom - 52, pr.w - 32, fuentes.cursiva(15), P.TINTA_SUAVE)
        # mapa
        pm = self.p_mapa
        est.panel(pm)
        info = self.mapas.get(sala.get("mapa"), {})
        lz.texto(info.get("nombre", sala.get("mapa_nombre", "?")), pm.centerx, pm.y + 12, fuentes.titulo(24),
                 P.TINTA, "centro")
        caja = pygame.Rect(pm.x + 16, pm.y + 50, pm.w - 32, 200)
        if self.tex_mapa is not None:
            esc = min(caja.w / self.tex_mapa.width, caja.h / self.tex_mapa.height)
            w, h = int(self.tex_mapa.width * esc), int(self.tex_mapa.height * esc)
            x, y = caja.x + (caja.w - w) // 2, caja.y + (caja.h - h) // 2
            lz.rect((x - 3, y - 3, w + 6, h + 6), (60, 40, 24))
            lz.dibujar(self.tex_mapa, x, y, w, h)
        lz.parrafo(info.get("descripcion", ""), pm.x + 16, pm.y + 258, pm.w - 32, fuentes.cuerpo(15), P.TINTA,
                   max_lineas=4)
        lz.texto("Velocidad", pm.x + 16, pm.y + 372, fuentes.negrita(16), P.TINTA)
        if not self.anfitrion:
            lz.texto("Solo el anfitrión cambia el mapa.", pm.x + 16, pm.y + 410, fuentes.cursiva(14), P.TINTA_SUAVE)
        est.panel(self.p_chat)
        lz.texto("Conversación de la sala", self.p_chat.x + 16, self.p_chat.y + 10, fuentes.titulo(22), P.TINTA)
        est.panel(self.p_ord, "madera")
        self.dibujar_widgets()
