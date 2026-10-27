## Sala de espera: los jugadores eligen nación, equipo y color; el anfitrión elige el mapa, el
## modo (batalla única o serie de campaña), agrega rivales de la IA y da la orden de iniciar
## el combate (salitre/cliente/escenas/sala.py).
##
## En una serie de campaña los veteranos de cada ejército pasan de una batalla a la siguiente:
## la sala muestra el marcador, las batallas libradas y el escalafón propio.
extends "res://codigo/ui/pantallas/pantalla.gd"

const Mapas = preload("res://codigo/datos/mapas.gd")
const PanelChat = preload("res://codigo/ui/panel_chat.gd")
const ALTO_FILA := 52
const MODOS := [[1, "Batalla única"], [2, "Serie de 2 batallas"], [3, "Serie de 3 batallas"], [4, "Serie de 4 batallas"]]
const COLOR_GRADO := {1: Color8(120, 90, 40), 2: Color8(150, 96, 20), 3: Color8(176, 110, 10)}

var titulo := false
var velo := 0.47
var p_ran := Rect2(24, 14, 836, 478)
var p_mapa := Rect2(872, 14, W - 896, 478)
var p_chat := Rect2(24, 502, 836, 202)
var p_ord := Rect2(872, 502, W - 896, 202)
var mapas := {}
var dificultades: Array = []
var filas: Array = []           # por ranura: {faccion, equipo, color, dificultad, accion}
var forma: Variant = null       # para saber cuándo rehacer los controles
var capa_filas: Control
var capa_textos: Control
var capa_mapa: Control
var lbl_sala: Label
var lbl_anfitrion: Label
var lbl_mapa: Label
var lbl_desc: Label
var lbl_nota: Label
var d_mapa: OptionButton
var d_vel: OptionButton
var d_modo: OptionButton
var b_iniciar: Button
var b_listo: Button
var b_ia: Button
var b_escalafon: Button
var chat: Control
var capa_esc: Control
var tabla_esc: Tree
var lbl_esc_resumen: Label
var lbl_libro: Label
var lbl_libro_nombres: Label
var mapa_previa := ""


func armar() -> void:
	usa_red = true
	var bien: Dictionary = Juego.bienvenida
	for m in bien.get("mapas", []):
		mapas[m["id"]] = m
	var difs: Dictionary = bien.get("dificultades", {"normal": "Normal"})
	for k in difs:
		dificultades.append([k, difs[k]])
	panel(p_ran)
	lbl_sala = texto(p_ran.position + Vector2(20, 12), "", "titulo", 30, Tema.TINTA)
	lbl_anfitrion = texto(Vector2(p_ran.end.x - 20, p_ran.position.y + 20), "", "cursiva", 16, Tema.TINTA_SUAVE, "der")
	var x0 := p_ran.position.x + 16
	var yh := p_ran.position.y + 62
	for par in [["Jugador", 40], ["Nación", 300], ["Equipo", 448], ["Color", 562]]:
		texto(Vector2(x0 + par[1], yh), par[0], "negrita", 15, Tema.TINTA_SUAVE)
	linea(Vector2(x0, yh + 22), Vector2(p_ran.end.x - 16, yh + 22), Color8(120, 90, 60))
	capa_textos = Control.new()
	capa_textos.mouse_filter = Control.MOUSE_FILTER_IGNORE
	lienzo.add_child(capa_textos)
	capa_filas = Control.new()
	capa_filas.mouse_filter = Control.MOUSE_FILTER_IGNORE
	lienzo.add_child(capa_filas)
	b_escalafon = boton(Rect2(p_ran.end.x - 196, 0, 180, 30), "Mi escalafón", abrir_escalafon, "normal",
			"Sus veteranos en esta serie: grado, nombre, unidad, bajas y batallas.")
	b_escalafon.visible = false
	# mapa
	panel(p_mapa)
	lbl_mapa = texto(Vector2(p_mapa.position.x + p_mapa.size.x / 2.0, p_mapa.position.y + 12), "", "titulo", 24,
			Tema.TINTA, "centro")
	capa_mapa = Control.new()
	capa_mapa.mouse_filter = Control.MOUSE_FILTER_IGNORE
	lienzo.add_child(capa_mapa)
	lbl_desc = parrafo(Rect2(p_mapa.position.x + 16, p_mapa.position.y + 258, p_mapa.size.x - 32, 0), "", "cuerpo", 15,
			Tema.TINTA, 4)
	texto(p_mapa.position + Vector2(16, 372), "Velocidad", "negrita", 16, Tema.TINTA)
	texto(p_mapa.position + Vector2(16, 410), "Modo", "negrita", 16, Tema.TINTA)
	lbl_nota = texto(p_mapa.position + Vector2(16, 446), "", "cursiva", 14, Tema.TINTA_SUAVE)
	var items_m: Array = []
	for k in mapas:
		items_m.append([k, "%s (%d)" % [mapas[k]["nombre"], int(mapas[k]["jugadores"])]])
	d_mapa = opciones(Rect2(p_mapa.position.x + 16, p_mapa.position.y + 330, p_mapa.size.x - 32, 30), items_m, null,
			func(v: Variant) -> void: _enviar({"t": "mapa", "mapa": v}))
	var vels: Array = []
	for v in bien.get("velocidades", ["normal"]):
		vels.append([v, NOMBRE_VELOCIDAD.get(v, v)])
	d_vel = opciones(Rect2(p_mapa.position.x + 120, p_mapa.position.y + 368, p_mapa.size.x - 136, 30), vels, "normal",
			func(v: Variant) -> void: _enviar({"t": "mapa", "mapa": _sala().get("mapa"), "velocidad": v}))
	d_modo = opciones(Rect2(p_mapa.position.x + 120, p_mapa.position.y + 406, p_mapa.size.x - 136, 30), MODOS, 1,
			func(v: Variant) -> void: _enviar({"t": "serie", "batallas": v}))
	# conversación
	panel(p_chat)
	texto(p_chat.position + Vector2(16, 10), "Conversación de la sala", "titulo", 22, Tema.TINTA)
	chat = PanelChat.new(Rect2(p_chat.position.x + 16, p_chat.position.y + 45, p_chat.size.x - 32, p_chat.size.y - 54),
			"sala")
	lienzo.add_child(chat)
	# órdenes
	panel(p_ord, "madera")
	b_iniciar = boton(Rect2(p_ord.position.x + 16, p_ord.position.y + 16, p_ord.size.x - 32, 48), "¡Iniciar el combate!",
			func() -> void: _enviar({"t": "iniciar"}), "principal", "", 20)
	b_listo = boton(Rect2(p_ord.position.x + 16, p_ord.position.y + 16, p_ord.size.x - 32, 48), "Estoy listo",
			alternar_listo, "principal", "", 20)
	b_ia = boton(Rect2(p_ord.position.x + 16, p_ord.position.y + 76, p_ord.size.x - 32, 40), "Agregar rival de la IA",
			agregar_ia, "normal", "Ocupa la primera ranura libre con un ejército de la computadora. Después puede " +
			"elegir su nación, equipo y dificultad.")
	boton(Rect2(p_ord.position.x + 16, p_ord.end.y - 54, p_ord.size.x - 32, 40), "Salir de la sala", salir_sala, "madera")
	_armar_escalafon()
	_aplicar(Juego.sala_actual)


# ----------------------------------------------------------------------
func _sala() -> Dictionary:
	var a: Variant = Juego.sala_actual
	return a.get("sala", {}) if a is Dictionary else {}


func _yo() -> int:
	var a: Variant = Juego.sala_actual
	return int(a.get("yo", -1)) if a is Dictionary and a.get("yo") != null else -1


func _anfitrion() -> bool:
	var a: Variant = Juego.sala_actual
	return a is Dictionary and bool(a.get("anfitrion", false))


func _editable(k: int, r: Dictionary) -> bool:
	return k == _yo() or (_anfitrion() and r["tipo"] == "ia")


func _serie() -> Variant:
	return _sala().get("serie")


func _participante(k: int) -> Variant:
	var serie: Variant = _serie()
	if not serie is Dictionary:
		return null
	for p_ in serie.get("participantes", []):
		if int(p_["ranura"]) == k:
			return p_
	return null


func _participa(k: int) -> bool:
	return bool(_sala().get("en_serie", false)) and _participante(k) != null


func _opciones_color(r: Dictionary) -> Array:
	var usados := {}
	for x in _sala().get("ranuras", []):
		if x["tipo"] in ["humano", "ia"]:
			usados[int(x["color"])] = true
	var out: Array = []
	for c in cat.colores_jugador.size():
		if not usados.has(c) or c == int(r["color"]):
			out.append([c, cat.nombre_color(c)])
	return out


func _aplicar(m: Variant) -> void:
	if not m is Dictionary:
		return
	Juego.sala_actual = m
	var sala := _sala()
	var ranuras: Array = sala.get("ranuras", [])
	var nueva := [_anfitrion(), _yo(), bool(sala.get("en_serie", false))]
	for k in ranuras.size():
		nueva.append([ranuras[k]["tipo"], _editable(k, ranuras[k]), _participa(k)])
	if nueva != forma:
		forma = nueva
		_rehacer(ranuras)
	else:
		for k in mini(filas.size(), ranuras.size()):
			var fila: Dictionary = filas[k]
			var r: Dictionary = ranuras[k]
			for clave in ["faccion", "equipo", "dificultad"]:
				if fila.has(clave) and r.has(clave) and not fila[clave].get_popup().visible:
					poner_valor(fila[clave], r[clave] if not r[clave] is float else int(r[clave]))
			if fila.has("color") and not fila["color"].get_popup().visible:
				poner_opciones(fila["color"], _opciones_color(r), int(r["color"]))
	lbl_sala.text = sala.get("nombre", "Sala")
	lbl_anfitrion.text = "Anfitrión: %s" % sala.get("anfitrion", "?")
	if not d_mapa.get_popup().visible:
		poner_valor(d_mapa, sala.get("mapa"))
	if not d_vel.get_popup().visible:
		poner_valor(d_vel, sala.get("velocidad", "normal"))
	if not d_modo.get_popup().visible:
		poner_valor(d_modo, int(sala.get("modo_serie", 1)))
	d_mapa.disabled = not _anfitrion()
	d_vel.disabled = not _anfitrion()
	d_modo.disabled = not _anfitrion() or bool(sala.get("en_serie", false))
	b_iniciar.visible = _anfitrion()
	b_ia.visible = _anfitrion()
	b_listo.visible = not _anfitrion()
	var yo := _yo()
	var mia: Dictionary = ranuras[yo] if yo >= 0 and yo < ranuras.size() else {}
	b_listo.text = "Ya no estoy listo" if mia.get("listo", false) else "Estoy listo"
	b_ia.disabled = not ranuras.any(func(r: Dictionary) -> bool: return r["tipo"] == "abierta")
	_textos(ranuras)
	_mapa(sala)
	_refrescar_escalafon()


func _rehacer(ranuras: Array) -> void:
	for h in capa_filas.get_children():
		h.queue_free()
	filas.clear()
	var x0 := p_ran.position.x + 16
	var y0 := p_ran.position.y + 92
	var n := maxi(2, ranuras.size())
	var naciones: Array = []
	for nac in NACIONES:
		naciones.append([nac, cat.facciones[nac]["nombre"]])
	var equipos: Array = []
	for e in range(1, n + 1):
		equipos.append([e, "Equipo %d" % e])
	for k in ranuras.size():
		var r: Dictionary = ranuras[k]
		var y := y0 + k * ALTO_FILA
		var fila := {}
		if r["tipo"] in ["humano", "ia"]:
			var editable := _editable(k, r)
			var kk := k
			var fac := opciones(Rect2(x0 + 300, y + 8, 140, 30), naciones, r["faccion"],
					func(v: Variant) -> void: ajustar(kk, {"faccion": v}), capa_filas)
			var eq := opciones(Rect2(x0 + 448, y + 8, 106, 30), equipos, int(r["equipo"]),
					func(v: Variant) -> void: ajustar(kk, {"equipo": v}), capa_filas)
			var col := opciones(Rect2(x0 + 562, y + 8, 110, 30), _opciones_color(r), int(r["color"]),
					func(v: Variant) -> void: ajustar(kk, {"color": v}), capa_filas)
			for w in [fac, eq, col]:
				w.disabled = not editable
			if _participa(k):
				fac.disabled = true     # en la serie la nación y el equipo no cambian
				eq.disabled = true
			fila["faccion"] = fac
			fila["equipo"] = eq
			fila["color"] = col
			if r["tipo"] == "ia":
				var dif := opciones(Rect2(x0 + 120, y + 26, 170, 24), dificultades, r.get("dificultad", "normal"),
						func(v: Variant) -> void: ajustar(kk, {"dificultad": v}), capa_filas)
				dif.add_theme_font_size_override("font_size", 13)
				dif.disabled = not _anfitrion()
				fila["dificultad"] = dif
		if _anfitrion() and k != _yo():
			var t: String = {"abierta": "Cerrar", "cerrada": "Abrir", "ia": "Quitar", "humano": "Expulsar"}[r["tipo"]]
			var ayuda := ""
			if _participa(k) and r["tipo"] == "humano":
				t = "A la IA"
				ayuda = "Entrega este ejército, con sus veteranos, a la IA hasta el final de la serie."
			var kk := k
			var b := boton(Rect2(x0 + 690, y + 8, 106, 30), t, func() -> void: _enviar({"t": "quitar", "ranura": kk}),
					"madera", ayuda, 15, capa_filas)
			if _participa(k) and r["tipo"] == "ia":
				b.disabled = true
			fila["accion"] = b
		filas.append(fila)


## Lo que se escribe en cada ranura: nombre, estado, color, bandera y veteranos de la serie.
func _textos(ranuras: Array) -> void:
	for h in capa_textos.get_children():
		h.queue_free()
	var sala := _sala()
	var x0 := p_ran.position.x + 16
	for k in ranuras.size():
		var r: Dictionary = ranuras[k]
		var y := p_ran.position.y + 92 + k * ALTO_FILA
		if k == _yo():
			var fondo := ColorRect.new()
			fondo.color = Color8(226, 206, 160)
			fondo.position = Vector2(x0, y)
			fondo.size = Vector2(p_ran.size.x - 32, ALTO_FILA - 4)
			fondo.mouse_filter = Control.MOUSE_FILTER_IGNORE
			capa_textos.add_child(fondo)
		if r["tipo"] in ["humano", "ia"]:
			var marco_c := ColorRect.new()
			marco_c.color = Color8(40, 28, 18)
			marco_c.position = Vector2(x0 + 6, y + 10)
			marco_c.size = Vector2(26, 26)
			capa_textos.add_child(marco_c)
			var c := ColorRect.new()
			c.color = cat.color_jugador(int(r["color"]))
			c.position = Vector2(x0 + 8, y + 12)
			c.size = Vector2(22, 22)
			capa_textos.add_child(c)
			texto(Vector2(x0 + 40, y + 6), r["nombre"] if r["nombre"] else "?", "negrita", 18, Tema.TINTA, "izq",
					capa_textos)
			var estado := ""
			var col_est := Tema.TINTA_SUAVE
			var fuente_est := "cursiva"
			if r["tipo"] == "humano":
				if r.get("ausente", false):
					estado = "ausente: su lugar lo espera"
					col_est = Tema.ROJO_SELLO
				elif sala.get("anfitrion") == r["nombre"]:
					estado = "anfitrión"
				elif r.get("listo", false):
					estado = "✔ listo"
					col_est = Tema.VERDE
					fuente_est = "negrita"
				else:
					estado = "preparándose..."
					col_est = Tema.ROJO_SELLO
			var ancho := 0.0
			if estado != "":
				var le := texto(Vector2(x0 + 40, y + 28), estado, fuente_est, 14, col_est, "izq", capa_textos)
				ancho = le.get_minimum_size().x
			var part: Variant = _participante(k)
			if part != null:
				if r["tipo"] == "humano":
					texto(Vector2(x0 + 50 + ancho, y + 28), "%d vet. · %d caídos" % [int(part["veteranos"]),
							int(part["caidos"])], "cursiva", 14, Tema.ORO, "izq", capa_textos)
				else:
					texto(Vector2(x0 + 40, y + 28), "%d vet." % int(part["veteranos"]), "cursiva", 14, Tema.ORO, "izq",
							capa_textos)
			bandera(Rect2(x0 + 258, y + 12, 36, 23), r["faccion"], capa_textos)
		elif r["tipo"] == "abierta":
			texto(Vector2(x0 + 40, y + 14), "— lugar libre —", "cursiva", 17, Tema.TINTA_SUAVE, "izq", capa_textos)
		else:
			texto(Vector2(x0 + 40, y + 14), "— cerrada —", "cursiva", 17, Tema.GRIS, "izq", capa_textos)
	var y_serie := p_ran.position.y + 92 + ranuras.size() * ALTO_FILA + 6
	var ayuda := ""
	if int(sala.get("modo_serie", 1)) > 1 or _serie() != null:
		_dibujar_serie(x0, y_serie, p_ran.size.x - 32)
		ayuda = ("Serie de campaña: los veteranos que sobreviven (también los heridos y los que se retiran del campo) " +
				"pasan a la batalla siguiente. La nación y el equipo no cambian durante la serie.")
	else:
		b_escalafon.visible = false
		ayuda = "Los jugadores del mismo equipo son aliados: comparten la visión. El anfitrión inicia cuando todos están listos."
	parrafo(Rect2(x0, p_ran.end.y - 52, p_ran.size.x - 32, 0), ayuda, "cursiva", 15, Tema.TINTA_SUAVE, 2, capa_textos)


## Marcador de la serie de campaña: batallas libradas, victorias y honores por equipo.
func _dibujar_serie(x: float, y: float, ancho: float) -> void:
	var sala := _sala()
	var serie: Variant = _serie()
	b_escalafon.position.y = y - 2
	if not serie is Dictionary:
		texto(Vector2(x, y), "Serie de campaña de %d batallas" % int(sala.get("modo_serie", 2)), "negrita", 18,
				Tema.TINTA, "izq", capa_textos)
		parrafo(Rect2(x, y + 28, ancho, 0), "Comienza con la primera batalla. Cuide a sus veteranos con hospitales, " +
				"camilleros y cantineras: los que sobrevivan llegarán con el cuartel general a la siguiente.", "cuerpo", 15,
				Tema.TINTA, 3, capa_textos)
		return
	var t := ""
	if serie.get("terminada", false):
		var gan: Variant = serie.get("ganador")
		if gan == null:
			t = "Serie de %d batallas terminada: tablas" % int(serie["total"])
		else:
			var quienes: Array = []
			for p_ in serie["participantes"]:
				if int(p_["equipo"]) == int(gan):
					quienes.append(p_["nombre"])
			t = "Serie de %d batallas: ganó el equipo %d (%s)" % [int(serie["total"]), int(gan), ", ".join(quienes)]
	else:
		t = "Serie de campaña: batalla %d de %d" % [int(serie["jugadas"]) + 1, int(serie["total"])]
	texto(Vector2(x, y), t, "negrita", 18, Tema.VERDE if serie.get("terminada", false) else Tema.TINTA, "izq", capa_textos)
	var partes: Array = []
	var marcador: Dictionary = serie.get("marcador", {})
	var eqs: Array = marcador.keys()
	eqs.sort_custom(func(a: Variant, b: Variant) -> bool: return int(a) < int(b))
	for eq in eqs:
		var vh: Array = marcador[eq]
		partes.append("Equipo %s: %d %s, %d honores" % [eq, int(vh[0]), "victoria" if int(vh[0]) == 1 else "victorias",
				int(vh[1])])
	var lp := parrafo(Rect2(x, y + 28, ancho, 0), "   ·   ".join(partes), "cuerpo", 15, Tema.TINTA, 2, capa_textos)
	var hist: Array = []
	var lista_h: Array = serie.get("historial", [])
	for i in lista_h.size():
		var b: Dictionary = lista_h[i]
		hist.append("%d.ª %s: %s" % [i + 1, b["mapa"], "tablas" if b.get("ganador") == null else "equipo %d" % int(b["ganador"])])
	if not hist.is_empty():
		parrafo(Rect2(x, y + 30 + maxf(22.0, lp.get_minimum_size().y), ancho, 0), "Batallas: " + "  ·  ".join(hist),
				"cursiva", 14, Tema.TINTA_SUAVE, 2, capa_textos)


func _mapa(sala: Dictionary) -> void:
	var info: Dictionary = mapas.get(sala.get("mapa"), {})
	lbl_mapa.text = info.get("nombre", sala.get("mapa_nombre", "?"))
	lbl_desc.text = info.get("descripcion", "")
	if not _anfitrion():
		lbl_nota.text = "Solo el anfitrión cambia el mapa y el modo."
	elif sala.get("en_serie", false):
		lbl_nota.text = "El modo se elige de nuevo al terminar la serie."
	else:
		lbl_nota.text = ""
	if sala.get("mapa", "") != mapa_previa:
		mapa_previa = sala.get("mapa", "")
		for h in capa_mapa.get_children():
			h.queue_free()
		var d: Variant = Mapas.buscar(Juego.dir_rts, mapa_previa)
		if d != null:
			previa_mapa(Rect2(p_mapa.position.x + 16, p_mapa.position.y + 50, p_mapa.size.x - 32, 200),
					Mapas.previa(cat, d, 3), capa_mapa)


# -- órdenes al servidor ----------------------------------------------------
func _enviar(msg: Dictionary) -> void:
	if Juego.conexion.conectado():
		Juego.conexion.enviar(msg)


func ajustar(k: int, cambios: Dictionary) -> void:
	var msg := {"t": "ajustar"}
	msg.merge(cambios)
	if k != _yo():
		msg["ranura"] = k
	_enviar(msg)


func agregar_ia() -> void:
	var mias: Array = []
	for r in _sala().get("ranuras", []):
		if r["tipo"] in ["humano", "ia"]:
			mias.append(r["faccion"])
	var fac := "peru"
	for n in NACIONES:
		if not n in mias:
			fac = n
			break
	_enviar({"t": "agregar_ia", "faccion": fac, "dificultad": Juego.config.leer("dificultad")})


func alternar_listo() -> void:
	var ranuras: Array = _sala().get("ranuras", [])
	var yo := _yo()
	var mia: Dictionary = ranuras[yo] if yo >= 0 and yo < ranuras.size() else {}
	_enviar({"t": "listo", "valor": not mia.get("listo", false)})


func salir_sala() -> void:
	_enviar({"t": "salir_sala"})
	_al_salon()


func _al_salon() -> void:
	Juego.en_sala = false
	Juego.sala_actual = null
	menu.abrir("salon")


func escape() -> void:
	if capa_esc.visible:
		capa_esc.visible = false
	elif not chat.con_foco():
		salir_sala()


# -- escalafón propio en la serie -------------------------------------------
func _armar_escalafon() -> void:
	capa_esc = Control.new()
	capa_esc.position = Vector2.ZERO
	capa_esc.size = Vector2(W, H)
	capa_esc.mouse_filter = Control.MOUSE_FILTER_IGNORE
	capa_esc.visible = false
	lienzo.add_child(capa_esc)
	panel(p_ran, "pergamino", capa_esc)
	texto(p_ran.position + Vector2(20, 14), "Mi escalafón en la serie", "titulo", 28, Tema.TINTA, "izq", capa_esc)
	lbl_esc_resumen = texto(Vector2(p_ran.end.x - 20, p_ran.position.y + 26), "", "negrita", 16, Tema.TINTA, "der", capa_esc)
	tabla_esc = tabla(Rect2(p_ran.position.x + 20, p_ran.position.y + 70, p_ran.size.x - 40, 13 * 24 + 30),
			[["Grado", 92, "izq"], ["Veterano", 400, "izq"], ["Unidad", 156, "izq"], ["Bajas", 50, "centro"],
			["Batallas", 62, "centro"]], Callable(), capa_esc)
	var y := tabla_esc.position.y + tabla_esc.size.y + 8
	lbl_libro = texto(Vector2(p_ran.position.x + 20, y), "", "negrita", 15, Tema.ROJO_SELLO, "izq", capa_esc)
	lbl_libro_nombres = parrafo(Rect2(p_ran.position.x + 20, y + 20, p_ran.size.x - 220, 0), "", "cursiva", 14,
			Tema.TINTA_SUAVE, 2, capa_esc)
	boton(Rect2(p_ran.end.x - 176, p_ran.end.y - 58, 156, 40), "Cerrar", func() -> void: capa_esc.visible = false,
			"madera", "", 17, capa_esc)


func _faccion_propia() -> String:
	var ranuras: Array = _sala().get("ranuras", [])
	var yo := _yo()
	return ranuras[yo]["faccion"] if yo >= 0 and yo < ranuras.size() else "chile"


func _refrescar_escalafon() -> void:
	var a: Variant = Juego.sala_actual
	var esc: Variant = a.get("escalafon") if a is Dictionary else null
	b_escalafon.visible = esc != null and (int(_sala().get("modo_serie", 1)) > 1 or _serie() != null)
	if esc == null:
		capa_esc.visible = false
		return
	var fac := _faccion_propia()
	var filas_e: Array = []
	for v in esc:
		var tipo: Dictionary = cat.tipos_por_id.get(v.get("tipo"), {})
		if tipo.is_empty():
			continue
		var g := clampi(int(v.get("grado", 0)), 0, cat.grado_maximo())
		var quien := Juego.nombres.nombre(cat, fac, tipo, g, int(v.get("nombre", 0)))
		filas_e.append([v.get("ficha") if v.get("ficha") else quien, [cat.grado(g)["nombre"], quien if quien != "" else "—",
				cat.nombre(fac, tipo["id"]).split(" (")[0], int(v.get("bajas", 0)), int(v.get("batallas", 0))],
				COLOR_GRADO.get(g)])
	poner_filas(tabla_esc, filas_e, "Todavía no tiene veteranos: se forman en combate.")
	var part: Variant = _participante(_yo())
	lbl_esc_resumen.text = ("%d veteranos  ·  %d caídos  ·  %d honores" % [int(part["veteranos"]), int(part["caidos"]),
			int(part["honores"])]) if part != null else ""
	var libro: Array = a.get("libro", []) if a.get("libro") is Array else []
	lbl_libro.text = ("Libro de los caídos: %d" % libro.size()) if not libro.is_empty() else ""
	var ultimos: Array = []
	for i in range(libro.size() - 1, maxi(-1, libro.size() - 5), -1):
		var v: Dictionary = libro[i]
		var tipo: Dictionary = cat.tipos_por_id.get(v.get("tipo"), {})
		if tipo.is_empty():
			continue
		var quien := Juego.nombres.nombre(cat, fac, tipo, int(v.get("grado", 0)), int(v.get("nombre", 0)), false)
		if quien == "":
			quien = tipo["nombre"]
		ultimos.append("%s (%s)" % [quien, v["etapa"]] if v.get("etapa") else quien)
	lbl_libro_nombres.text = " · ".join(ultimos)


func abrir_escalafon() -> void:
	_refrescar_escalafon()
	capa_esc.visible = true


# ----------------------------------------------------------------------
func mensaje(m: Dictionary) -> void:
	match m.get("t"):
		"sala":
			_aplicar(m)
		"lobby":
			Juego.lobby = m
		"chat":
			Juego.anotar_chat(m)
		"inicio":
			Juego.a_la_batalla(m, "multijugador")
		"expulsado":
			Juego.avisar(str(m.get("msg", "Fue retirado de la sala.")), 8.0)
			_al_salon()
		"error", "aviso":
			Juego.avisar(str(m.get("msg", "Error")), 8.0)
