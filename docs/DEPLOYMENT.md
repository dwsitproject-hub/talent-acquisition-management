# Deployment Guide - KPN Talent Acquisition System

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Development Deployment](#development-deployment)
3. [Production Deployment](#production-deployment)
4. [Docker Deployment](#docker-deployment)
5. [Database Setup](#database-setup)
6. [Configuration](#configuration)
7. [SSL/TLS Setup](#ssltls-setup)
8. [Monitoring & Logging](#monitoring--logging)
9. [Backup & Recovery](#backup--recovery)
10. [Troubleshooting](#troubleshooting)

---

## 1. Prerequisites

### System Requirements
- **OS**: Linux (Ubuntu 20.04+ recommended) or Windows Server 2019+
- **RAM**: Minimum 8GB, Recommended 16GB+
- **CPU**: Minimum 4 cores, Recommended 8+ cores
- **Storage**: Minimum 100GB SSD
- **Network**: Static IP, ports 80, 443, 3000-3002, 5432, 6379

### Software Requirements
- **Node.js**: 22.x or higher
- **PostgreSQL**: 15.x or higher
- **Redis**: 7.x or higher
- **Docker** (optional): 24.x or higher
- **Docker Compose** (optional): 2.x or higher
- **Nginx**: Latest stable (for production)

---

## 2. Development Deployment

### Step 1: Clone Repository
```bash
git clone <repository-url>
cd talent-acquisition-system
```

### Step 2: Install Dependencies

**Backend:**
```bash
cd backend
npm install
```

**Frontend:**
```bash
cd frontend
npm install
```

**Candidate Portal:**
```bash
cd candidate-portal
npm install
```

### Step 3: Configure Environment

Create `.env` file in backend directory:
```bash
cp backend/env.template backend/.env
```

Edit `backend/.env` with your configuration:
```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://tas_user:password@localhost:5432/tas_db
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-dev-secret-key-min-32-chars
JWT_REFRESH_SECRET=your-dev-refresh-secret-key
ENCRYPTION_KEY=your-32-character-encryption-key
```

### Step 4: Setup Database

**Install PostgreSQL** (if not installed):
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib

# Start service
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**Create Database:**
```bash
sudo -u postgres psql

CREATE DATABASE tas_db;
CREATE USER tas_user WITH ENCRYPTED PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE tas_db TO tas_user;
\q
```

**Run Migrations:**
```bash
cd backend
npx prisma migrate dev
npx prisma generate
```

**Seed Database (Optional):**
```bash
npx prisma db seed
```

### Step 5: Setup Redis

**Install Redis:**
```bash
# Ubuntu/Debian
sudo apt install redis-server

# Start service
sudo systemctl start redis
sudo systemctl enable redis
```

**Verify Redis:**
```bash
redis-cli ping
# Should return: PONG
```

### Step 6: Start Development Servers

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

**Terminal 3 - Candidate Portal:**
```bash
cd candidate-portal
npm run dev
```

**Access Applications:**
- Backend API: http://localhost:4000/api
- Admin Dashboard: http://localhost:4001
- Candidate Portal: http://localhost:4002

---

## 3. Production Deployment

### Prerequisites
- Domain names configured (e.g., api.yourdomain.com, admin.yourdomain.com, careers.yourdomain.com)
- SSL certificates (Let's Encrypt recommended)
- Production database server
- Load balancer (optional but recommended)

### Step 1: Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version
npm --version
```

### Step 2: Install PM2 (Process Manager)

```bash
sudo npm install -g pm2

# Setup PM2 startup script
pm2 startup
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME
```

### Step 3: Clone and Build

```bash
# Clone repository
cd /opt
sudo git clone <repository-url> tas
sudo chown -R $USER:$USER tas
cd tas

# Install backend dependencies
cd backend
npm ci --production
npx prisma generate

# Build frontend
cd ../frontend
npm ci
npm run build

# Build candidate portal
cd ../candidate-portal
npm ci
npm run build
```

### Step 4: Configure Production Environment

Create `backend/.env`:
```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://tas_user:secure_password@db_host:5432/tas_db?pool_timeout=0&connection_limit=20
REDIS_URL=redis://:redis_password@redis_host:6379

JWT_SECRET=<generate-strong-secret-min-64-chars>
JWT_REFRESH_SECRET=<generate-strong-secret-min-64-chars>
ENCRYPTION_KEY=<exactly-32-characters-random>

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@domain.com
SMTP_PASSWORD=<app-password>

# CORS
CORS_ORIGIN=https://admin.yourdomain.com,https://careers.yourdomain.com

# Security
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
ACCOUNT_LOCKOUT_THRESHOLD=5

# Logging
LOG_LEVEL=info
```

**Generate Secure Secrets:**
```bash
# Generate JWT secrets
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Generate encryption key (must be exactly 32 chars)
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

### Step 5: Database Migration

```bash
cd /opt/tas/backend
npx prisma migrate deploy
```

### Step 6: Start with PM2

Create `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [
    {
      name: 'tas-backend',
      cwd: '/opt/tas/backend',
      script: 'src/server.js',
      instances: 4,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: '/var/log/tas/backend-error.log',
      out_file: '/var/log/tas/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      max_memory_restart: '1G'
    },
    {
      name: 'tas-frontend',
      cwd: '/opt/tas/frontend',
      script: 'npm',
      args: 'start',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      }
    },
    {
      name: 'tas-candidate-portal',
      cwd: '/opt/tas/candidate-portal',
      script: 'npm',
      args: 'start',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3002
      }
    }
  ]
};
```

**Start Applications:**
```bash
cd /opt/tas
pm2 start ecosystem.config.js
pm2 save
```

**Monitor:**
```bash
pm2 status
pm2 logs
pm2 monit
```

### Step 7: Setup Nginx Reverse Proxy

Install Nginx:
```bash
sudo apt install nginx
```

Configure Nginx (see `nginx/nginx.conf` in repository):
```bash
sudo cp nginx/nginx.conf /etc/nginx/nginx.conf

# Test configuration
sudo nginx -t

# Reload
sudo systemctl reload nginx
```

### Step 8: SSL Certificates with Let's Encrypt

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificates
sudo certbot --nginx -d api.yourdomain.com
sudo certbot --nginx -d admin.yourdomain.com
sudo certbot --nginx -d careers.yourdomain.com

# Auto-renewal (test)
sudo certbot renew --dry-run
```

---

## 4. Docker Deployment

### Quick Start (Development)

```bash
# Copy environment file
cp .env.example .env

# Edit .env with your configuration
nano .env

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Run database migrations
docker-compose exec backend npx prisma migrate deploy

# Stop services
docker-compose down
```

### Production with Docker

```bash
# Use production compose file
docker-compose -f docker-compose.prod.yml up -d

# Scale services
docker-compose -f docker-compose.prod.yml up -d --scale backend=3 --scale frontend=2
```

### Docker Commands

```bash
# View running containers
docker-compose ps

# View logs for specific service
docker-compose logs -f backend

# Restart service
docker-compose restart backend

# Execute command in container
docker-compose exec backend sh

# View resource usage
docker stats
```

---

## 5. Database Setup

### PostgreSQL Configuration (Production)

Edit `/etc/postgresql/15/main/postgresql.conf`:
```conf
max_connections = 100
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 2621kB
min_wal_size = 1GB
max_wal_size = 4GB
```

### Enable Connection Pooling (PgBouncer)

```bash
sudo apt install pgbouncer

# Configure /etc/pgbouncer/pgbouncer.ini
[databases]
tas_db = host=localhost port=5432 dbname=tas_db

[pgbouncer]
listen_port = 6432
listen_addr = localhost
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 20
```

Update DATABASE_URL:
```
postgresql://tas_user:password@localhost:6432/tas_db
```

### Database Backup

**Manual Backup:**
```bash
pg_dump -U tas_user -h localhost tas_db > backup_$(date +%Y%m%d_%H%M%S).sql
```

**Automated Backup Script:**
```bash
#!/bin/bash
# /opt/tas/scripts/backup_db.sh

BACKUP_DIR="/backups/tas"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/tas_db_$DATE.sql"

mkdir -p $BACKUP_DIR

pg_dump -U tas_user -h localhost tas_db > $BACKUP_FILE

# Compress
gzip $BACKUP_FILE

# Delete backups older than 30 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

echo "Backup completed: $BACKUP_FILE.gz"
```

**Add to Crontab:**
```bash
crontab -e

# Daily backup at 2 AM
0 2 * * * /opt/tas/scripts/backup_db.sh
```

---

## 6. Configuration

### Environment Variables Reference

See `backend/env.template` for full list.

**Critical Production Variables:**
- `NODE_ENV=production`
- `PORT=4000` (backend API port)
- `DATABASE_URL` (with connection pooling)
- `JWT_SECRET` (64+ characters)
- `JWT_REFRESH_SECRET` (64+ characters)
- `ENCRYPTION_KEY` (exactly 32 characters)
- `CORS_ORIGIN` (production URLs only)
- `RATE_LIMIT_*` (adjust based on traffic)

### Application Configuration

**CORS:**
```env
CORS_ORIGIN=https://admin.yourdomain.com,https://careers.yourdomain.com
CORS_CREDENTIALS=true
```

**Rate Limiting:**
```env
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_LOGIN_MAX=5
```

**File Upload:**
```env
MAX_FILE_SIZE=10485760  # 10MB
ALLOWED_FILE_TYPES=pdf,doc,docx,jpg,jpeg,png,xls,xlsx
```

---

## 7. SSL/TLS Setup

### Let's Encrypt (Recommended)

**Initial Setup:**
```bash
sudo certbot --nginx -d api.yourdomain.com \
  -d admin.yourdomain.com \
  -d careers.yourdomain.com \
  --email admin@yourdomain.com \
  --agree-tos \
  --redirect
```

**Auto-Renewal:**
Certbot automatically sets up renewal. Verify:
```bash
sudo systemctl status certbot.timer
```

### Custom SSL Certificates

If using custom certificates:
```bash
# Copy certificates
sudo mkdir -p /etc/nginx/ssl
sudo cp cert.pem /etc/nginx/ssl/
sudo cp key.pem /etc/nginx/ssl/

# Set permissions
sudo chmod 600 /etc/nginx/ssl/key.pem
```

Update `nginx.conf`:
```nginx
ssl_certificate /etc/nginx/ssl/cert.pem;
ssl_certificate_key /etc/nginx/ssl/key.pem;
```

---

## 8. Monitoring & Logging

### Application Logs

**PM2 Logs:**
```bash
pm2 logs
pm2 logs backend
pm2 logs --lines 100
```

**Winston Logs (Backend):**
```bash
tail -f /opt/tas/backend/logs/combined-*.log
tail -f /opt/tas/backend/logs/error-*.log
```

### System Monitoring

**Install Monitoring Tools:**
```bash
# htop for process monitoring
sudo apt install htop

# iotop for disk I/O
sudo apt install iotop

# netstat for network
sudo apt install net-tools
```

**Monitor Resources:**
```bash
# CPU & Memory
htop

# Disk usage
df -h

# Disk I/O
sudo iotop

# Network connections
netstat -tunlp
```

### Database Monitoring

```sql
-- Active connections
SELECT count(*) FROM pg_stat_activity;

-- Long-running queries
SELECT pid, now() - query_start AS duration, query 
FROM pg_stat_activity 
WHERE state = 'active' 
ORDER BY duration DESC;

-- Database size
SELECT pg_size_pretty(pg_database_size('tas_db'));

-- Table sizes
SELECT tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

## 9. Backup & Recovery

### Database Backup Strategy

**Full Backup (Daily):**
```bash
pg_dump -U tas_user -h localhost -Fc tas_db > tas_db_full.dump
```

**Restore:**
```bash
pg_restore -U tas_user -h localhost -d tas_db tas_db_full.dump
```

### Application Files Backup

```bash
# Backup uploads directory
tar -czf uploads_backup_$(date +%Y%m%d).tar.gz /opt/tas/backend/uploads

# Backup logs
tar -czf logs_backup_$(date +%Y%m%d).tar.gz /opt/tas/backend/logs
```

### Disaster Recovery

**RTO (Recovery Time Objective):** 1 hour  
**RPO (Recovery Point Objective):** 5 minutes

**Recovery Steps:**
1. Restore database from latest backup
2. Deploy application from Git
3. Restore uploaded files
4. Verify application health
5. Update DNS if needed

---

## 10. Troubleshooting

### Common Issues

**Issue: Cannot connect to database**
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check connections
sudo -u postgres psql -c "SELECT count(*) FROM pg_stat_activity;"

# Check logs
sudo tail -f /var/log/postgresql/postgresql-15-main.log
```

**Issue: Redis connection failed**
```bash
# Check Redis status
sudo systemctl status redis

# Test connection
redis-cli ping

# Check logs
sudo tail -f /var/log/redis/redis-server.log
```

**Issue: High memory usage**
```bash
# Check PM2 processes
pm2 status

# Restart if needed
pm2 restart all

# Check for memory leaks
pm2 monit
```

**Issue: Application not starting**
```bash
# Check logs
pm2 logs backend --lines 100

# Check environment
cd /opt/tas/backend
cat .env

# Test manually
node src/server.js
```

### Performance Optimization

**Database:**
```sql
-- Analyze tables
ANALYZE;

-- Reindex
REINDEX DATABASE tas_db;

-- Vacuum
VACUUM ANALYZE;
```

**Node.js:**
```bash
# Increase memory limit if needed
NODE_OPTIONS="--max-old-space-size=4096" pm2 restart backend
```

---

## Support & Maintenance

### Regular Maintenance Tasks

**Weekly:**
- Review error logs
- Check disk space
- Monitor application performance

**Monthly:**
- Update dependencies (security patches)
- Review and optimize database queries
- Clean old logs and backups

**Quarterly:**
- Security audit
- Performance review
- Capacity planning

### Getting Help

- Documentation: https://docs.tas.kpn.com
- Support Email: support@kpn.com
- Internal Slack: #tas-support

---

**End of Deployment Guide**

