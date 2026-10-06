"""Red: dos jugadores reales por TCP contra el servidor, de la sala al final."""

import time

import pytest

import utilidades as U
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
    # instantáneas: cada uno ve sus trabajadores y no los del rival (niebla)
    vistos_a = {}
    insts = []
    fin = time.time() + 3
    while time.time() < fin:
        for m in a.recibir():
            if m["t"] == "inst":
                insts.append(m)
                for r in m.get("e", []):
                    vistos_a[r[0]] = r
        b.recibir()
        time.sleep(0.02)
    assert insts and insts[0].get("completa")
    duenos = {r[2] for r in vistos_a.values() if r[1] >= 0}
    assert duenos == {0}
    cg = [r for r in vistos_a.values() if r[1] == U.cat().edificios["cuartel_general"].idx][0]
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
