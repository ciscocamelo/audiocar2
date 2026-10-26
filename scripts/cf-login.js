/**
 * Cloudflare OAuth login (PKCE), equivalent to `wrangler login`.
 *
 * Wrangler's own login command exits silently in this environment, so this implements
 * the same public-client flow: open the authorize URL in the default browser, receive
 * the code on http://localhost:8976/oauth/callback, exchange it for tokens and persist
 * them to the wrangler config so the deploy script can use (and refresh) them.
 */
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');
const { spawn } = require('child_process');

const CFG = 'C:/Users/franc/AppData/Roaming/xdg.config/.wrangler/config/default.toml';
const CLIENT_ID = '54d11594-84e4-41aa-b438-e81b8fa78ee7';
const REDIRECT = 'http://localhost:8976/oauth/callback';
const PORT = 8976;
const SCOPES = [
  'account:read', 'user:read', 'workers:write', 'workers_kv:write', 'workers_routes:write',
  'workers_scripts:write', 'workers_tail:read', 'd1:write', 'pages:write', 'zone:read',
  'ssl_certs:write', 'offline_access',
].join(' ');

const b64url = (buf) => buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

const verifier = b64url(crypto.randomBytes(32));
const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
const state = b64url(crypto.randomBytes(16));

const authUrl =
  'https://dash.cloudflare.com/oauth2/auth?' +
  new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT,
    scope: SCOPES,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  }).toString();

function persist(tokens) {
  const text = fs.readFileSync(CFG, 'utf8');
  const exp = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();
  let out = text
    .replace(/^oauth_token = ".*"$/m, `oauth_token = "${tokens.access_token}"`)
    .replace(/^refresh_token = ".*"$/m, `refresh_token = "${tokens.refresh_token}"`)
    .replace(/^expiration_time = ".*"$/m, `expiration_time = "${exp}"`);
  fs.writeFileSync(CFG, out);
  fs.writeFileSync(__dirname + '/.cf-token.json', JSON.stringify({ token: tokens.access_token }, null, 2));
  console.log('tokens persisted; expires', exp);
}

function openBrowser(url) {
  try {
    // `start` returns immediately; stdio is ignored so no pipe is captured.
    const child = spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' });
    child.unref();
    console.log('browser launch requested');
  } catch (e) {
    console.log('could not launch browser:', e.message);
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost:8976');
  if (url.pathname !== '/oauth/callback') {
    res.writeHead(404).end('not found');
    return;
  }
  const code = url.searchParams.get('code');
  const gotState = url.searchParams.get('state');
  const err = url.searchParams.get('error');

  if (err || !code) {
    res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<h2>Falhou:</h2><p>${err || 'sem código'}</p>`);
    console.error('callback error:', err);
    return;
  }
  if (gotState !== state) {
    res.writeHead(400).end('state mismatch');
    console.error('state mismatch');
    return;
  }

  try {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT,
      client_id: CLIENT_ID,
      code_verifier: verifier,
    });
    const r = await fetch('https://dash.cloudflare.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const json = await r.json().catch(() => null);
    if (!r.ok || !json || !json.access_token) {
      console.error('token exchange failed', r.status, JSON.stringify(json).slice(0, 300));
      res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' }).end('<h2>Falha na troca de token</h2>');
      return;
    }
    persist(json);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h2>AUDIOCAR — Cloudflare ligado ✅</h2><p>Pode fechar esta janela.</p>');
    console.log('LOGIN OK');
    setTimeout(() => process.exit(0), 500);
  } catch (e) {
    console.error('exchange error', e.message);
    res.writeHead(500).end('error');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('AUTHORIZE_URL ' + authUrl);
  openBrowser(authUrl);
});

setTimeout(() => {
  console.error('timed out waiting for approval');
  process.exit(1);
}, 10 * 60 * 1000);
