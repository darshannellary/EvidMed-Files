-- EvidMed AI — row-level security
--
-- RLS is enabled + forced on every table, with no policies for `anon` / `authenticated`. With RLS
-- on and zero policies, both roles default to deny-all. All application reads/writes go through
-- server-side code using the service-role key (`service_role` has BYPASSRLS in Supabase regardless
-- of FORCE ROW LEVEL SECURITY), consistent with the current architecture: verification is a
-- founder-run manual queue, and the RAG flow must run server-side anyway since the Voyage/Claude
-- API keys can't be exposed to the browser.
--
-- This satisfies spec §9's "RLS enabled on all tables" for the product's *current* state — it is
-- not a placeholder. Follow-up: if doctor-facing Supabase Auth is added later, add policies here
-- scoped by `auth.uid() = doctors.user_id`.

alter table public.doctors enable row level security;
alter table public.documents enable row level security;
alter table public.queries enable row level security;
alter table public.citations enable row level security;

alter table public.doctors force row level security;
alter table public.documents force row level security;
alter table public.queries force row level security;
alter table public.citations force row level security;
