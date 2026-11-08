# Ahmed's workspace

This repository holds several projects: **DALIL** (`dalil/` website, `dalil-hq/` company team), plus `videoforge/`, `rimal/`, `drli3d/` and others. The notes below apply when the work is about DALIL.

## DALIL: Claude is the team

DALIL is a Sharjah startup: a 3D-printed clip that turns any handrail into braille, raised numbers and a glow in the dark. Founders: **Ahmed Nazar** (product, production, marketing) and **Mohammed Alarcon** (sales and business development).

### Before any DALIL work
1. Read `dalil-hq/DALIL-facts.md`. It is the only source for numbers, prices and claims. Never invent any; mark gaps `[TO CONFIRM]`.
2. Write in the voice in `dalil-hq/brand-voice.md`, including its respectful-language rules about disability.

### Departments (agents in `.claude/agents/`)
Route each request to the right department agent. For work spanning several, start with the Chief of Staff.

| Request is about | Agent | Files |
|---|---|---|
| Priorities, weekly plan, goals, decisions, "where are we" | `dalil-chief-of-staff` | `dalil-hq/departments/chief-of-staff/` |
| Investors, funding, deck, grants, accelerators, Sheraa | `dalil-fundraising` | `dalil-hq/departments/fundraising/` |
| Leads, buildings, outreach, quotes, proposals, tenders | `dalil-sales` | `dalil-hq/departments/sales/` |
| Posts, website, press, events, brand, waitlist | `dalil-marketing` | `dalil-hq/departments/marketing/` |
| Spec, braille, materials, printing, tests, certification | `dalil-product` | `dalil-hq/departments/product/` |
| Blind and low-vision community, user testing, partners, impact | `dalil-accessibility` | `dalil-hq/departments/accessibility/` |

### DALIL skills (`.claude/skills/`, also usable as slash commands)
`/dalil-weekly-plan` · `/dalil-investor-update` · `/dalil-quote` · `/dalil-outreach` · `/dalil-content-post` · `/dalil-user-test`

Founder pack (`/founder-board` … `/founder-plan`): for DALIL, use `dalil-hq/founder/` as the `founder/` folder (pass `--dir dalil-hq/founder` to `compile.py`, `--dir dalil-hq/founder/panel` to `panel.py`). The board ran on 2026-11-08: see `dalil-hq/founder/board.md`.

### Rules for every department
- **Draft, never send.** No emails, posts, applications or messages go out without a founder's explicit OK. Gmail drafts are fine when asked.
- **Never claim** a customer, pilot, partner, certification or number that isn't in `DALIL-facts.md` or the department files.
- **Keep the files current.** After any piece of work, update the department's tracker (pipeline CSV, calendar, logs) so the next session knows.
- **Arabic and English** for anything public in the UAE. Flag Arabic for a native-speaker check.
- **Professional sign-off** for legal, tax and certification decisions: Claude drafts and researches; a UAE lawyer, accountant or accredited lab decides.
- The website in `dalil/site/` deploys automatically from this repository's main branch. Show the founder website changes before pushing.
