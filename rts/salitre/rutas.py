"""Carpetas del juego.

- Instalación (solo lectura): datos/, mapas/ y recursos/ junto al programa.
- Usuario (escritura): configuración, bases de datos, repeticiones, mapas
  propios y registros. En Windows está en %APPDATA%\\GuerraDelPacifico, en
  macOS en ~/Library/Application Support/GuerraDelPacifico y en Linux en
  ~/.local/share/guerra-del-pacifico. La variable SALITRE_DATOS_USUARIO
  permite cambiarla (lo usan las pruebas).
"""

import os
import sys
from pathlib import Path


def dir_instalacion() -> Path:
    if getattr(sys, "frozen", False):
        return Path(getattr(sys, "_MEIPASS", Path(sys.executable).parent))
    return Path(__file__).resolve().parent.parent


def dir_datos() -> Path:
    return dir_instalacion() / "datos"


def dir_mapas() -> Path:
    return dir_instalacion() / "mapas"


def dir_recursos() -> Path:
    return dir_instalacion() / "recursos"


def dir_usuario() -> Path:
    propio = os.environ.get("SALITRE_DATOS_USUARIO")
    if propio:
        base = Path(propio)
    elif sys.platform.startswith("win"):
        base = Path(os.environ.get("APPDATA", Path.home() / "AppData" / "Roaming")) / "GuerraDelPacifico"
    elif sys.platform == "darwin":
        base = Path.home() / "Library" / "Application Support" / "GuerraDelPacifico"
    else:
        base = Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local" / "share")) / "guerra-del-pacifico"
    base.mkdir(parents=True, exist_ok=True)
    return base


def _sub(nombre: str) -> Path:
    d = dir_usuario() / nombre
    d.mkdir(parents=True, exist_ok=True)
    return d


def dir_repeticiones() -> Path:
    return _sub("repeticiones")


def dir_mapas_usuario() -> Path:
    return _sub("mapas")


def dir_registros() -> Path:
    return _sub("registros")


def dir_capturas() -> Path:
    return _sub("capturas")


def ruta_config() -> Path:
    return dir_usuario() / "config.json"


def ruta_bd_servidor() -> Path:
    return dir_usuario() / "servidor.db"


def ruta_bd_local() -> Path:
    return dir_usuario() / "perfil.db"
