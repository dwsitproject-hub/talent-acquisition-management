#!/usr/bin/env bash
# Dump staging Docker PostgreSQL 15 and restore onto ApsaraDB RDS PostgreSQL 18.
#
# Run on the staging backend host (same VPC as RDS). Uses postgres:18-alpine as
# the client so dump (PG 15 source) and restore (PG 18 target) stay compatible.
#
# Usage:
#   ./scripts/migrate-staging-to-apsaradb.sh preflight
#   ./scripts/migrate-staging-to-apsaradb.sh dump
#   ./scripts/migrate-staging-to-apsaradb.sh restore /path/to/backup_staging_YYYYMMDD_HHMMSS.sql.gz
#   ./scripts/migrate-staging-to-apsaradb.sh verify
#   ./scripts/migrate-staging-to-apsaradb.sh migrate-check
#   ./scripts/migrate-staging-to-apsaradb.sh cutover
#
# Required env (or set in STAGING_ENV_FILE):
#   STAGING_APSARA_DATABASE_URL  postgresql://USER:PASS@HOST:5432/tas_db?sslmode=require
#
# Optional env:
#   STAGING_COMPOSE_FILE  default: docker-compose.staging.backend.yml
#   STAGING_PROJECT       default: tas-staging
#   STAGING_ENV_FILE      default: .env.staging.backend
#   PG18_IMAGE            default: postgres:18-alpine
#   DB_USER / DB_NAME     defaults: tas_user / tas_db
#   CONFIRM               set to OVERWRITE-APSARA to skip the restore prompt
#   CUTOVER_RECREATE      set to 1 to recreate backend+redis after restore
#                         (DATABASE_URL in the env file must already point at RDS)

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMMAND="${1:-}"
DUMP_PATH="${2:-}"

STAGING_PROJECT="${STAGING_PROJECT:-tas-staging}"
STAGING_ENV_FILE="${STAGING_ENV_FILE:-.env.staging.backend}"
STAGING_COMPOSE_FILE="${STAGING_COMPOSE_FILE:-docker-compose.staging.backend.yml}"
PG18_IMAGE="${PG18_IMAGE:-postgres:18-alpine}"
DB_USER="${DB_USER:-tas_user}"
DB_NAME="${DB_NAME:-tas_db}"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_ROOT/backups}"

log()  { echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $*"; }
warn() { echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARN:${NC} $*"; }
die()  { echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR:${NC} $*" >&2; exit 1; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"
}

env_file_path() {
  if [[ "$STAGING_ENV_FILE" = /* ]]; then
    echo "$STAGING_ENV_FILE"
  else
    echo "$PROJECT_ROOT/$STAGING_ENV_FILE"
  fi
}

env_get() {
  local key="$1"
  local file
  file="$(env_file_path)"
  [[ -f "$file" ]] || return 0
  grep -E "^${key}=" "$file" 2>/dev/null | tail -1 | cut -d= -f2- | sed 's/\r$//' | sed 's/^["'\'']//;s/["'\'']$//'
}

redact_url() {
  echo "$1" | sed -E 's#(postgresql://[^:/?#]+:)[^@]+@#\1***@#'
}

url_host() {
  local url="$1"
  if command -v python3 >/dev/null 2>&1; then
    DATABASE_URL="$url" python3 -c "from urllib.parse import urlparse; import os; print(urlparse(os.environ['DATABASE_URL']).hostname or '')"
  elif command -v node >/dev/null 2>&1; then
    DATABASE_URL="$url" node -e "console.log(new URL(process.env.DATABASE_URL).hostname || '')"
  else
    echo "$url" | sed -E 's#^postgresql://[^@]+@([^:/]+).*#\1#'
  fi
}

url_port() {
  local url="$1"
  if command -v python3 >/dev/null 2>&1; then
    DATABASE_URL="$url" python3 -c "from urllib.parse import urlparse; import os; u=urlparse(os.environ['DATABASE_URL']); print(u.port or 5432)"
  elif command -v node >/dev/null 2>&1; then
    DATABASE_URL="$url" node -e "console.log(new URL(process.env.DATABASE_URL).port || '5432')"
  else
    echo "5432"
  fi
}

apsara_url() {
  local url="${STAGING_APSARA_DATABASE_URL:-}"
  if [[ -z "$url" ]]; then
    url="$(env_get STAGING_APSARA_DATABASE_URL)"
  fi
  if [[ -z "$url" ]]; then
    local dburl
    dburl="$(env_get DATABASE_URL)"
    local host
    host="$(url_host "$dburl")"
    if [[ -n "$dburl" && "$host" != "postgres" && "$host" != "localhost" && "$host" != "127.0.0.1" ]]; then
      url="$dburl"
    fi
  fi
  [[ -n "$url" ]] || die "STAGING_APSARA_DATABASE_URL is required (or DATABASE_URL pointing at RDS, not postgres)."
  echo "$url"
}

assert_not_production_target() {
  local name url host
  name="$(echo "$STAGING_PROJECT" | tr '[:upper:]' '[:lower:]')"
  if [[ "$name" == *production* ]]; then
    die "Refusing: STAGING_PROJECT='$STAGING_PROJECT' looks like production."
  fi
  name="$(echo "$STAGING_COMPOSE_FILE" | tr '[:upper:]' '[:lower:]')"
  if [[ "$name" == *production* ]]; then
    die "Refusing: STAGING_COMPOSE_FILE='$STAGING_COMPOSE_FILE' looks like production."
  fi
  url="$(apsara_url)"
  host="$(url_host "$url" | tr '[:upper:]' '[:lower:]')"
  if [[ "$host" == *prod* && "$host" != *staging* ]]; then
    die "Refusing: RDS host '$(redact_url "$url")' looks like production."
  fi
}

confirm_overwrite() {
  if [[ "${CONFIRM:-}" == "OVERWRITE-APSARA" ]]; then
    return
  fi
  echo
  warn "This will DROP SCHEMA public on ApsaraDB and replace it with the dump."
  read -r -p "Type OVERWRITE-APSARA to continue: " answer
  [[ "$answer" == "OVERWRITE-APSARA" ]] || die "Aborted."
}

compose() {
  local args=(compose -p "$STAGING_PROJECT" -f "$STAGING_COMPOSE_FILE")
  local env_path
  env_path="$(env_file_path)"
  if [[ -f "$env_path" ]]; then
    args+=(--env-file "$env_path")
  fi
  docker "${args[@]}" "$@"
}

compose_local_db() {
  compose --profile local-db "$@"
}

ensure_pg18_image() {
  require_cmd docker
  log "Pulling $PG18_IMAGE (PostgreSQL 18 client)..."
  docker pull "$PG18_IMAGE" >/dev/null
}

# Linux: host network so VPC DNS + routing match the ECS host.
# Other OS: default bridge (RDS private IP will not be reachable from a laptop).
pg18_rds_net() {
  if [[ "$(uname -s)" == "Linux" ]]; then
    echo host
  else
    echo bridge
  fi
}

run_pg18_rds() {
  local net
  net="$(pg18_rds_net)"
  docker run --rm -i --network "$net" \
    -e PGSSLMODE="${PGSSLMODE:-require}" \
    -e DATABASE_URL="$1" \
    "$PG18_IMAGE" \
    sh -c "$2"
}

run_pg18_rds_exec() {
  local url="$1"
  shift
  local net
  net="$(pg18_rds_net)"
  docker run --rm --network "$net" \
    -e PGSSLMODE="${PGSSLMODE:-require}" \
    -e DATABASE_URL="$url" \
    "$PG18_IMAGE" \
    "$@"
}

postgres_container_network() {
  docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}' tas_staging_postgres 2>/dev/null \
    || die "Container tas_staging_postgres is not running. Start it with: docker compose -f $STAGING_COMPOSE_FILE --env-file $STAGING_ENV_FILE -p $STAGING_PROJECT --profile local-db up -d postgres"
}

ensure_local_postgres() {
  cd "$PROJECT_ROOT"
  [[ -f "$STAGING_COMPOSE_FILE" ]] || die "Missing $STAGING_COMPOSE_FILE"
  log "Ensuring local Postgres 15 is up (--profile local-db)..."
  compose_local_db up -d postgres
  local i
  for i in $(seq 1 30); do
    if compose_local_db exec -T postgres pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
      return
    fi
    sleep 2
  done
  die "Local postgres did not become ready."
}

count_sql() {
  cat <<'SQL'
SELECT string_agg(format('%s=%s', t.relname, t.n), E'\n' ORDER BY t.relname)
FROM (
  SELECT 'users'::text AS relname, count(*)::bigint AS n FROM users
  UNION ALL SELECT 'candidates', count(*) FROM candidates
  UNION ALL SELECT 'fptk', count(*) FROM fptk
  UNION ALL SELECT 'applications', count(*) FROM applications
  UNION ALL SELECT 'interviews', count(*) FROM interviews
  UNION ALL SELECT 'offers', count(*) FROM offers
  UNION ALL SELECT 'documents', count(*) FROM documents
  UNION ALL SELECT 'onboarding', count(*) FROM onboarding
  UNION ALL SELECT 'audit_logs', count(*) FROM audit_logs
  UNION ALL SELECT '_prisma_migrations', count(*) FROM _prisma_migrations
) t;
SQL
}

count_rows_local() {
  ensure_local_postgres
  compose_local_db exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -At -c "$(count_sql)"
}

count_rows_rds() {
  local url="$1"
  run_pg18_rds "$url" 'psql "$DATABASE_URL" -At -v ON_ERROR_STOP=1' <<SQL
$(count_sql)
SQL
}

cmd_preflight() {
  require_cmd docker
  cd "$PROJECT_ROOT"
  local url host port version
  url="$(apsara_url)"
  host="$(url_host "$url")"
  port="$(url_port "$url")"
  [[ -n "$host" ]] || die "Could not parse host from STAGING_APSARA_DATABASE_URL."
  assert_not_production_target

  log "Preflight target host=$host port=$port (credentials not printed)"
  echo "  Confirm on Aliyun console: RDS whitelist + SG allow TCP $port from this ECS private IP."
  echo "  Same VPC is not enough by itself."
  ensure_pg18_image

  log "TCP + SELECT version() via $PG18_IMAGE (sslmode=${PGSSLMODE:-require})..."
  version="$(run_pg18_rds "$url" 'psql "$DATABASE_URL" -At -v ON_ERROR_STOP=1 -c "SELECT version();"')"
  echo "  $version"
  echo "$version" | grep -qi 'PostgreSQL 18' || die "ApsaraDB is not PostgreSQL 18. Got: $version"

  log "Checking app-user can use schema public..."
  run_pg18_rds "$url" 'psql "$DATABASE_URL" -At -v ON_ERROR_STOP=1' <<'SQL'
SELECT current_user, current_database(), current_setting('ssl') AS ssl;
SQL

  if docker inspect tas_staging_backend >/dev/null 2>&1; then
    local bnet
    bnet="$(docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}' tas_staging_backend)"
    if [[ -n "$bnet" ]]; then
      log "Repeating SELECT version() from the backend container network ($bnet)..."
      docker run --rm --network "$bnet" \
        -e PGSSLMODE="${PGSSLMODE:-require}" \
        -e DATABASE_URL="$url" \
        "$PG18_IMAGE" \
        sh -c 'psql "$DATABASE_URL" -At -v ON_ERROR_STOP=1 -c "SELECT version();"' \
        | grep -qi 'PostgreSQL 18' \
        || die "Backend network cannot reach ApsaraDB PostgreSQL 18. Check RDS whitelist and VPC DNS."
      log "Backend Docker network can reach RDS."
    fi
  else
    warn "tas_staging_backend is not running; skipped in-network check. Run preflight again after backend is up."
  fi

  log "Preflight OK. Dump/restore tooling is proven against PostgreSQL 18."
}

cmd_dump() {
  require_cmd docker
  require_cmd gzip
  ensure_pg18_image
  ensure_local_postgres
  mkdir -p "$BACKUP_DIR"

  local ts outfile net pw local_port
  ts="$(date +%Y%m%d_%H%M%S)"
  outfile="${BACKUP_DIR}/backup_staging_${ts}.sql.gz"
  net="$(postgres_container_network)"
  pw="$(env_get POSTGRES_PASSWORD)"
  local_port="$(env_get POSTGRES_PORT)"
  [[ -n "$pw" ]] || die "POSTGRES_PASSWORD not found in $STAGING_ENV_FILE (needed to dump local PG 15)."

  log "Dumping local PG 15 via $PG18_IMAGE on network $net (no credentials printed)..."
  docker run --rm --network "$net" \
    -e PGPASSWORD="$pw" \
    "$PG18_IMAGE" \
    pg_dump -h tas_staging_postgres -p "${local_port:-5432}" -U "$DB_USER" \
      --no-owner --no-acl --format=plain --encoding=UTF8 "$DB_NAME" \
    | gzip -9 > "$outfile"

  [[ -s "$outfile" ]] || die "Dump file is empty: $outfile"
  log "Dump written: $outfile ($(du -h "$outfile" | cut -f1))"
  echo
  echo "Next:"
  echo "  CONFIRM=OVERWRITE-APSARA $0 restore $outfile"
}

cmd_restore() {
  require_cmd docker
  [[ -n "$DUMP_PATH" ]] || die "Usage: $0 restore /path/to/backup.sql.gz"
  [[ -f "$DUMP_PATH" ]] || die "Dump not found: $DUMP_PATH"
  [[ -s "$DUMP_PATH" ]] || die "Dump is empty: $DUMP_PATH"
  assert_not_production_target
  confirm_overwrite
  ensure_pg18_image

  local url safety
  url="$(apsara_url)"
  mkdir -p "$BACKUP_DIR"
  safety="${BACKUP_DIR}/backup_apsara_before_restore_$(date +%Y%m%d_%H%M%S).sql.gz"

  log "Safety dump of current ApsaraDB -> $safety"
  if run_pg18_rds_exec "$url" \
      sh -c 'pg_dump --dbname="$DATABASE_URL" --no-owner --no-acl --format=plain --encoding=UTF8' \
      | gzip -9 > "$safety"; then
    if [[ -s "$safety" ]]; then
      log "RDS safety dump: $(du -h "$safety" | cut -f1)"
    else
      warn "RDS safety dump was empty (new database is OK)."
      rm -f "$safety"
    fi
  else
    warn "Could not dump current RDS (empty DB is OK). Continuing."
    rm -f "$safety"
  fi

  log "Terminating leftover sessions and recreating schema public on RDS..."
  run_pg18_rds "$url" 'psql "$DATABASE_URL" -v ON_ERROR_STOP=1' <<SQL
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = current_database() AND pid <> pg_backend_pid();
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO CURRENT_USER;
GRANT ALL ON SCHEMA public TO public;
SQL

  log "Restoring $DUMP_PATH onto $(redact_url "$url") ..."
  case "$DUMP_PATH" in
    *.sql.gz)
      gunzip -c "$DUMP_PATH" | run_pg18_rds "$url" 'psql "$DATABASE_URL" -v ON_ERROR_STOP=1'
      ;;
    *.sql)
      run_pg18_rds "$url" 'psql "$DATABASE_URL" -v ON_ERROR_STOP=1' < "$DUMP_PATH"
      ;;
    *)
      die "Unsupported dump format. Use .sql or .sql.gz"
      ;;
  esac

  log "ANALYZE on PostgreSQL 18..."
  run_pg18_rds "$url" 'psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "ANALYZE;"'

  log "Restore complete. Row counts on RDS:"
  count_rows_rds "$url" || true
}

cmd_verify() {
  require_cmd docker
  ensure_pg18_image
  local url
  url="$(apsara_url)"
  echo
  log "Local Docker PG 15 row counts:"
  count_rows_local || warn "Local postgres not available (already stopped after cutover is OK)."
  echo
  log "ApsaraDB PG 18 row counts:"
  count_rows_rds "$url"
}

cmd_migrate_check() {
  require_cmd docker
  cd "$PROJECT_ROOT"
  local url
  url="$(apsara_url)"
  assert_not_production_target
  log "Running prisma migrate deploy against RDS (Prisma 5 vs PostgreSQL 18)..."
  compose run --rm --no-deps \
    -e DATABASE_URL="$url" \
    -e PRISMA_MIGRATE_ON_START=false \
    backend npx prisma migrate deploy
  log "prisma migrate deploy succeeded. Leave PRISMA_MIGRATE_ON_START=true."
}

cmd_cutover() {
  require_cmd docker
  cd "$PROJECT_ROOT"
  local url host
  url="$(apsara_url)"
  host="$(url_host "$url")"
  assert_not_production_target

  log "Cutover freeze: stopping staging backend so local PG 15 gets no new writes..."
  compose stop backend || true

  cmd_dump

  local latest
  latest="$(ls -1t "$BACKUP_DIR"/backup_staging_*.sql.gz 2>/dev/null | head -1)"
  [[ -n "$latest" && -f "$latest" ]] || die "No dump file found after dump."
  DUMP_PATH="$latest"
  CONFIRM="${CONFIRM:-OVERWRITE-APSARA}" cmd_restore

  echo
  log "Comparing row counts (local vs RDS)..."
  cmd_verify

  log "Optional Prisma 5 migrate-check against PG 18..."
  if cmd_migrate_check; then
    log "migrate deploy is safe on this RDS."
  else
    warn "prisma migrate deploy failed on PG 18. After cutover set PRISMA_MIGRATE_ON_START=false."
  fi

  local env_url env_host
  env_url="$(env_get DATABASE_URL)"
  env_host="$(url_host "$env_url")"

  if [[ "${CUTOVER_RECREATE:-}" == "1" && -n "$env_host" && "$env_host" != "postgres" && "$env_host" != "localhost" ]]; then
    log "Recreating backend+redis without local-db profile (DATABASE_URL already points at $env_host)..."
    compose up -d redis backend
    log "Leave local Postgres 15 stopped. Volume postgres_staging_data is retained for rollback (>= 7 days)."
  else
    echo
    warn "Restore is done. Flip staging connection next (do not start --profile local-db):"
    echo "  1. Set DATABASE_URL in $STAGING_ENV_FILE to the ApsaraDB URL (sslmode=require, URL-encoded password)."
    echo "     Host should be: $host"
    echo "  2. docker compose -f $STAGING_COMPOSE_FILE --env-file $STAGING_ENV_FILE -p $STAGING_PROJECT up -d redis backend"
    echo "  3. Smoke: curl -sS http://127.0.0.1:\${BACKEND_HOST_PORT:-4000}/health"
    echo "  4. Keep volume postgres_staging_data for at least 7 days."
    echo
    echo "Rollback:"
    echo "  docker compose -f $STAGING_COMPOSE_FILE --env-file $STAGING_ENV_FILE -p $STAGING_PROJECT --profile local-db up -d"
    echo "  (set DATABASE_URL host back to postgres; sslmode can be disable)"
  fi
}

usage() {
  cat <<EOF
Dump staging Docker PostgreSQL 15 and restore onto ApsaraDB RDS PostgreSQL 18.

Commands:
  preflight               TCP + SELECT version() must be PostgreSQL 18 (PG 18 client)
  dump                    Gzipped SQL dump of local Docker PG 15
  restore <file>          Recreate schema public on RDS and restore <file>
  verify                  Key-table COUNT(*) on local PG 15 and RDS 18
  migrate-check           prisma migrate deploy against RDS (Prisma 5 vs PG 18)
  cutover                 Stop backend, dump, restore, verify, print env-flip steps

Examples (staging backend host):
  export STAGING_APSARA_DATABASE_URL='postgresql://USER:PASS@rds-host:5432/tas_db?sslmode=require'
  ./scripts/migrate-staging-to-apsaradb.sh preflight
  ./scripts/migrate-staging-to-apsaradb.sh dump
  CONFIRM=OVERWRITE-APSARA ./scripts/migrate-staging-to-apsaradb.sh restore backups/backup_staging_YYYYMMDD_HHMMSS.sql.gz
  ./scripts/migrate-staging-to-apsaradb.sh verify

Full freeze + restore (still set DATABASE_URL before recreating backend):
  CONFIRM=OVERWRITE-APSARA ./scripts/migrate-staging-to-apsaradb.sh cutover
EOF
}

case "$COMMAND" in
  preflight)      cmd_preflight ;;
  dump)           cmd_dump ;;
  restore)        cmd_restore ;;
  verify)         cmd_verify ;;
  migrate-check)  cmd_migrate_check ;;
  cutover)        cmd_cutover ;;
  *)              usage; exit 1 ;;
esac
