# Descargas

Aquí quedan el instalador de Windows (`GuerraDelPacifico-<versión>-Instalador.exe`)
y la aplicación para macOS (`GuerraDelPacifico-<versión>-macOS.dmg`) cuando se
ejecuta el flujo «RTS Salitre y Pólvora» de GitHub Actions con las opciones
**Guardar el instalador de Windows en rts/descargas/** o **Guardar la aplicación
para macOS (.dmg) en rts/descargas/** (pestaña *Actions* → *RTS Salitre y
Pólvora* → *Run workflow*).

## Windows: descargarlo sin que el navegador lo bloquee

Chrome y Edge desconfían de los programas nuevos sin firma digital. Para
evitarlo, descárguelo con PowerShell (tecla Windows → escriba *PowerShell* →
Intro) y pegue:

```powershell
curl.exe -L -o "$env:USERPROFILE\Downloads\GuerraDelPacifico-0.11.0-Instalador.exe" https://raw.githubusercontent.com/supersovo/Guerra-del-Pacifivo-Atenea/refs/heads/claude/friendly-keller-8ieqfo/rts/descargas/GuerraDelPacifico-0.11.0-Instalador.exe
```

El instalador queda en la carpeta *Descargas*. Si la rama ya se fusionó, cambie
`claude/friendly-keller-8ieqfo` por el nombre de la rama principal.

También se puede bajar desde la página del archivo en GitHub (botón *Download
raw file*), con GitHub Desktop o con `git clone`.

Si al abrirlo Windows muestra «Windows protegió su PC», pulse *Más información →
Ejecutar de todas formas*. Si ya tenía instalada una versión anterior, el
instalador la actualiza en el mismo lugar y conserva la configuración.

## macOS: descargarlo con la Terminal

Sirve para Mac con procesador Intel o Apple Silicon (M1 en adelante), con macOS
10.13 o posterior. Abra la Terminal (*Aplicaciones → Utilidades → Terminal*, o
⌘ + espacio y escriba *Terminal*) y pegue:

```sh
curl -L -o ~/Downloads/GuerraDelPacifico-0.11.0-macOS.dmg https://raw.githubusercontent.com/supersovo/Guerra-del-Pacifivo-Atenea/refs/heads/claude/friendly-keller-8ieqfo/rts/descargas/GuerraDelPacifico-0.11.0-macOS.dmg
open ~/Downloads/GuerraDelPacifico-0.11.0-macOS.dmg
```

Se abre la imagen de disco: arrastre *Guerra del Pacífico* sobre *Aplicaciones*
y abra el juego desde allí. Bajado con la Terminal, macOS no le pone la marca de
«descargado de Internet» y el juego abre sin advertencias. Para actualizarlo,
haga lo mismo y reemplace la versión anterior; la configuración se conserva.

**Si lo bajó con el navegador** (Safari, Chrome…), la primera vez macOS avisa
que no puede comprobar la aplicación, porque no está registrada ante Apple:

- macOS 15 o posterior: intente abrirlo una vez; luego vaya a *Ajustes del
  Sistema → Privacidad y seguridad*, baje hasta *Seguridad*, pulse *Abrir
  igualmente* junto al nombre del juego, escriba su contraseña y vuelva a pulsar
  *Abrir igualmente*.
- macOS 14 o anterior: clic derecho (o Control + clic) sobre la aplicación →
  *Abrir* → *Abrir*.
- En cualquier versión, desde la Terminal:
  `xattr -dr com.apple.quarantine "/Applications/Guerra del Pacífico.app"`

Si macOS pregunta si el juego puede buscar dispositivos en la red local, o si
acepta conexiones entrantes al crear un servidor, pulse *Permitir*: así
encuentra las partidas de los compañeros y ellos pueden entrar a la suya.

En Mac, ⌘ (Cmd) sirve igual que Ctrl. El servidor dedicado viene dentro de la
aplicación y se usa desde la Terminal:
`"/Applications/Guerra del Pacífico.app/Contents/MacOS/ServidorSalitre" --help`.

## Novedades de la 0.11.0

- **Veteranía**: la tropa gana experiencia combatiendo y asciende a
  **Fogueado**, **Veterano** y **Aguerrido**, con más vida, daño, cadencia,
  armadura, visión y alcance. Los galones se ven sobre cada unidad (los dos
  bandos los ven) y cada veterano recibe nombre y cuerpo, con su hoja de
  servicio en la tarjeta.
- **Sanidad que resguarda a los veteranos**: el herido conserva su grado si los
  camilleros lo llevan al hospital (recogen primero a los de más grado);
  *Replegar heridos* (J) los manda a curarse; nuevas investigaciones
  *Ambulancias* y *Convalecencia*; *Ejercicios de tiro* en el Barracón de
  Instrucción fogea a los reclutas.
- **Campaña del Salitre** contra la IA: Dolores, Tarapacá, Alto de la Alianza y
  el Morro de Arica. Los veteranos que sobreviven llegan con el Cuartel General a
  la batalla siguiente; escalafón, libro de los caídos, honores y medallas.
- **Serie de campaña en red**: 2 a 4 batallas seguidas en la misma sala; el
  servidor guarda el escalafón de cada ejército entre batallas y gana el equipo
  con más victorias (o, si empatan, con más honores). Quien pierde la conexión
  entre batallas conserva su lugar y sus veteranos.
- **El vencido se retira**: al perder, el ejército deja el campo y sus veteranos
  siguen en filas para la batalla siguiente.
- Nuevas voces: los ascensos, el veterano herido o caído y el repliegue de los
  heridos al hospital.
- La 0.11.0 no juega en red con la 0.10.0: todos deben actualizar.

## Novedades de la 0.10.0

- **Dinero**: el salitre se vende en el Cuartel General, 1 × 1, al entregarlo
  (sale un $ dorado sobre el techo); con el dinero se forman las tropas, se
  construye y se investiga.
- **El Cuartel General llega a la campaña** a los diez segundos: en tren por un
  ramal del ferrocarril (Pampa del Tamarugal, Alto de la Alianza, Cuatro
  Naciones) o en carreta en los mapas campales.
- **Guarniciones**: la trinchera muestra a sus soldados asomados; las barracas y
  el Cuartel General también se guarnecen y sus tiradores disparan desde el techo.
- **Heridos y camilleros**: el hospital de campaña manda camilleros a recoger a
  los heridos, que se curan y vuelven a filas.
- **Sangre** en las bajas y cuerpos despedazados por la artillería y los
  explosivos (se desactiva en *Opciones*).
- **Uniformes propios de cada arma**: infantes, zapadores, dinamiteros,
  torpedistas, granaderos y cazadores se distinguen de un vistazo.
- **Voces de la tropa**: las unidades hablan al formarse, al seleccionarlas y al
  recibir órdenes, y el ayudante da los avisos (se desactivan en *Opciones* y
  vuelven los toques de corneta).
- Cada pozo muestra el agua que le queda, y la cantinera ya no avanza sola contra
  el enemigo cuando se ordena atacar.

## Novedades de la 0.9.1

- Con la ventana agrandada o maximizada, los clics caen donde se ven los botones
  y las unidades (antes quedaban corridos y el juego no respondía).
- La imagen queda centrada en cualquier tamaño de ventana, con franjas negras si
  la proporción no es 16:9.
- La cámara se mueve al llevar el ratón al borde: durante la batalla el puntero
  queda encerrado en la ventana (se suelta con F10 o Alt + Tab; se puede
  desactivar en *Opciones → Encerrar el ratón en la ventana*).
- Versión para macOS (Intel y Apple Silicon) en un `.dmg`. Los jugadores de Mac
  juegan en red con los de Windows y Linux.
