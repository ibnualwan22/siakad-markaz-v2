import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateGlb } from "../src/lib/denah-glb";
import { BUILTIN_ASSETS, withBuiltinAssets } from "../src/lib/denah-builtin-assets";
import { housePlacement, roadsideBuildingIds } from "../src/lib/denah-houses";
import type { ExploreArea } from "../src/lib/markaz-explore";
import { EMPTY_SCENE, newSceneObject, parseScene, sceneObstacles, sceneSpawn, validateSceneReferences } from "../src/lib/denah-scene";
import { isWalkable, makeObstacle } from "../src/lib/markaz-explore";
import area from "../public/maps/markaz-area.json";

const square = (id: number, x: number, z: number, width = 5, depth = 5) => ({
  id, height: 4, points: [{ x, z }, { x: x + width, z }, { x: x + width, z: z + depth }, { x, z: z + depth }],
});

test("roadside detail uses road width and front-yard setback rather than building centre", () => {
  const sample: ExploreArea = { source: "test", capturedAt: "test", roads: [
    { id: 1, name: "Jalan", width: 6, points: [{ x: -50, z: 0 }, { x: 50, z: 0 }] },
  ], buildings: [square(1, -10, 7), square(2, 0, 7.01), square(3, 10, 6, 5, 40), square(4, 60, 0)] };
  assert.deepEqual([...roadsideBuildingIds(sample)], [1, 3]);
  assert.equal(roadsideBuildingIds({ ...sample, roads: [] }).size, 0);
});

test("short, crossing and zero-length road segments classify nearby footprint edges correctly", () => {
  const building = square(10, -20, 6, 40, 8);
  const sample: ExploreArea = { source: "test", capturedAt: "test", buildings: [building], roads: [
    { id: 1, name: "Gang", width: 4, points: [{ x: -1, z: 0 }, { x: 1, z: 0 }] },
  ] };
  assert.ok(roadsideBuildingIds(sample).has(10)); // Both building corners are far from this short road.
  sample.roads[0].points = [{ x: 0, z: 0 }, { x: 0, z: 0 }];
  assert.ok(roadsideBuildingIds(sample).has(10));
  sample.roads[0].points = [{ x: 0, z: -20 }, { x: 0, z: 20 }];
  assert.ok(roadsideBuildingIds(sample).has(10));
  sample.roads[0].points = [{ x: 80, z: 6 }, { x: 100, z: 6 }];
  assert.equal(roadsideBuildingIds(sample).size, 0); // Collinear lines do not imply intersecting segments.
});

test("bundled models are self-contained valid GLBs and their metadata matches", () => {
  for (const asset of BUILTIN_ASSETS) {
    const data = readFileSync(`public${asset.url}`);
    assert.equal(data.length, asset.bytes);
    assert.equal(validateGlb(data).vertices, asset.vertices);
  }
  const data = readFileSync("public/models/markaz/character.glb");
  validateGlb(data);
  const json = JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)).toString());
  for (const name of ["idle", "walk", "sprint"]) assert.ok(json.animations.some((a: { name: string }) => a.name === name));
});

test("built-in IDs can be saved and published, and uploaded models remain available", () => {
  const upload = { id: "upload", name: "Warung", url: "https://example.com/test.glb", bytes: 100, vertices: 30 };
  const assets = withBuiltinAssets([upload, { ...BUILTIN_ASSETS[0], url: "https://wrong.example" }]);
  assert.equal(assets.length, BUILTIN_ASSETS.length + 1);
  assert.equal(assets[0].url, BUILTIN_ASSETS[0].url);
  const doc = parseScene({ ...EMPTY_SCENE, objects: [newSceneObject("model", { x: 20, z: 20 }, "builtin-hall")] });
  validateSceneReferences(doc, area, assets, true);
});

test("rotated houses use matching placement and collision, respecting hidden replacements", () => {
  const building = { id: 3, height: 4, points: [{ x: -3, z: 1 }, { x: 1, z: -3 }, { x: 3, z: -1 }, { x: -1, z: 3 }] };
  const p = housePlacement(building);
  assert.ok(Math.abs(p.rotation - Math.PI / 4) < 1e-8);
  assert.equal(isWalkable({ x: p.x, z: p.z }, [p.obstacle]), false);
  const sample = { ...area, buildings: [building] };
  assert.deepEqual(sceneObstacles(sample, EMPTY_SCENE), [p.obstacle]);
  assert.equal(sceneObstacles(sample, { ...EMPTY_SCENE, hiddenBuildingIds: [3] }).length, 0);
});

test("all real footprints have finite house transforms and a safe spawn", () => {
  for (const building of area.buildings) {
    const p = housePlacement(building);
    assert.ok([p.x, p.z, p.width, p.depth, p.height, p.rotation].every(Number.isFinite));
    assert.ok(p.width > 0 && p.height > 0 && p.depth > 0);
    assert.ok([0, 1, 2].includes(p.variant));
  }
  const spawn = sceneSpawn(area, EMPTY_SCENE);
  assert.ok(spawn);
  assert.equal(isWalkable(spawn.point, sceneObstacles(area, EMPTY_SCENE)), true);
});

test("replacement houses preserve previously walkable road centres across Markaz", () => {
  const original = area.buildings.map(building => makeObstacle(building.points));
  const houses = sceneObstacles(area, EMPTY_SCENE);
  for (const road of area.roads) for (let i = 1; i < road.points.length; i++) {
    const a = road.points[i - 1], b = road.points[i];
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z)));
    for (let j = 0; j <= steps; j++) {
      const t = j / steps, point = { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
      if (isWalkable(point, original)) {
        assert.equal(isWalkable(point, houses), true, `${road.name}: ${point.x}, ${point.z}`);
      }
    }
  }
});
