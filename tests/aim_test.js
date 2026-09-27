// Prueba de la puntería moderna en Chromium: mirada vertical con el ratón
// (eventos ev_mouse), disparo exacto hacia la retícula (sin autoapuntado),
// aumento de las miras con el clic derecho o Z, arma baja al recargar el
// Comblain y resolución automática. Guarda capturas y falla si algo no cumple.
//   node tests/aim_test.js [carpeta]
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
  let failed = 0;
  const check = function (ok, msg) { console.log((ok ? 'OK    ' : 'FALLA ') + msg); if (!ok) failed++; };
  const shot = function (name) { return page.locator('#screen').screenshot({ path: path.join(outdir, 'aim_' + name + '.png') }); };

  const scr = await page.evaluate('({ w: SCREENWIDTH, h: SCREENHEIGHT, s: SCALE })');
  check(scr.s >= 3, 'resolución automática: ' + scr.w + 'x' + scr.h + ' (escala ' + scr.s + ')');

  await page.evaluate('G_InitNew(sk_medium, 1); players[0].cheats |= CF_GODMODE | CF_NOTARGET; hu_big = null;');
  await page.waitForTimeout(1500);

  // 1) Mirada vertical con el ratón: el horizonte baja al mirar arriba.
  const look = await page.evaluate(function () {
    const p = players[0];
    const before = p.pitch;
    D_PostEvent({ type: ev_mouse, data1: 0, data2: 0, data3: -240 });
    return before;
  });
  await page.waitForTimeout(300);
  const lookAfter = await page.evaluate('({ pitch: players[0].pitch, shift: centery - basecentery })');
  check(lookAfter.pitch > look + 0.05 && lookAfter.shift > 0, 'mirar arriba con el ratón: pendiente ' + lookAfter.pitch.toFixed(3) + ' rad, horizonte desplazado ' + Math.round(lookAfter.shift) + ' px');
  await shot('mirar_arriba');
  await page.keyboard.down('End'); await page.waitForTimeout(400); await page.keyboard.up('End');
  const centered = await page.evaluate('players[0].pitch');
  check(Math.abs(centered) < 0.01, 'tecla Fin centra la mirada (' + centered.toFixed(4) + ')');

  // 2) Disparo hacia la retícula, en campo abierto (pampa de Dolores): un
  //    blanco a 500 unidades en el suelo y otro 120 más alto. Apuntando al
  //    centro de cada uno el Comblain (tiro exacto) lo alcanza; con la mirada
  //    horizontal, el blanco alto no recibe el tiro (no hay autoapuntado).
  await page.evaluate('G_InitNew(sk_medium, 2); players[0].cheats |= CF_GODMODE | CF_NOTARGET; hu_big = null;');
  await page.waitForTimeout(1200);
  const fire = await page.evaluate(function () {
    const p = players[0], mo = p.mo;
    P_UnsetThingPosition(mo); mo.x = -1000; mo.y = -850; P_SetThingPosition(mo);
    mo.z = mo.floorz = mo.subsector.sector.floorheight; mo.momx = mo.momy = mo.momz = 0;
    p.viewz = mo.z + VIEWHEIGHT; p.freeaim = true; mo.angle = 0;
    const others = [];
    for (let th = thinkercap.next; th !== thinkercap; th = th.next) {
      if (th.isMobj && th !== mo && (th.flags & MF_SHOOTABLE)) { others.push(th); th.flags &= ~MF_SHOOTABLE; }
    }
    const shoot = function (target, pitch) {
      target.health = 1000;
      p.pitch = pitch;
      p.ammo[am_fusil] = 50;
      A_FireComblain(p, p.psprites[ps_weapon]);
      return target.health < 1000;
    };
    const res = {};
    const low = P_SpawnMobj(-500, -850, 0, MT.GUARDIA);
    res.low = shoot(low, Math.atan2(low.z + low.height / 2 - p.viewz, 500));
    P_RemoveMobj(low);
    const high = P_SpawnMobj(-500, -850, 0, MT.GUARDIA);
    high.flags |= MF_NOGRAVITY; high.z = 120;
    res.high = shoot(high, Math.atan2(high.z + high.height / 2 - p.viewz, 500));
    res.level = shoot(high, 0);
    P_RemoveMobj(high);
    for (const th of others) th.flags |= MF_SHOOTABLE;
    p.pitch = 0;
    return res;
  });
  check(fire.low, 'disparo al centro de la retícula alcanza a un blanco en el suelo a 500 u');
  check(fire.high, 'mirando arriba se alcanza a un blanco 120 u más alto');
  check(!fire.level, 'con la mirada horizontal el tiro pasa bajo el blanco alto (sin autoapuntado)');
  await page.evaluate('G_InitNew(sk_medium, 1); players[0].cheats |= CF_GODMODE | CF_NOTARGET; hu_big = null;');
  await page.waitForTimeout(1200);
  await page.evaluate('players[0].pitch = 0; players[0].ammo[am_fusil] = 50;');

  // 3) Miras: Z mantiene el arma encarada; el aumento llega a 1,6 con el Comblain.
  await page.keyboard.press('Digit3');
  await page.waitForTimeout(900);
  await page.keyboard.down('KeyZ');
  await page.waitForTimeout(500);
  const ads = await page.evaluate('({ zoom: R_curZoom, ads: players[0].ads, sprite: R_ADSSpriteFor(players[0].psprites[ps_weapon].state) })');
  check(ads.zoom > 1.55 && ads.ads === 1 && ads.sprite >= 0, 'miras del Comblain: aumento x' + ads.zoom.toFixed(2) + ', sprite de mira ' + ads.sprite);
  await shot('miras_comblain');
  // Al disparar, el Comblain se baja para recargar y luego vuelve a encararse.
  await page.keyboard.down('ControlLeft'); await page.waitForTimeout(80); await page.keyboard.up('ControlLeft');
  await page.waitForTimeout(700);
  const reload = await page.evaluate('R_curZoom');
  check(reload < 1.2, 'al recargar se baja el arma (aumento x' + reload.toFixed(2) + ')');
  await page.waitForTimeout(1600);
  const back = await page.evaluate('R_curZoom');
  check(back > 1.55, 'recargado, vuelve a las miras (x' + back.toFixed(2) + ')');
  await page.keyboard.up('KeyZ');
  await page.waitForTimeout(500);
  check(await page.evaluate('R_curZoom === 1'), 'al soltar, vista normal');

  // 4) Clic derecho con la Gatling y con el revólver.
  await page.evaluate('players[0].weaponowned[wp_gatling] = true;');
  for (const w of [['4', 1.3, 'gatling'], ['2', 1.25, 'revolver']]) {
    await page.keyboard.press('Digit' + w[0]);
    await page.waitForTimeout(1000);
    const box = await page.locator('#screen').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down({ button: 'right' });
    await page.waitForTimeout(500);
    const z = await page.evaluate('R_curZoom');
    check(Math.abs(z - w[1]) < 0.02, 'clic derecho con ' + w[2] + ': aumento x' + z.toFixed(2));
    await shot('miras_' + w[2]);
    await page.mouse.up({ button: 'right' });
    await page.waitForTimeout(400);
  }

  // 5) El corvo no tiene miras.
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(1000);
  await page.keyboard.down('KeyZ'); await page.waitForTimeout(400);
  check(await page.evaluate('R_curZoom === 1'), 'el corvo no se encara');
  await page.keyboard.up('KeyZ');

  // 6) Tiempo de cuadro a esta resolución.
  const ms = await page.evaluate(function () {
    const t0 = performance.now();
    for (let i = 0; i < 20; i++) { R_RenderPlayerView(players[0]); I_FinishUpdate(); }
    return (performance.now() - t0) / 20;
  });
  console.log('cuadro (render + volcado): ' + ms.toFixed(1) + ' ms');

  if (errors.length) { console.log('ERRORES (' + errors.length + '):\n' + errors.slice(0, 30).join('\n')); failed++; }
  console.log(failed ? failed + ' comprobaciones fallidas' : 'todas las comprobaciones OK');
  await browser.close();
  process.exit(failed ? 1 : 0);
})().catch(function (e) { console.error(e); process.exit(1); });
