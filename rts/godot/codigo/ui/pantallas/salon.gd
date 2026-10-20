## Cuartel general (salón del servidor): salas de espera, partidas en curso, jugadores
## conectados, escalafón y conversación general (salitre/cliente/escenas/lobby.py).
extends "res://codigo/ui/pantallas/pantalla.gd"

const PanelChat = preload("res://codigo/ui/panel_chat.gd")
const RESULTADOS := {"victoria": "Victoria", "derrota": "Derrota", "tablas": "Tablas", "abandono": "Abandono"}

var titulo := false
var velo := 0.47
var cab := Rect2(24, 14, W - 48, 62)
var p_salas := Rect2(24, 88, 660, 404)
var p_der := Rect2(696, 88, W - 720, 404)
var p_chat := Rect2(24, 502, W - 48, 202)
var mapas := {}
var tabla_salas: Tree
var tabla_partidas: Tree
var tablas := {}
var botones_pestana := {}
var pestana := "conectados"
var chat: Control
var lbl_info: Label
var lbl_sub: Label
var dialogo: Control = null
var campos_crear := {}
var ultimo_pedido := 0.0


func armar() -> void:
	usa_red = true
	var bien: Dictionary = Juego.bienvenida
	for m in bien.get("mapas", []):
		mapas[m["id"]] = m
	Juego.en_sala = false
	Juego.sala_actual = null
	panel(cab, "madera")
	texto(cab.position + Vector2(20, 10), "Cuartel general · %s" % bien.get("servidor", "Servidor"), "titulo", 28,
			Tema.CREMA, "izq", null, true)
	var u: Variant = bien.get("usuario")
	var sub := ""
	if u is Dictionary:
		sub = "%s  ·  ELO %s  ·  %d victorias, %d derrotas" % [bien.get("nombre", ""), str(u.get("elo")),
				int(u.get("victorias", 0)), int(u.get("derrotas", 0))]
	else:
		sub = "%s (invitado: sus partidas no suman al escalafón)" % bien.get("nombre", "")
	lbl_sub = texto(Vector2(cab.end.x - 190, cab.position.y + 20), sub, "cuerpo", 17, Tema.BRONCE_CLARO, "der")
	boton(Rect2(cab.end.x - 170, cab.position.y + 12, 154, 38), "Desconectar", desconectar, "madera")
	# salas y partidas
	panel(p_salas)
	texto(p_salas.position + Vector2(16, 12), "Salas de espera", "titulo", 24, Tema.TINTA)
	texto(Vector2(p_salas.end.x - 16, p_salas.position.y + 18), "Doble clic para entrar", "cursiva", 15, Tema.TINTA_SUAVE,
			"der")
	tabla_salas = tabla(Rect2(p_salas.position.x + 16, p_salas.position.y + 46, p_salas.size.x - 32, 200),
			[["Sala", 200, "izq"], ["Mapa", 176, "izq"], ["Lugares", 70, "centro"], ["Estado", 174, "izq"]],
			func(_c: Variant) -> void: unirse())
	tabla_salas.item_selected.connect(_info_sala)
	lbl_info = texto(Vector2(p_salas.position.x + 18, p_salas.position.y + 256), "", "cuerpo", 15, Tema.TINTA_SUAVE)
	tabla_partidas = tabla(Rect2(p_salas.position.x + 16, p_salas.position.y + 284, p_salas.size.x - 32, 72),
			[["Partida en curso", 220, "izq"], ["Mapa", 190, "izq"], ["Minutos", 80, "centro"]],
			func(_c: Variant) -> void: observar())
	var bx := p_salas.position.x + 16
	var by := p_salas.end.y - 46
	boton(Rect2(bx, by, 150, 36), "Crear sala", abrir_crear, "principal")
	boton(Rect2(bx + 160, by, 130, 36), "Unirse", unirse)
	boton(Rect2(bx + 300, by, 150, 36), "Observar", observar, "normal", "Mirar una batalla en curso como espectador.")
	boton(Rect2(bx + 460, by, 168, 36), "Actualizar", actualizar_listas, "madera")
	# conectados, escalafón e historial
	panel(p_der)
	var pestanas := [["conectados", "Conectados"], ["escalafon", "Escalafón"], ["historial", "Mi historial"]]
	for i in pestanas.size():
		var clave: String = pestanas[i][0]
		botones_pestana[clave] = boton(Rect2(p_der.position.x + 16 + i * 176, p_der.position.y + 14, 168, 32),
				pestanas[i][1], func() -> void: elegir_pestana(clave))
	var rt := Rect2(p_der.position.x + 16, p_der.position.y + 56, p_der.size.x - 32, p_der.size.y - 72)
	tablas["conectados"] = tabla(rt, [["Jugador", 250, "izq"], ["ELO", 70, "centro"], ["Estado", 160, "izq"]])
	tablas["escalafon"] = tabla(rt, [["#", 30, "der"], ["Comandante", 160, "izq"], ["ELO", 56, "centro"],
			["V", 44, "centro"], ["D", 44, "centro"], ["Abatidos", 80, "centro"], ["Nación", 90, "izq"]])
	tablas["historial"] = tabla(rt, [["Fecha", 110, "izq"], ["Mapa", 150, "izq"], ["Nación", 80, "izq"],
			["Resultado", 90, "izq"], ["ELO", 90, "centro"]])
	poner_filas(tablas["escalafon"], [], "Nadie ha jugado partidas con cuenta todavía.")
	poner_filas(tablas["historial"], [], "Juegue con una cuenta (nombre y clave) para llevar su historial."
			if bien.get("invitado", false) else "Todavía no tiene batallas registradas.")
	elegir_pestana("conectados")
	# conversación
	panel(p_chat)
	texto(p_chat.position + Vector2(16, 10), "Conversación general", "titulo", 22, Tema.TINTA)
	chat = PanelChat.new(Rect2(p_chat.position.x + 16, p_chat.position.y + 45, p_chat.size.x - 32, p_chat.size.y - 54),
			"general")
	lienzo.add_child(chat)
	actualizar_listas()
	if Juego.lobby is Dictionary:
		_aplicar_lobby(Juego.lobby)


func actualizar_listas() -> void:
	if not Juego.conexion.conectado():
		return
	Juego.conexion.enviar({"t": "salas"})
	if pestana in ["escalafon", "historial"]:
		Juego.conexion.enviar({"t": pestana})
	ultimo_pedido = Time.get_ticks_msec() / 1000.0


func elegir_pestana(clave: String) -> void:
	pestana = clave
	for k in tablas:
		tablas[k].visible = k == clave
	for k in botones_pestana:
		var b: Button = botones_pestana[k]
		for e in ["normal", "hover", "pressed"]:
			if k == clave:
				b.add_theme_stylebox_override(e, Tema.caja(Color8(246, 232, 196), Tema.ROJO_SELLO, 2, 3, 4))
			else:
				b.remove_theme_stylebox_override(e)
	if clave in ["escalafon", "historial"] and Juego.conexion.conectado():
		Juego.conexion.enviar({"t": clave})


func _aplicar_lobby(m: Dictionary) -> void:
	Juego.lobby = m
	var filas: Array = []
	for s in m.get("salas", []):
		var total: int = s.get("ranuras", []).size()
		var est := "En combate" if s.get("estado") == "jugando" else ("Completa" if int(s.get("ocupadas", 0)) >= total
				else "Esperando")
		if s.get("en_serie", false):
			var jugadas := int(s.get("serie_jugadas", 0))
			var batallas := int(s.get("serie_total", 0))
			est = ("En combate (%d.ª de %d)" % [jugadas + 1, batallas]) if s.get("estado") == "jugando" \
					else "Serie: %d de %d libradas" % [jugadas, batallas]
		elif int(s.get("modo_serie", 1)) > 1 and s.get("estado") != "jugando":
			est = "%s (serie de %d)" % [est, int(s["modo_serie"])]
		var nombre: String = s["nombre"] + ("  (clave)" if s.get("con_clave", false) else "")
		filas.append([s["id"], [nombre, s.get("mapa_nombre", "?"), "%d/%d" % [int(s.get("ocupadas", 0)), total], est],
				Tema.GRIS if s.get("estado") == "jugando" else null])
	poner_filas(tabla_salas, filas, "No hay salas abiertas: cree la primera.")
	var partidas: Array = []
	for pa in m.get("partidas", []):
		partidas.append([pa["id"], [" vs ".join(pa.get("jugadores", [])), pa.get("mapa", "?"), str(pa.get("minutos", 0))]])
	poner_filas(tabla_partidas, partidas, "Ninguna batalla en curso.")
	var yo: String = Juego.bienvenida.get("nombre", "")
	var con: Array = m.get("conectados", []).duplicate()
	con.sort_custom(func(a: Dictionary, b: Dictionary) -> bool:
		var ea: Variant = a.get("elo")
		var eb: Variant = b.get("elo")
		if (ea == null) != (eb == null):
			return eb == null
		if ea != null and int(ea) != int(eb):
			return int(ea) > int(eb)
		return str(a.get("nombre", "")) < str(b.get("nombre", "")))
	var filas_c: Array = []
	for c in con:
		var est := "en combate" if c.get("en_partida", false) else ("invitado" if c.get("invitado", false) else "en el salón")
		filas_c.append([c["nombre"], [c["nombre"], str(c.get("elo")) if c.get("elo") != null else "—", est],
				Tema.ROJO_SELLO if c.get("nombre") == yo else null])
	poner_filas(tablas["conectados"], filas_c)
	_info_sala()


func _sala(sid: Variant) -> Variant:
	var lob: Variant = Juego.lobby
	if not lob is Dictionary:
		return null
	for s in lob.get("salas", []):
		if s["id"] == sid:
			return s
	return null


func _info_sala() -> void:
	var s: Variant = _sala(clave_tabla(tabla_salas))
	if s == null:
		lbl_info.text = "Batallas en curso (doble clic para observar):"
		return
	var ocup: Array = []
	for r in s.get("ranuras", []):
		if r["tipo"] in ["humano", "ia"]:
			ocup.append(r["nombre"] if r["nombre"] else "?")
	lbl_info.text = "Anfitrión: %s  ·  velocidad %s  ·  en la sala: %s" % [s.get("anfitrion", "?"),
			NOMBRE_VELOCIDAD.get(s.get("velocidad"), "?"), ", ".join(ocup)]


# ----------------------------------------------------------------------
func unirse(clave_sala: Variant = null) -> void:
	var sid: Variant = clave_tabla(tabla_salas)
	if sid == null:
		Juego.avisar("Elija una sala de la lista.")
		return
	var s: Variant = _sala(sid)
	if s == null:
		return
	if s.get("estado") == "jugando":
		Juego.avisar("Esa sala está en combate: puede observar la partida.")
		return
	if s.get("con_clave", false) and clave_sala == null:
		_dialogo_clave(sid)
		return
	var msg := {"t": "unirse", "sala": sid}
	if clave_sala != null and clave_sala != "":
		msg["clave"] = clave_sala
	Juego.conexion.enviar(msg)


func observar() -> void:
	var pid: Variant = clave_tabla(tabla_partidas)
	if pid == null:
		Juego.avisar("Elija una partida en curso.")
		return
	Juego.conexion.enviar({"t": "observar", "partida": pid})


func desconectar() -> void:
	Juego.cerrar_red()
	Juego.servidor.detener()
	menu.abrir("conectar")


func escape() -> void:
	if dialogo != null:
		_cerrar_dialogo()
	elif not chat.con_foco():
		desconectar()


# -- diálogos (modales) ----------------------------------------------------
func _cerrar_dialogo() -> void:
	if dialogo != null:
		dialogo.queue_free()
	dialogo = null


func _abrir_dialogo(r: Rect2, t: String) -> Control:
	_cerrar_dialogo()
	dialogo = Control.new()
	dialogo.set_anchors_preset(Control.PRESET_FULL_RECT)
	dialogo.mouse_filter = Control.MOUSE_FILTER_STOP
	lienzo.add_child(dialogo)
	var fondo := ColorRect.new()
	fondo.color = Color(0, 0, 0, 0.55)
	fondo.position = Vector2(-2000, -2000)
	fondo.size = Vector2(6000, 6000)
	dialogo.add_child(fondo)
	panel(r, "pergamino", dialogo)
	texto(Vector2(r.position.x + r.size.x / 2.0, r.position.y + 16), t, "titulo", 28, Tema.TINTA, "centro", dialogo)
	return dialogo


func abrir_crear() -> void:
	var r := Rect2(W / 2.0 - 260, 150, 520, 380)
	var d := _abrir_dialogo(r, "Nueva sala de espera")
	var cfg = Juego.config
	var x := r.position.x + 170
	var y := r.position.y + 70
	for i in 5:
		texto(Vector2(r.position.x + 30, r.position.y + 76 + i * 48), ["Nombre", "Mapa", "Velocidad", "Su nación", "Clave"][i],
				"negrita", 17, Tema.TINTA, "izq", d)
	var items_m: Array = []
	for k in mapas:
		items_m.append([k, "%s (%d)" % [mapas[k]["nombre"], int(mapas[k]["jugadores"])]])
	var mapa_ini: Variant = cfg.leer("mapa") if mapas.has(cfg.leer("mapa")) else (items_m[0][0] if not items_m.is_empty() else null)
	var vels: Array = []
	for v in Juego.bienvenida.get("velocidades", ["normal"]):
		vels.append([v, NOMBRE_VELOCIDAD.get(v, v)])
	var facs: Array = []
	for n in NACIONES:
		facs.append([n, cat.facciones[n]["nombre"]])
	campos_crear = {
		"nombre": campo(Rect2(x, y, 320, 32), "Sala de %s" % Juego.bienvenida.get("nombre", ""), 40, "", false, Callable(), d),
		"clave": campo(Rect2(x, y + 192, 200, 32), "", 30, "(sin clave)", false, Callable(), d),
		"faccion": opciones(Rect2(x, y + 144, 200, 32), facs, cfg.leer("faccion") if cfg.leer("faccion") in NACIONES
				else "chile", Callable(), d),
		"velocidad": opciones(Rect2(x, y + 96, 200, 32), vels, "normal", Callable(), d),
		"mapa": opciones(Rect2(x, y + 48, 320, 32), items_m, mapa_ini, Callable(), d),
	}
	boton(Rect2(r.end.x - 200, r.end.y - 58, 176, 42), "Crear sala", _crear, "principal", "", 17, d)
	boton(Rect2(r.position.x + 24, r.end.y - 58, 150, 42), "Cancelar", _cerrar_dialogo, "madera", "", 17, d)


func _crear() -> void:
	var c := campos_crear
	var mapa: Variant = valor_de(c["mapa"])
	if mapa == null:
		Juego.avisar("El servidor no tiene mapas.")
		return
	var cfg = Juego.config
	cfg.escribir("mapa", mapa)
	cfg.escribir("faccion", valor_de(c["faccion"]))
	if not Juego.en_prueba():
		cfg.guardar()
	Juego.conexion.enviar({"t": "crear_sala", "nombre": c["nombre"].text.strip_edges(), "mapa": mapa,
			"velocidad": valor_de(c["velocidad"]), "faccion": valor_de(c["faccion"]), "clave": c["clave"].text.strip_edges()})
	_cerrar_dialogo()


func _dialogo_clave(sid: Variant) -> void:
	var r := Rect2(W / 2.0 - 220, 220, 440, 200)
	var d := _abrir_dialogo(r, "Sala con clave")
	texto(r.position + Vector2(30, 52), "Escriba la clave que le dio el anfitrión:", "cuerpo", 16, Tema.TINTA, "izq", d)
	var c := campo(Rect2(r.position.x + 30, r.position.y + 76, r.size.x - 60, 32), "", 30, "", true, Callable(), d)
	var entrar := func() -> void:
		var t := c.text
		_cerrar_dialogo()
		unirse(t)
	c.text_submitted.connect(func(_t: String) -> void: entrar.call())
	c.grab_focus.call_deferred()
	boton(Rect2(r.end.x - 170, r.end.y - 56, 146, 40), "Entrar", entrar, "principal", "", 17, d)
	boton(Rect2(r.position.x + 24, r.end.y - 56, 130, 40), "Cancelar", _cerrar_dialogo, "madera", "", 17, d)


# ----------------------------------------------------------------------
func mensaje(m: Dictionary) -> void:
	match m.get("t"):
		"lobby":
			_aplicar_lobby(m)
		"sala":
			Juego.sala_actual = m
			Juego.en_sala = true
			menu.abrir("sala")
		"inicio":
			Juego.a_la_batalla(m, "multijugador")
		"chat":
			Juego.anotar_chat(m)
		"escalafon":
			var filas: Array = []
			var lista_f: Array = m.get("filas", [])
			for i in lista_f.size():
				var f: Dictionary = lista_f[i]
				var fac: Variant = f.get("faccion_favorita")
				var nfac: String = cat.facciones[fac]["nombre"] if fac != null and cat.facciones.has(fac) else "—"
				filas.append([f["nombre"], [i + 1, f["nombre"], str(f.get("elo", "")), int(f.get("victorias", 0)),
						int(f.get("derrotas", 0)), int(f.get("abatidos", 0)), nfac]])
			poner_filas(tablas["escalafon"], filas, "Nadie ha jugado partidas con cuenta todavía.")
		"historial":
			var filas: Array = []
			for f in m.get("filas", []):
				var d := Time.get_datetime_dict_from_unix_time(int(f.get("inicio", 0)))
				var fecha := "%02d/%02d %02d:%02d" % [d["day"], d["month"], d["hour"], d["minute"]]
				var mapa: String = mapas.get(f.get("mapa"), {}).get("nombre", str(f.get("mapa", "?")))
				var fac: Variant = f.get("faccion")
				var nfac: String = cat.facciones[fac]["nombre"] if fac != null and cat.facciones.has(fac) else "?"
				var ea: Variant = f.get("elo_antes")
				var ed: Variant = f.get("elo_despues")
				var elo := "%d (%+d)" % [int(ed), int(ed) - int(ea)] if ea != null and ed != null else "—"
				var res: String = f.get("resultado", "")
				var col: Variant = Tema.VERDE if res == "victoria" else (Tema.ROJO_SELLO if res == "derrota" else null)
				filas.append([f["id"], [fecha, mapa, nfac, RESULTADOS.get(res, res), elo], col])
			poner_filas(tablas["historial"], filas, "Todavía no tiene batallas registradas.")
		"error", "expulsado", "aviso":
			Juego.avisar(str(m.get("msg", "Error")), 8.0)


func actualizar(_delta: float) -> void:
	if Time.get_ticks_msec() / 1000.0 - ultimo_pedido > 15.0:
		actualizar_listas()
