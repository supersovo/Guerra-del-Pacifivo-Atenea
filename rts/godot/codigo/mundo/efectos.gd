## Efectos pasajeros del combate: el fogonazo y la nube de pólvora negra de cada disparo,
## las granadas en vuelo, las explosiones, el polvo, las bajas que quedan en el campo, la
## sangre, las curaciones y los letreros que suben (venta de salitre, ascensos).
extends Node3D

const Modelos = preload("res://codigo/mundo/modelos.gd")

const MAX_EFECTOS := 900

var limite := MAX_EFECTOS      # menos con la calidad gráfica baja

var sangre := true
var viento := Vector3.ZERO       # hacia dónde corre el humo (unidades por segundo)
var _vivos: Array = []          # [nodo, edad, vida, tipo, datos]
var _esfera: SphereMesh
var _cuadro: QuadMesh
var _mat := {}
const NUBES := ["humo", "humo_oscuro", "humo_gris", "polvo", "fuego", "fogonazo", "espuma", "llama"]


func _ready() -> void:
	name = "Efectos"
	_esfera = SphereMesh.new()
	_esfera.radius = 1.0
	_esfera.height = 2.0
	_esfera.radial_segments = 8
	_esfera.rings = 4
	_cuadro = QuadMesh.new()
	_cuadro.size = Vector2(2, 2)
	# el humo, el polvo y el fuego son nubes de bordes suaves que miran siempre a la cámara
	var degradado := Gradient.new()
	degradado.set_color(0, Color(1, 1, 1, 1))
	degradado.set_color(1, Color(1, 1, 1, 0))
	degradado.add_point(0.45, Color(1, 1, 1, 0.7))
	var nube := GradientTexture2D.new()
	nube.gradient = degradado
	nube.fill = GradientTexture2D.FILL_RADIAL
	nube.fill_from = Vector2(0.5, 0.5)
	nube.fill_to = Vector2(0.5, 0.0)
	nube.width = 64
	nube.height = 64
	_mat["humo"] = _material_nube(nube, Color(0.93, 0.92, 0.89, 0.8), false)
	_mat["humo_gris"] = _material_nube(nube, Color(0.6, 0.58, 0.56, 0.7), false)
	_mat["espuma"] = _material_nube(nube, Color(0.9, 0.95, 0.97, 0.85), false)
	_mat["llama"] = _material_nube(nube, Color(1.0, 0.55, 0.15, 1.0), true)
	_mat["humo_oscuro"] = _material_nube(nube, Color(0.32, 0.29, 0.26, 0.75), false)
	_mat["polvo"] = _material_nube(nube, Color(0.77, 0.67, 0.5, 0.7), false)
	_mat["fuego"] = _material_nube(nube, Color(1.0, 0.72, 0.32, 1.0), true)
	_mat["fogonazo"] = _material_nube(nube, Color(1.0, 0.9, 0.6, 1.0), true)
	_mat["bala"] = _material(Color8(30, 28, 26))
	_mat["dinamita"] = _material(Color8(198, 42, 34))
	_mat["tierra"] = _material(Color8(120, 96, 70))


func _material(color: Color) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	m.roughness = 1.0
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	return m


func _material_nube(textura: Texture2D, color: Color, brilla: bool) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_texture = textura
	m.albedo_color = color
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	m.billboard_keep_scale = true
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	if brilla:
		m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	return m


func _bola(tipo_mat: String, pos: Vector3, radio: float) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = _cuadro if tipo_mat in NUBES else _esfera
	mi.material_override = _mat[tipo_mat]
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mi.position = pos
	mi.scale = Vector3.ONE * radio
	add_child(mi)
	return mi


func _agregar(nodo: Node3D, vida: float, tipo: String, datos := {}) -> void:
	if _vivos.size() >= limite:
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
	_agregar(_bola("fogonazo", boca, 0.07 if not grande else 0.16), 0.08, "destello")
	var n := 1 if not grande else 3
	for k in n:
		var p := boca + d * (0.04 + 0.1 * k) + Vector3(randf_range(-0.04, 0.04), randf_range(0.0, 0.05), randf_range(-0.04, 0.04))
		var r := randf_range(0.05, 0.08) * (1.0 if not grande else 2.0)
		_agregar(_bola("humo", p, r), randf_range(1.1, 1.7) * (1.0 if not grande else 1.4), "humo",
				{"crece": r * 1.8, "sube": 0.16, "deriva": d * 0.06})


## Impacto de una bala (polvillo).
func impacto(pos: Vector3) -> void:
	_agregar(_bola("polvo", pos + Vector3(0, 0.04, 0), 0.03), 0.45, "humo", {"crece": 0.07, "sube": 0.1})


## Granada o bala de cañón en vuelo (parábola de 'dur' segundos).
func lanzar(desde: Vector3, hasta: Vector3, dur: float, tipo: String) -> void:
	var mi := _bola("dinamita" if tipo == "dinamita" else "bala", desde, 0.05 if tipo != "dinamita" else 0.04)
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	var altura := clampf(desde.distance_to(hasta) * 0.25, 0.6, 5.0)
	_agregar(mi, dur, "vuelo", {"desde": desde, "hasta": hasta, "altura": altura})


func explosion(pos: Vector3, radio: float, tipo := "") -> void:
	var r := clampf(radio, 0.3, 2.0)
	_agregar(_bola("fuego", pos + Vector3(0, 0.15, 0), r * 0.35), 0.22, "destello")
	for k in 4:
		var p := pos + Vector3(randf_range(-r, r) * 0.25, randf_range(0.05, 0.25), randf_range(-r, r) * 0.25)
		_agregar(_bola("humo_oscuro" if k % 2 == 0 else "polvo", p, r * randf_range(0.14, 0.22)), randf_range(1.6, 2.6), "humo",
				{"crece": r * 0.35, "sube": 0.3})
	# tierra levantada
	for k in 8:
		var a := TAU * k / 8.0
		var p := pos + Vector3(cos(a), 0, sin(a)) * r * 0.2
		_agregar(_bola("tierra", p, 0.03), 0.6, "chispa", {"vel": Vector3(cos(a) * 1.2, randf_range(1.4, 2.4), sin(a) * 1.2) * r * 0.7})
	var crater := MeshInstance3D.new()
	crater.mesh = Modelos.mancha(Color(0.3, 0.24, 0.18, 0.55))
	crater.position = pos + Vector3(0, 0.025, 0)
	crater.scale = Vector3(r * 0.22, 1, r * 0.22)
	crater.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(crater)
	_agregar(crater, 30.0, "mancha")


func polvo(pos: Vector3, n := 3) -> void:
	for k in n:
		var p := pos + Vector3(randf_range(-0.2, 0.2), 0.05, randf_range(-0.2, 0.2))
		_agregar(_bola("polvo", p, randf_range(0.08, 0.14)), randf_range(0.8, 1.4), "humo", {"crece": 0.35, "sube": 0.12})


## Baja: la figura (de pie, sin peana) cae de espaldas, queda tendida en el campo y se
## hunde en la tierra al cabo de un rato.
func caido(malla: Mesh, pos: Vector3, rumbo: float, escala: float, con_sangre: bool) -> void:
	var raiz := Node3D.new()
	raiz.position = pos
	raiz.rotation.y = rumbo
	add_child(raiz)
	var mi := MeshInstance3D.new()
	mi.mesh = malla
	mi.scale = Vector3.ONE * escala
	raiz.add_child(mi)
	_agregar(raiz, 40.0, "caido", {"figura": mi, "lado": 1.0 if randf() < 0.75 else -1.0})
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


## Humo de una chimenea (la maestranza, la locomotora): sube despacio y se lo lleva el viento.
func humo_chimenea(pos: Vector3, oscuro := false) -> void:
	var r := randf_range(0.07, 0.11)
	_agregar(_bola("humo_gris" if oscuro else "humo", pos + Vector3(randf_range(-0.03, 0.03), 0, randf_range(-0.03, 0.03)), r),
			randf_range(2.5, 3.5), "humo", {"crece": 0.35, "sube": 0.35, "viento": 1.0})


## Humo negro (y llamas, si la obra está muy dañada) de un edificio herido.
func humo_dano(pos: Vector3, llamas: bool) -> void:
	_agregar(_bola("humo_oscuro", pos, randf_range(0.12, 0.2)), randf_range(2.4, 3.6), "humo",
			{"crece": 0.5, "sube": 0.45, "viento": 1.0})
	if llamas:
		_agregar(_bola("llama", pos + Vector3(randf_range(-0.15, 0.15), -0.05, randf_range(-0.15, 0.15)), randf_range(0.09, 0.16)),
				randf_range(0.35, 0.6), "llama")


## Polvo que levantan los cascos y las ruedas.
func polvo_marcha(pos: Vector3) -> void:
	_agregar(_bola("polvo", pos + Vector3(randf_range(-0.1, 0.1), 0.06, randf_range(-0.1, 0.1)), randf_range(0.06, 0.1)),
			randf_range(0.9, 1.4), "humo", {"crece": 0.22, "sube": 0.06, "viento": 0.6})


## Espuma de la estela de un buque.
func estela(pos: Vector3) -> void:
	var m := MeshInstance3D.new()
	m.mesh = Modelos.mancha(Color(0.92, 0.96, 0.98, 0.6))
	m.position = pos
	m.scale = Vector3(0.12, 1, 0.12)
	m.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(m)
	_agregar(m, 2.2, "estela")


## Pique de una granada en el agua: una columna de espuma que sube y cae.
func pique(pos: Vector3, radio: float) -> void:
	var r := clampf(radio, 0.3, 2.0)
	for k in 7:
		var p := pos + Vector3(randf_range(-0.12, 0.12), 0.05, randf_range(-0.12, 0.12)) * r
		_agregar(_bola("espuma", p, r * randf_range(0.1, 0.16)), randf_range(0.8, 1.3), "chispa",
				{"vel": Vector3(randf_range(-0.4, 0.4), randf_range(2.2, 3.4), randf_range(-0.4, 0.4)) * r})
	estela(pos)


## Remolino de polvo de la pampa: una columna que gira y anda con el viento.
func remolino(pos: Vector3) -> void:
	var raiz := Node3D.new()
	raiz.position = pos
	add_child(raiz)
	for k in 9:
		var mi := MeshInstance3D.new()
		mi.mesh = _cuadro
		mi.material_override = _mat["polvo"]
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		mi.scale = Vector3.ONE * (0.12 + 0.05 * k)
		raiz.add_child(mi)
	_agregar(raiz, randf_range(7.0, 11.0), "remolino", {"giro": randf() * TAU})


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
				nodo.scale = Vector3(r, r, r)
				nodo.position.y += float(datos.get("sube", 0.1)) * delta
				if datos.has("deriva"):
					nodo.position += (datos["deriva"] as Vector3) * delta * (1.0 - f)
				nodo.position += viento * float(datos.get("viento", 0.5)) * delta
				(nodo as GeometryInstance3D).transparency = 0.15 + 0.85 * f
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
				(nodo as GeometryInstance3D).transparency = f * f
			"caido":
				# cae en 0,45 s, con un golpe al dar contra el suelo
				var cae := clampf(edad / 0.45, 0.0, 1.0)
				var giro := cae * cae * PI / 2.0
				if cae >= 1.0:
					giro = PI / 2.0 - 0.05 * sin(clampf((edad - 0.45) / 0.15, 0.0, 1.0) * PI)
				var figura: Node3D = datos["figura"]
				figura.rotation.z = giro * float(datos["lado"])
				figura.position.y = 0.04 * sin(cae * PI / 2.0)
				if f > 0.85:
					nodo.position.y -= delta * 0.08
			"mancha":
				if f > 0.8:
					(nodo as GeometryInstance3D).transparency = (f - 0.8) / 0.2
			"marca":
				var r := 0.15 + 0.45 * (1.0 - f)
				nodo.scale = Vector3(r, 1, r)
				(nodo as GeometryInstance3D).transparency = f
			"llama":
				var r := (0.6 + 0.4 * sin(edad * 40.0 + nodo.position.x * 9.0)) * (1.0 - f * 0.5)
				nodo.scale = Vector3(1, 1.5, 1) * 0.13 * r
				nodo.position.y += delta * 0.25
				(nodo as GeometryInstance3D).transparency = f * f
			"estela":
				var r := 0.12 + 0.35 * f
				nodo.scale = Vector3(r, 1, r)
				(nodo as GeometryInstance3D).transparency = 0.3 + 0.7 * f
			"remolino":
				# las nubecitas giran alrededor de un eje que sube, y el remolino anda con el viento
				datos["giro"] = float(datos["giro"]) + delta * 5.0
				var fuerza := sin(f * PI)
				var hijos := nodo.get_children()
				for k in hijos.size():
					var h: GeometryInstance3D = hijos[k]
					var a := float(datos["giro"]) + k * 1.7
					var alto := 0.1 + k * 0.17
					var rad := 0.08 + k * 0.035
					h.position = Vector3(cos(a) * rad, alto, sin(a) * rad)
					h.transparency = 1.0 - fuerza * (0.75 - k * 0.05)
				nodo.position += (viento * 1.6 + Vector3(sin(edad * 0.7), 0, cos(edad * 0.5)) * 0.15) * delta
			"letrero":
				nodo.position.y += delta * 0.5
				(nodo as Label3D).modulate.a = 1.0 - f * f
		quedan.append(v)
	_vivos = quedan
