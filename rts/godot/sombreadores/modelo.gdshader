// Modelos de tropas, obras y decorados: colores en los vértices (sRGB), caras planas de
// maqueta, partes animadas y la niebla de guerra (lo recordado se ve en penumbra).
//
// Cada vértice trae en CUSTOM0 su parte (0 = fija) y el pivote sobre el que gira. Las
// figuras agrupadas en MultiMesh traen en INSTANCE_CUSTOM: x = fase de la marcha (rad),
// y = paso (0 quieta, 1 en marcha), z = acción (fusil apuntado, tajo, retroceso de la
// pieza, faena: 0 a 1), w = resaltada bajo el ratón. Las banderas y las aspas del
// molino se mueven con el tiempo, aunque la malla no esté agrupada.
shader_type spatial;
render_mode diffuse_lambert, specular_schlick_ggx;

uniform vec2 tam_mapa = vec2(64.0, 64.0);
uniform sampler2D niebla : filter_linear, repeat_disable;
uniform sampler2D niebla_vieja : filter_linear, repeat_disable;
uniform float mezcla_niebla = 1.0;
instance uniform float resalte = 0.0;

varying vec3 pos_mundo;
varying float resaltado;

const int P_PIERNA_I = 1;
const int P_PIERNA_D = 2;
const int P_BRAZO_ARMA = 3;
const int P_PATA_DI = 4;
const int P_PATA_DD = 5;
const int P_PATA_TI = 6;
const int P_PATA_TD = 7;
const int P_RUEDA = 8;
const int P_CANON = 9;
const int P_BANDERA = 10;
const int P_ASPAS = 11;
const int P_BRAZO_I = 12;
const int P_SABLE = 13;

vec3 a_lineal(vec3 c) {
	return mix(pow((c + vec3(0.055)) / 1.055, vec3(2.4)), c / 12.92, step(c, vec3(0.04045)));
}

// giro en torno al eje z (el eje de los costados de la figura, que mira hacia +x)
mat3 giro_z(float a) {
	float c = cos(a);
	float s = sin(a);
	return mat3(vec3(c, s, 0.0), vec3(-s, c, 0.0), vec3(0.0, 0.0, 1.0));
}

float niebla_en(vec2 p) {
	vec2 uv = p / tam_mapa;
	vec2 px = 0.6 / tam_mapa;
	float nueva = (texture(niebla, uv) * 0.4 + texture(niebla, uv + vec2(px.x, 0.0)) * 0.15 + texture(niebla, uv - vec2(px.x, 0.0)) * 0.15
			+ texture(niebla, uv + vec2(0.0, px.y)) * 0.15 + texture(niebla, uv - vec2(0.0, px.y)) * 0.15).r;
	float vieja = texture(niebla_vieja, uv).r;
	return mix(vieja, nueva, mezcla_niebla);
}

void vertex() {
	int parte = int(CUSTOM0.x + 0.5);
	vec4 dato = INSTANCE_CUSTOM;
	float fase = dato.x;
	float paso = dato.y;
	float accion = dato.z;
	if (parte > 0) {
		vec3 piv = CUSTOM0.yzw;
		vec3 d = VERTEX - piv;
		float a = 0.0;
		if (parte == P_PIERNA_I) {
			a = sin(fase) * 0.55 * paso;
		} else if (parte == P_PIERNA_D) {
			a = -sin(fase) * 0.55 * paso;
		} else if (parte == P_BRAZO_ARMA) {
			// al hombro al marchar; apuntado (o la herramienta en la faena) al actuar
			a = sin(fase) * 0.12 * paso - 1.2 * accion;
		} else if (parte == P_BRAZO_I) {
			a = -sin(fase) * 0.35 * paso;
		} else if (parte == P_SABLE) {
			a = -1.5 * accion;
		} else if (parte == P_PATA_DI) {
			a = sin(fase) * 0.6 * paso;
		} else if (parte == P_PATA_DD) {
			a = sin(fase + 0.7) * 0.6 * paso;
		} else if (parte == P_PATA_TI) {
			a = sin(fase + 3.14159) * 0.55 * paso;
		} else if (parte == P_PATA_TD) {
			a = sin(fase + 3.84) * 0.55 * paso;
		} else if (parte == P_RUEDA) {
			a = -fase * 0.3;
		} else if (parte == P_CANON) {
			d.x -= accion * 0.08;
		} else if (parte == P_ASPAS) {
			a = TIME * 2.2;
		} else if (parte == P_BANDERA) {
			float onda = sin(TIME * 5.0 + d.x * 9.0 + piv.x * 3.1 + piv.z * 1.7);
			d.z += onda * 0.035 * clamp(d.x / 0.38, 0.0, 1.0);
			d.y += onda * 0.01 * clamp(d.x / 0.38, 0.0, 1.0);
		}
		if (a != 0.0) {
			mat3 g = giro_z(a);
			d = g * d;
			NORMAL = g * NORMAL;
		}
		VERTEX = piv + d;
	}
	pos_mundo = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	resaltado = max(dato.w, resalte);
}

void fragment() {
	float f = niebla_en(pos_mundo.xz);
	float luz = mix(0.0, 0.42, smoothstep(0.0, 0.43, f)) + mix(0.0, 0.58, smoothstep(0.43, 0.98, f));
	vec3 col = a_lineal(COLOR.rgb);
	// lo recordado bajo la niebla pierde el color, como un recuerdo
	float gris = dot(col, vec3(0.3, 0.59, 0.11));
	col = mix(vec3(gris) * vec3(1.05, 0.98, 0.88), col, smoothstep(0.45, 0.9, f));
	vec3 oscuro = vec3(0.004, 0.0035, 0.003);
	ALBEDO = mix(oscuro, col * (1.0 + 0.35 * resaltado), luz);
	EMISSION = col * 0.18 * resaltado;
	ROUGHNESS = 0.85;
	SPECULAR = 0.25;
}
