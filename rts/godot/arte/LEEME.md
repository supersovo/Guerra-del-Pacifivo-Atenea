# Arte hecho fuera del juego

Lo que se pone en esta carpeta reemplaza, unidad por unidad, a lo que el cliente 3D
dibuja por código. Lo que falta se sigue viendo como siempre, así que se puede
agregar de a poco. El código que lo carga está en `codigo/mundo/arte.gd`.

Hasta ahora: la cantinera chilena (retrato y modelo 3D).

## Retratos (la ficha de la batalla y el Archivo histórico)

`retratos/<tipo>_<nación>.png`, o `retratos/<tipo>.png` para todas las naciones.
Por ejemplo `retratos/cantinera_chile.png`. Vertical, 4:5 (por ejemplo 400×500 px).

## Modelos 3D

`unidades/<forma>/<forma>_<nación>.glb`, o `unidades/<forma>/<forma>.glb` para todas
las naciones. Por ejemplo `unidades/cantinera/cantinera_chile.glb`. La forma es la
del catálogo (`datos/catalogo.json`, campo `forma` de cada tipo).

- glTF binario (`.glb`); alrededor de 10 000 a 15 000 triángulos y texturas de 1024 px
  (un archivo de pocos MB). Al importarlo, Godot saca las texturas que trae adentro a
  archivos `.png` junto al modelo: se suben con él.
- Los pies en el suelo; la escala y el frente se ajustan solos.
- Si trae esqueleto y animaciones (estar quieto, marchar, la acción —curar, hacer
  fuego— y caer), se usan: se reconocen por sus nombres usuales (`idle`, `walk`,
  `heal`, `fire`, `death`…); si se llaman de otra manera, un `.json` con el mismo
  nombre del modelo dice cuál es cuál.
- Si no las trae, la figura se bambolea al marchar (como un soldadito llevado de la
  mano), se inclina en la acción y cae de espaldas, como las figuras del juego.
- No hace falta pintar el color del jugador: la figura va sobre una peana de ese color
  (más ancha si el modelo pisa ancho, como una falda).
- Los materiales quedan casi mates: una pintura ya trae su luz, y el reflejo del sol
  del juego la destiñe.

El `.json` (todo optativo):

```json
{
  "animaciones": {"quieto": "Idle", "marcha": "Walking", "accion": "Giving", "muerte": "Dying"},
  "alto": 1.04,
  "giro": 90,
  "marcha": 1.0,
  "brillo": 0.15
}
```

- `alto`: alto de la figura en casillas (por omisión, el de la figura del juego).
- `giro`: grados para que mire al frente (por omisión 90, porque un glTF mira hacia +Z;
  la cantinera, que camina un poco de lado en su lámina, usa 111).
- `marcha`: casillas por segundo que avanza la animación de marchar a velocidad normal.
- `brillo`: reflejo especular de sus materiales, de 0 a 1 (por omisión 0,15).

Para revisar un modelo sin jugar:

    godot --path godot --rendering-method gl_compatibility -s res://pruebas/vitrina.gd -- \
        --faccion=chile --vista=tropas --enfocar=cantinera --salida=/tmp/cantinera.png

## Modelos sin color

Si la herramienta que convierte la imagen en 3D entrega solo la forma (sin textura),
`herramientas/pintar_modelo.py` la pinta con su lámina de referencia y la deja aquí;
la lámina, el modelo original y la receta de cada uno están en `arte_fuente/` (ver su
LEEME). Así se hizo la cantinera.

`pruebas/arte/figura_prueba.glb` es un muñeco de ejemplo para las pruebas (no va en el
juego); `pruebas/hacer_figura_prueba.gd` lo vuelve a generar.
