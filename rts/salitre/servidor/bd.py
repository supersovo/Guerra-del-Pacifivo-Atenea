"""Base de datos del servidor (SQLite): cuentas, partidas, estadísticas y escalafón.

El archivo vive en la carpeta de datos del usuario (servidor.db). El esquema
lleva número de versión (PRAGMA user_version) para poder migrarlo en el futuro.
Las claves se guardan con PBKDF2-HMAC-SHA256 y sal aleatoria: nunca en claro.
"""

import functools
import hashlib
import hmac
import os
import sqlite3
import threading
import time
from pathlib import Path

VERSION_ESQUEMA = 1
ITERACIONES = 120_000
ELO_INICIAL = 1200
K_ELO = 32

ESQUEMA = """
CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY,
    nombre TEXT NOT NULL UNIQUE COLLATE NOCASE,
    clave_hash TEXT NOT NULL,
    sal TEXT NOT NULL,
    creado REAL NOT NULL,
    ultimo_ingreso REAL,
    elo INTEGER NOT NULL DEFAULT 1200,
    partidas INTEGER NOT NULL DEFAULT 0,
    victorias INTEGER NOT NULL DEFAULT 0,
    derrotas INTEGER NOT NULL DEFAULT 0,
    abatidos INTEGER NOT NULL DEFAULT 0,
    faccion_favorita TEXT
);
CREATE TABLE IF NOT EXISTS partidas (
    id INTEGER PRIMARY KEY,
    mapa TEXT NOT NULL,
    inicio REAL NOT NULL,
    fin REAL,
    ticks INTEGER,
    semilla INTEGER,
    version TEXT,
    ganador_equipo INTEGER,
    clasificatoria INTEGER NOT NULL DEFAULT 0,
    repeticion TEXT
);
CREATE TABLE IF NOT EXISTS partida_jugadores (
    partida_id INTEGER NOT NULL REFERENCES partidas(id) ON DELETE CASCADE,
    indice INTEGER NOT NULL,
    usuario_id INTEGER REFERENCES usuarios(id),
    nombre TEXT NOT NULL,
    faccion TEXT NOT NULL,
    equipo INTEGER NOT NULL,
    es_ia INTEGER NOT NULL DEFAULT 0,
    resultado TEXT,
    unidades_creadas INTEGER, unidades_perdidas INTEGER, enemigos_abatidos INTEGER,
    edificios_construidos INTEGER, edificios_perdidos INTEGER, edificios_destruidos INTEGER,
    salitre_recolectado INTEGER, agua_recolectada INTEGER,
    elo_antes INTEGER, elo_despues INTEGER,
    PRIMARY KEY (partida_id, indice)
);
CREATE INDEX IF NOT EXISTS idx_pj_usuario ON partida_jugadores(usuario_id);
CREATE TABLE IF NOT EXISTS configuracion (clave TEXT PRIMARY KEY, valor TEXT);
"""


def _bloqueo(f):
    """Serializa el acceso a la conexión (puede usarse desde hilos auxiliares)."""
    @functools.wraps(f)
    def envuelta(self, *a, **k):
        with self._lock:
            return f(self, *a, **k)
    return envuelta


def hash_clave(clave, sal=None):
    if sal is None:
        sal = os.urandom(16).hex()
    h = hashlib.pbkdf2_hmac("sha256", clave.encode("utf-8"), bytes.fromhex(sal), ITERACIONES)
    return h.hex(), sal


class BaseDatos:
    def __init__(self, ruta):
        self._lock = threading.RLock()
        self.ruta = str(ruta)
        if self.ruta != ":memory:":
            Path(self.ruta).parent.mkdir(parents=True, exist_ok=True)
        self.con = sqlite3.connect(self.ruta, check_same_thread=False)
        self.con.row_factory = sqlite3.Row
        self.con.execute("PRAGMA foreign_keys = ON")
        if self.ruta != ":memory:":
            self.con.execute("PRAGMA journal_mode = WAL")
        self.con.executescript(ESQUEMA)
        v = self.con.execute("PRAGMA user_version").fetchone()[0]
        if v < VERSION_ESQUEMA:
            self.con.execute(f"PRAGMA user_version = {VERSION_ESQUEMA}")
        self.con.commit()

    @_bloqueo
    def cerrar(self):
        self.con.close()

    # -- cuentas ---------------------------------------------------------
    @_bloqueo
    def usuario(self, nombre):
        r = self.con.execute("SELECT * FROM usuarios WHERE nombre = ?", (nombre,)).fetchone()
        return dict(r) if r else None

    @_bloqueo
    def usuario_id(self, uid):
        r = self.con.execute("SELECT * FROM usuarios WHERE id = ?", (uid,)).fetchone()
        return dict(r) if r else None

    @_bloqueo
    def crear_usuario(self, nombre, clave):
        h, sal = hash_clave(clave)
        try:
            cur = self.con.execute(
                "INSERT INTO usuarios (nombre, clave_hash, sal, creado, elo) VALUES (?, ?, ?, ?, ?)",
                (nombre, h, sal, time.time(), ELO_INICIAL))
        except sqlite3.IntegrityError:
            return None
        self.con.commit()
        return self.usuario_id(cur.lastrowid)

    @_bloqueo
    def verificar(self, nombre, clave):
        u = self.usuario(nombre)
        if u is None:
            return None
        h, _ = hash_clave(clave, u["sal"])
        if not hmac.compare_digest(h, u["clave_hash"]):
            return None
        self.con.execute("UPDATE usuarios SET ultimo_ingreso = ? WHERE id = ?", (time.time(), u["id"]))
        self.con.commit()
        return u

    @_bloqueo
    def cambiar_clave(self, uid, nueva):
        h, sal = hash_clave(nueva)
        self.con.execute("UPDATE usuarios SET clave_hash = ?, sal = ? WHERE id = ?", (h, sal, uid))
        self.con.commit()

    # -- partidas ----------------------------------------------------------
    @_bloqueo
    def registrar_partida(self, mapa, inicio, fin, ticks, semilla, version, ganador_equipo,
                          jugadores, repeticion=None):
        """jugadores: lista de dicts con indice, usuario_id, nombre, faccion, equipo, es_ia, est."""
        humanos_equipos = {j["equipo"] for j in jugadores if j.get("usuario_id") and not j.get("es_ia")}
        clasificatoria = 1 if len(humanos_equipos) >= 2 and ganador_equipo is not None else 0
        cur = self.con.execute(
            "INSERT INTO partidas (mapa, inicio, fin, ticks, semilla, version, ganador_equipo, "
            "clasificatoria, repeticion) VALUES (?,?,?,?,?,?,?,?,?)",
            (mapa, inicio, fin, ticks, semilla, version, ganador_equipo, clasificatoria, repeticion))
        pid = cur.lastrowid
        elos = {}
        if clasificatoria:
            elos = self._nuevos_elo(jugadores, ganador_equipo)
        for j in jugadores:
            est = j.get("est", {})
            if ganador_equipo is None:
                res = "tablas"
            else:
                res = "victoria" if j["equipo"] == ganador_equipo else "derrota"
            uid = j.get("usuario_id")
            antes = despues = None
            if uid:
                u = self.usuario_id(uid)
                antes = u["elo"] if u else None
                despues = elos.get(uid, antes)
                self.con.execute(
                    "UPDATE usuarios SET partidas = partidas + 1, victorias = victorias + ?, "
                    "derrotas = derrotas + ?, abatidos = abatidos + ?, elo = ?, faccion_favorita = ? WHERE id = ?",
                    (1 if res == "victoria" else 0, 1 if res == "derrota" else 0,
                     int(est.get("enemigos_abatidos", 0)), despues, j["faccion"], uid))
            self.con.execute(
                "INSERT INTO partida_jugadores VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (pid, j["indice"], uid, j["nombre"], j["faccion"], j["equipo"], 1 if j.get("es_ia") else 0, res,
                 est.get("unidades_creadas"), est.get("unidades_perdidas"), est.get("enemigos_abatidos"),
                 est.get("edificios_construidos"), est.get("edificios_perdidos"),
                 est.get("edificios_destruidos"), est.get("salitre_recolectado"),
                 est.get("agua_recolectada"), antes, despues))
        self.con.commit()
        return pid

    def _nuevos_elo(self, jugadores, ganador):
        humanos = [j for j in jugadores if j.get("usuario_id") and not j.get("es_ia")]
        actuales = {}
        for j in humanos:
            u = self.usuario_id(j["usuario_id"])
            actuales[j["usuario_id"]] = u["elo"] if u else ELO_INICIAL
        equipos = {}
        for j in humanos:
            equipos.setdefault(j["equipo"], []).append(actuales[j["usuario_id"]])
        media = {e: sum(v) / len(v) for e, v in equipos.items()}
        out = {}
        for j in humanos:
            e = j["equipo"]
            rivales = [media[o] for o in media if o != e]
            if not rivales:
                continue
            rival = sum(rivales) / len(rivales)
            esperado = 1 / (1 + 10 ** ((rival - media[e]) / 400))
            puntaje = 1.0 if e == ganador else 0.0
            out[j["usuario_id"]] = int(round(actuales[j["usuario_id"]] + K_ELO * (puntaje - esperado)))
        return out

    @_bloqueo
    def escalafon(self, n=20):
        filas = self.con.execute(
            "SELECT nombre, elo, partidas, victorias, derrotas, abatidos, faccion_favorita FROM usuarios "
            "ORDER BY elo DESC, victorias DESC, nombre LIMIT ?", (n,)).fetchall()
        return [dict(f) for f in filas]

    @_bloqueo
    def historial(self, uid, n=20):
        filas = self.con.execute(
            "SELECT p.id, p.mapa, p.inicio, p.ticks, p.clasificatoria, pj.faccion, pj.resultado, "
            "pj.enemigos_abatidos, pj.unidades_perdidas, pj.elo_antes, pj.elo_despues, p.repeticion "
            "FROM partida_jugadores pj JOIN partidas p ON p.id = pj.partida_id "
            "WHERE pj.usuario_id = ? ORDER BY p.inicio DESC LIMIT ?", (uid, n)).fetchall()
        return [dict(f) for f in filas]

    @_bloqueo
    def partida(self, pid):
        p = self.con.execute("SELECT * FROM partidas WHERE id = ?", (pid,)).fetchone()
        if p is None:
            return None
        d = dict(p)
        d["jugadores"] = [dict(f) for f in self.con.execute(
            "SELECT * FROM partida_jugadores WHERE partida_id = ? ORDER BY indice", (pid,))]
        return d

    @_bloqueo
    def config(self, clave, defecto=None):
        r = self.con.execute("SELECT valor FROM configuracion WHERE clave = ?", (clave,)).fetchone()
        return r[0] if r else defecto

    @_bloqueo
    def fijar_config(self, clave, valor):
        self.con.execute("INSERT OR REPLACE INTO configuracion VALUES (?, ?)", (clave, str(valor)))
        self.con.commit()
