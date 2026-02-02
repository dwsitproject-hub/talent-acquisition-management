# Fix Package Lock Sync Issue

## Problem

When `package.json` is updated but `package-lock.json` is not, Docker build fails with:
```
npm error `npm ci` can only install packages when your package.json and package-lock.json are in sync.
```

## Solution

### Step 1: Regenerate package-lock.json

On the server, regenerate the lock file:

```bash
cd /opt/tas-production/frontend

# Regenerate package-lock.json to match package.json
docker run --rm -v $(pwd):/app -w /app node:22-alpine npm install

# This will update package-lock.json to match the versions in package.json
```

### Step 2: Verify the lock file is updated

```bash
# Check that versions match
docker run --rm -v $(pwd):/app -w /app node:22-alpine npm list jspdf next | head -5
```

### Step 3: Commit the updated lock file

```bash
cd /opt/tas-production

# Add the updated lock file
git add frontend/package-lock.json

# Commit
git commit -m "Update package-lock.json to sync with package.json"

# Push
git push origin SIT
```

### Step 4: Rebuild

```bash
# Now rebuild should work
docker compose -f docker-compose.frontend.yml -p tas-production --env-file .env.production build --no-cache frontend
```

## Why This Happens

- `package.json` was updated (manually or via npm install)
- `package-lock.json` wasn't regenerated or committed
- Docker build uses `npm ci` which requires exact sync

## Prevention

Always commit both files together:
```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "Update dependencies"
```

