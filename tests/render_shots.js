// Prueba de humo del renderizador: carga tests/render_test.html en Chromium
// sin interfaz y guarda capturas desde varios puntos de vista.
'use strict';
const path = require('path');
const fs = require('fs');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }

(async function () {
  const outdir = process.argv[2] || path.join(__dirname, 'out');
  fs.mkdirSync(outdir, { recursive: true });
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage({ viewport: { width: 700, height: 440 } });
  const errors = [];
  page.on('pageerror', function (e) { errors.push(String(e.stack || e)); });
  page.on('console', function (m) { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  await page.goto('file://' + path.join(__dirname, 'render_test.html'));
  await page.waitForFunction('window.RT && window.RT.ready', null, { timeout: 60000 }).catch(function () {});
  const info = await page.evaluate('({ setup: RT.setup, stats: RT.mapstats })').catch(function (e) { return String(e); });
  console.log('info', JSON.stringify(info));
  const views = [
    ['v1_beach_east', -600, 0, 41, 0],
    ['v2_house', 360, -100, 41, 90],
    ['v3_sea', -800, 0, 41, 180],
    ['v4_stairs', 100, -500, 41, 0],
    ['v5_inside', 360, 300, 41, 90],
    ['v6_cliff_top', 1200, 0, 425, 180],
    ['v7_rail', -500, -350, 41, 90]
  ];
  for (const v of views) {
    const dt = await page.evaluate('RT.render(' + v.slice(1).join(',') + ')').catch(function (e) { errors.push(String(e)); return -1; });
    await page.locator('#screen').screenshot({ path: path.join(outdir, v[0] + '.png') });
    console.log(v[0], 'ms', dt);
  }
  if (errors.length) console.log('ERRORES:\n' + errors.join('\n'));
  await browser.close();
})();
