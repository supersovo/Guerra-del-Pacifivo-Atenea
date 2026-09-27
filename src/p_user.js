// =============================================================================
// p_user.js — El jugador: movimiento, altura de la vista, muerte (p_user.c)
// =============================================================================
'use strict';

const MAXBOB = 16;
let onground = false;

function P_Thrust(player, angle, move) {
  player.mo.momx += move * FineCos(angle);
  player.mo.momy += move * FineSin(angle);
}

function P_CalcHeight(player) {
  const mo = player.mo;
  player.bob = (mo.momx * mo.momx + mo.momy * mo.momy) / 4;
  if (player.bob > MAXBOB) player.bob = MAXBOB;
  if ((player.cheats & CF_NOMOMENTUM) || !onground) {
    player.viewz = mo.z + VIEWHEIGHT;
    if (player.viewz > mo.ceilingz - 4) player.viewz = mo.ceilingz - 4;
    player.viewz = mo.z + player.viewheight;
    return;
  }
  const angle = (FINEANGLES / 20 * leveltime) & FINEMASK;
  const bob = (player.bob / 2) * finesine[angle];
  if (player.playerstate === PST_LIVE) {
    player.viewheight += player.deltaviewheight;
    if (player.viewheight > VIEWHEIGHT) {
      player.viewheight = VIEWHEIGHT;
      player.deltaviewheight = 0;
    }
    if (player.viewheight < VIEWHEIGHT / 2) {
      player.viewheight = VIEWHEIGHT / 2;
      if (player.deltaviewheight <= 0) player.deltaviewheight = 1 / 65536;
    }
    if (player.deltaviewheight) {
      player.deltaviewheight += 0.25;
      if (!player.deltaviewheight) player.deltaviewheight = 1 / 65536;
    }
  }
  player.viewz = mo.z + player.viewheight + bob;
  if (player.viewz > mo.ceilingz - 4) player.viewz = mo.ceilingz - 4;
}

function P_MovePlayer(player) {
  const cmd = player.cmd;
  const mo = player.mo;
  mo.angle = (mo.angle + (cmd.angleturn << 16)) >>> 0;
  onground = mo.z <= mo.floorz;
  // Con el arma encarada el soldado avanza más despacio.
  const k = (2048 / 65536) * (1 - 0.4 * player.ads);
  if (cmd.forwardmove && onground) P_Thrust(player, mo.angle, cmd.forwardmove * k);
  if (cmd.sidemove && onground) P_Thrust(player, (mo.angle - ANG90) >>> 0, cmd.sidemove * k);
  if ((cmd.forwardmove || cmd.sidemove) && mo.stateNum === S_('S_PLAY')) P_SetMobjState(mo, S_('S_PLAY_RUN1'));
}

// Mirada vertical (ratón, teclas o mando) y centrado.
function P_MovePitch(player) {
  const cmd = player.cmd;
  if (cmd.lookdelta) {
    player.pitch = clamp(player.pitch + cmd.lookdelta * PITCHUNIT, -MAXPITCH, MAXPITCH);
    player.centering = false;
  }
  if (cmd.buttons & BT_CENTER) player.centering = true;
  if (player.centering) {
    player.pitch *= 0.55;
    if (Math.abs(player.pitch) < 0.004) { player.pitch = 0; player.centering = false; }
  }
}

// Velocidad de encare del arma (fracción por tic: unos 140 ms).
const ADS_SPEED = 1 / 5;

// ¿Puede apuntarse con las miras? El arma debe tenerlas (zoom > 1), estar
// lista o disparando (no al subir, bajar ni recargar) y sin cambio pendiente.
function P_CanAim(player) {
  const w = weaponinfo[player.readyweapon];
  if (!w || !(w.zoom > 1) || player.pendingweapon !== wp_nochange || !player.health) return false;
  const st = player.psprites[ps_weapon].state;
  if (!st || st.action === A_Lower || st.action === A_Raise) return false;
  return w.aimframes.indexOf(String.fromCharCode(65 + (st.frame & FF_FRAMEMASK))) >= 0;
}

function P_UpdateAim(player) {
  player.oldads = player.ads;
  if ((player.cmd.buttons & BT_AIM) && P_CanAim(player)) player.ads = Math.min(1, player.ads + ADS_SPEED);
  else player.ads = Math.max(0, player.ads - ADS_SPEED);
}

// Aumento de la vista según el encare (frac: interpolación entre tics).
function P_ViewZoom(player, frac) {
  let a = player.ads;
  if (frac < 1 && defaults.interpolate) a = player.oldads + (player.ads - player.oldads) * frac;
  if (a <= 0) return 1;
  const w = weaponinfo[player.readyweapon];
  const z = w && w.zoom > 1 ? w.zoom : 1;
  const e = a * a * (3 - 2 * a);
  return 1 + (z - 1) * e;
}

function P_DeathThink(player) {
  player.oldads = player.ads;
  player.ads = 0;
  player.pitch *= 0.85;
  P_MovePsprites(player);
  if (player.viewheight > 6) player.viewheight -= 1;
  if (player.viewheight < 6) player.viewheight = 6;
  player.deltaviewheight = 0;
  onground = player.mo.z <= player.mo.floorz;
  P_CalcHeight(player);
  const att = player.attacker;
  if (att && att !== player.mo && !att.removed) {
    const angle = R_PointToAngle2(player.mo.x, player.mo.y, att.x, att.y);
    const delta = (angle - player.mo.angle) >>> 0;
    if (delta < ANG5 || delta > ((-ANG5) >>> 0)) {
      player.mo.angle = angle;
      if (player.damagecount) player.damagecount--;
    } else if (delta < ANG180) player.mo.angle = (player.mo.angle + ANG5) >>> 0;
    else player.mo.angle = (player.mo.angle - ANG5) >>> 0;
  } else if (player.damagecount) player.damagecount--;
  if (player.cmd.buttons & BT_USE) player.playerstate = PST_REBORN;
}

function P_PlayerThink(player) {
  if (player.cheats & CF_NOCLIP) player.mo.flags |= MF_NOCLIP;
  else player.mo.flags &= ~MF_NOCLIP;
  const cmd = player.cmd;
  if (player.playerstate === PST_DEAD) {
    P_DeathThink(player);
    return;
  }
  player.freeaim = !!cmd.freeaim;
  P_MovePitch(player);
  if (player.mo.reactiontime) player.mo.reactiontime--;
  else P_MovePlayer(player);
  P_CalcHeight(player);
  if (player.mo.subsector.sector.special) P_PlayerInSpecialSector(player);
  if (cmd.buttons & BT_CHANGE) {
    const newweapon = (cmd.buttons & BT_WEAPONMASK) >> BT_WEAPONSHIFT;
    if (newweapon < NUMWEAPONS && player.weaponowned[newweapon] && newweapon !== player.readyweapon) {
      player.pendingweapon = newweapon;
    }
  }
  if (cmd.buttons & BT_USE) {
    if (!player.usedown) {
      P_UseLines(player);
      player.usedown = true;
    }
  } else player.usedown = false;
  P_MovePsprites(player);
  P_UpdateAim(player);
  if (player.powers[pw_chupilca]) player.powers[pw_chupilca]++;
  if (player.damagecount) player.damagecount--;
  if (player.bonuscount) player.bonuscount--;
}
