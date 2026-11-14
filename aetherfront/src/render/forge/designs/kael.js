// Kael Sturmbrecher – schwerer Schildritter (Blau/Silber/Gold): Kürass mit Grat, gestaffelte Schulterkuppeln,
// offener Federbusch-Helm mit Wangenklappen, Wappenrock, langer Umhang, Langschwert + gewölbter Turmschild.
import {
  joints, frame, handFrame, headInfo, torsoShape, neckShape, deltoidShape, upperArmShape, foreArmShape, thighShape, shinShape, footShape,
  handShape, head, pauldron, bracer, belt, cape, skirt, Detail, add, sub, scl, norm, lerp3, madd, PI, TAU, clamp, smooth,
} from './lib.js';
import { longsword, towerShield } from './weapons.js';

const { abs, max, min, sin, cos, atan2, hypot, sqrt } = Math;

export function build(S, B, P) {
  const j = joints(B), s = B.skel.s;
  const steel = 'primary', blue = 'secondary', gold = 'metal';
  const mailC = '#5a606b', gambeson = '#1d2c55', leather = '#3a2618';
  const hips = j('hips'), chest = j('chest'), neck = j('neck');

  // ======================= Grundkörper (Unterkleidung) =======================
  S.layer('body');
  S.group({ k: 0.0 }, () => {
    // Gambeson (gesteppt) als Rumpf
    torsoShape(S, B, { bulk: 1.04, o: { mat: 'cloth', col: gambeson, region: 'torso', disp: Detail.quilt({ amp: 0.003 * s, cell: 0.045 * s }) } });
    S.sym(() => deltoidShape(S, B, { bulk: 1.05, o: { mat: 'mail', col: mailC, region: 'shoulderL' } }));
    S.sym(() => upperArmShape(S, B, { bulk: 1.08, o: { mat: 'mail', col: mailC, region: 'armL', disp: Detail.mail({ amp: 0.0018 * s }) } }));
    S.sym(() => foreArmShape(S, B, { bulk: 1.05, o: { mat: 'mail', col: mailC, region: 'armL', disp: Detail.mail({ amp: 0.0018 * s }) } }));
    S.sym(() => thighShape(S, B, { bulk: 1.06, o: { mat: 'mail', col: mailC, region: 'legL', disp: Detail.mail({ amp: 0.0018 * s }) } }));
    S.sym(() => shinShape(S, B, { bulk: 1.05, o: { mat: 'mail', col: mailC, region: 'legL' } }));
    neckShape(S, B, { r: 0.06, o: { mat: 'mail', col: mailC, region: 'neck' } });
  });

  // ======================= Kürass =======================
  const yBot = hips[1] + 0.07 * s, yTop = neck[1] - 0.005 * s;
  const ua = j('upperArmL');
  const cuirassClip = (x, y, z) => {
    let c = max(yBot - y, y - yTop - 0.03 * s * smooth(0.0, 0.12 * s, abs(x)));
    // Armausschnitte
    const ax = abs(x) - ua[0] + 0.01 * s, ay = y - (ua[1] - 0.03 * s);
    c = max(c, -(hypot(ax * 1.0, ay * 0.85, (z - ua[2]) * 0.0) - 0.085 * s));
    // Halsausschnitt
    c = max(c, -(hypot(x, (z - neck[2] - 0.01 * s) * 0.9) - 0.085 * s) + 0 * (y < neck[1] - 0.12 * s ? 1 : 0));
    return c;
  };
  const cuirassRef = () => torsoShape(S, B, { bulk: 1.04, k: 0.07 });
  S.group({ k: 0 }, () => {
    S.shell({ off: 0.016 * s, th: 0.014 * s, mat: 'steel', col: steel, region: 'torso', clip: cuirassClip, ck: 0.008 * s }, cuirassRef);
    // Mittelgrat
    S.capsule([0, yBot + 0.02 * s, 0.155 * s], [0, chest[1] + 0.16 * s, 0.152 * s], 0.006 * s, 0.004 * s, { mat: 'steel', col: steel, region: 'torso', k: 0.025 * s });
  });
  // Goldkanten (Band-Schalen an Ober-/Unterkante)
  S.shell({ off: 0.027 * s, th: 0.006 * s, mat: 'gold', col: gold, region: 'torso', clip: (x, y, z) => max(cuirassClip(x, y, z), y - yBot - 0.022 * s), ck: 0.003 * s }, cuirassRef);
  S.shell({ off: 0.027 * s, th: 0.006 * s, mat: 'gold', col: gold, region: 'torso', clip: (x, y, z) => max(cuirassClip(x, y, z), -cuirassClip(x, y, z) - 0.018 * s), ck: 0.003 * s }, cuirassRef);
  // Brust-Emblem: Sonnenstern (gold) – relief auf der Brust
  S.prim([0, chest[1] + 0.085 * s, 0.168 * s], {
    f: (x, y, z) => { const r = hypot(x, y), a = atan2(y, x); const st = r - (0.03 + 0.024 * (0.5 + 0.5 * cos(a * 8))) * s; return max(st, abs(z) - 0.007 * s); },
    box: [-0.06 * s, -0.06 * s, -0.008 * s, 0.06 * s, 0.06 * s, 0.008 * s],
  }, { mat: 'gold', col: gold, region: 'torso', rot: [-0.2, 0, 0], k: 0.004 * s });
  // Bauchreifen (Lamellen) unter dem Kürass
  for (let i = 0; i < 3; i++) {
    const y1 = yBot + 0.01 * s - i * 0.042 * s, y0 = y1 - 0.05 * s;
    S.shell({ off: (0.018 + i * 0.004) * s, th: 0.013 * s, mat: 'steel', col: i % 2 ? 'primary*0.9' : steel, region: 'pelvis', clip: (x, y, z) => max(y0 - y, y - y1), ck: 0.004 * s }, () => torsoShape(S, B, { bulk: 1.04 }));
    S.shell({ off: (0.028 + i * 0.004) * s, th: 0.005 * s, mat: 'gold', col: gold, region: 'pelvis', clip: (x, y, z) => max(y0 - y, y - y0 - 0.01 * s), ck: 0.002 * s }, () => torsoShape(S, B, { bulk: 1.04 }));
  }
  belt(S, B, { dy: -0.025, rx: 0.19, rz: 0.15, h: 0.045, col: leather, buckle: gold });

  // ======================= Wappenrock (vorn + hinten) =======================
  skirt(S, B, {
    top: hips[1] - 0.02 * s, bottom: j('shinL')[1] + 0.07 * s, r0: 0.19, r1: 0.25, col: blue, mat: 'silk', fold: 0.008, folds: 9, th: 0.014,
    panels: [[0, 0.62], [PI, 0.62]], hem: gold, hemW: 0.018,
    grad: { axis: 'y', from: hips[1], to: j('shinL')[1], k: 0.7 },
  });
  // Tassets (Beinplatten) seitlich vorn
  S.sym(() => {
    for (let k = 0; k < 3; k++) {
      const y1 = hips[1] - 0.035 * s - k * 0.065 * s, y0 = y1 - 0.075 * s;
      S.shell({ off: (0.03 + k * 0.008) * s, th: 0.013 * s, mat: 'steel', col: k % 2 ? 'primary*0.92' : steel, region: 'skirt', clip: (x, y, z) => {
        const a = atan2(x, z);
        return max(max(y0 - y, y - y1), abs(a - 0.95) * 0.2 * s - 0.11 * s);
      }, ck: 0.004 * s }, () => S.ellipsoid([0, hips[1] - 0.06 * s, 0], [0.19 * s, 0.25 * s, 0.16 * s], {}));
    }
  });

  // ======================= Arme =======================
  S.sym(() => {
    pauldron(S, B, { r: 0.125, layers: 3, col: steel, col2: 'primary*0.9', trim: gold, tilt: 0.5, th: 0.013 });
    // Oberarmröhre
    bracer(S, add(ua, [0.006 * s, -0.09 * s, 0]), add(j('foreArmL'), [0, 0.04 * s, 0]), 0.056 * s, 0.05 * s, { s, col: steel, region: 'armL', rimMat: 'gold', rimCol: gold });
    // Ellbogenkachel
    const el = j('foreArmL');
    S.shell({ off: 0.006 * s, th: 0.013 * s, mat: 'steel', col: steel, region: 'armL', clip: (x, y, z) => z - el[2] + 0.005 * s }, () => S.sphere(add(el, [0.004 * s, 0, -0.004 * s]), 0.047 * s, {}));
    S.prim(add(el, [0.05 * s, -0.01 * s, -0.02 * s]), {
      f: (x, y, z) => { const r = hypot(x, y); return max(max(r - 0.045 * s, abs(z) - 0.004 * s), -y - 0.01 * s + abs(x) * 0.2); },
      box: [-0.05 * s, -0.05 * s, -0.005 * s, 0.05 * s, 0.05 * s, 0.005 * s],
    }, { mat: 'gold', col: gold, region: 'armL', rot: [0, PI / 2, 0], k: 0.004 * s });
    // Unterarmschiene
    bracer(S, add(el, [0, -0.035 * s, 0]), add(j('handL'), [0, 0.012 * s, 0]), 0.05 * s, 0.043 * s, { s, col: steel, region: 'armL', rimMat: 'gold', rimCol: gold, ridge: true });
  });

  // ======================= Beine =======================
  S.sym(() => {
    const th = j('thighL'), kn = j('shinL'), an = j('footL');
    // Oberschenkel-Platte (vorne)
    S.shell({ off: 0.012 * s, th: 0.013 * s, mat: 'steel', col: steel, region: 'legL', clip: (x, y, z) => max(max(kn[1] + 0.06 * s - y, y - (th[1] - 0.06 * s)), -(z - kn[2]) - 0.01 * s), ck: 0.004 * s }, () => thighShape(S, B, { bulk: 1.06, muscle: false }));
    // Kniekachel + Flügel
    S.shell({ off: 0.005 * s, th: 0.013 * s, mat: 'steel', col: steel, bind: (p) => [['thighL', 0.5], ['shinL', 0.5]], clip: (x, y, z) => kn[2] - 0.0 * s - z }, () => S.ellipsoid(add(kn, [0, 0.01 * s, 0.022 * s]), [0.06 * s, 0.07 * s, 0.05 * s], {}));
    S.prim(add(kn, [0.062 * s, 0.0, 0.0]), {
      f: (x, y, z) => { const r = hypot(x, y); return max(max(r - 0.05 * s, abs(z) - 0.004 * s), 0); },
      box: [-0.05 * s, -0.05 * s, -0.005 * s, 0.05 * s, 0.05 * s, 0.005 * s],
    }, { mat: 'gold', col: gold, bind: (p) => [['thighL', 0.4], ['shinL', 0.6]], rot: [0, PI / 2, 0], k: 0.004 * s });
    // Beinschiene
    bracer(S, add(kn, [0, -0.045 * s, 0.006 * s]), add(an, [0, 0.12 * s, 0]), 0.058 * s, 0.046 * s, { s, col: steel, region: 'legL', rimMat: 'gold', rimCol: gold, ridge: true });
    // Stahlschuhe (Lamellen)
    S.shell({ off: 0.006 * s, th: 0.013 * s, mat: 'steel', col: steel, region: 'legL', clip: (x, y, z) => max(y - an[1] - 0.11 * s, -y + 0.004 * s), ck: 0.004 * s }, () => footShape(S, B, { w: 1.05 }));
    footShape(S, B, { w: 1.02, o: { mat: 'leather', col: '#2a1c14', region: 'legL' } });
    for (let k = 0; k < 3; k++) S.torus([an[0], 0.045 * s, an[2] + (0.04 + k * 0.035) * s], 0.05 * s, 0.004 * s, { rot: [PI / 2 - 0.35, 0, 0], arc: PI * 0.95, mat: 'gold', col: gold, region: 'legL', k: 0.002 * s });
  });

  // ======================= Halsberge =======================
  S.lathe(add(neck, [0, 0.03 * s, -0.012 * s]), [[0.064 * s, 0.05 * s], [0.074 * s, 0.045 * s], [0.08 * s, -0.01 * s], [0.13 * s, -0.045 * s], [0.165 * s, -0.065 * s], [0.155 * s, -0.08 * s], [0.12 * s, -0.06 * s], [0.07 * s, -0.025 * s], [0.058 * s, 0.045 * s]],
    { mat: 'steel', col: steel, region: 'neck', r: 0.003 * s, scale: 1 });
  S.torus(add(neck, [0, 0.078 * s, -0.012 * s]), 0.068 * s, 0.0055 * s, { mat: 'gold', col: gold, region: 'neck' });

  // ======================= Umhang =======================
  cape(S, B, {
    top: neck[1] - 0.03 * s, bottom: 0.32 * s, r0: 0.175, r1: 0.42, arc: 1.15, col: blue, mat: 'silk', folds: 7, fold: 0.016, hem: gold,
    grad: { axis: 'y', from: neck[1], to: 0.4 * s, k: 0.65 }, back: 0.05, th: 0.015,
  });
  // Umhangspangen
  S.sym(() => {
    S.lathe([0.15 * s, neck[1] - 0.04 * s, 0.1 * s], [[0, -0.004 * s], [0.028 * s, -0.003 * s], [0.032 * s, 0.006 * s], [0.02 * s, 0.014 * s], [0, 0.016 * s]], { rot: [PI / 2, 0, 0], mat: 'gold', col: gold, region: 'upper' });
  });

  // ======================= Kopf + Helm (fein) =======================
  S.layer('body:fine');
  neckShape(S, B, { r: 0.054, o: { mat: 'skin', col: '#b98a6c', region: 'neck' } });
  const H = head(S, B, { skin: '#c4957a', eye: '#4a7aa8', brow: '#4a3424', lips: '#a8665a', jaw: 1.06 });
  const hc = H.c;
  // Helm: Schale um den Schädel, Gesicht offen (T-förmig), Wangenklappen, Nackenschutz
  const helmClip = (x, y, z) => {
    const lx = x - hc[0], ly = y - hc[1], lz = z - hc[2];
    let c = -(ly + 0.135 * s);                            // unten offen
    // Gesichtsöffnung: vorne, unterhalb der Stirn
    const face = max(max(abs(lx) - (ly > -0.02 * s ? 0.058 * s : 0.04 * s), ly - 0.03 * s), -lz + 0.02 * s);
    c = max(c, -face);
    return c;
  };
  S.group({ k: 0 }, () => {
    S.shell({ off: 0.0, th: 0.007 * s, mat: 'steel', col: steel, region: 'head', clip: helmClip, ck: 0.004 * s }, () => {
      S.ellipsoid(add(hc, [0, 0.022 * s, -0.008 * s]), [0.104 * s, 0.118 * s, 0.118 * s], {});
      S.ellipsoid(add(hc, [0, -0.06 * s, 0.0]), [0.1 * s, 0.1 * s, 0.112 * s], { k: 0.05 * s });
      S.ellipsoid(add(hc, [0, -0.05 * s, -0.06 * s]), [0.095 * s, 0.11 * s, 0.08 * s], { k: 0.05 * s });
    });
    // Kamm (Grat von der Stirn zum Nacken)
    S.torus(add(hc, [0, 0.0, -0.008 * s]), 0.124 * s, 0.009 * s, { rot: { x: [0, 0, 1], y: [1, 0, 0], z: [0, 1, 0] }, arc: 3.4, mat: 'gold', col: gold, region: 'head', k: 0.01 * s });
  });
  // Stirnband + Nieten
  S.shell({ off: 0.007 * s, th: 0.004 * s, mat: 'gold', col: gold, region: 'head', clip: (x, y, z) => max(abs(y - hc[1] - 0.045 * s) - 0.011 * s, helmClip(x, y, z)), ck: 0.002 * s }, () => {
    S.ellipsoid(add(hc, [0, 0.022 * s, -0.008 * s]), [0.104 * s, 0.118 * s, 0.118 * s], {});
  });
  // Federbusch-Halter
  const ptop = P0(B.J.plume.pos);
  S.capsule(add(ptop, [0, -0.03 * s, 0]), add(ptop, [0, 0.01 * s, 0]), 0.018 * s, 0.022 * s, { mat: 'gold', col: gold, region: 'head', k: 0.006 * s });

  // ======================= Federbusch (Kette) =======================
  S.layer('body');
  const plumeBones = ['plume', 'plume1', 'plume2'];
  const pr = plumeBones.map((n) => P0(B.J[n].pos));
  const plumeBind = (p) => {
    const t = clamp((ptop[2] - p[2]) / (0.34 * s), 0, 1) * 2;
    const i = Math.min(1, Math.floor(t)), f = t - i;
    return [[plumeBones[i], 1 - f], [plumeBones[i + 1], f]];
  };
  for (let k = 0; k < 11; k++) {
    const a = (k - 5) * 0.08, L = 1 - abs(k - 5) * 0.05;
    const pts = [add(ptop, [a * 0.06 * s, 0.0, 0.01 * s]), add(ptop, [a * 0.22 * s, 0.07 * s * L, -0.07 * s]), add(ptop, [a * 0.36 * s, 0.05 * s * L, -0.2 * s * L]), add(ptop, [a * 0.46 * s, -0.06 * s * L, -0.32 * s * L]), add(ptop, [a * 0.5 * s, -0.19 * s * L, -0.37 * s * L])];
    S.tube(pts, (t) => (0.016 * sin(min(1, t * 1.25) * PI * 0.88 + 0.3) + 0.003) * s, { mat: 'feather', col: k % 3 === 1 ? '#e8ecf4' : blue, bind: plumeBind, k: 0.01 * s, vary: 0.12, grad: { axis: 'y', from: ptop[1], to: ptop[1] - 0.2 * s, k: 0.6 }, disp: Detail.fur({ amp: 0.003 * s, freq: 90 }) });
  }
  void pr;

  // ======================= Hände (fein) =======================
  S.layer('body:fine');
  S.sym(() => {
    handShape(S, B, { curl: 1, bulk: 1.12, o: { mat: 'steel', col: 'primary*0.8', region: ['foreArmL', 'handL'] } });
    // Stulpe
    const F = handFrame(B, 'L');
    bracer(S, F.at(-0.02, 0, 0), F.at(0.045, 0, 0.004), 0.047 * s, 0.043 * s, { s, th: 0.008, col: steel, region: ['foreArmL', 'handL'], rimMat: 'gold', rimCol: gold });
    S.shell({ off: 0.004 * s, th: 0.008 * s, mat: 'steel', col: steel, region: ['handL'], clip: (x, y, z) => { const p = [x - F.o[0], y - F.o[1], z - F.o[2]]; return -(p[0] * F.i[0] + p[1] * F.i[1] + p[2] * F.i[2]) - 0.002 * s; } }, () => {
      S.box(F.at(0.05, 0, 0.004), [0.044 * s, 0.05 * s, 0.018 * s], { r: 0.014 * s, rot: { x: F.f, y: F.d, z: F.i } });
    });
  });

  // ======================= Waffen =======================
  // Langschwert (rechte Hand) – Rahmen wie im alten Rig (weaponJoint: y = vorn, x = −Unterarm)
  {
    const F = handFrame(B, 'R');
    const fr = frame(P0(B.J.weaponR.pos), F.f, scl(F.d, -1));
    longsword(S, fr, { s, glow: P.glow, bone: 'weaponR' });
  }
  // Turmschild (linker Unterarm)
  {
    S.layer('body');
    const fa = j('foreArmL'), ha = j('handL');
    const faDir = norm(sub(ha, fa));
    const sc = add(lerp3(fa, ha, 0.5), [0.085 * s, 0, 0]);
    const fr = frame(sc, [0, 0, 1], scl(faDir, -1));
    towerShield(S, fr, { s: s * 0.86, bone: 'weaponL', glow: P.glow, face: 'secondary', rim: 'primary', gold: 'metal' });
  }

  // ======================= Glühen (Stufen) =======================
  S.layer('glow');
  S.sphere([0, chest[1] + 0.085 * s, 0.178 * s], 0.011 * s, { mat: 'glow', col: P.glow, glow: 3.2, region: 'torso', tier: 3 });
  S.sym(() => S.sphere(add(j('shinL'), [0, 0.012 * s, 0.083 * s]), 0.012 * s, { mat: 'glow', col: P.glow, glow: 3, bind: (p) => [['shinL', 1]], tier: 6 }));
  S.layer('body');

  return { radius: 0.55 * s, style: 'knight' };
}

const P0 = (v) => [v.x, v.y, v.z];
