# AUDIOCAR — Redesign brief (read this fully before writing code)

You are rebuilding the marketing site for **AUDIOCAR – Car Service**, a Portuguese workshop.
Deliver **one self-contained file**: `public/index.html`. Language: **European Portuguese (pt-PT)**.
It must look like a premium, modern, dark automotive/industrial brand site — not a generic
Tailwind template. Quality bar: something you'd be happy to put in a design portfolio.

## 1. Business facts (use exactly — never invent prices, years, or staff names)

- Name: **AUDIOCAR** — tagline **CAR SERVICE**
- Activity: oficina de mecânica geral, eletrónica automóvel, car audio/multimédia,
  ar condicionado automóvel, bobinagem e manutenção de equipamentos industriais
  (grupos geradores a diesel).
- Telefone / WhatsApp: **+351 961 174 508** → `tel:+351961174508` and `https://wa.me/351961174508?text=<urlencoded>`
- Morada: **Rua de Talharezes nº 22, 4925-123 Santa Marta de Portuzelo, Viana do Castelo**
- Horário: Segunda a sexta 08:30–19:00 · Sábado 09:00–12:00 · Domingo encerrado
- No email and no social profiles exist — do not invent any. Do not invent a founding year;
  if you want an experience claim use a neutral phrase like "anos de estrada" or omit it.
- Maps link: `https://www.google.com/maps/search/?api=1&query=Rua%20de%20Talharezes%2022%2C%204925-123%20Santa%20Marta%20de%20Portuzelo%2C%20Viana%20do%20Castelo`
- Maps embed: `https://www.google.com/maps?q=Rua+de+Talharezes+22,+4925-123+Santa+Marta+de+Portuzelo,+Viana+do+Castelo&output=embed`

## 2. Assets already in `public/images/` (do not create new images)

| file | what it shows | use for |
|---|---|---|
| `img-1.jpg` (+`.webp`) | wide workshop shot, red sports car on a lift, diagnostic screens | hero background |
| `img-2.jpg` | mechanic pouring motor oil into an engine | mudança de óleo |
| `img-3.jpg` | technician with laptop connected to a car (diagnostics) | diagnóstico eletrónico |
| `img-4.jpg` | premium car interior / dashboard | car audio & multimédia |
| `img-5.jpg` | technician working on engine bay with A/C service equipment | ar condicionado |
| `img-6.jpg` | industrial diesel generator being serviced in a workshop | grupos geradores |
| `img-7.jpg` | electric motor armature being rewound (copper coils) | bobinagem |
| `logo-mark.png` | shield + sports-car mark, **transparent**, red glow | header icon, favicon, bullets |
| `logo-full.png` | mark + AUDIOCAR + CAR SERVICE lockup, transparent | footer, hero accent |
| `logo-word.png` | "AUDIOCAR" wordmark only, transparent | inline wordmark next to mark |
| `logo-tagline.png` | "CAR SERVICE" only | optional footer detail |
| `icon-192.png`, `icon-512.png`, `favicon.png` | square icons built from the mark | favicons / web manifest |

Use `<picture>` with `image/webp` first and the `.jpg` as fallback for all photos.

## 3. Visual direction (follow closely)

**Mood:** dark, precise, industrial-premium. Think performance garage meets engineering
firm — deep blacks, hairline borders, one strong red accent, tight typography, generous
negative space. Absolutely no purple/blue gradients, no cartoonish emoji, no rounded-blob
"saaS" look. Sharp corners or small radii (8–14px), 1px borders, subtle inner glows.

**Palette (CSS variables):**
```
--bg:#07080B   --surface:#0E1014   --surface-2:#14171D   --line:rgba(255,255,255,.08)
--text:#F3F4F6 --muted:#9BA1AC    --brand:#E8342B     --brand-2:#FF6A3D
--brand-soft:rgba(232,52,43,.12)
```
Accent gradient: `linear-gradient(135deg,#E8342B 0%,#FF6A3D 100%)`.
Red is the ONLY accent colour. Secondary emphasis comes from white and grey, not a second hue.

**Typography (Google Fonts):**
- Display: `Barlow Condensed` 600/700 — uppercase, tight tracking, big sizes (clamp()).
- Body: `Inter` 400/500/600.
- Labels/eyebrows/numbers: `JetBrains Mono` 500 — uppercase, letter-spacing .2em, 11px.

**Signature details to include:**
- Sticky header that shrinks and gains a blurred dark backdrop after scrolling; logo mark +
  wordmark on the left, nav centre, phone + red WhatsApp button on the right.
- Hero: full-viewport, `img-1` as background with a heavy layered dark gradient (bottom fade
  into `--bg`) plus a soft red radial glow behind the headline. Large condensed headline,
  one-sentence subline, primary red CTA "Pedir orçamento" (WhatsApp) + ghost CTA "Ver serviços".
  A thin trust row underneath: "Orçamento gratuito · Resposta rápida · Serviço especializado".
- An infinite marquee strip (CSS animation) of service keywords with red diamond separators,
  paused on hover and disabled under `prefers-reduced-motion`.
- Section eyebrows numbered like `01 — SERVIÇOS` in JetBrains Mono with a short red rule.
- Service cards: photo with dark gradient overlay, icon, title, one-line description, and a
  "Pedir orçamento →" link whose `wa.me` text is prefilled per service. Hover: border turns
  red, image scales 1.05, arrow slides.
- A "Porquê a AUDIOCAR" block: sticky left heading, right column of 4 numbered reasons
  (rigor técnico, equipamento de diagnóstico, soluções industriais, atendimento direto).
- Contact section: two columns — left = address, phone, WhatsApp button, opening-hours table
  with today's row subtly highlighted by JS; right = Google Maps iframe (lazy loaded,
  `loading="lazy"`, rounded 14px, border).
- Final CTA band on the brand gradient with the mark faintly behind the text.
- Footer: logo-full, short blurb, quick links, contact block, hour list, copyright with
  dynamic year, and a discreet "Site por …" credit line that can stay generic.

**Motion:** subtle and fast. Scroll-reveal via `IntersectionObserver` (translateY 16px +
opacity, 500ms, stagger 60–80ms). Counters for 3–4 stats. No GSAP, no scroll-jacking.
Everything must be disabled/neutralised under `prefers-reduced-motion: reduce`.

## 4. Sections, in order

1. `<header>` sticky nav (mobile: full-screen drawer or slide-down panel with big links).
2. Hero (id="inicio").
3. Marquee strip.
4. Serviços (id="servicos") — 6 cards: mudança de óleo e filtros · diagnóstico eletrónico e
   eletricidade automóvel · car audio e multimédia · ar condicionado · grupos geradores
   industriais · bobinagem de motores.
5. Porquê a AUDIOCAR (id="sobre").
6. Tabela de serviços (id="tabela") — reuse the real table content from the current
   `public/index.html` (read it), restyled as a dark, hoverable, responsive table (cards on mobile).
7. Galeria (id="galeria") — 7 photos with captions, masonry-ish grid, click → accessible
   lightbox (Esc closes, ←/→ navigate, focus trapped).
8. Depoimentos (id="depoimentos") — 3 short, believable pt-PT testimonials (first name +
   town in the Viana do Castelo region), keep them modest and generic; 5-star marks.
9. FAQ (id="faq") — accordion, 5 questions with real answers (orçamentos, garantia,
   tempo de reparação, deslocação a empresas, marcas).
10. Contactos (id="contactos") — as described above.
11. CTA band.
12. `<footer>`.

## 5. Technical requirements

- **Self-contained**: everything in `public/index.html` — `<style>` and `<script>` inline.
- Tailwind Play CDN + inline `tailwind.config` extending colours/fonts — OR plain hand-written
  CSS; either is fine, but the result must not depend on a build step.
- Google Fonts via `<link>` with `preconnect` + `display=swap`. Preload `img-1`.
- **Vanilla JS only**, no frameworks, no GSAP, no external JS libraries.
- Semantic HTML5, one `<h1>`, logical heading order, `aria-*` on interactive widgets,
  visible `:focus-visible` styles, skip link, `alt` on every image, ≥4.5:1 contrast on text.
- Mobile-first and fully responsive at 360 / 768 / 1024 / 1440. No horizontal scroll.
  Test mentally at 360px: nothing may overflow, tap targets ≥44px.
- Images: `loading="lazy"` + `decoding="async"` except the hero; set `width`/`height`.
- SEO: `<title>`, meta description, canonical, `theme-color` `#07080B`, Open Graph + Twitter
  tags, `<link rel="icon">` to `images/favicon.png`, apple-touch-icon `images/icon-192.png`,
  and a `application/ld+json` **AutoRepair** schema with name, telephone, address, opening
  hours, areaServed, and image.
- Every WhatsApp link must be `https://wa.me/351961174508?text=…` with a contextual, properly
  URL-encoded pt-PT message. No bare `wa.me/?text=`.
- Small accessible details: `aria-expanded` on accordion/nav toggles, `role="dialog"` +
  `aria-modal` on the lightbox, `aria-current` on active nav item.
- Print nothing to console, no dead `#` links, no lorem ipsum, no TODO placeholders.

## 6. Rules for you (the coding agent)

- Work only with your **Read / Write / Edit / Glob / Grep** tools.
  **Do not run bash, npm, node, git or any shell command** — the sandbox blocks them.
- Read `public/index.html` (current version) first to harvest real content (service table
  rows, FAQ text, service descriptions) and to see what to replace.
- You may Read the images to confirm what they show.
- Write the finished page in **one single `Write` call** to `public/index.html`
  (the whole file, complete and valid — it will be 1000+ lines, that is expected).
- Do not modify anything else in the repo.
- When finished, reply with a 5-line summary: sections built, files written, anything you
  deliberately left out.

Quality over brevity: this is the deliverable, take the space you need.
