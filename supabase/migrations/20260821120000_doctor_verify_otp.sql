-- Email OTP verification for the /verify signup flow (page 1) — a hard blocking gate before
-- account creation, not an optional confirmation. otp_hash is an HMAC-SHA256 keyed by a
-- server-only secret (OTP_HMAC_SECRET), not a bare hash — a 6-digit code is only 10^6
-- possibilities, trivially brute-forced offline from a bare hash if a DB backup ever leaks.

create table public.email_otp_verifications (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  otp_hash text not null,
  attempts smallint not null default 0,
  consumed_at timestamptz,
  ip_address text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index email_otp_verifications_email_idx on public.email_otp_verifications (email);

-- Same deny-all stance as every other table — only the service-role admin client touches this.
alter table public.email_otp_verifications enable row level security;
alter table public.email_otp_verifications force row level security;
