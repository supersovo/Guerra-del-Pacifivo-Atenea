// =============================================================================
// i_sound.js — Capa de plataforma de sonido (i_sound.c) sobre Web Audio
// -----------------------------------------------------------------------------
// Los efectos se sintetizan al arrancar (content/sounds.js) como muestras PCM,
// igual que los lumps DS* de DOOM. Aquí se crean los AudioBuffer y se reproducen
// con volumen y separación estéreo calculados por s_sound.js.
// =============================================================================
'use strict';

let I_audioCtx = null;
let I_sfxGain = null;
let I_musicGain = null;
let I_audioUnlocked = false;
const I_bufferCache = new Map();

function S_UnlockAudio() {
  try {
    if (!I_audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      I_audioCtx = new AC();
      I_sfxGain = I_audioCtx.createGain();
      I_sfxGain.connect(I_audioCtx.destination);
      I_musicGain = I_audioCtx.createGain();
      I_musicGain.connect(I_audioCtx.destination);
      I_SetSfxVolume(defaults.sfxVolume);
      I_SetMusicVolume(defaults.musicVolume);
    }
    if (I_audioCtx.state === 'suspended') I_audioCtx.resume();
    if (!I_audioUnlocked) {
      I_audioUnlocked = true;
      if (typeof S_OnAudioUnlocked === 'function') S_OnAudioUnlocked();
    }
  } catch (e) {
    I_audioCtx = null;
  }
}

function I_SetSfxVolume(v) {
  if (I_sfxGain) I_sfxGain.gain.value = Math.pow(v / 15, 1.5) * 0.9;
}
function I_SetMusicVolume(v) {
  if (I_musicGain) I_musicGain.gain.value = Math.pow(v / 15, 1.5) * 0.55;
}

// Obtiene (o crea) el AudioBuffer de un lump de sonido. Las muestras vienen
// en coma flotante (samples) o en 16 bits (pcm16, las voces: ocupan la mitad).
function I_GetSfxBuffer(lumpname) {
  let b = I_bufferCache.get(lumpname);
  if (b) return b;
  const n = W_CheckNumForName(lumpname);
  if (n < 0 || !I_audioCtx) return null;
  const snd = W_CacheLumpNum(n);
  if (snd.pcm16) {
    b = I_audioCtx.createBuffer(1, snd.pcm16.length, snd.rate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = snd.pcm16[i] / 32767;
  } else {
    b = I_audioCtx.createBuffer(1, snd.samples.length, snd.rate);
    b.getChannelData(0).set(snd.samples);
  }
  I_bufferCache.set(lumpname, b);
  return b;
}

// Inicia un sonido. vol 0..1, sep -1 (izquierda) .. 1 (derecha); lp: corte
// de un paso bajo (Hz) para las voces lejanas, o nada.
function I_StartSound(lumpname, vol, sep, pitch, lp) {
  if (!I_audioCtx || I_audioCtx.state !== 'running') return null;
  const buf = I_GetSfxBuffer(lumpname);
  if (!buf) return null;
  const src = I_audioCtx.createBufferSource();
  src.buffer = buf;
  if (pitch && pitch !== 1) src.playbackRate.value = pitch;
  const gain = I_audioCtx.createGain();
  gain.gain.value = vol;
  let head = src, filter = null;
  if (lp) {
    filter = I_audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lp;
    filter.Q.value = 0.5;
    src.connect(filter);
    head = filter;
  }
  let pan = null;
  if (I_audioCtx.createStereoPanner) {
    pan = I_audioCtx.createStereoPanner();
    pan.pan.value = sep;
    head.connect(gain); gain.connect(pan); pan.connect(I_sfxGain);
  } else {
    head.connect(gain); gain.connect(I_sfxGain);
  }
  const h = { src: src, gain: gain, pan: pan, filter: filter, playing: true };
  src.onended = function () { h.playing = false; };
  src.start();
  return h;
}

function I_UpdateSoundParams(h, vol, sep, lp) {
  if (!h || !h.playing) return;
  const t = I_audioCtx.currentTime;
  h.gain.gain.setTargetAtTime(vol, t, 0.015);
  if (h.pan) h.pan.pan.setTargetAtTime(sep, t, 0.015);
  if (h.filter && lp) h.filter.frequency.setTargetAtTime(lp, t, 0.03);
}

function I_StopSound(h) {
  if (!h || !h.playing) return;
  try { h.src.stop(); } catch (e) { /* ya detenido */ }
  h.playing = false;
}

function I_SoundIsPlaying(h) {
  return !!(h && h.playing);
}
