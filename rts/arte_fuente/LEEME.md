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
