// =============================================================================
// music.js — Música marcial secuenciada (el equivalente a los lumps D_* / MUS)
// -----------------------------------------------------------------------------
// Pequeño secuenciador sobre Web Audio con timbres de banda militar del siglo
// XIX: corneta (clarín), pífano, bajo y cajas/bombo. Melodías originales
// compuestas para este juego, en estilo de marcha.
// Notación: "NOTA:DURACIÓN" con la duración en corcheas; R = silencio.
// =============================================================================
'use strict';

const MUS_SONGS = {
  // Pantalla de título: marcha en Do mayor
  M_TITLE: {
    bpm: 112,
    lead: { inst: 'bugle', notes:
      'G4 C5 E5 C5 G4 C5 E5 G5 F5 E5 D5 C5 D5:2 G4:2 ' +
      'G4 C5 E5 C5 G4 C5 E5 G5 A5 G5 F5 D5 C5:4 ' +
      'E5 E5 F5 G5 A5:2 G5:2 F5 F5 E5 D5 E5:4 ' +
      'C5 D5 E5 F5 G5:2 E5:2 D5 C5 D5 E5 C5:4' },
    harm: { inst: 'fife', octave: 1, notes:
      'E5 G5 C6 G5 E5 G5 C6 E6 C6 C6 B5 A5 B5:2 D5:2 ' +
      'E5 G5 C6 G5 E5 G5 C6 E6 F6 E6 D6 B5 G5:4 ' +
      'C6 C6 D6 E6 F6:2 E6:2 D6 D6 C6 B5 C6:4 ' +
      'A5 B5 C6 D6 E6:2 C6:2 B5 A5 B5 G5 E5:4', gain: 0.25 },
    bass: { inst: 'bass', notes:
      'C3 G2 C3 G2 C3 G2 C3 G2 F2 C3 F2 C3 G2 D3 G2 B2 ' +
      'C3 G2 C3 G2 C3 G2 C3 G2 F2 C3 G2 D3 C3 G2 C3 C2 ' +
      'C3 G2 F2 C3 F2 C3 C3 G2 G2 D3 G2 D3 C3 G2 C3 G2 ' +
      'A2 E3 F2 C3 C3 G2 C3 G2 G2 D3 G2 B2 C3 G2 C3:2' },
    drums: 'K.s.S.s.K.s.S.sr'
  },
  // Pisagua: desembarco bajo fuego (La menor, rápido)
  M_E1M1: {
    bpm: 132,
    lead: { inst: 'fife', notes:
      'A4 A4 C5 E5 D5 C5 B4 A4 G4 A4 B4 C5 B4:2 E4:2 ' +
      'A4 A4 C5 E5 F5 E5 D5 C5 B4 C5 D5 B4 A4:4 ' +
      'E5 E5 E5 D5 C5:2 A4:2 D5 D5 D5 C5 B4:2 G4:2 ' +
      'A4 C5 E5 A5 G5 F5 E5 D5 C5 B4 A4 G#4 A4:4' },
    harm: { inst: 'bugle', notes:
      'R:8 R:8 R:8 R:4 E4:2 E4:2 ' +
      'R:8 R:8 R:8 E4:2 A4:2 ' +
      'A4:4 E4:4 G4:4 D4:4 R:8 R:4 E4:4', gain: 0.35 },
    bass: { inst: 'bass', notes:
      'A2 E3 A2 E3 D3 A2 D3 A2 E2 B2 E2 B2 E2 B2 E2 G#2 ' +
      'A2 E3 A2 E3 D3 A2 D3 F2 E2 B2 E2 B2 A2 E3 A2 E2 ' +
      'A2 E3 A2 E3 A2 E3 A2 E3 G2 D3 G2 D3 G2 D3 G2 B2 ' +
      'A2 E3 A2 E3 D3 A2 D3 A2 E2 B2 E2 B2 A2 E3 A2:2' },
    drums: 'K.srS.s.K.srS.rr'
  },
  // Dolores: la pampa y el cerro San Francisco (Re menor)
  M_E1M2: {
    bpm: 124,
    lead: { inst: 'bugle', notes:
      'D5:2 A4 D5 F5:2 E5 D5 C5:2 A4:2 D5:4 ' +
      'F5:2 G5 A5 Bb5:2 A5 G5 F5 E5 D5 C#5 D5:4 ' +
      'A4 A4 D5 D5 F5 F5 E5 D5 C5 C5 F5 F5 A5:4 ' +
      'G5 F5 E5 D5 E5 F5 G5 E5 D5 C#5 E5 C#5 D5:4' },
    harm: { inst: 'fife', notes:
      'F5:2 D5 F5 A5:2 G5 F5 E5:2 C5:2 F5:4 ' +
      'A5:2 Bb5 C6 D6:2 C6 Bb5 A5 G5 F5 E5 F5:4 ' +
      'D5 D5 F5 F5 A5 A5 G5 F5 E5 E5 A5 A5 C6:4 ' +
      'Bb5 A5 G5 F5 G5 A5 Bb5 G5 F5 E5 G5 E5 F5:4', gain: 0.22 },
    bass: { inst: 'bass', notes:
      'D3 A2 D3 A2 D3 A2 D3 A2 F2 C3 F2 C3 D3 A2 D3 A2 ' +
      'D3 A2 G2 D3 G2 D3 G2 D3 A2 E3 A2 E3 D3 A2 D3 A2 ' +
      'D3 A2 D3 A2 D3 A2 D3 A2 F2 C3 F2 C3 F2 C3 F2 C3 ' +
      'G2 D3 G2 D3 C3 G2 C3 G2 A2 E3 A2 E3 D3 A2 D3:2' },
    drums: 'K.s.S.srK.s.S.s.'
  },
  // Arica: asalto al Morro al amanecer (Mi menor)
  M_E1M3: {
    bpm: 128,
    lead: { inst: 'bugle', notes:
      'E4 G4 B4 E5 D5 B4 G4 B4 C5 E5 A5 G5 F#5:4 ' +
      'E5 D5 C5 B4 A4 C5 E5 A4 B4 D5 F#5 D#5 E5:4 ' +
      'G5 G5 F#5 E5 D5:2 B4:2 C5 C5 B4 A4 B4:4 ' +
      'E5 F#5 G5 A5 B5:2 G5:2 F#5 E5 D#5 F#5 E5:4' },
    harm: { inst: 'fife', notes:
      'B4 E5 G5 B5 A5 G5 E5 G5 A5 C6 E6 D6 D#6:4 ' +
      'G5 F#5 E5 D5 C5 E5 A5 C5 D#5 F#5 A5 F#5 G5:4 ' +
      'B5 B5 A5 G5 F#5:2 D5:2 E5 E5 D5 C5 D#5:4 ' +
      'G5 A5 B5 C6 D6:2 B5:2 A5 G5 F#5 A5 G5:4', gain: 0.22 },
    bass: { inst: 'bass', notes:
      'E2 B2 E2 B2 E2 B2 E2 B2 A2 E3 A2 E3 B2 F#2 B2 F#2 ' +
      'E2 B2 E2 B2 A2 E3 A2 E3 B2 F#2 B2 F#2 E2 B2 E2 B2 ' +
      'E2 B2 E2 B2 G2 D3 G2 D3 A2 E3 A2 E3 B2 F#2 B2 F#2 ' +
      'E2 B2 E2 B2 G2 D3 G2 D3 B2 F#2 B2 F#2 E2 B2 E2:2' },
    drums: 'K.rrS.s.K.s.S.rr'
  },
  // Intermedio: marcha en Sol mayor
  M_INTER: {
    bpm: 118,
    lead: { inst: 'bugle', notes:
      'D5 G5 B5 G5 D5 G5 B5 D6 C6 B5 A5 G5 A5:4 ' +
      'D5 G5 B5 G5 D5 G5 B5 D6 E6 D6 C6 A5 G5:4' },
    harm: { inst: 'fife', notes:
      'B4 D5 G5 D5 B4 D5 G5 B5 A5 G5 F#5 E5 F#5:4 ' +
      'B4 D5 G5 D5 B4 D5 G5 B5 C6 B5 A5 F#5 D5:4', gain: 0.25 },
    bass: { inst: 'bass', notes:
      'G2 D3 G2 D3 G2 D3 G2 D3 C3 G2 C3 G2 D3 A2 D3 A2 ' +
      'G2 D3 G2 D3 G2 D3 G2 D3 C3 G2 D3 A2 G2 D3 G2:2' },
    drums: 'K.s.S.s.'
  },
  // Parte de guerra: redoble y clarín lejano
  M_BRIEF: {
    bpm: 80,
    lead: { inst: 'bugle', notes: 'C5:2 G4 C5 E5:4 R:8 G5:2 E5 C5 G4:4 R:8 C5:2 E5:2 G5:4 E5:2 C5:6 R:8' , gain: 0.5 },
    bass: { inst: 'bass', notes: 'C2:8 C2:8 G2:8 G2:8 C2:8 C2:8', gain: 0.6 },
    drums: 'rrrrrrrrs.......'
  },
  // Final: himno solemne en Fa mayor
  M_FINAL: {
    bpm: 72,
    lead: { inst: 'bugle', notes:
      'F4:2 A4:2 C5:4 D5:2 C5:2 A4:4 Bb4:2 A4:2 G4:2 F4:2 G4:8 ' +
      'A4:2 C5:2 F5:4 E5:2 D5:2 C5:4 D5:2 C5:2 Bb4:2 G4:2 F4:8' },
    harm: { inst: 'fife', notes:
      'C5:2 F5:2 A5:4 Bb5:2 A5:2 F5:4 D5:2 F5:2 E5:2 D5:2 E5:8 ' +
      'F5:2 A5:2 C6:4 C6:2 Bb5:2 A5:4 Bb5:2 A5:2 G5:2 E5:2 F5:8', gain: 0.2 },
    bass: { inst: 'bass', notes: 'F2:4 F2:4 Bb2:4 F2:4 Bb2:4 C3:4 C3:8 F2:4 A2:4 Bb2:4 F2:4 Bb2:4 C3:4 F2:8' },
    drums: 'K.......s.......'
  }
};

const MUS_NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };

function MUS_Freq(tok) {
  const m = /^([A-G](?:#|b)?)(-?\d)$/.exec(tok);
  if (!m) return 0;
  const midi = (parseInt(m[2], 10) + 1) * 12 + MUS_NOTE[m[1]];
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function MUS_Parse(str) {
  const events = [];
  let t = 0;
  for (const tok of str.trim().split(/\s+/)) {
    const parts = tok.split(':');
    const dur = parts[1] ? parseFloat(parts[1]) : 1;
    if (parts[0] !== 'R') events.push({ t: t, dur: dur, f: MUS_Freq(parts[0]) });
    t += dur;
  }
  return { events: events, length: t };
}

let MUS_state = null;
let MUS_noiseBuf = null;

function MUS_Stop() {
  if (!MUS_state) return;
  clearInterval(MUS_state.timer);
  try {
    MUS_state.gain.gain.setTargetAtTime(0, I_audioCtx.currentTime, 0.05);
    const g = MUS_state.gain;
    setTimeout(function () { try { g.disconnect(); } catch (e) { /* nada */ } }, 400);
  } catch (e) { /* nada */ }
  MUS_state = null;
}

function MUS_Play(name, loop) {
  MUS_Stop();
  const song = MUS_SONGS[name];
  if (!song || !I_audioCtx) return;
  const ctx = I_audioCtx;
  if (!MUS_noiseBuf) {
    MUS_noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.4), ctx.sampleRate);
    const d = MUS_noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const voices = [];
  let loopLen = 0;
  for (const key of ['lead', 'harm', 'bass']) {
    if (!song[key]) continue;
    const p = MUS_Parse(song[key].notes);
    voices.push({ inst: song[key].inst, gain: song[key].gain || 1, events: p.events });
    loopLen = Math.max(loopLen, p.length);
  }
  const eighth = 60 / song.bpm / 2;
  const gain = ctx.createGain();
  gain.gain.value = 1;
  gain.connect(I_musicGain);
  const st = { song: song, gain: gain, eighth: eighth, loopLen: loopLen, loop: loop !== false, next: ctx.currentTime + 0.1, timer: 0 };
  MUS_state = st;
  const schedule = function () {
    if (MUS_state !== st) return;
    while (st.next < ctx.currentTime + 2.5) {
      MUS_ScheduleLoop(st, voices, st.next);
      st.next += st.loopLen * st.eighth;
      if (!st.loop) { clearInterval(st.timer); break; }
    }
  };
  schedule();
  st.timer = setInterval(schedule, 500);
}

function MUS_ScheduleLoop(st, voices, t0) {
  const ctx = I_audioCtx;
  for (const v of voices) {
    for (const e of v.events) MUS_Note(st.gain, v.inst, e.f, t0 + e.t * st.eighth, e.dur * st.eighth, v.gain);
  }
  // Batería: patrón en semicorcheas repetido durante todo el ciclo.
  const pat = st.song.drums;
  if (pat) {
    const six = st.eighth / 2;
    const steps = Math.round(st.loopLen * 2);
    for (let i = 0; i < steps; i++) {
      const c = pat[i % pat.length];
      const t = t0 + i * six;
      if (c === 'K') MUS_Kick(st.gain, t);
      else if (c === 'S') MUS_Snare(st.gain, t, 0.5);
      else if (c === 's') MUS_Snare(st.gain, t, 0.22);
      else if (c === 'r') { MUS_Snare(st.gain, t, 0.18); MUS_Snare(st.gain, t + six / 2, 0.14); }
    }
  }
}

function MUS_Note(dest, inst, f, t, dur, vgain) {
  const ctx = I_audioCtx;
  if (!f) return;
  const g = ctx.createGain();
  const peak = (inst === 'bass' ? 0.32 : inst === 'fife' ? 0.14 : 0.16) * (vgain || 1);
  g.gain.setValueAtTime(0, t);
  if (inst === 'bass') {
    g.gain.linearRampToValueAtTime(peak, t + 0.01);
    g.gain.exponentialRampToValueAtTime(peak * 0.25, t + Math.max(0.05, dur * 0.9));
    g.gain.linearRampToValueAtTime(0, t + dur);
  } else {
    g.gain.linearRampToValueAtTime(peak, t + 0.02);
    g.gain.setValueAtTime(peak * 0.85, t + Math.max(0.03, dur - 0.05));
    g.gain.linearRampToValueAtTime(0, t + dur);
  }
  const o = ctx.createOscillator();
  o.frequency.value = f;
  if (inst === 'bugle') {
    o.type = 'sawtooth';
    const flt = ctx.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.value = f * 4;
    flt.Q.value = 1.2;
    o.connect(flt); flt.connect(g);
  } else if (inst === 'fife') {
    o.type = 'triangle';
    const vib = ctx.createOscillator();
    const vg = ctx.createGain();
    vib.frequency.value = 5.5;
    vg.gain.value = f * 0.006;
    vib.connect(vg); vg.connect(o.frequency);
    vib.start(t); vib.stop(t + dur + 0.05);
    o.connect(g);
  } else {
    o.type = 'triangle';
    o.connect(g);
  }
  g.connect(dest);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function MUS_Snare(dest, t, vol) {
  const ctx = I_audioCtx;
  const src = ctx.createBufferSource();
  src.buffer = MUS_noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = 1400;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  src.connect(f); f.connect(g); g.connect(dest);
  src.start(t);
  src.stop(t + 0.15);
}

function MUS_Kick(dest, t) {
  const ctx = I_audioCtx;
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(110, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.5, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
  o.connect(g); g.connect(dest);
  o.start(t);
  o.stop(t + 0.32);
}
