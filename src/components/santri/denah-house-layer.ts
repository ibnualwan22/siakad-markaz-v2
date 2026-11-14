import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { HOUSE_ASSETS } from "@/lib/denah-builtin-assets";
import { housePlacement, roadsideBuildingIds } from "@/lib/denah-houses";
import type { ExploreArea } from "@/lib/markaz-explore";
import { disposeObject } from "./denah-objects";

/** One mesh and 26 triangles: interior blocks still look like homes without GLB detail. */
function simpleHouse() {
  const parts: THREE.BufferGeometry[] = [];
  function part(geometry: THREE.BufferGeometry, color: number) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    if (g !== geometry) geometry.dispose();
    const colors = new Float32Array(g.getAttribute("position").count * 3), paint = new THREE.Color(color);
    for (let i = 0; i < colors.length; i += 3) paint.toArray(colors, i);
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3)); parts.push(g);
  }
  part(new THREE.BoxGeometry(1, 0.74, 1).translate(0, 0.37, 0), 0xd6dccd);
  const roof = new THREE.Shape().moveTo(-0.5, 0.74).lineTo(0, 1).lineTo(0.5, 0.74).closePath();
  part(new THREE.ExtrudeGeometry(roof, { depth: 1, bevelEnabled: false, steps: 1 }).translate(0, 0, -0.5), 0x519477);
  part(new THREE.PlaneGeometry(0.17, 0.4).translate(0, 0.2, 0.501), 0x3c504b);
  for (const x of [-0.3, 0.3]) part(new THREE.PlaneGeometry(0.17, 0.18).translate(x, 0.46, 0.501), 0x637d7c);
  const geometry = mergeGeometries(parts, false)!; parts.forEach(g => g.dispose());
  const group = new THREE.Group();
  group.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })));
  return group;
}

/** Shared instanced geometry per variant and 60 m block, with stable OSM IDs for picking. */
export function createHouseLayer(area: ExploreArea, changed: () => void, error: (name: string) => void) {
  const group = new THREE.Group();
  const roadside = roadsideBuildingIds(area);
  const placements = area.buildings.map(housePlacement);
  const byId = new Map(placements.map(p => [p.id, p]));
  const templates = new Map<number, THREE.Group>();
  const abort = new AbortController();
  let disposed = false, hidden = new Set<number>();
  const fallback = simpleHouse();
  // Selection bounds are independent of instance meshes and never rendered.
  const selection = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  selection.geometry.translate(0, 0.5, 0);
  function clearInstances() {
    group.children.forEach(child => (child as THREE.InstancedMesh).dispose());
    group.clear();
  }
  function rebuild() {
    if (disposed) return;
    clearInstances();
    const blocks = new Map<string, typeof placements>();
    for (const p of placements) if (!hidden.has(p.id)) {
      const variant = roadside.has(p.id) && templates.has(p.variant) ? p.variant : -1;
      const key = `${variant}:${Math.floor(p.x / 60)}:${Math.floor(p.z / 60)}`;
      const block = blocks.get(key) ?? []; block.push(p); blocks.set(key, block);
    }
    const transform = new THREE.Object3D(), matrix = new THREE.Matrix4();
    for (const block of blocks.values()) {
      const template = roadside.has(block[0].id) ? templates.get(block[0].variant) ?? fallback : fallback;
      template.updateMatrixWorld(true);
      template.traverse(node => {
        const source = node as THREE.Mesh;
        if (!source.isMesh) return;
        const instances = new THREE.InstancedMesh(source.geometry, source.material, block.length);
        instances.userData.buildingIds = block.map(p => p.id);
        block.forEach((p, i) => {
          transform.position.set(p.x, 0, p.z); transform.rotation.set(0, p.rotation, 0);
          transform.scale.set(p.width, p.height, p.depth); transform.updateMatrix();
          matrix.multiplyMatrices(transform.matrix, source.matrixWorld); instances.setMatrixAt(i, matrix);
        });
        instances.computeBoundingSphere(); group.add(instances);
      });
    }
    changed();
  }
  rebuild();
  HOUSE_ASSETS.forEach((asset, variant) => {
    if (!placements.some(p => p.variant === variant && roadside.has(p.id))) return;
    void (async () => {
      const response = await fetch(asset.url, { signal: AbortSignal.any([abort.signal, AbortSignal.timeout(15000)]) });
      if (!response.ok) throw new Error("Model rumah belum tersedia");
      const gltf = await new GLTFLoader().parseAsync(await response.arrayBuffer(), "");
      if (disposed) { disposeObject(gltf.scene); return; }
      const bounds = new THREE.Box3().setFromObject(gltf.scene), size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      const template = new THREE.Group();
      gltf.scene.position.sub(new THREE.Vector3(center.x, bounds.min.y, center.z));
      template.scale.set(1 / size.x, 1 / size.y, 1 / size.z); template.add(gltf.scene);
      templates.set(variant, template); rebuild();
    })().catch(() => { if (!disposed) error(asset.name); });
  });
  return {
    group,
    get(id: number) {
      const p = byId.get(id); if (!p || hidden.has(id)) return null;
      selection.position.set(p.x, 0, p.z); selection.rotation.set(0, p.rotation, 0);
      selection.scale.set(p.width, p.height, p.depth); selection.updateMatrixWorld(true);
      return selection;
    },
    pick(hit: THREE.Intersection) {
      return hit.instanceId === undefined ? undefined : hit.object.userData.buildingIds?.[hit.instanceId] as number | undefined;
    },
    sync(next: Set<number>) {
      if (next.size === hidden.size && [...next].every(id => hidden.has(id))) return;
      hidden = new Set(next); rebuild();
    },
    dispose() {
      disposed = true; abort.abort(); clearInstances();
      templates.forEach(template => disposeObject(template)); templates.clear();
      disposeObject(fallback); disposeObject(selection);
    },
  };
}
