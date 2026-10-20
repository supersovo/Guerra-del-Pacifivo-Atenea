## Carpetas del usuario: las mismas que usa el juego en Python (salitre/rutas.py), para
## que el cliente 3D y el servidor privado compartan repeticiones, mapas propios y registros.
##
## Windows: %APPDATA%\GuerraDelPacifico · macOS: ~/Library/Application Support/GuerraDelPacifico
## Linux: ~/.local/share/guerra-del-pacifico (o $XDG_DATA_HOME). SALITRE_DATOS_USUARIO la
## cambia (lo usan las pruebas).
extends RefCounted


static func dir_usuario() -> String:
	var base := OS.get_environment("SALITRE_DATOS_USUARIO")
	if base == "":
		match OS.get_name():
			"Windows":
				var appdata := OS.get_environment("APPDATA")
				if appdata == "":
					appdata = OS.get_environment("USERPROFILE").path_join("AppData").path_join("Roaming")
				base = appdata.path_join("GuerraDelPacifico")
			"macOS":
				base = OS.get_environment("HOME").path_join("Library").path_join("Application Support") \
						.path_join("GuerraDelPacifico")
			_:
				var xdg := OS.get_environment("XDG_DATA_HOME")
				if xdg == "":
					xdg = OS.get_environment("HOME").path_join(".local").path_join("share")
				base = xdg.path_join("guerra-del-pacifico")
	DirAccess.make_dir_recursive_absolute(base)
	return base


static func _sub(nombre: String) -> String:
	var d := dir_usuario().path_join(nombre)
	DirAccess.make_dir_recursive_absolute(d)
	return d


static func dir_repeticiones() -> String:
	return _sub("repeticiones")


static func dir_mapas_usuario() -> String:
	return _sub("mapas")


static func dir_registros() -> String:
	return _sub("registros")


static func dir_capturas() -> String:
	return _sub("capturas")


# -- el juego instalado ---------------------------------------------------------------
## Carpeta de una instalación con datos/, mapas/ y recursos/, vista desde la del ejecutable del
## cliente 3D: junto a él, en _internal/ (PyInstaller 6, en Windows y Linux) o en
## Contents/Resources/ (la aplicación de macOS, donde el ejecutable está en Contents/MacOS/).
static func dir_juego_instalado(dir_ejecutable: String) -> String:
	for sub in [".", "_internal", "../Resources"]:
		var d := dir_ejecutable.path_join(sub).simplify_path()
		if DirAccess.dir_exists_absolute(d.path_join("datos")) and DirAccess.dir_exists_absolute(d.path_join("recursos")):
			return d
	return dir_ejecutable


## Otro ejecutable de la instalación (ServidorSalitre, GuerraDelPacificoClasico), que va junto al
## del cliente 3D; "" si no está.
static func ejecutable_hermano(nombre: String, dir_ejecutable: String, en_windows := OS.get_name() == "Windows") -> String:
	var ruta := dir_ejecutable.path_join(nombre + (".exe" if en_windows else ""))
	return ruta if FileAccess.file_exists(ruta) else ""


## Escribe un texto de una vez: primero a un archivo temporal y después lo pone en su lugar,
## para que un corte de luz nunca deje la configuración o el perfil a medio escribir.
static func escribir_seguro(ruta: String, texto: String) -> bool:
	var tmp := ruta + ".tmp"
	var f := FileAccess.open(tmp, FileAccess.WRITE)
	if f == null:
		return false
	f.store_string(texto)
	f.close()
	return DirAccess.rename_absolute(tmp, ruta) == OK


## Los números enteros que JSON trajo como decimales (Godot los lee todos como float) vuelven a
## ser enteros, en todo el árbol: así lo que se guarda lo lee Python igual que antes (una
## semilla 1879.0 no es la semilla 1879).
static func enteros(v: Variant) -> Variant:
	if v is float:
		var f: float = v
		if is_finite(f) and f == floorf(f) and absf(f) < 9.0e15:
			return int(f)
		return f
	if v is Array:
		var out: Array = []
		for x in v:
			out.append(enteros(x))
		return out
	if v is Dictionary:
		var out := {}
		for k in v:
			out[k] = enteros(v[k])
		return out
	return v
