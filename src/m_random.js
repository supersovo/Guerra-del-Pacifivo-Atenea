// =============================================================================
// m_random.js — Generador pseudoaleatorio por tabla (m_random.c)
// -----------------------------------------------------------------------------
// Como en DOOM, la simulación usa una tabla fija de 256 bytes recorrida con un
// índice. Esto hace el juego determinista (misma secuencia de entradas = misma
// partida), requisito para grabar y reproducir demos. La tabla se genera aquí
// con una semilla propia (no es la tabla de id Software).
// =============================================================================
'use strict';

const rndtable = (function () {
  const t = new Uint8Array(256);
  // Generador lineal de congruencia con semilla "1879".
  let s = 1879;
  const used = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    t[i] = (s >>> 16) & 255;
    used[t[i]]++;
  }
  t[0] = 0; // como en DOOM, la tabla comienza en 0
  return t;
})();

let rndindex = 0;    // para efectos no deterministas (menús, efectos visuales)
let prndindex = 0;   // para la simulación de juego (P_Random)

// P_Random: usado por la simulación (determinista).
function P_Random() {
  prndindex = (prndindex + 1) & 0xff;
  return rndtable[prndindex];
}

// M_Random: usado fuera de la simulación (menús, sonido, efectos).
function M_Random() {
  rndindex = (rndindex + 1) & 0xff;
  return rndtable[rndindex];
}

function M_ClearRandom() {
  rndindex = prndindex = 0;
}

// P_SubRandom: diferencia de dos aleatorios (-255..255), patrón típico de DOOM.
function P_SubRandom() {
  const r = P_Random();
  return r - P_Random();
}

// Generador con semilla para contenido procedural (texturas, sprites, mapas).
// No toca los índices de la simulación.
function M_SeededRNG(seed) {
  let s = (seed >>> 0) || 1;
  return function () {
    // xorshift32
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}
