// =============================================================================
// p_maputl.js — Utilidades geométricas del mapa (p_maputl.c)
// -----------------------------------------------------------------------------
// Lados de líneas, aperturas entre sectores, iteradores del BLOCKMAP y el
// recorrido de trayectorias (P_PathTraverse) usado por los disparos
// instantáneos, la vista de los enemigos y el deslizamiento contra muros.
// =============================================================================
'use strict';

let opentop = 0, openbottom = 0, openrange = 0, lowfloor = 0;

function P_PointOnLineSide(x, y, line) {
  if (!line.dx) {
    if (x <= line.v1.x) return line.dy > 0 ? 1 : 0;
    return line.dy < 0 ? 1 : 0;
  }
  if (!line.dy) {
    if (y <= line.v1.y) return line.dx < 0 ? 1 : 0;
    return line.dx > 0 ? 1 : 0;
  }
  const left = line.dy * (x - line.v1.x);
  const right = (y - line.v1.y) * line.dx;
  return right < left ? 0 : 1;
}

function P_BoxOnLineSide(tmbox, ld) {
  let p, p2;
  switch (ld.slopetype) {
    case ST_HORIZONTAL:
      p = tmbox[BOXTOP] > ld.v1.y ? 1 : 0;
      p2 = tmbox[BOXBOTTOM] > ld.v1.y ? 1 : 0;
      if (ld.dx < 0) { p ^= 1; p2 ^= 1; }
      break;
    case ST_VERTICAL:
      p = tmbox[BOXRIGHT] < ld.v1.x ? 1 : 0;
      p2 = tmbox[BOXLEFT] < ld.v1.x ? 1 : 0;
      if (ld.dy < 0) { p ^= 1; p2 ^= 1; }
      break;
    case ST_POSITIVE:
      p = P_PointOnLineSide(tmbox[BOXLEFT], tmbox[BOXTOP], ld);
      p2 = P_PointOnLineSide(tmbox[BOXRIGHT], tmbox[BOXBOTTOM], ld);
      break;
    default:
      p = P_PointOnLineSide(tmbox[BOXRIGHT], tmbox[BOXTOP], ld);
      p2 = P_PointOnLineSide(tmbox[BOXLEFT], tmbox[BOXBOTTOM], ld);
      break;
  }
  return p === p2 ? p : -1;
}

function P_PointOnDivlineSide(x, y, line) {
  if (!line.dx) {
    if (x <= line.x) return line.dy > 0 ? 1 : 0;
    return line.dy < 0 ? 1 : 0;
  }
  if (!line.dy) {
    if (y <= line.y) return line.dx < 0 ? 1 : 0;
    return line.dx > 0 ? 1 : 0;
  }
  const left = line.dy * (x - line.x);
  const right = (y - line.y) * line.dx;
  return right < left ? 0 : 1;
}

function P_MakeDivline(li, dl) {
  dl.x = li.v1.x; dl.y = li.v1.y; dl.dx = li.dx; dl.dy = li.dy;
}

// Fracción a lo largo de v2 donde se cruza con v1.
function P_InterceptVector(v2, v1) {
  const den = v1.dy * v2.dx - v1.dx * v2.dy;
  if (den === 0) return 0;
  const num = (v1.x - v2.x) * v1.dy + (v2.y - v1.y) * v1.dx;
  return num / den;
}

// Apertura vertical entre los dos sectores de una línea.
function P_LineOpening(linedef) {
  if (linedef.sidenum[1] < 0 || !linedef.backsector) { openrange = 0; return; }
  const front = linedef.frontsector, back = linedef.backsector;
  opentop = front.ceilingheight < back.ceilingheight ? front.ceilingheight : back.ceilingheight;
  if (front.floorheight > back.floorheight) { openbottom = front.floorheight; lowfloor = back.floorheight; }
  else { openbottom = back.floorheight; lowfloor = front.floorheight; }
  openrange = opentop - openbottom;
}

// Igual que P_LineOpening, pero entre dos sectores con cielo la altura del
// techo no limita (para disparos, vista y proyectiles): el cielo es abierto.
function P_LineOpeningTrace(linedef) {
  P_LineOpening(linedef);
  if (openrange === 0 && (!linedef.backsector)) return;
  if (linedef.frontsector.ceilingpic === skyflatnum && linedef.backsector.ceilingpic === skyflatnum) {
    opentop = 1e9;
    openrange = opentop - openbottom;
  }
}

// --- Enlaces de cosas en sectores y blockmap ---------------------------------------------
function P_UnsetThingPosition(thing) {
  if (!(thing.flags & MF_NOSECTOR)) {
    if (thing.snext) thing.snext.sprev = thing.sprev;
    if (thing.sprev) thing.sprev.snext = thing.snext;
    else if (thing.subsector) thing.subsector.sector.thinglist = thing.snext;
    thing.snext = thing.sprev = null;
  }
  if (!(thing.flags & MF_NOBLOCKMAP)) {
    if (thing.bnext) thing.bnext.bprev = thing.bprev;
    if (thing.bprev) thing.bprev.bnext = thing.bnext;
    else {
      const bx = Math.floor((thing.x - bmaporgx) / MAPBLOCKSIZE);
      const by = Math.floor((thing.y - bmaporgy) / MAPBLOCKSIZE);
      if (bx >= 0 && by >= 0 && bx < bmapwidth && by < bmapheight) {
        if (blocklinks[by * bmapwidth + bx] === thing) blocklinks[by * bmapwidth + bx] = thing.bnext;
      }
    }
    thing.bnext = thing.bprev = null;
  }
}

function P_SetThingPosition(thing) {
  const ss = R_PointInSubsector(thing.x, thing.y);
  thing.subsector = ss;
  if (!(thing.flags & MF_NOSECTOR)) {
    const sec = ss.sector;
    thing.sprev = null;
    thing.snext = sec.thinglist;
    if (sec.thinglist) sec.thinglist.sprev = thing;
    sec.thinglist = thing;
  }
  if (!(thing.flags & MF_NOBLOCKMAP)) {
    const bx = Math.floor((thing.x - bmaporgx) / MAPBLOCKSIZE);
    const by = Math.floor((thing.y - bmaporgy) / MAPBLOCKSIZE);
    if (bx >= 0 && by >= 0 && bx < bmapwidth && by < bmapheight) {
      const idx = by * bmapwidth + bx;
      thing.bprev = null;
      thing.bnext = blocklinks[idx];
      if (blocklinks[idx]) blocklinks[idx].bprev = thing;
      blocklinks[idx] = thing;
    } else {
      thing.bnext = thing.bprev = null;
    }
  }
}

// --- Iteradores del blockmap ------------------------------------------------------------------
function P_BlockLinesIterator(x, y, func) {
  if (x < 0 || y < 0 || x >= bmapwidth || y >= bmapheight) return true;
  const list = blockmaplists[y * bmapwidth + x];
  for (let i = 0; i < list.length; i++) {
    const ld = list[i];
    if (ld.validcount === validcount) continue;
    ld.validcount = validcount;
    if (!func(ld)) return false;
  }
  return true;
}

function P_BlockThingsIterator(x, y, func) {
  if (x < 0 || y < 0 || x >= bmapwidth || y >= bmapheight) return true;
  for (let mobj = blocklinks[y * bmapwidth + x]; mobj; ) {
    const next = mobj.bnext;
    if (!func(mobj)) return false;
    mobj = next;
  }
  return true;
}

// --- Recorrido de trayectorias (intercepts) --------------------------------------------------
const trace = { x: 0, y: 0, dx: 0, dy: 0 };
let intercepts = [];
let earlyout = false;
const PT_ADDLINES = 1, PT_ADDTHINGS = 2, PT_EARLYOUT = 4;

function PIT_AddLineIntercepts(ld) {
  let s1, s2;
  if (trace.dx > 16 || trace.dy > 16 || trace.dx < -16 || trace.dy < -16) {
    s1 = P_PointOnDivlineSide(ld.v1.x, ld.v1.y, trace);
    s2 = P_PointOnDivlineSide(ld.v2.x, ld.v2.y, trace);
  } else {
    s1 = P_PointOnLineSide(trace.x, trace.y, ld);
    s2 = P_PointOnLineSide(trace.x + trace.dx, trace.y + trace.dy, ld);
  }
  if (s1 === s2) return true;
  const dl = { x: ld.v1.x, y: ld.v1.y, dx: ld.dx, dy: ld.dy };
  const frac = P_InterceptVector(trace, dl);
  if (frac < 0) return true;
  if (earlyout && frac < 1 && !ld.backsector) return false;
  intercepts.push({ frac: frac, isaline: true, line: ld, thing: null });
  return true;
}

function PIT_AddThingIntercepts(thing) {
  const tracepositive = (trace.dx >= 0) === (trace.dy >= 0);
  let x1, y1, x2, y2;
  if (tracepositive) {
    x1 = thing.x - thing.radius; y1 = thing.y + thing.radius;
    x2 = thing.x + thing.radius; y2 = thing.y - thing.radius;
  } else {
    x1 = thing.x - thing.radius; y1 = thing.y - thing.radius;
    x2 = thing.x + thing.radius; y2 = thing.y + thing.radius;
  }
  const s1 = P_PointOnDivlineSide(x1, y1, trace);
  const s2 = P_PointOnDivlineSide(x2, y2, trace);
  if (s1 === s2) return true;
  const dl = { x: x1, y: y1, dx: x2 - x1, dy: y2 - y1 };
  const frac = P_InterceptVector(trace, dl);
  if (frac < 0) return true;
  intercepts.push({ frac: frac, isaline: false, line: null, thing: thing });
  return true;
}

function P_TraverseIntercepts(func, maxfrac) {
  intercepts.sort(function (a, b) { return a.frac - b.frac; });
  for (let i = 0; i < intercepts.length; i++) {
    const inx = intercepts[i];
    if (inx.frac > maxfrac) return true;
    if (!func(inx)) return false;
  }
  return true;
}

// Recorre las celdas del blockmap entre dos puntos (DDA) y llama a trav para
// cada línea/cosa cruzada, de la más cercana a la más lejana.
function P_PathTraverse(x1, y1, x2, y2, flags, trav) {
  earlyout = !!(flags & PT_EARLYOUT);
  validcount++;
  intercepts = [];
  if (((x1 - bmaporgx) % MAPBLOCKSIZE) === 0) x1 += 1;
  if (((y1 - bmaporgy) % MAPBLOCKSIZE) === 0) y1 += 1;
  trace.x = x1; trace.y = y1; trace.dx = x2 - x1; trace.dy = y2 - y1;
  const ox1 = x1 - bmaporgx, oy1 = y1 - bmaporgy;
  const ox2 = x2 - bmaporgx, oy2 = y2 - bmaporgy;
  let bx = Math.floor(ox1 / MAPBLOCKSIZE), by = Math.floor(oy1 / MAPBLOCKSIZE);
  const bx2 = Math.floor(ox2 / MAPBLOCKSIZE), by2 = Math.floor(oy2 / MAPBLOCKSIZE);
  const dx = ox2 - ox1, dy = oy2 - oy1;
  const stepx = dx > 0 ? 1 : dx < 0 ? -1 : 0;
  const stepy = dy > 0 ? 1 : dy < 0 ? -1 : 0;
  let tMaxX, tMaxY, tDeltaX, tDeltaY;
  if (stepx !== 0) {
    const nextx = stepx > 0 ? (bx + 1) * MAPBLOCKSIZE : bx * MAPBLOCKSIZE;
    tMaxX = (nextx - ox1) / dx;
    tDeltaX = MAPBLOCKSIZE / Math.abs(dx);
  } else { tMaxX = Infinity; tDeltaX = Infinity; }
  if (stepy !== 0) {
    const nexty = stepy > 0 ? (by + 1) * MAPBLOCKSIZE : by * MAPBLOCKSIZE;
    tMaxY = (nexty - oy1) / dy;
    tDeltaY = MAPBLOCKSIZE / Math.abs(dy);
  } else { tMaxY = Infinity; tDeltaY = Infinity; }
  for (let count = 0; count < 512; count++) {
    if (flags & PT_ADDLINES) {
      if (!P_BlockLinesIterator(bx, by, PIT_AddLineIntercepts)) break;
    }
    if (flags & PT_ADDTHINGS) {
      if (!P_BlockThingsIterator(bx, by, PIT_AddThingIntercepts)) break;
    }
    if (bx === bx2 && by === by2) break;
    let t;
    if (tMaxX < tMaxY) { t = tMaxX; tMaxX += tDeltaX; bx += stepx; }
    else { t = tMaxY; tMaxY += tDeltaY; by += stepy; }
    if (t > 1) break;   // la celda siguiente empieza después del final del trazo
  }
  return P_TraverseIntercepts(trav, 1);
}
