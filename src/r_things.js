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
  // density: texeles por unidad de mapa (2 = sprites de alta resolución)
  const d = patch.density || 1;
  tx -= patch.leftoffset / d;
  const x1 = Math.floor(centerx + tx * xscale);
  if (x1 > viewwidth) return;
  tx += patch.width / d;
  const x2 = Math.floor(centerx + tx * xscale) - 1;
  if (x2 < 0) return;

  const vis = R_NewVisSprite();
  vis.mobjflags = thing.flags;
  vis.scale = xscale;
  vis.gx = px;
  vis.gy = py;
  vis.gz = pz;
  vis.gzt = pz + patch.topoffset / d;
  vis.texturemid = vis.gzt - viewz;
  vis.x1 = x1 < 0 ? 0 : x1;
  vis.x2 = x2 >= viewwidth ? viewwidth - 1 : x2;
  const iscale = d / xscale;
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
  const d = patch.density || 1;
  dc_colormap = vis.colormap;
  dc_translation = vis.translation;
  dc_iscale = Math.abs(vis.xiscale);
  dc_texturemid = vis.texturemid * d;
  spryscale = vis.scale / d;
  sprtopscreen = centery - vis.texturemid * vis.scale;
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
// Sprites del arma vista por las miras: mismo cuadro con otro nombre. Se
// dibujan centrados en la vista (la línea de mira pasa por el centro).
const R_ADS_NAMES = { COMB: 'COMZ', CFLA: 'CFLZ', REVO: 'REVZ', RFLA: 'RFLZ', GATL: 'GATZ', GFLA: 'GFLZ' };
let R_adsSprite = null;

function R_InitADSSprites() {
  R_adsSprite = new Int32Array(sprites.length).fill(-1);
  for (const k in R_ADS_NAMES) {
    const a = spritelookup.get(k), b = spritelookup.get(R_ADS_NAMES[k]);
    if (a !== undefined && b !== undefined) R_adsSprite[a] = b;
  }
}

// Devuelve el sprite de mira de un estado, o -1.
function R_ADSSpriteFor(st) {
  if (!R_adsSprite || R_adsSprite.length !== sprites.length) R_InitADSSprites();
  const a = R_adsSprite[st.sprite];
  if (a < 0) return -1;
  const fr = st.frame & FF_FRAMEMASK;
  return sprites[a].real[fr] ? a : -1;
}

// ads: encare (0..1). dip: descenso del arma durante la transición entre la
// posición de cadera y la de puntería (px lógicos).
function R_DrawPSprite(psp, lightcm, ads, dip) {
  const st = psp.state;
  let spr = st.sprite;
  let center = false;
  if (ads > 0.5) {
    const a = R_ADSSpriteFor(st);
    if (a >= 0) { spr = a; center = true; }
  }
  const sprdef = sprites[spr];
  if (!sprdef) return false;
  const sprframe = sprdef.frames[st.frame & FF_FRAMEMASK] || sprdef.frames[0];
  const patch = lumpinfo[sprframe.lump[0]].data;
  const S = pspritescale;
  const d = patch.density || 1;
  const tS = S / d;                       // píxeles de pantalla por texel
  let sx = psp.sx, sy = psp.sy;
  if (center) {
    // encarado, el balanceo del paso casi no se nota
    sx = 1 + (sx - 1) * 0.2;
    sy = WEAPONTOP + (sy - WEAPONTOP) * 0.2;
  }
  sy += dip;
  // Coordenadas lógicas: x centrada en 160. De cadera, el borde inferior del
  // arma se ancla al borde inferior de la vista cuando sy == WEAPONTOP; por
  // las miras, la fila de la línea de mira se ancla al centro de la vista.
  const leftx = (sx - patch.leftoffset / d - 160) * S + centerx;
  const anchor = center ? basecentery : viewheight;
  const topy = anchor - (patch.topoffset / d - (sy - WEAPONTOP)) * S;
  const x1 = Math.floor(leftx);
  const x2 = Math.floor(leftx + patch.width * tS) - 1;
  if (x2 < 0 || x1 >= viewwidth) return center;
  if (fixedcolormap >= 0) dc_colormap = fixedcolormap;
  else if (st.frame & FF_FULLBRIGHT) dc_colormap = 0;
  else dc_colormap = lightcm;
  dc_translation = null;
  dc_iscale = 1 / tS;
  spryscale = tS;
  sprtopscreen = topy;
  dc_texturemid = (centery - topy) / tS;
  mfloorclip = screenheightarray; mfloorofs = 0;
  mceilingclip = negonearray; mceilingofs = 0;
  const start = Math.max(0, x1), end = Math.min(viewwidth - 1, x2);
  for (dc_x = start; dc_x <= end; dc_x++) {
    const tc = Math.floor((dc_x - leftx) / tS);
    if (tc < 0 || tc >= patch.width) continue;
    R_DrawMaskedColumn(patch.columns[tc]);
  }
  return center;
}

function R_DrawPlayerSprites() {
  const player = viewplayer;
  if (!player || !player.psprites) return;
  const sec = player.mo.subsector.sector;
  let lightnum = (sec.lightlevel >> LIGHTSEGSHIFT) + extralight;
  const lights = scalelight[clamp(lightnum, 0, LIGHTLEVELS - 1)];
  const lightcm = lights[MAXLIGHTSCALE - 1];
  let ads = player.ads;
  if (defaults.interpolate && R_interpFrac < 1) ads = player.oldads + (player.ads - player.oldads) * R_interpFrac;
  const dip = (ads < 0.5 ? ads : 1 - ads) * 2 * 36;
  let sights = false;
  for (let i = 0; i < NUMPSPRITES; i++) {
    const psp = player.psprites[i];
    if (psp.state) {
      // Interpolación suave del balanceo del arma.
      const sx = psp.sx, sy = psp.sy;
      if (defaults.interpolate && R_interpFrac < 1 && psp.oldvalid) {
        psp.sx = psp.oldsx + (sx - psp.oldsx) * R_interpFrac;
        psp.sy = psp.oldsy + (sy - psp.oldsy) * R_interpFrac;
      }
      if (R_DrawPSprite(psp, lightcm, ads, dip) && i === ps_weapon) sights = true;
      psp.sx = sx; psp.sy = sy;
    }
  }
  // Retícula en el centro de la vista (hacia allí van los disparos); se
  // oculta cuando se apunta por las miras.
  if (defaults.crosshair && setblocks >= 10 && !sights && player.health > 0) R_DrawCrosshair();
}

// Retícula moderna: cuatro trazos con un hueco central y un punto, con borde
// oscuro para verse sobre cielo claro o terreno oscuro.
function R_DrawCrosshair() {
  const S = SCALE;
  const cx = Math.floor(centerx), cy = Math.floor(basecentery);
  const t = Math.max(1, Math.round(S / 2));        // grosor
  const gap = Math.round(2.5 * S), len = Math.round(3.5 * S);
  const light = C(R_LINEN, 0), dark = C(R_GRAY, 15);
  const rects = [
    [cx - gap - len, cy - (t >> 1), len, t], [cx + gap + 1, cy - (t >> 1), len, t],
    [cx - (t >> 1), cy - gap - len, t, len], [cx - (t >> 1), cy + gap + 1, t, len],
    [cx - (t >> 1), cy - (t >> 1), t, t]
  ];
  for (const r of rects) R_FillViewRect(r[0] - 1, r[1] - 1, r[2] + 2, r[3] + 2, dark);
  for (const r of rects) R_FillViewRect(r[0], r[1], r[2], r[3], light);
}

function R_FillViewRect(x, y, w, h, color) {
  const fb = screens[0];
  const x0 = Math.max(0, x), x1 = Math.min(viewwidth, x + w);
  const y0 = Math.max(0, y), y1 = Math.min(viewheight, y + h);
  for (let yy = y0; yy < y1; yy++) {
    const row = ylookup[yy];
    for (let xx = x0; xx < x1; xx++) fb[row + columnofs[xx]] = color;
  }
}
