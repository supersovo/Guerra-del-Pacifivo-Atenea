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
  edificios → unidades (órdenes, movimiento, combate, recolección) → separación →
  proyectiles y minas → auras (cada 8 ticks), bajas, visión (cada 4) y victoria
  (cada 16).
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
cuando cae herido, en la camilla y en el hospital, y vuelve a filas intacta. Al
terminar, `Mundo.veteranos_de(jugador)` y `Mundo.caidos_de(jugador)` dan las
fichas para el parte de guerra, la campaña y la serie; los veteranos de la
configuración de cada jugador bajan con el Cuartel General
(`Mundo._desplegar_cuartel`). Cuando un jugador pierde, `Mundo._retirada` retira
sus unidades del campo y guarda las fichas de sus veteranos.

### Movimiento y caminos

- A\* en 8 direcciones con costo octil y **presupuesto de nodos** por búsqueda;
  antes se prueba la línea recta (en la pampa casi nunca hace falta A\*).
- Las **regiones conectadas** de cada capa (tierra y mar) se precalculan: una orden
  a una isla inalcanzable se resuelve sin buscar.
- Un grupo comparte el camino del primero y avanza en formación; cada unidad salta
  los puntos intermedios que ya ve, y si no progresa vuelve a calcular.
- Dos capas de movimiento: **tierra** y **agua**. En tierra solo se pasa entre
  casillas del mismo nivel o por una **rampa**.

### Combate

Daño = daño del arma × multiplicador (tipo de ataque contra clase de armadura) ×
(100 + bonificaciones %) / 100 − armadura, con un mínimo de 1. Quien dispara
desde abajo hacia una casilla más alta falla un 30 % de las veces. Las granadas,
la dinamita y los cañones navales tienen daño en área; los proyectiles lentos
viajan y pueden errar si el blanco se mueve.

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
  el dueño recibe además el avance hacia el grado siguiente (`x`, en %).
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
  conservan el grado, instrucción y encuadramiento, veteranos que llegan con el
  cuartel, retirada del vencido, determinismo y repeticiones;
- **contenido**: además, la campaña del Salitre y su escalafón;
- **red**: protocolo, huella, cuentas, partida de dos jugadores por TCP con ELO,
  escaramuza y reconexión, veteranos de la campaña y una **serie de campaña**
  completa con reconexión entre batallas;
- **cliente**: todas las pantallas, una escaramuza, la campaña y una partida
  multijugador completa en modo serie (salón, sala de espera con un segundo
  jugador, batalla, parte de guerra, regreso a la sala, salida y regreso a la
  serie desde el salón).

La integración continua (`.github/workflows/rts.yml`) corre las pruebas en Linux,
Windows y macOS, construye el instalador de Windows con una prueba de humo del
ejecutable, la aplicación para macOS (universal: Intel y Apple Silicon, probada
desde el `.dmg` en ambas arquitecturas cuando el equipo tiene Rosetta 2), la
versión portátil para Linux y la imagen Docker del servidor.
