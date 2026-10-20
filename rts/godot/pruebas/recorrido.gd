## Recorridos automáticos del menú para las pruebas: eligen en las pantallas como lo haría un
## jugador y comprueban lo que se ve. La batalla hace su parte (batalla.gd: la prueba de humo
## y la rendición de prueba) y al volver al menú el recorrido sigue desde el parte de guerra.
##
##   --prueba-humo                 escaramuza, órdenes, conversación, menú, rendición y parte
##   --recorrido=pantallas         cada pantalla del menú y cada ficha del archivo
##   --recorrido=campana           campaña nueva, primera batalla, rendición, parte y escalafón
##   --recorrido=multijugador --conectar=host:puerto
##                                 salón, sala con un rival de la IA, batalla, parte y vuelta
##
## Imprime «RECORRIDO: OK» y sale con 0, o «RECORRIDO: FALLA: ...» y sale con 4.
extends Node

var menu
var fase := ""
var t := 0.0
var _visitas: Array = []
var _capturas := ""


func _ready() -> void:
	if Juego.captura != "" and Juego.recorrido == "pantallas":
		_capturas = Juego.captura
		DirAccess.make_dir_recursive_absolute(_capturas)
	var donde: String = menu.nombre_pantalla
	if donde == "parte":
		fase = "parte"
	elif Juego.prueba_humo:
		fase = "escaramuza"
	else:
		fase = Juego.recorrido


func _process(delta: float) -> void:
	t += delta
	if t > 90.0:
		_falla("sin avance en la fase «%s» (pantalla %s)" % [fase, menu.nombre_pantalla])
		return
	var p: Control = menu.pantalla
	if p == null or not p.is_node_ready():
		return
	match fase:
		"escaramuza":
			# prueba de humo: la escaramuza elegida, a toda velocidad
			if menu.nombre_pantalla != "escaramuza":
				menu.abrir("escaramuza")
				return
			if Juego.mapa_prueba in p.mapas:
				p.elegir_en_lista(p.lista_mapas, Juego.mapa_prueba)
				p.elegir_mapa(Juego.mapa_prueba)
			p.poner_valor(p.vel, "muy_rapida")
			print("PRUEBA_HUMO: menú listo, %d mapas" % p.mapas.size())
			_fase("esperar_batalla")
			p.comenzar()
		"esperar_batalla":
			pass
		"pantallas":
			_pantallas(p)
		"campana":
			if menu.nombre_pantalla != "campana":
				menu.abrir("campana")
				return
			p.nueva()
			p.elegir_nacion("chile")
			print("RECORRIDO: campaña nueva, primera batalla: ", p.campana.etapas[0].nombre)
			_fase("esperar_batalla")
			p.marchar()
		"multijugador":
			_multijugador(p)
		"en_sala", "en_salon", "saliendo":
			_multijugador(p)
		"parte":
			_parte(p)
		"campana_final":
			if menu.nombre_pantalla != "campana" or t < 0.5:
				return
			if not p.has_meta("foto"):
				p.set_meta("foto", true)
				Juego.foto("campana_tras_la_batalla")
				return
			var parte: Node = p.find_child("Parte", true, false)
			var texto: String = parte.text if parte != null else ""
			print("RECORRIDO: campaña: ", texto)
			if not texto.begins_with("Derrota en San Francisco"):
				_falla("la campaña no muestra la derrota en su primera batalla")
				return
			var u: Array = Juego.perfil.ultima_campana("salitre")
			if u[1] == null or u[1]["historial"].size() != 1 or int(u[1]["etapa"]) != 0:
				_falla("el perfil no guardó la batalla de la campaña")
				return
			_ok()


func _fase(nueva: String) -> void:
	fase = nueva
	t = 0.0


func _ok() -> void:
	fase = "fin"
	print("RECORRIDO: OK")
	if Juego.prueba_humo:
		print("PRUEBA_HUMO: OK")
	Juego.salir(0)


func _falla(motivo: String) -> void:
	fase = "fin"
	print("RECORRIDO: FALLA: " + motivo)
	if Juego.prueba_humo:
		print("PRUEBA_HUMO: FALLA: " + motivo)
	Juego.salir(4)


# ----------------------------------------------------------------------
# El parte de guerra, al volver de cualquier batalla

func _parte(p: Control) -> void:
	if menu.nombre_pantalla != "parte":
		return
	if t < 0.5:
		return
	if not p.has_meta("foto"):
		p.set_meta("foto", true)
		Juego.foto("parte_%s" % Juego.origen)
		return
	var fin: Dictionary = Juego.fin if Juego.fin is Dictionary else {}
	var filas: int = fin.get("resultados", []).size()
	print("RECORRIDO: parte de guerra con %d ejércitos (origen %s)" % [filas, Juego.origen])
	if filas < 2:
		_falla("el parte de guerra no trae los ejércitos")
		return
	match Juego.origen:
		"campana":
			_fase("campana_final")
			p.volver()
		"multijugador":
			_fase("en_sala")
			p.volver()
		_:
			if Juego.prueba_humo:
				var r: Dictionary = Juego.perfil.resumen()
				if r["jugadas"] != 1 or r["derrotas"] != 1:
					_falla("la escaramuza no quedó en el historial del perfil")
					return
				print("PRUEBA_HUMO: escaramuza anotada en el perfil (%d jugada, %d derrota)" % [r["jugadas"], r["derrotas"]])
			p.volver()
			if menu.nombre_pantalla != "portada":
				_falla("«Volver» no lleva a la portada")
				return
			_ok()


# ----------------------------------------------------------------------
# Todas las pantallas (y cada pestaña y ficha del archivo)

const ORDEN := ["portada", "escaramuza", "campana", "conectar", "repeticiones", "archivo", "opciones", "portada"]


func _pantallas(p: Control) -> void:
	if t < 0.6:
		return
	var i := _visitas.size()
	if i > 0 and _capturas != "" and DisplayServer.get_name() != "headless":
		get_viewport().get_texture().get_image().save_png(_capturas.path_join("%02d_%s.png" % [i, menu.nombre_pantalla]))
	if menu.nombre_pantalla == "archivo" and not p.has_meta("recorrido"):
		p.set_meta("recorrido", true)
		for pestana in p.PESTANAS:
			p.elegir_pestana(pestana[0])
			for k in p.lista_fichas.item_count:
				p.elegir(p.lista_fichas.get_item_metadata(k))
		# un héroe con su retrato 3D para la imagen
		p.elegir_pestana("heroes")
		print("RECORRIDO: archivo: todas las fichas")
		t = 0.0
		return
	if menu.nombre_pantalla == "escaramuza" and not p.has_meta("recorrido"):
		p.set_meta("recorrido", true)
		for k in p.mapas:
			p.elegir_mapa(k)
		p.elegir_mapa("pampa_del_tamarugal")
		print("RECORRIDO: escaramuza: %d mapas con sus rivales" % p.mapas.size())
		t = 0.0
		return
	if i >= ORDEN.size():
		_ok()
		return
	_visitas.append(ORDEN[i])
	menu.abrir(ORDEN[i])
	t = 0.0


# ----------------------------------------------------------------------
# Multijugador: salón, sala con un rival de la IA, batalla y vuelta

func _multijugador(p: Control) -> void:
	match fase:
		"multijugador":
			if menu.nombre_pantalla == "portada":
				menu.abrir("conectar", {"direccion": Juego.conectar_a, "conectar": true})
				return
			if menu.nombre_pantalla == "salon" and t > 1.0:
				print("RECORRIDO: en el salón de %s" % Juego.bienvenida.get("servidor", "?"))
				Juego.foto("salon")
				p.abrir_crear()
				p._crear()
				_fase("en_sala")
		"en_sala":
			if menu.nombre_pantalla != "sala" or t < 1.0:
				return
			var ranuras: Array = p._sala().get("ranuras", [])
			if Juego.fin == null:
				if not ranuras.any(func(r: Dictionary) -> bool: return r["tipo"] == "ia"):
					if not p.has_meta("ia"):
						p.set_meta("ia", true)
						print("RECORRIDO: en la sala «%s»; se agrega la IA" % p._sala().get("nombre", ""))
						p.agregar_ia()
					return
				if not p.has_meta("iniciada"):
					p.set_meta("iniciada", true)
					Juego.foto("sala")
					print("RECORRIDO: la sala tiene su rival de la IA; ¡a combatir!")
					p._enviar({"t": "iniciar"})
			else:
				# de vuelta de la batalla
				print("RECORRIDO: de vuelta en la sala tras la batalla")
				_fase("en_salon")
				p.salir_sala()
		"en_salon":
			if menu.nombre_pantalla == "salon" and t > 1.0:
				print("RECORRIDO: de vuelta en el salón")
				_fase("saliendo")
				p.desconectar()
		"saliendo":
			if menu.nombre_pantalla == "conectar":
				_ok()
