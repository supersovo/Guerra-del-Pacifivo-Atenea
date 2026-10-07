"""Dibujo del campo de batalla: terreno, sombras, edificios, tropas, árboles,
efectos, niebla de guerra y marcas de selección, en orden de profundidad."""

import math
import time

import pygame

from ...red import instantanea as I
from .. import fuentes
from ..graficos import convoy as G_C
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

# Puestos de la guarnición: dónde quedan los pies de cada soldado, en píxeles desde la
# esquina superior izquierda de la huella del edificio. En la trinchera solo asoman
# por encima del parapeto (CORTE_TRINCHERA). Las casas fuertes (barracas y cuartel
# general) tienen sus puestos en graficos/edificios.geometria_fortaleza: almenas de
# la azotea, la torre y las ventanas de la fachada.
PUESTOS = {
    "trinchera": [(18, 58), (38, 58), (58, 58), (78, 58)],
}
CORTE_TRINCHERA = 47
# el tirador de la azotea: en la tronera mientras dispara, vuelve tras el merlón y
# recarga, y si sigue en combate se asoma de nuevo a apuntar (segundos desde el disparo)
EN_TRONERA = 0.45
A_CUBIERTO = 0.75
VUELVE_A_APUNTAR = 1.15
EN_COMBATE = 3.0
FUSIL = (58, 54, 50)


def geometria(tipo):
    """Geometría de la casa fuerte (None si el edificio no lo es)."""
    forma = tipo.sprite.get("forma", tipo.id)
    if forma not in G_E.FORTALEZAS:
        return None
    g = _GEOMETRIAS.get(forma)
    if g is None:
        g = _GEOMETRIAS[forma] = G_E.geometria_fortaleza(forma)
    return g


_GEOMETRIAS = {}


def puestos(tipo):
    forma = tipo.sprite.get("forma", tipo.id)
    if forma in PUESTOS:
        return PUESTOS[forma]
    geo = geometria(tipo)
    if geo is not None:
        return [((p["rect"][0] + p["rect"][2] / 2, p["rect"][1] + p["rect"][3]) if p["tipo"] == "ventana"
                 else (p["x"], p["y"])) for p in geo["puestos"]]
    # cualquier otro edificio con guarnición: dos filas sobre la huella
    w, h = tipo.ancho * 32, tipo.alto * 32
    n = max(1, tipo.guarnicion)
    por_fila = (n + 1) // 2
    return [((k % por_fila + 1) * w / (por_fila + 1), h * (0.35 if k < por_fila else 0.7)) for k in range(n)]


def pos_puesto(e, k):
    """Posición en el mapa (píxeles) de los pies del soldado del puesto k del edificio e."""
    lista = puestos(e.tipo)
    dx, dy = lista[k % len(lista)]
    return e.x - e.tipo.ancho * 16 + dx, e.y - e.tipo.alto * 16 + dy


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
        # (edificio, puesto) -> (momento, dx, dy, x de la tronera) del último disparo de ese soldado guarnecido
        self.fuego_puesto = {}

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
            self._dibujar_agua_pozos(cam, seleccion)
            self._dibujar_barras(cam, seleccion)
            self._dibujar_galones(cam)
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
            if clase == 0 and e.t == I.TIPO_HERIDO:
                self._herido(cam, e, ahora)
                continue
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
            elif e.t == I.TIPO_HERIDO:
                pass            # ya dibujado en el suelo, debajo de las tropas
            elif e.t == I.TIPO_CONVOY:
                self._convoy(cam, e, ahora)
            else:
                self._unidad(cam, e, ahora)

    @staticmethod
    def _en_ruta(ruta, d):
        """Punto y ángulo (grados, hacia el final de la ruta) a la distancia d del comienzo."""
        for i in range(len(ruta) - 1):
            (x0, y0), (x1, y1) = ruta[i], ruta[i + 1]
            seg = math.hypot(x1 - x0, y1 - y0) or 1.0
            if d <= seg or i == len(ruta) - 2:
                f = max(0.0, min(1.0, d / seg))
                return x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, math.degrees(math.atan2(y1 - y0, x1 - x0))
            d -= seg
        return ruta[-1][0], ruta[-1][1], 0.0

    @staticmethod
    def _distancia_en_ruta(ruta, x, y):
        """Cuánto avanzó por la ruta un punto (x, y) que está sobre ella (o cerca)."""
        mejor, mejor_d2, acum = 0.0, None, 0.0
        for i in range(len(ruta) - 1):
            (x0, y0), (x1, y1) = ruta[i], ruta[i + 1]
            dx, dy = x1 - x0, y1 - y0
            seg2 = dx * dx + dy * dy or 1.0
            f = max(0.0, min(1.0, ((x - x0) * dx + (y - y0) * dy) / seg2))
            px, py = x0 + dx * f, y0 + dy * f
            d2 = (px - x) ** 2 + (py - y) ** 2
            if mejor_d2 is None or d2 < mejor_d2:
                mejor, mejor_d2 = acum + f * math.sqrt(seg2), d2
            acum += math.sqrt(seg2)
        return mejor

    def _convoy(self, cam, e, ahora):
        """El tren (locomotora y tres plataformas por la vía) o la carreta del cuartel general."""
        lz = self.lz
        est = self.est
        z = cam.zoom
        ex = e.ex if isinstance(e.ex, dict) else {}
        ruta = ex.get("r") or []
        if len(ruta) < 2:
            return
        col = color_jugador(est.jugadores[e.dueno]["color"]) if e.dueno >= 0 else (200, 200, 200)
        s = self._distancia_en_ruta(ruta, e.x, e.y)
        moviendo = (e.x0, e.y0) != (e.x1, e.y1)
        if ex.get("m") == "tren":
            piezas = [(lz.textura(("conv", "loco", col), lambda: G_C.locomotora(col)), s)]
            for k in range(3):
                t = lz.textura(("conv", "vagon", col, k), lambda k=k: G_C.vagon(col, k))
                piezas.append((t, s - 43 - 40 * k))
            for t, d in piezas:
                if d < -20:
                    continue        # todavía fuera del mapa
                x, y, ang = self._en_ruta(ruta, max(0.0, d))
                sx, sy = cam.a_pantalla(x, y)
                lz.dibujar(t, sx - t.width * z / 2, sy - t.height * z / 2, t.width * z, t.height * z, angulo=ang)
            if moviendo and int(ahora * 10 + e.id) % 3 == 0:
                x, y, ang = self._en_ruta(ruta, s)
                a = math.radians(ang)
                self.efx.humo_chimenea(x + math.cos(a) * 6, y + math.sin(a) * 6 - 6)
            return
        paso = int(ahora * 6) % 2 if moviendo else 0
        t = lz.textura(("conv", "carreta", col, paso), lambda: G_C.carreta(col, paso))
        sx, sy = cam.a_pantalla(e.x, e.y)
        lz.dibujar(t, sx - t.width * z / 2, sy - t.height * z / 2, t.width * z, t.height * z, angulo=45 * e.dir)
        if moviendo and int(ahora * 10 + e.id) % 4 == 0:
            self.efx.polvo_marcha(e.x, e.y + 6)

    def _herido(self, cam, e, ahora):
        """Herido tendido: de vez en cuando levanta el brazo pidiendo ayuda. A los suyos se les
        marca con una cruz roja (fija si ya va un camillero a buscarlo)."""
        lz = self.lz
        est = self.est
        z = cam.zoom
        ex = e.ex if isinstance(e.ex, dict) else {}
        tipo = est.tipo_por_idx(ex.get("u"))
        fac = est.faccion(e.dueno)
        if tipo is None or fac is None:
            return
        col = color_jugador(est.jugadores[e.dueno]["color"])
        frame = 1 if int(ahora * 1.5 + e.id) % 4 == 0 else 0
        tex = self.sprites.herido(tipo, fac, col, frame)
        sx, sy = cam.a_pantalla(e.x, e.y)
        lz.dibujar(tex, sx - tex.width * z / 2, sy - tex.height * z / 2 - 2 * z, tex.width * z, tex.height * z,
                   espejo=bool(e.id % 2))
        if est.aliado(e.dueno):
            viene = ex.get("c")
            if viene or int(ahora * 2) % 2 == 0:
                lz.dibujar(self.efx.t_cruz, sx - 5 * z, sy - 24 * z, 10 * z, 10 * z,
                           color=(220, 40, 40) if viene else (240, 70, 60), alpha=230)
            if ex.get("v"):
                self._galon(sx + 9 * z, sy - 22 * z, ex["v"], z)

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
        if e.fl & (I.F_OBRA | I.F_DESMONTA):
            if e.fl & I.F_OBRA:
                prog = e.ex.get("o", 0) / 100 if isinstance(e.ex, dict) else 0.0
                if not tipo.desmonta_en:        # las carpas del hospital de sangre se levantan sin andamios
                    andamio = self.edificios.andamio(tipo)
                    lz.dibujar(andamio, sx, sy, W * z, H * z, alpha=alpha)
            else:
                # se recogen las carpas: bajan hasta quedar en el carro
                prog = 1.0 - (e.ex.get("dm", 0) / 100 if isinstance(e.ex, dict) else 0.0)
            # las carpas solo ocupan la parte baja del dibujo: suben y bajan dentro de su propia altura
            contenido = min(H, tipo.alto * 32 + 48) if tipo.desmonta_en else H
            alto_vis = int(contenido * (0.15 + 0.85 * prog))
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
        if not e.fantasma and isinstance(e.ex, dict) and e.ex.get("g"):
            geo = geometria(tipo)
            frente = self.edificios.frente(tipo, fac.id if fac else "chile", col) if geo is not None else None
            if frente is not None:
                # los tiradores van entre la obra y su frente: asoman tras las almenas y en las ventanas
                despues = self._guarnicion_fortaleza(cam, e, ahora, geo)
                lz.dibujar(frente, sx, sy, W * z, H * z, alpha=alpha, color=tinte)
                for f in despues:
                    f()
            else:
                self._guarnicion(cam, e, ahora)
        if not e.fantasma:
            st = est.stats_de(tipo)
            vmax = st.vida if e.dueno == est.yo else tipo.vida
            frac = e.vida / max(1, vmax)
            if frac < 0.6 and int(self.t * 10 + e.id) % 4 == 0:
                self.efx.humo_incendio(e.x + ((e.id * 37) % 40 - 20), e.y - tipo.alto * 8, fuego=frac < 0.3)
            if tipo.id == "maestranza" and int(self.t * 4 + e.id) % 5 == 0:
                self.efx.humo_chimenea(x0 + G_E.MARGEN + tipo.ancho * 32 - 16, y0 + G_E.ALTO - 22)

    def disparo_en_puesto(self, b, k, tx, ty):
        """Recuerda hacia dónde disparó el soldado del puesto k (para girarlo y animarlo) y
        devuelve de dónde sale el fogonazo: su tronera, su ventana o, si el blanco está detrás
        de la obra, una aspillera del fondo."""
        geo = geometria(b.tipo)
        if geo is None:
            x, y = pos_puesto(b, k)
            self.fuego_puesto[(b.id, k)] = (time.monotonic(), tx - x, ty - y, None)
            return x, y
        ox, oy = b.x - b.tipo.ancho * 16, b.y - b.tipo.alto * 16
        p = geo["puestos"][k % len(geo["puestos"])]
        tronera = None
        if p["tipo"] == "ventana":
            rx, ry, rw, rh = p["rect"]
            x = ox + rx + rw / 2
            if ty < b.y - b.tipo.alto * 8:
                y = oy + geo["atras"] + 10          # el blanco está detrás: dispara por el fondo
            else:
                y = oy + ry + rh / 2 + 10           # (el fogonazo se dibuja 10 px más arriba)
        else:
            izq, der = p["troneras"]
            tronera = der if tx >= ox + p["x"] else izq
            x, y = ox + tronera, oy + p["y"] - 6
        self.fuego_puesto[(b.id, k)] = (time.monotonic(), tx - x, ty - y, tronera)
        return x, y

    def _guarnicion_fortaleza(self, cam, e, ahora, geo):
        """Tiradores de una casa fuerte, antes de pintar su frente: en la azotea salen a la tronera
        del lado del enemigo, disparan, vuelven a cubrirse tras el merlón y recargan; en las
        ventanas se asoman al disparar y se retiran a la penumbra. Devuelve lo que se pinta
        después del frente (el cañón del fusil que asoma por la ventana)."""
        lz = self.lz
        est = self.est
        z = cam.zoom
        tipo = e.tipo
        fac = est.faccion(e.dueno)
        col = color_jugador(est.jugadores[e.dueno]["color"])
        ox, oy = e.x - tipo.ancho * 16, e.y - tipo.alto * 16
        lista = geo["puestos"]
        despues = []
        for k, idx in enumerate(e.ex["g"]):
            ut = est.tipo_por_idx(idx)
            if ut is None:
                continue
            p = lista[k % len(lista)]
            ultimo = self.fuego_puesto.get((e.id, k))
            dt = ahora - ultimo[0] if ultimo is not None else 1e9
            en_combate = dt < EN_COMBATE
            vista, espejo, frame = "frente", False, 0
            if en_combate:
                d = math.degrees(math.atan2(ultimo[2], ultimo[1])) % 360
                vista, espejo = VISTA_DIR.get(int((d + 22.5) // 45) % 8, ("lado", False))
            w, h, fx, fy = tam_sprite(ut)
            if p["tipo"] in ("almena", "torre"):
                cubierto = p["x"] + 1.2 * math.sin(ahora * 0.5 + (e.id + k) * 1.7)
                tronera = ultimo[3] if ultimo is not None and ultimo[3] is not None else p["troneras"][1]
                if dt < EN_TRONERA:
                    x, frame = tronera, 3
                elif dt < A_CUBIERTO:                     # vuelve tras el merlón
                    f = (dt - EN_TRONERA) / (A_CUBIERTO - EN_TRONERA)
                    x, frame = tronera + (cubierto - tronera) * f, 1 + int(dt * 8) % 2
                elif en_combate and dt >= VUELVE_A_APUNTAR:
                    x, frame = tronera, 3                 # ya recargó: se asoma a apuntar
                else:
                    x = cubierto
                    if not en_combate:                   # de guardia: mira a uno y otro lado
                        fase = (ahora * 0.13 + ((e.id * 7 + k * 13) % 10) / 10) % 1
                        if fase < 0.12:
                            vista, espejo = "lado", True
                        elif 0.5 < fase < 0.62:
                            vista, espejo = "lado", False
                tex = self.sprites.textura(ut, fac, col, vista, frame)
                sx, sy = cam.a_pantalla(ox + x, oy + p["y"])
                lz.dibujar(tex, sx - ((w - fx) if espejo else fx) * z, sy - fy * z, w * z, h * z, espejo=espejo)
                continue
            # ventana: el soldado se ve de la cintura para arriba dentro del vano
            rx, ry, rw, rh = p["rect"]
            asomado = en_combate and (dt < 0.6 or dt >= VUELVE_A_APUNTAR)
            if asomado:
                frame = 3
                tinte = None
            else:
                vista, espejo = ("frente", False) if not en_combate else (vista, espejo)
                tinte = (78, 70, 62) if en_combate else (52, 46, 40)
            tex = self.sprites.textura(ut, fac, col, vista, frame)
            arriba = oy + ry - 6 + (0 if asomado else 2)      # el quepí queda en lo alto del vano
            alto_src = max(1, int(oy + ry + rh - arriba))
            sx, sy = cam.a_pantalla(ox + rx + rw / 2, arriba)
            lz.dibujar(tex, sx - ((w - fx) if espejo else fx) * z, sy, w * z, alto_src * z, espejo=espejo,
                       src=(0, 0, tex.width, alto_src), color=tinte)
            if asomado and ultimo is not None and ultimo[2] > -abs(ultimo[1]):
                # el cañón del fusil asoma por la ventana hacia el blanco
                d = math.hypot(ultimo[1], ultimo[2]) or 1.0
                bx, by = cam.a_pantalla(ox + rx + rw / 2, oy + ry + rh * 0.62)
                ux, uy = ultimo[1] / d, ultimo[2] / d * 0.5

                def canon_fusil(bx=bx, by=by, ux=ux, uy=uy):
                    lz.linea((bx, by), (bx + ux * 9 * z, by + uy * 9 * z), FUSIL)
                    lz.linea((bx, by + 1), (bx + ux * 9 * z, by + 1 + uy * 9 * z), FUSIL)
                despues.append(canon_fusil)
        return despues

    def _guarnicion(self, cam, e, ahora):
        """Soldados guarnecidos: asomados tras el parapeto de la trinchera o de pie en el techo."""
        lz = self.lz
        est = self.est
        z = cam.zoom
        tipo = e.tipo
        trinchera = tipo.guarnicion_vista == "trinchera"
        fac = est.faccion(e.dueno)
        col = color_jugador(est.jugadores[e.dueno]["color"])
        tops = e.y - tipo.alto * 16
        disparando = set(e.ex.get("gf", ()))
        for k, idx in enumerate(e.ex["g"]):
            ut = est.tipo_por_idx(idx)
            if ut is None:
                continue
            x, y = pos_puesto(e, k)
            frame = 0
            vista, espejo = "frente", False
            ultimo = self.fuego_puesto.get((e.id, k))
            if ultimo is not None and ahora - ultimo[0] < 2.5:
                d = math.degrees(math.atan2(ultimo[2], ultimo[1])) % 360
                vista, espejo = VISTA_DIR.get(int((d + 22.5) // 45) % 8, ("lado", False))
                if ahora - ultimo[0] < 0.25 or k in disparando:
                    frame = 3
            tex = self.sprites.textura(ut, fac, col, vista, frame)
            w, h, fx, fy = tam_sprite(ut)
            sx, sy = cam.a_pantalla(x, y)
            dx = sx - ((w - fx) if espejo else fx) * z
            dy = sy - fy * z
            if trinchera:
                # solo la cabeza, los hombros y el fusil por encima de los sacos
                alto_src = max(1, int(tops + CORTE_TRINCHERA - (y - fy)))
                lz.dibujar(tex, dx, dy, w * z, alto_src * z, espejo=espejo, src=(0, 0, tex.width, alto_src))
            else:
                lz.dibujar(self.t_sombra, sx - 7 * z, sy - 2 * z, 14 * z, 5 * z, alpha=150)
                lz.dibujar(tex, dx, dy, w * z, h * z, espejo=espejo)

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
        # en los camilleros la variante «emplazada» es la camilla con un herido
        emplazada = bool(e.fl & (I.F_EMPLAZADA | I.F_CAMILLA))
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

    def _dibujar_agua_pozos(self, cam, seleccion):
        """Cuánta agua le queda a cada pozo explorado: una barra azul y la cantidad."""
        lz = self.lz
        est = self.est
        z = cam.zoom
        rm = cam.rect_mapa().inflate(120, 120)
        for e in est.ents.values():
            if e.t != I.TIPO_AGUA or not rm.collidepoint(e.x, e.y) or not est.explorado_px(e.x, e.y):
                continue
            inicial = max(1, est.inicial.get(e.id, 2500))
            frac = max(0.0, min(1.0, e.vida / inicial))
            ancho = 64 * z
            bx, by = cam.a_pantalla(e.x, e.y + 60)
            x0 = bx - ancho / 2
            lz.rect((x0 - 2, by - 2, ancho + 4, 9 * z + 4), (20, 14, 10), 200)
            lz.rect((x0, by, ancho, 9 * z), (54, 44, 36))
            col = (70, 150, 230) if frac > 0.25 else ((230, 190, 60) if frac > 0 else (150, 60, 50))
            lz.rect((x0, by, ancho * frac, 9 * z), col)
            if z >= 0.6 or e.id in seleccion:
                lz.texto(f"{e.vida}" if e.vida > 0 else "seco", bx, by + 9 * z + 3, fuentes.negrita(13),
                         (236, 240, 250), "centro", sombra=(10, 20, 40))

    def _galon(self, sx, sy, grado, z):
        """Galones dorados del grado (centrados en sx, con la base en sy)."""
        t = self.efx.t_galones[max(1, min(3, grado)) - 1]
        ancho = 8 * z
        alto = ancho * t.height / t.width
        self.lz.dibujar(t, sx - ancho / 2, sy - alto, ancho, alto, color=(250, 206, 72))

    def _dibujar_galones(self, cam):
        """Los veteranos llevan sus galones a la vista de los dos bandos, sobre la barra de vida."""
        est = self.est
        z = cam.zoom
        rm = cam.rect_mapa().inflate(64, 64)
        for e in est.ents.values():
            if e.tipo is None or e.fantasma or not e.es_unidad or not rm.collidepoint(e.x, e.y):
                continue
            ex = e.ex if isinstance(e.ex, dict) else None
            if not ex or not ex.get("v"):
                continue
            if not est.aliado(e.dueno) and not est.visible_px(e.x, e.y):
                continue
            w, h, fx, fy = tam_sprite(e.tipo)
            if e.tipo.capa == 1:
                sx, sy = cam.a_pantalla(e.x, e.y - h / 2 - 6)
            else:
                sx, sy = cam.a_pantalla(e.x, e.y - (fy - 2) - 6)
            self._galon(sx, sy, ex["v"], z)

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
            ex = e.ex if isinstance(e.ex, dict) else {}
            if "vm" in ex:
                vmax = ex["vm"]                 # veterano: su vida máxima viaja con él
            elif e.dueno == est.yo:
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
