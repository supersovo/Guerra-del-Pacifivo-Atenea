## Juego (autocarga): lo que dura toda la sesión, de una pantalla a otra (como App en el
## cliente de Python).
##
## Catálogo, carpetas del juego, fuentes y tema; la configuración y el perfil del jugador; la
## conexión con el servidor y lo que se sabe del salón y de la sala entre una pantalla y otra;
## el servidor privado o abierto de este equipo; la batalla en curso, su origen y su parte de
## guerra; y los avisos que se ven en cualquier pantalla.
extends Node

const Catalogo = preload("res://codigo/datos/catalogo.gd")
const Conexion = preload("res://codigo/red/conexion.gd")
const ServidorLocal = preload("res://codigo/red/servidor_local.gd")
const Tema = preload("res://codigo/ui/tema.gd")
const Config = preload("res://codigo/datos/config.gd")
const Perfil = preload("res://codigo/datos/perfil.gd")
const Nombres = preload("res://codigo/datos/nombres.gd")
const Campanas = preload("res://codigo/datos/campanas.gd")
const Rutas = preload("res://codigo/datos/rutas.gd")

const MENU := "res://escenas/menu.tscn"
const BATALLA := "res://escenas/batalla.tscn"
const CLASICA := "GuerraDelPacificoClasico"   # el ejecutable del cliente de pygame, en una instalación

var catalogo := Catalogo.new()
var conexion := Conexion.new()
var servidor := ServidorLocal.new()
var config := Config.new()
var perfil := Perfil.new()
var nombres := Nombres.new()
var campanas: Dictionary = {}
var dir_rts := ""
var dir_recursos := ""
var dir_datos := ""
var fuentes := {}
var tema: Theme
var nombre_jugador := "Comandante"

# la red entre una pantalla y otra
var bienvenida: Dictionary = {}
var lobby: Variant = null           # último estado del salón (salas, conectados, partidas)
var sala_actual: Variant = null     # última sala recibida
var en_sala := false
var chat_salon: Array = []          # [de, texto, canal], conservado entre pantallas
var ips_publicas := ""              # con un servidor abierto en este equipo: dónde conectarse

# la batalla en curso
var inicio: Dictionary = {}         # mensaje «inicio»
var origen := "escaramuza"          # escaramuza | campana | repeticion | multijugador
var info: Dictionary = {}           # lo que el menú sabe de la batalla (rivales, campaña...)
var fin: Variant = null             # mensaje «fin» de la última batalla
var parte: Dictionary = {}          # lo que el parte de guerra necesita del estado (jugadores, mapa)
var resumen_campana: Variant = null # lo que la última batalla dejó en la campaña
var pantalla_pedida := ""           # la pantalla del menú al volver de la batalla
var pantalla_args: Dictionary = {}

# pruebas y argumentos
var prueba_humo := false            # recorrido automático de punta a punta (pruebas e integración continua)
var recorrido := ""                 # --recorrido=campana|multijugador|pantallas: otros recorridos de prueba
var mapa_prueba := "pampa_del_tamarugal"
var repeticion := ""                # --repeticion=nombre: ver esa repetición al abrir el juego
var captura := ""                   # --captura=ruta.png: guardar una imagen (prueba o repetición)
var captura_en := 0.0               # --captura-en=segundos: momento de la repetición que se captura
var conectar_a := ""                # --conectar=host:puerto: abrir directamente esa conexión
var capturas := ""                  # --capturas=carpeta: imágenes de los recorridos de prueba

var cambios_de_escena := 0         # cuenta los cambios pedidos (el menú deja de repartir mensajes)

var _capa: CanvasLayer
var _aviso: PanelContainer
var _aviso_texto: Label
var _aviso_hasta := 0.0
var _fps: Label


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	dir_rts = _buscar_dir_rts()
	dir_recursos = dir_rts.path_join("recursos")
	dir_datos = dir_rts.path_join("datos")
	catalogo.cargar()
	_cargar_fuentes()
	tema = Tema.crear(fuentes)
	config.cargar()
	perfil.cargar()
	nombres.cargar(dir_datos)
	campanas = Campanas.cargar(dir_datos)
	Sonido.configurar(config, dir_recursos)
	var nombre: String = config.leer("nombre")
	if nombre.length() >= 3:
		nombre_jugador = nombre
	var args := OS.get_cmdline_user_args()
	prueba_humo = "--prueba-humo" in args
	for a in args:
		if a.begins_with("--mapa="):
			mapa_prueba = a.trim_prefix("--mapa=")
		elif a.begins_with("--repeticion="):
			repeticion = a.trim_prefix("--repeticion=")
		elif a.begins_with("--captura="):
			captura = a.trim_prefix("--captura=")
		elif a.begins_with("--captura-en="):
			captura_en = float(a.trim_prefix("--captura-en="))
		elif a.begins_with("--recorrido="):
			recorrido = a.trim_prefix("--recorrido=")
		elif a.begins_with("--conectar="):
			conectar_a = a.trim_prefix("--conectar=")
		elif a.begins_with("--capturas="):
			capturas = a.trim_prefix("--capturas=")
			DirAccess.make_dir_recursive_absolute(capturas)
		elif a.begins_with("--nombre="):
			nombre_jugador = a.trim_prefix("--nombre=")
			config.escribir("nombre", nombre_jugador)
	get_tree().set_auto_accept_quit(false)
	_armar_capa()
	if not en_prueba():
		aplicar_pantalla()


## ¿Corre un recorrido automático? (sin ventana que acomodar ni configuración que guardar)
func en_prueba() -> bool:
	return prueba_humo or recorrido != "" or repeticion != "" or DisplayServer.get_name() == "headless"


func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_CLOSE_REQUEST:
		salir(0)
	elif what == NOTIFICATION_PREDELETE:
		terminar()


func terminar() -> void:
	if conexion.conectado():
		conexion.enviar({"t": "abandonar"})
	conexion.cerrar()
	servidor.detener()
	if not en_prueba():
		config.guardar()


func salir(codigo := 0) -> void:
	terminar()
	# el mezclador suelta la música en su propio hilo: se le da un momento antes de cerrar
	Sonido.callar()
	await get_tree().create_timer(0.15, true, false, true).timeout
	get_tree().quit(codigo)


func ir_a(escena: String) -> void:
	cambios_de_escena += 1
	get_tree().call_deferred("change_scene_to_file", escena)


## Vuelve al menú y abre esa pantalla (la portada, la campaña, el parte de guerra, la sala...).
func ir_al_menu(pantalla := "portada", args := {}) -> void:
	pantalla_pedida = pantalla
	pantalla_args = args
	ir_a(MENU)


## La batalla que empieza (mensaje «inicio»), con su origen y lo que el menú sabe de ella.
func a_la_batalla(m: Dictionary, desde: String, datos := {}) -> void:
	inicio = m
	origen = desde
	info = datos
	fin = null
	ir_a(BATALLA)


# -- red -------------------------------------------------------------------------
func cerrar_red() -> void:
	conexion.cerrar()
	bienvenida = {}
	lobby = null
	sala_actual = null
	en_sala = false
	chat_salon = []


func perdio_conexion(motivo: String) -> void:
	cerrar_red()
	servidor.detener()
	avisar(motivo if motivo != "" else "Se perdió la conexión con el servidor.", 8.0)
	ir_al_menu("portada")


func anotar_chat(m: Dictionary) -> void:
	chat_salon.append([str(m.get("de", "?")), str(m.get("texto", "")), str(m.get("canal", "general"))])
	if chat_salon.size() > 80:
		chat_salon = chat_salon.slice(chat_salon.size() - 80)


# -- avisos para cualquier pantalla ------------------------------------------------
func _armar_capa() -> void:
	_capa = CanvasLayer.new()
	_capa.layer = 100
	add_child(_capa)
	_aviso = PanelContainer.new()
	_aviso.add_theme_stylebox_override("panel", Tema.caja(Color(Color8(40, 16, 10), 0.93), Tema.BRONCE, 1, 4, 10))
	_aviso.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_aviso.visible = false
	_capa.add_child(_aviso)
	_aviso_texto = Tema.etiqueta("", fuentes["negrita"], 18, Color8(250, 236, 210))
	_aviso_texto.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_aviso_texto.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_aviso.add_child(_aviso_texto)
	_fps = Tema.etiqueta("", fuentes["cuerpo"], 14, Color8(255, 255, 0))
	_fps.position = Vector2(6, 4)
	_fps.add_theme_color_override("font_shadow_color", Color.BLACK)
	_fps.add_theme_constant_override("shadow_offset_x", 1)
	_fps.add_theme_constant_override("shadow_offset_y", 1)
	_capa.add_child(_fps)


## Aviso al pie de la pantalla, en cualquier pantalla (también en la batalla).
func avisar(texto: String, segundos := 5.0) -> void:
	print("AVISO: ", texto)
	_aviso_texto.text = texto
	var ancho := minf(_aviso_texto.get_theme_font("font").get_string_size(texto, HORIZONTAL_ALIGNMENT_LEFT, -1,
			18).x + 8.0, get_viewport().get_visible_rect().size.x - 80.0)
	_aviso_texto.custom_minimum_size = Vector2(ancho, 0)
	_aviso.reset_size()
	_aviso.visible = true
	_aviso_hasta = Time.get_ticks_msec() / 1000.0 + segundos
	_colocar_aviso()


func ultimo_aviso() -> String:
	return _aviso_texto.text if _aviso.visible else ""


func _colocar_aviso() -> void:
	var vista := get_viewport().get_visible_rect().size
	_aviso.reset_size()
	_aviso.position = Vector2((vista.x - _aviso.size.x) / 2.0, vista.y - 70.0 - maxf(0.0, _aviso.size.y - 40.0))


func _process(_delta: float) -> void:
	if _aviso.visible:
		if Time.get_ticks_msec() / 1000.0 > _aviso_hasta:
			_aviso.visible = false
		else:
			_colocar_aviso()
	_fps.visible = bool(config.leer("mostrar_fps"))
	if _fps.visible:
		_fps.text = "%d FPS" % Engine.get_frames_per_second()


func _input(ev: InputEvent) -> void:
	if ev is InputEventKey and ev.pressed and not ev.echo:
		if ev.keycode == KEY_F12:
			capturar()
			get_viewport().set_input_as_handled()
		elif ev.keycode == KEY_ENTER and ev.alt_pressed:
			config.escribir("pantalla_completa", not config.leer("pantalla_completa"))
			aplicar_pantalla()
			get_viewport().set_input_as_handled()


## Imagen de un recorrido de prueba (con --capturas y una pantalla de verdad).
func foto(nombre: String) -> void:
	if capturas != "" and DisplayServer.get_name() != "headless":
		await RenderingServer.frame_post_draw
		get_viewport().get_texture().get_image().save_png(capturas.path_join(nombre + ".png"))


## F12: una imagen de la pantalla en la carpeta de capturas.
func capturar() -> void:
	var ruta := Rutas.dir_capturas().path_join(Time.get_datetime_string_from_system().replace(":", "")
			.replace("-", "").replace("T", "-") + ".png")
	ruta = ruta.get_base_dir().path_join("captura-" + ruta.get_file())
	if get_viewport().get_texture().get_image().save_png(ruta) == OK:
		avisar("Captura guardada en " + ruta)


# -- pantalla ------------------------------------------------------------------------
## Pantalla completa, tamaño de la ventana y sincronía vertical según la configuración.
func aplicar_pantalla() -> void:
	if DisplayServer.get_name() == "headless":
		return
	if config.leer("pantalla_completa"):
		DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_FULLSCREEN)
	else:
		if DisplayServer.window_get_mode() == DisplayServer.WINDOW_MODE_FULLSCREEN:
			DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED)
		var v: Array = config.leer("ventana")
		var tam := Vector2i(int(v[0]), int(v[1]))
		if DisplayServer.window_get_size() != tam:
			DisplayServer.window_set_size(tam)
			var pantalla := DisplayServer.screen_get_usable_rect()
			DisplayServer.window_set_position(pantalla.position + (pantalla.size - tam) / 2)
	DisplayServer.window_set_vsync_mode(DisplayServer.VSYNC_ENABLED if config.leer("vsync")
			else DisplayServer.VSYNC_DISABLED)


## La carpeta rts/ del juego (datos, mapas, recursos y el paquete salitre de Python).
func _buscar_dir_rts() -> String:
	var propio := OS.get_environment("SALITRE_RTS")
	if propio != "":
		return propio
	if not OS.has_feature("template"):
		# desde las fuentes: este proyecto vive en rts/godot/
		return ProjectSettings.globalize_path("res://").rstrip("/").get_base_dir()
	# instalado: los datos del ejecutable de PyInstaller que viaja con el cliente 3D
	return Rutas.dir_juego_instalado(OS.get_executable_path().get_base_dir())


# -- la versión clásica ----------------------------------------------------------------
## ¿Se puede abrir la versión clásica (el cliente de pygame)? Instalado va junto a este
## ejecutable; desde las fuentes se abre con Python.
func hay_version_clasica() -> bool:
	return not OS.has_feature("template") or _ejecutable_clasico() != ""


func _ejecutable_clasico() -> String:
	return Rutas.ejecutable_hermano(CLASICA, OS.get_executable_path().get_base_dir())


## Abre la versión clásica y cierra este cliente; un aviso si no se pudo.
func abrir_version_clasica() -> void:
	var pid := -1
	if OS.has_feature("template"):
		var exe := _ejecutable_clasico()
		if exe != "":
			pid = OS.create_process(exe, PackedStringArray())
	else:
		OS.set_environment("PYTHONPATH", dir_rts)
		for candidato in ServidorLocal.pythons():
			var args := PackedStringArray(candidato.slice(1))
			args.append_array(["-m", "salitre"])
			pid = OS.create_process(candidato[0], args)
			if pid > 0:
				break
	if pid <= 0:
		avisar("No se pudo abrir la versión clásica del juego.")
		return
	salir(0)


func _cargar_fuentes() -> void:
	var archivos := {"titulo": "IMFellEnglishSC.ttf", "cuerpo": "AlegreyaSans-Regular.ttf",
			"negrita": "AlegreyaSans-Bold.ttf", "cursiva": "AlegreyaSans-Italic.ttf"}
	for clave in archivos:
		var f := FontFile.new()
		if f.load_dynamic_font(dir_recursos.path_join("fuentes").path_join(archivos[clave])) == OK:
			fuentes[clave] = f
		else:
			fuentes[clave] = ThemeDB.fallback_font
