## Mapas: los del juego (rts/mapas/) y los propios del usuario (su carpeta mapas/), como
## salitre/contenido/mapas.py; y la imagen reducida de cada uno para las vistas previas.
extends RefCounted

const Rutas = preload("res://codigo/datos/rutas.gd")


## id -> ruta del archivo; los del juego primero (un mapa propio con el mismo nombre no lo tapa).
static func rutas_de_mapas(dir_rts: String) -> Dictionary:
	var out := {}
	for carpeta in [dir_rts.path_join("mapas"), Rutas.dir_mapas_usuario()]:
		var dir := DirAccess.open(carpeta)
		if dir == null:
			continue
		var archivos: Array = Array(dir.get_files())
		archivos.sort()
		for a in archivos:
			if a.ends_with(".json") and not out.has(a.get_basename()):
				out[a.get_basename()] = carpeta.path_join(a)
	return out


static func cargar(ruta: String) -> Variant:
	var d: Variant = JSON.parse_string(FileAccess.get_file_as_string(ruta))
	if not d is Dictionary or not d.has("terreno") or not d.has("ancho") or not d.has("alto"):
		return null
	if not d.has("id"):
		d["id"] = ruta.get_file().get_basename()
	if not d.has("altura"):
		var filas: Array = []
		for _y in int(d["alto"]):
			filas.append("0".repeat(int(d["ancho"])))
		d["altura"] = filas
	return d


## [{id, nombre, jugadores, descripcion, historia, naval, ancho, alto}] de todos los mapas.
static func listar(dir_rts: String) -> Array:
	var out: Array = []
	var rutas := rutas_de_mapas(dir_rts)
	for ident in rutas:
		var d: Variant = cargar(rutas[ident])
		if d == null:
			continue
		out.append({"id": ident, "nombre": d.get("nombre", ident),
				"jugadores": int(d.get("jugadores", d.get("inicios", []).size())),
				"descripcion": d.get("descripcion", ""), "historia": d.get("historia", ""),
				"naval": bool(d.get("naval", false)), "ancho": int(d["ancho"]), "alto": int(d["alto"]),
				"ruta": rutas[ident]})
	return out


static func buscar(dir_rts: String, ident: String) -> Variant:
	var rutas := rutas_de_mapas(dir_rts)
	return cargar(rutas[ident]) if rutas.has(ident) else null


## Imagen reducida del mapa (salitre/cliente/graficos/minimapa.superficie_mapa): el terreno
## con su altura, los barrancos sombreados, los yacimientos y los lugares de inicio.
static func previa(cat, d: Dictionary, escala := 3) -> ImageTexture:
	var w := int(d["ancho"])
	var h := int(d["alto"])
	var img := Image.create(w * escala, h * escala, false, Image.FORMAT_RGB8)
	var terrenos: Dictionary = cat.datos["terrenos"]
	var terreno: Array = d["terreno"]
	var altura: Array = d["altura"]
	for y in h:
		var fila_t: String = terreno[y]
		var fila_a: String = altura[y]
		for x in w:
			var ch := fila_t[x]
			var codigo := int(terrenos.get(ch, terrenos.get(".", {"codigo": 0}))["codigo"])
			var col: Color = cat.colores_terreno.get(codigo, Color.MAGENTA)
			if ch == "T":
				col = Color8(96, 120, 70)
			var nv := fila_a.unicode_at(x) - 48
			var f := 1.0 + 0.10 * nv
			col = Color(minf(1.0, col.r * f), minf(1.0, col.g * f), minf(1.0, col.b * f))
			if y + 1 < h and fila_a.unicode_at(x) > String(altura[y + 1]).unicode_at(x) and String(terreno[y + 1])[x] != "/":
				col = Color(col.r * 0.55, col.g * 0.55, col.b * 0.55)
			img.fill_rect(Rect2i(x * escala, y * escala, escala, escala), col)
	for r in d.get("recursos", []):
		var rx := int(r["x"]) * escala
		var ry := int(r["y"]) * escala
		if r.get("tipo") == "salitre":
			img.fill_rect(Rect2i(rx, ry, 2 * escala, maxi(1, escala)), Color8(250, 250, 250))
		else:
			img.fill_rect(Rect2i(rx, ry, 3 * escala, 3 * escala), Color8(60, 150, 230))
	for p in d.get("inicios", []):
		var r := Rect2i(int(p[0]) * escala, int(p[1]) * escala, 4 * escala, 3 * escala)
		img.fill_rect(r, Color8(250, 240, 214))
		img.fill_rect(r.grow(-1), Color8(150, 32, 28))
	return ImageTexture.create_from_image(img)
