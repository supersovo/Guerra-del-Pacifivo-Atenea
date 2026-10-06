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
| Recurso principal | Minerales | **Salitre** de las calicheras (5 por viaje, 2,5 s) |
| Recurso secundario | Gas (refinería sobre el géiser) | **Agua** (molino sobre el pozo, 6 por viaje, 1,5 s) |
| Trabajador | SCV, sonda, zángano | **Trabajador chino** (50 de salitre, 1 de población) |
| Suministro | Depósito, pilón, superamo | **Depósito de Intendencia** (+10) y Cuartel General (+10), máximo 200 |

- Se empieza con **6 trabajadores** y 100 de salitre; los trabajadores salen solos
  a recolectar.
- El **agua** se pide desde el segundo nivel tecnológico: caballería, artillería,
  héroes e investigaciones. Así, como el gas, marca el paso de la tecnología y
  obliga a defender los pozos. Un pozo agotado sigue dando 1 de agua por viaje.
- Los **costos en población** siguen el pedido del diseño: trabajador, infante y
  cantinera 1; ingeniero 2; caballería 5; artillería 10. Un ejército de 200 puede
  tener, por ejemplo, 40 trabajadores, 60 infantes, 8 jinetes y 6 piezas.

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
y los uniformes se dibujan con los colores de cada ejército.

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
islas, embarca a su ejército.

## Equilibrio: cómo ajustarlo

1. Cambie los valores en `datos/` (por ejemplo `"danio"` de una unidad o
   `"costo"` de un edificio).
2. `python -m pytest` comprueba que el contenido sigue siendo válido.
3. Juegue una escaramuza o deje a la IA contra la IA y mire el parte de guerra.
4. `python herramientas/generar_tablas.py` actualiza TABLAS.md.

Servidor y jugadores deben tener los mismos datos: al cambiarlos, todos deben
actualizar el juego (la huella del contenido lo verifica).
