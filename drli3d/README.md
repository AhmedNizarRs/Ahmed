# Dr Li 3D website

A static website for selling 3D prints and custom 3D designs. It's plain HTML, CSS and JavaScript, so there's nothing to install or build.

## See it

Double-click `index.html` to open it in a browser (Chrome, Edge, Safari or Firefox).

## Make it yours

Everything you're likely to change is at the top of `assets/js/app.js`:

- `orderEmail`: the inbox that receives orders and custom design requests. It's set to `orders@example.com`, so change it before going live.
- `currency`, `baseFee`, `machineRate`, `materials`: these drive the prices in the custom design studio's estimate.
- `PRODUCTS`: the shop items. Each has a name, category, material, size, price, description and 3D shape.

Text on the page (headings, FAQ, footer) is in `index.html`. Colours and fonts are in `assets/css/style.css`.

## Put it online (free)

Any static host works. Upload the whole folder with `index.html` at the top level.

- **Netlify Drop**: drag the folder onto https://app.netlify.com/drop and you get a link in seconds.
- **Vercel**: run `npx vercel` in this folder, or import it from GitHub at https://vercel.com/new.
- **GitHub Pages**: put the files in a repository, then go to Settings → Pages and deploy from the main branch.

## How orders work

There's no payment system. When a customer checks out or sends a custom design request, the site builds an order summary they can email to `orderEmail` or copy. To take payments directly, link products to Stripe Payment Links, Gumroad or similar.

## Credits

- three.js r128 (MIT), in `assets/vendor/`
- Geist and Geist Mono fonts (SIL Open Font License)
- Phosphor Icons (MIT)
