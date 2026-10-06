// =============================================================================
// foundry.js — "Fundición" de sprites: modelos 3D de primitivas → patches
// -----------------------------------------------------------------------------
// Los sprites de DOOM se obtuvieron fotografiando modelos de arcilla desde 8
// ángulos. Aquí se hace lo mismo por código: cada personaje u objeto es un
// conjunto de primitivas (elipsoides, cajas, cilindros) que se rasteriza con
// z-buffer desde 8 rotaciones (proyección ortográfica) o en perspectiva (armas
// en primera persona), se sombrea con luz fija y se cuantiza a las rampas de
// la paleta. Un contorno oscuro separa las figuras del fondo.
// =============================================================================
'use strict';

// --- Álgebra mínima ---------------------------------------------------------------------------------
function V3(x, y, z) { return [x, y, z]; }
function vadd(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function vsub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function vscale(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
function vdot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function vcross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function vlen(a) { return Math.sqrt(vdot(a, a)); }
function vnorm(a) { const l = vlen(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
function vlerp(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

// Matrices 3x3 por columnas: m = [c0, c1, c2] (cada una un vector).
function M3(c0, c1, c2) { return [c0, c1, c2]; }
function M3_I() { return [[1, 0, 0], [0, 1, 0], [0, 0, 1]]; }
function M3_mulv(m, v) {
  return [m[0][0] * v[0] + m[1][0] * v[1] + m[2][0] * v[2],
          m[0][1] * v[0] + m[1][1] * v[1] + m[2][1] * v[2],
          m[0][2] * v[0] + m[1][2] * v[1] + m[2][2] * v[2]];
}
function M3_mul(a, b) { return [M3_mulv(a, b[0]), M3_mulv(a, b[1]), M3_mulv(a, b[2])]; }
function M3_T(m) { return [[m[0][0], m[1][0], m[2][0]], [m[0][1], m[1][1], m[2][1]], [m[0][2], m[1][2], m[2][2]]]; }
function M3_rotX(a) { const c = Math.cos(a), s = Math.sin(a); return [[1, 0, 0], [0, c, s], [0, -s, c]]; }
function M3_rotY(a) { const c = Math.cos(a), s = Math.sin(a); return [[c, 0, -s], [0, 1, 0], [s, 0, c]]; }
function M3_rotZ(a) { const c = Math.cos(a), s = Math.sin(a); return [[c, s, 0], [-s, c, 0], [0, 0, 1]]; }
// Base cuyo eje local z apunta en la dirección d.
function M3_fromDir(d, upHint) {
  const w = vnorm(d);
  let up = upHint || [0, 0, 1];
  if (Math.abs(vdot(up, w)) > 0.95) up = [1, 0, 0];
  const u = vnorm(vcross(up, w));
  const v = vcross(w, u);
  return [u, v, w];
}

// --- Materiales ------------------------------------------------------------------------------------------
// ramp/tone: rampa y tono base de la paleta; k: amplitud del sombreado;
// spec: brillo especular (metales); glow: autoiluminado (fuego, fogonazos).
function MAT(ramp, tone, opts) { return Object.assign({ ramp: ramp, tone: tone, k: 7, spec: 0, glow: false }, opts || {}); }

// --- Primitivas ------------------------------------------------------------------------------------------
// Todas guardan centro c, matriz de orientación R (columnas = ejes locales) y
// su forma. Coordenadas del modelo: x adelante, y izquierda, z arriba.
function PR_ell(c, rx, ry, rz, R, mat) { return { t: 0, c: c, r: [rx, ry, rz], R: R || M3_I(), mat: mat }; }
function PR_box(c, hx, hy, hz, R, mat) { return { t: 1, c: c, r: [hx, hy, hz], R: R || M3_I(), mat: mat }; }
function PR_cyl(c, rad, hl, R, mat, rad2) { return { t: 2, c: c, r: [rad, rad2 === undefined ? rad : rad2, hl], R: R || M3_I(), mat: mat }; }
// Tela: elipsoide hueco recortado por planos locales; se ve por fuera y, por
// las aberturas, por dentro. clips: [[eje, signo, valor], ...] conserva los
// puntos con signo·(coordenada − valor) <= 0. Sirve para el cubrenuca (abierto
// adelante y abajo) y los faldones de la levita (abiertos arriba y abajo).
function PR_shell(c, rx, ry, rz, R, mat, clips) { return { t: 3, c: c, r: [rx, ry, rz], R: R || M3_I(), mat: mat, clips: clips }; }
// Extremidad: elipsoide alargado entre dos puntos.
function PR_limb(a, b, rad, mat, rad2) {
  const d = vsub(b, a);
  const L = vlen(d);
  return { t: 0, c: vlerp(a, b, 0.5), r: [rad, rad2 === undefined ? rad : rad2, L / 2 + rad * 0.55], R: M3_fromDir(d), mat: mat };
}
// Cilindro entre dos puntos.
function PR_rod(a, b, rad, mat, rad2) {
  const d = vsub(b, a);
  return { t: 2, c: vlerp(a, b, 0.5), r: [rad, rad2 === undefined ? rad : rad2, vlen(d) / 2], R: M3_fromDir(d), mat: mat };
}
function PR_boxAlong(a, b, hw, hh, mat, upHint) {
  const d = vsub(b, a);
  return { t: 1, c: vlerp(a, b, 0.5), r: [hw, hh, vlen(d) / 2], R: M3_fromDir(d, upHint), mat: mat };
}

// Transforma una escena completa (rotación R alrededor del origen y traslación t).
function SC_transform(scene, R, t) {
  return scene.map(function (p) {
    return Object.assign({}, p, { c: vadd(M3_mulv(R, p.c), t || [0, 0, 0]), R: M3_mul(R, p.R) });
  });
}

// Escala una escena alrededor del origen (objetos pequeños más legibles).
function SC_Scale(scene, k) {
  return scene.map(function (p) {
    const q = Object.assign({}, p, { c: vscale(p.c, k), r: vscale(p.r, k) });
    if (p.clips) q.clips = p.clips.map(function (cl) { return [cl[0], cl[1], cl[2] * k]; });
    return q;
  });
}

// --- Intersección rayo/primitiva en espacio local ----------------------------------------------------------
// o, d: origen y dirección del rayo en espacio local. Devuelve t o -1.
function PR_hitLocal(p, o, d, out) {
  const r = p.r;
  if (p.t === 3) {
    const ox = o[0] / r[0], oy = o[1] / r[1], oz = o[2] / r[2];
    const dx = d[0] / r[0], dy = d[1] / r[1], dz = d[2] / r[2];
    const a = dx * dx + dy * dy + dz * dz;
    const b = ox * dx + oy * dy + oz * dz;
    const c = ox * ox + oy * oy + oz * oz - 1;
    const disc = b * b - a * c;
    if (disc < 0) return -1;
    const sq = Math.sqrt(disc);
    for (let side = 0; side < 2; side++) {
      const t = (-b + (side ? sq : -sq)) / a;
      if (t < 0) continue;
      const hx = o[0] + d[0] * t, hy = o[1] + d[1] * t, hz = o[2] + d[2] * t;
      let cut = false;
      for (const cl of p.clips) {
        if (cl[1] * ((cl[0] === 0 ? hx : cl[0] === 1 ? hy : hz) - cl[2]) > 0) { cut = true; break; }
      }
      if (cut) continue;
      const sgn = side ? -1 : 1;   // por dentro, la normal se invierte
      out[0] = sgn * hx / (r[0] * r[0]); out[1] = sgn * hy / (r[1] * r[1]); out[2] = sgn * hz / (r[2] * r[2]);
      out[3] = hx; out[4] = hy; out[5] = hz;
      return t;
    }
    return -1;
  }
  if (p.t === 0) {
    const ox = o[0] / r[0], oy = o[1] / r[1], oz = o[2] / r[2];
    const dx = d[0] / r[0], dy = d[1] / r[1], dz = d[2] / r[2];
    const a = dx * dx + dy * dy + dz * dz;
    const b = ox * dx + oy * dy + oz * dz;
    const c = ox * ox + oy * oy + oz * oz - 1;
    const disc = b * b - a * c;
    if (disc < 0) return -1;
    const t = (-b - Math.sqrt(disc)) / a;
    if (t < 0) return -1;
    const hx = o[0] + d[0] * t, hy = o[1] + d[1] * t, hz = o[2] + d[2] * t;
    out[0] = hx / (r[0] * r[0]); out[1] = hy / (r[1] * r[1]); out[2] = hz / (r[2] * r[2]);
    out[3] = hx; out[4] = hy; out[5] = hz;
    return t;
  }
  if (p.t === 1) {
    let tmin = -Infinity, tmax = Infinity, axis = 0, sign = 1;
    for (let k = 0; k < 3; k++) {
      if (Math.abs(d[k]) < 1e-9) {
        if (o[k] < -r[k] || o[k] > r[k]) return -1;
      } else {
        let t1 = (-r[k] - o[k]) / d[k], t2 = (r[k] - o[k]) / d[k];
        let s = -1;
        if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; s = 1; }
        if (t1 > tmin) { tmin = t1; axis = k; sign = s; }
        if (t2 < tmax) tmax = t2;
        if (tmin > tmax) return -1;
      }
    }
    if (tmin < 0) return -1;
    out[0] = out[1] = out[2] = 0;
    out[axis] = sign;
    out[3] = o[0] + d[0] * tmin; out[4] = o[1] + d[1] * tmin; out[5] = o[2] + d[2] * tmin;
    return tmin;
  }
  // cilindro elíptico con tapas (eje local z)
  const rx = r[0], ry = r[1], hl = r[2];
  const ox = o[0] / rx, oy = o[1] / ry, dx = d[0] / rx, dy = d[1] / ry;
  let best = -1;
  const a = dx * dx + dy * dy;
  if (a > 1e-12) {
    const b = ox * dx + oy * dy;
    const c = ox * ox + oy * oy - 1;
    const disc = b * b - a * c;
    if (disc >= 0) {
      const t = (-b - Math.sqrt(disc)) / a;
      if (t >= 0) {
        const z = o[2] + d[2] * t;
        if (z >= -hl && z <= hl) {
          best = t;
          const hx = o[0] + d[0] * t, hy = o[1] + d[1] * t;
          out[0] = hx / (rx * rx); out[1] = hy / (ry * ry); out[2] = 0;
          out[3] = hx; out[4] = hy; out[5] = z;
        }
      }
    }
  }
  if (Math.abs(d[2]) > 1e-9) {
    for (const cap of [-hl, hl]) {
      const t = (cap - o[2]) / d[2];
      if (t < 0 || (best >= 0 && t >= best)) continue;
      const hx = o[0] + d[0] * t, hy = o[1] + d[1] * t;
      if ((hx * hx) / (rx * rx) + (hy * hy) / (ry * ry) <= 1) {
        best = t;
        out[0] = 0; out[1] = 0; out[2] = cap > 0 ? 1 : -1;
        out[3] = hx; out[4] = hy; out[5] = cap;
      }
    }
  }
  return best;
}

function PR_boundRadius(p) {
  if (p.t === 3) return Math.max(p.r[0], p.r[1], p.r[2]);
  if (p.t === 1) return Math.sqrt(p.r[0] * p.r[0] + p.r[1] * p.r[1] + p.r[2] * p.r[2]);
  if (p.t === 2) return Math.sqrt(Math.max(p.r[0], p.r[1]) ** 2 + p.r[2] * p.r[2]);
  return Math.max(p.r[0], p.r[1], p.r[2]);
}

// --- Revelado: luz, oclusión, contorno y paleta --------------------------------------------------------
// El rasterizado guarda por texel la profundidad, la normal, el punto local y el
// material (un G-buffer). El revelado ilumina en espacio lineal:
//   * sol cálido con luz envolvente, cielo frío desde arriba y rebote de la
//     arena desde abajo;
//   * contraluz desde atrás a la derecha, que despega la figura del fondo;
//   * brillo especular en los metales;
//   * oclusión ambiental medida en el buffer de profundidad (axilas, pliegues,
//     la mano sobre la culata);
//   * textura leve de la tela y contorno oscuro de la silueta.
// Al final se cuantiza a la paleta con tramado ordenado (Bayer 4x4), como el
// rostro de la barra de estado.
// Espacio de vista: x a la derecha, y arriba, z hacia el fondo (la cámara mira +z).
const FND_SUN = vnorm([-0.5, 0.6, -0.62]);        // desde arriba a la izquierda, del lado de la cámara
const FND_RIMDIR = vnorm([0.72, 0.3, 0.62]);      // contraluz: desde atrás a la derecha
const FND_HALF = vnorm(vadd(FND_SUN, [0, 0, -1]));
const FND_SUNCOL = [1.0, 0.93, 0.8], FND_SKYCOL = [0.52, 0.6, 0.78];
const FND_GNDCOL = [0.5, 0.4, 0.28], FND_RIMCOL = [1.0, 0.88, 0.7];
const FND_KSKY = 0.6, FND_KGND = 0.3, FND_KRIM = 0.5, FND_WRAP = 0.35;
// Luz que recibe una cara vuelta al sol: con ella se normaliza, de modo que el
// tono de cada material es su color a pleno sol (como en los modelos de antes).
const FND_REF = (function () {
  const hemi = 0.5 + 0.5 * FND_SUN[1];
  const l = [0, 1, 2].map(function (c) { return FND_SUNCOL[c] + FND_SKYCOL[c] * hemi * FND_KSKY + FND_GNDCOL[c] * (1 - hemi) * FND_KGND; });
  return 0.3 * l[0] + 0.59 * l[1] + 0.11 * l[2];
})();
const FND_BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

// sRGB <-> lineal con tablas (el revelado hace millones de conversiones).
const FND_LIN = new Float32Array(256);
const FND_SRGB = new Float32Array(4097);
(function () {
  for (let i = 0; i < 256; i++) FND_LIN[i] = Math.pow(i / 255, 2.2);
  for (let i = 0; i <= 4096; i++) FND_SRGB[i] = 255 * Math.pow(i / 4096, 1 / 2.2);
})();
function FND_ToSRGB(v) { return v <= 0 ? 0 : v >= 1 ? 255 : FND_SRGB[(v * 4096) | 0]; }

// Color lineal de una rampa en un tono fraccionario (interpolado entre tonos).
const FND_rampLin = [];
function FND_RampLin(ramp, tone, out) {
  let tab = FND_rampLin[ramp];
  if (!tab) {
    tab = FND_rampLin[ramp] = new Float32Array(16 * 3);
    for (let t = 0; t < 16; t++) {
      const c = C(ramp, t) * 3;
      tab[t * 3] = FND_LIN[PAL_BASE[c]]; tab[t * 3 + 1] = FND_LIN[PAL_BASE[c + 1]]; tab[t * 3 + 2] = FND_LIN[PAL_BASE[c + 2]];
    }
  }
  if (tone <= 0) tone = 0; else if (tone >= 15) tone = 15;
  const a = tone | 0, b = a < 15 ? a + 1 : 15, f = tone - a;
  out[0] = tab[a * 3] + (tab[b * 3] - tab[a * 3]) * f;
  out[1] = tab[a * 3 + 1] + (tab[b * 3 + 1] - tab[a * 3 + 1]) * f;
  out[2] = tab[a * 3 + 2] + (tab[b * 3 + 2] - tab[a * 3 + 2]) * f;
  return out;
}

// Escala de las coordenadas locales que reciben los patrones de material
// (al rasterizar a mayor resolución la escena se amplía; los patrones no).
let FND_lpScale = 1;

function FND_GBuf(w, h) {
  const N = w * h;
  return { w: w, h: h, z: new Float32Array(N).fill(Infinity), id: new Int32Array(N).fill(-1),
    n: new Float32Array(N * 3), lp: new Float32Array(N * 3), mats: [], types: [] };
}

function FND_Hash3(x, y, z) {
  let hsh = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2147483647);
  hsh = Math.imul(hsh ^ (hsh >>> 13), 1274126177);
  return ((hsh ^ (hsh >>> 16)) >>> 0) / 4294967296;
}

// Revela un G-buffer. o: { aoR (radio de oclusión en texeles), aoEps, aoRange,
// edgeTh (salto de profundidad que se contornea), relDepth (perspectiva: los
// umbrales son fracciones de la profundidad), outline, mip }.
// Devuelve la imagen recortada { w, h, px, cropX, cropY } (y mip si se pide).
function FND_Develop(g, o) {
  const w = g.w, h = g.h, id = g.id, z = g.z, gn = g.n, gl = g.lp, mats = g.mats;
  let x0 = w, x1 = -1, y0 = h, y1 = -1;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      if (id[row + x] >= 0) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
  }
  if (x1 < 0) return { w: 1, h: 1, px: new Int16Array([-1]), cropX: 0, cropY: 0 };
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
  const rgb = new Float32Array(cw * ch * 3);
  // muestras de oclusión: 8 direcciones alternando dos radios (desplazamientos
  // en x, en y y en el índice del buffer; lejos del borde no hace falta acotar)
  const offX = new Int32Array(8), offY = new Int32Array(8), offI = new Int32Array(8);
  let margin = 0;
  for (let k = 0; k < 8; k++) {
    const a = k * Math.PI / 4 + 0.39, rad = (k & 1 ? 2.6 : 1.3) * o.aoR;
    offX[k] = Math.round(Math.cos(a) * rad); offY[k] = Math.round(Math.sin(a) * rad);
    offI[k] = offY[k] * w + offX[k];
    margin = Math.max(margin, Math.abs(offX[k]), Math.abs(offY[k]));
  }
  const rel = !!o.relDepth;
  const alb = [0, 0, 0];
  // albedo de cada material sin patrón: se calcula una vez
  const albCache = new Map();
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = y * w + x;
      const k = id[i];
      if (k < 0) continue;
      const mat = mats[k];
      const oi = ((y - y0) * cw + (x - x0)) * 3;
      let nx = gn[i * 3], ny = gn[i * 3 + 1], nz = gn[i * 3 + 2];
      const nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      nx /= nl; ny /= nl; nz /= nl;
      let tone = mat.tone;
      if (mat.pattern) {
        const sc = FND_lpScale;
        tone += mat.pattern([gl[i * 3] * sc, gl[i * 3 + 1] * sc, gl[i * 3 + 2] * sc], [nx, ny, nz]);
      }
      if (mat.glow) {
        const c = C(mat.ramp, clamp(Math.round(tone), 0, 15)) * 3;
        rgb[oi] = PAL_BASE[c]; rgb[oi + 1] = PAL_BASE[c + 1]; rgb[oi + 2] = PAL_BASE[c + 2];
        continue;
      }
      if (mat.pattern) FND_RampLin(mat.ramp, tone, alb);
      else {
        let ca = albCache.get(mat);
        if (!ca) { ca = FND_RampLin(mat.ramp, tone, [0, 0, 0]); albCache.set(mat, ca); }
        alb[0] = ca[0]; alb[1] = ca[1]; alb[2] = ca[2];
      }
      // textura de la tela (los metales quedan lisos)
      if (!mat.spec) {
        const sc = FND_lpScale * 1.6;
        const v = FND_Hash3(Math.floor(gl[i * 3] * sc), Math.floor(gl[i * 3 + 1] * sc), Math.floor(gl[i * 3 + 2] * sc));
        const f = 1 + (v - 0.5) * 0.12;
        alb[0] *= f; alb[1] *= f; alb[2] *= f;
      }
      // oclusión ambiental
      const zc = z[i];
      let occ = 0;
      const eps = rel ? zc * 0.015 : o.aoEps, range = rel ? zc * 0.35 : o.aoRange;
      const inner = x >= margin && y >= margin && x < w - margin && y < h - margin;
      const kr = 1 / (range * 0.35);
      for (let s = 0; s < 8; s++) {
        let j;
        if (inner) j = i + offI[s];
        else {
          const sx = x + offX[s], sy = y + offY[s];
          if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue;
          j = sy * w + sx;
        }
        if (id[j] < 0) continue;
        const dz = zc - z[j];
        if (dz > eps && dz < range) { const q = (dz - eps) * kr; occ += q < 1 ? q : 1; }
      }
      const ao = 1 - 0.5 * occ / 8;
      // luces
      const key = Math.max(0, (nx * FND_SUN[0] + ny * FND_SUN[1] + nz * FND_SUN[2] + FND_WRAP) / (1 + FND_WRAP));
      const hemi = 0.5 + 0.5 * ny;
      let rim = nx * FND_RIMDIR[0] + ny * FND_RIMDIR[1] + nz * FND_RIMDIR[2];
      rim = rim > 0 ? rim * rim * FND_KRIM : 0;
      const sky = hemi * FND_KSKY, gnd = (1 - hemi) * FND_KGND;
      let spec = 0;
      if (mat.spec) {
        // en las caras planas de las cajas el brillo sería un rectángulo uniforme
        const hd = nx * FND_HALF[0] + ny * FND_HALF[1] + nz * FND_HALF[2];
        if (hd > 0) {
          const h2 = hd * hd, h4 = h2 * h2, h8 = h4 * h4;
          spec = h8 * h8 * h8 * mat.spec * (g.types[k] === 1 ? 0.1 : 0.3);   // hd^24
        }
      }
      const kao = ao / FND_REF;
      for (let c = 0; c < 3; c++) {
        const light = FND_SUNCOL[c] * key + FND_SKYCOL[c] * sky + FND_GNDCOL[c] * gnd + FND_RIMCOL[c] * rim;
        const v = alb[c] * light * kao + spec * FND_SUNCOL[c];
        rgb[oi + c] = v <= 0 ? 0 : v >= 1 ? 255 : FND_SRGB[(v * 4096) | 0];
      }
    }
  }
  // contorno: silueta más oscura y saltos de profundidad algo menos
  if (o.outline) {
    const dark = new Float32Array(cw * ch);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * w + x;
        if (id[i] < 0 || mats[id[i]].glow) continue;
        let edge = false, inner = false;
        const th = rel ? z[i] * o.edgeTh : o.edgeTh;
        for (let d = 0; d < 4; d++) {
          const xx = x + (d === 0 ? 1 : d === 1 ? -1 : 0), yy = y + (d === 2 ? 1 : d === 3 ? -1 : 0);
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) { if (!o.openBorder) edge = true; continue; }
          const j = yy * w + xx;
          if (id[j] < 0) edge = true;
          else if (z[i] - z[j] > th) inner = true;
        }
        if (edge || inner) dark[(y - y0) * cw + (x - x0)] = edge ? 0.58 : 0.76;
      }
    }
    for (let p = 0; p < cw * ch; p++) {
      if (!dark[p]) continue;
      rgb[p * 3] *= dark[p]; rgb[p * 3 + 1] *= dark[p]; rgb[p * 3 + 2] *= dark[p];
    }
  }
  const mask = new Uint8Array(cw * ch);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (id[y * w + x] >= 0) mask[(y - y0) * cw + (x - x0)] = 1;
  const img = { w: cw, h: ch, px: FND_Quantize(rgb, mask, cw, ch, 9), cropX: x0, cropY: y0 };
  if (o.mip) img.mip = FND_Mip(rgb, mask, cw, ch);
  return img;
}

// Cuantiza a la paleta con tramado ordenado de amplitud amp (en niveles sRGB).
function FND_Quantize(rgb, mask, w, h, amp) {
  const px = new Int16Array(w * h).fill(-1);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      if (!mask[p]) continue;
      const d = (FND_BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.47) * amp;
      px[p] = RGB((rgb[p * 3] + d) | 0, (rgb[p * 3 + 1] + d) | 0, (rgb[p * 3 + 2] + d) | 0);
    }
  }
  return px;
}

// Versión a la mitad de resolución para las figuras lejanas: el renderizador
// la usa cuando cada texel ocupa menos de medio píxel de pantalla (evita el
// centelleo de los sprites reducidos sin filtro).
function FND_Mip(rgb, mask, w, h) {
  const w2 = (w + 1) >> 1, h2 = (h + 1) >> 1;
  const r2 = new Float32Array(w2 * h2 * 3), m2 = new Uint8Array(w2 * h2);
  for (let y = 0; y < h2; y++) {
    for (let x = 0; x < w2; x++) {
      let n = 0, r = 0, g = 0, b = 0;
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
        const xx = x * 2 + dx, yy = y * 2 + dy;
        if (xx >= w || yy >= h) continue;
        const p = yy * w + xx;
        if (!mask[p]) continue;
        n++; r += FND_LIN[rgb[p * 3] | 0]; g += FND_LIN[rgb[p * 3 + 1] | 0]; b += FND_LIN[rgb[p * 3 + 2] | 0];
      }
      if (n < 2) continue;
      const q = y * w2 + x;
      m2[q] = 1;
      r2[q * 3] = FND_ToSRGB(r / n); r2[q * 3 + 1] = FND_ToSRGB(g / n); r2[q * 3 + 2] = FND_ToSRGB(b / n);
    }
  }
  return { w: w2, h: h2, px: FND_Quantize(r2, m2, w2, h2, 5) };
}

// --- Rasterizado ----------------------------------------------------------------------------------------------
// Vista ortográfica: cámara mirando hacia +x (en el espacio ya rotado) con una
// elevación 'elev' (mirando levemente hacia abajo). Pantalla: derecha = -y.
function FND_ViewMatrix(yaw, elev) {
  // Espacio de vista: filas = (derecha, arriba, profundidad)
  const ce = Math.cos(elev), se = Math.sin(elev);
  const f = [ce, 0, -se];          // hacia adelante (profundidad creciente)
  const r = [0, -1, 0];            // derecha de la pantalla
  const u = [se, 0, ce];           // arriba de la pantalla
  // Matriz que lleva del modelo (rotado por yaw) al espacio de vista.
  const Rm = M3_rotZ(yaw);
  const V = [[r[0], u[0], f[0]], [r[1], u[1], f[1]], [r[2], u[2], f[2]]]; // columnas = ejes del mundo en vista
  return M3_mul(V, Rm);
}

// Esquinas de la caja local (±r) de una primitiva llevadas al espacio de vista.
function PR_Corners(R, c, r) {
  const out = [];
  for (let k = 0; k < 8; k++) {
    const lx = (k & 1 ? 1 : -1) * r[0], ly = (k & 2 ? 1 : -1) * r[1], lz = (k & 4 ? 1 : -1) * r[2];
    out.push([c[0] + R[0][0] * lx + R[1][0] * ly + R[2][0] * lz,
              c[1] + R[0][1] * lx + R[1][1] * ly + R[2][1] * lz,
              c[2] + R[0][2] * lx + R[1][2] * ly + R[2][2] * lz]);
  }
  return out;
}
const PR_EDGES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];

// Renderiza una escena a una imagen indexada. Devuelve { w, h, px, left, top }
// y, con opts.mip, la versión reducida en img.mip (con sus desplazamientos).
// opts.res: texeles por unidad de mapa (3 = sprites de alta resolución).
function FND_Render(scene, opts) {
  const res = opts.res || 1;
  if (res !== 1) {
    FND_lpScale = 1 / res;
    try { return FND_RenderOrtho(SC_Scale(scene, res), opts, res); } finally { FND_lpScale = 1; }
  }
  return FND_RenderOrtho(scene, opts, 1);
}

function FND_RenderOrtho(scene, opts, res) {
  const yaw = opts.yaw || 0, elev = opts.elev === undefined ? 0.17 : opts.elev;
  const VM = FND_ViewMatrix(yaw, elev);
  // Preparar primitivas en espacio de vista con su rectángulo proyectado.
  const prims = [];
  let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
  for (const p of scene) {
    const c = M3_mulv(VM, p.c);
    const R = M3_mul(VM, p.R);
    let bx0 = Infinity, bx1 = -Infinity, by0 = Infinity, by1 = -Infinity;
    if (p.t === 0) {
      // elipsoide: extensión exacta de su proyección (más ajustada que la caja)
      const r = p.r;
      const ex = Math.sqrt((R[0][0] * r[0]) ** 2 + (R[1][0] * r[1]) ** 2 + (R[2][0] * r[2]) ** 2);
      const ey = Math.sqrt((R[0][1] * r[0]) ** 2 + (R[1][1] * r[1]) ** 2 + (R[2][1] * r[2]) ** 2);
      bx0 = c[0] - ex; bx1 = c[0] + ex; by0 = c[1] - ey; by1 = c[1] + ey;
    } else {
      for (const q of PR_Corners(R, c, p.r)) {
        if (q[0] < bx0) bx0 = q[0]; if (q[0] > bx1) bx1 = q[0];
        if (q[1] < by0) by0 = q[1]; if (q[1] > by1) by1 = q[1];
      }
    }
    prims.push({ p: p, c: c, R: R, Rt: M3_T(R), bx0: bx0, bx1: bx1, by0: by0, by1: by1 });
    minx = Math.min(minx, bx0); maxx = Math.max(maxx, bx1);
    miny = Math.min(miny, by0); maxy = Math.max(maxy, by1);
  }
  if (!prims.length) return { w: 1, h: 1, px: new Int16Array([-1]), left: 0, top: 0 };
  const x0 = Math.floor(minx) - 2, x1 = Math.ceil(maxx) + 2;
  const y0 = Math.floor(miny) - 2, y1 = Math.ceil(maxy) + 2;
  const w = x1 - x0, h = y1 - y0;
  const g = FND_GBuf(w, h);
  const gz = g.z, gid = g.id, gn = g.n, gl = g.lp;
  const out = [0, 0, 0, 0, 0, 0];
  const lo = [0, 0, 0], ld = [0, 0, 0];
  for (let k = 0; k < prims.length; k++) {
    const q = prims[k];
    g.mats.push(q.p.mat);
    g.types.push(q.p.t);
    const Rt = q.Rt, R = q.R;
    // dirección del rayo (0,0,1) en espacio local = tercera columna de Rt
    ld[0] = Rt[2][0]; ld[1] = Rt[2][1]; ld[2] = Rt[2][2];
    const ix0 = Math.max(0, Math.floor(q.bx0 - x0)), ix1 = Math.min(w - 1, Math.ceil(q.bx1 - x0));
    const iy0 = Math.max(0, Math.floor(y1 - q.by1)), iy1 = Math.min(h - 1, Math.ceil(y1 - q.by0));
    const oz = -1000 - q.c[2];
    if (q.p.t === 0) {
      // Elipsoide (la mayoría de las primitivas): intersección en línea, con
      // las constantes del rayo paralelo precalculadas (igual resultado que
      // PR_hitLocal, una quinta parte menos de tiempo en la fundición).
      const r = q.p.r, irx = 1 / r[0], iry = 1 / r[1], irz = 1 / r[2];
      const dx = ld[0] * irx, dy = ld[1] * iry, dz = ld[2] * irz;
      const a = dx * dx + dy * dy + dz * dz, ia = 1 / a;
      const nx2 = irx * irx, ny2 = iry * iry, nz2 = irz * irz;
      for (let iy = iy0; iy <= iy1; iy++) {
        const oy = y1 - iy - 0.5 - q.c[1];
        const b0 = Rt[1][0] * oy + Rt[2][0] * oz, b1 = Rt[1][1] * oy + Rt[2][1] * oz, b2 = Rt[1][2] * oy + Rt[2][2] * oz;
        for (let ix = ix0; ix <= ix1; ix++) {
          const ox = x0 + ix + 0.5 - q.c[0];
          const l0 = Rt[0][0] * ox + b0, l1 = Rt[0][1] * ox + b1, l2 = Rt[0][2] * ox + b2;
          const sx = l0 * irx, sy = l1 * iry, sz = l2 * irz;
          const b = sx * dx + sy * dy + sz * dz;
          const disc = b * b - a * (sx * sx + sy * sy + sz * sz - 1);
          if (disc < 0) continue;
          const t = (-b - Math.sqrt(disc)) * ia;
          if (t < 0) continue;
          const depth = -1000 + t;
          const i = iy * w + ix;
          if (depth >= gz[i]) continue;
          gz[i] = depth;
          gid[i] = k;
          const hx = l0 + ld[0] * t, hy = l1 + ld[1] * t, hz = l2 + ld[2] * t;
          const o0 = hx * nx2, o1 = hy * ny2, o2 = hz * nz2, j = i * 3;
          gn[j] = R[0][0] * o0 + R[1][0] * o1 + R[2][0] * o2;
          gn[j + 1] = R[0][1] * o0 + R[1][1] * o1 + R[2][1] * o2;
          gn[j + 2] = R[0][2] * o0 + R[1][2] * o1 + R[2][2] * o2;
          gl[j] = hx; gl[j + 1] = hy; gl[j + 2] = hz;
        }
      }
      continue;
    }
    for (let iy = iy0; iy <= iy1; iy++) {
      const oy = y1 - iy - 0.5 - q.c[1];
      for (let ix = ix0; ix <= ix1; ix++) {
        const ox = x0 + ix + 0.5 - q.c[0];
        lo[0] = Rt[0][0] * ox + Rt[1][0] * oy + Rt[2][0] * oz;
        lo[1] = Rt[0][1] * ox + Rt[1][1] * oy + Rt[2][1] * oz;
        lo[2] = Rt[0][2] * ox + Rt[1][2] * oy + Rt[2][2] * oz;
        const t = PR_hitLocal(q.p, lo, ld, out);
        if (t < 0) continue;
        const depth = -1000 + t;
        const i = iy * w + ix;
        if (depth >= gz[i]) continue;
        gz[i] = depth;
        gid[i] = k;
        const o0 = out[0], o1 = out[1], o2 = out[2], j = i * 3;
        gn[j] = R[0][0] * o0 + R[1][0] * o1 + R[2][0] * o2;
        gn[j + 1] = R[0][1] * o0 + R[1][1] * o1 + R[2][1] * o2;
        gn[j + 2] = R[0][2] * o0 + R[1][2] * o1 + R[2][2] * o2;
        gl[j] = out[3]; gl[j + 1] = out[4]; gl[j + 2] = out[5];
      }
    }
  }
  const img = FND_Develop(g, { aoR: res, aoEps: 0.5 * res, aoRange: 9 * res, edgeTh: 7 * res, outline: opts.outline !== false, mip: !!opts.mip });
  img.left = -x0 - img.cropX;
  img.top = y1 - img.cropY;
  if (img.mip) { img.mip.left = img.left / 2; img.mip.top = img.top / 2; }
  return img;
}

// Perspectiva (armas en primera persona): el ojo está en el origen mirando +x.
// La pantalla lógica es de 320x200 con proyección 160 (como DOOM); opts.res
// multiplica la resolución (4 = 1280x800) y opts.zoom la distancia focal.
function FND_RenderPersp(scene, opts) {
  opts = opts || {};
  const res = opts.res || 1;
  const W = 320 * res, H = 200 * res, proj = 160 * res * (opts.zoom || 1), NEAR = 0.5;
  const CX = 160 * res, CY = 100 * res;
  // Rectángulo de pantalla de cada primitiva (proyección de su caja local
  // recortada al plano cercano); el G-buffer cubre sólo la unión de todos.
  const rects = [];
  let ux0 = W, ux1 = -1, uy0 = H, uy1 = -1;
  for (const p of scene) {
    const cs = PR_Corners(p.R, p.c, p.r);
    const pts = [];
    for (const q of cs) if (q[0] >= NEAR) pts.push(q);
    for (const e of PR_EDGES) {
      const a = cs[e[0]], b = cs[e[1]];
      if ((a[0] < NEAR) !== (b[0] < NEAR)) pts.push(vlerp(a, b, (NEAR - a[0]) / (b[0] - a[0])));
    }
    let r = null;
    if (pts.length) {
      let sx0 = Infinity, sx1 = -Infinity, sy0 = Infinity, sy1 = -Infinity;
      for (const q of pts) {
        const sx = CX - q[1] / q[0] * proj, sy = CY - q[2] / q[0] * proj;
        if (sx < sx0) sx0 = sx; if (sx > sx1) sx1 = sx;
        if (sy < sy0) sy0 = sy; if (sy > sy1) sy1 = sy;
      }
      const ix0 = Math.max(0, Math.floor(sx0) - 1), ix1 = Math.min(W - 1, Math.ceil(sx1) + 1);
      const iy0 = Math.max(0, Math.floor(sy0) - 1), iy1 = Math.min(H - 1, Math.ceil(sy1) + 1);
      if (ix0 <= ix1 && iy0 <= iy1) {
        r = [ix0, ix1, iy0, iy1];
        if (ix0 < ux0) ux0 = ix0; if (ix1 > ux1) ux1 = ix1;
        if (iy0 < uy0) uy0 = iy0; if (iy1 > uy1) uy1 = iy1;
      }
    }
    rects.push(r);
  }
  if (ux1 < 0) return { w: 1, h: 1, px: new Int16Array([-1]), left: 0, top: 0, cropX: 0, cropY: 0, screenX: 0, screenY: 0 };
  const GW = ux1 - ux0 + 1, GH = uy1 - uy0 + 1;
  const g = FND_GBuf(GW, GH);
  const gz = g.z, gid = g.id, gn = g.n, gl = g.lp;
  const out = [0, 0, 0, 0, 0, 0];
  const lo = [0, 0, 0], ld = [0, 0, 0];
  for (let k = 0; k < scene.length; k++) {
    const p = scene[k];
    g.mats.push(p.mat);
    g.types.push(p.t);
    const rc = rects[k];
    if (!rc) continue;
    const R = p.R, Rt = M3_T(R);
    const oc = M3_mulv(Rt, vsub([0, 0, 0], p.c));
    for (let iy = rc[2]; iy <= rc[3]; iy++) {
      const dz = (CY - (iy + 0.5)) / proj;
      const row = (iy - uy0) * GW - ux0;
      for (let ix = rc[0]; ix <= rc[1]; ix++) {
        const dy = (CX - (ix + 0.5)) / proj;
        ld[0] = Rt[0][0] + Rt[1][0] * dy + Rt[2][0] * dz;
        ld[1] = Rt[0][1] + Rt[1][1] * dy + Rt[2][1] * dz;
        ld[2] = Rt[0][2] + Rt[1][2] * dy + Rt[2][2] * dz;
        lo[0] = oc[0]; lo[1] = oc[1]; lo[2] = oc[2];
        const t = PR_hitLocal(p, lo, ld, out);
        if (t < 0) continue;
        const i = row + ix;
        if (t >= gz[i]) continue;
        gz[i] = t;
        gid[i] = k;
        const o0 = out[0], o1 = out[1], o2 = out[2], j = i * 3;
        // normal en cámara (x adelante, y izquierda, z arriba) -> vista (derecha, arriba, fondo)
        const cx = R[0][0] * o0 + R[1][0] * o1 + R[2][0] * o2;
        const cy = R[0][1] * o0 + R[1][1] * o1 + R[2][1] * o2;
        const cz = R[0][2] * o0 + R[1][2] * o1 + R[2][2] * o2;
        gn[j] = -cy; gn[j + 1] = cz; gn[j + 2] = cx;
        gl[j] = out[3]; gl[j + 1] = out[4]; gl[j + 2] = out[5];
      }
    }
  }
  // el arma sigue más allá del borde de la pantalla: ese borde no se contornea
  const img = FND_Develop(g, { aoR: res * 1.6, relDepth: true, edgeTh: 0.12, outline: opts.outline !== false, openBorder: true });
  img.cropX += ux0;
  img.cropY += uy0;
  img.left = -img.cropX;
  img.top = -img.cropY;
  // coordenadas de pantalla de la esquina superior izquierda del recorte
  img.screenX = img.cropX;
  img.screenY = img.cropY;
  return img;
}

function FND_ToPatch(img) {
  return V_MakePatch(img.w, img.h, img.px, img.left, img.top);
}
