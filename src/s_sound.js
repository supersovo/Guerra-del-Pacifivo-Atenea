// =============================================================================
// s_sound.js — Motor de sonido posicional (s_sound.c)
// -----------------------------------------------------------------------------
// Como DOOM: volumen por distancia y separación estéreo por ángulo respecto
// del oyente, canales limitados con prioridad y un sonido por origen.
// En batalla abierta el alcance auditivo es mayor que en DOOM.
// =============================================================================
'use strict';

const NUMCHANNELS = 16;
const S_CLIPPING_DIST = 1800;
const S_CLOSE_DIST = 200;
const S_STEREO_SWING = 0.7;

const channels = [];
for (let i = 0; i < NUMCHANNELS; i++) channels.push({ handle: null, origin: null, name: null, start: 0 });
let S_currentMusic = null;
let S_musicLoop = true;

const S_priority = { explod: 90, cannon: 90, bugle: 100, whistl: 70, pldeth: 100, pdiehi: 100, plpain: 80,
  itemup: 60, wpnup: 80, getpow: 80, secret: 90 };

function S_Init() {
  // los AudioBuffer se crean al desbloquear el audio (primer gesto del usuario)
}

function S_OnAudioUnlocked() {
  if (S_currentMusic) MUS_Play(S_currentMusic, S_musicLoop);
}

function S_AdjustSoundParams(listener, source) {
  const dx = source.x - listener.x, dy = source.y - listener.y;
  const adx = Math.abs(dx), ady = Math.abs(dy);
  const approx = adx + ady - Math.min(adx, ady) / 2;
  if (approx > S_CLIPPING_DIST) return null;
  let angle = R_PointToAngle2(listener.x, listener.y, source.x, source.y);
  angle = (angle - listener.angle) >>> 0;
  const sep = -Math.sin(angle * BAM2RAD) * S_STEREO_SWING;
  let vol;
  if (approx < S_CLOSE_DIST) vol = 1;
  else vol = (S_CLIPPING_DIST - approx) / (S_CLIPPING_DIST - S_CLOSE_DIST);
  return { vol: vol * vol, sep: sep };
}

function S_StartSound(origin, name) {
  if (!name) return;
  const lump = 'DS' + name.toUpperCase();
  if (W_CheckNumForName(lump) < 0) return;
  let vol = 1, sep = 0;
  const listener = players[0] && players[0].mo;
  if (origin && listener && origin !== listener) {
    const p = S_AdjustSoundParams(listener, origin);
    if (!p) return;
    vol = p.vol; sep = p.sep;
  }
  // un sonido por origen (como DOOM), salvo el mismo origen con otro sonido breve
  if (origin) {
    for (const ch of channels) {
      if (ch.origin === origin && ch.name === name && I_SoundIsPlaying(ch.handle)) {
        I_StopSound(ch.handle);
        ch.handle = null;
      }
    }
  }
  let slot = null;
  for (const ch of channels) if (!I_SoundIsPlaying(ch.handle)) { slot = ch; break; }
  if (!slot) {
    // robar el canal de menor prioridad / más antiguo
    let best = null, bestScore = Infinity;
    const pr = S_priority[name] || 50;
    for (const ch of channels) {
      const score = (S_priority[ch.name] || 50) * 10000 + ch.start;
      if (score < bestScore) { bestScore = score; best = ch; }
    }
    if ((S_priority[best.name] || 50) > pr) return;
    I_StopSound(best.handle);
    slot = best;
  }
  const pitch = 1 + (M_Random() - 128) / 128 * 0.05;
  slot.handle = I_StartSound(lump, vol, sep, pitch);
  slot.origin = origin && origin !== listener ? origin : null;
  slot.name = name;
  slot.start = gametic;
}

function S_StopSound(origin) {
  for (const ch of channels) {
    if (ch.origin === origin && ch.handle) {
      I_StopSound(ch.handle);
      ch.handle = null;
      ch.origin = null;
    }
  }
}

function S_UpdateSounds() {
  const listener = players[0] && players[0].mo;
  if (!listener) return;
  for (const ch of channels) {
    if (!ch.handle || !I_SoundIsPlaying(ch.handle) || !ch.origin) continue;
    if (ch.origin.removed) { ch.origin = { x: ch.origin.x, y: ch.origin.y, isorigin: true }; }
    const p = S_AdjustSoundParams(listener, ch.origin);
    if (!p) { I_StopSound(ch.handle); ch.handle = null; continue; }
    I_UpdateSoundParams(ch.handle, p.vol, p.sep);
  }
}

function S_StopAllSounds() {
  for (const ch of channels) {
    if (ch.handle) I_StopSound(ch.handle);
    ch.handle = null;
    ch.origin = null;
  }
}

function S_ChangeMusic(name, loop) {
  if (S_currentMusic === name) return;
  S_currentMusic = name;
  S_musicLoop = loop !== false;
  MUS_Play(name, S_musicLoop);
}

function S_StopMusic() {
  S_currentMusic = null;
  MUS_Stop();
}
