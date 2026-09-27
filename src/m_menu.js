// =============================================================================
// m_menu.js — Menús (m_menu.c)
// -----------------------------------------------------------------------------
// Menú principal, selección de acción de armas, dificultad (con grados
// históricos), opciones y páginas de ayuda, historia y créditos. Se opera con
// teclado, ratón, pantalla táctil o mando.
// =============================================================================
'use strict';

let menuactive = false;
let currentMenu = null;
let itemOn = 0;
let whichSkull = 0, skullAnimCounter = 10;
let messageToPrint = null, messageRoutine = null, messageNeedsInput = false;
let menuPage = 0;
let pendingBattle = 1, pendingCampaign = true;

const SKILL_NAMES = ['Recluta', 'Cívico movilizado', 'Soldado de línea', 'Veterano de la campaña', '¡Calacuerda!'];

function M_Item(text, action, opts) { return Object.assign({ text: text, action: action }, opts || {}); }

const MainMenu = {
  title: null, big: true, x: 76, y: 70, spacing: 17, items: [], build: function () {
    const it = [];
    if (gamestate === GS_LEVEL && usergame) it.push(M_Item('Volver al combate', function () { M_ClearMenus(); }));
    it.push(M_Item('Nueva campaña', function () { pendingCampaign = true; pendingBattle = 1; M_SetupNextMenu(SkillMenu); }));
    it.push(M_Item('Acciones de armas', function () { M_SetupNextMenu(BattleMenu); }));
    it.push(M_Item('Opciones', function () { M_SetupNextMenu(OptionsMenu); }));
    it.push(M_Item('Controles', function () { menuPage = 0; M_SetupNextMenu(ControlsMenu); }));
    it.push(M_Item('Historia', function () { menuPage = 0; M_SetupNextMenu(HistoryMenu); }));
    it.push(M_Item('Créditos', function () { menuPage = 0; M_SetupNextMenu(CreditsMenu); }));
    if (gamestate === GS_LEVEL && usergame) it.push(M_Item('Abandonar la batalla', M_QuitBattle));
    this.items = it;
  }
};

const BattleMenu = {
  title: 'ACCIONES DE ARMAS', big: false, x: 40, y: 64, spacing: 26, prev: MainMenu, items: [
    M_Item('I.   Desembarco en Pisagua', function () { pendingCampaign = false; pendingBattle = 1; M_SetupNextMenu(SkillMenu); }, { sub: '2 de noviembre de 1879 · Tarapacá' }),
    M_Item('II.  Batalla de Dolores (San Francisco)', function () { pendingCampaign = false; pendingBattle = 2; M_SetupNextMenu(SkillMenu); }, { sub: '19 de noviembre de 1879 · Pampa del Tamarugal' }),
    M_Item('III. Asalto y toma del Morro de Arica', function () { pendingCampaign = false; pendingBattle = 3; M_SetupNextMenu(SkillMenu); }, { sub: '7 de junio de 1880 · Arica' })
  ]
};

const SKILL_SUBS = ['Poca resistencia: para conocer el terreno', 'Para quien empieza su primera campaña',
  'La dureza real de la campaña', 'Más enemigos, más certeros', 'El enemigo rápido y temible'];

const SkillMenu = {
  title: 'GRADO DE DIFICULTAD', big: false, x: 56, y: 52, spacing: 26, prev: MainMenu, items: SKILL_NAMES.map(function (n, i) {
    return M_Item(n, function () {
      if (i === sk_nightmare) {
        M_StartMessage('¡Calacuerda! El enemigo es más rápido\ny dispara más. ¿Listo para la carga?\n\n(S/N)', function (yes) {
          if (yes) M_StartGame(i);
        }, true);
        return;
      }
      M_StartGame(i);
    }, { sub: SKILL_SUBS[i] });
  })
};

function M_StartGame(skill) {
  M_ClearMenus();
  G_DeferedInitNew(skill, pendingBattle, pendingCampaign);
}

function M_Toggle(label, get, set) {
  return M_Item(label, null, { kind: 'toggle', get: get, set: set });
}
function M_Slider(label, get, set, max) {
  return M_Item(label, null, { kind: 'slider', get: get, set: set, max: max });
}

const OptionsMenu = {
  title: 'OPCIONES', big: false, x: 30, y: 44, spacing: 11, prev: MainMenu, items: [
    M_Slider('Sensibilidad del ratón', function () { return defaults.mouseSensitivity; }, function (v) { defaults.mouseSensitivity = v; }, 15),
    M_Slider('Volumen de efectos', function () { return defaults.sfxVolume; }, function (v) { defaults.sfxVolume = v; I_SetSfxVolume(v); }, 15),
    M_Slider('Volumen de música', function () { return defaults.musicVolume; }, function (v) { defaults.musicVolume = v; I_SetMusicVolume(v); }, 15),
    M_Toggle('Detalle gráfico alto (640x400)', function () { return defaults.detailLevel; }, function (v) { defaults.detailLevel = v; I_needResize = true; }),
    M_Toggle('Pantalla panorámica', function () { return defaults.widescreen; }, function (v) { defaults.widescreen = v; I_needResize = true; }),
    M_Toggle('Barra de estado', function () { return defaults.screenblocks === 10 ? 1 : 0; }, function (v) { defaults.screenblocks = v ? 10 : 11; R_SetViewSize(defaults.screenblocks); }),
    M_Toggle('Correr siempre', function () { return defaults.alwaysRun; }, function (v) { defaults.alwaysRun = v; }),
    M_Toggle('Movimiento fluido (interpolado)', function () { return defaults.interpolate; }, function (v) { defaults.interpolate = v; }),
    M_Toggle('Mira en el centro', function () { return defaults.crosshair; }, function (v) { defaults.crosshair = v; }),
    M_Toggle('Mensajes en pantalla', function () { return defaults.showMessages; }, function (v) { defaults.showMessages = v; }),
    M_Toggle('Avanzar con el ratón (clásico)', function () { return defaults.mouseMove; }, function (v) { defaults.mouseMove = v; }),
    M_Slider('Brillo', function () { return defaults.usegamma; }, function (v) { defaults.usegamma = v; I_RefreshGamma(); }, 4),
    M_Item('Controles táctiles', null, { kind: 'cycle', values: ['automático', 'sí', 'no'], get: function () { return [2, 1, 0].indexOf(defaults.touchControls); }, set: function (i) { defaults.touchControls = [2, 1, 0][i]; } }),
    M_Item('Pantalla completa', function () { I_ToggleFullscreen(); })
  ]
};

const ControlsMenu = { title: 'CONTROLES', page: true, prev: MainMenu, pages: [[
  'W A S D / flechas ....... avanzar y desplazarse',
  'Ratón (clic para capturar) ... girar',
  'Clic izquierdo / Ctrl / F ... disparar',
  'E / Espacio / Enter ....... usar (izar bandera)',
  'Mayúsculas ................ correr / caminar',
  '1 Corvo   2 Revólver   3 Fusil Comblain',
  '4 Gatling   5 Dinamita   Q / rueda: cambiar',
  'Tab ....................... carta del terreno',
  'P ......................... pausa',
  'Esc ....................... menú',
  '',
  'Móvil: palanca izquierda para marchar, arrastrar a',
  'la derecha para girar; botones FUEGO, USAR, ARMA.',
  'Mando: sticks, gatillo derecho dispara, A usa.'
]] };

const HistoryMenu = { title: 'LA CAMPAÑA', page: true, prev: MainMenu, pages: HISTORY_PAGES };

const CreditsMenu = { title: 'CRÉDITOS', page: true, prev: MainMenu, pages: [[
  GAME_TITLE,
  ENGINE_NAME + ' ' + ENGINE_VERSION + ' — motor en JavaScript inspirado',
  'en la arquitectura de DOOM (id Software, 1993):',
  'árbol BSP, sectores, visplanes, tics a 35 Hz,',
  'máquina de estados de actores, WAD en memoria.',
  '',
  'Todo el arte, el sonido y la música se generan',
  'por código al iniciar. No usa recursos de DOOM.',
  '',
  'Referencias históricas: ver docs/HISTORIA.md.',
  'Homenaje a los combatientes de Chile, Perú y',
  'Bolivia que cayeron en la Guerra del Pacífico.'
]] };

// --- Mensajes emergentes -----------------------------------------------------------------------------
function M_StartMessage(text, routine, input) {
  messageToPrint = text;
  messageRoutine = routine;
  messageNeedsInput = !!input;
  menuactive = true;
}

function M_QuitBattle() {
  M_StartMessage('¿Abandonar la batalla y volver\nal cuartel general?\n\n(S/N)', function (yes) {
    if (yes) { M_ClearMenus(); D_StartTitle(); }
  }, true);
}

// --- Navegación -------------------------------------------------------------------------------------------
function M_SetupNextMenu(menu) {
  currentMenu = menu;
  if (menu.build) menu.build();
  itemOn = 0;
  menuPage = 0;
}

function M_StartControlPanel() {
  if (menuactive) return;
  menuactive = true;
  I_ReleasePointerLock();
  M_SetupNextMenu(MainMenu);
  S_StartSound(null, 'menusl');
}

function M_ClearMenus() {
  menuactive = false;
  messageToPrint = null;
  M_SaveDefaults();
}

function M_ItemRect(i) {
  const m = currentMenu;
  const y = m.y + i * m.spacing;
  return { x: m.x - 20, y: y - 3, w: 320 - (m.x - 20) * 2 + 40, h: m.spacing };
}

function M_Activate(item, dir) {
  if (!item) return;
  if (item.kind === 'toggle') { item.set(item.get() ? 0 : 1); S_StartSound(null, 'menumv'); return; }
  if (item.kind === 'slider') {
    const v = clamp(item.get() + (dir || 1), 0, item.max);
    item.set(v); S_StartSound(null, 'menumv'); return;
  }
  if (item.kind === 'cycle') {
    const n = item.values.length;
    item.set((item.get() + (dir || 1) + n) % n); S_StartSound(null, 'menumv'); return;
  }
  if (item.action) { S_StartSound(null, 'menusl'); item.action(); }
}

function M_Back() {
  S_StartSound(null, 'menubk');
  if (currentMenu && currentMenu.prev) M_SetupNextMenu(currentMenu.prev);
  else if (gamestate === GS_LEVEL && usergame) M_ClearMenus();
  else M_SetupNextMenu(MainMenu);
}

function M_Responder(ev) {
  if (messageToPrint) {
    if (ev.type === ev_keydown || (ev.type === ev_pointer && (ev.data1 === 'down' || ev.data1 === 'tap'))) {
      if (messageNeedsInput) {
        let yes = null;
        if (ev.type === ev_keydown) {
          if (ev.data1 === 'KeyS' || ev.data1 === 'KeyY' || ev.data1 === 'Enter') yes = true;
          else if (ev.data1 === 'KeyN' || ev.data1 === 'Escape' || ev.data1 === 'Backspace') yes = false;
        } else {
          const p = I_ClientToLogical(ev.x, ev.y);
          yes = p.x < 160;
        }
        if (yes === null) return true;
        const r = messageRoutine;
        messageToPrint = null;
        if (!currentMenu) menuactive = false;
        if (r) r(yes);
      } else {
        messageToPrint = null;
        if (messageRoutine) messageRoutine(true);
      }
      S_StartSound(null, 'menumv');
      return true;
    }
    return ev.type === ev_keyup ? false : true;
  }
  if (!menuactive) {
    if (ev.type === ev_keydown && (ev.data1 === 'Escape' || ev.data1 === 'POINTERLOST' || ev.data1 === 'PAD_START')) {
      if (gamestate === GS_LEVEL || gamestate === GS_DEMOSCREEN) {
        M_StartControlPanel();
        return true;
      }
    }
    return false;
  }
  const m = currentMenu;
  if (ev.type === ev_pointer) {
    const p = I_ClientToLogical(ev.x, ev.y);
    if (m.page) {
      if (ev.data1 === 'down' || ev.data1 === 'tap') {
        if (p.y > 170) { if (p.x < 160) M_PagePrev(); else M_PageNext(); } else M_Back();
      }
      return true;
    }
    for (let i = 0; i < m.items.length; i++) {
      const r = M_ItemRect(i);
      if (p.y >= r.y && p.y < r.y + r.h) {
        if (ev.data1 === 'move') { if (itemOn !== i) { itemOn = i; } }
        else if (ev.data1 === 'down' || ev.data1 === 'tap') {
          itemOn = i;
          const it = m.items[i];
          const dir = (it.kind === 'slider' || it.kind === 'cycle') && p.x < 200 ? -1 : 1;
          M_Activate(it, dir);
        }
        return true;
      }
    }
    if ((ev.data1 === 'down' || ev.data1 === 'tap') && p.y > 180) M_Back();
    return true;
  }
  if (ev.type !== ev_keydown) return ev.type === ev_keyup ? false : true;
  const k = ev.data1;
  if (m.page) {
    if (k === 'ArrowRight' || k === 'Enter' || k === 'Space' || k === 'ArrowDown' || k === 'KeyD' || k === 'PAD_A') M_PageNext();
    else if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'KeyA') M_PagePrev();
    else if (k === 'Escape' || k === 'Backspace' || k === 'PAD_B') M_Back();
    return true;
  }
  switch (k) {
    case 'ArrowDown': case 'KeyS': case 'PAD_DOWN':
      itemOn = (itemOn + 1) % m.items.length; S_StartSound(null, 'menumv'); return true;
    case 'ArrowUp': case 'KeyW':
      itemOn = (itemOn - 1 + m.items.length) % m.items.length; S_StartSound(null, 'menumv'); return true;
    case 'ArrowLeft': case 'KeyA':
      if (m.items[itemOn].kind) M_Activate(m.items[itemOn], -1); return true;
    case 'ArrowRight': case 'KeyD':
      if (m.items[itemOn].kind) M_Activate(m.items[itemOn], 1); return true;
    case 'Enter': case 'Space': case 'PAD_A': case 'KeyE':
      M_Activate(m.items[itemOn], 1); return true;
    case 'Escape': case 'Backspace': case 'PAD_B': case 'PAD_START':
      M_Back(); return true;
  }
  return true;
}

function M_PageNext() {
  const m = currentMenu;
  if (menuPage < m.pages.length - 1) { menuPage++; S_StartSound(null, 'menumv'); }
  else M_Back();
}
function M_PagePrev() {
  if (menuPage > 0) { menuPage--; S_StartSound(null, 'menumv'); }
}

function M_Ticker() {
  if (--skullAnimCounter <= 0) {
    whichSkull ^= 1;
    skullAnimCounter = 8;
  }
}

function M_Drawer() {
  if (messageToPrint) {
    V_DimScreen(16);
    const lines = messageToPrint.split('\n');
    let y = 100 - lines.length * 6;
    for (const l of lines) { V_DrawTextCentered(y, l, false); y += 12; }
    return;
  }
  if (!menuactive || !currentMenu) return;
  // Sobre la portada se oscurece más para que el título no se superponga.
  V_DimScreen(gamestate === GS_LEVEL ? 14 : 28);
  const m = currentMenu;
  if (m === MainMenu) {
    V_DrawTextCentered(12, '1879', true, V_Translations.gold);
    V_DrawTextCentered(34, 'GUERRA DEL PACÍFICO', true, V_Translations.red);
  } else if (m.title) {
    V_DrawTextCentered(12, m.title, true, V_Translations.red);
  }
  if (m.page) {
    const page = m.pages[menuPage] || [];
    let y = 40;
    for (const l of page) {
      if (l.startsWith('#')) { V_DrawTextCentered(y, l.slice(1), false, V_Translations.gold); }
      else V_DrawText(16, y, l, false);
      y += 11;
    }
    if (m.pages.length > 1) V_DrawTextCentered(186, '« ' + (menuPage + 1) + ' / ' + m.pages.length + ' »', false, V_Translations.sand);
    else V_DrawTextCentered(186, 'Esc: volver', false, V_Translations.sand);
    return;
  }
  for (let i = 0; i < m.items.length; i++) {
    const it = m.items[i];
    const y = m.y + i * m.spacing;
    const sel = i === itemOn;
    const tr = sel ? V_Translations.gold : null;
    V_DrawText(m.x, y, it.text, m.big, tr);
    if (it.sub) V_DrawText(m.x + 10, y + 11, it.sub, false, V_Translations.sand);
    if (it.kind === 'toggle') V_DrawText(262, y, it.get() ? 'Sí' : 'No', false, tr || V_Translations.sand);
    else if (it.kind === 'cycle') V_DrawText(236, y, it.values[it.get()], false, tr || V_Translations.sand);
    else if (it.kind === 'slider') {
      const v = it.get();
      for (let k = 0; k <= it.max; k++) V_FillRect(232 + k * 4, y + 1, 3, 6, k <= v ? C(R_GOLD, 3) : C(R_GRAY, 6));
    }
    if (sel) {
      const star = W_CacheLumpName(whichSkull ? 'M_STAR2' : 'M_STAR1');
      V_DrawPatch(m.x - 14, y + (m.big ? 6 : 3), star);
    }
  }
  if (m === MainMenu) V_DrawTextCentered(188, ENGINE_NAME + ' ' + ENGINE_VERSION, false, V_Translations.sand);
}
