// =============================================================================
// d_main.js — Arranque y bucle principal (d_main.c)
// -----------------------------------------------------------------------------
// D_DoomMain construye el IWAD en memoria (paleta, texturas, sprites, sonidos,
// mapas compilados con su árbol BSP), inicializa los subsistemas mostrando la
// consola de arranque al estilo de DOOM y entra en D_DoomLoop: tics fijos de
// 35 Hz para la simulación y renderizado por cuadro con interpolación.
// =============================================================================
'use strict';

let D_lastTime = 0;
let D_accum = 0;
let D_pagetic = 0;
let D_wipeLast = 0;
let D_renderAvg = 0, D_renderSamples = 0;

// Resolución automática adaptable: si dibujar un cuadro del combate cuesta
// en promedio más de 20 ms (menos de ~50 cuadros por segundo), se baja un
// escalón la escala automática. No afecta a una resolución elegida a mano.
function D_AdaptResolution(ms) {
  if ((defaults.resolution | 0) !== 0 || SCALE <= 2) return;
  D_renderAvg = D_renderSamples ? D_renderAvg * 0.95 + ms * 0.05 : ms;
  if (++D_renderSamples > 150 && D_renderAvg > 20) {
    I_autoScaleCap = SCALE - 1;
    I_needResize = true;
    D_renderSamples = 0;
    console.log('Resolución automática: escala ' + I_autoScaleCap + ' (' + D_renderAvg.toFixed(1) + ' ms por cuadro)');
  }
}

function D_Boot(line) {
  const el = document.getElementById('boot');
  if (el) {
    el.textContent += line + '\n';
    el.scrollTop = el.scrollHeight;
  }
  console.log(line);
}

async function D_DoomMain() {
  const canvas = document.getElementById('screen');
  D_Boot(GAME_TITLE + ' — ' + ENGINE_NAME + ' ' + ENGINE_VERSION);
  D_Boot('M_LoadDefaults: cargando configuración.');
  M_LoadDefaults();
  D_Boot('V_Init: asignando pantallas.');
  I_InitGraphics(canvas);
  D_Boot('Z_Init: memoria administrada por JavaScript.');
  D_Boot('W_Init: construyendo el IWAD en memoria.');
  await M_NextFrame();
  D_Boot('  PLAYPAL, COLORMAP: paleta del desierto de Atacama.');
  PAL_BuildLumps();
  FONT_BuildLumps();
  V_InitTranslations();
  await M_NextFrame();
  D_Boot('  T_START..T_END: texturas de muro y cielos panorámicos.');
  await M_NextFrame();
  TX_BuildTextures();
  D_Boot('  F_START..F_END: flats.');
  await M_NextFrame();
  TX_BuildFlats();
  D_Boot('  S_START..S_END: fundición de sprites en 8 rotaciones');
  await M_NextFrame();
  await SPR_BuildSprites(function (msg) { D_Boot('    ' + msg); });
  D_Boot('  STBAR, STF*, TITLEPIC, WIMAP: interfaz.');
  await M_NextFrame();
  FACE_BuildLumps();
  GFX_BuildAll();
  D_Boot('  DS*: síntesis de efectos de sonido.');
  await M_NextFrame();
  SND_BuildSounds();
  D_Boot('R_Init: inicializando el renderizador.');
  await M_NextFrame();
  R_InitData();
  HIST_BuildPages();
  D_Boot('P_Init: tablas de estados y objetos.');
  P_InitInfo();
  D_InitWeaponInfo();
  P_InitSwitchList();
  D_Boot('doombsp: compilando mapas y construyendo nodos BSP...');
  for (const def of MAPDEFS) {
    await M_NextFrame();
    const t0 = performance.now();
    const map = MC_CompileMap(def);
    W_AddLump(def.lump, map, 'map');
    D_Boot('  ' + def.lump + ': ' + map.lines.length + ' linedefs, ' + map.sectors.length + ' sectores, ' +
      map.segs.length + ' segs, ' + map.nodes.length + ' nodos (' + Math.round(performance.now() - t0) + ' ms)');
    for (const w of map.warnings) console.warn(def.lump + ': ' + w);
  }
  D_Boot('I_Init: teclado, ratón, pantalla táctil y mando.');
  I_InitInput(canvas);
  S_Init();
  HU_Init();
  D_Boot('D_CheckNetGame: partida individual.');
  D_Boot('Listo. ¡Adelante, soldado!');
  await M_NextFrame();
  const boot = document.getElementById('boot');
  if (boot) boot.style.display = 'none';
  R_SetViewSize(defaults.screenblocks);
  D_StartTitle();
  D_DoomLoop();
}

function D_StartTitle() {
  gameaction = ga_nothing;
  gamestate = GS_DEMOSCREEN;
  usergame = false;
  paused = false;
  automapactive = false;
  D_pagetic = 0;
  S_ChangeMusic('M_TITLE', true);
}

function D_PageTicker() {
  D_pagetic++;
}

function D_PageDrawer() {
  V_DrawFullImage(W_CacheLumpName('TITLEPIC'));
  V_DrawTextCentered(8, '1879', 'title', V_Translations.gold);
  V_DrawTextCentered(58, 'GUERRA DEL PACÍFICO', true);
  V_DrawTextCentered(82, 'PISAGUA · DOLORES · ARICA', false, V_Translations.sand);
  if (!menuactive && (D_pagetic & 32)) V_DrawTextCentered(178, 'Presione cualquier tecla', false, V_Translations.gold);
}

function D_ProcessEvents() {
  while (I_events.length) {
    const ev = I_events.shift();
    if (M_Responder(ev)) continue;
    if (gamestate === GS_INTERMISSION && WI_Responder(ev)) continue;
    if (gamestate === GS_BRIEFING && WI_BriefingResponder(ev)) continue;
    G_Responder(ev);
  }
}

function D_RunTic() {
  I_StartTic();
  D_ProcessEvents();
  G_Ticker();
  M_Ticker();
  S_UpdateSounds();
  gametic++;
}

function D_Display() {
  let wipe = false;
  if (gamestate !== wipegamestate) {
    wipe = true;
    wipe_StartScreen();
  }
  switch (gamestate) {
    case GS_LEVEL:
      if (!players[0].mo) break;
      if (automapactive) AM_Drawer();
      else R_RenderPlayerView(players[0]);
      ST_Drawer(setblocks >= 11 && !automapactive);
      if (automapactive && setblocks >= 11) ST_Drawer(false);
      HU_Drawer();
      break;
    case GS_INTERMISSION:
      I_SetPalette(0);
      WI_Drawer();
      break;
    case GS_BRIEFING:
      I_SetPalette(0);
      WI_BriefingDrawer();
      break;
    case GS_FINALE:
      I_SetPalette(0);
      F_Drawer();
      break;
    case GS_DEMOSCREEN:
      I_SetPalette(0);
      D_PageDrawer();
      break;
  }
  if (paused && gamestate === GS_LEVEL && !menuactive) {
    V_DrawTextCentered(80, 'PAUSA', true, V_Translations.gold);
  }
  M_Drawer();
  wipegamestate = gamestate;
  if (wipe && gametic > 1) {
    wipe_EndScreen();
    wipe_Begin();
    D_wipeLast = performance.now();
  }
}

function D_Frame(now) {
  requestAnimationFrame(D_Frame);
  if (I_needResize) {
    if (I_ComputeScreenSize()) {
      R_SetViewSize(defaults.screenblocks);
      wipe_active = false;
      wipegamestate = gamestate;
    }
  }
  I_UpdateTouchUI();
  let dt = now - D_lastTime;
  D_lastTime = now;
  if (dt > 250) dt = 250;
  if (wipe_active) {
    const ticks = Math.max(1, Math.round((now - D_wipeLast) / TICMS));
    if (now - D_wipeLast >= TICMS) {
      D_wipeLast = now;
      wipe_Do(ticks);
      I_FinishUpdate();
    }
    D_accum = 0;
    return;
  }
  D_accum += dt;
  let n = 0;
  while (D_accum >= TICMS && n < 8) {
    D_RunTic();
    D_accum -= TICMS;
    n++;
  }
  if (n >= 8) D_accum = 0;
  R_interpFrac = (defaults.interpolate && !paused && !menuactive) ? clamp(D_accum / TICMS, 0, 1) : 1;
  const t0 = performance.now();
  D_Display();
  I_FinishUpdate();
  if (gamestate === GS_LEVEL && !menuactive && !paused && !automapactive) D_AdaptResolution(performance.now() - t0);
}

function D_DoomLoop() {
  D_lastTime = performance.now();
  requestAnimationFrame(D_Frame);
}
