// =============================================================================
// wi_stuff.js — Pantalla de intermedio y parte de operaciones (wi_stuff.c)
// -----------------------------------------------------------------------------
// Como el intermedio de DOOM (con el mapa del episodio y "USTED ESTÁ AQUÍ"),
// pero sobre una carta del teatro de operaciones de Tarapacá y Arica.
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

function WI_DrawMapMarkers(highlight, done) {
  for (const p of WIMAP_PLACES) {
    if (!p.battle) continue;
    const q = WIMAP_Proj(p.lat, p.lon);
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
      V_DrawText(x + 10, y + 6, 'USTED ESTÁ AQUÍ', false, V_Translations.red);
    }
  }
}

function WI_Drawer() {
  V_DrawFullImage(W_CacheLumpName('WIMAP'));
  const done = wi_info ? wi_info.last : 0;
  WI_DrawMapMarkers(0, done);
  const bx = 176;
  const t = MAPTITLES[wi_info.last] || '';
  V_DrawText(bx, 16, 'ACCIÓN CUMPLIDA', true, V_Translations.red);
  V_DrawText(bx, 40, t, false, V_Translations.dark);
  const rows = [['Bajas enemigas', wi_counts.kills, '%'], ['Pertrechos', wi_counts.items, '%'], ['Depósitos ocultos', wi_counts.secret, '%']];
  let y = 62;
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
const MAPTITLES = { 1: 'Desembarco en Pisagua', 2: 'Batalla de Dolores (San Francisco)', 3: 'Toma del Morro de Arica' };

function WI_StartBriefing(map, first) {
  const b = BRIEFINGS[map];
  wi_bcnt = 0;
  wi_brief = { map: map, first: first, chars: 0, lines: HU_Wrap(b.text, 196, false), ready: false };
  S_ChangeMusic('M_BRIEF', true);
}

function WI_BriefingTicker() {
  wi_bcnt++;
  if (!wi_brief) return;
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
    S_StartSound(null, 'menusl');
    const b = wi_brief;
    wi_brief = null;
    if (b.first) G_InitNew(d_skill, b.map);
    else G_DoLoadLevel();
    return true;
  }
  return false;
}

function WI_BriefingDrawer() {
  if (!wi_brief) return;
  V_DrawFullImage(W_CacheLumpName('WIMAP'));
  WI_DrawMapMarkers(wi_brief.map, wi_brief.map - 1);
  const b = BRIEFINGS[wi_brief.map];
  const bx = 118;
  V_DimRectPhys(UIOFS + (bx - 6) * SCALE, 4 * SCALE, (320 - bx + 4) * SCALE, 192 * SCALE, 5);
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
  if (wi_brief.ready && (wi_bcnt & 16)) V_DrawText(bx, 186, wi_brief.first ? 'Presione para iniciar la acción' : 'Presione para avanzar', false, V_Translations.red);
}
