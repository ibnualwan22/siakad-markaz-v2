# Markaz Arabiyah map snapshot

`markaz-area.json` contains a local extract of OpenStreetMap road and building
geometry, © OpenStreetMap contributors, available under the
[Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/1-0/).
See [OpenStreetMap copyright](https://www.openstreetmap.org/copyright).
The derived database is distributed here under the same ODbL license.

Source bounding box: west 112.1798, south -7.75655, east 112.18622, north -7.75014.
Coordinates are projected into local metres, east (+x) and south (+z), from the
`origin` in the JSON. Geometry is rounded to centimetres. Road widths and missing
building heights are illustrative defaults, not surveyed measurements. The map
is not an access-permission or pedestrian-routing dataset.

To refresh, download the small public OSM XML extract through the OSM map API and
run `python3 scripts/import-markaz-map.py /path/to/extract.osm`. Review changes,
spawn placement, and street continuity before publishing. This is a build-time
snapshot: visitors do not call Overpass or the OSM editing API.
