## Repeticiones guardadas en este equipo: verlas con todo el mapa a la vista, cambiar la
## velocidad (+/-) y estudiar la batalla después (salitre/cliente/escenas/repeticiones.py).
extends "res://codigo/ui/pantallas/pantalla.gd"

const Repeticiones = preload("res://codigo/datos/repeticiones.gd")
const Rutas = preload("res://codigo/datos/rutas.gd")

var p := Rect2(40, 140, W - 80, H - 170)
var tabla_rep: Tree
var reps := {}
var borrar_confirmar := ""


func armar() -> void:
	panel(p)
	titulo_panel(p, "Repeticiones")
	texto(Vector2(p.end.x - 24, p.position.y + 42), "Doble clic para ver · durante la repetición, + y - cambian la velocidad",
			"cursiva", 15, Tema.TINTA_SUAVE, "der")
	tabla_rep = tabla(Rect2(p.position.x + 24, p.position.y + 70, p.size.x - 48, p.size.y - 160),
			[["Fecha", 150, "izq"], ["Campo de batalla", 260, "izq"], ["Ejércitos", 540, "izq"], ["Minutos", 90, "centro"],
			["Versión", 90, "centro"]], func(_c: Variant) -> void: ver())
	var y := p.end.y - 64
	boton(Rect2(p.position.x + 24, y, 160, 44), "Volver", volver, "madera")
	boton(Rect2(p.position.x + 200, y, 220, 44), "Abrir la carpeta", abrir_carpeta)
	boton(Rect2(p.position.x + 436, y, 160, 44), "Borrar", borrar)
	boton(Rect2(p.end.x - 264, y, 240, 44), "Ver la repetición", ver, "principal")
	cargar()


func cargar() -> void:
	reps.clear()
	var filas: Array = []
	for r in Repeticiones.listar():
		reps[r["nombre"]] = r
		var fecha := "?"
		if float(r["fecha"]) > 0:
			var f := Time.get_datetime_dict_from_unix_time(int(r["fecha"]) + _huso())
			fecha = "%02d/%02d/%04d %02d:%02d" % [f["day"], f["month"], f["year"], f["hour"], f["minute"]]
		filas.append([r["nombre"], [fecha, r["mapa"], " · ".join(r["jugadores"]), r["minutos"], r["version"]]])
	poner_filas(tabla_rep, filas, "Todavía no hay repeticiones: cada partida terminada se guarda sola.")


static func _huso() -> int:
	return int(Time.get_time_zone_from_system().get("bias", 0)) * 60


func abrir_carpeta() -> void:
	var carpeta := Rutas.dir_repeticiones()
	if not Juego.en_prueba():
		OS.shell_open(carpeta)
	Juego.avisar("Carpeta de repeticiones: " + carpeta, 8.0)


func borrar() -> void:
	var nombre: Variant = clave_tabla(tabla_rep)
	if nombre == null:
		Juego.avisar("Elija una repetición de la lista.")
		return
	if borrar_confirmar != nombre:
		borrar_confirmar = nombre
		Juego.avisar("Pulse «Borrar» otra vez para confirmar.", 4.0)
		return
	if not Repeticiones.borrar(nombre):
		Juego.avisar("No se pudo borrar la repetición.")
	borrar_confirmar = ""
	cargar()


func ver() -> void:
	var nombre: Variant = clave_tabla(tabla_rep)
	if nombre == null:
		Juego.avisar("Elija una repetición de la lista.")
		return
	var version: String = reps.get(nombre, {}).get("version", "?")
	if version != "?" and version != cat.version:
		Juego.avisar("Esa repetición es de otra versión del juego: puede no verse bien.", 6.0)
	menu.abrir("cargando", {"pedido": {"t": "ver_repeticion", "nombre": nombre}, "origen": "repeticion",
			"volver_a": "repeticiones"})


func _unhandled_key_input(ev: InputEvent) -> void:
	if ev.pressed and not ev.echo and (ev.keycode == KEY_ENTER or ev.keycode == KEY_KP_ENTER):
		ver()
