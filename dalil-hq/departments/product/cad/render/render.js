const { chromium } = require('/opt/node-tools/node_modules/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = __dirname;
const types = {'.html':'text/html','.js':'text/javascript','.stl':'application/octet-stream','.mjs':'text/javascript'};
const srv = http.createServer((req,res)=>{ const p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(p,(e,d)=>{ if(e){res.writeHead(404);res.end();return;} res.writeHead(200,{'content-type':types[path.extname(p)]||'application/octet-stream'}); res.end(d);}); }).listen(0);
(async()=>{
  const port = srv.address().port; const out = process.argv[2];
  const scenes = process.argv.slice(3).map(s=>{const [n,w,h]=s.split(':'); return {n,w:+w||1800,h:+h||1200};});
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  for (const s of scenes) {
    const page = await browser.newPage({ viewport: {width:s.w, height:s.h}, deviceScaleFactor: 1 });
    page.on('console', m=>{ if(m.type()==='error') console.log('console:', m.text()); });
    page.on('pageerror', e=>console.log('pageerror:', e.message));
    await page.goto(`http://localhost:${port}/scene.html?scene=${s.n}&w=${s.w}&h=${s.h}`);
    await page.waitForFunction('window.__done===true',{timeout:120000});
    await page.screenshot({ path: path.join(out, `${s.n}.png`) });
    console.log('rendered', s.n); await page.close();
  }
  await browser.close(); srv.close();
})();
