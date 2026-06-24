# Troubleshooting 504 Gateway Timeout on tas.example.com:8080

## Problem
Getting `504 Gateway Time-out` when accessing `tas.example.com:8080`. Nginx is running but cannot reach the upstream services (`frontend:3000` and `candidate-portal:3000`).

**Common Scenario**: This issue often occurs after containers have been running for a while (e.g., overnight). Containers may restart due to `restart: unless-stopped` policy, but lose their service name aliases in the process.

## Root Causes
1. **Docker network issue**: Containers are not on the same Docker network
2. **Service name resolution**: Nginx cannot resolve `frontend` and `candidate-portal` hostnames (often after container restarts)
3. **Container connectivity**: Frontend/candidate-portal containers are not responding on port 3000
4. **Stale DNS cache**: Docker's embedded DNS cache may become stale after container restarts

## Diagnostic Steps

### Step 1: Check Docker Network Connectivity

On the **frontend server (ECS-App)**, run:

```bash
# Check if containers are on the same network
docker network inspect tas-production_tas_network

# Check which network each container is on
docker inspect tas_nginx | grep -A 10 "Networks"
docker inspect tas_frontend | grep -A 10 "Networks"
docker inspect tas_candidate_portal | grep -A 10 "Networks"
```

**Expected**: All three containers should be on `tas-production_tas_network`.

### Step 2: Test Connectivity from Nginx Container

```bash
# Test if nginx can reach frontend by service name
docker exec tas_nginx ping -c 2 frontend

# Test if nginx can reach candidate-portal by service name
docker exec tas_nginx ping -c 2 candidate-portal

# Test if nginx can reach frontend by IP
docker exec tas_nginx wget -O- --timeout=5 http://frontend:3000 2>&1 | head -20

# Test if nginx can reach candidate-portal by IP
docker exec tas_nginx wget -O- --timeout=5 http://candidate-portal:3000 2>&1 | head -20
```

**Expected**: All commands should succeed. If they fail, proceed to Step 3.

### Step 3: Check Nginx Logs

```bash
# Check nginx error logs
docker logs tas_nginx --tail 50

# Check nginx access logs
docker exec tas_nginx tail -20 /var/log/nginx/access.log
docker exec tas_nginx tail -20 /var/log/nginx/error.log
```

Look for errors like:
- `upstream timed out`
- `no resolver defined to resolve frontend`
- `connect() failed (111: Connection refused)`

### Step 4: Verify Frontend/Candidate Portal Containers are Running

```bash
# Check if containers are actually running and healthy
docker ps | grep tas

# Check container logs for errors
docker logs tas_frontend --tail 50
docker logs tas_candidate_portal --tail 50

# Test if containers are listening on port 3000
docker exec tas_frontend netstat -tlnp | grep 3000
docker exec tas_candidate_portal netstat -tlnp | grep 3000
```

## Quick Fix (No Rebuild Required)

If you're experiencing the issue where rebuilding fixes it, you can use this faster method:

```bash
cd /opt/tas-production
bash scripts/quick-fix-504-timeout.sh
```

This script restarts containers without rebuilding images, which is much faster and usually fixes the network connectivity issue.

## Solutions

### Solution 1: Quick Restart (Recommended for Recurring Issues)

If this happens regularly (e.g., after a day), use the quick fix script:

```bash
cd /opt/tas-production
bash scripts/quick-fix-504-timeout.sh
```

This restarts containers without rebuilding, restoring network connectivity.

### Solution 2: Restart Containers on Correct Network

If containers are not on the same network, restart them using docker-compose:

```bash
cd /opt/tas-production

# Stop all containers
docker compose -f docker-compose.frontend.yml -p tas-production --env-file .env.production down

# Start them again (this ensures they're on the correct network)
docker compose -f docker-compose.frontend.yml -p tas-production --env-file .env.production up -d

# Verify they're on the same network
docker network inspect tas-production_tas_network | grep -E "(Name|IPv4Address)"
```

### Solution 2: Use Host Network Mode (Temporary Fix)

If Docker networking is problematic, you can temporarily use host IPs instead of service names.

**Edit nginx configuration:**

```bash
cd /opt/tas-production
nano nginx/nginx.network.conf
```

Find the upstream blocks (around lines 54-64) and change:

```nginx
# Frontend upstream
upstream frontend {
    least_conn;
    server 127.0.0.1:3000 max_fails=3 fail_timeout=30s;  # Use localhost instead of service name
}

# Candidate Portal upstream
upstream candidate_portal {
    least_conn;
    server 127.0.0.1:3000 max_fails=3 fail_timeout=30s;  # Use localhost instead of service name
}
```

**⚠️ WARNING**: This won't work if containers are not exposing ports to host. Check if ports are exposed:

```bash
docker ps | grep -E "(tas_frontend|tas_candidate_portal)"
```

If ports are not exposed (no `0.0.0.0:XXXX->3000/tcp`), you need to expose them in `docker-compose.frontend.yml`:

```yaml
frontend:
  ports:
    - "3001:3000"  # Add this if not present

candidate-portal:
  ports:
    - "3002:3000"  # Add this if not present
```

Then update nginx to use `127.0.0.1:3001` and `127.0.0.1:3002`.

### Solution 3: Fix Docker Network (Recommended)

Ensure the network exists and containers are connected:

```bash
# Create network if it doesn't exist
docker network create tas-production_tas_network 2>/dev/null || true

# Connect containers to network
docker network connect tas-production_tas_network tas_nginx
docker network connect tas-production_tas_network tas_frontend
docker network connect tas-production_tas_network tas_candidate_portal

# Verify
docker network inspect tas-production_tas_network
```

### Solution 4: Restart Nginx After Fix

After applying any solution:

```bash
# Reload nginx configuration
docker exec tas_nginx nginx -t  # Test configuration
docker exec tas_nginx nginx -s reload  # Reload if test passes

# Or restart nginx container
docker compose -f docker-compose.frontend.yml -p tas-production restart nginx
```

## Quick Fix Script

Run this script on the frontend server to diagnose and attempt automatic fix:

```bash
#!/bin/bash
echo "=== Diagnosing 504 Gateway Timeout ==="

# Check network
echo "1. Checking Docker network..."
NETWORK_EXISTS=$(docker network ls | grep -c "tas-production_tas_network")
if [ "$NETWORK_EXISTS" -eq 0 ]; then
    echo "   ⚠️  Network doesn't exist, creating..."
    docker network create tas-production_tas_network
fi

# Check if containers are on network
echo "2. Checking container network membership..."
docker network inspect tas-production_tas_network 2>/dev/null | grep -q "tas_nginx" || echo "   ⚠️  tas_nginx not on network"
docker network inspect tas-production_tas_network 2>/dev/null | grep -q "tas_frontend" || echo "   ⚠️  tas_frontend not on network"
docker network inspect tas-production_tas_network 2>/dev/null | grep -q "tas_candidate_portal" || echo "   ⚠️  tas_candidate_portal not on network"

# Test connectivity
echo "3. Testing connectivity from nginx..."
docker exec tas_nginx ping -c 1 frontend >/dev/null 2>&1 && echo "   ✅ Can reach frontend" || echo "   ❌ Cannot reach frontend"
docker exec tas_nginx ping -c 1 candidate-portal >/dev/null 2>&1 && echo "   ✅ Can reach candidate-portal" || echo "   ❌ Cannot reach candidate-portal"

# Check nginx logs
echo "4. Recent nginx errors:"
docker logs tas_nginx --tail 10 2>&1 | grep -i error | tail -5

echo ""
echo "=== Diagnosis complete ==="
echo "If connectivity failed, run Solution 1 or 3 above"
```

## Verification

After applying fixes, verify the site works:

```bash
# Test from server
curl -I http://localhost:8080

# Test from external (if accessible)
curl -I http://tas.example.com:8080
```

Expected: Should return `200 OK` or `301/302` redirect, not `504 Gateway Time-out`.

## Prevention: Auto-Monitoring Script

To automatically detect and fix this issue, you can set up a cron job:

```bash
# Add to crontab (crontab -e)
# Check every 6 hours
0 */6 * * * /opt/tas-production/scripts/monitor-and-fix-504.sh

# Or check every hour
0 * * * * /opt/tas-production/scripts/monitor-and-fix-504.sh
```

The monitoring script will:
- Check if nginx can reach frontend/candidate-portal
- Automatically restart containers if connectivity is lost
- Log all actions to `/var/log/tas-504-monitor.log`

## Long-term Fix: Network Aliases

The `docker-compose.frontend.yml` has been updated to include explicit network aliases, which should help prevent this issue. After updating the file, restart containers:

```bash
cd /opt/tas-production
git pull origin main  # Get updated docker-compose.frontend.yml
docker compose -f docker-compose.frontend.yml -p tas-production --env-file .env.production up -d
```

