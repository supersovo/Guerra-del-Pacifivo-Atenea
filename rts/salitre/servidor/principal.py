"""Servidor dedicado: python -m salitre --servidor [opciones]

Ejemplos:
    python -m salitre --servidor
    python -m salitre --servidor --puerto 47800 --nombre "Escuela Militar"
    python -m salitre --servidor --sin-invitados        (exige cuenta con clave)
    python -m salitre --servidor --local --puerto 47950 --padre 1234

--local es el servidor privado de las escaramuzas, la campaña y las repeticiones
de un cliente que no lo lleva adentro (el de Godot): escucha solo en este equipo,
usa la base local.db, guarda todas las repeticiones y, con --padre, se cierra
solo cuando termina el proceso del juego que lo lanzó.
"""

import argparse
import asyncio
import logging
import logging.handlers
import os
import signal
import sys

from .. import NOMBRE_JUEGO, VERSION, rutas
from ..red.protocolo import PUERTO, PUERTO_LAN


def configurar_registro(nivel=logging.INFO, archivo="servidor.log"):
    raiz = logging.getLogger("salitre")
    if raiz.handlers:
        return
    raiz.setLevel(nivel)
    fmt = logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s")
    consola = logging.StreamHandler(sys.stdout)
    consola.setFormatter(fmt)
    raiz.addHandler(consola)
    try:
        f = logging.handlers.RotatingFileHandler(rutas.dir_registros() / archivo, maxBytes=2_000_000,
                                                 backupCount=3, encoding="utf-8")
        f.setFormatter(fmt)
        raiz.addHandler(f)
    except OSError:
        pass


def proceso_vivo(pid):
    """¿Sigue corriendo el proceso pid? (para cerrarse cuando el juego que lanzó el servidor termina)"""
    if pid <= 0:
        return True
    if sys.platform.startswith("win"):
        import ctypes
        sincronizar, espera_agotada = 0x00100000, 0x102
        k32 = ctypes.windll.kernel32
        h = k32.OpenProcess(sincronizar, False, pid)
        if not h:
            return False
        try:
            return k32.WaitForSingleObject(h, 0) == espera_agotada
        finally:
            k32.CloseHandle(h)
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    return True


def main(argv=None):
    ap = argparse.ArgumentParser(prog="salitre --servidor", description=f"Servidor dedicado de {NOMBRE_JUEGO}")
    ap.add_argument("--host", default="0.0.0.0", help="dirección donde escuchar (0.0.0.0 = todas)")
    ap.add_argument("--puerto", type=int, default=PUERTO, help=f"puerto TCP (por omisión {PUERTO})")
    ap.add_argument("--nombre", default="Servidor de Salitre y Pólvora", help="nombre que ven los jugadores")
    ap.add_argument("--bd", default=None, help="ruta de la base de datos SQLite")
    ap.add_argument("--sin-invitados", action="store_true", help="exigir cuenta con clave")
    ap.add_argument("--sin-lan", action="store_true", help=f"no responder al descubrimiento en red local (UDP {PUERTO_LAN})")
    ap.add_argument("--detallado", action="store_true", help="registro detallado")
    ap.add_argument("--local", action="store_true",
                    help="servidor privado de un cliente externo (Godot): solo en este equipo, base local.db")
    ap.add_argument("--padre", type=int, default=0, help="cerrarse cuando termine este proceso (el del juego)")
    args = ap.parse_args(argv)
    configurar_registro(logging.DEBUG if args.detallado else logging.INFO)
    log = logging.getLogger("salitre.servidor")
    log.info("%s %s — datos en %s", NOMBRE_JUEGO, VERSION, rutas.dir_usuario())

    from .servidor import Servidor

    async def correr():
        if args.local:
            srv = Servidor(host="127.0.0.1", puerto=args.puerto, nombre=args.nombre, lan=False, local=True,
                           ruta_bd=args.bd or str(rutas.dir_usuario() / "local.db"), minimo_registro=0)
        else:
            srv = Servidor(host=args.host, puerto=args.puerto, ruta_bd=args.bd, nombre=args.nombre,
                           invitados=not args.sin_invitados, lan=not args.sin_lan)
        await srv.iniciar()
        detener = asyncio.Event()

        async def vigilar_padre():
            while not detener.is_set():
                if not proceso_vivo(args.padre):
                    log.info("Terminó el juego que lanzó el servidor (proceso %d): se cierra", args.padre)
                    detener.set()
                    return
                await asyncio.sleep(1.0)
        loop = asyncio.get_running_loop()
        for sig in (signal.SIGINT, signal.SIGTERM):
            try:
                loop.add_signal_handler(sig, detener.set)
            except (NotImplementedError, RuntimeError):
                pass
        print(f"Servidor listo en el puerto {srv.puerto}. Ctrl+C para detenerlo.", flush=True)
        vigia = asyncio.ensure_future(vigilar_padre()) if args.padre > 0 else None
        try:
            await detener.wait()
        finally:
            if vigia is not None:
                vigia.cancel()
            await srv.cerrar()

    try:
        asyncio.run(correr())
    except KeyboardInterrupt:
        pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
