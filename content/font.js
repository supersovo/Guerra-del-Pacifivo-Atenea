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
