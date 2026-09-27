// =============================================================================
// p_battle.js — Director de batalla del motor Atenea (extensión de DOOM)
// -----------------------------------------------------------------------------
// DOOM enfrenta a un solo marine contra monstruos en laberintos. Las acciones
// de la Guerra del Pacífico fueron batallas en campo abierto entre ejércitos.
// Este módulo añade, sobre la arquitectura de thinkers de DOOM:
//   * Bandos: Chile (jugador y tropas aliadas) contra la Alianza (Perú y
//     Bolivia). La búsqueda de blancos, los disparos y las explosiones
//     respetan los bandos.
//   * Eventos: oleadas y columnas enemigas o refuerzos aliados que aparecen
//     por tiempo, al cruzar una línea o al cumplirse un objetivo.
//   * Bombardeos: fuego de la escuadra o de baterías sobre zonas del mapa.
//   * Objetivos: fases históricas de cada acción de armas; hay que cumplirlos
//     para izar la bandera y terminar la misión.
// =============================================================================
'use strict';

const FACTION_NONE = 0, FACTION_CHILE = 1, FACTION_ALIANZA = 2;
const MAXSIGHTDIST = 2200;       // alcance de vista de los soldados en campo abierto
const NOISE_RANGE = 1500;        // alcance del ruido de los disparos

let factionList = [[], [], []];
let battle = null;               // estado de la batalla del nivel actual

function B_FactionOf(mo) { return mo && mo.info ? (mo.info.faction || 0) : 0; }
function B_Hostile(a, b) {
  const fa = B_FactionOf(a), fb = B_FactionOf(b);
  return fa !== 0 && fb !== 0 && fa !== fb;
}
function B_SameFaction(a, b) {
  const fa = B_FactionOf(a);
  return fa !== 0 && fa === B_FactionOf(b);
}

function B_Register(mo) {
  const f = B_FactionOf(mo);
  if (f) factionList[f].push(mo);
}

// Compacta periódicamente las listas (quita muertos y removidos).
function B_CompactLists() {
  for (let f = 1; f <= 2; f++) {
    factionList[f] = factionList[f].filter(function (m) { return !m.removed && m.health > 0 && (m.flags & MF_SHOOTABLE); });
  }
}

// Busca un blanco hostil visible. Revisa pocos candidatos por llamada para no
// saturar la CPU (rotación con lastlook, como DOOM con los jugadores).
function P_LookForTargets(actor, allaround, maxdist) {
  const f = B_FactionOf(actor);
  if (!f) return false;
  const foes = factionList[f === FACTION_CHILE ? FACTION_ALIANZA : FACTION_CHILE];
  maxdist = maxdist || actor.info.sightdist || MAXSIGHTDIST;
  // Los enemigos prefieren al jugador cuando está a la vista.
  const pl = players[0] && players[0].mo;
  if (f === FACTION_ALIANZA && pl && players[0].health > 0 && !(players[0].cheats & CF_NOTARGET) && P_Random() < 150) {
    if (B_CanSee(actor, pl, allaround, maxdist)) {
      actor.target = pl;
      return true;
    }
  }
  const n = foes.length;
  if (!n) return false;
  let best = null, bestdist = Infinity, checks = 0;
  const start = actor.lastlook % n;
  for (let k = 0; k < n && checks < 4; k++) {
    const t = foes[(start + k) % n];
    if (!t || t.removed || t.health <= 0 || !(t.flags & MF_SHOOTABLE)) continue;
    if (t.player && (t.player.cheats & CF_NOTARGET)) continue;
    const dist = P_AproxDistance(t.x - actor.x, t.y - actor.y);
    if (dist > maxdist) continue;
    checks++;
    if (!B_CanSee(actor, t, allaround, maxdist)) continue;
    if (dist < bestdist) { best = t; bestdist = dist; }
  }
  actor.lastlook = (start + 4) % n;
  if (best) {
    actor.target = best;
    return true;
  }
  return false;
}

function B_CanSee(actor, t, allaround, maxdist) {
  const dist = P_AproxDistance(t.x - actor.x, t.y - actor.y);
  if (dist > maxdist) return false;
  if (!allaround) {
    const an = (R_PointToAngle2(actor.x, actor.y, t.x, t.y) - actor.angle) >>> 0;
    if (an > ANG90 && an < ANG270 && dist > MELEERANGE * 2) return false;
  }
  return P_CheckSight(actor, t);
}

// --- Tropas aliadas ------------------------------------------------------------------------------
// Un aliado sin enemigos a la vista sigue al jugador a cierta distancia.
function A_AllyLook(actor) {
  actor.threshold = 0;
  if (P_LookForTargets(actor, true)) {
    actor.following = false;
    P_SetMobjState(actor, actor.info.seestate);
    return;
  }
  const pl = players[0] && players[0].mo;
  if (pl && players[0].health > 0 && !actor.holdPosition) {
    const d = P_AproxDistance(pl.x - actor.x, pl.y - actor.y);
    if (d > 280) {
      actor.following = true;
      actor.target = pl;
      P_SetMobjState(actor, actor.info.seestate);
    }
  }
}

function A_AllyChase(actor) {
  if (actor.reactiontime) actor.reactiontime--;
  // Revisar periódicamente si hay un enemigo más cercano.
  if (--actor.retarget <= 0) {
    actor.retarget = 25 + (P_Random() & 15);
    const old = actor.target;
    if (actor.following || !old || old.health <= 0 || !P_CheckSight(actor, old)) {
      if (P_LookForTargets(actor, true)) actor.following = false;
      else if (old && old.health <= 0) actor.target = null;
    }
  }
  let t = actor.target;
  if (!t || t.removed || t.health <= 0) {
    actor.target = null;
    actor.following = false;
    P_SetMobjState(actor, actor.info.spawnstate);
    return;
  }
  if (actor.movedir < 8) {
    actor.angle = (actor.angle & (7 << 29)) >>> 0;
    const delta = (actor.angle - (actor.movedir << 29)) | 0;
    if (delta > 0) actor.angle = (actor.angle - ANG90 / 2) >>> 0;
    else if (delta < 0) actor.angle = (actor.angle + ANG90 / 2) >>> 0;
  }
  if (actor.following) {
    const d = P_AproxDistance(t.x - actor.x, t.y - actor.y);
    if (d < 180) {
      actor.following = false;
      actor.target = null;
      P_SetMobjState(actor, actor.info.spawnstate);
      return;
    }
  } else {
    if (actor.flags & MF_JUSTATTACKED) {
      actor.flags &= ~MF_JUSTATTACKED;
      P_NewChaseDir(actor);
      return;
    }
    if (actor.info.meleestate !== S_NULL && P_CheckMeleeRange(actor)) {
      P_SetMobjState(actor, actor.info.meleestate);
      return;
    }
    if (actor.info.missilestate !== S_NULL && !actor.movecount && P_CheckMissileRange(actor)) {
      P_SetMobjState(actor, actor.info.missilestate);
      actor.flags |= MF_JUSTATTACKED;
      return;
    }
  }
  if (--actor.movecount < 0 || !P_Move(actor)) P_NewChaseDir(actor);
}

// Aliado: tiro de fusil Comblain.
function A_AllyRifle(actor) {
  if (!actor.target) return;
  A_FaceTarget(actor);
  let angle = actor.angle;
  const slope = P_AimLineAttack(actor, angle, MISSILERANGE);
  S_StartSound(actor, 'rifle3');
  angle = (angle + ((P_Random() - P_Random()) << 20)) >>> 0;
  P_LineAttack(actor, angle, MISSILERANGE, slope, ((P_Random() % 5) + 1) * 3);
}

// --- Eventos (oleadas y refuerzos) -------------------------------------------------------------------
function B_InitBattle(map) {
  factionList = [[], [], []];
  const def = map.battle || {};
  battle = {
    objectives: (def.objectives || []).map(function (o, i) {
      return Object.assign({ index: i, done: false, tag: 0 }, o);
    }),
    events: (def.events || []).map(function (e) { return Object.assign({ fired: false }, e); }),
    bombards: (def.bombards || []).map(function (b) { return Object.assign({ timer: b.start || 0, active: !b.trigger }, b); }),
    spawnpoints: {},
    checkTimer: 0,
    pendingTags: {}
  };
  // Convertir etiquetas simbólicas a números (el compilador ya las tradujo).
  const tagmap = map.tagnames || {};
  function T(n) { return typeof n === 'number' ? n : (tagmap[n] || 0); }
  for (const o of battle.objectives) {
    if (o.kill) o.killtag = T(o.kill);
    if (o.reach) o.reachtag = T(o.reach);
  }
  for (const e of battle.events) {
    e.tagnum = T(e.tag);
    for (const s of e.spawn || []) { s.tagnum = T(s.tag); s.atnum = T(s.at); }
    if (e.trigger && e.trigger.line) e.trigger.linetag = T(e.trigger.line);
  }
  for (const b of battle.bombards) {
    if (b.trigger && b.trigger.line) b.trigger.linetag = T(b.trigger.line);
    if (b.tag) b.tagnum = T(b.tag);
  }
  B_RecountPending();
}

function B_RecountPending() {
  const p = {};
  for (const e of battle.events) {
    if (e.fired) continue;
    for (const s of e.spawn || []) if (s.tagnum) p[s.tagnum] = (p[s.tagnum] || 0) + s.count;
  }
  battle.pendingTags = p;
}

function B_RegisterSpawnPoint(mo) {
  const t = mo.tag || 0;
  if (!battle.spawnpoints[t]) battle.spawnpoints[t] = [];
  battle.spawnpoints[t].push(mo);
}

function B_TriggerEvent(tagnum) {
  if (!battle) return;
  for (const e of battle.events) {
    if (!e.fired && e.trigger && e.trigger.linetag === tagnum) B_FireEvent(e);
  }
  for (const b of battle.bombards) {
    if (b.trigger && b.trigger.linetag === tagnum) b.active = true;
  }
}

function B_FireEvent(e) {
  e.fired = true;
  for (const s of e.spawn || []) {
    const pts = battle.spawnpoints[s.atnum] || [];
    if (!pts.length) { console.warn('evento sin punto de aparición: ' + s.at); continue; }
    const type = MT[s.type];
    let placed = 0;
    for (let tries = 0; placed < s.count && tries < s.count * 12; tries++) {
      const base = pts[(placed + tries) % pts.length];
      const spread = s.spread || 96;
      const x = base.x + ((P_Random() - 128) / 128) * spread;
      const y = base.y + ((P_Random() - 128) / 128) * spread;
      const mo = P_SpawnMobj(x, y, ONFLOORZ, type);
      if (!P_CheckPosition(mo, x, y) || tmceilingz - tmfloorz < mo.height || Math.abs(tmfloorz - mo.subsector.sector.floorheight) > 24) {
        P_RemoveMobj(mo);
        continue;
      }
      mo.angle = base.angle;
      mo.tag = s.tagnum || 0;
      if (mo.flags & MF_COUNTKILL) totalkills++;
      placed++;
      if (s.hold) { mo.holdPosition = true; continue; }
      // Las columnas avanzan contra las líneas chilenas.
      if (B_FactionOf(mo) === FACTION_ALIANZA) {
        const pl = players[0] && players[0].mo;
        if (pl && players[0].health > 0) {
          mo.target = pl;
          mo.reactiontime = 10 + (P_Random() & 31);
          if (mo.info.seestate !== S_NULL) P_SetMobjState(mo, mo.info.seestate);
        }
      } else if (B_FactionOf(mo) === FACTION_CHILE && mo.info.seestate !== S_NULL) {
        if (P_LookForTargets(mo, true)) P_SetMobjState(mo, mo.info.seestate);
      }
    }
  }
  if (e.msg) HU_ShowBigMessage(e.msg);
  if (e.sound) S_StartSound(null, e.sound);
  B_RecountPending();
}

// --- Objetivos ---------------------------------------------------------------------------------------------
// Devuelve false si el objetivo existe pero aún no corresponde (fase previa
// pendiente): la línea W1 queda armada para el siguiente cruce.
function B_ReachObjective(tagnum) {
  if (!battle) return true;
  let waiting = false;
  for (const o of battle.objectives) {
    if (o.done || o.reachtag !== tagnum) continue;
    if (o.after && !battle.objectives[o.after - 1].done) {
      waiting = true;
      if (players[0] && leveltime - (battle.lastWaitMsg || -999) > TICRATE * 3) {
        battle.lastWaitMsg = leveltime;
        HU_PlayerMessage(players[0], 'Antes: ' + battle.objectives[o.after - 1].title + '.');
      }
      continue;
    }
    B_CompleteObjective(o);
  }
  if (waiting) return false;
  B_TriggerEvent(tagnum);
  return true;
}

function B_CompleteObjective(o) {
  o.done = true;
  S_StartSound(null, 'bugle');
  HU_ShowBigMessage(o.doneMsg || ('Objetivo cumplido: ' + o.title));
  if (players[0]) players[0].bonuscount += 10;
  // Eventos encadenados a este objetivo.
  for (const e of battle.events) {
    if (!e.fired && e.trigger && e.trigger.objective === o.index + 1) B_FireEvent(e);
  }
  for (const b of battle.bombards) {
    if (b.stop && b.stop.objective === o.index + 1) b.active = false;
    if (b.trigger && b.trigger.objective === o.index + 1) b.active = true;
  }
  const next = B_PendingObjective();
  if (next) HU_PlayerMessage(players[0], 'Siguiente objetivo: ' + next.title);
  else HU_PlayerMessage(players[0], 'Objetivos cumplidos. ¡Ice la bandera!');
}

function B_AllObjectivesDone() {
  if (!battle) return true;
  for (const o of battle.objectives) if (!o.done) return false;
  return true;
}

function B_PendingObjective() {
  if (!battle) return null;
  for (const o of battle.objectives) if (!o.done) return o;
  return null;
}

function B_CheckKillObjectives() {
  const alive = {};
  for (let th = thinkercap.next; th !== thinkercap; th = th.next) {
    if (th.isMobj && !th.removed && th.tag && th.health > 0 && (th.flags & MF_COUNTKILL)) {
      alive[th.tag] = (alive[th.tag] || 0) + 1;
    }
  }
  for (const o of battle.objectives) {
    if (o.done || !o.killtag) continue;
    if (o.after && !battle.objectives[o.after - 1].done) continue;
    if (!alive[o.killtag] && battle.pendingTags[o.killtag]) {
      // Caídos los defensores, llegan los refuerzos que esperaban un paso del
      // jugador por cierta línea (así el objetivo nunca queda bloqueado).
      for (const e of battle.events) {
        if (e.fired || !e.trigger || !e.trigger.line) continue;
        if ((e.spawn || []).some(function (sp) { return sp.tagnum === o.killtag; })) B_FireEvent(e);
      }
    }
    if (!alive[o.killtag] && !battle.pendingTags[o.killtag]) B_CompleteObjective(o);
  }
}

// --- Bombardeos ----------------------------------------------------------------------------------------------
function B_RunBombards() {
  const pl = players[0] && players[0].mo;
  for (const b of battle.bombards) {
    if (!b.active) continue;
    if (b.trigger && b.trigger.time !== undefined && leveltime < b.trigger.time * TICRATE) continue;
    if (--b.timer > 0) continue;
    const iv = b.interval || [60, 140];
    b.timer = iv[0] + Math.floor(P_Random() / 256 * (iv[1] - iv[0]));
    const z = b.zone;
    for (let k = 0; k < 6; k++) {
      const x = z[0] + P_Random() / 256 * (z[2] - z[0]);
      const y = z[1] + P_Random() / 256 * (z[3] - z[1]);
      if (pl && P_AproxDistance(pl.x - x, pl.y - y) < (b.safe || 320)) continue;
      const ss = R_PointInSubsector(x, y);
      const t = { func: T_Shell, x: x, y: y, z: ss.sector.floorheight + 8, timer: 28, damage: b.damage || 110, whistled: false };
      P_AddThinker(t);
      break;
    }
  }
}

// Granada en vuelo: silbido y luego explosión.
function T_Shell(t) {
  if (!t.whistled) {
    t.whistled = true;
    S_StartSound({ x: t.x, y: t.y, z: t.z, isorigin: true }, 'whistl');
  }
  if (--t.timer > 0) return;
  const b = P_SpawnMobj(t.x, t.y, t.z, MT.EXPLOSION);
  b.target = null;
  P_RemoveThinker(t);
}

// Llamado una vez por tic desde P_Ticker (vía P_UpdateSpecials).
function B_Ticker() {
  if (!battle) return;
  for (const e of battle.events) {
    if (e.fired || !e.trigger) continue;
    if (e.trigger.time !== undefined && leveltime >= e.trigger.time * TICRATE) B_FireEvent(e);
  }
  B_RunBombards();
  if (++battle.checkTimer >= 17) {
    battle.checkTimer = 0;
    B_CheckKillObjectives();
    B_CompactLists();
  }
}
