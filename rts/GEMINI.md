# GEMINI.md — Guía del código de «Guerra del Pacífico: Salitre y Pólvora»

> **Para qué sirve este archivo.** Es el contexto que necesita un asistente de
> programación (Gemini u otro) para entender y mejorar el juego sin romperlo.
> Gemini CLI lo carga solo cuando trabaja en este repositorio; también se puede
> adjuntar o pegar en una conversación.
>
> Describe el código de la versión **0.13.0** (`salitre/__init__.py`:
> `VERSION = "0.13.0"`, `PROTOCOLO = 3`). Si el código y esta guía discrepan,
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
| **Tamaño** | Unas 21 200 líneas en `salitre/`: cliente 10 800, simulación 5 600, servidor 1 900, contenido 1 200, IA 1 000, red 580. Además, 2 500 líneas de pruebas y 2 000 de herramientas. |
| **Cómo se arranca** | `python -m salitre` abre el juego (opciones: `--conectar HOST[:PUERTO]`, `--nombre`, `--version`). `python -m salitre --servidor` arranca el servidor dedicado, con las opciones `--host 0.0.0.0 --puerto 47800 --nombre … --sin-invitados --sin-lan --bd ruta --detallado`; con `--local --padre PID` es el servidor privado del cliente 3D. |
| **Cliente 3D** | `rts/godot/`: un segundo cliente en **Godot 4.7** (GDScript, unas 7 000 líneas), en construcción por fases (§10.1). Usa el mismo servidor, protocolo y datos; se abre con `godot --path godot`. |
| **Pruebas** | `SDL_VIDEODRIVER=dummy SDL_AUDIODRIVER=dummy python -m pytest -q` corre 84 pruebas en unos 2,7 minutos (4 de ellas necesitan Godot y se omiten sin `SALITRE_GODOT`). La revisión estática es `python -m pyflakes salitre herramientas instalador docker tests`. |
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
- Armas: infantería, cantineras (curan), ingenieros dinamiteros, caballería, cañones que se **emplazan**, ametralladoras Gatling, espías, buques, **carretas de agua**, unidades propias de cada nación y **héroes** históricos. Cada héroe tiene un aura de mando y una habilidad (tecla Q).

**Terreno, combate y niebla**
- Hay **tres niveles de altura**. Desde abajo no se ve lo de arriba, y quien dispara cuesta arriba falla el 30 % de los tiros (los cañones con CEP no fallan: dispersan un 50 % más). Las **rampas** son los únicos accesos entre niveles.
- La **niebla de guerra** la calcula el servidor.
- **Guarniciones:** la infantería se guarece en trincheras, barracas y Cuartel General.
- **Cobertura:** la infantería detenida junto a rocas, ruinas o tamarugos recibe un 30 % menos de daño de la fusilería y la metralla.
- **Formaciones** de la infantería de fusil: línea, guerrilla y cuadro (tecla F).
- **Artillería con dispersión:** las granadas de los cañones caen alrededor del blanco según su error circular probable (CEP), que crece con la distancia y cuesta arriba, se reduce con un observador (espía o baqueano) y se corre con el **viento**.

**Agua y sed**
- La infantería y la caballería gastan la **cantimplora** al marchar o combatir en la pampa y el salar. Sin agua marchan más lento y tardan el doble en disparar; al rato sufren el **golpe de calor**.
- Beben junto al molino, al Cuartel General o a la **carreta de agua**, que acompaña a la tropa y rellena su pipa en molinos y cuarteles. A la sombra de un tamarugo (solo la infantería detenida) la sed baja un 70 %.

**Sanidad**
- Con un hospital en pie, el infante o el jinete que cae por fusil, metralla, sable o golpe de calor queda **herido** 40 s en el suelo.
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

2. **Determinismo absoluto.** La misma semilla con los mismos comandos debe dar la misma partida en cualquier equipo. De eso dependen las repeticiones y las pruebas `test_determinismo` y `test_repeticion_reproduce_partida` (que corren en un mapa de arena, sin calor) y `test_la_dispersion_de_la_artilleria_es_determinista` y `test_determinismo_con_sed_formaciones_y_artilleria` (las únicas que cubren la sed, las carretas, las formaciones y el CEP).
   - **El estado de la simulación es entero.** Algunos parámetros del catálogo son `float` (radio de visión, ritmo de regeneración); se convierten a enteros con `int(...)` al usarse. No acumule `float` en el estado.
   - **Azar:** solo con `self.azar` (`sim/azar.py`, xorshift64\*, sembrado con la semilla de la partida). La IA tiene su propio `Azar`. Prohibido usar `random`, `time` o `hash()` de cadenas dentro de `sim/` e `ia/`. El cliente sí usa `random`, pero solo para efectos visuales.
   - **Orden de iteración:** los `dict` se recorren en orden de inserción, y las entidades se crean con ids crecientes. Las búsquedas espaciales (`espacial.py`) recorren en un orden fijo: `Rejilla.cerca` va celda por celda y, dentro de cada celda, en el orden de `Mundo.unidades`; `RejillaEdificios.cerca` ordena por id. Use `set` solo para preguntar pertenencia, nunca para iterar algo que afecte el resultado.
   - Ojo: `test_determinismo` corre dos partidas **en el mismo proceso**, así que no detecta dependencias del `PYTHONHASHSEED`. Sea estricto por su cuenta.
   - Cada sorteo cuenta: la dispersión de la artillería sortea dos números por disparo y el viento sortea al comenzar y cada 45 s. Un sorteo nuevo o movido de lugar cambia todo lo que sigue (§13, trampa 14).

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
   | Agua de cantimploras y pipas | en 1/256 de punto (`AFP`) |

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
   - En las instantáneas y los eventos, el tipo de cada entidad viaja como `tipo.idx`, su posición en el catálogo: primero las unidades en el orden de `unidades.json`, luego los edificios en el orden de `edificios.json`. También van por índice los tipos de `g`, `c` y `pc`, el `extra.u` del herido y el código de formación (`extra.fo` y el evento `formacion`), que es el orden de las formaciones en `tablas.json → formaciones`. Las mejoras van por su orden en `mejoras.json`, pero solo en el evento `investigado`.
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
│   │   ├── constantes.py         TICKS, TILE, EFP, HFP, XPF, AFP, clases de entidad, capas TIERRA/AGUA
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
│   │   ├── combate.py            alcance, blancos, daño (formación y cobertura del blanco), explosiones,
│   │   │                         proyectiles, ventaja de altura
│   │   ├── balistica.py          dispersión de la artillería (CEP, Box-Muller en enteros), observador, viento
│   │   ├── logistica.py          sed, fatiga y golpe de calor; abastecimiento (molinos, cuartel, carretas)
│   │   ├── habilidades.py        habilidades activas (auras, curas, andanadas, minas, sabotaje,
│   │   │                         demolición, golpe, revelar, emplazar, desmontar)
│   │   ├── ruta.py               A* con presupuesto de nodos (Buscador), línea recta, suavizado
│   │   ├── mapa.py               Mapa: terreno, niveles, rampas, paso, ocupación, regiones conexas,
│   │   │                         cobertura (refugio y sombra) junto a rocas, ruinas y tamarugos
│   │   ├── vision.py             niebla por nivel con operaciones de bits; detección
│   │   ├── espacial.py           Rejilla (unidades) y RejillaEdificios para buscar vecinos
│   │   ├── jugador.py            Jugador: dinero, agua, población, mejoras, sanidad, estadísticas
│   │   ├── stats.py              Stats efectivas por tipo (catálogo + nación + mejoras + grado)
│   │   └── veterania.py          experiencia, ascensos, hoja de servicio, instrucción, encuadramiento
│   ├── ia/ia.py                  IA (fácil/normal/difícil): economía, obras, tropa, ataques,
│   │                             desembarcos, habilidades, veteranos, ambulancias, carretas, formaciones
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
├── godot/                        cliente 3D en Godot 4 (§10.1): project.godot, datos/catalogo.json (generado),
│                                 codigo/ (red, datos, batalla, mundo, ui), escenas/, sombreadores/, pruebas/
├── herramientas/                 generar_mapas.py, generar_tablas.py (→ docs/TABLAS.md), generar_icono.py,
│                                 generar_musica.py (numpy + soundfile), generar_voces.py (Kokoro-82M),
│                                 vista_mapa.py (PNG de cada mapa), exportar_godot.py (→ godot/datos/
│                                 catalogo.json), duelo_ia.py (IA contra IA sin red, con repetición)
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
   7. Llama a `comportamiento.actualizar(m, u)` para cada unidad viva que no esté `dentro` (embarcada, guarecida o en un molino). Al final de cada una, `_fin_tick` le pone la cobertura de su casilla (si es infantería detenida) y le aplica la sed (`logistica.sed`).
   8. Reconstruye la rejilla y separa las unidades superpuestas (`comportamiento.separar`).
   9. Resuelve los impactos de los proyectiles.
   10. Activa las minas (cada 2 ticks).
   11. Calcula las auras y reparte el agua (`logistica.abastecer`), cada 8 ticks.
   12. Cambia el viento cada `balistica.viento_cambio` ticks (45 s).
   13. Corre la instrucción de veteranía (una vez por segundo, en `tick % 16 == 8`).
   14. Desangra a los heridos (cada 4 ticks).
   15. Limpia los muertos con `_limpiar()`.
   16. Actualiza la visión (cada 4 ticks).
   17. Comprueba la victoria (cada 16 ticks) y vuelve a limpiar.
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
| `calor` | `bytes` con el calor de cada casilla (% del consumo de agua: pampa 100, salar 150, el resto 0), calculado al crear el mundo. |
| `viento` | `(rumbo, fuerza)`: rumbo de 0 a 15 hacia donde sopla (0 = este, 4 = sur) y fuerza de 0 a 100. |

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
| Pruebas | `suma_control()`: un hash que usan las pruebas de determinismo. Mezcla la posición y la vida de cada entidad, el agua, la fatiga, la pipa y el código de formación de cada unidad, los recursos de cada jugador y el viento (no la cobertura ni `calor_acum`). Todo estado nuevo de la simulación debe sumarse aquí, o las pruebas de determinismo no lo vigilan. |

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
| Agua y táctica | `agua` (cantimplora, en 1/`AFP`), `fatiga` (centésimas de tick al sol sin agua), `calor_acum` (vida fraccional del golpe de calor, en 1/`HFP`), `estanque` (pipa de la carreta, en 1/`AFP`), `formacion` (una `Formacion` del catálogo o `None`), `cobertura` (bits `COB_REFUGIO` y `COB_SOMBRA` de su casilla) |

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
{"c":"formacion","u":[ids],"f":"linea"|"guerrilla"|"cuadro"|"ninguna"}
{"c":"senal","x","y"}   {"c":"rendirse"}   {"c":"truco",...} (solo con Mundo.trucos)
```

- Límites: `MAX_SELECCION = 255` unidades por comando, `MAX_COLA = 16` órdenes encoladas por unidad, hasta 5 elementos en la cola de producción de cada edificio y `n` de 1 a 5 en `entrenar`.
- `_mover_grupo` reparte destinos en formación (`_formacion`, que no tiene relación con las formaciones tácticas de `c_formacion`) y calcula **un** camino para la unidad más cercana al centro del grupo. Las demás lo reutilizan desde el punto más avanzado que ven en línea recta.
- `puede_levantar(u, b)`: los trabajadores no levantan edificios con `desmonta_en` (el hospital de sangre); el constructor declarado sí.
- Las unidades `autonomo` (los camilleros) no reciben órdenes: `_propias` las filtra.
- `c_formacion` aplica la formación solo a los tipos con `forma_filas` (el resto de la selección la ignora) y responde con el evento `formacion` (código y cuántas formaron) o con `err` si nadie puede formar; un id de formación desconocido se ignora.
- La cantinera y la carreta de agua no combaten (`_sanitaria`): una orden de ataque las pone a **seguir** (`SEGUIR`) a la unidad armada más cercana de la misma orden (`_acompanar`); si van solas, se quedan y reciben un `err`.

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
- `velocidad(u, t)` es la velocidad efectiva de la marcha: suma la formación y, sin agua, la penalización de la sed (`sed.velocidad_pct`); el total no baja de −90 %.
- En `atacar`, la carga de la caballería no multiplica el golpe contra una unidad en una formación con `inmune_carga` (el cuadro).
- `_fin_tick(m, u, t)` cierra el tick de cada unidad: cuenta los ticks de marcha (para la carga) y de quietud (para el camuflaje), decide si está oculta, le pone la cobertura de su casilla (`tipo.cubre`, solo detenida) y le aplica la sed (`logistica.sed`).

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
  - El «cuadro» de los Colorados (pasiva) reduce siempre el daño de sable.
  - Contra una unidad, en este orden y multiplicando (no sumando): la pasiva `cuadro` contra el sable; × (100 + `recibido[tipo_ataque]`) / 100 por la formación del blanco; y, a cubierto (`COB_REFUGIO`) y contra los ataques de `cobertura.ataques`, × (100 − `cobertura.reduccion_pct`) / 100. Luego se resta la armadura. Ejemplo: la guerrilla (−35 % de fusil) a cubierto (−30 %) recibe el 65 % × 70 % = 45,5 % del daño.
  - `bonus_edificios` aumenta el daño contra obras.
  - `enfriamiento_unidad(u, t)`: la cadencia suma la formación; sin agua, el tiempo entre disparos crece `sed.enfriamiento_pct` (el doble). `danio_pct_unidad(u, t)` suma la formación al daño propio.
- **Altura:** desde un nivel más bajo se falla el 30 % (`fallo_por_altura`). Los grados altos reducen la falla (`veterania.fallo_altura`) y el efecto dinámico `ignora_altura` la anula. Las armas con `cep` no tienen esa falla: dispersan más (§5.14).
- **Disparos:** los instantáneos aplican el daño enseguida; los proyectiles lentos (`arma.proyectil`) viajan y pueden errar. Si el arma tiene `cep`, el punto de impacto sale de `balistica.punto_impacto`.
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

**Cobertura:** `Mapa.cobertura` (un `bytearray`, una celda por casilla) guarda los bits `COB_REFUGIO` y `COB_SOMBRA`; la llena `calcular_cobertura` al crear el mundo (§5.15). `CODIGO_TERRENO` traduce el nombre de un terreno a su código. El calor de cada casilla no está en el mapa sino en `Mundo.calor`.

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
- Para no repetir los avisos seguidos: `aviso_poblacion_t`, `aviso_ataque_t` y `avisos` (el último tick de cada aviso de la logística: `"sed"` y `"calor"`).

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

### 5.13 Agua, sed y abastecimiento (`logistica.py`)

**Quién tiene sed:** `tipo.sed` es la tabla `sed` del catálogo para las unidades biológicas de tierra que no son trabajadores, `autonomo` ni de una categoría excluida; para las demás es `None`.

**`sed(m, u, t)`**, al final de cada tick de la unidad (`_fin_tick`):
- toma el calor de la casilla (`m.calor`); a la sombra (`COB_SOMBRA`), solo `sombra_pct`. Solo la infantería detenida (`tipo.cubre`) tiene la cobertura y la sombra: la caballería con sed nunca está a la sombra;
- con agua: si marcha (`u.moviendo`) o disparó hace menos de `combate` ticks, gasta `consumo × calor / 100`; al quedar en 0 avisa con el evento `sed`;
- sin agua al calor: suma el calor a `fatiga` (hasta el doble del umbral) y, pasado `golpe_calor`, acumula `danio_calor` en `calor_acum` y quita vida (evento `calor`; respeta `inmortal`; si muere, `m.matar(u, 0, -1)`, así que con un hospital en pie queda herido);
- con agua, la fatiga baja `recuperacion` por tick.

**`abastecer(m)`**, cada 8 ticks:
1. Los edificios terminados con `abastece` (molino, Cuartel General) dan de beber a la tropa aliada a `radio` de su rectángulo y a su propia guarnición, y llenan las pipas de las carretas.
2. Cada carreta reparte su pipa a la tropa aliada con sed a `estanque_radio`, en orden `(agua, id)`, y le alivia la fatiga (`alivio`).

Los ritmos `abastece_tropa`, `abastece_pipa`, `estanque_reparto` y `alivio` están **por tick**: `abastecer` los multiplica por `logistica.PERIODO` (8), así que cada reparto da `estanque_reparto × 8` a cada soldado. Ese 8 debe coincidir con el `t % 8` de `Mundo.paso` (§13, trampa 17).

Los avisos `sed` y `calor` van solo al dueño, con un intervalo mínimo (`aviso`), y llevan la posición en píxeles.

### 5.14 Dispersión de la artillería y viento (`balistica.py`)

- `desvio(azar, cep)`: Box-Muller en enteros. `U1 = k/65536` con `k = azar.entero(65536) + 1`, `−log2(U1)` con `log2_q16` (cuadrados sucesivos, exacto), radio `cep · isqrt(−log2 U1 en 1/65536) >> 8`, es decir cep · √(−log2 U1), y ángulo `azar.entero(256)` con la tabla de senos `_CUARTO` (un cuarto de vuelta en 1/16384). La mitad de los tiros cae dentro de `cep`.
- `cep_efectivo(...)` = `arma.cep × dist / TILE`, × `(100 + altura_pct × fallo_altura / fallo_por_altura) / 100` si tira cuesta arriba (sin `ignora_altura`), × `observador_pct / 100` si `observado(...)` encuentra un observador aliado (`tipo.observador`: espía y baqueano) cerca del blanco.
- `nuevo_viento(m)`: al crear el mundo, rumbo al azar y fuerza entre 10 y 60; cada `viento_cambio` ticks, el rumbo se mueve −1, 0 o +1 y la fuerza hasta 15 (entre 0 y 100). `deriva(m, dist)` corre la granada `viento_max × fuerza × dist / (100 × TILE)` hacia el rumbo.
- `punto_impacto(...)` suma desvío y deriva al blanco, acotado al mapa. Cada disparo de una pieza con CEP **sortea dos números de `m.azar`**: agregar sorteos en otro lugar cambia toda la partida que sigue (es determinista, pero distinta).

### 5.15 Formaciones y cobertura

- `Formacion` (catálogo): `id`, `codigo` (1, 2, 3: viaja en la instantánea), `nombre`, `atajo`, `descripcion` (la ayuda del botón), `cadencia_pct`, `velocidad_pct`, `danio_pct`, `recibido` (por tipo de ataque) e `inmune_carga`. `cat.formaciones_codigo[codigo]` la busca por código (el 0 es `None`).
- `tipo.forma_filas` sale del filtro `formaciones.pueden` (infantería con fusil, sin héroes ni trabajadores). La guarnición (`dentro`) no aplica su formación.
- `Mapa.calcular_cobertura(refugio, sombra)` marca al crear el mundo la casilla de cada roca, ruina o tamarugo y sus 8 vecinas. `tipo.cubre` (infantería de tierra que no es trabajador ni `autonomo`) toma esos bits solo detenida.

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
| `estanque` | Pipa de agua `{capacidad, radio, reparto}` (carreta de agua): capacidad en puntos, radio en casillas y reparto por soldado y por segundo. |
| `arma` | También admite `alcance_min`, `salpicadura`, `proyectil` (velocidad) y `cep` (error circular probable por casilla de distancia; solo con `proyectil`). Su `objetivos` vale `tierra`, `agua` o `ambos`. |

**Pasivas** (`pasivas`): `detector`, `camuflaje`, `camuflaje_quieto`, `cuadro` (la pasiva de los Colorados contra el sable; no es la formación), `carga`, `bonus_edificios`, `no_adquiere` (no elige blancos sola), `autonomo` (camilleros), `observador: {radio}` (espía y baqueano: la artillería propia o aliada que tira contra un blanco a menos de `radio` casillas de ellos dispersa la mitad, `observador_pct`; no cuenta si está `dentro`) y `constructor: {edificios, velocidad}`.

**Valores de referencia**
- Clases de armadura: `infanteria`, `caballeria`, `artilleria`, `naval` y `edificio` (en `tablas.json → clases_armadura`).
- Tipos de ataque: `fusil`, `sable`, `metralla`, `explosivo`, `dinamita` y `canon_naval`.

**Ids actuales**
- Unidades comunes: `trabajador`, `infante`, `cantinera`, `camilleros`, `ambulancia`, `carreta_agua`, `ingeniero`, `granadero`, `cazador`, `artilleria_montana`, `canon_campana`, `gatling`, `espia`, `transporte`, `canonera`.
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
| `abastece` | Aguada `{radio, tropa, pipa}` (molino y Cuartel General): radio en casillas; agua por segundo a cada soldado y a cada pipa. |
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
- `sed`: `cantimplora`, `consumo`, `combate` (segundos tras un disparo que cuentan como combate), `calor` por terreno, `velocidad_pct` y `enfriamiento_pct` sin agua, `golpe_calor`, `danio_calor`, `recuperacion`, `alivio`, `sombra_pct`, `aviso` (segundos entre avisos) y `excluir_categorias`.
- `formaciones`: `pueden` (filtro de quién forma) y cada formación (`nombre`, `atajo`, `descripcion`, `cadencia_pct`, `velocidad_pct`, `danio_pct`, `recibido_pct` por tipo de ataque, `inmune_carga`). El orden de las formaciones fija su `codigo` en la instantánea: no lo cambie sin subir `PROTOCOLO`.
- `balistica`: `altura_pct`, `observador_pct`, `viento_max` (casillas por casilla de vuelo con fuerza 100) y `viento_cambio` (segundos).
- `cobertura`: `terrenos` que dan refugio, `sombra`, `ataques` que reduce, `reduccion_pct` y `clases` que se ponen a cubierto.

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

**Validaciones de la 0.13.0.** No están en `_validar` sino en los constructores:
- `Arma`: `cep` solo vale con `proyectil`.
- `TipoUnidad`: un `estanque` necesita capacidad y reparto positivos.
- `Sed`: `calor` solo admite nombres de terreno, de 0 a 255 %; `cantimplora`, `consumo` y `golpe_calor` deben ser positivos; `sombra_pct` va de 0 a 100.
- `Formacion`: `recibido_pct` solo admite tipos de ataque de los multiplicadores; `cadencia_pct` y `velocidad_pct` deben ser mayores que −100.
- `Cobertura`: `terrenos` y `sombra` solo admiten nombres de terreno, y `ataques` tipos de ataque; `reduccion_pct` va de 0 a 100.
- `abastece` no se valida.

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
| `OBRA` | 64 | `DESHIDRATADA` | 32768 |
| `PRODUCE` | 128 | `COBERTURA` | 65536 |
| `SABOTAJE` | 256 | `SOMBRA` | 131072 |

**Claves de `extra`**

| Quién la ve | Claves |
|---|---|
| Todos | Veteranos: `v` (grado), `vm` (vida máxima), `n` (semilla del nombre). Guarnición: `g` (tipos guarecidos), `gf` (los que acaban de disparar). Obra: `o` (% de avance). Desmontaje: `dm` (%). Formación: `fo` (código). |
| Solo el dueño | Unidades: `x` (% hacia el grado siguiente), `en` (energía), `c` (cargamento), `k` (abatidos), `cd` (esperas de habilidades), `pc` (convalecientes en el carro), `ag` (agua de la cantimplora, %; no va si está llena), `fa` (fatiga en % del umbral del golpe de calor, hasta 200; no va si es 0), `es` (pipa de la carreta, %). Los tres van de 5 en 5. Edificios: `q` (cola), `r` (punto de reunión), `oc` (ocupante), `gv` y `gid` (vida e ids de la guarnición). Hospitales: `cm` (equipos), `ce` (equipos máximos), `cmc` (equipos en el campo), `pc` (pacientes). |

**Mensaje:**
```
{"t": "inst", "k": tick, "e": [cambios], "q": [[id, "m"|"v"]], "ev": [[tick, tipo, ...]],
 "j": {d, a, p, pm, m, i, h, mi, vi}, "completa": 1}
```
- `e`, `q` y `ev` solo van si no están vacías.
- `q` lista lo que sale: `"m"` si murió, `"v"` si salió de la vista.
- `j` son los recursos del jugador: dinero, agua, población, población máxima, mejoras, investigaciones, héroes, minas y el viento (`vi`: `[rumbo, fuerza]`). Solo se envía cuando cambia la tupla `est` de `Emisor.construir`: **un campo nuevo de `j` debe agregarse también a esa tupla**, o no llegará cuando solo cambie él.
- `completa` va en la primera instantánea y tras una reconexión.
- Los espectadores reciben `js` (los recursos de todos los jugadores) y `vi` (el viento) en vez de `j`. Para ellos `registro()` recibe `propio=True`: lo que va bajo `if propio:` también lo ven los espectadores.

**Eventos de la simulación** (el segundo elemento de cada evento):
- Combate: `dis`, `pro`, `exp`, `mue`, `ata`.
- Sanidad: `herido`, `recogido`, `ingresa`, `recuperado`, `monta`, `desmontando`, `desmonta`.
- Veteranía: `ascenso`.
- Obras y producción: `obra`, `fin_obra`, `lista`, `investigado`, `repara`.
- Economía: `venta`, `agotado`, `pozo_agotado`, `pob`.
- Agua y táctica (solo al dueño): `sed` y `calor` (con la posición en píxeles), `formacion` (código y cuántas formaron).
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

**Servidor privado del cliente 3D** (`python -m salitre --servidor --local --puerto N --padre PID`, en `principal.py`): el mismo modo privado, pero como proceso aparte, porque el cliente de Godot no lleva Python adentro. Escucha en `127.0.0.1`, usa `local.db` y `minimo_registro = 0`, y la tarea `vigilar_padre` comprueba cada segundo con `proceso_vivo(pid)` que el juego siga corriendo (`os.kill(pid, 0)`; en Windows, `OpenProcess` + `WaitForSingleObject`): si terminó, el servidor se cierra.

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

**`_militar`** cuida a los veteranos (`_cuidar_veteranos` → comando `replegar`), ataca por oleadas que crecen con `incremento`, usa la ambulancia (`_ambulancias`), lleva las carretas de agua (`_carretas`), elige la formación de su infantería (`_formaciones`) y desembarca por mar (`_operacion_naval`).

**`DIFICULTADES`** fija para cada nivel: trabajadores, umbral de ataque, barracas, si investiga, si se expande, cuántas obras, si usa habilidades, cuántas `ambulancias` lleva (0, 1 o 2), cuántas `carretas` de agua (1, 1 o 2) y si usa `formaciones` (no en fácil).

**Carretas de agua** (`_carretas`)
- Se forman en el depósito si al menos el 10 % de las casillas pisables del mapa es pampa o salar (`calor_mapa`, calculado en `_preparar`) y el ejército tiene seis o más.
- Con la pipa por debajo del 25 % van a llenarla al molino o al Cuartel General más cercano, y no se van hasta tenerla al 95 % (`llenando`).
- Si hay ataque, se ubican tres casillas detrás del frente (`_frente`, `_detras`); si no, en el punto de reunión.

**Formaciones** (`_formaciones`): cuadro si hay caballería enemiga de carga **visible** a seis casillas o menos; línea si disparó en los últimos 3 s o tiene blanco; guerrilla si marcha o tiene orden; si no, ninguna. Agrupa los cambios en un comando `formacion` por formación.

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
- `viento`: `(rumbo, fuerza)`, que llega con `j.vi` (a los espectadores, con `vi`); el HUD lo dibuja en la barra superior (`HUD._viento`).

**`Vista`**
- Dibuja por profundidad: terreno por bloques de 16×16, edificios (las casas fuertes en capas: obra, tiradores, frente), tropas, heridos, efectos, niebla, galones y barras.
- Marca con una gota vacía a la tropa sin agua (`F_DESHIDRATADA`, la ven los dos bandos) y, en la selección propia, dibuja bajo la vida una barra celeste con el agua de la cantimplora o la pipa de la carreta (naranja con el 25 % o menos). Es la alternativa de la barra de energía: la cantinera, el espía y los héroes con energía muestran la energía, no el agua.
- `tarjeta(est, seleccion, submenu)` decide los botones (cuadrícula de 4×3) según la selección. La infantería que forma tiene el botón «Formación» (F, lugar 6) con el submenú `"formacion"` (L, G, C, N y Volver); `Boton.marcado` resalta la formación vigente.
- `HUD` dibuja la barra superior (con el viento: flecha hacia donde sopla y «Viento del O · 35», con su explicación al pasar el ratón), el minimapa, la selección, la hoja de servicio, el estado de la tropa (agua, fatiga, formación, cobertura y sombra; la pipa de la carreta) y la tarjeta.

**Gráficos procedurales**
- `Sprites.superficie(tipo, faccion, color, vista, frame, emplazada)` despacha según `tipo.sprite["forma"]` y `FORMA_TAM`: `pie`, `montado`, `artilleria`, `buque`, `camilla` o `carro` (la ambulancia y la carreta de agua tienen su propia función de dibujo).
- Las figuras se pintan al triple de tamaño y se reducen con suavizado.
- Para reemplazar un dibujo:
  - un PNG en `recursos/graficos/unidades/<id_unidad>.png` reemplaza a esa unidad;
  - `recursos/graficos/edificios/<id_edificio>.png` reemplaza a ese edificio.
- Los edificios están en `graficos/edificios.py`: `dibujar_edificio(tipo, nacion, color, capa)` despacha por `sprite.forma`.

**Sonido**
- Los efectos se sintetizan al iniciar.
- Las voces (`recursos/sonidos/voces/<clave>_<n>.ogg`) se cargan la primera vez que se dicen y tienen prioridades: selección < orden < aviso < alarma.
- `grupo_voz(tipo)` elige el grupo de voces de cada unidad: `seleccion_<grupo>`, `mover_<grupo>`, etc. (la carreta de agua tiene el grupo `carreta`). Al formarse, cada unidad dice `lista_<id>`. Los avisos `sed` y `calor` y las órdenes de formación (`formacion_<id>`) tienen sus voces.
- La música son dos pistas `.ogg`: `marcha` y `campana`.

**Datos del usuario** (en la carpeta de `rutas.dir_usuario()`)
- `config.json` (pantalla, sonido, controles).
- `perfil.db` (servidores recientes, escaramuzas y campañas).
- `local.db` (la base del servidor privado de escaramuzas, campaña y repeticiones) y `servidor.db` (la del servidor dedicado y la del servidor público dentro del juego).
- Carpetas `repeticiones/`, `registros/` (`cliente.log`, `servidor.log`), `capturas/` y `mapas/`. Los mapas propios de esa carpeta también aparecen en `mapas.listar()`.

### 10.1 Cliente 3D (`rts/godot`)

Proyecto de Godot 4.7 en GDScript que reemplaza solo la parte gráfica. Fases: 1) cabeza de puente: red, diorama, tropas, selección, órdenes, tarjeta, obras y escaramuza (**hecha**); 2) figuras agrupadas y animadas, guarnición a la vista, marcas de estado, efectos, niebla suave y minimapa (**hecha**); 3) toda la interfaz: menús, campaña, multijugador, archivo y sonido; 4) ejecutables con el servidor adentro. El cliente de pygame sigue siendo el oficial hasta la paridad: **todo cambio de reglas va en Python**, y el cliente 3D solo lo dibuja.

**Arranque.** `Juego` (autocarga, `codigo/juego.gd`) carga `datos/catalogo.json`, las fuentes de `rts/recursos/fuentes/` y el tema. `escenas/menu.tscn` arma el diorama de fondo y la escaramuza; al comenzar, `ServidorLocal.iniciar` lanza el servidor privado (`SALITRE_SERVIDOR` o el `ServidorSalitre` empaquetado; si no, `python -m salitre` con `PYTHONPATH=rts/` y el intérprete de `SALITRE_PYTHON`, `python3`/`python` o, en Windows, `python`/`py -3`), reintenta la conexión, saluda (`hola` con la huella del catálogo), pide `partida_rapida` (o `ver_repeticion`) y con `inicio` pasa a `escenas/batalla.tscn`. Argumentos (después de `--`): `--prueba-humo`, `--mapa=`, `--repeticion=`, `--captura=`, `--captura-en=`.

**Batalla** (`codigo/batalla/batalla.gd`), cada cuadro: mensajes de la red → `Estado.aplicar` → interpolación → niebla (`Estado.actualizar_vision`, como mucho 5 veces por segundo, subida al terreno con `Terreno.actualizar_niebla`) → eventos (`_evento`, puerto del de `escenas/juego.py`) → tarjeta (`Tarjeta.tarjeta`, puerto de `juego/tarjeta.py`, con los botones como diccionarios) → cámara → `Tropas.actualizar` → fantasma de la obra → `Hud.actualizar`.

**Coordenadas.** Una casilla = 1 unidad del mundo; x = px / 32 al este, z = py / 32 al sur; las órdenes viajan en píxeles del juego (`int(p.x * 32)`). Cada nivel sube `Terreno.NIVEL` (0,8). Las unidades miran a +X y giran `-dir · 45°`. La cámara mira desde el sur (giro 0).

**Piezas**
- `Terreno`: alturas por esquina (rampas alisadas, lomas de roca, quebradas hundidas, mar bajo `NIVEL_AGUA`), paredes entre casillas desparejas, base y marco del diorama, decorados con `MultiMesh`, `altura_en(x, z)` e `interseccion(origen, dir)` (el rayo del ratón).
- `Modelos`: `Constructor` arma mallas con caras planas, color en los vértices y, en `CUSTOM0`, la parte animada y su pivote (`animar(P_..., pivote)`; constantes `P_PIERNA_I` … `P_SABLE`, las mismas que usa `modelo.gdshader`); `_copiar` lleva los pivotes al lugar nuevo. `unidad()` (con `extra` «herido» o «sin_peana»), `edificio()`, `andamio()`, `salitre()`, `pozo()`, `convoy()`, `caido()`, `anillo_seleccion(color, figura)`, `marca_formacion()`, `galones()`, `gota()` y `puestos_guarnicion(forma)`, en caché por forma, nación y color. Un solo `ShaderMaterial` (`modelo.gdshader`) para todos. `escala(tipo)` agranda la tropa (×1,45) dentro del radio de la simulación.
- `Tropas`: las tropas y los convoyes, en grupos de `MultiMesh` (`Grupo`: uno por malla, se vuelve a llenar en cada cuadro con 20 números por figura: transformación, color blanco y `INSTANCE_CUSTOM` = fase de la marcha, paso, acción, resaltado); las obras, yacimientos, minas y heridos, como nodos sueltos que se vuelven a vestir cuando cambia `_clave(e)`; la guarnición en sus puestos, los anillos según la formación, las marcas de la infantería formada, los galones y la gota; `radio()`, `alto()` y `punto()`.
- `Efectos`: pólvora negra (nubes de bordes suaves que miran a la cámara), granadas en vuelo, explosiones, piques en el agua, polvo, bajas que caen, sangre, marcas de las órdenes, letreros y los de ambiente (chimeneas, obras dañadas, polvo de la marcha, estelas, remolinos), llevados por el viento; a lo sumo 900 vivos.
- `Minimapa` (`ui/minimapa.gd`): terreno, niebla, obras, tropas, la vista de la cámara y los avisos; señales `centrar` y `orden`.
- `CamaraRTS`: deslizar, acercar (más cerca, más rasante), girar (Ctrl+rueda, Ctrl+flechas; Inicio vuelve al norte), `rayo(pantalla)` y `a_pantalla(punto)`.
- `Hud` (`CanvasLayer`): franja superior, parte de la selección, tarjeta de 4×3 con su ayuda, avisos, lienzo (barras de vida, recuadro, punto de reunión) y carteles (fin, menú).

**Pruebas** (§12): `godot/pruebas/correr.gd` (sin pantalla) y `tests/test_godot.py`. `godot/pruebas/vitrina.gd` arma una vitrina con las tropas, las obras o el mapa y guarda una captura (necesita pantalla: Xvfb con `--rendering-method gl_compatibility` sirve).

---

## 11. Recetas de campaña: cómo hacer los cambios frecuentes

**Ajustar el equilibrio (solo datos)**
1. Cambie los números en `datos/*.json`.
2. Corra `python -m pytest -q`.
3. Corra `python herramientas/generar_tablas.py` para regenerar `docs/TABLAS.md`. Es un paso **manual**: ninguna prueba lo comprueba.
4. Corra `python herramientas/exportar_godot.py` para el catálogo del cliente 3D. Este sí lo vigila una prueba (`test_catalogo_de_godot_al_dia`): con datos nuevos y el catálogo viejo, el servidor rechazaría al cliente 3D por la huella.
5. Recuerde que el cambio altera la huella: servidor y jugadores deben actualizarse juntos.

Dónde está cada perilla de la 0.13.0: la sed, las formaciones, la dispersión y la cobertura, en `tablas.json` (`sed`, `formaciones`, `balistica`, `cobertura`); el CEP de cada pieza, en su `arma.cep`; la pipa de la carreta, en su `estanque`; las aguadas, en el `abastece` de cada edificio; los observadores, en la pasiva `observador`. Otras perillas están en el código: la fuerza inicial del viento (10 a 60) y su cambio (rumbo ±1, fuerza ±15) en `balistica.nuevo_viento`; la vecindad de la cobertura (la casilla y sus 8 vecinas) en `Mapa.calcular_cobertura`; el tope de −90 % de la velocidad en `comportamiento.velocidad`; el período del reparto del agua (`logistica.PERIODO`); y los umbrales de la IA (10 % de calor y 6 soldados para formar carretas, 25 % y 95 % de la pipa, 3 casillas tras el frente, 6 casillas y 3 s en `_formaciones`).

Para medir el efecto, deje a la IA contra la IA sin red, como en `test_determinismo`, pero **en los mapas oficiales**: `test_determinismo` corre en arena, donde no hay sed y la IA no forma carretas. Los mapas oficiales tienen entre un 20 % (Islas de Chincha) y un 42 % de terreno con calor. Cuente el agua de la tropa, las formaciones y las bajas.

**Agregar una formación**
1. Agréguela **al final** de `tablas.json → formaciones` (el orden fija su `codigo` en la instantánea; §6.4), con `nombre`, `atajo`, `descripcion` y sus efectos. El submenú de la tarjeta (`tarjeta._formaciones`) la muestra sola.
2. Su ícono va en `graficos/iconos.py:icono_orden("formacion_<id>")` y su voz en `herramientas/generar_voces.py` (`formacion_<id>`, que dice `Juego._evento` al recibir el evento `formacion`).
3. El atajo no puede ser `N` (Sin formación), `F` ni Esc. Sin rama propia en `icono_orden` sale el círculo de reserva, y sin voz `sonido.voz` calla sin error: ninguna prueba lo detecta.
4. Actualice `test_formaciones_sed_carreta_y_viento_en_el_cliente` (`tests/test_cliente.py`), que compara la lista exacta de botones del submenú.
5. Si la IA debe usarla, edite `IA._formaciones`. Escriba una prueba en `tests/test_simulacion.py`.

**Agregar una unidad**
1. Escriba la entrada en `datos/unidades.json`, sin reordenar las existentes (§2.5). Agréguela al `produce` de su edificio y a `facciones.json`: en `_comunes.unidades` si es común, o en las `unidades` de su nación si es propia.
2. Dibujo: use una `sprite.forma` existente; o cree una nueva en `cliente/graficos/sprites.py` (agregue la forma a `FORMA_TAM` y la función de dibujo en `Sprites.superficie`); o ponga un PNG en `recursos/graficos/unidades/`. En el cliente 3D, una forma nueva se dibuja como infante hasta que se agregue su rama en `godot/codigo/mundo/modelos.gd` (`unidad()`, y `escala`, `Tropas.radio` y `Tropas.alto` si es un carro, una pieza o un jinete); corra `python herramientas/exportar_godot.py`.
3. Voces: la prueba `test_voces_de_la_tropa` **exige** que exista `lista_<id>` para toda unidad formable, y `seleccion_<grupo>` y `mover_<grupo>` para su grupo de voces.
   - Para generarlas, agregue las frases en `herramientas/generar_voces.py` (`FRASES`) y corra el script. Necesita `kokoro-onnx`, `soundfile` y los archivos del modelo; están en el comentario inicial del script.
   - Si no puede generarlas, no borre la prueba: dígalo y pida que las generen.
4. Si la IA debe usarla, edite `ia/ia.py` (`_produccion` o `_eleccion_barracas`).
5. Escriba una prueba en `tests/test_simulacion.py`, regenere las tablas y actualice `README.md` y `docs/DISENO.md`.

**Agregar un edificio**
1. Escriba la entrada en `datos/edificios.json`: `tamano`, `menu` y `atajo` libre dentro de su menú.
2. Agréguelo a `facciones.json`.
3. Dibújelo en `cliente/graficos/edificios.py` (`dibujar_edificio`, según `sprite.forma`) y, para el cliente 3D, en `godot/codigo/mundo/modelos.gd` (`_obra`, según la forma; sin rama propia sale una casa genérica de su planta).
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
1. Suba `VERSION` en `salitre/__init__.py` (y `PROTOCOLO` si cambió el formato de la red).
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

**Las 84 pruebas, por archivo**

| Archivo | Qué cubre |
|---|---|
| `test_simulacion.py` | Economía, obras, combate, curación, auras, habilidades, minas, artillería, altura, transporte, trincheras, guarniciones, veteranía, heridos y camilleros (caminos por tramos, islas, puestos), ambulancia, instrucción, veteranos que llegan con el cuartel, retirada, llegada en tren o carreta, sed y golpe de calor, carreta de agua, guarnición que bebe en el cuartel, formaciones (y el cuadro contra la carga), dispersión de la artillería en enteros y su determinismo, cobertura, determinismo y repeticiones. |
| `test_contenido.py` | Catálogo, reglas de población, héroes por nación, mapas oficiales y campaña. |
| `test_red.py` | Protocolo, huella, cuentas, partida de dos jugadores por TCP con ELO, escaramuza y reconexión, veteranos de la campaña y serie de campaña en red. |
| `test_cliente.py` | Todas las pantallas, escaramuza, ambulancia en el cliente, formaciones, sed, carreta y viento en el cliente, volumen, casas fuertes, campaña, multijugador completo, clics con la ventana agrandada (eventos nativos de SDL), uniformes, voces, cámara por el borde. |
| `test_empaquetado.py` | Ícono de macOS. |
| `test_godot.py` | Cliente 3D: el catálogo de Godot al día y en el orden de la red, el servidor privado que se cierra con el juego; con `SALITRE_GODOT`, las 241 comprobaciones de `godot/pruebas/correr.gd`, la niebla de Godot comparada casilla por casilla con `sim/vision.py`, una batalla IA contra IA (`herramientas/duelo_ia.py`) vista como espectador sin errores de guion, y la prueba de humo de punta a punta (menú, servidor privado, escaramuza, marcha, minimapa, formar y cancelar, depósito en obra). |

**Ayudas para escribir pruebas** (`tests/utilidades.py`)
- `cat()` carga el catálogo.
- `mapa_llano(ancho, alto, jugadores, extra=fn, agua_filas)` crea un mapa de ensayo; `extra(d)` permite modificar el diccionario del mapa.
- `mundo(mapa, facciones, semilla, equipos, ia, registrar)` crea un mundo con `trucos=True`.
- `avanzar(m, ticks)` avanza la simulación.
- `de(m, p, tipo)` devuelve las entidades vivas de un tipo.
- `px(sub)` convierte subunidades a píxeles.
- En `test_simulacion.py`, `_unidad(m, p, tipo, tx, ty)` crea una unidad en el centro de una casilla y le suma su población, y `_de_terreno(caracter, marcas)` crea un mapa de un solo terreno (`","` pampa, `":"` salar…) con algunas casillas marcadas (rocas, tamarugos): sirve para las pruebas de sed y de cobertura.

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

**Cliente 3D**
```sh
SALITRE_GODOT=/ruta/Godot_v4.7.2-stable_linux.x86_64 python -m pytest -v tests/test_godot.py
godot --headless --path godot -s res://pruebas/correr.gd      # solo las pruebas del cliente
godot --path godot -- --prueba-humo --captura=/tmp/batalla.png  # la prueba de humo, con una imagen
python herramientas/duelo_ia.py --nombre duelo && godot --path godot -- --repeticion=duelo
```
Un error de sintaxis o de tipos de GDScript aparece recién al cargar el guion (§13, trampa 19): después de tocar el cliente 3D, corra al menos la prueba de humo.

**Integración continua**
- Cada push a cualquier rama que toque `rts/**` corre las pruebas en tres sistemas operativos, prueba el cliente 3D con Godot 4.7.2 en Linux (y guarda una captura de la batalla dibujada por software como artefacto `captura-cliente-godot`) y construye el instalador de Windows (con prueba de humo `--prueba-humo` del `.exe`), la `.app`/`.dmg`, la versión portátil de Linux y la imagen Docker (probada con `docker/probar_servidor.py`).
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
14. **El azar de la partida es uno solo.** Cada disparo de una pieza con CEP sortea dos números de `m.azar`, y el viento sortea al comenzar y cada 45 s. Un sorteo nuevo, o uno que cambie de lugar, cambia todo lo que sigue: la partida sigue siendo determinista (las pruebas pasan), pero es otra. Por la misma razón, un cambio de código de la simulación con los mismos datos deja la misma huella y, sin embargo, las repeticiones grabadas antes ya no se reproducen igual: suba `VERSION` (la escena de repeticiones avisa si difiere).
15. **El agua, la fatiga y la pipa viajan redondeadas de 5 en 5 % y solo al dueño** (`ag`, `fa`, `es`): el cliente las muestra, pero no debe decidir nada con ellas.
16. **`Mundo.calor` y `Mapa.cobertura` se calculan al crear el mundo.** Si alguna vez el terreno cambia durante la partida, habrá que recalcularlos. El `Mapa` del cliente de pygame no la calcula (la tiene en ceros): para dibujar el refugio o la sombra en el cliente, calcúlela allí con `cat.cobertura`. Hoy el cliente solo lee las banderas `F_COBERTURA` y `F_SOMBRA`.
17. **El agua se reparte cada 8 ticks.** `logistica.PERIODO` (8) multiplica los ritmos por tick de las aguadas y las carretas, y debe coincidir con el `t % 8` de `Mundo.paso`: si cambia uno, cambie el otro.
18. **La carreta de agua es clase `artilleria` y categoría `logistica`**, con `no_adquiere`. No es biológica: no tiene sed, no queda herida, no ofrece «Replegar» y recibe los multiplicadores de daño de la artillería.
19. **GDScript infiere tipos al compilar el guion, no antes.** `var x := e.vida` falla («Cannot infer the type») si `e` no tiene tipo (las entidades del espejo, `est`, `cat`, los valores de diccionarios): escriba el tipo (`var x: int = …`). El error solo aparece al cargar ese guion, y la escena queda vacía sin otra queja: corra la prueba de humo. `--check-only` no sirve para los guiones que usan la autocarga `Juego` (la da por inexistente).
20. **Godot toma como cara visible la de vértices en sentido horario.** `Modelos.Constructor.cara` orienta cada polígono solo (hacia afuera de un punto interior); en las mallas armadas a mano (`Terreno._quad`, `_pared`) el orden importa.
21. **El JSON llega a GDScript con todos los números como `float`.** Convierta con `int()` los ids, los índices de tipo y las banderas antes de compararlos o de usarlos como claves.
22. **Los radios de la niebla se redondean como en Python** (los empates van al par): `Vision.redondear_par` en el cliente 3D. Con el `round()` de GDScript, un radio de 3,25 marcaría un círculo distinto del del servidor.
23. **No use `class_name` en el cliente 3D.** Los guiones se cargan con `preload` en constantes, así el proyecto corre sin pasar por el editor (la CI solo hace `--import`).
24. **`MultiMesh` con datos propios necesita también el color de la instancia.** En el dibujo de compatibilidad (OpenGL), `use_custom_data` sin `use_colors` pisa el color de los vértices (las figuras salen verdes). `Tropas.Grupo` activa los dos y manda el color en blanco: el búfer lleva 12 + 4 + 4 números por figura.
25. **Sin pantalla (`--headless`) el servidor de dibujo no guarda nada:** `MultiMesh.get_instance_transform` y compañía devuelven ceros. Las pruebas leen lo que se subió (`Grupo.ultimo`).

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
   - La 0.13.0 sumó la sed, las formaciones, la dispersión de la artillería y la cobertura, calibradas con pocas partidas IA contra IA (el consumo de agua se duplicó a 1 por segundo porque a 0,5 la sed casi no pesaba). Mida su efecto con más partidas y ajuste `tablas.json` (`sed`, `formaciones`, `balistica`, `cobertura`).
3. **IA**
   - Que la IA no vea a través de la niebla (§9): que `_blanco_enemigo` (y con él el reconocimiento y los desembarcos) use solo lo explorado o los edificios recordados, y que `_expandir` descarte solo los yacimientos cercanos a obras enemigas ya vistas.
   - Exploración activa.
   - Adaptación a la composición del rival (contrapesos de la tabla de multiplicadores).
   - Mejor uso de la ambulancia y de los hospitales de sangre en `_cuidar_veteranos`, que hoy mira solo el `hospital_campana`.
   - Retirada táctica para conservar veteranos.
   - Escoltar las carretas de agua (hoy van solas tras el frente), buscar la sombra y la cobertura al detenerse y adelantar un observador (espía o baqueano) a menos de 6 casillas de los blancos de la artillería.
4. **Rendimiento**
   - `Emisor.construir()` recorre **todas** las entidades por jugador en cada instantánea: O(entidades × jugadores). Bastaría con marcas de cambio por entidad.
   - Caminos jerárquicos (HPA\*) o campos de flujo para los grupos grandes.
   - La visión cada 4 ticks podría ser incremental.
5. **Calidad del código**
   - Módulos muy largos que conviene dividir sin cambiar el comportamiento: `comportamiento.py` (1 330 líneas), `mundo.py` (1 250), `servidor.py` (1 250) y `cliente/escenas/juego.py` (1 250).
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
9. **Formaciones a la vista.** Hoy la formación solo se lee en la ficha (y en el submenú). Dibujarla sobre el terreno (las filas de la línea, el cuadro) ayudaría a leer la batalla; lo mismo la cobertura y la sombra, que el cliente tendría que calcular (§13, trampa 16). Archivos: `cliente/juego/vista.py` y `cliente/graficos/`.
10. **Cliente 3D, fases 3 y 4** (§10.1): toda la interfaz (menús, campaña, multijugador, archivo, opciones y sonido) y los ejecutables con el servidor adentro. Rendimiento: con dibujo por software (llvmpipe) la batalla anda a 3 cuadros por segundo con 180 figuras aunque las figuras ya van agrupadas: lo que pesa es la sombra del sol (mapa de 4096×4096) y el sombreador del terreno a 1280×720; con tarjeta de video no pesa. Una opción de calidad (sombras, desenfoque de la niebla, texturas del suelo) ayudaría en equipos modestos.
11. **Dispersión de los cañones navales y de la Gatling.** Solo los cañones de montaña y de campaña tienen `cep`. Los buques podrían dispersar con el balanceo: como sus cañones tienen `proyectil`, basta con agregarles `cep`. La Gatling dispara al instante (metralla, sin `proyectil`): solo con `cep`, el catálogo no carga; habría que darle `proyectil`, que cambia su fuego, o dispersar los tiros instantáneos en `combate.disparar`.

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
