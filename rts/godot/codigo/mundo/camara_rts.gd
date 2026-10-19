## Cámara de mando: mira el diorama desde el sur, se desliza sobre el mapa, se acerca con la
## rueda (más cerca, más rasante) y gira alrededor del punto que mira.
extends Node3D

const DIST_MIN := 7.0
const DIST_MAX := 58.0

var cam := Camera3D.new()
var objetivo := Vector3.ZERO      # punto del suelo que se mira
var distancia := 24.0
var giro := 0.0                   # radianes; 0 = desde el sur
var ancho := 64.0
var alto := 64.0
var ter
var _dist := 24.0
var _obj := Vector3.ZERO
var _giro := 0.0


func _ready() -> void:
	name = "Camara"
	cam.fov = 38.0
	cam.near = 0.2
	cam.far = 900.0
	add_child(cam)
	cam.current = true
	_dist = distancia
	_obj = objetivo
	_giro = giro
	_colocar()


func configurar(terreno, w: float, h: float) -> void:
	ter = terreno
	ancho = w
	alto = h


## Centra la vista en p. El panel de abajo tapa la parte baja de la pantalla: el punto se
## deja un poco más arriba del centro, en el medio de lo que queda a la vista.
func centrar(p: Vector3, inmediato := false) -> void:
	var adelante := Vector3(-sin(giro), 0, -cos(giro))
	objetivo = Vector3(p.x, 0, p.z) - adelante * distancia * 0.09
	_limitar()
	if inmediato:
		_obj = objetivo


## Desliza la cámara en los ejes de la pantalla (derecha, arriba), en unidades del mundo.
func mover(derecha: float, arriba: float) -> void:
	var adelante := Vector3(-sin(giro), 0, -cos(giro))
	var lado := Vector3(cos(giro), 0, -sin(giro))
	objetivo += lado * derecha + adelante * arriba
	_limitar()


func acercar(factor: float) -> void:
	distancia = clampf(distancia / factor, DIST_MIN, DIST_MAX)


func girar(angulo: float) -> void:
	giro = wrapf(giro + angulo, -PI, PI)


func _limitar() -> void:
	objetivo.x = clampf(objetivo.x, 0.0, ancho)
	objetivo.z = clampf(objetivo.z, 0.0, alto)


func _process(delta: float) -> void:
	var k := 1.0 - exp(-12.0 * delta)
	_dist = lerpf(_dist, distancia, k)
	_obj = _obj.lerp(objetivo, k)
	_giro = lerp_angle(_giro, giro, k)
	_colocar()


func _colocar() -> void:
	# más cerca, más rasante (como quien se inclina sobre la mesa)
	var t := inverse_lerp(DIST_MIN, DIST_MAX, _dist)
	var incl := deg_to_rad(lerpf(40.0, 62.0, t))
	var dir := Vector3(sin(_giro) * cos(incl), sin(incl), cos(_giro) * cos(incl))
	var suelo := 0.0
	if ter != null:
		suelo = maxf(ter.altura_en(_obj.x, _obj.z), 0.0)
	var mira := Vector3(_obj.x, suelo, _obj.z)
	cam.look_at_from_position(mira + dir * _dist, mira, Vector3.UP)


## Punto del suelo bajo una posición de la pantalla, o null.
func rayo(pos: Vector2) -> Variant:
	if ter == null:
		return null
	return ter.interseccion(cam.project_ray_origin(pos), cam.project_ray_normal(pos))


## Posición en la pantalla de un punto del mundo (null si queda detrás de la cámara).
func a_pantalla(p: Vector3) -> Variant:
	if cam.is_position_behind(p):
		return null
	return cam.unproject_position(p)


## Velocidad del deslizamiento: más lejos, más rápido.
func paso() -> float:
	return _dist * 1.1
