-- Activates the follow-up the RLS migration's own header comment earmarked: now that doctors get
-- real Supabase Auth accounts, authenticated doctors can read (only) their own data. documents
-- stays fully closed to authenticated — doctors get content only through synthesized, cited
-- answers, never raw corpus access.

create policy "doctors_select_own"
  on public.doctors for select
  to authenticated
  using (auth.uid() = user_id);
-- No insert/update/delete policy for authenticated — verification_status/method/rejection_reason
-- must never be self-editable; service-role (submission flow + review CLI) remains the only
-- write path.

create policy "queries_select_own"
  on public.queries for select
  to authenticated
  using (doctor_id in (select id from public.doctors where user_id = auth.uid()));

create policy "queries_insert_own_verified"
  on public.queries for insert
  to authenticated
  with check (
    doctor_id in (
      select id from public.doctors
      where user_id = auth.uid() and verification_status = 'verified'
    )
  );
-- Defense-in-depth, matching this codebase's existing convention (e.g. documents' tier/source
-- CHECK constraint duplicates a rule ingestion code also enforces): /ask's Server Action uses the
-- admin client so won't hit this policy today, but it's cheap insurance against a future
-- lighter/authenticated-client code path accidentally letting a pending doctor insert.

create policy "citations_select_own"
  on public.citations for select
  to authenticated
  using (
    query_id in (
      select q.id from public.queries q
      join public.doctors d on d.id = q.doctor_id
      where d.user_id = auth.uid()
    )
  );
-- citations has no direct doctor_id column — scoped via the queries->doctors join. Read-only:
-- citations are only ever written by the RAG pipeline's service-role client, never client-supplied.
