// =============================================================================
// p_setup.js — Carga de niveles (p_setup.c)
// -----------------------------------------------------------------------------
// Lee los lumps del mapa (VERTEXES, LINEDEFS, SIDEDEFS, SECTORS, SEGS,
// SSECTORS, NODES, THINGS), construye las estructuras en memoria, agrupa las
// líneas por sector, genera el BLOCKMAP (rejilla de 128x128 para colisiones) y
// hace aparecer los objetos del mapa según la dificultad.
// =============================================================================
'use strict';

let blockmaplists = [];          // por celda: arreglo de líneas
let bmaporgx = 0, bmaporgy = 0, bmapwidth = 0, bmapheight = 0;
let blocklinks = [];             // por celda: primer mobj enlazado
let playerstarts = [];
let totalkills = 0, totalitems = 0, totalsecret = 0;
let levelmessages = {};
let levelinfo = null;
let mapthings = [];

function P_LoadVertexes(map) {
  vertexes = map.glverts.map(function (v) { return { x: v.x, y: v.y }; });
}

function P_LoadSectors(map) {
  sectors = map.sectors.map(function (s, i) {
    return {
      id: i,
      floorheight: s.floor, ceilingheight: s.ceil,
      oldfloorheight: s.floor, oldceilingheight: s.ceil,
      floorpic: R_FlatNumForName(s.ftex), ceilingpic: R_FlatNumForName(s.ctex),
      lightlevel: s.light, special: s.special, tag: s.tag,
      soundtraversed: 0, soundtarget: null,
      blockbox: [0, 0, 0, 0], soundorg: { x: 0, y: 0, z: 0, isorigin: true },
      validcount: 0, thinglist: null, specialdata: null, lightdata: null,
      lines: [], linecount: 0, moving: false
    };
  });
}

function P_LoadSideDefs(map) {
  sides = map.sides.map(function (s) {
    return {
      textureoffset: s.xoff || 0, rowoffset: s.yoff || 0,
      toptexture: R_TextureNumForName(s.top),
      bottomtexture: R_TextureNumForName(s.bottom),
      midtexture: R_TextureNumForName(s.mid),
      sector: sectors[s.sector]
    };
  });
}

function P_LoadLineDefs(map) {
  lines = map.lines.map(function (l, i) {
    const v1 = vertexes[l.v1], v2 = vertexes[l.v2];
    const dx = v2.x - v1.x, dy = v2.y - v1.y;
    let slopetype;
    if (dx === 0) slopetype = ST_VERTICAL;
    else if (dy === 0) slopetype = ST_HORIZONTAL;
    else slopetype = (dy / dx > 0) ? ST_POSITIVE : ST_NEGATIVE;
    const line = {
      id: i, v1: v1, v2: v2, dx: dx, dy: dy,
      flags: l.flags, special: l.special, tag: l.tag,
      sidenum: [l.sidenum[0], l.sidenum[1]],
      bbox: [Math.max(v1.y, v2.y), Math.min(v1.y, v2.y), Math.min(v1.x, v2.x), Math.max(v1.x, v2.x)],
      slopetype: slopetype,
      frontsector: l.sidenum[0] >= 0 ? sides[l.sidenum[0]].sector : null,
      backsector: l.sidenum[1] >= 0 ? sides[l.sidenum[1]].sector : null,
      validcount: 0, specialdata: null
    };
    return line;
  });
}

function P_LoadSegs(map) {
  segs = map.segs.map(function (s) {
    const ld = lines[s.linedef];
    const v1 = vertexes[s.v1], v2 = vertexes[s.v2];
    const side = s.side;
    const sd = sides[ld.sidenum[side]];
    return {
      v1: v1, v2: v2, offset: s.offset,
      angle: R_PointToAngle2(v1.x, v1.y, v2.x, v2.y),
      sidedef: sd, linedef: ld,
      frontsector: sd.sector,
      backsector: (ld.flags & ML_TWOSIDED) && ld.sidenum[side ^ 1] >= 0 ? sides[ld.sidenum[side ^ 1]].sector : null
    };
  });
}

function P_LoadSubsectors(map) {
  subsectors = map.subsectors.map(function (s) {
    return { firstline: s.firstline, numlines: s.numlines, sector: segs[s.firstline].sidedef.sector };
  });
}

function P_LoadNodes(map) {
  nodes = map.nodes.map(function (n) {
    return { x: n.x, y: n.y, dx: n.dx, dy: n.dy, bbox: [n.bbox[0].slice(), n.bbox[1].slice()], children: [n.children[0], n.children[1]] };
  });
  rootnode = map.rootnode;
}

// P_GroupLines: líneas por sector, cajas y orígenes de sonido.
function P_GroupLines() {
  for (const ld of lines) {
    if (ld.frontsector) ld.frontsector.lines.push(ld);
    if (ld.backsector && ld.backsector !== ld.frontsector) ld.backsector.lines.push(ld);
  }
  for (const sec of sectors) {
    sec.linecount = sec.lines.length;
    const box = [0, 0, 0, 0];
    M_ClearBox(box);
    for (const ld of sec.lines) {
      M_AddToBox(box, ld.v1.x, ld.v1.y);
      M_AddToBox(box, ld.v2.x, ld.v2.y);
    }
    sec.soundorg.x = (box[BOXRIGHT] + box[BOXLEFT]) / 2;
    sec.soundorg.y = (box[BOXTOP] + box[BOXBOTTOM]) / 2;
    sec.bbox = box;
    let block = Math.floor((box[BOXTOP] - bmaporgy + MAXRADIUS) / MAPBLOCKSIZE);
    sec.blockbox[BOXTOP] = block >= bmapheight ? bmapheight - 1 : block;
    block = Math.floor((box[BOXBOTTOM] - bmaporgy - MAXRADIUS) / MAPBLOCKSIZE);
    sec.blockbox[BOXBOTTOM] = block < 0 ? 0 : block;
    block = Math.floor((box[BOXRIGHT] - bmaporgx + MAXRADIUS) / MAPBLOCKSIZE);
    sec.blockbox[BOXRIGHT] = block >= bmapwidth ? bmapwidth - 1 : block;
    block = Math.floor((box[BOXLEFT] - bmaporgx - MAXRADIUS) / MAPBLOCKSIZE);
    sec.blockbox[BOXLEFT] = block < 0 ? 0 : block;
  }
}

// ¿El segmento (x1,y1)-(x2,y2) toca el rectángulo?
function P_SegTouchesBox(x1, y1, x2, y2, bx0, by0, bx1, by1) {
  // Liang–Barsky
  let t0 = 0, t1 = 1;
  const dx = x2 - x1, dy = y2 - y1;
  const p = [-dx, dx, -dy, dy];
  const q = [x1 - bx0, bx1 - x1, y1 - by0, by1 - y1];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false;
    } else {
      const r = q[i] / p[i];
      if (p[i] < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
      else { if (r < t0) return false; if (r < t1) t1 = r; }
    }
  }
  return true;
}

function P_BuildBlockmap() {
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  for (const v of vertexes) {
    if (v.x < minx) minx = v.x; if (v.x > maxx) maxx = v.x;
    if (v.y < miny) miny = v.y; if (v.y > maxy) maxy = v.y;
  }
  bmaporgx = Math.floor(minx) - 8;
  bmaporgy = Math.floor(miny) - 8;
  bmapwidth = Math.floor((maxx - bmaporgx) / MAPBLOCKSIZE) + 1;
  bmapheight = Math.floor((maxy - bmaporgy) / MAPBLOCKSIZE) + 1;
  blockmaplists = new Array(bmapwidth * bmapheight);
  for (let i = 0; i < blockmaplists.length; i++) blockmaplists[i] = [];
  for (const ld of lines) {
    const bx0 = Math.floor((ld.bbox[BOXLEFT] - bmaporgx) / MAPBLOCKSIZE);
    const bx1 = Math.floor((ld.bbox[BOXRIGHT] - bmaporgx) / MAPBLOCKSIZE);
    const by0 = Math.floor((ld.bbox[BOXBOTTOM] - bmaporgy) / MAPBLOCKSIZE);
    const by1 = Math.floor((ld.bbox[BOXTOP] - bmaporgy) / MAPBLOCKSIZE);
    for (let by = by0; by <= by1; by++) {
      for (let bx = bx0; bx <= bx1; bx++) {
        const cx0 = bmaporgx + bx * MAPBLOCKSIZE, cy0 = bmaporgy + by * MAPBLOCKSIZE;
        if (P_SegTouchesBox(ld.v1.x, ld.v1.y, ld.v2.x, ld.v2.y, cx0, cy0, cx0 + MAPBLOCKSIZE, cy0 + MAPBLOCKSIZE)) {
          blockmaplists[by * bmapwidth + bx].push(ld);
        }
      }
    }
  }
  blocklinks = new Array(bmapwidth * bmapheight).fill(null);
}

// P_SetupLevel: carga un mapa completo.
function P_SetupLevel(mapname, skill) {
  const map = W_CacheLumpName(mapname);
  levelinfo = map.info || {};
  totalkills = totalitems = totalsecret = 0;
  wminfo_maxfrags = 0;
  P_InitThinkers();
  leveltime = 0;
  P_LoadVertexes(map);
  P_LoadSectors(map);
  P_LoadSideDefs(map);
  P_LoadLineDefs(map);
  P_LoadSegs(map);
  P_LoadSubsectors(map);
  P_LoadNodes(map);
  P_BuildBlockmap();
  P_GroupLines();
  levelmessages = map.messages || {};
  R_movingSectors = [];
  gibList = [];
  B_InitBattle(map);
  // Objetos del mapa.
  playerstarts = [];
  mapthings = map.things;
  for (const mt of map.things) P_SpawnMapThing(mt, skill);
  if (!playerstarts.length) throw new Error('P_SetupLevel: el mapa no tiene inicio de jugador');
  P_SpawnSpecials();
  R_SetSky(levelinfo.sky || 'CIELO1', levelinfo.skyhorizon);
}

let wminfo_maxfrags = 0;
