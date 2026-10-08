"""Punto de entrada del ejecutable del juego (PyInstaller)."""

import multiprocessing
import sys

from salitre.__main__ import main

if __name__ == "__main__":
    multiprocessing.freeze_support()
    sys.exit(main())
