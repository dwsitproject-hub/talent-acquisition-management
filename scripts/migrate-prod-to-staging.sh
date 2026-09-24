#!/usr/bin/env bash
# Dump production PostgreSQL and restore it onto staging.
#
# Run dump on the production host. Run restore on the staging host.
# Never point restore at a compose project whose name contains "production".
#
# After the staging ApsaraDB cutover, restore targets RDS (STAGING_APSARA_DATABASE_URL
# or staging DATABASE_URL whose host is not postgres). Local Docker Postgres is
# only used when that URL is unset / still points at the compose service.
#
# Usage:
#   ./scripts/migrate-prod-to-staging.sh dump
#   ./scripts/migrate-prod-to-staging.sh restore /path/to/backup_production_YYYYMMDD_HHMMSS.sql.gz
#   ./scripts/migrate-prod-to-staging.sh verify
#
# Optional env:
#   PROD_COMPOSE_FILE   default: docker-compose.network.yml (or auto-detect)
#   PROD_PROJECT        default: tas-production
#   PROD_ENV_FILE       default: .env.production
#   PROD_DATABASE_URL   if set, dump via pg_dump against this URL (RDS / remote)
#   STAGING_COMPOSE_FILE default: docker-compose.staging.backend.yml
#   STAGING_PROJECT     default: tas-staging
#   STAGING_ENV_FILE    default: .env.staging.backend
#   STAGING_APSARA_DATABASE_URL  restore/verify target after staging RDS cutover
#   PG18_IMAGE          default: postgres:18-alpine (client for RDS 18)
#   DB_USER             default: tas_user
#   DB_NAME             default: tas_db
#   CONFIRM             set to OVERWRITE-STAGING to skip the interactive prompt

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMMAND="${1:-}"
DUMP_PATH="${2:-}"

PROD_PROJECT="${PROD_PROJECT:-tas-production}"
PROD_ENV_FILE="${PROD_ENV_FILE:-.env.production}"
STAGING_PROJECT="${STAGING_PROJECT:-tas-staging}"
STAGING_ENV_FILE="${STAGING_ENV_FILE:-.env.staging.backend}"
STAGING_COMPOSE_FILE="${STAGING_COMPOSE_FILE:-docker-compose.staging.backend.yml}"
PG18_IMAGE="${PG18_IMAGE:-postgres:18-alpine}"
DB_USER="${DB_USER:-tas_user}"
DB_NAME="${DB_NAME:-tas_db}"
BACKUP_DIR="${BACKUP_DIR:-/opt/backups/tas-production}"

log()  { echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $*"; }
warn() { echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARN:${NC} $*"; }
die()  { echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR:${NC} $*" >&2; exit 1; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"
}

staging_env_path() {
  if [[ "$STAGING_ENV_FILE" = /* ]]; then
    echo "$STAGING_ENV_FILE"
  else
    echo "$PROJECT_ROOT/$STAGING_ENV_FILE"
  fi
}

env_get() {
  local key="$1"
  local file="$2"
  [[ -f "$file" ]] || return 0
  grep -E "^${key}=" "$file" 2>/dev/null | tail -1 | cut -d= -f2- | sed 's/\r$//' | sed 's/^["'\'']//;s/["'\'']$//'
}

url_host() {
  local url="$1"
  [[ -n "$url" ]] || { echo ""; return; }
  if command -v python3 >/dev/null 2>&1; then
    DATABASE_URL="$url" python3 -c "from urllib.parse import urlparse; import os; print(urlparse(os.environ['DATABASE_URL']).hostname or '')"
  elif command -v node >/dev/null 2>&1; then
    DATABASE_URL="$url" node -e "console.log(new URL(process.env.DATABASE_URL).hostname || '')"
  else
    echo "$url" | sed -E 's#^postgresql://[^@]+@([^:/]+).*#\1#'
  fi
}

redact_url() {
  echo "$1" | sed -E 's#(postgresql://[^:/?#]+:)[^@]+@#\1***@#'
}

staging_rds_url() {
  local url="${STAGING_APSARA_DATABASE_URL:-}"
  if [[ -z "$url" ]]; then
    url="$(env_get STAGING_APSARA_DATABASE_URL "$(staging_env_path)")"
  fi
  if [[ -z "$url" ]]; then
    local dburl host
    dburl="$(env_get DATABASE_URL "$(staging_env_path)")"
    host="$(url_host "$dburl")"
    if [[ -n "$dburl" && "$host" != "postgres" && "$host" != "localhost" && "$host" != "127.0.0.1" ]]; then
      url="$dburl"
    fi
  fi
  echo "$url"
}

pg18_rds_net() {
  if [[ "$(uname -s)" == "Linux" ]]; then
    echo host
  else
    echo bridge
  fi
}

run_pg18_rds() {
  local url="$1"
  local shell_cmd="$2"
  docker run --rm -i --network "$(pg18_rds_net)" \
    -e PGSSLMODE="${PGSSLMODE:-require}" \
    -e DATABASE_URL="$url" \
    "$PG18_IMAGE" \
    sh -c "$shell_cmd"
}

detect_prod_compose() {
  if [[ -n "${PROD_COMPOSE_FILE:-}" ]]; then
    echo "$PROD_COMPOSE_FILE"
    return
  fi
  if [[ -f "$PROJECT_ROOT/docker-compose.network.yml" ]]; then
    echo "docker-compose.network.yml"
  elif [[ -f "$PROJECT_ROOT/docker-compose.production.yml" ]]; then
    echo "docker-compose.production.yml"
  else
    echo "docker-compose.yml"
  fi
}

compose() {
  local env_file="$1"
  local compose_file="$2"
  local project="$3"
  shift 3
  local args=(compose -p "$project" -f "$compose_file")
  if [[ -f "$PROJECT_ROOT/$env_file" ]]; then
    args+=(--env-file "$env_file")
  fi
  docker "${args[@]}" "$@"
}

compose_staging() {
  compose "$STAGING_ENV_FILE" "$STAGING_COMPOSE_FILE" "$STAGING_PROJECT" "$@"
}

compose_staging_local_db() {
  compose_staging --profile local-db "$@"
}

assert_not_production_target() {
  local name
  name="$(echo "$STAGING_PROJECT" | tr '[:upper:]' '[:lower:]')"
  if [[ "$name" == *production* ]]; then
    die "Refusing restore: STAGING_PROJECT='$STAGING_PROJECT' looks like production."
  fi
  name="$(echo "$STAGING_COMPOSE_FILE" | tr '[:upper:]' '[:lower:]')"
  if [[ "$name" == *production* ]]; then
    die "Refusing restore: STAGING_COMPOSE_FILE='$STAGING_COMPOSE_FILE' looks like production."
  fi
  local url host
  url="$(staging_rds_url)"
  host="$(url_host "$url" | tr '[:upper:]' '[:lower:]')"
  if [[ -n "$host" && "$host" == *prod* && "$host" != *staging* ]]; then
    die "Refusing restore: RDS host looks like production ($(redact_url "$url"))."
  fi
}

confirm_overwrite() {
  if [[ "${CONFIRM:-}" == "OVERWRITE-STAGING" ]]; then
    return
  fi
  echo
  warn "This will replace the staging database '$DB_NAME' and overwrite existing data."
  read -r -p "Type OVERWRITE-STAGING to continue: " answer
  [[ "$answer" == "OVERWRITE-STAGING" ]] || die "Aborted."
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

count_rows_docker() {
  compose_staging_local_db exec -T postgres \
    psql -U "$DB_USER" -d "$DB_NAME" -At -c "$(count_sql)"
}

count_rows_rds() {
  local url="$1"
  run_pg18_rds "$url" 'psql "$DATABASE_URL" -At -v ON_ERROR_STOP=1' <<SQL
$(count_sql)
SQL
}

dump_from_url() {
  require_cmd pg_dump
  require_cmd gzip
  local outfile="$1"
  log "Dumping via PROD_DATABASE_URL (host only, credentials not printed)..."
  pg_dump \
    --dbname="$PROD_DATABASE_URL" \
    --no-owner \
    --no-acl \
    --format=plain \
    --encoding=UTF8 \
    | gzip -9 > "$outfile"
}

dump_from_docker() {
  require_cmd docker
  require_cmd gzip
  local outfile="$1"
  local compose_file
  compose_file="$(detect_prod_compose)"
  cd "$PROJECT_ROOT"
  log "Dumping from Docker project '$PROD_PROJECT' ($compose_file)..."
  compose "$PROD_ENV_FILE" "$compose_file" "$PROD_PROJECT" exec -T postgres \
    pg_dump -U "$DB_USER" --no-owner --no-acl --format=plain --encoding=UTF8 "$DB_NAME" \
    | gzip -9 > "$outfile"
}

cmd_dump() {
  require_cmd gzip
  mkdir -p "$BACKUP_DIR"
  local ts outfile
  ts="$(date +%Y%m%d_%H%M%S)"
  outfile="${BACKUP_DIR}/backup_production_${ts}.sql.gz"

  if [[ -n "${PROD_DATABASE_URL:-}" ]]; then
    dump_from_url "$outfile"
  else
    dump_from_docker "$outfile"
  fi

  [[ -s "$outfile" ]] || die "Dump file is empty: $outfile"
  log "Dump written: $outfile ($(du -h "$outfile" | cut -f1))"
  echo
  echo "Next: copy to staging, then restore:"
  echo "  scp $outfile user@staging-host:/opt/backups/tas-staging/"
  echo "  CONFIRM=OVERWRITE-STAGING ./scripts/migrate-prod-to-staging.sh restore /opt/backups/tas-staging/$(basename "$outfile")"
}

restore_to_rds() {
  local url="$1"
  local staging_backup_dir staging_safety
  staging_backup_dir="${STAGING_BACKUP_DIR:-$PROJECT_ROOT/backups}"
  mkdir -p "$staging_backup_dir"
  staging_safety="${staging_backup_dir}/backup_staging_apsara_before_restore_$(date +%Y%m%d_%H%M%S).sql.gz"

  log "Stopping staging backend to drop DB connections..."
  compose_staging stop backend || true

  log "Safety dump of current staging RDS -> $staging_safety"
  if ! docker run --rm --network "$(pg18_rds_net)" \
        -e PGSSLMODE="${PGSSLMODE:-require}" \
        -e DATABASE_URL="$url" \
        "$PG18_IMAGE" \
        sh -c 'pg_dump --dbname="$DATABASE_URL" --no-owner --no-acl --format=plain --encoding=UTF8' \
      | gzip -9 > "$staging_safety"; then
    rm -f "$staging_safety"
    die "Safety dump of current staging RDS failed. Aborting before schema drop."
  fi
  if [[ ! -s "$staging_safety" ]]; then
    rm -f "$staging_safety"
    die "Safety dump of current staging RDS is empty. Aborting before schema drop."
  fi
  log "Staging RDS safety dump: $(du -h "$staging_safety" | cut -f1)"

  log "Recreating schema public on staging ApsaraDB..."
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
      die "Unsupported dump format for RDS restore. Use .sql or .sql.gz"
      ;;
  esac

  log "ANALYZE on PostgreSQL 18..."
  run_pg18_rds "$url" 'psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "ANALYZE;"'

  log "Invalidating copied sessions and form tokens..."
  run_pg18_rds "$url" 'psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "TRUNCATE TABLE refresh_tokens; TRUNCATE TABLE candidate_form_tokens;"' \
    || warn "Could not truncate session/token tables (names may differ). Continue."

  log "Starting staging backend (Prisma will migrate if PRISMA_MIGRATE_ON_START=true)..."
  compose_staging up -d backend

  echo
  log "Staging RDS row counts:"
  count_rows_rds "$url" || true
}

restore_to_docker() {
  local staging_backup_dir staging_safety
  staging_backup_dir="${STAGING_BACKUP_DIR:-$PROJECT_ROOT/backups}"
  mkdir -p "$staging_backup_dir"
  staging_safety="${staging_backup_dir}/backup_staging_before_restore_$(date +%Y%m%d_%H%M%S).sql.gz"

  log "Ensuring local staging Postgres is up (--profile local-db)..."
  compose_staging_local_db up -d postgres

  log "Stopping staging backend to drop DB connections..."
  compose_staging stop backend || true

  log "Safety dump of current staging -> $staging_safety"
  if ! compose_staging_local_db exec -T postgres \
      pg_dump -U "$DB_USER" --no-owner --no-acl --format=plain "$DB_NAME" \
      | gzip -9 > "$staging_safety"; then
    rm -f "$staging_safety"
    die "Safety dump of current staging failed. Aborting before DROP DATABASE."
  fi
  if [[ ! -s "$staging_safety" ]]; then
    rm -f "$staging_safety"
    die "Safety dump of current staging is empty. Aborting before DROP DATABASE."
  fi
  log "Staging safety dump: $(du -h "$staging_safety" | cut -f1)"

  log "Terminating leftover connections and recreating $DB_NAME..."
  compose_staging_local_db exec -T postgres \
    psql -U "$DB_USER" -d postgres -v ON_ERROR_STOP=1 <<SQL
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS ${DB_NAME};
CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};
SQL

  log "Restoring $DUMP_PATH ..."
  case "$DUMP_PATH" in
    *.sql.gz)
      gunzip -c "$DUMP_PATH" | compose_staging_local_db \
        exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1
      ;;
    *.dump)
      compose_staging_local_db \
        exec -T postgres pg_restore --no-owner --no-acl --clean --if-exists -U "$DB_USER" -d "$DB_NAME" < "$DUMP_PATH"
      ;;
    *.sql)
      compose_staging_local_db \
        exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 < "$DUMP_PATH"
      ;;
    *)
      die "Unsupported dump format. Use .sql, .sql.gz, or .dump"
      ;;
  esac

  log "Invalidating copied sessions and form tokens..."
  compose_staging_local_db exec -T postgres \
    psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -c "
      TRUNCATE TABLE refresh_tokens;
      TRUNCATE TABLE candidate_form_tokens;
    " || warn "Could not truncate session/token tables (names may differ). Continue."

  log "Starting staging backend (Prisma will migrate if PRISMA_MIGRATE_ON_START=true)..."
  compose_staging_local_db up -d backend

  echo
  log "Staging row counts:"
  count_rows_docker || true
}

cmd_restore() {
  require_cmd docker
  [[ -n "$DUMP_PATH" ]] || die "Usage: $0 restore /path/to/backup.sql.gz"
  [[ -f "$DUMP_PATH" ]] || die "Dump not found: $DUMP_PATH"
  [[ -s "$DUMP_PATH" ]] || die "Dump is empty: $DUMP_PATH"
  assert_not_production_target
  confirm_overwrite

  cd "$PROJECT_ROOT"
  [[ -f "$STAGING_COMPOSE_FILE" ]] || die "Missing $STAGING_COMPOSE_FILE"

  local rds_url
  rds_url="$(staging_rds_url)"
  if [[ -n "$rds_url" ]]; then
    log "Staging restore target is ApsaraDB ($(redact_url "$rds_url"))."
    docker pull "$PG18_IMAGE" >/dev/null
    restore_to_rds "$rds_url"
  else
    log "Staging restore target is local Docker Postgres (--profile local-db)."
    restore_to_docker
  fi

  echo
  warn "Copy ENCRYPTION_KEY from production into staging, or national IDs will not decrypt."
  warn "Copy backend/uploads from production if you need CVs and documents on staging."
  log "Restore complete."
}

cmd_verify() {
  require_cmd docker
  cd "$PROJECT_ROOT"
  local rds_url
  rds_url="$(staging_rds_url)"
  if [[ -n "$rds_url" ]]; then
    log "Row counts on staging ApsaraDB:"
    count_rows_rds "$rds_url"
  else
    log "Row counts on $STAGING_PROJECT / $DB_NAME (local Docker):"
    count_rows_docker
  fi
}

usage() {
  cat <<EOF
Dump production PostgreSQL and restore onto staging.

Commands:
  dump                    Take a gzipped SQL dump (run on production)
  restore <file>          Wipe staging and restore <file> (run on staging)
  verify                  Print key table row counts on staging

After staging uses ApsaraDB, restore/verify use STAGING_APSARA_DATABASE_URL
or DATABASE_URL in $STAGING_ENV_FILE (host must not be postgres).

Examples:
  # Production host
  ./scripts/migrate-prod-to-staging.sh dump

  # Staging host (ApsaraDB)
  CONFIRM=OVERWRITE-STAGING ./scripts/migrate-prod-to-staging.sh \\
    restore /opt/backups/tas-staging/backup_production_20260908_120000.sql.gz

RDS / remote production (no local postgres container):
  PROD_DATABASE_URL='postgresql://USER:PASS@HOST:5432/tas_db' \\
    ./scripts/migrate-prod-to-staging.sh dump
EOF
}

case "$COMMAND" in
  dump)    cmd_dump ;;
  restore) cmd_restore ;;
  verify)  cmd_verify ;;
  *)       usage; exit 1 ;;
esac
