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
  index.html            # página única, CSS e JS inline
  404.html              # página de erro personalizada
  images/               # fotos optimizadas (jpg + webp), ícones e assets da marca
  favicon.ico           # ícone multi-resolução (16–64 px)
  site.webmanifest      # manifest PWA (ícones, tema, atalhos)
  browserconfig.xml     # mosaicos do Windows / Edge
  robots.txt            # indexação + referência ao sitemap e ao llms.txt
  sitemap.xml           # sitemap com extensão de imagens
  llms.txt              # resumo do site para modelos de linguagem
  humans.txt            # créditos e contactos do site
  .well-known/security.txt
  _headers              # caching, tipos de conteúdo e cabeçalhos de segurança
  _redirects            # canonicalização de /index.html, /home, /inicio
assets/brand/           # arte original da marca (não publicada)
scripts/                # tooling de deploy, QA e capturas
```

### Ficheiros de configuração

| Ficheiro | Para que serve |
|---|---|
| `_headers` | cache (`immutable` para imagens), `Content-Type` explícito, `nosniff`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy` |
| `_redirects` | `/index.html`, `/home` e `/inicio` → `/` com 301 |
| `wrangler.toml` | nome da Worker, `compatibility_date`, `html_handling`, `not_found_handling` |
| `robots.txt` | permite tudo, aponta para o sitemap e para o `llms.txt` |
| `sitemap.xml` | página única + imagens principais, para o Google Search Console |
| `llms.txt` | resumo factual (serviços, contactos, horário) para ChatGPT/Claude/Perplexity |
| `site.webmanifest` | instalação como app: ícones 192/512/maskable, tema `#07080B`, atalhos |
| `browserconfig.xml` | mosaico do Windows e do Edge |
| `favicon.ico` | favicon clássico (16, 24, 32, 48, 64 px) |
| `404.html` | página de erro na identidade da marca |
| `humans.txt` | créditos, contactos e nota de privacidade |
| `.well-known/security.txt` | canal de reporte de segurança (RFC 9116) |
| `llms.txt` link no `<head>` | `<link rel="alternate" type="text/markdown">` |


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
node scripts/verify_config.js # todos os ficheiros de configuração, 301/404 e cabeçalhos
node scripts/verify_head.js   # referências do <head> e ficheiros locais existem
node scripts/shoot.js <url> <nome> [largura] [altura] [full|viewport]
```

As capturas ficam em `scripts/_shots/` (ignorado pelo git).
