# Diagnosing Recurring 504 Gateway Timeout Issues

## Problem
The frontend becomes unreachable after ~24 hours, causing 504 Gateway Timeout errors. This suggests a recurring issue that needs investigation.

## Quick Diagnostic (Run When Issue Occurs)

When the 504 error happens, run this comprehensive diagnostic script on the **ECS-App** server:

```bash
cd /opt/tas-production
bash scripts/diagnose-504-recurring.sh
```

This script will capture:
- Container status and restart counts
- Frontend logs (last 100 lines)
- Error patterns in logs
- Memory and CPU usage
- Network connectivity status
- OOM (Out of Memory) kills
- Docker events
- System resources

**Output**: Full diagnostic report saved to `/var/log/tas-504-diagnostic.log`

## Common Causes After 24 Hours

### 1. Memory Leak / OOM Kill
**Symptoms:**
- Container restart count > 0
- Memory usage at 100%
- OOM kills in system logs
- Process crashes in frontend logs

**Check:**
```bash
# Check restart count
docker ps -a --filter "name=tas_frontend" --format "{{.RestartCount}}"

# Check memory usage
docker stats tas_frontend --no-stream

# Check for OOM kills
grep -i "oom\|killed process" /var/log/syslog | tail -20
```

**Solution:**
- Increase memory limit in `docker-compose.frontend.yml` (currently 1GB)
- Investigate memory leaks in frontend code
- Add memory monitoring alerts

### 2. Container Restart Losing Network
**Symptoms:**
- Container restarts but nginx can't reach it
- Network connectivity fails after restart
- DNS resolution issues

**Check:**
```bash
# Check if containers are on same network
docker network inspect tas-production_tas_network | grep -E "(Name|IPv4Address)"

# Test connectivity
docker exec tas_nginx ping -c 2 frontend
docker exec tas_nginx wget -S -O- http://frontend:3000/ 2>&1 | head -5
```

**Solution:**
- Use the quick fix script: `bash scripts/quick-fix-504-timeout.sh`
- Ensure network aliases are properly configured
- Consider using IP addresses instead of service names (temporary)

### 3. Next.js Process Crashes
**Symptoms:**
- Frontend logs show crashes
- Process not running inside container
- Port 3000 not listening

**Check:**
```bash
# Check if process is running
docker exec tas_frontend ps aux | grep node

# Check if port is listening
docker exec tas_frontend netstat -tlnp | grep 3000

# Check recent logs for crashes
docker logs tas_frontend --tail 200 | grep -i -E "(error|fatal|crash|killed)"
```

**Solution:**
- Check frontend code for unhandled errors
- Review Next.js configuration
- Check for external API calls that might be hanging

### 4. Resource Exhaustion
**Symptoms:**
- High CPU usage
- Disk space full
- Too many connections

**Check:**
```bash
# System resources
free -h
df -h

# Container stats
docker stats --no-stream

# Connection count
docker exec tas_frontend netstat -an | wc -l
```

**Solution:**
- Clean up old logs
- Increase resource limits
- Optimize application code

## Manual Diagnostic Steps

If the script doesn't capture everything, run these manually:

### Step 1: Check Frontend Logs
```bash
# Full logs (last 500 lines)
docker logs tas_frontend --tail 500 > /tmp/frontend-logs.txt

# Search for patterns
docker logs tas_frontend 2>&1 | grep -i -E "(error|fatal|memory|oom|timeout|crash)" | tail -50

# Check logs around the time it failed
docker logs tas_frontend --since 2h | grep -i error
```

### Step 2: Check Container History
```bash
# See all container events
docker events --since 24h --filter "container=tas_frontend"

# Check restart history
docker inspect tas_frontend | grep -A 5 "RestartCount"
```

### Step 3: Check System Logs
```bash
# OOM kills
dmesg | grep -i "oom\|killed"

# System logs
journalctl -u docker --since "24 hours ago" | grep tas_frontend
```

### Step 4: Test Network Connectivity
```bash
# From nginx container
docker exec tas_nginx ping -c 3 frontend
docker exec tas_nginx wget -S -O- --timeout=5 http://frontend:3000/

# From host
curl -v http://localhost:8080
```

## Prevention: Auto-Monitoring

Set up automatic monitoring to catch issues before they cause 504 errors:

```bash
# Add to crontab (crontab -e)
# Check every 6 hours and auto-fix if needed
0 */6 * * * /opt/tas-production/scripts/monitor-and-fix-504.sh

# Or check every hour (more aggressive)
0 * * * * /opt/tas-production/scripts/monitor-and-fix-504.sh
```

The monitoring script will:
- Check connectivity every 6 hours
- Automatically restart containers if connectivity is lost
- Log all actions to `/var/log/tas-504-monitor.log`

## Long-term Solutions

### 1. Increase Memory Limits
If memory is the issue, increase limits in `docker-compose.frontend.yml`:

```yaml
mem_limit: 2g  # Increase from 1g to 2g
NODE_OPTIONS: --max-old-space-size=1536  # Increase from 512
```

### 2. Add Healthchecks
Healthchecks are now added to detect when containers become unhealthy. Docker will automatically restart unhealthy containers.

### 3. Implement Log Rotation
Prevent log files from filling up disk:

```bash
# Add to crontab
0 0 * * * find /var/log -name "tas-*.log" -size +100M -exec truncate -s 50M {} \;
```

### 4. Monitor and Alert
Set up monitoring to alert when:
- Container restart count increases
- Memory usage exceeds 80%
- 504 errors detected
- Healthcheck failures

## Next Steps

1. **Run the diagnostic script** when the issue occurs:
   ```bash
   cd /opt/tas-production
   bash scripts/diagnose-504-recurring.sh
   ```

2. **Review the diagnostic log**:
   ```bash
   cat /var/log/tas-504-diagnostic.log
   ```

3. **Share the diagnostic output** to identify the root cause

4. **Set up auto-monitoring** to prevent future issues:
   ```bash
   crontab -e
   # Add: 0 */6 * * * /opt/tas-production/scripts/monitor-and-fix-504.sh
   ```

## Quick Fix (When Issue Occurs)

If you need to restore service immediately:

```bash
cd /opt/tas-production
bash scripts/quick-fix-504-timeout.sh
```

This will restart containers without rebuilding, usually fixing network connectivity issues in ~10-15 seconds.

