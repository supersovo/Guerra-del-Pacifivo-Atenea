"""Genera docs/TABLAS.md a partir de los datos del juego (datos/*.json y mapas/).

Así las cifras de la documentación son siempre las que valen en el combate.
Después de tocar los datos:

    python herramientas/generar_tablas.py
"""

import json
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))

from salitre.contenido import catalogo as mod_cat  # noqa: E402
from salitre.contenido import mapas as mod_mapas  # noqa: E402
from salitre.contenido.textos import describir_efecto  # noqa: E402

NACIONES = ["chile", "peru", "bolivia", "argentina"]
CATEGORIAS = {"trabajador": "Trabajador", "infanteria": "Infantería", "apoyo": "Apoyo", "caballeria": "Caballería",
              "artilleria": "Artillería", "naval": "Marina", "heroe": "Héroe"}


def crudo(nombre):
    d = json.loads((RAIZ / "datos" / nombre).read_text(encoding="utf-8"))
    return {k: v for k, v in d.items() if not k.startswith("_")}


def costo(c):
    s, a = c.get("dinero", c.get("salitre", 0)), c.get("agua", 0)
    return f"$ {s}" + (f" / {a}" if a else "")


def decimal(v):
    """Número con coma decimal, como se escribe en español."""
    return f"{v:g}".replace(".", ",")


def y_lista(cosas):
    cosas = list(cosas)
    return ", ".join(cosas[:-1]) + " y " + cosas[-1] if len(cosas) > 1 else "".join(cosas)


def tabla(encabezados, filas):
    out = ["| " + " | ".join(encabezados) + " |", "|" + "|".join("---" for _ in encabezados) + "|"]
    for f in filas:
        out.append("| " + " | ".join(str(x).replace("|", "/") for x in f) + " |")
    return "\n".join(out)


def _agua_formaciones_artilleria(cat, t, U, E):
    """Secciones de la sed y el agua, las formaciones, la dispersión de la artillería y la cobertura."""
    ataque = cat.nombres_ataque
    partes = []
    s = t["sed"]
    calor = y_lista(f"{k} {v} %" for k, v in s["calor"].items())
    partes += ["## Agua y sed", "",
               "La infantería y la caballería en tierra (no los trabajadores ni los camilleros) gastan el agua de la "
               "cantimplora al marchar o combatir en una casilla de calor; quietas, o fuera de la pampa y el salar, "
               "no gastan.", "",
               tabla(["Parámetro", "Valor"], [
                   ("Cantimplora", f"{s['cantimplora']} de agua"),
                   ("Consumo al marchar o combatir",
                    f"{decimal(s['consumo'])} por segundo por el calor de la casilla ({calor})"),
                   ("Cuenta como combate", f"hasta {decimal(s['combate'])} s después del último disparo"),
                   ("Sin agua", f"{s['velocidad_pct']} % de velocidad y +{s['enfriamiento_pct']} % de tiempo entre "
                                "disparos"),
                   ("Golpe de calor", f"tras {s['golpe_calor']} s sin agua al sol de la pampa (en el salar, antes): "
                                      f"{decimal(s['danio_calor'])} de vida por segundo"),
                   ("Fatiga", f"con agua se repone {s['recuperacion']} veces más rápido de lo que sube en la pampa; "
                              "junto a una carreta, un molino o el Cuartel General, "
                              f"{s['recuperacion'] + s['alivio']} veces más rápido"),
                   ("A la sombra de un tamarugo", f"el consumo y la fatiga quedan en el {s['sombra_pct']} %"),
               ]), "",
               tabla(["Fuente de agua", "Radio", "Da de beber (por segundo)", "Llena las pipas (por segundo)"],
                     [(v["nombre"], decimal(v["abastece"]["radio"]), decimal(v["abastece"]["tropa"]),
                       decimal(v["abastece"]["pipa"])) for v in E.values() if v.get("abastece")]), "",
               tabla(["Carreta", "Pipa", "Radio", "Reparto a cada soldado (por segundo)"],
                     [(v["nombre"], v["estanque"]["capacidad"], decimal(v["estanque"]["radio"]),
                       decimal(v["estanque"]["reparto"])) for v in U.values() if v.get("estanque")]), ""]

    filas = []
    for k, v in t["formaciones"].items():
        if k.startswith("_") or k == "pueden":
            continue
        efectos = [f"{v[c]:+d} % de {n}" for c, n in (("cadencia_pct", "cadencia"), ("velocidad_pct", "velocidad"),
                                                       ("danio_pct", "daño")) if v.get(c)]
        por_pct = {}
        for a, pct in v.get("recibido_pct", {}).items():
            por_pct.setdefault(pct, []).append(ataque.get(a, a).lower())
        efectos += [f"{pct:+d} % del daño recibido de {y_lista(nombres)}" for pct, nombres in por_pct.items()]
        if v.get("inmune_carga"):
            efectos.append("la carga de la caballería no multiplica su daño")
        filas.append((v["nombre"], v.get("atajo", ""), "; ".join(efectos)))
    forman = y_lista(tu.nombre for tu in cat.unidades.values() if tu.forma_filas)
    partes += ["## Formaciones", "", f"Forman (tecla F): {forman}. La guarnición de una obra no forma.", "",
               tabla(["Formación", "Tecla", "Efectos"], filas), ""]

    b = t["balistica"]
    filas = [(v["nombre"], decimal(v["arma"]["cep"]), decimal(v["arma"]["alcance"]),
              decimal(round(v["arma"]["cep"] * v["arma"]["alcance"], 2)))
             for v in U.values() if (v.get("arma") or {}).get("cep")]
    observadores = y_lista(f"{tu.nombre} ({decimal(tu.observador / 512)})" for tu in cat.unidades.values()
                           if tu.observador)
    partes += ["## Artillería: dispersión y viento", "",
               "La mitad de las granadas cae dentro del error circular probable (CEP) alrededor del blanco. "
               f"CEP = CEP por casilla × distancia × (1 + {b['altura_pct']} % si tira cuesta arriba, menos con la "
               f"veteranía); con un observador propio cerca del blanco, el {b['observador_pct']} %. Observadores "
               f"(radio): {observadores}. El viento corre la granada hasta {decimal(b['viento_max'])} casillas por "
               f"casilla de vuelo con fuerza 100 y cambia cada {b['viento_cambio']} s.", "",
               tabla(["Pieza", "CEP por casilla", "Alcance", "CEP al alcance máximo"], filas), ""]

    c = t["cobertura"]
    plural = {"roca": "rocas", "tamarugo": "tamarugos"}

    def o_lista(cosas):
        return y_lista(plural.get(x, x) for x in cosas).replace(" y ", " o ")
    clases = y_lista(cat.nombres_armadura.get(x, x).lower() for x in c["clases"])
    partes += ["## Cobertura", "",
               f"La {clases} detenida junto a {o_lista(c['terrenos'])} recibe un {c['reduccion_pct']} % menos de "
               f"daño de {y_lista(ataque.get(a, a).lower() for a in c['ataques'])} (no de la artillería); junto a "
               f"{o_lista(c['sombra'])}, además, está a la sombra. En marcha pierde la cobertura.", ""]
    return partes


def main():
    cat = mod_cat.cargar()
    U, E, M, H, F = crudo("unidades.json"), crudo("edificios.json"), crudo("mejoras.json"), \
        crudo("habilidades.json"), crudo("facciones.json")
    t = json.loads((RAIZ / "datos" / "tablas.json").read_text(encoding="utf-8"))
    nombre_ed = {k: v["nombre"] for k, v in E.items()}
    partes = ["# Tablas del juego", "",
              "Generadas con `python herramientas/generar_tablas.py` a partir de `datos/` y `mapas/`.",
              "Costos en dinero ($) / agua: el salitre se vende en el Cuartel General a 1 $ por unidad. "
              "Tiempos en segundos; distancias en casillas.", ""]

    partes += ["## Economía", "", tabla(["Parámetro", "Valor"], [
        ("Población máxima por jugador", t["poblacion_maxima"]),
        ("Recursos iniciales", costo(t["recursos_iniciales"])),
        ("Trabajadores iniciales", t["trabajadores_iniciales"]),
        ("Salitre por viaje / tiempo de extracción", f"{t['carga_salitre']} / {t['tiempo_extraccion_salitre']} s"),
        ("Agua por viaje / tiempo de extracción", f"{t['carga_agua']} / {t['tiempo_extraccion_agua']} s"),
        ("Agua por viaje con el pozo agotado", t["carga_agua_agotada"]),
        ("Minas activas por jugador", t["minas_maximas"]),
        ("Penalización al disparar cuesta arriba", f"{t['fallo_por_altura']} % de fallos"),
    ]), ""]

    def fila_unidad(k, v, nombre=None):
        a = v.get("arma") or {}
        dano = f"{a['danio']} ({cat.nombres_ataque.get(a['tipo'], a['tipo'])})" if a else "—"
        alc = a.get("alcance", "—") if a else "—"
        req = ", ".join(nombre_ed.get(r, r) for r in v.get("requisitos", [])) or "—"
        return (nombre or v["nombre"], nombre_ed.get(v.get("produce_en"), "—"), costo(v.get("costo", {})),
                v.get("poblacion", 1), v.get("tiempo", "—"), v.get("vida"), v.get("armadura", 0), dano, alc,
                a.get("enfriamiento", "—") if a else "—", v.get("velocidad", "—"), req)

    enc_u = ["Unidad", "Se forma en", "Costo", "Pob.", "Tiempo", "Vida", "Arm.", "Daño", "Alcance", "Cadencia",
             "Velocidad", "Requiere"]
    comunes = json.loads((RAIZ / "datos" / "facciones.json").read_text(encoding="utf-8"))["_comunes"]["unidades"]
    partes += ["## Unidades comunes a las cuatro naciones", "",
               tabla(enc_u, [fila_unidad(k, U[k]) for k in comunes]), ""]
    especiales = [k for k, v in U.items() if v.get("faccion") and not v.get("heroe")]
    partes += ["## Unidades especiales de cada nación", "",
               tabla(["Nación"] + enc_u, [(cat.facciones[U[k]["faccion"]].nombre,) + fila_unidad(k, U[k])
                                          for k in especiales]), ""]
    for k in especiales:
        partes.append(f"- **{U[k]['nombre']}**: {U[k].get('descripcion', '')}")
    partes.append("")

    filas = []
    for n in NACIONES:
        for k in cat.facciones[n].heroes:
            tp = cat.unidades[k]
            aura = "; ".join(describir_efecto(e) for e in tp.aura_efectos) or "—"
            if tp.aura_efectos:
                aura += f" (radio {U[k]['aura']['radio']})"
            habs = "; ".join(f"{cat.habilidades[h].nombre}: {cat.habilidades[h].descripcion}"
                             for h in tp.habilidades if h in cat.habilidades) or "—"
            filas.append((tp.nombre, cat.facciones[n].nombre, costo(U[k].get("costo", {})), tp.poblacion, tp.vida,
                          aura, habs))
    partes += ["## Héroes", "", "Cada héroe es único: si cae, puede volver a formarse en el Estado Mayor "
               "(o en el muelle si es marino).", "",
               tabla(["Héroe", "Nación", "Costo", "Pob.", "Vida", "Aura de mando", "Habilidad"], filas), ""]

    filas = []
    for k, v in E.items():
        prod = ", ".join(U[u]["nombre"] for u in v.get("produce", []) if u in U and not U[u].get("heroe"))
        if any(U.get(u, {}).get("heroe") for u in v.get("produce", [])):
            prod += (", " if prod else "") + "héroes"
        filas.append((v["nombre"] + (f" ({cat.facciones[v['faccion']].nombre})" if v.get("faccion") else ""),
                      "×".join(str(x) for x in v.get("tamano", [2, 2])), costo(v.get("costo", {})),
                      v.get("tiempo"), v.get("vida"), f"+{v['poblacion']}" if v.get("poblacion") else "—",
                      prod or "—", ", ".join(nombre_ed.get(r, r) for r in v.get("requisitos", [])) or "—"))
    partes += ["## Edificios", "", tabla(["Edificio", "Tamaño", "Costo", "Tiempo", "Vida", "Población",
                                          "Forma", "Requiere"], filas), ""]
    for k, v in E.items():
        partes.append(f"- **{v['nombre']}**: {v.get('descripcion', '')}")
    partes.append("")

    filas = []
    for k, v in M.items():
        prev = M[v["previa"]]["nombre"] if v.get("previa") in M else ""
        req = ", ".join(nombre_ed.get(r, r) for r in v.get("requisitos", []))
        filas.append((v["nombre"], nombre_ed.get(v.get("edificio"), "—"), costo(v.get("costo", {})),
                      v.get("tiempo"), " y ".join(x for x in (prev, req) if x) or "—", v.get("descripcion", "")))
    partes += ["## Investigaciones", "", tabla(["Investigación", "Dónde", "Costo", "Tiempo", "Requiere",
                                                 "Efecto"], filas), ""]

    filas = []
    for k, v in H.items():
        filas.append((v["nombre"], v.get("atajo", ""), v.get("energia", "—"), v.get("enfriamiento", "—"),
                      v.get("descripcion", "")))
    partes += ["## Habilidades", "", tabla(["Habilidad", "Tecla", "Energía", "Espera", "Descripción"], filas), ""]

    filas = []
    for n in NACIONES:
        f = cat.facciones[n]
        bon = "; ".join(f"{b[0]}: {b[1].rstrip('.')}" for b in f.bonificaciones) or "—"
        esp = ", ".join(cat.unidades[u].nombre for u in f.unidades if cat.unidades[u].faccion == n
                        and not cat.unidades[u].heroe)
        esp += "".join(f", {E[e]['nombre']}" for e in F[n].get("edificios", []))
        locales = "; ".join(f"{cat.unidades[k].nombre} → {v}" for k, v in f.nombres.items()
                            if v != cat.unidades[k].nombre)
        filas.append((f.ejercito, bon, esp or "—", locales or "—"))
    partes += ["## Naciones", "", tabla(["Ejército", "Ventajas", "Propias", "Nombres locales"], filas), ""]

    clases = list(next(iter(t["multiplicadores"].values())).keys())
    filas = [(cat.nombres_ataque.get(k, k),) + tuple(f"{v[c]} %" for c in clases)
             for k, v in t["multiplicadores"].items()]
    partes += ["## Daño según el tipo de ataque y de blanco", "",
               tabla(["Ataque"] + [cat.nombres_armadura.get(c, c) for c in clases], filas), ""]

    partes += _agua_formaciones_artilleria(cat, t, U, E)

    vet = cat.veterania
    x_regen = t["veterania"]["experiencia"].get("regeneracion_tras", 10)
    filas = []
    for g in vet.grados:
        extra = []
        if g.fallo_altura_pct < 100:
            extra.append(f"conserva el {g.fallo_altura_pct} % de la falla cuesta arriba")
        if g.emplazar_pct:
            extra.append(f"la artillería se emplaza un {g.emplazar_pct} % más rápido")
        if g.regeneracion:
            extra.append(f"recupera {decimal(g.regeneracion)} de vida por segundo tras {x_regen} s sin "
                         "recibir fuego")
        bonos = "; ".join([describir_efecto(e) for e in g.efectos] + extra) or "—"
        filas.append((g.nombre, f"{g.umbral / 100:g} ×" if g.umbral else "—", g.rango, g.nivel or "—", bonos))
    x = t["veterania"]["experiencia"]
    partes += ["## Veteranía", "",
               "Experiencia necesaria en veces el costo de la unidad (dinero + agua): abatir a un enemigo da tanta "
               "experiencia como lo que costó, y herirlo, la parte proporcional. Los bonos de cada grado ya incluyen "
               "los del anterior (no se suman). Los héroes, los trabajadores y los camilleros no tienen grados.", "",
               tabla(["Grado", "Experiencia", "Rango", "Galones", "Bonos sobre el recluta"], filas), "",
               tabla(["Fuente de experiencia", "Cuánto"], [
                   ("Herir o abatir enemigos", "el valor de la vida quitada (abatir: el costo completo)"),
                   ("Dañar obras", f"{x['edificios_pct']} % del valor del daño"),
                   ("Aguantar el fuego y seguir en pie", f"{x['fogueo_pct']} % del valor de la vida perdida"),
                   ("Curar (cantinera)", f"{decimal(x['curacion_por_vida'])} por punto de vida curado"),
                   ("Encuadramiento (recluta junto a un Aguerrido de su arma)",
                    f"+{x['encuadramiento']['pct']} % (radio {x['encuadramiento']['radio']})"),
                   ("Cerca de un héroe", f"+{x['heroe_pct']} %"),
                   ("Ejercicios de tiro (Barracón de Instrucción)",
                    f"{decimal(x['instruccion']['por_segundo'])} por segundo a los reclutas ociosos en un radio de "
                    f"{x['instruccion']['radio']}, hasta Fogueado"),
               ]), ""]

    from salitre.contenido import campanas as mod_campanas
    from salitre.ia.ia import DIFICULTADES
    for camp in mod_campanas.cargar().values():
        filas = []
        for e in camp.etapas:
            rivales = ", ".join(f"{cat.facciones[n].nombre} → {cat.facciones[e.rival(n)].nombre}"
                                for n in camp.naciones)
            nucleo = ", ".join(f"{n.get('cantidad', 1)} × {cat.unidades[n['tipo']].nombre} "
                               f"({vet.grados[int(n.get('grado', 1))].nombre})"
                               for n in e.nucleo_rival) or "—"
            dif = DIFICULTADES.get(e.dificultad, {}).get("nombre", e.dificultad)
            filas.append((f"{e.indice + 1}. {e.nombre}", e.fecha, mod_mapas.cargar(mod_mapas.listar()[e.mapa]).nombre,
                          dif, rivales, nucleo))
        medallas = "; ".join(f"{m['nombre']}: {m.get('minimo', 0)}" for m in camp.medallas)
        partes += [f"## {camp.nombre}", "", camp.descripcion, "",
                   tabla(["Batalla", "Fecha", "Mapa", "IA", "Rival según la nación propia",
                          "Veteranos con que empieza la IA"], filas), "",
                   f"Honores: {camp.honor_victoria} por victoria y "
                   f"{y_lista(str(h) for h in camp.honor_grado[1:])} por cada "
                   f"{y_lista(g.nombre for g in vet.grados[1:])} preservado. Medallas (honores mínimos): {medallas}. "
                   "En la serie de campaña en red los honores se cuentan igual, en cada batalla y para los dos "
                   "bandos.", ""]

    filas = []
    for ident, ruta in mod_mapas.listar().items():
        d = mod_mapas.cargar(ruta)
        filas.append((d.nombre, d.jugadores, f"{d.ancho}×{d.alto}", "sí" if d.naval else "no", d.descripcion))
    partes += ["## Campos de batalla", "", tabla(["Mapa", "Jugadores", "Casillas", "Naval", "Descripción"], filas),
               ""]
    destino = RAIZ / "docs" / "TABLAS.md"
    destino.write_text("\n".join(partes), encoding="utf-8")
    print("Escrito", destino)
    return 0


if __name__ == "__main__":
    sys.exit(main())
