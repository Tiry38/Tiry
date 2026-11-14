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

// Hauptteil: Materialklassen → Albedo, Rauheit, Metall, Höhe (für Relief), Masken
const FRAG_SURFACE = /* glsl */`
	float afId = floor(vPbr.z * 15.0 + 0.5);
	vec3 afP = vObjP * uDetailScale;
	vec3 afN = normalize(vObjN + 1e-5);
	vec3 afW = abs(afN); afW = afW / (afW.x + afW.y + afW.z);
	float afCurv = vBake.y, afCav = vBake.z;
	float afEdge = smoothstep(0.06, 0.45, afCurv) * vPbr.w;
	float afDirt = smoothstep(0.04, 0.5, -afCav) + 0.5 * smoothstep(0.1, 0.6, -afCurv);
	float afThin = 1.0 - vBake.w;
	float afRough = vPbr.x, afMetal = vPbr.y, afH = 0.0, afBump = 0.0;
	float afSkin = 0.0, afCloth = 0.0, afCoat = 0.0, afGlowIn = 0.0;
	vec3 afAlb = diffuseColor.rgb;
	float afFar = uDetail * (1.0 - smoothstep(10.0, 45.0, length(vViewPosition)));
	if (afId < 0.5) {                                   // allgemein (alte Einheiten-Modelle)
		float n = afNoise(afP * 26.0) * 0.65 + afNoise(afP * 71.0) * 0.35;
		afRough *= 0.88 + 0.24 * n; afH = n; afBump = 0.35;
	} else if (afId < 1.5 || (afId > 1.5 && afId < 2.5)) { // Metall (1 Stahl, 2 Edelmetall)
		float gold = step(1.5, afId);
		// gebürstet entlang der dominanten Achse (Triplanar)
		float bx = afNoise(vec3(afP.x * 3.0, afP.y * 260.0, afP.z * 260.0));
		float by = afNoise(vec3(afP.x * 260.0, afP.y * 3.0, afP.z * 260.0));
		float bz = afNoise(vec3(afP.x * 260.0, afP.y * 260.0, afP.z * 3.0));
		float brush = bx * afW.x + by * afW.y + bz * afW.z;
		// Kratzer: dünne Linien in zufälligen Richtungen, fleckig verteilt
		float sc = 0.0;
		for (int i = 0; i < 3; i++) {
			vec3 d = normalize(vec3(afHash(vec3(float(i), 1.0, 7.0)) - 0.5, afHash(vec3(float(i), 3.0, 2.0)) - 0.5, afHash(vec3(float(i), 5.0, 9.0)) - 0.5));
			float l = abs(fract(dot(afP, d) * 46.0 + afNoise(afP * 9.0) * 2.0) - 0.5);
			sc = max(sc, (1.0 - smoothstep(0.0, 0.035, l)) * smoothstep(0.55, 0.8, afNoise(afP * 6.0 + float(i) * 13.0)));
		}
		float blot = afFbm(afP * 7.0);
		afRough = afRough * (0.8 + 0.35 * brush) + 0.08 * blot * (1.0 - gold);
		afRough = mix(afRough, afRough * 0.45, afEdge);                // polierte Kanten
		afRough = mix(afRough, 0.85, 0.6 * afDirt);
		afRough = clamp(afRough - 0.12 * sc, 0.05, 1.0);
		afAlb *= (0.92 + 0.12 * brush) * (1.0 + 0.45 * afEdge) * (1.0 - 0.55 * afDirt * (1.0 - 0.3 * gold));
		afAlb = mix(afAlb, afAlb * vec3(0.55, 0.62, 0.45), gold * 0.6 * afDirt);  // Patina in Vertiefungen
		afAlb *= 1.0 + 0.25 * sc;
		afMetal = mix(afMetal, 0.6, 0.5 * afDirt);
		afH = brush * 0.25 + blot * 0.5 + sc * 0.6; afBump = 0.45;
	} else if (afId < 3.5) {                               // Leder
		float g = afCell(afP * 120.0);
		float big = afFbm(afP * 10.0);
		afH = g * 0.8 + big * 0.4; afBump = 1.0;
		afAlb *= (0.82 + 0.3 * big) * (1.0 + 0.35 * afEdge) * (1.0 - 0.45 * afDirt);
		afRough = clamp(afRough * (0.85 + 0.3 * g) + 0.15 * afDirt - 0.15 * afEdge, 0.2, 1.0);
	} else if (afId < 4.5) {                               // Stoff: Gewebe (Triplanar) + Glanz
		float K = 520.0;
		vec2 ux = afP.yz * K, uy = afP.xz * K, uz = afP.xy * K;
		float wx = sin(ux.x) * sin(ux.y), wy = sin(uy.x) * sin(uy.y), wz = sin(uz.x) * sin(uz.y);
		float weave = 0.5 + 0.5 * (wx * afW.x + wy * afW.y + wz * afW.z);
		float fib = afNoise(afP * 300.0);
		float blot = afFbm(afP * 6.0);
		afH = weave * 0.6 + fib * 0.3; afBump = 0.8;
		afAlb *= (0.88 + 0.14 * weave) * (0.88 + 0.24 * blot) * (1.0 + 0.18 * afEdge) * (1.0 - 0.45 * afDirt);
		afRough = clamp(afRough * (0.92 + 0.1 * fib) + 0.05 * afDirt, 0.3, 1.0);
		afCloth = 1.0;
	} else if (afId < 5.5) {                               // Haut
		float pore = afCell(afP * 520.0);
		float mott = afFbm(afP * 14.0);
		afH = pore * 0.6 + mott * 0.3; afBump = 0.35;
		afAlb *= (0.94 + 0.12 * mott) * (1.0 - 0.25 * afDirt);
		afAlb = mix(afAlb, afAlb * vec3(1.08, 0.86, 0.84), 0.5 * afDirt);
		afRough = clamp(afRough * (0.9 + 0.25 * pore) - 0.06 * afEdge, 0.25, 0.9);
		afSkin = 1.0;
	} else if (afId < 6.5) {                               // Haar / Fell / Federn: Strähnen entlang der Hauptachse
		float s1 = afNoise(vec3(afP.x * 900.0, afP.y * 22.0, afP.z * 900.0));
		float s2 = afNoise(vec3(afP.x * 2400.0, afP.y * 50.0, afP.z * 2400.0));
		float st = s1 * 0.65 + s2 * 0.35;
		afH = st; afBump = 1.4;
		afAlb *= (0.66 + 0.6 * st) * (1.0 - 0.4 * afDirt);
		afRough = clamp(afRough * (0.8 + 0.4 * (1.0 - st)), 0.25, 1.0);
		afCloth = 0.6;
	} else if (afId < 7.5) {                               // Holz / Rinde
		float r = length(afP.xz) * 90.0 + afFbm(afP * vec3(8.0, 1.5, 8.0)) * 6.0;
		float grain = 0.5 + 0.5 * sin(r * 6.2832);
		float fib = afNoise(vec3(afP.x * 200.0, afP.y * 8.0, afP.z * 200.0));
		afH = grain * 0.5 + fib * 0.6; afBump = 1.0;
		afAlb *= (0.8 + 0.25 * grain) * (0.85 + 0.25 * fib) * (1.0 + 0.25 * afEdge) * (1.0 - 0.5 * afDirt);
		afRough = clamp(afRough * (0.9 + 0.2 * fib), 0.3, 1.0);
	} else if (afId < 8.5) {                               // Stein / Knochen
		float n = afFbm(afP * 18.0), c = afCell(afP * 60.0);
		afH = n * 0.6 + c * 0.5; afBump = 1.2;
		afAlb *= (0.8 + 0.35 * n) * (1.0 + 0.3 * afEdge) * (1.0 - 0.55 * afDirt);
		afRough = clamp(afRough * (0.85 + 0.3 * n), 0.2, 1.0);
	} else if (afId < 9.5) {                               // Kristall
		afRough = 0.05; afGlowIn = 1.0; afCoat = 1.0;
		afH = afNoise(afP * 30.0) * 0.2; afBump = 0.2;
	} else if (afId < 10.5) {                              // Blatt / Moos
		float v = afFbm(afP * 40.0);
		afH = v; afBump = 0.9;
		afAlb *= (0.75 + 0.45 * v) * (1.0 - 0.5 * afDirt);
		afCloth = 0.4;
	} else if (afId < 11.5) {                              // Auge
		afRough = 0.06; afCoat = 1.0;
	} else {                                               // Lack / Emaille / Chitin: Kanten abgeplatzt → Metall
		float chip = smoothstep(0.55, 0.75, afEdge + 0.35 * afFbm(afP * 40.0)) * vPbr.w;
		float n = afNoise(afP * 50.0);
		afAlb = mix(afAlb * (1.0 - 0.4 * afDirt), vec3(0.55, 0.56, 0.58), chip);
		afMetal = mix(afMetal, 1.0, chip);
		afRough = mix(clamp(afRough + 0.05 * n, 0.1, 1.0), 0.35, chip);
		afCoat = 1.0 - chip;
		afH = n * 0.2 - chip * 0.6; afBump = 0.6;
	}
	afBump *= afFar;
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
	if (afBump > 0.001) {
		vec3 dpdx = dFdx( - vViewPosition ), dpdy = dFdy( - vViewPosition );
		float dhx = dFdx( afH ), dhy = dFdy( afH );
		vec3 r1 = cross( dpdy, normal ), r2 = cross( normal, dpdx );
		float det = dot( dpdx, r1 );
		vec3 grad = sign( det ) * ( dhx * r1 + dhy * r2 );
		normal = normalize( abs( det ) * normal - grad * 0.0045 * afBump );
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
