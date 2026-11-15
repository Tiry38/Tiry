// Aether-Forge – SDF-Bildhauerei: Figuren als vorzeichenbehaftete Distanzfelder (Primitive + weiche Boolesche
// Operationen + Detailfunktionen). Läuft nur beim Modell-Backen (node scripts/forge-models.mjs), nie im Spiel.
//
//   const S = new Sculpt({ palette });
//   S.capsule(a, b, r, { mat: 'steel', col: 'primary', bone: 'upperArmL', k: 0.02 });
//   S.group({ k: 0.01 }, () => { ... });       // Untergruppe (Ergebnis wird mit op/k in die Eltern gemischt)
//   S.shell({ off: 0.01, th: 0.006, clip }, () => { ... })  // Panzer-Schale als Versatzfläche einer Form
//   S.sym(() => { ... });                       // links bauen (+X), rechts gespiegelt (Knochen L↔R)
//
// Jedes Blatt trägt Attribute: mat (Materialklasse), col (Farbe/Palettenplatz), bone/bind/region (Skin), tier.
// Koordinaten: Meter, Füße y = 0, Blick +Z, links = +X (wie das Helden-Rig).

export const BIG = 1e9;
const { sqrt, abs, min, max, sin, cos, atan2, floor } = Math;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const mix = (a, b, t) => a + (b - a) * t;

// ---------------------------------------------------------------------------------------------
// Vektor-Hilfen (Arrays [x,y,z] oder THREE.Vector3)
// ---------------------------------------------------------------------------------------------
export const P = (p) => (Array.isArray(p) ? [p[0], p[1], p[2]] : [p.x, p.y, p.z]);
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scl = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a) => sqrt(dot(a, a));
export const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const lerp3 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
export const madd = (a, d, k) => [a[0] + d[0] * k, a[1] + d[1] * k, a[2] + d[2] * k];

/** Rotationsmatrix (Spalten = lokale Achsen in Welt) aus Euler XYZ */
export function eulerBasis(rx = 0, ry = 0, rz = 0) {
  const a = cos(rx), b = sin(rx), c = cos(ry), d = sin(ry), e = cos(rz), f = sin(rz);
  // R = Rx * Ry * Rz (wie THREE 'XYZ')
  const ae = a * e, af = a * f, be = b * e, bf = b * f;
  const m = [
    c * e, -c * f, d,
    af + be * d, ae - bf * d, -b * c,
    bf - ae * d, be + af * d, a * c,
  ];
  // Spalten
  return { x: [m[0], m[3], m[6]], y: [m[1], m[4], m[7]], z: [m[2], m[5], m[8]] };
}
/** Basis aus gewünschter lokaler Y-Achse (+ optional Hinweis für lokale Z-Achse) */
export function basisY(dir, hint = [0, 0, 1]) {
  const y = norm(P(dir));
  let h = P(hint);
  if (abs(dot(h, y)) > 0.98) h = abs(y[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const x = norm(cross(y, h));
  const z = cross(x, y);
  return { x, y, z };
}
export function basisFrom(o) {
  if (!o) return null;
  if (o.basis) return basisFrom(o.basis);
  if (o.x && o.y && o.z) return { x: P(o.x), y: P(o.y), z: P(o.z) };
  if (Array.isArray(o)) return eulerBasis(o[0], o[1], o[2]);
  return null;
}
export function rotBasis(B, rx = 0, ry = 0, rz = 0) {
  // B * R(euler) – lokale Zusatzdrehung
  const R = eulerBasis(rx, ry, rz);
  const col = (v) => [B.x[0] * v[0] + B.y[0] * v[1] + B.z[0] * v[2], B.x[1] * v[0] + B.y[1] * v[1] + B.z[1] * v[2], B.x[2] * v[0] + B.y[2] * v[1] + B.z[2] * v[2]];
  return { x: col(R.x), y: col(R.y), z: col(R.z) };
}

// ---------------------------------------------------------------------------------------------
// 2D-Hilfen (Profile)
// ---------------------------------------------------------------------------------------------
/** exakter Abstand zu einem Polygon (iq), negativ innen. pts: [[x,y],...] */
export function sdPoly2(pts) {
  const n = pts.length, xs = new Float64Array(n), ys = new Float64Array(n);
  for (let i = 0; i < n; i++) { xs[i] = pts[i][0]; ys[i] = pts[i][1]; }
  return (px, py) => {
    let d = (px - xs[0]) * (px - xs[0]) + (py - ys[0]) * (py - ys[0]);
    let s = 1;
    for (let i = 0, j = n - 1; i < n; j = i, i++) {
      const ex = xs[j] - xs[i], ey = ys[j] - ys[i];
      const wx = px - xs[i], wy = py - ys[i];
      const t = clamp((wx * ex + wy * ey) / (ex * ex + ey * ey || 1e-12), 0, 1);
      const bx = wx - ex * t, by = wy - ey * t;
      const dd = bx * bx + by * by;
      if (dd < d) d = dd;
      const c1 = py >= ys[i], c2 = py < ys[j], c3 = ex * wy > ey * wx;
      if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) s = -s;
    }
    return s * sqrt(d);
  };
}
/** Catmull-Rom-Glättung eines geschlossenen/offenen 2D-Polygons */
export function smoothPoly(pts, sub = 4, closed = true) {
  const out = [], n = pts.length;
  const at = (i) => (closed ? pts[(i + n) % n] : pts[clamp(i, 0, n - 1)]);
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    for (let k = 0; k < sub; k++) {
      const t = k / sub, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  if (!closed) out.push(pts[n - 1]);
  return out;
}

// ---------------------------------------------------------------------------------------------
// Rauschen (deterministisch) für Detailfunktionen
// ---------------------------------------------------------------------------------------------
function hash3(x, y, z) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
export function vnoise(x, y, z) {
  const ix = floor(x), iy = floor(y), iz = floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), uz = fz * fz * (3 - 2 * fz);
  const a = hash3(ix, iy, iz), b = hash3(ix + 1, iy, iz), c = hash3(ix, iy + 1, iz), d = hash3(ix + 1, iy + 1, iz);
  const e = hash3(ix, iy, iz + 1), f = hash3(ix + 1, iy, iz + 1), g = hash3(ix, iy + 1, iz + 1), h = hash3(ix + 1, iy + 1, iz + 1);
  return mix(mix(mix(a, b, ux), mix(c, d, ux), uy), mix(mix(e, f, ux), mix(g, h, ux), uy), uz) * 2 - 1;
}
export function fbm(x, y, z, oct = 3) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f, z * f); f *= 2.03; a *= 0.5; }
  return s;
}

// ---------------------------------------------------------------------------------------------
// Detailfunktionen (Verschiebung der Distanz; Argumente: lokale Koordinaten lx,ly,lz + Welt x,y,z)
// Jede liefert { fn, amp } – amp erweitert die Hüllbox.
// ---------------------------------------------------------------------------------------------
export const Detail = {
  /** Stofffalten: Wellen um die lokale Y-Achse (Röcke, Roben), nach unten tiefer. */
  folds({ amp = 0.008, n = 9, axis = 'y', top = 0, bottom = -1, wobble = 0.6, seed = 0, sharp = 0.5 } = {}) {
    return {
      amp: amp * 1.6,
      fn: (lx, ly, lz) => {
        const a = atan2(lx, lz);
        const v = clamp((top - ly) / (top - bottom || 1), 0, 1);
        const w = sin(a * n + seed + wobble * sin(ly * 7 + seed) + 0.8 * sin(a * 3 + seed * 2));
        const s = w > 0 ? Math.pow(w, 1 - sharp * 0.5) : -Math.pow(-w, 1 + sharp);
        return -amp * s * (0.25 + 0.75 * v);
      },
    };
  },
  /** Ziehfalten quer (z.B. Ärmel, Hosen): Wellen entlang lokal Y */
  bunch({ amp = 0.004, freq = 40, seed = 0 } = {}) {
    return { amp, fn: (lx, ly, lz) => -amp * abs(sin(ly * freq + 2.0 * sin(atan2(lx, lz) * 2 + seed))) };
  },
  /** Steppung (Gambeson): Rautenmuster eingedrückter Nähte */
  quilt({ amp = 0.004, cell = 0.05, width = 0.25 } = {}) {
    return {
      amp,
      fn: (lx, ly, lz, x, y, z) => {
        const u = (atan2(lx, lz) * 0.16 + ly) / cell, v = (atan2(lx, lz) * 0.16 - ly) / cell;
        const du = abs(u - Math.round(u)), dv = abs(v - Math.round(v));
        const g = min(du, dv);
        return g < width ? amp * (1 - g / width) * (1 - g / width) : 0;
      },
    };
  },
  /** Gehämmert / Gussstruktur */
  hammered({ amp = 0.0012, freq = 60 } = {}) {
    return { amp, fn: (lx, ly, lz, x, y, z) => amp * vnoise(x * freq, y * freq, z * freq) };
  },
  /** organisch (Rinde, Stein, Haut von Bestien) */
  noise({ amp = 0.01, freq = 12, oct = 3, ridged = false } = {}) {
    return {
      amp,
      fn: (lx, ly, lz, x, y, z) => {
        const n = fbm(x * freq, y * freq, z * freq, oct);
        return amp * (ridged ? 1 - 2 * abs(n) : n);
      },
    };
  },
  /** Rinde: vertikale Furchen */
  bark({ amp = 0.012, n = 14, freq = 10 } = {}) {
    return {
      amp: amp * 1.5,
      fn: (lx, ly, lz, x, y, z) => {
        const a = atan2(lx, lz) * n + 1.5 * fbm(x * freq * 0.5, y * freq * 0.25, z * freq * 0.5, 2) * 3;
        const r = 1 - abs(sin(a));
        return amp * (r * r * r - 0.2) + amp * 0.35 * fbm(x * freq * 3, y * freq, z * freq * 3, 2);
      },
    };
  },
  /** Muskeldefinition: weiche Beulen entlang lokal Y */
  muscle({ amp = 0.004, freq = 18, seed = 0 } = {}) {
    return { amp, fn: (lx, ly, lz) => -amp * (0.5 + 0.5 * sin(ly * freq + seed)) * (0.6 + 0.4 * cos(atan2(lx, lz) * 2 + seed)) };
  },
  /** Fell: Strähnenbüschel */
  fur({ amp = 0.012, freq = 22, dir = [0, -0.3, -1] } = {}) {
    const d = norm(dir);
    return {
      amp: amp * 1.3,
      fn: (lx, ly, lz, x, y, z) => {
        const s = x * d[0] + y * d[1] + z * d[2];
        const q = fbm(x * freq - d[0] * s * freq * 0.7, y * freq - d[1] * s * freq * 0.7, z * freq - d[2] * s * freq * 0.7, 2);
        return -amp * (0.5 + 0.5 * q) - amp * 0.4 * abs(sin(fbm(x * freq * 2.5, y * freq * 2.5, z * freq * 2.5, 1) * 6));
      },
    };
  },
  /** Kettenhemd-artige Struktur */
  mail({ amp = 0.0015, cell = 0.009 } = {}) {
    return {
      amp,
      fn: (lx, ly, lz, x, y, z) => {
        const u = (atan2(lx, lz) * 0.12) / cell, v = ly / (cell * 0.8) + (floor(u) % 2) * 0.5;
        const fu = u - floor(u) - 0.5, fv = v - floor(v) - 0.5;
        return -amp * (1 - min(1, sqrt(fu * fu + fv * fv) * 2.2));
      },
    };
  },
  /** Kombination mehrerer Details */
  sum(...ds) { ds = ds.filter(Boolean); return { amp: ds.reduce((a, d) => a + d.amp, 0), fn: (a, b, c, x, y, z) => { let s = 0; for (const d of ds) s += d.fn(a, b, c, x, y, z); return s; } }; },
  /** Maske (lokal Y-Bereich) */
  mask(d, fnMask) { return { amp: d.amp, fn: (a, b, c, x, y, z) => { const m = fnMask(a, b, c, x, y, z); return m > 0 ? d.fn(a, b, c, x, y, z) * m : 0; } }; },
};

// ---------------------------------------------------------------------------------------------
// Primitive in lokaler Form: { f(lx,ly,lz) → d, box: [x0,y0,z0,x1,y1,z1] (lokal) }
// ---------------------------------------------------------------------------------------------
const PRIM = {
  sphere(r) { return { f: (x, y, z) => sqrt(x * x + y * y + z * z) - r, box: [-r, -r, -r, r, r, r] }; },
  ellipsoid(rx, ry, rz) {
    return {
      f: (x, y, z) => {
        const k0 = sqrt((x / rx) * (x / rx) + (y / ry) * (y / ry) + (z / rz) * (z / rz));
        const k1 = sqrt((x / (rx * rx)) * (x / (rx * rx)) + (y / (ry * ry)) * (y / (ry * ry)) + (z / (rz * rz)) * (z / (rz * rz)));
        if (k1 < 1e-9) return -min(rx, ry, rz);
        return (k0 * (k0 - 1)) / k1;
      },
      box: [-rx, -ry, -rz, rx, ry, rz],
    };
  },
  /** abgerundete Box: halbe Maße h, Rundung r (in h enthalten) */
  box(hx, hy, hz, r = 0) {
    const bx = hx - r, by = hy - r, bz = hz - r;
    return {
      f: (x, y, z) => {
        const qx = abs(x) - bx, qy = abs(y) - by, qz = abs(z) - bz;
        const ox = max(qx, 0), oy = max(qy, 0), oz = max(qz, 0);
        return sqrt(ox * ox + oy * oy + oz * oz) + min(max(qx, max(qy, qz)), 0) - r;
      },
      box: [-hx, -hy, -hz, hx, hy, hz],
    };
  },
  /** Kapsel/abgerundeter Kegel entlang lokal Y von 0..h, Radien r1 (unten) r2 (oben) – exakt (iq) */
  roundCone(r1, r2, h) {
    const b = (r1 - r2) / h, a = sqrt(max(0, 1 - b * b));
    const R = max(r1, r2);
    return {
      f: (x, y, z) => {
        const qx = sqrt(x * x + z * z), qy = y;
        const k = -b * qx + a * qy; // dot(q, vec2(-b,a))
        if (k < 0) return sqrt(qx * qx + qy * qy) - r1;
        if (k > a * h) return sqrt(qx * qx + (qy - h) * (qy - h)) - r2;
        return qx * a + qy * b - r1; // dot(q, vec2(a,b)) - r1
      },
      box: [-R, -r1, -R, R, h + r2, R],
    };
  },
  /** Zylinder (lokal Y, Halbhöhe hh), Kantenrundung rr */
  cylinder(r, hh, rr = 0) {
    return {
      f: (x, y, z) => {
        const dx = sqrt(x * x + z * z) - r + rr, dy = abs(y) - hh + rr;
        return min(max(dx, dy), 0) + sqrt(max(dx, 0) ** 2 + max(dy, 0) ** 2) - rr;
      },
      box: [-r, -hh, -r, r, hh, r],
    };
  },
  /** Torus in lokaler XZ-Ebene; arc < 2π: Bogen um +Z zentriert, mit runden Enden */
  torus(R, r, arc = Math.PI * 2) {
    if (arc >= Math.PI * 2 - 1e-4) return { f: (x, y, z) => { const q = sqrt(x * x + z * z) - R; return sqrt(q * q + y * y) - r; }, box: [-R - r, -r, -R - r, R + r, r, R + r] };
    const half = arc / 2, sc = sin(half), cc = cos(half);
    return {
      f: (x, y, z) => {
        // capped torus (iq): Symmetrie um Z-Achse
        const px = abs(x);
        const k = cc * px > sc * z ? px * sc + z * cc : sqrt(px * px + z * z);
        return sqrt(px * px + y * y + z * z + R * R - 2 * R * k) - r;
      },
      box: [-R - r, -r, -R - r, R + r, r, R + r],
    };
  },
  /** Rotationskörper: Profil [[r,y],...] (geschlossenes Polygon in r≥0) um lokal Y, Rundung rr */
  lathe(profile, rr = 0) {
    const sd = sdPoly2(profile);
    let R = 0, y0 = Infinity, y1 = -Infinity;
    for (const [r, y] of profile) { R = max(R, r); y0 = min(y0, y); y1 = max(y1, y); }
    return { f: (x, y, z) => sd(sqrt(x * x + z * z), y) - rr, box: [-R - rr, y0 - rr, -R - rr, R + rr, y1 + rr, R + rr] };
  },
  /** Extrusion: Polygon in lokal XY, Tiefe hz (halb) entlang Z, Kantenrundung rr */
  extrude(poly, hz, rr = 0) {
    const sd = sdPoly2(poly);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [x, y] of poly) { x0 = min(x0, x); x1 = max(x1, x); y0 = min(y0, y); y1 = max(y1, y); }
    const hzi = hz - rr;
    return {
      f: (x, y, z) => {
        const d = sd(x, y) + rr, wz = abs(z) - hzi;
        return min(max(d, wz), 0) + sqrt(max(d, 0) ** 2 + max(wz, 0) ** 2) - rr;
      },
      box: [x0, y0, -hz, x1, y1, hz],
    };
  },
  /** Halbraum lokal y < 0 (für Schnitte) */
  plane() { return { f: (x, y, z) => y, box: [-BIG, -BIG, -BIG, BIG, 0, BIG] }; },
};

// ---------------------------------------------------------------------------------------------
// Knoten
// ---------------------------------------------------------------------------------------------
let NODE_ID = 0;
const boxOverlap = (a, b) => a[0] <= b[3] && a[3] >= b[0] && a[1] <= b[4] && a[4] >= b[1] && a[2] <= b[5] && a[5] >= b[2];
const boxExpand = (b, e) => [b[0] - e, b[1] - e, b[2] - e, b[3] + e, b[4] + e, b[5] + e];
const boxInter = (a, b) => [max(a[0], b[0]), max(a[1], b[1]), max(a[2], b[2]), min(a[3], b[3]), min(a[4], b[4]), min(a[5], b[5])];

/** Blattknoten (ein Primitiv mit Transformation) */
class Leaf {
  constructor(prim, c, B, o, mirror) {
    this.id = ++NODE_ID;
    this.kind = 'leaf';
    this.op = o.op || 'add';
    this.k = o.k || 0;
    this.attr = o.attr;
    this.attr.leaf = this.id;
    this.paint = !!o.paint;
    const cx = c[0], cy = c[1], cz = c[2];
    // inverse Rotation = Transponierte (Zeilen = lokale Achsen)
    const X = B ? B.x : [1, 0, 0], Y = B ? B.y : [0, 1, 0], Z = B ? B.z : [0, 0, 1];
    const f = prim.f, disp = o.disp ? o.disp.fn : null;
    const sx = mirror ? -1 : 1;
    const ident = !B;
    const scale = o.scale || 1; // gleichmäßige Skalierung (Distanz bleibt korrekt)
    this.ev = ident && !disp && scale === 1
      ? (x, y, z) => f(sx * x - cx, y - cy, z - cz)
      : (x, y, z) => {
        const px = sx * x - cx, py = y - cy, pz = z - cz;
        const lx = (px * X[0] + py * X[1] + pz * X[2]) / scale, ly = (px * Y[0] + py * Y[1] + pz * Y[2]) / scale, lz = (px * Z[0] + py * Z[1] + pz * Z[2]) / scale;
        let d = f(lx, ly, lz) * scale;
        if (disp) d += disp(lx, ly, lz, sx * x, y, z);
        return d;
      };
    // Hüllbox (Welt)
    const lb = prim.box.map((v) => v * scale);
    let bb = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    if (lb[0] < -BIG / 2 || lb[3] > BIG / 2) bb = [-BIG, -BIG, -BIG, BIG, BIG, BIG];
    else for (let i = 0; i < 8; i++) {
      const lx = i & 1 ? lb[3] : lb[0], ly = i & 2 ? lb[4] : lb[1], lz = i & 4 ? lb[5] : lb[2];
      const wx = (cx + X[0] * lx + Y[0] * ly + Z[0] * lz) * sx, wy = cy + X[1] * lx + Y[1] * ly + Z[1] * lz, wz = cz + X[2] * lx + Y[2] * ly + Z[2] * lz;
      bb[0] = min(bb[0], wx); bb[1] = min(bb[1], wy); bb[2] = min(bb[2], wz); bb[3] = max(bb[3], wx); bb[4] = max(bb[4], wy); bb[5] = max(bb[5], wz);
    }
    this.box = boxExpand(bb, (o.disp ? o.disp.amp : 0) + 0.0005);
    this.reach = boxExpand(this.box, this.k);
  }
  prune(bb) { return boxOverlap(this.reach, bb) ? this : null; }
  ea(x, y, z, out) { out.a = this.attr; out.a2 = null; out.w2 = 0; return this.ev(x, y, z); }
}

/** Gruppe: Kinder werden der Reihe nach kombiniert (add/sub/int, weich mit k) */
class Group {
  constructor(o = {}) {
    this.id = ++NODE_ID;
    this.kind = 'group';
    this.op = o.op || 'add';
    this.k = o.k || 0;
    this.children = [];
    this.disp = o.disp || null;
    this.attr = o.attr || null; // Übermalen: ganze Gruppe trägt dieses Attribut
    this.mod = o.mod || null;   // Nachbearbeitung der Gruppendistanz: (d, x,y,z) → d
    this.modAmp = o.modAmp || 0;
    this.paint = !!o.paint;
    if (this.attr) this.attr.leaf = this.id;
  }
  finalize() {
    let bb = null, ib = null;
    for (const c of this.children) {
      if (c.kind === 'group') c.finalize();
      if (c.op === 'add') bb = bb ? [min(bb[0], c.box[0]), min(bb[1], c.box[1]), min(bb[2], c.box[2]), max(bb[3], c.box[3]), max(bb[4], c.box[4]), max(bb[5], c.box[5])] : c.box.slice();
      else if (c.op === 'int') ib = ib ? boxInter(ib, c.box) : c.box.slice();
    }
    if (!bb) bb = [0, 0, 0, -1, -1, -1];
    if (ib) bb = boxInter(bb, ib);
    // weiche Vereinigung kann leicht über die Kinderboxen hinaus wachsen
    let kmax = 0; for (const c of this.children) if (c.op === 'add') kmax = max(kmax, c.k);
    this.box = boxExpand(bb, kmax * 0.3 + (this.disp ? this.disp.amp : 0) + this.modAmp);
    this.reach = boxExpand(this.box, this.k);
    this.build();
  }
  build() {
    const ch = this.children, n = ch.length, disp = this.disp ? this.disp.fn : null, mod = this.mod;
    const ops = ch.map((c) => c.op), ks = ch.map((c) => c.k);
    this.ev = (x, y, z) => {
      let d = BIG;
      for (let i = 0; i < n; i++) {
        const b = ch[i].ev(x, y, z), k = ks[i], op = ops[i];
        if (op === 'add') {
          if (k > 0) { const h = max(k - abs(d - b), 0) / k; d = min(d, b) - h * h * k * 0.25; } else if (b < d) d = b;
        } else if (op === 'sub') {
          if (k > 0) { const h = max(k - abs(d + b), 0) / k; d = max(d, -b) + h * h * k * 0.25; } else if (-b > d) d = -b;
        } else { // int
          if (k > 0) { const h = max(k - abs(d - b), 0) / k; d = max(d, b) + h * h * k * 0.25; } else if (b > d) d = b;
        }
      }
      if (disp && d < 0.05) d += disp(x, y, z, x, y, z);
      if (mod) d = mod(d, x, y, z);
      return d;
    };
  }
  prune(bb) {
    if (!boxOverlap(this.reach, bb)) return null;
    const kids = [];
    let hasAdd = false;
    for (const c of this.children) {
      const p = c.prune(bb);
      if (!p) { if (c.op === 'int') return null; continue; }
      if (p.op === 'add') hasAdd = true;
      else if (!hasAdd) continue; // sub/int vor dem ersten add wirkt auf nichts
      kids.push(p);
    }
    if (!hasAdd) return null;
    if (kids.length === this.children.length && kids.every((k, i) => k === this.children[i])) return this;
    if (kids.length === 1 && !this.disp && !this.mod && !this.attr) {
      const only = kids[0];
      if (only.op === 'add' && (only.k === 0 || true)) {
        // Gruppe mit einem Kind: Kind übernimmt Gruppenoperation
        return { __proto__: only, op: this.op, k: this.k, reach: this.reach };
      }
    }
    const g = Object.create(Group.prototype);
    Object.assign(g, this, { children: kids });
    g.build();
    return g;
  }
  /** Distanz + Besitzer-Attribut (für Farben/Material/Skin) */
  ea(x, y, z, out) {
    const ch = this.children, n = ch.length;
    let d = BIG, A = null, A2 = null, W2 = 0;
    const tmp = { a: null, a2: null, w2: 0 };
    for (let i = 0; i < n; i++) {
      const c = ch[i];
      const b = c.ea(x, y, z, tmp), k = c.k, op = c.op;
      if (op === 'add') {
        if (A === null) { d = b; A = tmp.a; A2 = tmp.a2; W2 = tmp.w2; continue; }
        // Mischgewicht des neuen Kindes
        const wb = k > 0 ? clamp(0.5 + 0.5 * (d - b) / k, 0, 1) : b < d ? 1 : 0;
        if (k > 0) { const h = max(k - abs(d - b), 0) / k; d = min(d, b) - h * h * k * 0.25; } else if (b < d) d = b;
        if (wb >= 0.5) { A2 = A; W2 = 1 - wb; A = tmp.a; } else if (wb > W2) { A2 = tmp.a; W2 = wb; }
      } else if (op === 'sub') {
        const nd = k > 0 ? (() => { const h = max(k - abs(d + b), 0) / k; return max(d, -b) + h * h * k * 0.25; })() : max(d, -b);
        if (c.paint && -b >= d - 1e-6) { A = tmp.a; A2 = null; W2 = 0; }
        d = nd;
      } else {
        const nd = k > 0 ? (() => { const h = max(k - abs(d - b), 0) / k; return max(d, b) + h * h * k * 0.25; })() : max(d, b);
        if (c.paint && b >= d - 1e-6) { A = tmp.a; A2 = null; W2 = 0; }
        d = nd;
      }
    }
    if (this.disp && d < 0.05) d += this.disp.fn(x, y, z, x, y, z);
    if (this.mod) d = this.mod(d, x, y, z);
    if (this.attr) { A = this.attr; A2 = null; W2 = 0; }
    out.a = A; out.a2 = A2; out.w2 = W2;
    return d;
  }
}

// ---------------------------------------------------------------------------------------------
// Bildhauer (Autorensprache)
// ---------------------------------------------------------------------------------------------
export const MIRROR_NAME = (n) => (typeof n === 'string' ? n.replace(/(L|R)(\d*)$/, (m, a, d) => (a === 'L' ? 'R' : 'L') + d) : n);

export class Sculpt {
  constructor(o = {}) {
    this.palette = o.palette || {};
    this.roots = {};             // 'layer@tier' → Group
    this.layerName = 'body';
    this.stack = [];
    this.mirror = false;
    this.defaults = {};
    this.minTh = o.minTh || 0; this.minThFine = o.minThFine || 0;   // dünne Schalen vermeiden (≥ 2 Zellen, sonst nicht-mannigfaltig)
  }
  _root(tier = 0) {
    const key = `${this.layerName}@${tier | 0}`;
    return this.roots[key] || (this.roots[key] = new Group({}));
  }
  layer(name) { this.layerName = name; return this; }
  /** Standard-Attribute für folgende Teile setzen (mat, col, bone, region …) */
  with(o, fn) { const prev = this.defaults; this.defaults = { ...prev, ...o }; try { fn(); } finally { this.defaults = prev; } return this; }

  _attr(o) {
    const m = this.mirror;
    const a = {
      mat: o.mat ?? this.defaults.mat ?? 'cloth',
      col: o.col ?? this.defaults.col ?? '#808080',
      k: o.glow ?? this.defaults.glow ?? 1,  // Glüh-Faktor (nur Glüh-Ebene)
      bone: o.bone ?? this.defaults.bone ?? null,
      bind: o.bind ?? this.defaults.bind ?? null,
      region: o.region ?? this.defaults.region ?? null,
      vary: o.vary ?? this.defaults.vary ?? 0.06,
      grad: o.grad ?? this.defaults.grad ?? null,
      wear: o.wear ?? this.defaults.wear ?? 1,
      ub: o.ub ?? this.defaults.ub ?? null,     // Einheiten-Knochen
      tag: o.tag ?? null,
      mirror: m,
    };
    if (m) {
      a.bone = MIRROR_NAME(a.bone);
      if (Array.isArray(a.region)) a.region = a.region.map(MIRROR_NAME); else if (typeof a.region === 'string') a.region = MIRROR_NAME(a.region);
      if (a.ub) a.ub = MIRROR_NAME(a.ub);
      if (typeof a.bind === 'function') { const f = a.bind; a.bind = (p) => f([-p[0], p[1], p[2]]).map(([b, w]) => [MIRROR_NAME(b), w]); }
    }
    return a;
  }
  _push(node, tier) {
    const parent = this.stack.length ? this.stack[this.stack.length - 1] : this._root(tier);
    parent.children.push(node);
    return node;
  }
  _leaf(prim, c, B, o) {
    o = { ...o };
    // Ausrüstungs-Tausch (Entwicklungsstufen): Standardwaffen bestimmter Knochen weglassen
    if (this.suppress && this.suppress.size && this.suppress.has(o.bone ?? this.defaults.bone)) return null;
    const tier = o.tier ?? this.defaults.tier ?? 0;
    const leaf = new Leaf(prim, P(c), B, { op: o.op, k: o.k ?? (o.op ? 0 : this.defaults.k ?? 0), disp: o.disp ?? this.defaults.disp, attr: this._attr(o), paint: o.paint, scale: o.scale }, this.mirror);
    return this._push(leaf, tier);
  }

  // ---- Primitive ----
  sphere(c, r, o = {}) { return this._leaf(PRIM.sphere(r), c, basisFrom(o.rot), o); }
  ellipsoid(c, r, o = {}) { return this._leaf(PRIM.ellipsoid(r[0], r[1], r[2]), c, basisFrom(o.rot), o); }
  box(c, h, o = {}) { return this._leaf(PRIM.box(h[0], h[1], h[2], o.r ?? 0), c, basisFrom(o.rot), o); }
  cylinder(c, r, hh, o = {}) { return this._leaf(PRIM.cylinder(r, hh, o.r ?? 0), c, basisFrom(o.rot), o); }
  torus(c, R, r, o = {}) { return this._leaf(PRIM.torus(R, r, o.arc), c, basisFrom(o.rot), o); }
  lathe(c, profile, o = {}) { return this._leaf(PRIM.lathe(profile, o.r ?? 0), c, basisFrom(o.rot), o); }
  extrude(c, poly, hz, o = {}) { return this._leaf(PRIM.extrude(o.smooth ? smoothPoly(poly, o.smooth) : poly, hz, o.r ?? 0), c, basisFrom(o.rot), o); }
  /** eigenes Primitiv: { f(lx,ly,lz) → d, box: [x0,y0,z0,x1,y1,z1] } im lokalen Rahmen */
  prim(c, prim, o = {}) { return this._leaf(prim, c, basisFrom(o.rot), o); }
  plane(c, normal, o = {}) { return this._leaf(PRIM.plane(), c, basisY(normal), o); }
  /** Kapsel / Kegelstumpf mit runden Enden zwischen a und b */
  capsule(a, b, r1, r2 = r1, o = {}) {
    if (typeof r2 === 'object') { o = r2; r2 = r1; }
    a = P(a); b = P(b);
    const d = sub(b, a), h = len(d);
    if (h < 1e-6) return this.sphere(a, max(r1, r2), o);
    return this._leaf(PRIM.roundCone(r1, r2, h), a, basisY(d, o.hint || [0, 0, 1]), o);
  }
  /** Röhre entlang Punkten mit Radien (Haarsträhnen, Hörner, Riemen) */
  tube(pts, radii, o = {}) {
    pts = pts.map(P);
    const r = typeof radii === 'function' ? pts.map((_, i) => radii(i / (pts.length - 1))) : Array.isArray(radii) ? (radii.length === pts.length ? radii : pts.map((_, i) => mix(radii[0], radii[radii.length - 1], i / (pts.length - 1)))) : pts.map(() => radii);
    return this.group({ op: o.op, k: o.k ?? 0, tier: o.tier, paint: o.paint }, () => {
      for (let i = 0; i < pts.length - 1; i++) this.capsule(pts[i], pts[i + 1], r[i], r[i + 1], { ...o, op: 'add', k: o.kj ?? 0, tier: undefined });
    });
  }

  // ---- Gruppen ----
  group(o, fn) {
    if (typeof o === 'function') { fn = o; o = {}; }
    const tier = o.tier ?? this.defaults.tier ?? 0;
    const g = new Group({ op: o.op, k: o.k ?? 0, disp: o.disp, attr: o.attr ? this._attr(o.attr) : null, mod: o.mod, modAmp: o.modAmp, paint: o.paint });
    this._push(g, tier);
    this.stack.push(g);
    const prevD = this.defaults;
    if (o.tier !== undefined) this.defaults = { ...prevD, tier: undefined };
    try { fn(); } finally { this.stack.pop(); this.defaults = prevD; }
    return g;
  }
  /** Schale (Panzer, Stoffschicht) um die Form der Kinder: Abstand off, Dicke th, optionaler Schnitt clip(x,y,z)→d (≤0 = behalten) */
  shell(o, fn) {
    const off = o.off ?? 0, minTh = this.layerName.endsWith(':fine') ? this.minThFine : this.minTh;
    const th = Math.max(o.th ?? 0.006, minTh || 0);
    const clip = o.clip || null, ck = o.ck ?? th * 0.6;
    const mirror = this.mirror;
    const mod = (d, x, y, z) => {
      let s = abs(d - off - th * 0.5) - th * 0.5;
      if (clip) {
        const c = clip(mirror ? -x : x, y, z);
        if (ck > 0) { const h = Math.max(ck - Math.abs(s - c), 0) / ck; s = Math.max(s, c) + h * h * ck * 0.25; } else if (c > s) s = c;
      }
      return s;
    };
    return this.group({ ...o, mod, modAmp: off + th, attr: o.attr || { mat: o.mat, col: o.col, bone: o.bone, region: o.region, bind: o.bind, vary: o.vary, wear: o.wear, grad: o.grad, ub: o.ub } }, fn);
  }
  /** links bauen, rechts gespiegelt */
  sym(fn) {
    fn(false);
    const prev = this.mirror;
    this.mirror = !prev;
    try { fn(true); } finally { this.mirror = prev; }
    return this;
  }
  /** Spiegelung umschalten (für Einzelteile, die nur rechts sitzen sollen) */
  mirrored(fn) { const prev = this.mirror; this.mirror = !prev; try { fn(); } finally { this.mirror = prev; } }

  /** Alle Wurzeln fertigstellen → { key: Group } */
  finish() {
    for (const g of Object.values(this.roots)) g.finalize();
    return this.roots;
  }
}

/** Gradient (Normale) einer Distanzfunktion */
export function gradient(f, x, y, z, e = 0.0015) {
  // Tetraeder-Verfahren (4 Auswertungen)
  const a = f(x + e, y - e, z - e), b = f(x - e, y - e, z + e), c = f(x - e, y + e, z - e), d = f(x + e, y + e, z + e);
  let nx = a - b - c + d, ny = -a - b + c + d, nz = -a + b - c + d;
  const l = sqrt(nx * nx + ny * ny + nz * nz) || 1;
  return [nx / l, ny / l, nz / l];
}

export { clamp, mix, Group, PRIM };
