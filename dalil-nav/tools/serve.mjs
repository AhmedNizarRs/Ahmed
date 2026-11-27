// Serve the project folder for local work: `npm run serve`, then open http://localhost:8080/app/
// (the app needs the project folder, not app/ alone: its bundled maps live in ../data/).
// Works on Windows, macOS and Linux with Node alone. Sign links (/app/t/<building>/<floor>/<point>) are sent on to
// /app/#t/<building>/<floor>/<point>, as a real host must do too (docs/institution-setup.md).
//
// A phone on the same Wi-Fi can open the "On your network" address to look at the screens, but the camera, motion
// sensors and location only work on HTTPS (or on this computer's own localhost). For a real walk test, publish
// app/ and data/ on an HTTPS host.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = +(process.env.PORT || process.argv[2] || 8080);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.pdf': 'application/pdf', '.dxf': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8' };

http.createServer((req, res) => {
  let p; try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400); return res.end(); }
  if (p === '/') { res.writeHead(302, { Location: '/app/' }); return res.end(); }
  const tag = p.match(/^\/app\/t\/([^/]+)\/([^/]+)\/([^/]+)\/?$/);      // a DALIL sign's link: on to the app, the three parts after the #
  if (tag) { res.writeHead(302, { Location: `/app/#t/${tag[1]}/${tag[2]}/${tag[3]}` }); return res.end(); }
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT + path.sep) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(f).pipe(res);
}).listen(PORT, () => {
  const lan = Object.values(os.networkInterfaces()).flat().find(i => i && i.family === 'IPv4' && !i.internal)?.address;
  console.log(`DALIL\n  Visitor app:     http://localhost:${PORT}/app/\n  Mapper:          http://localhost:${PORT}/mapper/` + (lan ? `\n  On your network: http://${lan}:${PORT}/app/  (screens only: camera, motion and location need HTTPS)` : '') + '\n  Stop with Ctrl+C');
});
