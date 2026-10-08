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
    assert cerca.vida >= 10 ** 6      # (puede ganar vida al ascender: pelea contra el cañón)


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
    m = U.mundo(mapa=U.mapa_llano(ancho=200))
    j = m.jugadores[0]
    # sin hospital, la infantería muere en el acto
    a = _unidad(m, 0, "infante", 20, 24)
    m.matar(a, 0, 1)
    U.avanzar(m, 1)
    assert not m.heridos
    hosp = m.crear_edificio(0, "hospital_campana", 14, 20, construido=True)
    U.avanzar(m, 14 * S)
    cam = U.de(m, 0, "camilleros")
    assert len(cam) == 4 and all(c.base_id == hosp.id for c in cam)     # cuatro equipos por hospital
    assert len({c.x // (TILE // 2) for c in cam}) == 4                  # en fila frente a la puerta
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
    # lejos del hospital también lo van a buscar: va un solo equipo, el libre más cercano
    lejos = _unidad(m, 0, "infante", 60, 60)
    m.matar(lejos, 0, 1)
    U.avanzar(m, 8)
    h = next(iter(m.heridos.values()))
    van = [c for c in cam if c.objetivo == h.id]
    assert len(van) == 1 and h.camillero == van[0].id
    from salitre.red import instantanea as I
    assert I.registro(m, hosp, True, m.tick)[8]["cmc"] == 1          # la ficha: «1 en el campo»
    for _ in range(90 * S):         # unos 30 s de ida, 30 de vuelta y 20 de cura
        m.paso()
        if j.est["heridos_recuperados"] == 2:
            break
    assert j.est["heridos_recuperados"] == 2 and not m.heridos
    # al que no alcanzan a salvar igual lo van a buscar (y se desangra antes de que lleguen)
    U.avanzar(m, 20 * S)
    muy_lejos = _unidad(m, 0, "infante", 185, 20)
    m.matar(muy_lejos, 0, 1)
    U.avanzar(m, 8)
    h = next(iter(m.heridos.values()))
    assert any(c.objetivo == h.id for c in cam)
    U.avanzar(m, 41 * S)
    assert not m.heridos and j.est["heridos_recuperados"] == 2
    # las órdenes del jugador no mueven a los camilleros
    x0 = cam[0].x
    m.comando(0, {"c": "mover", "u": [cam[0].id], "x": 10, "y": 10})
    U.avanzar(m, 3 * S)
    assert abs(cam[0].x - x0) < TILE


def _abatir(m, victima, tirador):
    """El tirador abate a la víctima de un solo golpe (toda su vida restante)."""
    from salitre.sim import combate
    combate.danar(m, victima, victima.vida, tirador.id, tirador.dueno)


def test_veterania_experiencia_y_grados():
    from salitre.red import instantanea as I
    m = U.mundo()
    j0 = m.jugadores[0]
    a = _unidad(m, 0, "infante", 20, 20)
    base = j0.stats["infante"]
    # abatir a un enemigo de su mismo valor: Fogueado (1 galón), con vida, daño y nombre
    _abatir(m, _unidad(m, 1, "infante", 22, 20), a)
    assert a.grado == 1 and a.nombre
    assert a.st.vida == base.vida * 110 // 100 and a.vida == a.st.vida
    assert a.st.danio == (base.danio * 110 + 50) // 100 > base.danio
    assert any(ev[0] == "ascenso" and ev[1] == a.id and ev[2] == 1 for _d, ev in m.eventos)
    # tres enemigos: Veterano (+1 de alcance y de armadura); seis: Aguerrido
    for _ in range(2):
        _abatir(m, _unidad(m, 1, "infante", 22, 20), a)
    assert a.grado == 2
    assert a.st.alcance == base.alcance + TILE and a.st.armadura == base.armadura + 1
    for _ in range(3):
        _abatir(m, _unidad(m, 1, "infante", 22, 20), a)
    assert a.grado == 3 and a.st.vida == base.vida * 130 // 100
    assert j0.est["ascensos"] == 3
    # el grado se ve desde el otro bando (galones, vida máxima y nombre)
    reg = I.registro(m, a, False, m.tick)
    assert reg[8]["v"] == 3 and reg[8]["vm"] == a.st.vida and reg[8]["n"] == a.nombre
    # la experiencia se reparte según el daño, las obras valen la mitad y el fogueo enseña
    b = _unidad(m, 0, "infante", 20, 22)
    c = _unidad(m, 0, "infante", 20, 23)
    v = _unidad(m, 1, "infante", 22, 22)
    from salitre.sim import combate
    combate.danar(m, v, 20, b.id, 0)
    combate.danar(m, v, v.vida, c.id, 0)
    assert b.xp == 20 * 50 * 16 // 45 and c.xp == 25 * 50 * 16 // 45
    assert v.xp == 20 * 50 * 16 * 25 // (100 * 45)       # recibió fuego y siguió en pie
    cg_rival = U.de(m, 1, "cuartel_general")[0]
    d = _unidad(m, 0, "infante", 20, 24)
    combate.danar(m, cg_rival, 100, d.id, 0)
    assert d.xp == 100 * cg_rival.tipo.valor * 16 * 50 // (100 * cg_rival.st.vida)
    # los trabajadores, los héroes y los camilleros no ganan grados
    w = U.de(m, 0, "trabajador")[0]
    _abatir(m, _unidad(m, 1, "infante", 22, 26), w)
    heroe = _unidad(m, 0, "baquedano", 20, 26)
    _abatir(m, _unidad(m, 1, "infante", 22, 26), heroe)
    assert w.xp == 0 and heroe.xp == 0 and not w.grado and not heroe.grado


def test_veterano_herido_conserva_el_grado():
    m = U.mundo(mapa=U.mapa_llano(ancho=200))
    j = m.jugadores[0]
    hosp = m.crear_edificio(0, "hospital_campana", 14, 20, construido=True)
    U.avanzar(m, 10 * S)
    vet = _unidad(m, 0, "infante", 22, 24)
    for _ in range(3):
        _abatir(m, _unidad(m, 1, "infante", 40, 40), vet)
    assert vet.grado == 2
    hoja = (vet.xp, vet.grado, vet.nombre, vet.abatidos)
    recluta = _unidad(m, 0, "infante", 19, 22)          # cae más cerca, pero es recluta
    m.matar(recluta, 0, 1)
    m.matar(vet, 0, 1)
    caido = [h for h in m.heridos.values() if h.hoja]
    assert len(caido) == 1 and caido[0].hoja[1] == 2
    # los camilleros van primero por el veterano
    U.avanzar(m, 4)
    objetivos = {m.ent[c].objetivo for c in hosp.camilleros}
    assert caido[0].id in objetivos
    vuelto = None
    for _ in range(60 * S):
        m.paso()
        for _d, ev in m.eventos:
            if ev[0] == "recuperado" and m.ent[ev[2]].grado:
                vuelto = m.ent[ev[2]]
                vida_al_volver = vuelto.vida
    assert vuelto is not None
    assert (vuelto.xp, vuelto.grado, vuelto.nombre, vuelto.abatidos) == hoja
    assert vuelto.st is j.stats_de("infante", 2) and vida_al_volver == vuelto.st.vida // 2
    assert any(v["nombre"] == hoja[2] and v["grado"] == 2 for v in m.veteranos_de(0))
    # Convalecencia: aguanta 60 s y vuelve con el 75 %; Servicio sanitario: un quinto equipo
    j.aplicar_mejora(m.cat.mejoras["convalecencia"])
    j.aplicar_mejora(m.cat.mejoras["ambulancias"])
    m.refrescar_stats(j)
    U.avanzar(m, 35 * S)
    assert len(hosp.camilleros) == 5
    otro = vuelto
    m.matar(otro, 0, 1)
    h = next(h for h in m.heridos.values() if h.hoja)
    assert h.hasta - m.tick == 60 * S
    vuelto = None
    for _ in range(60 * S):
        m.paso()
        for _d, ev in m.eventos:
            if ev[0] == "recuperado" and m.ent[ev[2]].grado:
                vuelto = m.ent[ev[2]]
                vida_al_volver = vuelto.vida
    assert vuelto is not None and vida_al_volver == vuelto.st.vida * 75 // 100
    # un veterano que se desangra lejos del hospital queda en el libro de los caídos
    lejos = _unidad(m, 0, "granadero", 190, 30)
    _abatir(m, _unidad(m, 1, "infante", 192, 30), lejos)
    assert lejos.grado == 0                    # un infante no basta: el granadero vale más
    _abatir(m, _unidad(m, 1, "granadero", 192, 32), lejos)
    assert lejos.grado == 1
    m.matar(lejos, 0, 1)
    assert any(h.tipo.id == "granadero" for h in m.heridos.values())   # la caballería también cae herida
    U.avanzar(m, 65 * S)
    assert j.est["veteranos_caidos"] == 1
    assert [c["tipo"] for c in m.caidos_de(0)] == ["granadero"]


def _muro(d, x=32, hasta=56):
    """Un muro de roca de norte a sur, con paso solo al fondo del mapa."""
    filas = [list(f) for f in d["terreno"]]
    for y in range(hasta):
        filas[y][x] = "#"
    d["terreno"] = ["".join(f) for f in filas]


def test_camino_por_tramos_rodea_un_muro(monkeypatch):
    """Si la búsqueda agota su presupuesto (hay mucho tráfico o el rodeo es largo), el camino es
    solo un tramo: al terminarlo la unidad pide el siguiente y sigue hasta la meta."""
    from salitre.sim import mundo as mod_mundo
    monkeypatch.setattr(mod_mundo, "PRESUPUESTO_RUTAS", 300)       # cada búsqueda llega a 500 nodos
    m = U.mundo(mapa=U.mapa_llano(64, 64, extra=_muro))
    u = _unidad(m, 0, "infante", 20, 10)
    m.comando(0, {"c": "mover", "u": [u.id], "x": U.px(44 * TILE + TILE // 2), "y": U.px(10 * TILE + TILE // 2)})
    for _ in range(150 * S):
        m.paso()
        if (u.x // TILE, u.y // TILE) == (44, 10):
            break
    assert (u.x // TILE, u.y // TILE) == (44, 10)


def test_camilleros_rodean_el_muro_y_no_abandonan_al_herido(monkeypatch):
    from salitre.sim import mundo as mod_mundo
    monkeypatch.setattr(mod_mundo, "PRESUPUESTO_RUTAS", 300)
    m = U.mundo(mapa=U.mapa_llano(64, 64, extra=_muro))
    j = m.jugadores[0]
    m.crear_edificio(0, "hospital_campana", 14, 20, construido=True)
    U.avanzar(m, 14 * S)
    caido = _unidad(m, 0, "infante", 44, 12)
    m.matar(caido, 0, 1)
    h = next(iter(m.heridos.values()))
    h.hasta = m.tick + 200 * S              # que aguante el rodeo: aquí importa que no lo abandonen
    recogido = False
    for _ in range(190 * S):
        m.paso()
        assert h.camillero >= 0             # nunca se lo da por perdido
        if any(ev[0] == "recogido" and ev[1] == h.id for _d, ev in m.eventos):
            recogido = True
            break
    assert recogido
    for _ in range(150 * S):
        m.paso()
        if j.est["heridos_recuperados"]:
            break
    assert j.est["heridos_recuperados"] == 1


def test_camilleros_de_otra_isla_no_le_quitan_el_herido_a_los_que_pueden_llegar():
    def estrecho(d):
        filas = [list(f) for f in d["terreno"]]
        for f in filas:
            for x in range(30, 34):
                f[x] = "~"
        d["terreno"] = ["".join(f) for f in filas]
    m = U.mundo(mapa=U.mapa_llano(64, 64, extra=estrecho))
    izq = m.crear_edificio(0, "hospital_campana", 10, 20, construido=True)
    der = m.crear_edificio(0, "hospital_campana", 40, 20, construido=True)
    U.avanzar(m, 14 * S)
    caido = _unidad(m, 0, "infante", 28, 24)       # en la isla de la izquierda, junto al estrecho
    m.matar(caido, 0, 1)
    h = next(iter(m.heridos.values()))
    cerca = min((c for c in U.de(m, 0, "camilleros")), key=lambda c: (c.x - h.x) ** 2 + (c.y - h.y) ** 2)
    assert cerca.base_id == der.id                 # en línea recta, el más cercano es de la otra isla
    U.avanzar(m, 8)
    assert m.ent[h.camillero].base_id == izq.id
    assert not any(c.objetivo == h.id for c in U.de(m, 0, "camilleros") if c.base_id == der.id)
    for _ in range(40 * S):
        m.paso()
        if any(ev[0] == "recogido" and ev[1] == h.id for _d, ev in m.eventos):
            break
    assert not h.vivo and h.id not in m.heridos


def test_camilleros_esperan_sin_buscar_camino_si_su_lugar_esta_ocupado():
    m = U.mundo()
    hosp = m.crear_edificio(0, "hospital_campana", 14, 20, construido=True)
    m.crear_edificio(0, "deposito", 13, 23, construido=True)     # tapa la fila de la puerta
    pedidos = []
    original = m.pedir_ruta

    def contar(u, x, y):
        if u.tipo.autonomo:
            pedidos.append(m.tick)
        return original(u, x, y)
    m.pedir_ruta = contar
    U.avanzar(m, 20 * S)
    assert len(hosp.camilleros) == 4
    antes = len(pedidos)
    U.avanzar(m, 10 * S)
    assert len(pedidos) - antes <= 2          # ya están en su lugar (o lo más cerca que se puede)


def test_ambulancia_monta_y_desmonta_el_hospital_de_sangre():
    from salitre.red import instantanea as I
    m = U.mundo(mapa=U.mapa_llano(ancho=200))
    j = m.jugadores[0]
    m.comando(0, {"c": "truco", "revelar": 1})
    hosp = m.crear_edificio(0, "hospital_campana", 14, 20, construido=True)
    U.avanzar(m, 14 * S)
    assert len(hosp.camilleros) == 4
    # el hospital de campaña forma la ambulancia
    j.dinero = j.agua = 1000
    for k in range(2):
        m.crear_edificio(0, "deposito", 20 + k * 3, 14, construido=True)
    assert j.pob_max == 30
    m.comando(0, {"c": "entrenar", "e": [hosp.id], "t": "ambulancia"})
    U.avanzar(m, 31 * S)
    formada = U.de(m, 0, "ambulancia")
    assert len(formada) == 1
    m.matar(formada[0], 0, 1)                   # el carro no cae herido: muere
    U.avanzar(m, 1)
    assert not m.heridos
    amb = _unidad(m, 0, "ambulancia", 100, 30)
    amb.vida = amb.st.vida // 2
    pob = j.pob_usada
    # los trabajadores no levantan el hospital de sangre: solo la ambulancia
    trab = _unidad(m, 0, "trabajador", 98, 34)
    pob += 1
    m.comando(0, {"c": "construir", "u": [trab.id], "e": "hospital_sangre", "tx": 102, "ty": 32})
    U.avanzar(m, 1)
    assert trab.orden is None
    m.comando(0, {"c": "construir", "u": [trab.id, amb.id], "e": "hospital_sangre", "tx": 102, "ty": 32})
    U.avanzar(m, 1)
    assert trab.orden is None and amb.orden is not None
    obra = None
    for _ in range(20 * S):
        m.paso()
        obra = obra or next(iter(U.de(m, 0, "hospital_sangre")), None)
        if obra is not None and obra.construido:
            break
    assert obra is not None and obra.construido and not amb.vivo
    U.avanzar(m, 1)
    assert amb.id not in m.ent and obra.vida == obra.st.vida // 2        # el carro queda en el hospital
    assert j.pob_usada == pob and j.tiene("hospital_sangre")
    U.avanzar(m, 6 * S)
    assert len(obra.camilleros) == 2
    # el que cae junto al hospital de sangre lo recogen sus camilleros y se cura ahí mismo
    caido = _unidad(m, 0, "infante", 106, 36)
    pob += 1
    m.matar(caido, 0, 1)
    pob -= 1
    U.avanzar(m, 8)
    h = next(iter(m.heridos.values()))
    assert m.ent[h.camillero].base_id == obra.id
    for _ in range(15 * S):
        m.paso()
        if obra.pacientes:
            break
    assert len(obra.pacientes) == 1 and not hosp.pacientes
    reg = I.registro(m, obra, True, m.tick)
    assert reg[8]["cm"] == 2 and reg[8]["ce"] == 2 and len(reg[8]["pc"]) == 1
    # desmontar: en 6 s vuelve a ser ambulancia, con el convaleciente en el carro
    m.comando(0, {"c": "habilidad", "u": [obra.id], "h": "desmontar_hospital"})
    U.avanzar(m, 1)
    assert obra.desmontando > 0
    assert I.registro(m, obra, True, m.tick)[7] & I.F_DESMONTA
    U.avanzar(m, 6 * S + 1)
    assert not obra.vivo and not j.tiene("hospital_sangre")
    nueva = U.de(m, 0, "ambulancia")
    assert len(nueva) == 1
    amb = nueva[0]
    assert amb.vida == amb.st.vida // 2 and len(amb.pacientes) == 1
    assert not U.de(m, 0, "camilleros") or all(c.base_id != obra.id for c in U.de(m, 0, "camilleros"))
    assert j.pob_usada == pob
    assert len(I.registro(m, amb, True, m.tick)[8]["pc"]) == 1
    # el convaleciente vuelve a filas junto al carro
    vuelto = None
    for _ in range(25 * S):
        m.paso()
        for _d, ev in m.eventos:
            if ev[0] == "recuperado" and ev[1] == amb.id:
                vuelto = m.ent[ev[2]]
        if vuelto is not None:
            break
    assert vuelto is not None and vuelto.tipo.id == "infante" and not amb.pacientes
    assert (vuelto.x - amb.x) ** 2 + (vuelto.y - amb.y) ** 2 < (3 * TILE) ** 2
    assert j.pob_usada == pob + 1
    # si cae el carro, los veteranos que se curaban en él van al libro de los caídos
    amb.pacientes.append(["infante", 10 * S, (900, 2, 4321, "", 1, 3)])
    assert any(v["nombre"] == 4321 for v in m.veteranos_de(0))
    m.matar(amb, 0, 1)
    U.avanzar(m, 1)
    assert any(c["nombre"] == 4321 for c in m.caidos_de(0))


def test_obra_del_hospital_de_sangre_solo_la_ambulancia():
    m = U.mundo()
    j = m.jugadores[0]
    m.comando(0, {"c": "truco", "revelar": 1})
    U.avanzar(m, 1)
    amb = _unidad(m, 0, "ambulancia", 30, 30)
    trab = _unidad(m, 0, "trabajador", 34, 34)
    m.comando(0, {"c": "construir", "u": [amb.id], "e": "hospital_sangre", "tx": 31, "ty": 32})
    for _ in range(10 * S):
        m.paso()
        if U.de(m, 0, "hospital_sangre"):
            break
    U.avanzar(m, 2 * S)
    obra = U.de(m, 0, "hospital_sangre")[0]
    assert not obra.construido and obra.constructor == amb.id
    # se interrumpe el montaje: el trabajador no puede seguirlo, la ambulancia sí
    m.comando(0, {"c": "detener", "u": [amb.id]})
    m.comando(0, {"c": "inteligente", "u": [trab.id], "t": obra.id, "x": obra.x // 16, "y": obra.y // 16})
    m.comando(0, {"c": "reparar", "u": [trab.id], "t": obra.id})
    U.avanzar(m, 1)
    assert trab.orden is None or trab.orden.obj != obra.id
    avance = obra.progreso
    U.avanzar(m, 2 * S)
    assert obra.progreso == avance
    m.comando(0, {"c": "inteligente", "u": [amb.id], "t": obra.id, "x": obra.x // 16, "y": obra.y // 16})
    eventos = []
    for _ in range(10 * S):
        m.paso()
        eventos += [ev for _d, ev in m.eventos]
        if obra.construido:
            break
    assert obra.construido and not amb.vivo
    assert any(ev[0] == "monta" and ev[1] == amb.id and ev[2] == obra.id for ev in eventos)
    # cancelar la obra de un hospital de sangre no devuelve nada (no costó nada)
    assert j.stats["hospital_sangre"].costo == (0, 0)


def test_instruccion_encuadramiento_y_repliegue():
    m = U.mundo()
    j = m.jugadores[0]
    m.crear_edificio(0, "barracon_instruccion", 14, 20, construido=True)
    j.aplicar_mejora(m.cat.mejoras["ejercicios_tiro"])
    cerca = _unidad(m, 0, "infante", 16, 23)
    lejos = _unidad(m, 0, "infante", 40, 40)
    U.avanzar(m, 55 * S)
    # la instrucción lleva al recluta hasta Fogueado y no más allá
    assert cerca.grado == 1 and lejos.grado == 0 and lejos.xp == 0
    xp = cerca.xp
    U.avanzar(m, 20 * S)
    assert cerca.xp == xp
    # el recluta junto a un Aguerrido de su arma aprende un 50 % más rápido
    sargento = _unidad(m, 0, "infante", 30, 30)
    from salitre.sim import veterania
    veterania.aplicar_hoja(m, sargento, (0, 3, 12345, "", 2, 9))
    recluta = _unidad(m, 0, "infante", 31, 30)
    U.avanzar(m, 8)
    assert recluta.aura.get("experiencia_pct") == 50
    _abatir(m, _unidad(m, 1, "infante", 33, 30), recluta)
    assert recluta.xp == 50 * 16 * 150 // 100
    # repliegue sanitario: sin hospital, aviso; con hospital, los heridos van a curarse
    sargento.vida = 10
    m.comando(0, {"c": "replegar", "u": [sargento.id]})
    U.avanzar(m, 1)
    assert any(ev[0] == "err" for _d, ev in m.eventos)
    hosp = m.crear_edificio(0, "hospital_campana", 20, 34, construido=True)
    m.comando(0, {"c": "replegar", "u": [sargento.id, recluta.id]})
    U.avanzar(m, 1)
    assert sargento.orden is not None and recluta.orden is None     # solo los heridos
    U.avanzar(m, 25 * S)
    assert (sargento.x - hosp.x) ** 2 + (sargento.y - hosp.y) ** 2 < (5 * TILE) ** 2
    assert sargento.vida > 10


def test_veteranos_llegan_con_el_cuartel():
    from salitre.sim.mundo import Mundo
    veteranos = [{"tipo": "infante", "grado": 2, "xp": 160 * 16, "nombre": 777, "ficha": "c1-3",
                  "batallas": 1, "bajas": 4},
                 {"tipo": "granadero", "grado": 1, "xp": 230 * 16, "nombre": 778, "ficha": "c1-4",
                  "batallas": 1, "bajas": 1},
                 {"tipo": "zapador", "grado": 1, "xp": 0, "nombre": 779, "ficha": "c1-5"}]   # no es de Perú
    configs = [{"nombre": "A", "faccion": "chile", "equipo": 0, "posicion": 0, "veteranos": veteranos[:2]},
               {"nombre": "B", "faccion": "peru", "equipo": 1, "posicion": 1, "veteranos": veteranos[2:]}]
    m = Mundo(U.cat(), U.mapa_llano(), configs, semilla=3)
    llegados = [u for u in m.unidades.values() if u.ficha]
    assert sorted((u.tipo.id, u.grado, u.nombre, u.ficha, u.abatidos) for u in llegados) == [
        ("granadero", 1, 778, "c1-4", 1), ("infante", 2, 777, "c1-3", 4)]
    assert all(u.vida == u.st.vida for u in llegados)
    assert m.jugadores[0].pob_usada == 6 + 1 + 5
    # al terminar se informa la hoja de cada veterano vivo
    fichas = {v["ficha"]: v for v in m.veteranos_de(0)}
    assert fichas["c1-3"]["grado"] == 2 and fichas["c1-3"]["bajas"] == 4


def test_el_vencido_se_retira_con_sus_veteranos():
    """El ejército vencido deja el campo: sus veteranos (también los heridos que llevan los
    camilleros o que se curan en el hospital) siguen en filas para la batalla siguiente; los
    heridos que nadie recogió quedan en el campo."""
    from salitre.sim import veterania
    m = U.mundo()
    j1 = m.jugadores[1]
    hosp = m.crear_edificio(1, "hospital_campana", 50, 20, construido=True)
    vet = _unidad(m, 1, "infante", 40, 40)
    veterania.aplicar_hoja(m, vet, (0, 2, 4242, "p1", 1, 5))
    caido = _unidad(m, 1, "infante", 44, 40)
    veterania.aplicar_hoja(m, caido, (0, 1, 4343, "p2", 1, 2))
    m.matar(caido, 0, 0)
    assert any(h.hoja and h.hoja[2] == 4343 for h in m.heridos.values())
    hosp.pacientes.append(["infante", 999, (0, 3, 4444, "p3", 2, 9)])
    perdidas = j1.est["unidades_perdidas"]
    m.comando(1, {"c": "rendirse"})
    U.avanzar(m, 2 * S)
    assert m.terminado and m.ganador == 0
    assert {v["nombre"]: v["estado"] for v in m.veteranos_de(1)} == {4242: "en retirada", 4444: "herido"}
    assert [c["nombre"] for c in m.caidos_de(1)] == [4343]
    assert not any(u.dueno == 1 for u in m.unidades.values())
    assert j1.est["unidades_perdidas"] == perdidas            # retirarse no es morir
    # si el enemigo destruye el hospital, los veteranos que se curaban en él no vuelven
    m2 = U.mundo()
    h2 = m2.crear_edificio(0, "hospital_campana", 14, 20, construido=True)
    h2.pacientes.append(["granadero", 999, (0, 2, 5555, "q1", 1, 3)])
    m2.matar(h2, 0, 1)
    assert [c["nombre"] for c in m2.caidos_de(0)] == [5555] and m2.jugadores[0].est["veteranos_caidos"] == 1


def test_llegada_del_cuartel_en_tren_y_en_carreta():
    from salitre.contenido import mapas
    from salitre.sim.mundo import LLEGADA, Mundo
    for mapa, modo in ((U.mapa_llano(), "carreta"),
                       (mapas.cargar(mapas.listar()["pampa_del_tamarugal"]), "tren")):
        configs = [{"nombre": f"J{i}", "faccion": "chile", "equipo": i, "color": i, "posicion": i}
                   for i in range(2)]
        m = Mundo(U.cat(), mapa, configs, semilla=5, llegada=True)
        assert not m.edificios and not m.unidades
        assert sorted(c.modo for c in m.convoyes.values()) == [modo, modo]
        U.avanzar(m, LLEGADA - 1)
        # mientras vienen en camino nadie pierde por no tener edificios
        assert not m.edificios and all(j.vivo for j in m.jugadores)
        U.avanzar(m, 1)
        assert len(U.de(m, 0, "cuartel_general")) == 1 and len(U.de(m, 1, "cuartel_general")) == 1
        assert len(U.de(m, 0, "trabajador")) == 6
        cg = U.de(m, 0, "cuartel_general")[0]
        assert (cg.tx, cg.ty) == tuple(mapa.inicios[0])
        U.avanzar(m, 12 * S)
        assert not m.convoyes                    # el tren o la carreta se retiraron
        assert m.jugadores[0].est["salitre_recolectado"] > 0


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
