"""Íconos de la tarjeta de órdenes, dibujados por código (40x40)."""

import math

import pygame

from .sprites import Pintor

TINTA = (52, 36, 24)
ROJO = (160, 36, 30)
ACERO = (120, 126, 134)
MADERA = (120, 84, 50)
DORADO = (200, 160, 70)


def _flecha(p, x0, y0, x1, y1, c, ancho=2.4):
    p.linea(x0, y0, x1, y1, c, ancho)
    a = math.atan2(y1 - y0, x1 - x0)
    for d in (2.5, -2.5):
        p.linea(x1, y1, x1 - math.cos(a + d * 0.2) * 8, y1 - math.sin(a + d * 0.2) * 8, c, ancho)


def icono_orden(nombre):
    p = Pintor(40, 40)
    if nombre == "mover":
        _flecha(p, 8, 30, 30, 10, TINTA, 3)
    elif nombre == "detener":
        p.rect(11, 11, 18, 18, ROJO, 2)
        p.rect(14, 14, 12, 12, (230, 220, 200), 1)
    elif nombre == "atacar":
        p.linea(9, 31, 31, 9, ACERO, 2.4)
        p.linea(9, 9, 31, 31, ACERO, 2.4)
        p.linea(7, 29, 13, 35, MADERA, 3)
        p.linea(27, 35, 33, 29, MADERA, 3)
    elif nombre == "mantener":
        p.poli([(20, 6), (32, 11), (30, 26), (20, 34), (10, 26), (8, 11)], (90, 70, 50))
        p.poli([(20, 10), (28, 13), (27, 25), (20, 30), (13, 25), (12, 13)], DORADO)
    elif nombre == "patrullar":
        p.circ(20, 20, 11, TINTA, borde=2.4)
        _flecha(p, 31, 18, 31, 24, TINTA, 2.4)
        _flecha(p, 9, 22, 9, 16, TINTA, 2.4)
    elif nombre == "recolectar":
        p.poli([(8, 32), (16, 22), (24, 28), (32, 20), (34, 32)], (236, 236, 240))
        p.linea(10, 12, 26, 24, MADERA, 2.2)
        p.poli([(6, 14), (16, 6), (14, 13)], ACERO)
    elif nombre == "regresar":
        p.elipse(10, 14, 20, 18, (232, 226, 210))
        p.rect(17, 10, 6, 5, (180, 160, 120))
        _flecha(p, 32, 34, 32, 22, TINTA, 2)
    elif nombre == "reparar":
        p.linea(10, 32, 24, 18, MADERA, 3)
        p.rect(20, 9, 14, 8, ACERO, 1)
    elif nombre == "construir":
        p.rect(9, 18, 22, 14, (200, 170, 130))
        p.poli([(7, 19), (20, 8), (33, 19)], (160, 76, 52))
        p.rect(17, 24, 6, 8, (90, 64, 40))
    elif nombre == "avanzado":
        p.rect(14, 10, 12, 22, (200, 170, 130))
        p.rect(12, 8, 16, 4, (160, 76, 52))
        p.linea(20, 8, 20, 2, TINTA, 1)
        p.poli([(20, 2), (28, 4), (20, 6)], ROJO)
    elif nombre == "volver":
        _flecha(p, 32, 20, 8, 20, TINTA, 3)
    elif nombre == "cancelar":
        p.linea(10, 10, 30, 30, ROJO, 4)
        p.linea(30, 10, 10, 30, ROJO, 4)
    elif nombre == "reunion":
        p.linea(14, 34, 14, 6, TINTA, 2)
        p.poli([(14, 6), (32, 11), (14, 17)], (230, 196, 60))
    elif nombre == "descargar":
        p.linea(20, 6, 20, 32, TINTA, 2.4)
        p.linea(12, 12, 28, 12, TINTA, 2)
        p.poli([(8, 24), (20, 34), (32, 24), (28, 24), (20, 30), (12, 24)], TINTA)
    elif nombre == "emplazar":
        p.circ(16, 26, 7, MADERA, borde=2)
        p.linea(14, 22, 34, 12, (60, 64, 70), 4)
    elif nombre == "replegar":
        # cruz roja de la sanidad y una flecha de vuelta a retaguardia
        p.rect(19, 6, 16, 16, (244, 242, 236), 2)
        p.rect(25, 8, 4, 12, ROJO)
        p.rect(21, 12, 12, 4, ROJO)
        _flecha(p, 30, 32, 8, 32, TINTA, 2.6)
        p.linea(8, 32, 8, 22, TINTA, 2.6)
    else:
        p.circ(20, 20, 10, TINTA, borde=2)
    return p.resultado()


def icono_mejora(mejora):
    p = Pintor(40, 40)
    mid = mejora.id
    if "armas_infanteria" in mid or mid == "orden_disperso":
        p.linea(6, 30, 34, 10, MADERA, 3)
        p.linea(20, 20, 34, 10, (70, 72, 78), 2)
    elif "blindaje" in mid:
        p.poli([(20, 6), (32, 11), (30, 26), (20, 34), (10, 26), (8, 11)], ACERO)
        p.poli([(20, 10), (28, 13), (27, 25), (20, 30), (13, 25), (12, 13)], (170, 176, 184))
    elif "caballeria" in mid or mid in ("herraje", "carga_sable"):
        p.circ(20, 22, 10, (80, 80, 86), borde=3)
        p.rect(8, 22, 24, 12, (220, 210, 190))
    elif "artilleria" in mid or mid in ("alza_mira", "manivela_rapida"):
        p.circ(14, 26, 7, MADERA, borde=2)
        p.linea(14, 24, 34, 14, (60, 64, 70), 4)
    elif mid in ("cirugia_campana", "botiquines"):
        p.rect(8, 8, 24, 24, (250, 250, 250), 2)
        p.rect(17, 11, 6, 18, (210, 30, 30))
        p.rect(11, 17, 18, 6, (210, 30, 30))
    elif mid in ("calderas", "blindaje_naval"):
        p.poli([(4, 22), (36, 22), (30, 32), (10, 32)], (60, 60, 64))
        p.rect(18, 10, 6, 12, (40, 36, 34))
    elif mid == "cifrado":
        p.linea(20, 34, 20, 6, MADERA, 2.4)
        for k in range(3):
            p.linea(12, 10 + k * 5, 28, 10 + k * 5, MADERA, 1.6)
    else:
        p.poli([(20, 4), (24, 15), (36, 16), (26, 23), (30, 35), (20, 28), (10, 35), (14, 23), (4, 16), (16, 15)], DORADO)
    return p.resultado()


def icono_habilidad(h):
    p = Pintor(40, 40)
    tipo = h.tipo
    if tipo in ("potenciar_area", "potenciar_propio"):
        p.circ(20, 20, 14, DORADO, borde=2)
        p.poli([(20, 6), (24, 16), (34, 17), (26, 24), (29, 34), (20, 28), (11, 34), (14, 24), (6, 17), (16, 16)], ROJO)
    elif tipo == "curar_area":
        p.rect(17, 7, 6, 26, (210, 30, 30))
        p.rect(7, 17, 26, 6, (210, 30, 30))
    elif tipo == "bombardeo":
        for k in range(3):
            p.circ(12 + k * 8, 26 - (k % 2) * 6, 4, (60, 60, 64))
        p.poli([(26, 6), (30, 14), (22, 12)], (240, 160, 50))
    elif tipo == "mina":
        p.elipse(8, 18, 24, 14, (70, 66, 60))
        p.circ(20, 24, 3, (210, 40, 30))
    elif tipo == "sabotaje":
        p.linea(8, 32, 32, 8, ROJO, 3)
        p.rect(10, 10, 12, 12, (90, 90, 90), 1)
    elif tipo == "demolicion":
        for k in range(3):
            p.rect(11 + k * 6, 14, 5, 18, (190, 40, 30))
        p.linea(23, 14, 30, 6, (240, 220, 160), 1.4)
    elif tipo == "revelar":
        p.circ(20, 20, 12, (60, 120, 200), borde=3)
        p.circ(20, 20, 4, TINTA)
    elif tipo == "golpe":
        _flecha(p, 6, 20, 34, 20, (60, 60, 64), 4)
    elif tipo == "emplazar":
        return icono_orden("emplazar")
    elif tipo == "descargar":
        return icono_orden("descargar")
    elif tipo == "menu_construir":
        return icono_orden("construir")
    else:
        p.circ(20, 20, 12, DORADO, borde=3)
    return p.resultado()


def signo_peso(tam=22, color=(255, 255, 255), borde=(40, 26, 10)):
    """Signo $ con contorno oscuro (en blanco se tiñe en la GPU del color que se quiera)."""
    from .. import fuentes
    f = fuentes.negrita(tam)
    letra = f.render("$", True, color)
    fondo = f.render("$", True, borde)
    s = pygame.Surface((letra.get_width() + 2, letra.get_height() + 2), pygame.SRCALPHA)
    for dx, dy in ((0, 1), (2, 1), (1, 0), (1, 2)):
        s.blit(fondo, (dx, dy))
    s.blit(letra, (1, 1))
    return s


def galones(n, estrella=False, escala=4):
    """Galones de grado (n chevrones en V) en blanco con contorno oscuro, para teñir de dorado;
    con estrella, el laurel del Aguerrido. Se dibujan a 'escala' y la GPU los reduce."""
    k = escala
    ancho = 11 * k
    alto = (4 + 3 * n + (5 if estrella else 0)) * k
    s = pygame.Surface((ancho, alto), pygame.SRCALPHA)
    y = (5 if estrella else 0) * k
    if estrella:
        cx, cy, r = ancho / 2, 2.4 * k, 2.3 * k
        puntas = []
        for i in range(10):
            a = -math.pi / 2 + i * math.pi / 5
            rr = r if i % 2 == 0 else r * 0.45
            puntas.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr))
        pygame.draw.polygon(s, (40, 26, 10), [(px, py + k * 0.5) for px, py in puntas])
        pygame.draw.polygon(s, (255, 255, 255), puntas)
    for i in range(n):
        y0 = y + i * 3 * k + 1 * k
        pts = [(1 * k, y0), (5.5 * k, y0 + 3 * k), (10 * k, y0)]
        pygame.draw.lines(s, (40, 26, 10), False, pts, int(2.6 * k))
        pygame.draw.lines(s, (255, 255, 255), False, pts, int(1.6 * k))
    return s


def recurso(tipo, tam=18):
    s = pygame.Surface((tam, tam), pygame.SRCALPHA)
    if tipo == "dinero":
        # moneda de oro con el signo de peso
        pygame.draw.circle(s, (150, 104, 30), (tam // 2, tam // 2), tam // 2)
        pygame.draw.circle(s, (236, 192, 72), (tam // 2, tam // 2), tam // 2 - 1)
        pygame.draw.circle(s, (250, 220, 120), (tam // 2 - 1, tam // 2 - 1), tam // 2 - 4)
        signo = signo_peso(int(tam * 0.85), (120, 76, 14), (250, 226, 140))
        s.blit(signo, ((tam - signo.get_width()) // 2, (tam - signo.get_height()) // 2))
    elif tipo == "salitre":
        pygame.draw.polygon(s, (240, 240, 244), [(2, tam - 3), (tam // 2, 2), (tam - 2, tam - 3)])
        pygame.draw.polygon(s, (180, 186, 200), [(tam // 2, 2), (tam - 2, tam - 3), (tam // 2 + 2, tam - 3)])
    elif tipo == "agua":
        pygame.draw.polygon(s, (70, 150, 220), [(tam // 2, 1), (tam - 4, tam // 2 + 2), (4, tam // 2 + 2)])
        pygame.draw.circle(s, (70, 150, 220), (tam // 2, tam // 2 + 3), tam // 2 - 3)
    else:   # población: kepí
        pygame.draw.rect(s, (170, 40, 36), (4, 3, tam - 8, tam - 9), border_radius=2)
        pygame.draw.rect(s, (40, 40, 90), (4, tam - 9, tam - 8, 3))
        pygame.draw.rect(s, (30, 24, 20), (2, tam - 6, tam - 4, 2))
    return s
