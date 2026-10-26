/** Verify every site configuration file is published correctly. */
const BASE = process.argv[2] || 'https://audiocar2.veriticedigital.workers.dev';

const FILES = [
  '/robots.txt',
  '/sitemap.xml',
  '/llms.txt',
  '/humans.txt',
  '/site.webmanifest',
  '/browserconfig.xml',
  '/.well-known/security.txt',
  '/favicon.ico',
  '/404.html',
];

(async () => {
  let failures = 0;
  const check = (ok, msg) => {
    if (!ok) failures++;
    console.log((ok ? '  ok   ' : '  FAIL ') + msg);
  };

  console.log('== ficheiros de configuração ==');
  for (const p of FILES) {
    const r = await fetch(BASE + p, { cache: 'no-store' });
    const body = await r.text();
    console.log(`${p}  →  ${r.status}  ${r.headers.get('content-type')}  ${r.headers.get('cache-control')}  ${body.length}B`);
    check(r.status === 200, `${p} responde 200`);
    check(body.length > 20, `${p} tem conteúdo`);
  }

  console.log('\n== validação de sintaxe ==');
  const manifest = JSON.parse(await (await fetch(BASE + '/site.webmanifest', { cache: 'no-store' })).text());
  check(manifest.name && manifest.icons.length >= 2, 'webmanifest: JSON válido com ícones');
  for (const icon of manifest.icons) {
    const r = await fetch(BASE + '/' + icon.src.replace(/^\//, ''));
    check(r.status === 200, `ícone do manifest ${icon.src} existe`);
  }
  const bc = await (await fetch(BASE + '/browserconfig.xml')).text();
  check(/<browserconfig>[\s\S]*<tile>/.test(bc), 'browserconfig.xml: XML esperado');
  const sm = await (await fetch(BASE + '/sitemap.xml')).text();
  check(/<urlset/.test(sm) && /<loc>/.test(sm), 'sitemap.xml: urlset com loc');
  check(/llms\.txt/.test(await (await fetch(BASE + '/robots.txt')).text()), 'robots.txt referencia llms.txt');
  check(/Sitemap:/.test(await (await fetch(BASE + '/robots.txt')).text()), 'robots.txt referencia o sitemap');

  console.log('\n== comportamento do servidor ==');
  const idx = await fetch(BASE + '/index.html', { redirect: 'manual' });
  console.log('/index.html →', idx.status, idx.headers.get('location') || '');
  check([301, 302, 200].includes(idx.status), '/index.html resolvido');
  for (const alias of ['/home', '/inicio']) {
    const r = await fetch(BASE + alias, { redirect: 'manual' });
    console.log(alias, '→', r.status, r.headers.get('location') || '');
  }
  const missing = await fetch(BASE + '/pagina-que-nao-existe', { cache: 'no-store' });
  const missingBody = await missing.text();
  console.log('/pagina-que-nao-existe →', missing.status, missingBody.length + 'B');
  check(missing.status === 404, 'caminho desconhecido devolve 404');
  check(/404|não existe/i.test(missingBody), '404 tem página personalizada');

  console.log('\n== cabeçalhos de segurança ==');
  const home = await fetch(BASE, { cache: 'no-store' });
  for (const h of ['x-content-type-options', 'referrer-policy', 'x-frame-options', 'permissions-policy']) {
    const v = home.headers.get(h);
    check(!!v, `${h}: ${v || 'ausente'}`);
  }
  const img = await fetch(BASE + '/images/img-1.webp');
  check(/immutable/.test(img.headers.get('cache-control') || ''), 'imagens com cache immutable');

  console.log(failures === 0 ? '\nTUDO OK' : `\n${failures} PROBLEMA(S)`);
  process.exitCode = failures === 0 ? 0 : 1;
})();
