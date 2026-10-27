"""Rejillas espaciales para buscar entidades cercanas sin recorrerlas todas."""

from .constantes import TILE

CELDA = 2 * TILE


class Rejilla:
    """Unidades por celda; se reconstruye cada tick."""

    def __init__(self, ancho_sub, alto_sub, celda=CELDA):
        self.c = celda
        self.cw = ancho_sub // celda + 1
        self.ch = alto_sub // celda + 1
        self.celdas = {}

    def reconstruir(self, unidades):
        c = self.c
        cw = self.cw
        celdas = {}
        for u in unidades:
            if not u.vivo or u.dentro:
                continue
            k = (u.y // c) * cw + (u.x // c)
            lista = celdas.get(k)
            if lista is None:
                celdas[k] = [u]
            else:
                lista.append(u)
        self.celdas = celdas

    def cerca(self, x, y, r):
        c = self.c
        cx0 = (x - r) // c
        cx1 = (x + r) // c
        cy0 = (y - r) // c
        cy1 = (y + r) // c
        if cx0 < 0:
            cx0 = 0
        if cy0 < 0:
            cy0 = 0
        if cx1 >= self.cw:
            cx1 = self.cw - 1
        if cy1 >= self.ch:
            cy1 = self.ch - 1
        celdas = self.celdas
        cw = self.cw
        for cy in range(cy0, cy1 + 1):
            base = cy * cw
            for cx in range(cx0, cx1 + 1):
                lista = celdas.get(base + cx)
                if lista:
                    yield from lista


class RejillaEdificios:
    """Edificios por celda (un edificio puede ocupar varias); se actualiza al crear o destruir."""

    def __init__(self, ancho_sub, alto_sub, celda=4 * TILE):
        self.c = celda
        self.cw = ancho_sub // celda + 1
        self.ch = alto_sub // celda + 1
        self.celdas = {}

    def _rango(self, b):
        c = self.c
        x0, y0, x1, y1 = b.rect()
        return x0 // c, y0 // c, (x1 - 1) // c, (y1 - 1) // c

    def agregar(self, b):
        cx0, cy0, cx1, cy1 = self._rango(b)
        for cy in range(cy0, cy1 + 1):
            for cx in range(cx0, cx1 + 1):
                self.celdas.setdefault(cy * self.cw + cx, []).append(b)

    def quitar(self, b):
        cx0, cy0, cx1, cy1 = self._rango(b)
        for cy in range(cy0, cy1 + 1):
            for cx in range(cx0, cx1 + 1):
                lista = self.celdas.get(cy * self.cw + cx)
                if lista and b in lista:
                    lista.remove(b)

    def cerca(self, x, y, r):
        c = self.c
        cx0 = max(0, (x - r) // c)
        cx1 = min(self.cw - 1, (x + r) // c)
        cy0 = max(0, (y - r) // c)
        cy1 = min(self.ch - 1, (y + r) // c)
        vistos = set()
        out = []
        for cy in range(cy0, cy1 + 1):
            base = cy * self.cw
            for cx in range(cx0, cx1 + 1):
                lista = self.celdas.get(base + cx)
                if lista:
                    for b in lista:
                        if b.id not in vistos:
                            vistos.add(b.id)
                            out.append(b)
        out.sort(key=lambda b: b.id)
        return out
