// Mapa de prueba para el renderizador y el compilador de mapas.
'use strict';

const TESTMAP_DEF = {
  lump: 'TEST',
  defaults: { floor: 0, ceil: 160, ftex: 'ARENA1', ctex: 'F_SKY1', light: 200, wall: 'ROCA1' },
  build: function (B) {
    // Playa abierta
    B.sector(MC_Rect(-1024, -1024, 1024, 1024), { ftex: 'ARENA1', ceil: 160, wall: 'ARENAW' });
    // Mar al oeste (techo bajo con cielo: el horizonte)
    B.sector(MC_Rect(-2048, -1024, -1024, 1024), { floor: -16, ceil: -8, ftex: 'AGUA1', wall: 'ARENAW' });
    B.line([-1024, -1024], [-1024, 1024], { blocking: 1 });
    // Meseta alta al este: el acantilado
    B.sector(MC_Rect(1024, -1024, 1536, 1024), { floor: 384, ceil: 640, ftex: 'ROCAF1', wall: 'ROCA1', lower: 'ROCA1' });
    // Escalera hacia una plataforma
    B.stairs(200, -600, 328, -400, 'E', 8, 0, 12, { ftex: 'LOSA1', wall: 'PIEDRA1', lower: 'PIEDRA1' });
    B.sector(MC_Rect(328, -600, 520, -400), { floor: 96, ftex: 'LOSA1', lower: 'PIEDRA1' });
    // Pilar macizo
    B.solid(MC_Rect(-300, 300, -236, 364), { wall: 'PIEDRA1' });
    // Casa con techo (sector "roof") e interior
    B.sector(MC_Rect(200, 200, 520, 520), { floor: 160, ceil: 640, ftex: 'TECHO1', wall: 'ADOBE2', lower: 'ADOBE2' });
    B.sector(MC_Rect(216, 216, 504, 504), { floor: 0, ceil: 128, ftex: 'PISO1', ctex: 'TECHO1', light: 150, wall: 'ADOBE3', lower: 'ADOBE3' });
    B.door(328, 200, 392, 216, 'y', { floor: 0, height: 96, tex: 'PUERTA1', wall: 'ADOBE2', ftex: 'PISO1', ctex: 'TECHO1' });
    // Ventana en la casa (textura)
    // Baranda enmascarada
    B.sector(MC_Rect(-600, -200, -400, -100), { floor: 0, maskmid: 'BARAND1' });
    B.thing('PLAYER1', -600, 0, 0);
  }
};
