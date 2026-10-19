## Tema de la interfaz: carta militar, pergamino, madera y bronce (los colores del juego).
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


static func caja(fondo: Color, borde: Color, ancho := 2, radio := 4, margen := 8) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = fondo
	s.border_color = borde
	s.set_border_width_all(ancho)
	s.set_corner_radius_all(radio)
	s.set_content_margin_all(margen)
	return s


static func crear(fuentes: Dictionary) -> Theme:
	var t := Theme.new()
	t.default_font = fuentes.get("cuerpo")
	t.default_font_size = 18
	t.set_stylebox("panel", "PanelContainer", caja(Color(MADERA, 0.94), BRONCE, 2, 6, 10))
	t.set_stylebox("panel", "Panel", caja(Color(MADERA, 0.94), BRONCE, 2, 6, 10))
	t.set_color("font_color", "Label", CREMA)
	t.set_color("font_color", "Button", TINTA)
	t.set_color("font_hover_color", "Button", TINTA)
	t.set_color("font_pressed_color", "Button", TINTA)
	t.set_color("font_disabled_color", "Button", TINTA_SUAVE)
	t.set_font("font", "Button", fuentes.get("negrita"))
	t.set_stylebox("normal", "Button", caja(PERGAMINO, BRONCE, 2, 4, 8))
	t.set_stylebox("hover", "Button", caja(CREMA, BRONCE_CLARO, 2, 4, 8))
	t.set_stylebox("pressed", "Button", caja(PERGAMINO_OSCURO, BRONCE, 2, 4, 8))
	t.set_stylebox("disabled", "Button", caja(Color(PERGAMINO, 0.5), BRONCE, 2, 4, 8))
	t.set_stylebox("focus", "Button", caja(Color(0, 0, 0, 0), BRONCE_CLARO, 2, 4, 8))
	for clase in ["OptionButton"]:
		t.set_font("font", clase, fuentes.get("negrita"))
		t.set_color("font_color", clase, TINTA)
		t.set_color("font_hover_color", clase, TINTA)
		t.set_stylebox("normal", clase, caja(PERGAMINO, BRONCE, 2, 4, 8))
		t.set_stylebox("hover", clase, caja(CREMA, BRONCE_CLARO, 2, 4, 8))
		t.set_stylebox("pressed", clase, caja(PERGAMINO_OSCURO, BRONCE, 2, 4, 8))
	t.set_stylebox("normal", "LineEdit", caja(CREMA, BRONCE, 2, 4, 6))
	t.set_color("font_color", "LineEdit", TINTA)
	t.set_stylebox("panel", "PopupMenu", caja(PERGAMINO, BRONCE, 2, 4, 6))
	t.set_color("font_color", "PopupMenu", TINTA)
	t.set_color("font_hover_color", "PopupMenu", ROJO)
	return t


## Etiqueta con la fuente y el tamaño pedidos.
static func etiqueta(texto: String, fuente: Font, tam: int, color := CREMA) -> Label:
	var l := Label.new()
	l.text = texto
	l.add_theme_font_override("font", fuente)
	l.add_theme_font_size_override("font_size", tam)
	l.add_theme_color_override("font_color", color)
	return l
