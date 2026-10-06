"""Repeticiones: guardan el mapa, la semilla, los jugadores y cada comando con
su tick. Como la simulación es determinista, basta con volver a aplicarlos
para ver la partida de nuevo, con todo el mapa a la vista (ideal para
estudiar una batalla después)."""

import gzip
import json
import time
from pathlib import Path

from .. import VERSION, rutas

EXTENSION = ".rep"


def guardar(mundo, configs, ganador, nombre=None, carpeta=None):
    carpeta = Path(carpeta) if carpeta else rutas.dir_repeticiones()
    carpeta.mkdir(parents=True, exist_ok=True)
    if nombre is None:
        nombre = time.strftime("%Y%m%d-%H%M%S") + f"-{mundo.datos_mapa.id}"
    datos = {
        "version": VERSION,
        "huella": mundo.cat.huella,
        "fecha": time.time(),
        "mapa": mundo.datos_mapa.a_dict(),
        "semilla": mundo.semilla,
        "jugadores": configs,
        "comandos": [[t, p, c] for (t, p, c) in (mundo.registro or [])],
        "fin": mundo.tick,
        "ganador": ganador,
    }
    ruta = carpeta / (nombre + EXTENSION)
    with gzip.open(ruta, "wt", encoding="utf-8") as f:
        json.dump(datos, f, separators=(",", ":"), ensure_ascii=False)
    return ruta


def cargar(ruta):
    with gzip.open(ruta, "rt", encoding="utf-8") as f:
        d = json.load(f)
    for clave in ("mapa", "semilla", "jugadores", "comandos", "fin"):
        if clave not in d:
            raise ValueError(f"Repetición incompleta: falta '{clave}'")
    return d


def listar(carpeta=None):
    carpeta = Path(carpeta) if carpeta else rutas.dir_repeticiones()
    out = []
    for p in sorted(carpeta.glob("*" + EXTENSION), reverse=True):
        try:
            with gzip.open(p, "rt", encoding="utf-8") as f:
                d = json.load(f)
            out.append({
                "ruta": str(p), "nombre": p.stem, "mapa": d["mapa"].get("nombre", "?"),
                "fecha": d.get("fecha", 0), "minutos": round(d.get("fin", 0) / 16 / 60, 1),
                "jugadores": [f"{j.get('nombre', '?')} ({j.get('faccion', '?')})" for j in d["jugadores"]],
                "version": d.get("version", "?"),
            })
        except (OSError, ValueError, KeyError, json.JSONDecodeError):
            continue
    return out
