/** Local metres: +x east, +z south. The anchor is Maktab's location in Denah Lokasi. */
export const MARKAZ_ORIGIN = { latitude: -7.753346183321256, longitude: 112.1830098913281 };
export const EXPLORE_RADIUS = 300;
export const PLAYER_RADIUS = 0.36;

export interface PointXZ { x: number; z: number }
export interface ExploreRoad { id: number; name: string; width: number; points: PointXZ[] }
export interface ExploreBuilding { id: number; height: number; points: PointXZ[] }
export interface ExploreArea {
  source: string;
  capturedAt: string;
  roads: ExploreRoad[];
  buildings: ExploreBuilding[];
}
export interface Obstacle {
  points: PointXZ[];
  minX: number; maxX: number; minZ: number; maxZ: number;
}

export function toLocal(latitude: number, longitude: number): PointXZ {
  return {
    x: (longitude - MARKAZ_ORIGIN.longitude) * 111320 * Math.cos(MARKAZ_ORIGIN.latitude * Math.PI / 180),
    z: -(latitude - MARKAZ_ORIGIN.latitude) * 110540,
  };
}

export function closestOnSegment(p: PointXZ, a: PointXZ, b: PointXZ): PointXZ {
  const dx = b.x - a.x, dz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
  return { x: a.x + t * dx, z: a.z + t * dz };
}

export function nearestRoad(p: PointXZ, roads: ExploreRoad[]) {
  let result: { point: PointXZ; distance: number; road: ExploreRoad; heading: number } | null = null;
  for (const road of roads) {
    for (let i = 1; i < road.points.length; i++) {
      const a = road.points[i - 1], b = road.points[i];
      const point = closestOnSegment(p, a, b);
      const distance = Math.hypot(point.x - p.x, point.z - p.z);
      if (!result || distance < result.distance) {
        result = { point, distance, road, heading: Math.atan2(b.x - a.x, b.z - a.z) };
      }
    }
  }
  return result;
}

export function makeObstacle(points: PointXZ[]): Obstacle {
  return { points, minX: Math.min(...points.map(p => p.x)), maxX: Math.max(...points.map(p => p.x)), minZ: Math.min(...points.map(p => p.z)), maxZ: Math.max(...points.map(p => p.z)) };
}

export function isWalkable(p: PointXZ, obstacles: Obstacle[], radius = EXPLORE_RADIUS): boolean {
  if (!Number.isFinite(p.x) || !Number.isFinite(p.z) || Math.hypot(p.x, p.z) > radius - PLAYER_RADIUS) return false;
  for (const o of obstacles) {
    if (p.x < o.minX - PLAYER_RADIUS || p.x > o.maxX + PLAYER_RADIUS || p.z < o.minZ - PLAYER_RADIUS || p.z > o.maxZ + PLAYER_RADIUS) continue;
    let inside = false;
    for (let i = 0, j = o.points.length - 1; i < o.points.length; j = i++) {
      const a = o.points[i], b = o.points[j];
      if ((a.z > p.z) !== (b.z > p.z) && p.x < (b.x - a.x) * (p.z - a.z) / (b.z - a.z) + a.x) inside = !inside;
      const q = closestOnSegment(p, a, b);
      if (Math.hypot(q.x - p.x, q.z - p.z) < PLAYER_RADIUS) return false;
    }
    if (inside) return false;
  }
  return true;
}

/** Sample road centres, avoiding invalid spawns when source geometries overlap. */
export function findSpawn(roads: ExploreRoad[], obstacles: Obstacle[]) {
  const candidates: { point: PointXZ; heading: number }[] = [];
  const nearest = nearestRoad({ x: 0, z: 0 }, roads);
  if (nearest) candidates.push(nearest);
  for (const road of roads) {
    for (let i = 1; i < road.points.length; i++) {
      const a = road.points[i - 1], b = road.points[i];
      const steps = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 2);
      for (let j = 0; j <= steps; j++) {
        const t = j / (steps || 1);
        candidates.push({ point: { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }, heading: Math.atan2(b.x - a.x, b.z - a.z) });
      }
    }
  }
  candidates.sort((a, b) => Math.hypot(a.point.x, a.point.z) - Math.hypot(b.point.x, b.point.z));
  return candidates.find(c => isWalkable(c.point, obstacles)) ?? null;
}

/** Camera yaw describes the direction from player to camera; forward walks away from it. */
export function movementVector(right: number, forward: number, yaw: number): PointXZ {
  const length = Math.max(1, Math.hypot(right, forward));
  return { x: (right * Math.cos(yaw) - forward * Math.sin(yaw)) / length, z: (-right * Math.sin(yaw) - forward * Math.cos(yaw)) / length };
}

/** Substeps prevent tunnelling; independent axes allow sliding along walls. */
export function movePlayer(from: PointXZ, delta: PointXZ, obstacles: Obstacle[], radius = EXPLORE_RADIUS): PointXZ {
  const steps = Math.max(1, Math.ceil(Math.hypot(delta.x, delta.z) / 0.2));
  let p = { ...from };
  for (let i = 0; i < steps; i++) {
    const x = { x: p.x + delta.x / steps, z: p.z };
    if (isWalkable(x, obstacles, radius)) p = x;
    const z = { x: p.x, z: p.z + delta.z / steps };
    if (isWalkable(z, obstacles, radius)) p = z;
  }
  return p;
}
