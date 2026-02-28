# The Gavel

An anonymous voting app. Create a prompt with 2–4 options, share the link, and let people vote. Results are shown immediately after voting — no account required.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript, built with Vite |
| Hosting | Netlify (static site) |
| API | Netlify Functions (serverless, TypeScript) |
| Database | Supabase (PostgreSQL) |

The browser never talks to Supabase directly. All database access goes through Netlify Functions using a server-side service role key. RLS is enabled on all tables with no public policies.

---

## Local Development

### Prerequisites

- Node.js 18+
- [netlify-cli](https://docs.netlify.com/cli/get-started/) (installed as a dev dependency)
- A Supabase project with the schema below applied
- `detect-secrets` and `gitleaks` for the pre-commit hook

### Setup

```bash
npm install
```

Create `.env.local` in the repo root:

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### Start

```bash
npx netlify dev
```

Opens on **http://localhost:8888**. This runs Vite (port 5173) and the Netlify Functions runtime together. Always use `netlify dev` — running `vite dev` directly will leave functions unavailable.

### Build

```bash
npm run build      # type-check + Vite production build → dist/
npm run lint       # ESLint
```

---

## Architecture

```
Browser
  │
  ├── / (no ?poll param)        →  CreatePollForm
  ├── /?poll=<uuid> (not voted) →  PollView
  └── /?poll=<uuid> (voted)     →  ResultsView
         │
         │  fetch /.netlify/functions/*
         ▼
  Netlify Functions (Node / esbuild)
    ├── create-poll   POST  create poll + options atomically
    ├── get-poll      GET   fetch poll question + options
    ├── cast-vote     POST  record a vote (duplicate-safe)
    └── get-results   GET   vote counts + percentages
         │
         │  @supabase/supabase-js (service role key)
         ▼
  Supabase PostgreSQL
    ├── polls    (id, question, is_active, created_at)
    ├── options  (id, poll_id, text, position)
    └── votes    (id, poll_id, option_id, voter_fingerprint, created_at)
                  UNIQUE(poll_id, voter_fingerprint)
```

Routing is query-param based (`/?poll=<uuid>`) with no React Router — `App.tsx` reads `window.location.search` directly. Anonymous identity is a UUID generated once per browser and stored in `localStorage` (`gavel_voter_fingerprint`). The `UNIQUE(poll_id, voter_fingerprint)` constraint enforces one vote per device at the database level.

---

## Supabase Schema

Run this in the Supabase SQL Editor before starting:

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

ALTER TABLE polls   ENABLE ROW LEVEL SECURITY;
ALTER TABLE options ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes   ENABLE ROW LEVEL SECURITY;
```

---

## Deployment

The app deploys to Netlify. Connect the GitHub repo in the Netlify dashboard — build settings are read from `netlify.toml` automatically.

Set these environment variables in **Netlify → Site settings → Environment variables** (scope: Functions):

```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

---

## Secret Scanning

A pre-commit hook runs two secret scanners on every commit:

- **gitleaks** — broad credential ruleset (AWS, Stripe, GitHub tokens, etc.)
- **detect-secrets** — high-entropy string detection with a `.secrets.baseline`

False positive handling:
- gitleaks: add `# gitleaks:allow` inline, or create a `.gitleaks.toml` allowlist
- detect-secrets: `python3 -m detect_secrets scan > .secrets.baseline && python3 -m detect_secrets audit .secrets.baseline`
