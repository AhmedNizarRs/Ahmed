---
name: dalil-weekly-plan
description: Run DALIL's weekly review and plan. Reads every department's files, reports what moved and what's stuck against the roadmap, and sets the top 3 priorities for each founder. Use when the founder says "plan my week", "weekly review", "standup", "where are we", or on Mondays.
---

# DALIL weekly plan

## Steps

1. **Read the context**
   - `dalil-hq/DALIL-facts.md` (roadmap and open questions)
   - `dalil-hq/departments/chief-of-staff/okrs.md`
   - The most recent file in `dalil-hq/departments/chief-of-staff/weekly/` (last week's priorities)
   - Every department folder: `fundraising/investor-pipeline.csv`, `sales/pipeline.csv`, `marketing/content-calendar.csv`, `product/certification-tracker.md`, `product/test-log.csv`, `accessibility/feedback-log.csv`, `accessibility/partners.csv`
   - Run `git log --since="8 days ago" --oneline -- dalil-hq dalil` to see what changed.
   - If Google Calendar is connected, read this week's events for both founders.

2. **Ask the founder, briefly** (skip anything already answered in the files):
   - What happened this week that isn't written down?
   - Anything blocked?

3. **Write** `dalil-hq/departments/chief-of-staff/weekly/YYYY-Www.md` (ISO week, for example `2026-W45.md`) from `dalil-hq/departments/chief-of-staff/weekly/_template.md`.

4. **Rules for priorities**
   - At most 3 per founder. Ahmed: product, production, marketing. Mohammed: sales, partnerships, presentations.
   - Each one: owner, "done means…", due day.
   - At least one priority must move the next roadmap milestone (Month 1 set up → Month 6 certified → Month 12 first paying buildings).
   - Carry over last week's unfinished priorities only if they still matter; say why.

5. **Report back** in chat: 5 lines maximum, plus the file path. Then list the decisions the founders need to make this week.

Never invent progress. If a file is empty, write "No data yet" for that department.
