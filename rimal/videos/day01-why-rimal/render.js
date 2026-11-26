// Usage:
//   node render.js stills 0,7.5,13.2,19.9,22.8,28 out/stills
//   node render.js frames out/frames [workers]
//   node render.js env out/env.json
// Serves /home/user/Ahmed/rimal over HTTP so the page can load the brand fonts and logo.
const { chromium } = require("playwright");
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../..");
const PAGE = "/videos/day01-why-rimal/index.html";
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".woff2": "font/woff2", ".css": "text/css" };

function serve() {
  return new Promise((res) => {
    const srv = http.createServer((req, rsp) => {
      const p = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]));
      if (!p.startsWith(ROOT) || !fs.existsSync(p)) { rsp.writeHead(404); rsp.end(); return; }
      rsp.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
      fs.createReadStream(p).pipe(rsp);
    });
    srv.listen(0, () => res(srv));
  });
}

async function openPage(browser, port) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("response", (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });
  await page.goto(`http://localhost:${port}${PAGE}`);
  await page.evaluate(() => window.READY);
  if (errors.length) throw new Error("page errors: " + errors.join("; "));
  page._errors = errors;
  return page;
}

async function shot(page, t, file) {
  await page.evaluate((t) => window.seek(t), t);
  if (page._errors.length) throw new Error("page errors: " + page._errors.join("; "));
  await page.locator("canvas").screenshot({ path: file });
}

(async () => {
  const [mode, a, b, c] = process.argv.slice(2);
  const srv = await serve();
  const port = srv.address().port;
  const browser = await chromium.launch();
  try {
    if (mode === "stills") {
      fs.mkdirSync(b, { recursive: true });
      const page = await openPage(browser, port);
      for (const t of a.split(",").map(Number)) await shot(page, t, path.join(b, `t${t.toFixed(2)}.png`));
      console.log(JSON.stringify(await page.evaluate(() => window.BOXES())));
    } else if (mode === "frames") {
      fs.mkdirSync(a, { recursive: true });
      const workers = Number(b || 4);
      const probe = await openPage(browser, port);
      const { dur, fps } = await probe.evaluate(() => ({ dur: window.DUR, fps: window.FPS }));
      await probe.close();
      const n = Math.round(dur * fps);
      let next = 0;
      await Promise.all(Array.from({ length: workers }, async () => {
        const page = await openPage(browser, port);
        while (next < n) {
          const f = next++;
          await shot(page, f / fps, path.join(a, `f${String(f).padStart(4, "0")}.png`));
          if (f % 90 === 0) console.log(`frame ${f}/${n}`);
        }
        await page.close();
      }));
    } else if (mode === "env") {
      const page = await openPage(browser, port);
      const env = await page.evaluate(() => {
        const out = [];
        for (let f = 0; f < window.DUR * 30; f++) out.push(window.ENV(f / 30));
        return out;
      });
      fs.writeFileSync(a, JSON.stringify(env));
    }
  } finally {
    await browser.close();
    srv.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
