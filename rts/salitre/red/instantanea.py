"""Instantáneas del estado de la partida para cada jugador.

El servidor es autoritativo: cada jugador recibe solo lo que su bando ve
(niebla de guerra aplicada en el servidor: no hay "trampas de mapa") y solo
lo que cambió desde la instantánea anterior. Cada entidad viaja como una lista:

    [id, tipo, dueño, x, y, vida, dirección, banderas, extra]

tipo es el índice del catálogo (o -1 salitre, -2 agua, -3 mina); x, y en
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

TIPO_SALITRE = -1
TIPO_AGUA = -2
TIPO_MINA = -3


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
        extra = 0
        if propio:
            ex = {}
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
            if ex:
                extra = ex
        return [e.id, e.tipo.idx, e.dueno, e.x >> 4, e.y >> 4, e.vida, e.dir, fl, extra]
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
        if propio:
            if e.cola:
                ex["q"] = [[it[0], it[1], it[2] * 100 // max(1, it[3])] for it in e.cola]
            if e.reunion:
                ex["r"] = [e.reunion[0] >> 4, e.reunion[1] >> 4]
            if e.st.energia_max:
                ex["en"] = e.energia // EFP
            if e.guarnicion:
                ex["g"] = [m.ent[i].tipo.idx for i in e.guarnicion if i in m.ent]
            if e.ocupante:
                ex["oc"] = 1
            if e.cd:
                cds = {h: c - t for h, c in e.cd.items() if c > t}
                if cds:
                    ex["cd"] = cds
        return [e.id, e.tipo.idx, e.dueno, e.x >> 4, e.y >> 4, e.vida, e.dir, fl, ex or 0]
    if e.es_recurso:
        return [e.id, TIPO_SALITRE if e.rtipo == "salitre" else TIPO_AGUA, -1, e.x >> 4, e.y >> 4,
                e.cantidad, 0, 0, 0]
    return [e.id, TIPO_MINA, e.dueno, e.x >> 4, e.y >> 4, 1, 0, 0, 0]


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
            est = (j.salitre, j.agua, j.pob_usada, j.pob_max, tuple(sorted(j.mejoras)),
                   tuple(sorted(j.investigando)), tuple(sorted(j.heroes)), j.minas)
            if est != self.estado:
                self.estado = est
                msg["j"] = {"s": j.salitre, "a": j.agua, "p": j.pob_usada, "pm": j.pob_max,
                            "m": list(est[4]), "i": list(est[5]), "h": list(est[6]), "mi": j.minas}
        else:
            msg["js"] = [{"s": j.salitre, "a": j.agua, "p": j.pob_usada, "pm": j.pob_max}
                         for j in m.jugadores]
        return msg
