## Terreno 3D del campo de batalla, armado a partir del mapa del juego.
##
## Una casilla mide 1 unidad del mundo (x hacia el este, z hacia el sur). Cada nivel de
## altura sube NIVEL; las rampas se alisan entre los niveles que unen; las rocas se
## levantan, las quebradas se hunden y el mar queda bajo el agua. Donde dos casillas
## vecinas no coinciden se levanta una pared (acantilado), y el borde del mapa baja
## hasta la base del diorama. La malla se arma por trozos de TROZO x TROZO casillas.
extends RefCounted

const Modelos = preload("res://codigo/mundo/modelos.gd")

const NIVEL := 0.8
const HONDO_QUEBRADA := 0.6
const ALTO_ROCA := 0.6
const FONDO_MAR := -0.6
const NIVEL_AGUA := -0.18
const BASE := -1.4
const TROZO := 32

const ARENA := 0
const PAMPA := 1
const SALAR := 2
const CAMINO := 3
const RAMPA := 4
const ROCA := 5
const TAMARUGO := 6
const QUEBRADA := 7
const MAR := 8
const RUINAS := 9

var w := 0
var h := 0
var terreno := PackedByteArray()
var niveles := PackedByteArray()
var colores: Dictionary = {}
var alto := PackedFloat32Array()         # altura base de cada casilla
var esquinas := PackedFloat32Array()     # 4 por casilla: NO, NE, SE, SO
var nodo := Node3D.new()
var material: ShaderMaterial
var tren := false
var semilla := 7


func _init(terreno_: PackedByteArray, niveles_: PackedByteArray, ancho: int, alto_: int, colores_: Dictionary,
		con_tren := false, semilla_ := 7) -> void:
	terreno = terreno_
	niveles = niveles_
	w = ancho
	h = alto_
	colores = colores_
	tren = con_tren
	semilla = semilla_
	nodo.name = "Terreno"
	_calcular_alturas()


# ----------------------------------------------------------------------
# Alturas

func _alto_base(i: int) -> float:
	var nv := float(niveles[i]) * NIVEL
	match terreno[i]:
		QUEBRADA:
			return nv - HONDO_QUEBRADA
		MAR:
			return FONDO_MAR
		ROCA:
			return nv + ALTO_ROCA
	return nv


func _es_suelo(i: int) -> bool:
	var c := terreno[i]
	return c != ROCA and c != QUEBRADA and c != MAR


func _calcular_alturas() -> void:
	var n := w * h
	alto.resize(n)
	for i in n:
		alto[i] = _alto_base(i)
	# las rampas se alisan entre los niveles que unen (relajación de Jacobi)
	var rampas: Array[int] = []
	for i in n:
		if terreno[i] == RAMPA:
			rampas.append(i)
	if not rampas.is_empty():
		var tmp := alto.duplicate()
		for _iter in 48:
			for i in rampas:
				var x := i % w
				var y := i / w
				var suma := 0.0
				var cuenta := 0
				for d in [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]:
					var xx: int = x + d.x
					var yy: int = y + d.y
					if xx < 0 or yy < 0 or xx >= w or yy >= h:
						continue
					var j := yy * w + xx
					if not _es_suelo(j):
						continue
					suma += alto[j]
					cuenta += 1
				if cuenta > 0:
					tmp[i] = suma / cuenta
			for i in rampas:
				alto[i] = tmp[i]
	# esquinas: plana cada casilla, salvo las rampas, que toman el promedio de sus vecinas de suelo
	esquinas.resize(n * 4)
	for i in n:
		var x := i % w
		var y := i / w
		if terreno[i] == RAMPA:
			esquinas[i * 4] = _promedio_esquina(x, y)
			esquinas[i * 4 + 1] = _promedio_esquina(x + 1, y)
			esquinas[i * 4 + 2] = _promedio_esquina(x + 1, y + 1)
			esquinas[i * 4 + 3] = _promedio_esquina(x, y + 1)
		elif terreno[i] == ROCA:
			# los roqueríos, como lomas: cada esquina sube con las casillas de roca que la tocan
			# (y un poco de ruido, compartido con las vecinas)
			var nv := float(niveles[i]) * NIVEL
			esquinas[i * 4] = nv + _loma(x, y)
			esquinas[i * 4 + 1] = nv + _loma(x + 1, y)
			esquinas[i * 4 + 2] = nv + _loma(x + 1, y + 1)
			esquinas[i * 4 + 3] = nv + _loma(x, y + 1)
		else:
			for k in 4:
				esquinas[i * 4 + k] = alto[i]


func _promedio_esquina(cx: int, cy: int) -> float:
	var suma := 0.0
	var cuenta := 0
	for dy in [-1, 0]:
		for dx in [-1, 0]:
			var xx: int = cx + dx
			var yy: int = cy + dy
			if xx < 0 or yy < 0 or xx >= w or yy >= h:
				continue
			var j := yy * w + xx
			if not _es_suelo(j):
				continue
			suma += alto[j]
			cuenta += 1
	return suma / cuenta if cuenta > 0 else 0.0


func _loma(cx: int, cy: int) -> float:
	var rocas := 0
	for dy in [-1, 0]:
		for dx in [-1, 0]:
			var xx: int = cx + dx
			var yy: int = cy + dy
			if xx >= 0 and yy >= 0 and xx < w and yy < h and terreno[yy * w + xx] == ROCA:
				rocas += 1
	var f := rocas / 4.0
	return ALTO_ROCA * f * f + (_ruido_esquina(cx, cy) if rocas == 4 else 0.0)


func _ruido_esquina(cx: int, cy: int) -> float:
	var v := int(cx * 73856093) ^ int(cy * 19349663) ^ semilla
	return float(absi(v) % 1000) / 1000.0 * 0.35


## Altura del suelo en el punto (x, z) del mundo (interpolada dentro de la casilla).
func altura_en(x: float, z: float) -> float:
	var tx := clampi(int(floor(x)), 0, w - 1)
	var ty := clampi(int(floor(z)), 0, h - 1)
	var u := clampf(x - tx, 0.0, 1.0)
	var v := clampf(z - ty, 0.0, 1.0)
	var i := (ty * w + tx) * 4
	var arriba := lerpf(esquinas[i], esquinas[i + 1], u)
	var abajo := lerpf(esquinas[i + 3], esquinas[i + 2], u)
	return lerpf(arriba, abajo, v)


## Punto donde el rayo toca el suelo (o el plano del agua), o null si no lo toca.
func interseccion(origen: Vector3, dir: Vector3) -> Variant:
	if dir.y >= -0.0001:
		return null
	var paso := 0.2
	var prev := origen
	var limite := int((origen.y - BASE) / -dir.y / paso) + 2
	for k in range(1, mini(limite, 6000)):
		var p := origen + dir * (paso * k)
		var suelo := maxf(altura_en(p.x, p.z), NIVEL_AGUA)
		if p.y <= suelo:
			var a := prev
			var b := p
			for _i in 12:
				var m := (a + b) * 0.5
				if m.y <= maxf(altura_en(m.x, m.z), NIVEL_AGUA):
					b = m
				else:
					a = m
			return b
		prev = p
	return null


func color_casilla(i: int) -> Color:
	var c: Color = colores.get(terreno[i], Color.MAGENTA)
	if terreno[i] == TAMARUGO:
		c = colores.get(PAMPA, c)
	if terreno[i] == QUEBRADA:
		c = c.lightened(0.3)
	if terreno[i] != MAR:
		c = c.lightened(0.05 * niveles[i])
	return c


# ----------------------------------------------------------------------
# Malla

func construir() -> Node3D:
	material = ShaderMaterial.new()
	material.shader = load("res://sombreadores/terreno.gdshader")
	material.set_shader_parameter("tam_mapa", Vector2(w, h))
	var tex_niebla := ImageTexture.create_from_image(Image.create(w, h, false, Image.FORMAT_L8))
	material.set_shader_parameter("niebla", tex_niebla)
	# los modelos (tropas, obras, decorados) comparten la niebla del terreno
	var mat_modelos: ShaderMaterial = Modelos.material()
	mat_modelos.set_shader_parameter("tam_mapa", Vector2(w, h))
	mat_modelos.set_shader_parameter("niebla", tex_niebla)
	var colores_esquina := _colores_esquina()
	var pesos_esquina := _pesos_esquina()
	for by in range(0, h, TROZO):
		for bx in range(0, w, TROZO):
			var mi := MeshInstance3D.new()
			mi.name = "Trozo_%d_%d" % [bx / TROZO, by / TROZO]
			mi.mesh = _malla_trozo(bx, by, mini(bx + TROZO, w), mini(by + TROZO, h), colores_esquina, pesos_esquina)
			mi.material_override = material
			nodo.add_child(mi)
	nodo.add_child(_base_diorama())
	if _hay_mar():
		nodo.add_child(_agua())
	_decorados()
	return nodo


## Color de cada esquina de la rejilla: promedio de las casillas que la tocan (como el
## suavizado del cliente 2D: arena, pampa y salar se funden sin bordes duros).
func _colores_esquina() -> PackedColorArray:
	var out := PackedColorArray()
	out.resize((w + 1) * (h + 1))
	for cy in h + 1:
		for cx in w + 1:
			var suma := Color(0, 0, 0, 0)
			var cuenta := 0
			for dy in [-1, 0]:
				for dx in [-1, 0]:
					var xx: int = cx + dx
					var yy: int = cy + dy
					if xx < 0 or yy < 0 or xx >= w or yy >= h:
						continue
					suma += color_casilla(yy * w + xx)
					cuenta += 1
			out[cy * (w + 1) + cx] = suma / cuenta
	return out


## Peso del salar y de la pampa en cada esquina (para fundir sus texturas entre casillas).
func _pesos_esquina() -> PackedVector2Array:
	var out := PackedVector2Array()
	out.resize((w + 1) * (h + 1))
	for cy in h + 1:
		for cx in w + 1:
			var salar := 0.0
			var pampa := 0.0
			var cuenta := 0
			for dy in [-1, 0]:
				for dx in [-1, 0]:
					var xx: int = cx + dx
					var yy: int = cy + dy
					if xx < 0 or yy < 0 or xx >= w or yy >= h:
						continue
					var c := terreno[yy * w + xx]
					if c == SALAR:
						salar += 1.0
					elif c == PAMPA or c == TAMARUGO:
						pampa += 1.0
					cuenta += 1
			out[cy * (w + 1) + cx] = Vector2(salar, pampa) / maxf(1.0, cuenta)
	return out


func _malla_trozo(x0: int, y0: int, x1: int, y1: int, colores_esquina: PackedColorArray,
		pesos_esquina: PackedVector2Array) -> ArrayMesh:
	var v := PackedVector3Array()
	var nrm := PackedVector3Array()
	var col := PackedColorArray()
	var uv := PackedVector2Array()
	var uv2 := PackedVector2Array()
	var ind := PackedInt32Array()
	for y in range(y0, y1):
		for x in range(x0, x1):
			var i := y * w + x
			var e := i * 4
			var p0 := Vector3(x, esquinas[e], y)
			var p1 := Vector3(x + 1, esquinas[e + 1], y)
			var p2 := Vector3(x + 1, esquinas[e + 2], y + 1)
			var p3 := Vector3(x, esquinas[e + 3], y + 1)
			var c0 := colores_esquina[y * (w + 1) + x]
			var c1 := colores_esquina[y * (w + 1) + x + 1]
			var c2 := colores_esquina[(y + 1) * (w + 1) + x + 1]
			var c3 := colores_esquina[(y + 1) * (w + 1) + x]
			var propio := color_casilla(i)
			if terreno[i] == ROCA or terreno[i] == QUEBRADA or terreno[i] == MAR:
				c0 = propio
				c1 = propio
				c2 = propio
				c3 = propio
			var dato := Vector2(terreno[i], niveles[i])
			var n := (p3 - p0).cross(p1 - p0).normalized()
			if n.y < 0:
				n = -n
			_quad(v, nrm, col, uv2, ind, [p0, p1, p2, p3], [c0, c1, c2, c3], n, dato)
			var cw := w + 1
			uv.append_array([pesos_esquina[y * cw + x], pesos_esquina[y * cw + x + 1],
					pesos_esquina[(y + 1) * cw + x + 1], pesos_esquina[(y + 1) * cw + x]])
			# paredes con la vecina del este y la del sur (y el borde del mapa)
			if x + 1 < w:
				var j := (i + 1) * 4
				_pared(v, nrm, col, uv, uv2, ind, p1, p2, Vector3(x + 1, esquinas[j], y), Vector3(x + 1, esquinas[j + 3], y + 1),
						Vector3(1, 0, 0), i, i + 1)
			if y + 1 < h:
				var j := (i + w) * 4
				_pared(v, nrm, col, uv, uv2, ind, p2, p3, Vector3(x + 1, esquinas[j + 1], y + 1), Vector3(x, esquinas[j], y + 1),
						Vector3(0, 0, 1), i, i + w)
	var arr := []
	arr.resize(Mesh.ARRAY_MAX)
	arr[Mesh.ARRAY_VERTEX] = v
	arr[Mesh.ARRAY_NORMAL] = nrm
	arr[Mesh.ARRAY_COLOR] = col
	arr[Mesh.ARRAY_TEX_UV] = uv
	arr[Mesh.ARRAY_TEX_UV2] = uv2
	arr[Mesh.ARRAY_INDEX] = ind
	var malla := ArrayMesh.new()
	if not v.is_empty():
		malla.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	return malla


func _quad(v: PackedVector3Array, nrm: PackedVector3Array, col: PackedColorArray, uv2: PackedVector2Array,
		ind: PackedInt32Array, p: Array, c: Array, n: Vector3, dato: Vector2) -> void:
	var b := v.size()
	for k in 4:
		v.append(p[k])
		nrm.append(n)
		col.append(c[k])
		uv2.append(dato)
	ind.append_array([b, b + 1, b + 2, b, b + 2, b + 3])


## Pared vertical entre dos casillas vecinas cuyas orillas no coinciden (acantilado, borde
## de la roca o de la quebrada). a0-a1: orilla de la casilla i; b0-b1: la de la vecina j.
func _pared(v: PackedVector3Array, nrm: PackedVector3Array, col: PackedColorArray, uv: PackedVector2Array,
		uv2: PackedVector2Array, ind: PackedInt32Array, a0: Vector3, a1: Vector3, b0: Vector3, b1: Vector3, eje: Vector3,
		i: int, j: int) -> void:
	if absf(a0.y - b0.y) < 0.002 and absf(a1.y - b1.y) < 0.002:
		return
	var alta := i if (a0.y + a1.y) >= (b0.y + b1.y) else j
	var roca: Color = colores.get(ROCA, Color(0.5, 0.4, 0.3))
	if terreno[alta] == QUEBRADA or terreno[i] == QUEBRADA or terreno[j] == QUEBRADA:
		roca = colores.get(QUEBRADA, roca).lightened(0.15)
	var arriba := roca.lightened(0.06)
	var abajo := roca.darkened(0.25)
	# la normal mira hacia la casilla más baja
	var n := eje if alta == i else -eje
	var dato := Vector2(ROCA, niveles[alta])
	var c_a0 := arriba if a0.y >= b0.y else abajo
	var c_a1 := arriba if a1.y >= b1.y else abajo
	var c_b0 := abajo if a0.y >= b0.y else arriba
	var c_b1 := abajo if a1.y >= b1.y else arriba
	if alta == i:
		_quad(v, nrm, col, uv2, ind, [a0, b0, b1, a1], [c_a0, c_b0, c_b1, c_a1], n, dato)
	else:
		_quad(v, nrm, col, uv2, ind, [a1, b1, b0, a0], [c_a1, c_b1, c_b0, c_a0], n, dato)
	uv.append_array([Vector2.ZERO, Vector2.ZERO, Vector2.ZERO, Vector2.ZERO])


func _hay_mar() -> bool:
	for c in terreno:
		if c == MAR:
			return true
	return false


## Base del diorama: las cuatro caras del borde del mapa bajan hasta BASE, con capas de
## tierra, como un modelo de mesa.
func _base_diorama() -> MeshInstance3D:
	var v := PackedVector3Array()
	var nrm := PackedVector3Array()
	var col := PackedColorArray()
	var uv2 := PackedVector2Array()
	var ind := PackedInt32Array()
	var tierra := Color8(122, 92, 64)
	var fondo := Color8(66, 48, 34)
	# norte (z = 0) y sur (z = h)
	for x in w:
		var n_i := x
		var s_i := (h - 1) * w + x
		_quad(v, nrm, col, uv2, ind,
				[Vector3(x + 1, esquinas[n_i * 4 + 1], 0), Vector3(x, esquinas[n_i * 4], 0), Vector3(x, BASE, 0), Vector3(x + 1, BASE, 0)],
				[tierra, tierra, fondo, fondo], Vector3(0, 0, -1), Vector2(ROCA, 0))
		_quad(v, nrm, col, uv2, ind,
				[Vector3(x, esquinas[s_i * 4 + 3], h), Vector3(x + 1, esquinas[s_i * 4 + 2], h), Vector3(x + 1, BASE, h), Vector3(x, BASE, h)],
				[tierra, tierra, fondo, fondo], Vector3(0, 0, 1), Vector2(ROCA, 0))
	# oeste (x = 0) y este (x = w)
	for y in h:
		var o_i := y * w
		var e_i := y * w + w - 1
		_quad(v, nrm, col, uv2, ind,
				[Vector3(0, esquinas[o_i * 4], y), Vector3(0, esquinas[o_i * 4 + 3], y + 1), Vector3(0, BASE, y + 1), Vector3(0, BASE, y)],
				[tierra, tierra, fondo, fondo], Vector3(-1, 0, 0), Vector2(ROCA, 0))
		_quad(v, nrm, col, uv2, ind,
				[Vector3(w, esquinas[e_i * 4 + 2], y + 1), Vector3(w, esquinas[e_i * 4 + 1], y), Vector3(w, BASE, y), Vector3(w, BASE, y + 1)],
				[tierra, tierra, fondo, fondo], Vector3(1, 0, 0), Vector2(ROCA, 0))
	var arr := []
	arr.resize(Mesh.ARRAY_MAX)
	arr[Mesh.ARRAY_VERTEX] = v
	arr[Mesh.ARRAY_NORMAL] = nrm
	arr[Mesh.ARRAY_COLOR] = col
	arr[Mesh.ARRAY_TEX_UV2] = uv2
	arr[Mesh.ARRAY_INDEX] = ind
	var malla := ArrayMesh.new()
	malla.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	var mi := MeshInstance3D.new()
	mi.name = "BaseDiorama"
	mi.mesh = malla
	var mat := StandardMaterial3D.new()
	mat.vertex_color_use_as_albedo = true
	mat.roughness = 1.0
	mi.material_override = mat
	return mi


func _agua() -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.name = "Mar"
	var plano := PlaneMesh.new()
	plano.size = Vector2(w, h)
	plano.subdivide_width = mini(w, 96)
	plano.subdivide_depth = mini(h, 96)
	mi.mesh = plano
	mi.position = Vector3(w / 2.0, NIVEL_AGUA, h / 2.0)
	var mat := ShaderMaterial.new()
	mat.shader = load("res://sombreadores/agua.gdshader")
	mat.set_shader_parameter("tam_mapa", Vector2(w, h))
	mat.set_shader_parameter("niebla", material.get_shader_parameter("niebla"))
	mi.material_override = mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	return mi


# ----------------------------------------------------------------------
# Tamarugos, rocas, ruinas y vía férrea

func _decorados() -> void:
	var rnd := RandomNumberGenerator.new()
	rnd.seed = semilla
	var arboles: Array[Transform3D] = []
	var rocas: Array[Transform3D] = []
	var ruinas: Array[Transform3D] = []
	var durmientes: Array[Transform3D] = []
	var rieles: Array[Transform3D] = []
	for y in h:
		for x in w:
			var i := y * w + x
			var c := terreno[i]
			if c == TAMARUGO:
				var p := Vector3(x + 0.5 + rnd.randf_range(-0.15, 0.15), alto[i], y + 0.5 + rnd.randf_range(-0.15, 0.15))
				var esc := rnd.randf_range(0.85, 1.2)
				arboles.append(Transform3D(Basis(Vector3.UP, rnd.randf() * TAU).scaled(Vector3(esc, esc, esc)), p))
			elif c == ROCA:
				for _k in rnd.randi_range(1, 3):
					var p := Vector3(x + rnd.randf_range(0.15, 0.85), 0, y + rnd.randf_range(0.15, 0.85))
					p.y = altura_en(p.x, p.z) - 0.12
					var esc := Vector3(rnd.randf_range(0.3, 0.62), rnd.randf_range(0.22, 0.55), rnd.randf_range(0.3, 0.6))
					var giro := Basis(Vector3.UP, rnd.randf() * TAU) * Basis(Vector3.RIGHT, rnd.randf_range(-0.3, 0.3))
					rocas.append(Transform3D(giro.scaled(esc), p))
			elif c == RUINAS:
				for _k in rnd.randi_range(1, 2):
					var p := Vector3(x + rnd.randf_range(0.2, 0.8), alto[i], y + rnd.randf_range(0.2, 0.8))
					var esc := Vector3(rnd.randf_range(0.3, 0.8), rnd.randf_range(0.12, 0.45), 0.12)
					ruinas.append(Transform3D(Basis(Vector3.UP, rnd.randf() * TAU).scaled(esc), p))
			elif c == CAMINO and tren:
				var horizontal := _es_camino(x - 1, y) or _es_camino(x + 1, y)
				var vertical := _es_camino(x, y - 1) or _es_camino(x, y + 1)
				var giro := 0.0 if (horizontal and not vertical) else PI / 2.0
				var base := Basis(Vector3.UP, giro)
				for k in 3:
					var d := (k - 1) * 0.33
					var off := base * Vector3(d, 0, 0)
					durmientes.append(Transform3D(base, Vector3(x + 0.5, alto[i] + 0.02, y + 0.5) + off))
				for lado in [-0.16, 0.16]:
					rieles.append(Transform3D(base, Vector3(x + 0.5, alto[i] + 0.05, y + 0.5) + base * Vector3(0, 0, lado)))
	_multimalla("Tamarugos", Modelos.malla_tamarugo(), arboles)
	_multimalla("Rocas", Modelos.malla_roca(), rocas)
	_multimalla("Ruinas", Modelos.malla_ruina(), ruinas)
	_multimalla("Durmientes", Modelos.malla_caja(Vector3(0.1, 0.04, 0.8), Color8(96, 70, 48)), durmientes)
	_multimalla("Rieles", Modelos.malla_caja(Vector3(1.0, 0.04, 0.05), Color8(70, 72, 78)), rieles)


func _es_camino(x: int, y: int) -> bool:
	return x >= 0 and y >= 0 and x < w and y < h and terreno[y * w + x] == CAMINO


func _multimalla(nombre: String, malla: Mesh, transformadas: Array[Transform3D]) -> void:
	if transformadas.is_empty():
		return
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = malla
	mm.instance_count = transformadas.size()
	for k in transformadas.size():
		mm.set_instance_transform(k, transformadas[k])
	var mmi := MultiMeshInstance3D.new()
	mmi.name = nombre
	mmi.multimesh = mm
	nodo.add_child(mmi)


## Actualiza la niebla de guerra: 255 visible, 110 explorado, 0 desconocido.
func actualizar_niebla(vis: PackedByteArray, explorado: PackedByteArray) -> void:
	var datos := PackedByteArray()
	datos.resize(w * h)
	for i in w * h:
		datos[i] = 255 if vis[i] else (110 if explorado[i] else 0)
	var img := Image.create_from_data(w, h, false, Image.FORMAT_L8, datos)
	var tex: ImageTexture = material.get_shader_parameter("niebla")
	tex.update(img)
