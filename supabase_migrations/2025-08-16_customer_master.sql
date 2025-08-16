-- Customer Master table
create table if not exists public.customer_master (
  customer_id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  gst_number text not null,
  email text null,
  phone text null,
  created_at timestamp with time zone not null default now()
);

-- Optional: basic RLS policies (adjust as per your security needs)
-- alter table public.customer_master enable row level security;
-- create policy "Allow read for authenticated" on public.customer_master for select to authenticated using (true);
-- create policy "Allow insert for authenticated" on public.customer_master for insert to authenticated with check (true);