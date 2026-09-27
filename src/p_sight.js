// =============================================================================
// p_sight.js — Línea de vista entre objetos (p_sight.c, versión con BSP)
// -----------------------------------------------------------------------------
// Recorre el árbol BSP a lo largo del trazo entre dos objetos y estrecha un
// cono vertical con cada línea de dos caras que cruza. Si el cono se cierra,
// no hay visión. Entre sectores con cielo el techo no limita la vista.
// =============================================================================
'use strict';

let sightzstart = 0;
let s_topslope = 0, s_bottomslope = 0;
const strace = { x: 0, y: 0, dx: 0, dy: 0 };
let t2x = 0, t2y = 0;

function P_DivlineSide(x, y, node) {
  if (!node.dx) {
    if (x === node.x) return 2;
    if (x <= node.x) return node.dy > 0 ? 1 : 0;
    return node.dy < 0 ? 1 : 0;
  }
  if (!node.dy) {
    if (y === node.y) return 2;
    if (y <= node.y) return node.dx < 0 ? 1 : 0;
    return node.dx > 0 ? 1 : 0;
  }
  const left = node.dy * (x - node.x);
  const right = (y - node.y) * node.dx;
  if (right < left) return 0;
  if (left === right) return 2;
  return 1;
}

function P_InterceptVector2(v2, v1) {
  const den = v1.dy * v2.dx - v1.dx * v2.dy;
  if (den === 0) return 0;
  const num = (v1.x - v2.x) * v1.dy + (v2.y - v1.y) * v1.dx;
  return num / den;
}

const s_divl = { x: 0, y: 0, dx: 0, dy: 0 };

function P_CrossSubsector(num) {
  const sub = subsectors[num];
  const end = sub.firstline + sub.numlines;
  for (let i = sub.firstline; i < end; i++) {
    const seg = segs[i];
    const line = seg.linedef;
    if (line.validcount === validcount) continue;
    line.validcount = validcount;
    const v1 = line.v1, v2 = line.v2;
    let s1 = P_DivlineSide(v1.x, v1.y, strace);
    let s2 = P_DivlineSide(v2.x, v2.y, strace);
    if (s1 === s2) continue;
    s_divl.x = v1.x; s_divl.y = v1.y; s_divl.dx = v2.x - v1.x; s_divl.dy = v2.y - v1.y;
    s1 = P_DivlineSide(strace.x, strace.y, s_divl);
    s2 = P_DivlineSide(t2x, t2y, s_divl);
    if (s1 === s2) continue;
    if (!(line.flags & ML_TWOSIDED)) return false;
    const front = seg.frontsector, back = seg.backsector;
    if (!back) return false;
    if (front.floorheight === back.floorheight && front.ceilingheight === back.ceilingheight) continue;
    const bothsky = front.ceilingpic === skyflatnum && back.ceilingpic === skyflatnum;
    const otop = bothsky ? 1e9 : Math.min(front.ceilingheight, back.ceilingheight);
    const obot = Math.max(front.floorheight, back.floorheight);
    if (obot >= otop) return false;
    const frac = P_InterceptVector2(strace, s_divl);
    if (frac <= 0) continue;
    if (front.floorheight !== back.floorheight) {
      const slope = (obot - sightzstart) / frac;
      if (slope > s_bottomslope) s_bottomslope = slope;
    }
    if (!bothsky && front.ceilingheight !== back.ceilingheight) {
      const slope = (otop - sightzstart) / frac;
      if (slope < s_topslope) s_topslope = slope;
    }
    if (s_topslope <= s_bottomslope) return false;
  }
  return true;
}

function P_CrossBSPNode(bspnum) {
  if (bspnum & NF_SUBSECTOR) return P_CrossSubsector(bspnum & ~NF_SUBSECTOR);
  const bsp = nodes[bspnum];
  let side = P_DivlineSide(strace.x, strace.y, bsp);
  if (side === 2) side = 0;
  if (!P_CrossBSPNode(bsp.children[side])) return false;
  if (side === P_DivlineSide(t2x, t2y, bsp)) return true;
  return P_CrossBSPNode(bsp.children[side ^ 1]);
}

function P_CheckSight(t1, t2) {
  validcount++;
  sightzstart = t1.z + t1.height - (t1.height / 4);
  s_topslope = (t2.z + t2.height) - sightzstart;
  s_bottomslope = t2.z - sightzstart;
  strace.x = t1.x; strace.y = t1.y;
  t2x = t2.x; t2y = t2.y;
  strace.dx = t2.x - t1.x; strace.dy = t2.y - t1.y;
  return P_CrossBSPNode(rootnode);
}
