// =============================================================================
// g_game.js — Estado del juego, comandos de tic y flujo entre niveles (g_game.c)
// =============================================================================
'use strict';

let gamestate = GS_DEMOSCREEN;
let gameaction = ga_nothing;
let gameskill = sk_medium;
let gamemap = 1;
let paused = false;
let usergame = false;
let gametic = 0;
let consoleplayer = 0;
let wipegamestate = GS_DEMOSCREEN;
let campaignMode = true;        // true: campaña encadenada; false: batalla suelta
let d_skill = sk_medium, d_map = 1;
let exitTimer = 0;
let wminfo = null;

const NUMMAPS = 6;
const MAPLUMPS = ['E1M1', 'E1M2', 'E1M3', 'E1M4', 'E1M5', 'E1M6'];

function G_NewPlayer() {
  return {
    mo: null, playerstate: PST_REBORN,
    cmd: { forwardmove: 0, sidemove: 0, angleturn: 0, lookdelta: 0, buttons: 0, freeaim: 0 },
    pitch: 0, centering: false, ads: 0, oldads: 0, freeaim: false,
    viewz: 0, oldviewz: 0, viewheight: VIEWHEIGHT, deltaviewheight: 0, bob: 0,
    health: MAXHEALTH, armorpoints: 0, armortype: 0,
    powers: new Array(NUMPOWERS).fill(0), cards: [false, false, false], backpack: false,
    readyweapon: wp_revolver, pendingweapon: wp_nochange,
    weaponowned: new Array(NUMWEAPONS).fill(false),
    ammo: new Array(NUMAMMO).fill(0), maxammo: maxammo.slice(),
    attackdown: false, usedown: false, cheats: 0, refire: 0,
    killcount: 0, itemcount: 0, secretcount: 0,
    message: null, damagecount: 0, bonuscount: 0, attacker: null,
    extralight: 0, fixedcolormap: -1,
    psprites: [
      { state: null, stateNum: 0, tics: 0, sx: 0, sy: 0, oldsx: 0, oldsy: 0, oldvalid: false },
      { state: null, stateNum: 0, tics: 0, sx: 0, sy: 0, oldsx: 0, oldsy: 0, oldvalid: false }
    ]
  };
}

const players = [G_NewPlayer()];
const playeringame = [true];

// --- Entrada: teclas del juego ------------------------------------------------------------------------
const gamekeydown = Object.create(null);
let mousex = 0, mousey = 0;
let turnheld = 0;
let viewactive = true;
let nextWeaponRequest = 0;

const KEYS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  strafeleft: ['KeyA'],
  straferight: ['KeyD'],
  left: ['ArrowLeft'],
  right: ['ArrowRight'],
  fire: ['ControlLeft', 'ControlRight', 'MOUSE1', 'TOUCH_FIRE', 'PAD_RT', 'KeyF'],
  use: ['KeyE', 'Space', 'TOUCH_USE', 'PAD_A', 'Enter'],
  run: ['ShiftLeft', 'ShiftRight', 'PAD_LS'],
  strafe: ['AltLeft', 'AltRight'],
  aim: ['MOUSE2', 'KeyZ', 'PAD_LT', 'TOUCH_AIM'],
  lookup: ['PageUp'],
  lookdown: ['PageDown'],
  centerview: ['End', 'PAD_RS']
};

// Teclas pulsadas desde el último tic: un toque más breve que un tic (28 ms)
// no se pierde aunque la tecla ya se haya soltado al armar el ticcmd.
let gamekeytapped = {};

function G_KeyDown(action) {
  const list = KEYS[action];
  for (let i = 0; i < list.length; i++) if (gamekeydown[list[i]] || gamekeytapped[list[i]]) return true;
  return false;
}

const forwardmove = [0x19, 0x32];
const sidemove = [0x18, 0x28];
const angleturn = [640, 1280, 320];
const SLOWTURNTICS = 6;

// Giro de ratón acumulado desde el último tic: el renderizador lo aplica de
// inmediato (menos latencia) y el próximo ticcmd lo consumirá exactamente.
function G_PendingTurn() {
  if (gamestate !== GS_LEVEL || paused || menuactive) return 0;
  return ((-((mousex * 8) | 0)) * 65536) >>> 0;
}

// Ídem para la mirada vertical (radianes).
function G_PendingPitch() {
  if (gamestate !== GS_LEVEL || paused || menuactive || !defaults.mouseLook) return 0;
  return ((mousey * 8) | 0) * PITCHUNIT;
}

// Aumento actual de la vista (con las miras, el ratón gira más despacio).
function G_CurrentZoom() {
  const p = players[0];
  if (gamestate !== GS_LEVEL || !p || !p.mo) return 1;
  return P_ViewZoom(p, 1);
}

const LOOKSPEED = 360;      // mirada con teclas: unidades de ticcmd por tic

function G_BuildTiccmd(cmd) {
  cmd.forwardmove = cmd.sidemove = cmd.angleturn = cmd.buttons = cmd.lookdelta = 0;
  cmd.freeaim = defaults.mouseLook ? 1 : 0;
  const strafe = G_KeyDown('strafe');
  let speed = (G_KeyDown('run') ? 1 : 0) ^ (defaults.alwaysRun ? 1 : 0);
  let forward = 0, side = 0;
  const kl = G_KeyDown('left'), kr = G_KeyDown('right');
  if (kl || kr) turnheld++; else turnheld = 0;
  const tspeed = turnheld < SLOWTURNTICS ? 2 : speed;
  if (strafe) {
    if (kr) side += sidemove[speed];
    if (kl) side -= sidemove[speed];
  } else {
    if (kr) cmd.angleturn -= angleturn[tspeed];
    if (kl) cmd.angleturn += angleturn[tspeed];
  }
  if (G_KeyDown('forward')) forward += forwardmove[speed];
  if (G_KeyDown('back')) forward -= forwardmove[speed];
  if (G_KeyDown('straferight')) side += sidemove[speed];
  if (G_KeyDown('strafeleft')) side -= sidemove[speed];
  if (G_KeyDown('fire')) cmd.buttons |= BT_ATTACK;
  if (G_KeyDown('use')) cmd.buttons |= BT_USE;
  if (G_KeyDown('aim')) cmd.buttons |= BT_AIM;
  // Cambio de arma: teclas 1..5, rueda del ratón, botón táctil o del mando.
  for (let i = 0; i < NUMWEAPONS; i++) {
    const d = 'Digit' + (i + 1), n = 'Numpad' + (i + 1);
    if (gamekeydown[d] || gamekeydown[n] || gamekeytapped[d] || gamekeytapped[n]) {
      cmd.buttons |= BT_CHANGE | (i << BT_WEAPONSHIFT);
      break;
    }
  }
  if (nextWeaponRequest && !(cmd.buttons & BT_CHANGE)) {
    const w = G_NextWeapon(nextWeaponRequest);
    if (w >= 0) cmd.buttons |= BT_CHANGE | (w << BT_WEAPONSHIFT);
    nextWeaponRequest = 0;
  }
  // Ratón: giro y, con "apuntar con el ratón", mirada vertical (moderno);
  // si no, opcionalmente avance (clásico).
  cmd.angleturn -= (mousex * 8) | 0;
  if (defaults.mouseLook) cmd.lookdelta += (mousey * 8) | 0;
  else if (defaults.mouseMove) forward += mousey;
  mousex = mousey = 0;
  if (defaults.mouseLook) {
    if (G_KeyDown('lookup')) cmd.lookdelta += LOOKSPEED;
    if (G_KeyDown('lookdown')) cmd.lookdelta -= LOOKSPEED;
    if (G_KeyDown('centerview')) cmd.buttons |= BT_CENTER;
  } else cmd.buttons |= BT_CENTER;
  // Pantalla táctil
  if (I_touch.moveX || I_touch.moveY) {
    forward += Math.round(I_touch.moveY * forwardmove[1]);
    side += Math.round(I_touch.moveX * sidemove[1]);
  }
  const zs = 1 / G_CurrentZoom();
  if (I_touch.turn) {
    cmd.angleturn -= Math.round(I_touch.turn * 60 * (defaults.mouseSensitivity + 5) / 10 * zs);
    I_touch.turn = 0;
  }
  if (I_touch.look) {
    if (defaults.mouseLook) cmd.lookdelta -= Math.round(I_touch.look * 60 * (defaults.mouseSensitivity + 5) / 10 * zs);
    I_touch.look = 0;
  }
  // Mando
  if (I_pad.forward || I_pad.side || I_pad.turn || I_pad.look) {
    forward += Math.round(I_pad.forward * forwardmove[1]);
    side += Math.round(I_pad.side * sidemove[1]);
    cmd.angleturn -= Math.round(I_pad.turn * angleturn[1] * 1.2 * zs);
    if (defaults.mouseLook) cmd.lookdelta -= Math.round(I_pad.look * 700 * zs * (defaults.mouseInvertY ? -1 : 1));
  }
  const MAXPLMOVE = forwardmove[1];
  if (forward > MAXPLMOVE) forward = MAXPLMOVE; else if (forward < -MAXPLMOVE) forward = -MAXPLMOVE;
  if (side > MAXPLMOVE) side = MAXPLMOVE; else if (side < -MAXPLMOVE) side = -MAXPLMOVE;
  cmd.forwardmove = forward;
  cmd.sidemove = side;
  gamekeytapped = {};
  if (cmd.angleturn > 32767) cmd.angleturn = 32767;
  if (cmd.angleturn < -32768) cmd.angleturn = -32768;
  if (cmd.lookdelta > 32767) cmd.lookdelta = 32767;
  if (cmd.lookdelta < -32768) cmd.lookdelta = -32768;
}

// Siguiente/anterior arma poseída.
function G_NextWeapon(dir) {
  const p = players[0];
  let w = p.pendingweapon !== wp_nochange ? p.pendingweapon : p.readyweapon;
  for (let i = 0; i < NUMWEAPONS; i++) {
    w = (w + dir + NUMWEAPONS) % NUMWEAPONS;
    if (p.weaponowned[w]) {
      const ammo = weaponinfo[w].ammo;
      if (ammo === am_noammo || p.ammo[ammo] > 0) return w;
    }
  }
  return -1;
}

function G_Responder(ev) {
  if (gamestate === GS_DEMOSCREEN) {
    if (ev.type === ev_keydown || (ev.type === ev_pointer && (ev.data1 === 'down' || ev.data1 === 'tap'))) {
      M_StartControlPanel();
      return true;
    }
    return false;
  }
  if (gamestate === GS_LEVEL) {
    if (HU_Responder(ev)) return true;
    if (ST_Responder(ev)) return true;
    if (AM_Responder(ev)) return true;
  }
  if (gamestate === GS_FINALE) {
    if (F_Responder(ev)) return true;
  }
  switch (ev.type) {
    case ev_keydown:
      if (ev.data1 === 'Pause' || ev.data1 === 'KeyP') {
        if (!ev.repeat) paused = !paused;
        return true;
      }
      if (ev.data1 === 'WHEELUP' || ev.data1 === 'PAD_LB') { nextWeaponRequest = -1; return true; }
      if (ev.data1 === 'WHEELDOWN' || ev.data1 === 'PAD_RB' || ev.data1 === 'TOUCH_WEAPON' || ev.data1 === 'KeyQ') { nextWeaponRequest = 1; return true; }
      gamekeydown[ev.data1] = true;
      if (!ev.repeat) gamekeytapped[ev.data1] = true;
      return true;
    case ev_keyup:
      if (ev.data1 === '*') { for (const k in gamekeydown) gamekeydown[k] = false; return true; }
      gamekeydown[ev.data1] = false;
      return false;
    case ev_mouse: {
      // Con las miras el ratón gira más despacio (proporcional al aumento).
      const sens = (defaults.mouseSensitivity + 5) / 10 / G_CurrentZoom();
      mousex += ev.data2 * sens;
      if (defaults.mouseLook || defaults.mouseMove) mousey += -ev.data3 * sens * (defaults.mouseInvertY ? -1 : 1);
      return true;
    }
  }
  return false;
}

// --- Flujo de juego ---------------------------------------------------------------------------------------
function G_PlayerReborn(pnum) {
  const p = players[pnum];
  const kills = p.killcount, items = p.itemcount, secrets = p.secretcount;
  const fresh = G_NewPlayer();
  Object.assign(p, fresh);
  p.killcount = kills; p.itemcount = items; p.secretcount = secrets;
  p.usedown = p.attackdown = true;
  p.playerstate = PST_LIVE;
  p.health = MAXHEALTH;
  // El infante chileno entra en combate con su corvo, el fusil Comblain
  // reglamentario y un revólver de respaldo.
  p.readyweapon = p.pendingweapon = wp_comblain;
  p.weaponowned[wp_corvo] = true;
  p.weaponowned[wp_revolver] = true;
  p.weaponowned[wp_comblain] = true;
  p.ammo[am_revolver] = 24;
  p.ammo[am_fusil] = 30;
  p.maxammo = maxammo.slice();
}

function G_PlayerFinishLevel(pnum) {
  const p = players[pnum];
  p.powers.fill(0);
  p.cards = [false, false, false];
  p.mo.flags &= ~MF_SHADOW;
  p.extralight = 0;
  p.fixedcolormap = -1;
  p.damagecount = 0;
  p.bonuscount = 0;
}

function G_InitNew(skill, map) {
  if (paused) paused = false;
  if (skill > sk_nightmare) skill = sk_nightmare;
  M_ClearRandom();
  players[0].playerstate = PST_REBORN;
  usergame = true;
  paused = false;
  gameskill = skill;
  gamemap = map;
  viewactive = true;
  G_DoLoadLevel();
}

// Empieza una partida nueva mostrando antes el parte de guerra (briefing).
function G_DeferedInitNew(skill, map, campaign) {
  d_skill = skill;
  d_map = map;
  campaignMode = campaign !== false;
  players[0].playerstate = PST_REBORN;
  players[0].killcount = players[0].itemcount = players[0].secretcount = 0;
  gameskill = skill;
  gamemap = map;
  gameaction = ga_briefing;
}

function G_DoLoadLevel() {
  exitTimer = 0;
  VOICE_StopAll();
  W_WarmAll();   // si la fundición en segundo plano no terminó, se completa antes del combate
  if (wipegamestate === GS_LEVEL) wipegamestate = -1;
  gamestate = GS_LEVEL;
  if (playeringame[0] && players[0].playerstate === PST_DEAD) players[0].playerstate = PST_REBORN;
  players[0].killcount = players[0].itemcount = players[0].secretcount = 0;
  P_SetupLevel(MAPLUMPS[gamemap - 1], gameskill);
  gameaction = ga_nothing;
  for (const k in gamekeydown) gamekeydown[k] = false;
  gamekeytapped = {};
  mousex = mousey = 0;
  paused = false;
  I_currentPal = -1;
  S_ChangeMusic(levelinfo.music || 'M_E1M1', true);
  HU_ShowBigMessage(levelinfo.title + '\n' + (levelinfo.date || ''), true);
  const obj = B_PendingObjective();
  if (obj) HU_PlayerMessage(players[0], 'Objetivo: ' + obj.title);
  M_SaveProgress(gamemap);
}

function G_ExitLevel() {
  gameaction = ga_completed;
}

function G_ExitLevelDelayed(tics) {
  if (!exitTimer) exitTimer = tics;
}

function G_CheckDelayedExit() {
  if (exitTimer > 0 && --exitTimer === 0) G_ExitLevel();
}

function G_DoCompleted() {
  gameaction = ga_nothing;
  if (automapactive) AM_Stop();
  G_PlayerFinishLevel(0);
  const p = players[0];
  wminfo = {
    last: gamemap, next: gamemap + 1,
    maxkills: totalkills, maxitems: totalitems, maxsecret: totalsecret,
    skills: p.killcount, sitems: p.itemcount, ssecret: p.secretcount,
    stime: leveltime, partime: (levelinfo.par || 300) * TICRATE,
    campaign: campaignMode
  };
  gamestate = GS_INTERMISSION;
  viewactive = false;
  WI_Start(wminfo);
}

function G_WorldDone() {
  gameaction = ga_worlddone;
}

function G_DoWorldDone() {
  gameaction = ga_nothing;
  if (!campaignMode || gamemap >= NUMMAPS) {
    if (gamemap >= NUMMAPS) {
      F_StartFinale();
    } else {
      D_StartTitle();
    }
    return;
  }
  gamemap++;
  gamestate = GS_BRIEFING;
  WI_StartBriefing(gamemap, false);
}

function G_DoReborn(pnum) {
  gameaction = ga_loadlevel;
}

function G_Ticker() {
  if (playeringame[0] && players[0].playerstate === PST_REBORN && gamestate === GS_LEVEL) G_DoReborn(0);
  while (gameaction !== ga_nothing) {
    switch (gameaction) {
      case ga_loadlevel: G_DoLoadLevel(); break;
      case ga_newgame: G_InitNew(d_skill, d_map); break;
      case ga_briefing:
        gameaction = ga_nothing;
        gamestate = GS_BRIEFING;
        WI_StartBriefing(gamemap, true);
        break;
      case ga_completed: G_DoCompleted(); break;
      case ga_victory: gameaction = ga_nothing; F_StartFinale(); break;
      case ga_worlddone: G_DoWorldDone(); break;
      default: gameaction = ga_nothing;
    }
  }
  if (gamestate === GS_LEVEL && !paused && !menuactive) G_BuildTiccmd(players[0].cmd);
  switch (gamestate) {
    case GS_LEVEL:
      P_Ticker();
      ST_Ticker();
      AM_Ticker();
      HU_Ticker();
      break;
    case GS_INTERMISSION: WI_Ticker(); break;
    case GS_BRIEFING: WI_BriefingTicker(); break;
    case GS_FINALE: F_Ticker(); break;
    case GS_DEMOSCREEN: D_PageTicker(); break;
  }
}

// --- Progreso guardado -------------------------------------------------------------------------------------
function M_SaveProgress(map) {
  const best = M_StorageGet('progress', 1);
  if (map > best) M_StorageSet('progress', map);
}
