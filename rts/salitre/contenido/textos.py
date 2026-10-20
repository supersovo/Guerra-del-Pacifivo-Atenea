"""Textos legibles a partir de los datos del catálogo (archivo histórico y documentación)."""

NOMBRES_CAMPO = {
    "danio_pct": ("daño", "%"), "armadura": ("armadura", ""), "velocidad_pct": ("velocidad", "%"),
    "ataque_vel_pct": ("cadencia de fuego", "%"), "alcance": ("alcance", " casillas"),
    "regeneracion": ("vida por segundo", ""), "inmortal": ("no puede morir", None),
    "ignora_altura": ("sin penalización por altura", None), "camuflaje": ("camuflaje", None),
    "vida_pct": ("vida", "%"), "carga_pct": ("daño de la carga", "%"), "curacion_pct": ("curación", "%"),
    "vision": ("visión", ""), "vida": ("vida", ""), "danio": ("daño", ""), "salpicadura": ("área de daño", ""),
    "energia_max": ("energía máxima", ""),
}
NOMBRES_CLASE = {"infanteria": "infantería", "caballeria": "caballería", "artilleria": "artillería",
                 "apoyo": "apoyo", "naval": "marina", "trabajador": "trabajadores", "heroe": "héroes",
                 "edificio": "edificios"}
NOMBRES_ARMA = {"fusil": "fusil", "sable": "arma blanca", "metralla": "metralla", "explosivo": "granada",
                "dinamita": "dinamita", "canon_naval": "cañón naval"}


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
    if f.armas:
        destino.append("con " + ", ".join(NOMBRES_ARMA.get(a, a) for a in f.armas))
    if f.capa == "tierra":
        destino.append("tropas de tierra")
    elif f.capa == "agua":
        destino.append("buques")
    if f.biologica:
        destino.append("soldados")
    if destino:
        txt += f" ({', '.join(destino)})"
    return txt


# ----------------------------------------------------------------------
# Archivo histórico: la cronología y las cifras de cada ficha. Las usan el archivo del
# cliente de Python y el del cliente 3D (herramientas/exportar_godot.py las vuelca), así
# las dos pantallas muestran exactamente lo mismo.

CRONOLOGIA = [
    ("14 feb 1879", "Tropas chilenas ocupan Antofagasta, tras el impuesto boliviano de diez centavos al quintal de "
                    "salitre exportado y el remate de la Compañía de Salitres."),
    ("1 mar 1879", "Bolivia declara el estado de guerra con Chile."),
    ("23 mar 1879", "Combate de Calama (puente del Topáter): cae Eduardo Abaroa."),
    ("5 abr 1879", "Chile declara la guerra al Perú y a Bolivia, aliados por el tratado secreto de 1873."),
    ("21 may 1879", "Combate naval de Iquique: Arturo Prat muere al abordar el Huáscar y la Esmeralda se hunde. "
                    "En Punta Gruesa la fragata peruana Independencia encalla persiguiendo a la Covadonga."),
    ("8 oct 1879", "Combate de Angamos: el Huáscar es capturado y muere el almirante Miguel Grau. Chile domina "
                   "el mar."),
    ("2 nov 1879", "Desembarco de Pisagua: comienza la campaña terrestre de Tarapacá."),
    ("19 nov 1879", "Batalla de San Francisco (Dolores): los aliados no logran tomar el cerro y se retiran."),
    ("27 nov 1879", "Batalla de Tarapacá: victoria peruana; muere el comandante Eleuterio Ramírez. Aun así, el "
                    "Perú pierde la provincia."),
    ("22 mar 1880", "Batalla de Los Ángeles (Moquegua)."),
    ("26 may 1880", "Batalla del Alto de la Alianza (Tacna): Baquedano derrota al ejército aliado de Campero. "
                    "Bolivia se retira de la guerra."),
    ("7 jun 1880", "Asalto y toma del Morro de Arica: mueren Bolognesi, Ugarte y More; cae el comandante "
                   "San Martín Penrose."),
    ("13 ene 1881", "Batalla de Chorrillos (San Juan)."),
    ("15 ene 1881", "Batalla de Miraflores. El 17 de enero el ejército chileno ocupa Lima."),
    ("23 jul 1881", "Tratado de límites entre Chile y la Argentina: la cordillera de los Andes como frontera."),
    ("9 jul 1882", "Combate de La Concepción: los 77 hombres de la 4ª compañía del Chacabuco mueren en la sierra "
                   "frente a las fuerzas de Cáceres."),
    ("10 jul 1883", "Batalla de Huamachuco: termina la campaña de la Breña."),
    ("20 oct 1883", "Tratado de Ancón entre Chile y el Perú: Tarapacá pasa a Chile; Tacna y Arica quedan bajo su "
                    "administración por diez años."),
    ("4 abr 1884", "Pacto de Tregua entre Chile y Bolivia: Bolivia pierde su litoral."),
]

CLASES_ARCHIVO = {"infanteria": "Infantería", "caballeria": "Caballería", "artilleria": "Artillería",
                  "apoyo": "Apoyo", "trabajador": "Trabajador", "heroe": "Héroe", "naval": "Marina",
                  "sanidad": "Sanidad", "logistica": "Logística"}


def _casillas(sub):
    from ..sim.constantes import TILE
    return sub / TILE


def _costo(costo):
    return f"$ {costo[0]}" + (f", {costo[1]} agua" if costo[1] else "")


def subtitulo_unidad(cat, tp):
    """«Infantería · solo Chile» bajo el nombre de la unidad."""
    sub = CLASES_ARCHIVO.get(tp.categoria, tp.categoria)
    if tp.faccion:
        sub += f" · solo {cat.facciones[tp.faccion].nombre}"
    return sub


def filas_unidad(cat, tp):
    """Cifras de la ficha de una unidad: [(nombre, valor)] (los valores ya como texto)."""
    from ..sim.constantes import AFP, TICKS, TILE
    filas = [("Costo", _costo(tp.costo)), ("Población", tp.poblacion), ("Tiempo", f"{tp.tiempo / TICKS:.0f} s"),
             ("Vida", tp.vida), ("Armadura", f"{tp.armadura} ({cat.nombres_armadura.get(tp.clase, tp.clase)})"),
             ("Velocidad", f"{tp.velocidad * TICKS / TILE:.1f} casillas/s"), ("Visión", f"{tp.vision:g}")]
    if tp.arma is not None:
        a = tp.arma
        filas += [("Daño", f"{a.danio} ({cat.nombres_ataque.get(a.tipo, a.tipo)})"),
                  ("Alcance", f"{_casillas(a.alcance):.1f}" + (f" (mín. {_casillas(a.alcance_min):.1f})"
                                                                if a.alcance_min else "")),
                  ("Cadencia", f"{a.enfriamiento / TICKS:.1f} s")]
        if a.cep:
            filas.append(("Dispersión", f"CEP {_casillas(a.cep):.2f} por casilla de tiro"))
    if tp.sed is not None:
        filas.append(("Cantimplora", f"{tp.sed.cantimplora // AFP} de agua"))
    if tp.estanque_cap:
        filas.append(("Pipa", f"{tp.estanque_cap // AFP} de agua, radio {_casillas(tp.estanque_radio):g}"))
    if tp.forma_filas:
        filas.append(("Formaciones", ", ".join(f.nombre for f in cat.formaciones.values())))
    if tp.observador:
        filas.append(("Observador", f"radio {_casillas(tp.observador):g}: el CEP a la mitad"))
    if tp.capacidad:
        filas.append(("Transporta", f"{tp.capacidad} plazas"))
    if tp.produce_en:
        te = cat.edificios.get(tp.produce_en)
        filas.append(("Se forma en", te.nombre if te else tp.produce_en))
    if tp.requisitos:
        filas.append(("Requiere", ", ".join(cat.edificios[r].nombre if r in cat.edificios else r
                                            for r in tp.requisitos)))
    return [(n, str(v)) for n, v in filas]


def aura_unidad(tp):
    """(título, efectos) del aura de mando de un héroe, o None."""
    if not tp.aura_efectos:
        return None
    return (f"Aura de mando (radio {_casillas(tp.aura_radio):.0f} casillas)",
            ", ".join(describir_efecto(e) for e in tp.aura_efectos))


def habilidades_unidad(cat, tp):
    """[(título, descripción)] de las habilidades de la unidad («Carga (C)»)."""
    out = []
    for hid in tp.habilidades:
        h = cat.habilidades.get(hid)
        if h is not None:
            out.append((h.nombre + (f" ({h.atajo})" if h.atajo else ""), h.descripcion))
    return out


def subtitulo_edificio(te):
    return f"Edificio de {te.ancho}×{te.alto} casillas"


def filas_edificio(cat, te):
    """Cifras de la ficha de un edificio: [(nombre, valor)] (los valores ya como texto)."""
    from ..sim.constantes import TICKS
    filas = [("Costo", _costo(te.costo)), ("Tiempo", f"{te.tiempo / TICKS:.0f} s"), ("Vida", te.vida),
             ("Armadura", te.armadura)]
    if te.poblacion:
        filas.append(("Población", f"+{te.poblacion}"))
    if te.guarnicion:
        filas.append(("Guarnición", f"{te.guarnicion} soldados"))
    if te.arma is not None:
        filas.append(("Daño", f"{te.arma.danio} a {_casillas(te.arma.alcance):.0f} casillas"))
    if te.abastece_radio:
        filas.append(("Aguada", f"radio {_casillas(te.abastece_radio):g} (tropa y pipas)"))
    if te.requisitos:
        filas.append(("Requiere", ", ".join(cat.edificios[r].nombre if r in cat.edificios else r
                                            for r in te.requisitos)))
    return [(n, str(v)) for n, v in filas]
