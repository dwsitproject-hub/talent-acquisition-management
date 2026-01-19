# Talent Acquisition System Deployment Guide

## Overview

This guide covers deploying the Talent Acquisition System across three environments:

### Environment Structure

1. **Local Environment** - Development on local machine
2. **Testing Environment** - AliCloud testing servers
   - **Frontend Server**: NGINX, Frontend, Candidate Portal
   - **Backend Server**: PostgreSQL, Redis, Backend API
3. **Production Environment** - AliCloud production servers
   - **Frontend Server**: NGINX, Frontend, Candidate Portal
   - **Backend Server**: PostgreSQL, Redis, Backend API

### Server Architecture

Each AliCloud environment consists of:
- **1 Frontend Server**: Hosts multiple applications (NGINX reverse proxy, Frontend admin dashboard, Candidate Portal)
- **1 Backend Server**: Hosts multiple services (PostgreSQL database, Redis cache, Backend API)

### Environment Files

The system uses separate environment files for each environment:
- `.env.local` - Local development
- `.env.testing` - Testing environment (AliCloud)
- `.env.production` - Production environment (AliCloud)

### Server Information

**Testing Environment:**
- Frontend Server IP: `[TESTING_FRONTEND_IP]` (SSH Port: `[TESTING_FRONTEND_SSH_PORT]`)
- Backend Server IP: `[TESTING_BACKEND_IP]` (SSH Port: `[TESTING_BACKEND_SSH_PORT]`)

**Production Environment:**
- Frontend Server IP: `147.139.176.70` (SSH Port: `1818`)
- Backend Server IP: `147.139.176.70` (SSH Port: `1819`)

---

## Quick Reference

### Environment Files

| Environment | File Name | Location |
|-------------|-----------|----------|
| Local | `.env.local` | Local development machine |
| Testing | `.env.testing` | Testing servers (`/opt/tas-testing`) |
| Production | `.env.production` | Production servers (`/opt/tas-production`) |

### Server Directory Structure

**Testing Environment:**
- Frontend Server: `/opt/tas-testing` (uses `.env.testing`)
- Backend Server: `/opt/tas-testing` (uses `.env.testing`)

**Production Environment:**
- Frontend Server: `/opt/tas-production` (uses `.env.production`)
- Backend Server: `/opt/tas-production` (uses `.env.production`)

### Docker Compose Commands

Always specify the environment file and project name (for isolation from other applications):

```bash
# Testing (isolated with project name)
docker compose -p tas-testing --env-file .env.testing <command>

# Production (isolated with project name)
docker compose -p tas-production --env-file .env.production <command>

# Local
docker compose --env-file .env.local <command>
```

**Why use project names?**
- Prevents container name conflicts with other applications
- Creates isolated Docker networks
- Creates isolated Docker volumes
- Ensures complete separation from other services on the same server

### Applications per Server

**Frontend Server hosts:**
- NGINX (reverse proxy)
- Frontend (Admin Dashboard)
- Candidate Portal

**Backend Server hosts:**
- PostgreSQL (database)
- Redis (cache)
- Backend API

---

## Prerequisites

### 1. GitHub Authentication Setup

GitHub no longer supports password authentication. You need to use either:
- **Personal Access Token (PAT)** - Recommended for quick setup
- **SSH Keys** - Recommended for production servers

#### Option A: Using Personal Access Token (Quick Setup)

1. **Create a Personal Access Token on GitHub:**
   - Go to: https://github.com/settings/tokens
   - Click "Generate new token" → "Generate new token (classic)"
   - Name it: `AliCloud Deployment`
   - Select scopes: `repo` (full control of private repositories)
   - Click "Generate token"
   - **Copy the token immediately** (you won't see it again!)

2. **On the server, clone using the token:**
   ```bash
   git clone -b main https://jerrypra0906:<YOUR_TOKEN>@github.com/jerrypra0906/talent-acquisition-management.git tas
   ```
   
   Replace `<YOUR_TOKEN>` with your actual token.

#### Option B: Using SSH Keys (Recommended for Production)

1. **Generate SSH key on your local machine (if you don't have one):**
   ```bash
   ssh-keygen -t ed25519 -C "your_email@example.com"
   # Press Enter to accept default location
   # Optionally set a passphrase
   ```

2. **Add SSH key to GitHub:**
   ```bash
   # Copy your public key (Linux/Mac)
   cat ~/.ssh/id_ed25519.pub
   
   # Or on Windows (PowerShell):
   Get-Content $env:USERPROFILE\.ssh\id_ed25519.pub
   
   # Or on Windows (CMD):
   type %USERPROFILE%\.ssh\id_ed25519.pub
   ```
   
   - Go to: https://github.com/settings/keys
   - Click "New SSH key"
   - Paste your public key
   - Save

3. **Copy SSH key to AliCloud servers:**
   ```bash
   # Testing environment
   ssh-copy-id -p <TESTING_FRONTEND_SSH_PORT> root@<TESTING_FRONTEND_IP>
   ssh-copy-id -p <TESTING_BACKEND_SSH_PORT> root@<TESTING_BACKEND_IP>
   
   # Production environment
   ssh-copy-id -p 1818 root@147.139.176.70
   ssh-copy-id -p 1819 root@147.139.176.70
   ```

4. **On the servers, clone using SSH:**
   ```bash
   git clone -b main git@github.com:jerrypra0906/talent-acquisition-management.git tas
   ```

---

## Local Environment Setup

### Overview

The local environment is for development on your local machine. All services run locally using Docker Compose.

### Step 1: Clone Repository

```bash
# Clone repository
git clone -b main git@github.com:jerrypra0906/talent-acquisition-management.git tas
cd tas
```

### Step 2: Create Local Environment File

```bash
# Copy template
cp env.network.template .env.local

# Edit environment file
nano .env.local
```

**Required environment variables for local:**

```env
# Server Configuration
SERVER_HOST=localhost

# Database Configuration
POSTGRES_PASSWORD=local_dev_password
DATABASE_URL=postgresql://tas_user:local_dev_password@postgres:5432/tas_db

# Redis Configuration
REDIS_PASSWORD=local_dev_password
REDIS_URL=redis://:local_dev_password@redis:6379

# JWT Secrets (64 characters each)
JWT_SECRET=<Generate 64-char hex string>
JWT_REFRESH_SECRET=<Generate 64-char hex string>

# Encryption Key (MUST be exactly 32 characters)
ENCRYPTION_KEY=<Generate 32-char hex string>

# Application URLs
FRONTEND_URL=http://localhost:3000
CANDIDATE_PORTAL_URL=http://localhost:4002
CORS_ORIGIN=http://localhost:3000,http://localhost:4001,http://localhost:4002
API_BASE_URL=http://localhost:4000/api
NEXT_PUBLIC_API_URL=http://localhost:4000/api

# Email Configuration (Optional - use local SMTP or mailtrap)
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=your-mailtrap-user
SMTP_PASSWORD=your-mailtrap-password
SMTP_FROM_NAME=KPN Talent Acquisition
SMTP_FROM_EMAIL=noreply@localhost
```

### Step 3: Start Local Services

```bash
# Export environment variables
export $(cat .env.local | grep -v '^#' | xargs)

# Start all services
docker compose --env-file .env.local up -d

# Check status
docker compose ps

# View logs
docker compose logs -f
```

### Step 4: Run Database Migrations

```bash
# Wait for database to be ready
sleep 10

# Run migrations
docker compose exec backend npx prisma migrate dev

# Generate Prisma client
docker compose exec backend npx prisma generate
```

### Step 5: Access Local Services

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:4000
- **Candidate Portal**: http://localhost:4002
- **API Health**: http://localhost:4000/health

---

## AliCloud Server Setup

### Initial Setup (All AliCloud Servers)

SSH into each server (testing and production) and run:

```bash
# Update system
apt update && apt upgrade -y

# Install required packages
apt install -y ca-certificates curl gnupg git openssh-client

# Install Docker
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker

# Install Docker Compose plugin
mkdir -p /usr/lib/docker/cli-plugins
curl -SL "https://github.com/docker/compose/releases/download/v2.31.0/docker-compose-linux-x86_64" -o /usr/lib/docker/cli-plugins/docker-compose
chmod +x /usr/lib/docker/cli-plugins/docker-compose

# Verify installations
docker --version
docker compose version
```

---

## Testing Environment Deployment

### Testing Backend Server Setup

#### Step 1: Clone Repository

```bash
ssh -p <TESTING_BACKEND_SSH_PORT> root@<TESTING_BACKEND_IP>

# Navigate to deployment directory
cd /opt

# Clone repository (choose one method):
# Option A: Using Personal Access Token
git clone -b main https://jerrypra0906:<YOUR_TOKEN>@github.com/jerrypra0906/talent-acquisition-management.git tas-testing

# Option B: Using SSH (if SSH keys are set up)
git clone -b main git@github.com:jerrypra0906/talent-acquisition-management.git tas-testing

cd tas-testing
```

#### Step 2: Create Testing Environment File

```bash
# Copy template
cp env.network.template .env.testing

# Edit environment file
nano .env.testing
```

**Required environment variables for testing:**

```env
# Server Configuration
SERVER_HOST=<TESTING_FRONTEND_IP>

# Database Configuration
POSTGRES_PASSWORD=<Generate strong password>
# Generate with: openssl rand -base64 32

# Redis Configuration
REDIS_PASSWORD=<Generate strong password>
# Generate with: openssl rand -base64 32

# JWT Secrets (64 characters each)
JWT_SECRET=<Generate 64-char hex string>
# Generate with: openssl rand -hex 32

JWT_REFRESH_SECRET=<Generate 64-char hex string>
# Generate with: openssl rand -hex 32

# Encryption Key (MUST be exactly 32 characters)
ENCRYPTION_KEY=<Generate 32-char hex string>
# Generate with: openssl rand -hex 16

# Application URLs (Testing)
FRONTEND_URL=http://<TESTING_FRONTEND_IP>
CANDIDATE_PORTAL_URL=http://<TESTING_FRONTEND_IP>:4002
CORS_ORIGIN=http://<TESTING_FRONTEND_IP>,http://<TESTING_FRONTEND_IP>:4001,http://<TESTING_FRONTEND_IP>:4002
API_BASE_URL=http://<TESTING_BACKEND_IP>:4000/api

# Email Configuration (Optional - use testing SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_NAME=KPN Talent Acquisition (Testing)
SMTP_FROM_EMAIL=noreply-testing@example.com
```

**Quick secret generation commands:**

```bash
# Generate all secrets at once
echo "POSTGRES_PASSWORD=$(openssl rand -base64 32)"
echo "REDIS_PASSWORD=$(openssl rand -base64 32)"
echo "JWT_SECRET=$(openssl rand -hex 32)"
echo "JWT_REFRESH_SECRET=$(openssl rand -hex 32)"
echo "ENCRYPTION_KEY=$(openssl rand -hex 16)"
```

#### Step 3: Start Backend Services

```bash
cd /opt/tas-testing

# Export environment variables
export $(cat .env.testing | grep -v '^#' | xargs)

# Start PostgreSQL, Redis, and Backend
docker compose --env-file .env.testing up -d postgres redis backend

# Check status
docker compose ps

# View logs
docker compose logs -f backend
```

#### Step 4: Run Database Migrations

```bash
# Wait for database to be ready (about 10-15 seconds)
sleep 15

# Run migrations
docker compose exec backend npx prisma migrate deploy

# Generate Prisma client
docker compose exec backend npx prisma generate
```

#### Step 5: Create Testing User

```bash
docker compose exec backend node scripts/createProductionUser.js
```

**⚠️ IMPORTANT**: Change the password immediately after first login!

#### Step 6: Verify Backend Health

```bash
# Test health endpoint
curl http://localhost:4000/health

# Should return JSON with success: true
```

#### Step 7: Configure Firewall

```bash
# Allow port 4000 from frontend server only
ufw allow from <TESTING_FRONTEND_IP> to any port 4000 proto tcp

# Or allow from anywhere (for testing)
ufw allow 4000/tcp

# Enable firewall
ufw enable
```

### Testing Frontend Server Setup

#### Step 1: Clone Repository

```bash
ssh -p <TESTING_FRONTEND_SSH_PORT> root@<TESTING_FRONTEND_IP>

# Navigate to deployment directory
cd /opt

# Clone repository (same as backend server)
# Option A: Using Personal Access Token
git clone https://jerrypra0906:<YOUR_TOKEN>@github.com/jerrypra0906/talent-acquisition-management.git tas-testing

# Option B: Using SSH
git clone git@github.com:jerrypra0906/talent-acquisition-management.git tas-testing

cd tas-testing
```

#### Step 2: Create Testing Environment File

```bash
# Copy template
cp env.network.template .env.testing

# Edit environment file
nano .env.testing
```

**Required environment variables for testing frontend:**

```env
# Server Configuration
SERVER_HOST=<TESTING_FRONTEND_IP>

# Port Configuration
HTTP_PORT=80
HTTPS_PORT=443

# API URL (points to testing backend server)
NEXT_PUBLIC_API_URL=http://<TESTING_BACKEND_IP>:4000/api

# CORS (must match backend configuration)
CORS_ORIGIN=http://<TESTING_FRONTEND_IP>,http://<TESTING_FRONTEND_IP>:4001,http://<TESTING_FRONTEND_IP>:4002
FRONTEND_URL=http://<TESTING_FRONTEND_IP>
CANDIDATE_PORTAL_URL=http://<TESTING_FRONTEND_IP>:4002
```

#### Step 3: Configure NGINX

Edit `nginx/nginx.conf` to point to testing backend server:

```bash
nano nginx/nginx.conf
```

**Update the backend upstream:**

```nginx
# Backend API upstream (Testing)
upstream backend {
    least_conn;
    server <TESTING_BACKEND_IP>:4000 max_fails=3 fail_timeout=30s;
}
```

**For HTTP-only deployment (no SSL), update server blocks:**

```nginx
# Main HTTP server (for testing without SSL initially)
server {
    listen 80;
    server_name _;

    # API routes
    location /api/ {
        limit_req zone=api_limit burst=20 nodelay;
        
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Login endpoint (stricter rate limit)
    location /api/auth/login {
        limit_req zone=login_limit burst=5 nodelay;
        
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Health check
    location /health {
        proxy_pass http://backend;
        access_log off;
    }

    # Frontend (Admin Dashboard)
    location / {
        proxy_pass http://frontend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Candidate Portal (optional - if using subpath)
    location /careers {
        proxy_pass http://candidate-portal;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### Step 4: Start Frontend Services

```bash
cd /opt/tas-testing

# Export environment variables
export $(cat .env.testing | grep -v '^#' | xargs)

# Start Frontend, Candidate Portal, and NGINX
docker compose --env-file .env.testing up -d frontend candidate-portal nginx

# Check status
docker compose ps

# View logs
docker compose logs -f nginx
docker compose logs -f frontend
```

#### Step 5: Configure Firewall

```bash
# Allow HTTP and HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Enable firewall
ufw enable
```

---

## Production Environment Deployment

### ⚠️ Pre-Deployment Checklist: Ensuring Isolation from Other Applications

**IMPORTANT**: Since other applications are already running on these servers, follow this checklist to ensure no conflicts:

**Note:** You can perform these checks before or after cloning the repository. Some checks (like directory verification) are optional if the directory doesn't exist yet - it will be created during the clone step.

#### Step 1: Check for Port Conflicts

Before deploying, check which ports are already in use:

```bash
# Check all listening ports
netstat -tulpn | grep LISTEN
# Or using ss:
ss -tulpn | grep LISTEN

# Check specific ports this application uses:
# - 5432 (PostgreSQL)
# - 6379 (Redis)
# - 4000 (Backend API)
# - 4001 (Frontend)
# - 4002 (Candidate Portal)
# - 80 (NGINX HTTP)
# - 443 (NGINX HTTPS)

# Check if ports are in use
lsof -i :5432  # PostgreSQL
lsof -i :6379  # Redis
lsof -i :4000  # Backend
lsof -i :4001  # Frontend
lsof -i :4002  # Candidate Portal
lsof -i :80    # NGINX HTTP
lsof -i :443   # NGINX HTTPS
```

**⚠️ KNOWN PORT CONFLICTS (Production Servers):**

Based on current server configuration:

**Frontend Server (ECS-App):**
- ✅ Port 80: **CONFLICT** - Already in use by another docker-proxy application
- ✅ Port 443: Available (not shown in netstat, likely available)
- ✅ Port 4001: Available (for Frontend)
- ✅ Port 4002: Available (for Candidate Portal)

**Backend Server (ECS-DB):**
- ✅ Port 3000: **IN USE** - Already in use by another docker-proxy (not needed by TAS)
- ✅ Port 5434: **IN USE** - Already in use by another PostgreSQL instance (TAS uses 5432, should be OK)
- ✅ Port 4000: Available (for Backend API)
- ✅ Port 5432: Available (for TAS PostgreSQL - different from 5434)
- ✅ Port 6379: Available (for Redis)

**Solution for Port 80 Conflict:**

Since port 80 is already in use on the frontend server, we have two options:

**Option A: Use Alternative Port for NGINX (Recommended)**
- Use port 8080 for HTTP and 8443 for HTTPS
- Configure existing reverse proxy/load balancer to route to port 8080
- Or access directly via `http://147.139.176.70:8080`

**Option B: Use Internal Networking Only**
- Remove port 80/443 mapping from NGINX
- Access services via existing reverse proxy that routes to internal Docker network
- Requires configuration of existing infrastructure

**If ports are in use**, you have two options:
1. **Use different ports** (recommended if other apps need standard ports)
2. **Use Docker internal networking** (containers communicate internally, only expose necessary ports)

#### Step 2: Check for Existing Docker Containers

```bash
# List all running containers
docker ps -a

# Check for containers with conflicting names:
# - tas_postgres
# - tas_redis
# - tas_backend
# - tas_frontend
# - tas_candidate_portal
# - tas_nginx

# If any of these exist, you'll need to either:
# 1. Stop/remove them (if they're old/unused)
# 2. Use a different project name (see Step 3)
```

#### Step 3: Use Docker Compose Project Name for Isolation

To ensure complete isolation, use a project-specific name:

```bash
# Set project name to avoid conflicts
export COMPOSE_PROJECT_NAME=tas-production

# Or use -p flag with all docker compose commands:
docker compose -p tas-production --env-file .env.production <command>
```

This ensures:
- Container names become: `tas-production-tas_postgres-1` instead of `tas_postgres`
- Network becomes: `tas-production_tas_network` instead of `tas_network`
- Volumes become: `tas-production_postgres_data` instead of `postgres_data`

#### Step 4: Check for Existing Docker Networks

```bash
# List all Docker networks
docker network ls

# Check if tas_network exists
docker network inspect tas_network 2>/dev/null || echo "Network does not exist"

# If network exists and is used by other apps, Docker Compose will create:
# tas-production_tas_network (isolated network)
```

#### Step 5: Check for Existing Docker Volumes

```bash
# List all Docker volumes
docker volume ls

# Check for existing volumes:
# - postgres_data
# - redis_data

# If volumes exist, Docker Compose will create project-specific volumes:
# - tas-production_postgres_data
# - tas-production_redis_data
```

#### Step 6: Verify Directory Isolation

```bash
# Check if deployment directory already exists
if [ -d "/opt/tas-production" ]; then
    echo "Directory /opt/tas-production already exists"
    cd /opt/tas-production
    ls -la
else
    echo "Directory /opt/tas-production does not exist yet (will be created during deployment)"
fi

# Verify no other application is using /opt/ directory
ls -la /opt/

# Check for any existing TAS-related directories
ls -la /opt/ | grep -i tas
```

**Note:** The `/opt/tas-production` directory will be created when you clone the repository in Step 1 of the deployment. This check is to verify there are no conflicts if the directory already exists from a previous deployment.

#### Step 7: Configure Non-Standard Ports (If Needed)

If ports 80, 443, 4000, 4001, 4002, 5432, or 6379 are already in use, update `.env.production`:

```env
# Use alternative ports (example)
HTTP_PORT=8080
HTTPS_PORT=8443
# Backend will use internal port 4000, but can be accessed via NGINX only
# Frontend and Candidate Portal use internal ports, accessed via NGINX
```

Then update `docker-compose.network.yml` or create a custom compose file with different port mappings.

#### Step 8: Use Internal-Only Ports (Recommended)

For maximum isolation, configure services to only expose ports internally:

**Backend Server**: Only expose PostgreSQL and Redis internally (no external ports):
- PostgreSQL: Remove port mapping (only accessible within Docker network)
- Redis: Remove port mapping (only accessible within Docker network)
- Backend API: Only accessible from frontend server via internal network

**Frontend Server**: Use NGINX as the only entry point:
- NGINX: Expose ports 80/443
- Frontend, Candidate Portal, Backend: Only accessible via NGINX (internal network)

This way, only NGINX needs ports 80/443, and all other services communicate internally.

---

### Production Environment Deployment Summary

**Current Port Status:**

**Frontend Server (ECS-App):**
- ⚠️ Port 80: **IN USE** by another docker-proxy → TAS will use port **8080**
- ✅ Port 443: Available (or can use 8443)
- ✅ Port 4001: Available (Frontend)
- ✅ Port 4002: Available (Candidate Portal)

**Backend Server (ECS-DB):**
- ✅ Port 4000: Available (Backend API)
- ✅ Port 5432: Available (TAS PostgreSQL - other app uses 5434, no conflict)
- ✅ Port 6379: Available (TAS Redis)
- ⚠️ Port 3000: In use by another app (not needed by TAS)
- ⚠️ Port 5434: In use by another PostgreSQL (TAS uses 5432, no conflict)

**Access URLs:**
- Frontend: `http://tas.energi-up.com:8080` (Domain) or `http://147.139.176.70:8080` (IP)
- Backend API: `http://8.215.56.98:4000` (Backend server IP: 8.215.56.98)
- Candidate Portal: `http://147.139.176.70:4002`

**⚠️ Domain Configuration:**
- Domain name: `tas.energi-up.com`
- Ensure DNS A record points `tas.energi-up.com` to `147.139.176.70`
- NGINX is configured to accept both domain and IP access

---

### Production Backend Server Setup

#### Step 1: Clone Repository

```bash
ssh -p 1819 root@147.139.176.70

# Navigate to deployment directory
cd /opt

# Clone repository (choose one method):
# Option A: Using Personal Access Token
git clone -b main https://jerrypra0906:<YOUR_TOKEN>@github.com/jerrypra0906/talent-acquisition-management.git tas-production

# Option B: Using SSH (if SSH keys are set up)
git clone -b main git@github.com:jerrypra0906/talent-acquisition-management.git tas-production

cd tas-production
```

#### Step 2: Create Production Environment File

```bash
# Copy template
cp env.network.template .env.production

# Edit environment file
nano .env.production
```

**Required environment variables for production:**

**⚠️ Port Status on Backend Server:**
- ✅ Port 5432: Available (TAS PostgreSQL - other app uses 5434)
- ✅ Port 6379: Available (TAS Redis)
- ✅ Port 4000: Available (TAS Backend API)
- ⚠️ Port 3000: In use by another app (not needed by TAS)
- ⚠️ Port 5434: In use by another PostgreSQL instance (TAS uses 5432, no conflict)

```env
# Server Configuration
SERVER_HOST=147.139.176.70

# Database Configuration
POSTGRES_PASSWORD=<Generate strong password>
# Generate with: openssl rand -base64 32

# Redis Configuration
REDIS_PASSWORD=<Generate strong password>
# Generate with: openssl rand -base64 32

# JWT Secrets (64 characters each)
JWT_SECRET=<Generate 64-char hex string>
# Generate with: openssl rand -hex 32

JWT_REFRESH_SECRET=<Generate 64-char hex string>
# Generate with: openssl rand -hex 32

# Encryption Key (MUST be exactly 32 characters)
ENCRYPTION_KEY=<Generate 32-char hex string>
# Generate with: openssl rand -hex 16

# Application URLs (Production)
# Note: Frontend uses port 8080 due to port 80 conflict
# Using domain name: tas.energi-up.com
FRONTEND_URL=http://tas.energi-up.com:8080
CANDIDATE_PORTAL_URL=http://147.139.176.70:4002
# CORS: Include both domain and IP for flexibility
CORS_ORIGIN=http://tas.energi-up.com:8080,http://147.139.176.70:8080,http://147.139.176.70:4001,http://147.139.176.70:4002
API_BASE_URL=http://8.215.56.98:4000/api

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_NAME=KPN Talent Acquisition
SMTP_FROM_EMAIL=noreply@example.com
```

**Quick secret generation commands:**

```bash
# Generate all secrets at once
echo "POSTGRES_PASSWORD=$(openssl rand -base64 32)"
echo "REDIS_PASSWORD=$(openssl rand -base64 32)"
echo "JWT_SECRET=$(openssl rand -hex 32)"
echo "JWT_REFRESH_SECRET=$(openssl rand -hex 32)"
echo "ENCRYPTION_KEY=$(openssl rand -hex 16)"
```

**⚠️ IMPORTANT: Docker Compose File**

For production deployment, you must use `docker-compose.network.yml`:
- This file is configured for network-based deployment
- It uses environment variable substitution (e.g., `${POSTGRES_PASSWORD}`)
- Always use `-f docker-compose.network.yml` flag with docker compose commands

#### Step 3: Prepare Directories and Fix Permissions

**⚠️ IMPORTANT: Create directories and set permissions before starting containers**

```bash
cd /opt/tas-production

# Create logs and uploads directories if they don't exist
mkdir -p backend/logs backend/uploads

# Set proper permissions (allow container user to write)
# Most Node.js containers run as user ID 1000 or node user
chmod 777 backend/logs backend/uploads

# Or set ownership to match container user (if you know the UID)
# chown -R 1000:1000 backend/logs backend/uploads

# Verify directories exist
ls -la backend/
```

#### Step 4: Verify Database Setup

**⚠️ CRITICAL: Verify database exists and password is correct before starting backend**

```bash
cd /opt/tas-production

# Get POSTGRES_PASSWORD from .env.production
POSTGRES_PASSWORD=$(grep '^POSTGRES_PASSWORD=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)

# Ensure PostgreSQL is running
docker compose -p tas-production up -d postgres
sleep 5

# Step 1: Test connection with password from .env.production
echo "=== Testing PostgreSQL connection ==="
docker compose -p tas-production exec postgres psql -U tas_user -d tas_db -c "SELECT version();" 2>&1
if [ $? -eq 0 ]; then
  echo "✅ PostgreSQL connection successful"
else
  echo "❌ Cannot connect to PostgreSQL"
  echo "   This could mean:"
  echo "   1. Password in .env.production doesn't match PostgreSQL container"
  echo "   2. Database 'tas_db' doesn't exist"
  echo "   3. User 'tas_user' doesn't exist"
fi

# Step 2: Check if database exists
echo ""
echo "=== Checking if database exists ==="
docker compose -p tas-production exec postgres psql -U postgres -c "\l" | grep tas_db || echo "❌ Database 'tas_db' not found"

# Step 3: Check if user exists
echo ""
echo "=== Checking if user exists ==="
docker compose -p tas-production exec postgres psql -U postgres -c "\du" | grep tas_user || echo "❌ User 'tas_user' not found"

# Step 4: Test connection with exact DATABASE_URL format
echo ""
echo "=== Testing with exact DATABASE_URL format ==="
DATABASE_URL_TEST="postgresql://tas_user:${POSTGRES_PASSWORD}@postgres:5432/tas_db"
docker compose -p tas-production exec backend sh -c "PGPASSWORD='${POSTGRES_PASSWORD}' psql -h postgres -U tas_user -d tas_db -c 'SELECT 1;'" 2>&1 || echo "❌ Connection test failed"
```

**If database or user doesn't exist, you need to initialize the database first (see Step 5: Run Database Migrations)**

#### Step 5: Start Backend Services

**⚠️ IMPORTANT: Ensure you're using the correct docker-compose file**

The deployment uses `docker-compose.network.yml` which requires environment variables to be properly set.

```bash
cd /opt/tas-production

# Set project name for isolation (prevents conflicts with other apps)
export COMPOSE_PROJECT_NAME=tas-production

# Export environment variables (needed for docker-compose variable substitution)
# Method: Manually export each variable with proper quoting (handles special characters safely)
export POSTGRES_PASSWORD="$(grep '^POSTGRES_PASSWORD=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)"
export REDIS_PASSWORD="$(grep '^REDIS_PASSWORD=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)"
export JWT_SECRET="$(grep '^JWT_SECRET=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)"
export JWT_REFRESH_SECRET="$(grep '^JWT_REFRESH_SECRET=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)"
export ENCRYPTION_KEY="$(grep '^ENCRYPTION_KEY=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)"
export FRONTEND_URL="$(grep '^FRONTEND_URL=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)"
export CANDIDATE_PORTAL_URL="$(grep '^CANDIDATE_PORTAL_URL=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)"
export CORS_ORIGIN="$(grep '^CORS_ORIGIN=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)"

# Verify critical variables are exported
if [ -z "$POSTGRES_PASSWORD" ] || [ -z "$REDIS_PASSWORD" ]; then
  echo "⚠️  WARNING: Some environment variables may not be set correctly"
  echo "   POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:+SET}"
  echo "   REDIS_PASSWORD: ${REDIS_PASSWORD:+SET}"
else
  echo "✅ Environment variables exported successfully"
  echo "   POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:0:10}..."
  echo "   REDIS_PASSWORD: ${REDIS_PASSWORD:0:10}..."
fi

# Verify critical environment variables are set
echo "POSTGRES_PASSWORD is set: $([ -n "$POSTGRES_PASSWORD" ] && echo 'YES' || echo 'NO')"
echo "REDIS_PASSWORD is set: $([ -n "$REDIS_PASSWORD" ] && echo 'YES' || echo 'NO')"
echo "JWT_SECRET is set: $([ -n "$JWT_SECRET" ] && echo 'YES' || echo 'NO')"

# If export failed, manually export critical variables (alternative method):
# export POSTGRES_PASSWORD="your_password_here"
# export REDIS_PASSWORD="your_password_here"
# export JWT_SECRET="your_jwt_secret_here"
# export JWT_REFRESH_SECRET="your_refresh_secret_here"
# export ENCRYPTION_KEY="your_encryption_key_here"
# export FRONTEND_URL="http://147.139.176.70:8080"
# export CANDIDATE_PORTAL_URL="http://147.139.176.70:4002"
# export CORS_ORIGIN="http://147.139.176.70:8080,http://147.139.176.70:4001,http://147.139.176.70:4002"

# ⚠️ IMPORTANT: Set up DATABASE_URL with URL-encoded password first
# This handles special characters in POSTGRES_PASSWORD (like /, @, etc.)
if [ -f "scripts/setup-database-url.sh" ]; then
  echo "Using helper script to set up DATABASE_URL..."
  chmod +x scripts/setup-database-url.sh
  source scripts/setup-database-url.sh .env.production
  OVERRIDE_FLAG="-f /tmp/docker-compose.override.yml"
else
  echo "⚠️  Helper script not found. Using manual URL encoding..."
  POSTGRES_PASSWORD=$(grep '^POSTGRES_PASSWORD=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)
  if command -v python3 >/dev/null 2>&1; then
    POSTGRES_PASSWORD_ENCODED=$(python3 -c "import urllib.parse; print(urllib.parse.quote('${POSTGRES_PASSWORD}', safe=''))")
  elif command -v node >/dev/null 2>&1; then
    POSTGRES_PASSWORD_ENCODED=$(node -e "console.log(encodeURIComponent('${POSTGRES_PASSWORD}'))")
  else
    POSTGRES_PASSWORD_ENCODED=$(echo "${POSTGRES_PASSWORD}" | sed 's|/|%2F|g' | sed 's|@|%40|g' | sed 's|:|%3A|g' | sed 's|#|%23|g' | sed 's|?|%3F|g' | sed 's|&|%26|g' | sed 's|=|%3D|g')
  fi
  DATABASE_URL_VALUE="postgresql://tas_user:${POSTGRES_PASSWORD_ENCODED}@postgres:5432/tas_db?schema=public&pool_timeout=0&connection_limit=20"
  printf 'services:\n  backend:\n    environment:\n      DATABASE_URL: "%s"\n' "${DATABASE_URL_VALUE}" > /tmp/docker-compose.override.yml
  OVERRIDE_FLAG="-f /tmp/docker-compose.override.yml"
fi

# Start PostgreSQL, Redis, and Backend
# Using -f flag to specify docker-compose.network.yml and -p for project name
# Include override file if it was created
docker compose -f docker-compose.network.yml ${OVERRIDE_FLAG} -p tas-production --env-file .env.production up -d postgres redis backend

# Check status (only shows containers from this project)
docker compose -p tas-production ps

# View logs
docker compose -p tas-production logs -f backend

# Verify containers are isolated (check container names)
docker ps --filter "name=tas-production"
```

**🔍 FIRST: Diagnose the issue - Check if DATABASE_URL is set in the container:**

```bash
# Check if DATABASE_URL exists in the container
docker compose -p tas-production exec backend printenv DATABASE_URL

# If empty, check all environment variables
docker compose -p tas-production exec backend env | grep -E "(DATABASE|POSTGRES|REDIS)" | sort

# Check what docker-compose is actually passing (before substitution)
docker compose -f docker-compose.network.yml -p tas-production --env-file .env.production config | grep -A 2 "DATABASE_URL"
```

**If DATABASE_URL is empty or shows `${POSTGRES_PASSWORD}` (not substituted):**

The variable substitution didn't work. Use the **QUICK FIX** below.

**⚡ QUICK FIX: Set DATABASE_URL directly (Recommended if variable substitution fails):**

```bash
cd /opt/tas-production

# Get POSTGRES_PASSWORD from .env.production
POSTGRES_PASSWORD=$(grep '^POSTGRES_PASSWORD=' .env.production | cut -d= -f2 | sed 's/#.*$//' | xargs)

# Construct and export DATABASE_URL
export DATABASE_URL="postgresql://tas_user:${POSTGRES_PASSWORD}@postgres:5432/tas_db?schema=public&pool_timeout=0&connection_limit=20"

# Also export other required variables (robust method that handles special characters)
# Method: Manually export only the critical variables we need
export REDIS_PASSWORD="$(grep '^REDIS_PASSWORD=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)"
export JWT_SECRET="$(grep '^JWT_SECRET=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)"
export JWT_REFRESH_SECRET="$(grep '^JWT_REFRESH_SECRET=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)"
export ENCRYPTION_KEY="$(grep '^ENCRYPTION_KEY=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)"
export FRONTEND_URL="$(grep '^FRONTEND_URL=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)"
export CANDIDATE_PORTAL_URL="$(grep '^CANDIDATE_PORTAL_URL=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)"
export CORS_ORIGIN="$(grep '^CORS_ORIGIN=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)"

# Verify critical variables are set
echo "POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:0:10}..."
echo "REDIS_PASSWORD: ${REDIS_PASSWORD:0:10}..."

# Verify DATABASE_URL is set in shell
echo "DATABASE_URL in shell: ${DATABASE_URL:0:50}..."

# CRITICAL: Verify what docker-compose will actually pass to the container
echo ""
echo "Checking what docker-compose will pass to backend container..."
docker compose -f docker-compose.network.yml -p tas-production --env-file .env.production config | grep -A 10 "backend:" | grep -A 5 "DATABASE_URL"
echo ""

# If DATABASE_URL shows ${POSTGRES_PASSWORD} (not substituted), the substitution failed
# In that case, we need to ensure POSTGRES_PASSWORD is exported
if docker compose -f docker-compose.network.yml -p tas-production --env-file .env.production config | grep "DATABASE_URL" | grep -q '\${POSTGRES_PASSWORD}'; then
  echo "⚠️  WARNING: DATABASE_URL still contains \${POSTGRES_PASSWORD} - substitution didn't work"
  echo "   Ensuring POSTGRES_PASSWORD is exported..."
  export POSTGRES_PASSWORD="$(grep '^POSTGRES_PASSWORD=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)"
  echo "   POSTGRES_PASSWORD exported: ${POSTGRES_PASSWORD:0:10}..."
fi

# Restart backend with DATABASE_URL in environment
docker compose -p tas-production stop backend

# CRITICAL: Create override file to ensure DATABASE_URL is set
# Get POSTGRES_PASSWORD and construct DATABASE_URL
POSTGRES_PASSWORD=$(grep '^POSTGRES_PASSWORD=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)

# URL-encode the password (special characters like /, @, :, etc. need encoding)
# Using Python for URL encoding (available on most systems)
POSTGRES_PASSWORD_ENCODED=$(python3 -c "import urllib.parse; print(urllib.parse.quote('${POSTGRES_PASSWORD}', safe=''))" 2>/dev/null || echo "${POSTGRES_PASSWORD}")

# If Python not available, try Node.js
if [ "$POSTGRES_PASSWORD_ENCODED" = "$POSTGRES_PASSWORD" ] && command -v node >/dev/null 2>&1; then
  POSTGRES_PASSWORD_ENCODED=$(node -e "console.log(encodeURIComponent('${POSTGRES_PASSWORD}'))" 2>/dev/null || echo "${POSTGRES_PASSWORD}")
fi

# Construct DATABASE_URL with URL-encoded password
DATABASE_URL_VALUE="postgresql://tas_user:${POSTGRES_PASSWORD_ENCODED}@postgres:5432/tas_db?schema=public&pool_timeout=0&connection_limit=20"

# Export for docker-compose variable substitution
export DATABASE_URL="$DATABASE_URL_VALUE"
export POSTGRES_PASSWORD="$POSTGRES_PASSWORD"

# Create override file that explicitly sets DATABASE_URL
# Use printf to ensure proper variable expansion
printf 'services:\n  backend:\n    environment:\n      DATABASE_URL: "%s"\n' "${DATABASE_URL_VALUE}" > /tmp/docker-compose.override.yml

# Verify the file was created correctly
echo "Override file created. Content:"
cat /tmp/docker-compose.override.yml
echo ""

# CRITICAL: Stop and remove the restarting container first
echo ""
echo "=== Stopping restarting container ==="
docker compose -p tas-production stop backend
docker compose -p tas-production rm -f backend

# Verify override file content
echo ""
echo "=== Override file content ==="
cat /tmp/docker-compose.override.yml

# Verify what docker-compose will actually pass (check backend service specifically)
echo ""
echo "=== Verifying backend service configuration ==="
docker compose -f docker-compose.network.yml -f /tmp/docker-compose.override.yml -p tas-production --env-file .env.production config 2>/dev/null | grep -A 50 "^  backend:" | grep -A 25 "environment:" | head -30

# Start with override file (this ensures DATABASE_URL is set)
echo ""
echo "=== Starting backend with override file ==="
docker compose -f docker-compose.network.yml -f /tmp/docker-compose.override.yml -p tas-production --env-file .env.production up -d backend

# Clean up override file (optional - can keep it for future restarts)
# rm /tmp/docker-compose.override.yml

# Verify it's now in the container
# Wait for container to be running (not restarting)
echo ""
echo "=== Waiting for container to be ready ==="
for i in {1..30}; do
  STATUS=$(docker compose -p tas-production ps backend --format json 2>/dev/null | grep -o '"State":"[^"]*"' | cut -d'"' -f4 || echo "")
  if [ "$STATUS" = "running" ]; then
    echo "✅ Container is running"
    break
  elif [ "$STATUS" = "restarting" ]; then
    echo "⚠️  Container is restarting... ($i/30)"
    if [ $i -eq 10 ]; then
      echo "   Checking logs to see why it's restarting..."
      docker compose -p tas-production logs --tail=20 backend | grep -E "(error|Error|ERROR|Database|DATABASE)" | head -10
    fi
  else
    echo "Waiting... ($i/30) Status: $STATUS"
  fi
  sleep 2
done

# Check container status
docker compose -p tas-production ps backend

# If container is restarting, check logs first
if docker compose -p tas-production ps backend | grep -q "Restarting"; then
  echo "⚠️  Container is restarting. Checking logs..."
  docker compose -p tas-production logs --tail=50 backend
  echo ""
  echo "🔧 FIXING: DATABASE_URL is not set. Applying fix..."
  
  # Stop container
  docker compose -p tas-production stop backend
  
  # Get POSTGRES_PASSWORD
  POSTGRES_PASSWORD=$(grep '^POSTGRES_PASSWORD=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)
  
  # Export DATABASE_URL directly (this will override the compose file)
  export DATABASE_URL="postgresql://tas_user:${POSTGRES_PASSWORD}@postgres:5432/tas_db?schema=public&pool_timeout=0&connection_limit=20"
  export POSTGRES_PASSWORD="$POSTGRES_PASSWORD"
  
  # Restart with DATABASE_URL in environment (will override compose file definition)
  docker compose -f docker-compose.network.yml -p tas-production --env-file .env.production up -d backend
  
  # Wait and check
  sleep 10
  docker compose -p tas-production ps backend
  
  # Try to check DATABASE_URL (if container is running)
  if docker compose -p tas-production ps backend | grep -q "Up"; then
    docker compose -p tas-production exec backend printenv DATABASE_URL || echo "Container still starting..."
  fi
  
  # Check logs
  docker compose -p tas-production logs --tail=30 backend
else
  # Container is running, check DATABASE_URL
  DATABASE_URL_IN_CONTAINER=$(docker compose -p tas-production exec backend printenv DATABASE_URL 2>/dev/null || echo "")
  
  if [ -z "$DATABASE_URL_IN_CONTAINER" ]; then
    echo "❌ DATABASE_URL is still empty in container!"
    echo "   Applying fix..."
    
    # Stop and restart with DATABASE_URL exported
    docker compose -p tas-production stop backend
    POSTGRES_PASSWORD=$(grep '^POSTGRES_PASSWORD=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)
    export DATABASE_URL="postgresql://tas_user:${POSTGRES_PASSWORD}@postgres:5432/tas_db?schema=public&pool_timeout=0&connection_limit=20"
    docker compose -f docker-compose.network.yml -p tas-production --env-file .env.production up -d backend
    sleep 5
    docker compose -p tas-production exec backend printenv DATABASE_URL
  else
    echo "✅ DATABASE_URL is set: ${DATABASE_URL_IN_CONTAINER:0:50}..."
  fi
  
  # Check logs for connection status
  docker compose -p tas-production logs --tail=30 backend | grep -E "(Database|Redis|connected|error|success)"
fi
```

**🔧 ALTERNATIVE FIX: If DATABASE_URL is empty or missing in the container**

**Complete Fix Steps (Using Helper Script - Recommended):**

```bash
cd /opt/tas-production

# Step 1: Use the helper script to set up DATABASE_URL with URL-encoded password
# This script automatically handles special characters in POSTGRES_PASSWORD
chmod +x scripts/setup-database-url.sh
source scripts/setup-database-url.sh .env.production

# Step 2: Stop and recreate backend with proper environment
docker compose -p tas-production stop backend
docker compose -f docker-compose.network.yml -f /tmp/docker-compose.override.yml -p tas-production --env-file .env.production up -d --force-recreate backend

# Step 3: Wait a few seconds, then verify DATABASE_URL is set
sleep 5
echo "Checking DATABASE_URL in container..."
docker compose -p tas-production exec backend printenv DATABASE_URL

# Step 4: Check logs (should see successful connection)
docker compose -p tas-production logs --tail=50 backend | grep -E "(Database|Redis|connected|error)"
```

**Alternative Manual Steps (if script not available):**

```bash
cd /opt/tas-production

# Step 1: Get POSTGRES_PASSWORD and URL-encode it
POSTGRES_PASSWORD=$(grep '^POSTGRES_PASSWORD=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)

# URL-encode the password (handles special characters like /, @, etc.)
if command -v python3 >/dev/null 2>&1; then
  POSTGRES_PASSWORD_ENCODED=$(python3 -c "import urllib.parse; print(urllib.parse.quote('${POSTGRES_PASSWORD}', safe=''))")
elif command -v node >/dev/null 2>&1; then
  POSTGRES_PASSWORD_ENCODED=$(node -e "console.log(encodeURIComponent('${POSTGRES_PASSWORD}'))")
else
  # Fallback: manual encoding
  POSTGRES_PASSWORD_ENCODED=$(echo "${POSTGRES_PASSWORD}" | sed 's|/|%2F|g' | sed 's|@|%40|g' | sed 's|:|%3A|g' | sed 's|#|%23|g' | sed 's|?|%3F|g' | sed 's|&|%26|g' | sed 's|=|%3D|g')
fi

# Step 2: Create override file with URL-encoded DATABASE_URL
DATABASE_URL_VALUE="postgresql://tas_user:${POSTGRES_PASSWORD_ENCODED}@postgres:5432/tas_db?schema=public&pool_timeout=0&connection_limit=20"
printf 'services:\n  backend:\n    environment:\n      DATABASE_URL: "%s"\n' "${DATABASE_URL_VALUE}" > /tmp/docker-compose.override.yml

# Step 3: Export all environment variables
grep -v '^#' .env.production | grep -v '^$' | grep '=' | sed 's/#.*$//' | sed 's/[[:space:]]*$//' > /tmp/.env.clean
set -a
source /tmp/.env.clean
set +a
rm /tmp/.env.clean

# Step 4: Stop and recreate backend
docker compose -p tas-production stop backend
docker compose -f docker-compose.network.yml -f /tmp/docker-compose.override.yml -p tas-production --env-file .env.production up -d --force-recreate backend

# Step 5: Verify
sleep 5
docker compose -p tas-production exec backend printenv DATABASE_URL
docker compose -p tas-production logs --tail=50 backend | grep -E "(Database|Redis|connected|error)"
```

**If DATABASE_URL is still empty after Step 5:**

The variable substitution isn't working. Use this alternative approach - set DATABASE_URL directly:

```bash
# Get POSTGRES_PASSWORD from .env.production
POSTGRES_PASSWORD=$(grep '^POSTGRES_PASSWORD=' .env.production | cut -d= -f2 | sed 's/#.*$//' | xargs)

# Construct DATABASE_URL manually
export DATABASE_URL="postgresql://tas_user:${POSTGRES_PASSWORD}@postgres:5432/tas_db?schema=public&pool_timeout=0&connection_limit=20"

# Verify
echo "DATABASE_URL: ${DATABASE_URL:0:50}..."

# Restart with DATABASE_URL in environment
docker compose -f docker-compose.network.yml -p tas-production --env-file .env.production up -d --force-recreate backend

# Verify it's set
docker compose -p tas-production exec backend printenv DATABASE_URL
```

**If you still see permission errors after starting:**

```bash
# Fix permissions after container starts (if needed)
# Get the user ID from the container
docker compose -p tas-production exec backend id

# Then set ownership based on the container's user ID
# Example if container runs as UID 1000:
chown -R 1000:1000 backend/logs backend/uploads

# Or use more permissive permissions (less secure, but works)
chmod -R 777 backend/logs backend/uploads
```

**Note about `.env` file warning:**
- The backend code looks for a `.env` file inside the container at `/app/.env`
- This is normal - the backend will use environment variables passed via Docker Compose
- The warning ".env file exists: false" is not critical if environment variables are properly set
- All required variables should be in `.env.production` and passed via `--env-file` flag
- The permission error for logs is the main issue that needs to be fixed

#### Step 4: Run Database Migrations

```bash
# Wait for database to be ready (about 10-15 seconds)
sleep 15

# Run migrations (using project name)
docker compose -p tas-production exec backend npx prisma migrate deploy

# Generate Prisma client
docker compose -p tas-production exec backend npx prisma generate
```

**⚠️ If migration fails with "syntax error at or near ALTER" or BOM character error:**

This happens when migration files have a BOM (Byte Order Mark) character. Fix it:

```bash
cd /opt/tas-production

# Find the problematic migration file
MIGRATION_DIR=$(find prisma/migrations -name "*allow_null_fptk_number*" -type d | head -1)

if [ -n "$MIGRATION_DIR" ]; then
  echo "Found migration directory: $MIGRATION_DIR"
  
  # Remove BOM character from migration.sql
  sed -i '1s/^\xEF\xBB\xBF//' "$MIGRATION_DIR/migration.sql"
  
  # Verify the fix (first line should not have BOM)
  echo "First 50 characters of migration file:"
  head -c 50 "$MIGRATION_DIR/migration.sql" | od -An -tx1
  
  # Reset migration status (if needed)
  docker compose -p tas-production exec backend npx prisma migrate resolve --rolled-back "$(basename $MIGRATION_DIR)"
  
  # Retry migration
  docker compose -p tas-production exec backend npx prisma migrate deploy
else
  echo "Migration directory not found. Check prisma/migrations/"
fi
```

**⚠️ If Prisma generate fails with permission error:**

```bash
# Fix permissions for Prisma client directory
docker compose -p tas-production exec backend sh -c "chmod -R 777 /app/node_modules/.prisma || mkdir -p /app/node_modules/.prisma && chmod -R 777 /app/node_modules/.prisma"

# Retry generate
docker compose -p tas-production exec backend npx prisma generate
```

#### Step 5: Create Production User

**⚠️ IMPORTANT: Migrations must complete successfully before creating users!**

```bash
# Check available scripts first
docker compose -p tas-production exec backend ls scripts/

# Option 1: Use createAdmin.js (creates default admin user)
docker compose -p tas-production exec backend node scripts/createAdmin.js

# Option 2: Use createUser.js (allows custom email/password)
docker compose -p tas-production exec backend sh -c "EMAIL=admin@example.com PASSWORD=SecurePassword123! node scripts/createUser.js"

# Option 3: Use createJerryAdmin.js (if available)
docker compose -p tas-production exec backend node scripts/createJerryAdmin.js
```

**Expected output (createAdmin.js):**
```
✅ Admin user created successfully!
📋 User Credentials:
   Email: admin@example.com
   Password: [default password from script]
   Role: SUPER_ADMIN
```

**⚠️ If you get "table does not exist" error:**

The migration hasn't been applied yet. Go back to Step 4 and ensure migrations complete successfully:

```bash
# Check if migrations were applied
docker compose -p tas-production exec backend npx prisma migrate status

# If migrations are pending, apply them
docker compose -p tas-production exec backend npx prisma migrate deploy

# Verify tables exist
docker compose -p tas-production exec postgres psql -U tas_user -d tas_db -c "\dt"
```

**Expected output:**
```
✅ Production user created successfully!
📋 User Credentials:
   Name: Jerry Hakim
   Email: jerry.hakim@energi-up.com
   Password: DefaultPassword123!
   Role: SUPER_ADMIN
```

**⚠️ IMPORTANT**: Change the password immediately after first login!

#### Step 6: Verify Backend Health

```bash
# First, check if backend container is running
docker compose -p tas-production ps backend

# Check backend logs for any errors
docker compose -p tas-production logs --tail=50 backend

# Test health endpoint
curl http://localhost:4000/health

# Should return JSON with success: true
```

**⚠️ If you get "Failed to connect" error:**

```bash
# Step 1: Check if backend container is running
docker compose -p tas-production ps backend

# Step 2: If container is not running or restarting, check logs
docker compose -p tas-production logs --tail=100 backend

# Step 3: Check if port 4000 is listening
netstat -tulpn | grep 4000
# Or
ss -tulpn | grep 4000

# Step 4: Check if backend is listening inside the container
docker compose -p tas-production exec backend netstat -tulpn 2>/dev/null | grep 4000 || echo "netstat not available, trying ss..."
docker compose -p tas-production exec backend ss -tulpn 2>/dev/null | grep 4000 || echo "Port 4000 not found in container"

# Step 5: Test from inside the container
docker compose -p tas-production exec backend curl http://localhost:4000/health 2>&1

# Step 6: If backend is not running, restart it
docker compose -f docker-compose.network.yml -f /tmp/docker-compose.override.yml -p tas-production --env-file .env.production up -d backend

# Step 7: Wait a few seconds and check logs
sleep 5
docker compose -p tas-production logs --tail=30 backend | grep -E "(Server|running|error|Error|listening|port)"

# Step 8: Retry health check
curl http://localhost:4000/health
```

**Common issues:**
- **Container not running**: Check logs for startup errors (database connection, missing env vars, etc.)
- **Port not mapped**: Verify `docker-compose.network.yml` has port mapping `4000:4000` for backend service
- **Backend crashed**: Check logs for database connection errors or other fatal errors
- **Firewall blocking**: Check if `ufw` is blocking port 4000 (run `ufw status`)

#### Step 7: Configure Firewall

```bash
# Allow port 4000 from frontend server only
ufw allow from 147.139.176.70 to any port 4000 proto tcp

# Enable firewall
ufw enable
```

### Production Frontend Server Setup

**⚠️ IMPORTANT: Docker Compose Files**

- **`docker-compose.frontend.yml`**: Use this on the **FRONTEND SERVER** (ECS-App)
  - Only includes: `frontend`, `candidate-portal`, `nginx`
  - Does NOT include: `backend`, `postgres`, `redis` (these run on backend server)
  
- **`docker-compose.network.yml`**: Use this on the **BACKEND SERVER** (ECS-DB)
  - Includes all services: `backend`, `postgres`, `redis`, `frontend`, `candidate-portal`, `nginx`
  - On backend server, only `backend`, `postgres`, `redis` should run

#### Step 1: Clone Repository

```bash
ssh -p 1818 root@147.139.176.70

# Navigate to deployment directory
cd /opt

# Clone repository from main branch
# Option A: Using Personal Access Token (Recommended - No SSH setup needed)
git clone -b main https://jerrypra0906:<YOUR_TOKEN>@github.com/jerrypra0906/talent-acquisition-management.git tas-production

# Option B: Using SSH (Requires SSH keys to be set up on this server)
# If you get "Permission denied (publickey)" error, use Option A instead
git clone -b main git@github.com:jerrypra0906/talent-acquisition-management.git tas-production

cd tas-production
```

**⚠️ If you get "Permission denied (publickey)" error with SSH:**

The frontend server doesn't have SSH keys set up for GitHub. You have two options:

**Option 1: Use Personal Access Token (Easiest)**
```bash
# Replace <YOUR_TOKEN> with your GitHub Personal Access Token
git clone -b main https://jerrypra0906:<YOUR_TOKEN>@github.com/jerrypra0906/talent-acquisition-management.git tas-production
```

**Option 2: Set up SSH keys on frontend server**
```bash
# Generate SSH key (if not already exists)
ssh-keygen -t ed25519 -C "your_email@example.com"
# Press Enter to accept default location
# Optionally set a passphrase

# Display public key
cat ~/.ssh/id_ed25519.pub

# Add this public key to GitHub:
# 1. Go to: https://github.com/settings/keys
# 2. Click "New SSH key"
# 3. Paste the public key
# 4. Save

# Then try cloning again
git clone -b main git@github.com:jerrypra0906/talent-acquisition-management.git tas-production
```

#### Step 2: Create Production Environment File

```bash
# Copy template
cp env.network.template .env.production

# Edit environment file
nano .env.production
```

**Required environment variables for production frontend:**

**⚠️ IMPORTANT: Port 80 is already in use on this server. Use alternative ports:**

```env
# Server Configuration
SERVER_HOST=147.139.176.70

# Port Configuration (Using alternative ports due to port 80 conflict)
HTTP_PORT=8080
HTTPS_PORT=8443

# API URL (points to NGINX on frontend server, which proxies to backend)
# ⚠️ IMPORTANT: Use NGINX URL (port 8080) not direct backend URL (port 4000)
# This ensures requests go through NGINX for proper routing and CORS handling
# Using domain name: tas.energi-up.com
NEXT_PUBLIC_API_URL=http://tas.energi-up.com:8080/api

# CORS (must match backend configuration - include both domain and IP for flexibility)
CORS_ORIGIN=http://tas.energi-up.com:8080,http://147.139.176.70:8080,http://147.139.176.70:4001,http://147.139.176.70:4002
FRONTEND_URL=http://tas.energi-up.com:8080
CANDIDATE_PORTAL_URL=http://147.139.176.70:4002
```

**Alternative Configuration (if you want to use port 80 via existing reverse proxy):**

If you have an existing reverse proxy/load balancer that can route to internal Docker network:

```env
# Server Configuration
SERVER_HOST=147.139.176.70

# Port Configuration (Internal only - accessed via existing reverse proxy)
HTTP_PORT=8080
HTTPS_PORT=8443

# API URL (points to NGINX on frontend server, which proxies to backend)
# ⚠️ IMPORTANT: Use NGINX URL (port 8080) not direct backend URL (port 4000)
# This ensures requests go through NGINX for proper routing and CORS handling
NEXT_PUBLIC_API_URL=http://147.139.176.70:8080/api

# CORS (use the public URL that users will access)
CORS_ORIGIN=http://147.139.176.70,http://147.139.176.70:4001,http://147.139.176.70:4002
FRONTEND_URL=http://147.139.176.70
CANDIDATE_PORTAL_URL=http://147.139.176.70:4002
```

**Note:** If using alternative ports, users will access the application via `http://147.139.176.70:8080` instead of `http://147.139.176.70`

#### Step 3: Configure NGINX

Edit `nginx/nginx.conf` to point to production backend server:

```bash
nano nginx/nginx.conf
```

**Update the backend upstream:**

```nginx
# Backend API upstream (Production)
upstream backend {
    least_conn;
    server 8.215.56.98:4000 max_fails=3 fail_timeout=30s;  # Backend server IP
}
```

**For HTTP-only deployment (no SSL), update server blocks:**

**⚠️ IMPORTANT: Since port 80 is in use, configure NGINX to listen on port 8080:**

```nginx
# Main HTTP server (using port 8080 due to port 80 conflict)
server {
    listen 8080;  # Changed from 80 to 8080
    server_name _;

    # API routes
    location /api/ {
        limit_req zone=api_limit burst=20 nodelay;
        
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Login endpoint (stricter rate limit)
    location /api/auth/login {
        limit_req zone=login_limit burst=5 nodelay;
        
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Health check
    location /health {
        proxy_pass http://backend;
        access_log off;
    }

    # Frontend (Admin Dashboard)
    location / {
        proxy_pass http://frontend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Candidate Portal (optional - if using subpath)
    location /careers {
        proxy_pass http://candidate-portal;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### Step 4: Start Frontend Services

**⚠️ ARCHITECTURE NOTE:**
- **Frontend Server (ECS-App)**: Should ONLY run: `frontend`, `candidate-portal`, `nginx`
- **Backend Server (ECS-DB)**: Should ONLY run: `backend`, `postgres`, `redis`
- Due to `depends_on` relationships in `docker-compose.network.yml`, backend services may start automatically
- We will explicitly stop backend services on the frontend server after starting frontend services
- Frontend services connect to backend API via network (configured in NGINX upstream)

```bash
cd /opt/tas-production

# Set project name for isolation (prevents conflicts with other apps)
export COMPOSE_PROJECT_NAME=tas-production

# Export environment variables (handles inline comments and special characters)
# Method: Manually export each variable with proper quoting
export POSTGRES_PASSWORD="$(grep '^POSTGRES_PASSWORD=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)"
export REDIS_PASSWORD="$(grep '^REDIS_PASSWORD=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)"
export JWT_SECRET="$(grep '^JWT_SECRET=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)"
export JWT_REFRESH_SECRET="$(grep '^JWT_REFRESH_SECRET=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)"
export ENCRYPTION_KEY="$(grep '^ENCRYPTION_KEY=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)"
export FRONTEND_URL="$(grep '^FRONTEND_URL=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)"
export CANDIDATE_PORTAL_URL="$(grep '^CANDIDATE_PORTAL_URL=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)"
export CORS_ORIGIN="$(grep '^CORS_ORIGIN=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)"
export NEXT_PUBLIC_API_URL="$(grep '^NEXT_PUBLIC_API_URL=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)"
export HTTP_PORT="$(grep '^HTTP_PORT=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)"
export HTTPS_PORT="$(grep '^HTTPS_PORT=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)"

# Verify critical variables are exported
echo "POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:+SET}"
echo "REDIS_PASSWORD: ${REDIS_PASSWORD:+SET}"
echo "HTTP_PORT: ${HTTP_PORT:-NOT_SET}"

# ⚠️ IMPORTANT: Port 80 is already in use by another application
# We're using port 8080 instead (configured in .env.production and nginx.conf)

# Verify port 8080 is available
lsof -i :8080 || echo "Port 8080 is available"
lsof -i :8443 || echo "Port 8443 is available (for HTTPS)"

# Verify port 80 is in use (expected)
lsof -i :80 && echo "Port 80 is in use (expected - another application)"

# Stop any existing containers (if they were started with wrong compose file)
docker compose -p tas-production stop frontend candidate-portal nginx backend postgres redis 2>/dev/null || true
docker compose -p tas-production rm -f frontend candidate-portal nginx backend postgres redis 2>/dev/null || true

# Start Frontend, Candidate Portal, and NGINX
# ⚠️ IMPORTANT: Use docker-compose.frontend.yml (frontend-specific, no backend services)
# This file only includes: frontend, candidate-portal, and nginx
# Backend services (backend, postgres, redis) will NOT start with this file
# Using -p flag ensures project-specific naming
docker compose -f docker-compose.frontend.yml -p tas-production --env-file .env.production up -d

# Verify only frontend services are running
echo ""
echo "=== Verifying only frontend services are running ==="
docker compose -p tas-production ps

# Check status (only shows containers from this project)
echo ""
echo "=== Expected running services on FRONTEND server ==="
echo "✅ tas_frontend (Frontend/Admin Dashboard)"
echo "✅ tas_candidate_portal (Candidate Portal)"
echo "✅ tas_nginx (NGINX Reverse Proxy)"
echo ""
echo "❌ These should NOT be running on frontend server:"
echo "   - tas_backend (should run on backend server only)"
echo "   - tas_postgres (should run on backend server only)"
echo "   - tas_redis (should run on backend server only)"

# View logs
echo ""
echo "=== Viewing logs ==="
docker compose -p tas-production logs -f nginx
docker compose -p tas-production logs -f frontend

# Verify containers are isolated (check container names)
docker ps --filter "name=tas-production"
```

#### Step 5: Configure Firewall

```bash
# ⚠️ Since we're using alternative ports (8080/8443), allow those instead of 80/443
ufw status | grep -E "(8080|8443|80|443)"

# Allow alternative HTTP and HTTPS ports
ufw allow 8080/tcp  # TAS NGINX HTTP
ufw allow 8443/tcp  # TAS NGINX HTTPS (if using SSL)

# Also allow ports for Frontend and Candidate Portal (if needed)
ufw allow 4001/tcp  # Frontend (if accessing directly)
ufw allow 4002/tcp  # Candidate Portal (if accessing directly)

# Note: Port 80 is already open (for other application) - don't change it
# Port 443 may be needed for other application - check before opening

# Enable firewall (if not already enabled)
ufw enable
```

**Note**: 
- Port 80 is already in use by another application - we're using port 8080 instead
- Access the application via `http://147.139.176.70:8080`
- If you have an existing reverse proxy on port 80, you can configure it to route to port 8080 internally

#### Step 6: Troubleshoot Connectivity Issues

If you cannot access `http://147.139.176.70:8080` from your browser, follow these diagnostic steps:

**1. Test from the server itself (should work if NGINX is running):**

```bash
# Test local connectivity
curl -I http://localhost:8080
curl -I http://127.0.0.1:8080

# If this works, the issue is firewall/security group, not NGINX
```

**2. Check if NGINX is listening on port 8080:**

```bash
# Check listening ports
netstat -tulpn | grep 8080
# OR
ss -tulpn | grep 8080
# OR
lsof -i :8080

# Should show NGINX listening on 0.0.0.0:8080
```

**3. Check UFW firewall:**

```bash
# Check if port 8080 is allowed
ufw status verbose | grep 8080

# If not listed, add it:
ufw allow 8080/tcp
ufw reload

# Verify it's now allowed
ufw status numbered | grep 8080
```

**4. Check NGINX configuration:**

```bash
# Check NGINX container logs
docker compose -p tas-production logs --tail=50 nginx

# Check NGINX configuration inside container
docker compose -p tas-production exec nginx cat /etc/nginx/nginx.conf | grep -A 5 "listen"

# Should show: listen 8080; (or listen 80; if using HTTP_PORT env var)
```

**5. ⚠️ CRITICAL: Check AliCloud Security Group**

The most common issue is that AliCloud Security Group is blocking port 8080:

1. **Log in to AliCloud Console**
2. **Navigate to:** ECS → Instances → Find your frontend server (ECS-App)
3. **Click:** Security Groups tab
4. **Click:** Configure Rules
5. **Add Inbound Rule:**
   - **Port Range:** 8080/8080
   - **Protocol:** TCP
   - **Authorization Object:** 0.0.0.0/0 (or your specific IP)
   - **Description:** TAS NGINX HTTP
6. **Save** and wait 1-2 minutes for changes to take effect

**6. Verify NGINX container port mapping:**

```bash
# Check Docker port mapping
docker ps --filter "name=tas_nginx" --format "table {{.Names}}\t{{.Ports}}"

# Should show: 0.0.0.0:8080->80/tcp
# This means: Host port 8080 maps to container port 80
```

**7. Test from another server (if available):**

```bash
# From another server that can reach the frontend server
curl -I http://147.139.176.70:8080

# If this works but browser doesn't, check:
# - Browser proxy settings
# - Corporate firewall blocking port 8080
# - ISP blocking port 8080
```

**Common Issues and Solutions:**

| Issue | Solution |
|-------|----------|
| `Connection refused` from browser | Check AliCloud Security Group (most common) |
| `Connection refused` from server itself | Check NGINX container is running: `docker compose -p tas-production ps` |
| `Timeout` from browser | Check UFW firewall: `ufw allow 8080/tcp` |
| NGINX not listening on 8080 | Check `HTTP_PORT` in `.env.production` and NGINX config |
| Works locally but not from browser | Check AliCloud Security Group rules |
| **Frontend build stuck/slow** | See troubleshooting section below |
| **Frontend server failed to start** | See troubleshooting section below |

**Frontend Server Failed to Start:**

If the frontend is not accessible or containers are not running:

1. **Check container status:**
   ```bash
   cd /opt/tas-production
   docker compose -p tas-production ps
   
   # Check specific containers
   docker ps -a | grep -E "(tas_frontend|tas_nginx|tas_candidate)"
   ```

2. **Check container logs for errors:**
   ```bash
   # Frontend container logs
   docker compose -p tas-production logs --tail=50 frontend
   
   # NGINX container logs
   docker compose -p tas-production logs --tail=50 nginx
   
   # Candidate portal logs
   docker compose -p tas-production logs --tail=50 candidate-portal
   
   # All logs together
   docker compose -p tas-production logs --tail=100
   ```

3. **Check if containers are restarting (crash loop):**
   ```bash
   # Check restart count
   docker compose -p tas-production ps
   
   # If showing "Restarting", check why
   docker inspect tas_frontend | grep -A 10 "State"
   docker inspect tas_nginx | grep -A 10 "State"
   ```

4. **Verify environment variables are set:**
   ```bash
   # Check if .env.production exists and has required variables
   cd /opt/tas-production
   cat .env.production | grep -E "(NEXT_PUBLIC_API_URL|HTTP_PORT|HTTPS_PORT)"
   
   # Check if variables are exported
   echo "NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL:-NOT SET}"
   echo "HTTP_PORT: ${HTTP_PORT:-NOT SET}"
   ```

5. **Try starting containers manually to see errors:**
   ```bash
   cd /opt/tas-production
   
   # Stop all containers first
   docker compose -f docker-compose.frontend.yml -p tas-production down
   
   # Start with verbose output (not detached)
   docker compose -f docker-compose.frontend.yml -p tas-production --env-file .env.production up
   # Press Ctrl+C after seeing errors
   ```

6. **Check if build completed successfully:**
   ```bash
   # Check if frontend image exists
   docker images | grep tas-production
   
   # If image doesn't exist, rebuild
   docker compose -f docker-compose.frontend.yml -p tas-production --env-file .env.production build frontend
   ```

7. **Check network connectivity:**
   ```bash
   # Verify network exists
   docker network ls | grep tas_network
   
   # If network doesn't exist, create it
   docker network create tas_network
   ```

8. **Common fixes:**

   **If frontend container exits immediately:**
   ```bash
   # Check if build artifacts exist
   docker compose -p tas-production exec frontend ls -la /app/.next 2>/dev/null || echo "Container not running"
   
   # Rebuild if needed
   docker compose -f docker-compose.frontend.yml -p tas-production --env-file .env.production build --no-cache frontend
   docker compose -f docker-compose.frontend.yml -p tas-production --env-file .env.production up -d frontend
   ```

   **If NGINX fails to start:**
   ```bash
   # Check NGINX config syntax
   docker compose -p tas-production exec nginx nginx -t 2>/dev/null || echo "Container not running"
   
   # Verify config file exists
   ls -la /opt/tas-production/nginx/nginx.network.conf
   
   # Restart NGINX
   docker compose -p tas-production restart nginx
   ```

   **If port 8080 is already in use:**
   ```bash
   # Check what's using port 8080
   netstat -tulpn | grep 8080
   ss -tulpn | grep 8080
   
   # Stop conflicting service or change HTTP_PORT in .env.production
   ```

9. **Full restart procedure:**
   ```bash
   cd /opt/tas-production
   
   # Stop everything
   docker compose -f docker-compose.frontend.yml -p tas-production down
   
   # Pull latest code
   git pull origin main
   
   # Export environment variables
   export HTTP_PORT="$(grep '^HTTP_PORT=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)"
   export HTTPS_PORT="$(grep '^HTTPS_PORT=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)"
   export NEXT_PUBLIC_API_URL="$(grep '^NEXT_PUBLIC_API_URL=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)"
   
   # Rebuild and start
   docker compose -f docker-compose.frontend.yml -p tas-production --env-file .env.production build --no-cache
   docker compose -f docker-compose.frontend.yml -p tas-production --env-file .env.production up -d
   
   # Wait a few seconds
   sleep 5
   
   # Check status
   docker compose -p tas-production ps
   
   # Check logs
   docker compose -p tas-production logs --tail=30
   ```

**Frontend Build Stuck or Very Slow:**

If the frontend build is taking too long (>15 minutes) or appears stuck:

1. **Check if build is actually progressing:**
   ```bash
   # In another terminal, check Docker build processes
   docker ps -a
   docker stats
   ```

2. **Cancel and retry with verbose output:**
   ```bash
   # Press Ctrl+C to cancel current build
   # Then rebuild with verbose logging
   docker compose -f docker-compose.frontend.yml -p tas-production --env-file .env.production build --progress=plain --no-cache frontend
   ```

3. **Check system resources:**
   ```bash
   # Check available memory and disk space
   free -h
   df -h
   # Frontend build needs at least 2GB free memory
   ```

4. **Try building without cache (clean build):**
   ```bash
   # Stop any running containers
   docker compose -f docker-compose.frontend.yml -p tas-production down
   
   # Clean up Docker build cache
   docker builder prune -f
   
   # Rebuild
   docker compose -f docker-compose.frontend.yml -p tas-production --env-file .env.production build --no-cache frontend
   ```

5. **If network is slow, increase npm timeout:**
   ```bash
   # Edit frontend/Dockerfile temporarily to add npm config
   # Add before "RUN npm ci":
   # RUN npm config set fetch-timeout 300000
   # RUN npm config set fetch-retries 5
   ```

6. **Build in stages to identify which step is slow:**
   ```bash
   # Build only dependencies stage
   docker build --target dependencies -t tas-frontend-deps ./frontend
   
   # If that works, continue with build stage
   docker build --target build --build-arg NEXT_PUBLIC_API_URL=http://tas.energi-up.com:8080/api -t tas-frontend-build ./frontend
   ```

---

## Verification

### Testing Environment Verification

#### Test Testing Backend Server

```bash
# From testing backend server or any machine that can reach it
curl http://<TESTING_BACKEND_IP>:4000/health
```

#### Test Testing Frontend Server

1. **Open browser:** `http://<TESTING_FRONTEND_IP>`
2. **Should see:** Login page
3. **Login with:** Credentials from `createProductionUser.js` output

#### Test Testing API through NGINX

```bash
curl http://<TESTING_FRONTEND_IP>/api/health
```

### Domain Configuration (Optional)

If you want to use a domain name instead of IP address:

**Step 1: Configure DNS**

1. Go to your DNS provider (where `energi-up.com` is managed)
2. Add an **A Record**:
   - **Name/Host:** `tas` (or `@` for root domain)
   - **Type:** `A`
   - **Value/IP:** `147.139.176.70`
   - **TTL:** `3600` (or default)

3. Wait for DNS propagation (can take a few minutes to 48 hours)

**Step 2: Update Environment Variables**

**On Frontend Server (ECS-App):**

```bash
cd /opt/tas-production
nano .env.production
```

Update these lines:
```env
# Use domain name instead of IP
NEXT_PUBLIC_API_URL=http://tas.energi-up.com:8080/api
FRONTEND_URL=http://tas.energi-up.com:8080
```

**On Backend Server (ECS-DB):**

```bash
cd /opt/tas-production
nano .env.production
```

Update these lines:
```env
# Include both domain and IP in CORS for flexibility
FRONTEND_URL=http://tas.energi-up.com:8080
CORS_ORIGIN=http://tas.energi-up.com:8080,http://147.139.176.70:8080,http://147.139.176.70:4001,http://147.139.176.70:4002
```

**Step 3: Update NGINX Configuration**

The NGINX config already includes the domain name. If you need to update it:

```bash
cd /opt/tas-production
nano nginx/nginx.network.conf
```

Ensure `server_name` includes the domain:
```nginx
server_name tas.energi-up.com 147.139.176.70;
```

**Step 4: Rebuild and Restart Services**

**Frontend Server:**
```bash
cd /opt/tas-production
git pull origin main
docker compose -f docker-compose.frontend.yml -p tas-production --env-file .env.production build --no-cache frontend
docker compose -f docker-compose.frontend.yml -p tas-production --env-file .env.production up -d
docker compose -p tas-production restart nginx
```

**Backend Server:**
```bash
cd /opt/tas-production
git pull origin main
docker compose -p tas-production restart backend
```

**Step 5: Verify Domain Access**

1. Test domain: `http://tas.energi-up.com:8080`
2. Should show the login page
3. Try logging in

**Note:** If you want to use port 80 (standard HTTP) instead of 8080, you'll need to:
- Configure an external reverse proxy/load balancer
- Or use AliCloud's Application Load Balancer (ALB)
- Or free up port 80 on the frontend server

### Production Environment Verification

#### Test Production Backend Server

```bash
# From production backend server or any machine that can reach it
curl http://8.215.56.98:4000/health
```

#### Test Production Frontend Server

1. **Open browser:** `http://147.139.176.70:8080` (⚠️ Note: Using port 8080 due to port 80 conflict)
2. **Should see:** Login page
3. **Login with:** Credentials from `createProductionUser.js` output

#### Test Production API through NGINX

```bash
# Test API through NGINX on alternative port
curl http://147.139.176.70:8080/api/health

# Or test backend directly (if accessible)
curl http://8.215.56.98:4000/health
```

---

## Troubleshooting

### Git Authentication Issues

**Problem:** `remote: Invalid username or token`

**Solutions:**
1. **Use Personal Access Token instead of password:**
   ```bash
   git clone -b main https://jerrypra0906:<YOUR_TOKEN>@github.com/jerrypra0906/talent-acquisition-management.git tas
   ```

2. **Set up SSH keys** (see Prerequisites section)

3. **Use GitHub CLI:**
   ```bash
   apt install gh
   gh auth login
   gh repo clone jerrypra0906/talent-acquisition-management tas
   ```

### Environment Variable Export Errors

**Problem:** `export: '#': not a valid identifier` or `command not found` errors when exporting `.env.production`

**Causes:**
1. The `.env.production` file contains inline comments (comments after values)
2. Values contain special characters that aren't properly quoted
3. Values might contain characters that are interpreted as shell commands

**Solution 1: Manually export critical variables (Recommended - Most Reliable)**

This method properly quotes each value and handles special characters safely:

```bash
# Read values from .env.production and export manually with proper quoting
export POSTGRES_PASSWORD="$(grep '^POSTGRES_PASSWORD=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)"
export REDIS_PASSWORD="$(grep '^REDIS_PASSWORD=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)"
export JWT_SECRET="$(grep '^JWT_SECRET=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)"
export JWT_REFRESH_SECRET="$(grep '^JWT_REFRESH_SECRET=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)"
export ENCRYPTION_KEY="$(grep '^ENCRYPTION_KEY=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)"
export FRONTEND_URL="$(grep '^FRONTEND_URL=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)"
export CANDIDATE_PORTAL_URL="$(grep '^CANDIDATE_PORTAL_URL=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)"
export CORS_ORIGIN="$(grep '^CORS_ORIGIN=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)"
```

**Solution 2: Use source method (May fail with special characters)**

If you want to try the source method, but it may fail if values contain special characters:

```bash
# Read values from .env.production and export manually
export POSTGRES_PASSWORD="$(grep '^POSTGRES_PASSWORD=' .env.production | cut -d= -f2 | sed 's/#.*$//' | xargs)"
export REDIS_PASSWORD="$(grep '^REDIS_PASSWORD=' .env.production | cut -d= -f2 | sed 's/#.*$//' | xargs)"
export JWT_SECRET="$(grep '^JWT_SECRET=' .env.production | cut -d= -f2 | sed 's/#.*$//' | xargs)"
export JWT_REFRESH_SECRET="$(grep '^JWT_REFRESH_SECRET=' .env.production | cut -d= -f2 | sed 's/#.*$//' | xargs)"
export ENCRYPTION_KEY="$(grep '^ENCRYPTION_KEY=' .env.production | cut -d= -f2 | sed 's/#.*$//' | xargs)"
export FRONTEND_URL="$(grep '^FRONTEND_URL=' .env.production | cut -d= -f2 | sed 's/#.*$//' | xargs)"
export CANDIDATE_PORTAL_URL="$(grep '^CANDIDATE_PORTAL_URL=' .env.production | cut -d= -f2 | sed 's/#.*$//' | xargs)"
export CORS_ORIGIN="$(grep '^CORS_ORIGIN=' .env.production | cut -d= -f2 | sed 's/#.*$//' | xargs)"
```

**Solution 3: Skip export (Docker Compose will handle it)**

If you're only using `--env-file`, you can skip the export step entirely. However, this won't work for variable substitution in `docker-compose.network.yml` (like `${POSTGRES_PASSWORD}`). In that case, you need to either:

1. Use Solution 1 or 2 above, OR
2. Modify `docker-compose.network.yml` to read directly from the env file

**Verify export worked:**
```bash
echo "POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:0:10}..." # Shows first 10 chars
echo "REDIS_PASSWORD: ${REDIS_PASSWORD:0:10}..."
   ```

### Backend Connection Issues

**Problem:** Frontend can't connect to backend

**Check:**
1. Backend is running: `docker compose ps` on backend server
2. Port 4000 is open: `ufw status` on backend server
3. Backend health: `curl http://<BACKEND_IP>:4000/health` (Production: `8.215.56.98:4000`)
4. NGINX config: Verify `upstream backend` points to correct IP (Production: `8.215.56.98:4000`)
5. Environment file: Ensure using correct `.env.testing` or `.env.production`
6. **Test direct connectivity from frontend to backend:**
   ```bash
   # On frontend server, test if backend is reachable
   curl -v --connect-timeout 10 http://8.215.56.98:4000/health
   ```
   - If this times out or fails, check:
     - AliCloud Security Group for backend server allows inbound port 4000 from frontend IP (`147.139.176.70`)
     - Backend server firewall (if enabled) allows port 4000
     - Backend container is listening on `0.0.0.0:4000` (not just `127.0.0.1:4000`)

#### 504 Gateway Timeout from Frontend to Backend

**Problem:** Frontend NGINX returns `504 Gateway Time-out` when trying to reach backend API.

**Symptoms:**
- `curl http://localhost:8080/api/health` on frontend server returns `504 Gateway Time-out`
- Browser shows "Login failed" or API requests timeout
- Backend is healthy when tested directly on backend server

**Root Causes:**
1. **NGINX upstream points to wrong IP:** NGINX config still uses frontend server IP instead of backend server IP
2. **Network connectivity blocked:** Frontend server cannot reach backend server on port 4000
3. **AliCloud Security Group:** Backend server's security group doesn't allow inbound traffic on port 4000

**Solution Steps:**

**Step 1: Test Direct Connectivity from Frontend to Backend**

On **frontend server (ECS-App)**:
```bash
# Test if backend is reachable directly
curl -v --connect-timeout 10 http://8.215.56.98:4000/health
```

- ✅ **If this succeeds:** Network connectivity is OK, proceed to Step 2
- ❌ **If this times out or fails:** Network/firewall issue, proceed to Step 3

**Step 2: Update NGINX Configuration**

On **frontend server (ECS-App)**:
```bash
cd /opt/tas-production

# Edit NGINX config
nano nginx/nginx.network.conf
```

Find the `upstream backend` section and ensure it uses the **backend server IP**:
```nginx
upstream backend {
    least_conn;
    server 8.215.56.98:4000 max_fails=3 fail_timeout=30s;  # Backend server IP
}
```

Save and exit (`Ctrl+X`, `Y`, `Enter`).

**Restart NGINX:**
```bash
docker compose -p tas-production restart nginx

# Verify NGINX config inside container
docker compose -p tas-production exec nginx cat /etc/nginx/nginx.conf | grep -A 3 "upstream backend"

# Should show: server 8.215.56.98:4000
```

**Test again:**
```bash
curl -v http://localhost:8080/api/health
```

**Step 3: Fix Network/Firewall Issues**

If Step 1 failed, check the following:

**A. AliCloud Security Group (Backend Server)**

**Detailed Steps to Add Inbound Rule:**

1. **Navigate to Backend Server:**
   - Go to [AliCloud Console](https://ecs.console.alibabacloud.com/)
   - Navigate to **Elastic Compute Service (ECS)** → **Instances**
   - Find and click on your backend server: **ECS-DB** (IP: `8.215.56.98`)

2. **Open Security Groups:**
   - In the instance details page, click on the **Security Groups** tab (you should already be here based on your screenshot)
   - You should see a table showing "Internal Inbound Rules" (or "Inbound Rules")

3. **Add New Inbound Rule:**
   - Look for an **"Add Rule"** or **"Create Rule"** button (usually at the top-right of the rules table, or as a "+" icon)
   - Click it to open the rule creation dialog/form

4. **Configure the Rule:**
   Fill in the following fields:
   - **Action:** Select **"Allow"** (default)
   - **Protocol Type:** Select **"TCP"**
   - **Destination Port Range:** Enter `4000/4000` (or just `4000` if the interface accepts single port)
   - **Authorization Object:** 
     - **Option 1 (Recommended - More Secure):** Enter `147.139.176.70/32` (only allows frontend server)
     - **Option 2 (For Testing):** Select **"All IP Addresses"** or enter `0.0.0.0/0` (allows from anywhere)
   - **Description (Optional):** Enter `TAS Backend API from Frontend Server` or `TAS Backend Port 4000`
   - **Priority:** Leave as default (usually `1`)

5. **Save the Rule:**
   - Click **"OK"** or **"Confirm"** or **"Save"** button
   - The new rule should appear in the rules table

6. **Verify the Rule:**
   - Check that the new rule appears in the list with:
     - Protocol: `TCP`
     - Port: `4000/4000` (or `4000`)
     - Authorization Object: `147.139.176.70/32` (or `0.0.0.0/0`)

**Note:** If you don't see an "Add Rule" button, you might need to:
- Click on the security group name/link to open the security group details page
- Then add the rule from there
- Or click **"Configure Rules"** button if available

**B. Backend Server Firewall (if enabled)**

On **backend server (ECS-DB)**:
```bash
# Check if UFW is enabled
ufw status

# If enabled, allow port 4000 from frontend server
ufw allow from 147.139.176.70 to any port 4000 proto tcp
ufw reload
```

**C. Verify Backend Container Port Binding**

On **backend server (ECS-DB)**:
```bash
# Check if backend is listening on 0.0.0.0:4000 (accessible externally)
netstat -tulpn | grep 4000
# Should show: 0.0.0.0:4000 (not 127.0.0.1:4000)

# If it shows 127.0.0.1:4000, check docker-compose.network.yml has:
# ports:
#   - "4000:4000"
```

**Step 4: Verify Fix**

After completing Steps 2 and 3:
```bash
# On frontend server
curl -v http://localhost:8080/api/health
# Should return: HTTP/1.1 200 OK

# Test from browser
# Open: http://147.139.176.70:8080
# Try to login - should work now
```

### Database Connection Issues

**Problem:** Backend can't connect to database - "Database connection error: Please check your DATABASE_URL in .env file"

**Check:**

1. **Verify PostgreSQL is running:**
   ```bash
   docker compose -p tas-production ps postgres
   docker compose -p tas-production logs postgres
   ```

2. **Verify environment variables are set correctly:**
   ```bash
   # Check if POSTGRES_PASSWORD is in .env.production
   grep POSTGRES_PASSWORD .env.production
   
   # Check if DATABASE_URL is being passed to container
   docker compose -p tas-production exec backend env | grep DATABASE_URL
   ```

3. **Verify you're using the correct docker-compose file:**
   ```bash
   # Should use docker-compose.network.yml
   docker compose -f docker-compose.network.yml -p tas-production --env-file .env.production config | grep DATABASE_URL
   ```

4. **Test database connection directly:**
   ```bash
   # Test from backend container
   docker compose -p tas-production exec backend node -e "const { Pool } = require('pg'); const pool = new Pool({ connectionString: process.env.DATABASE_URL }); pool.query('SELECT NOW()', (err, res) => { if (err) console.error('Error:', err.message); else console.log('Success:', res.rows[0]); pool.end(); });"
   
   # Or test PostgreSQL health
   docker compose -p tas-production exec postgres pg_isready -U tas_user -d tas_db
   ```

5. **Check if POSTGRES_PASSWORD has special characters:**
   - If password contains special characters like `@`, `#`, `$`, etc., they need to be URL-encoded in DATABASE_URL
   - Example: `@` becomes `%40`, `#` becomes `%23`

6. **Restart services with proper environment:**
   ```bash
   cd /opt/tas-production
   export $(cat .env.production | grep -v '^#' | xargs)
   docker compose -f docker-compose.network.yml -p tas-production --env-file .env.production restart backend
   ```

7. **Verify DATABASE_URL format:**
   - Should be: `postgresql://tas_user:PASSWORD@postgres:5432/tas_db?schema=public&pool_timeout=0&connection_limit=20`
   - Host should be `postgres` (Docker service name), not an IP address
   - Check: `docker compose -p tas-production exec backend printenv DATABASE_URL`

8. **If DATABASE_URL is empty or missing in container:**
   
   This happens when `${POSTGRES_PASSWORD}` in `docker-compose.network.yml` isn't being substituted because the variable isn't in your shell environment.
   
   **Fix:**
   ```bash
   # Stop containers
   docker compose -p tas-production stop backend
   
   # Export variables to shell (critical step!)
   grep -v '^#' .env.production | grep -v '^$' | grep '=' | sed 's/#.*$//' | sed 's/[[:space:]]*$//' > /tmp/.env.clean
   set -a
   source /tmp/.env.clean
   set +a
   rm /tmp/.env.clean
   
   # Verify POSTGRES_PASSWORD is exported
   echo "POSTGRES_PASSWORD exported: ${POSTGRES_PASSWORD:+YES}"
   
   # Restart with variables in environment (docker-compose will substitute ${POSTGRES_PASSWORD})
   docker compose -f docker-compose.network.yml -p tas-production --env-file .env.production up -d --force-recreate backend
   
   # Verify DATABASE_URL is now set
   docker compose -p tas-production exec backend printenv DATABASE_URL
   ```

### DATABASE_URL Not Set in Container

**Problem:** Backend logs show "Database connection error: Please check your DATABASE_URL" and `DATABASE_URL` is empty in the container

**Root Cause:** The `docker-compose.network.yml` file uses `${POSTGRES_PASSWORD}` for variable substitution. Docker Compose needs this variable in your **shell environment** (not just in the env file) to perform the substitution before passing it to the container.

**⚡ IMMEDIATE FIX (Run this now):**

```bash
cd /opt/tas-production

# Stop the restarting container
docker compose -p tas-production stop backend

# Get POSTGRES_PASSWORD and construct DATABASE_URL
POSTGRES_PASSWORD=$(grep '^POSTGRES_PASSWORD=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)
export DATABASE_URL="postgresql://tas_user:${POSTGRES_PASSWORD}@postgres:5432/tas_db?schema=public&pool_timeout=0&connection_limit=20"
export POSTGRES_PASSWORD="$POSTGRES_PASSWORD"

# Export other required variables
export REDIS_PASSWORD="$(grep '^REDIS_PASSWORD=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)"
export JWT_SECRET="$(grep '^JWT_SECRET=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)"
export JWT_REFRESH_SECRET="$(grep '^JWT_REFRESH_SECRET=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)"
export ENCRYPTION_KEY="$(grep '^ENCRYPTION_KEY=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)"

# Verify DATABASE_URL is set
echo "DATABASE_URL: ${DATABASE_URL:0:50}..."

# CRITICAL: Create override file to ensure DATABASE_URL is passed to container
# This is the most reliable method
cat > /tmp/docker-compose.override.yml <<EOF
services:
  backend:
    environment:
      DATABASE_URL: "${DATABASE_URL}"
EOF

echo "Created override file with DATABASE_URL"

# Verify override file content
echo ""
echo "Override file content:"
cat /tmp/docker-compose.override.yml

# Verify what docker-compose will actually use (merged config)
echo ""
echo "Checking merged docker-compose configuration..."
docker compose -f docker-compose.network.yml -f /tmp/docker-compose.override.yml -p tas-production --env-file .env.production config 2>/dev/null | grep -A 15 "backend:" | grep -A 10 "environment:" | head -15

# Restart backend with override file (ensures DATABASE_URL is set)
echo ""
echo "Starting backend..."
docker compose -f docker-compose.network.yml -f /tmp/docker-compose.override.yml -p tas-production --env-file .env.production up -d --force-recreate backend

# Wait and verify
sleep 10
docker compose -p tas-production ps backend

# Check if DATABASE_URL is now in container (wait for container to be running)
for i in {1..15}; do
  if docker compose -p tas-production ps backend | grep -q "Up"; then
    echo "Container is running, checking DATABASE_URL..."
    DATABASE_URL_CHECK=$(docker compose -p tas-production exec backend printenv DATABASE_URL 2>/dev/null || echo "")
    if [ -n "$DATABASE_URL_CHECK" ]; then
      echo "✅ DATABASE_URL is set: ${DATABASE_URL_CHECK:0:60}..."
    else
      echo "❌ DATABASE_URL is still empty"
    fi
    break
  fi
  echo "Waiting for container... ($i/15)"
  sleep 2
done

# Check logs
echo ""
echo "=== Recent logs ==="
docker compose -p tas-production logs --tail=30 backend | grep -E "(Database|connected|error|success|Redis)"

# CRITICAL VERIFICATION: Check if DATABASE_URL is actually in the container
echo ""
echo "=== VERIFICATION: Checking DATABASE_URL in container ==="
sleep 5
for i in {1..20}; do
  if docker compose -p tas-production ps backend | grep -q "Up"; then
    DATABASE_URL_IN_CONTAINER=$(docker compose -p tas-production exec backend printenv DATABASE_URL 2>/dev/null || echo "")
    if [ -n "$DATABASE_URL_IN_CONTAINER" ]; then
      echo "✅ DATABASE_URL is set in container: ${DATABASE_URL_IN_CONTAINER:0:60}..."
      
      # Test database connection from backend container
      echo ""
      echo "=== Testing database connection from backend container ==="
      docker compose -p tas-production exec backend sh -c "node -e \"const { Pool } = require('pg'); const pool = new Pool({ connectionString: process.env.DATABASE_URL }); pool.query('SELECT NOW()', (err, res) => { if (err) { console.error('❌ Connection error:', err.message); process.exit(1); } else { console.log('✅ Connection successful:', res.rows[0]); process.exit(0); } pool.end(); });\"" 2>&1
      
      break
    else
      echo "❌ DATABASE_URL is still empty in container (attempt $i/20)"
      if [ $i -eq 20 ]; then
        echo ""
        echo "⚠️  DATABASE_URL is not being passed to container!"
        echo "   Checking what docker-compose is actually passing..."
        docker compose -f docker-compose.network.yml -f /tmp/docker-compose.override.yml -p tas-production --env-file .env.production config | grep -A 5 "backend:" | grep -A 3 "DATABASE_URL"
      fi
    fi
    break
  fi
  echo "Waiting for container to be ready... ($i/20)"
  sleep 2
done
```

**🔍 If database connection still fails, run these diagnostics:**

```bash
# Step 1: Check if DATABASE_URL is set in container
echo "=== Checking DATABASE_URL in container ==="
docker compose -p tas-production exec backend printenv DATABASE_URL || echo "❌ DATABASE_URL not set or container not running"

# Step 2: Check if PostgreSQL container is running
echo ""
echo "=== Checking PostgreSQL container ==="
docker compose -p tas-production ps postgres

# Step 3: Test PostgreSQL connectivity from backend container
echo ""
echo "=== Testing PostgreSQL connection ==="
POSTGRES_PASSWORD=$(grep '^POSTGRES_PASSWORD=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)
docker compose -p tas-production exec backend sh -c "PGPASSWORD=${POSTGRES_PASSWORD} psql -h postgres -U tas_user -d tas_db -c 'SELECT version();'" || echo "❌ Cannot connect to PostgreSQL"

# Step 4: Check if backend can reach postgres hostname
echo ""
echo "=== Testing network connectivity ==="
docker compose -p tas-production exec backend ping -c 2 postgres || echo "❌ Cannot reach postgres hostname"

# Step 5: Check PostgreSQL logs
echo ""
echo "=== PostgreSQL logs (last 20 lines) ==="
docker compose -p tas-production logs --tail=20 postgres

# Step 6: Verify DATABASE_URL format
echo ""
echo "=== Verifying DATABASE_URL format ==="
DATABASE_URL_IN_CONTAINER=$(docker compose -p tas-production exec backend printenv DATABASE_URL 2>/dev/null || echo "")
if [ -n "$DATABASE_URL_IN_CONTAINER" ]; then
  echo "DATABASE_URL: ${DATABASE_URL_IN_CONTAINER:0:60}..."
  # Check if it has the right format
  if echo "$DATABASE_URL_IN_CONTAINER" | grep -q "postgresql://tas_user:.*@postgres:5432/tas_db"; then
    echo "✅ DATABASE_URL format looks correct"
  else
    echo "❌ DATABASE_URL format is incorrect"
    echo "   Expected: postgresql://tas_user:PASSWORD@postgres:5432/tas_db?..."
  fi
else
  echo "❌ DATABASE_URL is empty in container!"
fi
```

**Detailed Solution:**

1. **Export environment variables to shell BEFORE running docker compose:**
   ```bash
   cd /opt/tas-production
   
   # Export variables (handles inline comments)
   grep -v '^#' .env.production | grep -v '^$' | grep '=' | sed 's/#.*$//' | sed 's/[[:space:]]*$//' > /tmp/.env.clean
   set -a
   source /tmp/.env.clean
   set +a
   rm /tmp/.env.clean
   
   # CRITICAL: Verify POSTGRES_PASSWORD is in shell
   echo "POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:0:10}..."
   ```

2. **Then run docker compose (it will substitute ${POSTGRES_PASSWORD}):**
   ```bash
   docker compose -f docker-compose.network.yml -p tas-production --env-file .env.production up -d --force-recreate backend
   ```

3. **Verify DATABASE_URL is set in container:**
   ```bash
   docker compose -p tas-production exec backend printenv DATABASE_URL
   # Should show: postgresql://tas_user:YOUR_PASSWORD@postgres:5432/tas_db?schema=public&pool_timeout=0&connection_limit=20
   ```

**Why this happens:**
- `--env-file .env.production` makes variables available to Docker Compose
- But `${POSTGRES_PASSWORD}` substitution in the compose file requires the variable to be in your **shell environment**
- Without export, Docker Compose can't substitute `${POSTGRES_PASSWORD}` → DATABASE_URL becomes empty → Backend can't connect

**Note about ".env file not found" warning:**
- The backend code checks for `/app/.env` as a fallback
- This is **normal and expected** - the backend will use environment variables from Docker Compose
- The warning is harmless if environment variables are properly set

### Persistent Database Connection Errors

**Problem:** Database connection error persists even after setting DATABASE_URL

**🔍 FIRST: Run this comprehensive diagnostic:**

```bash
cd /opt/tas-production

echo "=== DIAGNOSTIC: Why database connection is failing ==="
echo ""

# Step 1: Check if DATABASE_URL is in container
echo "1. Checking DATABASE_URL in container..."
sleep 3
DATABASE_URL_IN_CONTAINER=$(docker compose -p tas-production exec backend printenv DATABASE_URL 2>/dev/null || echo "NOT_SET")
if [ "$DATABASE_URL_IN_CONTAINER" = "NOT_SET" ]; then
  echo "   ❌ DATABASE_URL is NOT set in container"
  echo "   This is the problem - DATABASE_URL is not being passed to the container"
else
  echo "   ✅ DATABASE_URL is set: ${DATABASE_URL_IN_CONTAINER:0:60}..."
fi

# Step 2: Check what docker-compose is actually passing
echo ""
echo "2. Checking what docker-compose config shows..."
docker compose -f docker-compose.network.yml -f /tmp/docker-compose.override.yml -p tas-production --env-file .env.production config 2>/dev/null | grep -A 3 "DATABASE_URL" | head -5 || echo "   Override file may not exist"

# Step 3: Get password from .env and test PostgreSQL directly
echo ""
echo "3. Testing PostgreSQL connection with password from .env.production..."
POSTGRES_PASSWORD=$(grep '^POSTGRES_PASSWORD=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)
if [ -z "$POSTGRES_PASSWORD" ]; then
  echo "   ❌ POSTGRES_PASSWORD is empty in .env.production!"
else
  echo "   POSTGRES_PASSWORD length: ${#POSTGRES_PASSWORD}"
  # Test connection
  docker compose -p tas-production exec postgres psql -U tas_user -d tas_db -c "SELECT 1;" > /dev/null 2>&1
  if [ $? -eq 0 ]; then
    echo "   ✅ PostgreSQL is accessible with current password"
  else
    echo "   ❌ Cannot connect to PostgreSQL - password may be wrong"
  fi
fi

# Step 4: Test connection from backend container if DATABASE_URL is set
if [ "$DATABASE_URL_IN_CONTAINER" != "NOT_SET" ]; then
  echo ""
  echo "4. Testing database connection from backend container..."
  docker compose -p tas-production exec backend sh -c 'node -e "const { Pool } = require(\"pg\"); const pool = new Pool({ connectionString: process.env.DATABASE_URL }); pool.query(\"SELECT NOW()\", (err, res) => { if (err) { console.error(\"❌ Error:\", err.message); process.exit(1); } else { console.log(\"✅ Success:\", res.rows[0].now); process.exit(0); } pool.end(); });"' 2>&1
fi

# Step 5: Check network connectivity
echo ""
echo "5. Testing network connectivity..."
docker compose -p tas-production exec backend ping -c 2 postgres > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "   ✅ Backend can reach postgres hostname"
else
  echo "   ❌ Backend cannot reach postgres hostname"
fi

echo ""
echo "=== Diagnostic complete ==="
```

**Based on diagnostic results, apply the appropriate fix below.**

**Complete Diagnostic and Fix:**

```bash
cd /opt/tas-production

# ===== DIAGNOSTIC PHASE =====
echo "=== Step 1: Check DATABASE_URL in container ==="
docker compose -p tas-production exec backend printenv DATABASE_URL 2>/dev/null || echo "❌ Container not running or DATABASE_URL not set"

echo ""
echo "=== Step 2: Check PostgreSQL container ==="
docker compose -p tas-production ps postgres

echo ""
echo "=== Step 3: Test PostgreSQL from host ==="
POSTGRES_PASSWORD=$(grep '^POSTGRES_PASSWORD=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)
docker compose -p tas-production exec postgres psql -U tas_user -d tas_db -c "SELECT version();" 2>&1 || echo "❌ Cannot connect to PostgreSQL"

echo ""
echo "=== Step 4: Test network connectivity ==="
docker compose -p tas-production exec backend ping -c 2 postgres 2>&1 | head -5

echo ""
echo "=== Step 5: Check PostgreSQL logs ==="
docker compose -p tas-production logs --tail=10 postgres

# ===== FIX PHASE =====
echo ""
echo "=== Applying Fix ==="

# Stop backend
docker compose -p tas-production stop backend

# Get password and construct DATABASE_URL
POSTGRES_PASSWORD=$(grep '^POSTGRES_PASSWORD=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)

# Verify password is not empty
if [ -z "$POSTGRES_PASSWORD" ]; then
  echo "❌ ERROR: POSTGRES_PASSWORD is empty in .env.production!"
  echo "   Check your .env.production file"
  exit 1
fi

# Construct DATABASE_URL (URL-encode password if it has special characters)
# For now, use it directly - if it has special chars, they may need encoding
export DATABASE_URL="postgresql://tas_user:${POSTGRES_PASSWORD}@postgres:5432/tas_db?schema=public&pool_timeout=0&connection_limit=20"
export POSTGRES_PASSWORD="$POSTGRES_PASSWORD"

# Export all other variables
export REDIS_PASSWORD="$(grep '^REDIS_PASSWORD=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)"
export JWT_SECRET="$(grep '^JWT_SECRET=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)"
export JWT_REFRESH_SECRET="$(grep '^JWT_REFRESH_SECRET=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)"
export ENCRYPTION_KEY="$(grep '^ENCRYPTION_KEY=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)"

# Verify DATABASE_URL
echo "DATABASE_URL: ${DATABASE_URL:0:60}..."
echo "POSTGRES_PASSWORD length: ${#POSTGRES_PASSWORD}"

# Ensure PostgreSQL is running first
echo ""
echo "=== Ensuring PostgreSQL is running ==="
docker compose -p tas-production up -d postgres
sleep 5

# Test PostgreSQL connection with the password
echo "Testing PostgreSQL connection..."
docker compose -p tas-production exec -T postgres psql -U tas_user -d tas_db -c "SELECT 1;" > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "✅ PostgreSQL is accessible"
else
  echo "❌ ERROR: Cannot connect to PostgreSQL with current password"
  echo "   Check if POSTGRES_PASSWORD in .env.production matches PostgreSQL container"
  echo "   You may need to recreate PostgreSQL container with correct password"
fi

# Restart backend with all variables
echo ""
echo "=== Restarting backend ==="

# Create override file to ensure DATABASE_URL is set
cat > /tmp/docker-compose.override.yml <<EOF
services:
  backend:
    environment:
      DATABASE_URL: "${DATABASE_URL}"
EOF

echo "Created override file with DATABASE_URL"

# Verify override file was created correctly
echo ""
echo "Verifying override file..."
cat /tmp/docker-compose.override.yml

# Verify what docker-compose will actually use
echo ""
echo "Checking what docker-compose will pass to backend..."
docker compose -f docker-compose.network.yml -f /tmp/docker-compose.override.yml -p tas-production --env-file .env.production config 2>/dev/null | grep -A 10 "backend:" | grep -A 5 "environment:" | head -10

# Start with override file (this ensures DATABASE_URL is set)
echo ""
echo "Starting backend with override file..."
docker compose -f docker-compose.network.yml -f /tmp/docker-compose.override.yml -p tas-production --env-file .env.production up -d --force-recreate backend

# Wait and verify
sleep 10
echo ""
echo "=== Verification ==="
docker compose -p tas-production ps backend

# Check DATABASE_URL in container
for i in {1..15}; do
  if docker compose -p tas-production ps backend | grep -q "Up"; then
    echo ""
    echo "Container is running. Checking DATABASE_URL..."
    DATABASE_URL_CHECK=$(docker compose -p tas-production exec backend printenv DATABASE_URL 2>/dev/null || echo "")
    if [ -n "$DATABASE_URL_CHECK" ]; then
      echo "✅ DATABASE_URL is set: ${DATABASE_URL_CHECK:0:60}..."
    else
      echo "❌ DATABASE_URL is still empty in container"
    fi
    break
  fi
  echo "Waiting for container... ($i/15)"
  sleep 2
done

# Check logs
echo ""
echo "=== Recent backend logs ==="
docker compose -p tas-production logs --tail=20 backend | grep -E "(Database|connected|error|success|Redis)"

# FINAL CHECK: List all environment variables in container
echo ""
echo "=== All environment variables in backend container ==="
docker compose -p tas-production exec backend printenv | grep -E "(DATABASE|POSTGRES|REDIS|JWT|ENCRYPTION)" | sort

# If DATABASE_URL is still empty, show all env vars
if [ -z "$DATABASE_URL_CHECK" ]; then
  echo ""
  echo "⚠️  DATABASE_URL is still empty. Showing ALL environment variables:"
  docker compose -p tas-production exec backend printenv | sort
fi
```

**If DATABASE_URL is still empty after this fix:**

The override file method should work, but if it doesn't, try this alternative:

```bash
# Alternative: Check if docker-compose.network.yml has the correct structure
echo "Checking docker-compose.network.yml structure..."
grep -A 5 "DATABASE_URL" docker-compose.network.yml

# If DATABASE_URL is defined incorrectly, you may need to modify docker-compose.network.yml directly
# Or use this workaround - set it via docker run command (not recommended for production)
```

**If DATABASE_URL is set in docker-compose config but backend still can't connect:**

The docker-compose config shows DATABASE_URL correctly, but the backend is still failing. This could mean:
1. DATABASE_URL is not actually reaching the container
2. Backend code is not reading DATABASE_URL correctly
3. Timing issue - backend starts before database is ready

**🔍 COMPREHENSIVE DIAGNOSTIC:**

```bash
cd /opt/tas-production

# Get password
POSTGRES_PASSWORD=$(grep '^POSTGRES_PASSWORD=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)

echo "=== COMPREHENSIVE DIAGNOSTIC ==="
echo ""

# Step 1: Stop the restarting container so we can check it
docker compose -p tas-production stop backend
sleep 2

# Step 2: Start backend temporarily to check environment
echo "1. Starting backend to check environment variables..."
docker compose -f docker-compose.network.yml -f /tmp/docker-compose.override.yml -p tas-production --env-file .env.production up -d backend
sleep 5

# Step 3: Try to get DATABASE_URL from container (even if it's restarting)
echo ""
echo "2. Checking DATABASE_URL in container..."
# Try multiple times since container might be restarting
for i in {1..10}; do
  DATABASE_URL_IN_CONTAINER=$(docker compose -p tas-production exec backend printenv DATABASE_URL 2>/dev/null || echo "")
  if [ -n "$DATABASE_URL_IN_CONTAINER" ]; then
    echo "   ✅ DATABASE_URL is set: ${DATABASE_URL_IN_CONTAINER:0:60}..."
    break
  fi
  echo "   Attempt $i/10: DATABASE_URL not accessible (container may be restarting)"
  sleep 2
done

# Step 4: If we got DATABASE_URL, test connection from backend container
if [ -n "$DATABASE_URL_IN_CONTAINER" ]; then
  echo ""
  echo "3. Testing database connection from backend container using DATABASE_URL..."
  docker compose -p tas-production exec backend sh -c 'node -e "const { Pool } = require(\"pg\"); const pool = new Pool({ connectionString: process.env.DATABASE_URL }); pool.query(\"SELECT NOW()\", (err, res) => { if (err) { console.error(\"❌ Error:\", err.message); process.exit(1); } else { console.log(\"✅ Success:\", res.rows[0].now); process.exit(0); } pool.end(); });"' 2>&1
else
  echo ""
  echo "3. ❌ Cannot test - DATABASE_URL not accessible in container"
  echo "   Showing all environment variables:"
  docker compose -p tas-production exec backend printenv 2>/dev/null | grep -E "(DATABASE|POSTGRES)" | sort || echo "   Cannot access container environment"
fi

# Step 5: Check backend logs for more details
echo ""
echo "4. Recent backend logs:"
docker compose -p tas-production logs --tail=30 backend | grep -E "(Database|DATABASE|connection|error|DATABASE_URL)" | head -10
```

**If DATABASE_URL is set but connection still fails:**

```bash
cd /opt/tas-production

# Get password from .env.production
POSTGRES_PASSWORD=$(grep '^POSTGRES_PASSWORD=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)

echo "=== DIAGNOSTIC: Why database connection is failing ==="
echo ""

# Step 1: Check if PostgreSQL is running
echo "1. Checking PostgreSQL container..."
docker compose -p tas-production ps postgres

# Step 2: Check if database exists
echo ""
echo "2. Checking if database 'tas_db' exists..."
docker compose -p tas-production exec postgres psql -U postgres -c "\l" 2>/dev/null | grep tas_db || echo "   ❌ Database 'tas_db' NOT FOUND"

# Step 3: Check if user exists
echo ""
echo "3. Checking if user 'tas_user' exists..."
docker compose -p tas-production exec postgres psql -U postgres -c "\du" 2>/dev/null | grep tas_user || echo "   ❌ User 'tas_user' NOT FOUND"

# Step 4: Test connection with password from .env.production
echo ""
echo "4. Testing connection with password from .env.production..."
docker compose -p tas-production exec postgres psql -U tas_user -d tas_db -c "SELECT 1;" 2>&1
if [ $? -eq 0 ]; then
  echo "   ✅ Connection successful - password is correct"
else
  echo "   ❌ Connection failed - password may be wrong or database/user doesn't exist"
fi

# Step 5: Check what password PostgreSQL container is using
echo ""
echo "5. Checking PostgreSQL container environment..."
docker compose -p tas-production exec postgres printenv POSTGRES_PASSWORD | head -c 10
echo "... (first 10 chars)"
echo "   Compare with POSTGRES_PASSWORD in .env.production"

# Step 6: Check DATABASE_URL in backend container (even if restarting)
echo ""
echo "6. Checking DATABASE_URL in backend container..."
BACKEND_CONTAINER_ID=$(docker compose -p tas-production ps -q backend 2>/dev/null | head -1)
if [ -n "$BACKEND_CONTAINER_ID" ]; then
  echo "   Backend container ID: $BACKEND_CONTAINER_ID"
  # Try to get DATABASE_URL from container environment (works even if restarting)
  DATABASE_URL_FROM_INSPECT=$(docker inspect $BACKEND_CONTAINER_ID 2>/dev/null | grep -o '"DATABASE_URL=[^"]*"' | cut -d= -f2- | tr -d '"' || echo "")
  if [ -n "$DATABASE_URL_FROM_INSPECT" ]; then
    echo "   ✅ DATABASE_URL found in container: ${DATABASE_URL_FROM_INSPECT:0:60}..."
    echo "   Testing if this URL works..."
    # Extract password from DATABASE_URL
    DB_PASS_FROM_URL=$(echo "$DATABASE_URL_FROM_INSPECT" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
    if [ "$DB_PASS_FROM_URL" = "$POSTGRES_PASSWORD" ]; then
      echo "   ✅ Password in DATABASE_URL matches .env.production"
    else
      echo "   ❌ Password mismatch! URL has different password than .env.production"
    fi
  else
    echo "   ❌ DATABASE_URL NOT found in container environment"
    echo "   Showing all DATABASE/POSTGRES related env vars:"
    docker inspect $BACKEND_CONTAINER_ID 2>/dev/null | grep -A 200 '"Env"' | grep -E "(DATABASE|POSTGRES)" | head -5
  fi
else
  echo "   ⚠️  Backend container not found or not running"
fi

# Step 7: If DATABASE_URL is set, test connection from backend container
echo ""
echo "7. Testing database connection FROM backend container (using DATABASE_URL)..."
BACKEND_CONTAINER_ID=$(docker compose -p tas-production ps -q backend 2>/dev/null | head -1)
if [ -n "$BACKEND_CONTAINER_ID" ]; then
  DATABASE_URL_FROM_INSPECT=$(docker inspect $BACKEND_CONTAINER_ID 2>/dev/null | grep -o '"DATABASE_URL=[^"]*"' | cut -d= -f2- | tr -d '"' || echo "")
  if [ -n "$DATABASE_URL_FROM_INSPECT" ]; then
    echo "   DATABASE_URL found, testing connection..."
    # Test network connectivity first
    echo "   a) Testing network connectivity backend -> postgres..."
    docker compose -p tas-production exec backend ping -c 2 postgres >/dev/null 2>&1
    if [ $? -eq 0 ]; then
      echo "      ✅ Network OK"
    else
      echo "      ❌ Network FAILED - containers can't communicate"
    fi
    
    # Test connection using Node.js (same as backend app)
    echo "   b) Testing database connection using Node.js..."
    docker compose -p tas-production exec backend sh -c '
      node -e "
        const { Pool } = require(\"pg\");
        const pool = new Pool({ connectionString: process.env.DATABASE_URL });
        pool.query(\"SELECT NOW() as time, version() as version\", (err, res) => {
          if (err) {
            console.error(\"❌ Error:\", err.message);
            console.error(\"Code:\", err.code);
            console.error(\"Detail:\", err.detail || \"N/A\");
            process.exit(1);
          } else {
            console.log(\"✅ Connection Successful!\");
            console.log(\"Time:\", res.rows[0].time);
            console.log(\"PostgreSQL:\", res.rows[0].version.split(\" \")[0] + \" \" + res.rows[0].version.split(\" \")[1]);
            pool.end();
            process.exit(0);
          }
        });
      "
    ' 2>&1
  else
    echo "   ⚠️  Cannot test - DATABASE_URL not found in container"
  fi
fi

# Step 8: Check backend logs for specific error messages
echo ""
echo "8. Recent backend error logs:"
docker compose -p tas-production logs --tail=50 backend 2>&1 | grep -E "(error|Error|ERROR|Database|DATABASE|connection|Connection|failed|Failed)" | tail -15
```

**⚡ IMMEDIATE FIX: URL-Encode Password in DATABASE_URL**

The password contains special characters (like `/`) that need URL encoding. Run this fix:

```bash
cd /opt/tas-production

# Stop the restarting container
docker compose -p tas-production stop backend
docker compose -p tas-production rm -f backend

# Get password from .env.production
POSTGRES_PASSWORD=$(grep '^POSTGRES_PASSWORD=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)

# URL-encode the password (special characters like / need encoding)
# Try Python first
if command -v python3 >/dev/null 2>&1; then
  POSTGRES_PASSWORD_ENCODED=$(python3 -c "import urllib.parse; print(urllib.parse.quote('${POSTGRES_PASSWORD}', safe=''))")
elif command -v node >/dev/null 2>&1; then
  POSTGRES_PASSWORD_ENCODED=$(node -e "console.log(encodeURIComponent('${POSTGRES_PASSWORD}'))")
else
  # Manual encoding for common characters (fallback)
  POSTGRES_PASSWORD_ENCODED=$(echo "${POSTGRES_PASSWORD}" | sed 's|/|%2F|g' | sed 's|@|%40|g' | sed 's|:|%3A|g' | sed 's|#|%23|g' | sed 's|?|%3F|g' | sed 's|&|%26|g')
fi

echo "Original password: ${POSTGRES_PASSWORD:0:20}..."
echo "Encoded password: ${POSTGRES_PASSWORD_ENCODED:0:20}..."

# Create DATABASE_URL with URL-encoded password
DATABASE_URL_VALUE="postgresql://tas_user:${POSTGRES_PASSWORD_ENCODED}@postgres:5432/tas_db?schema=public&pool_timeout=0&connection_limit=20"

# Create override file
printf 'services:\n  backend:\n    environment:\n      DATABASE_URL: "%s"\n' "${DATABASE_URL_VALUE}" > /tmp/docker-compose.override.yml

echo "Override file created with URL-encoded password"
cat /tmp/docker-compose.override.yml

# Restart backend with encoded password
docker compose -f docker-compose.network.yml -f /tmp/docker-compose.override.yml -p tas-production --env-file .env.production up -d backend

# Wait and check logs
sleep 10
echo ""
echo "=== Backend logs (last 20 lines) ==="
docker compose -p tas-production logs --tail=20 backend | grep -E "(Database|connected|error|success|PostgreSQL)"
```

**Based on diagnostic results:**

**If database doesn't exist:**
```bash
# Database will be created automatically when PostgreSQL starts with POSTGRES_DB environment variable
# But if it doesn't exist, create it manually:
docker compose -p tas-production exec postgres psql -U postgres -c "CREATE DATABASE tas_db;"
docker compose -p tas-production exec postgres psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE tas_db TO tas_user;"
```

**If user doesn't exist:**
```bash
# User should be created automatically, but if not:
docker compose -p tas-production exec postgres psql -U postgres -c "CREATE USER tas_user WITH PASSWORD '${POSTGRES_PASSWORD}';"
docker compose -p tas-production exec postgres psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE tas_db TO tas_user;"
```

**If password is wrong (most likely issue):**

The PostgreSQL container was created with a different password than what's in `.env.production`. You need to recreate it:

```bash
# WARNING: This will delete existing data if you remove the volume!
# Step 1: Stop containers
docker compose -p tas-production stop postgres backend

# Step 2: Remove PostgreSQL container (data in volume is preserved)
docker compose -p tas-production rm -f postgres

# Step 3: Export POSTGRES_PASSWORD
export POSTGRES_PASSWORD="$(grep '^POSTGRES_PASSWORD=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)"

# Step 4: Recreate PostgreSQL with correct password
docker compose -f docker-compose.network.yml -p tas-production --env-file .env.production up -d postgres

# Step 5: Wait for PostgreSQL to be ready
sleep 10
docker compose -p tas-production exec postgres pg_isready -U tas_user -d tas_db

# Step 6: Test connection
docker compose -p tas-production exec postgres psql -U tas_user -d tas_db -c "SELECT version();"

# Step 7: If connection works, restart backend
docker compose -f docker-compose.network.yml -f /tmp/docker-compose.override.yml -p tas-production --env-file .env.production up -d backend
```

**If you need to start completely fresh (WARNING: Deletes all data):**
```bash
# Stop everything
docker compose -p tas-production stop postgres backend

# Remove containers
docker compose -p tas-production rm -f postgres backend

# Remove volume (DELETES ALL DATA!)
docker volume rm tas-production_postgres_data

# Restart with correct password
export POSTGRES_PASSWORD="$(grep '^POSTGRES_PASSWORD=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)"
docker compose -f docker-compose.network.yml -p tas-production --env-file .env.production up -d postgres
sleep 10
docker compose -f docker-compose.network.yml -f /tmp/docker-compose.override.yml -p tas-production --env-file .env.production up -d backend
```

### Container Restarting/Crashing

**Problem:** Container shows "Restarting" status or crashes immediately after starting

**Diagnosis Steps:**

```bash
# Step 1: Check container status
docker compose -p tas-production ps backend

# Step 2: View recent logs to see error
docker compose -p tas-production logs --tail=100 backend

# Step 3: Check if it's a crash loop (restarting repeatedly)
docker compose -p tas-production ps backend | grep -i restart

# Step 4: Try to get into container (if it's running briefly)
docker compose -p tas-production exec backend sh
# If this fails with "container is restarting", the container is crashing too fast
```

**Common Causes and Fixes:**

1. **DATABASE_URL not set or incorrect:**
   ```bash
   # Check if DATABASE_URL is set in container (wait for it to be running)
   docker compose -p tas-production exec backend printenv DATABASE_URL
   
   # If empty, follow the DATABASE_URL fix steps above
   ```

2. **Database connection failing:**
   ```bash
   # Check if PostgreSQL is running
   docker compose -p tas-production ps postgres
   
   # Check PostgreSQL logs
   docker compose -p tas-production logs postgres
   
   # Test connection from host
   docker compose -p tas-production exec postgres pg_isready -U tas_user -d tas_db
   ```

3. **Permission errors (logs directory):**
   ```bash
   # Fix permissions
   chmod 777 backend/logs backend/uploads
   
   # Restart
   docker compose -p tas-production restart backend
   ```

4. **Environment variables missing:**
   ```bash
   # Check what environment variables are in the container
   docker compose -p tas-production exec backend env | sort
   
   # Compare with what should be there
   # Ensure all required variables are exported before starting
   ```

**Fix: Stop and restart with proper environment:**

```bash
cd /opt/tas-production

# Stop the container
docker compose -p tas-production stop backend

# Ensure environment variables are exported (use the manual export method)
export POSTGRES_PASSWORD="$(grep '^POSTGRES_PASSWORD=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)"
export REDIS_PASSWORD="$(grep '^REDIS_PASSWORD=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)"
export DATABASE_URL="postgresql://tas_user:${POSTGRES_PASSWORD}@postgres:5432/tas_db?schema=public&pool_timeout=0&connection_limit=20"
# ... export other variables as needed

# Start with proper environment
docker compose -f docker-compose.network.yml -p tas-production --env-file .env.production up -d backend

# Wait and check status
sleep 10
docker compose -p tas-production ps backend

# If still restarting, check logs
docker compose -p tas-production logs --tail=50 backend
```

### CORS Errors

**Problem:** Browser shows CORS errors

**Solution:**
1. Ensure `CORS_ORIGIN` in backend environment file (`.env.testing` or `.env.production`) includes frontend URL
2. Restart backend: `docker compose restart backend`
3. Check browser console for exact error
4. Verify frontend and backend are using the same environment (testing or production)

### Permission Denied Errors (Logs/Uploads)

**Problem:** `EACCES: permission denied, open 'logs/error-2026-01-13.log'`

**Solution:**
1. **Create directories and set permissions before starting containers:**
   ```bash
   cd /opt/tas-production
   mkdir -p backend/logs backend/uploads
   chmod 777 backend/logs backend/uploads
   ```

2. **If containers are already running, fix permissions:**
   ```bash
   # Stop containers first
   docker compose -p tas-production stop backend
   
   # Fix permissions
   chmod -R 777 backend/logs backend/uploads
   
   # Or set ownership to container user (usually UID 1000)
   chown -R 1000:1000 backend/logs backend/uploads
   
   # Restart containers
   docker compose -p tas-production start backend
   ```

3. **Verify permissions:**
   ```bash
   ls -la backend/logs
   ls -la backend/uploads
   ```

### .env File Not Found Warning

**Problem:** Backend logs show `.env file exists: false` and `.env file not found`

**Solution:**
- This warning is **normal** and **not critical** when using Docker Compose with `--env-file`
- The backend code checks for `.env` file as a fallback, but will use environment variables passed by Docker Compose
- Ensure all required variables are in `.env.production` and passed via `--env-file .env.production`
- The backend should still work correctly with environment variables from the compose file
- If the backend fails to start, check that all required environment variables are set in `.env.production`

---

## Maintenance Commands

### Update Application

**⚠️ IMPORTANT:** When pulling new code from GitHub, you may need to rebuild Docker containers if:
- Backend code changed (Dockerfile, package.json, source code)
- Frontend code changed (Dockerfile, package.json, source code)
- Docker Compose files changed
- Database migrations were added

**If only environment files or documentation changed**, a simple restart is sufficient.

#### Testing Environment

**Backend Server:**

```bash
# Navigate to deployment directory
cd /opt/tas-testing

# Pull latest code from GitHub
git pull

# Check what changed (optional - to see if rebuild is needed)
git log --oneline -5

# If backend code changed, rebuild and restart
docker compose -f docker-compose.network.yml -p tas-testing --env-file .env.testing up -d --build backend

# If only environment/config changed, just restart
# docker compose -p tas-testing --env-file .env.testing restart backend

# Verify backend is running
docker compose -p tas-testing ps backend
docker compose -p tas-testing logs --tail=20 backend

# Test health endpoint
curl http://localhost:4000/health
```

**Frontend Server:**

```bash
# Navigate to deployment directory
cd /opt/tas-testing

# Pull latest code from GitHub
git pull

# If frontend code changed, rebuild and restart
docker compose -f docker-compose.network.yml -p tas-testing --env-file .env.testing up -d --build frontend candidate-portal nginx

# If only environment/config changed, just restart
# docker compose -p tas-testing --env-file .env.testing restart frontend candidate-portal nginx

# Verify services are running
docker compose -p tas-testing ps
```

#### Production Environment

**Backend Server:**

```bash
# Navigate to deployment directory
cd /opt/tas-production

# Pull latest code from GitHub
git pull

# Check what changed (optional - to see if rebuild is needed)
git log --oneline -5

# Export environment variables (needed for variable substitution)
export POSTGRES_PASSWORD="$(grep '^POSTGRES_PASSWORD=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)"
export REDIS_PASSWORD="$(grep '^REDIS_PASSWORD=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)"
export JWT_SECRET="$(grep '^JWT_SECRET=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)"
export JWT_REFRESH_SECRET="$(grep '^JWT_REFRESH_SECRET=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)"
export ENCRYPTION_KEY="$(grep '^ENCRYPTION_KEY=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)"
export FRONTEND_URL="$(grep '^FRONTEND_URL=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)"
export CANDIDATE_PORTAL_URL="$(grep '^CANDIDATE_PORTAL_URL=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)"
export CORS_ORIGIN="$(grep '^CORS_ORIGIN=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)"

# If backend code changed, rebuild with override file (for DATABASE_URL)
POSTGRES_PASSWORD_ENC=$(python3 -c "import urllib.parse; print(urllib.parse.quote('${POSTGRES_PASSWORD}', safe=''))" 2>/dev/null || echo "${POSTGRES_PASSWORD}")
DATABASE_URL_VALUE="postgresql://tas_user:${POSTGRES_PASSWORD_ENC}@postgres:5432/tas_db?schema=public&pool_timeout=0&connection_limit=20"
printf 'services:\n  backend:\n    environment:\n      DATABASE_URL: "%s"\n' "${DATABASE_URL_VALUE}" > /tmp/docker-compose.override.yml

docker compose -f docker-compose.network.yml -f /tmp/docker-compose.override.yml -p tas-production --env-file .env.production up -d --build backend

# If only environment/config changed, just restart
# docker compose -f docker-compose.network.yml -f /tmp/docker-compose.override.yml -p tas-production --env-file .env.production restart backend

# Wait for backend to be ready
sleep 5

# Verify backend is running
docker compose -p tas-production ps backend
docker compose -p tas-production logs --tail=20 backend | grep -E "(Server|running|error|Error|listening)"

# Test health endpoint
curl http://localhost:4000/health

# If database migrations were added, run them
docker compose -p tas-production exec backend npx prisma migrate deploy
```

**Frontend Server:**

```bash
# Navigate to deployment directory
cd /opt/tas-production

# Pull latest code from GitHub
git pull

# If frontend code changed, rebuild and restart
# ⚠️ Use docker-compose.frontend.yml for frontend server (no backend services)
docker compose -f docker-compose.frontend.yml -p tas-production --env-file .env.production up -d --build

# If only environment/config changed, just restart
# docker compose -p tas-production restart frontend candidate-portal nginx

# Verify services are running
docker compose -p tas-production ps

# Test frontend (if accessible)
curl http://localhost:8080 2>&1 | head -20
```

**Quick Update Script (Production Backend):**

For convenience, you can create a script to automate the update process:

```bash
# Create update script
cat > /opt/tas-production/update-backend.sh << 'EOF'
#!/bin/bash
set -e

cd /opt/tas-production

echo "=== Pulling latest code from GitHub ==="
git pull

echo ""
echo "=== Exporting environment variables ==="
export POSTGRES_PASSWORD="$(grep '^POSTGRES_PASSWORD=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)"
export REDIS_PASSWORD="$(grep '^REDIS_PASSWORD=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)"
export JWT_SECRET="$(grep '^JWT_SECRET=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)"
export JWT_REFRESH_SECRET="$(grep '^JWT_REFRESH_SECRET=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)"
export ENCRYPTION_KEY="$(grep '^ENCRYPTION_KEY=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)"
export FRONTEND_URL="$(grep '^FRONTEND_URL=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)"
export CANDIDATE_PORTAL_URL="$(grep '^CANDIDATE_PORTAL_URL=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)"
export CORS_ORIGIN="$(grep '^CORS_ORIGIN=' .env.production | cut -d= -f2- | sed 's/#.*$//' | xargs)"

echo ""
echo "=== Creating DATABASE_URL override ==="
POSTGRES_PASSWORD_ENC=$(python3 -c "import urllib.parse; print(urllib.parse.quote('${POSTGRES_PASSWORD}', safe=''))" 2>/dev/null || echo "${POSTGRES_PASSWORD}")
DATABASE_URL_VALUE="postgresql://tas_user:${POSTGRES_PASSWORD_ENC}@postgres:5432/tas_db?schema=public&pool_timeout=0&connection_limit=20"
printf 'services:\n  backend:\n    environment:\n      DATABASE_URL: "%s"\n' "${DATABASE_URL_VALUE}" > /tmp/docker-compose.override.yml

echo ""
echo "=== Rebuilding and restarting backend ==="
docker compose -f docker-compose.network.yml -f /tmp/docker-compose.override.yml -p tas-production --env-file .env.production up -d --build backend

echo ""
echo "=== Waiting for backend to be ready ==="
sleep 5

echo ""
echo "=== Running database migrations (if any) ==="
docker compose -p tas-production exec backend npx prisma migrate deploy || echo "No new migrations"

echo ""
echo "=== Verifying backend health ==="
docker compose -p tas-production ps backend
curl -s http://localhost:4000/health | head -5

echo ""
echo "✅ Backend update complete!"
EOF

chmod +x /opt/tas-production/update-backend.sh

# Run the update script
/opt/tas-production/update-backend.sh
```

### View Logs

#### Testing Environment

```bash
# Testing Backend server
cd /opt/tas-testing
docker compose -p tas-testing logs -f backend
docker compose -p tas-testing logs -f postgres

# Testing Frontend server
cd /opt/tas-testing
docker compose -p tas-testing logs -f frontend
docker compose -p tas-testing logs -f nginx
```

#### Production Environment

```bash
# Production Backend server (using project name)
cd /opt/tas-production
docker compose -p tas-production logs -f backend
docker compose -p tas-production logs -f postgres

# Production Frontend server (using project name)
cd /opt/tas-production
docker compose -p tas-production logs -f frontend
docker compose -p tas-production logs -f nginx
```

### Backup Database

#### Testing Environment

```bash
# On testing backend server
cd /opt/tas-testing
docker compose -p tas-testing exec postgres pg_dump -U tas_user tas_db > backup_testing_$(date +%Y%m%d_%H%M%S).sql
```

#### Production Environment

```bash
# On production backend server (using project name)
cd /opt/tas-production
docker compose -p tas-production exec postgres pg_dump -U tas_user tas_db > backup_production_$(date +%Y%m%d_%H%M%S).sql
```

### Restore Database

#### Testing Environment

```bash
# On testing backend server
cd /opt/tas-testing
cat backup_testing_20241120_120000.sql | docker compose -p tas-testing exec -T postgres psql -U tas_user tas_db
```

#### Production Environment

```bash
# On production backend server (using project name)
cd /opt/tas-production
cat backup_production_20241120_120000.sql | docker compose -p tas-production exec -T postgres psql -U tas_user tas_db
```

### Switch Between Environments

When working on a server, always specify the environment file and project name:

```bash
# Testing environment
docker compose -p tas-testing --env-file .env.testing <command>

# Production environment
docker compose -p tas-production --env-file .env.production <command>
```

### Check for Conflicts with Other Applications

To verify your deployment is isolated and not affecting other applications:

```bash
# List all containers (should show both TAS and other app containers)
docker ps -a

# List all networks (TAS should have its own isolated network)
docker network ls

# List all volumes (TAS volumes should be prefixed with project name)
docker volume ls

# Check if TAS containers are isolated (should only show TAS containers)
docker ps --filter "name=tas-production"

# Check port usage (verify no unexpected conflicts)
netstat -tulpn | grep -E "(5432|6379|4000|4001|4002|80|443)"
```

---

## Security Checklist

- [ ] Changed default production user password
- [ ] Strong passwords for PostgreSQL and Redis
- [ ] Strong JWT secrets (64+ characters)
- [ ] Firewall configured (only necessary ports open)
- [ ] CORS properly configured
- [ ] SSL/HTTPS configured (for production)
- [ ] Regular backups scheduled
- [ ] Monitoring and alerting set up

---

## Environment File Management

### Environment File Structure

Each environment uses its own configuration file:

- **Local Development**: `.env.local`
- **Testing Environment**: `.env.testing`
- **Production Environment**: `.env.production`

### Using Environment Files with Docker Compose

Always specify the environment file when running docker compose commands:

```bash
# Testing environment
docker compose --env-file .env.testing up -d

# Production environment
docker compose --env-file .env.production up -d

# Local environment
docker compose --env-file .env.local up -d
```

### Environment File Best Practices

1. **Never commit environment files to Git**
   - Add `.env.*` to `.gitignore`
   - Keep `.env.*.template` files as templates

2. **Use different secrets for each environment**
   - Generate unique passwords, JWT secrets, and encryption keys
   - Never reuse production secrets in testing

3. **Document environment-specific values**
   - Keep a secure password manager for production secrets
   - Document which IPs and ports are used for each environment

4. **Regularly rotate secrets**
   - Change passwords and secrets periodically
   - Update environment files accordingly

---

## Isolation Best Practices (Multi-Application Servers)

When deploying to servers that already host other applications, follow these practices:

### 1. Use Project-Specific Names

Always use the `-p` (project name) flag with Docker Compose:

```bash
# Production
docker compose -p tas-production --env-file .env.production <command>

# Testing
docker compose -p tas-testing --env-file .env.testing <command>
```

**Benefits:**
- Container names become unique: `tas-production-tas_postgres-1`
- Networks become isolated: `tas-production_tas_network`
- Volumes become isolated: `tas-production_postgres_data`

### 2. Check Port Conflicts Before Deployment

```bash
# Check all listening ports
netstat -tulpn | grep LISTEN

# Check specific ports
lsof -i :80    # NGINX HTTP
lsof -i :443   # NGINX HTTPS
lsof -i :4000  # Backend API
lsof -i :5432  # PostgreSQL
lsof -i :6379  # Redis
```

**If ports are in use:**
- Use alternative ports in `.env.production`
- Or configure internal-only networking (recommended)

### 3. Use Internal-Only Networking When Possible

**Backend Server:**
- PostgreSQL and Redis: Only accessible within Docker network
- Backend API: Only accessible from frontend server (via internal network)

**Frontend Server:**
- NGINX: Only service that needs external ports (80/443)
- Frontend and Candidate Portal: Only accessible via NGINX (internal)

### 4. Verify Isolation After Deployment

```bash
# List only TAS containers
docker ps --filter "name=tas-production"

# List all containers (verify other apps still running)
docker ps -a

# Check networks (TAS should have isolated network)
docker network ls

# Check volumes (TAS volumes should be prefixed)
docker volume ls | grep tas-production
```

### 5. Monitor Resource Usage

```bash
# Check container resource usage
docker stats tas-production-tas_backend-1

# Check disk usage
docker system df

# Check if other applications are still healthy
# (Test other apps' endpoints, check their logs, etc.)
```

### 6. Document Port Usage

Keep a record of which ports are used by which applications:

| Port | Service | Application | Notes |
|------|---------|-------------|-------|
| 80 | HTTP | TAS NGINX | Check for conflicts |
| 443 | HTTPS | TAS NGINX | Check for conflicts |
| 4000 | API | TAS Backend | Internal only recommended |
| 5432 | Database | TAS PostgreSQL | Internal only recommended |
| 6379 | Cache | TAS Redis | Internal only recommended |

---

## Next Steps

### For Testing Environment

1. **Configure Domain Names** (if available):
   - Point testing domain to `<TESTING_FRONTEND_IP>`
   - Update `SERVER_HOST` in `.env.testing` files
   - Update NGINX `server_name` directives

2. **Setup SSL/HTTPS** (optional for testing):
   - Use Let's Encrypt with Certbot
   - Update NGINX configuration for HTTPS
   - Update `FRONTEND_URL` and `CORS_ORIGIN` to use `https://`

### For Production Environment

1. **Configure Domain Names**:
   - Point production domain to `147.139.176.70`
   - Update `SERVER_HOST` in `.env.production` files
   - Update NGINX `server_name` directives

2. **Setup SSL/HTTPS** (required for production):
   - Use Let's Encrypt with Certbot
   - Update NGINX configuration for HTTPS
   - Update `FRONTEND_URL` and `CORS_ORIGIN` to use `https://`

3. **Monitoring**:
   - Set up log rotation
   - Configure health check monitoring
   - Set up alerts for downtime
   - Monitor both testing and production environments separately

4. **Backup Strategy**:
   - Schedule regular database backups for both environments
   - Store backups in separate locations
   - Test restore procedures regularly

---

## Environment Comparison

| Feature | Local | Testing | Production |
|---------|-------|---------|------------|
| **Environment File** | `.env.local` | `.env.testing` | `.env.production` |
| **Database** | Local Docker | AliCloud Server | AliCloud Server |
| **Frontend** | `localhost:3000` | `<TESTING_FRONTEND_IP>` | `147.139.176.70` |
| **Backend** | `localhost:4000` | `<TESTING_BACKEND_IP>:4000` | `8.215.56.98:4000` |
| **SSL/HTTPS** | Not required | Optional | Required |
| **Secrets** | Development values | Testing secrets | Production secrets |
| **Purpose** | Development | Pre-production testing | Live production |

---

**Last Updated:** November 2024  
**Version:** 2.0.0

