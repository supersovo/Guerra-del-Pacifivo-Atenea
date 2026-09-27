// =============================================================================
// tables.js — Ángulos BAM y tablas trigonométricas (tables.c)
// -----------------------------------------------------------------------------
// DOOM representa los ángulos como enteros sin signo de 32 bits: 0x40000000 son
// 90 grados. Así los desbordes "dan la vuelta" solos. Aquí se mantiene esa idea
// usando el operador >>> 0 de JavaScript para forzar enteros de 32 bits.
// =============================================================================
'use strict';

const ANG45 = 0x20000000;
const ANG90 = 0x40000000;
const ANG180 = 0x80000000;
const ANG270 = 0xc0000000;
const ANGLE_MAX = 0xffffffff;
const ANG1 = (ANG45 / 45) >>> 0;
const ANG5 = (ANG90 / 18) >>> 0;

const FINEANGLES = 8192;
const FINEMASK = FINEANGLES - 1;
const ANGLETOFINESHIFT = 19;
const ANGLETOSKYSHIFT = 22;       // 1024 columnas de cielo por vuelta completa

const RAD2BAM = 2147483648 / Math.PI;
const BAM2RAD = Math.PI / 2147483648;

// Seno fino: 5/4 de vuelta para que el coseno sea una simple vista desplazada.
const finesine = new Float64Array(FINEANGLES * 5 / 4);
for (let i = 0; i < finesine.length; i++) {
  finesine[i] = Math.sin((i + 0.5) * 2 * Math.PI / FINEANGLES);
}
const finecosine = finesine.subarray(FINEANGLES / 4);

// Tangente fina: de -90 a +90 grados (FINEANGLES/2 entradas).
const finetangent = new Float64Array(FINEANGLES / 2);
for (let i = 0; i < FINEANGLES / 2; i++) {
  finetangent[i] = Math.tan((i - FINEANGLES / 4 + 0.5) * 2 * Math.PI / FINEANGLES);
}

// Conversión de ángulos --------------------------------------------------------
function RadToBAM(r) {
  // ToUint32 maneja correctamente los negativos.
  return (r * RAD2BAM) >>> 0;
}
function BAMToRad(a) {
  return (a >>> 0) * BAM2RAD;
}
function DegToBAM(d) {
  return RadToBAM(d * Math.PI / 180);
}
// Diferencia con signo entre dos ángulos BAM (en BAM, rango ±2^31).
function AngleDelta(a, b) {
  return ((a - b) | 0);
}
function FineSin(a) { return finesine[(a >>> 0) >>> ANGLETOFINESHIFT]; }
function FineCos(a) { return finecosine[(a >>> 0) >>> ANGLETOFINESHIFT]; }

// R_PointToAngle2: ángulo BAM desde (x1,y1) hacia (x2,y2).
function R_PointToAngle2(x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  if (dx === 0 && dy === 0) return 0;
  return (Math.atan2(dy, dx) * RAD2BAM) >>> 0;
}

// P_AproxDistance: aproximación clásica de distancia usada por la IA.
function P_AproxDistance(dx, dy) {
  dx = Math.abs(dx);
  dy = Math.abs(dy);
  if (dx < dy) return dx + dy - dx / 2;
  return dx + dy - dy / 2;
}
