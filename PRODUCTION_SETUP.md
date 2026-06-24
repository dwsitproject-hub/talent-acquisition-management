# Production Setup Guide - KPN Talent Acquisition System

## Overview

This guide provides step-by-step instructions for setting up the production environment for the KPN Talent Acquisition System on AWS.

## Prerequisites

- AWS account with appropriate permissions
- Docker and Docker Compose installed
- PostgreSQL client tools (psql)
- Node.js 22+ installed (for running setup scripts)

## Production Database Credentials

- **Username**: `your_db_user`
- **Password**: `your_secure_db_password`
- **Database**: `tas_db`

## Production User Credentials

- **First Name**: Jerry
- **Last Name**: Hakim
- **Email**: admin@example.com
- **Password**: your-secure-admin-password
- **Role**: SUPER_ADMIN

---

## Step 1: AWS Infrastructure Setup

### 1.1 EC2 Instance Setup

1. Launch an EC2 instance (recommended: t3.medium or larger)
2. Configure security groups:
   - Port 22 (SSH)
   - Port 80 (HTTP)
   - Port 443 (HTTPS)
   - Port 4000 (Backend API - internal only)
   - Port 4001 (Frontend - internal only)
   - Port 4002 (Candidate Portal - internal only)
   - Port 5432 (PostgreSQL - internal only)
   - Port 6379 (Redis - internal only)

### 1.2 RDS PostgreSQL Setup (Recommended)

Alternatively, use AWS RDS for PostgreSQL:

1. Create RDS PostgreSQL instance
2. Configure:
   - Engine: PostgreSQL 15
   - Instance class: db.t3.medium or larger
   - Storage: 20GB minimum
   - Master username: `your_db_user`
   - Master password: `your_secure_db_password`
   - Database name: `tas_db`
   - VPC: Same as EC2 instance
   - Security group: Allow access from EC2 instance

### 1.3 ElastiCache Redis Setup (Optional)

For production, consider using AWS ElastiCache for Redis:

1. Create ElastiCache Redis cluster
2. Configure:
   - Engine: Redis 7
   - Node type: cache.t3.micro or larger
   - VPC: Same as EC2 instance
   - Security group: Allow access from EC2 instance

---

## Step 2: Server Preparation

### 2.1 Connect to EC2 Instance

```bash
ssh -i your-key.pem ec2-user@your-ec2-ip
```

### 2.2 Install Docker and Docker Compose

```bash
# Update system
sudo yum update -y

# Install Docker
sudo yum install -y docker
sudo service docker start
sudo usermod -a -G docker ec2-user

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Log out and back in for group changes to take effect
```

### 2.3 Install Node.js (for setup scripts)

```bash
curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
sudo yum install -y nodejs
```

---

## Step 3: Application Deployment

### 3.1 Clone Repository

```bash
cd /opt
sudo git clone <repository-url> tas
sudo chown -R ec2-user:ec2-user tas
cd tas
```

### 3.2 Set Up Production Environment Variables

Create `backend/.env`:

```env
# Application
NODE_ENV=production
PORT=4000
API_BASE_URL=https://api.yourdomain.com
FRONTEND_URL=https://admin.yourdomain.com
CANDIDATE_PORTAL_URL=https://careers.yourdomain.com

# Database (if using RDS, use RDS endpoint)
DATABASE_URL=postgresql://your_db_user:your_secure_db_password@your-rds-endpoint:5432/tas_db?schema=public&pool_timeout=0&connection_limit=20

# Redis (if using ElastiCache, use ElastiCache endpoint)
REDIS_URL=redis://:your-redis-password@your-elasticache-endpoint:6379
REDIS_PASSWORD=your-redis-password

# JWT Secrets (generate strong secrets)
JWT_SECRET=<generate-64-char-secret>
JWT_REFRESH_SECRET=<generate-64-char-secret>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Encryption Key (must be exactly 32 characters)
ENCRYPTION_KEY=<generate-32-char-key>

# CORS
CORS_ORIGIN=https://admin.yourdomain.com,https://careers.yourdomain.com
CORS_CREDENTIALS=true

# Security
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_LOGIN_MAX=20
ACCOUNT_LOCKOUT_THRESHOLD=5

# Logging
LOG_LEVEL=info

# File Upload
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=pdf,doc,docx,jpg,jpeg,png,xls,xlsx
UPLOAD_DIR=./uploads

# AWS S3 (optional, for file storage)
USE_S3=false
AWS_REGION=ap-southeast-1
AWS_S3_BUCKET=kpn-tas-documents
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
```

**Generate Secrets:**

```bash
# Generate JWT secrets (64 characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate encryption key (32 characters)
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

### 3.3 Set Up Production Database

#### Option A: Using Docker PostgreSQL

```bash
cd /opt/tas

# Update docker-compose.yml with production database credentials
# Then run:
docker-compose up -d postgres

# Wait for database to be ready
sleep 10

# Run database setup script
cd backend
DATABASE_URL=postgresql://postgres:postgres_password@localhost:5432/postgres node scripts/setupProductionDB.js
```

#### Option B: Using RDS PostgreSQL

```bash
cd /opt/tas/backend

# Run database setup script (connect to RDS)
PROD_DB_USER=your_db_user PROD_DB_PASSWORD=your_secure_db_password \
DATABASE_URL=postgresql://postgres:postgres_password@your-rds-endpoint:5432/postgres \
node scripts/setupProductionDB.js
```

### 3.4 Run Database Migrations

```bash
cd /opt/tas/backend

# Set production database URL
export DATABASE_URL=postgresql://your_db_user:your_secure_db_password@your-db-host:5432/tas_db

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy
```

### 3.5 Create Production User

```bash
cd /opt/tas/backend

# Set production database URL and admin credentials
export DATABASE_URL=postgresql://your_db_user:your_secure_db_password@your-db-host:5432/tas_db
export ADMIN_EMAIL=admin@example.com
export ADMIN_PASSWORD=your-secure-admin-password

# Create production user
node scripts/createProductionUser.js
```

---

## Step 4: Build and Deploy Application

### 4.1 Build Docker Images

```bash
cd /opt/tas

# Build all services
docker-compose -f docker-compose.prod.yml build
```

### 4.2 Start Services

```bash
# Start all services
docker-compose -f docker-compose.prod.yml up -d

# Check service status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

### 4.3 Verify Deployment

```bash
# Check backend health
curl http://localhost:4000/health

# Check frontend
curl http://localhost:4001

# Check candidate portal
curl http://localhost:4002
```

---

## Step 5: Nginx Configuration (Optional)

### 5.1 Install Nginx

```bash
sudo yum install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 5.2 Configure Nginx

Create `/etc/nginx/conf.d/tas.conf`:

```nginx
# Admin Dashboard
server {
    listen 80;
    server_name admin.yourdomain.com;

    location / {
        proxy_pass http://localhost:4001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Candidate Portal
server {
    listen 80;
    server_name careers.yourdomain.com;

    location / {
        proxy_pass http://localhost:4002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# API
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 5.3 Test and Reload Nginx

```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## Step 6: SSL Certificate Setup

### 6.1 Install Certbot

```bash
sudo yum install -y certbot python3-certbot-nginx
```

### 6.2 Obtain SSL Certificates

```bash
sudo certbot --nginx -d admin.yourdomain.com -d careers.yourdomain.com -d api.yourdomain.com
```

### 6.3 Auto-Renewal

```bash
sudo certbot renew --dry-run
```

---

## Step 7: Monitoring and Logging

### 7.1 Set Up CloudWatch Logs (Optional)

```bash
# Install CloudWatch agent
wget https://s3.amazonaws.com/amazoncloudwatch-agent/amazon_linux/amd64/latest/amazon-cloudwatch-agent.rpm
sudo rpm -U ./amazon-cloudwatch-agent.rpm
```

### 7.2 Configure Log Rotation

Create `/etc/logrotate.d/tas`:

```
/opt/tas/backend/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    notifempty
    missingok
}
```

---

## Step 8: Backup Configuration

### 8.1 Database Backup Script

Create `/opt/tas/scripts/backup-db.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/opt/tas/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/tas_db_$DATE.sql"

mkdir -p $BACKUP_DIR

pg_dump -h your-db-host -U your_db_user -d tas_db > $BACKUP_FILE

# Compress backup
gzip $BACKUP_FILE

# Delete backups older than 30 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete
```

### 8.2 Schedule Backups

```bash
chmod +x /opt/tas/scripts/backup-db.sh

# Add to crontab (daily at 2 AM)
crontab -e
# Add: 0 2 * * * /opt/tas/scripts/backup-db.sh
```

---

## Step 9: Initial Login

1. Navigate to: `https://admin.yourdomain.com`
2. Login with:
   - Email: `admin@example.com`
   - Password: `your-secure-admin-password`
3. **IMPORTANT**: Change password immediately after first login

---

## Step 10: Post-Deployment Checklist

- [ ] Database migrations completed
- [ ] Production user created
- [ ] All services running
- [ ] Health checks passing
- [ ] SSL certificates installed
- [ ] Nginx configured and running
- [ ] Backups scheduled
- [ ] Monitoring configured
- [ ] Initial login successful
- [ ] Password changed
- [ ] Menu access configured
- [ ] Master data populated (Divisions, Office Locations)

---

## Troubleshooting

### Database Connection Issues

```bash
# Test database connection
psql -h your-db-host -U your_db_user -d tas_db

# Check database logs
docker-compose logs postgres
```

### Application Not Starting

```bash
# Check container logs
docker-compose logs backend
docker-compose logs frontend

# Check container status
docker-compose ps

# Restart services
docker-compose restart
```

### Permission Issues

```bash
# Fix file permissions
sudo chown -R ec2-user:ec2-user /opt/tas
sudo chmod -R 755 /opt/tas
```

---

## Security Considerations

1. **Change Default Passwords**: Immediately change all default passwords
2. **Firewall Rules**: Restrict database and Redis access to application servers only
3. **SSL/TLS**: Always use HTTPS in production
4. **Secrets Management**: Use AWS Secrets Manager for sensitive data
5. **Regular Updates**: Keep all dependencies and base images updated
6. **Backup Strategy**: Implement automated daily backups
7. **Monitoring**: Set up alerts for critical issues

---

## Support

For issues or questions, refer to:
- API Documentation: `docs/API_DOCUMENTATION.md`
- Architecture Documentation: `docs/ARCHITECTURE.md`
- Functional Specifications: `docs/FUNCTIONAL_SPECS.md`
- Deployment Guide: `docs/DEPLOYMENT.md`

---

**Last Updated**: November 2025
**Version**: 2.0.0

