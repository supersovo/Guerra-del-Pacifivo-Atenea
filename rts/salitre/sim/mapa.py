"""Rejilla del campo de batalla: terreno, niveles de altura, paso y ocupación.

Dos capas de movimiento: TIERRA (tropas) y AGUA (buques). En tierra, entre
dos casillas vecinas solo se pasa si están al mismo nivel o si una de ellas es
una rampa (las cuestas que suben a las mesetas).
"""

from .constantes import AGUA, MEDIA, TIERRA, TILE

# carácter: (código, nombre, pisable, edificable, agua)
TERRENOS = {
    ".": (0, "arena", 1, 1, 0),
    ",": (1, "pampa", 1, 1, 0),
    ":": (2, "salar", 1, 1, 0),
    "=": (3, "camino", 1, 1, 0),
    "/": (4, "rampa", 1, 0, 0),
    "#": (5, "roca", 0, 0, 0),
    "T": (6, "tamarugo", 0, 0, 0),
    "q": (7, "quebrada", 0, 0, 0),
    "~": (8, "mar", 0, 0, 1),
    "p": (9, "ruinas", 0, 0, 0),
}
NOMBRES_TERRENO = {v[0]: v[1] for v in TERRENOS.values()}
CODIGO_RAMPA = 4
CODIGO_MAR = 8

OCUPA_EDIFICIO = 1
OCUPA_RECURSO = 2

VECINOS8 = ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1))


class Mapa:
    def __init__(self, datos):
        w, h = datos.ancho, datos.alto
        self.datos = datos
        self.w, self.h, self.n = w, h, w * h
        self.ancho_sub, self.alto_sub = w * TILE, h * TILE
        n = self.n
        self.terreno = bytearray(n)
        self.nivel = bytearray(n)
        self.rampa = bytearray(n)
        self.base_tierra = bytearray(n)
        self.base_agua = bytearray(n)
        self.edificable = bytearray(n)
        for y in range(h):
            fila_t = datos.terreno[y]
            fila_a = datos.altura[y]
            for x in range(w):
                i = y * w + x
                cod, _nom, pis, edi, agu = TERRENOS[fila_t[x]]
                self.terreno[i] = cod
                self.nivel[i] = ord(fila_a[x]) - 48
                self.rampa[i] = 1 if cod == CODIGO_RAMPA else 0
                self.base_tierra[i] = pis
                self.base_agua[i] = agu
                self.edificable[i] = edi
        self.ocupado = bytearray(n)
        self.pasable = [bytearray(self.base_tierra), bytearray(self.base_agua)]
        self.mascaras_nivel = []
        for k in range(3):
            self.mascaras_nivel.append(int.from_bytes(bytes(1 if v == k else 0 for v in self.nivel), "little"))
        self.region = [self._regiones(TIERRA), self._regiones(AGUA)]

    # -- geometría -------------------------------------------------------
    def dentro(self, tx, ty):
        return 0 <= tx < self.w and 0 <= ty < self.h

    def idx(self, tx, ty):
        return ty * self.w + tx

    def casilla(self, x, y):
        tx = x // TILE
        ty = y // TILE
        if tx < 0:
            tx = 0
        elif tx >= self.w:
            tx = self.w - 1
        if ty < 0:
            ty = 0
        elif ty >= self.h:
            ty = self.h - 1
        return tx, ty

    def idx_de(self, x, y):
        tx, ty = self.casilla(x, y)
        return ty * self.w + tx

    def centro(self, tx, ty):
        return tx * TILE + MEDIA, ty * TILE + MEDIA

    def centro_idx(self, i):
        ty, tx = divmod(i, self.w)
        return tx * TILE + MEDIA, ty * TILE + MEDIA

    def nivel_en(self, x, y):
        return self.nivel[self.idx_de(x, y)]

    # -- paso ----------------------------------------------------------------
    def paso(self, a, b):
        nv = self.nivel
        return nv[a] == nv[b] or self.rampa[a] or self.rampa[b]

    def puede_pasar(self, capa, a, b):
        if not self.pasable[capa][b]:
            return False
        if capa == AGUA or a == b:
            return True
        nv = self.nivel
        return nv[a] == nv[b] or self.rampa[a] or self.rampa[b]

    def ocupar(self, tx, ty, w, h, valor=OCUPA_EDIFICIO):
        pt = self.pasable[TIERRA]
        for y in range(ty, ty + h):
            base = y * self.w
            for x in range(tx, tx + w):
                self.ocupado[base + x] = valor
                pt[base + x] = 0

    def liberar(self, tx, ty, w, h):
        pt = self.pasable[TIERRA]
        for y in range(ty, ty + h):
            base = y * self.w
            for x in range(tx, tx + w):
                i = base + x
                self.ocupado[i] = 0
                pt[i] = self.base_tierra[i]

    def linea_libre(self, capa, x0, y0, x1, y1):
        """¿Se puede ir en línea recta de (x0,y0) a (x1,y1) sin cruzar obstáculos?"""
        w = self.w
        pas = self.pasable[capa]
        dx = x1 - x0
        dy = y1 - y0
        largo = max(abs(dx), abs(dy))
        pasos = largo // (TILE // 4) + 1
        prev_tx = x0 // TILE
        prev_ty = y0 // TILE
        prev = prev_ty * w + prev_tx
        for k in range(1, pasos + 1):
            x = x0 + dx * k // pasos
            y = y0 + dy * k // pasos
            tx = x // TILE
            ty = y // TILE
            if tx == prev_tx and ty == prev_ty:
                continue
            if tx < 0 or ty < 0 or tx >= self.w or ty >= self.h:
                return False
            i = ty * w + tx
            if not pas[i]:
                return False
            if tx != prev_tx and ty != prev_ty:
                # paso en diagonal: las dos esquinas deben estar libres
                c1 = prev_ty * w + tx
                c2 = ty * w + prev_tx
                if not pas[c1] or not pas[c2]:
                    return False
                if capa == TIERRA and not (self.paso(prev, c1) and self.paso(c1, i)
                                           and self.paso(prev, c2) and self.paso(c2, i)):
                    return False
            elif capa == TIERRA and not self.paso(prev, i):
                return False
            prev_tx, prev_ty, prev = tx, ty, i
        return True

    def pasable_cercana(self, capa, tx, ty, radio_max=16, region=None):
        """Casilla pasable más cercana a (tx,ty) (búsqueda por anillos)."""
        pas = self.pasable[capa]
        reg = self.region[capa]
        w, h = self.w, self.h
        if 0 <= tx < w and 0 <= ty < h:
            i = ty * w + tx
            if pas[i] and (region is None or reg[i] == region):
                return i
        for r in range(1, radio_max + 1):
            mejor = None
            mejor_d = None
            for yy in range(ty - r, ty + r + 1):
                if yy < 0 or yy >= h:
                    continue
                if yy == ty - r or yy == ty + r:
                    xs = range(tx - r, tx + r + 1)
                else:
                    xs = (tx - r, tx + r)
                for xx in xs:
                    if xx < 0 or xx >= w:
                        continue
                    i = yy * w + xx
                    if pas[i] and (region is None or reg[i] == region):
                        d = (xx - tx) * (xx - tx) + (yy - ty) * (yy - ty)
                        if mejor_d is None or d < mejor_d:
                            mejor, mejor_d = i, d
            if mejor is not None:
                return mejor
        return None

    def _regiones(self, capa):
        """Componentes conexas del terreno fijo (sin edificios)."""
        base = self.base_tierra if capa == TIERRA else self.base_agua
        w, h, n = self.w, self.h, self.n
        reg = [0] * n
        actual = 0
        for inicio in range(n):
            if not base[inicio] or reg[inicio]:
                continue
            actual += 1
            reg[inicio] = actual
            pila = [inicio]
            while pila:
                i = pila.pop()
                y, x = divmod(i, w)
                for dx, dy in VECINOS8:
                    xx, yy = x + dx, y + dy
                    if xx < 0 or yy < 0 or xx >= w or yy >= h:
                        continue
                    j = yy * w + xx
                    if reg[j] or not base[j]:
                        continue
                    if dx and dy:
                        c1 = y * w + xx
                        c2 = yy * w + x
                        if not base[c1] or not base[c2]:
                            continue
                        if capa == TIERRA and not (self.paso(i, c1) and self.paso(c1, j)
                                                   and self.paso(i, c2) and self.paso(c2, j)):
                            continue
                    elif capa == TIERRA and not self.paso(i, j):
                        continue
                    reg[j] = actual
                    pila.append(j)
        return reg

    def costa_de(self, i):
        """¿La casilla de tierra i toca el mar?"""
        y, x = divmod(i, self.w)
        for dx, dy in VECINOS8:
            xx, yy = x + dx, y + dy
            if 0 <= xx < self.w and 0 <= yy < self.h and self.base_agua[yy * self.w + xx]:
                return True
        return False
