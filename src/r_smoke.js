// =============================================================================
// r_smoke.js — Humo de pólvora negra (extensión de Atenea)
// -----------------------------------------------------------------------------
// Cada disparo de fusil, revólver, Gatling o cañón deja una bocanada de humo
// blanco que sube, deriva con el viento del mapa y se disipa: en 1879 la
// pólvora negra cubría el campo de batalla. Son partículas del renderizador,
// no objetos de la simulación: no usan P_Random, no entran en el blockmap ni
// alteran el juego. Se proyectan como vissprites semitransparentes que se
// mezclan con lo que hay detrás mediante las tablas de transparencia de la
// paleta (PAL_TRAN, como el TRANMAP de Boom); el COLORMAP les aplica la luz y
// la bruma igual que a cualquier sprite.
// =============================================================================
'use strict';

const SMOKE_MAX = 220;          // bocanadas a la vez (las más viejas ceden su lugar)
const SMOKE_RANGE = 5000;       // más lejos del jugador no se generan
let smoke = [];
let smokeSeed = 12345;
let smokeSprites = null;

function R_SmokeRand() {
  smokeSeed = (Math.imul(smokeSeed, 1103515245) + 12345) >>> 0;
  return (smokeSeed >>> 8) / 16777216;
}

function R_ClearSmoke() {
  smoke = [];
  smokeSprites = null;
}

// kind: 'fusil' (también revólver y Gatling) o 'canon'. angle: hacia dónde
// apunta el arma (BAM); la bocanada sale en esa dirección y se frena.
function R_SpawnSmoke(x, y, z, angle, kind) {
  const pl = players[0] && players[0].mo;
  if (!pl || Math.abs(x - pl.x) + Math.abs(y - pl.y) > SMOKE_RANGE) return;
  if (!smokeSprites) {
    const a = spritelookup.get('PSMK'), b = spritelookup.get('PSMG');
    if (a === undefined || b === undefined) return;
    smokeSprites = { fusil: a, canon: b };
  }
  if (smoke.length >= SMOKE_MAX) smoke.shift();
  const big = kind === 'canon';
  const an = angle * BAM2RAD;
  const sp = (big ? 2.4 : 1.4) * (0.8 + R_SmokeRand() * 0.4);
  smoke.push({
    x: x, y: y, z: z,
    vx: Math.cos(an) * sp + (R_SmokeRand() - 0.5) * 0.3, vy: Math.sin(an) * sp + (R_SmokeRand() - 0.5) * 0.3,
    vz: (big ? 0.45 : 0.28) + R_SmokeRand() * 0.18,
    age: 0, life: big ? 130 + R_SmokeRand() * 40 : 70 + R_SmokeRand() * 26,
    sprite: big ? smokeSprites.canon : smokeSprites.fusil, frame: 0, angle: 0,
    flags: MF_TRANSLUCENT, translation: null, oldvalid: false,
    sector: R_PointInSubsector(x, y).sector
  });
}

// Humo en la boca del arma de un soldado (dist adelante, a la altura h).
function P_MuzzleSmoke(actor, dist, h, kind) {
  R_SpawnSmoke(actor.x + dist * FineCos(actor.angle), actor.y + dist * FineSin(actor.angle), actor.z + h, actor.angle, kind);
}

// Un tic: frenado, deriva con el viento (levelinfo.wind, unidades por tic) y ascenso.
function R_SmokeTicker() {
  if (!smoke.length) return;
  const wind = (levelinfo && levelinfo.wind) || [0.16, 0.07];
  let n = 0;
  for (let i = 0; i < smoke.length; i++) {
    const p = smoke[i];
    if (++p.age >= p.life) continue;
    p.vx = p.vx * 0.93 + wind[0] * 0.07;
    p.vy = p.vy * 0.93 + wind[1] * 0.07;
    p.vz *= 0.985;
    p.x += p.vx; p.y += p.vy; p.z += p.vz;
    p.frame = Math.min(5, Math.floor(p.age / p.life * 6));
    smoke[n++] = p;
  }
  smoke.length = n;
}

// Proyecta las bocanadas visibles (las muy cercanas a la cámara se omiten:
// taparían toda la vista).
function R_AddSmokeSprites() {
  for (let i = 0; i < smoke.length; i++) {
    const p = smoke[i];
    const tz = (p.x - viewx) * viewcos + (p.y - viewy) * viewsin;
    if (tz < 28) continue;
    const lightnum = (p.sector.lightlevel >> LIGHTSEGSHIFT) + extralight;
    spritelights = scalelight[clamp(lightnum, 0, LIGHTLEVELS - 1)];
    R_ProjectSprite(p);
  }
}
