// =============================================================================
// r_plane.js — Pisos y techos: "visplanes" (r_plane.c)
// -----------------------------------------------------------------------------
// Mientras se dibujan los muros, cada columna marca qué filas del piso y del
// techo del sector quedan visibles. Esas marcas se acumulan en visplanes (uno
// por combinación de altura, textura y luz). Al final, R_DrawPlanes convierte
// las columnas marcadas en tramos horizontales (R_MakeSpans) y los dibuja con
// R_DrawSpan, calculando la distancia por fila (yslope) como DOOM.
// =============================================================================
'use strict';

let visplanes = [];
let lastvisplane = 0;
let yslope = new Float64Array(1);
let distscale = new Float64Array(1);
let spanstart = new Int32Array(1);
let cachedheight = new Float64Array(1);
let cacheddistance = new Float64Array(1);
let cachedxstep = new Float64Array(1);
let cachedystep = new Float64Array(1);
let basexscale = 0, baseyscale = 0;
let planeheight = 0;
let planezlight = null;

function R_InitPlanes() {
  visplanes = [];
  lastvisplane = 0;
  yslope = new Float64Array(viewheight);
  distscale = new Float64Array(viewwidth);
  spanstart = new Int32Array(viewheight);
  cachedheight = new Float64Array(viewheight);
  cacheddistance = new Float64Array(viewheight);
  cachedxstep = new Float64Array(viewheight);
  cachedystep = new Float64Array(viewheight);
  R_yslopeCenter = NaN;
}

// Corrección de distancia por columna (depende del campo visual).
function R_InitDistScale() {
  for (let i = 0; i < viewwidth; i++) {
    const cosadj = Math.abs(Math.cos(xtoviewangle[i] * BAM2RAD));
    distscale[i] = 1 / cosadj;
  }
}

// Pendiente por fila respecto del horizonte (centery), que se mueve al mirar
// arriba o abajo y con el aumento de las miras.
let R_yslopeCenter = NaN, R_yslopeProj = NaN;
function R_SetupYSlope() {
  if (centery === R_yslopeCenter && projection === R_yslopeProj) return;
  R_yslopeCenter = centery;
  R_yslopeProj = projection;
  for (let i = 0; i < viewheight; i++) {
    const dy = Math.max(0.5, Math.abs(i + 0.5 - centery));
    yslope[i] = projection / dy;
  }
}

function R_NewVisplane() {
  let pl = visplanes[lastvisplane];
  if (!pl) {
    pl = {
      height: 0, picnum: 0, lightlevel: 0, minx: 0, maxx: 0,
      top: new Uint16Array(viewwidth + 2), bottom: new Uint16Array(viewwidth + 2)
    };
    visplanes[lastvisplane] = pl;
  }
  lastvisplane++;
  return pl;
}

function R_ClearPlanes() {
  for (let i = 0; i < viewwidth; i++) {
    floorclip[i] = viewheight;
    ceilingclip[i] = -1;
  }
  lastvisplane = 0;
  cachedheight.fill(0);
  const angle = (viewangle - ANG90) >>> 0;
  basexscale = Math.cos(angle * BAM2RAD) / projection;
  baseyscale = -Math.sin(angle * BAM2RAD) / projection;
}

function R_FindPlane(height, picnum, lightlevel) {
  for (let i = 0; i < lastvisplane; i++) {
    const c = visplanes[i];
    if (c.height === height && c.picnum === picnum && c.lightlevel === lightlevel) return c;
  }
  const pl = R_NewVisplane();
  pl.height = height;
  pl.picnum = picnum;
  pl.lightlevel = lightlevel;
  pl.minx = viewwidth;
  pl.maxx = -1;
  pl.top.fill(0xffff);
  return pl;
}

function R_CheckPlane(pl, start, stop) {
  let intrl, intrh, unionl, unionh;
  if (start < pl.minx) { intrl = pl.minx; unionl = start; }
  else { unionl = pl.minx; intrl = start; }
  if (stop > pl.maxx) { intrh = pl.maxx; unionh = stop; }
  else { unionh = pl.maxx; intrh = stop; }
  let x;
  for (x = intrl; x <= intrh; x++) if (pl.top[x + 1] !== 0xffff) break;
  if (x > intrh) {
    pl.minx = unionl;
    pl.maxx = unionh;
    return pl;
  }
  // Hace falta un visplane nuevo.
  const np = R_NewVisplane();
  np.height = pl.height;
  np.picnum = pl.picnum;
  np.lightlevel = pl.lightlevel;
  np.minx = start;
  np.maxx = stop;
  np.top.fill(0xffff);
  return np;
}

function R_MapPlane(y, x1, x2) {
  let distance;
  if (planeheight !== cachedheight[y]) {
    cachedheight[y] = planeheight;
    distance = cacheddistance[y] = planeheight * yslope[y];
    ds_xstep = cachedxstep[y] = distance * basexscale;
    ds_ystep = cachedystep[y] = distance * baseyscale;
  } else {
    distance = cacheddistance[y];
    ds_xstep = cachedxstep[y];
    ds_ystep = cachedystep[y];
  }
  const length = distance * distscale[x1];
  const angle = ((viewangle + xtoviewangle[x1]) >>> 0) * BAM2RAD;
  ds_xfrac = viewx + Math.cos(angle) * length;
  ds_yfrac = -viewy - Math.sin(angle) * length;
  if (fixedcolormap >= 0) ds_colormap = fixedcolormap;
  else {
    let index = Math.floor(distance / R_ZLIGHTDIV);
    if (index >= R_ZLIGHTS) index = R_ZLIGHTS - 1;
    ds_colormap = planezlight[index];
  }
  ds_y = y;
  ds_x1 = x1;
  ds_x2 = x2;
  R_DrawSpan();
}

function R_MakeSpans(x, t1, b1, t2, b2) {
  while (t1 < t2 && t1 <= b1) {
    R_MapPlane(t1, spanstart[t1], x - 1);
    t1++;
  }
  while (b1 > b2 && b1 >= t1) {
    R_MapPlane(b1, spanstart[b1], x - 1);
    b1--;
  }
  while (t2 < t1 && t2 <= b2) {
    spanstart[t2] = x;
    t2++;
  }
  while (b2 > b1 && b2 >= t2) {
    spanstart[b2] = x;
    b2--;
  }
}

function R_DrawPlanes() {
  for (let i = 0; i < lastvisplane; i++) {
    const pl = visplanes[i];
    if (pl.minx > pl.maxx) continue;
    if (pl.picnum === skyflatnum) continue; // el cielo es fondo (r_sky.js)
    ds_source = flats[flattranslation[pl.picnum]];
    planeheight = Math.abs(pl.height - viewz);
    let light = (pl.lightlevel >> LIGHTSEGSHIFT) + extralight;
    if (light >= LIGHTLEVELS) light = LIGHTLEVELS - 1;
    if (light < 0) light = 0;
    planezlight = zlight[light];
    // Relleno de los extremos (top[-1] y top[maxx+1] de DOOM).
    pl.top[pl.maxx + 2] = 0xffff;
    pl.top[pl.minx] = 0xffff;
    const stop = pl.maxx + 1;
    const top = pl.top, bottom = pl.bottom;
    for (let x = pl.minx; x <= stop; x++) {
      let t1 = top[x], b1 = bottom[x], t2 = top[x + 1], b2 = bottom[x + 1];
      if (t1 === 0xffff) { t1 = viewheight; b1 = 0; }
      if (t2 === 0xffff) { t2 = viewheight; b2 = 0; }
      R_MakeSpans(x, t1, b1 - 0, t2, b2);
    }
  }
}
