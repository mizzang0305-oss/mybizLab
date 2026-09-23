#!/usr/bin/env bash
set -euo pipefail

# GitHub-hosted disposable Supabase only. Never accept a linked project or
# caller-provided database credentials; all SQL uses the CLI --local selector.
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
stack_root="${RUNNER_TEMP:?RUNNER_TEMP is required}/mybiz-15-table-r2-local"
if [[ -e "$stack_root" ]]; then
  echo 'The isolated stack directory already exists; refusing to reuse it.' >&2
  exit 1
fi
if [[ -n "${SUPABASE_ACCESS_TOKEN:-}" || -n "${SUPABASE_DB_PASSWORD:-}" ]]; then
  echo 'Remote Supabase credentials must not be present in this job.' >&2
  exit 1
fi
mkdir -p "$stack_root"
cd "$stack_root"
supabase init --yes >/dev/null
test ! -e supabase/.temp/project-ref
cleanup() {
  supabase stop --no-backup >/dev/null 2>&1 || true
}
trap cleanup EXIT

sql_file() {
  psql "$local_db_url" -X -v ON_ERROR_STOP=1 -q -f "$repo_root/$1" >/dev/null
}
refresh_schema() {
  psql "$local_db_url" -X -v ON_ERROR_STOP=1 -q -c "NOTIFY pgrst, 'reload schema';" >/dev/null
}
run_app_routes() {
  (cd "$repo_root" && npx vitest run src/tests/mybiz-15-table-fullstack-routes.test.ts --reporter=dot)
}

echo "SUPABASE_CLI_VERSION=$(supabase --version)"
echo "NODE_VERSION=$(node --version)"
docker version --format 'Docker client {{.Client.Version}} server {{.Server.Version}}'
docker info --format 'Docker server {{.ServerVersion}}'

for run in 1 2; do
  echo "FULLSTACK_RUN_${run}=START"
  # Keep PostgreSQL, GoTrue, PostgREST, and Kong. No studio, mail, worker,
  # storage, realtime, or paid/remote service is involved in this rehearsal.
  supabase start --exclude realtime,storage-api,imgproxy,postgres-meta,studio,edge-runtime,logflare,vector,supavisor,mailpit >"$stack_root/start-${run}.log" 2>&1 || {
    echo "FULLSTACK_RUN_${run}=BOOT_FAILED"
    echo 'Local bootstrap log retained in runner temp only; credentials are not uploaded.'
    exit 1
  }
  supabase status -o env >"$stack_root/local-status.env"
  chmod 600 "$stack_root/local-status.env"
  # The CLI's query --file accepts only one prepared statement in 2.117.0.
  # psql is needed for the existing multi-statement fixture/migrations.
  # The sourced URL is never printed and must resolve to this runner's loopback.
  source "$stack_root/local-status.env"
  local_db_url="${DB_URL:-}"
  if [[ ! "$local_db_url" =~ ^postgres(ql)?://[^@]+@127\.0\.0\.1:[0-9]+/postgres$ ]]; then
    echo 'Refusing SQL: local loopback DB URL was not established.' >&2
    exit 1
  fi
  echo "POSTGRES_VERSION_$(printf '%s' "$run")=$(psql "$local_db_url" -X -Atc 'show server_version')"
  docker ps --format '{{.Image}}' | rg 'supabase|postgrest|gotrue|kong' | sort -u | sed 's/^/LOCAL_STACK_IMAGE=/'
  export LOCAL_SUPABASE_STATUS_FILE="$stack_root/local-status.env"
  export LOCAL_REHEARSAL_RUN="$run"

  sql_file supabase/tests/mybiz_15_table_exact_shape_fixture.sql
  sql_file supabase/tests/mybiz_15_table_fullstack_support.sql
  sql_file supabase/live_patches/20260318_fix_create_store_with_owner_live.sql
  refresh_schema
  node "$repo_root/scripts/security/mybiz-15-table-data-api.mjs" baseline
  run_app_routes
  echo "APP_HTTP_BASELINE_${run}=PASS"
  baseline_advisors="$stack_root/advisors-baseline-${run}.json"
  if ! supabase db advisors --local --type security --fail-on none --output-format json >"$baseline_advisors" 2>"$stack_root/advisors-baseline-${run}.err"; then
    echo "LOCAL_SECURITY_ADVISORS_BASELINE_${run}=UNAVAILABLE"
  fi

  sql_file supabase/migration_drafts/20260923040856_mybiz_15_table_rls_exact_shape_candidate.sql
  refresh_schema
  export LOCAL_SYNTHETIC_IDENTITIES_FILE="$stack_root/synthetic-identities-${run}.json"
  node "$repo_root/scripts/security/mybiz-15-table-data-api.mjs" candidate
  run_app_routes
  echo "HTTP_REHEARSAL_RUN_${run}=PASS"

  # R3 is a separate draft-only security repair layered on the same local
  # candidate. The prior bypass probe above must run before the ACL closes.
  sql_file supabase/migration_drafts/20260923102833_mybiz_r3_provisioning_rpc_boundary.sql
  sql_file supabase/tests/mybiz_r3_rpc_acl_assertions.sql
  refresh_schema
  export LOCAL_R3_APPLIED=1
  node "$repo_root/scripts/security/mybiz-r3-rpc-data-api.mjs"
  run_app_routes
  unset LOCAL_R3_APPLIED
  unset LOCAL_SYNTHETIC_IDENTITIES_FILE
  echo "R3_RPC_HTTP_REHEARSAL_${run}=PASS"

  # Advisors are diagnostic: existing unrelated warnings are reported, while
  # SQL assertions and HTTP probes are the mandatory pass/fail gates.
  candidate_advisors="$stack_root/advisors-candidate-${run}.json"
  if supabase db advisors --local --type security --fail-on none --output-format json >"$candidate_advisors" 2>"$stack_root/advisors-candidate-${run}.err"; then
    echo "LOCAL_SECURITY_ADVISORS_${run}=EXECUTED"
    if [[ -s "$baseline_advisors" ]]; then
      node "$repo_root/scripts/security/summarize-local-advisors.mjs" "$baseline_advisors" "$candidate_advisors"
    else
      echo "LOCAL_ADVISORS_CLASSIFICATION=BASELINE_UNAVAILABLE"
    fi
  else
    echo "LOCAL_SECURITY_ADVISORS_${run}=UNAVAILABLE"
  fi

  sql_file supabase/migration_drafts/20260923040858_mybiz_15_table_rls_exact_shape_rollback.sql
  sql_file supabase/tests/mybiz_15_table_rollback_assertions.sql
  refresh_schema
  node "$repo_root/scripts/security/mybiz-15-table-data-api.mjs" rollback
  run_app_routes
  echo "FULL_STACK_ROLLBACK_${run}=PASS"
  supabase stop --no-backup >/dev/null
  test ! -e supabase/.temp/project-ref
done
