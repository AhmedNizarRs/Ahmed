# Setting up DALIL for an institution

What the DALIL team does for each client site after the floors are mapped in the Mapper.

## 1. Files to deploy

Publish `app/` and `data/` side by side on an **HTTPS** host (camera, motion sensors, NFC and the offline
cache only work on HTTPS). List the client's floors in `app/maps.json`, bottom floor first. Make the host
serve `app/index.html` for `/t/<building>/<floor>/<point>` (the URL written on tags and signs).

## 2. `app/config.json`

| Field | What it does | Leave empty when |
|---|---|---|
| `institution.name`, `nameAr` | Shown above "Where do you want to go?" | You only want the building name |
| `help.phone`, `label`, `labelAr` | "Call Reception · +971 …" in Help (a `tel:` link) | The client has no public number; Help then says to ask any member of staff. **Never put a made-up number.** |
| `buildings.<building-id>.help` | A different help number per building | One number for the whole site |
| `maps.order` | Street maps to try first, e.g. `["openfreemap", "versatiles"]` | Keep the default |
| `maps.keys.esri / maptiler / stadia / mapbox` | Turns on that provider (satellite and street styles) | The client has no account with it |
| `maps.stadiaDomainAuth` | Stadia by registered domain instead of a key | Not using Stadia |
| `analytics.endpoint` | Where anonymous usage counts are sent (POST JSON) | Off by default; turn on only with the client's privacy approval |
| `features.camera`, `features.motion` | Switch the camera line or motion tracking off for a site | Keep `true` |

Keys in a web app are public: in each provider's dashboard restrict the key to the client's web address.
Terms per provider (commercial use, attribution) are in `data-providers.md`; re-check them before launch.

## 3. Signs and tags (where DALIL knows your position exactly)

- Every DALIL node gets a sign with a **QR code** and an **NFC tag**, both holding the node's URL from the
  Mapper's NFC CSV (`…/t/<building>/<floor>/<point>`). iPhones read the QR (camera); Android reads both.
- Put signs at entrances, lift lobbies (outside the shaft), stair doors and main junctions; keep straight runs
  between signs under about 40 m so the moving arrow stays accurate.
- Set each node's facing in the Mapper (the direction a person faces when reading the sign).

## 4. World position (makes the arrow right from the first step)

In the Mapper's World position step, enter two points with known latitude/longitude (or use the CAD's survey
coordinates). Without it the arrow still works, but only after the visitor's first few steps.

## 5. Usage counts (if the client turns them on)

Events: `open`, `search_none` (the words of a search that found nothing, max 40 characters), `route`
(destination id, category), `nav_start`, `nav_stop` (step reached), `arrive` (seconds taken), `help`, `tag`,
`reroute`. Each has the building, floor, language and the hour (time rounded down to the hour). No device id,
no names, no positions, no IP stored by the app. Batches are sent with `navigator.sendBeacon` when the app is
hidden or every 20 events. The facility dashboard (business model #2) will read these.
The client's privacy notice should mention them. The app's Settings → About says so when an endpoint is set.

## 6. Kiosk screens

Open `…/app/#kiosk&at-<point>` on a fixed tablet: fixed start point, QR to continue on a phone, no camera,
resets after 90 s idle.

## 7. Before go-live checklist

- [ ] All floors load; every destination has a route; step-free gaps are listed for the site visit.
- [ ] Signs installed and each one scanned once on site (the app says "Confirmed: you are at …").
- [ ] Field test from `motion-and-camera.md` done on one Android and one iPhone.
- [ ] Arabic names checked by a native speaker.
- [ ] Help number and privacy wording approved by the client.
- [ ] Wording reviewed: DALIL is a supplementary aid, not for emergencies, no compliance claims.
