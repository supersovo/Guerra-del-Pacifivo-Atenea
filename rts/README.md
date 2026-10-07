# Guerra del Pacífico: Salitre y Pólvora

Juego de **estrategia en tiempo real** al estilo de *StarCraft* y *WarCraft*,
ambientado en la Guerra del Pacífico (1879-1884). Chile, Perú, Bolivia y, como
escenario hipotético, la Argentina, se disputan el salitre del desierto con
ejércitos de la época: infantería de línea, cantineras, ingenieros dinamiteros,
caballería, artillería Krupp y ametralladoras Gatling, mandados por héroes
históricos como Baquedano, San Martín Penrose, Bolognesi, Grau, Abaroa o Roca.

Es un **programa de escritorio** (no una página web). Tiene dos partes:

- **El servidor** (*backend*) manda la partida: simula el combate, decide qué ve
  cada jugador, guarda las cuentas, el escalafón y las repeticiones en una base de
  datos SQLite. Puede correr dentro del mismo juego, en el computador de un
  compañero o en un servidor dedicado (incluso en Docker).
- **El cliente** (*frontend*) dibuja el campo de batalla con la tarjeta de video
  y envía las órdenes del jugador.

El juego en red con los compañeros es el centro del diseño: ver
[docs/MULTIJUGADOR.md](docs/MULTIJUGADOR.md).

![Ícono del juego](recursos/icono.png)

## Instalación

**Windows.** Ejecute `GuerraDelPacifico-<versión>-Instalador.exe`. El instalador
crea los accesos «Guerra del Pacífico» y «Servidor dedicado» en el menú de
inicio y, si se marca la opción, permite el juego en red en el cortafuegos de
Windows. También hay una versión portátil que se descomprime y se usa sin
instalar (`GuerraDelPacifico.exe` dentro de la carpeta). Ambas se generan en
GitHub Actions (pestaña *Actions* → flujo «RTS Salitre y Pólvora» → última
ejecución → artefactos `instalador-windows` y `portatil-windows`; hay que
iniciar sesión en GitHub para descargarlos) o en una versión publicada.

**macOS** (Mac con procesador Intel o Apple Silicon, macOS 10.13 o posterior).
Abra `GuerraDelPacifico-<versión>-macOS.dmg` y arrastre *Guerra del Pacífico*
sobre *Aplicaciones*. La aplicación no está registrada ante Apple, así que la
primera vez macOS no la deja abrir: en macOS 15 o posterior, después del primer
intento vaya a *Ajustes del Sistema → Privacidad y seguridad* y pulse *Abrir
igualmente*; en macOS 14 o anterior, clic derecho sobre la aplicación → *Abrir*.
Si pregunta por la red local, permítala: así encuentra las partidas de los
compañeros. Se genera en GitHub Actions (artefacto `aplicacion-macos`), donde se
prueba en el macOS más reciente, también la parte para Intel.

**Linux.** Descomprima `GuerraDelPacifico-<versión>-linux.tar.gz` y ejecute
`GuerraDelPacifico/GuerraDelPacifico`.

**Copia en el repositorio.** El instalador de Windows y la aplicación para macOS
también pueden guardarse en [`rts/descargas/`](descargas/LEEME.md), desde donde
se bajan con PowerShell o con la Terminal del Mac sin pasar por el navegador.

**Si el navegador o Windows bloquean la descarga.** El juego es nuevo y no
lleva firma digital, así que Chrome, Edge y Windows desconfían de él aunque no
tenga nada malicioso:

- *Chrome*: abra las descargas (`Ctrl + J`) y, en el archivo bloqueado, use el
  menú de tres puntos (⋮) → *Descargar archivo sospechoso* (o *peligroso*) →
  confirme. Si dice «bloqueado por tu organización», ese Chrome lo administra el
  colegio o la empresa y no se puede saltar: use otro equipo o navegador.
- *Edge*: en la descarga, «…» → *Conservar* → *Mostrar más* → *Conservar de todos
  modos*.
- *«Virus detectado»*: lo detuvo Windows Defender (los programas hechos con
  PyInstaller a veces dan falsos positivos). Abra *Seguridad de Windows →
  Protección antivirus y contra amenazas → Historial de protección*, elija el
  elemento y pulse *Acciones → Restaurar* o *Permitir en el dispositivo*.
- Al abrir el instalador, *Windows protegió su PC*: *Más información →
  Ejecutar de todas formas*.

**Desde el código fuente** (cualquier sistema con Python 3.11 o más nuevo):

```sh
cd rts
python -m pip install -r requirements.txt
python -m salitre                 # el juego
python -m salitre --servidor      # el servidor dedicado (no necesita pygame)
```

Los datos de cada jugador (configuración, perfil, repeticiones, capturas y
registros) se guardan en `%APPDATA%\GuerraDelPacifico` en Windows, en
`~/Library/Application Support/GuerraDelPacifico` en macOS y en
`~/.local/share/guerra-del-pacifico` en Linux; no se borran al desinstalar.

## Cómo se juega

### Economía

| Recurso | De dónde sale | Para qué |
|---------|---------------|----------|
| **Salitre** (mineral principal) | Calicheras: los trabajadores extraen 5 por viaje | Todo |
| **Agua** (como el gas de *StarCraft*) | Pozos: hay que levantar un **molino de agua** encima; 6 por viaje | Caballería, artillería, héroes, investigaciones |

- Los **trabajadores chinos** recolectan y construyen. Al empezar, los seis
  primeros salen solos a las calicheras más cercanas.
- La **población** limita el ejército: el Cuartel General y cada **Depósito de
  Intendencia** dan 10 (el Fortín argentino, 5), hasta un máximo de **200**.
- Costo en población: trabajador, infante y cantinera **1**; ingeniero **2**;
  caballería **5**; artillería y ametralladoras **10**; héroes 4.

### Árbol de edificios

```
Cuartel General ── Barracas ─┬─ Hospital de campaña (cantineras)
   │                         ├─ Trinchera
   │                         └─ Barracón de Instrucción ── Caballeriza ── Central de Telégrafos ─┬─ Estado Mayor (héroes, espías)
   │                                                                                            └─ Parque de Artillería*
   ├─ Depósito de Intendencia (+10 de población)
   ├─ Molino de agua (sobre un pozo)
   └─ Maestranza (mejoras de armas y equipo) ─┬─ Reducto
                                              ├─ Muelle (transportes, cañoneras, héroes navales)
                                              └─ Parque de Artillería* (requiere también la Central de Telégrafos)
```

Las cifras completas de cada unidad, edificio, investigación y héroe están en
[docs/TABLAS.md](docs/TABLAS.md), generadas desde los datos del juego.

### Ejército

- **Infante de línea** (barracas): la base del ejército.
- **Cantinera** o **rabona** (barracas, requiere hospital): cura a la tropa.
- **Ingeniero dinamitero** (barracas, requiere barracón): lanza dinamita contra
  tropas y fortificaciones.
- **Granadero** y **Cazador a caballo** (caballeriza): carga al sable y
  carabina; el nombre cambia según la nación (Húsar de Junín, Lancero de frontera…).
- **Cañón de montaña**, **cañón de campaña** y **ametralladora Gatling**
  (parque de artillería): las unidades más poderosas y caras. Las piezas se
  **emplazan** para disparar y se enganchan para marchar.
- **Espía** (Estado Mayor): invisible salvo ante detectores; sabotea edificios.
- **Transporte a vapor** y **cañonera** (muelle): para los mapas con islas.
- **Unidades propias** de cada nación: Zapador (Chile), Torpedista y Montonero
  (Perú), Colorados (Bolivia), Baqueano y Fortín (Argentina).
- **Héroes**: cada nación tiene de cuatro a cinco, todos personajes reales. Su
  **aura de mando** mejora el daño, la armadura, la velocidad o la curación de la
  tropa cercana, y cada uno tiene una habilidad (tecla **Q**).

### El terreno importa

- Hay tres **niveles de altura**. Desde abajo no se ve lo que hay arriba, y quien
  dispara cuesta arriba **falla un 30 %** de las veces: ocupar la meseta del
  Intiorko o el Morro de Arica da ventaja, como en la guerra.
- Las **rampas** son los únicos accesos entre niveles; las quebradas solo se
  cruzan por sus pasos.
- La **niebla de guerra** la calcula el servidor: nadie recibe la posición de lo
  que no ve, así que no se puede hacer trampa.

### Controles

| Acción | Cómo |
|--------|------|
| Seleccionar | Clic izquierdo; arrastrar para un recuadro; doble clic o Ctrl + clic: todas las del mismo tipo en pantalla; Mayúsculas + clic: agregar |
| Mover, atacar, recolectar, reparar | Clic derecho sobre el terreno, el enemigo, el recurso o el edificio |
| Órdenes de la tarjeta | Botones abajo a la derecha o su tecla (M mover, S detener, A atacar, H mantener posición, P patrullar, G recolectar, B construir, V construcción avanzada…) |
| Encolar órdenes | Mayúsculas + orden |
| Grupos | Ctrl + 1…9 forma; 1…9 selecciona; dos veces centra la cámara |
| Cámara | Flechas, borde de la pantalla, arrastrar con el botón central o clic en el minimapa; rueda para acercar. En ventana, el puntero queda encerrado durante la batalla para mover la cámara con el borde (se suelta con F10 o Alt + Tab; se desactiva en Opciones) |
| Trabajador ocioso / todo el ejército | F1 / F2 |
| Ir al último aviso | Espacio |
| Conversar / con el equipo | Intro / Mayúsculas + Intro |
| Señal en el mapa para los aliados | Alt + G |
| Barras de vida | Mantener Alt (o activarlas siempre en Opciones) |
| Menú (rendirse, pausa, abandonar) | F10 o Esc |
| Captura de pantalla / pantalla completa | F12 / Alt + Intro |

En Mac, ⌘ (Cmd) sirve igual que Ctrl (⌘ + clic, ⌘ + 1…9 y ⌘V para pegar una
dirección), Alt es la tecla Opción (⌥), el puntero se suelta con ⌘ + Tab y, en
los portátiles, F1, F2, F10 y F12 se pulsan junto con la tecla fn.

En las **repeticiones**, + y − cambian la velocidad y P pausa; en una
escaramuza contra la IA, F3 pausa.

## Multijugador

- **Misma red** (sala de clases, casa): uno elige *Multijugador → Crear servidor
  en este equipo*; los demás pulsan *Buscar en la red local* y entran.
- **Desde casas distintas**: con una red privada virtual gratuita (ZeroTier,
  Tailscale o Radmin VPN), abriendo el puerto **47800/TCP** en el router de quien
  hospeda, o con un servidor dedicado en la nube (hay imagen Docker).
- Con **nombre y clave** el servidor lleva el **escalafón ELO** y el historial;
  sin clave se entra como invitado.
- Si alguien pierde la conexión, a los 20 segundos la IA toma el mando de su
  ejército hasta que vuelva a conectarse con el mismo nombre.

La guía completa, con la solución de problemas, está en
[docs/MULTIJUGADOR.md](docs/MULTIJUGADOR.md).

## Carpetas

```
rts/
├── salitre/              el programa (Python)
│   ├── contenido/        catálogo: lee y valida datos/ y mapas/
│   ├── sim/              simulación determinista (la usa el servidor)
│   ├── ia/               adversario de la computadora
│   ├── red/              protocolo e instantáneas
│   ├── servidor/         backend: cuentas, salas, partidas, base de datos, repeticiones
│   └── cliente/          frontend: menús, salón, sala de espera y campo de batalla
├── datos/                unidades, edificios, mejoras, habilidades, naciones y tablas (JSON)
├── mapas/                los seis campos de batalla (JSON)
├── recursos/             tipografías e ícono (y aquí pueden ir gráficos o sonidos propios)
├── herramientas/         generadores de mapas, tablas e ícono
├── instalador/           PyInstaller, Inno Setup (Windows) e imagen de disco (macOS)
├── docker/               servidor dedicado en contenedor
├── descargas/            copias del instalador de Windows y del .dmg de macOS (se guardan a pedido desde GitHub Actions)
├── tests/                pruebas automáticas
└── docs/                 investigación, diseño, arquitectura, multijugador y recomendaciones
```

Los datos son **JSON en español** y se pueden modificar sin programar: los
números de cada unidad, los requisitos, las auras de los héroes, las naciones…
El servidor y los jugadores deben tener los mismos datos: el juego lo comprueba
al conectarse.

Para cambiar los gráficos o sonidos generados por código, basta con poner
archivos con el mismo nombre en `recursos/graficos/unidades/` (PNG),
`recursos/graficos/edificios/` (PNG) o `recursos/sonidos/` (WAV u OGG).

## Desarrollo

```sh
cd rts
python -m pip install -r requirements-dev.txt
python -m pytest                          # simulación, red, servidor y cliente (sin pantalla)
python -m pyflakes salitre herramientas instalador tests
python herramientas/generar_mapas.py      # vuelve a generar los mapas
python herramientas/generar_tablas.py     # actualiza docs/TABLAS.md
python herramientas/generar_icono.py      # vuelve a dibujar el ícono
pyinstaller --noconfirm instalador/salitre.spec   # ejecutables en dist/
```

En Windows, `instalador\construir_windows.ps1` construye los ejecutables, los
prueba y genera el instalador con Inno Setup. En un Mac, `sh
instalador/construir_mac.sh` arma *Guerra del Pacífico.app*, la prueba y la
guarda en un `.dmg` (con `SALITRE_ARQUITECTURA=universal2` y el Python de
python.org sirve para Intel y Apple Silicon).

## Documentación

- [Investigación histórica](docs/INVESTIGACION.md): economía del salitre,
  ejércitos, armas, héroes y las licencias que se toma el juego, con fuentes.
- [Diseño del juego](docs/DISENO.md): las decisiones y el equilibrio.
- [Tablas](docs/TABLAS.md): todas las cifras.
- [Arquitectura](docs/ARQUITECTURA.md): servidor autoritativo, simulación
  determinista, red y base de datos.
- [Multijugador](docs/MULTIJUGADOR.md): cómo jugar con los compañeros.
- [Recomendaciones](docs/RECOMENDACIONES.md): próximos pasos y uso como material
  de estudio de ciencias militares.

## Créditos

- Tipografías **IM Fell English SC** (Igino Marini) y **Alegreya Sans**
  (Huerta Tipográfica), con licencia SIL Open Font License (textos en
  `recursos/fuentes/`).
- Sprites, edificios, terreno, efectos, ícono y sonidos están generados por el
  propio programa.
- Homenaje a los combatientes de los cuatro países. El juego representa la
  guerra con respeto por todos los bandos y no toma partido.
