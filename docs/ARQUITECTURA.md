# Arquitectura del Motor Atenea

El Motor Atenea sigue la organización del código fuente de DOOM (id Software,
1993): cada archivo de `src/` corresponde a un módulo del original y conserva sus
nombres de funciones (`R_RenderPlayerView`, `P_TryMove`, `A_Chase`...), de modo
que quien conozca DOOM se orienta de inmediato. Los scripts son clásicos (sin
módulos ES) para que el juego funcione abriendo `index.html` desde el disco.

## Correspondencia de módulos

| Atenea | DOOM | Función |
|--------|------|---------|
| `d_main.js` | `d_main.c` | arranque (`D_DoomMain`), consola de carga, bucle principal |
| `g_game.js` | `g_game.c` | flujo del juego, ticcmd, carga de niveles, intermedio |
| `doomdef.js`, `tables.js` | `doomdef.h`, `tables.c` | constantes, ángulos BAM, tablas trigonométricas |
| `m_random.js`, `m_misc.js` | `m_random.c`, `m_misc.c` | tabla de azar de DOOM, configuración |
| `w_wad.js` | `w_wad.c` | directorio de lumps con marcadores `S_START`/`F_START`/`T_START` |
| `v_video.js`, `i_video.js` | `v_video.c`, `i_video.c` | framebuffer de 8 bits, patches, paleta, volcado al canvas |
| `i_input.js`, `i_sound.js` | `i_system.c`, `i_sound.c` | teclado, ratón, táctil, mando; Web Audio |
| `r_main.js`, `r_bsp.js`, `r_segs.js`, `r_plane.js`, `r_draw.js`, `r_things.js`, `r_sky.js`, `r_data.js` | `r_*.c` | renderizador BSP |
| `p_setup.js` | `p_setup.c` | carga de mapas, blockmap |
| `p_tick.js`, `p_mobj.js`, `info.js` | `p_tick.c`, `p_mobj.c`, `info.c` | thinkers, actores, tablas de estados y de objetos |
| `p_map.js`, `p_maputl.js`, `p_sight.js` | `p_map.c`, `p_maputl.c`, `p_sight.c` | colisión, deslizamiento, ataques instantáneos, línea de vista |
| `p_enemy.js`, `p_pspr.js`, `p_inter.js`, `p_user.js` | homónimos | IA, armas en primera persona, daño y recogidas, jugador |
| `p_spec.js`, `p_doors.js`, `p_floor.js`, `p_lights.js`, `p_switch.js` | homónimos | especiales de líneas y sectores |
| `st_stuff.js`, `hu_stuff.js`, `am_map.js`, `m_menu.js`, `wi_stuff.js`, `f_finale.js`, `f_wipe.js`, `s_sound.js` | homónimos | barra de estado, mensajes, automapa, menús, intermedio, final, transición, sonido |
| `p_battle.js` | — | **director de batalla** (extensión de Atenea) |
| `r_smoke.js` | — | humo de pólvora negra: partículas semitransparentes del renderizador |
| `s_voice.js` | — | voces de los soldados con el acento de su país (Web Speech API) |
| `s_march.js` | — | marchas del jugador: lector MIDI, banda sintetizada, audio, IndexedDB |
| `tools/mapcompile.js`, `tools/nodebuild.js` | editores y `doombsp` | compilador de mapas y constructor de nodos |

## Lo que se conserva de DOOM

- **Tics fijos de 35 Hz** y ticcmds; la simulación es determinista (tabla
  `P_Random` de DOOM).
- **WAD**: todos los recursos son lumps con nombre de hasta 8 caracteres; los
  sprites usan la nomenclatura `NNNNFR` (nombre, cuadro, rotación).
- **Renderizador**: recorrido del árbol BSP de adelante hacia atrás, `solidsegs`,
  muros por columnas con texturas altas/medias/bajas, visplanes para pisos y techos,
  *drawsegs* con siluetas para recortar sprites, texturas enmascaradas, armas en
  primera persona, `COLORMAP` de 34 niveles con atenuación por distancia y el
  "contraste falso" entre muros N-S y E-O.
- **Actores**: máquina de estados (sprite, cuadro, tics, acción, siguiente),
  `mobjinfo` con salud, velocidad, radio, sonidos y estados; `A_Look`, `A_Chase`,
  `P_NewChaseDir`, `P_CheckMissileRange`.
- **Física**: `P_TryMove`, `P_SlideMove`, escalones de 24 unidades, blockmap de
  128×128, `P_PathTraverse` para disparos instantáneos, daño radial.
- **Interfaz**: barra de estado con rostro, automapa, menús, intermedio con
  conteo, final con texto que aparece letra a letra y la transición "derretida".

## Extensiones de Atenea

### Batallas a campo abierto (`p_battle.js`)

- **Bandos**: cada tipo de actor tiene `faction` (1 = Chile, 2 = Alianza). La
  búsqueda de blancos (`P_LookForTargets`) revisa pocos candidatos por tic y los
  enemigos prefieren al jugador; disparos, proyectiles y explosiones no dañan al
  propio bando.
- **Tropas aliadas**: `A_AllyLook`/`A_AllyChase` siguen al jugador y combaten; las
  baterías Krupp son torretas (`MF_TURRET`, `A_TurretChase`).
- **Eventos**: oleadas o refuerzos que aparecen en puntos `PUNTO` por tiempo, al
  cruzar una línea o al cumplirse un objetivo. Si un objetivo espera refuerzos
  atados a una línea que el jugador no cruzó, llegan cuando caen los defensores
  (nunca queda bloqueado).
- **Bombardeos**: zonas batidas por la escuadra o la artillería; cada granada
  silba y estalla (`P_Detonate`: efecto, estruendo y daño en el mismo tic), con
  una zona segura alrededor del jugador; `side` indica el bando que dispara, cuyas
  tropas no sufren daño. Pueden empezar a una hora dada (`trigger.time`).
- **Objetivos**: eliminar las unidades de una etiqueta (incluidas las oleadas
  pendientes) o llegar a una línea; pueden exigir orden (`after`). Se muestran como
  medallas en la barra de estado y en la carta.
- **Especiales nuevos**: `900` voladura (explosiones escalonadas), `911` izar la
  bandera (exige los objetivos y termina la misión), `950` mensaje histórico, `951`
  objetivo alcanzado, `952` disparar un evento. Minas (`MINA`) invisibles con
  aviso de "clic".

### Batallas masivas (`massive: true`)

Tacna, Chorrillos y Miraflores reúnen de 250 a 350 soldados; la simulación cuesta
0,2 a 0,5 ms por tic y el cuadro, de 8 a 20 ms a 1496×800.

- **Columnas en marcha** (`goal`): una tropa con destino marcha hacia él
  (`B_March`, paso recto de 8 rumbos con `B_WalkToward` y la búsqueda de DOOM si
  el camino está tapado), mira adelante cada medio segundo y combate por el
  camino; mientras el enemigo está a más de 560 unidades sigue avanzando. Al
  llegar toma posición (`home`). Las oleadas llevan `goal` (la formación se
  traslada entera desde el centro de sus puntos de aparición) o `advance`; las
  cosas del mapa, `goal` (`TR_Rank`/`TR_Ranks` con `advance`).
- **Posiciones** (`hold`): quien defiende se aleja poco de su puesto para
  combatir (112 unidades la infantería, 320 la de arma blanca) y vuelve a él
  cuando no hay enemigos a la vista (`B_KeepFormation`).
- **Órdenes** (`orders` en los eventos): `{ tag, to | by, spread, flee }` pone en
  marcha a tropas ya desplegadas: lanzar la reserva, envolver un ala o, con
  `flee`, el desbande general.
- **Objetivos por quiebre**: `percent` da la posición por tomada con esa fracción
  de bajas; `rout` hace que los sobrevivientes se retiren hacia un punto y dejen
  el campo; `near: [x, y, r]` exige al jugador en la posición (el indicador dice
  "Avance hacia…"): la IA puede ganar terreno, pero cada fase se decide en el
  lugar.
- **Reparto del fuego**: los enemigos eligen al jugador mucho menos que en las
  acciones pequeñas; el fuego entre tropas de la IA hiere al 40 % y las piezas de
  artillería recargan de 8 a 18 s, de modo que la batalla dura y el tiro del
  jugador decide.
- **Indicador de fuerzas** arriba a la derecha (`HU_DrawForces`): efectivos en pie
  de cada bando y defensores que faltan por abatir.

### Desmembramiento (`p_mobj.js`, `p_map.js`, `models.js`)

`P_RadiusAttack` marca la explosión en curso (`P_blastSpot`); si alguien con
`info.gib` muere por ella, `P_KillMobj` llama a `P_Dismember` en vez de la
animación de caída: cabeza, brazos y piernas (sprites `GH`, `GB`, `GP` + el código
del uniforme, cuadros A-D en el aire y E en el suelo) salen despedidos desde el
punto del impacto con fuerza según la distancia, dan vueltas, gotean sangre
(`A_GibFly`), rebotan en el suelo y contra los muros (`MF_GIB`, que además
atraviesa a los vivos) y quedan tendidos; en el lugar queda el tronco (`GT`,
mismo mobj con `spriteOverride`). Del jinete queda el caballo muerto y del
artillero la pieza sola (`gibstate`). Los caídos cercanos al impacto también se
despedazan. Se conservan a lo sumo 256 restos (los más viejos desaparecen).

### Terreno sin interiores (`tools/mapcompile.js`, `content/maps/terrain.js`)

Los mapas se escriben como **polígonos anidados** (sectores o bloques macizos): el
compilador busca el polígono más interno a cada lado de cada arista, parte las
aristas en las uniones en T, rechaza cruces y genera `VERTEXES`, `LINEDEFS`,
`SIDEDEFS`, `SECTORS` y `THINGS`; luego `nodebuild.js` produce `SEGS`, `SSECTORS`
y `NODES` en el arranque. Sobre eso, `terrain.js` ofrece:

- **Bandas** de acantilado con bordes irregulares y tramos rectos donde se apoyan
  rampas (la gran duna, el zigzag).
- **Cerros radiales**: curvas de nivel con los mismos ángulos y radio
  estrictamente decreciente, de modo que nunca se cruzan; así se modelan el cerro
  San Francisco (con la terraza de Salvo), el Morro de Arica (mesa con caras a
  pique y falda oriental suave), el Morro Solar y el cerro Marcavilca.
- **Obras de campaña**: trincheras con parapeto (con `depth: 8` la tropa sale por
  encima para contraatacar) y reductos de tierra con la gola abierta
  (`TR_Redoubt`); tapias de adobe de las chacras de Lima.
- **Anillos de horizonte**: sectores de techo-cielo muy bajo en el borde del mapa;
  bloquean el paso sin muro visible y el panorama del cielo continúa el terreno.
- **Edificios como azoteas**: el piso del sector es el techo plano de la casa y sus
  caras inferiores son las fachadas (ventanas, puertas y letreros alineados a 64 y
  128 unidades). No hay interiores ni ascensores.
- **Buques** fondeados: casco, superestructura, chimenea con humo y palos.

### Renderizador

- **Cielo panorámico** de 1024 columnas (360°, con el Pacífico al oeste y los Andes
  al este) dibujado como fondo antes del mundo: los techos-cielo no recortan ni se
  marcan, lo que permite mar y horizonte con sectores de techo bajo.
- Casos propios del cielo: sin cara superior cuando el sector trasero queda bajo el
  piso del frontal (azoteas); líneas cerradas con cielo al frente que tapan por
  columnas la geometría techada que hay detrás.
- **Interpolación** entre tics de posiciones y sectores en movimiento, con el giro
  y la mirada del ratón aplicados de inmediato (menos latencia).
- **Pantalla panorámica** (Hor+) con píxeles 1:1,2 como DOOM. La interfaz se
  diseña en 320×200 lógicos multiplicados por `SCALE` (1 a 4): en modo automático
  `I_ComputeScreenSize` elige la escala según los píxeles reales de la pantalla
  (`devicePixelRatio`) dentro de un presupuesto de píxeles, y `D_AdaptResolution`
  la baja si el cuadro tarda más de 20 ms.
- **Mirada vertical** por *y-shearing*, como Heretic: el horizonte (`centery`) se
  desplaza `tan(pitch) · projection` y las pendientes de los planos (`yslope`) se
  recalculan con él. La pendiente de la mirada va en el ticcmd (`lookdelta`).
- **Aumento de las miras**: `R_SetProjection(zoom)` recalcula la proyección y las
  tablas que dependen del campo visual (ángulo por columna, en tiempo lineal;
  corrección de distancia de los planos; escala del cielo). La luz no cambia.
- **Densidad**: sprites, texturas y flats llevan `density` (texeles por unidad
  de mapa). Los sprites de figuras se rasterizan al triple de resolución y las
  armas en primera persona a 1280×800. Las texturas y flats se registran al
  doble, con ampliación "bilineal nítida" y grano fino. Los cielos son
  panoramas de 2048×400.
- **Mipmaps de sprites**: cada cuadro de figura lleva una versión a media
  resolución (`patch.mip`). `R_ProjectSprite` la usa cuando un texel ocupa menos
  de media columna de pantalla, y así las tropas lejanas no centellean.
- **Bruma** (perspectiva aérea): los índices de luz son cuatro veces más finos
  que en DOOM (`R_SCALEK`, `R_ZLIGHTDIV`) para distinguir lejanías de miles de
  unidades.
  - Al aire libre, la luz del sector ya no se apaga con la distancia como en los
    pasillos de DOOM: lo lejano se funde con el color del horizonte del cielo de
    cada mapa.
  - `PAL_BuildFogMaps` arma 16 bloques de 34 mapas de luz, cada uno mezclado con
    ese color, y `R_SetupHaze` los instala al cargar el mapa.
  - `levelinfo.haze`, `hazeStart`, `hazeDist` y `hazeMax` permiten ajustarla o
    quitarla.
- **Transparencia** como el TRANMAP de Boom: `PAL_TRAN` tiene tres tablas de
  65.536 entradas, (fuente, destino) → color con opacidad 0,22, 0,42 y 0,64. Los
  patches semitransparentes (`V_MakeAlphaPatch`) guardan por texel el nivel de
  opacidad, y `R_DrawColumnAlpha` los mezcla después de aplicar la luz y la
  bruma.

### Puntería moderna (`p_user.js`, `p_pspr.js`, `r_things.js`)

- **Apuntado libre**: con "apuntar con el ratón" los disparos salen desde los
  ojos (`P_ShootZ`) con la pendiente de la mirada, sin autoapuntado: la bala va
  exactamente a la retícula. Sin esa opción vuelve el autoapuntado de DOOM.
- **Miras** (`BT_AIM`): `player.ads` pasa de 0 a 1 en unos 140 ms si el arma
  tiene aumento (`weaponinfo.zoom`) y su cuadro actual lo permite
  (`aimframes`); al recargar el Comblain baja sola. Encarado se reduce la
  velocidad y la dispersión.
- **Sprites de mira**: para cada arma con miras hay cuadros propios (COMZ, REVZ,
  GATZ y sus fogonazos) modelados con alza y guion en la línea de mira; se anclan
  al centro de la vista en lugar del borde inferior. Durante el encare el arma
  baja y vuelve a subir en la nueva posición.

### Letras de alta resolución (`content/font.js`, `v_video.js`)

Desde 640×400 el texto no se amplía desde la fuente de mapa de bits: cada glifo
se rasteriza con una fuente del sistema a la resolución real, con degradado en la
rampa de lino (las traducciones de color siguen valiendo), antialias hacia un
contorno negro y sombra. Contornos y rellenos se dibujan en dos pasadas; las
métricas se ajustan a las de la fuente clásica para no alterar la diagramación.
Los rótulos que antes venían pintados en las imágenes (barra de estado, portada,
carta de campaña) se escriben al dibujar.

### Voces, marchas y retrato (`s_voice.js`, `s_march.js`, `sounds.js`, `face.js`)

**Gritos.** Los quejidos y estertores de `content/sounds.js` salen de un
sintetizador de formantes (`snd_scream`):

- un pulso glotal de Rosenberg con su derivada;
- *jitter* y *shimmer* (irregularidad de período y de amplitud);
- aspiración;
- cinco resonadores que siguen una trayectoria de vocales;
- aspereza subarmónica, un *fry* final y un ataque en "h" o "g".

Al final pasa por una saturación suave. Hay tres variantes de muerte por bando,
y la de cada caído se elige al azar.

**Frases.** `s_voice.js` agrega frases dichas con la síntesis de voz del
navegador. Para cada acento (`info.voice`: `pe`, `bo` o `cl`) elige la voz más
cercana: es-PE, es-BO o es-CL; si no hay, otra voz latinoamericana. Prefiere las
voces masculinas, y cada soldado recibe su propio tono y velocidad según su
número de serie. Las reglas del grito:

- alcance, pausa mínima y probabilidad distintos para avistar, ser herido y caer;
- una sola frase a la vez: la muerte de alguien cercano corta un grito de carga;
- quien cae por el fuego del jugador grita siempre, hasta 1,6 veces más lejos;
- el azar sale de `M_Random`, la tabla de la interfaz, así que las voces no
  alteran la simulación ni la reproducibilidad de `P_Random`;
- el subtítulo se dibuja en `hu_stuff.js`.

**Marchas.** `s_march.js` implementa un lector de MIDI estándar:

- acepta SMF 0, 1 y 2 y RIFF RMID, con estado continuo, mapa de tempos y
  división SMPTE;
- convierte las notas a segundos y les asigna instrumento de la banda según el
  programa General MIDI y el registro: corneta, pífano, clarinete, bombardino o
  tuba;
- manda el canal 10 a caja, bombo, platillos y timbales.

`MUS_Play` consulta primero la ranura del jugador (`MARCH_TryPlay`). Las
partituras se programan con 2 s de anticipación, pasan por un compresor y
vuelven a empezar tras un respiro. Si la pestaña estuvo dormida, saltan al punto
actual. Los audios se decodifican con `decodeAudioData` y se repiten con un
`AudioBufferSourceNode`. Los archivos se guardan en IndexedDB (base
`atenea1879`) y las asignaciones en `localStorage`. Se cargan desde el menú o
soltándolos sobre la ventana.

**Retrato.** `content/face.js` pinta el rostro por capas con supermuestreo 2×:

- levita, cubrenuca, cuello, orejas;
- cabeza iluminada con barba de días;
- ojos, cejas, bigote y boca según la expresión;
- heridas por nivel de dolor, venda y kepí.

El resultado es un patch de alta densidad de 128×120 texeles para el marco de
32×30 de la barra de estado, con tramado de Bayer hacia la paleta. Los 42
retratos se registran como **lumps diferidos** (`W_AddLazyLump`, que construye
el lump la primera vez que se consulta). `FACE_WarmStep` pinta uno por cuadro
fuera del combate, así que el arranque no paga el medio segundo que cuestan.

### Contenido procedural

Nada viene de archivos externos: la paleta y el `COLORMAP`, las fuentes, las
texturas, los cielos, la interfaz, los sonidos y la música se generan al iniciar
(las marchas que el jugador cargue son opcionales).
Los sprites salen de una **fundición**: cada personaje es un modelo de
primitivas con uniformes históricos. Las primitivas son elipsoides, cajas,
cilindros y telas: elipsoides huecos recortados, para el cubrenuca y los
faldones de la levita. El modelo se rasteriza desde 8 ángulos, como los modelos
de arcilla fotografiados de DOOM, o en perspectiva para las armas en primera
persona. Se hace en dos pasadas:

1. **Rasterizado**: un G-buffer guarda por texel la profundidad, la normal, el
   punto local y el material.
2. **Revelado** (`FND_Develop`): ilumina en espacio lineal y cuantiza a la
   paleta.
   - Luces: sol cálido con luz envolvente, cielo frío desde arriba, rebote de la
     arena desde abajo, contraluz y brillo especular en los metales (atenuado en
     las caras planas).
   - Oclusión ambiental medida en el buffer de profundidad.
   - Veta en las maderas, textura leve en las telas y contorno en la silueta.
   - Cuantización a la paleta con tramado de Bayer, más la versión mip de
     cada cuadro.

Los 1.213 cuadros, al triple de la resolución de DOOM, se registran como
**lumps diferidos** (`W_AddLazyLump`) y se funden en segundo plano mientras se
está en la portada, los menús o el parte (`W_WarmStep`); la portada muestra el
avance. Si se confirma el parte de operaciones antes de que termine, el parte
muestra «Preparando la batalla» con el porcentaje, dedica más tiempo por cuadro
a la fundición y entra al combate al terminar; `G_DoLoadLevel` completa lo que
falte cuando se carga un mapa por otra vía. Así el arranque bajó de 4,7 a 1,8 s.
En la ruta de los elipsoides, la mayoría de las primitivas, el rasterizado usa
límites exactos de la elipse proyectada y una intersección en línea.

El **humo de pólvora negra** (`r_smoke.js`) es un sistema de partículas del
renderizador, fuera de la simulación: no usa `P_Random` ni el blockmap.
- Cada disparo de fusil, revólver, Gatling o cañón deja una bocanada que sube,
  deriva con el viento (`levelinfo.wind`) y se disipa en seis cuadros.
- Hay a lo sumo 220 a la vez.
- Se proyectan como vissprites semitransparentes, de modo que el COLORMAP les
  aplica la luz y la bruma como a cualquier sprite.

## Pruebas

Las pruebas de `tests/` corren el juego real en Chromium sin interfaz: arranque y
capturas, lógica completa de objetivos de los seis mapas (hasta izar la bandera y
llegar al intermedio, llevando al jugador a cada posición de las batallas
masivas), combate con entrada de teclado, puntería (mirada con el ratón, tiro a la
retícula, miras), interfaz (con las dos cartas de campaña), hojas de contacto de
sprites (incluidos Colorados, Reserva, Granaderos y restos), el renderizador
aislado y el sonido. La prueba de sonido cubre las marchas en MIDI y en audio
cargadas con el selector de archivos real, el menú, el guardado en IndexedDB y
el render fuera de línea de la banda. También comprueba las voces, con una
síntesis de voz simulada porque Chromium sin interfaz no trae voces, y el
retrato diferido de la barra de estado.
