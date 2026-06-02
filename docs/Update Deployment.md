Backend

cd /opt/tas-production

# Discard local changes to the script (use the version from GitHub)
git checkout -- scripts/setup-database-url.sh

# Now pull should work
git pull origin SIT

# Then proceed with your deployment
./scripts/setup-database-url.sh .env.production
docker compose -f docker-compose.network.yml -f /tmp/docker-compose.override.yml -p tas-production --env-file .env.production up -d --build backend

# Run pending database migrations (required after any schema change)
docker compose -f docker-compose.network.yml -p tas-production --env-file .env.production exec backend npx prisma migrate deploy

Frontend

cd /opt/tas-production
git pull origin SIT

docker compose -f docker-compose.frontend.yml -p tas-production --env-file .env.production up -d --build

# Quick Fix for 504 Gateway Timeout (if nginx can't reach frontend/candidate-portal)
# Use this instead of full rebuild if containers just need network connectivity restored:
# bash scripts/quick-fix-504-timeout.sh