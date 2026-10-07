"""Simulación: economía, obras, producción, combate, habilidades y determinismo."""

import utilidades as U
from salitre.sim.constantes import AGUA, TICKS, TILE
from salitre.sim.entidades import ATACAR, SEGUIR

S = TICKS  # un segundo


def _unidad(m, p, tipo, tx, ty):
    u = m.crear_unidad(p, tipo, tx * TILE + TILE // 2, ty * TILE + TILE // 2)
    m.jugadores[p].pob_usada += u.tipo.poblacion
    return u


def test_recoleccion_de_salitre():
    m = U.mundo()
    trab = U.de(m, 0, "trabajador")
    cg = U.de(m, 0, "cuartel_general")[0]
    sal = [r for r in m.recursos.values() if r.rtipo == "salitre"]
    m.comando(0, {"c": "inteligente", "u": [u.id for u in trab], "t": sal[0].id})
    ventas = []
    for _ in range(60 * S):
        m.paso()
        ventas += [ev for _d, ev in m.eventos if ev[0] == "venta"]
    j = m.jugadores[0]
    assert j.est["salitre_recolectado"] >= 200
    # el cuartel general compra el salitre al contado, 1 $ por unidad, y avisa cada venta
    assert j.dinero == 100 + j.est["salitre_recolectado"]
    propias = [ev for ev in ventas if ev[1] == cg.id]
    assert propias and sum(ev[2] for ev in propias) == j.est["salitre_recolectado"]


def test_molino_y_agua():
    m = U.mundo()
    m.comando(0, {"c": "truco", "dinero": 1000})
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
    m.comando(0, {"c": "truco", "dinero": 3000})
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
    m.comando(0, {"c": "truco", "dinero": 5000, "agua": 5000})
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


def test_cantinera_no_va_hacia_el_enemigo():
    m = U.mundo()
    can = _unidad(m, 0, "cantinera", 30, 30)
    enemigo = _unidad(m, 1, "infante", 37, 30)     # a la vista, fuera de su alcance
    m.comando(1, {"c": "mantener", "u": [enemigo.id]})
    U.avanzar(m, 5)                                   # la visión se actualiza cada 4 ticks
    # sola: no avanza y se avisa por qué
    for c in ("atacar", "inteligente"):
        x0 = can.x
        m.comando(0, {"c": c, "u": [can.id], "t": enemigo.id})
        U.avanzar(m, 1)
        assert any(d == 0 and ev[0] == "err" and "cantinera" in ev[1] for d, ev in m.eventos)
        U.avanzar(m, 3 * S)
        assert abs(can.x - x0) < TILE // 4
    # con tropa armada, la acompaña (sigue al infante) en lugar de ir por el enemigo
    inf = _unidad(m, 0, "infante", 30, 32)
    m.comando(0, {"c": "inteligente", "u": [can.id, inf.id], "t": enemigo.id})
    U.avanzar(m, 2)
    assert inf.orden.tipo == ATACAR and inf.orden.obj == enemigo.id
    assert can.orden.tipo == SEGUIR and can.orden.obj == inf.id


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


def test_tiradores_en_el_techo_de_las_barracas_y_del_cuartel():
    m = U.mundo()
    for tipo_id, cap in (("barracas", 6), ("cuartel_general", 8)):
        b = m.crear_edificio(0, tipo_id, 40 if tipo_id == "barracas" else 26, 40, construido=True)
        assert b.tipo.guarnicion == cap and b.tipo.guarnicion_vista == "techo"
    bar = U.de(m, 0, "barracas")[0]
    inf = [_unidad(m, 0, "infante", 38 + k, 46) for k in range(6)]
    m.comando(0, {"c": "inteligente", "u": [u.id for u in inf], "t": bar.id})
    U.avanzar(m, 8 * S)
    assert len(bar.guarnicion) == 6 and all(u.dentro == bar.id for u in inf)
    # un séptimo ya no cabe
    otro = _unidad(m, 0, "infante", 38, 47)
    m.comando(0, {"c": "inteligente", "u": [otro.id], "t": bar.id})
    U.avanzar(m, 6 * S)
    assert not otro.dentro
    # desde el techo alcanzan más lejos que a pie (5 + 2 casillas)
    enemigo = _unidad(m, 1, "infante", 49, 41)
    m.comando(1, {"c": "mantener", "u": [enemigo.id]})
    eventos = []
    for _ in range(12 * S):
        m.paso()
        eventos += [ev for _d, ev in m.eventos if ev[0] == "dis" and len(ev) > 6 and ev[5] == bar.id]
    assert not enemigo.vivo
    assert eventos and all(0 <= ev[6] < 6 for ev in eventos)
    # se puede bajar a uno solo
    m.comando(0, {"c": "descargar", "u": [bar.id], "g": inf[2].id})
    U.avanzar(m, 1)
    assert not inf[2].dentro and len(bar.guarnicion) == 5


def test_heridos_camilleros_y_hospital():
    m = U.mundo()
    j = m.jugadores[0]
    # sin hospital, la infantería muere en el acto
    a = _unidad(m, 0, "infante", 20, 24)
    m.matar(a, 0, 1)
    U.avanzar(m, 1)
    assert not m.heridos
    hosp = m.crear_edificio(0, "hospital_campana", 14, 20, construido=True)
    U.avanzar(m, 10 * S)
    cam = U.de(m, 0, "camilleros")
    assert len(cam) == 2 and all(c.base_id == hosp.id for c in cam)
    assert j.pob_usada == 6                         # los camilleros no ocupan población
    # caído por fuego de fusil: queda herido; por artillería: muere
    b = _unidad(m, 0, "infante", 24, 24)
    c = _unidad(m, 0, "infante", 25, 25)
    m.matar(b, 0, 1)
    m.matar(c, 0, 1, explosion=True)
    assert len(m.heridos) == 1 and not b.vivo
    infantes_antes = len(U.de(m, 0, "infante"))
    # lo recogen, lo curan (20 s) y vuelve a filas con media vida
    recuperado = None
    for _ in range(50 * S):
        m.paso()
        for _d, ev in m.eventos:
            if ev[0] == "recuperado":
                recuperado = m.ent[ev[2]]
                assert recuperado.vida == recuperado.st.vida // 2
    assert recuperado is not None and recuperado.tipo.id == "infante"
    assert not m.heridos and not hosp.pacientes
    assert len(U.de(m, 0, "infante")) == infantes_antes + 1
    assert j.est["heridos_recuperados"] == 1
    # uno que cae lejos del radio del hospital se desangra
    lejos = _unidad(m, 0, "infante", 60, 60)
    m.matar(lejos, 0, 1)
    assert len(m.heridos) == 1
    U.avanzar(m, 45 * S)
    assert not m.heridos
    # las órdenes del jugador no mueven a los camilleros
    x0 = cam[0].x
    m.comando(0, {"c": "mover", "u": [cam[0].id], "x": 10, "y": 10})
    U.avanzar(m, 3 * S)
    assert abs(cam[0].x - x0) < TILE


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
