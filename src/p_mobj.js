// =============================================================================
// p_mobj.js — Objetos móviles: aparición, estados y física (p_mobj.c)
// =============================================================================
'use strict';

function P_SetMobjState(mobj, state) {
  do {
    if (state === S_NULL) {
      mobj.state = null;
      P_RemoveMobj(mobj);
      return false;
    }
    const st = states[state];
    mobj.state = st;
    mobj.stateNum = state;
    mobj.tics = st.tics;
    mobj.sprite = mobj.spriteOverride !== undefined ? mobj.spriteOverride : st.sprite;
    mobj.frame = st.frame;
    if (st.action) st.action(mobj);
    if (mobj.removed) return false;
    state = st.nextstate;
  } while (!mobj.tics);
  return true;
}

function P_ExplodeMissile(mo) {
  mo.momx = mo.momy = mo.momz = 0;
  P_SetMobjState(mo, mo.info.deathstate);
  if (mo.removed) return;
  mo.tics -= P_Random() & 3;
  if (mo.tics < 1) mo.tics = 1;
  mo.flags &= ~MF_MISSILE;
  if (mo.info.deathsound) S_StartSound(mo, mo.info.deathsound);
}

function P_XYMovement(mo) {
  if (!mo.momx && !mo.momy) return;
  const player = mo.player;
  if (mo.momx > MAXMOVE) mo.momx = MAXMOVE; else if (mo.momx < -MAXMOVE) mo.momx = -MAXMOVE;
  if (mo.momy > MAXMOVE) mo.momy = MAXMOVE; else if (mo.momy < -MAXMOVE) mo.momy = -MAXMOVE;
  let xmove = mo.momx, ymove = mo.momy;
  do {
    let ptryx, ptryy;
    if (Math.abs(xmove) > MAXMOVE / 2 || Math.abs(ymove) > MAXMOVE / 2) {
      ptryx = mo.x + xmove / 2;
      ptryy = mo.y + ymove / 2;
      xmove /= 2; ymove /= 2;
    } else {
      ptryx = mo.x + xmove;
      ptryy = mo.y + ymove;
      xmove = ymove = 0;
    }
    if (!P_TryMove(mo, ptryx, ptryy)) {
      if (mo.player) {
        P_SlideMove(mo);
      } else if (mo.flags & MF_MISSILE) {
        // Truco del cielo: un proyectil que choca contra el cielo desaparece.
        if (ceilingline && ceilingline.backsector && ceilingline.backsector.ceilingpic === skyflatnum &&
            mo.z + mo.height > ceilingline.backsector.ceilingheight) {
          P_RemoveMobj(mo);
          return;
        }
        P_ExplodeMissile(mo);
      } else if (mo.flags & MF_GIB) {
        mo.momx *= -0.3;   // un resto rebota contra el muro
        mo.momy *= -0.3;
        xmove = ymove = 0;
      } else {
        mo.momx = mo.momy = 0;
      }
    }
    if (mo.removed) return;
  } while (xmove || ymove);

  if (player && (player.cheats & CF_NOMOMENTUM)) { mo.momx = mo.momy = 0; return; }
  if (mo.flags & (MF_MISSILE | MF_SKULLFLY)) return;
  if (mo.z > mo.floorz) return;
  if (mo.flags & MF_CORPSE) {
    if ((mo.momx > 0.25 || mo.momx < -0.25 || mo.momy > 0.25 || mo.momy < -0.25) &&
        mo.floorz !== mo.subsector.sector.floorheight) return;
  }
  if (mo.momx > -STOPSPEED && mo.momx < STOPSPEED && mo.momy > -STOPSPEED && mo.momy < STOPSPEED &&
      (!player || (player.cmd.forwardmove === 0 && player.cmd.sidemove === 0))) {
    if (player && mo.stateNum >= S_('S_PLAY_RUN1') && mo.stateNum <= S_('S_PLAY_RUN4')) P_SetMobjState(player.mo, S_('S_PLAY'));
    mo.momx = mo.momy = 0;
  } else {
    const f = (mo.flags & MF_GIB) ? 0.7 : FRICTION;   // los restos no resbalan lejos
    mo.momx *= f;
    mo.momy *= f;
  }
}

function P_ZMovement(mo) {
  if (mo.player && mo.z < mo.floorz) {
    mo.player.viewheight -= mo.floorz - mo.z;
    mo.player.deltaviewheight = (VIEWHEIGHT - mo.player.viewheight) / 8;
  }
  mo.z += mo.momz;
  if (mo.flags & MF_FLOAT && mo.target) {
    if (!(mo.flags & MF_SKULLFLY) && !(mo.flags & MF_INFLOAT)) {
      const dist = P_AproxDistance(mo.x - mo.target.x, mo.y - mo.target.y);
      const delta = (mo.target.z + (mo.height / 2)) - mo.z;
      if (delta < 0 && dist < -(delta * 3)) mo.z -= 4;
      else if (delta > 0 && dist < (delta * 3)) mo.z += 4;
    }
  }
  if (mo.z <= mo.floorz) {
    if (mo.momz < 0) {
      if (mo.player && mo.momz < -GRAVITY * 8) {
        mo.player.deltaviewheight = mo.momz / 8;
        S_StartSound(mo, 'oof');
      }
      if ((mo.flags & MF_GIB) && mo.momz < -2.5) {
        // Un resto que cae rebota, pierde fuerza y deja una mancha.
        mo.momz = -mo.momz * 0.35;
        mo.momx *= 0.6;
        mo.momy *= 0.6;
        P_SpawnBlood(mo.x, mo.y, mo.floorz + 2, 6);
      } else {
        mo.momz = 0;
      }
    }
    mo.z = mo.floorz;
    if ((mo.flags & MF_MISSILE) && !(mo.flags & MF_NOCLIP)) {
      P_ExplodeMissile(mo);
      return;
    }
  } else if (!(mo.flags & MF_NOGRAVITY)) {
    if (mo.momz === 0) mo.momz = -GRAVITY * 2;
    else mo.momz -= GRAVITY * ((mo.flags & MF_LOBBED) ? 0.5 : 1);
  }
  if (mo.z + mo.height > mo.ceilingz) {
    if (mo.momz > 0) mo.momz = 0;
    mo.z = mo.ceilingz - mo.height;
    if ((mo.flags & MF_MISSILE) && !(mo.flags & MF_NOCLIP)) {
      if (mo.subsector.sector.ceilingpic === skyflatnum) { P_RemoveMobj(mo); return; }
      P_ExplodeMissile(mo);
    }
  }
}

function P_MobjThinker(mobj) {
  if (mobj.momx || mobj.momy || (mobj.flags & MF_SKULLFLY)) {
    P_XYMovement(mobj);
    if (mobj.removed) return;
  }
  if (mobj.z !== mobj.floorz || mobj.momz) {
    P_ZMovement(mobj);
    if (mobj.removed) return;
  }
  if (mobj.tics !== -1) {
    mobj.tics--;
    if (!mobj.tics) P_SetMobjState(mobj, mobj.state.nextstate);
  }
}

let mobjSerial = 0;

function P_SpawnMobj(x, y, z, type) {
  const info = mobjinfo[type];
  const mo = {
    isMobj: true, serial: ++mobjSerial,
    type: type, info: info, x: x, y: y, z: 0, angle: 0,
    radius: info.radius, height: info.height, flags: info.flags, health: info.spawnhealth,
    momx: 0, momy: 0, momz: 0,
    reactiontime: gameskill !== sk_nightmare ? info.reactiontime : 0,
    lastlook: 0, state: null, stateNum: 0, sprite: 0, frame: 0, tics: 0,
    target: null, tracer: null, player: null, movedir: 0, movecount: 0, threshold: 0,
    snext: null, sprev: null, bnext: null, bprev: null, subsector: null,
    floorz: 0, ceilingz: 0, validcount: 0, spawnpoint: null, translation: null,
    oldx: x, oldy: y, oldz: 0, oldangle: 0, oldvalid: false,
    func: P_MobjThinker, prev: null, next: null, removed: false, soundHandle: null
  };
  const st = states[info.spawnstate];
  mo.state = st;
  mo.stateNum = info.spawnstate;
  mo.tics = st.tics;
  mo.sprite = st.sprite;
  mo.frame = st.frame;
  P_SetThingPosition(mo);
  mo.floorz = mo.subsector.sector.floorheight;
  mo.ceilingz = mo.subsector.sector.ceilingheight;
  if (z === ONFLOORZ) mo.z = mo.floorz;
  else if (z === ONCEILINGZ) mo.z = mo.ceilingz - info.height;
  else mo.z = z;
  mo.oldz = mo.z;
  mo.retarget = P_Random() & 31;
  P_AddThinker(mo);
  if ((mo.flags & MF_SHOOTABLE) && info.faction) B_Register(mo);
  return mo;
}

function P_RemoveMobj(mobj) {
  if (mobj.removed) return;
  P_UnsetThingPosition(mobj);
  S_StopSound(mobj);
  P_RemoveThinker(mobj);
}

// --- Aparición del jugador y de las cosas del mapa -------------------------------------
function P_SpawnPlayer(mthing) {
  const p = players[0];
  if (p.playerstate === PST_REBORN) G_PlayerReborn(0);
  const mobj = P_SpawnMobj(mthing.x, mthing.y, ONFLOORZ, MT.PLAYER);
  mobj.angle = DegToBAM(mthing.angle);
  mobj.oldangle = mobj.angle;
  mobj.player = p;
  mobj.health = p.health;
  p.mo = mobj;
  p.playerstate = PST_LIVE;
  p.refire = 0;
  p.message = null;
  p.damagecount = 0;
  p.bonuscount = 0;
  p.extralight = 0;
  p.fixedcolormap = -1;
  p.viewheight = VIEWHEIGHT;
  p.viewz = mobj.z + VIEWHEIGHT;
  p.oldviewz = p.viewz;
  P_SetupPsprites(p);
  ST_Start();
  HU_Start();
}

function P_SpawnMapThing(mthing, skill) {
  const type = P_TypeForDoomedNum(mthing.type === 'PLAYER1' ? 1 : mthing.type);
  if (type < 0) {
    console.warn('P_SpawnMapThing: tipo desconocido ' + mthing.type);
    return;
  }
  if (type === MT.PLAYER) {
    playerstarts.push(mthing);
    P_SpawnPlayer(mthing);
    return;
  }
  let bit;
  if (gameskill === sk_baby) bit = 1;
  else if (gameskill === sk_nightmare) bit = 4;
  else bit = 1 << (gameskill - 1);
  if (!(mthing.options & bit)) return;
  const info = mobjinfo[type];
  const z = (info.flags & MF_SPAWNCEILING) ? ONCEILINGZ : ONFLOORZ;
  const mobj = P_SpawnMobj(mthing.x, mthing.y, z, type);
  mobj.spawnpoint = mthing;
  mobj.tag = mthing.tag || 0;
  if (mobj.tics > 0) mobj.tics = 1 + (P_Random() % mobj.tics);
  if (mobj.flags & MF_COUNTKILL) totalkills++;
  if (mobj.flags & MF_COUNTITEM) totalitems++;
  mobj.angle = DegToBAM(Math.round(mthing.angle / 45) * 45);
  mobj.oldangle = mobj.angle;
  if (mthing.options & MTF_AMBUSH) mobj.flags |= MF_AMBUSH;
  if (type === MT.MINA) {
    mobj.func = T_MineThink;
    mobj.mineArmed = true;
  }
  if (type === MT.PUNTO) B_RegisterSpawnPoint(mobj);
  if (mthing.hold) {
    mobj.holdPosition = true;
    mobj.home = [mobj.x, mobj.y];
  }
  if (mthing.goal) B_SetGoal(mobj, mthing.goal[0], mthing.goal[1]);
  if (mobj.tag && (mobj.flags & MF_COUNTKILL)) B_CountTagged(mobj);
}

// --- Efectos -----------------------------------------------------------------------------
function P_SpawnPuff(x, y, z) {
  z += (P_Random() - P_Random()) / 64;
  const th = P_SpawnMobj(x, y, z, MT.PUFF);
  th.momz = 1;
  th.tics -= P_Random() & 3;
  if (th.tics < 1) th.tics = 1;
  if (attackrange === MELEERANGE) P_SetMobjState(th, S_('S_PUFF3'));
  else if (P_Random() < 40) S_StartSound(th, 'ricoch');
}

function P_SpawnBlood(x, y, z, damage) {
  z += (P_Random() - P_Random()) / 64;
  const th = P_SpawnMobj(x, y, z, MT.BLOOD);
  th.momz = 2;
  th.tics -= P_Random() & 3;
  if (th.tics < 1) th.tics = 1;
  if (damage <= 12 && damage >= 9) P_SetMobjState(th, S_('S_BLOOD2'));
  else if (damage < 9) P_SetMobjState(th, S_('S_BLOOD3'));
}

// --- Desmembramiento (extensión Atenea) ------------------------------------------------------
// Quien muere por una explosión salta en pedazos: cabeza, brazos y piernas
// (sprites GH/GB/GP + código del uniforme) salen despedidos desde el punto de
// impacto, dan vueltas, rebotan y quedan en el suelo; en el lugar queda el
// tronco destrozado (GT). Del jinete o del artillero quedan el caballo muerto
// o la pieza sola (gibstate). Los caídos cercanos al impacto también se
// despedazan. Se limita la cantidad de restos para no cargar las batallas.
const MAXGIBS = 256;
let gibList = [];

function P_SpawnGib(target, part, ang, power, zfrac) {
  const spr = spritelookup.get('G' + part + target.info.gib);
  if (spr === undefined) return null;
  const mo = P_SpawnMobj(target.x + (P_Random() - 128) / 16, target.y + (P_Random() - 128) / 16,
    target.z + target.info.height * zfrac, MT.GIB);
  mo.spriteOverride = spr;
  if (part === 'T') {
    P_SetMobjState(mo, S_('S_REMAINS'));
  } else {
    P_SetMobjState(mo, S_('S_GIB1') + (P_Random() & 3));
    mo.tics = 1 + (P_Random() & 3);
  }
  const a = (ang + ((P_Random() - P_Random()) << 21)) >>> 0;
  const sp = power * (0.6 + P_Random() / 360);
  mo.momx = sp * FineCos(a);
  mo.momy = sp * FineSin(a);
  mo.momz = part === 'T' ? power * 0.4 : 3 + power * (0.8 + P_Random() / 512);
  gibList.push(mo);
  if (gibList.length > MAXGIBS) P_RemoveMobj(gibList.shift());
  return mo;
}

function P_Dismember(target, spot, dist) {
  const kind = target.info.gibkind || 'human';
  const ang = dist < 8 ? ((P_Random() << 24) >>> 0) : R_PointToAngle2(spot.x, spot.y, target.x, target.y);
  const power = 6.5 * Math.max(0.45, Math.min(1.25, 1.25 - dist / 150));
  const rider = kind === 'rider';
  const zh = rider ? 0.97 : 0.9, zb = rider ? 0.8 : 0.68, zp = rider ? 0.6 : 0.3;
  P_SpawnGib(target, 'H', ang, power * 1.1, zh);
  P_SpawnGib(target, 'B', ang, power, zb);
  P_SpawnGib(target, 'B', ang, power, zb);
  P_SpawnGib(target, 'P', ang, power * 0.8, zp);
  if (!rider) P_SpawnGib(target, 'P', ang, power * 0.8, zp);
  for (let i = 0; i < 6; i++) {
    const b = P_SpawnMobj(target.x, target.y, target.z + target.info.height * 0.5, MT.BLOOD);
    b.momx = (P_Random() - P_Random()) / 32;
    b.momy = (P_Random() - P_Random()) / 32;
    b.momz = 2 + P_Random() / 64;
  }
  S_StartSound(target, 'slop');
  target.gibbed = true;
  target.flags &= ~MF_SOLID;
  if (kind === 'human') {
    // En el lugar queda el tronco: el mismo mobj, ya sin animación de caída.
    target.spriteOverride = spritelookup.get('GT' + target.info.gib);
    target.momx *= 0.35;
    target.momy *= 0.35;
    P_SetMobjState(target, S_('S_REMAINS'));
  } else {
    // El caballo o la pieza quedan solos; el tronco del hombre cae al lado.
    P_SpawnGib(target, 'T', ang, power * 0.5, rider ? 0.6 : 0.3);
    if (target.info.gibstate) P_SetMobjState(target, target.info.gibstate);
  }
}

// Un resto en vuelo gotea sangre; al quedar quieto en el suelo, reposa.
function A_GibFly(mo) {
  if (mo.z > mo.floorz || mo.momz > 0) {
    if (P_Random() < 60) {
      const b = P_SpawnMobj(mo.x, mo.y, mo.z, MT.BLOOD);
      P_SetMobjState(b, S_('S_BLOOD3'));
    }
    return;
  }
  if (Math.abs(mo.momx) + Math.abs(mo.momy) < 1.2) {
    mo.momx = mo.momy = 0;
    P_SetMobjState(mo, S_('S_GIB_REST'));
  }
}

function P_CheckMissileSpawn(th) {
  th.tics -= P_Random() & 3;
  if (th.tics < 1) th.tics = 1;
  th.x += th.momx / 2;
  th.y += th.momy / 2;
  th.z += th.momz / 2;
  if (!P_TryMove(th, th.x, th.y)) P_ExplodeMissile(th);
}

function P_SpawnMissile(source, dest, type) {
  const th = P_SpawnMobj(source.x, source.y, source.z + 32, type);
  if (th.info.seesound) S_StartSound(th, th.info.seesound);
  th.target = source;
  let an = R_PointToAngle2(source.x, source.y, dest.x, dest.y);
  if (dest.flags & MF_SHADOW) an = (an + ((P_Random() - P_Random()) << 20)) >>> 0;
  th.angle = an;
  const speed = th.info.speed;
  th.momx = speed * FineCos(an);
  th.momy = speed * FineSin(an);
  let dist = P_AproxDistance(dest.x - source.x, dest.y - source.y) / speed;
  if (dist < 1) dist = 1;
  if (th.flags & MF_LOBBED) {
    // Tiro parabólico: la gravedad de la dinamita es 0,5 unidades/tic².
    const t = dist;
    th.momz = (dest.z + dest.height / 2 - th.z) / t + 0.25 * t;
    if (th.momz > 14) th.momz = 14;
  } else {
    th.momz = (dest.z - source.z) / dist;
  }
  P_CheckMissileSpawn(th);
  return th;
}

function P_SpawnPlayerMissile(source, type) {
  let an = source.angle;
  let slope;
  if (source.player && source.player.freeaim) {
    // apuntado libre: se lanza hacia donde se mira
    slope = Math.tan(source.player.pitch);
    linetarget = null;
  } else slope = P_AimLineAttack(source, an, 16 * 64);
  if (!linetarget && !(source.player && source.player.freeaim)) {
    an = (an + (1 << 26)) >>> 0;
    slope = P_AimLineAttack(source, an, 16 * 64);
    if (!linetarget) {
      an = (an - (2 << 26)) >>> 0;
      slope = P_AimLineAttack(source, an, 16 * 64);
    }
    if (!linetarget) { an = source.angle; slope = 0; }
  }
  const th = P_SpawnMobj(source.x, source.y, source.z + 32, type);
  if (th.info.seesound) S_StartSound(th, th.info.seesound);
  th.target = source;
  th.angle = an;
  const speed = th.info.speed;
  th.momx = speed * FineCos(an);
  th.momy = speed * FineSin(an);
  th.momz = speed * slope;
  if (th.flags & MF_LOBBED) {
    // Lanzamiento a mano: arco hacia arriba compensado según la distancia.
    let aimdist = 256;
    if (linetarget) aimdist = P_AproxDistance(linetarget.x - source.x, linetarget.y - source.y);
    const t = Math.max(4, aimdist / speed);
    th.momz = speed * slope + 0.25 * t;
    if (th.momz > 12) th.momz = 12;
  }
  P_CheckMissileSpawn(th);
  return th;
}
