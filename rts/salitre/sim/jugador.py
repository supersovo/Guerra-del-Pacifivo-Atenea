"""Estado de cada jugador: dinero, agua, población, tecnología e investigaciones.

El salitre no se guarda: los trabajadores lo venden en el cuartel general a
1 $ por unidad y con ese dinero se paga todo (tropas, edificios, mejoras).
"""

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
        self.dinero, self.agua = catalogo.recursos_iniciales
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
        self._stats_grado = {}        # (tipo, grado) -> stats con los bonos de la veteranía
        self.veteranos_llegan = []    # campaña: veteranos que llegan con el cuartel general
        self.sanidad = {"equipos": 0, "segundos_herido": 0, "vida_al_volver": 0}
        self.cambio_mejoras = True
        self.est = {
            "unidades_creadas": 0, "unidades_perdidas": 0, "enemigos_abatidos": 0,
            "edificios_construidos": 0, "edificios_perdidos": 0, "edificios_destruidos": 0,
            "salitre_recolectado": 0, "agua_recolectada": 0, "dinero_gastado": 0,
            "agua_gastada": 0, "heridos_recuperados": 0, "ascensos": 0, "veteranos_caidos": 0,
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
        return self.dinero >= costo[0] and self.agua >= costo[1]

    def falta(self, costo):
        """Qué recurso falta para pagar el costo ("" si alcanza)."""
        if self.dinero < costo[0]:
            return "Falta dinero" if self.agua >= costo[1] else "Faltan dinero y agua"
        return "Falta agua" if self.agua < costo[1] else ""

    def pagar(self, costo):
        self.dinero -= costo[0]
        self.agua -= costo[1]
        self.est["dinero_gastado"] += costo[0]
        self.est["agua_gastada"] += costo[1]

    def reembolsar(self, costo, pct=100):
        s = costo[0] * pct // 100
        a = costo[1] * pct // 100
        self.dinero += s
        self.agua += a
        self.est["dinero_gastado"] -= s
        self.est["agua_gastada"] -= a

    def vender_salitre(self, cantidad):
        """El cuartel general compra el salitre al contado: 1 $ por unidad."""
        self.dinero += cantidad
        self.est["salitre_recolectado"] += cantidad

    def aplicar_mejora(self, mejora):
        self.mejoras.add(mejora.id)
        self._efectos.extend(mejora.efectos)
        self.stats = mod_stats.tabla(self._cat, self.faccion, self._efectos)
        self._stats_grado = {}
        for k, v in mejora.sanidad.items():
            self.sanidad[k] += v
        self.cambio_mejoras = True

    def stats_de(self, tipo_id, grado=0):
        """Stats de un tipo para este jugador; con grado > 0, los de un veterano de ese grado."""
        if not grado:
            return self.stats[tipo_id]
        clave = (tipo_id, grado)
        st = self._stats_grado.get(clave)
        if st is None:
            efectos = self._efectos + list(self._cat.veterania.grados[grado].efectos)
            st = mod_stats.calcular(self._cat.unidades[tipo_id], efectos)
            self._stats_grado[clave] = st
        return st

    def nivel_pob_max(self, total):
        self.pob_max = min(self._cat.poblacion_maxima, total)
