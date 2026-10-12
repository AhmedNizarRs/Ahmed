# DALIL investor page

A one-page website for investors, mentors and the first buildings that want DALIL. People scan the QR code on the closing slide, watch the clip work on their phone, and join the waitlist in under a minute. Each sign-up arrives by email and is saved in Netlify, where you can download all of them as a spreadsheet (CSV).

- Live address (once deployed): `https://dalil-invest.netlify.app`
- Public contact email on the page: `dalilwayfinding@gmail.com`
- Sign-up emails go to: `ahmednazar422@gmail.com` and `dalilwayfinding@gmail.com`

The content follows the v7 investor deck (market, pricing, the ask, roadmap, team). The deck itself is not on the site or in this repository.

## What's on the page

In order, top to bottom:

1. **Opening screen.** The stairwell film plays behind "Make the existing path speak." The headline resolves out of braille as the page opens.
2. **The problem.** 21.8 million people, and a bare handrail whose words light up as you scroll.
3. **The film.** The 15-second reel, with sound, captions and a written description.
4. **Slide along the rail.** Visitors drag a "hand" along a rail. Each clip it meets reads out its message, rib count and braille. Phones that support it buzz. It also works with the arrow keys, and it glides once on its own to show how it works.
5. **Clip, Find, Read.** The three steps, with the hand video.
6. **The tactile grammar.** Tap Information, Safety or End of stairs to highlight the modules that carry those ribs.
7. **Every level of sight.** A "Turn the lights off" switch darkens the section and plays the glow video.
8. **Every place it can go.** On a computer the eight places slide sideways as you scroll; on a phone you swipe them.
9. **Competition table.** DALIL against wall tactile signs and apps with beacons.
10. **Market.** AED 170M across 10k UAE buildings, AED 18k per building, 58% margin.
11. **Pricing.** Pricing per floor, and the hospital comparison (AED 87k against AED 118k to 263k).
12. **The ask.** AED 500k, where it goes, and what investors get.
13. **Roadmap.** A rising handrail that lights up month by month as you scroll.
14. **First customers and team.** The sectors you are approaching, then Ahmed and Mohammed.
15. **Join the waitlist.** The form.

## What's in this folder

| Path | What it is |
|---|---|
| `site/` | The website. This is the only folder Netlify publishes. |
| `site/index.html` | The main page. All the text lives here. |
| `site/thanks/`, `site/privacy/`, `site/404.html` | After-sign-up page, privacy note, page-not-found. |
| `site/assets/video/` | The four videos, each as MP4 (Safari, Chrome) and WebM (everything else), plus captions for the film. |
| `site/assets/img/` | Every picture in three sizes and three formats, so phones download small files. |
| `site/assets/js/` | `site.js` (the page's behaviour) and GSAP with ScrollTrigger (the scroll effects). |
| `site/_headers` | Security and caching settings Netlify applies. |
| `netlify.toml` | Tells Netlify to publish `site/`. |
| `qr/` | The QR code for the closing slide: `qr-dalil.svg` and `qr-dalil.png` (2000 px). |
| `screenshots/` | How the page looks on a phone and a computer. |
| `tools/make-qr.js` | Remakes the QR code if the web address changes. |
| `DESIGN.md` | Colours, type, components and motion rules, for anyone adding to the page. |

Nothing outside `site/` goes online, so this README, the QR code and the screenshots stay private.

## Put it online (one time)

You need a free Netlify account. Pick one way to deploy.

### Option A: drag and drop (no setup)

1. Sign in at `app.netlify.com`.
2. Go to **Add new project** (called **Add new site** on some accounts), then **Deploy manually**.
3. Drag the `site` folder (not the whole `dalil` folder) onto the page.
4. In the project settings, change the project name to `dalil-invest`. Your address becomes `https://dalil-invest.netlify.app`.

To update the page later, drag the `site` folder in again on the project's **Deploys** tab.

### Option B: connect GitHub (updates itself)

1. In Netlify, choose **Add new project**, then **Import an existing project**, then GitHub, and pick this repository.
2. Set **Base directory** to `dalil`. Leave the build command empty. Netlify reads the publish folder (`site`) from `netlify.toml`.
3. Change the project name to `dalil-invest`.

From then on, every change pushed to the branch goes live within a minute.

If `dalil-invest` is already taken, choose another name, then remake the QR code (see [QR code](#qr-code)) so it points to the new address.

## Turn on the form and the sign-up emails (one time)

1. **Turn on form detection.** In the Netlify project, open **Forms**, then select **Enable form detection**.
2. **Redeploy once.** Netlify only finds the form during a deploy. Drag the `site` folder in again, or push a commit. The form then shows up in **Forms** as `investor-lead`.
3. **Add the email alerts.**
   - Go to **Project configuration** (called **Site configuration** on some accounts), then **Notifications**, then **Emails and webhooks**, then **Form submission notifications**.
   - Choose **Add notification**, then **Email notification**.
   - Set the event to **New form submission**, the email to `ahmednazar422@gmail.com`, and the form to `investor-lead`. Save.
   - Repeat for `dalilwayfinding@gmail.com`.
4. **Send yourself a test sign-up.**
   - Open `https://dalil-invest.netlify.app/?src=test` on your phone, fill in the form and send it.
   - You should land on the thank-you page.
   - The sign-up should appear in **Forms**, and an email should reach both inboxes within a few minutes.
   - The first email may land in spam: mark it **Not spam**.

## Where to find sign-ups

- **Every sign-up:** Netlify, then **Forms**, then `investor-lead`.
- **Spreadsheet:** on that form's page, use **Download as CSV**.
- **Spam:** Netlify keeps suspected spam in a separate **Spam** list on the same page, so check it now and then. The form also has a hidden trap field that catches most bots.

### The columns

| Column | Meaning |
|---|---|
| `full-name`, `email`, `phone`, `organisation` | Required details |
| `interests` | What they picked, for example `Investing, DALIL in my building` |
| `interest-investing`, `interest-pilot`, `interest-mentoring`, `interest-following` | `Yes` for each option picked (handy for filtering). `interest-pilot` is "DALIL in my building"; `interest-mentoring` is "Mentoring or partnering". |
| `investor-type`, `ticket-size`, `message` | Optional details |
| `consent` | `Agreed` (the form can't be sent without it) |
| `src` | How they arrived: `qr` from the QR code, `direct` if they typed the address or used a plain link |

### Tracking where people come from

Add `?src=` and a short label to any link you share:

- `https://dalil-invest.netlify.app/?src=linkedin`
- `https://dalil-invest.netlify.app/?src=whatsapp`
- `https://dalil-invest.netlify.app/?src=email`

The label shows up in the `src` column. Labels can use lowercase letters, numbers, `-` and `_`.

## Everyday changes

Edit the files in `site/`, then redeploy: drag the folder in again, or push to GitHub with option B.

### Change any text

1. Open `site/index.html` in any text editor (TextEdit in plain-text mode, Notepad, VS Code).
2. Search for the sentence you want to change and edit only the words between the tags. Leave the `<...>` parts alone.

A few numbers also live in attributes, so change those too if a figure changes:

- **Count-up numbers:** `data-to="21.8"`, `data-to="18"`, `data-to="58"`, `data-to="500"`.
- **Market bars:** `data-v="62"` and similar on each bar. Bar lengths are set in `site/assets/css/site.css`.
- **The rail demo's three messages:** `data-msg`, `data-kind`, `data-ribs` and `data-braille`.

### Add a source for the 21.8 million figure

Investors may ask where it comes from. Search `site/index.html` for `moderate-to-severe vision impairment` and add the source after it, for example `(Source: name of the report, year)`.

### Change who gets sign-up emails

Change the notifications in Netlify (step 3 above). Then update the privacy note: `site/privacy/index.html` says sign-ups are emailed to the two DALIL founders.

### Change the public email address

It appears in five places:

- the join section and the footer of `site/index.html`;
- `site/thanks/index.html`;
- `site/privacy/index.html`;
- the "couldn't send" message in `site/assets/js/site.js`.

Search for `dalilwayfinding@gmail.com` in each file.

### Swap a photo or a video

Each picture exists in several sizes and formats, and each video as MP4 and WebM. Replacing one cleanly means making every version again. The easiest way is to ask Claude: "Replace the stairwell video in `dalil/site` with this file, keeping the same names and sizes."

### Preview on your computer

In a terminal, from the `dalil/site` folder, run `python3 -m http.server 8000`, then open `http://localhost:8000`. Sending the form only works on Netlify, so on your computer it shows the "couldn't send" message. That's expected.

## QR code

- `qr/qr-dalil.png` (2000 × 2000 px) and `qr/qr-dalil.svg` (sharp at any size) open `https://dalil-invest.netlify.app/?src=qr`.
- Ink `#111315` on white, error correction level H, a wide white border, and the DALIL mark in the centre.
- Checked by reading it back with a QR decoder at full size and at 160 px, and blurred, tilted 8° and at low contrast.

On the closing slide, make it big: about a third of the slide's height, on a plain white area, so people can scan it from their seats. On paper, keep it at least 3 cm wide (a common rule of thumb for scanning up close).

If the final address is different, remake it from the `dalil/tools` folder:

```bash
npm install qrcode@1.5.4 jsqr@1.4.0 pngjs@7.0.0 playwright
node make-qr.js "https://YOUR-NAME.netlify.app/?src=qr" ../qr
```

The script prints the address it read back from the new image, so you know it works.

## What was checked

Tested locally on 12 October 2026 with a server that copies Netlify's form handling and security rules.

### Lighthouse

The same scores on phone and computer settings:

| Page | Performance | Accessibility | Best practices | SEO |
|---|---|---|---|---|
| Home | 100 | 100 | 100 | 100 |
| Thanks | 100 | 100 | 100 | 66 |
| Privacy | 100 | 100 | 100 | 100 |

The thanks page scores 66 for SEO on purpose: it's hidden from Google (`noindex`), because only people who sent the form should see it.

On a simulated slow phone, the opening image shows in 1.6 s, nothing moves as the page loads (layout shift 0), and the main thread never blocks. Two choices keep it that fast:

- The stairwell video starts once the page has finished loading.
- The scroll effects load only when the browser is idle or the visitor starts to interact.

### Accessibility

- axe reports 0 problems on every page, including the form's error state and the lights-off state.
- Colours meet WCAG 2.2 AA (exact ratios are in `DESIGN.md`).
- **Rail demo:** a proper slider for screen readers and keyboards, with each message announced.
- **Lights switch and rib filters:** buttons that say whether they're on.
- **Film:** captions and a written description of what's on screen.
- **Reduced motion:** visitors who ask their device for less motion get still images, no scroll effects and no autoplay.
- **Keyboard:** the floating top bar never covers the focused element.

### Form

The form passed 19 automatic checks:

- Fill it in and send it with the keyboard only.
- Error messages are announced, listed at the top, and each one jumps to its field.
- Every field arrives in the sign-up.
- `src=qr` is recorded.
- The spam trap stays empty.
- Sending still works with JavaScript switched off.

### Interactions and layout

- **Interactions:**
  - the rail glide, drag and keys;
  - the rib filter;
  - lights off;
  - the sideways places;
  - the roadmap;
  - the film with sound;
  - the menu links landing in the right place, even when tapped straight after the page opens.
- **Layout:** no sideways scrolling at 320, 375, 390, 768, 1024, 1440 or 1920 px wide, and no console errors.

## Notes and open items

- **Organisations from the "first customers" slide:** neither their names nor their logos are on the page. None has signed yet, and showing their logos publicly could read as an endorsement. The page lists the sectors instead. If you want the names shown, add them as plain text with wording like "Organisations we plan to approach".
- **The airport picture** comes from the deck at 480 px, so it is softer than the other seven places. A larger render would help.
- **The investor pack PDF** is no longer linked, because the page now leads to the waitlist. If you want a downloadable pack again, add the PDF to `site/` and a link on the thanks page.
- **The page is dark only.** The product's glow story is told in the dark, so it doesn't switch to a light theme.
- **The demo braille** in "Slide along the rail" is English Grade 1 braille of the English words, generated by the page. The real modules are designed for Arabic braille, which the roadmap has approved at month 6.
