## Configuración del cliente 3D (config_3d.json en la carpeta del usuario).
##
## Las mismas claves que la del cliente de Python (salitre/cliente/config.py) más las propias
## del 3D (la calidad gráfica). La primera vez se toman de config.json del cliente de Python
## el nombre, los volúmenes y las preferencias, para que el jugador no tenga que repetirlas.
## Cada valor se acepta solo si es del mismo tipo que el predeterminado.
extends RefCounted

const Rutas = preload("res://codigo/datos/rutas.gd")

const ARCHIVO := "config_3d.json"
const ARCHIVO_2D := "config.json"
const PREDETERMINADA := {
	"nombre": "",
	"ventana": [1280, 720],
	"pantalla_completa": false,
	"vsync": true,
	"volumen_general": 1.0,
	"volumen_musica": 0.6,
	"volumen_efectos": 0.7,
	"volumen_voces": 0.9,
	"velocidad_desplazamiento": 1.0,
	"desplazar_con_borde": true,
	"encerrar_raton": true,
	"barras_siempre": false,
	"sangre": true,
	"voces": true,
	"ultimo_servidor": "127.0.0.1:47800",
	"faccion": "chile",
	"mapa": "pampa_del_tamarugal",
	"dificultad": "normal",
	"mostrar_fps": false,
	"calidad": "alta",
}
# lo que no se toma del cliente de Python (la ventana y la calidad son de cada cliente)
const SOLO_3D := ["ventana", "calidad", "pantalla_completa", "vsync"]
const CALIDADES := ["alta", "media", "baja"]

var d: Dictionary = {}
var ruta := ""


func cargar(dir := "") -> void:
	if dir == "":
		dir = Rutas.dir_usuario()
	ruta = dir.path_join(ARCHIVO)
	d = PREDETERMINADA.duplicate(true)
	if FileAccess.file_exists(ruta):
		_tomar(_leer(ruta), [])
	else:
		# primera vez: lo que el jugador ya eligió en el cliente de Python
		_tomar(_leer(dir.path_join(ARCHIVO_2D)), SOLO_3D)
	if not d["calidad"] in CALIDADES:
		d["calidad"] = "alta"


func guardar() -> bool:
	if ruta == "":
		return false
	return Rutas.escribir_seguro(ruta, JSON.stringify(d, "  ", false))


func leer(clave: String) -> Variant:
	return d.get(clave, PREDETERMINADA.get(clave))


func escribir(clave: String, valor: Variant) -> void:
	d[clave] = valor


## Vuelve a los valores de fábrica salvo el nombre y las elecciones de la escaramuza.
func restablecer() -> void:
	for k in PREDETERMINADA:
		if not k in ["nombre", "ultimo_servidor", "faccion", "mapa", "dificultad"]:
			var v: Variant = PREDETERMINADA[k]
			d[k] = v.duplicate() if v is Array else v


static func _leer(r: String) -> Dictionary:
	if not FileAccess.file_exists(r):
		return {}
	var v: Variant = JSON.parse_string(FileAccess.get_file_as_string(r))
	return v if v is Dictionary else {}


func _tomar(datos: Dictionary, excepto: Array) -> void:
	for k in datos:
		if not PREDETERMINADA.has(k) or k in excepto:
			continue
		var pred: Variant = PREDETERMINADA[k]
		var v: Variant = datos[k]
		if pred is float and (v is float or v is int):
			d[k] = float(v)
		elif pred is bool and v is bool:
			d[k] = v
		elif pred is String and v is String:
			d[k] = v
		elif pred is Array and v is Array and v.size() == pred.size():
			# JSON trae los números como decimales: la ventana se guarda en enteros
			var ok := true
			var lista: Array = []
			for x in v:
				if not (x is float or x is int):
					ok = false
					break
				lista.append(int(x))
			if ok:
				d[k] = lista
