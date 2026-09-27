// =============================================================================
// E1M2 — Batalla de Dolores o de San Francisco (19 de noviembre de 1879)
// -----------------------------------------------------------------------------
// Geografía (comprimida):
//   * El cerro San Francisco, ocupado por el ejército chileno del coronel
//     Emilio Sotomayor; en su falda sur, la batería del sargento mayor José de
//     la Cruz Salvo con piezas Krupp y dos ametralladoras Gatling.
//   * Al noroeste, los pozos de Dolores y la estación del ferrocarril, con el
//     campamento chileno.
//   * Al sur, la pampa del Tamarugal por donde avanzaron las columnas del
//     general Juan Buendía (Suárez, Buendía, Villamil) y los Húsares de Junín
//     y de Bolivia; la línea de la artillería aliada (18 piezas, perdidas en
//     la retirada) y la oficina salitrera Porvenir.
// =============================================================================
'use strict';

MAPDEFS.push({
  lump: 'E1M2',
  info: {
    title: 'Batalla de Dolores',
    date: '19 de noviembre de 1879',
    sky: 'CIELO2',
    music: 'M_E1M2',
    par: 540,
    flagMessage: '¡Victoria en San Francisco! Los aliados se retiran hacia Tarapacá dejando sus cañones.',
    mapItemName: 'Recogiste un croquis del cerro San Francisco y los pozos de Dolores.'
  },
  defaults: { floor: 0, ceil: TR_SKY, ftex: 'PAMPA1', ctex: 'F_SKY1', light: 216, wall: 'TIERRA1' },
  battle: {
    objectives: [
      { title: 'Defender la batería del mayor Salvo', kill: 'asalto', doneMsg: '¡Rechazado el asalto sobre la batería de Salvo!' },
      { title: 'Rechazar a los Húsares de Junín y de Bolivia', kill: 'husares', after: 1, doneMsg: '¡La caballería aliada se dispersa!' },
      { title: 'Capturar la artillería aliada en la pampa', kill: 'canones', after: 2, doneMsg: '¡Los cañones aliados son nuestros! Ice la bandera.' }
    ],
    events: [
      { trigger: { time: 6 }, msg: '¡Las columnas aliadas avanzan desde el sur por la pampa!',
        spawn: [{ type: 'BOLIVIANO', count: 6, at: 'sur', tag: 'asalto' }, { type: 'GUARDIA', count: 6, at: 'suroeste', tag: 'asalto' }] },
      { trigger: { time: 40 },
        spawn: [{ type: 'GUARDIA', count: 7, at: 'sur', tag: 'asalto' }, { type: 'OFICIAL', count: 1, at: 'sur', tag: 'asalto' }] },
      { trigger: { time: 62 }, msg: '¡Carga de los Húsares de Junín por el flanco este!',
        spawn: [{ type: 'HUSAR', count: 5, at: 'este', tag: 'husares', spread: 160 }] },
      { trigger: { time: 80 }, msg: '¡Asalto a la bayoneta sobre la batería de Salvo!',
        spawn: [{ type: 'BAYONETA', count: 6, at: 'sureste', tag: 'asalto' }, { type: 'BOLIVIANO', count: 4, at: 'sureste', tag: 'asalto' }] },
      { trigger: { objective: 1 }, msg: 'El 4º de Línea y el Coquimbo bajan del cerro: ¡al contraataque!',
        spawn: [{ type: 'CHILENO', count: 6, at: 'refuerzo' }] },
      { trigger: { objective: 2 },
        spawn: [{ type: 'GUARDIA', count: 3, at: 'canones', tag: 'canones' }, { type: 'BOLIVIANO', count: 3, at: 'canones', tag: 'canones' }] }
    ],
    bombards: [
      // La artillería aliada bate la falda sur del cerro.
      { zone: [-900, -300, 900, 1250], interval: [100, 200], damage: 100, safe: 360, stop: { objective: 3 } }
    ]
  },
  build: function (B) {
    // --- Pampa del Tamarugal y horizonte ---
    B.sector(MC_Rect(-3200, -3712, 3200, 2688), { floor: 0, ftex: 'PAMPA1', wall: 'TIERRA1' });
    const ring = { floor: 0, ceil: 8, ftex: 'PAMPA1', ctex: 'F_SKY1', wall: 'TIERRA1', lower: 'TIERRA1', light: 216 };
    B.sector(MC_Rect(-3328, -3840, 3328, -3712), ring);
    B.sector(MC_Rect(-3328, 2688, 3328, 2816), ring);
    B.sector(MC_Rect(-3328, -3712, -3200, 2688), ring);
    B.sector(MC_Rect(3200, -3712, 3328, 2688), ring);
    // Manchones de caliche y tierra en la pampa.
    B.sector(TR_Blob(-900, -1900, 700, 380, 9, 201, 0.25), { floor: 0, ftex: 'CALICHE1', wall: 'TIERRA1' });
    B.sector(TR_Blob(1400, -500, 600, 360, 9, 202, 0.25), { floor: 0, ftex: 'TIERRA1', wall: 'TIERRA1' });

    // --- Cerro San Francisco (13 curvas de 24) con la terraza de la batería al sur ---
    const N = 13, M = 24;
    TR_RadialHill(B, 0, 700, N, M, 24, 0, function (th, L, j) {
      const c = Math.cos(th), s = Math.sin(th);
      const ell = 1 / Math.sqrt((c / 1400) * (c / 1400) + (s / 900) * (s / 900));
      const south = Math.pow(Math.max(0, -s), 2);                   // 1 al sur, 0 al norte
      const noise = 1 + 0.09 * (TR_Hash(301, j) * 2 - 1) * (1 - south);
      let r = ell * noise * (1 - 0.9 * L / N);
      if (L <= 7) r *= 1 + 0.5 * south;                           // espolón sur: la terraza
      return r;
    }, function (L) {
      return L < 4 ? { ftex: 'TIERRA1', wall: 'TIERRA1', lower: 'TIERRA1' }
        : L < 9 ? { ftex: 'ROCAF2', wall: 'ROCA2', lower: 'ROCA2' }
        : { ftex: 'ROCAF1', wall: 'ROCA1', lower: 'ROCA1', light: 224 };
    });
    // Parapeto de la batería de Salvo (sacos) en la terraza del nivel 7.
    B.sector(MC_Rect(-160, 72, 160, 96), { floor: 192 + 24, ftex: 'SACOSF', wall: 'SACOS1', lower: 'SACOS1' });

    // --- Quebrada seca que cruza la pampa ---
    const qTop = TR_EdgeH(-1080, -1856, 2560, { amp: 40, seed: 21 });
    const qBot = TR_EdgeH(-1320, -1856, 2560, { amp: 40, seed: 22 });
    B.sector(qTop.concat(qBot.slice().reverse()), { floor: -24, ftex: 'TIERRA1', wall: 'TIERRA1', lower: 'TIERRA1', light: 200 });

    // --- Pozos de Dolores y estación del ferrocarril ---
    B.sector(MC_Rect(-2144, -3712, -2080, 2688), { floor: 0, ftex: 'RIELNS', wall: 'TIERRA1' });
    TR_House(B, -2560, 1088, -2176, 1280, 0, 112, { tex: 'MADERA4', sides: { E: 'MADERAV2' }, doors: [{ side: 'E', at: 1152 }], roof: 'CALAMF' });
    TR_Sign(B, -2188, 1152, 'y', 128, 112, 'CARTDOL');
    TR_House(B, -2560, 640, -2304, 832, 0, 96, { tex: 'CALAMIN', roof: 'CALAMF' });
    TR_Pillar(B, MC_Circle(-2400, 1500, 48, 8), 176, 'TANQUE1', 'HIERROF', 208);
    for (const w of [[-1800, 300], [-1690, 430], [-1910, 450]]) TR_Pillar(B, MC_Circle(w[0], w[1], 28, 8), 32, 'PIEDRA2', 'AGUA1', 200);
    TR_House(B, -1664, 512, -1536, 640, 0, 80, { tex: 'ADOBE3', roof: 'TECHO1' });
    TR_Sign(B, -1664, 516, 'x', 64, 80, 'CARTPOZ');
    // Campamento chileno
    for (const t of [[-2048, 832], [-1856, 832], [-2048, 1088], [-1856, 1088], [-2048, 1344], [-1856, 1344]]) TR_Tent(B, t[0], t[1], t[0] + 128, t[1] + 96, 0);

    // --- Oficina salitrera Porvenir ---
    TR_House(B, 1792, -2816, 2176, -2624, 0, 112, { tex: 'ADOBE3', sides: { N: 'ADOBEV' }, roof: 'TECHO2' });
    TR_Sign(B, 1920, -2636, 'x', 128, 112, 'CARTSAL');
    TR_House(B, 2240, -2752, 2560, -2560, 0, 96, { tex: 'CALAMIN2', roof: 'CALAMF' });
    TR_Pillar(B, MC_Rect(2176, -2560, 2240, -2496), 360, 'LADRIL1', 'HIERROF', 200);
    TR_Rock(B, 2400, -2300, 90, 0, 32, 211, { ftex: 'CALICHE1', wall: 'CALICHEW', lower: 'CALICHEW' });   // desmonte de caliche

    // --- Lomas bajas y rocas de la pampa (reparo) ---
    TR_Hill(B, -1700, -700, 360, 260, 0, 2, 16, 221, { ftex: 'PAMPA1', wall: 'TIERRA1', lower: 'TIERRA1' });
    TR_Hill(B, 2300, 300, 420, 300, 0, 3, 16, 222, { ftex: 'PAMPA1', wall: 'TIERRA1', lower: 'TIERRA1' });
    TR_Hill(B, -700, -2900, 380, 240, 0, 2, 16, 223, { ftex: 'PAMPA1', wall: 'TIERRA1', lower: 'TIERRA1' });
    TR_Rock(B, 700, -1800, 70, 0, 40, 231);
    TR_Rock(B, -1300, -2400, 60, 0, 32, 232);
    TR_Rock(B, 2600, -1600, 80, 0, 48, 233);
    TR_Rock(B, -2600, -1000, 70, 0, 40, 234);

    // Mensaje histórico junto a los pozos.
    B.line([-2000, 150], [-2000, 700], { special: 950, tag: 'pozos' });
    B.message('pozos', 'Los pozos de Dolores: el agua que sostenía al ejército en el desierto.');

    // Mástil para izar la bandera sobre los cañones capturados.
    TR_FlagPole(B, 0, -2720, 0);

    // --- Cosas ---
    B.thing('PLAYER1', 0, 250, 270);
    // Batería de Salvo (Krupp) y su guarnición
    for (const x of [-192, 0, 192]) B.thing('ARTILLERO_CL', x, 160, 270, { hold: true });
    for (const p of [[-300, 190], [300, 210]]) B.thing('CHILENO', p[0], p[1], 270, { hold: true });
    for (const p of [[-520, 380], [520, 380], [-160, 400], [160, 420]]) B.thing('CHILENO', p[0], p[1], 270);
    B.thing('CHILENO', -120, 900, 270, { hold: true });
    B.thing('CHILENO', 120, 920, 270, { hold: true });
    B.thing('GATLING', 90, 250, 0);
    B.thing('CAJA_FUS', -90, 260, 0);
    B.thing('CAJA_FUS', 260, 300, 0);
    B.thing('CARTUCHOS', -260, 290, 0);
    for (const p of [[-300, 110], [300, 110], [-96, 48], [96, 48]]) B.thing('SACOS', p[0], p[1], 0);
    B.thing('CANON_KRUPP', 380, 260, 250);
    B.thing('CAJONES', -380, 280, 0);
    B.thing('ESTANDARTE', 0, 960, 0);
    B.thing('BOTIQUIN', -40, 1000, 0);
    // Pozos, estación y campamento
    for (const p of [[-1750, 360], [-1850, 520], [-1960, 360]]) B.thing('CARAMAYOLA', p[0], p[1], 0);
    B.thing('PIPA', -1620, 330, 0);
    B.thing('PIPA', -2040, 300, 90);
    B.thing('CARRETA', -1600, 1250, 0);
    B.thing('FOGATA', -1780, 1000, 0);
    B.thing('BOTIQUIN', -2240, 1000, 0);
    B.thing('CAJA_FUS', -1400, 900, 0);
    B.thing('CHUPILCA', -1500, 1020, 0);
    B.thing('PLANO', -2200, 1350, 0);
    for (let y = -3200; y <= 2400; y += 400) B.thing('POSTE', -2040, y, 0);
    // Tamarugos de la pampa
    const trees = [[-2300, -300], [-2600, 200], [-1200, -800], [-400, -1600], [300, -2000], [1100, -1500], [1900, -1200],
      [2500, -900], [2200, 1200], [1200, 1700], [-800, 1900], [-2700, -2200], [-1800, -3000], [600, -3100], [1500, -3300],
      [2800, 300], [-2900, 1700], [900, 2200], [-2000, -1700], [2700, -2900]];
    for (const t of trees) B.thing('TAMARUGO', t[0], t[1], 0);
    // Avanzadas aliadas en la quebrada
    for (const p of [[-600, -1200], [400, -1180], [1300, -1220]]) B.thing('GUARDIA', p[0], p[1], 90);
    for (const p of [[-1100, -1200], [900, -1210], [1800, -1190]]) B.thing('BOLIVIANO', p[0], p[1], 90, { skill: 'MH' });
    // Línea de la artillería aliada
    for (const x of [-900, -300, 300, 900]) {
      const y = (x === -900 || x === 900) ? -2400 : -2460;
      B.thing('ARTILLERO', x, y, 90, { tag: 'canones' });
      B.thing('SACOS', x - 56, y + 64, 0);
      B.thing('SACOS', x + 56, y + 64, 0);
      B.thing('CARRETA', x, y - 150, 90);
      B.thing('GUARDIA', x + 90, y - 40, 90, { tag: 'canones' });
    }
    B.thing('OFICIAL', 0, -2560, 90, { tag: 'canones' });
    B.thing('CAJONES', -600, -2560, 0);
    B.thing('CAJONES', 600, -2560, 0);
    B.thing('CAJA_FUS', 0, -2400, 0);
    B.thing('BOTIQUIN', -1200, -2600, 0);
    B.thing('CARTUCHOS', 1200, -2600, 0);
    B.thing('ESCAPULARIO', 2380, -2500, 0);
    B.thing('CHARQUI', 1500, -600, 0);
    B.thing('CARAMAYOLA', 2300, 320, 0);
    // Caídos de ambos bandos en la falda del cerro
    for (const p of [[-350, -150], [250, -250], [-100, -420]]) B.thing('CAIDO_BOLIVIANO', p[0], p[1], 0);
    B.thing('CAIDO_PERUANO', 600, -350, 0);
    B.thing('CABALLO_CAIDO', 1300, -300, 0);
    // Puntos de aparición
    const P = function (tag, pts) { for (const p of pts) B.thing('PUNTO', p[0], p[1], p[2] || 90, { tag: tag }); };
    P('sur', [[-400, -3100], [400, -3100], [0, -3400]]);
    P('suroeste', [[-1600, -2800], [-2000, -2300]]);
    P('sureste', [[1500, -2400], [1800, -2000], [1200, -2900]]);
    P('este', [[2900, -600, 180], [2900, 100, 180], [2900, 800, 180]]);
    P('refuerzo', [[-400, 880, 270], [400, 880, 270]]);
    P('canones', [[-600, -2900], [600, -2900]]);
  }
});
