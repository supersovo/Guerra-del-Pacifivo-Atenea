// =============================================================================
// info.js — Tablas de estados y de objetos (info.c / info.h)
// -----------------------------------------------------------------------------
// Como en DOOM, todo actor es una máquina de estados: cada estado indica el
// sprite, el cuadro, la duración en tics, la acción a ejecutar y el estado
// siguiente. mobjinfo describe cada tipo de objeto: salud, velocidad, radio,
// sonidos y estados de reposo, persecución, ataque, dolor y muerte.
//
// Bestiario (fuerzas aliadas de 1879-1880, ver docs/HISTORIA.md):
//   GUARDIA      Guardia Nacional peruana, fusil Peabody/Castañón (tipo zombi)
//   BOLIVIANO    Infante boliviano (bat. Independencia/Victoria), Remington
//   BAYONETA     Infante peruano con bayoneta calada, carga cuerpo a cuerpo
//   HUSAR        Húsar de caballería (Húsares de Junín / de Bolivia), sable
//   ARTILLERO    Pieza de artillería con su dotación (fija, dispara granadas)
//   DINAMITERO   Zapador con cartuchos de dinamita (defensas de Arica)
//   OFICIAL      Oficial con revólver y sable
// =============================================================================
'use strict';

const states = [];              // [{ name, sprite, frame, tics, action, nextstate, misc1, misc2 }]
const stateIndex = new Map();   // nombre -> índice
const S_NULL = 0;

function ST_Def(name, sprite, frame, tics, action, next, misc1, misc2) {
  states.push({ name: name, spritename: sprite, sprite: -1, frameSpec: frame, frame: 0, tics: tics,
    actionName: action || null, action: null, nextName: next, nextstate: 0, misc1: misc1 || 0, misc2: misc2 || 0 });
  stateIndex.set(name, states.length - 1);
}

// Secuencia abreviada: [cuadro, tics, acción] con siguiente implícito.
function ST_Seq(prefix, sprite, list, loopTo) {
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    const name = prefix + (i + 1);
    const next = i + 1 < list.length ? prefix + (i + 2) : loopTo;
    ST_Def(name, sprite, e[0], e[1], e[2] || null, next);
  }
}

function S_(name) {
  const n = stateIndex.get(name);
  if (n === undefined) throw new Error('estado desconocido: ' + name);
  return n;
}

ST_Def('S_NULL', 'TNT1', 'A', -1, null, 'S_NULL');

// --- Luz del arma ---
ST_Def('S_LIGHTDONE', 'TNT1', 'A', 0, 'A_Light0', 'S_NULL');

// --- Armas (psprites) ---
// Corvo
ST_Def('S_CORVO', 'CORV', 'A', 1, 'A_WeaponReady', 'S_CORVO');
ST_Def('S_CORVODOWN', 'CORV', 'A', 1, 'A_Lower', 'S_CORVODOWN');
ST_Def('S_CORVOUP', 'CORV', 'A', 1, 'A_Raise', 'S_CORVOUP');
ST_Seq('S_CORVOATK', 'CORV', [['B', 3], ['C', 3, 'A_CorvoSlash'], ['D', 5], ['C', 4], ['B', 5, 'A_ReFire']], 'S_CORVO');
// Revólver Lefaucheux
ST_Def('S_REVO', 'REVO', 'A', 1, 'A_WeaponReady', 'S_REVO');
ST_Def('S_REVODOWN', 'REVO', 'A', 1, 'A_Lower', 'S_REVODOWN');
ST_Def('S_REVOUP', 'REVO', 'A', 1, 'A_Raise', 'S_REVOUP');
ST_Seq('S_REVOATK', 'REVO', [['A', 4], ['B', 6, 'A_FireRevolver'], ['C', 4], ['B', 5, 'A_ReFire']], 'S_REVO');
ST_Def('S_REVOFLASH', 'RFLA', 'A*', 6, 'A_Light1', 'S_LIGHTDONE');
// Fusil Comblain II (monotiro de bloque descendente)
ST_Def('S_COMB', 'COMB', 'A', 1, 'A_WeaponReady', 'S_COMB');
ST_Def('S_COMBDOWN', 'COMB', 'A', 1, 'A_Lower', 'S_COMBDOWN');
ST_Def('S_COMBUP', 'COMB', 'A', 1, 'A_Raise', 'S_COMBUP');
ST_Seq('S_COMBATK', 'COMB', [['A', 3], ['A', 7, 'A_FireComblain'], ['B', 5], ['C', 5, 'A_OpenBreech'], ['D', 5],
  ['E', 6, 'A_LoadCartridge'], ['D', 4], ['C', 4, 'A_CloseBreech'], ['A', 3, 'A_ReFire']], 'S_COMB');
ST_Def('S_COMBFLASH1', 'CFLA', 'A*', 4, 'A_Light1', 'S_COMBFLASH2');
ST_Def('S_COMBFLASH2', 'CFLA', 'B*', 3, 'A_Light2', 'S_LIGHTDONE');
// Ametralladora Gatling
ST_Def('S_GATL', 'GATL', 'A', 1, 'A_WeaponReady', 'S_GATL');
ST_Def('S_GATLDOWN', 'GATL', 'A', 1, 'A_Lower', 'S_GATLDOWN');
ST_Def('S_GATLUP', 'GATL', 'A', 1, 'A_Raise', 'S_GATLUP');
ST_Seq('S_GATLATK', 'GATL', [['A', 4, 'A_FireGatling'], ['B', 4, 'A_FireGatling'], ['B', 0, 'A_ReFire']], 'S_GATL');
ST_Def('S_GATLFLASH1', 'GFLA', 'A*', 5, 'A_Light1', 'S_LIGHTDONE');
ST_Def('S_GATLFLASH2', 'GFLA', 'B*', 5, 'A_Light2', 'S_LIGHTDONE');
// Dinamita
ST_Def('S_DINW', 'DINW', 'A', 1, 'A_WeaponReady', 'S_DINW');
ST_Def('S_DINWDOWN', 'DINW', 'A', 1, 'A_Lower', 'S_DINWDOWN');
ST_Def('S_DINWUP', 'DINW', 'A', 1, 'A_Raise', 'S_DINWUP');
ST_Seq('S_DINWATK', 'DINW', [['B*', 8, 'A_LightFuse'], ['C*', 6], ['D', 4, 'A_ThrowDynamite'], ['E', 9], ['A', 4, 'A_ReFire']], 'S_DINW');

// --- Jugador (soldado chileno) ---
ST_Def('S_PLAY', 'CHIL', 'A', -1, null, 'S_NULL');
ST_Seq('S_PLAY_RUN', 'CHIL', [['A', 4], ['B', 4], ['C', 4], ['D', 4]], 'S_PLAY_RUN1');
ST_Def('S_PLAY_ATK1', 'CHIL', 'E', 12, null, 'S_PLAY');
ST_Def('S_PLAY_ATK2', 'CHIL', 'F*', 6, null, 'S_PLAY_ATK1');
ST_Seq('S_PLAY_PAIN', 'CHIL', [['G', 4], ['G', 4, 'A_Pain']], 'S_PLAY');
ST_Seq('S_PLAY_DIE', 'CHIL', [['H', 10], ['I', 10, 'A_PlayerScream'], ['J', 10, 'A_Fall'], ['K', 10], ['L', -1]], 'S_NULL');
ST_Seq('S_PLAY_XDIE', 'CHIL', [['M', 5], ['N', 5, 'A_XScream'], ['O', 5, 'A_Fall'], ['P', 5], ['Q', -1]], 'S_NULL');

// --- Soldados de infantería (plantilla tipo "zombie" de DOOM) ---
function ST_Infantry(P, spr, attackAction) {
  ST_Def(P + '_STND', spr, 'A', 10, 'A_Look', P + '_STND2');
  ST_Def(P + '_STND2', spr, 'B', 10, 'A_Look', P + '_STND');
  ST_Seq(P + '_RUN', spr, [['A', 4, 'A_Chase'], ['A', 4, 'A_Chase'], ['B', 4, 'A_Chase'], ['B', 4, 'A_Chase'],
    ['C', 4, 'A_Chase'], ['C', 4, 'A_Chase'], ['D', 4, 'A_Chase'], ['D', 4, 'A_Chase']], P + '_RUN1');
  ST_Seq(P + '_ATK', spr, [['E', 10, 'A_FaceTarget'], ['F*', 8, attackAction], ['E', 8]], P + '_RUN1');
  ST_Seq(P + '_PAIN', spr, [['G', 3], ['G', 3, 'A_Pain']], P + '_RUN1');
  ST_Seq(P + '_DIE', spr, [['H', 5], ['I', 5, 'A_Scream'], ['J', 5, 'A_Fall'], ['K', 5], ['L', -1]], 'S_NULL');
  ST_Seq(P + '_XDIE', spr, [['M', 5], ['N', 5, 'A_XScream'], ['O', 5, 'A_Fall'], ['P', 5], ['Q', -1]], 'S_NULL');
}
ST_Infantry('S_GUAR', 'GUAR', 'A_RifleAttack');
ST_Infantry('S_BOLI', 'BOLI', 'A_RemingtonAttack');
ST_Infantry('S_COLO', 'COLO', 'A_RemingtonAttack');
ST_Infantry('S_RESE', 'RESE', 'A_RifleAttack');

// Tropa aliada: infante chileno con fusil Comblain.
ST_Def('S_CHIL_STND', 'CHIL', 'A', 10, 'A_AllyLook', 'S_CHIL_STND2');
ST_Def('S_CHIL_STND2', 'CHIL', 'B', 10, 'A_AllyLook', 'S_CHIL_STND');
ST_Seq('S_CHIL_RUN', 'CHIL', [['A', 4, 'A_AllyChase'], ['A', 4, 'A_AllyChase'], ['B', 4, 'A_AllyChase'], ['B', 4, 'A_AllyChase'],
  ['C', 4, 'A_AllyChase'], ['C', 4, 'A_AllyChase'], ['D', 4, 'A_AllyChase'], ['D', 4, 'A_AllyChase']], 'S_CHIL_RUN1');
ST_Seq('S_CHIL_ATK', 'CHIL', [['E', 12, 'A_FaceTarget'], ['F*', 8, 'A_AllyRifle'], ['E', 14]], 'S_CHIL_RUN1');
ST_Seq('S_CHIL_PAIN', 'CHIL', [['G', 3], ['G', 3, 'A_Pain']], 'S_CHIL_RUN1');
ST_Seq('S_CHIL_DIE', 'CHIL', [['H', 5], ['I', 5, 'A_Scream'], ['J', 5, 'A_Fall'], ['K', 5], ['L', -1]], 'S_NULL');
ST_Seq('S_CHIL_XDIE', 'CHIL', [['M', 5], ['N', 5, 'A_XScream'], ['O', 5, 'A_Fall'], ['P', 5], ['Q', -1]], 'S_NULL');

// Granaderos a Caballo: caballería chilena aliada (carga al sable).
ST_Def('S_GRAN_STND', 'GRAN', 'A', 10, 'A_AllyLook', 'S_GRAN_STND2');
ST_Def('S_GRAN_STND2', 'GRAN', 'B', 10, 'A_AllyLook', 'S_GRAN_STND');
ST_Seq('S_GRAN_RUN', 'GRAN', [['A', 3, 'A_AllyChase'], ['B', 3, 'A_AllyChase'], ['C', 3, 'A_AllyChase'], ['D', 3, 'A_AllyChase']], 'S_GRAN_RUN1');
ST_Seq('S_GRAN_ATK', 'GRAN', [['E', 5, 'A_FaceTarget'], ['F', 5, 'A_FaceTarget'], ['G', 6, 'A_SaberAttack']], 'S_GRAN_RUN1');
ST_Seq('S_GRAN_PAIN', 'GRAN', [['H', 3], ['H', 3, 'A_Pain']], 'S_GRAN_RUN1');
ST_Seq('S_GRAN_DIE', 'GRAN', [['I', 6], ['J', 6, 'A_Scream'], ['K', 6], ['L', 6, 'A_Fall'], ['M', 6], ['N', -1]], 'S_NULL');
ST_Def('S_GRAN_GIB', 'GRAN', 'O', -1, null, 'S_NULL');

// Batería chilena (Krupp) con su dotación.
ST_Def('S_ARTC_STND', 'ARTC', 'A', 10, 'A_Look', 'S_ARTC_STND');
ST_Def('S_ARTC_SEE', 'ARTC', 'A', 8, 'A_TurretChase', 'S_ARTC_SEE');
ST_Seq('S_ARTC_ATK', 'ARTC', [['B', 14, 'A_FaceTarget'], ['C*', 6, 'A_CannonFire'], ['D', 12], ['A', 45]], 'S_ARTC_SEE');
ST_Seq('S_ARTC_PAIN', 'ARTC', [['E', 4], ['E', 4, 'A_Pain']], 'S_ARTC_SEE');
ST_Seq('S_ARTC_DIE', 'ARTC', [['F', 6], ['G', 6, 'A_Scream'], ['H', 6, 'A_Fall'], ['I', 6], ['J', -1]], 'S_NULL');
ST_Def('S_ARTC_GIB', 'ARTC', 'K', -1, null, 'S_NULL');

// Bayoneta calada: carga rápida cuerpo a cuerpo.
ST_Def('S_BAYO_STND', 'BAYO', 'A', 10, 'A_Look', 'S_BAYO_STND2');
ST_Def('S_BAYO_STND2', 'BAYO', 'B', 10, 'A_Look', 'S_BAYO_STND');
ST_Seq('S_BAYO_RUN', 'BAYO', [['A', 2, 'A_Chase'], ['A', 2, 'A_Chase'], ['B', 2, 'A_Chase'], ['B', 2, 'A_Chase'],
  ['C', 2, 'A_Chase'], ['C', 2, 'A_Chase'], ['D', 2, 'A_Chase'], ['D', 2, 'A_Chase']], 'S_BAYO_RUN1');
ST_Seq('S_BAYO_ATK', 'BAYO', [['E', 7, 'A_FaceTarget'], ['F', 6, 'A_FaceTarget'], ['G', 7, 'A_BayonetAttack']], 'S_BAYO_RUN1');
ST_Seq('S_BAYO_PAIN', 'BAYO', [['H', 2], ['H', 2, 'A_Pain']], 'S_BAYO_RUN1');
ST_Seq('S_BAYO_DIE', 'BAYO', [['I', 7], ['J', 7, 'A_Scream'], ['K', 5, 'A_Fall'], ['L', 5], ['M', -1]], 'S_NULL');
ST_Seq('S_BAYO_XDIE', 'BAYO', [['N', 5], ['O', 5, 'A_XScream'], ['P', 5, 'A_Fall'], ['Q', 5], ['R', -1]], 'S_NULL');

// Húsar de caballería.
ST_Def('S_HUSA_STND', 'HUSA', 'A', 10, 'A_Look', 'S_HUSA_STND2');
ST_Def('S_HUSA_STND2', 'HUSA', 'B', 10, 'A_Look', 'S_HUSA_STND');
ST_Seq('S_HUSA_RUN', 'HUSA', [['A', 3, 'A_Chase'], ['B', 3, 'A_Chase'], ['C', 3, 'A_Chase'], ['D', 3, 'A_Chase']], 'S_HUSA_RUN1');
ST_Seq('S_HUSA_ATK', 'HUSA', [['E', 5, 'A_FaceTarget'], ['F', 5, 'A_FaceTarget'], ['G', 6, 'A_SaberAttack']], 'S_HUSA_RUN1');
ST_Seq('S_HUSA_PAIN', 'HUSA', [['H', 3], ['H', 3, 'A_Pain']], 'S_HUSA_RUN1');
ST_Seq('S_HUSA_DIE', 'HUSA', [['I', 6], ['J', 6, 'A_Scream'], ['K', 6], ['L', 6, 'A_Fall'], ['M', 6], ['N', -1]], 'S_NULL');
ST_Def('S_HUSA_GIB', 'HUSA', 'O', -1, null, 'S_NULL');

// Artillería: pieza fija con su dotación.
ST_Def('S_ARTI_STND', 'ARTI', 'A', 10, 'A_Look', 'S_ARTI_STND');
ST_Def('S_ARTI_SEE', 'ARTI', 'A', 8, 'A_TurretChase', 'S_ARTI_SEE');
ST_Seq('S_ARTI_ATK', 'ARTI', [['B', 16, 'A_FaceTarget'], ['C*', 6, 'A_CannonFire'], ['D', 12], ['A', 40]], 'S_ARTI_SEE');
ST_Seq('S_ARTI_PAIN', 'ARTI', [['E', 4], ['E', 4, 'A_Pain']], 'S_ARTI_SEE');
ST_Seq('S_ARTI_DIE', 'ARTI', [['F', 6], ['G', 6, 'A_Scream'], ['H', 6, 'A_Fall'], ['I', 6], ['J', -1]], 'S_NULL');
ST_Def('S_ARTI_GIB', 'ARTI', 'K', -1, null, 'S_NULL');

// Dinamitero.
ST_Def('S_DINA_STND', 'DINA', 'A', 10, 'A_Look', 'S_DINA_STND2');
ST_Def('S_DINA_STND2', 'DINA', 'B', 10, 'A_Look', 'S_DINA_STND');
ST_Seq('S_DINA_RUN', 'DINA', [['A', 3, 'A_Chase'], ['A', 3, 'A_Chase'], ['B', 3, 'A_Chase'], ['B', 3, 'A_Chase'],
  ['C', 3, 'A_Chase'], ['C', 3, 'A_Chase'], ['D', 3, 'A_Chase'], ['D', 3, 'A_Chase']], 'S_DINA_RUN1');
ST_Seq('S_DINA_ATK', 'DINA', [['E*', 10, 'A_FaceTarget'], ['F', 6, 'A_DinamiteroThrow'], ['E', 6]], 'S_DINA_RUN1');
ST_Seq('S_DINA_PAIN', 'DINA', [['G', 3], ['G', 3, 'A_Pain']], 'S_DINA_RUN1');
ST_Seq('S_DINA_DIE', 'DINA', [['H', 6], ['I', 6, 'A_Scream'], ['J', 6], ['K', 6, 'A_Fall'], ['L', -1]], 'S_NULL');
ST_Seq('S_DINA_XDIE', 'DINA', [['M', 5], ['N', 5, 'A_XScream'], ['O', 5, 'A_Fall'], ['P', 5], ['Q', -1]], 'S_NULL');

// Oficial con revólver y sable.
ST_Def('S_OFIC_STND', 'OFIC', 'A', 10, 'A_Look', 'S_OFIC_STND2');
ST_Def('S_OFIC_STND2', 'OFIC', 'B', 10, 'A_Look', 'S_OFIC_STND');
ST_Seq('S_OFIC_RUN', 'OFIC', [['A', 3, 'A_Chase'], ['A', 3, 'A_Chase'], ['B', 3, 'A_Chase'], ['B', 3, 'A_Chase'],
  ['C', 3, 'A_Chase'], ['C', 3, 'A_Chase'], ['D', 3, 'A_Chase'], ['D', 3, 'A_Chase']], 'S_OFIC_RUN1');
ST_Seq('S_OFIC_ATK', 'OFIC', [['E', 6, 'A_FaceTarget'], ['F*', 4, 'A_OfficerShoot'], ['E', 5, 'A_FaceTarget'],
  ['F*', 4, 'A_OfficerShoot'], ['E', 5, 'A_FaceTarget'], ['F*', 4, 'A_OfficerShoot'], ['E', 8]], 'S_OFIC_RUN1');
ST_Seq('S_OFIC_MELEE', 'OFIC', [['G', 6, 'A_FaceTarget'], ['H', 6, 'A_SaberAttack'], ['G', 6]], 'S_OFIC_RUN1');
ST_Seq('S_OFIC_PAIN', 'OFIC', [['I', 3], ['I', 3, 'A_Pain']], 'S_OFIC_RUN1');
ST_Seq('S_OFIC_DIE', 'OFIC', [['J', 8], ['K', 8, 'A_Scream'], ['L', 8], ['M', 8, 'A_Fall'], ['N', 8], ['O', -1]], 'S_NULL');

// --- Proyectiles y efectos ---
ST_Def('S_BALA1', 'BALA', 'A', 2, null, 'S_BALA2');
ST_Def('S_BALA2', 'BALA', 'B', 2, 'A_ShellTrail', 'S_BALA1');
ST_Seq('S_EXPL', 'EXPL', [['A*', 4, 'A_Explode'], ['B*', 5], ['C*', 5], ['D*', 5], ['E', 6]], 'S_NULL');
ST_Def('S_DINM1', 'DINM', 'A*', 2, null, 'S_DINM2');
ST_Def('S_DINM2', 'DINM', 'B*', 2, null, 'S_DINM3');
ST_Def('S_DINM3', 'DINM', 'C*', 2, null, 'S_DINM4');
ST_Def('S_DINM4', 'DINM', 'D*', 2, null, 'S_DINM1');
ST_Seq('S_PUFF', 'PUFF', [['A*', 4], ['B', 4], ['C', 4], ['D', 4]], 'S_NULL');
ST_Seq('S_BLOOD', 'BLUD', [['C', 8], ['B', 8], ['A', 8]], 'S_NULL');
ST_Seq('S_SMOKE', 'HUMO', [['A', 6], ['B', 6], ['C', 6], ['D', 6]], 'S_NULL');
ST_Seq('S_MINEBLAST', 'EXPL', [['A*', 4], ['B*', 5], ['C*', 5], ['D*', 5], ['E', 6]], 'S_NULL');   // daño: P_Detonate
ST_Seq('S_MINEARM', 'TNT1', [['A', 12], ['A', 1, 'A_MineDetonate']], 'S_NULL');   // el clic lo da T_MineThink
ST_Seq('S_BIGBLAST', 'EXPL', [['A*', 3], ['B*', 4], ['C*', 4], ['D*', 5], ['E', 6]], 'S_NULL');   // daño: P_Detonate

// --- Desmembramiento: partes que vuelan (el sprite real lo fija spriteOverride) ---
ST_Def('S_GIB1', 'GHCL', 'A', 3, 'A_GibFly', 'S_GIB2');
ST_Def('S_GIB2', 'GHCL', 'B', 3, 'A_GibFly', 'S_GIB3');
ST_Def('S_GIB3', 'GHCL', 'C', 3, 'A_GibFly', 'S_GIB4');
ST_Def('S_GIB4', 'GHCL', 'D', 3, 'A_GibFly', 'S_GIB1');
ST_Def('S_GIB_REST', 'GHCL', 'E', -1, null, 'S_NULL');
ST_Def('S_REMAINS', 'GTCL', 'A', -1, null, 'S_NULL');

// --- Barril de pólvora (explota al dispararle) ---
ST_Def('S_BARR', 'BARR', 'A', -1, null, 'S_NULL');
ST_Seq('S_BARR_EXP', 'BARR', [['B*', 5], ['C*', 5, 'A_Scream'], ['D*', 5], ['E*', 10, 'A_Explode'], ['F*', 10]], 'S_NULL');

// --- Objetos recogibles y decoración (un estado estático o animado) ---
function ST_Static(name, spr, frame) { ST_Def(name, spr, frame, -1, null, 'S_NULL'); }
function ST_Anim2(name, spr, f1, f2, tics) {
  ST_Def(name, spr, f1, tics, null, name + '_B');
  ST_Def(name + '_B', spr, f2, tics, null, name);
}
function ST_Anim(name, spr, frames, tics) {
  for (let i = 0; i < frames.length; i++) {
    ST_Def(i === 0 ? name : name + '_' + i, spr, frames[i], tics, null, i + 1 < frames.length ? name + '_' + (i + 1) : name);
  }
}
ST_Static('S_CFUS', 'CFUS', 'A');
ST_Static('S_GATP', 'GATP', 'A');
ST_Static('S_DINI', 'DINI', 'A');
ST_Static('S_CREV', 'CREV', 'A');
ST_Static('S_CRVB', 'CRVB', 'A');
ST_Static('S_CRTF', 'CRTF', 'A');
ST_Static('S_CAJF', 'CAJF', 'A');
ST_Static('S_DMTA', 'DMTA', 'A');
ST_Static('S_DMTC', 'DMTC', 'A');
ST_Static('S_CARA', 'CARA', 'A');
ST_Static('S_BOTI', 'BOTI', 'A');
ST_Anim2('S_CHAR', 'CHAR', 'A', 'B', 12);
ST_Anim2('S_ESCA', 'ESCA', 'A', 'B', 10);
ST_Static('S_ESTA', 'ESTA', 'A');
ST_Anim('S_BAND', 'BAND', ['A', 'B', 'C'], 8);
ST_Anim2('S_CHUP', 'CHUP', 'A*', 'B*', 8);
ST_Static('S_PLAN', 'PLAN', 'A');
ST_Static('S_MOCH', 'MOCH', 'A');
// Decoración
ST_Static('S_CANK', 'CANK', 'A');
ST_Static('S_CANL', 'CANL', 'A');
ST_Static('S_CANR', 'CANR', 'A');
ST_Static('S_TAMA', 'TAMA', 'A');
ST_Static('S_POST', 'POST', 'A');
ST_Static('S_FARO', 'FARO', 'A*');
ST_Anim('S_FOGA', 'FOGA', ['A*', 'B*', 'C*'], 5);
ST_Anim('S_FUEG', 'FUEG', ['A*', 'B*', 'C*'], 4);
ST_Anim('S_HUMC', 'HUMC', ['A', 'B', 'C', 'D'], 8);
ST_Static('S_SACO', 'SACO', 'A');
ST_Static('S_CAJA', 'CAJA', 'A');
ST_Static('S_RUED', 'RUED', 'A');
ST_Static('S_ANCL', 'ANCL', 'A');
ST_Static('S_BOTE', 'BOTE', 'A');
ST_Static('S_CARR', 'CARR', 'A');
ST_Static('S_PIPA', 'PIPA', 'A');
ST_Static('S_MAST', 'MAST', 'A');
ST_Anim('S_MAST_UP', 'MAST', ['B', 'C', 'D'], 8);
ST_Static('S_CHIL_DEAD', 'CHIL', 'L');
ST_Static('S_GUAR_DEAD', 'GUAR', 'L');
ST_Static('S_BOLI_DEAD', 'BOLI', 'L');
ST_Static('S_CHIL_STAND', 'CHIL', 'A');
ST_Static('S_CABA_DEAD', 'HUSA', 'N');
ST_Static('S_TNT1', 'TNT1', 'A');

// =============================================================================
// mobjinfo
// =============================================================================
const MT = {};                  // nombre -> índice de tipo
const mobjinfo = [];

function MI_Def(name, def) {
  const d = Object.assign({
    doomednum: -1, spawnstate: 'S_NULL', spawnhealth: 1000, seestate: 'S_NULL', seesound: null,
    reactiontime: 8, attacksound: null, painstate: 'S_NULL', painchance: 0, painsound: null,
    meleestate: 'S_NULL', missilestate: 'S_NULL', deathstate: 'S_NULL', xdeathstate: 'S_NULL',
    deathsound: null, speed: 0, radius: 20, height: 16, mass: 100, damage: 0, activesound: null,
    flags: 0, raisestate: 'S_NULL', title: name, dropitem: null, faction: 0, sightdist: 0
  }, def);
  d.name = name;
  MT[name] = mobjinfo.length;
  mobjinfo.push(d);
}

MI_Def('PLAYER', {
  doomednum: 1, spawnstate: 'S_PLAY', spawnhealth: 100, seestate: 'S_PLAY_RUN1', painstate: 'S_PLAY_PAIN1',
  painchance: 255, painsound: 'plpain', missilestate: 'S_PLAY_ATK1', deathstate: 'S_PLAY_DIE1',
  xdeathstate: 'S_PLAY_XDIE1', deathsound: 'pldeth', radius: 16, height: 56, mass: 100,
  flags: MF_SOLID | MF_SHOOTABLE | MF_DROPOFF | MF_PICKUP | MF_NOTDMATCH, title: 'Soldado chileno', faction: 1
});

// Tropas chilenas aliadas
MI_Def('CHILENO', {
  doomednum: 4001, spawnstate: 'S_CHIL_STND', spawnhealth: 45, seestate: 'S_CHIL_RUN1', painstate: 'S_CHIL_PAIN1',
  painchance: 180, painsound: 'plpain', missilestate: 'S_CHIL_ATK1', deathstate: 'S_CHIL_DIE1',
  xdeathstate: 'S_CHIL_XDIE1', deathsound: 'chdth', speed: 8, radius: 16, height: 56, mass: 100,
  flags: MF_SOLID | MF_SHOOTABLE, title: 'Infante chileno', faction: 1, gib: 'CL'
});
MI_Def('ARTILLERO_CL', {
  doomednum: 4002, spawnstate: 'S_ARTC_STND', spawnhealth: 120, seestate: 'S_ARTC_SEE', painstate: 'S_ARTC_PAIN1',
  painchance: 60, painsound: 'plpain', missilestate: 'S_ARTC_ATK1', deathstate: 'S_ARTC_DIE1', deathsound: 'chdth',
  speed: 0, radius: 32, height: 48, mass: 10000000, reactiontime: 12, sightdist: 3600,
  flags: MF_SOLID | MF_SHOOTABLE | MF_TURRET, title: 'Batería Krupp chilena', faction: 1, gib: 'AC', gibkind: 'crew', gibstate: 'S_ARTC_GIB'
});

MI_Def('GUARDIA', {
  doomednum: 3004, spawnstate: 'S_GUAR_STND', spawnhealth: 20, seestate: 'S_GUAR_RUN1', seesound: 'posit',
  attacksound: 'rifle2', painstate: 'S_GUAR_PAIN1', painchance: 200, painsound: 'popain', missilestate: 'S_GUAR_ATK1',
  deathstate: 'S_GUAR_DIE1', xdeathstate: 'S_GUAR_XDIE1', deathsound: 'podth', speed: 8, radius: 20, height: 56,
  mass: 100, activesound: 'posact', flags: MF_SOLID | MF_SHOOTABLE | MF_COUNTKILL, dropitem: 'CARTUCHOS',
  title: 'Guardia Nacional (Perú)', faction: 2, gib: 'GU'
});
MI_Def('BOLIVIANO', {
  doomednum: 9, spawnstate: 'S_BOLI_STND', spawnhealth: 30, seestate: 'S_BOLI_RUN1', seesound: 'posit',
  painstate: 'S_BOLI_PAIN1', painchance: 170, painsound: 'popain', missilestate: 'S_BOLI_ATK1',
  deathstate: 'S_BOLI_DIE1', xdeathstate: 'S_BOLI_XDIE1', deathsound: 'podth', speed: 8, radius: 20, height: 56,
  mass: 100, activesound: 'posact', flags: MF_SOLID | MF_SHOOTABLE | MF_COUNTKILL, dropitem: 'CARTUCHOS',
  title: 'Infante boliviano', faction: 2, gib: 'BO'
});
MI_Def('BAYONETA', {
  doomednum: 3002, spawnstate: 'S_BAYO_STND', spawnhealth: 80, seestate: 'S_BAYO_RUN1', seesound: 'sgtsit',
  attacksound: 'sgtatk', painstate: 'S_BAYO_PAIN1', painchance: 170, painsound: 'popain', meleestate: 'S_BAYO_ATK1',
  deathstate: 'S_BAYO_DIE1', xdeathstate: 'S_BAYO_XDIE1', deathsound: 'sgtdth', speed: 11, radius: 22, height: 56,
  mass: 300, activesound: 'posact', flags: MF_SOLID | MF_SHOOTABLE | MF_COUNTKILL, title: 'Infante con bayoneta', faction: 2, gib: 'PL'
});
MI_Def('HUSAR', {
  doomednum: 3005, spawnstate: 'S_HUSA_STND', spawnhealth: 150, seestate: 'S_HUSA_RUN1', seesound: 'horse',
  attacksound: 'saber', painstate: 'S_HUSA_PAIN1', painchance: 90, painsound: 'hpain', meleestate: 'S_HUSA_ATK1',
  deathstate: 'S_HUSA_DIE1', deathsound: 'hdeath', speed: 15, radius: 30, height: 88, mass: 700,
  activesound: 'hooves', flags: MF_SOLID | MF_SHOOTABLE | MF_COUNTKILL, title: 'Húsar de caballería', faction: 2, gib: 'HU', gibkind: 'rider', gibstate: 'S_HUSA_GIB'
});
MI_Def('ARTILLERO', {
  doomednum: 3006, spawnstate: 'S_ARTI_STND', spawnhealth: 70, seestate: 'S_ARTI_SEE', seesound: 'posit',
  painstate: 'S_ARTI_PAIN1', painchance: 100, painsound: 'popain', missilestate: 'S_ARTI_ATK1',
  deathstate: 'S_ARTI_DIE1', deathsound: 'podth', speed: 0, radius: 32, height: 48, mass: 10000000,
  reactiontime: 20, sightdist: 3600, flags: MF_SOLID | MF_SHOOTABLE | MF_COUNTKILL | MF_TURRET,
  title: 'Pieza de artillería', faction: 2, gib: 'AP', gibkind: 'crew', gibstate: 'S_ARTI_GIB'
});
MI_Def('DINAMITERO', {
  doomednum: 3001, spawnstate: 'S_DINA_STND', spawnhealth: 60, seestate: 'S_DINA_RUN1', seesound: 'posit',
  painstate: 'S_DINA_PAIN1', painchance: 200, painsound: 'popain', missilestate: 'S_DINA_ATK1',
  deathstate: 'S_DINA_DIE1', xdeathstate: 'S_DINA_XDIE1', deathsound: 'podth', speed: 8, radius: 20, height: 56,
  mass: 100, activesound: 'posact', flags: MF_SOLID | MF_SHOOTABLE | MF_COUNTKILL, dropitem: 'DINAMITA1',
  title: 'Zapador dinamitero', faction: 2, gib: 'ZA'
});
MI_Def('OFICIAL', {
  doomednum: 3003, spawnstate: 'S_OFIC_STND', spawnhealth: 220, seestate: 'S_OFIC_RUN1', seesound: 'ofsit',
  attacksound: 'saber', painstate: 'S_OFIC_PAIN1', painchance: 60, painsound: 'popain', meleestate: 'S_OFIC_MELEE1',
  missilestate: 'S_OFIC_ATK1', deathstate: 'S_OFIC_DIE1', deathsound: 'ofdth', speed: 9, radius: 20, height: 60,
  mass: 250, activesound: 'posact', flags: MF_SOLID | MF_SHOOTABLE | MF_COUNTKILL, dropitem: 'CAJA_REV',
  title: 'Oficial', faction: 2, gib: 'OF'
});

// Tropas de las batallas de Tacna y de Lima
MI_Def('COLORADO', {
  doomednum: 3007, spawnstate: 'S_COLO_STND', spawnhealth: 40, seestate: 'S_COLO_RUN1', seesound: 'posit',
  painstate: 'S_COLO_PAIN1', painchance: 140, painsound: 'popain', missilestate: 'S_COLO_ATK1',
  deathstate: 'S_COLO_DIE1', xdeathstate: 'S_COLO_XDIE1', deathsound: 'podth', speed: 9, radius: 20, height: 56,
  mass: 100, activesound: 'posact', flags: MF_SOLID | MF_SHOOTABLE | MF_COUNTKILL, dropitem: 'CARTUCHOS',
  title: 'Colorados de Bolivia', faction: 2, gib: 'CO'
});
MI_Def('RESERVA', {
  doomednum: 3008, spawnstate: 'S_RESE_STND', spawnhealth: 20, seestate: 'S_RESE_RUN1', seesound: 'posit',
  painstate: 'S_RESE_PAIN1', painchance: 210, painsound: 'popain', missilestate: 'S_RESE_ATK1',
  deathstate: 'S_RESE_DIE1', xdeathstate: 'S_RESE_XDIE1', deathsound: 'podth', speed: 7, radius: 20, height: 56,
  mass: 100, activesound: 'posact', flags: MF_SOLID | MF_SHOOTABLE | MF_COUNTKILL, dropitem: 'CARTUCHOS',
  title: 'Reserva de Lima', faction: 2, gib: 'RE'
});
MI_Def('GRANADERO', {
  doomednum: 4003, spawnstate: 'S_GRAN_STND', spawnhealth: 150, seestate: 'S_GRAN_RUN1', seesound: 'horse',
  attacksound: 'saber', painstate: 'S_GRAN_PAIN1', painchance: 90, painsound: 'hpain', meleestate: 'S_GRAN_ATK1',
  deathstate: 'S_GRAN_DIE1', deathsound: 'hdeath', speed: 15, radius: 30, height: 88, mass: 700,
  activesound: 'hooves', flags: MF_SOLID | MF_SHOOTABLE, title: 'Granadero a caballo', faction: 1, gib: 'GR', gibkind: 'rider', gibstate: 'S_GRAN_GIB'
});

// Partes de un cuerpo desmembrado por una explosión.
MI_Def('GIB', {
  spawnstate: 'S_GIB1', radius: 6, height: 8, mass: 20, flags: MF_NOBLOCKMAP | MF_DROPOFF | MF_GIB, title: 'Restos'
});

// Proyectiles
MI_Def('GRANADA', {
  spawnstate: 'S_BALA1', seesound: 'cannon', deathstate: 'S_EXPL1', deathsound: 'explod', speed: 18, radius: 8,
  height: 8, damage: 6, flags: MF_NOBLOCKMAP | MF_MISSILE | MF_DROPOFF | MF_NOGRAVITY, title: 'Granada de artillería'
});
MI_Def('DINAMITA_P', {
  spawnstate: 'S_DINM1', seesound: 'throw', deathstate: 'S_EXPL1', deathsound: 'explod', speed: 17, radius: 6,
  height: 8, damage: 12, flags: MF_NOBLOCKMAP | MF_MISSILE | MF_DROPOFF | MF_LOBBED, title: 'Cartucho de dinamita'
});
MI_Def('PUFF', { spawnstate: 'S_PUFF1', flags: MF_NOBLOCKMAP | MF_NOGRAVITY });
MI_Def('BLOOD', { spawnstate: 'S_BLOOD1', flags: MF_NOBLOCKMAP });
MI_Def('SMOKE', { spawnstate: 'S_SMOKE1', flags: MF_NOBLOCKMAP | MF_NOGRAVITY });
MI_Def('EXPLOSION', { spawnstate: 'S_BIGBLAST1', flags: MF_NOBLOCKMAP | MF_NOGRAVITY });
MI_Def('MINA', { doomednum: 7001, spawnstate: 'S_TNT1', flags: MF_NOBLOCKMAP | MF_NOSECTOR, title: 'Polvorazo' });
MI_Def('MINAFX', { spawnstate: 'S_MINEARM1', flags: MF_NOBLOCKMAP | MF_NOGRAVITY | MF_NOSECTOR });
MI_Def('MINABOOM', { spawnstate: 'S_MINEBLAST1', flags: MF_NOBLOCKMAP | MF_NOGRAVITY });
MI_Def('VOLADURA', { doomednum: 7002, spawnstate: 'S_TNT1', flags: MF_NOBLOCKMAP | MF_NOSECTOR, title: 'Punto de voladura' });

// Barril de pólvora
MI_Def('BARRIL', {
  doomednum: 2035, spawnstate: 'S_BARR', spawnhealth: 20, deathstate: 'S_BARR_EXP1', deathsound: 'explod',
  radius: 10, height: 42, flags: MF_SOLID | MF_SHOOTABLE | MF_NOBLOOD, title: 'Barril de pólvora'
});

// Armas
MI_Def('FUSIL', { doomednum: 2001, spawnstate: 'S_CFUS', flags: MF_SPECIAL, title: 'Fusil Comblain II' });
MI_Def('GATLING', { doomednum: 2002, spawnstate: 'S_GATP', flags: MF_SPECIAL, title: 'Ametralladora Gatling' });
MI_Def('DINAMITA_W', { doomednum: 2003, spawnstate: 'S_DINI', flags: MF_SPECIAL, title: 'Dinamita' });
// Munición
MI_Def('CART_REV', { doomednum: 2007, spawnstate: 'S_CREV', flags: MF_SPECIAL, title: 'Cartuchos de revólver' });
MI_Def('CAJA_REV', { doomednum: 2048, spawnstate: 'S_CRVB', flags: MF_SPECIAL, title: 'Caja de cartuchos de revólver' });
MI_Def('CARTUCHOS', { doomednum: 2008, spawnstate: 'S_CRTF', flags: MF_SPECIAL, title: 'Cartuchos 11 mm' });
MI_Def('CAJA_FUS', { doomednum: 2049, spawnstate: 'S_CAJF', flags: MF_SPECIAL, title: 'Caja de cartuchos 11 mm' });
MI_Def('DINAMITA1', { doomednum: 2010, spawnstate: 'S_DMTA', flags: MF_SPECIAL, title: 'Cartucho de dinamita' });
MI_Def('CAJA_DIN', { doomednum: 2046, spawnstate: 'S_DMTC', flags: MF_SPECIAL, title: 'Cajón de dinamita' });
// Salud y moral
MI_Def('CARAMAYOLA', { doomednum: 2011, spawnstate: 'S_CARA', flags: MF_SPECIAL, title: 'Caramayola' });
MI_Def('BOTIQUIN', { doomednum: 2012, spawnstate: 'S_BOTI', flags: MF_SPECIAL, title: 'Botiquín de campaña' });
MI_Def('CHARQUI', { doomednum: 2014, spawnstate: 'S_CHAR', flags: MF_SPECIAL | MF_COUNTITEM, title: 'Ración de charqui' });
MI_Def('ESCAPULARIO', { doomednum: 2015, spawnstate: 'S_ESCA', flags: MF_SPECIAL | MF_COUNTITEM, title: 'Escapulario del Carmen' });
MI_Def('ESTANDARTE', { doomednum: 2018, spawnstate: 'S_ESTA', flags: MF_SPECIAL, title: 'Estandarte del regimiento' });
MI_Def('BANDERA', { doomednum: 2019, spawnstate: 'S_BAND', flags: MF_SPECIAL, title: 'Bandera de Chile' });
MI_Def('CHUPILCA', { doomednum: 2023, spawnstate: 'S_CHUP', flags: MF_SPECIAL | MF_COUNTITEM, title: 'Chupilca del diablo' });
MI_Def('PLANO', { doomednum: 2026, spawnstate: 'S_PLAN', flags: MF_SPECIAL | MF_COUNTITEM, title: 'Plano del terreno' });
MI_Def('MOCHILA', { doomednum: 8, spawnstate: 'S_MOCH', flags: MF_SPECIAL, title: 'Mochila de campaña' });
// Decoración (sólidos u ornamentales)
MI_Def('CANON_KRUPP', { doomednum: 2101, spawnstate: 'S_CANK', radius: 28, height: 40, flags: MF_SOLID, title: 'Cañón Krupp de campaña' });
MI_Def('CANON_LISO', { doomednum: 2102, spawnstate: 'S_CANL', radius: 28, height: 40, flags: MF_SOLID, title: 'Cañón de ánima lisa' });
MI_Def('CANON_COSTA', { doomednum: 2103, spawnstate: 'S_CANR', radius: 40, height: 56, flags: MF_SOLID, title: 'Cañón de costa' });
MI_Def('TAMARUGO', { doomednum: 2104, spawnstate: 'S_TAMA', radius: 20, height: 100, flags: MF_SOLID, title: 'Tamarugo' });
MI_Def('POSTE', { doomednum: 2105, spawnstate: 'S_POST', radius: 6, height: 120, flags: MF_SOLID, title: 'Poste de telégrafo' });
MI_Def('FAROL', { doomednum: 2106, spawnstate: 'S_FARO', radius: 8, height: 80, flags: MF_SOLID, title: 'Farol' });
MI_Def('FOGATA', { doomednum: 2107, spawnstate: 'S_FOGA', radius: 16, height: 24, flags: MF_SOLID, title: 'Fogata' });
MI_Def('FUEGO', { doomednum: 2108, spawnstate: 'S_FUEG', radius: 16, height: 40, flags: 0, title: 'Incendio' });
MI_Def('HUMAREDA', { doomednum: 2109, spawnstate: 'S_HUMC', radius: 16, height: 120, flags: MF_NOBLOCKMAP, title: 'Humareda' });
MI_Def('SACOS', { doomednum: 2110, spawnstate: 'S_SACO', radius: 20, height: 30, flags: MF_SOLID, title: 'Sacos' });
MI_Def('CAJONES', { doomednum: 2111, spawnstate: 'S_CAJA', radius: 20, height: 40, flags: MF_SOLID, title: 'Cajones' });
MI_Def('RUEDA', { doomednum: 2112, spawnstate: 'S_RUED', radius: 12, height: 30, flags: 0, title: 'Rueda' });
MI_Def('ANCLA', { doomednum: 2113, spawnstate: 'S_ANCL', radius: 14, height: 30, flags: MF_SOLID, title: 'Ancla' });
MI_Def('LANCHA', { doomednum: 2114, spawnstate: 'S_BOTE', radius: 30, height: 20, flags: MF_SOLID, title: 'Lancha' });
MI_Def('CARRETA', { doomednum: 2115, spawnstate: 'S_CARR', radius: 30, height: 40, flags: MF_SOLID, title: 'Carreta' });
MI_Def('PIPA', { doomednum: 2116, spawnstate: 'S_PIPA', radius: 14, height: 36, flags: MF_SOLID, title: 'Pipa de agua' });
MI_Def('MASTIL', { doomednum: 2117, spawnstate: 'S_MAST', radius: 8, height: 160, flags: MF_SOLID, title: 'Mástil' });
MI_Def('CAIDO_CHILENO', { doomednum: 2118, spawnstate: 'S_CHIL_DEAD', title: 'Soldado chileno caído' });
MI_Def('CAIDO_PERUANO', { doomednum: 2119, spawnstate: 'S_GUAR_DEAD', title: 'Soldado peruano caído' });
MI_Def('CAIDO_BOLIVIANO', { doomednum: 2120, spawnstate: 'S_BOLI_DEAD', title: 'Soldado boliviano caído' });
MI_Def('CABALLO_CAIDO', { doomednum: 2121, spawnstate: 'S_CABA_DEAD', title: 'Caballo caído' });
MI_Def('CENTINELA', { doomednum: 2122, spawnstate: 'S_CHIL_STAND', radius: 16, height: 56, flags: MF_SOLID, title: 'Soldado chileno' });
MI_Def('TELEPORTMAN', { doomednum: 14, spawnstate: 'S_TNT1', flags: MF_NOBLOCKMAP | MF_NOSECTOR });
MI_Def('PUNTO', { doomednum: 7010, spawnstate: 'S_TNT1', flags: MF_NOBLOCKMAP | MF_NOSECTOR, title: 'Punto de aparición' });

// Traducción de nombres de estado/acción/sprite a índices y funciones.
function P_InitInfo() {
  for (const st of states) {
    let f = st.frameSpec;
    let bright = false;
    if (typeof f === 'string') {
      if (f.endsWith('*')) { bright = true; f = f.slice(0, -1); }
      f = f.charCodeAt(0) - 65;
    }
    st.frame = f | (bright ? FF_FULLBRIGHT : 0);
    st.nextstate = S_(st.nextName);
    if (st.actionName) {
      const fn = (typeof window !== 'undefined' ? window : globalThis)[st.actionName];
      if (typeof fn !== 'function') throw new Error('acción no definida: ' + st.actionName);
      st.action = fn;
    }
    st.sprite = st.spritename === 'TNT1' ? -1 : spritelookup.has(st.spritename) ? spritelookup.get(st.spritename) : -2;
  }
  for (const mi of mobjinfo) {
    for (const k of ['spawnstate', 'seestate', 'painstate', 'meleestate', 'missilestate', 'deathstate', 'xdeathstate', 'raisestate', 'gibstate']) {
      if (typeof mi[k] === 'string') mi[k] = S_(mi[k]);
    }
  }
}

function P_TypeForDoomedNum(num) {
  if (typeof num === 'string') {
    const t = MT[num];
    if (t === undefined) return -1;
    return t;
  }
  for (let i = 0; i < mobjinfo.length; i++) if (mobjinfo[i].doomednum === num) return i;
  return -1;
}
