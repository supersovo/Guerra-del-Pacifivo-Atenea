## Protocolo de red del juego, igual al del servidor en Python (salitre/red/protocolo.py).
##
## Cada mensaje viaja como 4 bytes de longitud (big-endian, cuentan el byte de formato y
## el cuerpo) + 1 byte de formato + cuerpo. Formato 1: JSON en UTF-8. Formato 2: JSON
## comprimido con zlib (el modo DEFLATE de Godot es el mismo formato zlib de Python).
## Todo mensaje es un diccionario con la clave "t" (tipo).
extends RefCounted

const FMT_JSON := 1
const FMT_ZLIB := 2
const UMBRAL_COMPRIMIR := 1024
const MAX_MENSAJE := 8 * 1024 * 1024


static func codificar(msg: Dictionary) -> PackedByteArray:
	var cuerpo := JSON.stringify(msg).to_utf8_buffer()
	var fmt := FMT_JSON
	if cuerpo.size() > UMBRAL_COMPRIMIR:
		cuerpo = cuerpo.compress(FileAccess.COMPRESSION_DEFLATE)
		fmt = FMT_ZLIB
	var largo := cuerpo.size() + 1
	var out := PackedByteArray([(largo >> 24) & 0xFF, (largo >> 16) & 0xFF, (largo >> 8) & 0xFF, largo & 0xFF, fmt])
	out.append_array(cuerpo)
	return out


## Decodifica el cuerpo de un mensaje. Devuelve el diccionario o null si no es válido.
static func decodificar_cuerpo(fmt: int, cuerpo: PackedByteArray) -> Variant:
	return Lector.decodificar(fmt, cuerpo)


## Arma mensajes a partir de bytes sueltos (el socket los entrega en trozos).
class Lector:
	extends RefCounted
	var buf := PackedByteArray()
	var error := ""

	static func decodificar(fmt: int, cuerpo: PackedByteArray) -> Variant:
		if fmt == FMT_ZLIB:
			cuerpo = cuerpo.decompress_dynamic(MAX_MENSAJE, FileAccess.COMPRESSION_DEFLATE)
			if cuerpo.is_empty():
				return null
		elif fmt != FMT_JSON:
			return null
		var msg: Variant = JSON.parse_string(cuerpo.get_string_from_utf8())
		if typeof(msg) != TYPE_DICTIONARY or typeof(msg.get("t")) != TYPE_STRING:
			return null
		return msg

	## Agrega bytes y devuelve los mensajes completos. Si algo no es válido, deja 'error'.
	func alimentar(datos: PackedByteArray) -> Array:
		buf.append_array(datos)
		var out: Array = []
		var pos := 0
		while buf.size() - pos >= 5:
			var largo := (buf[pos] << 24) | (buf[pos + 1] << 16) | (buf[pos + 2] << 8) | buf[pos + 3]
			if largo < 1 or largo > MAX_MENSAJE:
				error = "largo de mensaje inválido (%d)" % largo
				break
			if buf.size() - pos < 4 + largo:
				break
			var fmt := buf[pos + 4]
			var msg: Variant = decodificar(fmt, buf.slice(pos + 5, pos + 4 + largo))
			pos += 4 + largo
			if msg == null:
				error = "mensaje inválido (formato %d)" % fmt
				break
			out.append(msg)
		if pos > 0:
			buf = buf.slice(pos)
		return out
