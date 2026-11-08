// Frame-accurate renderer: loads index.html in headless Chromium, seeks each frame, screenshots it.
// usage: node render.js <outDir> <fromFrame> <toFrameExclusive> [--times 0,3.5,...] [--scale 0.5]
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path");

const root = __dirname;
const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml",
  ".woff2": "font/woff2", ".png": "image/png", ".jpg": "image/jpeg", ".wav": "audio/wav" };
const args = process.argv.slice(2);
const outDir = args[0]; fs.mkdirSync(outDir, { recursive: true });
const timesArg = args.indexOf("--times");
const times = timesArg >= 0 ? args[timesArg + 1].split(",").map(Number) : null;

(async () => {
  const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  await page.route("http://film.local/**", r => {
    const p = path.join(root, decodeURIComponent(new URL(r.request().url()).pathname));
    if (!p.startsWith(root) || !fs.existsSync(p)) return r.fulfill({ status: 404, body: "" });
    r.fulfill({ status: 200, contentType: types[path.extname(p)] || "application/octet-stream", body: fs.readFileSync(p) });
  });
  await page.goto("http://film.local/index.html");
  await page.waitForFunction(() => window.READY !== undefined, null, { timeout: 120000 });
  await page.evaluate(() => window.READY);
  if (errors.length) { console.error("page errors:", errors); process.exit(1); }
  const fps = await page.evaluate(() => window.FPS);
  const list = times ? times.map((t, i) => ({ t, name: `still-${String(t).replace(".", "_")}.png` }))
    : Array.from({ length: Number(args[2]) - Number(args[1]) }, (_, i) => { const f = Number(args[1]) + i; return { t: f / fps, name: `f${String(f).padStart(5, "0")}.png` }; });
  const t0 = Date.now();
  for (const { t, name } of list) {
    await page.evaluate(async (tt) => { await window.seek(tt); }, t);
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.screenshot({ path: path.join(outDir, name), type: "png" });
    if (errors.length) { console.error("page errors at", t, errors); process.exit(1); }
  }
  console.log(`rendered ${list.length} frames in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  await browser.close();
})();
