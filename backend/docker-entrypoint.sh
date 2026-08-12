#!/bin/sh
set -e

if [ "${PRISMA_MIGRATE_ON_START:-false}" = "true" ]; then
  echo "[entrypoint] Running prisma migrate deploy..."
  npx prisma migrate deploy
fi

exec node src/server.js
