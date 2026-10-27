"""Punto de entrada del ejecutable del servidor dedicado (PyInstaller, con consola)."""

import multiprocessing
import sys

from salitre.servidor.principal import main

if __name__ == "__main__":
    multiprocessing.freeze_support()
    sys.exit(main())
