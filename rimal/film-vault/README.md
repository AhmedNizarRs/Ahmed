# Rimal vault film (9:16, 55 s)

Code-rendered motion graphics: every frame is a pure function of time (`film.js` → `seek(t)`), driven by `timeline.json`.

**Status:** final cut = `out/rimal-architect-vault-voice-sfx.mp4`: ElevenLabs voiceover (voice "مؤمل العباس", eleven_v4, Iraqi dialect) + sound effects, no music. Earlier cuts without the voice are kept in `out/` (`-sfx-only`, `-no-voice`). Voice take: `vo/raw.mp3`, cut into 15 lines by `make_marks.py` + `cut_vo.py`; every beat in the film is derived from those measured lines.

## Replace the voice (script in TREATMENT.md)
1. Generate the 15 lines as one take → `vo/raw.mp3`.
2. `python3 cut_vo.py words vo/raw.mp3` → word times; update the word times in `make_marks.py` and run it → `vo/marks.json`.
3. `python3 cut_vo.py cut vo/raw.mp3` → `vo/lines.json`.
4. `python3 build_timeline.py && python3 mix.py --nomusic` (voice + sound effects only; drop `--nomusic` to bring the score back, ducked under the voice).
5. Re-render and encode: `./extract_footage.sh <dir of Drive clips>` (once), `node render.js frames 0 1656` (split in four ranges to go faster), `python3 merge_blur.py frames`, `./encode.sh rimal-architect-vault 1500`.

`render.js` needs Playwright; `mix.py` needs numpy and ffmpeg; the footage comes from Drive › "For editing" (see FACTS.md).
