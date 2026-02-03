#!/bin/bash
# Continuous monitoring script for exceljs migration
# Run this to monitor system health every 5 minutes for 24 hours

set -e

LOG_FILE="/var/log/tas-exceljs-monitoring.log"
ALERT_FILE="/var/log/tas-exceljs-alerts.log"
INTERVAL=300  # 5 minutes
DURATION=86400  # 24 hours in seconds
START_TIME=$(date +%s)

log() {
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$TIMESTAMP] $1" | tee -a "$LOG_FILE"
}

alert() {
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$TIMESTAMP] 🚨 ALERT: $1" | tee -a "$LOG_FILE" | tee -a "$ALERT_FILE"
}

cd /opt/tas-production 2>/dev/null || cd /root/tas-production 2>/dev/null || {
    echo "ERROR: Cannot find tas-production directory"
    exit 1
}

log "=== EXCELJS HEALTH MONITORING STARTED ==="
log "Monitoring interval: ${INTERVAL}s (5 minutes)"
log "Duration: 24 hours"
log "Log file: $LOG_FILE"
log "Alert file: $ALERT_FILE"

while true; do
    CURRENT_TIME=$(date +%s)
    ELAPSED=$((CURRENT_TIME - START_TIME))
    
    if [ $ELAPSED -ge $DURATION ]; then
        log "Monitoring period complete (24 hours)"
        break
    fi
    
    log ""
    log "--- Health Check ($(date '+%Y-%m-%d %H:%M:%S')) ---"
    
    # Check container is running
    if ! docker ps --format '{{.Names}}' | grep -q "^tas_frontend$"; then
        alert "Container tas_frontend is not running!"
        sleep $INTERVAL
        continue
    fi
    
    # Check process count
    PROCESS_COUNT=$(docker exec tas_frontend ps aux 2>/dev/null | wc -l)
    if [ "$PROCESS_COUNT" -gt 20 ]; then
        alert "High process count: $PROCESS_COUNT (expected < 20)"
    else
        log "Process count: $PROCESS_COUNT (normal)"
    fi
    
    # Check for suspicious processes
    SUSPICIOUS=$(docker exec tas_frontend ps aux 2>/dev/null | grep -E "(lrt|pkill|javae|XX|zozmbw)" | grep -v grep || true)
    if [ -n "$SUSPICIOUS" ]; then
        alert "Suspicious processes detected:"
        echo "$SUSPICIOUS" | tee -a "$ALERT_FILE"
    fi
    
    # Check HTTP endpoint
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:8080 || echo "000")
    if [ "$HTTP_CODE" != "200" ] && [ "$HTTP_CODE" != "301" ] && [ "$HTTP_CODE" != "302" ]; then
        alert "HTTP endpoint returned: $HTTP_CODE (expected 200/301/302)"
    else
        log "HTTP endpoint: $HTTP_CODE (OK)"
    fi
    
    # Check memory usage
    MEMORY_PERC=$(docker stats tas_frontend --no-stream --format "{{.MemPerc}}" 2>/dev/null | sed 's/%//' || echo "0")
    if (( $(echo "$MEMORY_PERC > 80" | bc -l 2>/dev/null || echo 0) )); then
        alert "High memory usage: ${MEMORY_PERC}%"
    else
        log "Memory usage: ${MEMORY_PERC}% (normal)"
    fi
    
    # Check container health
    HEALTH=$(docker inspect tas_frontend --format='{{.State.Health.Status}}' 2>/dev/null || echo "no-healthcheck")
    if [ "$HEALTH" = "unhealthy" ]; then
        alert "Container health: unhealthy"
    fi
    
    # Check for errors in logs (last 10 lines)
    RECENT_ERRORS=$(docker logs tas_frontend --tail 10 2>&1 | grep -iE "(error|fatal|crash)" | wc -l)
    if [ "$RECENT_ERRORS" -gt 3 ]; then
        alert "Multiple errors in recent logs: $RECENT_ERRORS"
    fi
    
    # Calculate time remaining
    REMAINING=$((DURATION - ELAPSED))
    HOURS=$((REMAINING / 3600))
    MINUTES=$(((REMAINING % 3600) / 60))
    log "Time remaining: ${HOURS}h ${MINUTES}m"
    
    sleep $INTERVAL
done

log ""
log "=== MONITORING COMPLETE ==="
log "Review alerts in: $ALERT_FILE"

