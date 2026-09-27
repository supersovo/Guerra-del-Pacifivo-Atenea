// =============================================================================
// r_bsp.js — Recorrido del árbol BSP y recorte de muros (r_bsp.c)
// -----------------------------------------------------------------------------
// R_RenderBSPNode visita los subsectores de adelante hacia atrás. Cada seg
// visible se proyecta a un rango de columnas [x1,x2] y se recorta contra la
// lista "solidsegs" de columnas ya tapadas por muros macizos. Cuando la lista
// cubre toda la pantalla, el resto del árbol se descarta con R_CheckBBox.
//
// Extensión Atenea: el cielo se dibuja como fondo (ver r_sky.js), de modo que
// una línea cuyo frente tiene cielo nunca tapa lo que hay detrás por encima de
// ella. Así los acantilados y morros se ven por sobre las casas y fuertes.
// =============================================================================
'use strict';

let curline = null;
let sidedef = null;
let linedef = null;
let frontsector = null;
let backsector = null;
let rw_angle1 = 0;

// Lista de rangos de columnas completamente tapadas.
const MAXSEGS = 1024;
let solidFirst = new Int32Array(MAXSEGS);
let solidLast = new Int32Array(MAXSEGS);
let newend = 0;

// nsblock[x] = 1: en esa columna ya pasó un techo/fachada cerrado bajo cielo;
// detrás de él no puede verse geometría de sectores con techo (interiores).
let nsblock = new Uint8Array(1);

function R_ClearClipSegs() {
  solidFirst[0] = -0x7fffffff; solidLast[0] = -1;
  solidFirst[1] = viewwidth; solidLast[1] = 0x7fffffff;
  newend = 2;
  if (nsblock.length !== viewwidth) nsblock = new Uint8Array(viewwidth);
  else nsblock.fill(0);
}

function R_Crunch(start, next) {
  if (next === start) return;
  let s = start, n = next;
  while (n + 1 < newend) {
    n++; s++;
    solidFirst[s] = solidFirst[n];
    solidLast[s] = solidLast[n];
  }
  newend = s + 1;
}

function R_ClipSolidWallSegment(first, last) {
  let start = 0;
  while (solidLast[start] < first - 1) start++;
  if (first < solidFirst[start]) {
    if (last < solidFirst[start] - 1) {
      // Totalmente visible: insertar un nuevo rango.
      R_StoreWallRange(first, last);
      for (let i = newend; i > start; i--) {
        solidFirst[i] = solidFirst[i - 1];
        solidLast[i] = solidLast[i - 1];
      }
      newend++;
      solidFirst[start] = first;
      solidLast[start] = last;
      return;
    }
    R_StoreWallRange(first, solidFirst[start] - 1);
    solidFirst[start] = first;
  }
  if (last <= solidLast[start]) return;
  let next = start;
  while (last >= solidFirst[next + 1] - 1) {
    R_StoreWallRange(solidLast[next] + 1, solidFirst[next + 1] - 1);
    next++;
    if (last <= solidLast[next]) {
      solidLast[start] = solidLast[next];
      R_Crunch(start, next);
      return;
    }
  }
  R_StoreWallRange(solidLast[next] + 1, last);
  solidLast[start] = last;
  R_Crunch(start, next);
}

function R_ClipPassWallSegment(first, last) {
  let start = 0;
  while (solidLast[start] < first - 1) start++;
  if (first < solidFirst[start]) {
    if (last < solidFirst[start] - 1) {
      R_StoreWallRange(first, last);
      return;
    }
    R_StoreWallRange(first, solidFirst[start] - 1);
  }
  if (last <= solidLast[start]) return;
  while (last >= solidFirst[start + 1] - 1) {
    R_StoreWallRange(solidLast[start] + 1, solidFirst[start + 1] - 1);
    start++;
    if (last <= solidLast[start]) return;
  }
  R_StoreWallRange(solidLast[start] + 1, last);
}

// R_AddLine: proyecta un seg y decide cómo recortarlo.
function R_AddLine(line) {
  curline = line;
  let angle1 = R_PointToAngle(line.v1.x, line.v1.y);
  let angle2 = R_PointToAngle(line.v2.x, line.v2.y);
  const span = (angle1 - angle2) >>> 0;
  // Cara trasera: no se ve.
  if (span >= ANG180) return;
  rw_angle1 = angle1;
  angle1 = (angle1 - viewangle) >>> 0;
  angle2 = (angle2 - viewangle) >>> 0;
  const clip2 = clipangle * 2;
  let tspan = (angle1 + clipangle) >>> 0;
  if (tspan > clip2) {
    tspan = (tspan - clip2) >>> 0;
    if (tspan >= span) return;
    angle1 = clipangle;
  }
  tspan = (clipangle - angle2) >>> 0;
  if (tspan > clip2) {
    tspan = (tspan - clip2) >>> 0;
    if (tspan >= span) return;
    angle2 = (-clipangle) >>> 0;
  }
  const x1 = viewangletox[((angle1 + ANG90) >>> 0) >>> ANGLETOFINESHIFT];
  const x2 = viewangletox[((angle2 + ANG90) >>> 0) >>> ANGLETOFINESHIFT];
  if (x1 >= x2) return;
  backsector = line.backsector;
  if (!backsector) {
    R_ClipRange(true, x1, x2 - 1);
    return;
  }
  const fsky = frontsector.ceilingpic === skyflatnum;
  const bsky = backsector.ceilingpic === skyflatnum;
  if (!(fsky && bsky)) {
    if (backsector.ceilingheight <= frontsector.floorheight ||
        backsector.floorheight >= frontsector.ceilingheight) {
      // Puerta cerrada / muro. Con cielo al frente se deja "pasar" por encima.
      R_ClipRange(!fsky, x1, x2 - 1);
      return;
    }
  }
  if (backsector.ceilingheight !== frontsector.ceilingheight ||
      backsector.floorheight !== frontsector.floorheight) {
    R_ClipRange(false, x1, x2 - 1);
    return;
  }
  // Línea vacía (disparador): nada que dibujar.
  if (backsector.ceilingpic === frontsector.ceilingpic &&
      backsector.floorpic === frontsector.floorpic &&
      backsector.lightlevel === frontsector.lightlevel &&
      line.sidedef.midtexture === 0) {
    return;
  }
  R_ClipRange(false, x1, x2 - 1);
}

// Recorta un rango de columnas; los segs de sectores con techo se omiten en
// las columnas marcadas por nsblock (quedan ocultos bajo una azotea).
function R_ClipRange(solid, first, last) {
  if (frontsector.ceilingpic !== skyflatnum) {
    let x = first;
    while (x <= last) {
      const b = nsblock[x];
      let e = x;
      while (e <= last && nsblock[e] === b) e++;
      if (!b) {
        if (solid) R_ClipSolidWallSegment(x, e - 1);
        else R_ClipPassWallSegment(x, e - 1);
      }
      x = e;
    }
    return;
  }
  if (solid) R_ClipSolidWallSegment(first, last);
  else R_ClipPassWallSegment(first, last);
}

// R_CheckBBox: ¿puede verse alguna parte de la caja?
const checkcoord = [
  [3, 0, 2, 1], [3, 0, 2, 0], [3, 1, 2, 0], [0, 0, 0, 0],
  [2, 0, 2, 1], [0, 0, 0, 0], [3, 1, 3, 0], [0, 0, 0, 0],
  [2, 0, 3, 1], [2, 1, 3, 1], [2, 1, 3, 0], [0, 0, 0, 0]
];

function R_CheckBBox(bspcoord) {
  let boxx, boxy;
  if (viewx <= bspcoord[BOXLEFT]) boxx = 0;
  else if (viewx < bspcoord[BOXRIGHT]) boxx = 1;
  else boxx = 2;
  if (viewy >= bspcoord[BOXTOP]) boxy = 0;
  else if (viewy > bspcoord[BOXBOTTOM]) boxy = 1;
  else boxy = 2;
  const boxpos = (boxy << 2) + boxx;
  if (boxpos === 5) return true;
  const cc = checkcoord[boxpos];
  const x1 = bspcoord[cc[0]], y1 = bspcoord[cc[1]];
  const x2 = bspcoord[cc[2]], y2 = bspcoord[cc[3]];
  let angle1 = (R_PointToAngle(x1, y1) - viewangle) >>> 0;
  let angle2 = (R_PointToAngle(x2, y2) - viewangle) >>> 0;
  const span = (angle1 - angle2) >>> 0;
  if (span >= ANG180) return true;
  const clip2 = clipangle * 2;
  let tspan = (angle1 + clipangle) >>> 0;
  if (tspan > clip2) {
    tspan = (tspan - clip2) >>> 0;
    if (tspan >= span) return false;
    angle1 = clipangle;
  }
  tspan = (clipangle - angle2) >>> 0;
  if (tspan > clip2) {
    tspan = (tspan - clip2) >>> 0;
    if (tspan >= span) return false;
    angle2 = (-clipangle) >>> 0;
  }
  const sx1 = viewangletox[((angle1 + ANG90) >>> 0) >>> ANGLETOFINESHIFT];
  let sx2 = viewangletox[((angle2 + ANG90) >>> 0) >>> ANGLETOFINESHIFT];
  if (sx1 === sx2) return false;
  sx2--;
  let start = 0;
  while (solidLast[start] < sx2) start++;
  if (sx1 >= solidFirst[start] && sx2 <= solidLast[start]) return false;
  return true;
}

// R_Subsector: prepara los planos del sector y procesa sus segs.
let floorplane = null;
let ceilingplane = null;

function R_Subsector(num) {
  const sub = subsectors[num];
  frontsector = sub.sector;
  if (frontsector.floorheight < viewz) {
    floorplane = R_FindPlane(frontsector.floorheight, frontsector.floorpic, frontsector.lightlevel);
  } else floorplane = null;
  if (frontsector.ceilingheight > viewz && frontsector.ceilingpic !== skyflatnum) {
    ceilingplane = R_FindPlane(frontsector.ceilingheight, frontsector.ceilingpic, frontsector.lightlevel);
  } else ceilingplane = null;
  R_AddSprites(frontsector);
  const first = sub.firstline;
  const end = first + sub.numlines;
  for (let i = first; i < end; i++) R_AddLine(segs[i]);
}

function R_RenderBSPNode(bspnum) {
  if (bspnum & NF_SUBSECTOR) {
    R_Subsector(bspnum & ~NF_SUBSECTOR);
    return;
  }
  const bsp = nodes[bspnum];
  const side = R_PointOnSide(viewx, viewy, bsp);
  R_RenderBSPNode(bsp.children[side]);
  if (R_CheckBBox(bsp.bbox[side ^ 1])) R_RenderBSPNode(bsp.children[side ^ 1]);
}
