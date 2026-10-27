## Búsqueda de servidores en la red local (salitre/servidor/descubrimiento.py): se manda
## «SALITRE?» por difusión al puerto 47801 y cada servidor de la red responde con su nombre,
## puerto y versión. Así los compañeros de una misma sala de clases o de una misma casa se
## encuentran sin escribir direcciones IP. Se consulta en cada cuadro (sin hilos).
extends RefCounted

const PUERTO_LAN := 47801
const PREGUNTA := "SALITRE?"

var activa := false
var nueva := false              # hay resultados sin leer
var encontrados: Array = []     # [{nombre, host, puerto, jugadores, ...}]
var _udp: PacketPeerUDP
var _hasta := 0.0
var _vistos := {}


func iniciar(espera := 1.2) -> void:
	if activa:
		return
	_udp = PacketPeerUDP.new()
	_udp.set_broadcast_enabled(true)
	if _udp.bind(0) != OK:
		return
	for destino in ["255.255.255.255", "127.0.0.1"]:
		_udp.set_dest_address(destino, PUERTO_LAN)
		_udp.put_packet(PREGUNTA.to_utf8_buffer())
	_vistos.clear()
	activa = true
	_hasta = Time.get_ticks_msec() / 1000.0 + espera


func sondear() -> void:
	if not activa:
		return
	while _udp.get_available_packet_count() > 0:
		var datos := _udp.get_packet()
		var host := _udp.get_packet_ip()
		var info: Variant = JSON.parse_string(datos.get_string_from_utf8())
		if info is Dictionary:
			info["host"] = host
			_vistos["%s:%s" % [host, str(info.get("puerto", ""))]] = info
	if Time.get_ticks_msec() / 1000.0 >= _hasta:
		_udp.close()
		activa = false
		encontrados = _vistos.values()
		nueva = true
