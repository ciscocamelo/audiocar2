/** Confirm the published HTML references every configuration file. */
const BASE = 'https://audiocar2.veriticedigital.workers.dev/';

(async () => {
  const html = await (await fetch(BASE, { cache: 'no-store' })).text();
  const checks = [
    ['manifest', /rel="manifest" href="([^"]+)"/],
    ['favicon.ico', /rel="icon" href="favicon\.ico"/],
    ['apple-touch-icon', /rel="apple-touch-icon" href="([^"]+)"/],
    ['browserconfig', /msapplication-config" content="([^"]+)"/],
    ['llms.txt link', /type="text\/markdown" href="([^"]+)"/],
    ['robots meta', /name="robots" content="([^"]+)"/],
    ['geo position', /name="geo\.position" content="([^"]+)"/],
  ];
  for (const [label, re] of checks) {
    const m = html.match(re);
    console.log((m ? 'ok   ' : 'FAIL ') + label + (m ? ' → ' + (m[1] || '') : ''));
  }
  // every referenced local file must resolve (ignore data-src, which JS completes)
  const refs = [...html.matchAll(/(?<![-\w])(?:href|src)="((?!https?:|#|tel:|mailto:|data:)[^"]+)"/g)].map((m) => m[1]);
  const unique = [...new Set(refs)];
  let bad = 0;
  for (const ref of unique) {
    const r = await fetch(new URL(ref, BASE), { method: 'GET' });
    if (!r.ok) {
      bad++;
      console.log('FAIL ref', ref, r.status);
    }
  }
  console.log(`referências locais verificadas: ${unique.length}, falhas: ${bad}`);
})();
