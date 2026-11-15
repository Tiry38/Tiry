// Sichtbereichs-Ausdünnung für weit verteilte, instanzierte Deko (Bäume, Felsen, Kristalle, Bordsteine).
// Ein InstancedMesh pro Art bleibt EIN Draw-Call, rendert aber nur die Instanzen, deren Hüllkugel (plus Rand für
// Schatten, die von knapp außerhalb ins Bild fallen) im Kamera-Frustum liegt. Die Instanzen werden dafür vorne im
// Puffer zusammengeschoben (Reihenfolge stabil) – neu nur, wenn sich die Kamera bewegt hat.
import * as THREE from 'three';

const _frustum = new THREE.Frustum();
const _pv = new THREE.Matrix4();
const _m = new THREE.Matrix4();
const _sphere = new THREE.Sphere();

export function createInstanceCuller() {
  const sets = [];
  const last = new Float32Array(16);
  let dirty = true;
  return {
    /**
     * meshes: InstancedMeshes mit gleicher Instanz-Belegung (z. B. Stamm + Krone). margin: Zusatzradius (Welteinheiten).
     */
    add(meshes, margin = 0) {
      meshes = (Array.isArray(meshes) ? meshes : [meshes]).filter(Boolean);
      if (!meshes.length) return;
      const n = meshes[0].count;
      let gr = 0;
      const gc = new THREE.Vector3();
      for (const im of meshes) {
        im.geometry.computeBoundingSphere();
        const bs = im.geometry.boundingSphere;
        gr = Math.max(gr, bs.center.length() + bs.radius);
      }
      const spheres = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) {
        meshes[0].getMatrixAt(i, _m);
        gc.setFromMatrixPosition(_m);
        spheres[i * 4] = gc.x; spheres[i * 4 + 1] = gc.y; spheres[i * 4 + 2] = gc.z;
        spheres[i * 4 + 3] = gr * _m.getMaxScaleOnAxis() + margin;
      }
      const src = meshes.map((im) => ({
        im,
        mat: im.instanceMatrix.array.slice(0, n * 16),
        col: im.instanceColor ? im.instanceColor.array.slice(0, n * 3) : null,
      }));
      for (const im of meshes) im.frustumCulled = false;
      sets.push({ n, spheres, src });
      dirty = true;
    },
    /** Pro Bild vor dem Rendern aufrufen. */
    update(camera) {
      camera.updateMatrixWorld();
      _pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      const e = _pv.elements;
      let same = !dirty;
      for (let i = 0; i < 16 && same; i++) if (last[i] !== Math.fround(e[i])) same = false;
      if (same) return;
      last.set(e);
      dirty = false;
      _frustum.setFromProjectionMatrix(_pv);
      for (const s of sets) {
        let k = 0;
        for (let i = 0; i < s.n; i++) {
          _sphere.center.set(s.spheres[i * 4], s.spheres[i * 4 + 1], s.spheres[i * 4 + 2]);
          _sphere.radius = s.spheres[i * 4 + 3];
          if (!_frustum.intersectsSphere(_sphere)) continue;
          // immer kopieren: an Stelle k kann vom letzten Bild noch eine andere Instanz liegen
          for (const { im, mat, col } of s.src) {
            im.instanceMatrix.array.set(mat.subarray(i * 16, i * 16 + 16), k * 16);
            if (col) im.instanceColor.array.set(col.subarray(i * 3, i * 3 + 3), k * 3);
          }
          k++;
        }
        for (const { im } of s.src) {
          im.count = k;
          im.visible = k > 0;
          im.instanceMatrix.needsUpdate = true;
          if (im.instanceColor) im.instanceColor.needsUpdate = true;
        }
      }
    },
    get count() { return sets.length; },
  };
}
