#!/usr/bin/env sh
# Construye la versión portátil para Linux o macOS (carpeta con el juego y el
# servidor dedicado) y la comprime. Desde la carpeta rts:
#
#     sh instalador/construir.sh
set -eu
cd "$(dirname "$0")/.."
python3 -m pip install -r requirements.txt pyinstaller
python3 -m PyInstaller --noconfirm instalador/salitre.spec
SDL_VIDEODRIVER=dummy SDL_AUDIODRIVER=dummy SALITRE_DATOS_USUARIO="$(mktemp -d)" \
    dist/GuerraDelPacifico/GuerraDelPacifico --prueba-humo
VERSION=$(python3 -c "import salitre; print(salitre.VERSION)")
SISTEMA=$(uname -s | tr '[:upper:]' '[:lower:]')
tar -C dist -czf "dist/GuerraDelPacifico-$VERSION-$SISTEMA.tar.gz" GuerraDelPacifico
echo "Listo: dist/GuerraDelPacifico-$VERSION-$SISTEMA.tar.gz"
