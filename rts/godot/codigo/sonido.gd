## Sonido (autocarga): fusilería, cañones, ametralladora, explosiones, corneta; las voces de
## la tropa y la música de banda. Es salitre/cliente/sonido.py llevado a Godot.
##
## Los efectos no son grabaciones: cada uno se sintetiza la primera vez que suena, a partir
## de ruido y osciladores. Si en recursos/sonidos/ hay un .ogg o .wav con el mismo nombre que
## un efecto, se usa ese archivo en su lugar.
##
## Las voces (recursos/sonidos/voces/<clave>_<n>.ogg) se cargan la primera vez que se dicen y
## suenan de a una: la tropa no se pisa al hablar. Con las voces desactivadas en las opciones
## vuelven los toques de corneta. La música (recursos/sonidos/musica/<pista>.ogg) suena en
## bucle y pasa de una pista a otra con un fundido; cada pantalla elige la suya.
##
## Los efectos de la batalla suenan en el lugar del mapa donde ocurren: más fuerte cuanto más
## cerca del centro de la vista y del lado de la pantalla donde están.
##
## Volúmenes (de 0 a 1): general, música, efectos y voces; cada uno es un bus de audio.
extends Node

const FREC := 22050
const FUNDIDO_SALIDA := 0.8
const FUNDIDO_ENTRADA := 1.6
# cuánto suena cada pista respecto del volumen de la música (en la batalla, por debajo del fuego)
const NIVEL_PISTA := {"marcha": 1.0, "campana": 0.7}
const VOLUMENES := ["volumen_general", "volumen_musica", "volumen_efectos", "volumen_voces"]
const BUS := {"volumen_musica": "Musica", "volumen_efectos": "Efectos", "volumen_voces": "Voces"}
const CANALES := 16
const CANALES_MAPA := 24

# toques de corneta: (semitono relativo a Sol 392 Hz, duración)
const TOQUES := {
	"lista": [[0, 0.12], [5, 0.12], [9, 0.3]],
	"ataque": [[9, 0.1], [9, 0.1], [9, 0.1], [5, 0.1], [9, 0.35]],
	"obra": [[0, 0.15], [4, 0.15], [7, 0.15], [12, 0.35]],
	"investigado": [[7, 0.15], [12, 0.4]],
	"victoria": [[0, 0.2], [4, 0.2], [7, 0.2], [12, 0.5], [7, 0.2], [12, 0.8]],
	"derrota": [[7, 0.4], [5, 0.4], [4, 0.4], [0, 1.0]],
}

var niveles := {"volumen_general": 1.0, "volumen_musica": 0.6, "volumen_efectos": 0.7, "volumen_voces": 0.9}
var voces_activas := true
var dir_sonidos := ""
var voces := {}                 # clave -> rutas de sus variantes
var dichas: Array = []          # claves dichas (para las pruebas)
var _efectos := {}              # nombre -> AudioStream
var _ultimo := {}               # nombre -> momento en ms
var _voz_cargada := {}          # ruta -> AudioStream
var _ultima_voz := {}           # clave -> última variante dicha
var _prioridad_voz := 0
var _pendiente: Variant = null  # [ruta, prioridad, vence en ms]: aviso que espera turno
var _rnd := RandomNumberGenerator.new()
var _musica: AudioStreamPlayer
var _voz: AudioStreamPlayer
var _canales: Array = []
var _canales_mapa: Array = []
var pista: Variant = null       # la pista pedida
var pista_sonando: Variant = null
var _fundido := 0.0             # 0 = muda, 1 = plena


func _init() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	_musica = AudioStreamPlayer.new()
	_musica.bus = "Musica"
	add_child(_musica)
	_voz = AudioStreamPlayer.new()
	_voz.bus = "Voces"
	add_child(_voz)
	for _i in CANALES:
		var p := AudioStreamPlayer.new()
		p.bus = "Efectos"
		add_child(p)
		_canales.append(p)
	for _i in CANALES_MAPA:
		var p3 := AudioStreamPlayer3D.new()
		p3.bus = "Efectos"
		p3.attenuation_model = AudioStreamPlayer3D.ATTENUATION_DISABLED
		p3.panning_strength = 0.8
		add_child(p3)
		_canales_mapa.append(p3)
	_rnd.seed = 1879


func _ready() -> void:
	# un bus por clase de sonido, para que cada volumen se aplique al instante a lo que suena
	for clave in BUS:
		if AudioServer.get_bus_index(BUS[clave]) < 0:
			AudioServer.add_bus()
			var i := AudioServer.bus_count - 1
			AudioServer.set_bus_name(i, BUS[clave])
			AudioServer.set_bus_send(i, "Master")
	_aplicar_volumenes()


## Al cerrar el juego se sueltan las pistas, las voces y los efectos que siguen cargados.
func _exit_tree() -> void:
	callar()


func callar() -> void:
	_musica.stop()
	_musica.stream = null
	_voz.stop()
	_voz.stream = null
	for p in _canales + _canales_mapa:
		p.stop()
		p.stream = null
	_voz_cargada.clear()
	_efectos.clear()


## Lee los volúmenes de la configuración y encuentra las voces de la tropa.
func configurar(config, dir_recursos: String) -> void:
	dir_sonidos = dir_recursos.path_join("sonidos")
	for clave in VOLUMENES:
		niveles[clave] = clampf(float(config.leer(clave)), 0.0, 1.0)
	voces_activas = bool(config.leer("voces"))
	_aplicar_volumenes()
	_indexar_voces()


# -- volúmenes ---------------------------------------------------------------
func fijar_volumen(clave: String, valor: float, config = null) -> void:
	niveles[clave] = clampf(valor, 0.0, 1.0)
	if config != null:
		config.escribir(clave, snappedf(niveles[clave], 0.01))
	_aplicar_volumenes()


func _aplicar_volumenes() -> void:
	_bus("Master", niveles["volumen_general"])
	for clave in BUS:
		_bus(BUS[clave], niveles[clave])


static func _bus(nombre: String, v: float) -> void:
	var i := AudioServer.get_bus_index(nombre)
	if i < 0:
		return
	AudioServer.set_bus_mute(i, v <= 0.001)
	AudioServer.set_bus_volume_db(i, linear_to_db(maxf(v, 0.001)))


# -- efectos ---------------------------------------------------------------------
func _efecto(nombre: String) -> AudioStream:
	if _efectos.has(nombre):
		return _efectos[nombre]
	var s: AudioStream = _archivo(dir_sonidos.path_join(nombre))
	if s == null:
		if nombre.begins_with("toque_") and TOQUES.has(nombre.trim_prefix("toque_")):
			s = _a_wav(sint_corneta(_rnd, TOQUES[nombre.trim_prefix("toque_")]), 0.6)
		elif has_method("sint_" + nombre):
			s = _a_wav(call("sint_" + nombre, _rnd), 0.9)
	_efectos[nombre] = s
	return s


## Un .ogg o .wav del disco (sin extensión en la ruta), o null.
static func _archivo(base: String) -> AudioStream:
	if base == "" or base.begins_with("/sonidos"):
		return null
	if FileAccess.file_exists(base + ".ogg"):
		return AudioStreamOggVorbis.load_from_file(base + ".ogg")
	if FileAccess.file_exists(base + ".wav"):
		return AudioStreamWAV.load_from_file(base + ".wav")
	return null


func _permitido(nombre: String, minimo_ms: int) -> bool:
	var ahora := Time.get_ticks_msec()
	if ahora - int(_ultimo.get(nombre, -99999)) < minimo_ms:
		return false
	_ultimo[nombre] = ahora
	return true


## Un efecto sin lugar (la interfaz, los toques de corneta).
func reproducir(nombre: String, volumen := 1.0, minimo_ms := 40) -> void:
	if not is_inside_tree() or niveles["volumen_efectos"] <= 0.0 or not _permitido(nombre, minimo_ms):
		return
	var s := _efecto(nombre)
	if s == null:
		return
	for p in _canales:
		if not p.playing:
			p.stream = s
			p.volume_db = linear_to_db(clampf(volumen, 0.001, 1.0))
			p.play()
			return


## Efecto en el mapa: más fuerte cuanto más cerca del centro de la vista (centro y ancho de lo
## que se ve, en casillas) y del lado de la pantalla donde ocurre.
func en_mapa(nombre: String, punto: Vector3, centro: Vector3, ancho: float, minimo_ms := 40, volumen := 1.0) -> void:
	var d := Vector2(punto.x - centro.x, punto.z - centro.z).length() / maxf(1.0, ancho)
	if d > 1.6 or not is_inside_tree() or niveles["volumen_efectos"] <= 0.0:
		return
	if not _permitido(nombre, minimo_ms):
		return
	var s := _efecto(nombre)
	if s == null:
		return
	for p in _canales_mapa:
		if not p.playing:
			p.stream = s
			p.global_position = punto
			p.volume_db = linear_to_db(clampf(volumen * (1.0 - d / 1.6), 0.001, 1.0))
			p.play()
			return


func toque(nombre: String) -> void:
	reproducir("toque_" + nombre, 0.9, 600)


func ui(nombre := "clic") -> void:
	reproducir(nombre, 0.6, 30)


# -- voces --------------------------------------------------------------------------
func _indexar_voces() -> void:
	voces.clear()
	var carpeta := dir_sonidos.path_join("voces")
	var dir := DirAccess.open(carpeta)
	if dir == null:
		return
	var archivos: Array = Array(dir.get_files())
	archivos.sort()
	for a: String in archivos:
		var ext := a.get_extension().to_lower()
		if ext != "ogg" and ext != "wav":
			continue
		var base: String = a.get_basename()
		var corte := base.rfind("_")
		if corte <= 0 or not base.substr(corte + 1).is_valid_int():
			continue
		var clave := base.substr(0, corte)
		if not voces.has(clave):
			voces[clave] = []
		voces[clave].append(carpeta.path_join(a))


## Dice una frase de la tropa: la primera de las claves que tenga voces (una variante al azar).
## Prioridades: 0 al seleccionar, 1 al dar una orden, 2 para los avisos (unidad lista, obra
## terminada...) y 3 para las alarmas (¡bajo ataque!, victoria). Una voz más importante corta
## a la que suena; una de igual o menor importancia se descarta, salvo los avisos, que esperan
## su turno unos segundos. Devuelve false si no hay voz (desactivadas o sin archivos), para
## que suene el toque de corneta en su lugar.
func voz(claves: Variant, prioridad := 1) -> bool:
	if niveles["volumen_voces"] <= 0.0 or not voces_activas:
		return false
	var lista: Array = [claves] if claves is String else claves
	var clave := ""
	for c in lista:
		if voces.has(c) and not voces[c].is_empty():
			clave = c
			break
	if clave == "":
		return false
	var variantes: Array = voces[clave]
	var otras := variantes.filter(func(r: String) -> bool: return r != _ultima_voz.get(clave, ""))
	if otras.is_empty():
		otras = variantes
	var ruta: String = otras[_rnd.randi() % otras.size()]
	_ultima_voz[clave] = ruta
	dichas.append(clave)
	if not is_inside_tree():
		return true
	if _voz.playing and prioridad <= _prioridad_voz:
		if prioridad >= 2:
			_pendiente = [ruta, prioridad, Time.get_ticks_msec() + 4000]
		return true
	_decir(ruta, prioridad)
	return true


func _decir(ruta: String, prioridad: int) -> void:
	var s: AudioStream = _voz_cargada.get(ruta)
	if s == null:
		s = AudioStreamOggVorbis.load_from_file(ruta) if ruta.ends_with(".ogg") else AudioStreamWAV.load_from_file(ruta)
		if s == null:
			return
		_voz_cargada[ruta] = s
	_voz.stream = s
	_voz.play()
	_prioridad_voz = prioridad


# -- música ----------------------------------------------------------------------
## Pide una pista (null: silencio); la que suena se apaga con un fundido y entra la nueva.
func musica(nueva: Variant) -> void:
	pista = nueva


func _ruta_pista(nombre: String) -> String:
	for ext in [".ogg", ".wav"]:
		var r := dir_sonidos.path_join("musica").path_join(nombre + ext)
		if FileAccess.file_exists(r):
			return r
	return ""


func _aplicar_musica() -> void:
	if pista_sonando != null:
		var v: float = NIVEL_PISTA.get(pista_sonando, 1.0) * _fundido
		_musica.volume_db = linear_to_db(maxf(v, 0.0001))


func _process(delta: float) -> void:
	var dt := minf(delta, 0.25)
	if pista_sonando != pista:
		if pista_sonando != null and _fundido > 0.0:
			_fundido = maxf(0.0, _fundido - dt / FUNDIDO_SALIDA)
			_aplicar_musica()
		else:
			# la anterior ya se apagó: entra la pedida (si existe su archivo)
			_musica.stop()
			pista_sonando = null
			var ruta := _ruta_pista(pista) if pista != null else ""
			if ruta != "":
				var s: AudioStream = AudioStreamOggVorbis.load_from_file(ruta) if ruta.ends_with(".ogg") \
						else AudioStreamWAV.load_from_file(ruta)
				if s != null:
					if s is AudioStreamOggVorbis:
						s.loop = true
					_musica.stream = s
					_fundido = 0.0
					pista_sonando = pista
					_aplicar_musica()
					_musica.play()
			if pista_sonando == null:
				pista = null      # sin archivo no hay nada que fundir: se da por atendida
	elif pista_sonando != null and _fundido < 1.0:
		_fundido = minf(1.0, _fundido + dt / FUNDIDO_ENTRADA)
		_aplicar_musica()
	# el aviso que esperaba turno para hablar
	if _pendiente != null and not _voz.playing:
		var p: Array = _pendiente
		_pendiente = null
		if Time.get_ticks_msec() <= int(p[2]):
			_decir(p[0], p[1])


# ----------------------------------------------------------------------
# Síntesis (las mismas recetas que sonido.py)

static func _a_wav(muestras: PackedFloat32Array, volumen: float) -> AudioStreamWAV:
	var pico := 1e-6
	for m in muestras:
		pico = maxf(pico, absf(m))
	var esc := 30000.0 * volumen / pico
	var datos := PackedByteArray()
	datos.resize(muestras.size() * 2)
	for i in muestras.size():
		datos.encode_s16(i * 2, clampi(int(muestras[i] * esc), -32767, 32767))
	var w := AudioStreamWAV.new()
	w.format = AudioStreamWAV.FORMAT_16_BITS
	w.mix_rate = FREC
	w.stereo = false
	w.data = datos
	return w


static func _env(n: int, ataque: float, caida: float) -> PackedFloat32Array:
	var out := PackedFloat32Array()
	out.resize(n)
	var a := maxi(1, int(ataque * FREC))
	var c := maxf(1.0, caida * FREC)
	for i in n:
		out[i] = float(i) / a if i < a else exp(-(i - a) / c)
	return out


static func _ruido_filtrado(n: int, rnd: RandomNumberGenerator, corte: float) -> PackedFloat32Array:
	var out := PackedFloat32Array()
	out.resize(n)
	var y := 0.0
	for i in n:
		y += corte * (rnd.randf_range(-1.0, 1.0) - y)
		out[i] = y
	return out


func sint_fusil(rnd: RandomNumberGenerator) -> PackedFloat32Array:
	var n := int(0.45 * FREC)
	var ruido := _ruido_filtrado(n, rnd, 0.55)
	var env := _env(n, 0.002, 0.06)
	var cola := _ruido_filtrado(n, rnd, 0.08)
	var out := PackedFloat32Array()
	out.resize(n)
	for i in n:
		out[i] = ruido[i] * env[i] + 0.6 * cola[i] * exp(-i / (0.18 * FREC))
	return out


func sint_canon(rnd: RandomNumberGenerator) -> PackedFloat32Array:
	var n := int(1.6 * FREC)
	var grave := _ruido_filtrado(n, rnd, 0.04)
	var medio := _ruido_filtrado(n, rnd, 0.2)
	var out := PackedFloat32Array()
	out.resize(n)
	for i in n:
		var t := float(i) / FREC
		var golpe := sin(TAU * (55.0 - 20.0 * t) * t) * exp(-t / 0.15)
		out[i] = 2.2 * grave[i] * exp(-t / 0.35) + 0.5 * medio[i] * exp(-t / 0.08) + 0.8 * golpe
	return out


func sint_explosion(rnd: RandomNumberGenerator) -> PackedFloat32Array:
	var n := int(1.4 * FREC)
	var grave := _ruido_filtrado(n, rnd, 0.06)
	var agudo := _ruido_filtrado(n, rnd, 0.6)
	var out := PackedFloat32Array()
	out.resize(n)
	for i in n:
		out[i] = 1.6 * grave[i] * exp(-i / (0.4 * FREC)) + 0.4 * agudo[i] * exp(-i / (0.05 * FREC))
	return out


func sint_gatling(rnd: RandomNumberGenerator) -> PackedFloat32Array:
	var n := int(0.9 * FREC)
	var out := PackedFloat32Array()
	out.resize(n)
	for k in 8:
		var ini := int(k * 0.11 * FREC)
		var tiro := sint_fusil(rnd)
		for i in mini(tiro.size(), n - ini):
			out[ini + i] += tiro[i] * (0.6 if i > 2000 else 1.0)
	return out


static func sint_corneta(_rnd: RandomNumberGenerator, notas: Array) -> PackedFloat32Array:
	var out := PackedFloat32Array()
	for par in notas:
		var f := 392.0 * pow(2.0, float(par[0]) / 12.0)
		var dur := float(par[1])
		var n := int(dur * FREC)
		for i in n:
			var t := float(i) / FREC
			var env := minf(1.0, t / 0.02) * (1.0 - maxf(0.0, (t - dur + 0.05) / 0.05))
			var v := sin(TAU * f * t) + 0.5 * sin(2.0 * TAU * f * t) + 0.25 * sin(3.0 * TAU * f * t) \
					+ 0.12 * sin(4.0 * TAU * f * t)
			out.append(v * env * 0.5)
		for _i in int(0.02 * FREC):
			out.append(0.0)
	return out


func sint_clic(_rnd: RandomNumberGenerator) -> PackedFloat32Array:
	var n := int(0.05 * FREC)
	var out := PackedFloat32Array()
	out.resize(n)
	for i in n:
		out[i] = sin(TAU * 1800.0 * i / FREC) * exp(-i / (0.006 * FREC))
	return out


func sint_martillo(rnd: RandomNumberGenerator) -> PackedFloat32Array:
	var n := int(0.25 * FREC)
	var out := PackedFloat32Array()
	out.resize(n)
	for i in n:
		out[i] = (sin(TAU * 900.0 * i / FREC) + rnd.randf_range(-0.6, 0.6)) * exp(-i / (0.02 * FREC))
	return out


func sint_sable(rnd: RandomNumberGenerator) -> PackedFloat32Array:
	var n := int(0.25 * FREC)
	var out := PackedFloat32Array()
	out.resize(n)
	for i in n:
		out[i] = (sin(TAU * (2400.0 + 800.0 * sin(i / 300.0)) * i / FREC) * 0.4 + rnd.randf_range(-0.5, 0.5)) \
				* exp(-i / (0.04 * FREC))
	return out


## Silbato de la locomotora: acorde agudo con soplido de vapor.
func sint_silbato(rnd: RandomNumberGenerator) -> PackedFloat32Array:
	var n := int(1.3 * FREC)
	var vapor := _ruido_filtrado(n, rnd, 0.5)
	var out := PackedFloat32Array()
	out.resize(n)
	for i in n:
		var t := float(i) / FREC
		var env := minf(1.0, t / 0.06) * (1.0 if t < 1.0 else maxf(0.0, 1.0 - (t - 1.0) / 0.3))
		var tono := sin(TAU * 523.0 * t) + 0.8 * sin(TAU * 659.0 * t) + 0.6 * sin(TAU * 784.0 * t)
		out[i] = env * (0.5 * tono + 0.35 * vapor[i])
	return out
