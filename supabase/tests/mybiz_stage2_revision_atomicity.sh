#!/usr/bin/env bash
set -euo pipefail

: "${PGHOST:=127.0.0.1}"
: "${PGPORT:=54322}"
: "${PGUSER:=postgres}"
: "${PGDATABASE:=postgres}"
: "${PGPASSWORD:=postgres}"
export PGHOST PGPORT PGUSER PGDATABASE PGPASSWORD

psql_base=(psql -X -q -v ON_ERROR_STOP=1)
store_id='21000000-0000-0000-0000-000000000001'
job_id='31000000-0000-0000-0000-000000000001'
member_id='11000000-0000-0000-0000-000000000001'
other_member_id='11000000-0000-0000-0000-000000000002'
tmp_dir="$(mktemp -d)"
trap 'rm -rf -- "$tmp_dir"' EXIT

"${psql_base[@]}" <<SQL
insert into auth.users (id, email, raw_user_meta_data)
values
  ('$member_id', 'atomic-member@example.invalid', '{}'::jsonb),
  ('$other_member_id', 'atomic-outsider@example.invalid', '{}'::jsonb);

insert into public.profiles (id, full_name, email)
values
  ('$member_id', 'Atomic Member', 'atomic-member@example.invalid'),
  ('$other_member_id', 'Atomic Outsider', 'atomic-outsider@example.invalid');

insert into public.stores (id, name, slug, owner_name, business_number, phone, email, address, business_type)
values ('$store_id', 'Atomic Store', 'atomic-store', 'Owner', '000-00-00101', '000-0000-0101', 'atomic-store@example.invalid', 'Synthetic', 'cleaning');

insert into public.store_members (store_id, profile_id, role)
values ('$store_id', '$member_id', 'owner');

insert into public.service_jobs (id, store_id, vertical, service_name, requires_contract, contract_state, state, created_by)
values ('$job_id', '$store_id', 'cleaning', 'Atomic revision test', false, 'NOT_REQUIRED', 'WORK_COMPLETED', '$member_id');
SQL

run_bump() {
  local hold_seconds="$1"
  "${psql_base[@]}" -At <<SQL
begin;
set local role service_role;
select private.create_next_job_evidence_revision('$job_id', '$member_id', 'concurrent-ci');
select pg_sleep($hold_seconds);
commit;
SQL
}

run_bump 2 >"$tmp_dir/first.out" &
first_pid=$!
sleep 0.2
run_bump 0 >"$tmp_dir/second.out" &
second_pid=$!
wait "$first_pid"
wait "$second_pid"

actual_revisions="$(grep -E '^[0-9]+$' "$tmp_dir/first.out" "$tmp_dir/second.out" | sed 's/.*://' | sort -n | tr '\n' ' ' | sed 's/ $//')"
if [[ "$actual_revisions" != '2 3' ]]; then
  echo "REVISION_CONCURRENT_SEQUENCE_FAIL expected='2 3' actual='$actual_revisions'" >&2
  exit 1
fi

revision_state="$("${psql_base[@]}" -Atc "select evidence_revision::text || ':' || count(*)::text || ':' || count(distinct revision_number)::text from public.service_jobs j join public.job_evidence_revisions r on r.job_id = j.id where j.id = '$job_id' group by evidence_revision")"
if [[ "$revision_state" != '3:3:3' ]]; then
  echo "REVISION_ATOMICITY_FAIL expected='3:3:3' actual='$revision_state'" >&2
  exit 1
fi

if "${psql_base[@]}" -v VERBOSITY=verbose -c "set role service_role; select private.create_next_job_evidence_revision('$job_id', '$other_member_id', 'cross-store-deny');" >"$tmp_dir/deny.out" 2>&1; then
  echo 'REVISION_CROSS_STORE_DENY failed: unauthorized actor was accepted' >&2
  exit 1
fi
if ! grep -q '42501' "$tmp_dir/deny.out"; then
  echo 'REVISION_CROSS_STORE_DENY failed: expected SQLSTATE 42501' >&2
  sed -n '1,20p' "$tmp_dir/deny.out" >&2
  exit 1
fi

echo 'REVISION_CURRENT_1_TO_NEXT_2_ALLOW PASS'
echo 'REVISION_CONCURRENT_NO_DUPLICATE PASS revisions=2,3'
echo 'REVISION_CROSS_STORE_DENY PASS SQLSTATE=42501'

"${psql_base[@]}" <<SQL
delete from public.stores where id = '$store_id';
delete from auth.users where id in ('$member_id', '$other_member_id');
SQL
