## Botón con ayuda: al dejar el ratón encima muestra un globo con el título en negrita y la
## explicación (como los tooltips del cliente de Python). Suena el clic al pulsarlo.
extends Button

const Tema = preload("res://codigo/ui/tema.gd")

var ayuda_titulo := ""


func _init() -> void:
	pressed.connect(func() -> void: Sonido.ui("clic"))


func _make_custom_tooltip(para: String) -> Object:
	var l := RichTextLabel.new()
	l.bbcode_enabled = true
	l.fit_content = true
	l.custom_minimum_size = Vector2(340, 0)
	l.add_theme_color_override("default_color", Tema.CREMA)
	l.add_theme_font_size_override("normal_font_size", 16)
	l.add_theme_font_size_override("bold_font_size", 17)
	var titulo := ayuda_titulo if ayuda_titulo != "" else text
	l.text = "[b]%s[/b]\n%s" % [titulo, para] if titulo != "" else para
	return l
