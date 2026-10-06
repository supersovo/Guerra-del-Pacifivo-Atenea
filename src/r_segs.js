// =============================================================================
// r_segs.js — Dibujo de muros (r_segs.c)
// -----------------------------------------------------------------------------
// R_StoreWallRange calcula, para un rango de columnas de un seg, la escala en
// cada extremo, qué texturas se ven (superior, media, inferior), y marca en los
// visplanes las zonas de piso y techo. Luego R_RenderSegLoop dibuja columna a
// columna y actualiza los recortes (floorclip / ceilingclip). Cada seg deja un
// "drawseg" con su silueta para recortar después los sprites.
// =============================================================================
'use strict';

const HALFPI = Math.PI / 2;
const MAXSHORTCOL = 0x7fffffff;

let rw_x = 0, rw_stopx = 0;
let rw_centerangle = 0, rw_normalangle = 0;
let rw_offset = 0, rw_distance = 0;
let rw_scale = 0, rw_scalestep = 0;
let rw_midtexturemid = 0, rw_toptexturemid = 0, rw_bottomtexturemid = 0;
let worldtop = 0, worldbottom = 0, worldhigh = 0, worldlow = 0;
let pixhigh = 0, pixlow = 0, pixhighstep = 0, pixlowstep = 0;
let topfrac = 0, topstep = 0, bottomfrac = 0, bottomstep = 0;
let walllights = null;
let markfloor = false, markceiling = false, maskedtexture = false;
let toptexture = 0, bottomtexture = 0, midtexture = 0, segtextured = 0;
let skypass = false;
let maskedofs = 0;
let maskeddensity = 1;

// Altura de una textura en unidades de mapa (puede tener más de un texel por
// unidad: density).
function R_TexHeight(tex) {
  const t = textures[tex];
  return t.height / (t.density || 1);
}

let drawsegs = [];
let ds_p = 0;
let openings = new Int32Array(1);
let lastopening = 0;
let floorclip = new Int32Array(1);
let ceilingclip = new Int32Array(1);
let screenheightarray = new Int32Array(1);
let negonearray = new Int32Array(1);

function R_InitSegArrays() {
  floorclip = new Int32Array(viewwidth);
  ceilingclip = new Int32Array(viewwidth);
  screenheightarray = new Int32Array(viewwidth).fill(viewheight);
  negonearray = new Int32Array(viewwidth).fill(-1);
  openings = new Int32Array(viewwidth * 96);
}

function R_ClearDrawSegs() {
  ds_p = 0;
  lastopening = 0;
}

function R_NewDrawseg() {
  let ds = drawsegs[ds_p];
  if (!ds) {
    ds = {
      curline: null, x1: 0, x2: 0, scale1: 0, scale2: 0, scalestep: 0,
      silhouette: 0, bsilheight: 0, tsilheight: 0,
      sprtopclip: null, sprtopofs: 0, sprbottomclip: null, sprbottomofs: 0,
      maskedtexturecol: null, maskedofs: 0
    };
    drawsegs[ds_p] = ds;
  }
  ds_p++;
  return ds;
}

function R_EnsureOpenings(n) {
  if (lastopening + n <= openings.length) return true;
  // Crecer el arreglo (DOOM tenía un límite fijo; aquí se amplía).
  const bigger = new Int32Array(Math.max(openings.length * 2, lastopening + n + 1024));
  bigger.set(openings);
  // Las referencias en drawsegs apuntan al arreglo viejo: actualizarlas.
  for (let i = 0; i < ds_p; i++) {
    const ds = drawsegs[i];
    if (ds.sprtopclip === openings) ds.sprtopclip = bigger;
    if (ds.sprbottomclip === openings) ds.sprbottomclip = bigger;
    if (ds.maskedtexturecol === openings) ds.maskedtexturecol = bigger;
  }
  openings = bigger;
  return true;
}

function R_ScaleFromGlobalAngle(visangle) {
  const anglea = (ANG90 + (visangle - viewangle)) >>> 0;
  const angleb = (ANG90 + (visangle - rw_normalangle)) >>> 0;
  const sinea = Math.sin(anglea * BAM2RAD);
  const sineb = Math.sin(angleb * BAM2RAD);
  const num = projection * sineb;
  const den = rw_distance * sinea;
  const maxscale = 64 * SCALE * R_curZoom;
  if (den > num / maxscale) {
    let scale = num / den;
    if (scale > maxscale) scale = maxscale;
    else if (scale < 1 / 256) scale = 1 / 256;
    return scale;
  }
  return maxscale;
}

function R_StoreWallRange(start, stop) {
  if (start > stop) return;
  const ds = R_NewDrawseg();
  sidedef = curline.sidedef;
  linedef = curline.linedef;
  linedef.flags |= ML_MAPPED;

  rw_normalangle = (curline.angle + ANG90) >>> 0;
  let offsetangle = Math.abs((rw_normalangle - rw_angle1) | 0);
  if (offsetangle > ANG90) offsetangle = ANG90;
  const distangle = ANG90 - offsetangle;
  const hyp = R_PointToDist(curline.v1.x, curline.v1.y);
  rw_distance = hyp * Math.sin(distangle * BAM2RAD);
  if (rw_distance < 0.01) rw_distance = 0.01;

  ds.x1 = rw_x = start;
  ds.x2 = stop;
  ds.curline = curline;
  rw_stopx = stop + 1;

  ds.scale1 = rw_scale = R_ScaleFromGlobalAngle((viewangle + xtoviewangle[start]) >>> 0);
  if (stop > start) {
    ds.scale2 = R_ScaleFromGlobalAngle((viewangle + xtoviewangle[stop]) >>> 0);
    ds.scalestep = rw_scalestep = (ds.scale2 - rw_scale) / (stop - start);
  } else {
    ds.scale2 = ds.scale1;
    ds.scalestep = rw_scalestep = 0;
  }

  worldtop = frontsector.ceilingheight - viewz;
  worldbottom = frontsector.floorheight - viewz;
  midtexture = toptexture = bottomtexture = 0;
  maskedtexture = false;
  skypass = false;
  ds.maskedtexturecol = null;
  ds.sprtopclip = ds.sprbottomclip = null;
  ds.sprtopofs = ds.sprbottomofs = 0;
  const fsky = frontsector.ceilingpic === skyflatnum;

  if (!backsector) {
    // Línea de una cara: muro macizo.
    midtexture = texturetranslation[sidedef.midtexture];
    markfloor = markceiling = true;
    if (fsky) markceiling = false;
    if (linedef.flags & ML_DONTPEGBOTTOM) {
      const vtop = frontsector.floorheight + R_TexHeight(sidedef.midtexture || 1);
      rw_midtexturemid = vtop - viewz;
    } else {
      rw_midtexturemid = worldtop;
    }
    rw_midtexturemid += sidedef.rowoffset;
    ds.silhouette = SIL_BOTH;
    ds.sprtopclip = screenheightarray; ds.sprtopofs = 0;
    ds.sprbottomclip = negonearray; ds.sprbottomofs = 0;
    ds.bsilheight = MAXINT;
    ds.tsilheight = MININT;
  } else {
    const bsky = backsector.ceilingpic === skyflatnum;
    const bothsky = fsky && bsky;
    const closed = !bothsky && (backsector.ceilingheight <= frontsector.floorheight ||
      backsector.floorheight >= frontsector.ceilingheight);
    skypass = closed && fsky;
    ds.silhouette = 0;
    if (frontsector.floorheight > backsector.floorheight) {
      ds.silhouette = SIL_BOTTOM;
      ds.bsilheight = frontsector.floorheight;
    } else if (backsector.floorheight > viewz) {
      ds.silhouette = SIL_BOTTOM;
      ds.bsilheight = MAXINT;
    }
    if (skypass) {
      ds.silhouette = SIL_BOTTOM;
      ds.bsilheight = MAXINT;
    } else if (!bothsky) {
      if (frontsector.ceilingheight < backsector.ceilingheight) {
        ds.silhouette |= SIL_TOP;
        ds.tsilheight = frontsector.ceilingheight;
      } else if (backsector.ceilingheight < viewz) {
        ds.silhouette |= SIL_TOP;
        ds.tsilheight = MININT;
      }
      if (backsector.ceilingheight <= frontsector.floorheight) {
        ds.sprbottomclip = negonearray; ds.sprbottomofs = 0;
        ds.bsilheight = MAXINT;
        ds.silhouette |= SIL_BOTTOM;
      }
      if (backsector.floorheight >= frontsector.ceilingheight) {
        ds.sprtopclip = screenheightarray; ds.sprtopofs = 0;
        ds.tsilheight = MININT;
        ds.silhouette |= SIL_TOP;
      }
    }
    worldhigh = backsector.ceilingheight - viewz;
    worldlow = backsector.floorheight - viewz;
    // Truco del cielo de DOOM: entre dos sectores con cielo no hay muro superior.
    if (bothsky) worldtop = worldhigh;

    markfloor = worldlow !== worldbottom ||
      backsector.floorpic !== frontsector.floorpic ||
      backsector.lightlevel !== frontsector.lightlevel;
    markceiling = worldhigh !== worldtop ||
      backsector.ceilingpic !== frontsector.ceilingpic ||
      backsector.lightlevel !== frontsector.lightlevel;
    if (closed) markceiling = markfloor = true;
    if (fsky) markceiling = false;

    // Con cielo al frente, un sector trasero completamente bajo el piso del
    // frontal (un cuarto bajo un techo-azotea) no presenta cara superior.
    const underRoof = fsky && backsector.ceilingheight <= frontsector.floorheight;
    if (!bothsky && !underRoof && worldhigh < worldtop) {
      toptexture = texturetranslation[sidedef.toptexture];
      if (linedef.flags & ML_DONTPEGTOP) {
        rw_toptexturemid = worldtop;
      } else {
        const vtop = backsector.ceilingheight + R_TexHeight(sidedef.toptexture || 1);
        rw_toptexturemid = vtop - viewz;
      }
    }
    if (worldlow > worldbottom) {
      bottomtexture = texturetranslation[sidedef.bottomtexture];
      if (linedef.flags & ML_DONTPEGBOTTOM) rw_bottomtexturemid = worldtop;
      else rw_bottomtexturemid = worldlow;
    }
    rw_toptexturemid += sidedef.rowoffset;
    rw_bottomtexturemid += sidedef.rowoffset;

    if (sidedef.midtexture) {
      maskedtexture = true;
      maskeddensity = (textures[texturetranslation[sidedef.midtexture]] || textures[1]).density || 1;
      R_EnsureOpenings(rw_stopx - rw_x);
      ds.maskedtexturecol = openings;
      ds.maskedofs = maskedofs = lastopening - rw_x;
      lastopening += rw_stopx - rw_x;
    }
  }

  segtextured = midtexture || toptexture || bottomtexture || maskedtexture;
  if (segtextured) {
    let oa = (rw_normalangle - rw_angle1) >>> 0;
    if (oa > ANG180) oa = (-oa) >>> 0;
    if (oa > ANG90) oa = ANG90;
    rw_offset = hyp * Math.sin(oa * BAM2RAD);
    if (((rw_normalangle - rw_angle1) >>> 0) < ANG180) rw_offset = -rw_offset;
    rw_offset += sidedef.textureoffset + curline.offset;
    rw_centerangle = (ANG90 + viewangle - rw_normalangle) >>> 0;
    if (fixedcolormap < 0) {
      let lightnum = (frontsector.lightlevel >> LIGHTSEGSHIFT) + extralight;
      if (curline.v1.y === curline.v2.y) lightnum--;
      else if (curline.v1.x === curline.v2.x) lightnum++;
      if (lightnum < 0) walllights = scalelight[0];
      else if (lightnum >= LIGHTLEVELS) walllights = scalelight[LIGHTLEVELS - 1];
      else walllights = scalelight[lightnum];
    }
  }

  if (frontsector.floorheight >= viewz || !floorplane) markfloor = false;
  if ((frontsector.ceilingheight <= viewz && frontsector.ceilingpic !== skyflatnum) || !ceilingplane) markceiling = false;

  topstep = -rw_scalestep * worldtop;
  topfrac = centery - worldtop * rw_scale;
  bottomstep = -rw_scalestep * worldbottom;
  bottomfrac = centery - worldbottom * rw_scale;
  if (backsector) {
    if (worldhigh < worldtop) {
      pixhigh = centery - worldhigh * rw_scale;
      pixhighstep = -rw_scalestep * worldhigh;
    }
    if (worldlow > worldbottom) {
      pixlow = centery - worldlow * rw_scale;
      pixlowstep = -rw_scalestep * worldlow;
    }
  }

  if (markceiling) ceilingplane = R_CheckPlane(ceilingplane, rw_x, rw_stopx - 1);
  if (markfloor) floorplane = R_CheckPlane(floorplane, rw_x, rw_stopx - 1);

  segNonSky = !fsky;
  R_RenderSegLoop();
  if (skypass) {
    for (let x = start; x <= stop; x++) nsblock[x] = 1;
  }

  // Guardar recortes para los sprites.
  if (((ds.silhouette & SIL_TOP) || maskedtexture) && !ds.sprtopclip) {
    R_EnsureOpenings(rw_stopx - start);
    openings.set(ceilingclip.subarray(start, rw_stopx), lastopening);
    ds.sprtopclip = openings;
    ds.sprtopofs = lastopening - start;
    lastopening += rw_stopx - start;
  }
  if (((ds.silhouette & SIL_BOTTOM) || maskedtexture) && !ds.sprbottomclip) {
    R_EnsureOpenings(rw_stopx - start);
    openings.set(floorclip.subarray(start, rw_stopx), lastopening);
    ds.sprbottomclip = openings;
    ds.sprbottomofs = lastopening - start;
    lastopening += rw_stopx - start;
  }
  if (maskedtexture && !(ds.silhouette & SIL_TOP)) {
    ds.silhouette |= SIL_TOP;
    ds.tsilheight = MININT;
  }
  if (maskedtexture && !(ds.silhouette & SIL_BOTTOM)) {
    ds.silhouette |= SIL_BOTTOM;
    ds.bsilheight = MAXINT;
  }
}

let segNonSky = false;

function R_RenderSegLoop() {
  const vh = viewheight;
  for (; rw_x < rw_stopx; rw_x++) {
    if (segNonSky && nsblock[rw_x]) {
      // Columna tapada por un techo bajo cielo: la geometría interior no se ve.
      if (maskedtexture) openings[maskedofs + rw_x] = MAXSHORTCOL;
      if (toptexture) pixhigh += pixhighstep;
      if (bottomtexture) pixlow += pixlowstep;
      rw_scale += rw_scalestep;
      topfrac += topstep;
      bottomfrac += bottomstep;
      continue;
    }
    const cc = ceilingclip[rw_x], fc = floorclip[rw_x];
    let yl = Math.ceil(topfrac);
    if (yl < cc + 1) yl = cc + 1;
    if (markceiling) {
      const top = cc + 1;
      let bottom = yl - 1;
      if (bottom >= fc) bottom = fc - 1;
      if (top <= bottom) {
        ceilingplane.top[rw_x + 1] = top;
        ceilingplane.bottom[rw_x + 1] = bottom;
      }
    }
    let yh = Math.floor(bottomfrac);
    if (yh >= fc) yh = fc - 1;
    if (markfloor) {
      let top = yh + 1;
      const bottom = fc - 1;
      if (top <= cc) top = cc + 1;
      if (top <= bottom) {
        floorplane.top[rw_x + 1] = top;
        floorplane.bottom[rw_x + 1] = bottom;
      }
    }
    // Columna de textura en unidades de mapa; cada textura la pasa a texeles
    // según su densidad.
    let texcol = 0, invscale = 0;
    if (segtextured) {
      const ang = ((rw_centerangle + xtoviewangle[rw_x]) >>> 0) * BAM2RAD - HALFPI;
      texcol = rw_offset - Math.tan(ang) * rw_distance;
      if (fixedcolormap >= 0) dc_colormap = fixedcolormap;
      else {
        let index = Math.floor(rw_scale * lightscalemul * R_SCALEK);
        if (index >= R_SCALELIGHTS) index = R_SCALELIGHTS - 1;
        dc_colormap = walllights[index];
      }
      dc_x = rw_x;
      invscale = 1 / rw_scale;
    }
    if (midtexture) {
      const t = textures[midtexture], d = t.density || 1;
      dc_yl = yl;
      dc_yh = yh;
      dc_iscale = invscale * d;
      dc_texturemid = rw_midtexturemid * d;
      dc_source = R_GetColumn(midtexture, Math.floor(texcol * d));
      dc_texheight = t.height;
      R_DrawColumn();
      ceilingclip[rw_x] = vh;
      floorclip[rw_x] = -1;
    } else {
      if (toptexture) {
        let mid = Math.floor(pixhigh);
        pixhigh += pixhighstep;
        if (mid >= floorclip[rw_x]) mid = floorclip[rw_x] - 1;
        if (mid >= yl) {
          const t = textures[toptexture], d = t.density || 1;
          dc_yl = yl;
          dc_yh = mid;
          dc_iscale = invscale * d;
          dc_texturemid = rw_toptexturemid * d;
          dc_source = R_GetColumn(toptexture, Math.floor(texcol * d));
          dc_texheight = t.height;
          R_DrawColumn();
          if (!skypass) ceilingclip[rw_x] = mid;
        } else if (!skypass) {
          ceilingclip[rw_x] = yl - 1;
        }
      } else if (markceiling) {
        ceilingclip[rw_x] = yl - 1;
      }
      if (bottomtexture) {
        let mid = Math.ceil(pixlow);
        pixlow += pixlowstep;
        if (mid <= ceilingclip[rw_x]) mid = ceilingclip[rw_x] + 1;
        if (mid <= yh) {
          const t = textures[bottomtexture], d = t.density || 1;
          dc_yl = mid;
          dc_yh = yh;
          dc_iscale = invscale * d;
          dc_texturemid = rw_bottomtexturemid * d;
          dc_source = R_GetColumn(bottomtexture, Math.floor(texcol * d));
          dc_texheight = t.height;
          R_DrawColumn();
          floorclip[rw_x] = mid;
        } else {
          floorclip[rw_x] = yh + 1;
        }
      } else if (markfloor) {
        floorclip[rw_x] = yh + 1;
      }
      if (skypass && toptexture) {
        // Extensión Atenea: sólo queda abierto lo que está por encima del muro.
        if (yl < floorclip[rw_x]) floorclip[rw_x] = yl;
      }
      if (maskedtexture) openings[maskedofs + rw_x] = Math.floor(texcol * maskeddensity);
    }
    rw_scale += rw_scalestep;
    topfrac += topstep;
    bottomfrac += bottomstep;
  }
}

// Dibuja la textura enmascarada (rejas, barandas) de un drawseg. La columna
// guardada ya está en texeles; la escala de los postes es por texel.
function R_RenderMaskedSegRange(ds, x1, x2) {
  curline = ds.curline;
  frontsector = curline.frontsector;
  backsector = curline.backsector;
  const texnum = texturetranslation[curline.sidedef.midtexture];
  const tex = textures[texnum];
  if (!tex) return;
  const d = tex.density || 1;
  let lightnum = (frontsector.lightlevel >> LIGHTSEGSHIFT) + extralight;
  if (curline.v1.y === curline.v2.y) lightnum--;
  else if (curline.v1.x === curline.v2.x) lightnum++;
  walllights = scalelight[clamp(lightnum, 0, LIGHTLEVELS - 1)];
  const col = ds.maskedtexturecol;
  const mofs = ds.maskedofs;
  const step = ds.scalestep;
  let scale = ds.scale1 + (x1 - ds.x1) * step;
  mfloorclip = ds.sprbottomclip; mfloorofs = ds.sprbottomofs;
  mceilingclip = ds.sprtopclip; mceilingofs = ds.sprtopofs;
  let mid;
  if (curline.linedef.flags & ML_DONTPEGBOTTOM) {
    mid = Math.max(frontsector.floorheight, backsector.floorheight) + tex.height / d - viewz;
  } else {
    mid = Math.min(frontsector.ceilingheight, backsector.ceilingheight) - viewz;
  }
  mid += curline.sidedef.rowoffset;
  dc_translation = null;
  const w = tex.width;
  for (dc_x = x1; dc_x <= x2; dc_x++) {
    const c = col[mofs + dc_x];
    if (c !== MAXSHORTCOL) {
      if (fixedcolormap >= 0) dc_colormap = fixedcolormap;
      else {
        let index = Math.floor(scale * lightscalemul * R_SCALEK);
        if (index >= R_SCALELIGHTS) index = R_SCALELIGHTS - 1;
        dc_colormap = walllights[index];
      }
      sprtopscreen = centery - mid * scale;
      spryscale = scale / d;
      dc_iscale = d / scale;
      dc_texturemid = mid * d;
      R_DrawMaskedColumn(tex.posts[((c % w) + w) % w]);
      col[mofs + dc_x] = MAXSHORTCOL;
    }
    scale += step;
  }
}
