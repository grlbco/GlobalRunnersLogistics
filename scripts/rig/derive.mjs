import fs from 'fs';
import * as THREE from 'three';
import { MeshoptSimplifier } from 'meshoptimizer';
await MeshoptSimplifier.ready;
const FT = 3.28084;
const rd = (f) => { const b = fs.readFileSync(f); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
const load = (n) => ({ pos: new Float32Array(rd(`mat/${n}.f32`)), idx: new Uint32Array(rd(`mat/${n}.u32`)) });
const merge = (names) => { const pos = []; const idx = []; for (const n of names) { const g = load(n); const base = pos.length / 3; for (const v of g.pos) pos.push(v); for (const i of g.idx) idx.push(base + i); } return compact({ pos: new Float32Array(pos), idx: new Uint32Array(idx) }); };
function compact({ pos, idx }) { const map = new Map(); const np = []; const ni = new Uint32Array(idx.length); for (let i = 0; i < idx.length; i++) { let v = map.get(idx[i]); if (v === undefined) { v = np.length / 3; map.set(idx[i], v); np.push(pos[idx[i] * 3], pos[idx[i] * 3 + 1], pos[idx[i] * 3 + 2]); } ni[i] = v; } return { pos: new Float32Array(np), idx: ni }; }
function simplifyTo(g, tris, err = 0.05) { const target = Math.min(g.idx.length, tris * 3); const [res] = MeshoptSimplifier.simplify(g.idx, g.pos, 3, Math.floor(target / 3) * 3, err, []); return compact({ pos: g.pos, idx: res }); }
function sloppy(g, tris) { const [res] = MeshoptSimplifier.simplify(g.idx, g.pos, 3, Math.floor(Math.min(g.idx.length, tris * 3) / 3) * 3, 1.0, ['LockBorder'].slice(0, 0)); let r = compact({ pos: g.pos, idx: res }); if (r.idx.length / 3 > tris * 1.3) { const [s2] = MeshoptSimplifier.simplifySloppy(g.idx, g.pos, 3, null, Math.floor(tris) * 3, 0.01); r = compact({ pos: g.pos, idx: s2 }); } return r; }
const toGeo = (g) => { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(g.pos, 3)); geo.setIndex(new THREE.BufferAttribute(g.idx, 1)); return geo; };
const edges = (g, a) => new THREE.EdgesGeometry(toGeo(g), a).getAttribute('position').array;
const conv = (arr) => { const o = new Float32Array(arr.length); for (let i = 0; i < arr.length; i += 3) { o[i] = arr[i + 2] * FT; o[i + 1] = arr[i + 1] * FT; o[i + 2] = -arr[i] * FT; } return o; };

const groups = {
  paint: [['carpaint-black_piano', 'material', 'blue', 'roof'], 14000],
  chrome: [['chrome', 'chrome_bumpB', 'texReflect'], 14000],
  dark: [['plastic_rough_black', 'plastic_shiny_black', 'metal_black', 'chromedark', 'metal_rough_plus'], 14000],
  glass: [['glass_clear'], 2500],
  tire: [['tire'], 9000],
  lamp: [['light_white', 'glass_orange', 'glass_orange_bumpA', 'glass_red'], 1500],
};
const full = {}; const solids = {};
for (const k in groups) { full[k] = merge(groups[k][0]); solids[k] = simplifyTo(full[k], groups[k][1], 0.02); if (solids[k].idx.length / 3 > groups[k][1] * 1.3) solids[k] = sloppy(full[k], groups[k][1]); console.log(k, full[k].idx.length / 3, '->', solids[k].idx.length / 3); }

// Lines: body (paint+chrome+dark), tire, glass
const bodyFull = merge([...groups.paint[0], ...groups.chrome[0], ...groups.dark[0]]);
const lines = { body: edges(simplifyTo(bodyFull, 26000, 0.012), 38), tire: edges(simplifyTo(full.tire, 7000, 0.03), 65), glass: edges(simplifyTo(full.glass, 3600, 0.002), 25) };
for (const k in lines) console.log('lines', k, lines[k].length / 6);

// Axle centers (scene feet) from tire vertices
const tp = conv(full.tire.pos); const ax = { steer: [], d1: [], d2: [] };
for (let i = 0; i < tp.length; i += 3) { const x = tp[i]; (x > -5 ? ax.steer : x > -15.75 ? ax.d1 : ax.d2).push([x, tp[i + 1]]); }
const ctr = (a) => { const xs = a.map((p) => p[0]); const ys = a.map((p) => p[1]); return [+((Math.min(...xs) + Math.max(...xs)) / 2).toFixed(3), +((Math.min(...ys) + Math.max(...ys)) / 2).toFixed(3), +((Math.max(...ys) - Math.min(...ys)) / 2).toFixed(3)]; };
const axles = { steer: ctr(ax.steer), d1: ctr(ax.d1), d2: ctr(ax.d2) };
console.log('axles', axles);

const B = 80; const q = (a) => { const o = new Int16Array(a.length); for (let i = 0; i < a.length; i++) o[i] = Math.round((a[i] / B) * 32767); return o; };
const chunks = []; const meta = { scale: B / 32767, axles, parts: {} }; let off = 0;
const push = (k, typed, extra = {}) => { const b = Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength); const pad = (4 - (b.length % 4)) % 4; chunks.push(b, Buffer.alloc(pad)); meta.parts[k] = { offset: off, count: typed.length, ...extra }; off += b.length + pad; };
for (const k of ['body', 'tire', 'glass']) push(k, q(conv(lines[k])));
for (const k in solids) { push(`s_${k}`, q(conv(solids[k].pos))); const n = solids[k].pos.length / 3; push(`s_${k}_i`, n < 65536 ? new Uint16Array(solids[k].idx) : new Uint32Array(solids[k].idx), { type: n < 65536 ? 'u16' : 'u32' }); }
fs.writeFileSync('out/w990.bin', Buffer.concat(chunks)); fs.writeFileSync('out/w990.json', JSON.stringify(meta));
console.log('bytes', off);
