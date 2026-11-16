// Render stills or the full film from index.html via its seek(t) contract.
//   node render.js stills <lang> <outdir> t1 t2 ...
//   node render.js film <lang> <out.mp4> [workers] [fps]
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const [mode, lang = "en", out, ...rest] = process.argv.slice(2);
const url = "file://" + path.resolve(__dirname, "index.html") + "?lang=" + lang;

async function openPage(browser) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => console.error("pageerror:", e.message));
  page.on("console", (m) => m.type() === "error" && console.error("console:", m.text()));
  await page.goto(url);
  await page.evaluate(() => window.READY);
  return page;
}
const grab = (page, t) => page.evaluate((t) => { window.seek(t); return document.getElementById("c").toDataURL("image/png"); }, t)
  .then((d) => Buffer.from(d.split(",")[1], "base64"));

(async () => {
  const browser = await chromium.launch({ args: ["--disable-gpu", "--font-render-hinting=none"] });
  if (mode === "stills") {
    fs.mkdirSync(out, { recursive: true });
    const page = await openPage(browser);
    for (const t of rest.map(Number)) {
      fs.writeFileSync(path.join(out, `t${t.toFixed(2).padStart(6, "0")}.png`), await grab(page, t));
    }
  } else {
    const workers = Number(rest[0] || 4);
    const page0 = await openPage(browser);
    const { DUR } = await page0.evaluate(() => ({ DUR: window.DUR }));
    await page0.close();
    const fps = Number(rest[1] || 30);
    const N = Math.round(DUR * fps);
    const per = Math.ceil(N / workers);
    const tmp = out + ".parts"; fs.mkdirSync(tmp, { recursive: true });
    const t0 = Date.now();
    await Promise.all([...Array(workers).keys()].map(async (w) => {
      const a = w * per, b = Math.min(N, a + per);
      if (a >= b) return;
      const page = await openPage(browser);
      const ff = spawn("ffmpeg", ["-loglevel", "error", "-y", "-f", "image2pipe", "-c:v", "png", "-framerate", String(fps), "-i", "-",
        "-c:v", "libx264", "-preset", "medium", "-crf", "14", "-pix_fmt", "yuv420p", path.join(tmp, `p${w}.mp4`)], { stdio: ["pipe", "inherit", "inherit"] });
      for (let f = a; f < b; f++) {
        const buf = await grab(page, f / fps);
        if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
        if (w === 0 && (f - a) % 60 === 0) console.log(`worker0 ${f - a}/${b - a}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
      }
      ff.stdin.end();
      await new Promise((r) => ff.on("close", r));
    }));
    const list = [...Array(workers).keys()].filter((w) => fs.existsSync(path.join(tmp, `p${w}.mp4`))).map((w) => `file 'p${w}.mp4'`).join("\n");
    fs.writeFileSync(path.join(tmp, "list.txt"), list);
    await new Promise((r) => spawn("ffmpeg", ["-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", path.join(tmp, "list.txt"), "-c", "copy", out], { stdio: "inherit" }).on("close", r));
    console.log(`rendered ${N} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s -> ${out}`);
  }
  await browser.close();
})();
