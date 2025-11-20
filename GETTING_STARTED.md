# Getting Started - KPN Talent Acquisition System

Welcome to the KPN Talent Acquisition System! This guide will help you get the system up and running quickly.

## 📋 Quick Overview

The KPN TAS is a comprehensive recruitment management platform consisting of:
- **Backend API** (Node.js + Express + PostgreSQL)
- **Admin Dashboard** (Next.js - for HR/TA teams)
- **Candidate Portal** (Next.js - for job seekers)
- **Supporting Services** (PostgreSQL, Redis)

## 🚀 Quick Start (5 Minutes)

### Option 1: Docker (Recommended for Quick Start)

```bash
# 1. Clone the repository
git clone <repository-url>
cd talent-acquisition-system

# 2. Copy environment file
cp .env.example .env

# 3. Edit .env with your passwords (at minimum, change these):
# - POSTGRES_PASSWORD
# - REDIS_PASSWORD  
# - JWT_SECRET
# - JWT_REFRESH_SECRET
# - ENCRYPTION_KEY

# 4. Start all services
docker-compose up -d

# 5. Run database migrations
docker-compose exec backend npx prisma migrate deploy

# 6. Create initial admin user (optional)
docker-compose exec backend node scripts/create-admin.js

# Done! Access the applications:
# - API: http://localhost:4000/api
# - Admin Dashboard: http://localhost:4001
# - Candidate Portal: http://localhost:4002
```

### Option 2: Manual Setup (Development)

**Prerequisites:**
- Node.js 22.x
- PostgreSQL 15.x
- Redis 7.x

```bash
# 1. Install PostgreSQL and Redis
# (See installation instructions below for your OS)

# 2. Create database
sudo -u postgres psql
CREATE DATABASE tas_db;
CREATE USER tas_user WITH ENCRYPTED PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE tas_db TO tas_user;
\q

# 3. Clone and setup backend
git clone <repository-url>
cd talent-acquisition-system/backend
npm install
cp env.template .env
# Edit .env with your configuration
npx prisma migrate dev
npm run dev

# 4. In a new terminal, setup frontend
cd frontend
npm install
npm run dev

# 5. In another terminal, setup candidate portal
cd candidate-portal
npm install
npm run dev
```

## 📦 Installation Details

### Installing PostgreSQL

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**macOS:**
```bash
brew install postgresql@15
brew services start postgresql@15
```

**Windows:**
Download installer from https://www.postgresql.org/download/windows/

### Installing Redis

**Ubuntu/Debian:**
```bash
sudo apt install redis-server
sudo systemctl start redis
sudo systemctl enable redis
```

**macOS:**
```bash
brew install redis
brew services start redis
```

**Windows:**
Download from https://github.com/microsoftarchive/redis/releases

## ⚙️ Configuration

### Backend Environment Variables

Create `backend/.env`:

```env
# Application
NODE_ENV=development
PORT=4000
API_BASE_URL=http://localhost:4000
FRONTEND_URL=http://localhost:4001
CANDIDATE_PORTAL_URL=http://localhost:4002

# Database
DATABASE_URL=postgresql://tas_user:your_password@localhost:5432/tas_db?schema=public

# Redis
REDIS_URL=redis://localhost:6379

# JWT (Generate secure keys for production)
JWT_SECRET=your-super-secret-jwt-key-min-32-characters-long
JWT_REFRESH_SECRET=your-super-secret-refresh-key-min-32-characters-long
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Encryption (MUST be exactly 32 characters)
ENCRYPTION_KEY=your-32-character-encryption-key

# Email (Optional for development)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=noreply@kpn.com

# CORS
CORS_ORIGIN=http://localhost:4001,http://localhost:4002

# Security
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

**Generate Secure Keys:**
```bash
# JWT Secret (64 characters)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Encryption Key (32 characters)
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

## 🗄️ Database Setup

### Run Migrations

```bash
cd backend
npx prisma migrate dev
npx prisma generate
```

### Seed Database (Optional)

Create `backend/prisma/seed.js`:

```javascript
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  // Create admin user
  const adminPassword = await bcrypt.hash('Admin123!', 12);
  
  const admin = await prisma.user.create({
    data: {
      email: 'admin@kpn.com',
      password: adminPassword,
      firstName: 'System',
      lastName: 'Administrator',
      role: 'SUPER_ADMIN',
      isActive: true,
      isEmailVerified: true,
    },
  });

  console.log('Admin user created:', admin.email);

  // Create sample FPTK
  const fptk = await prisma.fPTK.create({
    data: {
      fptkNumber: 'FPTK-2024-001',
      positionTitle: 'Senior Software Engineer',
      department: 'Technology',
      location: 'Jakarta',
      employmentType: 'Permanent',
      level: 'Senior',
      numberOfPositions: 2,
      minEducation: 'Bachelor',
      minExperience: 5,
      requiredSkills: ['JavaScript', 'React', 'Node.js', 'PostgreSQL'],
      jobDescription: 'We are looking for a talented Senior Software Engineer...',
      responsibilities: '- Develop web applications\n- Mentor junior developers',
      qualifications: '- 5+ years experience\n- Strong in JavaScript',
      salaryRangeMin: 15000000,
      salaryRangeMax: 25000000,
      status: 'APPROVED',
      createdBy: admin.id,
      requestedBy: 'Tech Manager',
    },
  });

  console.log('Sample FPTK created:', fptk.fptkNumber);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

Run seed:
```bash
node prisma/seed.js
```

## 🧪 Testing the System

### 1. Test Backend API

```bash
# Health check
curl http://localhost:4000/health

# Register a candidate
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.doe@example.com",
    "password": "SecurePass123!",
    "firstName": "John",
    "lastName": "Doe"
  }'

# Login
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@kpn.com",
    "password": "Admin123!"
  }'
```

### 2. Test Frontend

Open browser to:
- Admin Dashboard: http://localhost:4001
- Candidate Portal: http://localhost:4002

### 3. Test Database Connection

```bash
cd backend
npx prisma studio
```

Opens Prisma Studio at http://localhost:5555 for database browsing.

## 📚 Project Structure

```
talent-acquisition-system/
├── backend/                 # Node.js API
│   ├── src/
│   │   ├── config/         # Database, Redis configuration
│   │   ├── controllers/    # Request handlers
│   │   ├── middleware/     # Auth, validation, error handling
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   ├── utils/          # Helpers
│   │   ├── app.js          # Express app
│   │   └── server.js       # Entry point
│   ├── prisma/
│   │   └── schema.prisma   # Database schema
│   └── package.json
│
├── frontend/               # Admin Dashboard (Next.js)
│   ├── src/
│   │   ├── app/           # Next.js app directory
│   │   ├── components/    # React components
│   │   └── lib/           # Utilities
│   └── package.json
│
├── candidate-portal/       # Candidate Portal (Next.js)
│   ├── src/
│   │   ├── app/           # Next.js app directory
│   │   ├── components/    # React components
│   │   └── lib/           # Utilities
│   └── package.json
│
├── docs/                   # Documentation
│   ├── ARCHITECTURE.md
│   ├── API_DOCUMENTATION.md
│   ├── FUNCTIONAL_SPECS.md
│   └── DEPLOYMENT.md
│
├── nginx/                  # Nginx configuration
│   └── nginx.conf
│
├── docker-compose.yml      # Development containers
├── docker-compose.prod.yml # Production containers
└── README.md
```

## 🔑 Default Credentials

After running the seed script:

**Admin User:**
- Email: admin@kpn.com
- Password: Admin123!

**⚠️ IMPORTANT: Change these credentials immediately in production!**

## 🎯 Next Steps

### For Developers

1. **Explore the API**
   - Read [API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md)
   - Try endpoints with Postman or cURL
   - Check out Prisma Studio for database

2. **Customize the System**
   - Modify database schema in `backend/prisma/schema.prisma`
   - Add new API endpoints in `backend/src/routes/`
   - Customize frontend components

3. **Add Features**
   - Implement interview scheduling
   - Add document upload functionality
   - Create dashboard analytics

### For System Administrators

1. **Configure Email**
   - Setup SMTP settings in `.env`
   - Test email notifications

2. **Setup Backups**
   - Configure automated database backups
   - Test restore procedures

3. **Enable Monitoring**
   - Setup application monitoring
   - Configure log rotation

4. **Security Hardening**
   - Change all default passwords
   - Configure firewall rules
   - Setup SSL certificates

## 📖 Documentation

- [README.md](README.md) - Project overview
- [ARCHITECTURE.md](docs/ARCHITECTURE.md) - System architecture
- [API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md) - API reference
- [FUNCTIONAL_SPECS.md](docs/FUNCTIONAL_SPECS.md) - Functional requirements
- [DEPLOYMENT.md](docs/DEPLOYMENT.md) - Deployment guide

## 🐛 Troubleshooting

### Backend won't start

```bash
# Check Node version
node --version  # Should be 22.x

# Check if ports are in use
netstat -tunlp | grep :4000
netstat -tunlp | grep :5432
netstat -tunlp | grep :6379

# Check logs
cd backend
npm run dev
# Look for error messages
```

### Database connection error

```bash
# Test PostgreSQL
psql -U tas_user -d tas_db -h localhost

# Check if PostgreSQL is running
sudo systemctl status postgresql

# Check connection string in .env
cat backend/.env | grep DATABASE_URL
```

### Redis connection error

```bash
# Test Redis
redis-cli ping

# Check if Redis is running
sudo systemctl status redis

# Check connection string
cat backend/.env | grep REDIS_URL
```

### Prisma errors

```bash
# Regenerate Prisma client
cd backend
npx prisma generate

# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# View migrations
npx prisma migrate status
```

## 💡 Tips

1. **Use Docker for Quick Setup**: Easiest way to get started
2. **Check Logs**: Always check logs when something doesn't work
3. **Prisma Studio**: Great tool for viewing/editing database data
4. **Environment Variables**: Never commit `.env` files to Git
5. **Secure Passwords**: Use strong, random passwords in production

## 🤝 Getting Help

- Read the documentation in `/docs`
- Check GitHub Issues
- Contact: support@kpn.com

## ✅ Verification Checklist

After setup, verify:
- [ ] Backend API responds at http://localhost:4000/health
- [ ] Can login with admin credentials
- [ ] Can register new candidate
- [ ] Frontend loads at http://localhost:4001
- [ ] Candidate portal loads at http://localhost:4002
- [ ] Database migrations applied successfully
- [ ] Prisma Studio works (`npx prisma studio`)
- [ ] Redis connection working
- [ ] Email sending configured (optional)

---

**You're all set! Happy coding! 🚀**

