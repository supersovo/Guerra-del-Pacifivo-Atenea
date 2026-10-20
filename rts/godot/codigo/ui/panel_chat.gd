## Conversación del salón o de la sala: el historial y el campo para escribir
## (PanelChat de salitre/cliente/ui/widgets.py). Lee Juego.chat_salon (el historial sobrevive
## al cambiar de pantalla) y envía con el canal indicado.
extends Control

const Tema = preload("res://codigo/ui/tema.gd")

var canal := "general"
var historial: RichTextLabel
var campo: LineEdit
var _contadas := -1


func _init(r: Rect2, c := "general") -> void:
	canal = c
	position = r.position
	size = r.size
	var fondo := Panel.new()
	fondo.add_theme_stylebox_override("panel", Tema.caja(Color8(240, 230, 206), Color8(70, 50, 32), 1, 2, 0))
	fondo.position = Vector2.ZERO
	fondo.size = r.size
	fondo.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(fondo)
	historial = RichTextLabel.new()
	historial.bbcode_enabled = true
	historial.scroll_following = true
	historial.position = Vector2(8, 6)
	historial.size = Vector2(r.size.x - 16, r.size.y - 52)
	historial.add_theme_font_override("normal_font", Juego.fuentes["cuerpo"])
	historial.add_theme_font_override("bold_font", Juego.fuentes["negrita"])
	historial.add_theme_font_override("italics_font", Juego.fuentes["cursiva"])
	historial.add_theme_font_size_override("normal_font_size", 16)
	historial.add_theme_font_size_override("bold_font_size", 16)
	historial.add_theme_font_size_override("italics_font_size", 15)
	historial.add_theme_color_override("default_color", Tema.TINTA)
	add_child(historial)
	campo = LineEdit.new()
	campo.position = Vector2(8, r.size.y - 38)
	campo.size = Vector2(r.size.x - 16, 30)
	campo.max_length = 200
	campo.placeholder_text = "Escriba un mensaje y pulse Enter"
	campo.text_submitted.connect(func(_t: String) -> void: enviar())
	add_child(campo)


func enviar() -> void:
	var t := campo.text.strip_edges()
	if t != "" and Juego.conexion.conectado():
		Juego.conexion.enviar({"t": "chat", "texto": t, "canal": canal})
	campo.text = ""


func con_foco() -> bool:
	return campo.has_focus()


func _process(_delta: float) -> void:
	if Juego.chat_salon.size() == _contadas:
		return
	_contadas = Juego.chat_salon.size()
	var lineas: Array = []
	for l in Juego.chat_salon:
		var de: String = l[0]
		var c: String = l[2]
		if canal == "sala" and c != "sala":
			continue
		if canal == "general" and c == "sala":
			continue
		lineas.append("[b][color=#%s]%s:[/color][/b] %s" % [Tema.ROJO_SELLO.to_html(false), _limpio(de), _limpio(l[1])])
	historial.text = "\n".join(lineas) if not lineas.is_empty() else "[i][color=#%s]Sin mensajes todavía.[/color][/i]" \
			% Tema.TINTA_SUAVE.to_html(false)


## El texto de los jugadores no puede abrir etiquetas de formato.
static func _limpio(t: String) -> String:
	return t.replace("[", "[lb]")
