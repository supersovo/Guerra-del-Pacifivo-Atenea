// Capturas de las pantallas de interfaz: portada, menús, parte de
// operaciones, carta militar, intermedio, historia y final.
//   node tests/ui_shots.js <carpeta>
'use strict';
const path = require('path');
const fs = require('fs');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }

(async function () {
  const outdir = process.argv[2] || path.join(__dirname, 'out');
  fs.mkdirSync(outdir, { recursive: true });
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', function (e) { errors.push('pageerror: ' + String(e.stack || e)); });
  page.on('console', function (m) { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  await page.goto('file://' + path.join(__dirname, '..', 'index.html'));
  await page.waitForFunction('typeof gamestate !== "undefined" && gamestate === GS_DEMOSCREEN && document.getElementById("boot").style.display === "none"', null, { timeout: 180000 });
  const shot = async function (name, wait) {
    await page.waitForTimeout(wait || 500);
    await page.locator('#screen').screenshot({ path: path.join(outdir, 'ui_' + name + '.png') });
  };
  await shot('portada', 800);
  await page.evaluate('M_StartControlPanel()');
  await shot('menu');
  await page.evaluate('M_SetupNextMenu(SkillMenu)');
  await shot('dificultad');
  await page.evaluate('M_SetupNextMenu(BattleMenu)');
  await shot('acciones');
  await page.evaluate('M_SetupNextMenu(OptionsMenu)');
  await shot('opciones');
  await page.evaluate('menuPage = 0; M_SetupNextMenu(HistoryMenu)');
  const npages = await page.evaluate('HISTORY_PAGES.length');
  for (let k = 0; k < npages; k++) {
    await page.evaluate('menuPage = ' + k);
    await shot('historia' + (k + 1), 300);
  }
  await page.evaluate('M_ClearMenus(); G_DeferedInitNew(sk_medium, 3, true)');
  await shot('parte_ini', 900);
  await shot('parte', 6000);
  await page.evaluate('WI_BriefingResponder({ type: ev_keydown }); D_StartTitle(); G_DeferedInitNew(sk_medium, 5, true)');
  await shot('parte_lima', 6500);
  // Nivel, carta militar e intermedio.
  await page.evaluate('M_ClearMenus(); G_InitNew(sk_medium, 1)');
  await page.waitForTimeout(3500);   // el derretido de pantalla y unos segundos de vista
  await page.evaluate('players[0].cheats |= CF_GODMODE; AM_Start()');
  await shot('carta', 700);
  await page.evaluate('AM_Stop(); players[0].killcount = 23; players[0].itemcount = 3; G_ExitLevel()');
  await shot('intermedio', 4500);
  // Batalla masiva: carta de Tacna e intermedio de la campaña de Lima.
  await page.evaluate('D_StartTitle(); G_InitNew(sk_medium, 3)');
  await page.waitForTimeout(3000);
  await page.evaluate('players[0].cheats |= CF_GODMODE; AM_Start()');
  await shot('carta_tacna', 700);
  await page.evaluate('AM_Stop(); D_StartTitle(); G_InitNew(sk_medium, 5)');
  await page.waitForTimeout(1500);
  await page.evaluate('players[0].killcount = 140; G_ExitLevel()');
  await shot('intermedio_lima', 4500);
  await page.evaluate('F_StartFinale()');
  await shot('final_texto', 5000);
  await page.evaluate('finalestage = 1; finalecount = 0');
  await shot('final_imagen', 800);
  if (errors.length) console.log('ERRORES (' + errors.length + '):\n' + errors.slice(0, 30).join('\n'));
  else console.log('sin errores');
  await browser.close();
})().catch(function (e) { console.error(e); process.exit(1); });
