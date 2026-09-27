// =============================================================================
// sounds.js — Efectos de sonido sintetizados (equivalentes a los lumps DS*)
// -----------------------------------------------------------------------------
// Todos los sonidos se generan por síntesis al arrancar: disparos de Comblain,
// Remington y revólver con eco de quebrada, la Gatling, cañonazos Krupp,
// explosiones de dinamita, gritos (síntesis de formantes), caballos, la
// corneta de órdenes, etc. PCM mono de 22050 Hz, como los sonidos de DOOM.
// =============================================================================
'use strict';

const SND_RATE = 22050;

function snd_buf(sec) { return new Float32Array(Math.max(1, Math.floor(sec * SND_RATE))); }

// Generador de ruido determinista.
function snd_rng(seed) {
  let s = seed >>> 0 || 1;
  return function () {
    s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
    return s / 2147483648 - 1;
  };
}

// Filtro biquad (RBJ) aplicado in situ.
function snd_biquad(buf, type, freq, q, gainDb) {
  const w0 = 2 * Math.PI * Math.min(freq, SND_RATE * 0.45) / SND_RATE;
  const cos = Math.cos(w0), sin = Math.sin(w0);
  const alpha = sin / (2 * (q || 0.707));
  let b0, b1, b2, a0, a1, a2;
  switch (type) {
    case 'lp': b0 = (1 - cos) / 2; b1 = 1 - cos; b2 = (1 - cos) / 2; a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha; break;
    case 'hp': b0 = (1 + cos) / 2; b1 = -(1 + cos); b2 = (1 + cos) / 2; a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha; break;
    case 'bp': b0 = alpha; b1 = 0; b2 = -alpha; a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha; break;
    default: return buf;
  }
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < buf.length; i++) {
    const x = buf[i];
    const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    buf[i] = y;
  }
  return buf;
}

// Filtro de frecuencia variable (paso bajo de un polo, barrido).
function snd_lpSweep(buf, f0, f1) {
  let y = 0;
  for (let i = 0; i < buf.length; i++) {
    const t = i / buf.length;
    const f = f0 * Math.pow(f1 / f0, t);
    const a = 1 - Math.exp(-2 * Math.PI * f / SND_RATE);
    y += (buf[i] - y) * a;
    buf[i] = y;
  }
  return buf;
}

function snd_env(buf, attack, decayTau, from, to) {
  const n = buf.length;
  const a = Math.floor((attack || 0) * SND_RATE);
  from = from || 0;
  to = to === undefined ? n : to;
  for (let i = from; i < to; i++) {
    const t = (i - from) / SND_RATE;
    let e = t < (attack || 0) ? t / attack : Math.exp(-(t - (attack || 0)) / decayTau);
    buf[i] *= e;
  }
  for (let i = to; i < n; i++) buf[i] = 0;
  return buf;
}

function snd_mix(dst, src, gain, offset) {
  offset = Math.floor((offset || 0) * SND_RATE);
  for (let i = 0; i < src.length && i + offset < dst.length; i++) {
    if (i + offset >= 0) dst[i + offset] += src[i] * gain;
  }
  return dst;
}

function snd_noise(sec, seed) {
  const b = snd_buf(sec), r = snd_rng(seed || 1);
  for (let i = 0; i < b.length; i++) b[i] = r();
  return b;
}

function snd_osc(sec, freqFn, wave, phase0) {
  const b = snd_buf(sec);
  let ph = phase0 || 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / SND_RATE;
    const f = typeof freqFn === 'function' ? freqFn(t) : freqFn;
    ph += f / SND_RATE;
    const p = ph - Math.floor(ph);
    let v;
    switch (wave) {
      case 'square': v = p < 0.5 ? 1 : -1; break;
      case 'saw': v = 2 * p - 1; break;
      case 'tri': v = 4 * Math.abs(p - 0.5) - 1; break;
      default: v = Math.sin(2 * Math.PI * p);
    }
    b[i] = v;
  }
  return b;
}

function snd_drive(buf, amount) {
  for (let i = 0; i < buf.length; i++) buf[i] = Math.tanh(buf[i] * amount) / Math.tanh(amount);
  return buf;
}

function snd_normalize(buf, peak) {
  let m = 0;
  for (let i = 0; i < buf.length; i++) m = Math.max(m, Math.abs(buf[i]));
  if (m > 0) { const k = (peak || 0.95) / m; for (let i = 0; i < buf.length; i++) buf[i] *= k; }
  return buf;
}

// Eco de quebrada / cerro: copias retardadas y filtradas.
function snd_echo(buf, delays, gains, lp) {
  const out = new Float32Array(buf.length);
  out.set(buf);
  for (let k = 0; k < delays.length; k++) {
    const d = Math.floor(delays[k] * SND_RATE);
    const tmp = new Float32Array(buf.length);
    for (let i = d; i < buf.length; i++) tmp[i] = buf[i - d];
    snd_biquad(tmp, 'lp', lp || 1800, 0.7);
    for (let i = 0; i < buf.length; i++) out[i] += tmp[i] * gains[k];
  }
  return out;
}

function snd_fadeout(buf, sec) {
  const n = Math.floor(sec * SND_RATE);
  for (let i = 0; i < n && i < buf.length; i++) buf[buf.length - 1 - i] *= i / n;
  return buf;
}

// --- Disparos ---------------------------------------------------------------------------------
function snd_gunshot(opts) {
  const len = opts.len || 1.0;
  const out = snd_buf(len);
  // chasquido inicial
  const crack = snd_noise(0.012, opts.seed);
  snd_biquad(crack, 'hp', opts.crackHp || 1500, 0.7);
  snd_mix(out, crack, 1.2);
  // cuerpo del estampido
  const body = snd_noise(len, opts.seed + 1);
  snd_lpSweep(body, opts.lp0 || 5000, opts.lp1 || 400);
  snd_env(body, 0.001, opts.tau || 0.06);
  snd_mix(out, body, 1.0);
  // golpe grave
  const thump = snd_osc(0.3, function (t) { return (opts.thump || 90) * Math.exp(-t * 12) + 40; }, 'sine');
  snd_env(thump, 0.001, opts.thumpTau || 0.06);
  snd_mix(out, thump, opts.thumpGain || 0.8);
  let res = out;
  if (opts.echo) res = snd_echo(out, opts.echo[0], opts.echo[1], opts.echoLp || 1500);
  snd_drive(res, opts.drive || 2);
  return snd_normalize(snd_fadeout(res, 0.05), opts.peak || 0.95);
}

// --- Metálicos y mecánicos ----------------------------------------------------------------------
function snd_click(seed, freq, len, gain) {
  const b = snd_noise(len || 0.03, seed);
  snd_biquad(b, 'bp', freq || 3500, 6);
  snd_env(b, 0.0005, (len || 0.03) / 5);
  return snd_normalize(b, gain || 0.8);
}

function snd_seq(total, parts) {
  const out = snd_buf(total);
  for (const p of parts) snd_mix(out, p[0], p[2] === undefined ? 1 : p[2], p[1]);
  return snd_normalize(out, 0.9);
}

// --- Voces (síntesis de formantes) ------------------------------------------------------------------
const SND_VOWELS = {
  a: [800, 1200, 2500], e: [500, 1800, 2500], i: [300, 2200, 3000], o: [500, 900, 2400], u: [350, 700, 2400]
};
function snd_voice(opts) {
  const len = opts.len;
  const src = snd_buf(len);
  const r = snd_rng(opts.seed || 7);
  let ph = 0;
  for (let i = 0; i < src.length; i++) {
    const t = i / SND_RATE, u = t / len;
    let f = opts.f0 * Math.pow(opts.f1 / opts.f0, u);
    f *= 1 + Math.sin(t * 2 * Math.PI * (opts.vibRate || 6)) * (opts.vib || 0.02) + r() * (opts.jitter || 0.01);
    ph += f / SND_RATE;
    const p = ph - Math.floor(ph);
    src[i] = (p < 0.12 ? 1 - p / 0.12 : 0) * 1.5 - 0.2 + r() * (opts.breath || 0.15);
  }
  const out = snd_buf(len);
  const v1 = SND_VOWELS[opts.vowel || 'a'], v2 = SND_VOWELS[opts.vowel2 || opts.vowel || 'a'];
  const gains = [1, 0.6, 0.3];
  for (let k = 0; k < 3; k++) {
    const b = new Float32Array(src);
    snd_biquad(b, 'bp', (v1[k] + v2[k]) / 2, 5 + k * 2);
    snd_mix(out, b, gains[k]);
  }
  // envolvente
  for (let i = 0; i < out.length; i++) {
    const u = i / out.length;
    const a = Math.min(1, u / (opts.attack || 0.08));
    const d = u > (opts.hold || 0.5) ? Math.max(0, 1 - (u - (opts.hold || 0.5)) / (1 - (opts.hold || 0.5))) : 1;
    out[i] *= a * d;
  }
  snd_drive(out, opts.drive || 1.5);
  return snd_normalize(out, 0.9);
}

// --- Corneta (serie armónica de un clarín en Do) ---------------------------------------------------------
function snd_bugle(notes, tempo) {
  const total = notes.reduce(function (s, n) { return s + n[1]; }, 0) * tempo + 0.4;
  const out = snd_buf(total);
  let t0 = 0;
  for (const n of notes) {
    const dur = n[1] * tempo;
    if (n[0] > 0) {
      const f = n[0];
      const tone = snd_osc(dur, function (t) { return f * (1 + 0.004 * Math.sin(t * 2 * Math.PI * 5)); }, 'saw');
      snd_biquad(tone, 'lp', f * 4.5, 0.9);
      for (let i = 0; i < tone.length; i++) {
        const t = i / SND_RATE;
        const a = Math.min(1, t / 0.025);
        const r = t > dur - 0.04 ? Math.max(0, (dur - t) / 0.04) : 1;
        tone[i] *= a * r;
      }
      snd_mix(out, tone, 0.6, t0);
    }
    t0 += dur;
  }
  return snd_normalize(snd_echo(out, [0.18, 0.37], [0.3, 0.15], 2500), 0.8);
}
const C4 = 261.63, G4 = 392.0, C5 = 523.25, E5 = 659.25, G5 = 783.99, C6 = 1046.5;

function SND_BuildSounds() {
  const add = function (name, samples) {
    W_AddLump('DS' + name.toUpperCase(), { rate: SND_RATE, samples: samples }, 'sound');
  };
  // Armas del jugador y de la tropa
  const hillEcho = [[0.14, 0.33, 0.61], [0.35, 0.22, 0.12]];
  add('revolv', snd_gunshot({ seed: 11, len: 0.9, lp0: 7000, lp1: 700, tau: 0.035, thump: 110, thumpGain: 0.5, echo: hillEcho, drive: 2.5 }));
  add('rifle', snd_gunshot({ seed: 21, len: 1.4, lp0: 6000, lp1: 350, tau: 0.075, thump: 80, thumpGain: 1.0, echo: [[0.18, 0.42, 0.8], [0.45, 0.28, 0.15]], drive: 3 }));
  add('rifle2', snd_gunshot({ seed: 31, len: 1.2, lp0: 4500, lp1: 300, tau: 0.06, thump: 75, thumpGain: 0.8, echo: hillEcho, drive: 2.6, peak: 0.85 }));
  add('rifle3', snd_gunshot({ seed: 41, len: 1.1, lp0: 5200, lp1: 320, tau: 0.055, thump: 85, thumpGain: 0.7, echo: hillEcho, drive: 2.6, peak: 0.8 }));
  add('gatlin', snd_gunshot({ seed: 51, len: 0.35, lp0: 6000, lp1: 800, tau: 0.03, thump: 100, thumpGain: 0.5, echo: [[0.1], [0.25]], drive: 2.2 }));
  add('cannon', snd_gunshot({ seed: 61, len: 2.4, lp0: 1800, lp1: 90, tau: 0.25, thump: 60, thumpTau: 0.3, thumpGain: 1.6, echo: [[0.3, 0.7, 1.2], [0.5, 0.35, 0.2]], echoLp: 600, drive: 3.5 }));
  {
    const out = snd_buf(2.6);
    const n = snd_noise(2.6, 71);
    snd_lpSweep(n, 2500, 60);
    snd_env(n, 0.003, 0.35);
    snd_mix(out, n, 1.2);
    const boom = snd_osc(1.5, function (t) { return 70 * Math.exp(-t * 3) + 28; }, 'sine');
    snd_env(boom, 0.002, 0.4);
    snd_mix(out, boom, 1.4);
    const crackle = snd_noise(1.6, 72);
    for (let i = 0; i < crackle.length; i++) if (Math.abs(crackle[i]) < 0.97) crackle[i] = 0;
    snd_biquad(crackle, 'bp', 2500, 2);
    snd_mix(out, crackle, 0.6, 0.2);
    add('explod', snd_normalize(snd_drive(snd_echo(out, [0.35, 0.8], [0.35, 0.18], 500), 2.5), 0.95));
  }
  // Recarga del Comblain: palanca, cartucho, cierre
  add('rload1', snd_seq(0.25, [[snd_click(81, 2500, 0.04), 0], [snd_click(82, 1800, 0.05), 0.06, 0.7]]));
  add('rload2', snd_seq(0.2, [[snd_click(83, 4200, 0.03), 0, 0.6], [snd_click(84, 3000, 0.02), 0.05, 0.5]]));
  add('rload3', snd_seq(0.25, [[snd_click(85, 2200, 0.05), 0], [snd_click(86, 3200, 0.03), 0.04, 0.8]]));
  // Mecha de la dinamita y lanzamiento
  {
    const f = snd_noise(0.6, 91);
    snd_biquad(f, 'bp', 6000, 1.5);
    for (let i = 0; i < f.length; i++) f[i] *= 0.6 + 0.4 * Math.sin(i / 90);
    snd_env(f, 0.02, 0.4);
    add('fuse', snd_normalize(f, 0.6));
    const w = snd_noise(0.35, 92);
    snd_lpSweep(w, 400, 3000);
    snd_env(w, 0.05, 0.12);
    add('throw', snd_normalize(w, 0.7));
  }
  // Silbido de granada entrante
  {
    const s = snd_osc(1.0, function (t) { return 1600 - 900 * t + 40 * Math.sin(t * 40); }, 'sine');
    for (let i = 0; i < s.length; i++) { const u = i / s.length; s[i] *= u * u * 0.7; }
    add('whistl', snd_normalize(s, 0.5));
  }
  // Rebote de bala
  {
    const s = snd_osc(0.3, function (t) { return 3200 * Math.exp(-t * 3) + 900; }, 'sine');
    snd_env(s, 0.002, 0.08);
    const n = snd_noise(0.3, 101); snd_biquad(n, 'hp', 3000, 0.7); snd_env(n, 0.001, 0.01);
    snd_mix(s, n, 0.5);
    add('ricoch', snd_normalize(s, 0.45));
  }
  // Armas blancas
  {
    const w = snd_noise(0.22, 111);
    snd_lpSweep(w, 5000, 800);
    snd_biquad(w, 'bp', 1800, 1.2);
    snd_env(w, 0.03, 0.06);
    add('slash', snd_normalize(w, 0.6));
    const st = snd_buf(0.3);
    const thud = snd_osc(0.2, function (t) { return 140 * Math.exp(-t * 8) + 60; }, 'sine');
    snd_env(thud, 0.001, 0.05);
    snd_mix(st, thud, 1);
    const wet = snd_noise(0.2, 112); snd_biquad(wet, 'lp', 900, 1); snd_env(wet, 0.002, 0.04);
    snd_mix(st, wet, 0.8);
    add('stab', snd_normalize(st, 0.8));
    const sb = snd_buf(0.6);
    snd_mix(sb, w, 0.7);
    const ring = snd_osc(0.5, 2600, 'sine'); snd_env(ring, 0.001, 0.12);
    snd_mix(sb, ring, 0.3, 0.12);
    add('saber', snd_normalize(sb, 0.7));
    add('sgtatk', snd_normalize(snd_voice({ len: 0.35, f0: 190, f1: 160, vowel: 'a', seed: 113 }), 0.8));
  }
  // Voces
  add('posit1', snd_voice({ len: 0.4, f0: 170, f1: 210, vowel: 'e', vowel2: 'a', seed: 201, hold: 0.6 }));
  add('posit2', snd_voice({ len: 0.5, f0: 150, f1: 190, vowel: 'a', vowel2: 'i', seed: 202, hold: 0.6 }));
  add('posit3', snd_voice({ len: 0.45, f0: 180, f1: 220, vowel: 'o', vowel2: 'e', seed: 203, hold: 0.6 }));
  add('sgtsit', snd_voice({ len: 0.8, f0: 160, f1: 210, vowel: 'a', seed: 204, hold: 0.8, drive: 2.5 }));
  add('ofsit', snd_voice({ len: 0.6, f0: 130, f1: 160, vowel: 'a', vowel2: 'e', seed: 205, hold: 0.7 }));
  add('popain', snd_voice({ len: 0.3, f0: 200, f1: 140, vowel: 'a', seed: 206, hold: 0.3 }));
  add('podth1', snd_voice({ len: 0.8, f0: 190, f1: 90, vowel: 'a', vowel2: 'o', seed: 207, hold: 0.4, vib: 0.05 }));
  add('podth2', snd_voice({ len: 0.9, f0: 170, f1: 80, vowel: 'o', vowel2: 'u', seed: 208, hold: 0.4, vib: 0.05 }));
  add('podth3', snd_voice({ len: 0.7, f0: 210, f1: 100, vowel: 'e', vowel2: 'a', seed: 209, hold: 0.35, vib: 0.06 }));
  add('sgtdth', snd_voice({ len: 1.0, f0: 180, f1: 70, vowel: 'a', vowel2: 'u', seed: 210, hold: 0.4, vib: 0.06, drive: 2 }));
  add('ofdth', snd_voice({ len: 1.1, f0: 150, f1: 70, vowel: 'o', vowel2: 'a', seed: 211, hold: 0.4, vib: 0.04 }));
  add('chdth', snd_voice({ len: 0.8, f0: 160, f1: 80, vowel: 'a', vowel2: 'u', seed: 212, hold: 0.45, vib: 0.05 }));
  add('posact', snd_voice({ len: 0.3, f0: 140, f1: 130, vowel: 'u', vowel2: 'o', seed: 213, hold: 0.5, breath: 0.3 }));
  add('plpain', snd_voice({ len: 0.35, f0: 140, f1: 95, vowel: 'a', vowel2: 'u', seed: 214, hold: 0.3, drive: 2 }));
  add('pldeth', snd_voice({ len: 1.2, f0: 150, f1: 60, vowel: 'a', vowel2: 'u', seed: 215, hold: 0.45, vib: 0.05, drive: 2 }));
  add('pdiehi', snd_voice({ len: 1.1, f0: 230, f1: 80, vowel: 'a', vowel2: 'o', seed: 216, hold: 0.4, vib: 0.08, drive: 2.5 }));
  add('oof', snd_voice({ len: 0.2, f0: 120, f1: 100, vowel: 'u', seed: 217, hold: 0.3 }));
  add('noway', snd_voice({ len: 0.22, f0: 115, f1: 95, vowel: 'u', vowel2: 'o', seed: 218, hold: 0.3 }));
  // Caballos
  {
    const len = 1.1;
    const b = snd_buf(len);
    let ph = 0;
    for (let i = 0; i < b.length; i++) {
      const t = i / SND_RATE;
      const f = 900 - 500 * (t / len) + 120 * Math.sin(t * 2 * Math.PI * 14) * (1 - t / len);
      ph += f / SND_RATE;
      b[i] = Math.sin(2 * Math.PI * ph) * 0.6 + Math.sin(4 * Math.PI * ph) * 0.3;
    }
    snd_biquad(b, 'bp', 1100, 1);
    snd_env(b, 0.05, 0.5);
    add('horse', snd_normalize(snd_drive(b, 2), 0.7));
    const hp = snd_voice({ len: 0.5, f0: 260, f1: 180, vowel: 'e', seed: 219, hold: 0.3 });
    add('hpain', hp);
    const hd = snd_buf(1.4);
    snd_mix(hd, b, 0.8);
    const fall = snd_osc(0.4, function (t) { return 80 * Math.exp(-t * 5) + 35; }, 'sine');
    snd_env(fall, 0.002, 0.15);
    snd_mix(hd, fall, 1, 0.9);
    add('hdeath', snd_normalize(hd, 0.8));
    const hv = snd_buf(0.5);
    for (let k = 0; k < 4; k++) {
      const th = snd_osc(0.08, function (t) { return 120 * Math.exp(-t * 20) + 50; }, 'sine');
      snd_env(th, 0.001, 0.02);
      const g = snd_noise(0.05, 220 + k); snd_biquad(g, 'lp', 700, 1); snd_env(g, 0.001, 0.015);
      snd_mix(hv, th, 0.8, [0, 0.09, 0.26, 0.35][k]);
      snd_mix(hv, g, 0.5, [0, 0.09, 0.26, 0.35][k]);
    }
    add('hooves', snd_normalize(hv, 0.6));
  }
  // Objetos
  add('itemup', snd_seq(0.25, [[snd_click(301, 3500, 0.03), 0], [snd_normalize(snd_env(snd_osc(0.15, 1760, 'tri'), 0.002, 0.05), 0.4), 0.02]]));
  add('wpnup', snd_seq(0.5, [[snd_click(302, 2200, 0.06), 0], [snd_click(303, 3000, 0.04), 0.08, 0.8],
    [snd_normalize(snd_env(snd_osc(0.3, 523.25, 'saw'), 0.01, 0.12), 0.4), 0.15]]));
  add('getpow', snd_bugle([[C5, 1], [E5, 1], [G5, 2]], 0.09));
  add('secret', snd_bugle([[G4, 1], [C5, 1], [E5, 1], [G5, 3]], 0.1));
  add('bugle', snd_bugle([[G4, 1], [C5, 1], [E5, 1], [G5, 2], [E5, 1], [G5, 1], [C6, 4], [0, 1], [G5, 1], [C6, 5]], 0.11));
  add('click', snd_click(304, 2800, 0.05, 0.9));
  // Portones y palancas
  {
    const cr = snd_buf(0.9);
    let ph = 0; const r = snd_rng(401);
    for (let i = 0; i < cr.length; i++) {
      const t = i / SND_RATE;
      const f = 70 + 30 * Math.sin(t * 7) + r() * 20;
      ph += f / SND_RATE;
      cr[i] = (ph - Math.floor(ph)) * 2 - 1;
    }
    snd_biquad(cr, 'bp', 900, 4);
    snd_env(cr, 0.05, 0.5);
    const thud = snd_osc(0.2, function (t) { return 90 * Math.exp(-t * 10) + 45; }, 'sine');
    snd_env(thud, 0.001, 0.06);
    add('doropn', snd_normalize(cr, 0.6));
    const cl = snd_buf(0.9);
    snd_mix(cl, cr, 0.5);
    snd_mix(cl, thud, 1, 0.55);
    add('dorcls', snd_normalize(cl, 0.7));
    add('swtchn', snd_seq(0.3, [[snd_click(402, 1500, 0.08), 0], [snd_click(403, 900, 0.1), 0.05, 0.8]]));
    add('swtchx', snd_seq(0.3, [[snd_click(404, 1200, 0.08), 0], [snd_click(405, 700, 0.12), 0.06, 0.9]]));
    add('pstart', snd_normalize(snd_env(snd_noise(0.4, 406), 0.02, 0.2), 0.3));
    add('pstop', snd_seq(0.3, [[thud, 0]]));
    add('stnmov', snd_normalize(snd_biquad(snd_env(snd_noise(0.3, 407), 0.02, 0.15), 'lp', 400, 1), 0.3));
  }
  // Salpicadura (restos)
  {
    const s = snd_buf(0.6);
    for (let k = 0; k < 5; k++) {
      const n = snd_noise(0.12, 501 + k); snd_biquad(n, 'lp', 600 + k * 100, 1); snd_env(n, 0.002, 0.03);
      snd_mix(s, n, 0.8, k * 0.06);
    }
    add('slop', snd_normalize(s, 0.8));
  }
  // Menú
  add('menumv', snd_click(601, 2000, 0.03, 0.5));
  add('menusl', snd_gunshot({ seed: 602, len: 0.5, lp0: 6000, lp1: 800, tau: 0.03, thump: 100, thumpGain: 0.4, drive: 2, peak: 0.6 }));
  add('menubk', snd_click(603, 1200, 0.05, 0.6));
}
