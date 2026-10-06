"""Cuartel general (salón del servidor): salas de espera, partidas en curso,
jugadores conectados, escalafón y conversación general."""

import time

import pygame

from .. import fuentes
from ..graficos import paleta as P
from ..ui.widgets import Boton, Campo, Desplegable, PanelChat, Tabla
from .base import Escena, FondoMenu

NACIONES = ["chile", "peru", "bolivia", "argentina"]
NOMBRE_VELOCIDAD = {"normal": "Normal", "rapida": "Rápida", "muy_rapida": "Muy rápida"}
RESULTADOS = {"victoria": "Victoria", "derrota": "Derrota", "tablas": "Tablas", "abandono": "Abandono"}


class Lobby(Escena):
    def __init__(self, app):
        super().__init__(app)
        self.fondo = FondoMenu(self.lz)
        lz = self.lz
        bien = app.bienvenida or {}
        self.mapas = {m["id"]: m for m in bien.get("mapas", [])}
        self.cab = pygame.Rect(24, 14, lz.W - 48, 62)
        self.p_salas = pygame.Rect(24, 88, 660, 404)
        self.p_der = pygame.Rect(696, 88, lz.W - 720, 404)
        self.p_chat = pygame.Rect(24, 502, lz.W - 48, 202)
        ps = self.p_salas
        self.tabla_salas = Tabla((ps.x + 16, ps.y + 46, ps.w - 32, 200),
                                 [("Sala", 230, "izq"), ("Mapa", 190, "izq"), ("Lugares", 80, "centro"),
                                  ("Estado", 120, "izq")], al_doble=lambda c: self.unirse())
        self.tabla_salas.vacia = "No hay salas abiertas: cree la primera."
        self.tabla_partidas = Tabla((ps.x + 16, ps.y + 284, ps.w - 32, 72),
                                    [("Partida en curso", 220, "izq"), ("Mapa", 190, "izq"),
                                     ("Minutos", 80, "centro")], al_doble=lambda c: self.observar())
        self.tabla_partidas.vacia = "Ninguna batalla en curso."
        bx = ps.x + 16
        by = ps.bottom - 46
        self.widgets += [self.tabla_salas, self.tabla_partidas]
        self.widgets.append(Boton((bx, by, 150, 36), "Crear sala", self.abrir_crear, "principal"))
        self.widgets.append(Boton((bx + 160, by, 130, 36), "Unirse", self.unirse))
        self.widgets.append(Boton((bx + 300, by, 150, 36), "Observar",
                                  self.observar, tooltip=("Observar", "Mirar una batalla en curso como espectador.")))
        self.widgets.append(Boton((bx + 460, by, 168, 36), "Actualizar", self.actualizar_listas, "madera"))
        pd = self.p_der
        self.pestana = "conectados"
        self.botones_pestana = []
        for i, (clave, texto) in enumerate((("conectados", "Conectados"), ("escalafon", "Escalafón"),
                                            ("historial", "Mi historial"))):
            b = Boton((pd.x + 16 + i * 176, pd.y + 14, 168, 32), texto, lambda c=clave: self.elegir_pestana(c))
            b.clave = clave
            self.botones_pestana.append(b)
            self.widgets.append(b)
        self.tablas = {
            "conectados": Tabla((pd.x + 16, pd.y + 56, pd.w - 32, pd.h - 72),
                                [("Jugador", 250, "izq"), ("ELO", 70, "centro"), ("Estado", 160, "izq")]),
            "escalafon": Tabla((pd.x + 16, pd.y + 56, pd.w - 32, pd.h - 72),
                               [("#", 30, "der"), ("Comandante", 160, "izq"), ("ELO", 56, "centro"),
                                ("V", 44, "centro"), ("D", 44, "centro"), ("Abatidos", 80, "centro"),
                                ("Nación", 90, "izq")]),
            "historial": Tabla((pd.x + 16, pd.y + 56, pd.w - 32, pd.h - 72),
                               [("Fecha", 110, "izq"), ("Mapa", 150, "izq"), ("Nación", 80, "izq"),
                                ("Resultado", 90, "izq"), ("ELO", 90, "centro")]),
        }
        self.tablas["escalafon"].vacia = "Nadie ha jugado partidas con cuenta todavía."
        self.tablas["historial"].vacia = ("Juegue con una cuenta (nombre y clave) para llevar su historial."
                                          if bien.get("invitado") else "Todavía no tiene batallas registradas.")
        for t in self.tablas.values():
            t.visible = False
            self.widgets.append(t)
        self.tablas["conectados"].visible = True
        self.chat = PanelChat(self.p_chat.inflate(-32, -54).move(0, 18), app, "general")
        self.widgets.append(self.chat)
        self.widgets.append(Boton((self.cab.right - 170, self.cab.y + 12, 154, 38), "Desconectar", self.desconectar,
                                  "madera"))
        self.dialogo = None
        self.dialogo_widgets = []
        self.ultimo_pedido = 0.0

    def entrar(self):
        self.app.en_sala = False
        self.app.sala_actual = None
        self.actualizar_listas()
        if self.app.lobby:
            self._aplicar_lobby(self.app.lobby)

    # ------------------------------------------------------------------
    def actualizar_listas(self):
        red = self.app.red
        if red is None:
            return
        red.enviar({"t": "salas"})
        if self.pestana in ("escalafon", "historial"):
            red.enviar({"t": self.pestana})
        self.ultimo_pedido = time.monotonic()

    def elegir_pestana(self, clave):
        self.pestana = clave
        for k, t in self.tablas.items():
            t.visible = k == clave
        if clave in ("escalafon", "historial") and self.app.red is not None:
            self.app.red.enviar({"t": clave})

    def _aplicar_lobby(self, m):
        self.app.lobby = m
        filas = []
        for s in m.get("salas", []):
            total = len(s.get("ranuras", []))
            estado = "En combate" if s.get("estado") == "jugando" else (
                "Completa" if s.get("ocupadas", 0) >= total else "Esperando")
            nombre = s["nombre"] + ("  (clave)" if s.get("con_clave") else "")
            col = P.GRIS if s.get("estado") == "jugando" else None
            filas.append((s["id"], [nombre, s.get("mapa_nombre", "?"), f"{s.get('ocupadas', 0)}/{total}", estado], col))
        self.tabla_salas.poner(filas)
        self.tabla_partidas.poner([(p["id"], [" vs ".join(p.get("jugadores", [])), p.get("mapa", "?"),
                                              str(p.get("minutos", 0))]) for p in m.get("partidas", [])])
        yo = (self.app.bienvenida or {}).get("nombre", "")
        con = []
        for c in sorted(m.get("conectados", []), key=lambda c: (c.get("elo") is None, -(c.get("elo") or 0),
                                                                 c.get("nombre", ""))):
            estado = "en combate" if c.get("en_partida") else ("invitado" if c.get("invitado") else "en el salón")
            col = P.ROJO_SELLO if c.get("nombre") == yo else None
            con.append((c["nombre"], [c["nombre"], c.get("elo") or "—", estado], col))
        self.tablas["conectados"].poner(con)

    def _sala(self, sid):
        for s in (self.app.lobby or {}).get("salas", []):
            if s["id"] == sid:
                return s
        return None

    # ------------------------------------------------------------------
    def unirse(self, clave=None):
        sid = self.tabla_salas.sel
        if sid is None:
            self.app.avisar("Elija una sala de la lista.")
            return
        s = self._sala(sid)
        if s is None:
            return
        if s.get("estado") == "jugando":
            self.app.avisar("Esa sala está en combate: puede observar la partida.")
            return
        if s.get("con_clave") and clave is None:
            self._dialogo_clave(sid)
            return
        msg = {"t": "unirse", "sala": sid}
        if clave:
            msg["clave"] = clave
        self.app.red.enviar(msg)

    def observar(self):
        pid = self.tabla_partidas.sel
        if pid is None:
            self.app.avisar("Elija una partida en curso.")
            return
        self.app.red.enviar({"t": "observar", "partida": pid})

    def desconectar(self):
        from .conectar import Conectar
        self.app.cerrar_red()
        self.app.detener_servidor_local()
        self.app.cambiar(Conectar(self.app))

    # -- diálogos ------------------------------------------------------
    def _cerrar_dialogo(self):
        self.dialogo = None
        self.dialogo_widgets = []

    def abrir_crear(self):
        lz = self.lz
        r = pygame.Rect(lz.W // 2 - 260, 150, 520, 380)
        self.dialogo = ("crear", r)
        cfg = self.app.config
        x = r.x + 170
        y = r.y + 70
        nombre = Campo((x, y, 320, 32), f"Sala de {(self.app.bienvenida or {}).get('nombre', '')}", maximo=40)
        mapas = [(k, f"{m['nombre']} ({m['jugadores']})") for k, m in self.mapas.items()]
        mapa_ini = cfg["mapa"] if cfg["mapa"] in self.mapas else (mapas[0][0] if mapas else None)
        mapa = Desplegable((x, y + 48, 320, 32), mapas, mapa_ini)
        vels = (self.app.bienvenida or {}).get("velocidades", ["normal"])
        vel = Desplegable((x, y + 96, 200, 32), [(v, NOMBRE_VELOCIDAD.get(v, v)) for v in vels], "normal")
        fac = Desplegable((x, y + 144, 200, 32), [(n, self.app.cat.facciones[n].nombre) for n in NACIONES],
                          cfg["faccion"] if cfg["faccion"] in NACIONES else "chile")
        clave = Campo((x, y + 192, 200, 32), "", maximo=30, pista="(sin clave)")
        self.campos_crear = {"nombre": nombre, "mapa": mapa, "velocidad": vel, "faccion": fac, "clave": clave}
        crear = Boton((r.right - 200, r.bottom - 58, 176, 42), "Crear sala", self._crear, "principal")
        cancelar = Boton((r.x + 24, r.bottom - 58, 150, 42), "Cancelar", self._cerrar_dialogo, "madera")
        # orden inverso: los desplegables de arriba quedan por encima de los de abajo
        self.dialogo_widgets = [nombre, clave, fac, vel, mapa, crear, cancelar]

    def _crear(self):
        c = self.campos_crear
        if c["mapa"].valor is None:
            self.app.avisar("El servidor no tiene mapas.")
            return
        self.app.config["mapa"] = c["mapa"].valor
        self.app.config["faccion"] = c["faccion"].valor
        self.app.config.guardar()
        self.app.red.enviar({"t": "crear_sala", "nombre": c["nombre"].texto.strip(), "mapa": c["mapa"].valor,
                             "velocidad": c["velocidad"].valor, "faccion": c["faccion"].valor,
                             "clave": c["clave"].texto.strip()})
        self._cerrar_dialogo()

    def _dialogo_clave(self, sid):
        lz = self.lz
        r = pygame.Rect(lz.W // 2 - 220, 220, 440, 200)
        self.dialogo = ("clave", r)
        campo = Campo((r.x + 30, r.y + 76, r.w - 60, 32), "", oculto=True, maximo=30,
                      al_enter=lambda: self._unirse_con(sid, campo.texto))
        campo.foco = True
        self.dialogo_widgets = [campo,
                                Boton((r.right - 170, r.bottom - 56, 146, 40), "Entrar",
                                      lambda: self._unirse_con(sid, campo.texto), "principal"),
                                Boton((r.x + 24, r.bottom - 56, 130, 40), "Cancelar", self._cerrar_dialogo, "madera")]

    def _unirse_con(self, sid, clave):
        self._cerrar_dialogo()
        self.unirse(clave or "")

    # ------------------------------------------------------------------
    def actualizar(self, dt):
        super().actualizar(dt)
        for w in self.dialogo_widgets:
            w.actualizar(dt)
        for m in self.mensajes_red():
            t = m.get("t")
            if t == "lobby":
                self._aplicar_lobby(m)
            elif t == "sala":
                self.app.sala_actual = m
                self.app.en_sala = True
                from .sala import SalaEspera
                self.app.cambiar(SalaEspera(self.app))
                return
            elif t == "inicio":
                from .juego import Juego
                self.app.cambiar(Juego(self.app, m, "multijugador"))
                return
            elif t == "chat":
                self.app.anotar_chat(m)
            elif t == "escalafon":
                filas = []
                for i, f in enumerate(m.get("filas", [])):
                    fac = f.get("faccion_favorita")
                    nfac = self.app.cat.facciones[fac].nombre if fac in self.app.cat.facciones else "—"
                    filas.append((f["nombre"], [i + 1, f["nombre"], f.get("elo", ""), f.get("victorias", 0),
                                                f.get("derrotas", 0), f.get("abatidos", 0), nfac]))
                self.tablas["escalafon"].poner(filas)
            elif t == "historial":
                filas = []
                for f in m.get("filas", []):
                    fecha = time.strftime("%d/%m %H:%M", time.localtime(f.get("inicio") or 0))
                    mapa = self.mapas.get(f.get("mapa"), {}).get("nombre", f.get("mapa", "?"))
                    fac = f.get("faccion")
                    nfac = self.app.cat.facciones[fac].nombre if fac in self.app.cat.facciones else "?"
                    ea, ed = f.get("elo_antes"), f.get("elo_despues")
                    elo = f"{ed} ({ed - ea:+d})" if ea is not None and ed is not None else "—"
                    res = f.get("resultado", "")
                    col = (40, 120, 40) if res == "victoria" else (P.ROJO_SELLO if res == "derrota" else None)
                    filas.append((f["id"], [fecha, mapa, nfac, RESULTADOS.get(res, res), elo], col))
                self.tablas["historial"].poner(filas)
            elif t in ("error", "expulsado", "aviso"):
                self.app.avisar(m.get("msg", "Error"), 8)
        if time.monotonic() - self.ultimo_pedido > 15:
            self.actualizar_listas()

    def manejar(self, ev):
        if self.dialogo is not None:
            if ev.type == pygame.KEYDOWN and ev.key == pygame.K_ESCAPE:
                self._cerrar_dialogo()
                return True
            for w in self.dialogo_widgets:
                if getattr(w, "abierto", False) and w.manejar(ev):
                    return True
            for w in self.dialogo_widgets:
                if w.manejar(ev):
                    return True
            return True   # el diálogo es modal
        if ev.type == pygame.KEYDOWN and ev.key == pygame.K_ESCAPE and not self.chat.campo.foco:
            self.desconectar()
            return True
        return super().manejar(ev)

    # ------------------------------------------------------------------
    def dibujar(self):
        lz = self.lz
        self.fondo.dibujar(self.t, titulo=False, velo=120)
        est = self.ui.estilo
        bien = self.app.bienvenida or {}
        est.panel(self.cab, "madera")
        lz.texto(f"Cuartel general · {bien.get('servidor', 'Servidor')}", self.cab.x + 20, self.cab.y + 10,
                 fuentes.titulo(28), P.CREMA, sombra=(0, 0, 0))
        u = bien.get("usuario")
        if u:
            sub = (f"{bien.get('nombre', '')}  ·  ELO {u.get('elo')}  ·  {u.get('victorias', 0)} victorias, "
                   f"{u.get('derrotas', 0)} derrotas")
        else:
            sub = f"{bien.get('nombre', '')} (invitado: sus partidas no suman al escalafón)"
        lz.texto(sub, self.cab.right - 190, self.cab.y + 20, fuentes.cuerpo(17), P.BRONCE_CLARO, "der")
        est.panel(self.p_salas)
        lz.texto("Salas de espera", self.p_salas.x + 16, self.p_salas.y + 12, fuentes.titulo(24), P.TINTA)
        lz.texto("Doble clic para entrar", self.p_salas.right - 16, self.p_salas.y + 18, fuentes.cursiva(15),
                 P.TINTA_SUAVE, "der")
        s = self._sala(self.tabla_salas.sel) if self.tabla_salas.sel is not None else None
        yd = self.p_salas.y + 252
        if s is not None:
            ocup = [r["nombre"] or "?" for r in s.get("ranuras", []) if r["tipo"] in ("humano", "ia")]
            txt = (f"Anfitrión: {s.get('anfitrion', '?')}  ·  velocidad {NOMBRE_VELOCIDAD.get(s.get('velocidad'), '?')}"
                   f"  ·  en la sala: {', '.join(ocup)}")
            lz.texto(txt, self.p_salas.x + 18, yd + 4, fuentes.cuerpo(15), P.TINTA_SUAVE)
        else:
            lz.texto("Batallas en curso (doble clic para observar):", self.p_salas.x + 18, yd + 4,
                     fuentes.cursiva(15), P.TINTA_SUAVE)
        est.panel(self.p_der)
        for b in self.botones_pestana:
            if b.clave == self.pestana:
                lz.marco(b.rect.inflate(4, 4), P.ROJO_SELLO, 2)
        est.panel(self.p_chat)
        lz.texto("Conversación general", self.p_chat.x + 16, self.p_chat.y + 10, fuentes.titulo(22), P.TINTA)
        self.dibujar_widgets()
        if self.dialogo is not None:
            self._dibujar_dialogo()

    def _dibujar_dialogo(self):
        lz = self.lz
        tipo, r = self.dialogo
        lz.rect((0, 0, lz.W, lz.H), (0, 0, 0), 140)
        self.ui.estilo.panel(r)
        if tipo == "crear":
            lz.texto("Nueva sala de espera", r.centerx, r.y + 16, fuentes.titulo(28), P.TINTA, "centro")
            f = fuentes.negrita(17)
            for i, t in enumerate(("Nombre", "Mapa", "Velocidad", "Su nación", "Clave")):
                lz.texto(t, r.x + 30, r.y + 76 + i * 48, f, P.TINTA)
        else:
            lz.texto("Sala con clave", r.centerx, r.y + 16, fuentes.titulo(28), P.TINTA, "centro")
            lz.texto("Escriba la clave que le dio el anfitrión:", r.x + 30, r.y + 52, fuentes.cuerpo(16), P.TINTA)
        for w in reversed(self.dialogo_widgets):
            w.dibujar(self.ui)
