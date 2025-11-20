# Quick Deployment Guide - Company Network

## 🚀 Quick Start (5 Minutes)

### Step 1: Configure Environment

```powershell
# Copy template
Copy-Item env.network.template .env.network

# Edit .env.network with your server IP
notepad .env.network
```

**Required changes in `.env.network`:**
- `SERVER_HOST` - Your server's IP address (e.g., `192.168.1.100`)
- `POSTGRES_PASSWORD` - Strong password for database
- `REDIS_PASSWORD` - Strong password for Redis
- `JWT_SECRET` - Generate with: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
- `JWT_REFRESH_SECRET` - Generate with: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
- `ENCRYPTION_KEY` - Generate with: `node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"`

### Step 2: Deploy

```powershell
.\deploy-network.ps1
```

### Step 3: Create Admin User

```powershell
docker-compose -f docker-compose.network.yml exec backend node scripts/createAdmin.js
```

### Step 4: Access Application

Open browser: `http://YOUR_SERVER_IP`

---

## 📋 What Gets Deployed

- **Admin Dashboard:** `http://YOUR_SERVER_IP`
- **API:** `http://YOUR_SERVER_IP/api`
- **Health Check:** `http://YOUR_SERVER_IP/health`

## 🔧 Common Commands

```powershell
# View logs
docker-compose -f docker-compose.network.yml logs -f

# Restart services
docker-compose -f docker-compose.network.yml restart

# Stop services
docker-compose -f docker-compose.network.yml down

# Update and redeploy
git pull
docker-compose -f docker-compose.network.yml up -d --build
```

## 🔒 Firewall Setup

**Windows:**
```powershell
New-NetFirewallRule -DisplayName "TAS HTTP" -Direction Inbound -LocalPort 80 -Protocol TCP -Action Allow
```

**Linux:**
```bash
sudo ufw allow 80/tcp
```

## 📚 Full Documentation

See `NETWORK_DEPLOYMENT.md` for detailed instructions.

