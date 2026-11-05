---
name: dalil-user-test
description: Plan, run and summarise a DALIL user-testing session with blind and low-vision people — goals, recruitment message, consent form, tasks, facilitator script, observation sheet and a findings summary — in Arabic and English. Use when the founder wants to test the clip, braille, tactile grammar or glow with users, or has notes from a session to summarise.
---

# DALIL user test

Follow `dalil-hq/departments/accessibility/user-testing-protocol.md` and `principles.md`.

## Plan a session

1. **Goal.** What decision will this test inform? (for example "Can people tell Safety ribs from Information ribs without reading?")
2. **Version under test.** Take the spec version from `dalil-hq/departments/product/product-spec.md`.
3. **Participants.** 5–8 people mixing braille readers and non-readers, low vision, different ages; cane and guide-dog users; at least one orientation-and-mobility specialist observing.
4. **Recruitment message** through partners in `partners.csv` (draft only; a founder sends). Mention compensation, time, place, accessibility of the venue, and that a companion is welcome.
5. **Consent form** (Arabic and English; offer large print and braille, or read it aloud and record verbal consent): purpose, what happens, right to stop, compensation, what's recorded, how data is stored, separate opt-ins for photos, video, quotes and name.
6. **Tasks**, realistic and in order, for example:
   - Walk up the stair holding the rail. Tell us when you notice something.
   - What does this clip say? (braille, then the raised number)
   - Which clips are about safety? How did you know?
   - Find the exit using only the rail.
   - Lights off: (sighted and low-vision participants) what can you see?
7. **Measures** per task: success without help (yes / with a hint / no), time, confidence (1–5), quotes.
8. **Facilitator script and observation sheet.** Neutral questions ("What are you noticing?"), never "Is it good?".

## After the session

1. Add every finding to `dalil-hq/departments/accessibility/feedback-log.csv`: date, session, participant code (P1, P2… never names), task, finding, quote (only if consented), severity (Critical / Major / Minor / Idea), owner department, action, status.
2. Write `dalil-hq/departments/accessibility/sessions/YYYY-MM-DD-summary.md`: top 3 findings, numbers per task, what changes in the spec, what to test next.
3. Send spec changes to `dalil-product` and consented stories to `dalil-marketing`.

Anything Critical about Safety ribs (exits, end of stairs) blocks installation until fixed and retested.
