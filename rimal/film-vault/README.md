# Rimal vault film (9:16, 55 s)

Code-rendered motion graphics: every frame is a pure function of time (`film.js` → `seek(t)`), driven by `timeline.json`.

**Status:** delivered as a music + SFX version. The ElevenLabs voiceover could not be generated (service reported "free generations are busy" three times, nothing charged). The picture is timed to *estimated* line lengths; when the real voice exists everything re-times itself.

## Add the voice (script in TREATMENT.md, voice "مؤمل العباس", model eleven_v4)
1. Generate the 15 lines as one take → `vo/raw.mp3`.
2. `python3 cut_vo.py words vo/raw.mp3` → word times and pauses; write `vo/marks.json` (see the docstring in `cut_vo.py`).
3. `python3 cut_vo.py cut vo/raw.mp3` → `vo/lines.json`.
4. `python3 build_timeline.py && python3 mix.py` (voice is mixed in, music ducks under it).
5. Re-render and encode: `./extract_footage.sh <dir of Drive clips>` (once), `node render.js frames 0 1656` (split in four ranges to go faster), `python3 merge_blur.py frames`, `./encode.sh rimal-architect-vault 1500`.

`render.js` needs Playwright; `mix.py` needs numpy and ffmpeg; the footage comes from Drive › "For editing" (see FACTS.md).
