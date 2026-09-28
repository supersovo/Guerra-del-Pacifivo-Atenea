// =============================================================================
// f_finale.js — Epílogo de la campaña (f_finale.c)
// -----------------------------------------------------------------------------
// Texto que aparece letra a letra sobre un fondo de arena (como el final de
// los episodios de DOOM) y luego el Morro Solar al atardecer con la bandera.
// =============================================================================
'use strict';

let finalestage = 0;
let finalecount = 0;
let finaleLines = [];

function F_StartFinale() {
  gameaction = ga_nothing;
  gamestate = GS_FINALE;
  viewactive = false;
  automapactive = false;
  finalestage = 0;
  finalecount = 0;
  finaleLines = [];
  for (const para of FINALE_TEXT) {
    if (!para) { finaleLines.push(''); continue; }
    for (const w of HU_Wrap(para, 290, false)) finaleLines.push(w);
  }
  S_ChangeMusic('M_FINAL', true);
}

function F_Responder(ev) {
  if (ev.type === ev_keydown || (ev.type === ev_pointer && (ev.data1 === 'down' || ev.data1 === 'tap'))) {
    if (finalestage === 0) {
      const total = finaleLines.join(' ').length;
      if (finalecount / 2 < total) finalecount = total * 2 + 1;
      else { finalestage = 1; finalecount = 0; }
      return true;
    }
    if (finalestage === 1 && finalecount > TICRATE) {
      D_StartTitle();
      return true;
    }
  }
  return false;
}

function F_Ticker() {
  finalecount++;
}

function F_Drawer() {
  if (finalestage === 0) {
    V_TileFlat(flats[R_FlatNumForName('ARENA1')], 14);
    let remaining = Math.floor(finalecount / 2);
    let y = 14;
    for (const l of finaleLines) {
      if (remaining <= 0) break;
      V_DrawText(14, y, l.slice(0, remaining), false);
      remaining -= l.length + 1;
      y += 11;
    }
    return;
  }
  V_DrawFullImage(W_CacheLumpName('FINALPIC'));
  V_DrawTextCentered(150, '17 de enero de 1881: el ejército chileno entra en Lima', false);
  V_DrawTextCentered(166, 'FIN', true, V_Translations.gold);
}
