"""Pinta un modelo 3D sin color con su lámina de referencia y lo deja listo para el cliente 3D.

Las herramientas que convierten una imagen en un modelo 3D (Hi3D, Meshy, Tripo...) a veces
entregan solo la forma, sin textura, y si se les da una lámina con varias vistas arman una
figura por vista. Esta herramienta:

1. separa la figura grande (la de más caras) de las demás;
2. la aligera (unas 14 000 caras) y le hace un atlas UV nuevo;
3. ajusta cada vista de la lámina a la silueta del modelo (escala, corrimiento y alzada) y
   proyecta sus colores sobre lo que esa vista muestra; las piezas que la herramienta deformó
   (el barril de la cantinera, mucho más grande que el dibujado) se envuelven con su dibujo
   alrededor de un eje vertical; lo que ninguna vista muestra toma el color de lo vecino que
   sí se ve, por la superficie y sin cruzar pliegues;
4. hornea la textura (JPEG) y escribe un .glb con la textura en un archivo aparte, para que
   Godot no la saque del .glb ni quede repetida.

    pip install numpy pillow scipy trimesh fast-simplification xatlas
    python herramientas/pintar_modelo.py arte_fuente/cantinera/pintura.json

El .json de cada modelo (las rutas, relativas a él) lleva el modelo de la herramienta, la
lámina, la salida (sin extensión) y las vistas: un punto de la lámina dentro de la figura de
esa vista, el rumbo de la cámara (0: de frente, desde +Z; 180: de espaldas), la fila desde la
que hay sombra pintada en el suelo (no cuenta en el ajuste), las alzadas que se prueban y el
umbral de lo que se pinta (cuánto tiene que mirar a la cámara una cara). Ver
arte_fuente/LEEME.md.
"""
import json
import struct
import sys
from pathlib import Path

import fast_simplification
import numpy as np
import trimesh
import xatlas
from PIL import Image, ImageDraw
from scipy import ndimage, sparse
from scipy.sparse.csgraph import dijkstra


def figura_grande(ruta, caras):
    """La figura con más caras del modelo, aligerada: (vértices, caras, normales, aristas)."""
    escena = trimesh.load(ruta, process=False)
    m = list(escena.geometry.values())[0] if isinstance(escena, trimesh.Scene) else escena
    solo = trimesh.Trimesh(vertices=m.vertices.copy(), faces=m.faces.copy(), process=False)
    solo.merge_vertices(merge_tex=True, merge_norm=True)
    etq = trimesh.graph.connected_component_labels(solo.face_adjacency, node_count=len(solo.faces))
    fig = trimesh.Trimesh(vertices=solo.vertices, faces=solo.faces[etq == np.bincount(etq).argmax()], process=True)
    fig.remove_unreferenced_vertices()
    print(f"figura grande: {len(fig.vertices)} vértices, {len(fig.faces)} caras (de {len(m.faces)})")
    if caras < len(fig.faces):
        v, f = fast_simplification.simplify(fig.vertices.astype(np.float32), fig.faces.astype(np.int32),
                                            target_reduction=1.0 - caras / len(fig.faces))
        fig = trimesh.Trimesh(vertices=v, faces=f, process=True)
        fig.remove_unreferenced_vertices()
        print(f"aligerada: {len(fig.vertices)} vértices, {len(fig.faces)} caras")
    return np.asarray(fig.vertices), np.asarray(fig.faces), np.asarray(fig.vertex_normals), fig.edges_unique


def triangulos(puntos, caras, ancho, alto):
    """Recorre los píxeles que cubre cada triángulo: (caras, y0, x0, dentro, l1, l2, l3) por
    triángulo, con las coordenadas baricéntricas de cada píxel de su recuadro."""
    for t in caras:
        a, b, c = puntos[t]
        x0 = max(int(np.floor(min(a[0], b[0], c[0]))), 0)
        x1 = min(int(np.ceil(max(a[0], b[0], c[0]))), ancho - 1)
        y0 = max(int(np.floor(min(a[1], b[1], c[1]))), 0)
        y1 = min(int(np.ceil(max(a[1], b[1], c[1]))), alto - 1)
        det = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
        if x1 < x0 or y1 < y0 or abs(det) < 1e-12:
            continue
        gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
        l1 = ((b[1] - c[1]) * (gx - c[0]) + (c[0] - b[0]) * (gy - c[1])) / det
        l2 = ((c[1] - a[1]) * (gx - c[0]) + (a[0] - c[0]) * (gy - c[1])) / det
        yield t, y0, x0, l1, l2, 1 - l1 - l2


class Lamina:
    def __init__(self, ruta):
        self.img = np.asarray(Image.open(ruta).convert("RGBA")).astype(np.float32) / 255.0
        self.alto, self.ancho = self.img.shape[:2]
        self.manchas, _ = ndimage.label(self.img[..., 3] > 0.5)

    def muestra(self, px, py):
        """Color bilineal (rgba) en esos puntos."""
        x = np.clip(px - 0.5, 0, self.ancho - 1.001)
        y = np.clip(py - 0.5, 0, self.alto - 1.001)
        x0 = np.floor(x).astype(int)
        y0 = np.floor(y).astype(int)
        fx = (x - x0)[..., None]
        fy = (y - y0)[..., None]
        i = self.img
        return (i[y0, x0] * (1 - fx) * (1 - fy) + i[y0, x0 + 1] * fx * (1 - fy)
                + i[y0 + 1, x0] * (1 - fx) * fy + i[y0 + 1, x0 + 1] * fx * fy)


class Vista:
    """Una vista de la lámina como una cámara ortográfica ajustada a la silueta del modelo."""

    def __init__(self, conf, lamina, V, F):
        self.lam = lamina
        self.V, self.F = V, F
        self.nombre = conf["nombre"]
        self.rumbo = np.radians(conf["rumbo"])
        self.umbral = conf["umbral"]
        self.corte = conf["corte"]
        x, y = conf["punto"]
        self.mascara = lamina.manchas == lamina.manchas[y, x]
        ys, xs = np.where(self.mascara)
        self.caja = (xs.min(), xs.max(), ys.min(), ys.max())
        lo, hi = V.min(0), V.max(0)
        self.tolerancia = 0.02 * (hi - lo).max()
        mejor = None
        for alzada in conf["alzadas"]:
            self.camara(alzada)
            r = self.ajustar()
            if mejor is None or r[0] > mejor[0]:
                mejor = r + (alzada,)
        iou, self.s, self.a, self.tx, self.ty, alzada = mejor
        print(f"vista {self.nombre}: coincide {iou:.3f} con la silueta (alzada {alzada}°)")
        self.camara(alzada)
        self.profundidad()

    def camara(self, alzada):
        t = np.radians(alzada)
        f = np.array([-np.sin(self.rumbo), 0.0, -np.cos(self.rumbo)])
        self.mira = np.array([f[0] * np.cos(t), -np.sin(t), f[2] * np.cos(t)])
        self.arriba = np.array([f[0] * np.sin(t), np.cos(t), f[2] * np.sin(t)])
        self.derecha = np.array([np.cos(self.rumbo), 0.0, -np.sin(self.rumbo)])

    def proyectar(self, X, s=None, a=None, tx=None, ty=None):
        s = self.s if s is None else s
        a = self.a if a is None else a
        tx = self.tx if tx is None else tx
        ty = self.ty if ty is None else ty
        return tx + s * a * (X @ self.derecha), ty - s * (X @ self.arriba)

    def iou(self, s, a, tx, ty):
        im = Image.new("L", (self.lam.ancho, self.lam.alto), 0)
        d = ImageDraw.Draw(im)
        px, py = self.proyectar(self.V, s, a, tx, ty)
        for t in self.F:
            d.polygon([(px[t[0]], py[t[0]]), (px[t[1]], py[t[1]]), (px[t[2]], py[t[2]])], fill=255)
        x0, x1, y0, _ = self.caja
        r = (slice(max(0, y0 - 40), self.corte), slice(max(0, x0 - 80), min(self.lam.ancho, x1 + 80)))
        m = (np.asarray(im) > 0)[r]
        b = self.mascara[r]
        return (m & b).sum() / max(1, (m | b).sum())

    def ajustar(self):
        x0, x1, y0, y1 = self.caja
        arriba = self.V @ self.arriba
        derecha = self.V @ self.derecha
        s = (y1 - y0) / (arriba.max() - arriba.min())
        tx = (x0 + x1) / 2 - s * (derecha.max() + derecha.min()) / 2
        ty = y0 + s * arriba.max()
        mejor = (self.iou(s, 1.0, tx, ty), s, 1.0, tx, ty)
        for paso in [8.0, 4.0, 2.0, 1.0, 0.5]:
            cambio = True
            while cambio:
                cambio = False
                _, s0, a0, tx0, ty0 = mejor
                for ds, da, dx, dy in [(paso * 0.01 * s0, 0, 0, 0), (-paso * 0.01 * s0, 0, 0, 0),
                                       (0, paso * 0.01, 0, 0), (0, -paso * 0.01, 0, 0),
                                       (0, 0, paso, 0), (0, 0, -paso, 0), (0, 0, 0, paso), (0, 0, 0, -paso)]:
                    c = (self.iou(s0 + ds, a0 + da, tx0 + dx, ty0 + dy), s0 + ds, a0 + da, tx0 + dx, ty0 + dy)
                    if c[0] > mejor[0] + 1e-5:
                        mejor = c
                        cambio = True
        return mejor

    def profundidad(self):
        """Lo más cercano a la cámara en cada píxel."""
        px, py = self.proyectar(self.V)
        cerca = -(self.V @ self.mira)
        self.prof = np.full((self.lam.alto, self.lam.ancho), -np.inf, np.float32)
        for t, y0, x0, l1, l2, l3 in triangulos(np.stack([px, py], 1), self.F, self.lam.ancho, self.lam.alto):
            dentro = (l1 >= -1e-4) & (l2 >= -1e-4) & (l3 >= -1e-4)
            z = np.where(dentro, l1 * cerca[t[0]] + l2 * cerca[t[1]] + l3 * cerca[t[2]], -np.inf)
            r = self.prof[y0:y0 + z.shape[0], x0:x0 + z.shape[1]]
            np.maximum(r, z, out=r)

    def color(self, X, N):
        """(rgb, peso) de la lámina en esos puntos; peso 0 si esta vista no los muestra."""
        px, py = self.proyectar(X)
        c = self.lam.muestra(px, py)
        xi = np.clip(px.astype(int), 0, self.lam.ancho - 1)
        yi = np.clip(py.astype(int), 0, self.lam.alto - 1)
        delante = -(X @ self.mira) >= self.prof[yi, xi] - self.tolerancia
        peso = np.clip((-(N @ self.mira) - self.umbral) / 0.2, 0.0, 1.0)
        return c[..., :3], np.where(delante & self.mascara[yi, xi] & (c[..., 3] > 0.5), peso, 0.0)


class Envoltura:
    """Una pieza (en una caja del modelo) que se envuelve con un rectángulo de la lámina
    alrededor de un eje vertical: el centro del rectángulo mira hacia -Z (atrás)."""

    def __init__(self, conf, lamina):
        self.c = conf
        self.lam = lamina

    def color(self, X, _N):
        c = self.c
        x, y, z = X[..., 0], X[..., 1], X[..., 2]
        peso = (np.clip((c["z_max"] + 0.03 - z) / 0.12, 0, 1)
                * np.clip((y - c["y"][0] + 0.05) / 0.1, 0, 1) * np.clip((c["y"][1] + 0.1 - y) / 0.1, 0, 1)
                * np.clip((x - c["x"][0]) / 0.1, 0, 1) * np.clip((c["x"][1] - x) / 0.1, 0, 1))
        u = np.clip(np.arctan2(x - c["eje"][0], -(z - c["eje"][1])) / (np.pi / 2), -0.95, 0.95)
        v = np.clip((c["y"][1] - y) / (c["y"][1] - c["y"][0]), 0, 1)
        px = c["lamina_x"][0] - u * c["lamina_x"][1]
        py = c["lamina_y"][0] + v * (c["lamina_y"][1] - c["lamina_y"][0])
        xi = np.clip(px.astype(int), 0, self.lam.ancho - 1)
        yi = np.clip(py.astype(int), 0, self.lam.alto - 1)
        return self.lam.img[yi, xi, :3], peso


def mezcla(fuentes, X, N, base):
    """Cada fuente llena lo que las anteriores no pintaron; el resto queda con base."""
    resto = np.ones(len(X))
    col = np.zeros((len(X), 3))
    for f in fuentes:
        c, w = f.color(X, N)
        w = w * resto
        col += c * w[:, None]
        resto -= w
    return col + base * resto[:, None], 1.0 - resto


def colores_vertices(fuentes, V, N, aristas):
    """El color de cada vértice: el de la lámina si se ve; si no, el del vértice visto más
    cercano por la superficie (cruzar un pliegue cuesta mucho más), suavizado."""
    rgb, peso = mezcla(fuentes, V, N, np.zeros((len(V), 3)))
    visto = peso > 0.5
    rgb = np.where(visto[:, None], rgb / np.maximum(peso, 1e-6)[:, None], 0.0)
    print(f"vértices pintados desde la lámina: {visto.mean():.0%}")
    n = len(V)
    a, b = aristas[:, 0], aristas[:, 1]
    largo = np.linalg.norm(V[a] - V[b], axis=1)
    pliegue = 1.0 - np.clip(np.sum(N[a] * N[b], axis=1), -1.0, 1.0)
    costo = largo * (1.0 + 12.0 * pliegue)
    G = sparse.coo_matrix((np.r_[costo, costo], (np.r_[a, b], np.r_[b, a])), shape=(n, n)).tocsr()
    _, _, origen = dijkstra(G, directed=False, indices=np.where(visto)[0], min_only=True, return_predecessors=True)
    col = rgb.copy()
    falta = ~visto & (origen >= 0)
    col[falta] = rgb[origen[falta]]
    A = sparse.coo_matrix((np.ones(len(a) * 2), (np.r_[a, b], np.r_[b, a])), shape=(n, n)).tocsr()
    grado = np.maximum(np.asarray(A.sum(1)).ravel(), 1)
    for _ in range(8):
        col = np.where(visto[:, None], col, (A @ col) / grado[:, None])
    return col


def hornear(fuentes, V, N, C, uv, caras, lado):
    """La textura (lado × lado): cada texel, con el color de la lámina donde se ve y el de los
    vértices donde no; con un margen alrededor de cada isla del atlas."""
    tex = np.zeros((lado, lado, 3), np.float32)
    lleno = np.zeros((lado, lado), bool)
    UV = np.stack([uv[:, 0] * lado, (1 - uv[:, 1]) * lado], 1)
    for t, y0, x0, l1, l2, l3 in triangulos(UV, caras, lado, lado):
        dentro = (l1 >= -0.02) & (l2 >= -0.02) & (l3 >= -0.02)
        if not dentro.any():
            continue
        l = np.stack([l1, l2, l3], -1)[dentro]
        nor = l @ N[t]
        nor /= np.maximum(np.linalg.norm(nor, axis=1, keepdims=True), 1e-9)
        final, _ = mezcla(fuentes, l @ V[t], nor, l @ C[t])
        yy, xx = np.where(dentro)
        tex[yy + y0, xx + x0] = final
        lleno[yy + y0, xx + x0] = True
    for _ in range(6):
        nuevos = (ndimage.grey_dilation(lleno.astype(np.uint8), size=3) > 0) & ~lleno
        if not nuevos.any():
            break
        suma = np.zeros_like(tex)
        cuenta = np.zeros((lado, lado), np.float32)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                suma += np.roll(np.roll(tex * lleno[..., None], dy, 0), dx, 1)
                cuenta += np.roll(np.roll(lleno.astype(np.float32), dy, 0), dx, 1)
        tex[nuevos] = suma[nuevos] / np.maximum(cuenta[nuevos], 1)[:, None]
        lleno |= nuevos
    return tex


def escribir_glb(ruta, pos, nor, uv, caras, uri_textura):
    """Un .glb mínimo: una malla con normales y UV y un material con la textura aparte."""
    trozos, vistas, accesos = [], [], []

    def agregar(arr, tipo, comp, objetivo, con_limites=False):
        datos = arr.tobytes()
        desde = sum(len(t) for t in trozos)
        trozos.append(datos + b"\0" * (-len(datos) % 4))
        vistas.append({"buffer": 0, "byteOffset": desde, "byteLength": arr.nbytes, "target": objetivo})
        a = {"bufferView": len(vistas) - 1, "componentType": comp, "count": int(arr.shape[0]), "type": tipo}
        if con_limites:
            a["min"] = arr.min(0).tolist()
            a["max"] = arr.max(0).tolist()
        accesos.append(a)
        return len(accesos) - 1

    i_pos = agregar(pos.astype(np.float32), "VEC3", 5126, 34962, True)
    i_nor = agregar(nor.astype(np.float32), "VEC3", 5126, 34962)
    i_uv = agregar(np.stack([uv[:, 0], 1.0 - uv[:, 1]], 1).astype(np.float32), "VEC2", 5126, 34962)
    i_ind = agregar(caras.astype(np.uint32).ravel(), "SCALAR", 5125, 34963)
    binario = b"".join(trozos)
    doc = {
        "asset": {"version": "2.0", "generator": "Guerra del Pacífico: herramientas/pintar_modelo.py"},
        "scene": 0, "scenes": [{"nodes": [0]}],
        "nodes": [{"name": "Figura", "mesh": 0}],
        "meshes": [{"name": "Figura", "primitives": [{
            "attributes": {"POSITION": i_pos, "NORMAL": i_nor, "TEXCOORD_0": i_uv}, "indices": i_ind, "material": 0}]}],
        "materials": [{"name": "Pintura", "pbrMetallicRoughness": {
            "baseColorTexture": {"index": 0}, "metallicFactor": 0.0, "roughnessFactor": 0.85}}],
        "textures": [{"source": 0, "sampler": 0}],
        "samplers": [{"magFilter": 9729, "minFilter": 9987, "wrapS": 33071, "wrapT": 33071}],
        "images": [{"uri": uri_textura}],
        "buffers": [{"byteLength": len(binario)}],
        "bufferViews": vistas, "accessors": accesos,
    }
    js = json.dumps(doc, separators=(",", ":")).encode()
    js += b" " * (-len(js) % 4)
    with open(ruta, "wb") as f:
        f.write(struct.pack("<4sII", b"glTF", 2, 12 + 8 + len(js) + 8 + len(binario)))
        f.write(struct.pack("<I4s", len(js), b"JSON") + js)
        f.write(struct.pack("<I4s", len(binario), b"BIN\0") + binario)


def main(ruta_conf):
    ruta_conf = Path(ruta_conf)
    conf = json.loads(ruta_conf.read_text(encoding="utf-8"))
    base = ruta_conf.parent
    V, F, N, aristas = figura_grande(base / conf["modelo"], int(conf.get("caras", 14000)))
    lamina = Lamina(base / conf["lamina"])
    fuentes = []
    for v in conf["vistas"]:
        fuentes.append(Vista(v, lamina, V, F))
        fuentes += [Envoltura(e, lamina) for e in conf.get("envolver", []) if e.get("despues_de") == v["nombre"]]
    C = colores_vertices(fuentes, V, N, aristas)
    vmap, caras, uv = xatlas.parametrize(V, F)
    lado = int(conf.get("textura", 1024))
    tex = hornear(fuentes, V[vmap], N[vmap], C[vmap], uv, caras, lado)
    # al sol del juego la pintura (que ya trae su luz) se ve lavada: algo más de color, menos brillo
    gris = tex.mean(-1, keepdims=True)
    tex = (gris + (tex - gris) * float(conf.get("saturacion", 1.15))) * float(conf.get("brillo", 0.9))
    salida = (base / conf["salida"]).resolve()
    salida.parent.mkdir(parents=True, exist_ok=True)
    textura = salida.with_suffix(".jpg")
    Image.fromarray((np.clip(tex, 0, 1) * 255).astype(np.uint8), "RGB").save(textura, quality=92, optimize=True)
    escribir_glb(salida.with_suffix(".glb"), V[vmap], N[vmap], uv, caras, textura.name)
    print(f"listo: {salida.with_suffix('.glb')} ({len(caras)} caras) y {textura.name} ({lado}×{lado})")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
