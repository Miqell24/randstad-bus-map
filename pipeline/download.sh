#!/usr/bin/env bash
# Downloads input data: the Dutch national GTFS, OSM extracts (Geofabrik),
# MapLibre GL. Everything is cached — re-running only fetches what is missing.
#
# Randstad: gtfs.ovapi.nl publishes the whole Dutch national timetable in one
# bundle, every concession in the country (3167 lines). The map is the western
# wing — Amsterdam, Haarlem, Leiden, Den Haag, Rotterdam — so the scope is a
# precomputed rectangle (pipeline/scope.mjs → data/scope.json) and the OSM
# extracts below cover exactly that rectangle.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p data/gtfs data/osm/tiles web/vendor

# pyosmium does the cutting; it is the one dependency outside Node here.
need_osmium () {
  python3 -c "import osmium" 2>/dev/null && return 0
  echo "brak pakietu osmium — zainstaluj: pip3 install --user osmium" >&2
  return 1
}

# 1) GTFS — the national bundle (rebuilt daily by OVapi)
if [ ! -f data/gtfs/routes.txt ]; then
  echo "== GTFS (Netherlands, OVapi) =="
  curl -fL --retry 3 --max-time 3600 -o data/gtfs-nl.zip "https://gtfs.ovapi.nl/nl/gtfs-nl.zip"
  unzip -o data/gtfs-nl.zip -d data/gtfs
fi

# 1b) scope: which of the 3167 national lines belong on a RANDSTAD map
if [ ! -f data/scope.json ]; then
  node --max-old-space-size=10240 pipeline/scope.mjs
fi

# 2) OSM — from the Geofabrik extracts, not Overpass.
#    Dutch street density over 4 500 km² is more than the public Overpass
#    mirrors will serve. THREE provinces are needed: a boundary runs at
#    4.83 E, right through the frame, and without the Utrecht file the
#    eastern column of tiles came out empty (Woerden, Abcoude, Mijdrecht).
#    pipeline/pbf-tiles.py cuts the tiles out of the .pbf and writes exactly the
#    JSON shape Overpass would have returned (ways with tags, NODE IDS and
#    geometry — buildGraph silently drops ways without el.nodes).
if [ ! -f data/osm/tiles/t25.json ] || [ ! -f data/osm/randstad-rail.json ]; then
  need_osmium
  if [ ! -f data/noord-holland-latest.osm.pbf ]; then
    echo "== Geofabrik noord-holland-latest.osm.pbf =="
    curl -fL --retry 5 --retry-delay 5 -C - --max-time 3600 -o data/noord-holland-latest.osm.pbf \
      "https://download.geofabrik.de/europe/netherlands/noord-holland-latest.osm.pbf"
  fi
  if [ ! -f data/zuid-holland-latest.osm.pbf ]; then
    echo "== Geofabrik zuid-holland-latest.osm.pbf =="
    curl -fL --retry 5 --retry-delay 5 -C - --max-time 3600 -o data/zuid-holland-latest.osm.pbf \
      "https://download.geofabrik.de/europe/netherlands/zuid-holland-latest.osm.pbf"
  fi
  if [ ! -f data/utrecht-latest.osm.pbf ]; then
    echo "== Geofabrik utrecht-latest.osm.pbf =="
    curl -fL --retry 5 --retry-delay 5 -C - --max-time 3600 -o data/utrecht-latest.osm.pbf \
      "https://download.geofabrik.de/europe/netherlands/utrecht-latest.osm.pbf"
  fi
  echo "== cutting OSM tiles out of the extracts =="
  python3 pipeline/pbf-tiles.py
fi

# 3) MapLibre GL (vendored, no CDN at runtime)
if [ ! -f web/vendor/maplibre-gl.js ]; then
  echo "== MapLibre GL =="
  curl -fL --retry 3 -o web/vendor/maplibre-gl.js  https://unpkg.com/maplibre-gl@5.6.1/dist/maplibre-gl.js
  curl -fL --retry 3 -o web/vendor/maplibre-gl.css https://unpkg.com/maplibre-gl@5.6.1/dist/maplibre-gl.css
fi

echo "OK — data ready:"
du -sh data/gtfs data/osm 2>/dev/null || true
