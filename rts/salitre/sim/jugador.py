"""Estado de cada jugador: recursos, población, tecnología e investigaciones."""

from . import stats as mod_stats


class Jugador:
    def __init__(self, idx, nombre, faccion, equipo, color, catalogo, es_ia=False):
        self.idx = idx
        self.nombre = nombre
        self.faccion = faccion
        self.equipo = equipo
        self.color = color
        self.es_ia = es_ia
        self.vivo = True
        self.rendido = False
        self.salitre, self.agua = catalogo.recursos_iniciales
        self.pob_usada = 0
        self.pob_max = 0
        self.mejoras = set()
        self.investigando = set()
        self.terminados = {}          # tipo de edificio -> cantidad terminados
        self.heroes = set()           # héroes vivos o en formación
        self.minas = 0
        self._cat = catalogo
        self._efectos = list(faccion.efectos_iniciales())
        self.stats = mod_stats.tabla(catalogo, faccion, self._efectos)
        self.cambio_mejoras = True
        self.est = {
            "unidades_creadas": 0, "unidades_perdidas": 0, "enemigos_abatidos": 0,
            "edificios_construidos": 0, "edificios_perdidos": 0, "edificios_destruidos": 0,
            "salitre_recolectado": 0, "agua_recolectada": 0, "salitre_gastado": 0,
            "agua_gastada": 0,
        }
        self.aviso_poblacion_t = -9999
        self.aviso_ataque_t = -9999

    def tiene(self, edificio_id):
        return self.terminados.get(edificio_id, 0) > 0

    def requisitos(self, tipo):
        for r in tipo.requisitos:
            if self.terminados.get(r, 0) <= 0:
                return False
        return True

    def puede_pagar(self, costo):
        return self.salitre >= costo[0] and self.agua >= costo[1]

    def pagar(self, costo):
        self.salitre -= costo[0]
        self.agua -= costo[1]
        self.est["salitre_gastado"] += costo[0]
        self.est["agua_gastada"] += costo[1]

    def reembolsar(self, costo, pct=100):
        s = costo[0] * pct // 100
        a = costo[1] * pct // 100
        self.salitre += s
        self.agua += a
        self.est["salitre_gastado"] -= s
        self.est["agua_gastada"] -= a

    def aplicar_mejora(self, mejora):
        self.mejoras.add(mejora.id)
        self._efectos.extend(mejora.efectos)
        self.stats = mod_stats.tabla(self._cat, self.faccion, self._efectos)
        self.cambio_mejoras = True

    def nivel_pob_max(self, total):
        self.pob_max = min(self._cat.poblacion_maxima, total)
