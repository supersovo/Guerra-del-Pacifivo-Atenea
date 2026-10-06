// =============================================================================
// textures.js — Texturas de muro y "flats" generados proceduralmente
// -----------------------------------------------------------------------------
// Todas las superficies del juego se pintan por código al arrancar (no hay
// archivos de imagen): rocas del acantilado de Pisagua, adobe, tablas de pino
// oregón, sacos terreros, calaminas de las oficinas salitreras, cascos de
// buques, rieles del ferrocarril, caliche de la pampa, mar animado, etc.
// Se pintan en color verdadero y se cuantizan a la paleta de 256 colores con
// un leve tramado ordenado, como las texturas de DOOM.
// =============================================================================
'use strict';

// --- Herramientas -------------------------------------------------------------------
function tx_hash(seed, x, y) {
  let h = (seed | 0) ^ Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function tx_vnoise(seed, x, y, cx, cy) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = x - x0, fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const X0 = ((x0 % cx) + cx) % cx, X1 = (X0 + 1) % cx;
  const Y0 = ((y0 % cy) + cy) % cy, Y1 = (Y0 + 1) % cy;
  const a = tx_hash(seed, X0, Y0), b = tx_hash(seed, X1, Y0);
  const c = tx_hash(seed, X0, Y1), d = tx_hash(seed, X1, Y1);
  const top = a + (b - a) * sx, bot = c + (d - c) * sx;
  return top + (bot - top) * sy;
}

// Ruido fractal repetible (tileable) de w x h.
function tx_fbm(w, h, seed, cellsX, cellsY, oct, pers) {
  const out = new Float32Array(w * h);
  let amp = 1, total = 0;
  pers = pers || 0.5;
  for (let o = 0; o < oct; o++) {
    const cx = cellsX << o, cy = cellsY << o;
    const s = seed + o * 1013;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        out[y * w + x] += amp * tx_vnoise(s, x / w * cx, y / h * cy, cx, cy);
      }
    }
    total += amp;
    amp *= pers;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

// Voronoi repetible: distancias al punto más cercano y al segundo.
function tx_voronoi(w, h, seed, n, jitterGrid) {
  const rng = M_SeededRNG(seed);
  const pts = [];
  if (jitterGrid) {
    const gx = jitterGrid[0], gy = jitterGrid[1];
    for (let j = 0; j < gy; j++) {
      for (let i = 0; i < gx; i++) {
        pts.push([(i + 0.15 + rng() * 0.7) * w / gx, (j + 0.15 + rng() * 0.7) * h / gy]);
      }
    }
  } else {
    for (let i = 0; i < n; i++) pts.push([rng() * w, rng() * h]);
  }
  const d1 = new Float32Array(w * h), d2 = new Float32Array(w * h), id = new Int32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let b1 = 1e9, b2 = 1e9, bi = 0;
      for (let k = 0; k < pts.length; k++) {
        let dx = Math.abs(x - pts[k][0]); dx = Math.min(dx, w - dx);
        let dy = Math.abs(y - pts[k][1]); dy = Math.min(dy, h - dy);
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < b1) { b2 = b1; b1 = d; bi = k; } else if (d < b2) b2 = d;
      }
      d1[y * w + x] = b1; d2[y * w + x] = b2; id[y * w + x] = bi;
    }
  }
  return { d1: d1, d2: d2, id: id, pts: pts };
}

function tx_new(w, h) {
  return { w: w, h: h, r: new Float32Array(w * h), g: new Float32Array(w * h), b: new Float32Array(w * h) };
}
function tx_idx(t, x, y) {
  x = ((x % t.w) + t.w) % t.w;
  y = ((y % t.h) + t.h) % t.h;
  return y * t.w + x;
}
function tx_put(t, x, y, c) {
  const i = tx_idx(t, Math.floor(x), Math.floor(y));
  t.r[i] = c[0]; t.g[i] = c[1]; t.b[i] = c[2];
}
function tx_blend(t, x, y, c, a) {
  const i = tx_idx(t, Math.floor(x), Math.floor(y));
  t.r[i] += (c[0] - t.r[i]) * a; t.g[i] += (c[1] - t.g[i]) * a; t.b[i] += (c[2] - t.b[i]) * a;
}
function tx_mul(t, x, y, f) {
  const i = tx_idx(t, Math.floor(x), Math.floor(y));
  t.r[i] *= f; t.g[i] *= f; t.b[i] *= f;
}
function tx_get(t, x, y) {
  const i = tx_idx(t, Math.floor(x), Math.floor(y));
  return [t.r[i], t.g[i], t.b[i]];
}
function tx_fill(t, c) {
  t.r.fill(c[0]); t.g.fill(c[1]); t.b.fill(c[2]);
}
function tx_rect(t, x0, y0, w, h, c, a) {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      if (a === undefined) tx_put(t, x, y, c); else tx_blend(t, x, y, c, a);
    }
  }
}
function tx_disc(t, cx, cy, r, c, a) {
  for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) {
    for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d <= r) { if (a === undefined) tx_put(t, x, y, c); else tx_blend(t, x, y, c, a); }
    }
  }
}
function tx_line(t, x0, y0, x1, y1, c, a) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= n; i++) {
    const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n;
    if (a === undefined) tx_put(t, x, y, c); else tx_blend(t, x, y, c, a);
  }
}
function tx_mix(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
function tx_scale(c, f) { return [c[0] * f, c[1] * f, c[2] * f]; }

// Texto con la fuente de mapa de bits sobre una textura.
function tx_text(t, x, y, str, c, scale, shadow) {
  scale = scale || 1;
  let cx = x;
  for (const ch of str) {
    if (ch === ' ') { cx += 4 * scale; continue; }
    const g = FONT_GetGlyph(ch);
    if (!g) { cx += 4 * scale; continue; }
    const gw = g.rows[0].length;
    for (let r = 0; r < g.rows.length; r++) {
      for (let k = 0; k < gw; k++) {
        if (g.rows[r][k] !== '#') continue;
        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            const px = cx + k * scale + dx, py = y + (g.top + r) * scale + dy;
            if (shadow) tx_put(t, px + 1, py + 1, shadow);
          }
        }
      }
    }
    for (let r = 0; r < g.rows.length; r++) {
      for (let k = 0; k < gw; k++) {
        if (g.rows[r][k] !== '#') continue;
        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) tx_put(t, cx + k * scale + dx, y + (g.top + r) * scale + dy, c);
        }
      }
    }
    cx += (gw + 1) * scale;
  }
  return cx;
}
function tx_textWidth(str, scale) {
  scale = scale || 1;
  let w = 0;
  for (const ch of str) {
    if (ch === ' ') { w += 4 * scale; continue; }
    const g = FONT_GetGlyph(ch);
    w += g ? (g.rows[0].length + 1) * scale : 4 * scale;
  }
  return w - scale;
}

const TX_BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
function tx_quantize(t, dither) {
  const out = new Uint8Array(t.w * t.h);
  const amt = dither === undefined ? 6 : dither;
  for (let y = 0; y < t.h; y++) {
    for (let x = 0; x < t.w; x++) {
      const i = y * t.w + x;
      const d = (TX_BAYER[((y & 3) << 2) | (x & 3)] / 16 - 0.47) * amt;
      out[i] = RGB(t.r[i] + d, t.g[i] + d, t.b[i] + d);
    }
  }
  return out;
}

// --- Doble densidad -------------------------------------------------------------------
// Las texturas se diseñan a 1 texel por unidad de mapa (como DOOM) y se
// registran a TX_RES texeles por unidad para pantallas grandes: ampliación
// "bilineal nítida" (pesos suavizados, los bordes siguen definidos), con
// envolvimiento porque las texturas se repiten, más un grano fino que evita
// el aspecto borroso. El renderizador lee la densidad (textures[...].density;
// flats de 128x128).
const TX_RES = 2;

function tx_upscale(t, k, alpha) {
  const W = t.w * k, H = t.h * k;
  const o = tx_new(W, H);
  const oa = alpha ? new Float32Array(W * H) : null;
  const sw = t.w, sh = t.h;
  for (let y = 0; y < H; y++) {
    const fy = (y + 0.5) / k - 0.5;
    const yi = Math.floor(fy);
    let wy = fy - yi; wy = wy * wy * (3 - 2 * wy);
    const r0 = ((yi % sh) + sh) % sh * sw, r1 = ((yi + 1) % sh + sh) % sh * sw;
    for (let x = 0; x < W; x++) {
      const fx = (x + 0.5) / k - 0.5;
      const xi = Math.floor(fx);
      let wx = fx - xi; wx = wx * wx * (3 - 2 * wx);
      const c0 = ((xi % sw) + sw) % sw, c1 = ((xi + 1) % sw + sw) % sw;
      const a = r0 + c0, b = r0 + c1, c = r1 + c0, d = r1 + c1;
      const w00 = (1 - wx) * (1 - wy), w01 = wx * (1 - wy), w10 = (1 - wx) * wy, w11 = wx * wy;
      const g = 1 + (tx_hash(7717, x, y) - 0.5) * 0.05;
      const i = y * W + x;
      o.r[i] = (t.r[a] * w00 + t.r[b] * w01 + t.r[c] * w10 + t.r[d] * w11) * g;
      o.g[i] = (t.g[a] * w00 + t.g[b] * w01 + t.g[c] * w10 + t.g[d] * w11) * g;
      o.b[i] = (t.b[a] * w00 + t.b[b] * w01 + t.b[c] * w10 + t.b[d] * w11) * g;
      if (oa) oa[i] = alpha[a] * w00 + alpha[b] * w01 + alpha[c] * w10 + alpha[d] * w11;
    }
  }
  return alpha ? { t: o, alpha: oa } : o;
}

// keepRes: la imagen ya viene a la densidad final (cielos).
function tx_register(name, t, dither, keepRes) {
  if (!keepRes && TX_RES > 1) t = tx_upscale(t, TX_RES);
  const idx = tx_quantize(t, dither);
  const cols = [];
  for (let x = 0; x < t.w; x++) {
    const col = new Uint8Array(t.h);
    for (let y = 0; y < t.h; y++) col[y] = idx[y * t.w + x];
    cols.push(col);
  }
  W_AddLump(name, { width: t.w, height: t.h, columns: cols, masked: false, density: keepRes ? 1 : TX_RES }, 'texture');
  return idx;
}

// Textura enmascarada: alpha[i] < 0.5 = transparente.
function tx_registerMasked(name, t, alpha, dither) {
  if (TX_RES > 1) { const u = tx_upscale(t, TX_RES, alpha); t = u.t; alpha = u.alpha; }
  const idx = tx_quantize(t, dither);
  const px = new Int16Array(t.w * t.h);
  for (let i = 0; i < px.length; i++) px[i] = alpha[i] >= 0.5 ? idx[i] : -1;
  const patch = V_MakePatch(t.w, t.h, px, 0, 0);
  const cols = [];
  for (let x = 0; x < t.w; x++) {
    const col = new Uint8Array(t.h);
    for (let y = 0; y < t.h; y++) col[y] = idx[y * t.w + x];
    cols.push(col);
  }
  W_AddLump(name, { width: t.w, height: t.h, columns: cols, posts: patch.columns, masked: true, density: TX_RES }, 'texture');
}

// Flat de 64x64 unidades: se guarda a 64·TX_RES texeles de lado.
function tx_registerFlat(name, t, dither) {
  if (TX_RES > 1) t = tx_upscale(t, TX_RES);
  W_AddLump(name, tx_quantize(t, dither), 'flat');
}

// --- Generadores de muros ---------------------------------------------------------------

// Barranco sedimentario: capas de grosor irregular (las duras sobresalen y
// forman aleros que dan sombra a las blandas), cárcavas verticales de la
// erosión, grietas, guijarros y relieve iluminado desde arriba a la izquierda.
// La altura es la de la textura (las capas se repiten en vertical sin costura).
function txg_strata(w, h, seed, light, dark, opts) {
  opts = opts || {};
  const t = tx_new(w, h);
  const rng = M_SeededRNG(seed);
  const layerOf = new Int32Array(h * 4);
  const layers = [];
  for (let y = 0; y < h;) {
    const th = Math.min(h - y, (opts.minLayer || 5) + Math.floor(rng() * (opts.maxLayer || 20)));
    layers.push({ y0: y, th: th, hard: rng(), tint: rng() });
    for (let k = y; k < y + th; k++) layerOf[k] = layers.length - 1;
    y += th;
  }
  const warp = tx_fbm(w, h, seed + 1, 4, 2, 3, 0.5);
  const n1 = tx_fbm(w, h, seed + 2, 8, 8, 4, 0.55);
  const gully = tx_fbm(w, h, seed + 3, 28, 2, 3, 0.5);
  const hf = new Float32Array(w * h);
  const base = new Float32Array(w * h);
  const gul = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let yy = y + (warp[i] - 0.5) * (opts.warp || 14);
      yy = ((Math.floor(yy) % h) + h) % h;
      const L = layers[layerOf[yy]];
      const f = (yy - L.y0) / L.th;
      const g = Math.max(0, gully[i] - 0.58) * 2.4 * (0.4 + f * 0.6);
      gul[i] = g;
      hf[i] = L.hard * 0.7 + (n1[i] - 0.5) * 0.45 - (1 - L.hard) * f * 0.55 - g * 0.5;
      base[i] = 0.32 + 0.42 * L.tint + (n1[i] - 0.5) * 0.3;
    }
  }
  const crack = new Uint8Array(w * h);
  for (let c = 0; c < (opts.cracks === undefined ? 10 : opts.cracks); c++) {
    let x = rng() * w, y = rng() * h;
    let dir = Math.PI / 2 + (rng() - 0.5) * 0.7;
    const len = 12 + rng() * 40;
    for (let k = 0; k < len; k++) {
      x += Math.cos(dir); y += Math.sin(dir);
      dir += (rng() - 0.5) * 0.45;
      crack[tx_idx(t, Math.floor(x), Math.floor(y))] = 1;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const gx = hf[tx_idx(t, x - 1, y)] - hf[tx_idx(t, x + 1, y)];
      const gy = hf[tx_idx(t, x, y - 1)] - hf[tx_idx(t, x, y + 1)];
      let sh = 1 + gx * 1.1 + gy * 2.2;
      // alero: si arriba sobresale una capa dura, sombra
      const above = hf[tx_idx(t, x, y - 3)];
      if (above - hf[i] > 0.25) sh *= 0.72;
      let c = tx_scale(tx_mix(dark, light, clamp(base[i], 0, 1)), clamp(sh, 0.45, 1.4) * (1 - gul[i] * 0.35));
      if (crack[i]) c = tx_scale(c, 0.45);
      else if (crack[tx_idx(t, x - 1, y)]) c = tx_scale(c, 1.12);
      const hs = tx_hash(seed + 5, x, y);
      if (hs < 0.012) c = tx_scale(c, 0.6);
      else if (hs > 0.992) c = tx_scale(c, 1.25);
      t.r[i] = c[0]; t.g[i] = c[1]; t.b[i] = c[2];
    }
  }
  return t;
}

// Talud de arena o tierra compactada: grano fino, capas tenues, regueros de
// erosión que bajan desde el borde, pie más oscuro y guijarros con luz y sombra.
function txg_bank(w, h, seed, base, opts) {
  opts = opts || {};
  const t = tx_new(w, h);
  const n = tx_fbm(w, h, seed, 6, 3, 5, 0.55);
  const fine = tx_fbm(w, h, seed + 1, 32, 16, 2, 0.5);
  const rill = tx_fbm(w, h, seed + 2, 40, 2, 2, 0.5);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const fy = y / h;
      let v = 0.9 + (n[i] - 0.5) * 0.24 + (fine[i] - 0.5) * 0.16 + Math.sin((y + n[i] * 10) / h * Math.PI * 2 * (opts.layers || 3)) * 0.035;
      v *= 1.04 - fy * 0.14;
      if (rill[i] > 0.68) v *= 0.92 + (1 - fy) * 0.03;
      const c = tx_scale(base, v);
      t.r[i] = c[0]; t.g[i] = c[1]; t.b[i] = c[2];
    }
  }
  const rng = M_SeededRNG(seed + 9);
  const np = Math.floor(w * h * (opts.pebbles || 0.004));
  for (let k = 0; k < np; k++) {
    const cx = rng() * w, cy = rng() * h, r = 0.6 + rng() * 1.5;
    const pc = tx_mix(opts.pebbleColor || [120, 108, 96], base, 0.25 + rng() * 0.45);
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const ex = dx / r, ey = dy / (r * 0.75);
      const d = ex * ex + ey * ey;
      const xx = Math.floor(cx + dx), yy = Math.floor(cy + dy);
      if (d <= 1) tx_put(t, xx, yy, tx_scale(pc, 1.15 - (ex + ey) * 0.22));
      else if (d <= 1.9 && dx >= 0 && dy >= 0) tx_put(t, xx, yy, tx_scale(tx_get(t, xx, yy), 0.78));   // sombra
    }
  }
  return t;
}

// Bloques (adobe, piedra canteada, ladrillo).
function txg_blocks(w, h, seed, bw, bh, base, mortar, opts) {
  opts = opts || {};
  const t = tx_new(w, h);
  const n = tx_fbm(w, h, seed, 4, 4, 4, 0.5);
  const fine = tx_fbm(w, h, seed + 5, 16, 16, 2, 0.5);
  const mw = opts.mortar === undefined ? 2 : opts.mortar;
  for (let y = 0; y < h; y++) {
    const row = Math.floor(y / bh);
    const off = (row % 2) * Math.floor(bw / 2);
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const bx = Math.floor((x + off) / bw);
      const ix = (x + off) % bw, iy = y % bh;
      const var_ = 0.86 + tx_hash(seed + 3, bx, row) * 0.26;
      let c;
      const eroded = opts.erode && n[i] < opts.erode && (ix < mw + 2 || iy < mw + 2 || ix > bw - 3 || iy > bh - 3);
      if (ix < mw || iy < mw || eroded) {
        c = tx_scale(mortar, 0.85 + fine[i] * 0.3);
      } else {
        c = tx_scale(base, var_ * (0.88 + fine[i] * 0.24) * (0.9 + n[i] * 0.2));
        if (iy === mw) c = tx_scale(c, opts.bevel ? 1.18 : 1.06);
        if (ix === mw) c = tx_scale(c, opts.bevel ? 1.1 : 1.03);
        if (iy === bh - 1) c = tx_scale(c, opts.bevel ? 0.7 : 0.86);
        if (ix === bw - 1) c = tx_scale(c, opts.bevel ? 0.8 : 0.92);
        if (opts.specks && tx_hash(seed + 11, x, y) < opts.specks) c = tx_mix(c, [220, 190, 130], 0.5);
      }
      t.r[i] = c[0]; t.g[i] = c[1]; t.b[i] = c[2];
    }
  }
  return t;
}

// Tablas de madera (horizontales o verticales), con vetas y clavos.
function txg_planks(w, h, seed, base, opts) {
  opts = opts || {};
  const t = tx_new(w, h);
  const vertical = !!opts.vertical;
  const pw = opts.plank || 16;
  const n = tx_fbm(w, h, seed, 4, 8, 4, 0.5);
  const grainN = tx_fbm(w, h, seed + 9, vertical ? 16 : 2, vertical ? 2 : 16, 3, 0.5);
  const wear = tx_fbm(w, h, seed + 21, 6, 6, 4, 0.55);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const along = vertical ? y : x;
      const across = vertical ? x : y;
      const k = Math.floor(across / pw), within = across % pw;
      const pv = 0.82 + tx_hash(seed + 1, k, 0) * 0.3;
      const grain = Math.sin(along * 0.23 + grainN[i] * 14 + k * 3);
      let c = tx_scale(base, pv * (0.9 + grain * 0.06 + n[i] * 0.12));
      if (opts.paint) {
        const worn = wear[i] > (opts.paintWear || 0.62);
        if (!worn) {
          c = tx_scale(opts.paint, 0.86 + n[i] * 0.2 + grain * 0.02);
          if (wear[i] > (opts.paintWear || 0.62) - 0.04) c = tx_scale(c, 0.8);
        }
      }
      if (within === 0) c = tx_scale(c, 0.3);
      else if (within === 1) c = tx_scale(c, 0.72);
      else if (within === pw - 1) c = tx_scale(c, 1.1);
      // clavos
      const nailSpacing = opts.nails || 32;
      if (nailSpacing && (along % nailSpacing === 5) && (within === 4 || within === pw - 5)) c = [34, 28, 24];
      t.r[i] = c[0]; t.g[i] = c[1]; t.b[i] = c[2];
    }
  }
  return t;
}

// Sacos terreros apilados.
function txg_sacks(seed, base, opts) {
  opts = opts || {};
  const w = 64, h = 64;
  const t = tx_new(w, h);
  const n = tx_fbm(w, h, seed, 8, 8, 3, 0.5);
  const bw = 32, bh = 16;
  for (let y = 0; y < h; y++) {
    const row = Math.floor(y / bh);
    const off = (row % 2) * 16 + Math.floor(tx_hash(seed, row, 1) * 5);
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const bx = Math.floor((x + off) / bw);
      const u = (((x + off) % bw) - bw / 2 + 0.5) / (bw / 2);
      const v = ((y % bh) - bh / 2 + 0.5) / (bh / 2);
      const r = u * u * 0.55 + v * v * 1.0 + Math.pow(Math.abs(u), 8) * 0.9;
      const var_ = 0.88 + tx_hash(seed + 2, bx, row) * 0.22;
      let c;
      if (r > 1) c = tx_scale(base, 0.28);
      else {
        const shade = (1.08 - r * 0.42 - v * 0.18) * var_;
        const weave = ((x + y) & 1) ? 1.03 : 0.97;
        c = tx_scale(base, shade * weave * (0.9 + n[i] * 0.2));
        if (Math.abs(u) > 0.84 && Math.abs(v) < 0.3) c = tx_scale(c, 0.8); // amarras
      }
      t.r[i] = c[0]; t.g[i] = c[1]; t.b[i] = c[2];
    }
  }
  return t;
}

// Calamina (fierro galvanizado corrugado) de las oficinas salitreras.
function txg_corrugated(seed, w, h, base) {
  const t = tx_new(w, h);
  const rust = tx_fbm(w, h, seed, 8, 2, 4, 0.55);
  const n = tx_fbm(w, h, seed + 3, 4, 4, 3, 0.5);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const rib = Math.sin((x / 8) * Math.PI * 2);
      let c = tx_scale(base, 0.86 + rib * 0.18 + n[i] * 0.1);
      const rr = rust[i] + (y / h) * 0.25;
      if (rr > 0.62) c = tx_mix(c, tx_scale([148, 78, 40], 0.8 + rib * 0.15), clamp((rr - 0.62) * 4, 0, 0.9));
      if (x % 64 === 0) c = tx_scale(c, 0.6);
      if ((y === 3 || y === h - 4) && x % 8 === 4) c = [60, 58, 56];
      t.r[i] = c[0]; t.g[i] = c[1]; t.b[i] = c[2];
    }
  }
  return t;
}

// Planchas de hierro remachadas.
function txg_iron(seed, w, h, base, plate) {
  const t = tx_new(w, h);
  const n = tx_fbm(w, h, seed, 4, 4, 4, 0.5);
  const rust = tx_fbm(w, h, seed + 1, 6, 3, 3, 0.5);
  plate = plate || 32;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let c = tx_scale(base, 0.85 + n[i] * 0.3);
      if (rust[i] > 0.66) c = tx_mix(c, [120, 64, 36], (rust[i] - 0.66) * 2);
      const px = x % plate, py = y % plate;
      if (px === 0 || py === 0) c = tx_scale(c, 0.55);
      else if (px === 1 || py === 1) c = tx_scale(c, 1.15);
      if ((px === 4 || px === plate - 4) && py % 6 === 3) c = [base[0] * 1.5, base[1] * 1.5, base[2] * 1.5];
      if ((px === 5 || px === plate - 3) && py % 6 === 4) c = tx_scale(base, 0.4);
      if ((py === 4 || py === plate - 4) && px % 6 === 3) c = [base[0] * 1.5, base[1] * 1.5, base[2] * 1.5];
      if ((py === 5 || py === plate - 3) && px % 6 === 4) c = tx_scale(base, 0.4);
      t.r[i] = c[0]; t.g[i] = c[1]; t.b[i] = c[2];
    }
  }
  return t;
}

// Ventana sobre un muro existente (marco de madera, postigos o vidrio).
function txg_addWindow(t, x0, y0, ww, wh, frame, glass) {
  tx_rect(t, x0 - 3, y0 - 3, ww + 6, wh + 6, tx_scale(frame, 0.55));
  tx_rect(t, x0 - 2, y0 - 2, ww + 4, wh + 4, frame);
  for (let y = 0; y < wh; y++) {
    for (let x = 0; x < ww; x++) {
      let c;
      if (glass) {
        c = tx_scale([36, 44, 56], 0.8 + (y / wh) * 0.4);
        if (Math.abs((x - y * 0.5) - ww * 0.3) < 1.5) c = [120, 140, 160];
        if (x === Math.floor(ww / 2) || y === Math.floor(wh / 2)) c = frame;
      } else {
        const slat = y % 5;
        c = tx_scale(frame, slat === 0 ? 0.55 : slat === 1 ? 1.12 : 0.92);
        if (x === Math.floor(ww / 2)) c = tx_scale(frame, 0.45);
      }
      tx_put(t, x0 + x, y0 + y, c);
    }
  }
  tx_rect(t, x0 - 4, y0 + wh + 2, ww + 8, 3, tx_scale(frame, 1.15));
  tx_rect(t, x0 - 4, y0 + wh + 5, ww + 8, 1, tx_scale(frame, 0.4));
}

// Letrero de madera pintado.
function txg_sign(name, text, w, h, board, ink, scale) {
  const t = txg_planks(w, h, name.length * 31 + w, board, { plank: Math.max(8, Math.floor(h / 2)), nails: 0 });
  tx_rect(t, 0, 0, w, 2, tx_scale(board, 0.5));
  tx_rect(t, 0, h - 2, w, 2, tx_scale(board, 0.45));
  tx_rect(t, 0, 0, 2, h, tx_scale(board, 0.5));
  tx_rect(t, w - 2, 0, 2, h, tx_scale(board, 0.45));
  scale = scale || 2;
  const tw = tx_textWidth(text, scale);
  const x = Math.floor((w - tw) / 2);
  const y = Math.floor((h - 7 * scale) / 2);
  tx_text(t, x, y, text, ink, scale, tx_scale(board, 0.35));
  tx_register(name, t, 3);
}

// --- Generadores de flats -----------------------------------------------------------------
function txf_sand(seed, base, opts) {
  opts = opts || {};
  const t = tx_new(64, 64);
  const n = tx_fbm(64, 64, seed, 4, 4, 4, 0.55);
  const f = tx_fbm(64, 64, seed + 1, 32, 32, 1, 0.5);
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const i = y * 64 + x;
      const ripple = opts.ripple ? Math.sin((x * 0.6 + y * 0.25 + n[i] * 12)) * opts.ripple : 0;
      let c = tx_scale(base, 0.88 + n[i] * 0.2 + (f[i] - 0.5) * 0.16 + ripple);
      const h = tx_hash(seed + 7, x, y);
      if (opts.pebbles && h < opts.pebbles) c = tx_scale(opts.pebbleColor || [120, 110, 100], 0.8 + tx_hash(seed + 8, x, y) * 0.5);
      if (opts.shells && h > 1 - opts.shells) c = [236, 230, 214];
      t.r[i] = c[0]; t.g[i] = c[1]; t.b[i] = c[2];
    }
  }
  return t;
}

function txf_voronoiStones(seed, n, stone, gap, var_) {
  const t = tx_new(64, 64);
  const v = tx_voronoi(64, 64, seed, n);
  const nn = tx_fbm(64, 64, seed + 3, 8, 8, 2, 0.5);
  for (let i = 0; i < 64 * 64; i++) {
    const e = v.d2[i] - v.d1[i];
    let c;
    if (e < 1.6) c = gap;
    else {
      const k = 0.84 + tx_hash(seed, v.id[i], 0) * var_;
      c = tx_scale(stone, k * (1.08 - Math.min(v.d1[i], 9) * 0.02) * (0.9 + nn[i] * 0.2));
      if (e < 2.6) c = tx_scale(c, 0.8);
    }
    t.r[i] = c[0]; t.g[i] = c[1]; t.b[i] = c[2];
  }
  return t;
}

// =============================================================================
// Construcción de todas las texturas y flats
// =============================================================================
function TX_BuildTextures() {
  W_AddMarker('T_START');

  // Textura de error (tablero magenta), índice de respaldo.
  {
    const t = tx_new(64, 64);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) tx_put(t, x, y, ((x >> 3) ^ (y >> 3)) & 1 ? [255, 0, 255] : [20, 20, 20]);
    tx_register('ERROR', t, 0);
  }

  // --- Roca y terreno ---
  tx_register('ROCA1', txg_strata(256, 128, 101, [192, 176, 152], [74, 64, 54], { maxLayer: 18 }), 6);
  tx_register('ROCA2', txg_strata(256, 128, 202, [204, 160, 116], [88, 58, 40], { maxLayer: 22, cracks: 12 }), 6);
  tx_register('ROCA4', txg_strata(256, 128, 404, [162, 150, 136], [54, 48, 44], { maxLayer: 14, cracks: 16, warp: 8 }), 6);
  {
    // Peñascos (voronoi) para rompientes y parapetos naturales.
    const t = tx_new(64, 64);
    const v = tx_voronoi(64, 64, 303, 14);
    const n = tx_fbm(64, 64, 304, 8, 8, 3, 0.5);
    for (let i = 0; i < 64 * 64; i++) {
      const e = v.d2[i] - v.d1[i];
      const k = 0.8 + tx_hash(305, v.id[i], 0) * 0.35;
      let c = tx_scale([150, 136, 118], k * (1.15 - v.d1[i] * 0.035) * (0.85 + n[i] * 0.3));
      if (e < 2) c = [44, 38, 32];
      t.r[i] = c[0]; t.g[i] = c[1]; t.b[i] = c[2];
    }
    tx_register('ROCA3', t, 6);
  }
  tx_register('ARENAW', txg_bank(256, 64, 410, [200, 170, 122], { layers: 2, pebbles: 0.003, pebbleColor: [150, 132, 112] }), 5);
  tx_register('TIERRA1', txg_bank(128, 64, 420, [146, 112, 80], { layers: 4, pebbles: 0.005, pebbleColor: [118, 100, 84] }), 5);
  {
    const t = txf_sand(430, [208, 202, 186], { pebbles: 0.03, pebbleColor: [150, 140, 128] });
    tx_register('CALICHEW', t, 4);
  }

  // --- Adobe y revoques ---
  const ADOBE_BASE = [178, 124, 82], ADOBE_MORTAR = [150, 118, 86];
  tx_register('ADOBE1', txg_blocks(64, 64, 501, 32, 16, ADOBE_BASE, ADOBE_MORTAR, { mortar: 3, specks: 0.03, erode: 0.34 }), 5);
  function whitewash(seed, w, h, dirtBottom) {
    const t = tx_new(w, h);
    const stain = tx_fbm(w, h, seed, 4, 8, 5, 0.55);
    const peel = tx_fbm(w, h, seed + 1, 3, 6, 4, 0.5);
    const ad = txg_blocks(w, h, seed + 2, 32, 16, ADOBE_BASE, ADOBE_MORTAR, { mortar: 3 });
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        let c = tx_scale([230, 222, 204], 0.9 + stain[i] * 0.14);
        if (dirtBottom) {
          const d = clamp((y - h * 0.78) / (h * 0.22), 0, 1);
          c = tx_mix(c, [150, 128, 100], d * 0.75 * (0.7 + stain[i] * 0.5));
        }
        if (peel[i] > 0.7) c = [ad.r[i], ad.g[i], ad.b[i]];
        else if (peel[i] > 0.68) c = tx_scale(c, 0.7);
        t.r[i] = c[0]; t.g[i] = c[1]; t.b[i] = c[2];
      }
    }
    return t;
  }
  tx_register('ADOBE2', whitewash(510, 64, 128, true), 4);
  {
    const t = whitewash(520, 64, 128, true);
    txg_addWindow(t, 18, 34, 28, 40, [118, 84, 54], false);
    tx_register('ADOBEV', t, 4);
  }
  {
    const t = whitewash(530, 64, 128, true);
    tx_rect(t, 0, 0, 64, 6, [120, 86, 56]);
    tx_rect(t, 0, 6, 64, 1, [60, 44, 30]);
    tx_register('ADOBE3', t, 4);
  }

  // --- Madera (pino oregón de Pisagua) ---
  tx_register('MADERA1', txg_planks(64, 128, 601, [148, 126, 100], { plank: 16 }), 5);
  tx_register('MADERA2', txg_planks(64, 128, 602, [150, 120, 90], { plank: 16, paint: [96, 140, 112], paintWear: 0.6 }), 5);
  tx_register('MADERA3', txg_planks(64, 128, 603, [150, 120, 90], { plank: 16, paint: [104, 132, 176], paintWear: 0.62 }), 5);
  tx_register('MADERA4', txg_planks(64, 128, 604, [150, 120, 90], { plank: 16, paint: [210, 170, 96], paintWear: 0.6 }), 5);
  tx_register('MADERA5', txg_planks(64, 128, 605, [150, 120, 90], { plank: 16, paint: [226, 220, 204], paintWear: 0.58 }), 5);
  {
    const t = txg_planks(64, 128, 611, [148, 126, 100], { plank: 16 });
    txg_addWindow(t, 18, 34, 28, 40, [226, 220, 204], true);
    tx_register('MADERAV', t, 5);
  }
  {
    const t = txg_planks(64, 128, 612, [150, 120, 90], { plank: 16, paint: [96, 140, 112], paintWear: 0.6 });
    txg_addWindow(t, 18, 34, 28, 40, [220, 214, 196], false);
    tx_register('MADERAV2', t, 5);
  }
  tx_register('MADVERT', txg_planks(64, 128, 620, [138, 100, 66], { plank: 8, vertical: true, nails: 0 }), 5);
  tx_register('MARCO1', txg_planks(64, 128, 630, [112, 78, 50], { plank: 16, vertical: true, nails: 0 }), 5);
  {
    // viga / poste (para muelles y estaciones)
    const t = txg_planks(64, 64, 640, [120, 88, 58], { plank: 32, vertical: true, nails: 0 });
    tx_register('VIGA1', t, 5);
  }

  // --- Piedra, ladrillo, fortificaciones ---
  tx_register('PIEDRA1', txg_blocks(64, 64, 701, 32, 16, [170, 160, 140], [84, 76, 66], { mortar: 1, bevel: true }), 5);
  tx_register('PIEDRA3', txg_blocks(64, 64, 703, 32, 21, [150, 132, 108], [72, 62, 50], { mortar: 1, bevel: true }), 5);
  tx_register('PIEDRA2', txf_voronoiStones(702, 16, [150, 138, 120], [46, 40, 34], 0.35), 5);
  tx_register('LADRIL1', txg_blocks(64, 64, 704, 16, 8, [156, 72, 50], [150, 136, 118], { mortar: 1, bevel: false }), 5);
  tx_register('SACOS1', txg_sacks(801, [196, 176, 128]), 5);
  tx_register('SACOS2', txg_sacks(802, [226, 222, 208]), 4);
  tx_register('SACOS3', txg_sacks(803, [82, 74, 68]), 4);
  {
    const t = txg_planks(64, 64, 810, [170, 132, 88], { plank: 16, nails: 16 });
    tx_rect(t, 0, 0, 64, 4, [110, 80, 50]); tx_rect(t, 0, 60, 64, 4, [110, 80, 50]);
    tx_rect(t, 0, 0, 4, 64, [110, 80, 50]); tx_rect(t, 60, 0, 4, 64, [110, 80, 50]);
    tx_line(t, 4, 60, 60, 4, [120, 88, 56]); tx_line(t, 5, 60, 60, 5, [120, 88, 56]); tx_line(t, 4, 59, 59, 4, [90, 64, 40]);
    tx_text(t, 14, 26, 'FCT', [60, 40, 26], 1);
    tx_register('CAJON1', t, 4);
  }

  // --- Metal ---
  tx_register('CALAMIN', txg_corrugated(901, 64, 128, [166, 170, 174]), 5);
  tx_register('CALAMIN2', txg_corrugated(902, 64, 128, [150, 132, 118]), 5);
  tx_register('HIERRO1', txg_iron(910, 64, 64, [88, 92, 98], 32), 5);
  tx_register('TANQUE1', txg_iron(911, 64, 128, [96, 88, 82], 32), 5);
  {
    // Casco de buque: negro, franja de portas y línea de flotación.
    const w = 128, h = 128;
    const t = tx_new(w, h);
    const n = tx_fbm(w, h, 920, 8, 8, 3, 0.5);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let c = tx_scale([40, 40, 44], 0.85 + n[i] * 0.3);
      if (y < 10) c = tx_scale([214, 204, 176], 0.9 + n[i] * 0.15);
      else if (y < 12) c = [24, 22, 20];
      if (y % 16 === 0 && y > 12) c = tx_scale(c, 1.3);
      if (y > 112) c = tx_scale([122, 44, 32], 0.85 + n[i] * 0.2);
      t.r[i] = c[0]; t.g[i] = c[1]; t.b[i] = c[2];
    }
    for (let k = 0; k < 4; k++) {
      tx_disc(t, 16 + k * 32, 30, 5, [168, 140, 70]);
      tx_disc(t, 16 + k * 32, 30, 3.5, [16, 20, 26]);
      tx_put(t, 15 + k * 32, 28, [120, 150, 180]);
    }
    for (let k = 0; k < 2; k++) {
      tx_rect(t, 20 + k * 64, 50, 24, 16, [20, 20, 22]);
      tx_rect(t, 22 + k * 64, 52, 20, 12, [8, 8, 10]);
    }
    tx_register('CASCO1', t, 4);
  }
  {
    // Vagón de carga del Ferrocarril de Tarapacá.
    const w = 128, h = 64;
    const t = txg_planks(w, h, 930, [150, 120, 90], { plank: 8, vertical: true, nails: 0, paint: [140, 62, 42], paintWear: 0.7 });
    tx_rect(t, 0, 0, w, 4, [48, 48, 52]); tx_rect(t, 0, h - 7, w, 7, [44, 44, 48]);
    for (const px of [0, 62, 124]) tx_rect(t, px, 0, 4, h, [50, 50, 54]);
    for (let p = 0; p < 2; p++) {
      const x0 = 4 + p * 62;
      tx_line(t, x0, 4, x0 + 57, h - 8, [54, 54, 58]); tx_line(t, x0 + 1, 4, x0 + 58, h - 8, [54, 54, 58]);
      tx_line(t, x0 + 57, 4, x0, h - 8, [54, 54, 58]); tx_line(t, x0 + 58, 4, x0 + 1, h - 8, [54, 54, 58]);
    }
    for (let x = 2; x < w; x += 8) { tx_put(t, x, 1, [120, 120, 124]); tx_put(t, x, h - 4, [120, 120, 124]); }
    tx_rect(t, 44, 18, 40, 14, tx_scale([140, 62, 42], 0.8));
    tx_text(t, 48, 22, 'F.C.T.', [236, 230, 210], 1, [40, 20, 16]);
    tx_register('VAGON1', t, 4);
  }

  // --- Lona ---
  {
    const t = tx_new(64, 64);
    const n = tx_fbm(64, 64, 940, 4, 4, 4, 0.5);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      const i = y * 64 + x;
      let c = tx_scale([224, 214, 184], (0.86 + n[i] * 0.2) * (((x ^ y) & 1) ? 1.02 : 0.98));
      if (x % 32 === 0) c = tx_scale(c, 0.72);
      if (x % 32 === 1 && y % 4 === 0) c = tx_scale(c, 0.8);
      t.r[i] = c[0]; t.g[i] = c[1]; t.b[i] = c[2];
    }
    tx_register('CARPA1', t, 4);
  }

  // --- Puertas ---
  function door(seed, keyColor, heavy) {
    const t = txg_planks(64, 128, seed, [150, 120, 90], { plank: 8, vertical: true, nails: 0, paint: heavy ? [110, 74, 44] : [122, 84, 52], paintWear: 0.75 });
    const brace = heavy ? [60, 58, 60] : [150, 110, 70];
    const braceY = heavy ? [20, 52, 84, 112] : [22, 100];
    for (const by of braceY) {
      tx_rect(t, 0, by, 64, 8, brace);
      tx_rect(t, 0, by, 64, 1, tx_scale(brace, 1.3));
      tx_rect(t, 0, by + 7, 64, 1, tx_scale(brace, 0.5));
      if (heavy) for (let x = 4; x < 64; x += 8) { tx_put(t, x, by + 3, [170, 166, 160]); tx_put(t, x + 1, by + 4, [30, 30, 30]); }
    }
    if (!heavy) {
      for (let s = 0; s < 70; s++) {
        const x = 4 + s * 56 / 70, y = 98 - s * 68 / 70;
        tx_rect(t, Math.floor(x), Math.floor(y), 4, 4, brace);
        tx_put(t, Math.floor(x) + 3, Math.floor(y) + 3, tx_scale(brace, 0.5));
      }
      for (const hy of [24, 102]) { tx_rect(t, 2, hy, 14, 4, [44, 40, 38]); tx_put(t, 4, hy + 1, [120, 116, 110]); }
    }
    tx_disc(t, 52, 64, 3.5, [40, 36, 34]);
    tx_disc(t, 52, 64, 2, tx_scale([150, 120, 90], 0.5));
    if (keyColor) {
      tx_rect(t, 0, 0, 4, 128, keyColor); tx_rect(t, 60, 0, 4, 128, keyColor);
      for (let y = 0; y < 12; y++) {
        const hw = 12 - Math.abs(y - 6) * 2;
        tx_rect(t, 32 - hw, 58 + y, hw * 2, 1, keyColor);
      }
    }
    return t;
  }
  tx_register('PUERTA1', door(1001, null, false), 4);
  tx_register('PUERTA2', door(1002, null, true), 4);
  tx_register('PUERTAB', door(1003, [40, 76, 200], true), 4);
  tx_register('PUERTAY', door(1004, [236, 196, 40], true), 4);
  tx_register('PUERTAR', door(1005, [196, 30, 30], true), 4);
  {
    const make = function (name, col) {
      const t = txg_planks(64, 128, 1010, [112, 78, 50], { plank: 16, vertical: true, nails: 0 });
      tx_rect(t, 24, 0, 16, 128, col);
      tx_rect(t, 24, 0, 2, 128, tx_scale(col, 1.3));
      tx_register(name, t, 4);
    };
    make('MARCOB', [40, 76, 200]);
    make('MARCOY', [236, 196, 40]);
    make('MARCOR', [196, 30, 30]);
  }

  // --- Interruptores ---
  function lever(on) {
    const t = txg_planks(64, 128, 1100, [140, 104, 70], { plank: 16, nails: 0 });
    tx_rect(t, 16, 40, 32, 44, [60, 58, 60]);
    tx_rect(t, 17, 41, 30, 42, [92, 94, 100]);
    tx_rect(t, 17, 41, 30, 2, [140, 144, 150]);
    tx_disc(t, 32, 62, 4, [40, 40, 42]);
    const ang = on ? Math.PI * 0.75 : -Math.PI * 0.75;
    const ex = 32 + Math.sin(ang) * 26, ey = 62 - Math.cos(ang) * 26;
    for (let w = -1; w <= 1; w++) tx_line(t, 32 + w, 62, ex + w, ey, [48, 46, 46]);
    tx_disc(t, ex, ey, 3.5, on ? [200, 40, 30] : [60, 150, 60]);
    return t;
  }
  tx_register('PALANC0', lever(false), 3);
  tx_register('PALANC1', lever(true), 3);
  function flagSwitch(on) {
    const t = txg_blocks(64, 64, 1110, 32, 16, [176, 166, 146], [86, 78, 66], { mortar: 1, bevel: true });
    tx_rect(t, 12, 10, 40, 22, [140, 110, 50]);
    tx_rect(t, 13, 11, 38, 20, [196, 160, 70]);
    tx_text(t, 16, 13, 'IZAR', [70, 50, 20], 1);
    tx_text(t, 16, 22, 'BANDERA', [70, 50, 20], 1);
    tx_rect(t, 28, 38, 8, 18, [70, 66, 62]);
    tx_rect(t, 24, 44, 16, 3, [90, 86, 80]);
    if (on) {
      tx_line(t, 32, 0, 30, 44, [230, 220, 190]);
      tx_line(t, 33, 0, 31, 44, [180, 170, 140]);
      tx_rect(t, 27, 44, 10, 3, [220, 210, 180]);
    } else {
      tx_line(t, 32, 0, 33, 60, [230, 220, 190]);
      tx_line(t, 33, 0, 34, 60, [180, 170, 140]);
    }
    return t;
  }
  tx_register('IZAR0', flagSwitch(false), 3);
  tx_register('IZAR1', flagSwitch(true), 3);

  // --- Letreros ---
  const BOARD = [176, 140, 96], INK = [40, 30, 22], WHITE_BOARD = [220, 214, 196];
  txg_sign('CARTADU', 'ADUANA', 128, 32, WHITE_BOARD, [30, 40, 90], 2);
  txg_sign('CARTEST', 'ESTACIÓN', 128, 32, BOARD, INK, 2);
  txg_sign('CARTPIS', 'PISAGUA', 128, 32, WHITE_BOARD, INK, 2);
  txg_sign('CARTHOS', 'HOSPICIO', 128, 32, BOARD, INK, 2);
  txg_sign('CARTDOL', 'DOLORES', 128, 32, BOARD, INK, 2);
  txg_sign('CARTPOZ', 'POZOS', 64, 32, BOARD, INK, 2);
  txg_sign('CARTPOL', 'POLVORÍN', 128, 32, [120, 40, 32], [236, 226, 200], 2);
  txg_sign('CARTCIU', 'CIUDADELA', 128, 32, [150, 146, 136], INK, 2);
  txg_sign('CARTEST2', 'FUERTE ESTE', 128, 32, [150, 146, 136], INK, 1);
  txg_sign('CARTMOR', 'EL MORRO', 128, 32, [150, 146, 136], INK, 2);
  txg_sign('CARTSAL', 'SALITRE', 128, 32, WHITE_BOARD, [120, 30, 26], 2);
  txg_sign('CARTAGU', 'AGUA', 64, 32, BOARD, [30, 60, 120], 2);
  txg_sign('CARTBAT', 'BATERÍA', 128, 32, [150, 146, 136], INK, 2);
  txg_sign('CARTTAC', 'TACNA', 128, 32, BOARD, INK, 2);
  txg_sign('CARTCHO', 'CHORRILLOS', 128, 32, WHITE_BOARD, INK, 2);
  txg_sign('CARTSJU', 'SAN JUAN', 128, 32, BOARD, INK, 2);
  txg_sign('CARTMIR', 'MIRAFLORES', 128, 32, WHITE_BOARD, INK, 2);
  txg_sign('CARTPAL', 'LA PALMA', 128, 32, BOARD, INK, 2);
  txg_sign('CARTRED', 'REDUCTO', 128, 32, [150, 146, 136], INK, 2);

  // --- Fuego (casas incendiadas de Pisagua), animado ---
  for (let f = 0; f < 3; f++) {
    const w = 64, h = 128;
    const t = txg_planks(w, h, 1200, [70, 54, 42], { plank: 16 });
    const n = tx_fbm(w, h, 1201, 4, 4, 4, 0.55);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const k = tx_vnoise(1202, x / w * 6, (y / h * 6 + f * 2) , 6, 6) * 0.6 + n[tx_idx(t, x, y + f * 21)] * 0.4;
      const heat = k * 1.35 + (y / h) * 0.9 - 0.75;
      let c = tx_scale([t.r[i], t.g[i], t.b[i]], 0.55);
      if (heat > 0.18) {
        const q = clamp((heat - 0.18) * 2.2, 0, 1);
        const fire = q < 0.4 ? tx_mix([90, 10, 0], [230, 80, 10], q / 0.4) : q < 0.8 ? tx_mix([230, 80, 10], [255, 200, 60], (q - 0.4) / 0.4) : tx_mix([255, 200, 60], [255, 250, 210], (q - 0.8) / 0.2);
        c = fire;
      }
      t.r[i] = c[0]; t.g[i] = c[1]; t.b[i] = c[2];
    }
    tx_register('FUEGO' + (f + 1), t, 3);
  }

  // --- Bandera de Chile flameando (animada) ---
  for (let f = 0; f < 3; f++) {
    const w = 64, h = 48;
    const t = tx_new(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const wave = Math.sin(x / w * Math.PI * 3 + f * Math.PI * 2 / 3);
      const yy = y - wave * 2 * (x / w);
      let c;
      if (yy < h / 2) c = (x < h / 2) ? [0, 57, 166] : [240, 240, 240];
      else c = [213, 43, 30];
      // estrella blanca en el cantón azul
      const sx = h / 4, sy = h / 4;
      const dx = x - sx, dy = yy - sy;
      const r = Math.hypot(dx, dy);
      const a = Math.atan2(dy, dx) + Math.PI / 2;
      const star = 5.2 * (0.55 + 0.45 * Math.cos(5 * a)) ;
      if (yy < h / 2 && x < h / 2 && r < star * 0.9 + 1.4) c = [245, 245, 245];
      c = tx_scale(c, 0.86 + wave * 0.14);
      tx_put(t, x, y, c);
    }
    tx_register('BANDER' + (f + 1), t, 2);
  }

  // --- Texturas enmascaradas ---
  {
    const t = tx_new(64, 64), a = new Float32Array(64 * 64);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      const i = y * 64 + x;
      const bx = x % 8;
      const bar = bx >= 2 && bx <= 4;
      const rail = y < 4 || y > 59 || (y >= 30 && y <= 33);
      if (bar || rail) {
        a[i] = 1;
        const c = bar && !rail ? (bx === 2 ? [120, 120, 126] : bx === 3 ? [80, 80, 86] : [40, 40, 44]) : (y % 4 === 0 ? [110, 110, 116] : [58, 58, 64]);
        t.r[i] = c[0]; t.g[i] = c[1]; t.b[i] = c[2];
      }
    }
    tx_registerMasked('REJA1', t, a, 2);
  }
  {
    const t = tx_new(64, 64), a = new Float32Array(64 * 64);
    const n = tx_fbm(64, 64, 1300, 4, 8, 3, 0.5);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      const i = y * 64 + x;
      const top = y < 7;
      const mid = y >= 28 && y <= 32;
      const post = (x % 32) < 5;
      const bal = (x % 8) >= 3 && (x % 8) <= 4 && y > 6;
      if (top || mid || post || bal) {
        a[i] = 1;
        let c = tx_scale([146, 110, 74], 0.85 + n[i] * 0.3);
        if (top && y === 0) c = tx_scale(c, 1.2);
        if (top && y === 6) c = tx_scale(c, 0.6);
        if (post && (x % 32) === 4) c = tx_scale(c, 0.6);
        t.r[i] = c[0]; t.g[i] = c[1]; t.b[i] = c[2];
      }
    }
    tx_registerMasked('BARAND1', t, a, 3);
  }

  // Cielos (sky.js) — se registran también como texturas.
  SKY_BuildSkies();

  W_AddMarker('T_END');
}

function TX_BuildFlats() {
  W_AddMarker('F_START');
  tx_registerFlat('F_SKY1', txf_sand(1, [120, 160, 220], {}), 0);
  {
    const t = tx_new(64, 64);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) tx_put(t, x, y, ((x >> 3) ^ (y >> 3)) & 1 ? [255, 0, 255] : [20, 20, 20]);
    tx_registerFlat('ERRORF', t, 0);
  }
  // Arenas y suelos del desierto
  tx_registerFlat('ARENA1', txf_sand(2001, [214, 188, 138], { ripple: 0.04 }), 5);
  tx_registerFlat('ARENA2', txf_sand(2002, [206, 180, 132], { pebbles: 0.03, pebbleColor: [126, 112, 98], shells: 0.004 }), 5);
  tx_registerFlat('ARENA3', txf_sand(2003, [164, 140, 104], { ripple: 0.03, shells: 0.006 }), 5);
  tx_registerFlat('ARENA4', txf_sand(2004, [196, 168, 124], { pebbles: 0.06, pebbleColor: [90, 80, 72] }), 5);
  tx_registerFlat('TIERRA1', txf_sand(2010, [146, 114, 82], { pebbles: 0.05, pebbleColor: [100, 92, 84] }), 5);
  {
    // Tierra removida: indicio de un "polvorazo" (mina de Elmore).
    const t = txf_sand(2011, [120, 94, 70], { pebbles: 0.07, pebbleColor: [80, 72, 66] });
    const n = tx_fbm(64, 64, 2012, 8, 8, 3, 0.5);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      const r = Math.hypot(x - 31.5, y - 31.5) / 26;
      const c = tx_get(t, x, y);
      let f = r < 1 ? 0.84 + (1 - r) * 0.2 * (n[y * 64 + x]) : 1;
      if (r > 0.92 && r < 1.08) f *= 0.8;
      tx_put(t, x, y, tx_scale(c, f));
    }
    tx_registerFlat('TIERRA2', t, 5);
  }
  {
    // Costra de caliche de la pampa del Tamarugal (grietas poligonales).
    const t = tx_new(64, 64);
    const v = tx_voronoi(64, 64, 2020, 10);
    const n = tx_fbm(64, 64, 2021, 8, 8, 3, 0.5);
    for (let i = 0; i < 64 * 64; i++) {
      const e = v.d2[i] - v.d1[i];
      let c = tx_scale([214, 206, 186], 0.86 + n[i] * 0.2 + tx_hash(2022, v.id[i], 0) * 0.06);
      if (e < 1.2) c = tx_scale(c, 0.62);
      else if (e < 2.2) c = tx_scale(c, 0.88);
      t.r[i] = c[0]; t.g[i] = c[1]; t.b[i] = c[2];
    }
    tx_registerFlat('CALICHE1', t, 4);
  }
  {
    const t = txf_sand(2030, [196, 170, 124], { pebbles: 0.02, pebbleColor: [120, 110, 90] });
    const n = tx_fbm(64, 64, 2031, 4, 4, 3, 0.5);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      if (n[y * 64 + x] > 0.64 && tx_hash(2032, x, y) < 0.35) tx_put(t, x, y, [120, 118, 70]);
    }
    tx_registerFlat('PAMPA1', t, 5);
  }
  // Valle de Lima: chacras sembradas (surcos norte-sur) y pastizal de los potreros.
  {
    const t = txf_sand(2033, [122, 96, 66], { pebbles: 0.03, pebbleColor: [92, 76, 58] });
    const n = tx_fbm(64, 64, 2034, 8, 8, 3, 0.5);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      const row = x % 8;
      const i = y * 64 + x;
      if (row >= 2 && row <= 5 && n[i] > 0.28) {
        const leaf = tx_hash(2035, x, y);
        tx_put(t, x, y, tx_scale(leaf < 0.5 ? [112, 138, 58] : [146, 164, 76], 0.8 + n[i] * 0.35));
      } else if (row === 7) tx_put(t, x, y, tx_scale(tx_get(t, x, y), 0.78));
    }
    tx_registerFlat('CHACRA1', t, 4);
  }
  {
    const t = txf_sand(2036, [150, 146, 84], { pebbles: 0.02, pebbleColor: [110, 100, 70] });
    const n = tx_fbm(64, 64, 2037, 6, 6, 3, 0.5);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      const h = tx_hash(2038, x, y);
      const i = y * 64 + x;
      if (h < 0.22) tx_put(t, x, y, tx_scale(n[i] > 0.5 ? [182, 176, 98] : [104, 124, 56], 0.85 + h));
      else if (n[i] < 0.3) tx_put(t, x, y, tx_mix(tx_get(t, x, y), [122, 134, 64], 0.5));
    }
    tx_registerFlat('PASTO1', t, 4);
  }
  tx_registerFlat('ROCAF1', txf_voronoiStones(2040, 12, [150, 138, 122], [70, 62, 54], 0.3), 5);
  tx_registerFlat('ROCAF2', txf_voronoiStones(2041, 10, [150, 112, 84], [64, 46, 34], 0.3), 5);
  // Pisos construidos
  {
    const t = txg_planks(64, 64, 2050, [158, 120, 80], { plank: 8, vertical: true, nails: 32 });
    tx_registerFlat('PISO1', t, 5);
  }
  {
    const t = tx_new(64, 64);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      const cell = ((x >> 4) + (y >> 4)) & 1;
      let c = cell ? [176, 88, 60] : [220, 206, 176];
      c = tx_scale(c, 0.9 + tx_hash(2060, x >> 4, y >> 4) * 0.12 + (tx_hash(2061, x, y) - 0.5) * 0.06);
      if ((x & 15) === 0 || (y & 15) === 0) c = [90, 80, 70];
      tx_put(t, x, y, c);
    }
    tx_registerFlat('PISO2', t, 4);
  }
  {
    const t = txg_blocks(64, 64, 2070, 32, 32, [168, 160, 142], [96, 88, 76], { mortar: 1, bevel: true });
    tx_registerFlat('LOSA1', t, 5);
  }
  tx_registerFlat('LOSA2', txf_sand(2080, [168, 146, 112], { pebbles: 0.08, pebbleColor: [130, 120, 108] }), 5);
  {
    // Rieles con durmientes sobre balasto: norte-sur y este-oeste.
    const make = function (ns) {
      const t = txf_sand(2090, [120, 112, 104], { pebbles: 0.25, pebbleColor: [86, 80, 76] });
      for (let a = 0; a < 64; a++) for (let b = 0; b < 64; b++) {
        const along = ns ? a : b, across = ns ? b : a;
        const x = ns ? b : a, y = ns ? a : b;
        if ((along % 16) >= 2 && (along % 16) <= 7 && across >= 4 && across <= 59) tx_put(t, x, y, tx_scale([110, 80, 54], 0.85 + tx_hash(2091, x, y) * 0.2));
        if (across === 17 || across === 45) tx_put(t, x, y, [196, 198, 204]);
        if (across === 16 || across === 18 || across === 44 || across === 46) tx_put(t, x, y, [72, 70, 72]);
      }
      return t;
    };
    tx_registerFlat('RIELNS', make(true), 4);
    tx_registerFlat('RIELEW', make(false), 4);
  }
  // Agua del Pacífico, animada
  for (let f = 0; f < 4; f++) {
    const t = tx_new(64, 64);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      const a = f / 4 * Math.PI * 2;
      const w1 = Math.sin((x + y) / 64 * Math.PI * 4 + a);
      const w2 = Math.sin((x - y * 2) / 64 * Math.PI * 2 - a * 1);
      const w3 = tx_vnoise(2100, x / 64 * 4 + f, y / 64 * 4, 4, 4);
      const v = w1 * 0.4 + w2 * 0.35 + (w3 - 0.5) * 0.8;
      let c = tx_mix([22, 70, 96], [70, 132, 150], clamp(0.45 + v * 0.35, 0, 1));
      if (v > 0.78) c = [196, 222, 224];
      tx_put(t, x, y, c);
    }
    tx_registerFlat('AGUA' + (f + 1), t, 4);
  }
  // Brasas (ruinas humeantes), animadas y dañinas
  for (let f = 0; f < 3; f++) {
    const t = tx_new(64, 64);
    const n = tx_fbm(64, 64, 2200, 8, 8, 3, 0.5);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      const i = y * 64 + x;
      const flick = tx_vnoise(2201 + f * 17, x / 8, y / 8, 8, 8);
      const heat = n[i] * 0.7 + flick * 0.5 - 0.5;
      let c = tx_scale([54, 48, 44], 0.8 + n[i] * 0.4);
      if (heat > 0.1) c = tx_mix([120, 20, 0], [255, 160, 30], clamp((heat - 0.1) * 3, 0, 1));
      tx_put(t, x, y, c);
    }
    tx_registerFlat('BRASA' + (f + 1), t, 3);
  }
  // Techos
  {
    const t = txg_planks(64, 64, 2300, [132, 98, 64], { plank: 16, nails: 0 });
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) if ((x % 32) < 6) tx_put(t, x, y, tx_scale([100, 70, 44], (x % 32) === 0 ? 0.6 : 1));
    tx_registerFlat('TECHO1', t, 5);
  }
  tx_registerFlat('TECHO2', txf_sand(2310, [216, 208, 190], {}), 3);
  {
    const t = tx_new(64, 64);
    const n = tx_fbm(64, 64, 2320, 4, 4, 3, 0.5);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      let c = tx_scale([214, 204, 176], 0.84 + n[y * 64 + x] * 0.24);
      if (y % 32 === 0) c = tx_scale(c, 0.7);
      tx_put(t, x, y, c);
    }
    tx_registerFlat('LONA1', t, 4);
  }
  {
    const t = tx_new(64, 64);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) tx_put(t, x, y, tx_scale([150, 152, 156], 0.86 + Math.sin(x / 8 * Math.PI * 2) * 0.16));
    tx_registerFlat('CALAMF', t, 4);
  }
  {
    const t = txg_sacks(2330, [196, 176, 128]);
    tx_registerFlat('SACOSF', t, 5);
  }
  tx_registerFlat('HIERROF', txg_iron(2340, 64, 64, [96, 100, 106], 32), 5);
  tx_registerFlat('CUBIERT', txg_planks(64, 64, 2350, [186, 158, 118], { plank: 8, nails: 0 }), 5);
  tx_registerFlat('CARPAF', txf_sand(2360, [224, 214, 184], {}), 3);
  W_AddMarker('F_END');
}
