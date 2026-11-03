import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, dedup } from '@gltf-transform/functions';
import * as THREE from 'three';
import fs from 'fs';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read('src/scene.gltf');
await doc.transform(dedup(), weld());
const scene = doc.getRoot().listScenes()[0];
const out = {};
scene.traverse((node) => {
  const mesh = node.getMesh(); if (!mesh) return;
  const m = new THREE.Matrix4().fromArray(node.getWorldMatrix());
  for (const prim of mesh.listPrimitives()) {
    const c = prim.getMaterial()?.getName() ?? 'none';
    const pa = prim.getAttribute('POSITION'); const ia = prim.getIndices();
    const g = (out[c] ??= { pos: [], idx: [] }); const base = g.pos.length / 3; const v = new THREE.Vector3();
    for (let i = 0; i < pa.getCount(); i++) { const e = pa.getElement(i, []); v.set(e[0], e[1], e[2]).applyMatrix4(m); g.pos.push(v.x, v.y, v.z); }
    if (ia) for (let i = 0; i < ia.getCount(); i++) g.idx.push(base + ia.getScalar(i)); else for (let i = 0; i < pa.getCount(); i++) g.idx.push(base + i);
  }
});
fs.mkdirSync('mat', { recursive: true });
for (const c in out) {
  const g = out[c]; let kept = 0;
  const keep = [];
  for (let t = 0; t < g.idx.length; t += 3) { let cz = 0, cy = 0; for (let k = 0; k < 3; k++) { cz += g.pos[g.idx[t + k] * 3 + 2]; cy += g.pos[g.idx[t + k] * 3 + 1]; } cz /= 3; cy /= 3; if (cz > -3.42 || (cz > -7.35 && cy < 1.12)) keep.push(g.idx[t], g.idx[t + 1], g.idx[t + 2]); }
  kept = keep.length / 3;
  console.log(c.padEnd(24), 'tractor tris', kept);
  fs.writeFileSync(`mat/${c}.f32`, Buffer.from(new Float32Array(g.pos).buffer)); fs.writeFileSync(`mat/${c}.u32`, Buffer.from(new Uint32Array(keep).buffer));
}
