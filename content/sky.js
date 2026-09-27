// =============================================================================
// sky.js — Cielos panorámicos (360 grados, 1024 columnas x 200 filas)
// -----------------------------------------------------------------------------
// La columna c corresponde al rumbo c/1024*360 grados (0 = este, 90 = norte,
// 180 = oeste, 270 = sur), de modo que el Pacífico queda siempre al poniente y
// la cordillera de los Andes al oriente, como en la costa de Tarapacá y Arica.
// La fila 150 es el horizonte.
//   CIELO1 — Pisagua, mañana del 2 de noviembre de 1879: humo del bombardeo.
//   CIELO2 — Dolores, tarde del 19 de noviembre de 1879: polvo y Andes.
//   CIELO3 — Arica, amanecer del 7 de junio de 1880: alba sobre el Morro.
// =============================================================================
'use strict';

const SKY_W = 1024, SKY_H = 200, SKY_HORIZON = 150;

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
  // stops: [[fila, [r,g,b]], ...] ordenados por fila
  for (let y = 0; y < SKY_H; y++) {
    let c = stops[stops.length - 1][1];
    for (let k = 0; k < stops.length - 1; k++) {
      const a = stops[k], b = stops[k + 1];
      if (y >= a[0] && y <= b[0]) { c = tx_mix(a[1], b[1], (y - a[0]) / Math.max(1, b[0] - a[0])); break; }
      if (y < stops[0][0]) { c = stops[0][1]; break; }
    }
    for (let x = 0; x < SKY_W; x++) tx_put(t, x, y, c);
  }
}

function sky_clouds(t, seed, rowTop, rowBot, density, light, shade, sunDeg, sunCol) {
  for (let y = rowTop; y < rowBot; y++) {
    const fy = (y - rowTop) / (rowBot - rowTop);
    for (let x = 0; x < SKY_W; x++) {
      const n = tx_vnoise(seed, x / SKY_W * 24, y / 14, 24, 64) * 0.55 +
                tx_vnoise(seed + 1, x / SKY_W * 64, y / 6, 64, 64) * 0.3 +
                tx_vnoise(seed + 2, x / SKY_W * 128, y / 3, 128, 128) * 0.15;
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
    const top = SKY_HORIZON - hgt;
    for (let y = Math.floor(top); y < SKY_HORIZON + 2; y++) {
      const depth = (y - top) / Math.max(1, hgt);
      let c = tx_mix(col, hazeCol, clamp(1 - depth * 0.6, 0, 1) * 0.35 + (y > SKY_HORIZON - 4 ? 0.3 : 0));
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

function sky_smoke(t, seed, deg, width, heightRows, drift) {
  const cx = deg / 360 * SKY_W;
  for (let y = SKY_HORIZON - heightRows; y < SKY_HORIZON + 1; y++) {
    const up = (SKY_HORIZON - y) / heightRows;          // 0 abajo, 1 arriba
    const w = width * (0.35 + up * 1.4);
    const off = drift * up * up * 40;
    for (let dx = -w * 1.6; dx <= w * 1.6; dx++) {
      const x = Math.floor(cx + off + dx);
      const n = tx_vnoise(seed, (x + SKY_W) / SKY_W * 64, y / 7, 64, 64);
      const d = Math.abs(dx) / w;
      const a = clamp((1 - d) * 1.3 + (n - 0.5) * 1.2, 0, 1) * (1 - up * 0.55);
      if (a > 0.05) {
        const c = tx_mix([70, 66, 64], [150, 146, 140], clamp(n * 1.2 - 0.2 + up * 0.3, 0, 1));
        tx_blend(t, x, y, c, a * 0.9);
      }
    }
  }
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
    tx_register('CIELO1', t, 3);
  }
  // ---------------- CIELO2: Dolores ----------------
  {
    const t = tx_new(SKY_W, SKY_H);
    sky_gradient(t, [[0, [84, 124, 184]], [70, [116, 156, 206]], [128, [196, 206, 214]], [150, [236, 226, 206]]]);
    // resplandor del sol de la tarde al poniente
    for (let y = 60; y < SKY_HORIZON; y++) for (let x = 0; x < SKY_W; x++) {
      const deg = x / SKY_W * 360;
      const s = Math.max(0, 1 - sky_angDist(deg, 200) / 60) * clamp((y - 60) / 90, 0, 1);
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
    tx_register('CIELO2', t, 3);
  }
  // ---------------- CIELO3: Arica al alba ----------------
  {
    const t = tx_new(SKY_W, SKY_H);
    sky_gradient(t, [[0, [16, 18, 48]], [60, [34, 36, 82]], [110, [96, 74, 128]], [140, [150, 104, 130]], [150, [176, 128, 128]]]);
    // resplandor del alba al este-noreste
    for (let y = 40; y < SKY_HORIZON; y++) for (let x = 0; x < SKY_W; x++) {
      const deg = x / SKY_W * 360;
      const d = sky_angDist(deg, 40);
      const s = Math.max(0, 1 - d / 110) * Math.pow(clamp((y - 40) / 110, 0, 1), 1.4);
      if (s > 0) tx_blend(t, x, y, tx_mix([255, 150, 90], [255, 220, 150], clamp(1 - d / 40, 0, 1)), s * 0.9);
      // lado del mar más oscuro
      const w = Math.max(0, 1 - sky_angDist(deg, 200) / 100) * 0.35;
      if (w > 0) tx_blend(t, x, y, [26, 30, 70], w);
    }
    // estrellas que se apagan al poniente
    const rng = M_SeededRNG(3301);
    for (let i = 0; i < 260; i++) {
      const x = Math.floor(rng() * SKY_W), y = Math.floor(rng() * 110);
      const deg = x / SKY_W * 360;
      const fade = clamp(sky_angDist(deg, 40) / 180, 0, 1) * clamp(1 - y / 120, 0, 1);
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
    tx_register('CIELO3', t, 3);
  }
}
