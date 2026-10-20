## Campañas: batallas encadenadas contra la IA en las que los veteranos pasan de una batalla
## a la siguiente (como salitre/contenido/campanas.py; la prueba cruzada los compara).
##
## El estado de una campaña es un diccionario que se guarda en el perfil: faccion, etapa
## (índice de la próxima batalla), escalafon (veteranos vivos), caidos (libro de los caídos),
## honores, historial, rival (veteranos de la IA por nación), contador y terminada. Cada
## veterano es una ficha {ficha, tipo, grado, xp, nombre, batallas, bajas}: el servidor la
## recibe en la configuración del jugador y el veterano baja del tren con el cuartel general.
extends RefCounted

const MAX_VETERANOS := 200


class Etapa:
	var indice := 0
	var id := ""
	var nombre := ""
	var fecha := ""
	var mapa := ""
	var dificultad := "normal"
	var relato := ""
	var nucleo_rival: Array = []
	var _rival: Dictionary = {}

	func _init(i: int, d: Dictionary) -> void:
		indice = i
		id = str(d["id"])
		nombre = str(d.get("nombre", id))
		fecha = str(d.get("fecha", ""))
		mapa = str(d["mapa"])
		dificultad = str(d.get("dificultad", "normal"))
		relato = str(d.get("relato", ""))
		nucleo_rival = d.get("nucleo_rival", []).duplicate(true)
		_rival = d.get("rival", {}).duplicate()

	## Nación de la IA según la del jugador.
	func rival(faccion: String) -> String:
		var r := str(_rival.get(faccion, ""))
		if r == "":
			r = str(_rival.get("otra", ""))
		if r == "":
			r = "peru"
		if r != faccion:
			return r
		return "chile" if faccion != "chile" else "peru"


class Campana:
	var id := ""
	var nombre := ""
	var descripcion := ""
	var naciones: Array = []
	var honor_victoria := 10
	var honor_grado: Array = [0, 1, 3, 6]
	var medallas: Array = []
	var etapas: Array = []

	func _init(cid: String, d: Dictionary) -> void:
		id = cid
		nombre = str(d.get("nombre", cid))
		descripcion = str(d.get("descripcion", ""))
		naciones = d.get("naciones", ["chile", "peru", "bolivia"]).duplicate()
		var h: Dictionary = d.get("honores", {})
		honor_victoria = int(h.get("victoria", 10))
		honor_grado = []
		for x in h.get("por_grado", [0, 1, 3, 6]):
			honor_grado.append(int(x))
		medallas = d.get("medallas", [{"nombre": "Medalla de la campaña", "minimo": 0}]).duplicate(true)
		# de la más exigente a la menos (orden estable, como sorted() en Python)
		var orden: Array = range(medallas.size())
		var lista_m := medallas
		orden.sort_custom(func(i: int, j: int) -> bool:
			var a := int(lista_m[i].get("minimo", 0))
			var b := int(lista_m[j].get("minimo", 0))
			return a > b or (a == b and i < j))
		var ordenadas: Array = []
		for i in orden:
			ordenadas.append(medallas[i])
		medallas = ordenadas
		var lista: Array = d.get("etapas", [])
		for i in lista.size():
			etapas.append(Etapa.new(i, lista[i]))

	func honores_de(veteranos: Array) -> int:
		var total := 0
		for v in veteranos:
			total += int(honor_grado[clampi(int(v.get("grado", 0)), 0, honor_grado.size() - 1)])
		return total

	func medalla(honores: int) -> String:
		for m in medallas:
			if honores >= int(m.get("minimo", 0)):
				return str(m["nombre"])
		return ""


## Las campañas de datos/campanas.json, por id.
static func cargar(dir_datos: String) -> Dictionary:
	var out := {}
	var v: Variant = JSON.parse_string(FileAccess.get_file_as_string(dir_datos.path_join("campanas.json")))
	if not v is Dictionary:
		return out
	for k in v:
		if not str(k).begins_with("_"):
			out[k] = Campana.new(k, v[k])
	return out


# ----------------------------------------------------------------------

## Entero acotado, como int() de Python (los números del JSON llegan como decimales).
static func _entero(v: Variant, minimo: int, maximo: int) -> Variant:
	if v is float or v is int:
		return clampi(int(v), minimo, maximo)
	if v is String and v.strip_edges().is_valid_int():
		return clampi(v.strip_edges().to_int(), minimo, maximo)
	if v is bool:
		return clampi(int(v), minimo, maximo)
	return null


static func _verdadero(v: Variant) -> bool:
	if v == null:
		return false
	if v is String:
		return v != ""
	if v is float or v is int or v is bool:
		return v != 0
	return true


## Ficha validada (tipos, grados y números en rango) o null si no sirve.
static func ficha_limpia(cat, v: Variant) -> Variant:
	if not v is Dictionary:
		return null
	var tipo: Dictionary = cat.tipos_por_id.get(str(v.get("tipo")), {})
	if tipo.is_empty() or tipo.get("edificio", false) or not tipo.get("veterania", false):
		return null
	var maximo := int(cat.datos["veterania"]["maximo"])
	var grado: Variant = _entero(v.get("grado", 0), 0, maximo)
	var xp: Variant = _entero(v.get("xp", 0), 0, 1000000000)
	var nombre: Variant = _entero(v.get("nombre", 0), 0, 2147483647)
	var batallas: Variant = _entero(v.get("batallas", 0), 0, 999)
	var bajas: Variant = _entero(v.get("bajas", 0), 0, 99999)
	if grado == null or xp == null or nombre == null or batallas == null or bajas == null:
		return null
	var ficha := ""
	if _verdadero(v.get("ficha")):
		ficha = str(v.get("ficha")).left(40)
	return {"ficha": ficha, "tipo": tipo["id"], "grado": grado, "xp": xp, "nombre": nombre, "batallas": batallas,
			"bajas": bajas}


static func fichas_limpias(cat, lista: Variant) -> Array:
	var out: Array = []
	if not lista is Array:
		return out
	for v in lista.slice(0, MAX_VETERANOS):
		var f: Variant = ficha_limpia(cat, v)
		if f != null:
			out.append(f)
	return out


static func nuevo_estado(campana: Campana, faccion: String) -> Dictionary:
	return {"campana": campana.id, "faccion": faccion, "etapa": 0, "escalafon": [], "caidos": [], "honores": 0,
			"historial": [], "rival": {}, "contador": 0, "terminada": false}


## Experiencia que necesita una unidad de ese tipo para el grado (sim: Veterania.umbral).
static func umbral(cat, tipo: Dictionary, grado: int) -> int:
	var vet: Dictionary = cat.datos["veterania"]
	return int(tipo["valor"]) * int(vet["grados"][grado]["umbral"]) * int(vet["xpf"]) / 100


## Los veteranos con que empieza la IA: los suyos que sobrevivieron y el núcleo de la etapa.
static func veteranos_rival(cat, campana: Campana, estado: Dictionary, etapa: Etapa) -> Array:
	var rival := etapa.rival(str(estado["faccion"]))
	var out: Array = []
	for v in estado.get("rival", {}).get(rival, []):
		out.append(v.duplicate())
	var maximo := int(cat.datos["veterania"]["maximo"])
	for n in etapa.nucleo_rival:
		var tipo: Dictionary = cat.tipos_por_id.get(str(n.get("tipo")), {})
		if tipo.is_empty() or tipo.get("edificio", false) or not tipo.get("veterania", false):
			continue
		var grado := clampi(int(n.get("grado", 1)), 1, maximo)
		for _k in int(n.get("cantidad", 1)):
			out.append({"ficha": "", "tipo": tipo["id"], "grado": grado, "xp": umbral(cat, tipo, grado), "nombre": 0,
					"batallas": etapa.indice, "bajas": 0})
	return fichas_limpias(cat, out)


static func _antes(a: Dictionary, b: Dictionary) -> bool:
	# orden del escalafón: grado mayor, más bajas y, a igualdad, por ficha
	if int(a["grado"]) != int(b["grado"]):
		return int(a["grado"]) > int(b["grado"])
	if int(a["bajas"]) != int(b["bajas"]):
		return int(a["bajas"]) > int(b["bajas"])
	return str(a["ficha"]) < str(b["ficha"])


## Pasa el parte de una batalla al escalafón de un ejército: los vivos quedan con una batalla
## más, los caídos van al libro y los que no llegaron a desplegarse siguen de reserva.
## Devuelve [vivos, caídos, nuevos].
static func actualizar_escalafon(cat, estado: Dictionary, resultado: Variant, etiqueta: String) -> Array:
	var res: Dictionary = resultado if resultado is Dictionary else {}
	var vivos: Array = []
	var nuevos := 0
	for v in fichas_limpias(cat, res.get("veteranos", [])):
		if int(v["grado"]) < 1:
			continue
		if v["ficha"] == "":
			estado["contador"] = int(estado.get("contador", 0)) + 1
			v["ficha"] = "v%d" % int(estado["contador"])
			nuevos += 1
		v["batallas"] = int(v["batallas"]) + 1
		vivos.append(v)
	var caidos: Array = []
	for v in fichas_limpias(cat, res.get("caidos", [])):
		if int(v["grado"]) >= 1 or v["ficha"] != "":
			v["etapa"] = etiqueta
			v["batallas"] = int(v["batallas"]) + 1
			caidos.append(v)
	var presentes := {}
	for v in vivos + caidos:
		presentes[v["ficha"]] = true
	var escalafon: Array = vivos.duplicate()
	for v in estado["escalafon"]:
		if not presentes.has(v["ficha"]):
			escalafon.append(v)
	# orden estable: a igualdad de clave quedan en el orden en que llegaron (como sorted())
	var indices: Array = range(escalafon.size())
	indices.sort_custom(func(i: int, j: int) -> bool:
		var a: Dictionary = escalafon[i]
		var b: Dictionary = escalafon[j]
		if _antes(a, b):
			return true
		if _antes(b, a):
			return false
		return i < j)
	var ordenado: Array = []
	for i in indices:
		ordenado.append(escalafon[i])
	estado["escalafon"] = ordenado
	estado["caidos"].append_array(caidos)
	return [vivos, caidos, nuevos]


## Anota el resultado de la batalla de la etapa actual. Con la victoria, los veteranos que
## siguen vivos forman el nuevo escalafón y se avanza a la etapa siguiente; con la derrota, la
## batalla se puede repetir con el escalafón de antes. Devuelve un resumen para mostrar.
static func aplicar_batalla(cat, campana: Campana, estado: Dictionary, propio: Variant, rival: Variant,
		victoria: bool, minutos := 0.0) -> Dictionary:
	var etapa: Etapa = campana.etapas[int(estado["etapa"])]
	var resumen := {"etapa": etapa.indice, "nombre": etapa.nombre, "victoria": victoria, "honores": 0,
			"supervivientes": 0, "caidos": 0, "nuevos": 0, "minutos": ("%.1f" % minutos).to_float()}
	if not victoria:
		estado["historial"].append(resumen)
		return resumen
	var r := actualizar_escalafon(cat, estado, propio, etapa.nombre)
	var vivos: Array = r[0]
	var honores := campana.honor_victoria + campana.honores_de(vivos)
	estado["honores"] = int(estado["honores"]) + honores
	if rival is Dictionary:
		# la IA conserva a los suyos que sobrevivieron (también los que se retiraron del campo)
		var conservados: Array = []
		for v in fichas_limpias(cat, rival.get("veteranos", [])):
			if int(v["grado"]) >= 1:
				conservados.append(v)
		if not estado.get("rival") is Dictionary:
			estado["rival"] = {}
		estado["rival"][etapa.rival(str(estado["faccion"]))] = conservados
	resumen["honores"] = honores
	resumen["supervivientes"] = vivos.size()
	resumen["caidos"] = r[1].size()
	resumen["nuevos"] = r[2]
	estado["historial"].append(resumen)
	estado["etapa"] = int(estado["etapa"]) + 1
	if int(estado["etapa"]) >= campana.etapas.size():
		estado["terminada"] = true
		estado["medalla"] = campana.medalla(int(estado["honores"]))
	return resumen
