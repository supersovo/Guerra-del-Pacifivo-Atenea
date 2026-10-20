"""Empaquetado: el ícono de la aplicación de macOS y lo que deben compartir PyInstaller, Inno
Setup, los guiones de instalador/, el cliente 3D y los presets de exportación de Godot (los
nombres de los ejecutables, los sistemas y la versión)."""

import configparser
import re
import struct
import sys

from salitre import VERSION, rutas
from utilidades import RAIZ

sys.path.insert(0, str(RAIZ / "herramientas"))

import exportar_cliente3d  # noqa: E402
import exportar_godot  # noqa: E402
import plantillas_godot  # noqa: E402

INSTALADOR = RAIZ / "instalador"
GODOT = RAIZ / "godot"

# tipo de imagen del .icns → lado en píxeles (los de pantallas Retina incluidos)
TIPOS_ICNS = {b"ic11": 32, b"ic12": 64, b"ic07": 128, b"ic13": 256, b"ic08": 256, b"ic14": 512, b"ic09": 512}


def test_icono_de_macos():
    datos = (rutas.dir_recursos() / "icono.icns").read_bytes()
    assert datos[:4] == b"icns"
    assert struct.unpack(">I", datos[4:8])[0] == len(datos)
    p = 8
    entradas = {}
    indice = None
    while p < len(datos):
        tipo, largo = datos[p:p + 4], struct.unpack(">I", datos[p + 4:p + 8])[0]
        assert largo > 8 and p + largo <= len(datos)
        if tipo == b"TOC ":
            cuerpo = datos[p + 8:p + largo]
            indice = [(cuerpo[i:i + 4], struct.unpack(">I", cuerpo[i + 4:i + 8])[0]) for i in range(0, len(cuerpo), 8)]
        else:
            png = datos[p + 8:p + largo]
            assert png[:8] == b"\x89PNG\r\n\x1a\n", tipo
            entradas[tipo] = (largo, struct.unpack(">II", png[16:24]))
        p += largo
    assert {t: lado for t, (_, (lado, _alto)) in entradas.items()} == TIPOS_ICNS
    assert all(ancho == alto for _, (ancho, alto) in entradas.values())
    assert indice == [(t, largo) for t, (largo, _) in entradas.items()]


def _leer(ruta):
    return ruta.read_text(encoding="utf-8-sig")


def test_nombres_de_los_ejecutables():
    """El cliente 3D (GuerraDelPacifico), la versión clásica (GuerraDelPacificoClasico) y el
    servidor (ServidorSalitre) se llaman igual en todos lados: si uno cambia, el cliente 3D
    instalado no encuentra al otro."""
    spec = _leer(INSTALADOR / "salitre.spec")
    assert re.findall(r'^    name="(\w+)",$', spec, flags=re.M) == ["GuerraDelPacificoClasico", "ServidorSalitre",
                                                                     "GuerraDelPacifico"]
    assert 'const CLASICA := "GuerraDelPacificoClasico"' in _leer(GODOT / "codigo" / "juego.gd")
    assert 'ejecutable_hermano("ServidorSalitre"' in _leer(GODOT / "codigo" / "red" / "servidor_local.gd")
    iss = _leer(INSTALADOR / "salitre.iss")
    for define, exe in [("Exe", "GuerraDelPacifico.exe"), ("ExeClasico", "GuerraDelPacificoClasico.exe"),
                        ("ExeServidor", "ServidorSalitre.exe")]:
        assert f'#define {define} "{exe}"' in iss
    assert exportar_cliente3d.SISTEMAS["windows"][1] == "windows/GuerraDelPacifico.exe"
    assert exportar_cliente3d.SISTEMAS["linux"][1] == "linux/GuerraDelPacifico"
    linux = _leer(INSTALADOR / "construir.sh")
    assert 'cp dist/cliente3d/linux/GuerraDelPacifico "$CARPETA/GuerraDelPacifico"' in linux
    assert '"$CARPETA/GuerraDelPacificoClasico" --prueba-humo' in linux
    windows = _leer(INSTALADOR / "construir_windows.ps1")
    assert '"dist\\GuerraDelPacifico\\GuerraDelPacifico.exe"' in windows
    mac = _leer(INSTALADOR / "construir_mac.sh")
    assert "plutil -replace CFBundleExecutable -string GuerraDelPacifico " in mac
    assert '"$APP/Contents/Resources/GuerraDelPacifico.pck"' in mac
    assert "for exe in GuerraDelPacificoClasico ServidorSalitre GuerraDelPacifico; do" in mac
    ci = _leer(RAIZ.parent / ".github" / "workflows" / "rts.yml")
    assert 'dist\\GuerraDelPacifico\\GuerraDelPacificoClasico.exe' in ci
    assert 'probar_cliente3d.py dist\\GuerraDelPacifico\\GuerraDelPacifico.exe' in ci


def _presets():
    cfg = configparser.ConfigParser(interpolation=None, comment_prefixes=(";",), strict=True)
    cfg.optionxform = str
    cfg.read_string(_leer(GODOT / "export_presets.cfg"))
    presets = {}
    for seccion in cfg.sections():
        if re.fullmatch(r"preset\.\d+", seccion):
            datos = {k: v.strip('"') for k, v in cfg[seccion].items()}
            datos.update({k: v.strip('"') for k, v in cfg[seccion + ".options"].items()})
            presets[datos["name"]] = datos
    return presets


def test_presets_de_exportacion_de_godot():
    presets = _presets()
    assert set(presets) == {preset for preset, _ in exportar_cliente3d.SISTEMAS.values()}
    assert set(plantillas_godot.PLANTILLAS) == set(exportar_cliente3d.SISTEMAS)
    for preset, archivo in exportar_cliente3d.SISTEMAS.values():
        p = presets[preset]
        assert p["export_path"] == "../dist/cliente3d/" + archivo
        assert p["runnable"] == "true" and p["export_filter"] == "all_resources"
        # el catálogo se lee con FileAccess: tiene que ir en el paquete
        assert "datos/*.json" in p["include_filter"]
    for preset in ("Windows", "Linux"):
        assert presets[preset]["binary_format/architecture"] == "x86_64"
        assert presets[preset]["binary_format/embed_pck"] == "true"
    assert presets["Windows"]["debug/export_console_wrapper"] == "0"
    mac = presets["macOS"]
    assert mac["binary_format/architecture"] == "universal"
    assert mac["application/bundle_identifier"] == "cl.proyectoatenea.guerradelpacifico"
    # una aplicación universal exige ETC2/ASTC, también en el proyecto
    assert mac["texture_format/etc2_astc"] == "true"
    assert "textures/vram_compression/import_etc2_astc=true" in _leer(GODOT / "project.godot")


def test_version_de_godot_y_del_proyecto():
    ci = _leer(RAIZ.parent / ".github" / "workflows" / "rts.yml")
    version_ci = re.search(r'^  GODOT_VERSION: "([\d.]+)"$', ci, flags=re.M).group(1)
    assert re.search(r'os\.environ\.get\("GODOT_VERSION", "([\d.]+)"\)',
                     _leer(RAIZ / "herramientas" / "plantillas_godot.py")).group(1) == version_ci
    assert f'"{version_ci.rsplit(".", 1)[0]}"' in re.search(r"config/features=.*", _leer(GODOT / "project.godot")).group(0)
    base = '[application]\n\nconfig/name="X"\nconfig/description="Y"\nrun/main_scene="z"\n'
    con = exportar_godot.proyecto_con_version(base)
    assert con == base.replace('config/description="Y"\n', f'config/description="Y"\nconfig/version="{VERSION}"\n')
    vieja = con.replace(VERSION, "0.0.1")
    assert exportar_godot.proyecto_con_version(vieja) == con
    assert exportar_godot.proyecto_con_version(con) == con

