## Escena de batalla: el diorama, las figuras, la cámara, el panel de mando y las órdenes
## (como salitre/cliente/escenas/juego.py del cliente de Python).
##
## Controles (como en StarCraft/WarCraft):
##   clic izquierdo / arrastrar   seleccionar (Mayús: agregar o quitar; doble clic o Ctrl: los del tipo)
##   clic derecho                 orden inteligente: mover, atacar, recolectar, reparar, guarnecer...
##   letras                       atajos de la tarjeta de órdenes (Mayús: a la cola)
##   Ctrl+1..9 / 1..9             crear / llamar grupos (doble pulsación: centrar la cámara)
##   flechas o bordes             mover la cámara; rueda: acercar; Ctrl+rueda: girar; Inicio: girar al norte
##   botón central                arrastrar el mapa
##   F1 trabajador ocioso · F2 todo el ejército · Espacio último aviso · Alt barras de vida
##   F3 pausa · F10 menú
extends Node3D

const Estado = preload("res://codigo/batalla/estado.gd")
const Terreno = preload("res://codigo/mundo/terreno.gd")
const Ambiente = preload("res://codigo/mundo/ambiente.gd")
const Tropas = preload("res://codigo/mundo/tropas.gd")
const Efectos = preload("res://codigo/mundo/efectos.gd")
const Camara = preload("res://codigo/mundo/camara_rts.gd")
const Modelos = preload("res://codigo/mundo/modelos.gd")
const Hud = preload("res://codigo/ui/hud.gd")
const Tarjeta = preload("res://codigo/ui/tarjeta.gd")
const Tema = preload("res://codigo/ui/tema.gd")

const DOBLE_CLIC := 0.35
const MARGEN_BORDE := 6.0
const ROJO_AVISO := Color8(240, 110, 90)
const NARANJA := Color8(240, 180, 90)

var cat
var est
var ter
var tropas
var efx
var camara
var hud
var seleccion: Array = []
var grupos := {}
var modo: Variant = null          # ["objetivo", clave, dato] o ["construir", clave, id del edificio]
var submenu: Variant = null
var slots: Array = []
var arrastre: Variant = null      # posición de la pantalla donde empezó el recuadro
var paneo: Variant = null
var fin: Variant = null
var pausa := false
var centrado := false
var ultimo_aviso: Variant = null
var ultimo_clic := [-1, 0.0]
var ultimo_grupo := [-1, 0.0]
var rendicion_confirmar := false
var fantasma_obra: MeshInstance3D
var casillas_obra: MeshInstance3D
var _mat_casillas: StandardMaterial3D
var _prueba := {"fase": "esperar", "t": 0.0}
var velocidad_rep := 1.0
var _combate: Array = []          # [punto, momento] de los disparos y explosiones recientes
var _demo := {"fase": "", "t": 0.0}


func _ready() -> void:
	cat = Juego.catalogo
	est = Estado.new(cat, Juego.inicio)
	var mapa: Dictionary = est.mapa
	ter = Terreno.new(est.terreno, est.niveles, est.w, est.h, cat.colores_terreno, mapa.get("llegada") == "tren",
			int(Juego.inicio.get("semilla", 7)))
	add_child(Ambiente.crear(mapa.get("ambiente", "desierto"), est.w, est.h))
	add_child(ter.construir())
	ter.actualizar_niebla(est.vis, est.explorado)
	tropas = Tropas.new(est, ter)
	add_child(tropas)
	efx = Efectos.new()
	add_child(efx)
	camara = Camara.new()
	add_child(camara)
	camara.configurar(ter, est.w, est.h)
	camara.centrar(Vector3(est.w / 2.0, 0, est.h / 2.0), true)
	hud = Hud.new(self, Juego.fuentes)
	add_child(hud)
	hud.boton_pulsado.connect(func(i: int) -> void: activar_boton(i, Input.is_key_pressed(KEY_SHIFT)))
	hud.menu_pedido.connect(abrir_menu)
	_preparar_obra()
	hud.mensaje("Mapa: %s" % mapa.get("nombre", ""), Tema.BRONCE_CLARO)
	if est.espectador:
		hud.mensaje("Modo espectador: todo el mapa a la vista.", Tema.CREMA)
	else:
		var f: Dictionary = cat.facciones[est.faccion(est.yo)]
		hud.mensaje("Usted manda el %s. ¡Buena suerte, mi comandante!" % f["ejercito"], Tema.CREMA)
		var como := "en tren, por el ramal del ferrocarril" if mapa.get("llegada") == "tren" else "en carreta, por el camino"
		hud.mensaje("El cuartel general viene %s." % como, Tema.BRONCE_CLARO, 9.0)
	if Juego.prueba_humo:
		print("PRUEBA_HUMO: batalla en %s (%dx%d), jugador %d" % [mapa.get("id"), est.w, est.h, est.yo])
	if Juego.inicio.get("repeticion"):
		hud.mensaje("Repetición: + y - cambian la velocidad, P la detiene.", Tema.CREMA, 8.0)
		if Juego.captura != "":
			# se adelanta hasta el momento pedido y se captura donde haya combate
			_demo["fase"] = "adelantar"
			_vel_rep(8.0)


func _preparar_obra() -> void:
	fantasma_obra = MeshInstance3D.new()
	fantasma_obra.transparency = 0.45
	fantasma_obra.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	fantasma_obra.visible = false
	add_child(fantasma_obra)
	casillas_obra = MeshInstance3D.new()
	casillas_obra.mesh = PlaneMesh.new()
	_mat_casillas = StandardMaterial3D.new()
	_mat_casillas.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_mat_casillas.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	casillas_obra.material_override = _mat_casillas
	casillas_obra.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	casillas_obra.visible = false
	add_child(casillas_obra)


# ----------------------------------------------------------------------
# Cada cuadro

func _process(delta: float) -> void:
	for m in Juego.conexion.sondear():
		_mensaje_red(m)
		if not is_inside_tree():
			return
	if Juego.conexion.estado == "error" and fin == null:
		fin = {"abortada": true}
		hud.mostrar_cartel("Se perdió la conexión", Juego.conexion.error,
				[["Volver al menú", _volver_menu]])
	est.interpolar()
	if est.actualizar_vision():
		ter.actualizar_niebla(est.vis, est.explorado)
	if not centrado and not est.ents.is_empty():
		_centrar_inicio()
	for ev in est.tomar_eventos():
		_evento(ev)
	var vigentes: Array = []
	for i in seleccion:
		var e = est.ents.get(i)
		if e != null and not e.fantasma:
			vigentes.append(i)
	seleccion = vigentes
	slots = Tarjeta.tarjeta(est, seleccion, submenu) if not est.espectador else []
	if submenu != null:
		var alguno := false
		for b in slots:
			if b != null:
				alguno = true
		if not alguno:
			submenu = null
	_desplazar(delta)
	var conjunto := {}
	for i in seleccion:
		conjunto[i] = true
	tropas.actualizar(delta, conjunto)
	_actualizar_obra()
	hud.actualizar(est, seleccion, slots, modo)
	if Juego.prueba_humo:
		_prueba_humo(delta)
	if _demo["fase"] != "":
		_captura_repeticion(delta)


func _mensaje_red(m: Dictionary) -> void:
	match m.get("t"):
		"inst":
			est.aplicar(m)
		"chat":
			var pref := "[Equipo] " if m.get("canal") == "equipo" else ""
			var col: Color = cat.color_jugador(int(m["color"])) if int(m.get("color", -1)) >= 0 else Tema.CREMA
			hud.mensaje("%s%s: %s" % [pref, m.get("de", ""), m.get("texto", "")], col, 12.0)
		"aviso":
			hud.mensaje(str(m.get("msg", "")), Tema.BRONCE_CLARO, 10.0)
		"error":
			hud.mensaje(str(m.get("msg", "")), ROJO_AVISO)
		"pausa":
			pausa = bool(m.get("valor", false))
			hud.mensaje("Pausa" if pausa else "Se reanuda la batalla", Tema.CREMA, 3.0)
		"fin":
			_fin(m)
		"inicio":
			Juego.inicio = m
			Juego.ir_a("res://escenas/batalla.tscn")


func _centrar_inicio() -> void:
	if est.espectador:
		centrado = true
		return
	# se espera a ver el propio cuartel general (o el tren o la carreta que lo trae, mirando
	# el lugar donde se levantará)
	for e in est.ents.values():
		if e.dueno == est.yo and e.es_edificio():
			centrado = true
			camara.centrar(Vector3(e.x / 32.0, 0, e.y / 32.0), true)
			return
		if e.dueno == est.yo and e.t == cat.especiales["convoy"] and typeof(e.ex) == TYPE_DICTIONARY and e.ex.has("d"):
			centrado = true
			camara.centrar(Vector3(float(e.ex["d"][0]) / 32.0, 0, float(e.ex["d"][1]) / 32.0), true)
			return


func _desplazar(delta: float) -> void:
	if hud.hay_cartel():
		return
	var v: float = camara.paso() * delta
	var d := Vector2.ZERO
	var ctrl := Input.is_key_pressed(KEY_CTRL)
	if Input.is_key_pressed(KEY_LEFT):
		if ctrl:
			camara.girar(-1.6 * delta)
		else:
			d.x -= 1
	if Input.is_key_pressed(KEY_RIGHT):
		if ctrl:
			camara.girar(1.6 * delta)
		else:
			d.x += 1
	if Input.is_key_pressed(KEY_UP):
		d.y += 1
	if Input.is_key_pressed(KEY_DOWN):
		d.y -= 1
	# los bordes de la ventana
	if arrastre == null and paneo == null and get_window().has_focus() and not Juego.prueba_humo:
		var r := get_viewport().get_visible_rect()
		var p := get_viewport().get_mouse_position()
		if r.has_point(p):
			if p.x < MARGEN_BORDE:
				d.x -= 1
			elif p.x > r.size.x - MARGEN_BORDE:
				d.x += 1
			if p.y < MARGEN_BORDE:
				d.y += 1
			elif p.y > r.size.y - MARGEN_BORDE:
				d.y -= 1
	if d != Vector2.ZERO:
		camara.mover(d.x * v, d.y * v)


# ----------------------------------------------------------------------
# Eventos de la simulación

func _px(x: float, y: float) -> Vector3:
	var p := Vector3(x / 32.0, 0, y / 32.0)
	p.y = ter.altura_en(p.x, p.z)
	return p


func _nombre(dueno: int, idx: int) -> String:
	var t: Variant = cat.tipo(idx)
	if t == null:
		return "?"
	return cat.nombre(est.faccion(dueno), t["id"])


func _evento(ev: Array) -> void:
	var k: String = str(ev[1])
	match k:
		"dis":
			var a = est.ents.get(int(ev[2]))
			var o = est.ents.get(int(ev[3]))
			var tipo := str(ev[4])
			var desde: Variant = null
			if a != null:
				desde = tropas.punto(a)
				a.ultimo_disparo = est.reloj()
			elif ev.size() > 7 and o != null:
				# dispara un soldado guarnecido: el fogonazo sale de su puesto
				var b = est.ents.get(int(ev[6]))
				if b != null and b.tipo != null:
					desde = _px(b.x, b.y) + Vector3(randf_range(-0.6, 0.6), 0.5, randf_range(-0.4, 0.4))
			if o != null:
				_combate.append([tropas.punto(o), est.reloj()])
			if desde != null and o != null and tipo != "sable":
				var hacia: Vector3 = tropas.punto(o)
				efx.disparo(desde, hacia - desde, tipo)
				if not ev[5]:
					efx.impacto(hacia + Vector3(randf_range(-0.12, 0.12), 0, randf_range(-0.12, 0.12)))
		"pro":
			var a = est.ents.get(int(ev[2]))
			var x0 := float(ev[3])
			var y0 := float(ev[4])
			if a == null and ev.size() > 10:
				var b = est.ents.get(int(ev[9]))
				if b != null:
					x0 = b.x
					y0 = b.y
			var desde := _px(x0, y0) + Vector3(0, 0.3, 0)
			var hasta := _px(float(ev[5]), float(ev[6]))
			var vel := float(Juego.inicio.get("velocidad", 1.0))
			var dur := maxf(0.1, float(ev[7]) / (16.0 * vel))
			var tipo := str(ev[8])
			efx.lanzar(desde, hasta, dur, tipo)
			if tipo != "dinamita":
				efx.disparo(desde - Vector3(0, 0.42, 0), hasta - desde, "explosivo")
			if a != null:
				a.ultimo_disparo = est.reloj()
		"exp":
			var p := _px(float(ev[2]), float(ev[3]))
			efx.explosion(p, maxf(16.0, float(ev[4])) / 32.0 * 1.4, str(ev[5]))
			_combate.append([p, est.reloj()])
		"mue":
			var idx := int(ev[3])
			var dueno := int(ev[4])
			var p := _px(float(ev[5]), float(ev[6]))
			var explosion: bool = ev.size() > 7 and bool(ev[7])
			var tipo: Variant = cat.tipo(idx)
			if tipo == null:
				return
			if tipo["edificio"]:
				for dx in [-0.6, 0.0, 0.6]:
					efx.explosion(p + Vector3(dx, 0, dx / 3.0), 1.0)
				return
			var fac: String = est.faccion(dueno)
			var grado: int = int(ev[8]) if ev.size() > 8 else 0
			if grado and dueno == est.yo:
				hud.mensaje("Cayó %s (veterano de grado %d)." % [_nombre(dueno, idx), grado], Color8(230, 120, 90), 6.0)
			if tipo["biologica"] and explosion:
				# artillería, dinamita o mina: el cuerpo vuela en pedazos
				efx.explosion(p, 0.5)
				if efx.sangre:
					for _j in 3:
						efx.mancha_sangre(p + Vector3(randf_range(-0.3, 0.3), 0, randf_range(-0.3, 0.3)), 0.12)
				return
			if int(tipo["capa"]) == 1:
				efx.explosion(p, 1.2)
				return
			var malla: Mesh = Modelos.caido(tipo, cat.uniforme_base(fac), cat.uniforme_propio(fac, tipo["forma"]),
					est.color(dueno), fac)
			efx.caido(malla, p, randf() * TAU, tipo["biologica"])
		"herido":
			var p := _px(float(ev[6]), float(ev[7]))
			if efx.sangre:
				efx.mancha_sangre(p, 0.18)
			var grado: int = int(ev[8]) if ev.size() > 8 else 0
			if grado and int(ev[5]) == est.yo:
				hud.mensaje("¡Herido %s! Los camilleros van primero por los veteranos." % _nombre(int(ev[5]), int(ev[4])),
						NARANJA, 6.0)
		"ascenso":
			var o = est.ents.get(int(ev[2]))
			var grado := int(ev[3])
			if o != null:
				efx.letrero(tropas.punto(o) + Vector3(0, 0.9, 0), "▲".repeat(clampi(grado, 1, 5)), Color8(240, 206, 90))
			if int(ev[5]) == est.yo:
				hud.mensaje("¡Ascenso! %s: grado %d" % [_nombre(int(ev[5]), int(ev[4])), grado], Color8(240, 206, 90), 5.0)
		"recogido", "carga", "emplaza":
			var o = est.ents.get(int(ev[3]) if k == "recogido" else int(ev[2]))
			if o != null:
				efx.polvo(tropas.punto(o))
		"ingresa":
			var o = est.ents.get(int(ev[2]))
			if o != null:
				efx.curacion(tropas.punto(o))
		"llegada":
			var o = est.ents.get(int(ev[2]))
			if o != null:
				for j in 8:
					efx.polvo(tropas.punto(o) + Vector3((j % 4 - 1.5) * 0.8, 0, (j / 4 - 0.5) * 0.6), 2)
				if o.dueno == est.yo:
					hud.mensaje("¡Llegó el cuartel general! Los trabajadores salen a la faena.", Tema.CREMA, 6.0)
		"recuperado":
			var o = est.ents.get(int(ev[2]))
			if o != null:
				efx.curacion(tropas.punto(o))
				if o.dueno == est.yo:
					var donde := "en la ambulancia" if o.es_unidad() else "en el hospital"
					hud.mensaje("Vuelve a filas, curado %s: %s" % [donde, _nombre(est.yo, int(ev[4]))], Color8(150, 220, 140), 4.0)
		"monta", "desmonta":
			_reemplazar(int(ev[2]), int(ev[3]))
			var o = est.ents.get(int(ev[3]))
			if o != null:
				efx.polvo(tropas.punto(o), 5)
				if k == "desmonta" and o.dueno == est.yo:
					hud.mensaje("Carpas al carro: la ambulancia está lista para seguir a la tropa.", Tema.CREMA, 4.0)
		"cura":
			var o = est.ents.get(int(ev[3]))
			if o != null:
				efx.curacion(tropas.punto(o))
		"venta":
			# el cuartel general compra el salitre: sale un $ dorado sobre el techo
			var o = est.ents.get(int(ev[2]))
			if o != null:
				efx.letrero(tropas.punto(o) + Vector3(0, 2.0, 0), "$", Color8(240, 206, 90), 96)
		"fin_obra":
			var t: Variant = cat.tipo(int(ev[3]))
			if t != null and t.get("desmonta_en"):
				hud.mensaje("%s montado: los camilleros salen a buscar a los heridos." % _nombre(est.yo, int(ev[3])),
						Tema.BRONCE_CLARO)
			else:
				hud.mensaje("Obra terminada: %s" % _nombre(est.yo, int(ev[3])), Tema.BRONCE_CLARO)
		"lista":
			hud.mensaje("Lista: %s" % _nombre(est.yo, int(ev[3])), Tema.CREMA, 4.0)
		"investigado":
			var i := int(ev[2])
			if i >= 0 and i < cat.datos["mejoras"].size():
				hud.mensaje("Investigación completa: %s" % cat.datos["mejoras"][i]["nombre"], Tema.BRONCE_CLARO)
		"pob":
			hud.mensaje("Hace falta otro Depósito de Intendencia para mantener más tropa.", NARANJA)
		"ata":
			ultimo_aviso = Vector3(float(ev[2]) / 32.0, 0, float(ev[3]) / 32.0)
			var txt := "¡Atacan a nuestros trabajadores!" if ev[4] else "¡Nuestras tropas están bajo ataque!"
			hud.mensaje(txt + " (Espacio para ir)", ROJO_AVISO)
		"err":
			hud.mensaje(str(ev[2]), ROJO_AVISO, 4.0)
		"revela":
			est.revelar(float(ev[2]), float(ev[3]), float(ev[4]))
		"hab":
			var c = est.ents.get(int(ev[2]))
			if c != null:
				var hab: Dictionary = cat.datos["habilidades"].get(str(ev[3]), {})
				if hab.get("tipo", "") in ["potenciar_area", "potenciar_propio", "curar_area"]:
					for _j in 5:
						if hab["tipo"] == "curar_area":
							efx.curacion(tropas.punto(c) + Vector3(randf_range(-0.5, 0.5), 0, randf_range(-0.5, 0.5)))
						else:
							efx.polvo(tropas.punto(c))
					if est.aliado(c.dueno):
						hud.mensaje(hab["nombre"], Tema.BRONCE_CLARO, 3.0)
		"sabotaje":
			var o = est.ents.get(int(ev[2]))
			if o != null:
				for _j in 4:
					efx.explosion(tropas.punto(o) + Vector3(randf_range(-0.5, 0.5), 0.3, randf_range(-0.5, 0.5)), 0.4)
				if o.dueno == est.yo:
					hud.mensaje("¡Sabotaje! Un edificio quedó paralizado.", ROJO_AVISO)
		"carga_puesta":
			var o = est.ents.get(int(ev[2]))
			if o != null:
				efx.disparo(tropas.punto(o), Vector3.UP, "dinamita")
		"senal":
			var pj := int(ev[2])
			var col: Color = est.color(pj)
			efx.marca(_px(float(ev[3]), float(ev[4])), col)
			hud.mensaje("%s marcó un punto en el mapa." % est.jugadores[pj]["nombre"], col, 4.0)
		"derrota":
			var pj := int(ev[2])
			hud.mensaje("%s ha sido derrotado." % est.jugadores[pj]["nombre"], NARANJA, 10.0)
		"pozo_agotado":
			hud.mensaje("Un pozo se agotó: el molino rendirá muy poca agua.", NARANJA)
		"sed", "calor":
			ultimo_aviso = Vector3(float(ev[2]) / 32.0, 0, float(ev[3]) / 32.0)
			var txt := ("¡La tropa se quedó sin agua! Marcha más lento y tarda el doble en recargar: "
					+ "llévele una carreta de agua o vuelva a un molino.") if k == "sed" else \
					"¡Golpe de calor! La tropa sin agua pierde vida al sol de la pampa."
			hud.mensaje(txt + " (Espacio para ir)", Color8(240, 150, 60), 8.0)
		"formacion":
			var f: Variant = cat.formacion(int(ev[2]))
			hud.mensaje("Formación: %s (%d)" % [f["nombre"] if f != null else "Sin formación", int(ev[3])], Tema.CREMA, 3.0)


func _vel_rep(factor: float) -> void:
	velocidad_rep = clampf(velocidad_rep * factor, 0.25, 8.0)
	Juego.conexion.enviar({"t": "velocidad_rep", "valor": velocidad_rep})
	est.intervalo = 2.0 / (16.0 * velocidad_rep)
	hud.mensaje("Velocidad ×%s" % str(velocidad_rep), Tema.CREMA, 2.0)


## Repetición con --captura: adelanta hasta --captura-en, vuelve a la velocidad normal,
## centra la cámara donde más se combate y guarda la imagen.
func _captura_repeticion(delta: float) -> void:
	_demo["t"] += delta
	var ahora: float = est.reloj()
	_demo["aviso"] = float(_demo.get("aviso", 0.0)) + delta
	if _demo["aviso"] >= 5.0:
		_demo["aviso"] = 0.0
		print("Repetición: minuto %.1f, %d figuras, %.0f cuadros por segundo" % [est.tick / 960.0, tropas.nodos.size(),
				Engine.get_frames_per_second()])
	match _demo["fase"]:
		"adelantar":
			if est.tick >= int(Juego.captura_en * 16.0):
				velocidad_rep = 2.0
				_vel_rep(0.5)
				_demo["fase"] = "mirar"
				_demo["t"] = 0.0
		"mirar":
			if _demo["t"] > 2.5:
				var foco: Variant = foco_del_combate(4.0)
				if foco == null:
					if _demo["t"] > 30.0:
						_demo["fase"] = "capturar"
					return
				camara.centrar(foco, true)
				camara.distancia = 12.0
				camara.giro = 0.35
				_demo["fase"] = "capturar"
				_demo["t"] = 0.0
		"capturar":
			if _demo["t"] > 2.0:
				if DisplayServer.get_name() != "headless":
					get_viewport().get_texture().get_image().save_png(Juego.captura)
					print("Captura en ", Juego.captura)
				_demo["fase"] = ""
				Juego.salir(0)
	if _combate.size() > 400:
		_combate = _combate.slice(_combate.size() - 400)


## Donde más se combatió en los últimos segundos: el disparo o la explosión con más
## vecinos a menos de 5 casillas, promediado con ellos (null si no hubo combate).
func foco_del_combate(segundos: float) -> Variant:
	var ahora: float = est.reloj()
	var recientes: Array[Vector3] = []
	for c in _combate:
		if ahora - float(c[1]) < segundos:
			recientes.append(c[0])
	if recientes.is_empty():
		return null
	var mejor := recientes[0]
	var mejor_n := 0
	for p in recientes:
		var n := 0
		for q in recientes:
			if p.distance_to(q) < 5.0:
				n += 1
		if n > mejor_n:
			mejor_n = n
			mejor = p
	var suma := Vector3.ZERO
	var k := 0
	for q in recientes:
		if mejor.distance_to(q) < 5.0:
			suma += q
			k += 1
	return suma / k


func _reemplazar(viejo: int, nuevo: int) -> void:
	# la ambulancia y su hospital de sangre son la misma tropa: siguen elegidos y en sus grupos
	for i in seleccion.size():
		if seleccion[i] == viejo:
			seleccion[i] = nuevo
	for n in grupos:
		var ids: Array = grupos[n]
		for i in ids.size():
			if ids[i] == viejo:
				ids[i] = nuevo


func _fin(m: Dictionary) -> void:
	fin = m
	modo = null
	var titulo := ""
	var mi_equipo: Variant = est.equipos[est.yo] if not est.espectador else null
	if m.get("abortada"):
		titulo = "Partida interrumpida"
	elif m.get("ganador") == null:
		titulo = "Tablas"
	elif est.espectador:
		var gan: Array = []
		for j in est.jugadores:
			if int(j["equipo"]) == int(m["ganador"]):
				gan.append(j["nombre"])
		titulo = "Victoria de " + ", ".join(gan)
	elif int(m["ganador"]) == int(mi_equipo):
		titulo = "¡Victoria!"
	else:
		titulo = "Derrota"
	var minutos := int(m.get("ticks", est.tick)) / (16 * 60)
	hud.mostrar_cartel(titulo, "Duración: %d minutos" % minutos, [["Volver al menú", _volver_menu]])
	if Juego.prueba_humo:
		print("PRUEBA_HUMO: fin de la batalla: ", titulo)


func _volver_menu() -> void:
	Juego.terminar()
	Juego.ir_a("res://escenas/menu.tscn")


# ----------------------------------------------------------------------
# Órdenes

func enviar(cmd: Dictionary) -> void:
	if est.espectador:
		return
	Juego.conexion.comando(cmd)


func _ids_unidades_propias() -> Array:
	var out: Array = []
	for i in seleccion:
		var e = est.ents.get(i)
		if e != null and est.propio(e) and e.es_unidad():
			out.append(i)
	return out


func _ids_edificios_propios() -> Array:
	var out: Array = []
	for i in seleccion:
		var e = est.ents.get(i)
		if e != null and est.propio(e) and e.es_edificio():
			out.append(i)
	return out


func activar_boton(i: int, cola := false) -> void:
	if i < 0 or i >= slots.size() or slots[i] == null:
		return
	var b: Dictionary = slots[i]
	if not b["activo"] or int(b["enfriando"]) > 0:
		if b["falta"] != "":
			var txt: String = ("%s: requiere %s" % [b["texto"], b["falta"]]) if b["falta"] != "en curso" else \
					("%s: %s" % [b["texto"], b["falta"]])
			hud.mensaje(txt, ROJO_AVISO, 3.0)
		return
	var unidades := _ids_unidades_propias()
	var edificios := _ids_edificios_propios()
	match b["accion"]:
		"menu":
			submenu = b["dato"]
			modo = null
		"orden":
			var cmd: Dictionary = (b["dato"] as Dictionary).duplicate()
			var u := unidades.duplicate()
			if cmd["c"] in ["habilidad", "descargar"]:
				u.append_array(edificios)
			cmd["u"] = u
			cmd["e"] = edificios.slice(0, 1) if cmd["c"] == "cancelar" and not edificios.is_empty() else edificios
			cmd["cola"] = cola
			enviar(cmd)
			submenu = null
		"objetivo":
			modo = ["objetivo", b["clave"], b["dato"]]
		"construir":
			modo = ["construir", b["clave"], b["dato"]]
		"entrenar":
			enviar({"c": "entrenar", "e": edificios, "t": b["dato"], "n": 5 if Input.is_key_pressed(KEY_SHIFT) else 1})
		"investigar":
			enviar({"c": "investigar", "e": edificios, "m": b["dato"]})


func _orden_objetivo(p: Vector3, ent, cola: bool) -> void:
	var dato: Variant = modo[2]
	var unidades := _ids_unidades_propias()
	var edificios := _ids_edificios_propios()
	var px := int(p.x * 32.0)
	var py := int(p.z * 32.0)
	var t: Variant = ent.id if ent != null else null
	var color := Color8(90, 230, 90)
	match dato:
		"mover":
			enviar({"c": "mover", "u": unidades, "x": px, "y": py, "cola": cola})
		"atacar":
			if ent != null and not est.aliado(ent.dueno) and not ent.es_recurso():
				enviar({"c": "atacar", "u": unidades, "t": t, "x": px, "y": py, "cola": cola})
			else:
				enviar({"c": "atacar_mover", "u": unidades, "x": px, "y": py, "cola": cola})
			color = Color8(230, 70, 60)
		"patrullar":
			enviar({"c": "patrullar", "u": unidades, "x": px, "y": py, "cola": cola})
		"recolectar":
			if ent != null:
				enviar({"c": "recolectar", "u": unidades, "t": t, "cola": cola})
		"reparar":
			if ent != null:
				enviar({"c": "reparar", "u": unidades, "t": t, "cola": cola})
		"descargar":
			enviar({"c": "descargar", "u": unidades, "x": px, "y": py, "cola": cola})
		"reunion":
			enviar({"c": "reunion", "e": edificios, "x": px, "y": py, "t": t})
			color = Color8(240, 220, 90)
		_:
			if typeof(dato) == TYPE_STRING and str(dato).begins_with("hab:"):
				var u := unidades.duplicate()
				u.append_array(edificios)
				enviar({"c": "habilidad", "u": u, "h": str(dato).substr(4), "x": px, "y": py, "t": t, "cola": cola})
				color = Color8(240, 200, 90)
	efx.marca(p, color)


func orden_derecha(p: Vector3, ent, cola: bool) -> void:
	var unidades := _ids_unidades_propias()
	var edificios := _ids_edificios_propios()
	if not unidades.is_empty():
		var cmd := {"c": "inteligente", "u": unidades, "x": int(p.x * 32.0), "y": int(p.z * 32.0), "cola": cola}
		var color := Color8(90, 230, 90)
		if ent != null and (not ent.fantasma or ent.es_recurso() or ent.es_edificio()):
			cmd["t"] = ent.id
			if not est.aliado(ent.dueno) and not ent.es_recurso():
				color = Color8(230, 70, 60)
		enviar(cmd)
		efx.marca(p, color)
	elif not edificios.is_empty():
		enviar({"c": "reunion", "e": edificios, "x": int(p.x * 32.0), "y": int(p.z * 32.0),
				"t": ent.id if ent != null else null})
		efx.marca(p, Color8(240, 220, 90))


# ----------------------------------------------------------------------
# Selección

## La figura bajo una posición de la pantalla (o null).
func entidad_en(pos: Vector2, solo_propias := false):
	var suelo: Variant = camara.rayo(pos)
	var mejor = null
	var mejor_k := [9, INF]
	for e in est.ents.values():
		var k: Variant = null
		if e.es_recurso():
			if solo_propias or not est.explorado_px(e.x, e.y) or suelo == null:
				continue
			var tam := Vector2(1.0, 0.5) if e.t == cat.especiales["salitre"] else Vector2(1.5, 1.5)
			var c := Vector2(e.x / 32.0, e.y / 32.0)
			if absf(suelo.x - c.x) <= tam.x and absf(suelo.z - c.y) <= tam.y:
				k = [3, absf(suelo.x - c.x) + absf(suelo.z - c.y)]
		elif e.tipo == null:
			continue
		else:
			if solo_propias and not est.propio(e):
				continue
			if e.fantasma and not e.es_edificio():
				continue
			if not est.aliado(e.dueno) and not e.fantasma and not est.visible_px(e.x, e.y):
				continue
			if e.es_edificio():
				if suelo == null:
					continue
				var c := Vector2(e.x / 32.0, e.y / 32.0)
				var hw := float(e.tipo["ancho"]) / 2.0
				var hh := float(e.tipo["alto"]) / 2.0
				if absf(suelo.x - c.x) <= hw and absf(suelo.z - c.y) <= hh + 0.4:
					k = [2, absf(suelo.x - c.x) + absf(suelo.z - c.y)]
			else:
				var base: Vector3 = tropas.punto(e)
				var centro := base + Vector3(0, tropas.alto(e) * 0.5, 0)
				var sp: Variant = camara.a_pantalla(centro)
				if sp == null:
					continue
				var lado: Variant = camara.a_pantalla(centro + camara.cam.global_transform.basis.x * tropas.radio(e))
				var r_px := 12.0
				if lado != null:
					r_px = maxf(12.0, (lado as Vector2).distance_to(sp) * 1.4)
				var d := (sp as Vector2).distance_to(pos)
				if d <= r_px:
					k = [0 if est.propio(e) else 1, d]
		if k != null and (k[0] < mejor_k[0] or (k[0] == mejor_k[0] and k[1] < mejor_k[1])):
			mejor = e
			mejor_k = k
	return mejor


func seleccionar(ids: Array, agregar := false) -> void:
	if agregar:
		for i in ids:
			if i in seleccion:
				seleccion.erase(i)
			else:
				seleccion.append(i)
	else:
		seleccion = ids.duplicate()
	submenu = null
	modo = null


func _seleccion_caja(a: Vector2, b: Vector2, agregar: bool) -> void:
	var r := Rect2(a, Vector2.ZERO).expand(b).grow(6.0)
	var propias: Array = []
	var edificios: Array = []
	var otras: Array = []
	for e in est.ents.values():
		if e.tipo == null or e.fantasma:
			continue
		var sp: Variant = camara.a_pantalla(tropas.punto(e))
		if sp == null or not r.has_point(sp):
			continue
		if est.propio(e):
			if e.es_edificio():
				edificios.append(e.id)
			elif not e.tipo["autonomo"]:      # los camilleros no entran en el recuadro
				propias.append(e.id)
		elif est.aliado(e.dueno) or est.visible_px(e.x, e.y):
			otras.append(e.id)
	if not propias.is_empty():
		seleccionar(propias.slice(0, 96), agregar)
	elif not edificios.is_empty():
		seleccionar(edificios.slice(0, 24), agregar)
	elif not otras.is_empty() and not agregar:
		seleccionar(otras.slice(0, 1))


func _mismo_tipo_en_pantalla(e) -> Array:
	var r := get_viewport().get_visible_rect()
	var out: Array = []
	for o in est.ents.values():
		if o.tipo == null or o.fantasma or o.t != e.t or o.dueno != e.dueno:
			continue
		var sp: Variant = camara.a_pantalla(tropas.punto(o))
		if sp != null and r.has_point(sp):
			out.append(o.id)
	return out


# ----------------------------------------------------------------------
# Lugar de las obras

## [tx, ty, válido] para el edificio en construcción bajo el punto p del suelo.
func lugar_obra(p: Vector3, tipo_id: String) -> Array:
	var tipo: Dictionary = cat.tipos_por_id[tipo_id]
	var ancho := int(tipo["ancho"])
	var alto := int(tipo["alto"])
	var mx := p.x * 32.0
	var my := p.z * 32.0
	var tx := int(floor(p.x)) - ancho / 2
	var ty := int(floor(p.z)) - alto / 2
	if tipo["sobre_recurso"]:
		var mejor = null
		var mejor_d := 96.0
		for e in est.ents.values():
			if e.t == cat.especiales["agua"]:
				var d: float = absf(e.x - mx) + absf(e.y - my)
				if d < mejor_d:
					mejor_d = d
					mejor = e
		if mejor == null:
			return [tx, ty, false]
		var ptx := int(mejor.x) / 32 - 1
		var pty := int(mejor.y) / 32 - 1
		for o in est.ents.values():
			if o.tipo != null and o.es_edificio() and o.tipo["sobre_recurso"] and absf(o.x - mejor.x) < 8 and absf(o.y - mejor.y) < 8:
				return [ptx, pty, false]
		return [ptx, pty, est.explorado_px(mejor.x, mejor.y)]
	if tx < 0 or ty < 0 or tx + ancho > est.w or ty + alto > est.h:
		return [tx, ty, false]
	var ocupadas := {}
	for e in est.ents.values():
		var tam := Vector2i.ZERO
		if e.es_edificio():
			tam = Vector2i(int(e.tipo["ancho"]), int(e.tipo["alto"]))
		elif e.es_recurso():
			tam = Vector2i(2, 1) if e.t == cat.especiales["salitre"] else Vector2i(3, 3)
		else:
			continue
		var ex0 := (int(e.x) - tam.x * 16) / 32
		var ey0 := (int(e.y) - tam.y * 16) / 32
		for yy in range(ey0, ey0 + tam.y):
			for xx in range(ex0, ex0 + tam.x):
				ocupadas[Vector2i(xx, yy)] = true
	var nivel0: int = est.niveles[ty * est.w + tx]
	for yy in range(ty, ty + alto):
		for xx in range(tx, tx + ancho):
			var i: int = yy * est.w + xx
			if ocupadas.has(Vector2i(xx, yy)) or not est.edificable[i] or est.niveles[i] != nivel0 or not est.explorado[i]:
				return [tx, ty, false]
	if tipo["costero"]:
		var agua := 0
		for yy in range(ty - 1, ty + alto + 1):
			for xx in range(tx - 1, tx + ancho + 1):
				if xx >= 0 and yy >= 0 and xx < est.w and yy < est.h and est.agua_base[yy * est.w + xx]:
					agua += 1
		if agua < 3:
			return [tx, ty, false]
	if tipo["deposito"]:
		for e in est.ents.values():
			if not e.es_recurso():
				continue
			var tam := Vector2i(2, 1) if e.t == cat.especiales["salitre"] else Vector2i(3, 3)
			var rx := (int(e.x) - tam.x * 16) / 32
			var ry := (int(e.y) - tam.y * 16) / 32
			var dx := maxi(0, maxi(rx - (tx + ancho), tx - (rx + tam.x)))
			var dy := maxi(0, maxi(ry - (ty + alto), ty - (ry + tam.y)))
			if maxi(dx, dy) < int(cat.datos["dist_recursos_cuartel"]):
				return [tx, ty, false]
	return [tx, ty, true]


## Manda a construir la obra elegida (modo «construir») en el punto p del suelo.
func construir_en(p: Vector3, cola := false) -> bool:
	var lugar := lugar_obra(p, modo[2])
	if not lugar[2]:
		hud.mensaje("No se puede construir ahí.", ROJO_AVISO, 2.0)
		return false
	enviar({"c": "construir", "u": _ids_unidades_propias(), "e": modo[2], "tx": lugar[0], "ty": lugar[1], "cola": cola})
	efx.marca(Vector3(lugar[0] + float(cat.tipos_por_id[modo[2]]["ancho"]) / 2.0, ter.altura_en(p.x, p.z),
			lugar[1] + float(cat.tipos_por_id[modo[2]]["alto"]) / 2.0), Color8(90, 230, 90))
	if not cola:
		modo = null
		submenu = null
	return true


func _actualizar_obra() -> void:
	if modo == null or modo[0] != "construir" or hud.hay_cartel():
		fantasma_obra.visible = false
		casillas_obra.visible = false
		return
	var p: Variant = camara.rayo(get_viewport().get_mouse_position())
	if p == null:
		fantasma_obra.visible = false
		casillas_obra.visible = false
		return
	var tipo: Dictionary = cat.tipos_por_id[modo[2]]
	var lugar := lugar_obra(p, modo[2])
	var centro := Vector3(lugar[0] + float(tipo["ancho"]) / 2.0, 0, lugar[1] + float(tipo["alto"]) / 2.0)
	centro.y = ter.altura_en(centro.x, centro.z)
	fantasma_obra.mesh = Modelos.edificio(tipo, est.color(est.yo), est.faccion(est.yo))
	fantasma_obra.position = centro
	fantasma_obra.visible = true
	(casillas_obra.mesh as PlaneMesh).size = Vector2(float(tipo["ancho"]), float(tipo["alto"]))
	casillas_obra.position = centro + Vector3(0, 0.04, 0)
	_mat_casillas.albedo_color = Color(0.25, 0.8, 0.25, 0.4) if lugar[2] else Color(0.86, 0.2, 0.16, 0.45)
	casillas_obra.visible = true


# ----------------------------------------------------------------------
# Entrada

func _unhandled_input(ev: InputEvent) -> void:
	if fin != null or hud.hay_cartel():
		if ev is InputEventKey and ev.pressed and ev.keycode == KEY_ESCAPE and fin == null:
			hud.cerrar_cartel()
		return
	if ev is InputEventKey and ev.pressed and not ev.echo:
		_tecla(ev)
	elif ev is InputEventMouseButton:
		_boton_raton(ev)
	elif ev is InputEventMouseMotion:
		if paneo != null:
			var d: Vector2 = ev.position - paneo
			var escala: float = camara.paso() / 900.0
			camara.mover(-d.x * escala, d.y * escala)
			paneo = ev.position


func _boton_raton(ev: InputEventMouseButton) -> void:
	var cola := ev.shift_pressed
	if ev.button_index == MOUSE_BUTTON_WHEEL_UP or ev.button_index == MOUSE_BUTTON_WHEEL_DOWN:
		if ev.pressed:
			var hacia := 1.0 if ev.button_index == MOUSE_BUTTON_WHEEL_UP else -1.0
			if ev.ctrl_pressed:
				camara.girar(0.12 * hacia)
			else:
				camara.acercar(pow(1.12, hacia))
		return
	if ev.button_index == MOUSE_BUTTON_MIDDLE:
		paneo = ev.position if ev.pressed else null
		return
	if ev.button_index == MOUSE_BUTTON_RIGHT and ev.pressed:
		if modo != null:
			modo = null
			return
		var p: Variant = camara.rayo(ev.position)
		if p != null:
			orden_derecha(p, entidad_en(ev.position), cola)
		return
	if ev.button_index != MOUSE_BUTTON_LEFT:
		return
	if ev.pressed:
		if modo != null:
			var p: Variant = camara.rayo(ev.position)
			if p == null:
				return
			if modo[0] == "construir":
				construir_en(p, cola)
				return
			_orden_objetivo(p, entidad_en(ev.position), cola)
			if not cola:
				modo = null
			return
		arrastre = ev.position
		return
	# se suelta el botón izquierdo
	if arrastre == null:
		return
	var a: Vector2 = arrastre
	arrastre = null
	var agregar := ev.shift_pressed
	if a.distance_to(ev.position) < 6.0:
		var e = entidad_en(ev.position)
		if e == null:
			if not agregar:
				seleccionar([])
			return
		var ahora := Time.get_ticks_msec() / 1000.0
		var doble: bool = ultimo_clic[0] == e.id and ahora - ultimo_clic[1] < DOBLE_CLIC
		ultimo_clic = [e.id, ahora]
		if (doble or ev.ctrl_pressed) and e.tipo != null:
			seleccionar(_mismo_tipo_en_pantalla(e), agregar)
		elif agregar and est.propio(e) and _todas_propias():
			seleccionar([e.id], true)
		else:
			seleccionar([e.id])
		return
	_seleccion_caja(a, ev.position, agregar)


func _todas_propias() -> bool:
	for i in seleccion:
		var e = est.ents.get(i)
		if e != null and not est.propio(e):
			return false
	return true


func _tecla(ev: InputEventKey) -> void:
	var k := ev.keycode
	if k == KEY_F10:
		abrir_menu()
		return
	if k == KEY_ESCAPE:
		if modo != null:
			modo = null
		elif submenu != null:
			submenu = null
		else:
			for i in slots.size():
				var b: Variant = slots[i]
				if b != null and b["atajo"] == "ESC" and b["accion"] == "orden":
					activar_boton(i)
					return
			if not seleccion.is_empty():
				seleccionar([])
			else:
				abrir_menu()
		return
	if k == KEY_HOME:
		camara.giro = 0.0
		return
	if est.espectador and Juego.inicio.get("repeticion"):
		if k == KEY_EQUAL or k == KEY_PLUS or k == KEY_KP_ADD:
			_vel_rep(2.0)
			return
		if k == KEY_MINUS or k == KEY_KP_SUBTRACT:
			_vel_rep(0.5)
			return
		if k == KEY_P:
			Juego.conexion.enviar({"t": "pausa"})
			return
	if k >= KEY_0 and k <= KEY_9:
		var n := k - KEY_0
		if ev.ctrl_pressed:
			grupos[n] = seleccion.duplicate()
			hud.mensaje("Grupo %d formado (%d)" % [n, seleccion.size()], Tema.CREMA, 2.0)
		elif ev.shift_pressed:
			var ids: Array = grupos.get(n, []).duplicate()
			for i in seleccion:
				if not i in ids:
					ids.append(i)
			grupos[n] = ids
		else:
			var ids: Array = []
			for i in grupos.get(n, []):
				if est.ents.has(i):
					ids.append(i)
			if not ids.is_empty():
				var ahora := Time.get_ticks_msec() / 1000.0
				if ultimo_grupo[0] == n and ahora - ultimo_grupo[1] < DOBLE_CLIC:
					var e = est.ents[ids[0]]
					camara.centrar(Vector3(e.x / 32.0, 0, e.y / 32.0))
				ultimo_grupo = [n, ahora]
				seleccionar(ids)
		return
	if k == KEY_F1:
		var ociosos: Array = []
		for e in est.ents.values():
			if est.propio(e) and e.tipo != null and e.tipo.get("trabajador", false) \
					and not (e.fl & (cat.bandera("MOVIENDO") | cat.bandera("TRABAJA") | cat.bandera("SALITRE") | cat.bandera("AGUA"))):
				ociosos.append(e)
		if ociosos.is_empty():
			hud.mensaje("No hay trabajadores ociosos.", Tema.CREMA, 2.0)
			return
		ociosos.sort_custom(func(a, b) -> bool: return a.id < b.id)
		var actual: int = seleccion[0] if seleccion.size() == 1 else -1
		var sig = ociosos[0]
		for e in ociosos:
			if e.id > actual:
				sig = e
				break
		seleccionar([sig.id])
		camara.centrar(Vector3(sig.x / 32.0, 0, sig.y / 32.0))
		return
	if k == KEY_F2:
		var ids: Array = []
		for e in est.ents.values():
			if est.propio(e) and e.es_unidad() and not e.tipo["trabajador"] and not e.tipo["autonomo"]:
				ids.append(e.id)
		seleccionar(ids.slice(0, 96))
		return
	if k == KEY_SPACE:
		if ultimo_aviso != null:
			camara.centrar(ultimo_aviso)
		return
	if k == KEY_EQUAL or k == KEY_PLUS or k == KEY_KP_ADD:
		camara.acercar(1.15)
		return
	if k == KEY_MINUS or k == KEY_KP_SUBTRACT:
		camara.acercar(1.0 / 1.15)
		return
	if k == KEY_F3:
		Juego.conexion.enviar({"t": "pausa"})
		return
	if k == KEY_G and ev.alt_pressed:
		var p: Variant = camara.rayo(get_viewport().get_mouse_position())
		if p != null:
			enviar({"c": "senal", "x": int(p.x * 32.0), "y": int(p.z * 32.0)})
		return
	var letra := OS.get_keycode_string(k).to_upper()
	if letra.length() == 1:
		for i in slots.size():
			var b: Variant = slots[i]
			if b != null and b["atajo"] == letra:
				activar_boton(i, ev.shift_pressed)
				return


# ----------------------------------------------------------------------
# Menú de campaña

func abrir_menu() -> void:
	if fin != null:
		return
	rendicion_confirmar = false
	var opciones: Array = [["Continuar", hud.cerrar_cartel]]
	if not est.espectador:
		opciones.append(["Rendirse", _rendirse])
		opciones.append(["Pausa (F3)", func() -> void:
			Juego.conexion.enviar({"t": "pausa"})
			hud.cerrar_cartel()])
	opciones.append(["Abandonar y volver al menú", _volver_menu])
	hud.mostrar_cartel("Cuartel de campaña", "Alt: barras de vida · Ctrl+rueda o Ctrl+flechas: girar la cámara · " +
			"Inicio: mirar al norte · Alt+G: señal en el mapa", opciones)


func _rendirse() -> void:
	if not rendicion_confirmar:
		rendicion_confirmar = true
		hud.mensaje("Pulse otra vez «Rendirse» para confirmar.", NARANJA, 4.0)
		return
	Juego.conexion.enviar({"t": "rendirse"})
	hud.cerrar_cartel()


# ----------------------------------------------------------------------
# Dibujo sobre la vista: barras de vida, recuadro de selección, puntos de reunión

func dibujar_superpuesto(lienzo: Control) -> void:
	var todas := Input.is_key_pressed(KEY_ALT)
	var conjunto := {}
	for i in seleccion:
		conjunto[i] = true
	for e in est.ents.values():
		if e.tipo == null or e.fantasma:
			continue
		var vida_max := float((e.ex if typeof(e.ex) == TYPE_DICTIONARY else {}).get("vm", e.tipo["vida"]))
		var elegido := conjunto.has(e.id)
		if not elegido and not todas and float(e.vida) >= vida_max:
			continue
		if not est.aliado(e.dueno) and not est.visible_px(e.x, e.y):
			continue
		var tope: Variant = camara.a_pantalla(tropas.punto(e) + Vector3(0, tropas.alto(e) + 0.12, 0))
		if tope == null:
			continue
		var ancho := 34.0 if not e.es_edificio() else 70.0
		var f := clampf(float(e.vida) / maxf(1.0, vida_max), 0.0, 1.0)
		var r := Rect2(tope - Vector2(ancho / 2.0, 3.0), Vector2(ancho, 5.0))
		lienzo.draw_rect(r.grow(1.0), Color(0, 0, 0, 0.75))
		var col := Color8(80, 200, 80) if f > 0.5 else (Color8(230, 190, 60) if f > 0.25 else Color8(220, 60, 50))
		lienzo.draw_rect(Rect2(r.position, Vector2(ancho * f, 5.0)), col)
		# la obra en curso y la cola de producción, en una segunda barra
		var ex: Dictionary = e.ex if typeof(e.ex) == TYPE_DICTIONARY else {}
		var avance := -1.0
		if e.es_edificio() and e.fl & cat.bandera("OBRA"):
			avance = float(ex.get("o", 0)) / 100.0
		elif e.es_edificio() and not ex.get("q", []).is_empty():
			avance = float(ex["q"][0][2]) / 100.0
		if avance >= 0.0 and elegido:
			var r2 := Rect2(r.position + Vector2(0, 7), Vector2(ancho, 4))
			lienzo.draw_rect(r2.grow(1.0), Color(0, 0, 0, 0.75))
			lienzo.draw_rect(Rect2(r2.position, Vector2(ancho * avance, 4)), Color8(230, 196, 120))
		# punto de reunión de los edificios elegidos
		if elegido and e.es_edificio() and est.propio(e) and ex.has("r"):
			var desde: Variant = camara.a_pantalla(tropas.punto(e))
			var hasta: Variant = camara.a_pantalla(_px(float(ex["r"][0]), float(ex["r"][1])))
			if desde != null and hasta != null:
				lienzo.draw_dashed_line(desde, hasta, Color8(240, 220, 90), 2.0, 8.0)
				lienzo.draw_circle(hasta, 5.0, Color8(240, 220, 90))
	# recuadro de selección
	if arrastre != null:
		var a: Vector2 = arrastre
		var b := lienzo.get_local_mouse_position()
		var r := Rect2(a, Vector2.ZERO).expand(b)
		if r.size.x > 4 or r.size.y > 4:
			lienzo.draw_rect(r, Color(0.35, 0.9, 0.35, 0.16))
			lienzo.draw_rect(r, Color(0.35, 0.9, 0.35, 0.9), false, 1.0)
	if pausa:
		var tam := lienzo.size
		lienzo.draw_string(Juego.fuentes["titulo"], Vector2(tam.x / 2.0 - 70, tam.y / 2.0 - 120), "PAUSA",
				HORIZONTAL_ALIGNMENT_LEFT, -1, 48, Tema.CREMA)


# ----------------------------------------------------------------------
# Prueba de humo (integración continua): llegan los trabajadores, marchan, el cuartel
# general forma uno y lo cancela, y los trabajadores levantan un depósito. Cada paso se
# hace por el mismo camino que los clics del jugador (tarjeta, órdenes y lugar de la obra).

func _boton(clave: String) -> int:
	for i in slots.size():
		if slots[i] != null and slots[i]["clave"] == clave:
			return i
	return -1


func _propios(filtro: Callable) -> Array:
	var out: Array = []
	for e in est.ents.values():
		if est.propio(e) and not e.fantasma and filtro.call(e):
			out.append(e)
	return out


func _prueba_humo(delta: float) -> void:
	_prueba["t"] += delta
	var t: float = _prueba["t"]
	var fase: String = _prueba["fase"]
	if fase != "fin" and fase != "esperar" and t > 40.0:
		_terminar_prueba(false, "sin respuesta en la fase «%s»" % fase)
		return
	match fase:
		"esperar":
			var obreros := _propios(func(e) -> bool: return e.es_unidad() and e.tipo["trabajador"])
			if not obreros.is_empty() and t > 2.0:
				seleccionar(obreros.map(func(e) -> int: return e.id))
				var claves: Array = []
				for b in Tarjeta.tarjeta(est, seleccion, null):
					if b != null:
						claves.append(b["clave"])
				print("PRUEBA_HUMO: %d trabajadores; tarjeta: %s" % [obreros.size(), ", ".join(claves)])
				var e0 = obreros[0]
				var destino := Vector3(clampf(e0.x / 32.0 + 4.0, 1.0, est.w - 1.0), 0, clampf(e0.y / 32.0 + 3.0, 1.0, est.h - 1.0))
				_prueba["inicio"] = {}
				for e in obreros:
					_prueba["inicio"][e.id] = Vector2(e.x, e.y)
				orden_derecha(destino, null, false)
				camara.centrar(destino, true)
				camara.distancia = 15.0
				_fase("marchar")
			elif t > 150.0:
				_terminar_prueba(false, "no llegaron los trabajadores")
		"marchar":
			var movidos := 0
			for id in _prueba["inicio"]:
				var e = est.ents.get(id)
				if e != null and Vector2(e.x, e.y).distance_to(_prueba["inicio"][id]) > 32.0:
					movidos += 1
			if movidos > 0 and t > 2.0:
				print("PRUEBA_HUMO: %d trabajadores marcharon" % movidos)
				var cgs := _propios(func(e) -> bool: return e.es_edificio() and e.tipo["id"] == "cuartel_general")
				if cgs.is_empty():
					return
				_prueba["cg"] = cgs[0].id
				_prueba["dinero"] = est.dinero
				seleccionar([cgs[0].id])
				_fase("formar")
		"formar":
			# un cuadro después de elegir el cuartel, su tarjeta ya está armada
			var i := _boton("u:trabajador")
			if i < 0:
				_terminar_prueba(false, "el cuartel general no ofrece formar trabajadores")
				return
			activar_boton(i)
			_fase("formando")
		"formando":
			var cg = est.ents.get(_prueba["cg"])
			var cola: Array = (cg.ex if cg != null and typeof(cg.ex) == TYPE_DICTIONARY else {}).get("q", [])
			if not cola.is_empty():
				print("PRUEBA_HUMO: el cuartel forma un trabajador ($ %d -> %d)" % [_prueba["dinero"], est.dinero])
				var c := _boton("cancelar")
				if c < 0:
					_terminar_prueba(false, "no aparece el botón para cancelar")
					return
				activar_boton(c)
				_fase("cancelando")
		"cancelando":
			var cg = est.ents.get(_prueba["cg"])
			var cola: Array = (cg.ex if cg != null and typeof(cg.ex) == TYPE_DICTIONARY else {}).get("q", [])
			if cola.is_empty() and est.dinero >= int(_prueba["dinero"]):
				print("PRUEBA_HUMO: formación cancelada, se devolvió el dinero ($ %d)" % est.dinero)
				var obreros := _propios(func(e) -> bool: return e.es_unidad() and e.tipo["trabajador"])
				seleccionar(obreros.map(func(e) -> int: return e.id))
				_fase("menu_obra")
		"menu_obra":
			var i := _boton("menu_basico")
			if i < 0:
				return
			activar_boton(i)
			_fase("elegir_obra")
		"elegir_obra":
			var i := _boton("b:deposito")
			if i < 0:
				return
			activar_boton(i)
			var cg = est.ents.get(_prueba["cg"])
			var lugar: Variant = null
			for r in range(3, 14):
				for dy in range(-r, r + 1):
					for dx in [-r, r]:
						for par in [[dx, dy], [dy, dx]]:
							var p := Vector3(cg.x / 32.0 + par[0] + 0.5, 0, cg.y / 32.0 + par[1] + 0.5)
							if lugar == null and lugar_obra(p, "deposito")[2]:
								lugar = p
			if lugar == null:
				_terminar_prueba(false, "no hay lugar para el depósito")
				return
			_prueba["obras"] = _propios(func(e) -> bool: return e.es_edificio()).size()
			construir_en(lugar)
			camara.centrar(lugar, true)
			print("PRUEBA_HUMO: depósito encargado en %.1f, %.1f" % [lugar.x, lugar.z])
			_fase("obra")
		"obra":
			var obras := _propios(func(e) -> bool: return e.es_edificio())
			if obras.size() > int(_prueba["obras"]):
				print("PRUEBA_HUMO: la obra comenzó")
				_fase("captura")
		"captura":
			if t > 4.0:
				var ruta := ""
				for a in OS.get_cmdline_user_args():
					if a.begins_with("--captura="):
						ruta = a.trim_prefix("--captura=")
				if ruta != "" and DisplayServer.get_name() != "headless":
					get_viewport().get_texture().get_image().save_png(ruta)
					print("PRUEBA_HUMO: captura en ", ruta)
				_terminar_prueba(true, "")


func _fase(nueva: String) -> void:
	_prueba["fase"] = nueva
	_prueba["t"] = 0.0


func _terminar_prueba(ok: bool, motivo: String) -> void:
	_prueba["fase"] = "fin"
	print("PRUEBA_HUMO: " + ("OK" if ok else "FALLA: " + motivo))
	Juego.salir(0 if ok else 3)
