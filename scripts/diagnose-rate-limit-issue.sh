#!/bin/bash
# Diagnostic script for "too many requests" issue
# Analyzes nginx logs, backend logs, and rate limiting configuration

set -e

LOG_FILE="/var/log/tas-rate-limit-diagnosis.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

log() {
    echo "[$TIMESTAMP] $1" | tee -a "$LOG_FILE"
}

cd /opt/tas-production 2>/dev/null || cd /root/tas-production 2>/dev/null || {
    echo "ERROR: Cannot find tas-production directory"
    exit 1
}

log "=== RATE LIMIT DIAGNOSIS ==="
log ""

# 1. Check nginx logs for 429 errors
log "1. Checking Nginx logs for 429 errors (last 100 lines)..."
NGINX_429=$(docker logs tas_nginx --tail 100 2>&1 | grep -i "429\|too many" | wc -l)
if [ "$NGINX_429" -gt 0 ]; then
    log "⚠️  Found $NGINX_429 instances of 429 errors in nginx logs"
    log "Recent 429 errors:"
    docker logs tas_nginx --tail 100 2>&1 | grep -i "429\|too many" | tail -10 | tee -a "$LOG_FILE"
else
    log "✅ No 429 errors in recent nginx logs"
fi

# 2. Check backend logs for 429 errors
log ""
log "2. Checking backend logs for 429 errors..."
BACKEND_429=$(docker logs tas_backend --tail 100 2>&1 | grep -i "429\|too many" | wc -l)
if [ "$BACKEND_429" -gt 0 ]; then
    log "⚠️  Found $BACKEND_429 instances of 429 errors in backend logs"
    log "Recent 429 errors:"
    docker logs tas_backend --tail 100 2>&1 | grep -i "429\|too many" | tail -10 | tee -a "$LOG_FILE"
else
    log "✅ No 429 errors in recent backend logs"
fi

# 3. Analyze request patterns (top IPs making requests)
log ""
log "3. Analyzing request patterns (top 10 IPs in last hour)..."
if docker exec tas_nginx sh -c "test -f /var/log/nginx/access.log" 2>/dev/null; then
    docker exec tas_nginx sh -c "tail -1000 /var/log/nginx/access.log 2>/dev/null | awk '{print \$1}' | sort | uniq -c | sort -rn | head -10" | tee -a "$LOG_FILE"
else
    log "⚠️  Cannot access nginx access log"
fi

# 4. Check rate limit configuration
log ""
log "4. Current rate limit configuration:"
log "   - API limit: 10 requests/second (burst=20)"
log "   - Login limit: 5 requests/minute (burst=5)"
log ""
log "   This means:"
log "   - Normal API: 10 req/s sustained, 20 req burst"
log "   - Login: 5 req/min sustained, 5 req burst"
log ""
log "   ⚠️  Frontend pages make multiple simultaneous API calls:"
log "      - /api/auth/me"
log "      - /api/admin/menu-access"
log "      - /api/fptk"
log "      - /api/masters/divisions"
log "      - /api/masters/office-locations"
log "      - /api/admin/users"
log "   This can easily exceed 10 req/s on page load!"

# 5. Check for suspicious traffic patterns
log ""
log "5. Checking for suspicious traffic patterns..."
SUSPICIOUS_IPS=$(docker logs tas_nginx --tail 1000 2>&1 | grep -oE "[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}" | sort | uniq -c | sort -rn | awk '$1 > 50 {print $2}' | head -5)
if [ -n "$SUSPICIOUS_IPS" ]; then
    log "⚠️  IPs with high request counts (>50 in last 1000 requests):"
    echo "$SUSPICIOUS_IPS" | tee -a "$LOG_FILE"
else
    log "✅ No suspicious IP patterns detected"
fi

# 6. Check current request rate
log ""
log "6. Current request rate (requests in last minute)..."
RECENT_REQUESTS=$(docker logs tas_nginx --tail 1000 2>&1 | grep -c "GET\|POST" || echo "0")
log "   Recent requests: $RECENT_REQUESTS (last 1000 log entries)"

# 7. Check if it's a DDoS or legitimate traffic
log ""
log "7. Analyzing if traffic is legitimate or attack..."
log "   Checking user agents..."
docker logs tas_nginx --tail 500 2>&1 | grep -oE '"Mozilla/[^"]*"' | sort | uniq -c | sort -rn | head -5 | tee -a "$LOG_FILE"

# 8. Recommendations
log ""
log "=== RECOMMENDATIONS ==="
log ""
log "If legitimate users are hitting rate limits:"
log "1. Increase API rate limit from 10r/s to 30r/s"
log "2. Increase burst from 20 to 50"
log "3. Consider per-endpoint rate limits (higher for read operations)"
log ""
log "If it's an attack:"
log "1. Block suspicious IPs using fail2ban or nginx deny rules"
log "2. Implement stricter rate limits for login endpoints"
log "3. Add CAPTCHA for repeated failed logins"
log ""
log "=== DIAGNOSIS COMPLETE ==="
log "Full log saved to: $LOG_FILE"

