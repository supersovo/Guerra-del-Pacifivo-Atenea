"""Escena de batalla: vista del mapa, panel de mando y órdenes.

Controles (como en StarCraft/WarCraft):
  clic izquierdo / arrastrar   seleccionar (Mayús: agregar o quitar; doble clic: todos los del tipo)
  clic derecho                 orden inteligente: mover, atacar, recolectar, reparar, embarcar...
  A + clic                     atacar avanzando (o atacar un blanco)
  letras                       atajos de la tarjeta de órdenes
  Ctrl+1..9 / 1..9             crear / llamar grupos (doble pulsación: centrar la cámara)
  F1 trabajador ocioso · F2 todo el ejército · Espacio último aviso · Alt barras de vida
  Enter chat (Mayús+Enter: al equipo) · F10 menú · rueda: acercar/alejar · F12 captura
"""

import time

import pygame

from ...contenido import nombres
from ...red import instantanea as I
from .. import fuentes
from ..graficos import paleta as P
from ..graficos.paleta import color_jugador
from ..juego.camara import Camara
from ..juego.estado import EstadoJuego
from ..juego.tarjeta import tarjeta
from ..juego.vista import Vista, tam_sprite
from ..sonido import sonido
from ..ui.controles_sonido import ControlesSonido
from ..ui.hud import ALTO_INF, ALTO_SUP, HUD
from ..ui.widgets import MOD_CTRL, Boton
from .base import Escena

TECLAS_GRUPO = {getattr(pygame, f"K_{k}"): k for k in range(10)}
DOBLE_CLIC = 0.35
# franja junto al borde de la imagen, en píxeles de la ventana, donde el ratón mueve la cámara
MARGEN_BORDE = 6


def grupo_voz(tipo):
    """Qué voces le tocan a una unidad al seleccionarla o al darle una orden."""
    if tipo.id in ("trabajador", "cantinera", "espia"):
        return tipo.id
    if getattr(tipo, "monta", None):
        return "ambulancia"
    if tipo.sprite.get("forma") == "heroina":
        return "heroina"
    if tipo.clase in ("caballeria", "artilleria", "naval"):
        return tipo.clase
    return "infanteria"


class _Origen:
    """Punto de donde sale un disparo cuando el tirador no está a la vista (guarnecido)."""
    __slots__ = ("x", "y", "ultimo_disparo")

    def __init__(self, x, y):
        self.x, self.y = x, y
        self.ultimo_disparo = 0.0


class Juego(Escena):
    musica = "campana"          # tambores y bronces de campaña, por debajo del fuego

    def __init__(self, app, inicio, origen="multijugador", info=None):
        super().__init__(app)
        self.origen = origen
        self.info = info or {}
        self.local = origen in ("escaramuza", "repeticion")
        self.est = EstadoJuego(app.cat, inicio)
        lz = self.lz
        vista_rect = pygame.Rect(0, ALTO_SUP, lz.W, lz.H - ALTO_SUP - ALTO_INF + 6)
        self.cam = Camara(vista_rect, self.est.mapa.w * 32, self.est.mapa.h * 32)
        self.vista = Vista(lz, self.est, app.cat)
        self.hud = HUD(self)
        self.seleccion = []
        self.grupos = {}
        self.modo = None
        self.submenu = None
        self.botones = []
        self.arrastre = None
        self.arrastre_mini = False
        self.paneo = None
        self.chat = None
        self.chat_equipo = False
        self.menu = None
        self.fin = None
        self.ultimo_aviso = None
        self.ultimo_grupo = (None, 0.0)
        self.ultimo_clic = (None, 0.0)
        self.marcas_orden = []
        self.centrado = False
        self.pausa = False
        self.velocidad_rep = 1.0
        self.rendicion_confirmar = False
        self.hud.mensaje(f"Mapa: {self.est.datos_mapa.nombre}", P.BRONCE_CLARO)
        if not self.est.espectador:
            f = self.est.facciones[self.est.yo]
            self.hud.mensaje(f"Usted manda el {f.ejercito}. ¡Buena suerte, mi comandante!", P.CREMA)
            if not inicio.get("repeticion"):
                como = ("en tren, por el ramal del ferrocarril" if self.est.datos_mapa.llegada == "tren"
                        else "en carreta, por el camino")
                self.hud.mensaje(f"El cuartel general viene {como}.", P.BRONCE_CLARO, 9)
        else:
            self.hud.mensaje("Modo espectador: todo el mapa a la vista. +/- cambia la velocidad.", P.CREMA)

    # ------------------------------------------------------------------
    # Red y eventos
    def actualizar(self, dt):
        super().actualizar(dt)
        for m in self.mensajes_red():
            t = m.get("t")
            if t == "inst":
                self.est.aplicar(m)
            elif t == "chat":
                pref = "[Equipo] " if m.get("canal") == "equipo" else ""
                col = color_jugador(m["color"]) if m.get("color", -1) >= 0 else P.CREMA
                self.hud.mensaje(f"{pref}{m['de']}: {m['texto']}", col, 12)
            elif t == "aviso":
                self.hud.mensaje(m["msg"], P.BRONCE_CLARO, 10)
            elif t == "error":
                self.hud.mensaje(m["msg"], (240, 110, 90))
            elif t == "pausa":
                self.pausa = m.get("valor", False)
            elif t == "fin":
                self._fin(m)
            elif t == "inicio":
                self.app.cambiar(Juego(self.app, m, self.origen, self.info))
                return
            elif t == "sala":
                # al terminar, el servidor devuelve a los jugadores a su sala de espera
                self.app.sala_actual = m
                self.app.en_sala = True
            elif t == "lobby":
                self.app.lobby = m
        est = self.est
        est.interpolar()
        self.vista.efx.sangre = self.app.config["sangre"]
        if est.actualizar_vision():
            self.vista.actualizar_niebla()
        if not self.centrado and est.ents:
            self._centrar_inicio()
        for ev in est.tomar_eventos():
            self._evento(ev)
        self.vista.efx.actualizar(dt)
        self.seleccion = [i for i in self.seleccion if i in est.ents and not est.ents[i].fantasma]
        self.botones = tarjeta(est, self.seleccion, self.submenu) if not est.espectador else []
        if self.submenu and not any(b for b in self.botones):
            self.submenu = None
        # el puntero no sale de la ventana durante la batalla; en el menú queda libre
        self.lz.encerrar_raton(self.app.config["encerrar_raton"] and self.menu is None and self.fin is None)
        self._desplazar(dt)
        ahora = time.monotonic()
        self.marcas_orden = [mk for mk in self.marcas_orden if mk[3] > ahora]

    def salir(self):
        super().salir()
        self.lz.encerrar_raton(False)

    def _centrar_inicio(self):
        est = self.est
        if est.espectador:
            self.centrado = True
            self.cam.centrar(est.mapa.w * 16, est.mapa.h * 16)
            return
        # los recursos se conocen desde el inicio: se espera a ver el propio cuartel general
        # (o el tren o la carreta que lo trae, mirando el lugar donde se levantará)
        for e in est.ents.values():
            if e.dueno == est.yo and e.es_edificio:
                self.centrado = True
                self.cam.centrar(e.x, e.y)
                return
            if e.dueno == est.yo and e.t == I.TIPO_CONVOY and isinstance(e.ex, dict) and "d" in e.ex:
                self.centrado = True
                self.cam.centrar(*e.ex["d"])
                return

    def _nombre(self, dueno, idx):
        tipo = self.est.tipo_por_idx(idx)
        if tipo is None:
            return "?"
        f = self.est.faccion(dueno)
        return self.app.cat.nombre(f.id if f else "chile", tipo.id)

    def _evento(self, ev):
        est = self.est
        efx = self.vista.efx
        snd = sonido()
        cam = (*self.cam.centro(), self.cam.vista.w / self.cam.zoom)
        k = ev[1]
        if k == "dis":
            a = est.ents.get(ev[2])
            o = est.ents.get(ev[3])
            tipo = ev[4]
            if a is None and len(ev) > 7 and o is not None:
                # dispara un soldado guarnecido: el fogonazo sale de su puesto en la trinchera o el techo
                b = est.ents.get(ev[6])
                if b is not None and b.tipo is not None and b.tipo.guarnicion:
                    x, y = self.vista.disparo_en_puesto(b, ev[7], o.x, o.y)
                    a = _Origen(x, y)
            if a is not None and o is not None:
                a.ultimo_disparo = time.monotonic()
                if tipo != "sable":
                    efx.disparo(a.x, a.y, o.x - a.x, o.y - a.y, tipo)
                    if not ev[5]:
                        efx.impacto(o.x + (ev[3] * 7) % 9 - 4, o.y - 6)
                nombre = {"fusil": "fusil", "metralla": "gatling", "sable": "sable"}.get(tipo, "fusil")
                snd.en_mapa(nombre, a.x, a.y, cam, minimo_ms=60 if nombre == "fusil" else 120,
                            volumen=0.5 if nombre == "fusil" else 0.7)
        elif k == "pro":
            a = est.ents.get(ev[2])
            x0, y0, x1, y1, vuelo, tipo = ev[3], ev[4], ev[5], ev[6], ev[7], ev[8]
            if a is None and len(ev) > 10:
                b = est.ents.get(ev[9])
                if b is not None and b.tipo is not None and b.tipo.guarnicion:
                    x0, y0 = self.vista.disparo_en_puesto(b, ev[10], x1, y1)
            dur = vuelo / (16 * est.inicio.get("velocidad", 1.0) * (self.velocidad_rep if est.inicio.get("repeticion") else 1))
            efx.lanzar(x0, y0 - 8, x1, y1, max(0.1, dur), tipo)
            if tipo != "dinamita":
                efx.disparo(x0, y0, x1 - x0, y1 - y0, tipo)
                snd.en_mapa("canon", x0, y0, cam, minimo_ms=150, volumen=0.8)
            if a is not None:
                a.ultimo_disparo = time.monotonic()
        elif k == "exp":
            x, y, radio, tipo = ev[2], ev[3], ev[4], ev[5]
            efx.explosion(x, y, max(16, radio), tipo)
            snd.en_mapa("explosion", x, y, cam, minimo_ms=90)
        elif k == "mue":
            idx, dueno, x, y = ev[3], ev[4], ev[5], ev[6]
            explosion = len(ev) > 7 and bool(ev[7])
            tipo = est.tipo_por_idx(idx)
            if tipo is None:
                return
            if tipo.es_edificio:
                for dx in (-20, 0, 20):
                    efx.explosion(x + dx, y + (dx // 3), 30)
                snd.en_mapa("explosion", x, y, cam, minimo_ms=60)
            else:
                f = est.faccion(dueno)
                if f is None:
                    return
                grado = ev[8] if len(ev) > 8 else 0
                if grado and dueno == est.yo:
                    # cayó un veterano propio: su experiencia se pierde
                    quien = nombres.nombre(est.cat, f.id, tipo, grado, ev[9]) or self._nombre(dueno, idx)
                    self.hud.mensaje(f"Cayó {quien} ({est.cat.veterania.grados[grado].nombre}).", (230, 120, 90), 6)
                    snd.voz("veterano_caido", 2)
                if tipo.biologica and explosion and efx.sangre:
                    # artillería, dinamita o mina: el cuerpo vuela en pedazos
                    efx.despedazar(x, y - 6, [f.uniforme.get("casaca", (90, 90, 90)),
                                              f.uniforme.get("pantalon", (90, 90, 90))])
                    return
                tex = self.vista.sprites.caido(tipo, f, color_jugador(est.jugadores[dueno]["color"]))
                efx.caido(tex, x, y - 4, bool(ev[2] % 2))
                if tipo.biologica:
                    efx.herida(x, y - 8)
                    efx.charco(x, y + 2)
        elif k == "herido":
            # cae herido: queda en el suelo (lo dibuja la vista) y espera a los camilleros
            x, y = ev[6], ev[7]
            efx.herida(x, y - 8)
            efx.charco(x, y + 2, 0.9, 40.0)
            grado = ev[8] if len(ev) > 8 else 0
            tipo = est.tipo_por_idx(ev[4])
            if grado and ev[5] == est.yo and tipo is not None:
                f = est.faccion(ev[5])
                quien = nombres.nombre(est.cat, f.id, tipo, grado, ev[9]) if f else ""
                self.hud.mensaje(f"¡Herido {quien or self._nombre(ev[5], ev[4])}! Los camilleros van primero por "
                                 "los veteranos.", (240, 160, 90), 6)
                snd.voz("herido_veterano", 2)
        elif k == "ascenso":
            # un veterano sube de grado: galones dorados sobre él y, si es propio, su voz
            o = est.ents.get(ev[2])
            grado, idx, dueno = ev[3], ev[4], ev[5]
            if o is not None and o.tipo is not None:
                efx.ascenso(o.x, o.y - tam_sprite(o.tipo)[3] + 4, grado)
            if dueno == est.yo:
                tipo = est.tipo_por_idx(idx)
                f = est.faccion(dueno)
                quien = ""
                if o is not None and tipo is not None and f is not None:
                    quien = nombres.nombre(est.cat, f.id, tipo, grado, (o.ex or {}).get("n", 0))
                g = est.cat.veterania.grados[grado].nombre
                self.hud.mensaje(f"¡Ascenso! {self._nombre(dueno, idx)}: {g}" + (f" — {quien}" if quien else ""),
                                 (240, 206, 90), 5)
                snd.voz([f"ascenso_{grado}"], 2)
        elif k == "recogido":
            o = est.ents.get(ev[3])
            if o is not None:
                efx.polvo_marcha(o.x, o.y)
        elif k == "ingresa":
            o = est.ents.get(ev[2])
            if o is not None:
                efx.curacion(o.x, o.y - 10)
        elif k == "llegada":
            # el tren o la carreta llegó: se levanta el cuartel general y salen los trabajadores
            o = est.ents.get(ev[2])
            if o is not None:
                for kk in range(12):
                    efx.polvo_obra(o.x + (kk % 4 - 1.5) * 26, o.y + (kk // 4 - 1) * 18)
                if o.dueno == est.yo:
                    self.hud.mensaje("¡Llegó el cuartel general! Los trabajadores salen a la faena.", P.CREMA, 6)
                    snd.voz("llegada", 2)
            snd.en_mapa("silbato" if ev[4] == "tren" else "martillo", o.x if o else 0, o.y if o else 0, cam,
                        minimo_ms=400, volumen=0.8)
        elif k == "recuperado":
            o = est.ents.get(ev[2])
            if o is not None:
                for kk in range(6):
                    efx.curacion(o.x + (kk - 3) * 8, o.y - 6)
                if o.dueno == est.yo:
                    donde = "en la ambulancia" if o.es_unidad else "en el hospital"
                    self.hud.mensaje(f"Vuelve a filas, curado {donde}: {self._nombre(est.yo, ev[4])}",
                                     (150, 220, 140), 4)
                    snd.voz("recuperado", 0)
        elif k == "monta":
            # la ambulancia levantó las carpas: lo que se tenía seleccionado sigue seleccionado
            self._reemplazar(ev[2], ev[3])
            o = est.ents.get(ev[3])
            if o is not None:
                for kk in range(8):
                    efx.polvo_obra(o.x + (kk % 4 - 1.5) * 14, o.y + (kk // 4) * 12)
        elif k == "desmontando":
            o = est.ents.get(ev[2])
            if o is not None:
                snd.en_mapa("martillo", o.x, o.y, cam, minimo_ms=300, volumen=0.5)
                if o.dueno == est.yo:
                    snd.voz("desmontar_ambulancia", 1)
        elif k == "desmonta":
            # el hospital de sangre vuelve a ser ambulancia, con sus convalecientes en el carro
            self._reemplazar(ev[2], ev[3])
            o = est.ents.get(ev[3])
            if o is not None:
                for kk in range(6):
                    efx.polvo_marcha(o.x + (kk - 3) * 6, o.y)
                if o.dueno == est.yo:
                    self.hud.mensaje("Carpas al carro: la ambulancia está lista para seguir a la tropa.",
                                     P.CREMA, 4)
        elif k == "carga":
            o = est.ents.get(ev[2])
            if o is not None:
                snd.en_mapa("sable", o.x, o.y, cam, minimo_ms=200)
                for _ in range(4):
                    efx.polvo_marcha(o.x, o.y)
        elif k == "cura":
            o = est.ents.get(ev[3])
            if o is not None:
                efx.curacion(o.x, o.y)
        elif k == "venta":
            # el cuartel general compra el salitre: sale un $ dorado sobre el techo
            o = est.ents.get(ev[2])
            if o is not None and o.tipo is not None:
                efx.venta(o.x, o.y - o.tipo.alto * 16 - 18)
        elif k == "repara":
            o = est.ents.get(ev[3])
            if o is not None:
                snd.en_mapa("martillo", o.x, o.y, cam, minimo_ms=300, volumen=0.4)
        elif k == "obra":
            o = est.ents.get(ev[2])
            if o is not None:
                snd.en_mapa("martillo", o.x, o.y, cam, minimo_ms=300, volumen=0.5)
        elif k == "fin_obra":
            tipo = est.tipo_por_idx(ev[3])
            if tipo is not None and getattr(tipo, "desmonta_en", None):
                self.hud.mensaje(f"{self._nombre(est.yo, ev[3])} montado: los camilleros salen a buscar "
                                 "a los heridos.", P.BRONCE_CLARO)
                if not snd.voz("hospital_montado", 2):
                    snd.toque("obra")
            else:
                self.hud.mensaje(f"Obra terminada: {self._nombre(est.yo, ev[3])}", P.BRONCE_CLARO)
                if not snd.voz("obra", 2):
                    snd.toque("obra")
        elif k == "lista":
            # la unidad recién formada se presenta con su voz (o, sin voces, el toque de corneta)
            self.hud.mensaje(f"Lista: {self._nombre(est.yo, ev[3])}", P.CREMA, 4)
            tipo = est.tipo_por_idx(ev[3])
            if tipo is None or not snd.voz(["lista_" + tipo.id, "lista"], 2):
                snd.toque("lista")
        elif k == "investigado":
            m = list(est.cat.mejoras.values())[ev[2]]
            self.hud.mensaje(f"Investigación completa: {m.nombre}", P.BRONCE_CLARO)
            if not snd.voz("investigado", 2):
                snd.toque("investigado")
        elif k == "pob":
            self.hud.mensaje("Hace falta otro Depósito de Intendencia para mantener más tropa.", (240, 180, 90))
            snd.voz("pob", 2)
        elif k == "ata":
            x, y = ev[2], ev[3]
            self.ultimo_aviso = (x, y)
            self.hud.ping(x, y)
            txt = "¡Atacan a nuestros trabajadores!" if ev[4] else "¡Nuestras tropas están bajo ataque!"
            self.hud.mensaje(txt + " (Espacio para ir)", (240, 110, 90))
            if not snd.voz("ataque_trabajadores" if ev[4] else "ataque_tropas", 3):
                snd.toque("ataque")
        elif k == "err":
            self.hud.mensaje(ev[2], (240, 110, 90), 4)
            falta = ev[2].startswith("Falta")
            if not (falta and snd.voz("falta_agua" if ev[2].startswith("Falta agua") else "falta_dinero", 2)):
                snd.ui("clic")
        elif k == "revela":
            est.revelar(ev[2], ev[3], ev[4])
            self.hud.ping(ev[2], ev[3], (90, 160, 240))
        elif k == "hab":
            c = est.ents.get(ev[2])
            if c is not None:
                h = est.cat.habilidades.get(ev[3])
                if h is not None and h.tipo in ("potenciar_area", "potenciar_propio", "curar_area"):
                    for kk in range(10):
                        if h.tipo == "curar_area":
                            efx.curacion(c.x + (kk - 5) * 6, c.y)
                        else:
                            efx.polvo_obra(c.x, c.y)
                    if est.aliado(c.dueno):
                        self.hud.mensaje(h.nombre, P.BRONCE_CLARO, 3)
                    snd.toque("lista")
        elif k == "sabotaje":
            o = est.ents.get(ev[2])
            if o is not None:
                for _ in range(6):
                    efx.humo_incendio(o.x, o.y)
                if o.dueno == est.yo:
                    self.hud.mensaje("¡Sabotaje! Un edificio quedó paralizado.", (240, 110, 90))
        elif k == "carga_puesta":
            o = est.ents.get(ev[2])
            if o is not None:
                efx.disparo(o.x, o.y, 0, -1, "dinamita")
        elif k == "senal":
            p, x, y = ev[2], ev[3], ev[4]
            col = color_jugador(est.jugadores[p]["color"])
            self.hud.ping(x, y, col, 5)
            self.marcas_orden.append((x, y, col, time.monotonic() + 3))
            self.hud.mensaje(f"{est.jugadores[p]['nombre']} marcó un punto en el mapa.", col, 4)
            snd.ui("clic")
        elif k == "derrota":
            p = ev[2]
            nombre = est.jugadores[p]["nombre"]
            self.hud.mensaje(f"{nombre} ha sido derrotado.", (240, 180, 90), 10)
        elif k == "agotado":
            pass
        elif k == "pozo_agotado":
            self.hud.mensaje("Un pozo se agotó: el molino rendirá muy poca agua.", (240, 180, 90))
        elif k == "emplaza":
            o = est.ents.get(ev[2])
            if o is not None:
                efx.polvo_obra(o.x, o.y)

    def _fin(self, m):
        est = self.est
        self.fin = m
        mi_equipo = est.equipos[est.yo] if not est.espectador else None
        if m.get("abortada"):
            titulo = "Partida interrumpida"
        elif m.get("ganador") is None:
            titulo = "Tablas"
        elif est.espectador:
            gan = [j["nombre"] for j in est.jugadores if j["equipo"] == m["ganador"]]
            titulo = "Victoria de " + ", ".join(gan)
        elif m["ganador"] == mi_equipo:
            titulo = "¡Victoria!"
            sonido().toque("victoria")
            sonido().voz("victoria", 3)
        else:
            titulo = "Derrota"
            sonido().toque("derrota")
            sonido().voz("derrota", 3)
        self.fin_titulo = titulo
        if self.origen == "campana" and not est.espectador:
            self._anotar_campana(m, mi_equipo)
        lz = self.lz
        self.widgets = [Boton((lz.W // 2 - 110, lz.H // 2 + 50, 220, 44), "Ver el parte de guerra",
                              self._ir_resultados, "principal")]
        if self.origen == "escaramuza" and not est.espectador:
            res = "tablas" if m.get("ganador") is None else ("victoria" if m["ganador"] == mi_equipo else "derrota")
            yo = next((r for r in m["resultados"] if r["indice"] == est.yo), None)
            try:
                self.app.perfil.registrar_escaramuza(
                    est.datos_mapa.id, est.facciones[est.yo].id,
                    ", ".join(f"{r['faccion']}/{r.get('dificultad', '')}" for r in self.info.get("rivales", [])),
                    res, round(m.get("ticks", 0) / 16 / 60, 1),
                    yo["est"]["enemigos_abatidos"] if yo else 0, yo["est"]["unidades_perdidas"] if yo else 0)
            except Exception:  # noqa: BLE001 - el perfil local nunca debe interrumpir el juego
                pass

    def _anotar_campana(self, m, mi_equipo):
        """Campaña: los veteranos sobrevivientes forman el nuevo escalafón (se guarda al instante)."""
        from ...contenido import campanas as mod_campanas
        perfil = self.app.perfil
        cid = self.info.get("campana_id")
        campana = mod_campanas.cargar().get(self.info.get("campana", "salitre"))
        estado = perfil.campana(cid) if cid is not None else None
        if campana is None or estado is None or estado.get("terminada"):
            return
        res = {r["indice"]: r for r in m.get("resultados", [])}
        propio = res.get(self.est.yo)
        rival = next((r for i, r in res.items() if i != self.est.yo and r.get("es_ia")), None)
        victoria = not m.get("abortada") and m.get("ganador") is not None and m.get("ganador") == mi_equipo
        try:
            self.app.resumen_campana = mod_campanas.aplicar_batalla(
                self.app.cat, campana, estado, propio, rival, victoria, m.get("ticks", 0) / 16 / 60)
            perfil.guardar_campana(cid, estado)
        except Exception:  # noqa: BLE001 - el perfil local nunca debe interrumpir el juego
            self.app.resumen_campana = None

    def _ir_resultados(self):
        from .resultados import Resultados
        self.app.cambiar(Resultados(self.app, self.fin, self.est, self.origen))

    # ------------------------------------------------------------------
    # Órdenes
    def enviar(self, cmd):
        if self.est.espectador or self.app.red is None:
            return
        self.app.red.comando(cmd)

    def _ids_unidades_propias(self):
        est = self.est
        return [i for i in self.seleccion if i in est.ents and est.propio(est.ents[i]) and est.ents[i].es_unidad]

    def _ids_edificios_propios(self):
        est = self.est
        return [i for i in self.seleccion if i in est.ents and est.propio(est.ents[i]) and est.ents[i].es_edificio]

    def activar_boton(self, b, cola=False):
        if b is None or not b.activo:
            if b is not None and b.falta:
                self.hud.mensaje(f"{b.texto}: requiere {b.falta}" if b.falta not in ("en curso",) else
                                 f"{b.texto}: {b.falta}", (240, 110, 90), 3)
            return
        sonido().ui("clic")
        a = b.accion
        unidades = self._ids_unidades_propias()
        edificios = self._ids_edificios_propios()
        if a == "menu":
            self.submenu = b.dato
            self.modo = None
        elif a == "orden":
            cmd = dict(b.dato)
            cmd["u"] = unidades + (edificios if cmd["c"] in ("habilidad", "descargar") else [])
            if cmd["c"] == "replegar" and unidades:
                sonido().voz("replegar", 1)
            cmd["e"] = edificios
            if cmd["c"] == "cancelar" and edificios:
                cmd["e"] = edificios[:1]
            cmd["cola"] = cola
            self.enviar(cmd)
            self.submenu = None
        elif a == "objetivo":
            self.modo = ("objetivo", b.clave, b.dato)
        elif a == "construir":
            self.modo = ("construir", b.clave, b.dato)
        elif a == "entrenar":
            n = 5 if pygame.key.get_mods() & pygame.KMOD_SHIFT else 1
            self.enviar({"c": "entrenar", "e": edificios, "t": b.dato, "n": n})
        elif a == "investigar":
            self.enviar({"c": "investigar", "e": edificios, "m": b.dato})

    def _orden_objetivo(self, mx, my, ent, cola):
        _tipo, clave, dato = self.modo
        unidades = self._ids_unidades_propias()
        edificios = self._ids_edificios_propios()
        px, py = int(mx), int(my)
        t = ent.id if ent is not None else None
        color = (90, 230, 90)
        momento = {"mover": "mover", "patrullar": "mover", "descargar": "mover", "atacar": "atacar",
                   "recolectar": "trabajar", "reparar": "trabajar"}.get(dato)
        if momento is not None and unidades:
            self._voz_de_tropa(momento, unidades)
        if dato == "mover":
            self.enviar({"c": "mover", "u": unidades, "x": px, "y": py, "cola": cola})
        elif dato == "atacar":
            if ent is not None and not self.est.aliado(ent.dueno) and not ent.es_recurso:
                self.enviar({"c": "atacar", "u": unidades, "t": t, "x": px, "y": py, "cola": cola})
            else:
                self.enviar({"c": "atacar_mover", "u": unidades, "x": px, "y": py, "cola": cola})
            color = (230, 70, 60)
        elif dato == "patrullar":
            self.enviar({"c": "patrullar", "u": unidades, "x": px, "y": py, "cola": cola})
        elif dato == "recolectar":
            if ent is not None:
                self.enviar({"c": "recolectar", "u": unidades, "t": t, "cola": cola})
        elif dato == "reparar":
            if ent is not None:
                self.enviar({"c": "reparar", "u": unidades, "t": t, "cola": cola})
        elif dato == "descargar":
            self.enviar({"c": "descargar", "u": unidades, "x": px, "y": py, "cola": cola})
        elif dato == "reunion":
            self.enviar({"c": "reunion", "e": edificios, "x": px, "y": py, "t": t})
            color = (240, 220, 90)
        elif isinstance(dato, str) and dato.startswith("hab:"):
            self.enviar({"c": "habilidad", "u": unidades + edificios, "h": dato[4:], "x": px, "y": py, "t": t,
                         "cola": cola})
            color = (240, 200, 90)
        self.marcas_orden.append((mx, my, color, time.monotonic() + 0.6))

    def _orden_derecha(self, mx, my, ent, cola):
        est = self.est
        unidades = self._ids_unidades_propias()
        edificios = self._ids_edificios_propios()
        if unidades:
            cmd = {"c": "inteligente", "u": unidades, "x": int(mx), "y": int(my), "cola": cola}
            color = (90, 230, 90)
            momento = "mover"
            if ent is not None and (not ent.fantasma or ent.es_recurso or ent.es_edificio):
                cmd["t"] = ent.id
                if not est.aliado(ent.dueno) and not ent.es_recurso:
                    color = (230, 70, 60)
                    momento = "atacar"
                elif ent.es_recurso or ent.es_edificio:
                    momento = "trabajar"
            self.enviar(cmd)
            self._voz_de_tropa(momento, unidades)
            self.marcas_orden.append((mx, my, color, time.monotonic() + 0.6))
            sonido().ui("clic")
        elif edificios:
            self.enviar({"c": "reunion", "e": edificios, "x": int(mx), "y": int(my),
                         "t": ent.id if ent is not None else None})
            self.marcas_orden.append((mx, my, (240, 220, 90), time.monotonic() + 0.6))

    # ------------------------------------------------------------------
    # Selección
    def entidad_en(self, mx, my, solo_propias=False):
        est = self.est
        mejor = None
        mejor_k = None
        for e in est.ents.values():
            if e.es_recurso:
                if solo_propias or not est.explorado_px(e.x, e.y):
                    continue
                w, h = (60, 30) if e.t == I.TIPO_SALITRE else (96, 96)
                if abs(mx - e.x) <= w / 2 and abs(my - e.y) <= h / 2:
                    k = (3, abs(mx - e.x) + abs(my - e.y))
                    if mejor_k is None or k < mejor_k:
                        mejor, mejor_k = e, k
                continue
            if e.tipo is None:
                continue
            if solo_propias and not est.propio(e):
                continue
            if e.fantasma and not e.es_edificio:
                continue
            if not est.aliado(e.dueno) and not e.fantasma and not est.visible_px(e.x, e.y):
                continue
            if e.es_edificio:
                w2, h2 = e.tipo.ancho * 16, e.tipo.alto * 16
                if e.x - w2 <= mx <= e.x + w2 and e.y - h2 - 20 <= my <= e.y + h2:
                    k = (2, abs(mx - e.x) + abs(my - e.y))
                    if mejor_k is None or k < mejor_k:
                        mejor, mejor_k = e, k
            else:
                r = max(12, e.tipo.radio / 16 * 1.6)
                cy = e.y - (10 if e.tipo.capa == 0 else 0)
                d = abs(mx - e.x) + abs(my - cy) * 0.8
                if d <= r + 6:
                    k = (0 if est.propio(e) else 1, d)
                    if mejor_k is None or k < mejor_k:
                        mejor, mejor_k = e, k
        return mejor

    def seleccionar(self, ids, agregar=False):
        if agregar:
            for i in ids:
                if i in self.seleccion:
                    self.seleccion.remove(i)
                else:
                    self.seleccion.append(i)
        else:
            self.seleccion = list(ids)
        self.submenu = None
        self.modo = None
        if ids:
            self._voz_de_tropa("seleccion", self.seleccion)

    def _reemplazar(self, viejo, nuevo):
        """La ambulancia y su hospital de sangre son la misma tropa: al montarse o desmontarse
        sigue seleccionada y en sus grupos."""
        if viejo in self.seleccion:
            self.seleccion = [nuevo if i == viejo else i for i in self.seleccion]
        for n, ids in self.grupos.items():
            if viejo in ids:
                self.grupos[n] = [nuevo if i == viejo else i for i in ids]

    def _voz_de_tropa(self, momento, ids):
        """Responde la tropa propia: momento es "seleccion", "mover", "atacar" o "trabajar".

        Habla el grupo más numeroso (infantería, caballería, artillería, buques,
        trabajadores...). Fuera de los trabajadores, una faena es una marcha."""
        est = self.est
        grupos = [grupo_voz(est.ents[i].tipo) for i in ids
                  if i in est.ents and est.propio(est.ents[i]) and est.ents[i].es_unidad]
        if not grupos:
            return
        g = max(dict.fromkeys(grupos), key=grupos.count)
        if momento == "trabajar":
            claves = ["trabajar"] if g == "trabajador" else (["montar_ambulancia"] if g == "ambulancia"
                                                               else ["mover_" + g])
        elif momento == "atacar" and g == "ambulancia":
            claves = ["mover_ambulancia"]          # la ambulancia no combate: acompaña
        else:
            claves = [momento + "_" + g]
        sonido().voz(claves, 0 if momento == "seleccion" else 1)

    def _seleccion_caja(self, x0, y0, x1, y1, agregar):
        est = self.est
        a0, b0 = self.cam.a_mapa(min(x0, x1), min(y0, y1))
        a1, b1 = self.cam.a_mapa(max(x0, x1), max(y0, y1))
        propias = []
        edificios = []
        otras = []
        for e in est.ents.values():
            if e.tipo is None or e.fantasma:
                continue
            if not (a0 - 6 <= e.x <= a1 + 6 and b0 - 6 <= e.y <= b1 + 16):
                continue
            if est.propio(e):
                if e.es_edificio:
                    edificios.append(e.id)
                elif not e.tipo.autonomo:      # los camilleros no entran en el recuadro
                    propias.append(e.id)
            elif est.aliado(e.dueno) or est.visible_px(e.x, e.y):
                otras.append(e.id)
        if propias:
            self.seleccionar(propias[:96], agregar)
        elif edificios:
            self.seleccionar(edificios[:24], agregar)
        elif otras and not agregar:
            self.seleccionar(otras[:1])

    def _mismo_tipo_en_pantalla(self, e):
        est = self.est
        rm = self.cam.rect_mapa()
        return [o.id for o in est.ents.values()
                if o.tipo is e.tipo and o.dueno == e.dueno and not o.fantasma and rm.collidepoint(o.x, o.y)]

    # ------------------------------------------------------------------
    def _desplazar(self, dt):
        v = 900 * dt * self.app.config["velocidad_desplazamiento"]
        dx = dy = 0
        if self.chat is None and self.menu is None:
            teclas = pygame.key.get_pressed()
            if teclas[pygame.K_LEFT]:
                dx -= v
            if teclas[pygame.K_RIGHT]:
                dx += v
            if teclas[pygame.K_UP]:
                dy -= v
            if teclas[pygame.K_DOWN]:
                dy += v
        if self.app.config["desplazar_con_borde"]:
            bx, by = self._borde()
            dx += bx * v
            dy += by * v
        if dx or dy:
            self.cam.mover(dx, dy)

    def _borde(self):
        """Hacia dónde empuja el ratón la cámara: (-1, 0 o 1, -1, 0 o 1).

        Cuenta la franja de MARGEN_BORDE píxeles junto al borde de la imagen y,
        si la ventana tiene otra proporción, las franjas negras que la rodean.
        """
        if (self.menu is not None or self.fin is not None or self.arrastre is not None or self.arrastre_mini
                or self.paneo is not None or not self.lz.con_foco()):
            return 0, 0
        lz = self.lz
        x, y = lz.raton()
        m = max(2.0, MARGEN_BORDE / lz.escala())
        bx = -1 if x < m else (1 if x >= lz.W - m else 0)
        by = -1 if y < m else (1 if y >= lz.H - m else 0)
        return bx, by

    def manejar(self, ev):
        if self.fin is not None:
            return super().manejar(ev)
        if self.menu is not None:
            for w in reversed(self.menu):
                if w.manejar(ev):
                    return True
            if ev.type == pygame.KEYDOWN and ev.key in (pygame.K_ESCAPE, pygame.K_F10):
                self.menu = None
            return True
        if self.chat is not None:
            return self._manejar_chat(ev)
        if ev.type == pygame.KEYDOWN:
            return self._tecla(ev)
        if ev.type == pygame.MOUSEWHEEL:
            if not self.hud.contiene(self.ui.raton):
                self.cam.acercar(1.12 if ev.y > 0 else 1 / 1.12, self.ui.raton)
            return True
        if ev.type == pygame.MOUSEBUTTONDOWN:
            return self._clic(ev)
        if ev.type == pygame.MOUSEBUTTONUP:
            return self._soltar(ev)
        if ev.type == pygame.MOUSEMOTION:
            if self.arrastre_mini:
                self.cam.centrar(*self.hud.mini_a_mapa(ev.pos))
            if self.paneo is not None:
                px, py = self.paneo
                self.cam.mover(px - ev.pos[0], py - ev.pos[1])
                self.paneo = ev.pos
        return False

    def _manejar_chat(self, ev):
        if ev.type == pygame.TEXTINPUT:
            if len(self.chat) < 200:
                self.chat += ev.text
            return True
        if ev.type == pygame.KEYDOWN:
            if ev.key in (pygame.K_RETURN, pygame.K_KP_ENTER):
                if self.chat.strip() and self.app.red is not None:
                    self.app.red.enviar({"t": "chat", "texto": self.chat.strip(),
                                         "canal": "equipo" if self.chat_equipo else "todos"})
                self.chat = None
                pygame.key.stop_text_input()
            elif ev.key == pygame.K_ESCAPE:
                self.chat = None
                pygame.key.stop_text_input()
            elif ev.key == pygame.K_BACKSPACE:
                self.chat = self.chat[:-1]
            return True
        return False

    def _tecla(self, ev):
        k = ev.key
        mods = ev.mod
        est = self.est
        if k in (pygame.K_RETURN, pygame.K_KP_ENTER):
            self.chat = ""
            self.chat_equipo = bool(mods & pygame.KMOD_SHIFT)
            pygame.key.start_text_input()
            return True
        if k == pygame.K_F10:
            self.abrir_menu()
            return True
        if k == pygame.K_ESCAPE:
            if self.modo is not None:
                self.modo = None
            elif self.submenu is not None:
                self.submenu = None
            else:
                b = next((b for b in self.botones if b is not None and b.atajo == "ESC" and b.accion == "orden"), None)
                if b is not None:
                    self.activar_boton(b)
                elif self.seleccion:
                    self.seleccion = []
                else:
                    self.abrir_menu()
            return True
        if est.espectador:
            if k in (pygame.K_PLUS, pygame.K_KP_PLUS, pygame.K_EQUALS):
                self._vel_rep(2.0)
            elif k in (pygame.K_MINUS, pygame.K_KP_MINUS):
                self._vel_rep(0.5)
            elif k == pygame.K_p:
                self.app.red.enviar({"t": "pausa"})
            return True
        if k in TECLAS_GRUPO:
            n = TECLAS_GRUPO[k]
            if mods & MOD_CTRL:
                self.grupos[n] = list(self.seleccion)
                self.hud.mensaje(f"Grupo {n} formado ({len(self.seleccion)})", P.CREMA, 2)
            elif mods & pygame.KMOD_SHIFT:
                self.grupos[n] = list(dict.fromkeys(self.grupos.get(n, []) + self.seleccion))
            else:
                ids = [i for i in self.grupos.get(n, []) if i in est.ents]
                if ids:
                    ahora = time.monotonic()
                    if self.ultimo_grupo[0] == n and ahora - self.ultimo_grupo[1] < DOBLE_CLIC:
                        e = est.ents[ids[0]]
                        self.cam.centrar(e.x, e.y)
                    self.ultimo_grupo = (n, ahora)
                    self.seleccionar(ids)
            return True
        if k == pygame.K_F1:
            ociosos = [e for e in est.ents.values() if est.propio(e) and e.tipo is not None and e.tipo.trabajador
                       and not e.fl & (I.F_MOVIENDO | I.F_TRABAJA) and not e.fl & (I.F_SALITRE | I.F_AGUA)]
            if ociosos:
                ociosos.sort(key=lambda e: e.id)
                actual = self.seleccion[0] if len(self.seleccion) == 1 else -1
                sig = next((e for e in ociosos if e.id > actual), ociosos[0])
                self.seleccionar([sig.id])
                self.cam.centrar(sig.x, sig.y)
            else:
                self.hud.mensaje("No hay trabajadores ociosos.", P.CREMA, 2)
            return True
        if k == pygame.K_F2:
            ids = [e.id for e in est.ents.values()
                   if est.propio(e) and e.es_unidad and not e.tipo.trabajador and not e.tipo.autonomo]
            self.seleccionar(ids[:96])
            return True
        if k == pygame.K_SPACE:
            if self.ultimo_aviso is not None:
                self.cam.centrar(*self.ultimo_aviso)
            return True
        if k in (pygame.K_PLUS, pygame.K_KP_PLUS, pygame.K_EQUALS):
            self.cam.acercar(1.15)
            return True
        if k in (pygame.K_MINUS, pygame.K_KP_MINUS):
            self.cam.acercar(1 / 1.15)
            return True
        if k == pygame.K_F3 and self.local:
            self.app.red.enviar({"t": "pausa"})
            return True
        if k == pygame.K_g and mods & pygame.KMOD_ALT:
            x, y = self.cam.a_mapa(*self.ui.raton)
            self.enviar({"c": "senal", "x": int(x), "y": int(y)})
            return True
        nombre = pygame.key.name(k).upper()
        if len(nombre) == 1:
            for b in self.botones:
                if b is not None and b.atajo == nombre:
                    self.activar_boton(b, bool(mods & pygame.KMOD_SHIFT))
                    return True
        return False

    def _vel_rep(self, f):
        if self.est.inicio.get("repeticion"):
            self.velocidad_rep = max(0.25, min(8.0, self.velocidad_rep * f))
            self.app.red.enviar({"t": "velocidad_rep", "valor": self.velocidad_rep})
            self.est.intervalo = 2 / (16 * self.velocidad_rep)
            self.hud.mensaje(f"Velocidad x{self.velocidad_rep:g}", P.CREMA, 2)

    def _clic(self, ev):
        pos = ev.pos
        hud = self.hud
        cola = bool(pygame.key.get_mods() & pygame.KMOD_SHIFT)
        if ev.button == 2:
            self.paneo = pos
            return True
        if hud.boton_menu.collidepoint(pos) and ev.button == 1:
            self.abrir_menu()
            return True
        if hud.rect_mini.collidepoint(pos):
            mx, my = hud.mini_a_mapa(pos)
            if ev.button == 1:
                if self.modo is not None and self.modo[0] == "objetivo":
                    self._orden_objetivo(mx, my, None, cola)
                    if not cola:
                        self.modo = None
                else:
                    self.arrastre_mini = True
                    self.cam.centrar(mx, my)
            elif ev.button == 3:
                self.modo = None
                self._orden_derecha(mx, my, None, cola)
            return True
        if hud.contiene(pos):
            if ev.button == 1:
                b = hud.boton_en(pos)
                if b is not None:
                    self.activar_boton(b, cola)
                    return True
                caja = hud.caja_seleccion_en(pos)
                if caja is not None:
                    if caja[0] == "unidad":
                        if cola:
                            self.seleccion.remove(caja[1])
                        else:
                            self.seleccionar([caja[1]])
                    elif caja[0] == "cola":
                        eds = self._ids_edificios_propios()
                        if eds:
                            self.enviar({"c": "cancelar", "e": eds[:1], "i": caja[1]})
                    elif caja[0] == "guarnicion":
                        eds = self._ids_edificios_propios()
                        if eds:
                            self.enviar({"c": "descargar", "u": eds[:1], "g": caja[1]})
            return True
        mx, my = self.cam.a_mapa(*pos)
        if ev.button == 3:
            if self.modo is not None:
                self.modo = None
                return True
            self._orden_derecha(mx, my, self.entidad_en(mx, my), cola)
            return True
        if ev.button != 1:
            return False
        if self.modo is not None:
            if self.modo[0] == "construir":
                lugar = self._lugar_obra(mx, my)
                if lugar is not None and lugar[2]:
                    self.enviar({"c": "construir", "u": self._ids_unidades_propias(), "e": self.modo[2],
                                 "tx": lugar[0], "ty": lugar[1], "cola": cola})
                    sonido().ui("clic")
                    self._voz_de_tropa("trabajar", self._ids_unidades_propias())
                    if not cola:
                        self.modo = None
                        self.submenu = None
                else:
                    self.hud.mensaje("No se puede construir ahí.", (240, 110, 90), 2)
                return True
            self._orden_objetivo(mx, my, self.entidad_en(mx, my), cola)
            if not cola:
                self.modo = None
            return True
        self.arrastre = pos
        return True

    def _soltar(self, ev):
        if ev.button == 2:
            self.paneo = None
            return True
        if ev.button != 1:
            return False
        self.arrastre_mini = False
        if self.arrastre is None:
            return False
        x0, y0 = self.arrastre
        x1, y1 = ev.pos
        self.arrastre = None
        agregar = bool(pygame.key.get_mods() & pygame.KMOD_SHIFT)
        if abs(x1 - x0) < 6 and abs(y1 - y0) < 6:
            mx, my = self.cam.a_mapa(x1, y1)
            e = self.entidad_en(mx, my)
            if e is None:
                if not agregar:
                    self.seleccionar([])
                return True
            ahora = time.monotonic()
            doble = self.ultimo_clic[0] == e.id and ahora - self.ultimo_clic[1] < DOBLE_CLIC
            self.ultimo_clic = (e.id, ahora)
            if (doble or pygame.key.get_mods() & MOD_CTRL) and e.tipo is not None:
                self.seleccionar(self._mismo_tipo_en_pantalla(e), agregar)
            elif agregar and self.est.propio(e) and all(
                    self.est.propio(self.est.ents[i]) for i in self.seleccion if i in self.est.ents):
                self.seleccionar([e.id], True)
            else:
                self.seleccionar([e.id])
            return True
        self._seleccion_caja(x0, y0, x1, y1, agregar)
        return True

    # ------------------------------------------------------------------
    def _lugar_obra(self, mx, my):
        """(tx, ty, válido) para el edificio en modo de construcción bajo el cursor."""
        est = self.est
        tipo = est.cat.edificios[self.modo[2]]
        m = est.mapa
        tx = int(mx // 32) - tipo.ancho // 2
        ty = int(my // 32) - tipo.alto // 2
        if tipo.sobre_recurso:
            mejor = None
            for e in est.ents.values():
                if e.t == I.TIPO_AGUA:
                    d = abs(e.x - mx) + abs(e.y - my)
                    if d < 96 and (mejor is None or d < mejor[0]):
                        mejor = (d, e)
            if mejor is None:
                return (tx, ty, False)
            e = mejor[1]
            ptx, pty = int(e.x // 32) - 1, int(e.y // 32) - 1
            ocupado = any(o.es_edificio and o.tipo.sobre_recurso and abs(o.x - e.x) < 8 and abs(o.y - e.y) < 8
                          for o in est.ents.values() if o.tipo is not None)
            return (ptx, pty, not ocupado and est.explorado_px(e.x, e.y))
        if tx < 0 or ty < 0 or tx + tipo.ancho > m.w or ty + tipo.alto > m.h:
            return (tx, ty, False)
        ocupadas = set()
        for e in est.ents.values():
            if e.es_edificio:
                ex0 = (int(e.x) - e.tipo.ancho * 16) // 32
                ey0 = (int(e.y) - e.tipo.alto * 16) // 32
                for yy in range(ey0, ey0 + e.tipo.alto):
                    for xx in range(ex0, ex0 + e.tipo.ancho):
                        ocupadas.add((xx, yy))
            elif e.es_recurso:
                w, h = (2, 1) if e.t == I.TIPO_SALITRE else (3, 3)
                ex0 = (int(e.x) - w * 16) // 32
                ey0 = (int(e.y) - h * 16) // 32
                for yy in range(ey0, ey0 + h):
                    for xx in range(ex0, ex0 + w):
                        ocupadas.add((xx, yy))
        nivel0 = m.nivel[ty * m.w + tx]
        for yy in range(ty, ty + tipo.alto):
            for xx in range(tx, tx + tipo.ancho):
                i = yy * m.w + xx
                if (xx, yy) in ocupadas or not m.edificable[i] or m.nivel[i] != nivel0 or not est.explorado[i]:
                    return (tx, ty, False)
        if tipo.costero:
            agua = sum(1 for yy in range(ty - 1, ty + tipo.alto + 1) for xx in range(tx - 1, tx + tipo.ancho + 1)
                       if m.dentro(xx, yy) and m.base_agua[yy * m.w + xx])
            if agua < 3:
                return (tx, ty, False)
        if tipo.deposito:
            for e in est.ents.values():
                if e.es_recurso:
                    w, h = (2, 1) if e.t == I.TIPO_SALITRE else (3, 3)
                    rx = (int(e.x) - w * 16) // 32
                    ry = (int(e.y) - h * 16) // 32
                    dx = max(0, rx - (tx + tipo.ancho), tx - (rx + w))
                    dy = max(0, ry - (ty + tipo.alto), ty - (ry + h))
                    if max(dx, dy) < est.cat.dist_recursos_cuartel:
                        return (tx, ty, False)
        return (tx, ty, True)

    def _dibujar_superpuesto(self, cam):
        lz = self.lz
        est = self.est
        z = cam.zoom
        ahora = time.monotonic()
        # marcas de órdenes
        for (x, y, col, hasta) in self.marcas_orden:
            f = (hasta - ahora) / 0.6
            sx, sy = cam.a_pantalla(x, y)
            r = (6 + 10 * max(0.0, f)) * z
            lz.dibujar(self.vista.t_anillo, sx - r, sy - r * 0.45, r * 2, r * 0.9, color=col,
                       alpha=int(255 * min(1.0, max(0.0, f))))
        # puntos de reunión de los edificios elegidos
        for i in self.seleccion:
            e = est.ents.get(i)
            if e is None or not e.es_edificio or not est.propio(e) or not isinstance(e.ex, dict) or "r" not in e.ex:
                continue
            rx, ry = e.ex["r"]
            sx, sy = cam.a_pantalla(rx, ry)
            ex, ey = cam.a_pantalla(e.x, e.y)
            lz.linea((ex, ey), (sx, sy), (240, 220, 90), 120)
            t = self.vista.t_reunion
            lz.dibujar(t, sx - 2 * z, sy - 22 * z, 14 * z, 22 * z)
        # fantasma del edificio a construir
        if self.modo is not None and self.modo[0] == "construir":
            mx, my = cam.a_mapa(*self._raton_local(cam))
            lugar = self._lugar_obra(mx, my)
            tipo = est.cat.edificios[self.modo[2]]
            tx, ty, ok = lugar
            fac = est.facciones[est.yo]
            tex = self.vista.edificios.textura(tipo, fac.id, color_jugador(est.jugadores[est.yo]["color"]))
            from ..graficos import edificios as G_E
            sx, sy = cam.a_pantalla(tx * 32 - G_E.MARGEN, ty * 32 - G_E.ALTO)
            lz.dibujar(tex, sx, sy, tex.width * z, tex.height * z, alpha=150)
            col = (60, 200, 60) if ok else (220, 50, 40)
            for yy in range(ty, ty + tipo.alto):
                for xx in range(tx, tx + tipo.ancho):
                    px, py = cam.a_pantalla(xx * 32, yy * 32)
                    lz.rect((px + 1, py + 1, 32 * z - 2, 32 * z - 2), col, 70)
        # recuadro de selección
        if self.arrastre is not None:
            x0, y0 = self.arrastre
            x1, y1 = self.ui.raton
            ox, oy = self.cam.vista.x, self.cam.vista.y
            r = pygame.Rect(min(x0, x1) - ox, min(y0, y1) - oy, abs(x1 - x0), abs(y1 - y0))
            if r.w > 4 or r.h > 4:
                lz.rect(r, (90, 230, 90), 40)
                lz.marco(r, (90, 230, 90), 1)

    def _raton_local(self, cam):
        # dentro del recorte la vista empieza en (0, 0)
        x, y = self.ui.raton
        return x - self.cam.vista.x, y - self.cam.vista.y

    # ------------------------------------------------------------------
    def _rect_menu(self):
        lz = self.lz
        return pygame.Rect(lz.W // 2 - 340, lz.H // 2 - 200, 680, 410)

    def abrir_menu(self):
        r = self._rect_menu()
        x = r.x + 30
        y = r.y + 76
        self.menu = [
            Boton((x, y, 280, 42), "Continuar", self.cerrar_menu, "principal"),
            # el volumen se ajusta sin salir de la batalla
            ControlesSonido(self.app, r.x + 360, r.y + 108, 290),
        ]
        if not self.est.espectador:
            self.menu.append(Boton((x, y + 52, 280, 42), "Rendirse", self.rendirse))
        if self.local and not self.est.espectador:
            self.menu.append(Boton((x, y + 104, 280, 42), "Pausa (F3)", self.alternar_pausa))
        self.menu.append(Boton((x, y + 156, 280, 42), "Abandonar y volver al menú", self.abandonar, "madera"))
        self.rendicion_confirmar = False

    def cerrar_menu(self):
        self.menu = None

    def alternar_pausa(self):
        if self.app.red is not None:
            self.app.red.enviar({"t": "pausa"})
        self.menu = None

    def rendirse(self):
        if not self.rendicion_confirmar:
            self.rendicion_confirmar = True
            self.hud.mensaje("Pulse otra vez «Rendirse» para confirmar.", (240, 180, 90), 4)
            return
        if self.app.red is not None:
            self.app.red.enviar({"t": "rendirse"})
        self.menu = None

    def abandonar(self):
        if self.app.red is not None:
            self.app.red.enviar({"t": "abandonar"})
        from .portada import Portada
        if self.origen in ("escaramuza", "repeticion"):
            self.app.cambiar(Portada(self.app))
        elif self.fin is not None and self.app.en_sala:
            from .sala import SalaEspera
            self.app.cambiar(SalaEspera(self.app))
        else:
            # quien abandona una batalla en curso sale también de la sala
            from .lobby import Lobby
            self.app.cambiar(Lobby(self.app))

    # ------------------------------------------------------------------
    def dibujar(self):
        lz = self.lz
        dt = 1 / 60
        self.vista.mostrar_barras = self.app.config["barras_siempre"] or bool(pygame.key.get_mods() & pygame.KMOD_ALT)
        lz.rect(self.cam.vista, (0, 0, 0))
        self.vista.dibujar(self.cam, set(self.seleccion), dt, self._dibujar_superpuesto)
        self.hud.dibujar()
        if self.modo is not None and self.modo[0] == "objetivo":
            lz.texto("Elija el objetivo (clic derecho o Esc para cancelar)", lz.W // 2, ALTO_SUP + 8,
                     fuentes.negrita(16), P.CREMA, "centro", sombra=(0, 0, 0))
        if self.pausa:
            lz.texto("PAUSA", lz.W // 2, lz.H // 2 - 120, fuentes.titulo(48), P.CREMA, "centro", sombra=(0, 0, 0))
        if self.menu is not None:
            lz.rect((0, 0, lz.W, lz.H), (0, 0, 0), 130)
            r = self._rect_menu()
            self.ui.estilo.panel(r)
            lz.texto("Cuartel de campaña", r.centerx, r.y + 16, fuentes.titulo(26), P.TINTA, "centro")
            lz.texto("Sonido", r.x + 360, r.y + 70, fuentes.titulo(22), P.TINTA)
            lz.linea((r.x + 334, r.y + 72), (r.x + 334, r.bottom - 70), (150, 120, 84))
            for w in self.menu:
                w.dibujar(self.ui)
            lz.parrafo("F12: captura · Alt+Enter: pantalla completa · Alt+G: señal en el mapa · "
                       "Opciones del menú principal: pantalla, cámara y combate",
                       r.x + 30, r.bottom - 54, r.w - 60, fuentes.cuerpo(14), P.TINTA_SUAVE)
        if self.fin is not None:
            lz.rect((0, 0, lz.W, lz.H), (0, 0, 0), 120)
            r = pygame.Rect(lz.W // 2 - 260, lz.H // 2 - 110, 520, 230)
            self.ui.estilo.panel(r)
            lz.texto(self.fin_titulo, r.centerx, r.y + 30, fuentes.titulo(46), P.ROJO_SELLO, "centro")
            minutos = self.fin.get("ticks", 0) // (16 * 60)
            lz.texto(f"Duración: {minutos} minutos", r.centerx, r.y + 96, fuentes.cursiva(18), P.TINTA, "centro")
            self.dibujar_widgets()
