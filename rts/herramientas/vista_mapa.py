"""Dibuja una vista previa (PNG) de cada mapa: terreno, alturas, recursos e inicios.

    python herramientas/vista_mapa.py [carpeta_salida] [escala]
"""

import os
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))
os.environ.setdefault("SDL_VIDEODRIVER", "dummy")

import pygame  # noqa: E402

from salitre.contenido import mapas  # noqa: E402

COLORES = {
    ".": (214, 186, 140), ",": (196, 166, 120), ":": (236, 232, 222), "=": (120, 98, 76),
    "/": (176, 150, 112), "#": (122, 96, 78), "T": (92, 118, 64), "q": (98, 72, 56),
    "~": (46, 92, 140), "p": (140, 120, 100),
}


def dibujar(datos, escala=6):
    w, h = datos.ancho, datos.alto
    sup = pygame.Surface((w * escala, h * escala))
    for y in range(h):
        for x in range(w):
            ch = datos.terreno[y][x]
            nv = int(datos.altura[y][x])
            r, g, b = COLORES.get(ch, (255, 0, 255))
            f = 1.0 + 0.12 * nv
            col = (min(255, int(r * f)), min(255, int(g * f)), min(255, int(b * f)))
            sup.fill(col, (x * escala, y * escala, escala, escala))
            # acantilados: borde oscuro donde cambia el nivel sin rampa
            if ch not in "/~":
                for dx, dy in ((1, 0), (0, 1)):
                    xx, yy = x + dx, y + dy
                    if xx < w and yy < h and datos.altura[yy][xx] != datos.altura[y][x] \
                            and datos.terreno[yy][xx] != "/":
                        if dx:
                            pygame.draw.line(sup, (60, 44, 34), ((x + 1) * escala - 1, y * escala),
                                             ((x + 1) * escala - 1, (y + 1) * escala - 1), 2)
                        else:
                            pygame.draw.line(sup, (60, 44, 34), (x * escala, (y + 1) * escala - 1),
                                             ((x + 1) * escala - 1, (y + 1) * escala - 1), 2)
    for r in datos.recursos:
        if r["tipo"] == "salitre":
            pygame.draw.rect(sup, (255, 255, 255), (r["x"] * escala, r["y"] * escala, 2 * escala, escala))
            pygame.draw.rect(sup, (90, 90, 110), (r["x"] * escala, r["y"] * escala, 2 * escala, escala), 1)
        else:
            pygame.draw.rect(sup, (40, 140, 220), (r["x"] * escala, r["y"] * escala, 3 * escala, 3 * escala))
    colores = [(220, 40, 40), (40, 80, 220), (240, 220, 40), (40, 180, 70)]
    for i, (x, y) in enumerate(datos.inicios):
        pygame.draw.rect(sup, colores[i % 4], (x * escala, y * escala, 4 * escala, 3 * escala))
        pygame.draw.rect(sup, (0, 0, 0), (x * escala, y * escala, 4 * escala, 3 * escala), 2)
    return sup


def main():
    salida = Path(sys.argv[1]) if len(sys.argv) > 1 else RAIZ / "mapas" / "vistas"
    escala = int(sys.argv[2]) if len(sys.argv) > 2 else 6
    salida.mkdir(parents=True, exist_ok=True)
    pygame.init()
    for ident, ruta in mapas.listar().items():
        datos = mapas.cargar(ruta)
        sup = dibujar(datos, escala)
        pygame.image.save(sup, str(salida / f"{ident}.png"))
        print("vista:", salida / f"{ident}.png")


if __name__ == "__main__":
    main()
