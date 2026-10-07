"""Compone y sintetiza la música del juego: piezas originales para banda militar.

    marcha.ogg   «Marcha del Salitre» (menús): Si bemol mayor, 2/4, 116 negras por
                 minuto. Introducción con redoble y fanfarria, primera parte (dos
                 veces, la segunda con la lira), segunda parte en sol menor, trío en
                 mi bemol con el bombardino, puente de los bajos y trío final con toda
                 la banda.
    campana.ogg  «Vivac en la pampa» (batalla): re menor, 4/4, 88 negras por minuto.
                 Cadencia de caja, pedal de tuba, tema de los cornos, un toque de
                 corneta a lo lejos y el tema con toda la banda. Suena por debajo del
                 fuego (el juego la baja un 30 %).

Los instrumentos se sintetizan aquí, sin muestras grabadas: cornetas, cornos,
bombardino y tuba por síntesis aditiva con el brillo que crece al soplar; lira
de campanas; caja, bombo y platillos con ruido filtrado. La reverberación es una
respuesta sintética de sala. El final de cada pieza se funde con su comienzo
para que el bucle no se note. Son composiciones originales: no hay derechos de
terceros.

Requisitos (solo para regenerar la música; el juego no los necesita):
    pip install numpy soundfile

Uso:
    python herramientas/generar_musica.py [--salida recursos/sonidos/musica] [--solo marcha]
"""

import argparse
import math
import re
import sys
import zlib
from pathlib import Path

import numpy as np

RAIZ = Path(__file__).resolve().parent.parent
SR = 44100
SEMILLA = 1879

# ----------------------------------------------------------------------
# Alturas y acordes
NOMBRES = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


def midi(nombre):
    """'Bb4' -> 70; 'F#5' -> 78."""
    m = re.fullmatch(r"([A-G])(#|b)?(-?\d)", nombre)
    if not m:
        raise ValueError(f"nota inválida: {nombre}")
    n = NOMBRES[m.group(1)] + {"#": 1, "b": -1, None: 0}[m.group(2)]
    return n + 12 * (int(m.group(3)) + 1)


def frec(m):
    return 440.0 * 2 ** ((m - 69) / 12)


CALIDADES = {"": (0, 4, 7), "m": (0, 3, 7), "7": (0, 4, 7, 10), "m7": (0, 3, 7, 10), "dim7": (0, 3, 6, 9),
             "maj7": (0, 4, 7, 11)}


def acorde(nombre):
    """'Bb' -> (10, (0, 4, 7)); 'F#dim7' -> (6, (0, 3, 6, 9)). Raíz como clase de altura."""
    m = re.fullmatch(r"([A-G])(#|b)?(m7|maj7|dim7|m|7)?", nombre)
    if not m:
        raise ValueError(f"acorde inválido: {nombre}")
    raiz = (NOMBRES[m.group(1)] + {"#": 1, "b": -1, None: 0}[m.group(2)]) % 12
    return raiz, CALIDADES[m.group(3) or ""]


def tonos(nombre):
    raiz, cal = acorde(nombre)
    return [(raiz + i) % 12 for i in cal]


def mas_cercana(clase, cerca, lo, hi):
    """La nota de esa clase de altura más cercana a 'cerca' dentro de [lo, hi]."""
    cands = [n for n in range(lo, hi + 1) if n % 12 == clase]
    if not cands:                      # registro más corto que una octava: se amplía
        cands = [n for n in range(lo - 12, hi + 13) if n % 12 == clase]
    return min(cands, key=lambda n: (abs(n - cerca), n))


# ----------------------------------------------------------------------
# Partitura
class Pieza:
    """Notas en segundos por instrumento: [(inicio, midi o None, duración, intensidad)]."""

    def __init__(self, bpm, tiempos_compas):
        self.bpm = bpm
        self.tc = tiempos_compas                  # negras por compás
        self.semi = 60.0 / bpm / 4                # duración de una semicorchea
        self.compas = self.semi * 4 * tiempos_compas
        self.voces = {}
        self.golpes = {}                          # percusión: instrumento -> [(t, intensidad, variante)]

    def t(self, compas, semis=0):
        return compas * self.compas + semis * self.semi

    def linea(self, voz, texto, compas0, intensidad=1.0, articulacion=0.95, transporte=0):
        """'Bb4:4 D5:2 F5:2 | ...' en semicorcheas; 'r' es silencio. Devuelve el compás siguiente."""
        semis_compas = 4 * self.tc
        compas = compas0
        for barra in texto.split("|"):
            barra = barra.strip()
            if not barra:
                continue
            pos = 0
            for tok in barra.split():
                nota, _, dur = tok.partition(":")
                dur = int(dur)
                if nota != "r":
                    self.voces.setdefault(voz, []).append(
                        (self.t(compas, pos), midi(nota) + transporte, dur * self.semi * articulacion, intensidad))
                pos += dur
            if pos != semis_compas:
                raise ValueError(f"{voz}: el compás {compas} dura {pos} semicorcheas y no {semis_compas}: {barra}")
            compas += 1
        return compas

    def nota(self, voz, t, m, dur, intensidad=1.0):
        self.voces.setdefault(voz, []).append((t, m, dur, intensidad))

    def golpe(self, inst, t, intensidad=1.0, variante=0):
        self.golpes.setdefault(inst, []).append((t, intensidad, variante))


def compases(texto):
    """'Bb Gm | F7 | ...' -> [['Bb', 'Gm'], ['F7'], ...]: uno o más acordes por compás."""
    return [b.split() for b in texto.split("|") if b.strip()]


# ----- acompañamientos -------------------------------------------------
def tuba_oompah(p, armonia, compas0, intensidad=0.9, oct_lo=midi("Bb1"), oct_hi=midi("F3")):
    """Bajo de marcha: fundamental en el primer tiempo y quinta en el segundo (2/4)."""
    previa = midi("Bb2")
    for k, acs in enumerate(armonia):
        for tiempo in range(p.tc):
            nombre = acs[min(len(acs) - 1, tiempo * len(acs) // p.tc)]
            raiz, cal = acorde(nombre)
            clase = raiz if tiempo % 2 == 0 else (raiz + cal[2]) % 12
            m = mas_cercana(clase, previa, oct_lo, oct_hi)
            previa = m
            p.nota("tuba", p.t(compas0 + k, tiempo * 4), m, p.semi * 2.4, intensidad * (1.0 if tiempo == 0 else 0.85))


def cornos_contratiempo(p, armonia, compas0, intensidad=0.55, centro=midi("A4")):
    """Los cornos en los contratiempos (la corchea débil de cada tiempo) con dos notas del acorde."""
    for k, acs in enumerate(armonia):
        for tiempo in range(p.tc):
            nombre = acs[min(len(acs) - 1, tiempo * len(acs) // p.tc)]
            cl = tonos(nombre)
            notas = sorted({mas_cercana(cl[1], centro - 2, midi("D4"), midi("D5")),
                            mas_cercana(cl[2] if len(cl) > 2 else cl[0], centro + 2, midi("F4"), midi("F5"))})
            for m in notas:
                p.nota("cornos", p.t(compas0 + k, tiempo * 4 + 2), m, p.semi * 1.3, intensidad)


def contracanto(p, voz, armonia, compas0, intensidad=0.6, lo=midi("Bb2"), hi=midi("F4"), inicio=midi("D3")):
    """Notas largas en la tercera (o la séptima) de cada acorde, con el menor salto posible."""
    previa = inicio
    for k, acs in enumerate(armonia):
        dur_ac = p.compas / len(acs)
        for j, nombre in enumerate(acs):
            cl = tonos(nombre)
            cands = [cl[1]] + ([cl[3]] if len(cl) > 3 else [])
            m = min((mas_cercana(c, previa, lo, hi) for c in cands), key=lambda n: abs(n - previa))
            previa = m
            p.nota(voz, p.t(compas0 + k) + j * dur_ac, m, dur_ac * 0.97, intensidad)


def pedal(p, voz, armonia, compas0, octava_lo, octava_hi, intensidad=0.5, quinta=False):
    """Notas tenidas en la fundamental (y la quinta) de cada acorde."""
    previa = None
    for k, acs in enumerate(armonia):
        dur_ac = p.compas / len(acs)
        for j, nombre in enumerate(acs):
            raiz, cal = acorde(nombre)
            m = mas_cercana(raiz, previa if previa is not None else (octava_lo + octava_hi) // 2, octava_lo,
                            octava_hi)
            previa = m
            p.nota(voz, p.t(compas0 + k) + j * dur_ac, m, dur_ac * 0.98, intensidad)
            if quinta:
                p.nota(voz, p.t(compas0 + k) + j * dur_ac, m + cal[2], dur_ac * 0.98, intensidad * 0.8)


# ----- percusión ---------------------------------------------------------
def caja_marcha(p, compas0, n, intensidad=0.8, redoble_cada=4):
    """Caja de marcha en 2/4: golpes en los tiempos, adornos en semicorcheas y un redoble cada tanto."""
    patron = [1.0, 0, 0.55, 0.45, 0.9, 0, 0.6, 0]
    for k in range(n):
        c = compas0 + k
        if redoble_cada and k % redoble_cada == redoble_cada - 1:
            for j in range(12):                          # redoble en fusas que crece hasta el tiempo
                p.golpe("caja", p.t(c, j * 0.5), intensidad * (0.35 + 0.04 * j), 1)
            p.golpe("caja", p.t(c, 6), intensidad * 1.0, 0)
            continue
        for j, v in enumerate(patron):
            if v:
                p.golpe("caja", p.t(c, j), intensidad * v, 0 if v > 0.8 else 1)


def bombo_marcha(p, compas0, n, intensidad=0.9, platillos=True, platillo_suave=False):
    for k in range(n):
        c = compas0 + k
        for tiempo in range(p.tc):
            p.golpe("bombo", p.t(c, tiempo * 4), intensidad * (1.0 if tiempo == 0 else 0.8))
            if platillos:
                p.golpe("platillo_corto", p.t(c, tiempo * 4), intensidad * (0.55 if platillo_suave else 0.8))


def redoble(p, t0, t1, i0, i1, inst="caja"):
    """Redoble apretado (fusas) que pasa de la intensidad i0 a i1."""
    paso = p.semi / 2
    n = max(1, int((t1 - t0) / paso))
    for j in range(n):
        p.golpe(inst, t0 + j * paso, i0 + (i1 - i0) * j / n, 1)


def cadencia_campana(p, compas0, n, intensidad=0.5):
    """Cadencia de caja en 4/4 para la marcha de campaña: acentos, notas fantasma y redobles cortos."""
    patrones = [
        [1.0, 0, 0.3, 0.3, 0.7, 0, 0.3, 0, 0.9, 0, 0.3, 0.3, 0.7, 0.3, 0.5, 0.3],
        [1.0, 0, 0.3, 0, 0.7, 0.3, 0.3, 0, 0.9, 0, 0.3, 0.3, 0, 0, 0.6, 0.6],
    ]
    for k in range(n):
        pat = patrones[k % 2]
        for j, v in enumerate(pat):
            if v:
                p.golpe("caja", p.t(compas0 + k, j), intensidad * v, 0 if v >= 0.7 else 1)


def bombo_campana(p, compas0, n, intensidad=0.6):
    for k in range(n):
        p.golpe("bombo", p.t(compas0 + k, 0), intensidad)
        p.golpe("bombo", p.t(compas0 + k, 8), intensidad * 0.75)


def armonizar(p, origen, destino, armonia, compas0, intensidad=0.6, lo=midi("F3"), hi=midi("D5")):
    """Segunda voz: bajo cada nota de 'origen' (desde el compás compas0), la nota más alta del
    acorde del momento que quede entre una tercera menor y una sexta por debajo."""
    t0 = p.t(compas0)
    t1 = p.t(compas0 + len(armonia))
    nuevas = []
    for t, m, dur, inten in p.voces.get(origen, []):
        if not (t0 - 1e-6 <= t < t1 - 1e-6):
            continue
        k = int((t - t0) / p.compas)
        acs = armonia[k]
        j = min(len(acs) - 1, int((t - p.t(compas0 + k)) / (p.compas / len(acs))))
        cl = tonos(acs[j])
        cands = [n for n in range(m - 9, m - 2) if n % 12 in cl and lo <= n <= hi]
        if cands:
            nuevas.append((t, max(cands), dur, intensidad * inten))
    p.voces.setdefault(destino, []).extend(nuevas)


# ----------------------------------------------------------------------
# Instrumentos
def _semilla(*partes):
    """Semilla estable entre ejecuciones (hash() de Python cambia en cada una)."""
    return zlib.crc32(repr((SEMILLA,) + partes).encode())


def _filtro(x, lo, hi, suave=0.25):
    """Pasa banda por FFT con flancos suaves (lo o hi pueden ser None)."""
    n = len(x)
    f = np.fft.rfftfreq(n, 1 / SR)
    g = np.ones_like(f)
    if lo:
        g *= 1 / (1 + (lo / np.maximum(f, 1.0)) ** (2 / suave))
    if hi:
        g *= 1 / (1 + (f / hi) ** (2 / suave))
    return np.fft.irfft(np.fft.rfft(x) * g, n)


def _envolvente(n_on, n_rel, ataque, caida, sostenido):
    n = n_on + n_rel
    t = np.arange(n) / SR
    a = max(1, int(ataque * SR))
    env = np.empty(n)
    sube = np.minimum(1.0, t[:a] / ataque)
    env[:a] = sube * sube * (3 - 2 * sube)            # curva suave
    resto = t[a:] - ataque
    env[a:] = sostenido + (1 - sostenido) * np.exp(-resto / max(1e-4, caida))
    if n_rel:
        fin = env[n_on - 1] if n_on > 0 else 0.0
        env[n_on:] = fin * np.exp(-np.arange(n_rel) / (0.25 * n_rel))
        env[-min(64, n_rel):] *= np.linspace(1, 0, min(64, n_rel))
    return env


PERFILES = {
    # brillo base y con el soplo (en múltiplos de la fundamental), ataque, caída, sostenido, vibrato
    "cornetas": (2.6, 9.0, 0.028, 0.12, 0.78, 0.0045),
    "cornos": (1.8, 4.5, 0.035, 0.10, 0.70, 0.0),
    "cornos_largos": (1.6, 4.0, 0.09, 0.4, 0.82, 0.0030),
    "bombardino": (1.7, 5.0, 0.045, 0.2, 0.82, 0.0040),
    "tuba": (1.5, 4.0, 0.03, 0.10, 0.7, 0.0),
    "tuba_larga": (1.4, 3.0, 0.12, 0.6, 0.85, 0.0),
    "corneta_lejana": (2.2, 7.0, 0.03, 0.15, 0.8, 0.0030),
}


def metal(m, dur, intensidad, perfil, rng):
    """Bronce por síntesis aditiva: armónicos 1/k con un corte que se abre al soplar."""
    brillo0, brillo1, ataque, caida, sost, vib = PERFILES[perfil]
    f = frec(m)
    rel = 0.11
    n_on, n_rel = max(1, int(dur * SR)), int(rel * SR)
    n = n_on + n_rel
    t = np.arange(n) / SR
    env = _envolvente(n_on, n_rel, ataque, caida, sost)
    vibr = vib * np.sin(2 * np.pi * rng.uniform(4.8, 5.6) * t + rng.uniform(0, 6.28)) * np.clip((t - 0.2) / 0.3, 0, 1)
    caida_tono = -0.018 * np.exp(-t / 0.022)          # el labio «entra» en la nota
    fase = 2 * np.pi * np.cumsum(f * (1 + vibr + caida_tono)) / SR
    corte = f * (brillo0 + brillo1 * intensidad * env)   # Hz
    out = np.zeros(n)
    nk = int(min(36, (SR / 2 - 1200) / f))
    for k in range(1, nk + 1):
        amp = (1.0 / k) / (1.0 + (k * f / corte) ** 4)
        out += amp * np.sin(k * fase + rng.uniform(0, 0.3))
    return out * env * intensidad


def lira(m, dur, intensidad, rng):
    """Lira de campanas (glockenspiel de banda): parciales inarmónicos que se apagan solos."""
    f = frec(m)
    n = int(1.8 * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for r, a, d in ((1.0, 1.0, 1.1), (2.76, 0.32, 0.38), (5.40, 0.12, 0.16), (8.93, 0.05, 0.08)):
        if f * r < SR / 2 - 500:
            out += a * np.exp(-t / d) * np.sin(2 * np.pi * f * r * t)
    out[:44] *= np.linspace(0, 1, 44)
    return out * intensidad


def caja(intensidad, variante, rng):
    n = int(0.32 * SR)
    t = np.arange(n) / SR
    ruido = rng.standard_normal(n)
    tono = 192 * (1 - 0.18 * np.minimum(t / 0.05, 1))
    cuerpo = np.sin(2 * np.pi * np.cumsum(tono) / SR) * np.exp(-t / 0.035)
    bordon = _filtro(ruido, 1700, 9500) * np.exp(-t / (0.10 if variante == 0 else 0.07))
    golpe = _filtro(ruido, 300, 2800) * np.exp(-t / 0.012)
    s = 0.55 * cuerpo + 0.85 * bordon + 0.45 * golpe
    s[:20] *= np.linspace(0, 1, 20)
    return s * intensidad * (1.0 if variante == 0 else 0.8)


def bombo(intensidad, variante, rng):
    n = int(0.7 * SR)
    t = np.arange(n) / SR
    tono = 54 + 40 * np.exp(-t / 0.04)
    s = np.sin(2 * np.pi * np.cumsum(tono) / SR) * np.exp(-t / 0.26)
    s += 0.35 * _filtro(rng.standard_normal(n), 60, 900) * np.exp(-t / 0.018)
    s[:30] *= np.linspace(0, 1, 30)
    return s * intensidad


def platillo(intensidad, variante, rng, largo=1.7):
    n = int(largo * SR)
    t = np.arange(n) / SR
    metalico = np.zeros(n)
    for f in (205.3, 304.4, 369.6, 522.7, 540.0, 800.0):          # cuadradas inarmónicas
        metalico += np.sign(np.sin(2 * np.pi * f * 1.37 * t + rng.uniform(0, 6)))
    s = 0.55 * _filtro(metalico, 6000, 14000) + 0.8 * _filtro(rng.standard_normal(n), 3500, 15000)
    env = np.exp(-t / (largo * 0.32))
    env[:60] *= np.linspace(0, 1, 60)
    return s * env * intensidad


def platillo_corto(intensidad, variante, rng):
    return platillo(intensidad, variante, rng, largo=0.28) * 0.8


GENERADORES_GOLPE = {"caja": caja, "bombo": bombo, "platillo": platillo, "platillo_corto": platillo_corto}

# mezcla: (ganancia, paneo -1 izquierda .. 1 derecha)
MEZCLA = {
    "cornetas": (0.95, -0.25), "cornos": (0.42, 0.35), "cornos_largos": (0.42, 0.3), "bombardino": (0.62, -0.1),
    "tuba": (0.78, 0.0), "tuba_larga": (0.62, 0.0), "lira": (0.36, 0.45), "corneta_lejana": (0.5, 0.55),
    "caja": (0.40, 0.15), "bombo": (0.80, 0.0), "platillo": (0.20, -0.2), "platillo_corto": (0.16, 0.2),
}


def renderizar(p, largo, humanizar=0.004):
    """Mezcla en estéreo todas las notas y golpes de la pieza (largo en segundos, sin la cola)."""
    n = int((largo + 4.0) * SR)
    out = np.zeros((n, 2))
    rng = np.random.default_rng(SEMILLA)

    def poner(senal, t0, voz):
        g, pan = MEZCLA[voz]
        i0 = max(0, int(t0 * SR))
        i1 = min(n, i0 + len(senal))
        if i1 <= i0:
            return
        ang = (pan + 1) * math.pi / 4
        out[i0:i1, 0] += senal[:i1 - i0] * g * math.cos(ang)
        out[i0:i1, 1] += senal[:i1 - i0] * g * math.sin(ang)

    for voz, notas in p.voces.items():
        for t0, m, dur, inten in notas:
            t0 += rng.normal(0, humanizar)
            inten *= rng.uniform(0.92, 1.05)
            r = np.random.default_rng(rng.integers(2 ** 32))
            if voz == "lira":
                s = lira(m, dur, inten, r)
            else:
                s = metal(m, dur, inten, voz, r)
            poner(s, t0, voz)
    cache = {}
    for inst, golpes in p.golpes.items():
        for t0, inten, var in golpes:
            t0 += rng.normal(0, humanizar * 0.5)
            clave = (inst, var, int(rng.integers(6)))
            if clave not in cache:
                cache[clave] = GENERADORES_GOLPE[inst](1.0, var, np.random.default_rng(_semilla(*clave)))
            poner(cache[clave] * inten * rng.uniform(0.9, 1.06), t0, inst)
    return out


def reverberar(x, rt60=1.4, humedo=0.22, predemora=0.014):
    """Sala sintética: respuesta de ruido que decae (distinta en cada canal), convolución por FFT."""
    rng = np.random.default_rng(SEMILLA + 7)
    n_ir = int(rt60 * 1.3 * SR)
    t = np.arange(n_ir) / SR
    caida = 10 ** (-3 * t / rt60)
    pre = int(predemora * SR)
    y = np.empty_like(x)
    largo = x.shape[0] + n_ir + pre
    nfft = 1 << (largo - 1).bit_length()
    for c in range(2):
        ir = _filtro(rng.standard_normal(n_ir), 120, 6500) * caida
        ir = np.concatenate([np.zeros(pre), ir])
        ir /= np.sqrt(np.sum(ir ** 2))
        conv = np.fft.irfft(np.fft.rfft(x[:, c], nfft) * np.fft.rfft(ir, nfft), nfft)[:x.shape[0]]
        y[:, c] = x[:, c] + humedo * conv
    return y


def masterizar(x, largo_bucle, pico=0.89, impulso=1.35):
    """Pliega la cola sobre el comienzo (bucle sin costura), comprime suave y deja el pico en -1 dBFS."""
    n = int(largo_bucle * SR)
    cola = x[n:]
    x = x[:n].copy()
    x[:len(cola)] += cola[:n]
    for c in range(x.shape[1]):                      # fuera el retumbo bajo 30 Hz
        x[:, c] = _filtro(x[:, c], 30, None, suave=0.5)
    x /= np.max(np.abs(x)) + 1e-9
    x = np.tanh(x * impulso) / np.tanh(impulso)
    x *= pico / (np.max(np.abs(x)) + 1e-9)
    return x


# ----------------------------------------------------------------------
# «Marcha del Salitre»
TEMA_A = ("Bb4:4 D5:2 F5:2 | Bb5:6 A5:1 G5:1 | F5:4 Eb5:2 C5:2 | D5:6 r:2 | Eb5:3 F5:1 G5:2 Eb5:2 | "
          "D5:3 Eb5:1 F5:2 D5:2 | C5:2 D5:2 Eb5:2 C5:2 | F5:6 r:2 | Bb4:4 D5:2 F5:2 | Bb5:6 C6:1 D6:1 | "
          "Eb6:4 C6:2 A5:2 | Bb5:4 F5:2 D5:2 | G5:3 A5:1 Bb5:2 G5:2 | F5:3 G5:1 A5:2 F5:2 | "
          "Eb5:2 D5:2 C5:2 A4:2 | Bb4:6 r:2")
ARM_A = "Bb | Gm | F7 | Bb | Eb | Bb | Cm | F | Bb | Bb | F7 | Bb | Eb | F | F7 | Bb"
TEMA_B = ("D5:4 G5:2 A5:2 | Bb5:4 A5:2 G5:2 | F#5:4 A5:2 D5:2 | G5:6 r:2 | Eb5:4 G5:2 C6:2 | "
          "Bb5:4 A5:2 G5:2 | A5:3 Bb5:1 A5:2 F#5:2 | G5:6 r:2 | D5:4 G5:2 A5:2 | Bb5:4 C6:2 D6:2 | "
          "Eb6:4 D6:2 C6:2 | D6:4 Bb5:2 G5:2 | C6:3 Bb5:1 A5:2 G5:2 | F5:4 A5:2 C6:2 | Eb6:2 D6:2 C6:2 A5:2 | "
          "Bb5:6 r:2")
ARM_B = "Gm | Gm | D7 | Gm | Cm | Gm | D7 | Gm | Gm | Gm | Cm | Gm | Cm | F | F7 | Bb"
PASO_TRIO = "F5:2 r:2 F5:2 r:2 | F5:2 r:2 A5:2 r:2 | Ab5:2 r:2 Ab5:2 r:2 | Ab5:4 r:4"
ARM_PASO = "F7 | F7 | Bb7 | Bb7"
TRIO = ("G4:4 Bb4:4 | Eb5:6 D5:2 | C5:4 Eb5:4 | Bb4:8 | Ab4:4 C5:4 | F5:6 Eb5:2 | D5:4 F5:4 | Eb5:8 | "
        "G4:4 Bb4:4 | Eb5:6 F5:2 | G5:4 F5:2 Eb5:2 | C5:8 | Bb4:4 Eb5:2 G5:2 | F5:4 D5:2 Bb4:2 | "
        "C5:3 D5:1 Eb5:2 F5:2 | Eb5:8")
ARM_TRIO = "Eb | Eb | Ab | Eb | Ab | Bb7 | Bb7 | Eb | Eb | Eb | Cm | Ab | Eb | Bb7 | Bb7 | Eb"
PUENTE = ("C3:2 Eb3:2 G3:2 C4:2 | B2:2 D3:2 F3:2 Ab3:2 | C3:2 Eb3:2 G3:2 C4:2 | G3:4 G2:4 | "
          "Ab2:2 C3:2 Eb3:2 Ab3:2 | A2:2 C3:2 Eb3:2 F#3:2 | Bb2:2 D3:2 F3:2 Ab3:2 | Bb2:4 r:4")
ARM_PUENTE = "Cm | Bdim7 | Cm | G | Ab | Adim7 | Bb7 | Bb7"


def marcha():
    p = Pieza(116, 2)
    c = 0
    # introducción: redoble que crece y fanfarria
    redoble(p, p.t(0), p.t(2), 0.25, 0.95)
    p.golpe("platillo", p.t(2), 0.9)
    p.golpe("bombo", p.t(2), 1.0)
    fanfarria = "Bb4:2 D5:2 F5:2 Bb5:2 | F5:2 D5:2 Bb4:4"
    p.linea("cornetas", fanfarria, 2, 1.0)
    p.linea("bombardino", fanfarria, 2, 0.9, transporte=-12)
    p.linea("tuba", "Bb2:2 r:2 F2:2 r:2 | Bb1:4 r:4", 2, 1.0, articulacion=0.6)
    caja_marcha(p, 2, 2, 0.8, redoble_cada=0)
    c = 4
    # primera parte, dos veces (la segunda con la lira y el contracanto)
    for vez in range(2):
        arm = compases(ARM_A)
        p.linea("cornetas", TEMA_A, c, 0.95)
        if vez == 1:
            p.linea("lira", TEMA_A, c, 0.8, transporte=12)
            contracanto(p, "bombardino", arm, c, 0.55)
        tuba_oompah(p, arm, c)
        cornos_contratiempo(p, arm, c)
        caja_marcha(p, c, 16, 0.75)
        bombo_marcha(p, c, 16, 0.85, platillos=vez == 1)
        p.golpe("platillo", p.t(c), 0.7)
        c += 16
    # segunda parte, en sol menor
    arm = compases(ARM_B)
    p.linea("cornetas", TEMA_B, c, 1.0)
    contracanto(p, "bombardino", arm, c, 0.6)
    tuba_oompah(p, arm, c)
    cornos_contratiempo(p, arm, c, 0.6)
    caja_marcha(p, c, 16, 0.85)
    bombo_marcha(p, c, 16, 0.9)
    p.golpe("platillo", p.t(c), 0.8)
    p.golpe("platillo", p.t(c + 8), 0.6)
    c += 16
    # paso al trío
    arm = compases(ARM_PASO)
    p.linea("cornetas", PASO_TRIO, c, 0.95, articulacion=0.7)
    armonizar(p, "cornetas", "cornos", arm, c, 0.85, lo=midi("C4"), hi=midi("F5"))
    tuba_oompah(p, arm, c)
    redoble(p, p.t(c + 2), p.t(c + 4), 0.3, 0.9)
    c += 4
    # trío en mi bemol: el bombardino canta, la lira dobla arriba
    arm = compases(ARM_TRIO)
    p.linea("bombardino", TRIO, c, 0.85, transporte=-12)
    p.linea("lira", TRIO, c, 0.55, transporte=12)
    tuba_oompah(p, arm, c, 0.7)
    cornos_contratiempo(p, arm, c, 0.4)
    caja_marcha(p, c, 16, 0.45, redoble_cada=8)
    bombo_marcha(p, c, 16, 0.6, platillos=False)
    c += 16
    # puente de los bajos
    arm = compases(ARM_PUENTE)
    p.linea("tuba", PUENTE, c, 1.0, articulacion=0.85)
    p.linea("bombardino", PUENTE, c, 0.9, articulacion=0.85, transporte=12)
    for k in range(0, 8, 2):
        p.golpe("platillo", p.t(c + k), 0.8)
    caja_marcha(p, c, 8, 0.9, redoble_cada=2)
    bombo_marcha(p, c, 8, 1.0, platillos=False)
    c += 8
    # trío final con toda la banda
    arm = compases(ARM_TRIO)
    p.linea("cornetas", TRIO, c, 1.0)
    p.linea("lira", TRIO, c, 0.7, transporte=12)
    contracanto(p, "bombardino", arm, c, 0.7, lo=midi("G2"), hi=midi("Eb4"), inicio=midi("G3"))
    tuba_oompah(p, arm, c, 1.0)
    cornos_contratiempo(p, arm, c, 0.6)
    caja_marcha(p, c, 16, 0.85)
    bombo_marcha(p, c, 16, 1.0)
    p.golpe("platillo", p.t(c), 1.0)
    p.golpe("platillo", p.t(c + 8), 0.8)
    c += 16
    # final
    for voz, m, i in (("cornetas", "Eb5", 1.0), ("cornetas", "G4", 0.8), ("cornos", "Bb4", 0.7),
                      ("bombardino", "Eb3", 0.8), ("tuba", "Eb2", 1.0)):
        p.nota(voz, p.t(c), midi(m), p.compas * 1.0, i)
    p.golpe("platillo", p.t(c), 1.0)
    p.golpe("bombo", p.t(c), 1.0)
    c += 2
    return p, c * p.compas


# ----------------------------------------------------------------------
# «Vivac en la pampa»
TEMA_C = ("D4:4 F4:4 A4:6 G4:2 | F4:4 E4:4 D4:8 | C4:4 D4:4 F4:6 E4:2 | D4:12 r:4 | "
          "A4:4 C5:4 D5:6 C5:2 | Bb4:4 A4:4 G4:8 | A4:4 G4:4 E4:4 C#4:4 | D4:12 r:4 | "
          "F4:4 A4:4 D5:6 E5:2 | F5:4 E5:4 D5:8 | C5:4 Bb4:4 A4:6 G4:2 | A4:12 r:4 | "
          "D5:4 C5:4 Bb4:6 A4:2 | G4:4 Bb4:4 D5:8 | C#5:4 E5:4 A4:4 G4:4 | F4:4 E4:4 D4:8")
ARM_C = "Dm | Dm | F | Dm | Dm | Gm | A7 | Dm | Dm | Bb | F | A | Bb | Gm | A7 | Dm"
TOQUE = "F4:4 Bb4:4 D5:8 | F5:6 D5:2 Bb4:8 | F4:4 F4:2 F4:2 Bb4:8 | D5:12 r:4"
ARM_INTRO = "Dm | Dm | Bb | A | Dm | Dm | Gm | A"
ARM_TOQUE = "Bb | Bb | Bb | Bb | Gm | Gm | A | A"


def campana():
    p = Pieza(88, 4)
    c = 0
    # 1. tambores y pedal
    arm = compases(ARM_INTRO)
    pedal(p, "tuba_larga", arm, c, midi("G1"), midi("F#2"), 0.55)
    pedal(p, "cornos_largos", arm, c, midi("D3"), midi("C#4"), 0.32, quinta=True)
    cadencia_campana(p, c, 8, 0.42)
    bombo_campana(p, c, 8, 0.55)
    c += 8
    # 2. el tema en los cornos
    arm = compases(ARM_C)
    p.linea("cornos_largos", TEMA_C, c, 0.75, articulacion=0.97)
    pedal(p, "tuba_larga", arm, c, midi("G1"), midi("F#2"), 0.5)
    cadencia_campana(p, c, 16, 0.45)
    bombo_campana(p, c, 16, 0.55)
    p.golpe("platillo", p.t(c), 0.35)
    c += 16
    # 3. un toque de corneta a lo lejos, y su eco
    arm = compases(ARM_TOQUE)
    p.linea("corneta_lejana", TOQUE, c, 0.8, articulacion=0.92)
    p.linea("corneta_lejana", TOQUE, c + 4, 0.45, articulacion=0.92)
    pedal(p, "tuba_larga", arm, c, midi("G1"), midi("F#2"), 0.45)
    pedal(p, "cornos_largos", arm, c, midi("D3"), midi("C#4"), 0.25, quinta=True)
    cadencia_campana(p, c, 8, 0.32)
    bombo_campana(p, c, 8, 0.45)
    c += 8
    # 4. el tema con toda la banda
    arm = compases(ARM_C)
    redoble(p, p.t(c - 1, 8), p.t(c), 0.2, 0.7)
    p.linea("cornetas", TEMA_C, c, 0.62, articulacion=0.97, transporte=12)
    armonizar(p, "cornetas", "cornos_largos", arm, c, 0.75, lo=midi("D4"), hi=midi("D5"))
    contracanto(p, "bombardino", arm, c, 0.55, lo=midi("A2"), hi=midi("F4"), inicio=midi("F3"))
    pedal(p, "tuba_larga", arm, c, midi("G1"), midi("F#2"), 0.55)
    cadencia_campana(p, c, 16, 0.5)
    bombo_campana(p, c, 16, 0.6)
    p.golpe("platillo", p.t(c), 0.5)
    p.golpe("platillo", p.t(c + 8), 0.35)
    c += 16
    # 5. vuelven los tambores solos (y el bucle empieza de nuevo)
    arm = compases("Dm | Dm | A | A")
    pedal(p, "tuba_larga", arm, c, midi("G1"), midi("F#2"), 0.45)
    cadencia_campana(p, c, 4, 0.4)
    bombo_campana(p, c, 4, 0.5)
    c += 4
    return p, c * p.compas


PIEZAS = {
    "marcha": (marcha, dict(rt60=1.3, humedo=0.20)),
    "campana": (campana, dict(rt60=1.9, humedo=0.30)),
}


def generar(nombre, salida):
    import soundfile as sf
    fabricar, rev = PIEZAS[nombre]
    p, largo = fabricar()
    x = renderizar(p, largo)
    x = reverberar(x, **rev)
    x = masterizar(x, largo)
    ruta = salida / f"{nombre}.ogg"
    datos = x.astype(np.float32)
    # por bloques: libsndfile se cae si se le da todo el Vorbis de una vez
    with sf.SoundFile(str(ruta), "w", SR, 2, format="OGG", subtype="VORBIS") as f:
        for i in range(0, len(datos), 16384):
            f.write(datos[i:i + 16384])
    rms = 20 * math.log10(float(np.sqrt(np.mean(x ** 2))) + 1e-12)
    print(f"{ruta.name}: {largo:.1f} s, {sum(len(v) for v in p.voces.values())} notas, "
          f"{sum(len(v) for v in p.golpes.values())} golpes, RMS {rms:.1f} dBFS, "
          f"{ruta.stat().st_size // 1024} KB")
    return ruta


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--salida", default=str(RAIZ / "recursos" / "sonidos" / "musica"))
    ap.add_argument("--solo", nargs="*", choices=sorted(PIEZAS))
    a = ap.parse_args(argv)
    salida = Path(a.salida)
    salida.mkdir(parents=True, exist_ok=True)
    for nombre in a.solo or sorted(PIEZAS):
        generar(nombre, salida)
    return 0


if __name__ == "__main__":
    sys.exit(main())
