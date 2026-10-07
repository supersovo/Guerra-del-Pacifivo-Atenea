"""Entidades de la simulación: unidades, edificios, recursos, minas, heridos y órdenes."""

from .constantes import EDIFICIO, HERIDO, MINA, RECURSO, TILE, UNIDAD

# Tipos de orden
MOVER = 1
ATACAR_MOVER = 2
ATACAR = 3
MANTENER = 4
PATRULLAR = 5
RECOLECTAR = 6
REGRESAR = 7
CONSTRUIR = 8
REPARAR = 9
SEGUIR = 10
CARGAR = 11
DESCARGAR = 12
HABILIDAD = 13
CURAR = 14

NOMBRE_ORDEN = {
    MOVER: "mover", ATACAR_MOVER: "atacar_mover", ATACAR: "atacar", MANTENER: "mantener",
    PATRULLAR: "patrullar", RECOLECTAR: "recolectar", REGRESAR: "regresar",
    CONSTRUIR: "construir", REPARAR: "reparar", SEGUIR: "seguir", CARGAR: "cargar",
    DESCARGAR: "descargar", HABILIDAD: "habilidad", CURAR: "curar",
}


class Orden:
    __slots__ = ("tipo", "x", "y", "obj", "dato", "x0", "y0")

    def __init__(self, tipo, x=0, y=0, obj=0, dato=None):
        self.tipo = tipo
        self.x = x
        self.y = y
        self.obj = obj
        self.dato = dato
        self.x0 = 0
        self.y0 = 0

    def __repr__(self):
        return f"Orden({NOMBRE_ORDEN.get(self.tipo, self.tipo)}, {self.x}, {self.y}, obj={self.obj}, dato={self.dato})"


class Entidad:
    __slots__ = ("id", "clase", "tipo", "dueno", "x", "y", "vida", "vivo", "st")

    es_unidad = False
    es_edificio = False
    es_recurso = False
    es_mina = False
    es_herido = False


class Unidad(Entidad):
    __slots__ = (
        "radio", "capa", "orden", "cola", "ruta", "ruta_meta", "ruta_pend", "fase", "objetivo",
        "auto", "enfr", "dir", "carga_tipo", "carga", "energia", "buffs", "aura", "emplazada",
        "emplazando", "quieto", "dentro", "cargamento", "abatidos", "mov_ticks", "atasco",
        "casa_x", "casa_y", "cd", "regen", "acum", "oculta", "ataco_t", "golpeado_por",
        "golpeado_t", "fantasma", "recurso_id", "moviendo", "disparo_t", "espera", "creada_t",
        "buscar_t", "ultimo_x", "ultimo_y", "base_id", "paciente",
    )
    es_unidad = True

    def __init__(self, uid, tipo, dueno, x, y, st, tick):
        self.id = uid
        self.clase = UNIDAD
        self.tipo = tipo
        self.dueno = dueno
        self.x = x
        self.y = y
        self.st = st
        self.vida = st.vida
        self.vivo = True
        self.radio = tipo.radio
        self.capa = tipo.capa
        self.orden = None
        self.cola = []
        self.ruta = []
        self.ruta_meta = None
        self.ruta_pend = None
        self.fase = 0
        self.objetivo = 0
        self.auto = False
        self.enfr = 0
        self.dir = 2
        self.carga_tipo = 0
        self.carga = 0
        self.energia = tipo.energia_ini
        self.buffs = {}
        self.aura = {}
        self.emplazada = False
        self.emplazando = 0
        self.quieto = 0
        self.dentro = 0
        self.cargamento = []
        self.abatidos = 0
        self.mov_ticks = 0
        self.atasco = 0
        self.casa_x = x
        self.casa_y = y
        self.cd = {}
        self.regen = 0
        self.acum = 0
        self.oculta = tipo.camuflaje
        self.ataco_t = -9999
        self.golpeado_por = 0
        self.golpeado_t = -9999
        self.fantasma = False
        self.recurso_id = 0
        self.moviendo = False
        self.disparo_t = -9999
        self.espera = 0
        self.creada_t = tick
        self.buscar_t = (uid * 7) % 8
        self.ultimo_x = x
        self.ultimo_y = y
        self.base_id = 0         # camilleros: su hospital
        self.paciente = None     # camilleros: tipo del herido que llevan en la camilla

    def mod(self, campo, tick):
        v = self.aura.get(campo, 0)
        b = self.buffs.get(campo)
        if b is not None and b[1] > tick:
            v += b[0]
        return v

    def __repr__(self):
        return f"<{self.tipo.id}#{self.id} j{self.dueno} ({self.x // TILE},{self.y // TILE}) {self.vida}hp>"


class Edificio(Entidad):
    __slots__ = (
        "tx", "ty", "w", "h", "construido", "progreso", "constructor", "acum_vida", "cola",
        "reunion", "energia", "sabotaje_hasta", "guarnicion", "pozo", "ocupante",
        "ocupante_hasta", "enfr", "objetivo", "cd", "abatidos", "radio", "golpeado_t",
        "enfr_guarnicion", "dir", "camilleros", "camilleros_t", "pacientes",
    )
    es_edificio = True

    def __init__(self, uid, tipo, dueno, tx, ty, st, construido):
        self.id = uid
        self.clase = EDIFICIO
        self.tipo = tipo
        self.dueno = dueno
        self.tx = tx
        self.ty = ty
        self.w = tipo.ancho
        self.h = tipo.alto
        self.x = tx * TILE + self.w * TILE // 2
        self.y = ty * TILE + self.h * TILE // 2
        self.st = st
        self.construido = construido
        self.progreso = tipo.tiempo * 100 if construido else 0   # centésimas de tick
        self.vida = st.vida if construido else max(1, st.vida // 10)
        self.vivo = True
        self.constructor = 0
        self.acum_vida = 0
        self.cola = []          # [tipo ('u'|'m'), id, progreso, total, poblacion_reservada]
        self.reunion = None     # (x, y, id_objetivo)
        self.energia = tipo.energia_ini
        self.sabotaje_hasta = 0
        self.guarnicion = []
        self.pozo = 0
        self.ocupante = 0
        self.ocupante_hasta = 0
        self.enfr = 0
        self.objetivo = 0
        self.cd = {}
        self.abatidos = 0
        self.radio = tipo.radio
        self.golpeado_t = -9999
        self.enfr_guarnicion = {}
        self.dir = 2
        self.camilleros = []     # hospital: ids de sus equipos de camilleros
        self.camilleros_t = 0    # hospital: cuándo puede mandar un equipo nuevo
        self.pacientes = []      # hospital: [tipo de unidad, ticks que le faltan para volver a filas]

    def rect(self):
        return (self.tx * TILE, self.ty * TILE, (self.tx + self.w) * TILE, (self.ty + self.h) * TILE)

    def __repr__(self):
        return f"<{self.tipo.id}#{self.id} j{self.dueno} ({self.tx},{self.ty}) {self.vida}hp{'' if self.construido else ' en obra'}>"


class Herido(Entidad):
    """Soldado caído que todavía vive: espera a los camilleros hasta 'hasta' (tick)."""
    __slots__ = ("hasta", "camillero", "radio", "dir")
    es_herido = True

    def __init__(self, uid, tipo, dueno, x, y, hasta, direccion=2):
        self.id = uid
        self.clase = HERIDO
        self.tipo = tipo
        self.dueno = dueno
        self.x = x
        self.y = y
        self.vida = 1
        self.vivo = True
        self.st = None
        self.hasta = hasta
        self.camillero = 0
        self.radio = TILE // 4
        self.dir = direccion

    def __repr__(self):
        return f"<herido {self.tipo.id}#{self.id} j{self.dueno} ({self.x // TILE},{self.y // TILE})>"


class Recurso(Entidad):
    __slots__ = ("rtipo", "cantidad", "inicial", "tx", "ty", "w", "h", "minero", "molino", "radio")
    es_recurso = True

    def __init__(self, uid, rtipo, tx, ty, w, h, cantidad):
        self.id = uid
        self.clase = RECURSO
        self.tipo = None
        self.dueno = -1
        self.rtipo = rtipo
        self.cantidad = cantidad
        self.inicial = cantidad
        self.tx = tx
        self.ty = ty
        self.w = w
        self.h = h
        self.x = tx * TILE + w * TILE // 2
        self.y = ty * TILE + h * TILE // 2
        self.vida = 1
        self.vivo = True
        self.st = None
        self.minero = 0
        self.molino = 0
        self.radio = max(w, h) * TILE // 2

    def rect(self):
        return (self.tx * TILE, self.ty * TILE, (self.tx + self.w) * TILE, (self.ty + self.h) * TILE)

    def __repr__(self):
        return f"<{self.rtipo}#{self.id} ({self.tx},{self.ty}) {self.cantidad}>"


class Mina(Entidad):
    __slots__ = ("armada_t", "danio", "radio_expl", "activacion", "tipo_danio", "radio")
    es_mina = True

    def __init__(self, uid, dueno, x, y, hab, tick):
        self.id = uid
        self.clase = MINA
        self.tipo = None
        self.dueno = dueno
        self.x = x
        self.y = y
        self.vida = 1
        self.vivo = True
        self.st = None
        self.armada_t = tick + hab.armado
        self.danio = hab.danio
        self.radio_expl = hab.radio
        self.activacion = hab.activacion
        self.tipo_danio = hab.tipo_danio
        self.radio = TILE // 4


class Proyectil:
    __slots__ = ("x0", "y0", "x1", "y1", "llega", "danio", "tipo_danio", "salpicadura",
                 "dueno", "atacante", "objetivo", "bonus_edif", "danio_pct", "clase_arma")

    def __init__(self, x0, y0, x1, y1, llega, danio, tipo_danio, salpicadura, dueno,
                 atacante, objetivo=0, bonus_edif=0, danio_pct=0):
        self.x0 = x0
        self.y0 = y0
        self.x1 = x1
        self.y1 = y1
        self.llega = llega
        self.danio = danio
        self.tipo_danio = tipo_danio
        self.salpicadura = salpicadura
        self.dueno = dueno
        self.atacante = atacante
        self.objetivo = objetivo
        self.bonus_edif = bonus_edif
        self.danio_pct = danio_pct
        self.clase_arma = tipo_danio
