## Estado de la batalla en el cliente: espejo de lo que manda el servidor.
##
## Igual que el cliente de Python (salitre/cliente/juego/estado.py): entidades con
## interpolación entre instantáneas, niebla calculada aquí con las mismas reglas y
## «fantasmas» (edificios y yacimientos vistos que quedan recordados bajo la niebla).
## Las posiciones van en píxeles del juego (32 por casilla), como en la red.
extends RefCounted

const Vision = preload("res://codigo/batalla/vision.gd")


class Ent:
	extends RefCounted
	var id := 0
	var t := 0                  # índice del tipo en el catálogo (negativo: yacimiento, mina, herido, convoy)
	var dueno := -1
	var x := 0.0                # posición interpolada (píxeles)
	var y := 0.0
	var x0 := 0.0
	var y0 := 0.0
	var x1 := 0.0
	var y1 := 0.0
	var t0 := 0.0
	var vida := 0
	var dir := 0
	var fl := 0
	var ex: Dictionary = {}
	var tipo: Variant = null    # diccionario del catálogo, o null
	var fantasma := false
	var visto := 0.0
	var creada := 0.0
	var ultimo_disparo := -10.0

	func es_unidad() -> bool:
		return tipo != null and not tipo["edificio"]

	func es_edificio() -> bool:
		return tipo != null and tipo["edificio"]

	func es_recurso() -> bool:
		return t == -1 or t == -2


var cat
var inicio: Dictionary
var mapa: Dictionary
var w := 0
var h := 0
var niveles := PackedByteArray()
var terreno := PackedByteArray()
var edificable := PackedByteArray()
var agua_base := PackedByteArray()      # casillas de mar (para los muelles)
var yo := 0
var espectador := false
var jugadores: Array = []
var equipos: Array = []
var intervalo := 0.125
var ents: Dictionary = {}
var tick := 0
var dinero := 0
var agua := 0
var pob := 0
var pob_max := 0
var viento: Array = [0, 0]       # rumbo (0..15 hacia donde sopla; 0 = este, 4 = sur) y fuerza (0..100)
var mejoras: Array = []
var investigando: Array = []
var heroes: Array = []
var minas := 0
var todos: Array = []            # espectador: dinero, agua y población de cada jugador
var revelados: Array = []        # [tx, ty, radio, hasta]: zonas descubiertas por un rato (reconocimiento)
var eventos: Array = []
var vis := PackedByteArray()
var explorado := PackedByteArray()
var cambio_vision := true
var inicial: Dictionary = {}       # id del yacimiento -> cantidad al comenzar
var fin: Dictionary = {}
var _t_vision := -10.0


func _init(catalogo, msg_inicio: Dictionary) -> void:
	cat = catalogo
	inicio = msg_inicio
	mapa = msg_inicio["mapa"]
	w = int(mapa["ancho"])
	h = int(mapa["alto"])
	yo = int(msg_inicio.get("yo", -1))
	espectador = yo < 0
	jugadores = msg_inicio.get("jugadores", [])
	for j in jugadores:
		equipos.append(int(j.get("equipo", 0)))
	intervalo = float(msg_inicio.get("cada", 2)) / (float(msg_inicio.get("ticks", 16)) * float(msg_inicio.get("velocidad", 1.0)))
	var terrenos: Dictionary = cat.datos["terrenos"]
	terreno.resize(w * h)
	niveles.resize(w * h)
	edificable.resize(w * h)
	agua_base.resize(w * h)
	for fy in h:
		var fila_t: String = mapa["terreno"][fy]
		var fila_a: String = mapa["altura"][fy]
		for fx in w:
			var i := fy * w + fx
			var tt: Dictionary = terrenos.get(fila_t[fx], terrenos["."])
			terreno[i] = int(tt["codigo"])
			edificable[i] = int(tt["edificable"])
			agua_base[i] = int(tt["agua"])
			niveles[i] = clampi(fila_a.unicode_at(fx) - 48, 0, 2)
	vis.resize(w * h)
	explorado.resize(w * h)
	# los yacimientos se conocen desde el comienzo: son las primeras entidades, en el orden del mapa
	var ahora := reloj()
	var recursos: Array = mapa.get("recursos", [])
	for k in recursos.size():
		var r: Dictionary = recursos[k]
		var salitre: bool = r["tipo"] == "salitre"
		var tam := Vector2i(2, 1) if salitre else Vector2i(3, 3)
		var cant := int(r.get("cantidad", 1500 if salitre else 2500))
		var e := Ent.new()
		e.id = k + 1
		e.t = -1 if salitre else -2
		e.x = int(r["x"]) * 32 + tam.x * 16
		e.y = int(r["y"]) * 32 + tam.y * 16
		e.x0 = e.x
		e.x1 = e.x
		e.y0 = e.y
		e.y1 = e.y
		e.vida = cant
		e.fantasma = true
		e.visto = ahora
		e.creada = ahora
		inicial[e.id] = cant
		ents[e.id] = e


static func reloj() -> float:
	return Time.get_ticks_msec() / 1000.0


func aliado(dueno: int) -> bool:
	if espectador:
		return true
	if dueno < 0:
		return false
	return dueno == yo or equipos[dueno] == equipos[yo]


func propio(e: Ent) -> bool:
	return not espectador and e.dueno == yo


func faccion(dueno: int) -> String:
	if dueno >= 0 and dueno < jugadores.size():
		return jugadores[dueno]["faccion"]
	return "chile"


func color(dueno: int) -> Color:
	if dueno >= 0 and dueno < jugadores.size():
		return cat.color_jugador(int(jugadores[dueno]["color"]))
	return Color(0.8, 0.8, 0.8)


func idx(tx: int, ty: int) -> int:
	return clampi(ty, 0, h - 1) * w + clampi(tx, 0, w - 1)


## Aplica un mensaje "inst" del servidor.
func aplicar(msg: Dictionary) -> void:
	var ahora := reloj()
	tick = int(msg.get("k", tick))
	if msg.get("completa", 0):
		for i in ents.keys():
			if not ents[i].es_recurso():
				ents.erase(i)
	for r in msg.get("e", []):
		var id := int(r[0])
		var t := int(r[1])
		var e: Ent = ents.get(id)
		if e == null or e.t != t:
			e = Ent.new()
			e.id = id
			e.t = t
			e.tipo = cat.tipo(t)
			e.dueno = int(r[2])
			e.x = float(r[3])
			e.y = float(r[4])
			e.x0 = e.x
			e.y0 = e.y
			e.x1 = e.x
			e.y1 = e.y
			e.t0 = ahora
			e.vida = int(r[5])
			e.dir = int(r[6])
			e.fl = int(r[7])
			e.ex = r[8] if typeof(r[8]) == TYPE_DICTIONARY else {}
			e.visto = ahora
			e.creada = ahora
			ents[id] = e
			cambio_vision = true
			continue
		# desde donde se ve ahora hasta la nueva posición
		e.x0 = e.x
		e.y0 = e.y
		e.x1 = float(r[3])
		e.y1 = float(r[4])
		e.t0 = ahora
		e.vida = int(r[5])
		e.dir = int(r[6])
		var fl := int(r[7])
		if fl & cat.bandera("DISPARO") and not e.fl & cat.bandera("DISPARO"):
			e.ultimo_disparo = ahora
		e.fl = fl
		e.ex = r[8] if typeof(r[8]) == TYPE_DICTIONARY else {}
		e.fantasma = false
		e.visto = ahora
		e.dueno = int(r[2])
		if (e.x0 != e.x1 or e.y0 != e.y1) and aliado(e.dueno):
			cambio_vision = true
	for q in msg.get("q", []):
		var id := int(q[0])
		var e: Ent = ents.get(id)
		if e == null:
			continue
		if q[1] == "v" and (e.es_edificio() or e.es_recurso()):
			e.fantasma = true
			e.x = e.x1
			e.y = e.y1
			e.x0 = e.x1
			e.y0 = e.y1
		else:
			ents.erase(id)
			cambio_vision = true
	var j: Variant = msg.get("j")
	if typeof(j) == TYPE_DICTIONARY:
		dinero = int(j.get("d", dinero))
		agua = int(j.get("a", agua))
		pob = int(j.get("p", pob))
		pob_max = int(j.get("pm", pob_max))
		mejoras = j.get("m", mejoras)
		investigando = j.get("i", investigando)
		heroes = j.get("h", heroes)
		minas = int(j.get("mi", minas))
		if j.has("vi"):
			viento = [int(j["vi"][0]), int(j["vi"][1])]
	if msg.has("js"):
		todos = msg["js"]
	if msg.has("vi"):
		viento = [int(msg["vi"][0]), int(msg["vi"][1])]
	for ev in msg.get("ev", []):
		eventos.append(ev)


func interpolar() -> void:
	var ahora := reloj()
	var dur := maxf(0.03, intervalo)
	for e in ents.values():
		if e.x0 == e.x1 and e.y0 == e.y1:
			e.x = e.x1
			e.y = e.y1
			continue
		var f: float = (ahora - e.t0) / dur
		if f >= 1.0:
			e.x = e.x1
			e.y = e.y1
		else:
			e.x = lerpf(e.x0, e.x1, f)
			e.y = lerpf(e.y0, e.y1, f)


## Recalcula la niebla (como mucho cinco veces por segundo). Devuelve true si cambió.
func actualizar_vision(forzar := false) -> bool:
	var ahora := reloj()
	if not forzar and (not cambio_vision or ahora - _t_vision < 0.2) and ahora - _t_vision < 0.6:
		return false
	_t_vision = ahora
	cambio_vision = false
	if espectador:
		vis.fill(1)
		explorado.fill(1)
		return true
	var obs: Array = []
	for e in ents.values():
		var tx := clampi(int(e.x1) / 32, 0, w - 1)
		var ty := clampi(int(e.y1) / 32, 0, h - 1)
		if e.t == cat.especiales["convoy"] and aliado(e.dueno):
			obs.append([tx, ty, 6.0, niveles[ty * w + tx]])
			continue
		if e.tipo == null or e.fantasma or not aliado(e.dueno):
			continue
		var radio: float
		if e.es_edificio():
			var base: float = 3.0 if e.fl & cat.bandera("OBRA") else float(e.tipo["vision"])
			radio = base + maxf(float(e.tipo["ancho"]), float(e.tipo["alto"])) / 2.0
		elif e.dueno == yo:
			radio = cat.vision(faccion(yo), e.tipo)
		else:
			radio = float(e.tipo["vision"])
		obs.append([tx, ty, radio, niveles[ty * w + tx]])
	# lo que descubrió un reconocimiento se ve un rato desde cualquier altura
	var vigentes: Array = []
	for r in revelados:
		if r[3] > ahora:
			vigentes.append(r)
			obs.append([r[0], r[1], r[2], 2])
	revelados = vigentes
	vis = Vision.calcular(niveles, w, h, obs)
	for i in vis.size():
		if vis[i]:
			explorado[i] = 1
	# los fantasmas que ya se ven y no están, desaparecen
	for id in ents.keys():
		var e: Ent = ents[id]
		if e.fantasma and not e.es_recurso() and visible_px(e.x1, e.y1) and ahora - e.visto > 0.5:
			ents.erase(id)
	return true


func visible_px(x: float, y: float) -> bool:
	return vis[idx(int(x) / 32, int(y) / 32)] == 1


func explorado_px(x: float, y: float) -> bool:
	return explorado[idx(int(x) / 32, int(y) / 32)] == 1


func revelar(x: float, y: float, radio_px: float, segundos := 12.0) -> void:
	revelados.append([int(x) / 32, int(y) / 32, radio_px / 32.0, reloj() + segundos])
	cambio_vision = true


func tomar_eventos() -> Array:
	var ev := eventos
	eventos = []
	return ev
