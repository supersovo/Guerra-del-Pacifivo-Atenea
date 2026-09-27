// =============================================================================
// p_enemy.js — Inteligencia de los enemigos (p_enemy.c)
// -----------------------------------------------------------------------------
// Como en DOOM: los enemigos esperan (A_Look) hasta ver u oír al jugador; el
// ruido de los disparos se propaga por los sectores (P_NoiseAlert). Luego
// persiguen (A_Chase) eligiendo entre 8 direcciones, y atacan cuando la
// distancia y la suerte (P_Random) lo permiten.
// =============================================================================
'use strict';

const opposite = [DI_WEST, DI_SOUTHWEST, DI_SOUTH, DI_SOUTHEAST, DI_EAST, DI_NORTHEAST, DI_NORTH, DI_NORTHWEST, DI_NODIR];
const diags = [DI_NORTHWEST, DI_NORTHEAST, DI_SOUTHWEST, DI_SOUTHEAST];
const xspeed = [1, 47000 / 65536, 0, -47000 / 65536, -1, -47000 / 65536, 0, 47000 / 65536];
const yspeed = [0, 47000 / 65536, 1, 47000 / 65536, 0, -47000 / 65536, -1, -47000 / 65536];

// --- Propagación del sonido (P_RecursiveSound) --------------------------------------------
let soundtarget = null;
let soundx = 0, soundy = 0;

function P_RecursiveSound(sec, soundblocks) {
  if (sec.validcount === validcount && sec.soundtraversed <= soundblocks + 1) return;
  // En campo abierto el ruido no llega a todo el mapa.
  if (P_AproxDistance(sec.soundorg.x - soundx, sec.soundorg.y - soundy) > NOISE_RANGE + 256) return;
  sec.validcount = validcount;
  sec.soundtraversed = soundblocks + 1;
  sec.soundtarget = soundtarget;
  for (let i = 0; i < sec.linecount; i++) {
    const check = sec.lines[i];
    if (!(check.flags & ML_TWOSIDED)) continue;
    P_LineOpening(check);
    const bothsky = check.frontsector.ceilingpic === skyflatnum && check.backsector.ceilingpic === skyflatnum;
    if (openrange <= 0 && !bothsky) continue;
    const other = check.frontsector === sec ? check.backsector : check.frontsector;
    if (check.flags & ML_SOUNDBLOCK) {
      if (!soundblocks) P_RecursiveSound(other, 1);
    } else {
      P_RecursiveSound(other, soundblocks);
    }
  }
}

function P_NoiseAlert(target, emitter) {
  soundtarget = target;
  soundx = emitter.x; soundy = emitter.y;
  validcount++;
  P_RecursiveSound(emitter.subsector.sector, 0);
}

// --- Comprobaciones de rango ------------------------------------------------------------------
function P_CheckMeleeRange(actor) {
  const pl = actor.target;
  if (!pl) return false;
  const dist = P_AproxDistance(pl.x - actor.x, pl.y - actor.y);
  if (dist >= MELEERANGE - 20 + pl.info.radius) return false;
  if (Math.abs(pl.z - actor.z) > 64) return false;
  if (!P_CheckSight(actor, actor.target)) return false;
  return true;
}

function P_CheckMissileRange(actor) {
  if (!P_CheckSight(actor, actor.target)) return false;
  if (actor.flags & MF_JUSTHIT) {
    actor.flags &= ~MF_JUSTHIT;
    return true;
  }
  if (actor.reactiontime) return false;
  let dist = P_AproxDistance(actor.x - actor.target.x, actor.y - actor.target.y) - 64;
  if (actor.info.meleestate === S_NULL) dist -= 128;
  if (actor.type === MT.ARTILLERO) dist >>= 2;              // la artillería dispara de lejos
  if (actor.type === MT.OFICIAL && dist > 14 * 64) return false;
  if (actor.type === MT.DINAMITERO && dist > 12 * 64) return false;
  if (dist > 200) dist = 200;
  if (P_Random() < dist) return false;
  return true;
}

// --- Movimiento ---------------------------------------------------------------------------------
function P_Move(actor) {
  if (actor.movedir === DI_NODIR) return false;
  if (actor.flags & MF_TURRET) return false;
  const tryx = actor.x + actor.info.speed * xspeed[actor.movedir];
  const tryy = actor.y + actor.info.speed * yspeed[actor.movedir];
  const try_ok = P_TryMove(actor, tryx, tryy);
  if (!try_ok) {
    if ((actor.flags & MF_FLOAT) && floatok) {
      if (actor.z < tmfloorz) actor.z += 4; else actor.z -= 4;
      actor.flags |= MF_INFLOAT;
      return true;
    }
    if (!spechit.length) return false;
    actor.movedir = DI_NODIR;
    let good = false;
    const hits = spechit.slice();
    for (let i = hits.length - 1; i >= 0; i--) {
      if (P_UseSpecialLine(actor, hits[i], 0)) good = true;
    }
    return good;
  }
  actor.flags &= ~MF_INFLOAT;
  if (!(actor.flags & MF_FLOAT)) actor.z = actor.floorz;
  return true;
}

function P_TryWalk(actor) {
  if (!P_Move(actor)) return false;
  actor.movecount = P_Random() & 15;
  return true;
}

function P_NewChaseDir(actor) {
  if (!actor.target) return;
  const olddir = actor.movedir;
  const turnaround = opposite[olddir];
  const deltax = actor.target.x - actor.x;
  const deltay = actor.target.y - actor.y;
  const d = [0, DI_NODIR, DI_NODIR];
  if (deltax > 10) d[1] = DI_EAST;
  else if (deltax < -10) d[1] = DI_WEST;
  if (deltay < -10) d[2] = DI_SOUTH;
  else if (deltay > 10) d[2] = DI_NORTH;
  if (d[1] !== DI_NODIR && d[2] !== DI_NODIR) {
    actor.movedir = diags[((deltay < 0 ? 1 : 0) << 1) + (deltax > 0 ? 1 : 0)];
    if (actor.movedir !== turnaround && P_TryWalk(actor)) return;
  }
  if (P_Random() > 200 || Math.abs(deltay) > Math.abs(deltax)) {
    const t = d[1]; d[1] = d[2]; d[2] = t;
  }
  if (d[1] === turnaround) d[1] = DI_NODIR;
  if (d[2] === turnaround) d[2] = DI_NODIR;
  if (d[1] !== DI_NODIR) {
    actor.movedir = d[1];
    if (P_TryWalk(actor)) return;
  }
  if (d[2] !== DI_NODIR) {
    actor.movedir = d[2];
    if (P_TryWalk(actor)) return;
  }
  if (olddir !== DI_NODIR) {
    actor.movedir = olddir;
    if (P_TryWalk(actor)) return;
  }
  if (P_Random() & 1) {
    for (let tdir = DI_EAST; tdir <= DI_SOUTHEAST; tdir++) {
      if (tdir !== turnaround) {
        actor.movedir = tdir;
        if (P_TryWalk(actor)) return;
      }
    }
  } else {
    for (let tdir = DI_SOUTHEAST; tdir >= DI_EAST; tdir--) {
      if (tdir !== turnaround) {
        actor.movedir = tdir;
        if (P_TryWalk(actor)) return;
      }
    }
  }
  if (turnaround !== DI_NODIR) {
    actor.movedir = turnaround;
    if (P_TryWalk(actor)) return;
  }
  actor.movedir = DI_NODIR;
}

// --- Acciones -------------------------------------------------------------------------------------
function A_Look(actor) {
  actor.threshold = 0;
  const targ = actor.subsector.sector.soundtarget;
  let see = false;
  if (targ && (targ.flags & MF_SHOOTABLE) && !targ.removed && targ.health > 0 && B_Hostile(actor, targ) &&
      P_AproxDistance(targ.x - actor.x, targ.y - actor.y) < NOISE_RANGE + 512) {
    actor.target = targ;
    if (actor.flags & MF_AMBUSH) {
      if (P_CheckSight(actor, actor.target)) see = true;
    } else see = true;
  }
  if (!see && !P_LookForTargets(actor, false)) return;
  if (actor.info.seesound) {
    let sound = actor.info.seesound;
    if (sound === 'posit') sound = 'posit' + (1 + P_Random() % 3);
    S_StartSound(actor, sound);
  }
  P_SetMobjState(actor, actor.info.seestate);
}

function A_Chase(actor) {
  if (actor.reactiontime) actor.reactiontime--;
  if (actor.threshold) {
    if (!actor.target || actor.target.health <= 0) actor.threshold = 0;
    else actor.threshold--;
  }
  if (actor.movedir < 8) {
    actor.angle = (actor.angle & (7 << 29)) >>> 0;
    const delta = (actor.angle - (actor.movedir << 29)) | 0;
    if (delta > 0) actor.angle = (actor.angle - ANG90 / 2) >>> 0;
    else if (delta < 0) actor.angle = (actor.angle + ANG90 / 2) >>> 0;
  }
  if (!actor.target || actor.target.removed || !(actor.target.flags & MF_SHOOTABLE)) {
    if (P_LookForTargets(actor, true)) return;
    P_SetMobjState(actor, actor.info.spawnstate);
    return;
  }
  // En batalla abierta: cambiar a un blanco visible si el actual se perdió de vista.
  if (--actor.retarget <= 0) {
    actor.retarget = 35 + (P_Random() & 31);
    if (!actor.threshold && !P_CheckSight(actor, actor.target)) {
      const old = actor.target;
      if (!P_LookForTargets(actor, true)) actor.target = old;
    }
  }
  if (actor.flags & MF_JUSTATTACKED) {
    actor.flags &= ~MF_JUSTATTACKED;
    if (gameskill !== sk_nightmare) P_NewChaseDir(actor);
    return;
  }
  if (actor.info.meleestate !== S_NULL && P_CheckMeleeRange(actor)) {
    if (actor.info.attacksound) S_StartSound(actor, actor.info.attacksound);
    P_SetMobjState(actor, actor.info.meleestate);
    return;
  }
  if (actor.info.missilestate !== S_NULL) {
    if (!(gameskill < sk_nightmare && actor.movecount)) {
      if (P_CheckMissileRange(actor)) {
        P_SetMobjState(actor, actor.info.missilestate);
        actor.flags |= MF_JUSTATTACKED;
        return;
      }
    }
  }
  if (--actor.movecount < 0 || !P_Move(actor)) P_NewChaseDir(actor);
  if (actor.info.activesound && P_Random() < 3) S_StartSound(actor, actor.info.activesound);
}

// Artillería: no se desplaza; gira hacia el blanco y dispara cuando puede.
function A_TurretChase(actor) {
  if (actor.reactiontime) actor.reactiontime--;
  if (!actor.target || actor.target.removed || !(actor.target.flags & MF_SHOOTABLE)) {
    if (P_LookForTargets(actor, true)) return;
    P_SetMobjState(actor, actor.info.spawnstate);
    return;
  }
  if (--actor.retarget <= 0) {
    actor.retarget = 50 + (P_Random() & 31);
    if (!P_CheckSight(actor, actor.target)) {
      const old = actor.target;
      if (!P_LookForTargets(actor, true)) actor.target = old;
    }
  }
  const want = R_PointToAngle2(actor.x, actor.y, actor.target.x, actor.target.y);
  const delta = (want - actor.angle) | 0;
  const step = ANG45 / 4;
  if (Math.abs(delta) <= step) actor.angle = want;
  else actor.angle = (actor.angle + (delta > 0 ? step : -step)) >>> 0;
  if (Math.abs(delta) < ANG45 && P_CheckMissileRange(actor)) {
    P_SetMobjState(actor, actor.info.missilestate);
  }
}

function A_FaceTarget(actor) {
  if (!actor.target) return;
  actor.flags &= ~MF_AMBUSH;
  actor.angle = R_PointToAngle2(actor.x, actor.y, actor.target.x, actor.target.y);
  if (actor.target.flags & MF_SHADOW) actor.angle = (actor.angle + ((P_Random() - P_Random()) << 21)) >>> 0;
}

// Guardia Nacional: un tiro de fusil Peabody/Castañón.
function A_RifleAttack(actor) {
  if (!actor.target) return;
  A_FaceTarget(actor);
  let angle = actor.angle;
  const slope = P_AimLineAttack(actor, angle, MISSILERANGE);
  S_StartSound(actor, 'rifle2');
  angle = (angle + ((P_Random() - P_Random()) << 20)) >>> 0;
  const damage = ((P_Random() % 5) + 1) * 3;
  P_LineAttack(actor, angle, MISSILERANGE, slope, damage);
}

// Infante boliviano: Remington de bloque rodante, algo más certero y dañino.
function A_RemingtonAttack(actor) {
  if (!actor.target) return;
  A_FaceTarget(actor);
  let angle = actor.angle;
  const slope = P_AimLineAttack(actor, angle, MISSILERANGE);
  S_StartSound(actor, 'rifle2');
  angle = (angle + ((P_Random() - P_Random()) << 19)) >>> 0;
  const damage = ((P_Random() % 5) + 1) * 4;
  P_LineAttack(actor, angle, MISSILERANGE, slope, damage);
}

function A_BayonetAttack(actor) {
  if (!actor.target) return;
  A_FaceTarget(actor);
  if (P_CheckMeleeRange(actor)) {
    const damage = ((P_Random() % 8) + 1) * 3;
    S_StartSound(actor, 'stab');
    P_DamageMobj(actor.target, actor, actor, damage);
  }
}

function A_SaberAttack(actor) {
  if (!actor.target) return;
  A_FaceTarget(actor);
  if (P_CheckMeleeRange(actor)) {
    const damage = ((P_Random() % 8) + 1) * (actor.type === MT.HUSAR ? 4 : 3);
    S_StartSound(actor, 'saber');
    P_DamageMobj(actor.target, actor, actor, damage);
  }
}

function A_OfficerShoot(actor) {
  if (!actor.target) return;
  A_FaceTarget(actor);
  let angle = actor.angle;
  const slope = P_AimLineAttack(actor, angle, MISSILERANGE);
  S_StartSound(actor, 'revolv');
  angle = (angle + ((P_Random() - P_Random()) << 20)) >>> 0;
  const damage = ((P_Random() % 5) + 1) * 3;
  P_LineAttack(actor, angle, MISSILERANGE, slope, damage);
}

function A_CannonFire(actor) {
  if (!actor.target) return;
  A_FaceTarget(actor);
  const mo = P_SpawnMissile(actor, actor.target, MT.GRANADA);
  // la granada sale por la boca del cañón, delante de la pieza
  if (mo && !mo.removed) {
    const smoke = P_SpawnMobj(actor.x + 36 * FineCos(actor.angle), actor.y + 36 * FineSin(actor.angle), actor.z + 30, MT.SMOKE);
    smoke.momz = 0.6;
  }
  P_NoiseAlert(actor.target, actor);
}

function A_DinamiteroThrow(actor) {
  if (!actor.target) return;
  A_FaceTarget(actor);
  P_SpawnMissile(actor, actor.target, MT.DINAMITA_P);
}

function A_ShellTrail(actor) {
  if (P_Random() < 128) {
    const s = P_SpawnMobj(actor.x - actor.momx, actor.y - actor.momy, actor.z, MT.SMOKE);
    s.momz = 0.3;
    s.tics = 4;
  }
}

function A_Scream(actor) {
  let sound = actor.info.deathsound;
  if (!sound) return;
  if (sound === 'podth') sound = 'podth' + (1 + P_Random() % 3);
  S_StartSound(actor, sound);
}

function A_XScream(actor) {
  S_StartSound(actor, 'slop');
}

function A_Pain(actor) {
  if (actor.info.painsound) S_StartSound(actor, actor.info.painsound);
}

function A_Fall(actor) {
  actor.flags &= ~MF_SOLID;
}

function A_Explode(thingy) {
  P_RadiusAttack(thingy, thingy.target, 128);
}

function A_BigExplode(thingy) {
  S_StartSound(thingy, 'explod');
  P_RadiusAttack(thingy, thingy.target, 160);
}

function A_PlayerScream(mo) {
  let sound = 'pldeth';
  if (mo.health < -50) sound = 'pdiehi';
  S_StartSound(mo, sound);
}

// --- Polvorazos (minas de Arica) ----------------------------------------------------------------
function T_MineThink(mine) {
  if (!mine.mineArmed) return;
  const p = players[0];
  if (!p || !p.mo || p.health <= 0) return;
  const mo = p.mo;
  if (Math.abs(mo.x - mine.x) < 40 && Math.abs(mo.y - mine.y) < 40 && mo.z <= mine.subsector.sector.floorheight + 8) {
    mine.mineArmed = false;
    const fx = P_SpawnMobj(mine.x, mine.y, mine.subsector.sector.floorheight, MT.MINAFX);
    fx.target = null;
    P_RemoveMobj(mine);
  }
}

function A_MineClick(fx) {
  S_StartSound(fx, 'click');
  HU_PlayerMessage(players[0], '¡Clic! ¡Un polvorazo!');
}

function A_MineDetonate(fx) {
  const b = P_SpawnMobj(fx.x, fx.y, fx.z + 8, MT.MINABOOM);
  b.target = null;
}

function A_MineExplode(b) {
  S_StartSound(b, 'explod');
  P_RadiusAttack(b, null, 150);
}
