// Prueba de combate con entrada real de teclado: entra al mapa por el menú
// (Enter), dispara cada arma, avanza y deja correr la batalla en tiempo real.
// Guarda capturas y falla si hay excepciones en la consola.
//   node tests/combat_test.js <carpeta> [mapa]
'use strict';
const path = require('path');
const fs = require('fs');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }

(async function () {
  const outdir = process.argv[2] || path.join(__dirname, 'out');
  const map = parseInt(process.argv[3] || '2', 10);
  fs.mkdirSync(outdir, { recursive: true });
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', function (e) { errors.push('pageerror: ' + String(e.stack || e)); });
  page.on('console', function (m) { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  await page.goto('file://' + path.join(__dirname, '..', 'index.html'));
  await page.waitForFunction('typeof gamestate !== "undefined" && gamestate === GS_DEMOSCREEN && document.getElementById("boot").style.display === "none"', null, { timeout: 180000 });
  await page.locator('#screen').click();
  // Menú principal -> nueva partida por teclado (como un jugador).
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await page.locator('#screen').screenshot({ path: path.join(outdir, 'menu.png') });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  await page.locator('#screen').screenshot({ path: path.join(outdir, 'menu2.png') });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  await page.locator('#screen').screenshot({ path: path.join(outdir, 'menu3.png') });
  const st = await page.evaluate('({ gamestate: gamestate, menu: menuactive })');
  console.log('tras el menú:', JSON.stringify(st));
  // Saltar al mapa pedido (el parte de operaciones se prueba aparte).
  await page.evaluate('M_ClearMenus && M_ClearMenus(); G_InitNew(sk_medium, ' + map + ')');
  await page.waitForTimeout(1500);
  await page.evaluate('players[0].cheats |= CF_GODMODE');
  const shot = async function (name) { await page.locator('#screen').screenshot({ path: path.join(outdir, 'c' + map + '_' + name + '.png') }); };
  // Disparar cada arma.
  const fire = async function (ms) { await page.keyboard.down('ControlLeft'); await page.waitForTimeout(ms); await page.keyboard.up('ControlLeft'); };
  await page.evaluate('players[0].weaponowned.fill(true); players[0].ammo = [100, 100, 20];');
  for (const w of ['3', '4', '2', '1', '5']) {
    await page.keyboard.press('Digit' + w);
    await page.waitForTimeout(700);
    await page.keyboard.down('ControlLeft');
    await page.waitForTimeout(260);
    await shot('arma' + w);
    await page.waitForTimeout(900);
    await page.keyboard.up('ControlLeft');
    await page.waitForTimeout(400);
  }
  await page.keyboard.press('Digit3');
  // Avanzar un poco y girar.
  await page.keyboard.down('KeyW'); await page.waitForTimeout(1500); await page.keyboard.up('KeyW');
  await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(400); await page.keyboard.up('ArrowLeft');
  await shot('avance');
  // Dejar correr la batalla en tiempo real, con capturas.
  for (let k = 0; k < 6; k++) {
    await page.waitForTimeout(5000);
    await fire(300);
    await shot('batalla' + k);
  }
  // Carta militar (automapa).
  await page.keyboard.press('Tab');
  await page.waitForTimeout(500);
  await shot('automapa');
  await page.keyboard.press('Tab');
  const info = await page.evaluate('({ t: Math.round(leveltime / 35), kills: players[0].killcount, total: totalkills, hp: players[0].health, obj: battle.objectives.map(function (o) { return o.done ? 1 : 0; }).join(""), mobjs: (function () { let n = 0; for (let th = thinkercap.next; th !== thinkercap; th = th.next) if (th.isMobj) n++; return n; })() })');
  console.log('estado:', JSON.stringify(info));
  if (errors.length) console.log('ERRORES (' + errors.length + '):\n' + errors.slice(0, 30).join('\n'));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch(function (e) { console.error(e); process.exit(1); });
