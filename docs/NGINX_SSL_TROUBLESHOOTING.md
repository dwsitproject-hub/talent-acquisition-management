# NGINX SSL Troubleshooting Guide

## Problem: NGINX Container Keeps Restarting

If NGINX container is restarting after pulling code, it's likely due to missing SSL certificates.

### Symptoms
- Container status shows: `Restarting (1) X seconds ago`
- NGINX logs show: `SSL certificate file not found` or similar errors

### Quick Fix: Temporarily Disable HTTPS

If you haven't placed SSL certificates yet, temporarily disable HTTPS:

1. **Edit NGINX configuration:**
   ```bash
   cd /opt/tas-production
   nano nginx/nginx.network.conf
   ```

2. **Comment out the HTTPS server block** (lines 79-264):
   ```nginx
   # HTTPS Server (SSL enabled)
   # TEMPORARILY DISABLED - Uncomment when SSL certificates are ready
   # server {
   #     listen 443 ssl http2;
   #     ...
   # }
   ```

3. **Update HTTP server block to NOT redirect to HTTPS:**
   ```nginx
   # HTTP Server
   server {
       listen 80;
       server_name tas.example.com your.server.host;

       # TEMPORARILY DISABLED HTTPS REDIRECT
       # return 301 https://$host:8443$request_uri;
       
       # Serve HTTP directly (temporary)
       # ... rest of configuration ...
   }
   ```

4. **Restart NGINX:**
   ```bash
   docker compose -f docker-compose.frontend.yml -p tas-production restart nginx
   ```

### Permanent Fix: Add SSL Certificates

1. **Place SSL certificates:**
   ```bash
   cd /opt/tas-production
   mkdir -p ssl
   
   # Copy your certificates
   cp /path/to/fullchain.pem ssl/
   cp /path/to/privkey.pem ssl/
   
   # Set permissions
   chmod 644 ssl/fullchain.pem
   chmod 600 ssl/privkey.pem
   ```

2. **Verify certificates exist:**
   ```bash
   ls -la ssl/
   # Should show:
   # -rw-r--r-- 1 root root fullchain.pem
   # -rw------- 1 root root privkey.pem
   ```

3. **Uncomment HTTPS server block** in `nginx/nginx.network.conf`

4. **Restart NGINX:**
   ```bash
   docker compose -f docker-compose.frontend.yml -p tas-production restart nginx
   ```

### Check NGINX Logs

To see the actual error:

```bash
# Check NGINX container logs
docker compose -f docker-compose.frontend.yml -p tas-production logs nginx

# Or check logs directly
docker logs tas_nginx

# Check for configuration errors
docker compose -f docker-compose.frontend.yml -p tas-production exec nginx nginx -t
```

### Common Errors

**Error: `SSL certificate file not found`**
- Solution: Place SSL certificates in `ssl/` directory or comment out HTTPS block

**Error: `SSL certificate and key don't match`**
- Solution: Ensure `fullchain.pem` and `privkey.pem` are from the same certificate

**Error: `Permission denied`**
- Solution: Set correct permissions: `chmod 644 fullchain.pem` and `chmod 600 privkey.pem`

