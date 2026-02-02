# Post-Incident Security Hardening Guide

After the security incident where the frontend container was compromised, follow these steps to harden security and prevent future incidents.

## ✅ Immediate Actions (Already Done)

- [x] Stopped and removed compromised container
- [x] Rebuilt from clean source
- [x] Verified clean state (only `next-server` process running)

## 🔒 Ongoing Security Measures

### 1. Set Up Security Monitoring

Add to crontab to monitor containers every 15 minutes:

```bash
# Edit crontab
crontab -e

# Add this line (check every 15 minutes)
*/15 * * * * /opt/tas-production/scripts/monitor-container-security.sh

# Or check every 30 minutes (less aggressive)
*/30 * * * * /opt/tas-production/scripts/monitor-container-security.sh
```

The monitoring script will:
- Check for suspicious processes (`lrt`, `pkill`, `javae`, obfuscated names)
- Monitor process counts (should be low)
- Check logs for suspicious errors
- Automatically stop containers if compromise detected
- Log all findings to `/var/log/tas-security-monitor.log`

### 2. Regular Security Audits

#### Weekly: Check for Vulnerabilities

```bash
cd /opt/tas-production/frontend
npm audit
npm audit fix  # Fix vulnerabilities if any

cd ../candidate-portal
npm audit
npm audit fix
```

#### Monthly: Full Security Review

```bash
# Check all containers for suspicious activity
docker exec tas_frontend ps aux | wc -l  # Should be < 10
docker exec tas_candidate_portal ps aux | wc -l  # Should be < 10

# Check for unusual network connections
docker exec tas_frontend netstat -tulpn | grep -v "127.0.0.1\|0.0.0.0:3000"

# Review security logs
tail -100 /var/log/tas-security-monitor.log
```

### 3. Harden Docker Configuration

Update `docker-compose.frontend.yml` to add security restrictions:

```yaml
frontend:
  # ... existing config ...
  security_opt:
    - no-new-privileges:true
  cap_drop:
    - ALL
  cap_add:
    - NET_BIND_SERVICE  # Only what's needed for Next.js
  read_only: false  # Set to true if possible (may need tmpfs for /tmp)
  tmpfs:
    - /tmp:noexec,nosuid,size=100m
```

### 4. Use Read-Only Root Filesystem (If Possible)

If your app doesn't need to write to filesystem:

```yaml
frontend:
  read_only: true
  tmpfs:
    - /tmp:noexec,nosuid,size=100m
    - /var/tmp:noexec,nosuid,size=100m
```

### 5. Implement Resource Limits

Already have memory limits, but add CPU throttling:

```yaml
frontend:
  # ... existing config ...
  cpus: '1.0'
  mem_limit: 1g
  memswap_limit: 1g  # Prevent swap usage
  oom_kill_disable: false  # Allow OOM killer (important!)
  oom_score_adj: 1000  # Higher priority for OOM kill
```

### 6. Network Security

Limit container network access:

```yaml
frontend:
  # ... existing config ...
  networks:
    tas_network:
      aliases:
        - frontend
        - tas_frontend
  # Add network policies if using Docker Swarm/Kubernetes
```

### 7. Image Security

#### Use Official Base Images Only

```dockerfile
# ✅ Good
FROM node:22-alpine

# ❌ Bad - don't use random user images
FROM some-user/node:22
```

#### Scan Images Before Deployment

```bash
# Install Docker Scout (if available)
docker scout cves tas-production-frontend

# Or use Trivy
trivy image tas-production-frontend
```

### 8. Dependency Security

#### Lock Dependencies

```bash
# Ensure package-lock.json is committed
cd frontend
npm ci  # Use ci, not install (uses lock file exactly)
```

#### Regular Dependency Updates

```bash
# Check for outdated packages
npm outdated

# Update carefully, test thoroughly
npm update

# Re-audit after updates
npm audit
```

### 9. Log Monitoring

Set up log rotation and monitoring:

```bash
# Add to crontab for log rotation
0 0 * * * find /var/log -name "tas-*.log" -size +100M -exec truncate -s 50M {} \;
```

### 10. Incident Response Plan

Keep the security incident response guide handy:
- `docs/SECURITY_INCIDENT_RESPONSE.md`

## 🔍 Detection Indicators

Watch for these signs of compromise:

1. **Suspicious Processes**:
   - `[lrt]`, `[pkill]`, `[x]`, `[javae]`
   - Obfuscated names like `[XXcgpCfE]`
   - `sleep 86400` (24-hour sleep)

2. **High Process Count**:
   - Normal: 2-5 processes
   - Suspicious: > 20 processes

3. **Suspicious Log Errors**:
   - `ReferenceError: returnNaN is not defined`
   - `EACCES: permission denied, open '/dev/lrt'`
   - `EHOSTUNREACH 217.60.1.217:80`

4. **Resource Exhaustion**:
   - Memory usage suddenly spikes
   - OOM kills in system logs
   - Container becomes unresponsive

5. **Network Anomalies**:
   - Connections to unknown IPs
   - Unexpected outbound connections
   - High network traffic

## 📋 Security Checklist

Run this weekly:

```bash
#!/bin/bash
echo "=== Security Check ==="

# 1. Check processes
echo "1. Process counts:"
docker exec tas_frontend ps aux | wc -l
docker exec tas_candidate_portal ps aux | wc -l

# 2. Check for suspicious processes
echo "2. Suspicious processes:"
docker exec tas_frontend ps aux | grep -E "(lrt|pkill|javae|XX)" || echo "✅ None found"

# 3. Check npm vulnerabilities
echo "3. NPM vulnerabilities:"
cd /opt/tas-production/frontend && npm audit --audit-level=moderate

# 4. Check container health
echo "4. Container health:"
docker ps --filter "name=tas_" --format "table {{.Names}}\t{{.Status}}"

# 5. Check recent security logs
echo "5. Recent security alerts:"
tail -20 /var/log/tas-security-monitor.log | grep -i "alert\|warning" || echo "✅ No alerts"

echo "=== Check Complete ==="
```

## 🚨 If Compromise Detected Again

1. **Immediately stop the container**:
   ```bash
   docker compose -f docker-compose.frontend.yml -p tas-production stop frontend
   ```

2. **Preserve evidence** (optional):
   ```bash
   docker export tas_frontend > /tmp/compromised-$(date +%Y%m%d).tar
   docker logs tas_frontend > /tmp/compromised-logs-$(date +%Y%m%d).txt
   ```

3. **Remove and rebuild**:
   ```bash
   docker rm tas_frontend
   docker rmi tas-production-frontend
   docker compose -f docker-compose.frontend.yml -p tas-production --env-file .env.production build --no-cache frontend
   docker compose -f docker-compose.frontend.yml -p tas-production --env-file .env.production up -d frontend
   ```

4. **Investigate root cause**:
   - Check when it started (container creation time)
   - Review dependency updates
   - Check if host system is compromised
   - Review access logs

## 📞 Reporting

If compromise is confirmed:
1. Document the timeline
2. Preserve evidence
3. Notify security team (if applicable)
4. Review and update security measures

## ✅ Current Status

After cleanup:
- ✅ Container is clean (only `next-server` process)
- ✅ Logs are clean (no suspicious errors)
- ✅ Next.js binding correctly to `0.0.0.0:3000`
- ✅ Security monitoring script created
- ✅ Incident response guide created

**Next Steps:**
1. Set up the security monitoring cron job
2. Run weekly security audits
3. Keep dependencies updated
4. Monitor logs regularly

