// =============================================================================
// am_map.js — Automapa (am_map.c), dibujado como una carta militar
// -----------------------------------------------------------------------------
// En lugar del fondo negro de DOOM, el automapa se muestra como una carta de
// campaña en pergamino: los desniveles del terreno aparecen como curvas de
// nivel en tinta. Tab lo abre; +/- acerca, F sigue al soldado, G cuadrícula.
// =============================================================================
'use strict';

let automapactive = false;
let am_scale = 0.18;          // píxeles lógicos por unidad de mapa (los campos son extensos)
let am_cx = 0, am_cy = 0;     // centro de la vista (coordenadas de mapa)
let am_follow = true, am_grid = false;
let am_zoom = 1, am_panx = 0, am_pany = 0;
let am_bgTile = null;

function AM_Start() {
  automapactive = true;
  am_follow = true;
  const mo = players[0].mo;
  if (mo) { am_cx = mo.x; am_cy = mo.y; }
}

function AM_Stop() {
  automapactive = false;
  am_zoom = 1;
  am_panx = am_pany = 0;
}

function AM_Responder(ev) {
  if (!automapactive) {
    if (ev.type === ev_keydown && ev.data1 === 'Tab' && !ev.repeat) {
      AM_Start();
      return true;
    }
    return false;
  }
  if (ev.type === ev_keydown) {
    switch (ev.data1) {
      case 'Tab': if (!ev.repeat) AM_Stop(); return true;
      case 'Equal': case 'NumpadAdd': am_zoom = 1.04; return true;
      case 'Minus': case 'NumpadSubtract': am_zoom = 1 / 1.04; return true;
      case 'KeyF': am_follow = !am_follow; HU_PlayerMessage(players[0], am_follow ? 'Carta: sigue al soldado.' : 'Carta: libre.'); return true;
      case 'KeyG': am_grid = !am_grid; return true;
      case 'Digit0': am_scale = 0.12; return true;
      case 'ArrowLeft': if (!am_follow) { am_panx = -1; return true; } break;
      case 'ArrowRight': if (!am_follow) { am_panx = 1; return true; } break;
      case 'ArrowUp': if (!am_follow) { am_pany = 1; return true; } break;
      case 'ArrowDown': if (!am_follow) { am_pany = -1; return true; } break;
    }
  } else if (ev.type === ev_keyup) {
    switch (ev.data1) {
      case 'Equal': case 'NumpadAdd': case 'Minus': case 'NumpadSubtract': am_zoom = 1; return false;
      case 'ArrowLeft': case 'ArrowRight': am_panx = 0; return false;
      case 'ArrowUp': case 'ArrowDown': am_pany = 0; return false;
    }
  }
  return false;
}

function AM_Ticker() {
  if (!automapactive) return;
  am_scale *= am_zoom;
  am_scale = clamp(am_scale, 0.04, 2.5);
  if (am_follow) {
    const mo = players[0].mo;
    if (mo) { am_cx = mo.x; am_cy = mo.y; }
  } else {
    am_cx += am_panx * 8 / am_scale;
    am_cy += am_pany * 8 / am_scale;
  }
}

function AM_BuildBackground() {
  const t = tx_new(64, 64);
  const n = tx_fbm(64, 64, 9101, 4, 4, 4, 0.55);
  for (let i = 0; i < 64 * 64; i++) {
    const c = tx_scale([224, 206, 166], 0.9 + n[i] * 0.14);
    t.r[i] = c[0]; t.g[i] = c[1]; t.b[i] = c[2];
  }
  am_bgTile = tx_quantize(t, 3);
}

// Dibuja una línea en píxeles físicos con recorte.
function AM_DrawLinePhys(x0, y0, x1, y1, color, fw, fh, thick) {
  // Cohen–Sutherland
  const code = function (x, y) { return (x < 0 ? 1 : 0) | (x >= fw ? 2 : 0) | (y < 0 ? 4 : 0) | (y >= fh ? 8 : 0); };
  let c0 = code(x0, y0), c1 = code(x1, y1);
  for (let it = 0; it < 8; it++) {
    if (!(c0 | c1)) break;
    if (c0 & c1) return;
    const c = c0 || c1;
    let x, y;
    if (c & 8) { x = x0 + (x1 - x0) * (fh - 1 - y0) / (y1 - y0); y = fh - 1; }
    else if (c & 4) { x = x0 + (x1 - x0) * (0 - y0) / (y1 - y0); y = 0; }
    else if (c & 2) { y = y0 + (y1 - y0) * (fw - 1 - x0) / (x1 - x0); x = fw - 1; }
    else { y = y0 + (y1 - y0) * (0 - x0) / (x1 - x0); x = 0; }
    if (c === c0) { x0 = x; y0 = y; c0 = code(x0, y0); } else { x1 = x; y1 = y; c1 = code(x1, y1); }
  }
  if (c0 | c1) return;
  const fb = screens[0];
  const W = SCREENWIDTH;
  let ix0 = Math.round(x0), iy0 = Math.round(y0);
  const ix1 = Math.round(x1), iy1 = Math.round(y1);
  const dx = Math.abs(ix1 - ix0), dy = -Math.abs(iy1 - iy0);
  const sx = ix0 < ix1 ? 1 : -1, sy = iy0 < iy1 ? 1 : -1;
  let err = dx + dy;
  for (let n = 0; n < 4000; n++) {
    fb[iy0 * W + ix0] = color;
    if (thick && ix0 + 1 < fw) fb[iy0 * W + ix0 + 1] = color;
    if (ix0 === ix1 && iy0 === iy1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; ix0 += sx; }
    if (e2 <= dx) { err += dx; iy0 += sy; }
  }
}

function AM_Drawer() {
  if (!am_bgTile) AM_BuildBackground();
  const S = SCALE;
  const fw = SCREENWIDTH;
  const fh = setblocks >= 11 ? SCREENHEIGHT : SCREENHEIGHT - ST_HEIGHT * S;
  const fb = screens[0];
  // pergamino (una fila por píxel lógico: se copia la fila anterior)
  if (V_xmap.length < fw) V_xmap = new Int32Array(fw);
  for (let x = 0; x < fw; x++) V_xmap[x] = Math.floor(x / S) & 63;
  for (let y = 0; y < fh; y++) {
    const row = y * fw;
    if (y % S) { fb.copyWithin(row, row - fw, row); continue; }
    const ty = (Math.floor(y / S) & 63) * 64;
    for (let x = 0; x < fw; x++) fb[row + x] = am_bgTile[ty + V_xmap[x]];
  }
  const sc = am_scale * S;
  const ox = fw / 2, oy = fh / 2;
  const tx = function (x) { return ox + (x - am_cx) * sc; };
  const ty = function (y) { return oy - (y - am_cy) * sc; };
  // cuadrícula
  if (am_grid) {
    const gcol = C(R_SAND, 5);
    const step = MAPBLOCKSIZE;
    const x0 = Math.floor((am_cx - ox / sc - bmaporgx) / step) * step + bmaporgx;
    for (let x = x0; x < am_cx + ox / sc; x += step) AM_DrawLinePhys(tx(x), 0, tx(x), fh - 1, gcol, fw, fh);
    const y0 = Math.floor((am_cy - oy / sc - bmaporgy) / step) * step + bmaporgy;
    for (let y = y0; y < am_cy + oy / sc; y += step) AM_DrawLinePhys(0, ty(y), fw - 1, ty(y), gcol, fw, fh);
  }
  const plyr = players[0];
  const allmap = plyr.powers[pw_allmap] || automapRevealAll;
  const inkDark = C(R_WOOD, 14), inkMid = C(R_WOOD, 11), inkLight = C(R_SAND, 9), inkSea = C(R_SEA, 6), inkFaint = C(R_WOOD, 6);
  for (const ld of lines) {
    const mapped = (ld.flags & ML_MAPPED) || automapRevealAll;
    if (ld.flags & ML_DONTDRAW && !automapRevealAll) continue;
    // La carta trae el relieve (curvas de nivel) aunque no se haya recorrido;
    // lo ya visto se entinta con más fuerza.
    const relief = ld.backsector && Math.abs(ld.frontsector.floorheight - ld.backsector.floorheight) >= 16;
    if (!mapped && !allmap && !relief) continue;
    let color;
    if (!mapped) color = inkFaint;
    else if (!ld.backsector) color = inkDark;
    else {
      const fs = ld.frontsector, bs = ld.backsector;
      const df = Math.abs(fs.floorheight - bs.floorheight);
      if (ld.flags & ML_BLOCKING && (fs.floorpic === flatlookup.get('AGUA1') || bs.floorpic === flatlookup.get('AGUA1'))) color = inkSea;
      else if (df >= 48) color = inkDark;
      else if (df > 0) color = inkMid;
      else if (fs.ceilingheight !== bs.ceilingheight) { if (!automapRevealAll) continue; color = inkLight; }
      else continue;
    }
    AM_DrawLinePhys(tx(ld.v1.x), ty(ld.v1.y), tx(ld.v2.x), ty(ld.v2.y), color, fw, fh, S > 1 && color === inkDark);
  }
  // cosas
  for (let th = thinkercap.next; th !== thinkercap; th = th.next) {
    if (!th.isMobj || th.removed || th.player) continue;
    const f = B_FactionOf(th);
    let color = -1;
    if (f === FACTION_CHILE && th.health > 0) color = C(R_NAVY, 5);
    else if (f === FACTION_ALIANZA && th.health > 0 && automapRevealAll) color = C(R_RED, 5);
    else if (th.type === MT.MINA && (plyr.powers[pw_allmap] || automapRevealAll)) color = C(R_FIRE, 4);
    if (color < 0) continue;
    const x = tx(th.x), y = ty(th.y);
    if (x < 1 || y < 1 || x >= fw - 2 || y >= fh - 2) continue;
    const r = Math.max(1, Math.round(S * 1.2));
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (th.type === MT.MINA ? (dx === dy || dx === -dy) : (dx * dx + dy * dy <= r * r)) {
        const px = Math.round(x + dx), py = Math.round(y + dy);
        if (px >= 0 && py >= 0 && px < fw && py < fh) fb[py * fw + px] = color;
      }
    }
  }
  // flecha del jugador
  if (plyr.mo) {
    const mo = plyr.mo;
    const a = mo.angle * BAM2RAD;
    const L = 14 * S;
    const px = tx(mo.x), py = ty(mo.y);
    const tip = [px + Math.cos(a) * L, py - Math.sin(a) * L];
    const tail = [px - Math.cos(a) * L * 0.6, py + Math.sin(a) * L * 0.6];
    const w1 = [px + Math.cos(a + 2.5) * L * 0.6, py - Math.sin(a + 2.5) * L * 0.6];
    const w2 = [px + Math.cos(a - 2.5) * L * 0.6, py - Math.sin(a - 2.5) * L * 0.6];
    const col = C(R_RED, 4);
    AM_DrawLinePhys(tail[0], tail[1], tip[0], tip[1], col, fw, fh, true);
    AM_DrawLinePhys(tip[0], tip[1], w1[0], w1[1], col, fw, fh, true);
    AM_DrawLinePhys(tip[0], tip[1], w2[0], w2[1], col, fw, fh, true);
  }
  // rosa de los vientos
  const cx = 300, cy = 20;
  const ink = C(R_WOOD, 13);
  AM_DrawLinePhys(UIOFS + cx * S, (cy - 12) * S, UIOFS + cx * S, (cy + 12) * S, ink, fw, fh, S > 1);
  AM_DrawLinePhys(UIOFS + (cx - 12) * S, cy * S, UIOFS + (cx + 12) * S, cy * S, ink, fw, fh, S > 1);
  V_DrawText(cx - 2, cy - 24, 'N', false, V_Translations.dark);
  // título, hora y objetivos
  const mins = Math.floor(leveltime / TICRATE / 60), secs = Math.floor(leveltime / TICRATE) % 60;
  const ylow = Math.floor(fh / S) - 12;
  V_DrawText(4, ylow, (levelinfo.title || '') + '   ' + mins + ':' + String(secs).padStart(2, '0'), false, V_Translations.dark);
  if (battle && battle.objectives.length) {
    // abajo a la izquierda, sobre el título (arriba quedan los mensajes)
    let y = ylow - 11 * battle.objectives.length - 12;
    V_DrawText(4, y - 12, 'OBJETIVOS', false, V_Translations.dark);
    for (const o of battle.objectives) {
      V_DrawText(4, y, (o.done ? '[X] ' : '[ ] ') + o.title, false, o.done ? V_Translations.green : V_Translations.dark);
      y += 11;
    }
  }
}
