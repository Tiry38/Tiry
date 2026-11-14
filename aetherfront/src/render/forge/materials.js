// Aether-Forge – Über-Material: ein Shader für alle geschmiedeten Figuren (Helden: MeshPhysicalMaterial mit Glanz-
// und Lackschicht; Einheiten: MeshStandardMaterial + Vertex-Animation). Materialklasse je Vertex (Attribut pbr.z)
// steuert prozedurale Mikrodetails im Objektraum (gebürstetes/zerkratztes Metall mit Kantenabnutzung aus der
// gebackenen Krümmung, Ledernarbung, Stoffgewebe mit Glanz, Haut mit Streulicht, Haarsträhnen, Holzmaserung …).
// Gebackene Werte (Attribut bake): Verdeckung, Krümmung, Hohlraum, Dicke.
import * as THREE from 'three';

const NOISE = /* glsl */`
float afHash(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float afNoise(vec3 p) {
  vec3 i = floor(p), f = fract(p); vec3 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(afHash(i), afHash(i + vec3(1,0,0)), u.x), mix(afHash(i + vec3(0,1,0)), afHash(i + vec3(1,1,0)), u.x), u.y),
             mix(mix(afHash(i + vec3(0,0,1)), afHash(i + vec3(1,0,1)), u.x), mix(afHash(i + vec3(0,1,1)), afHash(i + vec3(1,1,1)), u.x), u.y), u.z);
}
float afFbm(vec3 p) { return afNoise(p) * 0.55 + afNoise(p * 2.07 + 7.1) * 0.3 + afNoise(p * 4.3 + 3.7) * 0.15; }
// Zellrauschen (Ledernarben, Poren)
float afCell(vec3 p) {
  vec3 i = floor(p), f = fract(p); float d = 1.0;
  for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec3 o = vec3(float(x), float(y), float(z));
    vec3 r = o + vec3(afHash(i + o), afHash(i + o + 17.3), afHash(i + o + 41.9)) - f;
    d = min(d, dot(r, r));
  }
  return sqrt(d);
}
`;

const VERT_HEAD = /* glsl */`
attribute vec4 pbr;
attribute vec4 bake;
varying vec4 vPbr;
varying vec4 vBake;
varying vec3 vObjP;
varying vec3 vObjN;
`;

const FRAG_HEAD = /* glsl */`
varying vec4 vPbr;
varying vec4 vBake;
varying vec3 vObjP;
varying vec3 vObjN;
uniform float uFlash; uniform vec3 uFlashCol; uniform float uDetail; uniform float uRim; uniform vec3 uRimCol; uniform float uDetailScale;
${NOISE}
`;

// Hauptteil: Materialklassen → Albedo, Rauheit, Metall, Höhe afH (Meter, für Relief), Masken.
// Jede Rauschoktave wird nach ihrer Bildschirmfrequenz ausgeblendet (kein Flimmern/Pixelrauschen).
const FRAG_SURFACE = /* glsl */`
	float afId = floor(vPbr.z * 15.0 + 0.5);
	vec3 afP = vObjP * uDetailScale;
	float afFw = max(length(fwidth(afP)), 1e-6);           // Pixelgröße im Objektraum
	#define AFW(f) (1.0 - smoothstep(0.18, 0.5, (f) * afFw))
	vec3 afN = normalize(vObjN + 1e-5);
	vec3 afW = abs(afN); afW = afW / (afW.x + afW.y + afW.z);
	float afCurv = vBake.y, afCav = vBake.z;
	float afEdge = smoothstep(0.08, 0.5, afCurv) * vPbr.w;
	float afDirt = smoothstep(0.05, 0.55, -afCav) + 0.4 * smoothstep(0.12, 0.6, -afCurv);
	float afThin = 1.0 - vBake.w;
	float afRough = vPbr.x, afMetal = vPbr.y, afH = 0.0;
	float afSkin = 0.0, afCloth = 0.0, afCoat = 0.0, afGlowIn = 0.0;
	vec3 afAlb = diffuseColor.rgb;
	if (afId < 0.5) {                                   // allgemein (alte Einheiten-Modelle)
		float n = afNoise(afP * 26.0) * 0.65 + afNoise(afP * 71.0) * 0.35 * AFW(71.0);
		afRough *= 0.88 + 0.24 * n; afH = n * 0.0008;
	} else if (afId < 2.5) {                            // Metall (1 Stahl/Eisen, 2 Edelmetall)
		float gold = step(1.5, afId);
		float bw = AFW(180.0);
		float bx = afNoise(vec3(afP.x * 2.0, afP.y * 180.0, afP.z * 180.0));
		float by = afNoise(vec3(afP.x * 180.0, afP.y * 2.0, afP.z * 180.0));
		float bz = afNoise(vec3(afP.x * 180.0, afP.y * 180.0, afP.z * 2.0));
		float brush = mix(0.5, bx * afW.x + by * afW.y + bz * afW.z, bw);
		float sc = 0.0;
		float sw = AFW(60.0);
		for (int i = 0; i < 3; i++) {
			vec3 d = normalize(vec3(afHash(vec3(float(i), 1.0, 7.0)) - 0.5, afHash(vec3(float(i), 3.0, 2.0)) - 0.5, afHash(vec3(float(i), 5.0, 9.0)) - 0.5));
			float l = abs(fract(dot(afP, d) * 23.0 + afNoise(afP * 7.0) * 1.5) - 0.5);
			sc = max(sc, (1.0 - smoothstep(0.0, 0.03, l)) * smoothstep(0.62, 0.85, afNoise(afP * 5.0 + float(i) * 13.0)));
		}
		sc *= sw;
		float blot = afFbm(afP * 6.0);
		afRough = afRough * (0.85 + 0.3 * brush) + 0.1 * (blot - 0.5) * (1.0 - 0.5 * gold);
		afRough = mix(afRough, afRough * 0.55, afEdge);
		afRough = mix(afRough, 0.8, 0.55 * afDirt);
		afRough = clamp(afRough + 0.1 * sc, 0.08, 1.0);
		afAlb *= (0.95 + 0.08 * brush) * (1.0 + 0.3 * afEdge) * (1.0 - 0.6 * afDirt);
		afAlb = mix(afAlb, afAlb * vec3(0.5, 0.58, 0.42), gold * 0.55 * afDirt);
		afAlb *= 1.0 - 0.18 * sc;
		afMetal = mix(afMetal, 0.55, 0.5 * afDirt);
		afH = brush * 0.00002 + blot * 0.00025 - sc * 0.00004;
	} else if (afId < 3.5) {                            // Leder
		float g = mix(0.5, afCell(afP * 110.0), AFW(110.0));
		float big = afFbm(afP * 9.0);
		afH = g * 0.00028 + big * 0.0009;
		afAlb *= (0.82 + 0.3 * big) * (1.0 + 0.3 * afEdge) * (1.0 - 0.5 * afDirt);
		afRough = clamp(afRough * (0.85 + 0.3 * g) + 0.15 * afDirt - 0.15 * afEdge, 0.2, 1.0);
	} else if (afId < 4.5) {                            // Stoff: Gewebe (Triplanar) + Glanz
		float K = 380.0, ww = AFW(K / 3.0);
		vec2 ux = afP.yz * K, uy = afP.xz * K, uz = afP.xy * K;
		float wx = sin(ux.x) * sin(ux.y), wy = sin(uy.x) * sin(uy.y), wz = sin(uz.x) * sin(uz.y);
		float weave = mix(0.5, 0.5 + 0.5 * (wx * afW.x + wy * afW.y + wz * afW.z), ww);
		float blot = afFbm(afP * 5.0);
		afH = weave * 0.0002 + blot * 0.0006;
		afAlb *= (0.9 + 0.12 * weave) * (0.88 + 0.24 * blot) * (1.0 + 0.15 * afEdge) * (1.0 - 0.5 * afDirt);
		afRough = clamp(afRough + 0.05 * afDirt, 0.3, 1.0);
		afCloth = 1.0;
	} else if (afId < 5.5) {                            // Haut
		float pore = mix(0.5, afCell(afP * 420.0), AFW(420.0));
		float mott = afFbm(afP * 12.0);
		afH = pore * 0.00004 + mott * 0.0002;
		afAlb *= (0.95 + 0.1 * mott) * (1.0 - 0.22 * afDirt);
		afAlb = mix(afAlb, afAlb * vec3(1.06, 0.82, 0.8), 0.6 * afDirt);
		afRough = clamp(afRough * (0.92 + 0.2 * pore) - 0.05 * afEdge, 0.3, 0.9);
		afSkin = 1.0;
	} else if (afId < 6.5) {                            // Haar / Fell / Federn: Strähnen entlang Y
		float s1 = afNoise(vec3(afP.x * 600.0, afP.y * 18.0, afP.z * 600.0));
		float s2 = afNoise(vec3(afP.x * 1600.0, afP.y * 40.0, afP.z * 1600.0));
		float st = mix(0.5, s1 * 0.65 + s2 * 0.35 * AFW(1600.0), AFW(600.0));
		afH = st * 0.0003;
		afAlb *= (0.7 + 0.55 * st) * (1.0 - 0.45 * afDirt);
		afRough = clamp(afRough * (0.85 + 0.35 * (1.0 - st)), 0.25, 1.0);
		afCloth = 0.6;
	} else if (afId < 7.5) {                            // Holz / Rinde
		float r = length(afP.xz) * 90.0 + afFbm(afP * vec3(8.0, 1.5, 8.0)) * 6.0;
		float grain = 0.5 + 0.5 * sin(r * 6.2832);
		float fib = mix(0.5, afNoise(vec3(afP.x * 200.0, afP.y * 8.0, afP.z * 200.0)), AFW(200.0));
		afH = grain * 0.0003 + fib * 0.0003;
		afAlb *= (0.82 + 0.22 * grain) * (0.85 + 0.25 * fib) * (1.0 + 0.25 * afEdge) * (1.0 - 0.5 * afDirt);
		afRough = clamp(afRough * (0.9 + 0.2 * fib), 0.3, 1.0);
	} else if (afId < 8.5) {                            // Stein / Knochen
		float n = afFbm(afP * 16.0), c = mix(0.5, afCell(afP * 50.0), AFW(50.0));
		afH = n * 0.0015 + c * 0.0006;
		afAlb *= (0.8 + 0.35 * n) * (1.0 + 0.3 * afEdge) * (1.0 - 0.55 * afDirt);
		afRough = clamp(afRough * (0.85 + 0.3 * n), 0.2, 1.0);
	} else if (afId < 9.5) {                            // Kristall
		afRough = 0.06; afGlowIn = 1.0; afCoat = 1.0;
	} else if (afId < 10.5) {                           // Blatt / Moos
		float v = afFbm(afP * 30.0);
		afH = v * 0.0006;
		afAlb *= (0.75 + 0.45 * v) * (1.0 - 0.5 * afDirt);
		afCloth = 0.4;
	} else if (afId < 11.5) {                           // Auge
		afRough = 0.05; afCoat = 1.0;
	} else {                                            // Lack / Emaille / Chitin: Kanten abgeplatzt → Metall
		float chip = smoothstep(0.55, 0.8, afEdge + 0.3 * afFbm(afP * 30.0)) * vPbr.w;
		float n = afNoise(afP * 40.0);
		afAlb = mix(afAlb * (1.0 - 0.45 * afDirt), vec3(0.5, 0.51, 0.53), chip);
		afMetal = mix(afMetal, 1.0, chip);
		afRough = mix(clamp(afRough + 0.06 * n, 0.1, 1.0), 0.35, chip);
		afCoat = 1.0 - chip;
		afH = n * 0.00006 - chip * 0.0003;
	}
	afH *= uDetail;
	diffuseColor.rgb = afAlb;
`;

/**
 * Über-Material erzeugen.
 * o: { physical (Helden), skinned, unitAnim (fn injectUnitAnim), side, detailScale, env, rim }
 */
export function createForgeMaterial(o = {}) {
  const physical = o.physical !== false;
  const params = { vertexColors: true, roughness: 1, metalness: 1, envMapIntensity: o.env ?? 1.0, side: o.side ?? THREE.FrontSide };
  const m = physical
    ? new THREE.MeshPhysicalMaterial({ ...params, sheen: 1, sheenRoughness: 0.45, sheenColor: new THREE.Color(1, 1, 1), clearcoat: 1, clearcoatRoughness: 0.08, specularIntensity: 1 })
    : new THREE.MeshStandardMaterial(params);
  const uniforms = {
    uFlash: { value: 0 }, uFlashCol: { value: new THREE.Color(1, 0.35, 0.25) }, uDetail: { value: 1 },
    uRim: { value: o.rim ?? 0.22 }, uRimCol: { value: new THREE.Color(0.55, 0.7, 1.0) }, uDetailScale: { value: o.detailScale ?? 1 },
  };
  m.userData.uniforms = uniforms;
  m.userData.forge = true;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + VERT_HEAD)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvPbr = pbr; vBake = bake; vObjP = position; vObjN = normal;');
    let fs = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + FRAG_HEAD)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + FRAG_SURFACE)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = clamp(afRough, 0.04, 1.0);')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = clamp(afMetal, 0.0, 1.0);')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
	if (abs(afH) > 0.0) {
		vec3 dpdx = dFdx( - vViewPosition ), dpdy = dFdy( - vViewPosition );
		float dhx = dFdx( afH ), dhy = dFdy( afH );
		vec3 r1 = cross( dpdy, normal ), r2 = cross( normal, dpdx );
		float det = dot( dpdx, r1 );
		vec3 grad = sign( det ) * ( dhx * r1 + dhy * r2 );
		normal = normalize( abs( det ) * normal - grad );
	}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
	{
		vec3 rimV = normalize( vViewPosition );
		float ndv = clamp( dot( normal, rimV ), 0.0, 1.0 );
		float rimF = pow( 1.0 - ndv, 3.5 );
		// filmischer Kantenschein (Himmel) – auf Metall schwächer, in Hohlräumen aus
		totalEmissiveRadiance += rimF * uRim * ( diffuseColor.rgb * 0.6 + uRimCol * 0.25 ) * ( 1.0 - 0.6 * metalnessFactor ) * ( 1.0 - vBake.x );
		totalEmissiveRadiance += diffuseColor.rgb * afGlowIn * ( 0.35 + 1.2 * rimF + 0.6 * afThin );
		totalEmissiveRadiance += uFlashCol * uFlash * ( 0.35 + 0.65 * rimF );
	}`)
      .replace('#include <aomap_fragment>', `
	{
		float ambientOcclusion = clamp( ( 1.0 - vBake.x * 0.92 ) * ( 1.0 - 0.3 * afDirt ), 0.0, 1.0 );
		reflectedLight.indirectDiffuse *= ambientOcclusion;
		// Mikroverschattung auch für direktes Licht (Spalten, die die Schattenkarte nicht auflöst)
		reflectedLight.directDiffuse *= mix( 1.0, ambientOcclusion, 0.55 );
		reflectedLight.directSpecular *= mix( 1.0, ambientOcclusion, 0.4 );
		#if defined( USE_CLEARCOAT )
			clearcoatSpecularIndirect *= ambientOcclusion;
		#endif
		#if defined( USE_SHEEN )
			sheenSpecularIndirect *= ambientOcclusion;
		#endif
		#if defined( USE_ENVMAP ) && defined( STANDARD )
			float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
			reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
		#endif
		// unechte Unterflächenstreuung (Haut) + Durchscheinen dünner Teile (Ohren, Stoffkanten, Blätter)
		#if NUM_DIR_LIGHTS > 0
		if ( afSkin + afCloth > 0.0 ) {
			for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
				vec3 L = directionalLights[ i ].direction;
				float ndl = dot( normal, L );
				float wrap = max( 0.0, ( ndl + 0.55 ) / 1.55 ) - max( 0.0, ndl );
				float back = max( 0.0, -ndl ) * afThin;
				vec3 sss = vec3( 1.0, 0.32, 0.2 ) * afSkin + vec3( 0.6 ) * afCloth * 0.4;
				reflectedLight.directDiffuse += ( wrap * 0.55 + back * 0.6 ) * sss * directionalLights[ i ].color * diffuseColor.rgb;
			}
		}
		#endif
	}`);
    if (physical) {
      fs = fs.replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
	#ifdef USE_SHEEN
		material.sheenColor = diffuseColor.rgb * 0.9 * afCloth + vec3(0.02) * afCloth;
		material.sheenRoughness = 0.55;
	#endif
	#ifdef USE_CLEARCOAT
		material.clearcoat = afCoat * 0.9;
	#endif`);
    }
    sh.fragmentShader = fs;
    if (o.unitAnim) o.unitAnim(sh);
  };
  m.customProgramCacheKey = () => `aether-forge-v1-${physical ? 'p' : 's'}-${o.unitAnim ? 'u' : ''}-${m.side}`;
  return m;
}

/** Glüh-Material (HDR für Bloom) – Farbe vom Animator gesetzt (userData.base = Skalierung der Vertexfarben) */
export function createForgeGlowMaterial(base = 1, o = {}) {
  const m = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  m.userData.base = base;
  m.color.setScalar(base);
  if (o.unitAnim) { m.onBeforeCompile = (sh) => o.unitAnim(sh); m.customProgramCacheKey = () => 'aether-forge-glow-u'; }
  return m;
}

/** Kristallglas: durchscheinend, irisierend, inneres Leuchten */
export function createForgeGlassMaterial() {
  const m = new THREE.MeshPhysicalMaterial({
    vertexColors: true, roughness: 0.05, metalness: 0.0, transparent: true, opacity: 0.7, clearcoat: 1, clearcoatRoughness: 0.04,
    iridescence: 0.7, iridescenceIOR: 1.55, envMapIntensity: 2.0, depthWrite: false, side: THREE.DoubleSide, ior: 1.6, specularIntensity: 1,
  });
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
	{
		float ndv = clamp( dot( normal, normalize( vViewPosition ) ), 0.0, 1.0 );
		totalEmissiveRadiance += diffuseColor.rgb * ( 0.5 + 1.6 * pow( 1.0 - ndv, 2.0 ) );
	}`);
  };
  m.customProgramCacheKey = () => 'aether-forge-glass-v1';
  return m;
}
