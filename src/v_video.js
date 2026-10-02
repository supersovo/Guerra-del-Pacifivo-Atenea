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
  // Los glifos de alta resolución dependen de SCALE.
  V_hrCache.clear();
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
  if (patch.density) {
    if (patch.ocolumns) V_DrawPatchHR(x, y, patch, patch.ocolumns, null);
    V_DrawPatchHR(x, y, patch, patch.columns, translation);
    return;
  }
  x -= patch.leftoffset;
  y -= patch.topoffset;
  const S = SCALE;
  const fb = screens[0];
  const W = SCREENWIDTH, H = SCREENHEIGHT;
  // a píxel entero: un texto centrado de ancho impar cae en medio píxel lógico
  const px0 = Math.round(UIOFS + x * S), py0 = Math.round(y * S);
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

// Patch de alta densidad (glifos vectoriales, etc.): sus columnas están en
// píxeles reales (density por unidad lógica). Con density == SCALE se copia
// 1:1; si no, se amplía o reduce por vecino más cercano.
function V_DrawPatchHR(x, y, patch, columns, translation) {
  if (!columns || !patch.pw) return;
  const fb = screens[0];
  const W = SCREENWIDTH, H = SCREENHEIGHT;
  const px0 = Math.round(UIOFS + (x - patch.leftoffset) * SCALE);
  const py0 = Math.round((y - patch.topoffset) * SCALE);
  const k = SCALE / patch.density;
  if (k === 1) {
    for (let c = 0; c < patch.pw; c++) {
      const sx = px0 + c;
      if (sx < 0 || sx >= W) continue;
      const col = columns[c];
      for (let p = 0; p < col.length; p++) {
        const post = col[p];
        const pix = post.pixels;
        let yy = py0 + post.top;
        for (let j = 0; j < post.len; j++, yy++) {
          if (yy < 0 || yy >= H) continue;
          fb[yy * W + sx] = translation ? translation[pix[j]] : pix[j];
        }
      }
    }
    return;
  }
  const outw = Math.ceil(patch.pw * k);
  for (let ox = 0; ox < outw; ox++) {
    const sx = px0 + ox;
    if (sx < 0 || sx >= W) continue;
    const c = Math.floor(ox / k);
    if (c >= patch.pw) continue;
    const col = columns[c];
    for (let p = 0; p < col.length; p++) {
      const post = col[p];
      const ya = Math.floor(py0 + post.top * k), yb = Math.floor(py0 + (post.top + post.len) * k);
      for (let yy = Math.max(0, ya); yy < Math.min(H, yb); yy++) {
        let j = Math.floor((yy - py0) / k) - post.top;
        if (j < 0) j = 0; else if (j >= post.len) j = post.len - 1;
        const color = post.pixels[j];
        fb[yy * W + sx] = translation ? translation[color] : color;
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
let V_xmap = new Int32Array(1);
function V_DrawFullImage(img) {
  const S = SCALE;
  const fb = screens[0];
  const W = SCREENWIDTH, H = SCREENHEIGHT;
  const lw = W / S;
  const ox = Math.floor((img.width - lw) / 2);
  if (V_xmap.length < W) V_xmap = new Int32Array(W);
  const xmap = V_xmap;
  for (let px = 0; px < W; px++) {
    let ix = Math.floor(px / S) + ox;
    xmap[px] = ix < 0 ? 0 : ix >= img.width ? img.width - 1 : ix;
  }
  const src = img.pixels;
  for (let py = 0; py < H; py++) {
    const row = Math.min(img.height - 1, Math.floor(py / S)) * img.width;
    const dst = py * W;
    if (py % S) { fb.copyWithin(dst, dst - W, dst); continue; }
    for (let px = 0; px < W; px++) fb[dst + px] = src[row + xmap[px]];
  }
}

// Coordenada x de la interfaz (0..320) que corresponde a la columna ix de una
// imagen de pantalla completa dibujada con V_DrawFullImage.
function V_FullImageX(img, ix) {
  const lw = SCREENWIDTH / SCALE;
  return ix - Math.floor((img.width - lw) / 2) - UIOFS / SCALE;
}

// Tapiza toda la pantalla con un flat de 64x64 (fondos del final, bordes de vista).
function V_TileFlat(flat, darken) {
  V_TileFlatRectPhys(flat, 0, 0, SCREENWIDTH, SCREENHEIGHT, darken);
}

// Un texel del flat por píxel lógico (flats de 64 o 128 texeles de lado);
// en alta resolución se amplía a la mitad de SCALE (textura más fina).
function V_TileFlatRectPhys(flat, x, y, w, h, darken) {
  const n = Math.round(Math.sqrt(flat.length)), mask = n - 1;
  const S = Math.max(1, SCALE >> 1);
  const fb = screens[0];
  const W = SCREENWIDTH, H = SCREENHEIGHT;
  const cm = darken ? W_CacheLumpName('COLORMAP') : null;
  const base = (darken || 0) * 256;
  const x0 = Math.max(0, x | 0), x1 = Math.min(W, (x + w) | 0);
  const y0 = Math.max(0, y | 0), y1 = Math.min(H, (y + h) | 0);
  if (V_xmap.length < W) V_xmap = new Int32Array(W);
  const xmap = V_xmap;
  for (let px = x0; px < x1; px++) xmap[px] = Math.floor(px / S) & mask;
  for (let py = y0; py < y1; py++) {
    const fy = (Math.floor(py / S) & mask) * n;
    const row = py * W;
    for (let px = x0; px < x1; px++) {
      const c = flat[fy + xmap[px]];
      fb[row + px] = cm ? cm[base + c] : c;
    }
  }
}

// --- Texto -------------------------------------------------------------------------
// Fuente clásica de mapa de bits (content/font.js), registrada como lumps
// FS<cód> (pequeña, estilo STCFN) y FB<cód> (grande, títulos de menú); desde
// 640x400, glifos vectoriales rasterizados a la resolución real (FONT_MakeHR).
// El parámetro "big" de las funciones de texto admite false/'small' (pequeña),
// true/'big' (grande) y 'title' (portada).
const V_fontCache = { small: new Map(), big: new Map() };
const V_hrCache = new Map();

function V_TextStyle(big) {
  if (big === true) return 'big';
  if (typeof big === 'string') return big;
  return 'small';
}

function V_UseHR() {
  return SCALE >= 2 && typeof FONT_HRAvailable === 'function' && FONT_HRAvailable();
}

function V_GetGlyph(ch, big, plain) {
  const style = V_TextStyle(big);
  if (V_UseHR()) {
    const key = style + (plain ? '|p|' : '|o|') + ch;
    let g = V_hrCache.get(key);
    if (g === undefined) {
      g = FONT_MakeHR(ch, style, SCALE, !!plain);
      V_hrCache.set(key, g);
    }
    return g;
  }
  const isBig = style === 'big' || style === 'title' || style === 'medium';
  const cache = isBig ? V_fontCache.big : V_fontCache.small;
  let g = cache.get(ch);
  if (g !== undefined) return g;
  const code = ch.codePointAt(0);
  const name = (isBig ? 'FB' : 'FS') + code.toString(16).toUpperCase().padStart(4, '0');
  const n = W_CheckNumForName(name);
  g = n >= 0 ? W_CacheLumpNum(n) : null;
  cache.set(ch, g);
  return g;
}

function V_SpaceWidth(style) {
  if (V_UseHR()) return FONT_STYLES[style].space;
  return style === 'small' || style === 'note' ? 4 : style === 'title' ? 21 : 7;
}

// Con la fuente clásica, el estilo de portada es la grande ampliada x3.
function V_ClassicMul(style) {
  return style === 'title' && !V_UseHR() ? 3 : 1;
}

function V_LineHeight(style) {
  return FONT_LINEH[style] || 11;
}

// Ancho de un texto en píxeles lógicos.
function V_StringWidth(str, big) {
  const style = V_TextStyle(big);
  const sp = V_SpaceWidth(style);
  let w = 0, maxw = 0;
  for (const ch of str) {
    if (ch === '\n') { maxw = Math.max(maxw, w); w = 0; continue; }
    if (ch === ' ') { w += sp; continue; }
    const g = V_GetGlyph(ch, style);
    w += g ? g.width * V_ClassicMul(style) : sp;
  }
  return Math.max(maxw, w);
}

// Dibuja texto; translation permite colorearlo (ver V_Translations). Con
// glifos vectoriales se pintan primero todos los contornos y luego los
// rellenos. Devuelve la x lógica final.
function V_DrawText(x, y, str, big, translation) {
  const style = V_TextStyle(big);
  const lineh = V_LineHeight(style);
  const sp = V_SpaceWidth(style);
  const hr = V_UseHR();
  const plain = !!(translation && translation.plain);
  let endx = x;
  for (let pass = hr && !plain ? 0 : 1; pass < 2; pass++) {
    let cx = x, cy = y;
    for (const ch of str) {
      if (ch === '\n') { cx = x; cy += lineh; continue; }
      if (ch === ' ') { cx += sp; continue; }
      const g = V_GetGlyph(ch, style, plain);
      if (!g) { cx += sp; continue; }
      if (!hr) {
        if (style === 'title') { V_DrawPatchScaled(cx, cy, g, 3, translation); cx += g.width * 3; continue; }
        V_DrawPatch(cx, cy, g, translation);
      } else if (pass === 0) V_DrawPatchHR(cx, cy, g, g.ocolumns, null);
      else V_DrawPatchHR(cx, cy, g, g.columns, translation);
      cx += g.width;
    }
    endx = cx;
  }
  return endx;
}

function V_DrawTextCentered(y, str, big, translation) {
  const w = V_StringWidth(str, big);
  V_DrawText(160 - w / 2, y, str, big, translation);
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
  V_Translations.dark.plain = true;          // tinta sobre pergamino o cuero: sin contorno
  // Tintas de la carta (sin contorno): sepia, azul del mar, rojo de los rótulos.
  V_Translations.ink = make(R_WOOD, 10);
  V_Translations.ink.plain = true;
  V_Translations.inksea = make(R_NAVY, 5);
  V_Translations.inksea.plain = true;
  V_Translations.inkred = make(R_RED, 7);
  V_Translations.inkred.plain = true;
  V_Translations.label = make(R_WOOD, 3);    // rótulos grabados de la barra de estado
  V_Translations.label.plain = true;
  V_Translations.engrave = make(R_WOOD, 13);
  V_Translations.engrave.plain = true;
}
