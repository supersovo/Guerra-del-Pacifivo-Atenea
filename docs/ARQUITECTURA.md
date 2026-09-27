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
  silba y estalla, con una zona segura alrededor del jugador.
- **Objetivos**: eliminar las unidades de una etiqueta (incluidas las oleadas
  pendientes) o llegar a una línea; pueden exigir orden (`after`). Se muestran como
  medallas en la barra de estado y en la carta.
- **Especiales nuevos**: `900` voladura (explosiones escalonadas), `911` izar la
  bandera (exige los objetivos y termina la misión), `950` mensaje histórico, `951`
  objetivo alcanzado, `952` disparar un evento. Minas (`MINA`) invisibles con
  aviso de "clic".

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
  San Francisco (con la terraza de Salvo) y el Morro (mesa con caras a pique y
  falda oriental suave).
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
  de mapa). Los sprites se rasterizan al doble de resolución, las texturas y
  flats se registran al doble (ampliación "bilineal nítida" con grano fino), y
  los cielos son panoramas de 2048×400.

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

### Contenido procedural

Nada viene de archivos externos: la paleta y el `COLORMAP`, las fuentes, las
texturas, los cielos, la interfaz, los sonidos y la música se generan al iniciar.
Los sprites salen de una **fundición**: cada personaje es un modelo de primitivas
(elipsoides, cajas, cilindros) con uniformes históricos, que se rasteriza con
z-buffer desde 8 ángulos (como los modelos de arcilla fotografiados de DOOM) y en
perspectiva para las armas en primera persona, se sombrea y se cuantiza a la
paleta. Unos 800 cuadros se generan en un segundo y medio, al doble de la
resolución de DOOM.

## Pruebas

Las pruebas de `tests/` corren el juego real en Chromium sin interfaz: arranque y
capturas, lógica completa de objetivos de los tres mapas (hasta izar la bandera y
llegar al intermedio), combate con entrada de teclado, puntería (mirada con el
ratón, tiro a la retícula, miras), interfaz, hojas de contacto de sprites y el
renderizador aislado.
