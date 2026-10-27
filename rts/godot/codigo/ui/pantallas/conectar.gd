## Multijugador: conectarse a un servidor (red local, Internet) o crear uno
## (salitre/cliente/escenas/conectar.py).
##
## - «Buscar en la red local»: encuentra los servidores de la misma red (UDP).
## - «Crear servidor en este equipo»: arranca un servidor abierto a la red; los compañeros se
##   conectan con la dirección IP que se muestra (o por una VPN como ZeroTier, Tailscale o
##   Radmin si están en casas distintas).
extends "res://codigo/ui/pantallas/pantalla.gd"

const BusquedaLAN = preload("res://codigo/red/busqueda_lan.gd")
const PUERTO := 47800

var p := Rect2(W / 2.0 - 420, 140, 840, 540)
var nombre: LineEdit
var clave: LineEdit
var registrar: CheckBox
var direccion: LineEdit
var lista_srv: ItemList
var lbl_buscando: Label
var lbl_conectando: Label
var busqueda := BusquedaLAN.new()
var encontrados: Array = []
var recientes: Array = []
var estado: Variant = null      # [fase, nombre, clave, registrar, dirección]
var _t := 0.0
var _intentos := 0


func armar() -> void:
	var cfg = Juego.config
	var x := p.position.x + 30
	var y := p.position.y + 80
	panel(p)
	titulo_panel(p, "Multijugador en línea")
	texto(Vector2(x, y + 6), "Nombre", "negrita", 17, Tema.TINTA)
	texto(Vector2(x, y + 50), "Clave", "negrita", 17, Tema.TINTA)
	texto(Vector2(x, y + 136), "Servidor", "negrita", 17, Tema.TINTA)
	texto(Vector2(p.position.x + 480, y - 26), "Servidores encontrados y recientes", "negrita", 17, Tema.TINTA)
	nombre = campo(Rect2(x + 170, y, 260, 32), cfg.leer("nombre"), 20, "su nombre de campaña")
	clave = campo(Rect2(x + 170, y + 44, 260, 32), "", 60, "(opcional)", true)
	registrar = casilla(Rect2(x + 170, y + 84, 260, 30), "Crear una cuenta nueva con esta clave", false)
	registrar.add_theme_font_size_override("font_size", 15)
	direccion = campo(Rect2(x + 170, y + 130, 260, 32), cfg.leer("ultimo_servidor"), 80, "", false, conectar)
	lista_srv = lista(Rect2(p.position.x + 480, y, 330, 250), [], func(c: Variant) -> void: direccion.text = str(c),
			func(_c: Variant) -> void: conectar())
	lbl_buscando = texto(Vector2(p.position.x + 480, y + 256), "Buscando en la red local...", "cursiva", 15,
			Tema.TINTA_SUAVE)
	boton(Rect2(x, y + 186, 200, 42), "Conectar", conectar, "principal")
	boton(Rect2(x + 210, y + 186, 220, 42), "Buscar en la red local", buscar)
	var b_crear := boton(Rect2(x, y + 250, 430, 42), "Crear servidor en este equipo", crear_servidor, "madera",
			"Abre un servidor en su equipo (puerto 47800) y se conecta a él. Sus compañeros de la misma red lo " +
			"verán al buscar; desde Internet necesitan su IP pública con el puerto abierto, o una VPN como " +
			"ZeroTier o Tailscale.")
	b_crear.ayuda_titulo = "Crear servidor"
	boton(Rect2(p.position.x + 30, p.end.y - 60, 160, 42), "Volver", volver, "madera")
	parrafo(Rect2(x, y + 310, p.size.x - 60, 0), "Sin clave se entra como invitado. Con una cuenta (clave) el " +
			"servidor guarda sus victorias y su puesto en el escalafón. Para jugar desde casas distintas, uno crea el " +
			"servidor y abre el puerto 47800 (TCP) en su router, o todos se unen a una red privada virtual " +
			"(ZeroTier, Tailscale o Radmin VPN) y usan la IP de esa red.", "cuerpo", 15, Tema.TINTA_SUAVE)
	lbl_conectando = texto(Vector2(p.end.x - 40, p.end.y - 50), "Conectando...", "negrita", 18, Tema.ROJO_SELLO, "der")
	lbl_conectando.visible = false
	recientes = Juego.perfil.servidores()
	_refrescar_lista()
	if args.get("direccion"):
		direccion.text = args["direccion"]
	if args.get("conectar", false):
		conectar.call_deferred()
	else:
		buscar()


func _refrescar_lista() -> void:
	var items: Array = []
	var ya := {}
	for info in encontrados:
		var dire := "%s:%d" % [info["host"], int(info.get("puerto", PUERTO))]
		items.append([dire, "%s  (%d conectados)" % [info.get("nombre", "?"), int(info.get("jugadores", 0))], Tema.ROJO_SELLO])
		ya[dire] = true
	for r in recientes:
		if not ya.has(r["direccion"]):
			items.append([r["direccion"], ("%s  %s" % [r["direccion"], r.get("nombre", "")]).strip_edges()])
	poner_items(lista_srv, items)


func buscar() -> void:
	busqueda.iniciar()


func crear_servidor() -> void:
	var prueba := TCPServer.new()
	if prueba.listen(PUERTO, "*") != OK:
		Juego.avisar("No se pudo abrir el puerto %d. ¿Ya hay un servidor abierto en este equipo?" % PUERTO, 8.0)
		return
	prueba.stop()
	var n := nombre.text.strip_edges()
	if not Juego.servidor.iniciar(Juego.dir_rts, true, "Partida de %s" % (n if n != "" else "un jugador"), PUERTO):
		Juego.avisar(Juego.servidor.error, 10.0)
		return
	direccion.text = "127.0.0.1:%d" % PUERTO
	var ips: Array = []
	for ip in IP.get_local_addresses():
		if ip.count(".") == 3 and not ip.begins_with("127.") and not ip.begins_with("169.254."):
			ips.append(ip)
	Juego.ips_publicas = ", ".join(ips) if not ips.is_empty() else "?"
	Juego.avisar("Servidor abierto. Sus compañeros deben conectarse a %s (puerto %d)." % [Juego.ips_publicas, PUERTO], 12.0)
	conectar(true)


## esperar: el servidor recién lanzado tarda un momento en escuchar (se reintenta).
func conectar(esperar := false) -> void:
	var n := nombre.text.strip_edges()
	if n.length() < 3:
		Juego.avisar("Escriba un nombre de al menos 3 letras.")
		return
	var dire := direccion.text.strip_edges()
	var partes := dire.split(":")
	var host := partes[0]
	var puerto := PUERTO
	if partes.size() > 1:
		if not partes[1].is_valid_int():
			Juego.avisar("La dirección debe ser del tipo 192.168.1.10:47800")
			return
		puerto = partes[1].to_int()
	Juego.config.escribir("nombre", n)
	Juego.config.escribir("ultimo_servidor", "%s:%d" % [host, puerto])
	Juego.nombre_jugador = n
	if not Juego.en_prueba():
		Juego.config.guardar()
	Juego.cerrar_red()
	Juego.conexion.conectar(host, puerto)
	estado = ["esperando" if esperar else "conectando", n, clave.text, registrar.button_pressed, "%s:%d" % [host, puerto]]
	_t = 0.0
	_intentos = 0
	lbl_conectando.visible = true


func _fallo(motivo: String) -> void:
	Juego.avisar(motivo, 10.0)
	Juego.cerrar_red()
	estado = null
	lbl_conectando.visible = false


func actualizar(delta: float) -> void:
	busqueda.sondear()
	lbl_buscando.visible = busqueda.activa
	if busqueda.nueva:
		busqueda.nueva = false
		encontrados = busqueda.encontrados
		_refrescar_lista()
	if estado == null:
		return
	var con = Juego.conexion
	var fase: String = estado[0]
	_t += delta
	if fase in ["conectando", "esperando"]:
		con.sondear()
		if con.estado == "conectado":
			con.saludar(estado[1], cat.huella, cat.version, cat.protocolo, estado[2], estado[3])
			estado[0] = "saludando"
		elif con.estado == "error":
			if fase == "esperando" and Juego.servidor.vivo() and _intentos < 40:
				# el servidor de este equipo todavía no escucha: otra vez en un momento
				if _t > 0.4:
					_t = 0.0
					_intentos += 1
					var d: String = estado[4]
					con.conectar(d.split(":")[0], d.split(":")[1].to_int())
				return
			_fallo(con.error)
		return
	var msgs: Array = con.sondear()
	for k in msgs.size():
		var m: Dictionary = msgs[k]
		match m.get("t"):
			"bienvenida":
				Juego.bienvenida = m
				Juego.perfil.recordar_servidor(estado[4], str(m.get("servidor", "")))
				# lo que llegó detrás (la partida o la serie que lo esperan) lo atiende el salón
				var resto := msgs.slice(k + 1)
				resto.append_array(con.pendientes)
				con.pendientes = resto
				estado = null
				menu.abrir("salon")
				return
			"error":
				_fallo(str(m.get("msg", "Error")))
				return
			"inicio":
				estado = null
				con.pendientes = msgs.slice(k + 1)
				Juego.a_la_batalla(m, "multijugador")
				return
	if con.estado == "error":
		_fallo(con.error)
	elif _t > 20.0:
		_fallo("El servidor no respondió a tiempo.")


func volver() -> void:
	Juego.cerrar_red()
	Juego.servidor.detener()
	menu.abrir("portada")
