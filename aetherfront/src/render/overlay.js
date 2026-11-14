// Bau-Overlay: leuchtendes Bauraster der eigenen Bahn, Platzierungs-Vorschau (Hologramm),
// Reichweitenkreis und Auswahl. Plus Bildschirm→Welt-Umrechnung fürs Klicken.
import * as THREE from 'three';
import { buildModel } from './models.js';
import { GRID_COLS, GRID_ROWS, CELL, cellCenter, laneCenterX, BUILD_Z0 } from '../sim/layout.js';
import { FACTIONS } from '../sim/data.js';

const _c = new THREE.Color();

export class Overlay {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.ray = new THREE.Raycaster();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.time = 0;

    // Raster: eine Instanz je Zelle (weicher, abgerundeter Leuchtpunkt – keine harten Kacheln)
    const geo = new THREE.PlaneGeometry(CELL * 0.92, CELL * 0.92).rotateX(-Math.PI / 2);
    this.gridMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
      uniforms: { uTime: { value: 0 }, uAlpha: { value: 0 } },
      vertexShader: /* glsl */`varying vec2 vUv; varying vec3 vCol; void main(){ vUv = uv; vCol = instanceColor; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */`
        varying vec2 vUv; varying vec3 vCol; uniform float uTime, uAlpha;
        void main(){
          vec2 p = abs(vUv - 0.5) * 2.0;
          float d = length(max(p - 0.55, 0.0)) / 0.45;          // abgerundetes Quadrat (Squircle)
          float edge = smoothstep(0.75, 0.95, d) * (1.0 - smoothstep(0.95, 1.0, d));
          float fill = (1.0 - smoothstep(0.0, 1.0, d)) * 0.10;
          float pulse = 0.8 + 0.2 * sin(uTime * 2.0 + vUv.x * 3.0);
          gl_FragColor = vec4(vCol * (edge + fill) * pulse * uAlpha, 1.0);
        }`,
    });
    this.grid = new THREE.InstancedMesh(geo, this.gridMat, GRID_COLS * GRID_ROWS);
    this.grid.frustumCulled = false;
    this.grid.renderOrder = 3;
    this.grid.setColorAt(0, _c.set(1, 1, 1));
    this.root.add(this.grid);

    // Reichweitenkreis
    const rgeo = new THREE.RingGeometry(0.97, 1, 96).rotateX(-Math.PI / 2);
    this.range = new THREE.Mesh(rgeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 1.4, 2.2), transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }));
    this.range.visible = false;
    this.range.renderOrder = 4;
    this.root.add(this.range);

    // Hologramm-Vorschau
    this.ghostMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 1.3, 2.0), transparent: true, opacity: 0.35, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending });
    this.ghostBad = new THREE.Color(2.0, 0.4, 0.4);
    this.ghostGood = new THREE.Color(0.5, 1.3, 2.0);
    this.ghost = new THREE.Mesh(new THREE.BufferGeometry(), this.ghostMat);
    this.ghost.visible = false;
    this.root.add(this.ghost);
    this.ghostCache = new Map();
    this.lane = null;
  }

  setLane(team, slot) { this.lane = { team, slot }; }

  screenToGround(clientX, clientY) {
    const v = new THREE.Vector2((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
    this.ray.setFromCamera(v, this.camera);
    const p = new THREE.Vector3();
    return this.ray.ray.intersectPlane(this.plane, p) ? p : null;
  }

  cellAt(p) {
    if (!p || !this.lane) return null;
    const x0 = laneCenterX(this.lane.team, this.lane.slot) - (GRID_COLS * CELL) / 2;
    const col = Math.floor((p.x - x0) / CELL), row = Math.floor((p.z - BUILD_Z0) / CELL);
    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return null;
    return { col, row };
  }

  ghostFor(unit) {
    let g = this.ghostCache.get(unit.id);
    if (!g) { g = buildModel(unit.model, { ...FACTIONS[unit.faction].palette, tier: unit.tier, seed: 1 }).body; this.ghostCache.set(unit.id, g); }
    return g;
  }

  /** state: { showGrid, occupied:Set('c,r'), hoverCell, placing: unitDef|null, canAfford, selected:{x,z,range}|null } */
  update(dt, state) {
    this.time += dt;
    this.gridMat.uniforms.uTime.value = this.time;
    const target = state.showGrid ? 1 : 0;
    const a = this.gridMat.uniforms.uAlpha;
    a.value += (target - a.value) * Math.min(1, dt * 6);
    this.grid.visible = a.value > 0.01 && !!this.lane;
    if (this.grid.visible) {
      const m = new THREE.Matrix4();
      let i = 0;
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          const cc = cellCenter(this.lane.team, this.lane.slot, c, r);
          m.makeTranslation(cc.x, 0.07, cc.z);
          this.grid.setMatrixAt(i, m);
          const occ = state.occupied?.has(`${c},${r}`);
          const hov = state.hoverCell && state.hoverCell.col === c && state.hoverCell.row === r;
          if (hov) _c.setRGB(state.placing && (occ || !state.canAfford) ? 3 : 1.2, state.placing && (occ || !state.canAfford) ? 0.5 : 2.4, state.placing && (occ || !state.canAfford) ? 0.5 : 3);
          else if (occ) _c.setRGB(0.25, 0.3, 0.5);
          else _c.setRGB(0.45, 1.0, 1.6).multiplyScalar(state.placing ? 1.4 : 0.9);
          this.grid.setColorAt(i, _c);
          i++;
        }
      }
      this.grid.instanceMatrix.needsUpdate = true;
      this.grid.instanceColor.needsUpdate = true;
    }

    // Vorschau
    const pl = state.placing;
    if (pl && state.hoverCell && this.lane) {
      const cc = cellCenter(this.lane.team, this.lane.slot, state.hoverCell.col, state.hoverCell.row);
      this.ghost.geometry = this.ghostFor(pl);
      this.ghost.position.set(cc.x, 0.05 + Math.sin(this.time * 3) * 0.06, cc.z);
      this.ghost.rotation.y = Math.PI;
      const bad = state.occupied?.has(`${state.hoverCell.col},${state.hoverCell.row}`) || !state.canAfford;
      this.ghostMat.color.copy(bad ? this.ghostBad : this.ghostGood);
      this.ghostMat.opacity = 0.28 + Math.sin(this.time * 5) * 0.06;
      this.ghost.visible = true;
      this.range.visible = true;
      this.range.position.set(cc.x, 0.1, cc.z);
      this.range.scale.setScalar(Math.max(1.5, pl.range + 0.6));
    } else {
      this.ghost.visible = false;
      if (state.selected) {
        this.range.visible = true;
        this.range.position.set(state.selected.x, 0.1, state.selected.z);
        this.range.scale.setScalar(Math.max(1.5, state.selected.range + 0.6));
      } else this.range.visible = false;
    }
  }
}
