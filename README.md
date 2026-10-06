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
interiores. Tacna, Chorrillos y Miraflores son **batallas masivas**: cientos de
soldados de ambos bandos combaten a la vez, las columnas marchan en formación, las
posiciones se defienden y los vencidos se retiran; las explosiones **despedazan**
los cuerpos.

Sobre esa base, el motor agrega lo que se espera de un shooter actual:

- **alta resolución** automática, hasta cuatro veces la de DOOM (1280×800, o más
  ancha en pantallas panorámicas);
- **letras nítidas** rasterizadas a la resolución real;
- **puntería libre con el ratón**: se mira arriba y abajo, y la bala va a la
  retícula;
- **miras** con clic derecho, con un leve aumento propio de cada arma.

### Gráfica

- **Tropas al triple de la resolución de DOOM**, iluminadas con sol, cielo,
  rebote de la arena, contraluz, oclusión ambiental y brillo metálico, con
  tramado para matizar la paleta.
- Uniformes con más detalle: la levita chilena con sus faldones, el cubrenuca de
  brin que cae sobre la nuca, cuello, cartucheras y vaina de bayoneta.
- Las armas en primera persona se dibujan a 1280×800 y tienen más detalle:
  - madera de nogal con veta y acero pavonado;
  - martillo, palanca y portafusil en el Comblain;
  - tambor estriado en el revólver;
  - manos con dedos que envuelven la culata, el guardamano, la cacha o la
    manivela.
- **Bruma**: lo lejano se funde con el color del horizonte de cada mapa (polvo
  de la pampa, alba rosada en Arica, neblina de Lima) en vez de oscurecerse.
- **Humo de pólvora negra**: cada disparo deja una bocanada blanca y
  semitransparente que sube y deriva con el viento; los fuegos de fusilería
  cubren el campo.
- Barrancos con estratos, aleros y cárcavas, y taludes de arena con grano y
  guijarros.
- Los sprites se funden en segundo plano: el juego arranca en menos de dos
  segundos.

## Campaña

| # | Acción de armas | Fecha | Objetivos |
|---|-----------------|-------|-----------|
| I | **Desembarco de Pisagua** | 2 de noviembre de 1879 | Tomar las trincheras de la playa, silenciar el Fuerte Sur, subir por la gran duna o el zigzag del ferrocarril al Alto del Hospicio, desalojar la estación e izar la bandera (teniente Torreblanca). |
| II | **Batalla de Dolores (San Francisco)** | 19 de noviembre de 1879 | Defender la batería del mayor Salvo en el cerro San Francisco, rechazar a los Húsares de Junín y de Bolivia y capturar la artillería aliada en la pampa. |
| III | **Batalla de Tacna (Alto de la Alianza)** · masiva | 26 de mayo de 1880 | Con el Atacama en la reserva de Muñoz: contener el contraataque de los Colorados (con la carga de los Granaderos de Yávar), tomar las trincheras del centro aliado en la meseta del Intiorko, capturar la batería Krupp del ala derecha con la IV División y llegar al campamento del Alto. |
| IV | **Asalto y toma del Morro de Arica** | 7 de junio de 1880 | Tomar los fuertes del Este y Ciudadela (cuyo polvorín estalla), evitar los polvorazos de Elmore, asaltar el Morro Gordo, coronar la cumbre y vencer la última resistencia. A las 7:45, la bandera. |
| V | **Batalla de San Juan y Chorrillos** · masiva | 13 de enero de 1881 | Con la I División de Lynch: tomar el cerro Marcavilca, asaltar las baterías de Iglesias en el Morro Solar y limpiar el pueblo de Chorrillos, mientras Sotomayor y Lagos rompen la línea de San Juan y Santa Teresa. |
| VI | **Batalla de Miraflores** · masiva | 15 de enero de 1881 | Rota la tregua a las 14:30: resistir el contraataque de Cáceres, tomar los reductos 1, 2 y 3 (defendidos por la Reserva de Lima) con el apoyo de la escuadra y entrar en Miraflores. |

Antes de cada acción aparece el parte de operaciones sobre la carta del teatro de
operaciones (Tarapacá, Tacna y Arica, o la campaña de Lima); al terminarla, el
intermedio con bajas, pertrechos y tiempo. El menú **Historia** resume la
campaña, y [docs/HISTORIA.md](docs/HISTORIA.md) detalla los hechos y las fuentes
consultadas.

**Batallas masivas.** Arriba a la derecha se ven los efectivos en pie de cada
bando y, si el objetivo es quebrar una posición, cuántos defensores faltan
("Avance hacia…" indica que hay que llegar a ella: cada fase exige al jugador en
el lugar). Los cuadros informativos son pequeños y breves (2 a 4 segundos) y no
tapan la retícula.

### Armas del soldado chileno

1. **Corvo** — el cuchillo curvo de los mineros de Atacama.
2. **Revólver Lefaucheux** de 11 mm.
3. **Fusil Comblain II** — monotiro de bloque descendente, arma reglamentaria (con él se empieza).
4. **Ametralladora Gatling** — de manivela, como las dos del cerro San Francisco.
5. **Dinamita** — cartuchos que se encienden y lanzan.

### Tropas

Infantería de línea chilena (levita azul, pantalón rojo, kepí con cubrenuca),
Granaderos a caballo y baterías Krupp del lado del jugador; Guardia Nacional
peruana (dril blanco), infantería boliviana (bayeta gris con vivos verdes), los
**Colorados de Bolivia** (casaca roja, pantalón blanco, abarcas), la **Reserva de
Lima** (civiles de levita y sombrero), infantería de línea peruana a la bayoneta,
oficiales con revólver y sable, zapadores dinamiteros, húsares a caballo y piezas
de artillería con su dotación.

Quien muere por una explosión (granadas de artillería, dinamita, polvorazos,
voladuras) salta en pedazos según su uniforme: cabeza, brazos y piernas vuelan,
rebotan y quedan en el suelo junto al tronco; del jinete queda el caballo y del
artillero, la pieza. También los caídos cercanos al impacto se despedazan.

### Voces de los soldados

Los soldados gritan al cargar, al ser heridos y al caer, cada uno con el acento
de su país:

- **peruanos**: "¡Asu mare!", "¡A la chucha!", "¡Chucha madre!", "¡Ahí vienen los chilenos!";
- **bolivianos**: "¡Chuta, me han dado!", "¡Jilata, me han dado!", "¡Ay, Tata Dios!", "¡Jallalla, Bolivia!";
- **chilenos**: "¡A la chucha!", "¡Puchas!", "¡Por la cresta!", "¡Viva Chile!".

Oficiales, Colorados, Reserva de Lima, húsares y artilleros tienen frases
propias. Quien cae por el fuego del jugador grita siempre.

No hay narrador ni voz del navegador: **cada soldado grita su frase con su
propia garganta**, como un sonido más del combate. La frase sale de donde está
él, con volumen y estéreo según la distancia y el ángulo, y a lo lejos llega
opaca, sin agudos. Reemplaza su grito genérico. Cada soldado tiene siempre la
misma voz: una de tres gargantas (aguda, media y grave) con su tono propio.

Las frases no son grabaciones. Las genera un modelo de la voz humana (pulso
glotal, formantes del tracto vocal, ruido de las consonantes) a partir del texto
y con los rasgos de cada habla:

- la **s final aspirada** del chileno ("¡Puchah!") y su **j suave** ante e/i
  ("¡No me dejen!");
- la **rr asibilada**, la **ll lateral**, las eses firmes, las átonas breves, el
  habla más pausada y el **pico de tono tardío** del boliviano andino;
- la **-ado sin d** y la **d final perdida** del habla costeña ("ciudá").

Cada grito tiene su entonación: la **arenga** sostiene en alto la sílaba fuerte
final ("¡A la caaarga!"); la **herida** sube de golpe y cae; la **agonía** alarga
la última vocal, le quiebra la voz y termina en estertor y exhalación.

Bajo la retícula aparece el subtítulo de cada grito. Todo se ajusta en
**Opciones › Sonido, voces y marchas**, que incluye **Probar las voces**.

### Marchas militares

El juego trae marchas originales tocadas por una banda sintetizada (cornetas,
pífanos, bajos, caja y bombo). Las marchas históricas se cargan desde archivos
propios, en **Opciones › Sonido, voces y marchas › Marchas militares ›
Cargar**, o arrastrando los archivos a la ventana del juego:

- un **MIDI** (`.mid`) lo interpreta la banda del juego. Cada parte se asigna a
  cornetas, pífanos, clarinetes, bombardinos o tubas según su instrumento y
  registro, y la percusión a caja, bombo y platillos;
- un **audio** (`.mp3`, `.ogg`, `.wav`, `.m4a`) suena tal cual.

Cada marcha se asigna por su nombre:

| Archivo | Suena en |
|---------|----------|
| *Himno de Yungay* | portada y final de la campaña |
| *Adiós al Séptimo de Línea* | parte de operaciones |
| *Los Viejos Estandartes* | intermedio |
| cualquier otra | la primera batalla que aún tenga música del juego |

El menú permite cambiar la marcha de cada momento: portada, parte, intermedio,
cada una de las seis batallas y final. Al elegir una, suena para escucharla. Las
marchas quedan guardadas en el navegador.

Los derechos de las tres marchas son distintos:

- el **Himno de Yungay** (José Zapiola, 1839) es de dominio público;
- la melodía de **Adiós al Séptimo de Línea** es del siglo XIX, pero su letra y
  sus arreglos difundidos (José Goles) tienen derechos vigentes;
- **Los Viejos Estandartes** (1966) también tiene derechos vigentes.

Por eso no se incluyen en el juego (detalles en
[docs/HISTORIA.md](docs/HISTORIA.md#música-y-voces)).

### El rostro del soldado

El retrato de la barra de estado es un soldado del 1879 pintado en alta
resolución (cuatro veces la de DOOM): kepí rojo con franja azul y escarapela,
cubrenuca de lino, bigote y levita. Las heridas crecen con el daño:

1. hollín y un corte en la mejilla;
2. moretón y una brecha en la frente que sangra;
3. ojo en tinta, labio partido, venda empapada y kepí perforado;
4. sangre de la nariz y del oído y el cuello manchado.

Al caer queda pálido, con sangre en la boca.

## Cómo jugar

No requiere instalación ni servidor: abra `index.html` en un navegador moderno
(Chrome, Edge, Firefox o Safari). También puede servirse la carpeta con cualquier
servidor estático, por ejemplo `npx serve .`.

| Acción | Teclado y ratón | Móvil | Mando |
|--------|-----------------|-------|-------|
| Marchar / desplazarse | W A S D o flechas | palanca izquierda | stick izquierdo |
| Girar y apuntar | ratón (clic en la pantalla para capturarlo) | arrastrar a la derecha | stick derecho |
| Mirar arriba / abajo | ratón; RePág / AvPág; Fin centra | arrastrar a la derecha | stick derecho; clic del stick centra |
| Disparar | clic izquierdo, Ctrl o F | FUEGO | gatillo derecho |
| Apuntar por las miras (mantener) | clic derecho o Z | MIRA | gatillo izquierdo |
| Usar (izar la bandera) | E, Espacio o Enter | USAR | A |
| Armas | 1–5, Q o rueda | ARMA | LB / RB |
| Carta del terreno | Tab (+/− zoom, F seguir) | MAPA | — |
| Correr / caminar | Mayúsculas | — | clic del stick izquierdo |
| Pausa / menú | P / Esc | MENÚ | Start |

**Miras.** Con el Comblain la vista se acerca ×1,6, con la Gatling ×1,3 y con el
revólver ×1,25; encarado, el soldado avanza más despacio, el ratón gira más fino
y la dispersión del tiro es menor. Tras cada disparo el Comblain se baja para
recargar y vuelve a encararse si se mantiene el botón. El corvo y la dinamita no
tienen miras.

**Opciones de pantalla.** *Resolución* automática (según los píxeles reales de la
pantalla; baja sola si el equipo no sostiene unos 50 cuadros por segundo) o fija
en 320×200, 640×400, 960×600 o 1280×800. *Apuntar con el ratón* puede
desactivarse para volver al autoapuntado vertical de DOOM.

Grados de dificultad: *Recluta*, *Cívico movilizado*, *Soldado de línea*,
*Veterano de la campaña* y *¡Calacuerda!* (el toque de carga a la bayoneta).
El progreso se guarda en el navegador.

## Estructura

```
index.html            página del juego (canvas, consola de arranque, controles táctiles)
src/                  motor: un archivo por módulo de DOOM (d_main, g_game, p_*, r_*, ...);
                      r_smoke.js humo de pólvora, s_voice.js gritos, s_march.js marchas
content/              contenido generado por código al iniciar
  palette.js font.js  paleta de 256 colores + COLORMAP, fuentes con acentos
  textures.js sky.js  texturas, planos y cielos panorámicos de 360°
  foundry.js models.js sprites.js   modelos 3D de primitivas -> sprites de 8 rotaciones
  sounds.js music.js  efectos y música sintetizados
  voices.js           frases gritadas: del texto a la voz por formantes
  gfx.js face.js historia.js        interfaz, rostro del soldado, textos históricos
  maps/               terreno y los seis campos de batalla (e1m1 … e1m6)
tools/                compilador de mapas y constructor de nodos BSP
tests/                pruebas en Chromium sin interfaz (Playwright)
docs/                 historia y arquitectura
```

Todo el arte, el sonido y la música se generan por código: el juego no usa ningún
recurso de DOOM. Detalles del motor en [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md).

## Pruebas

Requieren Node.js y Playwright con Chromium:

```
node tests/logic_test.js 1,2,3,4,5,6  # cumple los objetivos de cada mapa, iza la bandera y llega al intermedio
node tests/combat_test.js <salida> 2  # combate con teclado real: cinco armas, avance, carta
node tests/aim_test.js <salida>       # mirada con el ratón, tiro a la retícula, miras y resolución
node tests/sound_test.js <salida>     # marchas (MIDI, audio, menú, guardado), gritos y rostro
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
