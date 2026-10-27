"""Logística del agua: la sed de la tropa en la pampa y el salar, el golpe de calor y el
abastecimiento (carretas de agua, molinos y el Cuartel General).

Todo en enteros. El agua de una cantimplora o de una pipa se mide en 1/AFP de punto; la
fatiga, en centésimas de tick al sol sin agua: cada tick sin agua en una casilla de calor suma
el calor de la casilla (pampa 100, salar 150) y, a la sombra de un tamarugo, solo una parte.

- sed(): cada tick, al final de la orden de cada unidad que tiene sed (tipo.sed).
- abastecer(): cada PERIODO ticks, junto con las auras: los molinos y el Cuartel General dan
  de beber y llenan las pipas; las carretas reparten su pipa entre la tropa que las rodea.
"""

from .combate import dist2_a
from .constantes import HFP, TILE
from .mapa import COB_SOMBRA

PERIODO = 8         # cada cuántos ticks se reparte el agua (el mismo ritmo de las auras)


def deshidratada(u):
    """¿Se le acabó el agua? (solo las unidades con sed)."""
    return u.tipo.sed is not None and u.agua <= 0


def sed(m, u, t):
    """Gasta agua si la unidad marcha o combate al calor; sin agua al sol se fatiga y, pasado el
    umbral, sufre el golpe de calor. Con agua en la cantimplora la fatiga se repone."""
    s = u.tipo.sed
    calor = m.calor[m.mapa.idx_de(u.x, u.y)]
    if calor:
        if u.cobertura & COB_SOMBRA:
            calor = calor * s.sombra_pct // 100
        if u.agua > 0:
            if u.moviendo or t - u.disparo_t < s.combate:
                u.agua -= s.consumo * calor // 100
                if u.agua <= 0:
                    u.agua = 0
                    _avisar(m, u, "sed")
        else:
            u.fatiga = min(2 * s.golpe_calor, u.fatiga + calor)
            if u.fatiga >= s.golpe_calor:
                _golpe_de_calor(m, u, s, t)
            return
    if u.agua > 0 and u.fatiga:
        u.fatiga = max(0, u.fatiga - s.recuperacion)


def _golpe_de_calor(m, u, s, t):
    u.calor_acum += s.danio_calor
    if u.calor_acum < HFP:
        return
    d = u.calor_acum // HFP
    u.calor_acum %= HFP
    _avisar(m, u, "calor")
    if u.mod("inmortal", t):
        u.vida = max(1, u.vida - d)
        return
    u.vida -= d
    if u.vida <= 0:
        u.vida = 0
        # cae por el sol, no por un enemigo: con un hospital en pie queda herido en el suelo
        m.matar(u, 0, -1)


def _avisar(m, u, clave):
    """Aviso al dueño («la tropa se queda sin agua», «golpe de calor»), sin repetirlo seguido."""
    j = m.jugadores[u.dueno]
    t = m.tick
    if t - j.avisos.get(clave, -10 ** 9) >= m.cat.sed.aviso:
        j.avisos[clave] = t
        m.ev_jugador(u.dueno, clave, u.x >> 4, u.y >> 4)


def _beber(v, cantidad, s, alivio):
    if v.agua < s.cantimplora:
        v.agua = min(s.cantimplora, v.agua + cantidad)
    if v.fatiga:
        v.fatiga = max(0, v.fatiga - alivio)


def abastecer(m):
    """Cada PERIODO ticks: las fuentes de agua (molinos, Cuartel General) y las carretas."""
    s = m.cat.sed
    alivio = s.alivio * PERIODO
    # fuentes: dan de beber a la tropa aliada a su lado y llenan las pipas de las carretas
    for b in m.edificios.values():
        tb = b.tipo
        if not tb.abastece_radio or not b.vivo or not b.construido:
            continue
        r = tb.abastece_radio
        for v in m.rejilla.cerca(b.x, b.y, r + b.radio):
            if not v.vivo or v.dentro or not m.aliados(b.dueno, v.dueno):
                continue
            if dist2_a(v.x, v.y, b) > r * r:
                continue
            if v.tipo.sed is not None:
                _beber(v, tb.abastece_tropa * PERIODO, s, alivio)
            cap = v.tipo.estanque_cap
            if cap and v.estanque < cap:
                v.estanque = min(cap, v.estanque + tb.abastece_pipa * PERIODO)
        # la guarnición del Cuartel General también bebe
        for uid in b.guarnicion:
            v = m.entidad(uid)
            if v is not None and v.tipo.sed is not None:
                _beber(v, tb.abastece_tropa * PERIODO, s, alivio)
    # carretas: reparten la pipa entre la tropa que las rodea, primero la más sedienta
    for u in m.unidades.values():
        tu = u.tipo
        if not tu.estanque_cap or u.estanque <= 0 or not u.vivo or u.dentro:
            continue
        r = tu.estanque_radio
        r2 = r * r
        sedientos = []
        for v in m.rejilla.cerca(u.x, u.y, r + TILE):
            if v is u or not v.vivo or v.dentro or v.tipo.sed is None or not m.aliados(u.dueno, v.dueno):
                continue
            if v.agua >= s.cantimplora and not v.fatiga:
                continue
            dx = v.x - u.x
            dy = v.y - u.y
            if dx * dx + dy * dy <= r2:
                sedientos.append(v)
        sedientos.sort(key=lambda v: (v.agua, v.id))
        racion = tu.estanque_reparto * PERIODO
        for v in sedientos:
            falta = s.cantimplora - v.agua
            if falta > 0:
                dar = min(racion, falta, u.estanque)
                v.agua += dar
                u.estanque -= dar
            if v.fatiga:
                v.fatiga = max(0, v.fatiga - alivio)
            if u.estanque <= 0:
                u.estanque = 0
                break
