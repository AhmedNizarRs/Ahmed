# Map and data providers

Checked 2026-11-14 on each provider's own pages. Re-check terms before launch.

## Street and satellite maps ("Getting here")

The app tries the providers in order and moves to the next when one fails: its style can't be fetched, or
three of its tiles fail before any arrives. It ends on a **plain map** that needs no internet and still shows
the building outline, walls and entrances. The visitor can also pick one in Settings or on the Getting here
page. Code: `app/providers.js`; order and keys in `app/config.json` (`maps.order`, `maps.keys`).

| Provider | Styles in DALIL | Key | Commercial use (provider's terms) | Attribution |
|---|---|---|---|---|
| **OpenFreeMap** | Liberty (light), Positron recoloured (dark) | None | Allowed: "no limits… no registration… no API keys" | OpenFreeMap © OpenMapTiles, data © OpenStreetMap (shown by MapLibre) |
| **VersaTiles** | Colorful, Colorful dark (`tiles.versatiles.org/assets/styles/…/style.json`) | None | Free and open public tile server, "free of any commercial interests" | © OpenStreetMap contributors |
| **Esri** (ArcGIS Location Platform) | Imagery (satellite), Navigation / Navigation night (Basemap Styles v2) | Building's key (`token`) | Free tier for basemap and image tiles with an account | "Powered by Esri" (added by DALIL) + data credits |
| **MapTiler** | Streets v2 (light/dark), Hybrid (satellite) | Building's key | The Free plan is **non-commercial** ("non-commercial use and research & development"). A client needs Flex or above | © MapTiler © OpenStreetMap |
| **Stadia Maps** | Alidade Smooth (light/dark) | Key, or the site's domain registered with Stadia | Free plan does **not** allow commercial use; Starter plan or above | © Stadia Maps © OpenMapTiles © OpenStreetMap |
| **Mapbox** | Streets v12, Dark v11, Satellite Streets v12 (Static Tiles API, as raster tiles) | Building's token | Free tier, then pay as you go | © Mapbox © OpenStreetMap |

Not used: OpenStreetMap's own tile server (policy bans offline use and may withdraw access for commercial
apps), Protomaps' hosted tiles (non-commercial; their downloads are fine to self-host later), Google Maps
tiles (paid per use; could be added for a client who wants them). Google and Apple Maps are still used
for **directions to the entrance** (links that open their apps).

Default order for a new client: OpenFreeMap, VersaTiles, then any keyed provider the client brings. Keys in a
web app are public: restrict each one to the client's web address in the provider's dashboard.

## Other data

| Need | Provider | Cost / key | Licence and rules | Where in DALIL |
|---|---|---|---|---|
| Map renderer | **MapLibre GL JS 4.7.1** | Free, open source | BSD-3, bundled in `app/vendor/maplibre/`, loaded only for Getting here | App: Getting here |
| QR reading | Browser **BarcodeDetector**, else **jsQR 1.4.0** | Free | jsQR: Apache-2.0, bundled in `app/vendor/jsqr/` | App: Where are you, camera mode |
| Building outlines, height, floors | **Overture Maps** buildings (release 2026-10-21) | Free download (GeoParquet) | ODbL; sources OSM, Microsoft, Google Open Buildings, Esri Community Maps | Mapper workflow (`georef.py`), stored as `building_context` |
| Real position of the plan | The building's **CAD coordinates** or **two control points** in the Mapper | Free | — | Map files: `geo` |
| Phone location outdoors | Browser **Geolocation** | Free | Asked only when the visitor taps "Show my location" | Getting here, distance hint on Home |
| Direction and steps indoors | Phone **compass and accelerometer** (DeviceOrientation / DeviceMotion) | Free | Asked on Start; nothing leaves the phone | Directions (moving arrow, camera line) |

## Considered and not used (or not yet)

| Provider | Why not now |
|---|---|
| Nominatim (address search) | Max 1 request/second, no search-as-you-type. Fine for the Mapper team, not for visitors. |
| Overture "places" | Shop and business points (CDLA Permissive 2.0, Apache 2.0, CC0); useful later to name cafés and shops in malls. |
| Public routing servers (OSRM demo and similar) | Not for production. Walks between buildings: self-host later, or hand off to Google/Apple Maps (done). |
| Indoor positioning services (BLE beacons, paid SDKs) | Hardware and batteries to maintain. DALIL uses signs/tags plus phone sensors instead. |
| UAE government GIS portals (Sharjah, Dubai) | Not checked yet. Official outlines and addresses could be more accurate for UAE sites. `[TO CONFIRM]` |

## How layering works

1. Every floor map can carry `geo`: the longitude and latitude of plan point (0, 0), the bearing of the plan's "up" from true north, and a scale (about 1.000).
2. The Mapper's **World position** step computes it from two known points; a CAD in a survey coordinate system gives it exactly (`georef.py`).
3. The app turns walls, entrances and the outline into longitude/latitude and draws them over whichever street map is showing.
4. The same `geo.bearing` gives the moving arrow its starting compass angle (`motion-and-camera.md`).

**Accuracy on the test building (Kennedy Library):** Overture's outline corners sit a median **2.3 m** from ours; Level 2 fits Level 1 on 7 lifts and stairs with a median error of **1.0 m**; the two-point method reproduces the survey position to **1 mm**.

## Licence notes (for a lawyer to confirm)

- **ODbL** (Overture buildings, OpenStreetMap): attribution required; a published database containing this data (e.g. outlines inside map files) must stay available under ODbL. The client's floor plans stay the client's and DALIL's.
- Show attributions on screen (the Getting here map does).

## Not testable in this cloud environment

This environment blocks the tile servers, so real street tiles could not be seen here. Failover was tested
with stand-in responses (OpenFreeMap down → VersaTiles; both down → plain map; Mapbox tiles refused →
VersaTiles). On a phone or laptop with internet, the street map loads.
