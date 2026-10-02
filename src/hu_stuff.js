// =============================================================================
// hu_stuff.js — Mensajes en pantalla (hu_stuff.c)
// -----------------------------------------------------------------------------
// Línea de mensajes arriba a la izquierda (recogidas, avisos) y un cuadro
// informativo compacto arriba al centro para el título de la acción, las fases
// históricas y los objetivos: ancho justo al texto, breve (2 a 4 segundos) y
// lejos de la retícula para no interrumpir el combate.
// =============================================================================
'use strict';

const HU_MSGTIMEOUT = 4 * TICRATE;
const HU_BANNER_MIN = 2 * TICRATE;      // duración mínima de un cuadro
const HU_BANNER_MAX = 4 * TICRATE;      // y máxima (título de la acción: 3,5 s)
const HU_BANNER_TOP = 21;               // debajo de dos líneas de mensajes
const HU_BANNER_W = 220;                // ancho máximo del texto (px lógicos)
const HU_MSGFONT = 'note';              // letra de avisos: más chica que la de menús
let hu_lines = [];          // [{ text, tics }]
let hu_big = null;          // cuadro visible: { lines, tics, total, w, h }
let hu_queue = [];          // cuadros en espera
let hu_voice = null;        // subtítulo de la frase que grita un soldado: { text, acc, tics }

function HU_Init() {}

function HU_Start() {
  hu_lines = [];
  hu_big = null;
  hu_queue = [];
  hu_voice = null;
}

// Subtítulo breve (1,6 s) de lo que grita un soldado, sobre la barra de estado.
function HU_VoiceSubtitle(text, acc, near) {
  hu_voice = { text: '—' + text, acc: acc, tics: Math.round(1.6 * TICRATE), near: near };
}

function HU_PlayerMessage(player, text) {
  if (!text) return;
  if (!defaults.showMessages) return;
  hu_lines.push({ text: text, tics: HU_MSGTIMEOUT });
  if (hu_lines.length > 2) hu_lines.shift();   // dos líneas: el cuadro informativo va debajo
}

// title: título de la acción al entrar al nivel (letra grande). Los demás
// avisos van en letra chica con la primera línea en dorado. Si llega un aviso
// mientras otro está a la vista, el actual se acorta y el nuevo espera.
function HU_ShowBigMessage(text, title) {
  if (!text) return;
  const parts = String(text).split('\n').filter(function (p) { return p.trim(); });
  if (!parts.length) return;
  const lines = [];
  if (title) for (const h of HU_Wrap(parts[0], HU_BANNER_W, 'medium')) lines.push({ text: h, font: 'medium', gold: true });
  else for (const h of HU_Wrap(parts[0], HU_BANNER_W, HU_MSGFONT)) lines.push({ text: h, font: HU_MSGFONT, gold: true });
  for (let i = 1; i < parts.length; i++) {
    for (const w of HU_Wrap(parts[i], HU_BANNER_W, HU_MSGFONT)) lines.push({ text: w, font: HU_MSGFONT });
  }
  let w = 0, h = 0;
  for (const l of lines) {
    w = Math.max(w, V_StringWidth(l.text, l.font));
    h += V_LineHeight(l.font);
  }
  // Tiempo de lectura: unos 25 caracteres por segundo, entre 2 y 4 segundos.
  const chars = String(text).length;
  const tics = Math.round(clamp(50 + chars * 1.4, HU_BANNER_MIN, title ? 3.5 * TICRATE : HU_BANNER_MAX));
  const b = { lines: lines, tics: tics, total: tics, w: w, h: h };
  if (hu_big && hu_big.tics > 24) {
    hu_big.tics = Math.min(hu_big.tics, 40);
    hu_queue.push(b);
    if (hu_queue.length > 3) hu_queue.shift();
  } else if (hu_big) {
    hu_queue.push(b);
  } else hu_big = b;
}

// Ajuste de líneas por ancho en píxeles lógicos.
function HU_Wrap(text, width, big) {
  const words = String(text).split(/\s+/);
  const out = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (V_StringWidth(t, big) > width && cur) {
      out.push(cur);
      cur = w;
    } else cur = t;
  }
  if (cur) out.push(cur);
  return out;
}

function HU_Ticker() {
  for (let i = hu_lines.length - 1; i >= 0; i--) {
    if (--hu_lines[i].tics <= 0) hu_lines.splice(i, 1);
  }
  if (hu_voice && --hu_voice.tics <= 0) hu_voice = null;
  if (hu_big && --hu_big.tics <= 0) {
    hu_big = hu_queue.length ? hu_queue.shift() : null;
    // con más avisos en espera, cada uno se muestra menos tiempo
    if (hu_big && hu_queue.length) hu_big.tics = Math.min(hu_big.tics, 55);
  }
}

function HU_Responder(ev) {
  return false;
}

function HU_Drawer() {
  let y = 2;
  for (const l of hu_lines) {
    V_DrawText(2, y, l.text, HU_MSGFONT);
    y += V_LineHeight(HU_MSGFONT);
  }
  if (battle && battle.massive) HU_DrawForces();
  if (hu_voice) {
    // chilenos en dorado, peruanos y bolivianos en arena
    const y = (defaults.screenblocks === 10 ? 168 : 200) - V_LineHeight(HU_MSGFONT) - 14;
    V_DrawTextCentered(y, hu_voice.text, HU_MSGFONT, hu_voice.acc === 'cl' ? V_Translations.gold : V_Translations.sand);
  }
  if (hu_big) HU_DrawBanner(hu_big);
}

// Batallas masivas: efectivos en pie de cada bando y, si el objetivo es
// quebrar una posición, cuántos defensores faltan por abatir.
function HU_DrawForces() {
  const txt = 'Chile ' + factionList[FACTION_CHILE].length + '   Alianza ' + factionList[FACTION_ALIANZA].length;
  V_DrawText(318 - V_StringWidth(txt, HU_MSGFONT), 2, txt, HU_MSGFONT);
  const o = B_PendingObjective();
  let t2 = null;
  if (o && o.killtag && o.waitNear) t2 = 'Avance hacia: ' + (o.short || o.title);
  else if (o && o.killtag && o.remaining > 0) t2 = (o.short || 'Por abatir') + ': ' + o.remaining;
  if (t2) V_DrawText(318 - V_StringWidth(t2, HU_MSGFONT), 2 + V_LineHeight(HU_MSGFONT), t2, HU_MSGFONT, V_Translations.gold);
}

// Cuadro compacto: fondo oscurecido del ancho del texto, con un filete dorado.
function HU_DrawBanner(b) {
  const S = SCALE;
  const pad = 5;
  const bw = Math.ceil(b.w) + pad * 2, bh = b.h + 4;
  const x0 = 160 - bw / 2, y0 = HU_BANNER_TOP;
  // aparece deslizándose hacia abajo y se retira hacia arriba (4 tics)
  const t = Math.min(b.total - b.tics, b.tics, 4);
  const slide = (4 - t) * 3;
  const top = y0 - slide;
  if (top + bh <= 0) return;
  V_DimRectPhys(UIOFS + Math.round(x0 * S), Math.round(top * S), Math.round(bw * S), Math.round(bh * S), 16);
  V_FillRect(x0, top + bh - 1, bw, 1 / S, C(R_GOLD, 5));
  let yy = top + 2;
  for (const l of b.lines) {
    V_DrawTextCentered(yy, l.text, l.font, l.gold ? V_Translations.gold : undefined);
    yy += V_LineHeight(l.font);
  }
}
