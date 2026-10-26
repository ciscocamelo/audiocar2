/**
 * Deploy the static site to Cloudflare Workers Assets via the REST API.
 *
 * Wrangler can't run here (its esbuild step hits a sandbox spawn restriction), so this
 * replicates exactly what `wrangler deploy` does for an assets-only Worker:
 *   1. build a manifest of {path: {hash, size}}
 *   2. POST .../assets-upload-session  -> jwt + buckets of hashes to upload
 *   3. POST .../workers/assets/upload  -> one request per bucket, completion jwt
 *   4. PUT  .../workers/scripts/<name> -> multipart form with the assets metadata
 */
const fs = require('fs');
const path = require('path');
const blake3 = require('blake3-wasm');
const { getToken } = require('./cf');

const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const TOKEN_CACHE = path.join(__dirname, '.cf-token.json');
const API = 'https://api.cloudflare.com/client/v4';
const ACC = 'd16e4acc3b4e3023003f8a83e4feb1c3';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.woff2': 'font/woff2',
};

const IGNORE = new Set(['/_headers', '/_redirects', '/.assetsignore']);

function readToken() {
  return JSON.parse(fs.readFileSync(TOKEN_CACHE, 'utf8')).token;
}

function parseConfig() {
  const toml = fs.readFileSync(path.join(ROOT, 'wrangler.toml'), 'utf8');
  const name = (toml.match(/^name\s*=\s*"([^"]+)"/m) || [])[1];
  const compat = (toml.match(/^compatibility_date\s*=\s*"([^"]+)"/m) || [])[1];
  const dir = (toml.match(/directory\s*=\s*"([^"]+)"/m) || [])[1] || './public';
  const htmlHandling = (toml.match(/^html_handling\s*=\s*"([^"]+)"/m) || [])[1];
  const notFoundHandling = (toml.match(/^not_found_handling\s*=\s*"([^"]+)"/m) || [])[1];
  return { name, compat, dir: path.resolve(ROOT, dir), htmlHandling, notFoundHandling };
}

function walk(dir, base = dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, base, out);
    else out.push(full);
  }
  return out;
}

function buildManifest(dir) {
  const manifest = {};
  for (const file of walk(dir)) {
    const rel = '/' + path.relative(dir, file).split(path.sep).join('/');
    if (IGNORE.has(rel)) continue;
    const buf = fs.readFileSync(file);
    const ext = path.extname(file).substring(1);
    manifest[rel] = {
      hash: blake3.hash(buf.toString('base64') + ext).toString('hex').slice(0, 32),
      size: buf.length,
    };
  }
  return manifest;
}

async function call(token, method, url, body, extraHeaders = {}) {
  const headers = { Authorization: 'Bearer ' + token, ...extraHeaders };
  const res = await fetch(url.startsWith('http') ? url : API + url, { method, headers, body });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 500) };
  }
  return { status: res.status, ok: res.ok, json };
}

async function uploadBucket(token, sessionJwt, entries, dir) {
  const form = new FormData();
  for (const [rel, meta] of entries) {
    const buf = fs.readFileSync(path.join(dir, rel.slice(1)));
    const mime = MIME[path.extname(rel).toLowerCase()] || 'application/octet-stream';
    form.append(meta.hash, new Blob([buf.toString('base64')], { type: mime }), meta.hash);
  }
  const res = await call(token, 'POST', `/accounts/${ACC}/workers/assets/upload?base64=true`, form, {
    Authorization: 'Bearer ' + sessionJwt,
  });
  return res;
}

(async () => {
  const token = readToken();
  const cfg = parseConfig();
  console.log('worker:', cfg.name, '| compat:', cfg.compat, '| dir:', cfg.dir);

  const manifest = buildManifest(cfg.dir);
  const files = Object.keys(manifest);
  const total = files.reduce((n, f) => n + manifest[f].size, 0);
  console.log('assets:', files.length, 'files,', (total / 1024 / 1024).toFixed(2), 'MB');

  // 1. create the upload session
  const session = await call(
    token,
    'POST',
    `/accounts/${ACC}/workers/scripts/${cfg.name}/assets-upload-session`,
    JSON.stringify({ manifest }),
    { 'Content-Type': 'application/json' },
  );
  if (!session.ok) {
    console.error('SESSION FAILED', session.status, JSON.stringify(session.json).slice(0, 800));
    process.exitCode = 1;
    return;
  }
  const { jwt: sessionJwt, buckets } = session.json.result;
  const toUpload = buckets.flat();
  console.log('session ok | buckets:', buckets.length, '| files to upload:', toUpload.length);

  // 2. upload each bucket, keeping the last completion token
  let completionJwt = sessionJwt;
  for (const [i, bucket] of buckets.entries()) {
    if (bucket.length === 0) continue;
    const byHash = new Map(files.map((f) => [manifest[f].hash, f]));
    const entries = bucket.map((hash) => [byHash.get(hash), manifest[byHash.get(hash)]]);
    const res = await uploadBucket(token, sessionJwt, entries, cfg.dir);
    if (!res.ok) {
      console.error(`BUCKET ${i + 1} FAILED`, res.status, JSON.stringify(res.json).slice(0, 600));
      process.exitCode = 1;
      return;
    }
    if (res.json.result && res.json.result.jwt) completionJwt = res.json.result.jwt;
    console.log(`bucket ${i + 1}/${buckets.length} uploaded (${bucket.length} files)`);
  }

  // 3. attach the assets to the Worker script
  const headersFile = path.join(cfg.dir, '_headers');
  const redirectsFile = path.join(cfg.dir, '_redirects');
  const assetConfig = {};
  if (cfg.htmlHandling) assetConfig.html_handling = cfg.htmlHandling;
  if (cfg.notFoundHandling) assetConfig.not_found_handling = cfg.notFoundHandling;
  if (fs.existsSync(headersFile)) assetConfig._headers = fs.readFileSync(headersFile, 'utf8');
  if (fs.existsSync(redirectsFile)) assetConfig._redirects = fs.readFileSync(redirectsFile, 'utf8');
  console.log('asset config:', JSON.stringify({ ...assetConfig, _headers: assetConfig._headers ? '(inline)' : undefined, _redirects: assetConfig._redirects ? '(inline)' : undefined }));

  const metadata = {
    assets: { jwt: completionJwt, config: assetConfig },
    compatibility_date: cfg.compat,
  };

  const form = new FormData();
  form.set('metadata', JSON.stringify(metadata));
  const put = await call(token, 'PUT', `/accounts/${ACC}/workers/scripts/${cfg.name}`, form);
  if (!put.ok) {
    console.error('DEPLOY FAILED', put.status, JSON.stringify(put.json).slice(0, 1200));
    process.exitCode = 1;
    return;
  }
  console.log('deployed ✅', JSON.stringify(put.json.result || {}).slice(0, 300));
})();
