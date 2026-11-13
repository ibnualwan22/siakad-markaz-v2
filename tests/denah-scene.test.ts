import test from "node:test";
import assert from "node:assert/strict";
import { EMPTY_SCENE, newSceneObject, parseScene, objectObstacles, sceneObstacles, sceneSpawn, validateSceneReferences, type SceneDocument, type SceneAsset } from "../src/lib/denah-scene";
import { isWalkable, type ExploreArea } from "../src/lib/markaz-explore";
import { validateGlb } from "../src/lib/denah-glb";

const area: ExploreArea = { source: "test", capturedAt: "test", roads: [{ id: 1, name: "Jalan uji", width: 3, points: [{ x: -20, z: 0 }, { x: 20, z: 0 }] }], buildings: [{ id: 9, height: 4, points: [{ x: 5, z: 5 }, { x: 10, z: 5 }, { x: 10, z: 10 }, { x: 5, z: 10 }] }] };
function scene(): SceneDocument { return structuredClone(EMPTY_SCENE); }
function glb(modify: (json: Record<string, unknown>) => void = () => {}) {
  const json: Record<string, unknown> = { asset: { version: "2.0" }, buffers: [{ byteLength: 36 }], bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }], accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: "VEC3", min: [0, 0, 0], max: [1, 1, 0] }], meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }], nodes: [{ mesh: 0 }], scenes: [{ nodes: [0] }], scene: 0 };
  modify(json);
  const text = JSON.stringify(json); const padded = Buffer.from(text.padEnd(Math.ceil(Buffer.byteLength(text) / 4) * 4, " "));
  const buffer = Buffer.alloc(12 + 8 + padded.length + 8 + 36);
  buffer.writeUInt32LE(0x46546c67, 0); buffer.writeUInt32LE(2, 4); buffer.writeUInt32LE(buffer.length, 8);
  buffer.writeUInt32LE(padded.length, 12); buffer.writeUInt32LE(0x4e4f534a, 16); padded.copy(buffer, 20);
  buffer.writeUInt32LE(36, 20 + padded.length); buffer.writeUInt32LE(0x004e4942, 24 + padded.length);
  return buffer;
}

test("scene accepts built-ins and strips unrelated properties", () => {
  const document = { ...scene(), objects: [newSceneObject("building", { x: 20, z: 20 })], injected: "ignored" };
  const parsed = parseScene(document);
  assert.equal(parsed.objects[0].kind, "building"); assert.equal("injected" in parsed, false);
  validateSceneReferences(parsed, area, [], true);
});
test("invalid transforms, duplicate IDs and outside positions are rejected", () => {
  const object = newSceneObject("tree", { x: 0, z: 0 });
  for (const patch of [{ x: NaN }, { x: 250, z: 250 }, { width: -1 }, { floors: 1.5 }, { color: "url(js)" }, { kind: "script" }]) assert.throws(() => parseScene({ ...scene(), objects: [{ ...object, ...patch }] }));
  assert.throws(() => parseScene({ ...scene(), objects: [object, object] }), /ganda/);
  assert.throws(() => parseScene({ ...scene(), objects: Array.from({ length: 151 }, () => object) }), /150/);
});
test("replaced buildings no longer block the old footprint, new objects do", () => {
  const before = scene(); assert.equal(isWalkable({ x: 7, z: 7 }, sceneObstacles(area, before)), false);
  const replacement = { ...newSceneObject("building", { x: 30, z: 30 }), replacesBuildingId: 9 };
  const after = { ...before, objects: [replacement] };
  assert.equal(isWalkable({ x: 7, z: 7 }, sceneObstacles(area, after)), true);
  assert.equal(isWalkable({ x: 30, z: 30 }, sceneObstacles(area, after)), false);
  assert.equal(isWalkable({ x: 30, z: 30 }, objectObstacles({ ...replacement, solid: false })), true);
});
test("gate leaves the central opening walkable and rotates pillars correctly", () => {
  const gate = newSceneObject("gate", { x: 0, z: 0 });
  assert.equal(isWalkable({ x: 0, z: 0 }, objectObstacles(gate)), true);
  assert.equal(isWalkable({ x: 2.58, z: 0 }, objectObstacles(gate)), false);
  assert.equal(isWalkable({ x: 0, z: -2.58 }, objectObstacles({ ...gate, rotation: 90 })), false);
  assert.equal(isWalkable({ x: 0, z: 0 }, objectObstacles({ ...gate, height: 1 })), false);
});
test("draft may contain blocked spawn but publication rejects it", () => {
  const doc = { ...scene(), spawn: { x: 0, z: 0, heading: 90 }, objects: [newSceneObject("building", { x: 0, z: 0 })] };
  assert.equal(sceneSpawn(area, doc), null);
  validateSceneReferences(doc, area, [], false);
  assert.throws(() => validateSceneReferences(doc, area, [], true), /Titik awal terhalang/);
  assert.ok(sceneSpawn(area, { ...doc, spawn: null }));
});
test("unknown buildings, absent uploaded assets, and excessive model load are rejected", () => {
  assert.throws(() => validateSceneReferences({ ...scene(), hiddenBuildingIds: [123] }, area, [], true), /referensi/);
  const model = newSceneObject("model", { x: 0, z: 0 }, "asset1");
  assert.throws(() => validateSceneReferences({ ...scene(), objects: [model] }, area, [], false), /tidak tersedia/);
  const asset: SceneAsset = { id: "asset1", name: "model", url: "/test.glb", bytes: 100, vertices: 100000 };
  assert.throws(() => validateSceneReferences({ ...scene(), objects: [model, model, model, model] }, area, [asset], false), /terlalu berat/);
});
test("valid self-contained GLB is accepted and reports rendered vertex count", () => {
  assert.deepEqual(validateGlb(glb()), { vertices: 3 });
  assert.deepEqual(validateGlb(glb(j => { j.nodes = [{ mesh: 0 }, { mesh: 0 }]; })), { vertices: 6 });
});
test("GLB validation rejects invalid length, external resources and required decoders", () => {
  const broken = glb(); broken.writeUInt32LE(12, 8); assert.throws(() => validateGlb(broken));
  assert.throws(() => validateGlb(glb(j => { j.buffers = [{ byteLength: 36, uri: "https://example.test/file.bin" }]; })), /luar/);
  assert.throws(() => validateGlb(glb(j => { j.extensionsUsed = ["KHR_draco_mesh_compression"]; })), /kompresi/);
  assert.throws(() => validateGlb(glb(j => { j.bufferViews = [{ buffer: 0, byteOffset: 32, byteLength: 36 }]; })));
});
test("GLB validation rejects node cycles and models over the mobile budget", () => {
  assert.throws(() => validateGlb(glb(j => { j.nodes = [{ mesh: 0, children: [0] }]; })), /Struktur/);
  assert.throws(() => validateGlb(glb(j => { j.accessors = [{ count: 100001 }]; })), /100.000/);
});
