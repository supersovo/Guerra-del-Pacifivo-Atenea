## Nombres de los veteranos: «Cabo Juan Soto, Atacama» (como salitre/contenido/nombres.py).
##
## Cada veterano recibe una semilla al ascender y viaja en las instantáneas; con
## datos/nombres.json, el servidor y todos los clientes la convierten en el mismo nombre,
## grado y cuerpo según la nación y el arma. La prueba cruzada lo compara con Python.
extends RefCounted

const FORMAS_MUJER := ["cantinera", "heroina"]

var datos: Dictionary = {"nombres": ["Juan"], "nombres_mujer": ["María"], "naciones": {}}


func cargar(dir_datos: String) -> void:
	var v: Variant = JSON.parse_string(FileAccess.get_file_as_string(dir_datos.path_join("nombres.json")))
	if v is Dictionary:
		datos = v


static func _elegir(lista: Array, semilla: int, sal: int) -> String:
	if lista.is_empty():
		return ""
	return str(lista[((semilla * 2654435761 + sal * 97) >> 7) % lista.size()])


## El batallón, regimiento o cuerpo del veterano.
func cuerpo(faccion_id: String, tipo: Dictionary, semilla: int) -> String:
	var nac: Dictionary = datos.get("naciones", {}).get(faccion_id, {})
	var cuerpos: Dictionary = nac.get("cuerpos", {})
	var lista: Array = cuerpos.get(tipo["id"], [])
	if lista.is_empty():
		lista = cuerpos.get(tipo.get("clase", ""), [])
	if lista.is_empty():
		lista = cuerpos.get("infanteria", [])
	return _elegir(lista, semilla, 3)


## «Cabo Juan Soto, Atacama» (o «Cañonera «Covadonga»» para un buque); "" sin semilla.
func nombre(cat, faccion_id: String, tipo: Dictionary, grado: int, semilla: int, con_cuerpo := true) -> String:
	if semilla == 0:
		return ""
	var nac: Dictionary = datos.get("naciones", {}).get(faccion_id, {})
	if tipo.get("clase") == "naval":
		return "%s «%s»" % [cat.nombre(faccion_id, tipo["id"]), _elegir(nac.get("buques", ["Esperanza"]), semilla, 5)]
	var mujer: bool = tipo.get("forma", "") in FORMAS_MUJER
	var pila := _elegir(datos.get("nombres_mujer" if mujer else "nombres", []), semilla, 1)
	var apellido := _elegir(nac.get("apellidos", ["Pérez"]), semilla, 2)
	var rango := "Cantinera"
	if not mujer:
		var grados: Array = cat.datos["veterania"]["grados"]
		rango = grados[clampi(grado, 0, grados.size() - 1)]["rango"]
	var texto := "%s %s %s" % [rango, pila, apellido]
	if con_cuerpo:
		var c := cuerpo(faccion_id, tipo, semilla)
		if c != "":
			texto += ", " + c
	return texto
