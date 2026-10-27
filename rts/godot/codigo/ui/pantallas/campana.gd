## Campaña del Salitre: batallas encadenadas contra la IA en las que los veteranos
## sobrevivientes pasan a la siguiente (salitre/cliente/escenas/campana.py).
##
## Muestra las batallas con su relato histórico, el escalafón de veteranos (grado, nombre,
## unidad, bajas y batallas), el libro de los caídos y los honores; desde aquí se marcha a la
## próxima batalla. El estado se guarda en el perfil del jugador.
extends "res://codigo/ui/pantallas/pantalla.gd"

const Campanas = preload("res://codigo/datos/campanas.gd")
const COLOR_GRADO := {1: Color8(120, 90, 40), 2: Color8(150, 96, 20), 3: Color8(176, 110, 10)}

var campana: Campanas.Campana = null
var resumen: Variant = null
var cid := -1
var estado: Variant = null
var nacion := "chile"
var sel := 0
var p_izq := Rect2(24, 140, 470, 556)
var p_der := Rect2(506, 140, 750, 556)
var lista_etapas: ItemList
var tabla_esc: Tree
var b_marchar: Button
var b_nueva: Button
var botones_nacion := {}
var lbl_etapa: Label
var lbl_fecha: Label
var lbl_relato: Label
var titulo_der: Label
var capa_der: Control


func armar() -> void:
	var cid_campana: String = args.get("campana", "salitre")
	campana = Juego.campanas.get(cid_campana)
	resumen = args.get("resumen")
	var u: Array = Juego.perfil.ultima_campana(cid_campana)
	cid = u[0]
	estado = u[1]
	nacion = estado["faccion"] if estado != null else "chile"
	panel(p_izq)
	panel(p_der)
	if campana == null:
		titulo_panel(p_izq, "Campaña")
		texto(p_izq.position + Vector2(24, 80), "No se encontró datos/campanas.json.", "cuerpo", 17, Tema.TINTA)
		boton(Rect2(p_izq.position.x + 22, p_izq.end.y - 64, 150, 44), "Volver", volver, "madera")
		return
	titulo_panel(p_izq, "Batallas")
	lista_etapas = lista(Rect2(p_izq.position.x + 22, p_izq.position.y + 70, p_izq.size.x - 44, 4 * 30 + 8), [],
			elegir_etapa)
	var x := p_izq.position.x + 24
	var y := lista_etapas.position.y + lista_etapas.size.y + 14
	lbl_etapa = texto(Vector2(x, y), "", "titulo", 22, Tema.TINTA)
	lbl_fecha = texto(Vector2(x, y + 30), "", "cursiva", 16, Tema.TINTA_SUAVE)
	lbl_relato = parrafo(Rect2(x, y + 56, p_izq.size.x - 48, 0), "", "cuerpo", 15, Tema.TINTA, 9)
	titulo_der = titulo_panel(p_der, campana.nombre)
	tabla_esc = tabla(Rect2(p_der.position.x + 20, p_der.position.y + 104, p_der.size.x - 40, 9 * 24 + 30),
			[["Grado", 92, "izq"], ["Veterano", 340, "izq"], ["Unidad", 156, "izq"], ["Bajas", 46, "centro"],
			["Batallas", 58, "centro"]])
	capa_der = Control.new()
	capa_der.mouse_filter = Control.MOUSE_FILTER_IGNORE
	lienzo.add_child(capa_der)
	boton(Rect2(p_izq.position.x + 22, p_izq.end.y - 64, 150, 44), "Volver", volver, "madera")
	b_marchar = boton(Rect2(p_izq.end.x - 262, p_izq.end.y - 64, 240, 44), "¡A la batalla!", marchar, "principal", "", 20)
	b_nueva = boton(Rect2(p_der.end.x - 262, p_der.end.y - 64, 240, 44), "Nueva campaña", nueva, "normal",
			"Empieza de nuevo con la nación elegida (la campaña actual se pierde).")
	for i in campana.naciones.size():
		var n: String = campana.naciones[i]
		var b := boton(Rect2(p_der.position.x + 20 + i * 150, p_der.end.y - 120, 140, 44), cat.facciones[n]["nombre"],
				func() -> void: elegir_nacion(n), "normal", "", 16)
		b.icon = Banderas.textura(n, 46, 29)
		b.alignment = HORIZONTAL_ALIGNMENT_LEFT
		botones_nacion[n] = b
	_refrescar()


func _refrescar() -> void:
	var etapa_actual: int = int(estado["etapa"]) if estado != null else 0
	var items: Array = []
	for e in campana.etapas:
		var marca := ""
		if estado != null and e.indice < etapa_actual:
			marca = "ganada"
		elif estado != null and not estado.get("terminada", false) and e.indice == etapa_actual:
			marca = "próxima"
		elif estado == null and e.indice == 0:
			marca = "primera"
		items.append([e.indice, "%d. %s" % [e.indice + 1, e.nombre] + (("  — " + marca) if marca != "" else "")])
	poner_items(lista_etapas, items)
	sel = mini(etapa_actual, campana.etapas.size() - 1)
	elegir_en_lista(lista_etapas, sel)
	elegir_etapa(sel)
	var filas: Array = []
	if estado != null:
		var maximo: int = cat.grado_maximo()
		for v in estado["escalafon"]:
			var tipo: Dictionary = cat.tipos_por_id.get(v["tipo"], {})
			if tipo.is_empty():
				continue
			var g := clampi(int(v["grado"]), 0, maximo)
			var quien: String = Juego.nombres.nombre(cat, estado["faccion"], tipo, g, int(v["nombre"]))
			var unidad: String = cat.nombre(estado["faccion"], tipo["id"]).split(" (")[0]
			filas.append([v["ficha"], [cat.grado(g)["nombre"], quien if quien != "" else "—", unidad, v["bajas"],
					v["batallas"]], COLOR_GRADO.get(g)])
	poner_filas(tabla_esc, filas, "Todavía no hay veteranos: se forman en combate.")
	tabla_esc.visible = estado != null
	var en_curso: bool = estado != null and not estado.get("terminada", false)
	b_marchar.text = "¡A la batalla!" if en_curso else "Comenzar la campaña"
	b_nueva.visible = en_curso
	for n in botones_nacion:
		botones_nacion[n].visible = not en_curso
	_marcar_nacion()
	_dibujar_derecha()


func _marcar_nacion() -> void:
	for k in botones_nacion:
		var b: Button = botones_nacion[k]
		for e in ["normal", "hover", "pressed"]:
			if k == nacion:
				b.add_theme_stylebox_override(e, Tema.caja(Color8(246, 232, 196), Tema.ROJO_SELLO, 3, 3, 6))
			else:
				b.remove_theme_stylebox_override(e)


## Lo que va en el panel derecho fuera de la tabla: ejército, honores, caídos y el parte.
func _dibujar_derecha() -> void:
	for h in capa_der.get_children():
		h.queue_free()
	var x := p_der.position.x + 20
	var y := p_der.position.y + 66
	if estado == null:
		parrafo(Rect2(x, y, p_der.size.x - 40, 0), campana.descripcion, "cuerpo", 16, Tema.TINTA, 6, capa_der)
		texto(Vector2(x, p_der.end.y - 150), "Elija su nación:", "negrita", 17, Tema.TINTA, "izq", capa_der)
		return
	var fac: String = estado["faccion"]
	bandera(Rect2(x, y, 48, 30), fac, capa_der)
	var txt := "%s  ·  honores: %d" % [cat.facciones[fac]["ejercito"], int(estado["honores"])]
	if estado.get("terminada", false):
		txt += "  ·  " + str(estado.get("medalla", ""))
	texto(Vector2(x + 58, y + 4), txt, "negrita", 18, Tema.TINTA, "izq", capa_der)
	var yy := tabla_esc.position.y + tabla_esc.size.y + 10
	var caidos: Array = estado["caidos"]
	texto(Vector2(x, yy), "Libro de los caídos: %d" % caidos.size(), "negrita", 16, Tema.ROJO_SELLO, "izq", capa_der)
	var ultimos: Array = []
	for i in range(caidos.size() - 1, maxi(-1, caidos.size() - 5), -1):
		var v: Dictionary = caidos[i]
		var tipo: Dictionary = cat.tipos_por_id.get(v["tipo"], {})
		if not tipo.is_empty():
			ultimos.append("%s (%s)" % [Juego.nombres.nombre(cat, fac, tipo, int(v["grado"]), int(v["nombre"]), false),
					v.get("etapa", "")])
	if not ultimos.is_empty():
		parrafo(Rect2(x, yy + 22, p_der.size.x - 40, 0), " · ".join(ultimos), "cursiva", 14, Tema.TINTA_SUAVE, 2, capa_der)
	# parte de la última batalla, junto al botón de abajo
	var ancho := p_der.size.x - 300 if b_nueva.visible else p_der.size.x - 40
	var y_parte := p_der.end.y - 64
	if resumen != null:
		var r: Dictionary = resumen
		var t := ""
		if r["victoria"]:
			t = "Victoria en %s: %d veteranos siguen en filas (%d nuevos), %d caídos, +%d honores." % [r["nombre"],
					int(r["supervivientes"]), int(r["nuevos"]), int(r["caidos"]), int(r["honores"])]
		else:
			t = "Derrota en %s: la batalla se puede repetir con el mismo escalafón." % r["nombre"]
		if estado.get("terminada", false):
			t += " La campaña terminó: elija una nación para comenzar otra."
		parrafo(Rect2(x, y_parte, ancho, 0), t, "negrita", 15, Tema.VERDE if r["victoria"] else Tema.ROJO_SELLO, 3,
				capa_der).name = "Parte"
	elif estado.get("terminada", false):
		parrafo(Rect2(x, y_parte, ancho, 0), "La campaña terminó. Elija una nación para comenzar otra.", "negrita", 15,
				Tema.TINTA, 3, capa_der)


func elegir_etapa(i: int) -> void:
	sel = i
	var e: Campanas.Etapa = campana.etapas[i]
	lbl_etapa.text = e.nombre
	var fac: String = estado["faccion"] if estado != null else nacion
	lbl_fecha.text = "%s  ·  contra %s" % [e.fecha, cat.facciones[e.rival(fac)]["nombre"]]
	lbl_relato.text = e.relato


func elegir_nacion(n: String) -> void:
	nacion = n
	_marcar_nacion()
	elegir_etapa(sel)


func nueva() -> void:
	if cid >= 0:
		Juego.perfil.borrar_campana(cid)
	cid = -1
	estado = null
	resumen = null
	_refrescar()


## Comienza la próxima batalla: el escalafón entero baja del tren con el cuartel general.
func marchar() -> void:
	if campana == null:
		return
	if estado == null or estado.get("terminada", false):
		estado = Campanas.nuevo_estado(campana, nacion)
		cid = Juego.perfil.crear_campana(estado)
	var etapa: Campanas.Etapa = campana.etapas[int(estado["etapa"])]
	var riv := [{"faccion": etapa.rival(estado["faccion"]), "dificultad": etapa.dificultad, "equipo": 2,
			"veteranos": Campanas.veteranos_rival(cat, campana, estado, etapa)}]
	var pedido := {"t": "partida_rapida", "mapa": etapa.mapa, "faccion": estado["faccion"], "rivales": riv,
			"velocidad": "normal", "veteranos": estado["escalafon"]}
	menu.abrir("cargando", {"pedido": pedido, "origen": "campana", "volver_a": "campana",
			"info": {"mapa": etapa.mapa, "faccion": estado["faccion"], "rivales": riv, "campana": campana.id,
					"campana_id": cid}})
