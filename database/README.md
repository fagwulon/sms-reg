# Database — SMS Summit 2026 Registration

PostgreSQL hosted on **Supabase**, accessed through SQLAlchemy 2.0 from the
FastAPI backend (`../backend`). Schema is managed exclusively with **Alembic**
migrations (`../backend/alembic`) — never edit the production schema by hand.

## Connection

```
DATABASE_URL=postgresql+psycopg://postgres.[project-ref]:[PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:6543/postgres
```

Get it from Supabase: Project Settings → Database → Connection string (URI).
Store it only in the backend `.env` — never in frontend code, and never commit it.
The Supabase **service-role key is backend-only** and must never be exposed to the
frontend.

## Schema (migration `0001_initial`)

### `attendees`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| registration_id | VARCHAR(32) UNIQUE | `SMS26-XXXX-NNNN` |
| full_name | VARCHAR(200) NOT NULL | |
| email / email_lower | VARCHAR(320) UNIQUE | case-insensitive uniqueness via `email_lower` |
| phone | VARCHAR(32) | validated, **not** unique |
| gender | VARCHAR(10) CHECK IN ('male','female') | |
| marital_status | VARCHAR(10) CHECK IN ('single','married') | |
| occupation, age_range, city | VARCHAR | optional |
| expectations | TEXT | optional, admin-only |
| emergency_contact_name / _phone | VARCHAR | optional, admin-only |
| status | VARCHAR(20) CHECK IN ('registered','checked_in','cancelled') | |
| qr_identifier | VARCHAR(64) UNIQUE | opaque `SMS26|<registration_id>` — one per attendee |
| spouse_id | UUID FK → attendees.id ON DELETE SET NULL | nullable; one active spouse |
| created_at / updated_at | TIMESTAMPTZ | |

Indexes: `registration_id`, `email`, `email_lower`, `phone`, `status`,
`qr_identifier`, `created_at`, composite `(gender, marital_status, status)`.

### `spouse_invitations`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| inviter_id | UUID FK → attendees.id ON DELETE CASCADE | |
| token_hash | VARCHAR(64) UNIQUE | **SHA-256 of the token — raw token never stored** |
| status | VARCHAR(10) CHECK IN ('pending','accepted','expired','revoked') | |
| expires_at | TIMESTAMPTZ | TTL 48h (configurable) |
| accepted_by | UUID FK → attendees.id ON DELETE SET NULL | |
| accepted_at, created_at | TIMESTAMPTZ | |

Indexes: `inviter_id`, `token_hash`, `status`, `expires_at`, `(status, expires_at)`.

### `spouse_relationships`
One row per confirmed couple. `attendee_one_id` / `attendee_two_id` FK →
`attendees.id` (both UNIQUE — an attendee can have at most one active spouse),
`attendee_one_id <> attendee_two_id` CHECK (no self-linking),
`invitation_id` FK → `spouse_invitations.id` UNIQUE (one relationship per accepted
invitation). Linking never merges or deletes attendee rows.

### `organizers`
`id` UUID PK, `full_name`, `email` UNIQUE, `password_hash` (PBKDF2-SHA256, never
plaintext), `role` (`admin`/`organizer`), `is_active` BOOLEAN, `created_at`.
Create accounts with `backend/scripts/create_organizer.py`.

### `audit_log`
`id`, `at`, `action` (e.g. `registration.checked_in`, `registration.deleted`),
`target` (registration_id), `by` (organizer email).

## Integrity rules enforced at the DB level

1. Unique `registration_id` and unique `qr_identifier` per attendee.
2. Gender restricted to `male`/`female`; marital status to `single`/`married`.
3. Only one active spouse relationship per attendee (unique constraints).
4. Relationships always connect two different attendees (CHECK constraint).
5. One relationship per accepted invitation (unique `invitation_id`).
6. Organizer emails unique; passwords hashed.
7. Invitation tokens stored only as hashes.

## Transactions

The backend wraps these in a single transaction (rollback on any failure):
attendee registration (record + registration ID + QR identifier) and invitation
acceptance (validate invitation → verify attendees → check existing links →
create relationship → mark invitation accepted).

## Row Level Security

Keep RLS policies restrictive; the FastAPI backend performs its own
authentication/authorization and does not rely on RLS. Do not grant the public
anon key access to `attendees` personal data.

## Example queries

```sql
-- verify a scanned QR code
SELECT registration_id, full_name, status
FROM attendees WHERE qr_identifier = 'SMS26|SMS26-K7QF-0102';

-- find an attendee's spouse
SELECT s.registration_id, s.full_name
FROM attendees a JOIN attendees s ON s.id = a.spouse_id
WHERE a.registration_id = 'SMS26-K7QF-0102';

-- pending, unexpired invitations
SELECT id, inviter_id, expires_at
FROM spouse_invitations
WHERE status = 'pending' AND expires_at > now();

-- registration statistics
SELECT gender, marital_status, status, count(*)
FROM attendees GROUP BY 1, 2, 3;
```
