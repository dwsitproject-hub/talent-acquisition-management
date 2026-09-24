#!/usr/bin/env bash
# Build a URL-encoded DATABASE_URL and write a compose override.
#
# Usage:
#   ./scripts/setup-database-url.sh [.env.file]
#
# Reads from the env file:
#   POSTGRES_USER       default: tas_user
#   POSTGRES_PASSWORD   required (unless DATABASE_URL is already set and --keep-url)
#   POSTGRES_HOST       default: postgres (Docker service name)
#   POSTGRES_PORT       default: 5432
#   POSTGRES_DB         default: tas_db
#   POSTGRES_SSLMODE    default: require when HOST is not postgres/localhost; otherwise omit
#   DATABASE_URL        optional; used only to infer host if POSTGRES_HOST is unset
#
# For ApsaraDB RDS:
#   POSTGRES_HOST=pgm-xxxx.pg.rds.aliyuncs.com POSTGRES_SSLMODE=require \
#     ./scripts/setup-database-url.sh .env.staging.backend

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${1:-$PROJECT_ROOT/.env.production}"

if [[ ! -f "$ENV_FILE" ]]; then
    echo -e "${RED}Error: Environment file not found: $ENV_FILE${NC}" >&2
    exit 1
fi

read_env() {
    local key="$1"
    local default="${2:-}"
    local val
    val="$(grep -E "^${key}=" "$ENV_FILE" | tail -1 | cut -d= -f2- | sed 's/\r$//' | sed 's/^["'\'']//;s/["'\'']$//')"
    if [[ -z "$val" ]]; then
        echo "$default"
    else
        echo "$val"
    fi
}

url_host_from() {
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

urlencode() {
    local raw="$1"
    if command -v python3 >/dev/null 2>&1; then
        POSTGRES_PASSWORD="$raw" python3 -c "import os, urllib.parse; print(urllib.parse.quote(os.environ['POSTGRES_PASSWORD'], safe=''))"
    elif command -v node >/dev/null 2>&1; then
        POSTGRES_PASSWORD="$raw" node -e "console.log(encodeURIComponent(process.env.POSTGRES_PASSWORD))"
    else
        echo -e "${YELLOW}Warning: Python/Node.js not found. Using basic encoding (may not handle all special chars)${NC}" >&2
        echo "$raw" | sed 's|%|%25|g; s|/|%2F|g; s|@|%40|g; s|:|%3A|g; s|#|%23|g; s|?|%3F|g; s|&|%26|g; s|=|%3D|g; s| |%20|g'
    fi
}

echo -e "${GREEN}Setting up DATABASE_URL with URL-encoded password...${NC}"

POSTGRES_PASSWORD="$(read_env POSTGRES_PASSWORD)"
if [[ -z "$POSTGRES_PASSWORD" ]]; then
    echo -e "${RED}Error: POSTGRES_PASSWORD not found in $ENV_FILE${NC}" >&2
    exit 1
fi

POSTGRES_USER="$(read_env POSTGRES_USER tas_user)"
POSTGRES_PORT="$(read_env POSTGRES_PORT 5432)"
POSTGRES_DB="$(read_env POSTGRES_DB tas_db)"
POSTGRES_HOST="$(read_env POSTGRES_HOST)"
POSTGRES_SSLMODE="$(read_env POSTGRES_SSLMODE)"

if [[ -z "$POSTGRES_HOST" ]]; then
    existing="$(read_env DATABASE_URL)"
    POSTGRES_HOST="$(url_host_from "$existing")"
fi
POSTGRES_HOST="${POSTGRES_HOST:-postgres}"

if [[ -z "$POSTGRES_SSLMODE" ]]; then
    case "$POSTGRES_HOST" in
        postgres|localhost|127.0.0.1)
            POSTGRES_SSLMODE=""
            ;;
        *)
            POSTGRES_SSLMODE="require"
            ;;
    esac
fi

POSTGRES_PASSWORD_ENCODED="$(urlencode "$POSTGRES_PASSWORD")"

QUERY="schema=public&pool_timeout=0&connection_limit=20"
if [[ -n "$POSTGRES_SSLMODE" && "$POSTGRES_SSLMODE" != "disable" ]]; then
    QUERY="schema=public&sslmode=${POSTGRES_SSLMODE}&pool_timeout=0&connection_limit=20"
fi

DATABASE_URL_VALUE="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD_ENCODED}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}?${QUERY}"

OVERRIDE_FILE="/tmp/docker-compose.override.yml"
printf 'services:\n  backend:\n    environment:\n      DATABASE_URL: "%s"\n' "${DATABASE_URL_VALUE}" > "$OVERRIDE_FILE"

echo -e "${GREEN}DATABASE_URL configured successfully${NC}"
echo "   Host: ${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}"
echo "   sslmode: ${POSTGRES_SSLMODE:-omit}"
echo "   Override file: $OVERRIDE_FILE"
echo ""

if [[ "$ENV_FILE" == *staging* ]]; then
    echo "To use this with staging compose, run:"
    echo "  docker compose -f docker-compose.staging.backend.yml -f $OVERRIDE_FILE -p tas-staging --env-file $ENV_FILE up -d backend"
else
    echo "To use this with docker-compose, run:"
    echo "  docker compose -f docker-compose.network.yml -f $OVERRIDE_FILE -p tas-production --env-file $ENV_FILE up -d backend"
fi
