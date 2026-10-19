// Modelos de tropas, obras y decorados: colores en los vértices (sRGB), sombreado plano de
// maqueta y la niebla de guerra (lo recordado bajo la niebla se ve en penumbra).
shader_type spatial;
render_mode diffuse_lambert, specular_schlick_ggx;

uniform vec2 tam_mapa = vec2(64.0, 64.0);
uniform sampler2D niebla : filter_linear, repeat_disable;
uniform float brillo = 1.0;

varying vec3 pos_mundo;

vec3 a_lineal(vec3 c) {
	return mix(pow((c + vec3(0.055)) / 1.055, vec3(2.4)), c / 12.92, step(c, vec3(0.04045)));
}

void vertex() {
	pos_mundo = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

void fragment() {
	float f = texture(niebla, pos_mundo.xz / tam_mapa).r;
	float luz = mix(0.0, 0.42, smoothstep(0.0, 0.43, f)) + mix(0.0, 0.58, smoothstep(0.43, 0.98, f));
	vec3 oscuro = vec3(0.07, 0.06, 0.055);
	ALBEDO = mix(a_lineal(oscuro), a_lineal(COLOR.rgb) * brillo, luz);
	ROUGHNESS = 0.85;
	SPECULAR = 0.25;
}
