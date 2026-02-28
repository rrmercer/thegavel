# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
netlify dev          # local dev — starts Vite on :5173 proxied through Netlify CLI on :8888
                     # functions available at http://localhost:8888/.netlify/functions/*
npm run build        # tsc -b && vite build → dist/
npm run lint         # eslint on all .ts/.tsx files
```

> Always use `netlify dev`, not `vite dev`. Running Vite directly means Netlify Functions won't be served.

## Architecture

**The Gavel** is an anonymous voting app. Users create polls (a question + 2–4 text options); others vote once per device; results are shown after voting.

### Request flow

```
Browser → /.netlify/functions/<name>  →  netlify/functions/<name>.ts
                                              ↓
                                    lib/supabase.ts (shared client)
                                              ↓
                                    Supabase PostgreSQL (service role — bypasses RLS)
```

The frontend never talks to Supabase directly. All DB access goes through the four Netlify Functions using the service role key. RLS is enabled on all tables with no public policies, so direct browser access is blocked at the DB level.

### Key directories

- `src/` — Vite/React/TS frontend. `tsconfig.app.json` scopes compilation to this directory only.
- `netlify/functions/` — Serverless functions (CommonJS/Node target, own `tsconfig.json`). Each file = one endpoint.
- `netlify/functions/lib/supabase.ts` — Single place where the Supabase client is initialised from env vars.

### TypeScript: two tsconfigs on purpose

| File | Target | Used by |
|---|---|---|
| `tsconfig.app.json` | ESNext / ESM / browser | Vite + `src/` |
| `netlify/functions/tsconfig.json` | ES2020 / CommonJS / Node | Netlify Functions |

The root `tsconfig.json` just holds project references and is not used directly.

### Anonymous voting / fingerprinting

Each browser generates a UUID on first visit stored in `localStorage` (`voter_fingerprint`). This is sent with every `cast-vote` call. The `votes` table enforces `UNIQUE(poll_id, voter_fingerprint)`, so duplicate votes are rejected at the DB level with Postgres error code `23505`, which `cast-vote.ts` maps to the `already_voted` error response.

### URL routing

No React Router. `App.tsx` reads `window.location.search`:
- `/` → `CreatePollForm`
- `/?poll=<uuid>` + not voted → `PollView`
- `/?poll=<uuid>` + already voted → `ResultsView`

### Environment variables

```
SUPABASE_URL                # Supabase project URL
SUPABASE_SERVICE_ROLE_KEY   # Service role key — server-side only, never VITE_ prefix
```

Local: `.env.local` (gitignored). Production: Netlify dashboard → Environment variables → scope to Functions.

### Secret scanning

A pre-commit hook runs `detect-secrets` on every staged commit. If it blocks a false positive, update the baseline:
```bash
python3 -m detect_secrets scan > .secrets.baseline
python3 -m detect_secrets audit .secrets.baseline
git add .secrets.baseline
```
