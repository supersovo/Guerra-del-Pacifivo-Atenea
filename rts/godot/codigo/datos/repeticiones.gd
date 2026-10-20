## Repeticiones guardadas en este equipo (carpeta repeticiones/ del usuario): JSON comprimido
## con gzip, el mismo formato de salitre/servidor/repeticion.py. El servidor privado las graba
## al terminar cada partida; aquí se listan, se borran y se guardan las que manda un servidor
## de otro equipo («Guardar la repetición aquí»).
extends RefCounted

const Rutas = preload("res://codigo/datos/rutas.gd")

const EXTENSION := ".rep"
const CLAVES := ["mapa", "semilla", "jugadores", "comandos", "fin"]


## ¿Sirve como nombre de archivo? (letras, números, punto, guion y guion bajo; sin «..»)
static func nombre_seguro(nombre: String) -> bool:
	if nombre.is_empty() or nombre.length() > 120 or ".." in nombre:
		return false
	for c in nombre:
		if not (c.is_valid_identifier() or c.is_valid_int() or c in [".", "-", "_"]):
			return false
	return true


static func ruta_de(nombre: String, carpeta := "") -> String:
	if not nombre_seguro(nombre):
		return ""
	if carpeta == "":
		carpeta = Rutas.dir_repeticiones()
	return carpeta.path_join(nombre + EXTENSION)


static func leer(ruta: String) -> Variant:
	var crudo := FileAccess.get_file_as_bytes(ruta)
	if crudo.is_empty():
		return null
	var texto := crudo.decompress_dynamic(-1, FileAccess.COMPRESSION_GZIP)
	if texto.is_empty():
		return null
	var d: Variant = JSON.parse_string(texto.get_string_from_utf8())
	if not d is Dictionary:
		return null
	for k in CLAVES:
		if not d.has(k):
			return null
	return d


## [{nombre, mapa, fecha, minutos, jugadores, version}] de la más nueva a la más vieja.
static func listar(carpeta := "") -> Array:
	if carpeta == "":
		carpeta = Rutas.dir_repeticiones()
	var out: Array = []
	var dir := DirAccess.open(carpeta)
	if dir == null:
		return out
	var archivos: Array = Array(dir.get_files()).filter(func(a: String) -> bool: return a.ends_with(EXTENSION))
	archivos.sort()
	archivos.reverse()
	for a in archivos:
		var d: Variant = leer(carpeta.path_join(a))
		if d == null:
			continue
		var jugadores: Array = []
		for j in d["jugadores"]:
			jugadores.append("%s (%s)" % [j.get("nombre", "?"), j.get("faccion", "?")])
		var mapa: Variant = d["mapa"]
		out.append({"nombre": a.get_basename(), "ruta": carpeta.path_join(a),
				"mapa": mapa.get("nombre", "?") if mapa is Dictionary else "?",
				"fecha": float(d.get("fecha", 0)), "minutos": snappedf(float(d["fin"]) / 16.0 / 60.0, 0.1),
				"jugadores": jugadores, "version": str(d.get("version", "?"))})
	return out


## Guarda una repetición recibida por la red; devuelve la ruta o "" si no se pudo.
static func guardar_datos(datos: Dictionary, nombre: String, carpeta := "") -> String:
	for k in CLAVES:
		if not datos.has(k):
			return ""
	var ruta := ruta_de(nombre, carpeta)
	if ruta == "":
		return ""
	var bytes := JSON.stringify(Rutas.enteros(datos), "", false).to_utf8_buffer().compress(FileAccess.COMPRESSION_GZIP)
	var f := FileAccess.open(ruta, FileAccess.WRITE)
	if f == null:
		return ""
	f.store_buffer(bytes)
	f.close()
	return ruta


static func borrar(nombre: String, carpeta := "") -> bool:
	var ruta := ruta_de(nombre, carpeta)
	return ruta != "" and DirAccess.remove_absolute(ruta) == OK
