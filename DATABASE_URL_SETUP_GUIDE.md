# DATABASE_URL Setup Guide - RDS PostgreSQL

## Overview

This guide explains how to find your RDS endpoint and configure `DATABASE_URL` for deployment. **Store the actual connection string in `.env.production` on the server only — never commit credentials to git.**

---

## Step 1: Find Your RDS PostgreSQL Endpoint

### Option A: If RDS Already Exists

1. **Go to AWS Console** → **RDS** → **Databases**
2. **Click on your database instance** (e.g., `tas-db-production`)
3. **Find the "Endpoint" section** in the database details
4. **Copy the endpoint** - it looks like:
   ```
   tas-db-production.abc123xyz.us-east-1.rds.amazonaws.com
   ```
5. **Note the Port** (usually `5432` for PostgreSQL)

### Option B: If Creating New RDS

When creating RDS:
1. **Database identifier**: `tas-db-production` (this becomes part of endpoint)
2. **Master username**: choose a strong username (e.g. `your_db_user`)
3. **Master password**: generate a strong password (store in a secret manager)
4. **Database name**: `tas_db`
5. **Instance class**: `db.t3.medium` or larger
6. **VPC**: Same as your application servers
7. **Public access**: **NO** (private only)
8. **Security group**: Allow port 5432 from your application servers

After creation, the endpoint will be displayed (takes ~5-10 minutes).

---

## Step 2: Format DATABASE_URL

The `DATABASE_URL` format is:
```
postgresql://<username>:<password>@<endpoint>:<port>/<database>?schema=public&pool_timeout=0&connection_limit=20
```

### Example: RDS in AWS (Private)
```
postgresql://your_db_user:your_secure_db_password@tas-db-production.abc123xyz.us-east-1.rds.amazonaws.com:5432/tas_db?schema=public&pool_timeout=0&connection_limit=20
```

### Example: RDS with Custom Port
If your RDS uses a different port (e.g., 5433):
```
postgresql://your_db_user:your_secure_db_password@tas-db-production.abc123xyz.us-east-1.rds.amazonaws.com:5433/tas_db?schema=public&pool_timeout=0&connection_limit=20
```

---

## Step 3: Configure docker-compose.production.yml

Set `DATABASE_URL` in your server-local `.env.production`:

```bash
DATABASE_URL=postgresql://your_db_user:your_secure_db_password@your-db-host:5432/tas_db?schema=public&pool_timeout=0&connection_limit=20
```

The compose file references it as:
```yaml
DATABASE_URL: ${DATABASE_URL}
```

---

## Step 4: Verify Connection

### Test Connection from Your Deployment Server

1. **Install PostgreSQL client** (if not installed):
   ```bash
   # Amazon Linux 2
   sudo yum install -y postgresql15

   # Ubuntu/Debian
   sudo apt-get install -y postgresql-client
   ```

2. **Test connection**:
   ```bash
   psql -h <YOUR-RDS-ENDPOINT> -U your_db_user -d tas_db
   ```

3. **Enter password** when prompted.

4. **If successful**, you'll see the `psql` prompt. Type `\q` to exit.

### Test Connection Using Docker

```bash
docker run --rm -it \
  postgres:15-alpine \
  psql -h <YOUR-RDS-ENDPOINT> -U your_db_user -d tas_db -c "SELECT version();"
```

---

## Step 5: Common Issues

### Issue 1: "Connection timeout"

**Possible causes**:
- Security group doesn't allow port 5432 from your application server
- RDS is in different VPC
- Wrong endpoint/address

**Solution**:
1. Check security group allows inbound port 5432 from your app server's IP/SG
2. Verify RDS endpoint is correct
3. Ensure RDS and app servers are in same VPC (or peered VPCs)

### Issue 2: "Authentication failed"

**Possible causes**:
- Wrong username/password
- Username doesn't exist

**Solution**:
1. Verify username and password in your secret store
2. If using a new user, create it with `backend/scripts/setupProductionDB.js`:
   ```bash
   PROD_DB_USER=your_db_user PROD_DB_PASSWORD=your_secure_db_password \
   DATABASE_URL=postgresql://postgres:admin_password@your-db-host:5432/postgres \
   node backend/scripts/setupProductionDB.js
   ```

### Issue 3: "Database does not exist"

**Solution**:
```sql
CREATE DATABASE tas_db;
```

### Issue 4: "No route to host"

**Solution**:
- RDS must be in same VPC as application servers
- Or use VPC peering/VPN
- Check security group rules

---

## Step 6: Update Configuration Files

### docker-compose.production.yml

Ensure `.env.production` on the server contains `DATABASE_URL`. Do not embed credentials in the compose file.

### ECS Task Definition

Reference AWS Secrets Manager instead of inline values:
```json
{
  "secrets": [
    {
      "name": "DATABASE_URL",
      "valueFrom": "arn:aws:secretsmanager:region:account:secret:tas/database-url"
    }
  ]
}
```

### Kubernetes

```bash
kubectl create secret generic tas-database \
  --from-literal=DATABASE_URL="postgresql://your_db_user:your_secure_db_password@your-db-host:5432/tas_db?schema=public&pool_timeout=0&connection_limit=20"
```

---

## Step 7: DATABASE_URL Components Explained

```
postgresql://your_db_user:your_secure_db_password@<endpoint>:5432/tas_db?schema=public&pool_timeout=0&connection_limit=20
│          │            │                       │           │     │
│          │            │                       │           │     └─ Database name
│          │            │                       │           └─ Port (usually 5432)
│          │            │                       └─ RDS endpoint (hostname or IP)
│          │            └─ Password
└─ Username
```

---

## Step 8: URL Encoding for Special Characters

If your password contains special characters, URL-encode them in the connection string:

- `@` → `%40`
- `#` → `%23`
- `$` → `%24`
- `%` → `%25`
- `&` → `%26`
- `/` → `%2F`
- `:` → `%3A`
- `?` → `%3F`
- `=` → `%3D`

**Example**: If password is `pass@word#123`, use:
```
postgresql://your_db_user:pass%40word%23123@<endpoint>:5432/tas_db
```

---

## Step 9: Verification Checklist

Before deploying, verify:

- [ ] RDS endpoint is correct (copy from AWS Console)
- [ ] Port is correct (usually 5432)
- [ ] Username and password are set in `.env.production` (not in git)
- [ ] Database name is `tas_db`
- [ ] Security group allows port 5432 from application servers
- [ ] Connection test succeeds (`psql` command works)

---

## Quick Reference: Where to Find RDS Endpoint

### AWS Console Method
1. AWS Console → RDS → Databases
2. Click your database instance
3. Look for "Endpoint & port" section
4. Copy the endpoint (without port number)

### AWS CLI Method
```bash
aws rds describe-db-instances \
  --db-instance-identifier tas-db-production \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text
```

---

**Note**: Keep all real credentials in `.env.production` or a secret manager on the server. Never commit them to the repository.
