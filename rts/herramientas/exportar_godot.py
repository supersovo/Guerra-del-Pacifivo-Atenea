"""Exporta el catálogo del juego para el cliente de Godot (godot/datos/catalogo.json).

El cliente de Godot no lee los JSON de datos/ directamente: recibe del servidor
los tipos por su índice (tipo.idx) y necesita saber, para cada índice, qué
dibujar y cómo nombrarlo. Este guion vuelca lo que el cliente necesita, en el
orden de los índices de red, junto con la huella del contenido (el servidor
rechaza a quien no la tenga igual), las banderas de la instantánea y los
colores.

Después de tocar los datos:

    python herramientas/exportar_godot.py

La prueba test_godot.py comprueba que el archivo está al día.
"""

import json
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))

from salitre import PROTOCOLO, VERSION  # noqa: E402
from salitre.cliente.graficos import paleta  # noqa: E402
from salitre.contenido import catalogo as mod_cat  # noqa: E402
from salitre.ia.ia import DIFICULTADES  # noqa: E402
from salitre.red import instantanea as I  # noqa: E402
from salitre.sim import mapa as mod_mapa  # noqa: E402
from salitre.sim import stats as mod_stats  # noqa: E402
from salitre.servidor.servidor import VELOCIDADES  # noqa: E402
from salitre.sim.constantes import AFP, EFP, SUB, TICKS, TILE, TILE_PX  # noqa: E402

DESTINO = RAIZ / "godot" / "datos" / "catalogo.json"


def _casillas(sub):
    return round(sub / TILE, 4)


def _arma(a):
    if a is None:
        return None
    return {"tipo": a.tipo, "danio": a.danio, "alcance": _casillas(a.alcance),
            "alcance_min": _casillas(a.alcance_min), "proyectil": bool(a.vel_proyectil),
            "salpicadura": _casillas(a.salpicadura), "cep": round(a.cep / TILE, 4),
            "enfriamiento": round(a.enfriamiento / TICKS, 3), "objetivos": a.objetivos}


def _unidad(tu):
    return {
        "id": tu.id, "nombre": tu.nombre, "edificio": False, "clase": tu.clase, "categoria": tu.categoria,
        "capa": tu.capa, "radio": _casillas(tu.radio), "vida": tu.vida, "armadura": tu.armadura,
        "vision": tu.vision, "velocidad": round(tu.velocidad * TICKS / TILE, 3), "arma": _arma(tu.arma),
        "forma": tu.sprite.get("forma", "infante"), "insignia": tu.sprite.get("insignia"),
        "trabajador": tu.trabajador, "autonomo": tu.autonomo, "heroe": tu.heroe, "faccion": tu.faccion,
        "biologica": tu.biologica, "forma_filas": tu.forma_filas, "estanque": tu.estanque_cap // AFP,
        "estanque_radio": _casillas(tu.estanque_radio), "sed": tu.sed is not None,
        "observador": _casillas(tu.observador), "monta": tu.monta, "habilidades": list(tu.habilidades),
        "atajo": tu.atajo, "poblacion": tu.poblacion, "costo": list(tu.costo), "produce_en": tu.produce_en,
        "requisitos": list(tu.requisitos), "construye": list(tu.construye), "tiempo": round(tu.tiempo / TICKS, 2),
        "descripcion": tu.descripcion,
    }


def _edificio(te):
    return {
        "id": te.id, "nombre": te.nombre, "edificio": True, "ancho": te.ancho, "alto": te.alto,
        "vida": te.vida, "armadura": te.armadura, "vision": te.vision, "forma": te.sprite.get("forma", te.id),
        "arma": _arma(te.arma), "guarnicion": te.guarnicion, "guarnicion_vista": te.guarnicion_vista,
        "produce": list(te.produce), "investiga": list(te.investiga), "deposito": bool(te.deposito),
        "sobre_recurso": te.sobre_recurso, "costero": bool(te.costero), "poblacion": te.poblacion,
        "abastece": _casillas(te.abastece_radio), "camilleros": te.camilleros, "desmonta_en": te.desmonta_en,
        "menu": te.menu, "atajo": te.atajo, "costo": list(te.costo), "requisitos": list(te.requisitos),
        "habilidades": list(te.habilidades), "faccion": te.faccion, "tiempo": round(te.tiempo / TICKS, 2),
        "descripcion": te.descripcion,
    }


def _faccion(cat, f):
    # costo y visión de cada tipo con las ventajas permanentes de la nación (las investigaciones
    # no cambian precios; las que suman visión las aplica el servidor)
    st = mod_stats.tabla(cat, f, list(f.efectos_iniciales()))
    return {
        "nombre": f.nombre, "ejercito": f.ejercito, "bandera": f.bandera,
        "uniforme": {k: list(v) for k, v in f.uniforme.items()},
        "uniformes": {forma: {k: list(v) for k, v in col.items()} for forma, col in f.uniformes.items()},
        "nombres": dict(f.nombres), "unidades": list(f.unidades), "edificios": list(f.edificios),
        "heroes": list(f.heroes),
        "stats": {tid: {"costo": list(v.costo), "vision": v.vision} for tid, v in st.items()},
    }


def exportar(cat=None):
    """El catálogo para Godot, como texto JSON (el mismo cada vez si los datos no cambian)."""
    cat = cat or mod_cat.cargar()
    banderas = {k[2:]: v for k, v in vars(I).items() if k.startswith("F_") and isinstance(v, int)}
    terrenos = {c: {"codigo": v[0], "nombre": v[1], "pisable": v[2], "edificable": v[3], "agua": v[4]}
                for c, v in mod_mapa.TERRENOS.items()}
    datos = {
        "_aviso": "Generado por herramientas/exportar_godot.py a partir de datos/: no lo edite a mano.",
        "version": VERSION,
        "protocolo": PROTOCOLO,
        "huella": cat.huella,
        "tile_px": TILE_PX,
        "sub": SUB,
        "ticks": TICKS,
        "banderas": banderas,
        "tipos_especiales": {"salitre": I.TIPO_SALITRE, "agua": I.TIPO_AGUA, "mina": I.TIPO_MINA,
                             "herido": I.TIPO_HERIDO, "convoy": I.TIPO_CONVOY},
        "terrenos": terrenos,
        "colores_terreno": {str(k): list(v) for k, v in paleta.TERRENO.items()},
        "colores_jugador": [[n, list(c)] for n, c in paleta.COLORES_JUGADOR],
        "tipos": [_edificio(t) if t.es_edificio else _unidad(t) for t in cat.tipos],
        "facciones": {fid: _faccion(cat, f) for fid, f in cat.facciones.items()},
        "formaciones": [{"id": f.id, "codigo": f.codigo, "nombre": f.nombre, "atajo": f.atajo,
                         "descripcion": f.descripcion} for f in cat.formaciones.values()],
        "habilidades": {h.id: {"nombre": h.nombre, "atajo": h.atajo, "tipo": h.tipo, "objetivo": h.objetivo,
                               "energia": h.energia // EFP, "enfriamiento": round(h.enfriamiento / TICKS, 2),
                               "alcance": _casillas(h.alcance), "edificio": h.edificio,
                               "descripcion": h.descripcion} for h in cat.habilidades.values()},
        "mejoras": [{"id": m.id, "nombre": m.nombre, "atajo": m.atajo, "edificio": m.edificio,
                     "costo": list(m.costo), "tiempo": round(m.tiempo / TICKS, 2), "previa": m.previa,
                     "requisitos": list(m.requisitos), "descripcion": m.descripcion}
                    for m in cat.mejoras.values()],
        "hospitales": list(cat.hospitales),
        "dist_recursos_cuartel": cat.dist_recursos_cuartel,
        "nombres_ataque": dict(cat.nombres_ataque),
        "nombres_armadura": dict(cat.nombres_armadura),
        "dificultades": {k: v["nombre"] for k, v in DIFICULTADES.items()},
        "velocidades": list(VELOCIDADES),
    }
    return json.dumps(datos, ensure_ascii=False, indent=1) + "\n"


def main():
    DESTINO.parent.mkdir(parents=True, exist_ok=True)
    DESTINO.write_text(exportar(), encoding="utf-8")
    print("Escrito", DESTINO)
    return 0


if __name__ == "__main__":
    sys.exit(main())
