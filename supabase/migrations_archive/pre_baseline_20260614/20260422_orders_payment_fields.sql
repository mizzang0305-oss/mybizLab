alter table public.orders
  add column if not exists payment_status text not null default 'pending'
    check (payment_status in ('pending', 'paid', 'refunded'));

alter table public.orders
  add column if not exists payment_source text
    check (payment_source in ('counter', 'mobile'));

alter table public.orders
  add column if not exists payment_method text
    check (payment_method in ('cash', 'card', 'other'));

alter table public.orders
  add column if not exists payment_recorded_at timestamptz;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name = 'placed_at'
  ) then
    execute 'create index if not exists orders_store_payment_status_idx on public.orders (store_id, payment_status, placed_at desc)';
  elsif exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name = 'created_at'
  ) then
    execute 'create index if not exists orders_store_payment_status_idx on public.orders (store_id, payment_status, created_at desc)';
  else
    execute 'create index if not exists orders_store_payment_status_idx on public.orders (store_id, payment_status)';
  end if;
end;
$$;
