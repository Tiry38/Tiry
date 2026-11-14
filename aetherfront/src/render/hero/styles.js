// Aetherfront – Animationsstile der Helden: Grundhaltungen und Keyframe-Clips (absolute Gelenkwinkel, Bogenmaß).
// Arme: Reihenfolge XZY → [Beugung (−=vor/hoch), Drehung um Knochenachse, Abspreizung (links +, rechts −)].
// Rumpf/Kopf: YXZ → [Neigung (+=vor), Gier (+=nach links), Rollen (+=nach rechts)].
// Clip-Skalare: crouch, hipsY, hipsZ, pitch, roll, yaw (Ganzkörper-Drehung), legFK (Beine nach FK), draw, arrow, glowL, glowR, fall.

const PI = Math.PI;
/** Pose spiegeln (L↔R, Gier/Rollen negieren) */
export function mir(p) {
  const o = {};
  for (const [k, v] of Object.entries(p)) {
    if (!Array.isArray(v)) { o[k] = v; continue; }
    const n = k.replace(/(L|R)(\d*)$/, (m, a, d) => (a === 'L' ? 'R' : 'L') + d);
    o[n] = [v[0], -v[1], -v[2]];
  }
  return o;
}
const both = (p) => ({ ...p, ...mir(p) });

// ---------------------------------------------------------------------------------------------
// Gemeinsame Clips
// ---------------------------------------------------------------------------------------------
const DEATH = {
  keys: [
    [0, {}],
    [0.16, { chest: [-0.32, 0.1, 0.06], spine: [-0.14, 0, 0], head: [-0.45, 0.2, 0], upperArmL: [-0.9, 0, 0.75], upperArmR: [-1.0, 0, -0.7], foreArmL: [-0.7, 0, 0], foreArmR: [-0.5, 0, 0], crouch: 0.1, pitch: -0.12 }],
    [0.42, { chest: [-0.25, 0.1, 0], spine: [-0.12, 0, 0], head: [-0.32, 0.2, 0], upperArmL: [-1.4, 0, 0.95], upperArmR: [-1.5, 0, -0.9], foreArmL: [-0.5, 0, 0], foreArmR: [-0.4, 0, 0], fall: 0.45, hipsZ: -0.22, pitch: -0.8, legFK: 1, thighL: [-1.0, 0, 0.1], shinL: [1.4, 0, 0], footL: [0.3, 0, 0], thighR: [-0.7, 0, -0.1], shinR: [1.0, 0, 0], footR: [0.2, 0, 0] }],
    [0.7, { chest: [-0.05, 0, 0], spine: [0, 0, 0], head: [-0.15, 0.55, 0], neck: [0, 0.2, 0], upperArmL: [0.05, 0.3, 1.15], upperArmR: [0.05, -0.2, -0.75], foreArmL: [-0.35, 0, 0], foreArmR: [-0.9, 0.4, 0], fall: 1.04, hipsZ: -0.48, pitch: -1.56, legFK: 1, thighL: [-0.55, 0, 0.15], shinL: [0.95, 0, 0], footL: [0.5, 0, 0], thighR: [0.04, 0.1, -0.12], shinR: [0.12, 0, 0], footR: [0.45, 0, 0] }],
    [0.8, { fall: 0.985, pitch: -1.5, hipsZ: -0.48, legFK: 1 }],
    [0.95, { chest: [-0.04, 0, 0], head: [-0.12, 0.6, 0], neck: [0, 0.2, 0], upperArmL: [0.08, 0.3, 1.2], upperArmR: [0.08, -0.2, -0.8], foreArmL: [-0.3, 0, 0], foreArmR: [-0.95, 0.4, 0], fall: 1, hipsZ: -0.48, pitch: -1.57, legFK: 1, thighL: [-0.6, 0, 0.16], shinL: [1.05, 0, 0], footL: [0.5, 0, 0], thighR: [0.05, 0.1, -0.12], shinR: [0.1, 0, 0], footR: [0.45, 0, 0] }],
    [2.0, { chest: [-0.04, 0, 0], head: [-0.12, 0.62, 0], neck: [0, 0.2, 0], upperArmL: [0.08, 0.3, 1.2], upperArmR: [0.08, -0.2, -0.8], foreArmL: [-0.3, 0, 0], foreArmR: [-0.95, 0.4, 0], fall: 1, hipsZ: -0.48, pitch: -1.57, legFK: 1, thighL: [-0.6, 0, 0.16], shinL: [1.05, 0, 0], footL: [0.5, 0, 0], thighR: [0.05, 0.1, -0.12], shinR: [0.1, 0, 0], footR: [0.45, 0, 0] }],
  ],
};

function castClip(o = {}) {
  const g = o.glow ?? 1;
  const up = o.up ?? 0;
  const pose1 = both({ upperArmL: [-0.95 - up, -0.55, 0.38], foreArmL: [-1.15, 0, 0], handL: [-0.35, 0, 0.25] });
  const pose2 = both({ upperArmL: [-1.2 - up, -0.7, 0.26], foreArmL: [-0.95, 0, 0], handL: [-0.6, 0, 0.3] });
  const pose3 = both({ upperArmL: [-1.48 - up * 0.5, -0.3, 0.14], foreArmL: [-0.15, 0, 0], handL: [-0.8, 0, 0.1] });
  return {
    keys: [
      [0, {}],
      [0.16, { ...pose1, ...(o.R || {}), chest: [-0.06, 0.15, 0], spine: [-0.02, 0.05, 0], head: [-0.08, -0.1, 0], glowL: 0.5 * g, glowR: 0.5 * g, ...(o.extra1 || {}) }],
      [0.36, { ...pose2, ...(o.R || {}), chest: [-0.12, 0.22, 0], spine: [-0.04, 0.08, 0], head: [-0.12, -0.15, 0], glowL: 1 * g, glowR: 1 * g, crouch: 0.03, ...(o.extra2 || {}) }],
      [0.46, { ...pose3, ...(o.R || {}), chest: [0.16, -0.12, 0], spine: [0.08, -0.04, 0], head: [0.04, 0.05, 0], glowL: 1.5 * g, glowR: 1.5 * g, wglow: 1, hipsZ: 0.03, ...(o.extra3 || {}) }],
      [0.62, { ...pose3, ...(o.R || {}), chest: [0.12, -0.1, 0], spine: [0.06, -0.03, 0], glowL: 0.7 * g, glowR: 0.7 * g, ...(o.extra3 || {}) }],
      [1, {}],
    ],
  };
}
function channelClip(o = {}) {
  const pose = both({ upperArmL: [-1.3, -0.5, 0.3], foreArmL: [-0.55, 0, 0], handL: [-0.7, 0, 0.2] });
  return {
    keys: [[0, {}], [0.08, { ...pose, ...(o.pose || {}), chest: [-0.05, 0, 0], head: [-0.05, 0, 0], glowL: 1, glowR: 1, crouch: 0.03 }], [1, { ...pose, ...(o.pose || {}), chest: [-0.05, 0, 0], head: [-0.05, 0, 0], glowL: 1, glowR: 1, crouch: 0.03 }]],
    pulse: o.pulse || { upperArmL: [0.06, 0, 0.03], upperArmR: [0.06, 0, -0.03], chest: [0.02, 0, 0] }, pulseRate: 7,
  };
}
function healClip(o = {}) {
  const up = both({ upperArmL: [-2.35, -0.2, 0.6], foreArmL: [-0.35, 0, 0], handL: [0.4, 0, -0.2] });
  return {
    keys: [[0, {}], [0.22, { ...both({ upperArmL: [-0.55, -0.6, 0.3], foreArmL: [-1.5, 0, 0], handL: [0.3, 0, 0] }), ...(o.R1 || {}), chest: [0.12, 0, 0], head: [0.2, 0, 0], crouch: 0.06, glowL: 0.6, glowR: 0.6 }],
      [0.46, { ...up, ...(o.R2 || {}), chest: [-0.22, 0, 0], spine: [-0.08, 0, 0], head: [-0.38, 0, 0], glowL: 1.5, glowR: 1.5, wglow: 1, hipsY: 0.025 }],
      [0.75, { ...up, ...(o.R2 || {}), chest: [-0.16, 0, 0], spine: [-0.05, 0, 0], head: [-0.28, 0, 0], glowL: 0.8, glowR: 0.8 }], [1, {}]],
  };
}
function summonClip(o = {}) {
  return {
    keys: [[0, {}], [0.3, { ...both({ upperArmL: [-2.5, -0.3, 0.35], foreArmL: [-0.4, 0, 0], handL: [0.2, 0, 0] }), ...(o.R1 || {}), chest: [-0.2, 0, 0], head: [-0.25, 0, 0], glowL: 1, glowR: 1, hipsY: 0.03 }],
      [0.55, { ...both({ upperArmL: [-0.7, -0.4, 0.3], foreArmL: [-0.3, 0, 0], handL: [-0.6, 0, 0] }), ...(o.R2 || {}), chest: [0.35, 0, 0], spine: [0.2, 0, 0], head: [0.05, 0, 0], crouch: 0.16, glowL: 1.4, glowR: 1.4 }],
      [0.75, { ...both({ upperArmL: [-0.75, -0.4, 0.35], foreArmL: [-0.4, 0, 0], handL: [-0.5, 0, 0] }), ...(o.R2 || {}), chest: [0.28, 0, 0], spine: [0.15, 0, 0], crouch: 0.12, glowL: 0.8, glowR: 0.8 }], [1, {}]],
  };
}
function spinClip(o = {}) {
  const arms = both({ upperArmL: [-0.35, -0.2, 1.25], foreArmL: [-0.35, 0, 0], handL: [0, 0, 0] });
  return {
    keys: [[0, {}], [0.12, { ...arms, ...(o.arms || {}), chest: [0.1, 0.45, 0], spine: [0.08, 0.2, 0], crouch: 0.1, yaw: -0.4 }],
      [0.45, { ...arms, ...(o.arms || {}), chest: [0.08, -0.2, 0], spine: [0.06, -0.1, 0], crouch: 0.12, yaw: PI * 1.0 }],
      [0.8, { ...arms, ...(o.arms || {}), chest: [0.1, -0.35, 0], spine: [0.06, -0.15, 0], crouch: 0.1, yaw: PI * 2 }],
      [1, { yaw: PI * 2 }]],
  };
}
function slamClip(o = {}) {
  const raise = o.raise || both({ upperArmL: [-2.7, -0.2, 0.25], foreArmL: [-0.6, 0, 0], handL: [-0.2, 0, 0] });
  const hit = o.hit || both({ upperArmL: [-0.9, -0.3, 0.3], foreArmL: [-0.3, 0, 0], handL: [0.3, 0, 0] });
  return {
    keys: [[0, {}], [0.3, { ...raise, chest: [-0.3, 0, 0], spine: [-0.15, 0, 0], head: [-0.15, 0, 0], hipsY: 0.12, legFK: 0.6, thighL: [-0.9, 0, 0.1], shinL: [1.2, 0, 0], thighR: [-0.2, 0, -0.1], shinR: [0.6, 0, 0] }],
      [0.46, { ...hit, chest: [0.45, 0, 0], spine: [0.35, 0, 0], head: [-0.2, 0, 0], crouch: 0.26, pitch: 0.15 }],
      [0.72, { ...hit, chest: [0.4, 0, 0], spine: [0.3, 0, 0], head: [-0.15, 0, 0], crouch: 0.22, pitch: 0.12 }], [1, {}]],
  };
}
function leapClip(o = {}) {
  return {
    keys: [[0, {}], [0.14, { crouch: 0.17, spine: [0.3, 0, 0], ...both({ upperArmL: [0.4, 0, 0.25], foreArmL: [-0.5, 0, 0] }), ...(o.arms0 || {}) }],
      [0.3, { hipsY: 0.12, legFK: 1, thighL: [-1.2, 0, 0.1], shinL: [1.7, 0, 0], footL: [0.4, 0, 0], thighR: [-0.5, 0, -0.1], shinR: [1.5, 0, 0], footR: [0.5, 0, 0], spine: [0.15, 0, 0], ...both({ upperArmL: [-1.6, -0.2, 0.5], foreArmL: [-0.6, 0, 0] }), ...(o.arms1 || {}) }],
      [0.7, { hipsY: 0.08, legFK: 1, thighL: [-0.8, 0, 0.1], shinL: [0.9, 0, 0], footL: [0.1, 0, 0], thighR: [-0.4, 0, -0.1], shinR: [0.8, 0, 0], footR: [0.1, 0, 0], spine: [0.1, 0, 0], ...both({ upperArmL: [-1.2, -0.2, 0.7], foreArmL: [-0.4, 0, 0] }), ...(o.arms1 || {}) }],
      [0.84, { crouch: 0.2, spine: [0.35, 0, 0], ...both({ upperArmL: [-0.3, 0, 0.5], foreArmL: [-0.5, 0, 0] }), ...(o.arms2 || {}) }], [1, {}]],
  };
}
function handShoot(side = 'R', o = {}) {
  const S = (p) => (side === 'R' ? p : mir(p));
  return {
    keys: [[0, {}], [0.32, { ...S({ upperArmR: [-0.55, 0.4, -0.55], foreArmR: [-2.0, 0, 0], handR: [-0.3, 0, 0], chest: [0, -0.32, 0], spine: [0, -0.1, 0] }), head: [0, 0, 0], glowR: side === 'R' ? 1 : 0, glowL: side === 'L' ? 1 : 0 }],
      [0.5, { ...S({ upperArmR: [-1.5, 0.15, -0.12], foreArmR: [-0.12, 0, 0], handR: [-0.7, 0, 0], chest: [0.08, 0.3, 0], spine: [0.04, 0.1, 0] }), glowR: side === 'R' ? 1.4 : 0, glowL: side === 'L' ? 1.4 : 0 }],
      [0.7, { ...S({ upperArmR: [-1.4, 0.15, -0.15], foreArmR: [-0.2, 0, 0], handR: [-0.5, 0, 0], chest: [0.06, 0.25, 0] }), glowR: side === 'R' ? 0.4 : 0, glowL: side === 'L' ? 0.4 : 0 }], [1, {}]],
  };
}
function staffStrike(side = 'R') {
  const S = (p) => (side === 'R' ? p : mir(p));
  return [
    { keys: [[0, {}], [0.3, S({ upperArmR: [-1.6, 0.3, -0.6], foreArmR: [-1.4, 0, 0], handR: [-0.4, 0, 0], chest: [0, -0.4, 0], spine: [0, -0.15, 0] })], [0.5, S({ upperArmR: [-0.9, 0.9, -0.2], foreArmR: [-0.6, 0, 0], handR: [0.4, 0, 0], chest: [0.15, 0.4, 0], spine: [0.08, 0.15, 0] })], [0.7, S({ upperArmR: [-0.7, 1.0, -0.15], foreArmR: [-0.7, 0, 0], chest: [0.1, 0.45, 0] })], [1, {}]] },
    { keys: [[0, {}], [0.3, S({ upperArmR: [-0.3, 0.2, -0.3], foreArmR: [-1.8, 0, 0], chest: [0, -0.2, 0], crouch: 0.04 })], [0.5, S({ upperArmR: [-1.35, 0.1, -0.1], foreArmR: [-0.4, 0, 0], handR: [-0.9, 0, 0], chest: [0.15, 0.25, 0], spine: [0.1, 0.1, 0] })], [0.7, S({ upperArmR: [-1.3, 0.1, -0.1], foreArmR: [-0.5, 0, 0], handR: [-0.7, 0, 0], chest: [0.1, 0.2, 0] })], [1, {}]] },
  ];
}
const FEET = (lx, lz, ly, rx, rz, ry) => ({ L: [lx, lz, ly], R: [rx, rz, ry] });

// ---------------------------------------------------------------------------------------------
// Stile
// ---------------------------------------------------------------------------------------------
const knight = {
  feet: FEET(0.14, 0.1, 0.12, -0.13, -0.11, -0.4), crouch: 0.04, swing: { L: 0.15, R: 0.55 }, bounce: 0.75, leanK: 0.8, liftK: 0.9, stride: 1.0,
  idle: { spine: [0.04, -0.08, 0], chest: [0.03, -0.12, 0], head: [-0.02, 0.2, 0], neck: [0, 0, 0],
    upperArmL: [-0.22, -0.55, 0.3], foreArmL: [-1.35, 0, 0], handL: [0, 0, 0],
    upperArmR: [-0.18, 0.18, -0.24], foreArmR: [-0.75, 0, 0], handR: [0.35, 0, 0] },
  run: { upperArmL: [-0.12, -0.25, 0.26], foreArmL: [-1.5, 0, 0], upperArmR: [-0.05, 0.2, -0.2], foreArmR: [-0.85, 0, 0], handR: [0.5, 0, 0] },
  melee: [
    { keys: [[0, {}], [0.3, { chest: [-0.05, -0.55, 0], spine: [0, -0.2, 0], upperArmR: [-2.3, 0.2, -0.6], foreArmR: [-1.3, 0, 0], handR: [-0.2, 0, 0], head: [0, 0.45, 0] }],
      [0.5, { chest: [0.18, 0.5, 0], spine: [0.1, 0.2, 0], upperArmR: [-1.0, 0.8, -0.25], foreArmR: [-0.25, 0, 0], handR: [0.5, 0, 0], head: [0.05, -0.4, 0], crouch: 0.05 }],
      [0.66, { chest: [0.15, 0.6, 0], spine: [0.08, 0.22, 0], upperArmR: [-0.65, 1.2, -0.05], foreArmR: [-0.55, 0, 0], handR: [0.6, 0, 0], head: [0.05, -0.45, 0], crouch: 0.05 }], [1, {}]] },
    { keys: [[0, {}], [0.3, { chest: [0.0, 0.5, 0], spine: [0, 0.18, 0], upperArmR: [-1.4, 1.3, -0.1], foreArmR: [-1.7, 0, 0], handR: [0.2, 0, 0], head: [0, -0.4, 0] }],
      [0.52, { chest: [0.1, -0.55, 0], spine: [0.05, -0.22, 0], upperArmR: [-1.45, -0.3, -0.9], foreArmR: [-0.15, 0, 0], handR: [-0.2, 0, 0], head: [0, 0.45, 0], crouch: 0.04 }],
      [0.68, { chest: [0.08, -0.62, 0], spine: [0.05, -0.25, 0], upperArmR: [-1.2, -0.5, -1.1], foreArmR: [-0.3, 0, 0], handR: [-0.3, 0, 0], head: [0, 0.5, 0] }], [1, {}]] },
    { keys: [[0, {}], [0.3, { chest: [0, 0.3, 0], upperArmL: [-0.2, -0.9, 0.3], foreArmL: [-1.6, 0, 0], crouch: 0.06 }],
      [0.48, { chest: [0.2, -0.35, 0], spine: [0.1, -0.1, 0], upperArmL: [-1.1, -1.0, 0.1], foreArmL: [-1.25, 0, 0], hipsZ: 0.08, crouch: 0.05 }],
      [0.65, { chest: [0.18, -0.3, 0], spine: [0.1, -0.1, 0], upperArmL: [-1.05, -1.0, 0.12], foreArmL: [-1.3, 0, 0], hipsZ: 0.06 }], [1, {}]] },
  ],
  victory: { loop: true, rate: 0.45, keys: [[0, { upperArmR: [-2.95, 0.3, -0.12], foreArmR: [-0.25, 0, 0], handR: [-0.1, 0, 0], upperArmL: [-0.15, -0.35, 0.35], foreArmL: [-1.2, 0, 0], chest: [-0.15, 0, 0], head: [-0.3, 0, 0], spine: [-0.05, 0, 0] }],
    [0.5, { upperArmR: [-3.05, 0.3, -0.08], foreArmR: [-0.1, 0, 0], handR: [-0.05, 0, 0], upperArmL: [-0.15, -0.35, 0.4], foreArmL: [-1.25, 0, 0], chest: [-0.2, 0, 0], head: [-0.35, 0, 0], spine: [-0.06, 0, 0], hipsY: 0.02 }],
    [1, { upperArmR: [-2.95, 0.3, -0.12], foreArmR: [-0.25, 0, 0], handR: [-0.1, 0, 0], upperArmL: [-0.15, -0.35, 0.35], foreArmL: [-1.2, 0, 0], chest: [-0.15, 0, 0], head: [-0.3, 0, 0], spine: [-0.05, 0, 0] }]] },
};
knight.shoot = knight.melee[2];
knight.cast = { keys: [[0, {}], [0.3, { upperArmR: [-2.8, 0.2, -0.2], foreArmR: [-0.3, 0, 0], handR: [0, 0, 0], chest: [-0.15, 0, 0], head: [-0.2, 0, 0], glowR: 1 }], [1, { upperArmR: [-2.9, 0.2, -0.15], foreArmR: [-0.2, 0, 0], chest: [-0.18, 0, 0], head: [-0.22, 0, 0], glowR: 1.2 }]] };
knight.channel = { keys: [[0, {}], [0.1, { upperArmL: [-0.4, -1.1, 0.15], foreArmL: [-1.5, 0, 0], crouch: 0.08, chest: [0.1, -0.2, 0] }], [1, { upperArmL: [-0.4, -1.1, 0.15], foreArmL: [-1.5, 0, 0], crouch: 0.08, chest: [0.1, -0.2, 0] }]], pulse: { chest: [0.02, 0, 0] } };
knight.slam = slamClip({ raise: { upperArmR: [-2.9, 0.4, -0.15], foreArmR: [-0.9, 0, 0], handR: [-0.5, 0, 0], upperArmL: [-0.6, -0.8, 0.5], foreArmL: [-1.3, 0, 0] }, hit: { upperArmR: [-1.0, 0.6, -0.15], foreArmR: [-0.1, 0, 0], handR: [0.6, 0, 0], upperArmL: [-0.5, -0.9, 0.45], foreArmL: [-1.2, 0, 0] } });
knight.spin = spinClip({ arms: { upperArmL: [-0.4, -0.9, 0.3], foreArmL: [-1.4, 0, 0] } });
knight.leap = leapClip({ arms1: { upperArmR: [-2.5, 0.3, -0.2], foreArmR: [-0.6, 0, 0] } });
knight.heal = { keys: [[0, {}], [0.4, { upperArmR: [-2.8, 0.2, -0.25], foreArmR: [-0.3, 0, 0], upperArmL: [-0.6, -0.9, 0.5], chest: [-0.2, 0, 0], head: [-0.3, 0, 0], glowR: 1 }], [0.8, { upperArmR: [-2.8, 0.2, -0.25], foreArmR: [-0.3, 0, 0], upperArmL: [-0.6, -0.9, 0.5], chest: [-0.2, 0, 0], head: [-0.3, 0, 0], glowR: 1 }], [1, {}]] };
knight.summon = { keys: [[0, {}], [0.35, { upperArmR: [-2.9, 0.2, -0.2], foreArmR: [-0.3, 0, 0], chest: [-0.25, 0, 0], head: [-0.35, 0, 0], upperArmL: [-0.2, -0.4, 0.6], foreArmL: [-1.0, 0, 0] }], [0.55, { upperArmR: [-1.4, 0.5, -0.3], foreArmR: [-0.2, 0, 0], handR: [0.8, 0, 0], chest: [0.3, 0, 0], crouch: 0.12 }], [0.8, { upperArmR: [-1.3, 0.5, -0.3], foreArmR: [-0.2, 0, 0], handR: [0.8, 0, 0], chest: [0.25, 0, 0], crouch: 0.1 }], [1, {}]] };

// Waldläuferin: Bogen links
const bowPose = (draw, rel = false) => ({
  chest: [0.0, -1.12, 0.0], spine: [0.02, -0.32, 0], neck: [0, 0.42, 0], head: [0.04, 0.95, 0.05],
  upperArmL: [-0.08, 1.45, 1.42], foreArmL: [0.0, 0, 0], handL: [0, 0, 0.12],
  upperArmR: rel ? [0.15, 0, -1.78] : [-0.12 + 0.05 * draw, 0.0, -1.42 - 0.2 * draw], foreArmR: rel ? [-1.4, 0, 0] : [-2.55 - 0.3 * draw, 0, 0], handR: [0, 0, 0],
});
const ranger = {
  feet: FEET(0.13, 0.06, 0.15, -0.12, -0.08, -0.25), crouch: 0.03, swing: { L: 0.5, R: 0.9 }, bounce: 1.05, leanK: 1.15, liftK: 1.1, stride: 1.02, twist: 1.1,
  idle: { spine: [0.02, 0, 0], chest: [0.0, 0.05, 0], head: [0, -0.05, 0],
    upperArmL: [-0.18, -0.25, 0.14], foreArmL: [-1.25, 0, 0], handL: [0.15, 0, -0.25],
    upperArmR: [0.04, 0.15, -0.12], foreArmR: [-0.45, 0, 0], handR: [0.15, 0, 0] },
  run: { upperArmL: [-0.1, -0.2, 0.2], foreArmL: [-1.35, 0, 0], handL: [0.2, 0, -0.3], upperArmR: [0.05, 0.1, -0.18], foreArmR: [-1.4, 0, 0] },
  shoot: { keys: [[0, {}], [0.2, { ...bowPose(0), draw: 0.1, arrow: 1 }], [0.62, { ...bowPose(1), draw: 1, arrow: 1 }], [0.68, { ...bowPose(1), draw: 1, arrow: 1 }], [0.72, { ...bowPose(0, true), draw: 0, arrow: 0 }], [0.86, { ...bowPose(0, true), draw: 0, arrow: 0 }], [1, {}]] },
  cast: { keys: [[0, {}], [0.25, { ...bowPose(0.3), draw: 0.3, arrow: 1, glowR: 0.5 }], [0.7, { ...bowPose(1), draw: 1, arrow: 1, glowR: 1 }], [1, { ...bowPose(1), draw: 1, arrow: 1, glowR: 1.2 }]] },
  victory: { loop: true, rate: 0.45, keys: [[0, { upperArmL: [-2.9, 0, 0.15], foreArmL: [-0.3, 0, 0], handL: [0, 0, 0], upperArmR: [0.25, 0.5, -0.45], foreArmR: [-1.7, 0, 0], chest: [-0.12, 0, 0], head: [-0.25, 0, 0] }],
    [0.5, { upperArmL: [-3.0, 0, 0.1], foreArmL: [-0.15, 0, 0], upperArmR: [0.25, 0.5, -0.5], foreArmR: [-1.75, 0, 0], chest: [-0.16, 0, 0], head: [-0.3, 0, 0], hipsY: 0.02 }],
    [1, { upperArmL: [-2.9, 0, 0.15], foreArmL: [-0.3, 0, 0], handL: [0, 0, 0], upperArmR: [0.25, 0.5, -0.45], foreArmR: [-1.7, 0, 0], chest: [-0.12, 0, 0], head: [-0.25, 0, 0] }]] },
};
{
  // Pfeilregen: Bogen schräg nach oben, mehrfaches Spannen
  const up = (d) => ({ ...bowPose(d), chest: [-0.35, -1.1, 0], spine: [-0.15, -0.3, 0], head: [-0.4, 0.95, 0.05], upperArmL: [-0.08, 1.45, 2.1] });
  const keys = [[0, {}]];
  for (let i = 0; i < 6; i++) { const b = 0.08 + i * 0.15; keys.push([b, { ...up(0.2), draw: 0.15, arrow: 1 }], [b + 0.1, { ...up(1), draw: 1, arrow: 1 }], [b + 0.13, { ...up(0), draw: 0, arrow: 0 }]); }
  keys.push([1, { ...up(0.2), draw: 0.1, arrow: 0 }]);
  ranger.channel = { keys };
  ranger.melee = [{ keys: [[0, {}], [0.3, { upperArmL: [-1.2, -0.6, 0.6], foreArmL: [-1.2, 0, 0], chest: [0, 0.4, 0] }], [0.5, { upperArmL: [-1.2, -1.2, 0.1], foreArmL: [-0.4, 0, 0], chest: [0.15, -0.45, 0], crouch: 0.04 }], [0.7, { upperArmL: [-1.1, -1.2, 0.1], foreArmL: [-0.5, 0, 0], chest: [0.1, -0.4, 0] }], [1, {}]] }];
  ranger.leap = { keys: [[0, {}], [0.12, { crouch: 0.15, spine: [0.3, 0, 0] }], [0.35, { hipsY: 0.15, pitch: -1.6, legFK: 1, thighL: [-1.4, 0, 0.1], shinL: [2.0, 0, 0], thighR: [-1.2, 0, -0.1], shinR: [1.9, 0, 0], ...both({ upperArmL: [-1.0, 0, 0.4] }), spine: [0.3, 0, 0], chest: [0.2, 0, 0] }],
    [0.6, { hipsY: 0.15, pitch: -4.6, legFK: 1, thighL: [-1.4, 0, 0.1], shinL: [2.0, 0, 0], thighR: [-1.2, 0, -0.1], shinR: [1.9, 0, 0], spine: [0.3, 0, 0], chest: [0.2, 0, 0] }],
    [0.8, { crouch: 0.18, pitch: -6.28, spine: [0.3, 0, 0], ...both({ upperArmL: [-0.4, 0, 0.6] }) }], [1, { pitch: -6.28 }]] };
  ranger.leap.wrapPitch = true;
  ranger.spin = spinClip({});
  ranger.slam = slamClip({});
  ranger.heal = healClip({});
  ranger.summon = summonClip({});
}

// Schattentänzer: zwei Klingen
const dual = {
  feet: FEET(0.16, 0.1, 0.25, -0.15, -0.12, -0.45), crouch: 0.085, swing: { L: 0.6, R: 0.6 }, bounce: 1.1, leanK: 1.35, liftK: 1.15, stride: 1.05, twist: 1.2,
  idle: { spine: [0.14, -0.1, 0], chest: [0.1, -0.12, 0], head: [-0.18, 0.2, 0],
    upperArmL: [-0.55, -0.35, 0.32], foreArmL: [-1.25, 0, 0], handL: [0.35, 0, 0.15],
    upperArmR: [-0.3, 0.25, -0.3], foreArmR: [-1.0, 0, 0], handR: [0.55, 0, -0.1] },
  run: { spine: [0.1, 0, 0], upperArmL: [0.15, -0.2, 0.25], foreArmL: [-1.1, 0, 0], handL: [0.9, 0, 0], upperArmR: [0.15, 0.2, -0.25], foreArmR: [-1.1, 0, 0], handR: [0.9, 0, 0] },
  melee: [
    { keys: [[0, {}], [0.28, { chest: [0.05, -0.5, 0], spine: [0.1, -0.2, 0], upperArmR: [-1.9, 0.4, -0.7], foreArmR: [-1.2, 0, 0], handR: [-0.3, 0, 0], crouch: 0.03 }],
      [0.45, { chest: [0.2, 0.5, 0], spine: [0.15, 0.2, 0], upperArmR: [-0.9, 1.2, -0.15], foreArmR: [-0.35, 0, 0], handR: [0.6, 0, 0], crouch: 0.1, hipsZ: 0.05 }],
      [0.62, { chest: [0.18, 0.55, 0], spine: [0.12, 0.2, 0], upperArmR: [-0.7, 1.3, -0.1], foreArmR: [-0.5, 0, 0], handR: [0.7, 0, 0], crouch: 0.1 }], [1, {}]] },
    { keys: [[0, {}], [0.28, { chest: [0.05, 0.5, 0], spine: [0.1, 0.2, 0], upperArmL: [-1.9, -0.4, 0.7], foreArmL: [-1.2, 0, 0], handL: [-0.3, 0, 0], crouch: 0.03 }],
      [0.45, { chest: [0.2, -0.5, 0], spine: [0.15, -0.2, 0], upperArmL: [-0.9, -1.2, 0.15], foreArmL: [-0.35, 0, 0], handL: [0.6, 0, 0], crouch: 0.1, hipsZ: 0.05 }],
      [0.62, { chest: [0.18, -0.55, 0], spine: [0.12, -0.2, 0], upperArmL: [-0.7, -1.3, 0.1], foreArmL: [-0.5, 0, 0], handL: [0.7, 0, 0], crouch: 0.1 }], [1, {}]] },
    { keys: [[0, {}], [0.3, { ...both({ upperArmL: [-2.2, -0.3, 0.6], foreArmL: [-1.0, 0, 0], handL: [-0.4, 0, 0] }), chest: [-0.15, 0, 0], hipsY: 0.03 }],
      [0.48, { ...both({ upperArmL: [-0.8, -1.0, -0.05], foreArmL: [-0.2, 0, 0], handL: [0.7, 0, 0] }), chest: [0.35, 0, 0], spine: [0.2, 0, 0], crouch: 0.14 }],
      [0.66, { ...both({ upperArmL: [-0.7, -1.1, -0.05], foreArmL: [-0.3, 0, 0], handL: [0.7, 0, 0] }), chest: [0.3, 0, 0], spine: [0.15, 0, 0], crouch: 0.12 }], [1, {}]] },
  ],
  victory: { loop: true, rate: 0.5, keys: [[0, { ...both({ upperArmL: [-0.5, -0.5, 0.9], foreArmL: [-0.6, 0, 0], handL: [0.8, 0, 0] }), chest: [-0.05, 0, 0], head: [-0.2, 0, 0] }],
    [0.5, { ...both({ upperArmL: [-0.55, -0.5, 1.0], foreArmL: [-0.5, 0, 0], handL: [0.9, 0, 0] }), chest: [-0.1, 0, 0], head: [-0.25, 0, 0], hipsY: 0.015 }],
    [1, { ...both({ upperArmL: [-0.5, -0.5, 0.9], foreArmL: [-0.6, 0, 0], handL: [0.8, 0, 0] }), chest: [-0.05, 0, 0], head: [-0.2, 0, 0] }]] },
};
dual.spin = spinClip({ arms: both({ upperArmL: [-0.2, -0.6, 1.35], foreArmL: [-0.2, 0, 0], handL: [0.6, 0, 0] }) });
dual.shoot = handShoot('R');
dual.cast = castClip({ glow: 0.6, extra2: { crouch: 0.08 } });
dual.channel = channelClip({});
dual.slam = slamClip({ raise: both({ upperArmL: [-2.6, -0.3, 0.4], foreArmL: [-0.8, 0, 0], handL: [-0.4, 0, 0] }), hit: both({ upperArmL: [-0.4, -0.8, 0.2], foreArmL: [-0.5, 0, 0], handL: [1.0, 0, 0] }) });
dual.leap = leapClip({});
dual.heal = healClip({});
dual.summon = summonClip({});

// Magierin (schwebender Stab rechts), Priesterin (Laternenstab rechts), Druidin (Stab links), Hexer (Hände)
const casterBase = {
  crouch: 0.02, bounce: 0.9, leanK: 0.9, liftK: 0.85, stride: 0.98,
};
const mage = {
  ...casterBase, feet: FEET(0.11, 0.06, 0.2, -0.11, -0.06, -0.15), swing: { L: 0.7, R: 0.35 },
  idle: { spine: [0.0, 0, 0], chest: [-0.02, 0.05, 0], head: [-0.03, -0.05, 0.03],
    upperArmL: [-0.3, -0.45, 0.3], foreArmL: [-1.25, 0, 0], handL: [0.15, 0.4, -0.35],
    upperArmR: [-0.12, 0.35, -0.3], foreArmR: [-1.4, 0, 0], handR: [0.05, 0, 0] },
  run: { upperArmL: [0.0, -0.2, 0.25], foreArmL: [-1.2, 0, 0], handL: [0.1, 0, 0], upperArmR: [-0.1, 0.3, -0.3], foreArmR: [-1.45, 0, 0] },
  castHands: 1,
};
mage.cast = castClip({ glow: 1, up: 0.15, R: { upperArmR: [-0.9, 0.4, -0.45], foreArmR: [-1.5, 0, 0] } });
mage.shoot = handShoot('L');
mage.channel = channelClip({ pose: { upperArmR: [-0.6, 0.3, -0.4], foreArmR: [-1.5, 0, 0] } });
mage.melee = staffStrike('R');
mage.spin = spinClip({});
mage.slam = slamClip({});
mage.leap = leapClip({});
mage.heal = healClip({});
mage.summon = summonClip({});
mage.victory = { loop: true, rate: 0.4, keys: [[0, { upperArmR: [-2.6, 0.3, -0.25], foreArmR: [-1.0, 0, 0], upperArmL: [-1.5, -0.3, 0.9], foreArmL: [-0.4, 0, 0], handL: [-0.3, 0.5, 0], chest: [-0.12, 0, 0], head: [-0.25, 0, 0], glowL: 1 }],
  [0.5, { upperArmR: [-2.7, 0.3, -0.22], foreArmR: [-0.9, 0, 0], upperArmL: [-1.6, -0.3, 1.0], foreArmL: [-0.3, 0, 0], handL: [-0.3, 0.5, 0], chest: [-0.16, 0, 0], head: [-0.3, 0, 0], glowL: 1.3, hipsY: 0.02 }],
  [1, { upperArmR: [-2.6, 0.3, -0.25], foreArmR: [-1.0, 0, 0], upperArmL: [-1.5, -0.3, 0.9], foreArmL: [-0.4, 0, 0], handL: [-0.3, 0.5, 0], chest: [-0.12, 0, 0], head: [-0.25, 0, 0], glowL: 1 }]] };

const priest = {
  ...casterBase, feet: FEET(0.11, 0.05, 0.15, -0.11, -0.05, -0.15), swing: { L: 0.7, R: 0.25 },
  idle: { spine: [0.0, 0, 0], chest: [-0.02, 0.0, 0], head: [0.04, 0, 0],
    upperArmL: [-0.22, -0.35, 0.18], foreArmL: [-1.1, 0, 0], handL: [0.0, 0.6, -0.2],
    upperArmR: [-0.12, 0.3, -0.24], foreArmR: [-1.45, 0, 0], handR: [0.05, 0, 0] },
  run: { upperArmL: [0.0, -0.2, 0.2], foreArmL: [-1.2, 0, 0], upperArmR: [-0.08, 0.3, -0.26], foreArmR: [-1.5, 0, 0] },
  castHands: 1,
};
priest.cast = castClip({ glow: 1, R: { upperArmR: [-0.5, 0.3, -0.35], foreArmR: [-1.7, 0, 0] }, extra2: { head: [-0.25, 0, 0] } });
priest.shoot = { keys: [[0, {}], [0.3, { upperArmR: [-1.2, 0.4, -0.4], foreArmR: [-1.4, 0, 0], chest: [0, -0.2, 0], glowR: 1 }], [0.5, { upperArmR: [-1.4, 0.1, -0.2], foreArmR: [-0.7, 0, 0], handR: [-0.6, 0, 0], chest: [0.1, 0.2, 0], glowR: 1.4 }], [0.7, { upperArmR: [-1.3, 0.1, -0.2], foreArmR: [-0.8, 0, 0], handR: [-0.5, 0, 0], glowR: 0.4 }], [1, {}]] };
priest.heal = healClip({ R2: { upperArmR: [-2.9, 0.3, -0.15], foreArmR: [-0.6, 0, 0] } });
priest.channel = channelClip({ pose: { upperArmR: [-2.4, 0.3, -0.2], foreArmR: [-0.7, 0, 0], head: [-0.15, 0, 0] } });
priest.melee = staffStrike('R');
priest.summon = summonClip({ R1: { upperArmR: [-2.9, 0.3, -0.15], foreArmR: [-0.5, 0, 0] } });
priest.spin = spinClip({});
priest.slam = slamClip({});
priest.leap = leapClip({});
priest.victory = { loop: true, rate: 0.4, keys: [[0, { upperArmR: [-2.8, 0.3, -0.18], foreArmR: [-0.6, 0, 0], upperArmL: [-2.2, -0.2, 0.7], foreArmL: [-0.3, 0, 0], handL: [0.4, 0, 0], chest: [-0.15, 0, 0], head: [-0.3, 0, 0], glowL: 1 }],
  [0.5, { upperArmR: [-2.9, 0.3, -0.15], foreArmR: [-0.5, 0, 0], upperArmL: [-2.3, -0.2, 0.75], foreArmL: [-0.25, 0, 0], handL: [0.4, 0, 0], chest: [-0.2, 0, 0], head: [-0.35, 0, 0], glowL: 1.3, hipsY: 0.02 }],
  [1, { upperArmR: [-2.8, 0.3, -0.18], foreArmR: [-0.6, 0, 0], upperArmL: [-2.2, -0.2, 0.7], foreArmL: [-0.3, 0, 0], handL: [0.4, 0, 0], chest: [-0.15, 0, 0], head: [-0.3, 0, 0], glowL: 1 }]] };

const hammer = {
  feet: FEET(0.15, 0.08, 0.2, -0.15, -0.08, -0.35), crouch: 0.045, swing: { L: 0.75, R: 0.1 }, bounce: 0.7, leanK: 1.0, liftK: 0.8, stride: 0.82, twist: 0.8, jumpLead: 'R',
  idle: { spine: [0.05, 0.05, 0], chest: [0.03, 0.08, 0], head: [0, -0.08, 0],
    upperArmL: [-0.05, -0.2, 0.22], foreArmL: [-0.6, 0, 0], handL: [0.15, 0, 0],
    upperArmR: [-0.4, 0.2, -0.55], foreArmR: [-2.0, 0, 0], handR: [0.1, 0, -0.45] },
  run: { upperArmL: [0.0, -0.2, 0.25], foreArmL: [-1.3, 0, 0], upperArmR: [-0.38, 0.2, -0.55], foreArmR: [-2.05, 0, 0], handR: [0.1, 0, -0.45] },
  melee: [
    { keys: [[0, {}], [0.32, { upperArmR: [-2.9, 0.3, -0.25], foreArmR: [-1.4, 0, 0], handR: [-0.3, 0, 0], upperArmL: [-2.4, -0.4, 0.2], foreArmL: [-1.2, 0, 0], chest: [-0.3, 0, 0], spine: [-0.12, 0, 0], head: [-0.1, 0, 0], hipsY: 0.02 }],
      [0.48, { upperArmR: [-1.1, 0.5, -0.15], foreArmR: [-0.2, 0, 0], handR: [0.6, 0, 0], upperArmL: [-1.0, -0.6, 0.1], foreArmL: [-0.5, 0, 0], chest: [0.45, 0, 0], spine: [0.3, 0, 0], head: [-0.25, 0, 0], crouch: 0.15 }],
      [0.68, { upperArmR: [-1.0, 0.5, -0.15], foreArmR: [-0.25, 0, 0], handR: [0.6, 0, 0], upperArmL: [-0.9, -0.6, 0.1], foreArmL: [-0.5, 0, 0], chest: [0.4, 0, 0], spine: [0.25, 0, 0], head: [-0.2, 0, 0], crouch: 0.13 }], [1, {}]] },
    { keys: [[0, {}], [0.3, { upperArmR: [-1.3, -0.3, -1.3], foreArmR: [-0.6, 0, 0], handR: [0, 0, 0], chest: [0, -0.7, 0], spine: [0, -0.3, 0], head: [0, 0.6, 0], crouch: 0.06 }],
      [0.5, { upperArmR: [-1.5, 1.1, -0.2], foreArmR: [-0.2, 0, 0], handR: [0.3, 0, 0], chest: [0.1, 0.7, 0], spine: [0.05, 0.3, 0], head: [0, -0.5, 0], crouch: 0.08 }],
      [0.68, { upperArmR: [-1.3, 1.3, -0.15], foreArmR: [-0.4, 0, 0], handR: [0.4, 0, 0], chest: [0.08, 0.8, 0], spine: [0.04, 0.35, 0], head: [0, -0.5, 0], crouch: 0.07 }], [1, {}]] },
  ],
  victory: { loop: true, rate: 0.45, keys: [[0, { upperArmR: [-2.9, 0.3, -0.15], foreArmR: [-0.4, 0, 0], handR: [0, 0, 0], upperArmL: [-1.7, -0.3, 0.6], foreArmL: [-1.6, 0, 0], chest: [-0.15, 0, 0], head: [-0.25, 0, 0] }],
    [0.5, { upperArmR: [-3.0, 0.3, -0.12], foreArmR: [-0.3, 0, 0], upperArmL: [-1.9, -0.3, 0.6], foreArmL: [-1.9, 0, 0], chest: [-0.2, 0, 0], head: [-0.3, 0, 0], hipsY: 0.025 }],
    [1, { upperArmR: [-2.9, 0.3, -0.15], foreArmR: [-0.4, 0, 0], handR: [0, 0, 0], upperArmL: [-1.7, -0.3, 0.6], foreArmL: [-1.6, 0, 0], chest: [-0.15, 0, 0], head: [-0.25, 0, 0] }]] },
};
hammer.slam = slamClip({ raise: { upperArmR: [-3.0, 0.3, -0.2], foreArmR: [-1.3, 0, 0], handR: [-0.2, 0, 0], upperArmL: [-2.6, -0.4, 0.2], foreArmL: [-1.0, 0, 0] }, hit: { upperArmR: [-1.0, 0.5, -0.1], foreArmR: [-0.1, 0, 0], handR: [0.7, 0, 0], upperArmL: [-0.9, -0.6, 0.1], foreArmL: [-0.4, 0, 0] } });
hammer.shoot = handShoot('L');
hammer.cast = castClip({ glow: 0.8, R: { upperArmR: [-0.45, 0.35, -0.42], foreArmR: [-2.05, 0, 0] }, extra2: {}, });
hammer.channel = channelClip({ pose: { upperArmR: [-0.45, 0.35, -0.42], foreArmR: [-2.05, 0, 0] } });
hammer.spin = spinClip({ arms: { upperArmR: [-1.4, 0.4, -1.2], foreArmR: [-0.1, 0, 0], handR: [0.6, 0, 0] } });
hammer.leap = leapClip({ arms1: { upperArmR: [-2.6, 0.3, -0.3], foreArmR: [-1.0, 0, 0] } });
hammer.heal = { keys: [[0, {}], [0.3, { upperArmL: [-1.4, -0.2, 0.3], foreArmL: [-0.8, 0, 0], handL: [-0.6, 0, 0], chest: [0.1, 0.2, 0], glowL: 1 }], [0.8, { upperArmL: [-1.5, -0.2, 0.25], foreArmL: [-0.6, 0, 0], handL: [-0.7, 0, 0], chest: [0.1, 0.2, 0], glowL: 1.2 }], [1, {}]] };
hammer.summon = { keys: [[0, {}], [0.3, { upperArmL: [-0.4, -0.3, 0.5], foreArmL: [-1.6, 0, 0], chest: [0.05, 0.4, 0], crouch: 0.04 }], [0.55, { upperArmL: [-0.9, -0.3, 0.3], foreArmL: [-0.4, 0, 0], handL: [-0.4, 0, 0], chest: [0.2, -0.1, 0], spine: [0.1, 0, 0], crouch: 0.12 }], [0.75, { upperArmL: [-0.85, -0.3, 0.3], foreArmL: [-0.45, 0, 0], chest: [0.15, -0.1, 0], crouch: 0.1 }], [1, {}]] };


// ---------------------------------------------------------------------------------------------
// Fähigkeits-Clips (anim-Namen aus sim/heroes.js). Treffer-Moment ≈ t 0.45, Glühen (wglow) synchron.
// ---------------------------------------------------------------------------------------------
const hold = (pose, t0, t1, extra = {}) => [[t0, { ...pose, ...extra }], [t1, { ...pose }]];
function roarClip(R = {}) {
  const peak = { spine: [-0.15, 0, 0], chest: [-0.32, 0, 0], neck: [-0.1, 0, 0], head: [-0.42, 0, 0], ...both({ upperArmL: [-0.45, 0.35, 1.15], foreArmL: [-0.95, 0, 0], handL: [0, 0, 0] }), ...R, crouch: 0.04 };
  return { keys: [[0, {}], [0.25, { spine: [0.28, 0, 0], chest: [0.2, 0, 0], head: [0.2, 0, 0], ...both({ upperArmL: [-0.3, -0.7, 0.18], foreArmL: [-1.9, 0, 0], handL: [0.3, 0, 0] }), ...R, crouch: 0.09 }],
    [0.45, { ...peak, glowL: 1, glowR: 1, wglow: 1 }], [0.78, { ...peak, glowL: 0.6, glowR: 0.6, wglow: 0.4 }], [1, {}]], pulse: { chest: [0.025, 0, 0.015], head: [0.03, 0, 0] }, pulseRate: 22 };
}
function bowCycle(keys, t0, tRel, pose = bowPose, gk = 0.6) {
  keys.push([t0, { ...pose(0.25), draw: 0.25, arrow: 1 }], [tRel - 0.06, { ...pose(1), draw: 1, arrow: 1, glowR: gk }], [tRel - 0.01, { ...pose(1), draw: 1, arrow: 1, glowR: gk }], [tRel + 0.02, { ...pose(0, true), draw: 0, arrow: 0, wglow: 1 }]);
}
const upBow = (d, rel) => ({ ...bowPose(d, rel), chest: [-0.4, -1.1, 0], spine: [-0.16, -0.3, 0], head: [-0.45, 0.95, 0.05], upperArmL: [-0.08, 1.45, 2.15] });

// Ritter
knight.bash = knight.melee[2];
knight.bash = { keys: [[0, {}], [0.3, { chest: [0, 0.35, 0], spine: [0.05, 0.1, 0], upperArmL: [-0.15, -0.95, 0.35], foreArmL: [-1.65, 0, 0], crouch: 0.07, hipsZ: -0.03 }],
  [0.45, { chest: [0.24, -0.4, 0], spine: [0.12, -0.12, 0], upperArmL: [-1.2, -1.05, 0.08], foreArmL: [-1.2, 0, 0], hipsZ: 0.12, crouch: 0.06, wglow: 1, glowL: 1 }],
  [0.62, { chest: [0.2, -0.35, 0], spine: [0.1, -0.1, 0], upperArmL: [-1.15, -1.05, 0.1], foreArmL: [-1.25, 0, 0], hipsZ: 0.1, crouch: 0.05 }], [1, {}]] };
knight.melee = [knight.melee[0], knight.melee[1]];
knight.roar = roarClip({ upperArmR: [-2.5, 0.3, -0.45], foreArmR: [-0.7, 0, 0], handR: [0, 0, 0] });
knight.charge = { keys: [[0, {}], [0.15, { spine: [0.42, 0, 0], chest: [0.18, -0.25, 0], head: [-0.42, 0.25, 0], upperArmL: [-0.85, -1.1, 0.18], foreArmL: [-1.35, 0, 0], upperArmR: [0.35, 0.2, -0.3], foreArmR: [-0.7, 0, 0], handR: [0.6, 0, 0], crouch: 0.07 }],
  [0.45, { spine: [0.4, 0, 0], chest: [0.25, -0.38, 0], head: [-0.42, 0.3, 0], upperArmL: [-1.25, -1.05, 0.06], foreArmL: [-1.15, 0, 0], upperArmR: [0.35, 0.2, -0.3], foreArmR: [-0.7, 0, 0], handR: [0.6, 0, 0], crouch: 0.06, hipsZ: 0.1, wglow: 1, glowL: 1 }],
  [0.8, { spine: [0.3, 0, 0], chest: [0.2, -0.3, 0], head: [-0.32, 0.25, 0], upperArmL: [-1.1, -1.05, 0.1], foreArmL: [-1.25, 0, 0], crouch: 0.05 }], [1, {}]] };
knight.guard = { keys: [[0, {}], [0.22, { upperArmL: [-0.85, -1.15, 0.1], foreArmL: [-1.5, 0, 0], chest: [0.12, -0.3, 0], spine: [0.08, -0.1, 0], head: [0.05, 0.3, 0], upperArmR: [0.15, 0.25, -0.35], foreArmR: [-1.1, 0, 0], handR: [0.4, 0, 0], crouch: 0.11, glowL: 0.6 }],
  [0.45, { upperArmL: [-0.95, -1.15, 0.08], foreArmL: [-1.45, 0, 0], chest: [0.14, -0.32, 0], spine: [0.08, -0.1, 0], head: [0.05, 0.3, 0], upperArmR: [0.15, 0.25, -0.35], foreArmR: [-1.1, 0, 0], handR: [0.4, 0, 0], crouch: 0.13, glowL: 1.3, wglow: 1 }],
  [0.85, { upperArmL: [-0.9, -1.15, 0.1], foreArmL: [-1.5, 0, 0], chest: [0.12, -0.3, 0], spine: [0.08, -0.1, 0], head: [0.05, 0.3, 0], upperArmR: [0.15, 0.25, -0.35], foreArmR: [-1.1, 0, 0], handR: [0.4, 0, 0], crouch: 0.11, glowL: 0.8 }], [1, {}]] };
knight.shoot = knight.bash;

// Waldläuferin
ranger.shoot = { keys: [[0, {}]] }; bowCycle(ranger.shoot.keys, 0.14, 0.45, bowPose, 0.3); ranger.shoot.keys.push([0.66, { ...bowPose(0, true) }], [1, {}]);
ranger.draw = { keys: [[0, {}]] }; bowCycle(ranger.draw.keys, 0.12, 0.45, bowPose, 1.2); ranger.draw.keys.push([0.7, { ...bowPose(0, true) }], [1, {}]);
ranger.cast = ranger.draw;
ranger.volley = { keys: [[0, {}], [0.12, { ...bowPose(0.2), draw: 0.2, arrow: 1 }], [0.36, { ...bowPose(1), chest: [0, -1.45, 0], draw: 1, arrow: 1, glowR: 0.8 }],
  [0.45, { ...bowPose(0, true), chest: [0, -0.75, 0], draw: 0, arrow: 0, wglow: 1 }], [0.56, { ...bowPose(0, true), chest: [0, -0.6, 0] }], [1, {}]] };
ranger.skyshot = { keys: [[0, {}]] }; bowCycle(ranger.skyshot.keys, 0.1, 0.45, upBow, 0.8); bowCycle(ranger.skyshot.keys, 0.52, 0.7, upBow, 0.8); bowCycle(ranger.skyshot.keys, 0.76, 0.93, upBow, 0.8); ranger.skyshot.keys.push([1, {}]);
ranger.channel = ranger.skyshot;
ranger.flip = { keys: [[0, {}], [0.14, { crouch: 0.16, spine: [0.32, 0, 0], ...both({ upperArmL: [0.45, 0, 0.2], foreArmL: [-0.6, 0, 0] }) }],
  [0.26, { hipsY: 0.35, pitch: -1.2, legFK: 1, thighL: [-1.2, 0, 0.1], shinL: [1.8, 0, 0], thighR: [-1.0, 0, -0.1], shinR: [1.7, 0, 0], spine: [0.25, 0, 0], ...both({ upperArmL: [-1.2, 0, 0.5], foreArmL: [-0.8, 0, 0] }) }],
  [0.45, { hipsY: 0.6, pitch: -3.3, legFK: 1, thighL: [-1.5, 0, 0.1], shinL: [2.1, 0, 0], thighR: [-1.4, 0, -0.1], shinR: [2.0, 0, 0], spine: [0.35, 0, 0], chest: [0.2, 0, 0], ...both({ upperArmL: [-0.9, 0, 0.4], foreArmL: [-1.2, 0, 0] }), wglow: 1 }],
  [0.66, { hipsY: 0.3, pitch: -5.4, legFK: 1, thighL: [-0.9, 0, 0.1], shinL: [1.2, 0, 0], thighR: [-0.7, 0, -0.1], shinR: [1.0, 0, 0], spine: [0.2, 0, 0] }],
  [0.8, { crouch: 0.18, pitch: -6.283, spine: [0.32, 0, 0], ...both({ upperArmL: [-0.5, 0, 0.6], foreArmL: [-0.4, 0, 0] }) }], [1, { pitch: -6.283 }]] };
ranger.leap = ranger.flip;
ranger.bandage = { keys: [[0, {}], [0.22, { crouch: 0.16, spine: [0.3, 0, 0], chest: [0.22, 0.15, 0], head: [0.45, -0.1, 0], upperArmL: [-0.9, -0.7, 0.18], foreArmL: [-1.65, 0, 0], upperArmR: [-0.75, 0.6, -0.1], foreArmR: [-1.75, 0, 0], glowR: 0.5 }],
  [0.45, { crouch: 0.16, spine: [0.3, 0, 0], chest: [0.22, 0.15, 0], head: [0.45, -0.1, 0], upperArmL: [-0.9, -0.7, 0.18], foreArmL: [-1.65, 0, 0], upperArmR: [-0.85, 0.75, -0.05], foreArmR: [-1.6, 0, 0], glowR: 1.2, glowL: 0.8, wglow: 1 }],
  [0.85, { crouch: 0.14, spine: [0.28, 0, 0], chest: [0.2, 0.15, 0], head: [0.4, -0.1, 0], upperArmL: [-0.9, -0.7, 0.18], foreArmL: [-1.65, 0, 0], upperArmR: [-0.75, 0.6, -0.1], foreArmR: [-1.75, 0, 0], glowR: 0.6 }], [1, {}]],
  pulse: { upperArmR: [0.12, 0.15, 0.06], foreArmR: [0.15, 0, 0] }, pulseRate: 9 };
ranger.roar = roarClip({}); ranger.guard = ranger.bandage; ranger.breath = ranger.bandage;

// Schurke
const dstab = { keys: [[0, {}], [0.28, { ...both({ upperArmL: [-0.3, -0.45, 0.38], foreArmL: [-2.05, 0, 0], handL: [0.7, 0, 0] }), chest: [-0.05, 0, 0], crouch: 0.07, hipsZ: -0.05 }],
  [0.45, { ...both({ upperArmL: [-1.4, -0.25, 0.1], foreArmL: [-0.15, 0, 0], handL: [1.35, 0, 0] }), chest: [0.32, 0, 0], spine: [0.22, 0, 0], head: [-0.25, 0, 0], crouch: 0.15, hipsZ: 0.16, wglow: 1, glowL: 1, glowR: 1 }],
  [0.62, { ...both({ upperArmL: [-1.3, -0.25, 0.12], foreArmL: [-0.25, 0, 0], handL: [1.25, 0, 0] }), chest: [0.28, 0, 0], spine: [0.18, 0, 0], head: [-0.2, 0, 0], crouch: 0.13, hipsZ: 0.13 }], [1, {}]] };
dual.stab = dstab;
dual.slash = { keys: [[0, {}], [0.25, { chest: [0.05, -0.55, 0], spine: [0.1, -0.2, 0], upperArmR: [-2.0, 0.4, -0.75], foreArmR: [-1.2, 0, 0], handR: [-0.3, 0, 0], upperArmL: [-0.3, -0.5, 0.5], foreArmL: [-1.5, 0, 0], crouch: 0.05 }],
  [0.4, { chest: [0.22, 0.5, 0], spine: [0.15, 0.2, 0], upperArmR: [-0.9, 1.2, -0.15], foreArmR: [-0.35, 0, 0], handR: [0.65, 0, 0], upperArmL: [-1.6, -0.3, 0.7], foreArmL: [-1.2, 0, 0], crouch: 0.1, hipsZ: 0.05, wglow: 1, glowR: 1 }],
  [0.55, { chest: [0.22, -0.55, 0], spine: [0.15, -0.2, 0], upperArmL: [-0.9, -1.2, 0.15], foreArmL: [-0.35, 0, 0], handL: [0.65, 0, 0], upperArmR: [-0.7, 1.3, -0.1], foreArmR: [-0.6, 0, 0], crouch: 0.12, hipsZ: 0.08, wglow: 1, glowL: 1 }],
  [0.72, { chest: [0.18, -0.6, 0], spine: [0.12, -0.2, 0], upperArmL: [-0.7, -1.3, 0.1], foreArmL: [-0.5, 0, 0], handL: [0.7, 0, 0], crouch: 0.1 }], [1, {}]] };
{
  const keys = [[0, {}]];
  for (let i = 0; i < 6; i++) {
    const t = 0.12 + i * 0.13, R = i % 2 === 0, S = (p) => (R ? p : mir(p));
    keys.push([t, { ...S({ upperArmR: [-1.9, 0.5, -0.7], foreArmR: [-1.3, 0, 0], handR: [-0.2, 0, 0], chest: [0.1, -0.4, 0], spine: [0.1, -0.15, 0] }), crouch: 0.1 }]);
    keys.push([t + 0.065, { ...S({ upperArmR: [-0.85, 1.25, -0.12], foreArmR: [-0.3, 0, 0], handR: [0.7, 0, 0], chest: [0.22, 0.45, 0], spine: [0.15, 0.15, 0] }), crouch: 0.13, hipsZ: 0.04, wglow: 1, glowR: R ? 1 : 0, glowL: R ? 0 : 1 }]);
  }
  keys.push([1, {}]);
  dual.flurry = { keys };
}
dual.breath = { keys: [[0, {}], [0.25, { chest: [-0.16, 0, 0], spine: [-0.06, 0, 0], head: [-0.2, 0, 0], ...both({ upperArmL: [-0.45, -0.95, 0.12], foreArmL: [-1.75, 0, 0], handL: [0.3, 0, 0] }), glowL: 0.5, glowR: 0.5 }],
  [0.45, { chest: [-0.2, 0, 0], spine: [-0.08, 0, 0], head: [-0.25, 0, 0], ...both({ upperArmL: [-0.5, -1.0, 0.1], foreArmL: [-1.8, 0, 0], handL: [0.3, 0, 0] }), glowL: 1.1, glowR: 1.1, wglow: 0.8 }],
  [0.85, { chest: [-0.16, 0, 0], spine: [-0.06, 0, 0], head: [-0.2, 0, 0], ...both({ upperArmL: [-0.45, -0.95, 0.12], foreArmL: [-1.75, 0, 0], handL: [0.3, 0, 0] }), glowL: 0.6, glowR: 0.6 }], [1, {}]],
  pulse: { chest: [0.07, 0, 0], spine: [0.03, 0, 0], head: [0.04, 0, 0] }, pulseRate: 2.6 };
const blinkClip = (o = {}) => ({ keys: [[0, {}], [0.25, { ...both({ upperArmL: [-0.35, -0.85, 0.12], foreArmL: [-1.95, 0, 0], handL: [0.2, 0, 0] }), crouch: 0.14, spine: [0.38, 0, 0], chest: [0.2, 0, 0], head: [-0.2, 0, 0], glowL: 0.8, glowR: 0.8 }],
  [0.45, { ...both({ upperArmL: [-0.55, 0.0, 0.95], foreArmL: [-0.3, 0, 0], handL: o.hand || [-0.6, 0, 0] }), chest: [-0.12, 0, 0], spine: [-0.04, 0, 0], head: [-0.1, 0, 0], hipsY: 0.03, glowL: 1.4, glowR: 1.4, wglow: 1 }],
  [0.7, { ...both({ upperArmL: [-0.45, -0.1, 0.75], foreArmL: [-0.5, 0, 0] }), chest: [-0.05, 0, 0], glowL: 0.5, glowR: 0.5 }], [1, {}]] });
dual.blink = blinkClip({ hand: [0.6, 0, 0] });
dual.melee = [dual.melee[0], dual.melee[1], dual.melee[2]];
dual.shoot = { keys: [[0, {}], [0.3, { upperArmR: [-2.2, 0.3, -0.6], foreArmR: [-1.6, 0, 0], handR: [-0.4, 0, 0], chest: [-0.05, -0.55, 0], spine: [0, -0.2, 0], crouch: 0.05 }],
  [0.45, { upperArmR: [-1.35, 0.4, -0.15], foreArmR: [-0.1, 0, 0], handR: [0.9, 0, 0], chest: [0.25, 0.45, 0], spine: [0.12, 0.15, 0], crouch: 0.08, wglow: 1, glowR: 1 }], [0.62, { upperArmR: [-1.1, 0.5, -0.1], foreArmR: [-0.3, 0, 0], handR: [0.9, 0, 0], chest: [0.2, 0.5, 0] }], [1, {}]] };
dual.roar = roarClip({}); dual.guard = dual.breath; dual.spin = spinClip({ arms: both({ upperArmL: [-0.2, -0.6, 1.35], foreArmL: [-0.2, 0, 0], handL: [0.6, 0, 0] }) });

// Magierin
mage.nova = { keys: [[0, {}], [0.28, { ...both({ upperArmL: [-1.65, -0.85, 0.15], foreArmL: [-1.85, 0, 0], handL: [0, 0, 0] }), chest: [-0.12, 0, 0], head: [-0.15, 0, 0], hipsY: 0.03, glowL: 0.8, glowR: 0.8 }],
  [0.45, { ...both({ upperArmL: [-0.35, -0.2, 0.8], foreArmL: [-0.2, 0, 0], handL: [-0.9, 0, 0] }), crouch: 0.17, chest: [0.32, 0, 0], spine: [0.2, 0, 0], head: [0.02, 0, 0], glowL: 1.5, glowR: 1.5, wglow: 1 }],
  [0.72, { ...both({ upperArmL: [-0.3, -0.2, 0.75], foreArmL: [-0.25, 0, 0], handL: [-0.8, 0, 0] }), crouch: 0.14, chest: [0.26, 0, 0], spine: [0.16, 0, 0], glowL: 0.6, glowR: 0.6 }], [1, {}]] };
mage.blink = blinkClip({});
mage.guard = { keys: [[0, {}], [0.28, { ...both({ upperArmL: [-1.2, -1.1, 0.08], foreArmL: [-1.65, 0, 0], handL: [0, 0, 0] }), crouch: 0.06, chest: [0.16, 0, 0], head: [0.12, 0, 0], glowL: 0.6, glowR: 0.6 }],
  [0.45, { ...both({ upperArmL: [-0.6, -0.3, 0.95], foreArmL: [-0.4, 0, 0], handL: [-0.5, 0, 0] }), chest: [-0.16, 0, 0], head: [-0.18, 0, 0], hipsY: 0.02, glowL: 1.5, glowR: 1.5, wglow: 1 }],
  [0.8, { ...both({ upperArmL: [-0.5, -0.3, 0.8], foreArmL: [-0.5, 0, 0], handL: [-0.4, 0, 0] }), chest: [-0.1, 0, 0], glowL: 0.8, glowR: 0.8 }], [1, {}]] };
const skyClip = (R1, R2, o = {}) => ({ keys: [[0, {}], [0.3, { upperArmL: [-2.95, -0.2, 0.25], foreArmL: [-0.2, 0, 0], handL: [0.3, 0, 0], chest: [-0.28, 0.12, 0], spine: [-0.1, 0.05, 0], head: [-0.55, 0, 0], ...R1, glowL: 1, glowR: 1, hipsY: 0.02 }],
  [0.45, { upperArmL: [-1.35, -0.25, 0.3], foreArmL: [-0.1, 0, 0], handL: [-0.6, 0, 0], chest: [0.18, -0.12, 0], spine: [0.08, -0.04, 0], head: [0.05, 0, 0], ...R2, glowL: 1.6, glowR: 1.2, wglow: 1, crouch: 0.06 }],
  [0.78, { upperArmL: [-1.3, -0.25, 0.3], foreArmL: [-0.15, 0, 0], handL: [-0.5, 0, 0], chest: [0.14, -0.1, 0], ...R2, glowL: 0.7, glowR: 0.5, crouch: 0.04 }], [1, {}]] });
mage.skycast = skyClip({ upperArmR: [-2.5, 0.3, -0.35], foreArmR: [-0.6, 0, 0] }, { upperArmR: [-0.6, 0.3, -0.45], foreArmR: [-1.5, 0, 0] });
mage.roar = roarClip({}); mage.heal = healClip({});

// Priesterin
priest.heal = healClip({ R2: { upperArmR: [-2.95, 0.3, -0.12], foreArmR: [-0.55, 0, 0] } });
priest.guard = mage.guard; priest.blink = blinkClip({}); priest.nova = mage.nova;
priest.skycast = skyClip({ upperArmR: [-2.9, 0.3, -0.15], foreArmR: [-0.5, 0, 0] }, { upperArmR: [-0.5, 0.3, -0.3], foreArmR: [-1.6, 0, 0] });
priest.roar = roarClip({});

// Krieger mit Hammer
hammer.overhead = hammer.melee[0];
hammer.roar = roarClip({ upperArmR: [-2.6, 0.2, -0.55], foreArmR: [-0.7, 0, 0], handR: [0, 0, 0] });
hammer.spin = { keys: [[0, {}], [0.2, { upperArmR: [-1.3, -0.4, -1.35], foreArmR: [-0.2, 0, 0], handR: [0.3, 0, 0], upperArmL: [-0.8, -0.6, 0.6], foreArmL: [-1.0, 0, 0], chest: [0.1, 0.7, 0], spine: [0.08, 0.3, 0], crouch: 0.1, yaw: -0.5 }],
  [0.45, { upperArmR: [-1.4, 0.2, -1.35], foreArmR: [-0.05, 0, 0], handR: [0.7, 0, 0], upperArmL: [-0.6, -0.4, 0.9], foreArmL: [-0.5, 0, 0], chest: [0.1, -0.2, 0], spine: [0.06, -0.1, 0], crouch: 0.12, yaw: PI, wglow: 1 }],
  [0.75, { upperArmR: [-1.4, 0.2, -1.3], foreArmR: [-0.1, 0, 0], handR: [0.7, 0, 0], upperArmL: [-0.6, -0.4, 0.9], foreArmL: [-0.5, 0, 0], chest: [0.1, -0.4, 0], crouch: 0.1, yaw: PI * 2 }], [1, { yaw: PI * 2 }]] };
hammer.leap = { keys: [[0, {}], [0.12, { crouch: 0.2, spine: [0.38, 0, 0], upperArmR: [-0.3, 0.3, -0.6], foreArmR: [-1.8, 0, 0], ...mir({ upperArmR: [0.4, 0, -0.3], foreArmR: [-0.6, 0, 0] }) }],
  [0.27, { hipsY: 0.28, legFK: 1, thighL: [-1.1, 0, 0.12], shinL: [1.6, 0, 0], footL: [0.4, 0, 0], thighR: [-0.5, 0, -0.1], shinR: [1.4, 0, 0], footR: [0.5, 0, 0], spine: [-0.15, 0, 0], chest: [-0.25, 0, 0], upperArmR: [-3.0, 0.3, -0.2], foreArmR: [-1.3, 0, 0], handR: [-0.2, 0, 0], upperArmL: [-2.6, -0.3, 0.3], foreArmL: [-0.8, 0, 0] }],
  [0.45, { crouch: 0.26, spine: [0.48, 0, 0], chest: [0.3, 0, 0], head: [-0.25, 0, 0], upperArmR: [-1.0, 0.5, -0.12], foreArmR: [-0.1, 0, 0], handR: [0.75, 0, 0], upperArmL: [-0.9, -0.5, 0.2], foreArmL: [-0.4, 0, 0], wglow: 1 }],
  [0.7, { crouch: 0.22, spine: [0.42, 0, 0], chest: [0.26, 0, 0], head: [-0.2, 0, 0], upperArmR: [-0.95, 0.5, -0.12], foreArmR: [-0.15, 0, 0], handR: [0.75, 0, 0], upperArmL: [-0.85, -0.5, 0.2], foreArmL: [-0.45, 0, 0] }], [1, {}]] };
hammer.skycast = { keys: [[0, {}], [0.32, { upperArmR: [-3.05, 0.3, -0.1], foreArmR: [-0.25, 0, 0], handR: [0, 0, 0], upperArmL: [-0.4, -0.3, 0.6], foreArmL: [-1.2, 0, 0], chest: [-0.3, 0, 0], spine: [-0.12, 0, 0], head: [-0.55, 0, 0], hipsY: 0.02, wglow: 0.8 }],
  [0.45, { upperArmR: [-1.5, 0.4, -0.15], foreArmR: [0.0, 0, 0], handR: [0.55, 0, 0], upperArmL: [-0.6, -0.5, 0.4], foreArmL: [-1.3, 0, 0], chest: [0.25, 0.1, 0], spine: [0.12, 0, 0], head: [0, 0, 0], crouch: 0.1, wglow: 1.2 }],
  [0.8, { upperArmR: [-1.45, 0.4, -0.15], foreArmR: [-0.05, 0, 0], handR: [0.55, 0, 0], chest: [0.2, 0.1, 0], crouch: 0.08, wglow: 0.6 }], [1, {}]] };
hammer.melee = [hammer.melee[1], hammer.melee[0]];
hammer.shoot = hammer.melee[0];
hammer.guard = hammer.roar;

// Fehlende Namen auf sinnvolle Clips abbilden
const ALIAS = { bash: 'melee', roar: 'cast', charge: 'leap', guard: 'cast', draw: 'shoot', volley: 'shoot', flip: 'leap', bandage: 'heal', skyshot: 'channel', nova: 'slam', blink: 'cast', skycast: 'cast', overhead: 'melee', stab: 'melee', slash: 'melee', breath: 'heal', flurry: 'melee' };

export const STYLES = { knight, ranger, dual, mage, priest, hammer };
for (const st of Object.values(STYLES)) {
  st.death = st.death || DEATH;
  st.cast = st.cast || castClip({});
  st.channel = st.channel || channelClip({});
  st.heal = st.heal || healClip({});
  st.summon = st.summon || summonClip({});
  st.spin = st.spin || spinClip({});
  st.slam = st.slam || slamClip({});
  st.leap = st.leap || leapClip({});
  st.shoot = st.shoot || handShoot('R');
  st.melee = st.melee || staffStrike('R');
  for (const [k, v] of Object.entries(ALIAS)) if (!st[k]) st[k] = st[v];
}
