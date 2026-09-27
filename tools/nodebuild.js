// =============================================================================
// nodebuild.js — Constructor de nodos BSP (equivalente a "doombsp" / "BSP 5.2")
// -----------------------------------------------------------------------------
// Toma las linedefs de un mapa y genera:
//   SEGS      — trozos de linedef (uno por cara), partidos donde haga falta
//   SSECTORS  — subsectores: regiones convexas, cada una una lista de segs
//   NODES     — árbol BSP: líneas de partición con cajas delimitadoras
// El renderizador recorre este árbol de adelante hacia atrás, exactamente como
// R_RenderBSPNode en DOOM. Se trabaja en punto flotante, por lo que no existen
// los "slime trails" causados por el redondeo a enteros de 16 bits.
// =============================================================================
'use strict';

const NB_EPS = 1e-4;

function NB_BuildNodes(map) {
  const verts = map.vertexes.map(function (v) { return { x: v.x, y: v.y }; });
  const segs = [];

  // Segs iniciales: uno por cada cara de cada linedef.
  map.lines.forEach(function (ld, li) {
    const v1 = verts[ld.v1], v2 = verts[ld.v2];
    const s0 = map.sides[ld.sidenum[0]];
    segs.push({ v1: v1, v2: v2, linedef: li, side: 0, offset: 0, sector: s0.sector,
      lx: v1.x, ly: v1.y, ldx: v2.x - v1.x, ldy: v2.y - v1.y });
    if (ld.sidenum[1] >= 0) {
      const s1 = map.sides[ld.sidenum[1]];
      segs.push({ v1: v2, v2: v1, linedef: li, side: 1, offset: 0, sector: s1.sector,
        lx: v2.x, ly: v2.y, ldx: v1.x - v2.x, ldy: v1.y - v2.y });
    }
  });

  const outSegs = [];
  const subsectors = [];
  const nodes = [];

  // Lado de un punto respecto de una línea (px,py,dx,dy): <0 frente (derecha), >0 atrás.
  function sideDist(x, y, px, py, dx, dy, len) {
    return ((y - py) * dx - (x - px) * dy) / len;
  }

  function classify(seg, part) {
    const d1 = sideDist(seg.v1.x, seg.v1.y, part.x, part.y, part.dx, part.dy, part.len);
    const d2 = sideDist(seg.v2.x, seg.v2.y, part.x, part.y, part.dx, part.dy, part.len);
    const s1 = d1 < -NB_EPS ? -1 : d1 > NB_EPS ? 1 : 0;
    const s2 = d2 < -NB_EPS ? -1 : d2 > NB_EPS ? 1 : 0;
    if (s1 === 0 && s2 === 0) {
      // colineal: va al frente si apunta en la misma dirección
      const dot = (seg.v2.x - seg.v1.x) * part.dx + (seg.v2.y - seg.v1.y) * part.dy;
      return { kind: dot > 0 ? 'front' : 'back' };
    }
    if (s1 <= 0 && s2 <= 0) return { kind: 'front' };
    if (s1 >= 0 && s2 >= 0) return { kind: 'back' };
    return { kind: 'split', d1: d1, d2: d2 };
  }

  function partOf(seg) {
    const dx = seg.v2.x - seg.v1.x, dy = seg.v2.y - seg.v1.y;
    return { x: seg.v1.x, y: seg.v1.y, dx: dx, dy: dy, len: Math.hypot(dx, dy) };
  }

  function isConvex(set) {
    const sec = set[0].sector;
    for (let i = 0; i < set.length; i++) {
      if (set[i].sector !== sec) return false;
    }
    for (let i = 0; i < set.length; i++) {
      const p = partOf(set[i]);
      for (let j = 0; j < set.length; j++) {
        if (i === j) continue;
        const s = set[j];
        const d1 = sideDist(s.v1.x, s.v1.y, p.x, p.y, p.dx, p.dy, p.len);
        const d2 = sideDist(s.v2.x, s.v2.y, p.x, p.y, p.dx, p.dy, p.len);
        if (d1 > NB_EPS || d2 > NB_EPS) return false;
      }
    }
    return true;
  }

  function evaluate(set, part, bestCost) {
    let front = 0, back = 0, splits = 0;
    for (let i = 0; i < set.length; i++) {
      const c = classify(set[i], part);
      if (c.kind === 'front') front++;
      else if (c.kind === 'back') back++;
      else { splits++; front++; back++; }
      const cost = splits * 6 + Math.abs(front - back);
      if (cost > bestCost + set.length) return Infinity; // poda temprana
    }
    if (front === 0 || back === 0) return Infinity;       // sin progreso
    return splits * 6 + Math.abs(front - back);
  }

  function choosePartition(set) {
    let best = null, bestCost = Infinity;
    const n = set.length;
    const step = n > 160 ? Math.ceil(n / 80) : 1;
    const tried = new Set();
    for (let i = 0; i < n; i += step) {
      const s = set[i];
      const key = s.linedef + ':' + s.side;
      if (tried.has(key)) continue;
      tried.add(key);
      const p = partOf(s);
      let cost = evaluate(set, p, bestCost);
      if (p.dx !== 0 && p.dy !== 0) cost += 1; // preferir particiones ortogonales
      if (cost < bestCost) { bestCost = cost; best = p; }
    }
    if (!best) {
      // búsqueda exhaustiva si el muestreo no encontró partición válida
      for (let i = 0; i < n; i++) {
        const p = partOf(set[i]);
        const cost = evaluate(set, p, Infinity);
        if (cost < bestCost) { bestCost = cost; best = p; }
      }
    }
    return best;
  }

  function bboxOf(set) {
    const b = [-Infinity, Infinity, Infinity, -Infinity];
    for (const s of set) {
      for (const v of [s.v1, s.v2]) {
        if (v.y > b[BOXTOP]) b[BOXTOP] = v.y;
        if (v.y < b[BOXBOTTOM]) b[BOXBOTTOM] = v.y;
        if (v.x < b[BOXLEFT]) b[BOXLEFT] = v.x;
        if (v.x > b[BOXRIGHT]) b[BOXRIGHT] = v.x;
      }
    }
    return b;
  }

  function makeSubsector(set) {
    const first = outSegs.length;
    for (const s of set) outSegs.push(s);
    subsectors.push({ firstline: first, numlines: set.length });
    return (subsectors.length - 1) | NF_SUBSECTOR;
  }

  function build(set, depth) {
    if (depth > 200) throw new Error('NB_BuildNodes: árbol BSP demasiado profundo');
    if (isConvex(set)) return makeSubsector(set);
    const part = choosePartition(set);
    if (!part) {
      // No debería ocurrir; se agrupa por sector como último recurso.
      return makeSubsector(set);
    }
    const front = [], back = [];
    for (const s of set) {
      const c = classify(s, part);
      if (c.kind === 'front') front.push(s);
      else if (c.kind === 'back') back.push(s);
      else {
        const t = c.d1 / (c.d1 - c.d2);
        const nv = { x: s.v1.x + (s.v2.x - s.v1.x) * t, y: s.v1.y + (s.v2.y - s.v1.y) * t };
        verts.push(nv);
        const a = Object.assign({}, s, { v2: nv });
        const b = Object.assign({}, s, { v1: nv, offset: s.offset + Math.hypot(nv.x - s.v1.x, nv.y - s.v1.y) });
        if (c.d1 < 0) { front.push(a); back.push(b); }
        else { back.push(a); front.push(b); }
      }
    }
    const node = { x: part.x, y: part.y, dx: part.dx, dy: part.dy, bbox: [bboxOf(front), bboxOf(back)], children: [0, 0] };
    const idx = nodes.length;
    nodes.push(node);
    node.children[0] = build(front, depth + 1);
    node.children[1] = build(back, depth + 1);
    return idx;
  }

  if (segs.length === 0) throw new Error('NB_BuildNodes: mapa sin líneas');
  const root = build(segs, 0);
  if (root & NF_SUBSECTOR) {
    // mapa de un solo subsector: crear un nodo trivial
    nodes.push({ x: 0, y: 0, dx: 1, dy: 0, bbox: [bboxOf(segs), bboxOf(segs)], children: [root, root] });
  }

  // Índices finales de vértices.
  const vindex = new Map();
  const allverts = [];
  function vi(v) {
    let i = vindex.get(v);
    if (i === undefined) { i = allverts.length; allverts.push({ x: v.x, y: v.y }); vindex.set(v, i); }
    return i;
  }
  // Vértices originales primero (mismos índices que VERTEXES).
  for (let i = 0; i < map.vertexes.length; i++) vi(verts[i]);

  map.segs = outSegs.map(function (s) {
    return { v1: vi(s.v1), v2: vi(s.v2), linedef: s.linedef, side: s.side, offset: s.offset };
  });
  map.glverts = allverts;
  map.subsectors = subsectors;
  map.nodes = nodes;
  // Si la raíz es un subsector, el nodo trivial es el último.
  map.rootnode = (root & NF_SUBSECTOR) ? nodes.length - 1 : root;
}
