# GEMINI.md — Guía del código de «Guerra del Pacífico: Salitre y Pólvora»

> **Para qué sirve este archivo.** Es el contexto que necesita un asistente de
> programación (Gemini u otro) para entender y mejorar el juego sin romperlo.
> Gemini CLI lo carga solo cuando trabaja en este repositorio; también se puede
> adjuntar o pegar en una conversación.
>
> Describe el código de la versión **0.12.1** (`salitre/__init__.py`:
> `VERSION = "0.12.1"`, `PROTOCOLO = 2`). Si el código y esta guía discrepan,
> manda el código: verifique antes de afirmar.

Todas las rutas son relativas a `rts/`, salvo que se indique otra cosa.

---

## 0. Ficha técnica

| | |
|---|---|
| **Qué es** | Juego de estrategia en tiempo real al estilo de *StarCraft* y *WarCraft*, ambientado en la Guerra del Pacífico (1879-1884). Bandos: Chile, Perú, Bolivia y la Argentina (esta última como escenario hipotético). Es un programa de escritorio, no una página web. |
| **Lenguaje** | Python 3.11 o más nuevo; la integración continua usa 3.12. |
| **Dependencias** | El cliente usa `pygame-ce` 2.x y dibuja con la GPU (`pygame._sdl2.video.Renderer`). La simulación, el servidor y la IA usan **solo la biblioteca estándar**. |
| **Dónde está** | Todo el juego vive en `rts/`. La raíz del repositorio guarda además **otro proyecto sin relación**: un *shooter* en JavaScript, el «Motor Atenea» (`index.html`, `src/`, `content/`, `tools/`, y los `tests/` y `docs/` de la raíz). Esta guía no lo cubre. |
| **Tamaño** | Unas 20 300 líneas en `salitre/`: cliente 10 500, simulación 5 200, servidor 1 900, contenido 1 000, IA 900, red 560. Además, 2 100 líneas de pruebas y 1 900 de herramientas. |
| **Cómo se arranca** | `python -m salitre` abre el juego (opciones: `--conectar HOST[:PUERTO]`, `--nombre`, `--version`). `python -m salitre --servidor` arranca el servidor dedicado, con las opciones `--host 0.0.0.0 --puerto 47800 --nombre … --sin-invitados --sin-lan --bd ruta --detallado`. |
| **Pruebas** | `SDL_VIDEODRIVER=dummy SDL_AUDIODRIVER=dummy python -m pytest -q` corre 66 pruebas en unos 2,5 minutos. La revisión estática es `python -m pyflakes salitre herramientas instalador docker tests`. |
| **Integración continua** | `.github/workflows/rts.yml`, en la raíz del repositorio: pruebas en Linux, Windows y macOS; instalador de Windows (PyInstaller + Inno Setup); `.app` y `.dmg` universal2; versión portátil para Linux; imagen Docker del servidor. |
| **Idioma** | Todo en **español**: identificadores, datos, textos, comentarios, documentación y mensajes de commit. Los identificadores van sin tildes ni eñe: `dueno`, `danio`, `tamano`, `campana` (= campaña). |

---

## 1. Situación: el juego en pocas líneas

**Economía**
- Los trabajadores extraen **salitre** de las calicheras (5 por viaje) y lo **venden en el Cuartel General**: 1 de salitre = $ 1, y sobre el techo sale un $ dorado.
- Todo se paga en **dinero**, y algunas cosas también en **agua**. El agua se saca de un **molino** levantado sobre un **pozo**; cumple el papel del gas de StarCraft.
- **Población:** el Cuartel General y cada depósito dan 10, hasta un máximo de 200.

**Inicio de la partida**
- El campo empieza vacío. A los 10 s llega el Cuartel General **en tren** (en los mapas con vía férrea) o **en carreta**, con 6 trabajadores y $ 100.

**Tecnología y ejército**
- Árbol de edificios: barracas → hospital, trinchera, barracón → caballeriza → telégrafos → estado mayor / parque de artillería; además maestranza → muelle.
- Armas: infantería, cantineras (curan), ingenieros dinamiteros, caballería, cañones que se **emplazan**, ametralladoras Gatling, espías, buques, unidades propias de cada nación y **héroes** históricos. Cada héroe tiene un aura de mando y una habilidad (tecla Q).

**Terreno, combate y niebla**
- Hay **tres niveles de altura**. Desde abajo no se ve lo de arriba, y quien dispara cuesta arriba falla el 30 % de los tiros. Las **rampas** son los únicos accesos entre niveles.
- La **niebla de guerra** la calcula el servidor.
- **Guarniciones:** la infantería se guarece en trincheras, barracas y Cuartel General.

**Sanidad**
- Con un hospital en pie, el infante o el jinete que cae por fusil, metralla o sable queda **herido** 40 s en el suelo.
- Equipos de **camilleros** (unidades autónomas) lo llevan al hospital más cercano, donde se cura y vuelve a filas.
- La **ambulancia** es una unidad que **monta un hospital de sangre** junto al frente y lo vuelve a desmontar.

**Veteranía**
- Hay cuatro grados: Recluta, Fogueado, Veterano y Aguerrido.
- Cada soldado tiene una **hoja de servicio** que conserva al caer herido.
- En la **Campaña del Salitre** (contra la IA) y en las **series en red**, los veteranos pasan de una batalla a la siguiente.

**Modo en línea**
- Cuentas con clave, escalafón ELO, salas, chat, reconexión (a los 20 s la IA toma el mando), repeticiones y descubrimiento en la red local.

**IA**
- Tres niveles. Juega con las mismas órdenes que una persona.

Diseño completo en `docs/DISENO.md`. Cifras de unidades, edificios y mejoras en `docs/TABLAS.md` (archivo generado). Arquitectura en `docs/ARQUITECTURA.md`. Investigación histórica en `docs/INVESTIGACION.md`.

---

## 2. Reglas de enfrentamiento: lo que **no** se debe romper

1. **El servidor es autoritativo.**
   - Solo el servidor simula (`salitre/sim`). El cliente envía *comandos* y dibuja lo que recibe en las *instantáneas*.
   - Todo cambio de estado del juego entra como comando por `Mundo.comando(p, cmd)`. Esto vale también para la IA (`IA.cmd(...)`).
   - Nunca se modifica el mundo desde el cliente ni desde la IA.

2. **Determinismo absoluto.** La misma semilla con los mismos comandos debe dar la misma partida en cualquier equipo. De eso dependen las repeticiones y las pruebas `test_determinismo` y `test_repeticion_reproduce_partida`.
   - **El estado de la simulación es entero.** Algunos parámetros del catálogo son `float` (radio de visión, ritmo de regeneración); se convierten a enteros con `int(...)` al usarse. No acumule `float` en el estado.
   - **Azar:** solo con `self.azar` (`sim/azar.py`, xorshift64\*, sembrado con la semilla de la partida). La IA tiene su propio `Azar`. Prohibido usar `random`, `time` o `hash()` de cadenas dentro de `sim/` e `ia/`. El cliente sí usa `random`, pero solo para efectos visuales.
   - **Orden de iteración:** los `dict` se recorren en orden de inserción, y las entidades se crean con ids crecientes. Las búsquedas espaciales (`espacial.py`) recorren en un orden fijo: `Rejilla.cerca` va celda por celda y, dentro de cada celda, en el orden de `Mundo.unidades`; `RejillaEdificios.cerca` ordena por id. Use `set` solo para preguntar pertenencia, nunca para iterar algo que afecte el resultado.
   - Ojo: `test_determinismo` corre dos partidas **en el mismo proceso**, así que no detecta dependencias del `PYTHONHASHSEED`. Sea estricto por su cuenta.

3. **Unidades de medida** (`sim/constantes.py`):

   | Magnitud | Valor |
   |---|---|
   | Ticks por segundo (`TICKS`) | 16 |
   | Subunidades por píxel (`SUB`) | 16 |
   | Píxeles por casilla (`TILE_PX`) | 32 |
   | Subunidades por casilla (`TILE`) | 512 |
   | Energía | en 1/256 de punto (`EFP`) |
   | Fracciones de vida (regeneración, curación) | en 1/64 de punto (`HFP`) |
   | Experiencia | en 1/16 de punto (`XPF`) |

   - La vida misma es un entero en puntos.
   - Conversiones: `ticks(s)` de segundos a ticks, `sub(casillas)` de casillas a subunidades y `vel(casillas_por_segundo)` de velocidad a subunidades por tick.
   - De subunidades a píxeles: `x >> 4`.
   - Los comandos y las instantáneas usan **píxeles**; la simulación usa subunidades.
   - Los JSON de `datos/` usan unidades cómodas (segundos, casillas, casillas por segundo) y el catálogo las convierte.

4. **Huella del contenido y protocolo**
   - Al conectarse, el cliente manda `PROTOCOLO` y la **huella**. El servidor rechaza al que no coincide (`servidor.py`, `_saludo`).
   - La huella son los primeros 16 caracteres hexadecimales del sha256 de los **seis** archivos de `contenido/catalogo.py:ARCHIVOS`: tablas, unidades, edificios, mejoras, habilidades y facciones.
   - El hash se calcula sobre el JSON canónico (`sort_keys=True`). Por eso **ni el formato del archivo ni el orden de las entradas cambian la huella**; en cambio, **cambiar cualquier valor o texto, incluso un `_comentario`, sí la cambia**.
   - `campanas.json` y `nombres.json` **no** entran en la huella.
   - La huella solo cubre los **datos**: dos versiones con código distinto y datos iguales sí se conectan entre sí. Por eso, si cambia el formato de un mensaje o de la instantánea de forma incompatible, **suba `PROTOCOLO`**.
   - `VERSION` es informativa: se muestra en pantalla, se guarda en la base de datos y en las repeticiones, y la escena de repeticiones avisa si la versión difiere.

5. **Índices de red: no reordene los JSON**
   - En las instantáneas y los eventos, el tipo de cada entidad viaja como `tipo.idx`, su posición en el catálogo: primero las unidades en el orden de `unidades.json`, luego los edificios en el orden de `edificios.json`. También van por índice los tipos de `g`, `c` y `pc` y el `extra.u` del herido. Las mejoras van por su orden en `mejoras.json`, pero solo en el evento `investigado`.
   - En cambio, usan ids de texto (`"infante"`, `"barracas"`): los **comandos**, la cola `q`, `j.m`, `j.i`, `j.h`, las claves de `cd` y el evento `hab`.
   - **La huella no cubre el orden** (§2.4). Reordenar entradas existentes sin cambiar nada más deja la misma huella pero cambia los índices: un cliente y un servidor con distinto orden se conectarían y verían tipos equivocados. Si reordena, suba `PROTOCOLO`.
   - Agregar una entrada nueva sí es seguro, porque cambia el contenido y con él la huella.
   - Una repetición solo se puede ver con la misma huella con que se grabó: `Servidor.m_ver_repeticion` la rechaza si no coincide. Por eso, cualquier cambio de contenido en los datos deja inservibles las repeticiones grabadas antes.

6. **Capas separadas**
   - `sim`, `ia`, `red`, `servidor` y `contenido` **no importan pygame**: el servidor dedicado y la imagen Docker corren sin él.
   - El cliente sí puede importar de `sim` lo que es puro: `sim.mapa`, `sim.vision`, `sim.stats` y `sim.constantes`.

7. **Nada ejecutable por la red**
   - Solo JSON (sin `pickle`), con tamaño máximo de mensaje y límite de frecuencia.
   - Valide cada campo, con `protocolo.texto` y `protocolo.entero` en el servidor y con conversiones `int(...)` en los comandos.

8. **Toda mecánica nueva lleva su prueba** en `tests/`, y la documentación se actualiza: `README.md`, `docs/DISENO.md`, `docs/ARQUITECTURA.md` y `docs/TABLAS.md` (este último se regenera).

9. **Tono**
   - Los textos del juego son en español, con vocabulario militar de la época: «¡Calen bayoneta!», «parte de guerra», «escalafón».
   - El juego trata a los cuatro países con respeto y no toma partido.

---

## 3. Orden de batalla de los módulos

```
rts/
├── salitre/                      el programa
│   ├── __init__.py               VERSION, NOMBRE_JUEGO, PROTOCOLO
│   ├── __main__.py               python -m salitre [--servidor]
│   ├── rutas.py                  carpetas de instalación (datos/, mapas/, recursos/) y de usuario
│   │                             (Windows %APPDATA%\GuerraDelPacifico, macOS ~/Library/Application Support/
│   │                             GuerraDelPacifico, Linux ~/.local/share/guerra-del-pacifico;
│   │                             variable SALITRE_DATOS_USUARIO para cambiarla)
│   ├── contenido/                lee y valida los datos (sin pygame)
│   │   ├── catalogo.py           Catalogo, TipoUnidad, TipoEdificio, Mejora, Habilidad, Faccion,
│   │   │                         Veterania/Grado, Arma, Efecto, Filtro; huella; validaciones cruzadas
│   │   ├── mapas.py              MapaDatos (formato de texto de los mapas), cargar/listar/buscar
│   │   ├── campanas.py           Campaña del Salitre: etapas, escalafón, honores, medallas
│   │   ├── nombres.py            nombre y cuerpo del veterano a partir de su semilla (igual en todos los equipos)
│   │   └── textos.py             descripción legible de efectos (archivo histórico, tablas)
│   ├── sim/                      simulación determinista (la usa el servidor)
│   │   ├── constantes.py         TICKS, TILE, EFP, HFP, XPF, clases de entidad, capas TIERRA/AGUA
│   │   ├── azar.py               Azar (xorshift64*)
│   │   ├── mundo.py              Mundo: entidades, jugadores, bucle paso(), creación, muerte, heridos,
│   │   │                         obras, montaje/desmontaje, rutas, visión, victoria, retirada
│   │   ├── entidades.py          Orden y sus tipos, Unidad, Edificio, Herido, Recurso, Mina, Proyectil,
│   │   │                         Convoy; hoja_de(u)
│   │   ├── comandos.py           validación de los comandos → órdenes (MANEJADORES)
│   │   ├── comportamiento.py     qué hace cada unidad en cada tick (mover, combatir, recolectar,
│   │   │                         construir, reparar, curar, embarcar, camilleros) y separación
│   │   ├── edificios.py          edificios terminados: colas de producción e investigación, defensas,
│   │   │                         guarniciones, molino, hospital (camilleros y pacientes), desmontaje
│   │   ├── combate.py            alcance, blancos, daño, explosiones, proyectiles, ventaja de altura
│   │   ├── habilidades.py        habilidades activas (auras, curas, andanadas, minas, sabotaje,
│   │   │                         demolición, golpe, revelar, emplazar, desmontar)
│   │   ├── ruta.py               A* con presupuesto de nodos (Buscador), línea recta, suavizado
│   │   ├── mapa.py               Mapa: terreno, niveles, rampas, paso, ocupación, regiones conexas
│   │   ├── vision.py             niebla por nivel con operaciones de bits; detección
│   │   ├── espacial.py           Rejilla (unidades) y RejillaEdificios para buscar vecinos
│   │   ├── jugador.py            Jugador: dinero, agua, población, mejoras, sanidad, estadísticas
│   │   ├── stats.py              Stats efectivas por tipo (catálogo + nación + mejoras + grado)
│   │   └── veterania.py          experiencia, ascensos, hoja de servicio, instrucción, encuadramiento
│   ├── ia/ia.py                  IA (fácil/normal/difícil): economía, obras, tropa, ataques,
│   │                             desembarcos, habilidades, veteranos, ambulancias
│   ├── red/
│   │   ├── protocolo.py          marco TCP (4 bytes de longitud + 1 de formato), JSON/zlib, límites
│   │   ├── instantanea.py        Emisor por jugador: niebla + diferencias; registro() de cada entidad;
│   │   │                         banderas F_* y tipos negativos
│   │   └── conexion.py           Conexion del cliente: socket no bloqueante, conexión en un hilo
│   ├── servidor/
│   │   ├── servidor.py           Servidor (asyncio), Sesion, Sala, Partida (bucle de ticks),
│   │   │                         ServidorEnHilo (servidor local de las escaramuzas)
│   │   ├── bd.py                 SQLite: usuarios (PBKDF2), partidas, ELO, series, configuración
│   │   ├── serie.py              Serie de campaña en red (2 a 4 batallas, itinerario de mapas)
│   │   ├── repeticion.py         .rep: JSON + gzip con mapa, semilla, jugadores y comandos
│   │   ├── descubrimiento.py     UDP 47801: «SALITRE?» → servidores de la red local
│   │   └── principal.py          main() del servidor dedicado (argparse, registro)
│   └── cliente/                  frontend con pygame-ce
│       ├── app.py                App: ventana, bucle (≤144 cuadros/s), escenas, servidor local, --prueba-humo
│       ├── lienzo.py             Lienzo: GPU, lienzo lógico 1280×720 escalado con franjas;
│       │                         única conversión de coordenadas (area_imagen, logico_de)
│       ├── config.py             Config (config.json) y Perfil (perfil.db: servidores, escaramuzas, campañas)
│       ├── sonido.py             efectos sintetizados, voces (Kokoro, .ogg) con prioridades, música
│       ├── fuentes.py            IM Fell English SC y Alegreya Sans
│       ├── escenas/              portada, opciones, escaramuza, campana, conectar, lobby (salón),
│       │                         sala, cargando, juego (la batalla), resultados (parte de guerra),
│       │                         repeticiones, archivo (histórico), base
│       ├── juego/                estado.py (espejo + interpolación + niebla), vista.py (dibujo del campo),
│       │                         tarjeta.py (botones de órdenes), camara.py
│       ├── ui/                   hud.py (panel de mando), widgets.py, estilo.py, ui.py, controles_sonido.py
│       └── graficos/             todo dibujado por código: sprites.py (tropas), edificios.py,
│                                 iconos.py, efectos.py, terreno.py, naturaleza.py, convoy.py,
│                                 banderas.py, minimapa.py, paleta.py
├── datos/                        JSON del contenido (ver §6)
├── mapas/                        6 mapas JSON (ver §6.7)
├── recursos/                     fuentes, ícono, música (.ogg) y voces (.ogg + voces.json); aquí pueden
│                                 ir gráficos y sonidos propios que reemplazan a los generados
├── herramientas/                 generar_mapas.py, generar_tablas.py (→ docs/TABLAS.md), generar_icono.py,
│                                 generar_musica.py (numpy + soundfile), generar_voces.py (Kokoro-82M),
│                                 vista_mapa.py (PNG de cada mapa)
├── instalador/                   salitre.spec (PyInstaller), salitre.iss (Inno Setup), construir.sh (portátil
│                                 de Linux, lo usa la CI), construir_windows.ps1, construir_mac.sh,
│                                 lanzar_juego.py / lanzar_servidor.py (puntos de entrada empaquetados)
├── docker/                       Dockerfile y docker-compose.yml del servidor dedicado; probar_servidor.py
├── descargas/                    instalador .exe y .dmg guardados a pedido por la CI, más LEEME.md
├── tests/                        pruebas (ver §12)
└── docs/                         ARQUITECTURA, DISENO, TABLAS (generado), MULTIJUGADOR, INVESTIGACION,
                                  RECOMENDACIONES
```

---

## 4. Cadena de mando de una orden: del clic a la pantalla

1. **Clic del jugador.** En `cliente/escenas/juego.py`, la escena `Juego` traduce el clic o la tecla en un diccionario. Ejemplos:
   - `{"c": "inteligente", "u": [ids], "x": px, "y": py, "t": id|null}` para el clic derecho;
   - un botón de `juego/tarjeta.py`.

   `Juego.enviar(cmd)` lo pasa a `Conexion.comando(cmd)`, que lo envía como mensaje `{"t": "cmd", "cmd": {...}}`.
2. **Llegada al servidor.** `Servidor._despachar` → `m_cmd` → `Partida.comando`, que admite hasta 40 comandos por segundo por sesión y los acumula en `Partida.cmds`.
3. **Bucle de la partida** (`Partida.bucle`, 16 ticks/s × velocidad de 1, 1,25 o 1,5):
   - pasa los comandos con `Mundo.comando(i, cmd)`, que los deja en `Mundo.pendientes`;
   - llama a `IA.actualizar()` de cada IA, que agrega sus propios comandos por la misma vía;
   - ejecuta `Mundo.paso()`.
4. **`Mundo.paso()`** (`sim/mundo.py`), en este orden exacto:
   1. Aplica los comandos pendientes: los anota en `registro` (la repetición) y llama a `comandos.aplicar`. Si un comando lanza `KeyError`, `ValueError`, `TypeError`, `IndexError` o `AttributeError`, se responde con el evento `"err"`.
   2. Ejecuta las acciones programadas (andanadas, cargas de demolición).
   3. Mueve los convoyes de llegada.
   4. Reconstruye la rejilla espacial.
   5. Procesa las rutas pendientes, con presupuesto.
   6. Llama a `edificios.actualizar(m, b)` para cada edificio vivo.
   7. Llama a `comportamiento.actualizar(m, u)` para cada unidad viva que no esté `dentro` (embarcada, guarecida o en un molino).
   8. Reconstruye la rejilla y separa las unidades superpuestas (`comportamiento.separar`).
   9. Resuelve los impactos de los proyectiles.
   10. Activa las minas (cada 2 ticks).
   11. Calcula las auras (cada 8 ticks).
   12. Corre la instrucción de veteranía (una vez por segundo, en `tick % 16 == 8`).
   13. Desangra a los heridos (cada 4 ticks).
   14. Limpia los muertos con `_limpiar()`.
   15. Actualiza la visión (cada 4 ticks).
   16. Comprueba la victoria (cada 16 ticks) y vuelve a limpiar.
5. **Validación y orden.** `comandos.aplicar` busca el manejador en `MANEJADORES`. Cada `c_*` valida:
   - la propiedad de las unidades (`_propias`);
   - la visibilidad de los blancos (`_visible_para`);
   - los requisitos y el costo.

   Si todo está en regla, asigna una `Orden` con `dar(m, u, orden, cola)`. La población no se comprueba aquí, sino al empezar a formar la unidad, en `edificios._avanzar_cola`, que espera y avisa con el evento `pob`.
6. **Eventos.** Durante el tick, la simulación emite eventos de tres maneras:
   - `m.ev_pos(x, y, tipo, ...)` llega a quien ve esa casilla;
   - `m.ev_jugador(p, ...)` llega solo al jugador p;
   - `m.ev_todos(...)` llega a todos.

   `Emisor.acumular()` los filtra por la visión de cada jugador.
7. **Instantánea.** Cada 2 ticks (`INSTANTANEA_CADA`, es decir, 8 por segundo), `Emisor.construir()` arma para cada jugador `{"t": "inst", "k": tick, "e": [...], "q": [...], "ev": [...], "j": {...}, "completa": 1}`. Solo incluye lo que su bando ve y lo que cambió desde la instantánea anterior; las claves vacías no se envían (detalle en §7.2).
8. **Cliente.** `Conexion.recibir()` entrega el mensaje, en cada cuadro y sin bloquear.
   - `EstadoJuego.aplicar(msg)` actualiza el espejo de entidades.
   - `interpolar()` suaviza las posiciones entre instantáneas.
   - `Juego._evento(ev)` reproduce disparos, explosiones, voces y avisos.
   - `Vista.dibujar()` y `HUD.dibujar()` pintan el resultado.

---

## 5. La simulación (`salitre/sim`) en detalle

### 5.1 `Mundo` (`mundo.py`)

**Construcción:** `Mundo(catalogo, mapa_datos, configs, semilla=1, registrar=False, llegada=False)`.
- `configs` es una lista de diccionarios por jugador: `nombre`, `faccion`, `equipo`, `color`, `ia`, `veteranos` y `posicion` (el inicio del mapa; sin ella, se sortea con `azar`).
- `registrar=True` guarda los comandos para la repetición.
- `llegada=True` hace que el Cuartel General llegue en tren o carreta.

**Atributos principales**

| Atributo | Contenido |
|---|---|
| `ent` | Todas las entidades por id. |
| `unidades`, `edificios`, `recursos`, `minas`, `heridos`, `convoyes` | Índices por clase. |
| `proyectiles`, `programados` | Proyectiles en vuelo y acciones con tick de ejecución. |
| `eventos` | Se vacía en cada tick. |
| `pendientes` | Comandos del tick siguiente. |
| `registro` | Comandos aplicados `(tick, jugador, cmd)`, si se registra. |
| `muertos` | Lo que `_limpiar()` debe quitar. |
| `cola_rutas` | Unidades que esperan camino. |
| `rejilla`, `rejilla_edif` | Búsquedas espaciales. |
| `vis`, `det`, `explorado` | Por equipo: `bytearray` de una celda por casilla. |
| `jugadores` | Lista de `Jugador`. |
| `aliado[a][b]` | Matriz de alianzas. |
| `caidos` | Veteranos caídos `(dueño, tipo, hoja)`. |
| `retirada` | Fichas de los veteranos del ejército vencido. |
| `terminado`, `ganador` | Estado del final. |
| `trucos` | Habilita el comando `truco`; solo lo encienden las pruebas. |

**Métodos clave**

| Tema | Métodos |
|---|---|
| Relaciones y visibilidad | `enemigos(a, b)`, `aliados(a, b)`, `visible(p, x, y)`, `visible_edificio(p, b)`, `detectado(p, e)`. `entidad(id)` devuelve la entidad o `None` si murió. |
| Creación | `crear_unidad(p, tipo_id, x, y)`, `crear_edificio(p, tipo_id, tx, ty, construido)`, `producir_unidad(b, ut)`. |
| Obras | `validar_construccion`, `validar_lugar(p, tipo, tx, ty)`, `iniciar_construccion`, `construir_paso(b, u)` (avance de la obra), `cancelar_obra`, `_edificio_terminado`, `recalcular_pob(j)`. |
| Muerte | `matar(e, atacante_id, dueno_atacante, explosion)`. Marca `vivo = False`; la entidad sigue en los diccionarios hasta `_limpiar()`. Cuando corresponde, crea un `Herido` en su lugar (§5.11). |
| Sanidad | `puede_herirse(u)`, `crear_herido`, `atender_pacientes(ent)` (sirve para un hospital o para el carro), `_montar(b, u)`, `desmontar(b)`. |
| Rutas | `pedir_ruta(u, x, y)` (en cola), `ruta_inmediata(u, x, y, presupuesto)`, `_procesar_rutas()`. |
| Acciones diferidas | `programar(tick, accion, *datos)`. |
| Mar | `embarcar`, `desembarcar`, `punto_desembarco`. |
| Guarniciones | `vaciar_guarnicion(b, solo)`. |
| Veteranos | `veteranos_de(p)`, `caidos_de(p)`, `_retirada(p)` (el vencido se retira: sus unidades salen del campo y sus veteranos se guardan) y `_desplegar_cuartel` (los veteranos llegan con el cuartel). |
| Pruebas | `suma_control()`: un hash de las entidades y los recursos que usan las pruebas de determinismo. |

**Constantes:** `PRESUPUESTO_RUTAS = 12000` nodos por tick, `PRESUPUESTO_RODEO = 16000`, `LLEGADA = 10 s`.

### 5.2 Entidades (`entidades.py`)

**Orden**
- Clase con `__slots__` `tipo, x, y, obj, dato, x0, y0`.
- Tipos de orden: `MOVER=1`, `ATACAR_MOVER`, `ATACAR`, `MANTENER`, `PATRULLAR`, `RECOLECTAR`, `REGRESAR`, `CONSTRUIR`, `REPARAR`, `SEGUIR`, `CARGAR`, `DESCARGAR`, `HABILIDAD` y `CURAR=14`.

**Entidad** (base): `id, clase, tipo, dueno, x, y, vida, vivo, st`, donde `st` son las `Stats` efectivas.

**Unidad** (muchos slots). Los grupos más importantes:

| Grupo | Slots |
|---|---|
| Órdenes | `orden`, `cola` (hasta 16), `fase`, `objetivo`, `auto` |
| Camino | `ruta`, `ruta_meta`, `ruta_pend`, `tramo` (avance por tramos), `atasco` |
| Combate | `enfr` (enfriamiento), `buffs`, `aura`, `cd` (esperas de habilidades), `disparo_t`, `golpeado_por`, `golpeado_t` |
| Estado | `emplazada`, `emplazando`, `oculta`, `dentro` (embarcada, guarecida o en un molino), `cargamento` (lo que lleva un transporte), `carga`, `carga_tipo` (salitre o agua que lleva un trabajador) |
| Veteranía | `xp`, `grado`, `nombre`, `ficha`, `batallas`, `abatidos` |
| Sanidad | `paciente` y `paciente_hoja` (el herido en la camilla), `pacientes` (los convalecientes en el carro de la ambulancia), `base_id` (el hospital de un equipo de camilleros), `puesto` (su lugar de espera), `descarte` (herido que no se reintenta hasta un tick dado) |

**Edificio**
- Generales: `tx, ty, w, h`, `construido`, `progreso`, `constructor`, `cola` (producción e investigación), `reunion`, `guarnicion`, `pozo`, `ocupante` (molino).
- Sanidad: `camilleros` (ids de los equipos), `camilleros_t`, `pacientes`, `desmontando` (ticks que faltan) y `pob_reservada` (la población de la ambulancia montada).

**Herido:** `hasta` (tick en que muere si nadie lo recoge), `camillero` (id del equipo que va a buscarlo) y `hoja`. Al recogerlo, el `Herido` desaparece y pasa a ser el `paciente` de los camilleros, con su `paciente_hoja`.

**Otras clases:** `Recurso` (`rtipo`, `cantidad`, `minero`, `molino`), `Mina`, `Proyectil` y `Convoy`.

**Hoja de servicio:** `hoja_de(u)` devuelve `(xp, grado, nombre, ficha, batallas, abatidos)`, o `None` para un recluta sin historia.

**Paciente:** cada paciente es `[tipo_id, ticks_que_faltan, hoja]`.

### 5.3 Comandos (`comandos.py`)

Formato (coordenadas en **píxeles**; `u` son ids de unidades, `e` de edificios; `"cola": true` encola la orden):

```
{"c":"mover","u":[...],"x":px,"y":py,"cola":false}     {"c":"atacar_mover"|"patrullar","u":[...],"x","y"}
{"c":"atacar","u":[...],"t":id}                        {"c":"inteligente","u":[...],"x","y","t":id|null}
{"c":"detener"|"mantener"|"regresar"|"replegar","u":[...]}
{"c":"recolectar"|"reparar"|"cargar","u":[...],"t":id}
{"c":"construir","u":[...],"e":tipo_edificio,"tx":casilla,"ty":casilla}
{"c":"entrenar","e":[ids],"t":tipo_unidad,"n":1}       {"c":"investigar","e":id,"m":mejora}
{"c":"cancelar","e":id,"i":indice}                     {"c":"cancelar_obra","e":id}
{"c":"reunion","e":[ids],"x","y","t":id|null}
{"c":"habilidad","u":[ids],"h":habilidad,"x","y","t":id|null}    {"c":"emplazar","u":[...]}
{"c":"descargar","u":[ids],"x","y"}   (en un edificio, "g": id saca a un solo soldado)
{"c":"senal","x","y"}   {"c":"rendirse"}   {"c":"truco",...} (solo con Mundo.trucos)
```

- Límites: `MAX_SELECCION = 255` unidades por comando, `MAX_COLA = 16` órdenes encoladas por unidad, hasta 5 elementos en la cola de producción de cada edificio y `n` de 1 a 5 en `entrenar`.
- `_mover_grupo` reparte destinos en formación (`_formacion`) y calcula **un** camino para la unidad más cercana al centro del grupo. Las demás lo reutilizan desde el punto más avanzado que ven en línea recta.
- `puede_levantar(u, b)`: los trabajadores no levantan edificios con `desmonta_en` (el hospital de sangre); el constructor declarado sí.
- Las unidades `autonomo` (los camilleros) no reciben órdenes: `_propias` las filtra.

### 5.4 Comportamiento (`comportamiento.py`)

`actualizar(m, u)` corre una vez por tick y por unidad:
- regenera energía, vida y enfriamientos;
- atiende a los `pacientes` del carro;
- avanza el emplazamiento;
- si la unidad es `autonomo`, llama a `camilleros(m, u)`; si no, despacha según `u.orden.tipo`;
- sin orden, la unidad queda en `inactivo()`: se defiende, cura (si es cantinera) o vuelve a su puesto.

**Contrato de `ir_a(m, u, x, y, cerca=0)`:** devuelve `1` si llegó, `0` si va en camino y `-1` si no puede llegar.
- Cuando el camino parcial (por presupuesto) se acaba antes de la meta, `_tramo_siguiente` pide el tramo siguiente, siempre que la meta esté en la misma región conexa.
- Si un tramo no acercó la unidad al menos una casilla, el siguiente se busca una vez con `PRESUPUESTO_RODEO`.
- Tras dos tramos más sin avance, desiste y devuelve `-1`.

**Otras funciones:**
- Combate: `combatir`, `buscar_objetivo`, `atacar`.
- Economía: `recolectar` → `regresar` → `depositar` (vende el salitre en el Cuartel General).
- Obras: `construir` → `trabajar_obra`, y `reparar` (cuesta el 25 % del costo por el 100 % de la vida).
- Mar: `cargar` y `descargar`.
- Curación: `curar_paso` y `_curar_en_marcha` (cantinera); `seguir`.
- Separación: `separar` y `_empujar`.

### 5.5 Edificios (`edificios.py`)

`actualizar(m, b)` solo actúa sobre edificios **terminados**. Las obras avanzan aparte: `comportamiento.trabajar_obra` llama a `Mundo.construir_paso`.

En cada tick:
- cuenta atrás de `desmontando`; al llegar a cero, llama a `m.desmontar(b)`;
- colas de producción e investigación (`_avanzar_cola`), que comprueba la población antes de empezar a formar;
- defensa con arma propia (`_defender`) y fuego de la guarnición (`_fuego_guarnicion`);
- salida del trabajador del molino (`_salir_molino`); la entrada está en `comportamiento.recolectar`;
- `_hospital`: repone los equipos de camilleros (`equipos_de(m, b)` = `tipo.camilleros + sanidad["equipos"]`) y atiende a los pacientes.

### 5.6 Combate (`combate.py`)

- **Daño:** `calcular_danio` = daño del arma × multiplicador (tipo de ataque contra clase de armadura, de `tablas.json`) × (100 + bonos %) / 100 − armadura, con mínimo 1.
  - Los multiplicadores en `0` (sable contra buques) no hacen daño.
  - El «cuadro» de los Colorados reduce el daño de sable.
  - `bonus_edificios` aumenta el daño contra obras.
- **Altura:** desde un nivel más bajo se falla el 30 % (`fallo_por_altura`). Los grados altos reducen la falla (`veterania.fallo_altura`) y el efecto dinámico `ignora_altura` la anula.
- **Disparos:** los instantáneos aplican el daño enseguida; los proyectiles lentos (`arma.proyectil`) viajan y pueden errar.
- **Explosiones:** `explotar()` hace daño en área (`salpicadura`).
- **Muerte:** `danar()` resta vida, da experiencia (`veterania.por_danio`), avisa del ataque y, si corresponde, llama a `matar`.
- **Eventos:** `"dis"` (disparo), `"pro"` (proyectil) y `"exp"` (explosión).

### 5.7 Caminos (`ruta.py`)

- `calcular(mapa, buscador, capa, x0, y0, x1, y1, presupuesto)` prueba primero la línea recta (`mapa.linea_libre`) y, si no hay, usa A\* de 8 direcciones con costo octil 10/14 (`Buscador.buscar`).
- Si se agota el presupuesto, devuelve el camino hasta el nodo más cercano a la meta. `suavizar` quita los puntos intermedios innecesarios.
- `mapa.region[capa]` guarda las regiones conexas precalculadas (0 = no pisable). Si la meta no es pisable o está en otra región, `calcular` la reemplaza por la casilla pisable más cercana de la región de la unidad (hasta 24 casillas; si no hay ninguna, devuelve un camino vacío) y busca hacia ella.
- Cada tick hay `PRESUPUESTO_RUTAS = 12000` nodos. Cada búsqueda en cola recibe `min(4000, max(500, restante))`.

### 5.8 Mapa, niveles y visión (`mapa.py`, `vision.py`)

**Terreno** (un carácter por casilla):

| Carácter | Terreno |
|---|---|
| `.` | arena |
| `,` | pampa |
| `:` | salar |
| `=` | camino o vía férrea |
| `/` | rampa |
| `#` | roca o cerro |
| `T` | tamarugo |
| `q` | quebrada |
| `~` | mar |
| `p` | ruinas |

**Altura:** `0`, `1` o `2` por casilla.

**Capas de movimiento:** `TIERRA` y `AGUA`. En tierra solo se pasa entre casillas del mismo nivel o por una rampa (`Mapa.paso`, `puede_pasar`). `ocupar` y `liberar` marcan los edificios y los recursos.

**Visión** (`vision.calcular`):
- Cada observador marca un círculo por tramos de filas en una rejilla por nivel.
- Desde abajo no se ve lo que está más arriba.
- Las rejillas se combinan con operaciones de bits sobre enteros grandes.
- `deteccion` marca lo que revelan los detectores (espías, montoneros quietos, minas).
- El cliente recalcula la misma niebla para dibujarla suavizada.

### 5.9 Jugador, estadísticas y efectos (`jugador.py`, `stats.py`)

**Estado del jugador**
- `Jugador` tiene `dinero`, `agua`, `pob_usada` y `pob_max`.
- También: `mejoras`, `investigando` y `terminados` (cuántos edificios terminados de cada tipo tiene en pie; de ahí salen `tiene()` y los requisitos).
- `heroes`, `minas` y el diccionario de estadísticas `est` para el parte de guerra.
- `sanidad`: `{"equipos", "segundos_herido", "vida_al_volver"}`, que suman las investigaciones del hospital.

**Efectos y estadísticas**
- Los **efectos estáticos** (nación, investigaciones y grado) se suman en `stats.calcular`. `stats.tabla(...)` arma la tabla de nación más investigaciones, y `Jugador.stats_de(tipo_id, grado)` agrega el grado y guarda en caché cada combinación de tipo y grado.
- Al terminar una investigación, `Mundo.refrescar_stats(j)` recalcula.
- Los **efectos dinámicos** (auras y habilidades) se aplican por unidad con `u.mod(campo, tick)`. Sus campos están en `CAMPOS_DINAMICOS`.

### 5.10 Veteranía (`veterania.py`)

**Experiencia**
- Se mide en valor de combate: un punto = $ 1 del costo de lo abatido, guardado en 1/16.
- Herir da la parte proporcional, y se reparte según el daño de cada tirador.
- También da experiencia dañar obras (la mitad del valor), aguantar fuego (un cuarto de la vida perdida) y curar (la cantinera).

**Grados**
- Los umbrales y los bonos están en `tablas.json → veterania` y se alcanzan a 1, 3 y 6 veces el valor de la unidad.
- `ascender` cambia las estadísticas de la unidad. Al primer ascenso, `semilla_nombre` le da nombre y cuerpo.

**Instrucción y encuadramiento**
- `instruccion(m)`: la mejora *Ejercicios de tiro* lleva a los reclutas ociosos junto al Barracón de Instrucción hasta Fogueado.
- Encuadramiento (`veterania.auras`): todo soldado aliado de grado menor aprende +50 % cerca de un Aguerrido de su misma clase, y +25 % cerca de un héroe.

**Quién tiene grados:** solo la tropa que combate o cura (con `arma` o `curar`). No los tienen los héroes, los trabajadores, las unidades `autonomo` ni las que no tienen arma (espía, ambulancia, transporte). Lo decide `tipo.veterania` en `Catalogo.__init__`.

### 5.11 Sanidad: heridos, camilleros, hospitales y ambulancia

**Cuándo una baja queda herida.** `matar()` crea un `Herido` si `puede_herirse(u)` se cumple:
- la unidad es infantería o caballería biológica, no es héroe ni `autonomo`, está en tierra y no está `dentro` (embarcada, guarecida o en un molino);
- la muerte no fue por explosión;
- el jugador sigue vivo y tiene terminado algún edificio de `cat.hospitales` (los que tienen `camilleros`).

El herido dura `segundos_herido` (40 s, más lo que sumen las mejoras).

**Camilleros** (`comportamiento.camilleros`). Son una unidad `autonomo` que pertenece a un hospital.
- Cada 4 ticks, un equipo libre elige herido con `_buscar_caido`:
  - entre **todos** los heridos de su mismo jugador (no los de los aliados), sin límite de radio, salvo los que están en otra región del mapa;
  - prefiere los que alcanza antes de `hasta` (estimación de `_a_tiempo`: 5/4 de la línea recta), luego el de mayor grado, luego el más cercano;
  - cede el herido a otro equipo libre más cercano, pero solo de su misma región.
- Lleva al herido al **hospital más cercano** (`hospital_cercano`).
- Si no puede llegar, lo suelta y no lo reintenta durante 6 s (`descarte`).
- Sin heridos, espera en fila frente a la puerta (`_esperar_en_puerta`, `puesto`).

**Hospitales.** `Mundo.atender_pacientes(ent)` cura en `recuperacion` ticks y devuelve al soldado con `vida_al_volver` % (más la sanidad del jugador) y con su hoja de servicio aplicada (`veterania.aplicar_hoja`). Respeta el tope de población.

**Ambulancia.** Es una unidad con `"monta": "hospital_sangre"`; el hospital de sangre es un edificio con `"desmonta_en": "ambulancia"`.
- *Montar* es una orden `construir` que solo esa unidad puede levantar.
- Al terminar la obra, `_montar` quita la unidad sin contarla como baja (evento `"monta"`), pasa la proporción de vida y los pacientes a las carpas y reserva su población en `pob_reservada`.
- *Desmontar* es una habilidad: activa `desmontando` (bandera `F_DESMONTA`) y al llegar a cero `desmontar(b)` hace lo inverso. Recrea el carro, sube a los camilleros (el herido que llevaban pasa a ser paciente del carro) y emite `"desmonta"`.

**Si cae el hospital o el carro,** sus pacientes cuentan como caídos.

### 5.12 Habilidades (`habilidades.py`)

**Tipos válidos** (`catalogo.TIPOS_HABILIDAD`):

| Tipo | Uso |
|---|---|
| `orden_reparar`, `menu_construir`, `emplazar`, `descargar` | Órdenes con botón. |
| `sabotaje`, `mina`, `demolicion`, `revelar` | Acciones especiales. |
| `potenciar_area`, `potenciar_propio` | Efectos temporales. |
| `bombardeo` | Andanada programada. |
| `curar_area`, `golpe` | Curación en área y golpe naval. |
| `montar` | Lo traduce el cliente a `construir`. |
| `desmontar` | Recoge el hospital de sangre. |

**Objetivos:** `ninguno`, `punto`, `unidad_enemiga`, `edificio_enemigo` y `propio`.

**Lanzamiento**
- `lanzar(m, c, h, x, y, obj)` aplica la habilidad. Antes, `error_lanzar(m, c, h)` comprueba la energía, el enfriamiento, el tope de minas y que no se esté desmontando ya. El alcance lo resuelve `orden_habilidad`, que acerca a la unidad antes de lanzar.
- Las acciones con retardo usan `m.programar(...)` y se ejecutan en `ejecutar_programado`.

---

## 6. Contenido: los JSON de `datos/` y su validación

`Catalogo(carpeta)` (`contenido/catalogo.py`) carga los seis archivos de la huella, convierte unidades y **valida todo con mensajes claros**: `ContenidoError("unidades.json:infante: …")`. Las claves que empiezan con `_` son comentarios: se ignoran al cargar, pero sí cuentan en la huella.

### 6.1 Unidad (`unidades.json`), ejemplo real

```json
"infante": {
  "nombre": "Infante de línea", "descripcion": "…", "historia": "…",
  "clase": "infanteria", "categoria": "infanteria",
  "costo": {"dinero": 50, "agua": 0}, "poblacion": 1, "tiempo": 15,
  "vida": 45, "armadura": 0, "velocidad": 1.6, "vision": 8, "radio": 0.3, "capa": "tierra",
  "arma": {"tipo": "fusil", "danio": 6, "alcance": 5, "enfriamiento": 1.0, "objetivos": "ambos"},
  "produce_en": "barracas", "requisitos": [], "habilidades": [], "atajo": "I",
  "sprite": {"forma": "infante"}
}
```

**Campos opcionales**

| Campo | Para qué sirve |
|---|---|
| `faccion` | Unidad propia de una nación. |
| `heroe` | Marca a un héroe. |
| `espacio` | Lugar que ocupa en un transporte. |
| `transporte` | Capacidad de un transporte. |
| `energia` | `{max, inicial, regen}`. |
| `curar` | `{ritmo, alcance, costo_energia, busqueda}`. |
| `emplazar` | `{tiempo}`. |
| `aura` | `{radio, efectos}`. |
| `trabajador` | Recolecta y construye. |
| `monta` | Edificio que levanta y en el que se convierte (ambulancia). |
| `arma` | También admite `alcance_min`, `salpicadura` y `proyectil` (velocidad). Su `objetivos` vale `tierra`, `agua` o `ambos`. |

**Pasivas** (`pasivas`): `detector`, `camuflaje`, `camuflaje_quieto`, `cuadro`, `carga`, `bonus_edificios`, `no_adquiere` (no elige blancos sola), `autonomo` (camilleros) y `constructor: {edificios, velocidad}`.

**Valores de referencia**
- Clases de armadura: `infanteria`, `caballeria`, `artilleria`, `naval` y `edificio` (en `tablas.json → clases_armadura`).
- Tipos de ataque: `fusil`, `sable`, `metralla`, `explosivo`, `dinamita` y `canon_naval`.

**Ids actuales**
- Unidades comunes: `trabajador`, `infante`, `cantinera`, `camilleros`, `ambulancia`, `ingeniero`, `granadero`, `cazador`, `artilleria_montana`, `canon_campana`, `gatling`, `espia`, `transporte`, `canonera`.
- Unidades propias de cada nación: `zapador`, `torpedista`, `montonero`, `colorado`, `baqueano`.
- Héroes: `baquedano`, `san_martin`, `velasquez`, `irene_morales`, `prat`, `bolognesi`, `caceres`, `ugarte`, `grau`, `campero`, `abaroa`, `camacho`, `zeballos`, `roca`, `villegas`, `saenz_pena`, `piedrabuena`.

### 6.2 Edificio (`edificios.json`)

**Campos generales**
- `tamano: [ancho, alto]` en casillas, `vida`, `armadura`, `costo`, `tiempo`, `vision`.
- `poblacion` (cuánta da), `deposito` (recibe recursos).
- `produce`, `investiga`, `requisitos`.
- `menu`: `basico` o `avanzado` (los dos menús del trabajador), o `ambulancia` (no aparece en los menús del trabajador).
- `atajo`, `sprite.forma`.

**Campos especiales**

| Campo | Para qué sirve |
|---|---|
| `sobre_recurso` | Se levanta sobre un recurso (el molino sobre un pozo). |
| `costero` | Va en la costa (el muelle). |
| `arma` | Defensa propia. |
| `detector` | Revela lo oculto. |
| `guarnicion` | `{capacidad, alcance_extra, categorias, clases, vista: "trinchera"\|"techo"}`. |
| `regeneracion` | `{radio, ritmo}`. |
| `camilleros` | `{equipos, recuperacion, reposicion, vida_al_volver}`. |
| `desmonta_en` | Unidad en que se convierte al desmontarse. |
| `energia` | Igual que en las unidades. |
| `habilidades` | Habilidades del edificio. |

**Ids actuales:** `cuartel_general`, `deposito`, `molino_agua`, `barracas`, `maestranza`, `hospital_campana`, `hospital_sangre`, `trinchera`, `reducto`, `barracon_instruccion`, `caballeriza`, `central_telegrafos`, `parque_artilleria`, `estado_mayor`, `muelle` y `fortin` (argentino).

### 6.3 Efectos y filtros (mejoras, naciones, grados, auras)

```json
{"campo": "danio", "suma": 1,
 "objetivo": {"clases": ["infanteria"], "armas": ["fusil"], "excluir_categorias": ["trabajador"]}}
```

**Campos estáticos** (`CAMPOS_ESTATICOS`): `danio`, `danio_pct`, `armadura`, `alcance`, `vida`, `vida_pct`, `velocidad_pct`, `ataque_vel_pct`, `vision`, `curacion_pct`, `energia_max`, `salpicadura`, `carga_pct`, `costo_pct`.

**Campos dinámicos** (`CAMPOS_DINAMICOS`, para auras y habilidades): `danio_pct`, `armadura`, `velocidad_pct`, `ataque_vel_pct`, `alcance`, `regeneracion`, `inmortal`, `ignora_altura`, `camuflaje`.

**Filtro** (`objetivo`): `clases`, `categorias`, `excluir_categorias`, `armas`, `unidades`, `edificios`, `capa`, `biologica`.

### 6.4 Mejoras, habilidades, naciones y tablas

**`mejoras.json`**
- Campos: `edificio` (dónde se investiga; debe coincidir con su `investiga`), `costo`, `tiempo`, `previa`, `requisitos`, `efectos`.
- `sanidad: {equipos, segundos_herido, vida_al_volver}` suma al jugador.

**`habilidades.json`**
- Campos: `tipo`, `objetivo`, `alcance`, `energia`, `enfriamiento`, `duracion`, `radio`, `efectos`, `atajo`, más los propios de cada tipo (`danio`, `proyectiles`, `retardo`, …).

**`facciones.json`**
- `_comunes`: unidades y edificios de todas las naciones.
- Cada nación tiene:
  - `nombre`, `ejercito`, `descripcion`, `historia`, `bandera`;
  - `uniforme` (colores base) y `uniformes` (por arma);
  - `unidades` y `edificios` propios;
  - `nombres` (cómo llama esa nación a las unidades comunes);
  - `bonificaciones` (efectos iniciales).

**`tablas.json`**
- Combate: `clases_armadura`, `multiplicadores` (tipo de ataque × clase de armadura, en %), `fallo_por_altura`.
- Economía: `poblacion_maxima`, `recursos_iniciales`, `trabajadores_iniciales`, cargas y tiempos de extracción.
- Otros: `minas_maximas`, `segundos_herido`, `distancia_minima_recursos_cuartel`.
- `veterania`: grados, umbrales, efectos, experiencia por curar e instrucción.

### 6.5 Campañas y nombres (fuera de la huella)

**`campanas.json`**
- Etapas de la Campaña del Salitre: mapa, rival según la nación, `nucleo_rival` (veteranos con que empieza la IA), `honores` y `medallas`.
- La lógica está en `contenido/campanas.py`.
- Una ficha de veterano es `{"ficha", "tipo", "grado", "xp", "nombre", "batallas", "bajas"}`.

**`nombres.json`**
- Nombres, apellidos y cuerpos de cada nación.
- `contenido/nombres.py` deriva el nombre de una semilla, así sale igual en el servidor y en el cliente.

### 6.6 Validaciones cruzadas (`Catalogo._validar`)

- `produce_en` debe ser un edificio, y ese edificio debe listar la unidad en `produce`. Los `autonomo` están exentos: los manda el hospital.
- Los requisitos, habilidades y mejoras deben existir.
- Cada mejora debe declarar el mismo edificio que la investiga.
- `monta` ↔ `desmonta_en` deben corresponderse.
- Una habilidad de tipo `montar` exige `monta`; un edificio con `desmonta_en` exige la habilidad `desmontar`.
- No puede haber ids repetidos entre unidades y edificios.
- `Catalogo.hospitales` reúne los edificios con camilleros.

### 6.7 Mapas (`mapas/*.json`, `contenido/mapas.py`)

**Campos**
- `id`, `nombre`, `descripcion`, `historia`, `ambiente`;
- `ancho` y `alto`: de 16 a 256 casillas;
- `jugadores`, `naval`, `llegada` (`tren` o `carreta`);
- `inicios`: la casilla superior izquierda del Cuartel General de cada jugador;
- `recursos`: salitre de 2×1 casillas y agua de 3×3, con su `cantidad`;
- `terreno` y `altura`: listas de cadenas, una fila de caracteres por fila de casillas.

**Mapas actuales**

| Mapa | Tamaño | Jugadores |
|---|---|---|
| `alto_de_la_alianza` | 96×112 | 2 |
| `morro_de_arica` | 112×96 | 2 |
| `pampa_del_tamarugal` | 96×96 | 2 |
| `quebrada_de_tarapaca` | 88×120 | 2 |
| `cuatro_naciones` | 128×128 | 4 |
| `islas_de_chincha` | 112×112 | 4, con mar |

**Herramientas**
- `herramientas/generar_mapas.py` genera los mapas oficiales: describe cada uno con operaciones (mesetas con rampas, cerros, quebradas, mar) y luego lo refleja para que sea simétrico.
- `herramientas/vista_mapa.py` dibuja una vista previa en PNG.

---

## 7. Red (`salitre/red`)

### 7.1 Transporte

**Marco de cada mensaje:** 4 bytes de longitud (*big-endian*; cuentan el byte de formato y el cuerpo) + 1 byte de formato + cuerpo.
- Formato 1: JSON en UTF-8.
- Formato 2: JSON comprimido con zlib; se usa si el cuerpo pasa de 1 KB.

**Límites:** `MAX_MENSAJE` es 8 MiB y `MAX_MENSAJE_CLIENTE` 256 KiB.

**Puertos:** TCP 47800 y UDP 47801 para el descubrimiento.

**Saludo:** `{"t": "hola", "protocolo", "version", "huella", nombre, clave, registrar}`. El servidor responde `bienvenida` o `error`.

**Otros mensajes del cliente:**
- Salón: `salas`, `escalafon`, `historial`, `crear_sala`, `unirse`, `salir_sala`, `ajustar`, `listo`, `agregar_ia`, `quitar`, `mapa`, `serie`, `iniciar`, `ping`.
- Partida: `partida_rapida`, `cmd`, `chat`, `rendirse`, `abandonar`, `pausa` (solo en el servidor local y en las repeticiones).
- Espectador: `observar` (una partida en curso; no sirve para repeticiones).
- Repeticiones: `ver_repeticion` y `velocidad_rep` (solo en el servidor local); `pedir_repeticion` (copia de la última partida, una vez cada 10 s).

**Límites del servidor:** 40 comandos por segundo por sesión, chat de 4 mensajes por segundo y 240 caracteres, 50 salas como máximo.

La tabla completa de mensajes está en `docs/ARQUITECTURA.md`.

**Mensaje `inicio`:**
```
{"t": "inicio", "partida", "mapa", "semilla", "jugadores", "yo", "ticks", "velocidad",
 "huella", "cada", "repeticion", "fin_rep"}
```

### 7.2 Instantánea (`instantanea.py`)

**Entidad:** `[id, tipo, dueño, x, y, vida, dir, banderas, extra]`, con `x` e `y` en píxeles.
- `tipo` es `tipo.idx` o un valor negativo: −1 salitre, −2 agua, −3 mina, −4 herido (con `extra.u` = tipo de la unidad caída) y −5 convoy.
- `extra` es `0` o un diccionario.

**Banderas `F_*`:**

| Bandera | Valor | Bandera | Valor |
|---|---|---|---|
| `MOVIENDO` | 1 | `TRABAJA` | 512 |
| `DISPARO` | 2 | `POTENCIADO` | 1024 |
| `SALITRE` | 4 | `EMPLAZANDO` | 2048 |
| `AGUA` | 8 | `DETECTADO` | 4096 |
| `EMPLAZADA` | 16 | `CAMILLA` | 8192 |
| `OCULTA` | 32 | `DESMONTA` | 16384 |
| `OBRA` | 64 | | |
| `PRODUCE` | 128 | | |
| `SABOTAJE` | 256 | | |

**Claves de `extra`**

| Quién la ve | Claves |
|---|---|
| Todos | Veteranos: `v` (grado), `vm` (vida máxima), `n` (semilla del nombre). Guarnición: `g` (tipos guarecidos), `gf` (los que acaban de disparar). Obra: `o` (% de avance). Desmontaje: `dm` (%). |
| Solo el dueño | Unidades: `x` (% hacia el grado siguiente), `en` (energía), `c` (cargamento), `k` (abatidos), `cd` (esperas de habilidades), `pc` (convalecientes en el carro). Edificios: `q` (cola), `r` (punto de reunión), `oc` (ocupante), `gv` y `gid` (vida e ids de la guarnición). Hospitales: `cm` (equipos), `ce` (equipos máximos), `cmc` (equipos en el campo), `pc` (pacientes). |

**Mensaje:**
```
{"t": "inst", "k": tick, "e": [cambios], "q": [[id, "m"|"v"]], "ev": [[tick, tipo, ...]],
 "j": {d, a, p, pm, m, i, h, mi}, "completa": 1}
```
- `e`, `q` y `ev` solo van si no están vacías.
- `q` lista lo que sale: `"m"` si murió, `"v"` si salió de la vista.
- `j` son los recursos del jugador: dinero, agua, población, población máxima, mejoras, investigaciones, héroes y minas. Solo se envía cuando cambia la tupla `est` de `Emisor.construir`: **un campo nuevo de `j` debe agregarse también a esa tupla**, o no llegará cuando solo cambie él.
- `completa` va en la primera instantánea y tras una reconexión.
- Los espectadores reciben `js` (los recursos de todos los jugadores) en vez de `j`. Para ellos `registro()` recibe `propio=True`: lo que va bajo `if propio:` también lo ven los espectadores.

**Eventos de la simulación** (el segundo elemento de cada evento):
- Combate: `dis`, `pro`, `exp`, `mue`, `ata`.
- Sanidad: `herido`, `recogido`, `ingresa`, `recuperado`, `monta`, `desmontando`, `desmonta`.
- Veteranía: `ascenso`.
- Obras y producción: `obra`, `fin_obra`, `lista`, `investigado`, `repara`.
- Economía: `venta`, `agotado`, `pozo_agotado`, `pob`.
- Habilidades: `hab`, `cura`, `carga`, `carga_puesta`, `sabotaje`, `revela`, `mina`, `golpe`, `emplaza`.
- Mar: `embarca`, `desembarca`.
- Partida: `llegada`, `senal`, `derrota`, `fin`, `err`.

Quien los dibuja o los dice es `cliente/escenas/juego.py:Juego._evento`.

---

## 8. Servidor (`salitre/servidor`)

**Proceso.** Un solo bucle de eventos `asyncio`, en un hilo, atiende todo:
- cada conexión tiene una tarea de lectura (`Servidor._conexion`) y otra de envío (`Sesion.bucle_envio`);
- la cola de envío admite hasta 2000 mensajes; si se llena, el servidor desconecta a esa sesión;
- cada `Partida` corre su bucle de ticks como otra tarea del mismo bucle.

**Desconexiones**
- A los 20 s la IA toma el mando del ejército (`ESPERA_IA_TOMA`).
- A los 180 s el jugador se da por rendido (`ABANDONO`).
- Si no queda nadie, la partida se cierra al minuto (`ESPERA_TODOS_FUERA`).
- Al reconectarse con el mismo nombre, el jugador recupera su lugar: `Partida.reconectar` llama a `Emisor.reiniciar()`.

**Manejadores.** `Servidor.m_<tipo>` atiende cada mensaje. Los principales: `m_crear_sala`, `m_unirse`, `m_iniciar`, `m_partida_rapida` (escaramuza o batalla de campaña), `m_cmd`, `m_serie`, `m_ver_repeticion`.

**Fin de la partida.** `Partida.finalizar()`:
1. si no es una repetición y duró al menos `minimo_registro` (30 s por omisión; 0 en el servidor local), guarda la repetición (`repeticion.guardar`);
2. si además la partida no fue `abortada`, la registra en la base de datos (`bd.registrar_partida`). El ELO solo cambia en las partidas clasificatorias: al menos dos equipos con jugadores registrados y un ganador;
3. en una serie, aplica el parte de guerra (`Servidor.serie_tras_batalla`);
4. envía `fin` a los jugadores y a los espectadores;
5. llama a `Servidor.partida_terminada`, que devuelve la sala a la espera.

**Servidor dentro del juego** (`ServidorEnHilo`, iniciado por `App.iniciar_servidor_local`), en dos modos:
- **Privado**, para escaramuzas, campaña y repeticiones: escucha en `127.0.0.1`, usa la base `local.db` y guarda todas las repeticiones (`minimo_registro = 0`).
- **Público**, desde «Crear servidor en este equipo»: escucha en `0.0.0.0`, puerto 47800, responde al descubrimiento de la red local y usa `servidor.db`.

En los dos casos, el cliente se conecta a él igual que a uno remoto.

**Base de datos** (`bd.py`, SQLite en modo WAL)
- Tablas: `usuarios`, `partidas`, `partida_jugadores`, `configuracion`, `series` y `serie_jugadores`. El esquema lleva versión en `PRAGMA user_version` (`VERSION_ESQUEMA = 2`).
- Las claves se guardan con PBKDF2-HMAC-SHA256 (120 000 iteraciones y sal aleatoria).
- ELO inicial 1200, K = 32.

**Repetición** (`.rep`): JSON con gzip que guarda versión, huella, mapa, semilla, `llegada`, jugadores, `comandos [[tick, jugador, cmd]]`, fin y ganador. Al verla, el servidor vuelve a simular la partida.

---

## 9. IA (`salitre/ia/ia.py`)

**Uso:** `IA(mundo, p, dificultad)` y luego `actualizar()` en cada tick. Solo decide cada `periodo` ticks: 24 en fácil, 12 en normal y 6 en difícil.

**Ciclo de cada decisión:**
1. `_censo`
2. `_revisar_pedidos`
3. `_trabajadores_ociosos`
4. `_entrenar_trabajadores`
5. `_suministro`
6. `_construcciones` (sigue `ORDEN_CONSTRUCCION`)
7. `_produccion`
8. `_investigar` (sigue `INVESTIGACIONES`)
9. `_militar`
10. `_habilidades`

**`_militar`** cuida a los veteranos (`_cuidar_veteranos` → comando `replegar`), ataca por oleadas que crecen con `incremento`, usa la ambulancia (`_ambulancias`) y desembarca por mar (`_operacion_naval`).

**`DIFICULTADES`** fija para cada nivel: trabajadores, umbral de ataque, barracas, si investiga, si se expande, cuántas obras, si usa habilidades y cuántas `ambulancias` lleva (0, 1 o 2).

**Ambulancias** (`_ambulancias`)
- Montan el hospital de sangre unas 9 casillas detrás del frente, hacia la base, cuando hay al menos 4 unidades atacando y el 25 % de ellas disparó en los últimos 3 s.
- Lo sostienen 30 s o más.
- Lo desmontan cuando el frente se alejó más de 24 casillas o ya no hay ataque en curso (menos de 4 unidades atacando), y además no quedan pacientes, no hay heridos a menos de 14 casillas ni enemigos a menos de 8.

**Limitación conocida: la IA ve a través de la niebla en varias decisiones.**
- `_blanco_enemigo()` elige el blanco de las oleadas entre **todos** los edificios enemigos.
- Ese mismo blanco usan el `reconocimiento` del telégrafo y la decisión de desembarcar (`_necesita_barco`, `_operacion_naval`).
- `_expandir` descarta los yacimientos cercanos a cualquier edificio ajeno, lo haya visto o no.
- Sí respetan la visión `_amenaza`, `_enemigos_cerca` y los blancos de sabotaje y demolición.

Ver §14.

---

## 10. Cliente (`salitre/cliente`)

**Bucle (`App`).** `App.bucle()` corre a 144 cuadros por segundo como máximo. En cada cuadro, `paso(dt)` hace: eventos de pygame → `escena.manejar(Evento)` → `escena.actualizar(dt)` → `sonido.actualizar()` → `escena.dibujar()` → `lz.presentar()`.
- `App.cambiar(escena)` cambia de escena.
- Cada escena declara su música con el atributo de clase `musica`.
- `Escena.devolver_red` devuelve a la conexión los mensajes que la escena no alcanzó a atender, para que los procese la escena siguiente.

**Lienzo**
- Todo se dibuja en una textura lógica de 1280×720, que se escala a la ventana con franjas negras si la proporción no es 16:9.
- Las **únicas** conversiones entre la ventana y las coordenadas lógicas son `Lienzo.area_imagen()` y `Lienzo.logico_de()`.
- No use el «tamaño lógico» de SDL: rompe los clics al agrandar la ventana.

**`EstadoJuego`**
- Espejo de entidades (`Ent`) con interpolación.
- Niebla propia, calculada con `sim.vision`.
- «Fantasmas»: edificios enemigos que quedan recordados bajo la niebla.
- Estadísticas locales (con `sim.stats`) para las fichas y los tooltips.

**`Vista`**
- Dibuja por profundidad: terreno por bloques de 16×16, edificios (las casas fuertes en capas: obra, tiradores, frente), tropas, heridos, efectos, niebla, galones y barras.
- `tarjeta(est, seleccion, submenu)` decide los botones (cuadrícula de 4×3) según la selección.
- `HUD` dibuja la barra superior, el minimapa, la selección, la hoja de servicio y la tarjeta.

**Gráficos procedurales**
- `Sprites.superficie(tipo, faccion, color, vista, frame, emplazada)` despacha según `tipo.sprite["forma"]` y `FORMA_TAM`: `pie`, `montado`, `artilleria`, `buque`, `camilla` o `carro`.
- Las figuras se pintan al triple de tamaño y se reducen con suavizado.
- Para reemplazar un dibujo:
  - un PNG en `recursos/graficos/unidades/<id_unidad>.png` reemplaza a esa unidad;
  - `recursos/graficos/edificios/<id_edificio>.png` reemplaza a ese edificio.
- Los edificios están en `graficos/edificios.py`: `dibujar_edificio(tipo, nacion, color, capa)` despacha por `sprite.forma`.

**Sonido**
- Los efectos se sintetizan al iniciar.
- Las voces (`recursos/sonidos/voces/<clave>_<n>.ogg`) se cargan la primera vez que se dicen y tienen prioridades: selección < orden < aviso < alarma.
- `grupo_voz(tipo)` elige el grupo de voces de cada unidad: `seleccion_<grupo>`, `mover_<grupo>`, etc. Al formarse, cada unidad dice `lista_<id>`.
- La música son dos pistas `.ogg`: `marcha` y `campana`.

**Datos del usuario** (en la carpeta de `rutas.dir_usuario()`)
- `config.json` (pantalla, sonido, controles).
- `perfil.db` (servidores recientes, escaramuzas y campañas).
- `local.db` (la base del servidor privado de escaramuzas, campaña y repeticiones) y `servidor.db` (la del servidor dedicado y la del servidor público dentro del juego).
- Carpetas `repeticiones/`, `registros/` (`cliente.log`, `servidor.log`), `capturas/` y `mapas/`. Los mapas propios de esa carpeta también aparecen en `mapas.listar()`.

---

## 11. Recetas de campaña: cómo hacer los cambios frecuentes

**Ajustar el equilibrio (solo datos)**
1. Cambie los números en `datos/*.json`.
2. Corra `python -m pytest -q`.
3. Corra `python herramientas/generar_tablas.py` para regenerar `docs/TABLAS.md`. Es un paso **manual**: ninguna prueba lo comprueba.
4. Recuerde que el cambio altera la huella: servidor y jugadores deben actualizarse juntos.

**Agregar una unidad**
1. Escriba la entrada en `datos/unidades.json`, sin reordenar las existentes (§2.5). Agréguela al `produce` de su edificio y a `facciones.json`: en `_comunes.unidades` si es común, o en las `unidades` de su nación si es propia.
2. Dibujo: use una `sprite.forma` existente; o cree una nueva en `cliente/graficos/sprites.py` (agregue la forma a `FORMA_TAM` y la función de dibujo en `Sprites.superficie`); o ponga un PNG en `recursos/graficos/unidades/`.
3. Voces: la prueba `test_voces_de_la_tropa` **exige** que exista `lista_<id>` para toda unidad formable, y `seleccion_<grupo>` y `mover_<grupo>` para su grupo de voces.
   - Para generarlas, agregue las frases en `herramientas/generar_voces.py` (`FRASES`) y corra el script. Necesita `kokoro-onnx`, `soundfile` y los archivos del modelo; están en el comentario inicial del script.
   - Si no puede generarlas, no borre la prueba: dígalo y pida que las generen.
4. Si la IA debe usarla, edite `ia/ia.py` (`_produccion` o `_eleccion_barracas`).
5. Escriba una prueba en `tests/test_simulacion.py`, regenere las tablas y actualice `README.md` y `docs/DISENO.md`.

**Agregar un edificio**
1. Escriba la entrada en `datos/edificios.json`: `tamano`, `menu` y `atajo` libre dentro de su menú.
2. Agréguelo a `facciones.json`.
3. Dibújelo en `cliente/graficos/edificios.py` (`dibujar_edificio`, según `sprite.forma`).
4. Si la IA debe construirlo, agréguelo a `ORDEN_CONSTRUCCION`.
5. Escriba una prueba.

**Agregar una mejora:** `datos/mejoras.json` más el `investiga` del edificio. Si sus efectos usan campos existentes, no hace falta tocar código.

**Agregar una habilidad**
- Con un `tipo` existente: basta con el JSON y con agregarla a las `habilidades` de la unidad.
- Con un tipo nuevo, hay que tocar:
  - `TIPOS_HABILIDAD` en `catalogo.py`;
  - `lanzar` y `error_lanzar` en `sim/habilidades.py` (y `orden_habilidad` si la unidad debe acercarse);
  - el botón en `cliente/juego/tarjeta.py`, el ícono en `graficos/iconos.py` y el efecto o la voz en `escenas/juego.py`;
  - una prueba.

**Agregar un comando**
1. Escriba `c_<nombre>(m, p, cmd)` en `sim/comandos.py`, validándolo todo, y regístrelo en `MANEJADORES`.
2. Envíelo desde el cliente (`Juego`, `tarjeta`).
3. Si la IA debe usarlo, agréguelo en `ia/ia.py`.
4. Escriba una prueba de simulación.

**Agregar un dato a la instantánea**
1. Agréguelo en `red/instantanea.py:registro()`, como clave corta en `extra`. Si solo lo debe ver el dueño, póngalo bajo `if propio:`.
2. Léalo en `cliente/juego/estado.py`, `vista.py` o `ui/hud.py`.
3. Si el cambio es incompatible, suba `PROTOCOLO`.

**Agregar un mapa**
1. Agregue la descripción en `herramientas/generar_mapas.py` y corra `python herramientas/generar_mapas.py`; o escriba el JSON a mano.
2. `test_mapas_oficiales` lo valida, porque recorre todos los mapas.
3. Para la Campaña del Salitre o las series, edite `datos/campanas.json` y `servidor/serie.py:ITINERARIO`.

**Publicar una versión** (solo cuando el dueño del proyecto lo pida)
1. Suba `VERSION` en `salitre/__init__.py`.
2. Actualice el comentario de `instalador/salitre.iss`.
3. Escriba las novedades y los enlaces en `descargas/LEEME.md`.
4. La CI construye los instaladores y, con una etiqueta `v*`, los publica en una versión de GitHub.

---

## 12. Pruebas, verificación e integración continua

```sh
cd rts
python -m pip install -r requirements-dev.txt        # pygame-ce, pytest, pyflakes
SDL_VIDEODRIVER=dummy SDL_AUDIODRIVER=dummy python -m pytest -q
python -m pyflakes salitre herramientas instalador docker tests
python -m pytest -q tests/test_simulacion.py -k camilleros   # una parte
```

**Las 66 pruebas, por archivo**

| Archivo | Qué cubre |
|---|---|
| `test_simulacion.py` | Economía, obras, combate, curación, auras, habilidades, minas, artillería, altura, transporte, trincheras, guarniciones, veteranía, heridos y camilleros (caminos por tramos, islas, puestos), ambulancia, instrucción, veteranos que llegan con el cuartel, retirada, llegada en tren o carreta, determinismo y repeticiones. |
| `test_contenido.py` | Catálogo, reglas de población, héroes por nación, mapas oficiales y campaña. |
| `test_red.py` | Protocolo, huella, cuentas, partida de dos jugadores por TCP con ELO, escaramuza y reconexión, veteranos de la campaña y serie de campaña en red. |
| `test_cliente.py` | Todas las pantallas, escaramuza, ambulancia en el cliente, volumen, casas fuertes, campaña, multijugador completo, clics con la ventana agrandada (eventos nativos de SDL), uniformes, voces, cámara por el borde. |
| `test_empaquetado.py` | Ícono de macOS. |

**Ayudas para escribir pruebas** (`tests/utilidades.py`)
- `cat()` carga el catálogo.
- `mapa_llano(ancho, alto, jugadores, extra=fn, agua_filas)` crea un mapa de ensayo; `extra(d)` permite modificar el diccionario del mapa.
- `mundo(mapa, facciones, semilla, equipos, ia, registrar)` crea un mundo con `trucos=True`.
- `avanzar(m, ticks)` avanza la simulación.
- `de(m, p, tipo)` devuelve las entidades vivas de un tipo.
- `px(sub)` convierte subunidades a píxeles.

`conftest.py` importa `utilidades`, que pone los controladores ficticios de SDL y una carpeta temporal de usuario (`SALITRE_DATOS_USUARIO`).

Ejemplo de prueba de simulación (verificado: pasa):

```python
import utilidades as U
from salitre.sim.constantes import TICKS, TILE

def test_infante_abate_a_un_enemigo():
    m = U.mundo()
    a = m.crear_unidad(0, "infante", 20 * TILE, 20 * TILE)    # posición en subunidades
    b = m.crear_unidad(1, "infante", 23 * TILE, 20 * TILE)
    U.avanzar(m, 4)                       # la visión se recalcula cada 4 ticks
    m.comando(0, {"c": "atacar", "u": [a.id], "t": b.id})
    U.avanzar(m, 30 * TICKS)
    assert not b.vivo and a.vivo
```

**Rendimiento medido**
- Una batalla de 320 unidades toma unos 3 ms por tick. El presupuesto es de 62 ms por tick a velocidad normal.
- Peor caso medido: 40 infantes enviados a un rincón cercado por obras dan un máximo de unos 30 ms por tick.
- Las pruebas más lentas son las de red y las de cliente, porque juegan partidas reales por TCP o recorren pantallas con el controlador de video ficticio. La más larga, `test_partida_entre_dos_jugadores`, tarda unos 23 s. Para iterar rápido, corra solo `tests/test_simulacion.py`.

**Integración continua**
- Cada push a cualquier rama que toque `rts/**` corre las pruebas en tres sistemas operativos y construye el instalador de Windows (con prueba de humo `--prueba-humo` del `.exe`), la `.app`/`.dmg`, la versión portátil de Linux y la imagen Docker (probada con `docker/probar_servidor.py`).
- A pedido (*Run workflow*), guarda el `.exe` y el `.dmg` en `rts/descargas/`; ese commit lo hace el bot de la CI en la rama.

---

## 13. Trampas conocidas

1. **Las entidades muertas siguen en los diccionarios hasta `_limpiar()`.** Compruebe siempre `.vivo`, o use `m.entidad(id)`, que devuelve `None` si murió.
2. **Cualquier cambio de contenido en los seis archivos de datos cambia la huella**, incluso editar un comentario `_…`; no la cambian el formato ni el orden de las entradas. Un cambio de contenido obliga a actualizar servidor y jugadores a la vez y deja inservibles las repeticiones grabadas antes. Un reordenamiento, en cambio, pasa inadvertido para la huella y desordena los índices de red (§2.4 y §2.5).
3. **Nueva unidad formable sin voces = prueba de cliente en rojo** (§11).
4. **El hospital de sangre cuesta 0, y reparar cuesta el 25 % del costo:** sus reparaciones son gratis. Como la proporción de vida pasa de las carpas al carro, montar, reparar y desmontar cura gratis a la ambulancia. Es un hueco de equilibrio.
5. **La población de una ambulancia montada** queda en `Edificio.pob_reservada` y se libera al destruirse el edificio (`_quitar_edificio`). Si toca el cálculo de población, revise `Mundo.recalcular_pob`.
6. **`Unidad.dentro`** (embarcada, guarecida o dentro de un molino):
   - `comportamiento` no la actualiza y no viaja como entidad en la instantánea, pero sigue existiendo;
   - el dueño la ve en `extra` (`c`, `g`, `gv`, `gid`);
   - la guarnición sigue disparando desde `edificios._fuego_guarnicion`.
7. **`Mundo.paso()` se traga los errores comunes** (`KeyError`, `ValueError`, `TypeError`, `IndexError`, `AttributeError`) que lance `comandos.aplicar`, y responde con el evento `"err"`. Un error en un manejador puede pasar inadvertido: pruebe los comandos nuevos con datos malos.
   - Un blanco que el jugador **no ve** se descarta:
     - `atacar` sin `x`/`y`, `recolectar`, `reparar` y `cargar` se ignoran en silencio;
     - `atacar` con `x`/`y` se convierte en atacar avanzando hacia ese punto;
     - `inteligente` se convierte en movimiento;
     - `habilidad` responde con `"err"`.
   - En las pruebas, las unidades recién creadas no ven nada hasta que se recalcula la visión: avance 4 ticks antes de ordenar (ver el ejemplo de §12).
8. **Una excepción en la IA no tumba la partida:** `Partida.bucle` la registra y **desactiva esa IA**. Si la IA «se queda quieta», revise los registros: `registros/cliente.log` en una escaramuza (el servidor corre dentro del juego), `registros/servidor.log` o la consola en el servidor dedicado.
9. **El cliente no debe bloquear:** la red es no bloqueante, y la conexión a un servidor remoto va en un hilo. La excepción es el servidor privado: al empezar una escaramuza, una batalla de campaña o una repetición, la escena espera unos instantes dentro del manejador del botón. No agregue llamadas bloqueantes en `actualizar` ni en `dibujar`.
10. **Coordenadas del cliente:** use la cámara (`Camara.a_pantalla` y `Camara.a_mapa`) y el lienzo (`logico_de`). Las pruebas `test_clics_con_la_ventana_agrandada` y `test_imagen_centrada_y_recortes_con_franjas` vigilan esto.
11. **Windows y macOS:** las rutas se arman con `rutas.py`, sin construirlas a mano; la CI prueba en los tres sistemas.
12. **Los yacimientos son las entidades 1 a N, en el orden del mapa.** `EstadoJuego.__init__` lo da por hecho para dibujarlos desde el comienzo, y se cumple porque `Mundo.__init__` crea los recursos antes que nada. Si crea otra entidad antes que ellos, el cliente se desordena.
13. **La rejilla espacial se reconstruye solo dos veces por tick** (pasos 4 y 8 de `Mundo.paso()`). Entre medio, `m.rejilla.cerca(...)` puede devolver unidades que murieron o se embarcaron en ese tick, y no ve las recién creadas. Compruebe siempre `vivo` y `dentro` en los resultados.

---

## 14. Frentes abiertos: oportunidades de mejora

Ordenadas por valor estimado. Cada una indica dónde atacar.

1. **Sanidad en los picos del combate.** Los heridos que mueren sin atención se deben a la **saturación** de equipos cuando caen muchos a la vez, no a equipos ociosos: un equipo libre sale en menos de 4 ticks.
   - Recogida medida (IA contra IA, Difícil, 0.12.1): Quebrada de Tarapacá 31 %, Morro de Arica 50 %, Pampa del Tamarugal 45 %.
   - Ideas:
     - triaje (no ir por quien no llega a tiempo si otro sí llega; hoy cambian de rumbo cada 16 ticks);
     - más equipos por ambulancia;
     - que los equipos del hospital de sangre se prioricen en su zona;
     - que el usuario vea la «cola de espera» de heridos.
   - Archivos: `sim/comportamiento.py` (`_buscar_caido`, `_a_tiempo`, `camilleros`), `datos/edificios.json` (`camilleros`) y `sim/edificios.py`.
   - El dueño del proyecto también habló de la **cantidad de heridos que un hospital puede tratar a la vez**, que hoy no tiene tope propio: solo lo limita la población. Una mejora posible son las **camas** (capacidad visible por hospital). Consulte antes de cambiar el diseño.
2. **Equilibrio entre naciones.** En las partidas IA contra IA corridas durante el desarrollo, Chile ganó todas. Mida con más partidas (IA contra IA, todos los mapas y todas las combinaciones) y ajuste `datos/`.
   - Sirve un guion que corra `Mundo` + `IA` sin red, como `test_determinismo`.
   - La tabla `partida_jugadores` del servidor guarda victorias por nación.
3. **IA**
   - Que la IA no vea a través de la niebla (§9): que `_blanco_enemigo` (y con él el reconocimiento y los desembarcos) use solo lo explorado o los edificios recordados, y que `_expandir` descarte solo los yacimientos cercanos a obras enemigas ya vistas.
   - Exploración activa.
   - Adaptación a la composición del rival (contrapesos de la tabla de multiplicadores).
   - Mejor uso de la ambulancia y de los hospitales de sangre en `_cuidar_veteranos`, que hoy mira solo el `hospital_campana`.
   - Retirada táctica para conservar veteranos.
4. **Rendimiento**
   - `Emisor.construir()` recorre **todas** las entidades por jugador en cada instantánea: O(entidades × jugadores). Bastaría con marcas de cambio por entidad.
   - Caminos jerárquicos (HPA\*) o campos de flujo para los grupos grandes.
   - La visión cada 4 ticks podría ser incremental.
5. **Calidad del código**
   - Módulos muy largos que conviene dividir sin cambiar el comportamiento: `comportamiento.py` (1 300 líneas), `mundo.py` (1 230), `servidor.py` (1 250) y `cliente/escenas/juego.py` (1 230).
   - No hay anotaciones de tipos: agregarlas en `sim/` ayudaría.
   - Haga los cambios grandes en pasos pequeños, con las pruebas en verde en cada paso.
6. **Hueco de la reparación gratis del hospital de sangre** (§13.4). Por ejemplo, cobrar la reparación con el costo de la ambulancia.
7. **Funciones pedidas en `docs/RECOMENDACIONES.md`**
   - TLS opcional en el servidor.
   - Editor de mapas.
   - Lista pública de servidores con emparejamiento por ELO.
   - Teclas configurables y paletas para daltonismo.
   - Más etapas de campaña (Pisagua, Lima: Chorrillos y Miraflores; la Breña: Huamachuco).
   - Partidas «históricas» sin la Argentina.
   - Límite de héroes simultáneos.
8. **Eventos que el cliente no muestra.** La simulación emite `mina`, `golpe`, `embarca`, `desembarca` y `fin`, que `Juego._evento` no atiende. Puede ser intencional; revise antes de agregar efectos.

---

## 15. Procedimiento operativo para el asistente

1. **Antes de cambiar:**
   - lea el módulo completo y sus pruebas;
   - ubique el cambio en la capa correcta: datos, simulación, red o cliente;
   - si toca la simulación, piense en el determinismo y en `PROTOCOLO`.
2. **Cambie lo mínimo** que pide la tarea, en el estilo del código vecino: español, nombres cortos, comentarios breves que expliquen el porqué y enteros en `sim/`.
3. **Pruebe:**
   - agregue o ajuste pruebas;
   - corra `pytest` y `pyflakes`;
   - si cambió datos, corra `generar_tablas.py`.
4. **Documente:** `README.md` (lo que ve el jugador), `docs/DISENO.md` (decisiones), `docs/ARQUITECTURA.md` (técnica) y esta guía si cambió algo estructural.
5. **Informe con franqueza** qué se probó y qué no, en particular lo que no pudo verificar: gráficos sin mirar, voces sin generar, rendimiento sin medir.

### Pedido sugerido para Gemini

> Lee `rts/GEMINI.md` y los módulos que nombra para la tarea. Luego propón un plan
> breve antes de escribir código: archivos a tocar, pruebas que agregarás y
> riesgos para el determinismo o la red. Respeta las reglas de la §2. Al terminar,
> entrega el diff y los resultados de `pytest` y `pyflakes`.
> Tarea: …
