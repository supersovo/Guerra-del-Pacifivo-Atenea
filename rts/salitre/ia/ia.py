"""Adversario controlado por la computadora.

Juega con las mismas reglas que una persona: solo actúa mediante comandos
(los mismos que envía el cliente), que el mundo valida. Lleva la economía
(trabajadores, molinos, depósitos y expansiones), sigue un orden de
construcción por niveles tecnológicos, forma un ejército mixto, investiga,
defiende su base, ataca por oleadas cada vez mayores, usa las habilidades de
sus héroes y, si el enemigo está en otra isla, embarca a su ejército.
"""

from math import isqrt

from ..sim.azar import Azar
from ..sim.constantes import AGUA, TICKS, TIERRA, TILE
from ..sim.entidades import ATACAR_MOVER, CARGAR, CONSTRUIR, RECOLECTAR, REPARAR

DIFICULTADES = {
    "facil": {"nombre": "Recluta", "periodo": 24, "trabajadores": 12, "ataque": 12, "incremento": 6,
              "barracas": 1, "investiga": False, "expandir": False, "obras": 1, "agua": 2,
              "habilidades": False},
    "normal": {"nombre": "Soldado de línea", "periodo": 12, "trabajadores": 18, "ataque": 20,
               "incremento": 8, "barracas": 2, "investiga": True, "expandir": True, "obras": 2,
               "agua": 3, "habilidades": True},
    "dificil": {"nombre": "Veterano de la campaña", "periodo": 6, "trabajadores": 22, "ataque": 24,
                "incremento": 10, "barracas": 3, "investiga": True, "expandir": True, "obras": 3,
                "agua": 3, "habilidades": True},
}

# (edificio, trabajadores mínimos, cantidad deseada)
ORDEN_CONSTRUCCION = [
    ("barracas", 9, 1),
    ("molino_agua", 11, 1),
    ("hospital_campana", 12, 1),
    ("barracon_instruccion", 13, 1),
    ("maestranza", 14, 1),
    ("barracas", 15, 2),
    ("caballeriza", 16, 1),
    ("molino_agua", 16, 2),
    ("central_telegrafos", 17, 1),
    ("parque_artilleria", 17, 1),
    ("estado_mayor", 18, 1),
    ("reducto", 18, 1),
    ("barracas", 20, 3),
]

INVESTIGACIONES = [
    "armas_infanteria_1", "blindaje_infanteria_1", "orden_disperso", "cirugia_campana",
    "armas_caballeria_1", "herraje", "armas_infanteria_2", "blindaje_infanteria_2", "alza_mira",
    "armas_artilleria_1", "carga_sable", "manivela_rapida", "paso_trote", "blindaje_caballeria_1",
    "armas_infanteria_3", "blindaje_infanteria_3", "armas_caballeria_2", "armas_artilleria_2",
    "dinamita_alto_poder", "academia_guerra", "blindaje_caballeria_2", "botiquines",
]

ESPECIAL_BARRACAS = ("zapador", "torpedista", "montonero", "colorado")


class IA:
    def __init__(self, mundo, p, dificultad="normal"):
        self.m = mundo
        self.p = p
        self.j = mundo.jugadores[p]
        self.dif = DIFICULTADES.get(dificultad, DIFICULTADES["normal"])
        self.azar = Azar(mundo.semilla * 31 + p * 977 + 5)
        self.umbral = self.dif["ataque"]
        self.oleadas = 0
        self.atacando = set()
        self.objetivo = None
        self.naval = None
        self.reunion = None
        self.ultimo_reconocimiento = -9999
        self.zonas_mineras = []
        self.expansiones = []
        self.reserva = (0, 0)
        self._cache_lugar = {}
        self.gasto = [0, 0]
        self.vetados = set()
        self.pedidos = {}
        self.explorador = None
        self.region_base = None
        self._preparado = False

    # ------------------------------------------------------------------
    def actualizar(self):
        m = self.m
        if not self.j.vivo or m.terminado:
            return
        if (m.tick + self.p * 3) % self.dif["periodo"]:
            return
        self._cache_lugar = {}
        self.gasto = [0, 0]
        self._censo()
        if not self.cgs and not self.trabajadores:
            return
        if not self._preparado:
            self._preparar()
        self._revisar_pedidos()
        self._trabajadores_ociosos()
        self._entrenar_trabajadores()
        self._suministro()
        self._construcciones()
        self._produccion()
        if self.dif["investiga"]:
            self._investigar()
        self._militar()
        if self.dif["habilidades"]:
            self._habilidades()

    def cmd(self, **c):
        self.m.comando(self.p, c)

    def _puedo(self, costo):
        """¿Alcanza el dinero, descontando lo ya comprometido en esta actualización?"""
        return (self.j.dinero - self.gasto[0] >= costo[0]
                and self.j.agua - self.gasto[1] >= costo[1])

    def _gastar(self, costo):
        self.gasto[0] += costo[0]
        self.gasto[1] += costo[1]

    # ------------------------------------------------------------------
    def _censo(self):
        m = self.m
        p = self.p
        self.unidades = [u for u in m.unidades.values() if u.dueno == p and u.vivo]
        self.edificios = [b for b in m.edificios.values() if b.dueno == p and b.vivo]
        self.por_tipo = {}
        for e in self.unidades + self.edificios:
            self.por_tipo.setdefault(e.tipo.id, []).append(e)
        self.trabajadores = self.por_tipo.get("trabajador", [])
        self.cgs = [b for b in self.por_tipo.get("cuartel_general", []) if b.construido]
        self.ejercito = [u for u in self.unidades
                         if not u.tipo.trabajador and u.capa == TIERRA and not u.dentro
                         and (u.tipo.arma is not None or u.tipo.curar_ritmo)]
        self.en_cola = {}
        for b in self.edificios:
            for item in b.cola:
                self.en_cola[item[1]] = self.en_cola.get(item[1], 0) + 1
        self.obras = [b for b in self.edificios if not b.construido]

    def _contar(self, tid):
        return len(self.por_tipo.get(tid, [])) + self.en_cola.get(tid, 0) + sum(
            1 for u in self.trabajadores if u.orden is not None and u.orden.tipo == CONSTRUIR
            and u.fase == 0 and u.orden.dato == tid)

    def _preparar(self):
        m = self.m
        self._preparado = True
        base = self.cgs[0] if self.cgs else self.edificios[0]
        self.base = (base.x, base.y)
        mp = m.mapa
        i = mp.pasable_cercana(TIERRA, base.tx + base.w // 2, base.ty + base.h, 4)
        self.region_base = mp.region[TIERRA][i] if i is not None else None
        # zonas de extracción que no se deben tapar con edificios
        for cg in self.cgs:
            self.zonas_mineras.append(self._zona_minera(cg))
        # punto de reunión: entre la base y el centro del mapa
        cx, cy = m.mapa.ancho_sub // 2, m.mapa.alto_sub // 2
        rx = base.x + (cx - base.x) * 18 // 100
        ry = base.y + (cy - base.y) * 18 // 100
        i = m.mapa.pasable_cercana(TIERRA, rx // TILE, ry // TILE, 10)
        self.reunion = m.mapa.centro_idx(i) if i is not None else (base.x, base.y)

    def _zona_minera(self, cg):
        x0, y0 = cg.tx, cg.ty
        x1, y1 = cg.tx + cg.w, cg.ty + cg.h
        for r in self.m.recursos.values():
            if abs(r.x - cg.x) <= 12 * TILE and abs(r.y - cg.y) <= 12 * TILE:
                x0 = min(x0, r.tx)
                y0 = min(y0, r.ty)
                x1 = max(x1, r.tx + r.w)
                y1 = max(y1, r.ty + r.h)
        return (x0 - 1, y0 - 1, x1 + 1, y1 + 1)

    # ------------------------------------------------------------------
    # Economía
    def _trabajadores_ociosos(self):
        molinos = [b for b in self.por_tipo.get("molino_agua", []) if b.construido]
        en_agua = {}
        en_salitre = {}
        for u in self.trabajadores:
            o = u.orden
            if o is not None and o.tipo == RECOLECTAR:
                if o.dato == "agua":
                    en_agua[o.obj] = en_agua.get(o.obj, 0) + 1
                else:
                    en_salitre[o.obj] = en_salitre.get(o.obj, 0) + 1
        cupo = self.dif["agua"]
        if self.j.agua > 900 and self.j.dinero < 400:
            cupo = 1
            # sobra agua: los aguateros de más vuelven al salitre
            for mol in molinos:
                sobran = en_agua.get(mol.pozo, 0) - cupo
                for u in self.trabajadores:
                    if sobran <= 0:
                        break
                    o = u.orden
                    if o is not None and o.tipo == RECOLECTAR and o.dato == "agua" and o.obj == mol.pozo \
                            and not u.dentro and not u.carga:
                        r = self._salitre_para(u, en_salitre)
                        if r is not None:
                            self.cmd(c="recolectar", u=[u.id], t=r.id)
                            en_salitre[r.id] = en_salitre.get(r.id, 0) + 1
                            sobran -= 1
                en_agua[mol.pozo] = cupo
        for u in self.trabajadores:
            if u.orden is not None or u.dentro:
                continue
            asignado = False
            for mol in molinos:
                if en_agua.get(mol.pozo, 0) < cupo:
                    self.cmd(c="recolectar", u=[u.id], t=mol.pozo)
                    en_agua[mol.pozo] = en_agua.get(mol.pozo, 0) + 1
                    asignado = True
                    break
            if asignado:
                continue
            r = self._salitre_para(u, en_salitre)
            if r is not None:
                self.cmd(c="recolectar", u=[u.id], t=r.id)
                en_salitre[r.id] = en_salitre.get(r.id, 0) + 1

    def _salitre_para(self, u, asignados):
        mejor = None
        mejor_k = None
        for r in self.m.recursos.values():
            if r.rtipo != "salitre" or not r.vivo or r.cantidad <= 0:
                continue
            cerca_cg = any(abs(r.x - cg.x) <= 12 * TILE and abs(r.y - cg.y) <= 12 * TILE for cg in self.cgs)
            if not cerca_cg:
                continue
            d = (r.x - u.x) ** 2 + (r.y - u.y) ** 2
            k = (asignados.get(r.id, 0), d, r.id)
            if mejor_k is None or k < mejor_k:
                mejor, mejor_k = r, k
        return mejor

    def _entrenar_trabajadores(self):
        objetivo = self.dif["trabajadores"] * max(1, len(self.cgs))
        objetivo = min(objetivo, 60)
        actuales = len(self.trabajadores) + self.en_cola.get("trabajador", 0)
        if actuales >= objetivo:
            return
        costo = self.j.stats["trabajador"].costo
        for cg in self.cgs:
            if len(cg.cola) < 2 and self._puedo(costo):
                self.cmd(c="entrenar", e=[cg.id], t="trabajador")
                self._gastar(costo)
                actuales += 1
                if actuales >= objetivo:
                    return

    def _suministro(self):
        j = self.j
        if j.pob_max >= self.m.cat.poblacion_maxima:
            return
        productores = sum(1 for b in self.edificios if b.construido and b.tipo.produce)
        margen = 3 + 2 * productores
        en_obra = sum(1 for b in self.obras if b.tipo.poblacion) + sum(
            1 for u in self.trabajadores if u.orden is not None and u.orden.tipo == CONSTRUIR
            and u.fase == 0 and self.m.cat.edificios[u.orden.dato].poblacion)
        if j.pob_usada + margen >= j.pob_max + en_obra * 10 and en_obra < 1 + productores // 4:
            self._construir("deposito")

    def _construcciones(self):
        j = self.j
        en_curso = len(self.obras) + sum(1 for u in self.trabajadores if u.orden is not None
                                         and u.orden.tipo == CONSTRUIR and u.fase == 0)
        if en_curso >= self.dif["obras"]:
            return
        self.reserva = (0, 0)
        n_trab = len(self.trabajadores)
        if self.naval is not None and self._contar("muelle") < 1 and j.tiene("maestranza"):
            costo = j.stats["muelle"].costo
            if not self._puedo(costo):
                self.reserva = costo
                return
            if self._construir("muelle"):
                return
        for tid, minimo, cantidad in ORDEN_CONSTRUCCION:
            if tid not in j.faccion.edificios or n_trab < minimo:
                continue
            if tid == "barracas" and cantidad > self.dif["barracas"]:
                continue
            if self._contar(tid) >= cantidad:
                continue
            tipo = self.m.cat.edificios[tid]
            if not j.requisitos(tipo):
                continue
            tipo_e = self.m.cat.edificios[tid]
            if self._lugar(tipo_e) is None:
                continue
            costo = j.stats[tid].costo
            if not self._puedo(costo):
                # se ahorra para la próxima obra del plan
                self.reserva = costo
                return
            self._construir(tid)
            return
        # expansión
        if self.dif["expandir"] and len(self.cgs) < 3 and self._contar("cuartel_general") <= len(self.cgs):
            minutos = self.m.tick / (TICKS * 60)
            if (minutos > 7 and len(self.cgs) == 1) or (minutos > 14 and len(self.cgs) == 2) \
                    or self._salitre_cerca() < 1500:
                if self._expandir():
                    return
        # más barracas si sobra salitre
        if j.dinero > 700 and self._contar("barracas") < self.dif["barracas"] + 1:
            self._construir("barracas")
        if "fortin" in j.faccion.edificios and self._contar("fortin") < 2 and n_trab >= 14:
            self._construir("fortin")

    def _salitre_cerca(self):
        total = 0
        for r in self.m.recursos.values():
            if r.rtipo == "salitre" and any(abs(r.x - cg.x) <= 12 * TILE and abs(r.y - cg.y) <= 12 * TILE
                                            for cg in self.cgs):
                total += r.cantidad
        return total

    def _constructor(self, x, y):
        mejor = None
        mejor_k = None
        for u in self.trabajadores:
            if u.dentro:
                continue
            o = u.orden
            if o is not None and o.tipo in (CONSTRUIR, REPARAR):
                continue
            if o is not None and o.tipo == RECOLECTAR and (u.carga or u.fase == 2):
                continue
            k = ((u.x - x) ** 2 + (u.y - y) ** 2, u.id)
            if mejor_k is None or k < mejor_k:
                mejor, mejor_k = u, k
        return mejor

    def _construir(self, tid):
        j = self.j
        tipo = self.m.cat.edificios[tid]
        if not self._puedo(j.stats[tid].costo) or not j.requisitos(tipo):
            return False
        lugar = self._lugar(tipo)
        if lugar is None:
            return False
        tx, ty = lugar
        u = self._constructor(tx * TILE, ty * TILE)
        if u is None:
            return False
        self.cmd(c="construir", u=[u.id], e=tid, tx=tx, ty=ty)
        self._gastar(j.stats[tid].costo)
        self._cache_lugar = {}
        self.pedidos[u.id] = (tid, tx, ty, self.m.tick)
        return True

    def _revisar_pedidos(self):
        """Veta los lugares donde una obra no se pudo empezar (inalcanzables u ocupados)."""
        m = self.m
        for uid, (tid, tx, ty, t0) in list(self.pedidos.items()):
            if m.tick - t0 < 4:
                continue
            u = m.entidad(uid)
            o = u.orden if u is not None else None
            sigue = o is not None and o.tipo == CONSTRUIR and o.dato == tid and o.x == tx and o.y == ty
            if sigue and u.fase == 0 and m.tick - t0 > TICKS * 60:
                self.vetados.add((tid, tx, ty))
                self.cmd(c="detener", u=[uid])
                del self.pedidos[uid]
            elif not sigue or u.fase >= 1:
                levantado = any(b.tipo.id == tid and b.tx == tx and b.ty == ty for b in self.edificios)
                if not levantado and not sigue:
                    self.vetados.add((tid, tx, ty))
                del self.pedidos[uid]

    def _lugar(self, tipo):
        if tipo.id in self._cache_lugar:
            return self._cache_lugar[tipo.id]
        r = self._buscar_lugar(tipo)
        self._cache_lugar[tipo.id] = r
        return r

    def _buscar_lugar(self, tipo):
        m = self.m
        if tipo.sobre_recurso:
            mejor = None
            mejor_d = None
            for r in m.recursos.values():
                if r.rtipo != "agua" or (r.molino and m.entidad(r.molino) is not None):
                    continue
                if any(u.orden is not None and u.orden.tipo == CONSTRUIR and u.orden.x == r.tx
                       and u.orden.y == r.ty for u in self.trabajadores):
                    continue
                d = min(((r.x - cg.x) ** 2 + (r.y - cg.y) ** 2 for cg in self.cgs), default=None)
                if d is None or d > (16 * TILE) ** 2:
                    continue
                if m.validar_lugar(self.p, tipo, r.tx, r.ty) is None and (mejor_d is None or d < mejor_d):
                    mejor, mejor_d = (r.tx, r.ty), d
            return mejor
        if tipo.costero:
            return self._lugar_costero(tipo)
        cg = self.cgs[0] if self.cgs else self.edificios[0]
        cx, cy = cg.tx + cg.w // 2, cg.ty + cg.h // 2
        giro = self.azar.entero(4)
        for r in range(3, 22):
            cand = []
            for dy in range(-r, r + 1):
                for dx in (-r, r) if abs(dy) != r else range(-r, r + 1):
                    cand.append((cx + dx - tipo.ancho // 2, cy + dy - tipo.alto // 2))
            k = len(cand)
            inicio = (giro * k) // 4
            for i in range(k):
                tx, ty = cand[(inicio + i) % k]
                if self._apto(tipo, tx, ty) and m.validar_lugar(self.p, tipo, tx, ty) is None:
                    return tx, ty
        return None

    def _apto(self, tipo, tx, ty):
        m = self.m
        mp = m.mapa
        if (tipo.id, tx, ty) in self.vetados:
            return False
        if mp.dentro(tx, ty) and self.region_base is not None:
            if mp.region[TIERRA][ty * mp.w + tx] != self.region_base:
                return False
        x0, y0, x1, y1 = tx - 1, ty - 1, tx + tipo.ancho + 1, ty + tipo.alto + 1
        for zx0, zy0, zx1, zy1 in self.zonas_mineras:
            if x0 < zx1 and x1 > zx0 and y0 < zy1 and y1 > zy0:
                return False
        mp = m.mapa
        for y in range(y0, y1):
            for x in range(x0, x1):
                if not mp.dentro(x, y):
                    return False
                if mp.ocupado[y * mp.w + x]:
                    return False
        for u in self.trabajadores:
            o = u.orden
            if o is not None and o.tipo == CONSTRUIR and u.fase == 0:
                ot = m.cat.edificios.get(o.dato)
                if ot and x0 < o.x + ot.ancho + 1 and x1 > o.x - 1 and y0 < o.y + ot.alto + 1 and y1 > o.y - 1:
                    return False
        return True

    def _lugar_costero(self, tipo):
        m = self.m
        mp = m.mapa
        cg = self.cgs[0] if self.cgs else self.edificios[0]
        cx, cy = cg.tx, cg.ty
        for r in range(3, 30):
            for dy in range(-r, r + 1):
                for dx in (-r, r) if abs(dy) != r else range(-r, r + 1):
                    tx, ty = cx + dx, cy + dy
                    if not mp.dentro(tx, ty):
                        continue
                    if self._apto(tipo, tx, ty) and m.validar_lugar(self.p, tipo, tx, ty) is None:
                        return tx, ty
        return None

    def _expandir(self):
        m = self.m
        tipo = m.cat.edificios["cuartel_general"]
        if not self._puedo(self.j.stats["cuartel_general"].costo):
            return False
        base_reg = m.mapa.region[TIERRA][m.mapa.idx_de(*self.base)]
        grupos = []
        for r in m.recursos.values():
            if r.rtipo != "salitre" or r.cantidad <= 0:
                continue
            if any(abs(r.x - b.x) <= 14 * TILE and abs(r.y - b.y) <= 14 * TILE for b in self.edificios):
                continue
            if any(abs(r.x - b.x) <= 14 * TILE and abs(r.y - b.y) <= 14 * TILE
                   for b in m.edificios.values() if b.dueno != self.p):
                continue
            if m.mapa.region[TIERRA][m.mapa.idx_de(r.x, r.y + TILE)] != base_reg and \
                    m.mapa.pasable_cercana(TIERRA, r.tx, r.ty + 1, 3, base_reg) is None:
                continue
            grupos.append(r)
        if not grupos:
            return False
        bx, by = self.base
        r0 = min(grupos, key=lambda r: ((r.x - bx) ** 2 + (r.y - by) ** 2, r.id))
        expl = m.explorado[m.equipo_de(self.p)]
        if not expl[m.mapa.idx_de(r0.x, r0.y)] or not expl[m.mapa.idx_de(r0.x, r0.y + 4 * TILE)]:
            # primero hay que reconocer el terreno: va un trabajador
            if self.explorador is None or m.entidad(self.explorador) is None:
                u = self._constructor(r0.x, r0.y)
                if u is not None:
                    self.explorador = u.id
                    self.cmd(c="mover", u=[u.id], x=r0.x // 16, y=(r0.y + 3 * TILE) // 16)
            return True
        # busca un lugar a la distancia mínima de los yacimientos, cerca del grupo
        mejor = None
        mejor_d = None
        for ty in range(r0.ty - 9, r0.ty + 10):
            for tx in range(r0.tx - 9, r0.tx + 10):
                if m.validar_lugar(self.p, tipo, tx, ty) is not None:
                    continue
                d = (tx + 2 - r0.tx) ** 2 + (ty + 1 - r0.ty) ** 2
                if mejor_d is None or d < mejor_d:
                    mejor, mejor_d = (tx, ty), d
        if mejor is None:
            return False
        u = m.entidad(self.explorador) if self.explorador else None
        if u is None:
            u = self._constructor(mejor[0] * TILE, mejor[1] * TILE)
        if u is not None:
            self.cmd(c="construir", u=[u.id], e="cuartel_general", tx=mejor[0], ty=mejor[1])
            self._gastar(self.j.stats["cuartel_general"].costo)
            self.pedidos[u.id] = ("cuartel_general", mejor[0], mejor[1], m.tick)
            self.explorador = None
            return True
        return False

    # ------------------------------------------------------------------
    # Producción
    def _produccion(self):
        j = self.j
        fac = j.faccion
        if self.reserva == (0, 0) and j.tiene("estado_mayor"):
            for h in fac.heroes:
                if self.m.cat.unidades[h].capa == TIERRA and h not in j.heroes:
                    self.reserva = j.stats[h].costo
                    break
        inf = len(self.por_tipo.get("infante", [])) + self.en_cola.get("infante", 0)
        planifica = j.dinero < 150 and len(self.obras) == 0 and self._contar("barracas") == 0
        if planifica:
            return
        for b in self.edificios:
            if not b.construido or len(b.cola) >= 2 or b.sabotaje_hasta > self.m.tick:
                continue
            tid = None
            t = b.tipo.id
            if t == "barracas":
                tid = self._eleccion_barracas(inf)
            elif t == "caballeriza":
                opciones = [u for u in ("granadero", "cazador") if u in fac.unidades]
                if "baqueano" in fac.unidades and self._contar("baqueano") < 2:
                    opciones = ["baqueano"]
                tid = opciones[self.azar.entero(len(opciones))] if opciones else None
            elif t == "parque_artilleria":
                opciones = ["artilleria_montana", "canon_campana", "gatling"]
                tid = opciones[self.azar.entero(3)]
            elif t == "estado_mayor":
                for h in fac.heroes:
                    ht = self.m.cat.unidades[h]
                    if ht.capa == TIERRA and h not in j.heroes:
                        tid = h
                        if self.reserva == j.stats[h].costo:
                            self.reserva = (0, 0)
                        break
                if tid is None and self._contar("espia") < 1:
                    tid = "espia"
            elif t == "muelle" and self.naval is not None:
                if self._contar("transporte") < 3:
                    tid = "transporte"
            if tid is None or tid not in fac.unidades:
                continue
            ut = self.m.cat.unidades[tid]
            costo = j.stats[tid].costo
            reserva = (costo[0] + self.reserva[0], costo[1] + self.reserva[1])
            if not j.requisitos(ut) or not self._puedo(reserva):
                continue
            if j.pob_usada + ut.poblacion > j.pob_max:
                continue
            self.cmd(c="entrenar", e=[b.id], t=tid)
            self._gastar(costo)
            self.en_cola[tid] = self.en_cola.get(tid, 0) + 1
            if self.reunion and not b.reunion:
                self.cmd(c="reunion", e=[b.id], x=self.reunion[0] // 16, y=self.reunion[1] // 16)

    def _eleccion_barracas(self, inf):
        j = self.j
        fac = j.faccion
        if "cantinera" in fac.unidades and j.tiene("hospital_campana") \
                and self._contar("cantinera") * 7 < inf:
            return "cantinera"
        if "ingeniero" in fac.unidades and j.tiene("barracon_instruccion") \
                and self._contar("ingeniero") * 9 < inf:
            return "ingeniero"
        for esp in ESPECIAL_BARRACAS:
            if esp in fac.unidades and j.tiene("barracon_instruccion"):
                cuota = 4 if esp in ("colorado", "montonero") else 2
                if self._contar(esp) * 5 < inf and self._contar(esp) < cuota * 3:
                    return esp
        return "infante"

    def _investigar(self):
        j = self.j
        if j.dinero < 300 or j.agua < 150:
            return
        cat = self.m.cat
        for mid in INVESTIGACIONES:
            mej = cat.mejoras.get(mid)
            if mej is None or mid in j.mejoras or mid in j.investigando:
                continue
            if mej.previa and mej.previa not in j.mejoras:
                continue
            if any(not j.tiene(r) for r in mej.requisitos):
                continue
            eds = [b for b in self.por_tipo.get(mej.edificio, []) if b.construido and not b.cola]
            reserva = (mej.costo[0] + self.reserva[0], mej.costo[1] + self.reserva[1])
            if not eds or not self._puedo(reserva):
                continue
            self.cmd(c="investigar", e=eds[0].id, m=mid)
            self._gastar(mej.costo)
            return

    # ------------------------------------------------------------------
    # Ejército
    def _amenaza(self):
        m = self.m
        mejor = None
        mejor_n = 0
        for b in self.edificios:
            n = 0
            px = py = 0
            for e in m.rejilla.cerca(b.x, b.y, 12 * TILE):
                if e.vivo and m.enemigos(self.p, e.dueno) and not e.dentro and m.visible(self.p, e.x, e.y) \
                        and not (e.oculta and not m.detectado(self.p, e)):
                    n += 1
                    px += e.x
                    py += e.y
            if n > mejor_n:
                mejor_n = n
                mejor = (px // n, py // n)
        return mejor, mejor_n

    def _blanco_enemigo(self):
        m = self.m
        bx, by = self.base
        mejor = None
        mejor_k = None
        for b in m.edificios.values():
            if not b.vivo or not m.enemigos(self.p, b.dueno):
                continue
            k = ((b.x - bx) ** 2 + (b.y - by) ** 2, b.id)
            if mejor_k is None or k < mejor_k:
                mejor, mejor_k = b, k
        return mejor

    def _militar(self):
        m = self.m
        amenaza, n = self._amenaza()
        defensores = [u for u in self.ejercito if u.id not in self.atacando]
        if amenaza is not None and n > 0:
            ociosos = [u.id for u in defensores
                       if u.orden is None or u.orden.tipo != ATACAR_MOVER]
            if ociosos:
                self.cmd(c="atacar_mover", u=ociosos, x=amenaza[0] // 16, y=amenaza[1] // 16)
            if n >= 6 and self.atacando and self.oleadas <= 1:
                vuelta = [i for i in self.atacando if m.entidad(i) is not None]
                if vuelta:
                    self.cmd(c="atacar_mover", u=vuelta, x=amenaza[0] // 16, y=amenaza[1] // 16)
                self.atacando = set()
            return
        self.atacando = {i for i in self.atacando if m.entidad(i) is not None}
        blanco = self._blanco_enemigo()
        if blanco is None:
            return
        if self.naval is None and self._necesita_barco(blanco):
            self.naval = {"fase": "reunir", "desde": m.tick}
        pob_ejercito = sum(u.tipo.poblacion for u in defensores)
        if self.naval is not None:
            self._operacion_naval(blanco, defensores, pob_ejercito)
            return
        if pob_ejercito >= self.umbral:
            ids = [u.id for u in defensores]
            self.cmd(c="atacar_mover", u=ids, x=blanco.x // 16, y=blanco.y // 16)
            self.atacando.update(ids)
            self.oleadas += 1
            self.umbral = min(120, self.umbral + self.dif["incremento"])
        # quienes ya atacan y quedaron sin orden siguen al próximo blanco
        ociosos = [i for i in self.atacando
                   if (u := m.entidad(i)) is not None and u.orden is None and not u.objetivo]
        if ociosos:
            self.cmd(c="atacar_mover", u=ociosos, x=blanco.x // 16, y=blanco.y // 16)
        # los que esperan se juntan en el punto de reunión
        sueltos = [u.id for u in defensores if u.orden is None and not u.objetivo and
                   (u.x - self.reunion[0]) ** 2 + (u.y - self.reunion[1]) ** 2 > (6 * TILE) ** 2]
        if sueltos:
            self.cmd(c="mover", u=sueltos, x=self.reunion[0] // 16, y=self.reunion[1] // 16)

    def _necesita_barco(self, blanco):
        mp = self.m.mapa
        reg = mp.region[TIERRA]
        mia = reg[mp.idx_de(*self.base)]
        i = mp.pasable_cercana(TIERRA, blanco.tx - 1, blanco.ty - 1, 6)
        return i is not None and reg[i] != mia and mia != 0

    def _operacion_naval(self, blanco, defensores, pob):
        m = self.m
        nav = self.naval
        transportes = [u for u in self.por_tipo.get("transporte", []) if u.vivo]
        muelles = [b for b in self.por_tipo.get("muelle", []) if b.construido]
        if not muelles or not transportes:
            return
        muelle = muelles[0]
        fase = nav["fase"]
        if fase == "reunir":
            if pob < self.umbral:
                return
            nav["fase"] = "embarcar"
            nav["desde"] = m.tick
            fase = "embarcar"
        if fase == "embarcar":
            libres = {t.id: t.tipo.capacidad - m.espacio_usado(t.cargamento) for t in transportes}
            for u in defensores:
                if u.dentro or (u.orden is not None and u.orden.tipo == CARGAR):
                    continue
                for t in transportes:
                    if libres[t.id] >= u.tipo.espacio:
                        libres[t.id] -= u.tipo.espacio
                        self.cmd(c="cargar", u=[u.id], t=t.id)
                        break
            # los transportes esperan frente al muelle
            for t in transportes:
                if t.orden is None and not t.cargamento and (t.x - muelle.x) ** 2 + (t.y - muelle.y) ** 2 > (5 * TILE) ** 2:
                    self.cmd(c="mover", u=[t.id], x=muelle.x // 16, y=(muelle.y + 2 * TILE) // 16)
            llenos = all(libres[t.id] < 1 for t in transportes)
            if llenos or m.tick - nav["desde"] > TICKS * 40:
                nav["fase"] = "navegar"
                nav["desde"] = m.tick
                cargados = [t.id for t in transportes if t.cargamento]
                if cargados:
                    self.cmd(c="descargar", u=cargados, x=blanco.x // 16, y=blanco.y // 16)
                    self.oleadas += 1
                    self.umbral = min(120, self.umbral + self.dif["incremento"])
                else:
                    nav["fase"] = "reunir"
            return
        if fase == "navegar":
            if all(not t.cargamento for t in transportes) or m.tick - nav["desde"] > TICKS * 90:
                desembarcados = [u.id for u in self.ejercito if u.orden is None]
                if desembarcados:
                    self.cmd(c="atacar_mover", u=desembarcados, x=blanco.x // 16, y=blanco.y // 16)
                    self.atacando.update(desembarcados)
                self.cmd(c="mover", u=[t.id for t in transportes], x=muelle.x // 16, y=(muelle.y + 2 * TILE) // 16)
                nav["fase"] = "reunir"

    # ------------------------------------------------------------------
    def _habilidades(self):
        m = self.m
        t = m.tick
        cat = m.cat
        for u in self.unidades:
            if u.dentro or not u.tipo.habilidades:
                continue
            for hid in u.tipo.habilidades:
                h = cat.habilidades[hid]
                if u.cd.get(hid, 0) > t or (h.energia and u.energia < h.energia):
                    continue
                if h.tipo in ("potenciar_area", "potenciar_propio", "curar_area"):
                    enemigos = self._enemigos_cerca(u, 7 * TILE)
                    if h.tipo == "curar_area":
                        heridos = sum(1 for v in m.rejilla.cerca(u.x, u.y, h.radio)
                                      if m.aliados(self.p, v.dueno) and v.vida * 2 < v.st.vida)
                        if heridos >= 3:
                            self.cmd(c="habilidad", u=[u.id], h=hid)
                    elif len(enemigos) >= 4:
                        self.cmd(c="habilidad", u=[u.id], h=hid)
                elif h.tipo == "bombardeo":
                    enemigos = self._enemigos_cerca(u, h.alcance)
                    if len(enemigos) >= 4:
                        cx = sum(e.x for e in enemigos) // len(enemigos)
                        cy = sum(e.y for e in enemigos) // len(enemigos)
                        self.cmd(c="habilidad", u=[u.id], h=hid, x=cx // 16, y=cy // 16)
                elif h.tipo == "golpe":
                    for e in self._enemigos_cerca(u, h.alcance + 2 * TILE):
                        if e.es_unidad and e.capa == AGUA:
                            self.cmd(c="habilidad", u=[u.id], h=hid, t=e.id)
                            break
                elif h.tipo == "mina" and self.j.minas < 10:
                    ang = self.azar.entero(8)
                    dx, dy = ((1, 0), (1, 1), (0, 1), (-1, 1), (-1, 0), (-1, -1), (0, -1), (1, -1))[ang]
                    x = u.x + dx * 2 * TILE
                    y = u.y + dy * 2 * TILE
                    self.cmd(c="habilidad", u=[u.id], h=hid, x=x // 16, y=y // 16)
                elif h.tipo in ("sabotaje", "demolicion"):
                    for b in m.edificios_cerca(u.x, u.y, 6 * TILE):
                        if m.enemigos(self.p, b.dueno) and m.visible_edificio(self.p, b):
                            self.cmd(c="habilidad", u=[u.id], h=hid, t=b.id)
                            break
        if t - self.ultimo_reconocimiento > TICKS * 45:
            for b in self.por_tipo.get("central_telegrafos", []):
                if b.construido and b.energia >= cat.habilidades["reconocimiento"].energia:
                    blanco = self._blanco_enemigo()
                    if blanco is not None:
                        self.cmd(c="habilidad", u=[b.id], h="reconocimiento", x=blanco.x // 16, y=blanco.y // 16)
                        self.ultimo_reconocimiento = t
                    break

    def _enemigos_cerca(self, u, radio):
        m = self.m
        out = []
        for e in m.rejilla.cerca(u.x, u.y, radio):
            if e.vivo and not e.dentro and m.enemigos(self.p, e.dueno) and m.visible(self.p, e.x, e.y):
                dx = e.x - u.x
                dy = e.y - u.y
                if dx * dx + dy * dy <= radio * radio:
                    out.append(e)
        return out


def distancia(a, b):
    return isqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2)
