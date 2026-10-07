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
    from salitre.cliente.escenas.campana import Campana
    cuadros(app)
    for cls in (Campana, Escaramuza, Conectar, Opciones, Repeticiones, Portada):
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


def test_campana_del_salitre(app):
    """Una batalla de la campaña: el escalafón baja del tren con el cuartel general y, al
    rendirse, la derrota queda anotada y la batalla se puede repetir con los mismos veteranos."""
    from salitre.cliente.escenas.campana import Campana
    from salitre.contenido import campanas
    camp = campanas.cargar()["salitre"]
    est = campanas.nuevo_estado(camp, "chile")
    est["escalafon"] = [{"ficha": "v1", "tipo": "infante", "grado": 3, "xp": 5000, "nombre": 99, "batallas": 2,
                         "bajas": 9},
                        {"ficha": "v2", "tipo": "cazador", "grado": 1, "xp": 4000, "nombre": 98, "batallas": 1,
                         "bajas": 1}]
    cid = app.perfil.crear_campana(est)
    esc = Campana(app)
    app.cambiar(esc)
    cuadros(app)
    assert esc.cid == cid and len(esc.tabla.filas) == 2
    assert esc.tabla.filas[0][1][1].startswith("Sargento ")
    esc.marchar()
    hasta(app, lambda: escena(app) == "Juego")
    juego = app.escena
    assert juego.origen == "campana"

    def veteranos():
        return sorted((e.tipo.id, e.ex.get("v")) for e in juego.est.ents.values()
                      if e.dueno == juego.est.yo and isinstance(e.ex, dict) and e.ex.get("v"))
    hasta(app, lambda: len(veteranos()) == 2, 30)
    assert veteranos() == [("cazador", 1), ("infante", 3)]
    juego.abrir_menu()
    cuadros(app)
    juego.rendirse()
    juego.rendirse()            # la rendición se confirma pulsando otra vez
    hasta(app, lambda: juego.fin is not None, 15)
    guardado = app.perfil.campana(cid)
    assert guardado["etapa"] == 0 and guardado["historial"][-1]["victoria"] is False
    assert [v["ficha"] for v in guardado["escalafon"]] == ["v1", "v2"]
    juego._ir_resultados()
    cuadros(app)
    app.escena.volver()
    cuadros(app)
    assert escena(app) == "Campana" and app.escena.resumen is not None


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


def test_uniformes_distintos_por_arma(app):
    """Cada arma se reconoce por su uniforme: infantes, zapadores, dinamiteros y las dos
    caballerías no se dibujan iguales, y los colores propios de cada nación se aplican."""
    from salitre.cliente.graficos.sprites import Sprites
    sp = Sprites(app.lz, app.cat)
    chile = app.cat.facciones["chile"]

    def pixeles(uid, faccion=chile, vista="lado"):
        s = sp.superficie(app.cat.unidades[uid], faccion, (200, 30, 30), vista, 0)
        return s, pygame.image.tobytes(s, "RGBA")

    def distintos(a, b):
        (sa, pa), (sb, pb) = a, b
        assert sa.get_size() == sb.get_size()
        opacos = sum(1 for k in range(3, len(pa), 4) if pa[k] > 128 or pb[k] > 128)
        dif = sum(1 for k in range(0, len(pa), 4) if (pa[k + 3] > 128 or pb[k + 3] > 128)
                  and sum(abs(pa[k + c] - pb[k + c]) for c in range(4)) > 60)
        return dif / max(1, opacos)

    a_pie = {u: pixeles(u) for u in ("infante", "zapador", "ingeniero")}
    for u, v in (("infante", "zapador"), ("infante", "ingeniero"), ("zapador", "ingeniero")):
        assert distintos(a_pie[u], a_pie[v]) > 0.25, (u, v)
    assert distintos(pixeles("granadero"), pixeles("cazador")) > 0.25
    # el morrión garance de los granaderos chilenos (reglamento de 1878)
    s, _ = pixeles("granadero")
    garance = chile.uniformes["jinete_sable"]["morrion"]
    cercanos = [(x, y) for x in range(s.get_width()) for y in range(s.get_height())
                if s.get_at((x, y))[3] > 200 and sum(abs(s.get_at((x, y))[c] - garance[c]) for c in range(3)) < 12]
    assert len(cercanos) >= 10
    # las vistas de frente y de espalda también cambian con el arma
    assert distintos(pixeles("infante", vista="frente"), pixeles("zapador", vista="frente")) > 0.25


def test_voces_de_la_tropa(app, monkeypatch):
    """Cada unidad que se forma tiene su voz, toda la tropa responde al seleccionarla y al
    recibir órdenes, las voces no se pisan y, desactivadas, vuelven los toques de corneta."""
    from salitre.cliente.escenas.juego import grupo_voz
    from salitre.cliente.juego.estado import Ent
    from salitre.cliente.sonido import sonido
    snd = sonido()
    assert snd is app.sonido
    for t in app.cat.unidades.values():
        if t.produce_en is not None:
            assert "lista_" + t.id in snd.voces, t.id
        if not t.autonomo:
            g = grupo_voz(t)
            assert "seleccion_" + g in snd.voces and "mover_" + g in snd.voces, t.id
    for clave in ("obra", "investigado", "ataque_tropas", "ataque_trabajadores", "pob", "falta_dinero",
                  "falta_agua", "llegada", "victoria", "derrota", "trabajar", "lista", "ascenso_1", "ascenso_2",
                  "ascenso_3", "replegar", "herido_veterano", "veterano_caido"):
        assert clave in snd.voces, clave
    # los efectos (la fusilería de una batalla) nunca ocupan el canal de las voces
    for _ in range(12):
        snd.reproducir("canon", 1.0, 0.0, 0)
    assert not snd.canal_voz.get_busy()
    pygame.mixer.stop()
    # una voz a la vez: la selección no corta a la anterior, el aviso sí y luego espera su turno
    assert snd.voz("seleccion_infanteria", 0)
    primera = snd.canal_voz.get_sound()
    assert primera is not None and snd.canal_voz.get_busy()
    assert snd.voz("seleccion_caballeria", 0)
    assert snd.canal_voz.get_sound() is primera
    assert snd.voz("lista_infante", 2)
    lista = snd.canal_voz.get_sound()
    assert lista is not primera
    assert snd.voz("obra", 2) and snd._pendiente is not None
    snd.canal_voz.stop()
    snd.actualizar()
    assert snd._pendiente is None and snd.canal_voz.get_sound() not in (primera, lista)
    snd.canal_voz.stop()
    app.config["voces"] = False
    assert not snd.voz("lista_infante", 2)
    app.config["voces"] = True
    # en la batalla: la unidad lista se presenta y la tropa responde a la selección y a las órdenes
    esc = Escaramuza(app)
    app.cambiar(esc)
    esc.elegir_mapa("pampa_del_tamarugal")
    esc.comenzar()
    hasta(app, lambda: escena(app) == "Juego")
    juego = app.escena
    est = juego.est
    dichas = []
    monkeypatch.setattr(snd, "voz", lambda claves, prioridad=1: dichas.append(
        ([claves] if isinstance(claves, str) else list(claves), prioridad)) or True)
    infante = app.cat.unidades["infante"]
    juego._evento([0, "lista", 4321, infante.idx])
    assert dichas[-1] == (["lista_infante", "lista"], 2)
    juego._evento([0, "err", "Falta agua"])
    assert dichas[-1] == (["falta_agua"], 2)
    juego._evento([0, "ata", 100, 100, 1])
    assert dichas[-1] == (["ataque_trabajadores"], 3)
    granadero = app.cat.unidades["granadero"]
    for i, t in ((90001, infante), (90002, granadero), (90003, granadero)):
        est.ents[i] = Ent([i, t.idx, est.yo, 300, 300, 50, 0, 0, None], t, 0.0)
    juego.seleccionar([90001, 90002, 90003])
    assert dichas[-1] == (["seleccion_caballeria"], 0)
    juego._orden_derecha(320.0, 320.0, None, False)
    assert dichas[-1] == (["mover_caballeria"], 1)
    juego.seleccionar([90001])
    juego.modo = ("orden", "atacar", "atacar")
    juego._orden_objetivo(330.0, 330.0, None, False)
    assert dichas[-1] == (["atacar_infanteria"], 1)
    # un veterano: su ficha muestra grado, nombre y experiencia; al ascender lo dice con su voz
    from salitre.contenido import nombres
    est.ents[90004] = Ent([90004, infante.idx, est.yo, 300, 300, 50, 0, 0,
                           {"v": 2, "vm": 54, "n": 4242, "x": 30, "k": 5}], infante, 0.0)
    juego.seleccionar([90004])
    cuadros(app)
    assert nombres.nombre(app.cat, est.facciones[est.yo].id, infante, 2, 4242).startswith("Cabo ")
    juego._evento([0, "ascenso", 90004, 3, infante.idx, est.yo])
    assert dichas[-1] == (["ascenso_3"], 2)
    juego._evento([0, "mue", 90004, infante.idx, est.yo, 300, 300, 0, 3, 4242])
    assert dichas[-1] == ("veterano_caido", 2) or dichas[-1] == (["veterano_caido"], 2)
    juego.abrir_menu()
    cuadros(app)
    juego.abandonar()
    cuadros(app)


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
