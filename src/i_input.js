// =============================================================================
// i_input.js — Entrada de plataforma: teclado, ratón, pantalla táctil y mando
// -----------------------------------------------------------------------------
// Como en DOOM, las entradas se convierten en eventos (event_t) que se encolan
// con D_PostEvent y se reparten a los "responders" (menú, automapa, barra de
// estado, juego). El juego nunca lee el teclado directamente: construye un
// ticcmd por tic a partir del estado acumulado (G_BuildTiccmd).
// =============================================================================
'use strict';

const ev_keydown = 0, ev_keyup = 1, ev_mouse = 2, ev_char = 3, ev_pointer = 4;

const I_events = [];
let I_pointerLocked = false;
let I_mouseDX = 0, I_mouseDY = 0;
const I_touch = { active: false, moveX: 0, moveY: 0, turn: 0, look: 0, stickId: null, lookId: null, lookX: 0, lookY: 0 };
const I_pad = { forward: 0, side: 0, turn: 0, look: 0, buttons: {} };

function D_PostEvent(ev) {
  I_events.push(ev);
}

// Teclas que el navegador no debe procesar mientras se juega.
const I_blockedKeys = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab',
  'Backspace', 'Slash', 'Quote', 'PageUp', 'PageDown', 'Home', 'End', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12']);

function I_InitInput(canvas) {
  window.addEventListener('keydown', function (e) {
    if (I_blockedKeys.has(e.code) || e.ctrlKey && e.code !== 'ControlLeft' && e.code !== 'ControlRight') {
      // Ctrl+R / Ctrl+W no se bloquean para no molestar al usuario
      if (!(e.ctrlKey && (e.code === 'KeyR' || e.code === 'KeyW' || e.code === 'KeyT'))) e.preventDefault();
    }
    if (e.code === 'Space') e.preventDefault();
    S_UnlockAudio();
    if (!e.repeat) D_PostEvent({ type: ev_keydown, data1: e.code });
    else D_PostEvent({ type: ev_keydown, data1: e.code, repeat: true });
    if (e.key && e.key.length === 1) D_PostEvent({ type: ev_char, data1: e.key });
  });
  window.addEventListener('keyup', function (e) {
    D_PostEvent({ type: ev_keyup, data1: e.code });
  });
  window.addEventListener('blur', function () {
    // soltar todas las teclas al perder el foco
    D_PostEvent({ type: ev_keyup, data1: '*' });
  });

  // --- Ratón ---
  canvas.addEventListener('mousedown', function (e) {
    S_UnlockAudio();
    const code = e.button === 0 ? 'MOUSE1' : e.button === 2 ? 'MOUSE2' : 'MOUSE3';
    if (!I_pointerLocked && I_WantsPointerLock()) {
      I_RequestPointerLock();
      if (e.button === 0) return; // el primer clic sólo captura el ratón
    }
    D_PostEvent({ type: ev_keydown, data1: code });
    if (!I_pointerLocked) D_PostEvent({ type: ev_pointer, data1: 'down', x: e.clientX, y: e.clientY });
  });
  window.addEventListener('mouseup', function (e) {
    const code = e.button === 0 ? 'MOUSE1' : e.button === 2 ? 'MOUSE2' : 'MOUSE3';
    D_PostEvent({ type: ev_keyup, data1: code });
  });
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  window.addEventListener('mousemove', function (e) {
    if (I_pointerLocked) {
      I_mouseDX += e.movementX || 0;
      I_mouseDY += e.movementY || 0;
    } else {
      D_PostEvent({ type: ev_pointer, data1: 'move', x: e.clientX, y: e.clientY });
    }
  });
  canvas.addEventListener('wheel', function (e) {
    e.preventDefault();
    const code = e.deltaY < 0 ? 'WHEELUP' : 'WHEELDOWN';
    D_PostEvent({ type: ev_keydown, data1: code });
    D_PostEvent({ type: ev_keyup, data1: code });
  }, { passive: false });
  document.addEventListener('pointerlockchange', function () {
    const was = I_pointerLocked;
    I_pointerLocked = document.pointerLockElement === canvas;
    if (was && !I_pointerLocked) {
      // Esc libera el ratón en el navegador: abrir el menú como haría DOOM.
      D_PostEvent({ type: ev_keydown, data1: 'POINTERLOST' });
      D_PostEvent({ type: ev_keyup, data1: 'POINTERLOST' });
    }
  });

  I_InitTouch(canvas);
}

function I_WantsPointerLock() {
  return typeof gamestate !== 'undefined' && gamestate === GS_LEVEL && !menuactive && !I_touch.active;
}

function I_RequestPointerLock() {
  try {
    if (I_canvas.requestPointerLock) {
      const p = I_canvas.requestPointerLock();
      if (p && p.catch) p.catch(function () { /* el navegador rechazó la captura */ });
    }
  } catch (e) { /* sin captura de ratón */ }
}

function I_ReleasePointerLock() {
  try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { /* nada */ }
}

// Convierte coordenadas de cliente a coordenadas lógicas 320x200 (para menús).
function I_ClientToLogical(cx, cy) {
  const r = I_canvas.getBoundingClientRect();
  const px = (cx - r.left) / r.width * SCREENWIDTH;
  const py = (cy - r.top) / r.height * SCREENHEIGHT;
  return { x: (px - UIOFS) / SCALE, y: py / SCALE };
}

// --- Controles táctiles ---------------------------------------------------------------
let I_touchUI = null;

function I_TouchEnabled() {
  if (defaults.touchControls === 0) return false;
  if (defaults.touchControls === 1) return true;
  return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0 && window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
}

function I_InitTouch(canvas) {
  const ui = document.getElementById('touch');
  if (!ui) return;
  I_touchUI = ui;
  const stick = document.getElementById('t-stick');
  const knob = document.getElementById('t-knob');
  const look = document.getElementById('t-look');

  function btn(id, code) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('touchstart', function (e) {
      e.preventDefault(); S_UnlockAudio();
      el.classList.add('on');
      D_PostEvent({ type: ev_keydown, data1: code });
    }, { passive: false });
    const up = function (e) {
      e.preventDefault();
      el.classList.remove('on');
      D_PostEvent({ type: ev_keyup, data1: code });
    };
    el.addEventListener('touchend', up, { passive: false });
    el.addEventListener('touchcancel', up, { passive: false });
  }
  btn('t-fire', 'TOUCH_FIRE');
  btn('t-aim', 'TOUCH_AIM');
  btn('t-use', 'TOUCH_USE');
  btn('t-weap', 'TOUCH_WEAPON');
  btn('t-map', 'Tab');
  btn('t-menu', 'Escape');

  let stickCX = 0, stickCY = 0;
  stick.addEventListener('touchstart', function (e) {
    e.preventDefault(); S_UnlockAudio();
    const t = e.changedTouches[0];
    I_touch.stickId = t.identifier;
    const r = stick.getBoundingClientRect();
    stickCX = r.left + r.width / 2; stickCY = r.top + r.height / 2;
    moveStick(t);
  }, { passive: false });
  function moveStick(t) {
    const r = stick.getBoundingClientRect();
    const max = r.width * 0.4;
    let dx = t.clientX - stickCX, dy = t.clientY - stickCY;
    const d = Math.hypot(dx, dy);
    if (d > max) { dx *= max / d; dy *= max / d; }
    I_touch.moveX = dx / max;
    I_touch.moveY = -dy / max;
    knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
  }
  stick.addEventListener('touchmove', function (e) {
    e.preventDefault();
    for (const t of e.changedTouches) if (t.identifier === I_touch.stickId) moveStick(t);
  }, { passive: false });
  const stickEnd = function (e) {
    for (const t of e.changedTouches) {
      if (t.identifier === I_touch.stickId) {
        I_touch.stickId = null; I_touch.moveX = I_touch.moveY = 0;
        knob.style.transform = 'translate(0px,0px)';
      }
    }
  };
  stick.addEventListener('touchend', stickEnd);
  stick.addEventListener('touchcancel', stickEnd);

  look.addEventListener('touchstart', function (e) {
    e.preventDefault(); S_UnlockAudio();
    const t = e.changedTouches[0];
    I_touch.lookId = t.identifier;
    I_touch.lookX = t.clientX;
    I_touch.lookY = t.clientY;
  }, { passive: false });
  look.addEventListener('touchmove', function (e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === I_touch.lookId) {
        I_touch.turn += (t.clientX - I_touch.lookX);
        I_touch.look += (t.clientY - I_touch.lookY) * (defaults.mouseInvertY ? -1 : 1);
        I_touch.lookX = t.clientX;
        I_touch.lookY = t.clientY;
      }
    }
  }, { passive: false });
  const lookEnd = function (e) {
    for (const t of e.changedTouches) if (t.identifier === I_touch.lookId) I_touch.lookId = null;
  };
  look.addEventListener('touchend', lookEnd);
  look.addEventListener('touchcancel', lookEnd);

  // Toques sobre el canvas fuera del juego (menús): se tratan como puntero.
  canvas.addEventListener('touchstart', function (e) {
    S_UnlockAudio();
    const t = e.changedTouches[0];
    D_PostEvent({ type: ev_pointer, data1: 'tap', x: t.clientX, y: t.clientY });
  }, { passive: true });
}

// Muestra u oculta los controles táctiles según el estado del juego.
function I_UpdateTouchUI() {
  if (!I_touchUI) return;
  const want = I_TouchEnabled() && gamestate === GS_LEVEL && !menuactive;
  I_touch.active = I_TouchEnabled();
  const cur = I_touchUI.style.display === 'block';
  if (want !== cur) I_touchUI.style.display = want ? 'block' : 'none';
}

// --- Mando (Gamepad API) ------------------------------------------------------------------
const I_padPrev = {};
function I_PollGamepad() {
  I_pad.forward = I_pad.side = I_pad.turn = I_pad.look = 0;
  if (!navigator.getGamepads) return;
  const pads = navigator.getGamepads();
  for (const gp of pads) {
    if (!gp || !gp.connected) continue;
    const dz = function (v) { return Math.abs(v) < 0.18 ? 0 : v; };
    I_pad.side = dz(gp.axes[0] || 0);
    I_pad.forward = -dz(gp.axes[1] || 0);
    I_pad.turn = dz(gp.axes[2] || 0);
    I_pad.look = dz(gp.axes[3] || 0);
    const map = { 0: 'PAD_A', 1: 'PAD_B', 2: 'PAD_X', 3: 'PAD_Y', 4: 'PAD_LB', 5: 'PAD_RB',
      6: 'PAD_LT', 7: 'PAD_RT', 8: 'PAD_BACK', 9: 'PAD_START', 10: 'PAD_LS', 11: 'PAD_RS',
      12: 'ArrowUp', 13: 'ArrowDown', 14: 'ArrowLeft', 15: 'ArrowRight' };
    for (const k in map) {
      const b = gp.buttons[k];
      const pressed = !!(b && (b.pressed || b.value > 0.5));
      const code = map[k];
      if (pressed !== !!I_padPrev[code]) {
        I_padPrev[code] = pressed;
        D_PostEvent({ type: pressed ? ev_keydown : ev_keyup, data1: code });
      }
    }
    break;
  }
}

// I_StartTic: recoge el movimiento acumulado del ratón como un evento ev_mouse.
function I_StartTic() {
  I_PollGamepad();
  if (I_mouseDX || I_mouseDY) {
    D_PostEvent({ type: ev_mouse, data1: 0, data2: I_mouseDX, data3: I_mouseDY });
    I_mouseDX = I_mouseDY = 0;
  }
}
