// Verify the OAuth token against real Cloudflare endpoints and list accounts/zones.
const fs = require('fs');
const path = require('path');

const CACHE = path.join(__dirname, '.cf-token.json');
const tok = JSON.parse(fs.readFileSync(CACHE, 'utf8')).token;

async function api(p) {
  const r = await fetch('https://api.cloudflare.com/client/v4' + p, {
    headers: { Authorization: 'Bearer ' + tok },
  });
  return { status: r.status, body: await r.json().catch(() => null) };
}

(async () => {
  const me = await api('/user');
  console.log('/user', me.status, me.body && me.body.result && me.body.result.email);
  const acc = await api('/accounts');
  console.log('/accounts', acc.status, JSON.stringify(acc.body && acc.body.result).slice(0, 400));
  const zones = await api('/zones?per_page=50');
  if (zones.body && zones.body.result) {
    console.log('/zones', zones.status, zones.body.result.map((z) => z.name).join(', ') || '(none)');
  } else {
    console.log('/zones', zones.status, JSON.stringify(zones.body).slice(0, 300));
  }
  const scripts = await api('/accounts/d16e4acc3b4e3023003f8a83e4feb1c3/workers/scripts');
  const names = (scripts.body && scripts.body.result || []).map((s) => s.id);
  console.log('/workers/scripts', scripts.status, names.slice(0, 30).join(', ') || '(none)');
  const pages = await api('/accounts/d16e4acc3b4e3023003f8a83e4feb1c3/pages/projects');
  const pn = (pages.body && pages.body.result || []).map((p) => p.name);
  console.log('/pages/projects', pages.status, pn.join(', ') || '(none)');
})();
