"""Efectos: humo de pólvora negra, fogonazos, granadas en vuelo, explosiones,
polvo, cruces de curación, signos de dinero, marcas en el suelo, caídos, sangre
y cuerpos despedazados por la artillería (estos dos se pueden desactivar en
Opciones).

Todas las partículas usan unas pocas texturas (bocanada, chispa, círculo) que
la GPU tiñe, escala y funde: miles de partículas cuestan muy poco.
"""

import math
import random

import pygame

TIPO_HUMO = 0
TIPO_FOGONAZO = 1
TIPO_FUEGO = 2
TIPO_POLVO = 3
TIPO_CRUZ = 4
TIPO_CHISPA = 5
TIPO_DINERO = 6
TIPO_GOTA = 7
TIPO_TROZO = 8
DORADO = (255, 206, 64)
SANGRE = (120, 10, 12)
SANGRE_VIVA = (176, 18, 20)
PIEL_TROZO = (196, 140, 110)
HUESO = (232, 224, 204)


def _bocanada(r=32):
    s = pygame.Surface((r * 2, r * 2), pygame.SRCALPHA)
    for k in range(r, 0, -1):
        a = int(160 * (1 - k / r) ** 1.6)
        pygame.draw.circle(s, (255, 255, 255, a), (r, r), k)
    return s


def _chispa(r=12):
    s = pygame.Surface((r * 2, r * 2), pygame.SRCALPHA)
    for k in range(r, 0, -1):
        a = int(255 * (1 - k / r) ** 2.2)
        pygame.draw.circle(s, (255, 255, 255, a), (r, r), k)
    return s


def _cruz():
    s = pygame.Surface((12, 12), pygame.SRCALPHA)
    s.fill((255, 255, 255, 255), (4, 0, 4, 12))
    s.fill((255, 255, 255, 255), (0, 4, 12, 4))
    return s


def _charco(semilla=0, lado=48):
    """Charco de sangre irregular (blanco sobre transparente no: color propio, ya oscuro)."""
    rnd = random.Random(semilla)
    s = pygame.Surface((lado, lado // 2), pygame.SRCALPHA)
    c = lado // 2
    for _ in range(9):
        w = rnd.uniform(0.35, 0.8) * lado
        h = w * rnd.uniform(0.32, 0.5)
        x = c + rnd.uniform(-0.18, 0.18) * lado - w / 2
        y = lado / 4 + rnd.uniform(-0.08, 0.08) * lado - h / 2
        pygame.draw.ellipse(s, (*SANGRE, 210), (x, y, w, h))
    for _ in range(6):
        r = rnd.uniform(1.0, 2.6)
        pygame.draw.circle(s, (*SANGRE, 220), (c + rnd.uniform(-0.45, 0.45) * lado,
                                               lado / 4 + rnd.uniform(-0.2, 0.2) * lado), r)
    pygame.draw.ellipse(s, (*SANGRE_VIVA, 90), (c - lado * 0.18, lado / 4 - lado * 0.06, lado * 0.3, lado * 0.1))
    return s


def _salpicadura(semilla=0, lado=40):
    """Manchas sueltas alrededor de un punto (sangre esparcida por una explosión)."""
    rnd = random.Random(semilla)
    s = pygame.Surface((lado, lado // 2), pygame.SRCALPHA)
    for _ in range(26):
        a = rnd.uniform(0, 2 * math.pi)
        d = rnd.uniform(0.05, 0.48) * lado
        r = rnd.uniform(0.6, 2.2) * (1.4 - d / lado)
        pygame.draw.circle(s, (*SANGRE, 225), (lado / 2 + math.cos(a) * d, lado / 4 + math.sin(a) * d * 0.45), r)
    return s


def _trozo(forma, color):
    """Pedazo de un cuerpo despedazado: miembro, jirón de uniforme o hueso."""
    s = pygame.Surface((10, 8), pygame.SRCALPHA)
    if forma == 0:      # miembro con manga
        pygame.draw.line(s, color, (1, 5), (7, 3), 3)
        pygame.draw.circle(s, PIEL_TROZO, (8, 3), 1.6)
        pygame.draw.circle(s, SANGRE_VIVA, (1, 5), 1.5)
    elif forma == 1:    # jirón de casaca
        pygame.draw.polygon(s, color, [(1, 2), (8, 1), (7, 6), (2, 7)])
        pygame.draw.circle(s, SANGRE, (4, 4), 1.4)
    else:               # hueso y carne
        pygame.draw.line(s, HUESO, (2, 4), (8, 4), 2)
        pygame.draw.circle(s, SANGRE_VIVA, (5, 4), 2)
    return s


def _crater():
    s = pygame.Surface((48, 30), pygame.SRCALPHA)
    pygame.draw.ellipse(s, (60, 44, 32, 120), (2, 2, 44, 26))
    pygame.draw.ellipse(s, (40, 30, 22, 140), (10, 7, 28, 16))
    return s


class Particula:
    __slots__ = ("tipo", "x", "y", "z", "vx", "vy", "vz", "t", "vida", "tam", "crece", "color", "alpha",
                 "tex", "giro")

    def __init__(self, tipo, x, y, vida, tam, color, vx=0.0, vy=0.0, vz=0.0, z=0.0, crece=0.0, alpha=255,
                 tex=None, giro=0.0):
        self.tipo = tipo
        self.x = x
        self.y = y
        self.z = z
        self.vx = vx
        self.vy = vy
        self.vz = vz
        self.t = 0.0
        self.vida = vida
        self.tam = tam
        self.crece = crece
        self.color = color
        self.alpha = alpha
        self.tex = tex          # textura propia (pedazos de un cuerpo)
        self.giro = giro        # grados por segundo mientras vuela


class Proyectil:
    __slots__ = ("x0", "y0", "x1", "y1", "t", "dur", "tipo", "altura")

    def __init__(self, x0, y0, x1, y1, dur, tipo):
        self.x0, self.y0, self.x1, self.y1 = x0, y0, x1, y1
        self.t = 0.0
        self.dur = dur
        self.tipo = tipo
        dist = math.hypot(x1 - x0, y1 - y0)
        self.altura = min(160.0, 0.25 * dist) if tipo in ("explosivo", "dinamita") else 0.08 * dist


class Marca:
    """Marca en el suelo: cráter, caído o sangre; se desvanece. Con 'crece' (segundos) se
    extiende desde el centro, como un charco que se agranda."""
    __slots__ = ("tex", "x", "y", "w", "h", "t", "vida", "espejo", "crece", "angulo")

    def __init__(self, tex, x, y, w, h, vida, espejo=False, crece=0.0, angulo=0.0):
        self.tex = tex
        self.x, self.y, self.w, self.h = x, y, w, h
        self.t = 0.0
        self.vida = vida
        self.espejo = espejo
        self.crece = crece
        self.angulo = angulo


class Efectos:
    MAX = 2500

    def __init__(self, lz):
        self.lz = lz
        self.p = []
        self.proyectiles = []
        self.marcas = []
        self.rnd = random.Random(5)
        self.sangre = True       # Opciones → «Sangre en las bajas»
        self.t_charcos = [lz.textura(("efx", "charco", k), lambda k=k: _charco(k)) for k in range(4)]
        self.t_salpicaduras = [lz.textura(("efx", "salpicadura", k), lambda k=k: _salpicadura(k)) for k in range(3)]
        self.t_bocanada = lz.textura(("efx", "bocanada"), _bocanada)
        self.t_chispa = lz.textura(("efx", "chispa"), _chispa)
        self.t_cruz = lz.textura(("efx", "cruz"), _cruz)
        from .iconos import signo_peso
        self.t_peso = lz.textura(("efx", "peso"), signo_peso)
        self.t_crater = lz.textura(("efx", "crater"), _crater)
        self.viento = (6.0, -2.0)

    # -- emisores ------------------------------------------------------------
    def _agregar(self, p):
        if len(self.p) < self.MAX:
            self.p.append(p)

    def disparo(self, x, y, dx, dy, tipo="fusil"):
        """Fogonazo y bocanada de humo blanco de pólvora negra en la boca del arma."""
        d = math.hypot(dx, dy) or 1.0
        ux, uy = dx / d, dy / d
        bx, by = x + ux * 10, y + uy * 6 - 10
        grande = tipo in ("explosivo", "canon_naval")
        self._agregar(Particula(TIPO_FOGONAZO, bx, by, 0.08 if not grande else 0.14, 10 if not grande else 22,
                                (255, 236, 170)))
        n = 2 if tipo in ("fusil", "metralla") else 6
        for _ in range(n):
            r = self.rnd
            tam = (9 if not grande else 22) * r.uniform(0.7, 1.2)
            self._agregar(Particula(TIPO_HUMO, bx + r.uniform(-3, 3), by + r.uniform(-3, 3),
                                    r.uniform(1.4, 2.4) * (2 if grande else 1), tam, (240, 238, 232),
                                    vx=ux * 14 + r.uniform(-4, 4), vy=uy * 8 + r.uniform(-4, 4),
                                    crece=tam * 1.4, alpha=150 if not grande else 190))

    def impacto(self, x, y):
        r = self.rnd
        for _ in range(2):
            self._agregar(Particula(TIPO_POLVO, x + r.uniform(-4, 4), y + r.uniform(-3, 3), 0.5, 5,
                                    (200, 176, 136), vy=-6, crece=6, alpha=150))

    def explosion(self, x, y, radio=24, tipo="explosivo"):
        r = self.rnd
        self._agregar(Particula(TIPO_FOGONAZO, x, y - 6, 0.16, radio * 1.6, (255, 220, 140)))
        for _ in range(int(6 + radio / 3)):
            a = r.uniform(0, 2 * math.pi)
            v = r.uniform(20, 70)
            self._agregar(Particula(TIPO_FUEGO, x, y - 4, r.uniform(0.25, 0.5), r.uniform(6, 12), (255, 150, 50),
                                    vx=math.cos(a) * v, vy=math.sin(a) * v * 0.6, crece=8))
        for _ in range(int(8 + radio / 2)):
            a = r.uniform(0, 2 * math.pi)
            v = r.uniform(5, 30)
            tam = r.uniform(12, 24) * radio / 24
            self._agregar(Particula(TIPO_HUMO, x + math.cos(a) * radio * 0.4, y + math.sin(a) * radio * 0.3,
                                    r.uniform(1.8, 3.4), tam, (120, 106, 92), vx=math.cos(a) * v,
                                    vy=math.sin(a) * v * 0.6 - 6, crece=tam, alpha=200))
        for _ in range(10):
            a = r.uniform(0, 2 * math.pi)
            v = r.uniform(40, 110)
            self._agregar(Particula(TIPO_CHISPA, x, y, r.uniform(0.4, 0.8), 3, (110, 90, 70),
                                    vx=math.cos(a) * v, vy=math.sin(a) * v * 0.5, vz=r.uniform(60, 140)))
        self.marcas.append(Marca(self.t_crater, x - radio, y - radio * 0.6, radio * 2, radio * 1.25, 40.0))
        if len(self.marcas) > 300:
            del self.marcas[:50]

    def humo_incendio(self, x, y, fuego=False):
        r = self.rnd
        self._agregar(Particula(TIPO_HUMO, x + r.uniform(-6, 6), y, r.uniform(2.0, 3.2), r.uniform(8, 14),
                                (70, 62, 56), vx=r.uniform(-2, 2) + 4, vy=-r.uniform(10, 20), crece=18, alpha=170))
        if fuego:
            self._agregar(Particula(TIPO_FUEGO, x + r.uniform(-5, 5), y + 4, 0.4, r.uniform(5, 9),
                                    (255, 140, 40), vy=-20, crece=-6))

    def humo_chimenea(self, x, y):
        r = self.rnd
        self._agregar(Particula(TIPO_HUMO, x, y, r.uniform(2.4, 3.6), 6, (180, 176, 170), vx=6, vy=-14,
                                crece=16, alpha=120))

    def curacion(self, x, y):
        r = self.rnd
        self._agregar(Particula(TIPO_CRUZ, x + r.uniform(-6, 6), y - r.uniform(6, 16), 0.9, 7, (90, 230, 90),
                                vy=-14))

    def venta(self, x, y):
        """Signo $ dorado que sube del cuartel general al vender el salitre."""
        r = self.rnd
        self._agregar(Particula(TIPO_DINERO, x + r.uniform(-14, 14), y - r.uniform(0, 8), 1.3, 18, DORADO,
                                vy=-22))

    def polvo_obra(self, x, y):
        r = self.rnd
        self._agregar(Particula(TIPO_POLVO, x + r.uniform(-10, 10), y + r.uniform(-4, 4), 0.8, 6,
                                (210, 190, 150), vy=-8, crece=10, alpha=140))

    def polvo_marcha(self, x, y):
        r = self.rnd
        self._agregar(Particula(TIPO_POLVO, x + r.uniform(-4, 4), y + r.uniform(-1, 2), 0.7, 4,
                                (206, 182, 140), vy=-3, crece=7, alpha=90))

    # -- sangre ----------------------------------------------------------------
    def _marca(self, m):
        self.marcas.append(m)
        if len(self.marcas) > 400:
            del self.marcas[:60]

    def charco(self, x, y, tam=1.0, vida=30.0):
        """Charco que se agranda debajo de un caído o de un herido."""
        if not self.sangre:
            return
        t = self.t_charcos[self.rnd.randrange(len(self.t_charcos))]
        w, h = 30 * tam, 15 * tam
        self._marca(Marca(t, x - w / 2, y - h / 2, w, h, vida, self.rnd.random() < 0.5, crece=2.5))

    def herida(self, x, y, fuerza=1.0):
        """Salpicadura de sangre al recibir el balazo o el sablazo que lo derriba."""
        if not self.sangre:
            return
        r = self.rnd
        for _ in range(int(7 * fuerza)):
            a = r.uniform(0, 2 * math.pi)
            v = r.uniform(12, 40) * fuerza
            self._agregar(Particula(TIPO_GOTA, x, y, r.uniform(0.4, 0.8), r.uniform(1.4, 2.4), SANGRE_VIVA,
                                    vx=math.cos(a) * v, vy=math.sin(a) * v * 0.5, vz=r.uniform(30, 80), z=10))

    def despedazar(self, x, y, colores):
        """Muerte por artillería, dinamita o mina: el cuerpo vuela en pedazos."""
        if not self.sangre:
            return
        r = self.rnd
        texs = [self.lz.textura(("efx", "trozo", f, c), lambda f=f, c=c: _trozo(f, c))
                for f in range(3) for c in colores[:2]]
        for k in range(9):
            a = r.uniform(0, 2 * math.pi)
            v = r.uniform(30, 90)
            self._agregar(Particula(TIPO_TROZO, x, y, 3.0, 8, (255, 255, 255),
                                    vx=math.cos(a) * v, vy=math.sin(a) * v * 0.55, vz=r.uniform(80, 170), z=8,
                                    tex=texs[k % len(texs)], giro=r.uniform(-400, 400)))
        for _ in range(14):
            a = r.uniform(0, 2 * math.pi)
            v = r.uniform(20, 70)
            self._agregar(Particula(TIPO_GOTA, x, y, r.uniform(0.5, 0.9), r.uniform(1.6, 2.8), SANGRE_VIVA,
                                    vx=math.cos(a) * v, vy=math.sin(a) * v * 0.5, vz=r.uniform(40, 120), z=8))
        for _ in range(5):
            self._agregar(Particula(TIPO_HUMO, x + r.uniform(-6, 6), y - r.uniform(4, 12), r.uniform(0.6, 1.0),
                                    r.uniform(8, 13), (150, 26, 24), vy=-6, crece=14, alpha=150))
        t = self.t_salpicaduras[r.randrange(len(self.t_salpicaduras))]
        self._marca(Marca(t, x - 24, y - 12, 48, 24, 45.0, r.random() < 0.5))

    def lanzar(self, x0, y0, x1, y1, dur, tipo):
        self.proyectiles.append(Proyectil(x0, y0, x1, y1, dur, tipo))

    def caido(self, tex, x, y, espejo):
        self.marcas.append(Marca(tex, x - tex.width / 2, y - tex.height / 2, tex.width, tex.height, 30.0, espejo))

    # ------------------------------------------------------------------
    def actualizar(self, dt):
        vx, vy = self.viento
        vivos = []
        for p in self.p:
            p.t += dt
            if p.t >= p.vida:
                continue
            p.x += (p.vx + (vx if p.tipo == TIPO_HUMO else 0)) * dt
            p.y += (p.vy + (vy if p.tipo == TIPO_HUMO else 0)) * dt
            if p.tipo == TIPO_HUMO:
                p.vx *= 0.96
                p.vy *= 0.96
            if p.tipo in (TIPO_CHISPA, TIPO_GOTA, TIPO_TROZO):
                p.z += p.vz * dt
                p.vz -= 260 * dt
                if p.z < 0:
                    p.z = 0
                    p.vz = 0
                    p.vx *= 0.5 if p.tipo == TIPO_CHISPA else 0.0
                    p.vy *= 0.5 if p.tipo == TIPO_CHISPA else 0.0
                    if p.tipo == TIPO_GOTA and p.t < p.vida - 0.05:
                        # la gota cae y queda como mancha
                        t = self.t_salpicaduras[int(p.x + p.y) % len(self.t_salpicaduras)]
                        self._marca(Marca(t, p.x - 4, p.y - 2, 8, 4, 30.0))
                        p.t = p.vida
                    elif p.tipo == TIPO_TROZO:
                        # el pedazo queda en el suelo
                        self._marca(Marca(p.tex, p.x - 5, p.y - 4, 10, 8, 40.0, angulo=(p.t * p.giro) % 360))
                        p.t = p.vida
            p.tam = max(0.5, p.tam + p.crece * dt)
            vivos.append(p)
        self.p = vivos
        quedan = []
        for pr in self.proyectiles:
            pr.t += dt
            if pr.t < pr.dur:
                quedan.append(pr)
        self.proyectiles = quedan
        for m in self.marcas:
            m.t += dt
        self.marcas = [m for m in self.marcas if m.t < m.vida]

    def dibujar_marcas(self, lz, cam):
        for m in self.marcas:
            sx, sy = cam.a_pantalla(m.x, m.y)
            z = cam.zoom
            if not cam.visible_rect(sx, sy, m.w * z, m.h * z):
                continue
            a = 255 if m.t < m.vida - 5 else int(255 * (m.vida - m.t) / 5)
            if m.crece and m.t < m.crece:
                f = 0.25 + 0.75 * m.t / m.crece
                w, h = m.w * f, m.h * f
                lz.dibujar(m.tex, sx + (m.w - w) * z / 2, sy + (m.h - h) * z / 2, w * z, h * z,
                           alpha=max(0, a), espejo=m.espejo)
                continue
            lz.dibujar(m.tex, sx, sy, m.w * z, m.h * z, alpha=max(0, a), espejo=m.espejo, angulo=m.angulo)

    def dibujar(self, lz, cam):
        z = cam.zoom
        for pr in self.proyectiles:
            f = pr.t / pr.dur
            x = pr.x0 + (pr.x1 - pr.x0) * f
            y = pr.y0 + (pr.y1 - pr.y0) * f
            h = 4 * pr.altura * f * (1 - f)
            sx, sy = cam.a_pantalla(x, y)
            if not cam.visible_rect(sx - 10, sy - h * z - 10, 20, 20 + h * z):
                continue
            lz.dibujar(self.t_bocanada, sx - 3 * z, sy - 2 * z, 6 * z, 4 * z, alpha=90, color=(0, 0, 0))
            if pr.tipo == "dinamita":
                lz.dibujar(self.t_chispa, sx - 4 * z, sy - h * z - 4 * z, 8 * z, 8 * z, color=(255, 200, 80))
                lz.rect((sx - 1, sy - h * z - 3, 3, 5), (190, 40, 30))
            else:
                lz.dibujar(self.t_chispa, sx - 3 * z, sy - h * z - 3 * z, 6 * z, 6 * z, color=(40, 40, 40))
        for p in self.p:
            sx, sy = cam.a_pantalla(p.x, p.y - p.z)
            tam = p.tam * z
            if not cam.visible_rect(sx - tam, sy - tam, tam * 2, tam * 2):
                continue
            f = p.t / p.vida
            if p.tipo == TIPO_HUMO or p.tipo == TIPO_POLVO:
                a = int(p.alpha * (1 - f) * min(1.0, p.t * 8))
                lz.dibujar(self.t_bocanada, sx - tam, sy - tam, tam * 2, tam * 2, alpha=a, color=p.color)
            elif p.tipo == TIPO_FOGONAZO or p.tipo == TIPO_FUEGO:
                a = int(255 * (1 - f))
                lz.dibujar(self.t_chispa, sx - tam, sy - tam, tam * 2, tam * 2, alpha=a, color=p.color)
            elif p.tipo == TIPO_CRUZ:
                lz.dibujar(self.t_cruz, sx - tam / 2, sy - tam / 2, tam, tam, alpha=int(255 * (1 - f)), color=p.color)
            elif p.tipo == TIPO_DINERO:
                t = self.t_peso
                alto = tam * 1.1
                ancho = alto * t.width / t.height
                a = int(255 * min(1.0, (1 - f) * 2.5))
                lz.dibujar(t, sx - ancho / 2, sy - alto / 2, ancho, alto, alpha=a, color=p.color)
            elif p.tipo == TIPO_CHISPA:
                lz.rect((sx, sy, max(1, int(2 * z)), max(1, int(2 * z))), p.color, int(255 * (1 - f)))
            elif p.tipo == TIPO_GOTA:
                lado = max(1.0, p.tam * z)
                lz.rect((sx, sy, lado, lado), p.color, 230)
            elif p.tipo == TIPO_TROZO:
                lz.dibujar(p.tex, sx - 5 * z, sy - 4 * z, 10 * z, 8 * z, angulo=(p.t * p.giro) % 360)
