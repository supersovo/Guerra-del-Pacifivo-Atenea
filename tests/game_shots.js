// Prueba de humo del juego completo en Chromium sin interfaz: arranca
// index.html, entra a un mapa y toma capturas desde varios puntos de vista
// (con modo dios para que el combate no interrumpa la inspección).
//   node tests/game_shots.js <carpeta> <mapa> [vistas.json]
// vistas.json: [[nombre, x, y, ángulo(grados), esperaMs], ...]
'use strict';
const path = require('path');
const fs = require('fs');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }

(async function () {
  const outdir = process.argv[2] || path.join(__dirname, 'out');
  const map = parseInt(process.argv[3] || '1', 10);
  const views = process.argv[4] ? JSON.parse(fs.readFileSync(process.argv[4], 'utf8')) : [];
  fs.mkdirSync(outdir, { recursive: true });
  const browser = await playwright.chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', function (e) { errors.push('pageerror: ' + String(e.stack || e)); });
  page.on('console', function (m) {
    const t = m.type();
    if (t === 'error' || t === 'warning') errors.push(t + ': ' + m.text());
    else if (/ms\)|cuadros|Listo/.test(m.text())) console.log('  [boot] ' + m.text());
  });
  const t0 = Date.now();
  await page.goto('file://' + path.join(__dirname, '..', 'index.html'));
  await page.waitForFunction('typeof gamestate !== "undefined" && gamestate === GS_DEMOSCREEN && document.getElementById("boot").style.display === "none"', null, { timeout: 180000 });
  console.log('arranque completo en', Date.now() - t0, 'ms');
  await page.waitForTimeout(600);
  await page.locator('#screen').screenshot({ path: path.join(outdir, 'title.png') });
  // Nueva partida directa al mapa (sin el parte de operaciones).
  await page.evaluate('G_InitNew(sk_medium, ' + map + ')');
  await page.waitForTimeout(1200);
  await page.evaluate('players[0].cheats |= CF_GODMODE | CF_NOTARGET');
  await page.locator('#screen').screenshot({ path: path.join(outdir, 'm' + map + '_start.png') });
  const stats = await page.evaluate('({ lines: lines.length, sectors: sectors.length, segs: segs.length, things: (function(){let n=0;for(let t=thinkercap.next;t!==thinkercap;t=t.next) if(t.isMobj) n++; return n;})(), kills: totalkills, objectives: battle ? battle.objectives.length : 0 })');
  console.log('mapa', map, JSON.stringify(stats));
  await page.evaluate(function () {
    window.TP = function (x, y, ang) {
      const p = players[0], mo = p.mo;
      P_UnsetThingPosition(mo);
      mo.x = x; mo.y = y;
      P_SetThingPosition(mo);
      mo.z = mo.floorz = mo.subsector.sector.floorheight;
      mo.ceilingz = mo.subsector.sector.ceilingheight;
      mo.momx = mo.momy = mo.momz = 0;
      mo.angle = DegToBAM(ang);
      mo.oldx = x; mo.oldy = y; mo.oldz = mo.z; mo.oldvalid = false;
      p.viewheight = VIEWHEIGHT; p.deltaviewheight = 0; p.viewz = mo.z + VIEWHEIGHT;
    };
  });
  for (const v of views) {
    await page.evaluate('TP(' + v[1] + ',' + v[2] + ',' + v[3] + ')');
    await page.waitForTimeout(v[4] || 350);
    const fps = await page.evaluate(function () {
      const t0 = performance.now();
      for (let i = 0; i < 10; i++) R_RenderPlayerView(players[0]);
      return Math.round((performance.now() - t0) / 10 * 10) / 10;
    });
    await page.locator('#screen').screenshot({ path: path.join(outdir, 'm' + map + '_' + v[0] + '.png') });
    console.log('vista', v[0], 'render', fps, 'ms');
  }
  if (errors.length) console.log('ERRORES (' + errors.length + '):\n' + errors.slice(0, 40).join('\n'));
  await browser.close();
})().catch(function (e) { console.error(e); process.exit(1); });
