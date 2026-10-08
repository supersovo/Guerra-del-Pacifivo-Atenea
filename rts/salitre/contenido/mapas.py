"""Mapas: formato, carga, validación y listado.

Un mapa es un JSON con capas de texto (una fila de caracteres por fila de
casillas), fácil de editar a mano:

    terreno   . arena   , pampa   : salar   = camino o vía férrea
              / rampa (une niveles)   # roca o cerro   T tamarugo
              q quebrada   ~ mar   p ruinas
    altura    0, 1 o 2 por casilla (pampa baja, meseta, cerro alto)

Además: 'inicios' (casilla superior izquierda del Cuartel General de cada
jugador) y 'recursos' (yacimientos de salitre de 2x1 casillas y pozos de agua
de 3x3 casillas).
"""

import json
from pathlib import Path

from .. import rutas

CARACTERES_TERRENO = set(".,:=/#Tq~p")
TAM_RECURSO = {"salitre": (2, 1), "agua": (3, 3)}


class MapaError(Exception):
    pass


class MapaDatos:
    def __init__(self, d, ident="mapa"):
        self.id = d.get("id", ident)
        self.nombre = d.get("nombre", self.id)
        self.descripcion = d.get("descripcion", "")
        self.historia = d.get("historia", "")
        self.ambiente = d.get("ambiente", "desierto")
        self.ancho = int(d["ancho"])
        self.alto = int(d["alto"])
        self.jugadores = int(d.get("jugadores", len(d.get("inicios", []))))
        self.terreno = list(d["terreno"])
        self.altura = list(d.get("altura") or ["0" * self.ancho] * self.alto)
        self.inicios = [tuple(p) for p in d.get("inicios", [])]
        self.recursos = [dict(r) for r in d.get("recursos", [])]
        self.naval = bool(d.get("naval", False))
        # cómo llega el cuartel general al comenzar: en tren (por una vía férrea) o en carreta
        self.llegada = d.get("llegada", "carreta")
        self.decoracion = [dict(x) for x in d.get("decoracion", [])]
        self.validar()

    def validar(self):
        w, h = self.ancho, self.alto
        if not (16 <= w <= 256 and 16 <= h <= 256):
            raise MapaError(f"{self.id}: tamaño fuera de rango ({w}x{h})")
        if len(self.terreno) != h or any(len(f) != w for f in self.terreno):
            raise MapaError(f"{self.id}: la capa 'terreno' debe tener {h} filas de {w} caracteres")
        if len(self.altura) != h or any(len(f) != w for f in self.altura):
            raise MapaError(f"{self.id}: la capa 'altura' debe tener {h} filas de {w} caracteres")
        for y, fila in enumerate(self.terreno):
            malos = set(fila) - CARACTERES_TERRENO
            if malos:
                raise MapaError(f"{self.id}: caracteres de terreno desconocidos en la fila {y}: {''.join(sorted(malos))}")
        for y, fila in enumerate(self.altura):
            if set(fila) - set("012"):
                raise MapaError(f"{self.id}: la altura solo admite 0, 1 y 2 (fila {y})")
        if self.llegada not in ("tren", "carreta"):
            raise MapaError(f"{self.id}: 'llegada' debe ser 'tren' o 'carreta'")
        if self.jugadores < 1 or len(self.inicios) < self.jugadores:
            raise MapaError(f"{self.id}: faltan posiciones de inicio")
        for tx, ty in self.inicios:
            if not (0 <= tx <= w - 4 and 0 <= ty <= h - 3):
                raise MapaError(f"{self.id}: inicio fuera del mapa ({tx},{ty})")
        for r in self.recursos:
            if r.get("tipo") not in TAM_RECURSO:
                raise MapaError(f"{self.id}: recurso de tipo desconocido {r.get('tipo')}")
            rw, rh = TAM_RECURSO[r["tipo"]]
            if not (0 <= r["x"] <= w - rw and 0 <= r["y"] <= h - rh):
                raise MapaError(f"{self.id}: recurso fuera del mapa ({r['x']},{r['y']})")

    def a_dict(self):
        return {
            "id": self.id, "nombre": self.nombre, "descripcion": self.descripcion,
            "historia": self.historia, "ambiente": self.ambiente,
            "ancho": self.ancho, "alto": self.alto, "jugadores": self.jugadores,
            "naval": self.naval, "llegada": self.llegada, "inicios": [list(p) for p in self.inicios],
            "recursos": self.recursos, "decoracion": self.decoracion,
            "terreno": self.terreno, "altura": self.altura,
        }


def cargar(ruta):
    ruta = Path(ruta)
    try:
        d = json.loads(ruta.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        raise MapaError(f"No se pudo leer el mapa {ruta.name}: {e}") from e
    return MapaDatos(d, ruta.stem)


def carpetas():
    return [rutas.dir_mapas(), rutas.dir_mapas_usuario()]


def listar():
    """Mapas disponibles: los del juego y los del usuario (id -> ruta)."""
    out = {}
    for c in carpetas():
        if c.is_dir():
            for p in sorted(c.glob("*.json")):
                out.setdefault(p.stem, p)
    return out


def buscar(ident):
    ruta = listar().get(ident)
    if ruta is None:
        raise MapaError(f"No existe el mapa '{ident}'")
    return cargar(ruta)
