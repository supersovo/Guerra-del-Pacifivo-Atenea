## Conexión con el servidor: TCP sin bloquear, consultada en cada cuadro (sondear).
extends RefCounted

const Protocolo = preload("res://codigo/red/protocolo.gd")

var tcp := StreamPeerTCP.new()
var lector := Protocolo.Lector.new()
var estado := "desconectado"        # desconectado | conectando | conectado | error
var error := ""
var host := ""
var puerto := 0
var bytes_rx := 0
var bytes_tx := 0
var pendientes: Array = []


func conectar(h: String, p: int) -> void:
	cerrar()
	host = h
	puerto = p
	tcp = StreamPeerTCP.new()
	lector = Protocolo.Lector.new()
	error = ""
	var err := tcp.connect_to_host(h, p)
	if err != OK:
		estado = "error"
		error = "No se pudo conectar con %s:%d (error %d)" % [h, p, err]
		return
	estado = "conectando"


func cerrar() -> void:
	if tcp.get_status() != StreamPeerTCP.STATUS_NONE:
		tcp.disconnect_from_host()
	estado = "desconectado"
	pendientes.clear()


func conectado() -> bool:
	return estado == "conectado"


func enviar(msg: Dictionary) -> void:
	if estado != "conectado":
		return
	var datos := Protocolo.codificar(msg)
	bytes_tx += datos.size()
	var err := tcp.put_data(datos)
	if err != OK:
		_caida("no se pudo enviar (error %d)" % err)


func saludar(nombre: String, huella: String, version: String, protocolo: int, clave := "", registrar := false) -> void:
	enviar({"t": "hola", "protocolo": protocolo, "version": version, "huella": huella,
			"nombre": nombre, "clave": clave, "registrar": registrar})


func comando(cmd: Dictionary) -> void:
	enviar({"t": "cmd", "cmd": cmd})


## Mensajes que llegaron desde la última consulta. No bloquea nunca.
func sondear() -> Array:
	var out := pendientes
	pendientes = []
	if estado == "desconectado" or estado == "error":
		return out
	tcp.poll()
	var s := tcp.get_status()
	if s == StreamPeerTCP.STATUS_CONNECTING:
		return out
	if s != StreamPeerTCP.STATUS_CONNECTED:
		_caida("conexión cerrada" if estado == "conectado" else "no hay servidor en %s:%d" % [host, puerto])
		return out
	if estado == "conectando":
		estado = "conectado"
		tcp.set_no_delay(true)
	while true:
		var n := tcp.get_available_bytes()
		if n <= 0:
			break
		var r: Array = tcp.get_partial_data(n)
		if r[0] != OK:
			_caida("error de lectura %d" % r[0])
			break
		var datos: PackedByteArray = r[1]
		if datos.is_empty():
			break
		bytes_rx += datos.size()
		out.append_array(lector.alimentar(datos))
		if lector.error != "":
			_caida(lector.error)
			break
	return out


func _caida(motivo: String) -> void:
	error = motivo
	estado = "error"
	tcp.disconnect_from_host()
