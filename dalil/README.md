# DALIL investor page

A one-page website for investors, mentors and pilot partners. People scan the QR code on the closing slide, read about DALIL on their phone, and leave their details in under a minute. Each lead arrives by email and is saved in Netlify, where you can download all of them as a spreadsheet (CSV).

- Live address (once deployed): `https://dalil-invest.netlify.app`
- Public contact email on the page: `dalilwayfinding@gmail.com`
- Lead emails go to: `ahmednazar422@gmail.com` and `dalilwayfinding@gmail.com`

## What's in this folder

| Path | What it is |
|---|---|
| `site/` | The website. This is the only folder Netlify publishes. |
| `site/index.html` | The main page. All the text lives here. |
| `site/thanks/` | The page people see after sending the form. |
| `site/privacy/` | The privacy note linked from the form. |
| `site/DALIL_investor_pack.pdf` | The investor pack people download. **It's a placeholder: replace it.** |
| `site/assets/` | Styles, script, fonts, logos and pictures. |
| `site/_headers` | Security and caching settings Netlify applies. |
| `netlify.toml` | Tells Netlify to publish `site/`. |
| `qr/` | The QR code for the closing slide: `qr-dalil.svg` and `qr-dalil.png` (2000 px). |
| `screenshots/` | How the page looks on a phone and a desktop. |
| `tools/make-qr.js` | Remakes the QR code if the web address changes. |
| `DESIGN.md` | Colours, type and component rules, for anyone adding to the page. |

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

## Turn on the form and the lead emails (one time)

1. **Turn on form detection.** In the Netlify project, open **Forms**, then select **Enable form detection**.
2. **Redeploy once.** Netlify only finds the form during a deploy. Drag the `site` folder in again, or push a commit. The form then shows up in **Forms** as `investor-lead`.
3. **Add the email alerts.**
   - Go to **Project configuration** (called **Site configuration** on some accounts), then **Notifications**, then **Emails and webhooks**, then **Form submission notifications**.
   - Choose **Add notification**, then **Email notification**.
   - Set the event to **New form submission**, the email to `ahmednazar422@gmail.com`, and the form to `investor-lead`. Save.
   - Repeat for `dalilwayfinding@gmail.com`.
4. **Send yourself a test lead.**
   - Open `https://dalil-invest.netlify.app/?src=test` on your phone, fill in the form and send it.
   - You should land on the thank-you page.
   - The lead should appear in **Forms**, and an email should reach both inboxes within a few minutes.
   - The first email may land in spam: mark it **Not spam**.

## Where to find leads

- **Every lead:** Netlify, then **Forms**, then `investor-lead`.
- **Spreadsheet:** on that form's page, use **Download as CSV**. It opens in Excel, Numbers or Google Sheets.
- **Spam:** Netlify keeps suspected spam in a separate **Spam** list on the same page, so check it now and then. The form also has a hidden trap field that catches most bots.

### The columns

| Column | Meaning |
|---|---|
| `full-name`, `email`, `phone`, `organisation` | Required details |
| `interests` | What they ticked, for example `Investing, Mentoring` |
| `interest-investing`, `interest-pilot`, `interest-mentoring`, `interest-following` | `Yes` for each box ticked (handy for filtering) |
| `investor-type`, `ticket-size`, `message` | Optional details |
| `consent` | `Agreed` (the form can't be sent without it) |
| `src` | How they arrived: `qr` from the QR code, `direct` if they typed the address or used a plain link |

### Tracking where people come from

Add `?src=` and a short label to any link you share:

- `https://dalil-invest.netlify.app/?src=linkedin`
- `https://dalil-invest.netlify.app/?src=whatsapp`
- `https://dalil-invest.netlify.app/?src=email`

The label shows up in the `src` column for each lead. Labels can use lowercase letters, numbers, `-` and `_`.

## Everyday changes

Edit the files in `site/`, then redeploy: drag the folder in again, or push to GitHub with option B.

### Change any text

1. Open `site/index.html` in any text editor (TextEdit in plain-text mode, Notepad, VS Code).
2. Search for the sentence you want to change and edit only the words between the tags. Leave the `<...>` parts alone.

### Add the source for the 21.8 million figure

Search `site/index.html` for `[SOURCE]` and replace those characters with the source, for example `Source: name of the report, year`. Keep the `<span class="source-tag">` around it.

### Replace the investor pack

Save the final deck as a PDF named exactly `DALIL_investor_pack.pdf` and put it in `site/`, replacing the placeholder. Keep the name the same so the download button keeps working.

### Change who gets lead emails

Change the notifications in Netlify (step 3 above). Then update the privacy note: `site/privacy/index.html` says leads are emailed to the two DALIL founders.

### Change the public email address

It appears in four places:

- the footer of `site/index.html`, `site/thanks/index.html` and `site/privacy/index.html`;
- the "couldn't send" message in `site/assets/js/site.js`.

Search for `dalilwayfinding@gmail.com` in each file.

### Swap a photo

Each picture exists in several sizes and formats (for example `hero-clip-480.avif`, `hero-clip-800.webp`, `hero-clip-1200.jpg`), so phones download small files. Replacing one cleanly means making every size again. The easiest way is to ask Claude: "Replace the hero photo in `dalil/site` with this image, keeping the same file names and sizes."

### Preview on your computer

In a terminal, from the `dalil/site` folder, run `python3 -m http.server 8000`, then open `http://localhost:8000`. Sending the form only works on Netlify, so on your computer it shows the "couldn't send" message. That's expected.

## QR code

- `qr/qr-dalil.png` (2000 × 2000 px) and `qr/qr-dalil.svg` (sharp at any size) open `https://dalil-invest.netlify.app/?src=qr`.
- Ink `#111315` on white, error correction level H, a wide white border, and the DALIL mark in the centre.
- Checked by reading it back with a QR decoder at full size and at 160 px, and blurred, tilted 8° and at low contrast. It decoded the right address every time.

On the closing slide, make it big: about a third of the slide's height, on a plain white area, so people can scan it from their seats. On paper, keep it at least 3 cm wide (a common rule of thumb for scanning up close).

If the final address is different, remake it from the `dalil/tools` folder:

```bash
npm install qrcode@1.5.4 jsqr@1.4.0 pngjs@7.0.0 playwright
node make-qr.js "https://YOUR-NAME.netlify.app/?src=qr" ../qr
```

The script prints the address it read back from the new image, so you know it works.

## What was checked

Tested locally on 12 October 2026 with a server that copies Netlify's form handling and security rules.

### Lighthouse, phone settings

| Page | Performance | Accessibility | Best practices | SEO |
|---|---|---|---|---|
| Home | 100 | 100 | 100 | 100 |
| Thanks | 100 | 100 | 100 | 66 |
| Privacy | 100 | 100 | 100 | 100 |

The thanks page scores 66 for SEO on purpose: it's hidden from Google (`noindex`), because only people who sent the form should see it.

- **Speed:** largest image shows in about 1.3 s on a simulated slow phone, nothing jumps as the page loads, and the main photo is 11 KB on a phone (15 KB on a large desktop screen).

### Accessibility

- axe reports 0 problems on every page, including the form's error state.
- Colours meet WCAG 2.2 AA (exact ratios are in `DESIGN.md`).
- Every image has a description.
- The braille samples are explained in words.
- The page works with reduced motion and with Windows high-contrast mode.

### Form

The form passed 22 automatic checks:

- Fill it in and send it with the keyboard only.
- Error messages are announced, listed at the top, and each one jumps to its field.
- Every field arrives in the lead.
- `src=qr` is recorded.
- The spam trap stays empty.
- Sending still works with JavaScript switched off.
- The phone's sticky button never covers the field you're typing in.

### Layout

No sideways scrolling at 320, 375, 390, 768, 1024, 1440 or 1920 px wide.

## Notes and open items

- **Investor pack:** `DALIL_investor_pack.pdf` is a one-page placeholder. Replace it before sharing the QR code.
- **`[SOURCE]`:** the tag is still showing next to the 21.8 million figure.
- **Team photos:** Ahmed's source photo is small (150 px), so it looks slightly soft even at its small size on the page. A sharper photo would help. Mohammed's is fine.
- **Visualisations left out:**
  - The mall visualisation is not used, because it shows real shop signs.
  - The door visualisation is cropped to remove a "Medical Waste" sign.
  - The hand-on-rail photo is not used, because the clip isn't visible in it.
- **The pitch deck** was used only for wording. It's not on the site and not in this repository.
