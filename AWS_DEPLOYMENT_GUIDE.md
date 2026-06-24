# AWS Deployment Guide - KPN Talent Acquisition System

## Overview

This guide helps your deployment team deploy the application to AWS using Docker images from Docker Hub.

**Docker Hub Images:**
- `your-dockerhub-username/tas-backend:1.0.0`
- `your-dockerhub-username/tas-frontend:1.0.0`
- `your-dockerhub-username/tas-candidate-portal:1.0.0`

---

## Prerequisites

- AWS account with EC2/ECS access
- Docker installed on deployment server
- Access to RDS PostgreSQL (or create one)
- Domain names configured (optional but recommended)

---

## Step 1: Setup Database (RDS PostgreSQL)

### 1.1 Create RDS PostgreSQL Instance

1. Go to AWS Console → RDS → Create database
2. Choose **PostgreSQL 15**
3. Configure:
   - **DB instance identifier**: `tas-db-production`
   - **Master username**: `your_db_user`
   - **Master password**: `your_secure_db_password`
   - **Database name**: `tas_db`
   - **Instance class**: `db.t3.medium` or larger
   - **Storage**: 50GB minimum with auto-scaling
   - **VPC**: Same as your application servers
   - **Public access**: **NO** (private only)
   - **Security group**: Allow port 5432 from application servers only
   - **Backup retention**: 7 days minimum

4. **Note the endpoint** (e.g., `tas-db-production.xxxxx.us-east-1.rds.amazonaws.com`)

### 1.2 Update DATABASE_URL

In your `.env` file, update:
```
DATABASE_URL=postgresql://your_db_user:your_secure_db_password@<RDS-ENDPOINT>:5432/tas_db?schema=public&pool_timeout=0&connection_limit=20
```

Replace `<RDS-ENDPOINT>` with your actual RDS endpoint.

---

## Step 2: Run Database Migrations

### Option A: Using EC2/Bastion Host

1. **SSH to a server with access to RDS**
2. **Install Node.js** (if not installed):
   ```bash
   curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
   sudo yum install -y nodejs
   ```

3. **Clone repository** (or copy migration files):
   ```bash
   git clone https://github.com/your-github-org/talent-acquisition-management.git
   cd talent-acquisition-management/backend
   ```

4. **Install dependencies**:
   ```bash
   npm ci --omit=dev
   ```

5. **Set DATABASE_URL**:
   ```bash
   export DATABASE_URL=postgresql://your_db_user:your_secure_db_password@<RDS-ENDPOINT>:5432/tas_db
   ```

6. **Run migrations**:
   ```bash
   npx prisma generate
   npx prisma migrate deploy
   ```

### Option B: Using Docker Container (One-time migration run)

1. **Pull backend image** (or use already pulled image):
   ```bash
   docker pull your-dockerhub-username/tas-backend:1.0.0
   ```

2. **Run migrations in container**:
   ```bash
   docker run --rm \
     -e DATABASE_URL=postgresql://your_db_user:your_secure_db_password@<RDS-ENDPOINT>:5432/tas_db \
     your-dockerhub-username/tas-backend:1.0.0 \
     sh -c "npx prisma generate && npx prisma migrate deploy"
   ```

---

## Step 3: Create Production User

### Option A: Using Script on Server

1. **On the same server from Step 2**, create the production user:
   ```bash
   cd talent-acquisition-management/backend
   export DATABASE_URL=postgresql://your_db_user:your_secure_db_password@<RDS-ENDPOINT>:5432/tas_db
   export ADMIN_EMAIL=admin@example.com
   export ADMIN_PASSWORD=your-secure-admin-password
   export ADMIN_FIRST_NAME=Admin
   export ADMIN_LAST_NAME=User
   node scripts/createProductionUser.js
   ```

### Option B: Using Docker Container

```bash
docker run --rm \
  -e DATABASE_URL=postgresql://your_db_user:your_secure_db_password@<RDS-ENDPOINT>:5432/tas_db \
  -e ADMIN_EMAIL=admin@example.com \
  -e ADMIN_PASSWORD=your-secure-admin-password \
  your-dockerhub-username/tas-backend:1.0.0 \
  node scripts/createProductionUser.js
```

**Expected Output:**
```
✅ Production user created successfully!
📋 User summary:
   Email: admin@example.com
   Role: SUPER_ADMIN
```

---

## Step 4: Setup Redis (Optional but Recommended)

### Option A: AWS ElastiCache

1. Create ElastiCache Redis cluster
2. Note the endpoint and password
3. Update in `.env`:
   ```
   REDIS_URL=redis://:<password>@<elasticache-endpoint>:6379
   REDIS_PASSWORD=<password>
   ```

### Option B: Docker Redis Container

If running on same server, use docker-compose (see Step 5).

---

## Step 5: Deploy Application Containers

### Option A: Using Docker Compose (EC2)

Use the repository's `docker-compose.production.yml` with a server-local `.env.production` file. See `ENV_SETUP_INSTRUCTIONS.md` for required variables.

```bash
# On your EC2 server
cp docker-compose.production.yml /opt/tas/
nano .env.production   # set DATABASE_URL, JWT_SECRET, ENCRYPTION_KEY, etc. (never commit this file)

docker compose -f docker-compose.production.yml --env-file .env.production pull
docker compose -f docker-compose.production.yml --env-file .env.production up -d
docker compose -f docker-compose.production.yml logs -f backend
```

**Image tags:** set `IMAGE_TAG=1.0.0` (or your release version) in `.env.production`. Avoid `:latest` in production.

### Option B: Using ECS (Recommended for Production)

1. **Create ECS Task Definition** with environment variables from `.env.production`
2. **Create ECS Services** for backend, frontend, candidate-portal
3. **Use AWS Secrets Manager** for sensitive variables (recommended)

**Example ECS Task Definition (Backend)**:
```json
{
  "family": "tas-backend",
  "containerDefinitions": [{
    "name": "tas-backend",
    "image": "your-dockerhub-username/tas-backend:1.0.0",
    "portMappings": [{
      "containerPort": 4000,
      "protocol": "tcp"
    }],
    "environment": [
      {"name": "NODE_ENV", "value": "production"},
      {"name": "PORT", "value": "4000"}
    ],
    "secrets": [
      {"name": "DATABASE_URL", "valueFrom": "arn:aws:secretsmanager:region:account:secret:tas/database-url"},
      {"name": "JWT_SECRET", "valueFrom": "arn:aws:secretsmanager:region:account:secret:tas/jwt-secret"},
      {"name": "JWT_REFRESH_SECRET", "valueFrom": "arn:aws:secretsmanager:region:account:secret:tas/jwt-refresh-secret"},
      {"name": "ENCRYPTION_KEY", "valueFrom": "arn:aws:secretsmanager:region:account:secret:tas/encryption-key"}
    ],
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": "/ecs/tas-backend",
        "awslogs-region": "us-east-1",
        "awslogs-stream-prefix": "ecs"
      }
    }
  }]
}
```

---

## Step 6: Verify Deployment

### 6.1 Check Backend Health

```bash
curl http://localhost:4000/health
```

Expected response:
```json
{
  "success": true,
  "message": "Server is running",
  "timestamp": "2025-11-20T...",
  "uptime": 123.45,
  "port": 4000
}
```

### 6.2 Check Frontend

Open in browser: `http://<your-server-ip>:4001`

### 6.3 Test Login

1. Go to login page
2. Use credentials:
   - **Email**: `admin@example.com`
   - **Password**: `your-secure-admin-password`
3. **IMPORTANT**: Change password immediately after first login!

---

## Step 7: Setup Load Balancer & SSL (Recommended)

### 7.1 Create Application Load Balancer

1. Create ALB in AWS Console
2. Configure listeners:
   - Port 80 → HTTP
   - Port 443 → HTTPS (attach SSL certificate)
3. Add target groups:
   - Backend: Port 4000
   - Frontend: Port 4001
   - Candidate Portal: Port 4002

### 7.2 Setup SSL Certificate

1. Request certificate in AWS Certificate Manager (ACM)
2. Attach to ALB listener (port 443)
3. Configure domain DNS to point to ALB

---

## Step 8: Environment Variables Quick Reference

**Required Variables** (must be set):
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - 64-character hex string
- `JWT_REFRESH_SECRET` - 64-character hex string
- `ENCRYPTION_KEY` - Exactly 32-character hex string

**Important**: The `ENCRYPTION_KEY` must be **exactly 32 characters**. Generate one on the server:

```bash
openssl rand -hex 16
```

Example format (replace with your own generated value):
```
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef
```

---

## Step 9: Troubleshooting

### Error: "ENCRYPTION_KEY must be exactly 32 characters long"

**Solution**: Ensure `ENCRYPTION_KEY` is exactly 32 characters. Generate a new value:

```bash
openssl rand -hex 16
```

### Error: ".env file not found"

**Solution**: This is normal! Environment variables must be passed to containers. Use:
- Docker Compose: `environment:` section
- ECS: Task definition environment variables
- Docker run: `-e` flags or `--env-file`

### Error: "Database connection failed"

**Solution**:
1. Verify RDS endpoint is correct
2. Check security group allows port 5432 from your application servers
3. Verify credentials: `your_db_user` / `your_secure_db_password`
4. Test connection: `psql -h <endpoint> -U your_db_user -d tas_db`

### Error: "Cannot connect to Redis"

**Solution**:
- If using ElastiCache: Check security group and endpoint
- If using Docker Redis: Ensure container is running and password matches

---

## Step 10: Post-Deployment Checklist

- [ ] Database migrations completed
- [ ] Production user created
- [ ] All containers running
- [ ] Health checks passing (`/health` endpoint)
- [ ] Login successful
- [ ] Password changed from default
- [ ] SSL certificates configured
- [ ] Load balancer configured
- [ ] Monitoring/CloudWatch logs set up
- [ ] Backups scheduled (RDS automated backups enabled)

---

## Support Files

- **Production .env template**: `backend/.env.production`
- **Database setup script**: `backend/scripts/setupProductionDB.js`
- **User creation script**: `backend/scripts/createProductionUser.js`
- **Production setup guide**: `PRODUCTION_SETUP.md`

---

**Last Updated**: November 2025
**Version**: 2.0.0

