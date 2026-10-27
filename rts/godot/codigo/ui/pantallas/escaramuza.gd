## Escaramuza: elegir mapa, nación y rivales controlados por la IA
## (salitre/cliente/escenas/escaramuza.py).
extends "res://codigo/ui/pantallas/pantalla.gd"

const Mapas = preload("res://codigo/datos/mapas.gd")

static var _previas := {}

var mapas := {}                 # id -> datos del mapa
var mapa := ""
var faccion := "chile"
var p_izq := Rect2(24, 140, 612, 556)
var p_der := Rect2(648, 140, 608, 556)
var lista_mapas: ItemList
var caja_previa: Control
var lbl_nombre: Label
var lbl_desc: Label
var lbl_hist: Label
var botones_nacion := {}
var lbl_ejercito: Label
var lbl_fac_desc: Label
var lbl_heroes: Label
var filas: Array = []           # [activo, nación, dificultad, equipo] por rival
var capa_filas: Control
var vel: OptionButton


func armar() -> void:
	var cfg = Juego.config
	for d in Mapas.listar(Juego.dir_rts):
		var datos: Variant = Mapas.cargar(d["ruta"])
		if datos != null:
			mapas[d["id"]] = datos
	panel(p_izq)
	panel(p_der)
	titulo_panel(p_izq, "Campo de batalla")
	titulo_panel(p_der, "Su nación y sus rivales")
	var items: Array = []
	for k in mapas:
		items.append([k, "%s  (%d)" % [mapas[k].get("nombre", k), int(mapas[k].get("jugadores", 2))]])
	lista_mapas = lista(Rect2(p_izq.position.x + 22, p_izq.position.y + 70, 236, 300), items, elegir_mapa)
	caja_previa = Control.new()
	caja_previa.mouse_filter = Control.MOUSE_FILTER_IGNORE
	lienzo.add_child(caja_previa)
	var x := p_izq.position.x + 24
	lbl_nombre = texto(Vector2(x, p_izq.position.y + 382), "", "titulo", 24, Tema.TINTA)
	lbl_desc = parrafo(Rect2(x, p_izq.position.y + 414, p_izq.size.x - 48, 0), "", "negrita", 16, Tema.TINTA, 3)
	lbl_hist = parrafo(Rect2(x, p_izq.position.y + 470, p_izq.size.x - 48, 0), "", "cursiva", 16, Tema.TINTA_SUAVE, 5)
	faccion = cfg.leer("faccion") if cfg.leer("faccion") in NACIONES else "chile"
	for i in NACIONES.size():
		var n: String = NACIONES[i]
		var b := boton(Rect2(p_der.position.x + 24 + i * 140, p_der.position.y + 70, 130, 56),
				cat.facciones[n]["nombre"], func() -> void: elegir_nacion(n), "normal", "", 17)
		b.icon = Banderas.textura(n, 44, 28)
		b.expand_icon = false
		b.alignment = HORIZONTAL_ALIGNMENT_LEFT
		botones_nacion[n] = b
	var xd := p_der.position.x + 24
	lbl_ejercito = texto(Vector2(xd, p_der.position.y + 138), "", "titulo", 22, Tema.TINTA)
	lbl_fac_desc = parrafo(Rect2(xd, p_der.position.y + 166, p_der.size.x - 48, 0), "", "cuerpo", 16, Tema.TINTA, 3)
	lbl_heroes = parrafo(Rect2(xd, p_der.position.y + 216, p_der.size.x - 48, 0), "", "cursiva", 15, Tema.TINTA_SUAVE, 2)
	texto(Vector2(xd, p_der.position.y + 262), "Rivales (su equipo es el 1)", "negrita", 17, Tema.TINTA)
	capa_filas = Control.new()
	capa_filas.mouse_filter = Control.MOUSE_FILTER_IGNORE
	lienzo.add_child(capa_filas)
	texto(Vector2(xd, p_der.end.y - 115), "Velocidad", "negrita", 17, Tema.TINTA)
	var vels: Array = []
	for v in cat.datos["velocidades"]:
		vels.append([v, NOMBRE_VELOCIDAD.get(v, v)])
	vel = opciones(Rect2(p_der.position.x + 150, p_der.end.y - 120, 200, 30), vels, "normal")
	boton(Rect2(p_der.position.x + 24, p_der.end.y - 64, 170, 44), "Volver", volver, "madera")
	boton(Rect2(p_der.end.x - 264, p_der.end.y - 64, 240, 44), "¡A la carga!", comenzar, "principal", "", 20)
	var inicial: String = cfg.leer("mapa")
	if not mapas.has(inicial):
		inicial = mapas.keys()[0] if not mapas.is_empty() else ""
	elegir_nacion(faccion)
	if inicial != "":
		elegir_en_lista(lista_mapas, inicial)
		elegir_mapa(inicial)


static func previa(cat_, d: Dictionary) -> Texture2D:
	var ident: String = d["id"]
	if not _previas.has(ident):
		_previas[ident] = Mapas.previa(cat_, d, 3)
	return _previas[ident]


func elegir_mapa(ident: String) -> void:
	mapa = ident
	var d: Dictionary = mapas[ident]
	for h in caja_previa.get_children():
		h.queue_free()
	previa_mapa(Rect2(p_izq.position.x + 272, p_izq.position.y + 70, 316, 300), previa(cat, d), caja_previa)
	lbl_nombre.text = d.get("nombre", ident)
	lbl_desc.text = d.get("descripcion", "")
	lbl_desc.reset_size()
	lbl_hist.position.y = lbl_desc.position.y + lbl_desc.get_combined_minimum_size().y + 6
	lbl_hist.text = d.get("historia", "")
	_armar_rivales(int(d.get("jugadores", 2)))


func _armar_rivales(jugadores: int) -> void:
	for h in capa_filas.get_children():
		h.queue_free()
	filas.clear()
	var y0 := p_der.position.y + 292
	var difs: Array = []
	for k in cat.datos["dificultades"]:
		difs.append([k, cat.datos["dificultades"][k]])
	var naciones: Array = [["azar", "Al azar"]]
	for n in NACIONES:
		naciones.append([n, cat.facciones[n]["nombre"]])
	var equipos: Array = []
	for e in range(1, 5):
		equipos.append([e, "Equipo %d" % e])
	for i in jugadores - 1:
		var y := y0 + i * 40
		var activo := casilla(Rect2(p_der.position.x + 24, y, 34, 30), "", i == 0, Callable(), capa_filas)
		if i == 0:
			activo.disabled = true     # el primer rival siempre va
		var nac := opciones(Rect2(p_der.position.x + 64, y, 150, 30), naciones,
				NACIONES[(NACIONES.find(faccion) + 1 + i) % 4], Callable(), capa_filas)
		var dif := opciones(Rect2(p_der.position.x + 222, y, 210, 30), difs, Juego.config.leer("dificultad"),
				Callable(), capa_filas)
		var eq := opciones(Rect2(p_der.position.x + 440, y, 140, 30), equipos, 2, Callable(), capa_filas)
		filas.append([activo, nac, dif, eq])


func elegir_nacion(n: String) -> void:
	faccion = n
	for k in botones_nacion:
		var b: Button = botones_nacion[k]
		if k == n:
			for estado in ["normal", "hover", "pressed"]:
				b.add_theme_stylebox_override(estado, Tema.caja(Color8(246, 232, 196), Tema.ROJO_SELLO, 3, 3, 6))
		else:
			for estado in ["normal", "hover", "pressed"]:
				b.remove_theme_stylebox_override(estado)
	var f: Dictionary = cat.facciones[n]
	lbl_ejercito.text = f["ejercito"]
	lbl_fac_desc.text = cat.datos["archivo"]["facciones"][n]["descripcion"]
	var heroes: Array = []
	for h in f["heroes"]:
		heroes.append(str(cat.tipos_por_id[h]["nombre"]).split(" (")[0])
	lbl_heroes.text = "Héroes: " + ", ".join(heroes)


## Los rivales elegidos: [{faccion, dificultad, equipo}].
func rivales() -> Array:
	var out: Array = []
	for f in filas:
		var activo: CheckBox = f[0]
		if not activo.button_pressed and not activo.disabled:
			continue
		var n: String = valor_de(f[1])
		if n == "azar":
			n = NACIONES[randi() % NACIONES.size()]
		out.append({"faccion": n, "dificultad": valor_de(f[2]), "equipo": int(valor_de(f[3]))})
	return out


func comenzar() -> void:
	if mapa == "":
		return
	var riv := rivales()
	if not riv.any(func(r: Dictionary) -> bool: return int(r["equipo"]) != 1):
		Juego.avisar("Debe haber al menos un rival en otro equipo (su equipo es el 1).")
		return
	var cfg = Juego.config
	cfg.escribir("mapa", mapa)
	cfg.escribir("faccion", faccion)
	if not riv.is_empty():
		cfg.escribir("dificultad", riv[0]["dificultad"])
	if not Juego.en_prueba():
		cfg.guardar()
	var pedido := {"t": "partida_rapida", "mapa": mapa, "faccion": faccion, "rivales": riv, "velocidad": valor_de(vel)}
	menu.abrir("cargando", {"pedido": pedido, "origen": "escaramuza", "volver_a": "escaramuza",
			"info": {"mapa": mapa, "faccion": faccion, "rivales": riv}})
