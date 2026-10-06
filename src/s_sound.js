// =============================================================================
// s_sound.js — Motor de sonido posicional (s_sound.c)
// -----------------------------------------------------------------------------
// Como DOOM: volumen por distancia y separación estéreo por ángulo respecto
// del oyente, canales limitados con prioridad y un sonido por origen.
// En batalla abierta el alcance auditivo es mayor que en DOOM. Las frases que
// gritan los soldados (S_StartVoice) suenan desde su boca como cualquier
// efecto, con prioridad alta y un paso bajo que apaga los agudos a lo lejos.
// =============================================================================
'use strict';

const NUMCHANNELS = 16;
const S_CLIPPING_DIST = 1800;
const S_CLOSE_DIST = 200;
const S_STEREO_SWING = 0.7;

const channels = [];
for (let i = 0; i < NUMCHANNELS; i++) channels.push({ handle: null, origin: null, name: null, start: 0, voice: false });
let S_currentMusic = null;
let S_musicLoop = true;

const S_priority = { explod: 90, cannon: 90, bugle: 100, whistl: 70, pldeth: 100, pdiehi: 100, plpain: 80,
  itemup: 60, wpnup: 80, getpow: 80, secret: 90 };
const S_VOICE_PRIORITY = 75;     // frases de los soldados: sobre los disparos, bajo explosiones y el jugador

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
  return { vol: vol * vol, sep: sep, dist: approx };
}

// Canal libre o, si no hay, el de menor prioridad / más antiguo que no
// supere la prioridad pr. null si todos valen más.
function S_GetChannel(pr) {
  for (const ch of channels) if (!I_SoundIsPlaying(ch.handle)) return ch;
  let best = null, bestScore = Infinity;
  for (const ch of channels) {
    const score = S_ChannelPriority(ch) * 10000 + ch.start;
    if (score < bestScore) { bestScore = score; best = ch; }
  }
  if (S_ChannelPriority(best) > pr) return null;
  I_StopSound(best.handle);
  return best;
}

function S_ChannelPriority(ch) {
  return ch.voice ? S_VOICE_PRIORITY : S_priority[ch.name] || 50;
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
  const slot = S_GetChannel(S_priority[name] || 50);
  if (!slot) return;
  const pitch = 1 + (M_Random() - 128) / 128 * 0.05;
  slot.handle = I_StartSound(lump, vol, sep, pitch);
  slot.origin = origin && origin !== listener ? origin : null;
  slot.name = name;
  slot.start = gametic;
  slot.voice = false;
}

// --- Voces de los soldados ---------------------------------------------------------------------

// Paso bajo según la distancia: de 10 kHz junto al oyente a 2,2 kHz en el
// límite del oído (el aire y el terreno se comen los agudos del grito).
function S_VoiceCutoff(dist) {
  const u = clamp((dist - S_CLOSE_DIST) / (S_CLIPPING_DIST - S_CLOSE_DIST), 0, 1);
  return 10000 * Math.pow(0.22, u);
}

// Una frase gritada por origin (name: v + número de frase y voz, lump DSV*).
// pitch: el tono propio de cada soldado. Devuelve el canal o null.
function S_StartVoice(origin, name, pitch) {
  const lump = 'DS' + name.toUpperCase();
  if (W_CheckNumForName(lump) < 0) return null;
  const listener = players[0] && players[0].mo;
  let vol = 1, sep = 0, dist = 0;
  if (origin && listener && origin !== listener) {
    const p = S_AdjustSoundParams(listener, origin);
    if (!p) return null;
    vol = p.vol; sep = p.sep; dist = p.dist;
  }
  // una sola boca: la frase nueva calla la anterior del mismo soldado
  for (const ch of channels) {
    if (ch.voice && ch.origin === origin && I_SoundIsPlaying(ch.handle)) { I_StopSound(ch.handle); ch.handle = null; }
  }
  const slot = S_GetChannel(S_VOICE_PRIORITY);
  if (!slot) return null;
  slot.handle = I_StartSound(lump, vol, sep, pitch || 1, S_VoiceCutoff(dist));
  if (!slot.handle) return null;
  slot.origin = origin && origin !== listener ? origin : null;
  slot.name = name;
  slot.start = gametic;
  slot.voice = true;
  return slot;
}

function S_VoicesPlaying() {
  let n = 0;
  for (const ch of channels) if (ch.voice && I_SoundIsPlaying(ch.handle)) n++;
  return n;
}

function S_StopVoices() {
  for (const ch of channels) {
    if (!ch.voice) continue;
    if (ch.handle) I_StopSound(ch.handle);
    ch.handle = null;
    ch.origin = null;
    ch.voice = false;
  }
}

function S_StopSound(origin) {
  for (const ch of channels) {
    if (ch.origin === origin && ch.handle) {
      I_StopSound(ch.handle);
      ch.handle = null;
      ch.origin = null;
      ch.voice = false;
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
    I_UpdateSoundParams(ch.handle, p.vol, p.sep, ch.voice ? S_VoiceCutoff(p.dist) : 0);
  }
}

function S_StopAllSounds() {
  for (const ch of channels) {
    if (ch.handle) I_StopSound(ch.handle);
    ch.handle = null;
    ch.origin = null;
    ch.voice = false;
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
