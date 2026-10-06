// =============================================================================
// wi_stuff.js — Pantalla de intermedio y parte de operaciones (wi_stuff.c)
// -----------------------------------------------------------------------------
// Como el intermedio de DOOM (con el mapa del episodio y "USTED ESTÁ AQUÍ"),
// pero sobre cartas del teatro de operaciones: Tarapacá, Tacna y Arica
// (acciones 1 a 4) y la campaña de Lima (5 y 6).
// =============================================================================
'use strict';

let wi_state = 0;          // 0 conteo, 1 fin de conteo, 2 esperando
let wi_cnt = 0, wi_bcnt = 0;
let wi_counts = { kills: -1, items: -1, secret: -1, time: -1 };
let wi_info = null;
let wi_acceleratestage = false;
let wi_brief = null;       // { map, first, chars, done }

function WI_Start(info) {
  wi_info = info;
  wi_state = 0;
  wi_cnt = 0;
  wi_bcnt = 0;
  wi_acceleratestage = false;
  wi_counts = { kills: -1, items: -1, secret: -1, time: -1 };
  S_ChangeMusic('M_INTER', true);
}

function WI_Percent(a, b) { return b ? Math.floor(a * 100 / b) : 100; }

function WI_Ticker() {
  wi_bcnt++;
  if (wi_state === 0) {
    if (wi_acceleratestage) {
      wi_acceleratestage = false;
      wi_counts.kills = WI_Percent(wi_info.skills, wi_info.maxkills);
      wi_counts.items = WI_Percent(wi_info.sitems, wi_info.maxitems);
      wi_counts.secret = WI_Percent(wi_info.ssecret, wi_info.maxsecret);
      wi_counts.time = Math.floor(wi_info.stime / TICRATE);
      wi_state = 1;
      S_StartSound(null, 'explod');
      return;
    }
    if (!(wi_bcnt & 1)) return;
    const tgt = {
      kills: WI_Percent(wi_info.skills, wi_info.maxkills),
      items: WI_Percent(wi_info.sitems, wi_info.maxitems),
      secret: WI_Percent(wi_info.ssecret, wi_info.maxsecret),
      time: Math.floor(wi_info.stime / TICRATE)
    };
    for (const k of ['kills', 'items', 'secret', 'time']) {
      if (wi_counts[k] < tgt[k]) {
        wi_counts[k] = Math.min(tgt[k], wi_counts[k] + (k === 'time' ? 3 : 2));
        if (!(wi_bcnt & 3)) S_StartSound(null, 'menumv');
        return;
      }
    }
    wi_state = 1;
    S_StartSound(null, 'explod');
  } else if (wi_state === 1) {
    if (wi_acceleratestage) {
      wi_acceleratestage = false;
      S_StartSound(null, 'menusl');
      G_WorldDone();
    }
  }
}

function WI_Responder(ev) {
  if (ev.type === ev_keydown || (ev.type === ev_pointer && (ev.data1 === 'down' || ev.data1 === 'tap'))) {
    wi_acceleratestage = true;
    return true;
  }
  return false;
}

// Carta de la acción (fondo, rótulos de lugares, mar y países en tinta).
function WI_DrawMap(battle) {
  const spec = CAMPAIGN_MapFor(battle);
  const img = W_CacheLumpName(spec.lump);
  V_DrawFullImage(img);
  for (const l of spec.labels) V_DrawText(V_FullImageX(img, l[1]), l[2], l[0], false, V_Translations[l[3]]);
  for (const p of spec.places) {
    const q = spec.proj(p.lat, p.lon);
    V_DrawText(V_FullImageX(img, q[0] + p.dx), q[1] + p.dy, p.name, false, V_Translations.ink);
  }
  return spec;
}

function WI_DrawMapMarkers(spec, highlight, done) {
  for (const p of spec.places) {
    if (!p.battle) continue;
    const q = spec.proj(p.lat, p.lon);
    const x = q[0] - (428 - 320) / 2;
    const y = q[1];
    if (done && p.battle <= done) {
      // bandera chilena en miniatura sobre las acciones ya ganadas
      V_FillRect(x, y - 9, 1, 9, C(R_LINEN, 1));
      V_FillRect(x + 1, y - 9, 3, 2, C(R_NAVY, 5));
      V_FillRect(x + 4, y - 9, 4, 2, C(R_LINEN, 0));
      V_FillRect(x + 1, y - 7, 7, 2, C(R_RED, 4));
    }
    if (highlight === p.battle && (wi_bcnt & 16)) {
      const star = W_CacheLumpName('M_STAR2');
      V_DrawPatch(x, y, star);
      // el rótulo va a la izquierda si a la derecha lo taparía el parte
      const here = 'USTED ESTÁ AQUÍ', w = V_StringWidth(here, false);
      V_DrawText(x + 10 + w > 106 ? x - w - 2 : x + 10, y + 6, here, false, V_Translations.red);
    }
  }
}

// Panel de pergamino limpio (con borde) para escribir sobre la carta.
function WI_Panel(x, y, w, h) {
  if (!am_bgTile) AM_BuildBackground();
  const S = SCALE, fb = screens[0], W = SCREENWIDTH;
  const x0 = UIOFS + x * S, y0 = y * S, x1 = x0 + w * S, y1 = y0 + h * S;
  for (let py = Math.max(0, y0); py < Math.min(SCREENHEIGHT, y1); py++) {
    const ty = (Math.floor(py / S) & 63) * 64;
    for (let px = Math.max(0, x0); px < Math.min(W, x1); px++) fb[py * W + px] = am_bgTile[ty + (Math.floor(px / S) & 63)];
  }
  const ink = C(R_WOOD, 11);
  V_FillRect(x, y, w, 1, ink); V_FillRect(x, y + h - 1, w, 1, ink);
  V_FillRect(x, y, 1, h, ink); V_FillRect(x + w - 1, y, 1, h, ink);
}

function WI_Drawer() {
  const done = wi_info ? wi_info.last : 0;
  WI_DrawMapMarkers(WI_DrawMap(done || 1), 0, done);
  const bx = 176;
  const t = MAPTITLES[wi_info.last] || '';
  WI_Panel(bx - 8, 6, 316 - bx + 8, 188);
  V_DrawText(bx, 12, 'ACCIÓN', true, V_Translations.red);
  V_DrawText(bx, 32, 'CUMPLIDA', true, V_Translations.red);
  V_DrawText(bx, 56, t, false, V_Translations.dark);
  const rows = [['Bajas enemigas', wi_counts.kills, '%'], ['Pertrechos', wi_counts.items, '%']];
  if (wi_info.maxsecret) rows.push(['Depósitos ocultos', wi_counts.secret, '%']);
  let y = 76;
  for (const r of rows) {
    V_DrawText(bx, y, r[0], false, V_Translations.dark);
    if (r[1] >= 0) V_DrawText(bx + 104, y, r[1] + r[2], false, V_Translations.red);
    y += 16;
  }
  if (wi_counts.time >= 0) {
    const m = Math.floor(wi_counts.time / 60), s = wi_counts.time % 60;
    V_DrawText(bx, y, 'Tiempo', false, V_Translations.dark);
    V_DrawText(bx + 104, y, m + ':' + String(s).padStart(2, '0'), false, V_Translations.red);
    const par = Math.floor(wi_info.partime / TICRATE);
    V_DrawText(bx, y + 16, 'Tiempo de referencia', false, V_Translations.dark);
    V_DrawText(bx + 104, y + 32, Math.floor(par / 60) + ':' + String(par % 60).padStart(2, '0'), false, V_Translations.red);
  }
  if (wi_state === 1 && (wi_bcnt & 16)) V_DrawText(bx, 176, 'Presione para continuar', false, V_Translations.dark);
}

// --- Parte de operaciones (briefing) ------------------------------------------------------------------
const MAPTITLES = { 1: 'Desembarco en Pisagua', 2: 'Batalla de Dolores (San Francisco)', 3: 'Batalla de Tacna (Alto de la Alianza)',
  4: 'Toma del Morro de Arica', 5: 'Batalla de San Juan y Chorrillos', 6: 'Batalla de Miraflores' };

function WI_StartBriefing(map, first) {
  const b = BRIEFINGS[map];
  wi_bcnt = 0;
  wi_brief = { map: map, first: first, chars: 0, lines: HU_Wrap(b.text, 196, false), ready: false };
  S_ChangeMusic('M_BRIEF', true);
}

function WI_BriefingTicker() {
  wi_bcnt++;
  if (!wi_brief) return;
  // se pidió empezar pero la fundición seguía: se entra en cuanto termina
  if (wi_brief.waitWarm && W_WarmProgress() >= 1) { WI_BriefingStart(); return; }
  if (!wi_brief.ready) {
    wi_brief.chars += 2;
    const total = wi_brief.lines.join(' ').length;
    if (wi_brief.chars >= total) wi_brief.ready = true;
  }
}

function WI_BriefingResponder(ev) {
  if (!wi_brief) return false;
  if (ev.type === ev_keydown || (ev.type === ev_pointer && (ev.data1 === 'down' || ev.data1 === 'tap'))) {
    if (!wi_brief.ready) { wi_brief.ready = true; wi_brief.chars = 99999; return true; }
    if (wi_brief.waitWarm) return true;
    S_StartSound(null, 'menusl');
    if (W_WarmProgress() < 1) { wi_brief.waitWarm = true; return true; }
    WI_BriefingStart();
    return true;
  }
  return false;
}

function WI_BriefingStart() {
  const b = wi_brief;
  wi_brief = null;
  if (b.first) G_InitNew(d_skill, b.map);
  else G_DoLoadLevel();
}

function WI_BriefingDrawer() {
  if (!wi_brief) return;
  WI_DrawMapMarkers(WI_DrawMap(wi_brief.map), wi_brief.map, wi_brief.map - 1);
  const b = BRIEFINGS[wi_brief.map];
  const bx = 118;
  WI_Panel(bx - 8, 4, 320 - bx + 4, 192);
  V_DrawText(bx, 10, b.title, true, V_Translations.red);
  V_DrawText(bx, 32, b.date, false, V_Translations.dark);
  let remaining = wi_brief.chars;
  let y = 50;
  for (const l of wi_brief.lines) {
    if (remaining <= 0) break;
    V_DrawText(bx, y, l.slice(0, remaining), false, V_Translations.dark);
    remaining -= l.length + 1;
    y += 11;
  }
  if (wi_brief.waitWarm) V_DrawText(bx, 186, 'Preparando la batalla: ' + Math.floor(W_WarmProgress() * 100) + ' %', false, V_Translations.red);
  else if (wi_brief.ready && (wi_bcnt & 16)) V_DrawText(bx, 186, wi_brief.first ? 'Presione para iniciar la acción' : 'Presione para avanzar', false, V_Translations.red);
  D_DrawWarmProgress();
}
