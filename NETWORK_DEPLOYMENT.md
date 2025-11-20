# Network Deployment Guide - Talent Acquisition System

This guide will help you deploy the Talent Acquisition System to your company network for testing by the TA team.

## Prerequisites

1. **Server Requirements:**
   - Windows Server or Linux server with Docker installed
   - Minimum 8GB RAM, 4 CPU cores
   - Static IP address or hostname on company network
   - Ports 80 (HTTP) and 443 (HTTPS) available

2. **Network Access:**
   - Server should be accessible from TA team's computers
   - Firewall rules configured to allow HTTP/HTTPS traffic
   - DNS entry (optional but recommended) pointing to server IP

## Quick Start

### Step 1: Prepare Configuration

1. Copy the environment template:
   ```powershell
   Copy-Item .env.network.template .env.network
   ```

2. Edit `.env.network` with your server details:
   ```env
   # Replace with your server's IP address or hostname
   SERVER_HOST=192.168.1.100
   
   # Or use a hostname if DNS is configured
   # SERVER_HOST=tas-server.company.local
   
   # Set secure passwords
   POSTGRES_PASSWORD=your_secure_password_here
   REDIS_PASSWORD=your_secure_password_here
   
   # Generate secure secrets (see below)
   JWT_SECRET=...
   JWT_REFRESH_SECRET=...
   ENCRYPTION_KEY=...
   ```

### Step 2: Generate Secure Secrets

**On Windows (PowerShell):**
```powershell
# Generate JWT Secret (64 characters)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Generate Encryption Key (32 characters)
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

**On Linux/Mac:**
```bash
# Generate JWT Secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Generate Encryption Key
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

Copy the generated values to your `.env.network` file.

### Step 3: Deploy

**On Windows:**
```powershell
.\deploy-network.ps1
```

**On Linux/Mac:**
```bash
# Export environment variables first
export $(cat .env.network | grep -v '^#' | xargs)

# Deploy
docker-compose -f docker-compose.network.yml up -d --build

# Run migrations
docker-compose -f docker-compose.network.yml exec backend npx prisma migrate deploy
```

### Step 4: Verify Deployment

1. Check service status:
   ```powershell
   docker-compose -f docker-compose.network.yml ps
   ```

2. Check logs:
   ```powershell
   docker-compose -f docker-compose.network.yml logs -f
   ```

3. Access the application:
   - Open browser and navigate to: `http://YOUR_SERVER_IP`
   - You should see the login page

## Configuration Details

### Server Host Configuration

The `SERVER_HOST` variable determines how the application is accessed:

- **IP Address:** `SERVER_HOST=192.168.1.100`
  - Access via: `http://192.168.1.100`
  
- **Hostname (if DNS configured):** `SERVER_HOST=tas-server.company.local`
  - Access via: `http://tas-server.company.local`

- **Domain Name:** `SERVER_HOST=tas.company.com`
  - Access via: `http://tas.company.com`

### Port Configuration

By default, the application runs on:
- **Port 80:** Main application (Admin Dashboard)
- **Port 443:** HTTPS (if SSL certificates are configured)

To change ports, update in `.env.network`:
```env
HTTP_PORT=8080
HTTPS_PORT=8443
```

### CORS Configuration

The `CORS_ORIGIN` is automatically set based on `SERVER_HOST`, but you can override it:
```env
CORS_ORIGIN=http://192.168.1.100,http://tas-server.company.local
```

## Accessing the Application

### Admin Dashboard
- **URL:** `http://YOUR_SERVER_IP`
- **Default Login:** Use credentials created via `createAdmin.js` script

### API Endpoints
- **Base URL:** `http://YOUR_SERVER_IP/api`
- **Health Check:** `http://YOUR_SERVER_IP/health`

### Candidate Portal (if configured)
- **URL:** `http://YOUR_SERVER_IP:4002` (if not using nginx subpath)

## Creating Admin User

After deployment, create an admin user:

```powershell
docker-compose -f docker-compose.network.yml exec backend node scripts/createAdmin.js
```

Follow the prompts to create your admin account.

## Firewall Configuration

### Windows Firewall

```powershell
# Allow HTTP traffic
New-NetFirewallRule -DisplayName "TAS HTTP" -Direction Inbound -LocalPort 80 -Protocol TCP -Action Allow

# Allow HTTPS traffic (if using SSL)
New-NetFirewallRule -DisplayName "TAS HTTPS" -Direction Inbound -LocalPort 443 -Protocol TCP -Action Allow
```

### Linux (UFW)

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw reload
```

## SSL/HTTPS Setup (Optional)

If you want to use HTTPS:

1. Obtain SSL certificates (self-signed for internal use, or from your CA)

2. Create SSL directory:
   ```powershell
   mkdir nginx\ssl
   ```

3. Copy certificates:
   ```powershell
   Copy-Item cert.pem nginx\ssl\
   Copy-Item key.pem nginx\ssl\
   ```

4. Uncomment HTTPS server block in `nginx/nginx.network.conf`

5. Restart nginx:
   ```powershell
   docker-compose -f docker-compose.network.yml restart nginx
   ```

## Monitoring & Maintenance

### View Logs

```powershell
# All services
docker-compose -f docker-compose.network.yml logs -f

# Specific service
docker-compose -f docker-compose.network.yml logs -f backend
docker-compose -f docker-compose.network.yml logs -f frontend
```

### Restart Services

```powershell
# Restart all
docker-compose -f docker-compose.network.yml restart

# Restart specific service
docker-compose -f docker-compose.network.yml restart backend
```

### Update Application

```powershell
# Pull latest code (if using git)
git pull

# Rebuild and restart
docker-compose -f docker-compose.network.yml up -d --build

# Run migrations if needed
docker-compose -f docker-compose.network.yml exec backend npx prisma migrate deploy
```

### Backup Database

```powershell
# Create backup
docker-compose -f docker-compose.network.yml exec postgres pg_dump -U tas_user tas_db > backup_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql

# Restore backup
Get-Content backup_20241111_120000.sql | docker-compose -f docker-compose.network.yml exec -T postgres psql -U tas_user tas_db
```

## Troubleshooting

### Services Not Starting

1. Check logs:
   ```powershell
   docker-compose -f docker-compose.network.yml logs
   ```

2. Check if ports are in use:
   ```powershell
   netstat -ano | findstr :80
   ```

3. Verify environment variables:
   ```powershell
   Get-Content .env.network
   ```

### Cannot Access from Other Computers

1. Verify firewall rules are configured
2. Check if server IP is correct
3. Test connectivity:
   ```powershell
   # From another computer
   ping YOUR_SERVER_IP
   telnet YOUR_SERVER_IP 80
   ```

### Database Connection Errors

1. Check if PostgreSQL is running:
   ```powershell
   docker-compose -f docker-compose.network.yml ps postgres
   ```

2. Verify database password in `.env.network`
3. Check database logs:
   ```powershell
   docker-compose -f docker-compose.network.yml logs postgres
   ```

### CORS Errors

1. Verify `CORS_ORIGIN` in `.env.network` includes the URL you're accessing from
2. Restart backend:
   ```powershell
   docker-compose -f docker-compose.network.yml restart backend
   ```

## Security Considerations

1. **Change Default Passwords:** Ensure all passwords in `.env.network` are strong and unique
2. **Network Security:** Consider using VPN or restricting access to company network only
3. **SSL/HTTPS:** For production, always use HTTPS with valid certificates
4. **Regular Updates:** Keep Docker images and dependencies updated
5. **Backup Strategy:** Set up regular database backups

## Support

For issues or questions:
- Check logs: `docker-compose -f docker-compose.network.yml logs`
- Review this guide and `docs/DEPLOYMENT.md`
- Contact your system administrator

---

**Last Updated:** November 2024  
**Version:** 1.0.0

