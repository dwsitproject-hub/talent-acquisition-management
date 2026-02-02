#!/bin/bash
# Security monitoring script to detect compromised containers
# Run this as a cron job to detect malware/compromise early
# Recommended: Run every 15-30 minutes

set -e

LOG_FILE="/var/log/tas-security-monitor.log"
MAX_LOG_SIZE=10485760  # 10MB

# Rotate log if too large
if [ -f "$LOG_FILE" ] && [ $(stat -f%z "$LOG_FILE" 2>/dev/null || stat -c%s "$LOG_FILE" 2>/dev/null || echo 0) -gt $MAX_LOG_SIZE ]; then
    mv "$LOG_FILE" "${LOG_FILE}.old"
fi

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

ALERT_SENT=false

# Check frontend container
if docker ps --format '{{.Names}}' | grep -q "^tas_frontend$"; then
    log "Checking tas_frontend container security..."
    
    # Check for suspicious processes
    SUSPICIOUS=$(docker exec tas_frontend ps aux 2>/dev/null | grep -E "(lrt|pkill|javae|XX|zozmbw|sleep 86400)" | grep -v grep || true)
    
    if [ -n "$SUSPICIOUS" ]; then
        log "🚨 ALERT: Suspicious processes detected in tas_frontend!"
        log "Processes: $SUSPICIOUS"
        log "Container may be compromised. Taking action..."
        
        # Stop the compromised container
        cd /opt/tas-production 2>/dev/null || cd /root/tas-production 2>/dev/null || {
            log "ERROR: Cannot find tas-production directory"
            exit 1
        }
        
        log "Stopping compromised container..."
        docker compose -f docker-compose.frontend.yml -p tas-production stop frontend 2>/dev/null || true
        
        log "⚠️  Manual intervention required: Rebuild container from clean source"
        log "Run: cd /opt/tas-production && docker compose -f docker-compose.frontend.yml -p tas-production --env-file .env.production build --no-cache frontend && docker compose -f docker-compose.frontend.yml -p tas-production --env-file .env.production up -d frontend"
        
        ALERT_SENT=true
    else
        # Check process count (should be low - just node processes)
        PROCESS_COUNT=$(docker exec tas_frontend ps aux 2>/dev/null | wc -l)
        if [ "$PROCESS_COUNT" -gt 20 ]; then
            log "⚠️  WARNING: High process count ($PROCESS_COUNT) in tas_frontend. May indicate compromise."
        else
            log "✅ tas_frontend: Clean (${PROCESS_COUNT} processes)"
        fi
    fi
    
    # Check for suspicious errors in logs
    RECENT_ERRORS=$(docker logs tas_frontend --tail 100 2>&1 | grep -iE "(returnNaN|lrt|EACCES.*lrt|EHOSTUNREACH.*217.60)" | tail -5 || true)
    if [ -n "$RECENT_ERRORS" ]; then
        log "⚠️  WARNING: Suspicious errors in frontend logs:"
        echo "$RECENT_ERRORS" | while read line; do log "  $line"; done
    fi
else
    log "⚠️  WARNING: tas_frontend container is not running"
fi

# Check candidate-portal container
if docker ps --format '{{.Names}}' | grep -q "^tas_candidate_portal$"; then
    SUSPICIOUS=$(docker exec tas_candidate_portal ps aux 2>/dev/null | grep -E "(lrt|pkill|javae|XX|zozmbw|sleep 86400)" | grep -v grep || true)
    if [ -n "$SUSPICIOUS" ]; then
        log "🚨 ALERT: Suspicious processes detected in tas_candidate_portal!"
        ALERT_SENT=true
    else
        PROCESS_COUNT=$(docker exec tas_candidate_portal ps aux 2>/dev/null | wc -l)
        if [ "$PROCESS_COUNT" -gt 20 ]; then
            log "⚠️  WARNING: High process count ($PROCESS_COUNT) in tas_candidate_portal"
        else
            log "✅ tas_candidate_portal: Clean (${PROCESS_COUNT} processes)"
        fi
    fi
fi

# Check nginx container
if docker ps --format '{{.Names}}' | grep -q "^tas_nginx$"; then
    SUSPICIOUS=$(docker exec tas_nginx ps aux 2>/dev/null | grep -E "(lrt|pkill|javae|XX|zozmbw)" | grep -v grep || true)
    if [ -n "$SUSPICIOUS" ]; then
        log "🚨 ALERT: Suspicious processes detected in tas_nginx!"
        ALERT_SENT=true
    else
        log "✅ tas_nginx: Clean"
    fi
fi

if [ "$ALERT_SENT" = true ]; then
    log "🚨 SECURITY ALERT: One or more containers may be compromised!"
    log "Review logs and take immediate action if confirmed."
    exit 1
else
    log "Security check completed - all containers appear clean"
    exit 0
fi

