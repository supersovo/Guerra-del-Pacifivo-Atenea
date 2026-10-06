"""Edificios dibujados por código en perspectiva 3/4 (muro al frente, techo arriba).

El lienzo de cada edificio cubre su huella (ancho x alto en casillas de 32 px)
más un margen superior ALTO para la altura de los muros y techos. Si en
recursos/graficos/edificios/ hay un PNG con el id del edificio, se usa ese.
"""

import math

import pygame

from .banderas import superficie_bandera
from .sprites import Pintor, claro, oscuro

T = 32
ALTO = 44
MARGEN = 4

ADOBE = (206, 178, 140)
ADOBE_OSC = (168, 138, 104)
TEJA = (164, 76, 52)
CALAMINA = (146, 150, 154)
MADERA = (128, 92, 60)
MADERA_OSC = (84, 58, 36)
PIEDRA = (150, 140, 128)
LONA = (232, 226, 210)
SACO = (196, 176, 130)


def caja(p, x, y, w, d, alto, muro, techo, tipo_techo="plano"):
    """Caja vista en 3/4: huella (x, y, w, d) en el suelo y 'alto' de muro."""
    p.rect(x, y + d - alto, w, alto, oscuro(muro, 0.82))
    p.rect(x, y - alto, w, d, techo)
    if tipo_techo == "dos_aguas":
        p.rect(x, y - alto, w, d / 2, claro(techo, 0.12))
        p.linea(x, y - alto + d / 2, x + w, y - alto + d / 2, oscuro(techo, 0.7), 0.8)
    elif tipo_techo == "calamina":
        for k in range(int(w // 3)):
            p.linea(x + 1.5 + k * 3, y - alto + 0.5, x + 1.5 + k * 3, y - alto + d - 0.5, oscuro(techo, 0.85), 0.5)
    elif tipo_techo == "tejas":
        for k in range(int(d // 2.5)):
            p.linea(x + 0.5, y - alto + 1.2 + k * 2.5, x + w - 0.5, y - alto + 1.2 + k * 2.5, oscuro(techo, 0.82), 0.5)
    p.linea(x, y + d - alto, x + w, y + d - alto, oscuro(techo, 0.6), 0.8)


def ventanas(p, x, y, w, n, alto=4, color=(54, 40, 30)):
    paso = w / (n + 1)
    for k in range(n):
        p.rect(x + paso * (k + 1) - 1.6, y, 3.2, alto, color)


def bandera_en_mastil(p, x, y, alto, nacion, color_jugador):
    p.linea(x, y, x, y - alto, (70, 54, 40), 0.9)
    b = superficie_bandera(nacion, 36, 24)
    k = p.k
    b = pygame.transform.smoothscale(b, (int(12 * k), int(8 * k)))
    p.s.blit(b, ((x + 0.5) * k, (y - alto) * k))
    p.poli([(x, y - alto + 9), (x + 6, y - alto + 10.5), (x, y - alto + 12)], color_jugador)


def dibujar_edificio(tipo, nacion, color_jugador):
    w, h = tipo.ancho, tipo.alto
    W = w * T + 2 * MARGEN
    H = h * T + ALTO
    p = Pintor(W, H)
    x0, y0 = MARGEN, ALTO
    fw, fh = w * T, h * T
    forma = tipo.sprite.get("forma", tipo.id)
    # sombra y suelo apisonado
    p.elipse(x0 - 2, y0 + fh * 0.35, fw + 4, fh * 0.75, (40, 30, 20, 70))
    p.rect(x0 + 1, y0 + 2, fw - 2, fh - 3, (170, 148, 112), 3)
    if forma == "cuartel_general":
        caja(p, x0 + 6, y0 + 10, fw - 12, fh - 22, 20, ADOBE, TEJA, "tejas")
        ventanas(p, x0 + 6, y0 + fh - 28, fw - 12, 6, 6)
        p.rect(x0 + fw / 2 - 5, y0 + fh - 22, 10, 10, MADERA_OSC)
        caja(p, x0 + fw / 2 - 10, y0 + 4, 20, 18, 34, claro(ADOBE, 0.1), TEJA, "tejas")
        ventanas(p, x0 + fw / 2 - 10, y0 - 2, 20, 2, 5)
        bandera_en_mastil(p, x0 + fw / 2, y0 - 30, 22, nacion, color_jugador)
        p.rect(x0 + 2, y0 + fh - 9, 6, 6, (90, 80, 70))
        p.rect(x0 + fw - 8, y0 + fh - 9, 6, 6, (90, 80, 70))
    elif forma == "deposito":
        p.poli([(x0 + 3, y0 + fh - 6), (x0 + fw / 2, y0 - 6), (x0 + fw - 3, y0 + fh - 6)], LONA)
        p.poli([(x0 + fw / 2, y0 - 6), (x0 + fw - 3, y0 + fh - 6), (x0 + fw / 2 + 4, y0 + fh - 6)], oscuro(LONA, 0.85))
        p.rect(x0 + fw / 2 - 4, y0 + fh - 18, 8, 12, (70, 56, 40))
        for k in range(3):
            p.rect(x0 + 4 + k * 8, y0 + fh - 12, 7, 7, MADERA)
            p.linea(x0 + 4 + k * 8, y0 + fh - 12, x0 + 11 + k * 8, y0 + fh - 5, MADERA_OSC, 0.5)
        p.elipse(x0 + fw - 14, y0 + fh - 14, 8, 10, (110, 76, 46))
        p.linea(x0 + fw - 14, y0 + fh - 9, x0 + fw - 6, y0 + fh - 9, (60, 40, 26), 0.6)
        p.poli([(x0 + fw / 2, y0 - 6), (x0 + fw / 2 + 8, y0 - 3), (x0 + fw / 2, y0)], color_jugador)
    elif forma == "molino":
        p.elipse(x0 + 8, y0 + 18, fw - 16, fh - 26, PIEDRA)
        p.elipse(x0 + 12, y0 + 22, fw - 24, fh - 34, (70, 130, 190))
        cx = x0 + fw / 2
        for dx in (-9, 9):
            p.linea(cx + dx, y0 + fh - 8, cx + dx * 0.25, y0 - 30, (90, 80, 70), 1.2)
        for k in range(5):
            yy = y0 + fh - 12 - k * 11
            p.linea(cx - 9 + k * 1.7, yy, cx + 9 - k * 1.7, yy, (90, 80, 70), 0.7)
        p.rect(cx - 3, y0 - 34, 6, 6, (110, 100, 90))
        p.poli([(cx + 3, y0 - 32), (cx + 14, y0 - 36), (cx + 14, y0 - 28)], (200, 60, 40))
    elif forma == "barracas":
        caja(p, x0 + 3, y0 + 12, fw - 6, fh - 20, 18, (190, 170, 140), CALAMINA, "calamina")
        ventanas(p, x0 + 3, y0 + fh - 24, fw - 6, 5, 5)
        p.rect(x0 + fw / 2 - 4, y0 + fh - 20, 8, 12, MADERA_OSC)
        bandera_en_mastil(p, x0 + fw - 8, y0 + 4, 26, nacion, color_jugador)
        for k in range(4):
            p.linea(x0 + 6 + k * 3, y0 + fh - 6, x0 + 7 + k * 3, y0 + fh - 16, (60, 50, 40), 0.7)
    elif forma == "maestranza":
        caja(p, x0 + 4, y0 + 14, fw - 8, fh - 22, 18, (150, 120, 96), CALAMINA, "calamina")
        p.rect(x0 + 12, y0 + fh - 22, 22, 14, (40, 30, 24))
        p.circ(x0 + 23, y0 + fh - 15, 3, (230, 120, 40))
        p.rect(x0 + fw - 20, y0 - 22, 8, 40, (150, 80, 60))
        p.rect(x0 + fw - 21, y0 - 24, 10, 3, (110, 60, 46))
        p.rect(x0 + fw - 34, y0 + fh - 12, 10, 4, (60, 60, 64))
        p.rect(x0 + fw - 31, y0 + fh - 8, 4, 4, (60, 60, 64))
        bandera_en_mastil(p, x0 + 6, y0 + 6, 22, nacion, color_jugador)
    elif forma == "hospital":
        for k, cx in enumerate((x0 + fw * 0.3, x0 + fw * 0.72)):
            p.poli([(cx - 15, y0 + fh - 8), (cx, y0 + 2), (cx + 15, y0 + fh - 8)], LONA)
            p.poli([(cx, y0 + 2), (cx + 15, y0 + fh - 8), (cx + 4, y0 + fh - 8)], oscuro(LONA, 0.86))
            p.rect(cx - 3, y0 + fh - 18, 6, 10, (90, 80, 70))
        p.linea(x0 + fw / 2, y0 + fh - 6, x0 + fw / 2, y0 - 24, (80, 64, 50), 0.9)
        p.rect(x0 + fw / 2 + 0.5, y0 - 24, 12, 8, (250, 250, 250))
        p.rect(x0 + fw / 2 + 5.2, y0 - 23, 2.6, 6, (210, 30, 30))
        p.rect(x0 + fw / 2 + 2.5, y0 - 21.3, 8, 2.6, (210, 30, 30))
        p.poli([(x0 + fw / 2, y0 - 14), (x0 + fw / 2 + 7, y0 - 12), (x0 + fw / 2, y0 - 10)], color_jugador)
    elif forma == "trinchera":
        p.rect(x0 + 6, y0 + 10, fw - 12, fh - 22, (110, 90, 66), 2)
        for fila, yy in enumerate((y0 + 4, y0 + fh - 14)):
            for k in range(int((fw - 8) // 7)):
                p.elipse(x0 + 4 + k * 7 + (fila * 3), yy, 8, 5, SACO)
                p.elipse(x0 + 4 + k * 7 + (fila * 3), yy - 3, 8, 5, claro(SACO, 0.1))
        for yy in range(int(y0 + 8), int(y0 + fh - 14), 6):
            p.elipse(x0 + 2, yy, 6, 5, SACO)
            p.elipse(x0 + fw - 8, yy, 6, 5, SACO)
        p.poli([(x0 + fw - 6, y0 - 6), (x0 + fw + 1, y0 - 4), (x0 + fw - 6, y0 - 2)], color_jugador)
        p.linea(x0 + fw - 6, y0 + 4, x0 + fw - 6, y0 - 6, (70, 54, 40), 0.7)
    elif forma == "reducto":
        p.elipse(x0, y0 + 2, fw, fh - 4, (150, 126, 92))
        p.elipse(x0 + 6, y0 + 8, fw - 12, fh - 16, (176, 152, 114))
        p.rect(x0 + fw / 2 - 2, y0 + fh / 2 - 6, 4, 6, (50, 50, 54))
        p.linea(x0 + fw / 2, y0 + fh / 2 - 4, x0 + fw / 2 + 12, y0 + fh / 2 - 10, (52, 56, 62), 3)
        p.circ(x0 + fw / 2 - 2, y0 + fh / 2, 4, (80, 60, 40), 1)
        bandera_en_mastil(p, x0 + 6, y0 + 8, 22, nacion, color_jugador)
    elif forma == "barracon":
        caja(p, x0 + 3, y0 + 4, fw * 0.62, fh - 16, 18, ADOBE, TEJA, "tejas")
        ventanas(p, x0 + 3, y0 + fh - 28, fw * 0.62, 3, 5)
        for k in range(2):
            cx, cy = x0 + fw - 12, y0 + 12 + k * 26
            p.linea(cx, cy + 8, cx, cy - 4, MADERA_OSC, 1)
            p.circ(cx, cy - 6, 5, (240, 236, 222))
            p.circ(cx, cy - 6, 3, (200, 40, 30))
            p.circ(cx, cy - 6, 1.2, (240, 236, 222))
        bandera_en_mastil(p, x0 + 8, y0 + 2, 20, nacion, color_jugador)
    elif forma == "caballeriza":
        caja(p, x0 + 4, y0 + 8, fw * 0.7, fh - 18, 20, (150, 76, 52), (110, 80, 56), "dos_aguas")
        p.rect(x0 + 20, y0 + fh - 30, 16, 20, MADERA_OSC)
        p.linea(x0 + 20, y0 + fh - 30, x0 + 36, y0 + fh - 10, (190, 170, 130), 0.6)
        p.linea(x0 + 36, y0 + fh - 30, x0 + 20, y0 + fh - 10, (190, 170, 130), 0.6)
        for k in range(3):
            p.elipse(x0 + fw * 0.76 + (k % 2) * 8, y0 + 16 + k * 14, 12, 9, (222, 196, 110))
        for xx in range(int(x0 + 2), int(x0 + fw - 2), 8):
            p.linea(xx, y0 + fh - 3, xx, y0 + fh - 10, MADERA, 0.8)
        p.linea(x0 + 2, y0 + fh - 8, x0 + fw - 2, y0 + fh - 8, MADERA, 0.8)
        bandera_en_mastil(p, x0 + fw - 6, y0 + fh - 10, 26, nacion, color_jugador)
    elif forma == "telegrafos":
        caja(p, x0 + 4, y0 + 12, fw - 22, fh - 20, 18, (220, 210, 190), TEJA, "tejas")
        ventanas(p, x0 + 4, y0 + fh - 24, fw - 22, 3, 5)
        px = x0 + fw - 8
        p.linea(px, y0 + fh - 6, px, y0 - 34, (90, 66, 44), 1.4)
        for k in range(3):
            p.linea(px - 6, y0 - 30 + k * 4, px + 6, y0 - 30 + k * 4, (90, 66, 44), 0.8)
            p.circ(px - 5, y0 - 31 + k * 4, 0.9, (240, 240, 240))
            p.circ(px + 5, y0 - 31 + k * 4, 0.9, (240, 240, 240))
        for k in range(3):
            p.linea(px - 5, y0 - 31 + k * 4, x0 - 2, y0 - 20 + k * 6, (40, 36, 30), 0.4)
        p.rect(x0 + 10, y0 - 4, 30, 6, (60, 40, 26))
        bandera_en_mastil(p, x0 + 6, y0 - 2, 18, nacion, color_jugador)
    elif forma == "parque_artilleria":
        caja(p, x0 + 4, y0 + 2, fw - 8, fh * 0.45, 22, (140, 110, 80), CALAMINA, "calamina")
        for k in range(3):
            cx = x0 + 22 + k * 30
            cy = y0 + fh - 18
            p.circ(cx, cy, 5, (70, 50, 34), 1)
            p.linea(cx - 3, cy - 2, cx + 13, cy - 5, (52, 56, 62), 2.4)
            p.linea(cx, cy, cx - 12, cy + 4, (96, 70, 46), 1.6)
        for k in range(6):
            p.circ(x0 + fw - 12 + (k % 3) * 3, y0 + fh - 8 - (k // 3) * 3, 1.6, (40, 40, 44))
        bandera_en_mastil(p, x0 + 8, y0 + fh - 8, 28, nacion, color_jugador)
    elif forma == "estado_mayor":
        caja(p, x0 + 4, y0 + 10, fw - 8, fh - 18, 24, (232, 222, 200), (140, 70, 54), "tejas")
        for k in range(5):
            xx = x0 + 10 + k * (fw - 20) / 4
            p.rect(xx - 1.5, y0 + fh - 32, 3, 22, (250, 246, 236))
        p.rect(x0 + 4, y0 + fh - 34, fw - 8, 3, (200, 190, 170))
        p.rect(x0 + fw / 2 - 4, y0 + fh - 22, 8, 14, MADERA_OSC)
        bandera_en_mastil(p, x0 + fw * 0.3, y0 - 8, 22, nacion, color_jugador)
        bandera_en_mastil(p, x0 + fw * 0.7, y0 - 8, 22, nacion, color_jugador)
    elif forma == "muelle":
        p.rect(x0 + 2, y0 + 6, fw - 4, fh - 12, (140, 104, 70))
        for k in range(int((fw - 4) // 5)):
            p.linea(x0 + 2 + k * 5, y0 + 6, x0 + 2 + k * 5, y0 + fh - 6, (110, 80, 54), 0.5)
        for xx in (x0 + 4, x0 + fw - 6):
            for yy in (y0 + 8, y0 + fh - 8):
                p.circ(xx, yy, 2, MADERA_OSC)
        p.linea(x0 + 14, y0 + fh - 10, x0 + 14, y0 - 22, MADERA_OSC, 1.6)
        p.linea(x0 + 14, y0 - 22, x0 + 44, y0 - 4, MADERA_OSC, 1.2)
        p.linea(x0 + 44, y0 - 4, x0 + 44, y0 + 10, (60, 50, 40), 0.5)
        p.rect(x0 + 40, y0 + 10, 8, 6, MADERA)
        for k in range(3):
            p.rect(x0 + fw - 30 + k * 8, y0 + fh - 22, 7, 7, MADERA)
        bandera_en_mastil(p, x0 + fw - 8, y0 + 8, 24, nacion, color_jugador)
    elif forma == "fortin":
        for xx in range(int(x0 + 2), int(x0 + fw - 1), 4):
            p.rect(xx, y0 + 2, 3.4, 10, MADERA)
            p.rect(xx, y0 + fh - 14, 3.4, 12, MADERA)
            p.poli([(xx, y0 + 2), (xx + 1.7, y0 - 1), (xx + 3.4, y0 + 2)], MADERA)
        for yy in range(int(y0 + 4), int(y0 + fh - 12), 4):
            p.rect(x0 + 2, yy, 3.4, 8, MADERA_OSC)
            p.rect(x0 + fw - 6, yy, 3.4, 8, MADERA_OSC)
        cx = x0 + fw / 2
        for dx in (-5, 5):
            p.linea(cx + dx, y0 + fh / 2 + 6, cx + dx * 0.6, y0 - 26, MADERA_OSC, 1.1)
        p.rect(cx - 7, y0 - 30, 14, 5, MADERA)
        p.rect(cx - 6, y0 - 36, 12, 6, (210, 190, 150))
        bandera_en_mastil(p, cx + 6, y0 - 34, 14, nacion, color_jugador)
    else:
        caja(p, x0 + 4, y0 + 8, fw - 8, fh - 16, 18, ADOBE, TEJA, "tejas")
        bandera_en_mastil(p, x0 + fw / 2, y0, 20, nacion, color_jugador)
    return p.resultado()


def aspas(radio=15):
    """Aspas del molino (se dibujan aparte para hacerlas girar)."""
    k = 3
    s = pygame.Surface((radio * 2 * k, radio * 2 * k), pygame.SRCALPHA)
    c = radio * k
    for i in range(6):
        a = i * math.pi / 3
        x1 = c + math.cos(a) * radio * k * 0.95
        y1 = c + math.sin(a) * radio * k * 0.95
        pygame.draw.line(s, (90, 70, 50), (c, c), (x1, y1), 2 * k // 2)
        b = a + 0.32
        x2 = c + math.cos(b) * radio * k * 0.9
        y2 = c + math.sin(b) * radio * k * 0.9
        pygame.draw.polygon(s, (230, 222, 200), [(c + math.cos(a) * radio * k * 0.3, c + math.sin(a) * radio * k * 0.3),
                                                 (x1, y1), (x2, y2),
                                                 (c + math.cos(b) * radio * k * 0.3, c + math.sin(b) * radio * k * 0.3)])
    pygame.draw.circle(s, (70, 56, 44), (c, c), 2 * k)
    return pygame.transform.smoothscale(s, (radio * 2, radio * 2))


def andamio(w, h):
    """Andamiaje de una obra en construcción."""
    W = w * T + 2 * MARGEN
    H = h * T + ALTO
    p = Pintor(W, H)
    x0, y0 = MARGEN, ALTO
    fw, fh = w * T, h * T
    p.rect(x0 + 1, y0 + 2, fw - 2, fh - 3, (164, 140, 104), 3)
    for xx in range(int(x0 + 4), int(x0 + fw), 12):
        p.linea(xx, y0 + fh - 4, xx, y0 - 10, (120, 90, 56), 0.9)
    for yy in range(int(y0 - 8), int(y0 + fh), 10):
        p.linea(x0 + 4, yy, x0 + fw - 4, yy, (120, 90, 56), 0.7)
    p.linea(x0 + 4, y0 + fh - 4, x0 + fw - 4, y0 - 8, (110, 80, 50), 0.6)
    return p.resultado()


class Edificios:
    def __init__(self, lz, catalogo):
        self.lz = lz
        self.cat = catalogo
        self.propios = {}
        from ... import rutas
        carpeta = rutas.dir_recursos() / "graficos" / "edificios"
        if carpeta.is_dir():
            for ruta in carpeta.glob("*.png"):
                try:
                    self.propios[ruta.stem] = pygame.image.load(str(ruta)).convert_alpha()
                except pygame.error:
                    pass

    def textura(self, tipo, nacion, color_jugador):
        clave = ("edif", tipo.id, nacion, color_jugador)
        if tipo.id in self.propios:
            return self.lz.textura(clave, lambda: self.propios[tipo.id])
        return self.lz.textura(clave, lambda: dibujar_edificio(tipo, nacion, color_jugador))

    def andamio(self, tipo):
        return self.lz.textura(("andamio", tipo.ancho, tipo.alto), lambda: andamio(tipo.ancho, tipo.alto))

    def aspas(self):
        return self.lz.textura(("aspas",), aspas)
