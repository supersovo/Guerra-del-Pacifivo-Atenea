"""Controles de volumen: general, música, efectos y voces.

Los usan las Opciones y el menú de la batalla (F10). Cada deslizador aplica su
volumen al instante; al soltarlo se oye una muestra (un disparo, una voz) para
juzgar el nivel. La música se oye sola, porque suena todo el tiempo.
"""

from .. import fuentes
from ..graficos import paleta as P
from .widgets import Deslizador, Widget

FILAS = [
    ("volumen_general", "Volumen general"),
    ("volumen_musica", "Música"),
    ("volumen_efectos", "Efectos: fusilería, cañones y obras"),
    ("volumen_voces", "Voces de la tropa"),
]


class ControlesSonido(Widget):
    """Bloque de cuatro deslizadores con su rótulo y el porcentaje."""

    def __init__(self, app, x, y, ancho, paso=48):
        super().__init__((x, y, ancho, paso * len(FILAS)))
        self.app = app
        self.paso = paso
        self.deslizadores = []
        for k, (clave, _texto) in enumerate(FILAS):
            d = Deslizador((x, y + k * paso + 24, ancho, 18), app.sonido.niveles[clave],
                           lambda v, c=clave: app.sonido.fijar_volumen(c, v))
            d.clave = clave
            self.deslizadores.append(d)

    def manejar(self, ev):
        if not self.visible:
            return False
        for d in self.deslizadores:
            arrastrando = d._arrastre
            if d.manejar(ev):
                if arrastrando and not d._arrastre:
                    self._muestra(d.clave)
                return True
        return False

    def _muestra(self, clave):
        snd = self.app.sonido
        if clave == "volumen_voces":
            snd.voz(("seleccion_infanteria", "mover_infanteria"), 3)
        elif clave != "volumen_musica":
            snd.reproducir("fusil", 0.8, 0.0, 0)

    def dibujar(self, ui):
        if not self.visible:
            return
        lz = ui.lz
        f = fuentes.cuerpo(16)
        for k, (clave, texto) in enumerate(FILAS):
            v = self.app.sonido.niveles[clave]
            y = self.rect.y + k * self.paso
            lz.texto(texto, self.rect.x, y, f, P.TINTA)
            lz.texto(f"{int(round(v * 100))} %", self.rect.right, y, fuentes.negrita(16),
                     P.TINTA if v > 0 else P.ROJO_SELLO, "der")
        for d in self.deslizadores:
            d.dibujar(ui)

    def sincronizar(self):
        """Vuelve a leer los volúmenes (después de «Restablecer»)."""
        for d in self.deslizadores:
            d.valor = self.app.sonido.niveles[d.clave]

