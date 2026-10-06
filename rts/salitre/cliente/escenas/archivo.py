"""Archivo histórico: naciones, héroes, unidades, edificios, campos de batalla
y cronología de la guerra. Todo sale del mismo catálogo que usa el juego, de
modo que las cifras que se leen aquí son las que valen en el combate."""

import pygame

from ...contenido import mapas as mod_mapas
from ...sim.constantes import TICKS, TILE
from .. import fuentes
from ..graficos import paleta as P
from ..graficos.banderas import superficie_bandera
from ..graficos.edificios import Edificios
from ..graficos.minimapa import superficie_mapa
from ..graficos.sprites import Sprites
from ..ui.widgets import Boton, Lista
from .base import Escena, FondoMenu

NACIONES = ["chile", "peru", "bolivia", "argentina"]
COLOR_NACION = {"chile": 0, "peru": 3, "bolivia": 2, "argentina": 4}

CRONOLOGIA = [
    ("14 feb 1879", "Tropas chilenas ocupan Antofagasta, tras el impuesto boliviano de diez centavos al quintal de "
                    "salitre exportado y el remate de la Compañía de Salitres."),
    ("1 mar 1879", "Bolivia declara el estado de guerra con Chile."),
    ("23 mar 1879", "Combate de Calama (puente del Topáter): cae Eduardo Abaroa."),
    ("5 abr 1879", "Chile declara la guerra al Perú y a Bolivia, aliados por el tratado secreto de 1873."),
    ("21 may 1879", "Combate naval de Iquique: Arturo Prat muere al abordar el Huáscar y la Esmeralda se hunde. "
                    "En Punta Gruesa la fragata peruana Independencia encalla persiguiendo a la Covadonga."),
    ("8 oct 1879", "Combate de Angamos: el Huáscar es capturado y muere el almirante Miguel Grau. Chile domina "
                   "el mar."),
    ("2 nov 1879", "Desembarco de Pisagua: comienza la campaña terrestre de Tarapacá."),
    ("19 nov 1879", "Batalla de San Francisco (Dolores): los aliados no logran tomar el cerro y se retiran."),
    ("27 nov 1879", "Batalla de Tarapacá: victoria peruana; muere el comandante Eleuterio Ramírez. Aun así, el "
                    "Perú pierde la provincia."),
    ("22 mar 1880", "Batalla de Los Ángeles (Moquegua)."),
    ("26 may 1880", "Batalla del Alto de la Alianza (Tacna): Baquedano derrota al ejército aliado de Campero. "
                    "Bolivia se retira de la guerra."),
    ("7 jun 1880", "Asalto y toma del Morro de Arica: mueren Bolognesi, Ugarte y More; cae el comandante "
                   "San Martín Penrose."),
    ("13 ene 1881", "Batalla de Chorrillos (San Juan)."),
    ("15 ene 1881", "Batalla de Miraflores. El 17 de enero el ejército chileno ocupa Lima."),
    ("23 jul 1881", "Tratado de límites entre Chile y la Argentina: la cordillera de los Andes como frontera."),
    ("9 jul 1882", "Combate de La Concepción: los 77 hombres de la 4ª compañía del Chacabuco mueren en la sierra "
                   "frente a las fuerzas de Cáceres."),
    ("10 jul 1883", "Batalla de Huamachuco: termina la campaña de la Breña."),
    ("20 oct 1883", "Tratado de Ancón entre Chile y el Perú: Tarapacá pasa a Chile; Tacna y Arica quedan bajo su "
                    "administración por diez años."),
    ("4 abr 1884", "Pacto de Tregua entre Chile y Bolivia: Bolivia pierde su litoral."),
]

PESTANAS = [("naciones", "Naciones"), ("heroes", "Héroes"), ("unidades", "Unidades"), ("edificios", "Edificios"),
            ("mapas", "Batallas"), ("cronologia", "Cronología")]


def casillas(sub):
    return sub / TILE


class Archivo(Escena):
    def __init__(self, app):
        super().__init__(app)
        lz = self.lz
        self.cat = app.cat
        self.fondo = FondoMenu(lz)
        self.sprites = Sprites(lz, self.cat)
        self.edificios = Edificios(lz, self.cat)
        self.p_izq = pygame.Rect(24, 16, 360, lz.H - 32)
        self.p_der = pygame.Rect(396, 16, lz.W - 420, lz.H - 32)
        self.nacion = app.config["faccion"] if app.config["faccion"] in NACIONES else "chile"
        self.pestana = "naciones"
        self.botones = []
        for i, (clave, texto) in enumerate(PESTANAS):
            b = Boton((self.p_izq.x + 14 + (i % 3) * 112, self.p_izq.y + 14 + (i // 3) * 40, 106, 34), texto,
                      lambda c=clave: self.elegir_pestana(c), fuente=fuentes.negrita(16))
            b.clave = clave
            self.botones.append(b)
        self.botones_nacion = []
        for i, n in enumerate(NACIONES):
            b = Boton((self.p_izq.x + 14 + i * 84, self.p_izq.y + 104, 78, 40), "", lambda n=n: self.elegir_nacion(n))
            b.nacion = n
            self.botones_nacion.append(b)
        self.lista = Lista((self.p_izq.x + 14, self.p_izq.y + 156, self.p_izq.w - 28, self.p_izq.h - 230), [],
                           self.elegir, alto_fila=28)
        self.widgets += self.botones + self.botones_nacion + [self.lista]
        self.widgets.append(Boton((self.p_izq.x + 14, self.p_izq.bottom - 58, self.p_izq.w - 28, 42), "Volver",
                                  self.volver, "madera"))
        self.tex_banderas = {n: lz.textura(("bandera", n, 64), lambda n=n: superficie_bandera(n, 64, 40))
                             for n in NACIONES}
        self.mapas = {}
        for ident, ruta in mod_mapas.listar().items():
            try:
                self.mapas[ident] = mod_mapas.cargar(ruta)
            except mod_mapas.MapaError:
                pass
        self.sel = None
        self.desplaz = 0
        self.elegir_pestana("naciones")

    # ------------------------------------------------------------------
    def elegir_pestana(self, clave):
        self.pestana = clave
        con_nacion = clave in ("heroes", "unidades")
        for b in self.botones_nacion:
            b.visible = con_nacion
        self.lista.rect.y = self.p_izq.y + (156 if con_nacion else 104)
        self.lista.rect.h = self.p_izq.h - (230 if con_nacion else 178)
        self._llenar()

    def elegir_nacion(self, n):
        self.nacion = n
        self._llenar()

    def _llenar(self):
        cat = self.cat
        items = []
        if self.pestana == "naciones":
            items = [(n, cat.facciones[n].ejercito) for n in NACIONES]
        elif self.pestana == "heroes":
            f = cat.facciones[self.nacion]
            items = [(h, cat.unidades[h].nombre) for h in f.heroes]
        elif self.pestana == "unidades":
            f = cat.facciones[self.nacion]
            items = [(u, cat.nombre(f.id, u)) for u in f.unidades if not cat.unidades[u].heroe]
        elif self.pestana == "edificios":
            items = [(e, te.nombre + (f"  ({cat.facciones[te.faccion].nombre})" if te.faccion else ""))
                     for e, te in cat.edificios.items()]
        elif self.pestana == "mapas":
            items = [(k, d.nombre) for k, d in self.mapas.items()]
        elif self.pestana == "cronologia":
            items = [(i, fecha) for i, (fecha, _t) in enumerate(CRONOLOGIA)]
        self.lista.poner(items)
        self.lista.desplaz = 0
        if self.pestana == "naciones":
            self.lista.sel = self.nacion
        elif items:
            self.lista.sel = items[0][0]
        self.elegir(self.lista.sel)

    def elegir(self, clave):
        self.sel = clave
        self.desplaz = 0
        if self.pestana == "naciones" and clave in NACIONES:
            self.nacion = clave

    def volver(self):
        from .portada import Portada
        self.app.cambiar(Portada(self.app))

    def manejar(self, ev):
        if ev.type == pygame.KEYDOWN and ev.key == pygame.K_ESCAPE:
            self.volver()
            return True
        if ev.type == pygame.KEYDOWN and ev.key in (pygame.K_UP, pygame.K_DOWN) and self.lista.items:
            claves = [it[0] for it in self.lista.items]
            k = claves.index(self.sel) if self.sel in claves else 0
            k = max(0, min(len(claves) - 1, k + (1 if ev.key == pygame.K_DOWN else -1)))
            self.lista.sel = claves[k]
            self.elegir(claves[k])
            if k < self.lista.desplaz:
                self.lista.desplaz = k
            elif k >= self.lista.desplaz + self.lista.filas():
                self.lista.desplaz = k - self.lista.filas() + 1
            return True
        return super().manejar(ev)

    # ------------------------------------------------------------------
    def dibujar(self):
        lz = self.lz
        self.fondo.dibujar(self.t, titulo=False)
        est = self.ui.estilo
        est.panel(self.p_izq)
        est.panel(self.p_der)
        for b in self.botones:
            if b.clave == self.pestana:
                lz.marco(b.rect.inflate(4, 4), P.ROJO_SELLO, 2)
        self.dibujar_widgets()
        for b in self.botones_nacion:
            if not b.visible:
                continue
            r = b.rect
            lz.dibujar(self.tex_banderas[b.nacion], r.x + 9, r.y + 6, 60, 28)
            if b.nacion == self.nacion:
                lz.marco(r.inflate(4, 4), P.ROJO_SELLO, 2)
        # la ficha se dibuja recortada al panel, con coordenadas relativas a él
        vp = self.p_der.inflate(-8, -8)
        self.area = pygame.Rect(0, 0, vp.w, vp.h)
        lz.recortar(vp)
        if self.sel is not None:
            f = getattr(self, "_ficha_" + self.pestana)
            f(24, 18, vp.w - 48)
        lz.recortar(None)

    # -- fichas -----------------------------------------------------------
    def _titulo(self, texto, sub, x, y, reservado=0):
        """Título y subtítulo; «reservado» acorta la línea para no cruzar la imagen de la derecha."""
        lz = self.lz
        lz.texto(texto, x, y, fuentes.titulo(34), P.TINTA)
        if sub:
            lz.texto(sub, x, y + 44, fuentes.cursiva(18), P.TINTA_SUAVE)
        lz.linea((x, y + 72), (self.area.right - 24 - reservado, y + 72), (120, 90, 60))
        return y + 86

    def _texto(self, texto, x, y, w, fuente=None, color=P.TINTA, max_lineas=None):
        if not texto:
            return y
        return y + self.lz.parrafo(texto, x, y, w, fuente or fuentes.cuerpo(17), color, max_lineas=max_lineas) + 10

    def _ficha_naciones(self, x, y, w):
        lz = self.lz
        f = self.cat.facciones[self.sel]
        lz.dibujar(lz.textura(("bandera", f.id, 160), lambda: superficie_bandera(f.id, 160, 100)),
                   x + w - 160, y, 160, 100)
        y = self._titulo(f.ejercito, f.nombre, x, y, 176)
        y = self._texto(f.descripcion, x, y, w - 180, fuentes.negrita(18))
        y = self._texto(f.historia, x, y + 8, w, fuentes.cursiva(18), P.TINTA_SUAVE)
        y += 6
        for nombre, desc, _efs in f.bonificaciones:
            lz.texto(nombre, x, y, fuentes.negrita(18), P.ROJO_SELLO)
            y = self._texto(desc, x + 16, y + 24, w - 16)
        lz.texto("Unidades propias", x, y + 4, fuentes.negrita(18), P.TINTA)
        y += 30
        propias = [u for u in f.unidades if self.cat.unidades[u].faccion == f.id]
        normales = [self.cat.nombre(f.id, u) for u in propias if not self.cat.unidades[u].heroe]
        heroes = [self.cat.unidades[u].nombre for u in propias if self.cat.unidades[u].heroe]
        y = self._texto("Especiales: " + (", ".join(normales) or "—"), x + 16, y, w - 16)
        y = self._texto("Héroes: " + (", ".join(heroes) or "—"), x + 16, y, w - 16)
        y += 4
        self._desfile(f, propias + ["infante", "granadero", "canon_campana"], x, y, w)

    def _desfile(self, f, unidades, x, y, w):
        """Fila de figuras con el uniforme de la nación."""
        lz = self.lz
        col = P.color_jugador(COLOR_NACION.get(f.id, 0))
        px = x
        for u in unidades:
            tp = self.cat.unidades.get(u)
            if tp is None or tp.capa_nombre == "agua":
                continue
            tex = self.sprites.textura(tp, f, col, "lado", 0)
            esc = 64 / max(tex.width, tex.height) * (1.0 if tex.height > 40 else 0.8)
            ww, hh = tex.width * esc * 1.4, tex.height * esc * 1.4
            if px + ww > x + w:
                break
            lz.dibujar(tex, px, y + 90 - hh, ww, hh)
            px += ww + 10

    def _cifras(self, filas, x, y, w):
        """Tabla de cifras en dos columnas."""
        lz = self.lz
        fb = fuentes.negrita(16)
        fc = fuentes.cuerpo(16)
        mitad = (len(filas) + 1) // 2
        for i, (nombre, valor) in enumerate(filas):
            cx = x + (0 if i < mitad else w // 2)
            cy = y + (i % mitad) * 24
            lz.texto(nombre, cx, cy, fb, P.TINTA_SUAVE)
            lz.texto(str(valor), cx + 150, cy, fc, P.TINTA)
        return y + mitad * 24 + 10

    def _ficha_unidad(self, tp, nombre, x, y, w):
        lz = self.lz
        cat = self.cat
        y_ini = y
        f = cat.facciones[tp.faccion] if tp.faccion else cat.facciones[self.nacion]
        col = P.color_jugador(COLOR_NACION.get(f.id, 0))
        # retrato grande
        tex = self.sprites.textura(tp, f, col, "lado", 0)
        caja = 150
        esc = min(caja / tex.width, caja / tex.height)
        lz.rect((x + w - caja - 10, y - 4, caja + 10, caja + 10), (226, 210, 176))
        lz.dibujar(tex, x + w - caja - 5 + (caja - tex.width * esc) / 2, y + 1 + (caja - tex.height * esc) / 2,
                   tex.width * esc, tex.height * esc)
        clases = {"infanteria": "Infantería", "caballeria": "Caballería", "artilleria": "Artillería",
                  "apoyo": "Apoyo", "trabajador": "Trabajador", "heroe": "Héroe", "naval": "Marina"}
        sub = clases.get(tp.categoria, tp.categoria)
        if tp.faccion:
            sub += f" · solo {cat.facciones[tp.faccion].nombre}"
        y = self._titulo(nombre, sub, x, y, caja + 20)
        y = self._texto(tp.descripcion, x, y, w - 180, fuentes.negrita(17))
        y = max(y, y_ini + 170)
        filas = [("Costo", f"{tp.costo[0]} salitre" + (f", {tp.costo[1]} agua" if tp.costo[1] else "")),
                 ("Población", tp.poblacion), ("Tiempo", f"{tp.tiempo / TICKS:.0f} s"),
                 ("Vida", tp.vida), ("Armadura", f"{tp.armadura} ({cat.nombres_armadura.get(tp.clase, tp.clase)})"),
                 ("Velocidad", f"{tp.velocidad * TICKS / TILE:.1f} casillas/s"), ("Visión", f"{tp.vision:g}")]
        if tp.arma is not None:
            a = tp.arma
            filas += [("Daño", f"{a.danio} ({cat.nombres_ataque.get(a.tipo, a.tipo)})"),
                      ("Alcance", f"{casillas(a.alcance):.1f}" + (f" (mín. {casillas(a.alcance_min):.1f})"
                                                                  if a.alcance_min else "")),
                      ("Cadencia", f"{a.enfriamiento / TICKS:.1f} s")]
        if tp.capacidad:
            filas.append(("Transporta", f"{tp.capacidad} plazas"))
        if tp.produce_en:
            te = cat.edificios.get(tp.produce_en)
            filas.append(("Se forma en", te.nombre if te else tp.produce_en))
        if tp.requisitos:
            filas.append(("Requiere", ", ".join(cat.edificios[r].nombre if r in cat.edificios else r
                                                for r in tp.requisitos)))
        y = self._cifras(filas, x, y, w)
        if tp.aura_efectos:
            lz.texto(f"Aura de mando (radio {casillas(tp.aura_radio):.0f} casillas)", x, y, fuentes.negrita(17),
                     P.ROJO_SELLO)
            y = self._texto(", ".join(describir_efecto(e) for e in tp.aura_efectos), x + 16, y + 24, w - 16)
        for hid in tp.habilidades:
            h = cat.habilidades.get(hid)
            if h is None:
                continue
            lz.texto(h.nombre + (f" ({h.atajo})" if h.atajo else ""), x, y, fuentes.negrita(17), P.TINTA)
            y = self._texto(h.descripcion, x + 16, y + 24, w - 16, fuentes.cuerpo(16))
        y = self._texto(tp.historia, x, y + 4, w, fuentes.cursiva(17), P.TINTA_SUAVE)

    def _ficha_heroes(self, x, y, w):
        tp = self.cat.unidades[self.sel]
        self._ficha_unidad(tp, tp.nombre, x, y, w)

    def _ficha_unidades(self, x, y, w):
        tp = self.cat.unidades[self.sel]
        self._ficha_unidad(tp, self.cat.nombre(self.nacion, tp.id), x, y, w)

    def _ficha_edificios(self, x, y, w):
        lz = self.lz
        cat = self.cat
        y_ini = y
        te = cat.edificios[self.sel]
        nacion = te.faccion or self.nacion
        col = P.color_jugador(COLOR_NACION.get(nacion, 0))
        tex = self.edificios.textura(te, nacion, col)
        caja = 170
        esc = min(caja / tex.width, caja / tex.height)
        lz.dibujar(tex, x + w - caja + (caja - tex.width * esc) / 2, y + (caja - tex.height * esc) / 2,
                   tex.width * esc, tex.height * esc)
        y = self._titulo(te.nombre, f"Edificio de {te.ancho}×{te.alto} casillas", x, y, caja + 10)
        y = self._texto(te.descripcion, x, y, w - 190, fuentes.negrita(17))
        y = max(y, y_ini + 180)
        filas = [("Costo", f"{te.costo[0]} salitre" + (f", {te.costo[1]} agua" if te.costo[1] else "")),
                 ("Tiempo", f"{te.tiempo / TICKS:.0f} s"), ("Vida", te.vida), ("Armadura", te.armadura)]
        if te.poblacion:
            filas.append(("Población", f"+{te.poblacion}"))
        if te.guarnicion:
            filas.append(("Guarnición", f"{te.guarnicion} soldados"))
        if te.arma is not None:
            filas.append(("Daño", f"{te.arma.danio} a {casillas(te.arma.alcance):.0f} casillas"))
        if te.requisitos:
            filas.append(("Requiere", ", ".join(cat.edificios[r].nombre if r in cat.edificios else r
                                                for r in te.requisitos)))
        y = self._cifras(filas, x, y, w)
        if te.produce:
            nombres = [cat.nombre(nacion, u) for u in te.produce if cat.disponible(nacion, u)]
            y = self._texto("Forma: " + ", ".join(nombres), x, y, w)
        if te.investiga:
            nombres = [cat.mejoras[m].nombre for m in te.investiga if m in cat.mejoras]
            y = self._texto("Investiga: " + ", ".join(nombres), x, y, w)
        self._texto(te.historia, x, y + 4, w, fuentes.cursiva(17), P.TINTA_SUAVE)

    def _ficha_mapas(self, x, y, w):
        lz = self.lz
        y_ini = y
        d = self.mapas[self.sel]
        tex = lz.textura(("previa", self.sel), lambda: superficie_mapa(d, 3))
        caja = 260
        esc = min(caja / tex.width, caja / tex.height)
        ww, hh = tex.width * esc, tex.height * esc
        lz.rect((x + w - ww - 3, y - 3, ww + 6, hh + 6), (60, 40, 24))
        lz.dibujar(tex, x + w - ww, y, ww, hh)
        y = self._titulo(d.nombre, f"{d.jugadores} jugadores · {d.ancho}×{d.alto} casillas"
                         + (" · escenario naval" if d.naval else ""), x, y, int(ww) + 16)
        y = self._texto(d.descripcion, x, y, w - 290, fuentes.negrita(17))
        y = max(y, y_ini + 280)
        self._texto(d.historia, x, y, w, fuentes.cursiva(18), P.TINTA_SUAVE)

    def _ficha_cronologia(self, x, y, w):
        lz = self.lz
        y = self._titulo("La Guerra del Pacífico", "1879-1884: cronología esencial", x, y)
        fb = fuentes.negrita(16)
        fc = fuentes.cuerpo(16)
        for i, (fecha, texto) in enumerate(CRONOLOGIA):
            sel = i == self.sel
            alto = lz.parrafo(texto, x + 130, y, w - 130, fc, P.TINTA if sel else P.TINTA_SUAVE)
            if sel:
                lz.rect((x - 10, y - 2, 4, alto + 2), P.ROJO_SELLO)
            lz.texto(fecha, x, y, fb, P.ROJO_SELLO if sel else P.TINTA)
            y += alto + 6
            if y > self.area.bottom - 30:
                break


NOMBRES_CAMPO = {
    "danio_pct": ("daño", "%"), "armadura": ("armadura", ""), "velocidad_pct": ("velocidad", "%"),
    "ataque_vel_pct": ("cadencia de fuego", "%"), "alcance": ("alcance", " casillas"),
    "regeneracion": ("vida por segundo", ""), "inmortal": ("no puede morir", None),
    "ignora_altura": ("sin penalización por altura", None), "camuflaje": ("camuflaje", None),
}
NOMBRES_CLASE = {"infanteria": "infantería", "caballeria": "caballería", "artilleria": "artillería",
                 "apoyo": "apoyo", "naval": "marina", "trabajador": "trabajadores", "heroe": "héroes",
                 "edificio": "edificios"}


def describir_efecto(e):
    """Texto legible de un efecto de aura o habilidad: «+15% de daño (tropas de tierra)»."""
    nombre, unidad = NOMBRES_CAMPO.get(e.campo, (e.campo.replace("_", " "), ""))
    if unidad is None:
        txt = nombre
    else:
        v = e.suma
        v = int(v) if float(v).is_integer() else v
        signo = "+" if v >= 0 else ""
        txt = f"{signo}{v}% de {nombre}" if unidad == "%" else f"{signo}{v} de {nombre}"
    f = e.filtro
    destino = []
    for grupo in (f.clases, f.categorias):
        if grupo:
            destino += [NOMBRES_CLASE.get(c, c) for c in grupo]
    if f.capa == "tierra":
        destino.append("tropas de tierra")
    elif f.capa == "agua":
        destino.append("buques")
    if f.biologica:
        destino.append("soldados")
    if destino:
        txt += f" ({', '.join(destino)})"
    return txt
