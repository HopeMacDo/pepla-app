-- Allow creating customers from the app (anon PostgREST key in the browser).
grant insert on table public.customers to anon, authenticated;

drop policy if exists "customers_insert_anon" on public.customers;

create policy "customers_insert_anon"
on public.customers
for insert
to anon, authenticated
with check (true);
