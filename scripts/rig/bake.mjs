import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, simplify, dedup, prune } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import * as THREE from 'three';
import fs from 'fs';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read('src/scene.gltf');
await MeshoptSimplifier.ready;
await doc.transform(dedup(), weld());
const root = doc.getRoot();
const scene = root.listScenes()[0];

// Collect world-space triangles per category.
const cat = (name) => {
  if (/tire/.test(name)) return 'tire';
  if (/glass_clear/.test(name)) return 'glass';
  if (/light_white|glass_orange|glass_red/.test(name)) return 'light';
  if (/tarpaulin|roof|fabric|mudflap/.test(name)) return 'tarp';
  return 'body';
};
const out = {}; // cat -> {pos:[], idx:[]}
const lights = [];
scene.traverse((node) => {
  const mesh = node.getMesh(); if (!mesh) return;
  const m = new THREE.Matrix4().fromArray(node.getWorldMatrix());
  for (const prim of mesh.listPrimitives()) {
    const mat = prim.getMaterial()?.getName() ?? 'none';
    const c = cat(mat);
    const pa = prim.getAttribute('POSITION'); const ia = prim.getIndices();
    const v = new THREE.Vector3();
    const base = (out[c] ??= { pos: [], idx: [] }).pos.length / 3;
    const tmp = [];
    for (let i = 0; i < pa.getCount(); i++) { const e = pa.getElement(i, []); v.set(e[0], e[1], e[2]).applyMatrix4(m); out[c].pos.push(v.x, v.y, v.z); tmp.push(v.clone()); }
    if (c === 'light') { const ctr = tmp.reduce((a, b) => a.add(b), new THREE.Vector3()).multiplyScalar(1 / tmp.length); lights.push([ctr.x, ctr.y, ctr.z, mat]); }
    if (ia) for (let i = 0; i < ia.getCount(); i++) out[c].idx.push(base + ia.getScalar(i));
    else for (let i = 0; i < pa.getCount(); i++) out[c].idx.push(base + i);
  }
});
const bb = new THREE.Box3();
for (const c in out) { const g = out[c]; for (let i = 0; i < g.pos.length; i += 3) bb.expandByPoint(new THREE.Vector3(g.pos[i], g.pos[i + 1], g.pos[i + 2])); console.log(c, 'verts', g.pos.length / 3, 'tris', g.idx.length / 3); }
console.log('world bounds', bb.min, bb.max);
fs.writeFileSync('cats.json', JSON.stringify({ bounds: [bb.min, bb.max], lights }));
// Save raw per-category arrays for the next step.
for (const c in out) { fs.writeFileSync(`raw-${c}.f32`, Buffer.from(new Float32Array(out[c].pos).buffer)); fs.writeFileSync(`raw-${c}.u32`, Buffer.from(new Uint32Array(out[c].idx).buffer)); }
