## Perfil local del jugador (perfil_3d.json en la carpeta del usuario): los servidores
## recientes, el historial de escaramuzas jugadas en este equipo y las campañas contra la IA
## con su escalafón de veteranos. Es lo mismo que guarda el cliente de Python en perfil.db.
extends RefCounted

const Rutas = preload("res://codigo/datos/rutas.gd")

const ARCHIVO := "perfil_3d.json"
const MAX_ESCARAMUZAS := 500

var datos: Dictionary = {}
var ruta := ""


func cargar(dir := "") -> void:
	if dir == "":
		dir = Rutas.dir_usuario()
	ruta = dir.path_join(ARCHIVO)
	datos = {"servidores": [], "escaramuzas": [], "campanas": [], "siguiente": 1}
	if not FileAccess.file_exists(ruta):
		return
	var v: Variant = Rutas.enteros(JSON.parse_string(FileAccess.get_file_as_string(ruta)))
	if not v is Dictionary:
		return
	for k in ["servidores", "escaramuzas", "campanas"]:
		if v.get(k) is Array:
			datos[k] = v[k]
	datos["siguiente"] = maxi(1, int(v.get("siguiente", 1)))
	for c in datos["campanas"]:
		datos["siguiente"] = maxi(int(datos["siguiente"]), int(c.get("id", 0)) + 1)


func guardar() -> bool:
	if ruta == "":
		return false
	return Rutas.escribir_seguro(ruta, JSON.stringify(Rutas.enteros(datos), " ", false))


static func _ahora() -> float:
	return Time.get_unix_time_from_system()


# -- servidores recientes ----------------------------------------------------
func recordar_servidor(direccion: String, nombre := "") -> void:
	var lista: Array = datos["servidores"].filter(func(s: Dictionary) -> bool: return s.get("direccion") != direccion)
	lista.append({"direccion": direccion, "nombre": nombre, "ultimo_uso": _ahora()})
	datos["servidores"] = lista
	guardar()


func servidores(n := 8) -> Array:
	var lista: Array = datos["servidores"].duplicate()
	lista.sort_custom(func(a: Dictionary, b: Dictionary) -> bool:
		return float(a.get("ultimo_uso", 0)) > float(b.get("ultimo_uso", 0)))
	return lista.slice(0, n)


# -- escaramuzas ----------------------------------------------------------------
func registrar_escaramuza(mapa: String, faccion: String, rivales: String, resultado: String, minutos: float,
		abatidos: int, perdidas: int) -> void:
	var lista: Array = datos["escaramuzas"]
	lista.append({"fecha": _ahora(), "mapa": mapa, "faccion": faccion, "rivales": rivales, "resultado": resultado,
			"minutos": minutos, "abatidos": abatidos, "perdidas": perdidas})
	if lista.size() > MAX_ESCARAMUZAS:
		datos["escaramuzas"] = lista.slice(lista.size() - MAX_ESCARAMUZAS)
	guardar()


func escaramuzas(n := 20) -> Array:
	var lista: Array = datos["escaramuzas"].duplicate()
	lista.reverse()
	return lista.slice(0, n)


func resumen() -> Dictionary:
	var r := {"jugadas": 0, "victorias": 0, "derrotas": 0}
	for e in datos["escaramuzas"]:
		r["jugadas"] += 1
		if e.get("resultado") == "victoria":
			r["victorias"] += 1
		elif e.get("resultado") == "derrota":
			r["derrotas"] += 1
	return r


# -- campañas: el escalafón de veteranos de cada campaña contra la IA ------------
func crear_campana(estado: Dictionary) -> int:
	var cid := int(datos["siguiente"])
	datos["siguiente"] = cid + 1
	var ahora := _ahora()
	datos["campanas"].append({"id": cid, "campana": estado["campana"], "faccion": estado["faccion"],
			"estado": estado.duplicate(true), "creada": ahora, "actualizada": ahora, "terminada": false})
	guardar()
	return cid


func guardar_campana(cid: int, estado: Dictionary) -> void:
	for c in datos["campanas"]:
		if int(c["id"]) == cid:
			c["estado"] = estado.duplicate(true)
			c["actualizada"] = _ahora()
			c["terminada"] = bool(estado.get("terminada", false))
	guardar()


func campana(cid: int) -> Variant:
	for c in datos["campanas"]:
		if int(c["id"]) == cid and c.get("estado") is Dictionary:
			return c["estado"].duplicate(true)
	return null


## [id, estado] de la última campaña de ese tipo (la que está en curso o la recién terminada),
## o [-1, null] si no hay ninguna.
func ultima_campana(campana_id: String) -> Array:
	var mejor: Variant = null
	for c in datos["campanas"]:
		if c.get("campana") != campana_id or not c.get("estado") is Dictionary:
			continue
		if mejor == null or float(c.get("actualizada", 0)) >= float(mejor.get("actualizada", 0)):
			mejor = c
	if mejor == null:
		return [-1, null]
	return [int(mejor["id"]), mejor["estado"].duplicate(true)]


func borrar_campana(cid: int) -> void:
	datos["campanas"] = datos["campanas"].filter(func(c: Dictionary) -> bool: return int(c["id"]) != cid)
	guardar()
