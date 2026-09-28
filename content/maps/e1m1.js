// =============================================================================
// E1M1 — Desembarco y combate de Pisagua (2 de noviembre de 1879)
// -----------------------------------------------------------------------------
// Geografía (comprimida a la escala del juego, oeste = océano Pacífico):
//   * La bahía con la escuadra chilena fondeada (Cochrane, O'Higgins,
//     Magallanes) y las lanchas del desembarco.
//   * Playa Guayacán/Playa Blanca con las trincheras aliadas y, detrás, el
//     pueblo de Pisagua (aduana, bodegas de salitre, estación e iglesia)
//     incendiado por el bombardeo.
//   * Los fuertes Norte y Sur en las puntas rocosas de la bahía.
//   * El farellón costero (unos 250 m en la realidad) que se sube por la gran
//     duna de arena o por el zigzag del ferrocarril.
//   * La meseta del Alto del Hospicio: la estación, la vía y la línea del
//     telégrafo donde el teniente Rafael Torreblanca izó la bandera.
// =============================================================================
'use strict';

MAPDEFS.push({
  lump: 'E1M1',
  info: {
    title: 'Desembarco de Pisagua',
    date: '2 de noviembre de 1879',
    sky: 'CIELO1',
    music: 'M_E1M1',
    par: 480,
    flagMessage: '¡Viva Chile! La bandera flamea en el Alto del Hospicio, como la izó el teniente Torreblanca a las 15:00.',
    mapItemName: 'Recogiste un plano de la bahía de Pisagua y sus fuertes.'
  },
  defaults: { floor: 0, ceil: TR_SKY, ftex: 'ARENA1', ctex: 'F_SKY1', light: 216, wall: 'ARENAW' },
  battle: {
    objectives: [
      { title: 'Tomar las trincheras de la playa', kill: 'trincheras', doneMsg: '¡Trincheras de la playa tomadas!' },
      { title: 'Silenciar el Fuerte Sur', kill: 'fuertesur', doneMsg: '¡El Fuerte Sur ha callado!' },
      { title: 'Subir al Alto del Hospicio', reach: 'hospicio', doneMsg: '¡Arriba! Estamos en el Alto del Hospicio.' },
      { title: 'Desalojar la estación del Hospicio', kill: 'estacion', after: 3, doneMsg: '¡La estación es nuestra! Ice la bandera en el mástil.' }
    ],
    events: [
      { trigger: { line: 'pueblo' }, msg: 'Los defensores contraatacan desde el pueblo.',
        spawn: [{ type: 'GUARDIA', count: 4, at: 'pueblonorte' }, { type: 'GUARDIA', count: 3, at: 'pueblosur' }] },
      { trigger: { objective: 1 }, msg: 'Desembarca la segunda ola: Atacama, Zapadores y el Buin.',
        spawn: [{ type: 'CHILENO', count: 6, at: 'olas2' }] },
      { trigger: { line: 'duna' },
        spawn: [{ type: 'BAYONETA', count: 3, at: 'dunatop' }, { type: 'GUARDIA', count: 3, at: 'dunatop' }] },
      { trigger: { line: 'zigzag' },
        spawn: [{ type: 'GUARDIA', count: 3, at: 'zigtop' }, { type: 'BOLIVIANO', count: 2, at: 'zigtop' }] },
      { trigger: { objective: 3 }, msg: 'Contraataque aliado sobre la estación del Hospicio.',
        spawn: [{ type: 'GUARDIA', count: 3, at: 'estacion', tag: 'estacion' }, { type: 'BOLIVIANO', count: 3, at: 'estacion', tag: 'estacion' },
          { type: 'CHILENO', count: 4, at: 'altochile' }] }
    ],
    bombards: [
      // La escuadra bate el pueblo y las laderas.
      { zone: [-1280, -1856, -512, 1856], interval: [80, 170], damage: 100, safe: 400, side: 1, stop: { objective: 3 } },
      { zone: [-512, -1984, 1152, 1984], interval: [110, 220], damage: 100, safe: 400, side: 1, stop: { objective: 3 } }
    ]
  },
  build: function (B) {
    const S = TR_SKY;
    // --- Océano Pacífico: techo-cielo bajo, el horizonte lo pone el panorama ---
    B.sector([[-7680, -6144], [-2304, -6144], [-2304, -2048], [-1792, -2048], [-1792, 2048], [-2304, 2048], [-2304, 6144], [-7680, 6144]],
      { floor: -16, ceil: -8, ftex: 'AGUA1', ctex: 'F_SKY1', light: 208, wall: 'ARENAW' });
    // Escuadra chilena fondeada frente al puerto.
    TR_Ship(B, -3584, 640, 832, 176, { masts: [-0.3, 0, 0.3], mastH: 380 });        // blindado Cochrane
    TR_Ship(B, -3072, -1152, 704, 144, { masts: [-0.32, 0.05, 0.32], mastH: 340 }); // corbeta O'Higgins
    TR_Ship(B, -4224, 2048, 576, 128, { masts: [-0.28, 0.28], mastH: 300 });        // cañonera Magallanes
    TR_Ship(B, -4480, -2688, 512, 112, { masts: [-0.25, 0.25], mastH: 280 });       // transporte
    // Muelle de Pisagua.
    B.sector(MC_Rect(-2432, -48, -1792, 48), { floor: 16, ftex: 'PISO1', wall: 'VIGA1', lower: 'VIGA1', light: 208 });

    // --- Tierra firme: playa, pueblo y farellón ---
    B.sector(MC_Rect(-1792, -2048, 3328, 2048), { floor: 0, ftex: 'ARENA1', wall: 'ARENAW' });
    B.sector(MC_Rect(-1792, -2048, -1664, 2048), { floor: 0, ftex: 'ARENA3', wall: 'ARENAW' });   // arena húmeda
    B.sector(MC_Rect(-1280, -1856, -512, 1856), { floor: 8, ftex: 'TIERRA1', wall: 'ARENAW', light: 208 });

    // Farellón: terrazas de roca; los tramos rectos son el zigzag y la duna.
    const straight = [[-2048, -640], [768, 1280]];
    TR_BandEast(B, -384, 3328, -2048, 2048, { floor: 192, ftex: 'ROCAF1', wall: 'ROCA1', lower: 'ROCA1' }, { amp: 56, seed: 11, straight: straight });
    TR_BandEast(B, 128, 3328, -2048, 2048, { floor: 384, ftex: 'ROCAF2', wall: 'ROCA2', lower: 'ROCA2' }, { amp: 56, seed: 12, straight: straight });
    TR_BandEast(B, 640, 3328, -2048, 2048, { floor: 576, ftex: 'ROCAF1', wall: 'ROCA4', lower: 'ROCA4' }, { amp: 56, seed: 13, straight: straight });
    TR_BandEast(B, 1152, 3328, -2048, 2048, { floor: 768, ftex: 'PAMPA1', wall: 'ROCA1', lower: 'ROCA1', light: 224 }, { amp: 56, seed: 14, straight: straight });

    // Zigzag del ferrocarril: tres tramos con descansos en las vueltas.
    const leg = function (h0, h1) { return function (k) { return Math.round(h0 + (h1 - h0) * Math.min(1, Math.max(0, (k - 1) / 19))); }; };
    const legProps = { ftex: 'CALICHE1', wall: 'ROCA2', lower: 'ROCA2', light: 212 };
    TR_RampY(B, -384, 128, -640, -2048, 22, leg(8, 256), legProps);
    TR_RampY(B, 128, 640, -2048, -640, 22, leg(256, 512), legProps);
    TR_RampY(B, 640, 1152, -640, -2048, 22, leg(512, 768), legProps);
    // Vía que baja del zigzag al pueblo.
    B.sector(MC_Rect(-512, -704, -384, -640), { floor: 8, ftex: 'RIELEW', wall: 'ARENAW' });
    B.sector(MC_Rect(-1280, -704, -512, -640), { floor: 8, ftex: 'RIELEW', wall: 'ARENAW', light: 208 });

    // La gran duna de arena.
    TR_RampX(B, -384, 1152, 768, 1280, 48, function (k) { return 16 * (k + 1); }, { ftex: 'ARENA2', wall: 'ARENAW', lower: 'ARENAW', light: 220 });

    // --- Puntas rocosas con los fuertes ---
    B.sector([[-2304, -2560], [3328, -2560], [3328, -2048], [-2304, -2048]], { floor: 768, ftex: 'ROCAF2', wall: 'ROCA2', lower: 'ROCA2' });
    B.sector([[-2304, 2048], [3328, 2048], [3328, 2560], [-2304, 2560]], { floor: 768, ftex: 'ROCAF2', wall: 'ROCA2', lower: 'ROCA2' });
    // Fuerte Sur
    B.sector(MC_Rect(-2304, -2432, -1408, -2048), { floor: 96, ftex: 'LOSA2', wall: 'ROCA2', lower: 'ROCA2', light: 208 });
    B.stairs(-1728, -2240, -1536, -2048, 'S', 6, 0, 16, { ftex: 'LOSA1', wall: 'PIEDRA1', lower: 'PIEDRA1' });
    B.sector(MC_Rect(-2272, -2400, -2208, -2112), { floor: 136, ftex: 'LOSA1', wall: 'PIEDRA3', lower: 'PIEDRA3' });
    TR_House(B, -1664, -2400, -1536, -2304, 96, 80, { tex: 'PIEDRA1', roof: 'LOSA1' });
    TR_Sign(B, -1664, -2316, 'x', 128, 176, 'CARTPOL');
    // Fuerte Norte (batido por la escuadra)
    B.sector(MC_Rect(-2304, 2048, -1408, 2432), { floor: 96, ftex: 'LOSA2', wall: 'ROCA2', lower: 'ROCA2', light: 200 });
    B.stairs(-1728, 2048, -1536, 2240, 'N', 6, 0, 16, { ftex: 'LOSA1', wall: 'PIEDRA1', lower: 'PIEDRA1' });
    B.sector(MC_Rect(-2272, 2112, -2208, 2400), { floor: 120, ftex: 'LOSA1', wall: 'PIEDRA3', lower: 'PIEDRA3' });
    TR_Rock(B, -1900, 2330, 56, 96, 20, 71, { ftex: 'LOSA2', wall: 'PIEDRA2', lower: 'PIEDRA2' });

    // --- Anillos de horizonte en la pampa ---
    const ring = { floor: 768, ceil: 776, ftex: 'PAMPA1', ctex: 'F_SKY1', wall: 'ROCA1', lower: 'ROCA1', light: 224 };
    B.sector(MC_Rect(3328, -2560, 3456, 2560), ring);
    B.sector(MC_Rect(-2304, 2560, 3456, 2688), ring);
    B.sector(MC_Rect(-2304, -2688, 3456, -2560), ring);

    // --- Trincheras aliadas en la playa (parapeto hacia el mar) ---
    for (const seg of [[-1728, -1216], [-1024, -448], [128, 704], [896, 1472]]) TR_TrenchNS(B, -1392, -1344, seg[0], seg[1], 0, -1);

    // --- Pueblo de Pisagua ---
    const colA = [-1216, -960], colB = [-896, -640];
    const tex = ['MADERA1', 'MADERA2', 'MADERA3', 'MADERA4', 'MADERA5', 'ADOBE2', 'CALAMIN'];
    const win = { MADERA1: 'MADERAV', MADERA2: 'MADERAV2', MADERA3: 'MADERAV', MADERA4: 'MADERAV2', MADERA5: 'MADERAV', ADOBE2: 'ADOBEV', CALAMIN: 'CALAMIN' };
    const special = {};
    special['A4'] = function () {    // Aduana
      TR_House(B, colA[0], -256, colA[1], 64, 8, 144, { tex: 'ADOBE2', sides: { W: 'ADOBEV', E: 'ADOBEV' }, doors: [{ side: 'W', at: -128 }], roof: 'TECHO2' });
      TR_Sign(B, -1208, -128, 'y', 128, 152, 'CARTADU');
    };
    special['A5'] = function () {    // Bodega de salitre
      TR_House(B, colA[0], 128, colA[1], 448, 8, 128, { tex: 'CALAMIN', sides: { W: 'CALAMIN2' }, doors: [{ side: 'W', at: 256, tex: 'PUERTA2' }], roof: 'CALAMF' });
      TR_Sign(B, -1208, 256, 'y', 128, 136, 'CARTSAL');
    };
    special['B2'] = function () {    // Estación del ferrocarril
      TR_House(B, colB[0], -1024, colB[1], -704, 8, 112, { tex: 'MADERA4', sides: { N: 'MADERAV2' }, doors: [{ side: 'N', at: -832 }], roof: 'CALAMF' });
      TR_Sign(B, -768, -716, 'x', 128, 120, 'CARTEST');
    };
    special['B5'] = function () {    // Plaza
      B.sector(MC_Rect(colB[0], 128, colB[1], 448), { floor: 8, ftex: 'LOSA2', wall: 'ARENAW', light: 212 });
    };
    special['B6'] = function () {    // Iglesia con campanario
      TR_House(B, colB[0], 512, colB[1], 832, 8, 160, { tex: 'ADOBE2', sides: { W: 'ADOBEV' }, doors: [{ side: 'W', at: 640 }], roof: 'TECHO1' });
      TR_Pillar(B, MC_Rect(-704, 768, -640, 832), 8 + 320, 'ADOBEV', 'TECHO2');
    };
    const burning = { A1: true, B4: true, A7: true, B8: true };
    for (let k = 0; k < 9; k++) {
      const y0 = -1792 + k * 384;
      for (const c of [['A', colA], ['B', colB]]) {
        const id = c[0] + k;
        if (special[id]) { special[id](); continue; }
        const x0 = c[1][0], x1 = c[1][1];
        const t = tex[Math.floor(TR_Hash(31, k * 2 + (c[0] === 'A' ? 0 : 1)) * tex.length)];
        const h = [96, 112, 128, 144][Math.floor(TR_Hash(37, k * 3 + (c[0] === 'A' ? 1 : 2)) * 4)];
        const face = burning[id] ? 'FUEGO1' : win[t];
        const sides = c[0] === 'A' ? { W: face, E: face } : { W: face, E: face };
        if (TR_Hash(41, k + (c[0] === 'A' ? 0 : 20)) < 0.5) {
          TR_House(B, x0, y0, x1, y0 + 320, 8, h, { tex: burning[id] ? 'FUEGO1' : t, sides: sides, doors: burning[id] ? [] : [{ side: 'W', at: y0 + 128 }], roof: 'TECHO1' });
        } else {
          TR_House(B, x0, y0, x1, y0 + 128, 8, h, { tex: burning[id] ? 'FUEGO1' : t, sides: sides, roof: 'TECHO2' });
          const t2 = tex[Math.floor(TR_Hash(43, k) * tex.length)];
          TR_House(B, x0, y0 + 192, x1, y0 + 320, 8, h - 16, { tex: t2, sides: { W: win[t2], E: win[t2] }, doors: [{ side: c[0] === 'A' ? 'W' : 'E', at: y0 + 256 }], roof: 'TECHO1' });
        }
      }
    }

    // --- Alto del Hospicio ---
    B.sector(MC_Rect(1152, -1984, 3328, -1920), { floor: 768, ftex: 'RIELEW', wall: 'ROCA1', light: 224 });
    TR_House(B, 2048, -1856, 2432, -1664, 768, 112, { tex: 'MADERA5', sides: { S: 'MADERAV' }, doors: [{ side: 'S', at: 2176 }], roof: 'CALAMF', light: 216 });
    TR_Sign(B, 2176, -1848, 'x', 128, 880, 'CARTHOS');
    TR_Pillar(B, MC_Circle(2688, -1536, 56, 8), 768 + 176, 'TANQUE1', 'HIERROF', 212);
    for (const wx of [1536, 1920]) B.sector(MC_Rect(wx, -1976, wx + 256, -1928), { floor: 768 + 64, ftex: 'PISO2', wall: 'VAGON1', lower: 'VAGON1', light: 216 });
    TR_FlagPole(B, 2656, -1752, 768);
    // Rocas y lomas de la pampa
    TR_Rock(B, 1500, 400, 80, 768, 48, 101, { ftex: 'PAMPA1' });
    TR_Rock(B, 2200, 600, 120, 768, 64, 102);
    TR_Rock(B, 2800, 200, 90, 768, 40, 103, { ftex: 'PAMPA1' });
    TR_Rock(B, 1680, -600, 100, 768, 56, 104);
    TR_Rock(B, 2600, 1400, 110, 768, 48, 105, { ftex: 'PAMPA1' });
    TR_Rock(B, 2080, 1700, 80, 768, 40, 106);
    // Rocas en las terrazas del farellón
    TR_Rock(B, -150, 200, 56, 192, 32, 111);
    TR_Rock(B, 360, 0, 64, 384, 40, 112);
    TR_Rock(B, 860, 300, 72, 576, 40, 113);
    TR_Rock(B, 420, 1650, 64, 384, 32, 114);
    TR_Rock(B, -120, -300, 48, 192, 24, 115);

    // --- Disparadores ---
    B.line([-1280, -1856], [-1280, 1856], { special: 952, tag: 'pueblo' });
    B.line([-384, 768], [-384, 1280], { special: 952, tag: 'duna' });
    B.line([-128, 768], [-128, 1280], { special: 950, tag: 'msgduna' });
    B.message('msgduna', 'La gran duna: bajo el fuego enemigo, el Atacama trepa por la arena.');
    B.line([-384, -896], [128, -896], { special: 952, tag: 'zigzag' });
    B.line([-384, -1344], [128, -1344], { special: 950, tag: 'msgzig' });
    B.message('msgzig', 'El zigzag del ferrocarril de Pisagua sube al Alto del Hospicio.');
    const ys = [-2560, -2048, -1984, -1920, 2048, 2560];
    for (let i = 0; i + 1 < ys.length; i++) B.line([1856, ys[i]], [1856, ys[i + 1]], { special: 951, tag: 'hospicio' });

    // --- Cosas ---
    B.thing('PLAYER1', -1720, -256, 0);
    // Primera ola: Atacama y Zapadores
    for (const p of [[-1700, -420], [-1740, -140], [-1680, -40], [-1760, -560], [-1650, -300]]) B.thing('CHILENO', p[0], p[1], 0);
    for (const p of [[-1760, -720, 90], [-1740, 220, 90], [-1770, 760, 90], [-1760, -1320, 90], [-1880, -600, 0], [-1950, 420, 0]]) B.thing('LANCHA', p[0], p[1], p[2]);
    B.thing('CAJONES', -1600, -150, 0);
    B.thing('CAJA_FUS', -1640, -210, 0);
    B.thing('CARTUCHOS', -1560, -330, 0);
    B.thing('CARAMAYOLA', -1600, 120, 0);
    B.thing('ANCLA', -1700, 980, 0);
    B.thing('SACOS', -1560, 520, 0);
    B.thing('SACOS', -1580, -980, 0);
    for (const p of [[-1560, -640], [-1500, 300], [-1620, 1180], [-1480, -1500]]) B.thing('CAIDO_CHILENO', p[0], p[1], 0);
    // Trincheras de la playa (Independencia y Victoria)
    const tr = [[-1368, -1600], [-1368, -1400], [-1368, -1280], [-1368, -960], [-1368, -760], [-1368, -520],
      [-1368, 200], [-1368, 420], [-1368, 640], [-1368, 960], [-1368, 1200], [-1368, 1420]];
    tr.forEach(function (p, i) { B.thing('BOLIVIANO', p[0], p[1], 180, { tag: 'trincheras', skill: i % 3 === 2 ? 'MH' : '' }); });
    B.thing('GUARDIA', -1368, -1120 + 1900, 180, { tag: 'trincheras', skill: 'H' });
    B.thing('CAIDO_BOLIVIANO', -1368, -300 - 400, 0);
    // Pueblo
    for (const p of [[-928, -1200], [-928, 300], [-576, -900], [-576, 1000], [-1248, 900], [-1248, -1300]]) B.thing('GUARDIA', p[0], p[1], 180);
    B.thing('BOLIVIANO', -1088, 1440, 180);                    // en la azotea
    B.thing('GUARDIA', -768, -480, 180, { skill: 'MH' });     // en la azotea
    B.thing('OFICIAL', -768, 300, 180, { skill: 'MH' });
    B.thing('CARTUCHOS', -928, -500, 0);
    B.thing('CAJA_FUS', -576, 200, 0);
    B.thing('CARAMAYOLA', -1248, 1240, 0);
    B.thing('BOTIQUIN', -928, 1300, 0);
    B.thing('PLANO', -770, 280, 0);
    B.thing('CHARQUI', -576, -1400, 0);
    B.thing('CARRETA', -576, -1560, 90);
    B.thing('PIPA', -700, 320, 0);
    for (let y = -1600; y <= 1600; y += 512) B.thing('FAROL', -1250, y, 0);
    B.thing('CAJONES', -1250, -300, 0);
    B.thing('SACOS', -928, -80, 0);
    B.thing('SACOS', -576, 560, 0);
    for (const p of [[-1088, -1232], [-768, -208], [-1088, 1072], [-768, 1328]]) B.thing('FUEGO', p[0], p[1], 0);
    for (const p of [[-1088, -1300], [-768, -120], [-1088, 1000], [-576, 1600]]) B.thing('HUMAREDA', p[0], p[1], 0);
    // Fuerte Sur (cañón Parrott de 100 libras)
    B.thing('ARTILLERO', -2112, -2256, 90, { tag: 'fuertesur' });
    for (const p of [[-1980, -2140], [-1880, -2330], [-2180, -2380]]) B.thing('GUARDIA', p[0], p[1], 90, { tag: 'fuertesur' });
    B.thing('BOLIVIANO', -1460, -2200, 90, { tag: 'fuertesur', skill: 'MH' });
    B.thing('CANON_COSTA', -1960, -2380, 90);
    for (const p of [[-1580, -2270], [-1520, -2276], [-1624, -2256]]) B.thing('BARRIL', p[0], p[1], 0);
    B.thing('BOTIQUIN', -1450, -2400, 0);
    // Fuerte Norte, en ruinas
    B.thing('CANON_COSTA', -2100, 2250, 200);
    for (const p of [[-2000, 2150], [-1880, 2380], [-1600, 2300]]) B.thing('CAIDO_PERUANO', p[0], p[1], 0);
    B.thing('FUEGO', -1960, 2400, 0);
    B.thing('HUMAREDA', -2060, 2300, 0);
    B.thing('CAJA_FUS', -1500, 2400, 0);
    B.thing('BOTIQUIN', -1450, 2150, 0);
    B.thing('ESCAPULARIO', -2240, 2420, 0);
    // Tiradores en las terrazas
    for (const p of [[-250, 0], [-200, 500], [-260, -380]]) B.thing('BOLIVIANO', p[0], p[1], 180);
    for (const p of [[250, 250], [300, -250]]) B.thing('BOLIVIANO', p[0], p[1], 180, { skill: 'MH' });
    B.thing('BOLIVIANO', 400, 1500, 180);
    B.thing('GUARDIA', 900, 1800, 180, { skill: 'MH' });
    B.thing('CARTUCHOS', -150, 330, 0);
    // Zigzag
    B.thing('GUARDIA', 380, -1300, 90);
    B.thing('GUARDIA', 380, -900, 90, { skill: 'MH' });
    B.thing('GUARDIA', 900, -1500, 90);
    B.thing('BOLIVIANO', 1000, -1100, 90);
    B.thing('CARAMAYOLA', 0, -1900, 0);
    B.thing('CAJA_FUS', 880, -700, 0);
    // Gran duna
    for (const p of [[0, 1000], [400, 1100], [760, 900]]) B.thing('CAIDO_CHILENO', p[0], p[1], 0);
    B.thing('CHARQUI', 200, 1180, 0);
    // Alto del Hospicio
    B.thing('OFICIAL', 2240, -1560, 270, { tag: 'estacion' });
    for (const p of [[2100, -1600], [2500, -1560], [2350, -1450]]) B.thing('GUARDIA', p[0], p[1], 180, { tag: 'estacion' });
    for (const p of [[1900, -1700], [2600, -1760]]) B.thing('BOLIVIANO', p[0], p[1], 180, { tag: 'estacion' });
    B.thing('BAYONETA', 2200, -1400, 180, { tag: 'estacion', skill: 'MH' });
    for (const p of [[2400, 800], [2000, 0], [2800, -400]]) B.thing('GUARDIA', p[0], p[1], 180);
    for (let x = 1280; x <= 3200; x += 384) B.thing('POSTE', x, -1896, 0);
    B.thing('SACOS', 2000, -1500, 0);
    B.thing('SACOS', 2520, -1400, 0);
    B.thing('CAJONES', 2470, -1700, 0);
    B.thing('CAJA_FUS', 1400, -1500, 0);
    B.thing('BOTIQUIN', 2800, -1200, 0);
    B.thing('CARAMAYOLA', 1300, 500, 0);
    B.thing('CHARQUI', 1600, 1500, 0);
    B.thing('ESTANDARTE', 2900, -1900, 0);
    // Puntos de aparición de los eventos
    const P = function (tag, pts) { for (const p of pts) B.thing('PUNTO', p[0], p[1], p[2] || 0, { tag: tag }); };
    P('olas2', [[-1720, -900], [-1720, 0], [-1720, 900]]);
    P('pueblonorte', [[-928, 1780, 270]]);
    P('pueblosur', [[-928, -1800, 90]]);
    P('dunatop', [[1350, 1024, 180], [1480, 880, 180], [1480, 1170, 180]]);
    P('zigtop', [[900, -1750, 90], [960, -1300, 90]]);
    P('estacion', [[2750, -1350, 180], [2950, -1650, 180], [2450, -1150, 180]]);
    P('altochile', [[1260, -1990, 0], [1320, -1780, 0]]);
  }
});
