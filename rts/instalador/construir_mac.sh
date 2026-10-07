#!/usr/bin/env sh
# Construye la aplicación para macOS («Guerra del Pacífico.app»), la prueba y la
# guarda en una imagen de disco .dmg para repartirla. Desde la carpeta rts, en un Mac:
#
#     sh instalador/construir_mac.sh
#
# Con SALITRE_ARQUITECTURA=universal2 (así la arma la integración continua) la
# aplicación sirve para Mac con procesador Intel y con Apple Silicon; para eso el
# Python que construye debe ser el «universal2» de python.org. Sin la variable,
# sirve para el procesador del equipo que la construye.
#
# Resultado: dist/GuerraDelPacifico-<versión>-macOS.dmg
set -eu
cd "$(dirname "$0")/.."
PY=${PYTHON:-python3}
NOMBRE="Guerra del Pacífico"
APP="dist/$NOMBRE.app"

$PY -m pip install -r requirements.txt pyinstaller
if [ "${SALITRE_ARQUITECTURA:-}" = universal2 ]; then
    case "$($PY -c 'import sysconfig; print(sysconfig.get_platform())')" in
        *universal2) ;;
        *) echo "Este Python no es universal2: instale el de python.org o quite SALITRE_ARQUITECTURA" >&2
           exit 1 ;;
    esac
fi
# firma «ad hoc» (sin cuenta de Apple): obligatoria en Apple Silicon; si falla, se detiene aquí
PYINSTALLER_STRICT_BUNDLE_CODESIGN_ERROR=1 PYINSTALLER_VERIFY_BUNDLE_SIGNATURE=1 \
    $PY -m PyInstaller --noconfirm instalador/salitre.spec
codesign --verify --deep --strict --verbose=2 "$APP"

# ---- imagen de disco: la aplicación, un acceso a Aplicaciones y las instrucciones
VERSION=$($PY -c "import salitre; print(salitre.VERSION)")
DMG="dist/GuerraDelPacifico-$VERSION-macOS.dmg"
CARPETA=$(mktemp -d)
ditto "$APP" "$CARPETA/$NOMBRE.app"
ln -s /Applications "$CARPETA/Aplicaciones"
printf '\357\273\277' > "$CARPETA/LEAME.txt"    # marca UTF-8: TextEdit muestra bien los acentos
cat >> "$CARPETA/LEAME.txt" <<'FIN'
GUERRA DEL PACÍFICO: SALITRE Y PÓLVORA — versión para macOS

1. Arrastre «Guerra del Pacífico» sobre la carpeta Aplicaciones.

2. Ábrala desde Aplicaciones. La primera vez, macOS avisa que no pudo
   comprobar la aplicación (no está registrada ante Apple). Entonces:
   - macOS 15 o posterior: abra Ajustes del Sistema → Privacidad y seguridad,
     baje hasta «Seguridad» y pulse «Abrir igualmente» junto al nombre del
     juego; confirme con su contraseña y vuelva a pulsar «Abrir igualmente».
   - macOS 14 o anterior: clic derecho (o Control + clic) sobre la aplicación
     → Abrir → Abrir.
   Desde la Terminal se puede hacer lo mismo de una vez:
     xattr -dr com.apple.quarantine "/Applications/Guerra del Pacífico.app"

3. Si macOS pregunta si el juego puede buscar dispositivos en la red local,
   pulse «Permitir»: así encuentra las partidas de sus compañeros.

En Mac, ⌘ (Cmd) sirve igual que Ctrl: ⌘ + número forma un grupo y ⌘V pega.

El servidor dedicado viene dentro de la aplicación (se usa desde la Terminal):
  "/Applications/Guerra del Pacífico.app/Contents/MacOS/ServidorSalitre" --help
FIN
rm -f "$DMG"
intento=1
until hdiutil create -volname "$NOMBRE" -srcfolder "$CARPETA" -fs HFS+ -format UDZO \
        -imagekey zlib-level=9 -ov "$DMG"; do
    # en las máquinas de GitHub, hdiutil a veces responde «Resource busy»
    if [ "$intento" -ge 5 ]; then exit 1; fi
    intento=$((intento + 1))
    sleep 10
done
rm -rf "$CARPETA"
hdiutil verify "$DMG"

# ---- prueba de humo con la aplicación tal como queda en la imagen de disco
MONTAJE=$(mktemp -d)
hdiutil attach -nobrowse -readonly -noautoopen -mountpoint "$MONTAJE" "$DMG"
trap 'hdiutil detach -force "$MONTAJE" >/dev/null 2>&1 || true' EXIT
DENTRO="$MONTAJE/$NOMBRE.app/Contents/MacOS"
codesign --verify --deep --strict --verbose=2 "$MONTAJE/$NOMBRE.app"
humo() {
    SDL_VIDEODRIVER=dummy SDL_AUDIODRIVER=dummy SALITRE_DATOS_USUARIO="$(mktemp -d)" "$@" --prueba-humo
}
echo "Prueba de humo ($(uname -m))"
humo "$DENTRO/GuerraDelPacifico"
if [ "$(uname -m)" = arm64 ] && lipo "$DENTRO/GuerraDelPacifico" -verify_arch x86_64 2>/dev/null; then
    if arch -x86_64 /usr/bin/true 2>/dev/null; then
        echo "Prueba de humo de la parte para Intel (con Rosetta 2)"
        humo arch -x86_64 "$DENTRO/GuerraDelPacifico"
    else
        echo "Sin Rosetta 2 en este equipo: la parte para Intel no se probó aquí"
    fi
fi
"$DENTRO/ServidorSalitre" --help >/dev/null
hdiutil detach "$MONTAJE"
trap - EXIT
echo "Listo: $DMG"
