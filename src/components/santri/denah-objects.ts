import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";
import type { SceneAsset, SceneObject } from "@/lib/denah-scene";

export function disposeObject(root: THREE.Object3D, textures = true) {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), maps = new Set<THREE.Texture>();
  root.traverse(node => {
    const mesh = node as THREE.Mesh;
    if (mesh.geometry) geometries.add(mesh.geometry);
    if (mesh.material) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      materials.add(material);
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) maps.add(value);
    }
  });
  geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
  if (textures) maps.forEach(t => { t.dispose(); if (typeof ImageBitmap !== "undefined" && t.image instanceof ImageBitmap) t.image.close(); });
}

function signTexture(name: string) {
  const canvas = document.createElement("canvas"); canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext("2d")!; ctx.fillStyle = "#edf2df"; ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = "#245f49"; ctx.font = "bold 38px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(name, 256, 64, 470);
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; return map;
}

/** Presets are normalized to a 1×1×1 box; the root sets real metre dimensions. */
export function buildPreset(o: SceneObject): THREE.Group {
  const root = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: o.color, roughness: 0.9 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x31564b, roughness: 0.9 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x73533a, roughness: 1 });
  const add = (g: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => { const mesh = new THREE.Mesh(g, mat); mesh.position.set(x, y, z); root.add(mesh); return mesh; };
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, mat = paint) => add(new THREE.BoxGeometry(w, h, d), mat, x, y, z);
  switch (o.kind) {
    case "building": {
      const top = o.roof === "gable" ? 0.78 : 0.95;
      box(1, top, 1, 0, top / 2, 0);
      if (o.roof === "gable") {
        const shape = new THREE.Shape().moveTo(-0.54, 0.76).lineTo(0, 1).lineTo(0.54, 0.76).closePath();
        const g = new THREE.ExtrudeGeometry(shape, { depth: 1.08, bevelEnabled: false }); g.translate(0, 0, -0.54);
        add(g, new THREE.MeshStandardMaterial({ color: 0xa9644b, roughness: 1 }), 0, 0, 0);
      } else box(1.05, 0.05, 1.05, 0, 0.975, 0, trim);
      for (let floor = 0; floor < o.floors; floor++) for (const x of [-0.32, 0, 0.32]) {
        const y = (floor + 0.57) * top / o.floors;
        for (const side of [-1, 1]) box(0.12, top * 0.34 / o.floors, 0.012, x, y, side * 0.503, trim);
      }
      box(0.13, top * 0.65 / o.floors, 0.016, 0, top * 0.325 / o.floors, 0.51, wood);
      break;
    }
    case "gate":
      for (const x of [-0.43, 0.43]) box(0.14, 0.9, 1, x, 0.45, 0);
      box(1, 0.16, 1, 0, 0.92, 0); box(0.68, 0.065, 1.04, 0, 0.92, 0, trim); break;
    case "tree": {
      add(new THREE.CylinderGeometry(0.055, 0.075, 0.6, 7), wood, 0, 0.3, 0);
      const crown = add(new THREE.IcosahedronGeometry(0.5, 1), paint, 0, 0.66, 0); crown.scale.y = 0.68; break;
    }
    case "wall":
      box(1, 0.75, 0.6, 0, 0.375, 0);
      for (const x of [-0.47, 0, 0.47]) box(0.06, 1, 1, x, 0.5, 0);
      box(1, 0.06, 0.9, 0, 0.78, 0, trim); break;
    case "bench":
      box(1, 0.16, 1, 0, 0.52, 0); box(1, 0.38, 0.12, 0, 0.81, -0.42);
      for (const x of [-0.35, 0.35]) box(0.1, 0.5, 0.7, x, 0.25, 0, trim); break;
    case "lamp":
      add(new THREE.CylinderGeometry(0.045, 0.075, 0.86, 8), paint, 0, 0.43, 0);
      box(0.8, 0.06, 0.8, 0, 0.89, 0, new THREE.MeshStandardMaterial({ color: 0xffedb9, emissive: 0xffce6e, emissiveIntensity: 0.3 }));
      add(new THREE.ConeGeometry(0.5, 0.1, 4), paint, 0, 0.95, 0); break;
    case "sign": {
      for (const x of [-0.35, 0.35]) box(0.035, 0.85, 0.5, x, 0.425, 0, wood);
      box(1, 0.42, 1, 0, 0.79, 0);
      add(new THREE.PlaneGeometry(0.92, 0.34), new THREE.MeshBasicMaterial({ map: signTexture(o.name), side: THREE.DoubleSide }), 0, 0.79, 0.51); break;
    }
    case "model": box(1, 1, 1, 0, 0.5, 0, new THREE.MeshStandardMaterial({ color: 0xa9b8ac, wireframe: true })); break;
  }
  // Some presets do not use all three shared materials.
  for (const material of [paint, trim, wood]) {
    let used = false; root.traverse(n => { if ((n as THREE.Mesh).material === material) used = true; });
    if (!used) material.dispose();
  }
  return root;
}

export function applyObjectTransform(root: THREE.Object3D, object: SceneObject) {
  root.position.set(object.x, 0, object.z); root.rotation.set(0, object.rotation * Math.PI / 180, 0);
  root.scale.set(object.width, object.height, object.depth); root.updateMatrixWorld(true);
}

export function createObjectLayer(onChange: () => void, onAssetError: (name: string) => void) {
  const group = new THREE.Group();
  const entries = new Map<string, { signature: string; root: THREE.Group; kind: SceneObject["kind"] }>();
  const models = new Map<string, Promise<THREE.Group>>();
  const sources = new Set<THREE.Group>();
  const abort = new AbortController();
  let disposed = false;
  async function load(asset: SceneAsset) {
    if (!models.has(asset.url)) models.set(asset.url, (async () => {
      const response = await fetch(asset.url, { signal: AbortSignal.any([abort.signal, AbortSignal.timeout(15000)]) });
      if (!response.ok) throw new Error("Model gagal dimuat");
      const data = await response.arrayBuffer();
      const loader = new GLTFLoader();
      const gltf = await loader.parseAsync(data, "");
      if (disposed) { disposeObject(gltf.scene); throw new Error("Disposed"); }
      sources.add(gltf.scene); return gltf.scene;
    })());
    return models.get(asset.url)!;
  }
  return {
    group,
    get: (id: string) => entries.get(id)?.root ?? null,
    sync(objects: SceneObject[], assets: SceneAsset[]) {
      const ids = new Set(objects.map(o => o.id));
      for (const [id, entry] of entries) if (!ids.has(id)) { group.remove(entry.root); disposeObject(entry.root, entry.kind !== "model"); entries.delete(id); }
      for (const object of objects) {
        const signature = JSON.stringify(object), previous = entries.get(object.id);
        if (previous?.signature === signature) continue;
        if (previous) { group.remove(previous.root); disposeObject(previous.root, previous.kind !== "model"); }
        const root = new THREE.Group(); root.userData.objectId = object.id;
        root.add(buildPreset(object)); applyObjectTransform(root, object); group.add(root);
        entries.set(object.id, { signature, root, kind: object.kind });
        if (object.kind === "model") {
          const asset = assets.find(a => a.id === object.assetId);
          if (!asset) { onAssetError(object.name); continue; }
          void load(asset).then(source => {
            if (disposed || entries.get(object.id)?.root !== root) return;
            const model = cloneSkeleton(source);
            model.traverse(n => {
              const mesh = n as THREE.Mesh;
              if (mesh.geometry) mesh.geometry = mesh.geometry.clone();
              if (mesh.material) mesh.material = Array.isArray(mesh.material) ? mesh.material.map(m => m.clone()) : mesh.material.clone();
            });
            const bounds = new THREE.Box3().setFromObject(model), size = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3());
            if (!Number.isFinite(size.length()) || size.length() === 0) { disposeObject(model, false); throw new Error("Model kosong"); }
            const normalizer = new THREE.Group(); normalizer.add(model);
            model.position.sub(new THREE.Vector3(center.x, bounds.min.y, center.z));
            normalizer.scale.set(1 / Math.max(0.01, size.x), 1 / Math.max(0.01, size.y), 1 / Math.max(0.01, size.z));
            root.children.forEach(child => disposeObject(child)); root.clear(); root.add(normalizer); root.updateMatrixWorld(true); onChange();
          }).catch(() => { if (!disposed && entries.get(object.id)?.root === root) onAssetError(object.name); });
        }
      }
      onChange();
    },
    dispose() {
      disposed = true; abort.abort();
      for (const entry of entries.values()) disposeObject(entry.root, entry.kind !== "model");
      sources.forEach(source => disposeObject(source)); sources.clear(); entries.clear(); group.clear();
    },
  };
}
