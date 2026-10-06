// Prueba del sonido en Chromium: marchas del jugador (MIDI y audio) cargadas
// con el selector de archivos real, asignación por nombre, vista previa,
// guardado en IndexedDB, arrastrar y soltar, render fuera de línea de la banda;
// gritos de los soldados (sintetizados por el juego y oídos desde su posición,
// sin la voz del navegador) y retratos diferidos de la barra de estado.
//   node tests/sound_test.js [carpeta]
// Los archivos MIDI y WAV de la prueba se generan aquí: son escalas y acordes
// de ensayo, no las marchas históricas.
'use strict';
const path = require('path');
const fs = require('fs');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }

// --- Archivos de ensayo ------------------------------------------------------------------
function vlq(n) { const b = [n & 0x7f]; while ((n >>= 7)) b.unshift((n & 0x7f) | 0x80); return b; }
function track(events) {
  const body = [];
  for (const e of events) body.push(...vlq(e[0]), ...e.slice(1));
  body.push(0, 0xff, 0x2f, 0);
  const n = body.length;
  return Buffer.from([0x4d, 0x54, 0x72, 0x6b, n >>> 24, (n >> 16) & 255, (n >> 8) & 255, n & 255, ...body]);
}
// Tipo 1: pista de tempos (120 negras por minuto y 100 desde el tercer compás
// si tempoChange), corneta con estado continuo, tuba y percusión.
function makeMidi(file, tempoChange) {
  const tpq = 480;
  const t0 = [[0, 0xff, 0x51, 3, 0x07, 0xa1, 0x20]];
  if (tempoChange) t0.push([tpq * 8, 0xff, 0x51, 3, 0x09, 0x27, 0xc0]);
  const lead = [[0, 0xc0, 56]];
  const keys = [67, 72, 76, 72, 67, 72, 76, 79, 77, 76, 74, 72, 74, 67, 71, 74];
  for (let r = 0; r < 2; r++) {
    keys.forEach(function (k, i) {
      lead.push(r === 0 && i === 0 ? [0, 0x90, k, 100] : [0, k, 100]);   // estado continuo
      lead.push([tpq / 2, k, 0]);
    });
  }
  const bass = [[0, 0xc1, 58]];
  for (const k of [48, 43, 48, 43, 41, 48, 43, 50, 48, 43, 48, 43, 41, 43, 48, 48]) bass.push([0, 0x91, k, 90], [tpq, 0x81, k, 64]);
  const drums = [[0, 0x99, 49, 110], [0, 0x89, 49, 0]];
  for (let i = 0; i < 32; i++) { const k = i % 2 ? 38 : 36; drums.push([0, 0x99, k, i % 2 ? 80 : 110], [tpq / 2, 0x89, k, 0]); }
  const head = Buffer.from([0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 1, 0, 4, tpq >> 8, tpq & 255]);
  fs.writeFileSync(file, Buffer.concat([head, track(t0), track(lead), track(bass), track(drums)]));
}
function makeWav(file, secs) {
  const sr = 22050, n = Math.floor(sr * secs);
  const w = Buffer.alloc(44 + n * 2);
  w.write('RIFF', 0); w.writeUInt32LE(36 + n * 2, 4); w.write('WAVE', 8); w.write('fmt ', 12);
  w.writeUInt32LE(16, 16); w.writeUInt16LE(1, 20); w.writeUInt16LE(1, 22); w.writeUInt32LE(sr, 24);
  w.writeUInt32LE(sr * 2, 28); w.writeUInt16LE(2, 32); w.writeUInt16LE(16, 34); w.write('data', 36); w.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) w.writeInt16LE(Math.round(Math.sin(2 * Math.PI * 440 * i / sr) * 12000), 44 + i * 2);
  fs.writeFileSync(file, w);
}

(async function () {
  const outdir = process.argv[2] || path.join(__dirname, 'out');
  const media = path.join(outdir, 'ensayo');
  fs.mkdirSync(media, { recursive: true });
  makeMidi(path.join(media, 'Himno de Yungay.mid'), true);
  makeMidi(path.join(media, 'Adios al Septimo de Linea.mid'), false);
  makeMidi(path.join(media, 'marcha_de_ensayo.mid'), false);
  makeWav(path.join(media, 'Los Viejos Estandartes.wav'), 1.5);
  fs.writeFileSync(path.join(media, 'roto.mid'), 'esto no es un MIDI');

  const browser = await playwright.chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', function (e) { errors.push('pageerror: ' + String(e.stack || e)); });
  page.on('console', function (m) {
    if (m.type() === 'error' || (m.type() === 'warning' && !/^Marcha "Roto"/.test(m.text()))) errors.push(m.type() + ': ' + m.text());
  });
  // Centinela: el juego ya no debe usar la voz del navegador (Web Speech API).
  await page.addInitScript(function () {
    window.__tts = [];
    const synth = {
      speaking: false, pending: false,
      getVoices: function () { return [{ name: 'Microsoft Alex Online (Natural) - Spanish (Peru)', lang: 'es-PE', localService: false }]; },
      speak: function (u) { window.__tts.push(u.text); },
      cancel: function () {}, addEventListener: function () {}
    };
    Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
    window.SpeechSynthesisUtterance = function (text) { this.text = text; };
  });
  // Espía de los gritos: qué lump suena, desde qué soldado, con qué tono y filtro.
  const spyVoices = function () {
    return page.evaluate(function () {
      if (window.__shouts) return;
      window.__shouts = [];
      window.__started = [];
      const sv = S_StartVoice, is = I_StartSound;
      S_StartVoice = function (origin, name, pitch) {
        const ch = sv(origin, name, pitch);
        window.__shouts.push({ name: name, acc: origin && origin.info && origin.info.voice, pitch: pitch, ok: !!ch,
          lp: ch && ch.handle && ch.handle.filter ? ch.handle.filter.frequency.value : 0 });
        return ch;
      };
      I_StartSound = function (lump) { window.__started.push(lump); return is.apply(null, arguments); };
    });
  };
  let failed = 0;
  const check = function (ok, msg) { console.log((ok ? 'OK    ' : 'FALLA ') + msg); if (!ok) failed++; };
  const shot = function (name) { return page.locator('#screen').screenshot({ path: path.join(outdir, 'sonido_' + name + '.png') }); };
  const boot = async function () {
    await page.goto('file://' + path.join(__dirname, '..', 'index.html'));
    await page.waitForFunction('typeof gamestate !== "undefined" && gamestate === GS_DEMOSCREEN && document.getElementById("boot").style.display === "none" && MARCH_dbTried', null, { timeout: 180000 });
  };
  await boot();

  // 1) Fundición en segundo plano: retratos y sprites quedan pendientes al
  //    llegar a la portada y se construyen mientras se la mira.
  const pending = "(function () { let f = 0, s = 0, v = 0; for (const l of lumpinfo) if (l.build) { if (/^STF/.test(l.name)) f++; else if (/^DSV/.test(l.name)) v++; else if (l.kind === 'sprite') s++; } return { f: f, s: s, v: v }; })()";
  const pend0 = await page.evaluate(pending);
  const tw = Date.now();
  await page.waitForFunction('W_WarmProgress() >= 1', null, { timeout: 120000, polling: 250 });
  const pend1 = await page.evaluate(pending);
  const face = await page.evaluate("(function () { const p = W_CacheLumpName('STFOUCH3'); return { w: p.width, h: p.height, d: p.density }; })()");
  check(pend0.f > 20 && pend0.s > 1000 && pend0.v > 200 && pend1.f === 0 && pend1.s === 0 && pend1.v === 0,
    'fundición en segundo plano: al llegar a la portada faltaban ' + pend0.f + ' retratos, ' + pend0.s + ' cuadros de sprite y ' + pend0.v +
    ' gritos; todo listo en ' + ((Date.now() - tw) / 1000).toFixed(1) + ' s');
  check(face.w === 32 && face.h === 30 && face.d === 4, 'retrato de 32x30 a densidad 4 (' + JSON.stringify(face) + ')');

  // 2) Gritos: frases sintetizadas por el juego, tres voces cada una, y prueba desde el menú.
  const vx = await page.evaluate(function () {
    const out = { phrases: VX_TABLE.length, voices: VX_NVOICES, accents: {}, bad: [] };
    for (const e of VX_TABLE) out.accents[e.acc] = (out.accents[e.acc] || 0) + 1;
    const probe = [['pe', 'death', '¡Asu mare!'], ['bo', 'sight', '¡Jallalla, Bolivia!'], ['cl', 'pain', '¡Puchas!']];
    out.probe = probe.map(function (p) {
      const id = VX_Find(p[0], p[1], p[2]);
      return [0, 1, 2].map(function (v) {
        const snd = W_CacheLumpName(VX_LumpName(id, v));
        let sum = 0, peak = 0;
        for (let i = 0; i < snd.pcm16.length; i++) { const x = snd.pcm16[i] / 32767; sum += x * x; peak = Math.max(peak, Math.abs(x)); }
        return { len: +(snd.pcm16.length / snd.rate).toFixed(2), rms: +Math.sqrt(sum / snd.pcm16.length).toFixed(3), peak: +peak.toFixed(2) };
      });
    });
    return out;
  });
  check(vx.phrases >= 80 && vx.voices === 3 && vx.accents.pe > 20 && vx.accents.bo > 15 && vx.accents.cl > 15,
    vx.phrases + ' frases gritadas en ' + vx.voices + ' voces ' + JSON.stringify(vx.accents));
  const flat = [].concat.apply([], vx.probe);
  check(flat.every(function (p) { return p.len > 0.25 && p.len < 2.5 && p.rms > 0.08 && p.peak > 0.5 && p.peak <= 0.95; }) &&
    new Set(flat.map(function (p) { return p.len; })).size > 3, 'cada voz suena distinta: ' + vx.probe.map(function (v) { return v.map(function (p) { return p.len + ' s'; }).join('/'); }).join('  '));
  check(!!(await page.evaluate('MARCH_db')), 'IndexedDB disponible en file://');
  await page.keyboard.press('Shift');   // gesto: desbloquea el audio
  await spyVoices();
  await page.evaluate('M_StartControlPanel(); M_SetupNextMenu(SoundMenu); itemOn = 4;');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  await shot('probar_voces');
  const demoMsg = await page.evaluate('messageToPrint');
  await page.waitForTimeout(4200);
  const demo = (await page.evaluate('window.__started.splice(0)')).filter(function (l) { return /^DSV/.test(l); });
  check(/Peruano: ¡Asu mare!/.test(demoMsg || '') && /Boliviano: ¡Chuta, me han dado!/.test(demoMsg || '') && /Chileno: ¡Viva Chile!/.test(demoMsg || '') &&
    demo.length === 3 && demo.every(function (l) { return /^DSV\d{4}$/.test(l); }), 'probar las voces: ' + demo.join(' ') + ' (' + String(demoMsg).split('\n').slice(0, 3).join(' · ') + ')');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);

  // 3) Marchas: selector de archivos desde el menú (Enter sobre "Cargar...").
  await page.evaluate('M_SetupNextMenu(MarchMenu);');
  await page.waitForTimeout(200);
  await shot('marchas_vacio');
  const chooserP = page.waitForEvent('filechooser', { timeout: 5000 }).catch(function () { return null; });
  await page.keyboard.press('Enter');
  const chooser = await chooserP;
  check(!!chooser && chooser.isMultiple(), 'el selector de archivos se abre desde el menú, con selección múltiple');
  if (chooser) {
    await chooser.setFiles(['Himno de Yungay.mid', 'Adios al Septimo de Linea.mid', 'Los Viejos Estandartes.wav', 'marcha_de_ensayo.mid', 'roto.mid']
      .map(function (f) { return path.join(media, f); }));
  }
  await page.waitForFunction('MARCH_list.length >= 4 && messageToPrint', null, { timeout: 10000 }).catch(function () {});
  await shot('marchas_cargadas');
  const st = await page.evaluate(function () {
    const by = {};
    for (const s of MARCH_SLOTS) { const m = MARCH_Find(MARCH_assign[s[0]]); if (m) by[s[0]] = m.name; }
    return { n: MARCH_list.length, by: by, msg: messageToPrint, playing: MUS_state && MUS_state.march ? MUS_state.march.name : null };
  });
  check(st.n === 4, 'cuatro marchas cargadas; el archivo dañado se rechaza');
  check(st.by.M_TITLE === 'Himno de Yungay' && st.by.M_FINAL === 'Himno de Yungay', 'Yungay: portada y final');
  check(st.by.M_BRIEF === 'Adios al Septimo de Linea', 'Séptimo de Línea: parte de operaciones');
  check(st.by.M_INTER === 'Los Viejos Estandartes', 'Estandartes: intermedio');
  check(st.by.M_E1M1 === 'Marcha de ensayo', 'otra marcha: primera batalla');
  check(/No se pudo leer: roto\.mid/.test(st.msg || ''), 'aviso del archivo dañado');
  check(st.playing === 'Himno de Yungay', 'en la portada suena la marcha asignada');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  await shot('marchas_menu');
  const i1 = await page.evaluate('MUS_state.idx');
  await page.waitForTimeout(1500);
  const i2 = await page.evaluate('MUS_state.idx');
  check(i2 > i1, 'la banda avanza por la partitura (nota ' + i1 + ' -> ' + i2 + ')');
  await page.evaluate('itemOn = 6;');   // III · Tacna
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(400);
  const pv = await page.evaluate('({ slot: MUS_state && MUS_state.slot, pv: MARCH_previewing })');
  check(pv.slot === 'M_TACNA' && pv.pv, 'al elegir la marcha de Tacna suena para escucharla');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const back = await page.evaluate('({ slot: MUS_state && MUS_state.slot, pv: MARCH_previewing })');
  check(back.slot === 'M_TITLE' && !back.pv, 'al salir del menú vuelve la música de la portada');
  const au = await page.evaluate("(function () { MUS_Play('M_INTER', true); const m = MUS_state.march; return { kind: m.kind, dur: m.buffer ? m.buffer.duration : 0 }; })()");
  check(au.kind === 'audio' && Math.abs(au.dur - 1.5) < 0.05, 'audio decodificado (' + au.dur.toFixed(2) + ' s) para el intermedio');
  const rnd = await page.evaluate(async function () {
    const m = MARCH_Find(MARCH_assign.M_TITLE);
    const off = new OfflineAudioContext(1, 44100 * 9, 44100);
    const save = I_audioCtx;
    I_audioCtx = off;
    const dest = off.createGain();
    dest.connect(off.destination);
    for (const n of m.song.notes) MARCH_Event(dest, n, n.t + 0.05, m.song.gain);
    I_audioCtx = save;
    const d = (await off.startRendering()).getChannelData(0);
    let peak = 0, sum = 0, bad = 0;
    for (let i = 0; i < d.length; i++) { const v = d[i]; if (v !== v) bad++; else { peak = Math.max(peak, Math.abs(v)); sum += v * v; } }
    return { peak: peak, rms: Math.sqrt(sum / d.length), bad: bad, len: m.song.length };
  });
  check(Math.abs(rnd.len - 8.8) < 0.05, 'mapa de tempos: la marcha dura ' + rnd.len.toFixed(2) + ' s (120 y luego 100 negras por minuto)');
  check(rnd.bad === 0 && rnd.peak > 0.1 && rnd.peak < 1.2, 'render de la banda: pico ' + rnd.peak.toFixed(2) + ', rms ' + rnd.rms.toFixed(3));

  // 4) Guardado: tras recargar siguen las marchas y sus asignaciones.
  await boot();
  await page.keyboard.press('Shift');   // gesto: desbloquea el audio
  await spyVoices();
  const per = await page.evaluate('({ n: MARCH_list.length, t: MARCH_Find(MARCH_assign.M_TITLE) && MARCH_Find(MARCH_assign.M_TITLE).name, tacna: !!MARCH_assign.M_TACNA })');
  check(per.n === 4 && per.t === 'Himno de Yungay' && per.tacna, 'tras recargar siguen las 4 marchas y sus asignaciones');

  // 5) Voces en combate (Chorrillos, fuego de la Gatling) y soltar un archivo en pleno juego.
  await page.evaluate('M_ClearMenus(); G_InitNew(sk_medium, 5); players[0].cheats |= CF_GODMODE; hu_big = null; hu_queue = [];');
  await page.waitForTimeout(1500);
  await page.evaluate(function () {
    const p = players[0], mo = p.mo;
    let best = null, bd = 1e9;
    for (let th = thinkercap.next; th !== thinkercap; th = th.next) {
      if (!th.isMobj || !th.info || !th.info.voice || th.info.voice === 'cl' || th.health <= 0) continue;
      const d = P_AproxDistance(th.x - mo.x, th.y - mo.y);
      if (d < bd) { bd = d; best = th; }
    }
    if (best) {
      P_UnsetThingPosition(mo);
      const a = Math.atan2(best.y - mo.y, best.x - mo.x);
      mo.x = best.x - Math.cos(a) * 420; mo.y = best.y - Math.sin(a) * 420;
      P_SetThingPosition(mo);
      mo.z = mo.floorz = mo.subsector.sector.floorheight; p.viewz = mo.z + VIEWHEIGHT;
      mo.angle = R_PointToAngle2(mo.x, mo.y, best.x, best.y);
    }
    p.weaponowned[3] = true; p.ammo[1] = 600; p.pendingweapon = 3;
  });
  await page.keyboard.down('ControlLeft');
  let sub = false;
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(1000);
    if (!sub && (await page.evaluate('!!(hu_voice && hu_voice.text)'))) { await shot('voz_subtitulo'); sub = true; }
  }
  await page.keyboard.up('ControlLeft');
  const said = await page.evaluate('window.__shouts.splice(0)');
  const accs = {};
  for (const s of said) if (s.ok) accs[s.acc] = (accs[s.acc] || 0) + 1;
  const texts = await page.evaluate(function (names) {
    return names.map(function (n) { const e = VX_TABLE[parseInt(n.slice(1, 4), 10)]; return e ? e.acc + ' ' + e.text : n; });
  }, said.slice(0, 8).map(function (s) { return s.name; }));
  console.log('      ' + texts.join(' · '));
  check(said.filter(function (s) { return s.ok; }).length >= 4 && accs.pe >= 1, 'gritos en combate desde los soldados: ' + said.length + ' frases ' + JSON.stringify(accs));
  check(sub, 'subtítulo de las voces en pantalla');
  const tts = await page.evaluate('window.__tts.length');
  check(said.every(function (s) { return s.pitch > 0.9 && s.pitch < 1.1 && (!s.ok || (s.lp >= 2000 && s.lp <= 10000)); }), 'tono propio de cada soldado y filtro de distancia (' +
    said.slice(0, 4).map(function (s) { return s.pitch.toFixed(3) + '/' + Math.round(s.lp) + ' Hz'; }).join(', ') + ')');
  const b64 = fs.readFileSync(path.join(media, 'marcha_de_ensayo.mid')).toString('base64');
  await page.evaluate(function (b) {
    const bin = atob(b), u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const dt = new DataTransfer();
    dt.items.add(new File([u], 'Segunda marcha.mid', { type: 'audio/midi' }));
    window.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, cancelable: true }));
  }, b64);
  await page.waitForFunction('MARCH_list.length === 5 && messageToPrint', null, { timeout: 5000 }).catch(function () {});
  const dr = await page.evaluate('({ menu: menuactive && currentMenu === MarchMenu, e1m2: MARCH_Find(MARCH_assign.M_E1M2) && MARCH_Find(MARCH_assign.M_E1M2).name })');
  check(dr.menu && dr.e1m2 === 'Segunda marcha', 'soltar un MIDI en combate: abre el menú de marchas y lo asigna a Dolores');

  // 6) Quitar las marchas.
  await page.evaluate('messageToPrint = null;');
  await page.evaluate('MARCH_RemoveAll()');
  await boot();
  check(await page.evaluate('MARCH_list.length === 0 && Object.keys(MARCH_assign).length === 0'), 'quitar las marchas vacía IndexedDB y las asignaciones');

  check(tts === 0, 'sin la voz del navegador: ninguna frase leída por speechSynthesis en combate');
  check(errors.length === 0, 'consola sin errores' + (errors.length ? ':\n  ' + errors.join('\n  ') : ''));
  await browser.close();
  console.log(failed ? failed + ' FALLAS' : 'TODO EN ORDEN');
  process.exit(failed ? 1 : 0);
})();
