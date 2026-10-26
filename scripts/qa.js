/** Static QA: class typos, duplicate ids, missing local assets, tag balance. */
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync('public/index.html', 'utf8');
const publicDir = 'public';

// --- CSS class selectors defined in the page ---
const styleBlocks = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
const cssClasses = new Set();
for (const m of styleBlocks.matchAll(/\.([A-Za-z_][\w-]*)/g)) cssClasses.add(m[1]);

// --- class tokens used in markup ---
const used = new Map(); // token -> count
for (const m of html.matchAll(/class="([^"]*)"/g)) {
  for (const tok of m[1].split(/\s+/).filter(Boolean)) used.set(tok, (used.get(tok) || 0) + 1);
}
const unknown = [...used.keys()].filter((t) => !cssClasses.has(t)).sort();
console.log('classes not defined in CSS:', unknown.length ? unknown.join(', ') : '(none)');

// --- duplicate ids ---
const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
console.log('duplicate ids:', dupes.length ? [...new Set(dupes)].join(', ') : '(none)');

// --- local references exist ---
const refs = new Set();
for (const m of html.matchAll(/(?:href|src|xlink:href|data-src|srcset)="([^"]+)"/g)) {
  const v = m[1].trim();
  if (!v || v.startsWith('http') || v.startsWith('#') || v.startsWith('data:') || v.startsWith('tel:') || v.startsWith('mailto:')) continue;
  refs.add(v.split(',')[0].trim().split(/\s+/)[0]);
}
const missing = [...refs].filter((r) => {
  const clean = r.replace(/^\.\//, '').split('?')[0];
  return !fs.existsSync(path.join(publicDir, clean));
});
console.log('missing local files:', missing.length ? missing.join(', ') : '(none)');

// --- svg <use href="#id"> targets exist ---
const symbolIds = new Set([...html.matchAll(/<(?:symbol|g)[^>]*\sid="([^"]+)"/g)].map((m) => m[1]));
// also plain ids used by svg
const allIds = new Set(ids);
const uses = [...html.matchAll(/<use\s+href="#([^"]+)"/g)].map((m) => m[1]);
const badUse = [...new Set(uses)].filter((u) => !symbolIds.has(u) && !allIds.has(u));
console.log('svg <use> targets missing:', badUse.length ? badUse.join(', ') : '(none)');

// --- rough tag balance for key containers ---
for (const tag of ['section', 'div', 'ul', 'li', 'header', 'footer', 'main', 'nav']) {
  const open = (html.match(new RegExp('<' + tag + '[\\s>]', 'g')) || []).length;
  const close = (html.match(new RegExp('</' + tag + '>', 'g')) || []).length;
  if (open !== close) console.log(`TAG IMBALANCE <${tag}>: ${open} open vs ${close} close`);
}
console.log('template placeholders:', /lorem ipsum|\bTODO\b|PLACEHOLDER|XXX/i.test(html) ? 'FOUND' : 'none');
console.log('http:// insecure refs:', (html.match(/http:\/\/(?!localhost)/g) || []).length);
