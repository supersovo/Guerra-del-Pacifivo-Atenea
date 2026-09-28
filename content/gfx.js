// =============================================================================
// gfx.js — Gráficos de interfaz: barra de estado, título, carta de campaña
// -----------------------------------------------------------------------------
// STBAR     panel de cuero con remaches de bronce (320x32)
// TITLEPIC  pantalla de título (428x200, se recorta en 4:3)
// WIMAP     carta del teatro de operaciones de Tarapacá, Tacna y Arica (428x200)
// WIMAP2    carta de la campaña de Lima: Chorrillos y Miraflores (428x200)
// FINALPIC  el Morro Solar al atardecer, sobre el Pacífico, con la bandera chilena
// M_STAR1/2 cursor del menú: la estrella solitaria
// STOBJ0/1  medalla de objetivo pendiente / cumplido
// =============================================================================
'use strict';

function gfx_quantizeFull(t, dither) {
  const idx = tx_quantize(t, dither === undefined ? 4 : dither);
  return { width: t.w, height: t.h, pixels: idx };
}

// --- Barra de estado -------------------------------------------------------------------------------
function GFX_BuildStatusBar() {
  const t = tx_new(320, 32);
  const n = tx_fbm(320, 32, 7001, 16, 2, 4, 0.55);
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 320; x++) {
      const i = y * 320 + x;
      let c = tx_scale([112, 74, 44], 0.8 + n[i] * 0.35);
      if (y === 0) c = [180, 140, 90];
      if (y === 1) c = tx_scale(c, 1.2);
      if (y === 31) c = tx_scale(c, 0.5);
      t.r[i] = c[0]; t.g[i] = c[1]; t.b[i] = c[2];
    }
  }
  // Compartimentos hundidos
  const boxes = [[2, 3, 44, 26], [49, 3, 55, 26], [106, 3, 36, 26], [178, 3, 57, 26], [237, 3, 12, 26], [251, 3, 67, 26]];
  for (const b of boxes) {
    tx_rect(t, b[0], b[1], b[2], b[3], [44, 30, 22]);
    tx_rect(t, b[0], b[1], b[2], 1, [22, 14, 10]);
    tx_rect(t, b[0], b[1], 1, b[3], [22, 14, 10]);
    tx_rect(t, b[0], b[1] + b[3] - 1, b[2], 1, [150, 110, 70]);
    tx_rect(t, b[0] + b[2] - 1, b[1], 1, b[3], [150, 110, 70]);
  }
  // Marco del rostro
  tx_rect(t, 143, 1, 34, 31, [30, 22, 18]);
  tx_rect(t, 143, 1, 34, 1, [196, 160, 80]);
  tx_rect(t, 143, 1, 1, 31, [196, 160, 80]);
  tx_rect(t, 176, 1, 1, 31, [120, 90, 40]);
  // Remaches de bronce
  for (const x of [1, 46, 47, 104, 143, 176, 235, 249, 318]) {
    for (const y of [4, 27]) {
      tx_put(t, x, y, [230, 196, 110]); tx_put(t, x + 1, y + 1, [90, 60, 20]);
    }
  }
  // Los rótulos (MUNIC., SALUD, ARMAS, MORAL, REV/FUS/DIN) se escriben al
  // dibujar la barra (ST_Drawer), con letras nítidas a cualquier resolución.
  const img = gfx_quantizeFull(t, 3);
  W_AddLump('STBAR', V_MakeSolidPatch(320, 32, img.pixels, 0, 0), 'patch');
  // Relleno lateral para pantallas panorámicas
  const side = tx_new(64, 32);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 64; x++) {
    const c = tx_get(t, x + 60, y);
    tx_put(side, x, y, y < 3 || y > 28 ? c : tx_scale([112, 74, 44], 0.75 + tx_hash(7002, x >> 3, y >> 2) * 0.2));
  }
  W_AddLump('STBARSID', V_MakeSolidPatch(64, 32, tx_quantize(side, 3), 0, 0), 'patch');
  // Medallas de objetivo
  for (let k = 0; k < 2; k++) {
    const px = new Int16Array(10 * 8).fill(-1);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 10; x++) {
      const dx = (x - 4.5) / 4.6, dy = (y - 3.7) / 3.8;
      const ang = Math.atan2(dy, dx) + Math.PI / 2;
      const r = Math.hypot(dx, dy);
      const star = 0.5 + 0.5 * Math.cos(5 * ang);
      if (r < 0.45 + star * 0.55) {
        if (k === 0) px[y * 10 + x] = r > 0.3 + star * 0.5 ? C(R_WOOD, 9) : C(R_WOOD, 12);
        else px[y * 10 + x] = C(R_GOLD, clamp(Math.round(1 + r * 4 + dy * 2), 0, 8));
      }
    }
    W_AddLump('STOBJ' + k, V_MakePatch(10, 8, px, 0, 0), 'patch');
  }
  // Versión pequeña (5x7) para batallas con más de tres objetivos.
  for (let k = 0; k < 2; k++) {
    const px = new Int16Array(5 * 7).fill(-1);
    for (let y = 0; y < 7; y++) for (let x = 0; x < 5; x++) {
      const dx = (x - 2) / 2.4, dy = (y - 3) / 3.3;
      const r = Math.hypot(dx, dy);
      if (r < 1) px[y * 5 + x] = k === 0 ? (r > 0.6 ? C(R_WOOD, 9) : C(R_WOOD, 12)) : C(R_GOLD, clamp(Math.round(1 + r * 3 + dy * 2), 0, 7));
    }
    W_AddLump('STOBJ' + (k + 2), V_MakePatch(5, 7, px, 0, 0), 'patch');
  }
}

// --- Estrella del cursor del menú ---------------------------------------------------------------------
function GFX_BuildMenuGfx() {
  for (let k = 0; k < 2; k++) {
    const S = 15;
    const px = new Int16Array(S * S).fill(-1);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const dx = (x + 0.5 - S / 2) / (S / 2), dy = (y + 0.5 - S / 2) / (S / 2);
      const ang = Math.atan2(dy, dx) + Math.PI / 2;
      const r = Math.hypot(dx, dy);
      const lim = 0.42 + 0.58 * Math.pow(0.5 + 0.5 * Math.cos(5 * ang), 1.6);
      if (r < lim) px[y * S + x] = k === 0 ? C(R_LINEN, clamp(Math.round(r * 4 + dy * 2), 0, 6)) : C(R_GOLD, clamp(Math.round(r * 4 + dy * 2), 0, 7));
      else if (r < lim + 0.14) px[y * S + x] = C(R_NAVY, 10);
    }
    W_AddLump('M_STAR' + (k + 1), V_MakePatch(S, S, px, 7, 7), 'patch');
  }
}

// --- Paisaje de un morro sobre el mar: el de Arica al alba (título) y el
// Morro Solar de Chorrillos al atardecer (final, opts.dusk) ---------------------------------------------
function gfx_morroScene(w, h, seed, opts) {
  opts = opts || {};
  const t = tx_new(w, h);
  const horizon = Math.floor(h * 0.62);
  // cielo del alba o del atardecer
  const top = opts.dusk ? [40, 30, 70] : [22, 24, 60], mid = opts.dusk ? [150, 70, 90] : [120, 76, 120];
  const low = opts.dusk ? [255, 140, 60] : [250, 160, 96];
  for (let y = 0; y < horizon; y++) {
    const u = y / horizon;
    const c = u < 0.5 ? tx_mix(top, mid, u / 0.5) : tx_mix(mid, low, (u - 0.5) / 0.5);
    for (let x = 0; x < w; x++) tx_put(t, x, y, c);
  }
  // resplandor del sol: al alba por el este (derecha); al atardecer, sobre el mar (izquierda)
  const sunX = opts.dusk ? 0.1 : 0.82;
  for (let y = 0; y < horizon; y++) for (let x = 0; x < w; x++) {
    const d = Math.hypot((x - w * sunX) / w, (y - horizon) / h * 1.6);
    if (d < 0.5) tx_blend(t, x, y, opts.dusk ? [255, 190, 110] : [255, 214, 140], (0.5 - d) * 1.2);
  }
  // nubes bajas (camanchaca)
  for (let y = Math.floor(horizon * 0.55); y < horizon - 4; y++) for (let x = 0; x < w; x++) {
    const n = tx_vnoise(seed, x / w * 10, y / 9, 10, 64) * 0.7 + tx_vnoise(seed + 1, x / w * 30, y / 4, 30, 64) * 0.3;
    if (n > 0.62) tx_blend(t, x, y, tx_mix([255, 190, 150], [120, 80, 110], (y - horizon * 0.55) / (horizon * 0.45)), (n - 0.62) * 3);
  }
  // mar
  for (let y = horizon; y < h; y++) {
    const u = (y - horizon) / (h - horizon);
    for (let x = 0; x < w; x++) {
      let c = tx_mix([96, 80, 110], [18, 26, 48], Math.pow(u, 0.7));
      const glint = Math.sin(x * 0.9 + y * 3.1) * Math.sin(x * 0.13 - y * 0.7);
      if (glint > 0.85 && x > w * 0.45) c = tx_mix(c, [255, 200, 150], 0.5);
      tx_put(t, x, y, c);
    }
  }
  // cerros de la costa al fondo, velados por la bruma (detrás del Morro)
  for (let x = 0; x < w; x++) {
    const hh = 10 + tx_vnoise(seed + 9, x / w * 6, 0.5, 6, 1) * 16;
    for (let y = Math.floor(horizon - hh); y < horizon; y++) {
      const k = 0.35 + 0.35 * clamp((y - (horizon - hh)) / 6, 0, 1);
      tx_blend(t, x, y, [70, 50, 80], k);
    }
  }
  // el Morro: gran promontorio a la izquierda del centro, acantilado sobre el mar
  const mx = w * (opts.morroX || 0.34);
  for (let x = 0; x < w; x++) {
    let top;
    const rel = (x - mx) / w;
    if (rel < -0.30) top = horizon - 6 - Math.max(0, -rel - 0.3) * 20;
    else if (rel < 0.02) top = horizon - 6 - (rel + 0.30) / 0.32 * 70 - Math.sin(x * 0.2) * 1.5;
    else if (rel < 0.10) top = horizon - 76 + (rel - 0.02) * 30;
    else top = horizon - 72 + (rel - 0.10) * 260;   // ladera que baja hacia el pueblo
    if (top > horizon + 6) top = horizon + 6;
    for (let y = Math.floor(top); y < h; y++) {
      if (y >= horizon + 6 && rel > 0.1) break;
      const depth = (y - top) / 80;
      let c = tx_mix([110, 70, 60], [40, 24, 30], clamp(depth, 0, 1));
      c = tx_scale(c, 0.85 + tx_hash(seed + 5, x >> 1, y >> 1) * 0.2);
      if (rel > -0.02 && rel < 0.1 && y < top + 3) c = [170, 100, 80];
      tx_put(t, x, y, c);
    }
  }
  // mástil y bandera chilena sobre la cumbre
  if (opts.flag) {
    const fx = Math.floor(mx + w * 0.05), fy = Math.floor(horizon - 76);
    for (let y = fy - 34; y < fy; y++) tx_put(t, fx, y, [230, 220, 200]);
    for (let y = 0; y < 12; y++) for (let x = 0; x < 18; x++) {
      const wave = Math.sin(x * 0.5) * 1;
      let c = y < 6 ? (x < 6 ? [0, 57, 166] : [240, 240, 240]) : [213, 43, 30];
      if (y < 6 && x < 6 && Math.hypot(x - 2.5, y - 2.5) < 1.3) c = [255, 255, 255];
      tx_put(t, fx + 1 + x, fy - 34 + y + wave, c);
    }
  }
  // buques de la escuadra en la bahía
  if (opts.ships) {
    const ship = function (sx, sy, len) {
      for (let x = 0; x < len; x++) {
        const hgt = x < len * 0.15 ? 3 : 4;
        for (let y = 0; y < hgt; y++) tx_put(t, sx + x, sy - y, [20, 18, 24]);
      }
      tx_rect(t, sx + Math.floor(len * 0.45), sy - 10, 3, 6, [26, 22, 26]);
      tx_line(t, sx + Math.floor(len * 0.25), sy - 4, sx + Math.floor(len * 0.25), sy - 20, [30, 26, 30]);
      tx_line(t, sx + Math.floor(len * 0.7), sy - 4, sx + Math.floor(len * 0.7), sy - 18, [30, 26, 30]);
      for (let k = 0; k < 6; k++) tx_blend(t, sx + Math.floor(len * 0.46) + k, sy - 12 - k * 2, [90, 90, 100], 0.5);
    };
    ship(Math.floor(w * 0.62), horizon + 8, 30);
    ship(Math.floor(w * 0.78), horizon + 5, 22);
    ship(Math.floor(w * 0.9), horizon + 4, 16);
  }
  return t;
}

function GFX_BuildTitle() {
  const w = 428, h = 200;
  const t = gfx_morroScene(w, h, 8101, { flag: false, ships: true, morroX: 0.3 });
  // oscurecer para el texto
  for (let y = 0; y < 70; y++) for (let x = 0; x < w; x++) tx_mul(t, x, y, 0.75 + y / 280);
  // El título (1879, GUERRA DEL PACÍFICO...) lo escribe D_PageDrawer con
  // letras vectoriales a la resolución real.
  const img = gfx_quantizeFull(t, 5);
  W_AddLump('TITLEPIC', img, 'image');
  // Final: el Morro con la bandera izada
  const f = gfx_morroScene(w, h, 8201, { flag: true, ships: true, morroX: 0.42, dusk: true });
  W_AddLump('FINALPIC', gfx_quantizeFull(f, 5), 'image');
}

// --- Carta del teatro de operaciones -----------------------------------------------------------------------
// Rótulos de la carta: [texto, x, y, tinta] en coordenadas de la imagen (428x200).
const WIMAP_LABELS = [
  ['OCÉANO', 16, 100, 'inksea'], ['PACÍFICO', 16, 110, 'inksea'],
  ['PERÚ', 150, 30, 'inkred'], ['TARAPACÁ', 132, 108, 'inkred'], ['BOLIVIA »', 184, 186, 'inkred'],
  ['N', 38, 11, 'ink']
];
const WIMAP_GEO = {
  lat0: -17.75, lat1: -20.45, lon0: -71.05, lon1: -68.9,
  x0: 12, y0: 6, x1: 212, y1: 194
};
function WIMAP_Proj(lat, lon) {
  const g = WIMAP_GEO;
  return [g.x0 + (lon - g.lon0) / (g.lon1 - g.lon0) * (g.x1 - g.x0), g.y0 + (lat - g.lat0) / (g.lat1 - g.lat0) * (g.y1 - g.y0)];
}
const WIMAP_COAST = [[-17.75, -70.95], [-17.9, -70.72], [-18.02, -70.55], [-18.2, -70.41], [-18.36, -70.34], [-18.48, -70.33],
  [-18.62, -70.32], [-18.8, -70.3], [-19.0, -70.27], [-19.2, -70.25], [-19.4, -70.23], [-19.6, -70.22], [-19.8, -70.2],
  [-20.0, -70.17], [-20.21, -70.15], [-20.45, -70.13]];
const WIMAP_PLACES = [
  { name: 'TACNA', lat: -18.01, lon: -70.25, dx: 4, dy: -3, battle: 3 },
  { name: 'ARICA', lat: -18.48, lon: -70.32, dx: 4, dy: -3, battle: 4 },
  { name: 'CAMARONES', lat: -19.0, lon: -70.24, dx: 4, dy: -3 },
  { name: 'PISAGUA', lat: -19.6, lon: -70.21, dx: 4, dy: -7, battle: 1 },
  { name: 'DOLORES', lat: -19.72, lon: -69.93, dx: 4, dy: -2, battle: 2 },
  { name: 'TARAPACÁ', lat: -19.92, lon: -69.51, dx: 4, dy: -3 },
  { name: 'IQUIQUE', lat: -20.21, lon: -70.15, dx: 4, dy: -3 }
];

// Carta de la campaña de Lima (enero de 1881).
// La zona visible con el parte de operaciones es x 54-164 de la imagen: la
// escala (367 px por grado en ambos ejes) deja Callao, Lima, Chorrillos y
// Lurín dentro de ella.
const WIMAP2_LABELS = [
  ['OCÉANO', 58, 132, 'inksea'], ['PACÍFICO', 58, 142, 'inksea'],
  ['VALLE DE LIMA', 126, 56, 'inkred'], ['río Rímac', 118, 16, 'inksea'], ['N', 64, 11, 'ink']
];
const WIMAP2_GEO = {
  lat0: -11.95, lat1: -12.462, lon0: -77.271, lon1: -76.726,
  x0: 12, y0: 6, x1: 212, y1: 194
};
function WIMAP2_Proj(lat, lon) {
  const g = WIMAP2_GEO;
  return [g.x0 + (lon - g.lon0) / (g.lon1 - g.lon0) * (g.x1 - g.x0), g.y0 + (lat - g.lat0) / (g.lat1 - g.lat0) * (g.y1 - g.y0)];
}
const WIMAP2_COAST = [[-11.95, -77.13], [-12.02, -77.14], [-12.05, -77.155], [-12.068, -77.17], [-12.075, -77.12],
  [-12.09, -77.075], [-12.11, -77.05], [-12.125, -77.037], [-12.145, -77.028], [-12.165, -77.025], [-12.18, -77.03],
  [-12.195, -77.037], [-12.205, -77.02], [-12.215, -76.99], [-12.235, -76.95], [-12.255, -76.91], [-12.28, -76.875],
  [-12.33, -76.83], [-12.4, -76.78], [-12.462, -76.74]];
const WIMAP2_PLACES = [
  { name: 'LIMA', lat: -12.046, lon: -77.043, dx: 4, dy: -3 },
  { name: 'CALLAO', lat: -12.06, lon: -77.14, dx: -6, dy: 8 },
  { name: 'MIRAFLORES', lat: -12.12, lon: -77.03, dx: -58, dy: -3, battle: 6 },
  { name: 'BARRANCO', lat: -12.145, lon: -77.02, dx: -50, dy: -2 },
  { name: 'CHORRILLOS', lat: -12.17, lon: -77.02, dx: -58, dy: 2, battle: 5 },
  { name: 'MORRO SOLAR', lat: -12.195, lon: -77.03, dx: -64, dy: 8 },
  { name: 'SAN JUAN', lat: -12.16, lon: -76.97, dx: 5, dy: -3 },
  { name: 'LURÍN', lat: -12.275, lon: -76.87, dx: -24, dy: -4 }
];

// Cartas de las dos campañas: la de Tarapacá, Tacna y Arica (acciones 1 a 4)
// y la de Lima (5 y 6).
const CAMPAIGN_MAPS = [
  { lump: 'WIMAP', labels: WIMAP_LABELS, places: WIMAP_PLACES, proj: WIMAP_Proj, coast: WIMAP_COAST, seed: 8301, rose: [40, 30],
    rails: [[[-18.48, -70.31], [-18.25, -70.28], [-18.01, -70.25]],
      [[-19.6, -70.2], [-19.63, -70.12], [-19.68, -70.02], [-19.72, -69.93], [-19.85, -69.9]]], rivers: [] },
  { lump: 'WIMAP2', labels: WIMAP2_LABELS, places: WIMAP2_PLACES, proj: WIMAP2_Proj, coast: WIMAP2_COAST, seed: 8302, rose: [66, 30],
    rails: [[[-12.046, -77.043], [-12.055, -77.09], [-12.06, -77.14]],
      [[-12.046, -77.043], [-12.09, -77.035], [-12.12, -77.03], [-12.145, -77.022], [-12.17, -77.02]]],
    rivers: [[[-12.0, -76.87], [-12.02, -76.93], [-12.03, -76.99], [-12.04, -77.04], [-12.03, -77.09], [-12.035, -77.14]]] }
];
function CAMPAIGN_MapFor(battle) { return battle >= 5 ? CAMPAIGN_MAPS[1] : CAMPAIGN_MAPS[0]; }

function GFX_BuildCampaignMap(spec) {
  const WIMAP_PLACES = spec.places, WIMAP_COAST = spec.coast, WIMAP_Proj = spec.proj;
  const w = 428, h = 200;
  const t = tx_new(w, h);
  const n = tx_fbm(w, h, spec.seed, 8, 4, 4, 0.55);
  // pergamino
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    const edge = Math.min(x, y, w - 1 - x, h - 1 - y);
    let c = tx_scale([226, 208, 168], 0.9 + n[i] * 0.14);
    if (edge < 6) c = tx_scale(c, 0.7 + edge * 0.05);
    t.r[i] = c[0]; t.g[i] = c[1]; t.b[i] = c[2];
  }
  // costa: el mar al oeste, rayado horizontal
  const coast = WIMAP_COAST.map(function (p) { return WIMAP_Proj(p[0], p[1]); });
  const coastX = function (y) {
    for (let k = 0; k < coast.length - 1; k++) {
      const a = coast[k], b = coast[k + 1];
      if (y >= a[1] && y <= b[1]) return a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]);
    }
    return y < coast[0][1] ? coast[0][0] : coast[coast.length - 1][0];
  };
  for (let y = 4; y < h - 4; y++) {
    const cx = coastX(y);
    for (let x = 4; x < cx; x++) {
      tx_blend(t, x, y, [150, 176, 190], 0.55);
      if (y % 4 === 0 && (x + y) % 7 < 4) tx_blend(t, x, y, [70, 100, 130], 0.4);
    }
    // línea de costa en tinta
    tx_put(t, cx, y, [70, 50, 34]);
    tx_put(t, cx + 1, y, [110, 84, 60]);
  }
  // cordillera de la costa (hachures) y Andes (triángulos) al oriente
  for (let k = 0; k < 90; k++) {
    const y = 8 + (k * 37) % 184;
    const x = coastX(y) + 6 + (k * 13) % 10;
    tx_line(t, x, y, x + 3, y - 2, [140, 110, 80]);
  }
  for (let k = 0; k < 22; k++) {
    const y = 14 + k * 8.2, x = 196 + ((k * 7) % 12);
    for (let d = 0; d < 6; d++) { tx_put(t, x - d, y + d, [110, 90, 80]); tx_put(t, x + d, y + d, [140, 120, 100]); }
  }
  // ríos (tinta azul) y ferrocarriles (Arica–Tacna, Pisagua–Dolores; Lima–Callao, Lima–Chorrillos)
  for (const pts of spec.rivers) {
    for (let k = 0; k < pts.length - 1; k++) {
      const a = WIMAP_Proj(pts[k][0], pts[k][1]), b = WIMAP_Proj(pts[k + 1][0], pts[k + 1][1]);
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let s = 0; s <= len; s++) tx_put(t, a[0] + (b[0] - a[0]) * s / len, a[1] + (b[1] - a[1]) * s / len, [70, 100, 140]);
    }
  }
  const rail = function (pts) {
    for (let k = 0; k < pts.length - 1; k++) {
      const a = WIMAP_Proj(pts[k][0], pts[k][1]), b = WIMAP_Proj(pts[k + 1][0], pts[k + 1][1]);
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let s = 0; s <= len; s++) {
        const x = a[0] + (b[0] - a[0]) * s / len, y = a[1] + (b[1] - a[1]) * s / len;
        tx_put(t, x, y, [60, 44, 34]);
        if (Math.floor(s) % 4 === 0) { tx_put(t, x + 1, y + 1, [60, 44, 34]); tx_put(t, x - 1, y - 1, [60, 44, 34]); }
      }
    }
  };
  for (const r of spec.rails) rail(r);
  // rótulos: los escribe WI_DrawMapLabels al dibujar la carta (letras nítidas)
  const ink = [60, 40, 26];
  for (const p of WIMAP_PLACES) {
    const q = WIMAP_Proj(p.lat, p.lon);
    tx_disc(t, q[0], q[1], 1.6, ink);
  }
  // rosa de los vientos
  const rx = spec.rose[0], ry = spec.rose[1];
  for (let d = -8; d <= 8; d++) { tx_put(t, rx, ry + d, ink); tx_put(t, rx + d, ry, ink); }
  // marco
  tx_rect(t, 2, 2, w - 4, 1, [110, 80, 50]); tx_rect(t, 2, h - 3, w - 4, 1, [110, 80, 50]);
  tx_rect(t, 2, 2, 1, h - 4, [110, 80, 50]); tx_rect(t, w - 3, 2, 1, h - 4, [110, 80, 50]);
  tx_rect(t, 222, 8, 1, h - 16, [150, 120, 80]);
  W_AddLump(spec.lump, gfx_quantizeFull(t, 4), 'image');
}

function GFX_BuildAll() {
  GFX_BuildStatusBar();
  GFX_BuildMenuGfx();
  GFX_BuildTitle();
  for (const spec of CAMPAIGN_MAPS) GFX_BuildCampaignMap(spec);
}
