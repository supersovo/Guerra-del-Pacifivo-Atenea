// =============================================================================
// r_sky.js — Cielo (r_sky.c)
// -----------------------------------------------------------------------------
// En DOOM el cielo se dibuja en los visplanes marcados con F_SKY1, con una
// columna de textura que depende sólo del ángulo de vista. Atenea usa un
// panorama de 1024 columnas (360 grados, sin repetición: el Pacífico queda al
// oeste y los Andes al este) y lo dibuja como fondo antes que el mundo; así
// las líneas con cielo no ocultan lo que está detrás de ellas.
// =============================================================================
'use strict';

let skytexture = 0;
let skytexturemid = 150;
let skyiscale = 1;
let skyactive = true;

function R_InitSkyMap() {
  skyiscale = 1 / SCALE;
  if (setblocks < 10) skyiscale = 1 / (SCALE * setblocks / 10);
}

function R_SetSky(texname, horizonRow) {
  skytexture = R_TextureNumForName(texname);
  const t = textures[skytexture];
  skytexturemid = horizonRow !== undefined ? horizonRow : Math.floor(t.height * 0.75);
}

function R_DrawSkyBackground() {
  if (!skyactive || !skytexture) return;
  const tex = textures[skytexture];
  const colmask = tex.width - 1;
  const shift = 32 - Math.round(Math.log2(tex.width));
  dc_iscale = skyiscale;
  dc_texturemid = skytexturemid;
  dc_colormap = fixedcolormap >= 0 ? fixedcolormap : 0;
  dc_translation = null;
  dc_yl = 0;
  dc_yh = viewheight - 1;
  for (let x = 0; x < viewwidth; x++) {
    const angle = (viewangle + xtoviewangle[x]) >>> 0;
    dc_x = x;
    dc_source = tex.columns[(angle >>> shift) & colmask];
    R_DrawColumnClamped();
  }
}
