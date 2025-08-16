-- Customer Master table
create extension if not exists pgcrypto;

create table if not exists public.customer_master (
  customer_id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  gst_number text not null,
  email text null,
  phone text null,
  created_at timestamp with time zone not null default now()
);

-- Ensure RLS allows authenticated to select/insert (adjust to your needs)
alter table public.customer_master enable row level security;

do $$ begin
  create policy "Allow read for authenticated" on public.customer_master for select to authenticated using (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Allow insert for authenticated" on public.customer_master for insert to authenticated with check (true);
exception when duplicate_object then null;
end $$;