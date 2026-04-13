# Quick Fix for Git Pull Conflict

## Situation
Local changes to `package.json` are identical to what we're pulling (exceljs added, xlsx removed).

## Solution
Discard local changes and pull:

```bash
cd /opt/tas-production

# Discard local changes (they're the same as what we're pulling)
git checkout -- frontend/package.json

# Pull the updates
git pull origin SIT
```

This is safe because:
- Local changes = adding exceljs, removing xlsx
- Remote changes = adding exceljs, removing xlsx
- They're identical, so discarding local and pulling will get the same result

## After Pulling

Rebuild the frontend container:

```bash
# Rebuild with new dependencies
docker compose -f docker-compose.frontend.yml -p tas-production --env-file .env.production build --no-cache frontend

# Restart
docker compose -f docker-compose.frontend.yml -p tas-production --env-file .env.production up -d frontend

# Verify
docker logs tas_frontend --tail 50
curl -I http://localhost:8080
```

