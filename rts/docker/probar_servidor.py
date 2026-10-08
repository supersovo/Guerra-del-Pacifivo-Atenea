"""Comprueba que un servidor de Salitre y Pólvora responde al saludo.

Lo usa la integración continua con la imagen Docker; sirve también para
verificar a mano un servidor dedicado:

    python docker/probar_servidor.py [host] [puerto] [segundos]
"""

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from salitre.contenido import catalogo  # noqa: E402
from salitre.red.conexion import Conexion  # noqa: E402


def main():
    host = sys.argv[1] if len(sys.argv) > 1 else "127.0.0.1"
    puerto = int(sys.argv[2]) if len(sys.argv) > 2 else 47800
    limite = time.monotonic() + (float(sys.argv[3]) if len(sys.argv) > 3 else 60.0)
    huella = catalogo.cargar().huella
    ultimo = None
    # El puerto que publica Docker acepta conexiones antes de que el servidor del
    # contenedor escuche, y las corta enseguida: se reintenta el saludo completo.
    while time.monotonic() < limite:
        c = Conexion()
        try:
            if c.conectar_y_esperar(host, puerto, 2.0):
                c.saludar("Prueba", huella=huella)
                b = c.esperar("bienvenida", 5.0)
                print(f"Conectado a «{b['servidor']}» (versión {b['version']}, {len(b['mapas'])} mapas)")
                return 0
            ultimo = c.error
        except (ConnectionError, TimeoutError, RuntimeError) as e:
            ultimo = e
        finally:
            c.cerrar()
        time.sleep(1.0)
    print(f"El servidor {host}:{puerto} no responde: {ultimo}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
