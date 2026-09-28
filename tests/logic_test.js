// Prueba de la lógica de batalla en Chromium: para cada mapa cumple los
// objetivos (elimina las unidades etiquetadas, lleva al jugador a las
// posiciones que lo exigen, cruza las líneas de avance), iza la bandera y
// comprueba que se pasa al intermedio. La simulación se adelanta llamando a
// P_Ticker directamente (35 tics = 1 segundo de juego).
//   node tests/logic_test.js [mapas, p.ej. 1,2,3]
'use strict';
const path = require('path');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }

(async function () {
  const maps = (process.argv[2] || '1,2,3,4,5,6').split(',').map(Number);
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
  const errors = [];
  page.on('pageerror', function (e) { errors.push('pageerror: ' + String(e.stack || e)); });
  page.on('console', function (m) { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  await page.goto('file://' + path.join(__dirname, '..', 'index.html'));
  await page.waitForFunction('typeof gamestate !== "undefined" && gamestate === GS_DEMOSCREEN && document.getElementById("boot").style.display === "none"', null, { timeout: 180000 });
  let failed = 0;
  for (const map of maps) {
    const res = await page.evaluate(function (map) {
      const log = [];
      const T = function (n) { for (let i = 0; i < n; i++) { P_Ticker(); leveltime; } };
      G_InitNew(sk_medium, map);
      const p = players[0];
      p.cheats |= CF_GODMODE;
      const tagOf = function (name) { const t = W_CacheLumpName(MAPLUMPS[map - 1]).tagnames[name]; return t || 0; };
      const alive = function (tag) {
        const out = [];
        for (let th = thinkercap.next; th !== thinkercap; th = th.next) {
          if (th.isMobj && !th.removed && th.tag === tag && th.health > 0 && (th.flags & MF_COUNTKILL)) out.push(th);
        }
        return out;
      };
      const tp = function (x, y, ang) {
        const mo = p.mo;
        P_UnsetThingPosition(mo); mo.x = x; mo.y = y; P_SetThingPosition(mo);
        mo.z = mo.floorz = mo.subsector.sector.floorheight; mo.ceilingz = mo.subsector.sector.ceilingheight;
        mo.momx = mo.momy = 0; mo.angle = DegToBAM(ang || 0);
      };
      let t0 = performance.now(), tics = 0;
      const run = function (n) { const a = performance.now(); T(n); tics += n; return performance.now() - a; };
      let worst = 0;
      for (let i = 0; i < battle.objectives.length; i++) {
        const o = battle.objectives[i];
        if (o.kill) {
          const tag = o.killtag;
          if (o.near) tp(o.near[0], o.near[1], 0);   // las batallas masivas exigen estar en la posición
          // Esperar a que aparezcan todas las oleadas pendientes con esa etiqueta.
          for (let guard = 0; guard < 400 && (battle.pendingTags[tag] || alive(tag).length); guard++) {
            for (const mo of alive(tag)) P_DamageMobj(mo, p.mo, p.mo, 10000);
            const dt = run(35);
            worst = Math.max(worst, dt / 35);
            if (o.done) break;
          }
          run(40);
          log.push('objetivo ' + (i + 1) + ' (' + o.title + '): ' + (o.done ? 'CUMPLIDO' : 'PENDIENTE') + ' t=' + Math.round(leveltime / 35) + 's');
        } else if (o.reach) {
          // Buscar una línea 951 con esa etiqueta y cruzarla.
          let line = null;
          for (const ld of lines) if (ld.special === 951 && ld.tag === o.reachtag) { line = ld; break; }
          if (!line) { log.push('objetivo ' + (i + 1) + ': sin línea 951'); continue; }
          const mx = (line.v1.x + line.v2.x) / 2, my = (line.v1.y + line.v2.y) / 2;
          const len = Math.hypot(line.dx, line.dy), nx = -line.dy / len, ny = line.dx / len;
          // Cruzar la línea caminando (NOCLIP, como en DOOM, no activa especiales).
          tp(mx + nx * 40, my + ny * 40, 0);
          let moved = true;
          for (let k = 1; k <= 8 && moved; k++) moved = P_TryMove(p.mo, mx + nx * (40 - k * 10), my + ny * (40 - k * 10));
          if (!moved) log.push('  (no pudo cruzar la línea en ' + Math.round(mx) + ',' + Math.round(my) + ')');
          run(20);
          log.push('objetivo ' + (i + 1) + ' (' + o.title + '): ' + (o.done ? 'CUMPLIDO' : 'PENDIENTE'));
        }
      }
      // Izar la bandera: buscar una línea 911 y usarla desde su frente.
      let flagline = null;
      for (const ld of lines) if (ld.special === 911) { flagline = ld; break; }
      let exitOk = false;
      if (flagline) {
        const mx = (flagline.v1.x + flagline.v2.x) / 2, my = (flagline.v1.y + flagline.v2.y) / 2;
        const len = Math.hypot(flagline.dx, flagline.dy), nx = flagline.dy / len, ny = -flagline.dx / len; // lado frontal (derecha)
        tp(mx + nx * 32, my + ny * 32, Math.atan2(-ny, -nx) * 180 / Math.PI);
        P_UseLines(p);
        log.push('bandera usada: special=' + flagline.special + ' exitTimer=' + exitTimer);
        for (let k = 0; k < 400 && gamestate === GS_LEVEL; k++) { G_Ticker(); }
        exitOk = gamestate === GS_INTERMISSION;
      }
      log.push('intermedio: ' + (exitOk ? 'SÍ' : 'NO') + '  tic peor: ' + worst.toFixed(2) + ' ms  mobjs: ' + (function () { let n = 0; for (let th = thinkercap.next; th !== thinkercap; th = th.next) if (th.isMobj) n++; return n; })());
      D_StartTitle();
      return { log: log, ok: exitOk && battle.objectives.every(function (o) { return o.done; }) };
    }, map);
    console.log('--- Mapa ' + map + (res.ok ? ' OK' : ' FALLA'));
    for (const l of res.log) console.log('  ' + l);
    if (!res.ok) failed++;
  }
  if (errors.length) console.log('ERRORES (' + errors.length + '):\n' + errors.slice(0, 30).join('\n'));
  await browser.close();
  process.exit(failed || errors.length ? 1 : 0);
})().catch(function (e) { console.error(e); process.exit(1); });
