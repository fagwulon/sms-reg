# SMS Summit 2026 — Backend (FastAPI)

Backend for the Singles & Married Summit 2026 alternative registration platform.
The frontend lives in `../sms-frontend` and consumes this API. The shared contract
is documented in `../sms-frontend/frontend/docs/API-CONTRACT.md` — **this backend
implements that contract 1:1** (see "Contract notes" below for the few deliberate,
documented differences).

## Stack

- Python 3.11+, FastAPI, Pydantic v2
- SQLAlchemy 2.0 + Alembic (PostgreSQL on Supabase in production; SQLite works for local dev/tests)
- PyJWT for organizer sessions, PBKDF2-SHA256 for password hashing
- `qrcode` for server-side QR PNG rendering
- Pytest + httpx for tests

## Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env              # fill in DATABASE_URL, SECRET_KEY, CORS_ORIGINS, ...
alembic upgrade head              # create schema (PostgreSQL on Supabase, or local SQLite)

# create the first organizer account
python scripts/create_organizer.py \
    --email admin@smssummit.org --password 'Summit2026!' --name 'Precious A.' --role admin

uvicorn app.main:app --reload     # http://localhost:8000
```

Swagger UI: **http://localhost:8000/docs** · ReDoc: `/redoc` · health: `/health`

## Environment variables (`.env.example`)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (Supabase). `postgresql+psycopg://...` |
| `SECRET_KEY` | JWT signing secret — generate with `python -c "import secrets; print(secrets.token_urlsafe(48))"` |
| `CORS_ORIGINS` | Comma-separated allowed frontend origins |
| `APP_URL` | Public frontend URL, used to build `invite_url` links |
| `INVITE_TTL_HOURS` | Spouse invitation TTL (default 48h) |
| `RATE_LIMIT_PER_MINUTE` | Per-IP rate limit on sensitive public endpoints (0 disables) |
| `ACCESS_TOKEN_EXPIRE_HOURS` | Organizer JWT lifetime (default 8h) |
| `QR_PREFIX` | QR payload prefix (default `SMS26`) |

**Never commit `.env` or any secret.** The Supabase service-role key must never
reach the frontend or this repo.

## Database / Supabase

A Supabase project is already wired up: the pooled connection string
(`aws-0-eu-west-1.pooler.supabase.com:6543`) is stored in `backend/.env`
(gitignored — never commit it). To apply the schema from any machine with
network access to Supabase:

```bash
cd backend
venv/bin/alembic upgrade head
venv/bin/python scripts/create_organizer.py --email admin@smssummit.org \
    --password 'Summit2026!' --name 'Precious A.' --role admin
```

(Note: this dev sandbox blocks raw Postgres egress, so migrations were verified
via Alembic offline SQL generation for the PostgreSQL dialect + the full pytest
suite on SQLite; run `alembic upgrade head` once from an unrestricted network.)

Setup from scratch:

1. Create a Supabase project → Project Settings → Database → Connection string (URI mode).
2. Put the URI in `DATABASE_URL` (use port 5432 direct connection, or 6543 pooler).
3. Run `alembic upgrade head`.
4. Create organizer accounts with `scripts/create_organizer.py`.

Tables (see `database/README.md` for the full schema): `attendees`,
`spouse_invitations`, `spouse_relationships`, `organizers`, `audit_log`.
Invitation tokens are stored **only as SHA-256 hashes**; passwords only as
PBKDF2 hashes. Row Level Security on Supabase should stay restrictive — the
backend enforces authorization itself and must not rely on RLS alone.

## API overview (base path `/api/v1`)

### Public
| Method | Path | Notes |
|---|---|---|
| POST | `/registrations` | Create registration → `201` `{registration, spouse_invite, message}` |
| GET | `/registrations/{registration_id}` | Public ticket view (safe fields only, case-insensitive) |
| GET | `/registrations/{registration_id}/confirmation` | Confirmation data |
| POST | `/registrations/{registration_id}/checkin` | Self check-in (idempotent; `409` if cancelled) |
| GET | `/registrations/{registration_id}/qr.png` | QR PNG for the ticket |
| POST | `/spouse-invitations` | `{registration_id}` → invite with raw token (shown once) |
| GET | `/spouse-invitations/{token}` | Public preview (inviter name only, no secrets) |
| POST | `/spouse-invitations/{token}/accept` | `{mode:"existing",registration_id}` or `{mode:"new",registration:{...}}` |
| DELETE | `/spouse-invitations/{token}` | Revoke (before acceptance) |

### Organizer (Bearer JWT)
| Method | Path | Role |
|---|---|---|
| POST | `/auth/login` | public |
| GET | `/auth/me` | any |
| POST | `/auth/logout` | any |
| GET | `/admin/registrations` | admin, organizer (filters: `q, gender, marital_status, status, linked, sort, dir, page, per_page`) |
| GET | `/admin/registrations/export` | admin, organizer (CSV) |
| GET/PATCH/DELETE | `/admin/registrations/{id}` | GET/PATCH any staff; DELETE **admin only** |
| GET | `/admin/stats` | any staff |
| GET | `/admin/spouse-invitations` | any staff |
| GET | `/admin/audit-log` | any staff |
| POST | `/admin/qr/verify` | any staff — `{qr_payload}` → attendee summary for check-in |

### Enums
`gender`: `male|female` · `marital_status`: `single|married` ·
`status`: `registered|checked_in|cancelled` · invite: `pending|accepted|expired|revoked` ·
role: `admin|organizer`

### Error envelope
All non-2xx responses:
```json
{"detail": {"code": "...", "message": "...", "fields": {"email": "..."} | null}}
```
Codes: `validation_error` (422), `not_authenticated` (401), `forbidden` (403),
`not_found` (404), `duplicate_email` / `already_linked` / `gender_mismatch` /
`already_accepted` / `self_link` (409), `invite_expired` (410), `rate_limited` (429).

## Contract notes (documented differences from API-CONTRACT.md)

1. **`GET /admin/spouse-invitations` shows a masked token** (`INV…<hash8>`) and a
   placeholder `invite_url`: raw invitation tokens are never stored (only their
   SHA-256 hash), so they cannot be re-displayed after creation. The inviter
   receives the full token/invite_url once, at creation time.
2. **`GET /registrations/{id}` returns only the safe public fields**
   (`id, registration_id, full_name, status, qr_payload, spouse, pending_invite`)
   as required by the privacy note in the contract — `expectations` and
   `emergency_contact_*` are admin-only.
3. **Added endpoints** (additive, no existing contract changed):
   `GET /registrations/{id}/confirmation`, `GET /registrations/{id}/qr.png`,
   `POST /admin/qr/verify`.
4. **422 validation errors are normalized** into the standard error envelope
   (`detail.code = "validation_error"`, `detail.fields` keyed by form field name);
   the frontend client accepts both shapes.
5. **Rate limiting** (default 20 req/min/IP) applies to `POST /registrations`,
   `POST /spouse-invitations`, `POST /spouse-invitations/{token}/accept` and
   `POST /auth/login`; configure with `RATE_LIMIT_PER_MINUTE`.

## Security highlights

- Registration IDs `SMS26-XXXX-NNNN` (random infix from an unambiguous alphabet + counter).
- QR payload is opaque (`SMS26|<registration_id>`), unique per attendee, encodes no PII,
  and is verified server-side via `POST /admin/qr/verify`.
- Invitation tokens: 24-char cryptographically random, single-use, 48h TTL, stored hashed.
- Spouse linking requires explicit acceptance; no name-based auto-linking; one active
  spouse per attendee (enforced by unique constraints); both records stay independent.
- All multi-step operations (registration, invitation acceptance, admin delete) run in a
  DB transaction and roll back on any failure.
- CORS is origin-restricted via env config; admin endpoints require a valid JWT and role.

## Testing

```bash
cd backend
venv/bin/python -m pytest tests/ -q
```

44 tests cover: successful/invalid/duplicate registration, unique IDs, individual QR,
invite create/preview/accept/revoke/expiry, self-link, gender mismatch, double-accept,
already-linked, no auto name-linking, auth 401/403, admin list/stats/CSV/QR-verify,
and delete-detaches-spouse. Tests run against an isolated in-memory SQLite database —
they never touch Supabase.

## Project structure

```
backend/
├── app/
│   ├── api/v1/            # registrations, spouse_invitations, auth, admin routers
│   ├── core/              # config, security (JWT/passwords/tokens), deps (auth)
│   ├── db/                # engine/session, transaction helper
│   ├── models/            # SQLAlchemy models
│   ├── schemas/           # Pydantic request/response schemas + error envelope
│   ├── services/          # business logic, QR, rate limiting
│   └── main.py            # FastAPI app, CORS, error handlers
├── alembic/               # migrations (0001_initial creates all tables)
├── scripts/create_organizer.py
├── tests/
├── requirements.txt
├── alembic.ini
└── .env.example
```
