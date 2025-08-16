-- Create invoice_master table
create table if not exists public.invoice_master (
    invoice_id uuid default gen_random_uuid() primary key,
    invoice_number text not null unique,
    docket_id uuid references public.dockets(id) on delete cascade,
    customer_id uuid references public.customer_master(customer_id) on delete set null,
    invoice_date date not null,
    due_date date not null,
    billed_to jsonb not null,
    line_items jsonb not null,
    subtotal decimal(12,2) not null,
    gst_amount decimal(12,2) not null,
    grand_total decimal(12,2) not null,
    gst_type text not null check (gst_type in ('IGST', 'CGST/SGST')),
    place_of_supply text,
    terms text not null,
    notes text,
    company_settings_snapshot jsonb not null,
    created_at timestamp with time zone default now(),
    created_by uuid references auth.users(id) on delete set null
);

-- Enable RLS
alter table public.invoice_master enable row level security;

-- Create policies
create policy "Allow read for authenticated" on public.invoice_master 
    for select to authenticated using (true);

create policy "Allow insert for authenticated" on public.invoice_master 
    for insert to authenticated with check (true);

create policy "Allow update for authenticated" on public.invoice_master 
    for update to authenticated using (true);

-- Create indexes for better performance
create index if not exists idx_invoice_master_docket_id on public.invoice_master(docket_id);
create index if not exists idx_invoice_master_customer_id on public.invoice_master(customer_id);
create index if not exists idx_invoice_master_invoice_number on public.invoice_master(invoice_number);
create index if not exists idx_invoice_master_created_at on public.invoice_master(created_at desc);