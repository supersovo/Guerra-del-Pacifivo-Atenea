// =============================================================================
// p_switch.js — Interruptores y uso de líneas (p_switch.c)
// =============================================================================
'use strict';

const alphSwitchList = [
  ['PALANC0', 'PALANC1'],
  ['IZAR0', 'IZAR1']
];
let switchlist = [];

function P_InitSwitchList() {
  switchlist = [];
  for (const pair of alphSwitchList) {
    const a = R_CheckTextureNumForName(pair[0]), b = R_CheckTextureNumForName(pair[1]);
    if (a > 0 && b > 0) switchlist.push(a, b);
  }
}

function P_StartButton(line, where, texture, time) {
  for (const b of buttonlist) if (b.line === line) return;
  buttonlist.push({ line: line, where: where, btexture: texture, btimer: time, soundorg: line.frontsector.soundorg });
}

function P_ChangeSwitchTexture(line, useAgain) {
  let sound = 'swtchn';
  if (line.special === 11 || line.special === 911) sound = 'swtchx';
  if (!useAgain) line.special = 0;
  const sd = sides[line.sidenum[0]];
  const texTop = sd.toptexture, texMid = sd.midtexture, texBot = sd.bottomtexture;
  for (let i = 0; i < switchlist.length; i++) {
    const partner = switchlist[i ^ 1];
    if (switchlist[i] === texTop) {
      S_StartSound(line.frontsector.soundorg, sound);
      sd.toptexture = partner;
      if (useAgain) P_StartButton(line, 'top', switchlist[i], BUTTONTIME);
      return;
    }
    if (switchlist[i] === texMid) {
      S_StartSound(line.frontsector.soundorg, sound);
      sd.midtexture = partner;
      if (useAgain) P_StartButton(line, 'mid', switchlist[i], BUTTONTIME);
      return;
    }
    if (switchlist[i] === texBot) {
      S_StartSound(line.frontsector.soundorg, sound);
      sd.bottomtexture = partner;
      if (useAgain) P_StartButton(line, 'bottom', switchlist[i], BUTTONTIME);
      return;
    }
  }
}

// Usar una línea (tecla de uso) — devuelve true si hizo algo.
function P_UseSpecialLine(thing, line, side) {
  if (side) return false;
  if (!thing.player) {
    if (line.flags & ML_SECRET) return false;
    if (line.special !== 1) return false;
  }
  switch (line.special) {
    case 1: case 31:
      EV_VerticalDoor(line, thing);
      break;
    case 11:
      P_ChangeSwitchTexture(line, 0);
      G_ExitLevel();
      break;
    case 18:
      if (EV_DoFloor(line, 'raiseFloorToNearest')) P_ChangeSwitchTexture(line, 0);
      break;
    case 23:
      if (EV_DoFloor(line, 'lowerFloorToLowest')) P_ChangeSwitchTexture(line, 0);
      break;
    case 63:
      if (EV_DoDoor(line, 'normal')) P_ChangeSwitchTexture(line, 1);
      break;
    case 102:
      if (EV_DoFloor(line, 'lowerFloor')) P_ChangeSwitchTexture(line, 0);
      break;
    case 103:
      if (EV_DoDoor(line, 'open')) P_ChangeSwitchTexture(line, 0);
      break;
    case 911:
      if (!B_AllObjectivesDone()) {
        if (thing.player) {
          const pend = B_PendingObjective();
          HU_PlayerMessage(thing.player, 'Aún no: ' + (pend ? pend.title : 'quedan objetivos') + '.');
          S_StartSound(null, 'noway');
        }
        return false;
      }
      P_ChangeSwitchTexture(line, 0);
      EV_RaiseFlag(thing);
      break;
    default:
      return false;
  }
  return true;
}

// Especial 911: izar la bandera chilena en el mástil más cercano y terminar.
function EV_RaiseFlag(thing) {
  let best = null, bestd = Infinity;
  for (let th = thinkercap.next; th !== thinkercap; th = th.next) {
    if (th.isMobj && !th.removed && th.type === MT.MASTIL) {
      const d = P_AproxDistance(th.x - thing.x, th.y - thing.y);
      if (d < bestd) { bestd = d; best = th; }
    }
  }
  if (best) P_SetMobjState(best, S_('S_MAST_UP'));
  S_StartSound(null, 'bugle');
  const txt = levelinfo && levelinfo.flagMessage;
  if (txt) HU_ShowBigMessage(txt);
  G_ExitLevelDelayed(TICRATE * 4);
}
