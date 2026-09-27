// =============================================================================
// p_doors.js — Puertas verticales (p_doors.c)
// =============================================================================
'use strict';

const VDOORSPEED = 2;
const VDOORWAIT = 150;

function T_VerticalDoor(door) {
  switch (door.direction) {
    case 0: // esperando arriba
      if (!--door.topcountdown) {
        if (door.type === 'normal') {
          door.direction = -1;
          S_StartSound(door.sector.soundorg, 'dorcls');
        } else if (door.type === 'close30ThenOpen') {
          door.direction = 1;
          S_StartSound(door.sector.soundorg, 'doropn');
        }
      }
      break;
    case 2: // espera inicial
      if (!--door.topcountdown) {
        if (door.type === 'raiseIn5Mins') {
          door.direction = 1;
          door.type = 'normal';
          S_StartSound(door.sector.soundorg, 'doropn');
        }
      }
      break;
    case -1: { // bajando
      const res = T_MovePlane(door.sector, door.speed, door.sector.floorheight, false, 1, door.direction);
      if (res === MP_PASTDEST) {
        if (door.type === 'normal' || door.type === 'close') {
          door.sector.specialdata = null;
          P_RemoveThinker(door);
        } else if (door.type === 'close30ThenOpen') {
          door.direction = 0;
          door.topcountdown = TICRATE * 30;
        }
      } else if (res === MP_CRUSHED) {
        if (door.type !== 'close') {
          door.direction = 1;
          S_StartSound(door.sector.soundorg, 'doropn');
        }
      }
      break;
    }
    case 1: { // subiendo
      const res = T_MovePlane(door.sector, door.speed, door.topheight, false, 1, door.direction);
      if (res === MP_PASTDEST) {
        if (door.type === 'normal') {
          door.direction = 0;
          door.topcountdown = door.topwait;
        } else {
          door.sector.specialdata = null;
          P_RemoveThinker(door);
        }
      }
      break;
    }
  }
}

function P_NewDoor(sec, type) {
  const door = { func: T_VerticalDoor, sector: sec, type: type, direction: 1, speed: VDOORSPEED,
    topwait: VDOORWAIT, topcountdown: 0, topheight: 0 };
  P_AddThinker(door);
  sec.specialdata = door;
  return door;
}

// Puertas con etiqueta, activadas a distancia (líneas W1/S1).
function EV_DoDoor(line, type) {
  let secnum = -1, rtn = false;
  while ((secnum = P_FindSectorFromLineTag(line, secnum)) >= 0) {
    const sec = sectors[secnum];
    if (sec.specialdata) continue;
    rtn = true;
    const door = P_NewDoor(sec, type);
    switch (type) {
      case 'close':
        door.topheight = P_FindLowestCeilingSurrounding(sec) - 4;
        door.direction = -1;
        S_StartSound(sec.soundorg, 'dorcls');
        break;
      case 'close30ThenOpen':
        door.topheight = sec.ceilingheight;
        door.direction = -1;
        S_StartSound(sec.soundorg, 'dorcls');
        break;
      case 'normal':
      case 'open':
        door.direction = 1;
        door.topheight = P_FindLowestCeilingSurrounding(sec) - 4;
        if (door.topheight !== sec.ceilingheight) S_StartSound(sec.soundorg, 'doropn');
        break;
    }
  }
  return rtn;
}

// Portones manuales (se usan de frente). Sin llaves: los portones de los
// fuertes y corrales se abren a mano.
function EV_VerticalDoor(line, thing) {
  if (line.sidenum[1] < 0) return;
  const sec = sides[line.sidenum[1]].sector;
  if (sec.specialdata) {
    const door = sec.specialdata;
    if (line.special === 1) {
      if (door.direction === -1) door.direction = 1;
      else {
        if (!thing.player) return;
        door.direction = -1;
      }
    }
    return;
  }
  S_StartSound(sec.soundorg, 'doropn');
  const door = P_NewDoor(sec, 'normal');
  if (line.special === 31) {
    door.type = 'open';
    line.special = 0;
  }
  door.topheight = P_FindLowestCeilingSurrounding(sec) - 4;
}

function P_SpawnDoorCloseIn30(sec) {
  const door = P_NewDoor(sec, 'normal');
  sec.special = 0;
  door.direction = 0;
  door.topcountdown = 30 * TICRATE;
}
