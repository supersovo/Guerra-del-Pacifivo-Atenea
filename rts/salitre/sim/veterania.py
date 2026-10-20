"""Veteranía: la tropa aprende combatiendo, recibiendo fuego, curando e instruyéndose.

La experiencia se mide en valor de combate (un punto = 1 $, guardado en 1/XPF):
abatir a un enemigo de $ 50 da 50 puntos, repartidos entre los tiradores según el
daño de cada uno. Al llegar al umbral de un grado (tablas.json, "veterania") la
unidad asciende y toma los stats de ese grado: más vida, daño, cadencia, alcance...
Los heridos guardan su hoja de servicio (entidades.hoja_de): si los camilleros los
salvan, vuelven del hospital con el grado intacto.
"""

from .constantes import XPF


def aprende(u):
    """¿Esta unidad gana experiencia? (la tropa que combate o cura, viva)."""
    return u is not None and u.es_unidad and u.vivo and u.tipo.veterania


def ganar(m, u, xp):
    """Suma experiencia (en 1/XPF), acelerada cerca de un Aguerrido de su arma o de un héroe."""
    if xp <= 0 or not aprende(u):
        return
    vet = m.cat.veterania
    if u.grado >= vet.maximo:
        return
    pct = u.aura.get("experiencia_pct", 0) if u.aura else 0
    if pct:
        xp = xp * (100 + pct) // 100
    u.xp += xp
    while u.grado < vet.maximo and u.xp >= vet.umbral(u.tipo, u.grado + 1):
        ascender(m, u)


def ascender(m, u):
    """Sube un grado: stats del nuevo grado y la vida crece con el máximo."""
    poner_grado(m, u, u.grado + 1)
    j = m.jugadores[u.dueno]
    j.est["ascensos"] += 1
    m.ev_pos(u.x, u.y, "ascenso", u.id, u.grado, u.tipo.idx, u.dueno)


def poner_grado(m, u, grado):
    nuevo = m.jugadores[u.dueno].stats_de(u.tipo.id, grado)
    if nuevo.vida > u.st.vida:
        u.vida += nuevo.vida - u.st.vida      # la vida crece con el máximo (los grados no la bajan)
    u.grado = grado
    u.st = nuevo
    if grado and not u.nombre:
        u.nombre = semilla_nombre(m, u)


def semilla_nombre(m, u):
    """Semilla del nombre del soldado (servidor y clientes la convierten en el mismo nombre)."""
    return ((u.id * 2654435761 + m.semilla * 40503 + u.dueno * 97) & 0x7FFFFFFF) or 1


def aplicar_hoja(m, u, hoja):
    """Devuelve a una unidad su hoja de servicio (al volver del hospital o al llegar a la campaña)."""
    if not hoja:
        return
    xp, grado, nombre, ficha, batallas, bajas = hoja
    vet = m.cat.veterania
    grado = max(0, min(vet.maximo, int(grado)))
    u.xp = max(int(xp), vet.umbral(u.tipo, grado))
    u.nombre = int(nombre)
    u.ficha = str(ficha or "")
    u.batallas = int(batallas)
    u.abatidos = int(bajas)
    if grado:
        poner_grado(m, u, grado)
        u.vida = u.st.vida


def por_danio(m, atacante, objetivo, d):
    """Experiencia por 'd' puntos de daño efectivo: al que hiere, según el valor de lo que
    destruye (las obras valen la mitad), y al herido que sigue en pie, el fogueo."""
    if d <= 0:
        return
    vet = m.cat.veterania
    vmax = max(1, objetivo.st.vida)
    if aprende(atacante) and m.enemigos(atacante.dueno, objetivo.dueno):
        if objetivo.es_unidad:
            ganar(m, atacante, d * objetivo.tipo.valor * XPF // vmax)
        elif objetivo.es_edificio:
            ganar(m, atacante, d * objetivo.tipo.valor * XPF * vet.edificios_pct // (100 * vmax))
    if objetivo.es_unidad and objetivo.vida > 0 and aprende(objetivo):
        ganar(m, objetivo, d * objetivo.tipo.valor * XPF * vet.fogueo_pct // (100 * vmax))


def por_curacion(m, sanitaria, puntos):
    """La cantinera aprende curando."""
    if puntos > 0:
        ganar(m, sanitaria, puntos * m.cat.veterania.curacion_xp)


def tiempo_emplazar(m, u):
    """La artillería veterana se emplaza (y se engancha) más rápido."""
    pct = m.cat.veterania.grados[u.grado].emplazar_pct if u.grado else 0
    return max(1, u.tipo.emplazar * (100 - pct) // 100)


def fallo_altura(m, atacante):
    """Probabilidad (%) de errar cuesta arriba: los veteranos fallan menos."""
    base = m.cat.fallo_altura
    if atacante.es_unidad and atacante.grado:
        return base * m.cat.veterania.grados[atacante.grado].fallo_altura_pct // 100
    return base


def instruccion(m):
    """Cada segundo: con «Ejercicios de tiro», los reclutas ociosos junto al Barracón de
    Instrucción ganan experiencia hasta el primer grado (más arriba se llega combatiendo)."""
    vet = m.cat.veterania
    mid = vet.instruccion_mejora
    if not mid or vet.maximo < 1:
        return
    sede = m.cat.mejoras[mid].edificio
    r = vet.instruccion_radio
    for b in m.edificios.values():
        if not b.vivo or not b.construido or b.tipo.id != sede or mid not in m.jugadores[b.dueno].mejoras:
            continue
        lim = r + b.radio
        for u in m.rejilla.cerca(b.x, b.y, lim):
            if (u.dueno != b.dueno or u.grado or u.dentro or u.orden is not None or u.ruta
                    or not aprende(u)):
                continue
            dx = u.x - b.x
            dy = u.y - b.y
            if dx * dx + dy * dy > lim * lim:
                continue
            tope = vet.umbral(u.tipo, 1)
            u.xp = min(tope, u.xp + vet.instruccion_xp)
            if u.xp >= tope:
                ascender(m, u)


def auras(m):
    """Encuadramiento y escuela de mando (los reclutas aprenden más rápido cerca de un
    Aguerrido de su arma o de un héroe) y la vida que recupera el Aguerrido fuera de combate.
    Se llama desde Mundo._auras, después de limpiar las auras de todas las unidades."""
    vet = m.cat.veterania
    t = m.tick
    for u in m.unidades.values():
        if not u.vivo or u.dentro:
            continue
        if u.tipo.heroe and vet.heroe_pct:
            _escuela(m, u, u.tipo.aura_radio or vet.encuadre_radio, vet.heroe_pct, None, vet.maximo + 1)
        elif u.grado:
            if u.grado == vet.maximo and vet.encuadre_pct:
                _escuela(m, u, vet.encuadre_radio, vet.encuadre_pct, u.tipo.clase, u.grado)
            g = vet.grados[u.grado]
            if g.regeneracion and u.vida < u.st.vida and t - u.golpeado_t >= vet.regen_tras:
                if g.regeneracion > u.aura.get("regeneracion", 0):
                    if not u.aura:
                        u.aura = {}
                    u.aura["regeneracion"] = g.regeneracion


def _escuela(m, maestro, radio, pct, clase, grado_maestro):
    r2 = radio * radio
    for v in m.rejilla.cerca(maestro.x, maestro.y, radio):
        if v is maestro or not v.vivo or v.dentro or not v.tipo.veterania or v.grado >= grado_maestro:
            continue
        if clase is not None and v.tipo.clase != clase:
            continue
        if not m.aliados(maestro.dueno, v.dueno):
            continue
        dx = v.x - maestro.x
        dy = v.y - maestro.y
        if dx * dx + dy * dy > r2:
            continue
        if pct > v.aura.get("experiencia_pct", 0):
            if not v.aura:
                v.aura = {}
            v.aura["experiencia_pct"] = pct
