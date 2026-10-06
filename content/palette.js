// =============================================================================
// palette.js — Paleta de 256 colores (PLAYPAL) y mapas de luz (COLORMAP)
// -----------------------------------------------------------------------------
// Igual que DOOM, el motor dibuja en 8 bits: cada píxel es un índice a una
// paleta. La iluminación se hace con COLORMAP: 32 tablas que traducen cada color
// a su versión oscurecida. La paleta está organizada en 16 rampas de 16 tonos
// pensadas para el desierto de Atacama, el Pacífico y los uniformes de 1879.
// =============================================================================
'use strict';

// Rampas (índice = rampa * 16 + tono; tono 0 = el más claro, 15 = el más oscuro,
// salvo la rampa de grises, que se guarda de negro (0) a blanco (15)).
const R_GRAY = 0, R_STONE = 1, R_SAND = 2, R_ADOBE = 3, R_WOOD = 4, R_SKIN = 5,
      R_RED = 6, R_NAVY = 7, R_SKY = 8, R_SEA = 9, R_GREEN = 10, R_GOLD = 11,
      R_FIRE = 12, R_LINEN = 13, R_DAWN = 14, R_STEEL = 15;

const RAMP_DEFS = [
  null, // grises: especial
  [[228, 220, 204], [138, 126, 110], [18, 16, 14]],   // piedra
  [[250, 232, 190], [204, 168, 114], [40, 28, 14]],   // arena
  [[242, 196, 150], [178, 112, 66], [34, 16, 6]],     // adobe / greda
  [[216, 166, 110], [132, 86, 46], [22, 12, 4]],      // madera / cuero
  [[255, 224, 194], [206, 146, 106], [52, 24, 12]],   // piel
  [[255, 140, 128], [204, 28, 28], [34, 0, 0]],       // rojo (sangre, garance)
  [[160, 178, 236], [44, 64, 150], [4, 6, 22]],       // azul marino (levita)
  [[236, 246, 255], [116, 166, 224], [14, 32, 66]],   // cielo
  [[160, 220, 216], [32, 112, 132], [2, 18, 26]],     // mar
  [[200, 210, 130], [96, 118, 52], [8, 14, 4]],       // verde oliva (tamarugo)
  [[255, 246, 170], [226, 176, 44], [50, 32, 0]],     // oro / bronce
  [[255, 255, 210], [255, 150, 24], [72, 8, 0]],      // fuego
  [[255, 255, 246], [214, 206, 178], [62, 58, 44]],   // lino / brin / caliche
  [[255, 206, 214], [164, 92, 142], [20, 8, 30]],     // alba (cielo de Arica)
  [[214, 224, 236], [108, 118, 134], [6, 8, 12]]      // acero
];

// C(rampa, tono): índice de paleta. tono 0 = claro .. 15 = oscuro.
function C(ramp, shade) {
  shade = shade < 0 ? 0 : shade > 15 ? 15 : shade | 0;
  if (ramp === R_GRAY) return 15 - shade;
  return ramp * 16 + shade;
}

const PAL_BASE = new Uint8Array(256 * 3);   // paleta 0 en RGB

(function buildBasePalette() {
  for (let i = 0; i < 16; i++) {
    const v = Math.round(255 * Math.pow(i / 15, 0.95));
    PAL_BASE[i * 3] = v; PAL_BASE[i * 3 + 1] = v; PAL_BASE[i * 3 + 2] = v;
  }
  for (let r = 1; r < 16; r++) {
    const d = RAMP_DEFS[r];
    for (let s = 0; s < 16; s++) {
      let c;
      if (s <= 7) {
        const t = s / 7;
        c = [0, 1, 2].map(function (k) { return d[0][k] + (d[1][k] - d[0][k]) * t; });
      } else {
        const t = (s - 7) / 8;
        // curva ligeramente cóncava para que los oscuros no se amontonen
        const tt = Math.pow(t, 0.85);
        c = [0, 1, 2].map(function (k) { return d[1][k] + (d[2][k] - d[1][k]) * tt; });
      }
      const idx = (r * 16 + s) * 3;
      PAL_BASE[idx] = Math.round(c[0]);
      PAL_BASE[idx + 1] = Math.round(c[1]);
      PAL_BASE[idx + 2] = Math.round(c[2]);
    }
  }
})();

// Distancia perceptual simple entre colores.
function PAL_Dist(r1, g1, b1, r2, g2, b2) {
  const rm = (r1 + r2) * 0.5;
  const dr = r1 - r2, dg = g1 - g2, db = b1 - b2;
  return (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
}

// Color más cercano en la paleta base.
function PAL_Nearest(r, g, b, exclude0) {
  let best = 0, bestd = Infinity;
  for (let i = exclude0 ? 1 : 0; i < 256; i++) {
    const d = PAL_Dist(r, g, b, PAL_BASE[i * 3], PAL_BASE[i * 3 + 1], PAL_BASE[i * 3 + 2]);
    if (d < bestd) { bestd = d; best = i; }
  }
  return best;
}

// Cubo de búsqueda RGB (5 bits por canal) -> índice de paleta, para cuantizar
// rápidamente las texturas generadas en color verdadero.
const PAL_CUBE = new Uint8Array(32 * 32 * 32);
function PAL_BuildCube() {
  for (let r = 0; r < 32; r++) {
    for (let g = 0; g < 32; g++) {
      for (let b = 0; b < 32; b++) {
        PAL_CUBE[(r << 10) | (g << 5) | b] =
          PAL_Nearest((r << 3) + 4, (g << 3) + 4, (b << 3) + 4, false);
      }
    }
  }
}

// Cuantiza un color RGB (0..255) a un índice de paleta.
function RGB(r, g, b) {
  r = r < 0 ? 0 : r > 255 ? 255 : r;
  g = g < 0 ? 0 : g > 255 ? 255 : g;
  b = b < 0 ? 0 : b > 255 ? 255 : b;
  return PAL_CUBE[((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)];
}

// Construye PLAYPAL (14 paletas) y COLORMAP (34 mapas) y los registra en el WAD.
function PAL_BuildLumps() {
  PAL_BuildCube();
  const playpal = new Uint8Array(14 * 768);
  function tinted(dst, tr, tg, tb, f) {
    for (let i = 0; i < 256; i++) {
      for (let k = 0; k < 3; k++) {
        const c = PAL_BASE[i * 3 + k];
        const t = k === 0 ? tr : k === 1 ? tg : tb;
        playpal[dst * 768 + i * 3 + k] = Math.round(c + (t - c) * f);
      }
    }
  }
  tinted(0, 0, 0, 0, 0);
  for (let i = 1; i <= NUMREDPALS; i++) tinted(STARTREDPALS + i - 1, 255, 0, 0, i / 9);
  for (let i = 1; i <= NUMBONUSPALS; i++) tinted(STARTBONUSPALS + i - 1, 215, 186, 69, i * 0.125);
  tinted(13, 0, 256, 0, 0.125);
  W_AddLump('PLAYPAL', playpal, 'palette');

  const colormap = new Uint8Array(34 * 256);
  for (let l = 0; l < NUMCOLORMAPS; l++) {
    // nivel 0 = luz plena, 31 = casi negro (como COLORMAP de DOOM)
    const f = Math.pow(1 - l / NUMCOLORMAPS, 1.08);
    for (let i = 0; i < 256; i++) {
      const r = PAL_BASE[i * 3] * f, g = PAL_BASE[i * 3 + 1] * f, b = PAL_BASE[i * 3 + 2] * f;
      colormap[l * 256 + i] = l === 0 ? i : PAL_Nearest(r, g, b, false);
    }
  }
  // 32: invulnerabilidad (escala de grises invertida), 33: todo negro
  for (let i = 0; i < 256; i++) {
    const r = PAL_BASE[i * 3], g = PAL_BASE[i * 3 + 1], b = PAL_BASE[i * 3 + 2];
    const gray = 255 - (r * 0.3 + g * 0.59 + b * 0.11);
    colormap[32 * 256 + i] = PAL_Nearest(gray, gray, gray, false);
    colormap[33 * 256 + i] = 0;
  }
  W_AddLump('COLORMAP', colormap, 'colormap');
  PAL_BuildTranMaps();
}

// --- Bruma (perspectiva aérea) -----------------------------------------------------------
// NUMHAZE bloques de 34 mapas de luz: el bloque h mezcla cada color, ya
// oscurecido por su nivel de luz, con el color de la bruma en la proporción
// max·h/(NUMHAZE−1). El bloque 0 es el COLORMAP de DOOM, así que los mapas
// fijos (invulnerabilidad) y los objetos a plena luz no cambian.
const NUMHAZE = 16;
function PAL_BuildFogMaps(colormap, haze, maxHaze) {
  const out = new Uint8Array(NUMHAZE * 34 * 256);
  out.set(colormap.subarray(0, 34 * 256), 0);
  for (let h = 1; h < NUMHAZE; h++) {
    const a = maxHaze * h / (NUMHAZE - 1);
    const base = h * 34 * 256;
    for (let l = 0; l < 34; l++) {
      for (let i = 0; i < 256; i++) {
        const c = colormap[l * 256 + i];
        if (l >= 32) { out[base + l * 256 + i] = c; continue; }
        const r = PAL_BASE[c * 3], g = PAL_BASE[c * 3 + 1], b = PAL_BASE[c * 3 + 2];
        out[base + l * 256 + i] = RGB(Math.round(r + (haze[0] - r) * a), Math.round(g + (haze[1] - g) * a), Math.round(b + (haze[2] - b) * a));
      }
    }
  }
  return out;
}

// --- Transparencia (como el TRANMAP de Boom) ------------------------------------------------
// PAL_TRAN[k][(fuente << 8) | destino]: color de la paleta más cercano a la
// mezcla del texel con lo que ya está dibujado, con opacidad PAL_TRANALPHA[k].
// Los sprites de humo guardan por texel uno de estos tres niveles.
const PAL_TRANALPHA = [0.22, 0.42, 0.64];
const PAL_TRAN = [];
function PAL_BuildTranMaps() {
  PAL_TRAN.length = 0;
  for (const a of PAL_TRANALPHA) {
    const t = new Uint8Array(65536);
    for (let src = 0; src < 256; src++) {
      const sr = PAL_BASE[src * 3] * a, sg = PAL_BASE[src * 3 + 1] * a, sb = PAL_BASE[src * 3 + 2] * a;
      for (let dst = 0; dst < 256; dst++) {
        t[(src << 8) | dst] = RGB(Math.round(sr + PAL_BASE[dst * 3] * (1 - a)), Math.round(sg + PAL_BASE[dst * 3 + 1] * (1 - a)), Math.round(sb + PAL_BASE[dst * 3 + 2] * (1 - a)));
      }
    }
    PAL_TRAN.push(t);
  }
}
