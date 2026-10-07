"""Sonido sintetizado: fusilería, cañones, ametralladora, explosiones, corneta;
y las voces de la tropa.

Los efectos no son grabaciones: cada uno se genera al iniciar a partir de ruido
y osciladores (como en el FPS del proyecto). Si en recursos/sonidos/ hay un .wav
o .ogg con el mismo nombre que un efecto, se usa ese archivo en su lugar.

Las voces (recursos/sonidos/voces/<clave>_<n>.ogg, hechas con
herramientas/generar_voces.py) se cargan la primera vez que se dicen y suenan
por un canal propio, de a una: la tropa no se pisa al hablar. Con las voces
desactivadas en las opciones vuelven los toques de corneta.
Si el equipo no tiene audio, todo queda en silencio sin errores.
"""

import array
import math
import random

import pygame

from .. import rutas

FREC = 22050
_instancia = None


def sonido():
    global _instancia
    if _instancia is None:
        _instancia = Sonido(None)
    return _instancia


def _env(n, ataque, caida):
    a = max(1, int(ataque * FREC))
    out = []
    for i in range(n):
        if i < a:
            out.append(i / a)
        else:
            out.append(math.exp(-(i - a) / max(1.0, caida * FREC)))
    return out


def _a_sonido(muestras, volumen=1.0):
    pico = max(1e-6, max(abs(m) for m in muestras))
    esc = 30000 * volumen / pico
    datos = array.array("h", (int(max(-32767, min(32767, m * esc))) for m in muestras))
    estereo = array.array("h")
    for v in datos:
        estereo.append(v)
        estereo.append(v)
    return pygame.mixer.Sound(buffer=estereo.tobytes())


def _ruido_filtrado(n, rnd, corte):
    """Ruido con un filtro de paso bajo simple (corte 0..1)."""
    out = []
    y = 0.0
    for _ in range(n):
        y += corte * (rnd.uniform(-1, 1) - y)
        out.append(y)
    return out


def sint_fusil(rnd):
    n = int(0.45 * FREC)
    ruido = _ruido_filtrado(n, rnd, 0.55)
    env = _env(n, 0.002, 0.06)
    cola = _ruido_filtrado(n, rnd, 0.08)
    return [ruido[i] * env[i] + 0.6 * cola[i] * math.exp(-i / (0.18 * FREC)) for i in range(n)]


def sint_canon(rnd):
    n = int(1.6 * FREC)
    grave = _ruido_filtrado(n, rnd, 0.04)
    medio = _ruido_filtrado(n, rnd, 0.2)
    out = []
    for i in range(n):
        t = i / FREC
        e = math.exp(-t / 0.35)
        golpe = math.sin(2 * math.pi * (55 - 20 * t) * t) * math.exp(-t / 0.15)
        out.append(2.2 * grave[i] * e + 0.5 * medio[i] * math.exp(-t / 0.08) + 0.8 * golpe)
    return out


def sint_explosion(rnd):
    n = int(1.4 * FREC)
    grave = _ruido_filtrado(n, rnd, 0.06)
    agudo = _ruido_filtrado(n, rnd, 0.6)
    return [1.6 * grave[i] * math.exp(-i / (0.4 * FREC)) + 0.4 * agudo[i] * math.exp(-i / (0.05 * FREC))
            for i in range(n)]


def sint_gatling(rnd):
    n = int(0.9 * FREC)
    out = [0.0] * n
    for k in range(8):
        ini = int(k * 0.11 * FREC)
        tiro = sint_fusil(rnd)
        for i in range(min(len(tiro), n - ini)):
            out[ini + i] += tiro[i] * (0.6 if i > 2000 else 1.0)
    return out


def sint_corneta(rnd, notas):
    """Toque de corneta: lista de (semitono relativo a Sol 392 Hz, duración)."""
    out = []
    for semi, dur in notas:
        f = 392 * 2 ** (semi / 12)
        n = int(dur * FREC)
        for i in range(n):
            t = i / FREC
            env = min(1.0, t / 0.02) * (1 - max(0.0, (t - dur + 0.05) / 0.05))
            v = (math.sin(2 * math.pi * f * t) + 0.5 * math.sin(4 * math.pi * f * t)
                 + 0.25 * math.sin(6 * math.pi * f * t) + 0.12 * math.sin(8 * math.pi * f * t))
            out.append(v * env * 0.5)
        out.extend([0.0] * int(0.02 * FREC))
    return out


def sint_clic(rnd):
    n = int(0.05 * FREC)
    return [math.sin(2 * math.pi * 1800 * i / FREC) * math.exp(-i / (0.006 * FREC)) for i in range(n)]


def sint_martillo(rnd):
    n = int(0.25 * FREC)
    return [(math.sin(2 * math.pi * 900 * i / FREC) + rnd.uniform(-0.6, 0.6)) * math.exp(-i / (0.02 * FREC))
            for i in range(n)]


def sint_sable(rnd):
    n = int(0.25 * FREC)
    return [(math.sin(2 * math.pi * (2400 + 800 * math.sin(i / 300)) * i / FREC) * 0.4 + rnd.uniform(-0.5, 0.5))
            * math.exp(-i / (0.04 * FREC)) for i in range(n)]


def sint_silbato(rnd):
    """Silbato de la locomotora: acorde agudo con soplido de vapor."""
    n = int(1.3 * FREC)
    vapor = _ruido_filtrado(n, rnd, 0.5)
    out = []
    for i in range(n):
        t = i / FREC
        env = min(1.0, t / 0.06) * (1.0 if t < 1.0 else max(0.0, 1 - (t - 1.0) / 0.3))
        tono = (math.sin(2 * math.pi * 523 * t) + 0.8 * math.sin(2 * math.pi * 659 * t)
                + 0.6 * math.sin(2 * math.pi * 784 * t))
        out.append(env * (0.5 * tono + 0.35 * vapor[i]))
    return out


TOQUES = {
    "lista": [(0, 0.12), (5, 0.12), (9, 0.3)],                         # unidad lista
    "ataque": [(9, 0.1), (9, 0.1), (9, 0.1), (5, 0.1), (9, 0.35)],     # ¡bajo ataque!
    "obra": [(0, 0.15), (4, 0.15), (7, 0.15), (12, 0.35)],             # obra terminada
    "investigado": [(7, 0.15), (12, 0.4)],
    "victoria": [(0, 0.2), (4, 0.2), (7, 0.2), (12, 0.5), (7, 0.2), (12, 0.8)],
    "derrota": [(7, 0.4), (5, 0.4), (4, 0.4), (0, 1.0)],
}


class Sonido:
    def __init__(self, config):
        self.ok = False
        self.vol = 0.7
        self.config = config
        self.efectos = {}
        self.ultimo = {}
        self.voces = {}             # clave -> rutas de sus variantes
        self._voz_cargada = {}      # ruta -> Sound (se cargan al decirlas por primera vez)
        self._ultima_voz = {}       # clave -> última variante dicha (para no repetirla)
        self.canal_voz = None
        self._prioridad_voz = 0
        self._pendiente = None      # aviso que espera turno: (ruta, prioridad, vence en ms)
        if config is not None:
            self.vol = float(config["volumen_efectos"])
        try:
            if not pygame.mixer.get_init():
                pygame.mixer.init(FREC, -16, 2, 512)
            pygame.mixer.set_num_channels(32)
            pygame.mixer.set_reserved(1)
            # el canal 0 queda para las voces y los efectos usan los demás (find_channel()
            # no respeta los canales reservados, por eso se eligen aquí)
            self.canal_voz = pygame.mixer.Channel(0)
            self._canales = [pygame.mixer.Channel(i) for i in range(1, pygame.mixer.get_num_channels())]
            self.ok = True
        except pygame.error:
            self.ok = False
            return
        self._indexar_voces()
        rnd = random.Random(1879)
        gen = {
            "fusil": sint_fusil, "canon": sint_canon, "explosion": sint_explosion, "gatling": sint_gatling,
            "clic": sint_clic, "martillo": sint_martillo, "sable": sint_sable, "silbato": sint_silbato,
        }
        for nombre, f in gen.items():
            self.efectos[nombre] = self._cargar(nombre) or _a_sonido(f(rnd), 0.9)
        for nombre, notas in TOQUES.items():
            self.efectos["toque_" + nombre] = self._cargar("toque_" + nombre) or _a_sonido(sint_corneta(rnd, notas), 0.6)
        global _instancia
        _instancia = self

    def _indexar_voces(self):
        carpeta = rutas.dir_recursos() / "sonidos" / "voces"
        if not carpeta.is_dir():
            return
        for ruta in sorted(carpeta.iterdir()):
            if ruta.suffix.lower() in (".ogg", ".wav"):
                clave, _, n = ruta.stem.rpartition("_")
                if clave and n.isdigit():
                    self.voces.setdefault(clave, []).append(ruta)

    @property
    def voces_activas(self):
        try:
            return bool(self.config["voces"]) if self.config is not None else True
        except (KeyError, TypeError):
            return True

    def voz(self, claves, prioridad=1):
        """Dice una frase de la tropa: la primera de las claves que tenga voces (una variante al azar).

        Prioridades: 0 al seleccionar, 1 al dar una orden, 2 para los avisos (unidad lista,
        obra terminada...) y 3 para las alarmas (¡bajo ataque!, victoria). Una voz más
        importante corta a la que suena; una de igual o menor importancia se descarta,
        salvo los avisos, que esperan su turno unos segundos. Devuelve False si no hay voz
        (desactivadas o sin archivos), para que suene el toque de corneta en su lugar."""
        if not self.ok or self.vol <= 0 or not self.voces_activas:
            return False
        if isinstance(claves, str):
            claves = (claves,)
        clave = next((c for c in claves if self.voces.get(c)), None)
        if clave is None:
            return False
        variantes = self.voces[clave]
        ruta = random.choice([r for r in variantes if r != self._ultima_voz.get(clave)] or variantes)
        self._ultima_voz[clave] = ruta
        if self.canal_voz.get_busy() and prioridad <= self._prioridad_voz:
            if prioridad >= 2:
                self._pendiente = (ruta, prioridad, pygame.time.get_ticks() + 4000)
            return True
        self._decir(ruta, prioridad)
        return True

    def _decir(self, ruta, prioridad):
        s = self._voz_cargada.get(ruta)
        if s is None:
            try:
                s = pygame.mixer.Sound(str(ruta))
            except pygame.error:
                return
            self._voz_cargada[ruta] = s
        self.canal_voz.set_volume(min(1.0, self.vol * 1.15))
        self.canal_voz.play(s)
        self._prioridad_voz = prioridad

    def actualizar(self):
        """Da la palabra al aviso que esperaba turno (una vez por cuadro)."""
        if self._pendiente is None or self.canal_voz is None or self.canal_voz.get_busy():
            return
        ruta, prioridad, vence = self._pendiente
        self._pendiente = None
        if pygame.time.get_ticks() <= vence:
            self._decir(ruta, prioridad)

    def _cargar(self, nombre):
        for ext in (".ogg", ".wav"):
            ruta = rutas.dir_recursos() / "sonidos" / (nombre + ext)
            if ruta.exists():
                try:
                    return pygame.mixer.Sound(str(ruta))
                except pygame.error:
                    return None
        return None

    def reproducir(self, nombre, volumen=1.0, pan=0.0, minimo_ms=40):
        if not self.ok or self.vol <= 0:
            return
        s = self.efectos.get(nombre)
        if s is None:
            return
        ahora = pygame.time.get_ticks()
        if ahora - self.ultimo.get(nombre, -9999) < minimo_ms:
            return
        self.ultimo[nombre] = ahora
        canal = next((c for c in self._canales if not c.get_busy()), None)
        if canal is None:
            return
        v = max(0.0, min(1.0, volumen * self.vol))
        izq = v * min(1.0, 1 - pan)
        der = v * min(1.0, 1 + pan)
        canal.set_volume(izq, der)
        canal.play(s)

    def en_mapa(self, nombre, x, y, camara, minimo_ms=40, volumen=1.0):
        """Efecto con volumen y paneo según la distancia a la cámara (x, y en píxeles del mapa)."""
        cx, cy, ancho = camara
        dx = (x - cx) / max(1, ancho)
        dy = (y - cy) / max(1, ancho)
        d = math.hypot(dx, dy)
        if d > 1.6:
            return
        self.reproducir(nombre, volumen * max(0.0, 1 - d / 1.6), max(-1.0, min(1.0, dx * 1.4)), minimo_ms)

    def toque(self, nombre):
        self.reproducir("toque_" + nombre, 0.9, 0.0, 600)

    def ui(self, nombre):
        self.reproducir(nombre, 0.6, 0.0, 30)
