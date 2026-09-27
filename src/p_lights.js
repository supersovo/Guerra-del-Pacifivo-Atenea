// =============================================================================
// p_lights.js — Efectos de luz de sector (p_lights.c)
// -----------------------------------------------------------------------------
// Parpadeo de incendios (Pisagua en llamas), destellos, luz pulsante.
// =============================================================================
'use strict';

const GLOWSPEED = 8;
const STROBEBRIGHT = 5;

function T_FireFlicker(flick) {
  if (--flick.count) return;
  const amount = (P_Random() & 3) * 16;
  if (flick.sector.lightlevel - amount < flick.minlight) flick.sector.lightlevel = flick.minlight;
  else flick.sector.lightlevel = flick.maxlight - amount;
  flick.count = 4;
}

function P_SpawnFireFlicker(sector) {
  sector.special = 0;
  const flick = { func: T_FireFlicker, sector: sector, maxlight: sector.lightlevel,
    minlight: P_FindMinSurroundingLight(sector, sector.lightlevel) + 16, count: 4 };
  P_AddThinker(flick);
}

function T_LightFlash(flash) {
  if (--flash.count) return;
  if (flash.sector.lightlevel === flash.maxlight) {
    flash.sector.lightlevel = flash.minlight;
    flash.count = (P_Random() & flash.mintime) + 1;
  } else {
    flash.sector.lightlevel = flash.maxlight;
    flash.count = (P_Random() & flash.maxtime) + 1;
  }
}

function P_SpawnLightFlash(sector) {
  sector.special = 0;
  const flash = { func: T_LightFlash, sector: sector, maxlight: sector.lightlevel,
    minlight: P_FindMinSurroundingLight(sector, sector.lightlevel), maxtime: 64, mintime: 7, count: 0 };
  flash.count = (P_Random() & flash.maxtime) + 1;
  P_AddThinker(flash);
}

function T_StrobeFlash(flash) {
  if (--flash.count) return;
  if (flash.sector.lightlevel === flash.minlight) {
    flash.sector.lightlevel = flash.maxlight;
    flash.count = flash.brighttime;
  } else {
    flash.sector.lightlevel = flash.minlight;
    flash.count = flash.darktime;
  }
}

function P_SpawnStrobeFlash(sector, fastOrSlow, inSync) {
  const flash = { func: T_StrobeFlash, sector: sector, darktime: fastOrSlow, brighttime: STROBEBRIGHT,
    maxlight: sector.lightlevel, minlight: P_FindMinSurroundingLight(sector, sector.lightlevel), count: 0 };
  if (flash.minlight === flash.maxlight) flash.minlight = 0;
  sector.special = 0;
  flash.count = inSync ? 1 : (P_Random() & 7) + 1;
  P_AddThinker(flash);
}

function T_Glow(g) {
  switch (g.direction) {
    case -1:
      g.sector.lightlevel -= GLOWSPEED;
      if (g.sector.lightlevel <= g.minlight) { g.sector.lightlevel += GLOWSPEED; g.direction = 1; }
      break;
    case 1:
      g.sector.lightlevel += GLOWSPEED;
      if (g.sector.lightlevel >= g.maxlight) { g.sector.lightlevel -= GLOWSPEED; g.direction = -1; }
      break;
  }
}

function P_SpawnGlowingLight(sector) {
  const g = { func: T_Glow, sector: sector, minlight: P_FindMinSurroundingLight(sector, sector.lightlevel),
    maxlight: sector.lightlevel, direction: -1 };
  P_AddThinker(g);
  sector.special = 0;
}

function EV_LightTurnOn(line, bright) {
  for (const sector of sectors) {
    if (sector.tag !== line.tag) continue;
    let b = bright;
    if (!b) {
      for (const templine of sector.lines) {
        const temp = getNextSector(templine, sector);
        if (temp && temp.lightlevel > b) b = temp.lightlevel;
      }
    }
    sector.lightlevel = b;
  }
}
