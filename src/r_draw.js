// =============================================================================
// r_draw.js — Rutinas de dibujo de bajo nivel (r_draw.c)
// -----------------------------------------------------------------------------
// R_DrawColumn dibuja una columna vertical de textura (muros, sprites) y
// R_DrawSpan un tramo horizontal de un "flat" (pisos y techos). Son los bucles
// más calientes del motor, igual que en DOOM. Toda la iluminación se aplica a
// través de COLORMAP: dc_colormap es un desplazamiento (nivel*256) en la tabla.
// =============================================================================
'use strict';

// Tablas de direcciones del framebuffer (ylookup / columnofs de DOOM).
let ylookup = new Int32Array(1);
let columnofs = new Int32Array(1);
let colormaps = null;         // COLORMAP completo (34*256)

// Parámetros de columna.
let dc_colormap = 0;
let dc_x = 0, dc_yl = 0, dc_yh = 0;
let dc_iscale = 1;
let dc_texturemid = 0;
let dc_source = null;
let dc_texheight = 128;
let dc_translation = null;

// Parámetros de span.
let ds_y = 0, ds_x1 = 0, ds_x2 = 0;
let ds_colormap = 0;
let ds_xfrac = 0, ds_yfrac = 0, ds_xstep = 0, ds_ystep = 0;
let ds_source = null;

function R_InitBuffer(width, height, viewwindowx, viewwindowy) {
  columnofs = new Int32Array(width);
  for (let i = 0; i < width; i++) columnofs[i] = viewwindowx + i;
  ylookup = new Int32Array(height);
  for (let i = 0; i < height; i++) ylookup[i] = (viewwindowy + i) * SCREENWIDTH;
}

// Columna opaca con repetición vertical de la textura.
function R_DrawColumn() {
  let count = dc_yh - dc_yl;
  if (count < 0) return;
  const fb = screens[0];
  const W = SCREENWIDTH;
  let dest = ylookup[dc_yl] + columnofs[dc_x];
  const step = dc_iscale;
  let frac = dc_texturemid + (dc_yl - centery) * step;
  const src = dc_source;
  const cm = colormaps;
  const cmb = dc_colormap;
  const h = dc_texheight;
  if (frac < 0) frac += (Math.floor(-frac / h) + 1) * h;
  if ((h & (h - 1)) === 0) {
    const mask = h - 1;
    do {
      fb[dest] = cm[cmb + src[(frac | 0) & mask]];
      dest += W;
      frac += step;
    } while (count--);
  } else {
    do {
      let t = frac | 0;
      if (t >= h) { frac -= h * Math.floor(t / h); t = frac | 0; }
      fb[dest] = cm[cmb + src[t]];
      dest += W;
      frac += step;
    } while (count--);
  }
}

// Columna sin repetición (postes de sprites y texturas enmascaradas).
function R_DrawColumnClamped() {
  let count = dc_yh - dc_yl;
  if (count < 0) return;
  const fb = screens[0];
  const W = SCREENWIDTH;
  let dest = ylookup[dc_yl] + columnofs[dc_x];
  const step = dc_iscale;
  let frac = dc_texturemid + (dc_yl - centery) * step;
  const src = dc_source;
  const cm = colormaps;
  const cmb = dc_colormap;
  const last = src.length - 1;
  const tr = dc_translation;
  if (tr) {
    do {
      let t = frac | 0;
      if (t < 0) t = 0; else if (t > last) t = last;
      fb[dest] = cm[cmb + tr[src[t]]];
      dest += W;
      frac += step;
    } while (count--);
  } else {
    do {
      let t = frac | 0;
      if (t < 0) t = 0; else if (t > last) t = last;
      fb[dest] = cm[cmb + src[t]];
      dest += W;
      frac += step;
    } while (count--);
  }
}

// Tramo horizontal de flat 64x64, en punto fijo 16.16 como DOOM.
function R_DrawSpan() {
  const fb = screens[0];
  let dest = ylookup[ds_y] + columnofs[ds_x1];
  let count = ds_x2 - ds_x1;
  if (count < 0) return;
  const src = ds_source;
  const cm = colormaps;
  const cmb = ds_colormap;
  let xf = (((ds_xfrac % 64) + 64) % 64 * 65536) | 0;
  let yf = (((ds_yfrac % 64) + 64) % 64 * 65536) | 0;
  const xs = (ds_xstep * 65536) | 0;
  const ys = (ds_ystep * 65536) | 0;
  do {
    const spot = ((yf >>> 10) & 4032) | ((xf >>> 16) & 63);
    fb[dest++] = cm[cmb + src[spot]];
    xf = (xf + xs) | 0;
    yf = (yf + ys) | 0;
  } while (count--);
}

// Dibuja un poste enmascarado (sprites, texturas con transparencia).
// mfloorclip / mceilingclip son arrays de recorte por columna con su desplazamiento.
let mfloorclip = null, mceilingclip = null, mfloorofs = 0, mceilingofs = 0;
let spryscale = 1, sprtopscreen = 0;

function R_DrawMaskedColumn(posts) {
  const basetexturemid = dc_texturemid;
  const fclip = mfloorclip[dc_x + mfloorofs];
  const cclip = mceilingclip[dc_x + mceilingofs];
  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    const topscreen = sprtopscreen + spryscale * post.top;
    const bottomscreen = topscreen + spryscale * post.len;
    dc_yl = Math.ceil(topscreen);
    dc_yh = Math.ceil(bottomscreen) - 1;
    if (dc_yh >= fclip) dc_yh = fclip - 1;
    if (dc_yl <= cclip) dc_yl = cclip + 1;
    if (dc_yl <= dc_yh) {
      dc_source = post.pixels;
      dc_texturemid = basetexturemid - post.top;
      R_DrawColumnClamped();
    }
  }
  dc_texturemid = basetexturemid;
}
