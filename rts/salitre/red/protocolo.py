"""Protocolo de red: mensajes JSON con marco de longitud sobre TCP.

Cada mensaje viaja como 4 bytes (longitud, big-endian) + 1 byte de formato
+ contenido. Formato 1: JSON en UTF-8. Formato 2: JSON comprimido con zlib
(instantáneas y mapas). Todo mensaje es un objeto con la clave "t" (tipo).

Se evita a propósito pickle y cualquier formato ejecutable: del otro lado
puede haber cualquier programa, y el servidor valida cada campo.
"""

import json
import struct
import zlib

PUERTO = 47800
PUERTO_LAN = 47801
MAX_MENSAJE = 8 * 1024 * 1024
MAX_MENSAJE_CLIENTE = 256 * 1024   # lo que el servidor acepta de un cliente
FMT_JSON = 1
FMT_ZLIB = 2
UMBRAL_COMPRIMIR = 1024
_CAB = struct.Struct(">IB")


class ErrorProtocolo(Exception):
    pass


def codificar(msg, comprimir=None):
    datos = json.dumps(msg, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    if comprimir is None:
        comprimir = len(datos) > UMBRAL_COMPRIMIR
    if comprimir:
        datos = zlib.compress(datos, 3)
        fmt = FMT_ZLIB
    else:
        fmt = FMT_JSON
    return _CAB.pack(len(datos) + 1, fmt) + datos


def decodificar_cuerpo(fmt, cuerpo):
    if fmt == FMT_ZLIB:
        try:
            d = zlib.decompressobj()
            cuerpo = d.decompress(cuerpo, MAX_MENSAJE)
            if d.unconsumed_tail:
                raise ErrorProtocolo("mensaje comprimido demasiado grande")
        except zlib.error as e:
            raise ErrorProtocolo(f"datos comprimidos inválidos: {e}") from e
    elif fmt != FMT_JSON:
        raise ErrorProtocolo(f"formato desconocido {fmt}")
    try:
        msg = json.loads(cuerpo.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as e:
        raise ErrorProtocolo(f"JSON inválido: {e}") from e
    if not isinstance(msg, dict) or not isinstance(msg.get("t"), str):
        raise ErrorProtocolo("el mensaje debe ser un objeto con 't'")
    return msg


class Lector:
    """Arma mensajes a partir de bytes sueltos (para sockets no bloqueantes)."""

    def __init__(self, maximo=MAX_MENSAJE):
        self.buf = bytearray()
        self.maximo = maximo

    def alimentar(self, datos):
        self.buf.extend(datos)
        out = []
        while len(self.buf) >= 5:
            largo, fmt = _CAB.unpack_from(self.buf, 0)
            if largo < 1 or largo > self.maximo:
                raise ErrorProtocolo(f"largo de mensaje inválido ({largo})")
            if len(self.buf) < 4 + largo:
                break
            cuerpo = bytes(self.buf[5:4 + largo])
            del self.buf[:4 + largo]
            out.append(decodificar_cuerpo(fmt, cuerpo))
        return out


async def leer(reader, maximo=MAX_MENSAJE):
    cab = await reader.readexactly(4)
    (largo,) = struct.unpack(">I", cab)
    if largo < 1 or largo > maximo:
        raise ErrorProtocolo(f"largo de mensaje inválido ({largo})")
    cuerpo = await reader.readexactly(largo)
    return decodificar_cuerpo(cuerpo[0], cuerpo[1:])


def texto(v, maximo=200):
    """Texto seguro para nombres y mensajes de chat."""
    if not isinstance(v, str):
        return ""
    v = "".join(ch for ch in v if ch.isprintable())
    return v.strip()[:maximo]


def entero(v, defecto=0, minimo=None, maximo=None):
    try:
        v = int(v)
    except (TypeError, ValueError):
        return defecto
    if minimo is not None and v < minimo:
        v = minimo
    if maximo is not None and v > maximo:
        v = maximo
    return v
