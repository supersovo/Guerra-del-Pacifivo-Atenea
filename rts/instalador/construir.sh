#!/usr/bin/env sh
# Construye la versión portátil para Linux y la comprime: una carpeta con el juego
# (el cliente 3D), la versión clásica (pygame), el servidor dedicado y los datos que
# comparten. Desde la carpeta rts:
#
#     SALITRE_GODOT=~/Godot_v4.7.2-stable_linux.x86_64 sh instalador/construir.sh
#
# Con SALITRE_GODOT el cliente 3D se exporta con ese editor de Godot (sus plantillas
# de exportación se bajan solas); sin él, se usa el que ya esté en dist/cliente3d/linux/
# (así lo deja la integración continua). En macOS, instalador/construir_mac.sh arma la
# aplicación y su .dmg.
set -eu
cd "$(dirname "$0")/.."
python3 -m pip install -r requirements.txt pyinstaller
python3 -m PyInstaller --noconfirm instalador/salitre.spec
CARPETA=dist/GuerraDelPacifico
if [ -n "${SALITRE_GODOT:-}" ]; then
    python3 herramientas/exportar_cliente3d.py --sistemas linux
elif [ ! -f dist/cliente3d/linux/GuerraDelPacifico ]; then
    echo "Falta el cliente 3D: defina SALITRE_GODOT con el editor de Godot 4.7.2 para exportarlo" >&2
    exit 1
fi
cp dist/cliente3d/linux/GuerraDelPacifico "$CARPETA/GuerraDelPacifico"
chmod +x "$CARPETA/GuerraDelPacifico"

# pruebas de humo: la versión clásica, el cliente 3D con el servidor empaquetado y el servidor
SDL_VIDEODRIVER=dummy SDL_AUDIODRIVER=dummy SALITRE_DATOS_USUARIO="$(mktemp -d)" \
    "$CARPETA/GuerraDelPacificoClasico" --prueba-humo
python3 instalador/probar_cliente3d.py "$CARPETA/GuerraDelPacifico"
"$CARPETA/ServidorSalitre" --help >/dev/null

VERSION=$(python3 -c "import salitre; print(salitre.VERSION)")
SISTEMA=$(uname -s | tr '[:upper:]' '[:lower:]')
tar -C dist -czf "dist/GuerraDelPacifico-$VERSION-$SISTEMA.tar.gz" GuerraDelPacifico
echo "Listo: dist/GuerraDelPacifico-$VERSION-$SISTEMA.tar.gz"
