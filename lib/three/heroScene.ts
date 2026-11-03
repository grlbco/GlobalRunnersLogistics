import * as THREE from "three";
import { buildRoad } from "./truck";
import type { RigGeometry } from "./w990";

export type CamState = { x: number; y: number; z: number; lx: number; ly: number; lz: number };
export type HeroScene = ReturnType<typeof createHeroScene>;
export type Anchor = "cab" | "trailer" | "wheels";

/**
 * Home hero scene.
 *  1. Dusk: a solid, rim-lit Kenworth W990 + 53' dry van rolls down the road, headlights on.
 *  2. Scan: an orange scan plane sweeps nose→tail; behind it the rig becomes a technical wireframe.
 *  3. Yard: the camera rises over parked wireframe rigs (the fleet).
 * GSAP owns all timing: it tweens `cam`, `scan`, `drive.speed`, `fleetOpacity`, `solidOpacity`
 * and calls render() from its ticker.
 */
export function createHeroScene(canvas: HTMLCanvasElement, rig: RigGeometry, opts: { mobile: boolean; fleetCount: number }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)); // thin lines look identical; ~45% fewer pixels at 2x
  renderer.setClearColor(0x000000, 0);
  renderer.localClippingEnabled = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x141a29, 90, 520);
  const camera = new THREE.PerspectiveCamera(opts.mobile ? 46 : 32, 1, 0.5, 1400);

  // Dusk lighting: warm low sun behind/right of the rig, cool sky fill, faint front fill.
  scene.add(new THREE.HemisphereLight(0x3b4a6b, 0x0a0d14, 1.2));
  const sun = new THREE.DirectionalLight(0xffa25a, 5.5);
  sun.position.set(-60, 18, -90);
  scene.add(sun);
  const front = new THREE.DirectionalLight(0x9fb4d8, 0.6);
  front.position.set(80, 30, 60);
  scene.add(front);

  // ---------- Clipping for the scan ----------
  // The scan moves nose (+x) → tail (−x). Already scanned (wire): x >= scan. Not yet (solid): x <= scan.
  const solidPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);
  const wirePlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);

  const lm = (color: number, opacity: number, planes: THREE.Plane[] = []) =>
    new THREE.LineBasicMaterial({ color, transparent: true, opacity, clippingPlanes: planes, depthWrite: false });
  const mats = {
    solid: new THREE.MeshStandardMaterial({ color: 0x1b2333, roughness: 0.38, metalness: 0.7, clippingPlanes: [solidPlane], polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1, transparent: true }),
    rim: lm(0x8e99ad, 0.22, [solidPlane]),
    rimTire: lm(0x8e99ad, 0.1, [solidPlane]),
    wire: lm(0xd9dee6, 0.85, [wirePlane]),
    wireDim: lm(0x8792a6, 0.42, [wirePlane]),
    wireGlass: lm(0xffffff, 1, [wirePlane]),
    fleet: lm(0xb7c0cf, 0.0),
    fleetDim: lm(0x7c879b, 0.0),
    road: lm(0xc7cdd6, 0.7),
    roadDim: lm(0x7c879b, 0.28),
    roadBright: lm(0xffffff, 0.9),
  };

  // ---------- The rig ----------
  const SHIFT = 28.9; // centers the ~72 ft rig on the origin
  const rigGroup = new THREE.Group();
  rigGroup.position.x = SHIFT;
  scene.add(rigGroup);

  const tractorSolid = new THREE.Mesh(rig.solid, mats.solid);
  rigGroup.add(tractorSolid);
  rigGroup.add(new THREE.LineSegments(rig.body, mats.rim), new THREE.LineSegments(rig.tire, mats.rimTire));
  rigGroup.add(new THREE.LineSegments(rig.body, mats.wire), new THREE.LineSegments(rig.tire, mats.wireDim), new THREE.LineSegments(rig.glass, mats.wireGlass));

  // 53' dry van (US): 13'6" high, 8'6" wide, floor at ~4'2". Front 18.6 ft behind the W990 nose.
  const T = { front: rig.noseX - 18.6, len: 53, floor: 4.2, top: 13.5, halfW: 4.25 };
  const tRear = T.front - T.len;
  const vanBox = new THREE.BoxGeometry(T.len, T.top - T.floor, T.halfW * 2);
  vanBox.translate(T.front - T.len / 2, (T.top + T.floor) / 2, 0);
  rigGroup.add(new THREE.Mesh(vanBox, mats.solid));
  const vanEdges = new THREE.EdgesGeometry(vanBox);
  const ribs: number[] = [];
  for (let x = T.front - 2.3; x > tRear + 1; x -= 2.3) for (const z of [T.halfW, -T.halfW]) ribs.push(x, T.floor, z, x, T.top, z);
  ribs.push(tRear, T.floor, 0, tRear, T.top, 0);
  for (const y of [T.floor + 3, T.floor + 6.2]) ribs.push(tRear, y, -T.halfW, tRear, y, T.halfW);
  // underframe + skirts
  ribs.push(T.front, T.floor, T.halfW - 0.4, tRear, T.floor, T.halfW - 0.4, T.front, T.floor, -T.halfW + 0.4, tRear, T.floor, -T.halfW + 0.4);
  ribs.push(T.front - 12, T.floor - 2.2, T.halfW, tRear + 14, T.floor - 2.2, T.halfW, T.front - 12, T.floor - 2.2, -T.halfW, tRear + 14, T.floor - 2.2, -T.halfW);
  for (const z of [3, -3]) ribs.push(T.front - 8, 0.6, z, T.front - 8, T.floor, z);
  const ribGeo = new THREE.BufferGeometry();
  ribGeo.setAttribute("position", new THREE.Float32BufferAttribute(ribs, 3));
  rigGroup.add(new THREE.LineSegments(vanEdges, mats.rim), new THREE.LineSegments(vanEdges, mats.wire));
  rigGroup.add(new THREE.LineSegments(ribGeo, mats.wireDim));
  // Trailer tandem = copies of the W990's rear drive tires, so every wheel matches.
  for (const ax of [tRear + 5.6, tRear + 9.7]) {
    for (const m of [mats.rimTire, mats.wireDim]) {
      const tire = new THREE.LineSegments(rig.rearAxleTires, m);
      tire.position.x = ax - rig.rearAxleX;
      rigGroup.add(tire);
    }
  }

  // Lights: headlights, cab marker lamps, trailer clearance + tail lamps.
  const dot = makeDot();
  const pts = (arr: number[], color: number, size: number) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(arr, 3));
    return new THREE.Points(g, new THREE.PointsMaterial({ color, size, map: dot, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  };
  rigGroup.add(pts([6.55, 3.6, 3.35, 6.55, 3.6, -3.35], 0xfff3dc, 3.4));
  const amber: number[] = [];
  for (let x = T.front - 1; x > tRear; x -= 10.6) for (const z of [T.halfW, -T.halfW]) amber.push(x, T.top - 0.2, z);
  for (const z of [-1.6, -0.8, 0, 0.8, 1.6]) amber.push(-5.6, 10.55, z);
  rigGroup.add(pts(amber, 0xff8a3d, 1.3));
  rigGroup.add(pts([tRear, 3.4, 3.4, tRear, 3.4, -3.4, tRear, T.top - 0.4, 2.8, tRear, T.top - 0.4, -2.8], 0xff2a1a, 1.6));

  // Headlight beams on the road (soft additive cones)
  const beamGeo = new THREE.PlaneGeometry(70, 26);
  beamGeo.rotateX(-Math.PI / 2);
  beamGeo.translate(rig.noseX + 35, 0.05, 0);
  const beam = new THREE.Mesh(
    beamGeo,
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uOpacity: { value: 0.55 } },
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader:
        "varying vec2 vUv; uniform float uOpacity; void main(){ float along = vUv.x; float across = abs(vUv.y - 0.5) * 2.0; float spread = mix(0.12, 0.95, along); float a = smoothstep(spread, 0.0, across) * (1.0 - along) * smoothstep(0.0, 0.08, along); gl_FragColor = vec4(1.0, 0.9, 0.72, a * uOpacity); }",
    }),
  );
  rigGroup.add(beam);

  // ---------- Scan plane ----------
  const scanGeo = new THREE.PlaneGeometry(14, 22);
  scanGeo.rotateY(Math.PI / 2);
  const scanMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { uOpacity: { value: 0 } },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader:
      "varying vec2 vUv; uniform float uOpacity; void main(){ float edge = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.6, vUv.y); float side = smoothstep(0.0, 0.15, vUv.x) * smoothstep(1.0, 0.85, vUv.x); float grid = step(0.94, fract(vUv.y * 22.0)) * 0.35; vec3 c = vec3(0.91, 0.25, 0.11); gl_FragColor = vec4(c, (0.22 + grid) * edge * side * uOpacity); }",
  });
  const scanSheet = new THREE.Mesh(scanGeo, scanMat);
  scanSheet.position.y = 9;
  const scanLineGeo = new THREE.BufferGeometry();
  scanLineGeo.setAttribute("position", new THREE.Float32BufferAttribute([0, 0.05, -7, 0, 0.05, 7, 0, 0.05, 7, 0, 18, 7, 0, 18, 7, 0, 18, -7, 0, 18, -7, 0, 0.05, -7], 3));
  const scanLineMat = new THREE.LineBasicMaterial({ color: 0xff5a2e, transparent: true, opacity: 0 });
  const scanFrame = new THREE.LineSegments(scanLineGeo, scanLineMat);
  const scanGroup = new THREE.Group();
  scanGroup.add(scanSheet, scanFrame);
  scene.add(scanGroup);

  // ---------- Road ----------
  const road = buildRoad({ line: mats.road, lineDim: mats.roadDim, lineBright: mats.roadBright } as never);
  scene.add(road.group);

  // ---------- Fleet in the yard ----------
  const fleet = new THREE.Group();
  // Parked rigs are small and far away: draw every 3rd body segment / every 4th tire segment.
  const thin = (g: THREE.BufferGeometry, every: number) => {
    const src = g.getAttribute("position").array as Float32Array;
    const out: number[] = [];
    for (let i = 0, seg = 0; i < src.length; i += 6, seg++) if (seg % every === 0) for (let k = 0; k < 6; k++) out.push(src[i + k]);
    const ng = new THREE.BufferGeometry();
    ng.setAttribute("position", new THREE.Float32BufferAttribute(out, 3));
    return ng;
  };
  const fleetBody = thin(rig.body, 3);
  const fleetTire = thin(rig.tire, 4);
  const template = new THREE.Group();
  template.add(new THREE.LineSegments(fleetBody, mats.fleet), new THREE.LineSegments(fleetTire, mats.fleetDim));
  template.add(new THREE.LineSegments(vanEdges, mats.fleet), new THREE.LineSegments(ribGeo, mats.fleetDim));
  const perRow = opts.mobile ? 3 : 5;
  for (let i = 0; i < opts.fleetCount; i++) {
    const row = Math.floor(i / perRow);
    const col = i % perRow;
    const t = template.clone();
    t.position.set(SHIFT + col * 86 - ((perRow - 1) * 86) / 2 - 24, 0, -36 - row * 24);
    fleet.add(t);
  }
  fleet.visible = false;
  scene.add(fleet);

  // ---------- State driven by GSAP ----------
  const cam: CamState = { x: 64, y: 7, z: 30, lx: 10, ly: 7, lz: 0 };
  const parallax = { x: 0, y: 0 };
  const drive = { speed: 1, offset: 0, bob: 0 };
  const scan = { x: 12, glow: 0 }; // rig-local feet: 12 = ahead of the nose (nothing scanned), -70 = past the tail
  const fleetOpacity = { value: 0 };
  const intro = { value: 0 }; // 0 → 1 fade-in on load
  const lookAt = new THREE.Vector3();

  const resize = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();

  let last = performance.now();
  let t = 0;
  const render = () => {
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt;

    const ftPerSec = 80 * drive.speed;
    drive.offset = (drive.offset + ftPerSec * dt) % road.period;
    road.moving.forEach((o) => (o.position.x = -drive.offset));
    // Subtle chassis float at speed
    rigGroup.position.y = Math.sin(t * 7.3) * 0.035 * drive.speed;

    // Scan planes live in world space; rig is offset by SHIFT.
    const sx = scan.x + SHIFT;
    solidPlane.constant = sx;
    wirePlane.constant = -sx;
    scanGroup.position.x = sx;
    scanMat.uniforms.uOpacity.value = scan.glow;
    scanLineMat.opacity = scan.glow * 0.9;

    mats.solid.opacity = intro.value;
    mats.rim.opacity = 0.22 * intro.value;
    (beam.material as THREE.ShaderMaterial).uniforms.uOpacity.value = 0.55 * intro.value * Math.max(0.2, drive.speed);
    mats.fleet.opacity = 0.5 * fleetOpacity.value;
    mats.fleetDim.opacity = 0.22 * fleetOpacity.value;
    fleet.visible = fleetOpacity.value > 0.001;

    camera.position.set(cam.x + parallax.x, cam.y + parallax.y, cam.z);
    lookAt.set(cam.lx, cam.ly, cam.lz);
    camera.lookAt(lookAt);
    renderer.render(scene, camera);
  };

  const anchors: Record<Anchor, THREE.Vector3> = {
    cab: new THREE.Vector3(-4 + SHIFT, 11.4, 0),
    trailer: new THREE.Vector3(T.front - T.len / 2 + SHIFT, T.top + 0.2, 0),
    wheels: new THREE.Vector3(-17.5 + SHIFT, 3.6, 4.4),
  };
  const tmp = new THREE.Vector3();
  const project = (key: Anchor) => {
    tmp.copy(anchors[key]).project(camera);
    return { x: (tmp.x * 0.5 + 0.5) * canvas.clientWidth, y: (-tmp.y * 0.5 + 0.5) * canvas.clientHeight };
  };

  const dispose = () => {
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry && mesh.geometry !== rig.solid) mesh.geometry.dispose();
    });
    Object.values(mats).forEach((m) => m.dispose());
    scanMat.dispose();
    scanLineMat.dispose();
    dot.dispose();
    renderer.dispose();
  };

  return { cam, parallax, drive, scan, fleetOpacity, intro, render, resize, project, dispose };
}

function makeDot() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.2, "rgba(255,255,255,0.8)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
