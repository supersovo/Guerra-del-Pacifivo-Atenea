"""Lienzo: dibujo acelerado por la tarjeta gráfica (SDL2 Renderer).

Todo lo que se ve (terreno, unidades, interfaz, texto) son texturas en la GPU:
escalar, rotar, teñir y mezclar con transparencia no cuesta CPU. La interfaz
trabaja en una resolución lógica (por omisión 1280x720) que SDL escala a la
ventana real. Si la GPU no está disponible, SDL usa su renderizador por
software con el mismo código.
"""

import os

import pygame
from pygame._sdl2.video import Renderer, Texture, Window

from .. import NOMBRE_JUEGO
from . import fuentes


class Lienzo:
    def __init__(self, ventana=(1280, 720), logico=(1280, 720), pantalla_completa=False, vsync=True):
        # filtrado lineal al escalar texturas: niebla de guerra suave, acercamiento sin dientes
        os.environ.setdefault("SDL_RENDER_SCALE_QUALITY", "1")
        pygame.init()
        self.window = Window(NOMBRE_JUEGO, size=tuple(ventana), resizable=True)
        if pantalla_completa:
            try:
                self.window.set_fullscreen(desktop=True)
            except pygame.error:
                pass
        try:
            self.r = Renderer(self.window, accelerated=-1, vsync=vsync)
        except pygame.error:
            self.r = Renderer(self.window, accelerated=0, vsync=False)
        self.W, self.H = int(logico[0]), int(logico[1])
        self.r.logical_size = (self.W, self.H)
        self.r.draw_blend_mode = 1
        self._texto = {}
        self._tex = {}
        self._orden = 0

    # ------------------------------------------------------------------
    def poner_icono(self, superficie):
        try:
            self.window.set_icon(superficie)
        except (pygame.error, AttributeError):
            pass

    def pantalla_completa(self, valor):
        try:
            if valor:
                self.window.set_fullscreen(desktop=True)
            else:
                self.window.set_windowed()
        except pygame.error:
            pass

    def raton(self):
        """Posición del ratón en coordenadas lógicas."""
        x, y = pygame.mouse.get_pos()
        return self.logico_de(x, y)

    def logico_de(self, x, y):
        vw, vh = self.window.size
        esc = min(vw / self.W, vh / self.H)
        ox = (vw - self.W * esc) / 2
        oy = (vh - self.H * esc) / 2
        return int((x - ox) / esc), int((y - oy) / esc)

    # ------------------------------------------------------------------
    def limpiar(self, color=(0, 0, 0)):
        self.r.draw_color = (*color[:3], 255)
        self.r.clear()

    def presentar(self):
        self.r.present()

    def rect(self, rect, color, alpha=255):
        self.r.draw_color = (*color[:3], alpha if len(color) < 4 else color[3])
        self.r.fill_rect(pygame.Rect(rect))

    def marco(self, rect, color, grosor=1, alpha=255):
        self.r.draw_color = (*color[:3], alpha)
        r = pygame.Rect(rect)
        for k in range(grosor):
            self.r.draw_rect(r.inflate(-2 * k, -2 * k))

    def linea(self, p0, p1, color, alpha=255):
        self.r.draw_color = (*color[:3], alpha)
        self.r.draw_line(p0, p1)

    def triangulo(self, p0, p1, p2, color, alpha=255):
        self.r.draw_color = (*color[:3], alpha)
        self.r.fill_triangle(p0, p1, p2)

    def recortar(self, rect=None):
        """Limita el dibujo a un rectángulo (las coordenadas pasan a ser relativas a él)."""
        self.r.set_viewport(pygame.Rect(rect) if rect is not None else None)

    # ------------------------------------------------------------------
    def textura(self, clave, generador):
        """Textura en caché; generador() devuelve una Surface la primera vez."""
        t = self._tex.get(clave)
        if t is None:
            sup = generador()
            if sup is None:
                return None
            t = Texture.from_surface(self.r, sup)
            t.blend_mode = 1
            self._tex[clave] = t
        return t

    def textura_de(self, superficie):
        t = Texture.from_surface(self.r, superficie)
        t.blend_mode = 1
        return t

    def olvidar(self, prefijo):
        for k in [k for k in self._tex if isinstance(k, tuple) and k and k[0] == prefijo]:
            del self._tex[k]

    def dibujar(self, tex, x, y, w=None, h=None, angulo=0.0, espejo=False, alpha=255, color=None,
                src=None, centro=False):
        if tex is None:
            return
        if w is None:
            w = src[2] if src else tex.width
        if h is None:
            h = src[3] if src else tex.height
        if centro:
            x -= w / 2
            y -= h / 2
        tex.alpha = alpha
        tex.color = color if color is not None else (255, 255, 255)
        tex.draw(srcrect=src, dstrect=(x, y, w, h), angle=angulo, flip_x=espejo)

    # ------------------------------------------------------------------
    def _tex_texto(self, s, fuente, color):
        clave = (s, id(fuente), tuple(color))
        t = self._texto.get(clave)
        if t is None:
            sup = fuente.render(s, True, color)
            t = Texture.from_surface(self.r, sup)
            t.blend_mode = 1
            if len(self._texto) > 1500:
                self._texto.clear()
            self._texto[clave] = t
        return t

    def texto(self, s, x, y, fuente=None, color=(30, 24, 18), ancla="izq", sombra=None, alpha=255):
        if not s:
            return 0, 0
        fuente = fuente or fuentes.cuerpo()
        t = self._tex_texto(s, fuente, color)
        w, h = t.width, t.height
        if ancla == "centro":
            x -= w // 2
        elif ancla == "der":
            x -= w
        if sombra is not None:
            ts = self._tex_texto(s, fuente, sombra)
            ts.alpha = alpha
            ts.color = (255, 255, 255)
            ts.draw(dstrect=(x + 1, y + 1, w, h))
        t.alpha = alpha
        t.color = (255, 255, 255)
        t.draw(dstrect=(x, y, w, h))
        return w, h

    def medir(self, s, fuente=None):
        fuente = fuente or fuentes.cuerpo()
        return fuente.size(s)

    def parrafo(self, s, x, y, ancho, fuente=None, color=(30, 24, 18), interlinea=None, max_lineas=None):
        """Texto con ajuste de línea. Devuelve el alto ocupado."""
        fuente = fuente or fuentes.cuerpo()
        alto = interlinea or fuente.get_linesize()
        lineas = envolver(s, fuente, ancho)
        if max_lineas is not None:
            lineas = lineas[:max_lineas]
        for i, ln in enumerate(lineas):
            self.texto(ln, x, y + i * alto, fuente, color)
        return len(lineas) * alto

    def captura(self, ruta):
        sup = self.r.to_surface()
        pygame.image.save(sup, str(ruta))
        return ruta


def envolver(s, fuente, ancho):
    out = []
    for parrafo in s.split("\n"):
        palabras = parrafo.split(" ")
        actual = ""
        for p in palabras:
            prueba = p if not actual else actual + " " + p
            if fuente.size(prueba)[0] <= ancho or not actual:
                actual = prueba
            else:
                out.append(actual)
                actual = p
        out.append(actual)
    return out
