## Menú principal: el diorama de fondo, el título y la escaramuza contra la IA.
##
## Al comenzar se lanza el servidor privado (el mismo servidor del juego, en Python),
## se conecta, saluda y pide la partida rápida; con el mensaje «inicio» pasa a la batalla.
extends Control

const Tema = preload("res://codigo/ui/tema.gd")
const Terreno = preload("res://codigo/mundo/terreno.gd")
const Ambiente = preload("res://codigo/mundo/ambiente.gd")
const Modelos = preload("res://codigo/mundo/modelos.gd")

const NACIONES := ["chile", "peru", "bolivia", "argentina"]
const FONDO := "pampa_del_tamarugal"

var mapas: Array = []
var sel_mapa: OptionButton
var sel_nacion: OptionButton
var sel_rival: OptionButton
var sel_dificultad: OptionButton
var sel_velocidad: OptionButton
var txt_nombre: LineEdit
var btn_comenzar: Button
var lbl_estado: Label
var lbl_mapa: Label
var _fondo: Node3D
var _camara: Camera3D
var _giro := 0.0
var _centro := Vector3.ZERO
var _radio := 30.0
var _fase := ""                 # "" | servidor | conectar | saludar | pedir | esperar
var _t := 0.0
var _intentos := 0
var _pedido: Dictionary = {}


func _ready() -> void:
	theme = Juego.tema
	set_anchors_preset(Control.PRESET_FULL_RECT)
	_armar_fondo()
	_armar_panel()
	if Juego.prueba_humo:
		print("PRUEBA_HUMO: menú listo, %d mapas" % mapas.size())
		for i in mapas.size():
			if mapas[i]["id"] == Juego.mapa_prueba:
				sel_mapa.select(i)
		sel_velocidad.select(maxi(0, Juego.catalogo.datos["velocidades"].find("muy_rapida")))
		call_deferred("_comenzar")


# ----------------------------------------------------------------------
# Fondo: el diorama de la pampa, girando despacio

func _armar_fondo() -> void:
	var vista := SubViewportContainer.new()
	vista.set_anchors_preset(Control.PRESET_FULL_RECT)
	vista.stretch = true
	vista.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(vista)
	var sv := SubViewport.new()
	sv.own_world_3d = true
	sv.msaa_3d = Viewport.MSAA_2X
	vista.add_child(sv)
	_fondo = Node3D.new()
	sv.add_child(_fondo)
	var cat = Juego.catalogo
	var ruta := Juego.dir_rts.path_join("mapas").path_join(FONDO + ".json")
	var mapa: Variant = JSON.parse_string(FileAccess.get_file_as_string(ruta))
	if typeof(mapa) != TYPE_DICTIONARY:
		return
	var w := int(mapa["ancho"])
	var h := int(mapa["alto"])
	var terrenos: Dictionary = cat.datos["terrenos"]
	var terreno := PackedByteArray()
	var niveles := PackedByteArray()
	terreno.resize(w * h)
	niveles.resize(w * h)
	for fy in h:
		for fx in w:
			terreno[fy * w + fx] = int(terrenos.get(mapa["terreno"][fy][fx], terrenos["."])["codigo"])
			niveles[fy * w + fx] = clampi(mapa["altura"][fy].unicode_at(fx) - 48, 0, 2)
	var ter := Terreno.new(terreno, niveles, w, h, cat.colores_terreno, mapa.get("llegada") == "tren")
	_fondo.add_child(Ambiente.crear(mapa.get("ambiente", "desierto"), w, h))
	_fondo.add_child(ter.construir())
	var todo := PackedByteArray()
	todo.resize(w * h)
	todo.fill(1)
	ter.actualizar_niebla(todo, todo)
	for r in mapa.get("recursos", []):
		var salitre: bool = r["tipo"] == "salitre"
		var tam := Vector2(2, 1) if salitre else Vector2(3, 3)
		var mi := MeshInstance3D.new()
		mi.mesh = Modelos.salitre(1.0) if salitre else Modelos.pozo(1.0)
		var p := Vector3(float(r["x"]) + tam.x / 2.0, 0, float(r["y"]) + tam.y / 2.0)
		p.y = ter.altura_en(p.x, p.z)
		mi.position = p
		_fondo.add_child(mi)
	# un campamento chileno y una columna en marcha en el centro del cuadro
	var ini: Array = mapa["inicios"][0]
	_centro = Vector3(float(ini[0]) + 6.0, 0, float(ini[1]) + 6.0)
	_centro.y = ter.altura_en(_centro.x, _centro.z)
	var color := cat.color_jugador(0)
	var cg: Dictionary = cat.tipos_por_id["cuartel_general"]
	var mi_cg := MeshInstance3D.new()
	mi_cg.mesh = Modelos.edificio(cg, color, "chile")
	mi_cg.position = Vector3(float(ini[0]) + 2.0, 0, float(ini[1]) + 1.5)
	mi_cg.position.y = ter.altura_en(mi_cg.position.x, mi_cg.position.z)
	_fondo.add_child(mi_cg)
	var base := cat.uniforme_base("chile")
	var k := 0
	for tid in ["infante", "infante", "infante", "infante", "infante", "infante", "granadero", "granadero",
			"canon_campana", "trabajador", "trabajador", "cantinera"]:
		var t: Dictionary = cat.tipos_por_id[tid]
		var u := MeshInstance3D.new()
		u.mesh = Modelos.unidad(t, base, cat.uniforme_propio("chile", t["forma"]), color, "chile")
		var p := _centro + Vector3((k % 4) * 0.7 - 1.0, 0, (k / 4) * 0.8 - 0.4)
		p.y = ter.altura_en(p.x, p.z)
		u.position = p
		u.rotation.y = -PI / 4.0
		_fondo.add_child(u)
		k += 1
	_camara = Camera3D.new()
	_camara.fov = 40.0
	_camara.far = 800.0
	_fondo.add_child(_camara)
	_camara.current = true
	_radio = 13.0
	_colocar_camara()


func _colocar_camara() -> void:
	if _camara == null:
		return
	var incl := deg_to_rad(34.0)
	var dir := Vector3(sin(_giro) * cos(incl), sin(incl), cos(_giro) * cos(incl))
	_camara.look_at_from_position(_centro + dir * _radio, _centro + Vector3(0, 0.5, 0), Vector3.UP)


# ----------------------------------------------------------------------
# Panel

func _armar_panel() -> void:
	var f: Dictionary = Juego.fuentes
	var cat = Juego.catalogo
	var titulo := Tema.etiqueta("Guerra del Pacífico", f["titulo"], 64, Tema.CREMA)
	titulo.position = Vector2(48, 30)
	titulo.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.85))
	titulo.add_theme_constant_override("shadow_offset_x", 3)
	titulo.add_theme_constant_override("shadow_offset_y", 3)
	add_child(titulo)
	var sub := Tema.etiqueta("Salitre y Pólvora · 1879-1884", f["cursiva"], 26, Tema.BRONCE_CLARO)
	sub.position = Vector2(52, 108)
	sub.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.85))
	sub.add_theme_constant_override("shadow_offset_x", 2)
	sub.add_theme_constant_override("shadow_offset_y", 2)
	add_child(sub)

	var panel := PanelContainer.new()
	panel.anchor_left = 1.0
	panel.anchor_right = 1.0
	panel.anchor_top = 0.0
	panel.anchor_bottom = 1.0
	panel.offset_left = -440
	panel.offset_right = -36
	panel.offset_top = 36
	panel.offset_bottom = -36
	panel.add_theme_stylebox_override("panel", Tema.caja(Color(Tema.PERGAMINO, 0.95), Tema.BRONCE, 3, 6, 20))
	add_child(panel)
	var caja := VBoxContainer.new()
	caja.add_theme_constant_override("separation", 8)
	panel.add_child(caja)
	var cab := Tema.etiqueta("Escaramuza", f["titulo"], 34, Tema.TINTA)
	caja.add_child(cab)
	var expl := Tema.etiqueta("Contra la IA, en un servidor privado de este equipo.", f["cursiva"], 16, Tema.TINTA_SUAVE)
	caja.add_child(expl)

	mapas = Juego.mapas_disponibles()
	sel_mapa = _opcion(caja, "Campo de batalla")
	for m in mapas:
		sel_mapa.add_item("%s (%d)" % [m["nombre"], m["jugadores"]])
	sel_mapa.item_selected.connect(func(_i: int) -> void: _mostrar_mapa())
	lbl_mapa = Tema.etiqueta("", f["cursiva"], 15, Tema.TINTA_SUAVE)
	lbl_mapa.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	lbl_mapa.custom_minimum_size = Vector2(360, 0)
	caja.add_child(lbl_mapa)
	sel_nacion = _opcion(caja, "Su nación")
	sel_rival = _opcion(caja, "Nación rival")
	for n in NACIONES:
		sel_nacion.add_item(cat.facciones[n]["nombre"])
		sel_rival.add_item(cat.facciones[n]["nombre"])
	sel_rival.select(1)
	sel_dificultad = _opcion(caja, "Dificultad de la IA")
	var difs: Dictionary = cat.datos["dificultades"]
	for d in difs:
		sel_dificultad.add_item(difs[d])
	sel_dificultad.select(maxi(0, difs.keys().find("normal")))
	sel_velocidad = _opcion(caja, "Velocidad")
	var nombres_vel := {"normal": "Normal", "rapida": "Rápida", "muy_rapida": "Muy rápida"}
	for v in cat.datos["velocidades"]:
		sel_velocidad.add_item(nombres_vel.get(v, v))
	var l := Tema.etiqueta("Su nombre", f["negrita"], 17, Tema.TINTA)
	caja.add_child(l)
	txt_nombre = LineEdit.new()
	txt_nombre.text = Juego.nombre_jugador
	txt_nombre.max_length = 20
	caja.add_child(txt_nombre)
	var hueco := Control.new()
	hueco.size_flags_vertical = Control.SIZE_EXPAND_FILL
	caja.add_child(hueco)
	lbl_estado = Tema.etiqueta("", f["cursiva"], 16, Tema.ROJO)
	lbl_estado.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	lbl_estado.custom_minimum_size = Vector2(360, 0)
	caja.add_child(lbl_estado)
	btn_comenzar = Button.new()
	btn_comenzar.text = "¡A la carga!"
	btn_comenzar.custom_minimum_size = Vector2(0, 48)
	btn_comenzar.add_theme_font_size_override("font_size", 22)
	btn_comenzar.pressed.connect(_comenzar)
	caja.add_child(btn_comenzar)
	var salir := Button.new()
	salir.text = "Salir"
	salir.custom_minimum_size = Vector2(0, 38)
	salir.pressed.connect(func() -> void: Juego.salir(0))
	caja.add_child(salir)
	var ver := Tema.etiqueta("Versión %s · cliente 3D (Godot %s)" % [cat.version, Engine.get_version_info()["string"]],
			f["cuerpo"], 14, Tema.TINTA_SUAVE)
	caja.add_child(ver)
	for i in mapas.size():
		if mapas[i]["id"] == "pampa_del_tamarugal":
			sel_mapa.select(i)
	_mostrar_mapa()


func _opcion(caja: VBoxContainer, texto: String) -> OptionButton:
	caja.add_child(Tema.etiqueta(texto, Juego.fuentes["negrita"], 17, Tema.TINTA))
	var o := OptionButton.new()
	o.fit_to_longest_item = false
	caja.add_child(o)
	return o


func _mostrar_mapa() -> void:
	var i := sel_mapa.selected
	if i >= 0 and i < mapas.size():
		lbl_mapa.text = mapas[i]["descripcion"]


# ----------------------------------------------------------------------
# Comienzo: servidor privado, conexión, saludo y partida rápida

func _comenzar() -> void:
	if _fase != "" or mapas.is_empty():
		return
	var cat = Juego.catalogo
	var nombre := txt_nombre.text.strip_edges()
	Juego.nombre_jugador = nombre if nombre.length() >= 3 else "Comandante"
	var difs: Array = cat.datos["dificultades"].keys()
	_pedido = {"t": "partida_rapida", "mapa": mapas[sel_mapa.selected]["id"],
			"faccion": NACIONES[sel_nacion.selected],
			"rivales": [{"faccion": NACIONES[sel_rival.selected], "dificultad": difs[sel_dificultad.selected], "equipo": 2}],
			"velocidad": cat.datos["velocidades"][sel_velocidad.selected]}
	btn_comenzar.disabled = true
	_estado("Preparando el campo de batalla...", Tema.TINTA)
	if not Juego.servidor.iniciar(Juego.dir_rts):
		_falla(Juego.servidor.error)
		return
	if Juego.prueba_humo:
		print("PRUEBA_HUMO: servidor privado en el puerto %d (pid %d)" % [Juego.servidor.puerto, Juego.servidor.pid])
	_fase = "conectar"
	_t = 0.0
	_intentos = 0


func _estado(texto: String, color: Color) -> void:
	lbl_estado.text = texto
	lbl_estado.add_theme_color_override("font_color", color)


func _falla(motivo: String) -> void:
	_fase = ""
	btn_comenzar.disabled = false
	Juego.conexion.cerrar()
	Juego.servidor.detener()
	_estado(motivo, Tema.ROJO)
	if Juego.prueba_humo:
		print("PRUEBA_HUMO: FALLA: " + motivo)
		Juego.salir(2)


func _process(delta: float) -> void:
	_giro += delta * 0.05
	_colocar_camara()
	if _fase == "":
		return
	_t += delta
	var con = Juego.conexion
	match _fase:
		"conectar":
			if not Juego.servidor.vivo():
				_falla("El servidor del juego se cerró al comenzar. ¿Está instalado Python 3 con el juego? " +
						"(Defina SALITRE_PYTHON con la ruta del intérprete.)")
				return
			if _t >= 0.4:
				_t = 0.0
				_intentos += 1
				if _intentos > 60:
					_falla("No se pudo conectar con el servidor del juego.")
					return
				con.conectar("127.0.0.1", Juego.servidor.puerto)
				_fase = "saludar"
		"saludar":
			con.sondear()
			if con.estado == "error":
				_fase = "conectar"       # todavía no escucha: se vuelve a intentar
				return
			if con.conectado():
				var cat = Juego.catalogo
				con.saludar(Juego.nombre_jugador, cat.huella, cat.version, cat.protocolo)
				_fase = "esperar"
				_t = 0.0
		"esperar":
			for m in con.sondear():
				match m.get("t"):
					"bienvenida":
						Juego.bienvenida = m
						con.enviar(_pedido)
						_estado("Formando las tropas...", Tema.TINTA)
					"error":
						_falla(str(m.get("msg", "El servidor rechazó la partida.")))
						return
					"inicio":
						Juego.inicio = m
						_fase = ""
						Juego.ir_a("res://escenas/batalla.tscn")
						return
			if con.estado == "error":
				_falla("Se cortó la conexión con el servidor: " + con.error)
			elif _t > 30.0:
				_falla("El servidor no respondió a tiempo.")
