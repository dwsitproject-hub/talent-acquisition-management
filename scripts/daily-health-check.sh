#!/bin/bash
# Daily health check script for TAS production system
# Run this every 6-12 hours to ensure system stability
# Recommended: Add to crontab to run automatically

set -e

LOG_FILE="/var/log/tas-daily-health.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
ALERT_FILE="/var/log/tas-alerts.log"

log() {
    echo "[$TIMESTAMP] $1" | tee -a "$LOG_FILE"
}

alert() {
    echo "[$TIMESTAMP] 🚨 ALERT: $1" | tee -a "$LOG_FILE" | tee -a "$ALERT_FILE"
}

cd /opt/tas-production 2>/dev/null || cd /root/tas-production 2>/dev/null || {
    alert "Cannot find tas-production directory"
    exit 1
}

log "Starting daily health check..."

# 1. Check container status
log "1. Checking container status..."
CONTAINERS=$(docker ps --filter "name=tas_" --format "{{.Names}}" | wc -l)
if [ "$CONTAINERS" -lt 3 ]; then
    alert "Only $CONTAINERS containers running (expected 3+)"
else
    log "✅ All containers running ($CONTAINERS containers)"
fi

# Check each container
for container in tas_nginx tas_frontend tas_candidate_portal; do
    if docker ps --format "{{.Names}}" | grep -q "^${container}$"; then
        STATUS=$(docker ps --filter "name=${container}" --format "{{.Status}}")
        if echo "$STATUS" | grep -q "unhealthy"; then
            alert "$container is UNHEALTHY: $STATUS"
        else
            log "✅ $container: $STATUS"
        fi
    else
        alert "$container is NOT RUNNING"
    fi
done

# 2. Check for suspicious processes (security)
log "2. Checking for suspicious processes..."
SUSPICIOUS=$(docker exec tas_frontend ps aux 2>/dev/null | grep -E "(lrt|pkill|javae|XX|zozmbw|sleep 86400)" | grep -v grep || true)
if [ -n "$SUSPICIOUS" ]; then
    alert "Suspicious processes detected in tas_frontend!"
    echo "$SUSPICIOUS" | tee -a "$LOG_FILE"
else
    PROCESS_COUNT=$(docker exec tas_frontend ps aux 2>/dev/null | wc -l)
    if [ "$PROCESS_COUNT" -gt 20 ]; then
        alert "High process count in tas_frontend: $PROCESS_COUNT (expected < 10)"
    else
        log "✅ tas_frontend: Clean ($PROCESS_COUNT processes)"
    fi
fi

# 3. Check network connectivity
log "3. Checking network connectivity..."
if docker exec tas_nginx ping -c 1 -W 2 frontend >/dev/null 2>&1; then
    log "✅ Nginx can reach frontend"
else
    alert "Nginx CANNOT reach frontend"
fi

# 4. Check HTTP endpoint
log "4. Checking HTTP endpoint..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:8080 || echo "000")
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "301" ] || [ "$HTTP_CODE" = "302" ]; then
    log "✅ HTTP endpoint responding: $HTTP_CODE"
else
    alert "HTTP endpoint returned: $HTTP_CODE (expected 200/301/302)"
fi

# 5. Check container resource usage
log "5. Checking resource usage..."
MEMORY_USAGE=$(docker stats tas_frontend --no-stream --format "{{.MemPerc}}" 2>/dev/null | sed 's/%//' || echo "0")
if (( $(echo "$MEMORY_USAGE > 90" | bc -l 2>/dev/null || echo 0) )); then
    alert "High memory usage in tas_frontend: ${MEMORY_USAGE}%"
else
    log "✅ Memory usage: ${MEMORY_USAGE}%"
fi

# 6. Check for errors in logs
log "6. Checking recent errors..."
RECENT_ERRORS=$(docker logs tas_frontend --since 1h 2>&1 | grep -iE "(error|fatal|crash|killed|oom)" | tail -5 || true)
if [ -n "$RECENT_ERRORS" ]; then
    alert "Recent errors in frontend logs:"
    echo "$RECENT_ERRORS" | tee -a "$LOG_FILE"
else
    log "✅ No recent errors in frontend logs"
fi

# 7. Check disk space
log "7. Checking disk space..."
DISK_USAGE=$(df -h / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 85 ]; then
    alert "High disk usage: ${DISK_USAGE}%"
else
    log "✅ Disk usage: ${DISK_USAGE}%"
fi

# 8. Check container restart count
log "8. Checking container restart count..."
RESTART_COUNT=$(docker inspect tas_frontend --format='{{.RestartCount}}' 2>/dev/null || echo "0")
if [ "$RESTART_COUNT" -gt 0 ]; then
    alert "Container restart count: $RESTART_COUNT (expected 0)"
else
    log "✅ Container restart count: 0"
fi

# 9. Check for OOM kills
log "9. Checking for OOM kills..."
if [ -f /var/log/syslog ]; then
    OOM_KILLS=$(grep -i "oom\|killed process" /var/log/syslog | grep -i "tas_frontend\|XXcgpCfE" | tail -3 || true)
    if [ -n "$OOM_KILLS" ]; then
        alert "OOM kills detected:"
        echo "$OOM_KILLS" | tee -a "$LOG_FILE"
    else
        log "✅ No recent OOM kills"
    fi
fi

log "Health check completed"

# Summary
if [ -f "$ALERT_FILE" ] && [ -s "$ALERT_FILE" ]; then
    ALERT_COUNT=$(grep -c "ALERT" "$ALERT_FILE" 2>/dev/null || echo "0")
    if [ "$ALERT_COUNT" -gt 0 ]; then
        log "⚠️  Summary: $ALERT_COUNT alert(s) found. Review $ALERT_FILE for details."
        exit 1
    fi
fi

log "✅ All health checks passed"
exit 0

