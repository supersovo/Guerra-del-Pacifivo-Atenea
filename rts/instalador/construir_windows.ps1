# Construye el juego y su instalador para Windows.
#
# Requisitos: Python 3.11 o más nuevo (python.org) e Inno Setup 6
# (https://jrsoftware.org/isinfo.php). Desde la carpeta rts:
#
#     powershell -ExecutionPolicy Bypass -File instalador\construir_windows.ps1
#
# Resultado: dist\GuerraDelPacifico\ (versión portátil) e
# instalador\Salida\GuerraDelPacifico-<versión>-Instalador.exe

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

python -m pip install --upgrade pip
python -m pip install -r requirements.txt pyinstaller
python -m PyInstaller --noconfirm instalador\salitre.spec

# prueba de humo del ejecutable: escaramuza contra la IA sin pantalla
$env:SDL_VIDEODRIVER = "dummy"
$env:SDL_AUDIODRIVER = "dummy"
$prueba = Start-Process -FilePath "dist\GuerraDelPacifico\GuerraDelPacifico.exe" -ArgumentList "--prueba-humo" -Wait -PassThru
Remove-Item Env:SDL_VIDEODRIVER, Env:SDL_AUDIODRIVER
if ($prueba.ExitCode -ne 0) { throw "La prueba de humo del ejecutable falló (vea %APPDATA%\GuerraDelPacifico\registros\cliente.log)" }

$version = (python -c "import salitre; print(salitre.VERSION)").Trim()
$iscc = Join-Path ${env:ProgramFiles(x86)} "Inno Setup 6\ISCC.exe"
if (-not (Test-Path $iscc)) { $iscc = "ISCC.exe" }
Push-Location instalador
& $iscc "/DVersion=$version" salitre.iss
Pop-Location
Write-Host "Listo: instalador\Salida\GuerraDelPacifico-$version-Instalador.exe"
