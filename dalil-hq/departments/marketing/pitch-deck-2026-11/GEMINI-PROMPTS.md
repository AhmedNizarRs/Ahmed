# DALIL sticker: Gemini render pack

Use these prompts in **Gemini (image generation and editing, "Nano Banana")** to turn the reference renders into professional photographs for the pitch deck and the website.

The reference renders in `gemini-references/` are built from the real STL files, so their geometry is correct. Gemini's only job is to make each scene look photographed. **It must never redesign the sticker.**

## How to use it

1. Open a new Gemini chat for each image, so the rules are not lost.
2. **Upload the reference render first** (REF-1 to REF-5 below). If you have a real photo of the place, for example a University of Sharjah corridor, a door or a stair, upload it second.
3. Paste the **Lock block**, then the **Space block**, then the scene prompt.
4. Ask for a 16:9 image for slides or 4:5 for social posts.
5. **Check every result against the reference** before you use it (checklist at the end). If anything changed, reply with the **Fix-up prompt**.
6. Generate 3 to 4 versions of each scene and keep the most faithful one, not the prettiest.

## The reference images

| File | Shows | Use for |
|---|---|---|
| `REF-1_range-S-M-L.png` | The three stickers on dark slate | Hero, cover, product slide |
| `REF-2_S-door-sticker-on-lever.png` | Small door sticker S on a steel lever | Door slides |
| `REF-3_L-wall-sticker.png` | Wall sticker L with its small installer ID | Wall slides |
| `REF-4_M-rail-sticker-on-handrail.png` | Rail sticker M on a round handrail | Stair and corridor slides |
| `REF-5_range-true-scale.png` | All three at true scale with a ruler | Scale check for every prompt |

**The product, for Gemini's benefit:** a thin, flat, safety-yellow (#FFC700) adhesive sticker with rounded corners and a softly tapered edge. It is 0.5 mm thick, with raised braille dots that are small rounded domes, 1.5 mm across and 0.5 mm high, in the same yellow as the sticker. **There is no other text, number, logo or symbol on the S and M stickers.** Only the large L wall sticker carries one small printed line for installers, which is flat ink, not raised.

---

## Lock block (paste at the top of every prompt)

```
REFERENCE LOCK — READ FIRST.
Image 1 is a 3D render of a real product: a thin yellow braille sticker. Treat the sticker in image 1 as a fixed physical object that you must reproduce exactly.
DO NOT change the sticker's geometry, shape or outline, corner radius, proportions, size relative to its surroundings, thickness or tapered edge.
DO NOT change the number, position, spacing or pattern of the braille dots. Keep every dot exactly where it is. Do not add or remove dots.
DO NOT add any letters, numbers, words, logos, icons, arrows or symbols to the sticker. Keep it braille only. (The large wall sticker keeps its one small printed ID line exactly as shown, with no new text.)
DO NOT change its colour: safety yellow #FFC700, matte, with the dots the same yellow.
DO NOT make it glow, light up, become transparent, become a sign plate, become thicker, or become a 3D-printed clip.
Keep the sticker's placement on the object exactly as in image 1.
You may ONLY change: the environment, lighting, camera realism, materials of the surroundings, and photographic quality.
```

---

## Space block (paste right after the Lock block, in every prompt)

```
SPACE DIRECTION.
Put the product in a REAL, believable space that looks sleek and modern, photographed as it would be for a top architecture magazine.
The space: contemporary and minimal, clean lines, calm colour palette (warm white, light grey, pale stone, light oak, brushed or satin stainless steel, frosted glass), high-quality materials, flush details, no clutter, nothing old, worn, dirty or cheap.
Light: natural daylight from large windows, plus soft, even architectural lighting; realistic shadows and reflections.
Realism: true-to-life proportions and scale, real materials and textures, physically correct light; it must look like a real photograph, not a 3D render or an illustration. No warped lines, no fantasy architecture.
The sticker stays small and true to scale (see the reference): a door sticker is about the width of two fingertips; the wall sticker is about the size of a business card.
No people's faces, no logos or brand names of real companies, no extra signs or text anywhere in the scene.
```

---

## Scene prompts

### 1. Hero: the range (cover and product slides)
**Upload:** REF-1

```
[Lock block]
[Space block]
Make image 1 look like a premium product photograph. Keep the three yellow braille stickers exactly as they are, in the same positions and angles.
Surface: honed dark slate or near-black stone (#0B0C0E to #17191D) with a fine natural texture, in a minimal studio.
Lighting: one soft warm key light from the low left that rakes across the stickers so every braille dot casts a tiny shadow and reads clearly; a faint cool rim light from the back right; deep, clean shadows.
Camera: 100 mm macro lens, f/8, sharp from front to back, very slight film grain, no vignette.
Style: minimal Apple-style product photography, editorial, calm. No props, no text, no hands.
Output 16:9, 4K.
```

### 2. Door: the S sticker on a campus classroom lever (problem and door slides)
**Upload:** REF-2, then optionally your own photo of a University of Sharjah classroom door.

```
[Lock block]
[Space block]
Turn image 1 into a real photograph of a classroom door in a sleek, newly built UAE university building. Keep the brushed stainless-steel lever and the small yellow braille sticker on top of it exactly as in image 1: same position on the lever, same size, same dots.
Door: full-height light oak veneer door with a slim flush frame; satin stainless rose; a smooth warm-white corridor wall with a thin shadow-gap skirting; polished concrete or large-format stone floor. Soft natural daylight from a corridor window on the left, gentle shadows.
Camera: 85 mm lens, eye level slightly above the lever, f/4, background softly out of focus, the sticker in sharp focus.
Style: architectural interior photography, Dezeen / Architectural Digest quality, realistic materials, no people.
Output 16:9.
```

### 3. Door, with a hand (the "it works" moment)
**Upload:** REF-2

```
[Lock block]
[Space block]
Photograph of an adult's hand resting naturally on the door lever from image 1, with the index fingertip lightly touching the yellow braille sticker as if reading it. Keep the sticker and its dots exactly as in image 1 and fully visible beside the fingertip; do not cover the sticker with the hand.
The hand: natural, relaxed, any skin tone, short clean nails, a plain sleeve. Do not show the person's face. No dark glasses, no white cane, no clichés.
Setting: sleek modern UAE university corridor, full-height oak door, smooth warm-white walls, soft daylight.
Camera: 100 mm macro, f/5.6, shallow depth of field on the fingertip and sticker.
Tone: respectful, calm, independent.
Output 16:9.
```

### 4. Wall: the L sticker beside a door at the latch side
**Upload:** REF-3

```
[Lock block]
[Space block]
Make image 1 a real photograph: the yellow wall sticker mounted on a smooth, flawless warm-white plaster wall in a modern building beside a slim flush door frame, at the latch side, at about 1.4 m height. Keep the sticker, both lines of braille dots and the small printed installer line exactly as shown. Do not add any other sign, word, or room name.
Include the edge of a slim dark-bronze or satin aluminium door frame at the left of the picture.
Lighting: soft even corridor light with a slight raking angle so the dots read.
Camera: 70 mm, straight-on, f/5.6, sharp.
Style: clean architectural detail photography.
Output 16:9.
```

### 5. Stairs: the M sticker on a campus handrail
**Upload:** REF-4

```
[Lock block]
[Space block]
Make image 1 a real photograph of a stair handrail in a sleek, modern UAE university stairwell. Keep the round brushed-steel handrail and the yellow braille sticker on top of it exactly as in image 1: same angle, same position, same dots.
Setting: floating light terrazzo or fair-faced concrete stairs going down in the background, a seamless pale wall, a tall slot window with soft daylight, minimal and calm.
Camera: 85 mm, slightly above the rail, f/4, background out of focus, sticker sharp.
Style: architectural interior photography, realistic metal reflections.
Output 16:9.
```

### 6. Corridor: rail sticker in a hospital or library
**Upload:** REF-4

```
[Lock block]
[Space block]
Place the exact handrail-and-sticker detail from image 1 on a wall-mounted corridor handrail in a bright, sleek modern hospital or university library corridor (white and light oak, linear ceiling lights, polished floor). Keep the sticker's size, shape, colour and dots exactly the same. The rail may be brushed steel or light timber; the sticker sits on top of the rail exactly as in image 1.
Wide view along the corridor at eye level, 35 mm lens, f/5.6, soft daylight and ceiling light, clean floors, no people, no extra signs with text.
Output 16:9.
```

### 7. Macro: the dots (texture slide)
**Upload:** REF-2

```
[Lock block]
[Space block]
Extreme macro photograph of the yellow braille sticker on the steel lever from image 1. Keep the dot pattern exactly the same. Raking light from the left so each 1.5 mm dome shows a highlight and a small shadow; the matte yellow surface shows a very fine print texture. 
Camera: 100 mm macro at 1:1, f/11, focus stacked, ultra sharp.
Output 16:9.
```

### 8. "Every building" montage (vision slide)
**Upload:** REF-1 and REF-5

```
[Lock block]
[Space block]
Create a clean 2×2 grid of four photographs, each showing the same yellow braille sticker family from image 1 in a different building: (1) a university classroom door lever, (2) a hospital corridor handrail, (3) a metro or bus grab pole, (4) a hotel lift lobby wall beside a door. Every space sleek, modern and real: clean materials, daylight, no clutter. Keep each sticker's shape, size (use image 2 for true scale), colour and braille dots exactly as in the references; small stickers stay braille only. Consistent warm daylight, architectural photography, no people's faces, no extra text anywhere.
Output 16:9.
```

---

## Fix-up prompt (when Gemini changed something)

```
You changed the sticker. Go back to image 1 and reproduce the sticker EXACTLY: same outline and rounded corners, same size relative to the lever or rail, same thin profile, same yellow, and exactly the same braille dots in the same positions. Remove any letters, numbers or symbols you added. Change only the environment and lighting.
```

## Check every image before use

- [ ] The outline, corners and size match the reference (compare with REF-5).
- [ ] The same number of dots, in the same pattern. Count them against the reference.
- [ ] No added letters, numbers, logos or arrows. S and M are braille only.
- [ ] The L sticker's small printed line is unchanged and nothing else was added.
- [ ] Matte safety yellow, not orange, not glowing, not glossy plastic.
- [ ] It still looks thin, about 0.5 mm, like a sticker, not a plate or a clip.
- [ ] No people's faces, no clichés (dark glasses, canes), no fake logos of real organisations.
- [ ] Label AI images as "concept render" in the deck until real photos replace them.

## Mood references (to describe, not to copy)

- **Product:** Apple and Braun product photography: one object, dark ground, raking light.
- **Interiors:** Dezeen and Architectural Digest interior detail shots: soft daylight, honest materials.
- **Campus:** your own photos of the University of Sharjah corridors, doors and stairs. These are the best reference. Upload them as image 2.

The braille in every reference is demo text ("15", the Arabic for "floor 2", "prayer room / level 2"). A braille reader must check real stickers before production.
