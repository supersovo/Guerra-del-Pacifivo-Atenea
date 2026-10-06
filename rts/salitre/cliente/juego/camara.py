"""Cámara del campo de batalla: desplazamiento, acercamiento y conversiones."""

import pygame


class Camara:
    def __init__(self, vista, ancho_mapa_px, alto_mapa_px):
        self.vista = pygame.Rect(vista)
        self.mw = ancho_mapa_px
        self.mh = alto_mapa_px
        self.x = 0.0
        self.y = 0.0
        self.zoom = 1.0

    def a_pantalla(self, x, y):
        return self.vista.x + (x - self.x) * self.zoom, self.vista.y + (y - self.y) * self.zoom

    def a_mapa(self, sx, sy):
        return (sx - self.vista.x) / self.zoom + self.x, (sy - self.vista.y) / self.zoom + self.y

    def visible_rect(self, sx, sy, w, h):
        v = self.vista
        return sx + w >= v.x and sy + h >= v.y and sx <= v.right and sy <= v.bottom

    def centrar(self, x, y):
        self.x = x - self.vista.w / (2 * self.zoom)
        self.y = y - self.vista.h / (2 * self.zoom)
        self.limitar()

    def centro(self):
        return self.x + self.vista.w / (2 * self.zoom), self.y + self.vista.h / (2 * self.zoom)

    def mover(self, dx, dy):
        self.x += dx / self.zoom
        self.y += dy / self.zoom
        self.limitar()

    def acercar(self, factor, ancla=None):
        cx, cy = ancla if ancla is not None else (self.vista.centerx, self.vista.centery)
        mx, my = self.a_mapa(cx, cy)
        self.zoom = max(0.55, min(1.6, self.zoom * factor))
        self.x = mx - (cx - self.vista.x) / self.zoom
        self.y = my - (cy - self.vista.y) / self.zoom
        self.limitar()

    def limitar(self):
        ancho = self.vista.w / self.zoom
        alto = self.vista.h / self.zoom
        margen = 16
        self.x = max(-margen, min(self.mw - ancho + margen, self.x))
        self.y = max(-margen, min(self.mh - alto + margen, self.y))
        if ancho > self.mw:
            self.x = (self.mw - ancho) / 2
        if alto > self.mh:
            self.y = (self.mh - alto) / 2

    def rect_mapa(self):
        return pygame.Rect(int(self.x), int(self.y), int(self.vista.w / self.zoom), int(self.vista.h / self.zoom))
