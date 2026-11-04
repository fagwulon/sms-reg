# SMS Summit 2026 — Frontend

The registration experience for the **Singles & Married Summit 2026 — The Marital Blueprint**.
Plain HTML, CSS and JavaScript. No build step, no framework, no npm install.

Built from the official flyer artwork: the crimson/black palette, the brush-script **SMS**
wordmark, the heart-hands motif and the falling petals are extracted from the posters and
used as live interface elements rather than static images.

---

## Quick start

```bash
# from the repo root
cd frontend
python3 -m http.server 5500
# → open http://localhost:5500
```

Any static server works (`npx serve`, VS Code Live Server, Netlify, Vercel, GitHub Pages).
Because it is ES5-friendly and dependency-free, it also opens straight from the file system —
though a server is recommended so `localStorage` behaves consistently.

### Run it against the real backend

Open `assets/js/config.js` and change two lines:

```js
API_BASE_URL: 'http://localhost:8000',   // your FastAPI server
USE_MOCK_API: false,                     // stop using the in-browser mock
```

That is the **entire** integration step. See [`docs/API-CONTRACT.md`](docs/API-CONTRACT.md).

---

## What's included

| Page | File | Purpose |
|------|------|---------|
| Home | `index.html` | Flyer-led landing: countdown, theme, spouse-linking explainer, FAQ |
| Register | `register.html` | 3-step wizard with inline validation and spouse-invite opt-in |
| Ticket | `success.html` | Confirmation + live QR, download, share, spouse invitation |
| Find ticket | `lookup.html` | Retrieve a registration by ID, self check-in |
| Invitation | `invite.html` | Spouse accepts a token (new registration or existing) |
| Organizer | `admin/index.html` | Auth-gated dashboard, table, filters, detail drawer, CSV |

### Attendee journey

```
Home → Register (3 steps) → Ticket + QR
                              ├─ Download / print / share
                              ├─ Copy registration ID
                              └─ Create spouse invitation ──→ invite.html (spouse)
                                                                    └─ both linked, two tickets
Lookup → enter SMS26-XXXX-0000 → ticket / self check-in
```

---

## Design system

Everything visual is derived from the two flyers.

**Palette** — sampled from the artwork, defined once in `assets/css/base.css`:

| Token | Hex | Use |
|-------|-----|-----|
| `--crimson-600` | `#9b0f19` | Primary brand red |
| `--crimson-500` | `#b81322` | Buttons, accents |
| `--crimson-400` | `#d0202f` | Glows, active states |
| `--ink-900` | `#0d0506` | Page background |
| `--cream-100` | `#fbf4ec` | Primary text |
| `--champagne` | `#e8c9a8` | Eyebrows, highlights, links |

**Type** — Playfair Display (editorial serif), Bebas Neue (condensed caps, matching the
poster's headline), Inter (UI) and a script face for the "Welcome" / "one" flourishes.

> All four fonts are **embedded as local woff2 files** in `assets/fonts/`.
> Nothing is fetched from Google Fonts, so the site renders identically offline,
> inside sandboxed iframes and on poor venue Wi-Fi.

**Motion**

- Canvas petal fall (the flyer's petals), with cursor repulsion and device-aware density
- Scroll-reveal with staggered delays, scroll progress bar, sticky nav
- 3D pointer tilt on the hero poster, parallax floating hands
- Kinetic counters, animated bar/donut charts, marquee band
- Page-to-page circular veil transition
- Full `prefers-reduced-motion` fallback — all animation is disabled, never required

**Imagery** — the flyer crops are luminance-keyed, feathered WebP assets
(`assets/img/`), so the heart-hands and the brush wordmark sit directly on the page with no
white boxes. Total image payload ≈ 600 KB, with a JPEG fallback of the full flyer.

---

## File map

```
frontend/
├── index.html              landing page
├── register.html           3-step registration
├── success.html            ticket + QR + spouse invite
├── lookup.html             find my ticket
├── invite.html             spouse invitation acceptance
├── admin/
│   └── index.html          organizer portal (login + dashboard)
├── assets/
│   ├── css/
│   │   ├── base.css        tokens, fonts, reset, primitives, motion
│   │   ├── shell.css       nav, drawer, petals, modals, toasts, footer
│   │   ├── pages.css       every page/component style
│   │   └── admin.css       organizer portal
│   ├── js/
│   │   ├── config.js       ★ the only file you edit to go live
│   │   ├── api.js          API client + session handling (mock ⇄ live switch)
│   │   ├── mock-api.js     in-browser backend implementing the contract
│   │   ├── ui.js           petals, reveals, countdown, QR, toasts, modals
│   │   ├── sprite.js       inline SVG icon sprite
│   │   ├── qrcode.min.js   QR generator (bundled, offline)
│   │   ├── home.js / register.js / success.js / lookup.js / invite.js / admin.js
│   ├── img/                flyer crops (WebP + JPEG)
│   └── fonts/              Playfair, Bebas, Inter, script (woff2, embedded)
└── docs/
    ├── API-CONTRACT.md     ★ hand this to the backend engineer
    └── FRONTEND-NOTES.md   design decisions, preview mode, handoff checklist
```

---

## Preview mode (how the demo runs today)

`USE_MOCK_API: true` loads `assets/js/mock-api.js`, which implements **every endpoint in
the contract** with realistic latency, validation, invitation expiry, role checks and a
12-attendee seeded dataset. State lives in `localStorage`, so you can register, reload,
look the ticket up and manage it in the organizer portal.

**Demo organizer accounts**

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@smssummit.org` | `Summit2026!` |
| Desk | `desk@smssummit.org` | `Desk2026!` |

Reset from the portal sidebar ("Reset demo data"), or in the console: `SMSApi.resetDemo()`.

The portal shows a **Preview mode** chip while the mock is active, so nobody mistakes demo
data for live registrations. It disappears the moment `USE_MOCK_API` is `false`.

> In preview mode, spouse invitation links are self-contained (the page carries a snapshot
> in the URL) so a link opened on a *different phone* still works. A real backend resolves
> the token server-side — nothing in the UI changes.

---

## Validation & security notes

Client-side validation is UX, never the source of truth:

- Name: 3–90 chars, letters/space/hyphen/apostrophe
- Email: format + duplicate check (mock; backend must enforce with a unique index)
- Phone: 7–20 chars, ≥ 10 digits, `+234 …` friendly
- Gender and marital status are **required**; gender is restricted to Male/Female
- Spouse linking only ever happens through a token **plus** explicit acceptance — the UI
  never links records by matching names
- Organizer routes are behind a token; destructive delete is `admin`-role only
- No secrets, API keys or `.env` files exist in this folder

**Never trust the client.** The backend must re-validate everything, enforce
`UNIQUE(lower(email))`, keep tokens server-side with a TTL, and scope role checks per route.

---

## Accessibility

- Semantic landmarks, one `<h1>` per page, labelled form controls
- Visible focus rings (`:focus-visible`) tuned to the brand
- Custom radios/checkboxes remain keyboard operable and screen-reader labelled
- `aria-live` toasts, `aria-expanded` accordions, focus-trapped modals
- Contrast checked against the crimson/ink palette; body text is cream on near-black
- Reduced-motion users get a static, complete experience

---

## Browser support

| Browser | Version |
|---------|---------|
| Chrome / Edge | 105+ |
| Safari (iOS) | 16+ |
| Firefox | 110+ |
| Samsung Internet | 20+ |

Uses `:has()` for selected states and `backdrop-filter` for glass panels; both degrade
gracefully. No polyfills required.

---

## Deploying

Static hosting — nothing to build:

```bash
# Netlify
netlify deploy --prod --dir=frontend

# Vercel
vercel --prod frontend

# GitHub Pages / any bucket
# copy the frontend/ folder as-is
```

Checklist before launch:

1. `USE_MOCK_API: false` and `API_BASE_URL` pointing at production
2. Backend `CORS_ORIGINS` includes the exact frontend origin
3. HTTPS everywhere (clipboard, share and camera APIs require a secure context)
4. Replace the `hello@smssummit.org` mailbox and the social links in `config.js`
5. Test the whole journey on a real phone, not just a resized browser window

---

## Credits

Art direction, copy and build follow the **Singles & Married Summit 2026** flyers.
Hosted by **The Potters Tribe**, in partnership with **True Worshippers Assembly**.
15 November 2026 · 4PM WAT · Top Floor, Elyon Primary School, Rumuorosi, Port Harcourt.
