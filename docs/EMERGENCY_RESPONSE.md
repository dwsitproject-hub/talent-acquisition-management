# 🚨 EMERGENCY RESPONSE - Container Compromised Again

## Current Situation

Health check detected:
- **33 processes** in frontend container (expected < 10)
- **OOM kill** of `XXcgpCfE` (malware process)
- **Container restarted** (likely from OOM kill)
- **HTTP endpoint down** (000 response)
- **Containers unhealthy**

## Immediate Actions (Run Now)

### Step 1: Check What Processes Are Running

```bash
# See all processes in frontend container
docker exec tas_frontend ps aux

# Look for suspicious processes
docker exec tas_frontend ps aux | grep -E "(lrt|pkill|javae|XX|zozmbw|sleep)"
```

### Step 2: Run Emergency Response

```bash
cd /opt/tas-production
git pull origin SIT
chmod +x scripts/emergency-response.sh
./scripts/emergency-response.sh
```

This will:
- Capture evidence
- Stop compromised container
- Rebuild from clean source
- Verify clean state

### Step 3: Manual Check (If Needed)

If emergency script doesn't work, do manually:

```bash
# 1. Stop and remove compromised container
docker compose -f docker-compose.frontend.yml -p tas-production stop frontend
docker rm tas_frontend

# 2. Remove old image
docker rmi tas-production-frontend

# 3. Pull clean code
cd /opt/tas-production
git pull origin SIT

# 4. Rebuild from scratch
docker compose -f docker-compose.frontend.yml -p tas-production --env-file .env.production build --no-cache frontend

# 5. Start fresh
docker compose -f docker-compose.frontend.yml -p tas-production --env-file .env.production up -d frontend

# 6. Verify
docker exec tas_frontend ps aux | wc -l  # Should be < 10
docker exec tas_frontend ps aux | grep -E "(lrt|pkill|XX)" || echo "✅ Clean"
curl -I http://localhost:8080  # Should return 200
```

## Root Cause Investigation

The container was compromised again. Possible causes:

1. **Compromised Docker Image**: Image was built with malware
2. **Compromised npm Package**: Malicious dependency
3. **Host System Compromised**: Malware on host infecting containers
4. **Container Escape**: Malware from another container

## Prevention Measures

After cleanup:

1. **Scan Dependencies**:
   ```bash
   cd /opt/tas-production/frontend
   docker run --rm -v $(pwd):/app -w /app node:22-alpine npm audit
   ```

2. **Check Host System**:
   ```bash
   ps aux | grep -E "(lrt|pkill|javae|XX)"
   netstat -tulpn | grep -v "127.0.0.1"
   ```

3. **Review Access Logs**:
   ```bash
   # Check who accessed the server
   last
   # Check SSH logs
   grep "Accepted\|Failed" /var/log/auth.log | tail -20
   ```

4. **Verify Image Integrity**:
   ```bash
   # Check when image was built
   docker images tas-production-frontend
   docker history tas-production-frontend
   ```

## Next Steps After Cleanup

1. **Monitor Closely**: Check every hour for first 24 hours
2. **Review Evidence**: Check `/tmp/tas-evidence-*` directory
3. **Investigate**: Determine how compromise happened
4. **Harden Security**: Implement additional security measures

