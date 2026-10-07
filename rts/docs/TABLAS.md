# Tablas del juego

Generadas con `python herramientas/generar_tablas.py` a partir de `datos/` y `mapas/`.
Costos en dinero ($) / agua: el salitre se vende en el Cuartel General a 1 $ por unidad. Tiempos en segundos; distancias en casillas.

## Economía

| Parámetro | Valor |
|---|---|
| Población máxima por jugador | 200 |
| Recursos iniciales | $ 100 |
| Trabajadores iniciales | 6 |
| Salitre por viaje / tiempo de extracción | 5 / 2.5 s |
| Agua por viaje / tiempo de extracción | 6 / 1.5 s |
| Agua por viaje con el pozo agotado | 1 |
| Minas activas por jugador | 15 |
| Penalización al disparar cuesta arriba | 30 % de fallos |

## Unidades comunes a las cuatro naciones

| Unidad | Se forma en | Costo | Pob. | Tiempo | Vida | Arm. | Daño | Alcance | Cadencia | Velocidad | Requiere |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Trabajador chino | Cuartel General | $ 50 | 1 | 12 | 40 | 0 | 5 (Arma blanca) | 0.25 | 1.4 | 1.9 | — |
| Infante de línea | Barracas | $ 50 | 1 | 15 | 45 | 0 | 6 (Fusil) | 5 | 1.0 | 1.6 | — |
| Cantinera | Barracas | $ 50 / 25 | 1 | 18 | 40 | 0 | — | — | — | 1.6 | Hospital de campaña |
| Camilleros | — | $ 0 | 0 | 30 | 60 | 0 | — | — | — | 2.0 | Hospital de campaña |
| Ingeniero dinamitero | Barracas | $ 75 / 50 | 2 | 20 | 70 | 0 | 25 (Dinamita) | 4.5 | 2.2 | 1.5 | Barracón de Instrucción |
| Granadero a caballo | Caballeriza | $ 150 / 75 | 5 | 30 | 250 | 1 | 26 (Arma blanca) | 0.35 | 1.1 | 2.8 | — |
| Cazador a caballo | Caballeriza | $ 125 / 75 | 5 | 28 | 200 | 1 | 14 (Fusil) | 4 | 0.8 | 3.0 | — |
| Cañón de montaña | Parque de Artillería | $ 200 / 100 | 10 | 35 | 200 | 1 | 45 (Granada explosiva) | 8 | 2.5 | 1.3 | — |
| Cañón de campaña | Parque de Artillería | $ 300 / 200 | 10 | 45 | 250 | 2 | 80 (Granada explosiva) | 12 | 3.5 | 1.0 | — |
| Ametralladora Gatling | Parque de Artillería | $ 250 / 150 | 10 | 40 | 300 | 2 | 6 (Metralla) | 6 | 0.125 | 1.1 | — |
| Espía | Estado Mayor | $ 50 / 100 | 1 | 25 | 40 | 0 | — | — | — | 2.0 | — |
| Transporte a vapor | Muelle | $ 150 / 50 | 2 | 30 | 300 | 1 | — | — | — | 2.6 | — |
| Cañonera | Muelle | $ 250 / 150 | 5 | 45 | 450 | 2 | 35 (Cañón naval) | 9 | 2.5 | 2.2 | Central de Telégrafos |

## Unidades especiales de cada nación

| Nación | Unidad | Se forma en | Costo | Pob. | Tiempo | Vida | Arm. | Daño | Alcance | Cadencia | Velocidad | Requiere |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Chile | Zapador | Barracas | $ 100 / 25 | 2 | 22 | 80 | 1 | 8 (Fusil) | 4.5 | 1.0 | 1.6 | Barracón de Instrucción |
| Perú | Torpedista | Barracas | $ 100 / 50 | 2 | 22 | 55 | 0 | 4 (Fusil) | 3.5 | 1.2 | 1.5 | Barracón de Instrucción |
| Perú | Montonero | Barracas | $ 40 | 1 | 12 | 40 | 0 | 5 (Fusil) | 4.5 | 1.0 | 1.9 | Barracón de Instrucción |
| Bolivia | Colorado de Bolivia | Barracas | $ 100 / 25 | 1 | 22 | 75 | 1 | 8 (Fusil) | 5 | 1.0 | 1.6 | Barracón de Instrucción |
| Argentina | Baqueano | Caballeriza | $ 75 / 25 | 2 | 18 | 70 | 0 | 6 (Fusil) | 4 | 1.0 | 3.2 | — |

- **Zapador**: Infante de ingenieros: detecta minas y unidades ocultas, destruye edificios con su carga de demolición y levanta trincheras y reductos al doble de velocidad.
- **Torpedista**: Siembra minas ocultas ('polvorazos') que estallan al paso del enemigo. Solo los detectores las ven.
- **Montonero**: Guerrillero de la sierra: barato y rápido. Se oculta si permanece quieto unos segundos.
- **Colorado de Bolivia**: Infantería de élite: más vida y daño; formada en cuadro recibe la mitad del daño de las armas blancas.
- **Baqueano**: Guía y rastreador a caballo: el explorador más veloz, con enorme visión; descubre espías y minas.

## Héroes

Cada héroe es único: si cae, puede volver a formarse en el Estado Mayor (o en el muelle si es marino).

| Héroe | Nación | Costo | Pob. | Vida | Aura de mando | Habilidad |
|---|---|---|---|---|---|---|
| Gral. Manuel Baquedano | Chile | $ 350 / 200 | 4 | 750 | +15% de daño (tropas de tierra) (radio 8) | ¡Al asalto!: Las tropas cercanas ganan +30 % de cadencia y +20 % de velocidad durante 10 s. |
| Tte. Cnel. Juan José San Martín Penrose | Chile | $ 300 / 150 | 4 | 600 | +2 de armadura (infantería) (radio 8) | Asalto al Morro: Las tropas cercanas ignoran la ventaja de la altura y ganan +25 % de velocidad y +1 de armadura durante 12 s. |
| Cnel. José Velásquez | Chile | $ 350 / 200 | 4 | 650 | +1 de alcance (artillería); +20% de daño (artillería) (radio 9) | Fuego de batería: Ordena una andanada de 8 granadas sobre la zona elegida. |
| Sgto. Irene Morales | Chile | $ 250 / 150 | 4 | 500 | +1.5 de vida por segundo (soldados) (radio 7) | Primeros auxilios: Cura 100 de vida a la tropa cercana. |
| Cap. Arturo Prat (corbeta Esmeralda) | Chile | $ 350 / 200 | 4 | 800 | +20% de daño (marina) (radio 8) | ¡Al abordaje!: Aborda un buque enemigo cercano: 250 de daño. |
| Cnel. Francisco Bolognesi | Perú | $ 300 / 150 | 4 | 650 | +2 de armadura (tropas de tierra) (radio 8) | Hasta quemar el último cartucho: Durante 10 s las tropas cercanas no pueden caer y disparan un 25 % más rápido. |
| Gral. Andrés Avelino Cáceres | Perú | $ 350 / 200 | 4 | 700 | +15% de velocidad (tropas de tierra); +10% de daño (tropas de tierra) (radio 8) | Emboscada: Oculta a las tropas cercanas durante 15 s (salvo ante detectores). |
| Cnel. Alfonso Ugarte | Perú | $ 300 / 150 | 4 | 600 | +15% de daño (infantería) (radio 8) | ¡Viva el Perú!: +30 % de daño a las tropas cercanas durante 8 s. |
| Alm. Miguel Grau (monitor Huáscar) | Perú | $ 400 / 250 | 4 | 950 | +2 de armadura (marina) (radio 8) | Espolonazo: Embiste con el espolón a un buque enemigo cercano: 300 de daño. |
| Gral. Narciso Campero | Bolivia | $ 350 / 200 | 4 | 750 | +15% de daño (tropas de tierra) (radio 8) | Defensa del Alto: +3 de armadura a las tropas cercanas durante 12 s. |
| Eduardo Abaroa | Bolivia | $ 250 / 150 | 4 | 600 | +2 de armadura (tropas de tierra) (radio 7) | ¿Rendirme yo?: Durante 10 s no puede caer y duplica su daño. |
| Cnel. Eliodoro Camacho | Bolivia | $ 300 / 150 | 4 | 600 | +15% de cadencia de fuego (infantería) (radio 8) | Contraataque: La infantería cercana gana +30 % de velocidad y +25 % de daño durante 10 s. |
| Ignacia Zeballos | Bolivia | $ 250 / 150 | 4 | 550 | +1.5 de vida por segundo (soldados) (radio 7) | Ambulancia: Cura 120 de vida a la tropa cercana. |
| Gral. Julio Argentino Roca | Argentina | $ 350 / 200 | 4 | 750 | +15% de daño (tropas de tierra) (radio 8) | Marcha al desierto: +40 % de velocidad a las tropas cercanas durante 12 s. |
| Cnel. Conrado Villegas | Argentina | $ 300 / 200 | 4 | 700 | +20% de daño (caballería); +10% de velocidad (caballería) (radio 8) | Carga de caballería: La caballería cercana gana +40 % de cadencia y +20 % de daño durante 8 s. |
| Tte. Cnel. Roque Sáenz Peña | Argentina | $ 300 / 150 | 4 | 650 | +2 de armadura (tropas de tierra) (radio 8) | Resistencia en el Morro: +4 de armadura a las tropas cercanas durante 12 s. |
| Cmdte. Luis Piedrabuena | Argentina | $ 350 / 200 | 4 | 850 | +2 de vida por segundo (marina) (radio 8) | Rescate de náufragos: Cura 150 de vida a buques y tropas cercanos. |

## Edificios

| Edificio | Tamaño | Costo | Tiempo | Vida | Población | Forma | Requiere |
|---|---|---|---|---|---|---|---|
| Cuartel General | 4×3 | $ 400 | 100 | 1500 | +10 | Trabajador chino | — |
| Depósito de Intendencia | 2×2 | $ 100 | 25 | 400 | +10 | — | — |
| Molino de agua | 3×3 | $ 75 | 30 | 500 | — | — | — |
| Barracas | 3×3 | $ 150 | 50 | 1000 | — | Infante de línea, Cantinera, Ingeniero dinamitero, Zapador, Torpedista, Montonero, Colorado de Bolivia | Cuartel General |
| Maestranza | 3×3 | $ 125 | 40 | 850 | — | — | Cuartel General |
| Hospital de campaña | 3×2 | $ 100 / 25 | 40 | 600 | — | — | Barracas |
| Trinchera | 3×2 | $ 100 | 25 | 400 | — | — | Barracas |
| Reducto | 2×2 | $ 125 / 25 | 30 | 500 | — | — | Maestranza |
| Barracón de Instrucción | 3×3 | $ 150 / 50 | 50 | 650 | — | — | Barracas |
| Caballeriza | 4×3 | $ 150 / 100 | 60 | 1000 | — | Granadero a caballo, Cazador a caballo, Baqueano | Barracón de Instrucción |
| Central de Telégrafos | 3×3 | $ 150 / 100 | 50 | 750 | — | — | Caballeriza |
| Parque de Artillería | 4×3 | $ 200 / 150 | 70 | 1250 | — | Cañón de montaña, Cañón de campaña, Ametralladora Gatling | Central de Telégrafos, Maestranza |
| Estado Mayor | 3×3 | $ 150 / 150 | 60 | 900 | — | Espía, héroes | Central de Telégrafos |
| Muelle | 3×3 | $ 150 | 50 | 900 | — | Transporte a vapor, Cañonera, héroes | Maestranza |
| Fortín de frontera (Argentina) | 2×2 | $ 125 | 30 | 600 | +5 | — | Barracas |

- **Cuartel General**: Centro del campamento: forma trabajadores, compra el salitre que traen (1 $ por cada unidad de salitre) y recibe el agua. Otorga 10 de población. Hasta 8 de población de infantería pueden subir al techo y disparar desde arriba con +2 de alcance.
- **Depósito de Intendencia**: Almacena víveres, munición y forraje. Cada depósito permite mantener 10 de población más (máximo 200).
- **Molino de agua**: Molino de viento con bomba sobre un pozo. Los trabajadores entran y salen cargados de agua.
- **Barracas**: Cuartel de tropa: forma infantes, cantineras, ingenieros y la infantería especial de cada país. Hasta 6 de población de infantería pueden subir al techo y disparar desde arriba con +2 de alcance, como en una pequeña fortaleza.
- **Maestranza**: Taller de armas y equipo: investiga las mejoras de ataque y armadura. Habilita el reducto y el muelle.
- **Hospital de campaña**: La Ambulancia: habilita a las cantineras, cura lentamente a la tropa cercana y mantiene dos equipos de camilleros que recogen a los heridos del frente. Los heridos se recuperan en el hospital y vuelven a filas.
- **Trinchera**: Obra de campaña con parapeto: hasta 4 de población de infantería disparan desde ella protegidos y con +1 de alcance.
- **Reducto**: Fortificación con una pieza de artillería. Detecta unidades ocultas y minas cercanas.
- **Barracón de Instrucción**: Escuela de tiro y de clases: habilita ingenieros, la infantería especial y la caballeriza, e investiga tácticas.
- **Caballeriza**: Cuadras y forraje: forma la caballería. Los caballos beben mucha agua.
- **Central de Telégrafos**: Comunica el frente con el mando: habilita la artillería, el Estado Mayor y las cañoneras. Habilidad: Reconocimiento (revela una zona del mapa).
- **Parque de Artillería**: Forma las piezas de artillería y las ametralladoras Gatling, las unidades más poderosas y caras.
- **Estado Mayor**: Cuartel del alto mando: forma a los héroes de cada nación y a los espías. Cada héroe es único.
- **Muelle**: Debe construirse en la costa. Forma transportes, cañoneras y los buques de los héroes navales.
- **Fortín de frontera**: Fuerte de palo a pique con tiradores: defiende, detecta espías y aloja 5 de población.

## Investigaciones

| Investigación | Dónde | Costo | Tiempo | Requiere | Efecto |
|---|---|---|---|---|---|
| Armamento de infantería I | Maestranza | $ 100 / 100 | 60 | — | +1 de daño a los fusiles de la infantería. |
| Armamento de infantería II | Maestranza | $ 175 / 175 | 75 | Armamento de infantería I y Barracón de Instrucción | +1 de daño a los fusiles de la infantería. |
| Armamento de infantería III | Maestranza | $ 250 / 250 | 90 | Armamento de infantería II y Estado Mayor | +1 de daño a los fusiles de la infantería. |
| Equipo de campaña I | Maestranza | $ 100 / 100 | 60 | — | +1 de armadura a la infantería (correajes, mochilas y cubrenucas). |
| Equipo de campaña II | Maestranza | $ 175 / 175 | 75 | Equipo de campaña I y Barracón de Instrucción | +1 de armadura a la infantería. |
| Equipo de campaña III | Maestranza | $ 250 / 250 | 90 | Equipo de campaña II y Estado Mayor | +1 de armadura a la infantería. |
| Sables y carabinas I | Maestranza | $ 150 / 150 | 70 | Caballeriza | +2 de daño a la caballería. |
| Sables y carabinas II | Maestranza | $ 225 / 225 | 85 | Sables y carabinas I y Central de Telégrafos | +2 de daño a la caballería. |
| Monturas y correajes I | Maestranza | $ 150 / 150 | 70 | Caballeriza | +1 de armadura a la caballería. |
| Monturas y correajes II | Maestranza | $ 225 / 225 | 85 | Monturas y correajes I y Central de Telégrafos | +1 de armadura a la caballería. |
| Granadas de acero I | Maestranza | $ 175 / 175 | 80 | Parque de Artillería | +8 de daño a los cañones y +1 a las ametralladoras. |
| Granadas de acero II | Maestranza | $ 250 / 250 | 95 | Granadas de acero I y Estado Mayor | +8 de daño a los cañones y +1 a las ametralladoras. |
| Cirugía de campaña | Hospital de campaña | $ 100 / 100 | 60 | — | +50 % de curación de cantineras y heroínas. |
| Botiquines | Hospital de campaña | $ 75 / 75 | 45 | — | +50 de energía máxima de las cantineras. |
| Orden disperso | Barracón de Instrucción | $ 100 / 100 | 60 | — | +1 de alcance a los fusiles de la infantería: tiradores en guerrilla en vez de columnas cerradas. |
| Paso de trote | Barracón de Instrucción | $ 100 / 100 | 60 | — | +15 % de velocidad a la infantería. |
| Dinamita de alto poder | Barracón de Instrucción | $ 125 / 125 | 70 | — | +10 de daño y +0,5 de radio a la dinamita de los ingenieros. |
| Herraje de campaña | Caballeriza | $ 100 / 100 | 60 | — | +15 % de velocidad a la caballería. |
| Carga a sable | Caballeriza | $ 150 / 100 | 70 | — | La carga de la caballería hace un 50 % más de daño. |
| Cifrado telegráfico | Central de Telégrafos | $ 100 / 100 | 60 | — | +50 de energía máxima de las centrales de telégrafos y de los espías. |
| Alza de mira graduada | Parque de Artillería | $ 150 / 150 | 80 | — | +2 de alcance a los cañones. |
| Manivela rápida | Parque de Artillería | $ 150 / 150 | 70 | — | +25 % de cadencia de las ametralladoras Gatling. |
| Academia de guerra | Estado Mayor | $ 200 / 200 | 90 | — | +200 de vida a los héroes. |
| Red de informantes | Estado Mayor | $ 100 / 150 | 60 | — | +3 de visión a los espías y +20 % de velocidad. |
| Calderas de alta presión | Muelle | $ 100 / 100 | 60 | — | +20 % de velocidad a los buques. |
| Blindaje de hierro | Muelle | $ 150 / 150 | 80 | — | +2 de armadura a los buques. |

## Habilidades

| Habilidad | Tecla | Energía | Espera | Descripción |
|---|---|---|---|---|
| Reparar | R | — | — | Repara edificios, piezas de artillería y buques propios. Cuesta una parte de su precio. |
| Obras de campaña | B | — | — | Levanta trincheras y reductos al doble de velocidad. |
| Emplazar / Enganchar | E | — | — | Emplaza la pieza para disparar o la engancha al armón para marchar. Se hace solo al recibir órdenes. |
| Desembarcar | D | — | — | Desembarca a la tropa en la costa más cercana al punto elegido. |
| Sabotaje | S | 75 | — | Paraliza un edificio enemigo durante 20 s: no produce ni investiga. |
| Sembrar mina | M | 50 | — | Entierra una mina oculta que estalla al paso de tropas enemigas (125 de daño en área). |
| Carga de demolición | D | — | 30 | Coloca una carga en un edificio enemigo que estalla a los 3 s con 220 de daño. |
| Reconocimiento telegráfico | R | 50 | — | Los informantes del telégrafo revelan una zona del mapa durante 12 s (también lo oculto). |
| ¡Al asalto! | Q | — | 60 | Las tropas cercanas ganan +30 % de cadencia y +20 % de velocidad durante 10 s. |
| Asalto al Morro | Q | — | 60 | Las tropas cercanas ignoran la ventaja de la altura y ganan +25 % de velocidad y +1 de armadura durante 12 s. |
| Fuego de batería | Q | — | 50 | Ordena una andanada de 8 granadas sobre la zona elegida. |
| Primeros auxilios | Q | — | 30 | Cura 100 de vida a la tropa cercana. |
| Hasta quemar el último cartucho | Q | — | 90 | Durante 10 s las tropas cercanas no pueden caer y disparan un 25 % más rápido. |
| Emboscada | Q | — | 60 | Oculta a las tropas cercanas durante 15 s (salvo ante detectores). |
| ¡Viva el Perú! | Q | — | 45 | +30 % de daño a las tropas cercanas durante 8 s. |
| Espolonazo | Q | — | 40 | Embiste con el espolón a un buque enemigo cercano: 300 de daño. |
| ¡Al abordaje! | Q | — | 40 | Aborda un buque enemigo cercano: 250 de daño. |
| Defensa del Alto | Q | — | 60 | +3 de armadura a las tropas cercanas durante 12 s. |
| ¿Rendirme yo? | Q | — | 60 | Durante 10 s no puede caer y duplica su daño. |
| Contraataque | Q | — | 50 | La infantería cercana gana +30 % de velocidad y +25 % de daño durante 10 s. |
| Ambulancia | Q | — | 35 | Cura 120 de vida a la tropa cercana. |
| Marcha al desierto | Q | — | 60 | +40 % de velocidad a las tropas cercanas durante 12 s. |
| Carga de caballería | Q | — | 45 | La caballería cercana gana +40 % de cadencia y +20 % de daño durante 8 s. |
| Resistencia en el Morro | Q | — | 60 | +4 de armadura a las tropas cercanas durante 12 s. |
| Rescate de náufragos | Q | — | 40 | Cura 150 de vida a buques y tropas cercanos. |

## Naciones

| Ejército | Ventajas | Propias | Nombres locales |
|---|---|---|---|
| Ejército de Chile | Artillería Krupp: +1 de alcance a los cañones; Dominio del mar: Buques un 25 % más baratos y un 15 % más rápidos | Zapador | Infante de línea → Infante de línea (Comblain); Cañón de montaña → Krupp de montaña; Cañón de campaña → Krupp de campaña |
| Ejército del Perú | Defensa de la plaza: Trincheras y reductos con +25 % de vida y un 25 % más baratos | Torpedista, Montonero | Infante de línea → Infante de línea (Peabody); Cantinera → Rabona (cantinera); Granadero a caballo → Húsar de Junín; Cazador a caballo → Carabinero a caballo; Cañón de montaña → Cañón Grieve de montaña; Cañón de campaña → Cañón White de campaña; Ametralladora Gatling → Ametralladora |
| Ejército de Bolivia | Hijos del Altiplano: +10 % de vida a toda la infantería, incluidos los trabajadores | Colorado de Bolivia | Infante de línea → Infante (Remington); Cantinera → Rabona (cantinera); Granadero a caballo → Húsar de Bolivia; Cazador a caballo → Cazador del Murillo; Cañón de montaña → Krupp de montaña; Cañón de campaña → Krupp de campaña; Ametralladora Gatling → Ametralladora |
| Ejército Argentino | Jinetes de la pampa: Caballería un 15 % más barata y un 10 % más rápida | Baqueano, Fortín de frontera | Infante de línea → Infante de línea (Remington Patria); Granadero a caballo → Lancero de frontera; Cazador a caballo → Carabinero a caballo; Cañón de montaña → Krupp de montaña; Cañón de campaña → Krupp de campaña; Ametralladora Gatling → Ametralladora |

## Daño según el tipo de ataque y de blanco

| Ataque | Infantería | Caballería | Artillería | Edificio | Naval |
|---|---|---|---|---|---|
| Fusil | 100 % | 100 % | 75 % | 75 % | 50 % |
| Arma blanca | 100 % | 100 % | 125 % | 50 % | 0 % |
| Metralla | 125 % | 100 % | 50 % | 40 % | 40 % |
| Granada explosiva | 75 % | 100 % | 100 % | 150 % | 100 % |
| Dinamita | 75 % | 75 % | 125 % | 200 % | 100 % |
| Cañón naval | 75 % | 100 % | 100 % | 150 % | 125 % |

## Campos de batalla

| Mapa | Jugadores | Casillas | Naval | Descripción |
|---|---|---|---|---|
| Alto de la Alianza (Tacna) | 2 | 96×112 | no | 2 jugadores. Dominar la meseta del Intiorko da la ventaja de la altura. |
| Cuatro naciones: el gran salar | 4 | 128×128 | no | 4 jugadores (todos contra todos o 2 contra 2). Chile, Perú, Bolivia y Argentina en torno al salar. |
| Islas de Chincha | 4 | 112×112 | sí | 4 jugadores (o 2 contra 2). Cada nación en su isla: hacen falta muelles y transportes. |
| Morro de Arica | 2 | 112×96 | no | 2 jugadores. El Morro domina el centro; la costa permite muelles y cañoneras. |
| Pampa del Tamarugal | 2 | 96×96 | no | 2 jugadores. Llanura salitrera con tamarugales, la vía del ferrocarril y los pozos del centro. |
| Quebrada de Tarapacá | 2 | 88×120 | no | 2 jugadores. Una quebrada profunda solo se cruza por dos pasos. |
