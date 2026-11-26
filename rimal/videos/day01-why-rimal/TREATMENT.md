# Day 1 — Why we're called "Rimal"

**Idea (one sentence):** The word رمال turns into sand, the sand settles into a dune, and the dune's lines straighten into a room. That shows the viewer that Rimal's tools do the small repeated moves so their time goes into the design.
**Promise (on screen by 3 s):** "This word means sand." (a tagline, not a factual claim)
**Hook (0–3 s, sound off):** رمال at 340 px in gold, "This word means sand." at 96 px, "Rimal" at 64 px, and "@rimalinterior" at 48 px (CTA). All of it is on frame 0.
**Terms (shown; the film has no voice):** Rimal Interiors · AutoCAD · Revit
**Audience · channel · how it's watched:** architects, interior designers and students · Instagram Reels · muted autoplay on a phone
**Spec:** 1080×1920, 30 fps, 30 s = 900 frames · deliverables: master MP4, no-music MP4, poster still, caption text

## Benchmark
- **Saul Bass title sequences** (e.g. *Vertigo*, *Anatomy of a Murder*). Learn: one graphic element keeps changing what it means. Don't take: their shapes, colours or type.
- **Islamic geometric construction drawings** (compass and straightedge plates). Learn: lines appear in construction order, and the pattern arrives as a drawn process rather than a fade. Don't take: any specific historical pattern used as a logo.

## Structures considered
1. **Morph chain: word → sand → dune → plan → pattern → sand → logo.** One material changes role in every scene, which matches the meaning of the name.
2. **Dictionary entry:** a definition card, followed by three examples (dunes, interiors, tools) on cuts.
3. **Before/after split:** a designer redrawing by hand vs. a tool, with the dune only as background.

**Chosen:** 1. The name *is* the material, so the film is made of it. Rejected: 2 is a slideshow with three unlinked worlds. 3 is a timing claim we have no measured numbers for.

## Dials
- **Clock:** music grid, designed at 80 BPM in 4/4 (bar = 3.0 s, 10 bars).
- **Continuity:** morph chain with no hard cuts.
- **Register:** clean/premium, warm. Springs ζ 0.8–1.0, no glow, no grain. 30 fps, chosen because the motion is slow and contemplative with no whips.
- **Text policy:** type as hero. One line at a time, top third.
- **Constant:** the grains/lines. The same material is always on screen.
- **Accent:** `--gold-hi #e6bd76` means "the idea / the design itself". It is used on رمال at the open, the mashrabiya at the hero, and the logo at the end. Everything else uses ink `#efe4d2` or dune-line `#a88454` on cocoa-black `#120c09`.
- **Type roles:** Reem Kufi (Arabic display) · Marcellus (Latin display) · Jost (UI/handle) · JetBrains Mono (labels as texture). These are the site's own fonts.

## Arc
- **Hook (0–3 s):** the word and its meaning, already on frame 0.
- **Turn at 12.75 s:** the dune lines straighten into a floor plan.
- **Hero = payoff at 21.0 s:** after one beat of silence, a gold 8-point-star mashrabiya draws itself on the feature wall while the camera pushes in. This is the human design part, done by hand, after the tool did the repeats.
- **Arc quantity:** how ordered the material is: loose grains (0) → dune curves (1) → straight plan lines (2) → repeated blocks (3) → one gold pattern (4).
- **Ending answers the opening by rhyme:** it opened with the word becoming sand, and it ends with the sand becoming the Rimal dunes mark.
- **Actions that must be seen:** letters dissolving into grains; grains settling on dune lines; dune lines bending straight into walls; furniture blocks stamping in faster and faster; the gold pattern drawn stroke by stroke; grains landing on the logo.
- **Missing inputs:** no track, so a designed grid with a score synthesized from the timeline. No VO; the film is muted-first.

## Beat sheet
| # | t | What happens | Reads | Cued to | Camera | Out (+ reason) | Sound | Guard |
|---|---|---|---|---|---|---|---|---|
| 1 | 0–6 | رمال + "This word means sand." + Rimal + handle; 1.5 s: "And it's the whole idea behind our tools." | word → meaning → idea | bar 0, beat 2 | 1% creep | Letters become grains (shape morph) | pad + oud-like pluck motif | No fade-in on frame 0 |
| 2 | 6–12 | Letters dissolve into ~5k grains that blow down and settle into dune ridges; 9.0 s: grains slide into continuous contour lines. Text: "Dunes are shaped by thousands of small, patient moves." | grains → dune → line | bar 2, bar 3 | none | Dune lines bend straight (shape morph) | sand pour driven by grain speed, frame-drum dum on bars | Never a particle burst; grains travel along a wind field and land |
| 3 | 12–15 | "Good interiors are too." Dune lines straighten into a floor plan (walls, arch, door swing, window) | lines → room | bar 4, beat 2 | none | Plan stays, blocks arrive (next step) | soft whoosh on the morph | Morph through the same ink colour, no colour blend |
| 4 | 15–21 | "Our tools take the repeated moves." Furniture blocks stamp in, intervals 0.75 → 0.375 → 0.1875 s | repeats accelerate | beats | none | Silence, then hero (cause → effect) | wood ticks stepping down; riser; hard stop at 20.25 | Ticks alternate 2 samples, never the same twice |
| 5 | 21–24.75 | Gold mashrabiya draws on the top wall; camera pushes in 1.0 → 1.18. "So your time goes into the design." | pattern → meaning | bar 7 downbeat | push-in | Strokes break into grains (shape morph) | impact + sub + Hijaz chord (loudest) | No glow on gold, just a clean stroke |
| 6 | 24.75–30 | All lines break into grains that fly onto the dunes logo; logo, "Rimal Interiors", "Tools for AutoCAD · Revit · SketchUp · 3ds Max", "@rimalinterior · link in bio" | brand → what → where | bar 8 | settle | end | sand sweep, pluck resolves to D, chord tail | Wordmark holds ≥ 2 s completely still |

## Sound plan
- **Source:** synthesized in numpy from the timeline: a pad drone in D, Karplus-Strong plucks in the D Hijaz scale (oud-like), frame drum, sand noise and wood ticks.
- **Silence:** 20.25–21.0 s. **Loudest hit:** 21.0 s (payoff).
- **Score growth:** the drone, then the pluck motif, then drums plus sand, then a full pattern with ticks and a riser. Hard stop, impact, then resolution.
- **Master:** −14 LUFS, true peak ≤ −1 dBTP.

## Truth
- **On-screen numbers:** none. The software names are what the store sells (`rimal/assets/js/app.js`).
- **Illustrative elements:** the plan and furniture are drawn icons, not a real project, and they make no claim.
- **Not claimed:** any time saved, any number of users, any feature.

## Risks / least sure about
- Whether the grain dissolve reads as "sand" at phone size (density vs. 360 px).
- The 30 s length is at the long end for a Day-1 intro Reel.

## DECISIONS (autonomous mode)
- DECISION: 30 fps instead of the clean preset's 60, because the motion is slow, with no fast whips needing subframe blur, and it halves render time.
- DECISION: no voice-over, because the plan says captions in Arabic and English, the film is muted-first, and a voice can be added later from the same timeline.
- DECISION: English copy on screen with رمال as the Arabic hero word. An Arabic-copy version can be rendered from the same timeline after a native-speaker check.
- DECISION: an 80 BPM designed grid, because 60–80 BPM reads as calm and regal, matching the patient-dunes idea.
- DECISION: the handle sits on frame 0 as the CTA, and returns with "link in bio" at the end.
