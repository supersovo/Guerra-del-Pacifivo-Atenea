"""Parte de guerra: resultados y estadísticas de la partida."""

import pygame

from ...servidor import repeticion
from .. import fuentes
from ..graficos import paleta as P
from ..graficos.banderas import superficie_bandera
from ..graficos.paleta import color_jugador
from ..ui.widgets import Boton
from .base import Escena, FondoMenu

COLUMNAS = [
    ("Formadas", "unidades_creadas"), ("Perdidas", "unidades_perdidas"), ("Abatidos", "enemigos_abatidos"),
    ("Obras", "edificios_construidos"), ("Edif. perdidos", "edificios_perdidos"),
    ("Edif. destruidos", "edificios_destruidos"), ("Salitre", "salitre_recolectado"), ("Agua", "agua_recolectada"),
]


class Resultados(Escena):
    def __init__(self, app, fin, est, origen):
        super().__init__(app)
        self.fin = fin or {}
        self.est = est
        self.origen = origen
        self.fondo = FondoMenu(self.lz)
        lz = self.lz
        self.panel = pygame.Rect(40, 130, lz.W - 80, lz.H - 170)
        self.widgets.append(Boton((self.panel.right - 250, self.panel.bottom - 60, 220, 44), "Volver", self.volver,
                                  "principal"))
        self.guardada = None
        # en un servidor de otro equipo la repetición queda allá: se puede pedir una copia
        if origen == "multijugador" and self.fin.get("repeticion") and app.servidor_local is None:
            self.b_rep = Boton((self.panel.right - 560, self.panel.bottom - 60, 290, 44),
                               "Guardar la repetición aquí", self.pedir_repeticion,
                               tooltip=("Repetición", "Descarga del servidor la repetición de esta batalla para "
                                                      "verla después en «Repeticiones»."))
            self.widgets.append(self.b_rep)

    def volver(self):
        if self.origen == "multijugador" and self.app.red is not None:
            from .sala import SalaEspera
            from .lobby import Lobby
            red = self.app.red
            red.enviar({"t": "salas"})
            self.app.cambiar(SalaEspera(self.app) if getattr(self.app, "en_sala", False) else Lobby(self.app))
            return
        from .portada import Portada
        self.app.cambiar(Portada(self.app))

    def pedir_repeticion(self):
        if self.app.red is not None:
            self.app.red.enviar({"t": "pedir_repeticion"})
            self.b_rep.activo = False

    def actualizar(self, dt):
        super().actualizar(dt)
        if self.origen == "multijugador":
            for m in self.mensajes_red():
                t = m.get("t")
                if t == "sala":
                    self.app.sala_actual = m
                    self.app.en_sala = True
                elif t == "lobby":
                    self.app.lobby = m
                elif t == "chat":
                    self.app.anotar_chat(m)
                elif t == "repeticion":
                    try:
                        ruta = repeticion.guardar_datos(m.get("datos") or {}, m.get("nombre"))
                        self.guardada = ruta.stem
                        self.app.avisar("Repetición guardada: puede verla en «Repeticiones».", 6)
                    except (OSError, ValueError, TypeError) as e:
                        self.app.avisar(f"No se pudo guardar la repetición: {e}")
                elif t == "error":
                    self.app.avisar(m.get("msg", "Error"))

    def manejar(self, ev):
        if ev.type == pygame.KEYDOWN and ev.key in (pygame.K_ESCAPE, pygame.K_RETURN):
            self.volver()
            return True
        return super().manejar(ev)

    def dibujar(self):
        lz = self.lz
        self.fondo.dibujar(self.t, titulo=False)
        r = self.panel
        self.ui.estilo.panel(r)
        lz.texto("Parte de guerra", r.centerx, r.y + 14, fuentes.titulo(34), P.TINTA, "centro")
        est = self.est
        gan = self.fin.get("ganador")
        if self.fin.get("abortada"):
            sub = "La partida fue interrumpida."
        elif gan is None:
            sub = "Ninguno de los bandos logró la victoria."
        else:
            nombres = [j["nombre"] for j in est.jugadores if j["equipo"] == gan]
            sub = "Victoria de " + ", ".join(nombres)
        minutos = self.fin.get("ticks", 0) / (16 * 60)
        lz.texto(f"{sub}  ·  {minutos:.1f} minutos  ·  {est.datos_mapa.nombre}", r.centerx, r.y + 60,
                 fuentes.cursiva(19), P.TINTA_SUAVE, "centro")
        x0 = r.x + 30
        y = r.y + 110
        fb = fuentes.negrita(15)
        lz.texto("Jugador", x0 + 40, y, fb, P.TINTA)
        anchos = (r.w - 360) // len(COLUMNAS)
        for k, (titulo, _c) in enumerate(COLUMNAS):
            lz.texto(titulo, x0 + 300 + k * anchos + anchos // 2, y, fb, P.TINTA, "centro")
        lz.linea((x0, y + 24), (r.right - 30, y + 24), (120, 90, 60))
        y += 34
        elos = self.fin.get("elo", {})
        for res in self.fin.get("resultados", []):
            i = res["indice"]
            j = est.jugadores[i] if i < len(est.jugadores) else {"color": 0}
            tb = lz.textura(("bandera", res["faccion"], 36), lambda f=res["faccion"]: superficie_bandera(f, 36, 24))
            lz.dibujar(tb, x0, y)
            col = color_jugador(j["color"])
            lz.rect((x0 + 40, y + 6, 10, 10), col)
            nombre = res["nombre"]
            if res.get("es_ia") and not nombre.startswith("IA"):
                nombre += "  (IA)"
            lz.texto(nombre, x0 + 56, y + 2, fuentes.negrita(17), P.TINTA)
            if gan is not None:
                txt = "Victoria" if res["equipo"] == gan else "Derrota"
                lz.texto(txt, x0 + 56, y + 22, fuentes.cursiva(14),
                         (40, 120, 40) if res["equipo"] == gan else P.ROJO_SELLO)
            elo = elos.get(str(i)) or elos.get(i)
            if elo and elo[0] is not None and elo[1] is not None:
                d = elo[1] - elo[0]
                lz.texto(f"ELO {elo[1]} ({'+' if d >= 0 else ''}{d})", x0 + 160, y + 22, fuentes.cuerpo(14), P.TINTA)
            for k, (_t, campo) in enumerate(COLUMNAS):
                v = res.get("est", {}).get(campo, 0)
                lz.texto(str(v), x0 + 300 + k * anchos + anchos // 2, y + 8, fuentes.cuerpo(17), P.TINTA, "centro")
            y += 48
        if self.fin.get("repeticion"):
            if self.origen == "multijugador" and self.app.servidor_local is None:
                txt = (f"Copia guardada en este equipo: {self.guardada}" if self.guardada else
                       f"Repetición guardada en el servidor: {self.fin['repeticion']}")
            else:
                txt = f"Repetición guardada: {self.fin['repeticion']}"
            lz.texto(txt, x0, r.bottom - 96, fuentes.cursiva(15), P.TINTA_SUAVE)
        self.dibujar_widgets()
