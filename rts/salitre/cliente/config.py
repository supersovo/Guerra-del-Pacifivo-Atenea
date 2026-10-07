"""Configuración del cliente y perfil local (SQLite).

La configuración (pantalla, sonido, controles) se guarda en config.json; el
perfil local (servidores recientes y el historial de escaramuzas jugadas en
este equipo) en perfil.db, ambos en la carpeta de datos del usuario.
"""

import json
import sqlite3
import time

from .. import rutas

PREDETERMINADA = {
    "nombre": "",
    "ventana": [1280, 720],
    "pantalla_completa": False,
    "resolucion_interna": [1280, 720],
    "vsync": True,
    "volumen_efectos": 0.7,
    "velocidad_desplazamiento": 1.0,
    "desplazar_con_borde": True,
    "encerrar_raton": True,
    "barras_siempre": False,
    "sangre": True,
    "voces": True,
    "ultimo_servidor": "127.0.0.1:47800",
    "faccion": "chile",
    "mapa": "pampa_del_tamarugal",
    "dificultad": "normal",
    "mostrar_fps": False,
}


class Config:
    def __init__(self, ruta=None):
        self.ruta = ruta or rutas.ruta_config()
        self.d = dict(PREDETERMINADA)
        try:
            datos = json.loads(self.ruta.read_text(encoding="utf-8"))
            if isinstance(datos, dict):
                for k, v in datos.items():
                    if k in PREDETERMINADA and type(v) is type(PREDETERMINADA[k]):
                        self.d[k] = v
                    elif k in PREDETERMINADA and isinstance(PREDETERMINADA[k], float) and isinstance(v, int):
                        self.d[k] = float(v)
        except (OSError, json.JSONDecodeError):
            pass

    def __getitem__(self, k):
        return self.d[k]

    def __setitem__(self, k, v):
        self.d[k] = v

    def guardar(self):
        try:
            self.ruta.write_text(json.dumps(self.d, ensure_ascii=False, indent=2), encoding="utf-8")
        except OSError:
            pass


class Perfil:
    """Base de datos local del jugador."""

    def __init__(self, ruta=None):
        self.con = sqlite3.connect(str(ruta or rutas.ruta_bd_local()))
        self.con.row_factory = sqlite3.Row
        self.con.executescript("""
            CREATE TABLE IF NOT EXISTS servidores (
                direccion TEXT PRIMARY KEY, nombre TEXT, ultimo_uso REAL);
            CREATE TABLE IF NOT EXISTS escaramuzas (
                id INTEGER PRIMARY KEY, fecha REAL, mapa TEXT, faccion TEXT, rivales TEXT,
                resultado TEXT, minutos REAL, abatidos INTEGER, perdidas INTEGER);
        """)
        self.con.commit()

    def recordar_servidor(self, direccion, nombre=""):
        self.con.execute("INSERT OR REPLACE INTO servidores VALUES (?, ?, ?)", (direccion, nombre, time.time()))
        self.con.commit()

    def servidores(self, n=8):
        return [dict(r) for r in self.con.execute(
            "SELECT * FROM servidores ORDER BY ultimo_uso DESC LIMIT ?", (n,))]

    def registrar_escaramuza(self, mapa, faccion, rivales, resultado, minutos, abatidos, perdidas):
        self.con.execute("INSERT INTO escaramuzas (fecha, mapa, faccion, rivales, resultado, minutos, abatidos, "
                         "perdidas) VALUES (?,?,?,?,?,?,?,?)",
                         (time.time(), mapa, faccion, rivales, resultado, minutos, abatidos, perdidas))
        self.con.commit()

    def escaramuzas(self, n=20):
        return [dict(r) for r in self.con.execute(
            "SELECT * FROM escaramuzas ORDER BY fecha DESC LIMIT ?", (n,))]

    def resumen(self):
        r = self.con.execute("SELECT COUNT(*), SUM(resultado = 'victoria'), SUM(resultado = 'derrota') "
                             "FROM escaramuzas").fetchone()
        return {"jugadas": r[0] or 0, "victorias": r[1] or 0, "derrotas": r[2] or 0}

    def cerrar(self):
        self.con.close()
