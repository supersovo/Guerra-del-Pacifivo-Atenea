// Hojas de contacto de sprites (Chromium sin interfaz) para revisión visual.
'use strict';
const path = require('path');
const fs = require('fs');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }

function rots(base, frames) { return frames.split('').map(function (f) { return [1, 2, 3, 4, 5, 6, 7, 8].map(function (r) { return base + f + r; }); }); }
function zero(base, frames) { return [frames.split('').map(function (f) { return base + f + '0'; })]; }

(async function () {
  const outdir = process.argv[2] || path.join(__dirname, 'out');
  fs.mkdirSync(outdir, { recursive: true });
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const errors = [];
  page.on('pageerror', function (e) { errors.push(String(e.stack || e)); });
  page.on('console', function (m) { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  await page.goto('file://' + path.join(__dirname, 'sprite_sheet.html'));
  await page.waitForFunction('window.SS && window.SS.ready', null, { timeout: 120000 });
  const sheets = {
    infantry: [].concat(rots('CHIL', 'AEFG'), rots('GUAR', 'AE'), rots('BOLI', 'AE')),
    enemies2: [].concat(rots('BAYO', 'AEG'), rots('OFIC', 'AFGH'), rots('DINA', 'AE')),
    cavalry: [].concat(rots('HUSA', 'ACEG'), rots('ARTI', 'AC'), rots('ARTC', 'A')),
    deaths: [].concat(zero('CHIL', 'HIJKL'), zero('CHIL', 'MNOPQ'), zero('GUAR', 'HIJKL'), zero('BAYO', 'IJKLM'), zero('HUSA', 'IJKLMN'), zero('OFIC', 'JKLMNO')),
    items: [].concat(zero('CFUS', 'A').concat([]), [['CFUSA0', 'GATPA0', 'DINIA0', 'CREVA0', 'CRVBA0', 'CRTFA0', 'CAJFA0', 'DMTAA0']],
      [['DMTCA0', 'CARAA0', 'BOTIA0', 'CHARA0', 'ESCAA0', 'ESTAA0', 'BANDA0', 'CHUPA0']], [['PLANA0', 'MOCHA0', 'BARRA0', 'BARRC0', 'EXPLA0', 'EXPLC0', 'PUFFA0', 'HUMOB0']],
      [['BALAA0', 'DINMA0', 'BLUDA0', 'TAMAA0', 'POSTA0', 'FAROA0', 'SACOA0', 'CAJAA0']], [['RUEDA0', 'ANCLA0', 'FOGAA0', 'FUEGA0', 'HUMCA0', 'MASTA0', 'MASTC0', 'CANKA1']],
      [['CANKA2', 'CANLA1', 'CANRA1', 'CANRA2', 'BOTEA1', 'BOTEA3', 'CARRA2', 'PIPAA2']]),
    weapons: [['CORVA0', 'CORVB0', 'CORVC0', 'CORVD0'], ['REVOA0', 'REVOB0', 'REVOC0', 'RFLAA0'], ['COMBA0', 'COMBB0', 'COMBC0', 'COMBD0'], ['COMBE0', 'CFLAA0', 'CFLAB0', 'GATLA0'], ['GATLB0', 'GFLAA0', 'DINWA0', 'DINWB0'], ['DINWC0', 'DINWD0', 'DINWE0']],
    miras: [['COMZA0', 'CFLZA0', 'CFLZB0'], ['REVZA0', 'REVZB0', 'REVZC0'], ['RFLZA0', 'GATZA0', 'GATZB0'], ['GFLZA0', 'GFLZB0']],
    // Batallas masivas: Colorados de Bolivia, Reserva de Lima y Granaderos a caballo
    masivas: [].concat(rots('COLO', 'AEF'), rots('RESE', 'AEF'), rots('GRAN', 'ACEG')),
    // Desmembramiento: cabeza, brazo y pierna (en el aire A-D, en el suelo E) y troncos
    restos: [].concat(zero('GHCL', 'ABCDE'), zero('GBCO', 'ABCDE'), zero('GPRE', 'ABCDE'),
      [['GTCLA0', 'GTCOA0', 'GTREA0', 'GTGUA0', 'GTBOA0', 'GTHUA0']], zero('GRAN', 'IJKLMNO'), [['HUSAO0', 'ARTIK1', 'ARTCK1']])
  };
  const cells = { infantry: [80, 2], enemies2: [80, 2], cavalry: [130, 1], deaths: [110, 2], items: [170, 1], weapons: [320, 1], miras: [320, 1],
    masivas: [80, 2], restos: [110, 2] };
  for (const k in sheets) {
    const c = cells[k];
    await page.evaluate('SS.draw(' + JSON.stringify(sheets[k]) + ',' + c[0] + ',' + c[1] + ')');
    await page.locator('#sheet').screenshot({ path: path.join(outdir, 'spr_' + k + '.png') });
    console.log('ok', k);
  }
  if (errors.length) console.log('ERRORES:\n' + errors.join('\n'));
  await browser.close();
})();
