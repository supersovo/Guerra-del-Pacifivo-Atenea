## Panel de la interfaz: pergamino enmarcado en madera con remaches de bronce, o una tabla de
## madera tallada (como Estilo.panel del cliente de Python), con su sombra sobre el fondo.
extends Control

const Tema = preload("res://codigo/ui/tema.gd")

var tipo := "pergamino"        # pergamino | madera
var sombra := true


func _init(t := "pergamino") -> void:
	tipo = t
	mouse_filter = Control.MOUSE_FILTER_STOP     # los clics no pasan al fondo


func _draw() -> void:
	var r := Rect2(Vector2.ZERO, size)
	if sombra:
		draw_rect(Rect2(Vector2(5, 7), size), Color(0, 0, 0, 0.28))
	if tipo == "madera":
		draw_texture_rect(Tema.madera(), r, false)
		draw_rect(r, Color8(24, 14, 8), false, 2.0)
		draw_rect(r.grow(-3), Color(Tema.BRONCE, 0.63), false, 1.0)
		return
	draw_rect(r, Color8(28, 18, 10))
	draw_texture_rect(Tema.madera(), r.grow(-1), false)
	var dentro := r.grow(-5)
	draw_texture_rect(Tema.pergamino(), dentro, false)
	draw_rect(dentro, Color8(90, 62, 32), false, 1.0)
	for p in [Vector2(4, 4), Vector2(size.x - 7, 4), Vector2(4, size.y - 7), Vector2(size.x - 7, size.y - 7)]:
		draw_rect(Rect2(p, Vector2(3, 3)), Tema.BRONCE_CLARO)
