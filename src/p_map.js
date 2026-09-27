// =============================================================================
// p_map.js — Movimiento, colisiones y disparos (p_map.c)
// -----------------------------------------------------------------------------
// P_CheckPosition/P_TryMove comprueban si un objeto cabe en una posición
// usando el blockmap; P_SlideMove hace deslizar al jugador contra los muros;
// P_AimLineAttack y P_LineAttack implementan los disparos instantáneos
// ("hitscan") de fusiles y revólveres; P_RadiusAttack, las explosiones.
// =============================================================================
'use strict';

let tmthing = null, tmflags = 0, tmx = 0, tmy = 0;
const tmbbox = [0, 0, 0, 0];
let floatok = false;
let tmfloorz = 0, tmceilingz = 0, tmdropoffz = 0;
let ceilingline = null;
let spechit = [];

// --- Comprobación de posición --------------------------------------------------------------
function PIT_CheckLine(ld) {
  if (tmbbox[BOXRIGHT] <= ld.bbox[BOXLEFT] || tmbbox[BOXLEFT] >= ld.bbox[BOXRIGHT] ||
      tmbbox[BOXTOP] <= ld.bbox[BOXBOTTOM] || tmbbox[BOXBOTTOM] >= ld.bbox[BOXTOP]) return true;
  if (P_BoxOnLineSide(tmbbox, ld) !== -1) return true;
  // La caja cruza la línea.
  if (!ld.backsector) return false;       // una cara: muro
  if (!(tmthing.flags & MF_MISSILE)) {
    if (ld.flags & ML_BLOCKING) return false;
    if (!tmthing.player && (ld.flags & ML_BLOCKMONSTERS)) return false;
  }
  if (tmthing.flags & MF_MISSILE) P_LineOpeningTrace(ld);
  else P_LineOpening(ld);
  if (opentop < tmceilingz) { tmceilingz = opentop; ceilingline = ld; }
  if (openbottom > tmfloorz) tmfloorz = openbottom;
  if (lowfloor < tmdropoffz) tmdropoffz = lowfloor;
  if (ld.special) spechit.push(ld);
  return true;
}

function PIT_CheckThing(thing) {
  if (!(thing.flags & (MF_SOLID | MF_SPECIAL | MF_SHOOTABLE))) return true;
  const blockdist = thing.radius + tmthing.radius;
  if (Math.abs(thing.x - tmx) >= blockdist || Math.abs(thing.y - tmy) >= blockdist) return true;
  if (thing === tmthing) return true;
  // Compañeros de armas: el jugador y la tropa chilena se abren paso entre sí.
  if (B_SameFaction(tmthing, thing) && (tmthing.player || thing.player)) return true;
  if (tmthing.flags & MF_MISSILE) {
    if (tmthing.z > thing.z + thing.height) return true;   // pasa por encima
    if (tmthing.z + tmthing.height < thing.z) return true; // pasa por debajo
    if (tmthing.target && (thing === tmthing.target)) return true; // no dañar al tirador
    if (tmthing.target && B_SameFaction(thing, tmthing.target)) return true; // sin fuego amigo
    if (!(thing.flags & MF_SHOOTABLE)) return !(thing.flags & MF_SOLID);
    const damage = ((P_Random() % 8) + 1) * tmthing.info.damage;
    P_DamageMobj(thing, tmthing, tmthing.target, damage);
    return false;
  }
  if (thing.flags & MF_SPECIAL) {
    const solid = thing.flags & MF_SOLID;
    if (tmflags & MF_PICKUP) P_TouchSpecialThing(thing, tmthing);
    return !solid;
  }
  return !(thing.flags & MF_SOLID);
}

function P_CheckPosition(thing, x, y) {
  tmthing = thing;
  tmflags = thing.flags;
  tmx = x; tmy = y;
  tmbbox[BOXTOP] = y + thing.radius;
  tmbbox[BOXBOTTOM] = y - thing.radius;
  tmbbox[BOXRIGHT] = x + thing.radius;
  tmbbox[BOXLEFT] = x - thing.radius;
  const newsubsec = R_PointInSubsector(x, y);
  ceilingline = null;
  tmfloorz = tmdropoffz = newsubsec.sector.floorheight;
  tmceilingz = newsubsec.sector.ceilingheight;
  validcount++;
  spechit = [];
  if (tmflags & MF_NOCLIP) return true;
  let xl = Math.floor((tmbbox[BOXLEFT] - bmaporgx - MAXRADIUS) / MAPBLOCKSIZE);
  let xh = Math.floor((tmbbox[BOXRIGHT] - bmaporgx + MAXRADIUS) / MAPBLOCKSIZE);
  let yl = Math.floor((tmbbox[BOXBOTTOM] - bmaporgy - MAXRADIUS) / MAPBLOCKSIZE);
  let yh = Math.floor((tmbbox[BOXTOP] - bmaporgy + MAXRADIUS) / MAPBLOCKSIZE);
  for (let bx = xl; bx <= xh; bx++) {
    for (let by = yl; by <= yh; by++) {
      if (!P_BlockThingsIterator(bx, by, PIT_CheckThing)) return false;
    }
  }
  xl = Math.floor((tmbbox[BOXLEFT] - bmaporgx) / MAPBLOCKSIZE);
  xh = Math.floor((tmbbox[BOXRIGHT] - bmaporgx) / MAPBLOCKSIZE);
  yl = Math.floor((tmbbox[BOXBOTTOM] - bmaporgy) / MAPBLOCKSIZE);
  yh = Math.floor((tmbbox[BOXTOP] - bmaporgy) / MAPBLOCKSIZE);
  for (let bx = xl; bx <= xh; bx++) {
    for (let by = yl; by <= yh; by++) {
      if (!P_BlockLinesIterator(bx, by, PIT_CheckLine)) return false;
    }
  }
  return true;
}

function P_TryMove(thing, x, y) {
  floatok = false;
  if (!P_CheckPosition(thing, x, y)) return false;
  if (!(thing.flags & MF_NOCLIP)) {
    if (tmceilingz - tmfloorz < thing.height) return false;
    floatok = true;
    if (!(thing.flags & MF_TELEPORT) && tmceilingz - thing.z < thing.height) return false;
    if (!(thing.flags & MF_TELEPORT) && tmfloorz - thing.z > 24) return false;
    if (!(thing.flags & (MF_DROPOFF | MF_FLOAT)) && tmfloorz - tmdropoffz > 24) return false;
  }
  P_UnsetThingPosition(thing);
  const oldx = thing.x, oldy = thing.y;
  thing.floorz = tmfloorz;
  thing.ceilingz = tmceilingz;
  thing.x = x;
  thing.y = y;
  P_SetThingPosition(thing);
  if (!(thing.flags & (MF_TELEPORT | MF_NOCLIP))) {
    const hits = spechit;
    for (let i = hits.length - 1; i >= 0; i--) {
      const ld = hits[i];
      const side = P_PointOnLineSide(thing.x, thing.y, ld);
      const oldside = P_PointOnLineSide(oldx, oldy, ld);
      if (side !== oldside && ld.special) P_CrossSpecialLine(ld, oldside, thing);
    }
  }
  return true;
}

// P_ThingHeightClip: reajusta pisos/techos tras mover un sector.
function P_ThingHeightClip(thing) {
  const onfloor = thing.z === thing.floorz;
  P_CheckPosition(thing, thing.x, thing.y);
  thing.floorz = tmfloorz;
  thing.ceilingz = tmceilingz;
  if (onfloor) thing.z = thing.floorz;
  else if (thing.z + thing.height > thing.ceilingz) thing.z = thing.ceilingz - thing.height;
  return thing.ceilingz - thing.floorz >= thing.height;
}

// --- Deslizamiento contra muros (P_SlideMove) --------------------------------------------
let bestslidefrac = 0, secondslidefrac = 0;
let bestslideline = null, secondslideline = null;
let slidemo = null;
let tmxmove = 0, tmymove = 0;

function P_HitSlideLine(ld) {
  if (ld.slopetype === ST_HORIZONTAL) { tmymove = 0; return; }
  if (ld.slopetype === ST_VERTICAL) { tmxmove = 0; return; }
  const side = P_PointOnLineSide(slidemo.x, slidemo.y, ld);
  let lineangle = R_PointToAngle2(0, 0, ld.dx, ld.dy);
  if (side === 1) lineangle = (lineangle + ANG180) >>> 0;
  const moveangle = R_PointToAngle2(0, 0, tmxmove, tmymove);
  let deltaangle = (moveangle - lineangle) >>> 0;
  if (deltaangle > ANG180) deltaangle = (deltaangle + ANG180) >>> 0;
  const movelen = P_AproxDistance(tmxmove, tmymove);
  const newlen = movelen * FineCos(deltaangle);
  tmxmove = newlen * FineCos(lineangle);
  tmymove = newlen * FineSin(lineangle);
}

function PTR_SlideTraverse(inx) {
  const li = inx.line;
  if (!(li.flags & ML_TWOSIDED)) {
    if (P_PointOnLineSide(slidemo.x, slidemo.y, li)) return true;
    return isblocking();
  }
  P_LineOpening(li);
  if (li.flags & ML_BLOCKING) return isblocking();
  if (openrange < slidemo.height) return isblocking();
  if (opentop - slidemo.z < slidemo.height) return isblocking();
  if (openbottom - slidemo.z > 24) return isblocking();
  return true;
  function isblocking() {
    if (inx.frac < bestslidefrac) {
      secondslidefrac = bestslidefrac;
      secondslideline = bestslideline;
      bestslidefrac = inx.frac;
      bestslideline = li;
    }
    return false;
  }
}

function P_SlideMove(mo) {
  slidemo = mo;
  let hitcount = 0;
  for (;;) {
    if (++hitcount === 3) { stairstep(); return; }
    let leadx, leady, trailx, traily;
    if (mo.momx > 0) { leadx = mo.x + mo.radius; trailx = mo.x - mo.radius; }
    else { leadx = mo.x - mo.radius; trailx = mo.x + mo.radius; }
    if (mo.momy > 0) { leady = mo.y + mo.radius; traily = mo.y - mo.radius; }
    else { leady = mo.y - mo.radius; traily = mo.y + mo.radius; }
    bestslidefrac = 1.0001;
    P_PathTraverse(leadx, leady, leadx + mo.momx, leady + mo.momy, PT_ADDLINES, PTR_SlideTraverse);
    P_PathTraverse(trailx, leady, trailx + mo.momx, leady + mo.momy, PT_ADDLINES, PTR_SlideTraverse);
    P_PathTraverse(leadx, traily, leadx + mo.momx, traily + mo.momy, PT_ADDLINES, PTR_SlideTraverse);
    if (bestslidefrac === 1.0001) { stairstep(); return; }
    bestslidefrac -= 1 / 32;
    if (bestslidefrac > 0) {
      const newx = mo.momx * bestslidefrac, newy = mo.momy * bestslidefrac;
      if (!P_TryMove(mo, mo.x + newx, mo.y + newy)) { stairstep(); return; }
    }
    bestslidefrac = 1 - (bestslidefrac + 1 / 32);
    if (bestslidefrac > 1) bestslidefrac = 1;
    if (bestslidefrac <= 0) return;
    tmxmove = mo.momx * bestslidefrac;
    tmymove = mo.momy * bestslidefrac;
    P_HitSlideLine(bestslideline);
    mo.momx = tmxmove;
    mo.momy = tmymove;
    if (P_TryMove(mo, mo.x + tmxmove, mo.y + tmymove)) return;
  }
  function stairstep() {
    if (!P_TryMove(mo, mo.x, mo.y + mo.momy)) P_TryMove(mo, mo.x + mo.momx, mo.y);
  }
}

// --- Disparos instantáneos ------------------------------------------------------------------
let linetarget = null;
let shootthing = null;
let shootz = 0;
let la_damage = 0;
let attackrange = 0;
let aimslope = 0;
let topslope = 0, bottomslope = 0;

function PTR_AimTraverse(inx) {
  if (inx.isaline) {
    const li = inx.line;
    if (!(li.flags & ML_TWOSIDED)) return false;
    P_LineOpeningTrace(li);
    if (openbottom >= opentop) return false;
    const dist = attackrange * inx.frac;
    if (dist <= 0) return true;
    if (li.frontsector.floorheight !== li.backsector.floorheight) {
      const slope = (openbottom - shootz) / dist;
      if (slope > bottomslope) bottomslope = slope;
    }
    if (li.frontsector.ceilingheight !== li.backsector.ceilingheight && opentop < 1e8) {
      const slope = (opentop - shootz) / dist;
      if (slope < topslope) topslope = slope;
    }
    if (topslope <= bottomslope) return false;
    return true;
  }
  const th = inx.thing;
  if (th === shootthing) return true;
  if (!(th.flags & MF_SHOOTABLE)) return true;
  if (B_SameFaction(th, shootthing)) return true;   // no se apunta a los propios
  const dist = attackrange * inx.frac;
  if (dist <= 0) return true;
  let thingtopslope = (th.z + th.height - shootz) / dist;
  if (thingtopslope < bottomslope) return true;
  let thingbottomslope = (th.z - shootz) / dist;
  if (thingbottomslope > topslope) return true;
  if (thingtopslope > topslope) thingtopslope = topslope;
  if (thingbottomslope < bottomslope) thingbottomslope = bottomslope;
  aimslope = (thingtopslope + thingbottomslope) / 2;
  linetarget = th;
  return false;
}

function PTR_ShootTraverse(inx) {
  if (inx.isaline) {
    const li = inx.line;
    if (li.special) P_ShootSpecialLine(shootthing, li);
    let hitline = false;
    if (!(li.flags & ML_TWOSIDED)) hitline = true;
    else {
      P_LineOpeningTrace(li);
      const dist = attackrange * inx.frac;
      if (li.frontsector.floorheight !== li.backsector.floorheight) {
        if ((openbottom - shootz) / dist > aimslope) hitline = true;
      }
      if (!hitline && li.frontsector.ceilingheight !== li.backsector.ceilingheight && opentop < 1e8) {
        if ((opentop - shootz) / dist < aimslope) hitline = true;
      }
      if (!hitline) return true;
    }
    // Impacto en un muro: nube de polvo un poco antes del punto.
    const frac = inx.frac - 4 / attackrange;
    const x = trace.x + trace.dx * frac;
    const y = trace.y + trace.dy * frac;
    const z = shootz + aimslope * (frac * attackrange);
    // No se dispara al cielo: por encima del muro no hay impacto visible.
    if (li.frontsector.ceilingpic === skyflatnum && z > li.frontsector.ceilingheight) return false;
    P_SpawnPuff(x, y, z);
    return false;
  }
  const th = inx.thing;
  if (th === shootthing) return true;
  if (!(th.flags & MF_SHOOTABLE)) return true;
  if (B_SameFaction(th, shootthing)) return true;   // la bala pasa junto a los propios
  const dist = attackrange * inx.frac;
  const thingtopslope = (th.z + th.height - shootz) / dist;
  if (thingtopslope < aimslope) return true;
  const thingbottomslope = (th.z - shootz) / dist;
  if (thingbottomslope > aimslope) return true;
  const frac = inx.frac - 10 / attackrange;
  const x = trace.x + trace.dx * frac;
  const y = trace.y + trace.dy * frac;
  const z = shootz + aimslope * (frac * attackrange);
  if (th.flags & MF_NOBLOOD) P_SpawnPuff(x, y, z);
  else P_SpawnBlood(x, y, z, la_damage);
  if (la_damage) P_DamageMobj(th, shootthing, shootthing, la_damage);
  return false;
}

function P_AimLineAttack(t1, angle, distance) {
  angle = angle >>> 0;
  shootthing = t1;
  const x2 = t1.x + distance * FineCos(angle);
  const y2 = t1.y + distance * FineSin(angle);
  shootz = t1.z + (t1.height / 2) + 8;
  topslope = 100 / 160;
  bottomslope = -100 / 160;
  attackrange = distance;
  linetarget = null;
  P_PathTraverse(t1.x, t1.y, x2, y2, PT_ADDLINES | PT_ADDTHINGS, PTR_AimTraverse);
  if (linetarget) return aimslope;
  return 0;
}

function P_LineAttack(t1, angle, distance, slope, damage) {
  angle = angle >>> 0;
  shootthing = t1;
  la_damage = damage;
  const x2 = t1.x + distance * FineCos(angle);
  const y2 = t1.y + distance * FineSin(angle);
  shootz = t1.z + (t1.height / 2) + 8;
  attackrange = distance;
  aimslope = slope;
  P_PathTraverse(t1.x, t1.y, x2, y2, PT_ADDLINES | PT_ADDTHINGS, PTR_ShootTraverse);
}

// --- Usar (abrir puertas, accionar palancas) --------------------------------------------
let usething = null;

function PTR_UseTraverse(inx) {
  const li = inx.line;
  if (!li.special) {
    P_LineOpening(li);
    if (openrange <= 0) {
      S_StartSound(usething, 'noway');
      return false;
    }
    return true;
  }
  let side = 0;
  if (P_PointOnLineSide(usething.x, usething.y, li) === 1) side = 1;
  P_UseSpecialLine(usething, li, side);
  return false;
}

function P_UseLines(player) {
  usething = player.mo;
  const angle = player.mo.angle;
  const x1 = player.mo.x, y1 = player.mo.y;
  const x2 = x1 + USERANGE * FineCos(angle);
  const y2 = y1 + USERANGE * FineSin(angle);
  P_PathTraverse(x1, y1, x2, y2, PT_ADDLINES, PTR_UseTraverse);
}

// --- Explosiones ------------------------------------------------------------------------------
let bombsource = null, bombspot = null, bombdamage = 0;

function PIT_RadiusAttack(thing) {
  if (!(thing.flags & MF_SHOOTABLE)) return true;
  if (bombsource && thing !== bombsource && B_SameFaction(thing, bombsource)) return true;
  const dx = Math.abs(thing.x - bombspot.x);
  const dy = Math.abs(thing.y - bombspot.y);
  let dist = dx > dy ? dx : dy;
  dist -= thing.radius;
  if (dist < 0) dist = 0;
  if (dist >= bombdamage) return true;
  if (P_CheckSight(thing, bombspot)) P_DamageMobj(thing, bombspot, bombsource, Math.floor(bombdamage - dist));
  return true;
}

function P_RadiusAttack(spot, source, damage) {
  const dist = damage + MAXRADIUS;
  const yh = Math.floor((spot.y + dist - bmaporgy) / MAPBLOCKSIZE);
  const yl = Math.floor((spot.y - dist - bmaporgy) / MAPBLOCKSIZE);
  const xh = Math.floor((spot.x + dist - bmaporgx) / MAPBLOCKSIZE);
  const xl = Math.floor((spot.x - dist - bmaporgx) / MAPBLOCKSIZE);
  bombspot = spot;
  bombsource = source;
  bombdamage = damage;
  for (let y = yl; y <= yh; y++) for (let x = xl; x <= xh; x++) P_BlockThingsIterator(x, y, PIT_RadiusAttack);
}

// --- Cambios de altura de sectores (puertas que aplastan, etc.) --------------------------
let crushchange = false, nofit = false;

function PIT_ChangeSector(thing) {
  if (P_ThingHeightClip(thing)) return true;
  if (thing.health <= 0 && (thing.flags & MF_CORPSE)) {
    thing.height = 0;
    thing.radius = 0;
    return true;
  }
  if (thing.flags & MF_DROPPED) {
    P_RemoveMobj(thing);
    return true;
  }
  if (!(thing.flags & MF_SHOOTABLE)) return true;
  nofit = true;
  if (crushchange && !(leveltime & 3)) {
    P_DamageMobj(thing, null, null, 10);
    const mo = P_SpawnMobj(thing.x, thing.y, thing.z + thing.height / 2, MT.BLOOD);
    mo.momx = (P_Random() - P_Random()) / 16;
    mo.momy = (P_Random() - P_Random()) / 16;
  }
  return true;
}

function P_ChangeSector(sector, crunch) {
  nofit = false;
  crushchange = crunch;
  for (let x = sector.blockbox[BOXLEFT]; x <= sector.blockbox[BOXRIGHT]; x++) {
    for (let y = sector.blockbox[BOXBOTTOM]; y <= sector.blockbox[BOXTOP]; y++) {
      P_BlockThingsIterator(x, y, PIT_ChangeSector);
    }
  }
  return nofit;
}
