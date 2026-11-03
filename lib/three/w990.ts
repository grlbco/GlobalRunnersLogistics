import * as THREE from "three";
import meta from "./w990.json";

/**
 * Loads the derived Kenworth W990 tractor geometry (edge lines + low-poly silhouette) that
 * scripts/derive-rig produced from the licensed model. Only derived lines/silhouette ship —
 * never the original model. Units: feet, +X front, Y up, Z width. Nose at x ≈ 6.9 ft.
 */
export type RigGeometry = {
  body: THREE.BufferGeometry;
  tire: THREE.BufferGeometry;
  glass: THREE.BufferGeometry;
  solid: THREE.BufferGeometry;
  rearAxleTires: THREE.BufferGeometry;
  rearAxleX: number;
  noseX: number;
};

type Part = { offset: number; count: number; type?: string };

export async function loadRig(url = "/models/w990.bin"): Promise<RigGeometry> {
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

  const tireArr = read(p.tire);
  // Rear drive axle tires (both sides) → reused for the trailer tandem so every wheel matches.
  const rear: number[] = [];
  let minX = Infinity;
  let maxX = -Infinity;
  for (let i = 0; i < tireArr.length; i += 6) {
    const mx = (tireArr[i] + tireArr[i + 3]) / 2;
    if (mx < -17.2) {
      for (let k = 0; k < 6; k++) rear.push(tireArr[i + k]);
      minX = Math.min(minX, tireArr[i], tireArr[i + 3]);
      maxX = Math.max(maxX, tireArr[i], tireArr[i + 3]);
    }
  }

  const solid = new THREE.BufferGeometry();
  solid.setAttribute("position", new THREE.BufferAttribute(read(p.solid), 3));
  const ip = p.solidIndex;
  const bytes = ip.count * (ip.type === "u16" ? 2 : 4);
  const idxBuf = buf.slice(ip.offset, ip.offset + bytes); // copy: index data may not be 4-byte aligned
  solid.setIndex(new THREE.BufferAttribute(ip.type === "u16" ? new Uint16Array(idxBuf) : new Uint32Array(idxBuf), 1));
  solid.computeVertexNormals();

  return {
    body: lineGeo(read(p.body)),
    tire: lineGeo(tireArr),
    glass: lineGeo(read(p.glass)),
    solid,
    rearAxleTires: lineGeo(new Float32Array(rear)),
    rearAxleX: (minX + maxX) / 2,
    noseX: 6.86,
  };
}
