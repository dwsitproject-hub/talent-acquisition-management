# Fix .env.backend File

## Problem
The `.env.backend` file contains markdown formatting which causes export errors.

## Solution: Create Clean .env.backend File

**On the server, run these commands:**

```bash
# Navigate to project directory
cd /opt/tas

# Remove the corrupted file
rm -f .env.backend

# Create a new clean .env.backend file
cat > .env.backend << 'EOF'
# Server Configuration
SERVER_HOST=your.server.host

# Database Configuration
POSTGRES_PASSWORD=CHANGE_THIS_STRONG_PASSWORD

# Redis Configuration
REDIS_PASSWORD=CHANGE_THIS_STRONG_PASSWORD

# JWT Secrets (64 characters each)
JWT_SECRET=CHANGE_THIS_64_CHAR_HEX_STRING
JWT_REFRESH_SECRET=CHANGE_THIS_64_CHAR_HEX_STRING

# Encryption Key (MUST be exactly 32 characters)
ENCRYPTION_KEY=CHANGE_THIS_32_CHAR_HEX_STRING

# Application URLs
FRONTEND_URL=http://your.server.host
CANDIDATE_PORTAL_URL=http://your.server.host:4002
CORS_ORIGIN=http://your.server.host,http://your.server.host:4001,http://your.server.host:4002
API_BASE_URL=http://your.server.host:4000/api

# Email Configuration (Optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_NAME=KPN Talent Acquisition
SMTP_FROM_EMAIL=noreply@example.com
EOF

# Verify the file
cat .env.backend
```

**Then generate secure passwords and secrets:**

```bash
# Generate all secrets
echo "POSTGRES_PASSWORD=$(openssl rand -base64 32)"
echo "REDIS_PASSWORD=$(openssl rand -base64 32)"
echo "JWT_SECRET=$(openssl rand -hex 32)"
echo "JWT_REFRESH_SECRET=$(openssl rand -hex 32)"
echo "ENCRYPTION_KEY=$(openssl rand -hex 16)"
```

**Copy the output and edit `.env.backend`:**

```bash
nano .env.backend
```

**Replace the `CHANGE_THIS_*` placeholders with the generated values.**

**Save:** `Ctrl+X`, then `Y`, then `Enter`

**Now test the export:**

```bash
export $(cat .env.backend | grep -v '^#' | xargs)
echo $POSTGRES_PASSWORD
```

If it shows your password, it worked!

**Note:** `.env.backend` must remain on the server only. Never commit it to git.
