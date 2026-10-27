"""Arma para el cliente 3D un modelo que trae esqueleto (por ejemplo, el «rig» de Hi3D): lo
aligera conservando el esqueleto y los pesos, lo pinta con su lámina si viene sin color
(herramientas/pintar_modelo.py), le hace las animaciones y lo exporta a godot/arte/.

Necesita Blender como módulo de Python (bpy), que pide Python 3.11:

    uv venv --python 3.11 blender && uv pip install --python blender bpy scipy pillow
    blender/bin/python herramientas/armar_modelo.py arte_fuente/infante/receta.json

La receta (.json, rutas relativas a ella) es la de pintar_modelo.py (modelo, lámina, salida,
caras, textura, vistas, recolorear...) más "piernas" (ver Piernas: cada pierna envuelta con la
de la lámina, siguiendo sus huesos) y "animaciones": "infante" (las de la infantería: quieto,
marcha, fuego y muerte). Los huesos se reconocen por su lugar en el esqueleto (cadera,
columna, pecho, cuello, cabeza, brazos y piernas), no por su nombre. Las animaciones parten de
la pose del modelo: los brazos (y lo que llevan, como el fusil) siguen al pecho; las piernas se
ponen en la dirección que pide cada cuadro.

Escribe <salida>.glb (con la textura en <salida>.jpg, aparte) y <salida>.json (para arte.gd:
el paso de la marcha en casillas por segundo).
"""
import json
import math
import struct
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Matrix, Quaternion, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pintar_modelo  # noqa: E402

FPS = 30
ALTO_JUEGO = 0.72 * 1.45     # alto de la figura de un infante en el juego (Tropas.alto_juego), en casillas


# ----------------------------------------------------------------------
# Modelo: cargar, unir costuras, aligerar y sacar los datos para pintar

def cargar(ruta):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(ruta))
    arm = [o for o in bpy.context.scene.objects if o.type == "ARMATURE"]
    mallas = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    if not arm or not mallas:
        sys.exit("El modelo no trae esqueleto (o no trae malla): use pintar_modelo.py")
    bpy.ops.object.select_all(action="DESELECT")
    for m in mallas:
        m.select_set(True)
    bpy.context.view_layer.objects.active = mallas[0]
    if len(mallas) > 1:
        bpy.ops.object.join()
    malla = bpy.context.view_layer.objects.active
    # Hi3D deja el modelo dentro de un nodo raíz achicado: se lleva todo a su tamaño real (el
    # esqueleto y la malla sin escala ni padre), para que el .glb no quede con dos escalas
    bpy.ops.object.select_all(action="DESELECT")
    arm[0].select_set(True)
    bpy.context.view_layer.objects.active = arm[0]
    bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
    malla.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    for o in list(bpy.context.scene.objects):
        if o.type == "EMPTY" and not o.children:
            bpy.data.objects.remove(o)
    print("escala aplicada:", tuple(round(v, 4) for v in arm[0].matrix_world.to_scale()))
    return arm[0], malla


def aligerar(malla, caras):
    bpy.context.view_layer.objects.active = malla
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    # las costuras del atlas parten la malla en islas: se unen antes de aligerar
    bpy.ops.mesh.remove_doubles(threshold=1e-6)
    bpy.ops.object.mode_set(mode="OBJECT")
    antes = sum(len(p.vertices) - 2 for p in malla.data.polygons)
    if caras < antes:
        mod = malla.modifiers.new("aligerar", "DECIMATE")
        mod.ratio = caras / antes
        mod.use_collapse_triangulate = True
        bpy.ops.object.modifier_move_to_index(modifier="aligerar", index=0)
        bpy.ops.object.modifier_apply(modifier="aligerar")
    mod = malla.modifiers.new("triangular", "TRIANGULATE")
    bpy.ops.object.modifier_move_to_index(modifier="triangular", index=0)
    bpy.ops.object.modifier_apply(modifier="triangular")
    print(f"malla: {antes} -> {len(malla.data.polygons)} triángulos, {len(malla.data.vertices)} vértices")


def desplegar(malla):
    """Un atlas UV nuevo (el de la herramienta se pierde al aligerar)."""
    bpy.context.view_layer.objects.active = malla
    while malla.data.uv_layers:
        malla.data.uv_layers.remove(malla.data.uv_layers[0])
    malla.data.uv_layers.new(name="UVMap")
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.004)
    bpy.ops.object.mode_set(mode="OBJECT")


def datos(malla):
    """Vértices, normales y triángulos en el espacio del glTF (Y arriba, el frente hacia +Z), las
    aristas, y por cada esquina de triángulo su vértice y su UV."""
    malla.data.calc_loop_triangles()
    mw = malla.matrix_world
    nw = mw.to_3x3().inverted().transposed()
    def gltf(v):
        return (v.x, v.z, -v.y)
    V = np.array([gltf(mw @ v.co) for v in malla.data.vertices])
    N = np.array([gltf((nw @ v.normal).normalized()) for v in malla.data.vertices])
    tris = malla.data.loop_triangles
    F = np.array([t.vertices[:] for t in tris])
    uvs = malla.data.uv_layers.active.data
    UV = np.array([[uvs[l].uv[:] for l in t.loops] for t in tris])
    aristas = np.array([e.vertices[:] for e in malla.data.edges])
    return V, N, F, UV, aristas


def material(malla, textura):
    img = bpy.data.images.load(str(textura))
    mat = bpy.data.materials.new("Pintura")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    tex = mat.node_tree.nodes.new("ShaderNodeTexImage")
    tex.image = img
    mat.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.9
    bsdf.inputs["Metallic"].default_value = 0.0
    malla.data.materials.clear()
    malla.data.materials.append(mat)


# ----------------------------------------------------------------------
# Esqueleto: qué hueso es cuál

class Esqueleto:
    """Reconoce los huesos de un esqueleto humano por su lugar: la cadera es la raíz; de ella
    salen la columna (hacia arriba) y las piernas; del pecho, el cuello y los brazos."""

    def __init__(self, arm):
        self.arm = arm
        huesos = arm.data.bones
        m3 = arm.matrix_world.to_3x3().inverted()
        self.arriba = (m3 @ Vector((0, 0, 1))).normalized()
        self.frente = (m3 @ Vector((0, -1, 0))).normalized()      # el +Z del glTF
        self.izquierda = self.arriba.cross(self.frente).normalized()
        raices = [b for b in huesos if b.parent is None]
        self.cadera = max(raices, key=lambda b: len(b.children_recursive))
        def alt(b):
            return b.head_local.dot(self.arriba)
        hijos = list(self.cadera.children)
        sube = max(hijos, key=lambda b: max(alt(x) for x in [b] + list(b.children_recursive)))
        self.columna = []
        b = sube
        while b is not None:
            self.columna.append(b)
            if len(b.children) != 1:
                break
            b = b.children[0]
        self.pecho = self.columna[-1]
        ramas = list(self.pecho.children)
        cuello = max(ramas, key=lambda r: alt(max([r] + list(r.children_recursive), key=alt)))
        self.cuello = cuello
        self.cabeza = cuello.children[0] if cuello.children else cuello
        def lado(b):
            return (b.head_local - self.cadera.head_local).dot(self.izquierda)
        self.brazos = {}
        for r in ramas:
            if r != cuello:
                self.brazos["i" if lado(max(r.children_recursive or [r], key=lambda x: abs(lado(x)))) > 0 else "d"] = r
        self.piernas = {}
        for r in hijos:
            if r != sube:
                cadena = [r]
                while cadena[-1].children:
                    cadena.append(max(cadena[-1].children, key=lambda x: len(x.children_recursive)))
                self.piernas["i" if lado(cadena[-1]) > 0 else "d"] = cadena[:4]
        if set(self.piernas) != {"i", "d"}:
            sys.exit("No se reconocen las dos piernas en el esqueleto")
        nombres = {"cadera": self.cadera.name, "columna": [b.name for b in self.columna], "cuello": self.cuello.name,
                   "cabeza": self.cabeza.name, "brazos": {k: v.name for k, v in self.brazos.items()},
                   "piernas": {k: [b.name for b in v] for k, v in self.piernas.items()}}
        print("huesos:", nombres)
        # largo de la pierna (de la cadera al tobillo) y alto de la cadera sobre el suelo
        muslo, _, pie = self.piernas["i"][0], self.piernas["i"][1], self.piernas["i"][2]
        self.pierna = (muslo.head_local - pie.head_local).length
        self.suelo = min(alt(b) for b in huesos) - 0.02 * self.pierna

    def dir_reposo(self, b):
        """Hacia dónde apunta el hueso en reposo: hacia la cabeza de su hijo (las colas de estos
        esqueletos no siempre siguen al miembro)."""
        hijo = max(b.children, key=lambda x: len(x.children_recursive)) if b.children else None
        d = (hijo.head_local - b.head_local) if hijo else (b.tail_local - b.head_local)
        return d.normalized()


class Piernas:
    """Pinta las piernas (del borde de la casaca a la suela) envolviendo cada una con la pierna de
    adelante de la lámina, siguiendo sus huesos: sirve aunque la herramienta haya abierto las
    piernas distinto del dibujo. La pierna izquierda usa la misma, espejada. conf: "lamina_x":
    [centro, medio ancho] y "lamina_y": [borde de la casaca, suela] de esa pierna en la lámina,
    "dobladillo": alto del borde de la casaca (fracción del alto del modelo), "radio": cuánto se
    aleja la pierna de sus huesos (ídem)."""

    def __init__(self, conf, lamina, esq, V):
        self.c = conf
        self.lam = lamina
        base, alto = V[:, 1].min(), V[:, 1].max() - V[:, 1].min()
        self.base = base
        self.tope = base + conf["dobladillo"] * alto
        self.radio = conf.get("radio", 0.065) * alto
        self.suave = 0.02 * alto
        mw = esq.arm.matrix_world
        def gltf(v):
            v = mw @ v
            return np.array([v.x, v.z, -v.y])
        self.piernas = []
        for lado, cadena in esq.piernas.items():
            puntos = [gltf(b.head_local) for b in cadena] + [gltf(cadena[-1].tail_local)]
            adentro = np.array([1.0, 0, 0]) if lado == "d" else np.array([-1.0, 0, 0])
            self.piernas.append((np.array(puntos), adentro))

    def color(self, X, _N):
        mejor = np.full(len(X), np.inf)
        cerca = np.zeros_like(X)
        eje = np.zeros_like(X)
        adentro = np.zeros_like(X)
        for puntos, hacia_adentro in self.piernas:
            for a, b in zip(puntos[:-1], puntos[1:]):
                ab = b - a
                t = np.clip(((X - a) @ ab) / max(ab @ ab, 1e-12), 0, 1)
                P = a + t[:, None] * ab
                d = np.linalg.norm(X - P, axis=1)
                m = d < mejor
                mejor[m] = d[m]
                cerca[m] = P[m]
                eje[m] = ab / max(np.linalg.norm(ab), 1e-12)
                adentro[m] = hacia_adentro
        r = X - cerca
        r -= eje * np.sum(r * eje, axis=1, keepdims=True)
        frente = np.array([0, 0, 1.0]) - eje * eje[:, 2:3]
        frente /= np.maximum(np.linalg.norm(frente, axis=1, keepdims=True), 1e-9)
        lado = adentro - eje * np.sum(adentro * eje, axis=1, keepdims=True)
        th = np.arctan2(np.sum(r * lado, axis=1), np.sum(r * frente, axis=1))
        # la parte de atrás de la pierna, como la de adelante (espejada)
        th = np.where(np.abs(th) > np.pi / 2, np.sign(th) * (np.pi - np.abs(th)), th)
        cx, medio = self.c["lamina_x"]
        y0, y1 = self.c["lamina_y"]
        px = cx + th / (np.pi / 2) * medio * 0.95
        py = y0 + (self.tope - X[:, 1]) / (self.tope - self.base) * (y1 - y0)
        c = self.lam.muestra(px, py)
        peso = (mejor < self.radio) * np.clip((self.tope - X[:, 1]) / self.suave, 0, 1) * (c[:, 3] > 0.5)
        return c[:, :3], peso.astype(float)


# ----------------------------------------------------------------------
# Poses y animaciones

def poner(pb, R, cabeza=None):
    """Orienta el hueso en el espacio del esqueleto: R aplicado a su orientación de reposo,
    girando en su cabeza (o llevándola a «cabeza»)."""
    rot = R.to_matrix() @ pb.bone.matrix_local.to_3x3()
    h = cabeza if cabeza is not None else pb.head
    pb.matrix = Matrix.Translation(h) @ rot.to_4x4()
    bpy.context.view_layer.update()


def apuntar(esq, pb, direccion):
    """Gira el hueso para que su miembro apunte hacia «direccion» (espacio del esqueleto)."""
    poner(pb, esq.dir_reposo(pb.bone).rotation_difference(direccion.normalized()))


def hacia(esq, inclinacion):
    """Hacia abajo, inclinado tantos grados hacia adelante (o hacia atrás)."""
    a = math.radians(inclinacion)
    return -esq.arriba * math.cos(a) + esq.frente * math.sin(a)


def piernas(esq, poses):
    """poses: {"i": (muslo°, rodilla°), "d": (...)}: el muslo inclinado hacia adelante y la
    rodilla doblada hacia atrás; el pie, plano."""
    p = esq.arm.pose.bones
    for lado, (muslo, rodilla) in poses.items():
        m, r, pie = [p[b.name] for b in esq.piernas[lado][:3]]
        apuntar(esq, m, hacia(esq, muslo))
        apuntar(esq, r, hacia(esq, muslo - rodilla))
        plano = esq.dir_reposo(pie.bone)
        plano = (plano - esq.arriba * plano.dot(esq.arriba)).normalized()
        apuntar(esq, pie, plano * math.cos(math.radians(10)) - esq.arriba * math.sin(math.radians(10)))


def girar(esq, nombre, eje, grados):
    """Gira un hueso alrededor de un eje del esqueleto (relativo a su reposo)."""
    pb = esq.arm.pose.bones[nombre]
    poner(pb, Quaternion(eje, math.radians(grados)))


def limpiar(esq):
    for pb in esq.arm.pose.bones:
        pb.rotation_mode = "QUATERNION"
        pb.rotation_quaternion = Quaternion()
        pb.location = Vector()
        pb.scale = Vector((1, 1, 1))
    bpy.context.view_layer.update()


def guardar_cuadro(esq, cuadro):
    for pb in esq.arm.pose.bones:
        pb.keyframe_insert("rotation_quaternion", frame=cuadro)
        pb.keyframe_insert("location", frame=cuadro)


def nueva_accion(esq, nombre):
    accion = bpy.data.actions.new(nombre)
    esq.arm.animation_data_create()
    esq.arm.animation_data.action = accion
    return accion


def guardar_accion(esq, accion):
    pista = esq.arm.animation_data.nla_tracks.new()
    pista.name = accion.name
    pista.strips.new(accion.name, int(accion.frame_range[0]), accion)
    esq.arm.animation_data.action = None


def cadera_en(esq, desplazamiento, R=Quaternion(), pivote=None):
    """Mueve la cadera (y con ella todo el cuerpo): R girando alrededor de «pivote»."""
    pb = esq.arm.pose.bones[esq.cadera.name]
    h0 = esq.cadera.head_local
    if pivote is not None:
        h = pivote + R @ (h0 - pivote)
    else:
        h = h0.copy()
    poner(pb, R, h + desplazamiento)


def anim_quieto(esq):
    """En guardia: de pie, respirando, mirando un poco a los lados (2 s, en bucle)."""
    accion = nueva_accion(esq, "Idle")
    for cuadro in range(0, 2 * FPS + 1, 5):
        t = cuadro / (2 * FPS) * 2 * math.pi
        limpiar(esq)
        cadera_en(esq, esq.arriba * (-0.004 * esq.pierna * (1 - math.cos(t))))
        piernas(esq, {"i": (-4, 2), "d": (4, 2)})
        girar(esq, esq.pecho.name, esq.izquierda, 1.5 * math.sin(t))
        girar(esq, esq.cabeza.name, esq.arriba, 6 * math.sin(t * 0.5))
        guardar_cuadro(esq, cuadro)
    guardar_accion(esq, accion)


def anim_marcha(esq, amplitud=24.0, rodilla=42.0):
    """Paso de marcha (1 s = dos pasos, en bucle): las piernas se alternan, la cadera sube y
    baja y se mece; el pecho, los brazos y el fusil van firmes."""
    accion = nueva_accion(esq, "Walk")
    for cuadro in range(0, FPS + 1, 2):
        p = cuadro / FPS * 2 * math.pi
        limpiar(esq)
        cadera_en(esq, esq.arriba * (0.025 * esq.pierna * math.cos(2 * p) - 0.02 * esq.pierna))
        girar(esq, esq.cadera.name, esq.arriba, 4 * math.cos(p))
        fi = amplitud * math.cos(p)
        piernas(esq, {"i": (fi, rodilla * max(0.0, -math.sin(p)) + 4),
                      "d": (-fi, rodilla * max(0.0, math.sin(p)) + 4)})
        girar(esq, esq.columna[0].name, esq.arriba, -4 * math.cos(p))
        guardar_cuadro(esq, cuadro)
    guardar_accion(esq, accion)
    # casillas que avanza un paso de marcha: dos pasos de 2·L·sen(amplitud) por ciclo
    return 2 * 2 * esq.pierna * math.sin(math.radians(amplitud))


def anim_fuego(esq):
    """Fuego: el culatazo echa atrás el pecho (y alza el arma) y vuelve (0,8 s)."""
    accion = nueva_accion(esq, "Fire")
    for cuadro, atras in ((0, 0.0), (2, 15.0), (5, 12.0), (12, 4.0), (24, 0.0)):
        limpiar(esq)
        cadera_en(esq, -esq.frente * 0.05 * esq.pierna * atras / 15.0)
        piernas(esq, {"i": (-9, 6), "d": (10, 8)})
        girar(esq, esq.pecho.name, esq.izquierda, -atras)
        girar(esq, esq.cabeza.name, esq.izquierda, atras * 0.4)
        guardar_cuadro(esq, cuadro)
    guardar_accion(esq, accion)


def anim_muerte(esq):
    """Muerte: se le doblan las rodillas y cae de espaldas (1,4 s)."""
    accion = nueva_accion(esq, "Death")
    pivote = esq.cadera.head_local.copy()
    pivote -= esq.arriba * (esq.cadera.head_local.dot(esq.arriba) - esq.suelo)
    pivote -= esq.frente * 0.35 * esq.pierna
    claves = ((0, 0, 0, 0), (8, 6, 30, 0.12), (16, 30, 35, 0.2), (26, 84, 20, 0.0), (31, 78, 14, 0.0), (42, 86, 12, 0.0))
    for cuadro, caida, rodilla, baja in claves:
        limpiar(esq)
        piernas(esq, {"i": (rodilla * 0.6, rodilla), "d": (rodilla * 0.5, rodilla * 0.9)})
        girar(esq, esq.pecho.name, esq.izquierda, -min(caida, 30) * 0.3)
        girar(esq, esq.cabeza.name, esq.izquierda, -min(caida, 40) * 0.4)
        locales = {pb.name: pb.rotation_quaternion.copy() for pb in esq.arm.pose.bones}
        R = Quaternion(esq.izquierda, -math.radians(caida))
        cadera_en(esq, -esq.arriba * baja * esq.pierna * 0.5, R, pivote)
        # la cadera giró: el resto del cuerpo conserva su pose respecto de ella
        for pb in esq.arm.pose.bones:
            if pb.name != esq.cadera.name:
                pb.rotation_quaternion = locales[pb.name]
        bpy.context.view_layer.update()
        guardar_cuadro(esq, cuadro)
    guardar_accion(esq, accion)


# ----------------------------------------------------------------------
# Exportación: .glb con la textura aparte

def exportar(salida):
    tmp = salida.with_suffix(".gltf")
    bpy.ops.export_scene.gltf(filepath=str(tmp), export_format="GLTF_SEPARATE", export_image_format="JPEG",
                              export_texture_dir="", export_animations=True, export_animation_mode="NLA_TRACKS",
                              export_skins=True, export_yup=True, export_apply=False)
    doc = json.loads(tmp.read_text(encoding="utf-8"))
    binario = (tmp.parent / doc["buffers"][0]["uri"]).read_bytes()
    (tmp.parent / doc["buffers"][0]["uri"]).unlink()
    tmp.unlink()
    for im in doc.get("images", []):
        # Blender escribe la imagen con su nombre: se deja como <salida>.jpg
        origen = tmp.parent / im["uri"]
        destino = salida.with_suffix(".jpg")
        if origen != destino:
            origen.replace(destino)
        im["uri"] = destino.name
    del doc["buffers"][0]["uri"]
    js = json.dumps(doc, separators=(",", ":")).encode()
    js += b" " * (-len(js) % 4)
    binario += b"\0" * (-len(binario) % 4)
    with open(salida.with_suffix(".glb"), "wb") as f:
        f.write(struct.pack("<4sII", b"glTF", 2, 12 + 8 + len(js) + 8 + len(binario)))
        f.write(struct.pack("<I4s", len(js), b"JSON") + js)
        f.write(struct.pack("<I4s", len(binario), b"BIN\0") + binario)
    print("animaciones:", [a.get("name") for a in doc.get("animations", [])])


def main(ruta_conf):
    ruta_conf = Path(ruta_conf)
    conf = json.loads(ruta_conf.read_text(encoding="utf-8"))
    base = ruta_conf.parent
    salida = (base / conf["salida"]).resolve()
    arm, malla = cargar(base / conf["modelo"])
    aligerar(malla, int(conf.get("caras", 10000)))
    desplegar(malla)
    V, N, F, UV, aristas = datos(malla)
    lamina = pintar_modelo.Lamina(base / conf["lamina"], conf.get("recolorear", ()))
    esq = Esqueleto(arm)
    fuentes = pintar_modelo.armar_fuentes(conf, lamina, V, F)
    if "piernas" in conf:
        fuentes.insert(0, Piernas(conf["piernas"], lamina, esq, V))
    C = pintar_modelo.colores_vertices(fuentes, V, N, aristas)
    # una «esquina» por vértice de cada triángulo, con su UV
    esquinas = F.reshape(-1)
    lado = int(conf.get("textura", 1024))
    tex = pintar_modelo.hornear(fuentes, V[esquinas], N[esquinas], C[esquinas], UV.reshape(-1, 2),
                                np.arange(len(esquinas)).reshape(-1, 3), lado)
    textura = pintar_modelo.guardar_textura(tex, conf, salida.with_name(salida.name + "_pintura"))
    material(malla, textura)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="POSE")
    paso = 0.0
    if conf.get("animaciones") == "infante":
        anim_quieto(esq)
        paso = anim_marcha(esq)
        anim_fuego(esq)
        anim_muerte(esq)
    limpiar(esq)
    bpy.ops.object.mode_set(mode="OBJECT")
    exportar(salida)
    textura.unlink(missing_ok=True)
    # alto del modelo (para pasar el paso a casillas): el de su malla
    alto = float(V[:, 1].max() - V[:, 1].min())
    juego = {}
    if paso:
        escala = ALTO_JUEGO / alto
        juego["marcha"] = round(paso * escala, 3)
    juego.update(conf.get("juego", {}))
    salida.with_suffix(".json").write_text(json.dumps(juego, indent="\t") + "\n", encoding="utf-8")
    print(f"listo: {salida.with_suffix('.glb')}, {salida.with_suffix('.jpg').name} y {salida.with_suffix('.json').name}: {juego}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
