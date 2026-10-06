import importlib
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
importlib.import_module("utilidades")   # prepara rutas y variables de entorno antes de cada prueba
