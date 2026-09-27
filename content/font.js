// =============================================================================
// font.js — Fuentes de mapa de bits (equivalentes a STCFN y a los títulos
// de menú de DOOM), con mayúsculas, minúsculas, acentos, ñ y signos de
// apertura del castellano. Se generan como lumps de patches: FS<hex> (fuente
// pequeña) y FB<hex> (fuente grande con degradado y contorno).
// =============================================================================
'use strict';

// Filas de glifos: '#' = píxel encendido. Mayúsculas y dígitos: 7 filas.
// Minúsculas: 5 filas de altura x (o 7 si tienen ascendente); las que tienen
// descendente declaran desc: 2 filas extra. 'top' indica la fila de inicio
// relativa a la línea superior de las mayúsculas (0).
const FONT_GLYPHS = {
  'A': ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  'B': ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  'C': ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  'D': ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  'E': ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  'F': ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  'G': ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'],
  'H': ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  'I': ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
  'J': ['..###', '...#.', '...#.', '...#.', '#..#.', '#..#.', '.##..'],
  'K': ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  'L': ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  'M': ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  'N': ['#...#', '#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#'],
  'O': ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  'P': ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  'Q': ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  'R': ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  'S': ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  'T': ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  'U': ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  'V': ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  'W': ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'],
  'X': ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  'Y': ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  'Z': ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],

  'a': { top: 2, rows: ['.###.', '....#', '.####', '#...#', '.####'] },
  'b': { rows: ['#....', '#....', '####.', '#...#', '#...#', '#...#', '####.'] },
  'c': { top: 2, rows: ['.###.', '#....', '#....', '#....', '.###.'] },
  'd': { rows: ['....#', '....#', '.####', '#...#', '#...#', '#...#', '.####'] },
  'e': { top: 2, rows: ['.###.', '#...#', '#####', '#....', '.###.'] },
  'f': { rows: ['..##', '.#..', '####', '.#..', '.#..', '.#..', '.#..'] },
  'g': { top: 2, rows: ['.####', '#...#', '#...#', '#...#', '.####', '....#', '.###.'] },
  'h': { rows: ['#....', '#....', '####.', '#...#', '#...#', '#...#', '#...#'] },
  'i': { rows: ['.#.', '...', '##.', '.#.', '.#.', '.#.', '###'] },
  'j': { rows: ['..#', '...', '.##', '..#', '..#', '..#', '..#', '#.#', '.#.'] },
  'k': { rows: ['#...', '#...', '#..#', '#.#.', '##..', '#.#.', '#..#'] },
  'l': { rows: ['##.', '.#.', '.#.', '.#.', '.#.', '.#.', '###'] },
  'm': { top: 2, rows: ['##.#.', '#.#.#', '#.#.#', '#.#.#', '#...#'] },
  'n': { top: 2, rows: ['####.', '#...#', '#...#', '#...#', '#...#'] },
  'o': { top: 2, rows: ['.###.', '#...#', '#...#', '#...#', '.###.'] },
  'p': { top: 2, rows: ['####.', '#...#', '#...#', '#...#', '####.', '#....', '#....'] },
  'q': { top: 2, rows: ['.####', '#...#', '#...#', '#...#', '.####', '....#', '....#'] },
  'r': { top: 2, rows: ['#.##.', '##..#', '#....', '#....', '#....'] },
  's': { top: 2, rows: ['.####', '#....', '.###.', '....#', '####.'] },
  't': { top: 1, rows: ['.#..', '####', '.#..', '.#..', '.#..', '..##'] },
  'u': { top: 2, rows: ['#...#', '#...#', '#...#', '#..##', '.##.#'] },
  'v': { top: 2, rows: ['#...#', '#...#', '#...#', '.#.#.', '..#..'] },
  'w': { top: 2, rows: ['#...#', '#...#', '#.#.#', '#.#.#', '.#.#.'] },
  'x': { top: 2, rows: ['#...#', '.#.#.', '..#..', '.#.#.', '#...#'] },
  'y': { top: 2, rows: ['#...#', '#...#', '#...#', '#...#', '.####', '....#', '.###.'] },
  'z': { top: 2, rows: ['#####', '...#.', '..#..', '.#...', '#####'] },

  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['#####', '...#.', '..#..', '...#.', '....#', '#...#', '.###.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],

  '.': { top: 6, rows: ['#'] },
  ',': { top: 6, rows: ['.#', '#.'] },
  ':': { top: 2, rows: ['#', '.', '.', '#'] },
  ';': { top: 2, rows: ['.#', '..', '..', '.#', '#.'] },
  '!': ['#', '#', '#', '#', '#', '.', '#'],
  '¡': { top: 2, rows: ['#', '.', '#', '#', '#', '#', '#'] },
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
  '¿': { top: 2, rows: ['..#..', '.....', '..#..', '.#...', '#....', '#...#', '.###.'] },
  '-': { top: 3, rows: ['###'] },
  '+': { top: 1, rows: ['..#..', '..#..', '#####', '..#..', '..#..'] },
  '=': { top: 2, rows: ['####', '....', '####'] },
  '/': ['....#', '...#.', '...#.', '..#..', '.#...', '.#...', '#....'],
  '(': ['.#', '#.', '#.', '#.', '#.', '#.', '.#'],
  ')': ['#.', '.#', '.#', '.#', '.#', '.#', '#.'],
  '[': ['##', '#.', '#.', '#.', '#.', '#.', '##'],
  ']': ['##', '.#', '.#', '.#', '.#', '.#', '##'],
  '%': ['##..#', '##..#', '...#.', '..#..', '.#...', '#..##', '#..##'],
  '\'': ['#', '#'],
  '"': ['#.#', '#.#'],
  '*': { top: 1, rows: ['#.#.#', '.###.', '#####', '.###.', '#.#.#'] },
  '#': ['.#.#.', '.#.#.', '#####', '.#.#.', '#####', '.#.#.', '.#.#.'],
  '_': { top: 7, rows: ['#####'] },
  '<': ['...#', '..#.', '.#..', '#...', '.#..', '..#.', '...#'],
  '>': ['#...', '.#..', '..#.', '...#', '..#.', '.#..', '#...'],
  'º': ['.#.', '#.#', '.#.', '...', '###'],
  'ª': ['##.', '..#', '###', '...', '###'],
  '·': { top: 3, rows: ['#'] },
  '—': { top: 3, rows: ['######'] },
  '«': { top: 1, rows: ['..#.#', '.#.#.', '#.#..', '.#.#.', '..#.#'] },
  '»': { top: 1, rows: ['#.#..', '.#.#.', '..#.#', '.#.#.', '#.#..'] },
  '°': ['.#.', '#.#', '.#.']
};

// Acentos compuestos.
const FONT_ACCENTS = {
  acute: ['...#.', '..#..'],
  tilde: ['.##.#', '#..#.'],
  diaer: ['.#.#.']
};
const FONT_COMPOSED = {
  'Á': ['A', 'acute'], 'É': ['E', 'acute'], 'Í': ['I', 'acute'], 'Ó': ['O', 'acute'], 'Ú': ['U', 'acute'],
  'Ñ': ['N', 'tilde'], 'Ü': ['U', 'diaer'],
  'á': ['a', 'acute'], 'é': ['e', 'acute'], 'í': ['ı', 'acute'], 'ó': ['o', 'acute'], 'ú': ['u', 'acute'],
  'ñ': ['n', 'tilde'], 'ü': ['u', 'diaer']
};
FONT_GLYPHS['ı'] = { top: 2, rows: ['##.', '.#.', '.#.', '.#.', '###'] };

// Devuelve { rows, top } normalizado para un carácter.
function FONT_GetGlyph(ch) {
  let g = FONT_GLYPHS[ch];
  if (!g && FONT_COMPOSED[ch]) {
    const base = FONT_GetGlyph(FONT_COMPOSED[ch][0]);
    const acc = FONT_ACCENTS[FONT_COMPOSED[ch][1]];
    const w = base.rows[0].length;
    const accRows = acc.map(function (r) {
      // centrar el acento sobre el glifo
      const aw = r.length;
      if (aw === w) return r;
      if (aw > w) {
        const off = Math.floor((aw - w) / 2);
        return r.substr(off, w);
      }
      const pad = Math.floor((w - aw) / 2);
      return '.'.repeat(pad) + r + '.'.repeat(w - aw - pad);
    });
    const rows = accRows.concat(['.'.repeat(w)], base.rows);
    return { rows: rows, top: base.top - accRows.length - 1 };
  }
  if (!g) return null;
  if (Array.isArray(g)) return { rows: g, top: 0 };
  return { rows: g.rows, top: g.top || 0 };
}

const FONT_CAPTOP = 4; // filas de margen sobre las mayúsculas (para acentos)

// Construye los lumps de la fuente pequeña y grande.
function FONT_BuildLumps() {
  const chars = Object.keys(FONT_GLYPHS).concat(Object.keys(FONT_COMPOSED));
  for (const ch of chars) {
    if (ch === 'ı') continue;
    const g = FONT_GetGlyph(ch);
    if (!g) continue;
    const code = ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
    W_AddLump('FS' + code, FONT_MakeSmall(g), 'patch');
    W_AddLump('FB' + code, FONT_MakeBig(g), 'patch');
  }
}

// Fuente pequeña: color hueso (rampa de lino) con sombra negra.
function FONT_MakeSmall(g) {
  const gw = g.rows[0].length;
  const gh = g.rows.length;
  const w = gw + 1, h = FONT_CAPTOP + 7 + 4;
  const px = new Int16Array(w * h).fill(-1);
  const oy = FONT_CAPTOP + g.top;
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      if (g.rows[y][x] !== '#') continue;
      const yy = oy + y;
      if (yy < 0 || yy >= h) continue;
      // sombra
      const sx = x + 1, sy = yy + 1;
      if (sy < h && px[sy * w + sx] < 0) px[sy * w + sx] = 0;
    }
  }
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      if (g.rows[y][x] !== '#') continue;
      const yy = oy + y;
      if (yy < 0 || yy >= h) continue;
      const shade = yy <= FONT_CAPTOP + 1 ? 0 : yy <= FONT_CAPTOP + 4 ? 1 : 3;
      px[yy * w + x] = C(R_LINEN, shade);
    }
  }
  return V_MakePatch(w, h, px, 0, FONT_CAPTOP);
}

// Fuente grande: glifo al doble con degradado vertical y contorno oscuro.
function FONT_MakeBig(g) {
  const gw = g.rows[0].length;
  const gh = g.rows.length;
  const S = 2;
  const w = gw * S + 3, h = (FONT_CAPTOP + 7 + 4) * S + 2;
  const px = new Int16Array(w * h).fill(-1);
  const mask = new Uint8Array(w * h);
  const oy = (FONT_CAPTOP + g.top) * S + 1;
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      if (g.rows[y][x] !== '#') continue;
      for (let dy = 0; dy < S; dy++) {
        for (let dx = 0; dx < S; dx++) {
          const X = 1 + x * S + dx, Y = oy + y * S + dy;
          if (Y >= 0 && Y < h) mask[Y * w + X] = 1;
        }
      }
    }
  }
  // contorno + sombra
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (mask[y * w + x]) continue;
      let near = false;
      for (let dy = -1; dy <= 1 && !near; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const X = x + dx, Y = y + dy;
          if (X >= 0 && X < w && Y >= 0 && Y < h && mask[Y * w + X]) { near = true; break; }
        }
      }
      const X2 = x - 1, Y2 = y - 1;
      const shadow = X2 >= 0 && Y2 >= 0 && mask[Y2 * w + X2];
      if (near || shadow) px[y * w + x] = C(R_GRAY, 15);
    }
  }
  const capTop = FONT_CAPTOP * S + 1, capBot = (FONT_CAPTOP + 7) * S + 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue;
      let t = (y - capTop) / (capBot - capTop);
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      let shade = Math.round(t * 7);
      // bisel: borde superior más claro
      if (y > 0 && !mask[(y - 1) * w + x]) shade = Math.max(0, shade - 2);
      px[y * w + x] = C(R_LINEN, shade);
    }
  }
  return V_MakePatch(w, h, px, 0, FONT_CAPTOP * S + 1);
}

// =============================================================================
// Letras vectoriales de alta resolución
// -----------------------------------------------------------------------------
// Desde 640x400 el texto no se amplía desde la fuente de mapa de bits: cada
// glifo se rasteriza con una fuente del sistema a la resolución real (una
// unidad lógica = SCALE píxeles), con degradado en la rampa de lino (así las
// traducciones de color de V_Translations siguen valiendo), antialias hacia
// un contorno negro y sombra. El contorno y el relleno van en capas separadas
// para que el contorno de una letra no pise el relleno de la anterior. Las
// métricas se ajustan a las de la fuente clásica sobre un texto de muestra:
// la diagramación de menús, paneles y barra de estado no cambia.
// =============================================================================
const FONT_SERIF = '"Times New Roman", "Liberation Serif", "Nimbus Roman", "DejaVu Serif", Times, serif';
const FONT_SANS = 'Verdana, "DejaVu Sans", Tahoma, "Segoe UI", "Liberation Sans", Arial, sans-serif';

// cap: altura de mayúsculas (px lógicos); top: margen sobre ellas (acentos);
// shade0/shade1: degradado vertical en la rampa de lino; outline/shadow:
// contorno y sombra (px lógicos); space: ancho del espacio; track: separación
// extra entre letras; fit: fracción del ancho de la fuente clásica.
const FONT_STYLES = {
  small: { family: FONT_SERIF, weight: '700', cap: 7, top: 4, shade0: 0, shade1: 3, outline: 0.55, shadow: 0.55, space: 3.2, track: 0.45, fit: 0.97 },
  big: { family: FONT_SERIF, weight: '700', cap: 14, top: 9, shade0: 0, shade1: 7, outline: 0.9, shadow: 1, space: 5.5, track: 0.8, fit: 0.95, bevel: true },
  title: { family: FONT_SERIF, weight: '700', cap: 40, top: 12, shade0: 0, shade1: 9, outline: 1.6, shadow: 2.2, space: 14, track: 1.5, sx: 1.12, bevel: true }
};
// Compresión adicional de algunos glifos anchos (el % de la barra de estado).
const FONT_NARROW = { '%': 0.74, 'M': 0.92, 'W': 0.9, 'm': 0.94, 'w': 0.92, '—': 0.8 };
const FONT_SAMPLE = 'Desembarco en Pisagua. Batalla de Dolores; toma del Morro de Arica: ¡VICTORIA! 0123456789% ÁÉÍÓÚñ';
const FONT_LINEH = { small: 11, big: 20, title: 50 };

let FONT_canvas = null, FONT_ctx2d = null;
const FONT_metricsCache = new Map();

function FONT_HRAvailable() {
  if (FONT_ctx2d) return true;
  if (FONT_ctx2d === false) return false;
  try {
    if (typeof document === 'undefined' || !document.createElement) { FONT_ctx2d = false; return false; }
    FONT_canvas = document.createElement('canvas');
    FONT_canvas.width = 256; FONT_canvas.height = 256;
    const ctx = FONT_canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx || typeof ctx.measureText !== 'function' || typeof ctx.getImageData !== 'function') { FONT_ctx2d = false; return false; }
    FONT_ctx2d = ctx;
    return true;
  } catch (e) {
    FONT_ctx2d = false;
    return false;
  }
}

function FONT_SetFont(ctx, st, size) {
  ctx.font = st.weight + ' ' + size.toFixed(2) + 'px ' + st.family;
}

// Avance de la fuente clásica (px lógicos) de un carácter.
function FONT_ClassicAdvance(ch, big) {
  const g = FONT_GetGlyph(ch);
  if (!g) return big ? 7 : 4;
  const gw = g.rows[0].length;
  return big ? gw * 2 + 3 : gw + 1;
}

// Métricas por estilo y densidad: tamaño de letra que da la altura de
// mayúsculas pedida y compresión horizontal que iguala la fuente clásica.
function FONT_Metrics(key, D) {
  const id = key + '@' + D;
  let m = FONT_metricsCache.get(id);
  if (m) return m;
  const st = FONT_STYLES[key];
  const ctx = FONT_ctx2d;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  FONT_SetFont(ctx, st, 100);
  const capRatio = (ctx.measureText('H').actualBoundingBoxAscent || 66) / 100;
  const size = st.cap * D / capRatio;
  FONT_SetFont(ctx, st, size);
  let sx = st.sx || 1;
  if (!st.sx) {
    let classic = 0, natural = 0, count = 0;
    for (const ch of FONT_SAMPLE) {
      if (ch === ' ') continue;
      classic += FONT_ClassicAdvance(ch, key === 'big');
      natural += ctx.measureText(ch).width / D;
      count++;
    }
    sx = (classic * st.fit - count * st.track) / natural;
    sx = Math.max(0.72, Math.min(1.3, sx));
  }
  // cifras tabulares (los números de la barra de estado no bailan)
  let digitW = 0;
  for (let d = 0; d <= 9; d++) digitW = Math.max(digitW, ctx.measureText(String(d)).width);
  m = { size: size, sx: sx, digitW: digitW * sx };
  FONT_metricsCache.set(id, m);
  return m;
}

// Convierte una máscara de índices (-1 = transparente) en columnas de postes.
function FONT_Posts(px, w, h, x0, x1, y0, y1) {
  const cols = [];
  for (let x = x0; x <= x1; x++) {
    const posts = [];
    let y = y0;
    while (y <= y1) {
      while (y <= y1 && px[y * w + x] < 0) y++;
      if (y > y1) break;
      const start = y;
      while (y <= y1 && px[y * w + x] >= 0) y++;
      const data = new Uint8Array(y - start);
      for (let k = start; k < y; k++) data[k - start] = px[k * w + x];
      posts.push({ top: start - y0, len: y - start, pixels: data });
    }
    cols.push(posts);
  }
  return cols;
}

// Rasteriza un glifo. plain: sin contorno ni sombra (tinta sobre pergamino).
// Devuelve un patch de alta densidad: width/leftoffset/topoffset en unidades
// lógicas, pw/ph y columns (relleno) / ocolumns (contorno) en píxeles reales.
function FONT_MakeHR(ch, key, D, plain) {
  if (!FONT_HRAvailable()) return null;
  const st = FONT_STYLES[key];
  const m = FONT_Metrics(key, D);
  const ctx = FONT_ctx2d;
  FONT_SetFont(ctx, st, m.size);
  const isDigit = ch >= '0' && ch <= '9';
  const gsx = m.sx * (FONT_NARROW[ch] || 1);
  const natural = ctx.measureText(ch).width * gsx;
  const advPhys = isDigit ? m.digitW : natural;
  const r = plain ? 0 : Math.max(1, Math.round(st.outline * D));
  const sh = plain ? 0 : Math.max(1, Math.round(st.shadow * D));
  const pad = r + sh + 2 + Math.ceil(m.size * 0.08);
  const capTop = pad + st.top * D;
  const baseline = capTop + st.cap * D;
  const w = Math.ceil(advPhys + m.size * 0.35 + pad * 2);
  const h = Math.ceil(baseline + m.size * 0.34 + pad);
  if (FONT_canvas.width < w || FONT_canvas.height < h) {
    FONT_canvas.width = Math.max(FONT_canvas.width, w);
    FONT_canvas.height = Math.max(FONT_canvas.height, h);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);
  FONT_SetFont(ctx, st, m.size);
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  const ox = pad + (isDigit ? (advPhys - natural) / 2 : 0);
  ctx.setTransform(gsx, 0, 0, 1, ox, 0);
  ctx.fillText(ch, 0, baseline);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const data = ctx.getImageData(0, 0, w, h).data;
  const n = w * h;
  const alpha = new Float32Array(n);
  let any = false;
  for (let i = 0; i < n; i++) { const a = data[i * 4 + 3] / 255; alpha[i] = a; if (a > 0) any = true; }
  const fill = new Int16Array(n).fill(-1);
  const outl = new Int16Array(n).fill(-1);
  if (any) {
    const black = C(R_GRAY, 15);
    const span = baseline - capTop;
    const bev = Math.max(1, Math.round(D * 0.6));
    for (let y = 0; y < h; y++) {
      let t = (y + 0.5 - capTop) / span;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const base = st.shade0 + (st.shade1 - st.shade0) * t;
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const a = alpha[i];
        if (plain) {
          if (a >= 0.45) fill[i] = C(R_LINEN, Math.round(base));
          continue;
        }
        if (a <= 0.02) continue;
        let s = base;
        if (st.bevel && y >= bev && alpha[i - bev * w] < 0.3) s = Math.max(0, s - 2);
        s = s + (15 - s) * (1 - a) * 0.95;
        const q = Math.round(s);
        fill[i] = q >= 15 ? black : C(R_LINEN, q);
      }
    }
    if (!plain) {
      // contorno: dilatación circular de la silueta, más la sombra desplazada
      const offs = [];
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy <= r * r + r * 0.8) offs.push(dx, dy);
      }
      const mask = new Uint8Array(n);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (alpha[y * w + x] < 0.3) continue;
        for (let k = 0; k < offs.length; k += 2) {
          const xx = x + offs[k], yy = y + offs[k + 1];
          if (xx >= 0 && yy >= 0 && xx < w && yy < h) mask[yy * w + xx] = 1;
        }
      }
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const xs = x - sh, ys = y - sh;
        if (mask[i] || (xs >= 0 && ys >= 0 && mask[ys * w + xs])) outl[i] = black;
      }
    }
  }
  // recorte al contenido
  let x0 = w, x1 = -1, y0 = h, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (fill[i] >= 0 || outl[i] >= 0) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  const advance = advPhys / D + st.track;
  if (x1 < 0) {
    return { width: advance, height: 0, leftoffset: 0, topoffset: 0, density: D, pw: 0, ph: 0, columns: [], ocolumns: null };
  }
  return {
    width: advance,
    height: (y1 - y0 + 1) / D,
    leftoffset: (pad - x0) / D,
    topoffset: (capTop - y0) / D,
    density: D,
    pw: x1 - x0 + 1, ph: y1 - y0 + 1,
    columns: FONT_Posts(fill, w, h, x0, x1, y0, y1),
    ocolumns: plain ? null : FONT_Posts(outl, w, h, x0, x1, y0, y1)
  };
}
