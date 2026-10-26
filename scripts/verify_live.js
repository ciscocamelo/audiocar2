/** Verify the deployed site over HTTP. */
const BASE = process.argv[2] || 'https://audiocar2.veriticedigital.workers.dev';

(async () => {
  const r = await fetch(BASE, { cache: 'no-store' });
  const html = await r.text();
  const pick = (re) => (html.match(re) || [])[1] || null;
  console.log('status:', r.status, '| bytes:', html.length);
  console.log('title:', pick(/<title>([^<]*)/));
  console.log('canonical:', pick(/rel="canonical" href="([^"]+)/));
  console.log('og:image:', pick(/property="og:image" content="([^"]+)/));
  console.log('h1:', (pick(/<h1[^>]*>([\s\S]*?)<\/h1>/) || '').replace(/\s+/g, ' ').trim().slice(0, 90));
  console.log('wa.me links:', (html.match(/wa\.me\/351961174508/g) || []).length);
  console.log('tel links:', (html.match(/tel:\+351961174508/g) || []).length);
  console.log('new design (Barlow font):', /Barlow\+Condensed/.test(html));
  console.log('json-ld geo:', /GeoCoordinates/.test(html));
  console.log('sections:', (html.match(/<section[^>]*id="([a-z-]+)"/g) || []).map((s) => s.match(/id="([^"]+)"/)[1]).join(', '));

  for (const p of ['/sitemap.xml', '/robots.txt', '/images/logo-mark.png', '/images/img-1.webp']) {
    const res = await fetch(BASE + p);
    console.log(`asset ${p}:`, res.status, res.headers.get('content-type'), res.headers.get('cache-control'));
  }
})();
