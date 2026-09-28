// =============================================================================
// E1M6 — Batalla de Miraflores (15 de enero de 1881)
// -----------------------------------------------------------------------------
// Batalla masiva. Geografía (comprimida; el norte es Lima):
//   * La línea peruana de Miraflores, del mar al río Surco: reductos de
//     tierra a unos 900 m uno de otro, unidos por tapias y trincheras. El
//     combate se concentró en los tres primeros: el Nº 1, junto al barranco
//     del mar; el Nº 2, junto al ferrocarril de Lima a Chorrillos, con el
//     batallón Nº 4 de la Reserva (Ramón Ribeyro), y el Nº 3, delante de la
//     hacienda La Palma, con el batallón Nº 6 (Narciso de la Colina). La
//     Reserva era la población civil de Lima: profesionales, comerciantes y
//     artesanos, de levita y sombrero.
//   * Al poniente, el acantilado sobre el Pacífico y la escuadra chilena:
//     Blanco Encalada, Huáscar, O'Higgins y Pilcomayo.
//   * Al norte, el pueblo de Miraflores y, más allá, Lima.
// Desarrollo: rota la tregua a las 14:30, el fuego sorprende a las tropas
// chilenas; Cáceres contraataca con la Guarnición de Marina y el Jauja; hacia
// las 16 llegan los batallones de reserva y la escuadra bate los reductos; caen
// uno tras otro y se entra en Miraflores. Lima fue ocupada el 17 de enero.
// =============================================================================
'use strict';

MAPDEFS.push({
  lump: 'E1M6',
  info: {
    title: 'Batalla de Miraflores',
    date: '15 de enero de 1881 · Los reductos',
    sky: 'CIELO6',
    music: 'M_LIMA2',
    par: 780,
    flagMessage: 'Cae la línea de Miraflores. El 17 de enero el ejército chileno entra en Lima.',
    mapItemName: 'Recogiste el plano de la línea de reductos: las defensas aparecen en la carta (TAB).'
  },
  defaults: { floor: 0, ceil: TR_SKY, ftex: 'PASTO1', ctex: 'F_SKY1', light: 212, wall: 'ADOBE1' },
  battle: {
    massive: true,
    objectives: [
      { title: 'Resistir el contraataque de Cáceres', short: 'Cáceres', kill: 'caceres', percent: 0.7, rout: [-1700, 2950], near: [-1850, -1100, 1300],
        doneMsg: '¡Rechazado el contraataque! Cáceres se repliega sin municiones.' },
      { title: 'Tomar el reducto Nº 1', short: 'Reducto 1', kill: 'reducto1', percent: 0.8, rout: [-2300, 2950], after: 1, near: [-2440, 560, 700],
        doneMsg: '¡Cae el reducto Nº 1, junto al barranco!' },
      { title: 'Tomar el reducto Nº 2 (batallón Nº 4, Ribeyro)', short: 'Reducto 2', kill: 'reducto2', percent: 0.8, rout: [-1100, 2950], after: 2, near: [-1280, 580, 700],
        doneMsg: '¡Cae el reducto Nº 2! La Reserva de Lima se bate hasta el final.' },
      { title: 'Tomar el reducto Nº 3 (batallón Nº 6, de la Colina)', short: 'Reducto 3', kill: 'reducto3', percent: 0.8, rout: [300, 2950], after: 3, near: [100, 600, 700],
        doneMsg: '¡Cae el reducto Nº 3, frente a La Palma!' },
      { title: 'Entrar en Miraflores', reach: 'miraflores', after: 4, doneMsg: 'Estamos en Miraflores. Ice la bandera en la plaza.' }
    ],
    events: [
      { trigger: { time: 5 }, msg: '15 de enero, 14:30. Rota la tregua, el fuego se abre en toda la línea.' },
      { trigger: { time: 22 }, msg: '¡Contraataque de Cáceres con la Guarnición de Marina y el Jauja!',
        spawn: [{ type: 'GUARDIA', count: 14, at: 'caceres', tag: 'caceres', spread: 150, goal: [-1900, -1150] },
          { type: 'BAYONETA', count: 8, at: 'caceres', tag: 'caceres', spread: 150, goal: [-1800, -1050] },
          { type: 'OFICIAL', count: 1, at: 'caceres', tag: 'caceres', spread: 80, goal: [-1850, -800] }] },
      { trigger: { time: 60 }, msg: 'La división de Lagos ataca los reductos del este.',
        orders: [{ tag: 'lagos', to: [2500, 60], spread: 1 }] },
      { trigger: { time: 100 }, msg: '16:00. Llegan los batallones de reserva; la escuadra abre fuego sobre los reductos.',
        spawn: [{ type: 'CHILENO', count: 16, at: 'reserva', spread: 150, goal: [-1500, -100] }] },
      { trigger: { objective: 1 }, msg: '¡Adelante sobre el reducto Nº 1!',
        orders: [{ tag: 'lynch', to: [-2200, 100], spread: 0.8 }] },
      { trigger: { objective: 2 }, msg: 'El centro chileno avanza contra el reducto Nº 2 y la vía férrea.',
        orders: [{ tag: 'sotomayor', to: [-600, 150], spread: 0.8 }, { tag: 'lynch', to: [-1400, 250], spread: 0.8 }] },
      { trigger: { objective: 4 }, msg: 'La línea de Miraflores se desploma. ¡Al pueblo!',
        orders: [{ tag: 'linea', to: [-600, 2950], flee: true }, { tag: 'este', to: [2400, 2950], flee: true }] }
    ],
    bombards: [
      // La artillería peruana bate el despliegue chileno.
      { zone: [-2700, -2500, 3800, -1500], interval: [160, 300], damage: 100, safe: 420, side: 2, stop: { objective: 4 } },
      // La escuadra chilena (desde las 16) sobre los reductos 1 a 3.
      { zone: [-2900, 250, 500, 1150], interval: [90, 180], damage: 110, safe: 460, side: 1, trigger: { time: 100 }, stop: { objective: 4 } }
    ]
  },
  build: function (B) {
    // --- El Pacífico al pie del barranco, con la escuadra ---
    B.sector([[-8192, -7168], [-3200, -7168], [-3200, 7168], [-8192, 7168]],
      { floor: -256, ceil: -248, ftex: 'AGUA1', ctex: 'F_SKY1', light: 212, wall: 'ROCA4' });
    TR_Ship(B, -4300, -900, 820, 170, { deck: -208, masts: [-0.3, 0, 0.3], mastH: 400 });   // Blanco Encalada
    TR_Ship(B, -4800, 700, 700, 150, { deck: -208, masts: [-0.28, 0.28], mastH: 380 });     // Huáscar
    TR_Ship(B, -5200, -2400, 640, 140, { deck: -208, masts: [-0.3, 0.3], mastH: 360 });     // O'Higgins
    TR_Ship(B, -5600, 2200, 560, 120, { deck: -208, masts: [-0.25, 0.25], mastH: 340 });    // Pilcomayo
    // Barranco: ceja de roca entre el mar y el campo, con un pretil de adobe.
    B.sector(MC_Rect(-3200, -3584, 4096, 3072), { floor: 0, ftex: 'PASTO1', wall: 'ADOBE1' });
    B.sector(MC_Rect(-3200, -3584, -3136, 3072), { floor: 0, ftex: 'ROCAF1', wall: 'ROCA4', lower: 'ROCA4' });
    B.sector(MC_Rect(-3136, -3584, -3120, 3072), { floor: 32, ftex: 'TIERRA1', wall: 'ADOBE1', lower: 'ADOBE1' });
    const ring = { floor: 0, ceil: 8, ftex: 'PASTO1', ctex: 'F_SKY1', wall: 'ADOBE1', lower: 'ADOBE1', light: 212 };
    B.sector(MC_Rect(-3200, -3712, 4224, -3584), ring);
    B.sector(MC_Rect(-3200, 3072, 4224, 3200), ring);
    B.sector(MC_Rect(4096, -3584, 4224, 3072), ring);
    // Chacras del sur (Barranco y Surco) y potreros del norte.
    B.sector(MC_Rect(-2900, -3300, -1200, -2300), { floor: 0, ftex: 'CHACRA1', wall: 'ADOBE1' });
    B.sector(MC_Rect(-700, -3300, 1800, -2300), { floor: 0, ftex: 'CHACRA1', wall: 'ADOBE1' });
    B.sector(MC_Rect(2300, -3300, 3900, -2000), { floor: 0, ftex: 'CHACRA1', wall: 'ADOBE1' });
    B.sector(MC_Rect(600, 1300, 2800, 2600), { floor: 0, ftex: 'CHACRA1', wall: 'ADOBE1' });
    B.sector(TR_Blob(-1900, -1500, 700, 300, 10, 601, 0.2), { floor: 0, ftex: 'TIERRA1', wall: 'ADOBE1' });
    B.sector(TR_Blob(1500, -1400, 900, 320, 10, 602, 0.2), { floor: 0, ftex: 'TIERRA1', wall: 'ADOBE1' });
    // Tapias de adobe de las chacras del sur (reparo para el avance chileno).
    const tapia = { floor: 48, ftex: 'TIERRA1', wall: 'ADOBE1', lower: 'ADOBE1', light: 200 };
    B.sector(MC_Rect(-2900, -2316, -2200, -2300), tapia);
    B.sector(MC_Rect(-2000, -2316, -1200, -2300), tapia);
    B.sector(MC_Rect(-700, -2316, 300, -2300), tapia);
    B.sector(MC_Rect(500, -2316, 1800, -2300), tapia);
    B.sector(MC_Rect(2300, -2016, 3200, -2000), tapia);
    B.sector(MC_Rect(3400, -2016, 3900, -2000), tapia);
    // Ferrocarril de Lima a Chorrillos, con un vagón abandonado.
    B.sector(MC_Rect(-1000, -3584, -936, 3072), { floor: 0, ftex: 'RIELNS', wall: 'ADOBE1' });
    B.sector(MC_Rect(-992, 1500, -944, 1700), { floor: 80, ftex: 'HIERROF', wall: 'VAGON1', lower: 'VAGON1', light: 196 });

    // --- La línea de reductos (golas abiertas al norte) ---
    const reds = [[-2600, 400, 'reducto1'], [-1440, 420, 'reducto2'], [-60, 440, 'reducto3'], [1500, 460, 'este'], [3000, 480, 'este']];
    for (const r of reds) TR_Redoubt(B, r[0], r[1], r[0] + 320, r[1] + 320, 0, 'N');
    // Trincheras y tapias entre los reductos (parapeto al sur).
    for (const s of [[-2240, -1480], [-880, -100], [300, 1460], [1860, 2960], [3360, 3950]]) TR_TrenchEW(B, s[0], s[1], 560, 608, 0, -1, { depth: 8 });

    // --- Hacienda La Palma, detrás del reducto Nº 3 ---
    TR_House(B, -256, 1344, 256, 1600, 0, 112, { tex: 'ADOBE3', sides: { S: 'ADOBEV' }, doors: [{ side: 'S', at: -32 }], roof: 'TECHO2' });
    TR_House(B, 320, 1344, 512, 1536, 0, 96, { tex: 'ADOBE1', roof: 'TECHO1' });
    TR_Sign(B, -64, 1360, 'x', 128, 112, 'CARTPAL');
    TR_Pillar(B, MC_Rect(-320, 1500, -272, 1548), 180, 'LADRIL1', 'HIERROF');

    // --- Pueblo de Miraflores ---
    const cols = [[-2560, -2304], [-2176, -1920], [-1792, -1536], [-1408, -1152]];
    const rows = [[1984, 2240], [2368, 2624]];
    const texs = ['ADOBE2', 'MADERA4', 'ADOBE1', 'ADOBE3', 'MADERA5', 'ADOBE2', 'ADOBE1', 'MADERA4'];
    for (let c = 0; c < cols.length; c++) {
      for (let r = 0; r < rows.length; r++) {
        if (c === 1 && r === 0) continue;   // plaza
        const x0 = cols[c][0], x1 = cols[c][1], y0 = rows[r][0], y1 = rows[r][1];
        if (c === 2 && r === 0) {
          // parroquia de Miraflores, frente a la plaza
          TR_House(B, x0, y0, x1, y1, 0, 150, { tex: 'PIEDRA1', sides: { W: 'PIEDRA3' }, doors: [{ side: 'W', at: 2080, w: 64 }], roof: 'TECHO2' });
          TR_Pillar(B, MC_Rect(x0 + 16, y1 - 80, x0 + 80, y1 - 16), 280, 'PIEDRA1', 'TECHO2');
          continue;
        }
        TR_House(B, x0, y0, x1, y1, 0, 96 + ((c + r) % 3) * 24, { tex: texs[c * 2 + r], doors: [{ side: 'S', at: x0 + 96 }], roof: r ? 'TECHO1' : 'CALAMF' });
      }
    }
    TR_Sign(B, -2496, 1996, 'x', 128, 96, 'CARTMIR');
    TR_FlagPole(B, -2048, 2112, 0);
    B.line([-2700, 1850], [-1100, 1850], { special: 951, tag: 'miraflores' });

    // Mensajes históricos.
    B.line([-2300, -1000], [-1500, -1000], { special: 950, tag: 'tregua' });
    B.message('tregua', 'Al frente, los reductos de Miraflores. La Reserva de Lima: civiles de levita que defendieron su ciudad.');
    B.line([-1400, 1000], [-1100, 1000], { special: 950, tag: 'ribeyro' });
    B.message('ribeyro', 'Reducto Nº 2: aquí se batió el batallón Nº 4 de la Reserva, del abogado Ramón Ribeyro.');

    // --- Cosas: el jugador con la división de Lynch, junto al barranco ---
    B.thing('PLAYER1', -2000, -2050, 90);
    TR_Rank(B, 'CHILENO', -2300, -2150, -1700, -2150, 6, 90, { seed: 631 });
    TR_Ranks(B, 'CHILENO', -2900, -1800, -1300, -1800, 14, 2, 0, -80, 90, { tag: 'lynch', hold: true, seed: 632 });
    TR_Ranks(B, 'CHILENO', -700, -1750, 1500, -1750, 14, 2, 0, -80, 90, { tag: 'sotomayor', hold: true, seed: 633 });
    TR_Ranks(B, 'CHILENO', 2000, -1700, 3800, -1700, 12, 2, 0, -80, 90, { tag: 'lagos', hold: true, seed: 634 });
    for (const x of [-1600, 400, 2700]) {
      B.thing('ARTILLERO_CL', x, -2600, 90, { hold: true });
      B.thing('CAJONES', x + 70, -2690, 0);
    }
    B.thing('CAJA_FUS', -2100, -1950, 0);
    B.thing('CAJA_FUS', -1900, -1950, 0);
    B.thing('CAJA_DIN', -2000, -2250, 0);
    B.thing('DINAMITA_W', -1800, -2100, 0);
    B.thing('BOTIQUIN', -2200, -2250, 0);
    B.thing('GATLING', -2400, -2050, 0);
    B.thing('ESTANDARTE', -2000, -2350, 0);

    // --- Defensores peruanos ---
    // Reducto Nº 1 (Cáceres, junto al mar)
    TR_Rank(B, 'GUARDIA', -2540, 470, -2340, 470, 4, 270, { tag: 'reducto1', hold: true, seed: 641 });
    TR_Rank(B, 'RESERVA', -2540, 560, -2340, 560, 4, 270, { tag: 'reducto1', hold: true, seed: 642 });
    B.thing('ARTILLERO', -2440, 650, 270, { tag: 'reducto1' });
    B.thing('OFICIAL', -2340, 660, 270, { tag: 'reducto1' });
    TR_Rank(B, 'RESERVA', -2540, 780, -2340, 780, 3, 270, { tag: 'reducto1', hold: true, seed: 643, skill: 'MH' });
    // Reducto Nº 2 (batallón Nº 4 de la Reserva, Ribeyro)
    TR_Rank(B, 'RESERVA', -1380, 490, -1180, 490, 4, 270, { tag: 'reducto2', hold: true, seed: 644 });
    TR_Rank(B, 'RESERVA', -1380, 580, -1180, 580, 4, 270, { tag: 'reducto2', hold: true, seed: 645 });
    B.thing('ARTILLERO', -1280, 670, 270, { tag: 'reducto2' });
    TR_Rank(B, 'RESERVA', -1380, 800, -1180, 800, 4, 270, { tag: 'reducto2', hold: true, seed: 646, skill: 'MH' });
    // Reducto Nº 3 (batallón Nº 6, de la Colina)
    TR_Rank(B, 'RESERVA', 0, 510, 200, 510, 4, 270, { tag: 'reducto3', hold: true, seed: 647 });
    TR_Rank(B, 'RESERVA', 0, 600, 200, 600, 4, 270, { tag: 'reducto3', hold: true, seed: 648 });
    B.thing('ARTILLERO', 100, 690, 270, { tag: 'reducto3' });
    B.thing('OFICIAL', 200, 700, 270, { tag: 'reducto3' });
    TR_Rank(B, 'GUARDIA', 0, 820, 200, 820, 3, 270, { tag: 'reducto3', hold: true, seed: 649, skill: 'MH' });
    // Línea entre reductos
    for (const s of [[-2240, -1480], [-880, -100], [300, 1460]]) {
      TR_Rank(B, 'GUARDIA', s[0] + 40, 584, s[1] - 40, 584, Math.floor((s[1] - s[0]) / 90), 270, { tag: 'linea', hold: true, seed: 650 + s[0] });
    }
    // Reductos del este (Suárez y Dávila) y su línea
    for (const s of [[1860, 2960], [3360, 3950]]) {
      TR_Rank(B, 'GUARDIA', s[0] + 40, 584, s[1] - 40, 584, Math.floor((s[1] - s[0]) / 100), 270, { tag: 'este', hold: true, seed: 660 + s[0] });
    }
    for (const x of [1660, 3160]) {
      B.thing('ARTILLERO', x, 700, 270, { tag: 'este' });
      TR_Rank(B, 'RESERVA', x - 100, 540, x + 100, 540, 3, 270, { tag: 'este', hold: true, seed: 670 + x });
    }
    // Pueblo de Miraflores
    for (const p of [[-2240, 2300], [-1856, 2300], [-1472, 2300], [-1088, 2100], [-2432, 1920], [-1664, 1920]]) {
      B.thing('RESERVA', p[0], p[1], 270, { tag: 'linea', hold: true });
    }

    // Pertrechos y decoración
    B.thing('BOTIQUIN', -2400, 300, 0);
    B.thing('CAJA_FUS', -1700, 250, 0);
    B.thing('BOTIQUIN', -800, 900, 0);
    B.thing('CARTUCHOS', 400, 950, 0);
    B.thing('CHARQUI', -2048, 1900, 0);
    B.thing('CHUPILCA', -1300, -1200, 0);
    B.thing('ESCAPULARIO', 2400, 1000, 0);
    B.thing('PLANO', -2700, 1200, 0);
    for (const p of [[-500, 1000], [900, 1100], [2200, 1000]]) B.thing('CARRETA', p[0], p[1], 0);
    for (let y = -3200; y <= 2800; y += 400) B.thing('POSTE', -1040, y, 0);
    for (const p of [[-600, -2000], [1200, -2100], [3000, -2300]]) B.thing('FOGATA', p[0], p[1], 0);
    B.thing('HUMAREDA', -2440, 700, 0);
    B.thing('HUMAREDA', 100, 740, 0);
    // Puntos de aparición
    const P = function (tag, pts) { for (const p of pts) B.thing('PUNTO', p[0], p[1], p[2] === undefined ? 270 : p[2], { tag: tag }); };
    P('caceres', [[-2400, 1100], [-1800, 1150], [-2100, 1350], [-1500, 1300]]);
    P('reserva', [[-1800, -2900, 90], [-1400, -2900, 90], [-1600, -3150, 90]]);
  }
});
