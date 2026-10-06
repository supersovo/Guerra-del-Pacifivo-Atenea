"""Genera el ícono del juego: recursos/icono.png (256x256) y recursos/icono.ico
(16 a 256 píxeles) para el ejecutable y el instalador de Windows.

Se dibuja grande y se reduce con suavizado. Las entradas pequeñas del .ico van
como mapa de bits (lo que leen todas las herramientas de Windows) y las de
128 y 256 como PNG.

    python herramientas/generar_icono.py
"""

import io
import math
import os
import struct
import sys
from pathlib import Path

os.environ.setdefault("SDL_VIDEODRIVER", "dummy")
import pygame  # noqa: E402

RAIZ = Path(__file__).resolve().parent.parent
TAMANOS = (16, 24, 32, 48, 64, 128, 256)


def dibujar(lado=1024):
    """Sello de campaña: disco rojo con borde de bronce, dos fusiles cruzados y salitre."""
    s = pygame.Surface((lado, lado), pygame.SRCALPHA)
    c = lado // 2
    r = int(lado * 0.48)
    pygame.draw.circle(s, (70, 40, 22), (c, c), r)
    pygame.draw.circle(s, (230, 196, 120), (c, c), r - lado // 64)
    pygame.draw.circle(s, (150, 32, 28), (c, c), r - lado // 22)
    pygame.draw.circle(s, (178, 46, 38), (c - lado // 40, c - lado // 40), r - lado // 9)
    # fusiles cruzados (culata de nogal, cañón pavonado)
    for signo in (-1, 1):
        ang = math.radians(45 * signo)
        dx, dy = math.sin(ang), -math.cos(ang)
        largo = r * 1.55
        x0, y0 = c - dx * largo / 2, c - dy * largo / 2
        x1, y1 = c + dx * largo / 2, c + dy * largo / 2
        nx, ny = -dy, dx
        ancho = lado * 0.035

        def cuad(t0, t1, w0, w1, color):
            ax, ay = x0 + (x1 - x0) * t0, y0 + (y1 - y0) * t0
            bx, by = x0 + (x1 - x0) * t1, y0 + (y1 - y0) * t1
            pygame.draw.polygon(s, color, [(ax + nx * w0, ay + ny * w0), (bx + nx * w1, by + ny * w1),
                                           (bx - nx * w1, by - ny * w1), (ax - nx * w0, ay - ny * w0)])

        cuad(0.0, 0.34, ancho * 1.9, ancho * 1.0, (92, 56, 30))      # culata
        cuad(0.34, 0.62, ancho * 0.9, ancho * 0.8, (110, 70, 38))    # guardamano
        cuad(0.62, 1.0, ancho * 0.45, ancho * 0.4, (52, 56, 62))     # cañón
        cuad(0.30, 0.36, ancho * 1.25, ancho * 1.25, (200, 170, 100))  # abrazadera de bronce
        cuad(0.95, 1.08, ancho * 0.12, ancho * 0.08, (210, 214, 220))  # bayoneta
    # montón de salitre al pie
    base_y = int(c + r * 0.52)
    for k, (ox, w, h) in enumerate(((-0.22, 0.30, 0.20), (0.18, 0.28, 0.17), (0.0, 0.36, 0.26))):
        cx = c + int(r * ox)
        ww, hh = int(r * w), int(r * h)
        pts = [(cx - ww, base_y), (cx - ww // 3, base_y - hh), (cx + ww // 5, base_y - hh - lado // 60),
               (cx + ww, base_y)]
        pygame.draw.polygon(s, (236, 234, 226), pts)
        pygame.draw.polygon(s, (190, 186, 176), pts, max(1, lado // 200))
    # estrella de cinco puntas en lo alto
    cy = int(c - r * 0.55)
    puntas = []
    for i in range(10):
        a = math.pi / 2 + i * math.pi / 5
        rr = lado * (0.075 if i % 2 == 0 else 0.03)
        puntas.append((c + rr * math.cos(a), cy - rr * math.sin(a)))
    pygame.draw.polygon(s, (244, 236, 214), puntas)
    return s


def a_png(sup):
    buf = io.BytesIO()
    pygame.image.save(sup, buf, "icono.png")
    return buf.getvalue()


def a_dib(sup):
    """Entrada BMP de 32 bits con canal alfa (encabezado + píxeles de abajo arriba + máscara AND)."""
    w, h = sup.get_size()
    rgba = pygame.image.tobytes(sup, "RGBA")
    filas = []
    for y in range(h - 1, -1, -1):
        fila = bytearray()
        for x in range(w):
            i = (y * w + x) * 4
            r, g, b, a = rgba[i:i + 4]
            fila += bytes((b, g, r, a))
        filas.append(bytes(fila))
    mascara_fila = ((w + 31) // 32) * 4
    cab = struct.pack("<IiiHHIIiiII", 40, w, h * 2, 1, 32, 0, w * h * 4 + mascara_fila * h, 0, 0, 0, 0)
    return cab + b"".join(filas) + bytes(mascara_fila * h)


def escribir_ico(ruta, imagenes):
    """imagenes: [(lado, bytes)]"""
    cab = struct.pack("<HHH", 0, 1, len(imagenes))
    desplaz = 6 + 16 * len(imagenes)
    entradas = b""
    datos = b""
    for lado, b in imagenes:
        entradas += struct.pack("<BBBBHHII", lado % 256, lado % 256, 0, 0, 1, 32, len(b), desplaz + len(datos))
        datos += b
    Path(ruta).write_bytes(cab + entradas + datos)


def main():
    pygame.init()
    grande = dibujar()
    imagenes = []
    for lado in TAMANOS:
        sup = pygame.transform.smoothscale(grande, (lado, lado))
        imagenes.append((lado, a_png(sup) if lado >= 128 else a_dib(sup)))
    destino = RAIZ / "recursos"
    escribir_ico(destino / "icono.ico", imagenes)
    pygame.image.save(pygame.transform.smoothscale(grande, (256, 256)), str(destino / "icono.png"))
    print("Escritos", destino / "icono.ico", "y", destino / "icono.png")
    return 0


if __name__ == "__main__":
    sys.exit(main())
