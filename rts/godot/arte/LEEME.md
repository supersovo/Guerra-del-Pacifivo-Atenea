# Arte hecho fuera del juego

Lo que se pone en esta carpeta reemplaza, unidad por unidad, a lo que el cliente 3D
dibuja por código. Lo que falta se sigue viendo como siempre, así que se puede
agregar de a poco. El código que lo carga está en `codigo/mundo/arte.gd`.

## Retratos (la ficha de la batalla y el Archivo histórico)

`retratos/<tipo>_<nación>.png`, o `retratos/<tipo>.png` para todas las naciones.
Por ejemplo `retratos/cantinera_chile.png`. Vertical, 4:5 (por ejemplo 400×500 px).

## Modelos 3D animados

`unidades/<forma>/<forma>_<nación>.glb`, o `unidades/<forma>/<forma>.glb` para todas
las naciones. Por ejemplo `unidades/cantinera/cantinera_chile.glb`. La forma es la
del catálogo (`datos/catalogo.json`, campo `forma` de cada tipo).

- glTF binario (`.glb`) con sus texturas adentro; alrededor de 10 000 triángulos y
  texturas de 1024 px (un archivo de pocos MB).
- Los pies en el suelo; la escala y el frente se ajustan solos.
- Con esqueleto y animaciones: estar quieto, marchar, la acción (curar, hacer fuego)
  y caer. Se reconocen por sus nombres usuales (`idle`, `walk`, `heal`, `fire`,
  `death`…); si se llaman de otra manera, un `.json` con el mismo nombre del modelo
  dice cuál es cuál.
- No hace falta pintar el color del jugador: la figura va sobre una peana de ese color.

El `.json` (todo optativo):

```json
{
  "animaciones": {"quieto": "Idle", "marcha": "Walking", "accion": "Giving", "muerte": "Dying"},
  "alto": 1.04,
  "giro": 90,
  "marcha": 1.0
}
```

- `alto`: alto de la figura en casillas (por omisión, el de la figura del juego).
- `giro`: grados para que mire al frente (por omisión 90, porque un glTF mira hacia +Z).
- `marcha`: casillas por segundo que avanza la animación de marchar a velocidad normal.

`pruebas/arte/figura_prueba.glb` es un muñeco de ejemplo para las pruebas (no va en el
juego); `pruebas/hacer_figura_prueba.gd` lo vuelve a generar.
