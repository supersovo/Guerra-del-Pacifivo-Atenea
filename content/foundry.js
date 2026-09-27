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
  return scene.map(function (p) { return Object.assign({}, p, { c: vscale(p.c, k), r: vscale(p.r, k) }); });
}

// --- Intersección rayo/primitiva en espacio local ----------------------------------------------------------
// o, d: origen y dirección del rayo en espacio local. Devuelve t o -1.
function PR_hitLocal(p, o, d, out) {
  const r = p.r;
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
  if (p.t === 1) return Math.sqrt(p.r[0] * p.r[0] + p.r[1] * p.r[1] + p.r[2] * p.r[2]);
  if (p.t === 2) return Math.sqrt(Math.max(p.r[0], p.r[1]) ** 2 + p.r[2] * p.r[2]);
  return Math.max(p.r[0], p.r[1], p.r[2]);
}

// --- Sombreado ------------------------------------------------------------------------------------------------
const FND_LIGHT = vnorm([-0.5, 0.6, -0.62]);   // desde arriba a la izquierda, hacia la cámara
const FND_HALF = vnorm(vadd(FND_LIGHT, [0, 0, -1]));

function FND_Shade(mat, n, lp) {
  if (mat.glow) {
    let tone = mat.tone;
    if (mat.pattern) tone += mat.pattern(lp, n);
    return C(mat.ramp, clamp(Math.round(tone), 0, 15));
  }
  const diff = Math.max(0, vdot(n, FND_LIGHT));
  const I = 0.36 + 0.64 * diff;
  let shade = mat.tone + (1 - I) * mat.k;
  if (mat.spec) {
    const s = Math.pow(Math.max(0, vdot(n, FND_HALF)), 18);
    shade -= s * mat.spec * 5;
  }
  if (mat.pattern) shade += mat.pattern(lp, n);
  return C(mat.ramp, clamp(Math.round(shade), 0, 15));
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

// Renderiza una escena a una imagen indexada. Devuelve { w, h, px, left, top }.
function FND_Render(scene, opts) {
  const yaw = opts.yaw || 0, elev = opts.elev === undefined ? 0.17 : opts.elev;
  const VM = FND_ViewMatrix(yaw, elev);
  // Preparar primitivas en espacio de vista con su rectángulo proyectado.
  const prims = [];
  let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
  for (const p of scene) {
    const c = M3_mulv(VM, p.c);
    const R = M3_mul(VM, p.R);
    let bx0 = Infinity, bx1 = -Infinity, by0 = Infinity, by1 = -Infinity;
    for (const q of PR_Corners(R, c, p.r)) {
      if (q[0] < bx0) bx0 = q[0]; if (q[0] > bx1) bx1 = q[0];
      if (q[1] < by0) by0 = q[1]; if (q[1] > by1) by1 = q[1];
    }
    prims.push({ p: p, c: c, R: R, Rt: M3_T(R), bx0: bx0, bx1: bx1, by0: by0, by1: by1 });
    minx = Math.min(minx, bx0); maxx = Math.max(maxx, bx1);
    miny = Math.min(miny, by0); maxy = Math.max(maxy, by1);
  }
  if (!prims.length) return { w: 1, h: 1, px: new Int16Array([-1]), left: 0, top: 0 };
  const x0 = Math.floor(minx) - 2, x1 = Math.ceil(maxx) + 2;
  const y0 = Math.floor(miny) - 2, y1 = Math.ceil(maxy) + 2;
  const w = x1 - x0, h = y1 - y0;
  const zbuf = new Float32Array(w * h).fill(Infinity);
  const px = new Int16Array(w * h).fill(-1);
  const out = [0, 0, 0, 0, 0, 0];
  const lo = [0, 0, 0], ld = [0, 0, 0];
  for (const q of prims) {
    const Rt = q.Rt;
    // dirección del rayo (0,0,1) en espacio local = tercera columna de Rt
    ld[0] = Rt[2][0]; ld[1] = Rt[2][1]; ld[2] = Rt[2][2];
    const ix0 = Math.max(0, Math.floor(q.bx0 - x0)), ix1 = Math.min(w - 1, Math.ceil(q.bx1 - x0));
    const iy0 = Math.max(0, Math.floor(y1 - q.by1)), iy1 = Math.min(h - 1, Math.ceil(y1 - q.by0));
    const oz = -1000 - q.c[2];
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
        if (depth >= zbuf[i]) continue;
        zbuf[i] = depth;
        const n = vnorm(M3_mulv(q.R, [out[0], out[1], out[2]]));
        px[i] = FND_Shade(q.p.mat, n, [out[3], out[4], out[5]]);
      }
    }
  }
  if (opts.outline !== false) FND_Outline(px, zbuf, w, h);
  return FND_Crop({ w: w, h: h, px: px, left: -x0, top: y1 });
}

// Perspectiva (armas en primera persona): el ojo está en el origen mirando +x.
// La pantalla lógica es de 320x200 con proyección 160 (como DOOM).
function FND_RenderPersp(scene, opts) {
  const W = 320, H = 200, proj = 160, NEAR = 0.5;
  const zbuf = new Float32Array(W * H).fill(Infinity);
  const px = new Int16Array(W * H).fill(-1);
  const out = [0, 0, 0, 0, 0, 0];
  const lo = [0, 0, 0], ld = [0, 0, 0];
  for (const p of scene) {
    // Rectángulo de pantalla: proyección de la caja local recortada al plano cercano.
    const cs = PR_Corners(p.R, p.c, p.r);
    const pts = [];
    for (const q of cs) if (q[0] >= NEAR) pts.push(q);
    for (const e of PR_EDGES) {
      const a = cs[e[0]], b = cs[e[1]];
      if ((a[0] < NEAR) !== (b[0] < NEAR)) {
        const t = (NEAR - a[0]) / (b[0] - a[0]);
        pts.push(vlerp(a, b, t));
      }
    }
    if (!pts.length) continue;
    let sx0 = Infinity, sx1 = -Infinity, sy0 = Infinity, sy1 = -Infinity;
    for (const q of pts) {
      const sx = 160 - q[1] / q[0] * proj, sy = 100 - q[2] / q[0] * proj;
      if (sx < sx0) sx0 = sx; if (sx > sx1) sx1 = sx;
      if (sy < sy0) sy0 = sy; if (sy > sy1) sy1 = sy;
    }
    const ix0 = Math.max(0, Math.floor(sx0) - 1), ix1 = Math.min(W - 1, Math.ceil(sx1) + 1);
    const iy0 = Math.max(0, Math.floor(sy0) - 1), iy1 = Math.min(H - 1, Math.ceil(sy1) + 1);
    if (ix0 > ix1 || iy0 > iy1) continue;
    const Rt = M3_T(p.R);
    const oc = M3_mulv(Rt, vsub([0, 0, 0], p.c));
    lo[0] = oc[0]; lo[1] = oc[1]; lo[2] = oc[2];
    for (let iy = iy0; iy <= iy1; iy++) {
      const dz = (100 - (iy + 0.5)) / proj;
      for (let ix = ix0; ix <= ix1; ix++) {
        const dy = (160 - (ix + 0.5)) / proj;
        ld[0] = Rt[0][0] + Rt[1][0] * dy + Rt[2][0] * dz;
        ld[1] = Rt[0][1] + Rt[1][1] * dy + Rt[2][1] * dz;
        ld[2] = Rt[0][2] + Rt[1][2] * dy + Rt[2][2] * dz;
        lo[0] = oc[0]; lo[1] = oc[1]; lo[2] = oc[2];
        const t = PR_hitLocal(p, lo, ld, out);
        if (t < 0) continue;
        const i = iy * W + ix;
        if (t >= zbuf[i]) continue;
        zbuf[i] = t;
        let n = vnorm(M3_mulv(p.R, [out[0], out[1], out[2]]));
        // pasar la normal a un espacio de vista aproximado (derecha, arriba, profundidad)
        n = [-n[1], n[2], n[0]];
        px[i] = FND_Shade(p.mat, n, [out[3], out[4], out[5]]);
      }
    }
  }
  if (!opts || opts.outline !== false) FND_Outline(px, zbuf, W, H, 0.6);
  const img = FND_Crop({ w: W, h: H, px: px, left: 0, top: 0 });
  // coordenadas de pantalla de la esquina superior izquierda del recorte
  img.screenX = img.cropX;
  img.screenY = img.cropY;
  return img;
}

// Contorno: oscurece los bordes de la silueta y los saltos de profundidad.
function FND_Outline(px, zbuf, w, h, depthThresh) {
  const src = new Int16Array(px);
  const th = depthThresh ? 6 * depthThresh : 7;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const c = src[i];
      if (c < 0) continue;
      let edge = false, inner = false;
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (const d of nb) {
        const xx = x + d[0], yy = y + d[1];
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) { edge = true; continue; }
        const j = yy * w + xx;
        if (src[j] < 0) edge = true;
        else if (zbuf[i] - zbuf[j] > th) inner = true;
      }
      if (edge || inner) {
        const ramp = c === 0 ? 0 : Math.floor(c / 16);
        const shade = ramp === 0 ? 15 - (c % 16) : c % 16;
        px[i] = C(ramp, Math.min(15, shade + (edge ? 3 : 2)));
      }
    }
  }
}

// Recorta la imagen a su contenido y ajusta los desplazamientos.
function FND_Crop(img) {
  const w = img.w, h = img.h, px = img.px;
  let x0 = w, x1 = -1, y0 = h, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (px[y * w + x] >= 0) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) return { w: 1, h: 1, px: new Int16Array([-1]), left: 0, top: 0, cropX: 0, cropY: 0 };
  const nw = x1 - x0 + 1, nh = y1 - y0 + 1;
  const npx = new Int16Array(nw * nh);
  for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) npx[y * nw + x] = px[(y + y0) * w + x + x0];
  return { w: nw, h: nh, px: npx, left: img.left - x0, top: img.top - y0, cropX: x0, cropY: y0 };
}

function FND_ToPatch(img) {
  return V_MakePatch(img.w, img.h, img.px, img.left, img.top);
}
