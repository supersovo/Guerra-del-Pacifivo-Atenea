## Juego (autocarga): lo que dura toda la sesión, de un menú a otro.
##
## Catálogo, carpetas del juego, fuentes y tema, la conexión con el servidor, el
## servidor privado de las escaramuzas y el mensaje «inicio» de la batalla en curso.
extends Node

const Catalogo = preload("res://codigo/datos/catalogo.gd")
const Conexion = preload("res://codigo/red/conexion.gd")
const ServidorLocal = preload("res://codigo/red/servidor_local.gd")
const Tema = preload("res://codigo/ui/tema.gd")

var catalogo := Catalogo.new()
var conexion := Conexion.new()
var servidor := ServidorLocal.new()
var dir_rts := ""
var dir_recursos := ""
var fuentes := {}
var tema: Theme
var nombre_jugador := "Comandante"
var inicio: Dictionary = {}         # mensaje "inicio" de la batalla en curso
var bienvenida: Dictionary = {}
var prueba_humo := false            # recorrido automático de punta a punta (pruebas e integración continua)
var mapa_prueba := "pampa_del_tamarugal"


func _ready() -> void:
	dir_rts = _buscar_dir_rts()
	dir_recursos = dir_rts.path_join("recursos")
	catalogo.cargar()
	_cargar_fuentes()
	tema = Tema.crear(fuentes)
	var args := OS.get_cmdline_user_args()
	prueba_humo = "--prueba-humo" in args
	for a in args:
		if a.begins_with("--mapa="):
			mapa_prueba = a.trim_prefix("--mapa=")
	get_tree().set_auto_accept_quit(false)


func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_CLOSE_REQUEST:
		salir(0)
	elif what == NOTIFICATION_PREDELETE:
		terminar()


func terminar() -> void:
	if conexion.conectado():
		conexion.enviar({"t": "abandonar"})
	conexion.cerrar()
	servidor.detener()


func salir(codigo := 0) -> void:
	terminar()
	get_tree().quit(codigo)


func ir_a(escena: String) -> void:
	get_tree().call_deferred("change_scene_to_file", escena)


## La carpeta rts/ del juego (datos, mapas, recursos y el paquete salitre de Python).
func _buscar_dir_rts() -> String:
	var propio := OS.get_environment("SALITRE_RTS")
	if propio != "":
		return propio
	if not OS.has_feature("template"):
		# desde las fuentes: este proyecto vive en rts/godot/
		return ProjectSettings.globalize_path("res://").rstrip("/").get_base_dir()
	# instalado: junto al ejecutable
	return OS.get_executable_path().get_base_dir()


func _cargar_fuentes() -> void:
	var archivos := {"titulo": "IMFellEnglishSC.ttf", "cuerpo": "AlegreyaSans-Regular.ttf",
			"negrita": "AlegreyaSans-Bold.ttf", "cursiva": "AlegreyaSans-Italic.ttf"}
	for clave in archivos:
		var f := FontFile.new()
		if f.load_dynamic_font(dir_recursos.path_join("fuentes").path_join(archivos[clave])) == OK:
			fuentes[clave] = f
		else:
			fuentes[clave] = ThemeDB.fallback_font


## Mapas del juego (id, nombre, jugadores, descripción), leídos de rts/mapas/.
func mapas_disponibles() -> Array:
	var out: Array = []
	var dir := DirAccess.open(dir_rts.path_join("mapas"))
	if dir == null:
		return out
	var nombres := Array(dir.get_files())
	nombres.sort()
	for archivo in nombres:
		if not archivo.ends_with(".json"):
			continue
		var d: Variant = JSON.parse_string(FileAccess.get_file_as_string(dir_rts.path_join("mapas").path_join(archivo)))
		if typeof(d) != TYPE_DICTIONARY:
			continue
		out.append({"id": d.get("id", archivo.get_basename()), "nombre": d.get("nombre", archivo.get_basename()),
				"jugadores": int(d.get("jugadores", 2)), "descripcion": d.get("descripcion", "")})
	return out
