"""Baja las plantillas de exportación de Godot que usa el cliente 3D (Windows, macOS y
Linux) y las deja donde el editor las busca.

El archivo oficial (Godot_v<versión>-stable_export_templates.tpz) pesa más de 1 GB porque
trae todas las plataformas (Android, iOS, la web...). Este guion lee del servidor solo el
índice del zip y las plantillas que hacen falta, con pedidos HTTP por tramos (Range): unos
300 MB en vez de 1,3 GB.

    python herramientas/plantillas_godot.py                 # en la carpeta del editor
    python herramientas/plantillas_godot.py --destino DIR   # en otra carpeta
    python herramientas/plantillas_godot.py --listar        # qué trae el archivo

La carpeta del editor depende del sistema:
    Linux:   ~/.local/share/godot/export_templates/<versión>.stable/
    macOS:   ~/Library/Application Support/Godot/export_templates/<versión>.stable/
    Windows: %APPDATA%\\Godot\\export_templates\\<versión>.stable\\

La versión de Godot es la de la integración continua (GODOT_VERSION, o --version).
"""

import argparse
import io
import os
import shutil
import sys
import urllib.request
import zipfile
from pathlib import Path

VERSION_GODOT = os.environ.get("GODOT_VERSION", "4.7.2")
URL = "https://github.com/godotengine/godot/releases/download/{v}-stable/Godot_v{v}-stable_export_templates.tpz"
# lo que exporta el cliente 3D (presets de godot/export_presets.cfg, siempre en modo release)
PLANTILLAS = {
    "linux": ["linux_release.x86_64"],
    "windows": ["windows_release_x86_64.exe"],
    "macos": ["macos.zip"],
}


class ArchivoRemoto(io.RawIOBase):
    """Archivo de solo lectura en un servidor HTTP, leído por tramos.

    Mientras se lee de corrido se aprovecha la misma respuesta; un salto abre otra con
    «Range: bytes=desde-». Así zipfile lee el índice del final y después cada miembro
    pedido sin bajar lo demás."""

    def __init__(self, url: str):
        super().__init__()
        with urllib.request.urlopen(urllib.request.Request(url, method="HEAD"), timeout=60) as r:
            self.largo = int(r.headers["Content-Length"])
            self.url = r.geturl()       # la dirección firmada a la que redirige GitHub
        self.pos = 0
        self.bajado = 0
        self._resp = None
        self._resp_pos = -1

    def readable(self) -> bool:
        return True

    def seekable(self) -> bool:
        return True

    def tell(self) -> int:
        return self.pos

    def seek(self, desplazamiento: int, desde: int = io.SEEK_SET) -> int:
        base = {io.SEEK_SET: 0, io.SEEK_CUR: self.pos, io.SEEK_END: self.largo}[desde]
        self.pos = max(0, base + desplazamiento)
        return self.pos

    def _abrir(self) -> None:
        self._cerrar_respuesta()
        pedido = urllib.request.Request(self.url, headers={"Range": f"bytes={self.pos}-"})
        self._resp = urllib.request.urlopen(pedido, timeout=60)
        if self._resp.status != 206:
            raise OSError(f"el servidor no entrega tramos (HTTP {self._resp.status})")
        self._resp_pos = self.pos

    def _cerrar_respuesta(self) -> None:
        if self._resp is not None:
            self._resp.close()
            self._resp = None

    def readinto(self, destino) -> int:
        n = min(len(destino), self.largo - self.pos)
        if n <= 0:
            return 0
        if self._resp is None or self._resp_pos != self.pos:
            self._abrir()
        leidos = self._resp.readinto(memoryview(destino)[:n])
        if not leidos:
            raise OSError("la descarga se cortó")
        self.pos += leidos
        self._resp_pos = self.pos
        self.bajado += leidos
        return leidos

    def close(self) -> None:
        self._cerrar_respuesta()
        super().close()


def carpeta_del_editor(version_carpeta: str) -> Path:
    """Donde el editor de Godot busca las plantillas de esa versión («4.7.2.stable»)."""
    if sys.platform.startswith("win"):
        base = Path(os.environ["APPDATA"]) / "Godot"
    elif sys.platform == "darwin":
        base = Path.home() / "Library" / "Application Support" / "Godot"
    else:
        base = Path(os.environ.get("XDG_DATA_HOME") or Path.home() / ".local" / "share") / "godot"
    return base / "export_templates" / version_carpeta


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--version", default=VERSION_GODOT, help=f"versión de Godot (por omisión {VERSION_GODOT})")
    ap.add_argument("--plataformas", default="linux,windows,macos",
                    help="cuáles bajar, separadas por comas (linux, windows, macos)")
    ap.add_argument("--destino", type=Path, help="carpeta de destino (por omisión, la del editor)")
    ap.add_argument("--listar", action="store_true", help="solo mostrar qué trae el archivo")
    args = ap.parse_args(argv)

    remoto = ArchivoRemoto(URL.format(v=args.version))
    with remoto, zipfile.ZipFile(io.BufferedReader(remoto, 1 << 20)) as zf:
        miembros = {Path(i.filename).name: i for i in zf.infolist() if not i.is_dir()}
        if args.listar:
            for nombre, i in sorted(miembros.items()):
                print(f"{i.file_size / 1e6:9.1f} MB  {nombre}")
            return 0
        version_carpeta = zf.read(miembros["version.txt"]).decode().strip()
        destino = args.destino or carpeta_del_editor(version_carpeta)
        destino.mkdir(parents=True, exist_ok=True)
        (destino / "version.txt").write_text(version_carpeta + "\n", encoding="utf-8")
        for plataforma in [p.strip() for p in args.plataformas.split(",") if p.strip()]:
            if plataforma not in PLANTILLAS:
                ap.error(f"plataforma desconocida: {plataforma}")
            for nombre in PLANTILLAS[plataforma]:
                info = miembros[nombre]
                final = destino / nombre
                if final.exists() and final.stat().st_size == info.file_size:
                    print(f"ya estaba: {final}")
                    continue
                print(f"bajando {nombre} ({info.file_size / 1e6:.0f} MB)...", flush=True)
                parcial = final.with_name(final.name + ".parcial")
                with zf.open(info) as origen, open(parcial, "wb") as f:
                    shutil.copyfileobj(origen, f, 1 << 20)   # zipfile comprueba el CRC al terminar
                if nombre.endswith(".x86_64"):
                    parcial.chmod(0o755)
                os.replace(parcial, final)
        print(f"Plantillas de Godot {version_carpeta} en {destino} ({remoto.bajado / 1e6:.0f} MB bajados)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
