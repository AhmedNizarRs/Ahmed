# Map and data providers (free)

Checked 2026-11-14 on each provider's own pages. Re-check terms before launch.

## What DALIL uses

| Need | Provider | Cost / key | Licence and rules | Where in DALIL |
|---|---|---|---|---|
| Map renderer | **MapLibre GL JS 4.7.1** | Free, open source | BSD-3. Bundled in `app/vendor/maplibre/` (loaded only when "Getting here" opens) | App: Getting here |
| Street map (vector tiles) | **OpenFreeMap** (`tiles.openfreemap.org/styles/positron`) | Free, commercial use allowed, "no limits… no registration… no API keys" | Attribution required: OpenFreeMap © OpenMapTiles, data from OpenStreetMap. MapLibre shows it automatically | App: Getting here (light style; the app darkens it for the dark theme) |
| Building outlines, height, floor count | **Overture Maps Foundation** buildings (release 2026-10-21) | Free download (GeoParquet on S3) | ODbL. Sources: OpenStreetMap, Microsoft ML Buildings, Google Open Buildings, Esri Community Maps. Attribution shown in the app | Mapper workflow (one-off per building): `data/test-calpoly-library/georef.py`; stored in map files as `building_context` |
| Real position of the plan | The building's own **CAD coordinates** (when drawn in a survey system) or **two control points** typed in the Mapper | Free | — | Map files: `geo` |
| Getting to the entrance | **Google Maps / Apple Maps** links | Free | Opens their app; no data kept by DALIL | App: Getting here |
| Phone location outdoors | Browser **Geolocation** (GPS) | Free | Asked only when the visitor taps "Show my location" | App: Getting here, distance hint on home |

## Considered and not used (or not yet)

| Provider | Why not now |
|---|---|
| OpenStreetMap's own tile server | Its policy bans offline use and says access "may be withdrawn at any point" for commercial services. OpenFreeMap serves the same data without those limits. |
| Nominatim (address search) | Max 1 request/second, no search-as-you-type, results must be cached. Fine for the Mapper team looking up an address once, not for visitors. |
| Overture "places" | Shop/business points from Meta, Microsoft, Foursquare and others (CDLA Permissive 2.0, Apache 2.0, CC0). Useful later to name cafés and shops in malls; indoor names still come from the building. |
| Public routing servers (OSRM demo and similar) | Not meant for production. For campus walking routes between buildings, self-host later or hand off to Google/Apple Maps (done). |
| Indoor positioning services | Need beacons or paid SDKs. DALIL's tags + step-by-step stay the approach; phone motion sensors are the next step. |
| UAE government GIS portals (Sharjah, Dubai) | Not checked yet. Official building outlines and addresses there could be more accurate for UAE sites. `[TO CONFIRM]` |

## How layering works

1. Every floor map can carry `geo`: the longitude and latitude of plan point (0, 0), the bearing of the plan's "up" from true north, and a scale (should be about 1.000).
2. The Mapper's **World position** step computes it from two points you know on the ground. If the CAD is already in a survey coordinate system, it can be computed exactly (see `georef.py`).
3. The app turns walls, entrances and the building outline into longitude/latitude and draws them over the street map.

**Accuracy on the test building (Kennedy Library):** Level 1 placed from the CAD's survey coordinates. Overture's independent outline corners sit a median **2.3 m** from our outline. Level 2 placed by matching 7 lifts and stairs to Level 1, median error **1.0 m**. The Mapper's two-point method reproduces the survey position to **1 mm** at the main entrance.

## Licence notes (for a lawyer to confirm)

- **ODbL** (Overture buildings, OpenStreetMap): attribution required. If DALIL publishes a database that contains this data (for example building outlines inside map files), that part must stay available under ODbL. Our own floor plans are separate and remain the client's and DALIL's.
- Show attributions on screen; the app does this on the Getting here map.

## Not testable in this cloud environment

This environment's network blocks `tiles.openfreemap.org`, so the street map itself could not be seen here. The app then falls back to a plain background with the building, entrances and your location, and says the street map needs internet. On a phone or laptop with internet, the street map loads.
