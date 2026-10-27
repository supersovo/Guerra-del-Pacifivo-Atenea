## Menú del juego: el diorama de la pampa girando de fondo, el título y una pantalla a la vez
## encima (portada, escaramuza, campaña, multijugador, repeticiones, archivo, opciones, parte de
## guerra...), como las escenas de salitre/cliente/escenas/.
##
## El menú lleva los mensajes del servidor a la pantalla que los usa (el salón, la sala, la
## espera de la partida); si una pantalla cambia a otra o a la batalla en medio de un lote, lo
## que falta queda para la siguiente.
extends Control

const Tema = preload("res://codigo/ui/tema.gd")
const Terreno = preload("res://codigo/mundo/terreno.gd")
const Ambiente = preload("res://codigo/mundo/ambiente.gd")
const Modelos = preload("res://codigo/mundo/modelos.gd")

const PANTALLAS := {
	"portada": preload("res://codigo/ui/pantallas/portada.gd"),
	"escaramuza": preload("res://codigo/ui/pantallas/escaramuza.gd"),
	"cargando": preload("res://codigo/ui/pantallas/cargando.gd"),
	"campana": preload("res://codigo/ui/pantallas/campana.gd"),
	"repeticiones": preload("res://codigo/ui/pantallas/repeticiones.gd"),
	"archivo": preload("res://codigo/ui/pantallas/archivo.gd"),
	"opciones": preload("res://codigo/ui/pantallas/opciones.gd"),
	"parte": preload("res://codigo/ui/pantallas/parte.gd"),
	"conectar": preload("res://codigo/ui/pantallas/conectar.gd"),
	"salon": preload("res://codigo/ui/pantallas/salon.gd"),
	"sala": preload("res://codigo/ui/pantallas/sala.gd"),
}
const FONDO := "pampa_del_tamarugal"

var pantalla: Control = null
var nombre_pantalla := ""
var recorrido: Node = null
var _fondo: Node3D
var _camara: Camera3D
var _giro := 0.0
var _centro := Vector3.ZERO
var _radio := 13.0
var _velo: ColorRect
var _titulo: Label
var _subtitulo: Label
var _version: Label
var _homenaje: Label
var _t := 0.0


func _ready() -> void:
	theme = Juego.tema
	set_anchors_preset(Control.PRESET_FULL_RECT)
	_armar_fondo()
	_armar_marco()
	var inicial := Juego.pantalla_pedida if Juego.pantalla_pedida != "" else "portada"
	var a := Juego.pantalla_args
	Juego.pantalla_pedida = ""
	Juego.pantalla_args = {}
	if Juego.repeticion != "" and Juego.inicio.is_empty():
		abrir("cargando", {"pedido": {"t": "ver_repeticion", "nombre": Juego.repeticion}, "origen": "repeticion"})
		return
	if Juego.conectar_a != "" and Juego.recorrido == "" and inicial == "portada":
		# --conectar=host:puerto (como en el cliente de Python): directo a ese servidor
		abrir("conectar", {"direccion": Juego.conectar_a, "conectar": str(Juego.config.leer("nombre")).length() >= 3})
		Juego.conectar_a = ""
	else:
		abrir(inicial, a)
	if Juego.prueba_humo or Juego.recorrido != "":
		recorrido = load("res://pruebas/recorrido.gd").new()
		recorrido.menu = self
		add_child(recorrido)


## Abre una pantalla en lugar de la que se ve.
func abrir(nombre: String, a := {}) -> void:
	if pantalla != null:
		pantalla.queue_free()
	var p: Control = PANTALLAS[nombre].new()
	p.menu = self
	p.args = a
	p.name = nombre.capitalize()
	pantalla = p
	nombre_pantalla = nombre
	add_child(p)
	var con_titulo: bool = p.get("titulo") if p.get("titulo") != null else true
	_titulo.visible = con_titulo
	_subtitulo.visible = con_titulo
	_version.visible = con_titulo
	var velo: float = p.get("velo") if p.get("velo") != null else 0.0
	_velo.color = Color(Color8(30, 20, 12), velo)
	_homenaje.visible = nombre == "portada"
	Sonido.musica(p.musica)
	if Juego.prueba_humo or Juego.recorrido != "":
		print("PANTALLA: ", nombre)


func _unhandled_input(ev: InputEvent) -> void:
	if ev is InputEventKey and ev.pressed and not ev.echo and ev.keycode == KEY_ESCAPE and pantalla != null:
		get_viewport().set_input_as_handled()
		pantalla.escape()


func _process(delta: float) -> void:
	_giro += delta * 0.05
	_colocar_camara()
	_t += delta
	# --captura sin prueba ni repetición: una imagen del menú y salir
	if Juego.captura != "" and not Juego.prueba_humo and Juego.repeticion == "" and Juego.recorrido == "":
		if _t > 3.0 and DisplayServer.get_name() != "headless":
			get_viewport().get_texture().get_image().save_png(Juego.captura)
			print("Captura en ", Juego.captura)
			Juego.salir(0)
		return
	_red()


## Los mensajes del servidor para la pantalla que los usa.
func _red() -> void:
	if pantalla == null or not pantalla.usa_red:
		return
	var con = Juego.conexion
	if con.estado == "desconectado":
		return
	var msgs: Array = con.sondear()
	for k in msgs.size():
		var antes := pantalla
		var escenas := Juego.cambios_de_escena
		pantalla.mensaje(msgs[k])
		if pantalla != antes or Juego.cambios_de_escena != escenas:
			# lo que llegó detrás lo atiende la pantalla nueva (o la batalla)
			var resto := msgs.slice(k + 1)
			resto.append_array(con.pendientes)
			con.pendientes = resto
			return
	if con.estado == "error" and pantalla.usa_red and not pantalla.get("atiende_errores"):
		Juego.perdio_conexion("Se perdió la conexión con el servidor: " + con.error)


# ----------------------------------------------------------------------
# Título, versión y velo

func _armar_marco() -> void:
	var f: Dictionary = Juego.fuentes
	_velo = ColorRect.new()
	_velo.set_anchors_preset(Control.PRESET_FULL_RECT)
	_velo.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_velo.color = Color(0, 0, 0, 0)
	add_child(_velo)
	_titulo = _rotulo("Guerra del Pacífico", f["titulo"], 58, Color8(250, 240, 214), 22)
	_subtitulo = _rotulo("Salitre y Pólvora  ·  1879-1884", f["titulo"], 28, Color8(246, 226, 180), 90)
	var cat = Juego.catalogo
	_version = Tema.etiqueta("Salitre y Pólvora %s · cliente 3D (Godot %s)" % [cat.version,
			Engine.get_version_info()["string"].split(" ")[0]], f["cuerpo"], 14, Color8(250, 240, 220))
	_sombra(_version, 1)
	_version.anchor_left = 1.0
	_version.anchor_right = 1.0
	_version.anchor_top = 1.0
	_version.anchor_bottom = 1.0
	_version.offset_left = -700
	_version.offset_right = -10
	_version.offset_top = -24
	_version.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	add_child(_version)
	_homenaje = Tema.etiqueta("Homenaje a los combatientes de Chile, Perú y Bolivia (1879-1884)", f["cursiva"], 14,
			Color8(250, 240, 220))
	_sombra(_homenaje, 1)
	_homenaje.anchor_top = 1.0
	_homenaje.anchor_bottom = 1.0
	_homenaje.offset_left = 10
	_homenaje.offset_top = -24
	add_child(_homenaje)


func _rotulo(t: String, fuente: Font, tam: int, color: Color, y: float) -> Label:
	var l := Tema.etiqueta(t, fuente, tam, color)
	l.anchor_left = 0.0
	l.anchor_right = 1.0
	l.offset_top = y
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.add_theme_color_override("font_shadow_color", Color8(40, 20, 10))
	l.add_theme_constant_override("shadow_offset_x", 3)
	l.add_theme_constant_override("shadow_offset_y", 3)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(l)
	return l


static func _sombra(l: Label, d: int) -> void:
	l.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.85))
	l.add_theme_constant_override("shadow_offset_x", d)
	l.add_theme_constant_override("shadow_offset_y", d)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE


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
	sv.msaa_3d = Viewport.MSAA_2X if Juego.config.leer("calidad") != "baja" else Viewport.MSAA_DISABLED
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
	_colocar_camara()


func _colocar_camara() -> void:
	if _camara == null:
		return
	var incl := deg_to_rad(34.0)
	var dir := Vector3(sin(_giro) * cos(incl), sin(incl), cos(_giro) * cos(incl))
	_camara.look_at_from_position(_centro + dir * _radio, _centro + Vector3(0, 0.5, 0), Vector3.UP)
