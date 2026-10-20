# Arquitectura

El juego sigue el modelo **cliente-servidor autoritativo**: el servidor es el
único que simula la partida y decide qué ocurre; los clientes solo envían
órdenes y dibujan lo que el servidor les cuenta. Todo está escrito en Python:
el servidor usa solo la biblioteca estándar y el cliente agrega `pygame-ce`.

```
┌──────────────── cliente (pygame) ────────────────┐          ┌──────────────── servidor (asyncio) ────────────────┐
│ escenas: portada, salón, sala, batalla, parte…    │  órdenes │ sesiones · cuentas · salas · chat                  │
│ EstadoJuego: espejo + interpolación + niebla      │ ───────► │ Partida: bucle de 16 ticks/s                        │
│ Vista: terreno, tropas, efectos (GPU)             │ ◄─────── │   Mundo (simulación determinista) + IA              │
│ HUD: minimapa, selección, tarjeta de órdenes      │  8 inst/s│   Emisor por jugador: niebla + diferencias          │
└───────────────────────────────────────────────────┘          │ SQLite: usuarios, partidas, ELO · repeticiones      │
                                                               └─────────────────────────────────────────────────────┘
```

En una escaramuza contra la IA el servidor corre en un hilo del propio juego y
escucha solo en `127.0.0.1`; con «Crear servidor en este equipo» escucha en la
red; el servidor dedicado es el mismo código sin la parte gráfica.

Hay un segundo cliente en construcción, el **cliente 3D en Godot 4**
(`rts/godot/`, sección [Cliente 3D](#cliente-3d-godot)): habla el mismo
protocolo con el mismo servidor y solo reemplaza el dibujo y los controles.

## Paquetes

| Paquete | Qué hace | Depende de |
|---------|----------|------------|
| `salitre.contenido` | Lee y valida `datos/*.json` y `mapas/*.json`; calcula la **huella** (hash) del contenido | — |
| `salitre.sim` | Simulación: mundo, entidades, órdenes, combate, caminos, visión, habilidades | contenido |
| `salitre.ia` | Adversario: juega enviando los mismos comandos que una persona | sim |
| `salitre.red` | Protocolo, conexión del cliente e instantáneas | sim |
| `salitre.servidor` | Sesiones, salas, partidas, base de datos, repeticiones, descubrimiento en red local | sim, ia, red |
| `salitre.cliente` | Ventana, escenas, interfaz, gráficos y sonido | red, contenido, pygame |

## Simulación determinista

- **Solo enteros.** Las posiciones se miden en subunidades (16 por píxel, 512 por
  casilla de 32 píxeles), el tiempo en ticks (16 por segundo), la energía en
  1/256 de punto y la vida fraccional en 1/64. Así el resultado es idéntico en
  cualquier computador, sin errores de redondeo de coma flotante.
- **Azar propio** (xorshift64\*), sembrado al inicio de cada partida: no depende de
  la versión de Python.
- **Orden de cada tick**: comandos → acciones programadas → caminos pendientes →
  edificios → unidades (órdenes, movimiento, combate, recolección; al final de
  cada una, su cobertura y su sed) → separación → proyectiles y minas → auras y
  abastecimiento de agua (cada 8 ticks), bajas, visión (cada 4), victoria (cada
  16) y cambio de viento (cada 45 s).
- **Repeticiones**: como todo es determinista, una repetición guarda solo el mapa,
  la semilla, los jugadores (con los veteranos que trae cada uno) y la lista de
  comandos con su tick (`.rep`, JSON comprimido con gzip). Al reproducirla se
  vuelve a simular la partida.

### Veteranía

`sim/veterania.py` lleva la experiencia de cada unidad en valor de combate (un
punto = 1 $ del costo de la unidad abatida, guardado en 1/16), los grados y los
ascensos. Los bonos de cada grado usan el mismo mecanismo de efectos que las
investigaciones: `Jugador.stats_de(tipo, grado)` calcula y guarda en caché las
estadísticas de cada combinación, y una unidad que asciende cambia de tabla (la
vida máxima sube y la vida actual con ella). La **hoja de servicio** de cada
soldado — `(experiencia, grado, nombre, ficha, batallas, bajas)` — viaja con él
cuando cae herido, en la camilla, en el hospital y en el carro de una ambulancia,
y vuelve a filas intacta. Al
terminar, `Mundo.veteranos_de(jugador)` y `Mundo.caidos_de(jugador)` dan las
fichas para el parte de guerra, la campaña y la serie; los veteranos de la
configuración de cada jugador bajan con el Cuartel General
(`Mundo._desplegar_cuartel`). Cuando un jugador pierde, `Mundo._retirada` retira
sus unidades del campo y guarda las fichas de sus veteranos.

### Sanidad: camilleros, ambulancia y hospital de sangre

Los camilleros (`comportamiento.camilleros`) no tienen límite de distancia: cada
4 ticks un equipo libre busca entre todos los heridos de su bando el que le
conviene (primero los que alcanza antes de `hasta`, después el más cercano) y
deja el herido al equipo libre que lo tenga más cerca entre los de su misma
región del mapa; el herido va al hospital más cercano (`hospital_cercano`). Un
herido nunca queda descartado: si el equipo no llega (un atasco, un paso cerrado
por obras) lo suelta y no vuelve a intentarlo con ese mismo herido durante 6 s
(`descarte`). Los equipos que esperan se asientan en su lugar frente a la puerta
(`puesto`) sin volver a pedir camino. Los pacientes de un hospital y los de una
ambulancia los atiende el mismo `Mundo.atender_pacientes`.

La ambulancia es una unidad con `"monta"` y el hospital de sangre un edificio con
`"desmonta_en"`: se monta con el mismo mecanismo de las obras (la orden
`construir`, solo para la unidad que lo monta) y, al terminar la obra,
`Mundo._montar` quita la unidad sin baja (evento `monta`), pasa su vida y sus
pacientes a las carpas y deja su población reservada en el edificio
(`pob_reservada`). La habilidad `desmontar` arma una cuenta regresiva
(`desmontando`, bandera `F_DESMONTA` y `dm` en la instantánea) y
`Mundo.desmontar` hace el camino inverso: crea la ambulancia en el lugar, con la
misma proporción de vida y los pacientes, sube a los camilleros (evento
`desmonta`) y libera el terreno. El cliente traspasa la selección y los grupos
del carro a las carpas y de vuelta con esos eventos.

### Agua y sed: `sim/logistica.py`

Las unidades con `tipo.sed` (infantería y caballería en tierra, salvo
trabajadores y camilleros) llevan `agua` (cantimplora, en 1/256 de punto:
`AFP`), `fatiga` (centésimas de tick al sol sin agua) y `calor_acum` (vida
fraccional del golpe de calor, en 1/64). El calor de cada casilla se calcula al
crear el mundo (`Mundo.calor`, un `bytes` con el % del consumo: pampa 100,
salar 150). `logistica.sed()` corre al final de la orden de cada unidad: gasta
agua si marcha o disparó hace menos de `combate` ticks; sin agua suma fatiga y,
pasado `golpe_calor`, quita vida (con un hospital en pie el soldado queda
herido, como una baja de fusil). Cada 8 ticks `logistica.abastecer()` hace beber
a la tropa junto a los edificios con `abastece` (molino, Cuartel General) y a la
guarnición de esos edificios, les llena la pipa a las carretas y después cada carreta (`estanque`) reparte su
pipa a la tropa de su radio, ordenada por `(agua, id)` para que el reparto sea
determinista. Sin agua, `comportamiento.velocidad` y
`combate.enfriamiento_unidad` aplican la penalización.

### Formaciones

`Unidad.formacion` (una `Formacion` del catálogo o `None`) la fija el comando
`formacion`, solo para los tipos con `forma_filas` (infantería de fusil). Sus
efectos entran donde ya se calculaban la cadencia, la velocidad y el daño:
`combate.enfriamiento_unidad` (cadencia), `comportamiento.velocidad`,
`combate.danio_pct_unidad` (daño propio), `combate.calcular_danio` (daño
recibido por tipo de ataque) y la carga de la caballería
(`comportamiento.atacar`, que no multiplica el golpe contra un cuadro). La
guarnición de un edificio no aplica su formación.

### Dispersión de la artillería: `sim/balistica.py`

Las armas con `cep` (cañones de montaña y de campaña) no apuntan al blanco: el
punto de impacto es el blanco más un desvío normal bidimensional (Box-Muller en
enteros: `log2` por cuadrados sucesivos, `math.isqrt` y una tabla de senos de
un cuarto de vuelta en 1/16384) más la deriva del viento. El radio vale
`cep · sqrt(−log2 U1)`, de modo que la mitad de los disparos cae dentro del
CEP, y el CEP efectivo es `cep × distancia/TILE × (1 + penalización por tirar
cuesta arriba)`, a la mitad con un observador (`observador` en las pasivas del
espía y el baqueano) cerca del blanco. El viento (`Mundo.viento`: rumbo de 0 a
15 y fuerza de 0 a 100) sale del azar de la partida al crear el mundo y cada
`viento_cambio` ticks. Todo el azar sale de `m.azar`, en el mismo orden en cada
equipo: la dispersión es determinista.

### Cobertura y sombra

`Mapa.calcular_cobertura` marca, al crear el mundo, las casillas vecinas de las
rocas, las ruinas y los tamarugos (`COB_REFUGIO`) y las de los tamarugos
(`COB_SOMBRA`) en `Mapa.cobertura`. La infantería detenida toma esos bits en
`Unidad.cobertura`; `calcular_danio` resta el 30 % a la fusilería y la metralla
que recibe a cubierto y `logistica.sed` reduce el calor a la sombra.

### Movimiento y caminos

- A\* en 8 direcciones con costo octil y **presupuesto de nodos** por búsqueda;
  antes se prueba la línea recta (en la pampa casi nunca hace falta A\*).
- Las **regiones conectadas** de cada capa (tierra y mar) se precalculan: una orden
  a una isla inalcanzable se resuelve sin buscar.
- Un grupo comparte el camino del primero y avanza en formación; cada unidad salta
  los puntos intermedios que ya ve, y si no progresa vuelve a calcular.
- **Caminos por tramos**: si la búsqueda agota su presupuesto, el camino llega
  hasta la casilla más cercana a la meta que alcanzó a ver; al terminarlo la
  unidad pide el tramo siguiente (`comportamiento._tramo_siguiente`) mientras la
  meta esté en su misma región. Si un tramo no la acercó al menos una casilla (un
  obstáculo cóncavo atrapó la búsqueda), el siguiente se busca una sola vez con un
  presupuesto amplio (`PRESUPUESTO_RODEO`); tras dos tramos más sin avance,
  desiste (la meta quedó encerrada por obras).
- Dos capas de movimiento: **tierra** y **agua**. En tierra solo se pasa entre
  casillas del mismo nivel o por una **rampa**.

### Combate

Daño = daño del arma × multiplicador (tipo de ataque contra clase de armadura) ×
(100 + bonificaciones %) / 100 × (formación y cobertura del blanco) − armadura,
con un mínimo de 1. Quien dispara desde abajo hacia una casilla más alta falla
un 30 % de las veces (las piezas con CEP, en cambio, dispersan más). Las
granadas, la dinamita y los cañones navales tienen daño en área; los
proyectiles lentos viajan y pueden errar si el blanco se mueve.

### Niebla de guerra

Cada observador marca un círculo de casillas visibles en una rejilla por nivel
de altura (desde abajo no se ve lo que está más arriba). Los círculos se marcan
por tramos de filas y las rejillas se combinan con operaciones de bits sobre
enteros grandes, lo que Python hace en C. Las unidades ocultas (espías,
montoneros quietos, minas) solo se ven con un **detector** cerca.

## Red

- **Transporte**: TCP. Cada mensaje es un objeto JSON con la clave `t` (tipo),
  enmarcado con 4 bytes de longitud y 1 byte de formato (JSON o JSON comprimido
  con zlib para los mensajes grandes). No se usa `pickle` ni nada que ejecute
  código. El servidor limita el tamaño de los mensajes y la frecuencia de los
  comandos y del chat.
- **Saludo**: el cliente envía su nombre, la clave opcional y la **huella** del
  contenido; si no coincide con la del servidor, se rechaza la conexión.
- **Instantáneas**: cada 2 ticks (8 por segundo) el servidor envía a cada jugador
  solo lo que su bando ve y solo lo que cambió (entidades nuevas o modificadas y
  bajas). Cada entidad viaja como `[id, tipo, dueño, x, y, vida, dirección,
  banderas, extra]`. Los espectadores y las repeticiones reciben todo. Los
  tipos negativos no son unidades del catálogo: −1 calichera, −2 pozo, −3 mina,
  −4 herido tendido (con su tipo de unidad en `extra`) y −5 el **convoy** (tren o
  carreta) que trae el Cuartel General al comenzar, con su recorrido en `extra`
  para dibujar la locomotora y los vagones sobre la vía. En `extra` también
  viajan las guarniciones (`g`: tipos de los soldados guarecidos; `gf`: los que
  acaban de disparar desde su puesto) y, para todos los bandos, los galones de
  los veteranos (`v`: grado, `vm`: vida máxima, `n`: semilla del nombre); solo
  el dueño recibe además el avance hacia el grado siguiente (`x`, en %), los
  camilleros y los pacientes de cada hospital (`cm`, `ce`, `pc`) y los
  convalecientes que viajan en el carro de una ambulancia (`pc`). La formación
  (`fo`: su código) la ven todos; el agua de la cantimplora (`ag`), la fatiga
  (`fa`, en % del umbral del golpe de calor) y la pipa de una carreta (`es`),
  de 5 en 5 %, solo el dueño. Las banderas `F_DESHIDRATADA`, `F_COBERTURA` y
  `F_SOMBRA` viajan a todos. El viento llega con el estado del jugador
  (`j.vi`) o, a los espectadores, en `vi`.
- **Cliente**: el socket es no bloqueante y la conexión inicial va en un hilo, así
  la pantalla nunca se congela; las posiciones se **interpolan** entre
  instantáneas para que el movimiento se vea suave a cualquier cantidad de cuadros
  por segundo. El cliente calcula su propia niebla con las mismas reglas que el
  servidor, para dibujarla suavizada.
- **Descubrimiento**: el cliente difunde `SALITRE?` por UDP al puerto 47801 y
  cada servidor de la red local responde con su nombre, puerto y versión.

### Mensajes principales

| Del cliente | Del servidor |
|-------------|--------------|
| `hola` (nombre, clave, registrar, huella) | `bienvenida` (mapas, dificultades, datos de la cuenta) |
| `salas`, `escalafon`, `historial` | `lobby` (salas, conectados, partidas en curso), `escalafon`, `historial` |
| `crear_sala`, `unirse`, `salir_sala`, `ajustar`, `listo`, `agregar_ia`, `quitar`, `mapa`, `serie` (batalla única o serie de 2 a 4), `iniciar` | `sala` (ranuras, anfitrión, modo, marcador de la serie y, solo para su dueño, el escalafón y el libro de los caídos), `expulsado` |
| `partida_rapida` (escaramuza o batalla de la campaña, con los veteranos propios y los de la IA) | `inicio` (mapa, semilla, jugadores) |
| `cmd` (orden de juego), `rendirse`, `abandonar`, `pausa` | `inst` (instantánea), `fin` (resultados con veteranos y caídos de cada jugador, ELO, repetición y, en una serie, su marcador), `pausa` |
| `chat` | `chat`, `aviso`, `error` |
| `observar`, `ver_repeticion`, `velocidad_rep`, `pedir_repeticion` | `repeticion` (copia de la repetición) |

## Servidor

- Una sola tarea `asyncio` atiende a todas las sesiones; cada partida corre su
  propio bucle de ticks en el mismo proceso. Cada sesión tiene una cola de envío:
  un cliente lento no frena a los demás (si no da abasto, se le desconecta).
- **Desconexiones**: a los 20 s la IA toma el mando del ejército; al reconectarse
  con el mismo nombre el jugador recupera su lugar. A los 3 minutos se le da por
  rendido; si no queda nadie, la partida se cierra al minuto.
- **Series de campaña** (`servidor/serie.py`): la sala guarda una `Serie` con el
  escalafón de cada ejército (por ranura). Al iniciar cada batalla los veteranos
  de cada uno van en su configuración; al terminar, `Servidor.serie_tras_batalla`
  aplica el parte de guerra (los vivos siguen, los caídos van al libro, los que
  no llegaron a desplegarse quedan de reserva), suma victorias y honores, guarda
  la serie en la base de datos y pasa la sala al mapa siguiente del itinerario.
  Durante la serie la nación y el equipo no cambian y no entran ejércitos nuevos;
  quien se va o pierde la conexión entre batallas queda *ausente* y recupera su
  lugar al volver (al ingresar con su nombre o al unirse a la sala), y el
  anfitrión puede entregar ese ejército a la IA.
- **Base de datos SQLite** (`servidor.db`, modo WAL):

| Tabla | Contenido |
|-------|-----------|
| `usuarios` | nombre, clave (PBKDF2-HMAC-SHA256 con sal), ELO, partidas, victorias, derrotas, abatidos, nación favorita |
| `partidas` | mapa, inicio, fin, ticks, semilla, versión, equipo ganador, si fue clasificatoria, repetición |
| `partida_jugadores` | por jugador: nación, equipo, resultado, estadísticas y ELO antes y después |
| `configuracion` | parámetros del servidor |
| `series` | serie de campaña: sala, batallas jugadas y totales, si terminó o se abandonó, equipo ganador y el estado completo (JSON) |
| `serie_jugadores` | por ranura: cuenta, nación, equipo, victorias, honores, veteranos, caídos y el escalafón (JSON) |

- **ELO** con K = 32 entre los equipos; solo cuentan las partidas con al menos dos
  bandos de jugadores registrados y un vencedor.

## Cliente

- **Lienzo**: todo se dibuja con `pygame._sdl2.video.Renderer`, es decir, con la
  tarjeta de video (Direct3D, OpenGL o Metal según el sistema; si no hay
  aceleración, SDL usa su dibujo por software con el mismo código). Cada cuadro
  se dibuja en una textura de 1280×720 lógicos que luego se escala a la ventana
  o a la pantalla completa, centrada y con franjas negras si la proporción no es
  16:9. No se usa el «tamaño lógico» de SDL: con él SDL convierte por su cuenta
  la posición del ratón y los recortes de la vista pierden el centrado, de modo
  que al agrandar la ventana los clics y el dibujo se desfasaban. La única
  conversión entre píxeles de la ventana y coordenadas lógicas está en
  `Lienzo.area_imagen()` y `Lienzo.logico_de()`.
- **Ratón en la batalla**: la cámara se mueve cuando el puntero está a 6 píxeles
  del borde de la imagen (o sobre las franjas negras), siempre que la ventana
  tenga el foco. Durante la batalla el puntero queda encerrado en la ventana
  (opción *Encerrar el ratón en la ventana*) y se suelta en el menú (F10) o al
  cambiar de programa con Alt + Tab.
- **Texturas en caché**: sprites, edificios, iconos y textos se generan una vez y
  quedan en la memoria de video.
- **Casas fuertes por capas**: las barracas y el cuartel tienen, además de su
  textura, una capa «frente» (parapeto almenado y fachada con los vanos de las
  ventanas recortados). La vista pinta la obra, después los tiradores en sus
  puestos (`edificios.geometria_fortaleza`) y encima el frente: así asoman tras
  las almenas y dentro de las ventanas sin recortes por soldado.
- **Terreno** por bloques de 16×16 casillas: colores fundidos con un escalado
  suave alineado entre bloques, grano, detalles por casilla, acantilados con
  sombra, caminos y vías férreas.
- **Sprites generados por código** a tres veces su tamaño y reducidos con
  suavizado, con el uniforme de cada nación (y los rasgos propios de cada arma:
  zapadores, dinamiteros, torpedistas, granaderos y cazadores) y el color del jugador; se pueden
  reemplazar por imágenes propias en `recursos/graficos/`.
- **Efectos**: humo de pólvora negra, fogonazos, explosiones, cráteres, polvo de
  obra y de marcha, curaciones, el $ dorado de la venta del salitre, sangre y
  cuerpos despedazados (con la opción «Sangre en las bajas»).
- **Sonido sintetizado** (fusilería, cañones, Gatling, explosiones, silbato del
  tren, toques de corneta) con volumen y paneo según la posición en el mapa; se
  puede reemplazar con archivos en `recursos/sonidos/`. El mezclador se abre a
  44,1 kHz antes de iniciar pygame (`Lienzo`) y los efectos, sintetizados a
  22 050 Hz, se remuestrean a esa frecuencia.
- **Música** (`recursos/sonidos/musica/*.ogg`, de `herramientas/generar_musica.py`)
  con `pygame.mixer.music`: cada escena declara su pista (`Escena.musica`), y al
  cambiar de escena la que suena se apaga con un fundido y entra la nueva.
- **Volúmenes**: general, música, efectos y voces (`Sonido.fijar_volumen`); el de
  cada sonido es el general por el de su clase. Los controla
  `ui/controles_sonido.py`, en las Opciones y en el menú de la batalla.
- **Voces de la tropa** (`recursos/sonidos/voces/<clave>_<n>.ogg`): sintetizadas
  sin conexión con Kokoro-82M por `herramientas/generar_voces.py` y cargadas la
  primera vez que se dicen. Suenan por un canal reservado y con prioridades
  (selección < orden < aviso < alarma): una más importante corta a la que suena y
  los avisos esperan su turno. Si faltan los archivos o están desactivadas,
  suenan los toques de corneta.
- **Escenas**: portada, campaña, escaramuza, multijugador (conexión, cuartel
  general, sala de espera), carga, batalla, parte de guerra, repeticiones,
  archivo histórico y opciones. Al cambiar de escena a mitad de un lote de
  mensajes, los que faltan se devuelven a la conexión (`Escena.devolver_red`)
  para que la escena siguiente los atienda.
- **Perfil local** (`perfil.db`, SQLite): servidores recientes, historial de
  escaramuzas y el estado de cada **campaña** contra la IA (escalafón, libro de
  los caídos, honores, veteranos de la IA); configuración en `config.json`.
- **Nombres del escalafón** (`contenido/nombres.py` y `datos/nombres.json`): el
  nombre y el cuerpo de cada veterano se derivan de su semilla, la nación, el
  tipo de unidad y el grado, igual en el servidor y en el cliente.

## Cliente 3D (Godot)

`rts/godot/` es un proyecto de Godot 4.7 escrito en GDScript que reemplaza solo
la parte gráfica: la simulación, el servidor, la IA y los datos siguen siendo
los de Python, y el cliente de pygame se mantiene hasta que el nuevo lo iguale.
El plan va por fases: 1) cabeza de puente (red, diorama, tropas, selección,
órdenes y escaramuza: hecha); 2) figuras animadas y agrupadas, guarnición a la
vista, efectos, niebla suave y minimapa (hecha); 3) toda la interfaz: menús,
campaña, multijugador, archivo, opciones y sonido (hecha); 4) ejecutables para
Windows, macOS y Linux con el servidor adentro.

```
godot/
├── project.godot          escena inicial, autocargas «Sonido» y «Juego», ventana, sombras
├── datos/catalogo.json    catálogo en el orden de la red (lo genera herramientas/exportar_godot.py)
├── codigo/
│   ├── juego.gd           autocarga: catálogo, carpetas, fuentes, tema, configuración, perfil, campañas,
│   │                      la red entre pantallas (salón, sala, conversación), la batalla en curso y avisos
│   ├── sonido.gd          autocarga: efectos sintetizados, voces de la tropa, música con fundidos, buses
│   ├── red/               protocolo.gd (largo + formato + JSON/zlib), conexion.gd (TCP sin bloquear),
│   │                      servidor_local.gd (el privado «--local» o el abierto «Crear servidor»),
│   │                      busqueda_lan.gd (UDP 47801, como servidor/descubrimiento.py)
│   ├── datos/             catalogo.gd, rutas.gd (carpetas del usuario), config.gd (config_3d.json),
│   │                      perfil.gd (perfil_3d.json), campanas.gd y nombres.gd (como contenido/*.py),
│   │                      repeticiones.gd (gzip + JSON), mapas.gd (del juego y del usuario, vistas previas)
│   ├── batalla/           estado.gd (espejo con interpolación y fantasmas), vision.gd (niebla, igual a
│   │                      sim/vision.py), batalla.gd (la escena: eventos, sonidos, órdenes, voces, fin)
│   ├── mundo/             terreno.gd, modelos.gd, tropas.gd, efectos.gd, camara_rts.gd, ambiente.gd
│   └── ui/                tema.gd (pergamino, madera, botones con relieve), hud.gd, tarjeta.gd, minimapa.gd,
│                          menu.gd (diorama de fondo y una pantalla a la vez), pantallas/ (portada,
│                          escaramuza, cargando, campana, repeticiones, archivo, opciones, parte, conectar,
│                          salon, sala), marco.gd, boton.gd, retrato.gd (vista 3D), banderas.gd,
│                          controles_sonido.gd, panel_chat.gd
├── escenas/               menu.tscn y batalla.tscn (un nodo con su guion)
├── sombreadores/          terreno, agua y modelos (colores en los vértices y niebla de guerra)
└── pruebas/               correr.gd (pruebas sin pantalla), recorrido.gd (recorridos del menú) y
                           vitrina.gd (capturas de los modelos)
```

- **Mismo catálogo, misma huella.** El servidor manda los tipos por su índice;
  `herramientas/exportar_godot.py` vuelca para Godot los tipos en ese orden
  (con armas, formas, uniformes, costos y requisitos), la huella, las banderas
  de la instantánea, los colores y los textos. `tests/test_godot.py` exige que
  `godot/datos/catalogo.json` esté al día.
- **Servidor privado.** `python -m salitre --servidor --local --puerto N
  --padre PID` escucha solo en `127.0.0.1`, guarda en `local.db` y todas las
  repeticiones, y vigila cada segundo que siga vivo el proceso del juego (en
  Windows, con `OpenProcess`/`WaitForSingleObject`): si el juego se cierra,
  aun de golpe, el servidor también. El cliente elige un puerto libre, lanza el
  servidor (el ejecutable empaquetado si existe, si no Python con
  `PYTHONPATH=rts/`) y reintenta la conexión mientras arranca.
- **El mundo en 3D.** Una casilla mide una unidad (x al este, z al sur); un
  píxel del juego es 1/32. Cada nivel de altura sube 0,8; las rampas se
  alisan con una relajación de Jacobi entre los niveles que unen; los
  roqueríos son lomas que suben con las casillas de roca vecinas; las
  quebradas se hunden y el mar queda bajo un plano de agua. Donde dos
  casillas no coinciden se levanta una pared, y el borde baja hasta la base
  del diorama, con su marco y la mesa de guerra. La malla va por trozos de
  32×32 casillas, con el color de cada esquina fundido entre vecinas y los
  pesos del salar y la pampa para que sus texturas (grietas de la costra,
  matas secas) no tengan bordes de casilla.
- **Figuras agrupadas y animadas.** Cada vértice de un modelo lleva en
  `CUSTOM0` la parte a la que pertenece (pierna, brazo con el arma, pata,
  rueda, caño, bandera, aspas, sable) y el pivote sobre el que gira. Las tropas
  se dibujan en `MultiMesh`, una llamada de dibujo por modelo (`Tropas.Grupo`,
  que se vuelve a llenar en cada cuadro con `MultiMesh.buffer`), y cada figura
  lleva en `INSTANCE_CUSTOM` la fase de la marcha (según el camino recorrido),
  el paso, la acción (fusil apuntado, tajo, retroceso de la pieza, faena del
  trabajador) y el resaltado bajo el ratón: el sombreador `modelo.gdshader`
  mueve las partes sin costo para el procesador. Las banderas y las aspas del
  molino se mueven con el tiempo, también en las obras. Con datos propios el
  `MultiMesh` lleva además el color de la instancia en blanco: sin él, el
  dibujo de compatibilidad (OpenGL) pisa el color de los vértices.
- **Guarnición, marcas y bajas.** Los soldados guarecidos se dibujan en los
  puestos de su obra (`Modelos.puestos_guarnicion`: las azoteas almenadas del
  cuartel general y las barracas, los sacos de la trinchera), mirando al
  enemigo más cercano y apuntando los que disparan. El anillo de selección
  dibuja la formación (barra la línea, cuadrado el cuadro, círculo cortado la
  guerrilla) y la infantería formada deja una marca en el suelo que ven los dos
  bandos; los veteranos llevan galones y la tropa sin agua, una gota. Las bajas
  caen de espaldas antes de quedar tendidas.
- **Modelos por código.** `modelos.gd` arma cada figura con piezas simples
  (cajas, cilindros, esferas bajas, techos) con caras planas y el color en los
  vértices, como soldaditos de plomo pintados, sobre una peana del color del
  jugador. Hay infantes (con los rasgos de cada arma), jinetes, piezas de
  artillería con su sirviente, carros, camilleros, buques, las dieciséis obras,
  el andamio de las obras, yacimientos, minas, heridos, el tren y la carreta.
  Se guardan en caché por forma, nación y color; todas usan un solo material.
  Se dibujan más grandes que el natural (×1,45 la tropa a pie), siempre dentro
  del radio que les da la simulación.
- **Niebla.** El cliente calcula la visibilidad con las mismas reglas que el
  servidor (incluido el redondeo de Python en los radios) y la sube a una
  textura de una casilla por píxel (visible, explorada, desconocida) que leen
  los sombreadores del terreno, del agua y de los modelos con un desenfoque de
  cinco muestras; la textura anterior se funde con la nueva en 0,2 s, y lo
  recordado bajo la niebla se ve en penumbra y en sepia. Una prueba compara
  casilla por casilla la niebla de Godot con la de `sim/vision.py`.
- **Minimapa** (`ui/minimapa.gd`): el terreno, la niebla, las obras y las
  tropas del color de cada ejército, lo que abarca la cámara (los rayos de las
  esquinas de la vista) y los avisos que parpadean; clic o arrastre llevan la
  cámara, clic derecho da la orden allí.
- **Selección y órdenes.** Un rayo desde la cámara recorre el relieve
  (`Terreno.interseccion`) para saber qué punto del suelo hay bajo el ratón;
  las tropas se eligen en la pantalla por su proyección, y los edificios y
  yacimientos por su planta. Las órdenes son los mismos comandos del cliente de
  Python (`inteligente`, `mover`, `atacar`, `construir`…), con las posiciones
  en píxeles del juego; el lugar de las obras se valida como en `_lugar_obra`.
- **La interfaz** (fase 3). `menu.tscn` deja el diorama de la pampa girando
  de fondo y muestra una pantalla a la vez, con las mismas coordenadas que las
  escenas del cliente de Python sobre un lienzo de 1280×720 centrado. El menú
  reparte los mensajes del servidor a la pantalla que los usa (salón, sala,
  parte de guerra) y, si una cambia a otra o a la batalla en medio de un lote,
  devuelve lo que falta a la conexión (`Conexion.pendientes`). La autocarga
  `Juego` guarda lo que pasa de una pantalla a otra: la bienvenida, el salón,
  la sala, la conversación, el origen de la batalla (escaramuza, campaña,
  repetición, multijugador) y su fin. Los paneles de pergamino y madera, los
  botones con relieve y las casillas se generan por código (`tema.gd`).
- **Campaña y perfil.** `campanas.gd` y `nombres.gd` son la misma lógica que
  `contenido/campanas.py` y `contenido/nombres.py`; dos pruebas mandan
  campañas enteras (también con fichas dañadas) y cientos de nombres a los dos
  lados y exigen el mismo resultado. El perfil (`perfil_3d.json`) guarda los
  servidores recientes, las escaramuzas y las campañas; JSON trae los números
  como decimales, y `Rutas.enteros` los vuelve enteros antes de guardar (una
  repetición recibida por la red se guarda así en gzip, y Python la lee igual).
- **Archivo histórico.** Las fichas usan las mismas funciones que el archivo
  del cliente de Python (`contenido/textos.py`: cifras, auras, habilidades y la
  cronología), volcadas en el catálogo; cada unidad y cada obra se ve en un
  retrato 3D que gira (`ui/retrato.gd`, una vista propia con luz de estudio) y
  cada nación hace desfilar a su tropa con sus uniformes.
- **Sonido.** `sonido.gd` sintetiza los mismos efectos que `cliente/sonido.py`
  la primera vez que suenan (fusil, cañón, explosión, ametralladora, sable,
  martillo, silbato, toques de corneta), toca las voces de
  `recursos/sonidos/voces/` de a una y con prioridades, y la música con
  fundidos; un bus de audio por volumen. Los efectos de la batalla suenan en
  su lugar del mapa: el volumen baja con la distancia al centro de la vista y
  el sonido sale del lado de la pantalla donde ocurre.
- **Efectos**: fogonazos y nubes de pólvora negra (nubes de bordes suaves que
  miran a la cámara), granadas en vuelo con su parábola, explosiones con
  cráter, piques en el agua, polvo, bajas, sangre, curaciones y letreros (el $
  de la venta, los ascensos). Cerca de lo que mira la cámara: humo de la
  chimenea de la maestranza y de las obras dañadas (con llamas bajo el 25 %),
  polvo de los jinetes y los carros, estela de los buques, vapor del tren y
  remolinos de polvo en la pampa, todo llevado por el viento de la partida.

## Rendimiento medido

- Simulación: batalla de 320 unidades, 3 ms por tick en promedio (el presupuesto
  es de 62 ms por tick).
- Cliente con dibujo por software (sin tarjeta de video): unos 57 cuadros por
  segundo en una partida en curso; con aceleración, el dibujo deja de ser el
  límite.

## Pruebas

`python -m pytest` desde `rts/` ejecuta, sin pantalla (controlador de video
ficticio de SDL):

- **contenido**: validación del catálogo y de los mapas;
- **simulación**: recolección de salitre y agua, obras y población, requisitos,
  combate, curación, auras, habilidades y minas, artillería emplazada, ventaja de
  la altura, transporte naval, trincheras, experiencia y grados, heridos que
  conservan el grado, camilleros que buscan en todo el campo, la ambulancia que
  monta y desmonta el hospital de sangre, instrucción y encuadramiento, veteranos
  que llegan con el cuartel, retirada del vencido, la sed en la pampa y el golpe
  de calor en el salar (y el alivio a la sombra), la carreta de agua que da de
  beber y llena su pipa en el molino, la guarnición que bebe en el cuartel, las formaciones (marcha, cadencia y daño
  recibido; el cuadro contra la carga), la dispersión de la artillería en
  enteros (CEP, observador, viento) y su determinismo, la cobertura contra la
  fusilería, determinismo y repeticiones;
- **contenido**: además, la campaña del Salitre y su escalafón;
- **red**: protocolo, huella, cuentas, partida de dos jugadores por TCP con ELO,
  escaramuza y reconexión, veteranos de la campaña y una **serie de campaña**
  completa con reconexión entre batallas;
- **cliente**: todas las pantallas, una escaramuza, la campaña y una partida
  multijugador completa en modo serie (salón, sala de espera con un segundo
  jugador, batalla, parte de guerra, regreso a la sala, salida y regreso a la
  serie desde el salón); el submenú de formaciones, la ficha de la tropa sin
  agua, la carreta de agua, los avisos de sed y de golpe de calor y el viento.

- **cliente 3D** (`tests/test_godot.py`): el catálogo de Godot al día y en el
  orden de la red, y el servidor privado que se cierra con el juego; con
  `SALITRE_GODOT`, además, las pruebas del propio cliente
  (`godot/pruebas/correr.gd`: protocolo y zlib de Python, lector por trozos,
  niebla, espejo, terreno, tarjeta, modelos, costos, partes animadas, grupos,
  puestos de la guarnición, minimapa, niebla fundida, configuración, perfil,
  repeticiones en gzip, mapas y vistas previas, banderas y campaña), la niebla,
  la **campaña** (sesenta batallas seguidas, con fichas dañadas) y los
  **nombres de los veteranos** comparados con los de Python, una **batalla IA
  contra IA** vista entera como espectador sin un error de guion, la **prueba
  de humo** de punta a punta (menú, servidor privado, partida rápida contra la
  IA, trabajadores que marchan, el minimapa que lleva la cámara, el cuartel que
  forma un trabajador y lo cancela, un depósito en obra, la conversación, el
  menú de la batalla con el volumen, la rendición, el parte de guerra y la
  escaramuza anotada en el perfil) y tres **recorridos de la interfaz**
  (`godot/pruebas/recorrido.gd`): todas las pantallas (cada mapa de la
  escaramuza y cada ficha del archivo), una batalla de la campaña que queda en
  el escalafón, y el multijugador contra un servidor dedicado (salón, sala con
  un rival de la IA, batalla, parte de guerra, vuelta a la sala y al salón).

La integración continua (`.github/workflows/rts.yml`) corre las pruebas en Linux,
Windows y macOS, prueba el cliente 3D con Godot 4.7.2 (y guarda capturas de
la batalla y de cada pantalla, dibujadas por software), construye el instalador de Windows con una prueba de humo del
ejecutable, la aplicación para macOS (universal: Intel y Apple Silicon, probada
desde el `.dmg` en ambas arquitecturas cuando el equipo tiene Rosetta 2), la
versión portátil para Linux y la imagen Docker del servidor.
