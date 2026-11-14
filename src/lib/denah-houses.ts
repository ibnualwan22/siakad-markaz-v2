import { closestOnSegment, makeObstacle, type ExploreArea, type ExploreBuilding, type PointXZ } from "./markaz-explore";

/** Distance from the road's outer edge, allowing a small front yard. */
export const HOUSE_ROAD_SETBACK = 4;

function segmentDistanceSquared(a: PointXZ, b: PointXZ, c: PointXZ, d: PointXZ) {
  const cross = (p: PointXZ, q: PointXZ, r: PointXZ) => (q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x);
  const boundsOverlap = Math.max(a.x, b.x) >= Math.min(c.x, d.x) && Math.max(c.x, d.x) >= Math.min(a.x, b.x)
    && Math.max(a.z, b.z) >= Math.min(c.z, d.z) && Math.max(c.z, d.z) >= Math.min(a.z, b.z);
  if (boundsOverlap && cross(a, b, c) * cross(a, b, d) <= 0 && cross(c, d, a) * cross(c, d, b) <= 0) return 0;
  const squared = (p: PointXZ, q: PointXZ) => (p.x - q.x) ** 2 + (p.z - q.z) ** 2;
  return Math.min(squared(a, closestOnSegment(a, c, d)), squared(b, closestOnSegment(b, c, d)),
    squared(c, closestOnSegment(c, a, b)), squared(d, closestOnSegment(d, a, b)));
}

/** Test footprint edges instead of centres, including bends and short road segments.
 * Called once per layer; not during animation or pointer interaction.
 */
export function roadsideBuildingIds(area: ExploreArea) {
  const segments = area.roads.flatMap(road => road.points.slice(1).map((b, i) => {
    const a = road.points[i], reach = road.width / 2 + HOUSE_ROAD_SETBACK;
    return { a, b, reach, minX: Math.min(a.x, b.x) - reach, maxX: Math.max(a.x, b.x) + reach,
      minZ: Math.min(a.z, b.z) - reach, maxZ: Math.max(a.z, b.z) + reach };
  }));
  const ids = new Set<number>();
  for (const building of area.buildings) {
    const bounds = makeObstacle(building.points);
    const roadside = segments.some(segment => {
      if (bounds.maxX < segment.minX || bounds.minX > segment.maxX || bounds.maxZ < segment.minZ || bounds.minZ > segment.maxZ) return false;
      return building.points.some((a, i) => segmentDistanceSquared(a, building.points[(i + 1) % building.points.length], segment.a, segment.b) <= segment.reach ** 2);
    });
    if (roadside) ids.add(building.id);
  }
  return ids;
}

/** Align each replacement with the longest footprint edge, keeping a small setback.
 * These same dimensions drive rendering, selection and walking collision.
 */
export function housePlacement(building: ExploreBuilding) {
  let rotation = 0, longest = 0;
  building.points.forEach((a, i) => {
    const b = building.points[(i + 1) % building.points.length];
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    if (length > longest) { longest = length; rotation = Math.atan2(-(b.z - a.z), b.x - a.x); }
  });
  const c = Math.cos(rotation), s = Math.sin(rotation);
  const local = building.points.map(p => ({ x: p.x * c - p.z * s, z: p.x * s + p.z * c }));
  const minX = Math.min(...local.map(p => p.x)), maxX = Math.max(...local.map(p => p.x));
  const minZ = Math.min(...local.map(p => p.z)), maxZ = Math.max(...local.map(p => p.z));
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
  const x = cx * c + cz * s, z = -cx * s + cz * c;
  const width = Math.max(0.1, (maxX - minX) * 0.90), depth = Math.max(0.1, (maxZ - minZ) * 0.90);
  const height = building.height;
  const points: PointXZ[] = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => ({
    x: x + a * width / 2 * c + b * depth / 2 * s,
    z: z - a * width / 2 * s + b * depth / 2 * c,
  }));
  return { id: building.id, x, z, width, depth, height, rotation, variant: building.id % 3, obstacle: makeObstacle(points) };
}
