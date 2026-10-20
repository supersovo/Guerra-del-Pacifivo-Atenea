"""Lienzo: dibujo acelerado por la tarjeta gráfica (SDL2 Renderer).

Todo lo que se ve (terreno, unidades, interfaz, texto) son texturas en la GPU:
escalar, rotar, teñir y mezclar con transparencia no cuesta CPU. La interfaz
trabaja en una resolución lógica (por omisión 1280x720): cada cuadro se dibuja
en una textura de ese tamaño (el «lienzo») que presentar() escala a la ventana,
con franjas negras si la ventana tiene otra proporción. Si la GPU no está
disponible, SDL usa su renderizador por software con el mismo código.

No se usa el «tamaño lógico» de SDL: con él, SDL convierte por su cuenta la
posición del ratón en los eventos, y los recortes (set_viewport) olvidan las
franjas negras, de modo que al agrandar la ventana el dibujo y los clics se
desfasan. Aquí la única conversión entre la ventana y las coordenadas lógicas
es area_imagen()/logico_de().
"""

import gc
import math
import os

import pygame
from pygame._sdl2.video import Renderer, Texture, Window

from .. import NOMBRE_JUEGO
from . import fuentes


class Lienzo:
    def __init__(self, ventana=(1280, 720), logico=(1280, 720), pantalla_completa=False, vsync=True):
        # filtrado lineal al escalar texturas: niebla de guerra suave, acercamiento sin dientes
        os.environ.setdefault("SDL_RENDER_SCALE_QUALITY", "1")
        # el mezclador a 44,1 kHz en todos los sistemas (los efectos se remuestrean a esa frecuencia)
        from .sonido import FREC_MEZCLA
        pygame.mixer.pre_init(FREC_MEZCLA, -16, 2, 512)
        pygame.init()
        self.window = Window(NOMBRE_JUEGO, size=tuple(ventana), resizable=True)
        if pantalla_completa:
            try:
                self.window.set_fullscreen(desktop=True)
            except pygame.error:
                pass
        self.W, self.H = int(logico[0]), int(logico[1])
        self.r = None
        self.lienzo = None
        self._crear_renderizador(vsync)
        self.r.draw_blend_mode = 1
        self._texto = {}
        self._tex = {}
        self._orden = 0

    def _crear_renderizador(self, vsync):
        # si la tarjeta gráfica no permite dibujar sobre una textura, el renderizador por software sí
        for acelerado, sincronia in ((-1, vsync), (0, False)):
            try:
                self.r = Renderer(self.window, accelerated=acelerado, vsync=sincronia)
                self.lienzo = Texture(self.r, (self.W, self.H), target=True)
                # el lienzo es opaco: se copia a la ventana sin mezclar
                self.lienzo.blend_mode = 0
                return
            except pygame.error:
                self.lienzo = None
                self.r = None
                gc.collect()
        raise pygame.error("No se pudo preparar el dibujo en la ventana")

    def cerrar(self):
        """Libera texturas, renderizador y ventana, en ese orden, antes de cerrar pygame.

        Si una textura de SDL se destruye después del renderizador (o después de
        pygame.quit), SDL toca memoria ya liberada y el programa cae.
        """
        self._tex.clear()
        self._texto.clear()
        if self.r is not None:
            # el renderizador guarda una referencia a su destino: se suelta antes que el lienzo
            try:
                self.r.target = None
            except pygame.error:
                pass
        self.lienzo = None
        gc.collect()
        self.r = None
        gc.collect()
        self.window = None
        gc.collect()

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

    def encerrar_raton(self, valor):
        """Impide (o vuelve a permitir) que el puntero salga de la ventana.

        SDL lo suelta solo cuando la ventana pierde el foco (Alt+Tab) y lo vuelve
        a encerrar al recuperarlo.
        """
        valor = bool(valor)
        try:
            if self.window.grab_mouse != valor:
                self.window.grab_mouse = valor
        except (pygame.error, AttributeError):
            pass

    def con_foco(self):
        """True si la ventana recibe el teclado y el puntero está sobre ella."""
        try:
            return bool(self.window.focused) and pygame.mouse.get_focused()
        except (pygame.error, AttributeError):
            return False

    def area_imagen(self, vw=None, vh=None):
        """Dónde queda la imagen del juego en una ventana de vw×vh píxeles: (x, y, ancho, alto).

        La imagen conserva la proporción de la resolución lógica; si la ventana
        tiene otra forma, sobra espacio a los lados o arriba y abajo.
        """
        if vw is None:
            vw, vh = self.window.size
        esc = min(vw / self.W, vh / self.H)
        w = max(1, round(self.W * esc))
        h = max(1, round(self.H * esc))
        return (vw - w) // 2, (vh - h) // 2, w, h

    def escala(self):
        """Píxeles de la ventana por cada píxel lógico."""
        return self.area_imagen()[2] / self.W

    def raton(self):
        """Posición del ratón en coordenadas lógicas (fuera de 0..W-1 sobre las franjas negras)."""
        x, y = pygame.mouse.get_pos()
        return self.logico_de(x, y)

    def logico_de(self, x, y):
        """Convierte un píxel de la ventana (el de los eventos del ratón) a coordenadas lógicas."""
        ax, ay, aw, ah = self.area_imagen()
        return (math.floor((x + 0.5 - ax) * self.W / aw),
                math.floor((y + 0.5 - ay) * self.H / ah))

    # ------------------------------------------------------------------
    def limpiar(self, color=(0, 0, 0)):
        """Comienza un cuadro: en adelante se dibuja sobre el lienzo."""
        self.r.target = self.lienzo
        self.r.set_viewport(None)
        self.r.draw_color = (*color[:3], 255)
        self.r.clear()

    def presentar(self):
        """Copia el lienzo a la ventana, escalado y centrado, y lo muestra."""
        r = self.r
        r.target = None
        r.draw_color = (0, 0, 0, 255)
        r.clear()
        # en la ventana el área de dibujo es la ventana entera (SDL la ajusta al cambiar de tamaño)
        salida = r.get_viewport()
        if salida.w > 0 and salida.h > 0:
            self.lienzo.draw(dstrect=self.area_imagen(salida.w, salida.h))
        r.present()

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

    def imagen(self):
        """Superficie con el último cuadro dibujado, en resolución lógica."""
        anterior = self.r.target
        self.r.target = self.lienzo
        try:
            return self.r.to_surface()
        finally:
            self.r.target = anterior

    def captura(self, ruta):
        pygame.image.save(self.imagen(), str(ruta))
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


_abreviados = {}


def abreviar(s, fuente, ancho):
    """El texto tal cual si cabe en el ancho; si no, recortado con puntos suspensivos."""
    clave = (s, id(fuente), ancho)
    r = _abreviados.get(clave)
    if r is None:
        r = s
        if fuente.size(s)[0] > ancho:
            lo, hi = 0, len(s)
            while lo < hi:
                m = (lo + hi + 1) // 2
                if fuente.size(s[:m].rstrip(" ,.;") + "…")[0] <= ancho:
                    lo = m
                else:
                    hi = m - 1
            r = s[:lo].rstrip(" ,.;") + "…"
        if len(_abreviados) > 3000:
            _abreviados.clear()
        _abreviados[clave] = r
    return r
