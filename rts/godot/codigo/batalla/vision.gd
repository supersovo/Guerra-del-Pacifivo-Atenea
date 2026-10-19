## Niebla de guerra, con las mismas reglas que el servidor (salitre/sim/vision.py).
##
## Cada observador marca un círculo de casillas por tramos de filas, en una rejilla por
## nivel de altura; desde un nivel bajo no se ve lo que está en uno más alto.
extends RefCounted

static var _cache_tramos := {}


## [[dy, dx_max], ...] de un círculo de 'radio' casillas (admite medias casillas).
static func tramos(radio: float) -> Array:
	var clave := redondear_par(radio * 2.0)
	if _cache_tramos.has(clave):
		return _cache_tramos[clave]
	var rr := clave
	var r := rr / 2
	var t: Array = []
	for dy in range(-r, r + 1):
		var v := rr * rr - (2 * dy) * (2 * dy)
		if v < 0:
			continue
		t.append([dy, int(sqrt(float(v))) / 2])
	_cache_tramos[clave] = t
	return t


## Redondeo como el de Python (los empates van al par), para que los círculos sean idénticos.
static func redondear_par(x: float) -> int:
	var piso := floorf(x)
	var resto := x - piso
	if absf(resto - 0.5) < 1e-9:
		return int(piso) if int(piso) % 2 == 0 else int(piso) + 1
	return int(round(x))


static func _marcar(rejilla: PackedByteArray, w: int, h: int, tx: int, ty: int, radio: float) -> void:
	for par in tramos(radio):
		var y: int = ty + par[0]
		if y < 0 or y >= h:
			continue
		var x0: int = maxi(0, tx - par[1])
		var x1: int = mini(w - 1, tx + par[1])
		var base := y * w
		for x in range(x0, x1 + 1):
			rejilla[base + x] = 1


## Rejilla de visibilidad (0/1 por casilla). observadores: [[tx, ty, radio, nivel], ...].
static func calcular(niveles: PackedByteArray, w: int, h: int, observadores: Array) -> PackedByteArray:
	var n := w * h
	var por_nivel: Array = [null, null, null]
	for o in observadores:
		var nv: int = mini(2, int(o[3]))
		if por_nivel[nv] == null:
			var r := PackedByteArray()
			r.resize(n)
			por_nivel[nv] = r
		_marcar(por_nivel[nv], w, h, int(o[0]), int(o[1]), float(o[2]))
	var out := PackedByteArray()
	out.resize(n)
	var r0: PackedByteArray = por_nivel[0] if por_nivel[0] != null else PackedByteArray()
	var r1: PackedByteArray = por_nivel[1] if por_nivel[1] != null else PackedByteArray()
	var r2: PackedByteArray = por_nivel[2] if por_nivel[2] != null else PackedByteArray()
	var hay0 := not r0.is_empty()
	var hay1 := not r1.is_empty()
	var hay2 := not r2.is_empty()
	for i in n:
		var nv := niveles[i]
		var v := (hay2 and r2[i] == 1)
		if not v and nv <= 1:
			v = hay1 and r1[i] == 1
		if not v and nv == 0:
			v = hay0 and r0[i] == 1
		if v:
			out[i] = 1
	return out
