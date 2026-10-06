"""Textos legibles a partir de los datos del catálogo (archivo histórico y documentación)."""

NOMBRES_CAMPO = {
    "danio_pct": ("daño", "%"), "armadura": ("armadura", ""), "velocidad_pct": ("velocidad", "%"),
    "ataque_vel_pct": ("cadencia de fuego", "%"), "alcance": ("alcance", " casillas"),
    "regeneracion": ("vida por segundo", ""), "inmortal": ("no puede morir", None),
    "ignora_altura": ("sin penalización por altura", None), "camuflaje": ("camuflaje", None),
}
NOMBRES_CLASE = {"infanteria": "infantería", "caballeria": "caballería", "artilleria": "artillería",
                 "apoyo": "apoyo", "naval": "marina", "trabajador": "trabajadores", "heroe": "héroes",
                 "edificio": "edificios"}


def describir_efecto(e):
    """Texto legible de un efecto de aura o habilidad: «+15% de daño (tropas de tierra)»."""
    nombre, unidad = NOMBRES_CAMPO.get(e.campo, (e.campo.replace("_", " "), ""))
    if unidad is None:
        txt = nombre
    else:
        v = e.suma
        v = int(v) if float(v).is_integer() else v
        signo = "+" if v >= 0 else ""
        txt = f"{signo}{v}% de {nombre}" if unidad == "%" else f"{signo}{v} de {nombre}"
    f = e.filtro
    destino = []
    for grupo in (f.clases, f.categorias):
        if grupo:
            destino += [NOMBRES_CLASE.get(c, c) for c in grupo]
    if f.capa == "tierra":
        destino.append("tropas de tierra")
    elif f.capa == "agua":
        destino.append("buques")
    if f.biologica:
        destino.append("soldados")
    if destino:
        txt += f" ({', '.join(destino)})"
    return txt
