## Espera el inicio de la partida (salitre/cliente/escenas/cargando.py): arranca el servidor
## privado de este equipo, se conecta, saluda, pide la partida (escaramuza, batalla de la
## campaña o repetición) y con el mensaje «inicio» pasa a la batalla.
extends "res://codigo/ui/pantallas/pantalla.gd"

var pedido: Dictionary = {}
var origen := "escaramuza"
var datos: Dictionary = {}
var volver_a := "portada"
var lbl: Label
var _fase := ""            # servidor | conectar | saludar | esperar
var _t := 0.0
var _intentos := 0
var _puntos := 0.0


func armar() -> void:
	pedido = args.get("pedido", {})
	origen = args.get("origen", "escaramuza")
	datos = args.get("info", {})
	volver_a = args.get("volver_a", "portada")
	var r := Rect2(W / 2.0 - 220, H / 2.0 - 40, 440, 160)
	panel(r)
	lbl = texto(Vector2(W / 2.0, r.position.y + 30), "Formando las tropas", "titulo", 28, Tema.TINTA, "centro")
	boton(Rect2(W / 2.0 - 90, H / 2.0 + 60, 180, 40), "Cancelar", cancelar, "madera")
	_iniciar()


func _iniciar() -> void:
	Juego.cerrar_red()
	if not Juego.servidor.iniciar(Juego.dir_rts):
		_falla(Juego.servidor.error)
		return
	if Juego.prueba_humo or Juego.recorrido != "":
		print("PRUEBA_HUMO: servidor privado en el puerto %d (pid %d)" % [Juego.servidor.puerto, Juego.servidor.pid])
	_fase = "conectar"
	_t = 0.0
	_intentos = 0


func cancelar() -> void:
	_fase = ""
	Juego.cerrar_red()
	Juego.servidor.detener()
	menu.abrir(volver_a)


func escape() -> void:
	cancelar()


func _falla(motivo: String) -> void:
	_fase = ""
	Juego.cerrar_red()
	Juego.servidor.detener()
	Juego.avisar(motivo, 10.0)
	if Juego.prueba_humo or Juego.recorrido != "":
		print("PRUEBA_HUMO: FALLA: " + motivo)
		Juego.salir(2)
		return
	menu.abrir(volver_a)


func actualizar(delta: float) -> void:
	_puntos += delta
	lbl.text = "Formando las tropas" + ".".repeat(int(_puntos * 3.0) % 4)
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
				con.saludar(Juego.nombre_jugador, cat.huella, cat.version, cat.protocolo)
				_fase = "esperar"
				_t = 0.0
		"esperar":
			var msgs: Array = con.sondear()
			for k in msgs.size():
				var m: Dictionary = msgs[k]
				match m.get("t"):
					"bienvenida":
						Juego.bienvenida = m
						con.enviar(pedido)
					"error":
						_falla(str(m.get("msg", "El servidor rechazó la partida.")))
						return
					"inicio":
						_fase = ""
						con.pendientes = msgs.slice(k + 1)
						Juego.a_la_batalla(m, origen, datos)
						return
			if con.estado == "error":
				_falla("Se cortó la conexión con el servidor: " + con.error)
			elif _t > 30.0:
				_falla("El servidor no respondió a tiempo.")
