import fs from 'fs';
import * as THREE from 'three';
import { MeshoptSimplifier } from 'meshoptimizer';
await MeshoptSimplifier.ready;
const FT = 3.28084;
const load = (c) => ({ pos: new Float32Array(fs.readFileSync(`raw-${c}.f32`).buffer.slice(0)), idx: new Uint32Array(fs.readFileSync(`raw-${c}.u32`).buffer.slice(0)) });

// Keep tractor triangles only (drop the European curtain trailer; we draw our own 53' dry van).
function filterTractor({ pos, idx }) {
  const keep = [];
  for (let t = 0; t < idx.length; t += 3) {
    let cz = 0, cy = 0;
    for (let k = 0; k < 3; k++) { cz += pos[idx[t + k] * 3 + 2]; cy += pos[idx[t + k] * 3 + 1]; }
    cz /= 3; cy /= 3;
    if (cz > -3.42 || (cz > -7.35 && cy < 1.12)) keep.push(idx[t], idx[t + 1], idx[t + 2]);
  }
  return { pos, idx: new Uint32Array(keep) };
}
function compact({ pos, idx }) {
  const map = new Map(); const np = []; const ni = new Uint32Array(idx.length);
  for (let i = 0; i < idx.length; i++) { let v = map.get(idx[i]); if (v === undefined) { v = np.length / 3; map.set(idx[i], v); np.push(pos[idx[i] * 3], pos[idx[i] * 3 + 1], pos[idx[i] * 3 + 2]); } ni[i] = v; }
  return { pos: new Float32Array(np), idx: ni };
}
function simplifyTo(g, ratio, err) {
  const target = Math.floor((g.idx.length / 3) * ratio) * 3;
  const [res] = MeshoptSimplifier.simplify(g.idx, g.pos, 3, target, err, []);
  return compact({ pos: g.pos, idx: res });
}
function toGeo(g) { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(g.pos, 3)); geo.setIndex(new THREE.BufferAttribute(g.idx, 1)); return geo; }
function edges(g, angle) { return new THREE.EdgesGeometry(toGeo(g), angle).getAttribute('position').array; }

const body = compact(filterTractor(load('body')));
const tire = compact(filterTractor(load('tire')));
const glass = compact(filterTractor(load('glass')));
console.log('tractor body tris', body.idx.length / 3, 'tires', tire.idx.length / 3, 'glass', glass.idx.length / 3);

const bodyS = simplifyTo(body, 0.03, 0.012);
const tireS = simplifyTo(tire, 0.1, 0.03);
const glassS = simplifyTo(glass, 0.5, 0.002);
console.log('simplified body', bodyS.idx.length / 3, 'tire', tireS.idx.length / 3, 'glass', glassS.idx.length / 3);

const lines = { body: edges(bodyS, 38), tire: edges(tireS, 65), glass: edges(glassS, 25) };
for (const k in lines) console.log('lines', k, lines[k].length / 6);

// Silhouette mesh (solid, unlit dark) for the dusk shot.
const solid = simplifyTo(compact({ pos: body.pos, idx: body.idx }), 0.025, 0.02);
console.log('solid tris', solid.idx.length / 3);

// Wheel centers: cluster tire vertices by z (axles) and x side.
const axles = {};
for (let i = 0; i < tire.pos.length; i += 3) { const z = Math.round(tire.pos[i + 2] * 2) / 2; (axles[z] ??= []).push(tire.pos[i + 1]); }
console.log('axle z bins', Object.keys(axles).sort((a, b) => a - b).join(' '));

// Convert to scene space: feet, +X = front, Y up, Z = width.
const conv = (arr) => { const o = new Float32Array(arr.length); for (let i = 0; i < arr.length; i += 3) { o[i] = arr[i + 2] * FT; o[i + 1] = arr[i + 1] * FT; o[i + 2] = -arr[i] * FT; } return o; };
const parts = { body: conv(lines.body), tire: conv(lines.tire), glass: conv(lines.glass), solid: conv(solid.pos) };
// Quantize to int16 over a fixed box.
const B = 80; const q = (a) => { const o = new Int16Array(a.length); for (let i = 0; i < a.length; i++) o[i] = Math.round((a[i] / B) * 32767); return o; };
const chunks = []; const meta = { scale: B / 32767, parts: {} }; let off = 0;
for (const k of ['body', 'tire', 'glass', 'solid']) { const d = q(parts[k]); chunks.push(Buffer.from(d.buffer)); meta.parts[k] = { offset: off, count: d.length }; off += d.byteLength; }
const sIdx = solid.pos.length / 3 < 65536 ? new Uint16Array(solid.idx) : new Uint32Array(solid.idx);
meta.parts.solidIndex = { offset: off, count: sIdx.length, type: sIdx instanceof Uint16Array ? 'u16' : 'u32' };
chunks.push(Buffer.from(sIdx.buffer)); off += sIdx.byteLength;
// Light positions (tractor only)
const cats = JSON.parse(fs.readFileSync('cats.json'));
meta.lights = cats.lights.filter((l) => l[2] > -3.42).map(([x, y, z, m]) => [+(z * FT).toFixed(2), +(y * FT).toFixed(2), +(-x * FT).toFixed(2), /red/.test(m) ? 'red' : /orange/.test(m) ? 'amber' : 'white']);
fs.mkdirSync('out', { recursive: true });
fs.writeFileSync('out/rig.bin', Buffer.concat(chunks));
fs.writeFileSync('out/rig.json', JSON.stringify(meta));
console.log('bin bytes', off, 'lights', meta.lights.length);
