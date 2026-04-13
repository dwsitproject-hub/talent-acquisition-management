# KPN Talent Acquisition System (TAS)

## Overview

The KPN Talent Acquisition System is an enterprise-grade, production-ready recruitment management platform that digitalizes and optimizes the entire hiring process from FPTK approval to employee onboarding. The system features AI-powered automation, external candidate portals, and comprehensive analytics for data-driven recruitment decisions.

## 🏗️ Architecture

### Technology Stack

**Backend:**
- Node.js 22.x with Express.js
- PostgreSQL 15+ (Production database)
- Prisma ORM (Type-safe database access)
- JWT Authentication with refresh tokens
- Redis (Session management & caching)
- Bull Queue (Background jobs & email processing)

**Frontend:**
- React 18+ with TypeScript
- Next.js 14 (SSR/SSG for performance)
- TailwindCSS (Modern UI framework)
- React Query (Server state management)
- Zustand (Client state management)
- Socket.io (Real-time notifications)

**Security:**
- Helmet.js (HTTP headers security)
- Rate limiting with express-rate-limit
- CORS configuration
- bcrypt (Password hashing)
- AES-256 encryption for sensitive data
- SQL injection prevention (Prisma parameterized queries)
- XSS protection
- CSRF tokens
- Role-Based Access Control (RBAC)

**DevOps:**
- Docker & Docker Compose
- Nginx (Reverse proxy & load balancer)
- PM2 (Process management)
- GitHub Actions (CI/CD)
- PostgreSQL backups automation

## 🎯 Key Features

### Core Functionality
- ✅ 9-stage recruitment pipeline management
- ✅ External candidate portal (self-service)
- ✅ Internal HR/TA dashboard
- ✅ AI-powered candidate matching
- ✅ Document verification system
- ✅ E-signature integration
- ✅ Multi-level approval workflows
- ✅ Real-time notifications (Email & WhatsApp)
- ✅ Comprehensive reporting & analytics

### Recently Added (Prototype-first in Frontend)
- ✅ Open Position change logging (client-side) capturing:
  - Job posting status updates
  - Applied candidate status updates
  - Adding/removing interviews
  - Adding candidates to a position
  - High-level job posting edits (field-level diff)
- ✅ Summary by Position enhanced to use Open Position logs:
  - Counts unique candidates per status over their entire history for each position (not only latest)
  - Shows Remark field from the Open Position
  - Shows SLA bucket per position based on Request Date: 0-30, 31-60, 61-90, Above 91 days
- ✅ Remark field added to Open Position (Create, Edit, View) with 2048 char limit and persistence
- ✅ Applied candidate visibility aligned between **View** and **Edit Position**:
  - Edit dialog now loads applied candidates using the same matching logic as the View dialog
  - Supports legacy `positionAppliedFor` data stored both directly and inside `languages.positionAppliedFor`
  - Uses paginated candidate loading (up to API limit) so all relevant candidates are included
- ✅ Interview scheduling UX improvements in **Edit Position**:
  - `Interviewer` field now has autocomplete suggestions powered by the **Team** directory
  - Suggestions match first name, last name, full name, or email
  - If no match is found, users can still enter and save free‑text interviewer names
- ✅ Production database backup automation:
  - Daily automated backups at **7:00 PM GMT+7 (WIB) / 12:00 UTC**
  - Centralized backup directory: `/opt/backups/tas-production`
  - Retention policy: backups older than **14 days** are automatically deleted
  - Cross‑platform restore flow documented for Linux servers and Windows laptops (PowerShell + WSL)

### User Roles
1. **Hiring Manager** - FPTK upload, requisition monitoring
2. **Talent Acquisition (TA)** - Pipeline management, sourcing
3. **HR Business Partner (HRBP)** - Compliance, validation
4. **Department/Division Head** - Approvals
5. **Candidate** - Application submission, progress tracking
6. **Management/CHRO** - KPI dashboards, analytics

### 9-Stage Recruitment Process
1. **FPTK Upload & Sync** - Map approved requisitions
2. **Candidate Sourcing & Screening** - AI-based shortlisting
3. **Psychometric & Technical Tests** - Automated scheduling
4. **User Interviews** - Multi-stage interview management
5. **Document Verification** - Digital document collection
6. **Offering & Negotiation** - Approval workflows
7. **Medical Check-Up** - MCU scheduling & validation
8. **Signing Process** - E-signature integration
9. **Onboarding** - Task tracking & completion

## 🔐 Security Features

### Authentication & Authorization
- JWT access tokens (15-minute expiry)
- Refresh tokens (7-day expiry, httpOnly cookies)
- Role-Based Access Control (RBAC)
- Multi-factor authentication (MFA) support
- Session management with Redis
- Account lockout after failed login attempts

### Data Protection
- AES-256 encryption for PII data
- Encrypted database backups
- Secure file uploads with validation
- Rate limiting on all endpoints
- SQL injection prevention
- XSS and CSRF protection
- HTTPS enforcement
- Audit logging for all sensitive operations

### Compliance
- GDPR-ready data handling
- Data retention policies
- Right to be forgotten implementation
- Consent management
- Privacy policy enforcement

## 📁 Project Structure

```
talent-acquisition-system/
├── backend/
│   ├── src/
│   │   ├── config/          # Configuration files
│   │   ├── controllers/     # Request handlers
│   │   ├── middleware/      # Auth, validation, error handling
│   │   ├── models/          # Prisma models
│   │   ├── routes/          # API routes
│   │   ├── services/        # Business logic
│   │   ├── utils/           # Helpers & utilities
│   │   ├── validators/      # Input validation schemas
│   │   ├── jobs/            # Background jobs
│   │   └── app.js           # Express app setup
│   ├── prisma/
│   │   ├── schema.prisma    # Database schema
│   │   └── migrations/      # Database migrations
│   ├── tests/               # Unit & integration tests
│   ├── .env.example         # Environment variables template
│   ├── Dockerfile           # Backend container
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── app/             # Next.js app directory
│   │   ├── components/      # React components
│   │   ├── lib/             # Utilities & helpers
│   │   ├── hooks/           # Custom React hooks
│   │   ├── services/        # API services
│   │   ├── store/           # State management
│   │   └── types/           # TypeScript types
│   ├── public/              # Static assets
│   ├── Dockerfile           # Frontend container
│   └── package.json
├── candidate-portal/        # External candidate portal
│   └── (similar structure to frontend)
├── docs/
│   ├── ARCHITECTURE.md      # System architecture
│   ├── API_DOCUMENTATION.md # API specs
│   ├── DEPLOYMENT.md        # Deployment guide
│   └── FUNCTIONAL_SPECS.md  # Functional requirements
├── docker-compose.yml       # Multi-container setup
├── docker-compose.prod.yml  # Production configuration
├── nginx/
│   └── nginx.conf           # Nginx configuration
└── README.md
```

## 🚀 Quick Start

### Prerequisites
- Node.js 22.x or higher
- PostgreSQL 15+
- Redis 7+
- Docker & Docker Compose (for containerized deployment)

### Development Setup

1. **Clone the repository**
```bash
git clone <repository-url>
cd talent-acquisition-system
```

2. **Setup Backend**
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your configuration
npx prisma migrate dev
npx prisma generate
npm run dev
```

3. **Setup Frontend**
```bash
cd frontend
npm install
cp .env.example .env
# Edit .env with your configuration
npm run dev
```

By default the frontend runs at `http://localhost:4001` (see `PORT_CONFIGURATION.md`).

4. **Setup Candidate Portal**
```bash
cd candidate-portal
npm install
cp .env.example .env
npm run dev
```

### Docker Deployment (Production)

```bash
# Build and start all services
docker-compose -f docker-compose.prod.yml up -d

# Run database migrations
docker-compose exec backend npx prisma migrate deploy

# View logs
docker-compose logs -f

# Access the system:
# - API: http://localhost:4000/api
# - Admin Dashboard: http://localhost:4001
# - Candidate Portal: http://localhost:4002

# Stop all services
docker-compose down
```

## 🔧 Configuration

### Environment Variables

**Backend (.env)**
```env
# Application
NODE_ENV=production
PORT=3000
API_BASE_URL=https://api.yourdomain.com

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/tas_db

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_REFRESH_SECRET=your-super-secret-refresh-key
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Encryption
ENCRYPTION_KEY=your-32-character-encryption-key

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# WhatsApp (Twilio)
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886

# File Upload
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=pdf,doc,docx,jpg,jpeg,png

# Security
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## 📊 Database Schema

The system uses PostgreSQL with the following main entities:
- Users (with role-based permissions)
- FPTK (Requisitions)
- Candidates
- Applications
- Interviews
- Offers
- Documents
- Onboarding Tasks
- Audit Logs

See `docs/DATABASE_SCHEMA.md` for detailed schema documentation.

## 🧩 Frontend Prototype Data Model (LocalStorage)

While the production system uses the backend API and PostgreSQL, parts of the current frontend use `localStorage` for rapid prototyping and demo data:

- `jobPostings`: stores Open Positions, including fields like `requestDate`, `remark`, `status`, milestones, etc.
- `candidates`: stores candidate objects, including interviews and status.
- `openPositionLogs`: append-only client-side log of Open Position changes used for analytics.

This enables:
- Open Position View/Edit/Create without backend round-trips
- Historical status aggregation in Summary by Position
- Lightweight SLA calculations by Request Date

## ✍️ Open Position Logging (Client-Side)

- Where: `frontend/src/components/EditJobPostingModal.tsx`
- Storage: `localStorage` key `openPositionLogs`
- Log entry shape:
  - `id`, `timestamp`, `jobPostingId`, `type`, `details`
  - Types: `JOB_STATUS_UPDATE`, `CANDIDATE_STATUS_UPDATE`, `APPLIED_CANDIDATE_ADDED`, `INTERVIEW_ADDED`, `INTERVIEW_REMOVED`, `JOB_POSTING_UPDATED`
- Quick view in browser console:
```js
JSON.parse(localStorage.getItem('openPositionLogs') || '[]')
```

## 📈 Summary by Position

- File: `frontend/src/app/summary-by-position/page.tsx`
- Data sources:
  - `jobPostings` for positions, Request Date, Remark
  - `openPositionLogs` for status history
- Counting logic:
  - Builds a set of statuses per candidate per position from logs
  - Counts a candidate once per status they have ever held
- Columns:
  - Urgent/Normal, Division, Section, Position, Status FKTK
  - Remark (from Open Position)
  - SLA bucket (by Request Date): `0-30 Days`, `31-60 Days`, `61-90 Days`, `Above 91 Days`
  - Status columns with counts

## 📝 Remark Field

- Added to Open Position Create/Edit/View
- Max length 2048 characters
- Persisted in `jobPostings.remark` and displayed in Summary by Position

## 📡 API Documentation

API documentation is available at `/api-docs` when running the backend server.

Key API endpoints:
- `POST /api/auth/login` - User authentication
- `POST /api/auth/register` - Candidate registration
- `GET /api/candidates` - List candidates
- `POST /api/fptk` - Create/upload FPTK
- `GET /api/applications/:id` - Get application details
- `POST /api/interviews` - Schedule interview
- `PUT /api/offers/:id/approve` - Approve offer

See `docs/API_DOCUMENTATION.md` for complete API reference.

## 🧪 Testing

```bash
# Run unit tests
npm test

# Run integration tests
npm run test:integration

# Run with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e
```

## 📈 Monitoring & Logging

- Application logs: Winston logger with rotation
- Error tracking: Sentry integration
- Performance monitoring: New Relic / DataDog
- Database monitoring: pg_stat_statements
- Real-time metrics dashboard

## 🔄 CI/CD Pipeline

GitHub Actions workflow:
1. Run linters (ESLint, Prettier)
2. Run tests (unit, integration)
3. Build Docker images
4. Push to container registry
5. Deploy to staging
6. Manual approval for production
7. Deploy to production
8. Run smoke tests

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

Proprietary - KPN Corporation. All rights reserved.

## 👥 Support

For technical support or questions:
- Email: support@kpn.com
- Internal Slack: #tas-support
- Documentation: https://docs.tas.kpn.com

## 🗺️ Roadmap

### Phase 1 (Current) - Q4 2024
- ✅ Core recruitment pipeline
- ✅ User authentication & RBAC
- ✅ Candidate portal
- ✅ Basic reporting

### Phase 2 - Q1 2025
- 🔄 AI candidate matching
- 🔄 Advanced analytics dashboard
- 🔄 WhatsApp notifications
- 🔄 E-signature integration

### Phase 3 - Q2 2025
- 📋 Video interview integration
- 📋 Mobile application
- 📋 Advanced AI features
- 📋 Multi-language support

---

**Built with ❤️ by KPN Technology Team**

