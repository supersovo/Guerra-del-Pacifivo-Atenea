// =============================================================================
// p_tick.js — Lista de "thinkers" y el tic de la simulación (p_tick.c)
// -----------------------------------------------------------------------------
// Cada objeto que piensa (mobjs, puertas, ascensores, luces) es un thinker en
// una lista doblemente enlazada. P_Ticker los ejecuta todos una vez por tic
// (35 veces por segundo), exactamente como DOOM.
// =============================================================================
'use strict';

const thinkercap = { prev: null, next: null, func: null };
let leveltime = 0;

function P_InitThinkers() {
  thinkercap.prev = thinkercap.next = thinkercap;
}

function P_AddThinker(th) {
  th.removed = false;
  thinkercap.prev.next = th;
  th.next = thinkercap;
  th.prev = thinkercap.prev;
  thinkercap.prev = th;
}

// Como en DOOM, la baja es diferida: se marca y se desenlaza al recorrer.
function P_RemoveThinker(th) {
  th.removed = true;
}

function P_RunThinkers() {
  let cur = thinkercap.next;
  while (cur !== thinkercap) {
    const next = cur.next;
    if (cur.removed) {
      cur.next.prev = cur.prev;
      cur.prev.next = cur.next;
    } else if (cur.func) {
      cur.func(cur);
    }
    cur = next;
  }
}

// Guarda posiciones del tic anterior para el renderizado interpolado.
function P_SaveInterpolation() {
  for (let th = thinkercap.next; th !== thinkercap; th = th.next) {
    if (th.isMobj && !th.removed) {
      th.oldx = th.x; th.oldy = th.y; th.oldz = th.z; th.oldangle = th.angle;
      th.oldvalid = true;
    }
  }
  const p = players[0];
  if (p && p.mo) {
    p.oldviewz = p.viewz;
    for (const psp of p.psprites) { psp.oldsx = psp.sx; psp.oldsy = psp.sy; psp.oldvalid = true; }
  }
  R_movingSectors = [];
}

function P_MarkSectorMoving(sec) {
  if (sec.interptic !== leveltime) {
    sec.oldfloorheight = sec.floorheight;
    sec.oldceilingheight = sec.ceilingheight;
    sec.interptic = leveltime;
    R_movingSectors.push(sec);
  }
}

function P_Ticker() {
  if (paused) return;
  if (menuactive && players[0].viewz !== 1) return;
  P_SaveInterpolation();
  if (playeringame[0]) P_PlayerThink(players[0]);
  P_RunThinkers();
  P_UpdateSpecials();
  leveltime++;
}
