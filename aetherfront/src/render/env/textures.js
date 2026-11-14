// Prozedural erzeugte Texturen (DataTexture, keine externen Dateien).
import * as THREE from 'three';
import { rng, noise2, fbm2, worley2, smoothstep, clamp, lerp } from './noise.js';

function dataTex(data, size, { srgb = false, repeat = true } = {}) {
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

/** Höhenfeld (kachelbar) → Normalmap-Daten (RGBA, A = optional extra). */
export function heightToNormal(height, size, strength, extra = null) {
  const normal = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    const y0 = ((y - 1 + size) % size) * size, y1 = ((y + 1) % size) * size, yr = y * size;
    for (let x = 0; x < size; x++) {
      const x0 = (x - 1 + size) % size, x1 = (x + 1) % size;
      // Sobel
      const tl = height[y0 + x0], t = height[y0 + x], tr = height[y0 + x1];
      const l = height[yr + x0], r = height[yr + x1];
      const bl = height[y1 + x0], b = height[y1 + x], br = height[y1 + x1];
      const dx = (tr + 2 * r + br) - (tl + 2 * l + bl);
      const dy = (bl + 2 * b + br) - (tl + 2 * t + tr);
      let nx = -dx * strength, ny = dy * strength, nz = 1;
      const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len; nz /= len;
      const i = (yr + x) * 4;
      normal[i] = (nx * 0.5 + 0.5) * 255; normal[i + 1] = (ny * 0.5 + 0.5) * 255; normal[i + 2] = (nz * 0.5 + 0.5) * 255;
      normal[i + 3] = extra ? clamp(extra[yr + x], 0, 1) * 255 : 255;
    }
  }
  return normal;
}

const srgbToLin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

/**
 * Steinplatten-Boden (kachelbar, 1 Kachel = 8 Welteinheiten), PBR:
 *  map (Albedo, sRGB) · normalMap · ormMap (R = Umgebungsverdeckung, G = Rauheit, B = 0).
 * Unregelmäßige, leicht verkippte Kalk-/Sandsteinplatten mit abgenutzten, abgeplatzten Kanten,
 * vertieften Fugen mit Schmutz und Moos, Rissen, Poren und Flecken.
 */
export function createFlagstoneTextures(size = 1024) {
  const R = rng(7);
  const rowH = [];
  let accH = 0;
  while (accH < 0.999) { const h = Math.min(1 - accH, [0.125, 0.1875, 0.25, 0.1875][Math.floor(R() * 4)]); rowH.push([accH, h]); accH += h; }
  const rows = rowH.length;
  const PALETTE = [
    [0.66, 0.62, 0.56], [0.60, 0.57, 0.53], [0.70, 0.64, 0.55], [0.55, 0.53, 0.51], [0.64, 0.58, 0.50], [0.58, 0.56, 0.55],
  ];
  const rowStones = [];
  for (let r = 0; r < rows; r++) {
    const widths = [];
    let acc = 0;
    while (acc < 1) { const w = rowH[r][1] * (0.85 + R() * 1.5); widths.push(w); acc += w; }
    const scale = 1 / acc;
    let x = R();
    rowStones.push(widths.map((w) => {
      const c = PALETTE[Math.floor(R() * PALETTE.length)];
      const k = 0.9 + R() * 0.18;
      const s = {
        x0: x, w: w * scale, col: [c[0] * k, c[1] * k, c[2] * k], id: R() * 100,
        tiltX: (R() - 0.5) * 0.9, tiltY: (R() - 0.5) * 0.9, lift: (R() - 0.5) * 0.25, worn: R(),
        crack: R() < 0.28 ? { a: R() * Math.PI, o: (R() - 0.5) * 0.5 } : null,
      };
      x += w * scale;
      return s;
    }));
  }
  const N = size * size;
  const height = new Float32Array(N);
  const albedo = new Uint8Array(N * 4);
  const orm = new Uint8Array(N * 4);
  const grout = 0.0042, bevel = 0.016;
  const P = size / 8; // Perioden für kachelbares Rauschen (je 1/8 Kachel)
  for (let py = 0; py < size; py++) {
    const v = (py + 0.5) / size;
    let r = 0;
    while (r < rows - 1 && v >= rowH[r + 1][0]) r++;
    const fy = (v - rowH[r][0]) / rowH[r][1];
    const rh = rowH[r][1];
    const stones = rowStones[r];
    for (let px = 0; px < size; px++) {
      const u = (px + 0.5) / size;
      let st = stones[0], lu = 0;
      for (const s of stones) {
        let d = u - s.x0; d -= Math.floor(d);
        if (d < s.w) { st = s; lu = d / s.w; break; }
      }
      // Kantenabstand (Kachel-Einheiten) mit gerundeten Ecken + unregelmäßigem Rand
      const ex = Math.min(lu, 1 - lu) * st.w, ey = Math.min(fy, 1 - fy) * rh;
      const cr = 0.022;
      const cx = Math.max(0, cr - ex), cy = Math.max(0, cr - ey);
      let dEdge = Math.min(ex, ey);
      if (cx > 0 && cy > 0) dEdge = cr - Math.hypot(cx, cy);
      const warp = fbm2(u * 24, v * 24, 4, 3, 24) * 0.009 + fbm2(u * 96, v * 96, 2, 4, 96) * 0.0025;
      const chipN = fbm2(u * 40, v * 40, 3, 5, 40) * 0.5 + 0.5;
      const chip = smoothstep(0.58, 0.85, chipN) * 0.022;
      const nearEdge = 1 - smoothstep(0, 0.035, dEdge);
      dEdge += warp - chip * nearEdge;
      // Oberflächen-Detail
      const n1 = fbm2(u * 16, v * 16, 4, 11 + (st.id | 0), 16);  // Flecken
      const n0 = fbm2(u * 6, v * 6, 3, 13 + (st.id | 0), 6);     // großflächige Wellung
      const n2 = fbm2(u * 64, v * 64, 3, 23, 64);                 // Körnung
      const n3 = noise2(u * 256, v * 256, 31, 256);               // feine Poren
      const pit = smoothstep(0.12, 0.0, worley2(u * 140, v * 140, 140, 41)) * 0.6;
      const lx = (lu - 0.5) * st.w, ly = (fy - 0.5) * rh;
      let crack = 0;
      if (st.crack) {
        const ca = st.crack.a;
        const dl = Math.abs(Math.cos(ca) * ly - Math.sin(ca) * lx - st.crack.o * Math.min(st.w, rh) * 0.4 + fbm2(u * 40, v * 40, 3, 61, 40) * 0.012);
        crack = (1 - smoothstep(0.0004, 0.0022, dl)) * smoothstep(0.004, 0.03, dEdge) * (0.6 + 0.4 * smoothstep(-0.2, 0.3, n1));
      }
      const bevel = 0.009 + 0.01 * (fbm2(u * 20, v * 20, 2, 9, 20) * 0.5 + 0.5);
      const inStone = smoothstep(grout * 0.6, grout + 0.0015, dEdge);
      const bev = Math.pow(smoothstep(grout, grout + bevel, dEdge), 0.55);
      let h = bev * (0.62 + st.lift * 0.25 + (st.tiltX * lx + st.tiltY * ly) * 1.6 + n0 * 0.09)
        + bev * (n1 * 0.04 + n2 * 0.022 + n3 * 0.012 - pit * 0.035) - crack * 0.1;
      h = h * inStone + (1 - inStone) * (0.04 + n2 * 0.03);
      height[py * size + px] = h;
      // Moos/Schmutz in den Fugen
      const mossN = fbm2(u * 6, v * 6, 4, 77, 6) * 0.5 + 0.5;
      const nearG = 1 - smoothstep(grout * 0.5, grout + 0.012, dEdge);
      const moss = clamp(smoothstep(0.5, 0.72, mossN + n2 * 0.1) * (nearG * 1.1 + smoothstep(0.62, 0.8, mossN) * 0.25 * (1 - st.worn)), 0, 1);
      // Farbe
      let [cr0, cg0, cb0] = st.col;
      const stain = 1 + n1 * 0.2 + n0 * 0.1 + n2 * 0.08 + n3 * 0.04 - pit * 0.25;
      cr0 *= stain; cg0 *= stain; cb0 *= stain * 0.99;
      // Eisen-/Wasserflecken (warm) und Flechten (hell, punktförmig)
      const iron = smoothstep(0.35, 0.75, fbm2(u * 10, v * 10, 3, 57 + (st.id | 0), 10)) * 0.5;
      cr0 *= 1 + iron * 0.12; cg0 *= 1 + iron * 0.02; cb0 *= 1 - iron * 0.12;
      const lich = smoothstep(0.16, 0.04, worley2(u * 180, v * 180, 180, 71)) * smoothstep(0.55, 0.8, fbm2(u * 8, v * 8, 2, 73, 8) * 0.5 + 0.5);
      cr0 = lerp(cr0, 0.80, lich * 0.55); cg0 = lerp(cg0, 0.80, lich * 0.55); cb0 = lerp(cb0, 0.68, lich * 0.55);
      const dirt = (1 - smoothstep(grout, grout + bevel * 2.2, dEdge)) * 0.45;  // Schmutz am Kantenfuß
      cr0 = lerp(cr0, 0.30, dirt); cg0 = lerp(cg0, 0.27, dirt); cb0 = lerp(cb0, 0.23, dirt);
      const lip = smoothstep(grout + bevel * 0.5, grout + bevel, dEdge) * (1 - smoothstep(grout + bevel, grout + bevel * 2.0, dEdge)) * 0.05;
      cr0 += lip; cg0 += lip; cb0 += lip;                                  // abgeriebene helle Kante
      cr0 *= 1 - crack * 0.5; cg0 *= 1 - crack * 0.5; cb0 *= 1 - crack * 0.5;
      const mg = 0.26 + n2 * 0.05;                                         // Fugenmörtel
      let ar = lerp(mg * 1.04, cr0, inStone), ag = lerp(mg, cg0, inStone), ab = lerp(mg * 0.92, cb0, inStone);
      const mc = [0.24 + n2 * 0.05, 0.31 + n2 * 0.06, 0.11];
      ar = lerp(ar, mc[0], moss * 0.85); ag = lerp(ag, mc[1], moss * 0.85); ab = lerp(ab, mc[2], moss * 0.85);
      const i = (py * size + px) * 4;
      albedo[i] = clamp(ar, 0, 1) * 255; albedo[i + 1] = clamp(ag, 0, 1) * 255; albedo[i + 2] = clamp(ab, 0, 1) * 255; albedo[i + 3] = 255;
      // ORM: Verdeckung in Fugen/Rissen; Rauheit (abgelaufene Mitte glatter)
      const ao = lerp(0.42, 1, smoothstep(grout * 0.3, grout + bevel * 1.2, dEdge)) * (1 - crack * 0.5) * (1 - pit * 0.25);
      const centre = smoothstep(0.02, 0.07, dEdge) * st.worn;
      const rough = clamp(lerp(0.86 - centre * 0.22 + n2 * 0.06 + pit * 0.1, 0.95, 1 - inStone) + moss * 0.05, 0.4, 1);
      orm[i] = ao * 255; orm[i + 1] = rough * 255; orm[i + 2] = 0; orm[i + 3] = 255;
    }
  }
  const normal = heightToNormal(height, size, size / 70);
  return { map: dataTex(albedo, size, { srgb: true }), normalMap: dataTex(normal, size), ormMap: dataTex(orm, size) };
}

/**
 * Waldboden unter dem Gras (kachelbar, 1 Kachel ≈ 7 Welteinheiten):
 *  map: RGB = Erde/Kiesel/Streu-Albedo (sRGB), A = Grasbedeckung · normalMap: RGB Normalen, A = feines Halm-Muster.
 */
export function createGroundTextures(size = 512) {
  const N = size * size;
  const height = new Float32Array(N), blades = new Float32Array(N);
  const albedo = new Uint8Array(N * 4);
  for (let py = 0; py < size; py++) {
    const v = (py + 0.5) / size;
    for (let px = 0; px < size; px++) {
      const u = (px + 0.5) / size;
      const n1 = fbm2(u * 8, v * 8, 4, 101, 8);
      const n2 = fbm2(u * 32, v * 32, 3, 103, 32);
      const peb = worley2(u * 48 + n2 * 0.4, v * 48, 48, 107);
      const pebble = smoothstep(0.36, 0.14, peb) * smoothstep(0.55, 0.8, fbm2(u * 4, v * 4, 3, 109, 4) * 0.5 + 0.5);
      // Halm-Streifen: gerichtetes Rauschen in drei Richtungen
      let bl = 0;
      for (let k = 0; k < 3; k++) {
        const a = k * 2.1 + 0.3, ca = Math.cos(a), sa = Math.sin(a);
        const uu = u * ca - v * sa, vv = u * sa + v * ca;
        bl += noise2(uu * 220, vv * 28, 111 + k) / 3;
      }
      const cover = clamp(smoothstep(-0.35, 0.35, n1 + n2 * 0.4) * (1 - pebble * 0.9), 0, 1);
      const h = pebble * 0.6 + n2 * 0.15 + cover * bl * 0.35;
      height[py * size + px] = h;
      blades[py * size + px] = 0.35 + bl * 0.65;
      const soil = 0.85 + n2 * 0.25;
      let r = 0.30 * soil, g = 0.24 * soil, b = 0.17 * soil;
      // Laubstreu/trockene Halme
      const litter = smoothstep(0.55, 0.8, noise2(u * 90, v * 90, 113)) * 0.6;
      r = lerp(r, 0.45, litter); g = lerp(g, 0.38, litter); b = lerp(b, 0.22, litter);
      r = lerp(r, 0.50 + n2 * 0.08, pebble); g = lerp(g, 0.48 + n2 * 0.08, pebble); b = lerp(b, 0.45 + n2 * 0.08, pebble);
      const i = (py * size + px) * 4;
      albedo[i] = clamp(r, 0, 1) * 255; albedo[i + 1] = clamp(g, 0, 1) * 255; albedo[i + 2] = clamp(b, 0, 1) * 255; albedo[i + 3] = cover * 255;
    }
  }
  const normal = heightToNormal(height, size, size / 90, blades);
  return { map: dataTex(albedo, size, { srgb: true }), normalMap: dataTex(normal, size) };
}

// Wertrauschen mit getrennten Perioden je Achse (für anisotrope, trotzdem kachelbare Muster)
function hashP(ix, iy, seed) {
  let h = Math.imul(ix | 0, 374761393) + Math.imul(iy | 0, 668265263) + Math.imul(seed | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function noiseP(x, y, seed, px, py) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const m = (a, p) => ((a % p) + p) % p;
  const x0 = m(ix, px), x1 = m(ix + 1, px), y0 = m(iy, py), y1 = m(iy + 1, py);
  const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10), v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const a = hashP(x0, y0, seed), b = hashP(x1, y0, seed), c = hashP(x0, y1, seed), d = hashP(x1, y1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbmP(x, y, oct, seed, px, py) {
  let sum = 0, amp = 0.5, f = 1, norm = 0;
  for (let o = 0; o < oct; o++) { sum += (noiseP(x * f, y * f, seed + o * 17, px * f, py * f) * 2 - 1) * amp; norm += amp; amp *= 0.5; f *= 2; }
  return sum / norm;
}

/**
 * Fels für Klippen (kachelbar, triplanar, 1 Kachel ≈ 14 Welteinheiten):
 *  map: RGB = Helligkeits-Detail um 0.5 (linear, ×2 im Shader), A = Kavität · normalMap.
 * Sedimentschichten mit Abbruchkanten, senkrechte Klüfte, zerklüftete Oberfläche, Körnung.
 */
export function createRockTextures(size = 512) {
  const N = size * size;
  const height = new Float32Array(N), cav = new Float32Array(N);
  const data = new Uint8Array(N * 4);
  for (let py = 0; py < size; py++) {
    const v = (py + 0.5) / size;
    for (let px = 0; px < size; px++) {
      const u = (px + 0.5) / size;
      const w1 = fbmP(u * 3, v * 3, 3, 201, 3, 3);
      const L = v * 7 + w1 * 0.55;
      const li = Math.floor(L), lf = L - li;
      const layerVar = noiseP(u * 5, li * 1.0, 203, 5, 1e9);
      const strata = smoothstep(0.0, 0.8 + layerVar * 0.15, lf) * (0.7 + 0.3 * layerVar);   // Schräge + scharfer Abbruch
      const ridged = 1 - Math.abs(fbmP(u * 8, v * 8, 4, 205, 8, 8));
      const jn = fbmP(u * 7 + w1 * 0.8, v * 2, 3, 207, 7, 2);
      const joint = 1 - smoothstep(0.0, 0.09, Math.abs(jn));
      const jointMask = smoothstep(0.2, 0.6, noiseP(u * 3, v * 9, 209, 3, 9));
      const grain = fbmP(u * 48, v * 48, 3, 211, 48, 48);
      const fine = noiseP(u * 180, v * 180, 213, 180, 180);
      const crackJ = joint * jointMask;
      const h = strata * 0.55 + ridged * 0.38 + grain * 0.1 + fine * 0.03 - crackJ * 0.5;
      height[py * size + px] = h;
      cav[py * size + px] = crackJ + (1 - smoothstep(0.0, 0.12, lf)) * 0.6;
      const l = clamp(0.5 + (layerVar - 0.5) * 0.3 + (ridged - 0.6) * 0.25 + grain * 0.12 + fine * 0.05 - crackJ * 0.3 + strata * 0.08, 0, 1);
      const i = (py * size + px) * 4;
      data[i] = data[i + 1] = data[i + 2] = l * 255;
    }
  }
  for (let i = 0; i < N; i++) data[i * 4 + 3] = clamp(cav[i], 0, 1) * 255;
  const normal = heightToNormal(height, size, size / 55);
  return { map: dataTex(data, size), normalMap: dataTex(normal, size) };
}

/**
 * Laub-Atlas (1024×512, RGBA ohne Vormultiplikation): links Laubbüschel, rechts Nadelzweig.
 * Neutral-helle Blätter (Farbton kommt aus der Instanzfarbe), Farbe in transparente Pixel ausgeweitet
 * (keine dunklen Säume beim Mipmapping).
 */
export function createLeafAtlas() {
  const W = 1024, H = 512;
  const cv = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(W, H) : Object.assign(document.createElement('canvas'), { width: W, height: H });
  const g = cv.getContext('2d');
  const R = rng(1234);
  g.clearRect(0, 0, W, H);
  const leaf = (x, y, ang, len, wid, l) => {
    g.save();
    g.translate(x, y); g.rotate(ang);
    const grd = g.createLinearGradient(0, 0, len, 0);
    const c0 = Math.round(l * 120), c1 = Math.round(Math.min(255, l * 200));
    grd.addColorStop(0, `rgb(${c0 * 0.94 | 0},${c0},${c0 * 0.84 | 0})`);
    grd.addColorStop(1, `rgb(${c1 * 0.96 | 0},${c1},${c1 * 0.86 | 0})`);
    g.fillStyle = grd;
    g.beginPath();
    g.moveTo(0, 0);
    g.bezierCurveTo(len * 0.25, -wid, len * 0.7, -wid * 0.9, len, 0);
    g.bezierCurveTo(len * 0.7, wid * 0.9, len * 0.25, wid, 0, 0);
    g.fill();
    g.strokeStyle = `rgba(40,50,20,0.35)`; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(len * 0.05, 0); g.lineTo(len * 0.9, 0); g.stroke();
    g.restore();
  };
  // --- Laubbüschel (links, 512×512): Zweige vom unteren Rand aus, Blätter nach außen
  g.strokeStyle = 'rgb(70,58,44)'; g.lineCap = 'round';
  const twigs = [];
  for (let t = 0; t < 7; t++) {
    const a = -Math.PI / 2 + (t - 3) * 0.32 + (R() - 0.5) * 0.2;
    const len = 170 + R() * 70;
    const x0 = 256 + (R() - 0.5) * 30, y0 = 500;
    twigs.push({ x0, y0, a, len });
    g.lineWidth = 5; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + Math.cos(a) * len, y0 + Math.sin(a) * len); g.stroke();
  }
  for (let k = 0; k < 150; k++) {
    const tw = twigs[k % twigs.length];
    const t = 0.25 + R() * 0.8;
    const x = tw.x0 + Math.cos(tw.a) * tw.len * t, y = tw.y0 + Math.sin(tw.a) * tw.len * t;
    const ang = tw.a + (R() < 0.5 ? -1 : 1) * (0.5 + R() * 0.9);
    const len = 46 + R() * 34;
    if (Math.hypot(x - 256, y - 270) > 230) continue;
    leaf(x, y, ang, len, len * (0.36 + R() * 0.1), 0.72 + R() * 0.38);
  }
  // --- Nadelzweig (rechts, 512×512): Hauptast von links nach rechts, Nadeln beidseitig
  const ox = 512;
  const branch = (x0, y0, a, len, depth) => {
    const x1 = x0 + Math.cos(a) * len, y1 = y0 + Math.sin(a) * len;
    g.strokeStyle = 'rgb(66,52,40)'; g.lineWidth = depth ? 2 : 4;
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    const steps = Math.round(len / 4);
    for (let i = 2; i < steps; i++) {
      const t = i / steps;
      const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      const nl = (depth ? 16 : 26) * (1 - t * 0.45) * (0.8 + R() * 0.4);
      for (const sd of [-1, 1]) {
        const na = a + sd * (0.75 + R() * 0.35);
        const l = 0.6 + R() * 0.45;
        const c = Math.round(l * 190);
        g.strokeStyle = `rgb(${c * 0.88 | 0},${c},${c * 0.74 | 0})`; g.lineWidth = 2.6;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(na) * nl, y + Math.sin(na) * nl); g.stroke();
      }
    }
    if (!depth) for (let s = 0; s < 6; s++) {
      const t = 0.2 + s * 0.13;
      branch(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, a + (s % 2 ? 0.6 : -0.6) + (R() - 0.5) * 0.2, len * (0.42 - s * 0.04), 1);
    }
  };
  branch(ox + 20, 256, 0, 470, 0);
  // ---- Pixel holen, Farbe ausweiten, Zeilen spiegeln (DataTexture: Zeile 0 = unten)
  const img = g.getImageData(0, 0, W, H).data;
  const out = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const si = (y * W + x) * 4, di = ((H - 1 - y) * W + x) * 4;
    out[di] = img[si]; out[di + 1] = img[si + 1]; out[di + 2] = img[si + 2]; out[di + 3] = img[si + 3];
  }
  for (let pass = 0; pass < 6; pass++) {
    const src = out.slice();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (src[i + 3] > 8) continue;
      let r = 0, gg = 0, b = 0, n = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const j = (yy * W + xx) * 4;
        if (src[j + 3] > 8 || (pass > 0 && (src[j] | src[j + 1] | src[j + 2]))) { r += src[j]; gg += src[j + 1]; b += src[j + 2]; n++; }
      }
      if (n) { out[i] = r / n; out[i + 1] = gg / n; out[i + 2] = b / n; }
    }
  }
  for (let i = 0; i < W * H; i++) if (out[i * 4 + 3] <= 8 && !(out[i * 4] | out[i * 4 + 1] | out[i * 4 + 2])) { out[i * 4] = 120; out[i * 4 + 1] = 135; out[i * 4 + 2] = 90; }
  const t = new THREE.DataTexture(out, W, H, THREE.RGBAFormat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

/** Kachelbares Wolkenrauschen: R = fbm, G = invertiertes Zellrauschen grob, B = fein, A = Detail-fbm. */
export function createCloudNoise(size = 256) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const a = fbm2(u * 4, v * 4, 5, 11, 4) * 0.5 + 0.5;
      // Kuppeln (Cumulus-Bällchen) aus Zellrauschen
      const dome = (d, r) => Math.sqrt(Math.max(0, 1 - (d / r) * (d / r)));
      const wu = u + fbm2(u * 3, v * 3, 3, 5, 3) * 0.03, wv = v + fbm2(u * 3 + 7, v * 3, 3, 6, 3) * 0.03;
      const w1 = dome(worley2(wu * 6, wv * 6, 6, 21), 0.95);
      const w2 = dome(worley2(wu * 13, wv * 13, 13, 37), 0.9);
      const w3 = dome(worley2(wu * 27, wv * 27, 27, 51), 0.9);
      const b = w2 * 0.65 + w3 * 0.35;
      const d = fbm2(u * 16, v * 16, 4, 61, 16) * 0.5 + 0.5;
      const i = (y * size + x) * 4;
      data[i] = clamp(a, 0, 1) * 255;
      data[i + 1] = clamp(w1, 0, 1) * 255;
      data[i + 2] = clamp(b, 0, 1) * 255;
      data[i + 3] = clamp(d, 0, 1) * 255;
    }
  }
  return dataTex(data, size);
}

/** Runenband: Glyphen in einer Zeile (u läuft entlang des Bandes). */
export function createRuneStrip(w = 1024, h = 64) {
  const data = new Uint8Array(w * h * 4);
  const R = rng(42);
  const field = new Float32Array(w * h);
  const stamp = (x, y, r, val) => {
    const x0 = Math.max(0, Math.floor(x - r - 1)), x1 = Math.min(w - 1, Math.ceil(x + r + 1));
    const y0 = Math.max(0, Math.floor(y - r - 1)), y1 = Math.min(h - 1, Math.ceil(y + r + 1));
    for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) {
      const d = Math.hypot(xx - x, yy - y);
      const a = clamp(r + 0.5 - d, 0, 1) * val;
      const k = yy * w + xx;
      if (a > field[k]) field[k] = a;
    }
  };
  const line = (x0, y0, x1, y1, r = 1.6) => {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
    for (let i = 0; i <= n; i++) stamp(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, r, 1);
  };
  const glyphs = 16;
  const gw = w / glyphs;
  for (let g = 0; g < glyphs; g++) {
    const cx = g * gw + gw / 2, cy = h / 2;
    const s = h * 0.28;
    // senkrechter Hauptstrich + 2-3 Äste/Bögen
    line(cx, cy - s, cx, cy + s);
    const n = 2 + Math.floor(R() * 3);
    for (let k = 0; k < n; k++) {
      const yA = cy + (R() * 2 - 1) * s, dir = R() < 0.5 ? -1 : 1;
      const len = s * (0.5 + R() * 0.6);
      const typ = R();
      if (typ < 0.45) line(cx, yA, cx + dir * len, yA + (R() * 2 - 1) * len * 0.8);
      else if (typ < 0.75) {
        for (let a = 0; a < Math.PI; a += 0.15) stamp(cx + dir * Math.sin(a) * len * 0.6, yA + Math.cos(a) * len * 0.5, 1.5, 1);
      } else stamp(cx + dir * len * 0.7, yA, 2.6, 1);
    }
    // Trennpunkte
    stamp(g * gw, cy, 1.8, 0.7);
  }
  // durchgehende Begleitlinien oben/unten
  for (let x = 0; x < w; x++) { stamp(x, 5, 1.0, 0.75); stamp(x, h - 6, 1.0, 0.75); }
  // weicher Schein (Box-Blur) + scharfe Linie
  const blur = new Float32Array(w * h);
  const rad = 4;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0, c = 0;
    for (let dy = -rad; dy <= rad; dy += 2) for (let dx = -rad; dx <= rad; dx += 2) {
      const yy = y + dy; if (yy < 0 || yy >= h) continue;
      s += field[yy * w + ((x + dx + w) % w)]; c++;
    }
    blur[y * w + x] = s / c;
  }
  for (let i = 0; i < w * h; i++) {
    const v = clamp(field[i] + blur[i] * 0.8, 0, 1);
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v * 255; data[i * 4 + 3] = 255;
  }
  const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

/** Runensiegel (Kreis) für das Königsplateau und Portalböden. */
export function createSealTexture(size = 512) {
  const data = new Uint8Array(size * size * 4);
  const R = rng(5);
  const ticks = [];
  for (let i = 0; i < 48; i++) ticks.push(R());
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = (x + 0.5) / size * 2 - 1, v = (y + 0.5) / size * 2 - 1;
    const r = Math.hypot(u, v), a = Math.atan2(v, u);
    const ring = (rr, wdt) => Math.max(0, 1 - Math.abs(r - rr) / wdt);
    let val = ring(0.96, 0.012) + ring(0.90, 0.008) * 0.8 + ring(0.62, 0.01) + ring(0.56, 0.006) * 0.7 + ring(0.22, 0.01) * 0.8;
    // Runenband zwischen 0.90 und 0.96
    const seg = (a / (Math.PI * 2) + 0.5) * 48;
    const si = Math.floor(seg), sf = seg - si;
    if (r > 0.905 && r < 0.955) {
      const t = ticks[si % 48];
      const m = t < 0.33 ? (Math.abs(sf - 0.5) < 0.08 ? 1 : 0) : t < 0.66 ? (Math.abs(sf - 0.3) < 0.06 || Math.abs(sf - 0.7) < 0.06 ? 1 : 0) : (Math.abs((r - 0.93) * 40 - (sf - 0.5) * 2) < 0.25 ? 1 : 0);
      val += m * 0.9;
    }
    // Strahlen & Sternpolygon
    const spokes = Math.pow(Math.max(0, Math.cos(a * 8)), 60) * (r > 0.22 && r < 0.56 ? 0.8 : 0);
    val += spokes;
    for (let k = 0; k < 2; k++) {
      // zwei verschränkte Quadrate
      const rot = k * Math.PI / 4;
      const ca = Math.cos(a - rot), sa = Math.sin(a - rot);
      const d = Math.max(Math.abs(r * ca), Math.abs(r * sa));
      val += Math.max(0, 1 - Math.abs(d - 0.42) / 0.008) * 0.85;
    }
    val += Math.max(0, 1 - r / 0.08) * 0.6;
    const glow = Math.exp(-Math.pow((r - 0.6) / 0.35, 2)) * 0.12;
    const out = clamp(val + glow, 0, 1) * smoothstep(1.0, 0.97, r);
    const i = (y * size + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = out * 255; data[i + 3] = 255;
  }
  return dataTex(data, size, { repeat: false });
}

/** Weicher, verrauschter Nebelfleck (für Schwaden/Gischt). */
export function createWispTexture(size = 256) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = (x + 0.5) / size * 2 - 1, v = (y + 0.5) / size * 2 - 1;
    const r = Math.hypot(u * 0.9, v * 1.25);
    const n = fbm2(x / size * 5, y / size * 5, 5, 3) * 0.5 + 0.5;
    const n2 = noise2(x / size * 14, y / size * 14, 8);
    const edge = 1 - smoothstep(0.7, 0.98, Math.max(Math.abs(u), Math.abs(v)));
    const a = clamp((1 - smoothstep(0.2, 0.95, r + (n - 0.5) * 0.6)) * (0.55 + 0.6 * n) * (0.85 + 0.15 * n2) * edge, 0, 1);
    const i = (y * size + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = 255; data[i + 3] = a * 255;
  }
  return dataTex(data, size, { repeat: false });
}
