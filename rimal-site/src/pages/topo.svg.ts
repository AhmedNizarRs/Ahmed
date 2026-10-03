/** The dune-field contour drawing as a static, cacheable SVG (used as a backdrop). */
import type { APIRoute } from 'astro';
import { topo } from '../lib/topo';

export const GET: APIRoute = () => {
  const { lines } = topo({ width: 600, height: 400, seed: 11, levels: 7 });
  const paths = lines
    .map((l) => `<path d="${l.d}"${l.level % 4 === 0 ? ' stroke-width="1.6"' : ' opacity=".6"'}/>`)
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400" preserveAspectRatio="xMidYMid slice"><g fill="none" stroke="#b7833d" stroke-width="1" stroke-linecap="round" vector-effect="non-scaling-stroke">${paths}</g></svg>`;
  return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml' } });
};
