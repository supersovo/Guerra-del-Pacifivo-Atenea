// =============================================================================
// models.js — Modelos de personajes, caballos, cañones, objetos y armas
// -----------------------------------------------------------------------------
// Uniformes (ver docs/HISTORIA.md):
//  * Chile, infantería de línea: levita azul, pantalón rojo (garance), kepí
//    rojo con franja azul y cubrenuca blanco; fusil Comblain II.
//  * Perú, Guardia Nacional: uniforme de lino (dril) blanco, kepí azul;
//    fusil Peabody/Castañón.
//  * Bolivia, batallón Independencia: bayeta gris con vivos verdes en puños,
//    cuello y gorra (gorra de cartón forrada con visera de hojalata), ojotas;
//    fusil Remington.
//  * Oficial peruano: chaqueta y pantalón azules con banda celeste.
// Coordenadas del modelo: unidades de mapa; x adelante, y izquierda, z arriba.
// =============================================================================
'use strict';

// --- Estilos de uniforme ------------------------------------------------------------------------------
const STYLE = {
  CHILE: {
    tunic: MAT(R_NAVY, 7), trousers: MAT(R_RED, 5), cuffs: MAT(R_RED, 5), collar: MAT(R_RED, 5),
    cap: 'kepi', capTop: MAT(R_RED, 5), capBand: MAT(R_NAVY, 6), visor: MAT(R_GRAY, 13, { spec: 0.6 }),
    havelock: MAT(R_LINEN, 2), belts: MAT(R_WOOD, 12), crossbelts: MAT(R_LINEN, 3), boots: MAT(R_WOOD, 13),
    skin: MAT(R_SKIN, 4), hair: MAT(R_WOOD, 13), buttons: MAT(R_GOLD, 3, { spec: 1 }), pack: MAT(R_WOOD, 9),
    blanket: MAT(R_STEEL, 7), moustache: true, weapon: 'rifle'
  },
  GUARDIA: {
    tunic: MAT(R_LINEN, 3), trousers: MAT(R_LINEN, 4), cuffs: MAT(R_LINEN, 5), collar: MAT(R_NAVY, 7),
    cap: 'kepi', capTop: MAT(R_NAVY, 7), capBand: MAT(R_NAVY, 9), visor: MAT(R_GRAY, 13, { spec: 0.6 }),
    havelock: null, belts: MAT(R_GRAY, 13), crossbelts: MAT(R_GRAY, 12), boots: MAT(R_WOOD, 11),
    gaiters: MAT(R_LINEN, 2), skin: MAT(R_SKIN, 5), hair: MAT(R_GRAY, 14), buttons: MAT(R_GOLD, 3, { spec: 1 }),
    pack: MAT(R_WOOD, 8), blanket: MAT(R_RED, 8), moustache: true, weapon: 'rifle'
  },
  BOLIVIA: {
    tunic: MAT(R_STONE, 6), trousers: MAT(R_STONE, 7), cuffs: MAT(R_GREEN, 6), collar: MAT(R_GREEN, 6),
    cap: 'cap', capTop: MAT(R_STONE, 6), capBand: MAT(R_GREEN, 6), visor: MAT(R_STEEL, 3, { spec: 1.2 }),
    havelock: null, belts: MAT(R_WOOD, 10), crossbelts: MAT(R_WOOD, 9), boots: null, sandals: true,
    skin: MAT(R_SKIN, 6), hair: MAT(R_GRAY, 14), buttons: MAT(R_STEEL, 3, { spec: 1 }),
    pack: MAT(R_WOOD, 7), blanket: MAT(R_STONE, 9), moustache: false, weapon: 'rifle'
  },
  PERU_LINEA: {
    tunic: MAT(R_LINEN, 3), trousers: MAT(R_NAVY, 8), cuffs: MAT(R_RED, 5), collar: MAT(R_RED, 5),
    cap: 'kepi', capTop: MAT(R_RED, 6), capBand: MAT(R_LINEN, 3), visor: MAT(R_GRAY, 13, { spec: 0.6 }),
    havelock: MAT(R_LINEN, 2), belts: MAT(R_GRAY, 13), crossbelts: MAT(R_GRAY, 12), boots: MAT(R_WOOD, 12),
    skin: MAT(R_SKIN, 5), hair: MAT(R_GRAY, 14), buttons: MAT(R_GOLD, 3, { spec: 1 }),
    pack: MAT(R_WOOD, 8), blanket: MAT(R_NAVY, 9), moustache: true, weapon: 'bayonet'
  },
  ZAPADOR: {
    tunic: MAT(R_STEEL, 8), trousers: MAT(R_LINEN, 5), cuffs: MAT(R_STEEL, 9), collar: MAT(R_STEEL, 9),
    cap: 'hat', capTop: MAT(R_WOOD, 9), capBand: MAT(R_WOOD, 12), visor: null,
    havelock: null, belts: MAT(R_WOOD, 11), crossbelts: null, boots: MAT(R_WOOD, 12),
    skin: MAT(R_SKIN, 5), hair: MAT(R_GRAY, 14), buttons: MAT(R_STEEL, 5),
    pack: null, satchel: MAT(R_LINEN, 6), moustache: true, beard: true, weapon: 'none'
  },
  OFICIAL: {
    tunic: MAT(R_NAVY, 8), trousers: MAT(R_NAVY, 9), cuffs: MAT(R_GOLD, 3, { spec: 1 }), collar: MAT(R_GOLD, 3, { spec: 1 }),
    cap: 'kepi', capTop: MAT(R_NAVY, 8), capBand: MAT(R_GOLD, 3, { spec: 1 }), visor: MAT(R_GRAY, 13, { spec: 0.8 }),
    havelock: null, belts: MAT(R_GRAY, 13), crossbelts: null, sash: MAT(R_SKY, 3), boots: MAT(R_GRAY, 13, { spec: 0.6 }),
    skin: MAT(R_SKIN, 4), hair: MAT(R_GRAY, 14), buttons: MAT(R_GOLD, 2, { spec: 1.2 }), epaulettes: MAT(R_GOLD, 2, { spec: 1.2 }),
    pack: null, moustache: true, sideburns: true, weapon: 'revolver'
  },
  ARTILLERO_PE: {
    tunic: MAT(R_NAVY, 8), trousers: MAT(R_LINEN, 4), cuffs: MAT(R_RED, 5), collar: MAT(R_RED, 5),
    cap: 'kepi', capTop: MAT(R_NAVY, 8), capBand: MAT(R_RED, 5), visor: MAT(R_GRAY, 13, { spec: 0.6 }),
    havelock: null, belts: MAT(R_LINEN, 3), crossbelts: MAT(R_LINEN, 3), boots: MAT(R_WOOD, 12),
    skin: MAT(R_SKIN, 5), hair: MAT(R_GRAY, 14), buttons: MAT(R_GOLD, 3, { spec: 1 }), pack: null, moustache: true, weapon: 'none'
  },
  ARTILLERO_CL: {
    tunic: MAT(R_NAVY, 7), trousers: MAT(R_RED, 5), cuffs: MAT(R_RED, 5), collar: MAT(R_RED, 5),
    cap: 'kepi', capTop: MAT(R_RED, 5), capBand: MAT(R_NAVY, 6), visor: MAT(R_GRAY, 13, { spec: 0.6 }),
    havelock: MAT(R_LINEN, 2), belts: MAT(R_WOOD, 12), crossbelts: MAT(R_LINEN, 3), boots: MAT(R_WOOD, 13),
    skin: MAT(R_SKIN, 4), hair: MAT(R_WOOD, 13), buttons: MAT(R_GOLD, 3, { spec: 1 }), pack: null, moustache: true, weapon: 'none'
  },
  HUSAR: {
    tunic: MAT(R_RED, 5), trousers: MAT(R_NAVY, 8), cuffs: MAT(R_GOLD, 3, { spec: 1 }), collar: MAT(R_GOLD, 3, { spec: 1 }),
    cap: 'shako', capTop: MAT(R_GRAY, 13), capBand: MAT(R_GOLD, 3, { spec: 1 }), visor: MAT(R_GRAY, 14, { spec: 0.6 }),
    havelock: null, belts: MAT(R_LINEN, 3), crossbelts: MAT(R_LINEN, 3), boots: MAT(R_GRAY, 14, { spec: 0.6 }),
    skin: MAT(R_SKIN, 5), hair: MAT(R_GRAY, 14), buttons: MAT(R_GOLD, 2, { spec: 1 }), braid: MAT(R_GOLD, 3, { spec: 1 }),
    pack: null, moustache: true, weapon: 'saber'
  }
};

const M_WOOD = MAT(R_WOOD, 6, { k: 6 });
const M_WOODD = MAT(R_WOOD, 9, { k: 6 });
const M_STEEL = MAT(R_STEEL, 7, { spec: 1.4 });
const M_STEELB = MAT(R_STEEL, 3, { spec: 2 });
const M_BRASS = MAT(R_GOLD, 4, { spec: 1.5 });
const M_IRON = MAT(R_GRAY, 11, { spec: 0.8 });
const M_BLOOD = MAT(R_RED, 8, { k: 5 });
const M_BLOODD = MAT(R_RED, 11, { k: 3 });
const M_FLESH = MAT(R_RED, 5, { k: 6 });
const M_FIRE = MAT(R_FIRE, 1, { glow: true, pattern: function (lp) { return Math.abs(lp[0] + lp[1] * 0.7) % 3; } });
const M_FIRE2 = MAT(R_FIRE, 4, { glow: true });
const M_FLASH = MAT(R_FIRE, 0, { glow: true });
const M_SMOKE = MAT(R_GRAY, 7, { k: 4 });
const M_SMOKED = MAT(R_GRAY, 9, { k: 4 });

// --- Armas portátiles (en coordenadas locales: x hacia la boca, z arriba) ----------------------------------
function WPN_Rifle(bayonet, dark) {
  const wood = dark ? M_WOODD : M_WOOD;
  const s = [];
  s.push(PR_box([-12, 0, -1.2], 3.2, 1.1, 2.3, null, wood));       // culata
  s.push(PR_box([-5, 0, -0.4], 4.2, 0.9, 1.2, null, wood));        // garganta
  s.push(PR_box([1.5, 0, 0.1], 2.6, 1.0, 1.3, null, M_STEEL));     // cajón de mecanismo
  s.push(PR_box([2, 0, -1.9], 2.2, 0.35, 0.6, null, M_STEEL));     // palanca (guardamonte)
  s.push(PR_box([12, 0, -0.5], 8.5, 0.95, 0.95, null, wood));      // guardamano
  s.push(PR_cyl([15, 0, 0.5], 0.55, 15, M3_fromDir([1, 0, 0]), M_STEEL));  // cañón
  s.push(PR_cyl([9, 0, 0], 1.15, 0.4, M3_fromDir([1, 0, 0]), M_BRASS));
  s.push(PR_cyl([18, 0, 0], 1.1, 0.4, M3_fromDir([1, 0, 0]), M_STEEL));
  if (bayonet) {
    s.push(PR_cyl([30.5, 0, 0.5], 0.8, 1.2, M3_fromDir([1, 0, 0]), M_STEEL));
    s.push(PR_box([39, 0, 0.9], 8.5, 0.18, 0.55, null, M_STEELB));
  }
  return s;
}

function WPN_Revolver() {
  const s = [];
  s.push(PR_box([-1.8, 0, -2.4], 1.1, 0.8, 2.2, M3_rotY(0.35), M_WOODD));   // cacha
  s.push(PR_box([0.6, 0, 0.2], 2.0, 0.75, 1.0, null, M_STEEL));             // armazón
  s.push(PR_cyl([1.2, 0, 0.3], 1.2, 1.3, M3_fromDir([1, 0, 0]), M_STEEL));  // tambor
  s.push(PR_cyl([5.2, 0, 0.6], 0.4, 2.8, M3_fromDir([1, 0, 0]), M_STEEL));  // cañón
  s.push(PR_box([-1.2, 0, 1.3], 0.5, 0.3, 0.6, null, M_STEEL));             // martillo
  return s;
}

function WPN_Saber() {
  const s = [];
  s.push(PR_box([-2.5, 0, 0], 2.5, 0.6, 0.6, null, M_BRASS));                // empuñadura
  s.push(PR_box([0.2, 0, 0], 0.4, 1.6, 1.4, null, M_BRASS));                 // guarda
  // hoja curva en 3 tramos
  let x = 0.5, z = 0;
  for (let k = 0; k < 3; k++) {
    const a = 0.05 + k * 0.08;
    const len = 7.5;
    const nx = x + Math.cos(a) * len, nz = z + Math.sin(a) * len;
    s.push(PR_boxAlong([x, 0, z], [nx, 0, nz], 0.18, 0.7, M_STEELB, [0, 0, 1]));
    x = nx; z = nz;
  }
  return s;
}

function WPN_Dynamite(lit) {
  const s = [];
  s.push(PR_cyl([0, 0, 0], 1.1, 4.2, M3_fromDir([1, 0, 0]), MAT(R_RED, 6, { k: 6 })));
  s.push(PR_rod([4.2, 0, 0], [6.2, 0, 1.2], 0.25, MAT(R_GRAY, 12)));
  if (lit) {
    s.push(PR_ell([6.4, 0, 1.4], 1.1, 1.1, 1.1, null, M_FLASH));
    s.push(PR_ell([6.9, 0.4, 2.2], 0.5, 0.5, 0.5, null, M_FIRE2));
  }
  return s;
}

// Coloca un arma (escena local) en el modelo: origen = empuñadura, F = hacia la boca, U = arriba.
function WPN_Place(scene, grip, F, Uhint) {
  const f = vnorm(F);
  let u = Uhint || [0, 0, 1];
  u = vnorm(vsub(u, vscale(f, vdot(u, f))));
  const y = vcross(u, f);
  const R = [f, y, u];
  return SC_transform(scene, R, grip);
}

// --- IK de dos segmentos -----------------------------------------------------------------------------------
function IK2(a, t, l1, l2, pole) {
  let d = vsub(t, a);
  let dist = vlen(d);
  const maxd = l1 + l2 - 0.01;
  if (dist > maxd) { d = vscale(d, maxd / dist); dist = maxd; t = vadd(a, d); }
  if (dist < 0.5) dist = 0.5;
  const dir = vnorm(d);
  const x = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist);
  const h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  let p = vsub(pole, a);
  p = vsub(p, vscale(dir, vdot(p, dir)));
  const pn = vlen(p) > 1e-6 ? vnorm(p) : [0, 0, -1];
  return vadd(vadd(a, vscale(dir, x)), vscale(pn, h));
}

// --- Humanoide ---------------------------------------------------------------------------------------------
// pose: { pelvis:[x,y,z], lean, lean2 (lateral), headPitch, headYaw,
//         footL:[x,y,z], footR, handL, handR, weapon:{kind, grip, dir, up, flash}, extra:[] }
function HUM_Build(style, pose) {
  const s = [];
  const pel = pose.pelvis || [0, 0, 28];
  const lean = pose.lean || 0;
  // Rotación del torso: inclinación hacia adelante (alrededor de y) y giro.
  const RT = M3_mul(M3_rotZ(pose.twist || 0), M3_rotY(lean));
  const T = function (p) { return vadd(pel, M3_mulv(RT, p)); };  // punto relativo a la pelvis
  const Rt = function (R) { return M3_mul(RT, R || M3_I()); };
  // Torso
  s.push(PR_ell(T([0, 0, 10.5]), 5.0, 7.4, 9.2, Rt(), style.tunic));
  s.push(PR_ell(T([0.2, 0, 2.5]), 5.4, 7.0, 4.4, Rt(), style.tunic));
  s.push(PR_ell(T([0, 0, 0]), 4.6, 6.2, 3.4, Rt(), style.trousers));
  if (style.belts) s.push(PR_ell(T([0, 0, 3.6]), 5.6, 7.6, 1.1, Rt(), style.belts));
  if (style.sash) s.push(PR_ell(T([0.1, 0, 5.2]), 5.8, 7.7, 1.6, Rt(), style.sash));
  if (style.crossbelts) {
    s.push(PR_boxAlong(T([3.3, 6.0, 16.5]), T([4.4, -5.5, 4.8]), 0.95, 0.45, style.crossbelts, [1, 0, 0]));
    s.push(PR_boxAlong(T([3.3, -6.0, 16.5]), T([4.4, 5.5, 4.8]), 0.95, 0.45, style.crossbelts, [1, 0, 0]));
  }
  if (style.buttons) for (let k = 0; k < 5; k++) s.push(PR_ell(T([4.95, 1.4, 6 + k * 2.4]), 0.55, 0.55, 0.55, null, style.buttons));
  if (style.epaulettes) {
    s.push(PR_ell(T([0, 7.4, 17.8]), 2.4, 1.8, 0.9, Rt(), style.epaulettes));
    s.push(PR_ell(T([0, -7.4, 17.8]), 2.4, 1.8, 0.9, Rt(), style.epaulettes));
  }
  if (style.braid) for (let k = 0; k < 4; k++) s.push(PR_ell(T([4.9, 0, 7 + k * 2.8]), 0.5, 4.2, 0.45, Rt(), style.braid));
  if (style.pack) {
    s.push(PR_box(T([-6.2, 0, 11]), 2.1, 5.4, 5.0, Rt(), style.pack));
    s.push(PR_cyl(T([-6.0, 0, 17.4]), 1.8, 6.2, Rt(M3_fromDir([0, 1, 0])), style.blanket));
  }
  if (style.satchel) {
    s.push(PR_box(T([1.5, 7.8, 1.5]), 3.0, 1.6, 3.2, Rt(), style.satchel));
    s.push(PR_boxAlong(T([3.3, -6.0, 16.5]), T([2.5, 7.0, 4.0]), 0.7, 0.4, style.belts, [1, 0, 0]));
  }
  // cantimplora (caramayola) al costado
  s.push(PR_ell(T([-1, 7.6, 1.8]), 2.0, 1.0, 2.4, Rt(), MAT(R_STEEL, 6, { spec: 0.8 })));
  // Cuello y cabeza
  const neck = T([0, 0, 19.5]);
  const headR = M3_mul(RT, M3_mul(M3_rotZ(pose.headYaw || 0), M3_rotY(pose.headPitch || 0)));
  const H = function (p) { return vadd(neck, M3_mulv(headR, p)); };
  s.push(PR_limb(T([0, 0, 17]), neck, 2.2, style.skin));
  s.push(PR_ell(H([0.4, 0, 4.2]), 4.1, 3.7, 4.8, headR, style.skin));
  s.push(PR_ell(H([4.3, 0, 3.9]), 0.9, 0.75, 1.1, headR, MAT(R_SKIN, style.skin.tone + 1)));
  if (!pose.eyesClosed) {
    s.push(PR_ell(H([3.9, 1.5, 5.0]), 0.45, 0.55, 0.45, null, MAT(R_GRAY, 14)));
    s.push(PR_ell(H([3.9, -1.5, 5.0]), 0.45, 0.55, 0.45, null, MAT(R_GRAY, 14)));
  }
  if (style.moustache) s.push(PR_ell(H([4.1, 0, 2.6]), 0.7, 2.3, 0.6, headR, style.hair));
  if (style.beard) s.push(PR_ell(H([2.6, 0, 1.0]), 2.2, 3.0, 1.8, headR, style.hair));
  if (style.sideburns) {
    s.push(PR_ell(H([1.2, 3.4, 2.8]), 1.2, 0.5, 2.2, headR, style.hair));
    s.push(PR_ell(H([1.2, -3.4, 2.8]), 1.2, 0.5, 2.2, headR, style.hair));
  }
  s.push(PR_ell(H([-0.6, 0, 6.2]), 3.8, 3.6, 2.6, headR, style.hair));
  // Tocado
  if (!pose.noCap) HUM_Cap(s, style, H, headR);
  if (style.havelock && !pose.noCap) s.push(PR_box(H([-3.4, 0, 3.8]), 0.7, 3.9, 4.2, headR, style.havelock));
  // Brazos
  const shL = T([0.2, 7.4, 16.6]), shR = T([0.2, -7.4, 16.6]);
  const handL = pose.handL || T([2, 9, 2]), handR = pose.handR || T([2, -9, 2]);
  const poleL = pose.poleL || vadd(shL, [-8, 4, -6]), poleR = pose.poleR || vadd(shR, [-8, -4, -6]);
  const elL = IK2(shL, handL, 10.5, 10.5, poleL), elR = IK2(shR, handR, 10.5, 10.5, poleR);
  for (const arm of [[shL, elL, handL], [shR, elR, handR]]) {
    s.push(PR_limb(arm[0], arm[1], 2.15, style.tunic));
    const wrist = vlerp(arm[1], arm[2], 0.86);
    s.push(PR_limb(arm[1], wrist, 1.9, style.tunic));
    s.push(PR_limb(vlerp(arm[1], arm[2], 0.72), wrist, 2.05, style.cuffs));
    s.push(PR_ell(arm[2], 1.5, 1.4, 1.6, null, style.skin));
  }
  // Piernas
  const hipL = vadd(pel, M3_mulv(M3_rotZ(pose.twist || 0), [0, 3.4, -1])), hipR = vadd(pel, M3_mulv(M3_rotZ(pose.twist || 0), [0, -3.4, -1]));
  const footL = pose.footL || [0, 4, 0], footR = pose.footR || [0, -4, 0];
  const ankL = vadd(footL, [0, 0, 2.6]), ankR = vadd(footR, [0, 0, 2.6]);
  const knL = IK2(hipL, ankL, 13.5, 12.8, vadd(hipL, [12, 1, -8])), knR = IK2(hipR, ankR, 13.5, 12.8, vadd(hipR, [12, -1, -8]));
  for (const leg of [[hipL, knL, ankL, footL], [hipR, knR, ankR, footR]]) {
    s.push(PR_limb(leg[0], leg[1], 2.9, style.trousers));
    const shinMat = style.gaiters || style.trousers;
    s.push(PR_limb(leg[1], vlerp(leg[1], leg[2], 0.55), 2.35, style.trousers));
    s.push(PR_limb(vlerp(leg[1], leg[2], 0.5), leg[2], 2.25, shinMat));
    const toe = vadd(leg[3], [6.2 * Math.cos(pose.footYaw || 0), 6.2 * Math.sin(pose.footYaw || 0), 1.1]);
    if (style.sandals) {
      s.push(PR_limb(leg[2], toe, 1.5, style.skin));
      s.push(PR_boxAlong(vadd(leg[2], [-1, 0, -1.8]), vadd(toe, [0.5, 0, -1.0]), 1.6, 0.35, MAT(R_WOOD, 10), [0, 0, 1]));
    } else {
      s.push(PR_limb(leg[2], toe, 1.75, style.boots || MAT(R_WOOD, 12)));
    }
  }
  // Arma
  if (pose.weapon) {
    const w = pose.weapon;
    let ws = null;
    if (w.kind === 'rifle') ws = WPN_Rifle(false, style === STYLE.BOLIVIA);
    else if (w.kind === 'bayonet') ws = WPN_Rifle(true, false);
    else if (w.kind === 'revolver') ws = WPN_Revolver();
    else if (w.kind === 'saber') ws = WPN_Saber();
    else if (w.kind === 'dynamite') ws = WPN_Dynamite(w.lit);
    if (ws) for (const p of WPN_Place(ws, w.grip, w.dir, w.up)) s.push(p);
    if (w.flash) {
      const f = vnorm(w.dir);
      const muzzle = vadd(w.grip, vscale(f, w.muzzle || 31));
      s.push(PR_ell(vadd(muzzle, vscale(f, 3)), 4.2, 2.8, 2.8, M3_fromDir(f), M_FLASH));
      s.push(PR_ell(vadd(muzzle, vscale(f, 6.5)), 2.6, 3.4, 3.4, M3_fromDir(f), M_FIRE2));
      s.push(PR_ell(vadd(muzzle, [0, 0, 3]), 2.4, 2.4, 2.4, null, M_SMOKE));
    }
  }
  if (style.weapon === 'revolver' && !(pose.weapon && pose.weapon.kind === 'saber')) {
    // vaina del sable al costado izquierdo
    s.push(PR_limb(T([-0.5, 6.6, 1]), vadd(pel, [-9, 8, -18]), 0.8, MAT(R_GRAY, 13, { spec: 0.6 })));
  }
  if (pose.extra) for (const p of pose.extra) s.push(p);
  return s;
}

function HUM_Cap(s, style, H, headR) {
  const tilt = M3_mul(headR, M3_rotY(0.18));
  if (style.cap === 'kepi') {
    s.push(PR_cyl(H([0.9, 0, 9.6]), 3.9, 2.4, tilt, style.capTop, 3.6));
    s.push(PR_cyl(H([0.5, 0, 7.6]), 4.2, 1.0, tilt, style.capBand, 3.9));
    if (style.visor) s.push(PR_ell(H([4.4, 0, 6.8]), 2.4, 3.4, 0.45, M3_mul(headR, M3_rotY(0.35)), style.visor));
  } else if (style.cap === 'cap') {
    s.push(PR_cyl(H([0.5, 0, 8.8]), 4.1, 1.9, tilt, style.capTop, 4.3));
    s.push(PR_cyl(H([0.4, 0, 7.4]), 4.2, 0.6, tilt, style.capBand, 4.0));
    s.push(PR_ell(H([4.4, 0, 6.8]), 2.5, 3.6, 0.4, M3_mul(headR, M3_rotY(0.3)), style.visor));
  } else if (style.cap === 'hat') {
    s.push(PR_cyl(H([0.2, 0, 9.4]), 3.8, 2.4, headR, style.capTop));
    s.push(PR_cyl(H([0.2, 0, 7.4]), 7.8, 0.35, headR, style.capTop));
    s.push(PR_cyl(H([0.2, 0, 8.0]), 3.95, 0.6, headR, style.capBand));
  } else if (style.cap === 'shako') {
    s.push(PR_cyl(H([0.4, 0, 11.2]), 4.3, 4.2, tilt, style.capTop, 4.0));
    s.push(PR_cyl(H([0.4, 0, 7.6]), 4.4, 0.8, tilt, style.capBand));
    s.push(PR_ell(H([2.2, 0, 16.4]), 0.8, 0.8, 2.2, headR, MAT(R_RED, 4)));
    s.push(PR_ell(H([4.4, 0, 6.8]), 2.2, 3.4, 0.4, M3_mul(headR, M3_rotY(0.35)), style.visor));
  }
}

// Charco de sangre en el suelo.
function HUM_Pool(cx, cy, rx, ry) {
  return [PR_ell([cx, cy, 0.2], rx, ry, 0.35, null, M_BLOODD)];
}

// --- Poses de infantería -----------------------------------------------------------------------------------
function POSE_Walk(phase, style, opts) {
  opts = opts || {};
  const a = phase * Math.PI * 2;
  const stride = opts.stride || 7;
  const fl = stride * Math.sin(a), fr = -fl;
  const zl = 2.4 * Math.max(0, Math.cos(a)), zr = 2.4 * Math.max(0, -Math.cos(a));
  const bob = 0.7 * Math.abs(Math.sin(a));
  const pel = [0, 0, 27.2 + bob - (opts.crouch || 0)];
  const lean = opts.lean || 0.05;
  const pose = { pelvis: pel, lean: lean, footL: [fl, 4.2, zl], footR: [fr, -4.2, zr], headPitch: -lean * 0.8 };
  const kind = opts.weapon || style.weapon;
  if (kind === 'rifle' || kind === 'bayonet') {
    if (opts.charge) {
      const grip = [7 + Math.sin(a) * 0.6, -4.8, 33 - (opts.crouch || 0)];
      const dir = [1, 0.06, 0.2];
      pose.weapon = { kind: kind, grip: grip, dir: dir, up: [0, 0, 1] };
      pose.handR = grip;
      pose.handL = vadd(grip, vscale(vnorm(dir), 13));
      pose.poleL = [0, 14, 20]; pose.poleR = [-10, -12, 20];
    } else {
      const grip = [4.5, -4.2, 33.5 + bob];
      const dir = [0.22, 0.62, 0.75];
      pose.weapon = { kind: kind, grip: grip, dir: dir, up: [1, 0, 0.2] };
      pose.handR = grip;
      pose.handL = vadd(grip, vscale(vnorm(dir), 12));
      pose.poleL = [4, 14, 30]; pose.poleR = [-6, -14, 30];
    }
  } else if (kind === 'revolver') {
    const grip = [6, -8.5, 32 + bob];
    pose.weapon = { kind: 'revolver', grip: grip, dir: [1, 0, -0.35] };
    pose.handR = grip;
    pose.handL = [2 - Math.sin(a) * 4, 9.5, 31];
  } else if (kind === 'saber') {
    const grip = [7, -7, 44];
    pose.weapon = { kind: 'saber', grip: grip, dir: [0.4, 0, 1] };
    pose.handR = grip;
    pose.handL = [6, 6, 34];
  } else {
    pose.handR = [2 + Math.sin(a) * 5, -9, 30];
    pose.handL = [2 - Math.sin(a) * 5, 9, 30];
    if (style.satchel) pose.handL = [3, 8.5, 31];
  }
  return pose;
}

function POSE_Aim(style, flash, kind) {
  kind = kind || style.weapon;
  const pose = { pelvis: [0, 0, 27.4], lean: 0.08, footL: [5, 4.8, 0], footR: [-4, -4.4, 0], headPitch: 0.05, headYaw: -0.12, twist: -0.12 };
  const recoil = flash ? -1.6 : 0;
  if (kind === 'revolver') {
    const grip = [15 + recoil, -6.5, 44];
    pose.weapon = { kind: 'revolver', grip: grip, dir: [1, 0.05, flash ? 0.25 : 0.02], flash: flash, muzzle: 9 };
    pose.handR = grip;
    pose.handL = [2, 9.5, 31];
    pose.twist = 0;
  } else {
    const grip = [6 + recoil, -5.2, 43.8];
    const dir = [1, 0.1, flash ? 0.06 : 0];
    pose.weapon = { kind: kind === 'bayonet' ? 'bayonet' : 'rifle', grip: grip, dir: dir, flash: flash };
    pose.handR = grip;
    pose.handL = vadd(grip, [13, 1.3, 0.2]);
    pose.poleL = [8, 14, 30]; pose.poleR = [-6, -14, 34];
  }
  return pose;
}

function POSE_Pain(style) {
  const pose = { pelvis: [-1, 0, 27], lean: -0.3, footL: [2, 4.5, 0], footR: [-3, -4.5, 0], headPitch: -0.45 };
  const kind = style.weapon;
  if (kind === 'rifle' || kind === 'bayonet') {
    const grip = [3, -8, 30];
    pose.weapon = { kind: kind, grip: grip, dir: [0.35, 0.5, 0.8], up: [1, 0, 0] };
    pose.handR = grip;
    pose.handL = [6, 10, 38];
  } else {
    pose.handR = [3, -11, 36];
    pose.handL = [4, 11, 38];
    if (kind === 'revolver') pose.weapon = { kind: 'revolver', grip: pose.handR, dir: [0.6, -0.3, 0.5] };
  }
  return pose;
}

// Caída hacia atrás: el modelo erguido se rota alrededor de los pies.
function HUM_Fallen(style, t, final) {
  const base = {
    pelvis: [0, 0, 27 - t * 6], lean: -0.2 - t * 0.2, footL: [2 + t * 4, 4.5, 0], footR: [-1 + t * 6, -5, 0],
    headPitch: -0.3 - t * 0.3, eyesClosed: t > 0.5, noCap: final,
    handL: [2 - t * 6, 11 + t * 6, 36 + t * 6], handR: [2 - t * 6, -11 - t * 6, 36 + t * 6]
  };
  if (final) {
    base.handL = [-4, 16, 38]; base.handR = [-2, -15, 30];
    base.footL = [6, 6, 0]; base.footR = [5, -3, 0];
  }
  let s = HUM_Build(style, base);
  const ang = -t * Math.PI / 2 * 0.98;
  const R = M3_rotY(ang);
  s = SC_transform(s, R, [0, 0, 0]);
  // bajar al suelo
  let minz = Infinity;
  for (const p of s) minz = Math.min(minz, p.c[2] - PR_boundRadius(p) * 0.35);
  s = SC_transform(s, M3_I(), [0, 0, -Math.min(0, minz) + (final ? -2.2 : 0)]);
  if (final) {
    for (const p of HUM_Pool(-26, 0, 12, 7)) s.push(p);
    if (style.weapon === 'rifle' || style.weapon === 'bayonet') {
      for (const p of WPN_Place(WPN_Rifle(style.weapon === 'bayonet'), [-18, -16, 1.4], [1, -0.3, 0], [0, 0, 1])) s.push(p);
    }
    // kepí caído
    const cs = [];
    HUM_Cap(cs, style, function (p) { return vadd([-58, 10, -6.5], p); }, M3_I());
    for (const p of cs) s.push(p);
  } else if (t > 0.35) {
    for (const p of HUM_Pool(-18 * t, 0, 5 + t * 5, 4 + t * 3)) s.push(p);
  }
  // el cuerpo tendido queda centrado sobre el origen del objeto
  return SC_transform(s, M3_I(), [24 * t, 0, 0]);
}

// Destrozado por una explosión: 0 impacto, 1 restos en el aire, 2 caída, 3 en el suelo.
function HUM_Gibs(style, stage) {
  const rng = M_SeededRNG(777 + stage * 13);
  const s = [];
  if (stage === 0) {
    const body = HUM_Build(style, { pelvis: [0, 0, 27], lean: -0.1, footL: [1, 4, 0], footR: [-1, -4, 0], handL: [2, 12, 40], handR: [2, -12, 42] });
    for (const p of body) s.push(p);
    for (let k = 0; k < 10; k++) s.push(PR_ell([rng() * 10 - 3, rng() * 14 - 7, 30 + rng() * 18], 2 + rng() * 2.5, 2 + rng() * 2.5, 2 + rng() * 2.5, null, k & 1 ? M_BLOOD : M_FLESH));
    return s;
  }
  const legs = [
    null,
    [[[0, 4, 0], [2, 4, 24]], [[0, -4, 0], [-1, -4, 22]]],
    [[[0, 4, 0], [-11, 5, 18]], [[0, -4, 0], [-9, -6, 16]]],
    [[[2, 4, 1.8], [-20, 7, 3]], [[3, -5, 1.8], [-16, -11, 3]]]
  ][stage];
  for (const L of legs) {
    s.push(PR_limb(L[0], L[1], 3, style.trousers));
    s.push(PR_limb(L[0], vadd(L[0], [5, 0, 0.6]), 1.8, style.boots || style.skin));
  }
  if (stage < 3) s.push(PR_ell(vadd(vlerp(legs[0][1], legs[1][1], 0.5), [0, 0, 1]), 3.6, 5, 2.4, null, M_FLESH));
  const spread = stage / 3;
  const height = stage === 1 ? 26 : stage === 2 ? 12 : 0;
  // torso destrozado y restos
  const tz = stage === 3 ? 3.5 : 8 + height;
  s.push(PR_ell([-10 * spread - 8, 2, tz], 5, 7, stage === 3 ? 3.2 : 5.5, M3_rotY(spread * 1.3), style.tunic));
  s.push(PR_ell([-10 * spread - 5, 2, tz + 2], 3.5, 4.5, 2.4, null, M_FLESH));
  for (let k = 0; k < 14; k++) {
    const r = 1.8 + rng() * 2.6;
    const x = (rng() - 0.6) * 34 * spread, y = (rng() - 0.5) * 30 * spread;
    const z = stage === 3 ? r * 0.55 : Math.max(r, height + rng() * 22 - 6);
    s.push(PR_ell([x, y, z], r, r * (0.7 + rng() * 0.6), r * (stage === 3 ? 0.55 : 0.85), null, k % 3 === 0 ? style.tunic : k & 1 ? M_BLOOD : M_FLESH));
  }
  if (stage >= 2) for (const p of HUM_Pool(-8, 0, 10 + 8 * spread, 7 + 6 * spread)) s.push(p);
  return SC_transform(s, M3_I(), [6 * spread, 0, 0]);
}

// --- Caballo y húsar ----------------------------------------------------------------------------------------
const M_HORSE = MAT(R_WOOD, 7, { k: 7 });
const M_HORSED = MAT(R_WOOD, 12, { k: 5 });
const M_SADDLE = MAT(R_WOOD, 10, { k: 6 });
const M_BLANKET = MAT(R_RED, 6);

function HORSE_Build(phase, opts) {
  opts = opts || {};
  const s = [];
  const a = phase * Math.PI * 2;
  const bob = opts.still ? 0 : Math.sin(a * 2) * 1.5;
  const pitch = opts.pitch || 0;
  const R = M3_rotY(pitch);
  const B = function (p) { return vadd([0, 0, bob], M3_mulv(R, p)); };
  // cuerpo
  s.push(PR_ell(B([0, 0, 47]), 21, 9.5, 11.5, R, M_HORSE));
  s.push(PR_ell(B([13, 0, 49]), 9, 9, 11, R, M_HORSE));
  s.push(PR_ell(B([-13, 0, 49]), 9.5, 9.2, 10.5, R, M_HORSE));
  // cuello y cabeza
  const neckBase = B([18, 0, 55]), neckTop = B([27, 0, 71]);
  s.push(PR_limb(neckBase, neckTop, 6.2, M_HORSE, 5.5));
  s.push(PR_limb(vadd(neckBase, [-2, 0, 5]), vadd(neckTop, [-3, 0, 4]), 2.2, M_HORSED));   // crin
  const headDir = M3_mulv(R, [0.7, 0, -0.75]);
  const headC = vadd(neckTop, vscale(vnorm(headDir), 7));
  s.push(PR_ell(headC, 4.6, 4.2, 9.5, M3_fromDir(headDir), M_HORSE));
  s.push(PR_ell(vadd(neckTop, [1, 2.4, 4]), 0.9, 0.6, 2.2, M3_rotX(-0.3), M_HORSE));
  s.push(PR_ell(vadd(neckTop, [1, -2.4, 4]), 0.9, 0.6, 2.2, M3_rotX(0.3), M_HORSE));
  s.push(PR_ell(vadd(headC, [1.5, 3.2, 2.5]), 0.7, 0.5, 0.7, null, MAT(R_GRAY, 14)));
  s.push(PR_ell(vadd(headC, [1.5, -3.2, 2.5]), 0.7, 0.5, 0.7, null, MAT(R_GRAY, 14)));
  // cola
  s.push(PR_limb(B([-21, 0, 53]), B([-29, 0, 34 + Math.sin(a) * 3]), 2.6, M_HORSED));
  // montura y manta
  if (!opts.noSaddle) {
    s.push(PR_ell(B([-1, 0, 58.5]), 9, 10.2, 2.2, R, M_BLANKET));
    s.push(PR_ell(B([-1, 0, 60]), 7, 7.5, 2.4, R, M_SADDLE));
  }
  // patas: [x, y, fase]
  const legs = [[14, 5.5, 0], [14, -5.5, 0.12], [-14, 5.5, 0.5], [-14, -5.5, 0.62]];
  for (const L of legs) {
    const ph = (phase + L[2]) * Math.PI * 2;
    const hip = B([L[0], L[1], 44]);
    let hoof;
    if (opts.legs === 'folded') hoof = vadd(hip, [L[0] > 0 ? 10 : -8, 0, -14]);
    else if (opts.still) hoof = [L[0] + 1, L[1], 0];
    else hoof = [L[0] + Math.sin(ph) * 13, L[1], Math.max(0, Math.cos(ph)) * 9];
    const knee = IK2(hip, vadd(hoof, [0, 0, 3]), 20, 22, vadd(hip, [L[0] > 0 ? -12 : 12, 0, -10]));
    s.push(PR_limb(hip, knee, 3.6, M_HORSE, 3.2));
    s.push(PR_limb(knee, vadd(hoof, [0, 0, 3]), 2.1, M_HORSE));
    s.push(PR_cyl(vadd(hoof, [0, 0, 1.6]), 2.3, 1.6, null, M_HORSED));
  }
  return s;
}

function HUSAR_Build(phase, frame) {
  const s = HORSE_Build(phase, {});
  const style = STYLE.HUSAR;
  const a = phase * Math.PI * 2;
  const bob = Math.sin(a * 2) * 1.5;
  const pose = {
    pelvis: [-2, 0, 62 + bob], lean: 0.1,
    footL: [8, 11, 38 + bob], footR: [8, -11, 38 + bob], footYaw: 0,
    headPitch: -0.05
  };
  let grip, dir;
  if (frame === 'E') { grip = [-2, -9, 88]; dir = [-0.3, -0.1, 1]; }
  else if (frame === 'F') { grip = [8, -9, 86]; dir = [0.7, 0, 0.7]; }
  else if (frame === 'G') { grip = [18, -8, 66]; dir = [1, 0, -0.5]; }
  else if (frame === 'H') { grip = [2, -12, 74]; dir = [0.2, -0.6, 0.8]; pose.lean = -0.25; }
  else { grip = [6, -9, 78 + bob]; dir = [0.45, 0, 1]; }
  pose.weapon = { kind: 'saber', grip: grip, dir: dir };
  pose.handR = grip;
  pose.handL = [9, 3, 68 + bob];
  pose.poleL = [0, 14, 70]; pose.poleR = [-8, -16, 70];
  for (const p of HUM_Build(style, pose)) s.push(p);
  return s;
}

function HUSAR_Death(t, final) {
  if (!final && t < 0.4) {
    // el caballo se encabrita con el jinete herido
    const k = t / 0.4;
    const R = M3_rotY(-0.22 - 0.3 * k);
    const pivot = [-16, 0, 0];
    return SC_transform(HUSAR_Build(0.1, 'H'), R, vsub(pivot, M3_mulv(R, pivot)));
  }
  const tt = final ? 1 : (t - 0.4) / 0.6;
  let s = HORSE_Build(0.1, { still: true, legs: tt > 0.3 ? 'folded' : null, noSaddle: false });
  s = SC_transform(s, M3_rotX(-tt * 1.35), [0, 0, 0]);
  let minz = Infinity;
  for (const p of s) minz = Math.min(minz, p.c[2] - PR_boundRadius(p) * 0.5);
  s = SC_transform(s, M3_I(), [0, 0, -Math.min(0, minz) - (final ? 4 : 0)]);
  // jinete despedido de la montura
  let rider = HUM_Fallen(STYLE.HUSAR, Math.min(1, 0.35 + tt * 0.7), final);
  rider = SC_transform(rider, M3_rotZ(0.4), [-18, -24 * tt - 8, 30 * (1 - tt) * (1 - tt)]);
  for (const p of rider) s.push(p);
  if (final) for (const p of HUM_Pool(4, 4, 18, 10)) s.push(p);
  return s;
}

// --- Cañones -------------------------------------------------------------------------------------------------
function CANNON_Build(kind, recoil, opts) {
  opts = opts || {};
  const s = [];
  const krupp = kind === 'krupp';
  const coast = kind === 'coast';
  const matBarrel = krupp ? MAT(R_STEEL, 6, { spec: 1.2 }) : coast ? MAT(R_GRAY, 10, { spec: 0.6 }) : MAT(R_GRAY, 10, { spec: 0.5 });
  const matCarriage = krupp ? MAT(R_GREEN, 9, { k: 6 }) : MAT(R_WOOD, 8);
  const sc = coast ? 1.5 : 1;
  const r = -recoil;
  // ruedas (radio 13) y eje
  if (!coast) {
    for (const y of [-11, 11]) {
      const R = M3_fromDir([0, 1, 0]);
      s.push(PR_cyl([r, y, 13], 13, 1.2, R, MAT(R_WOOD, 9)));
      s.push(PR_cyl([r, y * 1.08, 13], 3, 2.2, R, M_IRON));
      for (let k = 0; k < 6; k++) {
        const a = k / 6 * Math.PI;
        s.push(PR_box([r, y, 13], 0.6, 0.5, 11.5, M3_rotY(a), MAT(R_WOOD, 7)));
      }
      s.push(PR_cyl([r, y, 13], 13.2, 0.7, R, M_IRON, 13.2));
    }
    s.push(PR_rod([r, -12, 13], [r, 12, 13], 1.4, M_IRON));
    // gualderas y contera
    s.push(PR_boxAlong([r + 4, 0, 18], [r - 34, 0, 2], 5, 2.6, matCarriage, [0, 0, 1]));
  } else {
    s.push(PR_cyl([0, 0, 4], 26, 4, null, MAT(R_STONE, 8)));
    s.push(PR_box([r - 4, 0, 16], 16, 10, 8, null, MAT(R_WOOD, 9)));
  }
  // tubo
  const bz = coast ? 30 : 21;
  const blen = (coast ? 44 : 32);
  const bdir = [1, 0, opts.elev || 0.08];
  const bc = vadd([r + 4 * sc, 0, bz], vscale(vnorm(bdir), blen / 2 - 8));
  s.push(PR_cyl(bc, 4.2 * sc, blen / 2, M3_fromDir(bdir), matBarrel, 4.2 * sc));
  s.push(PR_cyl(vadd(bc, vscale(vnorm(bdir), blen / 2 - 1)), 3.0 * sc, 1.5, M3_fromDir(bdir), matBarrel));
  if (krupp) s.push(PR_box([r - 6, 0, bz + 0.5], 3.2, 3.6, 3.6, null, MAT(R_STEEL, 4, { spec: 1.5 })));
  else s.push(PR_cyl([r - 5 * sc, 0, bz], 5.6 * sc, 5 * sc, M3_fromDir([1, 0, 0]), matBarrel));   // refuerzo tipo Parrott
  s.push(PR_ell([r - 11 * sc, 0, bz], 2.4, 2.4, 2.4, null, matBarrel));
  if (opts.flash) {
    const muz = vadd(bc, vscale(vnorm(bdir), blen / 2 + 2));
    s.push(PR_ell(vadd(muz, [5, 0, 0]), 8, 6, 6, null, M_FLASH));
    s.push(PR_ell(vadd(muz, [12, 0, 1]), 6, 8, 7, null, M_FIRE2));
    s.push(PR_ell(vadd(muz, [18, 3, 4]), 9, 9, 8, null, M_SMOKE));
  }
  if (opts.smoke) {
    const muz = vadd(bc, vscale(vnorm(bdir), blen / 2 + 2));
    for (let k = 0; k < 4; k++) s.push(PR_ell(vadd(muz, [6 + k * 6, (k - 1.5) * 4, 4 + k * 3]), 7 + k, 7 + k, 6 + k, null, k & 1 ? M_SMOKE : M_SMOKED));
  }
  return s;
}

// Pieza con su artillero: frames A..E (vivo) y F..J (muerte del artillero).
function ARTI_Build(kind, style, frame) {
  const flash = frame === 'C', recoil = frame === 'C' ? 3 : frame === 'D' ? 5 : 0;
  const s = CANNON_Build(kind, recoil, { flash: flash, smoke: frame === 'D' });
  let pose;
  const gx = -14, gy = -20;
  if (frame === 'B') pose = { pelvis: [gx, gy, 21], lean: 0.5, footL: [gx + 4, gy + 5, 0], footR: [gx - 6, gy - 3, 0], handL: [gx + 10, gy + 8, 26], handR: [gx + 8, gy + 2, 28], headPitch: -0.3, headYaw: 0.4 };
  else if (frame === 'C' || frame === 'D') pose = { pelvis: [gx - 3, gy - 3, 27], lean: -0.15, footL: [gx, gy + 4, 0], footR: [gx - 7, gy - 5, 0], handL: [gx + 2, gy + 9, 44], handR: [gx - 1, gy - 9, 30], headYaw: 0.3 };
  else if (frame === 'E') pose = { pelvis: [gx - 2, gy, 26], lean: -0.35, footL: [gx, gy + 4, 0], footR: [gx - 4, gy - 4, 0], handL: [gx + 3, gy + 11, 40], handR: [gx + 1, gy - 11, 38], headPitch: -0.5 };
  else pose = { pelvis: [gx, gy, 27.4], lean: 0.05, footL: [gx + 2, gy + 4.5, 0], footR: [gx - 2, gy - 4.5, 0], handL: [gx + 6, gy + 9, 30], handR: [gx + 4, gy - 8, 32], headYaw: 0.25,
    extra: [PR_rod([gx + 4, gy - 8, 32], [gx + 12, gy + 4, 18], 0.3, MAT(R_LINEN, 6))] };
  for (const p of HUM_Build(style, pose)) s.push(p);
  return s;
}

function ARTI_Death(kind, style, t, final) {
  const s = CANNON_Build(kind, 0, {});
  let g = HUM_Fallen(style, t, final);
  g = SC_transform(g, M3_rotZ(1.2), [-16, -22, 0]);
  for (const p of g) s.push(p);
  return s;
}

// --- Dinamitero ------------------------------------------------------------------------------------------------
function DINA_Pose(frame, phase) {
  const style = STYLE.ZAPADOR;
  if (frame === 'E') {
    const grip = [-6, -9, 50];
    return HUM_Build(style, { pelvis: [0, 0, 27.4], lean: -0.1, footL: [6, 4.5, 0], footR: [-5, -4.5, 0],
      handR: grip, handL: [8, 8, 40], weapon: { kind: 'dynamite', grip: grip, dir: [-0.3, -0.2, 1], lit: true }, headPitch: 0.1 });
  }
  if (frame === 'F') {
    return HUM_Build(style, { pelvis: [2, 0, 27], lean: 0.3, footL: [8, 4.5, 0], footR: [-6, -4.5, 1],
      handR: [18, -6, 46], handL: [-2, 9, 34], headPitch: 0.1 });
  }
  return HUM_Build(style, POSE_Walk(phase, style, { weapon: 'none' }));
}

// --- Objetos ----------------------------------------------------------------------------------------------------
const M_PAPER = MAT(R_LINEN, 4);
const M_CRATE = MAT(R_WOOD, 5);
const M_TIN = MAT(R_STEEL, 5, { spec: 1 });

function ITEM_Box(hx, hy, hz, mat, labelMat) {
  const s = [PR_box([0, 0, hz], hx, hy, hz, null, mat)];
  if (labelMat) s.push(PR_box([hx + 0.05, 0, hz], 0.12, hy * 0.6, hz * 0.5, null, labelMat));
  return s;
}

function ITEM_Cartridges(n, x0) {
  const s = [];
  for (let k = 0; k < n; k++) {
    s.push(PR_cyl([x0 || 0, -((n - 1) / 2) * 1.6 + k * 1.6, 4], 0.7, 3, null, M_BRASS));
    s.push(PR_ell([x0 || 0, -((n - 1) / 2) * 1.6 + k * 1.6, 7.4], 0.55, 0.55, 0.9, null, MAT(R_GRAY, 10, { spec: 1 })));
  }
  return s;
}

function ITEM_Flag(frame, pole, big) {
  const s = [];
  const h = big ? 60 : 44;
  s.push(PR_rod([0, 0, 0], [0, 0, h + 4], 0.7, MAT(R_WOOD, 5)));
  s.push(PR_ell([0, 0, h + 4.5], 1.2, 1.2, 1.2, null, M_BRASS));
  // bandera de Chile: franja superior blanca con cantón azul y estrella, franja inferior roja
  const W = big ? 26 : 20, Hh = big ? 17 : 13;
  const cols = 8;
  for (let i = 0; i < cols; i++) {
    const u = i / cols;
    const wave = Math.sin(u * 5 + frame * 2.1) * 2.2 * u;
    const x0 = -0.5, y = -(u * W + W / cols / 2);
    const top = [0, y, h - Hh / 4 + wave * 0.3];
    const bot = [0, y, h - Hh * 3 / 4 + wave * 0.3];
    const cantonCol = u < 0.34;
    s.push(PR_box(vadd(top, [wave, 0, 0]), 0.35, W / cols / 2 + 0.1, Hh / 4, null, cantonCol ? MAT(R_NAVY, 5) : MAT(R_LINEN, 1)));
    s.push(PR_box(vadd(bot, [wave, 0, 0]), 0.35, W / cols / 2 + 0.1, Hh / 4, null, MAT(R_RED, 4)));
    if (i === 1) s.push(PR_ell(vadd(top, [wave + 0.4, 0, 0]), 0.3, 1.4, 1.4, null, MAT(R_LINEN, 0)));
  }
  return s;
}

function ITEM_Build(name, frame) {
  const s = [];
  switch (name) {
    case 'CFUS': return WPN_Place(WPN_Rifle(false), [0, 0, 1.5], [1, 0.2, 0], [0, 0, 1]);
    case 'GATP': {
      for (let k = 0; k < 6; k++) {
        const a = k / 6 * Math.PI * 2;
        s.push(PR_rod([-6, Math.cos(a) * 2.2, 14 + Math.sin(a) * 2.2], [22, Math.cos(a) * 2.2, 14 + Math.sin(a) * 2.2], 0.65, M_STEEL));
      }
      s.push(PR_cyl([-8, 0, 14], 4.5, 5, M3_fromDir([1, 0, 0]), M_BRASS));
      s.push(PR_cyl([18, 0, 14], 3.4, 0.6, M3_fromDir([1, 0, 0]), M_BRASS));
      s.push(PR_box([-8, 0, 21], 3, 1.6, 3.5, null, M_BRASS));
      s.push(PR_rod([-8, -5, 14], [-8, -9, 14], 0.5, M_IRON));
      s.push(PR_rod([-8, -9, 14], [-8, -9, 9], 0.5, M_IRON));
      for (const y of [-8, 8]) s.push(PR_cyl([-6, y, 8], 8, 0.8, M3_fromDir([0, 1, 0]), MAT(R_WOOD, 8)));
      s.push(PR_boxAlong([-6, 0, 10], [-26, 0, 1], 2.5, 1.5, MAT(R_GREEN, 9), [0, 0, 1]));
      return s;
    }
    case 'DINI':
      for (let k = 0; k < 3; k++) for (const p of SC_transform(WPN_Dynamite(false), M3_I(), [0, (k - 1) * 2.3, 1.2 + (k === 1 ? 1.8 : 0)])) s.push(p);
      s.push(PR_cyl([0, 0, 1.8], 3.8, 0.4, M3_fromDir([1, 0, 0]), MAT(R_LINEN, 6)));
      return s;
    case 'CREV': for (const p of ITEM_Box(3, 2.5, 2.2, MAT(R_SAND, 4), MAT(R_RED, 5))) s.push(p); for (const p of SC_transform(ITEM_Cartridges(3), M3_I(), [0, 0, 1])) s.push(p); return s;
    case 'CRVB': for (const p of ITEM_Box(7, 5, 4, M_CRATE, MAT(R_LINEN, 3))) s.push(p); return s;
    case 'CRTF': for (const p of ITEM_Box(3, 4.5, 1.5, M_PAPER, null)) s.push(p); for (const p of SC_transform(ITEM_Cartridges(5), M3_I(), [0, 0, 1.2])) s.push(p); return s;
    case 'CAJF': {
      for (const p of ITEM_Box(9, 6, 5.5, M_CRATE, MAT(R_GRAY, 12))) s.push(p);
      s.push(PR_box([0, 0, 11.2], 9.3, 6.3, 0.5, null, MAT(R_WOOD, 8)));
      return s;
    }
    case 'DMTA': return SC_transform(WPN_Dynamite(false), M3_rotZ(0.4), [0, 0, 1.2]);
    case 'DMTC': {
      for (const p of ITEM_Box(9, 6.5, 5, MAT(R_WOOD, 6), MAT(R_RED, 5))) s.push(p);
      for (let k = 0; k < 4; k++) for (const p of SC_transform(WPN_Dynamite(false), M3_I(), [0, (k - 1.5) * 2.4, 11])) s.push(p);
      return s;
    }
    case 'CARA': {
      s.push(PR_ell([0, 0, 7], 2.2, 6, 6, null, M_TIN));
      s.push(PR_cyl([0, 0, 13.5], 1, 1.2, null, MAT(R_WOOD, 7)));
      s.push(PR_ell([0, 0, 7], 2.5, 6.3, 1.2, M3_rotX(0.2), MAT(R_WOOD, 9)));
      return s;
    }
    case 'BOTI': {
      for (const p of ITEM_Box(8, 6, 4.5, MAT(R_LINEN, 2), null)) s.push(p);
      s.push(PR_box([0, 0, 9.1], 1.4, 4.5, 0.25, null, MAT(R_RED, 4)));
      s.push(PR_box([0, 0, 9.1], 4.5, 1.4, 0.25, null, MAT(R_RED, 4)));
      s.push(PR_box([8.1, 0, 5], 0.2, 1.2, 3, null, MAT(R_RED, 4)));
      s.push(PR_box([8.1, 0, 5], 0.2, 3, 1.2, null, MAT(R_RED, 4)));
      return s;
    }
    case 'CHAR': {
      s.push(PR_ell([0, 0, 0.6], 7, 5, 0.6, null, MAT(R_LINEN, 5)));
      for (let k = 0; k < 4; k++) s.push(PR_ell([(k - 1.5) * 2.2, (k & 1) * 1.5 - 0.7, 2 + (k & 1)], 1.2, 4.5, 0.9, M3_rotZ(0.2 * k), MAT(R_RED, 10, { k: 4 })));
      if (frame === 1) s.push(PR_ell([2, 1, 4], 0.4, 0.4, 0.4, null, MAT(R_LINEN, 0, { glow: true })));
      return s;
    }
    case 'ESCA': {
      s.push(PR_box([0, -3, 1], 2.4, 2, 0.4, null, MAT(R_WOOD, 8)));
      s.push(PR_box([0, 3, 1], 2.4, 2, 0.4, null, MAT(R_WOOD, 8)));
      s.push(PR_ell([0, -3, 1.5], 0.9, 0.9, 0.3, null, frame === 1 ? MAT(R_GOLD, 1, { glow: true }) : M_BRASS));
      s.push(PR_rod([0, -3, 1], [0, 3, 1], 0.2, MAT(R_LINEN, 4)));
      s.push(PR_rod([-2, -3, 1], [-2, 3, 1], 0.2, MAT(R_LINEN, 4)));
      return s;
    }
    case 'ESTA': {
      for (const p of ITEM_Flag(0, true, false)) s.push(p);
      s.push(PR_box([0, -10, 38.5], 0.4, 10.5, 0.6, null, M_BRASS));
      return s;
    }
    case 'BAND': return ITEM_Flag(frame, true, true);
    case 'CHUP': {
      s.push(PR_ell([0, 0, 6], 5, 5, 6, null, MAT(R_ADOBE, 6)));
      s.push(PR_cyl([0, 0, 13], 2, 2, null, MAT(R_ADOBE, 7)));
      s.push(PR_cyl([0, 0, 15.5], 1.4, 0.8, null, MAT(R_WOOD, 6)));
      s.push(PR_ell([3, 0, 14], 1.6, 1.6, 1.6, null, frame ? M_FIRE2 : M_FLASH));
      return s;
    }
    case 'PLAN': {
      s.push(PR_cyl([0, 0, 2.2], 2.2, 9, M3_fromDir([1, 0.3, 0]), MAT(R_LINEN, 5)));
      s.push(PR_cyl([0, 0, 2.2], 2.35, 0.6, M3_fromDir([1, 0.3, 0]), MAT(R_RED, 5)));
      return s;
    }
    case 'MOCH': {
      for (const p of ITEM_Box(5, 8, 7, MAT(R_WOOD, 8), null)) s.push(p);
      s.push(PR_cyl([0, 0, 16], 3, 8.5, M3_fromDir([0, 1, 0]), MAT(R_STEEL, 7)));
      s.push(PR_box([5.2, 0, 9], 0.4, 6, 3, null, MAT(R_WOOD, 10)));
      return s;
    }
    case 'BARR': {
      if (frame === 0) {
        s.push(PR_cyl([0, 0, 18], 10, 18, null, MAT(R_WOOD, 6), 10));
        s.push(PR_ell([0, 0, 18], 11.2, 11.2, 13, null, MAT(R_WOOD, 6)));
        for (const z of [4, 14, 22, 32]) s.push(PR_cyl([0, 0, z], 11.4, 0.9, null, M_IRON));
        s.push(PR_box([10.4, 0, 18], 0.4, 4.5, 3, null, MAT(R_LINEN, 3)));
        return s;
      }
      // explosión del barril
      const k = frame;
      for (let i = 0; i < 6 + k * 2; i++) {
        const a = i * 2.4, r = 6 + k * 5;
        s.push(PR_ell([Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6, 14 + (i % 3) * 7 + k * 3], 5 + k * 2, 5 + k * 2, 5 + k * 1.5, null, k < 3 ? (i & 1 ? M_FLASH : M_FIRE2) : (i & 1 ? M_SMOKE : M_FIRE2)));
      }
      return s;
    }
  }
  return s;
}

// --- Decoración ---------------------------------------------------------------------------------------------------
function DECO_Build(name, frame) {
  const s = [];
  switch (name) {
    case 'TAMA': {
      const bark = MAT(R_WOOD, 9, { k: 6 });
      s.push(PR_limb([0, 0, 0], [2, 1, 34], 4.5, bark, 3.8));
      s.push(PR_limb([2, 1, 30], [16, 6, 58], 2.6, bark));
      s.push(PR_limb([2, 1, 32], [-14, -4, 60], 2.6, bark));
      s.push(PR_limb([2, 1, 34], [3, -12, 66], 2.2, bark));
      const leaf = MAT(R_GREEN, 6, { k: 7, pattern: function (lp) { return (Math.sin(lp[0] * 1.3) * Math.sin(lp[1] * 1.7) > 0.3) ? 2 : 0; } });
      const rng = M_SeededRNG(4040);
      for (let k = 0; k < 11; k++) {
        const a = k / 11 * Math.PI * 2;
        const r = 10 + rng() * 10;
        s.push(PR_ell([Math.cos(a) * r, Math.sin(a) * r, 62 + rng() * 16], 11 + rng() * 5, 11 + rng() * 5, 8 + rng() * 3, null, leaf));
      }
      s.push(PR_ell([0, 0, 76], 16, 16, 10, null, leaf));
      return s;
    }
    case 'POST': {
      s.push(PR_rod([0, 0, 0], [0, 0, 118], 1.8, MAT(R_WOOD, 8)));
      s.push(PR_boxAlong([0, -12, 110], [0, 12, 110], 1.2, 1.2, MAT(R_WOOD, 9), [0, 0, 1]));
      for (const y of [-10, -4, 4, 10]) s.push(PR_ell([0, y, 113], 1, 1, 1.6, null, MAT(R_LINEN, 2, { spec: 1 })));
      return s;
    }
    case 'FARO': {
      s.push(PR_rod([0, 0, 0], [0, 0, 64], 1.3, M_IRON));
      s.push(PR_box([0, 0, 70], 4, 4, 5.5, null, MAT(R_FIRE, 1, { glow: true })));
      s.push(PR_box([0, 0, 76.5], 5, 5, 1, null, M_IRON));
      s.push(PR_box([0, 0, 64], 5, 5, 0.8, null, M_IRON));
      return s;
    }
    case 'FOGA': case 'FUEG': {
      const big = name === 'FUEG';
      const rng = M_SeededRNG(5050 + frame * 7);
      if (!big) for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2; s.push(PR_ell([Math.cos(a) * 9, Math.sin(a) * 9, 1.5], 3, 3, 2, null, MAT(R_STONE, 8))); }
      for (let k = 0; k < (big ? 5 : 3); k++) s.push(PR_rod([-8 + k * 4, -6, 1.5], [6 - k * 3, 7, big ? 6 + k * 3 : 3], 1.5, MAT(R_GRAY, 13)));
      for (let k = 0; k < (big ? 9 : 5); k++) {
        const h = (big ? 34 : 14) * (0.4 + rng() * 0.8);
        s.push(PR_ell([(rng() - 0.5) * (big ? 18 : 8), (rng() - 0.5) * (big ? 18 : 8), h * 0.55 + 2], 2.5 + rng() * 3, 2.5 + rng() * 3, h * 0.5, null, rng() < 0.4 ? M_FLASH : M_FIRE2));
      }
      return s;
    }
    case 'HUMC': {
      for (let k = 0; k < 7; k++) {
        const z = 10 + k * 16 + frame * 4;
        s.push(PR_ell([Math.sin(k + frame) * 5, Math.cos(k * 1.3) * 4, z], 9 + k * 2, 9 + k * 2, 9 + k, null, k & 1 ? M_SMOKE : M_SMOKED));
      }
      return s;
    }
    case 'SACO': {
      const sackMat = MAT(R_SAND, 5, { k: 6 });
      const pos = [[-8, -8, 4], [8, -8, 4], [-8, 8, 4], [8, 8, 4], [0, 0, 12], [-4, 0, 20], [4, 3, 20]];
      for (const p of pos) s.push(PR_ell(p, 9, 6, 4.5, M3_rotZ(p[0] * 0.02), sackMat));
      return s;
    }
    case 'CAJA': {
      s.push(PR_box([0, 0, 8], 10, 10, 8, null, M_CRATE));
      s.push(PR_box([2, 1, 22], 7, 7, 6, M3_rotZ(0.3), MAT(R_WOOD, 6)));
      s.push(PR_box([0, 0, 8], 10.2, 10.2, 1, null, MAT(R_WOOD, 9)));
      return s;
    }
    case 'RUED': {
      const R = M3_mul(M3_rotX(1.25), M3_fromDir([0, 1, 0]));
      s.push(PR_cyl([0, 0, 13], 13, 1.2, R, MAT(R_WOOD, 8)));
      s.push(PR_cyl([0, 0, 13], 3, 2, R, M_IRON));
      return s;
    }
    case 'ANCL': {
      s.push(PR_rod([0, 0, 2], [0, 0, 30], 1.6, M_IRON));
      s.push(PR_rod([-12, 0, 8], [0, 0, 2], 1.4, M_IRON));
      s.push(PR_rod([12, 0, 8], [0, 0, 2], 1.4, M_IRON));
      s.push(PR_rod([-7, 0, 26], [7, 0, 26], 1.1, M_IRON));
      s.push(PR_cyl([0, 0, 33], 3, 0.6, M3_fromDir([0, 1, 0]), M_IRON, 3));
      return s;
    }
    case 'BOTE': {
      const hull = MAT(R_WOOD, 6, { k: 7 });
      s.push(PR_ell([0, 0, 8], 30, 10, 8, null, hull));
      s.push(PR_ell([0, 0, 13], 27, 8, 3, null, MAT(R_WOOD, 11)));
      for (const x of [-12, 0, 12]) s.push(PR_box([x, 0, 12], 1.5, 9, 0.8, null, MAT(R_WOOD, 5)));
      s.push(PR_rod([6, 8, 13], [28, 16, 6], 0.8, MAT(R_WOOD, 5)));
      return s;
    }
    case 'CARR': {
      for (const y of [-14, 14]) {
        s.push(PR_cyl([0, y, 16], 16, 1.3, M3_fromDir([0, 1, 0]), MAT(R_WOOD, 8)));
        s.push(PR_cyl([0, y, 16], 3, 2, M3_fromDir([0, 1, 0]), M_IRON));
      }
      s.push(PR_box([0, 0, 24], 20, 12, 1.5, null, MAT(R_WOOD, 6)));
      s.push(PR_box([0, 12, 30], 20, 0.8, 5, null, MAT(R_WOOD, 7)));
      s.push(PR_box([0, -12, 30], 20, 0.8, 5, null, MAT(R_WOOD, 7)));
      s.push(PR_rod([20, 0, 23], [44, 0, 8], 1.4, MAT(R_WOOD, 7)));
      for (let k = 0; k < 3; k++) s.push(PR_ell([-8 + k * 8, 0, 29], 6, 8, 4, null, MAT(R_SAND, 5)));
      return s;
    }
    case 'PIPA': {
      s.push(PR_cyl([0, 0, 18], 11, 14, M3_fromDir([1, 0, 0]), MAT(R_WOOD, 6), 11));
      for (const x of [-10, 10]) s.push(PR_cyl([x, 0, 18], 11.4, 1, M3_fromDir([1, 0, 0]), M_IRON));
      s.push(PR_box([0, 0, 4], 12, 8, 4, null, MAT(R_WOOD, 9)));
      return s;
    }
    case 'MAST': {
      s.push(PR_rod([0, 0, 0], [0, 0, 158], 1.6, MAT(R_LINEN, 3)));
      s.push(PR_ell([0, 0, 159], 2.2, 2.2, 2.2, null, M_BRASS));
      s.push(PR_rod([0.8, 0.8, 10], [0.8, 0.8, 156], 0.25, MAT(R_LINEN, 6)));
      if (frame > 0) {
        const flag = SC_transform(ITEM_Flag(frame, false, true), M3_I(), [0, 0, 94]);
        for (const p of flag) if (p.t !== 2 && !(p.mat === M_BRASS)) s.push(p);
      }
      return s;
    }
  }
  return s;
}

// --- Efectos ---------------------------------------------------------------------------------------------------------
function FX_Build(name, frame) {
  const s = [];
  const rng = M_SeededRNG(6060 + frame * 31 + name.charCodeAt(0));
  switch (name) {
    case 'BALA':
      s.push(PR_ell([0, 0, 4], 4, 4, 4, null, MAT(R_GRAY, 13, { spec: 1 })));
      if (frame) s.push(PR_ell([-4, 0, 5], 3, 3, 3, null, M_SMOKE));
      return s;
    case 'DINM': {
      const R = M3_rotY(frame * Math.PI / 4);
      return SC_transform(WPN_Dynamite(true), R, [0, 0, 4]);
    }
    case 'EXPL': {
      const n = 10;
      const size = [8, 14, 20, 24, 26][frame];
      for (let i = 0; i < n; i++) {
        const a = rng() * Math.PI * 2, e = rng() * 1.2;
        const d = size * 0.7 * rng();
        const r = size * (0.35 + rng() * 0.35);
        const mat = frame < 2 ? (i % 3 ? M_FLASH : M_FIRE2) : frame < 4 ? (i % 2 ? M_FIRE2 : M_SMOKED) : (i % 2 ? M_SMOKE : M_SMOKED);
        s.push(PR_ell([Math.cos(a) * d, Math.sin(a) * d, size + Math.sin(e) * d], r, r, r, null, mat));
      }
      return s;
    }
    case 'PUFF': {
      const r = 2 + frame * 1.5;
      s.push(PR_ell([0, 0, r], r, r, r, null, frame === 0 ? M_FIRE2 : MAT(R_SAND, 6 + frame, { k: 4 })));
      if (frame < 3) s.push(PR_ell([1, 1, r * 1.5], r * 0.6, r * 0.6, r * 0.6, null, MAT(R_SAND, 5, { k: 4 })));
      return s;
    }
    case 'BLUD':
      for (let i = 0; i < 3 + frame; i++) s.push(PR_ell([rng() * 4 - 2, rng() * 4 - 2, 2 + rng() * 5], 1 + rng(), 1 + rng(), 1 + rng(), null, M_BLOOD));
      return s;
    case 'HUMO': {
      const r = 4 + frame * 3;
      for (let i = 0; i < 3; i++) s.push(PR_ell([rng() * 4, rng() * 4, r + i * 2], r * (0.7 + rng() * 0.4), r, r * 0.8, null, frame > 1 ? M_SMOKE : M_SMOKED));
      return s;
    }
  }
  return s;
}

// --- Armas en primera persona (espacio de cámara: x adelante, y izquierda, z arriba) --------------------------------
const M_SLEEVE = MAT(R_NAVY, 7);
const M_CUFF = MAT(R_RED, 5);
const M_HANDS = MAT(R_SKIN, 4);

// Brazo visto desde el hombro del soldado: manga azul, puño rojo y mano.
function FP_Arm(elbow, handC) {
  const s = [];
  const dir = vnorm(vsub(handC, elbow));
  const wrist = vsub(handC, vscale(dir, 2.0));
  // manga azul con bocamanga y un vivo rojo en el puño
  s.push(PR_limb(elbow, vlerp(elbow, wrist, 0.9), 2.6, M_SLEEVE, 2.8));
  s.push(PR_rod(vlerp(elbow, wrist, 0.885), vlerp(elbow, wrist, 0.9), 2.85, MAT(R_RED, 7)));
  s.push(PR_limb(vlerp(elbow, wrist, 0.9), vsub(wrist, vscale(dir, 0.4)), 2.55, MAT(R_NAVY, 9)));
  s.push(PR_limb(vsub(wrist, vscale(dir, 0.8)), wrist, 1.5, M_HANDS));
  s.push(PR_ell(handC, 1.6, 1.9, 2.1, M3_fromDir(dir), M_HANDS));
  return s;
}

// Las posiciones se planifican en pantalla (320x200, proyección 160): un punto
// (x, y, z) de la cámara cae en sx = 160 - 160·y/x, sy = 100 - 160·z/x.
function FP_Build(name, frame, flashOnly) {
  const s = [];
  switch (name) {
    case 'CORV': {
      // corvo: mango de madera, guarda de bronce y hoja curva de acero
      const poses = [
        { hand: [17, -7.5, -9.5], dir: [0.55, 0.25, 0.8], elbow: [6, -16, -24] },
        { hand: [15, -11, -4], dir: [-0.15, 0.35, 0.92], elbow: [6, -20, -14] },
        { hand: [19, -1, -6], dir: [0.35, 0.93, -0.05], elbow: [8, -12, -22] },
        { hand: [16, 7, -10], dir: [0.4, 0.75, -0.5], elbow: [8, 0, -26] }
      ];
      const p = poses[frame];
      const blade = [];
      blade.push(PR_box([-3, 0, 0], 3.2, 0.8, 0.9, null, MAT(R_WOOD, 8)));
      blade.push(PR_box([0.6, 0, 0], 0.5, 1.3, 1.3, null, M_BRASS));
      let x = 1, z = 0;
      for (let k = 0; k < 4; k++) {
        const a = -0.05 - k * 0.16, len = 3.4;
        const nx = x + Math.cos(a) * len, nz = z + Math.sin(a) * len;
        blade.push(PR_boxAlong([x, 0, z], [nx, 0, nz], 0.15, 0.85 - k * 0.1, M_STEELB, [0, 0, 1]));
        x = nx; z = nz;
      }
      const d = vnorm(p.dir);
      for (const q of WPN_Place(blade, vadd(p.hand, vscale(d, 3)), d, [0, 0, 1])) s.push(q);
      for (const q of FP_Arm(p.elbow, p.hand)) s.push(q);
      return s;
    }
    case 'REVO': case 'RFLA': {
      // revólver Lefaucheux empuñado con la derecha, abajo a la derecha
      const P0 = frame === 1 ? [11, -4.4, -3.6] : frame === 2 ? [11.6, -4.4, -4.1] : [12, -4.4, -4.4];
      const dir = vnorm([1, 0.05, frame === 1 ? 0.24 : frame === 2 ? 0.1 : 0.04]);
      if (flashOnly) {
        const muz = vadd(P0, vscale(dir, 8.6));
        s.push(PR_ell(vadd(muz, vscale(dir, 2.2)), 2.8, 2.2, 2.2, M3_fromDir(dir), M_FLASH));
        s.push(PR_ell(vadd(muz, vscale(dir, 4.6)), 2.0, 2.8, 2.8, M3_fromDir(dir), M_FIRE2));
        s.push(PR_ell(vadd(muz, vadd(vscale(dir, 6), [0, 0, 1.4])), 2.4, 2.4, 2.2, null, M_SMOKE));
        return s;
      }
      for (const q of WPN_Place(WPN_Revolver(), P0, dir, [0, 0, 1])) s.push(q);
      const upv = vnorm(vsub([0, 0, 1], vscale(dir, dir[2])));
      for (const q of FP_Arm([2, -9, -18], vadd(P0, vadd(vscale(dir, -1.9), vscale(upv, -2.7))))) s.push(q);
      return s;
    }
    case 'COMB': case 'CFLA': {
      // fusil Comblain II: cañón hacia el centro, mano izquierda bajo el guardamano
      const A = { P0: [18, -5, -8.5], dir: [1, 0.06, 0.1], roll: 0 };
      const poses = [
        A,
        { P0: [16.8, -5, -7.2], dir: [1, 0.05, 0.2], roll: 0 },
        { P0: [17.5, -5.5, -9.4], dir: [1, 0.1, 0.07], roll: 0.4 },
        { P0: [17.5, -5.5, -9.6], dir: [1, 0.1, 0.06], roll: 0.45 },
        { P0: [17.5, -5.5, -9.6], dir: [1, 0.1, 0.06], roll: 0.45 }
      ];
      if (flashOnly) {
        // el fogonazo acompaña siempre al cuadro A (arma en posición de tiro)
        const d0 = vnorm(A.dir);
        const muz = vadd(A.P0, vscale(d0, 30.5));
        if (frame === 0) {
          s.push(PR_ell(vadd(muz, vscale(d0, 3)), 4, 3, 3, M3_fromDir(d0), M_FLASH));
          s.push(PR_ell(vadd(muz, vscale(d0, 7)), 3, 4, 4, M3_fromDir(d0), M_FIRE2));
        } else {
          s.push(PR_ell(vadd(muz, vscale(d0, 4)), 3, 2.4, 2.4, M3_fromDir(d0), M_FIRE2));
          s.push(PR_ell(vadd(muz, vadd(vscale(d0, 9), [0, 0, 1.5])), 4, 4, 3.5, null, M_SMOKE));
        }
        return s;
      }
      const p = poses[frame];
      const dir = vnorm(p.dir);
      const up = vnorm([0, Math.sin(p.roll), Math.cos(p.roll)]);
      const rifle = WPN_Rifle(false);
      // palanca abierta: el bloque de cierre baja y deja ver la recámara
      if (frame >= 2) {
        rifle.push(PR_box([2.5, 0, -3.8], 2.4, 0.4, 1.8, M3_rotY(-0.5), M_STEEL));
        rifle.push(PR_box([0.2, 0, -1.6], 0.5, 0.4, 2.2, M3_rotY(0.9), M_STEEL));
      }
      for (const q of WPN_Place(rifle, p.P0, dir, up)) s.push(q);
      const B = M3_fromDir(dir);
      const at = function (along, side, h) { return vadd(p.P0, vadd(vscale(dir, along), vadd(vscale(vcross(up, dir), side), vscale(up, h)))); };
      // mano derecha en la garganta de la culata
      for (const q of FP_Arm([6, -14, -20], at(-4.2, 0, -1.4))) s.push(q);
      // mano izquierda: bajo el guardamano, o llevando el cartucho a la recámara
      const leftHand = frame === 4 ? at(1.5, 2.4, 1.2) : at(12, 0.4, -1.9);
      for (const q of FP_Arm([14, 9, -24], leftHand)) s.push(q);
      if (frame === 3) s.push(PR_cyl(at(2, -3.5, 4.5), 0.75, 2.4, M3_fromDir([0.3, -0.6, 1]), M_BRASS));
      if (frame === 4) s.push(PR_cyl(at(3.2, 1.2, 1.6), 0.7, 2.6, M3_fromDir(dir), M_BRASS));
      void B;
      return s;
    }
    case 'GATL': case 'GFLA': {
      // ametralladora Gatling de 6 cañones: caja de bronce, tambor de cañones y manivela
      const axis = vnorm([1, 0.04, 0.1]);
      const c0 = [16, -3.5, -12];
      const rot = frame * Math.PI / 6;
      const R = M3_fromDir(axis);
      const M_BRONZE = MAT(R_GOLD, 7, { spec: 0.9, k: 6 });
      if (flashOnly) {
        const muz = vadd(c0, vscale(axis, 36));
        const a = rot + 1.2;
        const off = M3_mulv(R, [Math.cos(a) * 2.8, Math.sin(a) * 2.8, 0]);
        s.push(PR_ell(vadd(vadd(muz, off), vscale(axis, 2.5)), 3.4, 2.6, 2.6, R, M_FLASH));
        s.push(PR_ell(vadd(vadd(muz, off), vscale(axis, 6)), 2.6, 3.4, 3.4, R, M_FIRE2));
        return s;
      }
      for (let k = 0; k < 6; k++) {
        const a = rot + k / 6 * Math.PI * 2;
        const off = M3_mulv(R, [Math.cos(a) * 2.8, Math.sin(a) * 2.8, 0]);
        s.push(PR_rod(vadd(c0, vadd(off, vscale(axis, 4))), vadd(c0, vadd(off, vscale(axis, 36))), 0.75, M_STEEL));
      }
      s.push(PR_cyl(vadd(c0, vscale(axis, 7)), 1.4, 3, R, M_IRON));
      s.push(PR_cyl(vadd(c0, vscale(axis, 20)), 3.8, 0.6, R, M_BRONZE));
      s.push(PR_cyl(vadd(c0, vscale(axis, 34)), 3.7, 0.5, R, M_BRONZE));
      s.push(PR_cyl(vadd(c0, vscale(axis, 0.5)), 5.0, 3.8, R, M_BRONZE));
      s.push(PR_cyl(vadd(c0, vscale(axis, -3.6)), 4.0, 0.5, R, MAT(R_GOLD, 9, { spec: 0.6 })));
      // guía de alimentación con cartuchos
      s.push(PR_box(vadd(c0, [1.0, -2.6, 5.6]), 1.1, 1.0, 1.8, null, M_IRON));
      for (let k = 0; k < 3; k++) s.push(PR_cyl(vadd(c0, [1.0, -2.6, 7.7 + k * 0.9]), 0.38, 0.9, M3_fromDir([0, 1, 0]), M_BRASS));
      // alza en el lado izquierdo
      s.push(PR_box(vadd(c0, [2, 5.2, 3.6]), 0.5, 0.3, 1.2, null, M_IRON));
      // manivela a la derecha
      const crankA = frame ? 2.0 : 0.7;
      const hub = vadd(c0, [-0.5, -6.2, 0]);
      const handle = vadd(hub, [Math.cos(crankA) * 3.6, -1.1, Math.sin(crankA) * 3.6]);
      s.push(PR_cyl(hub, 1.2, 0.8, M3_fromDir([0, 1, 0]), M_IRON));
      s.push(PR_rod(hub, handle, 0.55, M_IRON));
      s.push(PR_rod(handle, vadd(handle, [0, -2.2, 0]), 0.65, MAT(R_WOOD, 8)));
      for (const q of FP_Arm([5, -16, -22], vadd(handle, [0, -2.8, 0]))) s.push(q);
      return s;
    }
    case 'DINW': {
      const poses = [
        { hand: [16, -8, -9.5], dir: [0.3, 0.15, 1], lit: false, elbow: [5, -16, -24] },
        { hand: [16, -8, -9.2], dir: [0.3, 0.15, 1], lit: true, elbow: [5, -16, -24] },
        { hand: [13, -11.5, -2.5], dir: [-0.4, -0.2, 1], lit: true, elbow: [5, -20, -10] },
        { hand: [22, -4, -3], dir: [1, 0.2, 0.4], lit: true, elbow: [10, -12, -18] },
        { hand: [20, -3, -9], dir: [1, 0, 0], lit: false, empty: true, elbow: [8, -12, -22] }
      ];
      const p = poses[frame];
      if (!p.empty) for (const q of WPN_Place(WPN_Dynamite(p.lit), vadd(p.hand, [0, 0, 0.4]), p.dir, [1, 0, 0])) s.push(q);
      for (const q of FP_Arm(p.elbow, p.hand)) s.push(q);
      return s;
    }
  }
  return s;
}
