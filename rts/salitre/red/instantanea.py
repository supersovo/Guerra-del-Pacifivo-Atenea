"""Instantáneas del estado de la partida para cada jugador.

El servidor es autoritativo: cada jugador recibe solo lo que su bando ve
(niebla de guerra aplicada en el servidor: no hay "trampas de mapa") y solo
lo que cambió desde la instantánea anterior. Cada entidad viaja como una lista:

    [id, tipo, dueño, x, y, vida, dirección, banderas, extra]

tipo es el índice del catálogo (o -1 salitre, -2 agua, -3 mina, -4 herido, -5 convoy); x, y en
píxeles; extra es 0 o un diccionario con datos propios (cola de producción,
energía, avance de obra...). Las bajas y lo que sale de la vista llegan en
"q" como [id, motivo] (motivo "m" = muerto, "v" = fuera de vista).
"""

from ..sim.constantes import EFP
from ..sim.entidades import CONSTRUIR, RECOLECTAR, REPARAR
from ..sim.mundo import DEST_POS, DEST_TODOS

F_MOVIENDO = 1
F_DISPARO = 2
F_SALITRE = 4
F_AGUA = 8
F_EMPLAZADA = 16
F_OCULTA = 32
F_OBRA = 64
F_PRODUCE = 128
F_SABOTAJE = 256
F_TRABAJA = 512
F_POTENCIADO = 1024
F_EMPLAZANDO = 2048
F_DETECTADO = 4096
F_CAMILLA = 8192          # camilleros que llevan a un herido
F_DESMONTA = 16384        # hospital de sangre que recoge las carpas

TIPO_SALITRE = -1
TIPO_AGUA = -2
TIPO_MINA = -3
TIPO_HERIDO = -4
TIPO_CONVOY = -5


def registro(m, e, propio, t, detectado=False):
    if e.es_unidad:
        fl = 0
        if e.moviendo:
            fl |= F_MOVIENDO
        if t - e.disparo_t <= 3:
            fl |= F_DISPARO
        if e.carga:
            fl |= F_SALITRE if e.carga_tipo == 1 else F_AGUA
        if e.emplazada:
            fl |= F_EMPLAZADA
        if e.emplazando:
            fl |= F_EMPLAZANDO
        if e.oculta:
            fl |= F_OCULTA
            if detectado:
                fl |= F_DETECTADO
        o = e.orden
        if o is not None and ((o.tipo == RECOLECTAR and e.fase == 2)
                              or (o.tipo in (CONSTRUIR, REPARAR) and e.fase >= 1 and not e.moviendo)):
            fl |= F_TRABAJA
        if e.aura or any(b[1] > t for b in e.buffs.values()):
            fl |= F_POTENCIADO
        if e.paciente:
            fl |= F_CAMILLA
        ex = {}
        if e.grado:
            # los galones se ven desde los dos bandos: grado, vida máxima y nombre del veterano
            ex["v"] = e.grado
            ex["vm"] = e.st.vida
            ex["n"] = e.nombre
        if propio:
            if e.tipo.veterania and e.grado < m.cat.veterania.maximo:
                vet = m.cat.veterania
                piso = vet.umbral(e.tipo, e.grado)
                techo = vet.umbral(e.tipo, e.grado + 1)
                ex["x"] = (e.xp - piso) * 100 // max(1, techo - piso)
            if e.st.energia_max:
                ex["en"] = e.energia // EFP
            if e.cargamento:
                ex["c"] = [m.ent[i].tipo.idx for i in e.cargamento if i in m.ent]
            if e.abatidos:
                ex["k"] = e.abatidos
            if e.cd:
                cds = {h: c - t for h, c in e.cd.items() if c > t}
                if cds:
                    ex["cd"] = cds
            if e.pacientes:
                # convalecientes en el carro de la ambulancia
                ex["pc"] = _pacientes(m, e.pacientes, m.cat.edificios[e.tipo.monta].recuperacion)
        return [e.id, e.tipo.idx, e.dueno, e.x >> 4, e.y >> 4, e.vida, e.dir, fl, ex or 0]
    if e.es_edificio:
        fl = 0
        ex = {}
        if not e.construido:
            fl |= F_OBRA
            ex["o"] = e.progreso * 100 // max(1, e.tipo.tiempo * 100)
        if e.cola:
            fl |= F_PRODUCE
        if e.sabotaje_hasta > t:
            fl |= F_SABOTAJE
        if e.desmontando:
            fl |= F_DESMONTA
            ex["dm"] = 100 - e.desmontando * 100 // max(1, e.tipo.desmontar_ticks)
        if e.guarnicion:
            # todos ven a los soldados en la trinchera o en el techo; el dueño también su vida y quiénes son
            gu = [m.ent[i] for i in e.guarnicion if i in m.ent]
            ex["g"] = [u.tipo.idx for u in gu]
            if propio:
                ex["gv"] = [u.vida * 100 // max(1, u.st.vida) for u in gu]
                ex["gid"] = [u.id for u in gu]
            disparos = [k for k, u in enumerate(gu) if t - u.disparo_t <= 3]
            if disparos:
                ex["gf"] = disparos
        if propio:
            if e.cola:
                ex["q"] = [[it[0], it[1], it[2] * 100 // max(1, it[3])] for it in e.cola]
            if e.reunion:
                ex["r"] = [e.reunion[0] >> 4, e.reunion[1] >> 4]
            if e.st.energia_max:
                ex["en"] = e.energia // EFP
            if e.ocupante:
                ex["oc"] = 1
            if e.tipo.camilleros:
                ex["cm"] = len(e.camilleros)
                ex["ce"] = e.tipo.camilleros + m.jugadores[e.dueno].sanidad["equipos"]
                if e.pacientes:
                    ex["pc"] = _pacientes(m, e.pacientes, e.tipo.recuperacion)
            if e.cd:
                cds = {h: c - t for h, c in e.cd.items() if c > t}
                if cds:
                    ex["cd"] = cds
        return [e.id, e.tipo.idx, e.dueno, e.x >> 4, e.y >> 4, e.vida, e.dir, fl, ex or 0]
    if e.es_recurso:
        return [e.id, TIPO_SALITRE if e.rtipo == "salitre" else TIPO_AGUA, -1, e.x >> 4, e.y >> 4,
                e.cantidad, 0, 0, 0]
    if e.es_convoy:
        # tren o carreta del cuartel general: modo, lugar del cuartel (píxeles) y la ruta entera
        return [e.id, TIPO_CONVOY, e.dueno, e.x >> 4, e.y >> 4, e.recorrido >> 4, e.dir, 0,
                {"m": e.modo, "d": [(e.destino[0] * 32) + 64, (e.destino[1] * 32) + 48],
                 "r": [[x >> 4, y >> 4] for x, y in e.ruta]}]
    if e.es_herido:
        # "u": tipo de la unidad caída; "h": tick en que muere si nadie lo recoge; "c": ya va un camillero
        ex = {"u": e.tipo.idx, "h": e.hasta, "c": 1 if e.camillero > 0 else 0}
        if e.hoja and e.hoja[1]:
            ex["v"] = e.hoja[1]          # un veterano caído: los camilleros lo buscan primero
            ex["n"] = e.hoja[2]
        return [e.id, TIPO_HERIDO, e.dueno, e.x >> 4, e.y >> 4, 1, e.dir, 0, ex]
    return [e.id, TIPO_MINA, e.dueno, e.x >> 4, e.y >> 4, 1, 0, 0, 0]


def _pacientes(m, pacientes, total):
    """[tipo, % de la cura, grado] de cada convaleciente."""
    total = max(1, total)
    return [[m.cat.unidades[p[0]].idx, 100 - p[1] * 100 // total, p[2][1] if len(p) > 2 and p[2] else 0]
            for p in pacientes]


class Emisor:
    """Arma las instantáneas de un jugador (p) o de un espectador (p = None)."""

    def __init__(self, mundo, p):
        self.m = mundo
        self.p = p
        self.ultimo = {}
        self.eventos = []
        self.estado = None
        self.completa = True

    def reiniciar(self):
        """Tras una reconexión: la próxima instantánea lo manda todo."""
        self.ultimo = {}
        self.estado = None
        self.completa = True

    def acumular(self):
        """Guarda los eventos visibles del tick recién simulado."""
        m = self.m
        if not m.eventos:
            return
        p = self.p
        vis = None if p is None else m.vis[m.jugadores[p].equipo]
        t = m.tick
        for dest, ev in m.eventos:
            if dest == DEST_TODOS:
                ok = True
            elif dest >= DEST_POS:
                ok = vis is None or vis[dest - DEST_POS] == 1
            else:
                ok = dest == p
            if ok:
                self.eventos.append([t] + list(ev))
        if len(self.eventos) > 4000:
            del self.eventos[: len(self.eventos) - 4000]

    def _visible(self, e):
        m = self.m
        p = self.p
        if p is None:
            return not (e.es_unidad and e.dentro), False
        if e.es_herido or e.es_convoy:
            if m.aliados(p, e.dueno):
                return True, False
            eq = m.jugadores[p].equipo
            return m.vis[eq][m.mapa.idx_de(e.x, e.y)] == 1, False
        if e.es_recurso:
            eq = m.jugadores[p].equipo
            return m.vis[eq][m.mapa.idx_de(e.x, e.y)] == 1, False
        if m.aliados(p, e.dueno):
            return not (e.es_unidad and e.dentro), False
        if e.es_unidad:
            if e.dentro:
                return False, False
            eq = m.jugadores[p].equipo
            i = m.mapa.idx_de(e.x, e.y)
            if m.vis[eq][i] != 1:
                return False, False
            if e.oculta:
                d = m.det[eq][i] == 1
                return d, d
            return True, False
        if e.es_edificio:
            return m.visible_edificio(p, e), False
        if e.es_mina:
            eq = m.jugadores[p].equipo
            i = m.mapa.idx_de(e.x, e.y)
            return m.vis[eq][i] == 1 and m.det[eq][i] == 1, False
        return False, False

    def construir(self):
        m = self.m
        t = m.tick
        p = self.p
        cambios = []
        actuales = set()
        for e in m.ent.values():
            ok, detectado = self._visible(e)
            if not ok:
                continue
            propio = p is None or e.dueno == p
            r = registro(m, e, propio, t, detectado)
            actuales.add(e.id)
            if self.ultimo.get(e.id) != r:
                cambios.append(r)
                self.ultimo[e.id] = r
        quitados = []
        for i in list(self.ultimo):
            if i not in actuales:
                quitados.append([i, "m" if i not in m.ent else "v"])
                del self.ultimo[i]
        msg = {"t": "inst", "k": t}
        if cambios:
            msg["e"] = cambios
        if quitados:
            msg["q"] = quitados
        if self.eventos:
            msg["ev"] = self.eventos
            self.eventos = []
        if self.completa:
            msg["completa"] = 1
            self.completa = False
        if p is not None:
            j = m.jugadores[p]
            est = (j.dinero, j.agua, j.pob_usada, j.pob_max, tuple(sorted(j.mejoras)),
                   tuple(sorted(j.investigando)), tuple(sorted(j.heroes)), j.minas)
            if est != self.estado:
                self.estado = est
                msg["j"] = {"d": j.dinero, "a": j.agua, "p": j.pob_usada, "pm": j.pob_max,
                            "m": list(est[4]), "i": list(est[5]), "h": list(est[6]), "mi": j.minas}
        else:
            msg["js"] = [{"d": j.dinero, "a": j.agua, "p": j.pob_usada, "pm": j.pob_max}
                         for j in m.jugadores]
        return msg
