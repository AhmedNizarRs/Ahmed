# DALIL · دليل

Indoor navigation for large buildings: a floor plan goes in, the visitor gets turn-by-turn voice directions.

| Folder | What |
|---|---|
| `mapper/` | DALIL Mapper. Open `mapper/index.html` in Chrome. This is the internal tool that turns a CAD plan into a navigation map. |
| `app/` | Visitor app (installable PWA). Run `npm run serve` here and open `http://localhost:8080/app/`. Spec: `docs/visitor-app-spec.md`. |
| `data/` | Test plans (a real hospital DXF and a sample) and exported maps. |
| `design/` | Visitor app mockup. |
| `docs/` | Map file format and the visitor app spec. |
| `tests/` | Playwright tests: the Mapper (`test_mapper.py`) and the visitor app (`npm test`). |

Claude Code reads `CLAUDE.md` automatically, so it already has the project context.
