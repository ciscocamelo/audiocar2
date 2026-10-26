/**
 * Headless Chrome screenshots over CDP (TCP) — dev-browser is unusable here because it
 * communicates through a named pipe, which this sandbox blocks.
 *
 * Usage: node scripts/shoot.js <url> <name> [width] [height] [full|viewport]
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9222;
const OUT_DIR = path.join(__dirname, '_shots');

const url = process.argv[2] || 'http://127.0.0.1:8788/';
const name = process.argv[3] || 'shot';
const width = parseInt(process.argv[4] || '1440', 10);
const height = parseInt(process.argv[5] || '900', 10);
const full = (process.argv[6] || 'full') === 'full';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function getJson(p, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: PORT, path: p, method }, (res) => {
      let b = '';
      res.on('data', (d) => (b += d));
      res.on('end', () => {
        try {
          resolve(JSON.parse(b));
        } catch (e) {
          reject(new Error('bad json from ' + p + ': ' + b.slice(0, 120)));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function waitForBrowser(timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const v = await getJson('/json/version');
      if (v && v.webSocketDebuggerUrl) return v;
    } catch {
      /* not up yet */
    }
    await sleep(300);
  }
  throw new Error('chrome devtools did not come up');
}

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.events = [];
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id !== undefined && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      } else if (msg.method) {
        this.events.push(msg.method);
      }
    });
  }

  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error('timeout: ' + method));
        }
      }, 60000);
    });
  }
}

async function connect(url) {
  const ws = new WebSocket(url);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', () => reject(new Error('ws connect failed')), { once: true });
  });
  return new CDP(ws);
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Reuse a running debug browser if present, otherwise start one.
  let version;
  try {
    version = await waitForBrowser(1500);
  } catch {
    const profile = path.join(require('os').tmpdir(), 'dsh-chrome-profile');
    const child = spawn(
      CHROME,
      [
        '--headless=new',
        `--remote-debugging-port=${PORT}`,
        `--user-data-dir=${profile}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-gpu',
        '--hide-scrollbars',
        '--disable-extensions',
        '--font-render-hinting=none',
        'about:blank',
      ],
      { detached: true, stdio: 'ignore' },
    );
    child.unref();
    version = await waitForBrowser(45000);
  }

  // Create a fresh target and attach.
  const target = await getJson('/json/new?about:blank', 'PUT');
  const cdp = await connect(target.webSocketDebuggerUrl);

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 600,
  });
  await cdp.send('Page.navigate', { url });

  // wait for the load event, then settle network/animations
  const start = Date.now();
  while (!cdp.events.includes('Page.loadEventFired') && Date.now() - start < 45000) await sleep(200);
  await sleep(2500);

  const metrics = await cdp.send('Page.getLayoutMetrics');
  const css = metrics.cssContentSize || metrics.contentSize;
  const pageHeight = Math.min(Math.ceil(css.height), 20000);
  console.log('page height:', pageHeight, 'px | loaded:', cdp.events.includes('Page.loadEventFired'));

  // Scroll the whole page once so IntersectionObserver reveal animations fire,
  // then return to the top before capturing.
  await cdp.send('Runtime.evaluate', {
    expression: "document.documentElement.style.scrollBehavior='auto';",
  });
  const step = Math.max(300, Math.floor(height * 0.75));
  for (let y = 0; y < pageHeight; y += step) {
    await cdp.send('Runtime.evaluate', { expression: `window.scrollTo(0, ${y})` });
    await sleep(160);
  }
  // scroll back to the top without smooth-scroll animation and confirm
  await cdp.send('Runtime.evaluate', {
    expression: 'window.scrollTo(0, 0); document.scrollingElement.scrollTop = 0;',
  });
  await sleep(700);
  const scrollY = (
    await cdp.send('Runtime.evaluate', { expression: 'window.scrollY', returnByValue: true })
  ).result.value;
  if (scrollY !== 0) {
    await cdp.send('Runtime.evaluate', { expression: 'document.scrollingElement.scrollTop = 0;' });
    await sleep(400);
  }
  console.log('scrollY at capture:', (
    await cdp.send('Runtime.evaluate', { expression: 'window.scrollY', returnByValue: true })
  ).result.value);

  // NOTE: do not resize the viewport to the page height — that reflows vh-based
  // sections. Keep the real viewport and capture beyond it with a clip instead.
  const shot = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: full,
    ...(full
      ? { clip: { x: 0, y: 0, width, height: pageHeight, scale: 1 } }
      : {}),
  });
  const file = path.join(OUT_DIR, name + '.png');
  fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
  console.log('SAVED', file);

  // Collect console errors for QA
  const errors = [];
  cdp.ws.addEventListener('message', () => {});
  try {
    const res = await cdp.send('Runtime.evaluate', {
      expression: `JSON.stringify({
        title: document.title,
        h1: (document.querySelector('h1')||{}).textContent,
        sections: [...document.querySelectorAll('section[id],div[id]')].map(e=>e.id).filter(Boolean),
        imgs: [...document.images].filter(i=>!i.complete||i.naturalWidth===0).map(i=>i.currentSrc||i.src),
        overflow: document.documentElement.scrollWidth > window.innerWidth,
        scrollW: document.documentElement.scrollWidth,
        innerW: window.innerWidth,
        waLinks: document.querySelectorAll('a[href*="wa.me"]').length,
        links: document.querySelectorAll('a').length
      })`,
      returnByValue: true,
    });
    console.log('DOM', res.result.value);
  } catch (e) {
    console.log('DOM eval failed', e.message);
  }

  process.exit(0);
})().catch((e) => {
  console.error('FAILED', e.message);
  process.exit(1);
});
