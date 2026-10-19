## Luz, cielo y mesa del diorama: el sol de la pampa, la bruma de la costa y la mesa de
## guerra de madera sobre la que descansa el mapa.
extends RefCounted

const Terreno = preload("res://codigo/mundo/terreno.gd")


## Nodo con el entorno, el sol y la mesa para un mapa de w x h casillas.
static func crear(ambiente: String, w: int, h: int) -> Node3D:
	var raiz := Node3D.new()
	raiz.name = "Ambiente"
	var costa := ambiente == "costa"

	var cielo := ProceduralSkyMaterial.new()
	cielo.sky_top_color = Color8(92, 140, 196) if not costa else Color8(120, 150, 180)
	cielo.sky_horizon_color = Color8(236, 214, 178) if not costa else Color8(214, 214, 206)
	cielo.ground_horizon_color = Color8(120, 96, 72)
	cielo.ground_bottom_color = Color8(44, 32, 24)
	cielo.sun_angle_max = 20.0
	var sky := Sky.new()
	sky.sky_material = cielo

	var env := Environment.new()
	env.background_mode = Environment.BG_SKY
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.ambient_light_energy = 0.5
	env.reflected_light_source = Environment.REFLECTION_SOURCE_SKY
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.tonemap_exposure = 0.95
	env.ssao_enabled = true
	env.ssao_radius = 0.8
	env.ssao_intensity = 1.6
	env.glow_enabled = true
	env.glow_intensity = 0.25
	env.glow_bloom = 0.04
	env.adjustment_enabled = true
	env.adjustment_saturation = 0.94 if not costa else 0.9
	env.adjustment_contrast = 1.04
	if costa:
		env.fog_enabled = true
		env.fog_light_color = Color8(214, 214, 206)
		env.fog_density = 0.004
	var we := WorldEnvironment.new()
	we.environment = env
	raiz.add_child(we)

	# sol bajo del poniente (de la tarde): sombras largas que marcan el relieve
	var sol := DirectionalLight3D.new()
	sol.name = "Sol"
	sol.light_color = Color8(255, 240, 214) if not costa else Color8(246, 242, 232)
	sol.light_energy = 1.0
	sol.shadow_enabled = true
	sol.shadow_blur = 1.2
	sol.directional_shadow_max_distance = 60.0
	sol.directional_shadow_mode = DirectionalLight3D.SHADOW_PARALLEL_2_SPLITS
	sol.rotation_degrees = Vector3(-48, -35, 0)
	raiz.add_child(sol)

	# la mesa de guerra
	var mesa := MeshInstance3D.new()
	mesa.name = "Mesa"
	var plano := PlaneMesh.new()
	plano.size = Vector2(w + 400, h + 400)
	mesa.mesh = plano
	mesa.position = Vector3(w / 2.0, Terreno.BASE - 0.01, h / 2.0)
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color8(52, 34, 22)
	mat.roughness = 0.55
	mesa.material_override = mat
	mesa.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	raiz.add_child(mesa)
	# el marco de madera del diorama
	var marco := MeshInstance3D.new()
	marco.name = "Marco"
	var k := preload("res://codigo/mundo/modelos.gd").Constructor.new()
	var madera := Color8(92, 62, 40)
	var g := 0.5
	var y := Terreno.BASE + 0.25
	k.caja(Vector3(w / 2.0, y, -g / 2), Vector3(w + 2 * g, 0.5, g), madera)
	k.caja(Vector3(w / 2.0, y, h + g / 2), Vector3(w + 2 * g, 0.5, g), madera)
	k.caja(Vector3(-g / 2, y, h / 2.0), Vector3(g, 0.5, h), madera)
	k.caja(Vector3(w + g / 2, y, h / 2.0), Vector3(g, 0.5, h), madera)
	var arr := []
	arr.resize(Mesh.ARRAY_MAX)
	arr[Mesh.ARRAY_VERTEX] = k.v
	arr[Mesh.ARRAY_NORMAL] = k.n
	arr[Mesh.ARRAY_COLOR] = k.c
	var malla := ArrayMesh.new()
	malla.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	var mat_marco := StandardMaterial3D.new()
	mat_marco.vertex_color_use_as_albedo = true
	mat_marco.vertex_color_is_srgb = true
	mat_marco.roughness = 0.5
	malla.surface_set_material(0, mat_marco)
	marco.mesh = malla
	raiz.add_child(marco)
	return raiz
