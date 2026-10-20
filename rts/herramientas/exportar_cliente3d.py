"""Exporta el cliente 3D (godot/) para Windows, macOS o Linux con los presets de
godot/export_presets.cfg, en dist/cliente3d/<sistema>/.

    python herramientas/exportar_cliente3d.py                           # para este sistema
    python herramientas/exportar_cliente3d.py --sistemas windows,macos,linux

Hace falta el editor de Godot de la versión del proyecto (SALITRE_GODOT, o --godot). Si
faltan sus plantillas de exportación, se bajan solas (herramientas/plantillas_godot.py).
Desde cualquier sistema se exporta para los tres: la integración continua lo hace en Linux.

Resultado (los datos del proyecto van dentro del ejecutable):
    dist/cliente3d/windows/GuerraDelPacifico.exe
    dist/cliente3d/linux/GuerraDelPacifico
    dist/cliente3d/macos/GuerraDelPacifico.zip   (una aplicación de la que instalador/construir_mac.sh
                                                  toma el ejecutable y el .pck)
Los guiones de instalador/ lo juntan con los ejecutables de PyInstaller (la versión clásica y
el servidor), que traen los datos, los mapas y los recursos que el cliente 3D lee al jugar.
"""

import argparse
import os
import subprocess
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ / "herramientas"))

import plantillas_godot  # noqa: E402

PROYECTO = RAIZ / "godot"
DESTINO = RAIZ / "dist" / "cliente3d"
# sistema: (preset de export_presets.cfg, archivo exportado)
SISTEMAS = {
    "windows": ("Windows", "windows/GuerraDelPacifico.exe"),
    "macos": ("macOS", "macos/GuerraDelPacifico.zip"),
    "linux": ("Linux", "linux/GuerraDelPacifico"),
}


def sistema_propio() -> str:
    if sys.platform.startswith("win"):
        return "windows"
    return "macos" if sys.platform == "darwin" else "linux"


def version_de_godot(godot: str) -> str:
    """«4.7.2.stable» (la carpeta de sus plantillas) a partir de «4.7.2.stable.official.ed1daf0bf»."""
    salida = subprocess.run([godot, "--headless", "--version"], capture_output=True, text=True, check=True).stdout
    return ".".join(salida.strip().splitlines()[-1].split(".")[:-2])


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--sistemas", default=sistema_propio(),
                    help="para cuáles exportar, separados por comas (windows, macos, linux)")
    ap.add_argument("--godot", default=os.environ.get("SALITRE_GODOT", ""),
                    help="el editor de Godot (por omisión, SALITRE_GODOT)")
    ap.add_argument("--destino", type=Path, default=DESTINO, help=f"carpeta de salida (por omisión {DESTINO})")
    args = ap.parse_args(argv)
    if not args.godot:
        ap.error("falta el editor de Godot: defina SALITRE_GODOT o use --godot")
    sistemas = [s.strip() for s in args.sistemas.split(",") if s.strip()]
    for s in sistemas:
        if s not in SISTEMAS:
            ap.error(f"sistema desconocido: {s}")

    version = version_de_godot(args.godot)
    plantillas = plantillas_godot.carpeta_del_editor(version)
    faltan = [s for s in sistemas if not all((plantillas / n).exists() for n in plantillas_godot.PLANTILLAS[s])]
    if faltan:
        plantillas_godot.main(["--version", version.rsplit(".", 1)[0], "--plataformas", ",".join(faltan)])

    # la primera vez (o tras cambiar recursos) el editor importa el proyecto
    subprocess.run([args.godot, "--headless", "--path", str(PROYECTO), "--import"], check=True)
    for s in sistemas:
        preset, archivo = SISTEMAS[s]
        salida = (args.destino / archivo).resolve()
        salida.parent.mkdir(parents=True, exist_ok=True)
        if salida.exists():
            salida.unlink()
        print(f"Exportando el cliente 3D para {preset} en {salida}", flush=True)
        r = subprocess.run([args.godot, "--headless", "--path", str(PROYECTO), "--export-release", preset, str(salida)])
        if r.returncode != 0 or not salida.exists():
            print(f"La exportación para {preset} falló (código {r.returncode})", file=sys.stderr)
            return 1
        print(f"Listo: {salida} ({salida.stat().st_size / 1e6:.0f} MB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
