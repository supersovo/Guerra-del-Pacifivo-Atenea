// =============================================================================
// i_video.js — Capa de plataforma de video (i_video.c)
// -----------------------------------------------------------------------------
// Traduce el framebuffer indexado a RGBA mediante la paleta activa y lo vuelca
// en un <canvas>. Como en DOOM, los píxeles lógicos de 320x200 se muestran con
// relación de aspecto 4:3 (cada píxel es 1,2 veces más alto que ancho).
// =============================================================================
'use strict';

let I_canvas = null;
let I_ctx = null;
let I_image = null;
let I_out32 = null;
let I_palLUT = new Uint32Array(256);
let I_currentPal = -1;
let I_gammaTable = null;
let I_needResize = true;

const I_gammaLevels = [1.0, 0.9, 0.8, 0.7, 0.6];

function I_InitGraphics(canvas) {
  I_canvas = canvas;
  I_ctx = canvas.getContext('2d', { alpha: false });
  window.addEventListener('resize', function () { I_needResize = true; });
  if (window.visualViewport) window.visualViewport.addEventListener('resize', function () { I_needResize = true; });
  document.addEventListener('fullscreenchange', function () { I_needResize = true; });
  I_ComputeScreenSize();
}

// Calcula el tamaño del framebuffer según el detalle y la forma de la ventana.
function I_ComputeScreenSize() {
  const S = defaults.detailLevel ? 2 : 1;
  // Espacio disponible: la caja de contenido del contenedor (respeta su
  // relleno) o, sin contenedor, la ventana completa.
  let vw = window.innerWidth, vh = window.innerHeight;
  const host = I_canvas.parentElement;
  if (host && host !== document.body) {
    const cs = window.getComputedStyle(host);
    vw = host.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    vh = host.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  }
  vw = Math.max(1, vw); vh = Math.max(1, vh);
  let baseW = 320;
  if (defaults.widescreen) {
    const aspect = vw / vh;
    baseW = Math.round(200 * aspect / 1.2);
    baseW = Math.max(320, Math.min(560, baseW));
    baseW &= ~1;
  }
  const changed = (SCREENWIDTH !== baseW * S) || (SCREENHEIGHT !== 200 * S) || SCALE !== S;
  SCALE = S;
  SCREENWIDTH = baseW * S;
  SCREENHEIGHT = 200 * S;
  V_BaseWidth = baseW;
  UIOFS = ((baseW - 320) >> 1) * S;
  if (changed || !I_image) {
    I_canvas.width = SCREENWIDTH;
    I_canvas.height = SCREENHEIGHT;
    I_image = I_ctx.createImageData(SCREENWIDTH, SCREENHEIGHT);
    I_out32 = new Uint32Array(I_image.data.buffer);
    V_Init();
  }
  // Ajuste CSS: mantener la relación de aspecto con píxeles 1:1,2.
  const dispAspect = SCREENWIDTH / (SCREENHEIGHT * 1.2);
  let cw = vw, ch = vw / dispAspect;
  if (ch > vh) { ch = vh; cw = vh * dispAspect; }
  I_canvas.style.width = Math.floor(cw) + 'px';
  I_canvas.style.height = Math.floor(ch) + 'px';
  I_needResize = false;
  return changed;
}

function I_BuildGamma() {
  const g = I_gammaLevels[defaults.usegamma] || 1;
  I_gammaTable = new Uint8Array(256);
  for (let i = 0; i < 256; i++) I_gammaTable[i] = Math.round(255 * Math.pow(i / 255, g));
}

// I_SetPalette: activa una de las 14 paletas de PLAYPAL.
function I_SetPalette(num) {
  if (num === I_currentPal && I_gammaTable) return;
  I_currentPal = num;
  if (!I_gammaTable) I_BuildGamma();
  const pal = W_CacheLumpName('PLAYPAL');
  const base = num * 768;
  const gt = I_gammaTable;
  for (let i = 0; i < 256; i++) {
    const r = gt[pal[base + i * 3]], g = gt[pal[base + i * 3 + 1]], b = gt[pal[base + i * 3 + 2]];
    I_palLUT[i] = 0xff000000 | (b << 16) | (g << 8) | r;
  }
}

function I_RefreshGamma() {
  I_BuildGamma();
  const p = I_currentPal;
  I_currentPal = -1;
  I_SetPalette(p < 0 ? 0 : p);
}

// I_FinishUpdate: vuelca screens[0] al canvas.
function I_FinishUpdate() {
  const fb = screens[0];
  const out = I_out32;
  const lut = I_palLUT;
  const n = fb.length;
  for (let i = 0; i < n; i++) out[i] = lut[fb[i]];
  I_ctx.putImageData(I_image, 0, 0);
}

function I_ToggleFullscreen() {
  try {
    if (!document.fullscreenElement) {
      const el = document.documentElement;
      if (el.requestFullscreen) el.requestFullscreen();
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  } catch (e) { /* ignorar */ }
}
