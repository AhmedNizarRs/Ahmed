# DALIL HQ: your Claude team

This folder is DALIL's company brain. Six Claude "departments" work from it. Each one reads the same facts, writes in the same voice, and keeps its own tracker, so work carries over from one session to the next.

## The team

| Department | Ask it to… | Its files |
|---|---|---|
| **Chief of Staff** | plan the week, set goals, prepare a decision, check progress | `departments/chief-of-staff/` |
| **Fundraising** | find investors, write outreach, prep a pitch, apply to Sheraa or a grant, write the monthly update | `departments/fundraising/` |
| **Sales** | find buildings and decision-makers, write emails, build a quote or proposal, answer a tender | `departments/sales/` |
| **Marketing** | write LinkedIn and Instagram posts, plan content, write a press release, update the website | `departments/marketing/` |
| **Product** | write the spec, plan tests, research braille, fire and glow standards, track certification | `departments/product/` |
| **Accessibility** | find community partners, plan user tests, write consent forms, summarise feedback | `departments/accessibility/` |

## How to use it

Open Claude Code on this repository (on the web, the desktop app or the terminal) and just ask in plain words:

- "Plan my week." → Chief of Staff runs `/dalil-weekly-plan`
- "Find 20 Sharjah buildings for our first pilots and add them to the pipeline." → Sales
- "Write an email to the facilities director at the University of Sharjah asking for a pilot." → Sales, `/dalil-outreach`
- "Make a quote for a 6-floor school with 2 staircases." → Sales, `/dalil-quote`
- "Write 4 LinkedIn posts for this month, English and Arabic." → Marketing, `/dalil-content-post`
- "Find the Sheraa programme deadline and draft our application." → Fundraising
- "Write our November investor update." → Fundraising, `/dalil-investor-update`
- "What fire test does a plastic handrail clip need in Sharjah?" → Product
- "Plan our first user-testing session with 6 braille readers." → Accessibility, `/dalil-user-test`

You can also name the department: "Ask DALIL Sales to…"

## The two files that matter most

1. **`DALIL-facts.md`**: every number, price and claim. Update it first when something changes. Section 11 lists the questions only you can answer.
2. **`brand-voice.md`**: how DALIL sounds, and how to talk about disability respectfully.

## Fill these in first (10 minutes)

- [ ] `data/pricing.json`: per-floor price, door-tag price, care-plan price. The quote calculator won't give a final price until these are set.
- [ ] `DALIL-facts.md` section 11: funding ask, company setup, Month-1 start date, IP status, current leads.
- [ ] `departments/chief-of-staff/okrs.md`: check the goals and dates are right.

## Rules the team follows

- **It drafts. You send.** No email, post or application goes out without your OK.
- **No made-up facts.** Anything unknown is marked `[TO CONFIRM]` or `[VERIFY]`.
- **Professionals decide** on legal, tax and certification. Claude researches and drafts.

## Connect your tools (optional, makes the team much stronger)

Already connected to this account: Gmail, Google Calendar, Google Drive, Docs, Sheets and Slides, Notion, Canva. The team can use them to create Gmail drafts, read your calendar, read the sign-up sheet, and make designs. Recommended extra plugins: **Sales** and **Product Management** (from the Anthropic directory).

## Later departments (add when you have customers)

Operations and manufacturing · Installation and field ops · Customer success · Finance · Legal and compliance · People · Data. Ask: "Add the Finance department to the DALIL team."
