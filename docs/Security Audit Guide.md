# Security Audit Guide

## Running npm audit in Docker Containers

Since npm is not installed on the host server (you're using Docker), you need to run security audits inside the containers.

## Method 1: Run npm audit inside the container (Recommended)

### For Frontend Container

```bash
# Option A: Run audit in running container
docker exec -it tas_frontend sh -c "cd /app && npm audit"

# Option B: If container doesn't have npm (standalone build), use a temporary container
cd /opt/tas-production
docker run --rm -v $(pwd)/frontend:/app -w /app node:22-alpine npm audit
```

### For Candidate Portal Container

```bash
# Option A: Run audit in running container
docker exec -it tas_candidate_portal sh -c "cd /app && npm audit"

# Option B: Use temporary container
cd /opt/tas-production
docker run --rm -v $(pwd)/candidate-portal:/app -w /app node:22-alpine npm audit
```

## Method 2: Install npm on host (Not Recommended)

If you really want npm on the host:

```bash
# For Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# For CentOS/RHEL
curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
sudo yum install -y nodejs

# Verify
node --version
npm --version
```

**Note**: This is not recommended because:
- You're using Docker, so Node.js should only be in containers
- Adds unnecessary dependencies to host
- Can cause version conflicts

## Method 3: Run audit locally (Development Machine)

Run on your local development machine where npm is installed:

```bash
cd frontend
npm audit
npm audit fix  # Fix vulnerabilities if any

cd ../candidate-portal
npm audit
npm audit fix
```

Then commit the updated `package-lock.json` files and deploy.

## Recommended Approach: Create Audit Script

Create a script to audit all containers:

```bash
#!/bin/bash
# scripts/audit-dependencies.sh

echo "=== Auditing Frontend Dependencies ==="
cd /opt/tas-production
docker run --rm -v $(pwd)/frontend:/app -w /app node:22-alpine npm audit

echo ""
echo "=== Auditing Candidate Portal Dependencies ==="
docker run --rm -v $(pwd)/candidate-portal:/app -w /app node:22-alpine npm audit
```

Make it executable:
```bash
chmod +x scripts/audit-dependencies.sh
```

Run it:
```bash
./scripts/audit-dependencies.sh
```

## Understanding npm audit Output

- **Low**: Minor issues, usually safe to ignore
- **Moderate**: Should be addressed
- **High**: Should be fixed soon
- **Critical**: Fix immediately

## Fixing Vulnerabilities

### Inside Container (if npm is available)

```bash
docker exec -it tas_frontend sh -c "cd /app && npm audit fix"
```

### Using Temporary Container (Recommended)

```bash
cd /opt/tas-production/frontend

# Audit and fix
docker run --rm -v $(pwd):/app -w /app node:22-alpine sh -c "npm audit && npm audit fix"

# This will update package-lock.json
# Commit and push the changes
git add package-lock.json
git commit -m "Fix npm audit vulnerabilities"
git push origin SIT
```

### Manual Fix (Update packages)

If `npm audit fix` doesn't work, manually update packages:

```bash
cd /opt/tas-production/frontend

# Check outdated packages
docker run --rm -v $(pwd):/app -w /app node:22-alpine npm outdated

# Update specific package
docker run --rm -v $(pwd):/app -w /app node:22-alpine npm update <package-name>
```

## Automated Weekly Audit

Add to crontab to run weekly:

```bash
crontab -e

# Add this line (runs every Sunday at 2 AM)
0 2 * * 0 /opt/tas-production/scripts/audit-dependencies.sh >> /var/log/tas-npm-audit.log 2>&1
```

## Important Notes

1. **Standalone builds**: If using Next.js standalone build, the production container may not have npm. Use temporary containers instead.

2. **package-lock.json**: Always commit `package-lock.json` after running `npm audit fix` to lock in secure versions.

3. **Test after fixes**: After fixing vulnerabilities, rebuild and test:
   ```bash
   docker compose -f docker-compose.frontend.yml -p tas-production --env-file .env.production build --no-cache frontend
   docker compose -f docker-compose.frontend.yml -p tas-production --env-file .env.production up -d frontend
   ```

4. **Breaking changes**: Some vulnerability fixes may require code changes. Test thoroughly.

## Quick Reference

```bash
# Quick audit (frontend)
cd /opt/tas-production
docker run --rm -v $(pwd)/frontend:/app -w /app node:22-alpine npm audit

# Quick audit (candidate-portal)
docker run --rm -v $(pwd)/candidate-portal:/app -w /app node:22-alpine npm audit

# Audit and fix (frontend)
cd /opt/tas-production/frontend
docker run --rm -v $(pwd):/app -w /app node:22-alpine sh -c "npm audit && npm audit fix"
git add package-lock.json && git commit -m "Fix vulnerabilities" && git push origin SIT
```

