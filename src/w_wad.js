// =============================================================================
// w_wad.js — Sistema de recursos "WAD" (w_wad.c)
// -----------------------------------------------------------------------------
// En DOOM todos los recursos (gráficos, sonidos, mapas) viven en un archivo WAD:
// un directorio de "lumps" con nombre de hasta 8 caracteres. El motor Atenea
// construye su IWAD en memoria durante el arranque (los recursos son generados
// proceduralmente), pero el resto del motor los consulta exactamente como DOOM:
// W_GetNumForName / W_CacheLumpName, con marcadores S_START/S_END, F_START/F_END.
// =============================================================================
'use strict';

const lumpinfo = [];                 // [{ name, data, kind }]
const lumphash = new Map();          // nombre -> último índice (los PWAD sobrescriben)

function W_AddLump(name, data, kind) {
  name = String(name).toUpperCase();
  if (name.length > 8) throw new Error('W_AddLump: nombre de lump demasiado largo: ' + name);
  const num = lumpinfo.length;
  lumpinfo.push({ name: name, data: data, kind: kind || 'data' });
  lumphash.set(name, num);
  return num;
}

function W_AddMarker(name) {
  return W_AddLump(name, null, 'marker');
}

function W_CheckNumForName(name) {
  const n = lumphash.get(String(name).toUpperCase());
  return n === undefined ? -1 : n;
}

function W_GetNumForName(name) {
  const n = W_CheckNumForName(name);
  if (n < 0) throw new Error('W_GetNumForName: ' + name + ' no encontrado');
  return n;
}

function W_CacheLumpNum(num) {
  if (num < 0 || num >= lumpinfo.length) throw new Error('W_CacheLumpNum: ' + num + ' >= numlumps');
  return lumpinfo[num].data;
}

function W_CacheLumpName(name) {
  return W_CacheLumpNum(W_GetNumForName(name));
}

function W_NumLumps() {
  return lumpinfo.length;
}

// Devuelve los índices de lumps entre dos marcadores (p.ej. S_START..S_END).
function W_LumpsBetween(start, end) {
  const out = [];
  const a = W_GetNumForName(start), b = W_GetNumForName(end);
  for (let i = a + 1; i < b; i++) if (lumpinfo[i].kind !== 'marker') out.push(i);
  return out;
}
