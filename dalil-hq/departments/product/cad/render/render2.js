const { chromium } = require('/opt/node-tools/node_modules/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = __dirname;
const types = {'.html':'text/html','.js':'text/javascript','.stl':'application/octet-stream'};
const srv = http.createServer((req,res)=>{ const p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(p,(e,d)=>{ if(e){res.writeHead(404);res.end();return;} res.writeHead(200,{'content-type':types[path.extname(p)]||'application/octet-stream'}); res.end(d);}); }).listen(0);
(async()=>{
  const port = srv.address().port; const out = process.argv[2];
  const jobs = process.argv.slice(3).map(s=>{const [n,v,w,h]=s.split(':'); return {n,v,w:+w||1800,h:+h||1200};});
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const px = fs.existsSync(path.join(out,'px.json')) ? JSON.parse(fs.readFileSync(path.join(out,'px.json'))) : {};
  for (const j of jobs) {
    const page = await browser.newPage({ viewport: {width:j.w, height:j.h}, deviceScaleFactor: 1 });
    page.on('console', m=>{ if(m.type()==='error') console.log('console:', m.text()); });
    page.on('pageerror', e=>console.log('pageerror:', e.message));
    await page.goto(`http://localhost:${port}/places.html?scene=${j.n}&view=${j.v}&w=${j.w}&h=${j.h}`);
    await page.waitForFunction('window.__done===true',{timeout:180000});
    px[`${j.n}_${j.v}`] = await page.evaluate('window.__px');
    await page.screenshot({ path: path.join(out, `${j.n}_${j.v}.png`) });
    console.log('rendered', j.n, j.v, JSON.stringify(px[`${j.n}_${j.v}`])); await page.close();
  }
  fs.writeFileSync(path.join(out, 'px.json'), JSON.stringify(px)); await browser.close(); srv.close();
})();
