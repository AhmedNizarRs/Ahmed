// Frame-accurate renderer: loads index.html in headless Chromium, seeks each frame, screenshots it.
// usage: node render.js <outDir> <fromFrame> <toFrameExclusive> [--times 0,3.5,...] [--scale 0.5] [--noblur]
// Fast camera moves are captured as N subframes (fNNNNN_sKK.png); merge_blur.py averages them into one frame.
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path");

const root = path.resolve(__dirname, "..");          // serve rimal/ so the film can use the site's fonts and logo
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml",
  ".woff2": "font/woff2", ".png": "image/png", ".jpg": "image/jpeg" };
const args = process.argv.slice(2);
const outDir = args[0]; fs.mkdirSync(outDir, { recursive: true });
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const times = opt("--times") ? opt("--times").split(",").map(Number) : null;
const scale = Number(opt("--scale") || 1), noblur = args.includes("--noblur"), SHUTTER = 0.5;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: scale });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.route("http://film.local/**", (r) => {
    const p = path.join(root, decodeURIComponent(new URL(r.request().url()).pathname));
    if (!p.startsWith(root) || !fs.existsSync(p)) { errors.push("404 " + p); return r.fulfill({ status: 404, body: "" }); }
    r.fulfill({ status: 200, contentType: types[path.extname(p)] || "application/octet-stream", body: fs.readFileSync(p) });
  });
  await page.goto("http://film.local/film-vault/index.html");
  await page.waitForFunction(() => window.READY !== undefined, null, { timeout: 120000 });
  await page.evaluate(() => window.READY);
  if (errors.length) { console.error("page errors:", errors); process.exit(1); }
  const fps = await page.evaluate(() => window.FPS);
  const shot = async (t, name) => {
    await page.evaluate(async (tt) => { await window.seek(tt); }, t);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.screenshot({ path: path.join(outDir, name), type: "png" });
    if (errors.length) { console.error("page errors at", t, errors); process.exit(1); }
  };
  const t0 = Date.now(); let n = 0;
  if (times) for (const t of times) { await shot(t, `still-${t.toFixed(2).replace(".", "_")}.png`); n++; }
  else for (let f = Number(args[1]); f < Number(args[2]); f++) {
    const t = f / fps, base = `f${String(f).padStart(5, "0")}`;
    const N = noblur ? 1 : await page.evaluate((tt) => window.BLUR(tt), t);
    if (N <= 1) { await shot(t, base + ".png"); n++; continue; }
    for (let i = 0; i < N; i++) { await shot(t + ((i + 0.5) / N - 0.5) * SHUTTER / fps, `${base}_s${String(i).padStart(2, "0")}.png`); n++; }
  }
  console.log(`rendered ${n} images in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  await browser.close();
})();
