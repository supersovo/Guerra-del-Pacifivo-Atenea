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

// Lump diferido: se construye la primera vez que se consulta. Así el arranque
// no paga recursos caros (los sprites de la fundición y los retratos del
// soldado): W_WarmStep los va construyendo en segundo plano, en el orden en
// que se registraron, mientras se está en la portada, los menús o el parte.
const W_pending = [];
let W_pendingPos = 0, W_built = 0;

function W_AddLazyLump(name, build, kind) {
  const num = W_AddLump(name, null, kind);
  lumpinfo[num].build = build;
  W_pending.push(num);
  return num;
}

// Construye lumps pendientes durante budgetMs; devuelve cuántos quedan.
function W_WarmStep(budgetMs) {
  const t0 = performance.now();
  while (W_pendingPos < W_pending.length) {
    const num = W_pending[W_pendingPos++];
    if (!lumpinfo[num].build) continue;
    W_CacheLumpNum(num);
    if (performance.now() - t0 >= budgetMs) break;
  }
  return W_pending.length - W_pendingPos;
}

function W_WarmAll() { return W_WarmStep(Infinity); }

// Fracción de lumps diferidos ya construidos (0..1).
function W_WarmProgress() {
  return W_pending.length ? W_built / W_pending.length : 1;
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
  const info = lumpinfo[num];
  if (info.build) {
    const build = info.build;
    info.build = null;
    info.data = build();
    W_built++;
  }
  return info.data;
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
