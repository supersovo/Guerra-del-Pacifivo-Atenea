"""Dibujo del campo de batalla: terreno, sombras, edificios, tropas, árboles,
efectos, niebla de guerra y marcas de selección, en orden de profundidad."""

import math
import time

import pygame

from ...red import instantanea as I
from ..graficos import edificios as G_E
from ..graficos import naturaleza as N
from ..graficos.efectos import Efectos
from ..graficos.paleta import color_jugador
from ..graficos.sprites import Sprites, tam_sprite
from ..graficos.terreno import Terreno

# vista según la dirección (0=E 1=SE 2=S 3=SO 4=O 5=NO 6=N 7=NE): (vista, espejo)
VISTA_DIR = {0: ("lado", False), 1: ("lado", False), 2: ("frente", False), 3: ("lado", True),
             4: ("lado", True), 5: ("lado", True), 6: ("espalda", False), 7: ("lado", False)}
TABLA_NIEBLA = bytes([255, 150, 0, 0] + [0] * 252)


class Vista:
    def __init__(self, lz, estado, cat):
        self.lz = lz
        self.est = estado
        self.cat = cat
        m = estado.mapa
        self.terreno = Terreno(lz, m, semilla=(estado.inicio.get("semilla", 7) % 97) + 3)
        self.sprites = Sprites(lz, cat)
        self.edificios = G_E.Edificios(lz, cat)
        self.efx = Efectos(lz)
        self.t_sombra = lz.textura(("n", "sombra"), N.sombra)
        self.t_anillo = lz.textura(("n", "anillo"), N.anillo)
        self.t_pozo = lz.textura(("n", "pozo"), N.pozo)
        self.t_salitre = [lz.textura(("n", "salitre", f), lambda f=f: N.salitre(f, 3)) for f in range(4)]
        self.t_arboles = [lz.textura(("n", "tamarugo", k), lambda k=k: N.tamarugo(k)) for k in range(3)]
        self.t_reunion = lz.textura(("n", "reunion"), N.bandera_reunion)
        self.t_aspas = self.edificios.aspas()
        self.arboles = []
        for y in range(m.h):
            for x in range(m.w):
                if m.terreno[y * m.w + x] == 6:
                    self.arboles.append((x * 32 + 16, y * 32 + 28, (x * 7 + y * 3) % 3))
        self.niebla_tex = None
        self.niebla_sup = None
        self._niebla_ver = -1
        self.t = 0.0
        self.mostrar_barras = False

    # ------------------------------------------------------------------
    def actualizar_niebla(self):
        est = self.est
        m = est.mapa
        n = m.n
        vis = int.from_bytes(est.vis, "little")
        expl = int.from_bytes(est.explorado, "little")
        comb = ((vis << 1) | expl).to_bytes(n, "little").translate(TABLA_NIEBLA)
        rgba = bytearray(4 * n)
        rgba[3::4] = comb
        sup = pygame.image.frombuffer(bytes(rgba), (m.w, m.h), "RGBA")
        if self.niebla_tex is None:
            self.niebla_tex = self.lz.textura_de(sup)
        else:
            self.niebla_tex.update(sup)
        self.niebla_sup = sup

    # ------------------------------------------------------------------
    def dibujar(self, cam, seleccion, dt, extra=None):
        lz = self.lz
        self.t += dt
        z = cam.zoom
        lz.recortar(cam.vista)
        vista_local = pygame.Rect(0, 0, cam.vista.w, cam.vista.h)
        guardada = cam.vista
        cam.vista = vista_local
        try:
            self.terreno.dibujar(lz, cam.x, cam.y, z, vista_local)
            self.efx.dibujar_marcas(lz, cam)
            self._dibujar_entidades(cam, seleccion)
            self.efx.dibujar(lz, cam)
            if extra is not None:
                extra(cam)
            self._dibujar_niebla(cam)
            self._dibujar_barras(cam, seleccion)
        finally:
            cam.vista = guardada
            lz.recortar(None)

    def _dibujar_niebla(self, cam):
        if self.niebla_tex is None or self.est.espectador:
            return
        m = self.est.mapa
        z = cam.zoom
        # solo el trozo visible (con una casilla de margen): estirar la textura sobre el mapa
        # entero cuesta muy caro cuando el equipo no tiene aceleración gráfica
        r = cam.rect_mapa()
        tx0 = max(0, r.x // 32 - 1)
        ty0 = max(0, r.y // 32 - 1)
        tx1 = min(m.w, r.right // 32 + 2)
        ty1 = min(m.h, r.bottom // 32 + 2)
        if tx1 <= tx0 or ty1 <= ty0:
            return
        x, y = cam.a_pantalla(tx0 * 32, ty0 * 32)
        self.lz.dibujar(self.niebla_tex, x, y, (tx1 - tx0) * 32 * z, (ty1 - ty0) * 32 * z,
                        src=(tx0, ty0, tx1 - tx0, ty1 - ty0))

    def _visible_ent(self, e):
        est = self.est
        if e.fantasma:
            return est.explorado_px(e.x, e.y)
        if e.es_recurso:
            return est.explorado_px(e.x, e.y)
        return True

    def _dibujar_entidades(self, cam, seleccion):
        lz = self.lz
        est = self.est
        z = cam.zoom
        rm = cam.rect_mapa().inflate(160, 160)
        cosas = []
        for e in est.ents.values():
            if not rm.collidepoint(e.x, e.y):
                continue
            if not self._visible_ent(e):
                continue
            if e.es_edificio:
                cosas.append((e.y + e.tipo.alto * 16, 1, e))
            else:
                cosas.append((e.y, 0, e))
        for (x, y, k) in self.arboles:
            if rm.collidepoint(x, y):
                cosas.append((y, 2, (x, y, k)))
        cosas.sort(key=lambda c: (c[0], c[1]))
        # sombras y anillos debajo de todas las tropas
        ahora = time.monotonic()
        for _y, clase, e in cosas:
            if clase != 0 or e.tipo is None:
                continue
            sx, sy = cam.a_pantalla(e.x, e.y)
            w = (e.tipo.radio / 16) * 2.6 * z
            if e.tipo.capa == 1:
                continue
            lz.dibujar(self.t_sombra, sx - w / 2, sy - w * 0.18, w, w * 0.36)
            if e.id in seleccion:
                col = (90, 230, 90) if est.aliado(e.dueno) else (230, 70, 60)
                lz.dibujar(self.t_anillo, sx - w * 0.62, sy - w * 0.24, w * 1.24, w * 0.5, color=col)
            elif e.dueno >= 0:
                lz.dibujar(self.t_anillo, sx - w * 0.5, sy - w * 0.18, w, w * 0.36, alpha=110,
                           color=color_jugador(est.jugadores[e.dueno]["color"]))
        for _y, clase, e in cosas:
            if clase == 2:
                x, y, k = e
                sx, sy = cam.a_pantalla(x, y)
                t = self.t_arboles[k]
                lz.dibujar(t, sx - t.width * z / 2, sy - t.height * z + 6 * z, t.width * z, t.height * z)
            elif clase == 1:
                self._edificio(cam, e, e.id in seleccion, ahora)
            elif e.es_recurso:
                self._recurso(cam, e, e.id in seleccion)
            elif e.t == I.TIPO_MINA:
                sx, sy = cam.a_pantalla(e.x, e.y)
                tm = lz.textura(("n", "mina", e.dueno), lambda: N.mina((220, 40, 30)))
                lz.dibujar(tm, sx - 8 * z, sy - 6 * z, 16 * z, 12 * z, alpha=200)
            else:
                self._unidad(cam, e, ahora)

    def _recurso(self, cam, e, sel):
        lz = self.lz
        z = cam.zoom
        sx, sy = cam.a_pantalla(e.x, e.y)
        if e.t == I.TIPO_SALITRE:
            fase = 0 if e.vida > 1100 else (1 if e.vida > 700 else (2 if e.vida > 300 else 3))
            t = self.t_salitre[fase]
            lz.dibujar(t, sx - 34 * z, sy - 30 * z, 68 * z, 46 * z, alpha=255 if not e.fantasma else 200)
            if sel:
                lz.dibujar(self.t_anillo, sx - 36 * z, sy - 4 * z, 72 * z, 24 * z, color=(240, 220, 90))
        else:
            # el pozo queda debajo del molino si lo hay
            t = self.t_pozo
            lz.dibujar(t, sx - 52 * z, sy - 52 * z, 104 * z, 100 * z)
            if sel:
                lz.dibujar(self.t_anillo, sx - 54 * z, sy - 30 * z, 108 * z, 70 * z, color=(240, 220, 90))

    def _edificio(self, cam, e, sel, ahora):
        lz = self.lz
        est = self.est
        z = cam.zoom
        tipo = e.tipo
        fac = est.faccion(e.dueno)
        col = color_jugador(est.jugadores[e.dueno]["color"]) if e.dueno >= 0 else (200, 200, 200)
        tex = self.edificios.textura(tipo, fac.id if fac else "chile", col)
        x0 = e.x - tipo.ancho * 16 - G_E.MARGEN
        y0 = e.y - tipo.alto * 16 - G_E.ALTO
        sx, sy = cam.a_pantalla(x0, y0)
        W, H = tex.width, tex.height
        alpha = 170 if e.fantasma else 255
        if sel:
            fx, fy = cam.a_pantalla(e.x - tipo.ancho * 16, e.y - tipo.alto * 16)
            lz.marco((fx - 2, fy - 2, tipo.ancho * 32 * z + 4, tipo.alto * 32 * z + 4),
                     (90, 230, 90) if est.aliado(e.dueno) else (230, 70, 60), 2)
        if e.fl & I.F_OBRA:
            prog = e.ex.get("o", 0) / 100 if isinstance(e.ex, dict) else 0.0
            andamio = self.edificios.andamio(tipo)
            lz.dibujar(andamio, sx, sy, W * z, H * z, alpha=alpha)
            alto_vis = int(H * (0.15 + 0.85 * prog))
            src = (0, H - alto_vis, W, alto_vis)
            lz.dibujar(tex, sx, sy + (H - alto_vis) * z, W * z, alto_vis * z, src=src, alpha=int(alpha * 0.9))
            if int(self.t * 6 + e.id) % 7 == 0:
                self.efx.polvo_obra(e.x, e.y + tipo.alto * 10)
            return
        tinte = None
        if e.fl & I.F_SABOTAJE:
            tinte = (150, 140, 140)
        lz.dibujar(tex, sx, sy, W * z, H * z, alpha=alpha, color=tinte)
        if tipo.id == "molino_agua" and not e.fantasma:
            ax, ay = cam.a_pantalla(e.x, y0 + G_E.ALTO - 31)
            ang = (self.t * 90) % 360
            lz.dibujar(self.t_aspas, ax - 15 * z, ay - 15 * z, 30 * z, 30 * z, angulo=ang)
        if not e.fantasma:
            st = est.stats_de(tipo)
            vmax = st.vida if e.dueno == est.yo else tipo.vida
            frac = e.vida / max(1, vmax)
            if frac < 0.6 and int(self.t * 10 + e.id) % 4 == 0:
                self.efx.humo_incendio(e.x + ((e.id * 37) % 40 - 20), e.y - tipo.alto * 8, fuego=frac < 0.3)
            if tipo.id == "maestranza" and int(self.t * 4 + e.id) % 5 == 0:
                self.efx.humo_chimenea(x0 + G_E.MARGEN + tipo.ancho * 32 - 16, y0 + G_E.ALTO - 22)

    def _unidad(self, cam, e, ahora):
        lz = self.lz
        est = self.est
        z = cam.zoom
        tipo = e.tipo
        if tipo is None:
            return
        fac = est.faccion(e.dueno)
        col = color_jugador(est.jugadores[e.dueno]["color"])
        vista, espejo = VISTA_DIR.get(e.dir, ("lado", False))
        frame = 0
        if e.fl & I.F_MOVIENDO:
            e.mov_fase += 0.016 * 8
            frame = 1 + int(ahora * 6 + e.id) % 2
            if tipo.capa == 0 and int(ahora * 10 + e.id) % 9 == 0:
                self.efx.polvo_marcha(e.x, e.y)
        if ahora - e.ultimo_disparo < 0.25 or e.fl & I.F_DISPARO:
            frame = 3
        elif e.fl & I.F_TRABAJA:
            frame = 4 if int(ahora * 3 + e.id) % 2 else 0
        emplazada = bool(e.fl & I.F_EMPLAZADA)
        tex = self.sprites.textura(tipo, fac, col, vista, frame, emplazada)
        w, h, fx, fy = tam_sprite(tipo)
        sx, sy = cam.a_pantalla(e.x, e.y)
        alpha = 255
        if e.fl & I.F_OCULTA:
            alpha = 110 if est.aliado(e.dueno) else 90
        if tipo.capa == 1:
            ang = 45 * e.dir
            lz.dibujar(tex, sx - w * z / 2, sy - h * z / 2, w * z, h * z, angulo=ang, alpha=alpha)
            if e.fl & I.F_MOVIENDO and int(ahora * 8 + e.id) % 3 == 0:
                self.efx.polvo_marcha(e.x - math.cos(math.radians(ang)) * 30, e.y - math.sin(math.radians(ang)) * 30)
            return
        dx = sx - fx * z
        dy = sy - fy * z
        if espejo:
            dx = sx - (w - fx) * z
        lz.dibujar(tex, dx, dy, w * z, h * z, espejo=espejo, alpha=alpha)
        if e.fl & (I.F_SALITRE | I.F_AGUA) and tipo.trabajador:
            if e.fl & I.F_SALITRE:
                lz.rect((sx - 5 * z, sy - 22 * z, 7 * z, 6 * z), (240, 240, 236))
            else:
                lz.rect((sx - 8 * z, sy - 13 * z, 4 * z, 4 * z), (70, 140, 210))
                lz.rect((sx + 4 * z, sy - 13 * z, 4 * z, 4 * z), (70, 140, 210))
                lz.linea((sx - 7 * z, sy - 20 * z), (sx + 7 * z, sy - 20 * z), (110, 80, 50))
        if e.fl & I.F_POTENCIADO and int(ahora * 4) % 2 == 0:
            lz.dibujar(self.t_anillo, sx - 9 * z, sy - 3 * z, 18 * z, 7 * z, alpha=150, color=(250, 220, 90))

    def _dibujar_barras(self, cam, seleccion):
        lz = self.lz
        est = self.est
        z = cam.zoom
        rm = cam.rect_mapa().inflate(64, 64)
        siempre = self.mostrar_barras
        for e in est.ents.values():
            if e.tipo is None or e.fantasma or not rm.collidepoint(e.x, e.y):
                continue
            sel = e.id in seleccion
            if e.dueno == est.yo:
                vmax = est.stats_de(e.tipo).vida
            else:
                vmax = e.tipo.vida
            frac = max(0.0, min(1.0, e.vida / max(1, vmax)))
            if not (sel or siempre or (frac < 1.0 and est.aliado(e.dueno))):
                continue
            if e.es_edificio:
                ancho = e.tipo.ancho * 26 * z
                bx, by = cam.a_pantalla(e.x, e.y + e.tipo.alto * 16 + 4)
            else:
                ancho = max(18, e.tipo.radio / 16 * 3) * z
                w, h, fx, fy = tam_sprite(e.tipo)
                bx, by = cam.a_pantalla(e.x, e.y - (fy - 2) - 3)
                if e.tipo.capa == 1:
                    bx, by = cam.a_pantalla(e.x, e.y - h / 2 - 2)
            x0 = bx - ancho / 2
            lz.rect((x0 - 1, by - 1, ancho + 2, 5), (20, 14, 10), 220)
            col = (70, 200, 60) if frac > 0.6 else ((230, 200, 40) if frac > 0.3 else (220, 50, 40))
            lz.rect((x0, by, ancho * frac, 3), col)
            if sel and isinstance(e.ex, dict) and "en" in e.ex and e.tipo.energia_max:
                fe = e.ex["en"] * 256 / max(1, est.stats_de(e.tipo).energia_max)
                lz.rect((x0 - 1, by + 4, ancho + 2, 4), (20, 14, 10), 220)
                lz.rect((x0, by + 5, ancho * min(1.0, fe), 2), (120, 160, 240))
