# Randstad Public Transport — interactive map

Interactive, poster-grade map of the public transport of the **western
Randstad** — Amsterdam, Haarlem, Leiden, Den Haag and Rotterdam, with
Zaanstad, Purmerend, Schiphol, Amstelveen, Delft, Zoetermeer, Gouda, Alphen
aan den Rijn and Dordrecht in the same frame: the buses of a dozen concessions,
three separate tram networks and two unrelated metros, drawn along the real
street and track geometry.

## Live

Local build on port 8163 (`npm run serve`).

Everything comes from ONE feed — the **Dutch national GTFS**
(<https://gtfs.ovapi.nl/nl/gtfs-nl.zip>), every concession in the country,
3167 lines, rebuilt daily by OVapi. The Randstad is not a city with a radius
but a 75 km string of five, so the scope is a precomputed **rectangle**
(`pipeline/scope.mjs` → `data/scope.json`):

* core **51.78–52.52 N, 4.10–5.05 E** — a line is in when ≥50% of its stops
  fall inside;
* outer frame **51.68–52.60 N, 3.95–5.08 E** — no stop may fall outside it.

The outer frame is the map's frame *and* the extent of the OSM extracts, so no
stop can land outside the tiles that were cut. It also draws the line at the
Randstad's western wing: the tails to Utrecht (5.11 E) and Hilversum (5.18 E)
— the eastern wing, a separate agglomeration — are out.

| mode | route_type | in the frame | graph |
|---|---|---|---|
| buses | 3 | GVB, HTM, RET, Connexxion, Qbuzz, EBS, MeerPlus, Transdev, U-OV, Arriva | OSM roadways |
| trams | 0 | GVB Amsterdam, HTM Den Haag (RandstadRail 3 and 4 included), RET Rotterdam | `tram` + `light_rail` |
| metro | 1 | GVB 50–54 and RET A–E, colours from the feed | `subway` + `light_rail` |

Cut deliberately:

* **the trains** (route_type 2). NS names every one of them only "Intercity" or
  "Sprinter" and keeps the series number (SPR4000) internal — it is on no
  platform sign — so there is nothing to draw and label. The same call
  Göteborg's "TÅG" got;
* **the ferries** (4) — GVB's F1–F22 across the IJ and the Waterbus to
  Dordrecht; the engine has no water graph;
* **83 "Stopbus/Snelbus ipv trein"** rail replacements (Budapest's *pótló*
  rule) and **33 dial-a-ride runs** — U-Flex, BestelBuzz, HopOn, OV op Maat;
* the **Electrische Museumtramlijn Amsterdam**, a heritage line, not a network.

**Line keys.** Three tram networks and a dozen bus concessions all number from
1: "tram 1" is a different line in Amsterdam, Den Haag and Rotterdam, and 197
bus numbers are shared by two operators or more. They share no pavement, so
nothing prints twice on any street, but in one file they need different keys.
A number used by more than one operator carries that operator's code in the KEY
(`gvb:1`, `htm:1`, `ret:1`) and prints bare through `LBL` — the Rybnik rule.
The line panel is grouped by concession, so the three "1" sit under three
headings, and every chip carries its terminals as a tooltip.

## Pipeline

`npm run download` fetches the national feed, computes the scope, and cuts the
OSM extracts. **The OSM data comes from Geofabrik, not Overpass**: Dutch street
density over 4 500 km² is more than the public mirrors will serve.
`pipeline/pbf-tiles.py` (needs `pip3 install --user osmium`) cuts a 5 × 5 grid
out of **three** provincial extracts — Noord-Holland, Zuid-Holland *and*
Utrecht: a province boundary runs at 4.83 E, right through the frame, and
without the third file the eastern column of tiles came out empty (Woerden,
Abcoude, Mijdrecht).

`npm run build` map-matches every line (HMM/Viterbi on the OSM graphs) and
writes GeoJSON to `data/out/`; `npm run lines` adds the line-by-line view.
`npm run serve` hosts the map at <http://localhost:8163>.

Data: OVapi national GTFS (CC0) ·
base map © OpenFreeMap / OpenMapTiles / OpenStreetMap contributors.
