# 24-Hour System Stability Guide

## Overview

This guide ensures your TAS production system remains stable and secure for the next 24 hours and beyond.

## Immediate Setup (Run Now)

### 1. Set Up Automated Monitoring

```bash
cd /opt/tas-production
git pull origin SIT

# Make scripts executable
chmod +x scripts/*.sh

# Add to crontab (runs every 6 hours)
crontab -e

# Add these lines:
# Security monitoring (every 15 minutes)
*/15 * * * * /opt/tas-production/scripts/monitor-container-security.sh >> /var/log/tas-security-monitor.log 2>&1

# Health check (every 6 hours)
0 */6 * * * /opt/tas-production/scripts/daily-health-check.sh

# Network connectivity fix (every 12 hours - preventive)
0 */12 * * * /opt/tas-production/scripts/monitor-and-fix-504.sh >> /var/log/tas-504-monitor.log 2>&1
```

### 2. Verify Current System State

```bash
# Check all containers are running
docker ps | grep tas_

# Should show:
# - tas_nginx (healthy)
# - tas_frontend (running)
# - tas_candidate_portal (running)

# Test connectivity
curl -I http://localhost:8080
# Should return: HTTP/1.1 200 OK

# Check for suspicious processes
docker exec tas_frontend ps aux | grep -E "(lrt|pkill|javae|XX)" || echo "✅ Clean"
```

### 3. Set Up Log Monitoring

```bash
# Create log directory if needed
mkdir -p /var/log

# Set up log rotation (optional but recommended)
cat > /etc/logrotate.d/tas-production << 'EOF'
/var/log/tas-*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
}
EOF
```

## Monitoring Checklist (Next 24 Hours)

### Every 6 Hours

Run the health check script:
```bash
/opt/tas-production/scripts/daily-health-check.sh
```

Check the output for:
- ✅ All containers running
- ✅ No suspicious processes
- ✅ Network connectivity OK
- ✅ HTTP endpoint responding
- ✅ Memory usage < 90%
- ✅ No recent errors
- ✅ Disk space < 85%

### Every 12 Hours

Check security monitoring logs:
```bash
tail -50 /var/log/tas-security-monitor.log
```

Look for:
- Security alerts
- Suspicious process detection
- Container health issues

### Daily (24 Hours)

Run comprehensive check:
```bash
# Full diagnostic
/opt/tas-production/scripts/diagnose-504-recurring.sh

# Review all logs
tail -100 /var/log/tas-daily-health.log
tail -100 /var/log/tas-security-monitor.log
tail -100 /var/log/tas-504-monitor.log

# Check for alerts
grep "ALERT" /var/log/tas-*.log | tail -20
```

## Automated Fixes

The monitoring scripts will automatically:

1. **Security Monitoring** (`monitor-container-security.sh`):
   - Detects suspicious processes
   - Stops compromised containers
   - Logs all findings

2. **504 Timeout Fix** (`monitor-and-fix-504.sh`):
   - Tests nginx → frontend connectivity
   - Automatically restarts containers if connectivity lost
   - Restores network connectivity

3. **Health Check** (`daily-health-check.sh`):
   - Monitors all system components
   - Alerts on issues
   - Logs comprehensive status

## Manual Checks (If Needed)

### If You See Issues

1. **504 Gateway Timeout**:
   ```bash
   /opt/tas-production/scripts/quick-fix-504-timeout.sh
   ```

2. **Suspicious Processes**:
   ```bash
   /opt/tas-production/scripts/diagnose-504-recurring.sh
   # Review the output
   # If compromise detected, follow SECURITY_INCIDENT_RESPONSE.md
   ```

3. **High Memory Usage**:
   ```bash
   docker stats tas_frontend --no-stream
   # If > 90%, consider restarting
   docker compose -f docker-compose.frontend.yml -p tas-production restart frontend
   ```

4. **Container Not Responding**:
   ```bash
   # Quick restart
   docker compose -f docker-compose.frontend.yml -p tas-production restart frontend
   
   # If that doesn't work, full restart
   /opt/tas-production/scripts/quick-fix-504-timeout.sh
   ```

## Expected Behavior

### Normal Operation

- **Containers**: All 3 running, status "Up X hours"
- **Processes**: Only `next-server` and Node.js workers (2-5 processes)
- **Memory**: 40-60% usage
- **HTTP**: Returns 200 OK
- **Logs**: Clean, no errors
- **Network**: Nginx can reach frontend

### Warning Signs

- ⚠️ Container restart count > 0
- ⚠️ Memory usage > 80%
- ⚠️ High process count (> 10)
- ⚠️ 504 errors in nginx logs
- ⚠️ Suspicious processes detected

### Critical Issues

- 🚨 Container unhealthy or stopped
- 🚨 Suspicious processes (lrt, pkill, javae, XX*)
- 🚨 OOM kills in system logs
- 🚨 HTTP endpoint returns 504/500
- 🚨 Network connectivity lost

## Response Procedures

### If Security Alert

1. **Immediately stop compromised container**:
   ```bash
   docker compose -f docker-compose.frontend.yml -p tas-production stop frontend
   ```

2. **Follow security incident response**:
   - See `docs/SECURITY_INCIDENT_RESPONSE.md`
   - Rebuild from clean source
   - Verify clean state

### If 504 Timeout

1. **Run quick fix**:
   ```bash
   /opt/tas-production/scripts/quick-fix-504-timeout.sh
   ```

2. **If persists, run diagnostic**:
   ```bash
   /opt/tas-production/scripts/diagnose-504-recurring.sh
   ```

3. **Review diagnostic output** and address root cause

### If High Memory

1. **Check what's using memory**:
   ```bash
   docker stats tas_frontend --no-stream
   docker exec tas_frontend ps aux --sort=-%mem | head -10
   ```

2. **Restart if needed**:
   ```bash
   docker compose -f docker-compose.frontend.yml -p tas-production restart frontend
   ```

## Verification Commands

Quick health check (run anytime):
```bash
# One-liner health check
echo "=== Container Status ===" && \
docker ps --filter "name=tas_" --format "table {{.Names}}\t{{.Status}}" && \
echo -e "\n=== Connectivity ===" && \
curl -s -o /dev/null -w "HTTP: %{http_code}\n" http://localhost:8080 && \
echo -e "\n=== Process Count ===" && \
docker exec tas_frontend ps aux 2>/dev/null | wc -l && \
echo -e "\n=== Memory Usage ===" && \
docker stats tas_frontend --no-stream --format "Memory: {{.MemPerc}}"
```

## Log Locations

- `/var/log/tas-daily-health.log` - Health check results
- `/var/log/tas-security-monitor.log` - Security monitoring
- `/var/log/tas-504-monitor.log` - 504 timeout monitoring
- `/var/log/tas-alerts.log` - All alerts
- `/var/log/tas-504-diagnostic.log` - Diagnostic reports

## Success Criteria (24 Hours)

After 24 hours, verify:

- ✅ No container restarts (restart count = 0)
- ✅ No security alerts
- ✅ No 504 timeouts
- ✅ HTTP endpoint consistently returns 200 OK
- ✅ Memory usage stable (< 80%)
- ✅ No suspicious processes
- ✅ All monitoring scripts running successfully

## Maintenance Schedule

### Daily
- Review health check logs
- Check for alerts
- Verify all containers running

### Weekly
- Review security logs
- Check for npm vulnerabilities
- Review disk space
- Update dependencies if needed

### Monthly
- Full security audit
- Review and update monitoring scripts
- Check for system updates
- Review and optimize resource usage

## Quick Reference

```bash
# Health check
/opt/tas-production/scripts/daily-health-check.sh

# Security check
/opt/tas-production/scripts/monitor-container-security.sh

# Fix 504 timeout
/opt/tas-production/scripts/quick-fix-504-timeout.sh

# Full diagnostic
/opt/tas-production/scripts/diagnose-504-recurring.sh

# View logs
tail -f /var/log/tas-daily-health.log
tail -f /var/log/tas-security-monitor.log
```

## Support

If issues persist:
1. Run diagnostic script
2. Review relevant documentation
3. Check logs for error patterns
4. Follow incident response procedures

