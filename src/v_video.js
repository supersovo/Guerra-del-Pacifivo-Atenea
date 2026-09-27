// =============================================================================
// v_video.js — Framebuffer de 8 bits y primitivas 2D (v_video.c)
// -----------------------------------------------------------------------------
// screens[0] es el framebuffer indexado (un byte por píxel, como DOOM). Las
// funciones V_* dibujan "patches" (imágenes en formato de columnas con postes
// transparentes) en coordenadas lógicas de 320x200 escaladas por SCALE y
// centradas horizontalmente con UIOFS (para pantallas panorámicas).
// =============================================================================
'use strict';

const screens = [null, null, null, null];   // 0 = visible, 1/2 = wipe, 3 = fondo barra de estado
let V_BaseWidth = 320;                       // ancho lógico actual (320..560)

function V_Init() {
  const n = SCREENWIDTH * SCREENHEIGHT;
  for (let i = 0; i < screens.length; i++) screens[i] = new Uint8Array(n);
}

// --- Construcción de patches -------------------------------------------------------
// Convierte una imagen indexada (Int16Array/Array, -1 = transparente) en un patch.
function V_MakePatch(width, height, pixels, leftoffset, topoffset) {
  const columns = new Array(width);
  for (let x = 0; x < width; x++) {
    const posts = [];
    let y = 0;
    while (y < height) {
      while (y < height && pixels[y * width + x] < 0) y++;
      if (y >= height) break;
      const start = y;
      while (y < height && pixels[y * width + x] >= 0) y++;
      const data = new Uint8Array(y - start);
      for (let k = start; k < y; k++) data[k - start] = pixels[k * width + x];
      posts.push({ top: start, len: y - start, pixels: data });
    }
    columns[x] = posts;
  }
  return {
    width: width, height: height,
    leftoffset: leftoffset || 0, topoffset: topoffset || 0,
    columns: columns
  };
}

// Imagen sólida (sin transparencia) a patch.
function V_MakeSolidPatch(width, height, pixels, leftoffset, topoffset) {
  const columns = new Array(width);
  for (let x = 0; x < width; x++) {
    const data = new Uint8Array(height);
    for (let y = 0; y < height; y++) data[y] = pixels[y * width + x];
    columns[x] = [{ top: 0, len: height, pixels: data }];
  }
  return { width: width, height: height, leftoffset: leftoffset || 0, topoffset: topoffset || 0, columns: columns };
}

// --- Dibujo de patches en coordenadas lógicas ---------------------------------------
// translation: tabla opcional de 256 bytes para recolorear (como las traducciones de DOOM).
function V_DrawPatch(x, y, patch, translation, flip) {
  if (!patch) return;
  x -= patch.leftoffset;
  y -= patch.topoffset;
  const S = SCALE;
  const fb = screens[0];
  const W = SCREENWIDTH, H = SCREENHEIGHT;
  const px0 = UIOFS + x * S, py0 = y * S;
  for (let c = 0; c < patch.width; c++) {
    const col = patch.columns[flip ? patch.width - 1 - c : c];
    const sx = px0 + c * S;
    if (sx + S <= 0 || sx >= W) continue;
    for (let p = 0; p < col.length; p++) {
      const post = col[p];
      const pix = post.pixels;
      for (let k = 0; k < post.len; k++) {
        let color = pix[k];
        if (translation) color = translation[color];
        const sy = py0 + (post.top + k) * S;
        for (let dy = 0; dy < S; dy++) {
          const yy = sy + dy;
          if (yy < 0 || yy >= H) continue;
          const row = yy * W;
          for (let dx = 0; dx < S; dx++) {
            const xx = sx + dx;
            if (xx >= 0 && xx < W) fb[row + xx] = color;
          }
        }
      }
    }
  }
}

// Dibuja un patch escalado a un tamaño arbitrario (en coordenadas lógicas).
function V_DrawPatchScaled(x, y, patch, scale, translation) {
  if (!patch) return;
  const S = SCALE * scale;
  const fb = screens[0];
  const W = SCREENWIDTH, H = SCREENHEIGHT;
  const px0 = UIOFS + (x - patch.leftoffset * scale) * SCALE;
  const py0 = (y - patch.topoffset * scale) * SCALE;
  const outw = Math.ceil(patch.width * S), outh = Math.ceil(patch.height * S);
  for (let ox = 0; ox < outw; ox++) {
    const sx = Math.floor(px0 + ox);
    if (sx < 0 || sx >= W) continue;
    const c = Math.floor(ox / S);
    if (c >= patch.width) continue;
    const col = patch.columns[c];
    for (let p = 0; p < col.length; p++) {
      const post = col[p];
      const y0 = Math.floor(py0 + post.top * S), y1 = Math.floor(py0 + (post.top + post.len) * S);
      for (let sy = y0; sy < y1; sy++) {
        if (sy < 0 || sy >= H) continue;
        let k = Math.floor((sy - py0) / S) - post.top;
        if (k < 0) k = 0; else if (k >= post.len) k = post.len - 1;
        let color = post.pixels[k];
        if (translation) color = translation[color];
        fb[sy * W + sx] = color;
      }
    }
  }
}

// Rellena un rectángulo lógico.
function V_FillRect(x, y, w, h, color) {
  const S = SCALE;
  V_FillRectPhys(UIOFS + x * S, y * S, w * S, h * S, color);
}

// Rellena un rectángulo en píxeles físicos.
function V_FillRectPhys(x, y, w, h, color) {
  const fb = screens[0];
  const W = SCREENWIDTH, H = SCREENHEIGHT;
  let x0 = Math.max(0, x | 0), x1 = Math.min(W, (x + w) | 0);
  let y0 = Math.max(0, y | 0), y1 = Math.min(H, (y + h) | 0);
  for (let yy = y0; yy < y1; yy++) fb.fill(color, yy * W + x0, yy * W + x1);
}

// Oscurece la pantalla usando un COLORMAP (fondo de menús).
function V_DimScreen(level) {
  const cm = W_CacheLumpName('COLORMAP');
  const fb = screens[0];
  const base = level * 256;
  for (let i = 0; i < fb.length; i++) fb[i] = cm[base + fb[i]];
}

function V_DimRectPhys(x, y, w, h, level) {
  const cm = W_CacheLumpName('COLORMAP');
  const fb = screens[0];
  const W = SCREENWIDTH, H = SCREENHEIGHT;
  const x0 = Math.max(0, x | 0), x1 = Math.min(W, (x + w) | 0);
  const y0 = Math.max(0, y | 0), y1 = Math.min(H, (y + h) | 0);
  const base = level * 256;
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) fb[yy * W + xx] = cm[base + fb[yy * W + xx]];
  }
}

// Copia una imagen indexada completa (en píxeles lógicos) a la pantalla, centrada.
// img = { width, height, pixels } ; se recorta si es más ancha que la pantalla.
function V_DrawFullImage(img) {
  const S = SCALE;
  const fb = screens[0];
  const W = SCREENWIDTH, H = SCREENHEIGHT;
  const lw = W / S;
  const ox = Math.floor((img.width - lw) / 2);
  for (let py = 0; py < H; py++) {
    const iy = Math.min(img.height - 1, Math.floor(py / S));
    const row = iy * img.width;
    for (let px = 0; px < W; px++) {
      let ix = Math.floor(px / S) + ox;
      if (ix < 0) ix = 0; else if (ix >= img.width) ix = img.width - 1;
      fb[py * W + px] = img.pixels[row + ix];
    }
  }
}

// Tapiza toda la pantalla con un flat de 64x64 (fondos del final, bordes de vista).
function V_TileFlat(flat, darken) {
  const S = SCALE;
  const fb = screens[0];
  const W = SCREENWIDTH, H = SCREENHEIGHT;
  const cm = darken ? W_CacheLumpName('COLORMAP') : null;
  const base = (darken || 0) * 256;
  for (let py = 0; py < H; py++) {
    const fy = (Math.floor(py / S) & 63) * 64;
    for (let px = 0; px < W; px++) {
      const c = flat[fy + (Math.floor(px / S) & 63)];
      fb[py * W + px] = cm ? cm[base + c] : c;
    }
  }
}

function V_TileFlatRectPhys(flat, x, y, w, h, darken) {
  const S = SCALE;
  const fb = screens[0];
  const W = SCREENWIDTH, H = SCREENHEIGHT;
  const cm = darken ? W_CacheLumpName('COLORMAP') : null;
  const base = (darken || 0) * 256;
  const x0 = Math.max(0, x | 0), x1 = Math.min(W, (x + w) | 0);
  const y0 = Math.max(0, y | 0), y1 = Math.min(H, (y + h) | 0);
  for (let py = y0; py < y1; py++) {
    const fy = (Math.floor(py / S) & 63) * 64;
    for (let px = x0; px < x1; px++) {
      const c = flat[fy + (Math.floor(px / S) & 63)];
      fb[py * W + px] = cm ? cm[base + c] : c;
    }
  }
}

// --- Texto -------------------------------------------------------------------------
// Las fuentes se generan en content/font.js y se registran como lumps de patches:
// FNT_S<cód> (pequeña, estilo STCFN) y FNT_B<cód> (grande, estilo títulos de menú).
const V_fontCache = { small: new Map(), big: new Map() };

function V_GetGlyph(ch, big) {
  const cache = big ? V_fontCache.big : V_fontCache.small;
  let g = cache.get(ch);
  if (g !== undefined) return g;
  const code = ch.codePointAt(0);
  const name = (big ? 'FB' : 'FS') + code.toString(16).toUpperCase().padStart(4, '0');
  const n = W_CheckNumForName(name);
  g = n >= 0 ? W_CacheLumpNum(n) : null;
  cache.set(ch, g);
  return g;
}

// Ancho de un texto en píxeles lógicos.
function V_StringWidth(str, big) {
  let w = 0, maxw = 0;
  for (const ch of str) {
    if (ch === '\n') { maxw = Math.max(maxw, w); w = 0; continue; }
    if (ch === ' ') { w += big ? 7 : 4; continue; }
    const g = V_GetGlyph(ch, big);
    w += g ? g.width + (big ? 0 : 0) : (big ? 7 : 4);
  }
  return Math.max(maxw, w);
}

// Dibuja texto; translation permite colorearlo (ver V_Translations).
function V_DrawText(x, y, str, big, translation) {
  let cx = x, cy = y;
  const lineh = big ? 20 : 11;
  for (const ch of str) {
    if (ch === '\n') { cx = x; cy += lineh; continue; }
    if (ch === ' ') { cx += big ? 7 : 4; continue; }
    const g = V_GetGlyph(ch, big);
    if (!g) { cx += big ? 7 : 4; continue; }
    V_DrawPatch(cx, cy, g, translation);
    cx += g.width;
  }
  return cx;
}

function V_DrawTextCentered(y, str, big, translation) {
  const w = V_StringWidth(str, big);
  V_DrawText(Math.floor(160 - w / 2), y, str, big, translation);
}

// Tablas de traducción de color para las fuentes (la fuente base es "hueso").
const V_Translations = {};
function V_InitTranslations() {
  // La fuente base usa la rampa de lino (R_LINEN). Se crean variantes.
  function make(ramp, shift) {
    const t = new Uint8Array(256);
    for (let i = 0; i < 256; i++) t[i] = i;
    for (let s = 0; s < 16; s++) t[C(R_LINEN, s)] = C(ramp, Math.min(15, s + (shift || 0)));
    return t;
  }
  V_Translations.red = make(R_RED, 0);
  V_Translations.gold = make(R_GOLD, 0);
  V_Translations.gray = make(R_STEEL, 2);
  V_Translations.blue = make(R_NAVY, 0);
  V_Translations.green = make(R_GREEN, 0);
  V_Translations.sand = make(R_SAND, 0);
  V_Translations.dark = make(R_GRAY, 8);
}
