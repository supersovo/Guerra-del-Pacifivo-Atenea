// =============================================================================
// terrain.js — Herramientas de terreno para los campos de batalla
// -----------------------------------------------------------------------------
// Los escenarios de Atenea son batallas a campo abierto. Con la estructura de
// DOOM (sectores con altura de piso y techo) el relieve se construye así:
//   * Bandas: polígonos anidados que suben como terrazas de un acantilado,
//     con bordes irregulares (roca) salvo donde se apoyan rampas.
//   * Rampas escalonadas: dunas, cuestas y el zigzag del ferrocarril.
//   * Anillos de horizonte: sectores de techo-cielo muy bajo en el borde del
//     mapa; bloquean el paso sin muro visible, y el panorama del cielo
//     continúa el terreno hasta el horizonte.
//   * Edificios: sectores-azotea (el piso es el techo plano de la casa) cuyas
//     caras inferiores son las fachadas; no hay interiores.
// Coordenadas: +x = este (cordillera), -x = oeste (Pacífico), +y = norte.
// =============================================================================
'use strict';

const MAPDEFS = [];
const TR_SKY = 2048;             // altura de los techos-cielo al aire libre

// Ruido determinista entero -> [0, 1).
function TR_Hash(seed, n) {
  let h = (Math.imul(seed | 0, 374761393) + Math.imul(n | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function TR_InStraight(v, straight) {
  for (const r of straight || []) if (v > r[0] && v < r[1]) return true;
  return false;
}

// Borde irregular aproximadamente vertical en x0, de yA a yB (yA < yB).
// opts: { amp, step, seed, straight: [[ya, yb], ...] } — en los tramos rectos
// y en sus extremos el borde pasa exactamente por x0.
function TR_EdgeV(x0, yA, yB, opts) {
  opts = opts || {};
  const amp = opts.amp === undefined ? 48 : opts.amp, step = opts.step || 128, seed = opts.seed || 1;
  const ys = new Set([yA, yB]);
  for (const r of opts.straight || []) { if (r[0] > yA && r[0] < yB) ys.add(r[0]); if (r[1] > yA && r[1] < yB) ys.add(r[1]); }
  for (let y = Math.ceil(yA / step) * step; y < yB; y += step) if (y > yA && !TR_InStraight(y, opts.straight)) ys.add(y);
  const list = Array.from(ys).sort(function (a, b) { return a - b; });
  const fixed = new Set([yA, yB]);
  for (const r of opts.straight || []) { fixed.add(r[0]); fixed.add(r[1]); }
  return list.map(function (y) {
    if (fixed.has(y)) return [x0, y];
    return [Math.round(x0 + (TR_Hash(seed, y) * 2 - 1) * amp), y];
  });
}

// Igual, borde aproximadamente horizontal en y0 de xA a xB.
function TR_EdgeH(y0, xA, xB, opts) {
  return TR_EdgeV(y0, xA, xB, opts).map(function (p) { return [p[1], p[0]]; });
}

// Banda que se extiende hacia el este desde un borde oeste irregular.
function TR_BandEast(B, xw, xe, y0, y1, props, edge) {
  const west = TR_EdgeV(xw, y0, y1, edge);
  return B.sector([[xe, y0], [xe, y1]].concat(west.slice().reverse()), props);
}

// Rampa escalonada a lo largo de X (k = 0 en xa). hfun(k) da la altura del peldaño.
function TR_RampX(B, xa, xb, y0, y1, n, hfun, props) {
  const out = [];
  for (let k = 0; k < n; k++) {
    const a = Math.round(xa + (xb - xa) * k / n), b = Math.round(xa + (xb - xa) * (k + 1) / n);
    out.push(B.sector(MC_Rect(a, y0, b, y1), Object.assign({}, props, { floor: hfun(k) })));
  }
  return out;
}

// Rampa escalonada a lo largo de Y (k = 0 en ya; ya puede ser mayor que yb).
function TR_RampY(B, x0, x1, ya, yb, n, hfun, props) {
  const out = [];
  for (let k = 0; k < n; k++) {
    const a = Math.round(ya + (yb - ya) * k / n), b = Math.round(ya + (yb - ya) * (k + 1) / n);
    out.push(B.sector(MC_Rect(x0, a, x1, b), Object.assign({}, props, { floor: hfun(k) })));
  }
  return out;
}

// Polígono irregular (roca, loma) alrededor de (cx, cy).
function TR_Blob(cx, cy, rx, ry, n, seed, rough) {
  const pts = [];
  rough = rough === undefined ? 0.28 : rough;
  for (let i = 0; i < n; i++) {
    const a = (i + 0.5) / n * Math.PI * 2;
    const k = 1 - rough + TR_Hash(seed, i) * rough;
    pts.push([Math.round(cx + Math.cos(a) * rx * k), Math.round(cy + Math.sin(a) * ry * k)]);
  }
  return pts;
}

function TR_Rock(B, cx, cy, r, base, h, seed, props) {
  return B.sector(TR_Blob(cx, cy, r, r * (0.7 + TR_Hash(seed, 99) * 0.5), 7, seed), Object.assign({
    floor: base + h, ceil: TR_SKY, ftex: 'ROCAF1', ctex: 'F_SKY1', wall: 'ROCA3', lower: 'ROCA3'
  }, props || {}));
}

// Loma de curvas de nivel concéntricas (cada anillo, un sector).
function TR_Hill(B, cx, cy, rx, ry, base, levels, dh, seed, props) {
  const out = [];
  for (let i = 0; i < levels; i++) {
    const k = 1 - i / levels;
    out.push(B.sector(TR_Blob(cx, cy, rx * k, ry * k, 10, seed + i * 17, 0.18),
      Object.assign({ ceil: TR_SKY, ctex: 'F_SKY1' }, props || {}, { floor: base + dh * (i + 1) })));
  }
  return out;
}

// --- Edificios --------------------------------------------------------------------------------------
// Casa sin interior: sector-azotea de altura h sobre base. Las coordenadas
// deberían ser múltiplos de 64 para que ventanas y puertas calcen.
// opts: { tex, roof, sides: { W, E, N, S }, doors: [{ side, at, tex }], light }
function TR_House(B, x0, y0, x1, y1, base, h, opts) {
  opts = opts || {};
  const tex = opts.tex || 'ADOBE2';
  const top = base + h;
  const common = { floor: top, ceil: TR_SKY, ftex: opts.roof || 'TECHO1', ctex: 'F_SKY1', light: opts.light || 200 };
  const house = B.sector(MC_Rect(x0, y0, x1, y1), Object.assign({}, common, { wall: tex, lower: tex }));
  const sides = opts.sides || {};
  const doors = opts.doors || [];
  const D = 8;
  // Franjas de fachada (profundidad D) con su propia textura y cortes para puertas.
  function strip(side, a, b) {
    const stex = sides[side] || tex;
    const ds = doors.filter(function (d) { return d.side === side; }).map(function (d) { return [d.at, d.at + (d.w || 64), d.tex || 'PUERTA1']; });
    if (!sides[side] && !ds.length) return;
    ds.sort(function (p, q) { return p[0] - q[0]; });
    const pieces = [];
    let cur = a;
    for (const d of ds) {
      if (d[0] > cur) pieces.push([cur, d[0], stex]);
      pieces.push([d[0], d[1], d[2]]);
      cur = d[1];
    }
    if (cur < b) pieces.push([cur, b, stex]);
    for (const p of pieces) {
      let r;
      if (side === 'W') r = MC_Rect(x0, p[0], x0 + D, p[1]);
      else if (side === 'E') r = MC_Rect(x1 - D, p[0], x1, p[1]);
      else if (side === 'S') r = MC_Rect(p[0], y0, p[1], y0 + D);
      else r = MC_Rect(p[0], y1 - D, p[1], y1);
      B.sector(r, Object.assign({}, common, { wall: p[2], lower: p[2] }));
    }
  }
  const hasW = !!(sides.W || doors.some(function (d) { return d.side === 'W'; }));
  const hasE = !!(sides.E || doors.some(function (d) { return d.side === 'E'; }));
  strip('W', y0, y1);
  strip('E', y0, y1);
  strip('S', hasW ? x0 + D : x0, hasE ? x1 - D : x1);
  strip('N', hasW ? x0 + D : x0, hasE ? x1 - D : x1);
  return house;
}

// Letrero sobre la azotea: tabla de 32 de alto (ancho = ancho de la textura,
// alineada a múltiplos de 128). axis 'x': la tabla corre de este a oeste.
function TR_Sign(B, x0, y0, axis, len, roof, tex) {
  const r = axis === 'x' ? MC_Rect(x0, y0, x0 + len, y0 + 4) : MC_Rect(x0, y0, x0 + 4, y0 + len);
  return B.sector(r, { floor: roof + 32, ceil: TR_SKY, ftex: 'TECHO2', ctex: 'F_SKY1', wall: tex, lower: tex });
}

// Pilar/torre/columna: sector alto y estrecho.
function TR_Pillar(B, pts, top, tex, flat, light) {
  return B.sector(pts, { floor: top, ceil: TR_SKY, ftex: flat || 'HIERROF', ctex: 'F_SKY1', wall: tex, lower: tex, light: light || 200 });
}

// --- Obras militares ------------------------------------------------------------------------------------
// Trinchera N-S: foso (base-16) con parapeto de sacos (base+16) al oeste
// (dir = -1) o al este (dir = +1).
function TR_TrenchNS(B, x0, x1, y0, y1, base, dir) {
  B.sector(MC_Rect(x0, y0, x1, y1), { floor: base - 16, ceil: TR_SKY, ftex: 'TIERRA1', ctex: 'F_SKY1', wall: 'TIERRA1', lower: 'TIERRA1', light: 184 });
  const p = dir < 0 ? MC_Rect(x0 - 24, y0, x0, y1) : MC_Rect(x1, y0, x1 + 24, y1);
  B.sector(p, { floor: base + 16, ceil: TR_SKY, ftex: 'SACOSF', ctex: 'F_SKY1', wall: 'SACOS1', lower: 'SACOS1' });
}

// Trinchera E-O con parapeto al sur (dir = -1) o al norte (dir = +1).
function TR_TrenchEW(B, x0, x1, y0, y1, base, dir) {
  B.sector(MC_Rect(x0, y0, x1, y1), { floor: base - 16, ceil: TR_SKY, ftex: 'TIERRA1', ctex: 'F_SKY1', wall: 'TIERRA1', lower: 'TIERRA1', light: 184 });
  const p = dir < 0 ? MC_Rect(x0, y0 - 24, x1, y0) : MC_Rect(x0, y1, x1, y1 + 24);
  B.sector(p, { floor: base + 16, ceil: TR_SKY, ftex: 'SACOSF', ctex: 'F_SKY1', wall: 'SACOS1', lower: 'SACOS1' });
}

// Mástil de la bandera sobre un pedestal de piedra con la placa "IZAR BANDERA":
// usar cualquier cara del pedestal (especial 911) iza la bandera y termina.
function TR_FlagPole(B, x, y, base) {
  B.sector(MC_Rect(x - 24, y - 24, x + 24, y + 24), {
    floor: base + 64, ceil: TR_SKY, ftex: 'LOSA1', ctex: 'F_SKY1', wall: 'IZAR0', lower: 'IZAR0', light: 208
  });
  for (const p of [[x, y - 24], [x, y + 24], [x - 24, y], [x + 24, y]]) B.fix(p, { special: 911 });
  B.thing('MASTIL', x, y, 0);
}

// Buque de la escuadra fondeado (paralelo a la costa): casco, chimenea, palos.
function TR_Ship(B, cx, cy, len, beam, opts) {
  opts = opts || {};
  const hl = len / 2, hb = beam / 2;
  const deck = opts.deck || 48;
  B.sector(MC_Quad([[cx - hb, cy - hl + beam], [cx, cy - hl], [cx + hb, cy - hl + beam], [cx + hb, cy + hl - beam], [cx, cy + hl], [cx - hb, cy + hl - beam]]),
    { floor: deck, ceil: TR_SKY, ftex: 'CUBIERT', ctex: 'F_SKY1', wall: 'CASCO1', lower: 'CASCO1', light: 200 });
  // superestructura
  B.sector(MC_Rect(cx - hb + 16, cy - 64, cx + hb - 16, cy + 64), { floor: deck + 40, ceil: TR_SKY, ftex: 'CUBIERT', ctex: 'F_SKY1', wall: 'MADERA5', lower: 'MADERA5', light: 200 });
  if (opts.funnel !== false) {
    TR_Pillar(B, MC_Rect(cx - 20, cy - 16, cx + 20, cy + 24), deck + 150, 'HIERRO1', 'HIERROF');
    B.thing('HUMAREDA', cx, cy + 4, 0);
  }
  const masts = opts.masts || [-0.32, 0.32];
  for (const m of masts) {
    const my = Math.round(cy + m * len);
    TR_Pillar(B, MC_Rect(cx - 6, my - 6, cx + 6, my + 6), deck + (opts.mastH || 360), 'MADVERT', 'PISO1');
  }
}

// Cerro de curvas de nivel radiales: N niveles con M vértices en los mismos
// ángulos. Como el radio decrece estrictamente con el nivel en cada ángulo,
// las curvas nunca se cruzan (los escalones pueden ensancharse en terrazas).
// rfun(theta, L) -> radio; propsFn(L) -> propiedades del sector del nivel L.
function TR_RadialHill(B, cx, cy, N, M, dh, base, rfun, propsFn) {
  const out = [];
  for (let L = 0; L < N; L++) {
    const pts = [];
    for (let j = 0; j < M; j++) {
      const th = j / M * Math.PI * 2;
      const r = rfun(th, L, j);
      pts.push([Math.round(cx + Math.cos(th) * r), Math.round(cy + Math.sin(th) * r)]);
    }
    out.push(B.sector(pts, Object.assign({ ceil: TR_SKY, ctex: 'F_SKY1' }, propsFn(L), { floor: base + dh * (L + 1) })));
  }
  return out;
}

// Carpa de campaña (sector bajo de lona).
function TR_Tent(B, x0, y0, x1, y1, base) {
  return B.sector(MC_Rect(x0, y0, x1, y1), { floor: base + 56, ceil: TR_SKY, ftex: 'CARPAF', ctex: 'F_SKY1', wall: 'CARPA1', lower: 'CARPA1', light: 208 });
}
