// =============================================================================
// p_inter.js — Recoger objetos, recibir daño y morir (p_inter.c)
// =============================================================================
'use strict';

const BONUSADD = 6;

function P_GiveAmmo(player, ammo, num) {
  if (ammo === am_noammo) return false;
  if (player.ammo[ammo] === player.maxammo[ammo]) return false;
  if (num) num *= clipammo[ammo];
  else num = clipammo[ammo] / 2;
  if (gameskill === sk_baby || gameskill === sk_nightmare) num <<= 1;
  const oldammo = player.ammo[ammo];
  player.ammo[ammo] += num;
  if (player.ammo[ammo] > player.maxammo[ammo]) player.ammo[ammo] = player.maxammo[ammo];
  // Si estaba sin munición, cambiar al arma recién abastecida (como DOOM).
  if (oldammo) return true;
  switch (ammo) {
    case am_revolver:
      if (player.readyweapon === wp_corvo) player.pendingweapon = wp_revolver;
      break;
    case am_fusil:
      if (player.readyweapon === wp_corvo || player.readyweapon === wp_revolver) {
        if (player.weaponowned[wp_comblain]) player.pendingweapon = wp_comblain;
      }
      break;
    case am_dinamita:
      if (player.readyweapon === wp_corvo && player.weaponowned[wp_dinamita]) player.pendingweapon = wp_dinamita;
      break;
  }
  return true;
}

function P_GiveWeapon(player, weapon, dropped) {
  let gaveammo = false;
  const ammo = weaponinfo[weapon].ammo;
  if (ammo !== am_noammo) {
    gaveammo = dropped ? P_GiveAmmo(player, ammo, 1) : P_GiveAmmo(player, ammo, 2);
  }
  let gaveweapon = false;
  if (!player.weaponowned[weapon]) {
    gaveweapon = true;
    player.weaponowned[weapon] = true;
    player.pendingweapon = weapon;
  }
  return gaveweapon || gaveammo;
}

function P_GiveBody(player, num) {
  if (player.health >= MAXHEALTH) return false;
  player.health += num;
  if (player.health > MAXHEALTH) player.health = MAXHEALTH;
  player.mo.health = player.health;
  return true;
}

function P_GiveArmor(player, armortype) {
  const hits = armortype * 100;
  if (player.armorpoints >= hits) return false;
  player.armortype = armortype;
  player.armorpoints = hits;
  return true;
}

function P_GivePower(player, power) {
  if (power === pw_chupilca) {
    P_GiveBody(player, 100);
    player.powers[power] = 1;
    return true;
  }
  if (player.powers[power]) return false;
  player.powers[power] = 1;
  return true;
}

function P_TouchSpecialThing(special, toucher) {
  const delta = special.z - toucher.z;
  if (delta > toucher.height || delta < -8) return;   // fuera de alcance
  let sound = 'itemup';
  const player = toucher.player;
  if (!player || toucher.health <= 0) return;
  const t = special.type;
  const dropped = !!(special.flags & MF_DROPPED);
  switch (t) {
    // --- Moral (armadura) ---
    case MT.ESTANDARTE:
      if (!P_GiveArmor(player, 1)) return;
      HU_PlayerMessage(player, '¡El estandarte del regimiento levanta tu moral!');
      break;
    case MT.BANDERA:
      if (!P_GiveArmor(player, 2)) return;
      HU_PlayerMessage(player, '¡La bandera de Chile! Tu moral está por las nubes.');
      break;
    case MT.ESCAPULARIO:
      player.armorpoints++;
      if (player.armorpoints > 200) player.armorpoints = 200;
      if (!player.armortype) player.armortype = 1;
      HU_PlayerMessage(player, 'Recogiste un escapulario del Carmen.');
      break;
    // --- Salud ---
    case MT.CHARQUI:
      player.health++;
      if (player.health > 200) player.health = 200;
      player.mo.health = player.health;
      HU_PlayerMessage(player, 'Comiste una ración de charqui.');
      break;
    case MT.CARAMAYOLA:
      if (!P_GiveBody(player, 10)) return;
      HU_PlayerMessage(player, 'Bebiste de una caramayola. Agua del desierto.');
      break;
    case MT.BOTIQUIN:
      if (player.health < 25) {
        if (!P_GiveBody(player, 25)) return;
        HU_PlayerMessage(player, '¡Usaste un botiquín que REALMENTE necesitabas!');
      } else {
        if (!P_GiveBody(player, 25)) return;
        HU_PlayerMessage(player, 'Usaste un botiquín de campaña.');
      }
      break;
    // --- Poderes ---
    case MT.CHUPILCA:
      if (!P_GivePower(player, pw_chupilca)) return;
      HU_PlayerMessage(player, '¡Chupilca del diablo! Aguardiente con pólvora, dice la leyenda.');
      if (player.readyweapon !== wp_corvo) player.pendingweapon = wp_corvo;
      sound = 'getpow';
      break;
    case MT.PLANO:
      if (!P_GivePower(player, pw_allmap)) return;
      HU_PlayerMessage(player, (levelinfo && levelinfo.mapItemName) || 'Recogiste un plano del terreno.');
      sound = 'getpow';
      break;
    // --- Munición ---
    case MT.CART_REV:
      if (!P_GiveAmmo(player, am_revolver, dropped ? 0 : 1)) return;
      HU_PlayerMessage(player, 'Recogiste cartuchos de revólver.');
      break;
    case MT.CAJA_REV:
      if (!P_GiveAmmo(player, am_revolver, 5)) return;
      HU_PlayerMessage(player, 'Recogiste una caja de cartuchos de revólver.');
      break;
    case MT.CARTUCHOS:
      if (!P_GiveAmmo(player, am_fusil, dropped ? 0 : 1)) return;
      HU_PlayerMessage(player, 'Recogiste cartuchos de 11 mm.');
      break;
    case MT.CAJA_FUS:
      if (!P_GiveAmmo(player, am_fusil, 5)) return;
      HU_PlayerMessage(player, 'Recogiste una caja de cartuchos de 11 mm.');
      break;
    case MT.DINAMITA1:
      if (!P_GiveAmmo(player, am_dinamita, 1)) return;
      HU_PlayerMessage(player, 'Recogiste un cartucho de dinamita.');
      break;
    case MT.CAJA_DIN:
      if (!P_GiveAmmo(player, am_dinamita, 5)) return;
      HU_PlayerMessage(player, 'Recogiste un cajón de dinamita.');
      break;
    case MT.MOCHILA:
      if (!player.backpack) {
        for (let i = 0; i < NUMAMMO; i++) player.maxammo[i] *= 2;
        player.backpack = true;
      }
      for (let i = 0; i < NUMAMMO; i++) P_GiveAmmo(player, i, 1);
      HU_PlayerMessage(player, '¡Una mochila de campaña llena de munición!');
      break;
    // --- Armas ---
    case MT.FUSIL:
      if (!P_GiveWeapon(player, wp_comblain, dropped)) return;
      HU_PlayerMessage(player, '¡Tienes un fusil Comblain II!');
      sound = 'wpnup';
      break;
    case MT.GATLING:
      if (!P_GiveWeapon(player, wp_gatling, dropped)) return;
      HU_PlayerMessage(player, '¡Tienes una ametralladora Gatling!');
      sound = 'wpnup';
      break;
    case MT.DINAMITA_W:
      if (!P_GiveWeapon(player, wp_dinamita, dropped)) return;
      HU_PlayerMessage(player, '¡Tienes cartuchos de dinamita!');
      sound = 'wpnup';
      break;
    default:
      return;
  }
  if (special.flags & MF_COUNTITEM) player.itemcount++;
  P_RemoveMobj(special);
  player.bonuscount += BONUSADD;
  S_StartSound(null, sound);
}

function P_KillMobj(source, target) {
  if (target.type === MT.BARRIL) target.target = source; // la explosión se atribuye a quien disparó
  target.flags &= ~(MF_SHOOTABLE | MF_FLOAT | MF_SKULLFLY);
  target.flags &= ~MF_NOGRAVITY;
  target.flags |= MF_CORPSE | MF_DROPOFF;
  target.height /= 4;
  if (source && source.player) {
    if (target.flags & MF_COUNTKILL) source.player.killcount++;
  } else if (target.flags & MF_COUNTKILL) {
    players[0].killcount++;
  }
  if (target.player) {
    target.flags &= ~MF_SOLID;
    target.player.playerstate = PST_DEAD;
    P_DropWeapon(target.player);
    if (automapactive) AM_Stop();
  }
  if (P_blastSpot && target.info.gib && !target.player) {
    // Muerto por una explosión: salta en pedazos, sin animación de caída.
    P_Dismember(target, P_blastSpot, P_blastDist);
  } else {
    if (target.health < -target.info.spawnhealth && target.info.xdeathstate !== S_NULL) {
      P_SetMobjState(target, target.info.xdeathstate);
    } else {
      P_SetMobjState(target, target.info.deathstate);
    }
    if (target.removed) return;
    target.tics -= P_Random() & 3;
    if (target.tics < 1) target.tics = 1;
  }
  const drop = target.info.dropitem;
  if (drop && MT[drop] !== undefined) {
    const mo = P_SpawnMobj(target.x, target.y, ONFLOORZ, MT[drop]);
    mo.flags |= MF_DROPPED;
  }
}

function P_DamageMobj(target, inflictor, source, damage) {
  if (!(target.flags & MF_SHOOTABLE)) return;
  if (target.health <= 0) return;
  if (source && source !== target && B_SameFaction(source, target)) return;   // sin fuego amigo
  // Batallas masivas: el fuego entre tropas de la IA hiere menos (40 %); la
  // batalla dura más y el tiro del jugador decide.
  if (battle && battle.massive && source && !source.player && !target.player) damage = Math.max(1, Math.round(damage * 0.4));
  const player = target.player;
  if (player && gameskill === sk_baby) damage >>= 1;
  if (inflictor && !(target.flags & MF_NOCLIP) && !(target.flags & MF_TURRET)) {
    let ang = R_PointToAngle2(inflictor.x, inflictor.y, target.x, target.y);
    let thrust = damage * (1 / 8) * 100 / target.info.mass;
    if (damage < 40 && damage > target.health && target.z - inflictor.z > 64 && (P_Random() & 1)) {
      ang = (ang + ANG180) >>> 0;
      thrust *= 4;
    }
    target.momx += thrust * FineCos(ang);
    target.momy += thrust * FineSin(ang);
  }
  if (player) {
    if (damage < 1000 && (player.cheats & CF_GODMODE)) return;
    if (player.armortype) {
      let saved = player.armortype === 1 ? Math.floor(damage / 3) : Math.floor(damage / 2);
      if (player.armorpoints <= saved) {
        saved = player.armorpoints;
        player.armortype = 0;
      }
      player.armorpoints -= saved;
      damage -= saved;
    }
    player.health -= damage;
    if (player.health < 0) player.health = 0;
    player.attacker = source;
    player.damagecount += damage;
    if (player.damagecount > 100) player.damagecount = 100;
  }
  target.health -= damage;
  if (target.health <= 0) {
    P_KillMobj(source, target);
    return;
  }
  if (P_Random() < target.info.painchance && !(target.flags & MF_SKULLFLY)) {
    target.flags |= MF_JUSTHIT;
    P_SetMobjState(target, target.info.painstate);
  }
  target.reactiontime = 0;
  if (!target.threshold && source && source !== target && B_Hostile(source, target) && !target.player) {
    target.target = source;
    target.threshold = BASETHRESHOLD;
    if (target.state === states[target.info.spawnstate] && target.info.seestate !== S_NULL) {
      P_SetMobjState(target, target.info.seestate);
    }
  }
}
