## Pruebas del cliente de Godot (sin pantalla):
##
##   godot --headless --path rts/godot -s res://pruebas/correr.gd
##
## Sale con 0 si todo pasa (o con el número de fallas). Con
## «-- --vision=entrada.json --salida=salida.json» calcula la niebla de un caso que arma
## tests/test_godot.py con la simulación de Python, para comparar las dos.
extends SceneTree

const Protocolo = preload("res://codigo/red/protocolo.gd")
const Vision = preload("res://codigo/batalla/vision.gd")
const Estado = preload("res://codigo/batalla/estado.gd")
const Catalogo = preload("res://codigo/datos/catalogo.gd")
const Terreno = preload("res://codigo/mundo/terreno.gd")
const Modelos = preload("res://codigo/mundo/modelos.gd")
const Tarjeta = preload("res://codigo/ui/tarjeta.gd")

var fallas := 0
var pruebas := 0
var cat: Catalogo


func _initialize() -> void:
	var args := OS.get_cmdline_user_args()
	var entrada := ""
	var salida := ""
	for a in args:
		if a.begins_with("--vision="):
			entrada = a.trim_prefix("--vision=")
		elif a.begins_with("--salida="):
			salida = a.trim_prefix("--salida=")
	if entrada != "":
		quit(_vision_cruzada(entrada, salida))
		return
	cat = Catalogo.new()
	_ok(cat.cargar(), "se carga el catálogo")
	for prueba in ["protocolo", "lector_por_trozos", "vision", "estado", "terreno", "tarjeta", "modelos", "lugar_costo"]:
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
