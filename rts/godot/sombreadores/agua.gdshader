// Mar del diorama: olas suaves, color de profundidad, reflejos del sol y la niebla de guerra.
shader_type spatial;
render_mode blend_mix, depth_draw_opaque, cull_back, specular_schlick_ggx;

uniform vec4 color_alto : source_color = vec4(0.10, 0.27, 0.38, 1.0);
uniform vec4 color_bajo : source_color = vec4(0.22, 0.47, 0.52, 1.0);
uniform vec2 tam_mapa = vec2(64.0, 64.0);
uniform sampler2D niebla : filter_linear, repeat_disable;
uniform sampler2D niebla_vieja : filter_linear, repeat_disable;
uniform float mezcla_niebla = 1.0;

varying vec3 pos_mundo;

float ola(vec2 p, float t) {
	return sin(p.x * 1.7 + t * 1.2) * 0.5 + sin(p.y * 2.3 - t * 0.9) * 0.35 + sin((p.x + p.y) * 3.1 + t * 1.7) * 0.15;
}

void vertex() {
	pos_mundo = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	VERTEX.y += ola(pos_mundo.xz, TIME) * 0.025;
}

void fragment() {
	vec2 p = pos_mundo.xz;
	float e = 0.05;
	float h0 = ola(p, TIME);
	float hx = ola(p + vec2(e, 0.0), TIME);
	float hz = ola(p + vec2(0.0, e), TIME);
	float h2 = ola(p * 3.7, TIME * 1.6);
	float h2x = ola((p + vec2(e, 0.0)) * 3.7, TIME * 1.6);
	float h2z = ola((p + vec2(0.0, e)) * 3.7, TIME * 1.6);
	vec3 n = normalize(vec3(-(hx - h0) * 0.6 - (h2x - h2) * 0.25, 1.0, -(hz - h0) * 0.6 - (h2z - h2) * 0.25));
	NORMAL = normalize((VIEW_MATRIX * vec4(n, 0.0)).xyz);
	float f = mix(texture(niebla_vieja, p / tam_mapa).r, texture(niebla, p / tam_mapa).r, mezcla_niebla);
	float luz = mix(0.0, 0.42, smoothstep(0.0, 0.43, f)) + mix(0.0, 0.58, smoothstep(0.43, 0.98, f));
	vec3 col = mix(color_bajo.rgb, color_alto.rgb, 0.55 + 0.45 * h2 * 0.5);
	ALBEDO = col * max(luz, 0.04);
	ROUGHNESS = 0.12;
	SPECULAR = 0.55 * luz;
	ALPHA = 0.88;
}
