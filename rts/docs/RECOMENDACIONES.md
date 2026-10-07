# Recomendaciones

Propuestas para poner el juego en servicio con el curso, aprovecharlo como
material de estudio de ciencias militares y seguir desarrollándolo.

## 1. Despliegue para jugar con los compañeros

1. **Un servidor dedicado para el curso.** Un PC del laboratorio que quede
   encendido o la máquina virtual más pequeña de un proveedor de nube basta: la
   simulación de una batalla de 320 unidades ocupa unos 3 ms por tick y cada
   jugador consume unos **5 KB/s** (alrededor de 40 kbit/s; 3,9 MB en una partida
   de 14 minutos). Use `--sin-invitados` para que cada alumno tenga su cuenta,
   su ELO y su historial. Con Docker se levanta con un solo comando
   ([MULTIJUGADOR.md](MULTIJUGADOR.md#4-servidor-dedicado)).
2. **Desde las casas**, la vía más simple es una red privada virtual: Radmin VPN
   si todos usan Windows, o Tailscale o ZeroTier. Evita abrir puertos y cifra el
   tráfico.
3. **Una sola versión.** Publique cada versión con una etiqueta (`v0.9.0`): el
   flujo de GitHub Actions genera el instalador de Windows, la aplicación para
   macOS y las versiones portátiles, y todos instalan la misma. El servidor
   rechaza a quien tenga datos distintos. Los jugadores de Windows, macOS y Linux
   pueden jugar juntos: el servidor manda la partida y basta con tener la misma
   versión.
4. **Windows SmartScreen** advertirá que el instalador no está firmado («Windows
   protegió su PC» → *Más información* → *Ejecutar de todas formas*). Para
   evitarlo hace falta un certificado de firma de código, que tiene costo; para un
   curso basta con explicar la advertencia. En macOS, Gatekeeper pide lo mismo la
   primera vez (*Ajustes del Sistema → Privacidad y seguridad → Abrir
   igualmente*); bajar el `.dmg` con la Terminal lo evita
   ([descargas/LEEME.md](../descargas/LEEME.md)).
5. **Claves exclusivas para el juego**: la conexión del juego no va cifrada. Si el
   servidor se expone a Internet sin red privada, conviene agregar TLS (ver la
   hoja de ruta).

## 2. Organización de las partidas

- **Escalafón de temporada**: partidas 1 contra 1 en los mapas de dos jugadores
  durante algunas semanas; el ELO ordena el escalafón solo.
- **Torneo por eliminación** al final, con mapas sorteados y partidas al mejor de
  tres.
- **Partidas 2 contra 2** en *Cuatro naciones* o *Islas de Chincha* para ejercitar
  la coordinación entre aliados (visión compartida, chat de equipo y señales con
  Alt + G).
- **Series de campaña** de tres o cuatro batallas (modo de la sala): obligan a
  pensar más allá de la batalla del día, porque cada veterano perdido falta en la
  siguiente. Sirven para cerrar una unidad de estudio con una «campaña» por
  equipos.
- **Reglas de la casa** que conviene acordar: sin pausas en partidas
  clasificatorias, rendirse con «gg» al perder la base, y guardar las
  repeticiones de las finales.

## 3. Uso como material de estudio de ciencias militares

El juego no es un simulador táctico: escala, tiempos y cifras están comprimidos.
Pero las decisiones que exige son las de la conducción, y cada partida queda
registrada para estudiarla.

### Análisis después de la acción

Cada batalla se guarda como repetición. Véala con todo el mapa a la vista
(*Repeticiones*, velocidad con + y −) y responda en grupo:

1. ¿Qué se planeó y qué ocurrió? ¿Dónde se separaron?
2. ¿Cuál fue el **punto decisivo** de la batalla y quién lo ocupó primero?
3. ¿Se perdió la iniciativa? ¿Cuándo y por qué (economía, exploración, mando)?
4. ¿Qué haría distinto? ¿Qué se mantiene?

El *parte de guerra* (unidades formadas, perdidas, abatidas, obras, salitre y
agua) da los datos para comparar.

### Principios de la guerra en el juego

| Principio | Cómo aparece |
|-----------|--------------|
| **Objetivo** | La victoria exige destruir los edificios del adversario: hay que elegir entre atacar la economía, el ejército o la base. |
| **Masa** | El daño de muchas armas convergentes decide; las auras de los héroes multiplican a la tropa concentrada. |
| **Economía de fuerzas** | Trincheras, reductos y minas sostienen un sector con poca tropa mientras se concentra en otro. |
| **Maniobra** | La caballería rodea y alcanza la artillería; el envolvimiento del ala, como la IV División en Tacna. |
| **Seguridad y exploración** | La niebla la calcula el servidor: sin exploradores, baqueanos o reconocimiento telegráfico no se sabe qué viene. |
| **Sorpresa** | Montoneros ocultos, la emboscada de Cáceres, minas del torpedista, desembarcos. |
| **Unidad de mando** | Los héroes solo mejoran a la tropa que está cerca: el mando se ejerce en el lugar. |
| **Logística** | Agua y salitre limitan qué se puede formar; los depósitos de intendencia limitan cuánto se puede mantener. |
| **Conservación de la fuerza** | La tropa aprende combatiendo: un veterano vale más que un recluta, y en la campaña y las series pasa a la batalla siguiente. Hospital, camilleros, *Replegar heridos* y una retirada a tiempo preservan el poder de combate. |

### Análisis del terreno

Antes de cada partida, sobre la vista previa del mapa, identifique: observación y
campos de tiro (alturas), cubierta y ocultamiento (tamarugales, quebradas),
obstáculos (roca, mar, quebradas), **terreno clave** (la meseta del Intiorko, el
Morro, los pozos del centro) y avenidas de aproximación (rampas, pasos, la vía
férrea). En el juego, quien sube sin ver la cima y dispara hacia arriba pierde
un 30 % de sus tiros.

### Ejercicios propuestos

1. **Tacna (Alto de la Alianza).** Un bando defiende la meseta con trincheras y
   reductos; el otro ataca. Repetir cambiando los papeles y comparar con la
   batalla del 26 de mayo de 1880.
2. **Morro de Arica.** El defensor (Perú) siembra minas con torpedistas y
   fortifica; el atacante debe descubrirlas con zapadores antes del asalto.
3. **Desembarco en Islas de Chincha.** Planificar un desembarco como el de
   Pisagua: cañoneras para batir la costa, transportes para la primera ola,
   refuerzos.
4. **Logística en el desierto.** Partida en la que cada jugador solo puede
   levantar un molino de agua: ¿qué ejército se puede mantener?
5. **Reconocimiento.** Dos partidas iguales, una sin exploradores y otra con
   espías y baqueanos; comparar el resultado.
6. **Armas combinadas.** Ejército de un solo tipo contra ejército mixto de igual
   costo.
7. **Servicio de sanidad.** Dos jugadores libran la *Campaña del Salitre*: uno con
   hospital, *Ambulancias* y *Convalecencia* desde el comienzo, el otro sin
   sanidad. Comparar el escalafón y el libro de los caídos al llegar al Morro de
   Arica, y relacionarlo con el servicio de ambulancias de la guerra.
8. **Victoria a cualquier costo o victoria con la fuerza intacta.** En una serie
   de tres batallas, un equipo busca ganar cada batalla con ataques masivos y el
   otro preserva a sus veteranos y elige cuándo combatir. ¿Quién llega mejor a la
   tercera? ¿Cuándo conviene retirarse para conservar a los veteranos, como los
   aliados después de Tarapacá?

## 4. Mejoras de diseño a considerar

- **Límite de héroes simultáneos** (por ejemplo, dos a la vez). Hoy cada héroe es
  único, pero un jugador puede reunir a todos los de su nación; conviene probarlo
  en el escalafón antes de decidir.
- **Partidas históricas**: una opción de sala que deje solo a Chile, el Perú y
  Bolivia, para quienes prefieran excluir la facción hipotética argentina.
- **Escenarios con guion** sobre las batallas reales, con objetivos por fases.
  La *Campaña del Salitre* ya encadena Dolores, Tarapacá, Tacna y Arica con el
  escalafón de veteranos; faltan Pisagua y la campaña de Lima (Chorrillos,
  Miraflores) y de la Breña (Huamachuco), aprovechando la investigación del
  juego de acción del repositorio. Las etapas se agregan en
  `datos/campanas.json`.
- **Más mapas** de la sierra para la campaña de la Breña (La Concepción,
  Huamachuco) y de la costa (Pacocha, Pisco). Los mapas son JSON de texto y el
  generador está en `herramientas/generar_mapas.py`.
- **Equilibrio con datos**: después de cada temporada, revisar en la base de datos
  del servidor las victorias por nación y por mapa, y ajustar `datos/`.

## 5. Hoja de ruta técnica

1. **Cifrado TLS opcional** en el servidor y el cliente (el módulo `ssl` de Python
   se integra con `asyncio`), para servidores expuestos a Internet.
2. **Editor de mapas** dentro del juego.
3. **Lista pública de servidores** (un pequeño servicio que reúna los servidores
   abiertos) y emparejamiento automático por ELO.
4. **Arte y sonido**: sprites dibujados a mano y grabaciones de sonido. El juego ya
   carga archivos propios desde `recursos/graficos/` y `recursos/sonidos/` sin
   tocar el código. El *Himno de Yungay* es de dominio público y podría sonar en
   los menús chilenos; para las demás naciones habría que buscar marchas de
   dominio público.
5. **Firma y notarización de Apple** para la versión de macOS: con una cuenta de
   desarrollador (99 USD al año) la aplicación abriría sin advertencias.
6. **Teclas configurables** y paletas para daltonismo en los colores de los
   jugadores.
7. **Más de cuatro jugadores** por partida en mapas grandes: el servidor ya admite
   hasta ocho colores.
