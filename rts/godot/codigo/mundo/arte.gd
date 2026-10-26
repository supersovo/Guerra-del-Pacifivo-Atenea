## El arte hecho fuera del juego: retratos y modelos 3D animados que reemplazan a las figuras
## generadas por código (arte/LEEME.md explica cómo agregarlos). Lo que no está se sigue
## dibujando como siempre.
##
##   arte/retratos/<tipo>_<nación>.png            o <tipo>.png, para todas las naciones
##   arte/unidades/<forma>/<forma>_<nación>.glb   o <forma>.glb, con un .json opcional al lado
##
## El .json del modelo (todo es optativo):
##   "alto": alto de la figura en casillas (por omisión, el de la figura del juego)
##   "giro": grados para que mire al frente del juego (por omisión 90: un glTF mira hacia +Z)
##   "animaciones": {"quieto": "Idle", "marcha": "Walk", "accion": "Heal", "muerte": "Death"}
##                  (sin ellas se buscan por nombres usuales: idle, walk, heal, fire, death...)
##   "marcha": casillas por segundo que avanza la animación de la marcha a velocidad 1
##   "brillo": reflejo especular de sus materiales, de 0 a 1 (por omisión 0,15: casi mate)
extends RefCounted

const DIR_RETRATOS := "res://arte/retratos/"
const DIR_UNIDADES := "res://arte/unidades/"
const ESTADOS := ["quieto", "marcha", "accion", "muerte"]
const EN_BUCLE := ["quieto", "marcha"]
const BRILLO := 0.15        # reflejo especular de los materiales (el .json puede pedir otro: "brillo")
const NOMBRES_USUALES := {
	"quieto": ["quieto", "idle", "stand", "breath", "reposo"],
	"marcha": ["marcha", "walk", "camina", "run", "corre"],
	"accion": ["accion", "curar", "heal", "give", "fuego", "fire", "shoot", "attack", "ataque", "action", "use"],
	"muerte": ["muerte", "death", "die", "dying", "muere"],
}

static var _retratos := {}
static var _modelos := {}
static var _registrados := {}       # forma|nación -> ruta de un modelo puesto a mano (las pruebas)


## El retrato de un tipo de unidad para esa nación, o null.
static func retrato(tipo: String, nacion: String) -> Texture2D:
	var clave := tipo + "|" + nacion
	if not _retratos.has(clave):
		var tex: Texture2D = null
		for nombre: String in [tipo + "_" + nacion, tipo]:
			var ruta := DIR_RETRATOS + nombre + ".png"
			if ResourceLoader.exists(ruta):
				tex = load(ruta)
				break
		_retratos[clave] = tex
	return _retratos[clave]


## Usa ese modelo para esa forma y nación (las pruebas); con ruta "" se quita.
static func registrar(forma: String, nacion: String, ruta: String) -> void:
	var clave := forma + "|" + nacion
	if ruta == "":
		_registrados.erase(clave)
	else:
		_registrados[clave] = ruta
	_modelos.erase(clave)


## El modelo de esa forma y nación ({ruta, escena, caja, alto, pie, giro, animaciones, marcha}), o {}
## si no hay. alto_juego: el alto de la figura del juego, si el .json no dice otro.
static func modelo(forma: String, nacion: String, alto_juego := 1.0) -> Dictionary:
	var clave := forma + "|" + nacion
	if not _modelos.has(clave):
		var ruta: String = _registrados.get(clave, "")
		if ruta == "":
			for nombre: String in [forma + "_" + nacion, forma]:
				var r := DIR_UNIDADES + forma + "/" + nombre + ".glb"
				if ResourceLoader.exists(r):
					ruta = r
					break
		_modelos[clave] = cargar(ruta, alto_juego) if ruta != "" else {}
	return _modelos[clave]


## Lee un modelo .glb (importado por Godot) con su .json: lo mide, elige sus animaciones y deja
## en bucle las de estar quieto y marchar.
static func cargar(ruta: String, alto_juego := 1.0) -> Dictionary:
	var escena: PackedScene = load(ruta) if ResourceLoader.exists(ruta) else null
	if escena == null:
		push_warning("No se pudo cargar el modelo %s" % ruta)
		return {}
	var conf := {}
	var ruta_json := ruta.get_basename() + ".json"
	if FileAccess.file_exists(ruta_json):
		var v: Variant = JSON.parse_string(FileAccess.get_file_as_string(ruta_json))
		if v is Dictionary:
			conf = v
		else:
			push_warning("El archivo %s no es un JSON válido" % ruta_json)
	var muestra: Node = escena.instantiate()
	_mate(muestra, float(conf.get("brillo", BRILLO)))
	var caja := _caja(muestra, Transform3D())
	var rep := reproductor(muestra)
	var nombres := rep.get_animation_list() if rep != null else PackedStringArray()
	var pedidas: Dictionary = conf.get("animaciones", {})
	var animaciones := {}
	for estado in ESTADOS:
		var nombre := str(pedidas.get(estado, ""))
		if nombre == "":
			nombre = _usual(estado, nombres)
		if nombre != "" and nombre in nombres:
			animaciones[estado] = nombre
			if estado in EN_BUCLE:
				rep.get_animation(nombre).loop_mode = Animation.LOOP_LINEAR
	var alto := float(conf.get("alto", alto_juego))
	var distancias := PackedFloat32Array()
	_al_pie(muestra, Transform3D(), caja, distancias)
	distancias.sort()
	var pie := distancias[int(distancias.size() * 0.85)] if not distancias.is_empty() else 0.0
	muestra.free()
	return {"ruta": ruta, "escena": escena, "caja": caja, "alto": alto,
			"pie": pie * alto / maxf(caja.size.y, 0.0001),
			"giro": deg_to_rad(float(conf.get("giro", 90.0))), "animaciones": animaciones,
			"marcha": maxf(0.05, float(conf.get("marcha", 1.0)))}


## Una figura lista para el campo: el modelo con el alto pedido, de frente hacia +X (el frente
## del juego) y con los pies en el origen. Guarda su reproductor y su alto en metadatos.
static func instanciar(m: Dictionary) -> Node3D:
	var figura := Node3D.new()
	var ajuste := Node3D.new()
	var caja: AABB = m["caja"]
	var escala := float(m["alto"]) / maxf(caja.size.y, 0.0001)
	ajuste.basis = Basis(Vector3.UP, float(m["giro"])).scaled(Vector3.ONE * escala)
	var modelo: Node = m["escena"].instantiate()
	if modelo is Node3D:
		var centro := caja.get_center()
		(modelo as Node3D).position -= Vector3(centro.x, caja.position.y, centro.z)
	ajuste.add_child(modelo)
	figura.add_child(ajuste)
	figura.set_meta("reproductor", reproductor(modelo))
	figura.set_meta("alto", float(m["alto"]))
	figura.set_meta("estado", "")
	return figura


## Pone la animación de ese estado (quieto, marcha, accion, muerte) con un fundido; lo que el
## modelo no trae se reemplaza por la de estar quieto. velocidad: la de la marcha.
static func animar(figura: Node3D, m: Dictionary, estado: String, velocidad := 1.0) -> void:
	var rep: AnimationPlayer = figura.get_meta("reproductor") if figura.has_meta("reproductor") else null
	var animaciones: Dictionary = m["animaciones"]
	var e := estado if animaciones.has(estado) else ("quieto" if animaciones.has("quieto") else "")
	if rep == null or e == "":
		return
	rep.speed_scale = velocidad if e == "marcha" else 1.0
	if figura.get_meta("estado") != e:
		figura.set_meta("estado", e)
		rep.play(animaciones[e], 0.2)


## Lo ancho de la figura ya instanciada (en casillas), para encuadrarla.
static func ancho(m: Dictionary) -> float:
	var caja: AABB = m["caja"]
	return maxf(caja.size.x, caja.size.z) * float(m["alto"]) / maxf(caja.size.y, 0.0001)


## El primer reproductor de animaciones del modelo, o null.
static func reproductor(nodo: Node) -> AnimationPlayer:
	if nodo is AnimationPlayer:
		return nodo as AnimationPlayer
	var hallados := nodo.find_children("*", "AnimationPlayer", true, false)
	return hallados[0] as AnimationPlayer if not hallados.is_empty() else null


## La caja que ocupan las mallas del modelo, en el espacio de su padre.
static func _caja(nodo: Node, tf: Transform3D) -> AABB:
	var propio := tf * (nodo as Node3D).transform if nodo is Node3D else tf
	var caja := AABB()
	var hay := false
	var mi := nodo as MeshInstance3D
	if mi != null and mi.mesh != null:
		caja = propio * mi.mesh.get_aabb()
		hay = true
	for hijo in nodo.get_children():
		var c := _caja(hijo, propio)
		if c.size != Vector3.ZERO:
			caja = c if not hay else caja.merge(c)
			hay = true
	return caja


## Les quita el brillo a los materiales del modelo (son del modelo importado, los comparten
## todas sus figuras): la pintura ya trae su luz, y un reflejo encima la destiñe al sol.
static func _mate(nodo: Node, brillo: float) -> void:
	var mi := nodo as MeshInstance3D
	if mi != null and mi.mesh != null:
		for s in mi.mesh.get_surface_count():
			var mat := mi.mesh.surface_get_material(s) as BaseMaterial3D
			if mat != null:
				mat.metallic_specular = minf(mat.metallic_specular, brillo)
				mat.roughness = maxf(mat.roughness, 0.95)
	for hijo in nodo.get_children():
		_mate(hijo, brillo)


## Lo que la figura ocupa cerca del suelo (el tercio de abajo: pies, falda): las distancias
## de sus vértices al centro de la caja, en el plano. La peana tiene que asomar más allá.
static func _al_pie(nodo: Node, tf: Transform3D, caja: AABB, distancias: PackedFloat32Array) -> void:
	var propio := tf * (nodo as Node3D).transform if nodo is Node3D else tf
	var mi := nodo as MeshInstance3D
	if mi != null and mi.mesh != null:
		var tope := caja.position.y + caja.size.y * 0.3
		var centro := caja.get_center()
		for s in mi.mesh.get_surface_count():
			var vertices: PackedVector3Array = mi.mesh.surface_get_arrays(s)[Mesh.ARRAY_VERTEX]
			for v in vertices:
				var q := propio * v
				if q.y < tope:
					distancias.append(Vector2(q.x - centro.x, q.z - centro.z).length())
	for hijo in nodo.get_children():
		_al_pie(hijo, propio, caja, distancias)


static func _usual(estado: String, nombres: PackedStringArray) -> String:
	for buscado: String in NOMBRES_USUALES[estado]:
		for n in nombres:
			if n.to_lower().contains(buscado):
				return n
	return ""
