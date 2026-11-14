// Re-export the two demo maps with the current Mapper (v2: walkable grids for on-device routing,
// plus every stored route, which the tests compare against).
// Run from dalil-nav/:   node data/rebuild-demo-maps.cjs
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  await p.goto('file://' + path.join(ROOT, 'mapper/index.html'));
  await p.evaluate(() => { window.__out = {}; window.download = async (n, t) => { window.__out[n] = t; }; });
  const jobs = [
    { name: 'sample', run: () => { loadSample(); } },
    { name: 'hospital-1000', project: fs.readFileSync(path.join(__dirname, 'dalil-project_hospital-building-1000_ground.json'), 'utf8') },
  ];
  for (const j of jobs) {
    const out = await p.evaluate(async ({ project, sample }) => {
      window.__out = {};
      if (sample) loadSample(); else openProject(project);
      document.getElementById('chkRoutes').checked = true;
      await exportMap();
      return { files: window.__out, status: document.getElementById('expStatus').innerText };
    }, { project: j.project, sample: j.name === 'sample' });
    console.log(j.name, '→', out.status);
    for (const [n, t] of Object.entries(out.files)) { fs.writeFileSync(path.join(__dirname, n), t); console.log('  wrote', n, (t.length / 1024).toFixed(0) + ' KB'); }
  }
  if (errors.length) { console.error(errors); process.exitCode = 1; }
  await b.close();
})();
