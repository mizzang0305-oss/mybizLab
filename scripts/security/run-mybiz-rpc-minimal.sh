#!/usr/bin/env bash
set -euo pipefail

# Two fresh GitHub-runner Supabase stacks. No project link, remote credentials,
# Production data, payment provider or Production mutation is permitted.
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
stack_root="${RUNNER_TEMP:?RUNNER_TEMP is required}/mybiz-rpc-minimal-r32"
if [[ -e "$stack_root" || -n "${SUPABASE_ACCESS_TOKEN:-}" || -n "${SUPABASE_DB_PASSWORD:-}" ]]; then
  echo 'Refusing reused stack or remote Supabase credentials.' >&2
  exit 1
fi
mkdir -p "$stack_root"
cd "$stack_root"
supabase init --yes >/dev/null
test ! -e supabase/.temp/project-ref
cleanup() { supabase stop --no-backup >/dev/null 2>&1 || true; }
trap cleanup EXIT

sql_file() {
  psql "$local_db_url" -X -v ON_ERROR_STOP=1 -q -f "$repo_root/$1" >/dev/null
}
refresh_schema() {
  psql "$local_db_url" -X -v ON_ERROR_STOP=1 -q -c "NOTIFY pgrst, 'reload schema';" >/dev/null
  local status='000'
  for _ in {1..40}; do
    if [[ "${1:-old}" == 'new' ]]; then
      status="$(curl --silent --max-time 2 --output /dev/null --write-out '%{http_code}' \
        --request POST "$local_api_url/rest/v1/rpc/provision_store_from_verified_actor" \
        --header "apikey: $local_service_key" --header "authorization: Bearer $local_service_key" \
        --header 'content-type: application/json' \
        --data '{"p_auth_user_id":null,"p_request_key":null,"p_request_hash":null,"p_store_name":null,"p_owner_name":null,"p_business_number":null,"p_phone":null,"p_email":null,"p_address":null,"p_business_type":null,"p_requested_slug":null,"p_plan":null,"p_payment_id":null,"p_payment_amount":null,"p_payment_currency":null}' || true)"
      if [[ "$status" == '400' ]]; then return; fi
    else
      status="$(curl --silent --max-time 2 --output /dev/null --write-out '%{http_code}' \
        --request POST "$local_api_url/rest/v1/rpc/local_test_current_role" \
        --header "apikey: $local_anon_key" --header "authorization: Bearer $local_anon_key" || true)"
      if [[ "$status" == '200' ]]; then return; fi
    fi
    sleep 0.25
  done
  echo "LOCAL_POSTGREST_SCHEMA_NOT_READY=$status" >&2
  exit 1
}
test_phase() {
  (cd "$repo_root" && LOCAL_RPC_PHASE="$1" npx vitest run src/tests/mybiz-rpc-minimal-fullstack.test.ts --reporter=dot)
}

echo "SUPABASE_CLI_VERSION=$(supabase --version)"
docker version --format 'Docker client {{.Client.Version}} server {{.Server.Version}}'
docker info --format 'Docker server {{.ServerVersion}}'

for run in 1 2; do
  echo "MINIMAL_RPC_RUN_${run}=START"
  supabase start --exclude realtime,storage-api,imgproxy,postgres-meta,studio,edge-runtime,logflare,vector,supavisor,mailpit >"$stack_root/start-${run}.log" 2>&1 || {
    echo "MINIMAL_RPC_RUN_${run}=BOOT_FAILED" >&2
    exit 1
  }
  supabase status -o env >"$stack_root/local-status.env"
  chmod 600 "$stack_root/local-status.env"
  source "$stack_root/local-status.env"
  local_db_url="${DB_URL:-}"
  local_api_url="${API_URL:-${SUPABASE_URL:-}}"
  local_anon_key="${ANON_KEY:-${PUBLISHABLE_KEY:-}}"
  local_service_key="${SERVICE_ROLE_KEY:-${SECRET_KEY:-}}"
  if [[ ! "$local_db_url" =~ ^postgres(ql)?://[^@]+@127\.0\.0\.1:[0-9]+/postgres$ \
    || ! "$local_api_url" =~ ^http://127\.0\.0\.1:[0-9]+$ || -z "$local_anon_key" || -z "$local_service_key" ]]; then
    echo 'Local loopback database/API not established.' >&2
    exit 1
  fi
  echo "POSTGRES_VERSION_${run}=$(psql "$local_db_url" -X -Atc 'show server_version')"
  export LOCAL_SUPABASE_STATUS_FILE="$stack_root/local-status.env"
  export LOCAL_REHEARSAL_RUN="$run"
  sql_file supabase/tests/mybiz_15_table_exact_shape_fixture.sql
  sql_file supabase/tests/mybiz_15_table_fullstack_support.sql
  sql_file supabase/live_patches/20260318_fix_create_store_with_owner_live.sql
  refresh_schema
  test_phase old
  echo "OLD_APP_OLD_DB_${run}=BYPASS_REPRODUCED"
  echo "NEW_APP_OLD_DB_${run}=HOLD"

  # Apply only the restricted RPC draft and the narrow R5 two-table migration.
  # The 15-table RLS candidate is absent from this disposable stack.
  sql_file supabase/migration_drafts/20260923102833_mybiz_r3_provisioning_rpc_boundary.sql
  sql_file supabase/migration_drafts/20260925115116_mybiz_auth_binding_server_resolver.sql
  sql_file supabase/tests/mybiz_r3_rpc_acl_assertions.sql
  sql_file supabase/migration_drafts/20260924070556_mybiz_provisioning_raw_data_privacy.sql
  refresh_schema new
  test_phase new
  echo "OLD_APP_NEW_DB_${run}=DENIED"
  echo "NEW_APP_NEW_DB_${run}=FREE_ONLY_PASS"
  (cd "$repo_root" && node scripts/security/mybiz-rpc-minimal-browser.mjs)
  echo "REAL_BROWSER_FREE_FLOW_${run}=PASS"

  # Real local Auth JWTs and PostgREST prove GRANT and row policy behavior.
  (cd "$repo_root" && LOCAL_R5_PRIVACY=1 npx vitest run src/tests/mybiz-r5-raw-api-fullstack.test.ts --reporter=dot)

  # Containment rollback never restores the unsafe old EXECUTE privilege.
  sql_file supabase/tests/mybiz_rpc_minimal_safe_rollback.sql
  psql "$local_db_url" -X -v ON_ERROR_STOP=1 -Atc \
    "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='create_store_with_owner' and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE'))" \
    | grep -qx '0'
  psql "$local_db_url" -X -v ON_ERROR_STOP=1 -Atc \
    "select count(*) from private.store_provisioning_release_control where singleton=true and mode='HOLD'" \
    | grep -qx '1'
  psql "$local_db_url" -X -v ON_ERROR_STOP=1 -Atc \
    "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='provision_store_from_verified_actor'" \
    | grep -qx '0'
  echo "SAFE_DB_ONLY_ROLLBACK_${run}=PASS_OLD_BYPASS_CLOSED"

  # Incident-only rollback rehearsal: restore the exact two-table prestate,
  # without re-enabling the unsafe old provisioning RPC or deleting rows.
  sql_file supabase/migration_drafts/20260924070556_mybiz_provisioning_raw_data_privacy_rollback.sql
  psql "$local_db_url" -X -v ON_ERROR_STOP=1 -Atc \
    "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('store_home_content','store_priority_settings') and c.relrowsecurity=false and c.relforcerowsecurity=false and has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') and has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE') and has_table_privilege('service_role',c.oid,'SELECT,INSERT,UPDATE,DELETE')" \
    | grep -qx '2'
  psql "$local_db_url" -X -v ON_ERROR_STOP=1 -Atc \
    "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='create_store_with_owner' and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE'))" \
    | grep -qx '0'
  echo "TWO_TABLE_INCIDENT_ROLLBACK_${run}=PASS_OLD_RPC_STILL_BLOCKED"
  supabase stop --no-backup >/dev/null
  test ! -e supabase/.temp/project-ref
done
