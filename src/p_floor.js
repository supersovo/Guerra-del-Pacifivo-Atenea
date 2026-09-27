// =============================================================================
// p_floor.js — Pisos móviles (p_floor.c)
// -----------------------------------------------------------------------------
// Se conserva la maquinaria de DOOM para mover el piso de un sector (útil para
// derrumbes de parapetos o voladuras). No hay ascensores: no existían en los
// campos de batalla de 1879-1880.
// =============================================================================
'use strict';

const FLOORSPEED = 1;

function T_MoveFloor(floor) {
  const res = T_MovePlane(floor.sector, floor.speed, floor.floordestheight, floor.crush, 0, floor.direction);
  if (res === MP_PASTDEST) {
    floor.sector.specialdata = null;
    P_RemoveThinker(floor);
  }
}

function EV_DoFloor(line, floortype) {
  let secnum = -1, rtn = false;
  while ((secnum = P_FindSectorFromLineTag(line, secnum)) >= 0) {
    const sec = sectors[secnum];
    if (sec.specialdata) continue;
    rtn = true;
    const floor = { func: T_MoveFloor, type: floortype, crush: false, sector: sec, direction: 1,
      speed: FLOORSPEED, floordestheight: sec.floorheight };
    P_AddThinker(floor);
    sec.specialdata = floor;
    switch (floortype) {
      case 'lowerFloor':
        floor.direction = -1;
        floor.floordestheight = P_FindHighestFloorSurrounding(sec);
        break;
      case 'lowerFloorToLowest':
        floor.direction = -1;
        floor.floordestheight = P_FindLowestFloorSurrounding(sec);
        break;
      case 'turboLower':
        floor.direction = -1;
        floor.speed = FLOORSPEED * 4;
        floor.floordestheight = P_FindHighestFloorSurrounding(sec);
        if (floor.floordestheight !== sec.floorheight) floor.floordestheight += 8;
        break;
      case 'raiseFloor':
        floor.direction = 1;
        floor.floordestheight = P_FindLowestCeilingSurrounding(sec);
        if (floor.floordestheight > sec.ceilingheight) floor.floordestheight = sec.ceilingheight;
        break;
      case 'raiseFloorToNearest':
        floor.direction = 1;
        floor.floordestheight = P_FindNextHighestFloor(sec, sec.floorheight);
        break;
    }
    if (floor.floordestheight === sec.floorheight) {
      sec.specialdata = null;
      P_RemoveThinker(floor);
    }
  }
  return rtn;
}
