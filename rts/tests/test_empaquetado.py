"""Archivos que acompañan a los ejecutables: el ícono de la aplicación de macOS."""

import struct

from salitre import rutas

# tipo de imagen del .icns → lado en píxeles (los de pantallas Retina incluidos)
TIPOS_ICNS = {b"ic11": 32, b"ic12": 64, b"ic07": 128, b"ic13": 256, b"ic08": 256, b"ic14": 512, b"ic09": 512}


def test_icono_de_macos():
    datos = (rutas.dir_recursos() / "icono.icns").read_bytes()
    assert datos[:4] == b"icns"
    assert struct.unpack(">I", datos[4:8])[0] == len(datos)
    p = 8
    entradas = {}
    indice = None
    while p < len(datos):
        tipo, largo = datos[p:p + 4], struct.unpack(">I", datos[p + 4:p + 8])[0]
        assert largo > 8 and p + largo <= len(datos)
        if tipo == b"TOC ":
            cuerpo = datos[p + 8:p + largo]
            indice = [(cuerpo[i:i + 4], struct.unpack(">I", cuerpo[i + 4:i + 8])[0]) for i in range(0, len(cuerpo), 8)]
        else:
            png = datos[p + 8:p + largo]
            assert png[:8] == b"\x89PNG\r\n\x1a\n", tipo
            entradas[tipo] = (largo, struct.unpack(">II", png[16:24]))
        p += largo
    assert {t: lado for t, (_, (lado, _alto)) in entradas.items()} == TIPOS_ICNS
    assert all(ancho == alto for _, (ancho, alto) in entradas.values())
    assert indice == [(t, largo) for t, (largo, _) in entradas.items()]
