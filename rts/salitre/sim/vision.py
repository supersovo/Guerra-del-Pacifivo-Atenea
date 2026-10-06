"""Niebla de guerra y detección.

Cada observador marca un círculo de casillas visibles. Regla de la altura
(como en StarCraft): desde un nivel bajo no se ve lo que está en un nivel más
alto. Para que sea rápido, los círculos se marcan por tramos de filas
(asignación de rebanadas, que Python hace en C) en una rejilla por nivel, y las
rejillas se combinan con operaciones de bits sobre enteros grandes.
"""

from math import isqrt

_UNOS = b"\x01" * 1024
_cache_tramos = {}


def tramos(radio):
    """[(dy, dx_max)] de un círculo de 'radio' casillas (admite medias casillas)."""
    clave = int(round(radio * 2))
    t = _cache_tramos.get(clave)
    if t is None:
        rr = clave
        R = rr // 2
        t = []
        for dy in range(-R, R + 1):
            v = rr * rr - (2 * dy) * (2 * dy)
            if v < 0:
                continue
            t.append((dy, isqrt(v) // 2))
        t = tuple(t)
        _cache_tramos[clave] = t
    return t


def _marcar(rejilla, w, h, tx, ty, radio):
    for dy, dx in tramos(radio):
        y = ty + dy
        if y < 0 or y >= h:
            continue
        x0 = tx - dx
        x1 = tx + dx
        if x0 < 0:
            x0 = 0
        if x1 >= w:
            x1 = w - 1
        if x1 < x0:
            continue
        base = y * w
        rejilla[base + x0: base + x1 + 1] = _UNOS[: x1 - x0 + 1]


def calcular(mapa, observadores, revelados=()):
    """Rejilla de visibilidad (bytearray de 0/1).

    observadores: iterable de (tx, ty, radio_casillas, nivel)
    revelados:    iterable de (tx, ty, radio_casillas), ignoran la altura
    """
    w, h, n = mapa.w, mapa.h, mapa.n
    por_nivel = [None, None, None]
    for tx, ty, radio, nivel in observadores:
        if nivel > 2:
            nivel = 2
        rej = por_nivel[nivel]
        if rej is None:
            rej = por_nivel[nivel] = bytearray(n)
        _marcar(rej, w, h, tx, ty, radio)
    v = [int.from_bytes(r, "little") if r is not None else 0 for r in por_nivel]
    m0, m1, m2 = mapa.mascaras_nivel
    total = (m0 & (v[0] | v[1] | v[2])) | (m1 & (v[1] | v[2])) | (m2 & v[2])
    if revelados:
        rej = bytearray(n)
        for tx, ty, radio in revelados:
            _marcar(rej, w, h, tx, ty, radio)
        total |= int.from_bytes(rej, "little")
    return bytearray(total.to_bytes(n, "little"))


def deteccion(mapa, detectores):
    """Rejilla de detección (sin regla de altura). detectores: (tx, ty, radio)."""
    rej = bytearray(mapa.n)
    for tx, ty, radio in detectores:
        _marcar(rej, mapa.w, mapa.h, tx, ty, radio)
    return rej


def unir(a, b):
    """OR de dos rejillas del mismo tamaño."""
    n = len(a)
    return bytearray((int.from_bytes(a, "little") | int.from_bytes(b, "little")).to_bytes(n, "little"))
