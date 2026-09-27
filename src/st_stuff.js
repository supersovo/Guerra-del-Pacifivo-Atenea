// =============================================================================
// st_stuff.js — Barra de estado (st_stuff.c)
// -----------------------------------------------------------------------------
// Munición, salud, armas, el rostro del soldado, la moral (armadura), las
// medallas de objetivos (en lugar de las llaves de DOOM) y la tabla de
// municiones. También maneja los destellos de paleta (daño, recogidas,
// chupilca) y los trucos de teclado.
// =============================================================================
'use strict';

let st_facecount = 0, st_faceindex = 'STFST00';
let st_oldhealth = -1, st_oldweaponsowned = [];
let st_lastattackdown = -1, st_randomnumber = 0, st_priority = 0;
let st_cheatbuf = '';
let automapRevealAll = false;

const ST_FACEY = 1;

function ST_ViewSizeChanged() {}

function ST_Start() {
  st_facecount = 0;
  st_priority = 0;
  st_oldhealth = -1;
  st_lastattackdown = -1;
  st_oldweaponsowned = players[0].weaponowned.slice();
  st_faceindex = 'STFST00';
}

function ST_PainLevel(health) {
  const h = health > 100 ? 100 : health;
  return 4 - Math.min(4, Math.floor(h * 5 / 101));
}

// Lógica del rostro (ST_updateFaceWidget), por prioridades como DOOM.
function ST_UpdateFace() {
  const plyr = players[0];
  const pain = ST_PainLevel(plyr.health);
  if (st_priority < 10) {
    if (!plyr.health) {
      st_priority = 9;
      st_faceindex = 'STFDEAD0';
      st_facecount = 1;
    }
  }
  if (st_priority < 9) {
    if (plyr.bonuscount) {
      let doevilgrin = false;
      for (let i = 0; i < NUMWEAPONS; i++) {
        if (st_oldweaponsowned[i] !== plyr.weaponowned[i]) {
          doevilgrin = true;
          st_oldweaponsowned[i] = plyr.weaponowned[i];
        }
      }
      if (doevilgrin) {
        st_priority = 8;
        st_facecount = 2 * TICRATE;
        st_faceindex = 'STFEVL' + pain;
      }
    }
  }
  if (st_priority < 8) {
    if (plyr.damagecount && plyr.attacker && plyr.attacker !== plyr.mo) {
      st_priority = 7;
      if (st_oldhealth - plyr.health > 20) {
        st_facecount = TICRATE;
        st_faceindex = 'STFOUCH' + pain;
      } else {
        const badguyangle = R_PointToAngle2(plyr.mo.x, plyr.mo.y, plyr.attacker.x, plyr.attacker.y);
        let diffang, right;
        if (badguyangle > plyr.mo.angle) {
          diffang = (badguyangle - plyr.mo.angle) >>> 0;
          right = diffang > ANG180;
        } else {
          diffang = (plyr.mo.angle - badguyangle) >>> 0;
          right = diffang <= ANG180;
        }
        st_facecount = TICRATE;
        if (diffang < ANG45) st_faceindex = 'STFST' + pain + '0';
        else if (right) st_faceindex = 'STFTR' + pain + '0';
        else st_faceindex = 'STFTL' + pain + '0';
      }
    }
  }
  if (st_priority < 7) {
    if (plyr.damagecount) {
      if (st_oldhealth - plyr.health > 20) {
        st_priority = 7;
        st_facecount = TICRATE;
        st_faceindex = 'STFOUCH' + pain;
      } else {
        st_priority = 6;
        st_facecount = TICRATE;
        st_faceindex = 'STFST' + pain + '0';
      }
    }
  }
  if (st_priority < 6) {
    if (plyr.attackdown) {
      if (st_lastattackdown === -1) st_lastattackdown = 2 * TICRATE;
      else if (!--st_lastattackdown) {
        st_priority = 5;
        st_faceindex = 'STFKILL' + pain;
        st_facecount = 1;
        st_lastattackdown = 1;
      }
    } else st_lastattackdown = -1;
  }
  if (st_priority < 5) {
    if ((plyr.cheats & CF_GODMODE)) {
      st_priority = 4;
      st_faceindex = 'STFGOD0';
      st_facecount = 1;
    }
  }
  if (!st_facecount) {
    st_faceindex = 'STFST' + pain + (st_randomnumber % 3);
    st_facecount = TICRATE / 2;
    st_priority = 0;
  }
  st_facecount--;
}

function ST_Ticker() {
  st_randomnumber = M_Random();
  ST_UpdateFace();
  st_oldhealth = players[0].health;
}

// Paleta: rojo por daño, dorado por recogidas, rojo intenso con la chupilca.
function ST_DoPaletteStuff() {
  const plyr = players[0];
  let cnt = plyr.damagecount;
  if (plyr.powers[pw_chupilca]) {
    const bzc = 12 - (plyr.powers[pw_chupilca] >> 6);
    if (bzc > cnt) cnt = bzc;
  }
  let palette;
  if (cnt) {
    palette = (cnt + 7) >> 3;
    if (palette >= NUMREDPALS) palette = NUMREDPALS - 1;
    palette += STARTREDPALS;
  } else if (plyr.bonuscount) {
    palette = (plyr.bonuscount + 7) >> 3;
    if (palette >= NUMBONUSPALS) palette = NUMBONUSPALS - 1;
    palette += STARTBONUSPALS;
  } else palette = 0;
  I_SetPalette(palette);
}

// Números grandes con la fuente de títulos, en rojo como en DOOM.
function ST_DrawBigNum(xRight, y, num, digits) {
  const s = String(Math.max(0, Math.floor(num)));
  let x = xRight;
  for (let i = s.length - 1; i >= 0; i--) {
    const g = V_GetGlyph(s[i], true);
    if (!g) continue;
    x -= g.width - 1;
    V_DrawPatch(x, y, g, V_Translations.red);
  }
}

// Rótulo grabado: tinta clara con sombra oscura, sin contorno.
function ST_Label(x, y, text) {
  const d = SCALE >= 2 ? 0.5 : 1;
  V_DrawText(x + d, y + d, text, false, V_Translations.engrave);
  V_DrawText(x, y, text, false, V_Translations.label);
}

function ST_DrawSmallNum(xRight, y, num) {
  const s = String(Math.max(0, Math.floor(num)));
  const w = V_StringWidth(s, false);
  V_DrawText(xRight - w, y, s, false, V_Translations.gold);
}

function ST_Drawer(fullscreen) {
  const plyr = players[0];
  ST_DoPaletteStuff();
  if (fullscreen) {
    ST_DrawFullscreenHUD();
    return;
  }
  const S = SCALE;
  const y0 = 200 - ST_HEIGHT;
  // relleno lateral en panorámica
  if (UIOFS > 0) {
    const side = W_CacheLumpName('STBARSID');
    for (let px = -64; px > -UIOFS / S - 64; px -= 64) V_DrawPatch(px, y0, side);
    for (let px = 320; px < 320 + UIOFS / S + 64; px += 64) V_DrawPatch(px, y0, side);
  }
  V_DrawPatch(0, y0, W_CacheLumpName('STBAR'));
  // rótulos grabados en el cuero
  ST_Label(7, y0 + 24, 'MUNIC.');
  ST_Label(58, y0 + 24, 'SALUD');
  ST_Label(110, y0 + 24, 'ARMAS');
  ST_Label(191, y0 + 24, 'MORAL');
  ST_Label(253, y0 + 5, 'REV');
  ST_Label(253, y0 + 13, 'FUS');
  ST_Label(253, y0 + 21, 'DIN');
  for (let a = 0; a < 3; a++) ST_Label(293, y0 + 5 + a * 8, '/');
  // munición del arma actual
  const ammoType = weaponinfo[plyr.readyweapon].ammo;
  if (ammoType !== am_noammo) ST_DrawBigNum(44, y0 + 5, plyr.ammo[ammoType]);
  // salud
  ST_DrawBigNum(92, y0 + 5, plyr.health);
  V_DrawPatch(92, y0 + 5, V_GetGlyph('%', true), V_Translations.red);
  // armas (2..5)
  const armsNums = ['2', '3', '4', '5'];
  for (let i = 0; i < 4; i++) {
    const owned = plyr.weaponowned[i + 1];
    const x = 110 + (i % 2) * 14, y = y0 + 4 + Math.floor(i / 2) * 9;
    V_DrawText(x, y, armsNums[i], false, owned ? V_Translations.gold : V_Translations.dark);
  }
  // rostro
  V_DrawPatch(148, y0 + ST_FACEY, W_CacheLumpName(st_faceindex));
  // moral
  ST_DrawBigNum(221, y0 + 5, plyr.armorpoints);
  V_DrawPatch(221, y0 + 5, V_GetGlyph('%', true), V_Translations.red);
  // medallas de objetivos
  if (battle) {
    const objs = battle.objectives;
    if (objs.length <= 3) {
      for (let i = 0; i < objs.length; i++) V_DrawPatch(238, y0 + 4 + i * 8, W_CacheLumpName(objs[i].done ? 'STOBJ1' : 'STOBJ0'));
    } else {
      // hasta seis medallas pequeñas en dos columnas
      for (let i = 0; i < 6 && i < objs.length; i++) {
        V_DrawPatch(238 + (i & 1) * 5, y0 + 5 + (i >> 1) * 8, W_CacheLumpName(objs[i].done ? 'STOBJ3' : 'STOBJ2'));
      }
    }
  }
  // tabla de municiones
  for (let a = 0; a < NUMAMMO; a++) {
    ST_DrawSmallNum(291, y0 + 4 + a * 8, plyr.ammo[a]);
    ST_DrawSmallNum(316, y0 + 4 + a * 8, plyr.maxammo[a]);
  }
}

// HUD mínimo para pantalla completa.
function ST_DrawFullscreenHUD() {
  const plyr = players[0];
  const y = 200 - 20 - (UIOFS ? 0 : 0);
  ST_DrawBigNum(40, y, plyr.health);
  V_DrawPatch(40, y, V_GetGlyph('%', true), V_Translations.red);
  V_DrawText(4, y - 9, 'SALUD', false, V_Translations.sand);
  if (plyr.armorpoints) {
    ST_DrawBigNum(100, y, plyr.armorpoints);
    V_DrawPatch(100, y, V_GetGlyph('%', true), V_Translations.red);
    V_DrawText(66, y - 9, 'MORAL', false, V_Translations.sand);
  }
  const ammoType = weaponinfo[plyr.readyweapon].ammo;
  V_DrawText(316 - V_StringWidth(weaponinfo[plyr.readyweapon].short, false), y - 9, weaponinfo[plyr.readyweapon].short, false, V_Translations.sand);
  if (ammoType !== am_noammo) ST_DrawBigNum(316, y, plyr.ammo[ammoType]);
  if (battle) {
    for (let i = 0; i < 6 && i < battle.objectives.length; i++) {
      V_DrawPatch(140 + i * 12, y + 4, W_CacheLumpName(battle.objectives[i].done ? 'STOBJ1' : 'STOBJ0'));
    }
  }
}

// --- Trucos ----------------------------------------------------------------------------------------------
const ST_CHEATS = [
  ['iddqd', 'god'], ['rotochileno', 'god'],
  ['idkfa', 'all'], ['calacuerda', 'all'],
  ['idclip', 'clip'], ['iddt', 'map'], ['elmore', 'map'],
  ['idclev1', 'lev1'], ['idclev2', 'lev2'], ['idclev3', 'lev3'],
  ['notarget', 'notarget'], ['victoria', 'win']
];

function ST_Responder(ev) {
  if (ev.type !== ev_char) return false;
  st_cheatbuf = (st_cheatbuf + ev.data1.toLowerCase()).slice(-16);
  const plyr = players[0];
  for (const c of ST_CHEATS) {
    if (!st_cheatbuf.endsWith(c[0])) continue;
    st_cheatbuf = '';
    switch (c[1]) {
      case 'god':
        plyr.cheats ^= CF_GODMODE;
        if (plyr.cheats & CF_GODMODE) {
          if (plyr.mo) plyr.mo.health = 100;
          plyr.health = 100;
          HU_PlayerMessage(plyr, 'Modo invencible activado.');
        } else HU_PlayerMessage(plyr, 'Modo invencible desactivado.');
        break;
      case 'all':
        plyr.armorpoints = 200;
        plyr.armortype = 2;
        for (let i = 0; i < NUMWEAPONS; i++) plyr.weaponowned[i] = true;
        for (let i = 0; i < NUMAMMO; i++) plyr.ammo[i] = plyr.maxammo[i];
        HU_PlayerMessage(plyr, '¡Calacuerda! Armas y munición completas.');
        break;
      case 'clip':
        plyr.cheats ^= CF_NOCLIP;
        HU_PlayerMessage(plyr, (plyr.cheats & CF_NOCLIP) ? 'Atravesar muros: sí.' : 'Atravesar muros: no.');
        break;
      case 'map':
        automapRevealAll = !automapRevealAll;
        HU_PlayerMessage(plyr, automapRevealAll ? 'Carta completa revelada.' : 'Carta normal.');
        break;
      case 'notarget':
        plyr.cheats ^= CF_NOTARGET;
        HU_PlayerMessage(plyr, (plyr.cheats & CF_NOTARGET) ? 'El enemigo no te ve.' : 'El enemigo vuelve a verte.');
        break;
      case 'win':
        if (battle) for (const o of battle.objectives) o.done = true;
        HU_PlayerMessage(plyr, 'Objetivos marcados como cumplidos.');
        break;
      case 'lev1': case 'lev2': case 'lev3':
        G_DeferedInitNew(gameskill, parseInt(c[1].slice(3), 10), false);
        break;
    }
    return false;
  }
  return false;
}
