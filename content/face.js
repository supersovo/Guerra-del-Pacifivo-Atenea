// =============================================================================
// face.js — Rostro del soldado chileno en la barra de estado (STF*)
// -----------------------------------------------------------------------------
// Como la cara de DOOM: cinco niveles de heridas y varias expresiones (mirar
// a los lados, girar hacia el atacante, grito de dolor, sonrisa al recoger un
// arma, dientes apretados al disparar sin parar, invulnerable y muerto).
//
// Es un retrato pintado por capas a 4 texeles por píxel lógico (128x120 para
// el marco de 32x30 de la barra; nítido a 1280x800), con supermuestreo 2x:
// luz desde arriba a la izquierda sobre la cabeza, ojos con iris y brillo,
// bigote espeso, kepí rojo con franja azul, visera charolada y cubrenuca
// blanco, levita azul de cuello rojo. Las heridas se acumulan y se ven: hollín,
// cortes que gotean, la frente rajada bajo una venda que se empapa, el ojo
// morado e hinchado, el labio partido, la nariz que sangra, el kepí
// agujereado y la palidez de la pérdida de sangre.
// =============================================================================
'use strict';

const FACE_W = 32, FACE_H = 30;          // tamaño lógico (marco de la barra de estado)
const FACE_D = 4;                         // texeles por píxel lógico
const FACE_SS = 2;                        // supermuestreo
const FACE_K = FACE_D * FACE_SS;          // texeles de trabajo por unidad
const FACE_BOX = [30, 22, 18];            // fondo del marco (para suavizar los bordes)

// --- Lienzo de trabajo (RGB + alfa) ----------------------------------------------------------
function fp_new() {
  const w = FACE_W * FACE_K, h = FACE_H * FACE_K;
  return { w: w, h: h, r: new Float32Array(w * h), g: new Float32Array(w * h), b: new Float32Array(w * h), a: new Float32Array(w * h) };
}

// Pinta una figura: inside(u, v) -> cobertura 0..1; color(u, v) -> [r, g, b].
function fp_fill(P, box, inside, color, alpha) {
  const k = FACE_K;
  const x0 = Math.max(0, Math.floor(box[0] * k)), x1 = Math.min(P.w - 1, Math.ceil(box[2] * k));
  const y0 = Math.max(0, Math.floor(box[1] * k)), y1 = Math.min(P.h - 1, Math.ceil(box[3] * k));
  const A = alpha === undefined ? 1 : alpha;
  for (let y = y0; y <= y1; y++) {
    const v = (y + 0.5) / k;
    for (let x = x0; x <= x1; x++) {
      const u = (x + 0.5) / k;
      const cov = inside(u, v);
      if (cov <= 0) continue;
      const c = typeof color === 'function' ? color(u, v) : color;
      if (!c) continue;
      const a = Math.min(1, cov * A * (c[3] === undefined ? 1 : c[3]));
      const i = y * P.w + x;
      P.r[i] = P.r[i] * (1 - a) + c[0] * a;
      P.g[i] = P.g[i] * (1 - a) + c[1] * a;
      P.b[i] = P.b[i] * (1 - a) + c[2] * a;
      P.a[i] = P.a[i] + a * (1 - P.a[i]);
    }
  }
}

function fp_ellipse(P, cx, cy, rx, ry, color, alpha, rot) {
  const cr = Math.cos(rot || 0), sr = Math.sin(rot || 0);
  const R = Math.max(rx, ry);
  fp_fill(P, [cx - R, cy - R, cx + R, cy + R], function (u, v) {
    const du = u - cx, dv = v - cy;
    const x = (du * cr + dv * sr) / rx, y = (-du * sr + dv * cr) / ry;
    return x * x + y * y <= 1 ? 1 : 0;
  }, color, alpha);
}

function fp_poly(P, pts, color, alpha) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
  fp_fill(P, [x0, y0, x1, y1], function (u, v) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const a = pts[i], b = pts[j];
      if ((a[1] > v) !== (b[1] > v) && u < (b[0] - a[0]) * (v - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside ? 1 : 0;
  }, color, alpha);
}

// Trazo grueso por una polilínea (ancho w0 al comienzo y w1 al final).
function fp_stroke(P, pts, w0, w1, color, alpha) {
  if (w1 === undefined) w1 = w0;
  const segs = [];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) { const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); segs.push(l); total += l; }
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
  const m = Math.max(w0, w1);
  fp_fill(P, [x0 - m, y0 - m, x1 + m, y1 + m], function (u, v) {
    let acc = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const L2 = dx * dx + dy * dy || 1e-9;
      let t = ((u - a[0]) * dx + (v - a[1]) * dy) / L2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const px = a[0] + dx * t - u, py = a[1] + dy * t - v;
      const w = w0 + (w1 - w0) * (acc + segs[i] * t) / (total || 1);
      if (px * px + py * py <= (w * 0.5) * (w * 0.5)) return 1;
      acc += segs[i];
    }
    return 0;
  }, color, alpha);
}

function fp_noise(seed, u, v, s) {
  const x = u / s, y = v / s;
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = tx_hash(seed, xi, yi), b = tx_hash(seed, xi + 1, yi), c = tx_hash(seed, xi, yi + 1), d = tx_hash(seed, xi + 1, yi + 1);
  return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
}

function fp_mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
function fp_scale(c, k) { return [c[0] * k, c[1] * k, c[2] * k]; }

// Hilo de sangre que corre hacia abajo desde (x, y), con gota al final.
function fp_bloodStream(P, x, y, len, seed, width) {
  const pts = [[x, y]];
  let cx = x;
  const n = Math.max(2, Math.round(len * 1.5));
  for (let k = 1; k <= n; k++) {
    cx += (tx_hash(seed, k, 3) - 0.5) * 0.45;
    pts.push([cx, y + len * k / n]);
  }
  const w = width || 0.7;
  fp_stroke(P, pts, w, w * 0.55, [120, 4, 6]);
  fp_stroke(P, pts.map(function (p) { return [p[0] - w * 0.12, p[1]]; }), w * 0.45, w * 0.25, [196, 30, 26]);
  const end = pts[pts.length - 1];
  fp_ellipse(P, end[0], end[1] + 0.15, w * 0.5, w * 0.62, [130, 6, 8]);
  fp_ellipse(P, end[0] - 0.12, end[1], w * 0.18, w * 0.2, [235, 120, 110]);
}

function fp_cut(P, a, b, seed) {
  fp_stroke(P, [a, b], 0.55, 0.3, [90, 8, 10]);
  fp_stroke(P, [[a[0], a[1] - 0.18], [b[0], b[1] - 0.18]], 0.22, 0.12, [215, 60, 50]);
}

// --- El retrato -----------------------------------------------------------------------------------
// pain 0..4 (0 = sano); expr: 'st','ouch','evil','kill','god','dead'; look: -1/0/1; turn: -1/0/1
function FACE_Paint(pain, expr, look, turn) {
  const P = fp_new();
  const dead = expr === 'dead';
  const lvl = dead ? 4 : pain;
  const sh = turn * 1.3;                  // los rasgos se corren al girar la cabeza
  const hx = 16 + turn * 0.5, hy = 16.6;  // centro de la cabeza
  const L = [-0.55, -0.6, 0.58];          // luz desde arriba a la izquierda
  // tono de piel: curtido por el sol; pálido con la pérdida de sangre; gris al morir
  let skinLit = [226, 172, 128], skinShade = [118, 70, 52];
  if (lvl >= 3) { skinLit = fp_mix(skinLit, [214, 196, 178], 0.35); skinShade = fp_mix(skinShade, [104, 84, 78], 0.35); }
  if (dead) { skinLit = [190, 184, 162]; skinShade = [92, 88, 84]; }
  const skinAt = function (nx, ny, extra) {
    const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    const d = Math.max(0, -(nx * L[0] + ny * L[1]) * 0.9 + nz * L[2]);
    return fp_mix(skinShade, skinLit, Math.min(1, 0.18 + d * 0.95 + (extra || 0)));
  };

  // 1. Hombros: levita azul y cuello rojo
  const navy = function (u, v) { const k = 0.75 + 0.35 * (1 - Math.abs(u - 16) / 16) - (v - 24) * 0.03 + (fp_noise(41, u, v, 1.2) - 0.5) * 0.1; return fp_scale([46, 62, 128], k); };
  fp_poly(P, [[0, 30], [1.5, 25.5], [9, 23.6], [23, 23.6], [30.5, 25.5], [32, 30]], navy);
  fp_stroke(P, [[3, 25.6], [9.5, 24.2]], 0.35, 0.35, [90, 104, 170], 0.6);
  // 2. Cubrenuca (havelock) de lino blanco detrás de la cabeza
  const linen = function (u, v) {
    const fold = Math.sin((u - 16) * 2.2 + (v - 7) * 0.15) * 0.07;
    const side = 1 - Math.max(0, (u - 16) / 16) * 0.35;      // el lado derecho, en sombra
    const k = 0.78 + fold + (fp_noise(51, u, v, 0.9) - 0.5) * 0.08 - (v - 7) * 0.006;
    return fp_scale([236, 230, 212], k * side);
  };
  fp_poly(P, [[7.4 + turn * 0.3, 7], [24.6 + turn * 0.3, 7], [27.2, 23.4], [24, 25], [8, 25], [4.8, 23.4]], linen);
  // 3. Cuello
  fp_poly(P, [[12.6 + sh * 0.3, 20.5], [19.4 + sh * 0.3, 20.5], [20.2 + sh * 0.2, 25], [11.8 + sh * 0.2, 25]], function (u, v) {
    return fp_mix(skinShade, skinLit, 0.38 - Math.max(0, 23 - v) * 0.05 + (u < 16 ? 0.08 : -0.05));
  });
  // cuello rojo de la levita con botones de bronce
  fp_poly(P, [[10.6, 23.1], [21.4, 23.1], [23, 26.2], [9, 26.2]], function (u, v) { return fp_scale([196, 34, 30], 0.75 + (v - 23) * 0.06 + (u < 16 ? 0.12 : 0)); });
  fp_stroke(P, [[16, 26.2], [16, 30]], 0.35, 0.35, [24, 30, 70]);
  for (const by of [27.3, 29.3]) { fp_ellipse(P, 16.8, by, 0.62, 0.62, [214, 168, 70]); fp_ellipse(P, 16.6, by - 0.2, 0.22, 0.22, [255, 236, 170]); }
  // 4. Orejas (la lejana se esconde al girar)
  const earL = turn > 0 ? 0.6 : 1, earR = turn < 0 ? 0.6 : 1;
  fp_ellipse(P, hx - 7.3 - turn * 0.4, 16.9, 1.25 * earL, 2.2, function (u, v) { return skinAt(-0.6, (v - 16.9) / 2.6, -0.05); });
  fp_ellipse(P, hx + 7.3 - turn * 0.4, 16.9, 1.25 * earR, 2.2, function (u, v) { return skinAt(0.75, (v - 16.9) / 2.6, -0.12); });
  // 5. Cabeza: huevo con mandíbula y luz de modelado
  const headIn = function (u, v) {
    const dy = (v - hy) / 9.3;
    const rx = 7.35 * (dy > 0 ? 1 - 0.2 * dy * dy : 1 - 0.06 * dy * dy);
    const dx = (u - hx) / rx;
    return dx * dx + dy * dy <= 1 ? 1 : 0;
  };
  const headCol = function (u, v) {
    const dy = (v - hy) / 9.3;
    const rx = 7.35 * (dy > 0 ? 1 - 0.2 * dy * dy : 1 - 0.06 * dy * dy);
    const nx = (u - hx - turn * 0.6) / rx, ny = dy;
    let c = skinAt(nx * 0.95, ny * 0.9);
    // pómulos, ojeras, surcos y mentón
    const cheek = Math.exp(-(((u - (hx - 3.8 + sh * 0.6)) / 1.6) ** 2 + ((v - 18.2) / 1.2) ** 2));
    c = fp_mix(c, [235, 150, 120], cheek * 0.18);
    const fold = Math.exp(-((u - (hx - 2.9 + sh)) ** 2 / 0.25 + (v - 20.4) ** 2 / 1.8)) + Math.exp(-((u - (hx + 2.9 + sh)) ** 2 / 0.25 + (v - 20.4) ** 2 / 1.8));
    c = fp_mix(c, skinShade, fold * 0.35);
    // barba de tres días bajo el bigote y en la quijada
    if (v > 19.2) {
      const st = fp_noise(77, u * 3.1, v * 3.1, 1) > 0.55 ? 0.22 : 0.08;
      c = fp_mix(c, [70, 52, 44], st * Math.min(1, (v - 19.2) / 1.5));
    }
    // sudor y piel
    const grain = (fp_noise(91, u * 2.2, v * 2.2, 1) - 0.5) * 0.06;
    return fp_scale(c, 1 + grain);
  };
  fp_fill(P, [hx - 8, hy - 10, hx + 8, hy + 10], headIn, headCol);
  // patillas oscuras bajo el kepí
  fp_poly(P, [[hx - 7.2, 9.5], [hx - 5.6, 9.5], [hx - 5.9, 14.5], [hx - 6.9, 14]], [52, 36, 28]);
  fp_poly(P, [[hx + 5.6, 9.5], [hx + 7.2, 9.5], [hx + 6.9, 14], [hx + 5.9, 14.5]], [44, 30, 24]);

  // 6. Ojos, cejas, nariz, bigote y boca
  const eyeY = 15.3;
  const ex = [hx - 3.2 + sh, hx + 3.2 + sh];
  const angry = expr === 'kill' || expr === 'evil';
  const swollen = lvl >= 3;                       // ojo morado (el derecho del retrato)
  // cuencas en sombra
  for (let k = 0; k < 2; k++) fp_ellipse(P, ex[k], eyeY - 0.1, 2.15, 1.35, fp_scale(skinShade, 1.05), 0.45);
  for (let k = 0; k < 2; k++) {
    const x = ex[k];
    let ry = expr === 'ouch' ? 1.05 : angry ? 0.55 : 0.78;
    if (swollen && k === 1) ry *= 0.5;
    if (turn !== 0 && ((turn > 0 && k === 0) || (turn < 0 && k === 1))) ry *= 0.9;
    if (dead) {
      fp_stroke(P, [[x - 1.4, eyeY + 0.1], [x, eyeY + 0.35], [x + 1.4, eyeY + 0.1]], 0.35, 0.35, [70, 46, 40]);
      continue;
    }
    fp_ellipse(P, x, eyeY, 1.5, ry, [238, 232, 220]);
    const ix = x + (look * 0.62) + turn * 0.25, irisR = expr === 'ouch' ? 0.5 : 0.62;
    const irisC = expr === 'god' ? [255, 200, 40] : [88, 56, 34];
    fp_fill(P, [ix - irisR, eyeY - irisR, ix + irisR, eyeY + irisR], function (u, v) {
      const du = u - ix, dv = v - eyeY;
      if (du * du + dv * dv > irisR * irisR) return 0;
      const eu = (u - x) / 1.5, ev = (v - eyeY) / ry;
      return eu * eu + ev * ev <= 1 ? 1 : 0;
    }, irisC);
    if (expr !== 'god') fp_ellipse(P, ix, eyeY, irisR * 0.45, irisR * 0.45, [12, 10, 10]);
    fp_ellipse(P, ix - 0.22, eyeY - 0.22, 0.17, 0.17, [255, 255, 250]);
    // párpado superior y pestañas
    fp_stroke(P, [[x - 1.55, eyeY - ry * 0.25], [x - 0.4, eyeY - ry - 0.05], [x + 0.6, eyeY - ry - 0.02], [x + 1.55, eyeY - ry * 0.2]], 0.32, 0.25, [52, 34, 28]);
  }
  if (expr === 'god') for (let k = 0; k < 2; k++) fp_ellipse(P, ex[k], eyeY, 2.4, 1.6, [255, 220, 90], 0.25);
  // cejas
  const browLift = expr === 'ouch' ? -1.0 : 0;
  for (let k = 0; k < 2; k++) {
    const x = ex[k], s = k === 0 ? 1 : -1;
    const inner = angry ? 0.75 : expr === 'ouch' ? -0.35 : 0.1;
    const y0 = 13.25 + browLift;
    fp_stroke(P, [[x - 1.9 * s, y0 + 0.15], [x - 0.2 * s, y0 - 0.35], [x + 1.5 * s, y0 + inner]], 0.82, 0.55, [44, 30, 24]);
  }
  if (expr === 'ouch') for (const yy of [11.4, 12.0]) fp_stroke(P, [[hx - 2.5 + sh, yy], [hx + 2.5 + sh, yy - 0.1]], 0.16, 0.16, fp_scale(skinShade, 1.2), 0.6);
  // nariz
  const nx = hx + sh * 1.15;
  fp_stroke(P, [[nx - 0.2, 15.6], [nx - 0.1, 18.4]], 0.5, 0.65, fp_mix(skinLit, [255, 236, 210], 0.25), 0.7);
  fp_poly(P, [[nx + 0.3, 15.8], [nx + 1.0, 18.2], [nx + 1.2, 19.2], [nx + 0.4, 19.2]], skinShade, 0.45);
  fp_ellipse(P, nx + 0.1, 18.9, 1.25, 0.85, function (u, v) { return skinAt((u - nx) / 2.4, -0.1, 0.05); });
  fp_ellipse(P, nx - 0.7, 19.3, 0.38, 0.26, [76, 40, 34]);
  fp_ellipse(P, nx + 0.8, 19.3, 0.38, 0.26, [64, 34, 30]);
  // bigote espeso a la usanza de 1879
  const mx = hx + sh;
  const must = function (u, v) {
    const strand = fp_noise(13, u * 4, v * 0.8, 1);
    return fp_scale([58, 40, 30], 0.75 + strand * 0.5 - (v - 20) * 0.08);
  };
  fp_poly(P, [[mx - 4.4, 21.6], [mx - 3.6, 20.2], [mx - 1.8, 19.6], [mx, 20.0], [mx + 1.8, 19.6], [mx + 3.6, 20.2], [mx + 4.4, 21.6],
    [mx + 3.3, 21.9], [mx + 1.8, 21.1], [mx, 21.4], [mx - 1.8, 21.1], [mx - 3.3, 21.9]], must);
  // boca
  const my = 22.35;
  if (dead || expr === 'ouch') {
    fp_ellipse(P, mx, my + 0.35, 1.45, dead ? 0.85 : 1.05, [64, 10, 12]);
    fp_ellipse(P, mx, my - 0.25, 1.15, 0.3, [232, 222, 200]);
  } else if (expr === 'evil') {
    fp_poly(P, [[mx - 2.6, my - 0.3], [mx + 2.6, my - 0.3], [mx + 1.9, my + 0.75], [mx - 1.9, my + 0.75]], [236, 228, 208]);
    for (let k = -2; k <= 2; k++) fp_stroke(P, [[mx + k * 0.75, my - 0.25], [mx + k * 0.7, my + 0.7]], 0.12, 0.12, [120, 96, 84]);
    fp_stroke(P, [[mx - 2.7, my - 0.35], [mx + 2.7, my - 0.35]], 0.22, 0.22, [110, 50, 44]);
  } else if (expr === 'kill') {
    fp_poly(P, [[mx - 2.1, my - 0.35], [mx + 2.1, my - 0.35], [mx + 2.0, my + 0.55], [mx - 2.0, my + 0.55]], [228, 218, 196]);
    fp_stroke(P, [[mx - 2.1, my + 0.1], [mx + 2.1, my + 0.1]], 0.14, 0.14, [96, 70, 60]);
    for (let k = -2; k <= 2; k++) fp_stroke(P, [[mx + k * 0.8, my - 0.35], [mx + k * 0.8, my + 0.55]], 0.12, 0.12, [110, 84, 70]);
  } else {
    fp_stroke(P, [[mx - 1.6, my], [mx, my + 0.12], [mx + 1.6, my]], 0.35, 0.35, [116, 54, 46]);
    fp_stroke(P, [[mx - 1.1, my + 0.5], [mx + 1.1, my + 0.5]], 0.4, 0.4, fp_mix(skinLit, [200, 110, 96], 0.5), 0.6);
  }

  // 7. Heridas (se acumulan con el nivel de dolor)
  const onHead = function (fn) { return function (u, v) { return headIn(u, v) ? fn(u, v) : 0; }; };
  if (lvl >= 1) {
    // hollín y tierra
    fp_fill(P, [hx - 8, 9, hx + 8, 26], onHead(function (u, v) {
      const n = fp_noise(301, u, v, 1.6);
      return n > 0.62 ? (n - 0.62) * 2.2 : 0;
    }), [58, 50, 44], 0.32 + lvl * 0.06);
    // corte en el pómulo derecho del retrato
    fp_cut(P, [hx + 4.3 + sh, 17.4], [hx + 5.6 + sh, 18.6], 311);
    fp_bloodStream(P, hx + 5.2 + sh, 18.5, 1.6, 312, 0.5);
  }
  if (lvl >= 2) {
    // moretón en el pómulo y tajo en la frente que gotea sobre la ceja
    fp_ellipse(P, hx + 4.4 + sh, 17.3, 1.6, 1.1, [120, 60, 120], 0.35);
    fp_cut(P, [hx - 3.4 + sh, 11.1], [hx + 0.2 + sh, 10.6], 321);
    fp_bloodStream(P, hx - 2.4 + sh, 11.1, 2.6, 322, 0.6);
    fp_bloodStream(P, hx - 0.8 + sh, 10.9, 1.6, 323, 0.45);
  }
  if (lvl >= 3) {
    // ojo morado e hinchado, labio partido, sangre de la frente hasta la quijada
    fp_ellipse(P, ex[1], eyeY + 0.1, 2.0, 1.4, [96, 40, 96], 0.45);
    fp_ellipse(P, ex[1] + 0.3, eyeY + 0.9, 1.6, 0.6, [80, 30, 70], 0.4);
    fp_bloodStream(P, hx - 4.6 + sh, 11.3, 9.5, 331, 0.75);
    fp_bloodStream(P, mx + 1.3, 22.7, 2.6, 332, 0.55);
    fp_cut(P, [mx + 0.6, 22.0], [mx + 1.4, 22.9], 333);
  }
  if (lvl >= 4) {
    // nariz que sangra, sangre del oído, manchas y salpicaduras
    fp_bloodStream(P, nx - 0.7, 19.4, 1.6, 341, 0.55);
    fp_bloodStream(P, nx + 0.8, 19.4, 1.3, 342, 0.45);
    fp_bloodStream(P, hx - 7.0 - turn * 0.4, 18.4, 7.5, 343, 0.8);
    for (let k = 0; k < 14; k++) {
      const u = hx - 5.5 + tx_hash(344, k, 1) * 11 + sh, v = 12 + tx_hash(344, k, 2) * 11;
      if (headIn(u, v)) fp_ellipse(P, u, v, 0.18 + tx_hash(344, k, 3) * 0.3, 0.18 + tx_hash(344, k, 4) * 0.3, [150, 12, 12]);
    }
    fp_poly(P, [[19, 23.2], [22, 23.4], [23.4, 26.6], [20.4, 27.2]], [110, 6, 8], 0.55);   // cuello manchado
  }
  if (dead) {
    fp_ellipse(P, mx, my + 1.4, 1.2, 1.6, [120, 6, 8], 0.85);
    fp_bloodStream(P, mx - 0.6, my + 1.0, 4.2, 351, 0.8);
  }

  // 8. Venda en la frente (nivel 3+), empapada sobre el tajo
  if (lvl >= 3) {
    const bandage = function (u, v) {
      const soak = Math.exp(-(((u - (hx - 1.8 + sh)) / (dead ? 4 : 2.2)) ** 2 + ((v - 10.6) / 0.9) ** 2));
      const base = fp_scale([232, 224, 206], 0.82 + Math.sin(u * 3.0 + v) * 0.05);
      return fp_mix(base, [150, 14, 14], Math.min(1, soak * (lvl >= 4 ? 1.2 : 0.85)));
    };
    fp_poly(P, [[hx - 7.4, 9.6], [hx + 7.4, 10.4], [hx + 7.2, 12.0], [hx - 7.5, 11.2]], bandage);
    fp_stroke(P, [[hx - 7.4, 10.2], [hx + 7.3, 11.0]], 0.12, 0.12, [176, 168, 150], 0.7);
  }

  // 9. Kepí: copa roja, franja azul, escarapela y visera charolada
  const tilt = lvl >= 3 ? 0.07 : 0.02;
  const kx = hx + turn * 0.3;
  const R = function (p) { const dx = p[0] - kx, dy = p[1] - 7; return [kx + dx * Math.cos(tilt) - dy * Math.sin(tilt), 7 + dx * Math.sin(tilt) + dy * Math.cos(tilt)]; };
  const crown = [[kx - 6.2, 0.9], [kx + 6.9, 1.4], [kx + 7.9, 7.1], [kx - 7.7, 7.1]].map(R);
  fp_poly(P, crown, function (u, v) {
    const k = 0.62 + 0.42 * (1 - Math.abs(u - kx + 1.5) / 8) - (v < 2 ? 0.12 : 0) + (fp_noise(61, u, v, 0.8) - 0.5) * 0.07;
    return fp_scale([214, 34, 34], k * (u > kx + 4 ? 0.85 : 1));
  });
  fp_stroke(P, [R([kx - 6.2, 1.0]), R([kx + 6.9, 1.5])], 0.35, 0.35, [120, 16, 16]);
  fp_poly(P, [[kx - 7.9, 6.6], [kx + 8.0, 6.6], [kx + 8.1, 8.8], [kx - 8.0, 8.8]].map(R), function (u, v) {
    return fp_scale([40, 58, 138], 0.75 + (v < 7 ? 0.35 : 0) + (u < kx ? 0.1 : -0.05));
  });
  // escarapela con la estrella
  const ck = R([kx + turn * 0.4, 7.6]);
  fp_ellipse(P, ck[0], ck[1], 0.95, 0.95, [214, 170, 70]);
  fp_ellipse(P, ck[0], ck[1], 0.55, 0.55, [250, 246, 236]);
  fp_ellipse(P, ck[0], ck[1], 0.25, 0.25, [190, 30, 30]);
  // visera
  const vis = R([kx, 8.85]);
  fp_fill(P, [vis[0] - 8.6, vis[1] - 0.2, vis[0] + 8.6, vis[1] + 1.9], function (u, v) {
    const du = (u - vis[0]) / 8.4, dv = (v - vis[1]) / 1.65;
    return dv >= 0 && du * du + dv * dv <= 1 ? 1 : 0;
  }, function (u, v) { return v < vis[1] + 0.6 && u < vis[0] - 1 ? [96, 96, 104] : [18, 16, 18]; });
  fp_stroke(P, [[vis[0] - 6.5, vis[1] + 0.45], [vis[0] - 1.5, vis[1] + 0.75]], 0.28, 0.16, [200, 200, 210], 0.7);
  // kepí agujereado por un tiro (nivel 3+)
  if (lvl >= 3) {
    const hole = R([kx + 3.6, 3.6]);
    fp_ellipse(P, hole[0], hole[1], 0.85, 0.75, [236, 200, 180], 0.7);
    fp_ellipse(P, hole[0], hole[1], 0.55, 0.5, [20, 8, 8]);
  }
  if (expr === 'god') {
    fp_fill(P, [0, 0, FACE_W, FACE_H], function (u, v) {
      const d = Math.hypot((u - hx) / 9.5, (v - hy) / 12);
      return d > 0.85 && d < 1.05 ? 1 - Math.abs(d - 0.95) / 0.1 : 0;
    }, [255, 220, 120], 0.35);
  }
  return P;
}

// Reduce el lienzo (supermuestreo), suaviza los bordes contra el marco y
// cuantiza a la paleta con un tramado leve. Devuelve un patch de alta densidad.
function FACE_ToPatch(P) {
  const W = FACE_W * FACE_D, H = FACE_H * FACE_D, S = FACE_SS;
  const px = new Int16Array(W * H).fill(-1);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
        const k = (y * S + j) * P.w + (x * S + i);
        r += P.r[k]; g += P.g[k]; b += P.b[k]; a += P.a[k];
      }
      const n = S * S;
      a /= n;
      if (a < 0.4) continue;
      // color premultiplicado sobre el fondo del marco
      r = r / n + FACE_BOX[0] * (1 - a); g = g / n + FACE_BOX[1] * (1 - a); b = b / n + FACE_BOX[2] * (1 - a);
      const d = (TX_BAYER[((y & 3) << 2) | (x & 3)] / 16 - 0.47) * 5;
      px[y * W + x] = RGB(r + d, g + d, b + d);
    }
  }
  return {
    width: FACE_W, height: FACE_H, leftoffset: 0, topoffset: 0,
    density: FACE_D, pw: W, ph: H, columns: FONT_Posts(px, W, H, 0, W - 1, 0, H - 1), ocolumns: null,
    raw: px
  };
}

function FACE_Draw(pain, expr, look, turn) {
  return FACE_ToPatch(FACE_Paint(pain, expr, look, turn));
}

// Los 42 retratos se registran como lumps diferidos (W_AddLazyLump): pintarlos
// cuesta medio segundo, así que no se hace al arrancar. FACE_WarmStep pinta uno
// por cuadro mientras se está en la portada, los menús o el parte de
// operaciones; si en el campo hace falta uno que aún no está, se pinta al pedirlo.
const FACE_pending = [];

function FACE_Lazy(name, pain, expr, look, turn) {
  FACE_pending.push(W_AddLazyLump(name, function () { return FACE_Draw(pain, expr, look, turn); }, 'patch'));
}

function FACE_BuildLumps() {
  for (let p = 0; p < 5; p++) {
    FACE_Lazy('STFST' + p + '0', p, 'st', 0, 0);
    FACE_Lazy('STFST' + p + '1', p, 'st', 1, 0);
    FACE_Lazy('STFST' + p + '2', p, 'st', -1, 0);
    FACE_Lazy('STFTR' + p + '0', p, 'st', 1, 1);
    FACE_Lazy('STFTL' + p + '0', p, 'st', -1, -1);
    FACE_Lazy('STFOUCH' + p, p, 'ouch', 0, 0);
    FACE_Lazy('STFEVL' + p, p, 'evil', 0, 0);
    FACE_Lazy('STFKILL' + p, p, 'kill', 0, 0);
  }
  FACE_Lazy('STFGOD0', 0, 'god', 0, 0);
  FACE_Lazy('STFDEAD0', 4, 'dead', 0, 0);
}

// Pinta el siguiente retrato pendiente; devuelve false cuando no queda ninguno.
function FACE_WarmStep() {
  while (FACE_pending.length) {
    const num = FACE_pending.shift();
    if (lumpinfo[num].build) {
      W_CacheLumpNum(num);
      return true;
    }
  }
  return false;
}
