## Modelos de maqueta generados por código: tropas, obras, yacimientos y decorados.
##
## Cada modelo se arma con piezas simples (cajas, cilindros, conos, esferas bajas y techos
## a dos aguas) con el color en los vértices y caras planas, como figuras de plomo
## pintadas a mano sobre su peana. Las unidades miran hacia +X (el este) con los pies en
## y = 0; las obras se centran en su planta (x al este, z al sur) con el frente al sur, hacia
## la cámara. Los modelos se guardan en caché por forma, nación y color del jugador; más
## adelante cualquiera puede cambiarse por un modelo .glb sin tocar el resto.
extends RefCounted

const PIEL := [Color8(222, 184, 150), Color8(196, 150, 112), Color8(168, 120, 86), Color8(140, 98, 68)]
const RADIO_PEANA := 0.15     # la peana de una figura a escala 1 (en casillas)
const BOTAS := Color8(34, 26, 20)
const CUERO := Color8(96, 64, 38)
const CUERO_BLANCO := Color8(232, 228, 214)
const MADERA_FUSIL := Color8(110, 72, 40)
const ACERO := Color8(150, 156, 164)
const HIERRO := Color8(52, 56, 62)
const BRONCE := Color8(184, 140, 70)
const ORO := Color8(230, 196, 90)
const PAJA := Color8(222, 196, 120)
const CARMESI := Color8(150, 24, 52)
const BRIN := Color8(182, 160, 116)
const MANDIL := Color8(146, 100, 58)
const BARBA := Color8(86, 60, 38)
const MARINO := Color8(32, 40, 72)
const MORCILLO := Color8(38, 32, 30)
const ALAZAN := Color8(152, 90, 48)
const TORDILLO := Color8(150, 146, 140)
const LONA := Color8(226, 220, 200)
const CRUZ_ROJA := Color8(200, 30, 30)
const ADOBE := Color8(214, 196, 164)
const ADOBE_OSCURO := Color8(176, 152, 118)
const CAL := Color8(236, 230, 214)
const TEJA := Color8(158, 82, 58)
const CALAMINA := Color8(150, 150, 146)
const TABLA := Color8(140, 102, 66)
const TABLA_OSCURA := Color8(96, 70, 48)
const VIDRIO := Color8(48, 54, 62)
const SACO := Color8(176, 150, 104)
const TIERRA := Color8(150, 116, 80)
const CALICHE := Color8(238, 234, 222)
const AGUA := Color8(72, 118, 138)
const PIEDRA := Color8(150, 136, 118)
# infantes de línea, con correaje cruzado y mochila
const DE_LINEA := ["infante", "colorado", "zapador"]

# Partes animadas: cada vértice lleva en CUSTOM0 (parte, pivote x, y, z) y el sombreador
# de los modelos las mueve según los datos de la instancia (marcha, disparo).
const P_FIJA := 0
const P_PIERNA_I := 1        # pierna izquierda (y su bota)
const P_PIERNA_D := 2
const P_BRAZO_ARMA := 3      # brazo derecho con el fusil: apunta al hacer fuego
const P_PATA_DI := 4         # patas del caballo: delantera izquierda...
const P_PATA_DD := 5
const P_PATA_TI := 6
const P_PATA_TD := 7
const P_RUEDA := 8           # gira con el camino recorrido
const P_CANON := 9           # caño de la pieza: retrocede al disparar
const P_BANDERA := 10        # ondea con el viento
const P_ASPAS := 11          # aspas del molino: giran siempre
const P_BRAZO_I := 12        # brazo izquierdo: bracea al marchar
const P_SABLE := 13          # brazo del sable: tajo al atacar

static var _cache := {}
static var _material: ShaderMaterial
static var _material_plano: StandardMaterial3D


## Ensambla piezas en una malla con caras planas y el color en los vértices.
class Constructor:
	extends RefCounted
	var v := PackedVector3Array()
	var n := PackedVector3Array()
	var c := PackedColorArray()
	var pc := PackedFloat32Array()      # CUSTOM0 de cada vértice: parte y pivote
	var xf := Transform3D.IDENTITY
	var parte := 0
	var pivote := Vector3.ZERO

	## Lo que se agregue de aquí en adelante pertenece a la parte animada p, que gira en torno a piv.
	func animar(p: int, piv := Vector3.ZERO) -> void:
		parte = p
		pivote = piv

	## Polígono convexo (vértices en orden alrededor), orientado hacia afuera de 'dentro'.
	func cara(pts: Array, col: Color, dentro: Vector3) -> void:
		var q: Array[Vector3] = []
		for p in pts:
			q.append(xf * p)
		var d: Vector3 = xf * dentro
		var centro := Vector3.ZERO
		for p in q:
			centro += p
		centro /= q.size()
		var nn := (q[1] - q[0]).cross(q[2] - q[0])
		if nn.length_squared() < 1e-14 and q.size() > 3:
			nn = (q[2] - q[0]).cross(q[3] - q[0])
		if nn.length_squared() < 1e-14:
			return
		if nn.dot(centro - d) < 0.0:
			q.reverse()
			nn = -nn
		nn = nn.normalized()
		var piv: Vector3 = xf * pivote
		# Godot toma como cara visible la de vértices en sentido horario
		for k in range(1, q.size() - 1):
			v.append(q[0])
			v.append(q[k + 1])
			v.append(q[k])
			for _i in 3:
				n.append(nn)
				c.append(col)
				pc.append_array([parte, piv.x, piv.y, piv.z])

	func caja(centro: Vector3, tam: Vector3, col: Color, col_arriba: Variant = null) -> void:
		var h := tam / 2.0
		var p: Array[Vector3] = []
		for k in 8:
			p.append(centro + Vector3(h.x if k & 1 else -h.x, h.y if k & 2 else -h.y, h.z if k & 4 else -h.z))
		var arriba: Color = col_arriba if col_arriba != null else col
		cara([p[2], p[3], p[7], p[6]], arriba, centro)
		cara([p[0], p[1], p[5], p[4]], col.darkened(0.2), centro)
		cara([p[1], p[3], p[7], p[5]], col, centro)
		cara([p[0], p[2], p[6], p[4]], col, centro)
		cara([p[4], p[5], p[7], p[6]], col, centro)
		cara([p[0], p[1], p[3], p[2]], col, centro)

	## Cilindro (o cono, o tronco de cono) vertical desde 'base'.
	func cilindro(base: Vector3, radio: float, alto: float, col: Color, lados := 8, radio_arriba := -1.0,
			col_tapa: Variant = null) -> void:
		var r2 := radio if radio_arriba < 0.0 else radio_arriba
		var dentro := base + Vector3(0, alto * 0.5, 0)
		var abajo: Array[Vector3] = []
		var arriba: Array[Vector3] = []
		for k in lados:
			var a := TAU * k / lados
			var d := Vector3(cos(a), 0, sin(a))
			abajo.append(base + d * radio)
			arriba.append(base + d * r2 + Vector3(0, alto, 0))
		var tapa: Color = col_tapa if col_tapa != null else col
		for k in lados:
			var k2 := (k + 1) % lados
			if r2 > 0.0005:
				cara([abajo[k], abajo[k2], arriba[k2], arriba[k]], col, dentro)
			else:
				cara([abajo[k], abajo[k2], base + Vector3(0, alto, 0)], col, dentro)
		if r2 > 0.0005:
			cara(arriba, tapa, dentro)
		cara(abajo, col.darkened(0.2), dentro)

	## Barra (cilindro o cono) de 'a' a 'b'.
	func barra(a: Vector3, b: Vector3, radio: float, col: Color, lados := 6, radio_b := -1.0) -> void:
		var eje := b - a
		var largo := eje.length()
		if largo < 0.0001:
			return
		var dir := eje / largo
		var u := dir.cross(Vector3.UP)
		if u.length_squared() < 0.001:
			u = dir.cross(Vector3.RIGHT)
		u = u.normalized()
		var w := dir.cross(u).normalized()
		var r2 := radio if radio_b < 0.0 else radio_b
		var ra: Array[Vector3] = []
		var rb: Array[Vector3] = []
		for k in lados:
			var ang := TAU * k / lados
			var off := u * cos(ang) + w * sin(ang)
			ra.append(a + off * radio)
			rb.append(b + off * r2)
		var dentro := (a + b) * 0.5
		for k in lados:
			var k2 := (k + 1) % lados
			if r2 > 0.0005:
				cara([ra[k], ra[k2], rb[k2], rb[k]], col, dentro)
			else:
				cara([ra[k], ra[k2], b], col, dentro)
		cara(ra, col, dentro)
		if r2 > 0.0005:
			cara(rb, col, dentro)

	## Esfera baja (o elipsoide) de pocas caras.
	func esfera(centro: Vector3, radio: Vector3, col: Color, anillos := 4, lados := 8) -> void:
		var pts: Array = []
		for i in anillos + 1:
			var t := PI * i / anillos
			var fila: Array[Vector3] = []
			for k in lados:
				var a := TAU * k / lados
				fila.append(centro + Vector3(sin(t) * cos(a) * radio.x, cos(t) * radio.y, sin(t) * sin(a) * radio.z))
			pts.append(fila)
		for i in anillos:
			for k in lados:
				var k2 := (k + 1) % lados
				if i == 0:
					cara([pts[0][k], pts[1][k2], pts[1][k]], col, centro)
				elif i == anillos - 1:
					cara([pts[i][k], pts[i][k2], pts[i + 1][k]], col, centro)
				else:
					cara([pts[i][k], pts[i][k2], pts[i + 1][k2], pts[i + 1][k]], col, centro)

	## Techo a dos aguas con la cumbrera paralela al eje x; 'base' es el centro de su arranque.
	func techo(base: Vector3, largo: float, ancho: float, alto: float, col: Color, col_frontis: Color, alero := 0.06) -> void:
		var hx := largo / 2.0 + alero
		var hz := ancho / 2.0 + alero
		var dentro := base + Vector3(0, alto * 0.3, 0)
		var cn := base + Vector3(-hx, 0, -hz)
		var ce := base + Vector3(hx, 0, -hz)
		var se := base + Vector3(hx, 0, hz)
		var so := base + Vector3(-hx, 0, hz)
		var co := base + Vector3(-hx, alto, 0)
		var cf := base + Vector3(hx, alto, 0)
		cara([cn, ce, cf, co], col.darkened(0.08), dentro)
		cara([so, se, cf, co], col, dentro)
		cara([cn, so, co], col_frontis, dentro)
		cara([ce, se, cf], col_frontis, dentro)
		cara([cn, ce, se, so], col.darkened(0.35), dentro)

	## Disco plano mirando hacia arriba.
	func disco(centro: Vector3, radio: float, col: Color, lados := 12) -> void:
		var pts: Array[Vector3] = []
		for k in lados:
			var a := TAU * k / lados
			pts.append(centro + Vector3(cos(a) * radio, 0, sin(a) * radio))
		cara(pts, col, centro - Vector3(0, 1, 0))

	## Anillo plano mirando hacia arriba.
	func anillo(centro: Vector3, r0: float, r1: float, col: Color, lados := 24) -> void:
		for k in lados:
			var a0 := TAU * k / lados
			var a1 := TAU * (k + 1) / lados
			var d0 := Vector3(cos(a0), 0, sin(a0))
			var d1 := Vector3(cos(a1), 0, sin(a1))
			cara([centro + d0 * r0, centro + d0 * r1, centro + d1 * r1, centro + d1 * r0], col, centro - Vector3(0, 1, 0))

	func girar(angulo_y: float, origen := Vector3.ZERO) -> void:
		xf = Transform3D(Basis(Vector3.UP, angulo_y), origen)

	func recto() -> void:
		xf = Transform3D.IDENTITY


# ----------------------------------------------------------------------
# Materiales

## Material común de todos los modelos (colores en los vértices y niebla de guerra).
static func material() -> ShaderMaterial:
	if _material == null:
		_material = ShaderMaterial.new()
		_material.shader = load("res://sombreadores/modelo.gdshader")
	return _material


## Material sin luz para anillos de selección y marcas sobre el suelo.
static func material_plano() -> StandardMaterial3D:
	if _material_plano == null:
		_material_plano = StandardMaterial3D.new()
		_material_plano.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		_material_plano.vertex_color_use_as_albedo = true
		_material_plano.vertex_color_is_srgb = true
		_material_plano.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		_material_plano.cull_mode = BaseMaterial3D.CULL_DISABLED
		_material_plano.no_depth_test = false
	return _material_plano


static func _terminar(k: Constructor, mat: Material = null) -> ArrayMesh:
	var arr := []
	arr.resize(Mesh.ARRAY_MAX)
	arr[Mesh.ARRAY_VERTEX] = k.v
	arr[Mesh.ARRAY_NORMAL] = k.n
	arr[Mesh.ARRAY_COLOR] = k.c
	arr[Mesh.ARRAY_CUSTOM0] = k.pc
	var m := ArrayMesh.new()
	if not k.v.is_empty():
		m.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr, [], {},
				Mesh.ARRAY_CUSTOM_RGBA_FLOAT << Mesh.ARRAY_FORMAT_CUSTOM0_SHIFT)
		m.surface_set_material(0, mat if mat != null else material())
	return m


static func _de_cache(clave: String, fabricar: Callable) -> ArrayMesh:
	if not _cache.has(clave):
		_cache[clave] = fabricar.call()
	return _cache[clave]


# ----------------------------------------------------------------------
# Colores de la tropa

## Ropa de una figura: colores de la nación, rasgos del arma y los colores propios del arma.
static func ropa(base: Dictionary, propio: Dictionary, forma: String, color_jugador: Color) -> Dictionary:
	var r := {
		"casaca": base.get("casaca", Color8(60, 60, 90)),
		"pantalon": base.get("pantalon", Color8(90, 90, 90)),
		"kepi": base.get("kepi", Color8(120, 40, 40)),
		"franja": base.get("franja", Color8(40, 40, 90)),
		"cubrenuca": base.get("cubrenuca", Color8(230, 226, 210)),
		"detalle": base.get("detalle", Color8(220, 190, 90)),
		"jugador": color_jugador,
		"piel": PIEL[0],
		"correaje": CUERO_BLANCO,
		"caballo": Color8(110, 72, 44),
	}
	match forma:
		"colorado":
			r.merge({"casaca": Color8(184, 30, 32), "pantalon": Color8(236, 234, 226), "kepi": Color8(184, 30, 32),
					"franja": Color8(30, 30, 30)}, true)
		"trabajador":
			r.merge({"casaca": Color8(70, 86, 118), "pantalon": Color8(52, 60, 80), "kepi": PAJA, "piel": PIEL[1]}, true)
		"espia":
			r.merge({"casaca": Color8(62, 56, 50), "pantalon": Color8(80, 72, 62), "kepi": Color8(40, 36, 32),
					"piel": PIEL[1]}, true)
		"montonero":
			r.merge({"casaca": Color8(150, 60, 40), "pantalon": Color8(90, 76, 60), "kepi": Color8(70, 56, 40),
					"piel": PIEL[2]}, true)
		"baqueano":
			r.merge({"casaca": Color8(120, 90, 60), "pantalon": Color8(60, 56, 50), "kepi": Color8(50, 40, 32),
					"piel": PIEL[2], "caballo": Color8(124, 96, 70)}, true)
		"zapador":
			r.merge({"kepi": r["casaca"].darkened(0.25), "franja": CARMESI, "correaje": CUERO, "barba": true}, true)
		"ingeniero":
			r.merge({"casaca": BRIN, "kepi": r["casaca"].darkened(0.25), "cinta": CARMESI}, true)
		"torpedista":
			r.merge({"casaca": MARINO, "pantalon": Color8(228, 226, 218), "kepi": Color8(28, 32, 54)}, true)
		"jinete_sable":
			r.merge({"morrion": r["kepi"], "chabraque": r["casaca"], "caballo": MORCILLO}, true)
		"jinete_carabina":
			r.merge({"chabraque": r["casaca"], "caballo": ALAZAN}, true)
		"heroe_montado":
			r.merge({"caballo": TORDILLO, "chabraque": r["casaca"]}, true)
	for k in propio:
		r[k] = propio[k]
	return r


# ----------------------------------------------------------------------
# Figuras a pie

## Peana de la figura (como las miniaturas de un juego de mesa): el canto, del color del
## jugador; arriba, tierra pintada.
static func _peana(k: Constructor, color: Color, radio := RADIO_PEANA) -> void:
	k.cilindro(Vector3(0, 0, 0), radio, 0.026, color, 12, radio * 0.96, Color8(112, 98, 72).lerp(color, 0.18))


static func _a_pie(k: Constructor, r: Dictionary, forma: String, insignia: Variant, arma := true) -> void:
	var piel: Color = r["piel"]
	var casaca: Color = r["casaca"]
	var pantalon: Color = r["pantalon"]
	var falda := forma == "cantinera" or forma == "heroina"
	# piernas y botas (cada pierna se mueve al marchar), o la falda
	if falda:
		k.cilindro(Vector3(0, 0.025, 0), 0.105, 0.25, pantalon, 8, 0.07)
		k.caja(Vector3(0.012, 0.035, 0), Vector3(0.08, 0.03, 0.09), BOTAS)
	else:
		for lado in [-1.0, 1.0]:
			k.animar(P_PIERNA_I if lado < 0.0 else P_PIERNA_D, Vector3(0, 0.27, 0.042 * lado))
			k.caja(Vector3(0.0, 0.17, 0.042 * lado), Vector3(0.068, 0.2, 0.062), pantalon)
			k.caja(Vector3(0.012, 0.05, 0.042 * lado), Vector3(0.09, 0.055, 0.068), BOTAS)
		k.animar(P_FIJA)
	# torso, poncho o blusa
	var poncho := forma == "espia" or forma == "montonero"
	if poncho:
		k.cilindro(Vector3(0, 0.24, 0), 0.125, 0.23, casaca, 8, 0.05)
	else:
		k.caja(Vector3(0, 0.365, 0), Vector3(0.12, 0.2, 0.155), casaca)
		k.caja(Vector3(0.061, 0.39, 0), Vector3(0.004, 0.11, 0.012), r["detalle"])       # botonadura
		k.caja(Vector3(0, 0.28, 0), Vector3(0.126, 0.026, 0.161), r["correaje"] if forma in DE_LINEA else CUERO)
		if forma in DE_LINEA:
			# correaje cruzado, mochila con la manta enrollada, cartuchera y cantimplora
			k.caja(Vector3(0.062, 0.37, 0.0), Vector3(0.006, 0.17, 0.02), r["correaje"])
			k.caja(Vector3(-0.085, 0.38, 0), Vector3(0.05, 0.13, 0.12), CUERO)
			k.barra(Vector3(-0.085, 0.46, -0.07), Vector3(-0.085, 0.46, 0.07), 0.028, Color8(120, 110, 96), 6)
			k.caja(Vector3(-0.066, 0.285, 0.045), Vector3(0.03, 0.045, 0.06), CUERO.darkened(0.2))
		if forma != "trabajador":
			k.barra(Vector3(0.0, 0.3, -0.083), Vector3(0.0, 0.3, -0.105), 0.032, Color8(176, 168, 150), 8)
		if forma == "zapador" or forma == "ingeniero":
			k.caja(Vector3(0.064, 0.3, 0), Vector3(0.008, 0.16, 0.12), MANDIL if forma == "zapador" else BRIN.darkened(0.1))
		if r.has("cinta"):
			k.caja(Vector3(0.0, 0.43, 0), Vector3(0.124, 0.02, 0.159), r["cinta"])
	# brazos: el izquierdo bracea al marchar; el derecho lleva el arma y apunta al hacer fuego
	var quietos := forma in ["camillero", "conductor", "artillero"]
	var parte_der := P_FIJA
	if arma:
		match forma:
			"heroe_a_pie", "heroina":
				parte_der = P_FIJA if insignia == "cantinera" else P_SABLE
			"cantinera", "espia", "torpedista":
				parte_der = P_FIJA
			_:
				parte_der = P_BRAZO_ARMA
	for lado in [-1.0, 1.0]:
		if lado < 0.0:
			k.animar(P_FIJA if quietos else P_BRAZO_I, Vector3(0, 0.45, -0.097))
		else:
			k.animar(parte_der, Vector3(0, 0.45, 0.097))
		k.caja(Vector3(0.0, 0.37, 0.097 * lado), Vector3(0.052, 0.17, 0.048), casaca)
		k.caja(Vector3(0.012, 0.272, 0.097 * lado), Vector3(0.044, 0.04, 0.044), piel)
		if lado > 0.0 and arma:
			_en_la_mano(k, forma, insignia)
		k.animar(P_FIJA)
	if forma == "heroe_a_pie" or forma == "heroina":
		for lado in [-1.0, 1.0]:
			k.caja(Vector3(0.0, 0.458, 0.085 * lado), Vector3(0.07, 0.018, 0.05), ORO)
	# cabeza
	k.esfera(Vector3(0.005, 0.505, 0), Vector3(0.048, 0.054, 0.048), piel)
	k.caja(Vector3(0.05, 0.5, 0), Vector3(0.012, 0.012, 0.03), piel.darkened(0.1))    # nariz
	if r.get("barba", false):
		k.caja(Vector3(0.035, 0.48, 0), Vector3(0.03, 0.04, 0.07), BARBA)
	_sombrero(k, r, forma, Vector3(0, 0.535, 0))
	if not arma:
		return
	# lo que va a la espalda o en la otra mano
	match forma:
		"torpedista":
			_fusil(k, Vector3(-0.02, 0.27, -0.12))
		"zapador":
			k.barra(Vector3(-0.11, 0.25, -0.05), Vector3(-0.11, 0.62, -0.05), 0.01, MADERA_FUSIL)
			k.caja(Vector3(-0.11, 0.65, -0.05), Vector3(0.012, 0.07, 0.05), HIERRO)
		"cantinera":
			k.barra(Vector3(-0.03, 0.27, 0.12), Vector3(-0.03, 0.27, 0.17), 0.045, TABLA, 8)
		"heroe_a_pie", "heroina":
			if insignia == "cantinera":
				k.barra(Vector3(-0.03, 0.27, 0.12), Vector3(-0.03, 0.27, 0.17), 0.045, TABLA, 8)


## Lo que lleva en la mano derecha (se mueve con el brazo).
static func _en_la_mano(k: Constructor, forma: String, insignia: Variant) -> void:
	match forma:
		"trabajador":
			k.barra(Vector3(0.03, 0.2, 0.12), Vector3(0.0, 0.62, 0.12), 0.011, MADERA_FUSIL)
			k.barra(Vector3(-0.04, 0.62, 0.12), Vector3(0.05, 0.6, 0.12), 0.012, HIERRO, 4)
		"cantinera", "espia", "torpedista":
			if forma == "torpedista":
				k.barra(Vector3(0.05, 0.3, 0.13), Vector3(0.05, 0.3, 0.2), 0.035, Color8(40, 38, 36), 8)
		"montonero":
			k.barra(Vector3(0.04, 0.05, 0.12), Vector3(0.0, 0.95, 0.12), 0.01, MADERA_FUSIL)
			k.barra(Vector3(0.0, 0.95, 0.12), Vector3(-0.003, 1.03, 0.12), 0.014, ACERO, 4, 0.0)
		"heroe_a_pie", "heroina":
			if insignia != "cantinera":
				# sable en alto
				k.barra(Vector3(0.03, 0.3, 0.12), Vector3(0.22, 0.64, 0.12), 0.007, ACERO, 4)
				k.caja(Vector3(0.035, 0.31, 0.12), Vector3(0.03, 0.012, 0.04), ORO)
		_:
			_fusil(k, Vector3(0.02, 0.27, 0.12))


static func _fusil(k: Constructor, mano: Vector3) -> void:
	# fusil al hombro, con la bayoneta calada
	var arriba := mano + Vector3(-0.05, 0.45, 0)
	k.barra(mano, arriba, 0.012, MADERA_FUSIL, 4)
	k.barra(arriba, arriba + Vector3(-0.008, 0.09, 0), 0.006, ACERO, 4, 0.0)


static func _sombrero(k: Constructor, r: Dictionary, forma: String, base: Vector3) -> void:
	match forma:
		"trabajador":
			k.cilindro(base + Vector3(0, -0.005, 0), 0.095, 0.012, PAJA, 10)
			k.cilindro(base, 0.045, 0.055, PAJA.darkened(0.08), 8, 0.04)
			k.cilindro(base + Vector3(0, 0.008, 0), 0.047, 0.012, Color8(120, 60, 40), 8)
		"espia", "montonero", "baqueano":
			k.cilindro(base + Vector3(0, -0.005, 0), 0.09, 0.012, r["kepi"], 10)
			k.cilindro(base, 0.045, 0.06, r["kepi"].darkened(0.1), 8, 0.038)
		"cantinera", "heroina":
			k.cilindro(base + Vector3(0, -0.01, 0), 0.07, 0.01, r["kepi"], 10)
			k.cilindro(base, 0.042, 0.04, r["kepi"], 8, 0.04)
			k.esfera(base + Vector3(-0.04, -0.03, 0), Vector3(0.03, 0.03, 0.035), Color8(60, 40, 30))
		"torpedista":
			k.cilindro(base, 0.052, 0.03, r["kepi"], 10, 0.058)
			k.cilindro(base + Vector3(0, 0.002, 0), 0.053, 0.008, CUERO_BLANCO, 10)
		"jinete_sable":
			# morrión con pompón
			k.cilindro(base, 0.046, 0.1, r.get("morrion", r["kepi"]), 8, 0.05)
			k.cilindro(base + Vector3(0, 0.03, 0), 0.049, 0.018, r["franja"], 8, 0.05)
			k.esfera(base + Vector3(0.03, 0.115, 0), Vector3(0.018, 0.022, 0.018), r.get("pompon", r["kepi"]), 3, 6)
			k.caja(base + Vector3(0.05, 0.005, 0), Vector3(0.04, 0.01, 0.07), BOTAS)
		_:
			# quepí con visera, franja y cubrenuca
			k.cilindro(base, 0.05, 0.065, r["kepi"], 8, 0.042)
			k.cilindro(base + Vector3(0, 0.004, 0), 0.052, 0.014, r["franja"], 8, 0.051)
			k.caja(base + Vector3(0.052, 0.004, 0), Vector3(0.04, 0.01, 0.075), BOTAS)
			if forma in DE_LINEA:
				k.caja(base + Vector3(-0.046, -0.04, 0), Vector3(0.012, 0.075, 0.09), r["cubrenuca"])


# ----------------------------------------------------------------------
# Jinetes

static func _caballo(k: Constructor, col: Color, r: Dictionary) -> void:
	var crin := col.darkened(0.45)
	# cuerpo redondeado: pecho, barril y ancas
	k.esfera(Vector3(0.0, 0.335, 0), Vector3(0.2, 0.085, 0.075), col, 4, 8)
	k.esfera(Vector3(0.12, 0.35, 0), Vector3(0.085, 0.085, 0.072), col, 3, 8)
	k.esfera(Vector3(-0.13, 0.35, 0), Vector3(0.085, 0.09, 0.075), col, 3, 8)
	# cuello, cabeza, orejas, crin y cola
	k.barra(Vector3(0.14, 0.38, 0), Vector3(0.23, 0.53, 0), 0.05, col, 6, 0.036)
	k.barra(Vector3(0.22, 0.56, 0), Vector3(0.345, 0.495, 0), 0.036, col, 6, 0.024)
	k.caja(Vector3(0.345, 0.49, 0), Vector3(0.022, 0.03, 0.036), col.darkened(0.3))
	k.barra(Vector3(0.15, 0.45, 0), Vector3(0.235, 0.6, 0), 0.018, crin, 4)
	for lado in [-1.0, 1.0]:
		k.barra(Vector3(0.235, 0.58, 0.018 * lado), Vector3(0.225, 0.635, 0.022 * lado), 0.012, col, 4, 0.0)
	k.barra(Vector3(-0.2, 0.39, 0), Vector3(-0.26, 0.2, 0), 0.024, crin, 5, 0.01)
	# patas: cada una se mueve al trote o al galope
	for pata in [[0.13, -1.0, P_PATA_DI], [0.13, 1.0, P_PATA_DD], [-0.13, -1.0, P_PATA_TI], [-0.13, 1.0, P_PATA_TD]]:
		var x: float = pata[0]
		var z: float = 0.045 * float(pata[1])
		k.animar(int(pata[2]), Vector3(x, 0.3, z))
		k.barra(Vector3(x, 0.31, z), Vector3(x + 0.008, 0.16, z), 0.026, col, 5, 0.019)
		k.barra(Vector3(x + 0.008, 0.16, z), Vector3(x + 0.012, 0.045, z), 0.016, col, 5)
		k.caja(Vector3(x + 0.016, 0.025, z), Vector3(0.04, 0.035, 0.034), BOTAS)
		k.animar(P_FIJA)
	if r.has("chabraque"):
		k.caja(Vector3(-0.01, 0.41, 0), Vector3(0.16, 0.022, 0.17), r["chabraque"])
		k.caja(Vector3(-0.01, 0.4, 0), Vector3(0.165, 0.012, 0.175), r.get("galon", r["detalle"]))


static func _jinete(k: Constructor, r: Dictionary, forma: String, insignia: Variant) -> void:
	_caballo(k, r["caballo"], r)
	var piel: Color = r["piel"]
	var casaca: Color = r["casaca"]
	for lado in [-1.0, 1.0]:
		k.caja(Vector3(0.0, 0.42, 0.075 * lado), Vector3(0.1, 0.06, 0.05), r["pantalon"])
		k.caja(Vector3(0.03, 0.33, 0.08 * lado), Vector3(0.05, 0.13, 0.045), r["pantalon"])
		k.caja(Vector3(0.04, 0.26, 0.08 * lado), Vector3(0.07, 0.04, 0.05), BOTAS)
	var poncho := forma == "baqueano"
	if poncho:
		k.cilindro(Vector3(-0.01, 0.43, 0), 0.12, 0.22, casaca, 8, 0.05)
	else:
		k.caja(Vector3(-0.01, 0.53, 0), Vector3(0.11, 0.18, 0.14), casaca)
		k.caja(Vector3(-0.01, 0.45, 0), Vector3(0.115, 0.024, 0.145), CUERO_BLANCO if forma == "jinete_sable" else CUERO)
		if r.has("alamares"):
			for j in 3:
				k.caja(Vector3(0.05, 0.5 + j * 0.04, 0), Vector3(0.006, 0.012, 0.1), r["alamares"])
	var sable: bool = forma == "jinete_sable" or (forma == "heroe_montado" and insignia != "artillero")
	for lado in [-1.0, 1.0]:
		if lado > 0.0 and sable:
			k.animar(P_SABLE, Vector3(0.0, 0.6, 0.09))
		k.caja(Vector3(0.0, 0.53, 0.09 * lado), Vector3(0.048, 0.16, 0.045), casaca)
		if lado > 0.0 and sable:
			# sable en alto: da el tajo al atacar
			k.barra(Vector3(0.04, 0.47, 0.1), Vector3(0.22, 0.8, 0.12), 0.007, ACERO, 4)
			k.caja(Vector3(0.045, 0.48, 0.1), Vector3(0.03, 0.012, 0.04), ORO)
		k.animar(P_FIJA)
	if forma == "heroe_montado":
		for lado in [-1.0, 1.0]:
			k.caja(Vector3(-0.01, 0.62, 0.08 * lado), Vector3(0.07, 0.018, 0.05), ORO)
	k.esfera(Vector3(0.0, 0.67, 0), Vector3(0.046, 0.052, 0.046), piel)
	if forma == "heroe_montado":
		_sombrero(k, r, "infante_oficial", Vector3(0, 0.7, 0))
	else:
		_sombrero(k, r, forma, Vector3(0, 0.7, 0))
	if forma == "jinete_carabina":
		k.barra(Vector3(-0.08, 0.45, -0.08), Vector3(0.05, 0.7, -0.08), 0.011, MADERA_FUSIL, 4)
	elif forma == "baqueano":
		k.barra(Vector3(0.05, 0.3, 0.1), Vector3(0.0, 1.0, 0.1), 0.009, MADERA_FUSIL)
		k.barra(Vector3(0.0, 1.0, 0.1), Vector3(-0.003, 1.08, 0.1), 0.013, ACERO, 4, 0.0)


# ----------------------------------------------------------------------
# Artillería, carros y camillas

## Rueda de rayos (parte animada: gira con el camino recorrido).
static func _rueda(k: Constructor, centro: Vector3, radio: float, ancho: float, col: Color) -> void:
	var antes := k.parte
	var piv_antes := k.pivote
	k.animar(P_RUEDA, centro)
	k.barra(centro - Vector3(0, 0, ancho / 2), centro + Vector3(0, 0, ancho / 2), radio, col.darkened(0.25), 12)
	k.barra(centro - Vector3(0, 0, ancho / 2 + 0.008), centro + Vector3(0, 0, ancho / 2 + 0.008), radio * 0.28, col.darkened(0.4), 6)
	for cara in [-1.0, 1.0]:
		var c := Vector3(centro.x, centro.y, centro.z + cara * (ancho / 2 + 0.004))
		for j in 3:
			var a := PI * j / 3.0
			var d := Vector3(cos(a), sin(a), 0) * radio * 0.92
			k.barra(c - d, c + d, 0.008, col.lightened(0.15), 4)
	k.animar(antes, piv_antes)


static func _pieza(k: Constructor, r: Dictionary, forma: String) -> void:
	var madera := Color8(92, 74, 52) if forma != "gatling" else Color8(80, 86, 70)
	for lado in [-1.0, 1.0]:
		_rueda(k, Vector3(0, 0.14, 0.14 * lado), 0.14, 0.03, madera)
	k.barra(Vector3(0, 0.14, -0.14), Vector3(0, 0.14, 0.14), 0.016, HIERRO, 5)
	k.caja(Vector3(-0.05, 0.17, 0), Vector3(0.26, 0.07, 0.11), madera.darkened(0.1))
	k.barra(Vector3(-0.05, 0.16, 0), Vector3(-0.42, 0.03, 0), 0.032, madera, 5)
	if forma == "gatling":
		var eje_y := 0.27
		k.animar(P_CANON, Vector3(-0.06, eje_y, 0))
		for j in 6:
			var a := TAU * j / 6
			var off := Vector3(0, sin(a) * 0.028, cos(a) * 0.028)
			k.barra(Vector3(-0.06, eje_y, 0) + off, Vector3(0.32, eje_y, 0) + off, 0.009, HIERRO, 4)
		k.barra(Vector3(-0.1, eje_y, 0), Vector3(0.0, eje_y, 0), 0.05, BRONCE, 8)
		k.barra(Vector3(0.22, eje_y, 0), Vector3(0.24, eje_y, 0), 0.042, BRONCE, 8)
		k.caja(Vector3(-0.05, eje_y, 0.07), Vector3(0.03, 0.03, 0.03), HIERRO)
		k.cilindro(Vector3(-0.02, eje_y + 0.045, 0), 0.02, 0.06, BRONCE, 6)
		k.animar(P_FIJA)
	else:
		var largo := 0.4 if forma == "canon_campana" else 0.3
		var col: Color = HIERRO if forma == "canon_campana" else BRONCE
		k.animar(P_CANON, Vector3(-0.1, 0.22, 0))
		k.barra(Vector3(-0.1, 0.22, 0), Vector3(-0.1 + largo, 0.22, 0), 0.048, col, 8, 0.034)
		k.barra(Vector3(-0.12, 0.22, 0), Vector3(-0.1, 0.22, 0), 0.03, col.darkened(0.2), 6)
		k.barra(Vector3(-0.1 + largo - 0.02, 0.22, 0), Vector3(-0.1 + largo + 0.005, 0.22, 0), 0.04, col.lightened(0.1), 8)
		k.animar(P_FIJA)
	# un sirviente de la pieza, con el escobillón
	var sirviente := Constructor.new()
	_a_pie(sirviente, r, "artillero", null, false)
	k.xf = Transform3D(Basis(Vector3.UP, 0.6).scaled(Vector3(0.92, 0.92, 0.92)), Vector3(-0.28, 0, 0.22))
	_copiar(k, sirviente)
	k.barra(Vector3(0.03, 0.27, 0.12), Vector3(0.3, 0.36, 0.12), 0.008, MADERA_FUSIL, 4)
	k.recto()


## Agrega a k las caras ya armadas de otro constructor (con la transformación actual de k);
## las partes animadas conservan su parte y su pivote, llevado al lugar nuevo.
static func _copiar(k: Constructor, otro: Constructor) -> void:
	var b := k.xf.basis
	for i in otro.v.size():
		k.v.append(k.xf * otro.v[i])
		k.n.append((b * otro.n[i]).normalized())
		k.c.append(otro.c[i])
		var piv: Vector3 = k.xf * Vector3(otro.pc[i * 4 + 1], otro.pc[i * 4 + 2], otro.pc[i * 4 + 3])
		k.pc.append_array([otro.pc[i * 4], piv.x, piv.y, piv.z])


static func _carro(k: Constructor, r: Dictionary, forma: String) -> void:
	var madera := TABLA
	for lado in [-1.0, 1.0]:
		_rueda(k, Vector3(-0.08, 0.15, 0.16 * lado), 0.15, 0.03, TABLA_OSCURA)
	k.barra(Vector3(-0.08, 0.15, -0.16), Vector3(-0.08, 0.15, 0.16), 0.015, HIERRO, 5)
	k.caja(Vector3(-0.08, 0.24, 0), Vector3(0.42, 0.04, 0.26), madera)
	for lado in [-1.0, 1.0]:
		k.caja(Vector3(-0.08, 0.29, 0.13 * lado), Vector3(0.42, 0.07, 0.015), madera.darkened(0.1))
		k.barra(Vector3(0.13, 0.22, 0.07 * lado), Vector3(0.42, 0.2, 0.07 * lado), 0.012, madera, 4)
	if forma == "ambulancia":
		# toldo de lona con la cruz roja
		for j in 4:
			var x := -0.26 + j * 0.12
			k.barra(Vector3(x, 0.27, -0.13), Vector3(x, 0.27, 0.13), 0.004, madera, 3)
		k.barra(Vector3(-0.3, 0.32, 0), Vector3(0.14, 0.32, 0), 0.15, LONA, 8)
		k.caja(Vector3(-0.08, 0.36, 0.152), Vector3(0.1, 0.03, 0.006), CRUZ_ROJA)
		k.caja(Vector3(-0.08, 0.36, 0.152), Vector3(0.03, 0.1, 0.006), CRUZ_ROJA)
		k.caja(Vector3(-0.08, 0.36, -0.152), Vector3(0.1, 0.03, 0.006), CRUZ_ROJA)
		k.caja(Vector3(-0.08, 0.36, -0.152), Vector3(0.03, 0.1, 0.006), CRUZ_ROJA)
	else:
		# la pipa de agua
		k.barra(Vector3(-0.27, 0.38, 0), Vector3(0.11, 0.38, 0), 0.12, Color8(120, 84, 50), 10)
		for x in [-0.22, -0.08, 0.06]:
			k.barra(Vector3(x, 0.38, 0), Vector3(x + 0.015, 0.38, 0), 0.125, HIERRO, 10)
		k.cilindro(Vector3(-0.08, 0.49, 0), 0.025, 0.03, TABLA_OSCURA, 6)
	# la mula o el caballo de tiro, y el conductor
	var tiro := Constructor.new()
	_caballo(tiro, Color8(122, 100, 84) if forma == "carreta_agua" else Color8(110, 72, 44), {})
	k.xf = Transform3D(Basis.IDENTITY.scaled(Vector3(0.85, 0.85, 0.85)), Vector3(0.5, 0, 0))
	_copiar(k, tiro)
	k.recto()
	var conductor := Constructor.new()
	_a_pie(conductor, r, "conductor", null, false)
	k.xf = Transform3D(Basis.IDENTITY.scaled(Vector3(0.85, 0.85, 0.85)), Vector3(0.12, 0.2, 0.0))
	_copiar(k, conductor)
	k.recto()


static func _camilleros(k: Constructor, r: Dictionary, con_herido: bool) -> void:
	var sanidad := r.duplicate()
	sanidad["casaca"] = Color8(214, 208, 190)
	for x in [0.24, -0.24]:
		var f := Constructor.new()
		_a_pie(f, sanidad, "camillero", null, false)
		k.xf = Transform3D(Basis.IDENTITY, Vector3(x, 0, 0))
		_copiar(k, f)
		k.recto()
		k.caja(Vector3(x, 0.37, 0.07), Vector3(0.06, 0.06, 0.02), CRUZ_ROJA)
	for lado in [-1.0, 1.0]:
		k.barra(Vector3(-0.32, 0.28, 0.1 * lado), Vector3(0.32, 0.28, 0.1 * lado), 0.008, MADERA_FUSIL, 4)
	k.caja(Vector3(0, 0.285, 0), Vector3(0.38, 0.008, 0.18), LONA)
	if con_herido:
		k.caja(Vector3(0, 0.32, 0), Vector3(0.28, 0.06, 0.12), r["casaca"])
		k.esfera(Vector3(0.17, 0.33, 0), Vector3(0.04, 0.035, 0.04), r["piel"])
		k.caja(Vector3(-0.02, 0.36, 0), Vector3(0.06, 0.005, 0.1), CRUZ_ROJA)


# ----------------------------------------------------------------------
# Buques (proa hacia +X, cubierta sobre el agua)

static func _casco(k: Constructor, largo: float, manga: float, col: Color, cubierta: Color, franja: Variant = null) -> void:
	var hx := largo / 2.0
	var hz := manga / 2.0
	var proa := largo * 0.22
	var arriba: Array[Vector3] = [Vector3(-hx, 0.12, -hz * 0.8), Vector3(hx - proa, 0.12, -hz), Vector3(hx, 0.14, 0),
			Vector3(hx - proa, 0.12, hz), Vector3(-hx, 0.12, hz * 0.8), Vector3(-hx - 0.05, 0.12, 0)]
	var abajo: Array[Vector3] = []
	for p in arriba:
		abajo.append(Vector3(p.x * 0.9, -0.16, p.z * 0.55))
	var dentro := Vector3(0, -0.02, 0)
	for i in arriba.size():
		var j := (i + 1) % arriba.size()
		k.cara([arriba[i], arriba[j], abajo[j], abajo[i]], col, dentro)
	k.cara(arriba, cubierta, dentro)
	k.cara(abajo, col.darkened(0.3), dentro)
	if franja != null:
		# franja pintada a lo largo de la borda, apenas separada del casco
		for i in arriba.size():
			var j := (i + 1) % arriba.size()
			var a0 := arriba[i].lerp(abajo[i], 0.1)
			var a1 := arriba[j].lerp(abajo[j], 0.1)
			var b0 := arriba[i].lerp(abajo[i], 0.2)
			var b1 := arriba[j].lerp(abajo[j], 0.2)
			var nn := (a1 - a0).cross(b0 - a0).normalized()
			if nn.dot((a0 + a1 + b0 + b1) / 4.0 - dentro) < 0.0:
				nn = -nn
			var off := nn * 0.004
			k.cara([a0 + off, a1 + off, b1 + off, b0 + off], franja, dentro)


static func _buque(k: Constructor, forma: String, color: Color, insignia: Variant) -> void:
	match forma:
		"monitor":
			_casco(k, 2.1, 0.5, Color8(64, 66, 70), Color8(110, 108, 100))
			k.cilindro(Vector3(0.35, 0.12, 0), 0.17, 0.13, Color8(70, 72, 76), 10)
			for lado in [-1.0, 1.0]:
				k.barra(Vector3(0.4, 0.19, 0.05 * lado), Vector3(0.78, 0.19, 0.05 * lado), 0.028, Color8(40, 40, 44), 6)
			k.caja(Vector3(-0.15, 0.2, 0), Vector3(0.22, 0.16, 0.2), Color8(90, 90, 88))
			k.cilindro(Vector3(-0.2, 0.28, 0), 0.06, 0.3, Color8(36, 32, 30), 8)
			k.barra(Vector3(-0.45, 0.12, 0), Vector3(-0.45, 0.85, 0), 0.015, Color8(70, 56, 40), 5)
		"corbeta":
			_casco(k, 2.2, 0.48, Color8(30, 28, 28), Color8(176, 150, 112), CUERO_BLANCO)
			for x in [-0.55, 0.0, 0.55]:
				k.barra(Vector3(x, 0.12, 0), Vector3(x, 1.25, 0), 0.016, Color8(90, 70, 50), 5)
				for j in 2:
					var y := 0.45 + j * 0.42
					k.caja(Vector3(x + 0.01, y, 0), Vector3(0.02, 0.3, 0.42 - j * 0.1), Color8(236, 232, 220))
					k.barra(Vector3(x, y + 0.16, -0.24), Vector3(x, y + 0.16, 0.24), 0.007, Color8(90, 70, 50), 4)
			k.cilindro(Vector3(-0.25, 0.12, 0), 0.05, 0.38, Color8(36, 32, 30), 8)
			for j in 5:
				for lado in [-1.0, 1.0]:
					k.caja(Vector3(-0.65 + j * 0.27, 0.07, 0.235 * lado), Vector3(0.04, 0.03, 0.01), Color8(20, 18, 16))
		"transporte":
			_casco(k, 2.0, 0.5, Color8(52, 40, 32), Color8(150, 128, 96))
			for j in 4:
				k.caja(Vector3(-0.55 + j * 0.26, 0.18, 0), Vector3(0.18, 0.1, 0.24), Color8(110, 86, 60))
			k.cilindro(Vector3(0.45, 0.12, 0), 0.06, 0.4, Color8(34, 30, 28), 8)
			k.cilindro(Vector3(0.45, 0.42, 0), 0.062, 0.04, color, 8)
			for x in [-0.2, 0.75]:
				k.barra(Vector3(x, 0.12, 0), Vector3(x, 0.95, 0), 0.014, Color8(80, 60, 44), 5)
		_:
			_casco(k, 1.9, 0.46, Color8(44, 44, 48), Color8(120, 116, 108))
			k.caja(Vector3(-0.05, 0.2, 0), Vector3(0.3, 0.14, 0.24), Color8(96, 96, 94))
			k.cilindro(Vector3(-0.05, 0.27, 0), 0.06, 0.34, Color8(34, 30, 28), 8)
			k.cilindro(Vector3(-0.05, 0.55, 0), 0.062, 0.04, color, 8)
			k.cilindro(Vector3(0.55, 0.12, 0), 0.07, 0.07, Color8(70, 70, 74), 8)
			k.barra(Vector3(0.55, 0.17, 0), Vector3(0.85, 0.17, 0), 0.025, Color8(40, 40, 44), 6)
			k.barra(Vector3(-0.45, 0.12, 0), Vector3(-0.45, 0.8, 0), 0.014, Color8(80, 60, 44), 5)
	# pabellón del jugador en la popa
	var popa := -1.0 if forma != "corbeta" else -1.05
	k.barra(Vector3(popa, 0.12, 0), Vector3(popa, 0.55, 0), 0.008, Color8(80, 60, 44), 4)
	k.animar(P_BANDERA, Vector3(popa, 0.5, 0))
	k.caja(Vector3(popa - 0.09, 0.5, 0), Vector3(0.17, 0.11, 0.008), color)
	if insignia == "heroe":
		k.caja(Vector3(popa - 0.09, 0.5, 0.006), Vector3(0.05, 0.05, 0.004), ORO)
	k.animar(P_FIJA)


# ----------------------------------------------------------------------
# Unidades

## Malla de una unidad: tipo (del catálogo), colores de la nación y color del jugador.
static func unidad(tipo: Dictionary, base: Dictionary, propio: Dictionary, color: Color, faccion: String,
		extra := "") -> ArrayMesh:
	var forma: String = tipo.get("forma", "infante")
	var insignia: Variant = tipo.get("insignia")
	var clave := "u|%s|%s|%s|%s|%s" % [forma, faccion, color.to_html(false), str(insignia), extra]
	var peana := not "sin_peana" in extra
	return _de_cache(clave, func() -> ArrayMesh:
		var k := Constructor.new()
		var r := ropa(base, propio, forma, color)
		match forma:
			"transporte", "canonera", "monitor", "corbeta":
				_buque(k, forma, color, insignia)
				return _terminar(k)
			"canon_montana", "canon_campana", "gatling":
				if peana:
					_peana(k, color, 0.3)
				_pieza(k, r, forma)
			"ambulancia", "carreta_agua":
				if peana:
					_peana(k, color, 0.3)
				_carro(k, r, forma)
			"camilleros":
				if peana:
					_peana(k, color, 0.26)
				_camilleros(k, r, "herido" in extra)
			"jinete_sable", "jinete_carabina", "baqueano", "heroe_montado":
				if peana:
					_peana(k, color, 0.2)
				_jinete(k, r, forma, insignia)
			_:
				if peana:
					_peana(k, color, 0.13)
				_a_pie(k, r, forma, insignia)
		return _terminar(k))


## Escala de la figura en el campo: más grande que el natural, como en todo juego de
## estrategia (siempre dentro del radio que le da la simulación); los héroes, algo más.
static func escala(tipo: Dictionary) -> float:
	var forma: String = tipo.get("forma", "infante")
	var e := 1.45
	if int(tipo.get("capa", 0)) == 1:
		e = 1.0
	elif forma in ["canon_montana", "canon_campana", "gatling", "ambulancia", "carreta_agua", "camilleros"]:
		e = 1.3
	if tipo.get("heroe", false):
		e *= 1.15
	return e


## Figura caída (baja o herido): la misma de pie, tendida en el suelo.
static func caido(tipo: Dictionary, base: Dictionary, propio: Dictionary, color: Color, faccion: String) -> ArrayMesh:
	var forma: String = tipo.get("forma", "infante")
	var clave := "caido|%s|%s|%s" % [forma, faccion, color.to_html(false)]
	return _de_cache(clave, func() -> ArrayMesh:
		var k := Constructor.new()
		var r := ropa(base, propio, forma, color)
		var f := Constructor.new()
		if forma in ["jinete_sable", "jinete_carabina", "baqueano", "heroe_montado"]:
			_a_pie(f, r, "infante", null, false)
		elif forma in ["canon_montana", "canon_campana", "gatling", "ambulancia", "carreta_agua", "camilleros"]:
			_a_pie(f, r, "infante", null, false)
		else:
			_a_pie(f, r, forma, null, false)
		k.xf = Transform3D(Basis(Vector3(0, 0, 1), -PI / 2.0), Vector3(-0.25, 0.06, 0))
		_copiar(k, f)
		k.recto()
		return _terminar(k))


# ----------------------------------------------------------------------
# Obras

static func _bandera(k: Constructor, pie: Vector3, alto: float, color: Color) -> void:
	k.barra(pie, pie + Vector3(0, alto, 0), 0.018, Color8(90, 70, 50), 5)
	k.esfera(pie + Vector3(0, alto + 0.02, 0), Vector3(0.025, 0.025, 0.025), ORO, 3, 6)
	# el paño ondea (parte animada, desde el asta)
	k.animar(P_BANDERA, pie + Vector3(0, alto - 0.13, 0))
	for j in 4:
		var x := 0.05 + j * 0.095
		k.caja(pie + Vector3(x, alto - 0.13, 0), Vector3(0.096, 0.24, 0.012), color)
	k.caja(pie + Vector3(0.2, alto - 0.13, 0), Vector3(0.39, 0.03, 0.016), color.lightened(0.35))
	k.animar(P_FIJA)


static func _ventanas(k: Constructor, x0: float, x1: float, y: float, z: float, n: int, col := VIDRIO,
		alto := 0.18) -> void:
	for j in n:
		var x := lerpf(x0, x1, (j + 0.5) / n)
		k.caja(Vector3(x, y, z), Vector3(0.14, alto, 0.02), col)
		k.caja(Vector3(x, y - alto / 2 - 0.015, z + 0.01), Vector3(0.18, 0.025, 0.03), CAL)


## Parapeto almenado alrededor de una azotea de largo x ancho (base: centro, al ras de la azotea).
static func _almenas(k: Constructor, base: Vector3, largo: float, ancho: float, col: Color, alto := 0.13) -> void:
	var hx := largo / 2.0
	var hz := ancho / 2.0
	var g := 0.07
	var y := alto * 0.35
	k.caja(base + Vector3(0, y, hz - g / 2), Vector3(largo, alto * 0.7, g), col)
	k.caja(base + Vector3(0, y, -hz + g / 2), Vector3(largo, alto * 0.7, g), col)
	k.caja(base + Vector3(hx - g / 2, y, 0), Vector3(g, alto * 0.7, ancho), col)
	k.caja(base + Vector3(-hx + g / 2, y, 0), Vector3(g, alto * 0.7, ancho), col)
	var n := maxi(2, int(largo / 0.26))
	for j in n:
		var x := -hx + (j + 0.5) * largo / n
		for z in [hz - g / 2, -hz + g / 2]:
			k.caja(base + Vector3(x, alto, z), Vector3(largo / n * 0.5, alto * 0.6, g), col)
	n = maxi(2, int(ancho / 0.26))
	for j in n:
		var z := -hz + (j + 0.5) * ancho / n
		for x in [hx - g / 2, -hx + g / 2]:
			k.caja(base + Vector3(x, alto, z), Vector3(g, alto * 0.6, ancho / n * 0.5), col)


## Puestos de la guarnición (los pies de cada tirador, en la planta del edificio):
## en la azotea y el torreón de las casas fuertes, y tras los sacos de la trinchera.
static func puestos_guarnicion(forma: String) -> Array[Vector3]:
	match forma:
		"cuartel_general":
			return [Vector3(-1.45, 0.89, 0.72), Vector3(-0.75, 0.89, 0.72), Vector3(0.0, 0.89, 0.72),
					Vector3(0.7, 0.89, 0.72), Vector3(-1.1, 1.64, 0.17), Vector3(-0.45, 1.64, 0.17),
					Vector3(0.2, 1.64, 0.17), Vector3(1.05, 2.37, -0.8)]
		"barracas":
			return [Vector3(-1.0, 0.775, 0.22), Vector3(-0.35, 0.775, 0.22), Vector3(0.3, 0.775, 0.22),
					Vector3(0.95, 0.775, 0.22), Vector3(-0.6, 0.775, -0.92), Vector3(0.45, 0.775, -0.92)]
		"trinchera":
			return [Vector3(-1.05, 0.02, 0.42), Vector3(-0.35, 0.02, 0.42), Vector3(0.35, 0.02, 0.42),
					Vector3(1.05, 0.02, 0.42)]
	return []


static func _carpa(k: Constructor, centro: Vector3, largo: float, ancho: float, alto: float, col: Color) -> void:
	k.techo(centro, largo, ancho, alto, col, col.darkened(0.12), 0.0)
	k.barra(centro + Vector3(largo / 2 + 0.02, 0, 0), centro + Vector3(largo / 2 + 0.02, alto + 0.06, 0), 0.01, TABLA, 4)
	k.barra(centro - Vector3(largo / 2 + 0.02, 0, 0), centro + Vector3(-largo / 2 - 0.02, alto + 0.06, 0), 0.01, TABLA, 4)


static func _cruz_roja(k: Constructor, centro: Vector3) -> void:
	k.caja(centro, Vector3(0.24, 0.24, 0.01), Color8(244, 242, 236))
	k.caja(centro + Vector3(0, 0, 0.006), Vector3(0.16, 0.05, 0.006), CRUZ_ROJA)
	k.caja(centro + Vector3(0, 0, 0.006), Vector3(0.05, 0.16, 0.006), CRUZ_ROJA)


static func _sacos(k: Constructor, a: Vector3, b: Vector3, filas := 2) -> void:
	var largo := a.distance_to(b)
	var n := maxi(1, int(largo / 0.16))
	for f in filas:
		for j in n:
			var t := (j + 0.5 + (0.5 if f % 2 else 0.0)) / n
			if t > 1.0:
				continue
			var p := a.lerp(b, t) + Vector3(0, 0.05 + f * 0.075, 0)
			k.esfera(p, Vector3(0.085, 0.045, 0.06), SACO.darkened(0.06 * ((j + f) % 3)), 3, 6)


static func _cajon(k: Constructor, centro: Vector3, tam := 0.16) -> void:
	k.caja(centro + Vector3(0, tam / 2, 0), Vector3(tam, tam, tam), TABLA)
	k.caja(centro + Vector3(0, tam / 2, 0), Vector3(tam * 1.02, 0.02, tam * 1.02), TABLA_OSCURA)


## Malla de un edificio terminado (el andamio de las obras va aparte).
static func edificio(tipo: Dictionary, color: Color, faccion: String) -> ArrayMesh:
	var forma: String = tipo.get("forma", tipo["id"])
	var clave := "e|%s|%s|%s" % [forma, faccion, color.to_html(false)]
	return _de_cache(clave, func() -> ArrayMesh:
		var k := Constructor.new()
		var w: float = tipo.get("ancho", 2)
		var h: float = tipo.get("alto", 2)
		_obra(k, forma, w, h, color)
		return _terminar(k))


static func _obra(k: Constructor, forma: String, w: float, h: float, color: Color) -> void:
	var hw := w / 2.0
	var hh := h / 2.0
	match forma:
		"cuartel_general":
			# casa fuerte de dos pisos con azoteas almenadas y torreón (los tiradores, arriba)
			k.caja(Vector3(0, 0.02, 0), Vector3(w - 0.1, 0.04, h - 0.1), ADOBE_OSCURO)
			k.caja(Vector3(-0.2, 0.06, -0.15), Vector3(3.06, 0.12, 2.06), PIEDRA)
			k.caja(Vector3(-0.2, 0.43, -0.15), Vector3(3.0, 0.86, 2.0), CAL)
			k.caja(Vector3(-0.2, 0.87, -0.15), Vector3(3.06, 0.04, 2.06), ADOBE_OSCURO)
			_almenas(k, Vector3(-0.2, 0.89, -0.15), 3.0, 2.0, CAL)
			k.caja(Vector3(-0.45, 1.25, -0.35), Vector3(1.9, 0.72, 1.3), CAL.darkened(0.04))
			k.caja(Vector3(-0.45, 1.62, -0.35), Vector3(1.96, 0.04, 1.36), ADOBE_OSCURO)
			_almenas(k, Vector3(-0.45, 1.64, -0.35), 1.9, 1.3, CAL)
			k.caja(Vector3(1.05, 1.17, -0.8), Vector3(0.6, 2.34, 0.6), CAL)
			k.caja(Vector3(1.05, 2.35, -0.8), Vector3(0.66, 0.04, 0.66), ADOBE_OSCURO)
			_almenas(k, Vector3(1.05, 2.37, -0.8), 0.6, 0.6, CAL)
			k.caja(Vector3(-0.2, 0.34, 0.86), Vector3(0.36, 0.62, 0.02), TABLA_OSCURA)
			k.caja(Vector3(-0.2, 0.68, 0.865), Vector3(0.46, 0.06, 0.03), PIEDRA)
			_ventanas(k, -1.6, 1.2, 0.5, 0.855, 4)
			_ventanas(k, -1.3, 0.4, 1.28, 0.305, 3)
			_ventanas(k, 0.85, 1.25, 1.6, -0.495, 1)
			_bandera(k, Vector3(1.05, 2.37, -0.8), 1.0, color)
			_cajon(k, Vector3(1.55, 0.04, 1.0))
			_cajon(k, Vector3(1.62, 0.2, 1.05), 0.13)
			_sacos(k, Vector3(-1.75, 0.04, 1.1), Vector3(-1.2, 0.04, 1.1))
		"barracas":
			# cuartel de tropa de azotea almenada, con su galpón
			k.caja(Vector3(0, 0.05, -0.35), Vector3(2.76, 0.1, 1.46), PIEDRA)
			k.caja(Vector3(0, 0.37, -0.35), Vector3(2.7, 0.74, 1.4), ADOBE)
			k.caja(Vector3(0, 0.755, -0.35), Vector3(2.76, 0.04, 1.46), ADOBE_OSCURO)
			_almenas(k, Vector3(0, 0.775, -0.35), 2.7, 1.4, ADOBE)
			k.caja(Vector3(0.45, 0.25, 0.85), Vector3(1.6, 0.5, 0.6), ADOBE_OSCURO)
			k.caja(Vector3(0.45, 0.515, 0.85), Vector3(1.66, 0.03, 0.66), TABLA_OSCURA)
			for j in 3:
				k.caja(Vector3(-0.1 + j * 0.55, 0.2, 1.155), Vector3(0.2, 0.36, 0.02), TABLA_OSCURA)
			_ventanas(k, -1.25, 1.25, 0.47, 0.355, 5, VIDRIO, 0.14)
			k.caja(Vector3(-1.0, 0.27, 0.36), Vector3(0.28, 0.5, 0.02), TABLA_OSCURA)
			_bandera(k, Vector3(-1.2, 0.775, -0.9), 1.2, color)
		"deposito":
			k.caja(Vector3(0, 0.42, -0.1), Vector3(1.6, 0.8, 1.4), TABLA)
			for j in 9:
				k.caja(Vector3(-0.72 + j * 0.18, 0.42, 0.605), Vector3(0.012, 0.8, 0.012), TABLA_OSCURA)
			k.techo(Vector3(0, 0.82, -0.1), 1.6, 1.4, 0.4, CALAMINA, TABLA)
			k.caja(Vector3(0, 0.3, 0.605), Vector3(0.5, 0.56, 0.02), TABLA_OSCURA)
			_sacos(k, Vector3(-0.8, 0.0, 0.8), Vector3(-0.3, 0.0, 0.8))
			_cajon(k, Vector3(0.55, 0.0, 0.78))
			_cajon(k, Vector3(0.75, 0.0, 0.7), 0.14)
			_bandera(k, Vector3(0.85, 0.0, -0.75), 1.3, color)
		"molino":
			# pozo con brocal de piedra, estanque sobre pilares y el molino de viento
			k.cilindro(Vector3(-0.6, 0, 0.5), 0.36, 0.22, PIEDRA, 10)
			k.disco(Vector3(-0.6, 0.2, 0.5), 0.3, AGUA)
			for x in [0.3, 0.95]:
				for z in [-0.75, -0.1]:
					k.barra(Vector3(x, 0, z), Vector3(x, 0.75, z), 0.03, TABLA_OSCURA, 4)
			k.cilindro(Vector3(0.62, 0.75, -0.42), 0.45, 0.42, TABLA, 12)
			for j in 3:
				k.cilindro(Vector3(0.62, 0.8 + j * 0.13, -0.42), 0.455, 0.02, HIERRO, 12)
			var top := Vector3(-0.5, 2.6, -0.5)
			for x in [-0.85, -0.15]:
				for z in [-0.85, -0.15]:
					k.barra(Vector3(x, 0, z), top + Vector3((x + 0.5) * 0.1, 0, (z + 0.5) * 0.1), 0.022, TABLA_OSCURA, 4)
			for j in 4:
				var y := 0.5 + j * 0.5
				var s := 1.0 - y / 2.6
				k.caja(Vector3(-0.5, y, -0.5), Vector3(0.7 * s + 0.04, 0.025, 0.7 * s + 0.04), TABLA_OSCURA)
			var cubo := top + Vector3(0, 0.05, 0.12)
			k.caja(top + Vector3(0, 0.05, 0), Vector3(0.12, 0.12, 0.2), HIERRO)
			k.animar(P_ASPAS, cubo)
			for j in 10:
				var a := TAU * j / 10.0
				var punta := cubo + Vector3(cos(a) * 0.55, sin(a) * 0.55, 0.0)
				k.barra(cubo, punta, 0.012, CALAMINA, 3)
				var medio := cubo.lerp(punta, 0.7)
				k.caja(medio, Vector3(0.14, 0.14, 0.01), CAL.darkened(0.08))
			k.animar(P_FIJA)
			k.barra(top + Vector3(0, 0.05, 0), top + Vector3(0, 0.05, -0.55), 0.015, HIERRO, 4)
			k.caja(top + Vector3(0, 0.1, -0.6), Vector3(0.02, 0.25, 0.3), color)
		"barracas":
			k.caja(Vector3(0, 0.36, -0.35), Vector3(2.6, 0.7, 1.1), ADOBE)
			k.techo(Vector3(0, 0.71, -0.35), 2.6, 1.1, 0.42, CALAMINA, ADOBE_OSCURO)
			k.caja(Vector3(0.3, 0.3, 0.75), Vector3(1.8, 0.58, 0.7), ADOBE)
			k.techo(Vector3(0.3, 0.59, 0.75), 1.8, 0.7, 0.3, CALAMINA.darkened(0.08), ADOBE_OSCURO)
			for j in 3:
				k.caja(Vector3(-0.3 + j * 0.6, 0.22, 1.105), Vector3(0.18, 0.36, 0.02), TABLA_OSCURA)
			_ventanas(k, -1.2, 1.2, 0.42, 0.205, 5, VIDRIO, 0.14)
			_bandera(k, Vector3(-1.2, 0, 0.9), 1.5, color)
		"maestranza":
			k.caja(Vector3(-0.15, 0.48, -0.3), Vector3(2.3, 0.92, 1.6), Color8(170, 96, 70))
			k.techo(Vector3(-0.15, 0.94, -0.3), 2.3, 1.6, 0.5, Color8(80, 76, 72), Color8(150, 84, 62))
			k.caja(Vector3(0.75, 1.3, -0.65), Vector3(0.24, 1.3, 0.24), Color8(140, 74, 54))
			k.caja(Vector3(0.75, 1.97, -0.65), Vector3(0.3, 0.06, 0.3), Color8(90, 50, 40))
			k.caja(Vector3(-0.4, 0.38, 0.505), Vector3(0.6, 0.68, 0.02), Color8(40, 30, 24))
			k.caja(Vector3(-0.4, 0.38, 0.51), Vector3(0.5, 0.58, 0.02), Color8(232, 120, 40))
			_ventanas(k, 0.3, 1.0, 0.55, 0.505, 2)
			k.caja(Vector3(0.6, 0.12, 0.95), Vector3(0.22, 0.22, 0.12), HIERRO)
			k.caja(Vector3(0.6, 0.26, 0.95), Vector3(0.3, 0.06, 0.12), HIERRO.lightened(0.1))
			_rueda(k, Vector3(-1.1, 0.15, 0.95), 0.15, 0.03, TABLA_OSCURA)
			_bandera(k, Vector3(-1.3, 0, 1.1), 1.4, color)
		"hospital":
			_carpa(k, Vector3(-0.55, 0, -0.2), 1.3, 1.0, 0.75, LONA)
			_carpa(k, Vector3(0.75, 0, 0.1), 1.0, 0.9, 0.65, LONA.darkened(0.04))
			k.caja(Vector3(-0.55, 0.35, 0.31), Vector3(0.12, 0.12, 0.01), CRUZ_ROJA)
			k.caja(Vector3(-0.55, 0.35, 0.31), Vector3(0.04, 0.3, 0.01), CRUZ_ROJA)
			k.caja(Vector3(-0.55, 0.38, 0.31), Vector3(0.3, 0.04, 0.01), CRUZ_ROJA)
			k.barra(Vector3(0.0, 0, 0.75), Vector3(0.0, 1.4, 0.75), 0.016, TABLA, 5)
			_cruz_roja(k, Vector3(0.14, 1.28, 0.75))
			for j in 2:
				k.caja(Vector3(1.1 + j * 0.0, 0.1, -0.6 + j * 0.25), Vector3(0.4, 0.05, 0.16), LONA)
			_bandera(k, Vector3(-1.35, 0, 0.8), 1.2, color)
		"hospital_sangre":
			_carpa(k, Vector3(-0.15, 0, -0.15), 1.1, 0.9, 0.62, LONA)
			k.barra(Vector3(0.65, 0, 0.6), Vector3(0.65, 1.1, 0.6), 0.014, TABLA, 5)
			_cruz_roja(k, Vector3(0.78, 1.0, 0.6))
			k.caja(Vector3(-0.15, 0.3, 0.31), Vector3(0.04, 0.24, 0.01), CRUZ_ROJA)
			k.caja(Vector3(-0.15, 0.32, 0.31), Vector3(0.24, 0.04, 0.01), CRUZ_ROJA)
			k.caja(Vector3(0.4, 0.06, 0.55), Vector3(0.36, 0.04, 0.14), LONA)
			_cajon(k, Vector3(-0.75, 0, 0.6), 0.14)
		"trinchera":
			k.caja(Vector3(0, 0.015, 0), Vector3(w - 0.2, 0.03, h - 0.5), Color8(110, 84, 58))
			_sacos(k, Vector3(-hw + 0.1, 0, 0.62), Vector3(hw - 0.1, 0, 0.62), 3)
			_sacos(k, Vector3(-hw + 0.1, 0, -0.62), Vector3(hw - 0.1, 0, -0.62), 2)
			_sacos(k, Vector3(-hw + 0.12, 0, -0.5), Vector3(-hw + 0.12, 0, 0.5), 2)
			_sacos(k, Vector3(hw - 0.12, 0, -0.5), Vector3(hw - 0.12, 0, 0.5), 2)
			for j in 3:
				k.barra(Vector3(-1.0 + j, 0, -0.62), Vector3(-1.0 + j, 0.35, -0.62), 0.015, TABLA, 4)
			k.caja(Vector3(1.25, 0.32, -0.62), Vector3(0.2, 0.12, 0.01), color)
		"reducto":
			for lado: Vector3 in [Vector3(0, 0, -0.78), Vector3(0, 0, 0.78), Vector3(-0.78, 0, 0), Vector3(0.78, 0, 0)]:
				var largo := Vector3(1.7, 0.36, 0.3) if lado.x == 0 else Vector3(0.3, 0.36, 1.7)
				k.caja(lado + Vector3(0, 0.18, 0), largo, TIERRA, TIERRA.lightened(0.1))
			for j in 4:
				var a := TAU * j / 4 + PI / 4
				k.cilindro(Vector3(cos(a) * 0.78, 0.0, sin(a) * 0.78), 0.14, 0.5, Color8(150, 120, 76), 8)
			k.caja(Vector3(0, 0.02, 0), Vector3(1.3, 0.04, 1.3), Color8(120, 94, 66))
			k.barra(Vector3(0.0, 0.22, 0), Vector3(0.0, 0.22, 0.75), 0.05, BRONCE, 8, 0.035)
			_rueda(k, Vector3(-0.12, 0.14, 0.05), 0.14, 0.03, TABLA_OSCURA)
			_rueda(k, Vector3(0.12, 0.14, 0.05), 0.14, 0.03, TABLA_OSCURA)
			_bandera(k, Vector3(-0.6, 0.36, -0.6), 1.0, color)
		"barracon":
			k.caja(Vector3(0, 0.5, -0.2), Vector3(2.5, 0.96, 1.7), ADOBE)
			k.techo(Vector3(0, 0.98, -0.2), 2.5, 1.7, 0.5, TEJA, ADOBE_OSCURO)
			k.caja(Vector3(0, 0.45, 0.66), Vector3(0.5, 0.86, 0.04), TABLA_OSCURA)
			_ventanas(k, -1.1, 1.1, 0.6, 0.655, 4)
			for x in [-0.9, -0.6, 0.6, 0.9]:
				k.barra(Vector3(x, 0, 1.15), Vector3(x, 0.45, 1.15), 0.02, TABLA, 4)
			k.barra(Vector3(-1.0, 0.4, 1.15), Vector3(1.0, 0.4, 1.15), 0.012, TABLA, 4)
			_bandera(k, Vector3(1.3, 0, 1.2), 1.6, color)
		"caballeriza":
			k.caja(Vector3(0, 0.45, -0.75), Vector3(3.6, 0.86, 1.0), TABLA)
			k.techo(Vector3(0, 0.88, -0.75), 3.6, 1.0, 0.4, CALAMINA, TABLA_OSCURA)
			for j in 6:
				k.caja(Vector3(-1.5 + j * 0.6, 0.35, -0.24), Vector3(0.36, 0.6, 0.02), TABLA_OSCURA)
			for x in range(-17, 18, 3):
				k.barra(Vector3(x / 10.0, 0, 1.3), Vector3(x / 10.0, 0.38, 1.3), 0.018, TABLA, 4)
			for y in [0.18, 0.32]:
				k.barra(Vector3(-1.75, y, 1.3), Vector3(1.75, y, 1.3), 0.012, TABLA, 4)
			for z in range(-2, 13, 3):
				k.barra(Vector3(-1.75, 0, z / 10.0), Vector3(-1.75, 0.38, z / 10.0), 0.018, TABLA, 4)
				k.barra(Vector3(1.75, 0, z / 10.0), Vector3(1.75, 0.38, z / 10.0), 0.018, TABLA, 4)
			for j in 3:
				k.caja(Vector3(1.2 + (j % 2) * 0.25, 0.09 + (j / 2) * 0.16, 0.0), Vector3(0.24, 0.16, 0.16), PAJA)
			var potro := Constructor.new()
			_caballo(potro, ALAZAN, {})
			k.xf = Transform3D(Basis(Vector3.UP, 0.4), Vector3(-0.6, 0, 0.6))
			_copiar(k, potro)
			k.xf = Transform3D(Basis(Vector3.UP, -2.6), Vector3(0.3, 0, 0.75))
			_copiar(k, potro)
			k.recto()
			_bandera(k, Vector3(-1.8, 0, -0.1), 1.5, color)
		"telegrafos":
			k.caja(Vector3(-0.3, 0.45, -0.2), Vector3(1.6, 0.86, 1.3), CAL)
			k.techo(Vector3(-0.3, 0.88, -0.2), 1.6, 1.3, 0.45, TEJA, CAL.darkened(0.05))
			k.caja(Vector3(-0.3, 0.3, 0.455), Vector3(0.28, 0.56, 0.02), TABLA_OSCURA)
			_ventanas(k, -1.0, 0.4, 0.55, 0.455, 2)
			var postes := [Vector3(0.9, 0, -1.0), Vector3(1.0, 0, 0.3), Vector3(0.6, 0, 1.2)]
			for p in postes:
				k.barra(p, p + Vector3(0, 1.8, 0), 0.03, TABLA_OSCURA, 5)
				k.caja(p + Vector3(0, 1.7, 0), Vector3(0.04, 0.04, 0.4), TABLA_OSCURA)
				for lado in [-0.16, 0.16]:
					k.cilindro(p + Vector3(0, 1.72, lado), 0.022, 0.05, Color8(120, 170, 140), 6)
			for j in postes.size() - 1:
				for lado in [-0.16, 0.16]:
					k.barra(postes[j] + Vector3(0, 1.76, lado), postes[j + 1] + Vector3(0, 1.76, lado), 0.004, Color8(30, 30, 30), 3)
			k.barra(Vector3(0.4, 0.86, -0.2), postes[0] + Vector3(0, 1.76, -0.16), 0.004, Color8(30, 30, 30), 3)
			_bandera(k, Vector3(-1.2, 0, 0.9), 1.3, color)
		"parque_artilleria":
			k.caja(Vector3(0, 0.7, -0.85), Vector3(3.4, 0.06, 1.0), CALAMINA)
			for x in [-1.6, -0.55, 0.55, 1.6]:
				k.barra(Vector3(x, 0, -0.4), Vector3(x, 0.68, -0.4), 0.03, TABLA, 4)
				k.barra(Vector3(x, 0, -1.3), Vector3(x, 0.72, -1.3), 0.03, TABLA, 4)
			k.caja(Vector3(0, 0.35, -1.32), Vector3(3.4, 0.7, 0.04), TABLA_OSCURA)
			var r := ropa({}, {}, "infante", color)
			for x in [-0.8, 0.5]:
				var pieza := Constructor.new()
				_pieza(pieza, r, "canon_campana")
				k.xf = Transform3D(Basis(Vector3.UP, -PI / 2), Vector3(x, 0, -0.9))
				_copiar(k, pieza)
			k.recto()
			for b in [Vector3(-1.3, 0, 0.7), Vector3(1.2, 0, 0.8)]:
				for capa in 3:
					var n := 3 - capa
					for i in n:
						for j in n:
							k.esfera(b + Vector3((i - (n - 1) / 2.0) * 0.1, 0.05 + capa * 0.08, (j - (n - 1) / 2.0) * 0.1),
									Vector3(0.05, 0.05, 0.05), HIERRO, 3, 6)
			_cajon(k, Vector3(0.1, 0, 0.9))
			_cajon(k, Vector3(0.35, 0, 0.85), 0.14)
			_bandera(k, Vector3(-1.85, 0, 1.25), 1.5, color)
		"estado_mayor":
			k.caja(Vector3(0, 0.8, -0.3), Vector3(2.2, 1.56, 1.6), Color8(222, 210, 186))
			k.caja(Vector3(0, 0.8, -0.3), Vector3(2.24, 0.05, 1.64), CAL)
			k.techo(Vector3(0, 1.58, -0.3), 2.2, 1.6, 0.5, TEJA, Color8(200, 186, 160))
			k.caja(Vector3(0, 0.86, 0.62), Vector3(1.4, 0.04, 0.26), TABLA)
			for j in 8:
				k.barra(Vector3(-0.68 + j * 0.195, 0.86, 0.74), Vector3(-0.68 + j * 0.195, 1.06, 0.74), 0.008, HIERRO, 3)
			k.barra(Vector3(-0.7, 1.06, 0.74), Vector3(0.7, 1.06, 0.74), 0.01, HIERRO, 3)
			for x in [-0.35, 0.35]:
				k.barra(Vector3(x, 0, 0.62), Vector3(x, 0.84, 0.62), 0.045, CAL, 6)
			k.caja(Vector3(0, 0.33, 0.505), Vector3(0.36, 0.62, 0.02), TABLA_OSCURA)
			_ventanas(k, -1.0, 1.0, 1.2, 0.505, 4)
			_ventanas(k, -1.0, -0.4, 0.45, 0.505, 1)
			_ventanas(k, 0.4, 1.0, 0.45, 0.505, 1)
			_bandera(k, Vector3(0, 2.05, -0.3), 0.9, color)
		"muelle":
			# bodega en tierra y el muelle de tablones hacia el agua (el sur del modelo)
			k.caja(Vector3(-0.6, 0.38, -0.7), Vector3(1.4, 0.72, 1.0), TABLA)
			k.techo(Vector3(-0.6, 0.74, -0.7), 1.4, 1.0, 0.35, CALAMINA, TABLA_OSCURA)
			k.caja(Vector3(0.6, 0.12, 0.6), Vector3(0.9, 0.05, 2.4), TABLA)
			for z in [-0.3, 0.3, 0.9, 1.5]:
				for x in [0.2, 1.0]:
					k.barra(Vector3(x, -0.6, z), Vector3(x, 0.16, z), 0.04, TABLA_OSCURA, 5)
			k.barra(Vector3(0.95, 0.12, -0.3), Vector3(0.95, 1.3, -0.3), 0.04, TABLA_OSCURA, 5)
			k.barra(Vector3(0.95, 1.25, -0.3), Vector3(0.6, 1.25, 0.6), 0.025, TABLA_OSCURA, 4)
			k.barra(Vector3(0.6, 1.25, 0.6), Vector3(0.6, 0.6, 0.6), 0.005, Color8(40, 40, 40), 3)
			_cajon(k, Vector3(0.6, 0.6, 0.6), 0.12)
			_sacos(k, Vector3(0.35, 0.14, -0.1), Vector3(0.85, 0.14, -0.1))
			_bandera(k, Vector3(-1.3, 0, 0.3), 1.3, color)
		"fortin":
			for lado: Vector3 in [Vector3(0, 0, -0.8), Vector3(0, 0, 0.8), Vector3(-0.8, 0, 0), Vector3(0.8, 0, 0)]:
				var largo := Vector3(1.64, 0.62, 0.16) if lado.x == 0 else Vector3(0.16, 0.62, 1.64)
				k.caja(lado + Vector3(0, 0.31, 0), largo, ADOBE)
				for j in 5:
					var t := -0.64 + j * 0.32
					var p := lado + (Vector3(t, 0.68, 0) if lado.x == 0 else Vector3(0, 0.68, t))
					k.caja(p, Vector3(0.14, 0.12, 0.17) if lado.x == 0 else Vector3(0.17, 0.12, 0.14), ADOBE_OSCURO)
			k.caja(Vector3(0.62, 0.55, -0.62), Vector3(0.42, 1.1, 0.42), ADOBE)
			k.caja(Vector3(0.62, 1.13, -0.62), Vector3(0.48, 0.06, 0.48), ADOBE_OSCURO)
			k.caja(Vector3(0, 0.3, 0.885), Vector3(0.3, 0.5, 0.02), TABLA_OSCURA)
			_bandera(k, Vector3(0.62, 1.16, -0.62), 0.8, color)
		_:
			k.caja(Vector3(0, 0.4, 0), Vector3(w * 0.8, 0.8, h * 0.8), ADOBE)
			k.techo(Vector3(0, 0.8, 0), w * 0.8, h * 0.8, 0.4, TEJA, ADOBE_OSCURO)
			_bandera(k, Vector3(hw - 0.2, 0, hh - 0.2), 1.2, color)


## Andamio de una obra a medio hacer (se dibuja sobre el edificio, que crece con el avance).
static func andamio(tipo: Dictionary) -> ArrayMesh:
	var w: float = tipo.get("ancho", 2)
	var h: float = tipo.get("alto", 2)
	return _de_cache("andamio|%d|%d" % [int(w), int(h)], func() -> ArrayMesh:
		var k := Constructor.new()
		var hw := w / 2.0 - 0.12
		var hh := h / 2.0 - 0.12
		for x in [-hw, hw]:
			for z in [-hh, hh]:
				k.barra(Vector3(x, 0, z), Vector3(x, 1.2, z), 0.025, TABLA, 4)
		for y in [0.4, 0.8, 1.2]:
			for z in [-hh, hh]:
				k.barra(Vector3(-hw, y, z), Vector3(hw, y, z), 0.018, TABLA, 4)
			for x in [-hw, hw]:
				k.barra(Vector3(x, y, -hh), Vector3(x, y, hh), 0.018, TABLA, 4)
		k.barra(Vector3(-hw, 0, hh), Vector3(hw, 1.2, hh), 0.014, TABLA_OSCURA, 4)
		k.caja(Vector3(-hw + 0.2, 0.02, hh + 0.25), Vector3(0.3, 0.04, 0.2), ADOBE)
		k.caja(Vector3(-hw + 0.2, 0.08, hh + 0.25), Vector3(0.26, 0.06, 0.16), ADOBE_OSCURO)
		return _terminar(k))


# ----------------------------------------------------------------------
# Yacimientos, minas, convoyes

## Yacimiento de salitre (2x1): montones de caliche; 'resto' (0..1) lo que queda.
static func salitre(resto: float) -> ArrayMesh:
	var n := clampi(int(ceil(resto * 8.0)), 1, 8)
	return _de_cache("salitre|%d" % n, func() -> ArrayMesh:
		var k := Constructor.new()
		var rnd := RandomNumberGenerator.new()
		rnd.seed = 1879
		# la calichera: tierra removida, bloques de caliche pardo y cristales blancos de salitre
		k.caja(Vector3(0, 0.012, 0), Vector3(1.85, 0.024, 0.85), Color8(170, 146, 112))
		for j in 8:
			var p := Vector3(rnd.randf_range(-0.72, 0.72), 0, rnd.randf_range(-0.26, 0.26))
			var tam := Vector3(rnd.randf_range(0.15, 0.26), rnd.randf_range(0.09, 0.17), rnd.randf_range(0.13, 0.21))
			if j >= n:
				continue
			k.esfera(p + Vector3(0, tam.y * 0.45, 0), tam, Color8(196, 178, 148).darkened(rnd.randf_range(0.0, 0.15)), 3, 6)
			k.esfera(p + Vector3(0.03, tam.y * 0.95, 0.0), tam * 0.45, CALICHE, 2, 5)
			if j % 2 == 0:
				k.cilindro(p + Vector3(0.06, tam.y * 0.85, 0.03), 0.03, 0.1, Color8(250, 250, 246), 4, 0.0)
		return _terminar(k))


## Pozo de agua (3x3); 'resto' (0..1) baja el nivel del agua.
static func pozo(resto: float) -> ArrayMesh:
	var n := clampi(int(round(resto * 4.0)), 0, 4)
	return _de_cache("pozo|%d" % n, func() -> ArrayMesh:
		var k := Constructor.new()
		k.disco(Vector3(0, 0.01, 0), 1.2, Color8(168, 140, 104), 16)
		for j in 14:
			var a := TAU * j / 14.0
			k.esfera(Vector3(cos(a) * 0.95, 0.06, sin(a) * 0.95), Vector3(0.16, 0.09, 0.13), PIEDRA.darkened(0.05 * (j % 3)), 3, 6)
		k.disco(Vector3(0, 0.02 + n * 0.02, 0), 0.85, AGUA.lerp(Color8(120, 100, 76), 0.6 - n * 0.15), 16)
		for x in [-0.4, 0.4]:
			k.barra(Vector3(x, 0, -0.7), Vector3(x, 0.6, -0.7), 0.025, TABLA_OSCURA, 4)
		k.barra(Vector3(-0.45, 0.58, -0.7), Vector3(0.45, 0.58, -0.7), 0.02, TABLA_OSCURA, 4)
		k.cilindro(Vector3(0.1, 0.3, -0.7), 0.06, 0.08, TABLA, 6)
		return _terminar(k))


static func mina() -> ArrayMesh:
	return _de_cache("mina", func() -> ArrayMesh:
		var k := Constructor.new()
		k.esfera(Vector3(0, 0.0, 0), Vector3(0.18, 0.06, 0.18), TIERRA.darkened(0.2), 3, 8)
		k.barra(Vector3(0.05, 0.0, 0), Vector3(0.05, 0.22, 0), 0.006, TABLA, 3)
		k.caja(Vector3(0.09, 0.2, 0), Vector3(0.07, 0.04, 0.006), CRUZ_ROJA)
		return _terminar(k))


## Tren (locomotora y carros) o carreta del cuartel general, mirando hacia +X.
static func convoy(tren: bool, color: Color) -> ArrayMesh:
	return _de_cache("convoy|%s|%s" % [tren, color.to_html(false)], func() -> ArrayMesh:
		var k := Constructor.new()
		if tren:
			# locomotora
			k.caja(Vector3(0.45, 0.14, 0), Vector3(0.9, 0.08, 0.36), Color8(40, 36, 34))
			k.barra(Vector3(0.1, 0.32, 0), Vector3(0.85, 0.32, 0), 0.15, Color8(30, 30, 32), 10)
			k.cilindro(Vector3(0.72, 0.42, 0), 0.06, 0.32, Color8(30, 30, 32), 8, 0.09)
			k.cilindro(Vector3(0.45, 0.45, 0), 0.06, 0.1, BRONCE, 8)
			k.caja(Vector3(0.0, 0.42, 0), Vector3(0.32, 0.5, 0.36), Color8(120, 40, 34))
			k.caja(Vector3(0.0, 0.69, 0), Vector3(0.4, 0.04, 0.42), Color8(40, 36, 34))
			k.caja(Vector3(0.95, 0.14, 0), Vector3(0.12, 0.12, 0.34), CRUZ_ROJA.darkened(0.2))
			for x in [0.15, 0.45, 0.75]:
				for lado in [-1.0, 1.0]:
					_rueda(k, Vector3(x, 0.12, 0.17 * lado), 0.12, 0.03, Color8(60, 20, 18))
			# carros
			for j in 2:
				var x0 := -0.75 - j * 0.95
				k.caja(Vector3(x0, 0.36, 0), Vector3(0.82, 0.42, 0.38), Color8(120, 88, 58) if j == 0 else Color8(108, 80, 56))
				k.caja(Vector3(x0, 0.6, 0), Vector3(0.86, 0.05, 0.42), CALAMINA)
				k.caja(Vector3(x0, 0.4, 0.195), Vector3(0.3, 0.16, 0.01), color)
				for x in [x0 - 0.28, x0 + 0.28]:
					for lado in [-1.0, 1.0]:
						_rueda(k, Vector3(x, 0.1, 0.17 * lado), 0.1, 0.03, Color8(40, 36, 34))
		else:
			# carreta de bueyes cargada
			for lado in [-1.0, 1.0]:
				_rueda(k, Vector3(-0.2, 0.22, 0.24 * lado), 0.22, 0.04, TABLA_OSCURA)
			k.caja(Vector3(-0.2, 0.32, 0), Vector3(0.9, 0.06, 0.42), TABLA)
			k.caja(Vector3(-0.2, 0.5, 0), Vector3(0.8, 0.3, 0.38), SACO)
			k.techo(Vector3(-0.2, 0.62, 0), 0.8, 0.38, 0.16, LONA, LONA.darkened(0.1), 0.02)
			k.caja(Vector3(-0.2, 0.45, 0.2), Vector3(0.3, 0.14, 0.01), color)
			k.barra(Vector3(0.2, 0.3, 0), Vector3(0.95, 0.25, 0), 0.02, TABLA, 4)
			for z in [-0.12, 0.12]:
				var buey := Constructor.new()
				_caballo(buey, Color8(150, 110, 80), {})
				k.xf = Transform3D(Basis.IDENTITY.scaled(Vector3(1.0, 0.85, 1.25)), Vector3(0.75, 0, z))
				_copiar(k, buey)
			k.recto()
		return _terminar(k))


# ----------------------------------------------------------------------
# Decorados

static func malla_tamarugo() -> ArrayMesh:
	return _de_cache("tamarugo", func() -> ArrayMesh:
		var k := Constructor.new()
		var tronco := Color8(104, 82, 62)
		k.barra(Vector3(0, 0, 0), Vector3(0.05, 0.45, 0.02), 0.07, tronco, 6, 0.05)
		k.barra(Vector3(0.05, 0.4, 0.02), Vector3(0.3, 0.7, 0.1), 0.035, tronco, 5, 0.02)
		k.barra(Vector3(0.05, 0.4, 0.02), Vector3(-0.25, 0.68, -0.05), 0.035, tronco, 5, 0.02)
		k.barra(Vector3(0.05, 0.42, 0.02), Vector3(0.0, 0.75, -0.25), 0.03, tronco, 5, 0.02)
		var hojas := [Color8(122, 132, 84), Color8(108, 120, 76), Color8(136, 142, 92)]
		var copas := [Vector3(0.28, 0.76, 0.1), Vector3(-0.25, 0.72, -0.05), Vector3(0.0, 0.82, -0.22),
				Vector3(0.02, 0.86, 0.12), Vector3(0.18, 0.8, -0.18)]
		for j in copas.size():
			k.esfera(copas[j], Vector3(0.3, 0.13, 0.28), hojas[j % 3], 3, 7)
		return _terminar(k))


static func malla_roca() -> ArrayMesh:
	return _de_cache("roca", func() -> ArrayMesh:
		var k := Constructor.new()
		k.esfera(Vector3(0, 0.4, 0), Vector3(1.0, 0.8, 0.9), Color8(132, 108, 88), 3, 6)
		k.esfera(Vector3(0.5, 0.2, 0.3), Vector3(0.5, 0.4, 0.45), Color8(118, 96, 78), 3, 5)
		return _terminar(k))


static func malla_ruina() -> ArrayMesh:
	return _de_cache("ruina", func() -> ArrayMesh:
		var k := Constructor.new()
		k.caja(Vector3(0, 0.5, 0), Vector3(1.0, 1.0, 1.0), ADOBE_OSCURO, ADOBE)
		k.caja(Vector3(0.3, 1.1, 0), Vector3(0.3, 0.2, 1.0), ADOBE_OSCURO)
		return _terminar(k))


static func malla_caja(tam: Vector3, color: Color) -> ArrayMesh:
	return _de_cache("caja|%s|%s" % [tam, color.to_html(false)], func() -> ArrayMesh:
		var k := Constructor.new()
		k.caja(Vector3.ZERO, tam, color)
		return _terminar(k))


## Anillo de selección (sin luz), de radio 1: se escala con la unidad. Su figura dice la
## formación de la infantería: círculo (sin formación), barra (línea), cuadrado (cuadro) o
## círculo cortado (guerrilla).
static func anillo_seleccion(color: Color, figura := "") -> ArrayMesh:
	return _de_cache("anillo|%s|%s" % [color.to_html(), figura], func() -> ArrayMesh:
		var k := Constructor.new()
		match figura:
			"linea":
				# una barra a lo ancho del frente (el eje z de la figura)
				for z in [-1.0, 1.0]:
					k.cara([Vector3(-0.35, 0, z * 1.35), Vector3(0.35, 0, z * 1.35), Vector3(0.35, 0, z * 1.15),
							Vector3(-0.35, 0, z * 1.15)], color, Vector3(0, -1, z * 1.25))
				k.cara([Vector3(-0.35, 0, -1.35), Vector3(-0.2, 0, -1.35), Vector3(-0.2, 0, 1.35), Vector3(-0.35, 0, 1.35)],
						color, Vector3(-0.3, -1, 0))
				k.cara([Vector3(0.2, 0, -1.35), Vector3(0.35, 0, -1.35), Vector3(0.35, 0, 1.35), Vector3(0.2, 0, 1.35)],
						color, Vector3(0.3, -1, 0))
			"cuadro":
				for lado in 4:
					var g := Basis(Vector3.UP, PI / 2.0 * lado)
					k.cara([g * Vector3(-1.0, 0, -1.0), g * Vector3(1.0, 0, -1.0), g * Vector3(0.84, 0, -0.84),
							g * Vector3(-0.84, 0, -0.84)], color, Vector3(0, -1, 0))
			"guerrilla":
				for j in 8:
					var a0 := TAU * j / 8.0
					var a1 := a0 + TAU / 16.0
					for m in 3:
						var b0 := lerpf(a0, a1, m / 3.0)
						var b1 := lerpf(a0, a1, (m + 1) / 3.0)
						var d0 := Vector3(cos(b0), 0, sin(b0))
						var d1 := Vector3(cos(b1), 0, sin(b1))
						k.cara([d0 * 0.84, d0, d1, d1 * 0.84], color, Vector3(0, -1, 0))
			_:
				k.anillo(Vector3(0, 0, 0), 0.86, 1.0, color, 32)
		return _terminar(k, material_plano()))


## Marca en el suelo de la infantería formada, para leer la batalla de un vistazo: un trazo
## del frente (línea) o un cuadradito (cuadro), del color del jugador. Radio 1.
static func marca_formacion(codigo: int, color: Color) -> ArrayMesh:
	var c := Color(color, 0.55)
	return _de_cache("marca|%d|%s" % [codigo, c.to_html()], func() -> ArrayMesh:
		var k := Constructor.new()
		if codigo == 1:
			k.cara([Vector3(-0.12, 0, -1.0), Vector3(0.12, 0, -1.0), Vector3(0.12, 0, 1.0), Vector3(-0.12, 0, 1.0)], c,
					Vector3(0, -1, 0))
		elif codigo == 3:
			for lado in 4:
				var g := Basis(Vector3.UP, PI / 2.0 * lado)
				k.cara([g * Vector3(-0.7, 0, -0.7), g * Vector3(0.7, 0, -0.7), g * Vector3(0.52, 0, -0.52),
						g * Vector3(-0.52, 0, -0.52)], c, Vector3(0, -1, 0))
		return _terminar(k, material_plano()))


## Galones dorados de un veterano (1 a 3), de frente a la cámara; alto ~0.12.
static func galones(grado: int) -> ArrayMesh:
	var n := clampi(grado, 1, 3)
	return _de_cache("galones|%d" % n, func() -> ArrayMesh:
		var k := Constructor.new()
		for j in n:
			var y := j * 0.045
			for lado in [-1.0, 1.0]:
				k.cara([Vector3(0, y, 0), Vector3(0.0, y + 0.025, 0), Vector3(0.06 * lado, y + 0.055, 0),
						Vector3(0.06 * lado, y + 0.03, 0)], ORO, Vector3(0, y + 0.03, -0.1 if lado > 0 else 0.1))
		return _terminar(k, material_plano()))


## Gota de agua vacía sobre la tropa sedienta.
## La peana del color del jugador sola, para las figuras hechas fuera del juego (arte/).
static func peana(color: Color) -> ArrayMesh:
	return _de_cache("peana|%s" % color.to_html(), func() -> ArrayMesh:
		var k := Constructor.new()
		_peana(k, color)
		return _terminar(k))


static func gota() -> ArrayMesh:
	return _de_cache("gota", func() -> ArrayMesh:
		var k := Constructor.new()
		k.esfera(Vector3(0, 0, 0), Vector3(0.05, 0.05, 0.05), Color8(150, 200, 240), 3, 8)
		k.cilindro(Vector3(0, 0.02, 0), 0.042, 0.07, Color8(150, 200, 240), 8, 0.0)
		return _terminar(k, material_plano()))


## Mancha plana (sangre, polvo) de radio 1.
static func mancha(color: Color) -> ArrayMesh:
	return _de_cache("mancha|%s" % color.to_html(), func() -> ArrayMesh:
		var k := Constructor.new()
		k.disco(Vector3.ZERO, 1.0, color, 10)
		return _terminar(k, material_plano()))
