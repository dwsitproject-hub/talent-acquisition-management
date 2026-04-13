# Container Compromise Investigation Guide

## Overview

This guide helps you investigate how and when your container was compromised, and how to prevent it from happening again.

## Quick Investigation

Run the automated investigation script:

```bash
cd /opt/tas-production
git pull origin SIT
chmod +x scripts/investigate-compromise.sh
./scripts/investigate-compromise.sh
```

This will create a comprehensive report in `/tmp/tas-investigation-YYYYMMDD-HHMMSS/`

## Manual Investigation Steps

### 1. Timeline Analysis

**When did it happen?**

```bash
# Container creation time
docker inspect tas_frontend --format='{{.Created}}'

# Container start time
docker inspect tas_frontend --format='{{.State.StartedAt}}'

# Restart count
docker inspect tas_frontend --format='{{.RestartCount}}'

# Docker events
docker events --since 48h --filter "container=tas_frontend"
```

**Key Questions:**
- When was the container created?
- When did it restart?
- What happened around the time of compromise?

### 2. Process Analysis

**What processes are running?**

```bash
# All processes
docker exec tas_frontend ps aux

# Process count
docker exec tas_frontend ps aux | wc -l

# Process tree
docker exec tas_frontend ps auxf

# Suspicious processes
docker exec tas_frontend ps aux | grep -E "(lrt|pkill|javae|XX|zozmbw|sleep 86400)"
```

**Look for:**
- Unusual process names (obfuscated like `XXcgpCfE`)
- High process count (> 10)
- Processes running as wrong user
- Processes with suspicious names (`lrt`, `pkill`, `javae`)

### 3. Image Analysis

**Is the Docker image compromised?**

```bash
# Image creation time
docker images tas-production-frontend

# Image layers
docker history tas-production-frontend

# When was it built?
docker inspect tas-production-frontend --format='{{.Created}}'
```

**Compare with:**
- When was the code last updated?
- When was the image last built?
- Does the image match the source code?

### 4. Dependency Analysis

**Are npm packages compromised?**

```bash
cd /opt/tas-production/frontend

# Check for vulnerabilities
docker run --rm -v $(pwd):/app -w /app node:22-alpine npm audit

# Check package versions
docker run --rm -v $(pwd):/app -w /app node:22-alpine npm list --depth=0

# Check package-lock.json integrity
docker run --rm -v $(pwd):/app -w /app node:22-alpine npm ci --dry-run
```

**Look for:**
- Known vulnerabilities
- Suspicious packages
- Packages with unusual names
- Packages from untrusted sources

### 5. Host System Analysis

**Is the host system compromised?**

```bash
# Suspicious processes on host
ps aux | grep -E "(lrt|pkill|javae|XX|zozmbw)"

# Recent SSH logins
last -20

# Failed SSH attempts
grep "Failed\|Invalid" /var/log/auth.log | tail -20

# Cron jobs
crontab -l
ls -la /etc/cron.d /etc/cron.hourly /etc/cron.daily

# Network connections
netstat -tulpn | grep -v "127.0.0.1"
```

**Look for:**
- Unauthorized access
- Suspicious cron jobs
- Unusual network connections
- Processes that shouldn't be there

### 6. Container Logs Analysis

**What do the logs show?**

```bash
# Recent logs
docker logs tas_frontend --tail 200

# Errors
docker logs tas_frontend 2>&1 | grep -iE "(error|fatal|crash|killed|oom)"

# Timeline of events
docker logs tas_frontend --since 48h | grep -iE "(started|ready|error)"
```

**Look for:**
- When did errors start?
- What errors occurred?
- Any suspicious activity in logs?

### 7. Network Analysis

**What network connections exist?**

```bash
# Container network connections
docker exec tas_frontend netstat -tulpn

# Established connections
docker exec tas_frontend netstat -an | grep ESTABLISHED

# Host network connections
netstat -tulpn | grep -v "127.0.0.1"
```

**Look for:**
- Connections to unknown IPs
- Unusual outbound connections
- Connections to suspicious ports

### 8. File System Analysis

**Are there suspicious files?**

```bash
# Files in /tmp
docker exec tas_frontend ls -la /tmp

# Executable files
docker exec tas_frontend find / -type f -executable -name "*lrt*" -o -name "*XX*" 2>/dev/null

# Modified files
docker exec tas_frontend find /app -type f -mtime -1 2>/dev/null
```

**Look for:**
- Files that shouldn't be there
- Executable files in unusual locations
- Recently modified files

## Attack Vector Analysis

### Possible Attack Vectors

1. **Compromised npm Package**
   - Malicious code in dependencies
   - Supply chain attack
   - **Check**: npm audit, package versions

2. **Compromised Docker Image**
   - Image built with malware
   - Image pulled from untrusted source
   - **Check**: Image creation time, image layers

3. **Host System Compromise**
   - Malware on host infecting containers
   - **Check**: Host processes, SSH logs, cron jobs

4. **Container Escape**
   - Malware from another container
   - **Check**: Other containers, Docker network

5. **Code Injection**
   - Malicious code in source
   - **Check**: Git history, uncommitted changes

6. **Runtime Exploit**
   - Vulnerability in running application
   - **Check**: Application logs, error patterns

## Investigation Checklist

- [ ] Timeline: When did compromise occur?
- [ ] Processes: What malicious processes are running?
- [ ] Image: Is Docker image compromised?
- [ ] Dependencies: Are npm packages compromised?
- [ ] Host: Is host system compromised?
- [ ] Logs: What do container logs show?
- [ ] Network: What network connections exist?
- [ ] Files: Are there suspicious files?
- [ ] Access: Who accessed the system?
- [ ] Root Cause: What was the attack vector?

## Prevention Measures

Based on investigation findings:

### If npm Package Compromised:
- Audit all dependencies
- Use package-lock.json
- Scan with npm audit
- Consider dependency pinning

### If Docker Image Compromised:
- Rebuild from clean source
- Use official base images only
- Scan images before deployment
- Use multi-stage builds

### If Host System Compromised:
- Secure SSH access
- Review access logs
- Check for unauthorized users
- Consider host system rebuild

### If Container Escape:
- Isolate containers
- Use network policies
- Limit container capabilities
- Monitor inter-container communication

## Reporting

After investigation, document:

1. **Timeline**: When did it happen?
2. **Attack Vector**: How did it happen?
3. **Impact**: What was affected?
4. **Evidence**: What evidence was found?
5. **Prevention**: How to prevent it?

## Next Steps

1. **Immediate**: Clean up compromised container
2. **Short-term**: Implement prevention measures
3. **Long-term**: Continuous monitoring and security hardening

