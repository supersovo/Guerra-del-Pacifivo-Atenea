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
