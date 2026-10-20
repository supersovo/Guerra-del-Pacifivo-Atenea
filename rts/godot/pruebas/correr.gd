## Pruebas del cliente de Godot (sin pantalla):
##
##   godot --headless --path rts/godot -s res://pruebas/correr.gd
##
## Sale con 0 si todo pasa (o con el número de fallas). Con
## «-- --vision=entrada.json --salida=salida.json» calcula la niebla de un caso que arma
## tests/test_godot.py con la simulación de Python, para comparar las dos; lo mismo con
## «--campanas=» (el escalafón de una campaña tras cada batalla) y «--nombres=» (los nombres
## de los veteranos).
extends SceneTree

const Protocolo = preload("res://codigo/red/protocolo.gd")
const Vision = preload("res://codigo/batalla/vision.gd")
const Estado = preload("res://codigo/batalla/estado.gd")
const Catalogo = preload("res://codigo/datos/catalogo.gd")
const Terreno = preload("res://codigo/mundo/terreno.gd")
const Modelos = preload("res://codigo/mundo/modelos.gd")
const Tarjeta = preload("res://codigo/ui/tarjeta.gd")
const Tropas = preload("res://codigo/mundo/tropas.gd")
const Minimapa = preload("res://codigo/ui/minimapa.gd")
const Campanas = preload("res://codigo/datos/campanas.gd")
const Nombres = preload("res://codigo/datos/nombres.gd")
const Config = preload("res://codigo/datos/config.gd")
const Perfil = preload("res://codigo/datos/perfil.gd")
const Rutas = preload("res://codigo/datos/rutas.gd")
const Repeticiones = preload("res://codigo/datos/repeticiones.gd")
const Mapas = preload("res://codigo/datos/mapas.gd")
const Banderas = preload("res://codigo/ui/banderas.gd")

var fallas := 0
var pruebas := 0
var cat: Catalogo


func _initialize() -> void:
	var args := OS.get_cmdline_user_args()
	var entrada := ""
	var salida := ""
	var cruzada := ""
	for a in args:
		for modo in ["vision", "campanas", "nombres"]:
			if a.begins_with("--%s=" % modo):
				cruzada = modo
				entrada = a.trim_prefix("--%s=" % modo)
		if a.begins_with("--salida="):
			salida = a.trim_prefix("--salida=")
	if cruzada == "vision":
		quit(_vision_cruzada(entrada, salida))
		return
	cat = Catalogo.new()
	_ok(cat.cargar(), "se carga el catálogo")
	if cruzada == "campanas":
		quit(_campanas_cruzada(entrada, salida))
		return
	if cruzada == "nombres":
		quit(_nombres_cruzada(entrada, salida))
		return
	for prueba in ["protocolo", "lector_por_trozos", "vision", "estado", "terreno", "tarjeta", "modelos", "lugar_costo",
			"partes_animadas", "grupos", "guarnicion", "minimapa", "niebla_fundida", "enteros", "config", "perfil",
			"repeticiones", "mapas_y_banderas", "campana", "instalacion"]:
		call("_prueba_" + prueba)
	print("%d comprobaciones, %d fallas" % [pruebas, fallas])
	quit(mini(fallas, 100))


func _ok(cond: bool, que: String) -> void:
	pruebas += 1
	if not cond:
		fallas += 1
		print("FALLA: ", que)


func _igual(a: Variant, b: Variant, que: String) -> void:
	_ok(a == b, "%s (se obtuvo %s, se esperaba %s)" % [que, str(a), str(b)])


# ----------------------------------------------------------------------

func _prueba_protocolo() -> void:
	var msg := {"t": "hola", "protocolo": 3, "nombre": "Prat", "lista": [1, 2, 3]}
	var datos := Protocolo.codificar(msg)
	var largo := (datos[0] << 24) | (datos[1] << 16) | (datos[2] << 8) | datos[3]
	_igual(largo, datos.size() - 4, "el largo cuenta el formato y el cuerpo")
	_igual(datos[4], Protocolo.FMT_JSON, "un mensaje corto va sin comprimir")
	var l := Protocolo.Lector.new()
	var out := l.alimentar(datos)
	_igual(out.size(), 1, "se lee un mensaje")
	_igual(out[0]["nombre"], "Prat", "el contenido llega igual")
	# uno grande va comprimido (zlib, como en Python)
	var grande := {"t": "inst", "e": []}
	for i in 400:
		grande["e"].append([i, 3, 0, i * 10, i * 7, 100, 2, 0, 0])
	var dg := Protocolo.codificar(grande)
	_igual(dg[4], Protocolo.FMT_ZLIB, "un mensaje grande va comprimido")
	var og := Protocolo.Lector.new().alimentar(dg)
	_igual(og.size(), 1, "se descomprime")
	_igual(int(og[0]["e"][399][3]), 3990, "los datos comprimidos llegan intactos")
	# zlib de Python: «{"t": "x"}» comprimido con zlib.compress (nivel 6)
	var py := PackedByteArray([0x78, 0x9c, 0xab, 0x56, 0x2a, 0x51, 0xb2, 0x52, 0x50, 0xaa, 0x50, 0xaa, 0x05, 0x00, 0x0f, 0x45, 0x02, 0xc7])
	var d: Variant = Protocolo.decodificar_cuerpo(Protocolo.FMT_ZLIB, py)
	_ok(d != null and d["t"] == "x", "se lee el zlib de Python")
	_igual(Protocolo.decodificar_cuerpo(9, PackedByteArray([1, 2])), null, "un formato desconocido se rechaza")
	_igual(Protocolo.decodificar_cuerpo(Protocolo.FMT_JSON, "[1, 2]".to_utf8_buffer()), null, "un mensaje sin «t» se rechaza")


func _prueba_lector_por_trozos() -> void:
	var a := Protocolo.codificar({"t": "uno"})
	var b := Protocolo.codificar({"t": "dos", "x": "ñandú"})
	var todo := a.duplicate()
	todo.append_array(b)
	var l := Protocolo.Lector.new()
	var recibidos: Array = []
	for i in todo.size():
		recibidos.append_array(l.alimentar(todo.slice(i, i + 1)))
	_igual(recibidos.size(), 2, "llegan los dos mensajes byte a byte")
	_igual(recibidos[1]["x"], "ñandú", "el UTF-8 llega bien")
	var malo := Protocolo.Lector.new()
	malo.alimentar(PackedByteArray([0, 0, 0, 0, 1]))
	_ok(malo.error != "", "un largo cero es un error")


func _prueba_vision() -> void:
	# tramos de un círculo de radio 3: 7 filas, la del centro de 3 a cada lado
	var t := Vision.tramos(3.0)
	_igual(t.size(), 7, "filas del círculo")
	_igual(t[3], [0, 3], "fila del centro")
	_igual(Vision.redondear_par(6.5), 6, "redondeo al par, como en Python")
	_igual(Vision.redondear_par(7.5), 8, "redondeo al par, como en Python")
	# regla de las alturas: desde abajo no se ve lo alto
	var w := 9
	var h := 3
	var niveles := PackedByteArray()
	niveles.resize(w * h)
	for y in h:
		for x in w:
			niveles[y * w + x] = 1 if x >= 5 else 0
	var v := Vision.calcular(niveles, w, h, [[2, 1, 4.0, 0]])
	_igual(v[1 * w + 4], 1, "se ve el llano")
	_igual(v[1 * w + 5], 0, "no se ve la meseta desde abajo")
	var v2 := Vision.calcular(niveles, w, h, [[6, 1, 4.0, 1]])
	_igual(v2[1 * w + 3], 1, "desde la meseta se ve el llano")


func _inicio_falso() -> Dictionary:
	var terreno: Array = []
	var altura: Array = []
	for y in 12:
		terreno.append("......~~~~~~".substr(0, 12) if y < 6 else "...,,,::....")
		altura.append("000000000000" if y < 8 else "000011110000")
	return {"t": "inicio", "partida": 1, "yo": 0, "ticks": 16, "velocidad": 1.0, "cada": 2, "semilla": 3,
			"jugadores": [{"nombre": "A", "faccion": "chile", "equipo": 1, "color": 1, "ia": false},
					{"nombre": "B", "faccion": "peru", "equipo": 2, "color": 0, "ia": true}],
			"mapa": {"id": "prueba", "nombre": "Prueba", "ancho": 12, "alto": 12, "jugadores": 2, "naval": true,
					"llegada": "carreta", "inicios": [[1, 1], [9, 9]],
					"recursos": [{"tipo": "salitre", "x": 2, "y": 9}, {"tipo": "agua", "x": 7, "y": 8, "cantidad": 900}],
					"decoracion": [], "terreno": terreno, "altura": altura}}


func _prueba_estado() -> void:
	var est := Estado.new(cat, _inicio_falso())
	_igual(est.ents.size(), 2, "los yacimientos se conocen desde el comienzo")
	_igual(est.ents[1].x, 2.0 * 32 + 32, "el salitre (2x1) se centra en su planta")
	_igual(est.ents[2].vida, 900, "la cantidad del pozo")
	_igual(est.inicial[2], 900, "se recuerda la cantidad inicial")
	var infante: int = cat.tipos_por_id["infante"]["idx"]
	var cg: int = cat.tipos_por_id["cuartel_general"]["idx"]
	est.aplicar({"t": "inst", "k": 32, "completa": 1,
			"e": [[10, infante, 0, 100, 100, 50, 2, 0, 0], [11, cg, 1, 300, 200, 1500, 0, 0, {"g": [infante]}]],
			"j": {"d": 250, "a": 40, "p": 3, "pm": 10, "m": [], "i": [], "h": ["prat"], "mi": 0, "vi": [4, 30]}})
	_igual(est.tick, 32, "el tick de la instantánea")
	_igual(est.dinero, 250, "el dinero")
	_igual(est.viento, [4, 30], "el viento")
	_igual(est.heroes, ["prat"], "los héroes en campaña")
	_ok(est.ents[10].es_unidad() and est.ents[11].es_edificio(), "tipos de las entidades")
	_ok(est.aliado(0) and not est.aliado(1), "aliados y enemigos")
	est.aplicar({"t": "inst", "k": 34, "e": [[10, infante, 0, 132, 100, 50, 2, 1, 0]],
			"q": [[11, "v"]]})
	_igual(est.ents[10].x1, 132.0, "la unidad va hacia su nueva posición")
	_ok(est.ents[11].fantasma, "el edificio fuera de la vista queda como fantasma")
	est.aplicar({"t": "inst", "k": 36, "q": [[10, "m"]]})
	_ok(not est.ents.has(10), "la baja se quita")
	_ok(est.actualizar_vision(true), "se calcula la niebla")


func _prueba_terreno() -> void:
	var est := Estado.new(cat, _inicio_falso())
	var ter := Terreno.new(est.terreno, est.niveles, est.w, est.h, cat.colores_terreno)
	_ok(absf(ter.altura_en(0.5, 0.5)) < 0.001, "el llano está a la altura cero")
	_ok(absf(ter.altura_en(5.5, 10.5) - Terreno.NIVEL) < 0.001, "la meseta está un nivel más arriba")
	_ok(ter.altura_en(8.5, 2.5) < Terreno.NIVEL_AGUA, "el fondo del mar está bajo el agua")
	var p: Variant = ter.interseccion(Vector3(3.5, 10.0, 3.5), Vector3(0, -1, 0))
	_ok(p != null and absf(p.y) < 0.02, "el rayo toca el suelo")
	var mar: Variant = ter.interseccion(Vector3(8.5, 10.0, 2.5), Vector3(0, -1, 0))
	_ok(mar != null and absf(mar.y - Terreno.NIVEL_AGUA) < 0.02, "el rayo toca el agua sobre el mar")
	var nodo := ter.construir()
	_ok(nodo.get_child_count() >= 3, "se arma la malla del terreno")
	nodo.free()


func _prueba_tarjeta() -> void:
	var est := Estado.new(cat, _inicio_falso())
	var obrero: int = cat.tipos_por_id["trabajador"]["idx"]
	var cg: int = cat.tipos_por_id["cuartel_general"]["idx"]
	var infante: int = cat.tipos_por_id["infante"]["idx"]
	est.aplicar({"t": "inst", "k": 2, "e": [[20, obrero, 0, 50, 50, 30, 0, 0, 0], [21, cg, 0, 200, 120, 1500, 0, 0, 0],
			[22, infante, 0, 90, 60, 50, 0, 0, 0]], "j": {"d": 500, "a": 100, "p": 2, "pm": 10, "m": [], "i": [], "h": []}})
	var claves := func(slots: Array) -> Array:
		var out: Array = []
		for b in slots:
			if b != null:
				out.append(b["clave"])
		return out
	var t: Array = claves.call(Tarjeta.tarjeta(est, [20]))
	_ok("menu_basico" in t and "recolectar" in t, "el trabajador construye y recolecta")
	var basico: Array = Tarjeta.tarjeta(est, [20], "basico")
	_ok("b:deposito" in claves.call(basico), "el menú básico ofrece el depósito")
	var barracas: Variant = null
	for b in basico:
		if b != null and b["clave"] == "b:barracas":
			barracas = b
	_ok(barracas != null and barracas["activo"], "las barracas se pueden levantar con el cuartel en pie")
	var c: Array = claves.call(Tarjeta.tarjeta(est, [21]))
	_ok("u:trabajador" in c, "el cuartel forma trabajadores")
	var i: Array = claves.call(Tarjeta.tarjeta(est, [22]))
	_ok("atacar" in i and "menu_formacion" in i, "la infantería ataca y forma")
	_igual(Tarjeta.tarjeta(est, [22], "formacion")[11]["clave"], "volver", "el menú de formaciones tiene Volver")
	var nada: Array = claves.call(Tarjeta.tarjeta(est, []))
	_ok(nada.is_empty(), "sin selección no hay botones")


func _prueba_modelos() -> void:
	var mallas := 0
	for f in cat.facciones:
		var base := cat.uniforme_base(f)
		for tid in cat.facciones[f]["unidades"] + cat.facciones[f]["heroes"]:
			var t: Dictionary = cat.tipos_por_id[tid]
			var m := Modelos.unidad(t, base, cat.uniforme_propio(f, t["forma"]), cat.color_jugador(0), f)
			_ok(m.get_surface_count() == 1, "malla de %s (%s)" % [tid, f])
			mallas += 1
		for bid in cat.facciones[f]["edificios"]:
			var m := Modelos.edificio(cat.tipos_por_id[bid], cat.color_jugador(1), f)
			_ok(m.get_surface_count() == 1, "malla de %s (%s)" % [bid, f])
			mallas += 1
	_ok(mallas > 40, "se armaron todas las mallas")
	_ok(Modelos.salitre(0.3).get_surface_count() == 1 and Modelos.pozo(0.0).get_surface_count() == 1, "yacimientos")
	_ok(Modelos.convoy(true, Color.RED).get_surface_count() == 1 and Modelos.convoy(false, Color.RED).get_surface_count() == 1,
			"tren y carreta")


func _prueba_lugar_costo() -> void:
	# el costo con las ventajas de la nación (Chile: buques un 25 % más baratos)
	var base: Array = cat.tipos_por_id["canonera"]["costo"]
	var chile := cat.costo("chile", "canonera")
	_ok(chile[0] < int(base[0]), "la cañonera chilena es más barata")
	_igual(cat.costo("peru", "infante"), [int(cat.tipos_por_id["infante"]["costo"][0]), int(cat.tipos_por_id["infante"]["costo"][1])],
			"sin ventajas, el costo del catálogo")


## Las partes de una malla (CUSTOM0: parte, pivote): {parte: pivote del primer vértice}.
func _partes(m: ArrayMesh) -> Dictionary:
	var arr := m.surface_get_arrays(0)
	var pc: PackedFloat32Array = arr[Mesh.ARRAY_CUSTOM0]
	var out := {}
	for i in range(0, pc.size(), 4):
		var p := int(pc[i])
		if not out.has(p):
			out[p] = Vector3(pc[i + 1], pc[i + 2], pc[i + 3])
	return out


func _prueba_partes_animadas() -> void:
	var base := cat.uniforme_base("chile")
	var infante: Dictionary = cat.tipos_por_id["infante"]
	var p := _partes(Modelos.unidad(infante, base, {}, Color.RED, "chile"))
	_ok(p.has(Modelos.P_PIERNA_I) and p.has(Modelos.P_PIERNA_D), "el infante tiene piernas que marchan")
	_ok(p.has(Modelos.P_BRAZO_ARMA) and p.has(Modelos.P_BRAZO_I), "y brazos: el del fusil y el que bracea")
	_ok(absf(p[Modelos.P_PIERNA_I].y - 0.27) < 0.001, "las piernas giran en la cadera")
	var granadero: Dictionary = cat.tipos_por_id["granadero"]
	var pj := _partes(Modelos.unidad(granadero, base, cat.uniforme_propio("chile", granadero["forma"]), Color.RED, "chile"))
	for parte in [Modelos.P_PATA_DI, Modelos.P_PATA_DD, Modelos.P_PATA_TI, Modelos.P_PATA_TD, Modelos.P_SABLE]:
		_ok(pj.has(parte), "el granadero tiene la parte %d" % parte)
	var pieza := _partes(Modelos.unidad(cat.tipos_por_id["canon_campana"], base, {}, Color.RED, "chile"))
	_ok(pieza.has(Modelos.P_RUEDA) and pieza.has(Modelos.P_CANON), "la pieza tiene ruedas y caño")
	var cg := _partes(Modelos.edificio(cat.tipos_por_id["cuartel_general"], Color.RED, "chile"))
	_ok(cg.has(Modelos.P_BANDERA), "el cuartel general tiene su bandera al viento")
	var molino := _partes(Modelos.edificio(cat.tipos_por_id["molino_agua"], Color.RED, "chile"))
	_ok(molino.has(Modelos.P_ASPAS), "el molino tiene aspas")
	# la copia de un modelo (el caballo de tiro) lleva sus pivotes al lugar nuevo
	var carro := _partes(Modelos.unidad(cat.tipos_por_id["carreta_agua"], base, {}, Color.RED, "chile"))
	_ok(carro.has(Modelos.P_PATA_DI) and carro[Modelos.P_PATA_DI].x > 0.4, "el caballo de tiro va delante del carro")
	var sin_peana := Modelos.unidad(infante, base, {}, Color.RED, "chile", "sin_peana")
	var con_peana := Modelos.unidad(infante, base, {}, Color.RED, "chile")
	_ok(sin_peana.surface_get_array_len(0) < con_peana.surface_get_array_len(0), "la figura sin peana (las bajas)")


func _prueba_grupos() -> void:
	var raiz := Node3D.new()
	var g := Tropas.Grupo.new(Modelos.mina(), raiz)
	for k in 3:
		g.agregar(Transform3D(Basis(), Vector3(k, 0, 0)), Vector4(k, 1, 0, 0))
	g.cerrar()
	var mm := g.mmi.multimesh
	_igual(mm.visible_instance_count, 3, "se dibujan las tres figuras")
	_ok(mm.instance_count >= 3, "con lugar para ellas")
	var b := g.ultimo
	_igual(b.size(), mm.instance_count * 20, "transformación, color y datos propios: 20 números por figura")
	_igual(b[2 * 20 + 3], 2.0, "la tercera, en su lugar")
	_igual(Array(b.slice(12, 20)), [1.0, 1.0, 1.0, 1.0, 0.0, 1.0, 0.0, 0.0], "el color en blanco y los datos de la primera")
	_igual(b[1 * 20 + 16], 1.0, "la fase de la segunda")
	g.cerrar()
	_ok(not g.mmi.visible, "un grupo vacío no se dibuja")
	raiz.free()


func _prueba_guarnicion() -> void:
	for id in ["cuartel_general", "barracas", "trinchera"]:
		var t: Dictionary = cat.tipos_por_id[id]
		_igual(Modelos.puestos_guarnicion(t["forma"]).size(), int(t["guarnicion"]),
				"un puesto por plaza de la guarnición en %s" % id)


func _prueba_minimapa() -> void:
	var est := Estado.new(cat, _inicio_falso())
	var m := Minimapa.new()
	m.size = Vector2(170, 170)
	m.preparar(est, cat.colores_terreno)
	var p := m.a_mapa(m.a_mini(3.5, 9.25))
	_ok(absf(p.x - 3.5) < 0.01 and absf(p.z - 9.25) < 0.01, "del minimapa al mapa y de vuelta")
	_ok(m.a_mapa(Vector2(-50, -50)) == Vector3(0, 0, 0), "fuera del minimapa, el borde del mapa")
	m.free()


func _prueba_niebla_fundida() -> void:
	var est := Estado.new(cat, _inicio_falso())
	var ter := Terreno.new(est.terreno, est.niveles, est.w, est.h, cat.colores_terreno)
	var nodo := ter.construir()
	var todo := PackedByteArray()
	todo.resize(est.w * est.h)
	todo.fill(1)
	ter.actualizar_niebla(todo, todo)
	_igual(ter.mezcla_niebla, 0.0, "la niebla nueva empieza fundida con la anterior")
	ter.avanzar_niebla(0.1)
	_ok(ter.mezcla_niebla > 0.4 and ter.mezcla_niebla < 0.6, "y pasa a la nueva en un instante")
	ter.avanzar_niebla(1.0)
	_igual(ter.mezcla_niebla, 1.0, "hasta quedar la nueva")
	nodo.free()


# ----------------------------------------------------------------------

func _vision_cruzada(entrada: String, salida: String) -> int:
	var caso: Variant = JSON.parse_string(FileAccess.get_file_as_string(entrada))
	if typeof(caso) != TYPE_DICTIONARY:
		return 2
	var w := int(caso["w"])
	var h := int(caso["h"])
	var niveles := PackedByteArray()
	for n in caso["niveles"]:
		niveles.append(int(n))
	var obs: Array = []
	for o in caso["observadores"]:
		obs.append([int(o[0]), int(o[1]), float(o[2]), int(o[3])])
	var v := Vision.calcular(niveles, w, h, obs)
	var f := FileAccess.open(salida, FileAccess.WRITE)
	f.store_string(JSON.stringify(Array(v)))
	f.close()
	return 0


# ----------------------------------------------------------------------
# Fase 3: configuración, perfil, repeticiones, mapas, banderas y campañas

func _dir_datos() -> String:
	return ProjectSettings.globalize_path("res://").rstrip("/").get_base_dir().path_join("datos")


func _dir_prueba(nombre: String) -> String:
	var d := ProjectSettings.globalize_path("user://").path_join("pruebas_%s_%d" % [nombre, randi() % 1000000])
	DirAccess.make_dir_recursive_absolute(d)
	return d


func _borrar_dir(d: String) -> void:
	for a in DirAccess.get_files_at(d):
		DirAccess.remove_absolute(d.path_join(a))
	DirAccess.remove_absolute(d)


func _prueba_enteros() -> void:
	var v: Variant = Rutas.enteros(JSON.parse_string('{"semilla": 1879, "x": [1, 2.5], "y": {"z": 3}}'))
	_ok(v["semilla"] is int and v["semilla"] == 1879, "la semilla vuelve a ser entera")
	_ok(v["x"][0] is int and v["x"][1] is float, "en las listas también, sin tocar los decimales")
	_ok(v["y"]["z"] is int, "y en los diccionarios anidados")
	_igual(JSON.stringify(v["x"]), "[1,2.5]", "se escribe como en Python")


func _prueba_config() -> void:
	var d := _dir_prueba("config")
	# la primera vez se toma lo del cliente de Python (config.json), salvo la ventana
	var f := FileAccess.open(d.path_join("config.json"), FileAccess.WRITE)
	f.store_string(JSON.stringify({"nombre": "Prat", "volumen_musica": 0.25, "voces": false, "ventana": [800, 600],
			"sangre": "no", "resolucion_interna": [1280, 720]}))
	f.close()
	var c := Config.new()
	c.cargar(d)
	_igual(c.leer("nombre"), "Prat", "el nombre viene del cliente de Python")
	_igual(c.leer("volumen_musica"), 0.25, "y los volúmenes")
	_igual(c.leer("voces"), false, "y las voces")
	_igual(c.leer("ventana"), [1280, 720], "la ventana es propia del cliente 3D")
	_igual(c.leer("sangre"), true, "un valor de otro tipo se descarta")
	c.escribir("nombre", "Grau")
	c.escribir("ventana", [1600, 900])
	_ok(c.guardar(), "se guarda")
	var c2 := Config.new()
	c2.cargar(d)
	_igual(c2.leer("nombre"), "Grau", "después se lee la propia")
	_ok(c2.leer("ventana")[0] is int and c2.leer("ventana") == [1600, 900], "la ventana vuelve en enteros")
	c2.restablecer()
	_igual(c2.leer("nombre"), "Grau", "restablecer conserva el nombre")
	_igual(c2.leer("volumen_musica"), 0.6, "y devuelve los volúmenes de fábrica")
	_borrar_dir(d)


func _prueba_perfil() -> void:
	var d := _dir_prueba("perfil")
	var p := Perfil.new()
	p.cargar(d)
	_igual(p.resumen()["jugadas"], 0, "un perfil nuevo está vacío")
	p.registrar_escaramuza("pampa_del_tamarugal", "chile", "peru/normal", "victoria", 12.5, 30, 12)
	p.registrar_escaramuza("morro_de_arica", "peru", "chile/dificil", "derrota", 8.0, 5, 40)
	p.recordar_servidor("192.168.1.10:47800", "Escuela")
	p.recordar_servidor("127.0.0.1:47800", "")
	p.recordar_servidor("192.168.1.10:47800", "Escuela Militar")
	var cid := p.crear_campana({"campana": "salitre", "faccion": "chile", "etapa": 0, "escalafon": []})
	var p2 := Perfil.new()
	p2.cargar(d)
	var r := p2.resumen()
	_ok(r["jugadas"] == 2 and r["victorias"] == 1 and r["derrotas"] == 1, "el historial de escaramuzas se conserva")
	_igual(p2.escaramuzas()[0]["mapa"], "morro_de_arica", "la más nueva primero")
	var sv := p2.servidores()
	_ok(sv.size() == 2 and sv[0]["nombre"] == "Escuela Militar", "servidores recientes sin repetir, el último arriba")
	var u := p2.ultima_campana("salitre")
	_ok(u[0] == cid and u[1]["faccion"] == "chile", "la campaña en curso se recupera")
	_ok(u[1]["etapa"] is int, "con los números enteros")
	u[1]["etapa"] = 1
	p2.guardar_campana(cid, u[1])
	_igual(int(p2.campana(cid)["etapa"]), 1, "la campaña se actualiza")
	p2.borrar_campana(cid)
	_igual(p2.ultima_campana("salitre")[0], -1, "y se borra")
	_borrar_dir(d)


func _prueba_repeticiones() -> void:
	var d := _dir_prueba("rep")
	var datos := {"version": cat.version, "fecha": 1700000000.5, "mapa": {"nombre": "Pampa del Tamarugal"},
			"semilla": 1879, "jugadores": [{"nombre": "Prat", "faccion": "chile"}, {"nombre": "IA", "faccion": "peru"}],
			"comandos": [[16, 0, {"c": "mover", "x": 100}]], "fin": 9600, "ganador": 1}
	_ok(Repeticiones.guardar_datos(JSON.parse_string(JSON.stringify(datos)), "20240101-120000-prueba", d) != "",
			"se guarda una repetición recibida por la red")
	_igual(Repeticiones.guardar_datos(datos, "../afuera", d), "", "un nombre que sale de la carpeta se rechaza")
	var lista := Repeticiones.listar(d)
	_igual(lista.size(), 1, "se lista")
	if lista.size() == 1:
		_igual(lista[0]["minutos"], 10.0, "con su duración")
		_igual(lista[0]["jugadores"][0], "Prat (chile)", "y sus ejércitos")
	var leida: Variant = Repeticiones.leer(d.path_join("20240101-120000-prueba.rep"))
	_ok(leida != null and leida["semilla"] is float and int(leida["semilla"]) == 1879, "se lee el gzip de vuelta")
	# lo que se guardó tiene los enteros como enteros (lo lee Python)
	var texto := FileAccess.get_file_as_bytes(d.path_join("20240101-120000-prueba.rep")) \
			.decompress_dynamic(-1, FileAccess.COMPRESSION_GZIP).get_string_from_utf8()
	_ok('"semilla":1879' in texto and '"fin":9600' in texto, "los enteros se guardan como enteros")
	_ok(Repeticiones.borrar("20240101-120000-prueba", d), "se borra")
	_igual(Repeticiones.listar(d).size(), 0, "y ya no está")
	_borrar_dir(d)


func _prueba_mapas_y_banderas() -> void:
	var dir_rts := ProjectSettings.globalize_path("res://").rstrip("/").get_base_dir()
	var lista := Mapas.listar(dir_rts)
	_ok(lista.size() >= 5, "se listan los mapas del juego")
	var d: Variant = Mapas.buscar(dir_rts, "pampa_del_tamarugal")
	_ok(d != null, "se carga un mapa por su id")
	if d != null:
		var tex := Mapas.previa(cat, d, 3)
		_igual(tex.get_size(), Vector2(int(d["ancho"]) * 3, int(d["alto"]) * 3), "la vista previa tiene el tamaño del mapa")
		var ini: Array = d["inicios"][0]
		var img := tex.get_image()
		_ok(img.get_pixel(int(ini[0]) * 3 + 3, int(ini[1]) * 3 + 3).r > 0.5, "los lugares de inicio se marcan en rojo")
	for n in ["chile", "peru", "bolivia", "argentina"]:
		var b := Banderas.imagen(n, 48, 32)
		_igual(Vector2i(b.get_width(), b.get_height()), Vector2i(48, 32), "bandera de %s" % n)
	var cl := Banderas.imagen("chile", 48, 32)
	_ok(cl.get_pixel(30, 24).r > 0.7 and cl.get_pixel(30, 24).b < 0.3, "Chile: rojo abajo")
	_ok(cl.get_pixel(4, 4).b > 0.5, "Chile: cantón azul")
	_ok(cl.get_pixel(8, 8).r > 0.8 and cl.get_pixel(8, 8).g > 0.8, "Chile: la estrella blanca en el cantón")
	var pe := Banderas.imagen("peru", 48, 32)
	_ok(pe.get_pixel(24, 16).g > 0.9 and pe.get_pixel(4, 16).g < 0.2, "Perú: blanco al centro y rojo a los lados")


func _prueba_campana() -> void:
	var campanas := Campanas.cargar(_dir_datos())
	_ok(campanas.has("salitre"), "se carga la campaña del Salitre")
	if not campanas.has("salitre"):
		return
	var c: Campanas.Campana = campanas["salitre"]
	_igual(c.etapas.size(), 4, "cuatro batallas")
	_igual(c.etapas[0].rival("chile"), "peru", "Chile pelea contra el Perú en Dolores")
	_igual(c.etapas[0].rival("peru"), "chile", "y el Perú contra Chile")
	_igual(c.medalla(100), "Medalla de oro de la campaña", "con cien honores, la de oro")
	_igual(c.medalla(3), "Medalla de bronce de la campaña", "con pocos, la de bronce")
	var est := Campanas.nuevo_estado(c, "chile")
	var propio := {"veteranos": [{"tipo": "infante", "grado": 2, "xp": 5000, "nombre": 77, "bajas": 3},
			{"tipo": "infante", "grado": 0, "xp": 10}, {"tipo": "trabajador", "grado": 1}],
			"caidos": [{"tipo": "granadero", "grado": 1, "nombre": 5}]}
	var r := Campanas.aplicar_batalla(cat, c, est, propio, null, true, 9.96)
	_ok(r["victoria"] and r["supervivientes"] == 1 and r["nuevos"] == 1 and r["caidos"] == 1,
			"la victoria pasa los veteranos al escalafón y los caídos al libro")
	_igual(r["minutos"], 10.0, "los minutos con un decimal")
	_igual(est["escalafon"][0]["ficha"], "v1", "el veterano nuevo recibe su ficha")
	_igual(est["etapa"], 1, "se avanza a la batalla siguiente")
	_igual(r["honores"], 10 + 3, "honores: la victoria y el veterano según su grado")
	var nucleo := Campanas.veteranos_rival(cat, c, est, c.etapas[1])
	_igual(nucleo.size(), 4, "la IA empieza Tarapacá con su núcleo de veteranos")
	_ok(int(nucleo[0]["xp"]) > 0 and int(nucleo[0]["batallas"]) == 1, "con la experiencia de su grado")
	var r2 := Campanas.aplicar_batalla(cat, c, est, {}, null, false, 3.0)
	_ok(not r2["victoria"] and est["etapa"] == 1, "la derrota no avanza: la batalla se repite")
	var nombres := Nombres.new()
	nombres.cargar(_dir_datos())
	var n := nombres.nombre(cat, "chile", cat.tipos_por_id["infante"], 2, 123456)
	_ok(n.begins_with("Cabo "), "un veterano de grado 2 es cabo: " + n)
	_igual(nombres.nombre(cat, "chile", cat.tipos_por_id["infante"], 2, 0), "", "sin semilla no hay nombre")


func _campanas_cruzada(entrada: String, salida: String) -> int:
	var casos: Variant = JSON.parse_string(FileAccess.get_file_as_string(entrada))
	var campanas := Campanas.cargar(_dir_datos())
	var out: Array = []
	for caso in casos:
		var c: Campanas.Campana = campanas[caso["campana"]]
		var est: Dictionary = caso["estado"]
		var etapa: Campanas.Etapa = c.etapas[int(est["etapa"])]
		var rival_ini := Campanas.veteranos_rival(cat, c, est, etapa)
		var r := Campanas.aplicar_batalla(cat, c, est, caso["propio"], caso["rival"], bool(caso["victoria"]),
				float(caso["minutos"]))
		out.append({"estado": est, "resumen": r, "rival_ini": rival_ini})
	var f := FileAccess.open(salida, FileAccess.WRITE)
	f.store_string(JSON.stringify(Rutas.enteros(out)))
	f.close()
	return 0


func _nombres_cruzada(entrada: String, salida: String) -> int:
	var casos: Variant = JSON.parse_string(FileAccess.get_file_as_string(entrada))
	var nombres := Nombres.new()
	nombres.cargar(_dir_datos())
	var out: Array = []
	for caso in casos:
		out.append(nombres.nombre(cat, caso[0], cat.tipos_por_id[caso[1]], int(caso[2]), int(caso[3]), bool(caso[4])))
	var f := FileAccess.open(salida, FileAccess.WRITE)
	f.store_string(JSON.stringify(out))
	f.close()
	return 0


# ----------------------------------------------------------------------
# Fase 4: el juego instalado (carpetas de PyInstaller y de la aplicación de macOS)

func _arbol(raiz: String, rutas: Array) -> void:
	for r in rutas:
		var ruta: String = raiz.path_join(r)
		if r.ends_with("/"):
			DirAccess.make_dir_recursive_absolute(ruta)
		else:
			DirAccess.make_dir_recursive_absolute(ruta.get_base_dir())
			FileAccess.open(ruta, FileAccess.WRITE).store_string("x")


func _borrar_arbol(d: String) -> void:
	for sub in DirAccess.get_directories_at(d):
		_borrar_arbol(d.path_join(sub))
	_borrar_dir(d)


func _prueba_instalacion() -> void:
	var d := _dir_prueba("instalacion")
	# Windows y Linux: PyInstaller 6 deja los datos en _internal/, junto a los ejecutables
	var carpeta := d.path_join("GuerraDelPacifico")
	_arbol(carpeta, ["GuerraDelPacifico.exe", "GuerraDelPacificoClasico.exe", "ServidorSalitre.exe",
			"_internal/datos/", "_internal/mapas/", "_internal/recursos/"])
	_igual(Rutas.dir_juego_instalado(carpeta), carpeta.path_join("_internal"), "los datos de PyInstaller, en _internal")
	_igual(Rutas.ejecutable_hermano("ServidorSalitre", carpeta, true), carpeta.path_join("ServidorSalitre.exe"),
			"el servidor junto al cliente 3D, en Windows")
	_igual(Rutas.ejecutable_hermano("GuerraDelPacificoClasico", carpeta, true),
			carpeta.path_join("GuerraDelPacificoClasico.exe"), "y la versión clásica")
	_igual(Rutas.ejecutable_hermano("ServidorSalitre", carpeta, false), "", "sin .exe no es el de Windows")
	# macOS: el ejecutable en Contents/MacOS y los datos en Contents/Resources
	var app := d.path_join("Guerra del Pacífico.app/Contents")
	_arbol(app, ["MacOS/GuerraDelPacifico", "MacOS/ServidorSalitre", "Resources/datos/", "Resources/recursos/",
			"Frameworks/"])
	_igual(Rutas.dir_juego_instalado(app.path_join("MacOS")), app.path_join("Resources"),
			"los datos de la aplicación de macOS, en Contents/Resources")
	_igual(Rutas.ejecutable_hermano("ServidorSalitre", app.path_join("MacOS"), false),
			app.path_join("MacOS/ServidorSalitre"), "el servidor dentro de la aplicación")
	_igual(Rutas.ejecutable_hermano("GuerraDelPacificoClasico", app.path_join("MacOS"), false), "",
			"sin la versión clásica no hay botón")
	# una carpeta con los datos a la vista (como rts/ en las fuentes)
	var plana := d.path_join("plana")
	_arbol(plana, ["datos/", "recursos/"])
	_igual(Rutas.dir_juego_instalado(plana), plana, "los datos junto al ejecutable")
	var vacia := d.path_join("vacia")
	DirAccess.make_dir_recursive_absolute(vacia)
	_igual(Rutas.dir_juego_instalado(vacia), vacia, "sin datos queda la carpeta del ejecutable")
	_borrar_arbol(d)

