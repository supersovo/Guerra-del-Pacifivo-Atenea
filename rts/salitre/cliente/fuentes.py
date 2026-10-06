"""Tipografías: IM Fell English SC (títulos, de aire decimonónico) y Alegreya Sans
(texto de la interfaz). Ambas con licencia SIL OFL, en recursos/fuentes/."""

import pygame

from .. import rutas

_cache = {}

ARCHIVOS = {
    "titulo": "IMFellEnglishSC.ttf",
    "cuerpo": "AlegreyaSans-Regular.ttf",
    "negrita": "AlegreyaSans-Bold.ttf",
    "cursiva": "AlegreyaSans-Italic.ttf",
}


def fuente(estilo="cuerpo", tam=16):
    clave = (estilo, tam)
    f = _cache.get(clave)
    if f is None:
        if not pygame.font.get_init():
            pygame.font.init()
        ruta = rutas.dir_recursos() / "fuentes" / ARCHIVOS.get(estilo, ARCHIVOS["cuerpo"])
        try:
            f = pygame.font.Font(str(ruta), tam)
        except (OSError, pygame.error):
            f = pygame.font.Font(None, int(tam * 1.25))
        _cache[clave] = f
    return f


def titulo(tam=36):
    return fuente("titulo", tam)


def cuerpo(tam=16):
    return fuente("cuerpo", tam)


def negrita(tam=16):
    return fuente("negrita", tam)


def cursiva(tam=16):
    return fuente("cursiva", tam)
