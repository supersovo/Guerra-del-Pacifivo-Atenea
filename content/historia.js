// =============================================================================
// historia.js — Textos históricos: páginas de "Historia", partes de
// operaciones (antes de cada batalla) y epílogo. Ver docs/HISTORIA.md para
// las fuentes consultadas.
// =============================================================================
'use strict';

const HISTORY_TEXT = [
  ['#LA GUERRA DEL PACÍFICO (1879-1884)',
    'Enfrentó a Chile con la alianza de Perú y Bolivia. El conflicto estalló por el salitre del desierto de Atacama y el impuesto boliviano a la Compañía de Salitres y Ferrocarril de Antofagasta.',
    'Tras el combate naval de Iquique (21 de mayo) y la captura del monitor Huáscar en Angamos (8 de octubre de 1879), Chile obtuvo el dominio del mar y emprendió la campaña terrestre de Tarapacá.'],
  ['#DESEMBARCO DE PISAGUA — 2 DE NOVIEMBRE DE 1879',
    'La escuadra (Cochrane, O\'Higgins, Magallanes y Covadonga) batió los fuertes Norte y Sur, armados con cañones Parrott de 100 libras.',
    'Cerca de las 10 de la mañana desembarcó en Playa Blanca la primera ola: unos 450 hombres del Atacama y de los Zapadores. Defendían 1.409 aliados: los batallones bolivianos Independencia y Victoria y fuerzas peruanas del teniente coronel Isaac Recavarren.',
    'Por la gran duna y el zigzag del ferrocarril los chilenos subieron hasta Alto Hospicio. A las 15:00 el teniente Rafael Torreblanca, del Atacama, izó la bandera en un poste del telégrafo.'],
  ['#BATALLA DE DOLORES O SAN FRANCISCO — 19 DE NOVIEMBRE DE 1879',
    'Unos 6.000 chilenos del coronel Emilio Sotomayor ocupaban los cerros junto a los pozos de Dolores. En el cerro San Francisco: Atacama, Coquimbo, 4º de Línea, la batería del sargento mayor José de la Cruz Salvo y dos ametralladoras Gatling.',
    'Hacia las 15:00 atacó el ejército aliado del general Juan Buendía, con las columnas de Suárez, Buendía y Villamil y los Húsares de Junín y de Bolivia. La batería de Salvo se defendió cuerpo a cuerpo.',
    'Tras unas dos horas los aliados se retiraron hacia la oficina Porvenir y Tarapacá, perdiendo sus 18 cañones. Los refuerzos bolivianos del presidente Daza se habían vuelto desde Camarones.'],
  ['#BATALLA DE TACNA O DEL ALTO DE LA ALIANZA — 26 DE MAYO DE 1880',
    'Tras desembarcar en Pacocha (Ilo) y vencer en Los Ángeles, el ejército chileno del general Manuel Baquedano marchó sobre Tacna. Unos 11.000 aliados del general Narciso Campero, presidente de Bolivia, lo esperaban en la meseta del cerro Intiorko, 3 km al norte de la ciudad.',
    'La línea aliada: a la derecha el contralmirante Lizardo Montero, con la artillería Krupp boliviana en un reducto; al centro el coronel Miguel Castro Pinto, con los batallones Padilla, Chorolque, Grau y Loa; a la izquierda el coronel Eliodoro Camacho. Chile formó cuatro divisiones (Amengual, Barceló, Amunátegui y Barbosa) y la reserva del coronel Mauricio Muñoz, con 37 cañones.',
    'Tras el duelo de artillería, las divisiones chilenas avanzaron con fuertes pérdidas. Los Colorados y el Aroma contraatacaron y resistieron en cuadro la carga de los Granaderos del comandante Tomás Yávar. Baquedano lanzó la reserva, y la IV División envolvió el ala derecha aliada y tomó su artillería a la bayoneta. Chile tuvo unas 2.200 bajas y los aliados entre 3.500 y 5.000; Bolivia no volvió a combatir en la guerra.'],
  ['#ASALTO Y TOMA DEL MORRO DE ARICA — 7 DE JUNIO DE 1880',
    'Tras la batalla de Tacna, Chile marchó sobre Arica, defendida por el coronel Francisco Bolognesi. El 5 de junio Bolognesi respondió al mayor Salvo que cumpliría sus deberes "hasta quemar el último cartucho".',
    'La plaza tenía los fuertes Ciudadela y del Este, las baterías del Morro y un sistema de minas ("polvorazos") del ingeniero Teodoro Elmore, capturado por los chilenos el 2 de junio.',
    'Al amanecer el coronel Pedro Lagos lanzó al 3º de Línea sobre la Ciudadela y al 4º sobre el fuerte del Este, con el Buin en reserva. Estalló el polvorín de la Ciudadela. A las 7:45, tras unos 55 minutos, flameó la bandera chilena en el Morro.'],
  ['#BATALLA DE SAN JUAN Y CHORRILLOS — 13 DE ENERO DE 1881',
    'Tras desembarcar en Pisco y en Curayaco, Baquedano concentró en Lurín unos 23.000 hombres. Nicolás de Piérola defendía Lima con dos líneas: la de San Juan y Chorrillos, del Morro Solar a Monterrico Chico, y la de Miraflores.',
    'Al amanecer atacaron las tres divisiones chilenas. La I División del coronel Patricio Lynch soportó el mayor esfuerzo en el cerro Marcavilca y el Morro Solar, defendidos por el I Cuerpo del coronel Miguel Iglesias. San Juan y Santa Teresa, con los cuerpos de Cáceres, Suárez y Dávila, cayeron hacia las 9; el Morro Solar resistió hasta el mediodía.',
    'El pueblo de Chorrillos ardió y fue saqueado, con muerte de civiles: una página dolorosa de la guerra. Chile tuvo más de 3.100 bajas, 797 de ellas muertos; las pérdidas peruanas se estiman entre 4.000 y 7.500 muertos, unos 3.000 heridos y miles de prisioneros. El comandante Yávar, de los Granaderos, murió esa noche en la hacienda San Juan.'],
  ['#BATALLA DE MIRAFLORES — 15 DE ENERO DE 1881',
    'Durante una tregua, mediada por el cuerpo diplomático, hacia las 14:30 se rompió el fuego. La línea peruana, del mar al río Surco, tenía diez reductos a unos 900 m uno de otro: a la derecha Cáceres, al centro Suárez y a la izquierda Dávila.',
    'En los reductos se batieron batallones de la Reserva: vecinos de Lima, abogados, comerciantes y artesanos. En el Nº 2, junto al ferrocarril, el batallón Nº 4 del abogado Ramón Ribeyro; en el Nº 3, frente a La Palma, el Nº 6 de Narciso de la Colina. Cáceres contraatacó con la Guarnición de Marina y el Jauja hasta agotar sus municiones.',
    'Hacia las 16 llegaron los refuerzos chilenos y la escuadra (Blanco Encalada, Huáscar, O\'Higgins y Pilcomayo) batió la línea. Al anochecer cayó Miraflores. Chile tuvo 502 muertos y 1.622 heridos; el Perú, cerca de 1.200 muertos y 2.000 heridos. El 17 de enero el ejército chileno ocupó Lima.'],
  ['#LOS CAÍDOS',
    'En Arica murieron Bolognesi, Alfonso Ugarte, Juan Guillermo More y gran parte de la guarnición peruana; del lado chileno cayó el comandante Juan José San Martín, del 4º de Línea. La tripulación del monitor Manco Cápac lo hundió en la bahía.',
    'En Tacna, Chorrillos y Miraflores cayeron miles de chilenos, peruanos y bolivianos. Este juego recrea esas acciones de armas como batallas en campo abierto sobre la geografía de cada lugar, y rinde homenaje a los combatientes de los tres países.',
    'Nota: la "chupilca del diablo" (aguardiente con pólvora) es una leyenda popularizada en el siglo XX por la novela "Adiós al Séptimo de Línea"; no aparece en fuentes primarias.']
];

// Páginas ajustadas al ancho de la pantalla (se generan tras cargar la fuente).
let HISTORY_PAGES = [];

// Una página cabe en 13 líneas (de y = 40 a 180): si un texto no cabe, se
// parte entre párrafos y la continuación repite el título.
const HIST_MAXLINES = 13;

function HIST_BuildPages() {
  HISTORY_PAGES.length = 0;
  for (const page of HISTORY_TEXT) {
    let head = [];
    let lines = [];
    for (const para of page) {
      if (para.startsWith('#')) {
        for (const w of HU_Wrap(para.slice(1), 288, false)) head.push('#' + w);
        head.push('');
        lines = head.slice();
        continue;
      }
      const block = HU_Wrap(para, 288, false);
      if (lines.length + block.length > HIST_MAXLINES && lines.length > head.length) {
        HISTORY_PAGES.push(lines);
        lines = head.slice();
      }
      for (const w of block) lines.push(w);
      lines.push('');
    }
    HISTORY_PAGES.push(lines);
  }
}

// Partes de operaciones antes de cada batalla.
const BRIEFINGS = {
  1: {
    title: 'PISAGUA',
    date: '2 de noviembre de 1879',
    text: 'Parte de operaciones. La escuadra ha batido los fuertes del puerto. Usted desembarca con la primera ola del Atacama y los Zapadores en Playa Blanca, bajo el fuego de los batallones Independencia y Victoria. Tome las trincheras de la playa, silencie el Fuerte Sur y suba por la gran duna o por el zigzag del ferrocarril hasta Alto Hospicio. Allí, como el teniente Torreblanca, deberá izar la bandera.',
    target: 'PISAGUA'
  },
  2: {
    title: 'DOLORES',
    date: '19 de noviembre de 1879',
    text: 'Parte de operaciones. Estamos en el cerro San Francisco, sobre los pozos de Dolores. Las columnas aliadas avanzan desde el sur por la pampa del Tamarugal, con su caballería. Defienda la batería del mayor Salvo junto al Atacama, el Coquimbo y el 4º de Línea, rechace a los Húsares y contraataque hasta capturar la artillería aliada.',
    target: 'DOLORES'
  },
  3: {
    title: 'TACNA',
    date: '26 de mayo de 1880',
    text: 'Parte de operaciones. El ejército aliado de Campero ocupa la meseta del Intiorko, al norte de Tacna. Usted marcha con el Atacama en la reserva del coronel Muñoz. Contenga el contraataque de los Colorados sobre la II División, asalte las trincheras del centro y, con la IV División, tome la batería Krupp del ala derecha. Arriba a la derecha: las fuerzas de cada bando.',
    target: 'TACNA'
  },
  4: {
    title: 'ARICA',
    date: '7 de junio de 1880',
    text: 'Parte de operaciones. Amanece. El coronel Lagos ordena el asalto. Avance con el 3º de Línea contra el fuerte Ciudadela y con el 4º contra el fuerte del Este. Cuidado con los polvorazos: el plano del ingeniero Elmore marca las minas. Tomados los fuertes, a la carrera por la meseta hasta la cumbre del Morro.',
    target: 'ARICA'
  },
  5: {
    title: 'CHORRILLOS',
    date: '13 de enero de 1881',
    text: 'Parte de operaciones. Amanece frente a la línea de San Juan. Usted va con la I División del coronel Lynch contra el cerro Marcavilca y el Morro Solar, donde están las baterías de Iglesias; a su derecha, Sotomayor y Lagos atacan San Juan y Santa Teresa. Tome Marcavilca, trepe el Morro Solar y limpie el pueblo de Chorrillos, donde se harán fuertes los dispersos. Ice la bandera en la plaza.',
    target: 'CHORRILLOS'
  },
  6: {
    title: 'MIRAFLORES',
    date: '15 de enero de 1881',
    text: 'Parte de operaciones. Rige una tregua mientras se negocia por Lima, pero la tropa está al alcance de la línea de Miraflores: diez reductos del mar al río Surco. Si se rompe el fuego, resista el contraataque de Cáceres, tome los reductos 1, 2 y 3, defendidos por la Reserva de Lima, y entre en Miraflores. La escuadra apoyará desde el mar.',
    target: 'MIRAFLORES'
  }
};

const FINALE_TEXT = [
  'El 17 de enero de 1881 el ejército chileno ocupó Lima. Piérola se retiró a la sierra.',
  '',
  'La guerra continuó con la campaña de la Sierra, donde Andrés Avelino Cáceres encabezó la resistencia peruana, hasta el Tratado de Ancón (20 de octubre de 1883) con el Perú y el Pacto de Tregua (4 de abril de 1884) con Bolivia.',
  '',
  'Miles de soldados y civiles chilenos, peruanos y bolivianos dieron la vida en estos desiertos y valles. Este juego es un homenaje a todos ellos.',
  '',
  'FIN DE LA CAMPAÑA'
];
