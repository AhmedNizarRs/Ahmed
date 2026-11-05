# DALIL · The door handle that reads

**Idea (one sentence):** A blank door handle gets a DALIL clip with a raised room number and braille, and when the lights fail it keeps glowing, so the viewer understands that the hand finds the room without searching the wall.
**Promise (on screen by 3 s):** "A door handle you can read."
**Hook (0–3 s, sound off):** "A door handle you can read." at 104 px · CTA: `dalil-team.com` at 48 px, on screen from frame 0 and again at the end.
**Terms (shown):** DALIL · braille · raised number
**Audience · channel · how it's watched:** investors, facility managers, accessibility leads · Instagram Reels / TikTok / LinkedIn · muted autoplay on a phone
**Spec:** 1080×1920, 30 fps, 29.33 s (11 bars) = 880 frames · deliverables: MP4 (with score), poster frame

## Benchmark
- *The warm "Claude made this, not Blender" retro-computer reel the user supplied*: learn the warm low-key light through blinds, slow motivated camera, one object as the star · don't take its retro computer, captions style or "comment SKILL" ending.
- *Apple product macro films (e.g. AirTag reveal)*: learn the single-object macro, the snap-into-place beat and the dark end card · don't take their white void or their type.

## Structures considered
1. **Journey along the hand's path** (wall sign → handle → clip → read → blackout → corridor). One continuous space, the handle is the constant.
2. Before/after split screen (blank handle vs clipped handle).
3. Product turntable with feature callouts.
**Chosen:** 1, because DALIL's whole argument is *where the information is* (on the path the hand already takes), which is spatial. Rejected: 2 halves the subject at phone size; 3 is the genre cliché and says nothing about the hand.

## Dials
Clock: designed music grid @ 90 BPM, 4/4, 8 bars · Continuity: journey, with two motivated cuts · Register: clean/premium (springs ζ 0.75–0.9, no grain, no particles; bloom only on the glow because the glow *is* the product)
Text policy: type as hero, one line per beat · Constant the eye holds: the door handle · Accent = #FFC700 safety yellow means DALIL (the clip); #8BF5B0 glow green appears only when the lights are off
Type: Geist (DALIL brand font) 900 display / 500 body

## Arc
Hook (0–3 s): warm-lit door, "A door handle you can read."
Turn at 19.33 s: the lights die, silence.
Hero moment = payoff at 20.67 s: the clip glows green in the dark (the one native move: the object becomes the light).
Arc quantity: light level on the scene = 100% → 100% → 100% → 100% → 0% → glow only → glow only, many doors.
Ending answers the opening by a reveal of scale: the opening is one handle in daylight; the end is a dark corridor where every handle still reads.
Actions that must be seen: the clip sliding onto the lever and snapping; the number rising; the braille dots rising; the lights going out; the glow.
Missing inputs: no CAD of the door clip → procedural stand-in modelled on the site renders (yellow sleeve on a lever, raised numeral + braille), labelled as an illustration in the report.

## Beat sheet
| # | t | What happens | Reads | Cued to | Camera | Transition out | Sound | Guard |
|---|---|---|---|---|---|---|---|---|
| 1 | 0–3.33 | Door in warm blind-light | hook line, URL | bar 1 | slow push | cut to the wall sign (next step: where info lives today) | pad in | no logo reveal, hook from frame 0 |
| 2 | 3.33–10.0 | Wall sign, then pan down to the bare handle | "The room sign is on the wall." → "Your hand is on the handle." | bar 2, read | pan down-left | continuous | kick enters | hold on sign ≥1 s |
| 3 | 10.0–14.0 | Clip slides on, snaps | "DALIL clips on." "No tools." | snap on beat 11.33 | settle, then slow orbit | cut to top view (closer look) | click on snap | camera still during the snap |
| 4 | 14.0–19.33 | Number rises, braille dots rise cell by cell | "Raised number" → "Braille" → "Room 204" | half-beats | top 3/4 macro push | lights out | ticks per cell | no text over the clip |
| 5 | 19.33–20.67 | Lights die | — | beat 29 | hold | glow | silence | real silence |
| 6 | 20.67–24.67 | Clip glows green | "When the lights fail, it still speaks." | hero hit | slight push | pull back | loudest hit | no glow on anything else |
| 7 | 24.67–29.33 | Pull back: corridor of glowing handles, end card | "Make the existing path speak." · dalil-team.com | bars 10–11 | pull back + swing | end | pad resolves, chime | no drift after the card lands |

## Sound plan
Synthesized from the timeline: warm pad (Dmaj7 → Bm7 → Gmaj7 → A), soft kick from bar 2, click on the snap, one tick per braille cell, thunk + silence at the blackout, low boom + shimmer at the glow (loudest), chime under the end card. Master to −14 LUFS, true peak ≤ −1 dBTP.

## Truth
Claims come from the DALIL site (see FACTS.md). The clip shown is an illustration built in code, not a CAD model. "Room 204" is an example label.

## DECISIONS (autonomous mode)
- DECISION: 9:16 at 1080×1920, because the reference reel and the target feeds are vertical.
- DECISION: 29.33 s (11 bars at 90 BPM): first planned at 8 bars, lengthened because the timeline checker showed five lines under their read time.
- DECISION: no voice-over, because feeds autoplay muted and no voice was supplied; type carries the message.
- DECISION: room number 204 in braille as ⠼⠃⠚⠙ (number sign + b j d), because the site's own example module says "Rooms 201 to 215".
- DECISION: slate-blue door (one tint), warm greige wall, yellow clip as the only accent, after the site's door render.
