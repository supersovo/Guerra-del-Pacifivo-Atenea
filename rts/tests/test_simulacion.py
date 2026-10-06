"""Simulación: economía, obras, producción, combate, habilidades y determinismo."""

import utilidades as U
from salitre.sim.constantes import AGUA, TICKS, TILE

S = TICKS  # un segundo


def _unidad(m, p, tipo, tx, ty):
    u = m.crear_unidad(p, tipo, tx * TILE + TILE // 2, ty * TILE + TILE // 2)
    m.jugadores[p].pob_usada += u.tipo.poblacion
    return u


def test_recoleccion_de_salitre():
    m = U.mundo()
    trab = U.de(m, 0, "trabajador")
    sal = [r for r in m.recursos.values() if r.rtipo == "salitre"]
    m.comando(0, {"c": "inteligente", "u": [u.id for u in trab], "t": sal[0].id})
    U.avanzar(m, 60 * S)
    j = m.jugadores[0]
    assert j.est["salitre_recolectado"] >= 200
    assert j.salitre == 100 + j.est["salitre_recolectado"]


def test_molino_y_agua():
    m = U.mundo()
    m.comando(0, {"c": "truco", "salitre": 1000})
    U.avanzar(m, 1)
    pozo = [r for r in m.recursos.values() if r.rtipo == "agua"][0]
    w = U.de(m, 0, "trabajador")[0]
    m.comando(0, {"c": "construir", "u": [w.id], "e": "molino_agua", "tx": pozo.tx, "ty": pozo.ty})
    U.avanzar(m, 40 * S)
    mol = U.de(m, 0, "molino_agua")
    assert mol and mol[0].construido
    # el constructor se pone solo a acarrear agua
    U.avanzar(m, 30 * S)
    assert m.jugadores[0].est["agua_recolectada"] > 0


def test_obra_produccion_y_poblacion():
    m = U.mundo()
    m.comando(0, {"c": "truco", "salitre": 3000})
    U.avanzar(m, 1)
    w = U.de(m, 0, "trabajador")[0]
    m.comando(0, {"c": "construir", "u": [w.id], "e": "barracas", "tx": 6, "ty": 14})
    U.avanzar(m, 55 * S)
    bar = U.de(m, 0, "barracas")
    assert bar and bar[0].construido
    j = m.jugadores[0]
    assert j.pob_max == 10 and j.pob_usada == 6
    m.comando(0, {"c": "entrenar", "e": [bar[0].id], "t": "infante", "n": 5})
    U.avanzar(m, 120 * S)
    # solo caben 4 infantes: la población está al máximo
    assert len(U.de(m, 0, "infante")) == 4
    assert j.pob_usada == 10
    assert any(ev[0] == "pob" for _d, ev in m.eventos) or j.aviso_poblacion_t > 0


def test_requisitos_tecnologicos():
    m = U.mundo()
    m.comando(0, {"c": "truco", "salitre": 5000, "agua": 5000})
    U.avanzar(m, 1)
    w = U.de(m, 0, "trabajador")[0]
    m.comando(0, {"c": "construir", "u": [w.id], "e": "caballeriza", "tx": 6, "ty": 14})
    U.avanzar(m, 2)
    errores = [ev for d, ev in m.eventos if d == 0 and ev[0] == "err"]
    assert not U.de(m, 0, "caballeriza")
    assert m.jugadores[0].requisitos(m.cat.edificios["caballeriza"]) is False
    del errores


def test_combate_y_bajas():
    m = U.mundo()
    a = [_unidad(m, 0, "infante", 30, 30 + k) for k in range(5)]
    b = [_unidad(m, 1, "infante", 34, 30 + k) for k in range(2)]
    U.avanzar(m, 20 * S)
    assert all(not u.vivo for u in b)
    assert any(u.vivo for u in a)
    assert m.jugadores[0].est["enemigos_abatidos"] == 2


def test_cantinera_cura():
    m = U.mundo()
    inf = _unidad(m, 0, "infante", 30, 30)
    can = _unidad(m, 0, "cantinera", 31, 30)
    can.energia = can.st.energia_max
    inf.vida = 10
    U.avanzar(m, 10 * S)
    assert inf.vida == inf.st.vida


def test_aura_de_heroe():
    m = U.mundo()
    h = _unidad(m, 0, "baquedano", 30, 30)
    inf = _unidad(m, 0, "infante", 32, 30)
    lejos = _unidad(m, 0, "infante", 50, 50)
    U.avanzar(m, 9)
    assert inf.mod("danio_pct", m.tick) == 15
    assert lejos.mod("danio_pct", m.tick) == 0
    del h


def test_habilidad_potenciar_y_minas():
    m = U.mundo(facciones=("chile", "peru"))
    h = _unidad(m, 0, "baquedano", 30, 30)
    inf = _unidad(m, 0, "infante", 31, 31)
    U.avanzar(m, 4)
    m.comando(0, {"c": "habilidad", "u": [h.id], "h": "al_asalto"})
    U.avanzar(m, 2)
    assert inf.mod("ataque_vel_pct", m.tick) == 30
    tor = _unidad(m, 1, "torpedista", 40, 40)
    tor.energia = tor.st.energia_max
    U.avanzar(m, 4)
    m.comando(1, {"c": "habilidad", "u": [tor.id], "h": "sembrar_mina", "x": 41 * 32, "y": 40 * 32})
    U.avanzar(m, 3 * S)
    assert len(m.minas) == 1
    victima = _unidad(m, 0, "infante", 44, 40)
    m.comando(0, {"c": "mover", "u": [victima.id], "x": 38 * 32, "y": 40 * 32 + 16})
    U.avanzar(m, 6 * S)
    assert not victima.vivo
    assert len(m.minas) == 0


def test_artilleria_se_emplaza_y_alcance_minimo():
    m = U.mundo()
    c = _unidad(m, 0, "canon_campana", 20, 20)
    obj = _unidad(m, 1, "infante", 29, 20)
    cerca = _unidad(m, 1, "infante", 21, 21)
    cerca.vida = 10 ** 6
    U.avanzar(m, 4)   # la visión se recalcula cada 4 ticks
    m.comando(0, {"c": "atacar", "u": [c.id], "t": obj.id})
    U.avanzar(m, 2 * S + 4)
    assert c.emplazada
    U.avanzar(m, 6 * S)
    assert not obj.vivo
    # el infante pegado al cañón está dentro del alcance mínimo: no lo puede batir
    m.comando(0, {"c": "atacar", "u": [c.id], "t": cerca.id})
    U.avanzar(m, 3 * S)
    assert cerca.vida == 10 ** 6


def test_ventaja_de_altura():
    def tiros_fallidos(altura):
        def extra(d):
            d["altura"] = ["0" * 64 if y < 32 else "1" * 64 for y in range(64)]
        m = U.mundo(U.mapa_llano(extra=extra), facciones=("chile", "bolivia"))
        a = _unidad(m, 0, "infante", 30, 30)    # abajo
        b = _unidad(m, 1, "colorado", 30, 33 if altura else 31)
        b.vida = 10 ** 6
        a.vida = 10 ** 6
        # desde abajo no se ve la meseta: un espía en lo alto da la visión
        _unidad(m, 0, "espia", 33, 36)
        fallos = 0
        for _ in range(40 * S):
            m.paso()
            fallos += sum(1 for _d, ev in m.eventos if ev[0] == "dis" and ev[1] == a.id and ev[4])
        return fallos
    assert tiros_fallidos(False) == 0
    assert tiros_fallidos(True) > 5


def test_transporte_embarca_y_desembarca():
    m = U.mundo(U.mapa_llano(agua_filas=20))
    barco = _unidad(m, 0, "transporte", 30, 46)
    assert barco.capa == AGUA
    tropa = [_unidad(m, 0, "infante", 30 + k, 42) for k in range(3)]
    m.comando(0, {"c": "inteligente", "u": [u.id for u in tropa], "t": barco.id})
    U.avanzar(m, 10 * S)
    assert all(u.dentro == barco.id for u in tropa)
    m.comando(0, {"c": "descargar", "u": [barco.id], "x": 10 * 32, "y": 42 * 32})
    U.avanzar(m, 20 * S)
    assert all(u.dentro == 0 for u in tropa)
    assert all(m.mapa.pasable[0][m.mapa.idx_de(u.x, u.y)] for u in tropa)


def test_trinchera_guarnicion():
    m = U.mundo()
    tr = m.crear_edificio(0, "trinchera", 30, 30, construido=True)
    inf = [_unidad(m, 0, "infante", 28 + k, 34) for k in range(4)]
    m.comando(0, {"c": "inteligente", "u": [u.id for u in inf], "t": tr.id})
    U.avanzar(m, 8 * S)
    assert len(tr.guarnicion) == 4
    enemigo = _unidad(m, 1, "infante", 36, 31)
    U.avanzar(m, 15 * S)
    assert not enemigo.vivo


def test_determinismo():
    def correr():
        from salitre.ia.ia import IA
        m = U.mundo(U.mapa_llano(80, 80), semilla=99)
        ias = [IA(m, 0), IA(m, 1)]
        for _ in range(4 * 60 * S):
            for ia in ias:
                ia.actualizar()
            m.paso()
        return m.suma_control(), m.tick
    assert correr() == correr()


def test_repeticion_reproduce_partida():
    from salitre.ia.ia import IA
    m = U.mundo(U.mapa_llano(80, 80), semilla=5, registrar=True)
    ias = [IA(m, 0), IA(m, 1)]
    for _ in range(3 * 60 * S):
        for ia in ias:
            ia.actualizar()
        m.paso()
    registro = list(m.registro)
    m2 = U.mundo(U.mapa_llano(80, 80), semilla=5)
    k = 0
    for _ in range(3 * 60 * S):
        while k < len(registro) and registro[k][0] == m2.tick + 1:
            m2.comando(registro[k][1], registro[k][2])
            k += 1
        m2.paso()
    assert m2.suma_control() == m.suma_control()
