import * as THREE from "three";

/**
 * Procedural wireframe of a long-hood tractor (Peterbilt 579 proportions) pulling a 53' dry van.
 * Units are feet. +X is the front of the truck, Y is up, Z is width. Built from edge lines only,
 * so it reads as a technical drawing (Terminal-style) and costs almost nothing to render.
 */

export type TruckMaterials = {
  line: THREE.LineBasicMaterial;
  lineBright: THREE.LineBasicMaterial;
  lineDim: THREE.LineBasicMaterial;
  points: THREE.PointsMaterial;
  pointsWarm: THREE.PointsMaterial;
};

export function createMaterials(clippingPlanes: THREE.Plane[] = []): TruckMaterials {
  const dot = makeDotTexture();
  return {
    line: new THREE.LineBasicMaterial({ color: 0xc7cdd6, transparent: true, opacity: 0.78, clippingPlanes }),
    lineBright: new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, clippingPlanes }),
    lineDim: new THREE.LineBasicMaterial({ color: 0x8792a6, transparent: true, opacity: 0.38, clippingPlanes }),
    points: new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, map: dot, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, clippingPlanes }),
    pointsWarm: new THREE.PointsMaterial({ color: 0xff7a3d, size: 1.4, map: dot, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, clippingPlanes }),
  };
}

function makeDotTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.25, "rgba(255,255,255,0.75)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const edges = (geo: THREE.BufferGeometry, mat: THREE.LineBasicMaterial, threshold = 20) => {
  const line = new THREE.LineSegments(new THREE.EdgesGeometry(geo, threshold), mat);
  geo.dispose();
  return line;
};

function box(len: number, h: number, w: number, x: number, y: number, z: number, mat: THREE.LineBasicMaterial) {
  const m = edges(new THREE.BoxGeometry(len, h, w), mat);
  m.position.set(x, y, z);
  return m;
}

/** Side profile (x,y) extruded across the width, centered on z = 0. */
function profile(points: [number, number][], width: number, mat: THREE.LineBasicMaterial, threshold = 20) {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false, curveSegments: 6 });
  geo.translate(0, 0, -width / 2);
  return edges(geo, mat, threshold);
}

function cylinderX(r: number, len: number, x: number, y: number, z: number, mat: THREE.LineBasicMaterial, seg = 18) {
  const geo = new THREE.CylinderGeometry(r, r, len, seg, 1, true);
  geo.rotateZ(Math.PI / 2);
  const m = edges(geo, mat, 1);
  m.position.set(x, y, z);
  return m;
}

/** A wheel: tire + rim circles. Returns a group that can spin around its Z axis. */
function wheel(r: number, width: number, mat: THREE.LineBasicMaterial, rimMat: THREE.LineBasicMaterial) {
  const g = new THREE.Group();
  const tire = new THREE.CylinderGeometry(r, r, width, 28, 1, true);
  tire.rotateX(Math.PI / 2);
  g.add(edges(tire, mat, 1));
  const rim = new THREE.CylinderGeometry(r * 0.58, r * 0.58, width * 1.02, 10, 1, true);
  rim.rotateX(Math.PI / 2);
  g.add(edges(rim, rimMat, 1));
  // spokes so rotation is visible
  const spokes = new THREE.BufferGeometry();
  const pts: number[] = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    for (const zz of [width / 2, -width / 2]) pts.push(0, 0, zz, Math.cos(a) * r * 0.58, Math.sin(a) * r * 0.58, zz);
  }
  spokes.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  g.add(new THREE.LineSegments(spokes, rimMat));
  return g;
}

export type Truck = { group: THREE.Group; wheels: THREE.Group[]; anchors: Record<"cab" | "trailer" | "wheels" | "tail", THREE.Vector3> };

export function buildTruck(m: TruckMaterials, opts: { detail?: boolean } = {}): Truck {
  const detail = opts.detail ?? true;
  const group = new THREE.Group();
  const wheels: THREE.Group[] = [];
  const R = 1.7; // tire radius (~41" tire)

  // ---------- Tractor ----------
  // Long hood
  group.add(profile([[0, 2.4], [0, 5.5], [-0.7, 5.95], [-7.4, 6.55], [-7.4, 2.4]], 4.9, m.lineBright));
  // Grille bars
  if (detail) for (let i = 0; i < 6; i++) group.add(box(0.05, 2.6, 0.04, 0.02, 3.95, -1.9 + i * 0.76, m.lineDim));
  // Cab + raised sleeper
  group.add(
    profile(
      [[-7.4, 3.2], [-7.4, 6.65], [-8.95, 10.1], [-10.7, 10.35], [-11.3, 12.7], [-18.4, 12.7], [-18.4, 3.2]],
      8.0,
      m.lineBright,
    ),
  );
  // Door + windows
  group.add(box(2.6, 4.6, 8.04, -9.6, 6.2, 0, m.lineDim));
  // Bumper
  group.add(box(0.9, 1.3, 8.4, 0.25, 2.0, 0, m.line));
  // Front fenders
  for (const z of [3.3, -3.3]) group.add(profile([[-0.6, 2.4], [-1.6, 4.4], [-5.2, 4.4], [-6.2, 2.4]], 1.6, m.line).translateZ(z));
  // Frame rails
  group.add(box(23, 0.8, 3.4, -11.2, 2.2, 0, m.lineDim));
  // Fuel tanks, steps, DEF
  group.add(cylinderX(1.15, 4.2, -12.6, 2.9, 3.4, m.line));
  group.add(cylinderX(1.15, 4.2, -12.6, 2.9, -3.4, m.line));
  // Stacks behind the sleeper
  if (detail)
    for (const z of [3.6, -3.6]) {
      const s = new THREE.CylinderGeometry(0.24, 0.24, 8.5, 6, 1, true);
      const st = edges(s, m.line, 1);
      st.position.set(-18.9, 10.3, z);
      group.add(st);
    }
  // Mirrors
  for (const z of [4.7, -4.7]) group.add(box(0.3, 1.6, 0.5, -8.4, 8.2, z, m.line));
  // Wheels: steer + tandem drives
  for (const x of [-3.4, -15.6, -19.9])
    for (const z of [3.3, -3.3]) {
      const w = wheel(R, x === -3.4 ? 1.0 : 1.9, m.line, m.lineDim);
      w.position.set(x, R, z);
      wheels.push(w);
      group.add(w);
    }

  // ---------- 53' dry van ----------
  const tFront = -15.2;
  const tLen = 53;
  const tRear = tFront - tLen;
  const floor = 4.3;
  const top = 13.5;
  const halfW = 4.25;
  group.add(box(tLen, top - floor, halfW * 2, tFront - tLen / 2, (top + floor) / 2, 0, m.line));
  // Side ribs / logistics posts every ~2.3 ft (the classic dry-van look)
  const ribs: number[] = [];
  for (let x = tFront - 2.3; x > tRear + 1; x -= 2.3)
    for (const z of [halfW, -halfW]) ribs.push(x, floor, z, x, top, z);
  // Rear doors
  ribs.push(tRear, floor, 0, tRear, top, 0);
  for (const y of [floor + 2.4, floor + 4.8, floor + 7.2]) ribs.push(tRear, y, -halfW, tRear, y, halfW);
  const ribGeo = new THREE.BufferGeometry();
  ribGeo.setAttribute("position", new THREE.Float32BufferAttribute(ribs, 3));
  group.add(new THREE.LineSegments(ribGeo, m.lineDim));
  // Side skirts
  group.add(box(26, 2.4, halfW * 2 - 0.2, tFront - 26, floor - 1.3, 0, m.lineDim));
  // Landing gear
  for (const z of [3, -3]) group.add(box(0.4, floor - 0.8, 0.4, tFront - 9, (floor + 0.8) / 2, z, m.line));
  // Trailer tandem (duals)
  for (const x of [tRear + 8.3, tRear + 4.2])
    for (const z of [3.2, -3.2]) {
      const w = wheel(R, 1.9, m.line, m.lineDim);
      w.position.set(x, R, z);
      wheels.push(w);
      group.add(w);
    }
  // Rear bumper (ICC bar)
  group.add(box(0.4, 0.5, halfW * 2 - 1, tRear + 0.6, 2.2, 0, m.line));

  // ---------- Lights ----------
  const white: number[] = [0.1, 4.6, 3.1, 0.1, 4.6, -3.1, -10.6, 10.5, 2.6, -10.6, 10.5, -2.6];
  const warm: number[] = [];
  for (let x = tFront - 1; x > tRear; x -= 10.5) for (const z of [halfW, -halfW]) warm.push(x, top - 0.2, z);
  for (let x = tFront - 6; x > tRear; x -= 13) for (const z of [halfW, -halfW]) warm.push(x, floor + 0.3, z);
  warm.push(tRear, 3.2, 3.6, tRear, 3.2, -3.6, -10.6, 12.8, 0, -10.6, 12.8, 2, -10.6, 12.8, -2);
  const wGeo = new THREE.BufferGeometry();
  wGeo.setAttribute("position", new THREE.Float32BufferAttribute(white, 3));
  group.add(new THREE.Points(wGeo, m.points));
  const aGeo = new THREE.BufferGeometry();
  aGeo.setAttribute("position", new THREE.Float32BufferAttribute(warm, 3));
  group.add(new THREE.Points(aGeo, m.pointsWarm));

  // Center the rig on the origin (overall length ≈ 68 ft)
  const shift = 34;
  group.children.forEach((c) => (c.position.x += shift));

  return {
    group,
    wheels,
    anchors: {
      cab: new THREE.Vector3(-11 + shift, 12.9, 0),
      trailer: new THREE.Vector3(tFront - tLen / 2 + shift, top + 0.2, 0),
      wheels: new THREE.Vector3(-17.8 + shift, R * 2 + 0.2, halfW),
      tail: new THREE.Vector3(tRear + shift, floor + 4, 0),
    },
  };
}

/** Road: lane lines + a ground grid that scroll toward -X to sell forward motion. */
export function buildRoad(m: TruckMaterials) {
  const group = new THREE.Group();
  const DASH = 10;
  const GAP = 30;
  const SPAN = 600;
  // Dashed center line (z = +6) and solid edge lines
  const dashes: number[] = [];
  for (let x = -SPAN / 2; x < SPAN / 2; x += DASH + GAP) dashes.push(x, 0.02, 6.5, x + DASH, 0.02, 6.5);
  const dashGeo = new THREE.BufferGeometry();
  dashGeo.setAttribute("position", new THREE.Float32BufferAttribute(dashes, 3));
  const dashLines = new THREE.LineSegments(dashGeo, m.lineBright);
  group.add(dashLines);
  const edgeGeo = new THREE.BufferGeometry();
  edgeGeo.setAttribute("position", new THREE.Float32BufferAttribute([-SPAN / 2, 0.02, -6.5, SPAN / 2, 0.02, -6.5, -SPAN / 2, 0.02, 19.5, SPAN / 2, 0.02, 19.5], 3));
  group.add(new THREE.LineSegments(edgeGeo, m.line));
  // Ground grid
  const grid: number[] = [];
  const STEP = 20;
  for (let x = -SPAN / 2; x <= SPAN / 2; x += STEP) grid.push(x, 0, -300, x, 0, 300);
  for (let z = -300; z <= 300; z += STEP) grid.push(-SPAN / 2, 0, z, SPAN / 2, 0, z);
  const gridGeo = new THREE.BufferGeometry();
  gridGeo.setAttribute("position", new THREE.Float32BufferAttribute(grid, 3));
  const gridLines = new THREE.LineSegments(gridGeo, m.lineDim);
  group.add(gridLines);
  return { group, period: DASH + GAP, gridStep: STEP, moving: [dashLines, gridLines] as THREE.Object3D[] };
}
