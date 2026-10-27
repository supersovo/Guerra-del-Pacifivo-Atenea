"""Prueba de humo del cliente 3D empaquetado: abre el ejecutable sin pantalla y juega de
punta a punta (menú, escaramuza contra la IA, órdenes, rendición y parte de guerra) con el
servidor que viaja con él. Python queda fuera de su alcance (SALITRE_PYTHON apunta a un
archivo que no existe): si el cliente no encuentra el ServidorSalitre empaquetado, falla.

    python instalador/probar_cliente3d.py dist/GuerraDelPacifico/GuerraDelPacifico
    python instalador/probar_cliente3d.py --arch x86_64 ".../Contents/MacOS/GuerraDelPacifico"

Lo usan los guiones de instalador/ y la integración continua. Si falla, muestra el final
del registro de Godot y del servidor.
"""

import argparse
import os
import subprocess
import sys
import tempfile
from pathlib import Path


def _cola(ruta: Path, lineas: int = 60) -> str:
    try:
        return "\n".join(ruta.read_text(encoding="utf-8", errors="replace").splitlines()[-lineas:])
    except OSError:
        return "(no existe)"


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("ejecutable", type=Path, help="el cliente 3D empaquetado (GuerraDelPacifico)")
    ap.add_argument("--arch", help="en macOS, la parte del ejecutable universal que se prueba (x86_64 con Rosetta 2)")
    ap.add_argument("--segundos", type=int, default=420, help="tiempo máximo")
    args = ap.parse_args(argv)

    datos = Path(tempfile.mkdtemp(prefix="salitre-humo-3d-"))
    registro = datos / "godot.log"
    orden = [str(args.ejecutable.resolve()), "--headless", "--log-file", str(registro), "--", "--prueba-humo"]
    if args.arch:
        orden = ["arch", f"-{args.arch}"] + orden
    entorno = dict(os.environ, SALITRE_DATOS_USUARIO=str(datos), SALITRE_PYTHON=str(datos / "sin-python"))
    for variable in ("SALITRE_SERVIDOR", "SALITRE_RTS"):
        entorno.pop(variable, None)
    print("Prueba de humo del cliente 3D:", " ".join(orden), flush=True)
    try:
        r = subprocess.run(orden, env=entorno, timeout=args.segundos, stdout=subprocess.PIPE,
                           stderr=subprocess.STDOUT, text=True, errors="replace")
        codigo, salida = r.returncode, r.stdout
    except subprocess.TimeoutExpired as e:
        codigo, salida = None, (e.stdout or b"").decode("utf-8", "replace") if isinstance(e.stdout, bytes) else (e.stdout or "")
    # el registro trae todo lo que el cliente imprime (en Windows la salida estándar puede venir vacía)
    texto = _cola(registro, 100000) if registro.exists() else salida
    for linea in texto.splitlines():
        if linea.startswith(("PRUEBA_HUMO", "RECORRIDO", "AVISO")):
            print("  ", linea)
    if codigo == 0 and "PRUEBA_HUMO: OK" in texto + salida:
        print("Cliente 3D empaquetado: prueba de humo superada")
        return 0
    print(f"La prueba de humo del cliente 3D falló (código {codigo})", file=sys.stderr)
    print("---- registro de Godot ----\n" + _cola(registro), file=sys.stderr)
    for log in sorted((datos / "registros").glob("*.log")):
        print(f"---- {log.name} ----\n" + _cola(log), file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
