"""Multijugador: conectarse a un servidor (red local, Internet) o crear uno.

- "Buscar en la red local": encuentra los servidores de la misma red (UDP).
- "Crear servidor en este equipo": arranca un servidor abierto a la red; los
  compañeros se conectan con la dirección IP que se muestra (o por una VPN
  como ZeroTier/Tailscale/Radmin si están en casas distintas).
"""

import socket
import threading

import pygame

from ...red.conexion import Conexion
from ...red.protocolo import PUERTO
from ...servidor import descubrimiento
from .. import fuentes
from ..graficos import paleta as P
from ..ui.widgets import Boton, Campo, Casilla, Lista
from .base import Escena, FondoMenu, titulo_panel


def ips_locales():
    ips = set()
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ips.add(s.getsockname()[0])
        s.close()
    except OSError:
        pass
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ip = info[4][0]
            if not ip.startswith("127."):
                ips.add(ip)
    except OSError:
        pass
    return sorted(ips)


class BusquedaLAN:
    """Búsqueda de servidores en segundo plano. El hilo solo toca este objeto, nunca la
    escena: si la retuviera, sus texturas podrían liberarse después de cerrar pygame."""

    def __init__(self):
        self.encontrados = []
        self.activa = False
        self.nueva = False

    def iniciar(self):
        if self.activa:
            return
        self.activa = True
        threading.Thread(target=self._tarea, name="busqueda-lan", daemon=True).start()

    def _tarea(self):
        try:
            self.encontrados = descubrimiento.buscar(1.2)
        except OSError:
            self.encontrados = []
        self.activa = False
        self.nueva = True


class Conectar(Escena):
    def __init__(self, app):
        super().__init__(app)
        lz = self.lz
        self.fondo = FondoMenu(lz)
        cfg = app.config
        self.p = pygame.Rect(lz.W // 2 - 420, 140, 840, 540)
        x = self.p.x + 30
        y = self.p.y + 80
        self.nombre = Campo((x + 170, y, 260, 32), cfg["nombre"], maximo=20, pista="su nombre de campaña")
        self.clave = Campo((x + 170, y + 44, 260, 32), "", oculto=True, maximo=60, pista="(opcional)")
        self.registrar = Casilla((x + 170, y + 84, 260, 30), "Crear una cuenta nueva con esta clave")
        self.direccion = Campo((x + 170, y + 130, 260, 32), cfg["ultimo_servidor"], maximo=80,
                               al_enter=self.conectar)
        self.lista = Lista((self.p.x + 480, y, 330, 250), [], self._elegir, lambda c: self.conectar())
        self.widgets += [self.nombre, self.clave, self.registrar, self.direccion, self.lista]
        self.widgets.append(Boton((x, y + 186, 200, 42), "Conectar", self.conectar, "principal"))
        self.widgets.append(Boton((x + 210, y + 186, 220, 42), "Buscar en la red local", self.buscar))
        self.widgets.append(Boton((x, y + 250, 430, 42), "Crear servidor en este equipo", self.crear_servidor,
                                  "madera", tooltip=("Crear servidor",
                                                     "Abre un servidor en su equipo (puerto 47800) y se conecta a él. "
                                                     "Sus compañeros de la misma red lo verán al buscar; desde "
                                                     "Internet necesitan su IP pública con el puerto abierto, "
                                                     "o una VPN como ZeroTier o Tailscale.")))
        self.widgets.append(Boton((self.p.x + 30, self.p.bottom - 60, 160, 42), "Volver", self.volver, "madera"))
        self.encontrados = []
        self.busqueda = BusquedaLAN()
        self.estado = None
        self.recientes = app.perfil.servidores()
        self._refrescar_lista()
        self.buscar()

    def _refrescar_lista(self):
        items = []
        for info in self.encontrados:
            dire = f"{info['host']}:{info.get('puerto', PUERTO)}"
            items.append((dire, f"{info.get('nombre', '?')}  ({info.get('jugadores', 0)} conectados)", P.ROJO_SELLO))
        for r in self.recientes:
            if r["direccion"] not in [i[0] for i in items]:
                items.append((r["direccion"], f"{r['direccion']}  {r.get('nombre') or ''}"))
        self.lista.poner(items)

    def _elegir(self, clave):
        self.direccion.texto = clave

    def buscar(self):
        self.busqueda.iniciar()

    def volver(self):
        from .portada import Portada
        self.app.cambiar(Portada(self.app))

    def crear_servidor(self):
        try:
            puerto = self.app.iniciar_servidor_local(publico=True, puerto=PUERTO)
        except OSError as e:
            self.app.avisar(f"No se pudo abrir el puerto {PUERTO}: {e}. ¿Ya hay un servidor abierto?")
            return
        self.direccion.texto = f"127.0.0.1:{puerto}"
        ips = ", ".join(ips_locales()) or "?"
        self.app.avisar(f"Servidor abierto. Sus compañeros deben conectarse a {ips} (puerto {puerto}).", 12)
        self.app.servidor_publico_ips = ips
        self.conectar()

    def conectar(self):
        nombre = self.nombre.texto.strip()
        if len(nombre) < 3:
            self.app.avisar("Escriba un nombre de al menos 3 letras.")
            return
        dire = self.direccion.texto.strip()
        host, _, puerto = dire.partition(":")
        try:
            puerto = int(puerto) if puerto else PUERTO
        except ValueError:
            self.app.avisar("La dirección debe ser del tipo 192.168.1.10:47800")
            return
        self.app.config["nombre"] = nombre
        self.app.config["ultimo_servidor"] = f"{host}:{puerto}"
        self.app.config.guardar()
        red = Conexion()
        red.conectar(host, puerto)
        self.app.red = red
        self.estado = ("conectando", nombre, self.clave.texto, self.registrar.valor, f"{host}:{puerto}")

    def actualizar(self, dt):
        super().actualizar(dt)
        if self.busqueda.nueva:
            self.busqueda.nueva = False
            self.encontrados = self.busqueda.encontrados
            self._refrescar_lista()
        if self.estado is None or self.app.red is None:
            return
        red = self.app.red
        fase = self.estado[0]
        if fase == "conectando":
            if red.estado == "conectado":
                red.saludar(self.estado[1], self.estado[2], self.estado[3], self.app.cat.huella)
                self.estado = ("saludando",) + self.estado[1:]
            elif red.estado == "error":
                self.app.avisar(red.error, 10)
                self.app.cerrar_red()
                self.estado = None
            return
        for m in red.recibir():
            t = m.get("t")
            if t == "bienvenida":
                self.app.bienvenida = m
                self.app.perfil.recordar_servidor(self.estado[4], m.get("servidor", ""))
                from .lobby import Lobby
                self.app.cambiar(Lobby(self.app))
                return
            if t == "error":
                self.app.avisar(m.get("msg", "Error"), 10)
                self.app.cerrar_red()
                self.estado = None
                return
            if t == "inicio":
                from .juego import Juego
                self.app.cambiar(Juego(self.app, m, "multijugador"))
                return
        if red.estado == "error":
            self.app.avisar(red.error, 10)
            self.app.cerrar_red()
            self.estado = None

    def manejar(self, ev):
        if ev.type == pygame.KEYDOWN and ev.key == pygame.K_ESCAPE:
            self.volver()
            return True
        return super().manejar(ev)

    def dibujar(self):
        lz = self.lz
        self.fondo.dibujar(self.t)
        self.ui.estilo.panel(self.p)
        titulo_panel(lz, "Multijugador en línea", self.p)
        x = self.p.x + 30
        y = self.p.y + 80
        f = fuentes.negrita(17)
        lz.texto("Nombre", x, y + 6, f, P.TINTA)
        lz.texto("Clave", x, y + 50, f, P.TINTA)
        lz.texto("Servidor", x, y + 136, f, P.TINTA)
        lz.texto("Servidores encontrados y recientes", self.p.x + 480, y - 26, f, P.TINTA)
        if self.busqueda.activa:
            lz.texto("Buscando en la red local...", self.p.x + 480, y + 256, fuentes.cursiva(15), P.TINTA_SUAVE)
        ayuda = ("Sin clave se entra como invitado. Con una cuenta (clave) el servidor guarda sus victorias y su "
                 "puesto en el escalafón. Para jugar desde casas distintas, uno crea el servidor y abre el puerto "
                 "47800 (TCP) en su router, o todos se unen a una red privada virtual (ZeroTier, Tailscale o "
                 "Radmin VPN) y usan la IP de esa red.")
        lz.parrafo(ayuda, x, y + 310, self.p.w - 60, fuentes.cuerpo(15), P.TINTA_SUAVE)
        if self.estado is not None:
            lz.texto("Conectando...", self.p.right - 40, self.p.bottom - 50, fuentes.negrita(18), P.ROJO_SELLO, "der")
        self.dibujar_widgets()
