// =============================================================================
// hu_stuff.js — Mensajes en pantalla (hu_stuff.c)
// -----------------------------------------------------------------------------
// Línea de mensajes arriba a la izquierda (recogidas, avisos) y un mensaje
// grande centrado para títulos de misión, fases históricas y objetivos.
// =============================================================================
'use strict';

const HU_MSGTIMEOUT = 4 * TICRATE;
const HU_BIGTIMEOUT = 6 * TICRATE;
let hu_lines = [];          // [{ text, tics }]
let hu_big = null;          // { lines, tics, total }

function HU_Init() {}

function HU_Start() {
  hu_lines = [];
  hu_big = null;
}

function HU_PlayerMessage(player, text) {
  if (!text) return;
  if (!defaults.showMessages) return;
  hu_lines.push({ text: text, tics: HU_MSGTIMEOUT });
  if (hu_lines.length > 3) hu_lines.shift();
}

function HU_ShowBigMessage(text) {
  if (!text) return;
  const parts = String(text).split('\n');
  const lines = [];
  // El titular va en letra grande; si no cabe en dos líneas, en letra chica dorada.
  const head = HU_Wrap(parts[0], 300, true);
  if (head.length <= 2) for (const h of head) lines.push({ text: h, big: true });
  else for (const h of HU_Wrap(parts[0], 300, false)) lines.push({ text: h, big: false, gold: true });
  for (let i = 1; i < parts.length; i++) {
    for (const w of HU_Wrap(parts[i], 300, false)) lines.push({ text: w, big: false });
  }
  hu_big = { lines: lines, tics: HU_BIGTIMEOUT + lines.length * 12, total: HU_BIGTIMEOUT + lines.length * 12 };
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
  if (hu_big && --hu_big.tics <= 0) hu_big = null;
}

function HU_Responder(ev) {
  return false;
}

function HU_Drawer() {
  let y = 2;
  for (const l of hu_lines) {
    V_DrawText(2, y, l.text, false);
    y += 11;
  }
  if (hu_big) {
    // se desvanece al final (parpadeo de las últimas décimas)
    if (hu_big.tics < 20 && (hu_big.tics & 2)) return;
    let total = 0;
    for (const l of hu_big.lines) total += l.big ? 22 : 11;
    let yy = Math.max(26, 64 - total / 2);
    const S = SCALE;
    const w = 312;
    V_DimRectPhys(UIOFS + 4 * S, (yy - 5) * S, w * S, (total + 8) * S, 18);
    for (const l of hu_big.lines) {
      if (l.big) {
        V_DrawTextCentered(yy, l.text, true, V_Translations.gold);
        yy += 22;
      } else {
        V_DrawTextCentered(yy, l.text, false, l.gold ? V_Translations.gold : undefined);
        yy += 11;
      }
    }
  }
}
