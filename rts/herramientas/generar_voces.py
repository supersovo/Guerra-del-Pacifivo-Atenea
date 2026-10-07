"""Genera las voces de la tropa (recursos/sonidos/voces/) con síntesis de voz local.

Las frases se dicen al formar una unidad, al seleccionarla, al darle una orden
y en los avisos del cuartel general. Se sintetizan una sola vez, sin conexión,
con el modelo abierto Kokoro-82M (licencia Apache 2.0) y sus voces en español,
y se guardan como OGG Vorbis junto a voces.json (texto y voz de cada archivo).
El juego no necesita nada de esto para funcionar: solo lee los .ogg.

Requisitos (fuera de las dependencias del juego, por ejemplo en un entorno aparte):
    pip install kokoro-onnx soundfile
y los archivos del modelo, publicados en
https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0
(kokoro-v1.0.int8.onnx y voices-v1.0.bin).

Uso:
    python herramientas/generar_voces.py --modelo kokoro-v1.0.int8.onnx --voces voices-v1.0.bin
    python herramientas/generar_voces.py ... --solo lista_infante atacar_caballeria
"""

import argparse
import json
import shutil
import sys
import tempfile
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
SALIDA = RAIZ / "recursos" / "sonidos" / "voces"

SOLDADO = "em_alex"        # la tropa
OFICIAL = "em_santa"       # el ayudante que da los avisos y los jefes
MUJER = "ef_dora"          # cantineras, sargento Irene Morales, Ignacia Zeballos

# clave -> lista de (texto, voz). El juego elige una al azar entre las de la clave.
FRASES = {
    # --- unidad formada en el cuartel, las barracas, la caballeriza... ("lista" sirve a cualquier otra)
    "lista": [("Unidad lista, mi comandante.", OFICIAL)],
    "lista_trabajador": [("Trabajador listo para la faena.", SOLDADO)],
    "lista_infante": [("¡Infante de línea, listo para el combate!", SOLDADO), ("¡Presente, mi comandante!", SOLDADO)],
    "lista_cantinera": [("Cantinera lista. Traigo agua para la tropa.", MUJER)],
    "lista_ingeniero": [("Dinamitero listo. ¡Cuidado con la mecha!", SOLDADO)],
    "lista_zapador": [("¡Zapador listo, con pala y fusil!", SOLDADO)],
    "lista_torpedista": [("Torpedista listo para sembrar las minas.", SOLDADO)],
    "lista_montonero": [("¡Montonero listo! ¡Por la patria!", SOLDADO)],
    "lista_colorado": [("¡Colorados de Bolivia, presentes!", SOLDADO)],
    "lista_granadero": [("¡Granadero a caballo, listo para la carga!", SOLDADO)],
    "lista_cazador": [("¡Cazador a caballo, listo para explorar!", SOLDADO)],
    "lista_baqueano": [("Baqueano listo. Conozco cada huella del desierto.", SOLDADO)],
    "lista_artilleria_montana": [("¡Cañón de montaña en batería!", SOLDADO)],
    "lista_canon_campana": [("¡Cañón de campaña, listo para abrir fuego!", SOLDADO)],
    "lista_gatling": [("¡Ametralladora Gatling, lista!", SOLDADO)],
    "lista_espia": [("El espía está listo. Nadie sabrá que estuve aquí.", SOLDADO)],
    "lista_transporte": [("Transporte a vapor, listo para zarpar.", SOLDADO)],
    "lista_canonera": [("¡Cañonera lista para zarpar!", SOLDADO)],
    # héroes: sus palabras más conocidas o una presentación
    "lista_baquedano": [("General Baquedano en campaña. ¡Adelante, muchachos!", OFICIAL)],
    "lista_san_martin": [("San Martín, presente. ¡Cuarto de Línea, adelante!", OFICIAL)],
    "lista_velasquez": [("Coronel Velásquez, presente. ¡Artillería, fuego a discreción!", OFICIAL)],
    "lista_irene_morales": [("Sargento Irene Morales, presente. ¡A la lucha!", MUJER)],
    "lista_prat": [("¡Al abordaje, muchachos!", OFICIAL)],
    "lista_bolognesi": [("Tengo deberes sagrados que cumplir, y los cumpliré hasta quemar el último cartucho.",
                         OFICIAL)],
    "lista_caceres": [("General Cáceres, presente. ¡La resistencia continúa!", OFICIAL)],
    "lista_ugarte": [("Coronel Ugarte, presente. ¡Por el Perú, hasta el final!", OFICIAL)],
    "lista_grau": [("Grau, al mando del Huáscar. ¡Avante!", OFICIAL)],
    "lista_campero": [("General Campero, presente. ¡Adelante, Bolivia!", OFICIAL)],
    "lista_abaroa": [("¿Rendirme yo? ¡Que se rinda su abuela!", OFICIAL)],
    "lista_camacho": [("Coronel Camacho, presente. ¡A las armas!", OFICIAL)],
    "lista_zeballos": [("Ignacia Zeballos, lista para atender a los heridos.", MUJER)],
    "lista_roca": [("General Roca, presente. ¡Adelante!", OFICIAL)],
    "lista_villegas": [("Coronel Villegas, presente. ¡A caballo!", OFICIAL)],
    "lista_saenz_pena": [("Sáenz Peña, presente. ¡Por la causa aliada!", OFICIAL)],
    "lista_piedrabuena": [("Comandante Piedrabuena, al timón. ¡Avante!", OFICIAL)],
    # --- al seleccionar
    "seleccion_trabajador": [("¿Qué ordena?", SOLDADO), ("Listo para la faena.", SOLDADO)],
    "seleccion_infanteria": [("¿Órdenes, mi comandante?", SOLDADO), ("¡Presente!", SOLDADO),
                             ("¡A sus órdenes!", SOLDADO)],
    "seleccion_caballeria": [("¡Caballería lista!", SOLDADO), ("¿Hacia dónde cabalgamos?", SOLDADO)],
    "seleccion_artilleria": [("¡Artillería lista!", SOLDADO), ("Pieza en batería, mi comandante.", SOLDADO)],
    "seleccion_naval": [("¿Qué rumbo, mi comandante?", SOLDADO), ("¡Buque listo!", SOLDADO)],
    "seleccion_cantinera": [("¿Agua para la tropa?", MUJER), ("Aquí está la cantinera.", MUJER)],
    "seleccion_espia": [("Hable bajo, mi comandante.", SOLDADO), ("Nadie me verá.", SOLDADO)],
    "seleccion_heroina": [("¡A sus órdenes, mi comandante!", MUJER), ("¡Presente!", MUJER)],
    # --- órdenes de marcha
    "mover_trabajador": [("Voy enseguida.", SOLDADO), ("En camino.", SOLDADO)],
    "mover_infanteria": [("¡En marcha!", SOLDADO), ("¡Entendido!", SOLDADO), ("¡Avanzamos!", SOLDADO)],
    "mover_caballeria": [("¡Al trote!", SOLDADO), ("¡A caballo!", SOLDADO)],
    "mover_artilleria": [("¡Enganchen la pieza!", SOLDADO), ("¡Muevan los cañones!", SOLDADO)],
    "mover_naval": [("¡Avante!", SOLDADO), ("Rumbo fijado.", SOLDADO)],
    "mover_cantinera": [("Voy con la tropa.", MUJER)],
    "mover_espia": [("Sin ser visto.", SOLDADO)],
    "mover_heroina": [("¡En marcha!", MUJER), ("¡Vamos!", MUJER)],
    # --- órdenes de ataque
    "atacar_infanteria": [("¡Calen bayoneta!", SOLDADO), ("¡Fuego a discreción!", SOLDADO), ("¡Al ataque!", SOLDADO)],
    "atacar_caballeria": [("¡A la carga!", SOLDADO), ("¡Sable en mano!", SOLDADO)],
    "atacar_artilleria": [("¡Fuego!", SOLDADO), ("¡Apunten! ¡Fuego!", SOLDADO)],
    "atacar_naval": [("¡Fuego de andanada!", SOLDADO), ("¡Al ataque!", SOLDADO)],
    "atacar_trabajador": [("¡A defenderse!", SOLDADO)],
    "atacar_heroina": [("¡Al ataque!", MUJER)],
    # --- faenas: recolectar, construir, reparar
    "trabajar": [("A la faena.", SOLDADO), ("Manos a la obra.", SOLDADO)],
    # --- avisos del cuartel general
    "obra": [("Obra terminada, mi comandante.", OFICIAL)],
    "investigado": [("Investigación completada.", OFICIAL)],
    "ataque_tropas": [("¡Nuestras tropas están bajo ataque!", OFICIAL)],
    "ataque_trabajadores": [("¡Atacan a nuestros trabajadores!", OFICIAL)],
    "pob": [("Necesitamos otro Depósito de Intendencia.", OFICIAL)],
    "falta_dinero": [("Falta dinero, mi comandante.", OFICIAL)],
    "falta_agua": [("Falta agua, mi comandante.", OFICIAL)],
    "llegada": [("¡Llegó el cuartel general!", OFICIAL)],
    "recuperado": [("Un soldado vuelve a filas.", OFICIAL)],
    "victoria": [("¡Victoria! ¡La jornada es nuestra!", OFICIAL)],
    "derrota": [("Hemos sido derrotados.", OFICIAL)],
}

VELOCIDAD = {SOLDADO: 1.08, OFICIAL: 1.0, MUJER: 1.04}


def _datos_espeak_cortos(ruta):
    """espeak-ng no encuentra sus datos si la ruta pasa de unos 150 caracteres: se copian a una corta."""
    if ruta is None:
        import espeakng_loader
        ruta = espeakng_loader.get_data_path()
    if len(str(ruta)) < 120:
        return str(ruta)
    destino = Path(tempfile.mkdtemp(prefix="esd")) / "datos"
    shutil.copytree(ruta, destino)
    return str(destino)


def _pulir(muestras, sr, np):
    """Recorta los silencios, iguala la sonoridad y suaviza los bordes."""
    x = np.asarray(muestras, dtype="float32")
    if x.ndim > 1:
        x = x.mean(axis=1)
    umbral = 0.02 * float(np.max(np.abs(x)) or 1.0)
    activos = np.nonzero(np.abs(x) > umbral)[0]
    if len(activos):
        ini = max(0, activos[0] - int(0.02 * sr))
        fin = min(len(x), activos[-1] + int(0.08 * sr))
        x = x[ini:fin]
    # sonoridad pareja entre frases (valor eficaz de lo hablado), sin pasar del 97 % del pico
    hablado = x[np.abs(x) > 0.05 * float(np.max(np.abs(x)) or 1.0)]
    rms = float(np.sqrt(np.mean(hablado ** 2))) if len(hablado) else 0.1
    x = x * min(0.16 / max(1e-6, rms), 0.97 / max(1e-6, float(np.max(np.abs(x)))))
    borde = min(len(x) // 4, int(0.01 * sr))
    if borde:
        x[:borde] *= np.linspace(0.0, 1.0, borde, dtype="float32")
        x[-borde:] *= np.linspace(1.0, 0.0, borde, dtype="float32")
    return x


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--modelo", required=True, help="kokoro-v1.0.int8.onnx (o kokoro-v1.0.onnx)")
    ap.add_argument("--voces", required=True, help="voices-v1.0.bin")
    ap.add_argument("--espeak-datos", help="carpeta espeak-ng-data (por omisión, la de espeakng-loader)")
    ap.add_argument("--solo", nargs="*", help="generar solo estas claves")
    args = ap.parse_args(argv)
    try:
        import numpy as np
        import soundfile as sf
        from kokoro_onnx import Kokoro
        from kokoro_onnx.config import EspeakConfig
    except ImportError as e:
        sys.exit(f"Falta un módulo ({e}). Instale: pip install kokoro-onnx soundfile")
    tts = Kokoro(args.modelo, args.voces, espeak_config=EspeakConfig(data_path=_datos_espeak_cortos(args.espeak_datos)))
    SALIDA.mkdir(parents=True, exist_ok=True)
    ruta_indice = SALIDA / "voces.json"
    indice = json.loads(ruta_indice.read_text(encoding="utf-8")) if ruta_indice.exists() else {}
    claves = args.solo or list(FRASES)
    for clave in claves:
        if clave not in FRASES:
            sys.exit(f"Clave desconocida: {clave}")
        for viejo in SALIDA.glob(f"{clave}_[0-9]*.ogg"):
            viejo.unlink()
        for n, (texto, voz) in enumerate(FRASES[clave], 1):
            muestras, sr = tts.create(texto, voice=voz, speed=VELOCIDAD.get(voz, 1.0), lang="es")
            archivo = f"{clave}_{n}.ogg"
            sf.write(SALIDA / archivo, _pulir(muestras, sr, np), sr, format="OGG", subtype="VORBIS",
                     compression_level=0.5)
            indice[archivo] = {"texto": texto, "voz": voz}
            print(f"{archivo:34} {voz:9} {texto}")
    vigentes = {f"{c}_{n}.ogg" for c, frases in FRASES.items() for n in range(1, len(frases) + 1)}
    if not args.solo:
        for sobrante in SALIDA.glob("*.ogg"):      # frases que ya no están en la lista
            if sobrante.name not in vigentes:
                sobrante.unlink()
    indice = {k: v for k, v in sorted(indice.items()) if k in vigentes}
    ruta_indice.write_text(json.dumps({"_modelo": "Kokoro-82M v1.0 (Apache 2.0), voces em_alex, em_santa y ef_dora",
                                       **indice}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{len(indice)} voces en {SALIDA}")


if __name__ == "__main__":
    main()
