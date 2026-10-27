# Fuentes del arte

Lo que se usó para hacer el arte del cliente 3D (`godot/arte/`), para poder rehacerlo.
No va en el juego.

## cantinera/

- `lamina.webp`: la lámina de referencia (la figura de frente, tres vistas pequeñas, el
  retrato y el ícono). De ella sale también `godot/arte/retratos/cantinera_chile.png`.
- `modelo_hi3d.glb`: lo que entregó Hi3D a partir de la lámina: la forma sin color, y una
  figura por cada vista (la grande y cuatro pequeñas).
- `pintura.json`: la receta para `herramientas/pintar_modelo.py`, que separa la figura
  grande, la aligera, la pinta proyectando la vista de frente y la de espaldas y envuelve
  el barril (que Hi3D hizo mucho más grande que el dibujado) con el barril de la lámina:

      pip install numpy pillow scipy trimesh fast-simplification xatlas
      python herramientas/pintar_modelo.py arte_fuente/cantinera/pintura.json

  Escribe `godot/arte/unidades/cantinera/cantinera_chile.glb` y su `.jpg`.

### Medidas de la receta

- Vistas: `punto` es un píxel de la lámina dentro de la figura de esa vista (la mancha
  opaca que lo contiene es su silueta); `rumbo`, desde dónde mira la cámara (0: de frente,
  desde +Z; 180: de espaldas); `corte`, la fila desde la que hay sombra pintada en el suelo;
  `alzadas`, los grados desde arriba que se prueban; `umbral`, cuánto tiene que mirar a la
  cámara una cara para pintarla desde esa vista.
- `envolver`: piezas que se envuelven con un rectángulo de la lámina alrededor de un eje
  vertical (caja y eje en las coordenadas del modelo de Hi3D; el rectángulo, en píxeles).

## infante/

- `lamina.webp`: la lámina del infante de línea (el del quepí «6»), de frente.
- `modelo_hi3d_rig.glb`: lo que entregó Hi3D con su esqueleto («rig»): una sola figura de
  500 000 triángulos, con un esqueleto humano de 37 huesos (cadera, columna, pecho, cuello,
  cabeza, brazos con dedos y piernas) y sus pesos, sin color ni animaciones.
- `receta.json`: la receta para `herramientas/armar_modelo.py`, que necesita Blender como
  módulo de Python (pide Python 3.11):

      uv venv --python 3.11 blender && uv pip install --python blender bpy scipy pillow
      blender/bin/python herramientas/armar_modelo.py arte_fuente/infante/receta.json

  Aligera la figura a 10 000 triángulos conservando el esqueleto y los pesos, la pinta con
  la vista de frente de la lámina, pasa el pantalón celeste al rojo del reglamento chileno
  («recolorear»), envuelve las piernas con la pierna de adelante de la lámina siguiendo sus
  huesos («piernas»: Hi3D las abrió distinto del dibujo) y le hace las animaciones de la
  infantería: quieto (en guardia), marcha (las piernas alternadas, el fusil firme), fuego
  (el culatazo) y muerte (cae de espaldas). Escribe `godot/arte/unidades/infante/
  infante_chile.glb`, su `.jpg` y su `.json` (el paso de la marcha).
