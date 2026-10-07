"""Red: dos jugadores reales por TCP contra el servidor, de la sala al final."""

import time

import pytest

import utilidades as U
from salitre.red import instantanea as I
from salitre.red import protocolo as P
from salitre.red.conexion import Conexion
from salitre.servidor.bd import BaseDatos
from salitre.servidor.servidor import ServidorEnHilo


@pytest.fixture
def servidor(tmp_path):
    srv = ServidorEnHilo(host="127.0.0.1", puerto=0, ruta_bd=str(tmp_path / "srv.db"), lan=False,
                         minimo_registro=0)
    puerto = srv.iniciar()
    yield srv, puerto, tmp_path / "srv.db"
    srv.detener()


def _entrar(puerto, nombre, clave="", registrar=False):
    c = Conexion()
    assert c.conectar_y_esperar("127.0.0.1", puerto)
    c.saludar(nombre, clave, registrar, U.cat().huella)
    b = c.esperar("bienvenida")
    assert b["nombre"] == nombre
    return c, b


def test_protocolo_ida_y_vuelta():
    lector = P.Lector()
    grande = {"t": "x", "datos": list(range(5000))}
    datos = P.codificar({"t": "a", "v": "ñandú"}) + P.codificar(grande)
    out = []
    for k in range(0, len(datos), 7):
        out += lector.alimentar(datos[k:k + 7])
    assert out[0] == {"t": "a", "v": "ñandú"}
    assert out[1] == grande
    with pytest.raises(P.ErrorProtocolo):
        P.Lector().alimentar(b"\xff\xff\xff\xff\x01")


def test_huella_distinta_es_rechazada(servidor):
    _srv, puerto, _ = servidor
    c = Conexion()
    assert c.conectar_y_esperar("127.0.0.1", puerto)
    c.saludar("Prat", huella="otra")
    m = c.esperar("error")
    assert "no coinciden" in m["msg"]


def test_cuentas_y_claves(servidor):
    _srv, puerto, _ = servidor
    c, b = _entrar(puerto, "Baquedano", "secreta", registrar=True)
    assert not b["invitado"] and b["usuario"]["elo"] == 1200
    c.cerrar()
    c2 = Conexion()
    c2.conectar_y_esperar("127.0.0.1", puerto)
    c2.saludar("Baquedano", "mala", huella=U.cat().huella)
    assert "incorrectos" in c2.esperar("error")["msg"]
    c3 = Conexion()
    c3.conectar_y_esperar("127.0.0.1", puerto)
    c3.saludar("baquedano", huella=U.cat().huella)     # sin clave: el nombre ya es de una cuenta
    assert "cuenta registrada" in c3.esperar("error")["msg"]


def test_partida_entre_dos_jugadores(servidor):
    srv, puerto, ruta_bd = servidor
    a, _ = _entrar(puerto, "Grau", "huascar", registrar=True)
    b, _ = _entrar(puerto, "Prat", "esmeralda", registrar=True)
    a.enviar({"t": "crear_sala", "mapa": "pampa_del_tamarugal", "nombre": "Iquique", "faccion": "peru"})
    sala = a.esperar("sala")["sala"]
    b.enviar({"t": "unirse", "sala": sala["id"]})
    b.esperar("sala")
    b.enviar({"t": "ajustar", "faccion": "chile", "equipo": 2})
    b.enviar({"t": "listo", "valor": True})
    time.sleep(0.2)
    a.enviar({"t": "iniciar"})
    ia = a.esperar("inicio", 10)
    ib = b.esperar("inicio", 10)
    assert ia["yo"] == 0 and ib["yo"] == 1
    assert ia["mapa"]["id"] == "pampa_del_tamarugal"
    # instantáneas: primero llega el tren con el cuartel general; después cada uno
    # ve su cuartel y sus trabajadores, y no los del rival (niebla)
    vistos_a = {}
    insts = []
    idx_cg = U.cat().edificios["cuartel_general"].idx
    fin = time.time() + 25
    while time.time() < fin and not any(r[1] == idx_cg for r in vistos_a.values()):
        for m in a.recibir():
            if m["t"] == "inst":
                insts.append(m)
                for r in m.get("e", []):
                    vistos_a[r[0]] = r
        b.recibir()
        time.sleep(0.02)
    assert insts and insts[0].get("completa")
    assert {r[2] for r in vistos_a.values() if r[1] == I.TIPO_CONVOY} == {0}, "el tren propio, no el del rival"
    duenos = {r[2] for r in vistos_a.values() if r[1] >= 0}
    assert duenos == {0}
    cg = [r for r in vistos_a.values() if r[1] == idx_cg][0]
    a.comando({"c": "entrenar", "e": [cg[0]], "t": "trabajador"})
    nuevo = None
    fin = time.time() + 20
    trab = U.cat().unidades["trabajador"].idx
    antes = {i for i, r in vistos_a.items() if r[1] == trab}
    while time.time() < fin and nuevo is None:
        for m in a.recibir():
            for r in m.get("e", []):
                if r[1] == trab and r[0] not in antes:
                    nuevo = r
        b.recibir()
        time.sleep(0.02)
    assert nuevo is not None, "el trabajador entrenado debe aparecer"
    # chat de partida
    b.enviar({"t": "chat", "texto": "¡Viva Chile!", "canal": "todos"})
    assert a.esperar("chat")["texto"] == "¡Viva Chile!"
    # Prat se rinde: gana el equipo 1 (Grau)
    b.enviar({"t": "rendirse"})
    fin_a = a.esperar("fin", 15)
    assert fin_a["ganador"] == 1
    assert not fin_a["abortada"]
    bd = BaseDatos(ruta_bd)
    grau = bd.usuario("Grau")
    prat = bd.usuario("Prat")
    assert grau["victorias"] == 1 and prat["derrotas"] == 1
    assert grau["elo"] > 1200 > prat["elo"]
    assert bd.escalafon()[0]["nombre"] == "Grau"
    bd.cerrar()


def test_escaramuza_contra_ia_y_reconexion(servidor):
    _srv, puerto, _ = servidor
    a, _ = _entrar(puerto, "Bolognesi")
    a.enviar({"t": "partida_rapida", "mapa": "quebrada_de_tarapaca", "faccion": "peru",
              "rivales": [{"faccion": "chile", "dificultad": "facil", "equipo": 2}]})
    inicio = a.esperar("inicio", 10)
    assert inicio["jugadores"][1]["ia"] is True
    a.esperar("inst", 5)
    a.cerrar()
    time.sleep(0.5)
    # vuelve con el mismo nombre: recibe de nuevo el inicio y una instantánea completa
    a2, _ = _entrar(puerto, "Bolognesi")
    re_inicio = a2.esperar("inicio", 10)
    assert re_inicio["partida"] == inicio["partida"]
    m = a2.esperar("inst", 5)
    assert m.get("completa")


def test_campana_veteranos_llegan_con_el_cuartel(servidor):
    _srv, puerto, _ = servidor
    a, _ = _entrar(puerto, "Sotomayor")
    vets = [{"tipo": "infante", "grado": 3, "xp": 5000, "nombre": 99, "ficha": "v1", "batallas": 2, "bajas": 9},
            {"tipo": "granadero", "grado": 2, "xp": 9000, "nombre": 98, "ficha": "v2", "batallas": 1, "bajas": 2},
            {"tipo": "canon_campana", "grado": 7, "nombre": "malo"}]      # datos inválidos: se descartan
    a.enviar({"t": "partida_rapida", "mapa": "quebrada_de_tarapaca", "faccion": "chile", "veteranos": vets,
              "rivales": [{"faccion": "peru", "dificultad": "facil", "equipo": 2,
                           "veteranos": [{"tipo": "infante", "grado": 1, "nombre": 7}]}]})
    inicio = a.esperar("inicio", 10)
    assert inicio["yo"] == 0
    vistos = {}
    fin = time.time() + 25
    while time.time() < fin and sum(1 for r in vistos.values() if isinstance(r[8], dict) and r[8].get("v")) < 2:
        for m in a.recibir():
            if m["t"] == "inst":
                for r in m.get("e", []):
                    vistos[r[0]] = r
        time.sleep(0.02)
    veteranos = sorted((U.cat().tipos[r[1]].id, r[8]["v"], r[8]["n"]) for r in vistos.values()
                       if r[2] == 0 and isinstance(r[8], dict) and r[8].get("v"))
    assert veteranos == [("granadero", 2, 98), ("infante", 3, 99)]


def test_serie_escalafon_honores_y_ganador():
    from salitre.servidor.serie import Serie
    cat = U.cat()
    ranuras = [{"tipo": "humano", "nombre": "Grau", "faccion": "peru", "equipo": 1, "sesion": None},
               {"tipo": "ia", "nombre": "IA", "faccion": "chile", "equipo": 2, "sesion": None},
               {"tipo": "abierta", "nombre": "", "faccion": "chile", "equipo": 3}]
    s = Serie(3, ranuras)
    assert sorted(s.participantes) == [0, 1]
    nada = {"veteranos": [], "caidos": []}
    vet = {"tipo": "infante", "grado": 2, "xp": 100, "nombre": 7, "ficha": "", "batallas": 0, "bajas": 3}
    s.aplicar(cat, {0: {"veteranos": [vet], "caidos": []}, 1: {"veteranos": [], "caidos": [dict(vet, nombre=8)]}},
              1, "Pampa del Tamarugal", 10)
    g, ia = s.participantes[0], s.participantes[1]
    assert g["victorias"] == 1 and g["honores"] == 10 + 3 and len(g["escalafon"]) == 1
    assert ia["honores"] == 0 and len(ia["caidos"]) == 1 and ia["caidos"][0]["etapa"].startswith("1.ª")
    ficha = g["escalafon"][0]["ficha"]
    # el veterano que no llegó a desplegarse (la batalla terminó antes) sigue de reserva
    s.aplicar(cat, {0: nada, 1: nada}, 2, "Quebrada de Tarapacá", 1)
    assert [v["ficha"] for v in g["escalafon"]] == [ficha] and g["escalafon"][0]["batallas"] == 1
    assert not s.terminada and s.ganador is None
    s.aplicar(cat, {0: {"veteranos": [dict(g["escalafon"][0], grado=3)], "caidos": []}, 1: nada}, 2, "Alto", 5)
    assert s.terminada and s.marcador() == {1: [1, 13 + 6], 2: [2, 20]}
    assert s.ganador == 2                     # más batallas ganadas
    assert g["escalafon"][0]["ficha"] == ficha and g["escalafon"][0]["batallas"] == 2
    d = s.a_dict(cat)
    assert d["terminada"] and [p["grados"] for p in d["participantes"]] == [[0, 0, 1], [0, 0, 0]]
    # empate en victorias: deciden los honores
    s2 = Serie(2, ranuras)
    s2.aplicar(cat, {0: nada, 1: nada}, 1, "Pampa", 1)
    s2.aplicar(cat, {0: nada, 1: {"veteranos": [vet], "caidos": []}}, 2, "Quebrada", 1)
    assert s2.marcador() == {1: [1, 10], 2: [1, 13]} and s2.ganador == 2
    # el itinerario: el mapa siguiente con lugar para todos
    mapas = {"pampa_del_tamarugal": 2, "quebrada_de_tarapaca": 2, "cuatro_naciones": 4}
    assert s.proximo_mapa("pampa_del_tamarugal", mapas, 2) == "quebrada_de_tarapaca"
    assert s.proximo_mapa("quebrada_de_tarapaca", mapas, 2) == "cuatro_naciones"
    assert s.proximo_mapa("pampa_del_tamarugal", mapas, 3) == "cuatro_naciones"
    assert s.proximo_mapa("cuatro_naciones", mapas, 4) == "cuatro_naciones"


def _en_servidor(srv, f):
    """Ejecuta f(servidor) en el hilo del servidor y devuelve su resultado."""
    import threading
    hecho = threading.Event()
    res = {}

    def g():
        try:
            res["v"] = f(srv.servidor)
        finally:
            hecho.set()
    srv.loop.call_soon_threadsafe(g)
    assert hecho.wait(5)
    return res.get("v")


def _veteranos_vistos(con, dueno, cuantos, espera=30):
    vistos = {}
    fin = time.time() + espera
    while time.time() < fin:
        for m in con.recibir():
            if m["t"] == "inst":
                for r in m.get("e", []):
                    vistos[r[0]] = r
        vets = sorted((r[8]["v"], r[8]["n"]) for r in vistos.values()
                      if r[2] == dueno and isinstance(r[8], dict) and r[8].get("v"))
        if len(vets) >= cuantos:
            return vets
        time.sleep(0.02)
    return []


def test_serie_de_campana_en_red(servidor):
    """Serie de dos batallas entre dos jugadores: los veteranos pasan de una batalla a la
    siguiente, el que pierde la conexión entre batallas recupera su lugar y su escalafón,
    y gana la serie el equipo con más victorias (o, si empatan, con más honores)."""
    srv, puerto, ruta_bd = servidor
    a, _ = _entrar(puerto, "Grau", "huascar", registrar=True)
    b, _ = _entrar(puerto, "Prat", "esmeralda", registrar=True)
    a.enviar({"t": "crear_sala", "mapa": "pampa_del_tamarugal", "nombre": "Serie del Pacífico", "faccion": "peru",
              "velocidad": "muy_rapida"})
    sala = a.esperar("sala")["sala"]
    b.enviar({"t": "unirse", "sala": sala["id"]})
    b.esperar("sala")
    b.enviar({"t": "ajustar", "faccion": "chile", "equipo": 2})
    a.enviar({"t": "serie", "batallas": 2})
    fin = time.time() + 5
    while time.time() < fin and a.esperar("sala")["sala"]["modo_serie"] != 2:
        pass
    b.enviar({"t": "listo", "valor": True})
    time.sleep(0.2)
    a.enviar({"t": "iniciar"})
    a.esperar("inicio", 10)
    b.esperar("inicio", 10)
    # 1.ª batalla: Prat se rinde
    b.enviar({"t": "rendirse"})
    f1 = a.esperar("fin", 15)
    assert f1["ganador"] == 1
    serie = f1["serie"]
    assert serie["jugadas"] == 1 and not serie["terminada"] and serie["historial"][0]["ganador"] == 1
    assert {p["nombre"]: p["victorias"] for p in serie["participantes"]} == {"Grau": 1, "Prat": 0}
    s1 = a.esperar("sala", 5)["sala"]
    assert s1["estado"] == "espera" and s1["en_serie"] and s1["mapa"] == "quebrada_de_tarapaca"
    b.esperar("fin", 5)
    # el escalafón de Prat (guardado en el servidor) trae dos veteranos aguerridos
    fichas = [{"ficha": f"x{i}", "tipo": "infante", "grado": 3, "xp": 30000, "nombre": 500 + i, "batallas": 1,
               "bajas": 6} for i in range(2)]

    def dar_veteranos(servidor):
        s = next(iter(servidor.salas.values()))
        s.serie.participantes[1]["escalafon"] = [dict(f) for f in fichas]
        return s.serie.id
    sid = _en_servidor(srv, dar_veteranos)
    # Prat pierde la conexión entre batallas: su lugar lo espera
    b.cerrar()
    fin = time.time() + 5
    ausente = False
    while time.time() < fin and not ausente:
        m = a.esperar("sala", 5)
        ausente = m["sala"]["ranuras"][1]["ausente"]
    assert ausente and m["sala"]["ranuras"][1]["nombre"] == "Prat"
    a.enviar({"t": "iniciar"})
    assert "Falta Prat" in a.esperar("error", 5)["msg"]
    # nadie más puede ocupar su lugar
    c, _ = _entrar(puerto, "Cochrane")
    c.enviar({"t": "unirse", "sala": sala["id"]})
    assert "serie" in c.esperar("error", 5)["msg"]
    # vuelve con su clave: recupera el lugar, la nación, el equipo y el escalafón
    b2 = Conexion()
    assert b2.conectar_y_esperar("127.0.0.1", puerto)
    b2.saludar("Prat", "esmeralda", huella=U.cat().huella)
    b2.esperar("bienvenida")
    mb = b2.esperar("sala", 5)
    assert mb["yo"] == 1 and mb["sala"]["ranuras"][1]["faccion"] == "chile"
    assert sorted(v["nombre"] for v in mb["escalafon"]) == [500, 501]
    b2.enviar({"t": "ajustar", "faccion": "bolivia"})           # durante la serie no cambia
    b2.enviar({"t": "listo", "valor": True})
    fin = time.time() + 5
    while time.time() < fin:
        r1 = a.esperar("sala", 5)["sala"]["ranuras"][1]
        if r1["listo"]:
            break
    assert r1["listo"] and r1["faccion"] == "chile"
    # 2.ª batalla: los veteranos de Prat bajan con su cuartel general; después Grau se rinde
    a.enviar({"t": "iniciar"})
    ia = a.esperar("inicio", 10)
    b2.esperar("inicio", 10)
    assert ia["mapa"]["id"] == "quebrada_de_tarapaca"
    assert _veteranos_vistos(b2, 1, 2) == [(3, 500), (3, 501)]
    a.enviar({"t": "rendirse"})
    f2 = b2.esperar("fin", 15)
    serie = f2["serie"]
    assert serie["terminada"] and serie["jugadas"] == 2
    # una victoria cada uno: ganan los honores (Prat preservó a sus dos aguerridos)
    assert serie["marcador"] == {"1": [1, 10], "2": [1, 10 + 6 + 6]}
    assert serie["ganador"] == 2
    bd = BaseDatos(ruta_bd)
    d = bd.serie(sid)
    assert d["terminada"] == 1 and d["ganador_equipo"] == 2 and d["jugadas"] == 2
    prat = next(j for j in d["jugadores"] if j["nombre"] == "Prat")
    assert prat["usuario_id"] and prat["victorias"] == 1 and prat["honores"] == 22
    assert sorted(v["batallas"] for v in prat["escalafon"]) == [2, 2]
    bd.cerrar()
