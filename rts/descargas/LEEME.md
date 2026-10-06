# Descargas

Aquí queda el instalador de Windows (`GuerraDelPacifico-<versión>-Instalador.exe`)
cuando se ejecuta el flujo «RTS Salitre y Pólvora» de GitHub Actions con la
opción **Guardar el instalador de Windows en rts/descargas/** (pestaña
*Actions* → *RTS Salitre y Pólvora* → *Run workflow*).

## Descargarlo sin que el navegador lo bloquee

Chrome y Edge desconfían de los programas nuevos sin firma digital. Para
evitarlo, descárguelo con PowerShell (tecla Windows → escriba *PowerShell* →
Intro) y pegue:

```powershell
curl.exe -L -o "$env:USERPROFILE\Downloads\GuerraDelPacifico-0.9.0-Instalador.exe" https://raw.githubusercontent.com/supersovo/Guerra-del-Pacifivo-Atenea/refs/heads/claude/friendly-keller-8ieqfo/rts/descargas/GuerraDelPacifico-0.9.0-Instalador.exe
```

El instalador queda en la carpeta *Descargas*. Si la rama ya se fusionó, cambie
`claude/friendly-keller-8ieqfo` por el nombre de la rama principal.

También se puede bajar desde la página del archivo en GitHub (botón *Download
raw file*), con GitHub Desktop o con `git clone`.

Si al abrirlo Windows muestra «Windows protegió su PC», pulse *Más información →
Ejecutar de todas formas*.
