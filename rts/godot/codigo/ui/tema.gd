## Tema de la interfaz: carta militar, pergamino, madera tallada y remaches de bronce (los
## colores del juego, como salitre/cliente/ui/estilo.py). Las texturas se generan por código:
## no hay imágenes externas.
extends RefCounted

const TINTA := Color8(42, 30, 20)
const TINTA_SUAVE := Color8(96, 76, 56)
const PERGAMINO := Color8(232, 219, 186)
const PERGAMINO_OSCURO := Color8(206, 188, 148)
const MADERA := Color8(58, 38, 26)
const MADERA_CLARA := Color8(92, 62, 40)
const BRONCE := Color8(188, 146, 74)
const BRONCE_CLARO := Color8(230, 196, 120)
const CREMA := Color8(244, 236, 214)
const ROJO := Color8(160, 36, 30)
const ROJO_SELLO := Color8(150, 32, 28)
const VERDE := Color8(40, 120, 40)
const GRIS := Color8(130, 124, 112)
const ORO := Color8(126, 86, 18)

# colores de los botones: [base, claro, texto]
const BOTONES := {
	"principal": [Color8(126, 36, 30), Color8(168, 56, 44), CREMA],
	"madera": [Color8(78, 52, 34), Color8(110, 76, 50), CREMA],
	"normal": [PERGAMINO_OSCURO, PERGAMINO, TINTA],
}

static var _texturas := {}


static func caja(fondo: Color, borde: Color, ancho := 2, radio := 4, margen := 8) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = fondo
	s.border_color = borde
	s.set_border_width_all(ancho)
	s.set_corner_radius_all(radio)
	s.set_content_margin_all(margen)
	return s


# ----------------------------------------------------------------------
# Texturas generadas

static func _ruido(img: Image, base: Color, var_: int, semilla: int, grano := 2) -> void:
	var rnd := RandomNumberGenerator.new()
	rnd.seed = semilla
	for y in range(0, img.get_height(), grano):
		for x in range(0, img.get_width(), grano):
			var d := rnd.randi_range(-var_, var_) / 255.0
			img.fill_rect(Rect2i(x, y, grano, grano), Color(clampf(base.r + d, 0, 1), clampf(base.g + d, 0, 1),
					clampf(base.b + d - 2.0 / 255.0, 0, 1)))


static func _mezclar(img: Image, x: int, y: int, c: Color) -> void:
	if x < 0 or y < 0 or x >= img.get_width() or y >= img.get_height():
		return
	img.set_pixel(x, y, img.get_pixel(x, y).blend(c))


## Pergamino con manchas suaves, fibras y bordes tostados.
static func pergamino() -> ImageTexture:
	if _texturas.has("pergamino"):
		return _texturas["pergamino"]
	var w := 512
	var h := 512
	var img := Image.create(w, h, false, Image.FORMAT_RGBA8)
	_ruido(img, PERGAMINO, 7, 3, 2)
	var rnd := RandomNumberGenerator.new()
	rnd.seed = 4
	for _k in 70:
		var cx := rnd.randi_range(0, w)
		var cy := rnd.randi_range(0, h)
		var r := rnd.randi_range(10, 50)
		var a := rnd.randi_range(5, 14) / 255.0
		for y in range(cy - r, cy + r):
			for x in range(cx - r, cx + r):
				var d := Vector2(x - cx, y - cy).length() / r
				if d < 1.0:
					_mezclar(img, x, y, Color(150 / 255.0, 120 / 255.0, 70 / 255.0, a * (1.0 - d * d)))
	for _k in 240:
		var x0 := rnd.randi_range(0, w)
		var y0 := rnd.randi_range(0, h)
		var x1 := x0 + rnd.randi_range(-14, 14)
		var y1 := y0 + rnd.randi_range(-3, 3)
		var pasos := maxi(absi(x1 - x0), absi(y1 - y0)) + 1
		for i in pasos:
			var t := float(i) / pasos
			_mezclar(img, int(lerpf(x0, x1, t)), int(lerpf(y0, y1, t)), Color(120 / 255.0, 96 / 255.0, 60 / 255.0, 0.08))
	# bordes tostados (viñeta)
	for k in 40:
		var a := 0.32 * pow(1.0 - k / 40.0, 2.0)
		var c := Color(110 / 255.0, 76 / 255.0, 36 / 255.0, a)
		for x in range(k, w - k):
			_mezclar(img, x, k, c)
			_mezclar(img, x, h - 1 - k, c)
		for y in range(k + 1, h - k - 1):
			_mezclar(img, k, y, c)
			_mezclar(img, w - 1 - k, y, c)
	_texturas["pergamino"] = ImageTexture.create_from_image(img)
	return _texturas["pergamino"]


## Madera con vetas onduladas.
static func madera() -> ImageTexture:
	if _texturas.has("madera"):
		return _texturas["madera"]
	var w := 512
	var h := 256
	var img := Image.create(w, h, false, Image.FORMAT_RGBA8)
	_ruido(img, MADERA, 5, 7, 2)
	var rnd := RandomNumberGenerator.new()
	rnd.seed = 7
	var tonos := [Color8(44, 28, 18), Color8(72, 48, 32), Color8(66, 42, 28)]
	for _k in 120:
		var y := rnd.randi_range(0, h)
		var c: Color = tonos[rnd.randi_range(0, 2)]
		var fase := rnd.randf() * 6.0
		var paso := rnd.randi_range(9, 30)
		for x in w:
			var yy := y + int(3.0 * sin(x / float(paso) + fase))
			if yy >= 0 and yy < h:
				img.set_pixel(x, yy, c)
	_texturas["madera"] = ImageTexture.create_from_image(img)
	return _texturas["madera"]


## Botón con relieve: borde oscuro, mitad de arriba más clara y filete de bronce (9 partes).
static func _textura_boton(base: Color, claro: Color, filete: Color) -> ImageTexture:
	var w := 24
	var h := 32
	var img := Image.create(w, h, false, Image.FORMAT_RGBA8)
	img.fill(Color8(28, 18, 10))
	img.fill_rect(Rect2i(1, 1, w - 2, h - 2), base)
	for y in range(2, h / 2):
		for x in range(2, w - 2):
			img.set_pixel(x, y, base.lerp(claro, 0.43))
	for x in range(1, w - 1):
		img.set_pixel(x, 1, filete)
		img.set_pixel(x, h - 2, filete)
	for y in range(1, h - 1):
		img.set_pixel(1, y, filete)
		img.set_pixel(w - 2, y, filete)
	return ImageTexture.create_from_image(img)


static func _estilo_boton(base: Color, claro: Color, filete: Color) -> StyleBoxTexture:
	var s := StyleBoxTexture.new()
	s.texture = _textura_boton(base, claro, filete)
	s.texture_margin_left = 3
	s.texture_margin_right = 3
	s.texture_margin_top = 3
	s.texture_margin_bottom = 3
	s.content_margin_left = 10
	s.content_margin_right = 10
	s.content_margin_top = 4
	s.content_margin_bottom = 4
	return s


static func _icono_casilla(marcada: bool) -> ImageTexture:
	var t := 22
	var img := Image.create(t, t, false, Image.FORMAT_RGBA8)
	img.fill(Color8(70, 50, 32))
	img.fill_rect(Rect2i(2, 2, t - 4, t - 4), Color8(244, 236, 214))
	if marcada:
		# una marca roja de lacre
		for i in 6:
			img.fill_rect(Rect2i(5 + i, 10 + i, 2, 2), ROJO_SELLO)
		for i in 9:
			img.fill_rect(Rect2i(10 + i, int(15 - i * 1.2), 2, 2), ROJO_SELLO)
	return ImageTexture.create_from_image(img)


static func _icono_perilla() -> ImageTexture:
	var t := 18
	var img := Image.create(t, t, false, Image.FORMAT_RGBA8)
	for y in t:
		for x in t:
			var d := Vector2(x + 0.5 - t / 2.0, y + 0.5 - t / 2.0).length()
			if d <= t / 2.0 - 0.5:
				var c := BRONCE_CLARO.lerp(BRONCE, clampf((y - 2) / float(t), 0, 1))
				img.set_pixel(x, y, Color8(60, 40, 20) if d > t / 2.0 - 2.0 else c)
	return ImageTexture.create_from_image(img)


# ----------------------------------------------------------------------

static func crear(fuentes: Dictionary) -> Theme:
	var t := Theme.new()
	t.default_font = fuentes.get("cuerpo")
	t.default_font_size = 18
	t.set_stylebox("panel", "PanelContainer", caja(Color(MADERA, 0.94), BRONCE, 2, 6, 10))
	t.set_stylebox("panel", "Panel", caja(Color(MADERA, 0.94), BRONCE, 2, 6, 10))
	t.set_color("font_color", "Label", CREMA)
	# botones: normal (pergamino), principal (lacre) y madera
	for tipo in BOTONES:
		var clase: String = "Button" if tipo == "normal" else "Boton" + tipo.capitalize()
		if clase != "Button":
			t.set_type_variation(clase, "Button")
		var col: Array = BOTONES[tipo]
		var base: Color = col[0]
		var claro: Color = col[1]
		t.set_stylebox("normal", clase, _estilo_boton(base, claro, BRONCE))
		t.set_stylebox("hover", clase, _estilo_boton(base.lightened(0.09), claro.lightened(0.09), BRONCE_CLARO))
		t.set_stylebox("pressed", clase, _estilo_boton(base.darkened(0.12), base.darkened(0.12), BRONCE))
		t.set_stylebox("disabled", clase, _estilo_boton(base.lerp(Color8(140, 140, 140), 0.5),
				base.lerp(Color8(140, 140, 140), 0.5), GRIS))
		t.set_stylebox("focus", clase, caja(Color(0, 0, 0, 0), BRONCE_CLARO, 1, 2, 4))
		t.set_color("font_color", clase, col[2])
		t.set_color("font_hover_color", clase, col[2])
		t.set_color("font_pressed_color", clase, col[2])
		t.set_color("font_hover_pressed_color", clase, col[2])
		t.set_color("font_focus_color", clase, col[2])
		t.set_color("font_disabled_color", clase, Color8(120, 110, 96))
		t.set_font("font", clase, fuentes.get("negrita"))
		t.set_font_size("font_size", clase, 17)
	# desplegables
	t.set_font("font", "OptionButton", fuentes.get("negrita"))
	t.set_font_size("font_size", "OptionButton", 16)
	for estado in ["normal", "hover", "pressed", "focus"]:
		var s := caja(CREMA if estado == "hover" else PERGAMINO, BRONCE_CLARO if estado == "hover" else BRONCE, 1, 3, 6)
		s.content_margin_right = 26
		t.set_stylebox(estado, "OptionButton", s)
	t.set_stylebox("disabled", "OptionButton", caja(Color(PERGAMINO_OSCURO, 0.7), GRIS, 1, 3, 6))
	for c in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color", "font_hover_pressed_color"]:
		t.set_color(c, "OptionButton", TINTA)
	t.set_color("font_disabled_color", "OptionButton", TINTA_SUAVE)
	t.set_stylebox("panel", "PopupMenu", caja(PERGAMINO, BRONCE, 2, 3, 4))
	t.set_stylebox("hover", "PopupMenu", caja(Color(ROJO_SELLO, 0.85), ROJO_SELLO, 0, 2, 4))
	t.set_color("font_color", "PopupMenu", TINTA)
	t.set_color("font_hover_color", "PopupMenu", CREMA)
	t.set_font("font", "PopupMenu", fuentes.get("negrita"))
	t.set_font_size("font_size", "PopupMenu", 16)
	# casillas
	t.set_icon("checked", "CheckBox", _icono_casilla(true))
	t.set_icon("unchecked", "CheckBox", _icono_casilla(false))
	t.set_icon("checked_disabled", "CheckBox", _icono_casilla(true))
	t.set_icon("unchecked_disabled", "CheckBox", _icono_casilla(false))
	for estado in ["normal", "hover", "pressed", "focus", "hover_pressed", "disabled"]:
		t.set_stylebox(estado, "CheckBox", StyleBoxEmpty.new())
	for c in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color", "font_hover_pressed_color"]:
		t.set_color(c, "CheckBox", TINTA)
	t.set_font("font", "CheckBox", fuentes.get("cuerpo"))
	t.set_font_size("font_size", "CheckBox", 17)
	# deslizadores
	var riel := caja(Color8(60, 40, 26), Color8(40, 26, 16), 1, 3, 0)
	riel.content_margin_top = 4
	riel.content_margin_bottom = 4
	t.set_stylebox("slider", "HSlider", riel)
	t.set_stylebox("grabber_area", "HSlider", caja(Color8(214, 166, 48), Color8(150, 110, 30), 1, 3, 0))
	t.set_stylebox("grabber_area_highlight", "HSlider", caja(Color8(232, 186, 70), Color8(150, 110, 30), 1, 3, 0))
	t.set_icon("grabber", "HSlider", _icono_perilla())
	t.set_icon("grabber_highlight", "HSlider", _icono_perilla())
	# campos de texto
	t.set_stylebox("normal", "LineEdit", caja(CREMA, BRONCE, 1, 3, 6))
	t.set_stylebox("focus", "LineEdit", caja(Color(0, 0, 0, 0), ROJO_SELLO, 2, 3, 6))
	t.set_stylebox("read_only", "LineEdit", caja(PERGAMINO_OSCURO, GRIS, 1, 3, 6))
	t.set_color("font_color", "LineEdit", TINTA)
	t.set_color("font_placeholder_color", "LineEdit", Color(TINTA_SUAVE, 0.7))
	t.set_color("caret_color", "LineEdit", ROJO_SELLO)
	t.set_color("selection_color", "LineEdit", Color(BRONCE, 0.5))
	t.set_font_size("font_size", "LineEdit", 17)
	# listas y tablas
	for clase in ["ItemList", "Tree"]:
		t.set_stylebox("panel", clase, caja(Color8(240, 230, 206), Color8(70, 50, 32), 1, 2, 4))
		t.set_stylebox("focus", clase, StyleBoxEmpty.new())
		t.set_stylebox("selected", clase, caja(Color(ROJO_SELLO, 0.85), ROJO_SELLO, 0, 2, 2))
		t.set_stylebox("selected_focus", clase, caja(Color(ROJO_SELLO, 0.9), ROJO_SELLO, 0, 2, 2))
		t.set_stylebox("hovered", clase, caja(Color(BRONCE_CLARO, 0.35), BRONCE, 0, 2, 2))
		t.set_color("font_color", clase, TINTA)
		t.set_color("font_selected_color", clase, CREMA)
		t.set_color("font_hovered_color", clase, TINTA)
		t.set_color("guide_color", clase, Color(TINTA_SUAVE, 0.15))
		t.set_font_size("font_size", clase, 16)
	t.set_stylebox("cursor", "Tree", StyleBoxEmpty.new())
	t.set_stylebox("cursor_unfocused", "Tree", StyleBoxEmpty.new())
	t.set_stylebox("title_button_normal", "Tree", caja(PERGAMINO_OSCURO, Color8(120, 90, 60), 1, 0, 4))
	t.set_stylebox("title_button_hover", "Tree", caja(PERGAMINO_OSCURO, Color8(120, 90, 60), 1, 0, 4))
	t.set_stylebox("title_button_pressed", "Tree", caja(PERGAMINO_OSCURO, Color8(120, 90, 60), 1, 0, 4))
	t.set_color("title_button_color", "Tree", TINTA)
	t.set_font("title_button_font", "Tree", fuentes.get("negrita"))
	t.set_font_size("title_button_font_size", "Tree", 15)
	t.set_constant("v_separation", "Tree", 6)
	t.set_constant("v_separation", "ItemList", 6)
	t.set_constant("draw_guides", "Tree", 1)
	t.set_constant("item_margin", "Tree", 0)
	# barras de desplazamiento
	for clase in ["VScrollBar", "HScrollBar"]:
		t.set_stylebox("scroll", clase, caja(Color(MADERA, 0.25), Color(0, 0, 0, 0), 0, 3, 3))
		t.set_stylebox("grabber", clase, caja(BRONCE, Color8(110, 80, 40), 1, 3, 3))
		t.set_stylebox("grabber_highlight", clase, caja(BRONCE_CLARO, Color8(110, 80, 40), 1, 3, 3))
		t.set_stylebox("grabber_pressed", clase, caja(BRONCE_CLARO, Color8(110, 80, 40), 1, 3, 3))
	# globos de ayuda
	t.set_stylebox("panel", "TooltipPanel", caja(Color(Color8(34, 22, 14), 0.96), BRONCE, 1, 3, 8))
	t.set_color("font_color", "TooltipLabel", CREMA)
	t.set_font("font", "TooltipLabel", fuentes.get("cuerpo"))
	t.set_font_size("font_size", "TooltipLabel", 16)
	# texto con formato
	t.set_color("default_color", "RichTextLabel", TINTA)
	t.set_font("normal_font", "RichTextLabel", fuentes.get("cuerpo"))
	t.set_font("bold_font", "RichTextLabel", fuentes.get("negrita"))
	t.set_font("italics_font", "RichTextLabel", fuentes.get("cursiva"))
	return t


## Etiqueta con la fuente y el tamaño pedidos.
static func etiqueta(texto: String, fuente: Font, tam: int, color := CREMA) -> Label:
	var l := Label.new()
	l.text = texto
	l.add_theme_font_override("font", fuente)
	l.add_theme_font_size_override("font_size", tam)
	l.add_theme_color_override("font_color", color)
	return l
