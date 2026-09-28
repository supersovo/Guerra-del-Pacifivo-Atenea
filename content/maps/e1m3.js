// =============================================================================
// E1M3 — Batalla de Tacna o del Alto de la Alianza (26 de mayo de 1880)
// -----------------------------------------------------------------------------
// Batalla masiva. Geografía (comprimida):
//   * Al poniente, el llano desértico por donde avanzó el ejército chileno del
//     general Manuel Baquedano (cuatro divisiones y la reserva, 37 cañones).
//   * Al oriente, la falda y la meseta del cerro Intiorko ("Campo de la
//     Alianza"), unos 3 km al norte de Tacna, con la línea aliada del general
//     Narciso Campero: trincheras en la ceja de la meseta; en el centro, el
//     coronel Castro Pinto con los batallones bolivianos y dos reductos con
//     cañones; en el ala derecha (norte), el contralmirante Montero con la
//     batería Krupp boliviana en su reducto; en el ala izquierda (sur), el
//     coronel Camacho, y detrás la caballería boliviana.
//   * Tras la línea, el campamento aliado; más allá, el valle de Tacna.
// Desarrollo: duelo de artillería; avanzan las divisiones chilenas; los
// Colorados y el Aroma contraatacan por el ala izquierda aliada y la carga de
// los Granaderos de Yávar los contiene; Baquedano lanza la reserva (el
// jugador va con el Atacama) sobre el centro; la IV División envuelve el ala
// derecha y toma la artillería a la bayoneta; el ejército aliado se desbanda.
// =============================================================================
'use strict';

MAPDEFS.push({
  lump: 'E1M3',
  info: {
    title: 'Batalla de Tacna',
    date: '26 de mayo de 1880 · Alto de la Alianza',
    sky: 'CIELO4',
    music: 'M_TACNA',
    par: 720,
    flagMessage: '¡Victoria en el Alto de la Alianza! El ejército aliado se retira hacia Tacna; Bolivia deja la guerra.',
    mapItemName: 'Recogiste un croquis del Campo de la Alianza: la línea aliada aparece en la carta (TAB).'
  },
  defaults: { floor: 0, ceil: TR_SKY, ftex: 'PAMPA1', ctex: 'F_SKY1', light: 216, wall: 'TIERRA1' },
  battle: {
    massive: true,
    objectives: [
      { title: 'Contener el contraataque de los Colorados', short: 'Colorados', kill: 'colorados', percent: 0.7, rout: [3300, -2500], near: [-900, -1700, 1500],
        doneMsg: '¡Los Colorados retroceden! La II División recupera el terreno.' },
      { title: 'Tomar las trincheras del centro aliado', short: 'Centro aliado', kill: 'centro', percent: 0.72, rout: [3300, 0], after: 1, near: [800, 0, 900],
        doneMsg: '¡El centro aliado cede! Castro Pinto se repliega.' },
      { title: 'Capturar la batería Krupp del ala derecha', short: 'Batería', kill: 'bateria', percent: 0.85, after: 2, near: [1100, 1900, 800],
        doneMsg: '¡La IV División toma los cañones a la bayoneta!' },
      { title: 'Llegar al campamento aliado del Alto', reach: 'alto', after: 3, doneMsg: 'El Alto de la Alianza es nuestro. Ice la bandera en el campamento.' }
    ],
    events: [
      { trigger: { time: 8 }, msg: 'Duelo de artillería. Las divisiones chilenas avanzan sobre la meseta.' },
      { trigger: { time: 50 }, msg: '¡Contraataque aliado! Los Colorados y el Aroma cargan sobre la II División.',
        spawn: [{ type: 'COLORADO', count: 20, at: 'colorados', tag: 'colorados', spread: 150, goal: [-950, -1750] },
          { type: 'BOLIVIANO', count: 8, at: 'colorados', tag: 'colorados', spread: 150, goal: [-900, -1500] }] },
      { trigger: { time: 68 }, msg: '¡Carga de los Granaderos a caballo del comandante Tomás Yávar!',
        spawn: [{ type: 'GRANADERO', count: 8, at: 'granaderos', spread: 170, goal: [-1000, -1850] }] },
      { trigger: { time: 95 },
        spawn: [{ type: 'COLORADO', count: 8, at: 'colorados', tag: 'colorados', spread: 150, goal: [-700, -1900] }] },
      { trigger: { objective: 1 }, msg: 'Baquedano lanza la reserva del coronel Muñoz: ¡el Atacama al asalto del centro!',
        spawn: [{ type: 'CHILENO', count: 14, at: 'reserva', spread: 120, goal: [520, -100] }],
        orders: [{ tag: 'tercera', to: [560, 200], spread: 1 }, { tag: 'segunda', to: [480, -1900] }] },
      { trigger: { objective: 2 }, msg: 'La IV División del coronel Barbosa envuelve el ala derecha aliada.',
        spawn: [{ type: 'CHILENO', count: 16, at: 'cuarta', spread: 140, goal: [1000, 1880] },
          { type: 'BAYONETA', count: 6, at: 'campamento', tag: 'bateria', spread: 120, goal: [1150, 1700] },
          { type: 'GUARDIA', count: 6, at: 'campamento', tag: 'bateria', spread: 120, goal: [1250, 1500] }],
        orders: [{ tag: 'primera', to: [560, 1700] }] },
      { trigger: { objective: 3 }, msg: '¡El ejército aliado se desbanda hacia Tacna y Pachía!',
        orders: [{ tag: 'izquierda', to: [3350, -2500], flee: true }, { tag: 'centro', to: [3350, 200], flee: true },
          { tag: 'colorados', to: [3350, -2300], flee: true }, { tag: 'reservaal', to: [3350, 1200], flee: true }] }
    ],
    bombards: [
      // La artillería aliada (Krupp bolivianos y cañones peruanos) bate el llano.
      { zone: [-2400, -2600, -600, 2600], interval: [100, 190], damage: 100, safe: 420, side: 2, stop: { objective: 3 } },
      // Las baterías chilenas baten la ceja de la meseta.
      { zone: [620, -2600, 1500, 2600], interval: [90, 170], damage: 100, safe: 440, side: 1, stop: { objective: 3 } }
    ]
  },
  build: function (B) {
    // --- Llano, horizonte y quebrada ---
    B.sector(MC_Rect(-4608, -3072, 3584, 3072), { floor: 0, ftex: 'PAMPA1', wall: 'TIERRA1' });
    const ring = { floor: 0, ceil: 8, ftex: 'PAMPA1', ctex: 'F_SKY1', wall: 'TIERRA1', lower: 'TIERRA1', light: 216 };
    B.sector(MC_Rect(-4736, -3200, 3712, -3072), ring);
    B.sector(MC_Rect(-4736, 3072, 3712, 3200), ring);
    B.sector(MC_Rect(-4736, -3072, -4608, 3072), ring);
    B.sector(MC_Rect(3584, -3072, 3712, 3072), Object.assign({}, ring, { floor: 192, ceil: 200 }));
    B.sector(TR_Blob(-3300, 1500, 900, 520, 10, 401, 0.25), { floor: 0, ftex: 'ARENA4', wall: 'TIERRA1' });
    B.sector(TR_Blob(-3000, -1700, 800, 460, 10, 402, 0.25), { floor: 0, ftex: 'CALICHE1', wall: 'TIERRA1' });
    // Quebrada seca que cruza el llano de norte a sur (reparo para el avance).
    const qW = TR_EdgeV(-1620, -2700, 2700, { amp: 44, seed: 403 });
    const qE = TR_EdgeV(-1440, -2700, 2700, { amp: 44, seed: 404 });
    B.sector(qW.concat(qE.slice().reverse()), { floor: -24, ftex: 'TIERRA1', wall: 'TIERRA1', lower: 'TIERRA1', light: 204 });
    // Ferrocarril de Tacna a Arica en el extremo sur, con el telégrafo.
    B.sector(MC_Rect(-4608, -2944, -1792, -2880), { floor: 0, ftex: 'RIELEW', wall: 'TIERRA1' });

    // --- Falda del Intiorko: ocho terrazas de 24 hasta la meseta (192) ---
    for (let k = 0; k < 8; k++) {
      const props = k < 3 ? { ftex: 'PAMPA1', wall: 'TIERRA1', lower: 'TIERRA1' }
        : k < 6 ? { ftex: 'ARENA4', wall: 'ARENAW', lower: 'ARENAW' }
        : { ftex: 'CALICHE1', wall: 'CALICHEW', lower: 'CALICHEW', light: 224 };
      TR_BandEast(B, -700 + 170 * k, 3584, -3072, 3072, Object.assign({ floor: 24 * (k + 1) }, props), { amp: 40, step: 128, seed: 410 + k });
    }
    // Rocas volcánicas sueltas al pie de la falda (reparo para el avance).
    const volc = { ftex: 'ROCAF2', wall: 'ROCA2', lower: 'ROCA2' };
    TR_Rock(B, -960, 1800, 60, 0, 32, 421, volc);
    TR_Rock(B, -980, -2300, 58, 0, 32, 422, volc);
    TR_Rock(B, -1000, 300, 56, 0, 24, 423, volc);
    TR_Rock(B, -1020, -900, 60, 0, 32, 424, volc);
    TR_Rock(B, -2500, 400, 56, 0, 24, 426);
    TR_Rock(B, -2200, -900, 60, 0, 32, 427);
    TR_Rock(B, -3600, -500, 64, 0, 32, 428);

    // --- Línea aliada en la ceja de la meseta: trincheras con parapeto al oeste ---
    const trenches = [[-2600, -1800], [-1600, -800], [-600, 200], [400, 1200], [1400, 2600]];
    for (const t of trenches) TR_TrenchNS(B, 700, 748, t[0], t[1], 192, -1, { depth: 8 });
    // Dos reductos del centro (cañón y ametralladoras), abiertos a retaguardia.
    TR_Redoubt(B, 900, -420, 1156, -164, 192, 'E');
    TR_Redoubt(B, 900, 580, 1156, 836, 192, 'E');
    // Reducto de la batería Krupp boliviana en el ala derecha.
    TR_Redoubt(B, 880, 1640, 1360, 2160, 192, 'E');
    // Segunda línea: parapetos sueltos de sacos delante del campamento.
    for (const y of [-1500, -600, 400, 1300]) B.sector(MC_Rect(1480, y - 160, 1504, y + 160), { floor: 192 + 24, ftex: 'SACOSF', wall: 'SACOS2', lower: 'SACOS2' });

    // --- Campamento aliado del Alto ---
    for (let i = 0; i < 5; i++) {
      TR_Tent(B, 2000 + i * 180, 900, 2128 + i * 180, 996, 192);
      TR_Tent(B, 2000 + i * 180, -996, 2128 + i * 180, -900, 192);
    }
    TR_House(B, 2432, -192, 2816, 128, 192, 104, { tex: 'ADOBE3', sides: { W: 'ADOBEV' }, doors: [{ side: 'W', at: -64 }], roof: 'TECHO2', light: 216 });
    TR_Pillar(B, MC_Rect(3000, -700, 3048, -652), 192 + 150, 'MADVERT', 'PISO1');   // vigía
    TR_FlagPole(B, 2240, 0, 192);
    B.line([1800, -1500], [1800, 1500], { special: 951, tag: 'alto' });

    // Mensajes históricos.
    B.line([-900, -600], [-900, 600], { special: 950, tag: 'falda' });
    B.message('falda', 'Falda del Intiorko: arriba, la línea aliada del general Campero, presidente de Bolivia.');
    B.line([2300, 300], [2300, 800], { special: 950, tag: 'cuartel' });
    B.message('cuartel', 'Cuartel general aliado: Campero, Montero y Camacho dirigieron desde aquí la batalla.');

    // --- Cosas: el jugador con la reserva (regimiento Atacama) ---
    B.thing('PLAYER1', -3000, 0, 0);
    TR_Rank(B, 'CHILENO', -3150, -260, -3150, 260, 5, 0, { seed: 431 });
    TR_Rank(B, 'CHILENO', -3250, -200, -3250, 200, 4, 0, { seed: 432, skill: 'EM' });
    B.thing('DINAMITA_W', -2900, 120, 0);
    B.thing('CAJA_DIN', -2900, -120, 0);
    B.thing('CAJA_FUS', -3100, 380, 0);
    B.thing('CAJA_FUS', -3100, -380, 0);
    B.thing('GATLING', -2780, 0, 0);
    B.thing('BOTIQUIN', -3300, 0, 0);
    B.thing('CARRETA', -3400, 500, 0);
    B.thing('CARRETA', -3400, -500, 0);
    B.thing('ESTANDARTE', -3350, 250, 0);
    // Baterías chilenas en el llano (37 piezas en la batalla).
    for (const y of [-1500, -900, -300, 300, 900, 1500]) {
      B.thing('ARTILLERO_CL', -2500, y, 0, { hold: true });
      B.thing('CAJONES', -2620, y + 70, 0);
    }
    // I División (Amengual) al norte, II (Barceló) al sur, III (Amunátegui) al centro.
    TR_Ranks(B, 'CHILENO', -2150, 1000, -2150, 2500, 12, 2, -90, 0, 0, { tag: 'primera', advance: [1500, 0], seed: 441 });
    TR_Ranks(B, 'CHILENO', -2150, -2500, -2150, -1000, 12, 2, -90, 0, 0, { tag: 'segunda', advance: [1420, 0], seed: 442 });
    TR_Ranks(B, 'CHILENO', -2100, -620, -2100, 620, 10, 2, -90, 0, 0, { tag: 'tercera', advance: [1460, 0], seed: 443 });
    TR_Rank(B, 'CHILENO', -2350, -600, -2350, 600, 8, 0, { tag: 'tercera', advance: [1460, 0], seed: 444, skill: 'EM' });

    // --- Línea aliada ---
    // Ala izquierda (Camacho): bolivianos y peruanos de la 2ª y 3ª divisiones.
    TR_Rank(B, 'BOLIVIANO', 724, -2560, 724, -1840, 10, 180, { tag: 'izquierda', hold: true, seed: 451 });
    TR_Rank(B, 'GUARDIA', 724, -1560, 724, -840, 10, 180, { tag: 'izquierda', hold: true, seed: 452 });
    TR_Rank(B, 'GUARDIA', 820, -2400, 820, -1000, 8, 180, { tag: 'izquierda', hold: true, seed: 453, skill: 'MH' });
    // Centro (Castro Pinto): Padilla, Chorolque, Grau y Loa, con los reductos.
    TR_Rank(B, 'BOLIVIANO', 724, -560, 724, 160, 10, 180, { tag: 'centro', hold: true, seed: 461 });
    TR_Rank(B, 'BOLIVIANO', 724, 440, 724, 1160, 10, 180, { tag: 'centro', hold: true, seed: 462 });
    TR_Rank(B, 'GUARDIA', 1280, -900, 1280, 1300, 12, 180, { tag: 'centro', hold: true, seed: 463, skill: 'MH' });
    for (const r of [[-292, 'A'], [708, 'B']]) {
      B.thing('ARTILLERO', 960, r[0], 180, { tag: 'centro' });
      TR_Rank(B, 'BOLIVIANO', 1070, r[0] - 80, 1070, r[0] + 80, 3, 180, { tag: 'centro', hold: true, seed: 470 + r[0] });
    }
    B.thing('OFICIAL', 1200, 200, 180, { tag: 'centro' });
    // Avanzadas en la falda.
    TR_Rank(B, 'GUARDIA', 140, -2000, 140, 1600, 12, 180, { tag: 'centro', hold: true, seed: 464, skill: 'MH' });
    // Ala derecha (Montero): peruanos y la batería Krupp boliviana en su reducto.
    TR_Rank(B, 'GUARDIA', 724, 1440, 724, 2560, 12, 180, { tag: 'derecha', hold: true, seed: 481 });
    for (const y of [1740, 1900, 2060]) {
      B.thing('ARTILLERO', 960, y, 180, { tag: 'bateria' });
      B.thing('SACOS', 1030, y, 0);
    }
    TR_Rank(B, 'GUARDIA', 1150, 1720, 1150, 2080, 5, 180, { tag: 'bateria', hold: true, seed: 482 });
    TR_Rank(B, 'BAYONETA', 1260, 1760, 1260, 2040, 3, 180, { tag: 'bateria', hold: true, seed: 483 });
    B.thing('OFICIAL', 1220, 1830, 180, { tag: 'bateria' });
    B.thing('CAJONES', 1300, 1700, 0);
    // Caballería boliviana detrás del ala izquierda.
    TR_Rank(B, 'HUSAR', 1700, -2500, 1700, -1700, 6, 180, { tag: 'izquierda', hold: true, seed: 491 });
    // Reserva aliada en el campamento.
    TR_Rank(B, 'BOLIVIANO', 1900, -500, 1900, 500, 6, 180, { tag: 'reservaal', hold: true, seed: 492, skill: 'MH' });

    // Pertrechos y botín en la meseta.
    B.thing('CAJA_FUS', 1400, -200, 0);
    B.thing('BOTIQUIN', 1500, 900, 0);
    B.thing('CARTUCHOS', 1100, -1200, 0);
    B.thing('CHARQUI', 2100, -600, 0);
    B.thing('CARAMAYOLA', 2200, 600, 0);
    B.thing('PLANO', 2600, 300, 0);
    B.thing('ESCAPULARIO', -600, 2800, 0);
    B.thing('BOTIQUIN', -1500, -2600, 0);
    B.thing('CAJA_FUS', -1500, 2600, 0);
    B.thing('MOCHILA', -1540, 0, 0);
    for (const p of [[2100, 700], [2600, -700], [2900, 600]]) B.thing('FOGATA', p[0], p[1], 0);
    for (const p of [[2350, -1250], [2700, 1250], [3100, -300]]) B.thing('CARRETA', p[0], p[1], 90);
    B.thing('PIPA', 2350, 420, 0);
    B.thing('CAJONES', 2800, -420, 0);
    for (let x = -4400; x <= -2000; x += 400) B.thing('POSTE', x, -2840, 0);

    // --- Puntos de aparición ---
    const P = function (tag, pts) { for (const p of pts) B.thing('PUNTO', p[0], p[1], p[2] === undefined ? 180 : p[2], { tag: tag }); };
    P('colorados', [[900, -2300], [1100, -1950], [900, -1600], [1250, -2200]]);
    P('granaderos', [[-2700, -2500, 0], [-2500, -2750, 0], [-2900, -2200, 0]]);
    P('reserva', [[-1900, -250, 0], [-1900, 250, 0], [-2050, 0, 0]]);
    P('cuarta', [[-900, 2650, 0], [-700, 2800, 0], [-1100, 2500, 0]]);
    P('campamento', [[2300, 1600], [2500, 1900], [2200, 2200]]);
  }
});
