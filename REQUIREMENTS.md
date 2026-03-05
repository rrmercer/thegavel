# The Gavel — Enterprise Requirements v2.0

This document defines the next phase of features for The Gavel, organized by category.
Items are written as acceptance criteria suitable for implementation and testing.

---

## Deprecations

### D1 — Remove client-supplied voter fingerprint

**Status:** Required
**Motivation:** The current `voterFingerprint` is a UUID generated in the browser and stored in `localStorage`. It is trivially spoofable: any user can submit arbitrary UUIDs to cast multiple votes. Deduplication must move server-side.

**Acceptance criteria:**
- `cast-vote` no longer accepts or reads a `voterFingerprint` field from the request body
- Vote deduplication is computed server-side using a hash of the caller's IP address and `User-Agent` header
- The `voter_fingerprint` column is removed from the `votes` table (provide a migration script)
- The frontend no longer generates, stores, or sends a fingerprint
- `useVotedPolls` hook and related localStorage logic is removed from the frontend
- Duplicate vote detection still returns `already_voted` (409) to the caller

---

### D2 — Remove 2–4 options hard cap

**Status:** Required
**Motivation:** Business units require up to 10 options for multi-candidate ballots. The existing cap blocks legitimate use cases.

**Acceptance criteria:**
- `create-poll` validation changed from "2–4 options" to "2–10 options"
- Error message updated to reflect the new limit
- `Poll` and `PollOption` types remain unchanged (no schema change needed)

---

### D3 — Remove anonymous poll creation

**Status:** Required
**Motivation:** Compliance and audit requirements: all polls must be traceable to a creator credential. Fully anonymous creation with no ownership record is not permitted.

**Acceptance criteria:**
- Poll creation requires an `ownerToken` to be issued and stored at creation time (see F2)
- Polls created without an owner token are not permitted
- This is enforced at the function level, not via user accounts

---

## New Features

### F1 — Poll expiry

**Status:** Required

**Acceptance criteria:**
- `create-poll` accepts an optional `closes_at` field (ISO 8601 datetime string)
- If omitted, the poll has no expiry (open indefinitely)
- `closes_at` is stored on the `polls` table (provide a migration script)
- `cast-vote` checks `closes_at` before inserting a vote; if the poll is expired it returns `{ error: 'poll_closed' }` (403)
- `get-results` response includes `is_closed: boolean` derived from `closes_at` vs. current time
- `get-poll` response includes `closes_at` (nullable string) so the frontend can display a closing time

---

### F2 — Owner token for poll management

**Status:** Required
**Depends on:** D3

**Acceptance criteria:**
- `create-poll` generates a cryptographically random UUID as `ownerToken` on every successful creation
- `ownerToken` is stored (hashed with SHA-256) in a new `owner_token_hash` column on the `polls` table (provide a migration script)
- `create-poll` response includes `ownerToken` in plaintext — this is the only time it is returned; the caller must store it
- A new Netlify Function `delete-poll` accepts `{ pollId, ownerToken }` via POST
  - Hashes the provided token and compares to `owner_token_hash`
  - On match: deletes the poll and all associated options and votes (cascade or explicit); returns 200
  - On mismatch: returns `{ error: 'unauthorized' }` (401)
  - On missing poll: returns `{ error: 'not_found' }` (404)

---

### F3 — Poll listing

**Status:** Nice-to-have

**Acceptance criteria:**
- New Netlify Function `list-polls` responds to GET requests
- Accepts optional query params: `page` (default 1) and `limit` (default 20, max 100)
- Returns `{ polls: [{ id, question, created_at, closes_at, is_closed, totalVotes }], total, page, limit }`
- Results ordered by `created_at` descending
- Does not expose `owner_token_hash`
- No auth required (public index)

---

### F4 — Options cap increase (pairs with D2)

**Status:** Required
**Note:** This is the implementation complement to deprecation D2. No separate work beyond D2.

---

### F5 — Creator dashboard route

**Status:** Nice-to-have
**Depends on:** F2

**Acceptance criteria:**
- New route `/?dashboard` renders a `DashboardView` component
- `App.tsx` routing updated to handle the `dashboard` query param
- `DashboardView` presents a text input for `ownerToken` and a "Load polls" button
- On submit, calls `list-polls` and filters client-side by matching `ownerToken` against a locally derived identifier (or the dashboard simply lists all polls and the delete action validates the token server-side)
- Each listed poll shows: question, created date, close date (if set), vote count, open/closed status
- A "Delete" button per poll calls `delete-poll` with the stored token; on success removes the poll from the list
- On `unauthorized` from `delete-poll`, displays an inline error: "Invalid owner token"

---

## Security & Auth Requirements

### S1 — CORS hardening

**Status:** Required

**Acceptance criteria:**
- All Netlify Functions return the following headers on every response:
  - `Access-Control-Allow-Origin: <APP_ORIGIN>` where `APP_ORIGIN` is read from an environment variable
  - `Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS`
  - `Access-Control-Allow-Headers: Content-Type`
- All functions handle `OPTIONS` preflight requests by returning 204 with the above headers and an empty body
- `APP_ORIGIN` is set in `.env.local` for development and in the Netlify dashboard for production
- If `APP_ORIGIN` is not set, functions fall back to rejecting cross-origin requests (do not default to `*`)

---

### S2 — Server-side vote deduplication

**Status:** Required
**Depends on:** D1
**Note:** This is the implementation complement to deprecation D1.

**Acceptance criteria:**
- `cast-vote` reads the `x-forwarded-for` header (falling back to a fixed sentinel if absent) and the `user-agent` header
- A SHA-256 hash of `"${ip}:${userAgent}"` is computed and stored as `voter_fingerprint` in the `votes` table
- The `votes` table `UNIQUE(poll_id, voter_fingerprint)` constraint remains in place; no schema change is needed beyond the column rename if desired
- The frontend change from D1 is the only frontend change required

---

### S3 — UUID input validation

**Status:** Required

**Acceptance criteria:**
- All functions that accept `pollId` or `optionId` validate the value against a UUID v4 regex before any database call
- If validation fails, the function returns `{ error: 'invalid_id' }` (400) immediately
- The regex used: `/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i`
- A shared `validateUUID` utility is extracted into `netlify/functions/lib/validate.ts` and imported by all functions

---

### S4 — Input sanitization

**Status:** Required

**Acceptance criteria:**
- `create-poll` rejects any `question` or option string that contains `<script` (case-insensitive); returns `{ error: 'invalid_input' }` (400)
- All HTML tags are stripped from `question` and option strings before insertion (replace `<[^>]*>` with empty string)
- Sanitization is applied after length validation but before DB insert
- A shared `sanitize` utility is added to `netlify/functions/lib/validate.ts`

---

### S5 — Rate limiting on poll creation

**Status:** Required

**Acceptance criteria:**
- A new `rate_limits` table in Supabase: `(id, ip_hash text, window_start timestamptz, count int)` with a unique index on `ip_hash`
- `create-poll` extracts and SHA-256-hashes the caller IP from `x-forwarded-for`
- On each request, upsert the `rate_limits` row for the IP:
  - If `window_start` is more than 1 hour ago, reset `count` to 1 and update `window_start` to now
  - Otherwise, increment `count`
- If `count` exceeds 5, return `{ error: 'rate_limit_exceeded' }` (429) before any poll creation
- Provide a migration script for the new table

---

## Migration Scripts

All schema changes must be accompanied by a SQL migration file placed in `supabase/migrations/` using the naming convention `YYYYMMDDHHMMSS_description.sql`.

Required migrations:

| Migration | For |
|-----------|-----|
| `..._add_closes_at_to_polls.sql` | F1 |
| `..._add_owner_token_hash_to_polls.sql` | F2 |
| `..._create_rate_limits_table.sql` | S5 |
| `..._remove_voter_fingerprint_column.sql` | D1 / S2 (run after D1 is fully deployed) |

---

## Implementation Order (recommended)

Work items are ordered by dependency and risk. Complete each before starting the next.

```
1.  D2 + F4     — options cap: pure validation change, no schema
2.  S3          — UUID validation: add shared lib, touch all functions
3.  S4          — input sanitization: extend shared lib
4.  S1          — CORS: touch all functions, add APP_ORIGIN env var
5.  F1          — poll expiry: schema + multi-function change
6.  D1 + S2     — server-side dedup: schema migration + remove frontend fingerprint
7.  F2 + D3     — owner token + delete-poll function
8.  F5          — dashboard route (depends on F2)
9.  S5          — rate limiting: new table + upsert logic in create-poll
10. F3          — list-polls function (nice-to-have, do last)
```
