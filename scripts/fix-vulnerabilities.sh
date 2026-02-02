#!/bin/bash
# Script to fix npm vulnerabilities
# This runs inside Docker containers, so npm doesn't need to be installed on host

set -e

echo "=========================================="
echo "Fixing npm Vulnerabilities"
echo "=========================================="
echo ""

cd /opt/tas-production 2>/dev/null || cd /root/tas-production 2>/dev/null || {
    echo "ERROR: Cannot find tas-production directory"
    exit 1
}

# Check if frontend directory exists
if [ ! -d "frontend" ]; then
    echo "ERROR: frontend directory not found"
    exit 1
fi

echo "Step 1: Fixing safe vulnerabilities (js-yaml)..."
echo "-----------------------------------"
cd frontend
docker run --rm -v "$(pwd):/app" -w /app node:22-alpine npm audit fix

echo ""
echo "Step 2: Fixing critical vulnerabilities (jspdf, next)..."
echo "-----------------------------------"
echo "⚠️  WARNING: This will apply breaking changes. Test thoroughly after!"
docker run --rm -v "$(pwd):/app" -w /app node:22-alpine npm audit fix --force

echo ""
echo "Step 3: Checking remaining vulnerabilities..."
echo "-----------------------------------"
docker run --rm -v "$(pwd):/app" -w /app node:22-alpine npm audit --audit-level=moderate

echo ""
echo "Step 4: Reviewing changes..."
echo "-----------------------------------"
cd ..
echo "Changes to package.json:"
git diff frontend/package.json | head -50 || echo "No changes or not in git"

echo ""
echo "=========================================="
echo "Fix complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Review the changes: git diff frontend/package.json frontend/package-lock.json"
echo "2. Test the build: cd frontend && docker run --rm -v \$(pwd):/app -w /app node:22-alpine npm run build"
echo "3. Commit changes: git add frontend/package*.json && git commit -m 'Fix vulnerabilities' && git push origin SIT"
echo "4. Rebuild container: docker compose -f docker-compose.frontend.yml -p tas-production --env-file .env.production build --no-cache frontend"
echo ""
echo "Note: xlsx has no fix available. Consider replacing with exceljs."
echo ""

