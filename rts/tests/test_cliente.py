"""Cliente gráfico con el controlador de video ficticio de SDL: recorre las
pantallas, juega una escaramuza contra la IA y una partida multijugador
completa (salón → sala de espera → batalla) contra un segundo jugador. También
comprueba la ventana agrandada con clics y movimientos del ratón inyectados
directamente en SDL, como los que llegan del sistema operativo."""

import ctypes
import gc
import glob
import os
import sys
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


def test_argumento_psn_de_macos(capsys):
    from salitre import VERSION
    from salitre.__main__ import main
    assert main(["-psn_0_4711", "--version"]) == 0
    assert VERSION in capsys.readouterr().out


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
    # Ctrl+número forma un grupo; en Mac también ⌘+número
    pygame.event.post(pygame.event.Event(pygame.KEYDOWN, key=pygame.K_1, mod=pygame.KMOD_LCTRL))
    pygame.event.post(pygame.event.Event(pygame.KEYDOWN, key=pygame.K_2, mod=pygame.KMOD_LGUI))
    cuadros(app, 1)
    assert juego.grupos[1] == [cg.id]
    assert (juego.grupos.get(2) == [cg.id]) == (sys.platform == "darwin")
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


# ----------------------------------------------------------------------
# Ventana agrandada o maximizada
#
# pygame.event.post no sirve aquí: sus eventos no pasan por la conversión de
# coordenadas de SDL. Se inyectan eventos nativos con la misma libSDL2 que cargó
# pygame, igual que los del sistema operativo.

SDL_MOUSEBUTTONDOWN = 0x401
SDL_MOUSEBUTTONUP = 0x402


class _SDLBoton(ctypes.Structure):
    _fields_ = [("type", ctypes.c_uint32), ("timestamp", ctypes.c_uint32), ("windowID", ctypes.c_uint32),
                ("which", ctypes.c_uint32), ("button", ctypes.c_uint8), ("state", ctypes.c_uint8),
                ("clicks", ctypes.c_uint8), ("padding1", ctypes.c_uint8),
                ("x", ctypes.c_int32), ("y", ctypes.c_int32)]


class _SDLEvento(ctypes.Union):
    _fields_ = [("button", _SDLBoton), ("relleno", ctypes.c_uint8 * 56)]


@pytest.fixture(scope="module")
def sdl():
    """La libSDL2 que usa pygame (en Linux, Windows o macOS)."""
    carpeta = os.path.dirname(pygame.__file__)
    if sys.platform == "win32":
        candidatos = [os.path.join(carpeta, "SDL2.dll")]
    elif sys.platform == "darwin":
        candidatos = glob.glob(os.path.join(carpeta, ".dylibs", "libSDL2-2*.dylib"))
    else:
        with open("/proc/self/maps", encoding="utf-8") as f:
            candidatos = sorted({ln.split()[-1] for ln in f if "/libSDL2-2" in ln and ".so" in ln})
    for ruta in candidatos:
        try:
            lib = ctypes.CDLL(ruta)
            lib.SDL_PushEvent.argtypes = [ctypes.c_void_p]
            lib.SDL_GetWindowFromID.argtypes = [ctypes.c_uint32]
            lib.SDL_GetWindowFromID.restype = ctypes.c_void_p
            lib.SDL_WarpMouseInWindow.argtypes = [ctypes.c_void_p, ctypes.c_int, ctypes.c_int]
            return lib
        except (OSError, AttributeError):
            continue
    pytest.skip("no se encontró la biblioteca SDL2 de pygame")


def clic_nativo(sdl, app, x, y):
    """Clic izquierdo en el píxel (x, y) de la ventana."""
    for tipo, estado in ((SDL_MOUSEBUTTONDOWN, 1), (SDL_MOUSEBUTTONUP, 0)):
        e = _SDLEvento()
        e.button.type = tipo
        e.button.windowID = app.lz.window.id
        e.button.button = 1
        e.button.state = estado
        e.button.clicks = 1
        e.button.x, e.button.y = x, y
        sdl.SDL_PushEvent(ctypes.byref(e))


def mover_raton(sdl, app, x, y):
    sdl.SDL_WarpMouseInWindow(sdl.SDL_GetWindowFromID(app.lz.window.id), x, y)


def en_ventana(app, x, y):
    """Píxel de la ventana donde se ve el punto lógico (x, y): la imagen se escala
    conservando la proporción y se centra (cuenta independiente de la del juego)."""
    vw, vh = app.lz.window.size
    esc = min(vw / 1280, vh / 720)
    return int((vw - 1280 * esc) / 2 + (x + 0.5) * esc), int((vh - 720 * esc) / 2 + (y + 0.5) * esc)


def boton(escena_, texto):
    return next(w for w in escena_.widgets if getattr(w, "texto", None) == texto)


@pytest.mark.parametrize("tam", [(1920, 1080), (1920, 1009), (1366, 1000), (1000, 1000)])
def test_clics_con_la_ventana_agrandada(app, sdl, tam):
    app.lz.window.size = tam
    cuadros(app)
    assert escena(app) == "Portada"
    clic_nativo(sdl, app, *en_ventana(app, *boton(app.escena, "Opciones").rect.center))
    cuadros(app)
    assert escena(app) == "Opciones"
    # un control lejos del centro, abajo a la derecha
    clic_nativo(sdl, app, *en_ventana(app, *boton(app.escena, "Guardar y volver").rect.center))
    cuadros(app)
    assert escena(app) == "Portada"
    # y el ratón apunta donde se ve
    mover_raton(sdl, app, *en_ventana(app, 100, 600))
    app.paso(1 / 30)
    assert app.ui.raton == (100, 600)


def test_imagen_centrada_y_recortes_con_franjas(app):
    lz = app.lz
    lz.window.size = (1920, 1009)
    cuadros(app)
    # un recorte (como la vista del campo de batalla) no debe correr la imagen
    lz.limpiar((0, 0, 0))
    lz.rect((0, 0, lz.W, lz.H), (40, 40, 40))
    lz.recortar(pygame.Rect(400, 200, 100, 100))
    lz.rect((0, 0, 100, 100), (255, 0, 0))
    lz.recortar(None)
    lz.rect((1180, 620, 100, 100), (0, 255, 0))
    lz.presentar()
    sup = lz.r.to_surface()
    assert sup.get_size() == (1920, 1009)
    franja = en_ventana(app, 0, 0)[0]
    assert franja > 20
    assert sup.get_at((franja // 2, 500))[:3] == (0, 0, 0)
    assert sup.get_at((1919 - franja // 2, 500))[:3] == (0, 0, 0)
    assert sup.get_at(en_ventana(app, 450, 250))[:3] == (255, 0, 0)
    assert sup.get_at(en_ventana(app, 1230, 670))[:3] == (0, 255, 0)
    assert sup.get_at(en_ventana(app, 300, 250))[:3] == (40, 40, 40)
    # la captura (F12) guarda el cuadro en la resolución lógica
    img = lz.imagen()
    assert img.get_size() == (1280, 720)
    assert img.get_at((450, 250))[:3] == (255, 0, 0)


def test_camara_con_el_borde_y_raton_encerrado(app, sdl, monkeypatch):
    lz = app.lz
    lz.window.size = (1920, 1009)
    app.config["encerrar_raton"] = True
    esc = Escaramuza(app)
    app.cambiar(esc)
    esc.elegir_mapa("pampa_del_tamarugal")
    esc.comenzar()
    hasta(app, lambda: escena(app) == "Juego" and app.escena.centrado)
    juego = app.escena
    cam = juego.cam
    cam.centrar(cam.mw / 2, cam.mh / 2)
    monkeypatch.setattr(lz, "con_foco", lambda: True)
    app.config["desplazar_con_borde"] = True
    assert lz.window.grab_mouse
    vw, vh = lz.window.size
    franja = en_ventana(app, 0, 0)[0]

    def mover(x, y):
        mover_raton(sdl, app, x, y)
        x0, y0 = cam.x, cam.y
        cuadros(app, 4)
        return cam.x - x0, cam.y - y0

    assert mover(vw // 2, vh // 2) == (0, 0)
    dx, dy = mover(0, vh // 2)
    assert dx < 0 and dy == 0
    dx, dy = mover(vw - 1, vh // 2)
    assert dx > 0 and dy == 0
    dx, dy = mover(vw // 2, 0)
    assert dx == 0 and dy < 0
    dx, dy = mover(vw // 2, vh - 1)
    assert dx == 0 and dy > 0
    # las franjas negras a los lados de la imagen también cuentan como borde
    dx, dy = mover(franja // 2, vh // 3)
    assert dx < 0 and dy == 0
    # un poco más adentro, la cámara queda quieta
    assert mover(franja + 20, vh // 3) == (0, 0)
    # con el menú abierto, quieta y con el ratón libre
    juego.abrir_menu()
    assert mover(0, vh // 2) == (0, 0)
    assert not lz.window.grab_mouse
    juego.cerrar_menu()
    cuadros(app)
    assert lz.window.grab_mouse
    app.config["encerrar_raton"] = False
    cuadros(app)
    assert not lz.window.grab_mouse
    app.config["encerrar_raton"] = True
    cuadros(app)
    juego.abandonar()
    cuadros(app)
    assert escena(app) == "Portada"
    assert not lz.window.grab_mouse
