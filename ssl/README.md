# SSL certificates go here

Place your **provided TLS certificate files** in this directory:

**On the frontend server:**
```
/opt/tas-production/ssl/
```

The `nginx` container mounts this folder at `/etc/nginx/ssl` and expects:

**Required files:**
- `fullchain.pem` (certificate + intermediate chain)
- `privkey.pem` (private key)

**Optional:**
- `chain.pem` (intermediate chain only)

## File naming

If your provider gave you files with different names, rename them:
- Certificate file (usually `.crt` or `.pem`) → `fullchain.pem`
- Private key file (usually `.key` or `.pem`) → `privkey.pem`

Most `.crt` files are already in PEM format, so you can just rename them.

## After placing certificates

1. Ensure files have correct permissions (readable by nginx):
   ```bash
   chmod 644 fullchain.pem
   chmod 600 privkey.pem
   ```

2. Restart the nginx container:
   ```bash
   docker compose -f docker-compose.frontend.yml -p tas-production restart nginx
   ```

3. Test SSL configuration:
   ```bash
   docker compose -f docker-compose.frontend.yml -p tas-production exec nginx nginx -t
   ```

## Access

After SSL is configured:
- HTTP (port 8080) will automatically redirect to HTTPS
- HTTPS will be available on the port specified by `HTTPS_PORT` environment variable (default: 443)
- Access via: `https://tas.example.com:<HTTPS_PORT>/`


