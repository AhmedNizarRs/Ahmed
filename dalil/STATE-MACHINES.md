# DALIL website: state machines

The page in `site/` has several parts that move through states. Before this file, the states were spread over classes, `aria-*` attributes, `dataset` flags and local variables in `site/assets/js/site.js`.

**Rule:** each part now shows its current state in one attribute, `data-state`. It mirrors the existing behaviour and changes nothing visually. Styling still uses the old classes and aria attributes.

**For tests and agents:** read `document.querySelector(selector).dataset.state`. Do not infer state from classes.

## The machines

| Part | Selector | States | Moves |
|---|---|---|---|
| Waitlist form | `#lead-form` | `idle`, `editing`, `invalid`, `sending`, `sent`, `error` | idle → editing (first focus) · editing/invalid/error → invalid (submit with mistakes) · → sending (valid submit) · sending → sent (OK, then goes to /thanks/) · sending → error (network, HTTP error or 15 s timeout) |
| Videos | `#hero-video`, `#film-video`, `#clip-video`, `#hand-video` | `playing`, `paused`, `user-paused` | paused ↔ playing as it scrolls in and out · playing → user-paused (visitor presses pause) · user-paused → playing (visitor presses play) |
| Rail demo | `[data-rail]` | `ready`, `demo`, `exploring`, `dragging` | ready → demo (scrolled into view, motion allowed) · demo → ready (glide ends) · any → exploring (first touch or key) · exploring ↔ dragging (pointer down / up) |
| Lights | `.sight` | `lit`, `dark` | lit ↔ dark (switch). `data-lights` (on/off) is kept and still drives the CSS |
| Tactile grammar filter | `.modules` | `all`, or the rib kind (`info`, `safety`, `end`) | all → kind (press a rib key) · kind → all (press it again) · kind → other kind (press another key) |

## Machines that stay implicit (on purpose)

- **Scroll motion** (`st-on`, `is-pinned`, `has-pan`, `is-scrubbing`, `is-live`, `will-grow`, `is-in`, `reveal`). These are driven by scroll position and the screen size, so they are derived, not stored. A `data-state` would only repeat the scroll position.
- **Arrival source** (`?src=`, kept in `sessionStorage`). One value, set once.
- **Analytics** (live host, Do Not Track). Decided once at load.

## Business machines (in the department files)

| What | Where | States |
|---|---|---|
| Sales lead | `dalil-hq/departments/sales/pipeline.csv`, column `stage` | Target → (the stages the sales agent defines) |
| Content post | `dalil-hq/departments/marketing/content-calendar.csv`, column `status` | Idea → (drafted, approved, posted: `[TO CONFIRM]` the exact words) |

Founders: confirm the allowed `stage` and `status` words so every agent uses the same ones.

## Adding or changing a state

1. Change the code in `site/assets/js/site.js` with `setState(element, "name")`.
2. Update the table above in the same commit.
3. Keep every existing class and aria attribute. Show the founder any change to the site before it goes to main.
