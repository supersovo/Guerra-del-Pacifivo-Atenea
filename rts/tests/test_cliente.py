"""Cliente gráfico con el controlador de video ficticio de SDL: recorre las
pantallas, juega una escaramuza contra la IA y una partida multijugador
completa (salón → sala de espera → batalla) contra un segundo jugador."""

import gc
import time

import pytest

import utilidades as U

pygame = pytest.importorskip("pygame")

from salitre.cliente.app import App  # noqa: E402
from salitre.cliente.escenas.archivo import PESTANAS, Archivo  # noqa: E402
from salitre.cliente.escenas.conectar import Conectar  # noqa: E402
from salitre.cliente.escenas.escaramuza import Escaramuza  # noqa: E402
from salitre.cliente.escenas.opciones import Opciones  # noqa: E402
from salitre.cliente.escenas.portada import Portada  # noqa: E402
from salitre.cliente.escenas.repeticiones import Repeticiones  # noqa: E402
from salitre.red.conexion import Conexion  # noqa: E402
from salitre.servidor.servidor import ServidorEnHilo  # noqa: E402


@pytest.fixture
def app():
    a = App(prueba=True)
    a.config["nombre"] = "Cadete"
    a.config["desplazar_con_borde"] = False
    yield a
    a.cerrar()
    gc.collect()


def cuadros(app, n=3):
    for _ in range(n):
        app.paso(1 / 30)


def hasta(app, condicion, espera=15.0):
    limite = time.monotonic() + espera
    while not condicion():
        assert time.monotonic() < limite, f"tiempo agotado en {type(app.escena).__name__}"
        app.paso(1 / 30)
        time.sleep(0.005)


def escena(app):
    return type(app.escena).__name__


def test_todas_las_pantallas(app):
    cuadros(app)
    for cls in (Escaramuza, Conectar, Opciones, Repeticiones, Portada):
        app.cambiar(cls(app))
        cuadros(app)
    arc = Archivo(app)
    app.cambiar(arc)
    for clave, _t in PESTANAS:
        arc.elegir_pestana(clave)
        for k, _texto in arc.lista.items[:3]:
            arc.elegir(k)
            cuadros(app, 1)
    for n in ("chile", "peru", "bolivia", "argentina"):
        arc.elegir_pestana("unidades")
        arc.elegir_nacion(n)
        for k, _texto in arc.lista.items:
            arc.elegir(k)
            cuadros(app, 1)


def test_escaramuza_contra_la_ia(app):
    esc = Escaramuza(app)
    app.cambiar(esc)
    esc.elegir_mapa("pampa_del_tamarugal")
    esc.comenzar()
    hasta(app, lambda: escena(app) == "Juego")
    juego = app.escena
    est = juego.est
    hasta(app, lambda: any(e.dueno == est.yo and e.es_edificio for e in est.ents.values()))
    cg = next(e for e in est.ents.values() if e.dueno == est.yo and e.es_edificio)
    # la cámara arranca sobre el cuartel general propio
    sx, sy = juego.cam.a_pantalla(cg.x, cg.y)
    assert juego.cam.vista.collidepoint(sx, sy)
    juego.seleccionar([cg.id])
    cuadros(app)
    boton = next(b for b in juego.botones if b and b.clave == "u:trabajador")
    juego.activar_boton(boton)
    srv = app.servidor_local.servidor
    partida = next(iter(srv.partidas.values()))

    def en_cola():
        b = partida.mundo.ent.get(cg.id)
        return b is not None and any(c[1] == "trabajador" for c in b.cola)

    hasta(app, en_cola, 5)
    # los trabajadores iniciales salen solos a recolectar
    hasta(app, lambda: est.recursos[0] > 100, 20)
    juego.abrir_menu()
    cuadros(app)
    juego.abandonar()
    cuadros(app)
    assert escena(app) == "Portada"


def test_multijugador_salon_sala_y_batalla(app, tmp_path):
    srv = ServidorEnHilo(host="127.0.0.1", puerto=0, ruta_bd=str(tmp_path / "srv.db"), lan=False,
                         minimo_registro=0)
    puerto = srv.iniciar()
    otro = None
    try:
        con = Conectar(app)
        app.cambiar(con)
        con.direccion.texto = f"127.0.0.1:{puerto}"
        con.conectar()
        hasta(app, lambda: escena(app) == "Lobby")
        lobby = app.escena
        lobby.abrir_crear()
        lobby.campos_crear["nombre"].texto = "Sala de prueba"
        lobby.campos_crear["mapa"].valor = "pampa_del_tamarugal"
        lobby._crear()
        hasta(app, lambda: escena(app) == "SalaEspera")
        sala = app.escena
        assert sala.anfitrion and sala.yo == 0

        # un compañero entra por la red, elige Perú y se declara listo
        otro = Conexion()
        assert otro.conectar_y_esperar("127.0.0.1", puerto)
        otro.saludar("Bolognesi", huella=U.cat().huella)
        otro.esperar("bienvenida")
        otro.enviar({"t": "salas"})
        salas = otro.esperar("lobby")["salas"]
        otro.enviar({"t": "unirse", "sala": salas[0]["id"]})
        otro.esperar("sala")
        otro.enviar({"t": "ajustar", "faccion": "peru"})
        otro.enviar({"t": "listo", "valor": True})
        otro.enviar({"t": "chat", "texto": "¡Listo para el combate!", "canal": "sala"})

        def compañero_listo():
            r = sala.sala.get("ranuras", [])
            return len(r) > 1 and r[1]["tipo"] == "humano" and r[1]["listo"] and r[1]["faccion"] == "peru"

        hasta(app, compañero_listo)
        hasta(app, lambda: any(t == "¡Listo para el combate!" for _d, t, _c in app.chat_salon))
        sala.ajustar(0, equipo=1)
        sala.iniciar()
        hasta(app, lambda: escena(app) == "Juego")
        juego = app.escena
        assert juego.origen == "multijugador" and not juego.est.espectador
        hasta(app, lambda: any(e.dueno == juego.est.yo for e in juego.est.ents.values()))
        # el compañero se rinde: victoria, parte de guerra y regreso a la sala
        otro.enviar({"t": "rendirse"})
        hasta(app, lambda: juego.fin is not None, 20)
        assert juego.fin["ganador"] == juego.est.jugadores[juego.est.yo]["equipo"]
        juego._ir_resultados()
        cuadros(app)
        assert escena(app) == "Resultados"
        hasta(app, lambda: app.en_sala, 5)
        app.escena.volver()
        cuadros(app)
        assert escena(app) == "SalaEspera"
        app.escena.salir_sala()
        hasta(app, lambda: escena(app) == "Lobby")
        app.escena.desconectar()
        assert escena(app) == "Conectar"
    finally:
        if otro is not None:
            otro.cerrar()
        app.cerrar_red()
        srv.detener()
