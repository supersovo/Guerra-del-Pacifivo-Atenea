## Panel de mando de la batalla: la franja superior (caja, agua, tropa, reloj y viento), el
## parte de la selección, la tarjeta de órdenes, los avisos, las barras de vida y el
## recuadro de selección (dibujados sobre la vista) y los carteles de fin y del menú.
extends CanvasLayer

const Tema = preload("res://codigo/ui/tema.gd")
const Tarjeta = preload("res://codigo/ui/tarjeta.gd")

const ALTO_SUP := 40
const ALTO_INF := 190
const RUMBOS := ["E", "ESE", "SE", "SSE", "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO", "N", "NNE", "NE", "ENE"]

signal boton_pulsado(indice: int)
signal menu_pedido

var batalla                      # la escena de batalla (para leer el estado y la selección)
var fuentes: Dictionary
var superior: PanelContainer
var lbl_dinero: Label
var lbl_agua: Label
var lbl_pob: Label
var lbl_reloj: Label
var lbl_viento: Label
var inferior: PanelContainer
var lbl_nombre: Label
var lbl_parte: RichTextLabel
var rejilla: GridContainer
var botones: Array[Button] = []
var lbl_ayuda: RichTextLabel
var avisos: VBoxContainer
var lbl_modo: Label
var lienzo: Control
var cartel: PanelContainer
var _mensajes: Array = []        # [Label, hasta]
var _ultimos_botones: Array = []


func _init(escena, fuentes_: Dictionary) -> void:
	batalla = escena
	fuentes = fuentes_
	layer = 5


func _ready() -> void:
	var raiz := Control.new()
	raiz.set_anchors_preset(Control.PRESET_FULL_RECT)
	raiz.mouse_filter = Control.MOUSE_FILTER_IGNORE
	raiz.theme = Juego.tema
	add_child(raiz)

	# lienzo para barras de vida, recuadro de selección y marcas (debajo de los paneles)
	lienzo = Control.new()
	lienzo.set_anchors_preset(Control.PRESET_FULL_RECT)
	lienzo.mouse_filter = Control.MOUSE_FILTER_IGNORE
	lienzo.draw.connect(_dibujar_lienzo)
	raiz.add_child(lienzo)

	# franja superior
	superior = PanelContainer.new()
	superior.set_anchors_preset(Control.PRESET_TOP_WIDE)
	superior.custom_minimum_size = Vector2(0, ALTO_SUP)
	superior.add_theme_stylebox_override("panel", Tema.caja(Color(Tema.MADERA, 0.92), Tema.BRONCE, 0, 0, 6))
	raiz.add_child(superior)
	var fila := HBoxContainer.new()
	fila.add_theme_constant_override("separation", 28)
	superior.add_child(fila)
	lbl_dinero = _dato(fila, "$ 0", Color8(240, 206, 90))
	lbl_agua = _dato(fila, "Agua 0", Color8(120, 190, 240))
	lbl_pob = _dato(fila, "Tropa 0/0", Tema.CREMA)
	lbl_reloj = _dato(fila, "00:00", Tema.CREMA)
	lbl_viento = _dato(fila, "Viento —", Tema.PERGAMINO_OSCURO)
	var hueco := Control.new()
	hueco.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	fila.add_child(hueco)
	var btn_menu := Button.new()
	btn_menu.text = "Menú (F10)"
	btn_menu.focus_mode = Control.FOCUS_NONE
	btn_menu.pressed.connect(func() -> void: menu_pedido.emit())
	fila.add_child(btn_menu)

	# franja inferior: parte de la selección y tarjeta de órdenes
	inferior = PanelContainer.new()
	inferior.anchor_left = 0.0
	inferior.anchor_right = 1.0
	inferior.anchor_top = 1.0
	inferior.anchor_bottom = 1.0
	inferior.offset_top = -ALTO_INF
	inferior.add_theme_stylebox_override("panel", Tema.caja(Color(Tema.MADERA, 0.94), Tema.BRONCE, 2, 0, 10))
	raiz.add_child(inferior)
	var abajo := HBoxContainer.new()
	abajo.add_theme_constant_override("separation", 14)
	inferior.add_child(abajo)
	var parte := VBoxContainer.new()
	parte.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	abajo.add_child(parte)
	lbl_nombre = Tema.etiqueta("", fuentes["titulo"], 24, Tema.BRONCE_CLARO)
	parte.add_child(lbl_nombre)
	lbl_parte = RichTextLabel.new()
	lbl_parte.bbcode_enabled = true
	lbl_parte.fit_content = false
	lbl_parte.scroll_active = false
	lbl_parte.size_flags_vertical = Control.SIZE_EXPAND_FILL
	lbl_parte.add_theme_font_override("normal_font", fuentes["cuerpo"])
	lbl_parte.add_theme_font_override("bold_font", fuentes["negrita"])
	lbl_parte.add_theme_font_size_override("normal_font_size", 16)
	lbl_parte.add_theme_font_size_override("bold_font_size", 16)
	lbl_parte.add_theme_color_override("default_color", Tema.CREMA)
	lbl_parte.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parte.add_child(lbl_parte)
	var derecha := VBoxContainer.new()
	derecha.custom_minimum_size = Vector2(600, 0)
	abajo.add_child(derecha)
	rejilla = GridContainer.new()
	rejilla.columns = Tarjeta.COLUMNAS
	rejilla.add_theme_constant_override("h_separation", 6)
	rejilla.add_theme_constant_override("v_separation", 6)
	derecha.add_child(rejilla)
	for i in Tarjeta.COLUMNAS * Tarjeta.FILAS:
		var b := Button.new()
		b.custom_minimum_size = Vector2(142, 40)
		b.focus_mode = Control.FOCUS_NONE
		b.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		b.add_theme_font_size_override("font_size", 13)
		b.pressed.connect(_pulsado.bind(i))
		b.mouse_entered.connect(_sobre.bind(i))
		b.mouse_exited.connect(func() -> void: lbl_ayuda.text = "")
		rejilla.add_child(b)
		botones.append(b)
	lbl_ayuda = RichTextLabel.new()
	lbl_ayuda.bbcode_enabled = true
	lbl_ayuda.custom_minimum_size = Vector2(0, 34)
	lbl_ayuda.scroll_active = false
	lbl_ayuda.add_theme_font_override("normal_font", fuentes["cursiva"])
	lbl_ayuda.add_theme_font_size_override("normal_font_size", 14)
	lbl_ayuda.add_theme_color_override("default_color", Tema.PERGAMINO)
	lbl_ayuda.mouse_filter = Control.MOUSE_FILTER_IGNORE
	derecha.add_child(lbl_ayuda)

	# avisos (arriba a la izquierda) y la indicación del modo (arriba al centro)
	avisos = VBoxContainer.new()
	avisos.position = Vector2(14, ALTO_SUP + 10)
	avisos.mouse_filter = Control.MOUSE_FILTER_IGNORE
	raiz.add_child(avisos)
	lbl_modo = Tema.etiqueta("", fuentes["negrita"], 18, Tema.CREMA)
	lbl_modo.set_anchors_preset(Control.PRESET_CENTER_TOP)
	lbl_modo.position.y = ALTO_SUP + 10
	lbl_modo.grow_horizontal = Control.GROW_DIRECTION_BOTH
	lbl_modo.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	lbl_modo.add_theme_color_override("font_shadow_color", Color.BLACK)
	lbl_modo.add_theme_constant_override("shadow_offset_x", 2)
	lbl_modo.add_theme_constant_override("shadow_offset_y", 2)
	raiz.add_child(lbl_modo)


func _dato(padre: Control, texto: String, color: Color) -> Label:
	var l := Tema.etiqueta(texto, fuentes["negrita"], 19, color)
	padre.add_child(l)
	return l


## ¿La posición de la pantalla cae sobre un panel (y no sobre el campo)?
func contiene(pos: Vector2) -> bool:
	if superior.get_global_rect().has_point(pos) or inferior.get_global_rect().has_point(pos):
		return true
	return cartel != null and cartel.visible and cartel.get_global_rect().has_point(pos)


func mensaje(texto: String, color := Tema.CREMA, segundos := 6.0) -> void:
	var l := Tema.etiqueta(texto, fuentes["negrita"], 17, color)
	l.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.9))
	l.add_theme_constant_override("shadow_offset_x", 1)
	l.add_theme_constant_override("shadow_offset_y", 1)
	avisos.add_child(l)
	_mensajes.append([l, Time.get_ticks_msec() / 1000.0 + segundos])
	while _mensajes.size() > 8:
		var viejo: Array = _mensajes.pop_front()
		viejo[0].queue_free()


func _pulsado(i: int) -> void:
	boton_pulsado.emit(i)


func _sobre(i: int) -> void:
	if i >= _ultimos_botones.size() or _ultimos_botones[i] == null:
		lbl_ayuda.text = ""
		return
	var b: Dictionary = _ultimos_botones[i]
	var txt := "[b]%s[/b]" % b["texto"]
	if b["atajo"] != "":
		txt += " (%s)" % b["atajo"]
	if b["costo"] != null:
		txt += " — $%d, agua %d" % [int(b["costo"][0]), int(b["costo"][1])]
	if b["falta"] != "":
		txt += " — [color=#f08070]requiere %s[/color]" % b["falta"]
	txt += "  " + b["descripcion"]
	lbl_ayuda.text = txt


## Pone al día la franja superior, la tarjeta, el parte, los avisos y el lienzo.
func actualizar(est, seleccion: Array, slots: Array, modo: Variant) -> void:
	if est.espectador:
		lbl_dinero.text = "Repetición" if Juego.inicio.get("repeticion") else "Espectador"
		lbl_agua.text = ""
		lbl_pob.text = ""
	else:
		lbl_dinero.text = "$ %d" % est.dinero
		lbl_agua.text = "Agua %d" % est.agua
		lbl_pob.text = "Tropa %d/%d" % [est.pob, est.pob_max]
	var seg := int(est.tick / 16)
	lbl_reloj.text = "%02d:%02d" % [seg / 60, seg % 60]
	var fuerza := int(est.viento[1])
	lbl_viento.text = "Viento %s %d" % [RUMBOS[posmod(int(est.viento[0]), 16)], fuerza] if fuerza > 0 else "Viento en calma"
	_ultimos_botones = slots
	for i in botones.size():
		var b: Button = botones[i]
		var d: Variant = slots[i] if i < slots.size() else null
		if d == null:
			b.visible = false
			continue
		b.visible = true
		var txt: String = d["texto"]
		if d["atajo"] != "" and d["atajo"] != "ESC":
			txt = "%s [%s]" % [txt, d["atajo"]]
		if int(d["enfriando"]) > 0:
			txt += " (%ds)" % ceili(int(d["enfriando"]) / 16.0)
		if d["marcado"]:
			txt = "» " + txt
		b.text = txt
		b.disabled = not d["activo"] or int(d["enfriando"]) > 0
	_parte(est, seleccion)
	if modo != null and modo[0] == "objetivo":
		lbl_modo.text = "Elija el objetivo (clic derecho o Esc para cancelar)"
	elif modo != null and modo[0] == "construir":
		lbl_modo.text = "Elija el lugar de la obra (clic derecho o Esc para cancelar)"
	else:
		lbl_modo.text = ""
	var ahora := Time.get_ticks_msec() / 1000.0
	var quedan: Array = []
	for m in _mensajes:
		if m[1] < ahora:
			m[0].queue_free()
		else:
			m[0].modulate.a = clampf(m[1] - ahora, 0.0, 1.0)
			quedan.append(m)
	_mensajes = quedan
	lienzo.queue_redraw()


func _parte(est, seleccion: Array) -> void:
	var cat = est.cat
	var ents: Array = []
	for i in seleccion:
		if est.ents.has(i):
			ents.append(est.ents[i])
	if ents.is_empty():
		lbl_nombre.text = ""
		lbl_parte.text = "[i]Sin selección. Arrastre para elegir tropas; clic derecho para dar órdenes.[/i]"
		return
	if ents.size() == 1:
		var e = ents[0]
		var ex: Dictionary = e.ex if typeof(e.ex) == TYPE_DICTIONARY else {}
		if e.es_recurso():
			var salitre: bool = e.t == cat.especiales["salitre"]
			lbl_nombre.text = "Yacimiento de salitre" if salitre else "Pozo de agua"
			lbl_parte.text = "Quedan %d %s." % [e.vida, "quintales de caliche" if salitre else "litros"]
			return
		if e.tipo == null:
			lbl_nombre.text = ""
			lbl_parte.text = ""
			return
		var fac: String = est.faccion(e.dueno)
		lbl_nombre.text = cat.nombre(fac, e.tipo["id"])
		var dueno: String = est.jugadores[e.dueno]["nombre"] if e.dueno >= 0 and e.dueno < est.jugadores.size() else ""
		var vida_max: int = int(ex.get("vm", e.tipo["vida"]))
		var lineas: Array = []
		lineas.append("[b]Vida[/b] %d/%d   [b]Armadura[/b] %d   %s" % [e.vida, vida_max, int(e.tipo["armadura"]), dueno])
		if e.es_edificio():
			if e.fl & cat.bandera("OBRA"):
				lineas.append("En obra: %d %%" % int(ex.get("o", 0)))
			for it in ex.get("q", []):
				var t: Variant = cat.tipo(int(it[0]))
				if t != null:
					lineas.append("Formando: %s (%d %%)" % [cat.nombre(fac, t["id"]), int(it[2])])
			if ex.has("g"):
				lineas.append("Guarnición: %d" % ex["g"].size())
		else:
			var arma: Variant = e.tipo["arma"]
			if arma != null:
				lineas.append("[b]Arma[/b] %s, daño %d, alcance %.1f" % [cat.datos["nombres_ataque"].get(arma["tipo"], arma["tipo"]),
						int(arma["danio"]), float(arma["alcance"])])
			if ex.has("v"):
				lineas.append("Veterano de grado %d%s" % [int(ex["v"]), (" — " + str(ex["n"])) if ex.has("n") else ""])
			if ex.has("ag"):
				lineas.append("Cantimplora: %d %%" % int(ex["ag"]))
			if ex.has("fo") and int(ex["fo"]) > 0:
				var f: Variant = cat.formacion(int(ex["fo"]))
				if f != null:
					lineas.append("Formación: %s" % f["nombre"])
			if e.fl & cat.bandera("DESHIDRATADA"):
				lineas.append("[color=#f0a060]¡Sin agua![/color]")
			if e.fl & cat.bandera("COBERTURA"):
				lineas.append("A cubierto" + (" y a la sombra" if e.fl & cat.bandera("SOMBRA") else ""))
		lbl_parte.text = "\n".join(lineas)
		return
	# varias: cuántas de cada tipo
	var cuenta := {}
	var orden: Array = []
	for e in ents:
		if e.tipo == null:
			continue
		var n: String = cat.nombre(est.faccion(e.dueno), e.tipo["id"])
		if not cuenta.has(n):
			orden.append(n)
		cuenta[n] = int(cuenta.get(n, 0)) + 1
	lbl_nombre.text = "%d elegidos" % ents.size()
	var partes: Array = []
	for n in orden:
		partes.append("%d × %s" % [cuenta[n], n])
	lbl_parte.text = ", ".join(partes)


func _dibujar_lienzo() -> void:
	if batalla == null:
		return
	batalla.dibujar_superpuesto(lienzo)


## Cartel central (fin de la batalla, menú de campaña). Botones: [[texto, Callable], ...].
func mostrar_cartel(titulo: String, texto: String, opciones: Array) -> void:
	cerrar_cartel()
	cartel = PanelContainer.new()
	cartel.add_theme_stylebox_override("panel", Tema.caja(Color(Tema.PERGAMINO, 0.97), Tema.BRONCE, 3, 6, 24))
	cartel.set_anchors_preset(Control.PRESET_CENTER)
	cartel.grow_horizontal = Control.GROW_DIRECTION_BOTH
	cartel.grow_vertical = Control.GROW_DIRECTION_BOTH
	cartel.custom_minimum_size = Vector2(520, 0)
	get_child(0).add_child(cartel)
	var caja := VBoxContainer.new()
	caja.add_theme_constant_override("separation", 12)
	cartel.add_child(caja)
	var t := Tema.etiqueta(titulo, fuentes["titulo"], 40, Tema.ROJO)
	t.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	caja.add_child(t)
	if texto != "":
		var l := Tema.etiqueta(texto, fuentes["cursiva"], 18, Tema.TINTA)
		l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		caja.add_child(l)
	for op in opciones:
		var b := Button.new()
		b.text = op[0]
		b.custom_minimum_size = Vector2(300, 42)
		b.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
		b.focus_mode = Control.FOCUS_NONE
		b.pressed.connect(op[1])
		caja.add_child(b)


func cerrar_cartel() -> void:
	if cartel != null:
		cartel.queue_free()
		cartel = null


func hay_cartel() -> bool:
	return cartel != null
