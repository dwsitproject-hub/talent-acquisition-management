# SECURITY INCIDENT: Compromised Frontend Container

## ⚠️ CRITICAL: Container Has Been Compromised

The diagnostic output shows clear evidence of malware/compromise in the `tas_frontend` container.

## Evidence of Compromise

1. **Hundreds of malicious processes**:
   - `[lrt]`, `[pkill]`, `[x]`, `[javae]`
   - Obfuscated process names: `[XXcgpCfE]`, `[XXMhijCj]`, `[XXOLFdFL]`
   - `zozmbw olynmruheri`
   - `sleep 86400` (explains 24-hour pattern!)

2. **OOM Kill**: Malicious process `XXcgpCfE` was killed by OOM killer

3. **Suspicious file access**: Processes trying to access `/dev/lrt`, `/etc/lrt`, etc.

4. **Errors not from your code**: `ReferenceError: returnNaN is not defined`

## Immediate Response Steps

### 1. ISOLATE THE CONTAINER (Do This First!)

```bash
# Stop the compromised container immediately
cd /opt/tas-production
docker compose -f docker-compose.frontend.yml -p tas-production stop frontend

# Remove the container (don't restart it!)
docker rm tas_frontend
```

### 2. Check Other Containers

```bash
# Check candidate-portal
docker exec tas_candidate_portal ps aux | grep -E "(lrt|pkill|javae|XX)"

# Check nginx
docker exec tas_nginx ps aux | grep -E "(lrt|pkill|javae|XX)"

# If any show similar processes, stop them too
```

### 3. Check Host System

```bash
# Check for malicious processes on host
ps aux | grep -E "(lrt|pkill|javae|XX|zozmbw)"

# Check for suspicious network connections
netstat -tulpn | grep -E "(217.60.1.217|suspicious_ip)"

# Check system logs for compromise
dmesg | grep -i "oom\|killed"
journalctl -xe | tail -100
```

### 4. Rebuild from Clean Source

**DO NOT** restart the existing container. Rebuild from clean source:

```bash
cd /opt/tas-production

# Pull latest clean code
git pull origin SIT

# Remove old images (optional but recommended)
docker rmi tas-production-frontend 2>/dev/null || true

# Rebuild from scratch
docker compose -f docker-compose.frontend.yml -p tas-production --env-file .env.production build --no-cache frontend

# Start fresh container
docker compose -f docker-compose.frontend.yml -p tas-production --env-file .env.production up -d frontend
```

### 5. Verify Clean State

```bash
# Check processes in new container
docker exec tas_frontend ps aux

# Should only see:
# - node (Next.js server)
# - Maybe some Node.js worker processes
# - NO [lrt], [pkill], [x], [javae], or obfuscated names

# Check logs
docker logs tas_frontend --tail 50

# Should NOT see:
# - "returnNaN is not defined"
# - "EACCES: permission denied, open '/dev/lrt'"
```

### 6. Monitor for Re-infection

```bash
# Set up monitoring to detect if it happens again
watch -n 60 'docker exec tas_frontend ps aux | grep -E "(lrt|pkill|javae|XX)" || echo "Clean"'
```

## How Did This Happen?

Possible attack vectors:

1. **Compromised Docker image**: Image was built with malware or pulled from untrusted source
2. **Vulnerable dependency**: npm package with malicious code
3. **Container escape**: Malware escaped from another container
4. **Host compromise**: Host system was compromised first
5. **Supply chain attack**: Malicious code in dependencies

## Prevention Measures

### 1. Use Only Trusted Base Images

```dockerfile
# Always use official images
FROM node:22-alpine  # ✅ Official
# NOT: FROM some-random-user/node:22  # ❌
```

### 2. Scan Dependencies

```bash
# Before building, scan for vulnerabilities
npm audit
npm audit fix

# Consider using tools like:
# - Snyk
# - OWASP Dependency-Check
```

### 3. Use Multi-Stage Builds (Already doing this ✅)

### 4. Run as Non-Root (Already doing this ✅)

### 5. Limit Container Capabilities

Add to `docker-compose.frontend.yml`:

```yaml
frontend:
  security_opt:
    - no-new-privileges:true
  cap_drop:
    - ALL
  cap_add:
    - NET_BIND_SERVICE  # Only what's needed
```

### 6. Monitor Container Processes

Set up alerts for:
- Unusual process names
- High process counts
- Processes running as wrong user
- Network connections to unknown IPs

## Investigation Steps

### 1. Preserve Evidence (Before Removing Container)

```bash
# Export container filesystem
docker export tas_frontend > /tmp/compromised-container.tar

# Export process list
docker exec tas_frontend ps aux > /tmp/compromised-processes.txt

# Export network connections
docker exec tas_frontend netstat -tulpn > /tmp/compromised-network.txt

# Export full logs
docker logs tas_frontend > /tmp/compromised-logs.txt
```

### 2. Check When It Started

```bash
# Check container creation time
docker inspect tas_frontend | grep Created

# Check system logs around that time
journalctl --since "2026-01-XX" --until "2026-01-XX"
```

### 3. Check Docker Images

```bash
# List all images
docker images

# Check image layers for suspicious files
docker history tas-production-frontend

# Scan image for vulnerabilities
docker scan tas-production-frontend
```

## Long-term Security Hardening

1. **Implement container scanning** in CI/CD pipeline
2. **Use read-only filesystems** where possible
3. **Implement network policies** to limit container communication
4. **Set up intrusion detection** for containers
5. **Regular security audits** of dependencies
6. **Monitor for anomalous behavior**

## Contact Security Team

If this is a production system:
1. **Immediately notify your security team**
2. **Preserve all evidence** before cleanup
3. **Document the timeline** of when issues started
4. **Review access logs** to see if unauthorized access occurred
5. **Check if other systems are affected**

## Recovery Checklist

- [ ] Stop compromised container
- [ ] Check other containers for compromise
- [ ] Check host system for compromise
- [ ] Preserve evidence (optional, for investigation)
- [ ] Remove compromised container
- [ ] Rebuild from clean source
- [ ] Verify clean state
- [ ] Monitor for re-infection
- [ ] Review security measures
- [ ] Notify security team (if applicable)

