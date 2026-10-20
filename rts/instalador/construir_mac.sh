#!/usr/bin/env sh
# Construye la aplicación para macOS («Guerra del Pacífico.app»), la prueba y la
# guarda en una imagen de disco .dmg para repartirla. Desde la carpeta rts, en un Mac:
#
#     SALITRE_GODOT="/Applications/Godot.app/Contents/MacOS/Godot" sh instalador/construir_mac.sh
#
# Una sola aplicación con todo: el cliente 3D (el juego principal, que abre el ícono), la
# versión clásica (pygame, a un botón de la portada del cliente 3D), el servidor dedicado y
# los datos que comparten. PyInstaller arma la aplicación con la versión clásica, el servidor
# y los datos; después se le pone adentro el cliente 3D exportado de Godot
# (Contents/MacOS/GuerraDelPacifico y Contents/Resources/GuerraDelPacifico.pck) como su
# ejecutable principal, y se firma de nuevo.
#
# Con SALITRE_GODOT el cliente 3D se exporta con ese editor de Godot 4.7.2 (sus plantillas
# se bajan solas); sin él, se usa el que ya esté en dist/cliente3d/macos/ (así lo deja la
# integración continua, que lo exporta en Linux).
#
# Con SALITRE_ARQUITECTURA=universal2 (así la arma la integración continua) la
# aplicación sirve para Mac con procesador Intel y con Apple Silicon; para eso el
# Python que construye debe ser el «universal2» de python.org. Sin la variable, la
# versión clásica sirve para el procesador del equipo que la construye (el cliente 3D
# de Godot es universal siempre).
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
if [ -n "${SALITRE_GODOT:-}" ]; then
    $PY herramientas/exportar_cliente3d.py --sistemas macos
elif [ ! -f dist/cliente3d/macos/GuerraDelPacifico.zip ]; then
    echo "Falta el cliente 3D: defina SALITRE_GODOT con el editor de Godot 4.7.2 para exportarlo" >&2
    exit 1
fi
# firma «ad hoc» (sin cuenta de Apple): obligatoria en Apple Silicon; si falla, se detiene aquí
PYINSTALLER_STRICT_BUNDLE_CODESIGN_ERROR=1 PYINSTALLER_VERIFY_BUNDLE_SIGNATURE=1 \
    $PY -m PyInstaller --noconfirm instalador/salitre.spec
codesign --verify --deep --strict --verbose=2 "$APP"

# ---- el cliente 3D, ejecutable principal de la aplicación
EXPORTADO=$(mktemp -d)
ditto -x -k dist/cliente3d/macos/GuerraDelPacifico.zip "$EXPORTADO"
APP3D=$(find "$EXPORTADO" -maxdepth 1 -name "*.app" | head -n 1)
BIN3D=$(find "$APP3D/Contents/MacOS" -type f | head -n 1)
PCK3D=$(find "$APP3D/Contents/Resources" -name "*.pck" | head -n 1)
cp "$BIN3D" "$APP/Contents/MacOS/GuerraDelPacifico"
cp "$PCK3D" "$APP/Contents/Resources/GuerraDelPacifico.pck"
PLIST="$APP/Contents/Info.plist"
plutil -replace CFBundleExecutable -string GuerraDelPacifico "$PLIST"
# lo que pide Godot (macOS 11 en Intel y 13 en Apple Silicon), como en la aplicación que exporta
plutil -replace LSMinimumSystemVersion -string 11.0 "$PLIST"
for clave in LSMinimumSystemVersionByArchitecture LSArchitecturePriority; do
    plutil -replace "$clave" -json "$(plutil -extract "$clave" json -o - "$APP3D/Contents/Info.plist")" "$PLIST"
done
rm -rf "$EXPORTADO"
# firma ad hoc otra vez: cada ejecutable por su cuenta y después la aplicación, que sella el
# Info.plist nuevo y el .pck
for exe in GuerraDelPacificoClasico ServidorSalitre GuerraDelPacifico; do
    codesign --force --sign - "$APP/Contents/MacOS/$exe"
done
codesign --force --sign - "$APP"
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

El juego abre en su cliente 3D, el campo de batalla como un diorama (pide
macOS 11 o posterior en un Mac con procesador Intel y macOS 13 o posterior
con Apple Silicon). El botón «Versión clásica (2D)» de la portada abre el
juego dibujado en dos dimensiones, más liviano: el mismo juego, con los
mismos servidores, repeticiones y mapas.

En Mac, ⌘ (Cmd) sirve igual que Ctrl: ⌘ + número forma un grupo y ⌘V pega.

El servidor dedicado viene dentro de la aplicación (se usa desde la Terminal):
  "/Applications/Guerra del Pacífico.app/Contents/MacOS/ServidorSalitre" --help
FIN
rm -f "$DMG"
intento=1
# ULMO (LZMA) comprime bastante más que UDZO: con el cliente 3D universal adentro la imagen
# queda bajo los 100 MB que acepta GitHub en rts/descargas (se abre desde macOS 10.15, y la
# aplicación pide 11)
until hdiutil create -volname "$NOMBRE" -srcfolder "$CARPETA" -fs HFS+ -format ULMO -ov "$DMG"; do
    # en las máquinas de GitHub, hdiutil a veces responde «Resource busy»
    if [ "$intento" -ge 5 ]; then exit 1; fi
    intento=$((intento + 1))
    sleep 10
done
rm -rf "$CARPETA"
hdiutil verify "$DMG"

# ---- pruebas de humo con la aplicación tal como queda en la imagen de disco
MONTAJE=$(mktemp -d)
hdiutil attach -nobrowse -readonly -noautoopen -mountpoint "$MONTAJE" "$DMG"
trap 'hdiutil detach -force "$MONTAJE" >/dev/null 2>&1 || true' EXIT
DENTRO="$MONTAJE/$NOMBRE.app/Contents/MacOS"
codesign --verify --deep --strict --verbose=2 "$MONTAJE/$NOMBRE.app"
humo() {
    SDL_VIDEODRIVER=dummy SDL_AUDIODRIVER=dummy SALITRE_DATOS_USUARIO="$(mktemp -d)" "$@" --prueba-humo
}
echo "Prueba de humo de la versión clásica ($(uname -m))"
humo "$DENTRO/GuerraDelPacificoClasico"
echo "Prueba de humo del cliente 3D ($(uname -m))"
$PY instalador/probar_cliente3d.py "$DENTRO/GuerraDelPacifico"
if [ "$(uname -m)" = arm64 ] && lipo "$DENTRO/GuerraDelPacificoClasico" -verify_arch x86_64 2>/dev/null; then
    if arch -x86_64 /usr/bin/true 2>/dev/null; then
        echo "Pruebas de humo de la parte para Intel (con Rosetta 2)"
        humo arch -x86_64 "$DENTRO/GuerraDelPacificoClasico"
        $PY instalador/probar_cliente3d.py --arch x86_64 "$DENTRO/GuerraDelPacifico"
    else
        echo "Sin Rosetta 2 en este equipo: la parte para Intel no se probó aquí"
    fi
fi
"$DENTRO/ServidorSalitre" --help >/dev/null
hdiutil detach "$MONTAJE"
trap - EXIT
echo "Listo: $DMG"
