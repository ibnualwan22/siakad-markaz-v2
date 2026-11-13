import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import {
  EXPLORE_RADIUS, movePlayer, movementVector, nearestRoad, toLocal,
  type ExploreArea, type PointXZ,
} from "@/lib/markaz-explore";

import { EMPTY_SCENE, hiddenBuildings, sceneObstacles, sceneSpawn, type SceneAsset, type SceneDocument } from "@/lib/denah-scene";
import { createObjectLayer } from "./denah-objects";

export interface ExploreLocation {
  id: string; nama: string; latitude: number; longitude: number; sakan?: string | null;
}
export interface ExploreStatus extends PointXZ {
  heading: number; yaw: number; road: string; atEdge: boolean;
  nearby: { id: string; name: string; distance: number } | null;
}
export interface ExploreController {
  motion: (right: number, forward: number) => void;
  run: (value: boolean) => void;
  pause: (value: boolean) => void;
  reset: () => void;
  locations: (items: ExploreLocation[]) => void;
  dispose: () => void;
}

function disposeTree(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) geometries.add(mesh.geometry);
    if (mesh.material) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      materials.add(material);
      const map = (material as THREE.MeshBasicMaterial).map;
      if (map) textures.add(map);
    }
  });
  textures.forEach(texture => texture.dispose());
  materials.forEach(material => material.dispose());
  geometries.forEach(geometry => geometry.dispose());
}

function addMerged(scene: THREE.Object3D, parts: THREE.BufferGeometry[], material: THREE.Material) {
  if (!parts.length) { material.dispose(); return null; }
  const geometry = mergeGeometries(parts, false)!;
  parts.forEach(part => part.dispose());
  geometry.computeBoundingSphere();
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);
  return mesh;
}

function label(text: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 512; canvas.height = 96;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#103f38";
  context.beginPath(); context.roundRect(4, 4, 504, 88, 24); context.fill();
  context.fillStyle = "#ffffff"; context.font = "600 28px system-ui";
  context.textAlign = "center"; context.textBaseline = "middle";
  context.fillText(text, 256, 48, 460);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: true }));
  sprite.scale.set(7, 1.3, 1);
  return sprite;
}

function createCharacter() {
  const avatar = new THREE.Group();
  const green = new THREE.MeshStandardMaterial({ color: 0x236953, roughness: 0.9 });
  const cream = new THREE.MeshStandardMaterial({ color: 0xe9dfc9, roughness: 1 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xc89165, roughness: 1 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x283d35, roughness: 1 });
  const ochre = new THREE.MeshStandardMaterial({ color: 0xc09147, roughness: 1 });
  function box(w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material, parent = avatar) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  }
  const body = new THREE.Group(); avatar.add(body);
  box(0.56, 0.67, 0.34, 0, 1.03, 0, green, body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.225, 12, 10), skin);
  head.scale.set(0.88, 1.05, 0.9); head.position.y = 1.6; body.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.14, 12), cream);
  cap.position.set(0, 1.8, 0); body.add(cap);
  box(0.38, 0.43, 0.18, 0, 1.1, -0.23, ochre, body);
  for (const x of [-0.16, 0.16]) box(0.045, 0.61, 0.37, x, 1.05, 0, ochre, body);
  const limbs: THREE.Group[] = [];
  for (const x of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(x * 0.37, 1.28, 0); body.add(arm);
    box(0.16, 0.4, 0.18, 0, -0.18, 0, green, arm);
    box(0.14, 0.16, 0.15, 0, -0.45, 0, skin, arm);
    const leg = new THREE.Group(); leg.position.set(x * 0.15, 0.73, 0); body.add(leg);
    box(0.22, 0.57, 0.25, 0, -0.26, 0, cream, leg);
    box(0.24, 0.13, 0.37, 0, -0.65, 0.055, dark, leg);
    limbs.push(arm, leg);
  }
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.5, 24), new THREE.MeshBasicMaterial({ color: 0x152c26, transparent: true, opacity: 0.2, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.08; avatar.add(shadow);
  return { avatar, animate: (phase: number, moving: boolean) => {
    const gait = moving ? Math.sin(phase) * 0.5 : 0;
    limbs[0].rotation.x = -gait; limbs[1].rotation.x = gait;
    limbs[2].rotation.x = gait; limbs[3].rotation.x = -gait;
    body.position.y = moving ? Math.abs(Math.sin(phase)) * 0.045 : 0;
  } };
}

/** No location API, per-frame React updates, remote textures, or continuous hidden-tab rendering. */
export function createExploreScene(
  host: HTMLDivElement,
  area: ExploreArea,
  onStatus: (status: ExploreStatus) => void,
  onError: () => void,
  layout: SceneDocument = EMPTY_SCENE,
  assets: SceneAsset[] = [],
  onAssetError: (name: string) => void = () => {},
): ExploreController {
  const obstacles = sceneObstacles(area, layout);
  const spawn = sceneSpawn(area, layout);
  const hidden = hiddenBuildings(layout);
  if (!spawn) throw new Error("Titik awal jalan tidak tersedia.");
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "low-power" });
  const scene = new THREE.Scene();
  const sky = 0xdbe8e3;
  scene.background = new THREE.Color(sky); scene.fog = new THREE.Fog(sky, 80, 245);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.25;
  const canvas = renderer.domElement;
  canvas.tabIndex = 0; canvas.setAttribute("aria-label", "Jelajah Markaz 3D. WASD atau panah untuk berjalan, Shift untuk berlari, R kembali ke awal. Geser untuk memutar kamera.");
  canvas.style.cssText = "display:block;width:100%;height:100%;touch-action:none;outline-offset:-4px";
  host.appendChild(canvas);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 650);
  const collisionMeshes: THREE.Object3D[] = [];
  const markers = new THREE.Group();
  const custom = createObjectLayer(() => {}, onAssetError);
  let pois: (ExploreLocation & PointXZ & { marker: THREE.Group })[] = [];
  let disposed = false, failed = false, paused = false, running = false;
  let position = { ...spawn.point }, heading = spawn.heading, yaw = spawn.heading + Math.PI;
  let pitch = 0.39, distance = 7.5, motion = { x: 0, z: 0 }, gait = 0;
  let frame = 0, lastFrame = 0, lastStatus = 0;
  let drag: { id: number; x: number; y: number } | null = null;
  const keys = new Set<string>();
  const raycaster = new THREE.Raycaster();
  const target = new THREE.Vector3(), desired = new THREE.Vector3(), direction = new THREE.Vector3();
  const cameraTarget = new THREE.Vector3(position.x, 1.3, position.z);
  let snapCamera = true;

  // Install the cleanup path before building so failures also release partial GPU resources.
  const cleanup = () => {
    if (disposed) return;
    disposed = true; cancelAnimationFrame(frame); observer.disconnect();
    window.removeEventListener("keydown", keyDown); window.removeEventListener("keyup", keyUp);
    window.removeEventListener("blur", clearInput); document.removeEventListener("visibilitychange", visibility);
    canvas.removeEventListener("pointerdown", pointerDown); canvas.removeEventListener("pointermove", pointerMove);
    canvas.removeEventListener("pointerup", pointerEnd); canvas.removeEventListener("pointercancel", pointerEnd);
    canvas.removeEventListener("lostpointercapture", pointerEnd); canvas.removeEventListener("wheel", wheel);
    canvas.removeEventListener("webglcontextlost", contextLost);
    scene.remove(custom.group); custom.dispose();
    disposeTree(scene); renderer.dispose(); renderer.forceContextLoss(); canvas.remove();
  };
  function clearInput() { keys.clear(); motion = { x: 0, z: 0 }; drag = null; }
  function editable(event: KeyboardEvent) {
    const el = event.target as HTMLElement | null;
    return el?.isContentEditable || Boolean(el?.closest("input,textarea,select,[role=dialog]"));
  }
  const moveKeys = ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "ShiftLeft", "ShiftRight"];
  function keyDown(e: KeyboardEvent) {
    if (paused || editable(e) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (moveKeys.includes(e.code)) { e.preventDefault(); keys.add(e.code); }
    if (e.code === "KeyR" && !e.repeat) reset();
  }
  function keyUp(e: KeyboardEvent) { keys.delete(e.code); }
  function pointerDown(e: PointerEvent) {
    if (paused || drag || (e.pointerType === "mouse" && e.button !== 0)) return;
    canvas.focus({ preventScroll: true });
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId);
  }
  function pointerMove(e: PointerEvent) {
    if (!drag || drag.id !== e.pointerId) return;
    yaw -= (e.clientX - drag.x) * 0.006;
    pitch = THREE.MathUtils.clamp(pitch + (e.clientY - drag.y) * 0.004, 0.15, 0.9);
    drag.x = e.clientX; drag.y = e.clientY;
  }
  function pointerEnd(e: PointerEvent) { if (drag?.id === e.pointerId) drag = null; }
  function wheel(e: WheelEvent) {
    if (paused) return;
    e.preventDefault(); distance = THREE.MathUtils.clamp(distance + e.deltaY * 0.01, 4, 13);
  }
  function contextLost(e: Event) { e.preventDefault(); failed = true; clearInput(); cancelAnimationFrame(frame); onError(); }
  function visibility() {
    clearInput(); cancelAnimationFrame(frame); lastFrame = 0;
    if (!document.hidden && !disposed && !failed) frame = requestAnimationFrame(tick);
  }
  function reset() {
    clearInput(); position = { ...spawn!.point }; heading = spawn!.heading; yaw = heading + Math.PI;
    pitch = 0.39; distance = 7.5; snapCamera = true; lastStatus = 0;
  }
  function resize() {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
  }
  const observer = new ResizeObserver(resize);
  let character: ReturnType<typeof createCharacter>;

  function tick(now: number) {
    if (disposed || failed || document.hidden) return;
    frame = requestAnimationFrame(tick);
    if (lastFrame && now - lastFrame < 32) return;
    const dt = Math.min(0.05, lastFrame ? (now - lastFrame) / 1000 : 1 / 30); lastFrame = now;
    let moved = 0;
    if (!paused) {
      const right = motion.x + Number(keys.has("KeyD") || keys.has("ArrowRight")) - Number(keys.has("KeyA") || keys.has("ArrowLeft"));
      const forward = motion.z + Number(keys.has("KeyW") || keys.has("ArrowUp")) - Number(keys.has("KeyS") || keys.has("ArrowDown"));
      const v = movementVector(right, forward, yaw);
      const speed = running || keys.has("ShiftLeft") || keys.has("ShiftRight") ? 6 : 3.4;
      const next = movePlayer(position, { x: v.x * speed * dt, z: v.z * speed * dt }, obstacles);
      moved = Math.hypot(next.x - position.x, next.z - position.z);
      if (moved > 0.001) {
        const angle = Math.atan2(next.x - position.x, next.z - position.z);
        heading += Math.atan2(Math.sin(angle - heading), Math.cos(angle - heading)) * (1 - Math.exp(-14 * dt));
      }
      position = next; gait += moved * 4.5;
    }
    character.avatar.position.set(position.x, 0, position.z); character.avatar.rotation.y = heading;
    character.animate(gait, moved > 0.001);
    target.set(position.x, 1.3, position.z);
    cameraTarget.lerp(target, snapCamera ? 1 : 1 - Math.exp(-12 * dt));
    desired.set(Math.sin(yaw) * Math.cos(pitch) * distance, Math.sin(pitch) * distance + 0.5, Math.cos(yaw) * Math.cos(pitch) * distance).add(cameraTarget);
    direction.copy(desired).sub(cameraTarget);
    const cameraDistance = direction.length();
    raycaster.set(cameraTarget, direction.normalize()); raycaster.far = cameraDistance;
    const hit = raycaster.intersectObjects(collisionMeshes, true)[0];
    if (hit) desired.copy(cameraTarget).addScaledVector(direction, Math.max(0.6, hit.distance - 0.3));
    // Snap inward immediately so smoothing cannot let the camera pass through a wall.
    camera.position.lerp(desired, snapCamera || hit ? 1 : 1 - Math.exp(-14 * dt));
    camera.lookAt(cameraTarget); snapCamera = false;
    if (now - lastStatus > 120 || !lastStatus) {
      lastStatus = now;
      const near = [...pois].sort((a, b) => Math.hypot(a.x - position.x, a.z - position.z) - Math.hypot(b.x - position.x, b.z - position.z));
      pois.forEach(p => { p.marker.visible = near.slice(0, 2).includes(p) && Math.hypot(p.x - position.x, p.z - position.z) < 65; });
      const first = near[0], d = first ? Math.hypot(first.x - position.x, first.z - position.z) : Infinity;
      onStatus({ ...position, heading, yaw, road: nearestRoad(position, area.roads)?.road.name ?? "Area Markaz", atEdge: Math.hypot(position.x, position.z) > EXPLORE_RADIUS - 4, nearby: first && d < 65 ? { id: first.id, name: first.nama, distance: Math.round(d) } : null });
    }
    renderer.render(scene, camera);
  }

  try {
    scene.add(new THREE.HemisphereLight(0xf4f6e8, 0x7e9582, 2.5));
    const sun = new THREE.DirectionalLight(0xffe8c6, 2.6); sun.position.set(-80, 130, 65); scene.add(sun);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), new THREE.MeshStandardMaterial({ color: 0x9eae88, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.03; scene.add(ground);

    // Flat segment strips and round joins preserve road intersections without Catmull-Rom shortcuts.
    for (const shoulder of [true, false]) {
      const parts: THREE.BufferGeometry[] = [];
      for (const road of area.roads) {
        const width = road.width + (shoulder ? 1 : 0);
        for (let i = 1; i < road.points.length; i++) {
          const a = road.points[i - 1], b = road.points[i];
          const length = Math.hypot(b.x - a.x, b.z - a.z);
          if (length < 0.01) continue;
          const g = new THREE.PlaneGeometry(width, length);
          g.rotateX(-Math.PI / 2); g.rotateY(Math.atan2(b.x - a.x, b.z - a.z));
          g.translate((a.x + b.x) / 2, shoulder ? 0 : 0.025, (a.z + b.z) / 2); parts.push(g);
        }
        for (const p of road.points) {
          const g = new THREE.CircleGeometry(width / 2, 12); g.rotateX(-Math.PI / 2);
          g.translate(p.x, shoulder ? 0.001 : 0.026, p.z); parts.push(g);
        }
      }
      addMerged(scene, parts, new THREE.MeshStandardMaterial({ color: shoulder ? 0xc5c2ad : 0x737d75, roughness: 1 }));
    }

    // Merge by neighbourhood, not the entire map: offscreen chunks can be culled,
    // and camera rays only test nearby geometry. All footprints share materials.
    const chunks = new Map<string, { walls: THREE.BufferGeometry[]; roofs: THREE.BufferGeometry[]; windows: THREE.BufferGeometry[] }>();
    const palette = [0xe3ddc6, 0xd6ddc9, 0xe3d1b9].map(color => new THREE.Color(color));
    for (const building of area.buildings.filter(b => !hidden.has(b.id))) {
      const center = building.points.reduce((p, q) => ({ x: p.x + q.x / building.points.length, z: p.z + q.z / building.points.length }), { x: 0, z: 0 });
      const key = `${Math.floor(center.x / 50)},${Math.floor(center.z / 50)}`;
      if (!chunks.has(key)) chunks.set(key, { walls: [], roofs: [], windows: [] });
      const chunk = chunks.get(key)!;
      const shape = new THREE.Shape(building.points.map(p => new THREE.Vector2(p.x, -p.z)));
      const g = new THREE.ExtrudeGeometry(shape, { depth: building.height, bevelEnabled: false, steps: 1 });
      g.clearGroups(); g.rotateX(-Math.PI / 2);
      const color = palette[building.id % palette.length];
      const colors = new Float32Array(g.getAttribute("position").count * 3);
      for (let i = 0; i < colors.length; i += 3) color.toArray(colors, i);
      g.setAttribute("color", new THREE.BufferAttribute(colors, 3)); chunk.walls.push(g);
      const roof = new THREE.ShapeGeometry(shape); roof.rotateX(-Math.PI / 2); roof.translate(0, building.height + 0.04, 0); chunk.roofs.push(roof);
      // A few street-facing windows give scale; footprints remain exactly where the source puts them.
      for (let i = 0; i < building.points.length; i++) {
        const a = building.points[i], b = building.points[(i + 1) % building.points.length];
        const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
        const road = nearestRoad(mid, area.roads);
        if (!road || road.distance > 12 || Math.hypot(b.x - a.x, b.z - a.z) < 2.5) continue;
        const angle = Math.atan2(b.x - a.x, b.z - a.z);
        const window = new THREE.BoxGeometry(0.12, 1.1, 0.85);
        window.rotateY(angle); window.translate(mid.x, 1.9, mid.z); chunk.windows.push(window);
      }
    }
    const wallMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
    const roofMaterial = new THREE.MeshStandardMaterial({ color: 0xb37d60, roughness: 1, side: THREE.DoubleSide });
    const windowMaterial = new THREE.MeshStandardMaterial({ color: 0x48706a, roughness: 0.7 });
    for (const chunk of chunks.values()) {
      const buildings = addMerged(scene, chunk.walls, wallMaterial);
      if (buildings) collisionMeshes.push(buildings);
      if (chunk.roofs.length) addMerged(scene, chunk.roofs, roofMaterial);
      if (chunk.windows.length) addMerged(scene, chunk.windows, windowMaterial);
    }

    const boundary = new THREE.Mesh(new THREE.RingGeometry(EXPLORE_RADIUS - 0.5, EXPLORE_RADIUS + 0.5, 128), new THREE.MeshBasicMaterial({ color: 0xc7a765, transparent: true, opacity: 0.65, side: THREE.DoubleSide }));
    boundary.rotation.x = -Math.PI / 2; boundary.position.y = 0.05; scene.add(boundary);
    custom.sync(layout.objects, assets); scene.add(custom.group); collisionMeshes.push(custom.group);
    character = createCharacter(); scene.add(character.avatar, markers);
    resize(); observer.observe(host);
    window.addEventListener("keydown", keyDown); window.addEventListener("keyup", keyUp);
    window.addEventListener("blur", clearInput); document.addEventListener("visibilitychange", visibility);
    canvas.addEventListener("pointerdown", pointerDown); canvas.addEventListener("pointermove", pointerMove);
    canvas.addEventListener("pointerup", pointerEnd); canvas.addEventListener("pointercancel", pointerEnd);
    canvas.addEventListener("lostpointercapture", pointerEnd); canvas.addEventListener("wheel", wheel, { passive: false });
    canvas.addEventListener("webglcontextlost", contextLost);
    if (!document.hidden) frame = requestAnimationFrame(tick);
  } catch (error) { cleanup(); throw error; }

  return {
    motion: (right, forward) => { motion = { x: right, z: forward }; },
    run: value => { running = value; },
    pause: value => { paused = value; clearInput(); },
    reset,
    locations: items => {
      disposeTree(markers); markers.clear();
      pois = items.filter(p => Number.isFinite(p.latitude) && Number.isFinite(p.longitude))
      .map(item => ({ ...item, ...toLocal(item.latitude, item.longitude) }))
      .filter(p => Math.hypot(p.x, p.z) < EXPLORE_RADIUS).map(item => {
        const p = item;
        const marker = new THREE.Group(); marker.position.set(p.x, 0, p.z);
        const sign = label(item.nama); sign.position.y = 6; marker.add(sign);
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4.5, 6), new THREE.MeshBasicMaterial({ color: 0x236953 }));
        pole.position.y = 2.25; marker.add(pole);
        marker.visible = false; markers.add(marker);
        return { ...item, ...p, marker };
      });
      lastStatus = 0;
    },
    dispose: cleanup,
  };
}
