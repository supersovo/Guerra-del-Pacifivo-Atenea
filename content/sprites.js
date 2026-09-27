// =============================================================================
// sprites.js — Registro de sprites en el IWAD (S_START..S_END)
// -----------------------------------------------------------------------------
// "Fotografía" cada modelo de models.js con la fundición (foundry.js) y guarda
// los cuadros con la nomenclatura de DOOM: NNNNFR (nombre, cuadro, rotación).
//   * Rotaciones 1..8: la rotación 1 muestra la figura de frente; cada paso
//     gira la cámara 45° en sentido antihorario alrededor de ella.
//   * Rotación 0: la misma imagen desde cualquier ángulo (muertes, objetos).
//   * Armas en primera persona: perspectiva real con la mano del soldado;
//     leftoffset/topoffset se calculan para anclar la imagen al borde
//     inferior de la vista (ver R_DrawPSprite).
// =============================================================================
'use strict';

const SPR_DEATHVIEW = { yaw: Math.PI * 0.64, elev: 0.26 };   // 3/4 lateral para las caídas
const SPR_ITEMVIEW = { yaw: Math.PI - 0.55, elev: 0.5 };      // objetos en el suelo, vistos desde arriba
const SPR_DECOVIEW = { yaw: Math.PI - 0.35, elev: 0.2 };
let SPR_count = 0;
// Densidad de los sprites: texeles por unidad de mapa (2 = el doble de
// resolución que DOOM, para pantallas de 1280x800 o más). Las armas en
// primera persona se rasterizan a 640x400.
const SPR_RES = 2;
const SPR_PRES = 2;

function SPR_Put(name, img) {
  const patch = FND_ToPatch(img);
  patch.density = SPR_RES;
  W_AddLump(name, patch, 'sprite');
  SPR_count++;
}

// Ocho rotaciones de una escena (cuadro vivo de un personaje u objeto).
function SPR_Rot(base, frame, scene, elev) {
  for (let r = 0; r < 8; r++) {
    SPR_Put(base + frame + (r + 1), FND_Render(scene, { yaw: Math.PI - r * Math.PI / 4, elev: elev, res: SPR_RES }));
  }
}

// Cuadro único (rotación 0). center: origen vertical en el medio de la imagen
// (efectos que aparecen en el punto de impacto, no apoyados en el suelo).
function SPR_One(base, frame, scene, view, center) {
  const img = FND_Render(scene, Object.assign({ res: SPR_RES }, view || SPR_DECOVIEW));
  if (center) img.top = Math.round(img.h / 2);
  SPR_Put(base + frame + '0', img);
}

// Arma en primera persona. De cadera se ancla al borde inferior de la vista;
// encarada (ads), la línea de mira (fila 100 de la pantalla de 320x200) se
// ancla al centro. zoom: distancia focal del modelo encarado.
function SPR_PSprite(name, scene, ads, zoom) {
  const res = SPR_PRES;
  const img = FND_RenderPersp(scene, { outline: true, res: res, zoom: zoom || 1 });
  const patch = V_MakePatch(img.w, img.h, img.px, res - img.screenX, (ads ? 100 : 200) * res - img.screenY);
  patch.density = res;
  W_AddLump(name, patch, 'sprite');
  SPR_count++;
}

// --- Infantería (plantilla ST_Infantry: A-D marcha, E-F tiro, G dolor,
//     H-L muerte, M-Q destrozado) ------------------------------------------------------------
function SPR_Infantry(base, style) {
  for (let f = 0; f < 4; f++) SPR_Rot(base, 'ABCD'[f], HUM_Build(style, POSE_Walk(f / 4, style)));
  SPR_Rot(base, 'E', HUM_Build(style, POSE_Aim(style, false)));
  SPR_Rot(base, 'F', HUM_Build(style, POSE_Aim(style, true)));
  SPR_Rot(base, 'G', HUM_Build(style, POSE_Pain(style)));
  SPR_Deaths(base, style, 'HIJKL', 'MNOPQ');
}

function SPR_Deaths(base, style, deathLetters, gibLetters) {
  const n = deathLetters.length;
  for (let k = 0; k < n - 1; k++) {
    const t = 0.18 + 0.72 * k / Math.max(1, n - 2);
    SPR_One(base, deathLetters[k], HUM_Fallen(style, t, false), SPR_DEATHVIEW);
  }
  SPR_One(base, deathLetters[n - 1], HUM_Fallen(style, 1, true), SPR_DEATHVIEW);
  if (gibLetters) {
    for (let k = 0; k < gibLetters.length; k++) {
      SPR_One(base, gibLetters[k], HUM_Gibs(style, Math.min(3, k)), SPR_DEATHVIEW);
    }
  }
}

// --- Infante peruano con bayoneta calada ----------------------------------------------------
function POSE_Bayonet(stage) {
  const pose = { pelvis: [0, 0, 26.5], lean: 0.12, footL: [6, 4.6, 0], footR: [-6, -4.4, 0], headPitch: -0.05 };
  let grip, dir;
  if (stage === 0) { grip = [-3, -6, 34]; dir = [1, 0.06, 0.16]; }
  else if (stage === 1) { grip = [-1, -6.5, 33]; dir = [1, 0.05, 0.1]; pose.lean = 0.18; }
  else {
    pose.pelvis = [5, 0, 25]; pose.lean = 0.38;
    pose.footL = [16, 4.6, 0]; pose.footR = [-9, -4.4, 1.5];
    grip = [15, -5, 35]; dir = [1, 0.04, 0.02];
  }
  pose.weapon = { kind: 'bayonet', grip: grip, dir: dir, up: [0, 0, 1] };
  pose.handR = grip;
  pose.handL = vadd(grip, vscale(vnorm(dir), 14));
  pose.poleL = [6, 14, 22]; pose.poleR = [-10, -14, 24];
  return pose;
}

function SPR_Bayoneta() {
  const style = STYLE.PERU_LINEA;
  for (let f = 0; f < 4; f++) {
    SPR_Rot('BAYO', 'ABCD'[f], HUM_Build(style, POSE_Walk(f / 4, style, { charge: true, stride: 9, lean: 0.18, weapon: 'bayonet' })));
  }
  for (let k = 0; k < 3; k++) SPR_Rot('BAYO', 'EFG'[k], HUM_Build(style, POSE_Bayonet(k)));
  SPR_Rot('BAYO', 'H', HUM_Build(style, POSE_Pain(style)));
  SPR_Deaths('BAYO', style, 'IJKLM', 'NOPQR');
}

// --- Oficial: revólver y sable ---------------------------------------------------------------
function SPR_Oficial() {
  const style = STYLE.OFICIAL;
  for (let f = 0; f < 4; f++) SPR_Rot('OFIC', 'ABCD'[f], HUM_Build(style, POSE_Walk(f / 4, style)));
  SPR_Rot('OFIC', 'E', HUM_Build(style, POSE_Aim(style, false, 'revolver')));
  SPR_Rot('OFIC', 'F', HUM_Build(style, POSE_Aim(style, true, 'revolver')));
  // G: sable en alto; H: tajo descendente
  const g = { pelvis: [0, 0, 27.4], lean: -0.05, footL: [5, 4.8, 0], footR: [-4, -4.4, 0], headPitch: 0.05,
    handL: [4, 9.5, 31] };
  g.handR = [0, -9, 52];
  g.weapon = { kind: 'saber', grip: g.handR, dir: [-0.35, -0.1, 1] };
  SPR_Rot('OFIC', 'G', HUM_Build(style, g));
  const h = { pelvis: [3, 0, 26], lean: 0.3, footL: [11, 4.8, 0], footR: [-6, -4.4, 0], headPitch: 0.1,
    handL: [2, 10, 30] };
  h.handR = [17, -5, 34];
  h.weapon = { kind: 'saber', grip: h.handR, dir: [1, 0.15, -0.45] };
  SPR_Rot('OFIC', 'H', HUM_Build(style, h));
  SPR_Rot('OFIC', 'I', HUM_Build(style, POSE_Pain(style)));
  SPR_Deaths('OFIC', style, 'JKLMNO', null);
}

// --- Zapador dinamitero ----------------------------------------------------------------------
function SPR_Dinamitero() {
  const style = STYLE.ZAPADOR;
  for (let f = 0; f < 4; f++) SPR_Rot('DINA', 'ABCD'[f], DINA_Pose('A', f / 4));
  SPR_Rot('DINA', 'E', DINA_Pose('E', 0));
  SPR_Rot('DINA', 'F', DINA_Pose('F', 0));
  SPR_Rot('DINA', 'G', HUM_Build(style, POSE_Pain(style)));
  SPR_Deaths('DINA', style, 'HIJKL', 'MNOPQ');
}

// --- Húsar a caballo -------------------------------------------------------------------------
function SPR_Husar() {
  for (let f = 0; f < 4; f++) SPR_Rot('HUSA', 'ABCD'[f], HUSAR_Build(f / 4, 'A'));
  SPR_Rot('HUSA', 'E', HUSAR_Build(0.1, 'E'));
  SPR_Rot('HUSA', 'F', HUSAR_Build(0.2, 'F'));
  SPR_Rot('HUSA', 'G', HUSAR_Build(0.3, 'G'));
  SPR_Rot('HUSA', 'H', HUSAR_Build(0.1, 'H'));
  const view = { yaw: Math.PI + Math.PI / 3, elev: 0.24 };
  const ts = [0.12, 0.3, 0.5, 0.7, 0.88];
  for (let k = 0; k < 5; k++) SPR_One('HUSA', 'IJKLM'[k], HUSAR_Death(ts[k], false), view);
  SPR_One('HUSA', 'N', HUSAR_Death(1, true), view);
}

// --- Piezas de artillería con su dotación (A-E vivos, F-J muerte del artillero) ----------
function SPR_Artilleria(base, kind, style) {
  for (const f of 'ABCDE') SPR_Rot(base, f, ARTI_Build(kind, style, f), 0.22);
  const ts = [0.2, 0.45, 0.7, 0.9];
  for (let k = 0; k < 4; k++) SPR_Rot(base, 'FGHI'[k], ARTI_Death(kind, style, ts[k], false), 0.22);
  SPR_Rot(base, 'J', ARTI_Death(kind, style, 1, true), 0.22);
}

// --- Proyectiles, efectos y barril -------------------------------------------------------------
function SPR_Effects() {
  const fxView = { yaw: Math.PI - 0.3, elev: 0.15 };
  for (let f = 0; f < 2; f++) SPR_One('BALA', 'AB'[f], FX_Build('BALA', f), fxView, true);
  for (let f = 0; f < 5; f++) SPR_One('EXPL', 'ABCDE'[f], FX_Build('EXPL', f), fxView, true);
  for (let f = 0; f < 4; f++) SPR_One('DINM', 'ABCD'[f], FX_Build('DINM', f), fxView, true);
  for (let f = 0; f < 4; f++) SPR_One('PUFF', 'ABCD'[f], FX_Build('PUFF', f), fxView, true);
  for (let f = 0; f < 3; f++) SPR_One('BLUD', 'ABC'[f], FX_Build('BLUD', f), fxView, true);
  for (let f = 0; f < 4; f++) SPR_One('HUMO', 'ABCD'[f], FX_Build('HUMO', f), fxView, true);
  for (let f = 0; f < 6; f++) SPR_One('BARR', 'ABCDEF'[f], ITEM_Build('BARR', f), SPR_DECOVIEW);
}

// --- Objetos recogibles ---------------------------------------------------------------------------
// [nombre, cuadros, escala, vista]: los objetos pequeños se agrandan un poco
// (como en DOOM) para que se distingan en el suelo.
function SPR_Items() {
  const side = { yaw: Math.PI / 2 + 0.4, elev: 0.45 };
  const flagView = { yaw: Math.PI - 0.3, elev: 0.15 };
  const table = [
    ['CFUS', 'A', 1.25, side], ['GATP', 'A', 1.1, side], ['DINI', 'A', 1.6, SPR_ITEMVIEW],
    ['CREV', 'A', 1.7, SPR_ITEMVIEW], ['CRVB', 'A', 1.4, SPR_ITEMVIEW], ['CRTF', 'A', 1.6, SPR_ITEMVIEW],
    ['CAJF', 'A', 1.3, SPR_ITEMVIEW], ['DMTA', 'A', 1.7, side], ['DMTC', 'A', 1.3, SPR_ITEMVIEW],
    ['CARA', 'A', 1.5, SPR_ITEMVIEW], ['BOTI', 'A', 1.4, SPR_ITEMVIEW], ['PLAN', 'A', 1.6, side],
    ['MOCH', 'A', 1.3, SPR_ITEMVIEW], ['CHAR', 'AB', 1.6, SPR_ITEMVIEW], ['ESCA', 'AB', 1.9, SPR_ITEMVIEW],
    ['CHUP', 'AB', 1.5, SPR_ITEMVIEW], ['ESTA', 'A', 1, flagView], ['BAND', 'ABC', 1, flagView]
  ];
  for (const it of table) {
    for (let f = 0; f < it[1].length; f++) SPR_One(it[0], it[1][f], SC_Scale(ITEM_Build(it[0], f), it[2]), it[3]);
  }
}

// --- Decoración del campo de batalla --------------------------------------------------------------
function SPR_Decorations() {
  SPR_Rot('CANK', 'A', CANNON_Build('krupp', 0, {}), 0.22);
  SPR_Rot('CANL', 'A', CANNON_Build('liso', 0, {}), 0.22);
  SPR_Rot('CANR', 'A', CANNON_Build('coast', 0, { elev: 0.12 }), 0.22);
  SPR_Rot('BOTE', 'A', DECO_Build('BOTE', 0), 0.3);
  SPR_Rot('CARR', 'A', DECO_Build('CARR', 0), 0.22);
  SPR_Rot('PIPA', 'A', DECO_Build('PIPA', 0), 0.22);
  for (const n of ['TAMA', 'POST', 'FARO', 'SACO', 'CAJA', 'RUED', 'ANCL']) SPR_One(n, 'A', DECO_Build(n, 0), SPR_DECOVIEW);
  for (let f = 0; f < 3; f++) SPR_One('FOGA', 'ABC'[f], DECO_Build('FOGA', f), SPR_DECOVIEW);
  for (let f = 0; f < 3; f++) SPR_One('FUEG', 'ABC'[f], DECO_Build('FUEG', f), SPR_DECOVIEW);
  for (let f = 0; f < 4; f++) SPR_One('HUMC', 'ABCD'[f], DECO_Build('HUMC', f), SPR_DECOVIEW);
  const mastView = { yaw: Math.PI - 0.3, elev: 0.12 };
  for (let f = 0; f < 4; f++) SPR_One('MAST', 'ABCD'[f], DECO_Build('MAST', f), mastView);
}

// --- Armas en primera persona -------------------------------------------------------------------------
function SPR_Weapons() {
  for (let f = 0; f < 4; f++) SPR_PSprite('CORV' + 'ABCD'[f] + '0', FP_Build('CORV', f));
  for (let f = 0; f < 3; f++) SPR_PSprite('REVO' + 'ABC'[f] + '0', FP_Build('REVO', f));
  SPR_PSprite('RFLAA0', FP_Build('RFLA', 1, true));
  for (let f = 0; f < 5; f++) SPR_PSprite('COMB' + 'ABCDE'[f] + '0', FP_Build('COMB', f));
  for (let f = 0; f < 2; f++) SPR_PSprite('CFLA' + 'AB'[f] + '0', FP_Build('CFLA', f, true));
  for (let f = 0; f < 2; f++) SPR_PSprite('GATL' + 'AB'[f] + '0', FP_Build('GATL', f));
  for (let f = 0; f < 2; f++) SPR_PSprite('GFLA' + 'AB'[f] + '0', FP_Build('GFLA', f, true));
  for (let f = 0; f < 5; f++) SPR_PSprite('DINW' + 'ABCDE'[f] + '0', FP_Build('DINW', f));
  // Encaradas, por las miras (clic derecho): alza y guion en el centro.
  SPR_PSprite('COMZA0', FP_Build('COMZ', 0), true, 1.1);
  for (let f = 0; f < 2; f++) SPR_PSprite('CFLZ' + 'AB'[f] + '0', FP_Build('CFLZ', f, true), true, 1.1);
  for (let f = 0; f < 3; f++) SPR_PSprite('REVZ' + 'ABC'[f] + '0', FP_Build('REVZ', f), true, 1.2);
  SPR_PSprite('RFLZA0', FP_Build('RFLZ', 1, true), true, 1.2);
  for (let f = 0; f < 2; f++) SPR_PSprite('GATZ' + 'AB'[f] + '0', FP_Build('GATZ', f), true, 1.1);
  for (let f = 0; f < 2; f++) SPR_PSprite('GFLZ' + 'AB'[f] + '0', FP_Build('GFLZ', f, true), true, 1.1);
}

// Construye todos los sprites. progressCb(msg) informa el avance en la consola de arranque.
async function SPR_BuildSprites(progressCb) {
  const say = progressCb || function () {};
  const t0 = (typeof performance !== 'undefined') ? performance.now() : Date.now();
  SPR_count = 0;
  W_AddMarker('S_START');
  const groups = [
    ['CHIL', 'infantería chilena (levita azul, pantalón rojo, Comblain)', function () { SPR_Infantry('CHIL', STYLE.CHILE); }],
    ['GUAR', 'Guardia Nacional peruana (dril blanco, Peabody)', function () { SPR_Infantry('GUAR', STYLE.GUARDIA); }],
    ['BOLI', 'infantería boliviana (bayeta gris, Remington)', function () { SPR_Infantry('BOLI', STYLE.BOLIVIA); }],
    ['BAYO', 'infantería de línea peruana a la bayoneta', SPR_Bayoneta],
    ['OFIC', 'oficialidad aliada (revólver y sable)', SPR_Oficial],
    ['DINA', 'zapadores dinamiteros', SPR_Dinamitero],
    ['HUSA', 'húsares de caballería', SPR_Husar],
    ['ARTI', 'artillería aliada con su dotación', function () { SPR_Artilleria('ARTI', 'liso', STYLE.ARTILLERO_PE); }],
    ['ARTC', 'batería Krupp chilena', function () { SPR_Artilleria('ARTC', 'krupp', STYLE.ARTILLERO_CL); }],
    ['FX', 'proyectiles, explosiones y humo', SPR_Effects],
    ['ITEM', 'pertrechos, víveres y estandartes', SPR_Items],
    ['DECO', 'cañones, tamarugos, postes, lanchas y carretas', SPR_Decorations],
    ['PSPR', 'armas en primera persona', SPR_Weapons]
  ];
  for (const g of groups) {
    const before = SPR_count;
    g[2]();
    say(g[0] + ': ' + g[1] + ' (' + (SPR_count - before) + ' cuadros)');
    await M_NextFrame();
  }
  W_AddMarker('S_END');
  const dt = Math.round(((typeof performance !== 'undefined') ? performance.now() : Date.now()) - t0);
  say(SPR_count + ' cuadros de sprite en ' + dt + ' ms');
}
