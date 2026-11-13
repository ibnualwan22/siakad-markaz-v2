import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  EXPLORE_RADIUS, MARKAZ_ORIGIN, PLAYER_RADIUS, closestOnSegment, findSpawn,
  isWalkable, makeObstacle, movePlayer, movementVector, nearestRoad, toLocal, type ExploreArea,
} from "../src/lib/markaz-explore";

const wall = makeObstacle([{ x: 1, z: -10 }, { x: 2, z: -10 }, { x: 2, z: 10 }, { x: 1, z: 10 }]);

test("projection uses the Markaz anchor, north up and east right", () => {
  assert.deepEqual(toLocal(MARKAZ_ORIGIN.latitude, MARKAZ_ORIGIN.longitude), { x: 0, z: -0 });
  assert.ok(toLocal(MARKAZ_ORIGIN.latitude + 0.001, MARKAZ_ORIGIN.longitude).z < -100);
  assert.ok(toLocal(MARKAZ_ORIGIN.latitude, MARKAZ_ORIGIN.longitude + 0.001).x > 100);
});

test("camera-relative movement preserves analog strength and limits diagonal speed", () => {
  assert.equal(Math.hypot(...Object.values(movementVector(1, 1, 0))), 1);
  assert.equal(movementVector(0, 0.5, 0).z, -0.5);
  const east = movementVector(0, 1, -Math.PI / 2);
  assert.ok(Math.abs(east.x - 1) < 0.0001 && Math.abs(east.z) < 0.0001);
});

test("player cannot tunnel through a thin wall, slides along it, and stays inside the boundary", () => {
  const across = movePlayer({ x: 0, z: 0 }, { x: 10, z: 0 }, [wall]);
  assert.ok(across.x <= 1 - PLAYER_RADIUS);
  const along = movePlayer({ x: 0, z: 0 }, { x: 4, z: 4 }, [wall]);
  assert.ok(along.x <= 1 - PLAYER_RADIUS && along.z > 3.9);
  const edge = movePlayer({ x: EXPLORE_RADIUS - 1, z: 0 }, { x: 5, z: 5 }, []);
  assert.ok(Math.hypot(edge.x, edge.z) <= EXPLORE_RADIUS - PLAYER_RADIUS);
});

test("polygon collisions detect interiors, edge clearance, and reject non-finite input", () => {
  assert.equal(isWalkable({ x: 1.5, z: 0 }, [wall]), false);
  assert.equal(isWalkable({ x: 0.8, z: 0 }, [wall]), false);
  assert.equal(isWalkable({ x: 0, z: 0 }, [wall]), true);
  assert.equal(isWalkable({ x: NaN, z: 0 }, []), false);
  assert.deepEqual(closestOnSegment({ x: 4, z: 5 }, { x: 1, z: 2 }, { x: 1, z: 2 }), { x: 1, z: 2 });
});

test("actual snapshot has a clear, nearby road spawn and permits initial walking", () => {
  const area: ExploreArea = JSON.parse(readFileSync(new URL("../public/maps/markaz-area.json", import.meta.url), "utf8"));
  const obstacles = area.buildings.map(b => makeObstacle(b.points));
  assert.ok(area.roads.some(r => r.name === "Jalan Cempaka"));
  for (const road of area.roads) {
    assert.ok(road.points.length >= 2);
    assert.ok(road.points.every(p => Math.abs(p.x) <= 350.01 && Math.abs(p.z) <= 350.01));
  }
  const spawn = findSpawn(area.roads, obstacles);
  assert.ok(spawn);
  assert.ok(isWalkable(spawn.point, obstacles));
  assert.ok(Math.hypot(spawn.point.x, spawn.point.z) < 60, "start near Maktab");
  assert.ok(nearestRoad(spawn.point, area.roads)!.distance < 0.01);
  const direction = movementVector(0, 1, spawn.heading + Math.PI);
  const next = movePlayer(spawn.point, { x: direction.x * 3, z: direction.z * 3 }, obstacles);
  assert.ok(Math.hypot(next.x - spawn.point.x, next.z - spawn.point.z) > 2.9);
});

test("no road spawn is returned if all road points are obstructed", () => {
  assert.equal(findSpawn([{ id: 1, name: "test", width: 2, points: [{ x: 1.5, z: 0 }, { x: 1.5, z: 2 }] }], [wall]), null);
});
