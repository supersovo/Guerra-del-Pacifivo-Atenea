## Arma la figura de prueba de arte/ (pruebas/arte/figura_prueba.glb y su .json): un muñeco
## con esqueleto, piel y cuatro animaciones, exportado a glTF como lo haría una herramienta de
## modelado. Las pruebas lo cargan como si fuera un modelo hecho fuera del juego.
##
##   godot --headless --path godot -s res://pruebas/hacer_figura_prueba.gd
##
## Mira hacia +Z (como un glTF), mide 1,8 de alto y trae «Idle», «Walk», «Saludo» y «Death»
## («Saludo» no es un nombre usual: el .json lo da como la acción).
extends SceneTree

const SALIDA := "res://pruebas/arte/figura_prueba"
# hueso: [padre, posición respecto del padre]
const HUESOS := {
	"raiz": [-1, Vector3.ZERO],
	"cadera": [0, Vector3(0, 0.9, 0)],
	"torso": [1, Vector3(0, 0.1, 0)],
	"cabeza": [2, Vector3(0, 0.55, 0)],
	"brazo_i": [2, Vector3(-0.26, 0.5, 0)],
	"brazo_d": [2, Vector3(0.26, 0.5, 0)],
	"pierna_i": [1, Vector3(-0.1, 0, 0)],
	"pierna_d": [1, Vector3(0.1, 0, 0)],
}
# pieza: [hueso, centro (en el espacio del modelo), tamaño, color]
const PIEZAS := [
	["pierna_i", Vector3(-0.1, 0.45, 0), Vector3(0.14, 0.9, 0.16), Color8(60, 60, 70)],
	["pierna_d", Vector3(0.1, 0.45, 0), Vector3(0.14, 0.9, 0.16), Color8(60, 60, 70)],
	["torso", Vector3(0, 1.28, 0), Vector3(0.44, 0.62, 0.24), Color8(34, 44, 98)],
	["cabeza", Vector3(0, 1.66, 0), Vector3(0.2, 0.24, 0.22), Color8(224, 180, 150)],
	["brazo_i", Vector3(-0.3, 1.32, 0), Vector3(0.1, 0.5, 0.1), Color8(34, 44, 98)],
	["brazo_d", Vector3(0.3, 1.32, 0), Vector3(0.1, 0.5, 0.1), Color8(34, 44, 98)],
	# la cantimplora adelante: marca el frente (+Z)
	["torso", Vector3(0, 1.2, 0.2), Vector3(0.16, 0.16, 0.16), Color8(150, 110, 60)],
]


func _initialize() -> void:
	var raiz := Node3D.new()
	raiz.name = "FiguraPrueba"
	var esqueleto := Skeleton3D.new()
	esqueleto.name = "Skeleton3D"
	raiz.add_child(esqueleto)
	for nombre in HUESOS:
		var h: Array = HUESOS[nombre]
		var i := esqueleto.add_bone(nombre)
		esqueleto.set_bone_parent(i, int(h[0]))
		esqueleto.set_bone_rest(i, Transform3D(Basis(), h[1]))
	esqueleto.reset_bone_poses()
	var malla := MeshInstance3D.new()
	malla.name = "Cuerpo"
	malla.mesh = _malla(esqueleto)
	esqueleto.add_child(malla)
	malla.skeleton = NodePath("..")
	malla.skin = esqueleto.create_skin_from_rest_transforms()
	var rep := AnimationPlayer.new()
	rep.name = "AnimationPlayer"
	raiz.add_child(rep)
	var biblioteca := AnimationLibrary.new()
	biblioteca.add_animation("Idle", _animacion({"torso": [[0.0, 0.0], [0.8, 4.0], [1.6, 0.0]]}, 1.6))
	biblioteca.add_animation("Walk", _animacion({
		"pierna_i": [[0.0, 30.0], [0.4, -30.0], [0.8, 30.0]], "pierna_d": [[0.0, -30.0], [0.4, 30.0], [0.8, -30.0]],
		"brazo_i": [[0.0, -20.0], [0.4, 20.0], [0.8, -20.0]], "brazo_d": [[0.0, 20.0], [0.4, -20.0], [0.8, 20.0]]}, 0.8))
	biblioteca.add_animation("Saludo", _animacion({"brazo_d": [[0.0, 0.0], [0.4, -80.0], [1.0, -80.0], [1.4, 0.0]]}, 1.4))
	biblioteca.add_animation("Death", _animacion({"raiz": [[0.0, 0.0], [0.6, -90.0]]}, 0.6))
	rep.add_animation_library("", biblioteca)
	for n in [esqueleto, malla, rep]:
		n.owner = raiz
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(SALIDA.get_base_dir()))
	var doc := GLTFDocument.new()
	var estado := GLTFState.new()
	var err := doc.append_from_scene(raiz, estado)
	if err == OK:
		err = doc.write_to_filesystem(estado, ProjectSettings.globalize_path(SALIDA + ".glb"))
	var conf := FileAccess.open(SALIDA + ".json", FileAccess.WRITE)
	conf.store_string(JSON.stringify({"animaciones": {"accion": "Saludo"}, "marcha": 1.2}, "\t") + "\n")
	conf.close()
	print("Figura de prueba: ", "lista en " + SALIDA + ".glb" if err == OK else "error %d" % err)
	raiz.free()
	quit(0 if err == OK else 1)


func _malla(esqueleto: Skeleton3D) -> ArrayMesh:
	var st := SurfaceTool.new()
	st.set_skin_weight_count(SurfaceTool.SKIN_4_WEIGHTS)
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for p in PIEZAS:
		var hueso := esqueleto.find_bone(p[0])
		var c: Vector3 = p[1]
		var t: Vector3 = p[2] / 2.0
		for cara in [[Vector3.RIGHT, Vector3.UP, Vector3.BACK], [Vector3.LEFT, Vector3.UP, Vector3.FORWARD],
				[Vector3.UP, Vector3.BACK, Vector3.RIGHT], [Vector3.DOWN, Vector3.FORWARD, Vector3.RIGHT],
				[Vector3.BACK, Vector3.UP, Vector3.LEFT], [Vector3.FORWARD, Vector3.UP, Vector3.RIGHT]]:
			var n: Vector3 = cara[0]
			var u: Vector3 = cara[1]
			var v: Vector3 = cara[2]
			var esquinas := [n + u + v, n - u + v, n - u - v, n + u - v]
			for i in [0, 1, 2, 0, 2, 3]:
				st.set_normal(n)
				st.set_color(p[3])
				st.set_bones(PackedInt32Array([hueso, 0, 0, 0]))
				st.set_weights(PackedFloat32Array([1.0, 0.0, 0.0, 0.0]))
				st.add_vertex(c + (esquinas[i] as Vector3) * t)
	var mat := StandardMaterial3D.new()
	mat.vertex_color_use_as_albedo = true
	mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	st.set_material(mat)
	return st.commit()


## Una animación de giros de huesos alrededor de X (o del eje del cuerpo para «raiz»):
## {hueso: [[tiempo, grados], ...]}.
func _animacion(giros: Dictionary, largo: float) -> Animation:
	var a := Animation.new()
	a.length = largo
	for hueso in giros:
		var pista := a.add_track(Animation.TYPE_ROTATION_3D)
		a.track_set_path(pista, NodePath("Skeleton3D:" + hueso))
		for k: Array in giros[hueso]:
			a.rotation_track_insert_key(pista, k[0], Quaternion(Vector3.RIGHT, deg_to_rad(k[1])))
	return a
