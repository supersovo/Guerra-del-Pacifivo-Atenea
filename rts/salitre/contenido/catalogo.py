"""Catálogo del juego: carga, valida y convierte los JSON de la carpeta datos/.

Los archivos usan unidades cómodas para quien diseña (segundos, casillas,
casillas por segundo); aquí se convierten a los enteros de la simulación
(ticks y subunidades). El catálogo también calcula una huella (hash) de los
datos: servidor y clientes deben tener el mismo contenido para jugar juntos.
"""

import hashlib
import json
from pathlib import Path

from .. import rutas
from ..sim.constantes import EFP, HFP, TICKS, TILE, sub, ticks, vel

ARCHIVOS = ("tablas.json", "unidades.json", "edificios.json", "mejoras.json",
            "habilidades.json", "facciones.json")

# Campos que modifican las estadísticas de un tipo (investigaciones y bonificaciones).
CAMPOS_ESTATICOS = {
    "danio", "armadura", "alcance", "vida", "vida_pct", "velocidad_pct", "ataque_vel_pct",
    "vision", "curacion_pct", "energia_max", "salpicadura", "carga_pct", "costo_pct",
}
# Campos de los efectos temporales (auras y habilidades).
CAMPOS_DINAMICOS = {
    "danio_pct", "armadura", "velocidad_pct", "ataque_vel_pct", "alcance", "regeneracion",
    "inmortal", "ignora_altura", "camuflaje",
}
CLASES_BIOLOGICAS = ("infanteria", "caballeria")
CLASES_MECANICAS = ("artilleria", "naval")
TIPOS_HABILIDAD = {
    "orden_reparar", "menu_construir", "emplazar", "descargar", "sabotaje", "mina",
    "demolicion", "revelar", "potenciar_area", "potenciar_propio", "bombardeo",
    "curar_area", "golpe",
}
OBJETIVOS_HABILIDAD = {"ninguno", "punto", "unidad_enemiga", "edificio_enemigo", "propio"}


class ContenidoError(Exception):
    """Error en los archivos de datos (se informa con el archivo y la clave)."""


def _lista(v):
    if v is None:
        return None
    return tuple(v)


def _costo(d):
    """(dinero, agua). El salitre se vende en el cuartel general a 1 $ por unidad, así que
    todo se paga en dinero; se acepta la clave antigua "salitre" de los datos propios."""
    c = d.get("costo", {})
    return int(c.get("dinero", c.get("salitre", 0))), int(c.get("agua", 0))


class Filtro:
    """A qué unidades o edificios se aplica un efecto."""

    __slots__ = ("clases", "categorias", "excluir", "armas", "unidades", "edificios",
                 "capa", "biologica")

    def __init__(self, d=None):
        d = d or {}
        self.clases = _lista(d.get("clases"))
        self.categorias = _lista(d.get("categorias"))
        self.excluir = _lista(d.get("excluir_categorias"))
        self.armas = _lista(d.get("armas"))
        self.unidades = _lista(d.get("unidades"))
        self.edificios = _lista(d.get("edificios"))
        self.capa = d.get("capa")
        self.biologica = d.get("biologica")

    def unidad(self, t):
        if self.edificios is not None:
            return False
        if self.unidades is not None and t.id not in self.unidades:
            return False
        if self.clases is not None and t.clase not in self.clases:
            return False
        if self.categorias is not None and t.categoria not in self.categorias:
            return False
        if self.excluir is not None and t.categoria in self.excluir:
            return False
        if self.armas is not None and (t.arma is None or t.arma.tipo not in self.armas):
            return False
        if self.capa is not None and t.capa_nombre != self.capa:
            return False
        if self.biologica is not None and bool(self.biologica) != t.biologica:
            return False
        return True

    def edificio(self, t):
        if self.edificios is not None:
            return t.id in self.edificios
        return self.clases is not None and "edificio" in self.clases


class Efecto:
    __slots__ = ("campo", "suma", "filtro")

    def __init__(self, d, permitidos, donde):
        self.campo = d.get("campo")
        if self.campo not in permitidos:
            raise ContenidoError(f"{donde}: campo de efecto desconocido '{self.campo}'")
        self.suma = d.get("suma", 0)
        self.filtro = Filtro(d.get("objetivo"))


class Arma:
    __slots__ = ("tipo", "danio", "alcance", "alcance_min", "enfriamiento", "objetivos",
                 "salpicadura", "vel_proyectil")

    def __init__(self, d, donde, multiplicadores):
        self.tipo = d.get("tipo")
        if self.tipo not in multiplicadores:
            raise ContenidoError(f"{donde}: tipo de arma desconocido '{self.tipo}'")
        self.danio = int(d.get("danio", 0))
        self.alcance = sub(d.get("alcance", 0.3))
        self.alcance_min = sub(d.get("alcance_min", 0))
        self.enfriamiento = max(1, ticks(d.get("enfriamiento", 1.0)))
        self.objetivos = d.get("objetivos", "tierra")
        if self.objetivos not in ("tierra", "agua", "ambos"):
            raise ContenidoError(f"{donde}: 'objetivos' debe ser tierra, agua o ambos")
        self.salpicadura = sub(d.get("salpicadura", 0))
        p = d.get("proyectil", 0)
        self.vel_proyectil = vel(p) if p else 0


class TipoUnidad:
    es_edificio = False

    def __init__(self, uid, d, tablas):
        donde = f"unidades.json:{uid}"
        self.id = uid
        self.idx = -1
        self.nombre = d.get("nombre", uid)
        self.descripcion = d.get("descripcion", "")
        self.historia = d.get("historia", "")
        self.clase = d.get("clase", "infanteria")
        if self.clase not in tablas["clases_armadura"]:
            raise ContenidoError(f"{donde}: clase de armadura desconocida '{self.clase}'")
        self.categoria = d.get("categoria", "infanteria")
        self.faccion = d.get("faccion")
        self.heroe = bool(d.get("heroe", False))
        self.costo = _costo(d)
        self.poblacion = int(d.get("poblacion", 1))
        self.espacio = int(d.get("espacio", self.poblacion))
        self.tiempo = max(1, ticks(d.get("tiempo", 10)))
        self.vida = int(d.get("vida", 1))
        self.armadura = int(d.get("armadura", 0))
        self.velocidad = vel(d.get("velocidad", 1.5))
        self.vision = float(d.get("vision", 7))
        self.radio = sub(d.get("radio", 0.3))
        self.capa_nombre = d.get("capa", "tierra")
        if self.capa_nombre not in ("tierra", "agua"):
            raise ContenidoError(f"{donde}: capa debe ser 'tierra' o 'agua'")
        self.capa = 0 if self.capa_nombre == "tierra" else 1
        self.arma = Arma(d["arma"], donde, tablas["multiplicadores"]) if d.get("arma") else None
        self.trabajador = bool(d.get("trabajador", False))
        self.produce_en = d.get("produce_en")
        self.requisitos = tuple(d.get("requisitos", []))
        self.habilidades = tuple(d.get("habilidades", []))
        self.pasivas = d.get("pasivas", {}) or {}
        en = d.get("energia")
        if en:
            self.energia_max = int(round(en.get("max", 200) * EFP))
            self.energia_ini = int(round(en.get("inicial", 50) * EFP))
            self.energia_regen = int(round(en.get("regen", 0.625) * EFP / TICKS))
        else:
            self.energia_max = self.energia_ini = self.energia_regen = 0
        cu = d.get("curar")
        if cu:
            self.curar_ritmo = int(round(cu.get("ritmo", 8) * HFP / TICKS))
            self.curar_alcance = sub(cu.get("alcance", 2))
            self.curar_costo = int(round(cu.get("costo_energia", 0.5) * EFP))
            self.curar_busqueda = sub(cu.get("busqueda", 7))
        else:
            self.curar_ritmo = 0
            self.curar_alcance = self.curar_costo = self.curar_busqueda = 0
        self.capacidad = int(d.get("transporte", 0))
        em = d.get("emplazar")
        self.emplazar = ticks(em.get("tiempo", 2.0)) if em else 0
        au = d.get("aura")
        if au:
            self.aura_radio = sub(au.get("radio", 8))
            self.aura_efectos = tuple(Efecto(e, CAMPOS_DINAMICOS, donde + ".aura")
                                      for e in au.get("efectos", []))
        else:
            self.aura_radio = 0
            self.aura_efectos = ()
        self.atajo = (d.get("atajo") or "").upper()[:1]
        self.sprite = d.get("sprite", {})
        self.biologica = self.clase in CLASES_BIOLOGICAS
        self.mecanica = self.clase in CLASES_MECANICAS
        p = self.pasivas
        self.detector = sub(p["detector"].get("radio", 7)) if "detector" in p else 0
        self.camuflaje = "camuflaje" in p
        self.camuflaje_quieto = ticks(p["camuflaje_quieto"].get("segundos", 3)) if "camuflaje_quieto" in p else 0
        self.cuadro = int(p["cuadro"].get("reduccion", 50)) if "cuadro" in p else 0
        if "carga" in p:
            self.carga_bonus = int(p["carga"].get("bonus", 100))
            self.carga_ticks = ticks(p["carga"].get("segundos", 1.5))
        else:
            self.carga_bonus = 0
            self.carga_ticks = 0
        self.bonus_edificios = int(p["bonus_edificios"].get("pct", 0)) if "bonus_edificios" in p else 0
        self.no_adquiere = "no_adquiere" in p
        # actúa sola (los camilleros): no recibe órdenes del jugador ni entra en la selección por recuadro
        self.autonomo = "autonomo" in p
        if "constructor" in p:
            self.construye = tuple(p["constructor"].get("edificios", []))
            self.vel_construccion = int(p["constructor"].get("velocidad", 100))
        else:
            self.construye = ()
            self.vel_construccion = 100


class TipoEdificio:
    es_edificio = True
    clase = "edificio"
    categoria = "edificio"
    biologica = False
    mecanica = True
    heroe = False
    capa = 0
    capa_nombre = "tierra"

    def __init__(self, eid, d, tablas):
        donde = f"edificios.json:{eid}"
        self.id = eid
        self.idx = -1
        self.nombre = d.get("nombre", eid)
        self.descripcion = d.get("descripcion", "")
        self.historia = d.get("historia", "")
        self.faccion = d.get("faccion")
        tam = d.get("tamano", [2, 2])
        self.ancho, self.alto = int(tam[0]), int(tam[1])
        self.vida = int(d.get("vida", 500))
        self.armadura = int(d.get("armadura", 1))
        self.costo = _costo(d)
        self.tiempo = max(1, ticks(d.get("tiempo", 30)))
        self.poblacion = int(d.get("poblacion", 0))
        self.deposito = bool(d.get("deposito", False))
        self.vision = float(d.get("vision", 7))
        self.produce = tuple(d.get("produce", []))
        self.investiga = tuple(d.get("investiga", []))
        self.requisitos = tuple(d.get("requisitos", []))
        self.menu = d.get("menu", "basico")
        self.atajo = (d.get("atajo") or "").upper()[:1]
        self.sobre_recurso = d.get("sobre_recurso")
        self.costero = bool(d.get("costero", False))
        self.arma = Arma(d["arma"], donde, tablas["multiplicadores"]) if d.get("arma") else None
        self.detector = sub(d.get("detector", 0))
        g = d.get("guarnicion")
        if g:
            self.guarnicion = int(g.get("capacidad", 4))
            self.guarnicion_alcance = sub(g.get("alcance_extra", 1))
            self.guarnicion_categorias = tuple(g.get("categorias", ["infanteria"]))
            self.guarnicion_clases = tuple(g.get("clases", ["infanteria"]))
            # "trinchera": se ven asomados tras el parapeto; "techo": suben al techo y disparan desde arriba
            self.guarnicion_vista = g.get("vista", "trinchera")
            if self.guarnicion_vista not in ("trinchera", "techo"):
                raise ContenidoError(f"{donde}: 'guarnicion.vista' debe ser 'trinchera' o 'techo'")
        else:
            self.guarnicion = 0
            self.guarnicion_alcance = 0
            self.guarnicion_categorias = ()
            self.guarnicion_clases = ()
            self.guarnicion_vista = None
        r = d.get("regeneracion")
        if r:
            self.regen_radio = sub(r.get("radio", 5))
            self.regen_hps = float(r.get("ritmo", 1.0))
        else:
            self.regen_radio = 0
            self.regen_hps = 0.0
        c = d.get("camilleros")
        if c:
            self.camilleros = int(c.get("equipos", 2))
            self.camilleros_radio = sub(c.get("radio", 30))
            self.recuperacion = max(1, ticks(c.get("recuperacion", 20)))
            self.reposicion = max(1, ticks(c.get("reposicion", 30)))
            self.vida_al_volver = max(1, min(100, int(c.get("vida_al_volver", 50))))
        else:
            self.camilleros = 0
            self.camilleros_radio = self.recuperacion = self.reposicion = 0
            self.vida_al_volver = 100
        en = d.get("energia")
        if en:
            self.energia_max = int(round(en.get("max", 200) * EFP))
            self.energia_ini = int(round(en.get("inicial", 50) * EFP))
            self.energia_regen = int(round(en.get("regen", 0.6) * EFP / TICKS))
        else:
            self.energia_max = self.energia_ini = self.energia_regen = 0
        self.habilidades = tuple(d.get("habilidades", []))
        self.sprite = d.get("sprite", {})
        self.radio = max(self.ancho, self.alto) * TILE // 2


class Mejora:
    def __init__(self, mid, d):
        donde = f"mejoras.json:{mid}"
        self.id = mid
        self.idx = -1
        self.nombre = d.get("nombre", mid)
        self.descripcion = d.get("descripcion", "")
        self.edificio = d.get("edificio")
        self.costo = _costo(d)
        self.tiempo = max(1, ticks(d.get("tiempo", 60)))
        self.previa = d.get("previa")
        self.requisitos = tuple(d.get("requisitos", []))
        self.efectos = tuple(Efecto(e, CAMPOS_ESTATICOS, donde) for e in d.get("efectos", []))
        self.atajo = (d.get("atajo") or "").upper()[:1]


class Habilidad:
    def __init__(self, hid, d, tablas):
        donde = f"habilidades.json:{hid}"
        self.id = hid
        self.nombre = d.get("nombre", hid)
        self.descripcion = d.get("descripcion", "")
        self.tipo = d.get("tipo")
        if self.tipo not in TIPOS_HABILIDAD:
            raise ContenidoError(f"{donde}: tipo de habilidad desconocido '{self.tipo}'")
        self.objetivo = d.get("objetivo", "ninguno")
        if self.objetivo not in OBJETIVOS_HABILIDAD:
            raise ContenidoError(f"{donde}: objetivo desconocido '{self.objetivo}'")
        a = d.get("alcance")
        self.alcance = sub(a) if a is not None else 0
        self.energia = int(round(d.get("energia", 0) * EFP))
        self.enfriamiento = ticks(d.get("enfriamiento", 0))
        self.radio = sub(d.get("radio", 0))
        self.duracion = ticks(d.get("duracion", 0))
        self.efectos = tuple(Efecto(e, CAMPOS_DINAMICOS, donde) for e in d.get("efectos", []))
        self.danio = int(d.get("danio", 0))
        self.tipo_danio = d.get("tipo_danio", "explosivo")
        if self.tipo_danio not in tablas["multiplicadores"]:
            raise ContenidoError(f"{donde}: tipo de daño desconocido '{self.tipo_danio}'")
        self.cantidad = int(d.get("cantidad", 0))
        self.proyectiles = int(d.get("proyectiles", 0))
        self.dispersion = sub(d.get("dispersion", 0))
        self.retardo = ticks(d.get("retardo", 0))
        self.activacion = sub(d.get("activacion", 0.8))
        self.armado = ticks(d.get("armado", 1.0))
        self.solo_naval = bool(d.get("solo_naval", False))
        self.incluye_naval = bool(d.get("incluye_naval", False))
        self.atajo = (d.get("atajo") or "").upper()[:1]


class Faccion:
    def __init__(self, fid, d, comunes):
        self.id = fid
        self.nombre = d.get("nombre", fid)
        self.ejercito = d.get("ejercito", self.nombre)
        self.descripcion = d.get("descripcion", "")
        self.historia = d.get("historia", "")
        self.uniforme = {k: tuple(v) for k, v in d.get("uniforme", {}).items()}
        # colores propios de cada arma (zapadores, dinamiteros, granaderos, cazadores...)
        self.uniformes = {forma: {k: tuple(v) for k, v in colores.items()}
                          for forma, colores in d.get("uniformes", {}).items()}
        self.bandera = d.get("bandera", fid)
        self.unidades = tuple(comunes["unidades"]) + tuple(d.get("unidades", []))
        self.edificios = tuple(comunes["edificios"]) + tuple(d.get("edificios", []))
        self.nombres = dict(d.get("nombres", {}))
        self.bonificaciones = []
        for i, b in enumerate(d.get("bonificaciones", [])):
            efs = tuple(Efecto(e, CAMPOS_ESTATICOS, f"facciones.json:{fid}.bonificaciones[{i}]")
                        for e in b.get("efectos", []))
            self.bonificaciones.append((b.get("nombre", ""), b.get("descripcion", ""), efs))
        self.heroes = ()

    def efectos_iniciales(self):
        out = []
        for _n, _d, efs in self.bonificaciones:
            out.extend(efs)
        return out


class Catalogo:
    """Todo el contenido del juego, ya validado."""

    def __init__(self, carpeta=None):
        carpeta = Path(carpeta) if carpeta else rutas.dir_datos()
        crudos = {}
        h = hashlib.sha256()
        for nombre in ARCHIVOS:
            ruta = carpeta / nombre
            try:
                texto = ruta.read_text(encoding="utf-8")
            except OSError as e:
                raise ContenidoError(f"No se pudo leer {ruta}: {e}") from e
            try:
                crudos[nombre] = json.loads(texto)
            except json.JSONDecodeError as e:
                raise ContenidoError(f"{nombre}: JSON inválido (línea {e.lineno}): {e.msg}") from e
            h.update(nombre.encode())
            h.update(json.dumps(crudos[nombre], sort_keys=True, ensure_ascii=False).encode("utf-8"))
        self.huella = h.hexdigest()[:16]
        self.carpeta = carpeta

        t = crudos["tablas.json"]
        self.tablas = t
        self.multiplicadores = {k: dict(v) for k, v in t["multiplicadores"].items()}
        self.nombres_ataque = t.get("nombres_ataque", {})
        self.nombres_armadura = t.get("nombres_armadura", {})
        self.fallo_altura = int(t.get("fallo_por_altura", 30))
        self.poblacion_maxima = int(t.get("poblacion_maxima", 200))
        ri = t.get("recursos_iniciales", {})
        self.recursos_iniciales = (int(ri.get("dinero", ri.get("salitre", 100))), int(ri.get("agua", 0)))
        self.trabajadores_iniciales = int(t.get("trabajadores_iniciales", 6))
        self.carga_salitre = int(t.get("carga_salitre", 5))
        self.ticks_salitre = ticks(t.get("tiempo_extraccion_salitre", 2.5))
        self.carga_agua = int(t.get("carga_agua", 4))
        self.ticks_agua = ticks(t.get("tiempo_extraccion_agua", 1.5))
        self.carga_agua_agotada = int(t.get("carga_agua_agotada", 1))
        self.minas_maximas = int(t.get("minas_maximas", 15))
        self.ticks_herido = ticks(t.get("segundos_herido", 40))
        self.dist_recursos_cuartel = int(t.get("distancia_minima_recursos_cuartel", 3))

        def sin_comentarios(d):
            return {k: v for k, v in d.items() if not k.startswith("_")}

        self.unidades = {k: TipoUnidad(k, v, t) for k, v in sin_comentarios(crudos["unidades.json"]).items()}
        self.edificios = {k: TipoEdificio(k, v, t) for k, v in sin_comentarios(crudos["edificios.json"]).items()}
        self.mejoras = {k: Mejora(k, v) for k, v in sin_comentarios(crudos["mejoras.json"]).items()}
        self.habilidades = {k: Habilidad(k, v, t) for k, v in sin_comentarios(crudos["habilidades.json"]).items()}
        fac = crudos["facciones.json"]
        comunes = fac.get("_comunes", {"unidades": [], "edificios": []})
        self.facciones = {k: Faccion(k, v, comunes) for k, v in sin_comentarios(fac).items()}

        # Índices estables para la red: unidades y edificios en el orden de los archivos.
        self.tipos = []
        for tu in self.unidades.values():
            tu.idx = len(self.tipos)
            self.tipos.append(tu)
        for te in self.edificios.values():
            te.idx = len(self.tipos)
            self.tipos.append(te)
        for i, m in enumerate(self.mejoras.values()):
            m.idx = i
        self.tipos_por_id = {tp.id: tp for tp in self.tipos}
        self._validar()

    # ------------------------------------------------------------------
    def _validar(self):
        U, E, M, H = self.unidades, self.edificios, self.mejoras, self.habilidades
        if set(U) & set(E):
            raise ContenidoError(f"Ids repetidos entre unidades y edificios: {sorted(set(U) & set(E))}")
        for u in U.values():
            w = f"unidades.json:{u.id}"
            if u.produce_en is None and u.autonomo:
                pass    # los camilleros los manda el hospital, no se forman a pedido
            elif u.produce_en not in E:
                raise ContenidoError(f"{w}: 'produce_en' no es un edificio: {u.produce_en}")
            elif u.id not in E[u.produce_en].produce:
                raise ContenidoError(f"{w}: el edificio {u.produce_en} no la incluye en 'produce'")
            for r in u.requisitos:
                if r not in E:
                    raise ContenidoError(f"{w}: requisito desconocido {r}")
            for hb in u.habilidades:
                if hb not in H:
                    raise ContenidoError(f"{w}: habilidad desconocida {hb}")
            if u.faccion and u.faccion not in self.facciones:
                raise ContenidoError(f"{w}: nación desconocida {u.faccion}")
            for b in u.construye:
                if b not in E:
                    raise ContenidoError(f"{w}: 'constructor' incluye un edificio desconocido {b}")
        for e in E.values():
            w = f"edificios.json:{e.id}"
            for p in e.produce:
                if p not in U:
                    raise ContenidoError(f"{w}: 'produce' incluye una unidad desconocida {p}")
            for i in e.investiga:
                if i not in M:
                    raise ContenidoError(f"{w}: 'investiga' incluye una mejora desconocida {i}")
                if M[i].edificio != e.id:
                    raise ContenidoError(f"{w}: la mejora {i} declara otro edificio ({M[i].edificio})")
            for r in e.requisitos:
                if r not in E:
                    raise ContenidoError(f"{w}: requisito desconocido {r}")
            for hb in e.habilidades:
                if hb not in H:
                    raise ContenidoError(f"{w}: habilidad desconocida {hb}")
            if e.sobre_recurso not in (None, "agua"):
                raise ContenidoError(f"{w}: 'sobre_recurso' solo admite 'agua'")
        for m in M.values():
            w = f"mejoras.json:{m.id}"
            if m.edificio not in E:
                raise ContenidoError(f"{w}: edificio desconocido {m.edificio}")
            if m.previa and m.previa not in M:
                raise ContenidoError(f"{w}: 'previa' desconocida {m.previa}")
            for r in m.requisitos:
                if r not in E:
                    raise ContenidoError(f"{w}: requisito desconocido {r}")
        for f in self.facciones.values():
            w = f"facciones.json:{f.id}"
            for u in f.unidades:
                if u not in U:
                    raise ContenidoError(f"{w}: unidad desconocida {u}")
                if U[u].faccion not in (None, f.id):
                    raise ContenidoError(f"{w}: la unidad {u} es exclusiva de {U[u].faccion}")
            for e in f.edificios:
                if e not in E:
                    raise ContenidoError(f"{w}: edificio desconocido {e}")
            for k in f.nombres:
                if k not in U and k not in E:
                    raise ContenidoError(f"{w}: 'nombres' incluye un id desconocido {k}")
            f.heroes = tuple(u for u in f.unidades if U[u].heroe)
            if "cuartel_general" not in f.edificios or "trabajador" not in f.unidades:
                raise ContenidoError(f"{w}: toda nación necesita cuartel_general y trabajador")

    # ------------------------------------------------------------------
    def nombre(self, faccion_id, tipo_id):
        f = self.facciones.get(faccion_id)
        if f and tipo_id in f.nombres:
            return f.nombres[tipo_id]
        tp = self.tipos_por_id.get(tipo_id)
        return tp.nombre if tp else tipo_id

    def disponible(self, faccion_id, tipo_id):
        f = self.facciones[faccion_id]
        return tipo_id in f.unidades or tipo_id in f.edificios

    def multiplicador(self, tipo_ataque, clase):
        return self.multiplicadores[tipo_ataque].get(clase, 100)


_cache = {}


def cargar(carpeta=None):
    """Devuelve el catálogo (se carga una sola vez por carpeta)."""
    clave = str(Path(carpeta).resolve()) if carpeta else "_defecto"
    cat = _cache.get(clave)
    if cat is None:
        cat = Catalogo(carpeta)
        _cache[clave] = cat
    return cat
