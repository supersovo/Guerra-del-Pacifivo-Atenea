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

Cada instalación trae **dos clientes** y el servidor dedicado, sin necesidad de
instalar Python:

- **El juego** (el **cliente 3D**, hecho con [Godot 4](https://godotengine.org)):
  el campo de batalla es un diorama sobre la mesa de guerra, con relieve, luz
  del sol y sombras, y las tropas y las obras modeladas en 3D. Pide una tarjeta
  de video compatible con Vulkan, Direct3D 12, Metal u OpenGL 3.3.
- **La versión clásica**, dibujada en dos dimensiones (pygame), más liviana: para
  los equipos sin tarjeta de video. Se abre con el botón *Versión clásica (2D)*
  de la portada del cliente 3D (o con su propio acceso en Windows y Linux).

Los dos usan el mismo servidor y los mismos datos, y juegan juntos en red; las
repeticiones y los mapas propios son los mismos, mientras que la campaña y las
opciones de cada uno van por separado.

**Windows.** Ejecute `GuerraDelPacifico-<versión>-Instalador.exe`. El instalador
crea en el menú de inicio los accesos «Guerra del Pacífico» (el cliente 3D),
«Guerra del Pacífico (versión clásica)» y «Servidor dedicado» y, si se marca la
opción, permite el juego en red en el cortafuegos de Windows. También hay una
versión portátil que se descomprime y se usa sin instalar (en la carpeta,
`GuerraDelPacifico.exe` es el cliente 3D y `GuerraDelPacificoClasico.exe` la
versión clásica). Ambas se generan en GitHub Actions (pestaña *Actions* → flujo
«RTS Salitre y Pólvora» → última ejecución → artefactos `instalador-windows` y
`portatil-windows`; hay que iniciar sesión en GitHub para descargarlos) o en una
versión publicada.

**macOS** (Mac con procesador Intel y macOS 11 o posterior, o con Apple Silicon y
macOS 13 o posterior). Abra `GuerraDelPacifico-<versión>-macOS.dmg` y arrastre
*Guerra del Pacífico* sobre *Aplicaciones*: una sola aplicación con los dos
clientes y el servidor. La aplicación no está registrada ante Apple, así que la
primera vez macOS no la deja abrir: en macOS 15 o posterior, después del primer
intento vaya a *Ajustes del Sistema → Privacidad y seguridad* y pulse *Abrir
igualmente*; en macOS 14 o anterior, clic derecho sobre la aplicación → *Abrir*.
Si pregunta por la red local, permítala: así encuentra las partidas de los
compañeros. Se genera en GitHub Actions (artefacto `aplicacion-macos`), donde se
prueba en el macOS más reciente, también la parte para Intel.

**Linux.** Descomprima `GuerraDelPacifico-<versión>-linux.tar.gz` y ejecute
`GuerraDelPacifico/GuerraDelPacifico` (el cliente 3D) o
`GuerraDelPacifico/GuerraDelPacificoClasico` (la versión clásica).

**Copia en el repositorio.** El instalador de Windows, la aplicación para macOS
y la versión para Linux también pueden guardarse en
[`rts/descargas/`](descargas/LEEME.md), desde donde se bajan con PowerShell o
con la Terminal sin pasar por el navegador.

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
python -m salitre                 # la versión clásica
python -m salitre --servidor      # el servidor dedicado (no necesita pygame)
```

**El cliente 3D** está en `rts/godot/`. Las tropas marchan, apuntan y hacen
fuego, los jinetes galopan, las ruedas giran, las banderas ondean, las bajas
caen; la guarnición se ve en la trinchera y en las azoteas, hay minimapa, la
niebla de guerra tiene bordes suaves y lo explorado queda en sepia, como un
mapa viejo. Tiene **toda la interfaz** del juego, sobre el diorama de la pampa:
Campaña del Salitre con su escalafón, escaramuza contra la IA, multijugador (red
local, Internet o un servidor creado en el propio equipo, con salón, salas,
series de campaña y conversación), repeticiones, Archivo histórico (con un
retrato 3D de cada unidad y cada obra, y el desfile de cada nación), opciones
(también la calidad gráfica), parte de guerra, la música, las voces de la tropa
y los efectos de sonido. Usa el mismo servidor, la misma simulación, la misma IA
y los mismos datos que la versión clásica; guarda su configuración y su perfil
en `config_3d.json` y `perfil_3d.json` (la primera vez toma el nombre, los
volúmenes y las preferencias de la versión clásica). Desde el código fuente
hacen falta Godot 4.7 (o más nuevo) y Python 3.11:

```sh
cd rts
godot --path godot                               # o abra godot/project.godot en el editor y pulse F5
godot --path godot -- --repeticion=NOMBRE        # ver una repetición guardada
```

El cliente 3D lanza por su cuenta el servidor del juego: instalado, el
`ServidorSalitre` que viaja con él; desde el código fuente, `python -m salitre
--servidor --local` con el Python del sistema (`python3`; en Windows, `python`
o `py`; para usar otro, indíquelo en la variable `SALITRE_PYTHON`). Ese
servidor escucha solo en el propio equipo y se cierra junto con el juego.

Los datos de cada jugador (configuración, perfil, repeticiones, capturas y
registros) se guardan en `%APPDATA%\GuerraDelPacifico` en Windows, en
`~/Library/Application Support/GuerraDelPacifico` en macOS y en
`~/.local/share/guerra-del-pacifico` en Linux; no se borran al desinstalar.

## Cómo se juega

### Economía

| Recurso | De dónde sale | Para qué |
|---------|---------------|----------|
| **Salitre** (mineral principal) | Calicheras: los trabajadores extraen 5 por viaje | Se **vende en el Cuartel General** al entregarlo, 1 × 1 por dinero: sobre el techo sale un **$ dorado** |
| **Dinero** | La venta del salitre (se empieza con $ 100) | Formar tropas, construir e investigar: todo cuesta dinero |
| **Agua** (como el gas de *StarCraft*) | Pozos: hay que levantar un **molino de agua** encima; 6 por viaje | Caballería, artillería, héroes, investigaciones |

- **El Cuartel General llega a la campaña**: al empezar el campo está vacío y a
  los diez segundos el cuartel llega **en tren**, por un ramal del ferrocarril
  salitrero (Pampa del Tamarugal, Alto de la Alianza y Cuatro Naciones), o **en
  carreta** por el camino en los mapas campales. Se despliega con los seis
  primeros **trabajadores chinos**, que salen solos a las calicheras; el convoy
  se vuelve por donde vino.
- Los trabajadores recolectan y construyen. Cada **pozo** muestra con una barra
  y una cifra el agua que le queda.
- La **población** limita el ejército: el Cuartel General y cada **Depósito de
  Intendencia** dan 10 (el Fortín argentino, 5), hasta un máximo de **200**.
- Costo en población: trabajador, infante y cantinera **1**; ingeniero y
  carreta de agua **2**; ambulancia **3**; caballería **5**; artillería y
  ametralladoras **10**; héroes 4.

### Árbol de edificios

```
Cuartel General ── Barracas ─┬─ Hospital de campaña (cantineras, ambulancias)
   │                         ├─ Trinchera
   │                         └─ Barracón de Instrucción ── Caballeriza ── Central de Telégrafos ─┬─ Estado Mayor (héroes, espías)
   │                                                                                            └─ Parque de Artillería*
   ├─ Depósito de Intendencia (+10 de población; carretas de agua, con un molino en pie)
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
- **Ambulancia** (hospital de campaña): carro sanitario tirado por mulas que
  sigue a la tropa y **monta un hospital de sangre** junto al combate. No combate.
- **Carreta de agua** (depósito de intendencia, requiere un molino): lleva una
  pipa de 2000 de agua detrás de la columna y **da de beber** a la tropa que la
  rodea. No combate.
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
- **Uniformes por arma**: el infante, el zapador (quepí azul, mandil de cuero y
  zapapico), el dinamitero (blusa de brin y canana de cartuchos), el torpedista
  (de marinero), el granadero (morrión y caballo morcillo) y el cazador (dolmán
  con alamares y caballo alazán) se distinguen de un vistazo, con los colores de
  cada nación. Detalle en [docs/DISENO.md](docs/DISENO.md).
- La **cantinera** solo atiende a la tropa propia: aunque se le ordene atacar, no
  va hacia el enemigo.

### Guarniciones

Con la infantería seleccionada, clic derecho sobre una **trinchera**, unas
**barracas** o el **Cuartel General** propios para guarecerla:

| Obra | Plazas | Alcance extra | Cómo se ve |
|------|--------|---------------|------------|
| Trinchera | 4 | +1 | Cabezas, hombros y fusiles asoman sobre los sacos |
| Barracas | 6 | +2 | Casa fuerte de adobe: tiradores en la **azotea**, tras el **parapeto almenado**, y en las **ventanas** de la fachada |
| Cuartel General | 8 | +2 | Ídem, en dos pisos y con un centinela en el **torreón** de la bandera |

En las casas fuertes los tiradores se mueven como en un combate real: el de la
azotea espera a cubierto tras un merlón, sale a la **tronera** del lado del
enemigo, dispara y vuelve a cubrirse para recargar; el de la ventana se asoma
al disparar (se ve el cañón del fusil) y se retira a la penumbra. Si el
enemigo ataca por detrás, el fuego sale por las aspilleras del fondo. Desde la
azotea se dispara con la ventaja de la altura.

La tarjeta del edificio muestra el retrato de cada soldado guarecido (clic sobre
uno para que baje) y el botón «Salir de la trinchera» o «Desalojar».

### Heridos, camilleros y sangre

- Con un **hospital de campaña** (o un hospital de sangre) en pie, el infante o
  el jinete que cae por fusil, metralla o sable queda **herido** en el suelo 40
  segundos. Cada hospital de campaña mantiene **cuatro equipos de camilleros**,
  que salen solos a buscar a los heridos **por todo el campo de batalla**: va el
  equipo libre que esté más cerca, recoge primero a los que alcanza a salvar (y
  entre ellos a los veteranos de más grado) y lleva al herido al **hospital más
  cercano**, donde se cura en 20 segundos y vuelve a filas con media vida (sobre
  el hospital se ve la cruz verde). Al que está demasiado lejos igual lo van a
  buscar, pero puede desangrarse antes de que lleguen: para eso está la
  ambulancia. Los equipos caídos se reponen a los 30 segundos.
- Los camilleros **no abandonan a ningún herido**: rodean quebradas, cerros y
  obras por largo que sea el camino, y si un paso queda cerrado vuelven a
  intentarlo. Solo no van por los que cayeron en otra isla. La ficha del
  hospital muestra cuántos equipos andan **en el campo**.
- Las bajas dejan **sangre** en el terreno; las causadas por **artillería,
  dinamita o minas despedazan** el cuerpo. Se puede desactivar en Opciones
  («Sangre en las bajas»).

### Ambulancia y hospital de sangre

La **ambulancia** se forma en el hospital de campaña ($ 150 y 50 de agua, 3 de
población) y acompaña a la tropa en los ataques:

- **Montar hospital** (tecla **B**): se elige el lugar como el de una obra, cerca
  de la tropa; el carro va hasta allí y en 8 segundos levanta las carpas de un
  **hospital de sangre**, con dos equipos de camilleros propios y la cruz roja
  que cura a los que están cerca. Los heridos del frente se curan ahí mismo, sin
  el largo viaje a la retaguardia. No cuesta nada: las carpas van en el carro.
- **Desmontar** (tecla **D**, con el hospital de sangre seleccionado): en 6
  segundos las carpas vuelven al carro para seguir el avance. Los camilleros
  suben con el herido que traían y los **convalecientes viajan en el carro** y
  siguen curándose hasta volver a filas junto a él.
- El carro y las carpas son la misma tropa: conservan la vida que tenían y
  siguen seleccionados al montarse y desmontarse. Si el enemigo destruye el
  carro o el hospital de sangre, los convalecientes caen con ellos.
- Los trabajadores no levantan hospitales de sangre: solo la ambulancia. La IA
  también las usa: las lleva detrás de su frente y monta sus carpas cuando su
  tropa entra en combate.

### Agua y sed en el desierto

La pampa y el salar no perdonan. Cada infante y cada jinete lleva una
**cantimplora** (100 de agua) que gasta al **marchar o combatir** al sol: 1 por
segundo en la pampa y 1,5 en el salar, que es calor extremo. Quieta y sin
disparar, la tropa no gasta agua; fuera de la pampa y el salar (en la arena,
los caminos y las rampas), tampoco.

- **Sin agua** (una gota vacía sobre la unidad, que también ve el enemigo):
  marcha un **25 % más lento** y tarda **el doble** en volver a disparar.
- **Golpe de calor**: tras 30 segundos al sol de la pampa sin agua (20 en el
  salar), la unidad pierde medio punto de vida por segundo hasta que beba. El
  ayudante avisa («¡La tropa se quedó sin agua!», «¡Golpe de calor!»); con
  **Espacio** la cámara va hasta allí.
- **Dónde beber**: junto a un **molino de agua** o al **Cuartel General**
  (3 casillas a la redonda, 10 de agua por segundo; la guarnición del cuartel
  también bebe) o junto a una **carreta de agua**. Con agua en la cantimplora la fatiga se repone sola; junto a la
  carreta o al molino, el doble de rápido.
- **A la sombra de un tamarugo** la tropa gasta un 70 % menos de agua y se
  fatiga un 70 % menos.
- La ficha de la unidad muestra el **agua** y la **fatiga**; los trabajadores,
  los camilleros, las piezas y los buques no tienen sed.

### Carreta de agua

Se forma en el **depósito de intendencia** con un molino en pie ($ 100 y 50 de
agua, 2 de población) y acompaña a las columnas:

- Lleva una **pipa de 2000 de agua** y da de beber a la tropa propia y aliada a
  **4 casillas** a la redonda: 5 de agua por segundo a cada soldado, primero a
  los más sedientos, y les alivia la fatiga.
- **Llena la pipa** junto a un molino o al Cuartel General (50 por segundo). La
  ficha y la barra celeste bajo la unidad muestran cuánta le queda.
- Una orden de ataque no la lleva contra el enemigo: **sigue a la tropa** que va
  al combate. La IA también lleva carretas cuando el mapa tiene pampa o salar.

### Formaciones de la infantería

Con la infantería de fusil seleccionada (infante, zapador, torpedista, montonero,
Colorados), el botón **Formación** (tecla **F**) abre el submenú:

| Formación | Tecla | Efecto |
|-----------|-------|--------|
| **Línea** | L | Fuego a discreción: **+30 % de cadencia**, −10 % de velocidad; la artillería, la dinamita y los cañones de los buques le hacen un **15 % más** de daño |
| **Guerrilla** | G | Tiradores dispersos: **−35 % del daño** de la fusilería, la metralla y la artillería, **+20 % de velocidad**, −20 % de potencia de fuego |
| **Cuadro** | C | Bayonetas hacia fuera: la **carga de la caballería no duplica** su daño; −60 % de velocidad |
| Sin formación | N | Como siempre |

La formación vigente se marca en el submenú y se ve en la ficha de la unidad
(también la del enemigo). Guarecida en una trinchera o un edificio, la tropa no
forma. La IA marcha en guerrilla, combate en línea y forma el cuadro cuando la
caballería enemiga se le echa encima (en Normal y Difícil).

### Artillería: dispersión y viento

Las granadas de los cañones de montaña y de campaña **no caen siempre en el
blanco**: se dispersan alrededor de él, y la mitad cae dentro del **error
circular probable** (CEP), que crece con la distancia (0,06 casillas por casilla
de tiro en el cañón de montaña y 0,05 en el de campaña).

- **Cuesta arriba** el CEP crece un 50 % (menos con la veteranía).
- Un **observador adelantado** propio (el **espía** o el **baqueano**) a 6
  casillas o menos del blanco **reduce el CEP a la mitad**.
- El **viento** corre las granadas hacia donde sopla, más cuanto más largo es
  el tiro. La barra superior muestra de dónde viene y su fuerza («Viento del
  O · 35», con una flecha hacia donde sopla); rola y cambia de fuerza cada 45
  segundos.

### Veteranía: la tropa aprende combatiendo

Cada soldado gana **experiencia** al herir y abatir enemigos (más cuanto más
valga el enemigo), al dañar obras, al aguantar fuego y seguir en pie y, la
cantinera, al curar. Con ella sube de **grado** (los héroes, los trabajadores y
los camilleros no tienen grados):

| Grado | Experiencia (abatir enemigos de su mismo valor) | Rango del escalafón | Galones | Mejoras sobre el recluta |
|-------|------------------------------------------------|---------------------|---------|--------------------------|
| Recluta | — | Soldado | — | — |
| **Fogueado** | 1 | Soldado | 1 | +10 % vida y daño, +5 % cadencia; caballería +5 % velocidad y +25 % carga; cantinera +20 % curación |
| **Veterano** | 3 | Cabo | 2 | +20 % vida, +15 % daño, +10 % cadencia, +1 armadura, +1 visión y **+1 alcance** de fusil, metralla y dinamita; falla un tercio menos cuesta arriba; la artillería se emplaza un 25 % más rápido |
| **Aguerrido** | 6 | Sargento | 3 | +30 % vida, +25 % daño, +15 % cadencia, +1 armadura, +2 visión, +1 alcance (+2 la artillería); falla la mitad cuesta arriba; **se cura solo** fuera de combate |

- Los **galones** sobre la unidad los ven los dos bandos: conviene saber a quién
  se enfrenta.
- Al ascender, el soldado recibe **nombre y cuerpo** («Sargento Toribio
  Sepúlveda, Buin 1.º de Línea»), que se ven en su tarjeta con su hoja de
  servicio (bajas y batallas), y lo anuncia la voz de la tropa.
- El **Barracón de Instrucción** investiga *Ejercicios de tiro*: los reclutas
  que esperan a su lado llegan solos a Fogueado (más arriba solo se llega
  combatiendo). El recluta que pelea cerca de un Aguerrido de su arma aprende un
  50 % más rápido, y un 25 % cerca de un héroe.

### Sanidad: resguardar a los veteranos

Un veterano que cae **herido** conserva su grado si los camilleros lo llevan al
hospital: vuelve a filas con su nombre, sus galones y su hoja de servicio. Los
camilleros recogen primero a los de mayor grado.

- **Replegar heridos** (tecla **J** en la tarjeta): las unidades seleccionadas
  que están heridas van a curarse al hospital más cercano (de campaña o de sangre).
- En el hospital se investigan **Servicio sanitario** (un equipo más de
  camilleros en cada hospital, todos un 20 % más rápidos) y **Convalecencia**
  (los heridos aguantan 60 segundos en el suelo y vuelven con el 75 % de la vida).
- Si el enemigo destruye el hospital, los veteranos que se curaban en él caen;
  los heridos que nadie recoge, también. Al terminar la batalla, el parte de
  guerra cuenta los veteranos en filas por grado, los ascensos y los caídos.
- **El vencido se retira**: cuando un ejército pierde, sus unidades dejan el
  campo (no mueren) y sus veteranos, con los heridos que llevan los camilleros
  y los que se curan en el hospital o en el carro de una ambulancia, siguen en
  filas para la batalla siguiente.

### Campaña del Salitre (contra la IA)

*Portada → Campaña del Salitre*: cuatro batallas encadenadas, de **San Francisco
(Dolores)** y **Tarapacá** al **Alto de la Alianza** y el **asalto del Morro de
Arica**, con Chile, el Perú o Bolivia (el rival cambia según la nación elegida).

- **Los veteranos que sobreviven pasan a la batalla siguiente**: bajan del tren o
  de la carreta junto con el Cuartel General. Los caídos van al **libro de los
  caídos** y no vuelven.
- La pantalla de la campaña muestra el relato histórico de cada batalla, el
  **escalafón** (grado, nombre, unidad, bajas y batallas de cada veterano) y el
  libro de los caídos.
- Cada victoria da **honores** (10, y 1, 3 o 6 por cada Fogueado, Veterano o
  Aguerrido preservado); al final se gana la medalla de oro, plata o bronce de la
  campaña. Con una derrota la batalla se repite con el escalafón de antes.
- La IA también conserva a sus veteranos, y en las últimas batallas trae un
  núcleo de tropa fogueada.
- La campaña se guarda sola en el perfil del equipo y se retoma donde quedó.

### Música y sonido

- **Música de banda militar**, original del juego: la *Marcha del Salitre* en
  los menús y *Vivac en la pampa* (tambores, cornos y un toque de corneta a lo
  lejos) durante la batalla, más baja para no tapar el fuego.
- **Opciones → Sonido**: volumen **general**, de la **música**, de los
  **efectos** (fusilería, cañones, obras) y de las **voces**; se aplican al
  instante. En la batalla, el menú (**F10**) trae los mismos controles.

### Voces de la tropa

Las unidades **hablan** en lugar de los toques de corneta: se presentan al
formarse («¡Granadero a caballo, listo para la carga!»), responden al
seleccionarlas y al recibir una orden («¡En marcha!», «¡Calen bayoneta!», «¡A la
carga!»; la ambulancia: «¿Dónde montamos el hospital?», «¡Arriba las carpas!»;
la carreta de agua: «¿Adónde llevamos el agua?»; al formar: «¡En línea de
batalla!», «¡Formen cuadro! ¡Bayoneta calada!»), y el ayudante avisa de las
obras terminadas, la falta de dinero o de agua, la tropa sin agua, el golpe de
calor y los ataques. Los héroes dicen sus palabras más conocidas (Bolognesi,
Prat, Abaroa…). Se desactivan en Opciones («Voces de las tropas») y entonces
vuelven los toques de corneta.

### El terreno importa

- Hay tres **niveles de altura**. Desde abajo no se ve lo que hay arriba, y quien
  dispara cuesta arriba **falla un 30 %** de las veces: ocupar la meseta del
  Intiorko o el Morro de Arica da ventaja, como en la guerra.
- Las **rampas** son los únicos accesos entre niveles; las quebradas solo se
  cruzan por sus pasos.
- **Cobertura**: la infantería que se detiene junto a **rocas**, **ruinas** o
  **tamarugos** queda a cubierto y recibe un **30 % menos** de daño de la
  fusilería y la metralla (no de la artillería). Junto a un tamarugo, además,
  está **a la sombra** (ver *Agua y sed*). En marcha pierde la cobertura.
- La **niebla de guerra** la calcula el servidor: nadie recibe la posición de lo
  que no ve, así que no se puede hacer trampa.

### Controles

| Acción | Cómo |
|--------|------|
| Seleccionar | Clic izquierdo; arrastrar para un recuadro; doble clic o Ctrl + clic: todas las del mismo tipo en pantalla; Mayúsculas + clic: agregar |
| Mover, atacar, recolectar, reparar | Clic derecho sobre el terreno, el enemigo, el recurso o el edificio |
| Órdenes de la tarjeta | Botones abajo a la derecha o su tecla (M mover, S detener, A atacar, H mantener posición, P patrullar, G recolectar, B construir o montar el hospital de sangre, D desmontarlo, V construcción avanzada, F formación…) |
| Formaciones | F y luego L línea, G guerrilla, C cuadro o N sin formación |
| Encolar órdenes | Mayúsculas + orden |
| Grupos | Ctrl + 1…9 forma; 1…9 selecciona; dos veces centra la cámara |
| Cámara | Flechas, borde de la pantalla, arrastrar con el botón central o clic en el minimapa; rueda para acercar. En ventana, el puntero queda encerrado durante la batalla para mover la cámara con el borde (se suelta con F10 o Alt + Tab; se desactiva en Opciones) |
| Trabajador ocioso / todo el ejército | F1 / F2 |
| Ir al último aviso | Espacio |
| Conversar / con el equipo | Intro / Mayúsculas + Intro |
| Señal en el mapa para los aliados | Alt + G |
| Barras de vida | Mantener Alt (o activarlas siempre en Opciones) |
| Menú (volumen, rendirse, pausa, abandonar) | F10 o Esc |
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
- **Serie de campaña**: en la sala, el anfitrión elige *Modo → Serie de 2, 3 o 4
  batallas*. Entre batalla y batalla el servidor guarda el **escalafón de
  veteranos** de cada ejército, y los veteranos llegan con el Cuartel General a
  la siguiente; la sala pasa sola al mapa siguiente del itinerario (el anfitrión
  puede elegir otro). Durante la serie la nación y el equipo no cambian, y quien
  se va o pierde la conexión entre batallas conserva su lugar y sus veteranos
  (vuelve al ingresar con su nombre; el anfitrión puede entregar ese ejército a
  la IA). **Gana el equipo con más batallas ganadas**; si empatan, el de más
  **honores**, que se suman con cada victoria y con cada veterano que sobrevive:
  el objetivo es llegar a la última batalla con la mayor cantidad de veteranos.

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
│   ├── servidor/         backend: cuentas, salas, partidas, series de campaña, base de datos, repeticiones
│   └── cliente/          frontend: menús, campaña, salón, sala de espera y campo de batalla
├── godot/                cliente 3D en Godot 4 (el juego principal): diorama, modelos, interfaz, sonido,
│                         pruebas y presets de exportación
├── datos/                unidades, edificios, mejoras, habilidades, naciones, tablas (con la veteranía),
│                         campañas y nombres del escalafón (JSON)
├── mapas/                los seis campos de batalla (JSON)
├── recursos/             tipografías e ícono (y aquí pueden ir gráficos o sonidos propios)
├── herramientas/         generadores de mapas, tablas e ícono; exportación del cliente 3D
├── instalador/           PyInstaller, Inno Setup (Windows), imagen de disco (macOS) y pruebas de los paquetes
├── docker/               servidor dedicado en contenedor
├── descargas/            copias del instalador de Windows, del .dmg de macOS y de la versión para Linux
│                         (se guardan a pedido desde GitHub Actions)
├── tests/                pruebas automáticas
└── docs/                 investigación, diseño, arquitectura, multijugador y recomendaciones
```

Los datos son **JSON en español** y se pueden modificar sin programar: los
números de cada unidad, los requisitos, las auras de los héroes, las naciones,
los grados de veteranía, las batallas de la campaña…
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
python herramientas/exportar_godot.py     # catálogo del cliente 3D (después de tocar datos/ o la versión)
python herramientas/duelo_ia.py --mapa quebrada_de_tarapaca --nombre duelo   # IA contra IA, con repetición
pyinstaller --noconfirm instalador/salitre.spec   # versión clásica y servidor en dist/GuerraDelPacifico/
SALITRE_GODOT=/ruta/a/Godot_v4.7.2 python herramientas/exportar_cliente3d.py --sistemas windows,macos,linux
```

Las pruebas del cliente 3D corren con el resto; las que necesitan Godot (las
del propio cliente, la niebla, la campaña y los nombres de los veteranos
comparados con los de Python, una prueba de humo de punta a punta contra el
servidor real y los recorridos por todas las pantallas, la campaña y el
multijugador con un servidor dedicado) se activan indicando el ejecutable:
`SALITRE_GODOT=/ruta/a/Godot_v4.7.2 python -m pytest tests/test_godot.py`.
`godot --path godot -s res://pruebas/vitrina.gd -- --vista=tropas` arma una
vitrina con las tropas (o `--vista=obras`, `--vista=mapa`) para revisar los
modelos.

Las voces de `recursos/sonidos/voces/` se generan sin conexión con
`herramientas/generar_voces.py` (modelo Kokoro-82M; las instrucciones están al
comienzo del archivo) y la música de `recursos/sonidos/musica/` con
`herramientas/generar_musica.py` (necesita `numpy` y `soundfile`).

**Ejecutables.** `herramientas/exportar_cliente3d.py` exporta el cliente 3D con
los presets de `godot/export_presets.cfg` (desde cualquier sistema, para los
tres) y, si faltan, baja solo las plantillas de exportación de Godot que hacen
falta (`herramientas/plantillas_godot.py`: unos 300 MB en vez del archivo
completo de 1,3 GB). Los guiones de `instalador/` lo juntan con lo que arma
PyInstaller (la versión clásica, el servidor dedicado y los datos que los tres
comparten) y prueban el paquete: la versión clásica con una escaramuza sin
pantalla y el cliente 3D con su prueba de humo de punta a punta contra el
servidor empaquetado, sin Python a la vista (`instalador/probar_cliente3d.py`).
Con `SALITRE_GODOT` exportan el cliente 3D; sin él, usan el que esté en
`dist/cliente3d/`. En Linux, `sh instalador/construir.sh` deja el `.tar.gz`. En
Windows, `instalador\construir_windows.ps1` genera además el instalador con
Inno Setup. En un Mac, `sh instalador/construir_mac.sh` arma *Guerra del
Pacífico.app* (con el cliente 3D como ejecutable principal), la prueba y la
guarda en un `.dmg` (con `SALITRE_ARQUITECTURA=universal2` y el Python de
python.org sirve para Intel y Apple Silicon).

## Documentación

- [Investigación histórica](docs/INVESTIGACION.md): economía del salitre,
  ejércitos, armas, héroes y las licencias que se toma el juego, con fuentes.
- [Diseño del juego](docs/DISENO.md): las decisiones y el equilibrio.
- [Tablas](docs/TABLAS.md): todas las cifras.
- [Arquitectura](docs/ARQUITECTURA.md): servidor autoritativo, simulación
  determinista, red, base de datos y los dos clientes (pygame y el 3D de Godot).
- [Multijugador](docs/MULTIJUGADOR.md): cómo jugar con los compañeros.
- [Recomendaciones](docs/RECOMENDACIONES.md): próximos pasos y uso como material
  de estudio de ciencias militares.
- [Guía del código para asistentes de programación](GEMINI.md): módulos, flujo de
  una orden, reglas que no se deben romper (determinismo, huella, protocolo),
  recetas para cambios frecuentes, pruebas y oportunidades de mejora. Gemini CLI
  la carga sola; también sirve para cualquier persona que se sume al proyecto.

## Créditos

- Tipografías **IM Fell English SC** (Igino Marini) y **Alegreya Sans**
  (Huerta Tipográfica), con licencia SIL Open Font License (textos en
  `recursos/fuentes/`).
- Sprites, edificios, terreno, efectos, ícono y efectos de sonido están
  generados por el propio programa.
- **Música** original (*Marcha del Salitre* y *Vivac en la pampa*), compuesta y
  sintetizada para el juego por `herramientas/generar_musica.py` (instrumentos
  de banda por síntesis aditiva, sin muestras grabadas ni obras de terceros).
- **Voces** sintetizadas sin conexión con el modelo abierto **Kokoro-82M**
  (licencia Apache 2.0) y [kokoro-onnx](https://github.com/thewh1teagle/kokoro-onnx)
  (MIT), voces en español `em_alex`, `em_santa` y `ef_dora`. Se regeneran con
  `herramientas/generar_voces.py`; el texto de cada frase está en
  `recursos/sonidos/voces/voces.json`.
- Homenaje a los combatientes de los cuatro países. El juego representa la
  guerra con respeto por todos los bandos y no toma partido.
