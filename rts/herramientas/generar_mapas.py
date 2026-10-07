"""Genera los mapas oficiales del juego en la carpeta mapas/.

Cada mapa se describe con unas pocas operaciones (mesetas con rampas, cerros,
quebradas, salares, tamarugales, caminos, mar e islas) sobre una mitad o un
cuarto del terreno, que luego se refleja para que todos los jugadores tengan
las mismas oportunidades. Uso:

    python herramientas/generar_mapas.py            # todos
    python herramientas/generar_mapas.py arica      # solo los que contienen 'arica'
"""

import json
import math
import sys
from collections import deque
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))

from salitre.contenido.mapas import MapaDatos  # noqa: E402
from salitre.sim.azar import Azar  # noqa: E402
from salitre.sim.mapa import Mapa  # noqa: E402

PASABLES = set(".,:=/")


class Lienzo:
    def __init__(self, ancho, alto, semilla, fondo="."):
        self.w = ancho
        self.h = alto
        self.t = [[fondo] * ancho for _ in range(alto)]
        self.a = [[0] * ancho for _ in range(alto)]
        self.azar = Azar(semilla)
        self.inicios = []
        self.recursos = []
        self.protegidas = set()

    # -- utilidades ------------------------------------------------------
    def dentro(self, x, y):
        return 0 <= x < self.w and 0 <= y < self.h

    def poner(self, x, y, ch, forzar=False):
        if self.dentro(x, y) and (forzar or (x, y) not in self.protegidas):
            self.t[y][x] = ch

    def ruido(self, escala, semilla):
        """Ruido de valor suavizado (0..1) para variar arena y pampa."""
        az = Azar(semilla)
        gw = self.w // escala + 2
        gh = self.h // escala + 2
        rej = [[az.entero(1000) / 1000 for _ in range(gw)] for _ in range(gh)]
        out = [[0.0] * self.w for _ in range(self.h)]
        for y in range(self.h):
            gy, fy = divmod(y, escala)
            ty = fy / escala
            ty = ty * ty * (3 - 2 * ty)
            for x in range(self.w):
                gx, fx = divmod(x, escala)
                tx = fx / escala
                tx = tx * tx * (3 - 2 * tx)
                a = rej[gy][gx] * (1 - tx) + rej[gy][gx + 1] * tx
                b = rej[gy + 1][gx] * (1 - tx) + rej[gy + 1][gx + 1] * tx
                out[y][x] = a * (1 - ty) + b * ty
        return out

    def variar_suelo(self, semilla, umbral=0.55, ch=","):
        r = self.ruido(9, semilla)
        for y in range(self.h):
            for x in range(self.w):
                if self.t[y][x] == "." and r[y][x] > umbral:
                    self.t[y][x] = ch

    def elipse(self, cx, cy, rx, ry, ch=None, nivel=None, borde_irregular=0.0, solo_si=None):
        for y in range(int(cy - ry - 2), int(cy + ry + 3)):
            for x in range(int(cx - rx - 2), int(cx + rx + 3)):
                if not self.dentro(x, y):
                    continue
                dx = (x + 0.5 - cx) / max(rx, 0.5)
                dy = (y + 0.5 - cy) / max(ry, 0.5)
                lim = 1.0
                if borde_irregular:
                    ang = math.atan2(dy, dx)
                    lim += borde_irregular * (math.sin(ang * 3 + cx) * 0.6 + math.sin(ang * 5 + cy) * 0.4)
                if dx * dx + dy * dy <= lim * lim:
                    if (x, y) in self.protegidas:
                        continue
                    if solo_si is not None and self.t[y][x] not in solo_si:
                        continue
                    if ch is not None:
                        self.t[y][x] = ch
                    if nivel is not None:
                        self.a[y][x] = nivel

    def rect(self, x0, y0, x1, y1, ch=None, nivel=None):
        for y in range(y0, y1):
            for x in range(x0, x1):
                if self.dentro(x, y) and (x, y) not in self.protegidas:
                    if ch is not None:
                        self.t[y][x] = ch
                    if nivel is not None:
                        self.a[y][x] = nivel

    def linea(self, x0, y0, x1, y1, ch, ancho=1, solo_si=None):
        n = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 1
        for k in range(n + 1):
            x = x0 + (x1 - x0) * k / n
            y = y0 + (y1 - y0) * k / n
            for oy in range(ancho):
                for ox in range(ancho):
                    xx = int(x) + ox - ancho // 2
                    yy = int(y) + oy - ancho // 2
                    if self.dentro(xx, yy) and (xx, yy) not in self.protegidas:
                        if solo_si is None or self.t[yy][xx] in solo_si:
                            self.t[yy][xx] = ch

    def tamarugal(self, cx, cy, radio, densidad, semilla):
        az = Azar(semilla)
        for y in range(int(cy - radio), int(cy + radio) + 1):
            for x in range(int(cx - radio), int(cx + radio) + 1):
                if not self.dentro(x, y) or (x, y) in self.protegidas:
                    continue
                if (x - cx) ** 2 + (y - cy) ** 2 > radio * radio:
                    continue
                if self.t[y][x] in ".," and az.entero(100) < densidad:
                    self.t[y][x] = "T"

    def meseta(self, cx, cy, rx, ry, nivel, rampas, irregular=0.12):
        """Meseta elevada con rampas en las direcciones dadas (ángulos en grados)."""
        self.elipse(cx, cy, rx, ry, nivel=nivel, borde_irregular=irregular)
        for ang in rampas:
            a = math.radians(ang)
            for k in range(-1, 2):
                # rampa de 3 casillas de ancho y 3 de largo que cruza el borde
                for d in (-1.2, 0, 1.2):
                    px = cx + math.cos(a) * (rx + d) - math.sin(a) * k
                    py = cy + math.sin(a) * (ry + d) + math.cos(a) * k
                    x, y = int(px), int(py)
                    if self.dentro(x, y):
                        self.t[y][x] = "/"
                        self.protegidas.add((x, y))

    def proteger(self, x0, y0, x1, y1, ch=None):
        for y in range(y0, y1):
            for x in range(x0, x1):
                if self.dentro(x, y):
                    if ch is not None and self.t[y][x] not in PASABLES:
                        self.t[y][x] = ch
                    elif ch is not None and self.t[y][x] == "/":
                        self.t[y][x] = ch
                    self.protegidas.add((x, y))

    def nivelar(self, x0, y0, x1, y1, nivel):
        for y in range(y0, y1):
            for x in range(x0, x1):
                if self.dentro(x, y):
                    self.a[y][x] = nivel

    # -- bases -------------------------------------------------------------
    def base(self, cx, cy, hacia_x, hacia_y, salitre=8, pozos=2, cantidad=1500, inicio=True, agua=2500):
        """Base con su Cuartel General centrado en (cx, cy); los yacimientos quedan
        del lado opuesto a (hacia_x, hacia_y)."""
        cx, cy = int(cx), int(cy)
        nivel = self.a[cy][cx]
        tx, ty = cx - 2, cy - 1
        self.proteger(cx - 10, cy - 9, cx + 11, cy + 10, ".")
        self.nivelar(cx - 9, cy - 8, cx + 10, cy + 9, nivel)
        for y in range(cy - 9, cy + 10):
            for x in range(cx - 10, cx + 11):
                if self.dentro(x, y) and self.t[y][x] == "/":
                    self.t[y][x] = "."
        ang0 = math.atan2(cy - hacia_y, cx - hacia_x)
        ocupadas = set()
        for x in range(tx - 1, tx + 5):
            for y in range(ty - 1, ty + 4):
                ocupadas.add((x, y))
        colocadas = 0
        k = 0
        while colocadas < salitre and k < 60:
            frac = (k % 9) / 8 - 0.5
            radio = 6.0 + (k // 9) * 1.3
            a = ang0 + frac * math.radians(150)
            px = int(round(cx + math.cos(a) * radio)) - 1
            py = int(round(cy + math.sin(a) * radio * 0.85))
            k += 1
            celdas = {(px, py), (px + 1, py)}
            if celdas & ocupadas or not all(self.dentro(*c) for c in celdas):
                continue
            ocupadas |= celdas
            self.recursos.append({"tipo": "salitre", "x": px, "y": py, "cantidad": cantidad})
            colocadas += 1
        for i in range(pozos):
            lado = -1 if i % 2 == 0 else 1
            for radio in (7.5, 8.5, 9.5, 10.5):
                a = ang0 + lado * math.radians(108)
                px = int(round(cx + math.cos(a) * radio)) - 1
                py = int(round(cy + math.sin(a) * radio)) - 1
                celdas = {(px + dx, py + dy) for dx in range(3) for dy in range(3)}
                if not celdas & ocupadas and all(self.dentro(*c) for c in celdas):
                    ocupadas |= celdas
                    self.recursos.append({"tipo": "agua", "x": px, "y": py, "cantidad": agua})
                    break
        if inicio:
            self.inicios.append([tx, ty])

    def ramal(self, region):
        """Vía férrea desde el cuartel general hasta el borde del mapa o la vía principal más
        cercana: por ella llega en tren el cuartel general al comenzar la partida. 'region(x, y)'
        dice qué casillas sobreviven a la simetría (la mitad o el cuarto que se define)."""
        tx, ty = self.inicios[-1]
        nivel = self.a[ty + 1][tx + 1]
        bloqueadas = set()
        for x in range(tx, tx + 4):
            for y in range(ty, ty + 3):
                bloqueadas.add((x, y))
        for r in self.recursos:
            rw, rh = (2, 1) if r["tipo"] == "salitre" else (3, 3)
            for x in range(r["x"] - 1, r["x"] + rw + 1):
                for y in range(r["y"] - 1, r["y"] + rh + 1):
                    bloqueadas.add((x, y))

        def libre(x, y):
            return (self.dentro(x, y) and region(x, y) and (x, y) not in bloqueadas
                    and self.t[y][x] in ".,:=" and self.a[y][x] == nivel)

        inicio = [(x, y) for x in range(tx - 1, tx + 5) for y in range(ty - 1, ty + 4)
                  if (x, y) not in bloqueadas and libre(x, y)]
        previo = {c: None for c in inicio}
        cola = deque(inicio)
        fin = None
        while cola:
            x, y = cola.popleft()
            borde = x in (0, self.w - 1) or y in (0, self.h - 1)
            if (borde or (self.t[y][x] == "=" and previo[(x, y)] is not None)) and (x, y) not in inicio:
                fin = (x, y)
                break
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)):
                nx, ny = x + dx, y + dy
                if (nx, ny) in previo or not libre(nx, ny):
                    continue
                if dx and dy and not (libre(x + dx, y) and libre(x, y + dy)):
                    continue
                previo[(nx, ny)] = (x, y)
                cola.append((nx, ny))
        if fin is None:
            raise SystemExit("no hay por dónde tender el ramal hasta el cuartel general")
        c = fin
        while c is not None:
            self.t[c[1]][c[0]] = "="
            c = previo[c]

    # -- simetría ------------------------------------------------------------
    def reflejar_180(self):
        """Copia la mitad izquierda-superior en la otra mitad, rotada 180°."""
        w, h = self.w, self.h
        for y in range(h):
            for x in range(w):
                if (y * w + x) * 2 >= w * h:
                    self.t[y][x] = _rot_char(self.t[h - 1 - y][w - 1 - x])
                    self.a[y][x] = self.a[h - 1 - y][w - 1 - x]

    def reflejar_4(self):
        """Simetría de cuatro: el cuarto superior izquierdo se rota 90° tres veces."""
        n = self.w
        assert self.w == self.h
        for y in range(n):
            for x in range(n):
                if x < n // 2 and y < n // 2:
                    continue
                # rotación de 90 en 90 hasta caer en el cuarto superior izquierdo
                sx, sy = x, y
                for _ in range(3):
                    if sx < n // 2 and sy < n // 2:
                        break
                    sx, sy = sy, n - 1 - sx
                self.t[y][x] = self.t[sy][sx]
                self.a[y][x] = self.a[sy][sx]

    def exportar(self, ident, nombre, descripcion, historia, ambiente="desierto", naval=False, llegada="carreta"):
        return {
            "id": ident, "nombre": nombre, "descripcion": descripcion, "historia": historia,
            "ambiente": ambiente, "ancho": self.w, "alto": self.h, "jugadores": len(self.inicios),
            "naval": naval, "llegada": llegada, "inicios": self.inicios, "recursos": self.recursos,
            "terreno": ["".join(f) for f in self.t],
            "altura": ["".join(str(v) for v in f) for f in self.a],
        }


def _rot_char(ch):
    return ch


def reflejar_recursos_180(lz, recursos, inicios):
    w, h = lz.w, lz.h
    out_r = list(recursos)
    for r in recursos:
        rw, rh = (2, 1) if r["tipo"] == "salitre" else (3, 3)
        out_r.append(dict(r, x=w - r["x"] - rw, y=h - r["y"] - rh))
    out_i = list(inicios)
    for (x, y) in inicios:
        out_i.append([w - x - 4, h - y - 3])
    return out_r, out_i


def rotar_recursos_4(lz, recursos, inicios):
    n = lz.w
    out_r = []
    out_i = []
    for k in range(4):
        for r in recursos:
            rw, rh = (2, 1) if r["tipo"] == "salitre" else (3, 3)
            x, y, ww, hh = r["x"], r["y"], rw, rh
            for _ in range(k):
                x, y, ww, hh = n - y - hh, x, hh, ww
            if (ww, hh) != (rw, rh):
                # el salitre girado queda vertical: se reubica horizontal en el mismo lugar
                ww, hh = rw, rh
            out_r.append(dict(r, x=x, y=y))
        for (x, y) in inicios:
            ww, hh = 4, 3
            for _ in range(k):
                x, y, ww, hh = n - y - hh, x, hh, ww
            out_i.append([x + (ww - 4) // 2, y + (hh - 3) // 2])
    return out_r, out_i


# ======================================================================
# Mapas
# ======================================================================

def pampa_del_tamarugal():
    lz = Lienzo(96, 96, 1879)
    lz.variar_suelo(11, 0.58)
    lz.variar_suelo(12, 0.80, ":")
    # bases en esquinas opuestas (se define la superior izquierda)
    lz.base(14, 14, 48, 48)
    # expansión natural y expansión de la mesa central
    lz.base(16, 40, 48, 48, salitre=6, pozos=1, cantidad=1500, inicio=False)
    lz.base(40, 15, 48, 48, salitre=6, pozos=1, cantidad=1500, inicio=False)
    # meseta de la oficina (nivel 1) con dos rampas
    lz.meseta(30, 30, 7, 6, 1, [45, 225, 135])
    # tamarugales y cerros
    lz.tamarugal(28, 6, 4, 55, 3)
    lz.tamarugal(6, 30, 4, 55, 4)
    lz.tamarugal(44, 34, 3, 45, 5)
    lz.elipse(6, 44, 3, 3, "#", borde_irregular=0.2)
    lz.elipse(54, 8, 5, 3, "#", borde_irregular=0.2)
    lz.elipse(40, 46, 3, 2, "#", borde_irregular=0.3)
    # salar central y vía del ferrocarril salitrero
    lz.elipse(48, 48, 9, 6, ":", solo_si=".,")
    lz.linea(0, 70, 70, 0, "=", 1, solo_si=".,:")
    # pozos del centro (Pozo Almonte)
    lz.recursos.append({"tipo": "agua", "x": 46, "y": 40, "cantidad": 4000})
    for k in range(4):
        lz.recursos.append({"tipo": "salitre", "x": 40 + k * 2, "y": 37, "cantidad": 2000})
    lz.ramal(lambda x, y: (y * lz.w + x) * 2 < lz.w * lz.h)
    lz.reflejar_180()
    lz.recursos, lz.inicios = reflejar_recursos_180(lz, lz.recursos, lz.inicios)
    return lz.exportar(
        "pampa_del_tamarugal", "Pampa del Tamarugal",
        "2 jugadores. Llanura salitrera con tamarugales, la vía del ferrocarril y los pozos del centro.",
        "La pampa del Tamarugal, entre la cordillera de la Costa y los Andes, concentraba las "
        "oficinas salitreras de Tarapacá. Por ella marcharon los ejércitos en noviembre de 1879, "
        "de Dolores a Tarapacá, buscando siempre el agua de los pozos.", llegada="tren")


def alto_de_la_alianza():
    lz = Lienzo(96, 112, 1880)
    lz.variar_suelo(21, 0.6)
    lz.base(18, 14, 48, 56)
    lz.base(44, 12, 48, 56, salitre=6, pozos=1, inicio=False)
    lz.base(12, 38, 48, 56, salitre=6, pozos=1, inicio=False)
    # la meseta del Intiorko (nivel 1 y cumbre nivel 2)
    lz.meseta(48, 56, 20, 9, 1, [0, 180, 90, 270])
    lz.meseta(48, 56, 7, 3, 2, [0, 180])
    lz.elipse(30, 30, 4, 3, "#", borde_irregular=0.25)
    lz.elipse(70, 26, 6, 3, "#", borde_irregular=0.25)
    lz.tamarugal(80, 10, 5, 35, 8)
    lz.linea(0, 48, 30, 30, "=", 1, solo_si=".,")
    lz.recursos.append({"tipo": "agua", "x": 46, "y": 54, "cantidad": 4000})
    lz.ramal(lambda x, y: (y * lz.w + x) * 2 < lz.w * lz.h)
    lz.reflejar_180()
    lz.recursos, lz.inicios = reflejar_recursos_180(lz, lz.recursos, lz.inicios)
    return lz.exportar(
        "alto_de_la_alianza", "Alto de la Alianza (Tacna)",
        "2 jugadores. Dominar la meseta del Intiorko da la ventaja de la altura.",
        "El 26 de mayo de 1880 el ejército aliado de Campero esperó en la meseta del cerro "
        "Intiorko, al norte de Tacna, al ejército chileno de Baquedano. La IV División chilena "
        "envolvió el ala derecha aliada y tomó su artillería: Bolivia no volvió a combatir.", llegada="tren")


def morro_de_arica():
    lz = Lienzo(112, 96, 7)
    lz.variar_suelo(31, 0.6)
    # mar al oeste (se refleja: también al este) y el Morro en el centro
    for y in range(lz.h):
        borde = 10 + int(3 * math.sin(y / 7.0))
        for x in range(borde):
            lz.t[y][x] = "~"
    lz.base(24, 16, 56, 48)
    lz.base(22, 42, 56, 48, salitre=6, pozos=1, inicio=False)
    lz.base(48, 12, 56, 48, salitre=6, pozos=1, inicio=False)
    lz.meseta(56, 48, 12, 10, 1, [90, 270, 0])
    lz.meseta(56, 48, 5, 4, 2, [270])
    lz.elipse(36, 32, 3, 3, "#", borde_irregular=0.3)
    lz.elipse(80, 20, 4, 3, "#", borde_irregular=0.3)
    lz.recursos.append({"tipo": "agua", "x": 55, "y": 47, "cantidad": 4000})
    lz.reflejar_180()
    lz.recursos, lz.inicios = reflejar_recursos_180(lz, lz.recursos, lz.inicios)
    return lz.exportar(
        "morro_de_arica", "Morro de Arica",
        "2 jugadores. El Morro domina el centro; la costa permite muelles y cañoneras.",
        "Arica, con los fuertes Ciudadela y del Este y las baterías del Morro, fue tomada al "
        "asalto el 7 de junio de 1880 en unos 55 minutos. Murieron Bolognesi, Ugarte y More; "
        "del lado chileno, el comandante Juan José San Martín, a pocos metros de la cumbre.",
        ambiente="costa")


def islas_de_chincha():
    lz = Lienzo(112, 112, 1864, fondo="~")
    # cuatro islas principales (una por jugador) y una central rica
    def isla(cx, cy, rx, ry, sem):
        lz.elipse(cx, cy, rx, ry, ".", borde_irregular=0.12)
        lz.variar_suelo(sem, 0.65)
    isla(22, 22, 17, 16, 41)
    for y in range(lz.h):
        for x in range(lz.w):
            if lz.t[y][x] == "," and ((x - 22) ** 2 + (y - 22) ** 2) > 17 ** 2:
                lz.t[y][x] = "~"
    lz.base(22, 22, 56, 56)
    lz.elipse(30, 10, 3, 2, "#", borde_irregular=0.3, solo_si=".,")
    lz.tamarugal(12, 30, 3, 40, 9)
    # islote intermedio con salitre
    lz.elipse(52, 26, 6, 5, ".", borde_irregular=0.15)
    for k in range(4):
        lz.recursos.append({"tipo": "salitre", "x": 49 + k * 2 - 1, "y": 24, "cantidad": 1800})
    lz.reflejar_4()
    # isla central (guano y salitre)
    lz.elipse(56, 56, 11, 11, ".", borde_irregular=0.1)
    lz.elipse(56, 56, 4, 4, nivel=1)
    recursos, inicios = rotar_recursos_4(lz, lz.recursos, lz.inicios)
    centro = [{"tipo": "agua", "x": 55, "y": 55, "cantidad": 5000}]
    for k in range(6):
        a = math.radians(30 + k * 60)
        centro.append({"tipo": "salitre", "x": int(56 + math.cos(a) * 7.5) - 1,
                       "y": int(56 + math.sin(a) * 7.5), "cantidad": 2500})
    lz.recursos = recursos + centro
    lz.inicios = inicios
    return lz.exportar(
        "islas_de_chincha", "Islas de Chincha",
        "4 jugadores (o 2 contra 2). Cada nación en su isla: hacen falta muelles y transportes.",
        "Las islas guaneras de Chincha, frente a Pisco, fueron la gran riqueza del Perú antes "
        "del salitre. En el juego son un escenario naval: como en Pisagua, Pacocha y Curayaco, "
        "la guerra se gana desembarcando.",
        ambiente="costa", naval=True)


def cuatro_naciones():
    lz = Lienzo(128, 128, 1881)
    lz.variar_suelo(51, 0.57)
    lz.base(18, 18, 64, 64)
    lz.base(44, 16, 64, 64, salitre=6, pozos=1, inicio=False)
    lz.base(16, 44, 64, 64, salitre=6, pozos=1, inicio=False)
    # cordón de cerros con un paso
    lz.elipse(40, 40, 4, 4, "#", borde_irregular=0.3)
    lz.elipse(28, 52, 3, 5, "#", borde_irregular=0.25)
    lz.elipse(52, 28, 5, 3, "#", borde_irregular=0.25)
    lz.tamarugal(50, 6, 4, 45, 21)
    lz.meseta(36, 36, 5, 5, 1, [45, 225])
    lz.linea(0, 63, 63, 63, "=", 1, solo_si=".,:")
    lz.ramal(lambda x, y: x < lz.w // 2 and y < lz.h // 2)
    lz.reflejar_4()
    lz.elipse(64, 64, 14, 14, ":", solo_si=".,")
    recursos, inicios = rotar_recursos_4(lz, lz.recursos, lz.inicios)
    centro = [{"tipo": "agua", "x": 63, "y": 63, "cantidad": 5000}]
    for k in range(8):
        a = math.radians(k * 45 + 22)
        centro.append({"tipo": "salitre", "x": int(64 + math.cos(a) * 9) - 1,
                       "y": int(64 + math.sin(a) * 9), "cantidad": 2000})
    lz.recursos = recursos + centro
    lz.inicios = inicios
    return lz.exportar(
        "cuatro_naciones", "Cuatro naciones: el gran salar",
        "4 jugadores (todos contra todos o 2 contra 2). Chile, Perú, Bolivia y Argentina en torno al salar.",
        "Escenario hipotético: las cuatro naciones del cono sur disputan el salitre. En 1879 la "
        "Argentina se declaró neutral, pero su conflicto de límites con Chile la llevó al borde "
        "de la guerra hasta el Tratado de 1881.", llegada="tren")


def quebrada_de_tarapaca():
    lz = Lienzo(88, 120, 1127)
    lz.variar_suelo(61, 0.6)
    # la quebrada atraviesa el mapa en zigzag con dos cruces
    def curva(y):
        return int(round(43.5 + 10 * math.sin((y - 59.5) / 11.0)))
    for y in range(lz.h):
        x = curva(y)
        for ox in range(-2, 3):
            lz.poner(x + ox, y, "q")
    lz.base(18, 16, 44, 60)
    lz.base(16, 44, 44, 60, salitre=6, pozos=1, inicio=False)
    lz.meseta(64, 30, 8, 7, 1, [180, 90])
    lz.tamarugal(30, 32, 4, 45, 31)
    lz.elipse(8, 70, 3, 6, "#", borde_irregular=0.2)
    lz.reflejar_180()
    # cruces sobre la quebrada (pueblo de Tarapacá y Huarasiña)
    for cy in (34, 85):
        x = curva(cy)
        for ox in range(-4, 5):
            for oy in range(-1, 2):
                if lz.dentro(x + ox, cy + oy):
                    lz.t[cy + oy][x + ox] = "="
    lz.recursos, lz.inicios = reflejar_recursos_180(lz, lz.recursos, lz.inicios)
    return lz.exportar(
        "quebrada_de_tarapaca", "Quebrada de Tarapacá",
        "2 jugadores. Una quebrada profunda solo se cruza por dos pasos.",
        "El 27 de noviembre de 1879 las tropas peruanas de Buendía, Suárez y Cáceres vencieron "
        "en la quebrada de Tarapacá a la columna chilena; allí murió el comandante Eleuterio "
        "Ramírez, del 2º de Línea.")


MAPAS = [pampa_del_tamarugal, alto_de_la_alianza, morro_de_arica, islas_de_chincha,
         cuatro_naciones, quebrada_de_tarapaca]


def limpiar(d):
    """Quita recursos sobre terreno no pisable y despeja su alrededor."""
    w, h = d["ancho"], d["alto"]
    t = [list(f) for f in d["terreno"]]
    for r in d["recursos"]:
        rw, rh = (2, 1) if r["tipo"] == "salitre" else (3, 3)
        for y in range(r["y"] - 1, r["y"] + rh + 1):
            for x in range(r["x"] - 1, r["x"] + rw + 1):
                if 0 <= x < w and 0 <= y < h and t[y][x] not in ".,:=":
                    t[y][x] = "."
    for (x0, y0) in d["inicios"]:
        for y in range(y0 - 1, y0 + 4):
            for x in range(x0 - 1, x0 + 5):
                if 0 <= x < w and 0 <= y < h and t[y][x] != "=":    # el ramal llega hasta el cuartel
                    t[y][x] = "."
    d["terreno"] = ["".join(f) for f in t]
    # niveles: la casilla de un recurso o inicio hereda el nivel de su esquina
    return d


def comprobar(d):
    datos = MapaDatos(d)
    mapa = Mapa(datos)
    from salitre.sim.constantes import TIERRA
    reg = mapa.region[TIERRA]
    regiones = set()
    for (x, y) in datos.inicios:
        i = mapa.pasable_cercana(TIERRA, x + 1, y + 4, 4)
        regiones.add(reg[i] if i is not None else None)
    if not datos.naval and len(regiones) != 1:
        raise SystemExit(f"{datos.id}: los inicios no están conectados por tierra {regiones}")
    for r in datos.recursos:
        rw, rh = (2, 1) if r["tipo"] == "salitre" else (3, 3)
        alrededor = [mapa.pasable[TIERRA][yy * mapa.w + xx]
                     for yy in range(r["y"] - 1, r["y"] + rh + 1)
                     for xx in range(r["x"] - 1, r["x"] + rw + 1)
                     if 0 <= xx < mapa.w and 0 <= yy < mapa.h
                     and not (r["x"] <= xx < r["x"] + rw and r["y"] <= yy < r["y"] + rh)]
        if not any(alrededor):
            raise SystemExit(f"{datos.id}: recurso inaccesible en {r['x']},{r['y']}")
    return datos


def main():
    filtro = sys.argv[1] if len(sys.argv) > 1 else ""
    salida = RAIZ / "mapas"
    salida.mkdir(exist_ok=True)
    for f in MAPAS:
        if filtro and filtro not in f.__name__:
            continue
        d = limpiar(f())
        comprobar(d)
        ruta = salida / f"{d['id']}.json"
        ruta.write_text(json.dumps(d, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"{ruta.name}: {d['ancho']}x{d['alto']}, {d['jugadores']} jugadores, "
              f"{len(d['recursos'])} recursos")


if __name__ == "__main__":
    main()
