"""Duelo entre dos IA: simula una batalla sin pantalla y guarda su repetición.

Sirve para estudiar a la IA y para ver una batalla de verdad en el cliente 3D:

    python herramientas/duelo_ia.py --mapa quebrada_de_tarapaca --minutos 16 --nombre duelo
    godot --path godot -- --repeticion=duelo

La repetición queda en la carpeta de repeticiones del usuario (la misma que usan el
cliente y el servidor privado), salvo que se indique otra con --carpeta.
"""

import argparse
import sys
import time
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))

from salitre.contenido import catalogo as mod_cat  # noqa: E402
from salitre.contenido import mapas as mod_mapas  # noqa: E402
from salitre.ia.ia import DIFICULTADES, IA  # noqa: E402
from salitre.servidor import repeticion  # noqa: E402
from salitre.sim.constantes import TICKS  # noqa: E402
from salitre.sim.mundo import Mundo  # noqa: E402


def duelo(mapa_id="quebrada_de_tarapaca", minutos=16.0, facciones=("chile", "peru"), dificultad="dificil",
          semilla=1879, nombre=None, carpeta=None):
    """Simula hasta que uno gane o pasen los minutos; devuelve (ruta de la repetición, mundo)."""
    cat = mod_cat.cargar()
    rutas_mapas = mod_mapas.listar()
    if mapa_id not in rutas_mapas:
        raise SystemExit(f"No existe el mapa {mapa_id!r}. Mapas: {', '.join(sorted(rutas_mapas))}")
    datos = mod_mapas.cargar(rutas_mapas[mapa_id])
    configs = [{"nombre": f"IA de {cat.facciones[f].nombre}", "faccion": f, "equipo": k + 1, "color": k, "ia": True,
                "dificultad": dificultad, "veteranos": []} for k, f in enumerate(facciones)]
    m = Mundo(cat, datos, configs, semilla, registrar=True, llegada=True)
    ias = [IA(m, k, dificultad) for k in range(len(configs))]
    for _ in range(int(minutos * 60 * TICKS)):
        for ia in ias:
            ia.actualizar()
        m.paso()
        if m.terminado:
            break
    ganador = m.ganador if m.terminado else None
    ruta = repeticion.guardar(m, configs, ganador, nombre=nombre, carpeta=carpeta)
    return ruta, m


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--mapa", default="quebrada_de_tarapaca")
    ap.add_argument("--minutos", type=float, default=16.0, help="minutos de juego como máximo")
    ap.add_argument("--facciones", default="chile,peru", help="naciones separadas por comas")
    ap.add_argument("--dificultad", default="dificil", choices=sorted(DIFICULTADES))
    ap.add_argument("--semilla", type=int, default=1879)
    ap.add_argument("--nombre", default=None, help="nombre de la repetición (sin extensión)")
    ap.add_argument("--carpeta", default=None, help="carpeta donde guardarla")
    args = ap.parse_args(argv)
    t0 = time.monotonic()
    ruta, m = duelo(args.mapa, args.minutos, tuple(args.facciones.split(",")), args.dificultad, args.semilla,
                    args.nombre, args.carpeta)
    est = [f"{j.nombre}: {j.est.get('enemigos_abatidos', 0)} abatidos, {j.est.get('unidades_perdidas', 0)} perdidas"
           for j in m.jugadores]
    print(f"{m.tick / (TICKS * 60):.1f} minutos simulados en {time.monotonic() - t0:.0f} s; "
          f"{'gana el equipo ' + str(m.ganador) if m.terminado else 'sin vencedor'}.")
    print("; ".join(est))
    print("Repetición:", ruta)
    return 0


if __name__ == "__main__":
    sys.exit(main())
