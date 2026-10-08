"""Edificios dibujados por código en perspectiva 3/4 (muro al frente, techo arriba).

El lienzo de cada edificio cubre su huella (ancho x alto en casillas de 32 px)
más un margen superior ALTO para la altura de los muros y techos. Si en
recursos/graficos/edificios/ hay un PNG con el id del edificio, se usa ese.

Las obras guarnecibles con tiradores (barracas y cuartel general) son casas
fuertes de adobe con azotea: parapeto almenado al frente y atrás, y ventanas
en la fachada. Se dibujan en dos capas: la obra entera y, aparte, su «frente»
(el parapeto con sus merlones y la fachada con los vanos de las ventanas
recortados), que la vista pinta encima de los tiradores para que asomen tras
las almenas y dentro de las ventanas. geometria_fortaleza() da los puestos.
"""

import math

import pygame

from .banderas import superficie_bandera
from .sprites import Pintor, claro, oscuro

T = 32
ALTO = 62
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


# ----------------------------------------------------------------------
# Casas fuertes: azotea con parapeto almenado y ventanas para los tiradores
FORTALEZAS = ("cuartel_general", "barracas")
FACHADA = (204, 176, 136)
FACHADA_SOMBRA = (172, 144, 108)
AZOTEA = (166, 138, 100)
PARAPETO = (214, 188, 150)
TAPA = (232, 212, 178)
VANO = (34, 25, 20)
ZOCALO = (138, 124, 108)

# medidas en píxeles de la huella (origen arriba a la izquierda). 'muro': x, ancho, y del pie de la
# fachada, alto de la fachada, fondo de la azotea; parapeto y merlones como alto de cara y de tapa.
GEOMETRIA = {
    "cuartel_general": {
        "muro": (6, 116, 90, 30, 72), "parapeto": 10, "merlon": 6, "n_merlones": 9,
        "ventanas": [22, 44, 84, 106], "ventana": (10, 12, 3),
        "torre": (50, 28, 18, 34, 30),      # x, ancho, fondo, alto sobre la azotea y retiro desde el frente
        # puestos en el orden en que entran los soldados: almena (por su merlón), ventana o torre
        "puestos": [("almena", 1), ("ventana", 0), ("almena", 7), ("ventana", 3), ("torre", 0),
                    ("ventana", 1), ("almena", 4), ("ventana", 2)],
    },
    "barracas": {
        "muro": (4, 88, 90, 24, 66), "parapeto": 10, "merlon": 6, "n_merlones": 7,
        "ventanas": [14, 30, 66, 82], "ventana": (10, 12, 4),
        "torre": None,
        "puestos": [("almena", 1), ("ventana", 0), ("almena", 5), ("ventana", 3), ("almena", 3),
                    ("ventana", 1)],
    },
}


def geometria_fortaleza(forma):
    """Puestos de tiro de una casa fuerte, en píxeles de la huella.

    Devuelve {'puestos': [...], 'atras': y del parapeto del fondo}. Cada puesto es un
    diccionario: 'tipo' ('almena', 'torre' o 'ventana'); en las almenas y la torre, 'x'
    (detrás del merlón, a cubierto), 'troneras' (x de las troneras a cada lado), 'y' (los
    pies, sobre la azotea), 'tronera' y 'merlon' (y de la tapa: lo que queda por debajo no se
    ve); en las ventanas, 'rect' (el vano)."""
    g = GEOMETRIA.get(forma)
    if g is None:
        return None
    mx, mw, pie, alto, fondo = g["muro"]
    frente = pie - alto                     # borde delantero de la azotea
    cara, mer = g["parapeto"], g["merlon"]
    n = g["n_merlones"]
    ancho_m, hueco = 7, (mw - n * 7) / (n - 1)
    centros = [mx + i * (ancho_m + hueco) + ancho_m / 2 for i in range(n)]
    almenas = []
    for i, c in enumerate(centros):
        izq = (centros[i - 1] + c) / 2 if i > 0 else c - (ancho_m + hueco) / 2
        der = (centros[i + 1] + c) / 2 if i < n - 1 else c + (ancho_m + hueco) / 2
        almenas.append({"tipo": "almena", "x": c, "troneras": (izq, der), "y": frente - 2,
                        "tronera": frente - cara - 2, "merlon": frente - cara - 2 - mer - 2})
    vw, vh, vy = g["ventana"]
    ventanas = [{"tipo": "ventana", "rect": (x - vw / 2, frente + vy, vw, vh)} for x in g["ventanas"]]
    torre = []
    if g["torre"]:
        tx, tw, td, ta, retiro = g["torre"]
        base = frente - retiro                  # pie de la cara delantera de la torre, sobre la azotea
        cima = base - ta                         # borde delantero de su terraza
        c = tx + tw / 2
        torre.append({"tipo": "torre", "x": c, "troneras": (c - 6.5, c + 6.5), "y": cima - 2,
                      "tronera": cima - 8 - 2, "merlon": cima - 8 - 2 - 6 - 2})
    puestos = []
    for clase, i in g["puestos"]:
        fuente = {"almena": almenas, "ventana": ventanas, "torre": torre}[clase]
        puestos.append(dict(fuente[i]))
    return {"puestos": puestos, "atras": frente - fondo - cara}


def _parapeto(p, x, y_pie, w, cara, merlon, n, tono=1.0):
    """Parapeto visto de frente: cara de 'cara' px que sube desde y_pie, tapa clara y n merlones."""
    p.rect(x, y_pie - cara, w, cara, oscuro(PARAPETO, tono))
    p.rect(x, y_pie - cara - 2, w, 2, oscuro(TAPA, tono))
    p.linea(x, y_pie - 0.4, x + w, y_pie - 0.4, oscuro(PARAPETO, 0.7 * tono), 0.6)
    if n <= 0:
        return
    hueco = (w - n * 7) / (n - 1)
    for i in range(n):
        mx = x + i * (7 + hueco)
        p.rect(mx, y_pie - cara - 2 - merlon, 7, merlon, oscuro(PARAPETO, tono))
        p.rect(mx, y_pie - cara - 4 - merlon, 7, 2, oscuro(TAPA, tono))
        p.rect(mx + 5.6, y_pie - cara - 2 - merlon, 1.4, merlon, oscuro(PARAPETO, 0.8 * tono))   # sombra


def _fachada(p, x0, y0, forma, g, nacion, color_jugador):
    """Muro delantero con sus ventanas (vanos oscuros), puerta, vigas y zócalo."""
    mx, mw, pie, alto, _fondo = g["muro"]
    frente = pie - alto
    p.rect(x0 + mx, y0 + frente, mw, alto, FACHADA)
    p.rect(x0 + mx, y0 + pie - 4, mw, 4, ZOCALO)
    for xx in (mx, mx + mw - 4):                                  # contrafuertes en las esquinas
        p.rect(x0 + xx, y0 + frente, 4, alto, FACHADA_SOMBRA)
    for k in range(int(mw // 9)):                                 # cabezas de las vigas de la azotea
        p.rect(x0 + mx + 5 + k * 9, y0 + frente + 1, 2, 2, (96, 70, 46))
    vw, vh, vy = g["ventana"]
    for vx in g["ventanas"]:
        x, y = x0 + vx - vw / 2, y0 + frente + vy
        p.rect(x, y, vw, vh, VANO)
        p.rect(x + 1, y + 1, vw - 2, 3, (52, 40, 32))             # penumbra del interior
    cx = x0 + mx + mw / 2
    puerta_alto = 16 if forma == "cuartel_general" else 14
    p.rect(cx - 7, y0 + pie - puerta_alto, 14, puerta_alto, (92, 64, 42))
    p.circ(cx, y0 + pie - puerta_alto + 1, 7, (92, 64, 42))
    for k in range(3):
        p.linea(cx - 4 + k * 4, y0 + pie - puerta_alto + 1, cx - 4 + k * 4, y0 + pie - 1, (70, 48, 30), 0.6)
    if forma == "cuartel_general":
        # escudo con los colores del jugador sobre la puerta, y ventanas enrejadas abajo
        p.rect(cx - 5, y0 + frente + 3, 10, 9, (240, 232, 214))
        p.rect(cx - 4, y0 + frente + 4, 8, 7, color_jugador)
        p.linea(cx, y0 + frente + 4, cx, y0 + frente + 11, (240, 232, 214), 0.6)
        for vx in (x0 + mx + 22, x0 + mx + mw - 29):
            p.rect(vx, y0 + pie - 13, 7, 7, VANO)
            for b in range(3):
                p.linea(vx + 1.5 + b * 2, y0 + pie - 13, vx + 1.5 + b * 2, y0 + pie - 6, (110, 100, 90), 0.5)


def _marcos_ventanas(p, x0, y0, g):
    """Dintel de madera y alféizar claro de cada ventana (por fuera del vano)."""
    mx, mw, pie, alto, _fondo = g["muro"]
    frente = pie - alto
    vw, vh, vy = g["ventana"]
    for vx in g["ventanas"]:
        x, y = x0 + vx - vw / 2, y0 + frente + vy
        p.rect(x - 1, y - 2, vw + 2, 2, (110, 78, 50))
        p.rect(x - 1.5, y + vh, vw + 3, 2, (228, 210, 178))


def _fortaleza(p, forma, x0, y0, nacion, color_jugador, capa="todo"):
    """Casa fuerte con azotea almenada. capa='frente': solo lo que tapa a los tiradores."""
    g = GEOMETRIA[forma]
    mx, mw, pie, alto, fondo = g["muro"]
    frente = pie - alto
    cara, mer, n = g["parapeto"], g["merlon"], g["n_merlones"]
    if capa == "todo":
        # azotea de barro apisonado, parapeto del fondo y de los costados
        p.rect(x0 + mx, y0 + frente - fondo, mw, fondo, AZOTEA)
        for k in range(1, 6):
            yy = y0 + frente - fondo + k * fondo / 6
            p.linea(x0 + mx + 4, yy, x0 + mx + mw - 4, yy, oscuro(AZOTEA, 0.93), 0.5)
        _parapeto(p, x0 + mx, y0 + frente - fondo, mw, cara, mer, n, 0.9)
        for xx in (mx, mx + mw - 4):
            p.rect(x0 + xx, y0 + frente - fondo - cara - 2, 4, fondo + 2, TAPA)
            p.linea(x0 + xx + (4 if xx == mx else 0), y0 + frente - fondo, x0 + xx + (4 if xx == mx else 0),
                    y0 + frente - cara, oscuro(PARAPETO, 0.7), 0.6)
        # escotilla de la azotea y pertrechos (cajones de munición y sacos)
        ex = x0 + mx + 12
        ey = y0 + frente - fondo + 10
        p.rect(ex, ey, 10, 7, (120, 92, 62))
        p.rect(ex + 1, ey + 1, 8, 5, (70, 52, 36))
        p.linea(ex + 1, ey + 3.5, ex + 9, ey + 3.5, (120, 92, 62), 0.5)
        cx = x0 + mx + mw - 26
        cy = y0 + frente - 22
        for k in range(2):
            p.rect(cx + k * 8, cy, 7, 5, (132, 98, 64))
            p.linea(cx + k * 8, cy + 2.5, cx + k * 8 + 7, cy + 2.5, (96, 70, 46), 0.5)
        p.elipse(cx + 1, cy - 4, 7, 4, (196, 176, 130))
        p.elipse(cx + 7, cy - 4, 7, 4, (186, 166, 122))
        if g["torre"]:
            tx, tw, td, ta, retiro = g["torre"]
            base = frente - retiro
            cima = base - ta
            p.rect(x0 + tx + 2, y0 + base - 2, tw, 3, oscuro(AZOTEA, 0.8))         # sombra al pie
            p.rect(x0 + tx, y0 + cima, tw, ta, oscuro(FACHADA, 0.95))              # cara de la torre
            p.rect(x0 + tx, y0 + cima, 3, ta, oscuro(FACHADA, 0.85))
            p.rect(x0 + tx + tw - 3, y0 + cima, 3, ta, oscuro(FACHADA, 0.85))
            p.rect(x0 + tx, y0 + cima - td, tw, td, AZOTEA)                        # su terraza
            _parapeto(p, x0 + tx, y0 + cima - td, tw, 6, 5, 3, 0.9)
            for k in range(2):                                                     # aspilleras
                p.rect(x0 + tx + 8 + k * 10, y0 + cima + 8, 2, 9, VANO)
                p.rect(x0 + tx + 8 + k * 10, y0 + cima + 20, 2, 9, VANO)
            bandera_en_mastil(p, x0 + tx + tw / 2, y0 + cima - td - 8, 24, nacion, color_jugador)
        else:
            bandera_en_mastil(p, x0 + mx + mw - 7, y0 + frente - fondo - cara, 26, nacion, color_jugador)
    # lo que va delante de los tiradores: el parapeto almenado del frente, la fachada y la torre
    if g["torre"]:
        tx, tw, td, ta, retiro = g["torre"]
        cima = frente - retiro - ta
        _parapeto(p, x0 + tx, y0 + cima, tw, 8, 6, 3)
    _parapeto(p, x0 + mx, y0 + frente, mw, cara, mer, n)
    _fachada(p, x0, y0, forma, g, nacion, color_jugador)
    if capa == "frente":
        vw, vh, vy = g["ventana"]
        for vx in g["ventanas"]:
            p.borrar(x0 + vx - vw / 2, y0 + frente + vy, vw, vh)
    _marcos_ventanas(p, x0, y0, g)


def dibujar_edificio(tipo, nacion, color_jugador, capa="todo"):
    w, h = tipo.ancho, tipo.alto
    W = w * T + 2 * MARGEN
    H = h * T + ALTO
    p = Pintor(W, H)
    x0, y0 = MARGEN, ALTO
    fw, fh = w * T, h * T
    forma = tipo.sprite.get("forma", tipo.id)
    if forma in FORTALEZAS:
        if capa == "todo":
            p.elipse(x0 - 2, y0 + fh * 0.35, fw + 4, fh * 0.75, (40, 30, 20, 70))
            p.rect(x0 + 1, y0 + 2, fw - 2, fh - 3, (170, 148, 112), 3)
            if forma == "cuartel_general":
                p.rect(x0 + 2, y0 + fh - 9, 6, 6, (90, 80, 70))
                p.rect(x0 + fw - 8, y0 + fh - 9, 6, 6, (90, 80, 70))
        _fortaleza(p, forma, x0, y0, nacion, color_jugador, capa)
        return p.resultado()
    # sombra y suelo apisonado
    p.elipse(x0 - 2, y0 + fh * 0.35, fw + 4, fh * 0.75, (40, 30, 20, 70))
    p.rect(x0 + 1, y0 + 2, fw - 2, fh - 3, (170, 148, 112), 3)
    if forma == "deposito":
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
    elif forma == "hospital_sangre":
        _hospital_sangre(p, x0, y0, fw, fh, color_jugador)
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


def _bandera_cruz_roja(p, x, y, alto, color_jugador):
    """Mástil con la bandera blanca de la Cruz Roja y el gallardete del jugador."""
    p.linea(x, y, x, y - alto, (80, 64, 50), 0.9)
    p.rect(x + 0.5, y - alto, 12, 8, (250, 250, 250))
    p.rect(x + 5.2, y - alto + 1, 2.6, 6, CRUZ)
    p.rect(x + 2.5, y - alto + 2.7, 8, 2.6, CRUZ)
    p.poli([(x, y - alto + 10), (x + 7, y - alto + 12), (x, y - alto + 14)], color_jugador)


CRUZ = (210, 30, 30)


def _hospital_sangre(p, x0, y0, fw, fh, color_jugador):
    """Hospital de sangre: la carpa de la sala con la cruz roja en el techo, una carpa chica,
    catres a la puerta, el botiquín y el carro de la ambulancia desenganchado."""
    sombra = oscuro(LONA, 0.84)
    # el carro desenganchado, detrás, a la derecha
    cx, cy = x0 + fw - 15, y0 + 20
    p.rect(cx - 9, cy - 2, 18, 5, MADERA)
    p.elipse(cx - 9, cy - 14, 18, 10, LONA)
    p.rect(cx - 9, cy - 9, 18, 8, LONA)
    p.rect(cx - 1.4, cy - 11, 2.8, 7, CRUZ)
    p.rect(cx - 3.6, cy - 8.6, 7.2, 2.6, CRUZ)
    p.circ(cx - 5, cy + 4, 3.4, MADERA_OSC, borde=0.9)
    p.circ(cx + 6, cy + 4, 3.0, MADERA_OSC, borde=0.9)
    p.linea(cx + 9, cy + 1, cx + 16, cy + 4, MADERA_OSC, 0.9)
    # carpa de la sala: muro al frente y techo a dos aguas con la cruz roja
    tx0, tx1 = x0 + 3, x0 + 45
    pie, alero, cumbre = y0 + fh - 18, y0 + fh - 30, y0 + 10
    p.rect(tx0, alero, tx1 - tx0, pie - alero, sombra)
    p.poli([(tx0 - 1, alero), (tx0 + 8, cumbre), (tx1 - 8, cumbre), (tx1 + 1, alero)], LONA)
    p.linea(tx0 + 8, cumbre, tx1 - 8, cumbre, oscuro(LONA, 0.7), 0.8)
    for k in range(1, 4):
        xx = tx0 + k * (tx1 - tx0) / 4
        p.linea(xx, alero, xx + (xx - (tx0 + tx1) / 2) * -0.18, cumbre + 1, oscuro(LONA, 0.9), 0.5)
    mx = (tx0 + tx1) / 2
    p.rect(mx - 2.2, cumbre + 4, 4.4, 13, CRUZ)
    p.rect(mx - 6.5, cumbre + 8.3, 13, 4.4, CRUZ)
    # puerta abierta con la lona recogida
    p.rect(mx - 4, alero + 2, 8, pie - alero - 2, (52, 40, 32))
    p.poli([(mx - 4, alero + 2), (mx - 9, pie), (mx - 4, pie)], claro(LONA, 0.1))
    for xx in (tx0, tx1):
        p.linea(xx, pie, xx + (2 if xx == tx0 else -2), pie + 3, (110, 90, 66), 0.6)     # vientos
    # carpa chica a la derecha, adelante
    bx = x0 + fw - 13
    p.poli([(bx - 11, y0 + fh - 6), (bx, y0 + fh - 30), (bx + 11, y0 + fh - 6)], LONA)
    p.poli([(bx, y0 + fh - 30), (bx + 11, y0 + fh - 6), (bx + 3, y0 + fh - 6)], sombra)
    p.rect(bx - 2.4, y0 + fh - 14, 4.8, 8, (70, 58, 46))
    # dos catres con heridos frente a la sala y el botiquín
    for k, xx in enumerate((x0 + 6, x0 + 22)):
        yy = y0 + fh - 11 + k
        p.rect(xx, yy, 13, 3.4, (236, 234, 226))
        p.rect(xx + 1, yy - 1.4, 7, 2.2, (150, 120, 96))
        p.circ(xx + 10.6, yy - 0.6, 1.7, (210, 170, 136))
        p.linea(xx + 1, yy + 3.4, xx + 1, yy + 5, MADERA_OSC, 0.6)
        p.linea(xx + 12, yy + 3.4, xx + 12, yy + 5, MADERA_OSC, 0.6)
    p.rect(x0 + 37, y0 + fh - 12, 6, 5, MADERA)
    p.rect(x0 + 39.2, y0 + fh - 11.4, 1.6, 3.8, CRUZ)
    _bandera_cruz_roja(p, bx, y0 + fh - 30, 46, color_jugador)          # en el mástil de la carpa chica


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

    def frente(self, tipo, nacion, color_jugador):
        """Capa del frente de una casa fuerte (parapeto almenado y fachada con los vanos abiertos),
        o None si el edificio no la tiene (o si su gráfico es un PNG propio)."""
        if tipo.id in self.propios or tipo.sprite.get("forma", tipo.id) not in FORTALEZAS:
            return None
        clave = ("edif_frente", tipo.id, nacion, color_jugador)
        return self.lz.textura(clave, lambda: dibujar_edificio(tipo, nacion, color_jugador, "frente"))

    def andamio(self, tipo):
        return self.lz.textura(("andamio", tipo.ancho, tipo.alto), lambda: andamio(tipo.ancho, tipo.alto))

    def aspas(self):
        return self.lz.textura(("aspas",), aspas)
