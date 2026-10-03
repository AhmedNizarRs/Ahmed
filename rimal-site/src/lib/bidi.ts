/**
 * Bidi helpers. In Arabic text, runs of Latin words, numbers, "$", "+", "@" and "GB"
 * are wrapped in <bdi dir="ltr"> so "+3,000", "26GB", "$25" or "3ds Max" never get
 * reordered by the right-to-left paragraph around them.
 */
import type { Lang } from '../content/products';

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// A run starts with a Latin letter, digit, $, + or @ and may continue through
// spaces/punctuation as long as more Latin/digits follow.
const LTR_RUN = /[@$+]?[A-Za-z0-9][A-Za-z0-9$+%@&._,\-]*(?:[  ]+[@$+]?[A-Za-z0-9][A-Za-z0-9$+%@&._,\-]*)*\+?/g;

export function bidi(text: string, lang: Lang): string {
  const safe = escape(text);
  if (lang !== 'ar') {
    // Arabic inside English text gets isolated the other way round.
    return safe.replace(/[؀-ۿ][؀-ۿ\s]*[؀-ۿ]|[؀-ۿ]/g, (m) => `<bdi dir="rtl" lang="ar">${m}</bdi>`);
  }
  return safe.replace(LTR_RUN, (m) => {
    // Keep trailing sentence punctuation outside the isolate.
    const trail = m.match(/[.,]+$/)?.[0] ?? '';
    const core = trail ? m.slice(0, -trail.length) : m;
    return `<bdi dir="ltr">${core}</bdi>${trail}`;
  });
}
