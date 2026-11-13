"""Convert a public OSM XML extract into the small, attributed 3D area snapshot.

Usage: python3 scripts/import-markaz-map.py /tmp/markaz.osm
Source: https://www.openstreetmap.org/api/0.6/map?bbox=112.1798,-7.75655,112.18622,-7.75014
Only road/footprint geometry and public road names are retained; no OSM user metadata.
"""
import datetime
import json
import math
import pathlib
import sys
import xml.etree.ElementTree as ET

ORIGIN = (-7.753346183321256, 112.1830098913281)
EXTENT = 350
root = ET.parse(sys.argv[1]).getroot()
nodes = {}
for node in root.findall("node"):
    nodes[node.get("id")] = {
        "x": round((float(node.get("lon")) - ORIGIN[1]) * 111320 * math.cos(math.radians(ORIGIN[0])), 2),
        "z": round(-(float(node.get("lat")) - ORIGIN[0]) * 110540, 2),
    }


def clip_segment(a, b):
    """Liang–Barsky clipping keeps long OSM ways inside the scenery square."""
    dx, dz = b["x"] - a["x"], b["z"] - a["z"]
    lo, hi = 0, 1
    for p, q in [(-dx, a["x"] + EXTENT), (dx, EXTENT - a["x"]), (-dz, a["z"] + EXTENT), (dz, EXTENT - a["z"])]:
        if p == 0:
            if q < 0:
                return None
        elif p < 0:
            lo = max(lo, q / p)
        else:
            hi = min(hi, q / p)
    if lo > hi:
        return None
    return [{"x": round(a["x"] + t * dx, 2), "z": round(a["z"] + t * dz, 2)} for t in (lo, hi)]


widths = {"secondary": 8, "tertiary": 6, "residential": 4.5, "living_street": 3.5, "service": 3, "path": 1.8, "footway": 1.8, "track": 2.5}
roads, buildings = [], []
for way in root.findall("way"):
    tags = {tag.get("k"): tag.get("v") for tag in way.findall("tag")}
    refs = [nd.get("ref") for nd in way.findall("nd")]
    if any(ref not in nodes for ref in refs):
        continue
    points = [nodes[ref] for ref in refs]
    kind = tags.get("highway")
    if kind in widths and tags.get("access") not in ("no", "private"):
        # Store continuous clipped runs; disconnected segments must not become fake shortcuts.
        runs = []
        for a, b in zip(points, points[1:]):
            segment = clip_segment(a, b)
            if not segment:
                continue
            if runs and runs[-1][-1] == segment[0]:
                runs[-1].append(segment[1])
            else:
                runs.append(segment)
        for run in runs:
            roads.append({"id": int(way.get("id")), "name": tags.get("name", "Jalan sekitar Markaz"), "width": widths[kind], "points": run})
    if "building" in tags and tags["building"] != "no" and len(points) >= 4 and refs[0] == refs[-1]:
        if not any(abs(p["x"]) < EXTENT and abs(p["z"]) < EXTENT for p in points):
            continue
        try:
            height = float(tags.get("height", "").replace(" m", "")) if tags.get("height") else float(tags.get("building:levels", "1")) * 3.2
        except ValueError:
            height = 3.2
        buildings.append({"id": int(way.get("id")), "height": round(max(2.8, min(24, height)), 1), "points": points[:-1]})

if not roads:
    raise SystemExit("No roads found; existing snapshot was not changed.")
payload = {"source": "https://www.openstreetmap.org/copyright", "license": "ODbL-1.0", "capturedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(), "origin": {"latitude": ORIGIN[0], "longitude": ORIGIN[1]}, "roads": roads, "buildings": buildings}
output = pathlib.Path(__file__).resolve().parents[1] / "public/maps/markaz-area.json"
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(payload, separators=(",", ":")))
print(f"Saved {len(roads)} roads and {len(buildings)} footprints ({output.stat().st_size} bytes)")
