"""Panel de mando de la batalla: barra superior, minimapa, selección, tarjeta
de órdenes, mensajes y chat."""

import time

import pygame

from ...red import instantanea as I
from .. import fuentes
from ..graficos import iconos
from ..graficos import paleta as P
from ..graficos.minimapa import superficie_mapa
from ..graficos.paleta import color_jugador
from ..juego.tarjeta import COLUMNAS, FILAS

ALTO_SUP = 30
ALTO_INF = 178
LADO_MINI = 164
BTN_W, BTN_H, BTN_SEP = 60, 48, 4


class HUD:
    def __init__(self, escena):
        self.esc = escena
        self.lz = escena.lz
        lz = self.lz
        est = escena.est
        self.rect_sup = pygame.Rect(0, 0, lz.W, ALTO_SUP)
        self.rect_inf = pygame.Rect(0, lz.H - ALTO_INF, lz.W, ALTO_INF)
        m = est.datos_mapa
        esc = LADO_MINI / max(m.ancho, m.alto)
        mw, mh = int(m.ancho * esc), int(m.alto * esc)
        self.rect_mini = pygame.Rect(10 + (LADO_MINI - mw) // 2, self.rect_inf.y + 8 + (LADO_MINI - mh) // 2, mw, mh)
        ancho_tarjeta = COLUMNAS * BTN_W + (COLUMNAS - 1) * BTN_SEP
        alto_tarjeta = FILAS * BTN_H + (FILAS - 1) * BTN_SEP
        self.rect_tarjeta = pygame.Rect(lz.W - ancho_tarjeta - 12, self.rect_inf.y + (ALTO_INF - alto_tarjeta) // 2 + 2,
                                        ancho_tarjeta, alto_tarjeta)
        self.rect_sel = pygame.Rect(LADO_MINI + 26, self.rect_inf.y + 10,
                                    self.rect_tarjeta.x - LADO_MINI - 42, ALTO_INF - 20)
        self.tex_mini = lz.textura(("mini", m.id), lambda: superficie_mapa(m, 1, recursos=False, inicios=False))
        self.t_sal = lz.textura(("ico", "salitre"), lambda: iconos.recurso("salitre"))
        self.t_agua = lz.textura(("ico", "agua"), lambda: iconos.recurso("agua"))
        self.t_pob = lz.textura(("ico", "pob"), lambda: iconos.recurso("pob"))
        self.mensajes = []
        self.pings = []
        self.boton_menu = pygame.Rect(6, 3, 96, 24)

    # ------------------------------------------------------------------
    def mensaje(self, texto, color=P.CREMA, segundos=7.0):
        self.mensajes.append((texto, color, time.monotonic() + segundos))
        if len(self.mensajes) > 7:
            self.mensajes.pop(0)

    def ping(self, x, y, color=(240, 60, 40), segundos=3.0):
        self.pings.append((x, y, color, time.monotonic() + segundos))

    def contiene(self, pos):
        return (self.rect_sup.collidepoint(pos) or self.rect_inf.collidepoint(pos))

    # ------------------------------------------------------------------
    def dibujar(self):
        self._barra_superior()
        self._panel_inferior()
        self._minimapa()
        self._seleccion()
        self._tarjeta()
        self._mensajes()

    def _barra_superior(self):
        lz = self.lz
        est = self.esc.est
        r = self.rect_sup
        self.esc.ui.estilo.panel(r, "madera", borde=False)
        lz.linea((0, r.bottom - 1), (r.w, r.bottom - 1), P.BRONCE)
        encima = self.boton_menu.collidepoint(self.esc.ui.raton)
        self.esc.ui.estilo.boton(self.boton_menu, "Menú (F10)", "encima" if encima else "normal", fuentes.negrita(14),
                                 "madera")
        segundos = est.tick // 16
        reloj = f"{segundos // 3600:d}:{segundos // 60 % 60:02d}:{segundos % 60:02d}" if segundos >= 3600 \
            else f"{segundos // 60:02d}:{segundos % 60:02d}"
        f = fuentes.negrita(17)
        lz.texto(reloj, r.centerx, 5, f, P.CREMA, "centro")
        if est.espectador:
            x = r.right - 10
            for i, j in enumerate(est.jugadores):
                if est.todos and i < len(est.todos):
                    d = est.todos[i]
                    txt = f"{j['nombre']}: {d['s']} / {d['a']} / {d['p']}-{d['pm']}"
                    w, _ = lz.medir(txt, fuentes.cuerpo(14))
                    x -= w + 18
                    lz.rect((x - 12, 10, 8, 8), color_jugador(j["color"]))
                    lz.texto(txt, x, 6, fuentes.cuerpo(14), P.CREMA)
            return
        s, a = est.recursos
        pu, pm = est.pob
        x = r.right - 380
        for tex, valor, col in ((self.t_sal, f"{s}", P.CREMA), (self.t_agua, f"{a}", P.CREMA),
                                (self.t_pob, f"{pu}/{pm}", (240, 110, 90) if pu >= pm and pm < 200 else P.CREMA)):
            lz.dibujar(tex, x, 6)
            lz.texto(valor, x + 24, 5, f, col)
            x += 120
        lat = self.esc.app.red.latencia if self.esc.app.red else None
        if lat is not None and not self.esc.local:
            lz.texto(f"{int(lat * 1000)} ms", r.right - 380 - 70, 7, fuentes.cuerpo(14), (200, 190, 170))

    def _panel_inferior(self):
        lz = self.lz
        r = self.rect_inf
        self.esc.ui.estilo.panel(r, "madera")
        lz.rect((self.rect_sel.x - 4, self.rect_sel.y - 4, self.rect_sel.w + 8, self.rect_sel.h + 8), (26, 16, 10))
        lz.dibujar(self.esc.ui.estilo.t_perg, self.rect_sel.x, self.rect_sel.y, self.rect_sel.w, self.rect_sel.h)

    def _minimapa(self):
        lz = self.lz
        esc = self.esc
        est = esc.est
        rm = self.rect_mini
        lz.rect(rm.inflate(6, 6), (20, 12, 6))
        lz.dibujar(self.tex_mini, rm.x, rm.y, rm.w, rm.h)
        sx = rm.w / (est.mapa.w * 32)
        sy = rm.h / (est.mapa.h * 32)
        for e in est.ents.values():
            if e.es_recurso:
                if not est.explorado_px(e.x, e.y):
                    continue
                c = (250, 250, 250) if e.t == I.TIPO_SALITRE else (60, 150, 230)
                lz.rect((rm.x + e.x * sx - 1, rm.y + e.y * sy - 1, 2, 2), c)
                continue
            if e.tipo is None:
                continue
            if not e.fantasma and not est.aliado(e.dueno) and not est.visible_px(e.x, e.y):
                continue
            col = color_jugador(est.jugadores[e.dueno]["color"]) if e.dueno >= 0 else (200, 200, 200)
            if e.es_edificio:
                w = max(3, e.tipo.ancho * 32 * sx)
                h = max(3, e.tipo.alto * 32 * sy)
                lz.rect((rm.x + e.x * sx - w / 2, rm.y + e.y * sy - h / 2, w, h), col)
            else:
                lz.rect((rm.x + e.x * sx - 1, rm.y + e.y * sy - 1, 2, 2), col)
        vista = esc.vista
        if vista.niebla_tex is not None and not est.espectador:
            lz.dibujar(vista.niebla_tex, rm.x, rm.y, rm.w, rm.h)
        ahora = time.monotonic()
        self.pings = [p for p in self.pings if p[3] > ahora]
        for (x, y, col, hasta) in self.pings:
            f = (hasta - ahora) % 1.0
            rad = 4 + 10 * f
            cx, cy = rm.x + x * sx, rm.y + y * sy
            lz.marco((cx - rad, cy - rad, rad * 2, rad * 2), col, 1)
        cam = esc.cam
        cr = cam.rect_mapa()
        lz.marco((rm.x + cr.x * sx, rm.y + cr.y * sy, cr.w * sx, cr.h * sy), (250, 250, 250), 1)
        lz.marco(rm.inflate(2, 2), P.BRONCE, 1)

    def mini_a_mapa(self, pos):
        rm = self.rect_mini
        est = self.esc.est
        x = (pos[0] - rm.x) / rm.w * est.mapa.w * 32
        y = (pos[1] - rm.y) / rm.h * est.mapa.h * 32
        return max(0, min(est.mapa.w * 32 - 1, x)), max(0, min(est.mapa.h * 32 - 1, y))

    # ------------------------------------------------------------------
    def _retrato(self, e, x, y, tam):
        lz = self.lz
        est = self.esc.est
        vista = self.esc.vista
        tipo = e.tipo
        if tipo is None:
            return
        col = color_jugador(est.jugadores[e.dueno]["color"]) if e.dueno >= 0 else (200, 200, 200)
        fac = est.faccion(e.dueno)
        if tipo.es_edificio:
            tex = vista.edificios.textura(tipo, fac.id, col)
        else:
            tex = vista.sprites.textura(tipo, fac, col, "lado", 0)
        esc = min(tam / tex.width, tam / tex.height)
        w, h = tex.width * esc, tex.height * esc
        lz.dibujar(tex, x + (tam - w) / 2, y + (tam - h) / 2, w, h)

    def _seleccion(self):
        lz = self.lz
        esc = self.esc
        est = esc.est
        r = self.rect_sel
        sel = [est.ents[i] for i in esc.seleccion if i in est.ents]
        if not sel:
            lz.texto(est.facciones[est.yo].ejercito if not est.espectador else "Espectador", r.x + 12, r.y + 8,
                     fuentes.titulo(22), P.TINTA)
            ayuda = ("Clic izquierdo: seleccionar · Arrastrar: recuadro · Clic derecho: mover/atacar/recolectar · "
                     "Ctrl+número: grupo · F1: trabajador ocioso · Espacio: último aviso")
            lz.parrafo(ayuda, r.x + 12, r.y + 42, r.w - 24, fuentes.cuerpo(15), P.TINTA_SUAVE)
            return
        if len(sel) == 1:
            self._una(sel[0], r)
            return
        tam = 40
        cols = max(1, (r.w - 8) // (tam + 4))
        for k, e in enumerate(sel[: cols * 3]):
            x = r.x + 6 + (k % cols) * (tam + 4)
            y = r.y + 6 + (k // cols) * (tam + 4)
            caja = pygame.Rect(x, y, tam, tam)
            encima = caja.collidepoint(esc.ui.raton)
            lz.rect(caja, (226, 210, 176) if encima else (240, 230, 206))
            self._retrato(e, x + 2, y + 2, tam - 4)
            vmax = est.stats_de(e.tipo).vida if e.dueno == est.yo else e.tipo.vida
            frac = max(0.0, min(1.0, e.vida / max(1, vmax)))
            lz.rect((x + 2, y + tam - 5, (tam - 4) * frac, 3),
                    (70, 200, 60) if frac > 0.6 else ((230, 200, 40) if frac > 0.3 else (220, 50, 40)))
            lz.marco(caja, (120, 90, 60), 1)
            if encima:
                esc.ui.poner_tooltip(est.cat.nombre(est.facciones[e.dueno].id, e.tipo.id),
                                     "Clic: seleccionarla sola · Mayús+clic: quitarla")
        if len(sel) > cols * 3:
            lz.texto(f"+{len(sel) - cols * 3}", r.right - 40, r.bottom - 24, fuentes.negrita(16), P.TINTA)

    def _una(self, e, r):
        lz = self.lz
        est = self.esc.est
        cat = est.cat
        if e.es_recurso:
            nombre = "Yacimiento de salitre (caliche)" if e.t == I.TIPO_SALITRE else "Pozo de agua"
            lz.texto(nombre, r.x + 12, r.y + 8, fuentes.titulo(22), P.TINTA)
            lz.texto(f"Queda: {e.vida}", r.x + 12, r.y + 42, fuentes.negrita(17), P.TINTA)
            txt = ("El caliche de la pampa se procesaba en las oficinas salitreras para obtener nitrato de sodio, "
                   "fertilizante y materia prima de la pólvora.") if e.t == I.TIPO_SALITRE else \
                ("Construya un molino de agua sobre el pozo para que los trabajadores acarreen agua.")
            lz.parrafo(txt, r.x + 12, r.y + 70, r.w - 24, fuentes.cursiva(15), P.TINTA_SUAVE)
            return
        tipo = e.tipo
        fac = est.faccion(e.dueno)
        self._retrato(e, r.x + 8, r.y + 8, 92)
        x = r.x + 110
        nombre = cat.nombre(fac.id, tipo.id)
        lz.texto(nombre, x, r.y + 4, fuentes.titulo(20), P.TINTA)
        dueno = est.jugadores[e.dueno]["nombre"] if e.dueno >= 0 else ""
        lz.texto(dueno, r.right - 10, r.y + 8, fuentes.cursiva(15), color_jugador(est.jugadores[e.dueno]["color"]), "der")
        st = est.stats_de(tipo) if e.dueno == est.yo else None
        vmax = st.vida if st else tipo.vida
        y = r.y + 34
        frac = max(0.0, min(1.0, e.vida / max(1, vmax)))
        lz.rect((x, y, 200, 12), (60, 40, 26))
        lz.rect((x + 1, y + 1, 198 * frac, 10),
                (70, 170, 60) if frac > 0.6 else ((210, 180, 40) if frac > 0.3 else (200, 50, 40)))
        lz.texto(f"{max(0, e.vida)} / {vmax}", x + 208, y - 3, fuentes.negrita(15), P.TINTA)
        y += 20
        ex = e.ex if isinstance(e.ex, dict) else {}
        if e.es_edificio and e.fl & I.F_OBRA:
            prog = ex.get("o", 0)
            lz.texto(f"En construcción: {prog} %", x, y, fuentes.negrita(16), P.TINTA)
            lz.rect((x, y + 22, 300, 10), (60, 40, 26))
            lz.rect((x + 1, y + 23, 298 * prog / 100, 8), (190, 150, 70))
            return
        if tipo.es_edificio and ex.get("q"):
            self._cola(e, ex["q"], x, y, r)
            return
        lineas = []
        arma = tipo.arma
        if arma is not None:
            danio = st.danio if st else arma.danio
            alc = (st.alcance if st else arma.alcance) / 512
            lineas.append(f"Daño {danio} ({cat.nombres_ataque.get(arma.tipo, arma.tipo)})  ·  Alcance {alc:.1f}")
        arm = st.armadura if st else tipo.armadura
        lineas.append(f"Armadura {arm} ({cat.nombres_armadura.get(tipo.clase, tipo.clase)})")
        if not tipo.es_edificio:
            vel = (st.velocidad if st else tipo.velocidad) * 16 / 512
            lineas.append(f"Velocidad {vel:.1f}  ·  Población {tipo.poblacion}")
        if "k" in ex:
            lineas.append(f"Enemigos abatidos: {ex['k']}")
        if "en" in ex:
            lineas.append(f"Energía: {ex['en']}")
        if "c" in ex or "g" in ex:
            carga = ex.get("c") or ex.get("g") or []
            lineas.append(f"A bordo: {len(carga)}")
        if tipo.es_edificio and tipo.poblacion:
            lineas.append(f"Aloja {tipo.poblacion} de población")
        f = fuentes.cuerpo(16)
        for i, ln in enumerate(lineas[:5]):
            lz.texto(ln, x, y + i * 19, f, P.TINTA)
        if getattr(tipo, "heroe", False) and tipo.aura_efectos:
            lz.parrafo(tipo.descripcion, r.x + 8, r.bottom - 38, r.w - 16, fuentes.cursiva(14), P.TINTA_SUAVE,
                       max_lineas=2)

    def _cola(self, e, cola, x, y, r):
        lz = self.lz
        est = self.esc.est
        cat = est.cat
        fac = est.faccion(e.dueno)
        clase, ident, pct = cola[0]
        nombre = cat.nombre(fac.id, ident) if clase == "u" else cat.mejoras[ident].nombre
        lz.texto(("Formando: " if clase == "u" else "Investigando: ") + nombre, x, y, fuentes.negrita(16), P.TINTA)
        lz.rect((x, y + 22, 300, 10), (60, 40, 26))
        lz.rect((x + 1, y + 23, 298 * pct / 100, 8), (190, 150, 70))
        self.cajas_cola = []
        for k, (cl, idd, _p) in enumerate(cola):
            caja = pygame.Rect(x + k * 46, y + 40, 42, 42)
            self.cajas_cola.append((caja, k))
            lz.rect(caja, (240, 230, 206))
            lz.marco(caja, (120, 90, 60), 1)
            if cl == "u":
                ut = cat.unidades[idd]
                col = color_jugador(est.jugadores[e.dueno]["color"])
                tex = self.esc.vista.sprites.textura(ut, fac, col, "lado", 0)
            else:
                m = cat.mejoras[idd]
                tex = self.lz.textura(("icom", idd), lambda m=m: iconos.icono_mejora(m))
            esc = min(36 / tex.width, 36 / tex.height)
            lz.dibujar(tex, caja.x + (42 - tex.width * esc) / 2, caja.y + (42 - tex.height * esc) / 2,
                       tex.width * esc, tex.height * esc)
            if caja.collidepoint(self.esc.ui.raton):
                self.esc.ui.poner_tooltip("Cancelar", "Clic para cancelar y recuperar los recursos.")

    # ------------------------------------------------------------------
    def rect_boton(self, i):
        c = i % COLUMNAS
        f = i // COLUMNAS
        return pygame.Rect(self.rect_tarjeta.x + c * (BTN_W + BTN_SEP), self.rect_tarjeta.y + f * (BTN_H + BTN_SEP),
                           BTN_W, BTN_H)

    def _icono(self, b):
        lz = self.lz
        est = self.esc.est
        kind, ref = b.icono
        if kind == "orden":
            return lz.textura(("icoo", ref), lambda: iconos.icono_orden(ref))
        if kind == "mejora":
            return lz.textura(("icom", ref.id), lambda: iconos.icono_mejora(ref))
        if kind == "habilidad":
            return lz.textura(("icoh", ref.id), lambda: iconos.icono_habilidad(ref))
        col = color_jugador(est.jugadores[est.yo]["color"])
        fac = est.facciones[est.yo]
        if kind == "unidad":
            return self.esc.vista.sprites.textura(ref, fac, col, "lado", 0)
        if kind == "edificio":
            return self.esc.vista.edificios.textura(ref, fac.id, col)
        return None

    def _tarjeta(self):
        lz = self.lz
        esc = self.esc
        est = esc.est
        lz.rect(self.rect_tarjeta.inflate(8, 8), (26, 16, 10))
        s, a = est.recursos
        for i, b in enumerate(esc.botones):
            r = self.rect_boton(i)
            if b is None:
                lz.rect(r, (60, 42, 30))
                continue
            encima = r.collidepoint(esc.ui.raton)
            activo = b.activo
            alcanza = b.costo is None or (s >= b.costo[0] and a >= b.costo[1])
            base = (236, 222, 190) if activo else (170, 160, 142)
            if encima and activo:
                base = (250, 238, 206)
            if esc.modo is not None and esc.modo[1] == b.clave:
                base = (250, 210, 140)
            lz.rect(r, (40, 26, 16))
            lz.rect(r.inflate(-2, -2), base)
            tex = self._icono(b)
            if tex is not None:
                esc_ = min((r.w - 8) / tex.width, (r.h - 8) / tex.height)
                w, h = tex.width * esc_, tex.height * esc_
                lz.dibujar(tex, r.x + (r.w - w) / 2, r.y + (r.h - h) / 2, w, h, alpha=255 if activo else 120)
            if b.atajo:
                lz.texto(b.atajo if b.atajo != "ESC" else "Esc", r.x + 3, r.y + 1, fuentes.negrita(13),
                         (150, 32, 28) if activo else (110, 100, 90))
            if b.enfriando > 0:
                lz.rect(r.inflate(-2, -2), (0, 0, 0), 120)
                lz.texto(f"{b.enfriando // 16 + 1}", r.centerx, r.centery - 9, fuentes.negrita(16), P.CREMA, "centro")
            if b.costo is not None and not alcanza:
                lz.marco(r.inflate(-2, -2), (200, 40, 30), 2)
            if encima:
                self._tooltip_boton(b, alcanza)

    def _tooltip_boton(self, b, alcanza):
        extra = None
        if b.costo is not None:
            col = P.CREMA if alcanza else (240, 110, 90)
            extra = [(f"Salitre {b.costo[0]}", col), (f"Agua {b.costo[1]}", col)]
        texto = b.descripcion
        if not b.activo and b.falta:
            texto = f"Requiere: {b.falta}. " + texto if b.falta != "en curso" and "campaña" not in b.falta else \
                b.falta.capitalize() + ". " + texto
        atajo = f" ({b.atajo})" if b.atajo else ""
        self.esc.ui.poner_tooltip(b.texto + atajo, texto, extra)

    def boton_en(self, pos):
        if not self.rect_tarjeta.inflate(4, 4).collidepoint(pos):
            return None
        for i, b in enumerate(self.esc.botones):
            if b is not None and self.rect_boton(i).collidepoint(pos):
                return b
        return None

    def caja_seleccion_en(self, pos):
        r = self.rect_sel
        if not r.collidepoint(pos):
            return None
        sel = [i for i in self.esc.seleccion if i in self.esc.est.ents]
        if len(sel) == 1:
            for caja, k in getattr(self, "cajas_cola", []):
                if caja.collidepoint(pos):
                    return ("cola", k)
            return None
        tam = 40
        cols = max(1, (r.w - 8) // (tam + 4))
        for k, i in enumerate(sel[: cols * 3]):
            x = r.x + 6 + (k % cols) * (tam + 4)
            y = r.y + 6 + (k // cols) * (tam + 4)
            if pygame.Rect(x, y, tam, tam).collidepoint(pos):
                return ("unidad", i)
        return None

    def _mensajes(self):
        lz = self.lz
        ahora = time.monotonic()
        self.mensajes = [m for m in self.mensajes if m[2] > ahora]
        y = self.rect_inf.y - 30
        f = fuentes.negrita(16)
        for texto, color, hasta in reversed(self.mensajes):
            a = 255 if hasta - ahora > 1 else int(255 * (hasta - ahora))
            lz.texto(texto, 12, y, f, color, sombra=(0, 0, 0), alpha=max(0, a))
            y -= 22
        chat = self.esc.chat
        if chat is not None:
            r = pygame.Rect(10, self.rect_inf.y - 30 - 8 * 22 - 40, 520, 30)
            lz.rect(r, (20, 12, 6), 220)
            lz.marco(r, P.BRONCE, 1)
            prefijo = "[Equipo] " if self.esc.chat_equipo else "[Todos] "
            cursor = "|" if int(ahora * 2) % 2 == 0 else ""
            lz.texto(prefijo + chat + cursor, r.x + 8, r.y + 5, fuentes.cuerpo(16), P.CREMA)
