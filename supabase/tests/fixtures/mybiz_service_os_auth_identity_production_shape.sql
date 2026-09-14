-- CI-ONLY sanitized Auth identity shape. Never apply to a linked database.
-- No Production identifier, contact value, credential, or customer data appears here.

begin;

create schema if not exists core;

create table core.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text not null default '',
  default_organization_id uuid,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create function core.handle_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into core.profiles(id, email, full_name)
  values (new.id, new.email, '');
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function core.handle_auth_user_created();

insert into auth.users(id) values
  ('91000000-0000-0000-0000-000000000001'),
  ('91000000-0000-0000-0000-000000000002'),
  ('91000000-0000-0000-0000-000000000003');

insert into public.profiles(id, full_name, email) values
  ('91000000-0000-0000-0000-000000000001', '', 'fixture-identity-1'),
  ('91000000-0000-0000-0000-000000000002', '', 'fixture-identity-2'),
  ('92000000-0000-0000-0000-000000000001', '', 'fixture-legacy-unbound');

insert into public.stores(store_id, name, slug) values
  ('93000000-0000-0000-0000-000000000001', 'fixture', 'auth-fixture-exact'),
  ('93000000-0000-0000-0000-000000000002', 'fixture', 'auth-fixture-legacy-1'),
  ('93000000-0000-0000-0000-000000000003', 'fixture', 'auth-fixture-legacy-2'),
  ('93000000-0000-0000-0000-000000000004', 'fixture', 'auth-fixture-legacy-3'),
  ('93000000-0000-0000-0000-000000000005', 'fixture', 'auth-fixture-legacy-4'),
  ('93000000-0000-0000-0000-000000000006', 'fixture', 'auth-fixture-legacy-5'),
  ('93000000-0000-0000-0000-000000000007', 'fixture', 'auth-fixture-legacy-6');

insert into public.store_members(store_id, profile_id, role) values
  ('93000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001', 'owner'),
  ('93000000-0000-0000-0000-000000000002', '92000000-0000-0000-0000-000000000001', 'owner'),
  ('93000000-0000-0000-0000-000000000003', '92000000-0000-0000-0000-000000000001', 'owner'),
  ('93000000-0000-0000-0000-000000000004', '92000000-0000-0000-0000-000000000001', 'owner'),
  ('93000000-0000-0000-0000-000000000005', '92000000-0000-0000-0000-000000000001', 'owner'),
  ('93000000-0000-0000-0000-000000000006', '92000000-0000-0000-0000-000000000001', 'owner'),
  ('93000000-0000-0000-0000-000000000007', '92000000-0000-0000-0000-000000000001', 'owner');

commit;
