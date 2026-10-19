## Servidor privado de las escaramuzas: el mismo servidor de Python, lanzado como proceso.
##
## Escucha solo en este equipo (127.0.0.1) y se cierra solo cuando termina el juego
## (--padre con el PID de este proceso), aunque el juego se cierre de golpe.
## En una instalación se usa el ejecutable empaquetado (ServidorSalitre); en desarrollo,
## «python -m salitre» desde la carpeta rts/ (SALITRE_PYTHON elige el intérprete).
extends RefCounted

var pid := -1
var puerto := 0
var error := ""


func iniciar(dir_rts: String) -> bool:
	detener()
	puerto = _puerto_libre()
	var args := PackedStringArray(["--servidor", "--local", "--puerto", str(puerto),
			"--padre", str(OS.get_process_id())])
	var exe := _ejecutable_empaquetado()
	if exe != "":
		pid = OS.create_process(exe, args)
	else:
		OS.set_environment("PYTHONPATH", dir_rts)
		for candidato in _pythons():
			var todos := PackedStringArray(candidato.slice(1))
			todos.append_array(["-m", "salitre"])
			todos.append_array(args)
			pid = OS.create_process(candidato[0], todos)
			if pid > 0:
				break
	if pid <= 0:
		error = "No se pudo lanzar el servidor del juego (¿está instalado Python? Defina SALITRE_PYTHON)."
		pid = -1
		return false
	return true


func vivo() -> bool:
	return pid > 0 and OS.is_process_running(pid)


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
	var nombre := "ServidorSalitre.exe" if OS.get_name() == "Windows" else "ServidorSalitre"
	var junto := OS.get_executable_path().get_base_dir().path_join(nombre)
	if not OS.has_feature("editor") and FileAccess.file_exists(junto):
		return junto
	return ""


## Intérpretes de Python a probar, en orden: [ejecutable, argumentos previos...].
func _pythons() -> Array:
	var propio := OS.get_environment("SALITRE_PYTHON")
	if propio != "":
		return [[propio]]
	if OS.get_name() == "Windows":
		return [["python"], ["py", "-3"]]
	return [["python3"], ["python"]]
