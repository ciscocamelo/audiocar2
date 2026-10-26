/** Report the H1 text as code points plus the fonts actually used. */
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

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

(async () => {
  try {
    await getJson('/json/version');
  } catch {
    spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${path.join(require('os').tmpdir(), 'dsh-chrome-profile')}`, '--no-first-run', '--disable-gpu', 'about:blank'], { detached: true, stdio: 'ignore' }).unref();
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
          reject(new Error('timeout'));
        }
      }, 30000);
    });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false });
  await send('Page.navigate', { url: 'file:///C:/Users/franc/Documents/audiocar2/public/index.html' });
  await sleep(3500);

  const r = await send('Runtime.evaluate', {
    expression: `(async () => {
      await document.fonts.ready;
      const h1 = document.getElementById('hero-title');
      const cs = getComputedStyle(h1);
      const walker = document.createTreeWalker(h1, NodeFilter.SHOW_TEXT);
      const nodes = [];
      let n;
      while ((n = walker.nextNode())) nodes.push({ text: n.nodeValue, codes: [...n.nodeValue].map(c => 'U+' + c.codePointAt(0).toString(16).toUpperCase().padStart(4,'0')).join(' ') });
      return {
        fontFamily: cs.fontFamily,
        fontWeight: cs.fontWeight,
        textTransform: cs.textTransform,
        lineHeight: cs.lineHeight,
        letterSpacing: cs.letterSpacing,
        fontsLoaded: [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family + ' ' + f.weight),
        barlowLoaded: document.fonts.check('700 100px "Barlow Condensed"', 'Â'),
        nodes
      };
    })()`,
    returnByValue: true,
    awaitPromise: true,
  });
  console.log(JSON.stringify(r.result.value, null, 1));
  process.exit(0);
})();
