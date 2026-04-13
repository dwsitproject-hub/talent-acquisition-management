#!/bin/bash
# Verification script for exceljs migration
# Run this immediately after deployment to verify everything works

set -e

LOG_FILE="/var/log/tas-exceljs-verification.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

log() {
    echo "[$TIMESTAMP] $1" | tee -a "$LOG_FILE"
}

cd /opt/tas-production 2>/dev/null || cd /root/tas-production 2>/dev/null || {
    echo "ERROR: Cannot find tas-production directory"
    exit 1
}

log "=== EXCELJS MIGRATION VERIFICATION ==="

# 1. Check package.json
log ""
log "1. Checking package.json..."
if grep -q "exceljs" frontend/package.json && ! grep -q '"xlsx"' frontend/package.json; then
    log "✅ package.json: exceljs present, xlsx removed"
else
    log "❌ package.json: Issue detected"
    exit 1
fi

# 2. Check container is running
log ""
log "2. Checking container status..."
if docker ps --format '{{.Names}}' | grep -q "^tas_frontend$"; then
    CONTAINER_STATUS=$(docker ps --format '{{.Status}}' --filter "name=tas_frontend")
    log "✅ Container running: $CONTAINER_STATUS"
else
    log "❌ Container not running"
    exit 1
fi

# 3. Check container health
log ""
log "3. Checking container health..."
HEALTH=$(docker inspect tas_frontend --format='{{.State.Health.Status}}' 2>/dev/null || echo "no-healthcheck")
if [ "$HEALTH" = "healthy" ]; then
    log "✅ Container health: healthy"
elif [ "$HEALTH" = "no-healthcheck" ]; then
    log "⚠️  Container health: no healthcheck configured"
else
    log "⚠️  Container health: $HEALTH"
fi

# 4. Check process count
log ""
log "4. Checking process count..."
PROCESS_COUNT=$(docker exec tas_frontend ps aux 2>/dev/null | wc -l)
if [ "$PROCESS_COUNT" -lt 20 ]; then
    log "✅ Process count: $PROCESS_COUNT (normal)"
else
    log "⚠️  Process count: $PROCESS_COUNT (high, expected < 20)"
fi

# 5. Check for suspicious processes
log ""
log "5. Checking for suspicious processes..."
SUSPICIOUS=$(docker exec tas_frontend ps aux 2>/dev/null | grep -E "(lrt|pkill|javae|XX|zozmbw)" | grep -v grep || true)
if [ -z "$SUSPICIOUS" ]; then
    log "✅ No suspicious processes found"
else
    log "❌ Suspicious processes detected:"
    echo "$SUSPICIOUS" | tee -a "$LOG_FILE"
    exit 1
fi

# 6. Check HTTP endpoint
log ""
log "6. Checking HTTP endpoint..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:8080 || echo "000")
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "301" ] || [ "$HTTP_CODE" = "302" ]; then
    log "✅ HTTP endpoint: $HTTP_CODE"
else
    log "❌ HTTP endpoint: $HTTP_CODE (expected 200/301/302)"
fi

# 7. Check container logs for errors
log ""
log "7. Checking recent container logs..."
ERRORS=$(docker logs tas_frontend --tail 50 2>&1 | grep -iE "(error|fatal|crash|exceljs|xlsx)" || true)
if [ -z "$ERRORS" ]; then
    log "✅ No errors in recent logs"
else
    log "⚠️  Potential issues in logs:"
    echo "$ERRORS" | head -5 | tee -a "$LOG_FILE"
fi

# 8. Check if exceljs is installed in container
log ""
log "8. Checking if exceljs is installed..."
if docker exec tas_frontend sh -c "test -f /app/node_modules/exceljs/package.json" 2>/dev/null; then
    EXCELJS_VERSION=$(docker exec tas_frontend sh -c "cat /app/node_modules/exceljs/package.json 2>/dev/null | grep '\"version\"' | head -1" || echo "unknown")
    log "✅ exceljs installed: $EXCELJS_VERSION"
else
    log "❌ exceljs not found in container"
    log "   Note: This is normal if container was built before migration"
    log "   Rebuild container: docker compose -f docker-compose.frontend.yml -p tas-production --env-file .env.production build --no-cache frontend"
fi

# 9. Check if xlsx is removed from container
log ""
log "9. Checking if xlsx is removed..."
if docker exec tas_frontend sh -c "test -d /app/node_modules/xlsx" 2>/dev/null; then
    log "⚠️  xlsx still present in container"
    log "   Rebuild container to remove it"
else
    log "✅ xlsx removed from container"
fi

# 10. Memory usage
log ""
log "10. Checking memory usage..."
MEMORY=$(docker stats tas_frontend --no-stream --format "{{.MemUsage}}" 2>/dev/null || echo "unknown")
log "Memory usage: $MEMORY"

log ""
log "=== VERIFICATION COMPLETE ==="
log ""
log "Summary:"
log "- Package.json: ✅ Updated"
log "- Container: $(docker ps --format '{{.Status}}' --filter 'name=tas_frontend' 2>/dev/null || echo 'unknown')"
log "- Process count: $PROCESS_COUNT"
log "- HTTP status: $HTTP_CODE"
log ""
log "Next steps:"
log "1. Monitor for next 24-48 hours using: ./scripts/monitor-exceljs-health.sh"
log "2. Run daily health check: ./scripts/daily-health-check.sh"
log "3. Watch for process count increases"
log "4. Test Excel upload/download functionality in UI"

