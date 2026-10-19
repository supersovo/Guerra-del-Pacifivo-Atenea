## Catálogo del juego para el cliente (datos/catalogo.json, que genera
## herramientas/exportar_godot.py a partir de los datos del juego).
##
## Los tipos van en el orden de los índices de red (tipo.idx): las instantáneas
## mandan el índice y aquí se busca qué es, cómo se llama y cómo se dibuja.
extends RefCounted

var datos: Dictionary = {}
var tipos: Array = []
var huella := ""
var version := ""
var protocolo := 0
var banderas: Dictionary = {}
var especiales: Dictionary = {}
var facciones: Dictionary = {}
var colores_jugador: Array[Color] = []
var colores_terreno: Dictionary = {}
var formaciones: Array = []
var tipos_por_id: Dictionary = {}
var mejoras_por_id: Dictionary = {}


func cargar(ruta := "res://datos/catalogo.json") -> bool:
	var texto := FileAccess.get_file_as_string(ruta)
	var d: Variant = JSON.parse_string(texto)
	if typeof(d) != TYPE_DICTIONARY:
		push_error("No se pudo leer el catálogo %s" % ruta)
		return false
	datos = d
	tipos = d["tipos"]
	huella = d["huella"]
	version = d["version"]
	protocolo = int(d["protocolo"])
	for k in d["banderas"]:
		banderas[k] = int(d["banderas"][k])
	for k in d["tipos_especiales"]:
		especiales[k] = int(d["tipos_especiales"][k])
	facciones = d["facciones"]
	formaciones = d["formaciones"]
	for par in d["colores_jugador"]:
		colores_jugador.append(_color(par[1]))
	for k in d["colores_terreno"]:
		colores_terreno[int(k)] = _color(d["colores_terreno"][k])
	for i in tipos.size():
		tipos[i]["idx"] = i
		tipos_por_id[tipos[i]["id"]] = tipos[i]
	for m in d["mejoras"]:
		mejoras_por_id[m["id"]] = m
	return true


## El tipo de un índice de red, o null para los negativos (yacimientos, minas, heridos, convoyes).
func tipo(idx: int) -> Variant:
	if idx < 0 or idx >= tipos.size():
		return null
	return tipos[idx]


func bandera(nombre: String) -> int:
	return banderas.get(nombre, 0)


func nombre(faccion_id: String, tipo_id: String) -> String:
	var f: Dictionary = facciones.get(faccion_id, {})
	var propios: Dictionary = f.get("nombres", {})
	if propios.has(tipo_id):
		return propios[tipo_id]
	var t: Dictionary = tipos_por_id.get(tipo_id, {})
	return t.get("nombre", tipo_id)


func color_jugador(i: int) -> Color:
	if colores_jugador.is_empty():
		return Color.RED
	return colores_jugador[posmod(i, colores_jugador.size())]


## Colores generales del uniforme de una nación.
func uniforme_base(faccion_id: String) -> Dictionary:
	var out := {}
	var base: Dictionary = facciones.get(faccion_id, {}).get("uniforme", {})
	for k in base:
		out[k] = _color(base[k])
	return out


## Colores propios de un arma (por la forma de la figura) en una nación.
func uniforme_propio(faccion_id: String, forma: String) -> Dictionary:
	var out := {}
	var propios: Dictionary = facciones.get(faccion_id, {}).get("uniformes", {}).get(forma, {})
	for k in propios:
		out[k] = _color(propios[k])
	return out


## Costo de un tipo para una nación (con sus ventajas permanentes): [dinero, agua].
func costo(faccion_id: String, tipo_id: String) -> Array:
	var st: Dictionary = facciones.get(faccion_id, {}).get("stats", {}).get(tipo_id, {})
	if st.has("costo"):
		return [int(st["costo"][0]), int(st["costo"][1])]
	var t: Dictionary = tipos_por_id.get(tipo_id, {})
	var c: Array = t.get("costo", [0, 0])
	return [int(c[0]), int(c[1])]


## Visión de un tipo propio (con las ventajas permanentes de la nación).
func vision(faccion_id: String, tipo: Dictionary) -> float:
	var st: Dictionary = facciones.get(faccion_id, {}).get("stats", {}).get(tipo["id"], {})
	return float(st.get("vision", tipo.get("vision", 0)))


func formacion(codigo: int) -> Variant:
	for f in formaciones:
		if int(f["codigo"]) == codigo:
			return f
	return null


static func _color(v: Array) -> Color:
	return Color8(int(v[0]), int(v[1]), int(v[2]))
