# Diseño del juego

Las cifras de cada unidad, edificio, investigación y héroe están en
[TABLAS.md](TABLAS.md), generadas desde `datos/`. Este documento explica las
decisiones.

## Pilares

1. **Estrategia en tiempo real clásica**, con la estructura de *StarCraft* y
   *WarCraft*: economía de dos recursos, trabajadores que recolectan y construyen,
   edificios que habilitan tecnología, límite de población, niebla de guerra y
   control de grupos.
2. **Historia jugable**: cada mecánica parte de un hecho de la guerra (el agua del
   desierto, las alturas del Morro, las minas de Elmore, la carga de los
   Granaderos contra el cuadro de los Colorados) y cada héroe es un personaje real.
3. **Juego en red ante todo**: servidor autoritativo, reconexión, cuentas,
   escalafón, salas y repeticiones desde la primera versión.
4. **Datos editables**: todo el equilibrio vive en JSON en español; un profesor o
   un alumno puede cambiar un número y probarlo sin programar.

## Economía

| | *StarCraft* | *Salitre y Pólvora* |
|---|---|---|
| Recurso principal | Minerales | **Salitre** de las calicheras (5 por viaje, 2,5 s), que se **vende** en el Cuartel General |
| Moneda | — | **Dinero**: el salitre entregado se cambia 1 × 1 en el acto (sale un $ dorado sobre el cuartel) |
| Recurso secundario | Gas (refinería sobre el géiser) | **Agua** (molino sobre el pozo, 6 por viaje, 1,5 s) |
| Trabajador | SCV, sonda, zángano | **Trabajador chino** ($ 50, 1 de población) |
| Suministro | Depósito, pilón, superamo | **Depósito de Intendencia** (+10) y Cuartel General (+10), máximo 200 |

- Todos los costos son en **dinero** (y agua): el salitre vale por lo que se paga
  por él, como en la economía real del nitrato, que financió la guerra. El parte
  de guerra cuenta el dinero gastado.
- **Llegada del Cuartel General**: la partida empieza con el campo vacío. A los
  diez segundos el cuartel llega en **tren**, por un ramal del ferrocarril
  salitrero, en los mapas que tienen vía (Pampa del Tamarugal, Alto de la Alianza
  y Cuatro Naciones), o en **carreta** por el camino en los mapas campales. Se
  despliega con **6 trabajadores** y $ 100; los trabajadores salen solos a
  recolectar. El convoy ve a su alrededor mientras llega y luego se retira.
- El **agua** se pide desde el segundo nivel tecnológico: caballería, artillería,
  héroes e investigaciones. Así, como el gas, marca el paso de la tecnología y
  obliga a defender los pozos. Un pozo agotado sigue dando 1 de agua por viaje.
- Los **costos en población** siguen el pedido del diseño: trabajador, infante y
  cantinera 1; ingeniero 2; caballería 5; artillería 10. Un ejército de 200 puede
  tener, por ejemplo, 40 trabajadores, 60 infantes, 8 jinetes y 6 piezas.
- Cada pozo muestra el agua que le queda, para planear a tiempo el molino del
  pozo siguiente.

## Progresión tecnológica

```
Nivel 1  Cuartel General → Barracas (infantes) → Hospital (cantineras), Trinchera
         Maestranza (mejoras), Depósito, Molino de agua
Nivel 2  Barracón de Instrucción → ingenieros, unidades especiales, tácticas
         Caballeriza → caballería
Nivel 3  Central de Telégrafos → Estado Mayor (héroes, espías)
         Parque de Artillería (con Maestranza) → cañones y Gatling
Naval    Muelle (con Maestranza) → transportes, cañoneras, héroes navales
```

En partidas de prueba de la IA contra la IA, los primeros choques llegan hacia el
minuto 7 y las partidas se deciden entre los minutos 12 y 16.

## Papeles de las tropas

El daño depende del **tipo de ataque** contra la **clase de armadura** (tabla en
TABLAS.md):

- **Fusil** (infantería, cazadores): parejo contra tropas, flojo contra piezas y
  edificios.
- **Arma blanca** (granaderos, trabajadores): fuerte contra artillería (125 %),
  inútil contra buques; la **carga** de los granaderos duplica el daño durante el
  primer segundo y medio del choque. Los
  Colorados formados en cuadro reciben la mitad del daño de las armas blancas.
- **Metralla** (Gatling): destroza infantería (125 %), poco contra edificios.
- **Granada explosiva** (cañones): daño en área, fuerte contra edificios (150 %);
  los cañones tienen alcance mínimo y deben emplazarse.
- **Dinamita** (ingenieros): el mejor ataque contra fortificaciones (200 %).
- **Cañón naval**: contra buques y la costa.

Así se forman contrapesos: la Gatling frena a la infantería, la caballería
alcanza a la artillería que no está protegida, la artillería rompe trincheras y
reductos, y los ingenieros abren brechas.

### Guarniciones

La infantería (con sus unidades de apoyo y los héroes a pie) puede guarecerse en
la **trinchera** (4 plazas, +1 de alcance), las **barracas** (6, +2) y el
**Cuartel General** (8, +2). En la trinchera se ve a cada soldado asomado sobre
los sacos; en las barracas y el cuartel los tiradores suben al **techo** y
disparan desde arriba, con la ventaja de altura, como una pequeña fortaleza. La
artillería y la dinamita son la respuesta: rompen la obra y la guarnición cae
con ella.

### Heridos y camilleros

Con un **hospital de campaña**, el infante o el jinete que cae por fusil,
metralla o sable queda herido 40 segundos en el suelo. El hospital manda solos **dos equipos de
camilleros** (no combaten ni ocupan población) a buscar a los heridos dentro de
30 casillas; en el hospital se curan en 20 segundos y vuelven a filas con la
mitad de la vida. Quien cae por artillería, dinamita o minas muere en el acto (y
el cuerpo se despedaza). Así el hospital deja de ser solo el requisito de la
cantinera: recupera tropa después de cada choque, como las ambulancias de Tacna,
Chorrillos y Miraflores.

### La cantinera

La cantinera solo actúa sobre la tropa propia: si va seleccionada junto con la
infantería, una orden de ataque la hace acompañar a la columna y curar, nunca
avanzar sola contra el enemigo.

### Voces

Cada unidad se presenta con su voz al formarse, responde al ser seleccionada y
al recibir una orden, y un ayudante da los avisos (obra terminada, falta de
dinero o agua, ataques, victoria). Las voces no se pisan: una alarma corta a una
respuesta y los avisos esperan su turno. Sin voces vuelven los toques de corneta.

## Veteranía

La tropa **aprende combatiendo**, y el jugador tiene motivos para cuidarla: un
veterano vale más que un recluta recién formado, y en la campaña y en las series
en red pasa de una batalla a la siguiente.

- **Experiencia relativa al valor**: abatir a un enemigo da tanta experiencia
  como lo que costó (dinero + agua); herirlo, la parte proporcional. Así un
  infante que derriba a un granadero aprende más que si derriba a otro infante,
  y la artillería, cara, necesita más bajas para ascender. También enseña dañar
  obras (la mitad de su valor), aguantar el fuego y seguir en pie (un cuarto del
  valor de la vida perdida) y, a la cantinera, curar.
- **Cuatro grados** (*Recluta*, *Fogueado*, *Veterano*, *Aguerrido*) a 1, 3 y 6
  veces el valor de la unidad. Los bonos son **moderados** (de +10 % a +30 % de
  vida y daño, armadura, visión y alcance en los grados altos) para que un
  veterano sea valioso sin decidir solo una batalla; no se acumulan entre grados.
  Los grados altos corrigen dos debilidades de la época: disparar cuesta arriba
  (el Aguerrido falla la mitad que el recluta) y emplazar la artillería.
- **Galones a la vista de todos**: el enemigo sabe a quién tiene enfrente y puede
  concentrar el fuego en los veteranos; eso hace valiosa la protección.
- **Escalafón con nombre**: al primer ascenso el soldado recibe nombre y cuerpo
  (de los regimientos históricos de cada nación); la tarjeta muestra su hoja de
  servicio. El nombre se deriva de una semilla, de modo que la misma ficha
  produce el mismo nombre en el servidor y en el cliente.
- **Formación**: *Ejercicios de tiro* lleva a los reclutas ociosos junto al
  Barracón de Instrucción hasta Fogueado, nunca más arriba (más allá solo se
  llega combatiendo); el recluta cerca de un Aguerrido de su arma aprende un 50 %
  más rápido (encuadramiento), y un 25 % cerca de un héroe.
- **Sanidad**: el herido conserva su hoja de servicio; los camilleros recogen
  primero a los de mayor grado; *Replegar heridos* (J) manda a los heridos al
  hospital; *Ambulancias* y *Convalecencia* mejoran el servicio. Si cae el
  hospital, caen sus pacientes.
- **Retirada del vencido**: cuando un ejército pierde, sus unidades se retiran
  del campo en vez de morir; los veteranos que siguen vivos (y los heridos de
  camilla y hospital) pasan a la batalla siguiente, como los ejércitos aliados
  que se replegaron de Dolores a Tarapacá y de Tarapacá a Arica. Los heridos
  abandonados en el campo se pierden.

## Campaña y serie en red

- **Campaña del Salitre** (contra la IA): San Francisco (Dolores), Tarapacá,
  Alto de la Alianza y el Morro de Arica. Los veteranos sobrevivientes llegan con
  el Cuartel General a la batalla siguiente; con una derrota la batalla se
  repite con el escalafón anterior. La IA también conserva a sus veteranos y
  recibe un núcleo fogueado en las últimas batallas. Honores: 10 por victoria y
  1, 3 o 6 por cada Fogueado, Veterano o Aguerrido preservado; medallas de oro
  (100), plata (55) y bronce. Las etapas, rivales y honores están en
  `datos/campanas.json`.
- **Serie de campaña en red** (2 a 4 batallas en la misma sala): cada batalla
  cuenta, también para el que pierde (sus veteranos en retirada siguen). Gana el
  equipo con más batallas ganadas; si empatan, el de más honores. La nación y el
  equipo quedan fijos, y el mapa avanza por el itinerario de la campaña.
- **Todos los sobrevivientes pasan**, sin tope: el límite natural es la
  población (los veteranos que llegan ocupan población aunque superen el
  máximo, y hay que levantar depósitos para seguir formando tropa).

## Terreno y visión

- **Tres niveles**: pampa baja (0), meseta (1) y cerro (2). Se sube por rampas.
- Desde abajo **no se ve** lo de arriba (hace falta un explorador arriba o un
  reconocimiento) y quien dispara cuesta arriba **falla el 30 %**.
- Tamarugales y roca bloquean el paso; las quebradas solo se cruzan por sus pasos.
- **Detectores**: reductos, zapadores, baqueanos y el reconocimiento telegráfico
  revelan espías, montoneros ocultos y minas.

## Naciones

| Nación | Estilo | Ventajas | Propias |
|--------|--------|----------|---------|
| Chile | Ofensiva y combinada | Artillería Krupp (+1 de alcance); buques más baratos y rápidos | Zapador |
| Perú | Defensa en profundidad y guerrilla | Trincheras y reductos más resistentes y baratos | Torpedista (minas), Montonero (se oculta) |
| Bolivia | Infantería resistente | +10 % de vida a la infantería | Colorados (élite, cuadro) |
| Argentina | Movilidad | Caballería más barata y rápida | Baqueano (explorador), Fortín (defensa con población) |

Las unidades comunes cambian de **nombre** según la nación (Infante de línea
Comblain, Peabody, Remington o Remington Patria; Húsar de Junín; Cañón Grieve…),
y los uniformes se dibujan con los colores de cada ejército. Además cada **arma**
se reconoce de un vistazo:

| Arma | Rasgos del uniforme |
|---|---|
| Infante de línea | Quepí con cubrenuca blanco, correaje blanco cruzado, mochila y fusil con bayoneta |
| Zapador | Quepí de paño azul oscuro con franja carmesí, barba, mandil de cuero, zapapico al hombro y pala en la mochila |
| Ingeniero dinamitero | Gorra de cuartel con cinta carmesí, blusa de brin arremangada, canana con cartuchos de dinamita y morral; lanza el cartucho con la mecha encendida |
| Torpedista | Gorra de marinero con cintas, chaquetón azul con cuello marinero, pantalón blanco y la mina en brazos |
| Granadero a caballo | Morrión con banda, granada de metal y pompón, charreteras, bandolera blanca, guanteletes, botas altas y caballo morcillo (negro) |
| Cazador a caballo | Quepí con cubrenuca, dolmán con alamares, canana, carabina y caballo alazán |

Los rasgos chilenos siguen el reglamento de 1878 donde se conoce (morrión garance
con banda azul oscuro y granada de metal amarillo de los Granaderos; quepí de paño
azul con vivos carmesí de los Zapadores); el resto es una estilización legible a
escala de estrategia. Los colores de cada arma por nación están en
`datos/facciones.json` (clave `uniformes`).

## Héroes

- Se forman en el **Estado Mayor** (los marinos en el muelle), cuestan 4 de
  población y son **únicos**: si caen, pueden volver a formarse.
- Su **aura de mando** (radio de 7 a 9 casillas) da daño, armadura, cadencia,
  velocidad o curación a la tropa cercana, como pedía el diseño («que su efecto en
  el campo de batalla aumente las capacidades como el daño y la resistencia de las
  unidades cercanas»).
- Cada uno tiene una **habilidad** con espera (tecla Q) que evoca un hecho
  histórico: el «último cartucho» de Bolognesi, la emboscada de Cáceres en la
  Breña, el espolón del *Huáscar*, el abordaje de Prat.
- Un héroe es fuerte pero no decide solo: su valor está en multiplicar a la
  tropa. La investigación *Academia de guerra* les da 200 de vida.

## Marina

- Escenarios con islas (*Islas de Chincha*) exigen el **muelle**, los
  **transportes** (10 plazas de población) y las **cañoneras**.
- Desembarcar es la operación clave, como en Pisagua: la IA también lo hace.
- Las batallas siguen siendo terrestres: los buques no toman bases.

## Inteligencia artificial

Tres niveles, con las mismas reglas que una persona (solo envía comandos que el
servidor valida, sin ver a través de la niebla):

| Nivel | Nombre | Rasgos |
|-------|--------|--------|
| Fácil | Recluta | Decide cada 1,5 s; una barraca; no investiga ni se expande |
| Normal | Soldado de línea | Dos barracas; investiga, se expande y usa habilidades |
| Difícil | Veterano de la campaña | Decide cada 0,4 s; tres barracas; ataques más numerosos |

La IA explora, se expande a nuevas calicheras, equilibra salitre y agua, forma un
ejército mixto, defiende la base, ataca en oleadas crecientes y, en los mapas de
islas, embarca a su ejército. Cuida a sus veteranos: los Veteranos y Aguerridos
muy heridos se repliegan al hospital y no vuelven al frente hasta curarse.

## Equilibrio: cómo ajustarlo

1. Cambie los valores en `datos/` (por ejemplo `"danio"` de una unidad o
   `"costo"` de un edificio).
2. `python -m pytest` comprueba que el contenido sigue siendo válido.
3. Juegue una escaramuza o deje a la IA contra la IA y mire el parte de guerra.
4. `python herramientas/generar_tablas.py` actualiza TABLAS.md.

Servidor y jugadores deben tener los mismos datos: al cambiarlos, todos deben
actualizar el juego (la huella del contenido lo verifica).
