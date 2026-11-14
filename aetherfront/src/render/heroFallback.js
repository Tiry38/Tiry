// Ersatz-Rig für Helden (gleiche Schnittstelle wie render/heroModels.js), solange das große Modell-Modul
// nicht verfügbar ist: gegliederte Figur aus Gelenk-Gruppen (Hüfte, Wirbelsäule, Brust, Kopf, Arme, Beine),
// PBR-Materialien aus der Heldenpalette, leuchtende Runen/Kristalle (HDR → Bloom) und Waffen je Held.
//   buildHero(modelId, { palette, level }) → { root, joints, height, radius, glowMaterials, setLevel, dispose }
//   new HeroAnimator(rig).update(dt, { fwd, strafe, turn, airborne, vy, action, hitAt, dead, victory, stunned, castGlow })
import * as THREE from 'three';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

// Bauplan je Held: Statur, Rüstungsstil, Kopfbedeckung, Waffen
const KITS = {
  hero_kael: { build: 1.08, bulk: 1.2, armor: 'plate', head: 'helm', cape: true, right: 'sword', left: 'shield' },
  hero_lyra: { build: 0.98, bulk: 0.88, armor: 'leather', head: 'hood', cape: true, right: 'none', left: 'bow', quiver: true },
  hero_varo: { build: 1.0, bulk: 0.95, armor: 'leather', head: 'mask', cape: false, right: 'dagger', left: 'dagger', scarf: true },
  hero_selene: { build: 0.97, bulk: 0.86, armor: 'robe', head: 'circlet', cape: false, right: 'staff', left: 'none', orbs: true },
  hero_mira: { build: 0.97, bulk: 0.9, armor: 'robe', head: 'halo', cape: true, right: 'mace', left: 'tome' },
  hero_brann: { build: 0.94, bulk: 1.35, armor: 'plate', head: 'goggles', cape: false, right: 'hammer', left: 'none', pack: true },
  hero_thessa: { build: 0.99, bulk: 0.9, armor: 'robe', head: 'antlers', cape: true, right: 'staff', left: 'none', leaves: true },
  hero_morvain: { build: 1.04, bulk: 0.92, armor: 'robe', head: 'cowl', cape: true, right: 'scythe', left: 'none', orbs: true },
};

function mats(palette) {
  const c = (h) => new THREE.Color(h);
  const std = (col, rough, metal, extra = {}) => new THREE.MeshStandardMaterial({ color: col, roughness: rough, metalness: metal, envMapIntensity: 1.2, ...extra });
  const glowCol = c(palette.glow || '#7cc8ff');
  const glow = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: glowCol, emissiveIntensity: 3.2, roughness: 0.4, metalness: 0, toneMapped: true });
  const glowSoft = new THREE.MeshStandardMaterial({ color: glowCol.clone().multiplyScalar(0.25), emissive: glowCol, emissiveIntensity: 1.4, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.85 });
  return {
    primary: std(c(palette.primary), 0.55, 0.15),
    primaryMetal: std(c(palette.primary), 0.3, 0.85),
    secondary: std(c(palette.secondary), 0.78, 0.0),
    cloth: std(c(palette.secondary).multiplyScalar(0.85), 0.9, 0.0, { side: THREE.DoubleSide }),
    metal: std(c(palette.metal), 0.28, 1.0),
    dark: std(c('#1b1d26'), 0.65, 0.3),
    leather: std(c('#4a3424'), 0.72, 0.0),
    skin: std(c('#e0b296'), 0.55, 0.0),
    hair: std(c(palette.hair || '#3a2a20'), 0.5, 0.0),
    wood: std(c('#5a3e28'), 0.8, 0.0),
    glow, glowSoft,
  };
}

function capsule(r, len, seg = 10) { return new THREE.CapsuleGeometry(r, Math.max(0.001, len), 4, seg); }
function ell(rx, ry, rz, w = 18, h = 14) { return new THREE.SphereGeometry(1, w, h).scale(rx, ry, rz); }

/** Gelenk anlegen */
function joint(name, parent, x, y, z, J) {
  const g = new THREE.Group();
  g.name = name;
  g.position.set(x, y, z);
  parent.add(g);
  J[name] = g;
  return g;
}

/** Teil an ein Gelenk hängen */
function part(parent, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sh = true) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = sh;
  m.receiveShadow = false;
  parent.add(m);
  return m;
}

function buildWeapon(kind, hand, M, side) {
  const g = new THREE.Group();
  hand.add(g);
  const s = side === 'L' ? 1 : -1;
  switch (kind) {
    case 'sword': {
      g.rotation.set(Math.PI / 2, 0, 0);
      part(g, capsule(0.022, 0.16, 8), M.leather, 0, 0, 0);
      part(g, new THREE.BoxGeometry(0.26, 0.035, 0.05), M.metal, 0, 0.11, 0);
      const blade = new THREE.BoxGeometry(0.075, 0.95, 0.018);
      blade.translate(0, 0.6, 0);
      part(g, blade, M.primaryMetal, 0, 0, 0);
      part(g, new THREE.BoxGeometry(0.02, 0.85, 0.022).translate(0, 0.62, 0), M.glow, 0, 0, 0, 0, 0, 0, false);
      part(g, new THREE.OctahedronGeometry(0.035), M.glow, 0, -0.1, 0, 0, 0, 0, false);
      break;
    }
    case 'shield': {
      const sh = new THREE.Group();
      sh.position.set(s * 0.07, -0.02, 0.04);
      sh.rotation.set(0, s * Math.PI / 2, 0);
      g.add(sh);
      const disc = new THREE.CylinderGeometry(0.36, 0.33, 0.05, 6, 1);
      disc.rotateX(Math.PI / 2);
      part(sh, disc, M.secondary, 0, 0, 0, 0, 0, Math.PI / 6);
      const rim = new THREE.TorusGeometry(0.35, 0.025, 6, 6);
      part(sh, rim, M.metal, 0, 0, 0.02, 0, 0, Math.PI / 6);
      part(sh, ell(0.09, 0.09, 0.05), M.metal, 0, 0, 0.04);
      part(sh, new THREE.OctahedronGeometry(0.05), M.glow, 0, 0, 0.08, 0, 0, 0, false);
      break;
    }
    case 'bow': {
      // Griff in der Hand, Wurfarme biegen sich zum Schützen zurück, Sehne auf seiner Seite
      const R = 0.62;
      const arc = new THREE.TorusGeometry(R, 0.022, 6, 28, Math.PI * 0.82);
      arc.rotateZ(-Math.PI * 0.41).translate(-R, 0, 0).rotateY(-Math.PI / 2);
      part(g, arc, M.wood, 0, 0, 0);
      part(g, new THREE.CylinderGeometry(0.004, 0.004, 1.92 * R * 0.96, 4), M.glowSoft, 0, 0, -0.83 * R, 0, 0, 0, false);
      part(g, new THREE.OctahedronGeometry(0.04), M.glow, 0, 0, 0.03, 0, 0, 0, false);
      g.position.set(0, -0.03, 0.02);
      break;
    }
    case 'dagger': {
      g.rotation.set(Math.PI / 2, 0, 0);
      part(g, capsule(0.02, 0.1, 8), M.leather, 0, 0, 0);
      part(g, new THREE.BoxGeometry(0.14, 0.025, 0.03), M.metal, 0, 0.07, 0);
      const b = new THREE.ConeGeometry(0.04, 0.5, 4);
      b.scale(1, 1, 0.3); b.translate(0, 0.32, 0);
      part(g, b, M.primaryMetal, 0, 0, 0);
      part(g, new THREE.ConeGeometry(0.012, 0.42, 4).translate(0, 0.32, 0), M.glow, 0, 0, 0.004, 0, 0, 0, false);
      break;
    }
    case 'staff': case 'scythe': case 'mace': {
      const L = kind === 'mace' ? 0.6 : 1.75;
      g.rotation.set(kind === 'mace' ? Math.PI * 0.35 : 0.12, 0, 0);
      const shaft = new THREE.CylinderGeometry(0.022, 0.026, L, 8);
      shaft.translate(0, L * 0.5 - (kind === 'mace' ? 0.08 : 0.55), 0);
      part(g, shaft, kind === 'scythe' ? M.dark : M.wood, 0, 0, 0);
      const top = L - (kind === 'mace' ? 0.08 : 0.55);
      if (kind === 'staff') {
        part(g, new THREE.TorusGeometry(0.1, 0.014, 6, 16), M.metal, 0, top + 0.06, 0, 0, Math.PI / 2, 0);
        part(g, new THREE.OctahedronGeometry(0.09).scale(0.8, 1.5, 0.8), M.glow, 0, top + 0.12, 0, 0, 0, 0, false);
        for (let i = 0; i < 3; i++) part(g, new THREE.ConeGeometry(0.018, 0.16, 4), M.metal, Math.cos(i * 2.1) * 0.08, top + 0.02, Math.sin(i * 2.1) * 0.08, Math.sin(i * 2.1) * 0.5, 0, -Math.cos(i * 2.1) * 0.5);
      } else if (kind === 'scythe') {
        const blade = new THREE.TorusGeometry(0.38, 0.03, 4, 18, Math.PI * 0.6);
        blade.scale(1, 1, 0.3);
        part(g, blade, M.primaryMetal, -0.3, top - 0.02, 0, 0, 0, 0.2);
        part(g, new THREE.TorusGeometry(0.37, 0.008, 4, 18, Math.PI * 0.6), M.glow, -0.3, top - 0.02, 0.012, 0, 0, 0.2, false);
        part(g, new THREE.IcosahedronGeometry(0.06), M.glow, 0, top + 0.04, 0, 0, 0, 0, false);
      } else {
        part(g, new THREE.IcosahedronGeometry(0.11, 0), M.metal, 0, top, 0);
        part(g, new THREE.IcosahedronGeometry(0.075, 1), M.glow, 0, top, 0, 0, 0, 0, false);
      }
      break;
    }
    case 'hammer': {
      g.rotation.set(Math.PI / 2, 0, 0);
      part(g, new THREE.CylinderGeometry(0.026, 0.03, 1.05, 8).translate(0, 0.3, 0), M.wood, 0, 0, 0);
      part(g, new THREE.BoxGeometry(0.42, 0.24, 0.24), M.primaryMetal, 0, 0.82, 0);
      part(g, new THREE.BoxGeometry(0.46, 0.06, 0.26), M.metal, 0, 0.82, 0);
      part(g, new THREE.BoxGeometry(0.06, 0.2, 0.26), M.glow, 0.17, 0.82, 0, 0, 0, 0, false);
      part(g, new THREE.BoxGeometry(0.06, 0.2, 0.26), M.glow, -0.17, 0.82, 0, 0, 0, 0, false);
      break;
    }
    case 'tome': {
      g.position.set(s * 0.06, -0.04, 0.05);
      part(g, new THREE.BoxGeometry(0.2, 0.26, 0.06), M.secondary, 0, 0, 0, 0, s * 0.4, 0);
      part(g, new THREE.BoxGeometry(0.18, 0.24, 0.065), M.glowSoft, 0.004 * s, 0, 0, 0, s * 0.4, 0, false);
      break;
    }
    default: break;
  }
  return g;
}

export function buildHero(modelId, { palette = {}, level = 1 } = {}) {
  const kit = KITS[modelId] || KITS.hero_kael;
  const M = mats(palette);
  const root = new THREE.Group();
  root.name = `hero:${modelId}`;
  const J = {};
  const S = 1.36 * kit.build;   // Gesamtgröße (Held ≈ 2,5 m – größer als Vasallen)
  const body = new THREE.Group();
  body.scale.setScalar(S);
  root.add(body);
  J.body = body;
  const B = kit.bulk;
  const robe = kit.armor === 'robe';
  const plate = kit.armor === 'plate';

  const hips = joint('hips', body, 0, 0.95, 0, J);
  const spine = joint('spine', hips, 0, 0.12, 0, J);
  const chest = joint('chest', spine, 0, 0.2, 0, J);
  const neck = joint('neck', chest, 0, 0.27, -0.01, J);
  const head = joint('head', neck, 0, 0.08, 0, J);

  // Becken & Gürtel
  part(hips, ell(0.17 * B, 0.12, 0.12 * B), robe ? M.secondary : M.leather, 0, 0, 0);
  part(hips, new THREE.TorusGeometry(0.165 * B, 0.022, 6, 22), M.metal, 0, 0.04, 0, Math.PI / 2, 0, 0);
  part(hips, new THREE.BoxGeometry(0.08, 0.07, 0.03), M.metal, 0, 0.04, 0.13 * B);
  part(hips, new THREE.OctahedronGeometry(0.022), M.glow, 0, 0.04, 0.15 * B, 0, 0, 0, false);
  // Rumpf
  part(spine, capsule(0.125 * B, 0.12), robe ? M.secondary : M.leather, 0, 0.06, 0, 0, 0, 0);
  const chestGeo = ell(0.215 * B, 0.2, 0.15 * B);
  part(chest, chestGeo, plate ? M.primaryMetal : M.primary, 0, 0.1, 0);
  if (plate) {
    // Brustpanzer mit Rippung und Glutrune
    part(chest, ell(0.19 * B, 0.16, 0.06), M.primaryMetal, 0, 0.12, 0.1 * B);
    part(chest, new THREE.BoxGeometry(0.03, 0.2, 0.03), M.metal, 0, 0.12, 0.155 * B);
    part(chest, new THREE.OctahedronGeometry(0.04), M.glow, 0, 0.17, 0.17 * B, 0, 0, 0, false);
  } else {
    // Wams / Robe mit Schärpe
    part(chest, new THREE.BoxGeometry(0.06, 0.34, 0.05), M.secondary, 0.06, 0.08, 0.12 * B, 0, 0, 0.5);
    part(chest, new THREE.TorusGeometry(0.12, 0.012, 5, 18, Math.PI), M.metal, 0, 0.22, 0.04, 0.4, 0, Math.PI);
    part(chest, new THREE.OctahedronGeometry(0.03), M.glow, 0, 0.22, 0.14 * B, 0, 0, 0, false);
  }
  // Hals & Kopf
  part(neck, capsule(0.05, 0.06), M.skin, 0, 0.02, 0);
  part(head, ell(0.105, 0.125, 0.11), M.skin, 0, 0.08, 0.005);
  // Augen
  part(head, new THREE.SphereGeometry(0.012, 8, 6), M.glow, 0.038, 0.095, 0.098, 0, 0, 0, false);
  part(head, new THREE.SphereGeometry(0.012, 8, 6), M.glow, -0.038, 0.095, 0.098, 0, 0, 0, false);
  switch (kit.head) {
    case 'helm':
      part(head, ell(0.125, 0.12, 0.13), M.primaryMetal, 0, 0.12, -0.005);
      part(head, new THREE.BoxGeometry(0.2, 0.03, 0.03), M.metal, 0, 0.09, 0.115);
      part(head, new THREE.BoxGeometry(0.025, 0.16, 0.2), M.secondary, 0, 0.22, -0.02);
      part(head, new THREE.ConeGeometry(0.03, 0.18, 4), M.metal, 0.12, 0.2, 0, 0, 0, -0.9);
      part(head, new THREE.ConeGeometry(0.03, 0.18, 4), M.metal, -0.12, 0.2, 0, 0, 0, 0.9);
      break;
    case 'hood': case 'cowl': {
      const hood = new THREE.SphereGeometry(0.15, 18, 14, 0, TAU, 0, Math.PI * 0.62);
      part(head, hood, kit.head === 'cowl' ? M.dark : M.secondary, 0, 0.1, -0.02, -0.25, 0, 0);
      part(head, new THREE.ConeGeometry(0.11, 0.24, 12), kit.head === 'cowl' ? M.dark : M.secondary, 0, 0.12, -0.12, -1.2, 0, 0);
      if (kit.head === 'cowl') part(head, ell(0.08, 0.05, 0.02), M.glowSoft, 0, 0.09, 0.105, 0, 0, 0, false);
      else part(head, ell(0.11, 0.06, 0.1), M.hair, 0, 0.17, 0.0);
      break;
    }
    case 'mask':
      part(head, ell(0.112, 0.06, 0.11), M.dark, 0, 0.05, 0.01);
      part(head, ell(0.115, 0.08, 0.115), M.hair, 0, 0.16, -0.01);
      part(head, new THREE.ConeGeometry(0.05, 0.3, 6), M.hair, 0, 0.14, -0.14, -2.2, 0, 0);
      break;
    case 'circlet':
      part(head, ell(0.115, 0.1, 0.12), M.hair, 0, 0.14, -0.02);
      part(head, new THREE.ConeGeometry(0.09, 0.45, 10), M.hair, 0, -0.05, -0.1, 0.12, 0, 0);
      part(head, new THREE.TorusGeometry(0.11, 0.008, 6, 26), M.metal, 0, 0.14, 0.0, Math.PI / 2 - 0.2, 0, 0);
      part(head, new THREE.OctahedronGeometry(0.025), M.glow, 0, 0.17, 0.11, 0, 0, 0, false);
      break;
    case 'halo':
      part(head, ell(0.115, 0.1, 0.12), M.hair, 0, 0.14, -0.02);
      part(head, new THREE.ConeGeometry(0.1, 0.38, 10), M.hair, 0, -0.03, -0.09, 0.15, 0, 0);
      J.halo = part(head, new THREE.TorusGeometry(0.16, 0.009, 6, 36), M.glow, 0, 0.3, -0.06, Math.PI / 2 - 0.25, 0, 0, false);
      break;
    case 'goggles':
      part(head, ell(0.12, 0.08, 0.12), M.leather, 0, 0.17, -0.01);
      part(head, new THREE.TorusGeometry(0.03, 0.01, 6, 14), M.metal, 0.04, 0.15, 0.1);
      part(head, new THREE.TorusGeometry(0.03, 0.01, 6, 14), M.metal, -0.04, 0.15, 0.1);
      part(head, new THREE.CircleGeometry(0.026, 14), M.glow, 0.04, 0.15, 0.104, 0, 0, 0, false);
      part(head, new THREE.CircleGeometry(0.026, 14), M.glow, -0.04, 0.15, 0.104, 0, 0, 0, false);
      part(head, ell(0.1, 0.07, 0.08), M.hair, 0, 0.01, 0.07); // Bart
      break;
    case 'antlers':
      part(head, ell(0.115, 0.1, 0.12), M.hair, 0, 0.14, -0.02);
      for (const k of [1, -1]) {
        part(head, new THREE.CylinderGeometry(0.008, 0.014, 0.26, 5), M.wood, k * 0.08, 0.3, -0.02, 0, 0, -k * 0.5);
        part(head, new THREE.CylinderGeometry(0.006, 0.01, 0.12, 5), M.wood, k * 0.15, 0.37, -0.02, 0, 0, -k * 1.2);
        part(head, new THREE.IcosahedronGeometry(0.02), M.glow, k * 0.17, 0.42, -0.02, 0, 0, 0, false);
      }
      break;
    default: break;
  }

  // Arme
  for (const [side, k] of [['L', 1], ['R', -1]]) {
    const sh = joint(`shoulder${side}`, chest, k * 0.19 * B, 0.2, -0.01, J);
    const ua = joint(`upperArm${side}`, sh, k * 0.04, 0, 0, J);
    ua.rotation.z = k * 0.12;
    part(ua, capsule(0.055 * (0.85 + B * 0.15), 0.2), plate ? M.primaryMetal : M.primary, 0, -0.14, 0);
    const pa = part(sh, ell(0.11 * B, 0.08 * B, 0.11 * B), plate ? M.primaryMetal : robe ? M.secondary : M.leather, k * 0.02, 0.03, 0, 0, 0, k * 0.35);
    if (plate) {
      part(sh, ell(0.08 * B, 0.03, 0.09 * B), M.metal, k * 0.03, 0.09, 0, 0, 0, k * 0.35);
      part(sh, new THREE.ConeGeometry(0.03, 0.12, 4), M.metal, k * 0.07, 0.13, 0, 0, 0, -k * 0.5);
    }
    pa.castShadow = true;
    const fa = joint(`foreArm${side}`, ua, 0, -0.29, 0, J);
    part(fa, capsule(0.048 * (0.85 + B * 0.15), 0.18), robe ? M.secondary : M.skin, 0, -0.12, 0);
    part(fa, capsule(0.058 * (0.85 + B * 0.15), 0.1), plate ? M.metal : M.leather, 0, -0.15, 0);
    part(fa, new THREE.TorusGeometry(0.056, 0.008, 5, 16), M.glow, 0, -0.08, 0, Math.PI / 2, 0, 0, false);
    const hand = joint(`hand${side}`, fa, 0, -0.27, 0, J);
    part(hand, ell(0.045, 0.06, 0.04), plate ? M.primaryMetal : M.leather, 0, -0.03, 0);
  }
  // Beine
  for (const [side, k] of [['L', 1], ['R', -1]]) {
    const th = joint(`thigh${side}`, hips, k * 0.095 * B, -0.04, 0, J);
    part(th, capsule(0.075 * (0.8 + B * 0.2), 0.27), plate ? M.primaryMetal : M.leather, 0, -0.2, 0);
    const shn = joint(`shin${side}`, th, 0, -0.42, 0, J);
    part(shn, capsule(0.06 * (0.8 + B * 0.2), 0.28), M.leather, 0, -0.2, 0);
    part(shn, ell(0.07, 0.07, 0.075), plate ? M.metal : M.leather, 0, 0.0, 0.03);
    part(shn, capsule(0.068 * (0.8 + B * 0.2), 0.16), plate ? M.primaryMetal : M.dark, 0, -0.27, 0.0);
    const ft = joint(`foot${side}`, shn, 0, -0.42, 0, J);
    part(ft, ell(0.055, 0.045, 0.12), plate ? M.metal : M.dark, 0, 0.015, 0.05);
  }
  // Rock / Robe / Wappenrock
  {
    const len = robe ? 0.78 : 0.34;
    const skirt = new THREE.CylinderGeometry(0.17 * B, (robe ? 0.34 : 0.22) * B, len, 18, 3, true);
    skirt.translate(0, -len / 2 + 0.02, 0);
    J.skirt = part(hips, skirt, robe ? M.cloth : M.cloth, 0, 0, 0);
    if (robe) part(hips, new THREE.TorusGeometry(0.335 * B, 0.012, 5, 30), M.glowSoft, 0, -len + 0.03, 0, Math.PI / 2, 0, 0, false);
    else part(hips, new THREE.BoxGeometry(0.16, len * 0.95, 0.02), M.secondary, 0, -len / 2, 0.18 * B, -0.05, 0, 0);
  }
  // Umhang
  if (kit.cape) {
    const cape = joint('cape', chest, 0, 0.28, -0.13 * B, J);
    const cg = new THREE.PlaneGeometry(0.46 * B, 1.15, 4, 8);
    cg.translate(0, -0.575, 0);
    const pos = cg.attributes.position;
    for (let i = 0; i < pos.count; i++) { const y = pos.getY(i), x = pos.getX(i); pos.setZ(i, -Math.pow(-y, 1.3) * 0.12 - Math.abs(x) * 0.12); pos.setX(i, x * (1 + -y * 0.35)); }
    cg.computeVertexNormals();
    part(cape, cg, M.cloth, 0, 0, 0);
    part(cape, new THREE.BoxGeometry(0.46 * B, 0.03, 0.02), M.metal, 0, 0, 0.01);
  }
  if (kit.quiver) {
    const q = part(chest, new THREE.CylinderGeometry(0.06, 0.05, 0.5, 10), M.leather, 0.1, 0.05, -0.17, 0.25, 0, -0.35);
    for (let i = 0; i < 4; i++) part(q, new THREE.ConeGeometry(0.02, 0.08, 4), M.glowSoft, (i - 1.5) * 0.02, 0.29, 0, 0, 0, 0, false);
  }
  if (kit.pack) {
    part(chest, new THREE.BoxGeometry(0.34, 0.36, 0.18), M.metal, 0, 0.1, -0.2);
    part(chest, new THREE.CylinderGeometry(0.05, 0.05, 0.42, 10), M.primaryMetal, 0.12, 0.25, -0.26);
    part(chest, new THREE.CylinderGeometry(0.05, 0.05, 0.42, 10), M.primaryMetal, -0.12, 0.25, -0.26);
    part(chest, new THREE.CylinderGeometry(0.045, 0.045, 0.05, 10), M.glow, 0.12, 0.47, -0.26, 0, 0, 0, false);
    part(chest, new THREE.CylinderGeometry(0.045, 0.045, 0.05, 10), M.glow, -0.12, 0.47, -0.26, 0, 0, 0, false);
  }
  if (kit.scarf) part(neck, new THREE.TorusGeometry(0.075, 0.03, 6, 16), M.secondary, 0, 0.0, 0, Math.PI / 2, 0, 0);
  if (kit.leaves) for (let i = 0; i < 5; i++) part(J.shoulderL, new THREE.ConeGeometry(0.03, 0.14, 4).scale(1, 1, 0.3), M.glowSoft, 0.02 + i * 0.015, 0.1, -0.04 + i * 0.02, 0.3, i, -0.6, false);

  buildWeapon(kit.right, J.handR, M, 'R');
  buildWeapon(kit.left, J.handL, M, 'L');

  // schwebende Kugeln (Magier)
  if (kit.orbs) {
    const orbs = new THREE.Group();
    orbs.position.y = 1.35;
    body.add(orbs);
    for (let i = 0; i < 3; i++) part(orbs, new THREE.IcosahedronGeometry(0.045, 1), M.glow, Math.cos(i * 2.09) * 0.42, 0, Math.sin(i * 2.09) * 0.42, 0, 0, 0, false);
    J.orbs = orbs;
  }
  // Stufen-Krone (ab Stufe 6 / Ultimate): schwebender Runenring über den Schultern
  const crown = new THREE.Group();
  crown.position.y = 1.62;
  const ring = part(crown, new THREE.TorusGeometry(0.32, 0.01, 6, 48), M.glow, 0, 0, 0, Math.PI / 2, 0, 0, false);
  for (let i = 0; i < 6; i++) part(ring, new THREE.OctahedronGeometry(0.03), M.glow, Math.cos(i * TAU / 6) * 0.32, Math.sin(i * TAU / 6) * 0.32, 0, 0, 0, 0, false);
  crown.visible = false;
  body.add(crown);
  J.crown = crown;

  root.traverse((o) => { if (o.isMesh) o.frustumCulled = true; });
  const glowMaterials = [M.glow, M.glowSoft];
  const baseGlow = [M.glow.emissiveIntensity, M.glowSoft.emissiveIntensity];
  const setLevel = (lv) => {
    const k = 1 + Math.min(1, (lv - 1) / 9) * 0.8;
    M.glow.emissiveIntensity = baseGlow[0] * k;
    M.glowSoft.emissiveIntensity = baseGlow[1] * k;
    crown.visible = lv >= 6;
  };
  setLevel(level);
  return {
    root, joints: J, height: 1.95 * S, radius: 0.45 * S * B, glowMaterials, setLevel, materials: M,
    dispose() {
      root.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
      for (const m of Object.values(M)) m.dispose();
    },
  };
}

/** Prozedurale Animation (Laufen, Rückwärts, Seitschritt, Sprung, Angriff, Zauber, Treffer, Tod, Jubel). */
export class HeroAnimator {
  constructor(rig) {
    this.rig = rig;
    this.J = rig.joints;
    this.t = 0;
    this.phase = 0;
    this.move = 0;       // geglättete Bewegungsstärke
    this.fwdS = 0; this.strS = 0; this.air = 0; this.lean = 0; this.turnS = 0;
    this.deadT = -1; this.hitT = 9;
    this.rest = {};
    for (const [k, j] of Object.entries(this.J)) if (j.isObject3D) this.rest[k] = { p: j.position.clone(), r: j.rotation.clone() };
  }
  r(name) { const j = this.J[name]; const r = this.rest[name]; if (j && r) { j.rotation.copy(r.r); j.position.copy(r.p); } return j; }

  update(dt, s = {}) {
    const J = this.J;
    this.t += dt;
    const k = (x) => 1 - Math.exp(-dt * x);
    const fwd = clamp(s.fwd || 0, -1, 1), str = clamp(s.strafe || 0, -1, 1);
    this.fwdS += (fwd - this.fwdS) * k(12);
    this.strS += (str - this.strS) * k(12);
    this.turnS += ((s.turn || 0) - this.turnS) * k(8);
    const spd = Math.min(1, Math.hypot(this.fwdS, this.strS));
    this.move += (spd - this.move) * k(10);
    this.air += ((s.airborne ? 1 : 0) - this.air) * k(14);
    const back = this.fwdS < -0.1 ? 1 : 0;
    this.phase += dt * (back ? 7.5 : 9.8) * Math.max(0.35, spd) * (back ? -1 : 1);
    if (s.hitAt != null && s.hitAt > this.lastHit) this.hitT = 0;
    this.lastHit = s.hitAt ?? this.lastHit ?? 0;
    this.hitT += dt;

    // Ausgangslage
    for (const n of Object.keys(this.rest)) this.r(n);
    const body = J.body;
    const ph = this.phase, m = this.move;
    const sw = Math.sin(ph), cw = Math.cos(ph);

    // Tod
    if (s.dead) {
      if (this.deadT < 0) this.deadT = 0;
      this.deadT += dt;
      const a = Math.min(1, this.deadT / 0.7);
      const e = 1 - Math.pow(1 - a, 3);
      body.rotation.x = -1.45 * e;
      body.position.y = -0.1 * e;
      J.spine.rotation.x = 0.2 * e;
      J.upperArmL.rotation.z = 1.1 * e; J.upperArmR.rotation.z = -1.1 * e;
      J.thighL.rotation.x = 0.3 * e; J.shinL.rotation.x = 0.5 * e;
      J.head.rotation.x = -0.4 * e;
      return;
    }
    this.deadT = -1;
    body.rotation.x = 0; body.position.y = 0;

    // Beine: Laufzyklus (vor/zurück/seitlich), im Stand leichtes Gewichtsverlagern
    const legAmp = 0.75 * m;
    const sideStep = Math.abs(this.strS) > Math.abs(this.fwdS) + 0.2;
    const hipYaw = sideStep ? 0 : Math.atan2(this.strS, Math.max(0.35, Math.abs(this.fwdS))) * 0.55 * Math.sign(this.fwdS || 1);
    J.hips.rotation.y = hipYaw;
    J.spine.rotation.y = -hipYaw * 0.7;
    if (sideStep) {
      const a = 0.32 * m;
      J.thighL.rotation.z = 0.05 + a * Math.max(0, sw * Math.sign(this.strS));
      J.thighR.rotation.z = -0.05 - a * Math.max(0, -sw * Math.sign(this.strS));
      J.shinL.rotation.x = 0.3 * m * Math.max(0, sw); J.shinR.rotation.x = 0.3 * m * Math.max(0, -sw);
    } else {
      J.thighL.rotation.x = -sw * legAmp;
      J.thighR.rotation.x = sw * legAmp;
      J.shinL.rotation.x = Math.max(0, cw) * 1.1 * m + 0.05;
      J.shinR.rotation.x = Math.max(0, -cw) * 1.1 * m + 0.05;
      J.footL.rotation.x = -0.25 * m * Math.max(0, -sw); J.footR.rotation.x = -0.25 * m * Math.max(0, sw);
    }
    // Rumpf: Wippen, Vorlage, Atmen
    const bob = Math.abs(Math.cos(ph)) * 0.05 * m;
    const breathe = Math.sin(this.t * 1.7) * 0.012 * (1 - m);
    J.hips.position.y = this.rest.hips.p.y - 0.03 * m + bob + breathe;
    this.lean += ((this.fwdS * 0.16 + (s.airborne ? 0.05 : 0)) - this.lean) * k(6);
    J.spine.rotation.x = this.lean;
    J.chest.rotation.x = this.lean * 0.4 + breathe * 2;
    J.chest.rotation.z = -this.turnS * 0.05;
    J.head.rotation.x = -this.lean * 0.6;
    // Arme: Gegenschwung
    const armAmp = 0.55 * m;
    J.upperArmL.rotation.x = sw * armAmp; J.upperArmR.rotation.x = -sw * armAmp;
    J.foreArmL.rotation.x = -0.25 - 0.35 * m; J.foreArmR.rotation.x = -0.25 - 0.35 * m;
    J.upperArmL.rotation.z = this.rest.upperArmL.r.z + 0.08 + Math.sin(this.t * 1.7) * 0.02;
    J.upperArmR.rotation.z = this.rest.upperArmR.r.z - 0.08 - Math.sin(this.t * 1.7) * 0.02;

    // Sprung
    if (this.air > 0.02) {
      const a = this.air;
      const up = clamp((s.vy || 0) / 7, -1, 1);
      J.thighL.rotation.x = lerp(J.thighL.rotation.x, -0.9, a); J.shinL.rotation.x = lerp(J.shinL.rotation.x, 1.4, a);
      J.thighR.rotation.x = lerp(J.thighR.rotation.x, -0.25 - 0.3 * up, a); J.shinR.rotation.x = lerp(J.shinR.rotation.x, 0.6, a);
      J.upperArmL.rotation.z += 0.5 * a * (0.5 + up * 0.5); J.upperArmR.rotation.z -= 0.5 * a * (0.5 + up * 0.5);
    }

    // Aktion (Angriff / Zauber / Fähigkeit)
    const act = s.action;
    if (act && act.t < 1.6) {
      const t = act.t;
      const kind = act.kind || 'attack';
      if (kind === 'cast' || kind === 'channel') {
        const e = Math.min(1, t / 0.25);
        const w = Math.sin(this.t * 6) * 0.05;
        J.upperArmL.rotation.x = -1.2 * e + w; J.upperArmR.rotation.x = -1.2 * e - w;
        J.upperArmL.rotation.z = 0.35 * e; J.upperArmR.rotation.z = -0.35 * e;
        J.foreArmL.rotation.x = -0.5 * e; J.foreArmR.rotation.x = -0.5 * e;
        J.chest.rotation.x -= 0.08 * e;
      } else if (kind === 'shoot') {
        const draw = Math.min(1, t / 0.3), rel = t > 0.32 ? Math.min(1, (t - 0.32) / 0.25) : 0;
        J.chest.rotation.y = 0.9 * (1 - rel * 0.6); J.hips.rotation.y = -0.3;
        J.upperArmL.rotation.x = -1.5 * draw; J.upperArmL.rotation.z = 0.0;
        J.upperArmR.rotation.x = -1.45 * draw; J.foreArmR.rotation.x = -1.9 * draw * (1 - rel); J.upperArmR.rotation.z = -0.4 * draw;
      } else if (kind === 'spin' || kind === 'aoe_self' || kind === 'taunt') {
        const e = Math.sin(Math.min(1, t / 0.55) * Math.PI);
        J.hips.rotation.y += Math.min(1, t / 0.5) * TAU * (kind === 'spin' ? 1 : 0);
        J.upperArmL.rotation.z = 1.3 * e; J.upperArmR.rotation.z = -1.3 * e;
        J.upperArmL.rotation.x = -0.3 * e; J.upperArmR.rotation.x = -0.3 * e;
        if (kind !== 'spin') { J.chest.rotation.x = -0.25 * e; J.head.rotation.x = -0.35 * e; J.hips.position.y -= 0.12 * e; J.thighL.rotation.x = -0.5 * e; J.thighR.rotation.x = -0.5 * e; J.shinL.rotation.x = 0.9 * e; J.shinR.rotation.x = 0.9 * e; }
      } else {
        // Nahkampfhieb: ausholen → durchziehen → zurück (hits > 1: schnelle Folge)
        const dur = 0.42;
        const tt = (t % dur) / dur;
        const wind = tt < 0.35 ? tt / 0.35 : 1 - (tt - 0.35) / 0.65;
        const strike = tt < 0.35 ? 0 : Math.sin(((tt - 0.35) / 0.65) * Math.PI);
        J.chest.rotation.y = 0.55 * wind - 0.7 * strike;
        J.upperArmR.rotation.x = -2.2 * wind + 0.4 * strike - 0.6 * (1 - wind) * strike;
        J.upperArmR.rotation.z = -0.5 * wind - 0.2;
        J.foreArmR.rotation.x = -0.9 * wind;
        J.spine.rotation.x += 0.18 * strike;
        if (kind === 'dual') { J.upperArmL.rotation.x = -1.6 * strike; J.chest.rotation.y *= 0.6; }
      }
    }
    // Leuchten beim Zaubern
    if (this.rig.glowMaterials && s.castGlow != null) {
      const g = this.rig.glowMaterials[0];
      g.userData.base ??= g.emissiveIntensity;
      g.emissiveIntensity = g.userData.base * (1 + s.castGlow * 1.6);
    }
    // Treffer-Zucken
    if (this.hitT < 0.25) { const e = Math.sin((this.hitT / 0.25) * Math.PI); J.chest.rotation.x -= 0.18 * e; J.head.rotation.x -= 0.15 * e; }
    // Betäubt: Schwanken
    if (s.stunned) { J.head.rotation.z = Math.sin(this.t * 3) * 0.25; J.chest.rotation.x += 0.3; J.upperArmL.rotation.z = 0.05; J.upperArmR.rotation.z = -0.05; }
    // Jubel
    if (s.victory) { J.upperArmR.rotation.x = -2.8; J.upperArmR.rotation.z = -0.3; J.chest.rotation.x = -0.1; }
    // Umhang & Kugeln
    if (J.cape) J.cape.rotation.x = 0.12 + this.move * 0.45 * Math.max(0, this.fwdS) + Math.sin(this.t * 2.3) * 0.04 + this.air * 0.4;
    if (J.skirt) J.skirt.rotation.x = -this.fwdS * 0.12 * this.move;
    if (J.orbs) { J.orbs.rotation.y = this.t * 1.4; J.orbs.position.y = 1.35 + Math.sin(this.t * 2) * 0.05; }
    if (J.crown && J.crown.visible) J.crown.rotation.y = -this.t * 0.8;
    if (J.halo) J.halo.rotation.z = this.t * 0.6;
  }
}
