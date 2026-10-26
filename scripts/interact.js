/** Interaction tests: FAQ accordion, table filters, lightbox, mobile drawer, overflow. */
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9222;
const OUT = path.join(__dirname, '..', 'public', '_shots');
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

class Client {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const p = this.pending.get(m.id);
        this.pending.delete(m.id);
        m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
      }
    });
  }
  send(method, params = {}) {
    const i = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(i, { resolve, reject });
      this.ws.send(JSON.stringify({ id: i, method, params }));
      setTimeout(() => {
        if (this.pending.has(i)) {
          this.pending.delete(i);
          reject(new Error('timeout ' + method));
        }
      }, 30000);
    });
  }
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 200));
    return r.result.value;
  }
}

async function newClient(width, height) {
  const target = await getJson('/json/new?about:blank', 'PUT');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  const c = new Client(ws);
  await c.send('Page.enable');
  await c.send('Runtime.enable');
  await c.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 700 });
  await c.send('Page.navigate', { url: 'http://127.0.0.1:8788/' });
  await sleep(3000);
  await c.eval("document.documentElement.style.scrollBehavior='auto'");
  return c;
}

(async () => {
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
  fs.mkdirSync(OUT, { recursive: true });
  const results = {};

  // ---------- desktop ----------
  const d = await newClient(1440, 900);

  // FAQ
  results.faq = await d.eval(`(async () => {
    const q = document.querySelector('.faq-q');
    const before = q.getAttribute('aria-expanded');
    q.click();
    await new Promise(r => setTimeout(r, 600));
    const panel = document.getElementById(q.getAttribute('aria-controls'));
    const rows = getComputedStyle(panel).gridTemplateRows;
    const after = q.getAttribute('aria-expanded');
    return { before, after, panelRows: rows, panelH: Math.round(panel.getBoundingClientRect().height) };
  })()`);

  // filters
  results.filters = await d.eval(`(async () => {
    const btns = [...document.querySelectorAll('.filters button')];
    const label = btns.map(b => b.textContent.replace(/\\s+/g,' ').trim());
    const count = () => [...document.querySelectorAll('.table-wrap tbody tr')].filter(r => r.offsetParent !== null).length;
    const all = count();
    const ind = btns.find(b => /industrial/i.test(b.textContent));
    ind.click();
    await new Promise(r => setTimeout(r, 400));
    const industrialVisible = count();
    btns[0].click();
    await new Promise(r => setTimeout(r, 400));
    return { label, all, industrialVisible, backToAll: count() };
  })()`);

  // lightbox
  results.lightbox = await d.eval(`(async () => {
    document.querySelector('#galeria button[data-src]').click();
    await new Promise(r => setTimeout(r, 700));
    const lb = document.getElementById('lightbox');
    const open = lb.classList.contains('is-open');
    const img = document.getElementById('lb-img');
    const cap = document.getElementById('lb-caption').textContent;
    const bodyLocked = getComputedStyle(document.body).overflow;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await new Promise(r => setTimeout(r, 500));
    return { open, imgSrc: (img.currentSrc||img.src).split('/').pop(), cap, bodyLocked, closedAfterEsc: !lb.classList.contains('is-open') };
  })()`);

  // nav scrollspy + header state
  results.nav = await d.eval(`(async () => {
    window.scrollTo(0, 1200);
    await new Promise(r => setTimeout(r, 800));
    const h = document.querySelector('header');
    return { scrolledClass: h.className, ariaCurrent: [...document.querySelectorAll('header a[aria-current]')].map(a => a.textContent.trim()) };
  })()`);
  results.desktopOverflow = await d.eval('document.documentElement.scrollWidth > window.innerWidth');

  // ---------- mobile ----------
  const m = await newClient(390, 844);
  results.mobileOverflow = await m.eval('document.documentElement.scrollWidth > window.innerWidth');
  results.mobileScrollW = await m.eval('document.documentElement.scrollWidth');

  results.drawer = await m.eval(`(async () => {
    const toggle = document.querySelector('[aria-controls="drawer"]') || document.querySelector('.nav-toggle') || document.querySelector('header button');
    if (!toggle) return 'no toggle';
    toggle.click();
    await new Promise(r => setTimeout(r, 700));
    const dr = document.getElementById('drawer');
    const cs = getComputedStyle(dr);
    const open = dr.classList.contains('is-open') || cs.visibility === 'visible';
    const links = dr.querySelectorAll('a').length;
    toggle.click();
    await new Promise(r => setTimeout(r, 600));
    return { open, links, closed: !dr.classList.contains('is-open') };
  })()`);

  // mobile hero screenshot
  const shot = await m.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  fs.writeFileSync(path.join(OUT, 'mobile-top.png'), Buffer.from(shot.data, 'base64'));

  // sanity: contact links
  results.links = await m.eval(`({
    wa: [...document.querySelectorAll('a[href*="wa.me"]')].every(a => /^https:\\/\\/wa\\.me\\/351961174508\\?text=/.test(a.href)),
    tel: document.querySelectorAll('a[href^="tel:+351961174508"]').length,
    email: document.querySelectorAll('a[href^="mailto:"]').length,
    externalNoopener: [...document.querySelectorAll('a[target="_blank"]')].every(a => (a.rel||'').includes('noopener'))
  })`);

  console.log(JSON.stringify(results, null, 1));
  process.exit(0);
})().catch((e) => {
  console.error('FAILED', e.message);
  process.exit(1);
});
