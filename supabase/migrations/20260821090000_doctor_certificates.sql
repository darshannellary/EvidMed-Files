-- Doctor verification queue support (spec §7 Stage 1): a certificate file reference, optional
-- contact info (no doctor login/notification system exists, so this is the founder's only channel
-- to follow up on an outcome), and a rejection reason for the review CLI's audit trail.

alter table public.doctors add column certificate_path text;
alter table public.doctors add column contact_phone text;
alter table public.doctors add column contact_email text;
alter table public.doctors add column rejection_reason text;

-- Private bucket for uploaded registration certificates — identity documents, not public.
-- No storage.objects policies for anon/authenticated (same zero-policy deny-all stance as the
-- four app tables); service_role bypasses Storage RLS the same way it bypasses table RLS, so no
-- new access mechanism is introduced.
insert into storage.buckets (id, name, public)
values ('doctor-certificates', 'doctor-certificates', false);
