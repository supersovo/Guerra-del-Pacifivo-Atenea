## Controles de volumen: general, música, efectos y voces (salitre/cliente/ui/controles_sonido.py).
##
## Los usan las Opciones y el menú de la batalla (F10). Cada deslizador aplica su volumen al
## instante; al soltarlo se oye una muestra (un disparo, una voz) para juzgar el nivel. La
## música se oye sola, porque suena todo el tiempo.
extends Control

const Tema = preload("res://codigo/ui/tema.gd")

const FILAS := [
	["volumen_general", "Volumen general"],
	["volumen_musica", "Música"],
	["volumen_efectos", "Efectos: fusilería, cañones y obras"],
	["volumen_voces", "Voces de la tropa"],
]

var deslizadores := {}
var porcentajes := {}


func _init(ancho := 292.0, paso := 48.0) -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	size = Vector2(ancho, paso * FILAS.size())
	var f: Dictionary = Juego.fuentes
	for k in FILAS.size():
		var clave: String = FILAS[k][0]
		var y := k * paso
		var l := Tema.etiqueta(FILAS[k][1], f["cuerpo"], 16, Tema.TINTA)
		l.position = Vector2(0, y)
		add_child(l)
		var pc := Tema.etiqueta("", f["negrita"], 16, Tema.TINTA)
		pc.position = Vector2(ancho - 60, y)
		pc.size = Vector2(60, 0)
		pc.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
		add_child(pc)
		porcentajes[clave] = pc
		var d := HSlider.new()
		d.min_value = 0.0
		d.max_value = 1.0
		d.step = 0.01
		d.position = Vector2(0, y + 24)
		d.size = Vector2(ancho, 18)
		d.focus_mode = Control.FOCUS_NONE
		d.value = Sonido.niveles[clave]
		d.value_changed.connect(func(v: float) -> void:
			Sonido.fijar_volumen(clave, v, Juego.config)
			_rotular(clave))
		d.drag_ended.connect(func(_cambio: bool) -> void: _muestra(clave))
		add_child(d)
		deslizadores[clave] = d
		_rotular(clave)


func _rotular(clave: String) -> void:
	var v: float = Sonido.niveles[clave]
	var pc: Label = porcentajes[clave]
	pc.text = "%d %%" % int(round(v * 100.0))
	pc.add_theme_color_override("font_color", Tema.TINTA if v > 0 else Tema.ROJO_SELLO)


func _muestra(clave: String) -> void:
	if clave == "volumen_voces":
		Sonido.voz(["seleccion_infanteria", "mover_infanteria"], 3)
	elif clave != "volumen_musica":
		Sonido.reproducir("fusil", 0.8, 0)


## Vuelve a leer los volúmenes (después de «Restablecer»).
func sincronizar() -> void:
	for clave in deslizadores:
		deslizadores[clave].set_value_no_signal(Sonido.niveles[clave])
		_rotular(clave)
