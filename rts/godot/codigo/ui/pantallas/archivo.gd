## Archivo histórico: naciones, héroes, unidades, edificios, campos de batalla y cronología de
## la guerra (salitre/cliente/escenas/archivo.py). Las cifras salen del mismo catálogo que usa
## el juego (y de las mismas funciones que el archivo del cliente de Python), de modo que lo
## que se lee aquí es lo que vale en el combate. Cada unidad y cada obra se ve en un retrato 3D
## que gira, y cada nación hace desfilar a su tropa.
extends "res://codigo/ui/pantallas/pantalla.gd"

const Mapas = preload("res://codigo/datos/mapas.gd")
const Modelos = preload("res://codigo/mundo/modelos.gd")
const Retrato = preload("res://codigo/ui/retrato.gd")

const COLOR_NACION := {"chile": 0, "peru": 3, "bolivia": 2, "argentina": 4}
const PESTANAS := [["naciones", "Naciones"], ["heroes", "Héroes"], ["unidades", "Unidades"],
		["edificios", "Edificios"], ["mapas", "Batallas"], ["cronologia", "Cronología"]]

var titulo := false
var velo := 0.47
var p_izq := Rect2(24, 16, 360, H - 32)
var p_der := Rect2(396, 16, W - 420, H - 32)
var nacion := "chile"
var pestana := "naciones"
var sel: Variant = null
var botones_pestana := {}
var botones_nacion := {}
var lista_fichas: ItemList
var desplazable: ScrollContainer
var ficha: VBoxContainer
var mapas := {}
var arch: Dictionary


func armar() -> void:
	arch = cat.datos["archivo"]
	nacion = Juego.config.leer("faccion") if Juego.config.leer("faccion") in NACIONES else "chile"
	panel(p_izq)
	panel(p_der)
	for i in PESTANAS.size():
		var clave: String = PESTANAS[i][0]
		var b := boton(Rect2(p_izq.position.x + 14 + (i % 3) * 112, p_izq.position.y + 14 + (i / 3) * 40, 106, 34),
				PESTANAS[i][1], func() -> void: elegir_pestana(clave), "normal", "", 16)
		botones_pestana[clave] = b
	for i in NACIONES.size():
		var n: String = NACIONES[i]
		var b := boton(Rect2(p_izq.position.x + 14 + i * 84, p_izq.position.y + 104, 78, 40), "",
				func() -> void: elegir_nacion(n))
		b.icon = Banderas.textura(n, 60, 28)
		b.icon_alignment = HORIZONTAL_ALIGNMENT_CENTER
		b.tooltip_text = cat.facciones[n]["nombre"]
		botones_nacion[n] = b
	lista_fichas = lista(Rect2(p_izq.position.x + 14, p_izq.position.y + 156, p_izq.size.x - 28, p_izq.size.y - 230),
			[], elegir)
	boton(Rect2(p_izq.position.x + 14, p_izq.end.y - 58, p_izq.size.x - 28, 42), "Volver", volver, "madera")
	desplazable = ScrollContainer.new()
	desplazable.position = p_der.position + Vector2(28, 22)
	desplazable.size = p_der.size - Vector2(56, 44)
	desplazable.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	lienzo.add_child(desplazable)
	ficha = VBoxContainer.new()
	ficha.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	ficha.add_theme_constant_override("separation", 8)
	desplazable.add_child(ficha)
	for d in Mapas.listar(Juego.dir_rts):
		var datos: Variant = Mapas.cargar(d["ruta"])
		if datos != null:
			mapas[d["id"]] = datos
	elegir_pestana("naciones")


func elegir_pestana(clave: String) -> void:
	pestana = clave
	var con_nacion := clave in ["heroes", "unidades"]
	for n in botones_nacion:
		botones_nacion[n].visible = con_nacion
	lista_fichas.position.y = p_izq.position.y + (156 if con_nacion else 104)
	lista_fichas.size.y = p_izq.size.y - (230 if con_nacion else 178)
	for k in botones_pestana:
		_marcar(botones_pestana[k], k == clave)
	_llenar()


func elegir_nacion(n: String) -> void:
	nacion = n
	_llenar()


func _marcar(b: Button, si: bool) -> void:
	for e in ["normal", "hover", "pressed"]:
		if si:
			b.add_theme_stylebox_override(e, Tema.caja(Color8(246, 232, 196), Tema.ROJO_SELLO, 2, 3, 4))
		else:
			b.remove_theme_stylebox_override(e)


func _llenar() -> void:
	for n in botones_nacion:
		_marcar(botones_nacion[n], n == nacion)
	var items: Array = []
	match pestana:
		"naciones":
			for n in NACIONES:
				items.append([n, cat.facciones[n]["ejercito"]])
		"heroes":
			for h in cat.facciones[nacion]["heroes"]:
				items.append([h, cat.tipos_por_id[h]["nombre"]])
		"unidades":
			for u in cat.facciones[nacion]["unidades"]:
				if not cat.tipos_por_id[u].get("heroe", false):
					items.append([u, cat.nombre(nacion, u)])
		"edificios":
			for t in cat.tipos:
				if t["edificio"]:
					var fac: Variant = t.get("faccion")
					items.append([t["id"], t["nombre"] + (("  (%s)" % cat.facciones[fac]["nombre"]) if fac != null else "")])
		"mapas":
			for k in mapas:
				items.append([k, mapas[k].get("nombre", k)])
		"cronologia":
			var crono: Array = arch["cronologia"]
			for i in crono.size():
				items.append([i, crono[i][0]])
	poner_items(lista_fichas, items)
	var primera: Variant = nacion if pestana == "naciones" else (items[0][0] if not items.is_empty() else null)
	elegir_en_lista(lista_fichas, primera)
	elegir(primera)


func elegir(clave: Variant) -> void:
	sel = clave
	if pestana == "naciones" and clave in NACIONES:
		nacion = clave
	for h in ficha.get_children():
		ficha.remove_child(h)
		h.queue_free()
	desplazable.scroll_vertical = 0
	if sel != null:
		call("_ficha_" + pestana)


# ----------------------------------------------------------------------
# Piezas de la ficha

func _rotulo(t: String, fuente: String, tam: int, color := Tema.TINTA, padre: Control = null) -> Label:
	var l := Tema.etiqueta(t, fuentes[fuente], tam, color)
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	(padre if padre != null else ficha).add_child(l)
	return l


## Título, subtítulo y la imagen a la derecha; abajo, la línea.
func _cabecera(t: String, sub: String, imagen_der: Control = null, texto_bajo := "") -> void:
	var fila := HBoxContainer.new()
	fila.add_theme_constant_override("separation", 16)
	ficha.add_child(fila)
	var col := VBoxContainer.new()
	col.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	fila.add_child(col)
	_rotulo(t, "titulo", 34, Tema.TINTA, col)
	if sub != "":
		_rotulo(sub, "cursiva", 18, Tema.TINTA_SUAVE, col)
	var raya := ColorRect.new()
	raya.color = Color8(120, 90, 60)
	raya.custom_minimum_size = Vector2(0, 1)
	col.add_child(raya)
	if texto_bajo != "":
		_rotulo(texto_bajo, "negrita", 17, Tema.TINTA, col)
	if imagen_der != null:
		fila.add_child(imagen_der)


func _cifras(filas: Array) -> void:
	var grilla := GridContainer.new()
	grilla.columns = 4
	grilla.add_theme_constant_override("h_separation", 14)
	grilla.add_theme_constant_override("v_separation", 2)
	ficha.add_child(grilla)
	var mitad := (filas.size() + 1) / 2
	for i in mitad:
		for par in [filas[i], filas[i + mitad] if i + mitad < filas.size() else null]:
			var n := Tema.etiqueta(par[0] if par != null else "", fuentes["negrita"], 16, Tema.TINTA_SUAVE)
			n.custom_minimum_size = Vector2(130, 0)
			grilla.add_child(n)
			var v := Tema.etiqueta(par[1] if par != null else "", fuentes["cuerpo"], 16, Tema.TINTA)
			v.custom_minimum_size = Vector2(250, 0)
			v.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
			grilla.add_child(v)


func _sangria(t: String, fuente := "cuerpo", tam := 17, color := Tema.TINTA) -> void:
	var m := MarginContainer.new()
	m.add_theme_constant_override("margin_left", 16)
	ficha.add_child(m)
	_rotulo(t, fuente, tam, color, m)


func _retrato(mallas: Array, tam := Vector2(180, 180), girar := true, rumbo := 0.0) -> Control:
	var r := Retrato.new(tam)
	r.girar = girar
	r.mostrar(mallas, 0.15, rumbo)
	var marco := PanelContainer.new()
	marco.add_theme_stylebox_override("panel", Tema.caja(Color8(226, 210, 176), Color8(150, 120, 84), 1, 3, 2))
	marco.add_child(r)
	return marco


func _malla_unidad(t: Dictionary, fac: String) -> Mesh:
	var color: Color = cat.color_jugador(COLOR_NACION.get(fac, 0))
	return Modelos.unidad(t, cat.uniforme_base(fac), cat.uniforme_propio(fac, t["forma"]), color, fac)


# ----------------------------------------------------------------------
# Fichas

func _ficha_naciones() -> void:
	var f: Dictionary = cat.facciones[sel]
	var a: Dictionary = arch["facciones"][sel]
	var b := TextureRect.new()
	b.texture = Banderas.textura(sel, 160, 100)
	b.custom_minimum_size = Vector2(160, 100)
	b.stretch_mode = TextureRect.STRETCH_KEEP
	_cabecera(f["ejercito"], f["nombre"], b, a["descripcion"])
	_rotulo(a["historia"], "cursiva", 18, Tema.TINTA_SUAVE)
	for bon in a["bonificaciones"]:
		_rotulo(bon[0], "negrita", 18, Tema.ROJO_SELLO)
		_sangria(bon[1])
	_rotulo("Unidades propias", "negrita", 18)
	var propias: Array = []
	var normales: Array = []
	var heroes: Array = []
	for u in f["unidades"]:
		var t: Dictionary = cat.tipos_por_id[u]
		if t.get("faccion") == sel:
			propias.append(u)
			if t.get("heroe", false):
				heroes.append(t["nombre"])
			else:
				normales.append(cat.nombre(sel, u))
	_sangria("Especiales: " + (", ".join(normales) if not normales.is_empty() else "—"))
	_sangria("Héroes: " + (", ".join(heroes) if not heroes.is_empty() else "—"))
	# desfile: la tropa de la nación, con sus uniformes, de perfil
	var mallas: Array = []
	for u in propias + ["infante", "granadero", "canon_campana"]:
		var t: Dictionary = cat.tipos_por_id.get(u, {})
		if t.is_empty() or int(t.get("capa", 0)) == 1 or t.get("clase") == "naval" or mallas.size() >= 9:
			continue
		mallas.append(_malla_unidad(t, sel))
	if not mallas.is_empty():
		var r := _retrato(mallas, Vector2(desplazable.size.x - 20, 170), false, 0.0)
		ficha.add_child(r)


func _ficha_unidad(t: Dictionary, nombre: String) -> void:
	var a: Dictionary = arch["unidades"][t["id"]]
	var fac: String = t.get("faccion") if t.get("faccion") != null else nacion
	_cabecera(nombre, a["sub"], _retrato([_malla_unidad(t, fac)]), t.get("descripcion", ""))
	_cifras(a["filas"])
	if a["aura"] != null:
		_rotulo(a["aura"][0], "negrita", 17, Tema.ROJO_SELLO)
		_sangria(a["aura"][1])
	for h in a["habilidades"]:
		_rotulo(h[0], "negrita", 17)
		_sangria(h[1], "cuerpo", 16)
	_rotulo(a["historia"], "cursiva", 17, Tema.TINTA_SUAVE)


func _ficha_heroes() -> void:
	var t: Dictionary = cat.tipos_por_id[sel]
	_ficha_unidad(t, t["nombre"])


func _ficha_unidades() -> void:
	_ficha_unidad(cat.tipos_por_id[sel], cat.nombre(nacion, sel))


func _ficha_edificios() -> void:
	var t: Dictionary = cat.tipos_por_id[sel]
	var a: Dictionary = arch["edificios"][sel]
	var fac: String = t.get("faccion") if t.get("faccion") != null else nacion
	var malla: Mesh = Modelos.edificio(t, cat.color_jugador(COLOR_NACION.get(fac, 0)), fac)
	_cabecera(t["nombre"], a["sub"], _retrato([malla], Vector2(200, 180)), t.get("descripcion", ""))
	_cifras(a["filas"])
	if not t["produce"].is_empty():
		var nombres: Array = []
		for u in t["produce"]:
			if u in cat.facciones[fac]["unidades"]:
				nombres.append(cat.nombre(fac, u))
		_rotulo("Forma: " + ", ".join(nombres), "cuerpo", 17)
	if not t["investiga"].is_empty():
		var nombres: Array = []
		for m in t["investiga"]:
			if cat.mejoras_por_id.has(m):
				nombres.append(cat.mejoras_por_id[m]["nombre"])
		_rotulo("Investiga: " + ", ".join(nombres), "cuerpo", 17)
	_rotulo(a["historia"], "cursiva", 17, Tema.TINTA_SUAVE)


func _ficha_mapas() -> void:
	var d: Dictionary = mapas[sel]
	var tex := Mapas.previa(cat, d, 3)
	var esc := minf(260.0 / tex.get_width(), 260.0 / tex.get_height())
	var img := TextureRect.new()
	img.texture = tex
	img.custom_minimum_size = Vector2(tex.get_width(), tex.get_height()) * esc
	img.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	img.stretch_mode = TextureRect.STRETCH_SCALE
	var sub := "%d jugadores · %d×%d casillas" % [int(d.get("jugadores", 2)), int(d["ancho"]), int(d["alto"])]
	if d.get("naval", false):
		sub += " · escenario naval"
	_cabecera(d.get("nombre", sel), sub, img, d.get("descripcion", ""))
	_rotulo(d.get("historia", ""), "cursiva", 18, Tema.TINTA_SUAVE)


func _ficha_cronologia() -> void:
	_cabecera("La Guerra del Pacífico", "1879-1884: cronología esencial")
	var crono: Array = arch["cronologia"]
	for i in crono.size():
		var fila := HBoxContainer.new()
		fila.add_theme_constant_override("separation", 12)
		ficha.add_child(fila)
		var marca := ColorRect.new()
		marca.custom_minimum_size = Vector2(4, 0)
		marca.color = Tema.ROJO_SELLO if i == sel else Color(0, 0, 0, 0)
		fila.add_child(marca)
		var f := Tema.etiqueta(crono[i][0], fuentes["negrita"], 16, Tema.ROJO_SELLO if i == sel else Tema.TINTA)
		f.custom_minimum_size = Vector2(110, 0)
		fila.add_child(f)
		_rotulo(crono[i][1], "cuerpo", 16, Tema.TINTA if i == sel else Tema.TINTA_SUAVE, fila)
	await get_tree().process_frame
	# la elegida, a la vista
	if is_instance_valid(desplazable) and sel is int and sel < ficha.get_child_count() - 1:
		desplazable.ensure_control_visible(ficha.get_child(int(sel) + 1))
