// =============================================================================
// d_items.js — Armas del soldado chileno (d_items.c)
// -----------------------------------------------------------------------------
//  1 CORVO       Cuchillo curvo de los mineros de Atacama, arma icónica del
//                soldado chileno en la guerra (asalto del Morro de Arica).
//  2 REVÓLVER    Lefaucheux de 11 mm, arma de mando de oficiales.
//  3 COMBLAIN II Fusil belga monotiro de bloque descendente, calibre 11 mm,
//                arma reglamentaria de la infantería chilena.
//  4 GATLING     Ametralladora de manivela; Chile las empleó en calibre 11 mm
//                (en el cerro San Francisco había dos Gatling).
//  5 DINAMITA    Cartuchos de dinamita (uso minero y de zapadores).
// =============================================================================
'use strict';

const weaponinfo = [
  { name: 'Corvo', short: 'CORVO', ammo: am_noammo, upstate: 'S_CORVOUP', downstate: 'S_CORVODOWN', readystate: 'S_CORVO', atkstate: 'S_CORVOATK1', flashstate: 'S_NULL' },
  { name: 'Revólver Lefaucheux', short: 'REVÓLVER', ammo: am_revolver, upstate: 'S_REVOUP', downstate: 'S_REVODOWN', readystate: 'S_REVO', atkstate: 'S_REVOATK1', flashstate: 'S_REVOFLASH' },
  { name: 'Fusil Comblain II', short: 'COMBLAIN', ammo: am_fusil, upstate: 'S_COMBUP', downstate: 'S_COMBDOWN', readystate: 'S_COMB', atkstate: 'S_COMBATK1', flashstate: 'S_COMBFLASH1' },
  { name: 'Ametralladora Gatling', short: 'GATLING', ammo: am_fusil, upstate: 'S_GATLUP', downstate: 'S_GATLDOWN', readystate: 'S_GATL', atkstate: 'S_GATLATK1', flashstate: 'S_GATLFLASH1' },
  { name: 'Dinamita', short: 'DINAMITA', ammo: am_dinamita, upstate: 'S_DINWUP', downstate: 'S_DINWDOWN', readystate: 'S_DINW', atkstate: 'S_DINWATK1', flashstate: 'S_NULL' }
];

const ammonames = ['Cartuchos de revólver', 'Cartuchos 11 mm', 'Dinamita'];
const maxammo = [200, 200, 30];
const clipammo = [8, 8, 1];

function D_InitWeaponInfo() {
  for (const w of weaponinfo) {
    for (const k of ['upstate', 'downstate', 'readystate', 'atkstate', 'flashstate']) {
      if (typeof w[k] === 'string') w[k] = S_(w[k]);
    }
  }
}
