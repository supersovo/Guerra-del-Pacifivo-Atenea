// =============================================================================
// E1M4 — Asalto y toma del Morro de Arica (7 de junio de 1880)
// -----------------------------------------------------------------------------
// Geografía (comprimida):
//   * El Morro: mesa de roca que cae a pique sobre el mar y sobre el pueblo;
//     su falda oriental, más suave, lleva por el Morro Gordo hasta la cumbre,
//     donde estaban las baterías y donde flameó la bandera a las 7:45.
//   * Al este, los cerros con los fuertes del Este y Ciudadela, rodeados de
//     "polvorazos" (minas del ingeniero Teodoro Elmore); el polvorín de la
//     Ciudadela estalló durante el asalto del 3º de Línea.
//   * Al norte, el pueblo de Arica (iglesia de San Marcos y aduana, obras de
//     la casa Eiffel) y la bahía, donde la tripulación hundió el monitor
//     Manco Cápac.
// El jugador avanza al amanecer con el 4º de Línea desde el oriente.
// =============================================================================
'use strict';

MAPDEFS.push({
  lump: 'E1M4',
  info: {
    title: 'Asalto al Morro de Arica',
    date: '7 de junio de 1880',
    sky: 'CIELO3',
    music: 'M_E1M3',
    par: 600,
    flagMessage: 'Son las 7:45: ¡la bandera chilena flamea en la cumbre del Morro de Arica!',
    mapItemName: 'Recogiste el plano del ingeniero Elmore: las minas aparecen en la carta (TAB).'
  },
  defaults: { floor: 0, ceil: TR_SKY, ftex: 'PAMPA1', ctex: 'F_SKY1', light: 184, wall: 'TIERRA1' },
  battle: {
    objectives: [
      { title: 'Tomar el Fuerte del Este', kill: 'este', doneMsg: '¡El 4º de Línea toma el Fuerte del Este!' },
      { title: 'Tomar el Fuerte Ciudadela', kill: 'ciudadela', after: 1, doneMsg: '¡Cae la Ciudadela!' },
      { title: 'Asaltar la batería del Morro Gordo', kill: 'morrogordo', after: 2, doneMsg: '¡Batería del Morro Gordo tomada! A la cumbre.' },
      { title: 'Coronar la cumbre del Morro', reach: 'cumbre', after: 3, doneMsg: '¡Estamos en la cumbre del Morro!' },
      { title: 'Vencer la última resistencia', kill: 'ultima', after: 4, doneMsg: 'Terminó la resistencia. Ice la bandera en el Morro.' }
    ],
    events: [
      { trigger: { time: 4 }, msg: 'El 3º de Línea avanza sobre la Ciudadela.',
        spawn: [{ type: 'CHILENO', count: 6, at: 'tercero' }] },
      { trigger: { line: 'asaltoeste' },
        spawn: [{ type: 'GUARDIA', count: 3, at: 'este', tag: 'este' }, { type: 'BAYONETA', count: 3, at: 'este', tag: 'este' }] },
      { trigger: { objective: 1 }, msg: 'Zapadores con dinamita defienden la Ciudadela.',
        spawn: [{ type: 'DINAMITERO', count: 3, at: 'ciudadela', tag: 'ciudadela' }, { type: 'GUARDIA', count: 2, at: 'ciudadela', tag: 'ciudadela' }] },
      { trigger: { objective: 2 }, msg: 'El Buin avanza en apoyo. ¡Adelante, al Morro!',
        spawn: [{ type: 'CHILENO', count: 6, at: 'buin' }] },
      { trigger: { line: 'faldamorro' },
        spawn: [{ type: 'GUARDIA', count: 4, at: 'morrogordo', tag: 'morrogordo' }, { type: 'DINAMITERO', count: 2, at: 'morrogordo', tag: 'morrogordo' }] },
      { trigger: { objective: 4 }, msg: '¡Última resistencia en la cumbre!',
        spawn: [{ type: 'OFICIAL', count: 2, at: 'cumbre', tag: 'ultima' }, { type: 'BAYONETA', count: 3, at: 'cumbre', tag: 'ultima' },
          { type: 'GUARDIA', count: 3, at: 'cumbre', tag: 'ultima' }] }
    ],
    bombards: [
      // La escuadra (Cochrane, Magallanes, Covadonga, Loa) bate las baterías del Morro.
      { zone: [-2000, -2200, -900, -1300], interval: [120, 240], damage: 100, safe: 420, side: 1, stop: { objective: 3 } }
    ]
  },
  build: function (B) {
    // --- Bahía de Arica ---
    B.sector([[-7680, -6144], [-2560, -6144], [-2560, 6144], [-7680, 6144]],
      { floor: -16, ceil: -8, ftex: 'AGUA1', ctex: 'F_SKY1', light: 176, wall: 'ROCA2' });
    TR_Ship(B, -4224, -384, 832, 176, { masts: [-0.3, 0, 0.3], mastH: 380 });   // Cochrane
    TR_Ship(B, -3840, 1600, 576, 128, { masts: [-0.28, 0.28], mastH: 300 });    // Covadonga
    TR_Ship(B, -4608, 2560, 576, 128, { masts: [-0.28, 0.28], mastH: 300 });    // Magallanes
    TR_Ship(B, -4480, -1536, 640, 144, { masts: [-0.3, 0.3], mastH: 320 });     // Loa
    // Monitor Manco Cápac hundido por su tripulación: casco bajo, torre y humo.
    B.sector(MC_Quad([[-2944, 704], [-2880, 544], [-2816, 704], [-2816, 1088], [-2880, 1216], [-2944, 1088]]),
      { floor: 0, ftex: 'HIERROF', wall: 'CASCO1', lower: 'CASCO1', light: 176 });
    TR_Pillar(B, MC_Circle(-2880, 896, 40, 10), 56, 'HIERRO1', 'HIERROF', 176);
    // Muelle
    B.sector(MC_Rect(-3072, 256, -2560, 320), { floor: 16, ftex: 'PISO1', wall: 'VIGA1', lower: 'VIGA1', light: 184 });

    // --- Tierra firme ---
    B.sector(MC_Rect(-2560, -3072, 3328, 2048), { floor: 0, ftex: 'PAMPA1', wall: 'TIERRA1' });
    B.sector(MC_Rect(-2560, -3072, -2432, 2048), { floor: 0, ftex: 'ROCAF2', wall: 'ROCA2' });           // orilla rocosa
    const ring = { floor: 0, ceil: 8, ftex: 'PAMPA1', ctex: 'F_SKY1', wall: 'TIERRA1', lower: 'TIERRA1', light: 184 };
    B.sector(MC_Rect(3328, -3200, 3456, 2176), ring);
    B.sector(MC_Rect(-2560, 2048, 3328, 2176), ring);
    B.sector(MC_Rect(-2560, -3200, 3328, -3072), ring);

    // --- El Morro: mesa de 14 curvas (24 c/u) con la terraza del Morro Gordo al este ---
    const N = 14, M = 32;
    TR_RadialHill(B, -1200, -1700, N, M, 24, 0, function (th, L, j) {
      const c = Math.cos(th), s = Math.sin(th);
      const rx = c > 0 ? 1500 : 1150, ry = s > 0 ? 700 : 760;
      const base = 1 / Math.sqrt((c / rx) * (c / rx) + (s / ry) * (s / ry));
      const e = Math.max(0, c) * Math.max(0, c), w = Math.max(0, -c) * Math.max(0, -c);
      const n = Math.max(0, s) * Math.max(0, s), so = Math.max(0, -s) * Math.max(0, -s);
      const k = 0.055 * e + 0.019 * w + 0.031 * n + 0.029 * so;          // pendiente según el rumbo
      let r = base * (1 + 0.04 * (TR_Hash(401, j) * 2 - 1)) * (1 - k * L);
      if (L <= 6) r *= 1 + 0.25 * e * e;                                 // espolón del Morro Gordo
      return r;
    }, function (L) {
      return L < 3 ? { ftex: 'TIERRA1', wall: 'ROCA2', lower: 'ROCA2', light: 176 }
        : L < 11 ? { ftex: 'ROCAF2', wall: 'ROCA2', lower: 'ROCA2', light: 184 }
        : { ftex: 'ROCAF1', wall: 'ROCA4', lower: 'ROCA4', light: 192 };
    });
    // Batería de la cumbre: parapeto de piedra y letrero.
    B.sector(MC_Rect(-1728, -1664, -1600, -1408), { floor: 336 + 24, ftex: 'LOSA1', wall: 'PIEDRA3', lower: 'PIEDRA3', light: 192 });
    TR_House(B, -1280, -1920, -1152, -1856, 336, 64, { tex: 'PIEDRA1', roof: 'LOSA2', light: 192 });
    TR_Sign(B, -1280, -1864, 'x', 128, 400, 'CARTMOR');
    // Parapeto de la batería del Morro Gordo (terraza del nivel 6).
    B.sector(MC_Rect(-64, -1800, -40, -1600), { floor: 168 + 24, ftex: 'SACOSF', wall: 'SACOS1', lower: 'SACOS1' });

    // --- Fuerte del Este ---
    TR_RadialHill(B, 1700, -1500, 8, 20, 24, 0, function (th, L, j) {
      const c = Math.cos(th), s = Math.sin(th);
      const base = 1 / Math.sqrt((c / 640) * (c / 640) + (s / 520) * (s / 520));
      return base * (1 + 0.05 * (TR_Hash(411, j) * 2 - 1)) * (1 - 0.07 * L);
    }, function (L) { return L < 4 ? { ftex: 'TIERRA1', wall: 'TIERRA1', lower: 'TIERRA1' } : { ftex: 'ROCAF1', wall: 'ROCA1', lower: 'ROCA1' }; });
    B.sector(MC_Rect(1520, -1360, 1880, -1336), { floor: 192 + 24, ftex: 'SACOSF', wall: 'SACOS1', lower: 'SACOS1' });
    B.sector(MC_Rect(1520, -1664, 1880, -1640), { floor: 192 + 24, ftex: 'SACOSF', wall: 'SACOS1', lower: 'SACOS1' });
    TR_House(B, 1792, -1600, 1920, -1536, 192, 48, { tex: 'PIEDRA3', roof: 'LOSA1' });
    TR_Sign(B, 1792, -1544, 'x', 128, 240, 'CARTEST2');

    // --- Fuerte Ciudadela (su polvorín vuela durante el asalto) ---
    TR_RadialHill(B, 1300, 200, 8, 20, 24, 0, function (th, L, j) {
      const c = Math.cos(th), s = Math.sin(th);
      const base = 1 / Math.sqrt((c / 620) * (c / 620) + (s / 500) * (s / 500));
      return base * (1 + 0.05 * (TR_Hash(421, j) * 2 - 1)) * (1 - 0.07 * L);
    }, function (L) { return L < 4 ? { ftex: 'TIERRA1', wall: 'TIERRA1', lower: 'TIERRA1' } : { ftex: 'ROCAF2', wall: 'ROCA2', lower: 'ROCA2' }; });
    B.sector(MC_Rect(1120, 330, 1480, 354), { floor: 192 + 24, ftex: 'SACOSF', wall: 'SACOS1', lower: 'SACOS1' });
    B.sector(MC_Rect(1216, 64, 1344, 128), { floor: 192 + 72, ftex: 'LOSA1', wall: 'PIEDRA1', lower: 'PIEDRA1', tag: 'polvorin' });   // polvorín
    TR_Sign(B, 1152, 260, 'x', 128, 192, 'CARTCIU');
    // Al cruzar el centro del fuerte estalla el polvorín y se derrumba.
    B.line([1100, 200], [1500, 200], { special: 900, tag: 'polvorin' });
    B.line([1100, 208], [1500, 208], { special: 38, tag: 'polvorin' });

    // --- Pueblo de Arica ---
    B.sector(MC_Rect(-2432, -640, -704, 1664), { floor: 8, ftex: 'TIERRA1', wall: 'ARENAW', light: 184 });
    // Iglesia de San Marcos (estructura de hierro de la casa Eiffel)
    TR_House(B, -1536, 256, -1280, 512, 8, 144, { tex: 'HIERRO1', sides: { W: 'HIERRO1' }, doors: [{ side: 'W', at: 384 }], roof: 'CALAMF', light: 184 });
    TR_Pillar(B, MC_Rect(-1472, 512, -1344, 576), 8 + 288, 'HIERRO1', 'CALAMF', 184);
    // Aduana (ladrillo, también de la casa Eiffel)
    TR_House(B, -2304, -384, -1920, -128, 8, 128, { tex: 'LADRIL1', sides: { W: 'LADRIL1' }, doors: [{ side: 'W', at: -320 }], roof: 'TECHO2', light: 184 });
    TR_Sign(B, -2296, -256, 'y', 128, 136, 'CARTADU');
    const tt = ['MADERA1', 'MADERA3', 'ADOBE2', 'MADERA5', 'ADOBE3', 'MADERA2'];
    const ww = { MADERA1: 'MADERAV', MADERA3: 'MADERAV', ADOBE2: 'ADOBEV', MADERA5: 'MADERAV', ADOBE3: 'ADOBE3', MADERA2: 'MADERAV2' };
    let bi = 0;
    for (const bx of [-2304, -1920, -1216]) {
      for (let by = 0; by < 1536; by += 384) {
        if (bx === -2304 && by === 0) continue;                 // espacio junto a la aduana
        const t = tt[bi++ % tt.length];
        const h = [96, 112, 128][bi % 3];
        TR_House(B, bx, by, bx + 256, by + 256, 8, h, { tex: t, sides: { W: ww[t], E: ww[t] }, doors: [{ side: 'W', at: by + 128 }], roof: bi & 1 ? 'TECHO1' : 'TECHO2', light: 184 });
      }
    }

    // --- Campos de polvorazos (tierra removida) ---
    const fields = [[2600, -900, 360, 300, 431], [2500, -2350, 340, 280, 432], [700, -900, 300, 260, 433], [2400, 450, 300, 240, 434]];
    for (const f of fields) B.sector(TR_Blob(f[0], f[1], f[2], f[3], 9, f[4], 0.2), { floor: 0, ftex: 'TIERRA2', wall: 'TIERRA1', light: 184 });

    // --- Rocas y lomas del llano oriental ---
    TR_Rock(B, 2800, -300, 80, 0, 40, 441);
    TR_Rock(B, 3000, -2750, 90, 0, 48, 442);
    TR_Rock(B, 600, 900, 100, 0, 56, 443);
    TR_Rock(B, -200, -600, 70, 0, 32, 444);
    TR_Hill(B, 2700, 1300, 420, 320, 0, 3, 16, 445, { ftex: 'PAMPA1', wall: 'TIERRA1', lower: 'TIERRA1' });

    // --- Disparadores ---
    B.line([2450, -1700], [2450, -1280], { special: 952, tag: 'asaltoeste' });
    B.line([900, -3072], [900, -1300], { special: 952, tag: 'faldamorro' });
    B.line([300, -1200], [300, -200], { special: 952, tag: 'faldamorro' });
    // La cumbre: línea que atraviesa la mesa superior.
    B.line([-1520, -2020], [-1520, -1400], { special: 951, tag: 'cumbre' });
    B.line([2800, -1700], [2800, -1500], { special: 950, tag: 'minas' });
    B.message('minas', 'Cuidado con los polvorazos: la tierra removida delata las minas del ingeniero Elmore.');

    // Mástil de la cumbre del Morro.
    TR_FlagPole(B, -1850, -1750, 336);

    // --- Cosas ---
    B.thing('PLAYER1', 3000, -1400, 180);
    B.thing('PLANO', 3060, -1330, 0);
    B.thing('CAJA_FUS', 3080, -1480, 0);
    B.thing('CARTUCHOS', 2960, -1520, 0);
    B.thing('BOTIQUIN', 3150, -1250, 0);
    B.thing('DINAMITA_W', 3120, -1560, 0);
    for (const p of [[2950, -1250], [3060, -1180], [2900, -1600], [3100, -1700], [2860, -1400]]) B.thing('CHILENO', p[0], p[1], 180);
    B.thing('ARTILLERO_CL', 3150, -900, 180, { hold: true });
    B.thing('ARTILLERO_CL', 3150, -2000, 180, { hold: true });
    B.thing('FOGATA', 3200, -1450, 0);
    // Polvorazos (invisibles: sólo el plano de Elmore los muestra)
    for (const f of fields) {
      for (let i = 0; i < 7; i++) {
        const a = TR_Hash(f[4], i) * Math.PI * 2, r = 0.2 + TR_Hash(f[4] + 50, i) * 0.55;
        B.thing('MINA', f[0] + Math.cos(a) * f[2] * r, f[1] + Math.sin(a) * f[3] * r, 0, { skill: i < 4 ? '' : i < 6 ? 'MH' : 'H' });
      }
    }
    // Fuerte del Este
    B.thing('ARTILLERO', 1600, -1500, 0, { tag: 'este' });
    B.thing('ARTILLERO', 1780, -1440, 0, { tag: 'este', skill: 'MH' });
    for (const p of [[1560, -1400], [1850, -1400], [1640, -1600], [1820, -1620]]) B.thing('GUARDIA', p[0], p[1], 0, { tag: 'este' });
    B.thing('OFICIAL', 1700, -1520, 0, { tag: 'este' });
    B.thing('CAJA_DIN', 1560, -1560, 0);
    B.thing('CARAMAYOLA', 1860, -1480, 0);
    // Ciudadela
    B.thing('ARTILLERO', 1220, 260, 0, { tag: 'ciudadela' });
    B.thing('ARTILLERO', 1400, 250, 0, { tag: 'ciudadela', skill: 'MH' });
    for (const p of [[1180, 160], [1420, 150], [1300, 300], [1250, 30]]) B.thing('GUARDIA', p[0], p[1], 0, { tag: 'ciudadela' });
    for (let i = 0; i < 5; i++) B.thing('VOLADURA', 1240 + (i % 3) * 40, 70 + Math.floor(i / 3) * 40, 0, { tag: 'polvorin' });
    B.thing('BARRIL', 1180, 90, 0);
    B.thing('BARRIL', 1390, 110, 0);
    B.thing('BOTIQUIN', 1300, 330, 0);
    // Falda del Morro y Morro Gordo
    for (const p of [[-100, -1760], [-120, -1640], [0, -1700]]) B.thing('GUARDIA', p[0], p[1], 0, { tag: 'morrogordo' });
    B.thing('ARTILLERO', -180, -1700, 0, { tag: 'morrogordo' });
    B.thing('DINAMITERO', 100, -1820, 0, { tag: 'morrogordo', skill: 'MH' });
    B.thing('CAJONES', -200, -1560, 0);
    B.thing('CAJA_FUS', -150, -1850, 0);
    B.thing('CAJA_DIN', 40, -1580, 0);
    for (const p of [[600, -1400], [400, -2100], [-500, -1300]]) B.thing('GUARDIA', p[0], p[1], 0);
    B.thing('BAYONETA', 300, -1600, 0, { skill: 'MH' });
    // Cumbre del Morro
    B.thing('ARTILLERO', -1760, -1560, 0);
    B.thing('ARTILLERO', -1760, -1500, 0, { skill: 'H' });
    B.thing('CANON_COSTA', -1900, -1900, 180);
    B.thing('CANON_COSTA', -1950, -1450, 180);
    for (const p of [[-1500, -1800], [-1400, -1600], [-1650, -2000]]) B.thing('GUARDIA', p[0], p[1], 0);
    B.thing('BOTIQUIN', -1300, -1700, 0);
    B.thing('ESCAPULARIO', -2000, -1700, 0);
    // Pueblo de Arica
    for (const p of [[-1600, 800], [-1100, 300], [-1100, 1100], [-2000, 1300]]) B.thing('GUARDIA', p[0], p[1], 270);
    B.thing('DINAMITERO', -1800, -200, 270, { skill: 'MH' });
    B.thing('CARTUCHOS', -1600, 1000, 0);
    B.thing('BOTIQUIN', -1100, 700, 0);
    B.thing('CHARQUI', -1600, 1400, 0);
    B.thing('CHUPILCA', -2350, 600, 0);
    for (let y = -512; y <= 1536; y += 512) B.thing('FAROL', -2400, y, 0);
    B.thing('FUEGO', -2880, 896 + 60, 0);
    B.thing('HUMAREDA', -2880, 900, 0);
    B.thing('LANCHA', -2620, 700, 90);
    B.thing('ANCLA', -2480, -300, 0);
    // Caídos en el llano
    for (const p of [[2500, -1500], [2100, -1300], [1100, -700], [900, -1100]]) B.thing('CAIDO_CHILENO', p[0], p[1], 0);
    for (const p of [[1500, -1200], [1250, -150]]) B.thing('CAIDO_PERUANO', p[0], p[1], 0);
    // Puntos de aparición
    const P = function (tag, pts) { for (const p of pts) B.thing('PUNTO', p[0], p[1], p[2] || 0, { tag: tag }); };
    P('tercero', [[2700, 250, 180], [2800, 550, 180]]);
    P('este', [[1700, -1300, 0], [1500, -1650, 0]]);
    P('ciudadela', [[1300, 240, 0], [1180, 120, 0]]);
    P('buin', [[2700, -1500, 180], [2750, -1800, 180]]);
    P('morrogordo', [[-600, -1700, 0], [-700, -1500, 0]]);
    P('cumbre', [[-1600, -1750, 0], [-1400, -1850, 0], [-1700, -1450, 0]]);
  }
});
