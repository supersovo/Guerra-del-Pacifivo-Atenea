// =============================================================================
// face.js — Rostro del soldado chileno en la barra de estado (STF*)
// -----------------------------------------------------------------------------
// Como la cara de DOOM: cinco niveles de heridas y varias expresiones (mirar
// a los lados, girar hacia el atacante, grito de dolor, sonrisa al recoger un
// arma, dientes apretados al disparar sin parar, invulnerable y muerto).
// Viste el kepí rojo con franja azul de la infantería de línea chilena y el
// cubrenuca blanco usado en el desierto.
// =============================================================================
'use strict';

const FACE_W = 24, FACE_H = 30;

function face_canvas() {
  const px = new Int16Array(FACE_W * FACE_H).fill(-1);
  return {
    px: px,
    set: function (x, y, c) { x |= 0; y |= 0; if (x >= 0 && y >= 0 && x < FACE_W && y < FACE_H) px[y * FACE_W + x] = c; },
    get: function (x, y) { return (x >= 0 && y >= 0 && x < FACE_W && y < FACE_H) ? px[y * FACE_W + x] : -1; },
    ellipse: function (cx, cy, rx, ry, colorFn) {
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
          const d = dx * dx + dy * dy;
          if (d <= 1) this.set(x, y, typeof colorFn === 'function' ? colorFn(x, y, dx, dy, d) : colorFn);
        }
      }
    },
    rect: function (x0, y0, w, h, c) {
      for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) this.set(x, y, c);
    }
  };
}

// pain 0..4 (0 = sano); expr: 'st','ouch','evil','kill','god','dead'; look: -1/0/1; turn: -1/0/1
function FACE_Draw(pain, expr, look, turn) {
  const f = face_canvas();
  const sh = turn * 2;               // desplazamiento de rasgos al girar la cabeza
  const dead = expr === 'dead';
  const skinBase = dead ? 5 : 3 + Math.min(pain, 3) * 0.5;
  const skin = function (x, y, dx, dy) {
    // luz desde arriba a la izquierda
    let s = skinBase + dx * 2.2 + dy * 1.6;
    return C(R_SKIN, Math.round(clamp(s, 1, 11)));
  };
  // cubrenuca (havelock) blanco tras la cabeza
  f.rect(2, 8, 3, 13, C(R_LINEN, 2));
  f.rect(19, 8, 3, 13, C(R_LINEN, 3));
  for (let y = 8; y < 21; y++) { f.set(2, y, C(R_LINEN, 5)); f.set(21, y, C(R_LINEN, 7)); }
  // cuello y cuello de la levita (azul con cuello rojo)
  f.rect(8, 25, 8, 5, C(R_SKIN, 7));
  f.rect(4, 27, 16, 3, C(R_NAVY, 9));
  f.rect(6, 27, 3, 2, C(R_RED, 5));
  f.rect(15, 27, 3, 2, C(R_RED, 5));
  // orejas
  f.ellipse(4.2 + sh * 0.4, 16.5, 1.4, 2.4, C(R_SKIN, 6));
  f.ellipse(19.8 + sh * 0.4, 16.5, 1.4, 2.4, C(R_SKIN, 7));
  // cabeza
  f.ellipse(12 + sh * 0.5, 17.5, 7.6, 9.8, skin);
  // kepí: copa roja, franja azul, visera negra (ligeramente ladeado)
  for (let y = 0; y <= 6; y++) {
    const inset = Math.round((6 - y) * 0.25);
    for (let x = 5 + inset; x <= 18 - inset; x++) {
      const shade = 3 + Math.round((x - 5) / 13 * 4) + (y < 2 ? -1 : 0);
      f.set(x + sh * 0.5, y, C(R_RED, clamp(shade, 1, 12)));
    }
  }
  f.rect(4 + Math.round(sh * 0.5), 6, 16, 3, C(R_NAVY, 6));
  for (let x = 4; x < 20; x++) f.set(x + sh * 0.5, 6, C(R_NAVY, 4));
  f.rect(5 + Math.round(sh * 0.5), 9, 14, 1, C(R_GRAY, 14));
  f.rect(6 + Math.round(sh * 0.5), 10, 12, 1, C(R_GRAY, 12));
  // escarapela / botón del barbiquejo
  f.set(4 + sh * 0.5, 8, C(R_GOLD, 3));
  f.set(19 + sh * 0.5, 8, C(R_GOLD, 4));
  // cejas
  const browY = expr === 'ouch' ? 11 : 12;
  const browCol = C(R_WOOD, 12);
  const angry = expr === 'kill' || expr === 'evil';
  for (let k = 0; k < 3; k++) {
    f.set(7 + k + sh, browY + (angry ? k === 2 ? 1 : 0 : 0), browCol);
    f.set(14 + k + sh, browY + (angry ? k === 0 ? 1 : 0 : 0), browCol);
  }
  // ojos
  const eyeY = 14;
  if (dead) {
    f.set(8 + sh, eyeY, C(R_SKIN, 11)); f.set(9 + sh, eyeY, C(R_SKIN, 11));
    f.set(14 + sh, eyeY, C(R_SKIN, 11)); f.set(15 + sh, eyeY, C(R_SKIN, 11));
  } else {
    const white = expr === 'god' ? C(R_GOLD, 1) : C(R_LINEN, 1);
    const pupil = expr === 'god' ? C(R_FIRE, 1) : C(R_GRAY, 15);
    const wide = expr === 'ouch';
    for (const ex of [8, 14]) {
      f.set(ex + sh, eyeY, white); f.set(ex + 1 + sh, eyeY, white);
      if (wide) { f.set(ex + sh, eyeY - 1, white); f.set(ex + 1 + sh, eyeY - 1, white); }
      const p = look < 0 ? ex : look > 0 ? ex + 1 : ex + (turn < 0 ? 0 : 1);
      f.set(p + sh, eyeY, pupil);
    }
  }
  // nariz
  f.set(11 + sh, 15, C(R_SKIN, 6)); f.set(12 + sh, 16, C(R_SKIN, 7));
  f.set(11 + sh, 17, C(R_SKIN, 8)); f.set(12 + sh, 17, C(R_SKIN, 9));
  // bigote
  const mcol = C(R_WOOD, 13);
  for (let x = 8; x <= 15; x++) f.set(x + sh, 19, mcol);
  f.set(7 + sh, 20, mcol); f.set(16 + sh, 20, mcol);
  f.set(10 + sh, 18, mcol); f.set(13 + sh, 18, mcol);
  // boca
  const mouthY = 21;
  if (expr === 'ouch' || dead) {
    f.rect(10 + sh, mouthY, 4, 2, C(R_RED, 13));
    if (expr === 'ouch') f.rect(10 + sh, mouthY + 2, 4, 1, C(R_RED, 11));
  } else if (expr === 'evil') {
    for (let x = 9; x <= 14; x++) f.set(x + sh, mouthY, C(R_LINEN, 1));
    f.set(8 + sh, mouthY - 1, C(R_SKIN, 10)); f.set(15 + sh, mouthY - 1, C(R_SKIN, 10));
    for (let x = 9; x <= 14; x++) f.set(x + sh, mouthY + 1, C(R_SKIN, 9));
  } else if (expr === 'kill') {
    for (let x = 9; x <= 14; x++) { f.set(x + sh, mouthY, C(R_LINEN, 2)); f.set(x + sh, mouthY + 1, (x & 1) ? C(R_LINEN, 4) : C(R_GRAY, 13)); }
  } else {
    for (let x = 10; x <= 13; x++) f.set(x + sh, mouthY, C(R_SKIN, 10));
  }
  // heridas según el nivel de dolor
  const blood = C(R_RED, 6), blood2 = C(R_RED, 9);
  if (pain >= 1 || dead) { f.set(17 + sh, 12, blood); f.set(17 + sh, 13, blood2); f.set(6 + sh, 22, C(R_SKIN, 9)); }
  if (pain >= 2 || dead) { for (let y = 11; y < 17; y++) f.set(18 + sh, y, y & 1 ? blood : blood2); f.set(7 + sh, 16, C(R_SKIN, 10)); }
  if (pain >= 3 || dead) { f.rect(13 + sh, 11, 3, 1, blood); f.set(12 + sh, 18, blood); f.set(12 + sh, 19, blood2); f.set(8 + sh, 13, C(R_SKIN, 11)); }
  if (pain >= 4 || dead) { for (let y = 12; y < 24; y++) f.set(6 + sh, y, (y % 3) ? blood : blood2); f.rect(14 + sh, 13, 3, 3, C(R_RED, 12)); f.set(15 + sh, 14, C(R_LINEN, 3)); }
  return V_MakePatch(FACE_W, FACE_H, f.px, 0, 0);
}

function FACE_BuildLumps() {
  for (let p = 0; p < 5; p++) {
    W_AddLump('STFST' + p + '0', FACE_Draw(p, 'st', 0, 0), 'patch');
    W_AddLump('STFST' + p + '1', FACE_Draw(p, 'st', 1, 0), 'patch');
    W_AddLump('STFST' + p + '2', FACE_Draw(p, 'st', -1, 0), 'patch');
    W_AddLump('STFTR' + p + '0', FACE_Draw(p, 'st', 1, 1), 'patch');
    W_AddLump('STFTL' + p + '0', FACE_Draw(p, 'st', -1, -1), 'patch');
    W_AddLump('STFOUCH' + p, FACE_Draw(p, 'ouch', 0, 0), 'patch');
    W_AddLump('STFEVL' + p, FACE_Draw(p, 'evil', 0, 0), 'patch');
    W_AddLump('STFKILL' + p, FACE_Draw(p, 'kill', 0, 0), 'patch');
  }
  W_AddLump('STFGOD0', FACE_Draw(0, 'god', 0, 0), 'patch');
  W_AddLump('STFDEAD0', FACE_Draw(4, 'dead', 0, 0), 'patch');
}
