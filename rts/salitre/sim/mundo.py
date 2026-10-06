"""El mundo de la partida: entidades, jugadores y el bucle de ticks.

Orden de cada tick:
  1. comandos de los jugadores (y de la IA), en el orden de llegada
  2. acciones programadas (andanadas, cargas de demolición)
  3. caminos pendientes (con presupuesto de nodos)
  4. edificios: obras, producción, investigación, defensas
  5. unidades: órdenes, movimiento, combate, recolección
  6. separación de unidades superpuestas
  7. proyectiles y minas
  8. auras (cada 8 ticks), bajas, visión (cada 4) y victoria (cada 16)

Todo es determinista: con la misma semilla y los mismos comandos se obtiene
la misma partida (así funcionan las repeticiones).
"""

import heapq
from math import isqrt

from . import combate, comandos, comportamiento, habilidades
from . import edificios as logica_edificios
from . import vision as mod_vision
from .azar import Azar
from .constantes import AGUA, MEDIA, TICKS, TIERRA, TILE
from .entidades import Edificio, Recurso, Unidad
from .espacial import Rejilla, RejillaEdificios
from .jugador import Jugador
from .mapa import OCUPA_EDIFICIO, OCUPA_RECURSO, Mapa
from .ruta import Buscador
from .ruta import calcular as calcular_ruta
from ..contenido.mapas import TAM_RECURSO

PRESUPUESTO_RUTAS = 12000
DEST_TODOS = -1
DEST_POS = 1000


class Mundo:
    def __init__(self, catalogo, mapa_datos, configs, semilla=1, registrar=False):
        self.cat = catalogo
        self.datos_mapa = mapa_datos
        self.mapa = Mapa(mapa_datos)
        self.semilla = int(semilla)
        self.azar = Azar(self.semilla)
        self.tick = 0
        self.sig_id = 1
        self.ent = {}
        self.unidades = {}
        self.edificios = {}
        self.recursos = {}
        self.minas = {}
        self.proyectiles = []
        self.programados = []
        self._seq = 0
        self.eventos = []
        self.pendientes = []
        self.registro = [] if registrar else None
        self.muertos = []
        self.cola_rutas = []
        self.buscador = Buscador(self.mapa)
        self.rejilla = Rejilla(self.mapa.ancho_sub, self.mapa.alto_sub)
        self.rejilla_edif = RejillaEdificios(self.mapa.ancho_sub, self.mapa.alto_sub)
        self.revelados = []
        self.terminado = False
        self.ganador = None
        self.trucos = False

        self.jugadores = []
        for i, c in enumerate(configs):
            fac = catalogo.facciones[c["faccion"]]
            self.jugadores.append(Jugador(i, c.get("nombre", f"Jugador {i + 1}"), fac,
                                          int(c.get("equipo", i)), int(c.get("color", i)),
                                          catalogo, bool(c.get("ia", False))))
        n = len(self.jugadores)
        self.aliado = [[self.jugadores[a].equipo == self.jugadores[b].equipo for b in range(n)]
                       for a in range(n)]
        self.equipos = sorted({j.equipo for j in self.jugadores})
        self.vis = {eq: bytearray(self.mapa.n) for eq in self.equipos}
        self.det = {eq: bytearray(self.mapa.n) for eq in self.equipos}
        self.explorado = {eq: bytearray(self.mapa.n) for eq in self.equipos}
        self._crear_recursos()
        self._colocar_jugadores(configs)
        self.rejilla.reconstruir(self.unidades.values())
        self._actualizar_vision()

    # ------------------------------------------------------------------
    # Relaciones y visibilidad
    def enemigos(self, a, b):
        return a != b and a >= 0 and b >= 0 and not self.aliado[a][b]

    def aliados(self, a, b):
        return a == b or (a >= 0 and b >= 0 and self.aliado[a][b])

    def equipo_de(self, p):
        return self.jugadores[p].equipo

    def visible(self, p, x, y):
        return self.vis[self.jugadores[p].equipo][self.mapa.idx_de(x, y)] == 1

    def visible_edificio(self, p, b):
        vis = self.vis[self.jugadores[p].equipo]
        w = self.mapa.w
        for ty in (b.ty, b.ty + b.h - 1):
            for tx in (b.tx, b.tx + b.w - 1):
                if vis[ty * w + tx]:
                    return True
        return vis[self.mapa.idx_de(b.x, b.y)] == 1

    def detectado(self, p, e):
        return self.det[self.jugadores[p].equipo][self.mapa.idx_de(e.x, e.y)] == 1

    def entidad(self, i):
        e = self.ent.get(i)
        if e is None or not e.vivo:
            return None
        return e

    def edificios_cerca(self, x, y, r):
        return self.rejilla_edif.cerca(x, y, r)

    # ------------------------------------------------------------------
    # Eventos
    def ev_todos(self, *ev):
        self.eventos.append((DEST_TODOS, ev))

    def ev_jugador(self, p, *ev):
        self.eventos.append((p, ev))

    def ev_pos(self, x, y, *ev):
        self.eventos.append((DEST_POS + self.mapa.idx_de(x, y), ev))

    def avisar_ataque(self, obj):
        p = obj.dueno
        if p < 0:
            return
        j = self.jugadores[p]
        if self.tick - j.aviso_ataque_t >= TICKS * 8:
            j.aviso_ataque_t = self.tick
            trab = 1 if (obj.es_unidad and obj.tipo.trabajador) else 0
            self.ev_jugador(p, "ata", obj.x >> 4, obj.y >> 4, trab)

    # ------------------------------------------------------------------
    # Creación
    def _nuevo_id(self):
        i = self.sig_id
        self.sig_id += 1
        return i

    def _crear_recursos(self):
        for r in self.datos_mapa.recursos:
            w, h = TAM_RECURSO[r["tipo"]]
            cant = int(r.get("cantidad", 1500 if r["tipo"] == "salitre" else 2500))
            rec = Recurso(self._nuevo_id(), r["tipo"], int(r["x"]), int(r["y"]), w, h, cant)
            self.ent[rec.id] = rec
            self.recursos[rec.id] = rec
            self.mapa.ocupar(rec.tx, rec.ty, w, h, OCUPA_RECURSO)

    def _colocar_jugadores(self, configs):
        inicios = list(self.datos_mapa.inicios)
        libres = list(range(len(inicios)))
        asignados = {}
        for j, c in zip(self.jugadores, configs):
            pos = c.get("posicion")
            if pos is not None and int(pos) in libres:
                asignados[j.idx] = int(pos)
                libres.remove(int(pos))
        for j in self.jugadores:
            if j.idx not in asignados:
                k = libres.pop(self.azar.entero(len(libres)))
                asignados[j.idx] = k
        for j in self.jugadores:
            tx, ty = inicios[asignados[j.idx]]
            j.inicio = (tx, ty)
            cg = self.crear_edificio(j.idx, "cuartel_general", tx, ty, construido=True)
            for _ in range(self.cat.trabajadores_iniciales):
                x, y = self.punto_salida(cg, TIERRA)
                self.crear_unidad(j.idx, "trabajador", x, y)
                j.pob_usada += self.cat.unidades["trabajador"].poblacion

    def crear_unidad(self, p, tipo_id, x, y):
        tipo = self.cat.unidades[tipo_id]
        j = self.jugadores[p]
        u = Unidad(self._nuevo_id(), tipo, p, x, y, j.stats[tipo_id], self.tick)
        self.ent[u.id] = u
        self.unidades[u.id] = u
        if tipo.heroe:
            j.heroes.add(tipo_id)
        return u

    def crear_edificio(self, p, tipo_id, tx, ty, construido):
        tipo = self.cat.edificios[tipo_id]
        j = self.jugadores[p]
        b = Edificio(self._nuevo_id(), tipo, p, tx, ty, j.stats[tipo_id], construido)
        self.ent[b.id] = b
        self.edificios[b.id] = b
        if tipo.sobre_recurso:
            pozo = self.pozo_en(tx, ty)
            if pozo is not None:
                b.pozo = pozo.id
                pozo.molino = b.id
        else:
            self.mapa.ocupar(tx, ty, b.w, b.h, OCUPA_EDIFICIO)
            self._desalojar(b)
        self.rejilla_edif.agregar(b)
        if construido:
            self._edificio_terminado(b, inicial=True)
        return b

    def pozo_en(self, tx, ty):
        for r in self.recursos.values():
            if r.rtipo == "agua" and r.tx == tx and r.ty == ty:
                return r
        return None

    def _desalojar(self, b):
        """Saca a las unidades de tierra que quedaron sobre un edificio nuevo."""
        x0, y0, x1, y1 = b.rect()
        for u in list(self.rejilla.cerca(b.x, b.y, max(b.w, b.h) * TILE)):
            if u.capa != TIERRA or u.dentro:
                continue
            if x0 <= u.x < x1 and y0 <= u.y < y1:
                tx, ty = self.mapa.casilla(u.x, u.y)
                i = self.mapa.pasable_cercana(TIERRA, tx, ty, 8)
                if i is not None:
                    u.x, u.y = self.mapa.centro_idx(i)
                    u.ruta = []
                    u.ruta_meta = None

    def _edificio_terminado(self, b, inicial=False):
        b.construido = True
        b.progreso = b.tipo.tiempo * 100
        j = self.jugadores[b.dueno]
        j.terminados[b.tipo.id] = j.terminados.get(b.tipo.id, 0) + 1
        self.recalcular_pob(j)
        if not inicial:
            j.est["edificios_construidos"] += 1
            self.ev_jugador(b.dueno, "fin_obra", b.id, b.tipo.idx)

    def recalcular_pob(self, j):
        total = 0
        for b in self.edificios.values():
            if b.dueno == j.idx and b.vivo and b.construido:
                total += b.tipo.poblacion
        j.nivel_pob_max(total)

    def punto_salida(self, b, capa, hacia=None):
        """Punto libre junto a un edificio para una unidad nueva (o desembarcada)."""
        m = self.mapa
        pas = m.pasable[capa]
        mejor = None
        mejor_k = None
        for r in range(1, 8):
            x0, y0 = b.tx - r, b.ty - r
            x1, y1 = b.tx + b.w - 1 + r, b.ty + b.h - 1 + r
            for ty in range(y0, y1 + 1):
                if ty < 0 or ty >= m.h:
                    continue
                if ty == y0 or ty == y1:
                    xs = range(x0, x1 + 1)
                else:
                    xs = (x0, x1)
                for tx in xs:
                    if tx < 0 or tx >= m.w:
                        continue
                    i = ty * m.w + tx
                    if not pas[i]:
                        continue
                    cx, cy = tx * TILE + MEDIA, ty * TILE + MEDIA
                    ocupada = 0
                    for u in self.rejilla.cerca(cx, cy, TILE // 2):
                        if abs(u.x - cx) < TILE // 2 and abs(u.y - cy) < TILE // 2:
                            ocupada += 1
                    if hacia is not None:
                        dist = (cx - hacia[0]) ** 2 + (cy - hacia[1]) ** 2
                    else:
                        dist = (ty - (b.ty + b.h)) ** 2 * 4 + (tx - b.tx - b.w // 2) ** 2
                    k = (ocupada, dist, i)
                    if mejor_k is None or k < mejor_k:
                        mejor, mejor_k = (cx, cy), k
            if mejor is not None and mejor_k[0] == 0:
                return mejor
        if mejor is not None:
            return mejor
        return b.x, b.y + b.h * TILE // 2 + TILE // 2

    # ------------------------------------------------------------------
    # Construcción
    def validar_construccion(self, j, tipo, tx, ty):
        if tipo.id not in j.faccion.edificios:
            return "Su nación no dispone de ese edificio"
        if not j.requisitos(tipo):
            faltan = [self.cat.nombre(j.faccion.id, r) for r in tipo.requisitos if not j.tiene(r)]
            return "Requiere: " + ", ".join(faltan)
        if not j.puede_pagar(j.stats[tipo.id].costo):
            return "Faltan recursos"
        return self.validar_lugar(j.idx, tipo, tx, ty)

    def validar_lugar(self, p, tipo, tx, ty):
        m = self.mapa
        w, h = tipo.ancho, tipo.alto
        if tx < 0 or ty < 0 or tx + w > m.w or ty + h > m.h:
            return "Fuera del mapa"
        expl = self.explorado[self.equipo_de(p)]
        if tipo.sobre_recurso:
            pozo = self.pozo_en(tx, ty)
            if pozo is None or (pozo.w, pozo.h) != (w, h):
                return "Debe construirse sobre un pozo de agua"
            if pozo.molino and self.entidad(pozo.molino) is not None:
                return "Ese pozo ya tiene un molino"
            if not expl[ty * m.w + tx]:
                return "Terreno sin explorar"
            return None
        nivel0 = m.nivel[ty * m.w + tx]
        for y in range(ty, ty + h):
            for x in range(tx, tx + w):
                i = y * m.w + x
                if not expl[i]:
                    return "Terreno sin explorar"
                if not m.edificable[i] or m.ocupado[i]:
                    return "No se puede construir ahí"
                if m.nivel[i] != nivel0:
                    return "El terreno es desparejo"
        x0, y0 = tx * TILE, ty * TILE
        x1, y1 = (tx + w) * TILE, (ty + h) * TILE
        for u in self.rejilla.cerca((x0 + x1) // 2, (y0 + y1) // 2, max(w, h) * TILE):
            if self.enemigos(p, u.dueno) and x0 <= u.x < x1 and y0 <= u.y < y1:
                return "Hay tropas enemigas en el lugar"
        if tipo.costero:
            agua = 0
            for y in range(ty - 1, ty + h + 1):
                for x in range(tx - 1, tx + w + 1):
                    if (x < tx or x >= tx + w or y < ty or y >= ty + h) and m.dentro(x, y) \
                            and m.base_agua[y * m.w + x]:
                        agua += 1
            if agua < 3:
                return "El muelle debe levantarse en la costa"
        if tipo.deposito:
            dmin = self.cat.dist_recursos_cuartel
            for r in self.recursos.values():
                dx = max(0, r.tx - (tx + w), tx - (r.tx + r.w))
                dy = max(0, r.ty - (ty + h), ty - (r.ty + r.h))
                if max(dx, dy) < dmin:
                    return "Demasiado cerca de los yacimientos"
        return None

    def iniciar_construccion(self, j, tipo, tx, ty, constructor):
        j.pagar(j.stats[tipo.id].costo)
        b = self.crear_edificio(j.idx, tipo.id, tx, ty, construido=False)
        b.constructor = constructor.id if constructor is not None else 0
        self.ev_pos(b.x, b.y, "obra", b.id)
        return b

    def construir_paso(self, b, u):
        vel = u.tipo.vel_construccion if b.tipo.id in u.tipo.construye else 100
        total = b.tipo.tiempo * 100
        b.progreso += vel
        b.acum_vida += b.st.vida * 9 * vel
        div = 10 * total
        if b.acum_vida >= div:
            b.vida = min(b.st.vida, b.vida + b.acum_vida // div)
            b.acum_vida %= div
        if b.progreso >= total:
            b.vida = max(b.vida, b.st.vida * 95 // 100)
            b.vida = min(b.vida, b.st.vida)
            self._edificio_terminado(b)
            return True
        return False

    def cancelar_obra(self, b):
        if b.construido or not b.vivo:
            return
        j = self.jugadores[b.dueno]
        j.reembolsar(b.st.costo, 75)
        b.vivo = False
        self.muertos.append(b)
        self.ev_pos(b.x, b.y, "mue", b.id, b.tipo.idx, b.dueno, b.x >> 4, b.y >> 4, 0)

    def producir_unidad(self, b, ut):
        j = self.jugadores[b.dueno]
        hacia = (b.reunion[0], b.reunion[1]) if b.reunion else None
        x, y = self.punto_salida(b, ut.capa, hacia)
        u = self.crear_unidad(b.dueno, ut.id, x, y)
        j.est["unidades_creadas"] += 1
        self.ev_jugador(b.dueno, "lista", u.id, ut.idx)
        if b.reunion:
            rx, ry, rid = b.reunion
            obj = self.entidad(rid) if rid else None
            comandos.orden_reunion(self, u, rx, ry, obj)
        return u

    def refrescar_stats(self, j):
        """Tras una investigación: actualiza las referencias y la vida máxima."""
        for e in list(self.unidades.values()) + list(self.edificios.values()):
            if e.dueno != j.idx:
                continue
            nuevo = j.stats.get(e.tipo.id)
            if nuevo is None or nuevo is e.st:
                continue
            if nuevo.vida > e.st.vida and (e.es_unidad or e.construido):
                e.vida += nuevo.vida - e.st.vida
            e.st = nuevo
            e.vida = min(e.vida, nuevo.vida)

    # ------------------------------------------------------------------
    # Transportes y guarniciones
    def embarcar(self, cont, u):
        u.dentro = cont.id
        u.orden = None
        u.cola = []
        u.ruta = []
        u.ruta_meta = None
        u.objetivo = 0
        u.fantasma = False
        if cont.es_unidad:
            cont.cargamento.append(u.id)
        else:
            cont.guarnicion.append(u.id)
        self.ev_pos(cont.x, cont.y, "embarca", u.id, cont.id)

    def espacio_usado(self, ids):
        total = 0
        for i in ids:
            e = self.ent.get(i)
            if e is not None:
                total += e.tipo.espacio
        return total

    def punto_desembarco(self, barco, x, y):
        """Casilla de agua junto a la costa, cerca de (x, y), alcanzable por el barco."""
        m = self.mapa
        reg_agua = m.region[AGUA]
        i_barco = m.idx_de(barco.x, barco.y)
        region = reg_agua[i_barco]
        tx, ty = m.casilla(x, y)
        for r in range(0, 30):
            mejor = None
            mejor_d = None
            for yy in range(ty - r, ty + r + 1):
                if yy < 0 or yy >= m.h:
                    continue
                if r and yy != ty - r and yy != ty + r:
                    xs = (tx - r, tx + r)
                else:
                    xs = range(tx - r, tx + r + 1)
                for xx in xs:
                    if xx < 0 or xx >= m.w:
                        continue
                    i = yy * m.w + xx
                    if not m.base_agua[i] or reg_agua[i] != region:
                        continue
                    tierra = None
                    for dx, dy in ((0, 1), (1, 0), (0, -1), (-1, 0)):
                        xa, ya = xx + dx, yy + dy
                        if m.dentro(xa, ya) and m.pasable[TIERRA][ya * m.w + xa]:
                            tierra = ya * m.w + xa
                            break
                    if tierra is None:
                        continue
                    d = (xx - tx) ** 2 + (yy - ty) ** 2
                    if mejor_d is None or d < mejor_d:
                        mejor, mejor_d = (i, tierra), d
            if mejor is not None:
                cx, cy = m.centro_idx(mejor[0])
                return cx, cy, mejor[1]
        return None

    def desembarcar(self, barco, tierra_idx):
        m = self.mapa
        ty, tx = divmod(tierra_idx, m.w)
        region = m.region[TIERRA][tierra_idx]
        usadas = set()
        for uid in list(barco.cargamento):
            u = self.ent.get(uid)
            if u is None or not u.vivo:
                continue
            destino = None
            for r in range(0, 8):
                for yy in range(ty - r, ty + r + 1):
                    for xx in range(tx - r, tx + r + 1):
                        if max(abs(xx - tx), abs(yy - ty)) != r or not m.dentro(xx, yy):
                            continue
                        i = yy * m.w + xx
                        if i in usadas or not m.pasable[TIERRA][i] or m.region[TIERRA][i] != region:
                            continue
                        destino = i
                        break
                    if destino is not None:
                        break
                if destino is not None:
                    break
            if destino is None:
                break
            usadas.add(destino)
            u.x, u.y = m.centro_idx(destino)
            u.dentro = 0
            u.casa_x, u.casa_y = u.x, u.y
            barco.cargamento.remove(uid)
        self.ev_pos(barco.x, barco.y, "desembarca", barco.id)

    def vaciar_guarnicion(self, b):
        for uid in list(b.guarnicion):
            u = self.ent.get(uid)
            b.guarnicion.remove(uid)
            if u is None or not u.vivo:
                continue
            u.dentro = 0
            u.x, u.y = self.punto_salida(b, TIERRA)
            u.casa_x, u.casa_y = u.x, u.y

    # ------------------------------------------------------------------
    # Bajas
    def matar(self, e, atacante_id, dueno_atacante, explosion=False):
        if not e.vivo:
            return
        e.vivo = False
        self.muertos.append(e)
        if e.es_unidad or e.es_edificio:
            j = self.jugadores[e.dueno]
            if e.es_unidad:
                j.est["unidades_perdidas"] += 1
            else:
                j.est["edificios_perdidos"] += 1
            if dueno_atacante >= 0 and self.enemigos(dueno_atacante, e.dueno):
                ja = self.jugadores[dueno_atacante]
                if e.es_unidad:
                    ja.est["enemigos_abatidos"] += 1
                else:
                    ja.est["edificios_destruidos"] += 1
                a = self.ent.get(atacante_id)
                if a is not None and a.vivo and (a.es_unidad or a.es_edificio):
                    a.abatidos += 1
            self.ev_pos(e.x, e.y, "mue", e.id, e.tipo.idx, e.dueno, e.x >> 4, e.y >> 4, 1 if explosion else 0)

    def agotar(self, r):
        if r.rtipo == "salitre" and r.vivo:
            r.vivo = False
            self.muertos.append(r)
            self.ev_pos(r.x, r.y, "agotado", r.id)

    def _limpiar(self):
        while self.muertos:
            lote = self.muertos
            self.muertos = []
            for e in lote:
                if self.ent.get(e.id) is not e:
                    continue
                del self.ent[e.id]
                if e.es_unidad:
                    self._quitar_unidad(e)
                elif e.es_edificio:
                    self._quitar_edificio(e)
                elif e.es_recurso:
                    del self.recursos[e.id]
                    self.mapa.liberar(e.tx, e.ty, e.w, e.h)
                elif e.es_mina:
                    del self.minas[e.id]
                    if e.dueno >= 0:
                        self.jugadores[e.dueno].minas -= 1

    def _quitar_unidad(self, u):
        del self.unidades[u.id]
        j = self.jugadores[u.dueno]
        j.pob_usada -= u.tipo.poblacion
        if u.tipo.heroe:
            j.heroes.discard(u.tipo.id)
        for cid in u.cargamento:
            c = self.ent.get(cid)
            if c is not None and c.vivo:
                c.dentro = 0
                self.matar(c, 0, -1)
        u.cargamento = []
        if u.dentro:
            cont = self.ent.get(u.dentro)
            if cont is not None:
                if cont.es_unidad and u.id in cont.cargamento:
                    cont.cargamento.remove(u.id)
                elif cont.es_edificio:
                    if u.id in cont.guarnicion:
                        cont.guarnicion.remove(u.id)
                    if cont.ocupante == u.id:
                        cont.ocupante = 0

    def _quitar_edificio(self, b):
        del self.edificios[b.id]
        self.rejilla_edif.quitar(b)
        j = self.jugadores[b.dueno]
        if b.tipo.sobre_recurso:
            pozo = self.ent.get(b.pozo)
            if pozo is not None and pozo.molino == b.id:
                pozo.molino = 0
        else:
            self.mapa.liberar(b.tx, b.ty, b.w, b.h)
        if b.construido:
            j.terminados[b.tipo.id] = j.terminados.get(b.tipo.id, 1) - 1
            self.recalcular_pob(j)
        for item in b.cola:
            if item[0] == "u":
                ut = self.cat.unidades[item[1]]
                if item[4]:
                    j.pob_usada -= ut.poblacion
                if ut.heroe:
                    j.heroes.discard(ut.id)
            else:
                j.investigando.discard(item[1])
        b.cola = []
        self.vaciar_guarnicion(b)
        if b.ocupante:
            u = self.ent.get(b.ocupante)
            b.ocupante = 0
            if u is not None and u.vivo:
                u.dentro = 0
                u.x, u.y = self.punto_salida(b, TIERRA)

    # ------------------------------------------------------------------
    # Caminos
    def pedir_ruta(self, u, x, y):
        u.ruta = []
        u.ruta_meta = (x, y)
        if u.ruta_pend is None:
            self.cola_rutas.append(u.id)
        u.ruta_pend = (x, y)

    def ruta_inmediata(self, u, x, y, presupuesto=6000):
        u.ruta = calcular_ruta(self.mapa, self.buscador, u.capa, u.x, u.y, x, y, presupuesto)
        u.ruta_meta = (x, y)
        u.ruta_pend = None
        return u.ruta

    def _procesar_rutas(self):
        if not self.cola_rutas:
            return
        presupuesto = PRESUPUESTO_RUTAS
        cola = self.cola_rutas
        i = 0
        while i < len(cola) and presupuesto > 0:
            u = self.ent.get(cola[i])
            i += 1
            if u is None or not u.vivo or u.ruta_pend is None:
                continue
            x, y = u.ruta_pend
            antes = self.buscador.expandidos
            u.ruta = calcular_ruta(self.mapa, self.buscador, u.capa, u.x, u.y, x, y,
                                   min(4000, max(500, presupuesto)))
            u.ruta_pend = None
            presupuesto -= (self.buscador.expandidos - antes) + 25
        self.cola_rutas = cola[i:]

    # ------------------------------------------------------------------
    # Programación de acciones diferidas
    def programar(self, tick, accion, *datos):
        self._seq += 1
        heapq.heappush(self.programados, (tick, self._seq, accion, datos))

    def _ejecutar_programados(self):
        t = self.tick
        while self.programados and self.programados[0][0] <= t:
            _t, _s, accion, datos = heapq.heappop(self.programados)
            habilidades.ejecutar_programado(self, accion, datos)

    # ------------------------------------------------------------------
    def comando(self, p, cmd):
        """Encola un comando del jugador p para el próximo tick."""
        if isinstance(cmd, dict) and 0 <= p < len(self.jugadores):
            self.pendientes.append((p, cmd))

    def paso(self):
        if self.terminado:
            return
        self.tick += 1
        t = self.tick
        self.eventos = []
        pend = self.pendientes
        self.pendientes = []
        for p, cmd in pend:
            if self.registro is not None:
                self.registro.append((t, p, cmd))
            try:
                comandos.aplicar(self, p, cmd)
            except (KeyError, ValueError, TypeError, IndexError, AttributeError):
                self.ev_jugador(p, "err", "Orden no válida")
        self._ejecutar_programados()
        self.rejilla.reconstruir(self.unidades.values())
        self._procesar_rutas()
        for b in list(self.edificios.values()):
            if b.vivo:
                logica_edificios.actualizar(self, b)
        for u in list(self.unidades.values()):
            if u.vivo and not u.dentro:
                comportamiento.actualizar(self, u)
        self.rejilla.reconstruir(self.unidades.values())
        comportamiento.separar(self)
        if self.proyectiles:
            quedan = []
            for pr in self.proyectiles:
                if pr.llega <= t:
                    combate.impacto(self, pr)
                else:
                    quedan.append(pr)
            self.proyectiles = quedan
        if self.minas and t % 2 == 0:
            self._minas()
        if t % 8 == 0:
            self._auras()
        self._limpiar()
        if t % 4 == 0:
            self._actualizar_vision()
        if t % 16 == 0:
            self._comprobar_victoria()
            self._limpiar()

    def _minas(self):
        t = self.tick
        for mi in list(self.minas.values()):
            if not mi.vivo or mi.armada_t > t:
                continue
            act = mi.activacion
            for e in self.rejilla.cerca(mi.x, mi.y, act + TILE):
                if not e.vivo or e.capa != TIERRA or not self.enemigos(mi.dueno, e.dueno):
                    continue
                dx = e.x - mi.x
                dy = e.y - mi.y
                lim = act + e.radio
                if dx * dx + dy * dy <= lim * lim:
                    mi.vivo = False
                    self.muertos.append(mi)
                    combate.explotar(self, mi.x, mi.y, mi.radio_expl, mi.danio, mi.tipo_danio,
                                     mi.dueno, mi.id, solo_tierra=True)
                    break

    def _auras(self):
        unidades = self.unidades.values()
        for u in unidades:
            if u.aura:
                u.aura = {}
        for u in unidades:
            tipo = u.tipo
            if not tipo.aura_radio or not u.vivo or u.dentro:
                continue
            r = tipo.aura_radio
            r2 = r * r
            for v in self.rejilla.cerca(u.x, u.y, r):
                if not v.vivo or not self.aliados(u.dueno, v.dueno):
                    continue
                dx = v.x - u.x
                dy = v.y - u.y
                if dx * dx + dy * dy > r2:
                    continue
                for ef in tipo.aura_efectos:
                    if ef.filtro.unidad(v.tipo) and ef.suma > v.aura.get(ef.campo, 0):
                        if not v.aura:
                            v.aura = {}
                        v.aura[ef.campo] = ef.suma
        for b in self.edificios.values():
            if not b.vivo or not b.construido or not b.tipo.regen_radio:
                continue
            r = b.tipo.regen_radio
            for v in self.rejilla.cerca(b.x, b.y, r + b.radio):
                if not v.vivo or not v.tipo.biologica or not self.aliados(b.dueno, v.dueno):
                    continue
                if combate.dist2_a(v.x, v.y, b) <= r * r:
                    if b.tipo.regen_hps > v.aura.get("regeneracion", 0):
                        v.aura["regeneracion"] = b.tipo.regen_hps

    def _actualizar_vision(self):
        m = self.mapa
        t = self.tick
        w = m.w
        obs = {eq: [] for eq in self.equipos}
        dets = {eq: [] for eq in self.equipos}
        rev = {eq: [] for eq in self.equipos}
        eq_de = [j.equipo for j in self.jugadores]
        for u in self.unidades.values():
            if not u.vivo or u.dentro:
                continue
            eq = eq_de[u.dueno]
            tx, ty = m.casilla(u.x, u.y)
            obs[eq].append((tx, ty, u.st.vision, m.nivel[ty * w + tx]))
            if u.tipo.detector:
                dets[eq].append((tx, ty, u.tipo.detector / TILE))
        for b in self.edificios.values():
            if not b.vivo:
                continue
            eq = eq_de[b.dueno]
            tx, ty = m.casilla(b.x, b.y)
            radio = (b.st.vision if b.construido else 3) + max(b.w, b.h) / 2
            obs[eq].append((tx, ty, radio, m.nivel[ty * w + tx]))
            if b.construido and b.tipo.detector:
                dets[eq].append((tx, ty, b.tipo.detector / TILE + max(b.w, b.h) / 2))
        vigentes = []
        for item in self.revelados:
            eq, tx, ty, radio, hasta = item
            if hasta > t:
                vigentes.append(item)
                rev[eq].append((tx, ty, radio))
                dets[eq].append((tx, ty, radio))
        self.revelados = vigentes
        for eq in self.equipos:
            vis = mod_vision.calcular(m, obs[eq], rev[eq])
            self.vis[eq] = vis
            self.explorado[eq] = mod_vision.unir(self.explorado[eq], vis)
            self.det[eq] = mod_vision.deteccion(m, dets[eq])

    def _comprobar_victoria(self):
        con_edificios = set()
        for b in self.edificios.values():
            if b.vivo:
                con_edificios.add(b.dueno)
        for j in self.jugadores:
            if j.vivo and (j.idx not in con_edificios or j.rendido):
                j.vivo = False
                self.ev_todos("derrota", j.idx)
                for e in list(self.unidades.values()) + list(self.edificios.values()):
                    if e.dueno == j.idx and e.vivo:
                        self.matar(e, 0, -1)
        equipos_vivos = {j.equipo for j in self.jugadores if j.vivo}
        if len(self.jugadores) > 1 and len(equipos_vivos) <= 1 or not equipos_vivos:
            self.terminado = True
            self.ganador = next(iter(equipos_vivos)) if equipos_vivos else None
            self.ev_todos("fin", -1 if self.ganador is None else self.ganador)

    # ------------------------------------------------------------------
    def suma_control(self):
        h = 1469598103934665603
        mask = (1 << 64) - 1
        for e in self.ent.values():
            h = ((h ^ (e.id * 2654435761 + e.x * 31 + e.y * 17 + e.vida)) * 1099511628211) & mask
        for j in self.jugadores:
            h = ((h ^ (j.salitre * 7 + j.agua * 13 + j.pob_usada)) * 1099511628211) & mask
        return h

    def distancia(self, a, b):
        return isqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
