## Banderas de las naciones, dibujadas por código (como salitre/cliente/graficos/banderas.py).
##
## Chile: bandera de 1817 (estrella blanca en cantón azul). Perú: rojo-blanco-rojo vertical.
## Bolivia: rojo-amarillo-verde horizontal (desde 1851). Argentina: celeste-blanco-celeste con
## el sol de mayo. Se dibujan al cuádruple y se reducen, para que los bordes salgan suaves.
extends RefCounted

const SUPER := 4
static var _cache := {}


static func textura(nacion: String, w := 48, h := 32) -> ImageTexture:
	var clave := "%s:%d:%d" % [nacion, w, h]
	if not _cache.has(clave):
		_cache[clave] = ImageTexture.create_from_image(imagen(nacion, w, h))
	return _cache[clave]


static func imagen(nacion: String, w := 48, h := 32) -> Image:
	var W := w * SUPER
	var H := h * SUPER
	var img := Image.create(W, H, false, Image.FORMAT_RGBA8)
	match nacion:
		"chile":
			img.fill_rect(Rect2i(0, H / 2, W, H - H / 2), Color8(214, 40, 40))
			img.fill_rect(Rect2i(0, 0, W, H / 2), Color8(246, 246, 246))
			var c := H / 2
			img.fill_rect(Rect2i(0, 0, c, c), Color8(0, 57, 166))
			_estrella(img, c / 2.0, c / 2.0, c * 0.36, Color8(255, 255, 255))
		"peru":
			var t := W / 3
			img.fill_rect(Rect2i(0, 0, t, H), Color8(217, 16, 35))
			img.fill_rect(Rect2i(t, 0, W - 2 * t, H), Color8(246, 246, 246))
			img.fill_rect(Rect2i(W - t, 0, t, H), Color8(217, 16, 35))
		"bolivia":
			var t := H / 3
			img.fill_rect(Rect2i(0, 0, W, t), Color8(213, 43, 30))
			img.fill_rect(Rect2i(0, t, W, H - 2 * t), Color8(249, 228, 0))
			img.fill_rect(Rect2i(0, H - t, W, t), Color8(0, 122, 51))
		"argentina":
			var t := H / 3
			img.fill_rect(Rect2i(0, 0, W, t), Color8(116, 172, 223))
			img.fill_rect(Rect2i(0, t, W, H - 2 * t), Color8(246, 246, 246))
			img.fill_rect(Rect2i(0, H - t, W, t), Color8(116, 172, 223))
			_sol(img, W / 2.0, H / 2.0, maxf(2.0 * SUPER, t / 2.0), Color8(246, 180, 14))
		_:
			img.fill(Color8(200, 200, 200))
	# marco oscuro de un píxel (a la escala final)
	var borde := Color8(40, 30, 24)
	img.fill_rect(Rect2i(0, 0, W, SUPER), borde)
	img.fill_rect(Rect2i(0, H - SUPER, W, SUPER), borde)
	img.fill_rect(Rect2i(0, 0, SUPER, H), borde)
	img.fill_rect(Rect2i(W - SUPER, 0, SUPER, H), borde)
	img.resize(w, h, Image.INTERPOLATE_LANCZOS)
	return img


static func _estrella(img: Image, cx: float, cy: float, r: float, color: Color) -> void:
	var pts := PackedVector2Array()
	for k in 10:
		var a := -PI / 2.0 + k * PI / 5.0
		var rr := r if k % 2 == 0 else r * 0.42
		pts.append(Vector2(cx + cos(a) * rr, cy + sin(a) * rr))
	for y in range(int(cy - r) - 1, int(cy + r) + 2):
		for x in range(int(cx - r) - 1, int(cx + r) + 2):
			if x >= 0 and y >= 0 and x < img.get_width() and y < img.get_height() \
					and Geometry2D.is_point_in_polygon(Vector2(x + 0.5, y + 0.5), pts):
				img.set_pixel(x, y, color)


static func _sol(img: Image, cx: float, cy: float, r: float, color: Color) -> void:
	# dieciséis rayos y el disco
	for k in 16:
		var a := k * PI / 8.0
		var fin := Vector2(cx + cos(a) * r * 1.7, cy + sin(a) * r * 1.7)
		var pasos := int(r * 2.0) + 2
		for i in pasos + 1:
			var p := Vector2(cx, cy).lerp(fin, float(i) / pasos)
			img.fill_rect(Rect2i(int(p.x) - SUPER / 2, int(p.y) - SUPER / 2, SUPER, SUPER), color)
	for y in range(int(cy - r) - 1, int(cy + r) + 2):
		for x in range(int(cx - r) - 1, int(cx + r) + 2):
			if Vector2(x + 0.5 - cx, y + 0.5 - cy).length() <= r:
				img.set_pixel(x, y, color)
