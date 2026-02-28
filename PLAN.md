# The Gavel — Build Plan

A voting app: users create prompts with 2–4 options, others vote anonymously, results shown after voting.

**Stack:** Vite + React + TypeScript · Netlify (static hosting + serverless functions) · Supabase (PostgreSQL)

---

## Status

- [x] Phase 0 — Pre-commit secret scanning hook (detect-secrets)
- [x] Phase 1 — Project scaffold (Vite + deps + netlify.toml + tsconfigs)
- [ ] Phase 2 — Netlify Functions (backend API)
- [ ] Phase 3 — Frontend (components + routing)
- [ ] Phase 4 — Deploy to Netlify

---

## Supabase Schema

Run this SQL in the Supabase SQL Editor before starting Phase 2.

```sql
CREATE TABLE polls (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question   TEXT NOT NULL CHECK (char_length(question) BETWEEN 1 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active  BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE options (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id  UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  text     TEXT NOT NULL CHECK (char_length(text) BETWEEN 1 AND 200),
  position SMALLINT NOT NULL,
  UNIQUE(poll_id, position)
);

CREATE TABLE votes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id           UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  option_id         UUID NOT NULL REFERENCES options(id) ON DELETE CASCADE,
  voter_fingerprint TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(poll_id, voter_fingerprint)
);

CREATE INDEX idx_options_poll_id ON options(poll_id);
CREATE INDEX idx_votes_poll_id   ON votes(poll_id);
CREATE INDEX idx_votes_option_id ON votes(option_id);

-- Lock down direct browser access — all reads/writes go through Netlify Functions
ALTER TABLE polls   ENABLE ROW LEVEL SECURITY;
ALTER TABLE options ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes   ENABLE ROW LEVEL SECURITY;
```

> **voter_fingerprint** — a UUID generated in the browser on first visit and stored in
> `localStorage`. The `UNIQUE(poll_id, voter_fingerprint)` constraint enforces one vote
> per device per poll at the database level.

---

## Environment Variables

### Local — `.env.local` (gitignored, never commit)

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

> Use the **service role key** (not the anon key) — RLS has no public policies so only
> the service role can read/write. Never use the `VITE_` prefix on these; that would
> expose them in the browser bundle.

### Production — Netlify Dashboard

Site settings → Environment variables → Add:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Set scope to **Functions** only.

---

## Phase 2 — Netlify Functions

All files in `netlify/functions/`. Netlify maps them to `/.netlify/functions/<name>`.

| File | Method | Query/Body | Purpose |
|---|---|---|---|
| `get-poll.ts` | GET | `?pollId=<uuid>` | Fetch poll + options (build first — validates DB connection) |
| `create-poll.ts` | POST | `{ question, options[] }` | Create poll + options atomically |
| `cast-vote.ts` | POST | `{ pollId, optionId, voterFingerprint }` | Record vote; returns `already_voted` on duplicate |
| `get-results.ts` | GET | `?pollId=<uuid>` | Vote counts + percentages per option |

Each function initialises Supabase like this:

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
```

**Test locally with:**
```bash
netlify dev   # starts on port 8888; functions at /.netlify/functions/*
```

---

## Phase 3 — Frontend

### Directory layout

```
src/
  types/index.ts           shared TypeScript types (Poll, Option, VoteResult)
  api/client.ts            fetch wrapper → /.netlify/functions/*
  hooks/useVotedPolls.ts   localStorage: voter fingerprint + set of voted poll IDs
  components/
    CreatePollForm.tsx      question + 2–4 options, copy-link on success
    PollView.tsx            show question + vote buttons
    ResultsView.tsx         bar-style results, highlight chosen option
    PollNotFound.tsx        404 / bad poll ID state
  App.tsx                  URL routing (no React Router needed)
  main.tsx                 React entry point
```

### Routing (URL-based, no React Router)

| URL | Condition | View |
|---|---|---|
| `/` | — | `CreatePollForm` |
| `/?poll=<uuid>` | not yet voted | `PollView` |
| `/?poll=<uuid>` | already voted | `ResultsView` |

After voting: stay on `/?poll=<uuid>`, swap to `ResultsView`.

### API client pattern

All calls use relative paths so they work identically in dev (`netlify dev`) and prod:

```typescript
const FUNCTIONS_BASE = '/.netlify/functions'
```

### `useVotedPolls` hook API

```typescript
{
  fingerprint: string          // UUID, generated once, persisted in localStorage
  hasVoted(pollId): boolean
  markVoted(pollId): void
}
```

---

## Phase 4 — Deploy

1. Push repo to GitHub
2. Connect repo to Netlify (UI or `netlify deploy`)
3. Set env vars in Netlify dashboard (scope: Functions)
4. Verify functions appear in the Netlify Functions tab
5. Smoke-test all 4 endpoints on the production URL

---

## Gotchas

| # | Watch out for |
|---|---|
| 1 | **Never use `VITE_` prefix** on Supabase keys — they'd be bundled into the browser JS |
| 2 | **Always use `netlify dev`** for local dev, not `vite dev` — functions won't load otherwise |
| 3 | **Two tsconfigs on purpose** — root is Vite/ESM/browser; `netlify/functions/` is CommonJS/Node |
| 4 | **After adding new files** — re-run `python3 -m detect_secrets scan > .secrets.baseline` before committing if the hook blocks you |
