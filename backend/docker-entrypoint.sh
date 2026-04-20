#!/bin/sh
set -e
cd /app

# Apply additive DDL before the app starts. Docker Compose often reuses an old
# Postgres volume while the Prisma schema has moved on; migrate deploy is not
# wired for every stack, so this idempotent statement keeps DB and client in sync.
if [ -n "$DATABASE_URL" ]; then
  echo "Applying database schema updates (master_divisions.hiringManagerName if missing)..."
  npx prisma db execute --schema ./prisma/schema.prisma --file ./prisma/migrations/20260417120000_master_division_hiring_manager/migration.sql
fi

exec "$@"
