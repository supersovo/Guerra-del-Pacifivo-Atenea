// =============================================================================
// voices.js — Gritos con palabras (lumps DSV*): síntesis de formantes del español
// -----------------------------------------------------------------------------
// Las frases de los soldados no las lee ninguna voz del sistema: las grita el
// propio soldado, con su garganta, como cualquier otro sonido del juego.
//
//  1. Del texto a los fonemas: reglas del español (sílabas, diptongos, acento,
//     b/d/g suaves entre vocales, nasal que se asimila) y rasgos de cada habla:
//     la s final aspirada del chileno ("puchah") y su j palatal ante e/i
//     ("dejen"), la -ado sin d del habla popular costeña ("dao"), y del
//     boliviano andino la rr asibilada, la ll lateral, las eses firmes y las
//     vocales átonas breves.
//  2. Prosodia del grito: arenga (la sílaba fuerte final se sostiene en alto),
//     herida (subida brusca y caída) o agonía (la última vocal se alarga, el
//     tono cae y la voz se quiebra en estertor y exhalación). En el habla
//     andina el pico de tono llega tarde, sobre el final de la sílaba fuerte.
//  3. Síntesis como la de Klatt (1980): fuente glótica KLGLOTT88 con jitter,
//     shimmer, ronquera y aspiración sincronizada con la glotis; par
//     polo-cero nasal y cinco formantes en cascada; rama paralela de ruido
//     para s, f, ch y las explosiones de p, t, k.
//
// Cada frase existe en tres voces (aguda, media y grave: tono y largo del
// tracto vocal distintos) y cada soldado usa siempre la suya. Los lumps se
// construyen en segundo plano, como los sprites (W_AddLazyLump).
// =============================================================================
'use strict';

// --- Frases --------------------------------------------------------------------------------------------
// Por acento y situación: death (al morir), pain (herido), sight (al avistar
// al enemigo o cargar).
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

// --- 1. Del texto a los fonemas ------------------------------------------------------------------------
// Fonemas: vocales a e i o u (deslizantes j w), oclusivas p t k / b d g y sus
// aproximantes B D G, nasales m n J(ñ) N(velar), laterales l L(ll), vibrantes
// r (simple) rr (múltiple) Z (asibilada), fricativas f s x h(s aspirada)
// C(ç), africada tS (ch) y jj (y consonante).
const VX_TILDE = { 'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u' };
const VX_CLITICS = new Set(['a', 'al', 'la', 'el', 'los', 'las', 'lo', 'le', 'me', 'te', 'se', 'mi', 'tu', 'su',
  'de', 'del', 'en', 'y', 'por', 'con', 'que', 'un', 'sin', 'ha', 'han', 'he']);

function vx_isVowelChar(c) { return !!c && 'aeiouáéíóúü'.indexOf(c) >= 0; }

// Letras de una palabra → segmentos { p, v (vocal), acc (tilde) }.
function vx_letters(w) {
  const out = [];
  const front = function (c) { return !!c && 'eiéí'.indexOf(c) >= 0; };
  for (let i = 0; i < w.length; i++) {
    const c = w[i], n = w[i + 1] || '', n2 = w[i + 2] || '';
    const prev = out.length ? out[out.length - 1].p : null;
    switch (c) {
      case 'a': case 'e': case 'i': case 'o': case 'u': out.push({ p: c, v: true }); break;
      case 'á': case 'é': case 'í': case 'ó': case 'ú': out.push({ p: VX_TILDE[c], v: true, acc: true }); break;
      case 'ü': out.push({ p: 'u', v: true }); break;
      case 'c':
        if (n === 'h') { out.push({ p: 'tS' }); i++; } else out.push({ p: front(n) ? 's' : 'k' });
        break;
      case 'q': out.push({ p: 'k' }); if (n === 'u' && front(n2)) i++; break;
      case 'g':
        if (front(n)) out.push({ p: 'x' });
        else { out.push({ p: 'g' }); if (n === 'u' && front(n2)) i++; }
        break;
      case 'j': out.push({ p: 'x' }); break;
      case 'h': break;
      case 'l': if (n === 'l') { out.push({ p: 'LL' }); i++; } else out.push({ p: 'l' }); break;
      case 'r':
        if (n === 'r') { out.push({ p: 'rr' }); i++; }
        else out.push({ p: i === 0 || prev === 'n' || prev === 'l' || prev === 's' ? 'rr' : 'r' });
        break;
      case 'ñ': out.push({ p: 'J' }); break;
      case 'v': case 'b': out.push({ p: 'b' }); break;
      case 'y':
        if (w === 'y') out.push({ p: 'i', v: true });
        else if (vx_isVowelChar(n)) out.push({ p: 'jj' });
        else out.push({ p: 'i', v: true });
        break;
      case 'z': out.push({ p: 's' }); break;
      case 'x': out.push({ p: 'k' }, { p: 's' }); break;
      default: out.push({ p: c });
    }
  }
  return out;
}

// Ataques silábicos posibles de dos consonantes (pr, bl, tr, gr...).
function vx_onsetPair(a, b) {
  return 'pbfkgtd'.indexOf(a.p) >= 0 && (b.p === 'r' || b.p === 'l') && !(a.p === 'd' && b.p === 'l');
}

// Segmentos → sílabas { segs, stress }. i/u átonas junto a otra vocal se
// vuelven deslizantes (diptongo); dos vocales fuertes o una débil con tilde
// van en hiato.
function vx_syllables(word, segs) {
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    if (!s.v || s.acc || (s.p !== 'i' && s.p !== 'u')) continue;
    const prev = segs[i - 1], next = segs[i + 1];
    if ((next && next.v && next.p !== s.p) || (prev && prev.v && !prev.glide && prev.p !== s.p)) {
      s.glide = true;
      s.p = s.p === 'i' ? 'j' : 'w';
    }
  }
  const nuc = [];
  for (let i = 0; i < segs.length; i++) if (segs[i].v && !segs[i].glide) nuc.push(i);
  if (!nuc.length) return [{ segs: segs, stress: false }];
  const syl = nuc.map(function () { return { segs: [], stress: false }; });
  for (let i = 0; i <= nuc[0]; i++) syl[0].segs.push(segs[i]);
  for (let k = 0; k < nuc.length; k++) {
    const a = nuc[k] + 1, b = k + 1 < nuc.length ? nuc[k + 1] : segs.length;
    const run = segs.slice(a, b);
    if (k + 1 >= nuc.length) { for (const s of run) syl[k].segs.push(s); break; }
    let lo = 0, hi = run.length;
    while (lo < hi && run[lo].glide) lo++;                 // diptongo decreciente: coda
    while (hi > lo && run[hi - 1].glide) hi--;             // diptongo creciente: ataque
    const cons = hi - lo;
    let split;                                             // índice en run donde empieza el ataque
    if (cons <= 1) split = lo;
    else if (cons === 2) split = vx_onsetPair(run[lo], run[lo + 1]) ? lo : lo + 1;
    else split = vx_onsetPair(run[hi - 2], run[hi - 1]) ? hi - 2 : hi - 1;
    for (let i = 0; i < split; i++) syl[k].segs.push(run[i]);
    for (let i = split; i < run.length; i++) syl[k + 1].segs.push(run[i]);
    syl[k + 1].segs.push(segs[nuc[k + 1]]);
  }
  // acento: la tilde manda; si no, llana si termina en vocal, n o s; aguda si no
  let st = syl.findIndex(function (s) { return s.segs.some(function (x) { return x.acc; }); });
  if (st < 0) {
    if (syl.length === 1) st = VX_CLITICS.has(word) ? -1 : 0;
    else st = 'aeiouns'.indexOf(word[word.length - 1]) >= 0 ? syl.length - 2 : syl.length - 1;
  }
  if (st >= 0) syl[st].stress = true;
  return syl;
}

// Alófonos y rasgos de cada habla, sobre la secuencia de un grupo fónico.
function vx_allophones(ph, acc) {
  const isNasal = function (s) { return s && (s.p === 'm' || s.p === 'n' || s.p === 'J' || s.p === 'N'); };
  const isVowel = function (s) { return s && s.v; };
  // nasal que toma el punto de la consonante siguiente
  for (let i = 0; i < ph.length - 1; i++) {
    if (ph[i].p !== 'n') continue;
    const q = ph[i + 1].p;
    if (q === 'p' || q === 'b' || q === 'm' || q === 'f') ph[i].p = 'm';
    else if (q === 'k' || q === 'g' || q === 'x') ph[i].p = 'N';
  }
  for (let i = 0; i < ph.length; i++) {
    const s = ph[i], prev = ph[i - 1], next = ph[i + 1];
    switch (s.p) {
      case 'b': case 'd': case 'g':
        // oclusivas tras pausa o nasal (y la d tras l); aproximantes en lo demás
        if (prev && !isNasal(prev) && !(s.p === 'd' && prev.p === 'l')) s.p = s.p.toUpperCase();
        break;
      case 'LL': s.p = acc === 'bo' ? 'L' : 'jj'; break;
      case 's':
        if (s.coda) {
          if (acc === 'cl') { s.p = 'h'; s.weak = !next; }
          else if (acc === 'pe' && next && !isVowel(next)) s.p = 'h';
        }
        break;
      case 'x':
        if (acc === 'cl' && next && (next.p === 'e' || next.p === 'i' || next.p === 'j')) s.p = 'C';
        break;
      case 'rr':
        if (acc === 'bo') s.p = 'Z';
        break;
      case 'r':
        if (acc === 'bo' && s.coda) s.p = 'Z';
        break;
    }
  }
  // -ado(s) y -d final: la d se pierde en el habla costeña; el andino la conserva
  if (acc !== 'bo') {
    for (let i = ph.length - 1; i >= 0; i--) {
      const s = ph[i];
      if (s.p !== 'D') continue;
      const w = s.word;
      const after = ph.slice(i + 1).filter(function (x) { return x.word === w; });
      const lastInWord = !after.length;
      const ado = ph[i - 1] && ph[i - 1].p === 'a' && after.length && after[0].p === 'o' &&
        after.every(function (x, j) { return j === 0 || x.p === 's' || x.p === 'h'; });
      if (lastInWord || ado) ph.splice(i, 1);
    }
  }
}

// Frase → grupos fónicos (separados por comas) de fonemas con su sílaba.
function vx_parse(text, acc) {
  const clean = String(text).toLowerCase().replace(/[¡!¿?.;:"]/g, '');
  const groups = [];
  let sylId = 0;
  for (const g of clean.split(',')) {
    const words = g.trim().split(/\s+/).filter(Boolean);
    if (!words.length) continue;
    const ph = [];
    words.forEach(function (w, wi) {
      for (const s of vx_syllables(w, vx_letters(w))) {
        let seen = false;
        for (const seg of s.segs) {
          const nuc = !!seg.v && !seg.glide;
          ph.push({ p: seg.p, v: !!seg.v, glide: !!seg.glide, nuc: nuc, coda: seen && !nuc, stress: s.stress, syl: sylId, word: wi });
          if (nuc) seen = true;
        }
        sylId++;
      }
    });
    vx_allophones(ph, acc);
    let nucSyl = -1;
    for (const s of ph) if (s.stress && s.nuc) nucSyl = s.syl;
    if (nucSyl < 0) nucSyl = ph[ph.length - 1].syl;
    groups.push({ ph: ph, nucSyl: nucSyl });
  }
  return groups;
}

// --- 2. Prosodia y blancos acústicos -------------------------------------------------------------------
// Vocales del español (voz masculina): F1..F5 y anchos de banda (Hz).
const VX_VOW = {
  a: { F: [730, 1300, 2500, 3500, 4250], B: [90, 100, 140, 230, 300] },
  e: { F: [470, 1880, 2550, 3500, 4250], B: [70, 100, 150, 230, 300] },
  i: { F: [300, 2280, 3000, 3650, 4300], B: [60, 110, 170, 240, 300] },
  o: { F: [500, 950, 2450, 3450, 4250], B: [80, 90, 150, 230, 300] },
  u: { F: [340, 780, 2350, 3400, 4250], B: [70, 90, 150, 230, 300] },
  j: { F: [290, 2250, 3000, 3650, 4300], B: [60, 120, 180, 240, 300] },
  w: { F: [320, 720, 2300, 3400, 4250], B: [70, 100, 160, 230, 300] }
};
// Consonantes: modo (S oclusiva sorda, B sonora, A aproximante, N nasal,
// L lateral, T vibrante simple, R múltiple, Z asibilada, F fricativa con
// ruido propio, X velar (ruido por la cascada), H aspirada, C africada,
// J palatal sonora) y punto de articulación. fric: picos del ruido
// [frecuencia, ancho, ganancia]; af: intensidad del ruido.
const VX_CONS = {
  p: { m: 'S', pl: 'lab', burst: [[1100, 1800, 1], [2800, 2600, 0.35]], ba: 0.3 },
  t: { m: 'S', pl: 'den', burst: [[4300, 2000, 1], [3000, 1300, 0.45]], ba: 0.55 },
  k: { m: 'S', pl: 'vel', ba: 0.5 },
  b: { m: 'B', pl: 'lab', burst: [[1100, 1800, 1], [2800, 2600, 0.3]], ba: 0.12 },
  d: { m: 'B', pl: 'den', burst: [[4000, 2000, 1], [3000, 1300, 0.4]], ba: 0.2 },
  g: { m: 'B', pl: 'vel', ba: 0.18 },
  B: { m: 'A', pl: 'lab' }, D: { m: 'A', pl: 'den' }, G: { m: 'A', pl: 'vel' },
  m: { m: 'N', pl: 'lab' }, n: { m: 'N', pl: 'den' }, J: { m: 'N', pl: 'pal' }, N: { m: 'N', pl: 'vel' },
  l: { m: 'L', pl: 'den' }, L: { m: 'L', pl: 'pal' },
  r: { m: 'T', pl: 'den' }, rr: { m: 'R', pl: 'den' },
  Z: { m: 'Z', pl: 'den', fric: [[3900, 1500, 1], [5400, 2000, 0.55]], af: 0.3 },
  f: { m: 'F', pl: 'lab', fric: [[2400, 3500, 0.6], [6500, 4000, 1]], af: 0.16 },
  s: { m: 'F', pl: 'den', fric: [[5800, 2000, 1], [7600, 2200, 0.45]], af: 0.46 },
  C: { m: 'F', pl: 'pal', fric: [[3400, 1000, 1], [4700, 1600, 0.5]], af: 0.32 },
  x: { m: 'X', pl: 'vel' },
  h: { m: 'H' },
  tS: { m: 'C', pl: 'pal', fric: [[3100, 1100, 1], [4500, 1800, 0.55]], af: 0.7 },
  jj: { m: 'J', pl: 'pal', fric: [[3200, 1600, 1], [4600, 2000, 0.4]] }
};

// Habla de cada bando: velocidad y tono; el andino alinea tarde el pico.
const VX_ACCENT = {
  pe: { rate: 1.0, f0: 1.0, late: false },
  bo: { rate: 0.88, f0: 1.03, late: true },
  cl: { rate: 1.12, f0: 1.0, late: false }
};
// Tres gargantas: tono base (Hz) y escala de formantes (tracto más corto o largo).
const VX_VOICES = [
  { f0: 132, vt: 1.05, rate: 1.04, rough: 0, breath: 0 },
  { f0: 114, vt: 1.0, rate: 1.0, rough: 0.04, breath: 0.01 },
  { f0: 100, vt: 0.95, rate: 0.96, rough: 0.08, breath: 0.02 }
];
const VX_NVOICES = VX_VOICES.length;
// Compensación de nivel: con el tono alto del grito, i y u (F1 bajo, entre
// armónicos) quedarían 10 dB por debajo de la a; en el habla real son 4 o 5 dB.
const VX_VGAIN = { a: 1, e: 1.05, o: 1.05, i: 2.4, u: 2.0, j: 2.0, w: 1.8 };
// Modos del grito. mult: tono sobre el habla; oq: apertura glótica (menor =
// voz más apretada y brillante); tilt: caída de agudos; asp: soplo; rough:
// ronquera; nuc/post: alargamiento de la sílaba fuerte final y de las
// siguientes; fry: fracción final en estertor; exhale: exhalación final (s).
const VX_STYLE = {
  sight: { mult: 2.15, oq: 0.4, tilt: 0.06, asp: 0.03, jit: 0.01, shim: 0.06, rough: 0.05, vib: 0.012, vibRate: 5.5,
    drive: 2.0, f1: 1.14, bw: 0.85, rate: 0.95, nuc: 3.0, post: 1.4, pause: 0.1, fry: 0, exhale: 0, end: 0.85 },
  pain: { mult: 2.3, oq: 0.42, tilt: 0.1, asp: 0.07, jit: 0.02, shim: 0.12, rough: 0.22, vib: 0.02, vibRate: 7,
    drive: 2.3, f1: 1.1, bw: 1.0, rate: 1.1, nuc: 2.1, post: 1.2, pause: 0.05, fry: 0.1, exhale: 0, end: 0.6 },
  death: { mult: 2.2, oq: 0.45, tilt: 0.12, asp: 0.11, jit: 0.022, shim: 0.15, rough: 0.28, vib: 0.035, vibRate: 6.5,
    drive: 2.2, f1: 1.08, bw: 1.12, rate: 0.92, nuc: 3.3, post: 1.7, pause: 0.11, fry: 0.25, exhale: 0.16, end: 0.5 },
  hero: { mult: 2.2, oq: 0.42, tilt: 0.08, asp: 0.05, jit: 0.014, shim: 0.09, rough: 0.12, vib: 0.02, vibRate: 6,
    drive: 2.1, f1: 1.12, bw: 0.92, rate: 0.95, nuc: 3.0, post: 1.5, pause: 0.1, fry: 0.12, exhale: 0.1, end: 0.65 }
};

// Vivas y arengas al caer se gritan con el último aliento, no se quejan.
function vx_styleFor(kind, text) {
  if (kind === 'death' && /viva|sigan|por la|por lima|no me dejen/i.test(text)) return VX_STYLE.hero;
  return VX_STYLE[kind] || VX_STYLE.sight;
}

// Formantes de una consonante según su punto y la vocal vecina (ecuaciones
// de locus: el F2 de arranque depende del F2 de la vocal).
function vx_locus(pl, V) {
  const F2 = V[1], F3 = V[2];
  switch (pl) {
    case 'lab': return [250, 0.78 * F2 + 150, 0.9 * F3 - 50, 3400, 4200];
    case 'pal': return [250, 0.3 * F2 + 1600, 2900, 3600, 4300];
    case 'vel': return [250, 0.75 * F2 + 500, F2 > 1500 ? 0.75 * F2 + 900 : 2300, 3400, 4200];
    default: return [250, 0.43 * F2 + 1100, 2650, 3500, 4250];
  }
}

const VX_BCONS = [80, 140, 200, 260, 320];

// Plan: lista de segmentos con duración y blancos acústicos, más las anclas
// de tono y de energía.
function vx_plan(groups, acc, st, voice) {
  const A = VX_ACCENT[acc] || VX_ACCENT.pe;
  const k = 1 / (A.rate * st.rate * voice.rate);
  const segs = [];
  const nucs = [];             // vocales núcleo: { t0, t1, syl, stress, gi, isNuc, post }
  let t = 0;
  const push = function (dur, o) {
    const s = Object.assign({ t0: t, dur: dur, F: null, B: VX_BCONS, AV: 0, AH: 0, AF: 0, AB: 0, fric: null, nasal: false, f0m: 1 }, o);
    segs.push(s);
    t += dur;
    return s;
  };
  const vowelF = function (p, stressed) {
    const v = VX_VOW[p];
    const F = v.F.slice();
    const open = p === 'a' || p === 'e' || p === 'o';
    F[0] *= open ? st.f1 : 1 + (st.f1 - 1) * 0.4;
    if (acc === 'bo' && !stressed && (p === 'a' || p === 'e' || p === 'i' || p === 'o' || p === 'u')) {
      F[0] += (500 - F[0]) * 0.12; F[1] += (1500 - F[1]) * 0.12;      // átona andina: centralizada
    }
    for (let i = 0; i < 5; i++) F[i] *= voice.vt;
    return F;
  };
  const vowelB = function (p) { return VX_VOW[p].B.map(function (b) { return b * st.bw; }); };
  groups.forEach(function (g, gi) {
    const ph = g.ph, finalGroup = gi === groups.length - 1;
    const neighborV = function (i) {
      for (let j = i + 1; j < ph.length; j++) if (ph[j].v) return VX_VOW[ph[j].p].F;
      for (let j = i - 1; j >= 0; j--) if (ph[j].v) return VX_VOW[ph[j].p].F;
      return VX_VOW.a.F;
    };
    let prevVoiceless = false;
    for (let i = 0; i < ph.length; i++) {
      const s = ph[i], first = segs.length === 0 || (i === 0);
      if (s.v) {
        const isNuc = s.nuc && s.syl === g.nucSyl;
        const post = s.syl > g.nucSyl;
        let d = s.glide ? 0.045 : s.stress ? 0.105 : 0.072;
        if (s.glide && i === ph.length - 1) d *= 1.5;
        if (s.nuc) {
          if (isNuc) d *= finalGroup ? st.nuc : Math.max(1.3, st.nuc * 0.55);
          else if (post) d *= finalGroup ? st.post : 1.2;
          if (acc === 'bo' && !s.stress) d *= 0.78;
        }
        d *= k;
        const F = vowelF(s.p, s.stress);
        const AV = (s.glide ? 0.9 : s.stress ? 1 : post && finalGroup ? 0.8 : 0.86) * VX_VGAIN[s.p];
        const t0 = t;
        if (prevVoiceless && d > 0.04) {
          push(0.025, { F: F, B: vowelB(s.p), AV: AV, AH: st.asp * AV, f0m: 1.05 });
          push(d - 0.025, { F: F, B: vowelB(s.p), AV: AV, AH: st.asp * AV });
        } else push(d, { F: F, B: vowelB(s.p), AV: AV, AH: st.asp * AV });
        if (s.nuc) nucs.push({ t0: t0, t1: t, syl: s.syl, stress: s.stress, gi: gi, isNuc: isNuc, post: post, finalGroup: finalGroup });
        prevVoiceless = false;
        continue;
      }
      const c = VX_CONS[s.p];
      if (!c) continue;
      const V = neighborV(i);
      const L = vx_locus(c.pl, V).map(function (f) { return f * voice.vt; });
      switch (c.m) {
        case 'S': {      // oclusiva sorda: cierre, explosión, breve aspiración (el español no aspira)
          push((first ? 0.028 : 0.055) * k, { F: L });
          const burst = c.burst || [[L[1] * 1.05, 600, 1], [L[2], 800, 0.5]];
          push(0.007, { F: L, AB: c.ba, fric: burst });
          push(0.012, { F: L, AH: 0.5 });
          prevVoiceless = true;
          break;
        }
        case 'B': {      // oclusiva sonora (tras pausa o nasal): barra de sonoridad y explosión suave
          push(0.042 * k, { F: [190, L[1], L[2], L[3], L[4]], B: [70, 400, 500, 500, 500], AV: 0.16, f0m: 0.96 });
          const burst = c.burst || [[L[1] * 1.05, 700, 1], [L[2], 900, 0.4]];
          push(0.006, { F: L, AV: 0.3, AB: c.ba, fric: burst });
          prevVoiceless = false;
          break;
        }
        case 'A':        // aproximante: b, d, g suaves entre vocales
          push(0.045 * k, { F: [310, L[1], L[2], L[3], L[4]], B: [110, 170, 230, 280, 320], AV: 0.9,
            AF: s.p === 'D' ? 0.03 : 0, fric: s.p === 'D' ? [[4500, 3000, 1], [6500, 3000, 0.5]] : null, f0m: 0.97 });
          prevVoiceless = false;
          break;
        case 'N':        // nasal: murmullo grave, formantes amortiguados, cero nasal
          push((s.coda ? 0.05 : 0.06) * k, { F: [260, L[1], Math.max(2300, L[2] - 150), L[3], L[4]], B: [80, 260, 360, 320, 360],
            AV: 1.7, nasal: true });
          prevVoiceless = false;
          break;
        case 'L':
          push((s.p === 'L' ? 0.06 : 0.055) * k, { F: s.p === 'L' ? [290, 2150 * voice.vt, 2900 * voice.vt, L[3], L[4]] : [360, 0.3 * V[1] * voice.vt + 1230, 2750 * voice.vt, L[3], L[4]],
            B: [80, 160, 240, 290, 340], AV: s.p === 'L' ? 1.4 : 0.9 });
          prevVoiceless = false;
          break;
        case 'T':        // vibrante simple: un toque breve de la lengua
          push(0.024 * k, { F: [380, L[1], 2350 * voice.vt, L[3], L[4]], B: [150, 180, 240, 280, 320], AV: 0.3 });
          prevVoiceless = false;
          break;
        case 'R': {      // vibrante múltiple: tres toques
          const F = [420, L[1] * 0.95, 2400 * voice.vt, L[3], L[4]];
          for (let n = 0; n < 3; n++) {
            push(0.012 * k, { F: F, B: [150, 180, 240, 280, 320], AV: 0.25 });
            push(0.014 * k, { F: F, B: [110, 150, 220, 280, 320], AV: 0.9 });
          }
          prevVoiceless = false;
          break;
        }
        case 'Z':        // rr asibilada andina: sonora y con silbido
          push(0.09 * k, { F: [330, L[1], 2500 * voice.vt, L[3], L[4]], B: [110, 170, 230, 280, 320], AV: 0.5, AF: c.af, fric: c.fric, f0m: 0.96 });
          prevVoiceless = false;
          break;
        case 'F': {      // fricativa sorda con ruido propio (s, f, ç)
          let d = (s.coda ? 0.072 : 0.085) * k;
          let af = c.af;
          if (s.p === 's' && acc === 'bo') { d *= 1.25; af *= 1.15; }       // eses andinas firmes
          push(d, { F: L, AF: af, fric: c.fric });
          prevVoiceless = true;
          break;
        }
        case 'X': {      // j velar: el ruido sale por la cascada con los formantes de la constricción
          const d = (acc === 'bo' ? 0.1 : 0.085) * k;
          push(d, { F: [420, L[1], L[2], L[3], L[4]], B: [160, 130, 170, 240, 300], AH: acc === 'bo' ? 3.2 : 2.6 });
          prevVoiceless = true;
          break;
        }
        case 'H': {      // s aspirada: soplo con el color de la vocal anterior
          let F = VX_VOW.a.F;
          for (let j = i - 1; j >= 0; j--) if (ph[j].v) { F = vowelF(ph[j].p, ph[j].stress); break; }
          push((s.weak ? 0.04 : 0.055) * k, { F: [F[0] * 0.85, F[1], F[2], F[3], F[4]], B: [120, 130, 180, 240, 300], AH: s.weak ? 0.6 : 1.0 });
          prevVoiceless = true;
          break;
        }
        case 'C':        // ch: cierre y fricción que decae
          push((first ? 0.025 : 0.042) * k, { F: L });
          push(0.014, { F: L, AF: c.af * 1.15, fric: c.fric });
          push(0.05 * k, { F: L, AF: c.af * 0.75, fric: c.fric });
          prevVoiceless = true;
          break;
        case 'J':        // y / ll consonante: palatal sonora con algo de roce
          push(0.058 * k, { F: [270, 2250 * voice.vt, 2950 * voice.vt, L[3], L[4]], B: [70, 140, 200, 260, 320], AV: 1.2,
            AF: acc === 'cl' ? 0.1 : 0.06, fric: c.fric, f0m: 0.97 });
          prevVoiceless = false;
          break;
      }
    }
    if (!finalGroup) push(st.pause / (A.rate * voice.rate), { F: VX_VOW.a.F, AH: 0.06 });
  });
  const tVoicedEnd = t;
  if (st.exhale) push(st.exhale, { F: [520, 1450, 2500, 3500, 4200], B: [220, 260, 320, 360, 400], AH: 0.5 });
  return { segs: segs, nucs: nucs, T: t, tVoicedEnd: tVoicedEnd, accent: A };
}

// Anclas de tono (Hz) y de energía (0..1) del grito.
function vx_contours(plan, st, voice) {
  const A = plan.accent;
  const P = voice.f0 * A.f0 * st.mult;
  const f0 = [[0, 0.84 * P]], en = [[0, 0.95]];
  const finalNuc = plan.nucs.filter(function (n) { return n.isNuc && n.finalGroup; })[0];
  for (const n of plan.nucs) {
    const d = n.t1 - n.t0;
    if (n.isNuc && n.finalGroup) {
      const peak = A.late ? 0.55 : 0.35;
      if (st === VX_STYLE.sight) {
        f0.push([n.t0, 1.0 * P], [n.t0 + peak * d, 1.1 * P], [n.t0 + 0.78 * d, 1.07 * P], [n.t1, (n.post ? 0.95 : 0.84) * P]);
      } else if (st === VX_STYLE.pain) {
        f0.push([n.t0, 1.05 * P], [n.t0 + peak * 0.85 * d, 1.2 * P], [n.t1, 0.74 * P]);
      } else if (st === VX_STYLE.death) {
        f0.push([n.t0, 1.0 * P], [n.t0 + peak * 0.85 * d, 1.13 * P], [n.t0 + 0.7 * d, 0.8 * P], [n.t1, 0.6 * P]);
      } else {
        f0.push([n.t0, 1.0 * P], [n.t0 + (peak + 0.05) * d, 1.12 * P], [n.t0 + 0.8 * d, 1.0 * P], [n.t1, 0.76 * P]);
      }
      en.push([n.t0, 1], [n.t0 + 0.5 * d, 1]);
    } else if (n.isNuc) {
      // núcleo de un grupo no final: queda en alto (continuación)
      f0.push([n.t0, 1.0 * P], [n.t0 + 0.4 * d, 1.08 * P], [n.t1, 1.04 * P]);
      en.push([n.t0, 1]);
    } else if (n.finalGroup && finalNuc && n.t0 > finalNuc.t0) {
      const fall = st === VX_STYLE.sight ? 0.78 : st === VX_STYLE.pain ? 0.64 : st === VX_STYLE.death ? 0.46 : 0.6;
      f0.push([(n.t0 + n.t1) / 2, fall * P]);
    } else if (n.stress) {
      f0.push([A.late ? n.t0 + 0.85 * d : (n.t0 + n.t1) / 2, 1.0 * P]);
    } else {
      f0.push([(n.t0 + n.t1) / 2, 0.9 * P]);
    }
  }
  const last = f0[f0.length - 1][1];
  f0.push([plan.T, last * 0.9]);
  en.push([plan.tVoicedEnd, st.end], [plan.T, st.end * 0.8]);
  f0.sort(function (a, b) { return a[0] - b[0]; });
  en.sort(function (a, b) { return a[0] - b[0]; });
  return { f0: f0, en: en };
}

// --- 3. Pistas de parámetros y síntesis ----------------------------------------------------------------
const VX_CR = 32;                          // muestras por cuadro de control (1,45 ms)

function vx_smooth(a, tau) {
  const k = Math.exp(-(VX_CR / SND_RATE) / tau);
  let y = a[0];
  for (let i = 0; i < a.length; i++) { y = a[i] + (y - a[i]) * k; a[i] = y; }
  y = a[a.length - 1];
  for (let i = a.length - 1; i >= 0; i--) { y = a[i] + (y - a[i]) * k; a[i] = y; }
}

function vx_interp(pts, t, log) {
  if (t <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (t <= pts[i][0]) {
      const a = pts[i - 1], b = pts[i];
      const u = (t - a[0]) / Math.max(1e-6, b[0] - a[0]);
      return log ? a[1] * Math.pow(b[1] / a[1], u) : a[1] + (b[1] - a[1]) * u;
    }
  }
  return pts[pts.length - 1][1];
}

function vx_tracks(plan, cont) {
  const nF = Math.ceil((plan.T + 0.06) * SND_RATE / VX_CR) + 1;
  const mk = function () { return new Float32Array(nF); };
  const tr = { n: nF, F: [mk(), mk(), mk(), mk(), mk()], B: [mk(), mk(), mk(), mk(), mk()],
    AV: mk(), AH: mk(), AF: mk(), AB: mk(), FF1: mk(), FB1: mk(), FG1: mk(), FF2: mk(), FB2: mk(), FG2: mk(),
    FNZ: mk(), F0: mk(), EN: mk() };
  let f = 0, s = null;
  let fric = [[5000, 2000, 1], [7000, 2000, 0.5]];
  const put = function (i, sg) {
    for (let n = 0; n < 5; n++) { tr.F[n][i] = sg.F[n]; tr.B[n][i] = sg.B[n]; }
    tr.AV[i] = sg.AV; tr.AH[i] = sg.AH; tr.AF[i] = sg.AF; tr.AB[i] = sg.AB;
    if (sg.fric) fric = sg.fric;
    tr.FF1[i] = fric[0][0]; tr.FB1[i] = fric[0][1]; tr.FG1[i] = fric[0][2];
    tr.FF2[i] = fric[1][0]; tr.FB2[i] = fric[1][1]; tr.FG2[i] = fric[1][2];
    tr.FNZ[i] = sg.nasal ? 450 : 270;
    tr.F0[i] = sg.f0m;
  };
  // los blancos de las consonantes sin formantes propios toman los del segmento vecino
  for (let i = 0; i < plan.segs.length; i++) {
    if (!plan.segs[i].F) plan.segs[i].F = (plan.segs[i + 1] && plan.segs[i + 1].F) || (plan.segs[i - 1] && plan.segs[i - 1].F) || VX_VOW.a.F;
  }
  for (s of plan.segs) {
    const f1 = Math.min(nF, Math.round((s.t0 + s.dur) * SND_RATE / VX_CR));
    for (; f < f1; f++) put(f, s);
  }
  const lastSeg = plan.segs[plan.segs.length - 1];
  for (; f < nF; f++) { put(f, lastSeg); tr.AV[f] = 0; tr.AH[f] = 0; tr.AF[f] = 0; tr.AB[f] = 0; }
  for (let n = 0; n < 5; n++) { vx_smooth(tr.F[n], 0.012); vx_smooth(tr.B[n], 0.008); }
  vx_smooth(tr.AV, 0.0035); vx_smooth(tr.AH, 0.003); vx_smooth(tr.AF, 0.006); vx_smooth(tr.AB, 0.001);
  for (const a of [tr.FF1, tr.FB1, tr.FG1, tr.FF2, tr.FB2, tr.FG2]) vx_smooth(a, 0.002);
  vx_smooth(tr.FNZ, 0.012);
  vx_smooth(tr.F0, 0.012);
  // tono y energía por cuadro
  const F0 = tr.F0;
  for (let i = 0; i < nF; i++) {
    const t = i * VX_CR / SND_RATE;
    F0[i] *= vx_interp(cont.f0, t, true);
    tr.EN[i] = vx_interp(cont.en, t, false);
  }
  vx_smooth(F0, 0.02);
  return tr;
}

// Coeficientes de un resonador de Klatt (ganancia 1 en continua).
function vx_reson(F, BW, out, k) {
  const C = -Math.exp(-2 * Math.PI * BW / SND_RATE);
  const B = 2 * Math.exp(-Math.PI * BW / SND_RATE) * Math.cos(2 * Math.PI * Math.min(F, SND_RATE * 0.45) / SND_RATE);
  out[k * 3] = 1 - B - C; out[k * 3 + 1] = B; out[k * 3 + 2] = C;
}

// Coeficientes de un pasabanda RBJ (pico de 0 dB) en q[o..o+4].
function vx_bp(F, BW, q, o) {
  const f = Math.min(F, SND_RATE * 0.46);
  const w0 = 2 * Math.PI * f / SND_RATE, cs = Math.cos(w0), sn = Math.sin(w0);
  const alpha = sn / (2 * Math.max(0.3, f / Math.max(50, BW)));
  const a0 = 1 + alpha;
  q[o] = alpha / a0; q[o + 1] = 0; q[o + 2] = -alpha / a0; q[o + 3] = -2 * cs / a0; q[o + 4] = (1 - alpha) / a0;
}

function vx_render(tr, st, voice, seed, tFry) {
  const SR = SND_RATE, N = tr.n * VX_CR;
  const out = new Float32Array(N);
  const PB = Math.PI / SR, TW = 2 * Math.PI / SR, FMAX = SR * 0.45;
  const bq = new Float64Array(10);
  let rs = (seed >>> 0) || 1;                // ruido: xorshift32 en línea
  // estados: polo-cero nasal, cinco formantes, dos pasabanda de fricción
  let np1 = 0, np2 = 0, nzx1 = 0, nzx2 = 0;
  let p0 = 0, q0 = 0, p1 = 0, q1 = 0, p2 = 0, q2 = 0, p3 = 0, q3 = 0, p4 = 0, q4 = 0;
  let b1x1 = 0, b1x2 = 0, b1y1 = 0, b1y2 = 0, b2x1 = 0, b2x2 = 0, b2y1 = 0, b2y2 = 0, wPrev = 0;
  const rough = Math.min(0.6, st.rough + voice.rough), breath = st.asp + voice.breath;
  const tilt = st.tilt, oqv = st.oq;
  let ph = 0, dph = 200 / SR, shim = 1, alt = false, tiltY = 0, oq = oqv, fryAmp = 1;
  const fryStart = tFry > 0 ? Math.round(tFry * SR) : Infinity;
  // polo nasal fijo (270 Hz)
  const ne = Math.exp(-PB * 100), nC = -ne * ne, nB = 2 * ne * Math.cos(TW * 270), nA = 1 - nB - nC;
  // formantes altos fijos (F6..F9): sin ellos la cascada cae a pique sobre 4 kHz
  // y la voz suena apagada (la "corrección de polos altos" de Klatt)
  const hi = [4950, 5900, 6900, 7900].map(function (F, k) {
    const e = Math.exp(-PB * (400 + 100 * k)), C = -e * e, B = 2 * e * Math.cos(TW * Math.min(F * voice.vt, FMAX));
    return [1 - B - C, B, C];
  });
  const h6a = hi[0][0], h6b = hi[0][1], h6c = hi[0][2], h7a = hi[1][0], h7b = hi[1][1], h7c = hi[1][2];
  const h8a = hi[2][0], h8b = hi[2][1], h8c = hi[2][2], h9a = hi[3][0], h9b = hi[3][1], h9c = hi[3][2];
  let p6 = 0, q6 = 0, p7 = 0, q7 = 0, p8 = 0, q8 = 0, p9 = 0, q9 = 0;
  for (let f = 0; f < tr.n; f++) {
    // coeficientes del cuadro: resonadores de Klatt (ganancia 1 en continua)
    let e = Math.exp(-PB * tr.B[0][f]);
    const c0 = -e * e, b0 = 2 * e * Math.cos(TW * Math.min(tr.F[0][f], FMAX)), a0 = 1 - b0 - c0;
    e = Math.exp(-PB * tr.B[1][f]);
    const c1 = -e * e, b1 = 2 * e * Math.cos(TW * Math.min(tr.F[1][f], FMAX)), a1 = 1 - b1 - c1;
    e = Math.exp(-PB * tr.B[2][f]);
    const c2 = -e * e, b2 = 2 * e * Math.cos(TW * Math.min(tr.F[2][f], FMAX)), a2 = 1 - b2 - c2;
    e = Math.exp(-PB * tr.B[3][f]);
    const c3 = -e * e, b3 = 2 * e * Math.cos(TW * Math.min(tr.F[3][f], FMAX)), a3 = 1 - b3 - c3;
    e = Math.exp(-PB * tr.B[4][f]);
    const c4 = -e * e, b4 = 2 * e * Math.cos(TW * Math.min(tr.F[4][f], FMAX)), a4 = 1 - b4 - c4;
    // cero nasal: antirresonador (inverso del resonador)
    e = Math.exp(-PB * 100);
    const zc0 = -e * e, zb0 = 2 * e * Math.cos(TW * tr.FNZ[f]), za0 = 1 - zb0 - zc0;
    const za = 1 / za0, zb = -zb0 / za0, zc = -zc0 / za0;
    const en = tr.EN[f];
    const av = tr.AV[f] * en, ah = tr.AH[f] * (0.4 + 0.6 * en), afr = tr.AF[f] * (0.5 + 0.5 * en), ab = tr.AB[f];
    const nfric = afr + ab * 0.9, doFric = nfric > 1e-4;
    if (doFric) { vx_bp(tr.FF1[f], tr.FB1[f], bq, 0); vx_bp(tr.FF2[f], tr.FB2[f], bq, 5); }
    const g1 = tr.FG1[f] * 0.3, g2 = tr.FG2[f] * 0.3, f0 = tr.F0[f];
    const noiseAmp = (ah + breath * av) * 0.9;
    const base = f * VX_CR;
    for (let n = 0; n < VX_CR; n++) {
      const i = base + n;
      // fuente glótica: un periodo por vez, con jitter, vibrato, ronquera y estertor
      ph += dph;
      if (ph >= 1) {
        ph -= 1;
        alt = !alt;
        rs ^= rs << 13; rs ^= rs >>> 17; rs ^= rs << 5;
        const r1 = (rs | 0) * 4.656612873077393e-10;
        rs ^= rs << 13; rs ^= rs >>> 17; rs ^= rs << 5;
        const r2 = (rs | 0) * 4.656612873077393e-10;
        if (i >= fryStart) {
          dph = (34 + 22 * Math.abs(r1)) / SR;
          shim = 0.55 + 0.45 * Math.abs(r2);
          oq = 0.3; fryAmp = r1 > -0.4 ? 0.8 : 0.25;
        } else {
          const vib = 1 + st.vib * Math.sin(st.vibRate * TW * i);
          let fr = Math.max(40, f0 * vib * (1 + st.jit * r1));
          if (rough > 0) fr /= 1 + rough * 0.12 * (alt ? 1 : -1);
          dph = fr / SR;
          shim = (1 + st.shim * r2) * (rough > 0 && alt ? 1 - rough * 0.4 : 1);
          oq = oqv; fryAmp = 1;
        }
      }
      let src = 0;
      const open = ph < oq;
      if (open) { const y = ph / oq; src = (2 * y - 3 * y * y) * av * shim * fryAmp * 2.2; }
      tiltY += (src - tiltY) * (1 - tilt);
      // soplo: modulado por la apertura glótica cuando hay voz
      rs ^= rs << 13; rs ^= rs >>> 17; rs ^= rs << 5;
      let x = tiltY + (rs | 0) * 4.656612873077393e-10 * noiseAmp * (av > 0.05 && !open ? 0.35 : 1);
      // par polo-cero nasal (se anulan si FNZ = 270)
      const pY = nA * x + nB * np1 + nC * np2;
      np2 = np1; np1 = pY;
      x = za * pY + zb * nzx1 + zc * nzx2;
      nzx2 = nzx1; nzx1 = pY;
      // nueve formantes en cascada
      let y = h9a * x + h9b * p9 + h9c * q9; q9 = p9; p9 = y;
      y = h8a * y + h8b * p8 + h8c * q8; q8 = p8; p8 = y;
      y = h7a * y + h7b * p7 + h7c * q7; q7 = p7; p7 = y;
      y = h6a * y + h6b * p6 + h6c * q6; q6 = p6; p6 = y;
      y = a4 * y + b4 * p4 + c4 * q4; q4 = p4; p4 = y;
      y = a3 * y + b3 * p3 + c3 * q3; q3 = p3; p3 = y;
      y = a2 * y + b2 * p2 + c2 * q2; q2 = p2; p2 = y;
      y = a1 * y + b1 * p1 + c1 * q1; q1 = p1; p1 = y;
      y = a0 * y + b0 * p0 + c0 * q0; q0 = p0; p0 = y;
      let o = y * 0.06;
      // rama paralela: fricción y explosiones
      if (doFric) {
        // ruido con preénfasis: el roce no tiene graves
        rs ^= rs << 13; rs ^= rs >>> 17; rs ^= rs << 5;
        const w = (rs | 0) * 4.656612873077393e-10;
        const nzs = (w - 0.85 * wPrev) * nfric;
        wPrev = w;
        const y1 = bq[0] * nzs + bq[2] * b1x2 - bq[3] * b1y1 - bq[4] * b1y2;
        b1x2 = b1x1; b1x1 = nzs; b1y2 = b1y1; b1y1 = y1;
        const y2 = bq[5] * nzs + bq[7] * b2x2 - bq[8] * b2y1 - bq[9] * b2y2;
        b2x2 = b2x1; b2x1 = nzs; b2y2 = b2y1; b2y1 = y2;
        o += y1 * g1 + y2 * g2;
      }
      out[i] = o;
    }
  }
  return out;
}

// Frase → muestras PCM (22050 Hz). kind: 'death' | 'pain' | 'sight'.
function VX_Synth(text, acc, kind, v, seed) {
  const voice = VX_VOICES[v] || VX_VOICES[1];
  const st = vx_styleFor(kind, text);
  const groups = vx_parse(text, acc);
  const plan = vx_plan(groups, acc, st, voice);
  const cont = vx_contours(plan, st, voice);
  const tr = vx_tracks(plan, cont);
  let tFry = 0;
  if (st.fry > 0) {
    const fin = plan.nucs.filter(function (n) { return n.isNuc && n.finalGroup; })[0];
    const t0 = fin ? fin.t0 : 0;
    tFry = plan.tVoicedEnd - st.fry * (plan.tVoicedEnd - t0);
  }
  const out = vx_render(tr, st, voice, seed || 1, tFry);
  // garganta forzada: saturación suave, sin continua, bordes sin chasquido
  snd_biquad(out, 'hp', 80, 0.7);
  let peak = 1e-9;
  for (let i = 0; i < out.length; i++) peak = Math.max(peak, Math.abs(out[i]));
  const dr = st.drive, nd = Math.tanh(dr);
  for (let i = 0; i < out.length; i++) out[i] = Math.tanh(out[i] / peak * dr) / nd;
  const fi = Math.floor(0.003 * SND_RATE), fo = Math.floor(0.03 * SND_RATE);
  for (let i = 0; i < fi && i < out.length; i++) out[i] *= i / fi;
  for (let i = 0; i < fo && i < out.length; i++) out[out.length - 1 - i] *= i / fo;
  return snd_normalize(out, 0.9);
}

// --- Registro de lumps ---------------------------------------------------------------------------------
// Un lump por frase, situación y voz: DSV + número de frase (3 cifras) + voz.
const VX_TABLE = [];                       // id → { acc, kind, text }
const VX_INDEX = new Map();                // 'acc|kind|texto' → id

function VX_LumpName(id, v) { return 'DSV' + String(id).padStart(3, '0') + v; }
function VX_SoundName(id, v) { return 'v' + String(id).padStart(3, '0') + v; }
function VX_Find(acc, kind, text) {
  const id = VX_INDEX.get(acc + '|' + kind + '|' + text);
  return id === undefined ? -1 : id;
}

function VX_Register(acc, kind, text) {
  if (VX_Find(acc, kind, text) >= 0) return;
  const id = VX_TABLE.length;
  VX_TABLE.push({ acc: acc, kind: kind, text: text });
  VX_INDEX.set(acc + '|' + kind + '|' + text, id);
  for (let v = 0; v < VX_NVOICES; v++) {
    W_AddLazyLump(VX_LumpName(id, v), function () {
      const f = VX_Synth(text, acc, kind, v, 7919 * (id + 1) + 104729 * v);
      const pcm16 = new Int16Array(f.length);       // 16 bits: la mitad de memoria
      for (let i = 0; i < f.length; i++) pcm16[i] = Math.round(f[i] * 32767);
      return { rate: SND_RATE, pcm16: pcm16 };
    }, 'sound');
  }
}

function VX_BuildLumps() {
  for (const acc in VOICE_PHRASES) {
    for (const kind in VOICE_PHRASES[acc]) for (const t of VOICE_PHRASES[acc][kind]) VX_Register(acc, kind, t);
  }
  for (const unit in VOICE_UNIT) {
    const mt = MT[unit];
    const acc = mt !== undefined && mobjinfo[mt].voice;
    if (!acc) continue;
    for (const kind in VOICE_UNIT[unit]) for (const t of VOICE_UNIT[unit][kind]) VX_Register(acc, kind, t);
  }
}
