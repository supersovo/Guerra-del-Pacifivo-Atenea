"""Punto de entrada del ejecutable de la versión clásica del juego, la de pygame (PyInstaller)."""

import multiprocessing
import sys

from salitre.__main__ import main

if __name__ == "__main__":
    multiprocessing.freeze_support()
    sys.exit(main())
