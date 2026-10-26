/** Capture the viewport after scrolling a selector into view (with generous wait). */
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9222;
const OUT = path.join(__dirname, '..', 'public', '_shots');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const selector = process.argv[2] || '#contactos';
const name = process.argv[3] || 'at';
const waitMs = parseInt(process.argv[4] || '7000', 10);
const vw = parseInt(process.argv[5] || '1440', 10);
const vh = parseInt(process.argv[6] || '950', 10);

function getJson(p, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: PORT, path: p, method }, (res) => {
      let b = '';
      res.on('data', (d) => (b += d));
      res.on('end', () => {
        try {
          resolve(JSON.parse(b));
        } catch {
          reject(new Error('bad json'));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

(async () => {
  let up = false;
  try {
    await getJson('/json/version');
    up = true;
  } catch {}
  if (!up) {
    spawn(
      CHROME,
      [
        '--headless=new',
        `--remote-debugging-port=${PORT}`,
        `--user-data-dir=${path.join(require('os').tmpdir(), 'dsh-chrome-profile')}`,
        '--no-first-run',
        '--disable-gpu',
        '1299',
        'about:blank',
      ].slice(0, 6).concat(['about:blank']),
      { detached: true, stdio: 'ignore' },
    ).unref();
    for (let i = 0; i < 120; i++) {
      try {
        await getJson('/json/version');
        break;
      } catch {
        await sleep(300);
      }
    }
  }

  const target = await getJson('/json/new?about:blank', 'PUT');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const i = ++id;
      pending.set(i, { resolve, reject });
      ws.send(JSON.stringify({ id: i, method, params }));
      setTimeout(() => {
        if (pending.has(i)) {
          pending.delete(i);
          reject(new Error('timeout ' + method));
        }
      }, 40000);
    });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: vw, height: vh, deviceScaleFactor: 1, mobile: vw < 700 });
  await send('Page.navigate', { url: 'http://127.0.0.1:8788/' });
  await sleep(3000);
  await send('Runtime.evaluate', { expression: "document.documentElement.style.scrollBehavior='auto'" });
  await send('Runtime.evaluate', {
    expression: `document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'start'})`,
  });
  await sleep(waitMs);

  const shot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  fs.mkdirSync(OUT, { recursive: true });
  const file = path.join(OUT, name + '.png');
  fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
  console.log('SAVED', file);

  const info = await send('Runtime.evaluate', {
    expression: `JSON.stringify((() => { const f = document.querySelector('iframe'); if (!f) return null;
      const r = f.getBoundingClientRect(); return { src: f.src.slice(0,80), w: Math.round(r.width), h: Math.round(r.height), loading: f.loading }; })())`,
    returnByValue: true,
  });
  console.log('iframe:', info.result.value);
  process.exit(0);
})().catch((e) => {
  console.error('FAILED', e.message);
  process.exit(1);
});
