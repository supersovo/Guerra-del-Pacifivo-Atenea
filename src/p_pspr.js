// =============================================================================
// p_pspr.js — Armas en primera persona: estados y disparos (p_pspr.c)
// =============================================================================
'use strict';

let bulletslope = 0;

function P_SetPsprite(player, position, stnum) {
  const psp = player.psprites[position];
  do {
    if (!stnum) {
      psp.state = null;
      break;
    }
    const st = states[stnum];
    psp.state = st;
    psp.stateNum = stnum;
    psp.tics = st.tics;
    if (st.misc1) { psp.sx = st.misc1; psp.sy = st.misc2; }
    if (st.action) {
      st.action(player, psp);
      if (!psp.state) break;
    }
    stnum = psp.state.nextstate;
  } while (!psp.tics);
}

function P_BringUpWeapon(player) {
  if (player.pendingweapon === wp_nochange) player.pendingweapon = player.readyweapon;
  const newstate = weaponinfo[player.pendingweapon].upstate;
  player.pendingweapon = wp_nochange;
  player.psprites[ps_weapon].sy = WEAPONBOTTOM;
  P_SetPsprite(player, ps_weapon, newstate);
}

function P_CheckAmmo(player) {
  const ammo = weaponinfo[player.readyweapon].ammo;
  if (ammo === am_noammo || player.ammo[ammo] >= 1) return true;
  // Sin munición: elegir otra arma (preferencia como en DOOM).
  do {
    if (player.weaponowned[wp_gatling] && player.ammo[am_fusil]) player.pendingweapon = wp_gatling;
    else if (player.weaponowned[wp_comblain] && player.ammo[am_fusil]) player.pendingweapon = wp_comblain;
    else if (player.ammo[am_revolver]) player.pendingweapon = wp_revolver;
    else if (player.weaponowned[wp_dinamita] && player.ammo[am_dinamita]) player.pendingweapon = wp_dinamita;
    else player.pendingweapon = wp_corvo;
  } while (player.pendingweapon === wp_nochange);
  P_SetPsprite(player, ps_weapon, weaponinfo[player.readyweapon].downstate);
  return false;
}

function P_FireWeapon(player) {
  if (!P_CheckAmmo(player)) return;
  P_SetMobjState(player.mo, S_('S_PLAY_ATK1'));
  P_SetPsprite(player, ps_weapon, weaponinfo[player.readyweapon].atkstate);
  P_NoiseAlert(player.mo, player.mo);
}

function P_DropWeapon(player) {
  P_SetPsprite(player, ps_weapon, weaponinfo[player.readyweapon].downstate);
}

function A_WeaponReady(player, psp) {
  const ms = player.mo.stateNum;
  if (ms === S_('S_PLAY_ATK1') || ms === S_('S_PLAY_ATK2')) P_SetMobjState(player.mo, S_('S_PLAY'));
  if (player.pendingweapon !== wp_nochange || !player.health) {
    P_SetPsprite(player, ps_weapon, weaponinfo[player.readyweapon].downstate);
    return;
  }
  if (player.cmd.buttons & BT_ATTACK) {
    if (!player.attackdown || player.readyweapon !== wp_dinamita) {
      player.attackdown = true;
      P_FireWeapon(player);
      return;
    }
  } else player.attackdown = false;
  // Balanceo del arma al caminar.
  let angle = (128 * leveltime) & FINEMASK;
  psp.sx = 1 + player.bob * finecosine[angle];
  angle &= FINEANGLES / 2 - 1;
  psp.sy = WEAPONTOP + player.bob * finesine[angle];
}

function A_ReFire(player, psp) {
  if ((player.cmd.buttons & BT_ATTACK) && player.pendingweapon === wp_nochange && player.health) {
    player.refire++;
    P_FireWeapon(player);
  } else {
    player.refire = 0;
    P_CheckAmmo(player);
  }
}

function A_Lower(player, psp) {
  psp.sy += LOWERSPEED;
  if (psp.sy < WEAPONBOTTOM) return;
  if (player.playerstate === PST_DEAD) {
    psp.sy = WEAPONBOTTOM;
    return;
  }
  if (!player.health) {
    P_SetPsprite(player, ps_weapon, S_NULL);
    return;
  }
  player.readyweapon = player.pendingweapon;
  P_BringUpWeapon(player);
}

function A_Raise(player, psp) {
  psp.sy -= RAISESPEED;
  if (psp.sy > WEAPONTOP) return;
  psp.sy = WEAPONTOP;
  P_SetPsprite(player, ps_weapon, weaponinfo[player.readyweapon].readystate);
}

function A_GunFlash(player, psp) {
  P_SetMobjState(player.mo, S_('S_PLAY_ATK2'));
  P_SetPsprite(player, ps_flash, weaponinfo[player.readyweapon].flashstate);
}

function A_Light0(player) { player.extralight = 0; }
function A_Light1(player) { player.extralight = 1; }
function A_Light2(player) { player.extralight = 2; }

// Pendiente del disparo. Con apuntado libre (ratón) la bala va exactamente
// hacia la retícula, en el centro de la vista; en modo clásico, autoapuntado
// vertical de DOOM (con tanteo a ±5,6° si no hay blanco al frente).
function P_BulletSlope(mo) {
  if (mo.player && mo.player.freeaim) {
    bulletslope = Math.tan(mo.player.pitch);
    linetarget = null;
    return;
  }
  let an = mo.angle;
  bulletslope = P_AimLineAttack(mo, an, 16 * 64);
  if (!linetarget) {
    an = (an + (1 << 26)) >>> 0;
    bulletslope = P_AimLineAttack(mo, an, 16 * 64);
    if (!linetarget) {
      an = (an - (2 << 26)) >>> 0;
      bulletslope = P_AimLineAttack(mo, an, 16 * 64);
    }
  }
}

// Dispersión: con el arma encarada (miras) la desviación es cuatro veces menor.
function P_GunShot(mo, accurate, damage) {
  let angle = mo.angle;
  if (!accurate) {
    const aimed = mo.player && mo.player.ads > 0.8;
    angle = (angle + ((P_Random() - P_Random()) << (aimed ? 16 : 18))) >>> 0;
  }
  P_LineAttack(mo, angle, MISSILERANGE, bulletslope, damage);
}

// --- Corvo ---
function A_CorvoSlash(player, psp) {
  let damage = ((P_Random() % 10) + 1) * 2 + 2;
  if (player.powers[pw_chupilca]) damage *= 8;
  let angle = player.mo.angle;
  angle = (angle + ((P_Random() - P_Random()) << 18)) >>> 0;
  const slope = P_AimLineAttack(player.mo, angle, MELEERANGE);
  P_LineAttack(player.mo, angle, MELEERANGE, slope, damage);
  if (linetarget) {
    S_StartSound(player.mo, 'stab');
    player.mo.angle = R_PointToAngle2(player.mo.x, player.mo.y, linetarget.x, linetarget.y);
  } else {
    S_StartSound(player.mo, 'slash');
  }
}

// --- Revólver ---
function A_FireRevolver(player, psp) {
  S_StartSound(player.mo, 'revolv');
  P_SetMobjState(player.mo, S_('S_PLAY_ATK2'));
  player.ammo[am_revolver]--;
  P_SetPsprite(player, ps_flash, weaponinfo[player.readyweapon].flashstate);
  P_BulletSlope(player.mo);
  P_GunShot(player.mo, !player.refire, 5 * ((P_Random() % 3) + 1));
}

// --- Fusil Comblain II: un tiro preciso y potente, recarga manual ---
function A_FireComblain(player, psp) {
  S_StartSound(player.mo, 'rifle');
  P_SetMobjState(player.mo, S_('S_PLAY_ATK2'));
  player.ammo[am_fusil]--;
  P_SetPsprite(player, ps_flash, weaponinfo[player.readyweapon].flashstate);
  P_BulletSlope(player.mo);
  P_GunShot(player.mo, true, 10 * ((P_Random() % 5) + 3));
}
function A_OpenBreech(player) { S_StartSound(player.mo, 'rload1'); }
function A_LoadCartridge(player) { S_StartSound(player.mo, 'rload2'); }
function A_CloseBreech(player) { S_StartSound(player.mo, 'rload3'); }

// --- Gatling ---
function A_FireGatling(player, psp) {
  S_StartSound(player.mo, 'gatlin');
  if (!player.ammo[am_fusil]) return;
  P_SetMobjState(player.mo, S_('S_PLAY_ATK2'));
  player.ammo[am_fusil]--;
  const flash = weaponinfo[player.readyweapon].flashstate + (psp.stateNum === S_('S_GATLATK2') ? 1 : 0);
  P_SetPsprite(player, ps_flash, flash);
  P_BulletSlope(player.mo);
  P_GunShot(player.mo, !player.refire, 5 * ((P_Random() % 3) + 1));
}

// --- Dinamita ---
function A_LightFuse(player) { S_StartSound(player.mo, 'fuse'); }
function A_ThrowDynamite(player, psp) {
  player.ammo[am_dinamita]--;
  P_SpawnPlayerMissile(player.mo, MT.DINAMITA_P);
}

// --- Configuración y avance de las psprites ---
function P_SetupPsprites(player) {
  for (let i = 0; i < NUMPSPRITES; i++) player.psprites[i].state = null;
  player.pendingweapon = player.readyweapon;
  P_BringUpWeapon(player);
}

function P_MovePsprites(player) {
  for (let i = 0; i < NUMPSPRITES; i++) {
    const psp = player.psprites[i];
    if (psp.state) {
      if (psp.tics !== -1) {
        psp.tics--;
        if (!psp.tics) P_SetPsprite(player, i, psp.state.nextstate);
      }
    }
  }
  player.psprites[ps_flash].sx = player.psprites[ps_weapon].sx;
  player.psprites[ps_flash].sy = player.psprites[ps_weapon].sy;
}
