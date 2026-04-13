#!/bin/bash
# Comprehensive investigation script for container compromise
# This helps identify when, how, and why the container was compromised

set -e

LOG_FILE="/var/log/tas-investigation.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
REPORT_DIR="/tmp/tas-investigation-$(date +%Y%m%d-%H%M%S)"

mkdir -p "$REPORT_DIR"

log() {
    echo "[$TIMESTAMP] $1" | tee -a "$LOG_FILE"
    echo "[$TIMESTAMP] $1" >> "$REPORT_DIR/investigation-report.txt"
}

cd /opt/tas-production 2>/dev/null || cd /root/tas-production 2>/dev/null || {
    echo "ERROR: Cannot find tas-production directory"
    exit 1
}

log "=== COMPROMISE INVESTIGATION STARTED ==="
log "Report directory: $REPORT_DIR"

# 1. Container Timeline
log ""
log "1. CONTAINER TIMELINE"
log "=========================================="
log "Container creation time:"
docker inspect tas_frontend --format='{{.Created}}' 2>/dev/null | tee -a "$REPORT_DIR/timeline.txt" || log "Container not found"
log ""
log "Container start time:"
docker inspect tas_frontend --format='{{.State.StartedAt}}' 2>/dev/null | tee -a "$REPORT_DIR/timeline.txt" || log "Container not found"
log ""
log "Container restart count:"
docker inspect tas_frontend --format='{{.RestartCount}}' 2>/dev/null | tee -a "$REPORT_DIR/timeline.txt" || log "Container not found"
log ""
log "Container restart history:"
docker inspect tas_frontend --format='{{json .State}}' 2>/dev/null | jq -r '.Status, .StartedAt, .FinishedAt' | tee -a "$REPORT_DIR/timeline.txt" || log "Container not found"

# 2. Docker Image Analysis
log ""
log "2. DOCKER IMAGE ANALYSIS"
log "=========================================="
log "Image creation time:"
docker inspect tas-production-frontend --format='{{.Created}}' 2>/dev/null | tee -a "$REPORT_DIR/image-analysis.txt" || log "Image not found"
log ""
log "Image size:"
docker images tas-production-frontend --format "{{.Size}}" 2>/dev/null | tee -a "$REPORT_DIR/image-analysis.txt" || log "Image not found"
log ""
log "Image layers (last 10):"
docker history tas-production-frontend --no-trunc 2>/dev/null | head -10 | tee -a "$REPORT_DIR/image-analysis.txt" || log "Image not found"

# 3. Process Analysis (Current State)
log ""
log "3. CURRENT PROCESS ANALYSIS"
log "=========================================="
if docker ps --format '{{.Names}}' | grep -q "^tas_frontend$"; then
    log "All processes in container:"
    docker exec tas_frontend ps aux > "$REPORT_DIR/current-processes.txt" 2>/dev/null || true
    wc -l "$REPORT_DIR/current-processes.txt" | tee -a "$LOG_FILE"
    
    log ""
    log "Process tree:"
    docker exec tas_frontend ps auxf > "$REPORT_DIR/process-tree.txt" 2>/dev/null || true
    
    log ""
    log "Suspicious processes:"
    docker exec tas_frontend ps aux 2>/dev/null | grep -E "(lrt|pkill|javae|XX|zozmbw|sleep 86400)" | tee -a "$REPORT_DIR/suspicious-processes.txt" || log "None found"
    
    log ""
    log "Process count by user:"
    docker exec tas_frontend ps aux 2>/dev/null | awk '{print $1}' | sort | uniq -c | tee -a "$REPORT_DIR/processes-by-user.txt"
else
    log "Container not running - cannot analyze processes"
fi

# 4. Network Connections
log ""
log "4. NETWORK CONNECTIONS"
log "=========================================="
if docker ps --format '{{.Names}}' | grep -q "^tas_frontend$"; then
    log "Active network connections:"
    docker exec tas_frontend netstat -tulpn > "$REPORT_DIR/network-connections.txt" 2>/dev/null || true
    cat "$REPORT_DIR/network-connections.txt" | tee -a "$LOG_FILE"
    
    log ""
    log "Established connections:"
    docker exec tas_frontend netstat -an 2>/dev/null | grep ESTABLISHED | tee -a "$REPORT_DIR/established-connections.txt" || true
else
    log "Container not running - cannot analyze network"
fi

# 5. System Logs Analysis
log ""
log "5. SYSTEM LOGS ANALYSIS"
log "=========================================="
log "OOM kills related to frontend container:"
if [ -f /var/log/syslog ]; then
    grep -i "oom\|killed process" /var/log/syslog | grep -i "tas_frontend\|XXcgpCfE\|docker" | tail -20 | tee -a "$REPORT_DIR/oom-kills.txt" || log "No OOM kills found"
elif [ -f /var/log/messages ]; then
    grep -i "oom\|killed process" /var/log/messages | grep -i "tas_frontend\|XXcgpCfE\|docker" | tail -20 | tee -a "$REPORT_DIR/oom-kills.txt" || log "No OOM kills found"
else
    log "System logs not accessible"
fi

log ""
log "Docker events (last 24 hours):"
docker events --since 24h --filter "container=tas_frontend" --format "{{.Time}} {{.Status}}" 2>/dev/null | tee -a "$REPORT_DIR/docker-events.txt" || log "No events found"

# 6. Container Logs Analysis
log ""
log "6. CONTAINER LOGS ANALYSIS"
log "=========================================="
log "Recent frontend logs (last 200 lines):"
docker logs tas_frontend --tail 200 > "$REPORT_DIR/frontend-logs.txt" 2>/dev/null || log "Cannot get logs"
log ""
log "Errors in frontend logs:"
docker logs tas_frontend 2>&1 | grep -iE "(error|fatal|crash|killed|oom|malware|suspicious)" | tail -50 | tee -a "$REPORT_DIR/frontend-errors.txt" || log "No errors found"

# 7. File System Analysis
log ""
log "7. FILE SYSTEM ANALYSIS"
log "=========================================="
if docker ps --format '{{.Names}}' | grep -q "^tas_frontend$"; then
    log "Files in /tmp:"
    docker exec tas_frontend ls -la /tmp 2>/dev/null | tee -a "$REPORT_DIR/tmp-files.txt" || true
    
    log ""
    log "Files in /dev:"
    docker exec tas_frontend ls -la /dev 2>/dev/null | grep -E "(lrt|suspicious)" | tee -a "$REPORT_DIR/dev-files.txt" || log "No suspicious files in /dev"
    
    log ""
    log "Executable files in unusual locations:"
    docker exec tas_frontend find / -type f -executable -name "*lrt*" -o -name "*XX*" 2>/dev/null | tee -a "$REPORT_DIR/suspicious-executables.txt" || log "None found"
else
    log "Container not running - cannot analyze filesystem"
fi

# 8. Dependency Analysis
log ""
log "8. DEPENDENCY ANALYSIS"
log "=========================================="
log "Checking npm packages for known vulnerabilities:"
cd frontend
docker run --rm -v "$(pwd):/app" -w /app node:22-alpine npm audit --json > "$REPORT_DIR/npm-audit.json" 2>/dev/null || log "Audit failed"
log ""
log "Package versions:"
docker run --rm -v "$(pwd):/app" -w /app node:22-alpine npm list --depth=0 > "$REPORT_DIR/package-versions.txt" 2>/dev/null || log "Cannot get package list"

# 9. Host System Analysis
log ""
log "9. HOST SYSTEM ANALYSIS"
log "=========================================="
log "Suspicious processes on host:"
ps aux | grep -E "(lrt|pkill|javae|XX|zozmbw)" | grep -v grep | tee -a "$REPORT_DIR/host-suspicious-processes.txt" || log "None found"
log ""
log "Recent SSH logins:"
last -20 | tee -a "$REPORT_DIR/ssh-logins.txt" || log "Cannot get SSH logins"
log ""
log "Recent failed SSH attempts:"
grep "Failed\|Invalid" /var/log/auth.log 2>/dev/null | tail -20 | tee -a "$REPORT_DIR/failed-ssh.txt" || log "Cannot get auth logs"
log ""
log "Cron jobs:"
crontab -l > "$REPORT_DIR/crontab.txt" 2>/dev/null || log "Cannot get crontab"
log ""
log "System cron jobs:"
ls -la /etc/cron.d /etc/cron.hourly /etc/cron.daily 2>/dev/null | tee -a "$REPORT_DIR/system-cron.txt" || log "Cannot get system cron"

# 10. Network Analysis
log ""
log "10. NETWORK ANALYSIS"
log "=========================================="
log "Outbound connections from host:"
netstat -tulpn | grep -v "127.0.0.1\|::1" | tee -a "$REPORT_DIR/host-network.txt" || log "Cannot get network info"
log ""
log "DNS queries (if systemd-resolve available):"
systemd-resolve --status 2>/dev/null | grep -A 5 "DNS Servers" | tee -a "$REPORT_DIR/dns-info.txt" || log "Cannot get DNS info"

# 11. Docker Network Analysis
log ""
log "11. DOCKER NETWORK ANALYSIS"
log "=========================================="
log "Docker networks:"
docker network ls | tee -a "$REPORT_DIR/docker-networks.txt"
log ""
log "Frontend container network details:"
docker network inspect tas-production_tas_network 2>/dev/null | jq -r '.[0].Containers' | tee -a "$REPORT_DIR/docker-network-details.txt" || log "Cannot get network details"

# 12. Image Comparison
log ""
log "12. IMAGE COMPARISON"
log "=========================================="
log "Checking if image matches source code:"
log "Git commit hash:"
git rev-parse HEAD | tee -a "$REPORT_DIR/git-info.txt"
log ""
log "Git last commit:"
git log -1 --format="%H %an %ae %ad %s" | tee -a "$REPORT_DIR/git-info.txt"
log ""
log "Uncommitted changes:"
git status --short | tee -a "$REPORT_DIR/git-info.txt" || log "No uncommitted changes"

# 13. Summary
log ""
log "=== INVESTIGATION SUMMARY ==="
log "=========================================="
log "Investigation completed. All data saved to: $REPORT_DIR"
log ""
log "Key files:"
log "  - investigation-report.txt: Full report"
log "  - timeline.txt: Container timeline"
log "  - suspicious-processes.txt: Malicious processes found"
log "  - oom-kills.txt: OOM kill events"
log "  - docker-events.txt: Docker container events"
log "  - npm-audit.json: Dependency vulnerabilities"
log "  - host-suspicious-processes.txt: Host system processes"
log ""
log "Next steps:"
log "1. Review all files in $REPORT_DIR"
log "2. Identify attack vector"
log "3. Implement prevention measures"
log "4. Document findings"

echo ""
echo "=== INVESTIGATION COMPLETE ==="
echo "Report saved to: $REPORT_DIR"
echo "Review the files to identify how the compromise occurred"

