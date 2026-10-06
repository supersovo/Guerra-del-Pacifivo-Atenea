// =============================================================================
// s_march.js — Marchas militares cargadas por el jugador (MIDI o audio)
// -----------------------------------------------------------------------------
// Las marchas históricas del Ejército de Chile no vienen dentro del juego. El
// Himno de Yungay (José Zapiola, 1839) y la melodía de Adiós al Séptimo de
// Línea (Luis Mancilla y Gumersindo Ipinza, 1877) son de dominio público, pero
// la letra y los arreglos difundidos de esta última (José Goles) y Los Viejos
// Estandartes (Guillermo Bascuñán y Jorge Inostrosa, 1966) tienen derechos de
// autor vigentes. Por eso el jugador carga sus propios archivos:
//   - un MIDI (.mid) lo interpreta la banda sintetizada del juego (cornetas,
//     pífanos, clarinetes, bombardinos, tubas, caja, bombo y platillos);
//   - un audio (.mp3, .ogg, .wav, .m4a...) se reproduce tal cual.
// Cada marcha se asigna a un momento de la campaña (portada, parte de
// operaciones, intermedio, cada batalla, final) y se guarda en el navegador
// (IndexedDB). Se cargan desde el menú Opciones > Sonido > Marchas militares o
// arrastrando los archivos a la ventana del juego.
// =============================================================================
'use strict';

// Ranuras de música: lump de música del juego y nombre en el menú.
const MARCH_SLOTS = [
  ['M_TITLE', 'Portada'], ['M_BRIEF', 'Parte de operaciones'], ['M_INTER', 'Intermedio'],
  ['M_E1M1', 'I · Pisagua'], ['M_E1M2', 'II · Dolores'], ['M_TACNA', 'III · Tacna'],
  ['M_E1M3', 'IV · Arica'], ['M_LIMA1', 'V · Chorrillos'], ['M_LIMA2', 'VI · Miraflores'],
  ['M_FINAL', 'Final de la campaña']
];

// Asignación automática por el nombre del archivo: el himno de la victoria
// abre y cierra la campaña, la despedida del Séptimo acompaña el parte antes
// del combate y los viejos estandartes, el recuento de bajas.
const MARCH_AUTO = [
  [/yungay/i, ['M_TITLE', 'M_FINAL']],
  [/s[eé]ptimo|septimo|7(mo|º|°)?[ _-]*de[ _-]*l[ií]nea/i, ['M_BRIEF']],
  [/estandarte/i, ['M_INTER']]
];
const MARCH_BATTLES = ['M_E1M1', 'M_E1M2', 'M_TACNA', 'M_E1M3', 'M_LIMA1', 'M_LIMA2'];

const MARCH_MAXSIZE = 40 * 1024 * 1024;
const MARCH_MAXNOTES = 40000;

let MARCH_list = [];       // [{ id, name, kind: 'midi'|'audio', data, song, buffer, error }]
let MARCH_assign = {};     // ranura -> id de la marcha
let MARCH_db = null;       // IndexedDB; null: las marchas viven solo en esta sesión
let MARCH_dbTried = false;
let MARCH_previewing = false;

// --- Lector de archivos MIDI estándar (SMF 0, 1 y 2; también RIFF RMID) ----------
// Devuelve las notas en segundos, ya con el mapa de tempos aplicado:
// { notes: [{ t, dur, key, vel, f, inst, drum }], length, gain }.
function MIDI_Parse(buffer) {
  let d = new Uint8Array(buffer);
  const tag = function (p) { return String.fromCharCode(d[p], d[p + 1], d[p + 2], d[p + 3]); };
  if (d.length > 20 && tag(0) === 'RIFF' && tag(8) === 'RMID') {
    let p = 12;
    while (p + 8 <= d.length) {
      const len = (d[p + 4] | (d[p + 5] << 8) | (d[p + 6] << 16) | (d[p + 7] << 24)) >>> 0;
      if (tag(p) === 'data') { d = d.subarray(p + 8, Math.min(d.length, p + 8 + len)); break; }
      p += 8 + len + (len & 1);
    }
  }
  const u32 = function (p) { return ((d[p] << 24) | (d[p + 1] << 16) | (d[p + 2] << 8) | d[p + 3]) >>> 0; };
  const u16 = function (p) { return (d[p] << 8) | d[p + 1]; };
  let pos = 0;
  while (pos + 14 <= d.length && pos < 1024 && tag(pos) !== 'MThd') pos++;
  if (pos + 14 > d.length || tag(pos) !== 'MThd') throw new Error('no es un archivo MIDI');
  const ntrks = u16(pos + 10), division = u16(pos + 12);
  pos += 8 + u32(pos + 4);
  let tpq = division || 96, ticksPerSec = 0;
  if (division & 0x8000) ticksPerSec = (256 - (division >> 8)) * (division & 0xff);   // SMPTE

  const evs = [];      // { tick, ord, type: 0 off, 1 on, 2 programa, ch, a, b }
  const tempos = [];   // { tick, us }
  let maxTick = 0;
  for (let tr = 0; tr < ntrks && pos + 8 <= d.length;) {
    const id = tag(pos), len = u32(pos + 4);
    pos += 8;
    const end = Math.min(d.length, pos + len);
    if (id !== 'MTrk') { pos = end; continue; }
    tr++;
    let p = pos, tick = 0, status = 0;
    const vlq = function () {
      let v = 0, b, n = 0;
      do { b = d[p++]; v = v * 128 + (b & 0x7f); } while ((b & 0x80) && p < end && ++n < 4);
      return v;
    };
    while (p < end) {
      tick += vlq();
      if (p >= end) break;
      let st = d[p];
      if (st & 0x80) { p++; if (st < 0xf0) status = st; } else if (status) st = status; else break;
      const type = st & 0xf0, ch = st & 0x0f;
      if (st === 0xff) {
        const mt = d[p++];
        const ml = vlq();
        if (mt === 0x51 && ml >= 3) tempos.push({ tick: tick, us: (d[p] << 16) | (d[p + 1] << 8) | d[p + 2] });
        p += ml;
        if (mt === 0x2f) break;
      } else if (st === 0xf0 || st === 0xf7) {
        p += vlq();
      } else if (st >= 0xf1) {
        p += st === 0xf2 ? 2 : st === 0xf3 ? 1 : 0;
      } else if (type === 0x90 || type === 0x80) {
        const key = d[p++], vel = d[p++];
        evs.push({ tick: tick, ord: evs.length, type: type === 0x90 && vel ? 1 : 0, ch: ch, a: key & 0x7f, b: vel & 0x7f });
      } else if (type === 0xc0) {
        evs.push({ tick: tick, ord: evs.length, type: 2, ch: ch, a: d[p++] & 0x7f, b: 0 });
      } else if (type === 0xd0) p += 1;
      else p += 2;   // 0xA0, 0xB0, 0xE0
      if (tick > maxTick) maxTick = tick;
    }
    pos = end;
  }

  // Mapa de tempos: tick -> segundos
  tempos.sort(function (a, b) { return a.tick - b.tick; });
  const segs = [{ tick: 0, sec: 0, us: 500000 }];
  for (const tm of tempos) {
    const last = segs[segs.length - 1];
    if (tm.us <= 0) continue;
    if (tm.tick === last.tick) { last.us = tm.us; continue; }
    segs.push({ tick: tm.tick, sec: last.sec + (tm.tick - last.tick) * last.us / 1e6 / tpq, us: tm.us });
  }
  let si = 0;
  const toSec = function (tick) {
    if (ticksPerSec) return tick / ticksPerSec;
    while (si + 1 < segs.length && segs[si + 1].tick <= tick) si++;
    while (si > 0 && segs[si].tick > tick) si--;
    const s = segs[si];
    return s.sec + (tick - s.tick) * s.us / 1e6 / tpq;
  };

  // Notas: en un mismo tick se apagan antes de encenderse (notas repetidas).
  evs.sort(function (a, b) { return a.tick - b.tick || (a.type === 1) - (b.type === 1) || a.ord - b.ord; });
  const prog = new Array(16).fill(0);
  const open = new Map();
  const raw = [];
  for (const e of evs) {
    if (e.type === 2) { prog[e.ch] = e.a; continue; }
    const k = e.ch * 128 + e.a;
    if (e.type === 1) {
      let q = open.get(k);
      if (!q) { q = []; open.set(k, q); }
      q.push({ tick: e.tick, vel: e.b, prog: prog[e.ch] });
    } else {
      const q = open.get(k);
      if (q && q.length) {
        const n = q.shift();
        raw.push({ t0: n.tick, t1: e.tick, ch: e.ch, key: e.a, vel: n.vel, prog: n.prog });
      }
    }
  }
  open.forEach(function (q, k) {
    for (const n of q) raw.push({ t0: n.tick, t1: Math.max(n.tick + 1, maxTick), ch: k >> 7, key: k & 127, vel: n.vel, prog: n.prog });
  });
  if (!raw.length) throw new Error('el archivo no tiene notas');
  raw.sort(function (a, b) { return a.t0 - b.t0; });
  if (raw.length > MARCH_MAXNOTES) raw.length = MARCH_MAXNOTES;

  si = 0;
  const notes = [];
  let first = Infinity, last = 0, busy = 0;
  for (const r of raw) {
    const t = toSec(r.t0);
    notes.push({ t: t, t1: r.t1, key: r.key, vel: r.vel / 127, drum: r.ch === 9, prog: r.prog });
    if (t < first) first = t;
  }
  si = 0;
  const ends = raw.map(function (r) { return r.t1; }).sort(function (a, b) { return a - b; });
  const endSec = new Map();
  for (const tk of ends) if (!endSec.has(tk)) endSec.set(tk, toSec(tk));
  // Se quita el silencio inicial (compases de cuenta) dejando un respiro breve.
  const shift = Math.max(0, first - 0.15);
  for (const n of notes) {
    const t1 = endSec.get(n.t1);
    n.dur = Math.max(0.04, t1 - n.t);
    n.t -= shift;
    delete n.t1;
    if (n.drum) n.dur = 0;
    else {
      n.inst = MIDI_Timbre(n.prog, n.key);
      n.f = 440 * Math.pow(2, (n.key - 69) / 12);
      busy += n.dur;
    }
    last = Math.max(last, n.t + n.dur);
  }
  // Muchas voces a la vez saturan: la ganancia baja con la polifonía media.
  const poly = busy / Math.max(1, last);
  return { notes: notes, length: Math.max(1, last), gain: clamp(2 / Math.sqrt(Math.max(1, poly)), 0.3, 1) };
}

// Instrumento de la banda según el programa General MIDI y el registro.
function MIDI_Timbre(prog, key) {
  if (prog >= 72 && prog <= 79) return 'fife';                                   // flautín, flautas
  if ((prog >= 64 && prog <= 69) || prog === 71) return key < 50 ? 'horn' : 'reed';  // saxos, oboe, clarinete
  if (prog === 70) return key < 52 ? 'tuba' : 'reed';                            // fagot
  if (prog === 58 || (prog >= 32 && prog <= 39) || prog === 43) return 'tuba';   // tuba, bajos
  if (prog === 57 || prog === 60) return key < 46 ? 'tuba' : 'horn';             // trombón, corno
  if (prog === 56 || prog === 59) return key < 55 ? 'horn' : 'bugle';            // trompeta, cornetín
  if (key >= 81) return 'fife';
  if (key >= 60) return 'bugle';
  if (key >= 46) return 'horn';
  return 'tuba';
}

// Percusión General MIDI (canal 10) con la batería de la banda.
function MARCH_Drum(dest, key, t, vel) {
  if (key === 35 || key === 36) MUS_Kick(dest, t, 0.55 * vel);
  else if (key === 38 || key === 40) MUS_Snare(dest, t, 0.5 * vel);
  else if (key === 37 || key === 39) MUS_Snare(dest, t, 0.25 * vel);
  else if (key === 49 || key === 52 || key === 55 || key === 57) MUS_Cymbal(dest, t, 0.28 * vel, 1.1);
  else if (key === 51 || key === 53 || key === 59) MUS_Cymbal(dest, t, 0.08 * vel, 0.35);
  else if (key === 42 || key === 44 || key === 46) MUS_Cymbal(dest, t, 0.05 * vel, key === 46 ? 0.3 : 0.07);
  else if (key >= 41 && key <= 50) MUS_Kick(dest, t, 0.4 * vel, 90 + (key - 41) * 14);
  else MUS_Snare(dest, t, 0.15 * vel);
}

function MARCH_Event(dest, n, t, gain) {
  if (n.drum) MARCH_Drum(dest, n.key, t, 0.35 + 0.65 * n.vel);
  else MUS_Note(dest, n.inst, n.f, t, Math.min(n.dur, 8), gain * (0.35 + 0.65 * n.vel));
}

// --- Reproducción (desde MUS_Play) ----------------------------------------------------
function MARCH_Find(id) {
  for (const m of MARCH_list) if (m.id === id) return m;
  return null;
}

function MARCH_TryPlay(slot, loop) {
  const m = MARCH_Find(MARCH_assign[slot]);
  if (!m || m.error || !I_audioCtx) return false;
  const ctx = I_audioCtx;
  const bus = ctx.createGain();
  const st = { gain: bus, timer: 0, stop: null, march: m, slot: slot };
  MUS_state = st;
  if (m.kind === 'audio') {
    if (!m.buffer) {
      // se decodifica en segundo plano y entonces empieza
      MARCH_Decode(m).then(function () { if (MUS_state === st) MUS_Play(slot, loop); });
      bus.connect(I_musicGain);
      return true;
    }
    bus.gain.value = 0.7;
    bus.connect(I_musicGain);
    const src = ctx.createBufferSource();
    src.buffer = m.buffer;
    src.loop = loop;
    src.connect(bus);
    src.start(ctx.currentTime + 0.05);
    st.stop = function () { try { src.stop(); } catch (e) { /* nada */ } };
    return true;
  }
  // MIDI: la banda del juego, con un compresor para los arreglos de muchas voces.
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 4;
  comp.attack.value = 0.005; comp.release.value = 0.25;
  bus.connect(comp);
  comp.connect(I_musicGain);
  const song = m.song;
  st.idx = 0;
  st.base = ctx.currentTime + 0.15;
  const cycle = song.length + 1.2;   // un respiro entre repeticiones
  const schedule = function () {
    if (MUS_state !== st) return;
    const now = ctx.currentTime, horizon = now + 2;
    if (now - st.base > cycle) {
      // la pestaña estuvo dormida: se salta al punto actual de la marcha
      if (!loop) { clearInterval(st.timer); return; }
      st.base += Math.floor((now - st.base) / cycle) * cycle;
      st.idx = MARCH_FirstNote(song.notes, now - st.base);
    }
    for (let count = 0; count < 600; count++) {
      if (st.idx >= song.notes.length) {
        if (!loop) { clearInterval(st.timer); return; }
        st.base += cycle;
        st.idx = 0;
      }
      const n = song.notes[st.idx];
      const t = st.base + n.t;
      if (t > horizon) break;
      if (t >= now - 0.03) MARCH_Event(bus, n, t, song.gain);
      st.idx++;
    }
  };
  schedule();
  st.timer = setInterval(schedule, 250);
  st.stop = function () { try { comp.disconnect(); } catch (e) { /* nada */ } };
  return true;
}

// Primera nota que empieza en el instante t o después (búsqueda binaria).
function MARCH_FirstNote(notes, t) {
  let lo = 0, hi = notes.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (notes[mid].t < t) lo = mid + 1; else hi = mid;
  }
  return lo;
}

function MARCH_Decode(m) {
  if (m.buffer) return Promise.resolve(true);
  if (m.decoding) return m.decoding;
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  let ctx = I_audioCtx;
  try { if (!ctx && OAC) ctx = new OAC(2, 1, 44100); } catch (e) { ctx = null; }
  if (!ctx) return Promise.resolve(false);
  m.decoding = new Promise(function (resolve) {
    const ok = function (b) { m.buffer = b; resolve(true); };
    const fail = function () { m.error = true; resolve(false); };
    try {
      const p = ctx.decodeAudioData(m.data.slice(0), ok, fail);
      if (p && p.catch) p.catch(fail);
    } catch (e) { fail(); }
  });
  return m.decoding;
}

// --- Almacenamiento (IndexedDB) ----------------------------------------------------------
function MARCH_OpenDB() {
  return new Promise(function (resolve) {
    let req;
    try { req = window.indexedDB.open('atenea1879', 1); } catch (e) { resolve(null); return; }
    req.onupgradeneeded = function () { req.result.createObjectStore('marchas', { keyPath: 'id' }); };
    req.onsuccess = function () { resolve(req.result); };
    req.onerror = function () { resolve(null); };
    req.onblocked = function () { resolve(null); };
  });
}

function MARCH_Store(mode, fn) {
  return new Promise(function (resolve) {
    if (!MARCH_db) { resolve(null); return; }
    try {
      const tx = MARCH_db.transaction('marchas', mode);
      const req = fn(tx.objectStore('marchas'));
      tx.oncomplete = function () { resolve(req ? req.result : true); };
      tx.onerror = tx.onabort = function () { resolve(null); };
    } catch (e) { resolve(null); }
  });
}

function MARCH_SaveAssign() {
  M_StorageSet('marchas', MARCH_assign);
}

function MARCH_Add(rec) {
  const m = { id: rec.id, name: rec.name, kind: rec.kind, data: rec.data, song: null, buffer: null, decoding: null, error: false };
  if (m.kind === 'midi') {
    try { m.song = MIDI_Parse(m.data); } catch (e) { console.warn('Marcha "' + m.name + '": ' + e.message); return null; }
  }
  MARCH_list.push(m);
  return m;
}

async function MARCH_Init() {
  const saved = M_StorageGet('marchas', {});
  MARCH_assign = saved && typeof saved === 'object' ? saved : {};
  try {
    window.addEventListener('dragover', function (e) {
      if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0) e.preventDefault();
    });
    window.addEventListener('drop', function (e) {
      if (!e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) return;
      e.preventDefault();
      MARCH_LoadFiles(e.dataTransfer.files);
    });
  } catch (e) { /* sin arrastrar y soltar */ }
  MARCH_db = await MARCH_OpenDB();   // null si el navegador no lo permite (incrustado, privado...)
  const rows = await MARCH_Store('readonly', function (s) { return s.getAll(); });
  if (rows) {
    rows.sort(function (a, b) { return (a.added || 0) - (b.added || 0); });
    for (const r of rows) MARCH_Add(r);
  }
  for (const k in MARCH_assign) if (!MARCH_Find(MARCH_assign[k])) delete MARCH_assign[k];
  MARCH_dbTried = true;   // marchas guardadas ya leídas (o no hay almacenamiento)
  if (MARCH_list.length) {
    console.log('Marchas cargadas: ' + MARCH_list.map(function (m) { return m.name; }).join(', '));
    if (S_currentMusic && MARCH_assign[S_currentMusic]) MUS_Play(S_currentMusic, S_musicLoop);
  }
}

// --- Carga de archivos ----------------------------------------------------------------------
function MARCH_KindOf(name, type) {
  const ext = ((/\.([a-z0-9]+)$/i.exec(name) || [])[1] || '').toLowerCase();
  if (/^(mid|midi|kar|rmi|smf)$/.test(ext) || /midi/.test(type || '')) return 'midi';
  if (/^(mp3|ogg|oga|opus|wav|m4a|aac|flac|webm|weba)$/.test(ext) || /^audio\//.test(type || '')) return 'audio';
  return null;
}

function MARCH_CleanName(name) {
  let s = String(name).replace(/\.[a-z0-9]+$/i, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!s) s = 'Marcha';
  return s.charAt(0).toUpperCase() + s.slice(1, 60);
}

// Abre el selector de archivos (necesita el gesto del jugador: se llama desde
// el menú, dentro de los segundos de activación que concede el navegador).
function MARCH_PickFiles() {
  try {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.multiple = true;
    inp.accept = '.mid,.midi,.kar,.rmi,.mp3,.ogg,.oga,.opus,.wav,.m4a,.aac,.flac,.webm,audio/*';
    inp.style.display = 'none';
    inp.addEventListener('change', function () {
      const files = inp.files;
      inp.remove();
      if (files && files.length) MARCH_LoadFiles(files);
    });
    document.body.appendChild(inp);
    inp.click();
  } catch (e) {
    M_StartMessage('Este navegador no permite elegir archivos.\nArrastre los archivos a la ventana.\n\n(Presione una tecla)', null, false);
  }
}

function MARCH_ReadFile(f) {
  if (f.arrayBuffer) return f.arrayBuffer();
  return new Promise(function (resolve, reject) {
    const r = new FileReader();
    r.onload = function () { resolve(r.result); };
    r.onerror = reject;
    r.readAsArrayBuffer(f);
  });
}

// Asigna una marcha nueva: por su nombre (Yungay, Séptimo, Estandartes) o a
// la primera batalla que aún tenga la música del juego.
function MARCH_AutoAssign(m) {
  const slots = [];
  for (const rule of MARCH_AUTO) {
    if (!rule[0].test(m.name)) continue;
    for (const s of rule[1]) if (!MARCH_assign[s]) slots.push(s);
    if (!slots.length) slots.push(rule[1][0]);
    break;
  }
  if (!slots.length) {
    for (const s of MARCH_BATTLES) if (!MARCH_assign[s]) { slots.push(s); break; }
  }
  for (const s of slots) MARCH_assign[s] = m.id;
  return slots;
}

function MARCH_SlotName(slot) {
  for (const s of MARCH_SLOTS) if (s[0] === slot) return s[1];
  return slot;
}

// Recorta un texto para que quepa en w píxeles lógicos.
function MARCH_Fit(text, w) {
  if (V_StringWidth(text, false) <= w) return text;
  let s = text;
  while (s.length > 1 && V_StringWidth(s + '...', false) > w) s = s.slice(0, -1);
  return s.trim() + '...';
}

async function MARCH_LoadFiles(files) {
  const lines = [], bad = [];
  const before = S_currentMusic ? MARCH_assign[S_currentMusic] : null;
  for (const f of Array.prototype.slice.call(files || [])) {
    const kind = MARCH_KindOf(f.name, f.type);
    if (!kind || f.size > MARCH_MAXSIZE) { bad.push(f.name); continue; }
    let data;
    try { data = await MARCH_ReadFile(f); } catch (e) { bad.push(f.name); continue; }
    const rec = { id: 'm' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36),
      name: MARCH_CleanName(f.name), kind: kind, data: data, added: Date.now() };
    const m = MARCH_Add(rec);
    if (!m) { bad.push(f.name); continue; }
    if (kind === 'audio' && !(await MARCH_Decode(m))) {
      MARCH_list.splice(MARCH_list.indexOf(m), 1);
      bad.push(f.name);
      continue;
    }
    await MARCH_Store('readwrite', function (s) { return s.put(rec); });
    const slots = MARCH_AutoAssign(m);
    MarchMenu.build();
    lines.push(MARCH_Fit(m.name, 150) + (slots.length ? ': ' + slots.map(MARCH_SlotName).join(' y ') : ''));
  }
  MARCH_SaveAssign();
  MarchMenu.build();
  // Abre el menú de marchas (si se soltaron los archivos en pleno juego).
  if (!menuactive || currentMenu !== MarchMenu) {
    menuactive = true;
    if (typeof I_ReleasePointerLock === 'function') I_ReleasePointerLock();
    M_SetupNextMenu(MarchMenu);
  }
  let msg = lines.length ? (lines.length === 1 ? 'Marcha cargada' : lines.length + ' marchas cargadas') + ':\n' + lines.slice(0, 6).join('\n') : '';
  if (bad.length) msg += (msg ? '\n\n' : '') + 'No se pudo leer: ' + MARCH_Fit(bad.join(', '), 190);
  if (lines.length && !MARCH_db) msg += '\n\nEl navegador no permite guardarlas:\nvalen hasta cerrar el juego.';
  M_StartMessage(msg + '\n\n(Presione una tecla)', null, false);
  if (S_currentMusic && MARCH_assign[S_currentMusic] !== before) MUS_Play(S_currentMusic, S_musicLoop);
}

// --- Menú ------------------------------------------------------------------------------------
function MARCH_MenuValues() {
  return ['la del juego'].concat(MARCH_list.map(function (m) { return MARCH_Fit(m.name, 150); }));
}

function MARCH_SlotIndex(slot) {
  const id = MARCH_assign[slot];
  for (let i = 0; i < MARCH_list.length; i++) if (MARCH_list[i].id === id) return i + 1;
  return 0;
}

// Cambia la marcha de una ranura y la hace sonar para escucharla.
function MARCH_SetSlot(slot, i) {
  if (i <= 0 || i > MARCH_list.length) delete MARCH_assign[slot];
  else MARCH_assign[slot] = MARCH_list[i - 1].id;
  MARCH_SaveAssign();
  MARCH_previewing = slot !== S_currentMusic;
  MUS_Play(slot, true);
}

// Al salir del menú vuelve la música del momento.
function MARCH_EndPreview() {
  if (!MARCH_previewing) return;
  MARCH_previewing = false;
  if (S_currentMusic) MUS_Play(S_currentMusic, S_musicLoop);
  else MUS_Stop();
}

async function MARCH_RemoveAll() {
  MARCH_list = [];
  MARCH_assign = {};
  MARCH_SaveAssign();
  MarchMenu.build();
  await MARCH_Store('readwrite', function (s) { return s.clear(); });
  MARCH_previewing = false;
  if (S_currentMusic) MUS_Play(S_currentMusic, S_musicLoop);
}

function MARCH_Footer() {
  if (!MARCH_list.length) return 'También puede arrastrar los archivos a la ventana.';
  const n = MARCH_list.length;
  return n + (n === 1 ? ' marcha' : ' marchas') + (MARCH_db ? ', guardadas en este navegador.' : ', solo durante esta sesión.');
}
