# Windows laptop setup: Claude Code + AutoCAD, SketchUp, 3ds Max, Blender, D5

Why this exists: the cloud session could not reach the laptop folder (`C:\Users\theki\OneDrive\Documents\architecture`), and cloud sessions can never drive desktop CAD. A Claude Code session running on the laptop can.

Status key: **[verified]** I ran it in the cloud session. **[from README]** taken from a project's own page or search result, not run by me. Check each repo's README and licence before installing, and read what an installer does.

## 1. Base tools
1. Install Git and Python 3.11+ (python.org).
2. Install uv: `winget install --id astral-sh.uv` **[from README]**. It is what runs `uvx`.
3. Install Claude Code on the laptop (see the current instructions at code.claude.com/docs).
4. Get the project into the architecture folder:
   ```
   cd C:\Users\theki\OneDrive\Documents\architecture
   git clone https://github.com/AhmedNizarRs/Ahmed
   cd Ahmed
   git checkout claude/architecture-design-research-ujymb4
   claude
   ```
   OneDrive can lock files while syncing. If you see odd git errors, move the clone to a non-synced folder such as `C:\work\Ahmed`.
5. Approve the project's MCP servers when Claude Code asks. They are in `.mcp.json`.

The headless DXF drawing, the checker and the workflow skill work immediately **[verified]**.

## 2. Live AutoCAD (full AutoCAD, not LT, for this server)
`autocad-mcp-pro` has two engines: ezdxf (headless, what `.mcp.json` uses now) and COM (your running AutoCAD) **[from README]**. To use live AutoCAD:
1. Open AutoCAD with a drawing.
2. In `.mcp.json`, change the autocad server's `--from` to `autocad-mcp-pro[com,pdf]==1.8.0` and remove the `AUTOCAD_MCP_BACKEND` line so the backend is picked automatically **[from README, untested by me]**.
3. Restart Claude Code and ask it to read `drawing_info`. If it reports your open drawing, COM works.
This gives native DWG, your own template and plot styles.

## 3. SketchUp
The Trimble SketchUp connector is already connected to your Claude account **[verified: listed as connected]**. It builds models in the cloud connector. Nothing to install on the laptop unless you want to edit the result in SketchUp Desktop.

## 4. 3ds Max
Community server: `cl0nazepamm/3dsmax-mcp` (MIT) **[from search results, not run by me]**. It installs a bridge inside 3ds Max and an MCP server on the same Windows PC. It lists 3ds Max 2023 to 2027. One review notes the README still calls for real-renderer acceptance testing, so treat it as experimental and keep a backup of any scene before letting it edit.

## 5. Blender (and IFC/BIM)
- `ahujasid/blender-mcp` for general scene control: `claude mcp add blender -- uvx blender-mcp`, plus its Blender add-on **[from search results]**.
- `JotaDeRodriguez/Bonsai_mcp` if you want IFC/BIM through the Bonsai add-on **[from search results]**.
Reviewers say Claude's spatial judgment in Blender is imprecise: good for massing and blockouts, not final renders. Use the residential skill's checker and the AutoCAD numbers as the source of truth.

## 6. D5 Render
I found no D5 MCP server. Workflow: Claude prepares the model, a named camera list and a material list, and you render in D5. Do not expect Claude to operate D5.

## 7. Documents to add
Put these in the `architecture` folder (or Google Drive) so Claude can turn them into sourced rules:
- Sharjah Municipality drawing and submission requirements
- UAE Fire and Life Safety Code 2018
- Dubai Universal Design Code 2017
- Federal People of Determination accessibility rules
- Your authority's plot requirements, your DWG template, your block library

## Order of work
1. Steps 1 and 2 first. That is the biggest jump.
2. Documents next (step 7). That is what removes `[TO CONFIRM]`.
3. Blender, 3ds Max and D5 only when a project needs renders.
