# AUDIOCAR — Car Service

Site institucional da **AUDIOCAR – Car Service**, oficina automóvel e industrial em
Santa Marta de Portuzelo, Viana do Castelo.

- **Site:** https://audiocar2.veriticedigital.workers.dev
- **Telefone / WhatsApp:** +351 961 174 508
- **Morada:** Rua de Talharezes nº 22, 4925-123 Santa Marta de Portuzelo, Viana do Castelo

## Stack

Site estático (HTML + CSS + JavaScript puro, sem build) servido pela Cloudflare através de
**Workers Static Assets**. O `public/` é o directório publicado.

```
public/
  index.html      # página única, CSS e JS inline
  images/         # fotos optimizadas (jpg + webp) e assets da marca
  _headers        # caching e cabeçalhos de segurança
  robots.txt
  sitemap.xml
assets/brand/     # arte original da marca (não publicada)
scripts/          # tooling de deploy, QA e capturas
```

## Deploy

```bash
node scripts/deploy.js
```

Publica `public/` na Worker `audiocar2` através da API da Cloudflare. Autenticação:

```bash
node scripts/cf-login.js   # fluxo OAuth (PKCE); abre o browser para autorizar
```

O `cf.js` verifica o token guardado, renova-o quando expira e persiste os tokens
rotativos, por isso o deploy seguinte funciona sem voltar a autenticar.

### Porque não se usa `wrangler deploy`

O passo de bundling do wrangler depende do esbuild, que falha neste ambiente
(`spawn EPERM`). O `deploy.js` replica o protocolo de upload de assets da Cloudflare
(manifest com hashes blake3 → `assets-upload-session` → upload por buckets → `PUT`
do script), sem depender do wrangler.

## QA

```bash
node scripts/qa.js            # typos de classes CSS, ids duplicados, ficheiros em falta
node scripts/interact.js      # FAQ, filtros, lightbox, drawer mobile, overflow
node scripts/verify_live.js   # confirma o que está publicado
node scripts/shoot.js <url> <nome> [largura] [altura] [full|viewport]
```

As capturas ficam em `scripts/_shots/` (ignorado pelo git).
