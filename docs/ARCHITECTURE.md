# System Architecture - KPN Talent Acquisition System

## Table of Contents
1. [High-Level Architecture](#high-level-architecture)
2. [System Components](#system-components)
3. [Data Flow](#data-flow)
4. [Security Architecture](#security-architecture)
5. [Scalability & Performance](#scalability--performance)
6. [Infrastructure](#infrastructure)

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Load Balancer (Nginx)                      │
│                     (SSL Termination, Rate Limiting)              │
└────────────────┬──────────────────┬─────────────────────────────┘
                 │                  │
        ┌────────▼────────┐  ┌─────▼──────────┐
        │  Candidate      │  │  Internal       │
        │  Portal         │  │  Admin          │
        │  (Next.js)      │  │  Dashboard      │
        │                 │  │  (Next.js)      │
        └────────┬────────┘  └─────┬──────────┘
                 │                  │
                 └──────────┬───────┘
                            │
                   ┌────────▼────────┐
                   │   API Gateway    │
                   │   (Express.js)   │
                   │  + Auth Middleware│
                   └────────┬────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
   ┌────▼─────┐      ┌─────▼──────┐     ┌─────▼──────┐
   │ Business │      │  Auth       │     │  AI/ML     │
   │ Services │      │  Service    │     │  Service   │
   └────┬─────┘      └─────┬──────┘     └─────┬──────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
   ┌────▼─────┐      ┌─────▼──────┐     ┌─────▼──────┐
   │PostgreSQL│      │   Redis    │     │  File      │
   │ Primary  │      │  (Cache/   │     │  Storage   │
   │          │      │  Sessions) │     │  (S3/Minio)│
   └────┬─────┘      └────────────┘     └────────────┘
        │
   ┌────▼─────┐
   │PostgreSQL│
   │ Replica  │
   │ (Read)   │
   └──────────┘

        ┌────────────────┐
        │  Background    │
        │  Jobs Queue    │
        │  (Bull/Redis)  │
        └────────────────┘
```

## System Components

### 1. Frontend Layer

#### Candidate Portal (External-Facing)
- **Technology**: Next.js 14 with React 18, TypeScript
- **Purpose**: Public-facing portal for job seekers
- **Features**:
  - Job search and filtering
  - Account registration and authentication
  - Application submission
  - Document uploads
  - Application status tracking
  - Interview schedule viewing
  - Offer letter acceptance
- **Security**:
  - Content Security Policy (CSP)
  - Rate limiting per IP
  - ReCAPTCHA for registration
  - Secure file upload validation

#### Internal Admin Dashboard
- **Technology**: Next.js 14 with React 18, TypeScript
- **Purpose**: Internal HR/TA team interface
- **Features**:
  - FPTK management
  - Candidate pipeline visualization
  - Interview scheduling
  - Approval workflows
  - Document verification
  - Analytics dashboards
  - User management
- **Security**:
  - Role-based UI rendering
  - Audit logging
  - Session timeout
  - IP whitelisting option

### 2. Backend Layer

#### API Gateway
- **Technology**: Express.js on Node.js 22
- **Responsibilities**:
  - Request routing
  - Authentication & authorization
  - Input validation
  - Rate limiting
  - Request/response logging
  - Error handling

#### Authentication Service
```javascript
Components:
- JWT token generation/validation
- Refresh token rotation
- Password hashing (bcrypt)
- MFA support
- Session management (Redis)
- OAuth2 integration (optional)

Security Measures:
- Password complexity requirements
- Account lockout after 5 failed attempts
- Token blacklisting
- Secure password reset flow
- Audit trail for auth events
```

#### Business Services

**FPTK Service**
- Upload and parse FPTK documents
- Validate requisition data
- Map to job positions
- Track utilization

**Candidate Service**
- Candidate profile management
- AI-powered scoring
- Duplicate detection
- Document verification
- Privacy controls

**Application Service**
- Application lifecycle management
- Status tracking through 9 stages
- SLA monitoring
- Automated notifications

**Interview Service**
- Multi-stage interview scheduling
- Interviewer assignment
- Feedback collection
- Calendar integration

**Offer Service**
- Offer generation
- Multi-level approval workflow
- Negotiation tracking
- E-signature integration

**Onboarding Service**
- Task checklist management
- Document collection
- Progress tracking
- Automated reminders

**Notification Service**
- Email notifications (SMTP)
- WhatsApp messages (Twilio)
- In-app notifications (Socket.io)
- SMS alerts

#### AI/ML Service
- **CV Parsing**: Extract structured data from resumes
- **Candidate Matching**: NLP-based job-CV fit scoring
- **Time-to-Fill Prediction**: ML model for recruitment forecasting
- **Source Effectiveness**: Analyze hiring channels
- **Offer Acceptance Prediction**: Probability scoring

### 3. Data Layer

#### PostgreSQL Database
```
Configuration:
- Version: 15+
- Connection Pooling: PgBouncer
- Replication: Primary-Replica setup
- Backup: Daily automated backups
- Point-in-time recovery enabled

Performance Optimizations:
- Indexed foreign keys
- Materialized views for reports
- Partitioning for large tables
- Query optimization with EXPLAIN
```

#### Redis Cache
```
Use Cases:
- Session storage
- API response caching
- Rate limiting counters
- Job queue (Bull)
- Real-time data

Configuration:
- Persistence: AOF + RDB
- Eviction policy: allkeys-lru
- Clustering for high availability
```

#### File Storage
```
Options:
- AWS S3 (production recommended)
- MinIO (self-hosted alternative)

Features:
- Encrypted at rest
- Presigned URLs for downloads
- Lifecycle policies
- CDN integration
- Virus scanning
```

### 4. Background Jobs

**Job Queue (Bull + Redis)**
- Email sending
- Document processing
- Report generation
- Data aggregation
- Scheduled notifications
- SLA breach checks

## Data Flow

### 1. Candidate Application Flow
```
1. Candidate registers on portal
   ↓
2. System creates user account (encrypted)
   ↓
3. Candidate browses open positions (cached)
   ↓
4. Submits application + documents
   ↓
5. Documents uploaded to S3, virus scanned
   ↓
6. AI service scores CV against job requirements
   ↓
7. Application enters pipeline (Stage 1)
   ↓
8. TA receives notification
   ↓
9. Status updates trigger candidate notifications
```

### 2. FPTK Upload & Processing Flow
```
1. Hiring Manager uploads approved FPTK
   ↓
2. Backend validates file format
   ↓
3. Extract data using parser
   ↓
4. Validate against business rules
   ↓
5. Create requisition in database
   ↓
6. Link to job position
   ↓
7. Publish opening on candidate portal
   ↓
8. Send notifications to TA team
```

### 3. Interview Scheduling Flow
```
1. TA selects candidates for interview
   ↓
2. System checks interviewer availability
   ↓
3. Proposes time slots
   ↓
4. Sends calendar invites
   ↓
5. Candidate confirms attendance
   ↓
6. Pre-interview reminders (24h, 1h before)
   ↓
7. Post-interview feedback collection
   ↓
8. Aggregate scores for decision-making
```

### 4. Offer Approval Flow
```
1. TA creates offer proposal
   ↓
2. HRBP reviews for compliance
   ↓
3. Department Head approves/rejects
   ↓
4. If approved, generate offer letter
   ↓
5. Send to candidate via email + portal
   ↓
6. Candidate reviews and e-signs
   ↓
7. Counter-offer handling (if applicable)
   ↓
8. Final acceptance triggers onboarding
```

## Security Architecture

### 1. Authentication & Authorization

**JWT Token Strategy**
```javascript
Access Token:
- Expiry: 15 minutes
- Payload: { userId, role, permissions }
- Signed with HS256 algorithm

Refresh Token:
- Expiry: 7 days
- Stored in httpOnly cookie
- Rotated on each use
- Family tracking for revocation
```

**Role-Based Access Control (RBAC)**
```
Roles Hierarchy:
1. Super Admin (full system access)
2. CHRO/Management (read-only analytics)
3. Department Head (approve offers, view department data)
4. HRBP (compliance review, all candidate data)
5. TA Team (manage pipeline, sourcing)
6. Hiring Manager (view requisitions, approve shortlists)
7. Interviewer (view assigned interviews)
8. Candidate (own data only)

Permission Matrix stored in database
Middleware checks: role → resource → action
```

### 2. Data Protection

**Encryption at Rest**
- Database: PostgreSQL with pgcrypto extension
- Files: S3 server-side encryption (SSE-S3)
- Sensitive fields: AES-256 encryption
  - National ID
  - Bank account details
  - Medical information

**Encryption in Transit**
- TLS 1.3 for all connections
- Certificate pinning for mobile apps
- Secure WebSocket connections

**Data Masking**
- PII masked in logs
- Sensitive data redacted in non-production environments
- Anonymization for analytics

### 3. Input Validation & Sanitization

```javascript
Layers:
1. Frontend: Zod schema validation
2. API Gateway: Express-validator
3. Business Logic: Additional business rules
4. Database: Constraints and triggers

Protection Against:
- SQL Injection (Prisma parameterized queries)
- XSS (input sanitization, CSP headers)
- CSRF (CSRF tokens for state-changing operations)
- Path traversal (file upload validation)
- Command injection (no shell execution)
```

### 4. Rate Limiting

```javascript
Configuration:
- Anonymous users: 20 req/minute
- Authenticated users: 100 req/minute
- Login endpoint: 5 attempts/15 minutes
- File upload: 5 uploads/hour
- API key endpoints: 1000 req/hour

Implementation: Redis-based distributed rate limiting
```

### 5. Audit Logging

```javascript
Logged Events:
- All authentication attempts
- CRUD operations on sensitive data
- Approval/rejection actions
- Document downloads
- Configuration changes
- User role modifications

Log Storage:
- PostgreSQL audit table
- Write-once, read-many
- Tamper-evident (hash chain)
- Retained for 7 years
```

## Scalability & Performance

### Horizontal Scaling
```
Component         | Scaling Strategy
------------------|------------------
Frontend          | CDN + multiple instances behind LB
API Gateway       | Stateless, scale with load
Business Services | Container orchestration (K8s)
PostgreSQL        | Read replicas, connection pooling
Redis             | Cluster mode with sharding
File Storage      | S3 (infinitely scalable)
```

### Caching Strategy
```
Layer 1: Browser Cache (static assets)
Layer 2: CDN Cache (public content)
Layer 3: Redis Cache (API responses, sessions)
Layer 4: Database Query Cache
Layer 5: Materialized Views (reports)
```

### Performance Targets
- API response time: < 200ms (p95)
- Page load time: < 2 seconds
- Database query time: < 50ms (p95)
- File upload: Support up to 10MB files
- Concurrent users: 1000+ simultaneous
- System uptime: 99.9% SLA

### Database Optimization
```sql
-- Indexing strategy
CREATE INDEX idx_candidates_email ON candidates(email);
CREATE INDEX idx_applications_status ON applications(status);
CREATE INDEX idx_applications_created_at ON applications(created_at DESC);

-- Partitioning for audit logs (time-based)
CREATE TABLE audit_logs_2024_q4 PARTITION OF audit_logs
  FOR VALUES FROM ('2024-10-01') TO ('2025-01-01');

-- Materialized views for dashboards
CREATE MATERIALIZED VIEW dashboard_metrics AS
  SELECT ...
  WITH DATA;
```

## Infrastructure

### Production Environment

**AWS Architecture**
```
Region: Primary (e.g., ap-southeast-1)
        Backup (e.g., ap-northeast-1)

Services:
- ECS/EKS: Container orchestration
- RDS PostgreSQL: Managed database (Multi-AZ)
- ElastiCache: Redis cluster
- S3: File storage
- CloudFront: CDN
- Route53: DNS management
- ALB: Load balancing
- CloudWatch: Monitoring & logging
- KMS: Encryption key management
- Secrets Manager: Credentials storage
```

**Docker Compose (Self-Hosted Option)**
```yaml
Services:
- nginx (reverse proxy)
- backend (3 instances)
- frontend (2 instances)
- candidate-portal (2 instances)
- postgresql (primary + replica)
- redis (cluster)
- minio (S3-compatible storage)
```

### Disaster Recovery

**Backup Strategy**
```
Database:
- Continuous backup with PITR
- Daily full backup (retained 30 days)
- Weekly backup (retained 1 year)
- Backup tested monthly

Files:
- S3 versioning enabled
- Cross-region replication
- Glacier for long-term retention

Configuration:
- Infrastructure as Code (Terraform)
- Stored in version control
```

**Recovery Objectives**
- RTO (Recovery Time Objective): 1 hour
- RPO (Recovery Point Objective): 5 minutes

### Monitoring & Alerting

**Metrics to Monitor**
```
Application:
- Request rate & latency
- Error rates (4xx, 5xx)
- Active user sessions
- Job queue length

Infrastructure:
- CPU & memory utilization
- Disk I/O & space
- Network throughput
- Database connections

Business:
- Applications per day
- Time-to-hire metrics
- SLA breach rate
- Offer acceptance rate
```

**Alert Thresholds**
- Critical: P95 latency > 1s, Error rate > 5%
- Warning: CPU > 80%, Disk > 85%
- Info: Scheduled job failures

---

## Deployment Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Internet (Public)                     │
└────────────────────┬────────────────────────────────────┘
                     │
            ┌────────▼─────────┐
            │   CloudFlare     │  ← DDoS Protection
            │   (CDN + WAF)    │
            └────────┬─────────┘
                     │
            ┌────────▼─────────┐
            │  Load Balancer   │  ← SSL Termination
            │  (AWS ALB/Nginx) │     Health Checks
            └────────┬─────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
┌───────▼────────┐       ┌───────▼────────┐
│  Frontend      │       │  Backend API   │
│  Instances     │       │  Instances     │
│  (Auto-scaled) │       │  (Auto-scaled) │
└───────┬────────┘       └───────┬────────┘
        │                         │
        └────────────┬────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
┌───────▼─────┐ ┌───▼─────┐ ┌───▼──────┐
│ PostgreSQL  │ │  Redis  │ │   S3     │
│  (Primary)  │ │ Cluster │ │ Storage  │
│     +       │ └─────────┘ └──────────┘
│  (Replica)  │
└─────────────┘

     VPC (Private Subnet)
```

This architecture ensures high availability, security, and scalability for production workloads.

