// =============================================================================
// sky.js — Cielos panorámicos (360 grados, 2048 columnas x 400 filas)
// -----------------------------------------------------------------------------
// La columna c corresponde al rumbo c/2048*360 grados (0 = este, 90 = norte,
// 180 = oeste, 270 = sur), de modo que el Pacífico queda siempre al poniente y
// la cordillera de los Andes al oriente, como en la costa de Tarapacá y Arica.
// Se diseñan en "filas lógicas" de 0 a 200 (horizonte en la 150) y se
// rasterizan con SKY_R texeles por fila (doble resolución para pantallas
// grandes); el renderizador lee la densidad en textures[...].density.
//   CIELO1 — Pisagua, mañana del 2 de noviembre de 1879: humo del bombardeo.
//   CIELO2 — Dolores, tarde del 19 de noviembre de 1879: polvo y Andes.
//   CIELO3 — Arica, amanecer del 7 de junio de 1880: alba sobre el Morro.
//   CIELO4 — Tacna, mañana del 26 de mayo de 1880: meseta del Intiorko, los
//            Andes con el Tacora nevado y el verde del valle al sur.
//   CIELO5 — Chorrillos, alba del 13 de enero de 1881: bruma de la costa de
//            Lima, el Morro Solar al suroeste y el humo del pueblo.
//   CIELO6 — Miraflores, tarde del 15 de enero de 1881: sol bajo sobre el
//            Pacífico, humo de la escuadra y las torres de Lima al norte.
// =============================================================================
'use strict';

const SKY_R = 2;
const SKY_W = 1024 * SKY_R, SKY_H = 200 * SKY_R, SKY_HORIZON = 150 * SKY_R;
const SKY_LH = 200, SKY_LHORIZON = 150;          // en filas lógicas

function sky_angDist(a, b) {
  let d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

// Perfil de cerros periódico en el ángulo.
function sky_ridge(seed, deg, cells, oct) {
  let v = 0, amp = 1, tot = 0;
  for (let o = 0; o < oct; o++) {
    const c = cells << o;
    v += amp * tx_vnoise(seed + o * 77, deg / 360 * c, 0.5, c, 1);
    tot += amp; amp *= 0.5;
  }
  return v / tot;
}

function sky_gradient(t, stops) {
  // stops: [[fila lógica, [r,g,b]], ...] ordenados por fila
  for (let y = 0; y < SKY_H; y++) {
    const ly = (y + 0.5) / SKY_R;
    let c = stops[stops.length - 1][1];
    for (let k = 0; k < stops.length - 1; k++) {
      const a = stops[k], b = stops[k + 1];
      if (ly >= a[0] && ly <= b[0]) { c = tx_mix(a[1], b[1], (ly - a[0]) / Math.max(1, b[0] - a[0])); break; }
      if (ly < stops[0][0]) { c = stops[0][1]; break; }
    }
    for (let x = 0; x < SKY_W; x++) tx_put(t, x, y, c);
  }
}

// Nubes entre dos filas lógicas; la cuarta octava de ruido da el detalle fino
// que aprovecha la doble resolución.
function sky_clouds(t, seed, rowTop, rowBot, density, light, shade, sunDeg, sunCol) {
  for (let y = rowTop * SKY_R; y < rowBot * SKY_R; y++) {
    const ly = (y + 0.5) / SKY_R;
    const fy = (ly - rowTop) / (rowBot - rowTop);
    for (let x = 0; x < SKY_W; x++) {
      const n = tx_vnoise(seed, x / SKY_W * 24, ly / 14, 24, 64) * 0.52 +
                tx_vnoise(seed + 1, x / SKY_W * 64, ly / 6, 64, 64) * 0.28 +
                tx_vnoise(seed + 2, x / SKY_W * 128, ly / 3, 128, 128) * 0.13 +
                tx_vnoise(seed + 3, x / SKY_W * 320, ly / 1.3, 320, 256) * 0.07;
      const edge = Math.sin(fy * Math.PI);
      const v = n * edge - (1 - density);
      if (v > 0) {
        const deg = x / SKY_W * 360;
        let c = tx_mix(light, shade, clamp(fy * 0.9 + (0.5 - n) * 0.6, 0, 1));
        if (sunCol) {
          const s = Math.max(0, 1 - sky_angDist(deg, sunDeg) / 70);
          c = tx_mix(c, sunCol, s * 0.6);
        }
        tx_blend(t, x, y, c, clamp(v * 4, 0, 1));
      }
    }
  }
}

function sky_mountains(t, seed, fromDeg, toDeg, baseH, varH, col, snowCol, hazeCol, fade) {
  for (let x = 0; x < SKY_W; x++) {
    const deg = x / SKY_W * 360;
    // ventana suave alrededor del rango [fromDeg, toDeg]
    let inRange;
    const span = (toDeg - fromDeg + 360) % 360;
    const rel = (deg - fromDeg + 360) % 360;
    if (rel <= span) inRange = Math.min(rel, span - rel) / (fade || 25);
    else inRange = 0;
    inRange = clamp(inRange, 0, 1);
    if (inRange <= 0) continue;
    const r = sky_ridge(seed, deg, 18, 5);
    const peak = Math.pow(sky_ridge(seed + 5, deg, 7, 3), 3);
    const hgt = (baseH + r * varH + peak * varH * 1.2) * inRange;
    const top = SKY_LHORIZON - hgt;
    for (let y = Math.floor(top * SKY_R); y < SKY_HORIZON + 2 * SKY_R; y++) {
      const ly = (y + 0.5) / SKY_R;
      const depth = (ly - top) / Math.max(1, hgt);
      let c = tx_mix(col, hazeCol, clamp(1 - depth * 0.6, 0, 1) * 0.35 + (ly > SKY_LHORIZON - 4 ? 0.3 : 0));
      if (snowCol && depth < 0.18 && hgt > baseH + varH * 0.55) c = tx_mix(snowCol, c, depth / 0.18);
      // sombreado por pendiente
      const slope = sky_ridge(seed, deg + 0.6, 18, 5) - r;
      c = tx_scale(c, 1 + clamp(slope * 8, -0.15, 0.15));
      tx_put(t, x, y, c);
    }
  }
}

function sky_belowHorizon(t, fnColorAt) {
  for (let x = 0; x < SKY_W; x++) {
    const deg = x / SKY_W * 360;
    for (let y = SKY_HORIZON; y < SKY_H; y++) tx_put(t, x, y, fnColorAt(deg, (y - SKY_HORIZON) / (SKY_H - SKY_HORIZON), x, y));
  }
}

// Columna de humo; width y heightRows en unidades lógicas (columnas de 1024 y filas de 200).
function sky_smoke(t, seed, deg, width, heightRows, drift) {
  const cx = deg / 360 * SKY_W;
  for (let y = (SKY_LHORIZON - heightRows) * SKY_R; y < SKY_HORIZON + SKY_R; y++) {
    const ly = (y + 0.5) / SKY_R;
    const up = clamp((SKY_LHORIZON - ly) / heightRows, 0, 1);   // 0 abajo, 1 arriba
    const w = width * SKY_R * (0.35 + up * 1.4);
    const off = drift * up * up * 40 * SKY_R;
    for (let dx = -w * 1.6; dx <= w * 1.6; dx++) {
      const x = Math.floor(cx + off + dx);
      const n = tx_vnoise(seed, (x + SKY_W) / SKY_W * 64, ly / 7, 64, 64) * 0.8 +
                tx_vnoise(seed + 9, (x + SKY_W) / SKY_W * 192, ly / 2.5, 192, 128) * 0.2;
      const d = Math.abs(dx) / w;
      const a = clamp((1 - d) * 1.3 + (n - 0.5) * 1.2, 0, 1) * (1 - up * 0.55);
      if (a > 0.05) {
        const c = tx_mix([70, 66, 64], [150, 146, 140], clamp(n * 1.2 - 0.2 + up * 0.3, 0, 1));
        tx_blend(t, x, y, c, a * 0.9);
      }
    }
  }
}

// Siluetas de un pueblo o ciudad en el horizonte (casas bajas y torres de
// iglesia) entre dos rumbos; towers: [[rumbo, alto en filas lógicas], ...].
function sky_skyline(t, seed, fromDeg, toDeg, col, towers) {
  for (let x = 0; x < SKY_W; x++) {
    const deg = x / SKY_W * 360;
    if (sky_angDist(deg, (fromDeg + toDeg) / 2) > Math.abs(toDeg - fromDeg) / 2) continue;
    const cell = Math.floor(deg * 3);
    let h = 2 + Math.floor(tx_hash(seed, cell, 0) * 3.5);
    for (const tw of towers || []) {
      const d = sky_angDist(deg, tw[0]);
      if (d < 0.35) h = Math.max(h, tw[1]);
      else if (d < 0.6) h = Math.max(h, tw[1] * 0.6);
      else if (d < 0.9) h = Math.max(h, tw[1] * 0.35);
    }
    for (let y = Math.floor((SKY_LHORIZON - h) * SKY_R); y < SKY_HORIZON + SKY_R; y++) tx_put(t, x, y, col);
  }
}

// Registra el cielo como textura con su densidad (texeles por fila lógica).
function sky_register(name, t) {
  tx_register(name, t, 9, true);
  W_CacheLumpName(name).density = SKY_R;
}

function SKY_BuildSkies() {
  // ---------------- CIELO1: Pisagua ----------------
  {
    const t = tx_new(SKY_W, SKY_H);
    sky_gradient(t, [[0, [58, 104, 176]], [70, [92, 140, 206]], [130, [176, 200, 222]], [150, [214, 222, 226]]]);
    sky_clouds(t, 3101, 70, 128, 0.52, [246, 246, 244], [170, 178, 190]);
    // Cordillera de la Costa al este (tras el acantilado) y cerros lejanos al norte y sur
    sky_mountains(t, 3102, 300, 80, 6, 22, [150, 126, 104], null, [206, 206, 204], 30);
    // Humo del bombardeo: fuerte sur, fuerte norte y el pueblo
    sky_smoke(t, 3103, 262, 7, 70, 1);
    sky_smoke(t, 3104, 110, 6, 58, 1);
    sky_smoke(t, 3105, 30, 9, 84, 1.3);
    sky_smoke(t, 3106, 150, 5, 50, 0.8);
    sky_belowHorizon(t, function (deg, f) {
      const sea = sky_angDist(deg, 180) < 100;
      if (sea) return tx_mix([150, 176, 188], [44, 92, 116], clamp(f * 3, 0, 1));
      return tx_mix([188, 176, 160], [140, 118, 94], clamp(f * 2, 0, 1));
    });
    sky_register('CIELO1', t);
  }
  // ---------------- CIELO2: Dolores ----------------
  {
    const t = tx_new(SKY_W, SKY_H);
    sky_gradient(t, [[0, [84, 124, 184]], [70, [116, 156, 206]], [128, [196, 206, 214]], [150, [236, 226, 206]]]);
    // resplandor del sol de la tarde al poniente
    for (let y = 60 * SKY_R; y < SKY_HORIZON; y++) for (let x = 0; x < SKY_W; x++) {
      const deg = x / SKY_W * 360;
      const s = Math.max(0, 1 - sky_angDist(deg, 200) / 60) * clamp((y / SKY_R - 60) / 90, 0, 1);
      if (s > 0) tx_blend(t, x, y, [255, 236, 190], s * 0.55);
    }
    sky_clouds(t, 3201, 84, 120, 0.36, [250, 244, 232], [196, 190, 188], 200, [255, 226, 170]);
    // Los Andes al este con volcanes nevados
    sky_mountains(t, 3202, 20, 160, 10, 26, [118, 112, 150], [240, 242, 248], [196, 196, 210], 22);
    // Cordillera de la Costa al oeste
    sky_mountains(t, 3203, 150, 240, 4, 10, [168, 138, 108], null, [224, 214, 196], 26);
    // Polvo y humo de la batalla sobre el cerro San Francisco
    sky_smoke(t, 3204, 280, 10, 44, -0.6);
    sky_smoke(t, 3205, 240, 8, 36, -0.4);
    sky_belowHorizon(t, function (deg, f) {
      return tx_mix([226, 214, 186], [176, 150, 112], clamp(f * 2, 0, 1));
    });
    sky_register('CIELO2', t);
  }
  // ---------------- CIELO3: Arica al alba ----------------
  {
    const t = tx_new(SKY_W, SKY_H);
    sky_gradient(t, [[0, [16, 18, 48]], [60, [34, 36, 82]], [110, [96, 74, 128]], [140, [150, 104, 130]], [150, [176, 128, 128]]]);
    // resplandor del alba al este-noreste
    for (let y = 40 * SKY_R; y < SKY_HORIZON; y++) for (let x = 0; x < SKY_W; x++) {
      const deg = x / SKY_W * 360;
      const d = sky_angDist(deg, 40);
      const s = Math.max(0, 1 - d / 110) * Math.pow(clamp((y / SKY_R - 40) / 110, 0, 1), 1.4);
      if (s > 0) tx_blend(t, x, y, tx_mix([255, 150, 90], [255, 220, 150], clamp(1 - d / 40, 0, 1)), s * 0.9);
      // lado del mar más oscuro
      const w = Math.max(0, 1 - sky_angDist(deg, 200) / 100) * 0.35;
      if (w > 0) tx_blend(t, x, y, [26, 30, 70], w);
    }
    // estrellas que se apagan al poniente
    const rng = M_SeededRNG(3301);
    for (let i = 0; i < 520; i++) {
      const x = Math.floor(rng() * SKY_W), y = Math.floor(rng() * 110 * SKY_R);
      const deg = x / SKY_W * 360;
      const fade = clamp(sky_angDist(deg, 40) / 180, 0, 1) * clamp(1 - y / SKY_R / 120, 0, 1);
      if (fade > 0.3) tx_blend(t, x, y, [255, 250, 230], fade * (0.5 + rng() * 0.5));
    }
    // camanchaca iluminada desde abajo
    sky_clouds(t, 3302, 96, 138, 0.42, [255, 176, 150], [92, 70, 110], 40, [255, 200, 140]);
    // Andes a contraluz
    sky_mountains(t, 3303, 350, 120, 8, 24, [58, 44, 70], null, [150, 96, 110], 26);
    sky_belowHorizon(t, function (deg, f) {
      const sea = sky_angDist(deg, 200) < 110;
      if (sea) return tx_mix([70, 70, 108], [16, 22, 44], clamp(f * 2.5, 0, 1));
      return tx_mix([96, 70, 80], [40, 30, 36], clamp(f * 2, 0, 1));
    });
    sky_register('CIELO3', t);
  }
  // ---------------- CIELO4: Tacna, mañana en el Intiorko ----------------
  {
    const t = tx_new(SKY_W, SKY_H);
    sky_gradient(t, [[0, [70, 118, 190]], [70, [104, 152, 214]], [128, [182, 204, 226]], [150, [226, 224, 214]]]);
    // sol de la mañana al noreste
    for (let y = 40 * SKY_R; y < SKY_HORIZON; y++) for (let x = 0; x < SKY_W; x++) {
      const deg = x / SKY_W * 360;
      const s = Math.max(0, 1 - sky_angDist(deg, 55) / 70) * clamp((y / SKY_R - 40) / 110, 0, 1);
      if (s > 0) tx_blend(t, x, y, [255, 240, 204], s * 0.5);
    }
    sky_clouds(t, 3401, 60, 100, 0.26, [252, 250, 246], [200, 204, 214], 55, [255, 236, 200]);
    // Los Andes con el volcán Tacora nevado al noreste
    sky_mountains(t, 3402, 350, 140, 12, 30, [124, 110, 132], [244, 246, 252], [200, 198, 212], 24);
    // Cerros de la costa al poniente, bajos y ocres
    sky_mountains(t, 3403, 170, 250, 3, 8, [178, 146, 112], null, [228, 216, 196], 26);
    // Polvo y humo de la batalla sobre la meseta (este) y el llano
    sky_smoke(t, 3404, 8, 9, 50, -0.5);
    sky_smoke(t, 3405, 340, 7, 40, -0.4);
    sky_smoke(t, 3406, 30, 6, 34, -0.3);
    sky_belowHorizon(t, function (deg, f) {
      // el verde del valle de Tacna, al sur
      const valley = Math.max(0, 1 - sky_angDist(deg, 285) / 40);
      const base = tx_mix([220, 200, 160], [168, 138, 100], clamp(f * 2, 0, 1));
      return tx_mix(base, tx_mix([150, 170, 96], [96, 118, 60], clamp(f * 3, 0, 1)), valley * clamp(1 - f * 4, 0, 1) * 0.8);
    });
    sky_register('CIELO4', t);
  }
  // ---------------- CIELO5: Chorrillos al alba ----------------
  {
    const t = tx_new(SKY_W, SKY_H);
    sky_gradient(t, [[0, [44, 56, 96]], [60, [86, 96, 136]], [112, [168, 150, 162]], [140, [214, 184, 170]], [150, [226, 206, 190]]]);
    // alba sobre los cerros de Lima, al oriente
    for (let y = 50 * SKY_R; y < SKY_HORIZON; y++) for (let x = 0; x < SKY_W; x++) {
      const deg = x / SKY_W * 360;
      const d = sky_angDist(deg, 10);
      const s = Math.max(0, 1 - d / 100) * Math.pow(clamp((y / SKY_R - 50) / 100, 0, 1), 1.3);
      if (s > 0) tx_blend(t, x, y, tx_mix([255, 176, 120], [255, 226, 170], clamp(1 - d / 40, 0, 1)), s * 0.75);
    }
    // bruma de la costa (neblina limeña)
    sky_clouds(t, 3501, 104, 146, 0.58, [236, 222, 214], [150, 146, 160], 10, [255, 214, 170]);
    // estribaciones andinas al este y el Morro Solar al suroeste
    sky_mountains(t, 3502, 320, 120, 8, 20, [96, 86, 104], null, [176, 156, 164], 26);
    sky_mountains(t, 3503, 215, 262, 10, 18, [104, 88, 80], null, [170, 150, 150], 12);
    // humo de Chorrillos en llamas (sur) y de la batalla en San Juan
    sky_smoke(t, 3504, 262, 10, 80, 1.1);
    sky_smoke(t, 3505, 300, 8, 56, 0.9);
    sky_smoke(t, 3506, 330, 6, 40, 0.8);
    sky_belowHorizon(t, function (deg, f) {
      const sea = sky_angDist(deg, 180) < 80;
      if (sea) return tx_mix([150, 150, 170], [40, 60, 86], clamp(f * 3, 0, 1));
      return tx_mix([170, 150, 130], [96, 84, 70], clamp(f * 2, 0, 1));
    });
    sky_register('CIELO5', t);
  }
  // ---------------- CIELO6: Miraflores, tarde del 15 de enero ----------------
  {
    const t = tx_new(SKY_W, SKY_H);
    sky_gradient(t, [[0, [60, 92, 160]], [70, [100, 132, 190]], [120, [196, 180, 170]], [140, [236, 196, 150]], [150, [246, 214, 170]]]);
    // sol de la tarde bajando sobre el Pacífico (oeste)
    for (let y = 30 * SKY_R; y < SKY_HORIZON; y++) for (let x = 0; x < SKY_W; x++) {
      const deg = x / SKY_W * 360;
      const d = sky_angDist(deg, 195);
      const s = Math.max(0, 1 - d / 90) * Math.pow(clamp((y / SKY_R - 30) / 120, 0, 1), 1.2);
      if (s > 0) tx_blend(t, x, y, tx_mix([255, 150, 70], [255, 236, 170], clamp(1 - d / 25, 0, 1)), s * 0.8);
    }
    sky_clouds(t, 3601, 80, 124, 0.4, [255, 226, 190], [150, 120, 130], 195, [255, 190, 110]);
    // cerros de Lima al oriente y el San Cristóbal al noreste
    sky_mountains(t, 3602, 330, 150, 6, 18, [116, 100, 112], null, [196, 170, 160], 24);
    // Lima al norte: casas, torres de la Catedral y de las iglesias
    sky_skyline(t, 3603, 70, 115, [118, 100, 104], [[84, 16], [86, 17], [92, 12], [99, 14], [104, 10], [110, 11]]);
    // humo de los cañones de la escuadra frente a la costa y de los reductos
    sky_smoke(t, 3604, 200, 7, 46, 1.2);
    sky_smoke(t, 3605, 225, 6, 38, 1.0);
    sky_smoke(t, 3606, 20, 8, 44, 1.0);
    sky_smoke(t, 3607, 340, 7, 36, 0.8);
    sky_belowHorizon(t, function (deg, f) {
      const sea = sky_angDist(deg, 190) < 85;
      if (sea) {
        const glint = Math.max(0, 1 - sky_angDist(deg, 195) / 12) * clamp(1 - f * 3, 0, 1);
        return tx_mix(tx_mix([176, 150, 140], [40, 70, 96], clamp(f * 2.5, 0, 1)), [255, 214, 150], glint * 0.8);
      }
      return tx_mix([182, 160, 124], [110, 96, 70], clamp(f * 2, 0, 1));
    });
    sky_register('CIELO6', t);
  }
}
