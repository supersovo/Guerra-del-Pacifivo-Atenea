// Terreno del diorama: el color de cada casilla viene en los vértices (sRGB) y aquí se le
// agrega el grano propio de cada suelo (costra del salar, huellas del camino, piedras de la
// roca) y la niebla de guerra (textura de una casilla por píxel: 255 a la vista, 110
// explorado, 0 desconocido).
shader_type spatial;
render_mode diffuse_lambert, specular_disabled;

uniform vec2 tam_mapa = vec2(64.0, 64.0);
uniform sampler2D niebla : filter_linear, repeat_disable;
uniform sampler2D niebla_vieja : filter_linear, repeat_disable;
uniform float mezcla_niebla = 1.0;

varying vec3 pos_mundo;
varying vec3 normal_mundo;
varying vec2 dato;
varying vec2 pesos;

vec3 a_lineal(vec3 c) {
	return mix(pow((c + vec3(0.055)) / 1.055, vec3(2.4)), c / 12.92, step(c, vec3(0.04045)));
}

float azar(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float ruido(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	return mix(mix(azar(i), azar(i + vec2(1.0, 0.0)), f.x), mix(azar(i + vec2(0.0, 1.0)), azar(i + vec2(1.0, 1.0)), f.x), f.y);
}

float grietas(vec2 p) {
	// red de grietas (celdas de Voronoi): 0 en la grieta, 1 lejos
	vec2 i = floor(p);
	vec2 f = fract(p);
	float d1 = 8.0;
	float d2 = 8.0;
	for (int y = -1; y <= 1; y++) {
		for (int x = -1; x <= 1; x++) {
			vec2 o = vec2(float(x), float(y));
			vec2 c = o + vec2(azar(i + o), azar(i + o + 17.3)) - f;
			float d = dot(c, c);
			if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
		}
	}
	return smoothstep(0.0, 0.05, sqrt(d2) - sqrt(d1));
}

// niebla con los bordes desenfocados, fundida con la anterior mientras cambia
float niebla_en(vec2 p) {
	vec2 uv = p / tam_mapa;
	vec2 px = 0.6 / tam_mapa;
	float nueva = (texture(niebla, uv) * 0.4 + texture(niebla, uv + vec2(px.x, 0.0)) * 0.15 + texture(niebla, uv - vec2(px.x, 0.0)) * 0.15
			+ texture(niebla, uv + vec2(0.0, px.y)) * 0.15 + texture(niebla, uv - vec2(0.0, px.y)) * 0.15).r;
	float vieja = texture(niebla_vieja, uv).r;
	return mix(vieja, nueva, mezcla_niebla);
}

void vertex() {
	pos_mundo = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	normal_mundo = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz);
	dato = UV2;
	pesos = UV;
}

void fragment() {
	vec3 col = COLOR.rgb;
	int codigo = int(dato.x + 0.5);
	vec2 p = pos_mundo.xz;
	float grano = (ruido(p * 2.3) - 0.5) * 0.10 + (ruido(p * 9.0) - 0.5) * 0.07 + (azar(floor(p * 24.0)) - 0.5) * 0.035;
	float vertical = 1.0 - abs(normal_mundo.y);
	// salar (costra blanca partida en placas) y pampa (matas secas), fundidos entre casillas
	float salar = smoothstep(0.2, 0.8, pesos.x);
	float pampa = smoothstep(0.2, 0.8, pesos.y);
	if (salar > 0.001) {
		vec3 costra = col * (0.9 + 0.1 * ruido(p * 0.9)) * vec3(1.0, 0.985, 0.96);
		col = mix(col, mix(costra * 0.93, costra, grietas(p * 1.4)), salar);
	}
	if (pampa > 0.001) {
		col = mix(col, col * vec3(0.88, 0.9, 0.76), smoothstep(0.6, 0.78, ruido(p * 8.5)) * 0.45 * pampa);
	}
	// arena: ondulaciones del viento
	float arena = clamp(1.0 - salar - pampa, 0.0, 1.0);
	col *= 1.0 + 0.04 * arena * sin(p.x * 5.0 + p.y * 2.0 + ruido(p * 1.3) * 6.0);
	if (codigo == 3) {
		// camino: huellas de ruedas y de cascos
		float huella = smoothstep(0.08, 0.0, abs(fract(p.x * 2.0 + p.y * 2.0) - 0.5) - 0.42);
		col *= 1.0 - 0.06 * huella * ruido(p * 4.0);
	} else if (codigo == 5) {
		// roca: vetas
		col *= 0.92 + 0.16 * ruido(vec2(p.x * 3.0 + pos_mundo.y * 4.0, p.y * 3.0));
	}
	col *= 1.0 + grano;
	// paredes de acantilado: estratos
	col *= 1.0 - vertical * (0.10 + 0.08 * sin(pos_mundo.y * 22.0));
	float f = niebla_en(p);
	float luz = mix(0.0, 0.42, smoothstep(0.0, 0.43, f)) + mix(0.0, 0.58, smoothstep(0.43, 0.98, f));
	vec3 lineal = a_lineal(clamp(col * 0.9, 0.0, 1.0));
	// lo explorado que no se ve, en sepia (como un mapa viejo); lo desconocido, en sombra
	float gris = dot(lineal, vec3(0.3, 0.59, 0.11));
	lineal = mix(vec3(gris) * vec3(1.06, 0.97, 0.84), lineal, smoothstep(0.45, 0.9, f));
	vec3 oscuro = a_lineal(vec3(0.07, 0.06, 0.055));
	ALBEDO = mix(oscuro, lineal, luz);
	ROUGHNESS = 0.96;
}
