"""Campañas: batallas encadenadas en las que los veteranos pasan de una a la siguiente.

El estado de una campaña es un diccionario (se guarda como JSON en el perfil local,
o en la base del servidor para las series en red):

    faccion, etapa (índice de la próxima batalla), escalafon (veteranos vivos),
    caidos (libro de los caídos), honores, historial, rival (veteranos de la IA por
    nación), contador (para numerar las fichas) y terminada.

Cada veterano es una ficha: {"ficha", "tipo", "grado", "xp", "nombre", "batallas",
"bajas"}; el servidor la recibe en la configuración del jugador y el veterano baja
del tren o de la carreta con el cuartel general (sim/mundo._desplegar_cuartel).
"""

import json

from .. import rutas

CAMPOS = ("ficha", "tipo", "grado", "xp", "nombre", "batallas", "bajas")
MAX_VETERANOS = 200


class Etapa:
    def __init__(self, i, d):
        self.indice = i
        self.id = d["id"]
        self.nombre = d.get("nombre", self.id)
        self.fecha = d.get("fecha", "")
        self.mapa = d["mapa"]
        self.dificultad = d.get("dificultad", "normal")
        self._rival = dict(d.get("rival", {}))
        self.relato = d.get("relato", "")
        self.nucleo_rival = list(d.get("nucleo_rival", []))

    def rival(self, faccion):
        """Nación de la IA según la del jugador."""
        r = self._rival.get(faccion) or self._rival.get("otra") or "peru"
        return r if r != faccion else ("chile" if faccion != "chile" else "peru")


class Campana:
    def __init__(self, cid, d):
        self.id = cid
        self.nombre = d.get("nombre", cid)
        self.descripcion = d.get("descripcion", "")
        self.naciones = list(d.get("naciones", ["chile", "peru", "bolivia"]))
        h = d.get("honores", {})
        self.honor_victoria = int(h.get("victoria", 10))
        self.honor_grado = [int(x) for x in h.get("por_grado", [0, 1, 3, 6])]
        self.medallas = sorted(d.get("medallas", [{"nombre": "Medalla de la campaña", "minimo": 0}]),
                               key=lambda m: -int(m.get("minimo", 0)))
        self.etapas = [Etapa(i, e) for i, e in enumerate(d.get("etapas", []))]

    def honores_de(self, veteranos):
        g = self.honor_grado
        return sum(g[min(len(g) - 1, max(0, int(v.get("grado", 0))))] for v in veteranos)

    def medalla(self, honores):
        for m in self.medallas:
            if honores >= int(m.get("minimo", 0)):
                return m["nombre"]
        return ""


def cargar(carpeta=None):
    """Las campañas de datos/campanas.json, por id."""
    ruta = (carpeta or rutas.dir_datos()) / "campanas.json"
    try:
        datos = json.loads(ruta.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    return {k: Campana(k, v) for k, v in datos.items() if not k.startswith("_")}


# ----------------------------------------------------------------------
def ficha_limpia(cat, v):
    """Ficha validada (tipos, grados y números en rango) o None si no sirve."""
    try:
        tipo = cat.unidades.get(str(v.get("tipo")))
        if tipo is None or not tipo.veterania:
            return None
        vet = cat.veterania
        return {
            "ficha": str(v.get("ficha") or "")[:40],
            "tipo": tipo.id,
            "grado": max(0, min(vet.maximo, int(v.get("grado", 0)))),
            "xp": max(0, min(10 ** 9, int(v.get("xp", 0)))),
            "nombre": max(0, min(2 ** 31 - 1, int(v.get("nombre", 0)))),
            "batallas": max(0, min(999, int(v.get("batallas", 0)))),
            "bajas": max(0, min(99999, int(v.get("bajas", 0)))),
        }
    except (TypeError, ValueError, AttributeError):
        return None


def fichas_limpias(cat, lista):
    out = []
    for v in (lista or [])[:MAX_VETERANOS]:
        f = ficha_limpia(cat, v) if isinstance(v, dict) else None
        if f is not None:
            out.append(f)
    return out


def nuevo_estado(campana, faccion):
    return {"campana": campana.id, "faccion": faccion, "etapa": 0, "escalafon": [], "caidos": [], "honores": 0,
            "historial": [], "rival": {}, "contador": 0, "terminada": False}


def veteranos_rival(cat, campana, estado, etapa):
    """Los veteranos con que empieza la IA: los suyos que sobrevivieron y el núcleo de la etapa."""
    rival = etapa.rival(estado["faccion"])
    out = [dict(v) for v in estado.get("rival", {}).get(rival, [])]
    vet = cat.veterania
    for n in etapa.nucleo_rival:
        tipo = cat.unidades.get(n.get("tipo"))
        if tipo is None or not tipo.veterania:
            continue
        grado = max(1, min(vet.maximo, int(n.get("grado", 1))))
        for _ in range(int(n.get("cantidad", 1))):
            out.append({"ficha": "", "tipo": tipo.id, "grado": grado, "xp": vet.umbral(tipo, grado), "nombre": 0,
                        "batallas": etapa.indice, "bajas": 0})
    return fichas_limpias(cat, out)


def actualizar_escalafon(cat, estado, resultado, etiqueta):
    """Pasa el parte de una batalla al escalafón de un ejército.

    Los veteranos vivos (en filas, heridos en manos de la sanidad o en retirada) quedan
    en el escalafón con una batalla más; los caídos van al libro. Los que no llegaron a
    desplegarse (buques, unidades de otra nación o la batalla terminó antes de que bajaran
    del tren) siguen de reserva. Devuelve (vivos, caídos, nuevos)."""
    vivos = []
    nuevos = 0
    for v in fichas_limpias(cat, (resultado or {}).get("veteranos", [])):
        if v["grado"] < 1:
            continue
        if not v["ficha"]:
            estado["contador"] = estado.get("contador", 0) + 1
            v["ficha"] = f"v{estado['contador']}"
            nuevos += 1
        v["batallas"] += 1
        vivos.append(v)
    caidos = []
    for v in fichas_limpias(cat, (resultado or {}).get("caidos", [])):
        if v["grado"] >= 1 or v["ficha"]:
            v["etapa"] = etiqueta
            v["batallas"] += 1
            caidos.append(v)
    presentes = {v["ficha"] for v in vivos} | {v["ficha"] for v in caidos}
    reserva = [v for v in estado["escalafon"] if v["ficha"] not in presentes]
    estado["escalafon"] = sorted(vivos + reserva, key=lambda v: (-v["grado"], -v["bajas"], v["ficha"]))
    estado["caidos"].extend(caidos)
    return vivos, caidos, nuevos


def aplicar_batalla(cat, campana, estado, propio, rival, victoria, minutos=0.0):
    """Anota el resultado de la batalla de la etapa actual.

    propio / rival: resultados del parte de guerra ({"veteranos": [...], "caidos": [...]}).
    Con la victoria, los veteranos que siguen vivos (también los heridos en manos de la
    sanidad) forman el nuevo escalafón y se avanza a la etapa siguiente; con la derrota, la
    batalla se puede repetir con el escalafón de antes. Devuelve un resumen para mostrar."""
    etapa = campana.etapas[estado["etapa"]]
    resumen = {"etapa": etapa.indice, "nombre": etapa.nombre, "victoria": bool(victoria), "honores": 0,
               "supervivientes": 0, "caidos": 0, "nuevos": 0, "minutos": round(float(minutos), 1)}
    if not victoria:
        estado["historial"].append(resumen)
        return resumen
    vivos, caidos, nuevos = actualizar_escalafon(cat, estado, propio, etapa.nombre)
    honores = campana.honor_victoria + campana.honores_de(vivos)
    estado["honores"] += honores
    if rival is not None:
        # la IA conserva a los suyos que sobrevivieron (también los que se retiraron del campo)
        rival_fac = etapa.rival(estado["faccion"])
        estado.setdefault("rival", {})[rival_fac] = [v for v in fichas_limpias(cat, rival.get("veteranos", []))
                                                     if v["grado"] >= 1]
    resumen.update(honores=honores, supervivientes=len(vivos), caidos=len(caidos), nuevos=nuevos)
    estado["historial"].append(resumen)
    estado["etapa"] += 1
    if estado["etapa"] >= len(campana.etapas):
        estado["terminada"] = True
        estado["medalla"] = campana.medalla(estado["honores"])
    return resumen
