-- Server-only encrypted provider credentials; no browser role receives table access.
create table if not exists public.vh_provider_connections (
  provider text primary key,
  account_id text,
  access_token_ciphertext text not null,
  refresh_token_ciphertext text not null,
  api_domain text,
  upload_domain text,
  access_expires_at timestamptz,
  refresh_expires_at timestamptz,
  connected_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.vh_provider_connections enable row level security;
revoke all on public.vh_provider_connections from anon, authenticated;
grant all on public.vh_provider_connections to service_role;
