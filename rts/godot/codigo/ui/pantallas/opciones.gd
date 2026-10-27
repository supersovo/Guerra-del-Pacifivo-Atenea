## Opciones: pantalla, sonido, cámara, combate y gráficos (salitre/cliente/escenas/opciones.py).
## Se guardan en config_3d.json; el sonido y la pantalla se aplican al instante.
extends "res://codigo/ui/pantallas/pantalla.gd"

const ControlesSonido = preload("res://codigo/ui/controles_sonido.gd")
const Rutas = preload("res://codigo/datos/rutas.gd")
const TAMANOS := [[1280, 720], [1366, 768], [1600, 900], [1920, 1080], [2560, 1440]]
const CALIDADES := [["alta", "Alta"], ["media", "Media"], ["baja", "Baja"]]

var titulo := false
var p := Rect2(W / 2.0 - 510, 112, 1020, 588)
var nombre: LineEdit
var sonido: Control
var lbl_vel: Label


func armar() -> void:
	_armar()


func _armar() -> void:
	for h in lienzo.get_children():
		h.queue_free()
	var cfg = Juego.config
	var x1 := p.position.x + 36
	var x2 := p.position.x + 372
	var x3 := p.position.x + 700
	var y := p.position.y + 92
	panel(p)
	titulo_panel(p, "Opciones")
	texto(Vector2(x1, y), "Nombre", "negrita", 17, Tema.TINTA)
	nombre = campo(Rect2(x1 + 80, y - 6, 210, 32), cfg.leer("nombre"), 20, "su nombre")
	texto(Vector2(x1, y + 44), "Pantalla", "titulo", 22, Tema.TINTA)
	casilla(Rect2(x1, y + 76, 290, 30), "Pantalla completa (Alt+Enter)", cfg.leer("pantalla_completa"),
			func(v: bool) -> void:
				cfg.escribir("pantalla_completa", v)
				Juego.aplicar_pantalla())
	texto(Vector2(x1, y + 120), "Tamaño de ventana", "cuerpo", 17, Tema.TINTA)
	var ventana: Array = cfg.leer("ventana")
	var items: Array = []
	for t in TAMANOS:
		items.append([t, "%d × %d" % [t[0], t[1]]])
	if not ventana in TAMANOS:
		items.insert(0, [ventana, "%d × %d" % [ventana[0], ventana[1]]])
	opciones(Rect2(x1 + 150, y + 116, 140, 30), items, ventana, func(t: Array) -> void:
		cfg.escribir("ventana", t.duplicate())
		Juego.aplicar_pantalla())
	casilla(Rect2(x1, y + 160, 290, 30), "Sincronía vertical", cfg.leer("vsync"), func(v: bool) -> void:
		cfg.escribir("vsync", v)
		Juego.aplicar_pantalla())
	casilla(Rect2(x1, y + 198, 290, 30), "Mostrar cuadros por segundo", cfg.leer("mostrar_fps"),
			func(v: bool) -> void: cfg.escribir("mostrar_fps", v))
	var enc := casilla(Rect2(x1, y + 236, 290, 30), "Encerrar el ratón en la ventana", cfg.leer("encerrar_raton"),
			func(v: bool) -> void: cfg.escribir("encerrar_raton", v))
	enc.tooltip_text = ("Durante la batalla el puntero no sale de la ventana: basta llevarlo al borde para mover " +
			"la cámara. Queda libre en el menú (F10) y al cambiar de programa (Alt+Tab).")
	# sonido: cuatro volúmenes que se aplican al instante
	texto(Vector2(x2, y), "Sonido", "titulo", 22, Tema.TINTA)
	sonido = ControlesSonido.new(292.0)
	sonido.position = Vector2(x2, y + 40)
	lienzo.add_child(sonido)
	var voces := casilla(Rect2(x2, y + 238, 292, 30), "Voces de la tropa", cfg.leer("voces"), func(v: bool) -> void:
		cfg.escribir("voces", v)
		Sonido.voces_activas = v)
	voces.tooltip_text = ("Las unidades hablan al formarse, al elegirlas y al recibir órdenes; sin voces se oyen " +
			"toques de corneta.")
	# cámara, combate y gráficos
	texto(Vector2(x3, y), "Cámara y combate", "titulo", 22, Tema.TINTA)
	lbl_vel = texto(Vector2(x3, y + 40), "", "cuerpo", 16, Tema.TINTA)
	deslizador(Rect2(x3, y + 64, 280, 18), cfg.leer("velocidad_desplazamiento"), 0.4, 2.5, func(v: float) -> void:
		cfg.escribir("velocidad_desplazamiento", snappedf(v, 0.01))
		_rotular_vel())
	_rotular_vel()
	casilla(Rect2(x3, y + 98, 290, 30), "Mover la cámara con el borde", cfg.leer("desplazar_con_borde"),
			func(v: bool) -> void: cfg.escribir("desplazar_con_borde", v))
	casilla(Rect2(x3, y + 136, 290, 30), "Barras de vida siempre visibles", cfg.leer("barras_siempre"),
			func(v: bool) -> void: cfg.escribir("barras_siempre", v))
	var sangre := casilla(Rect2(x3, y + 174, 290, 30), "Sangre en las bajas", cfg.leer("sangre"),
			func(v: bool) -> void: cfg.escribir("sangre", v))
	sangre.tooltip_text = ("Manchas al caer; con artillería, dinamita o minas el cuerpo vuela en pedazos. " +
			"Desactívelo para una batalla sin sangre.")
	texto(Vector2(x3, y + 220), "Calidad gráfica", "cuerpo", 17, Tema.TINTA)
	var cal := opciones(Rect2(x3 + 150, y + 216, 140, 30), CALIDADES, cfg.leer("calidad"),
			func(c: String) -> void: cfg.escribir("calidad", c))
	cal.tooltip_text = ("Alta: sombras del sol finas, bordes suavizados y todo el humo. Media: sombras más " +
			"simples. Baja: sin sombras ni suavizado y menos humo, para equipos sin tarjeta de video. " +
			"Se aplica en la próxima batalla.")
	linea(Vector2(x2 - 18, y + 4), Vector2(x2 - 18, y + 270), Color8(150, 120, 84))
	linea(Vector2(x3 - 18, y + 4), Vector2(x3 - 18, y + 270), Color8(150, 120, 84))
	texto(Vector2(x1, y + 300), "Carpeta de datos (configuración, repeticiones, registros y capturas):", "negrita", 15,
			Tema.TINTA_SUAVE)
	texto(Vector2(x1, y + 322), Rutas.dir_usuario(), "cuerpo", 15, Tema.TINTA_SUAVE)
	parrafo(Rect2(x1, y + 352, p.size.x - 72, 0), "Teclas: flechas o borde para mover la cámara · rueda: acercar · " +
			"Ctrl+rueda: girar · Ctrl+1..9: grupos · F1: trabajador ocioso · Espacio: último aviso · Intro: conversar · " +
			"F10: menú (también con el volumen del sonido) · F12: captura", "cursiva", 15, Tema.TINTA_SUAVE)
	boton(Rect2(p.position.x + 36, p.end.y - 64, 200, 44), "Restablecer", restablecer, "madera")
	boton(Rect2(p.end.x - 256, p.end.y - 64, 220, 44), "Guardar y volver", volver, "principal")


func _rotular_vel() -> void:
	lbl_vel.text = "Velocidad de la cámara: %.1f×" % float(Juego.config.leer("velocidad_desplazamiento"))


func restablecer() -> void:
	var cfg = Juego.config
	cfg.restablecer()
	for clave in ControlesSonido.FILAS:
		Sonido.fijar_volumen(clave[0], float(cfg.leer(clave[0])))
	Sonido.voces_activas = bool(cfg.leer("voces"))
	Juego.aplicar_pantalla()
	_armar()


func volver() -> void:
	var n := nombre.text.strip_edges()
	if n != "":
		Juego.config.escribir("nombre", n)
		if n.length() >= 3:
			Juego.nombre_jugador = n
	if not Juego.en_prueba():
		Juego.config.guardar()
	menu.abrir("portada")
