"""Conexión del cliente con el servidor: socket TCP no bloqueante.

El juego la consulta en cada cuadro (recibir) sin detenerse nunca: así la
pantalla no se congela aunque la red tarde. La conexión inicial se hace en un
hilo aparte por la misma razón.
"""

import socket
import threading
import time

from .. import PROTOCOLO, VERSION
from . import protocolo as P


class Conexion:
    def __init__(self):
        self.sock = None
        self.lector = P.Lector()
        self.salida = bytearray()
        self.estado = "desconectado"     # desconectado | conectando | conectado | error
        self.error = None
        self.host = None
        self.puerto = None
        self._hilo = None
        self.bytes_rx = 0
        self.bytes_tx = 0
        self.latencia = None
        self._ping_t = 0.0
        self.pendientes = []

    # ------------------------------------------------------------------
    def conectar(self, host, puerto, espera=6.0):
        """Conecta en segundo plano; consulte self.estado."""
        self.cerrar()
        self.host, self.puerto = host, int(puerto)
        self.estado = "conectando"
        self.error = None

        def tarea():
            try:
                s = socket.create_connection((host, int(puerto)), timeout=espera)
                s.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
                s.setblocking(False)
                self.sock = s
                self.lector = P.Lector()
                self.estado = "conectado"
            except OSError as e:
                self.error = _explicar(e, host, puerto)
                self.estado = "error"

        self._hilo = threading.Thread(target=tarea, daemon=True)
        self._hilo.start()

    def conectar_y_esperar(self, host, puerto, espera=6.0):
        self.conectar(host, puerto, espera)
        self._hilo.join(espera + 1)
        return self.estado == "conectado"

    def saludar(self, nombre, clave="", registrar=False, huella=""):
        self.enviar({"t": "hola", "protocolo": PROTOCOLO, "version": VERSION, "huella": huella,
                     "nombre": nombre, "clave": clave, "registrar": registrar})

    def enviar(self, msg):
        if self.estado != "conectado":
            return
        datos = P.codificar(msg)
        self.salida.extend(datos)
        self.bytes_tx += len(datos)
        self._vaciar()

    def comando(self, cmd):
        self.enviar({"t": "cmd", "cmd": cmd})

    def _vaciar(self):
        while self.salida and self.sock is not None:
            try:
                n = self.sock.send(self.salida)
            except (BlockingIOError, InterruptedError):
                return
            except OSError as e:
                self._caida(e)
                return
            if n <= 0:
                return
            del self.salida[:n]

    def recibir(self):
        """Mensajes que llegaron desde la última consulta (no bloquea)."""
        out = self.pendientes
        self.pendientes = []
        if self.estado != "conectado" or self.sock is None:
            return out
        self._vaciar()
        while True:
            try:
                datos = self.sock.recv(262144)
            except (BlockingIOError, InterruptedError):
                break
            except OSError as e:
                self._caida(e)
                break
            if not datos:
                self._caida(None)
                break
            self.bytes_rx += len(datos)
            try:
                out.extend(self.lector.alimentar(datos))
            except P.ErrorProtocolo as e:
                self._caida(e)
                break
        for m in out:
            if m.get("t") == "pong" and m.get("c") == "lat":
                self.latencia = time.monotonic() - self._ping_t
        ahora = time.monotonic()
        if ahora - self._ping_t > 2.0:
            self._ping_t = ahora
            self.enviar({"t": "ping", "c": "lat"})
        return out

    def esperar(self, tipo, espera=5.0, guardar=None):
        """Espera un mensaje de cierto tipo (para pruebas y diálogos simples)."""
        fin = time.monotonic() + espera
        while time.monotonic() < fin:
            lote = self.recibir()
            for k, m in enumerate(lote):
                if guardar is not None:
                    guardar.append(m)
                if m.get("t") == tipo:
                    self.pendientes = lote[k + 1:] + self.pendientes
                    return m
                if m.get("t") == "error" and tipo != "error":
                    self.pendientes = lote[k + 1:] + self.pendientes
                    raise RuntimeError(m.get("msg"))
            if self.estado != "conectado":
                raise ConnectionError(self.error or "conexión cerrada")
            time.sleep(0.01)
        raise TimeoutError(f"no llegó '{tipo}'")

    def _caida(self, e):
        self.error = "Se perdió la conexión con el servidor" + (f" ({e})" if e else "")
        self.estado = "error"
        try:
            self.sock.close()
        except (OSError, AttributeError):
            pass
        self.sock = None

    def cerrar(self):
        if self.sock is not None:
            try:
                self._vaciar()
                self.sock.close()
            except OSError:
                pass
        self.sock = None
        self.salida = bytearray()
        if self.estado == "conectado":
            self.estado = "desconectado"


def _explicar(e, host, puerto):
    if isinstance(e, socket.timeout) or "timed out" in str(e):
        return (f"El servidor {host}:{puerto} no responde. Revise la dirección, que el servidor esté "
                f"encendido y que el puerto {puerto} esté abierto en el router o cortafuegos.")
    if isinstance(e, ConnectionRefusedError):
        return f"{host}:{puerto} rechazó la conexión: no hay un servidor del juego en ese puerto."
    if isinstance(e, socket.gaierror):
        return f"No se encontró la dirección '{host}'."
    return f"No se pudo conectar con {host}:{puerto}: {e}"
