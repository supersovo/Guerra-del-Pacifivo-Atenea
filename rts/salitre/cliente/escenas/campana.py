"""Campaña del Salitre: batallas encadenadas contra la IA en las que los veteranos
sobrevivientes pasan a la siguiente (llegan con el cuartel general).

La escena muestra las batallas con su relato histórico, el escalafón de veteranos
(con nombre, grado, bajas y batallas), el libro de los caídos y los honores; desde
aquí se marcha a la próxima batalla. El estado se guarda en el perfil local.
"""

import pygame

from ...contenido import campanas as mod_campanas
from ...contenido import nombres
from ...red.conexion import Conexion
from .. import fuentes
from ..graficos import paleta as P
from ..graficos.banderas import superficie_bandera
from ..ui.widgets import Boton, Lista, Tabla
from .base import Escena, FondoMenu, titulo_panel

COLOR_GRADO = {1: (120, 90, 40), 2: (150, 96, 20), 3: (176, 110, 10)}


class Campana(Escena):
    def __init__(self, app, campana_id="salitre", resumen=None):
        super().__init__(app)
        lz = self.lz
        self.fondo = FondoMenu(lz)
        self.campana = mod_campanas.cargar().get(campana_id)
        self.resumen = resumen          # resultado de la batalla recién librada (para mostrarlo)
        self.p_izq = pygame.Rect(24, 140, 470, 556)
        self.p_der = pygame.Rect(506, 140, 750, 556)
        self.cid, self.estado = app.perfil.ultima_campana(campana_id)
        self.nacion = self.estado["faccion"] if self.estado else "chile"
        self.lista = Lista((self.p_izq.x + 22, self.p_izq.y + 70, self.p_izq.w - 44, 4 * 30 + 8), [],
                           self.elegir_etapa, alto_fila=30)
        self.widgets.append(self.lista)
        cols = [("Grado", 92, "izq"), ("Veterano", 340, "izq"), ("Unidad", 156, "izq"), ("Bajas", 46, "centro"),
                ("Batallas", 58, "centro")]
        self.tabla = Tabla((self.p_der.x + 20, self.p_der.y + 104, self.p_der.w - 40, 9 * 24 + 30), cols,
                           alto_fila=24, fuente=fuentes.cuerpo(15))
        self.tabla.vacia = "Todavía no hay veteranos: se forman en combate."
        self.widgets.append(self.tabla)
        self.widgets.append(Boton((self.p_izq.x + 22, self.p_izq.bottom - 64, 150, 44), "Volver", self.volver,
                                  "madera"))
        self.b_marchar = Boton((self.p_izq.right - 262, self.p_izq.bottom - 64, 240, 44), "¡A la batalla!",
                               self.marchar, "principal", fuente=fuentes.negrita(20))
        self.widgets.append(self.b_marchar)
        self.b_nueva = Boton((self.p_der.right - 262, self.p_der.bottom - 64, 240, 44), "Nueva campaña",
                             self.nueva, "normal",
                             tooltip=("Nueva campaña", "Empieza de nuevo con la nación elegida (la campaña actual "
                                                       "se pierde)."))
        self.widgets.append(self.b_nueva)
        self.botones_nacion = []
        if self.campana is not None:
            for i, n in enumerate(self.campana.naciones):
                b = Boton((self.p_der.x + 20 + i * 150, self.p_der.bottom - 120, 140, 44), "",
                          lambda n=n: self.elegir_nacion(n))
                b.nacion = n
                self.botones_nacion.append(b)
        self.tex_banderas = {n: lz.textura(("bandera", n, 64), lambda n=n: superficie_bandera(n, 64, 40))
                             for n in ("chile", "peru", "bolivia", "argentina")}
        self.sel = 0
        self._refrescar()

    # ------------------------------------------------------------------
    def _refrescar(self):
        if self.campana is None:
            return
        est = self.estado
        etapa_actual = est["etapa"] if est else 0
        items = []
        for e in self.campana.etapas:
            if est and e.indice < etapa_actual:
                marca = "ganada"
            elif est and not est.get("terminada") and e.indice == etapa_actual:
                marca = "próxima"
            elif not est and e.indice == 0:
                marca = "primera"
            else:
                marca = ""
            items.append((e.indice, f"{e.indice + 1}. {e.nombre}" + (f"  — {marca}" if marca else "")))
        self.lista.items = items
        self.sel = min(etapa_actual, len(self.campana.etapas) - 1)
        self.lista.sel = self.sel
        filas = []
        if est:
            cat = self.app.cat
            vet = cat.veterania
            for v in est["escalafon"]:
                tipo = cat.unidades.get(v["tipo"])
                if tipo is None:
                    continue
                g = max(0, min(vet.maximo, v["grado"]))
                quien = nombres.nombre(cat, est["faccion"], tipo, g, v["nombre"]) or "—"
                unidad = cat.nombre(est["faccion"], tipo.id).split(" (")[0]
                filas.append((v["ficha"], [vet.grados[g].nombre, quien, unidad, v["bajas"], v["batallas"]],
                              COLOR_GRADO.get(g)))
        self.tabla.poner(filas)
        self.tabla.visible = bool(est)
        en_curso = bool(est) and not est.get("terminada")
        self.b_marchar.texto = "¡A la batalla!" if en_curso else "Comenzar la campaña"
        self.b_nueva.visible = en_curso
        for b in self.botones_nacion:
            b.visible = not en_curso

    def elegir_etapa(self, i):
        self.sel = i

    def elegir_nacion(self, n):
        self.nacion = n

    def volver(self):
        from .portada import Portada
        self.app.cambiar(Portada(self.app))

    def nueva(self):
        if self.cid is not None:
            self.app.perfil.borrar_campana(self.cid)
        self.cid, self.estado = None, None
        self.resumen = None
        self._refrescar()

    def manejar(self, ev):
        if ev.type == pygame.KEYDOWN and ev.key == pygame.K_ESCAPE:
            self.volver()
            return True
        for b in self.botones_nacion:
            if b.visible and b.manejar(ev):
                return True
        return super().manejar(ev)

    # ------------------------------------------------------------------
    def marchar(self):
        """Comienza la próxima batalla: el escalafón entero baja del tren con el cuartel general."""
        if self.campana is None:
            return
        cat = self.app.cat
        if not self.estado or self.estado.get("terminada"):
            self.estado = mod_campanas.nuevo_estado(self.campana, self.nacion)
            self.cid = self.app.perfil.crear_campana(self.estado)
        est = self.estado
        etapa = self.campana.etapas[est["etapa"]]
        rival = etapa.rival(est["faccion"])
        rivales = [{"faccion": rival, "dificultad": etapa.dificultad, "equipo": 2,
                    "veteranos": mod_campanas.veteranos_rival(cat, self.campana, est, etapa)}]
        nombre = self.app.config["nombre"] if len(self.app.config["nombre"]) >= 3 else "Comandante"
        try:
            puerto = self.app.iniciar_servidor_local()
            red = Conexion()
            if not red.conectar_y_esperar("127.0.0.1", puerto):
                raise ConnectionError(red.error)
            red.saludar(nombre, huella=cat.huella)
            red.esperar("bienvenida", 8)
            red.enviar({"t": "partida_rapida", "mapa": etapa.mapa, "faccion": est["faccion"], "rivales": rivales,
                        "velocidad": "normal", "veteranos": est["escalafon"]})
        except (OSError, RuntimeError, TimeoutError, ConnectionError) as e:
            self.app.avisar(f"No se pudo comenzar la batalla: {e}")
            self.app.detener_servidor_local()
            return
        self.app.red = red
        from .cargando import Cargando
        self.app.cambiar(Cargando(self.app, "campana", {"mapa": etapa.mapa, "faccion": est["faccion"],
                                                        "rivales": rivales, "campana": self.campana.id,
                                                        "campana_id": self.cid}))

    # ------------------------------------------------------------------
    def dibujar(self):
        lz = self.lz
        self.fondo.dibujar(self.t)
        est_ui = self.ui.estilo
        est_ui.panel(self.p_izq)
        est_ui.panel(self.p_der)
        if self.campana is None:
            titulo_panel(lz, "Campaña", self.p_izq)
            lz.texto("No se encontró datos/campanas.json.", self.p_izq.x + 24, self.p_izq.y + 80, fuentes.cuerpo(17),
                     P.TINTA)
            self.dibujar_widgets()
            return
        titulo_panel(lz, "Batallas", self.p_izq)
        e = self.campana.etapas[self.sel]
        y = self.lista.rect.bottom + 14
        lz.texto(e.nombre, self.p_izq.x + 24, y, fuentes.titulo(22), P.TINTA)
        y += 30
        fac = self.estado["faccion"] if self.estado else self.nacion
        rival = self.app.cat.facciones[e.rival(fac)].nombre
        lz.texto(f"{e.fecha}  ·  contra {rival}", self.p_izq.x + 24, y, fuentes.cursiva(16), P.TINTA_SUAVE)
        y += 26
        lz.parrafo(e.relato, self.p_izq.x + 24, y, self.p_izq.w - 48, fuentes.cuerpo(15), P.TINTA, max_lineas=9)
        titulo_panel(lz, self.campana.nombre, self.p_der)
        x = self.p_der.x + 20
        y = self.p_der.y + 66
        if self.estado:
            f = self.app.cat.facciones[self.estado["faccion"]]
            lz.dibujar(self.tex_banderas[f.id], x, y, 48, 30)
            txt = f"{f.ejercito}  ·  honores: {self.estado['honores']}"
            if self.estado.get("terminada"):
                txt += f"  ·  {self.estado.get('medalla', '')}"
            lz.texto(txt, x + 58, y + 4, fuentes.negrita(18), P.TINTA)
            yy = self.tabla.rect.bottom + 10
            caidos = self.estado["caidos"]
            lz.texto(f"Libro de los caídos: {len(caidos)}", x, yy, fuentes.negrita(16), P.ROJO_SELLO)
            cat = self.app.cat
            ultimos = []
            for v in reversed(caidos[-4:]):
                tipo = cat.unidades.get(v["tipo"])
                if tipo is not None:
                    ultimos.append(f"{nombres.nombre(cat, self.estado['faccion'], tipo, v['grado'], v['nombre'], False)}"
                                   f" ({v.get('etapa', '')})")
            if ultimos:
                lz.parrafo(" · ".join(ultimos), x, yy + 22, self.p_der.w - 40, fuentes.cursiva(14), P.TINTA_SUAVE,
                           max_lineas=2)
            # parte de la última batalla, junto al botón de abajo
            ancho = self.p_der.w - 300 if self.b_nueva.visible else self.p_der.w - 40
            y_parte = self.p_der.bottom - 64
            if self.resumen:
                r = self.resumen
                if r["victoria"]:
                    txt = (f"Victoria en {r['nombre']}: {r['supervivientes']} veteranos siguen en filas "
                           f"({r['nuevos']} nuevos), {r['caidos']} caídos, +{r['honores']} honores.")
                else:
                    txt = f"Derrota en {r['nombre']}: la batalla se puede repetir con el mismo escalafón."
                if self.estado.get("terminada"):
                    txt += " La campaña terminó: elija una nación para comenzar otra."
                lz.parrafo(txt, x, y_parte, ancho, fuentes.negrita(15),
                           (40, 110, 40) if r["victoria"] else P.ROJO_SELLO, max_lineas=3)
            elif self.estado.get("terminada"):
                lz.parrafo("La campaña terminó. Elija una nación para comenzar otra.", x, y_parte, ancho,
                           fuentes.negrita(15), P.TINTA, max_lineas=3)
        else:
            lz.parrafo(self.campana.descripcion, x, y, self.p_der.w - 40, fuentes.cuerpo(16), P.TINTA, max_lineas=6)
            lz.texto("Elija su nación:", x, self.p_der.bottom - 150, fuentes.negrita(17), P.TINTA)
        for b in self.botones_nacion:
            if not b.visible:
                continue
            sel = b.nacion == self.nacion
            r = b.rect
            lz.rect(r, (150, 32, 28) if sel else (90, 64, 40))
            lz.rect(r.inflate(-4, -4), P.PERGAMINO if not sel else (246, 232, 196))
            lz.dibujar(self.tex_banderas[b.nacion], r.x + 8, r.y + 7, 46, 29)
            lz.texto(self.app.cat.facciones[b.nacion].nombre, r.x + 60, r.y + 12, fuentes.negrita(16), P.TINTA)
        self.dibujar_widgets()
