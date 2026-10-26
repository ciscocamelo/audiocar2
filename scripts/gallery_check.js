/** Check every gallery image's load state after scrolling it into view. */
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9222;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

async function main() {
  try {
    await getJson('/json/version');
  } catch {
    spawn(
      CHROME,
      [
        '--headless=new',
        `--remote-debugging-port=${PORT}`,
        `--user-data-dir=${path.join(require('os').tmpdir(), 'dsh-chrome-profile')}`,
        '--no-first-run',
        '--disable-gpu',
        'about:blank',
      ],
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
      }, 30000);
    });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'http://127.0.0.1:8788/' });
  await sleep(3500);
  await send('Runtime.evaluate', { expression: "document.documentElement.style.scrollBehavior='auto'" });

  // scroll to the gallery section and wait for lazy images
  await send('Runtime.evaluate', { expression: "document.getElementById('galeria').scrollIntoView()" });
  await sleep(2500);
  await send('Runtime.evaluate', { expression: "document.getElementById('galeria').scrollIntoView()" });
  await sleep(2500);

  const res = await send('Runtime.evaluate', {
    expression: `JSON.stringify([...document.querySelectorAll('#galeria img')].map((i) => ({
      src: (i.currentSrc || i.src).split('/').pop(),
      complete: i.complete,
      nw: i.naturalWidth,
      rect: (() => { const r = i.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; })(),
      loading: i.loading
    })))`,
    returnByValue: true,
  });
  console.log(res.result.value);
  process.exit(0);
}

main().catch((e) => {
  console.error('FAILED', e.message);
  process.exit(1);
});
