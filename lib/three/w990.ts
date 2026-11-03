import * as THREE from "three";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import meta from "./w990.json";

/**
 * Loads the derived Kenworth W990 tractor geometry that scripts/rig produced from the licensed model.
 * Only simplified edge lines + low-poly per-material surfaces ship — never the original model.
 * Units: feet, +X front, Y up, Z width. Nose at x ≈ 6.9 ft.
 */
export type SolidPart = "paint" | "chrome" | "dark" | "glass" | "tire" | "lamp";
export type RigGeometry = {
  body: THREE.BufferGeometry;
  tire: THREE.BufferGeometry;
  glass: THREE.BufferGeometry;
  solids: Record<SolidPart, THREE.BufferGeometry>;
  /** Rear drive axle (both duals) — reused for the trailer tandem so every wheel matches. */
  rearTireLines: THREE.BufferGeometry;
  rearTireSolid: THREE.BufferGeometry;
  axles: { steer: number; d1: number; d2: number; radius: number };
  noseX: number;
};

type Part = { offset: number; count: number; type?: string };

export async function loadRig(url = "/models/w990.bin?v=2"): Promise<RigGeometry> {
  const buf = await (await fetch(url)).arrayBuffer();
  const p = meta.parts as Record<string, Part>;
  const s = meta.scale;
  const read = (part: Part) => {
    const q = new Int16Array(buf, part.offset, part.count);
    const f = new Float32Array(part.count);
    for (let i = 0; i < q.length; i++) f[i] = q[i] * s;
    return f;
  };
  const lineGeo = (arr: Float32Array) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    g.computeBoundingSphere();
    return g;
  };
  const indexed = (k: string) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(read(p[`s_${k}`]), 3));
    const ip = p[`s_${k}_i`];
    g.setIndex(new THREE.BufferAttribute(ip.type === "u16" ? new Uint16Array(buf, ip.offset, ip.count) : new Uint32Array(buf, ip.offset, ip.count), 1));
    return g;
  };
  const ax = meta.axles as Record<"steer" | "d1" | "d2", number[]>;
  const split = (ax.d1[0] + ax.d2[0]) / 2;

  // Rear-axle tire lines: keep whole segments whose both ends are behind the split (no half-tires).
  const tireArr = read(p.tire);
  const rear: number[] = [];
  for (let i = 0; i < tireArr.length; i += 6) if (tireArr[i] < split && tireArr[i + 3] < split) for (let k = 0; k < 6; k++) rear.push(tireArr[i + k]);

  const solids = {} as Record<SolidPart, THREE.BufferGeometry>;
  for (const k of ["paint", "chrome", "dark", "glass", "tire", "lamp"] as SolidPart[]) {
    const g = indexed(k);
    solids[k] = k === "lamp" ? (g.computeVertexNormals(), g) : toCreasedNormals(g, k === "paint" ? Math.PI / 5 : Math.PI / 4);
  }

  // Rear tire solid: triangles fully behind the split.
  const tp = solids.tire.getAttribute("position").array as Float32Array;
  const tn = solids.tire.getAttribute("normal").array as Float32Array;
  const rp: number[] = [];
  const rn: number[] = [];
  for (let t = 0; t < tp.length; t += 9) {
    if (tp[t] < split && tp[t + 3] < split && tp[t + 6] < split) for (let k = 0; k < 9; k++) (rp.push(tp[t + k]), rn.push(tn[t + k]));
  }
  const rearTireSolid = new THREE.BufferGeometry();
  rearTireSolid.setAttribute("position", new THREE.Float32BufferAttribute(rp, 3));
  rearTireSolid.setAttribute("normal", new THREE.Float32BufferAttribute(rn, 3));

  return {
    body: lineGeo(read(p.body)),
    tire: lineGeo(tireArr),
    glass: lineGeo(read(p.glass)),
    solids,
    rearTireLines: lineGeo(new Float32Array(rear)),
    rearTireSolid,
    axles: { steer: ax.steer[0], d1: ax.d1[0], d2: ax.d2[0], radius: ax.d2[2] },
    noseX: 6.86,
  };
}
