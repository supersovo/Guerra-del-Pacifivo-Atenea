"""Descubrimiento de partidas en la red local (UDP).

El cliente envía "SALITRE?" por difusión al puerto 47801 y cada servidor de la
red responde con su nombre, puerto y versión. Así los compañeros de una misma
sala de clases o de una misma casa se encuentran sin escribir direcciones IP.
"""

import asyncio
import json
import socket
import time

from ..red.protocolo import PUERTO_LAN

PREGUNTA = b"SALITRE?"


class RespondedorLAN(asyncio.DatagramProtocol):
    def __init__(self, servidor):
        self.srv = servidor
        self.transporte = None

    def connection_made(self, transport):
        self.transporte = transport

    def datagram_received(self, data, addr):
        if data.strip() != PREGUNTA:
            return
        info = self.srv.info_publica()
        try:
            self.transporte.sendto(json.dumps(info).encode("utf-8"), addr)
        except OSError:
            pass


async def iniciar_respondedor(servidor, puerto=PUERTO_LAN):
    loop = asyncio.get_running_loop()
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
    except OSError:
        pass
    sock.bind(("", puerto))
    transporte, _ = await loop.create_datagram_endpoint(lambda: RespondedorLAN(servidor), sock=sock)
    return transporte


def buscar(espera=1.2, puerto=PUERTO_LAN):
    """Busca servidores en la red local. Devuelve [{nombre, host, puerto, ...}]."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
    sock.settimeout(0.2)
    encontrados = {}
    for destino in ("255.255.255.255", "127.0.0.1"):
        try:
            sock.sendto(PREGUNTA, (destino, puerto))
        except OSError:
            pass
    fin = time.time() + espera
    while time.time() < fin:
        try:
            data, addr = sock.recvfrom(4096)
        except socket.timeout:
            continue
        except OSError:
            break
        try:
            info = json.loads(data.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            continue
        if not isinstance(info, dict):
            continue
        host = addr[0]
        info["host"] = host
        encontrados[(host, info.get("puerto"))] = info
    sock.close()
    return list(encontrados.values())
