// Weltaufbau: Inseln, Bahnen, Brücken, Königsplateau, Portale, Wahrzeichen, Requisiten, Hintergrund.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
  laneCenterX, TEAM_CENTER_X, LANE_WIDTH, LANE_END_Z, KING_Z, LANES_PER_TEAM, BUILD_Z0, BUILD_Z1, GRID_COLS, CELL,
} from '../../sim/layout.js';
import { rng, fbm2, noise2, smoothstep, lerp, clamp } from './noise.js';
import { patchMaterial } from './shaders.js';
import { buildIsland, buildStalactite, buildFloatingRock, superellipse } from './islands.js';
import {
  StoneKit, merge, prep, treeTrunkGeometry, treeFoliageGeometry, rockGeometry, grassClumpGeometry, flowerGeometry,
  crystalClusterGeometry, crystalShardGeometry, COLORS,
} from './props.js';
import { createCrystalMaterial, createPortalMaterial, createRuneMaterial, createSealMaterial, createBeamMaterial, createLightShafts } from './magic.js';
import { createFlagstoneTextures, createGroundTextures, createRockTextures, createLeafAtlas, createRuneStrip, createSealTexture, createWispTexture } from './textures.js';
import { createWaterfalls, createWisps } from './water.js';
import { createParticles } from './particles.js';
import { CLOUD_TOP } from './clouds.js';

const HALF = LANE_WIDTH / 2;            // 7
export const LANE_Z0 = -38.5;           // Bahnboden beginnt (inkl. Portal-Podest)
export const LANE_Z1 = LANE_END_Z + 2.5; // 28.5
export const PORTAL_Z = -35.4;
const PORTAL_Y = 5.0;
const PORTAL_R = 4.35;
const CURB_X = HALF + 0.38;
const PLATEAU_R = 10.5;
const BRIDGE_HW = 3.6;
const TEAM_ISLE = { cz: -5.5, a: 48, b: 37.5, n: 10 };
const KING_ISLE = { dz: 3, rx: 18, rz: 16 };
const HERO = { x: 0, z: 6, y: -3.0 };
export const MAX_GRASS = 30000;
export const MAX_FLOWERS = 2600;

function segDist(px, pz, ax, az, bx, bz) {
  const vx = bx - ax, vz = bz - az;
  const t = clamp(((px - ax) * vx + (pz - az) * vz) / (vx * vx + vz * vz), 0, 1);
  return Math.hypot(px - (ax + vx * t), pz - (az + vz * t));
}

export function buildWorld(U, { anisotropy = 8, assets = null } = {}) {
  const A = assets?.textures || {};
  const root = new THREE.Group();
  root.name = 'aetherfront-environment';
  const animated = { rings: [], spire: null, satellites: null, floatRocks: null };
  const R = rng(2026);

  // ---------- Teams & Wege ----------
  const teams = [0, 1].map((team) => {
    const cx = TEAM_CENTER_X[team];
    const lanes = [];
    for (let s = 0; s < LANES_PER_TEAM; s++) lanes.push(laneCenterX(team, s));
    const bridges = lanes.map((lx) => ({ ax: lx, az: LANE_END_Z - 2, bx: cx, bz: KING_Z }));
    return { team, cx, lanes, bridges };
  });

  const flatMask = (tm, x, z) => {
    let m = 0;
    for (const lx of tm.lanes) {
      const dx = Math.abs(x - lx);
      const mx = 1 - smoothstep(HALF + 0.75, HALF + 1.6, dx);
      const mz = (1 - smoothstep(LANE_Z1, LANE_Z1 + 1.2, z)) * (1 - smoothstep(LANE_Z0, LANE_Z0 - 1.2, z));
      m = Math.max(m, mx * mz);
    }
    for (const b of tm.bridges) {
      const d = segDist(x, z, b.ax, b.az, b.bx, b.bz);
      m = Math.max(m, 1 - smoothstep(BRIDGE_HW + 0.4, BRIDGE_HW + 1.4, d));
    }
    const dp = Math.hypot(x - tm.cx, z - KING_Z);
    m = Math.max(m, 1 - smoothstep(PLATEAU_R + 0.3, PLATEAU_R + 1.3, dp));
    return m;
  };

  const lushGrass = (seed) => (x, z) => {
    const n = fbm2(x * 0.045, z * 0.045, 3, seed) * 0.5 + 0.5;
    const n2 = fbm2(x * 0.18, z * 0.18, 2, seed + 7) * 0.5 + 0.5;
    const dry = smoothstep(0.62, 0.8, n2) * 0.6;
    const r = lerp(0.040, 0.085, n) + dry * 0.07;
    const g = lerp(0.090, 0.150, n) + dry * 0.035;
    const b = lerp(0.022, 0.028, n);
    return [r, g, b];
  };

  // ---------- Inseln (nah) ----------
  const nearIsles = [];
  const islandDescs = [];
  for (const tm of teams) {
    const seed = 11 + tm.team * 31;
    const radius = superellipse(TEAM_ISLE.a, TEAM_ISLE.b, TEAM_ISLE.n);
    const rad = (th) => {
      const c = Math.cos(th), s = Math.sin(th);
      const n = fbm2(c * 2.2 + seed, s * 2.2 - seed, 3, seed + 2);
      return radius(th) * (1 + 0.07 * Math.max(0, n) + 0.012 * n);
    };
    const height = (x, z, t) => {
      let dl = 99;
      for (const lx of tm.lanes) dl = Math.min(dl, Math.abs(x - lx));
      const berm = 0.15 + 0.75 * smoothstep(HALF + 0.9, HALF + 4.2, dl);
      const n = fbm2(x * 0.07, z * 0.07, 3, seed + 5) * 0.45;
      const mound = 1.4 * smoothstep(0.6, 0.95, t) * (1 - smoothstep(0.95, 1, t)) * smoothstep(HALF + 3, HALF + 7, dl);
      const nat = berm + n + mound;
      return lerp(nat, -0.45, flatMask(tm, x, z));
    };
    const isl = buildIsland({
      cx: tm.cx, cz: TEAM_ISLE.cz, topY: 0, radius: rad, depth: 40, seed, segs: 220, rings: 34, sideRings: 40,
      height, grass: lushGrass(seed), rimDrop: 1.4, edgeNoise: 0.0, taper: 0.6, lobes: 0.4,
    });
    nearIsles.push(isl.geometry);
    islandDescs.push({ kind: 'team', tm, cx: tm.cx, cz: TEAM_ISLE.cz, topY: 0, height, edgeAt: isl.edgeAt, rimDrop: 1.4 });
    // hängende Felszapfen
    for (let k = 0; k < 9; k++) {
      const a = R() * Math.PI * 2, rr = Math.sqrt(R()) * 0.65;
      const ex = isl.edgeAt(a) * rr;
      const x = tm.cx + Math.cos(a) * ex, z = TEAM_ISLE.cz + Math.sin(a) * ex;
      const s = 1 - Math.pow(rr, 1 / 0.6);
      const y = -1.4 - s * 40 + 6;
      nearIsles.push(buildStalactite({ x, y, z, r: 4 + R() * 6, len: 10 + R() * 18, seed: 100 + k + tm.team * 20 }));
    }
    // Königsinsel
    const kseed = 51 + tm.team * 13;
    const kcz = KING_Z + KING_ISLE.dz;
    const krad = (th) => {
      const base = superellipse(KING_ISLE.rx, KING_ISLE.rz, 2.4)(th);
      const n = fbm2(Math.cos(th) * 2 + kseed, Math.sin(th) * 2, 3, kseed);
      return base * (1 + 0.08 * Math.max(0, n));
    };
    const kheight = (x, z, t) => {
      const n = fbm2(x * 0.09, z * 0.09, 3, kseed) * 0.35;
      const nat = 0.35 + n + 0.5 * smoothstep(0.5, 0.9, t);
      return lerp(nat, -0.45, flatMask(tm, x, z));
    };
    const kisl = buildIsland({
      cx: tm.cx, cz: kcz, topY: 0, radius: krad, depth: 30, seed: kseed, segs: 140, rings: 22, sideRings: 32,
      height: kheight, grass: lushGrass(kseed), rimDrop: 1.3, edgeNoise: 0, taper: 0.55, lobes: 0.5,
    });
    nearIsles.push(kisl.geometry);
    islandDescs.push({ kind: 'king', tm, cx: tm.cx, cz: kcz, topY: 0, height: kheight, edgeAt: kisl.edgeAt, rimDrop: 1.3 });
  }
  // Heldeninsel (Mitte)
  {
    const seed = 404;
    const rad = (th) => 14.5 * (1 + 0.12 * fbm2(Math.cos(th) * 2 + 9, Math.sin(th) * 2, 3, seed));
    const height = (x, z, t) => {
      const d = Math.hypot(x - HERO.x, z - HERO.z);
      const n = fbm2(x * 0.1, z * 0.1, 3, seed) * 0.4;
      return lerp(0.5 + n + 0.4 * smoothstep(0.5, 0.9, t), 0.0, 1 - smoothstep(6.5, 7.5, d));
    };
    const isl = buildIsland({
      cx: HERO.x, cz: HERO.z, topY: HERO.y, radius: rad, depth: 46, seed, segs: 120, rings: 20, sideRings: 40,
      height, grass: lushGrass(seed), rimDrop: 1.3, edgeNoise: 0, taper: 0.5, lobes: 0.6,
    });
    nearIsles.push(isl.geometry);
    islandDescs.push({ kind: 'hero', cx: HERO.x, cz: HERO.z, topY: HERO.y, height, edgeAt: isl.edgeAt, rimDrop: 1.3 });
  }
  // Gelände-Material: echte PBR-Sätze (Waldboden, Erde, Felswand, Moos) oder prozeduraler Rückfall
  const pbrTerrain = !!(A.ground && A.cliff && A.ground.normal && A.cliff.normal);
  let terrainMaps, stoneTri, rockTri;
  if (pbrTerrain) {
    terrainMaps = { pbr: true, ground: A.ground, soil: A.soil, cliff: A.cliff, moss: A.moss };
  } else {
    const groundTex = createGroundTextures(512), rockTex = createRockTextures(512);
    for (const t of [groundTex.map, groundTex.normalMap, rockTex.map, rockTex.normalMap]) t.anisotropy = anisotropy;
    terrainMaps = { ground: groundTex.map, groundN: groundTex.normalMap, rock: rockTex.map, rockN: rockTex.normalMap };
  }
  const farTerrain = terrainMaps;
  const islandMat = patchMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.93, metalness: 0 }), U, { terrain: terrainMaps });
  const islandMesh = new THREE.Mesh(merge(nearIsles.map((g) => { const n = g.toNonIndexed(); return n; })), islandMat);
  islandMesh.castShadow = true;
  islandMesh.receiveShadow = true;
  islandMesh.name = 'aeth-islands';
  root.add(islandMesh);

  const topYAt = (d, x, z) => {
    const th = Math.atan2(z - d.cz, x - d.cx);
    const er = d.edgeAt(th);
    const t = Math.hypot(x - d.cx, z - d.cz) / er;
    if (t > 1) return null;
    const rim = smoothstep(0.86, 1.0, t);
    return { y: d.topY + d.height(x, z, t) - rim * rim * d.rimDrop * 0.6, t };
  };
  const scatterOn = (d, count, accept, seed, maxT = 0.9) => {
    const r = rng(seed);
    const out = [];
    let guard = 0;
    while (out.length < count && guard++ < count * 40) {
      const a = r() * Math.PI * 2, rr = Math.sqrt(r()) * maxT;
      const er = d.edgeAt(a);
      const x = d.cx + Math.cos(a) * er * rr, z = d.cz + Math.sin(a) * er * rr;
      const h = topYAt(d, x, z);
      if (!h || h.t > maxT) continue;
      if (accept && !accept(x, z, h.y, r)) continue;
      out.push({ x, y: h.y, z, r: r() });
    }
    return out;
  };

  // ---------- Böden (Bahnen, Brücken, Plateau) ----------
  // Bahnboden: Poly-Haven-Steinplatten (Albedo/Normal/ARM) oder prozedurale Platten
  const FM = A.floor && A.floor.normal ? A.floor.meters : 8;
  const tex = A.floor && A.floor.normal
    ? { map: A.floor.albedo, normalMap: A.floor.normal, ormMap: A.floor.arm || null }
    : createFlagstoneTextures(1024);
  for (const t of [tex.map, tex.normalMap, tex.ormMap]) if (t) t.anisotropy = anisotropy;
  const fpos = [], fuv = [], fcol = [], fidx = [];
  const addQuadGrid = (pts, nu, nv, colorFn, uvFn) => {
    // pts(u,v) -> [x,y,z]
    const base = fpos.length / 3;
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const u = i / nu, v = j / nv;
      const [x, y, z] = pts(u, v);
      fpos.push(x, y, z);
      const [uu, vv] = uvFn(x, z, u, v);
      fuv.push(uu, vv);
      const c = colorFn(x, z, u, v);
      fcol.push(c[0], c[1], c[2]);
    }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const a = base + j * (nu + 1) + i, b = a + nu + 1;
      fidx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  };
  const worldUV = (x, z) => [x / FM, z / FM];
  for (const tm of teams) {
    for (const lx of tm.lanes) {
      const ao = (x) => 0.66 + 0.34 * smoothstep(0, 1.6, HALF - Math.abs(x - lx));
      const tint = (x, z, zone) => {
        const a = ao(x);
        const rift = 1 - smoothstep(LANE_Z0, -27, z);
        let c = zone ? (A.floor ? [0.93, 0.96, 1.02] : [0.84, 0.90, 1.02]) : [1.0, 0.98, 0.95];
        c = [lerp(c[0], 0.88, rift), lerp(c[1], 0.84, rift), lerp(c[2], 0.96, rift)];
        return [c[0] * a, c[1] * a, c[2] * a];
      };
      const gx0 = lx - (GRID_COLS * CELL) / 2, gx1 = lx + (GRID_COLS * CELL) / 2;
      const rect = (x0, x1, z0, z1, zone) => {
        const nu = Math.max(1, Math.round((x1 - x0) / 0.5)), nv = Math.max(1, Math.round((z1 - z0) / 2));
        addQuadGrid((u, v) => [lerp(x0, x1, u), 0, lerp(z0, z1, v)], nu, nv, (x, z) => tint(x, z, zone), worldUV);
      };
      rect(lx - HALF, lx + HALF, LANE_Z0, BUILD_Z0, false);
      rect(lx - HALF, gx0, BUILD_Z0, BUILD_Z1, false);
      rect(gx0, gx1, BUILD_Z0, BUILD_Z1, true);
      rect(gx1, lx + HALF, BUILD_Z0, BUILD_Z1, false);
      rect(lx - HALF, lx + HALF, BUILD_Z1, LANE_Z1, false);
      // Schürze (Seitenflächen) bis unter die Grasnarbe
      for (const sx of [-1, 1]) {
        const x = lx + sx * HALF;
        addQuadGrid((u, v) => [x, -v * 0.7, lerp(LANE_Z0, LANE_Z1, u)], 16, 1, () => [0.45, 0.4, 0.4], (x2, z, u, v) => [z / FM, v * 0.7 / FM]);
      }
      for (const z of [LANE_Z0, LANE_Z1]) {
        addQuadGrid((u, v) => [lerp(lx - HALF, lx + HALF, u), -v * 0.7, z], 6, 1, () => [0.45, 0.4, 0.4], (x, z2, u, v) => [x / FM, v * 0.7 / FM]);
      }
    }
    // Brücken (leicht versetzt in der Höhe gegen Z-Fighting)
    tm.bridges.forEach((b, k) => {
      const dx = b.bx - b.ax, dz = b.bz - b.az, len = Math.hypot(dx, dz);
      const fx = dx / len, fz = dz / len, sx = -fz, sz = fx;
      const y = -0.02 - k * 0.012;
      addQuadGrid((u, v) => {
        const along = v * len, across = (1 - u * 2) * BRIDGE_HW;
        return [b.ax + fx * along + sx * across, y, b.az + fz * along + sz * across];
      }, 10, Math.round(len / 2), (x, z, u) => {
        const a = 0.7 + 0.3 * smoothstep(0, 0.22, 0.5 - Math.abs(u - 0.5));
        return [1.0 * a, 0.95 * a, 0.88 * a];
      }, (x, z, u, v) => [(u * 2 - 1) * BRIDGE_HW / FM, v * len / FM]);
    });
    // Königsplateau (Scheibe)
    {
      const base = fpos.length / 3;
      const rings = 12, segs = 72;
      fpos.push(tm.cx, 0, KING_Z); fuv.push(tm.cx / FM, KING_Z / FM); fcol.push(1.05, 0.98, 0.88);
      for (let r = 1; r <= rings; r++) {
        const rr = (r / rings) * PLATEAU_R;
        for (let s = 0; s < segs; s++) {
          const a = (s / segs) * Math.PI * 2;
          const x = tm.cx + Math.cos(a) * rr, z = KING_Z + Math.sin(a) * rr;
          fpos.push(x, 0, z); fuv.push(x / FM, z / FM);
          const ao = 0.7 + 0.3 * smoothstep(0, 1.5, PLATEAU_R - rr);
          const ring = Math.abs(rr - 6.2) < 0.5 ? 0.9 : 1.0;
          fcol.push(1.05 * ao * ring, 0.97 * ao * ring, 0.86 * ao * ring);
        }
      }
      for (let s = 0; s < segs; s++) fidx.push(base, base + 1 + ((s + 1) % segs), base + 1 + s);
      for (let r = 1; r < rings; r++) {
        const a0 = base + 1 + (r - 1) * segs, a1 = base + 1 + r * segs;
        for (let s = 0; s < segs; s++) {
          const s1 = (s + 1) % segs;
          fidx.push(a0 + s, a0 + s1, a1 + s, a0 + s1, a1 + s1, a1 + s);
        }
      }
      // Rand-Schürze
      addQuadGrid((u, v) => {
        const a = u * Math.PI * 2;
        return [tm.cx + Math.cos(a) * PLATEAU_R, -v * 0.8, KING_Z + Math.sin(a) * PLATEAU_R];
      }, 72, 1, () => [0.5, 0.44, 0.42], (x, z, u, v) => [u * PLATEAU_R * Math.PI * 2 / FM, v * 0.8 / FM]);
    }
  }
  const floorGeo = new THREE.BufferGeometry();
  floorGeo.setAttribute('position', new THREE.Float32BufferAttribute(fpos, 3));
  floorGeo.setAttribute('uv', new THREE.Float32BufferAttribute(fuv, 2));
  floorGeo.setAttribute('color', new THREE.Float32BufferAttribute(fcol, 3));
  floorGeo.setIndex(fidx);
  floorGeo.computeVertexNormals();
  const floorMat = patchMaterial(new THREE.MeshStandardMaterial({
    map: tex.map, normalMap: tex.normalMap, normalScale: new THREE.Vector2(1.0, 1.0), aoMap: tex.ormMap, aoMapIntensity: 0.9,
    roughnessMap: tex.ormMap, roughness: 1.0, vertexColors: true, metalness: 0, side: THREE.DoubleSide,
    color: A.floor ? new THREE.Color(0.80, 0.74, 0.66) : new THREE.Color(1, 1, 1),
  }), U, { floor: true });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.receiveShadow = true;
  floor.name = 'aeth-floors';
  root.add(floor);

  // ---------- Runenbänder ----------
  const runeTex = createRuneStrip();
  runeTex.anisotropy = anisotropy;
  const rpos = [], ruv = [], rflow = [], rtint = [], ridx = [];
  const TEAL = [0.25, 0.95, 1.0], GOLDG = [1.0, 0.62, 0.25], VIOLET = [0.62, 0.3, 1.0];
  const addStrip = (path, width, tint, flow0, y = 0.02, uScale = 1 / 9.6) => {
    // path: Array von [x,z]; Breite quer zum Pfad
    const base = rpos.length / 3;
    let acc = 0;
    for (let i = 0; i < path.length; i++) {
      const p = path[i];
      const q = path[Math.min(path.length - 1, i + 1)], o = path[Math.max(0, i - 1)];
      let dx = q[0] - o[0], dz = q[1] - o[1];
      const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      if (i > 0) acc += Math.hypot(p[0] - path[i - 1][0], p[1] - path[i - 1][1]);
      const sx = -dz * width / 2, sz = dx * width / 2;
      rpos.push(p[0] - sx, y, p[1] - sz, p[0] + sx, y, p[1] + sz);
      ruv.push(acc * uScale, 0, acc * uScale, 1);
      rflow.push(flow0 + acc, flow0 + acc);
      rtint.push(...tint, ...tint);
    }
    for (let i = 0; i < path.length - 1; i++) {
      const a = base + i * 2;
      ridx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  };
  for (const tm of teams) {
    for (let s = 0; s < tm.lanes.length; s++) {
      const lx = tm.lanes[s];
      for (const sx of [-1, 1]) {
        const path = [];
        for (let z = LANE_Z0 + 1.2; z <= LANE_Z1 - 1.0; z += 2) path.push([lx + sx * (HALF - 0.55), z]);
        addStrip(path, 0.5, TEAL.map((c) => c * 0.5), 0);
      }
      // Eckwinkel der Bauzone (dezente Markierung)
      const gx = (GRID_COLS * CELL) / 2 + 0.15;
      for (const sx of [-1, 1]) for (const [z0, sz] of [[BUILD_Z0 - 0.15, 1], [BUILD_Z1 + 0.15, -1]]) {
        addStrip([[lx + sx * gx, z0 + sz * 1.6], [lx + sx * gx, z0]], 0.16, TEAL.map((c) => c * 0.55), 0, 0.022, 1 / 30);
        addStrip([[lx + sx * gx, z0], [lx + sx * (gx - 1.6), z0]], 0.16, TEAL.map((c) => c * 0.55), 0, 0.022, 1 / 30);
      }
      const b = tm.bridges[s];
      const len = Math.hypot(b.bx - b.ax, b.bz - b.az);
      const fx = (b.bx - b.ax) / len, fz = (b.bz - b.az) / len;
      for (const sx of [-1, 1]) {
        const path = [];
        const off = BRIDGE_HW - 0.5;
        for (let d = 3.5; d <= len - PLATEAU_R + 0.2; d += 1.5) path.push([b.ax + fx * d - fz * off * sx, b.az + fz * d + fx * off * sx]);
        addStrip(path, 0.42, GOLDG.map((c) => c * 0.8), 66 + 3.5, 0.0);
      }
    }
    // Plateau-Ring
    const ring = [];
    for (let i = 0; i <= 96; i++) {
      const a = (i / 96) * Math.PI * 2;
      ring.push([tm.cx + Math.cos(a) * (PLATEAU_R - 0.6), KING_Z + Math.sin(a) * (PLATEAU_R - 0.6)]);
    }
    addStrip(ring, 0.5, GOLDG.map((c) => c * 0.9), 0, 0.02, 1 / 7.5);
  }
  const runeGeo = new THREE.BufferGeometry();
  runeGeo.setAttribute('position', new THREE.Float32BufferAttribute(rpos, 3));
  runeGeo.setAttribute('uv', new THREE.Float32BufferAttribute(ruv, 2));
  runeGeo.setAttribute('flow', new THREE.Float32BufferAttribute(rflow, 1));
  runeGeo.setAttribute('tint', new THREE.Float32BufferAttribute(rtint, 3));
  runeGeo.setIndex(ridx);
  const runes = new THREE.Mesh(runeGeo, createRuneMaterial(U, runeTex));
  runes.name = 'aeth-runes';
  runes.renderOrder = 1;
  root.add(runes);

  // ---------- Siegel ----------
  const sealTex = createSealTexture(512);
  sealTex.anisotropy = anisotropy;
  const seals = [];
  const addSeal = (x, y, z, r, tint, spin) => {
    const g = new THREE.PlaneGeometry(r * 2, r * 2);
    g.rotateX(-Math.PI / 2);
    g.translate(x, y, z);
    const n = g.attributes.position.count;
    g.setAttribute('tint', new THREE.Float32BufferAttribute(new Array(n).fill(0).flatMap(() => tint), 3));
    g.setAttribute('spin', new THREE.Float32BufferAttribute(new Array(n).fill(spin), 1));
    g.deleteAttribute('normal');
    seals.push(g);
  };
  for (const tm of teams) {
    addSeal(tm.cx, 0.03, KING_Z, 8.2, [1.0, 0.62, 0.26], 1);
    for (const lx of tm.lanes) addSeal(lx, 0.03, PORTAL_Z + 3.6, 4.6, [0.55, 0.25, 1.0], -2);
  }
  addSeal(HERO.x, HERO.y + 0.62, HERO.z, 5.6, [0.3, 0.9, 1.0], 1.5);
  const sealMesh = new THREE.Mesh(merge(seals), createSealMaterial(U, sealTex));
  sealMesh.name = 'aeth-seals';
  sealMesh.renderOrder = 1;
  root.add(sealMesh);

  // ---------- Steinbaukasten: Ruinen, Portale, Brückenkörper, Lampen ----------
  const kit = new StoneKit(9);
  const lampSpots = [];
  const crystalSpots = [];   // {x,y,z,s,rot,color}
  const floatSpots = [];     // schwebende Splitter
  const treeSpots = [[], []];
  const rockSpots = [];
  const falls = [];
  const wispItems = [];
  const TEAL_C = new THREE.Color(0.2, 0.95, 1.0), VIOLET_C = new THREE.Color(0.65, 0.3, 1.0);
  const PINK_C = new THREE.Color(1.0, 0.3, 0.7), GOLD_C = new THREE.Color(1.0, 0.48, 0.1);

  for (const tm of teams) {
    const side = tm.team === 0 ? -1 : 1; // nach außen
    // Portale
    for (const lx of tm.lanes) {
      const blocks = 20;
      for (let i = 0; i < blocks; i++) {
        const a = (i / blocks) * Math.PI * 2 + Math.PI / blocks;
        const rr = PORTAL_R + 0.75;
        const m = new THREE.Matrix4().makeRotationZ(a);
        m.setPosition(lx + Math.cos(a) * rr, PORTAL_Y + Math.sin(a) * rr, PORTAL_Z);
        const bb = new THREE.BoxGeometry(1.25, (Math.PI * 2 * rr) / blocks * 0.92, 1.5);
        kit.add(bb, m, kit.stoneFn(i, i % 5 === 0 ? [0.5, 0.42, 0.5] : COLORS.STONE));
        if (i % 2 === 0) {
          const rune = new THREE.BoxGeometry(0.16, 0.7, 0.1);
          const mr = m.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, 0.78));
          kit.add(rune, mr, [0.2, 0.2, 0.2], { emit: [0.9, 0.35, 2.0] });
        }
      }
      // Goldreif
      const ring = new THREE.TorusGeometry(PORTAL_R + 1.42, 0.12, 6, 64);
      kit.add(ring, new THREE.Matrix4().makeTranslation(lx, PORTAL_Y, PORTAL_Z + 0.6), COLORS.GOLD, { metal: 1 });
      // Sockel
      const plinth = new THREE.BoxGeometry(3.6, 1.0, 2.6);
      kit.add(plinth, new THREE.Matrix4().makeTranslation(lx, 0.1, PORTAL_Z), kit.stoneFn(lx, COLORS.STONE_DARK));
      kit.obelisk(lx - 6.3, 0, PORTAL_Z - 0.4, 4.2, 0, [0.9, 0.35, 2.0]);
      kit.obelisk(lx + 6.3, 0, PORTAL_Z - 0.4, 4.2, 0, [0.9, 0.35, 2.0]);
      crystalSpots.push({ x: lx, y: PORTAL_Y + PORTAL_R + 1.2, z: PORTAL_Z, s: 1.1, rot: 0, c: VIOLET_C, tilt: 0 });
      floatSpots.push({ x: lx - 6.3, y: 7.2, z: PORTAL_Z - 0.4, s: 0.7, c: VIOLET_C });
      floatSpots.push({ x: lx + 6.3, y: 7.2, z: PORTAL_Z - 0.4, s: 0.7, c: VIOLET_C });
    }
    // Lampenpfosten an Bauzonen-Ecken, Spawn und Bahnende
    for (const lx of tm.lanes) {
      for (const sx of [-1, 1]) for (const z of [BUILD_Z0 - 0.7, BUILD_Z1 + 0.7, -26, LANE_Z1 - 1.6]) {
        lampSpots.push({ x: lx + sx * CURB_X, z });
      }
    }
    // Brückenkörper + Brüstungen + Säulen am Übergang
    tm.bridges.forEach((b, k) => {
      const dx = b.bx - b.ax, dz = b.bz - b.az, len = Math.hypot(dx, dz);
      const fx = dx / len, fz = dz / len;
      const yaw = Math.atan2(fx, fz);
      // Abschnitt über dem Abgrund bestimmen
      const team = islandDescs.find((d) => d.kind === 'team' && d.tm === tm);
      const king = islandDescs.find((d) => d.kind === 'king' && d.tm === tm);
      let t0 = 0, t1 = len;
      for (let d = 0; d < len; d += 0.25) { const h = topYAt(team, b.ax + fx * d, b.az + fz * d); if (!h || h.t > 0.97) { t0 = d; break; } }
      for (let d = len; d > 0; d -= 0.25) { const h = topYAt(king, b.ax + fx * d, b.az + fz * d); if (!h || h.t > 0.97) { t1 = d; break; } }
      tm.bridges[k].span = [t0, t1];
      const a0 = t0 - 3, a1 = t1 + 3;
      // glatter Bogenkörper (Querschnitt entlang der Brücke extrudiert)
      {
        const n = Math.max(8, Math.round((a1 - a0) / 0.8));
        const hw = BRIDGE_HW + 0.45, top = -0.16;
        const P = [], C = [];
        const sl = [];
        for (let i = 0; i <= n; i++) {
          const u = i / n;
          const d = lerp(a0, a1, u);
          const cx0 = b.ax + fx * d, cz0 = b.az + fz * d;
          const bot = top - (1.0 + 3.6 * Math.pow(Math.abs(u * 2 - 1), 2.4));
          const sxv = -fz, szv = fx;
          sl.push([
            [cx0 + sxv * hw, top, cz0 + szv * hw], [cx0 + sxv * hw * 0.92, bot, cz0 + szv * hw * 0.92],
            [cx0 - sxv * hw * 0.92, bot, cz0 - szv * hw * 0.92], [cx0 - sxv * hw, top, cz0 - szv * hw],
          ]);
        }
        const quad = (p0, p1, p2, p3, col) => {
          for (const p of [p0, p2, p1, p0, p3, p2]) { P.push(...p); C.push(...col); }
        };
        for (let i = 0; i < n; i++) {
          const A = sl[i], B = sl[i + 1];
          const k2 = 0.9 + 0.1 * Math.sin(i * 1.7);
          const c = [0.52 * k2, 0.46 * k2, 0.46 * k2];
          quad(A[0], B[0], B[1], A[1], c);
          quad(A[1], B[1], B[2], A[2], [0.36, 0.31, 0.34]);
          quad(A[2], B[2], B[3], A[3], c);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
        g.computeVertexNormals();
        kit.add(g, null);
        // Gesimsband (Gold) entlang beider Seiten
        for (const sx of [-1, 1]) {
          const gl = new THREE.BoxGeometry(0.22, 0.22, a1 - a0);
          const m = new THREE.Matrix4().makeRotationY(yaw);
          const mid = (a0 + a1) / 2;
          m.setPosition(b.ax + fx * mid - fz * (hw + 0.05) * sx, -0.45, b.az + fz * mid + fx * (hw + 0.05) * sx);
          kit.add(gl, m, COLORS.GOLD, { metal: 1 });
        }
        // Schlussstein mit Leuchtrune unter der Brückenmitte
        const mid = (t0 + t1) / 2;
        const key = new THREE.OctahedronGeometry(0.5, 0);
        key.scale(1, 1.6, 1);
        kit.add(key, new THREE.Matrix4().makeTranslation(b.ax + fx * mid, -1.7, b.az + fz * mid), [0.3, 0.3, 0.3], { emit: [1.6, 0.8, 0.25] });
      }
      // Torsäulen am Brückenkopf
      for (const sx of [-1, 1]) {
        const px = b.ax + fx * (t0 - 0.8) - fz * (BRIDGE_HW + 0.6) * sx, pz = b.az + fz * (t0 - 0.8) + fx * (BRIDGE_HW + 0.6) * sx;
        if (tm.bridges.some((o) => o !== b && segDist(px, pz, o.ax, o.az, o.bx, o.bz) < BRIDGE_HW + 3.5)) continue;
        kit.pillar(px, -0.2, pz, 3.2, 0.42, { gold: true });
        floatSpots.push({ x: px, y: 5.6, z: pz, s: 0.55, c: GOLD_C });
      }
    });
    // Säulenkranz ums Königsplateau (Lücken für Brücken)
    const bridgeAngles = tm.bridges.map((b) => Math.atan2(b.az - KING_Z, b.ax - tm.cx));
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const near = bridgeAngles.some((ba) => Math.abs(Math.atan2(Math.sin(a - ba), Math.cos(a - ba))) < 0.5);
      if (near) continue;
      const r = PLATEAU_R + 1.6;
      const x = tm.cx + Math.cos(a) * r, z = KING_Z + Math.sin(a) * r;
      if (Math.sin(a) > 0.25) { // Südseite frei halten (Sicht auf den König)
        crystalSpots.push({ x, y: -0.2, z, s: 0.6, rot: i, c: GOLD_C, tilt: 0.1 });
        continue;
      }
      const broken = (i * 7) % 5 === 0;
      kit.pillar(x, -0.3, z, broken ? 3 + (i % 3) : 6.2, 0.62, { broken, gold: true });
      if (!broken && i % 2 === 0) floatSpots.push({ x, y: 9.4, z, s: 0.7, c: GOLD_C });
    }
    // Außenränder: Bögen, Säulen, Obelisken
    const outerX = tm.cx + side * 45;
    kit.arch(outerX + side * -1.5, 0.2, -18, Math.PI / 2, 6, 5.5, { glow: [1.6, 0.9, 0.3] });
    kit.pillar(outerX, 0.3, 4, 5, 0.6, { broken: true });
    kit.pillar(outerX - side * 0.5, 0.3, 9, 7, 0.6, {});
    kit.wall(outerX + side * 0.5, 0.2, 18, Math.PI / 2 + 0.2, 7, 2.4);
    kit.obelisk(tm.cx - side * 45, 0.2, -10, 5.5, 0.4, [0.25, 1.3, 1.6]);
    kit.pillar(tm.cx - side * 44.5, 0.3, 14, 4, 0.55, { broken: true });
    // Nordrand zwischen Portalen: Obelisken
    for (let s = 0; s < 3; s++) {
      const x = (tm.lanes[s] + tm.lanes[s + 1]) / 2;
      kit.obelisk(x, 0.4, -39.2, 6 + (s % 2) * 1.5, s * 0.5, [0.25, 1.3, 1.6]);
      crystalSpots.push({ x: x - 2.4, y: 0.4, z: -37.5, s: 1.3, rot: s, c: TEAL_C, tilt: 0.2 });
      crystalSpots.push({ x: x + 2.2, y: 0.4, z: -38.8, s: 0.9, rot: s + 2, c: VIOLET_C, tilt: -0.2 });
    }
  }

  // Lampen: Pfosten
  for (const l of lampSpots) {
    const post = new THREE.CylinderGeometry(0.22, 0.3, 1.5, 8);
    post.translate(0, 0.75, 0);
    kit.add(post, new THREE.Matrix4().makeTranslation(l.x, 0, l.z), kit.stoneFn(l.z, COLORS.STONE_DARK));
    const cap = new THREE.CylinderGeometry(0.42, 0.26, 0.28, 8);
    cap.translate(0, 1.6, 0);
    kit.add(cap, new THREE.Matrix4().makeTranslation(l.x, 0, l.z), COLORS.GOLD, { metal: 1 });
    floatSpots.push({ x: l.x, y: 2.45, z: l.z, s: 0.32, c: TEAL_C });
  }

  // Heldeninsel: Podest + Säulenkreis
  {
    const dais = new THREE.CylinderGeometry(6.3, 7.0, 1.2, 40);
    dais.translate(HERO.x, HERO.y, HERO.z);
    kit.add(dais, null, kit.stoneFn(3, COLORS.STONE));
    const step = new THREE.CylinderGeometry(7.4, 8.0, 0.6, 40);
    step.translate(HERO.x, HERO.y - 0.4, HERO.z);
    kit.add(step, null, kit.stoneFn(4, COLORS.STONE_DARK));
    const trim = new THREE.TorusGeometry(6.35, 0.1, 6, 64);
    trim.rotateX(Math.PI / 2);
    trim.translate(HERO.x, HERO.y + 0.6, HERO.z);
    kit.add(trim, null, COLORS.GOLD, { metal: 1 });
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.2;
      const x = HERO.x + Math.cos(a) * 10.5, z = HERO.z + Math.sin(a) * 10.5;
      const broken = i % 3 !== 0;
      kit.pillar(x, HERO.y + 0.2, z, broken ? 2.5 + (i % 4) : 7.5, 0.6, { broken, tilt: broken ? (i % 2 ? 0.08 : -0.06) : 0 });
    }
  }

  if (!(A.stone && A.stone.normal)) {
    const rt = terrainMaps.rock ? { map: terrainMaps.rock, normalMap: terrainMaps.rockN } : createRockTextures(512);
    stoneTri = { rock: rt.map, rockN: rt.normalMap, scale: 4.5 };
  }
  const stonePbr = A.stone && A.stone.normal ? { set: A.stone, moss: A.moss || null, meters: A.stone.meters, mossAmount: 0.55 } : null;
  rockTri = A.moss && A.moss.normal ? { set: A.moss, moss: null, meters: A.moss.meters } : null;
  const stoneMat = patchMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.84, metalness: 0 }), U, {
    emissiveAttr: true, metalAttr: true, ...(stonePbr ? { stone: stonePbr } : { terrain: stoneTri }),
  });

  // ---------- Heldenwahrzeichen: Kristallturm + Ringe ----------
  const spireGroup = new THREE.Group();
  spireGroup.position.set(HERO.x, 0, HERO.z);
  root.add(spireGroup);
  {
    const h1 = 14, top = 10, bot = 7, r = 3.1;
    const body = new THREE.CylinderGeometry(r, r * 0.92, h1, 6, 1, true).toNonIndexed();
    const tip = new THREE.ConeGeometry(r, top, 6, 1, true).toNonIndexed();
    tip.translate(0, h1 / 2 + top / 2, 0);
    const btm = new THREE.ConeGeometry(r * 0.92, bot, 6, 1, true).toNonIndexed();
    btm.rotateX(Math.PI);
    btm.translate(0, -h1 / 2 - bot / 2, 0);
    const parts = [body, tip, btm].map((g) => { g.deleteAttribute('uv'); return g; });
    const geo = merge(parts);
    const p = geo.attributes.position;
    const hg = new Float32Array(p.count);
    for (let i = 0; i < p.count; i++) hg[i] = (p.getY(i) + h1 / 2 + bot) / (h1 + top + bot);
    geo.setAttribute('hgt', new THREE.BufferAttribute(hg, 1));
    const mat = createCrystalMaterial(U, { spire: true, intensity: 1.0 });
    mat.uniforms.uColor.value.set(0.25, 0.85, 1.0);
    const spire = new THREE.Mesh(geo, mat);
    spire.position.y = 21;
    spire.castShadow = true;
    spireGroup.add(spire);
    animated.spire = spire;
    // Ringe
    const ringDefs = [
      { r: 9.5, blocks: 26, tilt: [0.35, 0, 0.15], speed: 0.12, glow: [0.3, 1.6, 2.2] },
      { r: 13.0, blocks: 34, tilt: [-0.25, 0, -0.4], speed: -0.08, glow: [2.0, 1.1, 0.35] },
      { r: 17.0, blocks: 44, tilt: [1.35, 0, 0.1], speed: 0.05, glow: [1.2, 0.45, 2.2] },
    ];
    for (const d of ringDefs) {
      const rk = new StoneKit(d.r * 10);
      for (let i = 0; i < d.blocks; i++) {
        if (i % 11 === 10) continue; // Lücken = verfallen
        const a = (i / d.blocks) * Math.PI * 2;
        const seg = (Math.PI * 2 * d.r) / d.blocks;
        const m = new THREE.Matrix4().makeRotationY(-a);
        m.setPosition(Math.cos(a) * d.r, 0, Math.sin(a) * d.r);
        rk.add(new THREE.BoxGeometry(0.9, 1.0, seg * 0.86), m, rk.stoneFn(i, COLORS.STONE));
        rk.add(new THREE.BoxGeometry(0.2, 0.32, seg * 0.6), m.clone().multiply(new THREE.Matrix4().makeTranslation(-0.47, 0, 0)), [0.2, 0.2, 0.2], { emit: d.glow });
        rk.add(new THREE.BoxGeometry(1.0, 0.1, seg * 0.88), m.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.52, 0)), COLORS.GOLD, { metal: 1 });
      }
      const mesh = new THREE.Mesh(rk.build(), stoneMat);
      mesh.castShadow = true;
      const pivot = new THREE.Group();
      pivot.position.y = 21;
      pivot.rotation.set(d.tilt[0], d.tilt[1], d.tilt[2]);
      pivot.add(mesh);
      spireGroup.add(pivot);
      animated.rings.push({ mesh, speed: d.speed });
    }
    // Lichtsäule
    const beamGeo = new THREE.CylinderGeometry(2.2, 3.4, 260, 24, 1, true);
    beamGeo.translate(0, 130 - 6, 0);
    const beam = new THREE.Mesh(beamGeo, createBeamMaterial(U));
    beam.renderOrder = 5;
    beam.frustumCulled = false;
    spireGroup.add(beam);
  }

  // ---------- Platzierung: Bäume, Felsen, Kristalle auf den Inseln ----------
  const occupied = [];
  const free = (x, z, r) => occupied.every((o) => Math.hypot(o.x - x, o.z - z) > o.r + r);
  const occupy = (x, z, r) => occupied.push({ x, z, r });
  for (const l of lampSpots) occupy(l.x, l.z, 1.0);
  for (const d of islandDescs) {
    const tm = d.tm;
    if (d.kind === 'team') {
      const side = tm.team === 0 ? -1 : 1;
      // Hügel zwischen den Bahnen
      for (let s = 0; s < 3; s++) {
        const bx = (tm.lanes[s] + tm.lanes[s + 1]) / 2;
        let z = -33 + R() * 3;
        let k = 0;
        while (z < 27) {
          const typ = (k + s) % 4;
          const x = bx + (R() - 0.5) * 2.2;
          const h = topYAt(d, x, z);
          if (h) {
            if (typ === 0 || typ === 2) { treeSpots[k % 3 === 0 ? 1 : 0].push({ x, y: h.y - 0.1, z, s: 0.5 + R() * 0.22, c: k % 5 === 0 ? 'blossom' : 'green' }); occupy(x, z, 2.2); }
            else if (typ === 1) { crystalSpots.push({ x, y: h.y - 0.2, z, s: 0.8 + R() * 0.5, rot: R() * 6, c: k % 2 ? TEAL_C : VIOLET_C, tilt: (R() - 0.5) * 0.3 }); occupy(x, z, 1.2); }
            else { rockSpots.push({ x, y: h.y - 0.1, z, s: 0.8 + R() * 0.6, rot: R() * 6 }); occupy(x, z, 1.3); }
          }
          z += 6.5 + R() * 3.5;
          k++;
        }
      }
      // Außenränder: große Bäume & Felsen
      const pts = scatterOn(d, 90, (x, z) => {
        let dl = 99; for (const lx of tm.lanes) dl = Math.min(dl, Math.abs(x - lx));
        return dl > HALF + 3 && flatMask(tm, x, z) < 0.01 && (Math.abs(x - tm.cx) > 39 || z < -39.5) && free(x, z, 2.5);
      }, 300 + tm.team, 0.95);
      pts.forEach((p, i) => {
        if (i % 5 === 3) { rockSpots.push({ x: p.x, y: p.y - 0.2, z: p.z, s: 1.0 + p.r * 1.4, rot: p.r * 6 }); occupy(p.x, p.z, 2); }
        else if (i % 7 === 5) { crystalSpots.push({ x: p.x, y: p.y - 0.2, z: p.z, s: 1.3 + p.r * 0.9, rot: p.r * 9, c: i % 2 ? TEAL_C : PINK_C, tilt: 0.1 }); occupy(p.x, p.z, 1.6); }
        else { treeSpots[i % 3 === 0 ? 1 : 0].push({ x: p.x, y: p.y - 0.15, z: p.z, s: 0.8 + p.r * 0.55, c: i % 6 === 1 ? 'blossom' : i % 9 === 4 ? 'gold' : 'green' }); occupy(p.x, p.z, 2.6); }
      });
      // Wasserfälle an den Außenkanten
      for (const fz of [-22, 12]) {
        const th = Math.atan2(fz - d.cz, side * 60);
        const er = d.edgeAt(th);
        const x = d.cx + Math.cos(th) * er * 1.03, z = d.cz + Math.sin(th) * er * 1.03;
        falls.push({ x, y: -2.2, z, dx: Math.cos(th), dz: Math.sin(th), width: 4.2, drop: 60, push: 3.4 });
        rockSpots.push({ x: x - Math.cos(th) * 1.5, y: -1.0, z, s: 1.6, rot: 1 });
      }
      {
        const th = -Math.PI / 2 + side * 0.55;
        const er = d.edgeAt(th);
        falls.push({ x: d.cx + Math.cos(th) * er * 1.03, y: -2.0, z: d.cz + Math.sin(th) * er * 1.03, dx: Math.cos(th), dz: Math.sin(th), width: 3.6, drop: 58 });
      }
    } else if (d.kind === 'king') {
      const pts = scatterOn(d, 26, (x, z) => flatMask(tm, x, z) < 0.01 && Math.hypot(x - tm.cx, z - KING_Z) > PLATEAU_R + 3.2 && free(x, z, 2.4), 500 + tm.team, 0.88);
      pts.forEach((p, i) => {
        const back = p.z < KING_Z + 4 && Math.abs(p.x - tm.cx) > 11;
        if (back && i % 4 !== 2) treeSpots[i % 3 === 0 ? 1 : 0].push({ x: p.x, y: p.y - 0.15, z: p.z, s: 0.75 + p.r * 0.4, c: i % 4 === 1 ? 'blossom' : 'green' });
        else if (i % 5 === 0) crystalSpots.push({ x: p.x, y: p.y - 0.2, z: p.z, s: 0.7 + p.r * 0.5, rot: p.r * 7, c: GOLD_C, tilt: 0.1 });
        else if (i % 5 === 2) rockSpots.push({ x: p.x, y: p.y - 0.1, z: p.z, s: 0.6 + p.r * 0.6, rot: p.r * 6 });
        occupy(p.x, p.z, 2.4);
      });
      // Südrand der Teaminsel (vor den Bahnenden): nur niedrige Deko
      const low = scatterOn(islandDescs.find((q) => q.kind === 'team' && q.tm === tm), 14, (x, z) => z > LANE_Z1 + 0.8 && flatMask(tm, x, z) < 0.01 && free(x, z, 1.5), 600 + tm.team, 0.98);
      low.forEach((p, i) => {
        if (i % 2) rockSpots.push({ x: p.x, y: p.y - 0.1, z: p.z, s: 0.5 + p.r * 0.5, rot: p.r * 6 });
        else crystalSpots.push({ x: p.x, y: p.y - 0.15, z: p.z, s: 0.55 + p.r * 0.4, rot: p.r * 6, c: i % 4 ? TEAL_C : VIOLET_C, tilt: 0.15 });
        occupy(p.x, p.z, 1.5);
      });
      const th = Math.PI / 2 + (tm.team === 0 ? 0.35 : -0.35);
      const er = d.edgeAt(th);
      falls.push({ x: d.cx + Math.cos(th) * er * 1.03, y: -1.9, z: d.cz + Math.sin(th) * er * 1.03, dx: Math.cos(th), dz: Math.sin(th), width: 4.8, drop: 62 });
    } else if (d.kind === 'hero') {
      const pts = scatterOn(d, 14, (x, z) => Math.hypot(x - HERO.x, z - HERO.z) > 8.5 && free(x, z, 2), 900, 0.85);
      pts.forEach((p, i) => {
        if (i % 3 === 0) treeSpots[0].push({ x: p.x, y: p.y - 0.15, z: p.z, s: 0.7 + p.r * 0.3, c: 'blossom' });
        else crystalSpots.push({ x: p.x, y: p.y - 0.2, z: p.z, s: 1.2 + p.r * 0.8, rot: p.r * 9, c: i % 2 ? TEAL_C : VIOLET_C, tilt: 0.15 });
        occupy(p.x, p.z, 2);
      });
      falls.push({ x: HERO.x + 2, y: HERO.y - 2.0, z: HERO.z + 15.5, dx: 0.1, dz: 1, width: 5.5, drop: 50, push: 4 });
    }
  }

  // ---------- Hintergrund-Inseln ----------
  const farGeos = [];
  const farTrees = [];
  const farDefs = [];
  {
    const FR = rng(555);
    const ring = [
      // Norden (hinter den Portalen, immer im Bild)
      [-210, -260, 55, 6], [-40, -330, 70, 14], [150, -270, 48, 2], [330, -380, 80, 20], [-360, -420, 90, 26],
      [40, -560, 120, 34], [-120, -170, 22, -12], [95, -175, 18, -16], [250, -160, 26, -8], [-280, -150, 30, -4],
      // Seiten
      [-330, -10, 60, 10], [-260, 140, 40, -2], [340, 40, 66, 12], [270, 190, 36, -6],
      // Süden
      [-120, 260, 50, 4], [110, 300, 60, 8], [0, 520, 110, 26], [-420, 330, 90, 18], [430, 360, 95, 22],
      // Mittelgrund (Tiefenstaffelung)
      [-205, 25, 26, -14], [215, 70, 22, -10], [-185, 125, 18, -20], [190, -85, 20, -4], [-175, -95, 16, 6],
      [-15, -135, 14, -22], [130, 150, 16, -26],
    ];
    ring.forEach(([x, z, r, y], i) => {
      const seed = 700 + i;
      // Unregelmäßige Silhouette: gelappter Umriss, zerklüftete Flanken, hängende Felszapfen, Trabanten-Brocken
      const ph = FR() * 6.28, ph2 = FR() * 6.28;
      const radius = (th) => r * (1 + 0.24 * fbm2(Math.cos(th) * 2 + i, Math.sin(th) * 2, 3, seed)
        + 0.09 * Math.sin(th * 3 + ph) + 0.05 * Math.sin(th * 5 + ph2));
      const isl = buildIsland({
        cx: x, cz: z, topY: y, radius, depth: r * (1.1 + FR() * 0.9), seed, segs: 76, rings: 8, sideRings: 26, rimDrop: r * 0.05,
        height: (px, pz, t) => (1 - t * t) * r * 0.12 * (0.5 + fbm2(px * 0.02, pz * 0.02, 3, seed) + 0.5)
          + Math.max(0, fbm2(px * 0.05, pz * 0.05, 3, seed + 9)) * r * 0.06 * (1 - t),
        grass: lushGrass(seed), edgeNoise: 0.14, taper: 0.42 + FR() * 0.35, lobes: 1.1, rough: Math.max(1, r / 22),
      });
      const nStal = r > 30 ? 2 + Math.floor(FR() * 4) : 1 + Math.floor(FR() * 2);
      for (let k = 0; k < nStal; k++) {
        const a = FR() * Math.PI * 2, rr = Math.sqrt(FR()) * 0.5;
        const sr = r * (0.16 + FR() * 0.16);
        farGeos.push(buildStalactite({ x: x + Math.cos(a) * r * rr, y: y - r * 0.15, z: z + Math.sin(a) * r * rr, r: sr, len: r * (0.7 + FR() * 0.8), seed: seed * 7 + k, segs: 16 }).toNonIndexed());
      }
      if (r > 25) {
        for (let k = 0; k < 2; k++) {
          const a = FR() * Math.PI * 2, d = r * (1.25 + FR() * 0.4), sr = r * (0.12 + FR() * 0.1);
          const sat = buildIsland({
            cx: x + Math.cos(a) * d, cz: z + Math.sin(a) * d, topY: y - r * (0.05 + FR() * 0.25), radius: (th) => sr * (1 + 0.3 * fbm2(Math.cos(th) * 2, Math.sin(th) * 2, 3, seed + k)),
            depth: sr * 2.4, seed: seed * 3 + k, segs: 20, rings: 3, sideRings: 10, rimDrop: sr * 0.2, edgeNoise: 0.25, taper: 0.7, lobes: 0.8,
            grass: lushGrass(seed), rough: Math.max(1, sr / 22),
          });
          farGeos.push(sat.geometry.toNonIndexed());
        }
      }
      farGeos.push(isl.geometry.toNonIndexed());
      farDefs.push({ x, z, r, y });
      // Bäume
      const nt = Math.round(r / 6);
      for (let k = 0; k < nt; k++) {
        const a = FR() * Math.PI * 2, rr = Math.sqrt(FR()) * r * 0.7;
        const px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr;
        farTrees.push({ x: px, y: y + (1 - (rr / r) ** 2) * r * 0.12 + r * 0.03 - 0.5, z: pz, s: 1.6 + FR() * 1.8, c: k % 4 === 0 ? 'blossom' : 'green', far: true });
      }
      if (i % 3 === 0) {
        const th = Math.atan2(-z, -x) + (FR() - 0.5) * 1.4;
        falls.push({ x: x + Math.cos(th) * r * 1.0, y: y - r * 0.08, z: z + Math.sin(th) * r * 1.0, dx: Math.cos(th), dz: Math.sin(th), width: r * 0.16, drop: y - CLOUD_TOP + 10, push: r * 0.08 });
      }
      if (i % 2 === 1 && r > 40) {
        // Ruinen-Silhouetten
        const fk = new StoneKit(seed);
        for (let p = 0; p < 4; p++) {
          const a = (p / 4) * Math.PI * 2 + i;
          fk.pillar(x + Math.cos(a) * r * 0.3, y + r * 0.1, z + Math.sin(a) * r * 0.3, 10 + (p % 2) * 6, 1.4, { broken: p % 2 === 1 });
        }
        fk.arch(x, y + r * 0.1, z, i, 14, 12, { glow: [1.6, 0.9, 0.3] });
        farGeos.push(...fk.parts.map((g) => { const c = g.clone(); c.deleteAttribute('emit'); c.deleteAttribute('metal'); return c; }));
      }
      wispItems.push({ x: x + (FR() - 0.5) * r, y: y - r * 0.9, z: z + (FR() - 0.5) * r, s: r * 2.2, a: 0.35, stretch: 2.2 });
    });
    // Leuchtender Kristall auf der großen Nordinsel
    crystalSpots.push({ x: 40, y: 34 + 120 * 0.1, z: -560, s: 9, rot: 0, c: TEAL_C, tilt: 0 });
    crystalSpots.push({ x: 330, y: 20 + 80 * 0.1, z: -380, s: 6, rot: 1, c: PINK_C, tilt: 0.2 });
  }
  const farMat = patchMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }), U, { clampFar: true, terrain: farTerrain, far: true });
  const farMesh = new THREE.Mesh(merge(farGeos.map((g) => {
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k);
    return g;
  })), farMat);
  farMesh.name = 'aeth-far-islands';
  farMesh.frustumCulled = false;
  root.add(farMesh);

  // ---------- Bäume (instanziert) ----------
  const trunkMat = patchMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 }), U, { wind: 2, bark: A.bark && A.bark.normal ? A.bark : true });
  const leafAtlas = createLeafAtlas(A.leaves?.sprites || null);
  leafAtlas.anisotropy = anisotropy;
  const canopyMat = patchMaterial(new THREE.MeshStandardMaterial({
    vertexColors: true, map: leafAtlas, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6, metalness: 0,
  }), U, { wind: 2, foliage: true });
  canopyMat.shadowSide = THREE.DoubleSide;
  const treeColor = (c, R2) => {
    if (c === 'blossom') return new THREE.Color().setHSL(0.93 + R2() * 0.03, 0.75, 0.62 + R2() * 0.1);
    if (c === 'gold') return new THREE.Color().setHSL(0.08 + R2() * 0.03, 0.8, 0.36);
    return new THREE.Color().setHSL(0.21 + R2() * 0.07, 0.5 + R2() * 0.2, 0.17 + R2() * 0.07);
  };
  const allTrees = [treeSpots[0], treeSpots[1], farTrees.filter((t, i) => i % 3), farTrees.filter((t, i) => !(i % 3))];
  const treeMeshes = [];
  for (let slot = 0; slot < 4; slot++) {
    const kind = slot % 2;
    const far = slot >= 2;
    const list = allTrees[slot];
    if (!list.length) continue;
    const trunk = new THREE.InstancedMesh(treeTrunkGeometry(kind), trunkMat, list.length);
    const canopy = new THREE.InstancedMesh(treeFoliageGeometry(kind, 3 + kind + slot, far ? 0.55 : 1), canopyMat, list.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    const R2 = rng(31 + slot);
    list.forEach((t, i) => {
      e.set((R2() - 0.5) * 0.08, R2() * Math.PI * 2, (R2() - 0.5) * 0.08);
      q.setFromEuler(e);
      const s = t.s * (kind === 1 ? 1.1 : 1);
      m.compose(new THREE.Vector3(t.x, t.y, t.z), q, new THREE.Vector3(s, s * (0.9 + R2() * 0.25), s));
      trunk.setMatrixAt(i, m);
      canopy.setMatrixAt(i, m);
      let col = treeColor(kind === 1 && t.c === 'blossom' ? 'green' : t.c, R2);
      if (kind === 1) col.offsetHSL(0.07, -0.15, -0.05);
      canopy.setColorAt(i, col);
    });
    trunk.name = `aeth-trunks-${slot}`; canopy.name = `aeth-canopies-${slot}`;
    for (const im of [trunk, canopy]) {
      im.castShadow = !far; im.receiveShadow = !far;
      im.computeBoundingSphere();
      root.add(im);
      treeMeshes.push(im);
    }
  }

  // ---------- Felsen ----------
  const rockMat = patchMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88 }), U, rockTri ? { stone: rockTri } : { detail: 2.4, bump: 1.6 });
  {
    const rocks = new THREE.InstancedMesh(rockGeometry(3), rockMat, rockSpots.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion();
    rockSpots.forEach((r, i) => {
      q.setFromEuler(new THREE.Euler(0, r.rot, 0));
      m.compose(new THREE.Vector3(r.x, r.y, r.z), q, new THREE.Vector3(r.s * 1.2, r.s, r.s));
      rocks.setMatrixAt(i, m);
      rocks.setColorAt(i, new THREE.Color().setHSL(0.07 + (i % 5) * 0.01, 0.1, 0.62 + (i % 3) * 0.08));
    });
    rocks.castShadow = true; rocks.receiveShadow = true;
    rocks.computeBoundingSphere();
    root.add(rocks);
  }

  // ---------- Kristalle ----------
  const crystalGeo = crystalClusterGeometry(9, 7);
  {
    const mat = createCrystalMaterial(U, { intensity: 1.0 });
    const im = new THREE.InstancedMesh(crystalGeo, mat, crystalSpots.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion();
    crystalSpots.forEach((c, i) => {
      q.setFromEuler(new THREE.Euler(c.tilt || 0, c.rot, (c.tilt || 0) * 0.5));
      m.compose(new THREE.Vector3(c.x, c.y, c.z), q, new THREE.Vector3(c.s, c.s, c.s));
      im.setMatrixAt(i, m);
      im.setColorAt(i, c.c);
    });
    im.castShadow = true;
    im.computeBoundingSphere();
    root.add(im);
  }
  // Schwebende Splitter (Lampen, Säulen, Portale) + Satelliten
  {
    // zusätzliche Schwebe-Splitter über den Hügeln
    for (const tm of teams) for (let s = 0; s < 3; s++) {
      const bx = (tm.lanes[s] + tm.lanes[s + 1]) / 2;
      for (const z of [-20, 0, 18]) floatSpots.push({ x: bx + (R() - 0.5) * 2, y: 4.5 + R() * 2.5, z: z + R() * 4, s: 0.5 + R() * 0.3, c: s === 1 ? VIOLET_C : TEAL_C });
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      floatSpots.push({ x: HERO.x + Math.cos(a) * 6.5, y: 6 + (i % 3) * 3.5, z: HERO.z + Math.sin(a) * 6.5, s: 0.9 + (i % 2) * 0.6, c: i % 2 ? TEAL_C : VIOLET_C });
    }
    const mat = createCrystalMaterial(U, { floating: true, intensity: 0.7 });
    const im = new THREE.InstancedMesh(crystalShardGeometry(), mat, floatSpots.length);
    const m = new THREE.Matrix4();
    floatSpots.forEach((f, i) => {
      m.makeScale(f.s, f.s, f.s);
      m.setPosition(f.x, f.y, f.z);
      im.setMatrixAt(i, m);
      im.setColorAt(i, f.c);
    });
    im.frustumCulled = false;
    root.add(im);
  }

  // ---------- Steinbaukasten fertigstellen ----------
  const stoneMesh = new THREE.Mesh(kit.build(), stoneMat);
  stoneMesh.castShadow = true; stoneMesh.receiveShadow = true;
  stoneMesh.name = 'aeth-stone';
  root.add(stoneMesh);

  // ---------- Bordsteine & Brüstungen (instanziert) ----------
  {
    const curbs = [];
    for (const tm of teams) {
      for (const lx of tm.lanes) for (const sx of [-1, 1]) {
        for (let z = LANE_Z0 + 1.0; z < LANE_Z1 - 0.5; z += 2.05) {
          const x = lx + sx * CURB_X;
          if (lampSpots.some((l) => Math.abs(l.x - x) < 0.1 && Math.abs(l.z - z) < 1.3)) continue;
          if (z < PORTAL_Z + 1.2 && z > PORTAL_Z - 2.5) continue;
          curbs.push({ x, z, yaw: 0, len: 1.95 });
        }
      }
      tm.bridges.forEach((b) => {
        const [t0, t1] = b.span;
        const len = Math.hypot(b.bx - b.ax, b.bz - b.az);
        const fx = (b.bx - b.ax) / len, fz = (b.bz - b.az) / len;
        const yaw = Math.atan2(fx, fz);
        for (const sx of [-1, 1]) for (let d = t0 - 0.2; d < t1 + 0.6; d += 2.05) {
          curbs.push({ x: b.ax + fx * d - fz * (BRIDGE_HW + 0.3) * sx, z: b.az + fz * d + fx * (BRIDGE_HW + 0.3) * sx, yaw, len: 1.95, y: 0.05 });
        }
      });
    }
    const geo = new RoundedBoxGeometry(0.72, 0.62, 1, 1, 0.14);
    const mat = patchMaterial(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.86 }), U, stonePbr ? { stone: { ...stonePbr, mossAmount: 0.75 } } : { terrain: stoneTri });
    const im = new THREE.InstancedMesh(geo, mat, curbs.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion();
    const RC = rng(12);
    curbs.forEach((c, i) => {
      q.setFromEuler(new THREE.Euler(0, c.yaw + (RC() - 0.5) * 0.04, 0));
      m.compose(new THREE.Vector3(c.x, (c.y ?? 0) + 0.2 + RC() * 0.04, c.z), q, new THREE.Vector3(1, 0.9 + RC() * 0.2, c.len));
      im.setMatrixAt(i, m);
      const k = 0.85 + RC() * 0.2;
      im.setColorAt(i, new THREE.Color(0.44 * k, 0.41 * k, 0.38 * k));
    });
    im.castShadow = true; im.receiveShadow = true;
    im.computeBoundingSphere();
    root.add(im);
  }

  // ---------- Gras & Blumen (räumlich gekachelt → Frustum-Culling je Kachel; feine Halme, Distanz-Ausblendung) ----------
  let grass, flowers;
  {
    const spots = [];
    const fl = [];
    for (const d of islandDescs) {
      const tm = d.tm;
      const n = d.kind === 'team' ? 12500 : d.kind === 'king' ? 2400 : 1000;
      const pts = scatterOn(d, n, (x, z, y, r) => {
        if (tm && flatMask(tm, x, z) > 0.02) return false;
        if (d.kind === 'hero' && Math.hypot(x - HERO.x, z - HERO.z) < 8.2) return false;
        // Büschel-Verteilung: dichter in Flecken
        const dens = fbm2(x * 0.08, z * 0.08, 2, 77) * 0.5 + 0.5;
        return r() < 0.35 + dens * 0.9;
      }, 1000 + islandDescs.indexOf(d), 0.97);
      spots.push(...pts);
      const fpts = scatterOn(d, Math.round(n * 0.1), (x, z) => !(tm && flatMask(tm, x, z) > 0.02) && !(d.kind === 'hero' && Math.hypot(x - HERO.x, z - HERO.z) < 8.2), 2000 + islandDescs.indexOf(d), 0.93);
      fl.push(...fpts);
    }
    const RS = rng(4);
    const gmat = patchMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, side: THREE.DoubleSide }), U, { wind: 1, grass: true });
    const gGeos = [grassClumpGeometry(5, 11), grassClumpGeometry(8, 9), grassClumpGeometry(13, 12)];
    const m = new THREE.Matrix4(), q = new THREE.Quaternion();
    const col = new THREE.Color();
    grass = chunkedInstances(spots.slice(0, MAX_GRASS), 30, (k) => gGeos[k % gGeos.length], gmat, (p, mm, c) => {
      q.setFromEuler(new THREE.Euler((RS() - 0.5) * 0.25, RS() * Math.PI * 2, (RS() - 0.5) * 0.25));
      const s = 0.7 + RS() * 0.75;
      mm.compose(new THREE.Vector3(p.x, p.y - 0.06, p.z), q, new THREE.Vector3(s, s * (0.65 + RS() * 0.75), s));
      const n = fbm2(p.x * 0.045, p.z * 0.045, 3, 11) * 0.5 + 0.5;
      const dry = smoothstep(0.62, 0.8, fbm2(p.x * 0.18, p.z * 0.18, 2, 18) * 0.5 + 0.5);
      const v = 0.85 + RS() * 0.3;
      c.setRGB((lerp(0.058, 0.13, n) + dry * 0.12) * v, (lerp(0.135, 0.235, n) + dry * 0.05) * v, lerp(0.026, 0.038, n) * v);
    }, 'aeth-grass', RS);
    grass.meshes.forEach((im) => { im.receiveShadow = true; root.add(im); });

    const fgeo = flowerGeometry();
    const palette = [[0.75, 0.22, 0.38], [0.8, 0.78, 0.72], [0.36, 0.2, 0.62], [0.85, 0.6, 0.08], [0.22, 0.38, 0.85], [0.8, 0.78, 0.72]];
    flowers = chunkedInstances(fl.slice(0, MAX_FLOWERS), 40, () => fgeo, gmat, (p, mm, c) => {
      q.setFromEuler(new THREE.Euler(0, RS() * 6, 0));
      const s = 0.6 + RS() * 0.7;
      mm.compose(new THREE.Vector3(p.x, p.y - 0.05, p.z), q, new THREE.Vector3(s, s, s));
      const cc = palette[Math.floor(RS() * palette.length)];
      c.setRGB(cc[0], cc[1], cc[2]);
    }, 'aeth-flowers', RS);
    flowers.meshes.forEach((im) => { im.receiveShadow = true; root.add(im); });
  }

  // ---------- Schwebende Felsbrocken ----------
  {
    const geo = buildFloatingRock(3, 3).toNonIndexed();
    const list = [];
    const FR = rng(91);
    const add = (x, y, z, s) => list.push({ x, y, z, s, ph: FR() * 6.28, sp: 0.3 + FR() * 0.4, rot: FR() * 6 });
    for (let i = 0; i < 10; i++) add((FR() - 0.5) * 34, -6 - FR() * 22, -40 + FR() * 90, 0.5 + FR() * 1.2);
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 8; i++) add(sx * (122 + FR() * 25), -4 - FR() * 26, -40 + FR() * 90, 0.6 + FR() * 1.6);
      for (let i = 0; i < 5; i++) add(sx * (70 + (FR() - 0.5) * 70), -8 - FR() * 20, -52 - FR() * 20, 0.6 + FR() * 1.4);
      for (let i = 0; i < 5; i++) add(sx * (70 + (FR() - 0.5) * 60), -6 - FR() * 18, 36 + FR() * 6 + (FR() > 0.5 ? 0 : 30), 0.4 + FR() * 0.8);
    }
    const mat = patchMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 }), U, { terrain: terrainMaps });
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    im.castShadow = true; im.receiveShadow = true;
    im.frustumCulled = false;
    root.add(im);
    animated.floatRocks = { mesh: im, list };
    for (const r of list) wispItems.push({ x: r.x, y: r.y - 6, z: r.z, s: 14 * r.s, a: 0.18 });
  }

  // ---------- Portale (Wirbel) ----------
  {
    const parts = [];
    let k = 0;
    for (const tm of teams) for (const lx of tm.lanes) {
      const g = new THREE.CircleGeometry(PORTAL_R, 56);
      g.translate(lx, PORTAL_Y, PORTAL_Z + 0.1);
      const n = g.attributes.position.count;
      g.setAttribute('seed', new THREE.Float32BufferAttribute(new Array(n).fill(k++ * 0.37), 1));
      g.deleteAttribute('normal');
      parts.push(g);
    }
    const mesh = new THREE.Mesh(merge(parts), createPortalMaterial(U));
    mesh.name = 'aeth-portals';
    mesh.renderOrder = 2;
    root.add(mesh);
  }

  // ---------- Wasserfälle + Schwaden ----------
  root.add(createWaterfalls(U, falls));
  for (const f of falls) {
    const endX = f.x + f.dx * ((f.push ?? 3.2) * 0.75 + 1.2), endZ = f.z + f.dz * ((f.push ?? 3.2) * 0.75 + 1.2);
    wispItems.push({ x: endX, y: CLOUD_TOP + 4, z: endZ, s: f.width * 5, a: 0.55, kind: 1, stretch: 1.4 });
    wispItems.push({ x: endX, y: f.y - f.drop * 0.55, z: endZ, s: f.width * 2.6, a: 0.22, kind: 1, stretch: 0.6 });
  }
  for (const d of islandDescs) {
    const rr = d.kind === 'team' ? 45 : d.kind === 'king' ? 17 : 14;
    const n = d.kind === 'team' ? 9 : 4;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + R();
      wispItems.push({ x: d.cx + Math.cos(a) * rr * 0.8, y: -16 - R() * 26, z: d.cz + Math.sin(a) * rr * 0.8, s: 30 + R() * 30, a: 0.32, stretch: 2.0 });
    }
  }
  // Wolkenbänke Richtung Horizont
  for (let i = 0; i < 26; i++) {
    const a = R() * Math.PI * 2, r = 180 + R() * 520;
    wispItems.push({ x: Math.cos(a) * r, y: CLOUD_TOP + 2 + R() * 10, z: Math.sin(a) * r * 0.9 - 60, s: 90 + R() * 120, a: 0.38, stretch: 2.6 });
  }
  root.add(createWisps(U, createWispTexture(256), wispItems));

  // ---------- Lichtschächte unter/zwischen den Inseln ----------
  {
    const L = U.uLightDir.value;
    const SR = rng(808);
    const shafts = [];
    for (let i = 0; i < 26; i++) {
      const len = 60 + SR() * 30;
      const lx = (SR() - 0.5) * 300, lz = -90 + SR() * 200;
      const y0 = CLOUD_TOP + 2;
      shafts.push({ x: lx + L.x * len / 2, y: y0 + L.y * len / 2, z: lz + L.z * len / 2, w: 5 + SR() * 12, len });
    }
    root.add(createLightShafts(U, shafts, 0.085));
  }

  // ---------- Partikel ----------
  const fixed = [], scalable = [];
  const PR = rng(17);
  for (const tm of teams) for (const lx of tm.lanes) for (let i = 0; i < 34; i++) {
    fixed.push({ x: lx, y: 0, z: PORTAL_Z, kind: 2, size: 0.3 + PR() * 0.3, c: PR() < 0.5 ? [1.6, 0.7, 3.2] : [0.5, 2.6, 3.0] });
  }
  for (let i = 0; i < 180; i++) fixed.push({ x: HERO.x, y: HERO.y, z: HERO.z, kind: 3, size: 0.35 + PR() * 0.4, range: 4 + PR() * 9, c: PR() < 0.6 ? [0.6, 2.4, 3.2] : [2.6, 1.6, 0.7] });
  for (const d of islandDescs) {
    const n = d.kind === 'team' ? 500 : d.kind === 'king' ? 120 : 80;
    const pts = scatterOn(d, n, null, 3000 + islandDescs.indexOf(d), 0.95);
    for (const p of pts) scalable.push({ x: p.x, y: p.y + 0.6 + PR() * 3.5, z: p.z, kind: 0, size: 0.22 + PR() * 0.18, c: PR() < 0.7 ? [0.95, 1.05, 0.35] : [0.4, 1.05, 0.8] });
  }
  for (let i = 0; i < 2200; i++) {
    scalable.push({ x: (PR() - 0.5) * 290, y: -6 + PR() * 14, z: -60 + PR() * 140, kind: 1, size: 0.09 + PR() * 0.09, range: 18 + PR() * 14, c: [1.3, 0.95, 0.6] });
  }
  const particles = createParticles(U, { fixed, scalable });
  root.add(particles.points);

  return { root, grass, flowers, particles, animated, islandMesh, teams };
}

/**
 * Verteilt Instanzen auf ein Raster (cell Meter) → je Kachel ein InstancedMesh mit eigener Hülle (Frustum-Culling).
 * Innerhalb jeder Kachel gemischt, damit setFraction(f) gleichmäßig ausdünnt.
 */
function chunkedInstances(points, cell, geoFor, material, setter, name, R) {
  const cells = new Map();
  for (const p of points) {
    const k = `${Math.floor(p.x / cell)},${Math.floor(p.z / cell)}`;
    if (!cells.has(k)) cells.set(k, []);
    cells.get(k).push(p);
  }
  const meshes = [];
  const m = new THREE.Matrix4(), c = new THREE.Color();
  let idx = 0;
  for (const list of cells.values()) {
    for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
    const im = new THREE.InstancedMesh(geoFor(idx++), material, list.length);
    list.forEach((p, i) => { setter(p, m, c); im.setMatrixAt(i, m); im.setColorAt(i, c); });
    im.name = name;
    im.computeBoundingSphere();
    im.userData.max = list.length;
    meshes.push(im);
  }
  return {
    meshes,
    setFraction(f) { for (const im of meshes) im.count = Math.max(0, Math.floor(im.userData.max * f)); },
    get count() { return meshes.reduce((a, im) => a + im.count, 0); },
  };
}
