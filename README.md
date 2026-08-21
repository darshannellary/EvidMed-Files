# EvidMed AI

An AI-powered research-synthesis platform that verifies Indian doctors (NMC / State Medical
Council) and delivers cited, evidence-based clinical answers grounded first in Indian medical
guidance (ICMR, NHM, NCDC), falling back to global open-access literature.

## Core Product Principles (non-negotiable)

1. **No-Citation, No-Output.** Every factual claim must carry an inline citation to a validated
   source. No exceptions.
2. **Descriptive, not directive.** The platform informs research; it never issues a diagnosis or
   treatment directive.
3. **India-grounded first.** Tier-1 (Indian sources) is checked and prioritized before Tier-2
   (global) is ever surfaced.
4. **DPDP by default.** No patient identifiers are ever transmitted or stored. AES-256 at rest,
   TLS 1.3 in transit.

## Tech Stack

| Layer                       | Choice                          | Notes                                                                 |
| ---------------------------- | -------------------------------- | ---------------------------------------------------------------------- |
| Database + Auth + Vector store | Supabase (pgvector)            | Free tier to start.                                                    |
| LLM / synthesis              | Claude API                       | Citation requirement enforced via system prompt + output validation.   |
| Embeddings                   | Voyage AI                        | Consistent across ingestion and query.                                 |
| Frontend                     | Next.js (App Router) + TypeScript | PWA — no app-store friction, works on low-end Android, offline-caching. |
| Voice input                  | Web Speech API                   | Browser-native to start, for speed/cost.                               |
| Hosting                      | Vercel                           | One-click deploy.                                                      |

## Getting Started

`package-lock.json` is not committed (kept out to avoid bloating the initial scaffold) — `npm install`
generates it locally on first run.

```bash
npm install
cp .env.example .env.local   # fill in your Supabase/Claude/Voyage keys
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

- `app/` — routes: `/` (landing page), `/verify` (registration details + email OTP + password,
  page 1 of signup), `/verify/certificate` (certificate upload, page 2, authenticated), `/login`,
  `/ask` (the query flow, authenticated + verified doctors only)
- `proxy.ts` + `lib/supabase/middleware.ts` — session refresh, required by `@supabase/ssr` on every
  request (Next 16 renamed the `middleware.ts` file convention to `proxy.ts`)
- `lib/auth/session.ts` — `getAuthedDoctor()`, the shared session/status-gating helper used by
  `/ask` and `/verify/certificate`
- `lib/supabase/` — browser/server (anon-key, RLS-scoped) clients + `admin.ts` (service-role
  client — bypasses RLS, used for the founder-run CLIs and the parts of the app that need to)
- `lib/ingestion/` — Tier-1 / Tier-2 PDF ingestion pipeline (extract → embed via Voyage → insert),
  CLI: `npm run ingest`
- `lib/rag/` — query embedding → pgvector similarity search (Tier 1 before Tier 2) → Claude
  synthesis with enforced citations, used by both `/ask` and the CLI: `npm run query`
- `lib/doctors/` — signup (`/verify` + `/verify/certificate`), phone/OTP validation, and the
  founder review CLI: `npm run doctors:list` / `doctors:approve` / `doctors:reject` /
  `doctors:cert-url`
- `lib/email/` — OTP email sending via Resend
- `supabase/migrations/` — schema, RLS (including the `authenticated`-role policies added for
  doctor login), `match_documents` RPC, doctor-certificates + OTP tables and storage bucket

## Status

**Current phase: Phase 2 — Core Product, complete pending one live end-to-end pass.** Everything
below is built; the pieces marked (live-verified) have been run for real against the founder's
Supabase/Voyage/Anthropic/Vercel accounts, the rest is built + tested-with-mocks/scratch-Postgres
in this session but not yet exercised with real credentials:

- Schema live, RLS enforced (deny-all except the service-role admin client and, now, narrowly
  scoped `authenticated`-role read/insert policies for doctor login) — (live-verified)
- Document ingestion: real PDF ingested with a real 1024-dim embedding — (live-verified)
- RAG query flow: real query → real Tier-1 retrieval → real Claude Sonnet 5 synthesis → correctly
  cited answer, citation enforcement verified in code (not just prompted for) — (live-verified)
- Doctor verification queue (founder CLI review side): real form submission with a real
  certificate upload, reviewed and approved via the CLI — (live-verified)
- Deployed to Vercel, live on a public URL — (live-verified)
- **Doctor-facing login + self-service `/ask`** (this session's work): a doctor now creates a real
  password-protected account, verified via a mandatory email OTP + Indian-phone validation, across
  a two-page flow (`/verify` for details+OTP+account creation, `/verify/certificate` for the
  upload) — then logs in at `/login` and asks questions themselves at `/ask` once approved,
  instead of everything running through the founder's CLI. RLS policies, migrations, and all
  application logic verified via scratch-Postgres + mocked Supabase clients this session; not yet
  run against the real Supabase project, real Resend account, or a real browser session.

Not yet built: voice input (spec §10 Phase 2's remaining item) and a PWA offline-caching layer
beyond the manifest.

Update this section as the project progresses so each build session picks up where the last left
off.

### Build Phases (6-Month Path)

| Phase                       | Timeline    | Deliverables                                                                 |
| ----------------------------- | ------------ | ------------------------------------------------------------------------------ |
| 0 — Setup                    | Pre-work    | Claude Code installed, Supabase project created, API keys obtained, 10–20 sample documents collected |
| 1 — Architecture & Foundation | Months 1–2  | Schema live, ingestion pipeline working on sample docs, baseline security       |
| 2 — Core Product              | Month 3     | Manual doctor verification queue, RAG query flow (Tier 1 → Tier 2), voice search |
| 3 — Alpha & Validation        | Months 4–5  | 3–5 doctors testing, medical board spot-checks citation accuracy, external pen test |
| 4 — Pilot                     | Month 6     | Deploy to 3–5 hospitals/PHCs, onboard 1,000+ clinicians, monitor KPIs           |

### Security & Compliance Checklist

- [x] Row-level security enabled on all Supabase tables (verified: enabled + forced, zero
  anon/authenticated policies, service-role admin client is the only write path)
- [ ] No patient identifiers accepted or stored anywhere in the query path
- [ ] AES-256 encryption at rest (Supabase default — verify it's on)
- [ ] TLS 1.3 in transit (verify on hosting provider)
- [ ] Environment variables / secrets never committed to repo
- [ ] External security review before pilot deployment
- [ ] DPDP Act compliance review by a lawyer before pilot

### Where AI Tools Can't Do the Work For You

- **Medical accuracy validation** — needs a real doctor/medical board reviewer.
- **NMC/State Council verification path** — no public API exists; Stage 1 is a manual review
  queue by design.
- **DPDP legal sign-off** — needs a lawyer's review before pilot, even with AI-drafted policies.
- **Security review before real clinician data flows through the system** — automated checks are
  a floor, not a substitute for external review.
