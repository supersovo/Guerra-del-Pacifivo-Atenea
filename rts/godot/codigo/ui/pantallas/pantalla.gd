## Base de las pantallas del menú: un lienzo de 1280×720 centrado en la ventana, sobre el
## diorama de fondo, con los controles del estilo del juego ubicados en las mismas
## coordenadas que el cliente de Python (salitre/cliente/escenas/).
##
## El menú (menu.gd) abre una pantalla a la vez, le pasa los mensajes del servidor
## (mensaje) y la tecla Esc (escape). Las pantallas no cambian de escena: piden otra al menú.
extends Control

const Tema = preload("res://codigo/ui/tema.gd")
const Marco = preload("res://codigo/ui/marco.gd")
const Boton = preload("res://codigo/ui/boton.gd")
const Banderas = preload("res://codigo/ui/banderas.gd")

const W := 1280
const H := 720
const NACIONES := ["chile", "peru", "bolivia", "argentina"]
const NOMBRE_VELOCIDAD := {"normal": "Normal", "rapida": "Rápida", "muy_rapida": "Muy rápida"}

var menu                        # el menú que la muestra (menu.gd)
var args: Dictionary = {}
var lienzo: Control
var fuentes: Dictionary
var cat
var musica: Variant = "marcha"  # pista que suena en esta pantalla
var usa_red := false            # recibe los mensajes del servidor


func _init() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE


func _ready() -> void:
	fuentes = Juego.fuentes
	cat = Juego.catalogo
	theme = Juego.tema
	lienzo = Control.new()
	lienzo.anchor_left = 0.5
	lienzo.anchor_right = 0.5
	lienzo.anchor_top = 0.5
	lienzo.anchor_bottom = 0.5
	lienzo.offset_left = -W / 2.0
	lienzo.offset_right = W / 2.0
	lienzo.offset_top = -H / 2.0
	lienzo.offset_bottom = H / 2.0
	lienzo.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(lienzo)
	armar()


## Cada pantalla arma aquí sus controles.
func armar() -> void:
	pass


## Un mensaje del servidor (solo si usa_red).
func mensaje(_m: Dictionary) -> void:
	pass


func escape() -> void:
	volver()


func volver() -> void:
	menu.abrir("portada")


func _process(delta: float) -> void:
	actualizar(delta)


func actualizar(_delta: float) -> void:
	pass


# ----------------------------------------------------------------------
# Controles

func _en(padre: Control) -> Control:
	return padre if padre != null else lienzo


func panel(r: Rect2, tipo := "pergamino", padre: Control = null) -> Control:
	var m := Marco.new(tipo)
	m.position = r.position
	m.size = r.size
	_en(padre).add_child(m)
	return m


## Título centrado de un panel con la línea de abajo (titulo_panel del cliente de Python).
func titulo_panel(r: Rect2, t: String, padre: Control = null) -> Label:
	var l := texto(Vector2(r.position.x + r.size.x / 2.0, r.position.y + 14), t, "titulo", 30, Tema.TINTA, "centro", padre)
	linea(Vector2(r.position.x + 30, r.position.y + 56), Vector2(r.end.x - 30, r.position.y + 56), Color8(120, 90, 60), padre)
	return l


func linea(desde: Vector2, hasta: Vector2, color: Color, padre: Control = null) -> ColorRect:
	var c := ColorRect.new()
	c.color = color
	c.mouse_filter = Control.MOUSE_FILTER_IGNORE
	if absf(desde.y - hasta.y) < absf(desde.x - hasta.x):
		c.position = Vector2(minf(desde.x, hasta.x), desde.y)
		c.size = Vector2(absf(hasta.x - desde.x), 1)
	else:
		c.position = Vector2(desde.x, minf(desde.y, hasta.y))
		c.size = Vector2(1, absf(hasta.y - desde.y))
	_en(padre).add_child(c)
	return c


## Texto en una línea; ancla izq, centro o der respecto de pos.x.
func texto(pos: Vector2, t: String, fuente := "cuerpo", tam := 17, color := Tema.TINTA, ancla := "izq",
		padre: Control = null, sombra := false) -> Label:
	var l := Tema.etiqueta(t, fuentes[fuente], tam, color)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	l.clip_text = false
	var ancho := 1200.0
	match ancla:
		"centro":
			l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
			l.position = Vector2(pos.x - ancho / 2.0, pos.y)
		"der":
			l.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
			l.position = Vector2(pos.x - ancho, pos.y)
		_:
			l.position = pos
			ancho = 0.0
	if ancho > 0.0:
		l.size = Vector2(ancho, 0)
	if sombra:
		l.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.85))
		l.add_theme_constant_override("shadow_offset_x", 2)
		l.add_theme_constant_override("shadow_offset_y", 2)
	_en(padre).add_child(l)
	return l


## Párrafo que se ajusta al ancho del rectángulo (y se corta en max_lineas, si se pide).
func parrafo(r: Rect2, t: String, fuente := "cuerpo", tam := 16, color := Tema.TINTA, max_lineas := 0,
		padre: Control = null) -> Label:
	var l := Tema.etiqueta(t, fuentes[fuente], tam, color)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.position = r.position
	l.size = Vector2(r.size.x, 0)
	l.custom_minimum_size = Vector2(r.size.x, 0)
	if max_lineas > 0:
		l.max_lines_visible = max_lineas
		l.text_overrun_behavior = TextServer.OVERRUN_TRIM_WORD_ELLIPSIS
	_en(padre).add_child(l)
	return l


func boton(r: Rect2, t: String, accion: Callable, tipo := "normal", ayuda := "", tam := 17,
		padre: Control = null) -> Boton:
	var b := Boton.new()
	b.text = t
	b.position = r.position
	b.size = r.size
	b.focus_mode = Control.FOCUS_NONE
	if tipo != "normal":
		b.theme_type_variation = "Boton" + tipo.capitalize()
	b.add_theme_font_size_override("font_size", tam)
	if ayuda != "":
		b.tooltip_text = ayuda
	b.pressed.connect(accion)
	_en(padre).add_child(b)
	return b


## Desplegable: items = [[clave, texto]]; accion(clave) al elegir.
func opciones(r: Rect2, items: Array, valor: Variant, accion := Callable(), padre: Control = null) -> OptionButton:
	var o := OptionButton.new()
	o.position = r.position
	o.size = r.size
	o.fit_to_longest_item = false
	o.focus_mode = Control.FOCUS_NONE
	o.clip_text = true
	poner_opciones(o, items, valor)
	o.item_selected.connect(func(i: int) -> void:
		Sonido.ui("clic")
		if accion.is_valid():
			accion.call(o.get_item_metadata(i)))
	_en(padre).add_child(o)
	return o


func poner_opciones(o: OptionButton, items: Array, valor: Variant) -> void:
	o.clear()
	for it in items:
		o.add_item(str(it[1]))
		o.set_item_metadata(o.item_count - 1, it[0])
	poner_valor(o, valor)


## ¿Son la misma clave? (sin comparar números con textos, que Godot no admite)
static func iguales(a: Variant, b: Variant) -> bool:
	var na := a is int or a is float
	var nb := b is int or b is float
	if na or nb:
		return na and nb and a == b
	return typeof(a) == typeof(b) and a == b


func valor_de(o: OptionButton) -> Variant:
	return o.get_item_metadata(o.selected) if o.selected >= 0 else null


func poner_valor(o: OptionButton, v: Variant) -> void:
	for i in o.item_count:
		if iguales(o.get_item_metadata(i), v):
			o.select(i)
			return
	if o.item_count > 0 and o.selected < 0:
		o.select(0)


func casilla(r: Rect2, t: String, valor: bool, accion := Callable(), padre: Control = null) -> CheckBox:
	var c := CheckBox.new()
	c.text = t
	c.button_pressed = valor
	c.position = r.position
	c.size = r.size
	c.focus_mode = Control.FOCUS_NONE
	c.toggled.connect(func(v: bool) -> void:
		Sonido.ui("clic")
		if accion.is_valid():
			accion.call(v))
	_en(padre).add_child(c)
	return c


func deslizador(r: Rect2, valor: float, minimo: float, maximo: float, accion := Callable(),
		padre: Control = null) -> HSlider:
	var d := HSlider.new()
	d.min_value = minimo
	d.max_value = maximo
	d.step = 0.01
	d.value = valor
	d.position = r.position
	d.size = r.size
	d.focus_mode = Control.FOCUS_NONE
	if accion.is_valid():
		d.value_changed.connect(accion)
	_en(padre).add_child(d)
	return d


func campo(r: Rect2, t: String, maximo := 40, pista := "", oculto := false, al_enter := Callable(),
		padre: Control = null) -> LineEdit:
	var e := LineEdit.new()
	e.text = t
	e.max_length = maximo
	e.placeholder_text = pista
	e.secret = oculto
	e.position = r.position
	e.size = r.size
	if al_enter.is_valid():
		e.text_submitted.connect(func(_t: String) -> void: al_enter.call())
	_en(padre).add_child(e)
	return e


## Tabla: columnas = [[título, ancho, alineación]]; al_doble(clave) con doble clic o Intro.
func tabla(r: Rect2, columnas: Array, al_doble := Callable(), padre: Control = null) -> Tree:
	var t := Tree.new()
	t.position = r.position
	t.size = r.size
	t.columns = columnas.size()
	t.hide_root = true
	t.column_titles_visible = true
	t.select_mode = Tree.SELECT_ROW
	t.focus_mode = Control.FOCUS_CLICK
	t.scroll_horizontal_enabled = false
	for i in columnas.size():
		var c: Array = columnas[i]
		t.set_column_title(i, str(c[0]))
		t.set_column_custom_minimum_width(i, int(c[1]))
		t.set_column_expand(i, i == columnas.size() - 1)
		t.set_column_clip_content(i, true)
		t.set_column_title_alignment(i, _alineacion(str(c[2])))
	t.set_meta("columnas", columnas)
	t.create_item()
	var vacia := Tema.etiqueta("", fuentes["cursiva"], 15, Tema.TINTA_SUAVE)
	vacia.position = Vector2(12, 36)
	vacia.size = Vector2(r.size.x - 24, 0)
	vacia.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	vacia.name = "Vacia"
	t.add_child(vacia)
	if al_doble.is_valid():
		t.item_activated.connect(func() -> void:
			var it := t.get_selected()
			if it != null:
				al_doble.call(it.get_metadata(0)))
	_en(padre).add_child(t)
	return t


static func _alineacion(a: String) -> HorizontalAlignment:
	return HORIZONTAL_ALIGNMENT_CENTER if a == "centro" else (HORIZONTAL_ALIGNMENT_RIGHT if a == "der"
			else HORIZONTAL_ALIGNMENT_LEFT)


## Filas de una tabla: [[clave, [valores], color o null]]; la elegida se conserva si sigue.
func poner_filas(t: Tree, filas: Array, vacia := "") -> void:
	var antes: Variant = clave_tabla(t)
	var raiz := t.get_root()
	for hijo in raiz.get_children():
		raiz.remove_child(hijo)
		hijo.free()
	var columnas: Array = t.get_meta("columnas")
	for f in filas:
		var it := t.create_item(raiz)
		it.set_metadata(0, f[0])
		var valores: Array = f[1]
		var color: Variant = f[2] if f.size() > 2 else null
		for i in mini(valores.size(), columnas.size()):
			it.set_text(i, str(valores[i]))
			it.set_text_alignment(i, _alineacion(str(columnas[i][2])))
			if color != null:
				it.set_custom_color(i, color)
		if antes != null and iguales(f[0], antes):
			it.select(0)
	var l: Label = t.get_node("Vacia")
	l.text = vacia
	l.visible = filas.is_empty() and vacia != ""


func clave_tabla(t: Tree) -> Variant:
	var it := t.get_selected()
	return it.get_metadata(0) if it != null else null


## Lista de una columna: items = [[clave, texto, color o null]]; al_elegir(clave), al_doble(clave).
func lista(r: Rect2, items: Array, al_elegir := Callable(), al_doble := Callable(), padre: Control = null) -> ItemList:
	var l := ItemList.new()
	l.position = r.position
	l.size = r.size
	l.focus_mode = Control.FOCUS_CLICK
	l.add_theme_font_override("font", fuentes["negrita"])
	l.add_theme_font_size_override("font_size", 16)
	poner_items(l, items)
	l.item_selected.connect(func(i: int) -> void:
		Sonido.ui("clic")
		if al_elegir.is_valid():
			al_elegir.call(l.get_item_metadata(i)))
	if al_doble.is_valid():
		l.item_activated.connect(func(i: int) -> void: al_doble.call(l.get_item_metadata(i)))
	_en(padre).add_child(l)
	return l


func poner_items(l: ItemList, items: Array) -> void:
	var antes: Variant = clave_lista(l)
	l.clear()
	for it in items:
		var i := l.add_item(str(it[1]))
		l.set_item_metadata(i, it[0])
		if it.size() > 2 and it[2] != null:
			l.set_item_custom_fg_color(i, it[2])
		if antes != null and iguales(it[0], antes):
			l.select(i)


func clave_lista(l: ItemList) -> Variant:
	var sel := l.get_selected_items()
	return l.get_item_metadata(sel[0]) if sel.size() > 0 else null


func elegir_en_lista(l: ItemList, clave: Variant) -> void:
	for i in l.item_count:
		if iguales(l.get_item_metadata(i), clave):
			l.select(i)
			l.ensure_current_is_visible()
			return


func imagen(r: Rect2, tex: Texture2D, padre: Control = null, mantener := true) -> TextureRect:
	var t := TextureRect.new()
	# el modo de ajuste va antes que el tamaño: si no, el tamaño mínimo (el de la imagen) manda
	t.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	t.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED if mantener else TextureRect.STRETCH_SCALE
	t.texture = tex
	t.position = r.position
	t.size = r.size
	t.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_en(padre).add_child(t)
	return t


func bandera(r: Rect2, nacion: String, padre: Control = null) -> TextureRect:
	return imagen(r, Banderas.textura(nacion, int(r.size.x), int(r.size.y)), padre, false)


## Vista previa de un mapa con su marco oscuro, centrada en la caja y sin deformarla.
func previa_mapa(caja: Rect2, tex: Texture2D, padre: Control = null) -> Control:
	var grupo := Control.new()
	grupo.mouse_filter = Control.MOUSE_FILTER_IGNORE
	grupo.position = caja.position
	grupo.size = caja.size
	_en(padre).add_child(grupo)
	if tex == null:
		return grupo
	var esc := minf(caja.size.x / tex.get_width(), caja.size.y / tex.get_height())
	var tam := Vector2(tex.get_width(), tex.get_height()) * esc
	var pos := (caja.size - tam) / 2.0
	var fondo := ColorRect.new()
	fondo.color = Color8(60, 40, 24)
	fondo.position = pos - Vector2(3, 3)
	fondo.size = tam + Vector2(6, 6)
	fondo.mouse_filter = Control.MOUSE_FILTER_IGNORE
	grupo.add_child(fondo)
	imagen(Rect2(pos, tam), tex, grupo, false)
	return grupo


## ¿Sirve como nombre de jugador? (al menos tres letras)
func nombre_valido(t: String) -> bool:
	return t.strip_edges().length() >= 3
