# Resolving Git Pull Conflict

## Issue
When pulling from SIT branch, you get:
```
error: Your local changes to the following files would be overwritten by merge:
        frontend/package.json
Please commit your changes or stash them before you merge.
```

## Solution Options

### Option 1: Check What Changed (Recommended First)
```bash
cd /opt/tas-production
git diff frontend/package.json
```

This shows what local changes exist. If they're not important, discard them.

### Option 2: Discard Local Changes (If Not Important)
```bash
cd /opt/tas-production
git checkout -- frontend/package.json
git pull origin SIT
```

### Option 3: Stash Changes (If You Want to Keep Them)
```bash
cd /opt/tas-production
git stash
git pull origin SIT
git stash pop  # Apply stashed changes back (may have conflicts)
```

### Option 4: Commit Local Changes First
```bash
cd /opt/tas-production
git add frontend/package.json
git commit -m "Local package.json changes"
git pull origin SIT
# Resolve any merge conflicts if they occur
```

## Recommended Approach

Since we just updated package.json to replace xlsx with exceljs, the local changes are likely:
- Old package.json state
- Or some uncommitted modifications

**Best approach**: Check what changed first, then discard if not important:

```bash
cd /opt/tas-production

# See what changed
git diff frontend/package.json

# If changes are not important, discard them
git checkout -- frontend/package.json

# Then pull
git pull origin SIT
```

## After Pulling

Then rebuild the frontend container:
```bash
docker compose -f docker-compose.frontend.yml -p tas-production --env-file .env.production build --no-cache frontend
docker compose -f docker-compose.frontend.yml -p tas-production --env-file .env.production up -d frontend
```

