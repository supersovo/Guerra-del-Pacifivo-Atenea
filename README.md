# 1879: Guerra del Pacífico — Motor Atenea

Shooter en primera persona sobre la campaña terrestre de la **Guerra del Pacífico**
(Chile contra la alianza de Perú y Bolivia), escrito desde cero en JavaScript con
un motor propio, el **Motor Atenea**, que reproduce la arquitectura del DOOM
original de id Software (1993): árbol BSP, sectores y visplanes, sprites de ocho
rotaciones, bucle de simulación a 35 Hz, máquina de estados de actores, blockmap,
ataques instantáneos y un WAD en memoria.

DOOM es el modelo del **motor**; el juego es otro: batallas a campo abierto sobre
la geografía real de cada acción de armas, con tropas propias y enemigas, oleadas,
bombardeos y objetivos por fases. No hay ascensores, llaves ni misiones en
interiores.

## Campaña

| # | Acción de armas | Fecha | Objetivos |
|---|-----------------|-------|-----------|
| I | **Desembarco de Pisagua** | 2 de noviembre de 1879 | Tomar las trincheras de la playa, silenciar el Fuerte Sur, subir por la gran duna o el zigzag del ferrocarril al Alto del Hospicio, desalojar la estación e izar la bandera (teniente Torreblanca). |
| II | **Batalla de Dolores (San Francisco)** | 19 de noviembre de 1879 | Defender la batería del mayor Salvo en el cerro San Francisco, rechazar a los Húsares de Junín y de Bolivia y capturar la artillería aliada en la pampa. |
| III | **Asalto y toma del Morro de Arica** | 7 de junio de 1880 | Tomar los fuertes del Este y Ciudadela (cuyo polvorín estalla), evitar los polvorazos de Elmore, asaltar el Morro Gordo, coronar la cumbre y vencer la última resistencia. A las 7:45, la bandera. |

Antes de cada acción aparece el parte de operaciones sobre la carta de Tarapacá y
Arica; al terminarla, el intermedio con bajas, pertrechos y tiempo. El menú
**Historia** resume la campaña, y [docs/HISTORIA.md](docs/HISTORIA.md) detalla los
hechos y las fuentes consultadas.

### Armas del soldado chileno

1. **Corvo** — el cuchillo curvo de los mineros de Atacama.
2. **Revólver Lefaucheux** de 11 mm.
3. **Fusil Comblain II** — monotiro de bloque descendente, arma reglamentaria (con él se empieza).
4. **Ametralladora Gatling** — de manivela, como las dos del cerro San Francisco.
5. **Dinamita** — cartuchos que se encienden y lanzan.

### Tropas

Infantería de línea chilena (levita azul, pantalón rojo, kepí con cubrenuca) y
baterías Krupp aliadas del jugador; Guardia Nacional peruana (dril blanco),
infantería boliviana (bayeta gris con vivos verdes), infantería de línea peruana a
la bayoneta, oficiales con revólver y sable, zapadores dinamiteros, húsares a
caballo y piezas de artillería con su dotación.

## Cómo jugar

No requiere instalación ni servidor: abra `index.html` en un navegador moderno
(Chrome, Edge, Firefox o Safari). También puede servirse la carpeta con cualquier
servidor estático, por ejemplo `npx serve .`.

| Acción | Teclado y ratón | Móvil | Mando |
|--------|-----------------|-------|-------|
| Marchar / desplazarse | W A S D o flechas | palanca izquierda | stick izquierdo |
| Girar | ratón (clic en la pantalla para capturarlo) | arrastrar a la derecha | stick derecho |
| Disparar | clic izquierdo, Ctrl o F | FUEGO | gatillo derecho |
| Usar (izar la bandera) | E, Espacio o Enter | USAR | A |
| Armas | 1–5, Q o rueda | ARMA | LB / RB |
| Carta del terreno | Tab (+/− zoom, F seguir) | MAPA | — |
| Correr / caminar | Mayúsculas | — | gatillo izquierdo |
| Pausa / menú | P / Esc | MENÚ | Start |

Grados de dificultad: *Recluta*, *Cívico movilizado*, *Soldado de línea*,
*Veterano de la campaña* y *¡Calacuerda!* (el toque de carga a la bayoneta).
El progreso se guarda en el navegador.

## Estructura

```
index.html            página del juego (canvas, consola de arranque, controles táctiles)
src/                  motor: un archivo por módulo de DOOM (d_main, g_game, p_*, r_*, ...)
content/              contenido generado por código al iniciar
  palette.js font.js  paleta de 256 colores + COLORMAP, fuentes con acentos
  textures.js sky.js  texturas, planos y cielos panorámicos de 360°
  foundry.js models.js sprites.js   modelos 3D de primitivas -> sprites de 8 rotaciones
  sounds.js music.js  efectos y música sintetizados
  gfx.js face.js historia.js        interfaz, rostro del soldado, textos históricos
  maps/               terreno y los tres campos de batalla
tools/                compilador de mapas y constructor de nodos BSP
tests/                pruebas en Chromium sin interfaz (Playwright)
docs/                 historia y arquitectura
```

Todo el arte, el sonido y la música se generan por código: el juego no usa ningún
recurso de DOOM. Detalles del motor en [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md).

## Pruebas

Requieren Node.js y Playwright con Chromium:

```
node tests/logic_test.js 1,2,3        # cumple los objetivos de cada mapa, iza la bandera y llega al intermedio
node tests/combat_test.js <salida> 2  # combate con teclado real: cinco armas, avance, carta
node tests/game_shots.js <salida> 1 vistas.json   # capturas desde puntos de vista
node tests/ui_shots.js <salida>       # portada, menús, parte, carta, intermedio y final
node tests/sprite_shots.js <salida>   # hojas de contacto de los sprites
node tests/render_shots.js <salida>   # prueba aislada del renderizador
```

## Homenaje

La Guerra del Pacífico costó miles de vidas chilenas, peruanas y bolivianas. Este
juego recrea sus acciones de armas con respeto por los combatientes de los tres
países. La "chupilca del diablo" que aparece como objeto es una leyenda popular
del siglo XX, no un hecho documentado.
