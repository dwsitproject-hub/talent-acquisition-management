#!/bin/bash
# Comprehensive diagnostic script for recurring 504 Gateway Timeout issues
# This script captures detailed information about what's happening with the frontend
# Run this when the 504 issue occurs to understand the root cause

set -e

LOG_FILE="/var/log/tas-504-diagnostic.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

log() {
    echo "[$TIMESTAMP] $1" | tee -a "$LOG_FILE"
}

echo "=========================================="
echo "504 Gateway Timeout Diagnostic Tool"
echo "=========================================="
echo ""

log "Starting diagnostic check..."

# 1. Check container status and uptime
echo "1. Container Status and Uptime"
echo "-----------------------------------"
log "Checking container status..."
docker ps --filter "name=tas_" --format "table {{.Names}}\t{{.Status}}\t{{.RunningFor}}" | tee -a "$LOG_FILE"
echo ""

# 2. Check container restart count
echo "2. Container Restart History"
echo "-----------------------------------"
log "Checking restart counts..."
docker ps -a --filter "name=tas_" --format "table {{.Names}}\t{{.Status}}\t{{.RestartCount}}" | tee -a "$LOG_FILE"
echo ""

# 3. Check frontend container logs (last 100 lines)
echo "3. Frontend Container Logs (Last 100 lines)"
echo "-----------------------------------"
log "Capturing frontend logs..."
docker logs tas_frontend --tail 100 2>&1 | tee -a "$LOG_FILE"
echo ""

# 4. Check for errors in frontend logs
echo "4. Errors in Frontend Logs"
echo "-----------------------------------"
log "Searching for errors in frontend logs..."
docker logs tas_frontend 2>&1 | grep -i -E "(error|fatal|crash|killed|oom|memory|timeout|econnrefused|ehostunreach)" | tail -20 | tee -a "$LOG_FILE"
echo ""

# 5. Check frontend container resource usage
echo "5. Frontend Container Resource Usage"
echo "-----------------------------------"
log "Checking resource usage..."
docker stats tas_frontend --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}" | tee -a "$LOG_FILE"
echo ""

# 6. Check if frontend is listening on port 3000
echo "6. Frontend Port 3000 Status"
echo "-----------------------------------"
log "Checking if frontend is listening on port 3000..."
docker exec tas_frontend netstat -tlnp 2>/dev/null | grep 3000 || echo "Port 3000 not found in netstat" | tee -a "$LOG_FILE"
docker exec tas_frontend sh -c 'lsof -i :3000 2>/dev/null || echo "lsof not available or port not listening"' | tee -a "$LOG_FILE"
echo ""

# 7. Test connectivity from nginx to frontend
echo "7. Network Connectivity Test"
echo "-----------------------------------"
log "Testing nginx -> frontend connectivity..."
if docker exec tas_nginx ping -c 2 -W 2 frontend >/dev/null 2>&1; then
    echo "✅ Nginx can ping frontend" | tee -a "$LOG_FILE"
else
    echo "❌ Nginx CANNOT ping frontend" | tee -a "$LOG_FILE"
fi

if docker exec tas_nginx wget -S -O- --timeout=5 http://frontend:3000/ 2>&1 | head -5 | grep -q "200 OK"; then
    echo "✅ Nginx can reach frontend:3000 (HTTP 200)" | tee -a "$LOG_FILE"
else
    echo "❌ Nginx CANNOT reach frontend:3000" | tee -a "$LOG_FILE"
    docker exec tas_nginx wget -S -O- --timeout=5 http://frontend:3000/ 2>&1 | head -10 | tee -a "$LOG_FILE"
fi
echo ""

# 8. Check Docker network status
echo "8. Docker Network Status"
echo "-----------------------------------"
log "Checking Docker network..."
docker network inspect tas-production_tas_network 2>/dev/null | grep -E "(Name|IPv4Address|Container)" | head -20 | tee -a "$LOG_FILE" || echo "Network not found or error" | tee -a "$LOG_FILE"
echo ""

# 9. Check nginx logs for recent errors
echo "9. Nginx Error Logs (Last 50 lines)"
echo "-----------------------------------"
log "Checking nginx error logs..."
docker logs tas_nginx --tail 50 2>&1 | grep -i -E "(error|timeout|upstream|connect)" | tail -20 | tee -a "$LOG_FILE"
echo ""

# 10. Check system memory and disk
echo "10. System Resources"
echo "-----------------------------------"
log "Checking system resources..."
echo "Memory:" | tee -a "$LOG_FILE"
free -h | tee -a "$LOG_FILE"
echo "Disk:" | tee -a "$LOG_FILE"
df -h / | tee -a "$LOG_FILE"
echo ""

# 11. Check for OOM (Out of Memory) kills
echo "11. System Logs - OOM Kills"
echo "-----------------------------------"
log "Checking for OOM kills..."
if [ -f /var/log/syslog ]; then
    grep -i "oom\|killed process" /var/log/syslog | tail -10 | tee -a "$LOG_FILE" || echo "No OOM kills found in syslog" | tee -a "$LOG_FILE"
elif [ -f /var/log/messages ]; then
    grep -i "oom\|killed process" /var/log/messages | tail -10 | tee -a "$LOG_FILE" || echo "No OOM kills found in messages" | tee -a "$LOG_FILE"
else
    echo "System logs not accessible" | tee -a "$LOG_FILE"
fi
echo ""

# 12. Check container restart policy and events
echo "12. Recent Docker Events"
echo "-----------------------------------"
log "Checking recent Docker events..."
docker events --since 24h --until now --filter "container=tas_frontend" --format "{{.Time}} {{.Status}}" 2>/dev/null | tail -20 | tee -a "$LOG_FILE" || echo "No recent events or docker events not accessible" | tee -a "$LOG_FILE"
echo ""

# 13. Check for scheduled tasks (cron jobs)
echo "13. Scheduled Tasks (Cron Jobs)"
echo "-----------------------------------"
log "Checking for cron jobs..."
crontab -l 2>/dev/null | tee -a "$LOG_FILE" || echo "No crontab or not accessible" | tee -a "$LOG_FILE"
echo ""

# 14. Check frontend process status inside container
echo "14. Frontend Process Status"
echo "-----------------------------------"
log "Checking processes inside frontend container..."
docker exec tas_frontend ps aux 2>/dev/null | tee -a "$LOG_FILE" || echo "Cannot check processes" | tee -a "$LOG_FILE"
echo ""

# 15. Check environment variables
echo "15. Frontend Environment Variables"
echo "-----------------------------------"
log "Checking frontend environment variables..."
docker exec tas_frontend env 2>/dev/null | grep -E "(NODE|PORT|HOSTNAME|API)" | tee -a "$LOG_FILE" || echo "Cannot check environment" | tee -a "$LOG_FILE"
echo ""

log "Diagnostic check completed"
echo ""
echo "=========================================="
echo "Diagnostic complete!"
echo "Full log saved to: $LOG_FILE"
echo "=========================================="
echo ""
echo "Key things to check:"
echo "  - Container restart count (should be 0 if stable)"
echo "  - Memory usage (should not be at 100%)"
echo "  - OOM kills in system logs"
echo "  - Errors in frontend logs"
echo "  - Network connectivity from nginx"
echo ""

