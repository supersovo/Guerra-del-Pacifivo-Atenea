"""Controles de la interfaz: botones, campos de texto, listas, desplegables...

Cada control recibe eventos ya convertidos a coordenadas lógicas (Evento) y se
dibuja con el Estilo. Son deliberadamente simples: los menús del juego son
pocos y la acción ocurre en el campo de batalla.
"""

import sys

import pygame

from .. import fuentes
from ..graficos import paleta as P
from ..lienzo import envolver

# En Mac, ⌘ (Cmd) hace de Ctrl, como en los demás programas: ⌘V pega y ⌘+número forma un grupo.
MOD_CTRL = pygame.KMOD_CTRL | (pygame.KMOD_GUI if sys.platform == "darwin" else 0)


class Evento:
    """Evento de pygame con la posición del ratón en coordenadas lógicas.

    SDL entrega la posición en píxeles de la ventana; se convierte aquí, una sola
    vez, con la misma cuenta que usa el lienzo para escalar la imagen.
    """

    __slots__ = ("type", "pos", "button", "key", "mod", "text", "y", "x", "unicode", "consumido")

    def __init__(self, ev, lz):
        self.type = ev.type
        self.pos = None
        self.button = getattr(ev, "button", None)
        self.key = getattr(ev, "key", None)
        self.mod = getattr(ev, "mod", 0)
        self.text = getattr(ev, "text", "")
        self.unicode = getattr(ev, "unicode", "")
        self.x = getattr(ev, "x", 0)
        self.y = getattr(ev, "y", 0)
        if hasattr(ev, "pos"):
            self.pos = lz.logico_de(*ev.pos)
        self.consumido = False


class Widget:
    def __init__(self, rect):
        self.rect = pygame.Rect(rect)
        self.visible = True
        self.activo = True
        self.tooltip = None

    def manejar(self, ev):
        return False

    def actualizar(self, dt):
        pass

    def dibujar(self, ui):
        pass

    def encima(self, ui):
        return self.rect.collidepoint(ui.raton)


class Etiqueta(Widget):
    def __init__(self, rect, texto, fuente=None, color=P.TINTA, ancla="izq"):
        super().__init__(rect)
        self.texto = texto
        self.fuente = fuente
        self.color = color
        self.ancla = ancla

    def dibujar(self, ui):
        f = self.fuente or fuentes.cuerpo(16)
        x = self.rect.x if self.ancla == "izq" else (self.rect.centerx if self.ancla == "centro" else self.rect.right)
        ui.lz.texto(self.texto, x, self.rect.y, f, self.color, self.ancla)


class Boton(Widget):
    def __init__(self, rect, texto, accion=None, tipo="normal", atajo=None, tooltip=None, fuente=None):
        super().__init__(rect)
        self.texto = texto
        self.accion = accion
        self.tipo = tipo
        self.atajo = atajo
        self.tooltip = tooltip
        self.fuente = fuente
        self._pulsado = False

    def manejar(self, ev):
        if not self.visible or not self.activo:
            return False
        if ev.type == pygame.MOUSEBUTTONDOWN and ev.button == 1 and self.rect.collidepoint(ev.pos):
            self._pulsado = True
            return True
        if ev.type == pygame.MOUSEBUTTONUP and ev.button == 1:
            if self._pulsado and self.rect.collidepoint(ev.pos):
                self._pulsado = False
                self.disparar()
                return True
            self._pulsado = False
        if ev.type == pygame.KEYDOWN and self.atajo is not None and ev.key == self.atajo:
            self.disparar()
            return True
        return False

    def disparar(self):
        if self.accion is not None:
            from ..sonido import sonido
            sonido().ui("clic")
            self.accion()

    def dibujar(self, ui):
        if not self.visible:
            return
        if not self.activo:
            estado = "inactivo"
        elif self._pulsado:
            estado = "pulsado"
        elif self.encima(ui):
            estado = "encima"
        else:
            estado = "normal"
        ui.estilo.boton(self.rect, self.texto, estado, self.fuente, self.tipo)


class Campo(Widget):
    def __init__(self, rect, texto="", oculto=False, maximo=40, al_enter=None, pista=""):
        super().__init__(rect)
        self.texto = texto
        self.oculto = oculto
        self.maximo = maximo
        self.al_enter = al_enter
        self.pista = pista
        self.foco = False
        self._t = 0.0

    def manejar(self, ev):
        if not self.visible or not self.activo:
            return False
        if ev.type == pygame.MOUSEBUTTONDOWN and ev.button == 1:
            antes = self.foco
            self.foco = self.rect.collidepoint(ev.pos)
            if self.foco and not antes:
                pygame.key.start_text_input()
            return self.foco
        if not self.foco:
            return False
        if ev.type == pygame.TEXTINPUT:
            if len(self.texto) + len(ev.text) <= self.maximo:
                self.texto += "".join(ch for ch in ev.text if ch.isprintable())
            return True
        if ev.type == pygame.KEYDOWN:
            if ev.key == pygame.K_BACKSPACE:
                self.texto = self.texto[:-1]
                return True
            if ev.key in (pygame.K_RETURN, pygame.K_KP_ENTER):
                if self.al_enter:
                    self.al_enter()
                return True
            if ev.key == pygame.K_v and ev.mod & MOD_CTRL:
                try:
                    pegado = pygame.scrap.get_text() if hasattr(pygame, "scrap") else ""
                except pygame.error:
                    pegado = ""
                if pegado:
                    self.texto = (self.texto + pegado.strip())[: self.maximo]
                return True
            return ev.key not in (pygame.K_ESCAPE, pygame.K_TAB)
        return False

    def actualizar(self, dt):
        self._t += dt

    def dibujar(self, ui):
        if not self.visible:
            return
        lz = ui.lz
        r = self.rect
        lz.rect(r, (60, 42, 28))
        lz.rect(r.inflate(-2, -2), (250, 244, 228) if self.activo else (214, 206, 190))
        lz.marco(r.inflate(-2, -2), P.BRONCE if self.foco else (150, 126, 90), 1)
        f = fuentes.cuerpo(17)
        mostrado = ("•" * len(self.texto)) if self.oculto else self.texto
        y = r.centery - f.get_height() // 2
        if mostrado:
            w, _ = lz.medir(mostrado, f)
            desplaz = max(0, w - (r.w - 14))
            lz.recortar(r.inflate(-6, -2))
            lz.texto(mostrado, 4 - desplaz, y - r.y - 1, f, P.TINTA)
            lz.recortar(None)
        elif self.pista and not self.foco:
            lz.texto(self.pista, r.x + 7, y, f, (150, 140, 124))
        if self.foco and int(self._t * 2) % 2 == 0:
            w = lz.medir(mostrado, f)[0] if mostrado else 0
            x = r.x + 7 + min(w, r.w - 14)
            lz.rect((x, r.y + 6, 2, r.h - 12), P.TINTA)


class Lista(Widget):
    def __init__(self, rect, items=None, al_elegir=None, al_doble=None, alto_fila=26, fuente=None):
        super().__init__(rect)
        self.items = items or []      # [(clave, texto)] o [(clave, texto, color)]
        self.al_elegir = al_elegir
        self.al_doble = al_doble
        self.alto_fila = alto_fila
        self.fuente = fuente
        self.sel = None
        self.desplaz = 0
        self._ultimo_clic = (None, 0)

    def poner(self, items):
        claves = [it[0] for it in items]
        self.items = items
        if self.sel not in claves:
            self.sel = None
        self.desplaz = max(0, min(self.desplaz, len(items) - self.filas()))

    def filas(self):
        return max(1, (self.rect.h - 6) // self.alto_fila)

    def manejar(self, ev):
        if not self.visible:
            return False
        if ev.type == pygame.MOUSEWHEEL:
            from .ui import ui_actual
            if self.rect.collidepoint(ui_actual().raton):
                self.desplaz = max(0, min(max(0, len(self.items) - self.filas()), self.desplaz - ev.y))
                return True
        if ev.type == pygame.MOUSEBUTTONDOWN and ev.button == 1 and self.rect.collidepoint(ev.pos):
            k = (ev.pos[1] - self.rect.y - 3) // self.alto_fila + self.desplaz
            if 0 <= k < len(self.items):
                clave = self.items[k][0]
                ahora = pygame.time.get_ticks()
                doble = self._ultimo_clic[0] == clave and ahora - self._ultimo_clic[1] < 400
                self._ultimo_clic = (clave, ahora)
                self.sel = clave
                if self.al_elegir:
                    self.al_elegir(clave)
                if doble and self.al_doble:
                    self.al_doble(clave)
            return True
        return False

    def dibujar(self, ui):
        if not self.visible:
            return
        lz = ui.lz
        r = self.rect
        lz.rect(r, (70, 50, 32))
        lz.rect(r.inflate(-2, -2), (240, 230, 206))
        f = self.fuente or fuentes.cuerpo(17)
        n = self.filas()
        for i, it in enumerate(self.items[self.desplaz:self.desplaz + n]):
            y = r.y + 3 + i * self.alto_fila
            fila = pygame.Rect(r.x + 2, y, r.w - 4, self.alto_fila)
            if it[0] == self.sel:
                lz.rect(fila, (150, 44, 34))
                col = P.CREMA
            else:
                if fila.collidepoint(ui.raton):
                    lz.rect(fila, (226, 210, 176))
                col = it[2] if len(it) > 2 else P.TINTA
            lz.texto(it[1], fila.x + 6, y + (self.alto_fila - f.get_height()) // 2, f, col)
        if len(self.items) > n:
            total = len(self.items)
            h = max(16, r.h * n // total)
            y = r.y + (r.h - h) * self.desplaz // max(1, total - n)
            lz.rect((r.right - 6, y, 4, h), (120, 90, 60))


class Desplegable(Widget):
    def __init__(self, rect, opciones, valor=None, al_cambiar=None):
        super().__init__(rect)
        self.opciones = opciones   # [(valor, texto)]
        self.valor = valor if valor is not None else (opciones[0][0] if opciones else None)
        self.al_cambiar = al_cambiar
        self.abierto = False

    def texto_actual(self):
        for v, t in self.opciones:
            if v == self.valor:
                return t
        return "—"

    def _rect_opciones(self):
        alto = 24 * len(self.opciones)
        return pygame.Rect(self.rect.x, self.rect.bottom, self.rect.w, alto)

    def manejar(self, ev):
        if not self.visible or not self.activo:
            return False
        if ev.type == pygame.MOUSEBUTTONDOWN and ev.button == 1:
            if self.abierto:
                ro = self._rect_opciones()
                if ro.collidepoint(ev.pos):
                    k = (ev.pos[1] - ro.y) // 24
                    if 0 <= k < len(self.opciones):
                        nuevo = self.opciones[k][0]
                        if nuevo != self.valor:
                            self.valor = nuevo
                            if self.al_cambiar:
                                self.al_cambiar(nuevo)
                self.abierto = False
                return True
            if self.rect.collidepoint(ev.pos):
                self.abierto = True
                return True
        return False

    def dibujar(self, ui):
        if not self.visible:
            return
        estado = "inactivo" if not self.activo else ("encima" if self.encima(ui) else "normal")
        ui.estilo.boton(self.rect, self.texto_actual() + "  ▾", estado, fuentes.cuerpo(16))
        if self.abierto:
            ui.diferido.append(self._dibujar_opciones)

    def _dibujar_opciones(self, ui):
        lz = ui.lz
        ro = self._rect_opciones()
        lz.rect(ro.inflate(2, 2), (40, 26, 16))
        f = fuentes.cuerpo(16)
        for k, (v, t) in enumerate(self.opciones):
            fila = pygame.Rect(ro.x, ro.y + k * 24, ro.w, 24)
            c = (150, 44, 34) if v == self.valor else ((226, 210, 176) if fila.collidepoint(ui.raton) else P.PERGAMINO)
            lz.rect(fila, c)
            lz.texto(t, fila.x + 8, fila.y + 3, f, P.CREMA if v == self.valor else P.TINTA)


class Casilla(Widget):
    def __init__(self, rect, texto, valor=False, al_cambiar=None):
        super().__init__(rect)
        self.texto = texto
        self.valor = valor
        self.al_cambiar = al_cambiar

    def manejar(self, ev):
        if self.visible and self.activo and ev.type == pygame.MOUSEBUTTONDOWN and ev.button == 1 \
                and self.rect.collidepoint(ev.pos):
            self.valor = not self.valor
            if self.al_cambiar:
                self.al_cambiar(self.valor)
            return True
        return False

    def dibujar(self, ui):
        if not self.visible:
            return
        lz = ui.lz
        caja = pygame.Rect(self.rect.x, self.rect.centery - 9, 18, 18)
        lz.rect(caja, (60, 42, 28))
        lz.rect(caja.inflate(-2, -2), (250, 244, 228))
        if self.valor:
            lz.linea((caja.x + 4, caja.centery), (caja.centerx - 1, caja.bottom - 5), P.ROJO_SELLO)
            lz.linea((caja.x + 4, caja.centery + 1), (caja.centerx - 1, caja.bottom - 4), P.ROJO_SELLO)
            lz.linea((caja.centerx - 1, caja.bottom - 5), (caja.right - 4, caja.y + 4), P.ROJO_SELLO)
            lz.linea((caja.centerx, caja.bottom - 5), (caja.right - 3, caja.y + 4), P.ROJO_SELLO)
        f = fuentes.cuerpo(17)
        lz.texto(self.texto, caja.right + 8, self.rect.centery - f.get_height() // 2, f,
                 P.TINTA if self.activo else P.GRIS)


class Deslizador(Widget):
    def __init__(self, rect, valor=0.5, al_cambiar=None, minimo=0.0, maximo=1.0):
        super().__init__(rect)
        self.valor = valor
        self.al_cambiar = al_cambiar
        self.minimo = minimo
        self.maximo = maximo
        self._arrastre = False

    def _fijar(self, x):
        f = max(0.0, min(1.0, (x - self.rect.x) / max(1, self.rect.w)))
        self.valor = self.minimo + f * (self.maximo - self.minimo)
        if self.al_cambiar:
            self.al_cambiar(self.valor)

    def manejar(self, ev):
        if not self.visible:
            return False
        if ev.type == pygame.MOUSEBUTTONDOWN and ev.button == 1 and self.rect.inflate(0, 10).collidepoint(ev.pos):
            self._arrastre = True
            self._fijar(ev.pos[0])
            return True
        if ev.type == pygame.MOUSEMOTION and self._arrastre:
            self._fijar(ev.pos[0])
            return True
        if ev.type == pygame.MOUSEBUTTONUP and ev.button == 1 and self._arrastre:
            self._arrastre = False
            return True
        return False

    def dibujar(self, ui):
        lz = ui.lz
        r = self.rect
        lz.rect((r.x, r.centery - 3, r.w, 6), (90, 66, 44))
        f = (self.valor - self.minimo) / max(1e-9, self.maximo - self.minimo)
        lz.rect((r.x, r.centery - 3, int(r.w * f), 6), P.ROJO_SELLO)
        x = r.x + int(r.w * f)
        lz.rect((x - 5, r.centery - 9, 10, 18), P.BRONCE)
        lz.marco((x - 5, r.centery - 9, 10, 18), (60, 40, 20))


class Tabla(Widget):
    """Tabla con columnas alineadas, selección y desplazamiento con la rueda.

    columnas: [(título, ancho, ancla)]; filas: [(clave, [celdas], color o None)].
    """

    def __init__(self, rect, columnas, filas=None, al_elegir=None, al_doble=None, alto_fila=24, fuente=None):
        super().__init__(rect)
        self.columnas = columnas
        self.filas = filas or []
        self.al_elegir = al_elegir
        self.al_doble = al_doble
        self.alto_fila = alto_fila
        self.fuente = fuente
        self.sel = None
        self.desplaz = 0
        self._ultimo_clic = (None, 0)
        self.vacia = ""

    def poner(self, filas):
        self.filas = filas
        if self.sel not in [f[0] for f in filas]:
            self.sel = None
        self.desplaz = max(0, min(self.desplaz, len(filas) - self.visibles()))

    def visibles(self):
        return max(1, (self.rect.h - self.alto_fila - 6) // self.alto_fila)

    def manejar(self, ev):
        if not self.visible:
            return False
        if ev.type == pygame.MOUSEWHEEL:
            from .ui import ui_actual
            if self.rect.collidepoint(ui_actual().raton):
                self.desplaz = max(0, min(max(0, len(self.filas) - self.visibles()), self.desplaz - ev.y))
                return True
        if ev.type == pygame.MOUSEBUTTONDOWN and ev.button == 1 and self.rect.collidepoint(ev.pos):
            k = (ev.pos[1] - self.rect.y - 3 - self.alto_fila) // self.alto_fila + self.desplaz
            if ev.pos[1] >= self.rect.y + 3 + self.alto_fila and 0 <= k < len(self.filas):
                clave = self.filas[k][0]
                ahora = pygame.time.get_ticks()
                doble = self._ultimo_clic[0] == clave and ahora - self._ultimo_clic[1] < 400
                self._ultimo_clic = (clave, ahora)
                self.sel = clave
                if self.al_elegir:
                    self.al_elegir(clave)
                if doble and self.al_doble:
                    self.al_doble(clave)
            return True
        return False

    def dibujar(self, ui):
        if not self.visible:
            return
        lz = ui.lz
        r = self.rect
        lz.rect(r, (70, 50, 32))
        lz.rect(r.inflate(-2, -2), (240, 230, 206))
        f = self.fuente or fuentes.cuerpo(16)
        fb = fuentes.negrita(f.get_height() - 4 if f.get_height() > 18 else 15)
        lz.rect((r.x + 2, r.y + 2, r.w - 4, self.alto_fila), (214, 196, 156))

        def celdas(y, valores, fuente, color):
            x = r.x + 8
            for (_t, ancho, ancla), v in zip(self.columnas, valores):
                tx = x if ancla == "izq" else (x + ancho // 2 if ancla == "centro" else x + ancho - 6)
                lz.texto(str(v), tx, y + (self.alto_fila - fuente.get_height()) // 2, fuente, color, ancla)
                x += ancho

        celdas(r.y + 2, [c[0] for c in self.columnas], fb, P.TINTA)
        n = self.visibles()
        y0 = r.y + 3 + self.alto_fila
        if not self.filas and self.vacia:
            lz.texto(self.vacia, r.x + 10, y0 + 6, fuentes.cursiva(15), P.TINTA_SUAVE)
        for i, fila in enumerate(self.filas[self.desplaz:self.desplaz + n]):
            y = y0 + i * self.alto_fila
            rf = pygame.Rect(r.x + 2, y, r.w - 4, self.alto_fila)
            if fila[0] == self.sel:
                lz.rect(rf, (150, 44, 34))
                col = P.CREMA
            else:
                if rf.collidepoint(ui.raton):
                    lz.rect(rf, (226, 210, 176))
                elif i % 2:
                    lz.rect(rf, (232, 220, 192))
                col = fila[2] if len(fila) > 2 and fila[2] else P.TINTA
            celdas(y, fila[1], f, col)
        if len(self.filas) > n:
            total = len(self.filas)
            h = max(16, (r.h - self.alto_fila) * n // total)
            y = y0 + (r.h - self.alto_fila - 6 - h) * self.desplaz // max(1, total - n)
            lz.rect((r.right - 6, y, 4, h), (120, 90, 60))


class PanelChat(Widget):
    """Conversación del salón o de la sala: historial y campo para escribir.

    Lee las líneas de app.chat_salon (el historial sobrevive al cambiar de
    escena) y envía con el canal indicado.
    """

    def __init__(self, rect, app, canal="general"):
        super().__init__(rect)
        self.app = app
        self.canal = canal
        r = self.rect
        self.campo = Campo((r.x + 8, r.bottom - 38, r.w - 16, 30), "", maximo=200, al_enter=self.enviar,
                           pista="Escriba un mensaje y pulse Enter")

    def enviar(self):
        texto = self.campo.texto.strip()
        if texto and self.app.red is not None:
            self.app.red.enviar({"t": "chat", "texto": texto, "canal": self.canal})
        self.campo.texto = ""

    def manejar(self, ev):
        return self.campo.manejar(ev)

    def actualizar(self, dt):
        self.campo.actualizar(dt)

    def dibujar(self, ui):
        lz = ui.lz
        r = self.rect
        lz.rect(r, (70, 50, 32))
        lz.rect(r.inflate(-2, -2), (240, 230, 206))
        f = fuentes.cuerpo(16)
        fb = fuentes.negrita(16)
        alto = f.get_linesize()
        area = pygame.Rect(r.x + 8, r.y + 6, r.w - 16, r.h - 52)
        lineas = []
        for de, texto, canal in self.app.chat_salon:
            if self.canal == "sala" and canal not in ("sala",):
                continue
            if self.canal == "general" and canal == "sala":
                continue
            ancho_nombre = lz.medir(de + ": ", fb)[0]
            partes = envolver(texto, f, max(40, area.w - ancho_nombre)) or [""]
            lineas.append((de + ": ", partes[0]))
            for p in partes[1:]:
                lineas.append(("", p))
        caben = max(1, area.h // alto)
        y = area.y
        for de, txt in lineas[-caben:]:
            x = area.x
            if de:
                lz.texto(de, x, y, fb, P.ROJO_SELLO)
                x += lz.medir(de, fb)[0]
            else:
                x += 18
            lz.texto(txt, x, y, f, P.TINTA)
            y += alto
        if not lineas:
            lz.texto("Sin mensajes todavía.", area.x, area.y, fuentes.cursiva(15), P.TINTA_SUAVE)
        self.campo.dibujar(ui)
