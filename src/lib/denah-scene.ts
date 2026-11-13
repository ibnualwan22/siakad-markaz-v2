import { EXPLORE_RADIUS, findSpawn, isWalkable, makeObstacle, type ExploreArea, type Obstacle, type PointXZ } from "./markaz-explore";

export const SCENE_KINDS = ["building", "gate", "tree", "wall", "bench", "lamp", "sign", "model"] as const;
export type SceneKind = typeof SCENE_KINDS[number];
export interface SceneObject {
  id: string; name: string; kind: SceneKind; assetId: string | null;
  x: number; z: number; rotation: number; width: number; height: number; depth: number;
  floors: number; roof: "gable" | "flat"; color: string; solid: boolean;
  replacesBuildingId: number | null;
}
export interface SceneDocument {
  version: 1; objects: SceneObject[]; hiddenBuildingIds: number[];
  spawn: (PointXZ & { heading: number }) | null;
}
export interface SceneAsset { id: string; name: string; url: string; bytes: number; vertices: number }
export const EMPTY_SCENE: SceneDocument = { version: 1, objects: [], hiddenBuildingIds: [], spawn: null };
export const MAX_SCENE_OBJECTS = 150;
export const ASSET_MAX_BYTES = 3 * 1024 * 1024;
export const PRESETS: { kind: Exclude<SceneKind, "model">; name: string; description: string; size: [number, number, number]; color: string }[] = [
  { kind: "building", name: "Gedung sakan", description: "Lantai, atap, dan warna", size: [10, 4.4, 8], color: "#e8ddc4" },
  { kind: "gate", name: "Gerbang", description: "Dua pilar, jalan di tengah", size: [6, 4, 0.8], color: "#e6dcc4" },
  { kind: "tree", name: "Pohon", description: "Peneduh halaman", size: [3.5, 5, 3.5], color: "#477d56" },
  { kind: "wall", name: "Pagar", description: "Pembatas pekarangan", size: [6, 1.8, 0.25], color: "#b8bdaf" },
  { kind: "bench", name: "Bangku", description: "Tempat duduk taman", size: [1.8, 0.9, 0.65], color: "#9a714a" },
  { kind: "lamp", name: "Lampu jalan", description: "Tiang dan kap lampu", size: [0.7, 4, 0.7], color: "#354d46" },
  { kind: "sign", name: "Papan nama", description: "Nama lokasi pada papan", size: [2.8, 2.2, 0.25], color: "#245f49" },
];

export function newSceneObject(kind: SceneKind, point: PointXZ, assetId: string | null = null): SceneObject {
  const preset = PRESETS.find(p => p.kind === kind);
  const [width, height, depth] = preset?.size ?? [5, 4, 5];
  return { id: crypto.randomUUID(), kind, name: preset?.name ?? "Model sendiri", assetId, ...point, rotation: 0, width, height, depth, floors: 1, roof: "gable", color: preset?.color ?? "#d8d8cc", solid: true, replacesBuildingId: null };
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Data kawasan tidak valid.");
  return value as Record<string, unknown>;
}
function number(value: unknown, min: number, max: number, field: string) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) throw new Error(`${field} harus antara ${min} dan ${max}.`);
  return value;
}
function text(value: unknown, max: number, field: string) {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error(`${field} tidak valid (maksimal ${max} karakter).`);
  return value.trim();
}

export function parseScene(value: unknown): SceneDocument {
  const v = record(value);
  if (v.version !== 1 || !Array.isArray(v.objects) || v.objects.length > MAX_SCENE_OBJECTS || !Array.isArray(v.hiddenBuildingIds) || v.hiddenBuildingIds.length > 2000) throw new Error("Format kawasan tidak valid atau jumlah objek melebihi batas 150.");
  const ids = new Set<string>(), replaced = new Set<number>();
  const objects = v.objects.map(input => {
    const o = record(input);
    const id = text(o.id, 64, "ID objek");
    if (!/^[a-zA-Z0-9_-]+$/.test(id) || ids.has(id)) throw new Error("ID objek ganda atau tidak valid.");
    ids.add(id);
    if (!SCENE_KINDS.includes(o.kind as SceneKind)) throw new Error("Jenis objek tidak dikenal.");
    if (typeof o.solid !== "boolean" || !["flat", "gable"].includes(String(o.roof)) || typeof o.color !== "string" || !/^#[0-9a-f]{6}$/i.test(o.color)) throw new Error("Pengaturan tampilan objek tidak valid.");
    const replacement = o.replacesBuildingId === null ? null : number(o.replacesBuildingId, 1, Number.MAX_SAFE_INTEGER, "ID bangunan");
    if (replacement !== null) {
      if (!Number.isInteger(replacement) || replaced.has(replacement)) throw new Error("Satu bangunan hanya dapat diganti satu objek.");
      replaced.add(replacement);
    }
    const object: SceneObject = {
      id, name: text(o.name, 80, "Nama objek"), kind: o.kind as SceneKind,
      assetId: o.kind === "model" ? text(o.assetId, 64, "Aset") : null,
      x: number(o.x, -EXPLORE_RADIUS, EXPLORE_RADIUS, "Posisi X"), z: number(o.z, -EXPLORE_RADIUS, EXPLORE_RADIUS, "Posisi Z"),
      rotation: number(o.rotation, -360, 360, "Putaran"), width: number(o.width, 0.1, 80, "Lebar"), height: number(o.height, 0.1, 40, "Tinggi"), depth: number(o.depth, 0.1, 80, "Panjang"),
      floors: number(o.floors, 1, 8, "Lantai"), roof: o.roof as "flat" | "gable", color: o.color, solid: o.solid, replacesBuildingId: replacement,
    };
    if (!Number.isInteger(object.floors) || Math.hypot(object.x, object.z) > EXPLORE_RADIUS) throw new Error("Objek harus berada di kawasan Markaz dan jumlah lantai harus bulat.");
    return object;
  });
  const hiddenBuildingIds = [...new Set(v.hiddenBuildingIds.map(id => number(id, 1, Number.MAX_SAFE_INTEGER, "ID bangunan")))];
  if (hiddenBuildingIds.some(id => !Number.isInteger(id))) throw new Error("ID bangunan tidak valid.");
  const spawn = v.spawn === null ? null : record(v.spawn);
  return { version: 1, objects, hiddenBuildingIds, spawn: spawn ? { x: number(spawn.x, -EXPLORE_RADIUS, EXPLORE_RADIUS, "Titik awal X"), z: number(spawn.z, -EXPLORE_RADIUS, EXPLORE_RADIUS, "Titik awal Z"), heading: number(spawn.heading, -360, 360, "Arah awal") } : null };
}

export function hiddenBuildings(doc: SceneDocument) {
  return new Set([...doc.hiddenBuildingIds, ...doc.objects.flatMap(o => o.replacesBuildingId === null ? [] : [o.replacesBuildingId])]);
}

function rectangle(o: SceneObject, cx: number, cz: number, width: number, depth: number): Obstacle {
  const angle = o.rotation * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
  return makeObstacle([[-width / 2, -depth / 2], [width / 2, -depth / 2], [width / 2, depth / 2], [-width / 2, depth / 2]].map(([x, z]) => ({ x: o.x + (x + cx) * c + (z + cz) * s, z: o.z - (x + cx) * s + (z + cz) * c })));
}

export function objectObstacles(o: SceneObject): Obstacle[] {
  if (!o.solid) return [];
  if (o.kind === "gate" && o.height >= 2.4) return [-1, 1].map(side => rectangle(o, side * o.width * 0.43, 0, o.width * 0.14, o.depth));
  if (o.kind === "tree" || o.kind === "lamp") return [rectangle(o, 0, 0, o.width * 0.15, o.depth * 0.15)];
  return [rectangle(o, 0, 0, o.width, o.depth)];
}
export function sceneObstacles(area: ExploreArea, doc: SceneDocument): Obstacle[] {
  const hidden = hiddenBuildings(doc);
  return [...area.buildings.filter(b => !hidden.has(b.id)).map(b => makeObstacle(b.points)), ...doc.objects.flatMap(objectObstacles)];
}
export function sceneSpawn(area: ExploreArea, doc: SceneDocument) {
  const obstacles = sceneObstacles(area, doc);
  if (doc.spawn) return isWalkable(doc.spawn, obstacles) ? { point: { x: doc.spawn.x, z: doc.spawn.z }, heading: doc.spawn.heading * Math.PI / 180 } : null;
  return findSpawn(area.roads, obstacles);
}
export function validateSceneReferences(doc: SceneDocument, area: ExploreArea, assets: SceneAsset[], publishing: boolean) {
  const buildingIds = new Set(area.buildings.map(b => b.id));
  if ([...hiddenBuildings(doc)].some(id => !buildingIds.has(id))) throw new Error("Bangunan referensi tidak ditemukan di kawasan.");
  const byId = new Map(assets.map(a => [a.id, a]));
  let vertices = 0;
  for (const object of doc.objects) if (object.kind === "model") {
    const asset = byId.get(object.assetId!);
    if (!asset) throw new Error(`Aset untuk ${object.name} tidak tersedia. Unggah ulang atau pilih aset lain.`);
    vertices += asset.vertices;
  }
  if (vertices > 300000) throw new Error("Model terlalu berat untuk kawasan. Kurangi jumlah model atau gunakan model lebih sederhana.");
  if (publishing && !sceneSpawn(area, doc)) throw new Error("Titik awal terhalang. Pindahkan ke tempat kosong sebelum menerbitkan.");
}
