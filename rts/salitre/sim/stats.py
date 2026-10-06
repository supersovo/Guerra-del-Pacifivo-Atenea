"""Estadísticas efectivas de cada tipo para un jugador.

Parten del catálogo y suman las bonificaciones de la nación y las
investigaciones completadas. Se recalculan solo cuando termina una
investigación; las auras y habilidades se aplican aparte, por unidad.
"""

from .constantes import EFP, TILE


class Stats:
    __slots__ = ("tipo", "vida", "armadura", "velocidad", "vision", "danio", "alcance",
                 "alcance_min", "enfriamiento", "salpicadura", "curar_ritmo", "energia_max",
                 "carga_pct", "costo", "tiempo")


def _sumas(tipo, efectos, edificio):
    s = {}
    for e in efectos:
        ok = e.filtro.edificio(tipo) if edificio else e.filtro.unidad(tipo)
        if ok:
            s[e.campo] = s.get(e.campo, 0) + e.suma
    return s


def calcular(tipo, efectos):
    es_edif = tipo.es_edificio
    s = _sumas(tipo, efectos, es_edif)
    st = Stats()
    st.tipo = tipo
    st.vida = int(tipo.vida * (100 + s.get("vida_pct", 0)) // 100 + s.get("vida", 0))
    st.armadura = int(tipo.armadura + s.get("armadura", 0))
    cp = s.get("costo_pct", 0)
    st.costo = (int(tipo.costo[0] * (100 + cp) // 100), int(tipo.costo[1] * (100 + cp) // 100))
    st.tiempo = tipo.tiempo
    st.vision = tipo.vision + s.get("vision", 0)
    st.energia_max = tipo.energia_max + int(round(s.get("energia_max", 0) * EFP))
    if es_edif:
        st.velocidad = 0
        st.curar_ritmo = 0
        st.carga_pct = 0
    else:
        st.velocidad = int(tipo.velocidad * (100 + s.get("velocidad_pct", 0)) // 100)
        st.curar_ritmo = int(tipo.curar_ritmo * (100 + s.get("curacion_pct", 0)) // 100)
        st.carga_pct = int(tipo.carga_bonus + s.get("carga_pct", 0))
    arma = tipo.arma
    if arma is not None:
        st.danio = int(arma.danio + s.get("danio", 0))
        st.alcance = arma.alcance + int(round(s.get("alcance", 0) * TILE))
        st.alcance_min = arma.alcance_min
        st.enfriamiento = max(1, int(round(arma.enfriamiento * 100 / (100 + s.get("ataque_vel_pct", 0)))))
        st.salpicadura = arma.salpicadura + int(round(s.get("salpicadura", 0) * TILE))
    else:
        st.danio = 0
        st.alcance = 0
        st.alcance_min = 0
        st.enfriamiento = 1
        st.salpicadura = 0
    return st


def tabla(catalogo, faccion, efectos):
    """Stats de todos los tipos disponibles para la nación."""
    out = {}
    for tid in faccion.unidades:
        out[tid] = calcular(catalogo.unidades[tid], efectos)
    for tid in faccion.edificios:
        out[tid] = calcular(catalogo.edificios[tid], efectos)
    return out
