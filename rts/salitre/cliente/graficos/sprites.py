"""Sprites de las unidades, dibujados por código con los uniformes de cada nación.

Cada figura se pinta al triple de tamaño y se reduce con suavizado (así los
bordes quedan limpios). Vistas: "lado" (mirando a la derecha; a la izquierda
se espeja), "frente" y "espalda". Cuadros: 0 quieto, 1-2 marcha, 3 ataque,
4 trabajo. Los buques se dibujan vistos desde arriba y se rotan en la GPU.

Si en recursos/graficos/unidades/ hay un PNG con el id de la unidad (por
ejemplo infante.png), se usa esa imagen en lugar del dibujo.
"""

import math

import pygame

PIEL = [(222, 184, 150), (196, 150, 112), (168, 120, 86), (140, 98, 68)]
BOTAS = (34, 26, 20)
CUERO = (96, 64, 38)
CUERO_BLANCO = (232, 228, 214)
MADERA_FUSIL = (110, 72, 40)
ACERO = (150, 156, 164)
BRONCE = (184, 140, 70)
PAJA = (222, 196, 120)

TAM = {
    "pie": (30, 38, 15, 35),          # ancho, alto, x de los pies, y de los pies
    "montado": (48, 46, 24, 43),
    "artilleria": (52, 38, 26, 34),
    "buque": (80, 44, 40, 22),
}
FORMA_TAM = {
    "trabajador": "pie", "infante": "pie", "cantinera": "pie", "ingeniero": "pie", "espia": "pie",
    "zapador": "pie", "torpedista": "pie", "montonero": "pie", "colorado": "pie", "heroe_a_pie": "pie",
    "heroina": "pie", "jinete_sable": "montado", "jinete_carabina": "montado", "baqueano": "montado",
    "heroe_montado": "montado", "canon_montana": "artilleria", "canon_campana": "artilleria",
    "gatling": "artilleria", "transporte": "buque", "canonera": "buque", "monitor": "buque", "corbeta": "buque",
}


def oscuro(c, f=0.7):
    return (int(c[0] * f), int(c[1] * f), int(c[2] * f))


def claro(c, f=0.3):
    return (int(c[0] + (255 - c[0]) * f), int(c[1] + (255 - c[1]) * f), int(c[2] + (255 - c[2]) * f))


class Pintor:
    def __init__(self, w, h, k=3):
        self.k = k
        self.w = w
        self.h = h
        self.s = pygame.Surface((w * k, h * k), pygame.SRCALPHA)

    def _p(self, pts):
        k = self.k
        return [(x * k, y * k) for x, y in pts]

    def poli(self, pts, c):
        pygame.draw.polygon(self.s, c, self._p(pts))

    def rect(self, x, y, w, h, c, radio=0):
        k = self.k
        pygame.draw.rect(self.s, c, (round(x * k), round(y * k), max(1, round(w * k)), max(1, round(h * k))),
                         border_radius=int(radio * k))

    def elipse(self, x, y, w, h, c, borde=0):
        k = self.k
        pygame.draw.ellipse(self.s, c, (round(x * k), round(y * k), max(1, round(w * k)), max(1, round(h * k))),
                            int(borde * k))

    def circ(self, x, y, r, c, borde=0):
        k = self.k
        pygame.draw.circle(self.s, c, (round(x * k), round(y * k)), max(1, round(r * k)), int(borde * k))

    def linea(self, x0, y0, x1, y1, c, ancho=1.0):
        k = self.k
        pygame.draw.line(self.s, c, (x0 * k, y0 * k), (x1 * k, y1 * k), max(1, round(ancho * k)))

    def resultado(self):
        return pygame.transform.smoothscale(self.s, (self.w, self.h))


# ----------------------------------------------------------------------
# Figuras a pie
def _ropa(uniforme, color_jugador, especial=None):
    r = {
        "casaca": uniforme.get("casaca", (60, 60, 90)),
        "pantalon": uniforme.get("pantalon", (90, 90, 90)),
        "kepi": uniforme.get("kepi", (120, 40, 40)),
        "franja": uniforme.get("franja", (40, 40, 90)),
        "cubrenuca": uniforme.get("cubrenuca", (230, 226, 210)),
        "detalle": uniforme.get("detalle", (220, 190, 90)),
        "jugador": color_jugador,
        "piel": PIEL[0],
    }
    if especial == "colorado":
        r.update(casaca=(184, 30, 32), pantalon=(236, 234, 226), kepi=(184, 30, 32), franja=(30, 30, 30))
    elif especial == "trabajador":
        r.update(casaca=(70, 86, 118), pantalon=(52, 60, 80), kepi=PAJA, piel=PIEL[1])
    elif especial == "espia":
        r.update(casaca=(62, 56, 50), pantalon=(80, 72, 62), kepi=(40, 36, 32), piel=PIEL[1])
    elif especial == "montonero":
        r.update(casaca=(150, 60, 40), pantalon=(90, 76, 60), kepi=(70, 56, 40), piel=PIEL[2])
    elif especial == "baqueano":
        r.update(casaca=(120, 90, 60), pantalon=(60, 56, 50), kepi=(50, 40, 32), piel=PIEL[2])
    return r


def _cabeza_lado(p, x, y, ropa, sombrero, mirar=1):
    piel = ropa["piel"]
    p.circ(x, y, 2.9, piel)
    p.circ(x + 1.5 * mirar, y - 0.3, 0.45, (40, 30, 20))
    if sombrero == "kepi":
        if ropa.get("cubre", True):
            p.poli([(x - 2.8 * mirar, y - 2), (x - 4.6 * mirar, y + 3.6), (x - 0.8 * mirar, y + 2.6)], ropa["cubrenuca"])
        p.poli([(x - 2.9, y - 1.6), (x + 2.9, y - 1.6), (x + 2.2 * mirar + 0.1, y - 6.4), (x - 2.4, y - 6.0)], ropa["kepi"])
        p.rect(x - 2.9, y - 2.6, 5.8, 1.1, ropa["franja"])
        p.poli([(x + 1.5 * mirar, y - 1.7), (x + 4.6 * mirar, y - 1.1), (x + 1.2 * mirar, y - 0.9)], (24, 20, 16))
    elif sombrero == "paja":
        p.poli([(x - 6.5, y - 1.4), (x, y - 5.8), (x + 6.5, y - 1.4), (x, y - 0.6)], PAJA)
        p.linea(x - 6.2, y - 1.4, x + 6.2, y - 1.4, oscuro(PAJA, 0.75), 0.7)
    elif sombrero == "sombrero":
        p.elipse(x - 5, y - 3.2, 10, 2.4, ropa["kepi"])
        p.rect(x - 2.6, y - 6.2, 5.2, 3.6, ropa["kepi"], 1)
    elif sombrero == "gorra":
        p.rect(x - 3, y - 5.2, 6, 3.4, ropa["kepi"], 1)
        p.rect(x - 3, y - 2.6, 6, 0.9, ropa["detalle"])
        p.poli([(x + 1.2 * mirar, y - 1.8), (x + 4.4 * mirar, y - 1.2), (x + 1 * mirar, y - 1)], (24, 20, 16))
    elif sombrero == "pelo":
        p.circ(x - 1.4 * mirar, y - 1.2, 2.6, (60, 40, 28))
        p.circ(x - 2.8 * mirar, y + 0.6, 1.4, (60, 40, 28))
        p.rect(x - 2.4, y - 5.2, 4.8, 2.2, ropa["kepi"], 1)


def _cabeza_frente(p, x, y, ropa, sombrero, espalda=False):
    piel = ropa["piel"]
    p.circ(x, y, 2.9, piel if not espalda else oscuro(piel, 0.85))
    if not espalda:
        p.circ(x - 1, y - 0.2, 0.42, (40, 30, 20))
        p.circ(x + 1, y - 0.2, 0.42, (40, 30, 20))
    if sombrero == "kepi":
        p.rect(x - 2.9, y - 6.2, 5.8, 4.6, ropa["kepi"], 1)
        p.rect(x - 2.9, y - 2.6, 5.8, 1.1, ropa["franja"])
        if espalda and ropa.get("cubre", True):
            p.rect(x - 3.2, y - 1.6, 6.4, 4.2, ropa["cubrenuca"])
        elif not espalda:
            p.rect(x - 3, y - 1.6, 6, 0.8, (24, 20, 16))
    elif sombrero == "paja":
        p.poli([(x - 6.5, y - 1.4), (x, y - 5.8), (x + 6.5, y - 1.4)], PAJA)
        p.linea(x - 6.2, y - 1.4, x + 6.2, y - 1.4, oscuro(PAJA, 0.75), 0.7)
    elif sombrero == "sombrero":
        p.elipse(x - 5, y - 3.4, 10, 2.6, ropa["kepi"])
        p.rect(x - 2.6, y - 6.4, 5.2, 3.6, ropa["kepi"], 1)
    elif sombrero == "gorra":
        p.rect(x - 3, y - 5.4, 6, 3.6, ropa["kepi"], 1)
        p.rect(x - 3, y - 2.6, 6, 0.9, ropa["detalle"])
    elif sombrero == "pelo":
        p.circ(x, y - 1.6, 2.9, (60, 40, 28))
        if espalda:
            p.circ(x, y + 1.2, 1.6, (60, 40, 28))
        else:
            p.circ(x, y + 0.4, 2.4, ropa["piel"])
            p.circ(x - 1, y + 0.2, 0.4, (40, 30, 20))
            p.circ(x + 1, y + 0.2, 0.4, (40, 30, 20))
        p.rect(x - 2.4, y - 5.6, 4.8, 2.2, ropa["kepi"], 1)


def _arma_lado(p, x, y_hombro, y_cadera, arma, frame, mirar=1):
    m = mirar
    if arma in ("fusil", "carabina"):
        largo = 15 if arma == "fusil" else 11
        if frame == 3:
            x0, y0 = x - 2 * m, y_hombro + 2.6
            x1, y1 = x + (largo - 1) * m, y_hombro + 1.6
        else:
            x0, y0 = x - 3.5 * m, y_cadera + 2.5
            x1, y1 = x + 6 * m, y_hombro - 8
        p.linea(x0, y0, x0 + (x1 - x0) * 0.42, y0 + (y1 - y0) * 0.42, MADERA_FUSIL, 1.6)
        p.linea(x0 + (x1 - x0) * 0.4, y0 + (y1 - y0) * 0.4, x1, y1, (70, 72, 78), 1.0)
        if arma == "fusil":
            p.linea(x1, y1, x1 + (x1 - x0) * 0.12, y1 + (y1 - y0) * 0.12, ACERO, 0.6)
    elif arma == "pico":
        if frame == 4:
            p.linea(x + 1 * m, y_hombro + 1, x + 1 * m, y_hombro - 9, MADERA_FUSIL, 1.2)
            p.poli([(x - 3 * m, y_hombro - 9), (x + 5 * m, y_hombro - 10.5), (x + 1 * m, y_hombro - 8)], ACERO)
        else:
            p.linea(x - 4 * m, y_hombro + 1, x + 5 * m, y_hombro - 5, MADERA_FUSIL, 1.2)
            p.poli([(x + 3 * m, y_hombro - 7.5), (x + 6.5 * m, y_hombro - 3.5), (x + 5 * m, y_hombro - 5)], ACERO)
    elif arma == "pala":
        p.linea(x - 4 * m, y_cadera + 1, x + 5 * m, y_hombro - 6, MADERA_FUSIL, 1.2)
        p.elipse(x + 4 * m - 1.5, y_hombro - 9, 3, 4, ACERO)
    elif arma == "sable":
        if frame == 3:
            p.linea(x + 1 * m, y_hombro, x + 8 * m, y_hombro - 9, ACERO, 0.9)
        else:
            p.linea(x - 1 * m, y_cadera, x + 2 * m, y_cadera + 6, ACERO, 0.9)
    elif arma == "revolver":
        if frame == 3:
            p.linea(x + 2 * m, y_hombro + 1.5, x + 7 * m, y_hombro + 1.3, (60, 60, 64), 1.3)
        p.linea(x - 1 * m, y_cadera, x + 2 * m, y_cadera + 6, ACERO, 0.9)


def figura(nombre_forma, ropa, vista, frame, insignia=None):
    w, h, fx, fy = TAM["pie"]
    p = Pintor(w, h)
    x = fx
    pie = fy
    escala = 1.0
    sombrero = "kepi"
    arma = "fusil"
    falda = False
    if nombre_forma == "trabajador":
        sombrero, arma = "paja", "pico"
        ropa["cubre"] = False
    elif nombre_forma == "cantinera":
        sombrero, arma, falda = "pelo", None, True
    elif nombre_forma == "ingeniero":
        arma = "fusil"
    elif nombre_forma == "espia":
        sombrero, arma = "sombrero", None
        ropa["cubre"] = False
    elif nombre_forma == "zapador":
        arma = "fusil"
    elif nombre_forma == "torpedista":
        arma = None
    elif nombre_forma == "montonero":
        sombrero, arma = "sombrero", "fusil"
        ropa["cubre"] = False
    elif nombre_forma == "heroe_a_pie":
        sombrero, arma, escala = "gorra", "revolver", 1.0
        ropa["cubre"] = False
    elif nombre_forma == "heroina":
        sombrero, arma, falda = "pelo", "fusil" if insignia == "cantinera" else None, True
    pierna = 8.6 * escala
    torso = 8.8 * escala
    cadera = pie - pierna
    hombro = cadera - torso
    cabeza = hombro - 3.4
    casaca = ropa["casaca"]
    pant = ropa["pantalon"]
    if vista == "lado":
        paso = {1: 2.2, 2: -2.2}.get(frame, 0.0)
        # piernas
        if falda:
            p.poli([(x - 4.4, pie - 0.8), (x + 4.6, pie - 0.8), (x + 2.6, cadera - 1), (x - 2.6, cadera - 1)], pant)
            p.rect(x - 2 + paso * 0.3, pie - 1.4, 2.4, 1.4, BOTAS)
        else:
            p.poli([(x - 1.6, cadera), (x + 0.8, cadera), (x - paso + 0.6, pie - 1), (x - paso - 1.4, pie - 1)], oscuro(pant, 0.82))
            p.poli([(x - 1.2, cadera), (x + 1.4, cadera), (x + paso + 1.2, pie - 1), (x + paso - 1, pie - 1)], pant)
            p.rect(x - paso - 1.8, pie - 1.6, 3, 1.6, BOTAS)
            p.rect(x + paso - 1.1, pie - 1.6, 3.2, 1.6, BOTAS)
        # torso (levita con faldones)
        p.poli([(x - 3.2, hombro), (x + 2.8, hombro), (x + 3.2, cadera + 1.6), (x - 3.4, cadera + 1.6)], casaca)
        p.linea(x - 3.2, cadera - 0.6, x + 3.1, cadera - 0.6, CUERO if nombre_forma != "colorado" else CUERO_BLANCO, 0.9)
        if nombre_forma in ("infante", "zapador", "ingeniero", "colorado", "torpedista"):
            p.linea(x - 2.6, hombro + 0.6, x + 2.4, cadera - 1, CUERO_BLANCO, 0.7)
            p.rect(x - 4.6, hombro + 2, 2.2, 4.4, oscuro(CUERO, 0.6), 0.6)   # mochila
        if nombre_forma == "cantinera" or (nombre_forma == "heroina" and insignia != "cantinera"):
            p.rect(x - 0.4, cadera - 0.4, 3.6, 3, CUERO_BLANCO)            # delantal
            p.elipse(x - 5.2, cadera - 2.2, 3.4, 3.4, MADERA_FUSIL)          # barrilito
            p.linea(x - 5.2, cadera - 0.6, x - 1.8, cadera - 0.6, oscuro(MADERA_FUSIL), 0.5)
        if nombre_forma == "trabajador" and frame in (5, 6):
            pass
        if insignia in ("general", "coronel", "comandante", "artillero"):
            p.linea(x - 3, hombro + 0.8, x + 2.6, cadera - 0.8, ropa["detalle"], 0.9)   # banda
            p.rect(x - 0.4, hombro - 0.4, 3, 1.2, ropa["detalle"])                      # charretera
        # brazo con el distintivo del jugador
        bx = x + 0.6
        if frame == 3 and arma in ("fusil", "carabina", "revolver"):
            p.linea(bx, hombro + 1.4, bx + 4.6, hombro + 2.4, casaca, 1.7)
        elif frame == 4:
            p.linea(bx, hombro + 1.4, bx + 1.2, hombro - 3, casaca, 1.7)
        else:
            p.linea(bx, hombro + 1.4, bx + 2.4, cadera - 1.4, casaca, 1.7)
        p.rect(bx - 0.8, hombro + 1.4, 1.8, 1.4, ropa["jugador"])
        _cabeza_lado(p, x + 0.4, cabeza, ropa, sombrero)
        if arma:
            _arma_lado(p, x + 1, hombro, cadera, arma, frame)
        if nombre_forma == "ingeniero":
            p.rect(x + 2.4, cadera - 4, 1.2, 3.2, (190, 40, 30))
            p.rect(x + 3.8, cadera - 4, 1.2, 3.2, (190, 40, 30))
            p.linea(x + 3.6, cadera - 4, x + 4.8, cadera - 5.6, (240, 220, 160), 0.4)
        if nombre_forma == "zapador":
            p.linea(x - 4.4, hombro - 1, x - 4.4, cadera + 1, MADERA_FUSIL, 0.8)
            p.elipse(x - 5.6, hombro - 3.4, 2.4, 3, ACERO)
        if nombre_forma == "torpedista":
            p.rect(x + 1.4, cadera - 3.6, 4.4, 3.4, (60, 60, 56), 0.6)
            p.circ(x + 3.6, cadera - 1.9, 0.9, (190, 40, 30))
        if nombre_forma == "montonero":
            p.poli([(x - 4, hombro - 0.4), (x + 4, hombro - 0.4), (x + 4.6, cadera + 0.4), (x - 4.6, cadera + 0.4)],
                   (172, 58, 44))
            p.linea(x - 4.2, hombro + 3, x + 4.2, hombro + 3, (230, 196, 90), 0.6)
        if nombre_forma == "espia":
            p.poli([(x - 4, hombro - 0.2), (x + 3.6, hombro - 0.2), (x + 4.4, cadera + 2.2), (x - 4.6, cadera + 2.2)],
                   (54, 48, 44))
    else:
        espalda = vista == "espalda"
        alt = {1: 1.4, 2: -1.4}.get(frame, 0.0)
        if falda:
            p.poli([(x - 4.4, pie - 0.8), (x + 4.4, pie - 0.8), (x + 2.8, cadera - 1), (x - 2.8, cadera - 1)], pant)
        else:
            p.rect(x - 2.6, cadera, 2.2, pierna - 1 - max(0, alt), pant)
            p.rect(x + 0.4, cadera, 2.2, pierna - 1 - max(0, -alt), pant)
            p.rect(x - 2.8, pie - 1.6 - max(0, alt), 2.6, 1.6, BOTAS)
            p.rect(x + 0.2, pie - 1.6 - max(0, -alt), 2.6, 1.6, BOTAS)
        p.rect(x - 3.6, hombro, 7.2, torso + 1.4, casaca, 1)
        p.linea(x - 3.6, cadera - 0.6, x + 3.6, cadera - 0.6, CUERO if nombre_forma != "colorado" else CUERO_BLANCO, 0.9)
        if nombre_forma in ("infante", "zapador", "ingeniero", "colorado", "torpedista") and not espalda:
            p.linea(x - 3, hombro + 0.4, x + 3, cadera - 1, CUERO_BLANCO, 0.6)
            p.linea(x + 3, hombro + 0.4, x - 3, cadera - 1, CUERO_BLANCO, 0.6)
        if espalda and nombre_forma in ("infante", "zapador", "ingeniero", "colorado", "torpedista"):
            p.rect(x - 2.8, hombro + 1, 5.6, 5, oscuro(CUERO, 0.6), 0.8)
            p.rect(x - 3, hombro + 0.6, 6, 1.2, (210, 200, 180))
        if nombre_forma == "cantinera" and not espalda:
            p.rect(x - 2.2, cadera - 1, 4.4, 4.4, CUERO_BLANCO)
        if nombre_forma == "montonero":
            p.poli([(x - 4.6, hombro - 0.4), (x + 4.6, hombro - 0.4), (x + 5.2, cadera + 0.6), (x - 5.2, cadera + 0.6)],
                   (172, 58, 44))
        if insignia in ("general", "coronel", "comandante", "artillero") and not espalda:
            p.linea(x - 3.4, hombro + 0.8, x + 3.2, cadera - 0.8, ropa["detalle"], 0.9)
            p.rect(x - 4.2, hombro - 0.4, 2.2, 1.2, ropa["detalle"])
            p.rect(x + 2, hombro - 0.4, 2.2, 1.2, ropa["detalle"])
        p.rect(x - 5, hombro + 0.6, 1.6, torso - 1, casaca, 0.6)
        p.rect(x + 3.4, hombro + 0.6, 1.6, torso - 1, casaca, 0.6)
        p.rect(x - 5, hombro + 0.8, 1.6, 1.4, ropa["jugador"])
        if arma in ("fusil", "carabina"):
            p.linea(x + 4.4, cadera + 2, x + 4.4, hombro - 9, MADERA_FUSIL, 1.0)
            p.linea(x + 4.4, hombro - 4, x + 4.4, hombro - 10, ACERO, 0.6)
        elif arma == "pico":
            p.linea(x + 4.4, hombro + 2, x + 4.4, hombro - 8, MADERA_FUSIL, 1.0)
            p.poli([(x + 1.4, hombro - 7.6), (x + 7.4, hombro - 8.4), (x + 4.4, hombro - 6.6)], ACERO)
        _cabeza_frente(p, x, cabeza, ropa, sombrero, espalda)
    return p.resultado()


# ----------------------------------------------------------------------
def caballo(p, x, base, frame, color=(110, 72, 44), mirar=1):
    """Caballo de perfil con las patas según el cuadro."""
    m = mirar
    cuerpo_y = base - 9
    oscuro_c = oscuro(color, 0.75)
    paso = {1: 2.4, 2: -2.4}.get(frame, 0.0)
    for (dx, adelante, c) in ((-7, False, oscuro_c), (6, True, oscuro_c), (-6, False, color), (7, True, color)):
        mov = paso if adelante else -paso
        p.linea(x + dx * m, cuerpo_y + 2, x + (dx + mov * 0.6) * m, base - 0.6, c, 1.3)
        p.rect(x + (dx + mov * 0.6) * m - 0.8, base - 1.4, 1.8, 1.2, (40, 32, 26))
    p.elipse(x - 9, cuerpo_y - 3.6, 18.4, 7.6, color)
    p.poli([(x + 6 * m, cuerpo_y - 2), (x + 11 * m, cuerpo_y - 9), (x + 13 * m, cuerpo_y - 8), (x + 9.4 * m, cuerpo_y + 1)], color)
    p.poli([(x + 11 * m, cuerpo_y - 9.4), (x + 16 * m, cuerpo_y - 6.6), (x + 15.4 * m, cuerpo_y - 5), (x + 11.4 * m, cuerpo_y - 6.4)], color)
    p.poli([(x + 10.6 * m, cuerpo_y - 9), (x + 11.6 * m, cuerpo_y - 11.4), (x + 12 * m, cuerpo_y - 9)], oscuro_c)
    p.linea(x + 9 * m, cuerpo_y - 8.6, x + 6 * m, cuerpo_y - 3, (40, 30, 24), 0.9)
    p.linea(x - 9 * m, cuerpo_y - 2, x - 12 * m, cuerpo_y + 4, (40, 30, 24), 1.2)


def jinete(nombre_forma, ropa, vista, frame, insignia=None):
    w, h, fx, fy = TAM["montado"]
    p = Pintor(w, h)
    x = fx
    base = fy
    mirar = 1
    color_c = (110, 72, 44)
    if nombre_forma == "heroe_montado":
        color_c = (200, 196, 188) if insignia == "general" else (60, 44, 34)
    elif nombre_forma == "baqueano":
        color_c = (150, 116, 80)
    caballo(p, x, base, frame, color_c, mirar)
    # silla y jinete
    sy = base - 13
    p.rect(x - 4, sy, 7, 2.2, (70, 40, 24))
    pant = ropa["pantalon"]
    p.poli([(x - 1.2, sy), (x + 1.8, sy), (x + 2.6, sy + 6.8), (x + 0.4, sy + 6.8)], pant)
    p.rect(x + 0.2, sy + 6, 2.6, 1.6, BOTAS)
    torso_alto = 8.0
    hombro = sy - torso_alto
    casaca = ropa["casaca"]
    p.poli([(x - 2.8, hombro), (x + 2.6, hombro), (x + 3, sy + 1), (x - 3.2, sy + 1)], casaca)
    if nombre_forma == "baqueano":
        p.poli([(x - 4, hombro - 0.2), (x + 4, hombro - 0.2), (x + 4.6, sy + 1.6), (x - 4.6, sy + 1.6)], (150, 110, 70))
        p.linea(x - 4, hombro + 3, x + 4, hombro + 3, (200, 170, 110), 0.6)
    if insignia in ("general", "coronel", "comandante", "artillero"):
        p.linea(x - 2.6, hombro + 0.8, x + 2.4, sy - 0.6, ropa["detalle"], 0.9)
        p.rect(x - 0.4, hombro - 0.4, 3, 1.2, ropa["detalle"])
    sombrero = "sombrero" if nombre_forma == "baqueano" else ("gorra" if nombre_forma == "heroe_montado" else "kepi")
    ropa["cubre"] = nombre_forma not in ("baqueano", "heroe_montado")
    _cabeza_lado(p, x + 0.4, hombro - 3.4, ropa, sombrero)
    # brazo y arma
    if nombre_forma == "jinete_sable" or (nombre_forma == "heroe_montado" and insignia != "artillero"):
        if frame == 3:
            p.linea(x + 0.6, hombro + 1.4, x + 4, hombro - 2.6, casaca, 1.6)
            p.linea(x + 4, hombro - 2.6, x + 9, hombro - 11, ACERO, 0.9)
        else:
            p.linea(x + 0.6, hombro + 1.4, x + 3, sy - 1, casaca, 1.6)
            p.linea(x + 3, sy - 1, x + 8, hombro - 6, ACERO, 0.9)
    else:
        if frame == 3:
            p.linea(x + 0.6, hombro + 1.4, x + 4.6, hombro + 2.2, casaca, 1.6)
            p.linea(x + 1.6, hombro + 2.6, x + 11, hombro + 1.6, (70, 72, 78), 1.0)
        else:
            p.linea(x + 0.6, hombro + 1.4, x + 3, sy - 1, casaca, 1.6)
            p.linea(x - 3, sy + 1, x + 5, hombro - 5, MADERA_FUSIL, 1.0)
    p.rect(x - 0.2, hombro + 1.4, 1.8, 1.4, ropa["jugador"])
    # banderola del jugador en los héroes
    if nombre_forma == "heroe_montado":
        p.linea(x - 5, sy + 1, x - 5, hombro - 12, (60, 44, 30), 0.7)
        p.poli([(x - 5, hombro - 12), (x - 11, hombro - 10.2), (x - 5, hombro - 8.4)], ropa["jugador"])
    return p.resultado()


def rueda(p, x, y, r, c=(70, 50, 34)):
    p.circ(x, y, r, c, borde=0.9)
    for k in range(6):
        a = k * math.pi / 3
        p.linea(x, y, x + math.cos(a) * r, y + math.sin(a) * r, c, 0.5)
    p.circ(x, y, 0.9, oscuro(c))


def pieza(nombre_forma, ropa, vista, frame, emplazada=False):
    w, h, fx, fy = TAM["artilleria"]
    p = Pintor(w, h)
    x = fx
    base = fy
    madera = (96, 70, 46)
    if nombre_forma == "gatling":
        p.linea(x - 12, base - 2, x - 2, base - 6, madera, 2.2)
        rueda(p, x, base - 5, 5.2)
        p.rect(x - 3, base - 12, 8, 5, BRONCE, 1)
        for k in range(5):
            p.linea(x + 4, base - 11.6 + k * 0.9, x + 15, base - 12.2 + k * 0.9, (54, 56, 60), 0.6)
        p.rect(x + 13.6, base - 12.6, 1.6, 5, BRONCE)
        p.circ(x - 3.6, base - 9.6, 1.4, (70, 60, 50))
        crew_x = x - 9
    else:
        largo = 15 if nombre_forma == "canon_campana" else 11
        r = 6.6 if nombre_forma == "canon_campana" else 5.2
        if emplazada:
            p.linea(x - 14, base - 1, x - 1, base - 5, madera, 2.4)
            p.linea(x - 13, base + 0.6, x - 1, base - 4, oscuro(madera), 1.6)
            ang = -0.22
        else:
            p.linea(x - 12, base - 2, x - 1, base - 5, madera, 2.2)
            ang = -0.08
        rueda(p, x, base - r, r)
        bx, by = x - 3, base - r - 2.2
        ex, ey = bx + largo * math.cos(ang), by + largo * math.sin(ang)
        p.linea(bx, by, ex, ey, (52, 56, 62) if nombre_forma == "canon_campana" else BRONCE, 3.0)
        p.circ(ex, ey, 1.4, oscuro((52, 56, 62)))
        if not emplazada and nombre_forma == "canon_campana":
            # armón enganchado
            rueda(p, x - 17, base - 5, 4.6)
            p.rect(x - 21, base - 12, 8, 5, oscuro(madera, 0.9), 1)
        crew_x = x - 10
    # sirviente de la pieza
    ropa = dict(ropa)
    cx = crew_x
    p.rect(cx - 1.4, base - 9, 2.6, 8.4, ropa["pantalon"])
    p.rect(cx - 2.4, base - 16.6, 4.8, 8, ropa["casaca"], 1)
    p.rect(cx - 2.6, base - 15.6, 1.6, 1.4, ropa["jugador"])
    ropa["cubre"] = True
    _cabeza_lado(p, cx, base - 19.6, ropa, "kepi")
    if frame == 3:
        p.circ(x + 15, base - 9, 1.2, (255, 230, 150))
    return p.resultado()


# ----------------------------------------------------------------------
def buque(nombre_forma, color_jugador, insignia=None):
    """Buque visto desde arriba, con la proa hacia la derecha."""
    w, h, fx, fy = TAM["buque"]
    p = Pintor(w, h)
    cy = fy
    if nombre_forma == "monitor":
        casco = (64, 66, 70)
        p.poli([(8, cy - 7), (62, cy - 7), (76, cy), (62, cy + 7), (8, cy + 7), (4, cy)], casco)
        p.poli([(10, cy - 5.6), (60, cy - 5.6), (72, cy), (60, cy + 5.6), (10, cy + 5.6), (7, cy)], (96, 96, 92))
        p.circ(46, cy, 5.4, (58, 60, 64))
        p.linea(46, cy, 62, cy - 1.4, (40, 40, 44), 2.2)
        p.linea(46, cy, 62, cy + 1.4, (40, 40, 44), 2.2)
        p.circ(28, cy, 3, (30, 28, 26))
        p.linea(14, cy, 20, cy, (60, 50, 40), 1.2)
    elif nombre_forma == "corbeta":
        casco = (60, 46, 34)
        p.poli([(6, cy - 8), (60, cy - 8), (78, cy), (60, cy + 8), (6, cy + 8), (2, cy)], casco)
        p.poli([(8, cy - 6.6), (58, cy - 6.6), (74, cy), (58, cy + 6.6), (8, cy + 6.6), (5, cy)], (176, 150, 112))
        for mx in (20, 38, 56):
            p.circ(mx, cy, 1.6, (70, 50, 36))
            p.linea(mx, cy - 10, mx, cy + 10, (90, 70, 50), 0.8)
            p.elipse(mx - 2.6, cy - 9, 5.2, 18, (236, 232, 220))
        for k in range(5):
            p.rect(12 + k * 9, cy - 8.6, 2.6, 1.2, (30, 26, 22))
            p.rect(12 + k * 9, cy + 7.4, 2.6, 1.2, (30, 26, 22))
    else:
        casco = (44, 44, 48) if nombre_forma == "canonera" else (52, 40, 32)
        cubierta = (150, 128, 96) if nombre_forma == "transporte" else (120, 116, 108)
        p.poli([(6, cy - 8), (58, cy - 8), (76, cy), (58, cy + 8), (6, cy + 8), (3, cy)], casco)
        p.poli([(8, cy - 6.4), (56, cy - 6.4), (72, cy), (56, cy + 6.4), (8, cy + 6.4), (6, cy)], cubierta)
        if nombre_forma == "transporte":
            for k in range(4):
                p.rect(12 + k * 10, cy - 4, 7, 8, (110, 86, 60), 1)
            p.circ(52, cy, 3.4, (34, 30, 28))
            p.rect(49, cy - 1, 6, 2, color_jugador)
            p.linea(26, cy - 9, 26, cy + 9, (80, 60, 44), 0.8)
        else:
            p.circ(34, cy, 3.4, (34, 30, 28))
            p.rect(31, cy - 1, 6, 2, color_jugador)
            p.circ(58, cy, 3.2, (70, 70, 74))
            p.linea(58, cy, 70, cy, (40, 40, 44), 2.0)
            p.circ(16, cy, 2.6, (70, 70, 74))
            p.linea(16, cy, 8, cy, (40, 40, 44), 1.6)
    # gallardete del jugador en la popa
    p.poli([(5, cy - 2), (0, cy - 4), (0, cy)], color_jugador)
    if insignia == "heroe":
        p.circ(40, cy + 4, 1.4, (230, 196, 120))
    return p.resultado()


# ----------------------------------------------------------------------
class Sprites:
    """Genera y guarda en la GPU los sprites de cada unidad y jugador."""

    def __init__(self, lz, catalogo):
        self.lz = lz
        self.cat = catalogo
        self.propios = {}
        self._cargar_propios()

    def _cargar_propios(self):
        from ... import rutas
        carpeta = rutas.dir_recursos() / "graficos" / "unidades"
        if carpeta.is_dir():
            for ruta in carpeta.glob("*.png"):
                try:
                    self.propios[ruta.stem] = pygame.image.load(str(ruta)).convert_alpha()
                except pygame.error:
                    pass

    def superficie(self, tipo, faccion, color_jugador, vista, frame, emplazada=False):
        if tipo.id in self.propios:
            return self.propios[tipo.id]
        forma = tipo.sprite.get("forma", "infante")
        insignia = tipo.sprite.get("insignia")
        especial = forma if forma in ("colorado", "trabajador", "espia", "montonero", "baqueano") else None
        ropa = _ropa(faccion.uniforme, color_jugador, especial)
        tam = FORMA_TAM.get(forma, "pie")
        if tam == "pie":
            return figura(forma, ropa, vista, frame, insignia)
        if tam == "montado":
            return jinete(forma, ropa, vista, frame, insignia)
        if tam == "artilleria":
            return pieza(forma, ropa, vista, frame, emplazada)
        return buque(forma, color_jugador, insignia)

    def textura(self, tipo, faccion, color_jugador, vista, frame, emplazada=False):
        forma = tipo.sprite.get("forma", "infante")
        tam = FORMA_TAM.get(forma, "pie")
        if tam in ("montado", "artilleria", "buque"):
            vista = "lado"
        if tam == "buque":
            frame = 0
        if tam == "artilleria" and frame in (1, 2):
            frame = 0
        clave = ("spr", tipo.id, faccion.id, color_jugador, vista, frame, emplazada)
        return self.lz.textura(clave, lambda: self.superficie(tipo, faccion, color_jugador, vista, frame, emplazada))

    def caido(self, tipo, faccion, color_jugador):
        """Cuerpo caído (o pieza destruida) para dejar en el terreno."""
        clave = ("caido", tipo.id, faccion.id, color_jugador)

        def gen():
            s = self.superficie(tipo, faccion, color_jugador, "lado", 0)
            forma = tipo.sprite.get("forma", "infante")
            if FORMA_TAM.get(forma, "pie") in ("artilleria", "buque"):
                r = s.copy()
                r.fill((120, 110, 100, 255), special_flags=pygame.BLEND_RGBA_MULT)
                return r
            r = pygame.transform.rotate(s, 90)
            r.fill((150, 140, 130, 255), special_flags=pygame.BLEND_RGBA_MULT)
            return r
        return self.lz.textura(clave, gen)


def tam_sprite(tipo):
    forma = tipo.sprite.get("forma", "infante")
    return TAM[FORMA_TAM.get(forma, "pie")]
