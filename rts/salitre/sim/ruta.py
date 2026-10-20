"""Búsqueda de caminos: A* sobre la rejilla (8 direcciones, costo octil).

Para no frenar la simulación cada búsqueda tiene un presupuesto de nodos; si
se agota, el camino lleva al nodo más cercano a la meta y la unidad volverá a
calcular al llegar. Antes de buscar se prueba la línea recta: en la pampa
abierta casi todos los movimientos se resuelven sin A*.
"""

import heapq

from .constantes import AGUA, MEDIA, TIERRA, TILE

_VECINOS = ((1, 0, 10), (-1, 0, 10), (0, 1, 10), (0, -1, 10),
            (1, 1, 14), (1, -1, 14), (-1, 1, 14), (-1, -1, 14))


class Buscador:
    def __init__(self, mapa):
        self.mapa = mapa
        n = mapa.n
        self.g = [0] * n
        self.padre = [-1] * n
        self.marca = [0] * n
        self.cerrado = [0] * n
        self.gen = 0
        self.expandidos = 0

    def buscar(self, capa, inicio, meta, presupuesto=4000):
        """Lista de índices de casillas desde 'inicio' (excluido) hasta 'meta'.

        Si la meta no es alcanzable dentro del presupuesto, devuelve el camino al
        nodo más cercano a ella. Devuelve [] si inicio == meta.
        """
        m = self.mapa
        if inicio == meta:
            return []
        w, h = m.w, m.h
        pas = m.pasable[capa]
        nivel = m.nivel
        rampa = m.rampa
        tierra = capa == TIERRA
        self.gen += 1
        gen = self.gen
        g = self.g
        padre = self.padre
        marca = self.marca
        cerrado = self.cerrado
        my, mx = divmod(meta, w)

        def heur(i):
            y, x = divmod(i, w)
            dx = x - mx if x > mx else mx - x
            dy = y - my if y > my else my - y
            return 10 * dx + 4 * dy if dx > dy else 10 * dy + 4 * dx

        g[inicio] = 0
        padre[inicio] = -1
        marca[inicio] = gen
        h0 = heur(inicio)
        abiertos = [(h0, h0, inicio)]
        mejor = inicio
        mejor_h = h0
        expandidos = 0
        while abiertos:
            _f, hi, i = heapq.heappop(abiertos)
            if cerrado[i] == gen:
                continue
            cerrado[i] = gen
            if i == meta:
                mejor = i
                break
            if hi < mejor_h:
                mejor, mejor_h = i, hi
            expandidos += 1
            if expandidos > presupuesto:
                break
            y, x = divmod(i, w)
            gi = g[i]
            for dx, dy, costo in _VECINOS:
                xx = x + dx
                yy = y + dy
                if xx < 0 or yy < 0 or xx >= w or yy >= h:
                    continue
                j = yy * w + xx
                if not pas[j] or cerrado[j] == gen:
                    continue
                if tierra and nivel[i] != nivel[j] and not rampa[i] and not rampa[j]:
                    continue
                if dx and dy:
                    c1 = y * w + xx
                    c2 = yy * w + x
                    if not pas[c1] or not pas[c2]:
                        continue
                    if tierra and (nivel[c1] != nivel[i] or nivel[c2] != nivel[i]) \
                            and not (rampa[i] or rampa[j] or rampa[c1] or rampa[c2]):
                        continue
                ng = gi + costo
                if marca[j] != gen or ng < g[j]:
                    marca[j] = gen
                    g[j] = ng
                    padre[j] = i
                    hj = heur(j)
                    heapq.heappush(abiertos, (ng + hj, hj, j))
        self.expandidos += expandidos
        camino = []
        i = mejor
        while i != inicio and i != -1:
            camino.append(i)
            i = padre[i]
        camino.reverse()
        return camino


def suavizar(mapa, capa, x0, y0, puntos):
    """Quita puntos intermedios cuando hay línea recta libre (tensado de cuerda)."""
    if len(puntos) <= 1:
        return puntos
    out = []
    ax, ay = x0, y0
    k = 0
    n = len(puntos)
    while k < n:
        # el punto más lejano visible desde (ax, ay)
        j = n - 1
        while j > k and not mapa.linea_libre(capa, ax, ay, puntos[j][0], puntos[j][1]):
            j -= 1
        out.append(puntos[j])
        ax, ay = puntos[j]
        k = j + 1
    return out


def calcular(mapa, buscador, capa, x0, y0, x1, y1, presupuesto=4000):
    """Camino en subunidades de (x0,y0) a (x1,y1); el último punto es el destino real
    o, si este no es alcanzable, la casilla alcanzable más cercana."""
    i0 = mapa.idx_de(x0, y0)
    tx1, ty1 = mapa.casilla(x1, y1)
    i1 = ty1 * mapa.w + tx1
    pas = mapa.pasable[capa]
    reg = mapa.region[capa]
    region0 = reg[i0] if pas[i0] else None
    destino_exacto = True
    if not pas[i1] or (region0 is not None and reg[i1] != region0):
        cerca = mapa.pasable_cercana(capa, tx1, ty1, 24, region0)
        if cerca is None:
            return []
        i1 = cerca
        destino_exacto = False
    if destino_exacto and mapa.linea_libre(capa, x0, y0, x1, y1):
        return [(x1, y1)]
    if not destino_exacto:
        cx, cy = mapa.centro_idx(i1)
        if mapa.linea_libre(capa, x0, y0, cx, cy):
            return [(cx, cy)]
    casillas = buscador.buscar(capa, i0, i1, presupuesto)
    if not casillas:
        if i0 == i1:
            return [(x1, y1)] if destino_exacto else []
        return []
    w = mapa.w
    puntos = []
    for i in casillas:
        ty, tx = divmod(i, w)
        puntos.append((tx * TILE + MEDIA, ty * TILE + MEDIA))
    if casillas[-1] == i1 and destino_exacto:
        puntos[-1] = (x1, y1)
    return suavizar(mapa, capa, x0, y0, puntos)


__all__ = ["Buscador", "calcular", "suavizar", "TIERRA", "AGUA"]
