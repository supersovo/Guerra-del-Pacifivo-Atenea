## Las figuras del campo de batalla.
##
## Las tropas (y los convoyes) se dibujan agrupadas en MultiMesh: una llamada de dibujo por
## modelo, con los datos de cada figura (fase de la marcha, paso, acción y resaltado) que
## el sombreador usa para mover piernas, brazos, patas, ruedas y caños. Las obras, los
## yacimientos, las minas y los heridos son nodos sueltos. Encima: la guarnición en sus
## puestos, los anillos de selección (con la figura de la formación), la marca de la
## infantería formada, los galones de los veteranos y la gota de la tropa sin agua.
extends Node3D

const Modelos = preload("res://codigo/mundo/modelos.gd")
const Terreno = preload("res://codigo/mundo/terreno.gd")

const VERDE := Color8(90, 230, 90)
const AMARILLO := Color8(240, 210, 80)
const ROJO := Color8(230, 70, 60)
const BLANCO := Color8(236, 232, 220)
const MONTADOS := ["jinete_sable", "jinete_carabina", "baqueano", "heroe_montado"]
const RODADOS := ["canon_montana", "canon_campana", "gatling", "ambulancia", "carreta_agua", "camilleros"]
const PIEZAS := ["canon_montana", "canon_campana", "gatling"]
const FIGURAS_FORMACION := {1: "linea", 2: "guerrilla", 3: "cuadro"}


## Un MultiMesh que se vuelve a llenar en cada cuadro. Con datos propios lleva también el
## color de la instancia (siempre blanco): sin él, el dibujo de compatibilidad (OpenGL)
## pisa el color de los vértices con los datos propios.
class Grupo:
	extends RefCounted
	var mmi := MultiMeshInstance3D.new()
	var datos := PackedFloat32Array()
	var ultimo := PackedFloat32Array()     # lo último que se subió (para las pruebas)
	var n := 0
	var con_datos := true

	func _init(malla: Mesh, padre: Node3D, datos_propios := true, sombra := true) -> void:
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.use_colors = datos_propios
		mm.use_custom_data = datos_propios
		mm.mesh = malla
		mmi.multimesh = mm
		if not sombra:
			mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		con_datos = datos_propios
		padre.add_child(mmi)

	func agregar(t: Transform3D, dato := Vector4.ZERO) -> void:
		var b := t.basis
		datos.append_array([b.x.x, b.y.x, b.z.x, t.origin.x, b.x.y, b.y.y, b.z.y, t.origin.y,
				b.x.z, b.y.z, b.z.z, t.origin.z])
		if con_datos:
			datos.append_array([1.0, 1.0, 1.0, 1.0, dato.x, dato.y, dato.z, dato.w])
		n += 1

	func cerrar() -> void:
		var mm := mmi.multimesh
		if n == 0:
			mmi.visible = false
			if mm.instance_count > 64:
				mm.instance_count = 0
		else:
			mmi.visible = true
			var ancho := 20 if con_datos else 12
			var cap := mm.instance_count
			if cap < n or cap > n * 4 + 32:
				cap = maxi(8, nearest_po2(n))
				mm.instance_count = cap
			if cap > n:
				datos.resize(cap * ancho)
			mm.buffer = datos
			mm.visible_instance_count = n
		ultimo = datos
		datos = PackedFloat32Array()
		n = 0


var est
var ter
var cat
var nodos := {}           # id -> MeshInstance3D (obras, yacimientos, minas, heridos)
var grupos := {}          # malla -> Grupo
var anim := {}            # id -> {pos, rumbo, fase, paso, accion}
var resaltado := -1       # la figura bajo el ratón
var _resaltado_nodo := -1
var _t := 0.0
var _frente := {}         # id de la obra guarnecida -> [hacia dónde mira, hasta cuándo]


func _init(estado, terreno) -> void:
	est = estado
	ter = terreno
	cat = estado.cat
	name = "Tropas"


func _grupo(malla: Mesh, datos_propios := true, sombra := true) -> Grupo:
	var g: Grupo = grupos.get(malla)
	if g == null:
		g = Grupo.new(malla, self, datos_propios, sombra)
		grupos[malla] = g
	return g


## Cuántas figuras hay a la vista (tropas agrupadas y nodos sueltos).
func cuantas() -> int:
	return anim.size() + nodos.size()


## Pone al día todas las figuras. seleccion: ids elegidos (diccionario como conjunto);
## giro_camara: el giro de la cámara, para que los galones la miren de frente.
func actualizar(delta: float, seleccion: Dictionary, giro_camara := 0.0) -> void:
	_t += delta
	var vivos := {}
	var hacia_camara := Basis(Vector3.UP, giro_camara)
	for e in est.ents.values():
		if not _se_dibuja(e):
			continue
		vivos[e.id] = true
		var elegido: bool = seleccion.has(e.id)
		if e.es_unidad() or e.t == cat.especiales["convoy"]:
			_figura(e, delta, elegido, hacia_camara)
		else:
			_nodo(e)
			if elegido:
				var p: Vector3 = nodos[e.id].position
				_grupo(Modelos.anillo_seleccion(_color_anillo(e)), false, false).agregar(
						Transform3D(Basis().scaled(Vector3.ONE * radio(e)), p + Vector3(0, 0.05, 0)))
			if e.es_edificio() and not e.fantasma:
				_guarnicion(e)
	for id in nodos.keys():
		if not vivos.has(id):
			nodos[id].queue_free()
			nodos.erase(id)
	for id in anim.keys():
		if not vivos.has(id):
			anim.erase(id)
	# el resaltado de las obras (las tropas lo llevan en sus datos)
	if _resaltado_nodo != resaltado:
		if nodos.has(_resaltado_nodo):
			nodos[_resaltado_nodo].set_instance_shader_parameter("resalte", 0.0)
		_resaltado_nodo = -1
		if nodos.has(resaltado):
			nodos[resaltado].set_instance_shader_parameter("resalte", 1.0)
			_resaltado_nodo = resaltado
	for g in grupos.values():
		g.cerrar()


func _se_dibuja(e) -> bool:
	if e.t == cat.especiales["mina"]:
		return true      # el servidor solo manda las propias y las detectadas
	if e.tipo == null and e.t >= 0:
		return false
	if e.es_recurso():
		return est.explorado_px(e.x1, e.y1)
	return true


func _color_anillo(e) -> Color:
	if e.dueno < 0:
		return BLANCO
	return VERDE if e.dueno == est.yo else (AMARILLO if est.aliado(e.dueno) else ROJO)


func _rumbo(e) -> float:
	return -float(e.dir) * PI / 4.0


func _ex(e) -> Dictionary:
	return e.ex if typeof(e.ex) == TYPE_DICTIONARY else {}


# ----------------------------------------------------------------------
# Tropas y convoyes (agrupados)

func _malla_figura(e) -> Mesh:
	var color: Color = est.color(e.dueno)
	var fac: String = est.faccion(e.dueno)
	if e.t == cat.especiales["convoy"]:
		return Modelos.convoy(_ex(e).get("m", "carreta") == "tren", color)
	var tipo: Dictionary = e.tipo
	var extra := "herido" if e.fl & cat.bandera("CAMILLA") else ""
	return Modelos.unidad(tipo, cat.uniforme_base(fac), cat.uniforme_propio(fac, tipo["forma"]), color, fac, extra)


## Largo del paso (en unidades del mundo) por cada vuelta del ciclo de la marcha.
func _zancada(e) -> float:
	if e.t == cat.especiales["convoy"]:
		return 1.2
	var forma: String = e.tipo["forma"]
	if forma in MONTADOS:
		return 1.15
	if forma in RODADOS:
		return 0.9
	return 0.62


func _figura(e, delta: float, elegido: bool, hacia_camara: Basis) -> void:
	var x: float = e.x / 32.0
	var z: float = e.y / 32.0
	var naval: bool = e.es_unidad() and int(e.tipo["capa"]) == 1
	var y: float = Terreno.NIVEL_AGUA if naval else ter.altura_en(x, z)
	var pos := Vector3(x, y, z)
	var a: Dictionary = anim.get(e.id, {})
	if a.is_empty():
		a = {"pos": pos, "rumbo": _rumbo(e), "fase": randf() * TAU, "paso": 0.0, "accion": 0.0}
		anim[e.id] = a
	var antes: Vector3 = a["pos"]
	var recorrido := Vector2(pos.x - antes.x, pos.z - antes.z).length()
	a["pos"] = pos
	a["fase"] = fmod(float(a["fase"]) + recorrido * TAU / _zancada(e), TAU * 64.0)
	var marcha := recorrido > 0.0004 and recorrido < 2.0
	a["paso"] = move_toward(float(a["paso"]), 1.0 if marcha else 0.0, delta * 5.0)
	a["rumbo"] = lerp_angle(float(a["rumbo"]), _rumbo(e), 1.0 - exp(-10.0 * delta))
	var accion := _accion(e, a, delta)
	var esc := 1.0 if e.t == cat.especiales["convoy"] else Modelos.escala(e.tipo)
	var b := Basis(Vector3.UP, float(a["rumbo"]))
	var alzado := 0.0
	var paso: float = a["paso"]
	if naval:
		b = b * Basis(Vector3.RIGHT, sin(_t * 1.1 + e.id * 0.7) * 0.03)
		alzado = sin(_t * 1.6 + e.id) * 0.02
	elif e.es_unidad():
		var forma: String = e.tipo["forma"]
		var salto := 0.035 if forma in MONTADOS else (0.0 if forma in RODADOS else 0.02)
		alzado = absf(sin(float(a["fase"]))) * salto * paso
	var visto := pos + Vector3(0, alzado, 0)
	var dato := Vector4(a["fase"], paso, accion, 1.0 if e.id == resaltado else 0.0)
	_grupo(_malla_figura(e)).agregar(Transform3D(b.scaled(Vector3.ONE * esc), visto), dato)
	if not e.es_unidad():
		return
	var ex := _ex(e)
	var fo := int(ex.get("fo", 0))
	var color: Color = est.color(e.dueno)
	var suelo := Vector3(pos.x, pos.y + 0.035, pos.z)
	if elegido:
		var r := radio(e)
		_grupo(Modelos.anillo_seleccion(_color_anillo(e), FIGURAS_FORMACION.get(fo, "")), false, false).agregar(
				Transform3D(Basis(Vector3.UP, float(a["rumbo"])).scaled(Vector3(r, 1, r)), suelo))
	elif fo == 1 or fo == 3:
		var r := radio(e) * 0.9
		_grupo(Modelos.marca_formacion(fo, color), false, false).agregar(
				Transform3D(Basis(Vector3.UP, float(a["rumbo"])).scaled(Vector3(r, 1, r)), suelo))
	var tope := visto + Vector3(0, alto(e) + 0.1, 0)
	if ex.has("v") and int(ex["v"]) > 0:
		_grupo(Modelos.galones(int(ex["v"])), false, false).agregar(Transform3D(hacia_camara, tope))
		tope.y += 0.16
	if e.fl & cat.bandera("DESHIDRATADA"):
		_grupo(Modelos.gota(), false, false).agregar(Transform3D(Basis(), tope + Vector3(0, 0.05, 0)))


## La acción de la figura (0 a 1): fusil apuntado, tajo, retroceso de la pieza o faena.
func _accion(e, a: Dictionary, delta: float) -> float:
	if not e.es_unidad():
		return 0.0
	var forma: String = e.tipo["forma"]
	var desde: float = est.reloj() - e.ultimo_disparo
	if forma in PIEZAS:
		return clampf(1.0 - desde / 0.3, 0.0, 1.0)
	if forma in MONTADOS or forma in ["heroe_a_pie", "heroina", "montonero"]:
		return clampf(1.0 - absf(desde - 0.15) / 0.2, 0.0, 1.0)
	if e.tipo.get("trabajador", false):
		if e.fl & cat.bandera("TRABAJA"):
			return 0.35 + 0.35 * sin(_t * 7.0 + e.id)
		return 0.0
	# la infantería apunta mientras hace fuego y vuelve a llevar el arma al hombro después
	var objetivo := 1.0 if desde < 1.3 else 0.0
	a["accion"] = move_toward(float(a["accion"]), objetivo, delta * 6.0)
	return a["accion"]


# ----------------------------------------------------------------------
# Obras, yacimientos, minas y heridos (nodos sueltos)

## Lo que define la malla de un nodo: si cambia, se vuelve a vestir.
func _clave(e) -> String:
	var ex := _ex(e)
	if e.es_recurso():
		var resto := float(e.vida) / maxf(1.0, float(est.inicial.get(e.id, 1500)))
		return "r%d|%d" % [e.t, int(ceil(resto * 8.0))]
	if e.t == cat.especiales["herido"]:
		return "h|%d|%d" % [int(ex.get("u", 0)), e.dueno]
	if e.t == cat.especiales["mina"]:
		return "m"
	var obra: bool = (e.fl & cat.bandera("OBRA")) != 0
	return "%d|%d|%s" % [e.t, e.dueno, obra]


func _nodo(e) -> void:
	var mi: MeshInstance3D = nodos.get(e.id)
	if mi == null:
		mi = MeshInstance3D.new()
		mi.name = "E%d" % e.id
		add_child(mi)
		nodos[e.id] = mi
		mi.set_meta("clave", "")
		mi.rotation.y = _rumbo(e)
	var clave := _clave(e)
	if mi.get_meta("clave") != clave:
		_vestir(mi, e)
		mi.set_meta("clave", clave)
	var x: float = e.x / 32.0
	var z: float = e.y / 32.0
	mi.position = Vector3(x, ter.altura_en(x, z), z)
	if e.es_edificio():
		var ex := _ex(e)
		if e.fl & cat.bandera("OBRA"):
			# la obra crece con el avance; el andamio queda a su altura
			var f := clampf(float(ex.get("o", 0)) / 100.0, 0.08, 1.0)
			mi.scale = Vector3(1, f, 1)
			var andamio := mi.get_node_or_null("Andamio")
			if andamio != null:
				andamio.scale = Vector3(1, 1.0 / f, 1)
		elif mi.scale != Vector3.ONE:
			mi.scale = Vector3.ONE
		if e.tipo.get("costero", false):
			mi.rotation.y = _hacia_el_agua(e)
	elif e.t == cat.especiales["herido"]:
		mi.rotation.y = _rumbo(e)


func _vestir(mi: MeshInstance3D, e) -> void:
	for h in mi.get_children():
		h.queue_free()
	var ex := _ex(e)
	var color: Color = est.color(e.dueno)
	var fac: String = est.faccion(e.dueno)
	mi.scale = Vector3.ONE
	if e.es_recurso():
		var resto := float(e.vida) / maxf(1.0, float(est.inicial.get(e.id, 1500)))
		mi.mesh = Modelos.salitre(resto) if e.t == cat.especiales["salitre"] else Modelos.pozo(resto)
		return
	if e.t == cat.especiales["mina"]:
		mi.mesh = Modelos.mina()
		return
	if e.t == cat.especiales["herido"]:
		var tu: Variant = cat.tipo(int(ex.get("u", 0)))
		if tu == null:
			tu = cat.tipos_por_id["infante"]
		mi.mesh = Modelos.caido(tu, cat.uniforme_base(fac), cat.uniforme_propio(fac, tu["forma"]), color, fac)
		var sangre := MeshInstance3D.new()
		sangre.mesh = Modelos.mancha(Color(0.45, 0.04, 0.03, 0.85))
		sangre.scale = Vector3(0.22, 1, 0.16)
		sangre.position = Vector3(-0.1, 0.02, 0)
		mi.add_child(sangre)
		return
	var tipo: Dictionary = e.tipo
	mi.mesh = Modelos.edificio(tipo, color, fac)
	if e.fl & cat.bandera("OBRA"):
		var andamio := MeshInstance3D.new()
		andamio.name = "Andamio"
		andamio.mesh = Modelos.andamio(tipo)
		mi.add_child(andamio)


## El muelle mira hacia el lado con más agua (el modelo tiene el agua al sur).
func _hacia_el_agua(e) -> float:
	var tx := int(e.x1) / 32
	var ty := int(e.y1) / 32
	var mejor := 0
	var giro := 0.0
	for par in [[Vector2i(0, 1), 0.0], [Vector2i(1, 0), PI / 2.0], [Vector2i(0, -1), PI], [Vector2i(-1, 0), -PI / 2.0]]:
		var d: Vector2i = par[0]
		var agua := 0
		for k in range(1, 4):
			for l in range(-1, 2):
				var xx := tx + d.x * k + (l if d.x == 0 else 0)
				var yy := ty + d.y * k + (l if d.y == 0 else 0)
				if xx >= 0 and yy >= 0 and xx < est.w and yy < est.h and est.terreno[yy * est.w + xx] == Terreno.MAR:
					agua += 1
		if agua > mejor:
			mejor = agua
			giro = par[1]
	return giro


# ----------------------------------------------------------------------
# Guarnición a la vista

## Los soldados de la trinchera o de la azotea, en sus puestos, mirando al enemigo más
## cercano (y apuntando los que acaban de disparar).
func _guarnicion(e) -> void:
	var ex := _ex(e)
	var g: Array = ex.get("g", [])
	if g.is_empty():
		return
	var puestos := Modelos.puestos_guarnicion(e.tipo.get("forma", e.tipo["id"]))
	if puestos.is_empty():
		return
	var mi: MeshInstance3D = nodos.get(e.id)
	if mi == null:
		return
	var disparan: Array = ex.get("gf", [])
	var fac: String = est.faccion(e.dueno)
	var color: Color = est.color(e.dueno)
	var b := Basis(Vector3.UP, _hacia_el_enemigo(e))
	for k in mini(g.size(), puestos.size()):
		var tipo: Variant = cat.tipo(int(g[k]))
		if tipo == null:
			continue
		var malla := Modelos.unidad(tipo, cat.uniforme_base(fac), cat.uniforme_propio(fac, tipo["forma"]), color, fac,
				"sin_peana")
		var p: Vector3 = mi.transform * puestos[k]
		var apunta := 1.0 if k in disparan else 0.35
		_grupo(malla).agregar(Transform3D(b.scaled(Vector3.ONE * Modelos.escala(tipo)), p), Vector4(0, 0, apunta, 0))


## Hacia dónde mira la guarnición: el enemigo más cercano a la vista (si no hay, al sur).
func _hacia_el_enemigo(e) -> float:
	var ahora: float = est.reloj()
	var guardado: Array = _frente.get(e.id, [])
	if not guardado.is_empty() and guardado[1] > ahora:
		return guardado[0]
	var mejor := 14.0 * 32.0
	var giro := -PI / 2.0
	for o in est.ents.values():
		if o.tipo == null or not o.es_unidad() or o.dueno == e.dueno or est.aliado(o.dueno) == est.aliado(e.dueno):
			continue
		var d := Vector2(o.x - e.x, o.y - e.y)
		if d.length() < mejor:
			mejor = d.length()
			giro = -atan2(d.y, d.x)
	_frente[e.id] = [giro, ahora + 0.5]
	return giro


# ----------------------------------------------------------------------
# Medidas para elegir con el ratón y dibujar las barras

## Radio de la figura en el mundo (para el anillo y para elegirla con el ratón).
func radio(e) -> float:
	if e.es_edificio():
		return maxf(float(e.tipo["ancho"]), float(e.tipo["alto"])) * 0.62
	if e.es_recurso():
		return 1.0 if e.t == cat.especiales["salitre"] else 1.5
	if e.tipo == null:
		return 0.4
	if int(e.tipo["capa"]) == 1:
		return 1.0
	var forma: String = e.tipo["forma"]
	var esc := Modelos.escala(e.tipo)
	if forma in RODADOS:
		return 0.36 * esc
	if forma in MONTADOS:
		return 0.26 * esc
	return 0.19 * esc


## Punto del mundo de una entidad (sus pies, sobre el suelo o el agua).
func punto(e) -> Vector3:
	var a: Dictionary = anim.get(e.id, {})
	if not a.is_empty():
		return a["pos"]
	var mi: MeshInstance3D = nodos.get(e.id)
	if mi != null:
		return mi.position
	var x: float = e.x / 32.0
	var z: float = e.y / 32.0
	return Vector3(x, ter.altura_en(x, z), z)


## Altura de la figura (para dibujar la barra de vida encima).
func alto(e) -> float:
	if e.es_edificio():
		return 1.6
	if e.tipo == null:
		return 0.3
	if int(e.tipo["capa"]) == 1:
		return 0.9
	var forma: String = e.tipo["forma"]
	var esc := Modelos.escala(e.tipo)
	if forma in MONTADOS:
		return 0.95 * esc
	if forma in ["canon_montana", "canon_campana", "gatling", "ambulancia", "carreta_agua"]:
		return 0.6 * esc
	return 0.72 * esc
