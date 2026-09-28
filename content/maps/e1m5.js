// =============================================================================
// E1M5 — Batalla de San Juan y Chorrillos (13 de enero de 1881)
// -----------------------------------------------------------------------------
// Batalla masiva, la mayor librada en Sudamérica hasta entonces. Geografía
// (comprimida; el norte es Lima, el sur la llanura por donde llegó el
// ejército chileno desde Lurín):
//   * Al suroeste, junto al mar, el Morro Solar con las baterías del I Cuerpo
//     peruano del coronel Miguel Iglesias; al este de él, el cerro Marcavilca.
//   * Al este, la línea de San Juan y Santa Teresa: trincheras, reductos y
//     las haciendas, defendida por los cuerpos de Cáceres, Suárez y Dávila.
//   * Al norte del Morro, el pueblo balneario de Chorrillos, con su iglesia,
//     sus ranchos y el ferrocarril a Lima.
// Desarrollo: al amanecer la I División de Lynch (con la que marcha el
// jugador) ataca Marcavilca y el Morro Solar; Sotomayor y Lagos atacan San
// Juan y Santa Teresa, que caen hacia las 9; el Morro Solar resiste hasta el
// mediodía; los dispersos se hacen fuertes en Chorrillos, que arde.
// =============================================================================
'use strict';

MAPDEFS.push({
  lump: 'E1M5',
  info: {
    title: 'Batalla de Chorrillos',
    date: '13 de enero de 1881 · San Juan y Chorrillos',
    sky: 'CIELO5',
    music: 'M_LIMA1',
    par: 780,
    flagMessage: 'Cae Chorrillos. El ejército peruano se repliega sobre la línea de Miraflores.',
    mapItemName: 'Recogiste un croquis de la línea de San Juan: las posiciones aparecen en la carta (TAB).'
  },
  defaults: { floor: 0, ceil: TR_SKY, ftex: 'ARENA2', ctex: 'F_SKY1', light: 204, wall: 'ARENAW' },
  battle: {
    massive: true,
    objectives: [
      { title: 'Tomar las trincheras del cerro Marcavilca', short: 'Marcavilca', kill: 'marcavilca', percent: 0.7, rout: [-2100, 600], near: [-500, -1900, 1000],
        doneMsg: '¡Marcavilca es nuestro! Los defensores huyen hacia el Morro y el pueblo.' },
      { title: 'Romper la línea de San Juan y Santa Teresa', short: 'San Juan', kill: 'sanjuan', percent: 0.65, rout: [2600, 2950],
        doneMsg: '¡Caen San Juan y Santa Teresa! La línea peruana se rompe.' },
      { title: 'Asaltar las baterías del Morro Solar', short: 'Morro Solar', kill: 'morro', percent: 0.8, after: 1, near: [-2200, -1350, 800],
        doneMsg: 'Mediodía: Iglesias se rinde en la cumbre del Morro Solar.' },
      { title: 'Limpiar el pueblo de Chorrillos', short: 'Chorrillos', kill: 'pueblo', percent: 0.8, rout: [-1400, 3000], after: 3,
        doneMsg: 'Chorrillos arde. Ice la bandera en la plaza.' }
    ],
    events: [
      { trigger: { time: 6 }, msg: 'Amanece. Lynch ataca el Morro Solar; Sotomayor y Lagos, San Juan y Santa Teresa.' },
      { trigger: { time: 35 }, msg: 'Iglesias refuerza Marcavilca desde el Morro Solar.',
        spawn: [{ type: 'GUARDIA', count: 8, at: 'morrobajada', tag: 'marcavilca', spread: 110, goal: [-560, -1760] }] },
      { trigger: { time: 70 }, msg: 'La III División de Lagos entra en combate sobre San Juan.',
        spawn: [{ type: 'CHILENO', count: 20, at: 'lagos', spread: 160, goal: [2700, -1160] }] },
      { trigger: { time: 120 }, msg: '¡Contraataque del coronel Cáceres en San Juan!',
        spawn: [{ type: 'BAYONETA', count: 8, at: 'sanjuann', tag: 'sanjuan', spread: 140, goal: [1900, -1100] },
          { type: 'GUARDIA', count: 8, at: 'sanjuann', tag: 'sanjuan', spread: 140, goal: [2100, -1050] }] },
      { trigger: { objective: 1 }, msg: 'El Atacama y el Talca trepan el Morro Solar. ¡A la cumbre!',
        spawn: [{ type: 'CHILENO', count: 14, at: 'morropie', spread: 130, goal: [-2100, -1250] }],
        orders: [{ tag: 'lynch', to: [-1850, -1250], spread: 0.6 }] },
      { trigger: { objective: 2 }, msg: 'Los Granaderos persiguen a los dispersos. El comandante Yávar cae herido de muerte en San Juan.',
        spawn: [{ type: 'GRANADERO', count: 10, at: 'caballeria', spread: 180, goal: [2500, 1700] }],
        orders: [{ tag: 'sotomayor', to: [1600, 300], spread: 0.8 }] },
      { trigger: { objective: 3 }, msg: 'Los dispersos se hacen fuertes en las casas de Chorrillos.',
        spawn: [{ type: 'GUARDIA', count: 8, at: 'pueblo', tag: 'pueblo', spread: 120, hold: true },
          { type: 'BAYONETA', count: 4, at: 'pueblo', tag: 'pueblo', spread: 120, hold: true },
          { type: 'OFICIAL', count: 1, at: 'pueblo', tag: 'pueblo', spread: 60, hold: true }],
        orders: [{ tag: 'lynch', to: [-1700, 500], spread: 0.6 }] }
    ],
    bombards: [
      // Las baterías del Morro Solar baten la llanura del sur.
      { zone: [-2600, -3350, 600, -2350], interval: [100, 200], damage: 100, safe: 420, side: 2, stop: { objective: 3 } },
      // Artillería chilena y la escuadra sobre el Morro Solar.
      { zone: [-2900, -1950, -1650, -800], interval: [100, 190], damage: 100, safe: 440, side: 1, stop: { objective: 3 } },
      // Artillería chilena sobre la línea de San Juan.
      { zone: [-200, -950, 3700, -250], interval: [90, 170], damage: 100, safe: 440, side: 1, stop: { objective: 2 } }
    ]
  },
  build: function (B) {
    // --- Mar, playa y horizonte ---
    B.sector([[-8192, -7168], [-3328, -7168], [-3328, 7168], [-8192, 7168]],
      { floor: -16, ceil: -8, ftex: 'AGUA1', ctex: 'F_SKY1', light: 204, wall: 'ARENAW' });
    TR_Ship(B, -4400, -1400, 800, 170, { masts: [-0.3, 0, 0.3], mastH: 380 });   // Blanco Encalada
    TR_Ship(B, -5000, 300, 640, 140, { masts: [-0.3, 0.3], mastH: 330 });        // O'Higgins
    B.sector(MC_Rect(-3328, -3584, 4096, 3072), { floor: 0, ftex: 'ARENA2', wall: 'ARENAW' });
    B.sector(MC_Rect(-3328, -3584, -3200, 3072), { floor: 0, ftex: 'ARENA3', wall: 'ARENAW' });
    const ring = { floor: 0, ceil: 8, ftex: 'ARENA2', ctex: 'F_SKY1', wall: 'ARENAW', lower: 'ARENAW', light: 204 };
    B.sector(MC_Rect(-3328, -3712, 4224, -3584), ring);
    B.sector(MC_Rect(-3328, 3072, 4224, 3200), ring);
    B.sector(MC_Rect(4096, -3584, 4224, 3072), ring);
    // Llanura del sur (tablada) y chacras del valle al norte.
    B.sector(TR_Blob(1600, -2900, 1500, 420, 12, 501, 0.2), { floor: 0, ftex: 'ARENA4', wall: 'ARENAW' });
    B.sector(MC_Rect(-1100, 1200, 200, 2900), { floor: 0, ftex: 'CHACRA1', wall: 'ADOBE1' });
    B.sector(MC_Rect(400, 1500, 1900, 2900), { floor: 0, ftex: 'PASTO1', wall: 'ADOBE1' });
    B.sector(MC_Rect(3000, 1600, 3900, 2900), { floor: 0, ftex: 'CHACRA1', wall: 'ADOBE1' });
    B.sector(MC_Rect(400, 400, 900, 1300), { floor: 0, ftex: 'PASTO1', wall: 'ADOBE1' });
    // Tapias de adobe de los potreros (con portillos).
    const tapia = { floor: 56, ftex: 'TIERRA1', wall: 'ADOBE1', lower: 'ADOBE1', light: 196 };
    B.sector(MC_Rect(-1100, 1200, -600, 1216), tapia);
    B.sector(MC_Rect(-440, 1200, 200, 1216), tapia);
    B.sector(MC_Rect(400, 1500, 1000, 1516), tapia);
    B.sector(MC_Rect(1160, 1500, 1900, 1516), tapia);
    B.sector(MC_Rect(3000, 1600, 3500, 1616), tapia);
    B.sector(MC_Rect(3660, 1600, 3900, 1616), tapia);
    // Ferrocarril de Chorrillos a Lima.
    B.sector(MC_Rect(-1440, 360, -1376, 3072), { floor: 0, ftex: 'RIELNS', wall: 'ARENAW' });

    // --- Morro Solar: 16 terrazas de 24 hasta las baterías (384) ---
    TR_RadialHill(B, -2200, -1350, 16, 28, 24, 0, function (th, L, j) {
      const c = Math.cos(th), s = Math.sin(th);
      const ell = 1 / Math.sqrt((c / 850) * (c / 850) + (s / 780) * (s / 780));
      const noise = 1 + 0.08 * (TR_Hash(511, j) * 2 - 1);
      return ell * noise * (1 - 0.82 * L / 16);
    }, function (L) {
      return L < 5 ? { ftex: 'ARENA4', wall: 'ARENAW', lower: 'ARENAW' }
        : L < 11 ? { ftex: 'ROCAF2', wall: 'ROCA2', lower: 'ROCA2' }
        : { ftex: 'ROCAF1', wall: 'ROCA1', lower: 'ROCA1', light: 216 };
    });
    // --- Cerro Marcavilca: 8 terrazas hasta 192 ---
    TR_RadialHill(B, -500, -1800, 8, 20, 24, 0, function (th, L, j) {
      const c = Math.cos(th), s = Math.sin(th);
      const ell = 1 / Math.sqrt((c / 520) * (c / 520) + (s / 420) * (s / 420));
      return ell * (1 + 0.08 * (TR_Hash(512, j) * 2 - 1)) * (1 - 0.72 * L / 8);
    }, function (L) {
      return L < 4 ? { ftex: 'ARENA4', wall: 'ARENAW', lower: 'ARENAW' } : { ftex: 'ROCAF2', wall: 'ROCA2', lower: 'ROCA2' };
    });
    // Trinchera al pie sur de Marcavilca (parapeto al sur).
    TR_TrenchEW(B, -1000, 0, -2420, -2372, 0, -1, { depth: 8 });

    // --- Línea de San Juan y Santa Teresa: trincheras con parapeto al sur ---
    for (const s of [[-300, 500], [700, 1500], [1700, 2500], [2700, 3500]]) TR_TrenchEW(B, s[0], s[1], -760, -712, 0, -1, { depth: 8 });
    TR_Redoubt(B, 900, -560, 1150, -310, 0, 'N');
    TR_Redoubt(B, 2500, -560, 2750, -310, 0, 'N');
    // Lomas de San Juan (segunda posición)
    TR_Hill(B, 1300, 150, 380, 240, 0, 3, 24, 521, { ftex: 'ARENA4', wall: 'ARENAW', lower: 'ARENAW' });
    TR_Hill(B, 2900, 400, 420, 260, 0, 3, 24, 522, { ftex: 'ARENA4', wall: 'ARENAW', lower: 'ARENAW' });
    // Haciendas San Juan y Santa Teresa
    TR_House(B, 2240, 896, 2624, 1152, 0, 112, { tex: 'ADOBE3', sides: { S: 'ADOBEV' }, doors: [{ side: 'S', at: 2368 }], roof: 'TECHO2' });
    TR_House(B, 2688, 896, 2880, 1088, 0, 96, { tex: 'ADOBE1', roof: 'TECHO1' });
    TR_Sign(B, 2368, 912, 'x', 128, 112, 'CARTSJU');
    TR_House(B, 512, 448, 768, 640, 0, 104, { tex: 'ADOBE3', sides: { S: 'ADOBEV' }, doors: [{ side: 'S', at: 576 }], roof: 'TECHO2' });
    TR_Pillar(B, MC_Rect(3296, 832, 3344, 880), 150, 'LADRIL1', 'HIERROF');   // chimenea del trapiche

    // --- Pueblo de Chorrillos ---
    const burning = { '1,1': true, '2,3': true, '0,4': true, '3,0': true, '1,3': true };
    const cols = [[-3072, -2816], [-2688, -2432], [-2304, -2048], [-1920, -1664]];
    const rows = [[128, 384], [512, 768], [896, 1152], [1280, 1536], [1664, 1920]];
    const texs = ['ADOBE2', 'MADERA4', 'ADOBE1', 'MADERA5', 'ADOBE3'];
    for (let c = 0; c < cols.length; c++) {
      for (let r = 0; r < rows.length; r++) {
        if (c === 2 && r === 2) continue;   // plaza
        const id = c + ',' + r;
        const x0 = cols[c][0], x1 = cols[c][1], y0 = rows[r][0], y1 = rows[r][1];
        const t = texs[(c * 3 + r) % texs.length];
        const h = 96 + ((c + r) % 3) * 24;
        if (c === 3 && r === 2) {
          // iglesia de Chorrillos frente a la plaza, con su torre
          TR_House(B, x0, y0, x1, y1, 0, 160, { tex: 'PIEDRA1', sides: { W: 'PIEDRA3' }, doors: [{ side: 'W', at: 992, w: 64 }], roof: 'TECHO2' });
          TR_Pillar(B, MC_Rect(x0 + 16, y1 - 80, x0 + 80, y1 - 16), 300, 'PIEDRA1', 'TECHO2');
          continue;
        }
        const side = c < 2 ? 'E' : 'W';
        TR_House(B, x0, y0, x1, y1, 0, h, { tex: burning[id] ? 'FUEGO1' : t, doors: burning[id] ? [] : [{ side: side, at: y0 + 64 }], roof: r % 2 ? 'TECHO1' : 'CALAMF' });
      }
    }
    TR_Sign(B, -2452, 960, 'y', 128, 96, 'CARTCHO');
    TR_FlagPole(B, -2176, 1024, 0);
    B.line([-3100, 60], [-1500, 60], { special: 950, tag: 'chorrillos' });
    B.message('chorrillos', 'Chorrillos, balneario de Lima: sus ranchos arden tras la batalla.');
    B.line([-900, -3000], [-100, -3000], { special: 950, tag: 'amanecer' });
    B.message('amanecer', 'Al frente, el Morro Solar y Marcavilca; a la derecha, San Juan y Santa Teresa.');

    // --- Cosas: el jugador con la I División de Lynch ---
    B.thing('PLAYER1', -1300, -3350, 90);
    TR_Rank(B, 'CHILENO', -1560, -3450, -1040, -3450, 6, 90, { seed: 531 });
    TR_Ranks(B, 'CHILENO', -2500, -3100, -1500, -3100, 10, 2, 0, -80, 90, { tag: 'lynch', advance: [0, 560], seed: 532 });
    TR_Ranks(B, 'CHILENO', -1100, -3150, 100, -3150, 10, 2, 0, -80, 90, { tag: 'lynch', advance: [0, 600], seed: 533 });
    B.thing('CAJA_FUS', -1200, -3250, 0);
    B.thing('CAJA_FUS', -1400, -3250, 0);
    B.thing('CAJA_DIN', -1300, -3150, 0);
    B.thing('BOTIQUIN', -1000, -3300, 0);
    B.thing('GATLING', -1600, -3300, 0);
    B.thing('ESTANDARTE', -1300, -3480, 0);
    // II División (Sotomayor) frente a San Juan y Santa Teresa
    TR_Ranks(B, 'CHILENO', 500, -3100, 3300, -3100, 16, 2, 0, -80, 90, { tag: 'sotomayor', advance: [0, 1900], seed: 534 });
    // Artillería chilena
    for (const x of [-1800, -400, 900, 2100, 3200]) {
      B.thing('ARTILLERO_CL', x, -3350, 90, { hold: true });
      B.thing('CAJONES', x + 70, -3440, 0);
    }

    // --- Defensores peruanos ---
    // Marcavilca: trinchera al pie y terrazas
    TR_Rank(B, 'GUARDIA', -960, -2396, -40, -2396, 12, 270, { tag: 'marcavilca', hold: true, seed: 541 });
    TR_Rank(B, 'GUARDIA', -780, -1700, -220, -1700, 6, 270, { tag: 'marcavilca', hold: true, seed: 542 });
    TR_Rank(B, 'BAYONETA', -700, -1900, -300, -1900, 4, 270, { tag: 'marcavilca', hold: true, seed: 543 });
    B.thing('OFICIAL', -500, -1800, 270, { tag: 'marcavilca' });
    // Morro Solar: baterías de la cumbre y tropas en las terrazas
    for (const p of [[-2280, -1330], [-2120, -1400], [-2200, -1260]]) B.thing('ARTILLERO', p[0], p[1], 270, { tag: 'morro' });
    B.thing('CANON_COSTA', -2300, -1440, 250);
    TR_Rank(B, 'GUARDIA', -2350, -1500, -2050, -1500, 4, 270, { tag: 'morro', hold: true, seed: 551 });
    B.thing('OFICIAL', -2200, -1180, 270, { tag: 'morro' });
    for (let k = 0; k < 18; k++) {
      // anillo de defensores entre las terrazas 6 y 11
      const a = (k + 0.5) / 18 * Math.PI * 2;
      const rr = 0.52 + (k % 3) * 0.06;
      const x = Math.round(-2200 + Math.cos(a) * 850 * rr), y = Math.round(-1350 + Math.sin(a) * 780 * rr);
      B.thing(k % 4 === 0 ? 'BAYONETA' : 'GUARDIA', x, y, Math.round(a * 180 / Math.PI), { tag: 'morro', hold: true, skill: k % 5 === 4 ? 'MH' : undefined });
    }
    // Línea de San Juan: trincheras, reductos y segunda posición
    for (const s of [[-300, 500], [700, 1500], [1700, 2500], [2700, 3500]]) {
      TR_Rank(B, 'GUARDIA', s[0] + 40, -736, s[1] - 40, -736, 9, 270, { tag: 'sanjuan', hold: true, seed: 560 + s[0] });
    }
    for (const x of [1025, 2625]) {
      B.thing('ARTILLERO', x, -470, 270, { tag: 'sanjuan' });
      TR_Rank(B, 'BAYONETA', x - 80, -380, x + 80, -380, 3, 270, { tag: 'sanjuan', hold: true, seed: 570 + x });
    }
    TR_Rank(B, 'GUARDIA', 1000, 60, 1600, 60, 6, 270, { tag: 'sanjuan', hold: true, seed: 581, skill: 'MH' });
    TR_Rank(B, 'GUARDIA', 2600, 300, 3200, 300, 6, 270, { tag: 'sanjuan', hold: true, seed: 582 });
    TR_Rank(B, 'HUSAR', 1800, 700, 2200, 700, 4, 270, { tag: 'sanjuan', hold: true, seed: 583 });
    TR_Rank(B, 'GUARDIA', 2300, 1300, 2800, 1300, 5, 270, { tag: 'reservape', hold: true, seed: 584, skill: 'MH' });
    // Pueblo de Chorrillos: tiradores en las calles
    const street = [[-2752, 448], [-2752, 832], [-2752, 1216], [-2368, 448], [-2368, 1216], [-2368, 1600],
      [-1984, 448], [-1984, 832], [-1984, 1600], [-2176, 1216], [-2560, 1984], [-1792, 1984], [-3136, 900], [-3136, 1400]];
    street.forEach(function (p, i) { B.thing(i % 5 === 2 ? 'BAYONETA' : 'GUARDIA', p[0], p[1], 270, { tag: 'pueblo', hold: true, skill: i % 4 === 3 ? 'MH' : undefined }); });

    // Pertrechos y decoración
    B.thing('BOTIQUIN', -900, -2200, 0);
    B.thing('CAJA_FUS', -300, -2150, 0);
    B.thing('CARTUCHOS', -2600, -800, 0);
    B.thing('BOTIQUIN', -2000, -900, 0);
    B.thing('CAJA_FUS', -2176, 820, 0);
    B.thing('BOTIQUIN', -2176, 1230, 0);
    B.thing('CHUPILCA', 1500, -1000, 0);
    B.thing('CAJONES', 1100, -250, 0);
    B.thing('ESCAPULARIO', -3250, -200, 0);
    B.thing('PLANO', 600, -600, 0);
    for (const p of [[-2600, 700], [-2000, 1250], [-2750, 1450], [-1850, 450], [-2450, 2000]]) B.thing('FUEGO', p[0], p[1], 0);
    for (const p of [[-2600, 700], [-2000, 1350], [-2750, 1550]]) B.thing('HUMAREDA', p[0] + 40, p[1] + 40, 0);
    for (let y = 600; y <= 2800; y += 400) B.thing('POSTE', -1350, y, 0);
    for (const p of [[2500, 1500], [700, 900], [3400, 1300]]) B.thing('CARRETA', p[0], p[1], 0);
    B.thing('PIPA', 2300, 850, 0);
    // Puntos de aparición
    const P = function (tag, pts) { for (const p of pts) B.thing('PUNTO', p[0], p[1], p[2] === undefined ? 270 : p[2], { tag: tag }); };
    P('morrobajada', [[-1700, -1200], [-1600, -1500], [-1750, -900]]);
    P('lagos', [[2600, -3350, 90], [3200, -3300, 90], [3600, -3350, 90]]);
    P('sanjuann', [[1700, 600], [2100, 500], [1900, 900]]);
    P('morropie', [[-1700, -2500, 90], [-2000, -2450, 90], [-1400, -2600, 90]]);
    P('caballeria', [[3700, -2600, 90], [3500, -2900, 90], [3800, -2300, 90]]);
    P('pueblo', [[-2240, 960], [-2112, 1088], [-2560, 1216], [-1984, 1216], [-2368, 832]]);
  }
});
