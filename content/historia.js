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
  ['#ASALTO Y TOMA DEL MORRO DE ARICA — 7 DE JUNIO DE 1880',
    'Tras la batalla de Tacna, Chile marchó sobre Arica, defendida por el coronel Francisco Bolognesi. El 5 de junio Bolognesi respondió al mayor Salvo que cumpliría sus deberes "hasta quemar el último cartucho".',
    'La plaza tenía los fuertes Ciudadela y del Este, las baterías del Morro y un sistema de minas ("polvorazos") del ingeniero Teodoro Elmore, capturado por los chilenos el 2 de junio.',
    'Al amanecer el coronel Pedro Lagos lanzó al 3º de Línea sobre la Ciudadela y al 4º sobre el fuerte del Este, con el Buin en reserva. Estalló el polvorín de la Ciudadela. A las 7:45, tras unos 55 minutos, flameó la bandera chilena en el Morro.'],
  ['#LOS CAÍDOS',
    'En Arica murieron Bolognesi, Alfonso Ugarte, Juan Guillermo More y gran parte de la guarnición peruana; del lado chileno cayó el comandante Juan José San Martín, del 4º de Línea. La tripulación del monitor Manco Cápac lo hundió en la bahía.',
    'Este juego recrea las acciones de armas como batallas en campo abierto sobre la geografía de cada lugar, y rinde homenaje a los combatientes de los tres países.',
    'Nota: la "chupilca del diablo" (aguardiente con pólvora) es una leyenda popularizada en el siglo XX por la novela "Adiós al Séptimo de Línea"; no aparece en fuentes primarias.']
];

// Páginas ajustadas al ancho de la pantalla (se generan tras cargar la fuente).
let HISTORY_PAGES = [];

function HIST_BuildPages() {
  HISTORY_PAGES.length = 0;
  for (const page of HISTORY_TEXT) {
    const lines = [];
    for (const para of page) {
      if (para.startsWith('#')) {
        for (const w of HU_Wrap(para.slice(1), 288, false)) lines.push('#' + w);
        lines.push('');
        continue;
      }
      for (const w of HU_Wrap(para, 288, false)) lines.push(w);
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
    title: 'ARICA',
    date: '7 de junio de 1880',
    text: 'Parte de operaciones. Amanece. El coronel Lagos ordena el asalto. Avance con el 3º de Línea contra el fuerte Ciudadela y con el 4º contra el fuerte del Este. Cuidado con los polvorazos: el plano del ingeniero Elmore marca las minas. Tomados los fuertes, a la carrera por la meseta hasta la cumbre del Morro.',
    target: 'ARICA'
  }
};

const FINALE_TEXT = [
  'Con la toma del Morro de Arica terminó la campaña de Tacna y Arica.',
  '',
  'La guerra continuaría con la campaña de Lima, las batallas de Chorrillos y Miraflores (enero de 1881) y la campaña de la Sierra, hasta el Tratado de Ancón (1883) con el Perú y el Pacto de Tregua (1884) con Bolivia.',
  '',
  'Miles de soldados chilenos, peruanos y bolivianos dieron la vida en estos desiertos. Este juego es un homenaje a todos ellos.',
  '',
  'FIN DE LA PRIMERA CAMPAÑA'
];
