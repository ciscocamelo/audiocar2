// Discover how the audiocar2 worker is published (workers.dev subdomain + custom domains).
const fs = require('fs');
const path = require('path');
const tok = JSON.parse(fs.readFileSync(path.join(__dirname, '.cf-token.json'), 'utf8')).token;
const ACC = 'd16e4acc3b4e3023003f8a83e4feb1c3';

async function api(p) {
  const r = await fetch('https://api.cloudflare.com/client/v4' + p, { headers: { Authorization: 'Bearer ' + tok } });
  return { status: r.status, body: await r.json().catch(() => null) };
}

(async () => {
  const sub = await api(`/accounts/${ACC}/workers/subdomain`);
  console.log('workers.dev subdomain:', sub.status, JSON.stringify(sub.body && sub.body.result));

  const dom = await api(`/accounts/${ACC}/workers/domains`);
  if (dom.body && dom.body.result) {
    for (const d of dom.body.result) console.log('custom domain:', d.hostname, '->', d.service, d.zone_name);
  } else console.log('domains:', dom.status, JSON.stringify(dom.body).slice(0, 300));

  for (const z of ['attos.pt', 'restauranterequinteportugues.pt', 'studioangelasouza.pt']) {
    const routes = await api(`/zones?name=${z}`);
    const zone = routes.body && routes.body.result && routes.body.result[0];
    if (!zone) { console.log('zone miss', z); continue; }
    const r = await api(`/zones/${zone.id}/workers/routes`);
    for (const x of (r.body && r.body.result) || []) console.log(`route[${z}]:`, x.pattern, '->', x.script);
  }
})();
