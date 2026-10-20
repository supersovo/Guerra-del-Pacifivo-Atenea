## Retrato 3D: figuras u obras sobre su peana, girando despacio en su propia vista, con luz de
## estudio. El archivo histórico muestra así cada unidad y cada obra, y el desfile de cada
## nación con sus uniformes.
extends SubViewportContainer

var vista: SubViewport
var raiz: Node3D
var pivote: Node3D
var camara: Camera3D
var girar := true
var velocidad := 0.45
var inclinacion := 22.0         # grados sobre el horizonte


func _init(tam: Vector2) -> void:
	stretch = true
	custom_minimum_size = tam
	size = tam
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	vista = SubViewport.new()
	vista.own_world_3d = true
	vista.transparent_bg = true
	vista.msaa_3d = Viewport.MSAA_4X
	vista.size = Vector2i(tam)
	add_child(vista)
	raiz = Node3D.new()
	vista.add_child(raiz)
	var sol := DirectionalLight3D.new()
	sol.rotation_degrees = Vector3(-48, -40, 0)
	sol.light_energy = 1.15
	sol.light_color = Color8(255, 244, 226)
	sol.shadow_enabled = true
	raiz.add_child(sol)
	var relleno := DirectionalLight3D.new()
	relleno.rotation_degrees = Vector3(-20, 140, 0)
	relleno.light_energy = 0.35
	relleno.light_color = Color8(190, 205, 235)
	raiz.add_child(relleno)
	var mundo := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_CLEAR_COLOR
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color8(255, 238, 214)
	env.ambient_light_energy = 0.55
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	mundo.environment = env
	raiz.add_child(mundo)
	pivote = Node3D.new()
	raiz.add_child(pivote)
	camara = Camera3D.new()
	camara.fov = 30.0
	camara.near = 0.02
	raiz.add_child(camara)
	camara.current = true


## Muestra las mallas en fila (de izquierda a derecha) y encuadra la cámara.
func mostrar(mallas: Array, separacion := 0.2, rumbo := 0.0) -> void:
	for h in pivote.get_children():
		h.queue_free()
	pivote.rotation.y = rumbo
	var x := 0.0
	var caja := AABB()
	var primera := true
	var anchos: Array = []
	for m: Mesh in mallas:
		anchos.append(m.get_aabb().size.x)
	var total := 0.0
	for a: float in anchos:
		total += a
	total += separacion * maxi(0, mallas.size() - 1)
	x = -total / 2.0
	for i in mallas.size():
		var m: Mesh = mallas[i]
		var mi := MeshInstance3D.new()
		mi.mesh = m
		var ab := m.get_aabb()
		mi.position = Vector3(x - ab.position.x, 0, -ab.get_center().z)
		pivote.add_child(mi)
		var ab_mundo := AABB(ab.position + mi.position, ab.size)
		caja = ab_mundo if primera else caja.merge(ab_mundo)
		primera = false
		x += float(anchos[i]) + separacion
	if primera:
		return
	var centro := caja.get_center()
	var incl := deg_to_rad(inclinacion)
	var tan_v := tan(deg_to_rad(camara.fov / 2.0))
	var aspecto := size.x / maxf(1.0, size.y)
	var dist := 0.0
	if girar:
		# gira: cabe entera en cualquier ángulo
		dist = maxf(0.2, caja.size.length() / 2.0) / tan_v * 1.05
	else:
		# fila quieta: que llene el cuadro a lo ancho o a lo alto, lo que mande
		var alto := caja.size.y * cos(incl) + caja.size.z * sin(incl)
		dist = maxf(alto / 2.0 / tan_v, caja.size.x / 2.0 / (tan_v * aspecto)) * 1.12 + caja.size.z / 2.0
	camara.look_at_from_position(centro + Vector3(0, sin(incl), cos(incl)) * dist, centro, Vector3.UP)


func _process(delta: float) -> void:
	if girar:
		pivote.rotation.y += delta * velocidad
