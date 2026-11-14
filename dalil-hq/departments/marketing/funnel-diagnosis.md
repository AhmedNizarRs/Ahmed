# DALIL funnel diagnosis (website)

Date: 2026-11-14. Source: NextGen Founders workshop task "Diagnose your own funnel" (5 min, team task).
Built from the repo plus a live PostHog check on 2026-11-14.

## The funnel, as the site is built today

| Step | What happens | Tracked? |
|---|---|---|
| 1. Source | Someone sees a post, QR code or message | Only if the link has `?src=` (stored in `src`) |
| 2. Visit | Lands on dalil-team.com | Yes, `$pageview` |
| 3. Engage | Watches the film, toggles lights, filters ribs | Yes, `lights_toggled`, `rib_filter_selected` |
| 4. Reach the form | Scrolls to or clicks "Join the waitlist" | Partly: autocapture clicks only. No "form seen" event |
| 5. Start the form | Types in the first field | **No event** |
| 6. Submit | Sends the waitlist form | Yes, `waitlist_submitted`, `waitlist_validation_failed`, `waitlist_submit_failed` |

## Live data check (PostHog)

- The site's PostHog key (`phc_rXW2...`) belongs to the project "Default project", created 2026-11-05.
- That project has **never received an event**: `ingested_event` is false and no `$pageview` or `waitlist_*` event was seen in the last 30 days.
- So the funnel is **invisible right now**. Either nobody has visited the live site, or tracking is not reaching PostHog. I could not open dalil-team.com from this environment to tell which.
- The site's security headers already allow PostHog, so the headers are not the cause. The script also only runs on `dalil-team.com` and `*.netlify.app`, and respects Do Not Track.

Founders: open dalil-team.com in a normal browser (no ad blocker), then check PostHog Live events. If nothing shows after a minute, tracking is broken and fixing it comes first.

## 1. Where did our last 10 users come from?

Not answerable from data: PostHog has no events. `[TO CONFIRM]` from the founders' memory, and from the Netlify form submissions (the `src` field).
What the repo shows:
- Content calendar: 6 post ideas, all status "Idea", none published. Only one has a tracked link (`?src=linkedin`).
- Sales pipeline: 1 row (University of Sharjah, stage "Target", no contact yet).
- So most visitors probably come from the founders' own messages and network, and from the QR code in the deck, not from content.

Founders: write the real 10 here: ________________________

## 2. Which step is weakest?

Best reading from the build (PostHog has no data to check it):
- **Top of funnel (step 1 to 2) is the weakest.** Nothing has been published yet, so there is little traffic to convert.
- **Step 4 to 6 is the second risk.** The form asks for name, email, phone, organisation and an interest, all required. That is a lot for someone who is only "following progress". Investor details are already optional, which is good.
- **We cannot see steps 4 and 5.** There is no event for "form seen" or "form started", so we cannot tell if people leave before or inside the form.

## 3. Which of the four causes is yours?

The workshop slide names four causes, but they are not on the photo and I do not know them. `[TO CONFIRM]`: send the slide with the four causes and this gets filled in properly.
Provisional answer: **not enough of the right people arriving, then a heavy form.** The product page itself is clear.

## What the offer and build should start from

0. Confirm tracking works (see the live data check). Without it nothing below can be measured.
1. Publish the first posts, each with its own `?src=` link (linkedin, instagram, whatsapp, qr, campus).
2. Add two events: form seen and form started. That makes step 4 and 5 visible.
3. Test a short form: name, email, one interest. Move phone and organisation to an optional step. Founders decide, then we show the change before pushing.
4. Give campus visitors a direct route: the first customer is the University of Sharjah, so a "DALIL in my building" path with a meeting request.
