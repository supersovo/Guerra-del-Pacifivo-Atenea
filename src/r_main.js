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
let basecentery = 84;            // centro vertical de la vista con la mirada horizontal
let projection = 160;
let baseprojection = 160;        // proyección sin el aumento de las miras
let viewpitch = 0;               // pendiente de la mirada: tan(ángulo vertical)
let R_curZoom = -1;              // aumento con el que se calcularon las tablas
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
  centery = basecentery = viewheight / 2;
  // Proyección "Hor+": el campo vertical es el de DOOM a 4:3; el horizontal se
  // amplía en pantallas panorámicas.
  baseprojection = (setblocks >= 10 ? 160 * SCALE : 160 * SCALE * setblocks / 10);

  R_InitBuffer(viewwidth, viewheight, viewwindowx, viewwindowy);
  R_InitPlanes();
  R_InitSegArrays();
  R_InitLightTables();
  R_InitSpriteArrays();
  R_curZoom = -1;
  R_SetProjection(1);
  ST_ViewSizeChanged();
}

// Proyección con el aumento de las miras (1 = sin aumento). Recalcula las
// tablas que dependen del campo visual: ángulo por columna, corrección de
// distancia de los planos y escala del cielo. La iluminación no cambia: el
// índice de luz se toma de la escala dividida por la proyección.
function R_SetProjection(zoom) {
  if (zoom === R_curZoom) return;
  R_curZoom = zoom;
  projection = baseprojection * zoom;
  lightscalemul = 16 * 160 / projection;
  R_InitTextureMapping();
  R_InitDistScale();
  R_InitSkyMap();
}

function R_InitTextureMapping() {
  const focallength = projection;
  const half = FINEANGLES / 2;
  if (viewangletox.length !== half) viewangletox = new Int32Array(half);
  for (let i = 0; i < half; i++) {
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
  // xtoviewangle[x] = menor ángulo cuya columna es <= x. viewangletox decrece
  // con el ángulo, así que se recorre x de derecha a izquierda (lineal).
  if (xtoviewangle.length !== viewwidth + 1) xtoviewangle = new Uint32Array(viewwidth + 1);
  let i = 0;
  for (let x = viewwidth; x >= 0; x--) {
    while (i < half - 1 && viewangletox[i] > x) i++;
    xtoviewangle[x] = ((i << ANGLETOFINESHIFT) - ANG90) >>> 0;
  }
  for (let k = 0; k < half; k++) {
    if (viewangletox[k] === -1) viewangletox[k] = 0;
    else if (viewangletox[k] === viewwidth + 1) viewangletox[k] = viewwidth;
  }
  clipangle = xtoviewangle[0];
}

// --- Luz y bruma ----------------------------------------------------------------------------
// Los índices de luz son cuatro veces más finos que en DOOM para distinguir
// lejanías de miles de unidades: muros y sprites usan escala·lightscalemul·4
// (R_SCALELIGHTS entradas, lo cercano satura igual que en DOOM) y los planos,
// distancia/32 (hasta 10.240 unidades).
// Con bruma (campo abierto) la luz del sector no se apaga con la distancia
// como en los pasillos de DOOM: lo lejano se funde con el color del horizonte
// (perspectiva aérea), a través de las tablas de PAL_BuildFogMaps; el
// desplazamiento de cada entrada es (bloque de bruma·34 + nivel)·256.
const R_SCALEK = 4;
const R_SCALELIGHTS = MAXLIGHTSCALE * R_SCALEK;
const R_ZLIGHTDIV = 32;
const R_ZLIGHTS = 320;
let R_haze = null;               // { color, start, dist, max } o null (sin bruma)
let R_colormapBase = null;       // COLORMAP de DOOM (bloque 0)

function R_HazeBlock(dist) {
  if (!R_haze) return 0;
  const d = dist - R_haze.start;
  if (d <= 0) return 0;
  return Math.min(NUMHAZE - 1, Math.round((1 - Math.exp(-d / R_haze.dist)) * (NUMHAZE - 1)));
}

function R_InitLightTables() {
  scalelight = [];
  zlight = [];
  for (let i = 0; i < LIGHTLEVELS; i++) {
    const startmap = ((LIGHTLEVELS - 1 - i) * 2) * NUMCOLORMAPS / LIGHTLEVELS;
    const flat = Math.floor(startmap * 0.4);   // nivel único con bruma
    const zl = new Int32Array(R_ZLIGHTS);
    for (let j = 0; j < R_ZLIGHTS; j++) {
      const dist = (j + 0.5) * R_ZLIGHTDIV;
      let level = R_haze ? flat : Math.floor(startmap - 160 / (dist / 16 + 1) / 2);
      if (level < 0) level = 0;
      if (level >= NUMCOLORMAPS) level = NUMCOLORMAPS - 1;
      zl[j] = (R_HazeBlock(dist) * 34 + level) * 256;
    }
    zlight.push(zl);
    const sl = new Int32Array(R_SCALELIGHTS);
    for (let j = 0; j < R_SCALELIGHTS; j++) {
      const dist = j > 0 ? 2560 * R_SCALEK / j : 16384;
      let level = R_haze ? flat : Math.floor(startmap - j / R_SCALEK / 2);
      if (level < 0) level = 0;
      if (level >= NUMCOLORMAPS) level = NUMCOLORMAPS - 1;
      sl[j] = (R_HazeBlock(dist) * 34 + level) * 256;
    }
    scalelight.push(sl);
  }
}

// Bruma del mapa: color del horizonte de su cielo (o levelinfo.haze) y
// distancias de levelinfo.hazeStart / hazeDist. levelinfo.haze === false la quita.
function R_SetupHaze(info) {
  if (!R_colormapBase) R_colormapBase = colormaps;
  if (info && info.haze === false) {
    R_haze = null;
    colormaps = R_colormapBase;
  } else {
    let color = info && Array.isArray(info.haze) ? info.haze : R_SkyHorizonColor();
    R_haze = { color: color, start: (info && info.hazeStart) || 200, dist: (info && info.hazeDist) || 4200, max: (info && info.hazeMax) || 0.85 };
    colormaps = PAL_BuildFogMaps(R_colormapBase, color, R_haze.max);
  }
  R_InitLightTables();
}

// Color medio del cielo justo sobre el horizonte, algo agrisado (polvo).
function R_SkyHorizonColor() {
  const t = textures[skytexture];
  if (!t || !t.columns) return [200, 200, 196];
  const d = t.density || 1;
  let r = 0, g = 0, b = 0, n = 0;
  for (let x = 0; x < t.width; x += 4) {
    const col = t.columns[x];
    for (let y = skytexturemid - 7 * d; y < skytexturemid - d; y++) {
      if (y < 0 || y >= col.length) continue;
      const c = col[y];
      r += PAL_BASE[c * 3]; g += PAL_BASE[c * 3 + 1]; b += PAL_BASE[c * 3 + 2]; n++;
    }
  }
  if (!n) return [200, 200, 196];
  const dust = [200, 190, 172];
  return [r / n * 0.8 + dust[0] * 0.2, g / n * 0.8 + dust[1] * 0.2, b / n * 0.8 + dust[2] * 0.2].map(Math.round);
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
  // (sin retardo y sin saltos al consumirse en el siguiente tic). Igual la
  // mirada vertical.
  viewangle = (mo.angle + G_PendingTurn()) >>> 0;
  // Aumento de las miras y mirada vertical ("y-shearing", como Heretic): el
  // horizonte se desplaza en la pantalla según la pendiente de la mirada.
  R_SetProjection(P_ViewZoom(player, f));
  viewpitch = Math.tan(clamp(player.pitch + G_PendingPitch(), -MAXPITCH, MAXPITCH));
  centery = basecentery + viewpitch * projection;
  R_SetupYSlope();
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
  R_AddSmokeSprites();
  R_DrawPlanes();
  R_DrawMasked();
  for (let i = 0; i < saved.length; i += 3) {
    saved[i].floorheight = saved[i + 1];
    saved[i].ceilingheight = saved[i + 2];
  }
}
