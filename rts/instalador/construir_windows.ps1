# Construye el juego y su instalador para Windows: el cliente 3D (el juego principal),
# la versión clásica (pygame), el servidor dedicado y los datos que comparten.
#
# Requisitos: Python 3.11 o más nuevo (python.org), Inno Setup 6.3 o más nuevo
# (https://jrsoftware.org/isinfo.php) y el editor de Godot 4.7.2 para exportar el cliente
# 3D (SALITRE_GODOT; sus plantillas de exportación se bajan solas). Sin SALITRE_GODOT se usa
# el cliente 3D que ya esté en dist\cliente3d\windows\ (así lo deja la integración continua).
# Desde la carpeta rts:
#
#     $env:SALITRE_GODOT = "C:\Godot\Godot_v4.7.2-stable_win64.exe"
#     powershell -ExecutionPolicy Bypass -File instalador\construir_windows.ps1
#
# Resultado: dist\GuerraDelPacifico\ (versión portátil) e
# instalador\Salida\GuerraDelPacifico-<versión>-Instalador.exe

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

python -m pip install --upgrade pip
python -m pip install -r requirements.txt pyinstaller
if ($LASTEXITCODE -ne 0) { throw "No se pudieron instalar las dependencias" }
python -m PyInstaller --noconfirm instalador\salitre.spec
if ($LASTEXITCODE -ne 0) { throw "PyInstaller falló" }
if ($env:SALITRE_GODOT) {
    python herramientas\exportar_cliente3d.py --sistemas windows
    if ($LASTEXITCODE -ne 0) { throw "No se pudo exportar el cliente 3D" }
} elseif (-not (Test-Path "dist\cliente3d\windows\GuerraDelPacifico.exe")) {
    throw "Falta el cliente 3D: defina SALITRE_GODOT con el editor de Godot 4.7.2 para exportarlo"
}
Copy-Item "dist\cliente3d\windows\GuerraDelPacifico.exe" "dist\GuerraDelPacifico\GuerraDelPacifico.exe"

# pruebas de humo: la versión clásica (escaramuza contra la IA sin pantalla) y el cliente 3D
# con el servidor empaquetado
$env:SDL_VIDEODRIVER = "dummy"
$env:SDL_AUDIODRIVER = "dummy"
$prueba = Start-Process -FilePath "dist\GuerraDelPacifico\GuerraDelPacificoClasico.exe" -ArgumentList "--prueba-humo" -Wait -PassThru
Remove-Item Env:SDL_VIDEODRIVER, Env:SDL_AUDIODRIVER
if ($prueba.ExitCode -ne 0) { throw "La prueba de humo de la versión clásica falló (vea %APPDATA%\GuerraDelPacifico\registros\cliente.log)" }
python instalador\probar_cliente3d.py dist\GuerraDelPacifico\GuerraDelPacifico.exe
if ($LASTEXITCODE -ne 0) { throw "La prueba de humo del cliente 3D falló" }

$version = (python -c "import salitre; print(salitre.VERSION)").Trim()
$iscc = Join-Path ${env:ProgramFiles(x86)} "Inno Setup 6\ISCC.exe"
if (-not (Test-Path $iscc)) { $iscc = "ISCC.exe" }
Push-Location instalador
& $iscc "/DVersion=$version" salitre.iss
if ($LASTEXITCODE -ne 0) { throw "Inno Setup falló" }
Pop-Location
Write-Host "Listo: instalador\Salida\GuerraDelPacifico-$version-Instalador.exe"
