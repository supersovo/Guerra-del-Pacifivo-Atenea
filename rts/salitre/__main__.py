"""Punto de entrada: python -m salitre [--servidor ...]

Sin argumentos abre el juego. Con --servidor arranca el servidor dedicado
(no necesita pygame ni pantalla).
"""

import multiprocessing
import sys


def main(argv=None):
    argv = list(sys.argv[1:] if argv is None else argv)
    if "--servidor" in argv:
        argv.remove("--servidor")
        from .servidor.principal import main as servidor
        return servidor(argv)
    from .cliente.app import main as cliente
    return cliente(argv)


if __name__ == "__main__":
    multiprocessing.freeze_support()
    sys.exit(main())
