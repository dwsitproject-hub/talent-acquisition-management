# Environment Variables Setup Instructions

## Problem: ".env file not found" Error

Docker images don't include `.env` files for security reasons. You must pass environment variables directly to containers or via a server-local `.env.production` file (never commit secrets to git).

## Solution: Pass Environment Variables to Docker

### Option 1: Docker Compose (Recommended for EC2)

1. **Use `docker-compose.production.yml`**
2. **Create `.env.production` on the server only** (gitignored):
   ```
   DOCKERHUB_USERNAME=your-dockerhub-username
   IMAGE_TAG=1.0.0
   REDIS_PASSWORD=your-strong-redis-password-here
   DATABASE_URL=postgresql://your_db_user:your_secure_db_password@your-db-host:5432/tas_db?schema=public&pool_timeout=0&connection_limit=20
   JWT_SECRET=your-jwt-secret-min-64-chars
   JWT_REFRESH_SECRET=your-jwt-refresh-secret-min-64-chars
   ENCRYPTION_KEY=your-32-char-encryption-key
   FRONTEND_URL=https://admin.example.com
   CANDIDATE_PORTAL_URL=https://careers.example.com
   API_BASE_URL=https://api.example.com
   CORS_ORIGIN=https://admin.example.com,https://careers.example.com
   ```
3. **Run**:
   ```bash
   docker compose -f docker-compose.production.yml --env-file .env.production up -d
   ```

Generate secrets:
```bash
openssl rand -hex 32   # JWT_SECRET, JWT_REFRESH_SECRET
openssl rand -hex 16   # ENCRYPTION_KEY (32 hex chars)
```

### Option 2: Docker Run (Manual)

```bash
docker run -d \
  --name tas_backend \
  -p 4000:4000 \
  -e NODE_ENV=production \
  -e PORT=4000 \
  -e DATABASE_URL=postgresql://your_db_user:your_secure_db_password@your-db-host:5432/tas_db \
  -e JWT_SECRET=your-jwt-secret-min-64-chars \
  -e JWT_REFRESH_SECRET=your-jwt-refresh-secret-min-64-chars \
  -e ENCRYPTION_KEY=your-32-char-encryption-key \
  -e REDIS_URL=redis://:your-redis-password@redis:6379 \
  -e REDIS_PASSWORD=your-redis-password \
  -e CORS_ORIGIN=https://admin.example.com,https://careers.example.com \
  -e CORS_CREDENTIALS=true \
  -e FRONTEND_URL=https://admin.example.com \
  -e CANDIDATE_PORTAL_URL=https://careers.example.com \
  -e API_BASE_URL=https://api.example.com \
  your-dockerhub-username/tas-backend:1.0.0
```

### Option 3: ECS Task Definition

Add all environment variables in the ECS Task Definition JSON (see AWS_DEPLOYMENT_GUIDE.md). Store values in AWS Secrets Manager or SSM Parameter Store.

---

## Critical: ENCRYPTION_KEY Must Be Exactly 32 Characters

The encryption key must be exactly 32 characters (typically a 16-byte hex string):

```bash
openssl rand -hex 16
```

Example format (replace with your own generated value):
```
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef
```

---

## Files for Reference

1. **`backend/env.template`** - Development variable template
2. **`docker-compose.production.yml`** - Production compose (reads from `.env.production`)
3. **`AWS_DEPLOYMENT_GUIDE.md`** - Deployment guide

---

## Quick Start

1. Copy `docker-compose.production.yml` to your server
2. Create `.env.production` with all secrets (see Option 1)
3. Run: `docker compose -f docker-compose.production.yml --env-file .env.production up -d`

**Never commit `.env.production` or real secrets to the repository.**
