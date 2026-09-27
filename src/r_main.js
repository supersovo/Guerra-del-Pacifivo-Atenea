// =============================================================================
// r_main.js — Núcleo del renderizador (r_main.c)
// -----------------------------------------------------------------------------
// Configura la proyección, las tablas de ángulo por columna, las tablas de luz
// y ejecuta R_RenderPlayerView: recorrido BSP (r_bsp), muros (r_segs), planos
// (r_plane) y objetos enmascarados (r_things), en ese orden, como DOOM.
// =============================================================================
'use strict';

// Vista
let viewx = 0, viewy = 0, viewz = 0;
let viewangle = 0;
let viewcos = 1, viewsin = 0;
let viewplayer = null;
let extralight = 0;
let fixedcolormap = -1;          // desplazamiento en COLORMAP o -1
let validcount = 1;
let framecount = 0;
let leveltime_render = 0;

// Ventana de vista
let viewwidth = 320, viewheight = 168;
let scaledviewwidth = 320;
let viewwindowx = 0, viewwindowy = 0;
let centerx = 160, centery = 84;
let projection = 160;
let lightscalemul = 16;
let setsizeneeded = true;
let setblocks = 10;

// Tablas
let viewangletox = new Int32Array(FINEANGLES / 2);
let xtoviewangle = new Uint32Array(1);
let clipangle = 0;
let scalelight = [];             // [LIGHTLEVELS][MAXLIGHTSCALE] -> desplazamiento COLORMAP
let zlight = [];                 // [LIGHTLEVELS][MAXLIGHTZ]
let scalelightfixed = new Int32Array(MAXLIGHTSCALE);

// Mapa actual (lo rellena p_setup)
let vertexes = [], segs = [], sectors = [], subsectors = [], nodes = [], lines = [], sides = [];
let rootnode = 0;

// --- Utilidades geométricas --------------------------------------------------------
function R_PointOnSide(x, y, node) {
  if (node.dx === 0) {
    if (x <= node.x) return node.dy > 0 ? 1 : 0;
    return node.dy < 0 ? 1 : 0;
  }
  if (node.dy === 0) {
    if (y <= node.y) return node.dx < 0 ? 1 : 0;
    return node.dx > 0 ? 1 : 0;
  }
  const left = node.dy * (x - node.x);
  const right = (y - node.y) * node.dx;
  return right < left ? 0 : 1;
}

function R_PointOnSegSide(x, y, seg) {
  const lx = seg.v1.x, ly = seg.v1.y;
  const ldx = seg.v2.x - lx, ldy = seg.v2.y - ly;
  if (ldx === 0) {
    if (x <= lx) return ldy > 0 ? 1 : 0;
    return ldy < 0 ? 1 : 0;
  }
  if (ldy === 0) {
    if (y <= ly) return ldx < 0 ? 1 : 0;
    return ldx > 0 ? 1 : 0;
  }
  const left = ldy * (x - lx);
  const right = (y - ly) * ldx;
  return right < left ? 0 : 1;
}

function R_PointToAngle(x, y) {
  return R_PointToAngle2(viewx, viewy, x, y);
}

function R_PointToDist(x, y) {
  return Math.hypot(x - viewx, y - viewy);
}

function R_PointInSubsector(x, y) {
  let nodenum = rootnode;
  if (!nodes.length) return subsectors[0];
  while (!(nodenum & NF_SUBSECTOR)) {
    const node = nodes[nodenum];
    nodenum = node.children[R_PointOnSide(x, y, node)];
  }
  return subsectors[nodenum & ~NF_SUBSECTOR];
}

// --- Tamaño de vista -------------------------------------------------------------------
function R_SetViewSize(blocks) {
  setsizeneeded = true;
  setblocks = blocks;
}

function R_ExecuteSetViewSize() {
  setsizeneeded = false;
  const stbar = ST_HEIGHT * SCALE;
  if (setblocks >= 11) {
    scaledviewwidth = SCREENWIDTH;
    viewheight = SCREENHEIGHT;
  } else if (setblocks === 10) {
    scaledviewwidth = SCREENWIDTH;
    viewheight = SCREENHEIGHT - stbar;
  } else {
    // ventana reducida (como las teclas -/+ de DOOM)
    const full = SCREENHEIGHT - stbar;
    viewheight = Math.floor(full * setblocks / 10) & ~1;
    scaledviewwidth = Math.floor(SCREENWIDTH * setblocks / 10) & ~1;
  }
  viewwidth = scaledviewwidth;
  viewwindowx = (SCREENWIDTH - viewwidth) >> 1;
  viewwindowy = setblocks >= 10 ? 0 : ((SCREENHEIGHT - stbar - viewheight) >> 1);
  centerx = viewwidth / 2;
  centery = viewheight / 2;
  // Proyección "Hor+": el campo vertical es el de DOOM a 4:3; el horizontal se
  // amplía en pantallas panorámicas.
  projection = (setblocks >= 10 ? 160 * SCALE : 160 * SCALE * setblocks / 10);
  lightscalemul = 16 * 160 / projection;

  R_InitBuffer(viewwidth, viewheight, viewwindowx, viewwindowy);
  R_InitTextureMapping();
  R_InitPlanes();
  R_InitSegArrays();
  R_InitLightTables();
  R_InitSkyMap();
  R_InitSpriteArrays();
  ST_ViewSizeChanged();
}

function R_InitTextureMapping() {
  const focallength = projection;
  viewangletox = new Int32Array(FINEANGLES / 2);
  for (let i = 0; i < FINEANGLES / 2; i++) {
    const tan = finetangent[i];
    let t;
    if (tan > 2) t = -1;
    else if (tan < -2) t = viewwidth + 1;
    else {
      t = Math.ceil(centerx - tan * focallength);
      if (t < -1) t = -1;
      else if (t > viewwidth + 1) t = viewwidth + 1;
    }
    viewangletox[i] = t;
  }
  xtoviewangle = new Uint32Array(viewwidth + 1);
  for (let x = 0; x <= viewwidth; x++) {
    let i = 0;
    while (viewangletox[i] > x) i++;
    xtoviewangle[x] = ((i << ANGLETOFINESHIFT) - ANG90) >>> 0;
  }
  for (let i = 0; i < FINEANGLES / 2; i++) {
    if (viewangletox[i] === -1) viewangletox[i] = 0;
    else if (viewangletox[i] === viewwidth + 1) viewangletox[i] = viewwidth;
  }
  clipangle = xtoviewangle[0];
}

function R_InitLightTables() {
  scalelight = [];
  zlight = [];
  for (let i = 0; i < LIGHTLEVELS; i++) {
    const startmap = ((LIGHTLEVELS - 1 - i) * 2) * NUMCOLORMAPS / LIGHTLEVELS;
    const zl = new Int32Array(MAXLIGHTZ);
    for (let j = 0; j < MAXLIGHTZ; j++) {
      const scale = 160 / (j + 1);
      let level = Math.floor(startmap - scale / 2);
      if (level < 0) level = 0;
      if (level >= NUMCOLORMAPS) level = NUMCOLORMAPS - 1;
      zl[j] = level * 256;
    }
    zlight.push(zl);
    const sl = new Int32Array(MAXLIGHTSCALE);
    for (let j = 0; j < MAXLIGHTSCALE; j++) {
      let level = Math.floor(startmap - j / 2);
      if (level < 0) level = 0;
      if (level >= NUMCOLORMAPS) level = NUMCOLORMAPS - 1;
      sl[j] = level * 256;
    }
    scalelight.push(sl);
  }
}

// --- Interpolación entre tics ------------------------------------------------------------
let R_interpFrac = 1;

function R_Lerp(a, b) { return a + (b - a) * R_interpFrac; }
function R_LerpAngle(a, b) {
  const d = ((b - a) | 0);
  return (a + d * R_interpFrac) >>> 0;
}

// Sectores con planos en movimiento (puertas, ascensores) para interpolar.
let R_movingSectors = [];

// --- Preparación del cuadro --------------------------------------------------------------
function R_SetupFrame(player) {
  viewplayer = player;
  const mo = player.mo;
  const f = R_interpFrac;
  if (defaults.interpolate && f < 1 && mo.oldvalid) {
    viewx = mo.oldx + (mo.x - mo.oldx) * f;
    viewy = mo.oldy + (mo.y - mo.oldy) * f;
    viewz = player.oldviewz + (player.viewz - player.oldviewz) * f;
  } else {
    viewx = mo.x; viewy = mo.y; viewz = player.viewz;
  }
  // El ángulo no se interpola: se usa el último más el giro de ratón pendiente
  // (sin retardo y sin saltos al consumirse en el siguiente tic).
  viewangle = (mo.angle + G_PendingTurn()) >>> 0;
  if (screenShake > 0) {
    viewx += (M_Random() - 128) / 64 * Math.min(4, screenShake / 8);
    viewy += (M_Random() - 128) / 64 * Math.min(4, screenShake / 8);
  }
  extralight = player.extralight;
  viewsin = FineSin(viewangle);
  viewcos = FineCos(viewangle);
  fixedcolormap = player.fixedcolormap >= 0 ? player.fixedcolormap * 256 : -1;
  if (fixedcolormap >= 0) scalelightfixed.fill(fixedcolormap);
  framecount++;
  validcount++;
}

function R_RenderPlayerView(player) {
  if (setsizeneeded) R_ExecuteSetViewSize();
  // Interpolar alturas de sectores en movimiento.
  const saved = [];
  if (defaults.interpolate && R_interpFrac < 1) {
    for (const sec of R_movingSectors) {
      saved.push(sec, sec.floorheight, sec.ceilingheight);
      sec.floorheight = sec.oldfloorheight + (sec.floorheight - sec.oldfloorheight) * R_interpFrac;
      sec.ceilingheight = sec.oldceilingheight + (sec.ceilingheight - sec.oldceilingheight) * R_interpFrac;
    }
  }
  R_SetupFrame(player);
  R_ClearClipSegs();
  R_ClearDrawSegs();
  R_ClearPlanes();
  R_ClearSprites();
  R_DrawSkyBackground();
  R_RenderBSPNode(rootnode);
  R_DrawPlanes();
  R_DrawMasked();
  for (let i = 0; i < saved.length; i += 3) {
    saved[i].floorheight = saved[i + 1];
    saved[i].ceilingheight = saved[i + 2];
  }
}
