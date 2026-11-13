import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { EXPLORE_RADIUS, type ExploreArea, type PointXZ } from "@/lib/markaz-explore";
import { hiddenBuildings, type SceneAsset, type SceneDocument, type SceneObject } from "@/lib/denah-scene";
import { createObjectLayer, disposeObject } from "@/components/santri/denah-objects";

export type EditorSelection = { type: "object"; id: string } | { type: "building"; id: number } | null;
export type EditorMode = "translate" | "rotate" | "scale";
export interface EditorSceneCallbacks {
  select: (selection: EditorSelection) => void;
  transform: (id: string, patch: Partial<SceneObject>) => void;
  spawn: (point: PointXZ) => void;
  error: (message: string) => void;
}

export function createEditorScene(host: HTMLDivElement, area: ExploreArea, callbacks: EditorSceneCallbacks) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xe8eee6);
  const camera = new THREE.PerspectiveCamera(48, 1, 0.2, 1500); camera.position.set(60, 85, 90);
  const canvas = renderer.domElement; canvas.style.cssText = "width:100%;height:100%;display:block;touch-action:none";
  canvas.tabIndex = 0; canvas.setAttribute("aria-label", "Kanvas editor kawasan. Klik bangunan atau objek untuk memilih. Geser untuk memutar, gulir untuk memperbesar."); host.appendChild(canvas);
  const orbit = new OrbitControls(camera, canvas); orbit.target.set(0, 0, 0); orbit.minDistance = 5; orbit.maxDistance = 700; orbit.maxPolarAngle = Math.PI / 2 - 0.06;
  const transform = new TransformControls(camera, canvas); transform.setSize(0.8); transform.setTranslationSnap(0.5); transform.setRotationSnap(Math.PI / 12);
  scene.add(transform.getHelper());
  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
  const base = new Map<number, THREE.Mesh>();
  let selection: EditorSelection = null, document: SceneDocument | null = null, pickingSpawn = false;
  let disposed = false, frame = 0, down: { x: number; y: number } | null = null, manipulated = false;
  let box: THREE.BoxHelper | null = null;
  const custom = createObjectLayer(render, name => callbacks.error(`Model ${name} belum berhasil dimuat. Coba muat ulang atau pilih aset lain.`));
  const spawnMarker = new THREE.Mesh(new THREE.ConeGeometry(1.3, 3.2, 4), new THREE.MeshBasicMaterial({ color: 0xca9031 }));
  scene.add(custom.group, spawnMarker); spawnMarker.visible = false;
  function render() {
    if (disposed || frame) return;
    frame = requestAnimationFrame(() => { frame = 0; if (disposed) return; box?.update(); renderer.render(scene, camera); });
  }
  function setSelection(value: EditorSelection) {
    selection = value; transform.detach();
    if (box) { scene.remove(box); disposeObject(box); box = null; }
    const root = value?.type === "object" ? custom.get(value.id) : value?.type === "building" ? base.get(value.id) : null;
    if (root) {
      if (value?.type === "object") transform.attach(root);
      box = new THREE.BoxHelper(root, 0x08766a); scene.add(box);
    }
    render();
  }
  function setMode(mode: EditorMode) {
    transform.setMode(mode);
    transform.showX = mode !== "rotate"; transform.showY = mode !== "translate"; transform.showZ = mode !== "rotate";
    transform.showXY = false; transform.showYZ = false; transform.showXZ = mode === "translate";
    render();
  }
  function resize() { const rect = host.getBoundingClientRect(); if (!rect.width || !rect.height) return; renderer.setSize(rect.width, rect.height, false); camera.aspect = rect.width / rect.height; camera.updateProjectionMatrix(); render(); }
  const observer = new ResizeObserver(resize);
  function pointerDown(e: PointerEvent) { down = { x: e.clientX, y: e.clientY }; manipulated = false; }
  function pointerUp(e: PointerEvent) {
    if (!down || manipulated || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5 || (e.pointerType === "mouse" && e.button !== 0)) return;
    const rect = canvas.getBoundingClientRect(); pointer.set((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    if (pickingSpawn) {
      const point = raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
      if (point && Math.hypot(point.x, point.z) < EXPLORE_RADIUS) callbacks.spawn({ x: Math.round(point.x * 10) / 10, z: Math.round(point.z * 10) / 10 });
      else callbacks.error("Pilih titik di dalam batas kawasan Markaz.");
      return;
    }
    const hit = raycaster.intersectObjects([...base.values()].filter(m => m.visible).concat(custom.group.children as THREE.Mesh[]), true)[0];
    let value: EditorSelection = null, object: THREE.Object3D | null = hit?.object ?? null;
    while (object) {
      if (object.userData.objectId) { value = { type: "object", id: object.userData.objectId }; break; }
      if (object.userData.buildingId) { value = { type: "building", id: object.userData.buildingId }; break; }
      object = object.parent;
    }
    callbacks.select(value); setSelection(value);
  }
  function dragChanged(event: { value?: unknown }) { orbit.enabled = !event.value; if (event.value) manipulated = true; }
  function commitTransform() {
    const root = transform.object;
    if (!root || selection?.type !== "object") return;
    const original = document?.objects.find(o => o.id === selection?.id);
    if (!original) return;
    const patch = { x: root.position.x, z: root.position.z, rotation: ((THREE.MathUtils.radToDeg(root.rotation.y) + 180) % 360 + 360) % 360 - 180, width: Math.max(0.1, Math.min(80, root.scale.x)), height: Math.max(0.1, Math.min(40, root.scale.y)), depth: Math.max(0.1, Math.min(80, root.scale.z)) };
    const length = Math.hypot(patch.x, patch.z);
    if (length > EXPLORE_RADIUS) { patch.x *= (EXPLORE_RADIUS - 0.5) / length; patch.z *= (EXPLORE_RADIUS - 0.5) / length; }
    callbacks.transform(original.id, patch);
  }
  function contextLost(event: Event) { event.preventDefault(); callbacks.error("Kanvas 3D terhenti. Simpan draf bila perlu, lalu muat ulang editor."); }
  function keyDown(e: KeyboardEvent) {
    if (e.target !== canvas || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.code)) return;
    e.preventDefault();
    const delta = 4, x = (e.code === "ArrowRight" ? delta : e.code === "ArrowLeft" ? -delta : 0), z = (e.code === "ArrowDown" ? delta : e.code === "ArrowUp" ? -delta : 0);
    camera.position.x += x; camera.position.z += z; orbit.target.x += x; orbit.target.z += z; orbit.update(); render();
  }
  scene.add(new THREE.HemisphereLight(0xffffff, 0x829573, 2.7));
  const sun = new THREE.DirectionalLight(0xfff0db, 2); sun.position.set(-60, 100, 40); scene.add(sun);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(750, 750), new THREE.MeshLambertMaterial({ color: 0xb6c2a5 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05; scene.add(ground);
  const grid = new THREE.GridHelper(700, 70, 0x99ad92, 0xadbca1); grid.position.y = -0.03; scene.add(grid);
  const roadMaterial = new THREE.MeshLambertMaterial({ color: 0x78877c });
  for (const road of area.roads) for (let i = 1; i < road.points.length; i++) {
    const a = road.points[i - 1], b = road.points[i], length = Math.hypot(b.x - a.x, b.z - a.z);
    const geometry = new THREE.PlaneGeometry(road.width, length);
    geometry.rotateX(-Math.PI / 2); geometry.rotateY(Math.atan2(b.x - a.x, b.z - a.z));
    const mesh = new THREE.Mesh(geometry, roadMaterial);
    mesh.position.set((a.x + b.x) / 2, 0, (a.z + b.z) / 2); scene.add(mesh);
  }
  const wall = new THREE.MeshLambertMaterial({ color: 0xd8dccf }), roof = new THREE.MeshLambertMaterial({ color: 0xc3b6a0 });
  for (const building of area.buildings) {
    const shape = new THREE.Shape(building.points.map(p => new THREE.Vector2(p.x, -p.z)));
    const g = new THREE.ExtrudeGeometry(shape, { depth: building.height, bevelEnabled: false }); g.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(g, [roof, wall]); mesh.userData.buildingId = building.id; base.set(building.id, mesh); scene.add(mesh);
  }
  const boundary = new THREE.Mesh(new THREE.RingGeometry(EXPLORE_RADIUS - 0.6, EXPLORE_RADIUS + 0.6, 128), new THREE.MeshBasicMaterial({ color: 0xbe914b, side: THREE.DoubleSide })); boundary.rotation.x = -Math.PI / 2; boundary.position.y = 0.04; scene.add(boundary);
  orbit.addEventListener("change", render); transform.addEventListener("change", render); transform.addEventListener("dragging-changed", dragChanged); transform.addEventListener("mouseUp", commitTransform);
  canvas.addEventListener("pointerdown", pointerDown, true); canvas.addEventListener("pointerup", pointerUp); canvas.addEventListener("keydown", keyDown); canvas.addEventListener("webglcontextlost", contextLost);
  observer.observe(host); setMode("translate"); orbit.update(); resize();
  return {
    select: setSelection,
    mode: setMode,
    spawnPicking(value: boolean) { pickingSpawn = value; transform.enabled = !value; canvas.style.cursor = value ? "crosshair" : "grab"; },
    sync(doc: SceneDocument, assets: SceneAsset[]) {
      document = doc; const hidden = hiddenBuildings(doc);
      base.forEach((mesh, id) => { mesh.visible = !hidden.has(id); });
      custom.sync(doc.objects, assets); spawnMarker.visible = Boolean(doc.spawn);
      if (doc.spawn) spawnMarker.position.set(doc.spawn.x, 2, doc.spawn.z);
      setSelection(selection); render();
    },
    center(): PointXZ { return { x: Math.max(-290, Math.min(290, orbit.target.x)), z: Math.max(-290, Math.min(290, orbit.target.z)) }; },
    focus(point: PointXZ) { const delta = new THREE.Vector3(point.x, 0, point.z).sub(orbit.target); camera.position.add(delta); orbit.target.add(delta); orbit.update(); render(); },
    dispose() {
      disposed = true; cancelAnimationFrame(frame); observer.disconnect();
      canvas.removeEventListener("pointerdown", pointerDown, true); canvas.removeEventListener("pointerup", pointerUp); canvas.removeEventListener("keydown", keyDown); canvas.removeEventListener("webglcontextlost", contextLost);
      orbit.removeEventListener("change", render); transform.removeEventListener("change", render); transform.removeEventListener("dragging-changed", dragChanged); transform.removeEventListener("mouseUp", commitTransform);
      orbit.dispose(); transform.dispose(); scene.remove(custom.group); custom.dispose(); disposeObject(scene); renderer.dispose(); renderer.forceContextLoss(); canvas.remove();
    },
  };
}
