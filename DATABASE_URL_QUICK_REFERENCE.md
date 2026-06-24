# DATABASE_URL Quick Reference

## How to Update DATABASE_URL in docker-compose.production.yml

### Step 1: Find Your RDS Endpoint

**AWS Console Method:**
1. Go to **AWS Console** → **RDS** → **Databases**
2. Click your database instance name
3. Find **"Endpoint"** or **"Endpoint & port"** section
4. Copy the endpoint (it looks like: `tas-db-prod.abc123xyz.us-east-1.rds.amazonaws.com`)

### Step 2: Set DATABASE_URL in `.env.production` (server only)

**File**: `.env.production` on your deployment server (never commit this file)

**Example:**
```bash
DATABASE_URL=postgresql://your_db_user:your_secure_db_password@your-db-host.rds.amazonaws.com:5432/tas_db?schema=public&pool_timeout=0&connection_limit=20
```

`docker-compose.production.yml` reads `DATABASE_URL` from `.env.production`:
```yaml
DATABASE_URL: ${DATABASE_URL}
```

### Step 3: What Each Part Means

```
postgresql://your_db_user:your_secure_db_password@[ENDPOINT-HERE]:5432/tas_db?schema=public&pool_timeout=0&connection_limit=20
                  │              │                    │                │        │
                  │              │                    │                │        └─ Connection limit
                  │              │                    │                └─ Database name
                  │              │                    └─ Port (usually 5432)
                  │              └─ Password (URL-encode special characters)
                  └─ Username
```

**Replace `[ENDPOINT-HERE]` with your RDS endpoint or private DB host.**

### Step 4: Verify It Works

**Test connection:**
```bash
psql -h <YOUR-ENDPOINT> -U your_db_user -d tas_db
```

Enter your database password when prompted.

If successful, you'll see:
```
psql (15.x)
Type "help" for help.

tas_db=>
```

Type `\q` to exit.

---

## Common Questions

**Q: I don't see the endpoint in AWS Console?**  
A: Make sure RDS instance is created and in "Available" status. The endpoint appears after creation (takes 5-10 minutes).

**Q: Can I use the IP address instead of endpoint?**  
A: Yes, if you know the internal IP and it's static. The endpoint is recommended as it's stable.

**Q: My password has special characters, do I need to encode them?**  
A: Yes — URL-encode special characters in the password portion of the connection string (e.g. `@` → `%40`).

---

## Quick Checklist

- [ ] Found RDS endpoint in AWS Console
- [ ] Set `DATABASE_URL` in server-local `.env.production`
- [ ] Tested connection with `psql` command
- [ ] Security group allows port 5432 from application servers
- [ ] Ready to deploy!

---

**See `DATABASE_URL_SETUP_GUIDE.md` for detailed instructions.**
