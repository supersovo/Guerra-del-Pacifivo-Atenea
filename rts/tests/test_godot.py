"""Cliente 3D de Godot (godot/): catálogo al día, niebla igual a la del servidor, el
servidor privado que lanza y la prueba de humo de punta a punta.

Las pruebas que necesitan Godot corren solo si SALITRE_GODOT apunta al ejecutable
(la integración continua lo descarga; en un equipo propio, por ejemplo
SALITRE_GODOT=~/Godot_v4.7.2-stable_linux.x86_64 python -m pytest tests/test_godot.py).
"""

import json
import os
import random
import socket
import subprocess
import sys
import time

import pytest

from utilidades import RAIZ

sys.path.insert(0, str(RAIZ / "herramientas"))

import exportar_godot  # noqa: E402
from salitre.red import protocolo as P  # noqa: E402
from salitre.sim import vision  # noqa: E402

PROYECTO = RAIZ / "godot"
GODOT = os.environ.get("SALITRE_GODOT", "")
con_godot = pytest.mark.skipif(not GODOT, reason="SALITRE_GODOT no apunta al ejecutable de Godot")


def test_catalogo_de_godot_al_dia():
    """godot/datos/catalogo.json debe salir de los datos actuales (python herramientas/exportar_godot.py)."""
    archivo = PROYECTO / "datos" / "catalogo.json"
    assert archivo.read_text(encoding="utf-8") == exportar_godot.exportar(), \
        "El catálogo de Godot está desfasado: corra python herramientas/exportar_godot.py"


def test_catalogo_de_godot_en_el_orden_de_la_red():
    from salitre import PROTOCOLO, VERSION
    from salitre.contenido import catalogo as mod_cat
    cat = mod_cat.cargar()
    datos = json.loads(exportar_godot.exportar(cat))
    assert [t["id"] for t in datos["tipos"]] == [t.id for t in cat.tipos]
    assert datos["huella"] == cat.huella
    assert (datos["protocolo"], datos["version"]) == (PROTOCOLO, VERSION)


def _puerto_libre():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _esperar_puerto(puerto, segundos=20):
    fin = time.monotonic() + segundos
    while time.monotonic() < fin:
        try:
            with socket.create_connection(("127.0.0.1", puerto), timeout=0.5):
                return True
        except OSError:
            time.sleep(0.2)
    return False


def test_servidor_local_se_cierra_con_el_juego(tmp_path):
    """--local escucha solo en este equipo y --padre lo cierra cuando termina el juego."""
    padre = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(120)"])
    puerto = _puerto_libre()
    env = dict(os.environ, SALITRE_DATOS_USUARIO=str(tmp_path), PYTHONPATH=str(RAIZ))
    srv = subprocess.Popen([sys.executable, "-m", "salitre", "--servidor", "--local", "--puerto", str(puerto),
                            "--padre", str(padre.pid)], cwd=RAIZ, env=env,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        assert _esperar_puerto(puerto), "el servidor privado no abrió su puerto"
        # saluda como lo hace el cliente de Godot
        with socket.create_connection(("127.0.0.1", puerto), timeout=5) as s:
            from salitre import PROTOCOLO, VERSION
            from salitre.contenido import catalogo as mod_cat
            s.sendall(P.codificar({"t": "hola", "protocolo": PROTOCOLO, "version": VERSION,
                                   "huella": mod_cat.cargar().huella, "nombre": "Godot", "clave": "",
                                   "registrar": False}))
            lector = P.Lector()
            msgs = []
            fin = time.monotonic() + 10
            while not any(m.get("t") == "bienvenida" for m in msgs) and time.monotonic() < fin:
                msgs.extend(lector.alimentar(s.recv(65536)))
            assert any(m.get("t") == "bienvenida" for m in msgs)
        assert srv.poll() is None
        padre.kill()
        padre.wait()
        srv.wait(timeout=15)
        assert srv.returncode is not None
        assert (tmp_path / "local.db").exists()
    finally:
        for p in (padre, srv):
            if p.poll() is None:
                p.kill()
                p.wait()


# ----------------------------------------------------------------------
# Con Godot

def _godot(args, env_extra=None, timeout=240):
    env = dict(os.environ)
    env.update(env_extra or {})
    return subprocess.run([GODOT, "--headless", "--path", str(PROYECTO)] + args, capture_output=True, text=True,
                          timeout=timeout, env=env, encoding="utf-8", errors="replace")


@pytest.fixture(scope="module")
def importado():
    """Importa el proyecto una vez (crea godot/.godot con los recursos importados)."""
    r = _godot(["--import"], timeout=300)
    assert (PROYECTO / ".godot").exists(), r.stdout + r.stderr


@con_godot
def test_pruebas_del_cliente_de_godot(importado):
    r = _godot(["-s", "res://pruebas/correr.gd"])
    salida = r.stdout + r.stderr
    assert r.returncode == 0, salida[-4000:]
    assert " 0 fallas" in salida


@con_godot
def test_niebla_de_godot_igual_a_la_del_servidor(importado, tmp_path):
    """El cliente calcula la niebla con las mismas reglas que la simulación (sim/vision.py)."""
    from salitre.contenido.mapas import MapaDatos
    from salitre.sim.mapa import Mapa
    rnd = random.Random(1879)
    w, h = 40, 28
    alturas = []
    for y in range(h):
        fila = ""
        for x in range(w):
            fila += "2" if (x - 28) ** 2 + (y - 8) ** 2 < 40 else ("1" if x > 18 or y > 20 else "0")
        alturas.append(fila)
    datos = {"id": "niebla", "nombre": "Niebla", "ancho": w, "alto": h, "jugadores": 2,
             "inicios": [[2, 2], [30, 20]], "recursos": [], "terreno": ["." * w for _ in range(h)], "altura": alturas}
    mapa = Mapa(MapaDatos(datos))
    observadores = []
    for _ in range(12):
        tx, ty = rnd.randrange(w), rnd.randrange(h)
        observadores.append((tx, ty, rnd.choice([3, 4.5, 6, 7.5, 9]), mapa.nivel[ty * w + tx]))
    esperado = list(vision.calcular(mapa, observadores))
    entrada = tmp_path / "caso.json"
    salida = tmp_path / "salida.json"
    entrada.write_text(json.dumps({"w": w, "h": h, "niveles": list(mapa.nivel), "observadores": observadores}))
    r = _godot(["-s", "res://pruebas/correr.gd", "--", f"--vision={entrada}", f"--salida={salida}"])
    assert r.returncode == 0, r.stdout + r.stderr
    obtenido = json.loads(salida.read_text())
    assert obtenido == esperado


@con_godot
def test_prueba_de_humo_del_cliente_de_godot(importado, tmp_path):
    """Menú, servidor privado, partida rápida contra la IA, órdenes, formar, cancelar y construir."""
    r = _godot(["--", "--prueba-humo", "--mapa=pampa_del_tamarugal"],
               {"SALITRE_PYTHON": sys.executable, "SALITRE_DATOS_USUARIO": str(tmp_path)})
    salida = r.stdout + r.stderr
    assert "PRUEBA_HUMO: OK" in salida, salida[-6000:]
    assert r.returncode == 0, salida[-6000:]
    for paso in ("trabajadores marcharon", "el cuartel forma un trabajador", "formación cancelada", "la obra comenzó"):
        assert paso in salida, paso
    # al salir del juego no queda el servidor privado corriendo
    assert "servidor privado en el puerto" in salida
    puerto = int(salida.split("servidor privado en el puerto ")[1].split()[0])
    time.sleep(3)
    with pytest.raises(OSError):
        socket.create_connection(("127.0.0.1", puerto), timeout=1).close()
