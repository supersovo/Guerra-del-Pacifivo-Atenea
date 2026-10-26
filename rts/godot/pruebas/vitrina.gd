## Vitrina: arma un mapa con las tropas y obras de una nación y guarda una captura.
## Sirve para revisar los modelos y la luz sin jugar una partida:
##
##   godot --path rts/godot --rendering-method gl_compatibility -s res://pruebas/vitrina.gd -- \
##       --mapa=pampa_del_tamarugal --faccion=chile --vista=tropas --salida=/tmp/vitrina.png
##
## Con --enfocar=<tipo> (en la vista «tropas») la cámara se acerca a esa unidad, por ejemplo
## para revisar un modelo nuevo de arte/: --enfocar=cantinera.
##
## Vistas: «tropas» (todas las unidades de cerca, con el arte de arte/ donde lo hay), «obras»
## (los edificios) y «mapa» (el diorama completo).
extends SceneTree

const Catalogo = preload("res://codigo/datos/catalogo.gd")
const Terreno = preload("res://codigo/mundo/terreno.gd")
const Modelos = preload("res://codigo/mundo/modelos.gd")
const Ambiente = preload("res://codigo/mundo/ambiente.gd")
const Arte = preload("res://codigo/mundo/arte.gd")
const Tropas = preload("res://codigo/mundo/tropas.gd")

var salida := "user://vitrina.png"
var cuadros := 0


func _initialize() -> void:
	var mapa_id := "pampa_del_tamarugal"
	var faccion := "chile"
	var vista := "tropas"
	var enfocar := ""
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--mapa="):
			mapa_id = a.trim_prefix("--mapa=")
		elif a.begins_with("--faccion="):
			faccion = a.trim_prefix("--faccion=")
		elif a.begins_with("--vista="):
			vista = a.trim_prefix("--vista=")
		elif a.begins_with("--salida="):
			salida = a.trim_prefix("--salida=")
		elif a.begins_with("--enfocar="):
			enfocar = a.trim_prefix("--enfocar=")
	var cat := Catalogo.new()
	cat.cargar()
	var dir_rts := ProjectSettings.globalize_path("res://").rstrip("/").get_base_dir()
	var mapa: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(dir_rts.path_join("mapas/%s.json" % mapa_id)))
	var w := int(mapa["ancho"])
	var h := int(mapa["alto"])
	var codigos := {}
	for c in cat.datos["terrenos"]:
		codigos[c] = int(cat.datos["terrenos"][c]["codigo"])
	var terreno := PackedByteArray()
	var niveles := PackedByteArray()
	terreno.resize(w * h)
	niveles.resize(w * h)
	for fy in h:
		for fx in w:
			terreno[fy * w + fx] = codigos.get(mapa["terreno"][fy][fx], 0)
			niveles[fy * w + fx] = clampi(mapa["altura"][fy].unicode_at(fx) - 48, 0, 2)
	var ter := Terreno.new(terreno, niveles, w, h, cat.colores_terreno, mapa.get("llegada") == "tren")
	var raiz := Node3D.new()
	root.add_child(raiz)
	raiz.add_child(Ambiente.crear(mapa.get("ambiente", "desierto"), w, h))
	raiz.add_child(ter.construir())
	var todo := PackedByteArray()
	todo.resize(w * h)
	todo.fill(1)
	ter.actualizar_niebla(todo, todo)
	for r in mapa.get("recursos", []):
		var salitre: bool = r["tipo"] == "salitre"
		var tam := Vector2(2, 1) if salitre else Vector2(3, 3)
		var p := Vector3(float(r["x"]) + tam.x / 2.0, 0, float(r["y"]) + tam.y / 2.0)
		p.y = ter.altura_en(p.x, p.z)
		var mi := MeshInstance3D.new()
		mi.mesh = Modelos.salitre(1.0) if salitre else Modelos.pozo(1.0)
		mi.position = p
		raiz.add_child(mi)
	var inicio: Array = mapa["inicios"][0]
	var centro := Vector3(float(inicio[0]) + 2.0, 0, float(inicio[1]) + 2.0)
	var f: Dictionary = cat.facciones[faccion]
	var color := cat.color_jugador(1)
	var base := cat.uniforme_base(faccion)
	if vista == "tropas":
		var k := 0
		var foco := Vector3.INF
		for tid in f["unidades"] + f["heroes"]:
			var t: Dictionary = cat.tipos_por_id[tid]
			if int(t["capa"]) == 1:
				continue
			var p := centro + Vector3((k % 6) * 0.9 - 2.2, 0, (k / 6) * 0.9 - 1.0)
			p.y = ter.altura_en(p.x, p.z)
			var e := Modelos.escala(t)
			if tid == enfocar:
				foco = p
			var arte := Arte.modelo(t["forma"], faccion, Tropas.alto_juego(t))
			if arte.is_empty():
				var propio := cat.uniforme_propio(faccion, t["forma"])
				var mi := MeshInstance3D.new()
				mi.mesh = Modelos.unidad(t, base, propio, color, faccion)
				mi.position = p
				mi.rotation.y = -PI / 4.0 * (k % 8)
				mi.scale = Vector3(e, e, e)
				raiz.add_child(mi)
			else:
				# lo hecho fuera del juego (arte/), sobre su peana, como en la batalla
				var fig := Arte.instanciar(arte)
				var peana := MeshInstance3D.new()
				peana.mesh = Modelos.peana(color)
				peana.scale = Vector3.ONE * Tropas.escala_peana(t, arte)
				fig.add_child(peana)
				fig.position = p
				fig.rotation.y = -PI / 4.0 * (k % 8)
				raiz.add_child(fig)
			k += 1
		if foco != Vector3.INF:
			_camara(raiz, foco + Vector3(0, 0.45, 0), 3.2, 38.0)
		else:
			_camara(raiz, centro + Vector3(0.3, 0, 0.6), 7.5, 44.0)
	elif vista == "obras":
		var x := centro.x - 7.0
		var fila := 0
		for bid in f["edificios"]:
			var t: Dictionary = cat.tipos_por_id[bid]
			var mi := MeshInstance3D.new()
			mi.mesh = Modelos.edificio(t, color, faccion)
			var p := Vector3(x + float(t["ancho"]) / 2.0, 0, centro.z + fila * 4.5)
			p.y = ter.altura_en(p.x, p.z)
			mi.position = p
			raiz.add_child(mi)
			x += float(t["ancho"]) + 0.6
			if x > centro.x + 9.0:
				x = centro.x - 7.0
				fila += 1
		_camara(raiz, centro + Vector3(1.0, 0, 4.0), 17.0, 50.0)
	else:
		_camara(raiz, Vector3(w / 2.0, 0, h / 2.0 + 4.0), maxf(w, h) * 1.05, 55.0)


func _camara(raiz: Node3D, objetivo: Vector3, distancia: float, inclinacion: float) -> void:
	var cam := Camera3D.new()
	cam.fov = 40.0
	cam.far = 800.0
	raiz.add_child(cam)
	var dir := Vector3(0, sin(deg_to_rad(inclinacion)), cos(deg_to_rad(inclinacion)))
	cam.look_at_from_position(objetivo + dir * distancia, objetivo, Vector3.UP)
	cam.current = true


func _process(_delta: float) -> bool:
	cuadros += 1
	if cuadros == 12:
		var img := root.get_texture().get_image()
		img.save_png(salida)
		print("Captura: ", salida)
		return true
	return false
