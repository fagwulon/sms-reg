# API-CONTRACT.md

> **Who this is for:** the backend engineer. **Status:** the frontend is already built
> against this contract and runs today on an in-browser mock that implements it 1:1.
> Match these shapes and the integration is a one-line switch (`USE_MOCK_API = false`).

Base path: **`/api/v1`**
Content type: `application/json`
Auth: `Authorization: Bearer <token>` on organizer endpoints only.

---

## 1. Conventions

### Error envelope

Every non-2xx response should return a JSON body the frontend already knows how to render.
FastAPI's default validation errors also work (they get mapped automatically).

```json
{
  "detail": {
    "code": "validation_error",
    "message": "Please correct the highlighted fields.",
    "fields": {
      "email": "This email is already registered.",
      "phone": "Enter a valid phone number."
    }
  }
}
```

| Status | `code`               | Meaning                                        |
|--------|----------------------|------------------------------------------------|
| 400    | `bad_request`        | Malformed request                              |
| 401    | `not_authenticated`  | Missing/expired organizer session              |
| 403    | `forbidden`          | Role insufficient for the action               |
| 404    | `not_found`          | Registration / invite not found                 |
| 409    | `duplicate_email`    | Email already registered                       |
| 409    | `already_linked`     | Registration already has a spouse              |
| 409    | `gender_mismatch`    | Spouse links must be male ↔ female             |
| 409    | `already_accepted`   | Invitation already used                        |
| 410    | `invite_expired`     | Invitation past `expires_at`                   |
| 422    | `validation_error`   | Field-level errors in `fields`                 |
| 429    | `rate_limited`       | Too many attempts                              |

Field keys in `fields` **must** match the form field names:
`full_name`, `email`, `phone`, `gender`, `marital_status`, `occupation`,
`age_range`, `city`, `expectations`, `emergency_contact_name`,
`emergency_contact_phone`, `registration_id`.

### Enumerations

```
gender          : "male" | "female"
marital_status  : "single" | "married"
status          : "registered" | "checked_in" | "cancelled"
invite status   : "pending" | "accepted" | "expired" | "revoked"
organizer role  : "admin" | "organizer"
```

> **Note:** the frontend form offers **Single** and **Married**. If the church also
> needs *Engaged* or *Widowed*, add them to the enum and tell the frontend team —
> it is a one-line change in `register.html`.

---

## 2. Public endpoints (no auth)

### 2.1 Create registration

`POST /registrations`

```json
{
  "full_name": "Chinedu Okafor",
  "email": "chinedu@example.com",
  "phone": "+234 803 123 4567",
  "gender": "male",
  "marital_status": "married",
  "occupation": "Tech / Engineering",
  "age_range": "26-32",
  "city": "Port Harcourt",
  "expectations": "Clarity on courtship",
  "emergency_contact_name": "Ada Okafor",
  "emergency_contact_phone": "+234 803 000 0000",
  "wants_spouse_invite": true
}
```

`wants_spouse_invite` is a **frontend convenience flag**: when `true` and
`marital_status == "married"`, also create a spouse invitation and return it in the
same response. If `false`, return `spouse_invite: null` (the attendee can create one later
from their ticket page).

**201 Created**

```json
{
  "registration": {
    "id": "reg_8f2c1a",
    "registration_id": "SMS26-K7QF-0102",
    "full_name": "Chinedu Okafor",
    "email": "chinedu@example.com",
    "phone": "+234 803 123 4567",
    "gender": "male",
    "marital_status": "married",
    "occupation": "Tech / Engineering",
    "age_range": "26-32",
    "city": "Port Harcourt",
    "status": "registered",
    "qr_payload": "SMS26|SMS26-K7QF-0102",
    "created_at": "2026-11-04T09:12:44Z",
    "spouse": null,
    "pending_invite": null
  },
  "spouse_invite": {
    "token": "INV8F3K2L9QX",
    "status": "pending",
    "expires_at": "2026-11-06T09:12:44Z",
    "invite_url": "https://smssummit26.com/invite.html?token=INV8F3K2L9QX"
  },
  "message": "Registration successful."
}
```

**Rules the frontend depends on**

- `registration_id` is **unique, human-readable, non-sequential-looking**: `SMS26-XXXX-0000`
  where `XXXX` is 4 chars from an unambiguous alphabet (`A-Z` minus `I,O` + `2-9`) and the
  suffix is a zero-padded counter. It never changes.
- `qr_payload` is what gets encoded in the QR. Keep it short and scannable — the current
  format `SMS26|<registration_id>` is 20–24 chars and encodes cleanly.
- `email` is unique (case-insensitive). Duplicates → `409 duplicate_email`.
- Phone is validated but **not** unique (couples may share a landline).

---

### 2.2 Get one registration (ticket page + lookup)

`GET /registrations/{registration_id}`

`registration_id` is matched case-insensitively. Returns the same `registration` object
as above, with `spouse` and `pending_invite` populated when relevant:

```json
{
  "id": "reg_8f2c1a",
  "registration_id": "SMS26-K7QF-0102",
  "full_name": "Chinedu Okafor",
  "status": "registered",
  "qr_payload": "SMS26|SMS26-K7QF-0102",
  "spouse": {
    "id": "reg_91bd0e",
    "registration_id": "SMS26-M2XD-0103",
    "full_name": "Adaeze Okafor"
  },
  "pending_invite": {
    "token": "INV8F3K2L9QX",
    "expires_at": "2026-11-06T09:12:44Z",
    "invite_url": "https://smssummit26.com/invite.html?token=INV8F3K2L9QX"
  }
}
```

> ⚠️ **Privacy:** this endpoint is public and keyed by an ID printed on the ticket.
> Return **only** the fields above. Never expose `expectations`, `emergency_contact_*`,
> or organizer notes here — those belong to the admin endpoint.

---

### 2.3 Self check-in

`POST /registrations/{registration_id}/checkin` → returns the updated `registration`.
`409` if cancelled. Idempotent: already checked-in returns **200** with the same record.

---

### 2.4 Spouse invitations

**Create** — `POST /spouse-invitations`

```json
{ "registration_id": "SMS26-K7QF-0102" }
```

```json
{
  "token": "INV8F3K2L9QX",
  "status": "pending",
  "expires_at": "2026-11-06T09:12:44Z",
  "invite_url": "https://smssummit26.com/invite.html?token=INV8F3K2L9QX"
}
```

- Token: **≥ 20 chars, cryptographically random, single-use**.
- TTL: **48 hours** (configurable via `INVITE_TTL_HOURS`).
- If a pending invite already exists, return it instead of minting a new one.
- `409 already_linked` if the inviter is already linked.

**Preview** — `GET /spouse-invitations/{token}` (public, no secrets beyond the inviter's name)

```json
{
  "token": "INV8F3K2L9QX",
  "status": "pending",
  "expires_at": "2026-11-06T09:12:44Z",
  "inviter": {
    "full_name": "Chinedu Okafor",
    "gender": "male",
    "marital_status": "married",
    "registration_id": "SMS26-K7QF-0102"
  },
  "accepted_by": null,
  "can_accept": true
}
```

**Accept** — `POST /spouse-invitations/{token}/accept`

Two modes, discriminated by `mode`:

```json
{ "mode": "existing", "registration_id": "SMS26-M2XD-0103" }
```

```json
{
  "mode": "new",
  "registration": {
    "full_name": "Adaeze Okafor",
    "email": "adaeze@example.com",
    "phone": "+234 803 123 4568",
    "gender": "female",
    "marital_status": "married",
    "occupation": "Business / Finance",
    "age_range": "26-32",
    "city": "Port Harcourt"
  }
}
```

**200**

```json
{
  "message": "Spouse linked successfully.",
  "registration": { "...the accepting attendee..." },
  "spouse": { "...the inviter..." }
}
```

**Rules**

1. Token must be `pending` and unexpired → else `410 invite_expired`.
2. `gender` of the two registrations **must differ** → else `409 gender_mismatch`.
3. Neither registration may already be linked → else `409 already_linked`.
4. A person cannot link to themselves → `409 self_link`.
5. On success: set `spouse_id` on **both** records, mark the invite `accepted`,
   write a `spouse_relationships` row. Both keep their own ID, QR and status.

**Revoke** — `DELETE /spouse-invitations/{token}`
Allowed only before acceptance (`409 already_accepted` otherwise). Returns
`{ "token": "...", "status": "revoked" }`.

---

## 3. Organizer auth

### 3.1 Login — `POST /auth/login`

```json
{ "email": "admin@smssummit.org", "password": "..." }
```

```json
{
  "token": "<jwt>",
  "role": "admin",
  "name": "Precious A.",
  "email": "admin@smssummit.org",
  "expires_at": "2026-11-04T17:12:44Z"
}
```

> The frontend stores the token in `localStorage` (or `sessionStorage` when
> "keep me signed in" is unchecked) and sends it as `Authorization: Bearer <token>`.
> JWTs with an 8-hour expiry work well for an event day.

### 3.2 Me — `GET /auth/me` → the same shape minus `token`.

### 3.3 Logout — `POST /auth/logout` → `{ "ok": true }` (frontend clears the token anyway).

---

## 4. Organizer management (auth required)

### 4.1 List registrations — `GET /admin/registrations`

Query params (all optional):

| Param            | Values / notes                                  |
|------------------|-------------------------------------------------|
| `q`              | free text over name, email, phone, registration ID |
| `gender`         | `male` \| `female`                              |
| `marital_status` | `single` \| `married`                           |
| `status`         | `registered` \| `checked_in` \| `cancelled`     |
| `linked`         | `yes` \| `no`                                   |
| `sort`           | `created_at` (default), `full_name`, `registration_id` |
| `dir`            | `asc` \| `desc` (default `desc`)                |
| `page`           | 1-based, default `1`                            |
| `per_page`       | default `10`, max `100`                         |

```json
{
  "items": [
    {
      "id": "reg_8f2c1a",
      "registration_id": "SMS26-K7QF-0102",
      "full_name": "Chinedu Okafor",
      "email": "chinedu@example.com",
      "phone": "+234 803 123 4567",
      "gender": "male",
      "marital_status": "married",
      "occupation": "Tech / Engineering",
      "age_range": "26-32",
      "city": "Port Harcourt",
      "expectations": "Clarity on courtship",
      "emergency_contact_name": "Ada Okafor",
      "emergency_contact_phone": "+234 803 000 0000",
      "status": "registered",
      "qr_payload": "SMS26|SMS26-K7QF-0102",
      "created_at": "2026-11-04T09:12:44Z",
      "updated_at": "2026-11-04T09:12:44Z",
      "spouse": { "id": "…", "registration_id": "…", "full_name": "…" },
      "invite_accepted": true
    }
  ],
  "total": 42,
  "page": 1,
  "per_page": 10,
  "pages": 5
}
```

### 4.2 Single record — `GET /admin/registrations/{id}` → one item above.

### 4.3 Update status — `PATCH /admin/registrations/{id}`

```json
{ "status": "checked_in" }
```

Returns the updated item. Role: `admin` **or** `organizer`.

### 4.4 Delete — `DELETE /admin/registrations/{id}`

Role: `admin` only. On delete: detach the spouse link on the other record (do **not**
cascade-delete them), revoke that attendee's pending invites, write an audit entry.
Returns `{ "ok": true }`.

### 4.5 Statistics — `GET /admin/stats`

```json
{
  "total": 42,
  "checked_in": 8,
  "cancelled": 1,
  "male": 20,
  "female": 22,
  "single": 26,
  "married": 16,
  "linked_pairs": 6,
  "pending_invites": 3,
  "by_day": [
    { "date": "2026-11-01", "label": "1 Nov", "count": 4 }
  ],
  "by_occupation": [ { "label": "Tech / Engineering", "count": 9 } ]
}
```

`by_day` should contain **the last 14 days including zero-count days** — the chart
renders gaps as empty bars.

### 4.6 Invitations — `GET /admin/spouse-invitations`

```json
[
  {
    "token": "INV8F3K2L9QX",
    "status": "accepted",
    "expires_at": "2026-11-06T09:12:44Z",
    "created_at": "2026-11-04T09:12:44Z",
    "inviter": "Chinedu Okafor",
    "inviter_registration_id": "SMS26-K7QF-0102",
    "accepted_by": "Adaeze Okafor",
    "invite_url": "https://smssummit26.com/invite.html?token=INV8F3K2L9QX"
  }
]
```

### 4.7 Audit log — `GET /admin/audit-log`

```json
[ { "at": "2026-11-04T10:02:11Z", "action": "registration.checked_in", "target": "SMS26-K7QF-0102", "by": "desk@smssummit.org" } ]
```

### 4.8 CSV export — `GET /admin/registrations/export`

`text/csv` with header row:
`registration_id,full_name,email,phone,gender,marital_status,occupation,age_range,city,status,spouse_registration_id,created_at`

---

## 5. CORS

The frontend is served from a different origin (e.g. `https://smssummit26.com`, or
`http://localhost:5500` locally). Configure:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,      # list, from .env
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)
```

`CORS_ORIGINS` in `.env`, comma-separated:
`http://localhost:5500,http://127.0.0.1:5500,https://smssummit26.com`

---

## 6. Tables the frontend expects behind these endpoints

```
registrations(id, registration_id, full_name, email, phone, gender,
              marital_status, occupation, age_range, city, expectations,
              emergency_contact_name, emergency_contact_phone,
              spouse_id → registrations.id, status, qr_payload,
              created_at, updated_at)

spouse_invitations(id, token, inviter_id → registrations.id, status,
                   expires_at, accepted_by → registrations.id,
                   accepted_at, created_at)

spouse_relationships(id, registration_id, spouse_registration_id,
                     linked_at, invited_via → spouse_invitations.id)

organizers(id, name, email, password_hash, role, active, created_at)

audit_log(id, at, action, target, by)
```

Useful constraints/indexes:

```sql
UNIQUE (registration_id);
UNIQUE (lower(email));
UNIQUE (token);
CREATE INDEX ON registrations (created_at DESC);
CREATE INDEX ON registrations (gender, marital_status, status);
-- a registration belongs to at most one live link
UNIQUE (registration_id) ON spouse_relationships (registration_id);
```

---

## 7. Switching the frontend to the live API

`frontend/assets/js/config.js`

```js
window.SMS_CONFIG = {
  API_BASE_URL: 'https://your-backend-domain.com',  // or '' to use a dev proxy
  USE_MOCK_API: false,                                // ← the switch
  API_PREFIX: '/api/v1',
  ...
};
```

Nothing else changes. The mock and the client share the same surface:

| UI action                   | Call                                    |
|-----------------------------|-----------------------------------------|
| Submit registration         | `API.register(payload)`                 |
| Ticket page load            | `API.getRegistration(regId)`            |
| Self check-in               | `API.checkIn(regId)`                    |
| Create spouse invite        | `API.createInvite(regId)`               |
| Invite page load            | `API.getInvite(token)`                  |
| Accept invite               | `API.acceptInvite(token, payload)`      |
| Revoke invite               | `API.revokeInvite(token)`               |
| Organizer login             | `API.login(email, password, remember)`  |
| Organizer session check     | `API.me()`                              |
| Registrations table         | `API.listRegistrations(params)`         |
| Status change               | `API.updateStatus(id, status)`          |
| Delete                      | `API.deleteRegistration(id)`            |
| Dashboard                   | `API.stats()`                           |
| Invites table               | `API.invites()`                         |
| Activity log                | `API.audit()`                           |
| CSV                         | `API.exportCSV()`                       |

---

## 8. Test cases (mirror these in pytest)

- ✅ Successful registration returns `201` + unique `registration_id` + `qr_payload`
- ✅ Invalid payload → `422` with `fields` keyed by form field names
- ✅ Duplicate email → `409 duplicate_email`
- ✅ Registration IDs never collide across 10k inserts
- ✅ QR payload round-trips: scanning yields the exact `registration_id`
- ✅ Invite creation returns a token ≥ 20 chars, TTL = 48h
- ✅ Invite preview never leaks private fields
- ✅ Expired token → `410 invite_expired` (and `status` becomes `expired`)
- ✅ Accepted invite cannot be reused → `409 already_accepted`
- ✅ Same-gender link → `409 gender_mismatch`
- ✅ Linking sets `spouse_id` on both sides and leaves both tickets intact
- ✅ Revoked invite cannot be accepted
- ✅ Unauthenticated admin call → `401`; wrong role → `403`
- ✅ Deleting a registration detaches (not deletes) the spouse
- ✅ CSV export matches the table columns exactly
