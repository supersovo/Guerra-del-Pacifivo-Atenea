## Las figuras del campo de batalla: una por entidad del estado espejo (tropas, obras,
## yacimientos, minas, heridos y convoyes), con su posición interpolada sobre el terreno,
## su rumbo, el paso de la marcha y el anillo de selección.
extends Node3D

const Modelos = preload("res://codigo/mundo/modelos.gd")
const Terreno = preload("res://codigo/mundo/terreno.gd")

const VERDE := Color8(90, 230, 90)
const AMARILLO := Color8(240, 210, 80)
const ROJO := Color8(230, 70, 60)
const BLANCO := Color8(236, 232, 220)

var est
var ter
var cat
var nodos := {}           # id -> MeshInstance3D
var _t := 0.0


func _init(estado, terreno) -> void:
	est = estado
	ter = terreno
	cat = estado.cat
	name = "Tropas"


## Pone al día las figuras. seleccion: ids elegidos (diccionario como conjunto).
func actualizar(delta: float, seleccion: Dictionary) -> void:
	_t += delta
	var vivos := {}
	for e in est.ents.values():
		if not _se_dibuja(e):
			continue
		vivos[e.id] = true
		var clave := _clave(e)
		var mi: MeshInstance3D = nodos.get(e.id)
		if mi == null:
			mi = MeshInstance3D.new()
			mi.name = "E%d" % e.id
			add_child(mi)
			nodos[e.id] = mi
			mi.set_meta("clave", "")
			mi.rotation.y = _rumbo(e)
		if mi.get_meta("clave") != clave:
			_vestir(mi, e)
			mi.set_meta("clave", clave)
		_posicionar(mi, e, delta)
		_anillo(mi, e, seleccion.has(e.id))
	for id in nodos.keys():
		if not vivos.has(id):
			nodos[id].queue_free()
			nodos.erase(id)


func _se_dibuja(e) -> bool:
	if e.t == cat.especiales["mina"]:
		return true      # el servidor solo manda las propias y las detectadas
	if e.tipo == null and e.t >= 0:
		return false
	if e.es_recurso():
		return est.explorado_px(e.x1, e.y1)
	return true


## Lo que define la malla: si cambia, se vuelve a vestir la figura.
func _clave(e) -> String:
	var ex: Dictionary = e.ex if typeof(e.ex) == TYPE_DICTIONARY else {}
	if e.es_recurso():
		var resto := float(e.vida) / maxf(1.0, float(est.inicial.get(e.id, 1500)))
		return "r%d|%d" % [e.t, int(ceil(resto * 8.0))]
	if e.t == cat.especiales["convoy"]:
		return "c|%s|%d" % [ex.get("m", "carreta"), e.dueno]
	if e.t == cat.especiales["herido"]:
		return "h|%d|%d" % [int(ex.get("u", 0)), e.dueno]
	if e.t == cat.especiales["mina"]:
		return "m"
	var obra: bool = e.es_edificio() and (e.fl & cat.bandera("OBRA")) != 0
	var camilla: bool = e.fl & cat.bandera("CAMILLA") != 0
	return "%d|%d|%s|%s" % [e.t, e.dueno, obra, camilla]


func _vestir(mi: MeshInstance3D, e) -> void:
	for h in mi.get_children():
		if h.name != "Anillo":
			h.queue_free()
	var ex: Dictionary = e.ex if typeof(e.ex) == TYPE_DICTIONARY else {}
	var color: Color = est.color(e.dueno)
	var fac: String = est.faccion(e.dueno)
	mi.scale = Vector3.ONE
	if e.es_recurso():
		var resto := float(e.vida) / maxf(1.0, float(est.inicial.get(e.id, 1500)))
		mi.mesh = Modelos.salitre(resto) if e.t == cat.especiales["salitre"] else Modelos.pozo(resto)
		return
	if e.t == cat.especiales["convoy"]:
		mi.mesh = Modelos.convoy(ex.get("m", "carreta") == "tren", color)
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
	if e.es_edificio():
		mi.mesh = Modelos.edificio(tipo, color, fac)
		if e.fl & cat.bandera("OBRA"):
			var andamio := MeshInstance3D.new()
			andamio.name = "Andamio"
			andamio.mesh = Modelos.andamio(tipo)
			mi.add_child(andamio)
		return
	var extra := "herido" if e.fl & cat.bandera("CAMILLA") else ""
	mi.mesh = Modelos.unidad(tipo, cat.uniforme_base(fac), cat.uniforme_propio(fac, tipo["forma"]), color, fac, extra)
	var esc := Modelos.escala(tipo)
	mi.scale = Vector3(esc, esc, esc)


func _rumbo(e) -> float:
	return -float(e.dir) * PI / 4.0


func _posicionar(mi: MeshInstance3D, e, delta: float) -> void:
	var x: float = e.x / 32.0
	var z: float = e.y / 32.0
	var y := 0.0
	var marcha: bool = (e.fl & cat.bandera("MOVIENDO")) != 0
	if e.es_edificio():
		y = ter.altura_en(x, z)
		var ex: Dictionary = e.ex if typeof(e.ex) == TYPE_DICTIONARY else {}
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
		mi.position = Vector3(x, y, z)
		return
	if e.es_unidad() and int(e.tipo["capa"]) == 1:
		y = Terreno.NIVEL_AGUA + sin(_t * 1.6 + e.id) * 0.02
		mi.rotation.x = sin(_t * 1.1 + e.id * 0.7) * 0.02
	else:
		y = ter.altura_en(x, z)
		if marcha and e.es_unidad():
			# el paso de la marcha
			y += absf(sin(_t * 9.0 + e.id * 1.3)) * 0.025
	if e.es_unidad() or e.t == cat.especiales["convoy"] or e.t == cat.especiales["herido"]:
		var objetivo := _rumbo(e)
		mi.rotation.y = lerp_angle(mi.rotation.y, objetivo, 1.0 - exp(-10.0 * delta))
	# el retroceso del disparo
	var tras := 0.0
	var desde: float = est.reloj() - e.ultimo_disparo
	if desde < 0.18 and e.es_unidad():
		tras = (0.18 - desde) / 0.18 * 0.05
	var atras := Vector3(-cos(mi.rotation.y), 0, sin(mi.rotation.y)) * tras
	mi.position = Vector3(x, y, z) + atras
	# los ocultos propios se ven traslúcidos
	if e.es_unidad():
		mi.transparency = 0.5 if (e.fl & cat.bandera("OCULTA")) else 0.0


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


func _anillo(mi: MeshInstance3D, e, elegido: bool) -> void:
	var anillo: MeshInstance3D = mi.get_node_or_null("Anillo")
	if not elegido:
		if anillo != null:
			anillo.visible = false
		return
	var color := BLANCO
	if e.dueno >= 0:
		color = VERDE if e.dueno == est.yo else (AMARILLO if est.aliado(e.dueno) else ROJO)
	if anillo == null or anillo.get_meta("color", Color.BLACK) != color:
		if anillo == null:
			anillo = MeshInstance3D.new()
			anillo.name = "Anillo"
			anillo.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			mi.add_child(anillo)
		anillo.mesh = Modelos.anillo_seleccion(color)
		anillo.set_meta("color", color)
	anillo.visible = true
	var r := radio(e)
	var esc := mi.scale
	anillo.scale = Vector3(r / maxf(esc.x, 0.01), 1.0 / maxf(esc.y, 0.01), r / maxf(esc.z, 0.01))
	anillo.position = Vector3(0, 0.04 / maxf(esc.y, 0.01), 0)


## Radio de la figura en el mundo (para el anillo y para elegirla con el ratón).
func radio(e) -> float:
	if e.es_edificio():
		return maxf(float(e.tipo["ancho"]), float(e.tipo["alto"])) * 0.62
	if e.es_recurso():
		return 1.0 if e.t == cat.especiales["salitre"] else 1.5
	if e.tipo == null:
		return 0.3
	if int(e.tipo["capa"]) == 1:
		return 1.0
	var forma: String = e.tipo["forma"]
	var esc := Modelos.escala(e.tipo)
	if forma in ["canon_montana", "canon_campana", "gatling", "ambulancia", "carreta_agua", "camilleros"]:
		return 0.36 * esc
	if forma in ["jinete_sable", "jinete_carabina", "baqueano", "heroe_montado"]:
		return 0.26 * esc
	return 0.19 * esc


## Punto del mundo de una entidad (a media altura de la figura, para barras y clics).
func punto(e) -> Vector3:
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
	if forma in ["jinete_sable", "jinete_carabina", "baqueano", "heroe_montado"]:
		return 0.95 * esc
	if forma in ["canon_montana", "canon_campana", "gatling", "ambulancia", "carreta_agua"]:
		return 0.6 * esc
	return 0.72 * esc
