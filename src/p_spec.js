// =============================================================================
// p_spec.js — Líneas y sectores especiales (p_spec.c)
// -----------------------------------------------------------------------------
// Números de especiales de línea (subconjunto compatible con DOOM):
//   1 DR portón   31 D1 abrir   2 W1 abrir (tag)   3 W1 cerrar
//   4 W1 abrir-esperar-cerrar   5 W1 subir piso   19 W1 bajar piso
//   23 S1 bajar piso al mínimo   38 W1 bajar piso al mínimo   52 W1 salida
//   11 S1 salida   18 S1 subir piso   46 GR abrir al disparar
//   63 SR portón (tag)   102 S1 bajar piso   103 S1 abrir (tag)
//   12/13/35 W1 luces   48 textura desplazable (oleaje)
// No hay ascensores ni puertas con llave: no corresponden a los campos de
// batalla de 1879-1880. Especiales propios del motor Atenea:
//   900 W1 voladura: explosiones en las cosas VOLADURA con el mismo tag
//   911 S1 izar la bandera (requiere cumplir los objetivos) y terminar
//   950 W1 mensaje histórico (texto del mapa para ese tag)
//   951 W1 objetivo alcanzado (objetivo "reach" con ese tag)
//   952 W1 disparar un evento de batalla (oleada, bombardeo) con ese tag
// Sectores: 1/2/3/4/8/12/13/17 luces, 5/7/16 daño, 9 depósito oculto.
// =============================================================================
'use strict';

// --- Búsquedas de sectores vecinos ----------------------------------------------------------
function getNextSector(line, sec) {
  if (!(line.flags & ML_TWOSIDED)) return null;
  if (line.frontsector === sec) return line.backsector;
  return line.frontsector;
}

function P_FindLowestFloorSurrounding(sec) {
  let floor = sec.floorheight;
  for (const ld of sec.lines) {
    const other = getNextSector(ld, sec);
    if (other && other.floorheight < floor) floor = other.floorheight;
  }
  return floor;
}

function P_FindHighestFloorSurrounding(sec) {
  let floor = -500;
  for (const ld of sec.lines) {
    const other = getNextSector(ld, sec);
    if (other && other.floorheight > floor) floor = other.floorheight;
  }
  return floor;
}

function P_FindNextHighestFloor(sec, currentheight) {
  let min = Infinity;
  for (const ld of sec.lines) {
    const other = getNextSector(ld, sec);
    if (other && other.floorheight > currentheight && other.floorheight < min) min = other.floorheight;
  }
  return min === Infinity ? currentheight : min;
}

function P_FindLowestCeilingSurrounding(sec) {
  let height = MAXINT;
  for (const ld of sec.lines) {
    const other = getNextSector(ld, sec);
    if (other && other.ceilingheight < height) height = other.ceilingheight;
  }
  return height;
}

function P_FindHighestCeilingSurrounding(sec) {
  let height = 0;
  for (const ld of sec.lines) {
    const other = getNextSector(ld, sec);
    if (other && other.ceilingheight > height) height = other.ceilingheight;
  }
  return height;
}

function P_FindSectorFromLineTag(line, start) {
  for (let i = start + 1; i < sectors.length; i++) if (sectors[i].tag === line.tag) return i;
  return -1;
}

function P_FindMinSurroundingLight(sector, max) {
  let min = max;
  for (const ld of sector.lines) {
    const check = getNextSector(ld, sector);
    if (check && check.lightlevel < min) min = check.lightlevel;
  }
  return min;
}

// --- Mover planos ---------------------------------------------------------------------------------
function T_MovePlane(sector, speed, dest, crush, floorOrCeiling, direction) {
  P_MarkSectorMoving(sector);
  let lastpos;
  if (floorOrCeiling === 0) {
    if (direction === -1) {
      if (sector.floorheight - speed < dest) {
        lastpos = sector.floorheight;
        sector.floorheight = dest;
        if (P_ChangeSector(sector, crush)) { sector.floorheight = lastpos; P_ChangeSector(sector, crush); }
        return MP_PASTDEST;
      }
      lastpos = sector.floorheight;
      sector.floorheight -= speed;
      if (P_ChangeSector(sector, crush)) { sector.floorheight = lastpos; P_ChangeSector(sector, crush); return MP_CRUSHED; }
    } else if (direction === 1) {
      if (sector.floorheight + speed > dest) {
        lastpos = sector.floorheight;
        sector.floorheight = dest;
        if (P_ChangeSector(sector, crush)) { sector.floorheight = lastpos; P_ChangeSector(sector, crush); }
        return MP_PASTDEST;
      }
      lastpos = sector.floorheight;
      sector.floorheight += speed;
      if (P_ChangeSector(sector, crush)) {
        if (crush) return MP_CRUSHED;
        sector.floorheight = lastpos; P_ChangeSector(sector, crush);
        return MP_CRUSHED;
      }
    }
  } else {
    if (direction === -1) {
      if (sector.ceilingheight - speed < dest) {
        lastpos = sector.ceilingheight;
        sector.ceilingheight = dest;
        if (P_ChangeSector(sector, crush)) { sector.ceilingheight = lastpos; P_ChangeSector(sector, crush); }
        return MP_PASTDEST;
      }
      lastpos = sector.ceilingheight;
      sector.ceilingheight -= speed;
      if (P_ChangeSector(sector, crush)) {
        if (crush) return MP_CRUSHED;
        sector.ceilingheight = lastpos; P_ChangeSector(sector, crush);
        return MP_CRUSHED;
      }
    } else if (direction === 1) {
      if (sector.ceilingheight + speed > dest) {
        lastpos = sector.ceilingheight;
        sector.ceilingheight = dest;
        if (P_ChangeSector(sector, crush)) { sector.ceilingheight = lastpos; P_ChangeSector(sector, crush); }
        return MP_PASTDEST;
      }
      sector.ceilingheight += speed;
      P_ChangeSector(sector, crush);
    }
  }
  return MP_OK;
}

// --- Activación por cruce --------------------------------------------------------------------------
function P_CrossSpecialLine(line, side, thing) {
  if (!thing.player) {
    if (thing.flags & MF_MISSILE) return;
    switch (line.special) {
      case 4: break;   // los soldados pueden abrir estos portones
      default: return;
    }
  }
  const sp = line.special;
  switch (sp) {
    case 2: EV_DoDoor(line, 'open'); line.special = 0; break;
    case 3: EV_DoDoor(line, 'close'); line.special = 0; break;
    case 4: EV_DoDoor(line, 'normal'); line.special = 0; break;
    case 5: EV_DoFloor(line, 'raiseFloor'); line.special = 0; break;
    case 12: EV_LightTurnOn(line, 0); line.special = 0; break;
    case 13: EV_LightTurnOn(line, 255); line.special = 0; break;
    case 16: EV_DoDoor(line, 'close30ThenOpen'); line.special = 0; break;
    case 19: EV_DoFloor(line, 'lowerFloor'); line.special = 0; break;
    case 35: EV_LightTurnOn(line, 35); line.special = 0; break;
    case 36: EV_DoFloor(line, 'turboLower'); line.special = 0; break;
    case 38: EV_DoFloor(line, 'lowerFloorToLowest'); line.special = 0; break;
    case 52: G_ExitLevel(); break;
    case 900: EV_Voladura(line); line.special = 0; break;
    case 950: P_ShowLevelMessage(line.tag); line.special = 0; break;
    case 951: if (B_ReachObjective(line.tag)) line.special = 0; break;
    case 952: B_TriggerEvent(line.tag); line.special = 0; break;
  }
}

// --- Activación por disparo --------------------------------------------------------------------------
function P_ShootSpecialLine(thing, line) {
  if (!thing || !thing.player) return;
  switch (line.special) {
    case 46:
      EV_DoDoor(line, 'open');
      P_ChangeSwitchTexture(line, 1);
      break;
  }
}

// --- Daño y secretos por sector ---------------------------------------------------------------------
function P_PlayerInSpecialSector(player) {
  const sector = player.mo.subsector.sector;
  if (player.mo.z !== sector.floorheight) return;
  switch (sector.special) {
    case 5:  // brasas: 10%
      if (!(leveltime & 0x1f)) P_DamageMobj(player.mo, null, null, 10);
      break;
    case 7:  // 5%
      if (!(leveltime & 0x1f)) P_DamageMobj(player.mo, null, null, 5);
      break;
    case 16: case 4:
      if (!(leveltime & 0x1f)) P_DamageMobj(player.mo, null, null, 20);
      break;
    case 9:
      player.secretcount++;
      sector.special = 0;
      HU_PlayerMessage(player, '¡Encontraste un depósito oculto!');
      S_StartSound(null, 'secret');
      break;
  }
}

// --- Animaciones y botones por tic -----------------------------------------------------------------------
const MAXBUTTONS = 16;
const BUTTONTIME = TICRATE;
let buttonlist = [];
let linespeciallist = [];

function P_UpdateSpecials() {
  R_UpdateAnimations(leveltime);
  for (const line of linespeciallist) {
    if (line.special === 48) sides[line.sidenum[0]].textureoffset += 1;
  }
  for (let i = buttonlist.length - 1; i >= 0; i--) {
    const b = buttonlist[i];
    if (--b.btimer <= 0) {
      const sd = sides[b.line.sidenum[0]];
      if (b.where === 'top') sd.toptexture = b.btexture;
      else if (b.where === 'mid') sd.midtexture = b.btexture;
      else sd.bottomtexture = b.btexture;
      S_StartSound(b.soundorg, 'swtchn');
      buttonlist.splice(i, 1);
    }
  }
  if (screenShake > 0) screenShake--;
  B_Ticker();
  G_CheckDelayedExit();
}

function P_SpawnSpecials() {
  buttonlist = [];
  linespeciallist = [];
  for (const sector of sectors) {
    if (!sector.special) continue;
    switch (sector.special) {
      case 1: P_SpawnLightFlash(sector); break;
      case 2: P_SpawnStrobeFlash(sector, 15, 0); break;   // FASTDARK
      case 3: P_SpawnStrobeFlash(sector, 35, 0); break;   // SLOWDARK
      case 4: P_SpawnStrobeFlash(sector, 15, 0); sector.special = 4; break;
      case 8: P_SpawnGlowingLight(sector); break;
      case 9: totalsecret++; break;
      case 10: P_SpawnDoorCloseIn30(sector); break;
      case 12: P_SpawnStrobeFlash(sector, 35, 1); break;
      case 13: P_SpawnStrobeFlash(sector, 15, 1); break;
      case 17: P_SpawnFireFlicker(sector); break;
    }
  }
  for (const line of lines) {
    if (line.special === 48) linespeciallist.push(line);
  }
}

// --- Especiales propios de Atenea --------------------------------------------------------------------------
// Voladura: explosiones escalonadas en los puntos VOLADURA con el mismo tag.
function EV_Voladura(line) {
  const spots = [];
  for (let th = thinkercap.next; th !== thinkercap; th = th.next) {
    if (th.isMobj && !th.removed && th.type === MT.VOLADURA && th.tag === line.tag) spots.push(th);
  }
  let delay = 0;
  for (const s of spots) {
    const t = { func: T_Voladura, x: s.x, y: s.y, z: s.subsector.sector.floorheight + 16, timer: delay + 1 };
    P_AddThinker(t);
    delay += 6 + (P_Random() & 7);
  }
  if (spots.length) {
    P_ShakeScreen(40);
    HU_PlayerMessage(players[0], '¡Vuela el polvorín!');
  }
}

function T_Voladura(t) {
  if (--t.timer > 0) return;
  P_Detonate(t.x, t.y, t.z, 140, FACTION_CHILE);   // el polvorín aliado arrasa a sus defensores
  P_RemoveThinker(t);
}

let screenShake = 0;
function P_ShakeScreen(tics) {
  if (tics > screenShake) screenShake = tics;
}

function P_ShowLevelMessage(tag) {
  const txt = levelmessages[tag];
  if (!txt) return;
  HU_ShowBigMessage(txt);
  S_StartSound(null, 'bugle');
}
