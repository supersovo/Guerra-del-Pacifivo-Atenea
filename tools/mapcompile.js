// =============================================================================
// mapcompile.js — "Editor" de mapas: de polígonos anidados al formato de DOOM
// -----------------------------------------------------------------------------
// Los mapas de Atenea se escriben como polígonos (sectores o bloques macizos
// "void") que pueden anidarse: un edificio es un bloque macizo dentro de la
// playa; su interior es un sector dentro del bloque; su puerta es otro sector
// que atraviesa el muro. Este compilador produce exactamente las estructuras de
// un mapa de DOOM: VERTEXES, LINEDEFS, SIDEDEFS, SECTORS y THINGS, que luego el
// constructor de nodos (nodebuild.js) convierte en SEGS, SSECTORS y NODES.
//
// Reglas:
//  * Todas las coordenadas son enteras (unidades de mapa de DOOM).
//  * Los bordes de los polígonos no pueden cruzarse (sí tocarse o superponerse).
//  * Para cada arista se busca el polígono más interno a cada lado; eso decide
//    si la línea es de una cara (muro) o de dos caras (desnivel, puerta, etc.).
// =============================================================================
'use strict';

function MC_Rect(x1, y1, x2, y2) {
  const a = Math.min(x1, x2), b = Math.max(x1, x2);
  const c = Math.min(y1, y2), d = Math.max(y1, y2);
  return [[a, c], [b, c], [b, d], [a, d]];
}

function MC_Circle(cx, cy, r, n) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i + 0.5) / n * Math.PI * 2;
    pts.push([Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r)]);
  }
  return pts;
}

// Rectángulo rotado/orientado a partir de un segmento central (para rampas).
function MC_Quad(pts) { return pts.map(function (p) { return [Math.round(p[0]), Math.round(p[1])]; }); }

// -----------------------------------------------------------------------------------
// MapBuilder: API usada por los archivos de mapa.
// -----------------------------------------------------------------------------------
function MapBuilder(defaults) {
  this.defaults = Object.assign({
    floor: 0, ceil: 128, ftex: 'ARENA1', ctex: 'F_SKY1', light: 192,
    wall: 'ROCA1', special: 0, tag: 0
  }, defaults || {});
  this.polys = [];
  this.xlines = [];
  this.fixes = [];
  this.things = [];
  this.tagnames = new Map();
  this.nexttag = 1;
  this.messages = {};
}

MapBuilder.prototype.tag = function (name) {
  if (typeof name === 'number') return name;
  if (!name) return 0;
  let t = this.tagnames.get(name);
  if (!t) { t = this.nexttag++; this.tagnames.set(name, t); }
  return t;
};

// Sector: props sobrescribe los valores por defecto. props.same = otro polígono
// (o su id) para compartir sector (útil para puertas/luces de varias piezas).
MapBuilder.prototype.sector = function (pts, props) {
  const p = Object.assign({}, this.defaults, props || {});
  const poly = { pts: pts, props: p, isvoid: false, id: this.polys.length };
  if (p.tag && typeof p.tag === 'string') p.tag = this.tag(p.tag);
  this.polys.push(poly);
  return poly;
};

MapBuilder.prototype.solid = function (pts, props) {
  const p = Object.assign({ wall: this.defaults.wall }, props || {});
  const poly = { pts: pts, props: p, isvoid: true, id: this.polys.length };
  this.polys.push(poly);
  return poly;
};

// Línea explícita (disparadores de paso, divisiones). Se inserta en la geometría.
MapBuilder.prototype.line = function (a, b, props) {
  const p = Object.assign({}, props || {});
  if (p.tag && typeof p.tag === 'string') p.tag = this.tag(p.tag);
  this.xlines.push({ a: a, b: b, props: p });
};

// Modifica la linedef más cercana a un punto (tras compilar).
MapBuilder.prototype.fix = function (at, props) {
  const p = Object.assign({}, props || {});
  if (p.tag && typeof p.tag === 'string') p.tag = this.tag(p.tag);
  this.fixes.push({ at: at, props: p });
};

MapBuilder.prototype.thing = function (type, x, y, angle, opts) {
  let options = MTF_EASY | MTF_NORMAL | MTF_HARD;
  let tag = 0, hold = false, goal = null;
  if (opts && typeof opts === 'object') {
    tag = this.tag(opts.tag || 0);
    hold = !!opts.hold;
    if (opts.goal) goal = [Math.round(opts.goal[0]), Math.round(opts.goal[1])];
    opts = (opts.skill || '') + (opts.ambush ? 'A' : '');
    if (opts === '') opts = undefined;
  }
  if (typeof opts === 'string') {
    options = 0;
    if (opts.indexOf('E') >= 0) options |= MTF_EASY;
    if (opts.indexOf('M') >= 0) options |= MTF_NORMAL;
    if (opts.indexOf('H') >= 0) options |= MTF_HARD;
    if (opts.indexOf('A') >= 0) options |= MTF_AMBUSH;
    if (!(options & 7)) options |= 7;
  } else if (typeof opts === 'number') options = opts;
  const th = { type: type, x: Math.round(x), y: Math.round(y), angle: angle || 0, options: options, tag: tag, hold: hold };
  if (goal) th.goal = goal;   // punto de destino de una tropa en marcha
  this.things.push(th);
};

MapBuilder.prototype.message = function (tagname, text) {
  const t = this.tag(tagname);
  this.messages[t] = text;
  return t;
};

// Escalera: divide un rectángulo en n peldaños a lo largo de 'dir' ('N','S','E','W').
MapBuilder.prototype.stairs = function (x1, y1, x2, y2, dir, n, h0, dh, props) {
  const out = [];
  const w = x2 - x1, h = y2 - y1;
  for (let i = 0; i < n; i++) {
    let r;
    const t0 = i / n, t1 = (i + 1) / n;
    if (dir === 'N') r = MC_Rect(x1, Math.round(y1 + h * t0), x2, Math.round(y1 + h * t1));
    else if (dir === 'S') r = MC_Rect(x1, Math.round(y2 - h * t1), x2, Math.round(y2 - h * t0));
    else if (dir === 'E') r = MC_Rect(Math.round(x1 + w * t0), y1, Math.round(x1 + w * t1), y2);
    else r = MC_Rect(Math.round(x2 - w * t1), y1, Math.round(x2 - w * t0), y2);
    out.push(this.sector(r, Object.assign({}, props || {}, { floor: h0 + dh * (i + 1) })));
  }
  return out;
};

// Puerta con dinteles a ambos lados. rect = hueco que atraviesa el muro.
// axis: 'x' si la puerta se atraviesa en dirección X, 'y' si en dirección Y.
MapBuilder.prototype.door = function (x1, y1, x2, y2, axis, opts) {
  opts = opts || {};
  const depth = axis === 'x' ? Math.abs(x2 - x1) : Math.abs(y2 - y1);
  const lintel = Math.min(8, Math.floor(depth / 4));
  const floor = opts.floor || 0;
  const height = opts.height || 96;
  const doortex = opts.tex || 'PUERTA1';
  const wall = opts.wall || 'ADOBE1';
  const jamb = opts.jamb || 'MARCO1';
  const lintelProps = { floor: floor, ceil: floor + height, ftex: opts.ftex || 'PISO1', ctex: opts.ctex || 'TECHO1',
    light: opts.light || 160, wall: jamb, upper: wall, lower: wall };
  const doorProps = { floor: floor, ceil: floor, ftex: opts.ftex || 'PISO1', ctex: opts.ctex || 'TECHO1',
    light: opts.light || 160, wall: jamb, upper: doortex, door: opts.key || 'normal', tag: opts.tag || 0 };
  if (opts.remote) doorProps.door = 'remote';
  if (lintel > 0) {
    if (axis === 'x') {
      const a = Math.min(x1, x2), b = Math.max(x1, x2);
      this.sector(MC_Rect(a, y1, a + lintel, y2), lintelProps);
      const d = this.sector(MC_Rect(a + lintel, y1, b - lintel, y2), doorProps);
      this.sector(MC_Rect(b - lintel, y1, b, y2), lintelProps);
      return d;
    } else {
      const a = Math.min(y1, y2), b = Math.max(y1, y2);
      this.sector(MC_Rect(x1, a, x2, a + lintel), lintelProps);
      const d = this.sector(MC_Rect(x1, a + lintel, x2, b - lintel), doorProps);
      this.sector(MC_Rect(x1, b - lintel, x2, b), lintelProps);
      return d;
    }
  }
  return this.sector(MC_Rect(x1, y1, x2, y2), doorProps);
};

// Vano abierto (sin hoja de puerta) con dintel.
MapBuilder.prototype.opening = function (x1, y1, x2, y2, opts) {
  opts = opts || {};
  const floor = opts.floor || 0;
  return this.sector(MC_Rect(x1, y1, x2, y2), {
    floor: floor, ceil: floor + (opts.height || 96), ftex: opts.ftex || 'PISO1', ctex: opts.ctex || 'TECHO1',
    light: opts.light || 176, wall: opts.jamb || opts.wall || 'ADOBE1', upper: opts.wall || 'ADOBE1',
    lower: opts.wall || 'ADOBE1'
  });
};

// Ventana: vano con alféizar y dintel (sólo se ve a través).
MapBuilder.prototype.window = function (x1, y1, x2, y2, opts) {
  opts = opts || {};
  const floor = opts.floor || 0;
  return this.sector(MC_Rect(x1, y1, x2, y2), {
    floor: floor + (opts.sill || 40), ceil: floor + (opts.top || 88), ftex: opts.ftex || 'PISO1',
    ctex: opts.ctex || 'TECHO1', light: opts.light || 176, wall: opts.jamb || opts.wall || 'ADOBE1',
    upper: opts.wall || 'ADOBE1', lower: opts.wall || 'ADOBE1', blockall: opts.blockall !== false
  });
};

// -----------------------------------------------------------------------------------
// Utilidades geométricas
// -----------------------------------------------------------------------------------
function MC_Area(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

function MC_PointInPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
    if ((yi > y) !== (yj > y)) {
      const xint = xi + (y - yi) * (xj - xi) / (yj - yi);
      if (x < xint) inside = !inside;
    }
  }
  return inside;
}

function MC_Orient(ax, ay, bx, by, cx, cy) {
  const v = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  return v > 0 ? 1 : v < 0 ? -1 : 0;
}

// -----------------------------------------------------------------------------------
// Compilación
// -----------------------------------------------------------------------------------
function MC_CompileMap(def) {
  const B = new MapBuilder(def.defaults);
  def.build(B);
  const warnings = [];

  // --- 1. Normalizar polígonos ---
  const polys = B.polys;
  for (const poly of polys) {
    let pts = poly.pts.map(function (p) { return [Math.round(p[0]), Math.round(p[1])]; });
    // eliminar duplicados consecutivos
    pts = pts.filter(function (p, i) {
      const q = pts[(i + pts.length - 1) % pts.length];
      return !(p[0] === q[0] && p[1] === q[1]);
    });
    // eliminar puntos colineales
    let changed = true;
    while (changed && pts.length > 3) {
      changed = false;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[(i + pts.length - 1) % pts.length], b = pts[i], c = pts[(i + 1) % pts.length];
        if (MC_Orient(a[0], a[1], b[0], b[1], c[0], c[1]) === 0) { pts.splice(i, 1); changed = true; break; }
      }
    }
    if (pts.length < 3) throw new Error(def.lump + ': polígono degenerado #' + poly.id);
    let area = MC_Area(pts);
    if (area < 0) { pts.reverse(); area = -area; }
    poly.pts = pts;
    poly.area = area;
    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    for (const p of pts) {
      if (p[0] < minx) minx = p[0]; if (p[0] > maxx) maxx = p[0];
      if (p[1] < miny) miny = p[1]; if (p[1] > maxy) maxy = p[1];
    }
    poly.bbox = [minx, miny, maxx, maxy];
  }

  // --- 2. Sectores lógicos ---
  const sectors = [];
  for (const poly of polys) {
    if (poly.isvoid) { poly.sector = -1; continue; }
    if (poly.props.same !== undefined) {
      const other = typeof poly.props.same === 'object' ? poly.props.same : polys[poly.props.same];
      if (other.sector === undefined) throw new Error(def.lump + ': "same" debe referirse a un polígono previo');
      poly.sector = other.sector;
      continue;
    }
    const p = poly.props;
    poly.sector = sectors.length;
    sectors.push({
      floor: p.floor, ceil: p.ceil, ftex: p.ftex, ctex: p.ctex, light: p.light,
      special: p.special || 0, tag: p.tag || 0, props: p, poly: poly
    });
  }

  // Polígonos ordenados por área ascendente: el primero que contiene un punto es el más interno.
  const byArea = polys.slice().sort(function (a, b) { return a.area - b.area; });

  // Índice espacial de polígonos (por celdas de 256).
  const PCELL = 256;
  const pgrid = new Map();
  byArea.forEach(function (poly, order) {
    poly.order = order;
    const b = poly.bbox;
    for (let cx = Math.floor(b[0] / PCELL); cx <= Math.floor(b[2] / PCELL); cx++) {
      for (let cy = Math.floor(b[1] / PCELL); cy <= Math.floor(b[3] / PCELL); cy++) {
        const k = cx + ',' + cy;
        let arr = pgrid.get(k);
        if (!arr) { arr = []; pgrid.set(k, arr); }
        arr.push(poly);
      }
    }
  });
  for (const arr of pgrid.values()) arr.sort(function (a, b) { return a.order - b.order; });

  function innermost(x, y) {
    const arr = pgrid.get(Math.floor(x / PCELL) + ',' + Math.floor(y / PCELL));
    if (!arr) return null;
    for (const poly of arr) {
      const b = poly.bbox;
      if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) continue;
      if (MC_PointInPoly(x, y, poly.pts)) return poly;
    }
    return null;
  }

  // --- 3. Vértices y aristas ---
  const vmap = new Map();
  const verts = [];
  function vid(x, y) {
    const k = x + ',' + y;
    let v = vmap.get(k);
    if (v === undefined) { v = verts.length; verts.push([x, y]); vmap.set(k, v); }
    return v;
  }
  const rawEdges = [];
  for (const poly of polys) {
    const pts = poly.pts;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      rawEdges.push({ a: vid(a[0], a[1]), b: vid(b[0], b[1]), explicit: null });
    }
  }
  for (const xl of B.xlines) {
    rawEdges.push({ a: vid(Math.round(xl.a[0]), Math.round(xl.a[1])), b: vid(Math.round(xl.b[0]), Math.round(xl.b[1])), explicit: xl.props });
  }

  // Índice espacial de vértices.
  const VCELL = 64;
  const vgrid = new Map();
  verts.forEach(function (v, i) {
    const k = Math.floor(v[0] / VCELL) + ',' + Math.floor(v[1] / VCELL);
    let arr = vgrid.get(k);
    if (!arr) { arr = []; vgrid.set(k, arr); }
    arr.push(i);
  });

  // --- 4. Partir aristas en uniones en T ---
  const edges = [];
  for (const e of rawEdges) {
    const A = verts[e.a], Bv = verts[e.b];
    const dx = Bv[0] - A[0], dy = Bv[1] - A[1];
    const len2 = dx * dx + dy * dy;
    const pts = [];
    const x0 = Math.min(A[0], Bv[0]), x1 = Math.max(A[0], Bv[0]);
    const y0 = Math.min(A[1], Bv[1]), y1 = Math.max(A[1], Bv[1]);
    for (let cx = Math.floor(x0 / VCELL); cx <= Math.floor(x1 / VCELL); cx++) {
      for (let cy = Math.floor(y0 / VCELL); cy <= Math.floor(y1 / VCELL); cy++) {
        const arr = vgrid.get(cx + ',' + cy);
        if (!arr) continue;
        for (const vi of arr) {
          if (vi === e.a || vi === e.b) continue;
          const V = verts[vi];
          if (V[0] < x0 || V[0] > x1 || V[1] < y0 || V[1] > y1) continue;
          const cross = dx * (V[1] - A[1]) - dy * (V[0] - A[0]);
          if (cross !== 0) continue;
          const dot = (V[0] - A[0]) * dx + (V[1] - A[1]) * dy;
          if (dot > 0 && dot < len2) pts.push({ t: dot / len2, v: vi });
        }
      }
    }
    pts.sort(function (p, q) { return p.t - q.t; });
    let prev = e.a;
    for (const p of pts) {
      edges.push({ a: prev, b: p.v, explicit: e.explicit });
      prev = p.v;
    }
    edges.push({ a: prev, b: e.b, explicit: e.explicit });
  }

  // --- 5. Deduplicar ---
  const emap = new Map();
  for (const e of edges) {
    if (e.a === e.b) continue;
    const k = e.a < e.b ? e.a + ':' + e.b : e.b + ':' + e.a;
    const prev = emap.get(k);
    if (!prev) emap.set(k, e);
    else if (e.explicit && !prev.explicit) emap.set(k, e);
  }
  const uedges = Array.from(emap.values());

  // --- 6. Detectar cruces ilegales ---
  const ECELL = 128;
  const egrid = new Map();
  uedges.forEach(function (e, i) {
    const A = verts[e.a], Bv = verts[e.b];
    for (let cx = Math.floor(Math.min(A[0], Bv[0]) / ECELL); cx <= Math.floor(Math.max(A[0], Bv[0]) / ECELL); cx++) {
      for (let cy = Math.floor(Math.min(A[1], Bv[1]) / ECELL); cy <= Math.floor(Math.max(A[1], Bv[1]) / ECELL); cy++) {
        const k = cx + ',' + cy;
        let arr = egrid.get(k);
        if (!arr) { arr = []; egrid.set(k, arr); }
        arr.push(i);
      }
    }
  });
  const crossings = [];
  const checked = new Set();
  for (const arr of egrid.values()) {
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const ei = arr[i], ej = arr[j];
        const key = ei < ej ? ei + '|' + ej : ej + '|' + ei;
        if (checked.has(key)) continue;
        checked.add(key);
        const e1 = uedges[ei], e2 = uedges[ej];
        if (e1.a === e2.a || e1.a === e2.b || e1.b === e2.a || e1.b === e2.b) continue;
        const a = verts[e1.a], b = verts[e1.b], c = verts[e2.a], d = verts[e2.b];
        const o1 = MC_Orient(a[0], a[1], b[0], b[1], c[0], c[1]);
        const o2 = MC_Orient(a[0], a[1], b[0], b[1], d[0], d[1]);
        const o3 = MC_Orient(c[0], c[1], d[0], d[1], a[0], a[1]);
        const o4 = MC_Orient(c[0], c[1], d[0], d[1], b[0], b[1]);
        if (o1 * o2 < 0 && o3 * o4 < 0) {
          crossings.push('(' + a + ')-(' + b + ') x (' + c + ')-(' + d + ')');
        }
      }
    }
  }
  if (crossings.length) {
    throw new Error(def.lump + ': aristas que se cruzan:\n  ' + crossings.slice(0, 12).join('\n  '));
  }

  // --- 7. Clasificar lados y construir linedefs ---
  const lines = [];
  const sides = [];
  function texFor(poly, key) {
    if (!poly) return null;
    const p = poly.props;
    return p[key] || p.wall || null;
  }
  for (const e of uedges) {
    let va = verts[e.a], vb = verts[e.b];
    const dx = vb[0] - va[0], dy = vb[1] - va[1];
    const len = Math.hypot(dx, dy);
    const mx = (va[0] + vb[0]) / 2, my = (va[1] + vb[1]) / 2;
    const nx = -dy / len * 0.5, ny = dx / len * 0.5;   // normal izquierda
    let polyL = innermost(mx + nx, my + ny);
    let polyR = innermost(mx - nx, my - ny);
    let sL = polyL ? polyL.sector : -1;
    let sR = polyR ? polyR.sector : -1;
    let a = e.a, b = e.b;
    let ptL = [mx + nx, my + ny], ptR = [mx - nx, my - ny];
    if (sL < 0 && sR < 0) continue;
    if (sL === sR && !e.explicit) continue;
    if (sR < 0) {
      // el sector debe quedar a la derecha (lado frontal de DOOM)
      const t = a; a = b; b = t;
      let tp = polyL; polyL = polyR; polyR = tp;
      let ts = sL; sL = sR; sR = ts;
      const tpt = ptL; ptL = ptR; ptR = tpt;
    }
    const line = { v1: a, v2: b, flags: 0, special: 0, tag: 0, sidenum: [-1, -1], polyF: polyR, polyB: polyL, explicit: e.explicit };
    const secF = sectors[sR];
    if (sL < 0) {
      // Línea de una cara: muro.
      line.flags |= ML_BLOCKING;
      let tex;
      if (polyL && polyL.isvoid && !MC_PointInPoly(ptR[0], ptR[1], polyL.pts)) tex = polyL.props.wall || secF.props.wall;
      else tex = polyR.props.wall || secF.props.wall;
      if (secF.props.door) line.flags |= ML_DONTPEGBOTTOM; // jambas de puertas
      if (secF.props.unpegwall) line.flags |= ML_DONTPEGBOTTOM;
      line.sidenum[0] = sides.length;
      sides.push({ xoff: 0, yoff: 0, top: '-', bottom: '-', mid: tex, sector: sR });
    } else {
      line.flags |= ML_TWOSIDED;
      lines.push(line);
      line.twoSidedInfo = { sL: sL, polyL: polyL, ptL: ptL, ptR: ptR };
      continue;
    }
    lines.push(line);
  }

  // Líneas de dos caras: orientación de puertas/ascensores y texturas de desnivel.
  for (const line of lines) {
    if (!line.twoSidedInfo) continue;
    let polyF = line.polyF, polyB = line.polyB;
    let secF = sectors[polyF.sector], secB = sectors[polyB.sector];
    // Los portones deben quedar en el lado trasero de la línea.
    const isMover = function (s) { return !!s.props.door; };
    if (isMover(secF) && !isMover(secB)) {
      const t = line.v1; line.v1 = line.v2; line.v2 = t;
      const tp = polyF; polyF = polyB; polyB = tp;
      line.polyF = polyF; line.polyB = polyB;
      const ts = secF; secF = secB; secB = ts;
    }
    // ¿Qué polígono es el "hijo" (anidado dentro del otro)?
    const va = verts[line.v1], vb = verts[line.v2];
    const dx = vb[0] - va[0], dy = vb[1] - va[1];
    const len = Math.hypot(dx, dy);
    const mx = (va[0] + vb[0]) / 2, my = (va[1] + vb[1]) / 2;
    const nx = -dy / len * 0.5, ny = dx / len * 0.5;
    const ptBack = [mx + nx, my + ny], ptFront = [mx - nx, my - ny];
    let child = null;
    if (MC_PointInPoly(ptBack[0], ptBack[1], polyF.pts) && polyF !== polyB) child = 'B';
    else if (MC_PointInPoly(ptFront[0], ptFront[1], polyB.pts) && polyF !== polyB) child = 'F';

    function faceTex(kind, lowSide) {
      // kind 'upper' o 'lower'; lowSide = polígono que ve la cara.
      // Si uno es hijo del otro, el hijo define la textura; si no, el que forma el escalón.
      let owner;
      if (child === 'B') owner = polyB;
      else if (child === 'F') owner = polyF;
      else owner = lowSide === polyF ? polyB : polyF;
      return owner.props[kind] || owner.props.wall || '-';
    }

    const sideF = { xoff: 0, yoff: 0, top: '-', bottom: '-', mid: '-', sector: polyF.sector };
    const sideB = { xoff: 0, yoff: 0, top: '-', bottom: '-', mid: '-', sector: polyB.sector };
    // Las alturas se evalúan en el estado inicial; se asignan texturas a ambos
    // lados siempre que haya o pueda haber desnivel (puertas y ascensores se mueven).
    const moverF = isMover(secF), moverB = isMover(secB);
    if (secB.ceil < secF.ceil || moverB || moverF) sideF.top = faceTex('upper', polyF);
    if (secB.floor > secF.floor || moverB || moverF) sideF.bottom = faceTex('lower', polyF);
    if (secF.ceil < secB.ceil || moverF || moverB) sideB.top = faceTex('upper', polyB);
    if (secF.floor > secB.floor || moverF || moverB) sideB.bottom = faceTex('lower', polyB);
    // Las puertas usan su textura de hoja en la cara superior vista desde fuera.
    if (secB.props.door) { sideF.top = secB.props.upper || 'PUERTA1'; }
    if (secF.props.door) { sideB.top = secF.props.upper || 'PUERTA1'; }
    // Texturas enmascaradas (rejas, barandas): apoyadas en el piso.
    if (polyB.props.maskmid) { sideF.mid = polyB.props.maskmid; sideB.mid = polyB.props.maskmid; line.flags |= ML_DONTPEGBOTTOM; }
    if (polyF.props.maskmid) { sideF.mid = polyF.props.maskmid; sideB.mid = polyF.props.maskmid; line.flags |= ML_DONTPEGBOTTOM; }
    // Muros de un cuarto dentro de un bloque elevado: alinear la textura con el techo del cuarto.
    if (secB.floor >= secF.ceil || secF.floor >= secB.ceil) line.flags |= ML_DONTPEGBOTTOM;

    // Clavado de texturas: las caras superiores normales se alinean desde arriba;
    // las hojas de puerta no (deben moverse con la puerta).
    if (!secB.props.door && !secF.props.door) line.flags |= ML_DONTPEGTOP;
    if (secB.props.unpeglower || secF.props.unpeglower) line.flags |= ML_DONTPEGBOTTOM;
    if (polyB.props.blockall || polyF.props.blockall) line.flags |= ML_BLOCKING;
    if (polyB.props.blockmonsters || polyF.props.blockmonsters) line.flags |= ML_BLOCKMONSTERS;
    if (polyB.props.soundblock || polyF.props.soundblock) line.flags |= ML_SOUNDBLOCK;

    // Especiales automáticos.
    const d = secB.props.door;
    if (d && !secF.props.door) {
      const doorSpecials = { normal: 1, open: 31 };
      if (doorSpecials[d]) line.special = doorSpecials[d];
      if (d === 'secret') { line.special = 31; line.flags |= ML_SECRET; }
    }
    line.sidenum[0] = sides.length; sides.push(sideF);
    line.sidenum[1] = sides.length; sides.push(sideB);
    delete line.twoSidedInfo;
  }

  // Líneas explícitas: especiales, banderas, texturas.
  for (const line of lines) {
    const x = line.explicit;
    if (!x) continue;
    if (x.special) line.special = x.special;
    if (x.tag) line.tag = x.tag;
    if (x.flags) line.flags |= x.flags;
    if (x.blocking) line.flags |= ML_BLOCKING;
    if (x.mid) {
      for (const sn of line.sidenum) if (sn >= 0) sides[sn].mid = x.mid;
    }
  }

  // --- 8. Correcciones puntuales (fix) ---
  for (const f of B.fixes) {
    let best = null, bestd = Infinity;
    for (const line of lines) {
      const a = verts[line.v1], b = verts[line.v2];
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const l2 = dx * dx + dy * dy;
      let t = ((f.at[0] - a[0]) * dx + (f.at[1] - a[1]) * dy) / l2;
      t = Math.max(0, Math.min(1, t));
      const px = a[0] + dx * t, py = a[1] + dy * t;
      const dd = Math.hypot(f.at[0] - px, f.at[1] - py);
      if (dd < bestd) { bestd = dd; best = line; }
    }
    if (!best || bestd > 24) { warnings.push('fix sin línea cercana en ' + f.at); continue; }
    const p = f.props;
    if (p.special !== undefined) best.special = p.special;
    if (p.tag !== undefined) best.tag = p.tag;
    if (p.flags) best.flags |= p.flags;
    if (p.clearflags) best.flags &= ~p.clearflags;
    const s0 = best.sidenum[0] >= 0 ? sides[best.sidenum[0]] : null;
    const s1 = best.sidenum[1] >= 0 ? sides[best.sidenum[1]] : null;
    if (p.mid && s0) s0.mid = p.mid;
    if (p.top && s0) s0.top = p.top;
    if (p.bottom && s0) s0.bottom = p.bottom;
    if (p.backmid && s1) s1.mid = p.backmid;
    if (p.xoff !== undefined && s0) { s0.xoff = p.xoff; s0.fixedx = true; }
    if (p.yoff !== undefined && s0) s0.yoff = p.yoff;
  }

  // --- 9. Alineación automática de texturas en X ---
  for (const line of lines) {
    const a = verts[line.v1], b = verts[line.v2];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const ux = (b[0] - a[0]) / len, uy = (b[1] - a[1]) / len;
    const s0 = line.sidenum[0] >= 0 ? sides[line.sidenum[0]] : null;
    const s1 = line.sidenum[1] >= 0 ? sides[line.sidenum[1]] : null;
    if (s0 && !s0.fixedx) s0.xoff = Math.round(a[0] * ux + a[1] * uy);
    if (s1 && !s1.fixedx) s1.xoff = Math.round(-(b[0] * ux + b[1] * uy));
  }

  // --- 10. Cosas ---
  for (const t of B.things) {
    const p = innermost(t.x, t.y);
    if (!p || p.isvoid) warnings.push('cosa ' + t.type + ' fuera de un sector en (' + t.x + ',' + t.y + ')');
  }

  // Limpiar referencias internas.
  const outLines = lines.map(function (l) {
    return { v1: l.v1, v2: l.v2, flags: l.flags, special: l.special, tag: l.tag, sidenum: l.sidenum };
  });
  const outSectors = sectors.map(function (s) {
    return { floor: s.floor, ceil: s.ceil, ftex: s.ftex, ctex: s.ctex, light: s.light, special: s.special, tag: s.tag };
  });

  // Las etiquetas usadas por los eventos de batalla deben existir aunque ninguna línea las use.
  if (def.battle) {
    for (const o of def.battle.objectives || []) { if (o.kill) B.tag(o.kill); if (o.reach) B.tag(o.reach); }
    for (const e of def.battle.events || []) {
      if (e.tag) B.tag(e.tag);
      if (e.trigger && e.trigger.line) B.tag(e.trigger.line);
      for (const sp of e.spawn || []) { if (sp.tag) B.tag(sp.tag); if (sp.at) B.tag(sp.at); }
    }
    for (const b of def.battle.bombards || []) if (b.trigger && b.trigger.line) B.tag(b.trigger.line);
  }
  const map = {
    lump: def.lump,
    info: def.info || {},
    battle: def.battle || null,
    tagnames: Object.fromEntries(B.tagnames),
    vertexes: verts.map(function (v) { return { x: v[0], y: v[1] }; }),
    lines: outLines,
    sides: sides,
    sectors: outSectors,
    things: B.things,
    messages: B.messages,
    warnings: warnings
  };
  NB_BuildNodes(map);
  return map;
}
