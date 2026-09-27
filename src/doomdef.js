// =============================================================================
// doomdef.js — Definiciones globales del motor Atenea
// -----------------------------------------------------------------------------
// Constantes compartidas por todos los módulos, siguiendo la organización del
// código fuente original de DOOM (doomdef.h / doomstat.h / d_player.h).
// El motor usa coordenadas de mapa en punto flotante y ángulos BAM de 32 bits
// (binary angle measurement), igual que el DOOM original.
// =============================================================================
'use strict';

const GAME_TITLE = '1879: GUERRA DEL PACÍFICO';
const ENGINE_NAME = 'Motor Atenea';
const ENGINE_VERSION = '1.0';

// --- Tiempo -------------------------------------------------------------------
const TICRATE = 35;              // tics de juego por segundo (como DOOM)
const TICMS = 1000 / TICRATE;

// --- Pantalla (se recalculan en I_InitGraphics / R_SetViewSize) ----------------
let SCREENWIDTH = 320;           // ancho del framebuffer en píxeles reales
let SCREENHEIGHT = 200;          // alto del framebuffer en píxeles reales
let SCALE = 1;                   // factor de escala de la interfaz (1 = 320x200)
let UIOFS = 0;                   // desplazamiento X para centrar la interfaz de 320
const BASEWIDTH = 320;
const BASEHEIGHT = 200;
const ST_HEIGHT = 32;            // alto de la barra de estado (en píxeles base)

// --- Estados del juego ---------------------------------------------------------
const GS_LEVEL = 0, GS_INTERMISSION = 1, GS_FINALE = 2, GS_DEMOSCREEN = 3, GS_BRIEFING = 4;

// --- Acciones del juego --------------------------------------------------------
const ga_nothing = 0, ga_loadlevel = 1, ga_newgame = 2, ga_completed = 3,
      ga_victory = 4, ga_worlddone = 5, ga_briefing = 6, ga_loadgame = 7;

// --- Dificultad ----------------------------------------------------------------
const sk_baby = 0, sk_easy = 1, sk_medium = 2, sk_hard = 3, sk_nightmare = 4;

// --- Armas (weapontype_t) ------------------------------------------------------
const wp_corvo = 0;        // corvo chileno (cuerpo a cuerpo)
const wp_revolver = 1;     // revólver Lefaucheux 11 mm
const wp_comblain = 2;     // fusil Comblain II 11 mm (monotiro)
const wp_gatling = 3;      // ametralladora Gatling 11 mm
const wp_dinamita = 4;     // cartuchos de dinamita
const NUMWEAPONS = 5;
const wp_nochange = 99;

// --- Municiones (ammotype_t) ---------------------------------------------------
const am_revolver = 0;     // cartuchos de revólver
const am_fusil = 1;        // cartuchos 11 mm Comblain (fusil y Gatling)
const am_dinamita = 2;     // cartuchos de dinamita
const NUMAMMO = 3;
const am_noammo = 99;

// --- Llaves (card_t) -----------------------------------------------------------
const it_bluecard = 0, it_yellowcard = 1, it_redcard = 2, NUMCARDS = 3;

// --- Poderes (powertype_t) -----------------------------------------------------
const pw_chupilca = 0;     // "berserk": la legendaria chupilca del diablo
const pw_allmap = 1;       // plano del terreno / plano de minas de Elmore
const NUMPOWERS = 2;

// --- Estado del jugador ----------------------------------------------------------
const PST_LIVE = 0, PST_DEAD = 1, PST_REBORN = 2;

// --- Trucos (cheats) -------------------------------------------------------------
const CF_NOCLIP = 1, CF_GODMODE = 2, CF_NOMOMENTUM = 4, CF_NOTARGET = 8;

// --- Botones del ticcmd --------------------------------------------------------
const BT_ATTACK = 1, BT_USE = 2, BT_CHANGE = 4;
const BT_WEAPONMASK = 8 + 16 + 32, BT_WEAPONSHIFT = 3;

// --- Física (p_local.h) --------------------------------------------------------
const FRACUNIT = 65536;          // sólo para conversiones históricas
const MAXRADIUS = 32;
const GRAVITY = 1.0;
const MAXMOVE = 30;
const FRICTION = 0xe800 / 0x10000;
const STOPSPEED = 0x1000 / 0x10000;
const USERANGE = 64;
const MELEERANGE = 64;
const MISSILERANGE = 32 * 64;
const MAXHEALTH = 100;
const VIEWHEIGHT = 41;
const MAPBLOCKSIZE = 128;
const MAPBLOCKSHIFT = 7;
const PLAYERRADIUS = 16;
const ONFLOORZ = -2147483648;    // marcadores especiales para P_SpawnMobj
const ONCEILINGZ = 2147483647;
const MAXINT = 2147483647;
const MININT = -2147483648;
const BASETHRESHOLD = 100;

// --- Banderas de linedef (doomdata.h) ------------------------------------------
const ML_BLOCKING = 1;
const ML_BLOCKMONSTERS = 2;
const ML_TWOSIDED = 4;
const ML_DONTPEGTOP = 8;
const ML_DONTPEGBOTTOM = 16;
const ML_SECRET = 32;
const ML_SOUNDBLOCK = 64;
const ML_DONTDRAW = 128;
const ML_MAPPED = 256;

// --- Banderas de cosas del mapa (mapthing_t.options) ---------------------------
const MTF_EASY = 1, MTF_NORMAL = 2, MTF_HARD = 4, MTF_AMBUSH = 8;

// --- Tipos de pendiente --------------------------------------------------------
const ST_HORIZONTAL = 0, ST_VERTICAL = 1, ST_POSITIVE = 2, ST_NEGATIVE = 3;

// --- Caja delimitadora ---------------------------------------------------------
const BOXTOP = 0, BOXBOTTOM = 1, BOXLEFT = 2, BOXRIGHT = 3;

// --- Nodos BSP -----------------------------------------------------------------
const NF_SUBSECTOR = 0x8000;

// --- Banderas de mobj (p_mobj.h) -----------------------------------------------
const MF_SPECIAL = 0x1;
const MF_SOLID = 0x2;
const MF_SHOOTABLE = 0x4;
const MF_NOSECTOR = 0x8;
const MF_NOBLOCKMAP = 0x10;
const MF_AMBUSH = 0x20;
const MF_JUSTHIT = 0x40;
const MF_JUSTATTACKED = 0x80;
const MF_SPAWNCEILING = 0x100;
const MF_NOGRAVITY = 0x200;
const MF_DROPOFF = 0x400;
const MF_PICKUP = 0x800;
const MF_NOCLIP = 0x1000;
const MF_SLIDE = 0x2000;
const MF_FLOAT = 0x4000;
const MF_TELEPORT = 0x8000;
const MF_MISSILE = 0x10000;
const MF_DROPPED = 0x20000;
const MF_SHADOW = 0x40000;
const MF_NOBLOOD = 0x80000;
const MF_CORPSE = 0x100000;
const MF_INFLOAT = 0x200000;
const MF_COUNTKILL = 0x400000;
const MF_COUNTITEM = 0x800000;
const MF_SKULLFLY = 0x1000000;
const MF_NOTDMATCH = 0x2000000;
const MF_TURRET = 0x4000000;     // extensión Atenea: no se desplaza (artillería)
const MF_LOBBED = 0x8000000;     // extensión Atenea: proyectil con parábola (dinamita)

// --- Fotogramas de sprite ------------------------------------------------------
const FF_FULLBRIGHT = 0x8000;
const FF_FRAMEMASK = 0x7fff;

// --- Direcciones de movimiento de monstruos -------------------------------------
const DI_EAST = 0, DI_NORTHEAST = 1, DI_NORTH = 2, DI_NORTHWEST = 3,
      DI_WEST = 4, DI_SOUTHWEST = 5, DI_SOUTH = 6, DI_SOUTHEAST = 7, DI_NODIR = 8;

// --- Psprites -------------------------------------------------------------------
const ps_weapon = 0, ps_flash = 1, NUMPSPRITES = 2;
const WEAPONBOTTOM = 128;
const WEAPONTOP = 32;
const LOWERSPEED = 6;
const RAISESPEED = 6;

// --- Iluminación del renderizador (r_main.h) ------------------------------------
const LIGHTLEVELS = 16;
const LIGHTSEGSHIFT = 4;
const MAXLIGHTSCALE = 48;
const MAXLIGHTZ = 128;
const NUMCOLORMAPS = 32;

// --- Paletas (PLAYPAL) -----------------------------------------------------------
const STARTREDPALS = 1, NUMREDPALS = 8;
const STARTBONUSPALS = 9, NUMBONUSPALS = 4;

// --- Siluetas de drawseg ---------------------------------------------------------
const SIL_NONE = 0, SIL_BOTTOM = 1, SIL_TOP = 2, SIL_BOTH = 3;

// --- Resultados de movimiento de planos -----------------------------------------
const MP_OK = 0, MP_CRUSHED = 1, MP_PASTDEST = 2;
