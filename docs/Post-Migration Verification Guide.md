# Post-Migration Verification Guide

## Immediate Verification (Run Now)

After deploying the exceljs migration, verify everything works:

### 1. Run Verification Script

```bash
cd /opt/tas-production
chmod +x scripts/verify-exceljs-migration.sh
./scripts/verify-exceljs-migration.sh
```

This checks:
- ✅ package.json updated correctly
- ✅ Container running
- ✅ Container health
- ✅ Process count normal
- ✅ No suspicious processes
- ✅ HTTP endpoint responding
- ✅ No errors in logs
- ✅ exceljs installed
- ✅ xlsx removed

### 2. Manual Verification

```bash
# Check container status
docker ps | grep tas_frontend

# Check process count (should be < 10)
docker exec tas_frontend ps aux | wc -l

# Check for suspicious processes (should be empty)
docker exec tas_frontend ps aux | grep -E "(lrt|pkill|javae|XX)" || echo "✅ Clean"

# Test HTTP endpoint
curl -I http://localhost:8080
# Should return: HTTP/1.1 200 OK

# Check container logs
docker logs tas_frontend --tail 50 | grep -iE "(error|exceljs|xlsx)" || echo "✅ No errors"
```

### 3. Functional Testing (In Browser)

Test these features in the UI:

- [ ] **Upload Candidate Excel**: Upload a candidate Excel file, verify it parses correctly
- [ ] **Upload FPTK Excel**: Upload an FPTK Excel file, verify it parses correctly
- [ ] **Download FPTK Template**: Click download template, verify file downloads
- [ ] **Check Browser Console**: Open browser DevTools, check for JavaScript errors
- [ ] **Verify Data**: After upload, verify all fields are mapped correctly

## Continuous Monitoring (Next 24-48 Hours)

### Option 1: Automated Monitoring (Recommended)

Run continuous monitoring for 24 hours:

```bash
cd /opt/tas-production
chmod +x scripts/monitor-exceljs-health.sh

# Run in background
nohup ./scripts/monitor-exceljs-health.sh > /dev/null 2>&1 &

# Or run in screen/tmux session
screen -S exceljs-monitor
./scripts/monitor-exceljs-health.sh
# Press Ctrl+A then D to detach
```

This monitors every 5 minutes and logs:
- Process count
- Suspicious processes
- HTTP endpoint status
- Memory usage
- Container health
- Errors in logs

### Option 2: Manual Periodic Checks

Run these commands every 6 hours:

```bash
# Quick health check
./scripts/daily-health-check.sh

# Check process count
docker exec tas_frontend ps aux | wc -l

# Check for suspicious processes
docker exec tas_frontend ps aux | grep -E "(lrt|pkill|javae|XX)" || echo "✅ Clean"

# Check HTTP endpoint
curl -I http://localhost:8080
```

## Success Indicators

### ✅ System is Healthy If:

1. **Process Count**: Stays below 10-15 processes
2. **No Suspicious Processes**: No `lrt`, `pkill`, `XX`, `javae` processes
3. **HTTP Endpoint**: Returns 200/301/302 consistently
4. **Memory Usage**: Stable, not increasing over time
5. **Container Health**: Shows "healthy" status
6. **No OOM Kills**: No out-of-memory kills in system logs
7. **No Errors**: No errors in container logs
8. **Excel Functions Work**: Upload/download works in UI

### ❌ Warning Signs (Take Action):

1. **Process Count Increasing**: If it goes above 20, investigate
2. **Suspicious Processes**: Any `lrt`, `pkill`, `XX` processes = compromised
3. **HTTP 504/000**: Endpoint not responding = container issue
4. **Memory Spikes**: Sudden memory increase = possible memory leak or malware
5. **Container Unhealthy**: Health check failing = application issue
6. **OOM Kills**: Out-of-memory kills = memory leak or malware
7. **Errors in Logs**: Multiple errors = application issue

## What to Monitor

### Critical (Check Every Hour for First 6 Hours)
- Process count
- Suspicious processes
- HTTP endpoint

### Important (Check Every 6 Hours)
- Memory usage
- Container health
- Container logs

### Regular (Check Daily)
- OOM kills
- Container restart count
- System resource usage

## If Issues Occur

### If Process Count Increases:
```bash
# Check what processes are running
docker exec tas_frontend ps aux

# If suspicious, run emergency response
./scripts/emergency-response.sh
```

### If HTTP Endpoint Fails:
```bash
# Check container logs
docker logs tas_frontend --tail 100

# Check container status
docker ps | grep tas_frontend

# Restart if needed
docker compose -f docker-compose.frontend.yml -p tas-production --env-file .env.production restart frontend
```

### If Suspicious Processes Found:
```bash
# Run emergency response immediately
./scripts/emergency-response.sh
```

## Timeline

- **0-6 hours**: Monitor closely (every hour)
- **6-24 hours**: Monitor regularly (every 6 hours)
- **24-48 hours**: Monitor daily
- **After 48 hours**: If stable, resume normal monitoring

## Success Criteria

After 24-48 hours, migration is successful if:
- ✅ No process count increases
- ✅ No suspicious processes
- ✅ HTTP endpoint stable
- ✅ Memory usage stable
- ✅ No OOM kills
- ✅ Excel functions work correctly
- ✅ No container restarts

## Log Files

- Verification: `/var/log/tas-exceljs-verification.log`
- Monitoring: `/var/log/tas-exceljs-monitoring.log`
- Alerts: `/var/log/tas-exceljs-alerts.log`
- Daily Health: `/var/log/tas-daily-health.log`

Review these files to track system health over time.

