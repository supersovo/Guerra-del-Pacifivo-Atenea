## Parte de guerra: resultados y estadísticas de la partida (salitre/cliente/escenas/resultados.py).
extends "res://codigo/ui/pantallas/pantalla.gd"

const Repeticiones = preload("res://codigo/datos/repeticiones.gd")
const COLUMNAS := [
	["Formadas", "unidades_creadas"], ["Perdidas", "unidades_perdidas"], ["Abatidos", "enemigos_abatidos"],
	["Obras", "edificios_construidos"], ["Edif. perdidos", "edificios_perdidos"],
	["Edif. destruidos", "edificios_destruidos"], ["Salitre vendido", "salitre_recolectado"], ["Agua", "agua_recolectada"],
]

var r := Rect2(40, 130, W - 80, H - 170)
var fin: Dictionary = {}
var origen := ""
var guardada := ""
var b_rep: Button = null
var lbl_rep: Label = null
var titulo := false


func armar() -> void:
	fin = Juego.fin if Juego.fin is Dictionary else {}
	origen = Juego.origen
	usa_red = origen == "multijugador"
	panel(r)
	texto(Vector2(r.position.x + r.size.x / 2.0, r.position.y + 14), "Parte de guerra", "titulo", 34, Tema.TINTA, "centro")
	var jugadores: Array = Juego.parte.get("jugadores", [])
	var gan: Variant = fin.get("ganador")
	var sub := ""
	if fin.get("abortada", false):
		sub = "La partida fue interrumpida."
	elif gan == null:
		sub = "Ninguno de los bandos logró la victoria."
	else:
		var nombres: Array = []
		for j in jugadores:
			if int(j["equipo"]) == int(gan):
				nombres.append(j["nombre"])
		sub = "Victoria de " + ", ".join(nombres)
	var minutos := float(fin.get("ticks", 0)) / (16.0 * 60.0)
	texto(Vector2(r.position.x + r.size.x / 2.0, r.position.y + 60), "%s  ·  %.1f minutos  ·  %s" % [sub, minutos,
			Juego.parte.get("mapa", "")], "cursiva", 19, Tema.TINTA_SUAVE, "centro")
	var x0 := r.position.x + 30
	var y := r.position.y + 110
	texto(Vector2(x0 + 40, y), "Jugador", "negrita", 15, Tema.TINTA)
	var anchos := (r.size.x - 360) / COLUMNAS.size()
	for k in COLUMNAS.size():
		texto(Vector2(x0 + 300 + k * anchos + anchos / 2.0, y), COLUMNAS[k][0], "negrita", 15, Tema.TINTA, "centro")
	linea(Vector2(x0, y + 24), Vector2(r.end.x - 30, y + 24), Color8(120, 90, 60))
	y += 34
	var elos: Dictionary = fin.get("elo", {})
	for res in fin.get("resultados", []):
		var i := int(res["indice"])
		var j: Dictionary = jugadores[i] if i < jugadores.size() else {"color": 0}
		bandera(Rect2(x0, y, 36, 24), res.get("faccion", ""))
		var cuadro := ColorRect.new()
		cuadro.color = cat.color_jugador(int(j.get("color", 0)))
		cuadro.position = Vector2(x0 + 40, y + 6)
		cuadro.size = Vector2(10, 10)
		lienzo.add_child(cuadro)
		var nombre: String = res.get("nombre", "?")
		if res.get("es_ia", false) and not nombre.begins_with("IA"):
			nombre += "  (IA)"
		texto(Vector2(x0 + 56, y + 2), nombre, "negrita", 17, Tema.TINTA)
		if gan != null:
			var gano: bool = int(res["equipo"]) == int(gan)
			texto(Vector2(x0 + 56, y + 22), "Victoria" if gano else "Derrota", "cursiva", 14,
					Tema.VERDE if gano else Tema.ROJO_SELLO)
		var elo: Variant = elos.get(str(i))
		if elo is Array and elo.size() == 2 and elo[0] != null and elo[1] != null:
			var d := int(elo[1]) - int(elo[0])
			texto(Vector2(x0 + 160, y + 22), "ELO %d (%s%d)" % [int(elo[1]), "+" if d >= 0 else "", d], "cuerpo", 14,
					Tema.TINTA)
		var est: Dictionary = res.get("est", {})
		for k in COLUMNAS.size():
			texto(Vector2(x0 + 300 + k * anchos + anchos / 2.0, y + 8), str(int(est.get(COLUMNAS[k][1], 0))), "cuerpo", 17,
					Tema.TINTA, "centro")
		texto(Vector2(x0 + 300, y + 29), linea_veteranos(res), "cursiva", 14, Tema.ORO)
		y += 48
	if fin.get("serie") is Dictionary:
		_serie(fin["serie"], x0, y + 4, r.size.x - 60)
	if fin.get("repeticion"):
		var t := "Repetición guardada: %s" % fin["repeticion"]
		if origen == "multijugador" and Juego.servidor.pid <= 0:
			t = "Repetición guardada en el servidor: %s" % fin["repeticion"]
		lbl_rep = texto(Vector2(x0, r.end.y - 48), t, "cursiva", 15, Tema.TINTA_SUAVE)
	boton(Rect2(r.end.x - 250, r.end.y - 60, 220, 44), "A la campaña" if origen == "campana" else "Volver", volver,
			"principal")
	# en un servidor de otro equipo la repetición queda allá: se puede pedir una copia
	if origen == "multijugador" and fin.get("repeticion") and Juego.servidor.pid <= 0:
		b_rep = boton(Rect2(r.end.x - 560, r.end.y - 60, 290, 44), "Guardar la repetición aquí", pedir_repeticion,
				"normal", "Descarga del servidor la repetición de esta batalla para verla después en «Repeticiones».")


## Veteranos que siguen en filas (por grado), ascensos y veteranos caídos en la batalla.
func linea_veteranos(res: Dictionary) -> String:
	var maximo: int = cat.grado_maximo()
	var cuenta: Array = []
	cuenta.resize(maximo + 1)
	cuenta.fill(0)
	for v in res.get("veteranos", []):
		cuenta[clampi(int(v.get("grado", 0)), 0, maximo)] += 1
	var partes: Array = []
	for g in range(maximo, 0, -1):
		if cuenta[g]:
			partes.append("%d %s%s" % [cuenta[g], str(cat.grado(g)["nombre"]).to_lower(), "s" if cuenta[g] != 1 else ""])
	var est: Dictionary = res.get("est", {})
	var t := "Veteranos en filas: " + (", ".join(partes) if not partes.is_empty() else "ninguno")
	t += "  ·  ascensos: %d  ·  veteranos caídos: %d" % [int(est.get("ascensos", 0)), int(est.get("veteranos_caidos", 0))]
	return t


## Serie de campaña: marcador por equipo y lo que cada ejército conserva para la siguiente.
func _serie(serie: Dictionary, x: float, y: float, ancho: float) -> void:
	linea(Vector2(x, y), Vector2(x + ancho, y), Color8(120, 90, 60))
	y += 8
	var gan: Variant = serie.get("ganador")
	var t := ""
	var color := Tema.TINTA
	if serie.get("terminada", false):
		if gan == null:
			t = "Serie de %d batallas terminada: tablas" % int(serie["total"])
		else:
			var quienes: Array = []
			for p_ in serie.get("participantes", []):
				if int(p_["equipo"]) == int(gan):
					quienes.append(p_["nombre"])
			t = "Serie de %d batallas terminada: ¡ganó el equipo %d (%s)!" % [int(serie["total"]), int(gan),
					", ".join(quienes)]
		color = Tema.VERDE
	else:
		t = ("Serie de campaña: %d de %d batallas libradas. Los veteranos que siguen en filas llegarán con el " +
				"cuartel general a la siguiente.") % [int(serie["jugadas"]), int(serie["total"])]
	texto(Vector2(x, y), t, "negrita", 17, color)
	y += 24
	var partes: Array = []
	var marcador: Dictionary = serie.get("marcador", {})
	var equipos: Array = marcador.keys()
	equipos.sort_custom(func(a: Variant, b: Variant) -> bool: return int(a) < int(b))
	for eq in equipos:
		var vh: Array = marcador[eq]
		partes.append("Equipo %s: %d %s, %d honores" % [eq, int(vh[0]), "victoria" if int(vh[0]) == 1 else "victorias",
				int(vh[1])])
	texto(Vector2(x, y), "   ·   ".join(partes), "cuerpo", 15, Tema.TINTA)
	y += 22
	for p_ in serie.get("participantes", []):
		var u: Dictionary = p_.get("ultima") if p_.get("ultima") is Dictionary else {}
		texto(Vector2(x, y), ("%s: %d veteranos siguen en filas (%d nuevos), %d caídos en esta batalla, +%d honores  ·  " +
				"en la serie: %d honores, %d caídos") % [p_["nombre"], int(u.get("supervivientes", p_.get("veteranos", 0))),
				int(u.get("nuevos", 0)), int(u.get("caidos", 0)), int(u.get("honores", 0)), int(p_.get("honores", 0)),
				int(p_.get("caidos", 0))], "cursiva", 14, Tema.ORO)
		y += 19


func volver() -> void:
	if origen == "campana":
		menu.abrir("campana", {"resumen": Juego.resumen_campana})
		return
	if origen == "multijugador" and Juego.conexion.conectado():
		Juego.conexion.enviar({"t": "salas"})
		menu.abrir("sala" if Juego.en_sala else "salon")
		return
	menu.abrir("portada")


func escape() -> void:
	volver()


func _unhandled_key_input(ev: InputEvent) -> void:
	if ev.pressed and not ev.echo and (ev.keycode == KEY_ENTER or ev.keycode == KEY_KP_ENTER):
		volver()


func pedir_repeticion() -> void:
	if Juego.conexion.conectado():
		Juego.conexion.enviar({"t": "pedir_repeticion"})
		b_rep.disabled = true


func mensaje(m: Dictionary) -> void:
	match m.get("t"):
		"sala":
			Juego.sala_actual = m
			Juego.en_sala = true
		"lobby":
			Juego.lobby = m
		"chat":
			Juego.anotar_chat(m)
		"repeticion":
			var datos: Variant = m.get("datos")
			var ruta := Repeticiones.guardar_datos(datos if datos is Dictionary else {}, str(m.get("nombre", "")))
			if ruta != "":
				guardada = ruta.get_file().get_basename()
				if lbl_rep != null:
					lbl_rep.text = "Copia guardada en este equipo: " + guardada
				Juego.avisar("Repetición guardada: puede verla en «Repeticiones».", 6.0)
			else:
				Juego.avisar("No se pudo guardar la repetición.")
		"error":
			Juego.avisar(str(m.get("msg", "Error")))
