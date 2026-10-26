/**
 * Cloudflare auth helper.
 *
 * Reads the OAuth credentials wrangler stores, verifies the access token against the
 * real API, refreshes it when expired, and writes the *rotated* tokens back to the
 * wrangler config so the next run keeps working (Cloudflare rotates refresh tokens).
 */
const fs = require('fs');
const path = require('path');

const CFG = 'C:/Users/franc/AppData/Roaming/xdg.config/.wrangler/config/default.toml';
const CLIENT_ID = '54d11594-84e4-41aa-b438-e81b8fa78ee7';

function readConfig() {
  const text = fs.readFileSync(CFG, 'utf8');
  const pick = (k) => {
    const m = text.match(new RegExp('^' + k + ' = "([^"]+)"', 'm'));
    return m ? m[1] : null;
  };
  return { text, token: pick('oauth_token'), refresh: pick('refresh_token'), exp: pick('expiration_time') };
}

function persist({ token, refresh, exp }) {
  const cfg = readConfig();
  let text = cfg.text;
  if (token) text = text.replace(/^oauth_token = ".*"$/m, `oauth_token = "${token}"`);
  if (refresh) text = text.replace(/^refresh_token = ".*"$/m, `refresh_token = "${refresh}"`);
  if (exp) text = text.replace(/^expiration_time = ".*"$/m, `expiration_time = "${exp}"`);
  fs.writeFileSync(CFG, text);
  // also keep the local cache used by the deploy script
  fs.writeFileSync(path.join(__dirname, '.cf-token.json'), JSON.stringify({ token }, null, 2));
}

async function tokenWorks(token) {
  if (!token) return false;
  try {
    const r = await fetch('https://api.cloudflare.com/client/v4/user', {
      headers: { Authorization: 'Bearer ' + token },
    });
    return r.ok;
  } catch {
    return false;
  }
}

async function refresh(refreshToken) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: CLIENT_ID,
  });
  const res = await fetch('https://dash.cloudflare.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = await res.json().catch(() => null);
  if (res.ok && json && json.access_token) {
    return {
      token: json.access_token,
      refresh: json.refresh_token,
      exp: new Date(Date.now() + (json.expires_in || 3600) * 1000).toISOString(),
    };
  }
  console.log('refresh failed:', res.status, JSON.stringify(json).slice(0, 200));
  return null;
}

/** Returns a working access token, refreshing and persisting if needed. */
async function getToken() {
  const cfg = readConfig();
  if (await tokenWorks(cfg.token)) {
    if (cfg.token) fs.writeFileSync(path.join(__dirname, '.cf-token.json'), JSON.stringify({ token: cfg.token }, null, 2));
    return cfg.token;
  }
  console.log('access token invalid/expired — refreshing…');
  const fresh = await refresh(cfg.refresh);
  if (!fresh) {
    throw new Error('no valid credentials — run: node node_modules/wrangler/bin/wrangler.js login');
  }
  persist(fresh);
  console.log('token refreshed and persisted');
  return fresh.token;
}

module.exports = { getToken, readConfig };

if (require.main === module) {
  getToken()
    .then((t) => console.log('OK, token ready (', t.slice(0, 12), '…)'))
    .catch((e) => {
      console.error('AUTH FAILED:', e.message);
      process.exitCode = 1;
    });
}
