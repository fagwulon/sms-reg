# FRONTEND-NOTES.md

Working notes for the team — decisions, quirks and the handoff checklist.

---

## 1. Why no framework?

The brief says HTML/CSS/JS and the repo keeps `frontend/` separate from `backend/`.
A build-free static site means:

- the frontend engineer can open a PR with real files, with no lockfile churn;
- it deploys to any host in seconds;
- it can be reviewed by the church's media team without a toolchain;
- page-to-page transitions still work because every page is a real document.

The trade-off — no component reuse — is handled by shared CSS/JS layers
(`base.css` → `shell.css` → `pages.css`, and `ui.js` for behaviour).

---

## 2. Working with the flyer artwork

The two uploaded flyers are the source of truth. What was extracted and how:

| Asset | Source | Technique |
|---|---|---|
| `flyer-hero.jpg` | Full poster | Untouched, used as the hero poster + register aside |
| `hands-heart.webp` | Top-left of the poster | Luminance-keyed to alpha, edges feathered so it dissolves into the page |
| `hands-right.webp` | Bottom-right gesture | Same key + a vertical fade mask |
| `wordmark.webp` | The brush "SMS" | Keyed to pure white, tight crop — used in the nav, footer, preloader and ticket |
| `about-media.jpg` | Heart-hands | Crimson duotone for the Welcome section |
| `flyer-wide.jpg` | The wide banner | Save-the-date band |
| `texture-crimson.jpg` | Lower-left swirl | Blurred, screen-blended hero texture |

**If a designer supplies a proper transparent PNG of the hands or the mark**, drop it into
`assets/img/` with the same filename and everything updates — no CSS changes.

**Do not** re-export these at large sizes. The keyed crops are already 2× the largest
display size, and keeping them under ~160 KB each is what keeps the mobile experience fast.

---

## 3. Preview mode (mock API)

`assets/js/mock-api.js` is a complete, in-browser implementation of the contract. It exists
so the UI could be built, reviewed and demoed before the backend was ready.

**It is not a security model.** It is deleted from the critical path by one flag:

```js
// assets/js/config.js
USE_MOCK_API: false
```

Things it deliberately gets right, so integration holds no surprises:

- field-level errors keyed by the exact form field names
- duplicate email detection → `409`
- invitation TTL, single-use, revoke, expiry → `410`
- gender-mismatch and already-linked guards on spouse acceptance
- role checks (`admin` can delete, `organizer` cannot)
- audit entries for every organizer action
- realistic latency (250–1000 ms) so loading states are exercised

Things it fakes on purpose:

- passwords are hashed with a toy digest in `localStorage` — real auth is the backend's job
- invitation links carry a snapshot in the URL `p=` param so cross-device demos work

---

## 4. Decisions worth knowing

**Registration IDs** — `SMS26-XXXX-0000`. The 4-letter block avoids `I`, `O`, `0`, `1` so
it can be read aloud over the phone at the desk. The frontend treats the ID as
case-insensitive everywhere and upper-cases on input.

**Marital status** — only *Single* and *Married* in the UI, matching the summit's two
audiences and the spouse-linking feature. *Engaged* exists in the mock data so the enum
tolerates it, but the form doesn't offer it. If the church wants it, add one `<label>` to
the segmented control and one enum value on the backend.

**Spouse linking** — three hard rules, enforced in the UI copy and in the mock:
1. Two separate registrations, two separate tickets, two separate check-in states.
2. A token + explicit `I accept` — never name matching, never automatic.
3. Links must be male ↔ female (the invitation prefills the opposite gender).

**QR content** — `SMS26|<registration_id>`. Short enough to scan reliably at low resolution
and from a phone screen, and it round-trips to the lookup page. The desk can also type the
ID if a scan fails.

**The ticket is a document** — `success.html` renders a print-friendly card, and
"Download ticket" composes a 1080×1500 PNG on a canvas (branded, with the QR baked in), so
attendees can save it to their camera roll or print it.

**Email** — the frontend does not send confirmation emails. It shows everything on screen
and offers download/share. The backend owns email delivery; if it's added, the ticket page
should stay the primary confirmation.

---

## 5. Accessibility & performance choices

- Every font is local (4 files, ~140 KB total), so first paint never waits on a CDN.
- Hero poster is `fetchpriority="high"`; decorative art is lazy.
- `prefers-reduced-motion` kills the petal canvas, parallax and reveals entirely.
- The canopy effects are one `<canvas>` each, capped at 2× DPR and paused when the tab hides.
- All interactive controls are real `<button>`/`<input>`/`<a>` elements — the custom visuals
  are labels and pseudo-elements, so keyboard and screen-reader users get native behaviour.
- Tap targets ≥ 44 px on mobile.

---

## 6. Handoff checklist

**Frontend → backend**

- [ ] Read `docs/API-CONTRACT.md` end to end (it is written as a spec, not a summary)
- [ ] Confirm the error envelope shape and field key names
- [ ] Confirm marital-status enum (`single`, `married`) before writing migrations
- [ ] Decide the invitation TTL (48h is assumed) and the registration-ID algorithm
- [ ] Agree CORS origins for local, staging and production
- [ ] Wire one endpoint (`POST /registrations`), flip `USE_MOCK_API` locally, test
- [ ] Then the rest — the client surface is listed in the contract's §7

**Before going live**

- [ ] `USE_MOCK_API: false`, `API_BASE_URL` set, HTTPS
- [ ] CORS allows the exact production origin
- [ ] Real organizer accounts created server-side (delete the demo ones)
- [ ] Replace `hello@smssummit.org` and the social URLs in `config.js`
- [ ] Full journey on a real phone: register → ticket → invite → accept → portal
- [ ] Print the ticket once, scan the QR from a phone screen once
- [ ] Load test the desk: 3 organizers filtering + checking in at the same time

---

## 7. Ideas not built (deliberately)

Left for a later decision, so the first release stays focused:

- **Email/SMS delivery** of the ticket — backend + a provider
- **Organizer QR scanner** — the camera APIs need HTTPS and permissions UI; the detail
  drawer already shows a scannable QR for the reverse flow
- **Breakout session selection** and **consent & community** — explicitly out of scope per
  the brief
- **Multi-event support** — the event details are centralised in `config.js` and could become
  a backend resource
