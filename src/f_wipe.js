// =============================================================================
// f_wipe.js — Transición "derretida" entre pantallas (f_wipe.c)
// -----------------------------------------------------------------------------
// La pantalla anterior se desliza hacia abajo en columnas con retrasos
// aleatorios, revelando la nueva: el efecto característico de DOOM.
// =============================================================================
'use strict';

let wipe_y = null;
let wipe_active = false;
let wipe_start = null, wipe_end = null;

function wipe_StartScreen() {
  wipe_start = new Uint8Array(screens[0]);
}

function wipe_EndScreen() {
  wipe_end = new Uint8Array(screens[0]);
}

function wipe_Begin() {
  const cols = Math.ceil(SCREENWIDTH / (2 * SCALE));
  wipe_y = new Int32Array(cols);
  wipe_y[0] = -(M_Random() % 16);
  for (let i = 1; i < cols; i++) {
    const r = (M_Random() % 3) - 1;
    wipe_y[i] = wipe_y[i - 1] + r;
    if (wipe_y[i] > 0) wipe_y[i] = 0;
    else if (wipe_y[i] === -16) wipe_y[i] = -15;
  }
  wipe_active = true;
}

// Avanza el derretido 'ticks' tics y dibuja; devuelve true al terminar.
function wipe_Do(ticks) {
  if (!wipe_start || !wipe_end || wipe_start.length !== screens[0].length) { wipe_active = false; return true; }
  const W = SCREENWIDTH, H = SCREENHEIGHT, S = SCALE;
  const Hlog = 200;
  let done = true;
  for (let t = 0; t < ticks; t++) {
    for (let i = 0; i < wipe_y.length; i++) {
      if (wipe_y[i] < 0) { wipe_y[i]++; done = false; }
      else if (wipe_y[i] < Hlog) {
        let dy = wipe_y[i] < 16 ? wipe_y[i] + 1 : 8;
        if (wipe_y[i] + dy >= Hlog) dy = Hlog - wipe_y[i];
        wipe_y[i] += dy;
        done = false;
      }
    }
  }
  const fb = screens[0];
  fb.set(wipe_end);
  for (let i = 0; i < wipe_y.length; i++) {
    const off = Math.max(0, wipe_y[i]) * S;
    const x0 = i * 2 * S, x1 = Math.min(W, x0 + 2 * S);
    for (let y = off; y < H; y++) {
      const srcRow = (y - off) * W, dstRow = y * W;
      for (let x = x0; x < x1; x++) fb[dstRow + x] = wipe_start[srcRow + x];
    }
  }
  if (done) wipe_active = false;
  return done;
}
