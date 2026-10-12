# DALIL landing page

The DALIL company landing page. Its one job is to get investors, mentors and the first buildings to fill in the form. People scan the QR code on the closing slide, see the clip work on their phone, and join the waitlist in under a minute. Each sign-up is saved in Netlify, emailed to both founders, and can be downloaded as a spreadsheet (CSV) or copied into a Google Sheet automatically.

- Live address (once deployed): `https://dalil-invest.netlify.app`, or your own domain (see [Use your own domain](#use-your-own-domain))
- Public contact email on the page: `dalilwayfinding@gmail.com`
- Sign-up emails go to: `ahmednazar422@gmail.com` and `dalilwayfinding@gmail.com`

The content follows the v7 investor deck (problem, product, market, pricing, roadmap, team), without the funding ask. The deck itself is not on the site or in this repository.

## What's on the page

In order, top to bottom:

1. **Opening screen.** The stairwell video plays behind "Make the existing path speak." The headline resolves out of braille as the page opens.
2. **The problem.** 21.8 million people, and a bare handrail whose words light up as you scroll.
3. **The film.** The 15-second reel plays by itself, muted, as it scrolls into view. Small buttons in its corner pause it and turn the sound on.
4. **Slide along the rail.** Visitors drag a "hand" along a rail. Each clip it meets reads out its message, rib count and braille. Phones that support it buzz. It also works with the arrow keys, and it glides once on its own to show how it works.
5. **Clip, Find, Read.** The three steps: the clip video, the hand video and the module render.
6. **The tactile grammar.** Tap Information, Safety or End of stairs to highlight the modules that carry those ribs.
7. **Every level of sight.** A "Turn the lights off" switch darkens the section and plays the glow video.
8. **Every place it can go.** On a computer the eight places slide sideways as you scroll; on a phone you swipe them.
9. **Competition table.** DALIL against wall tactile signs and apps with beacons.
10. **Market.** AED 170M across 10k UAE buildings, AED 18k per building, 58% margin.
11. **Pricing.** Pricing per floor, and the hospital comparison (AED 87k against AED 118k to 263k).
12. **Roadmap.** A rising handrail that lights up month by month as you scroll.
13. **First customers and team.** The sectors you are approaching, then Ahmed and Mohammed.
14. **Join the waitlist.** The form.

Every video that plays on its own is muted, plays only while it is on screen, and has a small pause button. Visitors whose phones ask for less motion or less data see still pictures and can tap play.

## What's in this folder

| Path | What it is |
|---|---|
| `site/` | The website. This is the folder Netlify publishes. |
| `site/index.html` | The main page. All the text lives here. |
| `site/thanks/`, `site/privacy/`, `site/404.html` | After-sign-up page, privacy note, page-not-found. |
| `site/assets/video/` | The videos as MP4 (Safari, Chrome) and WebM (everything else). The film comes in 1080p for computers and 720p for phones. |
| `site/assets/img/` | Every picture in several sizes and three formats, so phones download small files. |
| `site/assets/js/` | `site.js` (the page's behaviour) and GSAP with ScrollTrigger (the scroll effects). |
| `site/_headers` | Security and caching settings Netlify applies. |
| `netlify/functions/submission-created.js` | The backend: runs after every sign-up (see [The backend](#the-backend-what-happens-to-each-sign-up)). |
| `netlify.toml` | Tells Netlify to publish `site/` and where the backend code is. |
| `tools/google-sheet-webhook.gs` | The small Google script that receives sign-ups into a Google Sheet. |
| `tools/test-submission.js` | A test for the backend: `node tools/test-submission.js`. |
| `tools/make-qr.js` | Remakes the QR code if the web address changes. |
| `qr/` | The QR code for the closing slide: `qr-dalil.svg` and `qr-dalil.png` (2000 px). |
| `screenshots/` | How the page looks on a phone and a computer. |
| `DESIGN.md` | Colours, type, components and motion rules, for anyone adding to the page. |

Only `site/` is public. This README, the QR code, the screenshots and the tools never go online.

## Put it online (one time, about 3 minutes)

You need a free Netlify account. Connecting GitHub is the recommended way, because it also switches on the backend and updates the site by itself.

### Recommended: connect GitHub

1. Sign in at `app.netlify.com` (you can sign in with GitHub).
2. Choose **Add new project** (called **Add new site** on some accounts), then **Import an existing project**, then **GitHub**.
3. Allow Netlify to see the `ahmednizarrs/ahmed` repository and pick it.
4. Fill in the settings:
   - **Branch to deploy:** `claude/vercel-labs-agent-skills-2lgsxj` (the repository's main branch).
   - **Base directory:** `dalil`.
   - **Build command:** leave empty.

   Netlify reads the publish folder (`site`) and the backend folder from `netlify.toml`.
5. Select **Deploy**. Then open **Project configuration**, **General**, **Change project name** and enter `dalil-invest`. Your address becomes `https://dalil-invest.netlify.app`.

From then on, every change pushed to that branch goes live within a minute. That includes changes Claude makes and pushes.

### Quick alternative: drag and drop

In Netlify choose **Add new project**, then **Deploy manually**, and drag the `site` folder onto the page. The page and the form work, but the backend extras (Google Sheet, thank-you email) don't, and you redeploy by dragging the folder in again after every change.

If `dalil-invest` is already taken, choose another name, then remake the QR code (see [QR code](#qr-code)) so it points to the new address.

## Turn on the form and the sign-up emails (one time)

1. **Turn on form detection.** In the Netlify project, open **Forms**, then select **Enable form detection**.
2. **Redeploy once.** Netlify only finds the form during a deploy: on the **Deploys** tab choose **Trigger deploy**, then **Deploy site**. The form then shows up in **Forms** as `investor-lead`.
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
- **Spreadsheet:** on that form's page, use **Download as CSV**, or set up the Google Sheet below so new sign-ups appear there by themselves.
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

## The backend: what happens to each sign-up

1. **Netlify Forms receives the sign-up.** It checks for spam, stores it and emails both founders. This needs no code and works as soon as the site is live.
2. **`netlify/functions/submission-created.js` runs automatically** after every real sign-up (never for spam). It can do two extra things, each switched on by adding settings in Netlify under **Project configuration**, then **Environment variables**. Until you add them, it does nothing.

| Extra | Settings to add | What you get |
|---|---|---|
| Copy to a Google Sheet | `SHEETS_WEBHOOK_URL`, `SHEETS_WEBHOOK_SECRET` | Every sign-up appears as a new row in your sheet, within seconds |
| Thank-you email to the person | `RESEND_API_KEY`, `REPLY_FROM`, optional `REPLY_TO` | They get a short "you're on the waitlist" email from your own domain, and replies go to `dalilwayfinding@gmail.com` |

After adding or changing settings, trigger a deploy (**Deploys**, then **Trigger deploy**) so the function picks them up. If an extra ever fails, the sign-up is still saved and emailed; the error shows under **Logs**, then **Functions**.

### Copy sign-ups to a Google Sheet

1. **Create the sheet.** Make a new Google Sheet, for example "DALIL waitlist".
2. **Add the script.** In the sheet, open **Extensions**, then **Apps Script**. Delete what's there, paste the contents of `tools/google-sheet-webhook.gs`, and save.
3. **Set the secret.** Make up a long random password (20 or more characters) and keep it handy. In Apps Script, open **Project Settings**, then **Script properties**, and add `SECRET` with that value.
4. **Deploy the script.** Choose **Deploy**, then **New deployment**, and pick the type **Web app**.
   - **Execute as:** Me.
   - **Who has access:** Anyone.

   Approve the permissions, then copy the **Web app URL**.
5. **Connect it to Netlify.** Under **Environment variables**, add:
   - `SHEETS_WEBHOOK_URL`: the web app URL;
   - `SHEETS_WEBHOOK_SECRET`: the same password.

   Trigger a deploy, then send a test sign-up. It appears in the sheet's **Sign-ups** tab.

The secret means only your site can add rows. Anyone else who finds the address gets "forbidden".

### Send a thank-you email (after you have your own domain)

The email has to come from your own domain (for example `hello@dalil.ae`) so it isn't marked as spam.

1. Create a free account at `resend.com`.
2. Add your domain there and copy the DNS records it shows into your domain's DNS. Wait until Resend says **Verified**.
3. Create an API key.
4. In Netlify, add these environment variables:
   - `RESEND_API_KEY`: the key;
   - `REPLY_FROM`: for example `DALIL <hello@dalil.ae>`.
5. Trigger a deploy.

The email's wording is in `netlify/functions/submission-created.js`, in `sendThankYou`.

## Use your own domain

You can buy a domain (for example a `.ae` or `.com`) from any registrar, or inside Netlify under **Domains**. Then:

1. **Add the domain.** In the Netlify project, open **Domain management**, then **Add a domain**, and type your domain.
2. **Point it at Netlify.** Choose one of these:
   - **Easiest: let Netlify run the DNS.** Netlify shows four name servers. Put those in your registrar's "name servers" setting. Netlify then sets up everything, including `www`.
   - **Keep your registrar's DNS.** Add two records there:
     - **For the `www` address:** a `CNAME` record for `www`, pointing to `dalil-invest.netlify.app`.
     - **For the bare domain:** an `A` record for `@`, pointing to Netlify's load balancer address. Netlify shows the exact value on the domain's page; at the time of writing it is `75.2.60.5`.
3. **Wait for HTTPS.** DNS changes take from a few minutes to a few hours. Netlify then issues the HTTPS certificate by itself (**Domain management**, then **HTTPS**).
4. **Set the main address.** Netlify sets your domain as the primary address, so `dalil-invest.netlify.app` forwards to it.

Once the domain works, tell Claude the name. Three things should point at it, and are quick to change:

- the page's address for Google and link previews (in `site/index.html`, `site/sitemap.xml` and `site/robots.txt`);
- the QR code;
- the thank-you email sender.

## Everyday changes

Edit the files in `site/`, then push to GitHub (or drag the folder in again if you used drag and drop).

### Change any text

1. Open `site/index.html` in any text editor (TextEdit in plain-text mode, Notepad, VS Code).
2. Search for the sentence you want to change and edit only the words between the tags. Leave the `<...>` parts alone.

A few numbers also live in attributes, so change those too if a figure changes:

- **Count-up numbers:** `data-to="21.8"`, `data-to="18"`, `data-to="58"`.
- **Market bars:** `data-v="62"` and similar on each bar. Bar lengths are set in `site/assets/css/site.css`.
- **The rail demo's three messages:** `data-msg`, `data-kind`, `data-ribs` and `data-braille`.

### Add a source for the 21.8 million figure

Investors may ask where it comes from. Search `site/index.html` for `moderate-to-severe vision impairment` and add the source after it, for example `(Source: name of the report, year)`.

### Change who gets sign-up emails

Change the notifications in Netlify (step 3 of the form setup). Then update the privacy note: `site/privacy/index.html` says sign-ups are emailed to the two DALIL founders.

### Change the public email address

It appears in five places:

- the join section and the footer of `site/index.html`;
- `site/thanks/index.html`;
- `site/privacy/index.html`;
- the "couldn't send" message in `site/assets/js/site.js`;
- the thank-you email in `netlify/functions/submission-created.js`.

Search for `dalilwayfinding@gmail.com` in each file.

### Swap a photo or a video

Each picture exists in several sizes and formats, and each video as MP4 and WebM. Replacing one cleanly means making every version again. The easiest way is to ask Claude: "Replace the stairwell video in `dalil/site` with this file, keeping the same names and sizes."

### Preview on your computer

In a terminal, from the `dalil/site` folder, run `python3 -m http.server 8000`, then open `http://localhost:8000`. Sending the form only works on Netlify, so on your computer it shows the "couldn't send" message. That's expected.

## QR code

- `qr/qr-dalil.png` (2000 × 2000 px) and `qr/qr-dalil.svg` (sharp at any size) open `https://dalil-invest.netlify.app/?src=qr`.
- Ink `#111315` on white, error correction level H, a wide white border, and the DALIL mark in the centre.
- Checked by reading it back with a QR decoder at full size and at 160 px, and blurred, tilted 8° and at low contrast.

If you move to your own domain, the old address keeps forwarding, so printed codes keep working.

On the closing slide, make it big: about a third of the slide's height, on a plain white area, so people can scan it from their seats. On paper, keep it at least 3 cm wide (a common rule of thumb for scanning up close).

To make a new one for a different address, from the `dalil/tools` folder:

```bash
npm install qrcode@1.5.4 jsqr@1.4.0 pngjs@7.0.0 playwright
node make-qr.js "https://YOUR-ADDRESS/?src=qr" ../qr
```

The script prints the address it read back from the new image, so you know it works.

## What was checked

Tested locally on 12 October 2026 with a server that copies Netlify's form handling and security rules.

### Lighthouse

| Page | Performance | Accessibility | Best practices | SEO |
|---|---|---|---|---|
| Home, phone | 99 | 100 | 100 | 100 |
| Home, computer | 100 | 100 | 100 | 100 |
| Thanks | 100 | 100 | 100 | 66 |
| Privacy | 100 | 100 | 100 | 100 |

The thanks page scores 66 for SEO on purpose: it's hidden from Google (`noindex`), because only people who sent the form should see it.

On a simulated slow phone, the opening image shows in 1.5 s and nothing moves as the page loads (layout shift 0).

### Videos

Re-encoded from the originals at close to source quality. The MP4s score 0.993 to 0.998 SSIM against the source files, which means they look the same as the originals. The film is 1080p on computers and 720p on phones.

### Accessibility

- axe reports 0 problems on every page, including the form's error state and the lights-off state.
- Colours meet WCAG 2.2 AA (exact ratios are in `DESIGN.md`).
- **Rail demo:** a proper slider for screen readers and keyboards, with each message announced.
- **Toggles:** the lights switch, rib filters, and pause and sound buttons all say whether they're on.
- **Film:** screen readers get a description of what's on screen; it isn't shown on the page.
- **Reduced motion:** visitors who ask their device for less motion get still images, no scroll effects and no autoplay.
- **Keyboard:** the floating top bar never covers the focused element.

### Form and backend

- **The form passed 19 automatic checks:**
  - filling it in and sending it with the keyboard only;
  - errors announced, listed and linked to their fields;
  - every field arriving in the sign-up;
  - `src=qr` recorded;
  - the spam trap staying empty;
  - sending with JavaScript switched off.
- **The backend function passed 7 tests:**
  - it does nothing without settings;
  - it ignores other forms;
  - it copies the sign-up to the sheet with the secret;
  - it sends the thank-you email and makes names safe to show;
  - it skips invalid addresses;
  - a failed extra never loses a sign-up;
  - it rejects unreadable data.

### Interactions and layout

- **Interactions:**
  - the film starts by itself when scrolled to, with sound on request, and stays paused if paused;
  - the rail glide, drag and keys;
  - the rib filter;
  - lights off;
  - the sideways places;
  - the roadmap;
  - the menu links landing in the right place, even when tapped straight after the page opens.
- **Layout:** no sideways scrolling at 320, 375, 390, 768, 1024, 1440 or 1920 px wide, and no console errors.

## Notes and open items

- **Organisations from the "first customers" slide:** neither their names nor their logos are on the page. None has signed yet, and showing their logos publicly could read as an endorsement. The page lists the sectors instead. If you want the names shown, add them as plain text with wording like "Organisations we plan to approach".
- **The airport picture** comes from the deck at 480 px, so it is softer than the other seven places. A larger render would help.
- **The page is dark only.** The product's glow story is told in the dark, so it doesn't switch to a light theme.
- **The demo braille** in "Slide along the rail" is English Grade 1 braille of the English words, generated by the page. The real modules are designed for Arabic braille, with approval planned for month 6.
