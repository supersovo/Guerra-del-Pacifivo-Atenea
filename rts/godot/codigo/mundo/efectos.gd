## Efectos pasajeros del combate: el fogonazo y la nube de pólvora negra de cada disparo,
## las granadas en vuelo, las explosiones, el polvo, las bajas que quedan en el campo, la
## sangre, las curaciones y los letreros que suben (venta de salitre, ascensos).
extends Node3D

const Modelos = preload("res://codigo/mundo/modelos.gd")

const MAX_EFECTOS := 900

var sangre := true
var _vivos: Array = []          # [nodo, edad, vida, tipo, datos]
var _esfera: SphereMesh
var _mat := {}


func _ready() -> void:
	name = "Efectos"
	_esfera = SphereMesh.new()
	_esfera.radius = 1.0
	_esfera.height = 2.0
	_esfera.radial_segments = 8
	_esfera.rings = 4
	_mat["humo"] = _material(Color8(236, 232, 224), false)
	_mat["humo_oscuro"] = _material(Color8(70, 64, 58), false)
	_mat["polvo"] = _material(Color8(196, 170, 128), false)
	_mat["fuego"] = _material(Color8(255, 196, 90), true)
	_mat["fogonazo"] = _material(Color8(255, 236, 160), true)
	_mat["bala"] = _material(Color8(30, 28, 26), false, false)
	_mat["dinamita"] = _material(Color8(198, 42, 34), false, false)


func _material(color: Color, brilla: bool, transparente := true) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	m.roughness = 1.0
	if transparente:
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	if brilla:
		m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		m.emission_enabled = true
		m.emission = color
		m.emission_energy_multiplier = 2.0
	return m


func _bola(tipo_mat: String, pos: Vector3, radio: float) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = _esfera
	mi.material_override = _mat[tipo_mat]
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mi.position = pos
	mi.scale = Vector3.ONE * radio
	add_child(mi)
	return mi


func _agregar(nodo: Node3D, vida: float, tipo: String, datos := {}) -> void:
	if _vivos.size() >= MAX_EFECTOS:
		var viejo: Array = _vivos.pop_front()
		viejo[0].queue_free()
	_vivos.append([nodo, 0.0, vida, tipo, datos])


# ----------------------------------------------------------------------
# Efectos

## Fogonazo y nube de pólvora negra en la boca del arma (dir: hacia el blanco).
func disparo(desde: Vector3, dir: Vector3, tipo: String) -> void:
	var d := dir.normalized() if dir.length() > 0.001 else Vector3.RIGHT
	var boca := desde + Vector3(0, 0.42, 0) + d * 0.22
	var grande := tipo in ["explosivo", "canon_naval"]
	_agregar(_bola("fogonazo", boca, 0.09 if not grande else 0.22), 0.09, "destello")
	var n := 1 if not grande else 4
	for k in n:
		var p := boca + d * (0.05 + 0.12 * k) + Vector3(randf_range(-0.05, 0.05), randf_range(0.0, 0.06), randf_range(-0.05, 0.05))
		var r := randf_range(0.08, 0.12) * (1.0 if not grande else 2.4)
		_agregar(_bola("humo", p, r), randf_range(1.4, 2.2) * (1.0 if not grande else 1.6), "humo",
				{"crece": r * 2.6, "sube": 0.18, "deriva": d * 0.08})


## Impacto de una bala (polvillo).
func impacto(pos: Vector3) -> void:
	_agregar(_bola("polvo", pos + Vector3(0, 0.05, 0), 0.04), 0.5, "humo", {"crece": 0.12, "sube": 0.1})


## Granada o bala de cañón en vuelo (parábola de 'dur' segundos).
func lanzar(desde: Vector3, hasta: Vector3, dur: float, tipo: String) -> void:
	var mi := _bola("dinamita" if tipo == "dinamita" else "bala", desde, 0.05 if tipo != "dinamita" else 0.04)
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	var altura := clampf(desde.distance_to(hasta) * 0.25, 0.6, 5.0)
	_agregar(mi, dur, "vuelo", {"desde": desde, "hasta": hasta, "altura": altura})


func explosion(pos: Vector3, radio: float, tipo := "") -> void:
	var r := clampf(radio, 0.4, 3.0)
	_agregar(_bola("fuego", pos + Vector3(0, 0.15, 0), r * 0.45), 0.25, "destello")
	for k in 6:
		var p := pos + Vector3(randf_range(-r, r) * 0.4, randf_range(0.0, 0.3), randf_range(-r, r) * 0.4)
		_agregar(_bola("humo_oscuro" if k % 2 == 0 else "polvo", p, r * randf_range(0.2, 0.35)), randf_range(1.6, 3.0), "humo",
				{"crece": r * 0.9, "sube": 0.35})
	# tierra levantada
	for k in 8:
		var a := TAU * k / 8.0
		var p := pos + Vector3(cos(a), 0, sin(a)) * r * 0.25
		_agregar(_bola("polvo", p, 0.05), 0.7, "chispa", {"vel": Vector3(cos(a) * 1.4, randf_range(1.5, 2.6), sin(a) * 1.4) * r * 0.8})
	var crater := MeshInstance3D.new()
	crater.mesh = Modelos.mancha(Color(0.2, 0.16, 0.12, 0.7))
	crater.position = pos + Vector3(0, 0.025, 0)
	crater.scale = Vector3(r * 0.45, 1, r * 0.45)
	crater.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(crater)
	_agregar(crater, 30.0, "mancha")


func polvo(pos: Vector3, n := 3) -> void:
	for k in n:
		var p := pos + Vector3(randf_range(-0.2, 0.2), 0.05, randf_range(-0.2, 0.2))
		_agregar(_bola("polvo", p, randf_range(0.08, 0.14)), randf_range(0.8, 1.4), "humo", {"crece": 0.35, "sube": 0.12})


## Baja: la figura queda tendida en el campo y se hunde en la tierra al cabo de un rato.
func caido(malla: Mesh, pos: Vector3, rumbo: float, con_sangre: bool) -> void:
	var mi := MeshInstance3D.new()
	mi.mesh = malla
	mi.position = pos
	mi.rotation.y = rumbo
	add_child(mi)
	_agregar(mi, 40.0, "caido")
	if con_sangre and sangre:
		mancha_sangre(pos, 0.2)


func mancha_sangre(pos: Vector3, radio: float) -> void:
	var m := MeshInstance3D.new()
	m.mesh = Modelos.mancha(Color(0.42, 0.03, 0.02, 0.8))
	m.position = pos + Vector3(randf_range(-0.05, 0.05), 0.022, randf_range(-0.05, 0.05))
	m.scale = Vector3(radio, 1, radio * 0.75)
	m.rotation.y = randf() * TAU
	m.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(m)
	_agregar(m, 45.0, "mancha")


## Letrero que sube y se desvanece (venta de salitre, ascensos, curaciones).
func letrero(pos: Vector3, texto: String, color: Color, tam := 64) -> void:
	var l := Label3D.new()
	l.text = texto
	l.modulate = color
	l.outline_modulate = Color(0, 0, 0, 0.8)
	l.font_size = tam
	l.outline_size = 10
	l.pixel_size = 0.004
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	l.no_depth_test = true
	l.position = pos
	add_child(l)
	_agregar(l, 1.6, "letrero")


## Marca de una orden en el suelo: un anillo que se abre y se apaga.
func marca(pos: Vector3, color: Color) -> void:
	var mi := MeshInstance3D.new()
	mi.mesh = Modelos.anillo_seleccion(color)
	mi.position = pos + Vector3(0, 0.05, 0)
	mi.scale = Vector3(0.5, 1, 0.5)
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)
	_agregar(mi, 0.6, "marca")


func curacion(pos: Vector3) -> void:
	letrero(pos + Vector3(randf_range(-0.15, 0.15), 0.6, 0), "+", Color8(120, 230, 120), 72)


func _process(delta: float) -> void:
	var quedan: Array = []
	for v in _vivos:
		var nodo: Node3D = v[0]
		if not is_instance_valid(nodo):
			continue
		v[1] += delta
		var edad: float = v[1]
		var vida: float = v[2]
		if edad >= vida:
			nodo.queue_free()
			continue
		var f := edad / vida
		var datos: Dictionary = v[4]
		match v[3]:
			"destello":
				(nodo as GeometryInstance3D).transparency = f
			"humo":
				var crece: float = datos.get("crece", 0.3)
				var r0: float = nodo.get_meta("r0", nodo.scale.x)
				nodo.set_meta("r0", r0)
				var r := r0 + crece * (1.0 - pow(1.0 - f, 2.0))
				nodo.scale = Vector3(r, r * 0.85, r)
				nodo.position.y += float(datos.get("sube", 0.1)) * delta
				if datos.has("deriva"):
					nodo.position += (datos["deriva"] as Vector3) * delta * (1.0 - f)
				(nodo as GeometryInstance3D).transparency = 0.25 + 0.75 * f * f
			"vuelo":
				var a: Vector3 = datos["desde"]
				var b: Vector3 = datos["hasta"]
				var p := a.lerp(b, f)
				p.y += 4.0 * float(datos["altura"]) * f * (1.0 - f)
				nodo.position = p
			"chispa":
				var vel: Vector3 = datos["vel"]
				vel.y -= 9.0 * delta
				datos["vel"] = vel
				nodo.position += vel * delta
			"caido":
				if f > 0.85:
					nodo.position.y -= delta * 0.08
			"mancha":
				if f > 0.8:
					(nodo as GeometryInstance3D).transparency = (f - 0.8) / 0.2
			"marca":
				var r := 0.15 + 0.45 * (1.0 - f)
				nodo.scale = Vector3(r, 1, r)
				(nodo as GeometryInstance3D).transparency = f
			"letrero":
				nodo.position.y += delta * 0.5
				(nodo as Label3D).modulate.a = 1.0 - f * f
		quedan.append(v)
	_vivos = quedan
