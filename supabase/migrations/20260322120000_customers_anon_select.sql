-- Fix: app showed "No customers yet" while the table had rows.
-- PostgREST uses the `anon` key; RLS with no (or blocking) SELECT policy returns zero rows.
-- Run this in Supabase → SQL Editor (or `supabase db push` if you use the CLI).

alter table public.customers enable row level security;

drop policy if exists "customers_select_anon" on public.customers;

create policy "customers_select_anon"
on public.customers
for select
to anon, authenticated
using (true);

grant select on table public.customers to anon, authenticated;