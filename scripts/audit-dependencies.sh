#!/bin/bash
# Dependency security audit script
# Audits npm packages in frontend and candidate-portal containers
# Run this weekly to check for vulnerabilities

set -e

LOG_FILE="/var/log/tas-npm-audit.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

log() {
    echo "[$TIMESTAMP] $1" | tee -a "$LOG_FILE"
}

echo "=========================================="
echo "npm Dependency Security Audit"
echo "=========================================="
echo ""

cd /opt/tas-production 2>/dev/null || cd /root/tas-production 2>/dev/null || {
    echo "ERROR: Cannot find tas-production directory"
    exit 1
}

log "Starting dependency audit..."

# Check if frontend directory exists
if [ ! -d "frontend" ]; then
    log "ERROR: frontend directory not found"
    exit 1
fi

# Audit Frontend
echo "1. Auditing Frontend Dependencies"
echo "-----------------------------------"
log "Auditing frontend dependencies..."
if docker run --rm -v "$(pwd)/frontend:/app" -w /app node:22-alpine npm audit --audit-level=moderate 2>&1 | tee -a "$LOG_FILE"; then
    FRONTEND_VULNS=$(docker run --rm -v "$(pwd)/frontend:/app" -w /app node:22-alpine npm audit --json 2>/dev/null | grep -o '"vulnerabilities":[0-9]*' | grep -o '[0-9]*' || echo "0")
    if [ "$FRONTEND_VULNS" -gt 0 ]; then
        log "⚠️  Frontend has $FRONTEND_VULNS vulnerabilities"
        echo "⚠️  Frontend has vulnerabilities. Run 'npm audit fix' to fix them."
    else
        log "✅ Frontend: No moderate+ vulnerabilities found"
        echo "✅ Frontend: Clean"
    fi
else
    log "ERROR: Failed to audit frontend"
    echo "❌ Frontend audit failed"
fi

echo ""

# Audit Candidate Portal
if [ -d "candidate-portal" ]; then
    echo "2. Auditing Candidate Portal Dependencies"
    echo "-----------------------------------"
    log "Auditing candidate-portal dependencies..."
    if docker run --rm -v "$(pwd)/candidate-portal:/app" -w /app node:22-alpine npm audit --audit-level=moderate 2>&1 | tee -a "$LOG_FILE"; then
        PORTAL_VULNS=$(docker run --rm -v "$(pwd)/candidate-portal:/app" -w /app node:22-alpine npm audit --json 2>/dev/null | grep -o '"vulnerabilities":[0-9]*' | grep -o '[0-9]*' || echo "0")
        if [ "$PORTAL_VULNS" -gt 0 ]; then
            log "⚠️  Candidate Portal has $PORTAL_VULNS vulnerabilities"
            echo "⚠️  Candidate Portal has vulnerabilities. Run 'npm audit fix' to fix them."
        else
            log "✅ Candidate Portal: No moderate+ vulnerabilities found"
            echo "✅ Candidate Portal: Clean"
        fi
    else
        log "ERROR: Failed to audit candidate-portal"
        echo "❌ Candidate Portal audit failed"
    fi
else
    log "WARNING: candidate-portal directory not found, skipping"
    echo "⚠️  Candidate Portal directory not found"
fi

echo ""
log "Audit completed"
echo "=========================================="
echo "Audit complete! Check $LOG_FILE for details"
echo "=========================================="
echo ""
echo "To fix vulnerabilities:"
echo "  cd /opt/tas-production/frontend"
echo "  docker run --rm -v \$(pwd):/app -w /app node:22-alpine npm audit fix"
echo "  git add package-lock.json && git commit -m 'Fix vulnerabilities' && git push origin SIT"
echo ""

