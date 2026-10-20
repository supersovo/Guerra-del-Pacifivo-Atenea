## Portada y menú principal (salitre/cliente/escenas/portada.py).
extends "res://codigo/ui/pantallas/pantalla.gd"

const OPCIONES := [
	["Campaña del Salitre", "campana", "principal",
		"Cuatro batallas encadenadas, de Dolores al Morro de Arica: sus veteranos pasan de una a otra."],
	["Escaramuza contra la IA", "escaramuza", "principal",
		"Batalla en un mapa histórico contra uno o más ejércitos de la computadora."],
	["Multijugador en línea", "conectar", "principal",
		"Juegue con sus compañeros: en la red local, por Internet o creando un servidor en su equipo."],
	["Repeticiones", "repeticiones", "normal", "Vuelva a ver sus batallas con todo el mapa a la vista."],
	["Archivo histórico", "archivo", "normal", "Naciones, héroes, unidades y batallas de la Guerra del Pacífico."],
	["Opciones", "opciones", "normal", "Pantalla, sonido y controles."],
	["Salir", "", "madera", ""],
]

var botones := {}


func armar() -> void:
	Juego.cerrar_red()
	Juego.servidor.detener()
	var ancho := 360.0
	var x := (W - ancho) / 2.0
	var y := 170.0
	var alto := OPCIONES.size() * 54.0 + 40.0
	panel(Rect2(x - 30, y - 24, ancho + 60, alto), "madera")
	for i in OPCIONES.size():
		var op: Array = OPCIONES[i]
		var destino: String = op[1]
		var accion := (func() -> void: Juego.salir(0)) if destino == "" else (func() -> void: menu.abrir(destino))
		var b := boton(Rect2(x, y + i * 54, ancho, 44), op[0], accion, op[2], op[3], 19)
		b.ayuda_titulo = op[0]
		botones[destino if destino != "" else "salir"] = b
	var r: Dictionary = Juego.perfil.resumen()
	if r["jugadas"]:
		texto(Vector2(W / 2.0, y - 24 + alto + 10), "Escaramuzas en este equipo: %d  ·  victorias %d  ·  derrotas %d" %
				[r["jugadas"], r["victorias"], r["derrotas"]], "cuerpo", 16, Tema.CREMA, "centro", null, true)


func escape() -> void:
	Juego.salir(0)
