#!/bin/bash
# Manual update script for vulnerable packages that npm audit fix can't handle
# This updates jspdf to v4 and next to latest 16.x

set -e

echo "=========================================="
echo "Manually Updating Vulnerable Packages"
echo "=========================================="
echo ""

cd /opt/tas-production 2>/dev/null || cd /root/tas-production 2>/dev/null || {
    echo "ERROR: Cannot find tas-production directory"
    exit 1
}

if [ ! -d "frontend" ]; then
    echo "ERROR: frontend directory not found"
    exit 1
fi

cd frontend

echo "Step 1: Updating jspdf to v4.0.0 (breaking change)..."
echo "-----------------------------------"
docker run --rm -v "$(pwd):/app" -w /app node:22-alpine npm install jspdf@^4.0.0

echo ""
echo "Step 2: Updating next to latest 16.x (16.1.6)..."
echo "-----------------------------------"
docker run --rm -v "$(pwd):/app" -w /app node:22-alpine npm install next@^16.1.6

echo ""
echo "Step 3: Verifying updates..."
echo "-----------------------------------"
docker run --rm -v "$(pwd):/app" -w /app node:22-alpine npm list jspdf next

echo ""
echo "Step 4: Running audit again..."
echo "-----------------------------------"
docker run --rm -v "$(pwd):/app" -w /app node:22-alpine npm audit --audit-level=moderate

echo ""
echo "=========================================="
echo "Update complete!"
echo "=========================================="
echo ""
echo "⚠️  IMPORTANT: Test thoroughly after these updates!"
echo ""
echo "Next steps:"
echo "1. Test build: docker run --rm -v \$(pwd):/app -w /app node:22-alpine npm run build"
echo "2. Review changes: git diff package.json package-lock.json"
echo "3. Test PDF generation (jspdf v4 may have breaking changes)"
echo "4. Test all Next.js pages and features"
echo "5. Commit: git add package*.json && git commit -m 'Update jspdf to v4 and next to 16.1.6'"
echo ""

