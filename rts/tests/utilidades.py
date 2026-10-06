"""Ayudas para las pruebas: mapas de ensayo y mundos listos para usar."""

import os
import sys
import tempfile
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
if str(RAIZ) not in sys.path:
    sys.path.insert(0, str(RAIZ))

os.environ.setdefault("SALITRE_DATOS_USUARIO", tempfile.mkdtemp(prefix="salitre_pruebas_"))
os.environ.setdefault("SDL_VIDEODRIVER", "dummy")
os.environ.setdefault("SDL_AUDIODRIVER", "dummy")

from salitre.contenido import catalogo as mod_catalogo  # noqa: E402
from salitre.contenido.mapas import MapaDatos  # noqa: E402
from salitre.sim.mundo import Mundo  # noqa: E402


def cat():
    return mod_catalogo.cargar()


def base(rec, x, y, salitre=8, pozos=1, cant=1500):
    """Agrega yacimientos de salitre en arco y pozos junto a un inicio (x, y)."""
    for k in range(salitre):
        rec.append({"tipo": "salitre", "x": x - 3 + (k % 4) * 2, "y": y - 4 - (k // 4), "cantidad": cant})
    for k in range(pozos):
        rec.append({"tipo": "agua", "x": x + 6 + k * 4, "y": y, "cantidad": 2500})


def mapa_llano(ancho=64, alto=64, jugadores=2, extra=None, agua_filas=0):
    terreno = []
    for y in range(alto):
        if y >= alto - agua_filas:
            terreno.append("~" * ancho)
        else:
            terreno.append("." * ancho)
    altura = ["0" * ancho for _ in range(alto)]
    inicios = [[6, 8], [ancho - 12, alto - 12 - agua_filas]][:jugadores]
    if jugadores > 2:
        inicios += [[ancho - 12, 8], [6, alto - 12 - agua_filas]][: jugadores - 2]
    rec = []
    for (x, y) in inicios:
        base(rec, x, y)
    d = {"id": "llano", "nombre": "Llano de ensayo", "ancho": ancho, "alto": alto,
         "jugadores": jugadores, "inicios": inicios, "recursos": rec,
         "terreno": terreno, "altura": altura}
    if extra:
        extra(d)
    return MapaDatos(d)


def mundo(mapa=None, facciones=("chile", "peru"), semilla=7, equipos=None, ia=None, registrar=False):
    mapa = mapa or mapa_llano(jugadores=len(facciones))
    configs = []
    for i, f in enumerate(facciones):
        configs.append({"nombre": f"J{i}", "faccion": f, "equipo": equipos[i] if equipos else i,
                        "color": i, "posicion": i, "ia": bool(ia and ia[i])})
    m = Mundo(cat(), mapa, configs, semilla=semilla, registrar=registrar)
    m.trucos = True
    return m


def avanzar(m, ticks):
    for _ in range(ticks):
        m.paso()
        if m.terminado:
            break


def de(m, p, tipo):
    return [e for e in list(m.unidades.values()) + list(m.edificios.values())
            if e.dueno == p and e.tipo.id == tipo and e.vivo]


def px(sub):
    return sub // 16
