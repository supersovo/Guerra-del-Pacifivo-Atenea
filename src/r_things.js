// =============================================================================
// r_things.js — Sprites y armas en primera persona (r_things.c)
// -----------------------------------------------------------------------------
// Cada objeto (mobj) de los sectores visitados se proyecta como "vissprite".
// Al final se ordenan de atrás hacia adelante y se recortan contra las
// siluetas de los drawsegs que están delante, igual que en DOOM. Los sprites
// de los enemigos tienen 8 rotaciones: se elige la imagen según el ángulo
// entre la cámara y hacia dónde mira el objeto.
// =============================================================================
'use strict';

const MINZ = 4;
let vissprites = [];
let num_vissprite = 0;
let spritelights = null;
let clipbot = new Int32Array(1);
let cliptop = new Int32Array(1);
let pspritescale = 1;

function R_InitSpriteArrays() {
  clipbot = new Int32Array(viewwidth);
  cliptop = new Int32Array(viewwidth);
  pspritescale = setblocks >= 10 ? SCALE : SCALE * setblocks / 10;
}

function R_ClearSprites() {
  num_vissprite = 0;
}

function R_NewVisSprite() {
  let v = vissprites[num_vissprite];
  if (!v) {
    v = { x1: 0, x2: 0, gx: 0, gy: 0, gz: 0, gzt: 0, startfrac: 0, scale: 0, xiscale: 0,
      texturemid: 0, patch: null, colormap: 0, mobjflags: 0, translation: null };
    vissprites[num_vissprite] = v;
  }
  num_vissprite++;
  return v;
}

function R_AddSprites(sec) {
  if (sec.validcount === validcount) return;
  sec.validcount = validcount;
  let lightnum = (sec.lightlevel >> LIGHTSEGSHIFT) + extralight;
  spritelights = scalelight[clamp(lightnum, 0, LIGHTLEVELS - 1)];
  for (let thing = sec.thinglist; thing; thing = thing.snext) R_ProjectSprite(thing);
}

function R_ProjectSprite(thing) {
  if (thing.flags & MF_NOSECTOR) return;
  let px = thing.x, py = thing.y, pz = thing.z;
  if (defaults.interpolate && R_interpFrac < 1 && thing.oldvalid) {
    px = thing.oldx + (thing.x - thing.oldx) * R_interpFrac;
    py = thing.oldy + (thing.y - thing.oldy) * R_interpFrac;
    pz = thing.oldz + (thing.z - thing.oldz) * R_interpFrac;
  }
  const tr_x = px - viewx, tr_y = py - viewy;
  const tz = tr_x * viewcos + tr_y * viewsin;
  if (tz < MINZ) return;
  const xscale = projection / tz;
  let tx = tr_x * viewsin - tr_y * viewcos;
  if (Math.abs(tx) > tz * 4) return;

  const sprdef = sprites[thing.sprite];
  if (!sprdef) return;
  const sprframe = sprdef.frames[thing.frame & FF_FRAMEMASK] || sprdef.frames[0];
  let lump, flip;
  if (sprframe.rotate) {
    const ang = R_PointToAngle(px, py);
    const rot = ((ang - thing.angle + (ANG45 / 2) * 9) >>> 0) >>> 29;
    lump = sprframe.lump[rot];
    flip = sprframe.flip[rot];
  } else {
    lump = sprframe.lump[0];
    flip = sprframe.flip[0];
  }
  const patch = lumpinfo[lump].data;
  tx -= patch.leftoffset;
  const x1 = Math.floor(centerx + tx * xscale);
  if (x1 > viewwidth) return;
  tx += patch.width;
  const x2 = Math.floor(centerx + tx * xscale) - 1;
  if (x2 < 0) return;

  const vis = R_NewVisSprite();
  vis.mobjflags = thing.flags;
  vis.scale = xscale;
  vis.gx = px;
  vis.gy = py;
  vis.gz = pz;
  vis.gzt = pz + patch.topoffset;
  vis.texturemid = vis.gzt - viewz;
  vis.x1 = x1 < 0 ? 0 : x1;
  vis.x2 = x2 >= viewwidth ? viewwidth - 1 : x2;
  const iscale = 1 / xscale;
  if (flip) {
    vis.startfrac = patch.width - 0.0001;
    vis.xiscale = -iscale;
  } else {
    vis.startfrac = 0;
    vis.xiscale = iscale;
  }
  if (vis.x1 > x1) vis.startfrac += vis.xiscale * (vis.x1 - x1);
  vis.patch = patch;
  vis.translation = thing.translation || null;
  if (fixedcolormap >= 0) vis.colormap = fixedcolormap;
  else if (thing.frame & FF_FULLBRIGHT) vis.colormap = 0;
  else {
    let index = Math.floor(xscale * lightscalemul);
    if (index >= MAXLIGHTSCALE) index = MAXLIGHTSCALE - 1;
    vis.colormap = spritelights[index];
  }
}

function R_DrawVisSprite(vis) {
  const patch = vis.patch;
  dc_colormap = vis.colormap;
  dc_translation = vis.translation;
  dc_iscale = Math.abs(vis.xiscale);
  dc_texturemid = vis.texturemid;
  spryscale = vis.scale;
  sprtopscreen = centery - dc_texturemid * spryscale;
  let frac = vis.startfrac;
  const w = patch.width;
  for (dc_x = vis.x1; dc_x <= vis.x2; dc_x++, frac += vis.xiscale) {
    const tc = Math.floor(frac);
    if (tc < 0 || tc >= w) continue;
    R_DrawMaskedColumn(patch.columns[tc]);
  }
  dc_translation = null;
}

function R_DrawSprite(spr) {
  for (let x = spr.x1; x <= spr.x2; x++) clipbot[x] = cliptop[x] = -2;
  for (let i = ds_p - 1; i >= 0; i--) {
    const ds = drawsegs[i];
    if (ds.x1 > spr.x2 || ds.x2 < spr.x1 || (!ds.silhouette && !ds.maskedtexturecol)) continue;
    const r1 = ds.x1 < spr.x1 ? spr.x1 : ds.x1;
    const r2 = ds.x2 > spr.x2 ? spr.x2 : ds.x2;
    let lowscale, scale;
    if (ds.scale1 > ds.scale2) { lowscale = ds.scale2; scale = ds.scale1; }
    else { lowscale = ds.scale1; scale = ds.scale2; }
    if (scale < spr.scale || (lowscale < spr.scale && !R_PointOnSegSide(spr.gx, spr.gy, ds.curline))) {
      if (ds.maskedtexturecol) R_RenderMaskedSegRange(ds, r1, r2);
      continue;
    }
    let silhouette = ds.silhouette;
    if (spr.gz >= ds.bsilheight) silhouette &= ~SIL_BOTTOM;
    if (spr.gzt <= ds.tsilheight) silhouette &= ~SIL_TOP;
    if (silhouette & SIL_BOTTOM) {
      const arr = ds.sprbottomclip, ofs = ds.sprbottomofs;
      if (arr) for (let x = r1; x <= r2; x++) if (clipbot[x] === -2) clipbot[x] = arr[ofs + x];
    }
    if (silhouette & SIL_TOP) {
      const arr = ds.sprtopclip, ofs = ds.sprtopofs;
      if (arr) for (let x = r1; x <= r2; x++) if (cliptop[x] === -2) cliptop[x] = arr[ofs + x];
    }
  }
  for (let x = spr.x1; x <= spr.x2; x++) {
    if (clipbot[x] === -2) clipbot[x] = viewheight;
    if (cliptop[x] === -2) cliptop[x] = -1;
  }
  mfloorclip = clipbot; mfloorofs = 0;
  mceilingclip = cliptop; mceilingofs = 0;
  R_DrawVisSprite(spr);
}

let R_sortbuf = [];
function R_DrawMasked() {
  const n = num_vissprite;
  R_sortbuf.length = n;
  for (let i = 0; i < n; i++) R_sortbuf[i] = vissprites[i];
  R_sortbuf.sort(function (a, b) { return a.scale - b.scale; });
  for (let i = 0; i < n; i++) R_DrawSprite(R_sortbuf[i]);
  for (let i = ds_p - 1; i >= 0; i--) {
    const ds = drawsegs[i];
    if (ds.maskedtexturecol) R_RenderMaskedSegRange(ds, ds.x1, ds.x2);
  }
  R_DrawPlayerSprites();
}

// --- Armas en primera persona (psprites) --------------------------------------------------
function R_DrawPSprite(psp, lightcm) {
  const st = psp.state;
  const sprdef = sprites[st.sprite];
  if (!sprdef) return;
  const sprframe = sprdef.frames[st.frame & FF_FRAMEMASK] || sprdef.frames[0];
  const patch = lumpinfo[sprframe.lump[0]].data;
  const S = pspritescale;
  // Coordenadas lógicas: x centrada en 160; el borde inferior del arma se ancla
  // al borde inferior de la vista cuando sy == WEAPONTOP.
  const leftx = (psp.sx - patch.leftoffset - 160) * S + centerx;
  const topy = viewheight - (patch.topoffset - (psp.sy - WEAPONTOP)) * S;
  const x1 = Math.floor(leftx);
  const x2 = Math.floor(leftx + patch.width * S) - 1;
  if (x2 < 0 || x1 >= viewwidth) return;
  if (fixedcolormap >= 0) dc_colormap = fixedcolormap;
  else if (st.frame & FF_FULLBRIGHT) dc_colormap = 0;
  else dc_colormap = lightcm;
  dc_translation = null;
  dc_iscale = 1 / S;
  spryscale = S;
  sprtopscreen = topy;
  dc_texturemid = (centery - topy) / S;
  mfloorclip = screenheightarray; mfloorofs = 0;
  mceilingclip = negonearray; mceilingofs = 0;
  const start = Math.max(0, x1), end = Math.min(viewwidth - 1, x2);
  for (dc_x = start; dc_x <= end; dc_x++) {
    const tc = Math.floor((dc_x - leftx) / S);
    if (tc < 0 || tc >= patch.width) continue;
    R_DrawMaskedColumn(patch.columns[tc]);
  }
}

function R_DrawPlayerSprites() {
  const player = viewplayer;
  if (!player || !player.psprites) return;
  const sec = player.mo.subsector.sector;
  let lightnum = (sec.lightlevel >> LIGHTSEGSHIFT) + extralight;
  const lights = scalelight[clamp(lightnum, 0, LIGHTLEVELS - 1)];
  const lightcm = lights[MAXLIGHTSCALE - 1];
  for (let i = 0; i < NUMPSPRITES; i++) {
    const psp = player.psprites[i];
    if (psp.state) {
      // Interpolación suave del balanceo del arma.
      const sx = psp.sx, sy = psp.sy;
      if (defaults.interpolate && R_interpFrac < 1 && psp.oldvalid) {
        psp.sx = psp.oldsx + (sx - psp.oldsx) * R_interpFrac;
        psp.sy = psp.oldsy + (sy - psp.oldsy) * R_interpFrac;
      }
      R_DrawPSprite(psp, lightcm);
      psp.sx = sx; psp.sy = sy;
    }
  }
  if (defaults.crosshair && setblocks >= 10) {
    const cx = Math.floor(centerx), cy = Math.floor(centery);
    const fb = screens[0];
    const col = C(R_GOLD, 2);
    for (let d = 2; d <= 4; d++) {
      fb[ylookup[cy] + columnofs[cx - d]] = col;
      fb[ylookup[cy] + columnofs[cx + d]] = col;
      fb[ylookup[cy - d] + columnofs[cx]] = col;
      fb[ylookup[cy + d] + columnofs[cx]] = col;
    }
  }
}
