#!/bin/bash
# Emergency response script for compromised container
# Run this immediately when security alerts are detected

set -e

LOG_FILE="/var/log/tas-emergency-response.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

log() {
    echo "[$TIMESTAMP] $1" | tee -a "$LOG_FILE"
}

alert() {
    echo "[$TIMESTAMP] 🚨 $1" | tee -a "$LOG_FILE"
}

cd /opt/tas-production 2>/dev/null || cd /root/tas-production 2>/dev/null || {
    alert "Cannot find tas-production directory"
    exit 1
}

log "=== EMERGENCY RESPONSE STARTED ==="

# 1. Capture evidence before cleanup
log "1. Capturing evidence..."
EVIDENCE_DIR="/tmp/tas-evidence-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$EVIDENCE_DIR"

# Capture process list
docker exec tas_frontend ps aux > "$EVIDENCE_DIR/processes.txt" 2>/dev/null || true
log "Captured process list to $EVIDENCE_DIR/processes.txt"

# Capture network connections
docker exec tas_frontend netstat -tulpn > "$EVIDENCE_DIR/network.txt" 2>/dev/null || true
log "Captured network connections"

# Capture recent logs
docker logs tas_frontend --tail 200 > "$EVIDENCE_DIR/logs.txt" 2>/dev/null || true
log "Captured logs"

# 2. Check for suspicious processes
log "2. Checking for suspicious processes..."
SUSPICIOUS=$(docker exec tas_frontend ps aux 2>/dev/null | grep -E "(lrt|pkill|javae|XX|zozmbw|sleep 86400)" | grep -v grep || true)
if [ -n "$SUSPICIOUS" ]; then
    alert "CONFIRMED: Suspicious processes detected!"
    echo "$SUSPICIOUS" | tee -a "$LOG_FILE" | tee -a "$EVIDENCE_DIR/suspicious-processes.txt"
    
    # 3. Stop compromised container immediately
    log "3. Stopping compromised container..."
    docker compose -f docker-compose.frontend.yml -p tas-production stop frontend
    docker rm tas_frontend 2>/dev/null || true
    log "Container stopped and removed"
    
    # 4. Check other containers
    log "4. Checking other containers..."
    for container in tas_candidate_portal tas_nginx; do
        SUSP=$(docker exec $container ps aux 2>/dev/null | grep -E "(lrt|pkill|javae|XX)" | grep -v grep || true)
        if [ -n "$SUSP" ]; then
            alert "$container also has suspicious processes!"
            docker compose -f docker-compose.frontend.yml -p tas-production stop $container
        fi
    done
    
    # 5. Rebuild from clean source
    log "5. Rebuilding from clean source..."
    git pull origin SIT
    
    # Remove old image
    docker rmi tas-production-frontend 2>/dev/null || true
    
    # Rebuild
    docker compose -f docker-compose.frontend.yml -p tas-production --env-file .env.production build --no-cache frontend
    
    # Start fresh container
    docker compose -f docker-compose.frontend.yml -p tas-production --env-file .env.production up -d frontend
    
    log "Container rebuilt and started"
    
    # 6. Verify clean state
    log "6. Verifying clean state..."
    sleep 10
    PROCESS_COUNT=$(docker exec tas_frontend ps aux 2>/dev/null | wc -l)
    if [ "$PROCESS_COUNT" -gt 20 ]; then
        alert "WARNING: Process count still high ($PROCESS_COUNT). May need manual investigation."
    else
        log "✅ Process count normal: $PROCESS_COUNT"
    fi
    
    # Check for suspicious processes
    SUSP_CHECK=$(docker exec tas_frontend ps aux 2>/dev/null | grep -E "(lrt|pkill|javae|XX)" | grep -v grep || true)
    if [ -n "$SUSP_CHECK" ]; then
        alert "WARNING: Suspicious processes still present after rebuild!"
    else
        log "✅ No suspicious processes detected"
    fi
    
    # 7. Test HTTP endpoint
    log "7. Testing HTTP endpoint..."
    sleep 5
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:8080 || echo "000")
    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "301" ] || [ "$HTTP_CODE" = "302" ]; then
        log "✅ HTTP endpoint responding: $HTTP_CODE"
    else
        alert "HTTP endpoint still not responding: $HTTP_CODE"
    fi
    
    log "=== EMERGENCY RESPONSE COMPLETED ==="
    log "Evidence saved to: $EVIDENCE_DIR"
    alert "Review evidence and investigate root cause"
    
else
    log "No suspicious processes found. Issue may be different."
    log "Checking other causes..."
    
    # Check if it's just a network issue
    if ! docker exec tas_nginx ping -c 1 -W 2 frontend >/dev/null 2>&1; then
        log "Network connectivity issue detected. Running quick fix..."
        ./scripts/quick-fix-504-timeout.sh
    fi
fi

