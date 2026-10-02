// =============================================================================
// m_misc.js — Utilidades varias: cajas delimitadoras, configuración, guardado
// =============================================================================
'use strict';

// --- Cajas delimitadoras (m_bbox.c) ---------------------------------------------
function M_ClearBox(box) {
  box[BOXTOP] = box[BOXRIGHT] = -Infinity;
  box[BOXBOTTOM] = box[BOXLEFT] = Infinity;
}
function M_AddToBox(box, x, y) {
  if (x < box[BOXLEFT]) box[BOXLEFT] = x;
  if (x > box[BOXRIGHT]) box[BOXRIGHT] = x;
  if (y < box[BOXBOTTOM]) box[BOXBOTTOM] = y;
  if (y > box[BOXTOP]) box[BOXTOP] = y;
}

// --- Almacenamiento local seguro -------------------------------------------------
function M_StorageGet(key, def) {
  try {
    const v = window.localStorage.getItem('atenea1879.' + key);
    if (v === null || v === undefined) return def;
    return JSON.parse(v);
  } catch (e) {
    return def;
  }
}
function M_StorageSet(key, value) {
  try {
    window.localStorage.setItem('atenea1879.' + key, JSON.stringify(value));
  } catch (e) { /* almacenamiento no disponible: se ignora */ }
}

// --- Configuración (m_misc.c: M_LoadDefaults / M_SaveDefaults) --------------------
const defaults = {
  configVersion: 2,
  mouseSensitivity: 5,
  sfxVolume: 10,
  musicVolume: 7,
  resolution: 0,         // 0 = automática; 1..4 = 320x200, 640x400, 960x600, 1280x800
  screenblocks: 10,      // 10 = barra de estado, 11 = pantalla completa
  showMessages: 1,
  alwaysRun: 1,
  interpolate: 1,        // renderizado fluido con interpolación entre tics
  widescreen: 1,
  usegamma: 0,
  mouseLook: 1,          // 1 = mirar arriba/abajo y apuntar con el ratón (moderno)
  mouseInvertY: 0,
  mouseMove: 0,          // 1 = el eje Y del ratón mueve adelante/atrás (clásico, sin mirar)
  touchControls: 2,      // 0 = no, 1 = sí, 2 = automático
  crosshair: 1,
  voices: 1,             // frases de los soldados con la voz del navegador (s_voice.js)
  voiceSubtitles: 1      // subtítulo breve con la frase gritada
};

// Claves cuyo valor guardado por una versión anterior se descarta (cambió su
// valor por omisión o su significado).
const M_RESET_ON_UPGRADE = ['crosshair', 'resolution', 'mouseLook', 'mouseMove'];

function M_LoadDefaults() {
  const saved = M_StorageGet('config', null);
  if (saved && typeof saved === 'object') {
    const upgrade = saved.configVersion !== defaults.configVersion;
    for (const k in defaults) {
      if (k === 'configVersion' || (upgrade && M_RESET_ON_UPGRADE.indexOf(k) >= 0)) continue;
      if (typeof saved[k] === typeof defaults[k]) defaults[k] = saved[k];
    }
  }
}
function M_SaveDefaults() {
  M_StorageSet('config', defaults);
}

// --- Utilidades numéricas --------------------------------------------------------
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function lerp(a, b, t) { return a + (b - a) * t; }

// Espera un cuadro de animación (para no bloquear la carga).
function M_NextFrame() {
  return new Promise(function (resolve) {
    let done = false;
    const finish = function () { if (!done) { done = true; resolve(); } };
    // requestAnimationFrame permite que el navegador pinte la consola de carga;
    // el temporizador evita quedar detenidos si la pestaña está oculta.
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(finish);
    setTimeout(finish, 40);
  });
}
