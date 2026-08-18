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

- `app/` — routes (landing page now; query UI comes later)
- `lib/supabase/` — Supabase browser + server client setup
- `lib/ingestion/` — Tier-1 / Tier-2 document ingestion pipeline (not yet implemented)
- `lib/rag/` — embedding + pgvector query + Claude synthesis flow (not yet implemented)
- `supabase/migrations/` — schema migrations (not yet implemented)

## Status

**Current phase: Phase 0 — Setup.** Repo scaffolding only (Next.js + TypeScript, PWA manifest,
Supabase client stubs, env var template). No live Supabase connection, no schema, no ingestion or
RAG logic yet.

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

- [ ] Row-level security enabled on all Supabase tables
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
