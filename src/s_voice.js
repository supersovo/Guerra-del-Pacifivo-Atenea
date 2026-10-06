// =============================================================================
// s_voice.js — Gritos de los soldados (extensión de Atenea)
// -----------------------------------------------------------------------------
// Cuándo y qué grita cada soldado al morir, al ser herido y al entrar en
// combate. La frase la grita él mismo: es un sonido del juego (lumps DSV*,
// sintetizados en content/voices.js con el acento de su país) que sale de su
// posición, con volumen y estéreo según dónde esté y un paso bajo que apaga
// los agudos a lo lejos. Cada soldado tiene su garganta: una de las voces
// sintetizadas y un tono propio, siempre los mismos.
//
// Cuando grita una frase, esa frase reemplaza al grito genérico (DS*); si no,
// suena el grito de siempre. Para no hacer una algarabía: pausas mínimas por
// tipo, pocas frases a la vez y solo soldados cercanos. Un subtítulo breve
// muestra lo que se grita.
// =============================================================================
'use strict';

// Alcance, pausa mínima entre frases del mismo tipo (ms) y probabilidad.
// Quien cae por el fuego del jugador grita siempre (hasta 1,6 veces más lejos).
const VOICE_RULES = {
  death: { range: 1300, gap: 350, chance: 0.85 },
  pain: { range: 900, gap: 1200, chance: 0.4 },
  sight: { range: 1400, gap: 2000, chance: 0.45 }
};
const VOICE_MAXPLAYING = 3;          // frases a la vez
const VOICE_PITCH = [0.96, 1, 1.04]; // tono propio de cada soldado (sobre su voz)

let VOICE_last = { death: -1e9, pain: -1e9, sight: -1e9 };
let VOICE_spoken = 0;                // frases gritadas (para las pruebas)
let VOICE_lastText = null;
let VOICE_lastShout = null;          // { text, acc, kind, voice, pitch, dist }
let VOICE_timers = [];
let VOICE_recent = [];               // últimas frases gritadas

function VOICE_Phrases(mo, kind) {
  const acc = mo.info.voice;
  const base = (VOICE_PHRASES[acc] && VOICE_PHRASES[acc][kind]) || [];
  const unit = VOICE_UNIT[mo.info.name] && VOICE_UNIT[mo.info.name][kind];
  return unit ? (M_Random() & 1 ? unit : base) : base;
}

// La garganta de un soldado: voz sintetizada y tono, fijos según su número de
// serie (más un temblor mínimo en cada grito).
function VOICE_VoiceOf(mo) {
  const h = Math.imul(mo.serial | 0, 2654435761) >>> 0;
  return { voice: h % VX_NVOICES, pitch: VOICE_PITCH[(h >>> 8) % VOICE_PITCH.length] * (1 + (M_Random() - 128) / 128 * 0.015) };
}

// Suceso de voz de un soldado: 'death', 'pain' o 'sight'. Devuelve true si
// gritó una frase (quien llama omite entonces el grito genérico).
function VOICE_Event(mo, kind) {
  if (!mo || !mo.info || !mo.info.voice || mo.player) return false;
  if (!defaults.voices && !defaults.voiceSubtitles) return false;
  const rule = VOICE_RULES[kind];
  const pl = players[0] && players[0].mo;
  if (!rule || !pl || gamestate !== GS_LEVEL) return false;
  const byPlayer = kind === 'death' && mo.killer && mo.killer.player;
  const range = byPlayer ? rule.range * 1.6 : rule.range;
  const dist = P_AproxDistance(mo.x - pl.x, mo.y - pl.y);
  if (dist > range) return false;
  const now = performance.now();
  if (now - VOICE_last[kind] < (byPlayer ? 250 : rule.gap)) return false;
  // pocas frases a la vez: solo una muerte cercana o del jugador se abre paso
  if (S_VoicesPlaying() >= VOICE_MAXPLAYING && !(kind === 'death' && (byPlayer || dist < 500))) return false;
  if (!byPlayer && M_Random() / 256 >= rule.chance) return false;   // azar de interfaz: no altera la simulación
  const list = VOICE_Phrases(mo, kind);
  if (!list.length) return false;
  // sin repetir las últimas frases oídas (si la lista da para elegir)
  let text = list[M_Random() % list.length];
  for (let k = 0; k < 4 && list.length > 2 && VOICE_recent.indexOf(text) >= 0; k++) text = list[M_Random() % list.length];
  VOICE_recent.push(text);
  if (VOICE_recent.length > 4) VOICE_recent.shift();
  VOICE_last[kind] = now;
  VOICE_lastText = text;
  const near = clamp(1 - dist / range, 0, 1);
  if (defaults.voiceSubtitles) HU_VoiceSubtitle(text, mo.info.voice, near);
  if (!defaults.voices) return false;
  const id = VX_Find(mo.info.voice, kind, text);
  if (id < 0) return false;
  const v = VOICE_VoiceOf(mo);
  if (!S_StartVoice(mo, VX_SoundName(id, v.voice), v.pitch)) return false;
  VOICE_spoken++;
  VOICE_lastShout = { text: text, acc: mo.info.voice, kind: kind, voice: v.voice, pitch: v.pitch, dist: dist };
  return true;
}

// Prueba desde el menú: una frase de cada bando, una tras otra y de frente.
// Devuelve las frases (vacío si no hay audio).
function VOICE_Test() {
  VOICE_StopAll();
  S_UnlockAudio();
  if (!I_audioCtx) return [];
  const demo = [['pe', 'death', '¡Asu mare!', 'Peruano'], ['bo', 'death', '¡Chuta, me han dado!', 'Boliviano'],
    ['cl', 'sight', '¡Viva Chile!', 'Chileno']];
  const out = [];
  let at = 0.1;
  demo.forEach(function (d, k) {
    const id = VX_Find(d[0], d[1], d[2]);
    if (id < 0) return;
    const lump = VX_LumpName(id, k % VX_NVOICES);
    const snd = W_CacheLumpName(lump);
    VOICE_timers.push(setTimeout(function () { I_StartSound(lump, 1, 0, 1); }, at * 1000));
    at += snd.pcm16.length / snd.rate + 0.3;
    out.push(d[3] + ': ' + d[2]);
  });
  return out;
}

function VOICE_StopAll() {
  for (const t of VOICE_timers) clearTimeout(t);
  VOICE_timers = [];
  S_StopVoices();
}
