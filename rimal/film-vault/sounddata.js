// Export the ball's path and the hero's line-start times so the score is driven by the same motion.
const { chromium } = require("playwright"); const fs = require("fs"), path = require("path");
(async () => {
  const b = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  await p.route("http://film.local/**", r => { const f = path.join(__dirname, new URL(r.request().url()).pathname); r.fulfill({ status: fs.existsSync(f) ? 200 : 404, body: fs.existsSync(f) ? fs.readFileSync(f) : "" }); });
  await p.goto("http://film.local/index.html"); await p.waitForFunction(() => window.READY !== undefined); await p.evaluate(() => window.READY);
  fs.writeFileSync(path.join(__dirname, "vo/sounddata.json"), JSON.stringify(await p.evaluate(() => window.SOUNDDATA())));
  await b.close(); console.log("ok");
})();
