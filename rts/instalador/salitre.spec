# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller: el juego (sin consola) y el servidor dedicado (con consola) en
una sola carpeta que comparten Python, pygame y los datos.

    cd rts
    pyinstaller --noconfirm instalador/salitre.spec

Resultado: dist/GuerraDelPacifico/ con GuerraDelPacifico(.exe) y
ServidorSalitre(.exe). El instalador de Windows (salitre.iss) empaqueta esa carpeta.
En macOS sale además dist/Guerra del Pacífico.app (instalador/construir_mac.sh
la mete en un .dmg); con SALITRE_ARQUITECTURA=universal2 sirve para Mac con
procesador Intel y con Apple Silicon (hace falta el Python universal2 de python.org).
"""

import os
import sys
from pathlib import Path

RAIZ = Path(SPECPATH).resolve().parent          # carpeta rts/
ICONO = str(RAIZ / "recursos" / "icono.ico")
EN_WINDOWS = sys.platform.startswith("win")
EN_MAC = sys.platform == "darwin"
ARQUITECTURA = (os.environ.get("SALITRE_ARQUITECTURA") or None) if EN_MAC else None
VERSION = next(ln.split('"')[1] for ln in (RAIZ / "salitre" / "__init__.py").read_text(encoding="utf-8").splitlines()
               if ln.startswith("VERSION"))


def archivo_version():
    """Datos de versión que Windows muestra en las propiedades del .exe."""
    nums = tuple(int(x) for x in (VERSION.split(".") + ["0", "0", "0"])[:4])
    texto = f"""VSVersionInfo(
  ffi=FixedFileInfo(filevers={nums}, prodvers={nums}, mask=0x3f, flags=0x0, OS=0x40004,
                    fileType=0x1, subtype=0x0, date=(0, 0)),
  kids=[
    StringFileInfo([StringTable('0C0A04B0', [
      StringStruct('CompanyName', 'Proyecto Atenea'),
      StringStruct('FileDescription', 'Guerra del Pacífico: Salitre y Pólvora'),
      StringStruct('FileVersion', '{VERSION}'),
      StringStruct('InternalName', 'GuerraDelPacifico'),
      StringStruct('OriginalFilename', 'GuerraDelPacifico.exe'),
      StringStruct('ProductName', 'Guerra del Pacífico: Salitre y Pólvora'),
      StringStruct('ProductVersion', '{VERSION}')])]),
    VarFileInfo([VarStruct('Translation', [0x0C0A, 1200])])
  ]
)
"""
    ruta = Path(SPECPATH) / "version_windows.txt"
    ruta.write_text(texto, encoding="utf-8")
    return str(ruta)


DATOS = [
    (str(RAIZ / "datos"), "datos"),
    (str(RAIZ / "mapas"), "mapas"),
    (str(RAIZ / "recursos"), "recursos"),
]
# lo que nunca hace falta en el ejecutable
EXCLUIR = ["tkinter", "unittest", "pydoc_data", "test", "numpy", "pytest", "PyInstaller"]

juego = Analysis(
    [str(RAIZ / "instalador" / "lanzar_juego.py")],
    pathex=[str(RAIZ)],
    datas=DATOS,
    hiddenimports=["salitre.servidor.principal"],
    excludes=EXCLUIR,
    noarchive=False,
)
servidor = Analysis(
    [str(RAIZ / "instalador" / "lanzar_servidor.py")],
    pathex=[str(RAIZ)],
    datas=[],
    excludes=EXCLUIR + ["pygame"],
    noarchive=False,
)

pyz_juego = PYZ(juego.pure)
pyz_servidor = PYZ(servidor.pure)

exe_juego = EXE(
    pyz_juego,
    juego.scripts,
    [],
    exclude_binaries=True,
    name="GuerraDelPacifico",
    console=False,
    icon=ICONO if EN_WINDOWS else None,
    version=archivo_version() if EN_WINDOWS else None,
    target_arch=ARQUITECTURA,
    upx=False,
)
exe_servidor = EXE(
    pyz_servidor,
    servidor.scripts,
    [],
    exclude_binaries=True,
    name="ServidorSalitre",
    console=True,
    icon=ICONO if EN_WINDOWS else None,
    target_arch=ARQUITECTURA,
    upx=False,
)

coll = COLLECT(
    exe_juego,
    juego.binaries,
    juego.datas,
    exe_servidor,
    servidor.binaries,
    servidor.datas,
    name="GuerraDelPacifico",
    upx=False,
)

if EN_MAC:
    # El juego es el primer ejecutable: el que abre el ícono. El servidor dedicado
    # queda junto a él, en Contents/MacOS/ServidorSalitre, para usarlo desde la Terminal.
    app = BUNDLE(
        coll,
        name="Guerra del Pacífico.app",
        icon=str(RAIZ / "recursos" / "icono.icns"),
        bundle_identifier="cl.proyectoatenea.guerradelpacifico",
        version=VERSION,
        info_plist={
            "CFBundleVersion": VERSION,
            "CFBundleDevelopmentRegion": "es",
            "LSApplicationCategoryType": "public.app-category.strategy-games",
            "LSMinimumSystemVersion": "10.13",
            # PyInstaller marca la aplicación como «de fondo» (sin Dock ni foco) cuando el
            # último ejecutable lleva consola, y aquí ese es el servidor dedicado
            "LSBackgroundOnly": False,
            "NSHighResolutionCapable": True,
            "NSHumanReadableCopyright": "Proyecto Atenea",
            "NSLocalNetworkUsageDescription":
                "Para encontrar las partidas de sus compañeros en la red local y jugar con ellos.",
        },
    )
