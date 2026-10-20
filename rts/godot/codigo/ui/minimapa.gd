## Minimapa: el campo entero con la niebla de guerra, las tropas (puntos del color de cada
## ejército), las obras, los yacimientos, lo que abarca la cámara y los avisos que
## parpadean. Clic o arrastre: llevar la cámara; clic derecho: dar la orden allí.
extends Control

signal centrar(punto: Vector3)
signal orden(punto: Vector3)

const OSCURO := Color(0.07, 0.06, 0.055, 1.0)

var est
var vista: Array = []            # los cuatro puntos del suelo que abarca la cámara
var seleccion := {}
var _tex_terreno: ImageTexture
var _tex_niebla: ImageTexture
var _img_niebla: Image
var _arrastrando := false
var _avisos: Array = []          # [punto (casillas), color, hasta]


func preparar(estado, colores: Dictionary) -> void:
	est = estado
	mouse_filter = Control.MOUSE_FILTER_STOP
	var img := Image.create(est.w, est.h, false, Image.FORMAT_RGB8)
	for y in est.h:
		for x in est.w:
			var i: int = y * est.w + x
			var c: Color = colores.get(int(est.terreno[i]), Color.MAGENTA)
			if est.terreno[i] == 6:
				c = c.darkened(0.25)        # los tamarugales, más oscuros
			c = c.lightened(0.07 * est.niveles[i])
			img.set_pixel(x, y, c)
	_tex_terreno = ImageTexture.create_from_image(img)
	_img_niebla = Image.create(est.w, est.h, false, Image.FORMAT_RGBA8)
	_tex_niebla = ImageTexture.create_from_image(_img_niebla)
	actualizar_niebla()


func actualizar_niebla() -> void:
	var datos := PackedByteArray()
	datos.resize(est.w * est.h * 4)
	var oscuro := [int(OSCURO.r * 255), int(OSCURO.g * 255), int(OSCURO.b * 255)]
	for i in est.w * est.h:
		var a := 0
		if not est.vis[i]:
			a = 120 if est.explorado[i] else 255
		datos[i * 4] = oscuro[0]
		datos[i * 4 + 1] = oscuro[1]
		datos[i * 4 + 2] = oscuro[2]
		datos[i * 4 + 3] = a
	_img_niebla = Image.create_from_data(est.w, est.h, false, Image.FORMAT_RGBA8, datos)
	_tex_niebla.update(_img_niebla)


func aviso(punto: Vector3, color: Color, segundos := 4.0) -> void:
	_avisos.append([Vector2(punto.x, punto.z), color, Time.get_ticks_msec() / 1000.0 + segundos])


## Rectángulo del control donde se dibuja el mapa (sin deformarlo).
func _rect_mapa() -> Rect2:
	var esc: float = minf(size.x / est.w, size.y / est.h)
	var tam := Vector2(est.w, est.h) * esc
	return Rect2((size - tam) / 2.0, tam)


## Del control a las casillas del mapa (como punto del mundo).
func a_mapa(local: Vector2) -> Vector3:
	var r := _rect_mapa()
	var p := (local - r.position) / r.size * Vector2(est.w, est.h)
	return Vector3(clampf(p.x, 0.0, est.w), 0, clampf(p.y, 0.0, est.h))


func a_mini(x: float, z: float) -> Vector2:
	var r := _rect_mapa()
	return r.position + Vector2(x / est.w, z / est.h) * r.size


func _draw() -> void:
	if est == null:
		return
	var r := _rect_mapa()
	draw_rect(Rect2(Vector2.ZERO, size), Color(0.1, 0.07, 0.05, 1.0))
	draw_texture_rect(_tex_terreno, r, false)
	var esc: float = r.size.x / est.w
	# yacimientos explorados
	for e in est.ents.values():
		if not e.es_recurso() or not est.explorado_px(e.x1, e.y1):
			continue
		var c := Color8(240, 238, 228) if e.t == est.cat.especiales["salitre"] else Color8(80, 150, 220)
		draw_rect(Rect2(a_mini(e.x1 / 32.0, e.y1 / 32.0) - Vector2(1.5, 1.5), Vector2(3, 3)), c)
	draw_texture_rect(_tex_niebla, r, false)
	# obras y tropas
	for e in est.ents.values():
		if e.tipo == null or e.dueno < 0:
			continue
		var c: Color = est.color(e.dueno)
		var p := a_mini(e.x / 32.0, e.y / 32.0)
		if e.es_edificio():
			var t: Vector2 = Vector2(float(e.tipo["ancho"]), float(e.tipo["alto"])) * esc
			var col := c.darkened(0.35) if e.fantasma else c
			draw_rect(Rect2(p - t / 2.0, t), col)
			draw_rect(Rect2(p - t / 2.0, t), Color(0, 0, 0, 0.7), false, 1.0)
		elif not e.fantasma:
			var lado := 3.0 if int(e.tipo["capa"]) == 1 else 2.0
			if seleccion.has(e.id):
				draw_rect(Rect2(p - Vector2(lado, lado) / 2.0 - Vector2.ONE, Vector2(lado, lado) + Vector2(2, 2)), Color.WHITE)
			draw_rect(Rect2(p - Vector2(lado, lado) / 2.0, Vector2(lado, lado)), c)
	# lo que abarca la cámara
	if vista.size() == 4:
		var pts := PackedVector2Array()
		for q in vista:
			pts.append(a_mini(q.x, q.z))
		pts.append(pts[0])
		draw_polyline(pts, Color(1, 1, 1, 0.85), 1.0)
	# avisos que parpadean
	var ahora := Time.get_ticks_msec() / 1000.0
	var quedan: Array = []
	for a in _avisos:
		if a[2] < ahora:
			continue
		quedan.append(a)
		var fase := fmod(ahora * 1.6, 1.0)
		var col: Color = a[1]
		draw_arc(a_mini(a[0].x, a[0].y), 3.0 + fase * 12.0, 0.0, TAU, 20, Color(col, 1.0 - fase), 1.5)
	_avisos = quedan
	draw_rect(Rect2(Vector2.ZERO, size), Color8(188, 146, 74), false, 2.0)


func _gui_input(ev: InputEvent) -> void:
	if est == null:
		return
	if ev is InputEventMouseButton:
		if ev.button_index == MOUSE_BUTTON_LEFT:
			_arrastrando = ev.pressed
			if ev.pressed:
				centrar.emit(a_mapa(ev.position))
			accept_event()
		elif ev.button_index == MOUSE_BUTTON_RIGHT and ev.pressed:
			orden.emit(a_mapa(ev.position))
			accept_event()
	elif ev is InputEventMouseMotion and _arrastrando:
		centrar.emit(a_mapa(ev.position))
		accept_event()
