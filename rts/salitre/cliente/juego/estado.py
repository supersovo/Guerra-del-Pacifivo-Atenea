"""Estado de la partida en el cliente: espejo de lo que el servidor envía.

- Entidades con interpolación entre instantáneas (movimiento suave).
- Niebla de guerra calculada aquí con las mismas reglas que el servidor.
- "Fantasmas": edificios y yacimientos enemigos vistos que quedan recordados
  bajo la niebla, como en StarCraft.
"""

import time

from ...contenido.mapas import MapaDatos
from ...red import instantanea as I
from ...sim import stats as mod_stats
from ...sim import vision
from ...sim.constantes import TILE
from ...sim.mapa import Mapa


class Ent:
    __slots__ = ("id", "t", "dueno", "x", "y", "x0", "y0", "x1", "y1", "t0", "vida", "dir", "fl", "ex",
                 "tipo", "fantasma", "visto", "mov_fase", "creada", "ultimo_disparo")

    def __init__(self, r, tipo, ahora):
        self.id = r[0]
        self.t = r[1]
        self.dueno = r[2]
        self.x = self.x0 = self.x1 = r[3]
        self.y = self.y0 = self.y1 = r[4]
        self.t0 = ahora
        self.vida = r[5]
        self.dir = r[6]
        self.fl = r[7]
        self.ex = r[8] or {}
        self.tipo = tipo
        self.fantasma = False
        self.visto = ahora
        self.mov_fase = 0.0
        self.creada = ahora
        self.ultimo_disparo = 0.0

    @property
    def es_unidad(self):
        return self.tipo is not None and not self.tipo.es_edificio

    @property
    def es_edificio(self):
        return self.tipo is not None and self.tipo.es_edificio

    @property
    def es_recurso(self):
        return self.t in (I.TIPO_SALITRE, I.TIPO_AGUA)


class EstadoJuego:
    def __init__(self, cat, inicio):
        self.cat = cat
        self.inicio = inicio
        self.datos_mapa = MapaDatos(inicio["mapa"])
        self.mapa = Mapa(self.datos_mapa)
        self.yo = inicio["yo"]
        self.espectador = self.yo < 0
        self.jugadores = inicio["jugadores"]
        self.facciones = [cat.facciones[j["faccion"]] for j in self.jugadores]
        self.equipos = [j["equipo"] for j in self.jugadores]
        self.intervalo = inicio.get("cada", 2) / (inicio.get("ticks", 16) * inicio.get("velocidad", 1.0))
        self.ents = {}
        self.tick = 0
        self.recursos = (0, 0)
        self.pob = (0, 0)
        self.mejoras = set()
        self.investigando = set()
        self.heroes = set()
        self.minas = 0
        self.todos = None
        n = self.mapa.n
        self.vis = bytearray(n)
        self.explorado = bytearray(n)
        self.revelados = []
        self.eventos = []
        self.cambio_vision = True
        self._t_vision = 0.0
        self.stats = {}
        self._stats_grado = {}
        self._efectos = []
        self._recalcular_stats()
        # yacimientos conocidos desde el comienzo (los ids son los primeros, en el orden del mapa)
        ahora = time.monotonic()
        self.inicial = {}       # id del yacimiento -> cantidad al comenzar (para el nivel de los pozos)
        for k, r in enumerate(self.datos_mapa.recursos):
            rid = k + 1
            tam = (2, 1) if r["tipo"] == "salitre" else (3, 3)
            x = (r["x"] * TILE + tam[0] * TILE // 2) >> 4
            y = (r["y"] * TILE + tam[1] * TILE // 2) >> 4
            cant = int(r.get("cantidad", 1500 if r["tipo"] == "salitre" else 2500))
            self.inicial[rid] = cant
            e = Ent([rid, I.TIPO_SALITRE if r["tipo"] == "salitre" else I.TIPO_AGUA, -1, x, y,
                     cant, 0, 0, 0], None, ahora)
            e.fantasma = True
            self.ents[rid] = e

    # ------------------------------------------------------------------
    def aliado(self, dueno):
        if self.espectador:
            return True
        if dueno < 0:
            return False
        return dueno == self.yo or self.equipos[dueno] == self.equipos[self.yo]

    def propio(self, e):
        return not self.espectador and e.dueno == self.yo

    def faccion(self, dueno):
        return self.facciones[dueno] if 0 <= dueno < len(self.facciones) else None

    def tipo_por_idx(self, idx):
        if idx is None or idx < 0:
            return None
        return self.cat.tipos[idx]

    def _recalcular_stats(self):
        self._stats_grado = {}
        if self.espectador:
            self._efectos = []
            return
        f = self.facciones[self.yo]
        efectos = list(f.efectos_iniciales())
        for mid in self.mejoras:
            m = self.cat.mejoras.get(mid)
            if m:
                efectos.extend(m.efectos)
        self._efectos = efectos
        self.stats = mod_stats.tabla(self.cat, f, efectos)

    def stats_de(self, tipo, grado=0):
        """Stats propios de un tipo; con grado, los de un veterano de ese grado (como en el servidor)."""
        if grado and not tipo.es_edificio:
            clave = (tipo.id, grado)
            st = self._stats_grado.get(clave)
            if st is None:
                g = self.cat.veterania.grados[max(0, min(grado, self.cat.veterania.maximo))]
                st = mod_stats.calcular(tipo, list(self._efectos) + list(g.efectos))
                self._stats_grado[clave] = st
            return st
        st = self.stats.get(tipo.id)
        if st is None:
            st = mod_stats.calcular(tipo, [])
            self.stats[tipo.id] = st
        return st

    # ------------------------------------------------------------------
    def aplicar(self, msg):
        ahora = time.monotonic()
        self.tick = msg.get("k", self.tick)
        if msg.get("completa"):
            for e in list(self.ents.values()):
                if not e.es_recurso:
                    del self.ents[e.id]
        for r in msg.get("e", ()):
            e = self.ents.get(r[0])
            tipo = self.tipo_por_idx(r[1])
            if e is None or e.t != r[1]:
                e = Ent(r, tipo, ahora)
                self.ents[r[0]] = e
                self.cambio_vision = True
                continue
            # desde donde se ve ahora hasta la nueva posición
            e.x0, e.y0 = e.x, e.y
            e.x1, e.y1 = r[3], r[4]
            e.t0 = ahora
            e.vida = r[5]
            e.dir = r[6]
            if r[7] & I.F_DISPARO and not e.fl & I.F_DISPARO:
                e.ultimo_disparo = ahora
            e.fl = r[7]
            e.ex = r[8] or {}
            e.fantasma = False
            e.visto = ahora
            if e.dueno != r[2]:
                e.dueno = r[2]
            if (e.x0, e.y0) != (e.x1, e.y1) and self.aliado(e.dueno):
                self.cambio_vision = True
        for i, motivo in msg.get("q", ()):
            e = self.ents.get(i)
            if e is None:
                continue
            if motivo == "v" and (e.es_edificio or e.es_recurso):
                e.fantasma = True
                e.x, e.y = e.x1, e.y1
                e.x0, e.y0 = e.x1, e.y1
            else:
                del self.ents[i]
                self.cambio_vision = True
        j = msg.get("j")
        if j is not None:
            self.recursos = (j["d"], j["a"])
            self.pob = (j["p"], j["pm"])
            nuevas = set(j.get("m", []))
            if nuevas != self.mejoras:
                self.mejoras = nuevas
                self._recalcular_stats()
            self.investigando = set(j.get("i", []))
            self.heroes = set(j.get("h", []))
            self.minas = j.get("mi", 0)
        if "js" in msg:
            self.todos = msg["js"]
        ev = msg.get("ev")
        if ev:
            self.eventos.extend(ev)

    def interpolar(self):
        ahora = time.monotonic()
        dur = max(0.03, self.intervalo)
        for e in self.ents.values():
            if e.x0 == e.x1 and e.y0 == e.y1:
                e.x, e.y = e.x1, e.y1
                continue
            f = (ahora - e.t0) / dur
            if f >= 1.0:
                e.x, e.y = e.x1, e.y1
            else:
                e.x = e.x0 + (e.x1 - e.x0) * f
                e.y = e.y0 + (e.y1 - e.y0) * f

    def actualizar_vision(self, forzar=False):
        ahora = time.monotonic()
        if not forzar and (not self.cambio_vision or ahora - self._t_vision < 0.2) and ahora - self._t_vision < 0.6:
            return False
        self._t_vision = ahora
        self.cambio_vision = False
        m = self.mapa
        if self.espectador:
            self.vis = bytearray(b"\x01" * m.n)
            self.explorado = self.vis
            return True
        obs = []
        w = m.w
        for e in self.ents.values():
            if e.t == I.TIPO_CONVOY and self.aliado(e.dueno):
                # el tren o la carreta del cuartel general ve a su alrededor (como en el servidor)
                tx = min(m.w - 1, max(0, int(e.x1) // 32))
                ty = min(m.h - 1, max(0, int(e.y1) // 32))
                obs.append((tx, ty, 6, m.nivel[ty * w + tx]))
                continue
            if e.tipo is None or e.fantasma or not self.aliado(e.dueno):
                continue
            tx = min(m.w - 1, max(0, int(e.x1) // 32))
            ty = min(m.h - 1, max(0, int(e.y1) // 32))
            if e.es_edificio:
                radio = (e.tipo.vision if not e.fl & I.F_OBRA else 3) + max(e.tipo.ancho, e.tipo.alto) / 2
            else:
                radio = self.stats_de(e.tipo).vision if e.dueno == self.yo else e.tipo.vision
            obs.append((tx, ty, radio, m.nivel[ty * w + tx]))
        rev = []
        vigentes = []
        for (tx, ty, radio, hasta) in self.revelados:
            if hasta > ahora:
                vigentes.append((tx, ty, radio, hasta))
                rev.append((tx, ty, radio))
        self.revelados = vigentes
        self.vis = vision.calcular(m, obs, rev)
        self.explorado = vision.unir(self.explorado, self.vis)
        # los fantasmas que ya se ven y no están, desaparecen
        for e in list(self.ents.values()):
            if e.fantasma and not e.es_recurso:
                tx = min(m.w - 1, max(0, int(e.x1) // 32))
                ty = min(m.h - 1, max(0, int(e.y1) // 32))
                if self.vis[ty * w + tx] and ahora - e.visto > 0.5:
                    del self.ents[e.id]
        return True

    def visible_px(self, x, y):
        m = self.mapa
        tx = min(m.w - 1, max(0, int(x) // 32))
        ty = min(m.h - 1, max(0, int(y) // 32))
        return self.vis[ty * m.w + tx] == 1

    def explorado_px(self, x, y):
        m = self.mapa
        tx = min(m.w - 1, max(0, int(x) // 32))
        ty = min(m.h - 1, max(0, int(y) // 32))
        return self.explorado[ty * m.w + tx] == 1

    def revelar(self, x, y, radio_px, segundos=12.0):
        self.revelados.append((int(x) // 32, int(y) // 32, radio_px / 32, time.monotonic() + segundos))
        self.cambio_vision = True

    def tomar_eventos(self):
        ev = self.eventos
        self.eventos = []
        return ev
