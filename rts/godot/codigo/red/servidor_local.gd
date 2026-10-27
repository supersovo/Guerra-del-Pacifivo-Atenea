## Servidor de este equipo: el mismo servidor de Python, lanzado como proceso.
##
## El privado de las escaramuzas, la campaña y las repeticiones escucha solo en este equipo
## (127.0.0.1); el abierto («Crear servidor en este equipo») escucha en toda la red y responde
## a la búsqueda de la red local. Los dos se cierran solos cuando termina el juego (--padre
## con el PID de este proceso), aunque el juego se cierre de golpe.
## En una instalación se usa el ejecutable empaquetado (ServidorSalitre); en desarrollo,
## «python -m salitre» desde la carpeta rts/ (SALITRE_PYTHON elige el intérprete).
extends RefCounted

const Rutas = preload("res://codigo/datos/rutas.gd")

var pid := -1
var puerto := 0
var error := ""
var publico := false
var empaquetado := false        # el ServidorSalitre de la instalación (si no, Python)


## publico: abierto a la red con ese nombre y puerto (para jugar con los compañeros).
func iniciar(dir_rts: String, abierto := false, nombre := "", puerto_fijo := 0) -> bool:
	detener()
	publico = abierto
	puerto = puerto_fijo if puerto_fijo > 0 else _puerto_libre()
	var args := PackedStringArray(["--puerto", str(puerto), "--padre", str(OS.get_process_id())])
	if abierto:
		args.append_array(["--nombre", nombre])
	else:
		args.append("--local")
	var exe := _ejecutable_empaquetado()
	empaquetado = exe != ""
	if empaquetado:
		# el servidor dedicado empaquetado ya es el servidor: sin «--servidor» (instalador/lanzar_servidor.py)
		pid = OS.create_process(exe, args)
		error = "No se pudo lanzar el servidor del juego (%s)." % exe.get_file()
	else:
		OS.set_environment("PYTHONPATH", dir_rts)
		for candidato in pythons():
			var todos := PackedStringArray(candidato.slice(1))
			todos.append_array(["-m", "salitre", "--servidor"])
			todos.append_array(args)
			pid = OS.create_process(candidato[0], todos)
			if pid > 0:
				break
		error = "No se pudo lanzar el servidor del juego (¿está instalado Python? Defina SALITRE_PYTHON)."
	if pid <= 0:
		pid = -1
		return false
	error = ""
	return true


func vivo() -> bool:
	return pid > 0 and OS.is_process_running(pid)


## Aviso para cuando el servidor recién lanzado se cierra solo.
func motivo_cierre() -> String:
	if empaquetado:
		return "El servidor del juego se cerró al comenzar (vea %s)." % Rutas.dir_registros().path_join("servidor.log")
	return "El servidor del juego se cerró al comenzar. ¿Está instalado Python 3 con el juego? " + \
			"(Defina SALITRE_PYTHON con la ruta del intérprete.)"


func detener() -> void:
	if pid > 0 and OS.is_process_running(pid):
		OS.kill(pid)
	pid = -1


func _puerto_libre() -> int:
	var prueba := TCPServer.new()
	for _intento in 40:
		var p := 47900 + randi() % 1500
		if prueba.listen(p, "127.0.0.1") == OK:
			prueba.stop()
			return p
	return 47950


func _ejecutable_empaquetado() -> String:
	var propio := OS.get_environment("SALITRE_SERVIDOR")
	if propio != "":
		return propio
	if OS.has_feature("editor"):
		return ""
	return Rutas.ejecutable_hermano("ServidorSalitre", OS.get_executable_path().get_base_dir())


## Intérpretes de Python a probar, en orden: [ejecutable, argumentos previos...].
static func pythons() -> Array:
	var propio := OS.get_environment("SALITRE_PYTHON")
	if propio != "":
		return [[propio]]
	if OS.get_name() == "Windows":
		return [["python"], ["py", "-3"]]
	return [["python3"], ["python"]]
