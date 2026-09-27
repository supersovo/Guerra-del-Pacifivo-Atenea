// =============================================================================
// r_data.js — Datos del renderizador: texturas, flats, sprites (r_data.c)
// -----------------------------------------------------------------------------
// Las texturas de muro se leen de los lumps entre T_START/T_END, los flats
// (64x64) entre F_START/F_END y los fotogramas de sprite entre S_START/S_END.
// Los nombres de sprite siguen la convención de DOOM: NNNNFR donde NNNN es el
// nombre (4 letras), F la letra del fotograma y R la rotación (0 = todas,
// 1..8 = ángulos). Ej.: "GUARA1" es el Guardia Nacional, cuadro A, de frente.
// =============================================================================
'use strict';

let textures = [null];           // índice 0 = "sin textura" ('-')
let texturelookup = new Map();
let texturetranslation = [];
let flats = [];
let flatlookup = new Map();
let flattranslation = [];
let skyflatnum = -1;
let sprites = [];                // sprites[spritenum] = { name, frames: [...] }
let spritenames = [];            // nombres de 4 letras, índice = spritenum
let spritelookup = new Map();

function R_InitTextures() {
  textures = [null];
  texturelookup = new Map();
  const list = W_LumpsBetween('T_START', 'T_END');
  for (const n of list) {
    const info = lumpinfo[n];
    const t = info.data;
    t.name = info.name;
    t.index = textures.length;
    t.isPow2 = (t.height & (t.height - 1)) === 0;
    textures.push(t);
    texturelookup.set(info.name, t.index);
  }
  texturetranslation = new Int32Array(textures.length);
  for (let i = 0; i < textures.length; i++) texturetranslation[i] = i;
}

function R_InitFlats() {
  flats = [];
  flatlookup = new Map();
  const list = W_LumpsBetween('F_START', 'F_END');
  for (const n of list) {
    const info = lumpinfo[n];
    flatlookup.set(info.name, flats.length);
    flats.push(info.data);
  }
  flattranslation = new Int32Array(flats.length);
  for (let i = 0; i < flats.length; i++) flattranslation[i] = i;
  skyflatnum = R_FlatNumForName('F_SKY1');
}

function R_CheckTextureNumForName(name) {
  if (!name || name[0] === '-') return 0;
  const n = texturelookup.get(name.toUpperCase());
  return n === undefined ? -1 : n;
}

function R_TextureNumForName(name) {
  const n = R_CheckTextureNumForName(name);
  if (n < 0) {
    console.warn('R_TextureNumForName: ' + name + ' no encontrada');
    return texturelookup.get('ERROR') || 1;
  }
  return n;
}

function R_FlatNumForName(name) {
  const n = flatlookup.get(String(name).toUpperCase());
  if (n === undefined) {
    console.warn('R_FlatNumForName: ' + name + ' no encontrado');
    return flatlookup.get('ERRORF') || 0;
  }
  return n;
}

// Devuelve la columna (Uint8Array) de una textura sólida.
function R_GetColumn(tex, col) {
  const t = textures[tex];
  const w = t.width;
  col = ((col % w) + w) % w;
  return t.columns[col];
}

// --- Sprites (R_InitSpriteDefs) ------------------------------------------------------
function R_InitSprites() {
  sprites = [];
  spritenames = [];
  spritelookup = new Map();
  const list = W_LumpsBetween('S_START', 'S_END');
  const temp = new Map();
  for (const n of list) {
    const name = lumpinfo[n].name;
    const base = name.substring(0, 4);
    let def = temp.get(base);
    if (!def) { def = { name: base, frames: [] }; temp.set(base, def); }
    install(def, name.charCodeAt(4) - 65, name.charCodeAt(5) - 48, n, false);
    if (name.length >= 8) install(def, name.charCodeAt(6) - 65, name.charCodeAt(7) - 48, n, true);
  }
  function install(def, frame, rot, lump, flip) {
    let f = def.frames[frame];
    if (!f) { f = { rotate: -1, lump: new Int32Array(8).fill(-1), flip: new Uint8Array(8) }; def.frames[frame] = f; }
    if (rot === 0) {
      f.rotate = 0;
      for (let r = 0; r < 8; r++) { f.lump[r] = lump; f.flip[r] = flip ? 1 : 0; }
    } else {
      f.rotate = 1;
      f.lump[rot - 1] = lump;
      f.flip[rot - 1] = flip ? 1 : 0;
    }
  }
  for (const def of temp.values()) {
    // real[i]: el cuadro i existe (los que faltan se rellenan con el primero)
    def.real = new Uint8Array(def.frames.length);
    for (let i = 0; i < def.frames.length; i++) {
      const f = def.frames[i];
      if (!f) { def.frames[i] = def.frames[0]; continue; }
      def.real[i] = 1;
      for (let r = 0; r < 8; r++) {
        if (f.lump[r] < 0) f.lump[r] = f.lump[0] >= 0 ? f.lump[0] : f.lump.find(function (x) { return x >= 0; });
      }
    }
    spritelookup.set(def.name, sprites.length);
    spritenames.push(def.name);
    sprites.push(def);
  }
}

function R_SpriteNumForName(name) {
  const n = spritelookup.get(name);
  if (n === undefined) throw new Error('R_SpriteNumForName: sprite ' + name + ' no existe');
  return n;
}

// --- Animaciones de texturas y flats (p_spec.c: P_InitPicAnims) -----------------------
const animdefs = [
  // [¿es textura?, primero, último, velocidad en tics]
  [false, 'AGUA1', 'AGUA4', 10],
  [false, 'BRASA1', 'BRASA3', 8],
  [true, 'FUEGO1', 'FUEGO3', 6],
  [true, 'BANDER1', 'BANDER3', 8],
  [true, 'OLAS1', 'OLAS4', 10]
];
let anims = [];

function R_InitPicAnims() {
  anims = [];
  for (const d of animdefs) {
    let a;
    if (d[0]) {
      const b = R_CheckTextureNumForName(d[1]), e = R_CheckTextureNumForName(d[2]);
      if (b <= 0 || e <= 0) continue;
      a = { istexture: true, basepic: b, picnum: e, numpics: e - b + 1, speed: d[3] };
    } else {
      const b = flatlookup.get(d[1]), e = flatlookup.get(d[2]);
      if (b === undefined || e === undefined) continue;
      a = { istexture: false, basepic: b, picnum: e, numpics: e - b + 1, speed: d[3] };
    }
    anims.push(a);
  }
}

function R_UpdateAnimations(time) {
  for (const a of anims) {
    for (let i = a.basepic; i < a.basepic + a.numpics; i++) {
      const pic = a.basepic + ((Math.floor(time / a.speed) + i) % a.numpics);
      if (a.istexture) texturetranslation[i] = pic;
      else flattranslation[i] = pic;
    }
  }
}

function R_InitData() {
  R_InitTextures();
  R_InitFlats();
  R_InitSprites();
  R_InitPicAnims();
  colormaps = W_CacheLumpName('COLORMAP');
}
