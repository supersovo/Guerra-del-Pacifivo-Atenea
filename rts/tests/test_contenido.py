"""Catálogo y mapas: se cargan, se validan y son coherentes."""

import json

import pytest

import utilidades as U
from salitre.contenido import catalogo as mod_cat
from salitre.contenido import mapas
from salitre.sim.constantes import TIERRA
from salitre.sim.mapa import Mapa


def test_catalogo_carga():
    cat = U.cat()
    assert len(cat.facciones) == 4
    assert set(cat.facciones) == {"chile", "peru", "bolivia", "argentina"}
    assert len(cat.huella) == 16
    for t in cat.tipos:
        assert cat.tipos[t.idx] is t


def test_poblacion_segun_reglas():
    cat = U.cat()
    u = cat.unidades
    assert u["trabajador"].poblacion == 1
    assert u["infante"].poblacion == 1
    assert u["cantinera"].poblacion == 1
    assert u["ingeniero"].poblacion == 2
    for cab in ("granadero", "cazador"):
        assert u[cab].poblacion == 5
    for art in ("artilleria_montana", "canon_campana", "gatling"):
        assert u[art].poblacion == 10
    assert cat.poblacion_maxima == 200


def test_heroes_historicos_por_nacion():
    cat = U.cat()
    nombres = {f: [cat.unidades[h].nombre for h in cat.facciones[f].heroes] for f in cat.facciones}
    assert any("Baquedano" in n for n in nombres["chile"])
    assert any("San Martín Penrose" in n for n in nombres["chile"])
    assert any("Bolognesi" in n for n in nombres["peru"])
    assert any("Abaroa" in n for n in nombres["bolivia"])
    assert any("Roca" in n for n in nombres["argentina"])
    for f in cat.facciones.values():
        assert len(f.heroes) >= 4
        for h in f.heroes:
            assert cat.unidades[h].aura_efectos, f"{h} sin aura"


def test_especiales_exclusivas():
    cat = U.cat()
    assert "zapador" in cat.facciones["chile"].unidades
    assert "zapador" not in cat.facciones["peru"].unidades
    assert "torpedista" in cat.facciones["peru"].unidades
    assert "colorado" in cat.facciones["bolivia"].unidades
    assert "baqueano" in cat.facciones["argentina"].unidades
    assert "fortin" in cat.facciones["argentina"].edificios


def test_error_de_contenido_es_claro(tmp_path):
    for nombre in mod_cat.ARCHIVOS:
        (tmp_path / nombre).write_text((U.RAIZ / "datos" / nombre).read_text(encoding="utf-8"), encoding="utf-8")
    datos = json.loads((tmp_path / "unidades.json").read_text(encoding="utf-8"))
    datos["infante"]["produce_en"] = "no_existe"
    (tmp_path / "unidades.json").write_text(json.dumps(datos), encoding="utf-8")
    with pytest.raises(mod_cat.ContenidoError, match="infante"):
        mod_cat.Catalogo(tmp_path)


@pytest.mark.parametrize("ident", sorted(mapas.listar()))
def test_mapas_oficiales(ident):
    datos = mapas.buscar(ident)
    mapa = Mapa(datos)
    assert datos.jugadores >= 2
    reg = mapa.region[TIERRA]
    regiones = set()
    for (x, y) in datos.inicios:
        i = mapa.pasable_cercana(TIERRA, x + 1, y + 4, 4)
        assert i is not None
        regiones.add(reg[i])
    if not datos.naval:
        assert len(regiones) == 1, "los inicios deben estar unidos por tierra"
    else:
        assert any(datos.terreno[y][x] == "~" for y in range(datos.alto) for x in range(datos.ancho))


def test_campana_del_salitre_y_escalafon():
    from salitre.contenido import campanas, nombres
    cat = U.cat()
    camp = campanas.cargar()["salitre"]
    assert [e.mapa for e in camp.etapas] == ["pampa_del_tamarugal", "quebrada_de_tarapaca", "alto_de_la_alianza",
                                             "morro_de_arica"]
    disponibles = set(mapas.listar())
    for e in camp.etapas:
        assert e.mapa in disponibles and e.relato
        for nac in camp.naciones:
            assert e.rival(nac) != nac and e.rival(nac) in cat.facciones
    est = campanas.nuevo_estado(camp, "chile")
    # la IA de la segunda etapa ya trae veteranos (el núcleo de la etapa)
    assert campanas.veteranos_rival(cat, camp, est, camp.etapas[0]) == []
    assert len(campanas.veteranos_rival(cat, camp, est, camp.etapas[1])) == 4
    # derrota: se repite la batalla con el mismo escalafón
    r = campanas.aplicar_batalla(cat, camp, est, {"veteranos": [{"tipo": "infante", "grado": 2}]}, None, False)
    assert not r["victoria"] and est["etapa"] == 0 and est["escalafon"] == []
    # victoria: los veteranos vivos (no los reclutas) forman el escalafón, con ficha y una batalla más
    propio = {"veteranos": [{"tipo": "infante", "grado": 2, "xp": 2400, "nombre": 11, "ficha": "", "batallas": 0,
                             "bajas": 3},
                            {"tipo": "granadero", "grado": 1, "xp": 3600, "nombre": 12, "ficha": "", "batallas": 0,
                             "bajas": 1},
                            {"tipo": "infante", "grado": 0, "xp": 100, "nombre": 0, "ficha": ""},
                            {"tipo": "no_existe", "grado": 3}],
              "caidos": [{"tipo": "infante", "grado": 1, "nombre": 13, "ficha": ""},
                         {"tipo": "infante", "grado": 0, "nombre": 0, "ficha": ""}]}
    rival = {"veteranos": [{"tipo": "infante", "grado": 1, "nombre": 21}]}
    r = campanas.aplicar_batalla(cat, camp, est, propio, rival, True, 12.5)
    assert r["victoria"] and r["supervivientes"] == 2 and r["nuevos"] == 2 and r["caidos"] == 1
    assert est["etapa"] == 1 and [v["grado"] for v in est["escalafon"]] == [2, 1]
    assert all(v["ficha"] and v["batallas"] == 1 for v in est["escalafon"])
    assert r["honores"] == camp.honor_victoria + 3 + 1 == est["honores"]
    assert est["caidos"][0]["etapa"] == camp.etapas[0].nombre
    assert est["rival"]["peru"][0]["nombre"] == 21
    # en la batalla siguiente los mismos veteranos conservan su ficha
    ficha = est["escalafon"][0]["ficha"]
    vivo = dict(est["escalafon"][0], batallas=1, bajas=7)
    campanas.aplicar_batalla(cat, camp, est, {"veteranos": [vivo]}, None, True)
    assert est["escalafon"][0]["ficha"] == ficha and est["escalafon"][0]["batallas"] == 2
    assert est["escalafon"][0]["bajas"] == 7
    for _ in range(2):
        campanas.aplicar_batalla(cat, camp, est, {"veteranos": []}, None, True)
    assert est["terminada"] and est["medalla"].startswith("Medalla")
    # los nombres del escalafón son estables
    tipo = cat.unidades["infante"]
    assert nombres.nombre(cat, "chile", tipo, 2, 11) == nombres.nombre(cat, "chile", tipo, 2, 11)
    assert nombres.nombre(cat, "chile", tipo, 2, 0) == ""
