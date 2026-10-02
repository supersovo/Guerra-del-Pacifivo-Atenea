// =============================================================================
// s_voice.js — Voces de los soldados (extensión de Atenea)
// -----------------------------------------------------------------------------
// Frases que gritan los soldados al morir, al ser heridos y al entrar en
// combate, dichas por la voz sintética del navegador (Web Speech API) con el
// acento de cada bando: peruano (es-PE), boliviano (es-BO) y chileno (es-CL).
// Si el sistema no tiene la voz de ese país se usa la más cercana (español
// latinoamericano, de EE. UU., de México...); Microsoft Edge trae voces
// naturales de los tres países. Se prefieren voces masculinas.
//
// Para no saturar: una frase a la vez (la muerte interrumpe un grito de
// carga), pausas mínimas por tipo, solo soldados cercanos y volumen según la
// distancia. Los gritos sintetizados (DS*) suenan siempre; la frase va encima.
// Un subtítulo breve muestra lo que se grita.
// =============================================================================
'use strict';

// Acentos: idiomas preferidos, de más a menos cercano.
const VOICE_LANGS = {
  pe: ['es-PE', 'es-419', 'es-US', 'es-MX', 'es-CO', 'es-EC', 'es-BO', 'es-VE', 'es-CL', 'es-AR', 'es-ES', 'es'],
  bo: ['es-BO', 'es-PE', 'es-419', 'es-US', 'es-MX', 'es-CO', 'es-EC', 'es-AR', 'es-CL', 'es-ES', 'es'],
  cl: ['es-CL', 'es-AR', 'es-UY', 'es-419', 'es-US', 'es-MX', 'es-PE', 'es-CO', 'es-ES', 'es']
};
const VOICE_ACCENT_NAME = { pe: 'peruano', bo: 'boliviano', cl: 'chileno' };

// Frases por acento y situación: death (al morir), pain (herido), sight (al
// avistar al enemigo o cargar).
const VOICE_PHRASES = {
  pe: {
    death: ['¡Asu mare!', '¡A la chucha!', '¡Chucha!', '¡Ay, mamita!', '¡Me jodieron, carajo!', '¡Viva el Perú!', '¡Chucha madre!',
      '¡Ay, Diosito!', '¡Me muero, compadre!', '¡A la chucha, me dieron!', '¡Pucha, me dieron!', '¡Ay, carajo!', '¡Asu, me dieron!'],
    pain: ['¡Ay!', '¡Chucha!', '¡Me dieron!', '¡Ah, carajo!', '¡Asu mare!'],
    sight: ['¡Ahí vienen los chilenos!', '¡Viva el Perú, carajo!', '¡Fuego, muchachos!', '¡No retrocedan!', '¡A la carga!', '¡Por la patria!']
  },
  bo: {
    death: ['¡Chuta!', '¡Ay, carajo!', '¡Chuta, me han dado!', '¡Ay, mamita!', '¡Viva Bolivia!', '¡Jesús, María y José!',
      '¡Ay, Tata Dios!', '¡Jilata, me han dado!', '¡Puta, che!', '¡Me han jodido, carajo!', '¡Ayayay!', '¡Madre mía!'],
    pain: ['¡Chuta!', '¡Ay!', '¡Ayayay!', '¡Me han dado!'],
    sight: ['¡Viva Bolivia!', '¡Al ataque, carajo!', '¡Jallalla, Bolivia!', '¡Fuego, hermanos!', '¡Por la patria!']
  },
  cl: {
    death: ['¡A la chucha!', '¡Me dieron, compadre!', '¡Viva Chile!', '¡Puchas!', '¡Mamita!', '¡Por la cresta!',
      '¡Chucha, me dieron!', '¡Ay, mi mamita!', '¡No me dejen, compañeros!', '¡Me mataron, mierda!'],
    pain: ['¡Ay!', '¡Puchas!', '¡Chuta!', '¡Me dieron!', '¡A la chucha!'],
    sight: ['¡Viva Chile!', '¡A la carga, muchachos!', '¡Al ataque!', '¡Adelante, compañeros!', '¡Arriba, muchachos!']
  }
};
// Frases propias de algunas tropas (se mezclan con las de su acento).
const VOICE_UNIT = {
  OFICIAL: { sight: ['¡Firmes, muchachos!', '¡Fuego a discreción!', '¡Calen bayoneta!', '¡Nadie retrocede!'],
    death: ['¡Sigan peleando, muchachos!', '¡Viva el Perú!'] },
  BAYONETA: { sight: ['¡A la bayoneta!', '¡Calen bayoneta, carajo!'] },
  COLORADO: { sight: ['¡Adelante, Colorados!', '¡Colorados, a la carga!', '¡Viva Bolivia, carajo!'] },
  RESERVA: { sight: ['¡Por Lima!', '¡Defendamos la ciudad!'], death: ['¡Asu mare, me dieron!', '¡Por Lima!'] },
  HUSAR: { sight: ['¡A la carga!', '¡Sable en mano!'] },
  GRANADERO: { sight: ['¡A la carga, Granaderos!', '¡Sable en mano, muchachos!'] },
  ARTILLERO: { sight: ['¡Fuego la pieza!', '¡Carguen!'] },
  ARTILLERO_CL: { sight: ['¡Fuego!', '¡Carguen la pieza!'] },
  DINAMITERO: { sight: ['¡Ahí va la dinamita!'] }
};

// Alcance, pausa mínima entre frases del mismo tipo (ms) y probabilidad.
// Quien cae por el fuego del jugador grita siempre (hasta 1,6 veces más lejos).
const VOICE_RULES = {
  death: { range: 1200, gap: 800, chance: 0.85 },
  pain: { range: 800, gap: 3000, chance: 0.35 },
  sight: { range: 1300, gap: 4500, chance: 0.4 }
};

// Nombres de voces masculinas conocidas (Edge, Windows, macOS, Android).
const VOICE_MALE = /(alex|marcelo|lorenzo|jorge|juan|diego|carlos|pablo|ra[uú]l|[aá]lvaro|andr[eé]s|gerardo|tom[aá]s|mateo|emilio|federico|gonzalo|jaime|dario|el[ií]as|manuel|antonio|enrique|esteban|nicol[aá]s|rodrigo|sebasti[aá]n|sa[uú]l|teo|valent[ií]n|v[ií]ctor|ernesto|hugo|lucas|luciano|mario|mauricio|ricardo|rafael|roberto|sergio|mat[ií]as|alonso|arnau|male|hombre|masculin)/i;

let VOICE_list = [];                 // voces en español disponibles
let VOICE_pick = { pe: null, bo: null, cl: null };
let VOICE_cur = null;                // { kind, until }
let VOICE_last = { death: -1e9, pain: -1e9, sight: -1e9 };
let VOICE_failed = new Set();        // voces que dieron error (en línea sin conexión...)
let VOICE_spoken = 0;                // frases enviadas (para las pruebas)
let VOICE_lastText = null;

function VOICE_Supported() {
  return typeof window !== 'undefined' && !!window.speechSynthesis && typeof window.SpeechSynthesisUtterance === 'function';
}

function VOICE_Init() {
  if (!VOICE_Supported()) return;
  VOICE_Refresh();
  try { window.speechSynthesis.addEventListener('voiceschanged', VOICE_Refresh); } catch (e) { /* navegador antiguo */ }
}

function VOICE_NormLang(l) { return String(l || '').replace('_', '-').toLowerCase(); }

// Elige para cada acento la mejor voz: idioma más cercano, luego voz masculina.
function VOICE_Refresh() {
  if (!VOICE_Supported()) return;
  let all = [];
  try { all = window.speechSynthesis.getVoices() || []; } catch (e) { all = []; }
  VOICE_list = all.filter(function (v) { return VOICE_NormLang(v.lang).startsWith('es') && !VOICE_failed.has(v.name); });
  for (const acc in VOICE_LANGS) {
    const prefs = VOICE_LANGS[acc].map(VOICE_NormLang);
    let best = null, bestScore = Infinity;
    for (const v of VOICE_list) {
      const lang = VOICE_NormLang(v.lang);
      let tier = prefs.indexOf(lang);
      if (tier < 0) tier = lang.startsWith('es-') ? prefs.length - 1 : prefs.length;
      const male = VOICE_MALE.test(v.name);
      const score = tier + (male ? 0 : 1.5) + (v.localService ? 0 : 0.1);
      if (score < bestScore) { bestScore = score; best = v; }
    }
    VOICE_pick[acc] = best;
  }
}

function VOICE_Describe() {
  const out = {};
  for (const acc in VOICE_pick) out[acc] = VOICE_pick[acc] ? VOICE_pick[acc].name + ' (' + VOICE_pick[acc].lang + ')' : null;
  return out;
}

function VOICE_Phrases(mo, kind) {
  const acc = mo.info.voice;
  const base = (VOICE_PHRASES[acc] && VOICE_PHRASES[acc][kind]) || [];
  const unit = VOICE_UNIT[mo.info.name] && VOICE_UNIT[mo.info.name][kind];
  return unit ? (M_Random() & 1 ? unit : base) : base;
}

// Suceso de voz de un soldado: 'death', 'pain' o 'sight'.
function VOICE_Event(mo, kind) {
  if (!mo || !mo.info || !mo.info.voice || mo.player) return;
  if (!defaults.voices && !defaults.voiceSubtitles) return;
  const rule = VOICE_RULES[kind];
  const pl = players[0] && players[0].mo;
  if (!rule || !pl || gamestate !== GS_LEVEL) return;
  const byPlayer = kind === 'death' && mo.killer && mo.killer.player;
  const range = byPlayer ? rule.range * 1.6 : rule.range;
  const dist = P_AproxDistance(mo.x - pl.x, mo.y - pl.y);
  if (dist > range) return;
  const now = performance.now();
  if (now - VOICE_last[kind] < (byPlayer ? 400 : rule.gap)) return;
  // una frase a la vez: solo la muerte de alguien cercano corta un grito de carga o de dolor
  if (VOICE_cur && now < VOICE_cur.until && !(kind === 'death' && VOICE_cur.kind !== 'death')) return;
  if (!byPlayer && M_Random() / 256 >= rule.chance) return;   // azar de interfaz: no altera la simulación
  const list = VOICE_Phrases(mo, kind);
  if (!list.length) return;
  const text = list[M_Random() % list.length];
  VOICE_last[kind] = now;
  VOICE_lastText = text;
  const near = clamp(1 - dist / range, 0, 1);
  if (defaults.voiceSubtitles) HU_VoiceSubtitle(text, mo.info.voice, near);
  if (defaults.voices) VOICE_Speak(text, mo.info.voice, mo.serial, kind, near);
  else VOICE_cur = { kind: kind, until: now + 1200 };
}

function VOICE_Speak(text, acc, serial, kind, near) {
  if (!VOICE_Supported()) { VOICE_cur = { kind: kind, until: performance.now() + 1200 }; return; }
  const voice = VOICE_pick[acc];
  const synth = window.speechSynthesis;
  try {
    if (synth.speaking || synth.pending) synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (voice) { u.voice = voice; u.lang = voice.lang; } else u.lang = VOICE_LANGS[acc][0];
    // cada soldado con su tono; las voces femeninas, más graves
    const indiv = ((serial * 2654435761) >>> 0) / 4294967296;
    const male = voice ? VOICE_MALE.test(voice.name) : true;
    const strain = kind === 'sight' ? 0.05 : kind === 'pain' ? 0.12 : 0.15;
    u.pitch = clamp((male ? 0.82 : 0.55) + indiv * 0.3 + strain, 0.1, 2);
    u.rate = clamp(1.05 + indiv * 0.2 + (kind === 'sight' ? 0.1 : 0), 0.5, 2);
    u.volume = clamp(Math.pow(near, 1.2) * (defaults.sfxVolume / 15) * 1.1 + 0.08, 0.05, 1);
    VOICE_cur = { kind: kind, until: performance.now() + 2500 };
    u.onend = function () { VOICE_cur = null; };
    u.onerror = function (e) {
      VOICE_cur = null;
      if (voice && e && e.error !== 'interrupted' && e.error !== 'canceled') { VOICE_failed.add(voice.name); VOICE_Refresh(); }
    };
    synth.speak(u);
    VOICE_spoken++;
  } catch (e) {
    VOICE_cur = null;
  }
}

// Prueba desde el menú: una frase de cada acento.
function VOICE_Test() {
  if (!VOICE_Supported()) return false;
  VOICE_Refresh();
  const synth = window.speechSynthesis;
  synth.cancel();
  const demo = [['pe', '¡Asu mare!'], ['bo', '¡Chuta, me han dado!'], ['cl', '¡A la chucha!']];
  for (const d of demo) {
    const u = new SpeechSynthesisUtterance(d[1]);
    const v = VOICE_pick[d[0]];
    if (v) { u.voice = v; u.lang = v.lang; } else u.lang = VOICE_LANGS[d[0]][0];
    u.volume = clamp(defaults.sfxVolume / 15 + 0.1, 0.1, 1);
    u.pitch = v && !VOICE_MALE.test(v.name) ? 0.6 : 0.9;
    synth.speak(u);
  }
  return true;
}

function VOICE_StopAll() {
  VOICE_cur = null;
  if (VOICE_Supported()) { try { window.speechSynthesis.cancel(); } catch (e) { /* nada */ } }
}
