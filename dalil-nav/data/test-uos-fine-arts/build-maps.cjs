// Test project: University of Sharjah, College of Fine Arts and Design (plan picture from the founder). INTERNAL TESTING ONLY:
// not a DALIL client or pilot. Run make_dxf.py first (it writes the DXFs and floors.json), then from dalil-nav/:
//   node data/test-uos-fine-arts/build-maps.cjs
// Drives the DALIL Mapper headless like a person would: load the DXF (metres), add the places, set the world
// position, build the walkable map, export. Writes dalil-map_*.json, dalil-project_*.json and the tag CSVs here.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const ROOT = path.resolve(DIR, '../..');
const CFG = JSON.parse(fs.readFileSync(path.join(DIR, 'floors.json'), 'utf8'));

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('file://' + path.join(ROOT, 'mapper/index.html'));
  await page.evaluate(() => { window.__out = {}; window.download = async (name, text) => { window.__out[name] = text; }; });
  for (const F of CFG.floors) {
    const text = fs.readFileSync(path.join(DIR, F.dxf), 'utf8');
    const res = await page.evaluate(async ({ text, F, B, geo }) => {
      const $ = id => document.getElementById(id);
      window.__out = {};
      loadDXFText(text, F.dxf);
      $('selUnits').value = 'm'; applyUnits(false);
      $('inBuilding').value = B; $('inFloor').value = F.floor;
      for (const [nameEn, nameAr, cat, x, y, o = {}] of F.points) addPoint(x, y, { nameEn, nameAr, cat, ...o });
      S.geo = { origin: geo.origin, bearing: geo.bearing, scale: geo.scale };   // World position (see make_dxf.py)
      if (F.indoor === false) $('chkIndoor').checked = false;   // the drawing's outer wall has gaps (see make_dxf.py)
      if (F.thin === false) $('chkThin').checked = false;
      ensureGrids();
      const grid = $('gridStatus').innerText;
      // Which places can be reached on foot from the first place (entrance / lift)? Unreachable ones need fixing.
      const g = S.grids.walk, A = S.points[0], s0 = snapFree(g, A.x, A.y), sr = s0 < 0 ? null : search(g, s0, -1);
      const unreachable = S.points.filter(B => B !== A && (!sr || (t => t < 0 || !extractPath(g, sr.par, s0, t, A, B))(snapFree(g, B.x, B.y)))).map(B => B.nameEn);
      const gc = S.grids.chair, c0 = snapFree(gc, A.x, A.y), cr = c0 < 0 ? null : search(gc, c0, -1);
      const noChair = S.points.filter(B => B !== A && (!cr || (t => t < 0 || !extractPath(gc, cr.par, c0, t, A, B))(snapFree(gc, B.x, B.y)))).map(B => B.nameEn);
      await exportMap(); saveProject(); exportCsv();
      return { grid, exp: $('expStatus').innerText, out: window.__out, unreachable, noChair };
    }, { text, F, B: CFG.building, geo: F.geo });
    console.log(`\n${F.floor}\n  ${res.grid}\n  ${res.exp}\n  unreachable from ${F.points[0][0]}: ${res.unreachable.length ? res.unreachable.join(', ') : 'none'}\n  no step-free route from ${F.points[0][0]}: ${res.noChair.length ? res.noChair.join(', ') : 'none'}`);
    for (const [name, body] of Object.entries(res.out)) {
      let out = body;
      if (name.startsWith('dalil-map_')) {
        const m = JSON.parse(body); m.geo = { ...m.geo, source: F.geo.source };
        if (CFG.buildingAr) m.building.nameAr = CFG.buildingAr;                    // Arabic building name (draft)
        for (const p of m.points) { const src = F.points.find(q => q[0] === p.nameEn); if (src?.[5]?.doors) p.doors = src[5].doors; }   // door numbers from the drawing
        out = JSON.stringify(m);
      }
      fs.writeFileSync(path.join(DIR, name), out); console.log('  wrote', name, (out.length / 1024).toFixed(0) + ' KB');
    }
    await page.screenshot({ path: path.join(DIR, `preview_${F.floor.toLowerCase().replace(/\s+/g, '-')}.png`) });
  }
  if (errors.length) { console.error('Page errors:', errors); process.exitCode = 1; }
  await browser.close();
})();
