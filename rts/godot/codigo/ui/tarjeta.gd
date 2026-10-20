## Tarjeta de órdenes: qué botones ofrece la selección actual (como el cliente de Python,
## salitre/cliente/juego/tarjeta.py).
##
## Unidades: mover, detener, atacar, mantener, patrullar y sus habilidades; infantería de
## fusil: el menú de formaciones; trabajadores: recolectar, regresar, reparar y los dos
## menús de construcción; ambulancia: montar el hospital de sangre donde se elija (como una
## obra); edificios: lo que forman, lo que investigan y el punto de reunión.
##
## Cada botón es un diccionario: clave, texto, atajo, accion (orden, objetivo, menu,
## construir, entrenar, investigar), dato, activo, costo, descripcion, falta, enfriando y
## marcado.
extends RefCounted

const COLUMNAS := 4
const FILAS := 3


static func boton(clave: String, texto: String, atajo: Variant, accion: String, dato: Variant = null, activo := true,
		costo: Variant = null, descripcion := "", falta := "") -> Dictionary:
	return {"clave": clave, "texto": texto, "atajo": str(atajo if atajo != null else "").to_upper(), "accion": accion,
			"dato": dato, "activo": activo, "costo": costo, "descripcion": descripcion, "falta": falta,
			"enfriando": 0, "marcado": false}


static func _poner(slots: Array, i: int, b: Dictionary) -> void:
	while i < slots.size() and slots[i] != null:
		i += 1
	if i < slots.size():
		slots[i] = b


static func _ex(e) -> Dictionary:
	return e.ex if typeof(e.ex) == TYPE_DICTIONARY else {}


static func _formaciones(cat, unidades: Array, slots: Array) -> Array:
	var vigentes := {}
	for e in unidades:
		if e.tipo["forma_filas"]:
			vigentes[int(_ex(e).get("fo", 0))] = true
	var actual: Variant = vigentes.keys()[0] if vigentes.size() == 1 else null
	var k := 0
	for f in cat.formaciones:
		var b := boton("formacion_" + f["id"], f["nombre"], f["atajo"], "orden", {"c": "formacion", "f": f["id"]}, true,
				null, f["descripcion"])
		b["marcado"] = actual != null and int(actual) == int(f["codigo"])
		slots[k] = b
		k += 1
	var ninguna := boton("formacion_ninguna", "Sin formación", "N", "orden", {"c": "formacion", "f": "ninguna"}, true,
			null, "Rompan filas: la tropa marcha y combate sin formar, como siempre.")
	ninguna["marcado"] = actual != null and int(actual) == 0
	slots[k] = ninguna
	slots[slots.size() - 1] = boton("volver", "Volver", "ESC", "menu", null)
	return slots


## Los doce lugares de la tarjeta (null donde no hay botón).
static func tarjeta(est, seleccion: Array, submenu: Variant = null) -> Array:
	var cat = est.cat
	var slots: Array = []
	slots.resize(COLUMNAS * FILAS)
	var propios: Array = []
	for i in seleccion:
		var e = est.ents.get(i)
		if e != null and est.propio(e) and not e.fantasma:
			propios.append(e)
	if propios.is_empty():
		return slots
	var fac_id: String = est.faccion(est.yo)
	var fac: Dictionary = cat.facciones[fac_id]
	var terminados := {}
	for e in est.ents.values():
		if e.dueno == est.yo and e.es_edificio() and not e.fantasma and not (e.fl & cat.bandera("OBRA")):
			terminados[e.tipo["id"]] = int(terminados.get(e.tipo["id"], 0)) + 1
	var faltan := func(reqs: Array) -> String:
		var out: Array = []
		for r in reqs:
			if not terminados.get(r, 0):
				out.append(cat.nombre(fac_id, r))
		return ", ".join(out)

	var unidades: Array = []
	var alguna_unidad := false
	for e in propios:
		if e.es_unidad():
			alguna_unidad = true
			if not e.tipo["autonomo"]:
				unidades.append(e)
	if unidades.is_empty() and alguna_unidad:
		return slots        # los camilleros actúan solos: no hay órdenes que darles
	if not unidades.is_empty():
		return _de_unidades(est, cat, fac_id, fac, unidades, slots, submenu, faltan, terminados)
	return _de_edificios(est, cat, fac_id, fac, propios, slots, faltan, terminados)


static func _de_unidades(est, cat, fac_id: String, fac: Dictionary, unidades: Array, slots: Array, submenu: Variant,
		faltan: Callable, terminados: Dictionary) -> Array:
	# menú de construcción de los trabajadores (o de los zapadores)
	if submenu in ["basico", "avanzado", "campana"]:
		var hay_trabajador := false
		var permitidos := {}
		for e in unidades:
			if e.tipo["trabajador"]:
				hay_trabajador = true
			for b in e.tipo.get("construye", []):
				permitidos[b] = true
		var k := 0
		for bid in fac["edificios"]:
			var bt: Dictionary = cat.tipos_por_id[bid]
			if not hay_trabajador:
				if not permitidos.has(bid):
					continue
			elif bt["menu"] != submenu:
				continue
			var falta: String = faltan.call(bt["requisitos"])
			slots[k] = boton("b:" + bid, cat.nombre(fac_id, bid), bt["atajo"], "construir", bid, falta == "",
					cat.costo(fac_id, bid), bt["descripcion"], falta)
			k += 1
			if k >= slots.size() - 1:
				break
		slots[slots.size() - 1] = boton("volver", "Volver", "ESC", "menu", null)
		return slots
	if submenu == "formacion":
		return _formaciones(cat, unidades, slots)
	var tipos := {}
	for e in unidades:
		tipos[e.tipo["id"]] = e.tipo
	var con_arma := false
	var trabajadores := false
	var filas := false
	var biologica_tierra := false
	for t in tipos.values():
		if t["arma"] != null:
			con_arma = true
		if t["trabajador"]:
			trabajadores = true
		if t["forma_filas"]:
			filas = true
		if t["biologica"] and int(t["capa"]) == 0:
			biologica_tierra = true
	slots[0] = boton("mover", "Mover", "M", "objetivo", "mover", true, null,
			"Marchar hasta el punto elegido sin detenerse a combatir.")
	slots[1] = boton("detener", "Detener", "S", "orden", {"c": "detener"}, true, null, "Cancela las órdenes.")
	if con_arma:
		slots[2] = boton("atacar", "Atacar", "A", "objetivo", "atacar", true, null,
				"Avanzar combatiendo a todo enemigo que aparezca, o atacar un blanco.")
		slots[4] = boton("patrullar", "Patrullar", "P", "objetivo", "patrullar", true, null,
				"Ir y volver entre dos puntos combatiendo.")
	slots[3] = boton("mantener", "Mantener posición", "H", "orden", {"c": "mantener"}, true, null,
			"No moverse: disparar solo a lo que esté a su alcance.")
	if trabajadores:
		slots[5] = boton("recolectar", "Recolectar", "G", "objetivo", "recolectar", true, null,
				"Extraer salitre (el Cuartel General lo compra a 1 $ por unidad) o acarrear agua desde un molino.")
		slots[6] = boton("regresar", "Entregar carga", "D", "orden", {"c": "regresar"}, true, null,
				"Llevar lo que carga al Cuartel General.")
		slots[7] = boton("reparar", "Reparar", "R", "objetivo", "reparar", true, null,
				"Reparar edificios, cañones y buques (cuesta un 25 % del precio).")
		slots[8] = boton("menu_basico", "Construir", "B", "menu", "basico", true, null,
				"Edificios básicos: cuartel, depósito, molino, barracas, maestranza...")
		slots[9] = boton("menu_avanzado", "Construcción avanzada", "V", "menu", "avanzado", true, null,
				"Barracón, caballeriza, telégrafos, parque, Estado Mayor, muelle.")
	if not cat.formaciones.is_empty() and filas:
		var formacion := boton("menu_formacion", "Formación", "F", "menu", "formacion", true, null,
				"Línea, guerrilla o cuadro: cómo forma la infantería de fusil para marchar y combatir.")
		if trabajadores:
			_poner(slots, 10, formacion)     # junto a los trabajadores, el lugar 6 es «Entregar carga»
		else:
			slots[6] = formacion
	if not trabajadores and biologica_tierra:
		var hospital := false
		for hid in cat.datos["hospitales"]:
			if terminados.get(hid, 0):
				hospital = true
		slots[7] = boton("replegar", "Replegar heridos", "J", "orden", {"c": "replegar"}, hospital, null,
				"Los que tengan menos de la mitad de la vida vuelven a curarse junto al hospital de campaña: "
				+ "un veterano salvado conserva su grado.", "" if hospital else cat.nombre(fac_id, "hospital_campana"))
	# habilidades (las de todos los tipos elegidos, sin repetir)
	var vistas: Array = []
	for e in unidades:
		for hid in e.tipo["habilidades"]:
			if not hid in vistas:
				vistas.append(hid)
	var k := 8 if not trabajadores else 10
	for hid in vistas:
		var hab: Dictionary = cat.datos["habilidades"][hid]
		var tipo_h: String = hab["tipo"]
		if tipo_h == "orden_reparar" or (trabajadores and tipo_h == "menu_construir"):
			continue
		var b: Dictionary
		if tipo_h == "menu_construir":
			b = boton("menu_campana", hab["nombre"], hab["atajo"] if hab["atajo"] else "B", "menu", "campana", true, null,
					hab["descripcion"])
		elif tipo_h == "descargar":
			b = boton("descargar", hab["nombre"], hab["atajo"], "objetivo", "descargar", true, null, hab["descripcion"])
		elif tipo_h == "emplazar":
			b = boton("emplazar", hab["nombre"], hab["atajo"], "orden", {"c": "emplazar"}, true, null, hab["descripcion"])
		elif tipo_h == "montar":
			# se elige el lugar como el de una obra: la ambulancia va y levanta las carpas
			b = boton("b:" + str(hab["edificio"]), hab["nombre"], hab["atajo"], "construir", hab["edificio"], true, null,
					hab["descripcion"])
		else:
			var accion := "orden" if hab["objetivo"] == "ninguno" else "objetivo"
			var dato: Variant = {"c": "habilidad", "h": hid} if accion == "orden" else "hab:" + hid
			var cd := 0
			for e in unidades:
				if hid in e.tipo["habilidades"]:
					cd = maxi(cd, int(_ex(e).get("cd", {}).get(hid, 0)))
			var desc: String = hab["descripcion"]
			if int(hab["energia"]):
				desc += " Energía: %d." % int(hab["energia"])
			if float(hab["enfriamiento"]):
				desc += " Recarga: %d s." % int(hab["enfriamiento"])
			b = boton("hab:" + hid, hab["nombre"], hab["atajo"], accion, dato, true, null, desc)
			b["enfriando"] = cd
		_poner(slots, k, b)
	return slots


static func _de_edificios(est, cat, fac_id: String, fac: Dictionary, propios: Array, slots: Array, faltan: Callable,
		terminados: Dictionary) -> Array:
	var edif: Array = []
	for e in propios:
		if e.es_edificio():
			edif.append(e)
	if edif.is_empty():
		return slots
	var tipo: Dictionary = edif[0].tipo
	var mismos: Array = []
	for e in edif:
		if e.tipo["id"] == tipo["id"]:
			mismos.append(e)
	for e in mismos:
		if e.fl & cat.bandera("OBRA"):
			slots[slots.size() - 1] = boton("cancelar_obra", "Cancelar obra", "ESC", "orden", {"c": "cancelar_obra"}, true,
					null, "Se devuelve el 75 % del costo.")
			return slots
	var k := 0
	for uid in tipo["produce"]:
		if not uid in fac["unidades"]:
			continue
		var ut: Dictionary = cat.tipos_por_id[uid]
		var falta: String = faltan.call(ut["requisitos"])
		if ut["heroe"] and uid in est.heroes:
			falta = "ya está en campaña"
		var desc: String = ut["descripcion"] + "  Población: %d." % int(ut["poblacion"])
		slots[k] = boton("u:" + uid, cat.nombre(fac_id, uid), ut["atajo"], "entrenar", uid, falta == "",
				cat.costo(fac_id, uid), desc, falta)
		k += 1
		if k >= 11:
			break
	for mid in tipo["investiga"]:
		var m: Dictionary = cat.mejoras_por_id[mid]
		if mid in est.mejoras:
			continue
		if m["previa"] and not m["previa"] in est.mejoras:
			continue
		var falta: String = faltan.call(m["requisitos"])
		if mid in est.investigando:
			falta = "en curso"
		_poner(slots, k, boton("m:" + mid, m["nombre"], m["atajo"], "investigar", mid, falta == "", m["costo"],
				m["descripcion"], falta))
		k += 1
	for hid in tipo["habilidades"]:
		var hab: Dictionary = cat.datos["habilidades"][hid]
		var con_objetivo: bool = hab["objetivo"] != "ninguno"
		var desc: String = hab["descripcion"]
		if int(hab["energia"]):
			desc += " Energía: %d." % int(hab["energia"])
		var b := boton("hab:" + hid, hab["nombre"], hab["atajo"], "objetivo" if con_objetivo else "orden",
				("hab:" + hid) if con_objetivo else {"c": "habilidad", "h": hid}, true, null, desc)
		if hab["tipo"] == "desmontar":
			var todos := true
			for e in mismos:
				if not (e.fl & cat.bandera("DESMONTA")):
					todos = false
			if todos:
				b["activo"] = false
				b["falta"] = "en curso"
		_poner(slots, 8, b)
	if int(tipo["guarnicion"]):
		var texto := "Desalojar"
		var desc := "Los tiradores de la azotea y de las ventanas bajan y salen del edificio."
		if tipo["guarnicion_vista"] == "trinchera":
			texto = "Salir de la trinchera"
			desc = "La tropa sale de la trinchera."
		_poner(slots, 8, boton("vaciar", texto, "D", "orden", {"c": "descargar"}, true, null,
				desc + " Para guarnecer: seleccione infantería y haga clic derecho sobre el edificio."))
	if not tipo["produce"].is_empty():
		slots[slots.size() - 2] = boton("reunion", "Punto de reunión", "Y", "objetivo", "reunion", true, null,
				"Adónde marchan las tropas recién formadas (sobre un yacimiento: a trabajar).")
	for e in mismos:
		if not _ex(e).get("q", []).is_empty():
			slots[slots.size() - 1] = boton("cancelar", "Cancelar", "ESC", "orden", {"c": "cancelar", "i": -1}, true, null,
					"Cancela lo último de la cola y devuelve los recursos.")
			break
	return slots
