# Rate Limit Fix Guide

## Problem

Users are experiencing "Too Many Requests" (429) errors in production. This happens because:

1. **Nginx rate limit is too restrictive**: 10 requests/second with burst=20
2. **Frontend makes multiple simultaneous API calls** when loading a page:
   - `/api/auth/me`
   - `/api/admin/menu-access`
   - `/api/fptk`
   - `/api/masters/divisions`
   - `/api/masters/office-locations`
   - `/api/admin/users`
3. **Multiple users** loading pages simultaneously can easily exceed the limit

## Solution

### Immediate Fix (Applied)

Rate limits have been increased:

- **API limit**: `10r/s` → `30r/s` (burst: 20 → 50)
- **Login limit**: `5r/m` → `10r/m` (burst: 5 → 10)

This allows:
- ~6 users loading pages simultaneously (each makes ~5 API calls)
- Better handling of legitimate traffic spikes
- Still protects against abuse

### Apply the Fix

1. **Pull the updated configuration**:
   ```bash
   cd /opt/tas-production
   git pull origin SIT
   ```

2. **Reload Nginx** (no downtime):
   ```bash
   docker exec tas_nginx nginx -t  # Test configuration
   docker exec tas_nginx nginx -s reload  # Reload
   ```

   Or restart the container:
   ```bash
   docker compose -f docker-compose.frontend.yml -p tas-production --env-file .env.production restart nginx
   ```

3. **Verify the fix**:
   ```bash
   # Check nginx logs for 429 errors (should decrease)
   docker logs tas_nginx --tail 100 | grep -i "429\|too many"
   
   # Run diagnostic script
   ./scripts/diagnose-rate-limit-issue.sh
   ```

## Diagnosis

Run the diagnostic script to analyze the issue:

```bash
cd /opt/tas-production
chmod +x scripts/diagnose-rate-limit-issue.sh
./scripts/diagnose-rate-limit-issue.sh
```

This will show:
- Number of 429 errors in nginx and backend logs
- Top IPs making requests
- Request patterns
- Whether it's legitimate traffic or an attack

## Monitoring

### Check for 429 Errors

```bash
# Nginx logs
docker logs tas_nginx --tail 1000 | grep -c "429"

# Backend logs
docker logs tas_backend --tail 1000 | grep -c "429"
```

### Monitor Request Rates

```bash
# Count requests per minute
docker logs tas_nginx --tail 1000 | grep -c "GET\|POST"

# Top requesting IPs
docker logs tas_nginx --tail 1000 | grep -oE "[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}" | sort | uniq -c | sort -rn | head -10
```

## If Issues Persist

### Option 1: Further Increase Limits (if legitimate traffic)

If you have many concurrent users, you can increase further:

```nginx
# In nginx/nginx.network.conf
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=50r/s;
# And update burst to 100
limit_req zone=api_limit burst=100 nodelay;
```

### Option 2: Implement Per-Endpoint Limits

Different endpoints can have different limits:

```nginx
# Read operations (higher limit)
location ~ ^/api/(fptk|candidates|masters)/ {
    limit_req zone=api_limit burst=100 nodelay;
    # ...
}

# Write operations (lower limit)
location ~ ^/api/(fptk|candidates|masters)/ {
    limit_req zone=api_limit burst=20 nodelay;
    # ...
}
```

### Option 3: Block Suspicious IPs

If it's an attack, block suspicious IPs:

```nginx
# In nginx/nginx.network.conf, add:
http {
    # ...
    
    # Block suspicious IPs
    geo $blocked_ip {
        default 0;
        1.2.3.4 1;  # Add suspicious IPs here
        5.6.7.8 1;
    }
    
    server {
        # ...
        if ($blocked_ip) {
            return 403;
        }
    }
}
```

### Option 4: Use Backend Rate Limiter Only

You can disable Nginx rate limiting and rely only on backend rate limiter (100 req/15 min):

```nginx
# Comment out limit_req directives
# location /api/ {
#     # limit_req zone=api_limit burst=50 nodelay;  # Disabled
#     proxy_pass http://backend;
#     # ...
# }
```

## Current Configuration

### Nginx Rate Limits
- **API**: 30 requests/second (burst: 50)
- **Login**: 10 requests/minute (burst: 10)
- **FPTK/Bulk Upload**: 30 requests/second (burst: 200)

### Backend Rate Limits
- **General API**: 100 requests per 15 minutes
- **Login**: 20 attempts per 15 minutes
- **Upload**: 50 uploads per hour
- **AI**: 10 requests per hour

## Best Practices

1. **Monitor regularly**: Check logs for 429 errors weekly
2. **Adjust based on usage**: If legitimate users hit limits, increase; if attacks, decrease
3. **Use per-endpoint limits**: Different endpoints have different needs
4. **Consider Redis**: For distributed rate limiting across multiple servers
5. **Implement CAPTCHA**: For repeated failed logins

## Testing

After applying the fix, test:

1. **Load a page**: Should load without 429 errors
2. **Multiple users**: Have 5-10 users load pages simultaneously
3. **Bulk operations**: Test bulk uploads (should work with burst=200)
4. **Login**: Test login attempts (should work with 10r/m)

## Rollback

If the new limits cause issues, rollback:

```bash
cd /opt/tas-production
git checkout HEAD~1 nginx/nginx.network.conf
docker exec tas_nginx nginx -s reload
```

