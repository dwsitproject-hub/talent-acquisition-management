# Requirements Document - KPN Talent Acquisition System

## Document Information
- **Version**: 2.0.0
- **Last Updated**: November 2025
- **Status**: Production Ready
- **Owner**: KPN Technology Team

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [System Overview](#system-overview)
3. [Functional Requirements](#functional-requirements)
4. [Non-Functional Requirements](#non-functional-requirements)
5. [Technical Requirements](#technical-requirements)
6. [Security Requirements](#security-requirements)
7. [Integration Requirements](#integration-requirements)
8. [Deployment Requirements](#deployment-requirements)

---

## 1. Executive Summary

The KPN Talent Acquisition System (TAS) is a comprehensive, production-ready recruitment management platform designed to streamline the entire hiring process from job requisition (FPTK) to employee onboarding. The system supports multiple user roles with role-based access control, real-time dashboard analytics, and a complete candidate management pipeline.

### Key Achievements
- ✅ Full-stack application with React/Next.js frontend and Node.js/Express backend
- ✅ PostgreSQL database with Prisma ORM
- ✅ Role-based access control (8 distinct roles)
- ✅ Menu access management with database-backed configuration
- ✅ Comprehensive dashboard with real-time metrics
- ✅ FPTK (Position) management with Excel import/export
- ✅ Candidate management with document upload
- ✅ Interview scheduling and management
- ✅ Application tracking with status milestones
- ✅ Master data management (Divisions, Office Locations)
- ✅ Team management with role assignment
- ✅ Security hardening (JWT, rate limiting, encryption)
- ✅ Production-ready Docker deployment

---

## 2. System Overview

### 2.1 Purpose
The system automates and manages the complete talent acquisition lifecycle, providing visibility, control, and efficiency for HR teams, hiring managers, and candidates.

### 2.2 Scope

#### In Scope
- **FPTK Management**: Create, edit, publish, and track job requisitions
- **Candidate Management**: Registration, profile management, document upload
- **Application Pipeline**: Track applications through multiple stages
- **Interview Management**: Schedule, conduct, and record interview feedback
- **Dashboard & Analytics**: Real-time metrics, SLA tracking, position status
- **Master Data**: Division and office location management
- **Team Management**: User management with role-based permissions
- **Menu Access Control**: Database-backed menu visibility and permissions
- **Reports**: Position raw data export with filtering
- **Role-Based Views**: Filtered data access based on user roles

#### Out of Scope
- FPTK approval workflow (handled by external system)
- Payroll integration
- Performance management
- Learning management system
- Email/SMS notifications (infrastructure ready, not implemented)

### 2.3 User Roles

| Role | Description | Key Permissions |
|------|-------------|-----------------|
| **SUPER_ADMIN** | System administrator | Full system access, user management, menu configuration |
| **Management (CHRO)** | Chief Human Resources Officer | View-only access to all data, dashboards, analytics |
| **Head of Division (DEPARTMENT_HEAD)** | Department leader | View positions/candidates for own division, approve offers |
| **HRBP** | HR Business Partner | View positions/candidates by PT/Area/Area Detail, compliance review |
| **TA_HO** | Talent Acquisition specialists | Full pipeline management, sourcing, screening, interviews |
| **HIRING_MANAGER** | Requesting manager | Create FPTK, view own positions/applications |
| **INTERVIEWER** | Technical/functional interviewer | View assigned interviews, submit feedback |
| **CANDIDATE** | Job applicant | Apply for jobs, upload documents, track application |

---

## 3. Functional Requirements

### 3.1 Authentication & Authorization

#### FR-AUTH-001: User Authentication
- **Description**: Users must authenticate using email and password
- **Requirements**:
  - JWT-based authentication with 15-minute access tokens
  - Refresh tokens with 7-day expiration
  - Password hashing using bcrypt (12 rounds)
  - Account lockout after 5 failed attempts
  - Rate limiting: 20 login attempts per 15 minutes
- **Status**: ✅ Implemented

#### FR-AUTH-002: Role-Based Access Control
- **Description**: System enforces role-based permissions at API and UI levels
- **Requirements**:
  - 8 distinct user roles with specific permissions
  - Menu visibility controlled by role
  - Create/Edit permissions per menu item
  - Database-backed menu access configuration
  - Role-based data filtering (Hiring Manager, Head of Division, HRBP)
- **Status**: ✅ Implemented

### 3.2 Dashboard

#### FR-DASH-001: Dashboard Statistics
- **Description**: Display real-time recruitment metrics
- **Requirements**:
  - Total candidates, positions, applications
  - Active positions and published positions
  - Interviews this week (from Applied Candidates -> Interview Details)
  - Hired this month (Position.Current Status = "Signing")
  - Pending offers (Position.Current Status = "Offering Process")
  - SLA by Location (from FPTK Receive Date)
  - Priority filter (P0, P1, P2)
  - Clickable metrics showing detailed data
- **Status**: ✅ Implemented

#### FR-DASH-002: Role-Based Dashboard Filtering
- **Description**: Dashboard data filtered based on user role
- **Requirements**:
  - Hiring Manager: Only own positions
  - Head of Division: Only division-related data
  - HRBP: Only PT/Area/Area Detail matching data
- **Status**: ✅ Implemented

### 3.3 FPTK (Position) Management

#### FR-FPTK-001: Create FPTK
- **Description**: Create new job requisition
- **Requirements**:
  - All required fields validated
  - Priority selection (P0, P1, P2)
  - Priority by Month-Year picker
  - Hiring Manager dropdown (filtered by HIRING_MANAGER role)
  - Excel template download
  - Excel bulk upload with validation
- **Status**: ✅ Implemented

#### FR-FPTK-002: Edit FPTK
- **Description**: Update existing position
- **Requirements**:
  - Update all fields including PT, Area, Area Detail
  - Status milestone timeline
  - Applied candidates management
  - Interview details with expand/collapse
  - Rejected/Withdrawn date capture
- **Status**: ✅ Implemented

#### FR-FPTK-003: View FPTK
- **Description**: View position details
- **Requirements**:
  - Complete position information
  - Applied candidates list
  - Interview details (expandable)
  - Candidate name clickable to view full details
  - CV download capability
- **Status**: ✅ Implemented

#### FR-FPTK-004: Excel Import/Export
- **Description**: Bulk operations via Excel
- **Requirements**:
  - Download Excel template
  - Upload multiple FPTKs
  - Validation and error reporting
  - Download failed rows CSV
- **Status**: ✅ Implemented

### 3.4 Candidate Management

#### FR-CAND-001: Candidate Registration
- **Description**: Candidates can register accounts
- **Requirements**:
  - Email, password, name, phone validation
  - Email verification (infrastructure ready)
  - Profile completion
- **Status**: ✅ Implemented

#### FR-CAND-002: Candidate Profile Management
- **Description**: Manage candidate information
- **Requirements**:
  - Personal information
  - Professional information
  - Education history
  - Work experience
  - Skills and languages
  - Document upload (CV, certificates)
- **Status**: ✅ Implemented

#### FR-CAND-003: Role-Based Candidate View
- **Description**: Filtered candidate access by role
- **Requirements**:
  - Hiring Manager: Only candidates for own positions
  - Head of Division: Candidates matching division
  - HRBP: Candidates matching PT/Area/Area Detail
- **Status**: ✅ Implemented

### 3.5 Application Management

#### FR-APP-001: Application Tracking
- **Description**: Track applications through pipeline
- **Requirements**:
  - Status milestones with dates
  - Interview scheduling
  - Document verification
  - Offer management
  - Rejected/Withdrawn date capture
- **Status**: ✅ Implemented

#### FR-APP-002: Application Status Workflow
- **Description**: Manage application progression
- **Requirements**:
  - Multiple status stages
  - Status transition validation
  - Automatic date capture (rejected, withdrawn)
- **Status**: ✅ Implemented

### 3.6 Interview Management

#### FR-INT-001: Interview Scheduling
- **Description**: Schedule and manage interviews
- **Requirements**:
  - Interview date/time
  - Interviewer assignment (dropdown or manual name)
  - Interview type
  - Interview details per candidate
  - Expand/collapse UI for interview details
- **Status**: ✅ Implemented

#### FR-INT-002: Interview Details Display
- **Description**: View interview information
- **Requirements**:
  - Interviewer name (from user or stored name)
  - Interview date
  - Interview type
  - Status
  - Expandable sections in modals
- **Status**: ✅ Implemented

### 3.7 Master Data Management

#### FR-MASTER-001: Division Management
- **Description**: Manage organizational divisions
- **Requirements**:
  - Create, read, update, delete divisions
  - Head of Division dropdown (filtered by role)
  - Division code and name
- **Status**: ✅ Implemented

#### FR-MASTER-002: Office Location Management
- **Description**: Manage office locations
- **Requirements**:
  - Create, read, update, delete locations
  - PT (Province/Territory)
  - Area
  - Area Detail
  - Cascading dropdowns for HRBP role
- **Status**: ✅ Implemented

### 3.8 Team Management

#### FR-TEAM-001: User Management
- **Description**: Manage system users
- **Requirements**:
  - Create, update, activate/deactivate users
  - Role assignment (8 roles)
  - Division assignment
  - PT, Area, Area Detail (mandatory for HRBP)
  - Password reset
  - Role-based filtering
- **Status**: ✅ Implemented

#### FR-TEAM-002: Menu Access Management
- **Description**: Configure menu visibility and permissions
- **Requirements**:
  - Database-backed configuration
  - Visible roles per menu
  - Create roles per menu
  - Edit roles per menu
  - Real-time application
- **Status**: ✅ Implemented

### 3.9 Reports

#### FR-REPORT-001: Position Raw Data Report
- **Description**: Export position data with filters
- **Requirements**:
  - Filter by Priority (P0, P1, P2)
  - Filter by Request Date range
  - Filter by Position Current Status
  - CSV download
  - Pagination support for large datasets
- **Status**: ✅ Implemented

### 3.10 Summary by Position

#### FR-SUMMARY-001: Position Summary View
- **Description**: Aggregate view of positions
- **Requirements**:
  - SLA calculation from FPTK Receive Date
  - Status breakdown
  - Application counts
  - Removed "Offer Declined" column
- **Status**: ✅ Implemented

---

## 4. Non-Functional Requirements

### 4.1 Performance

#### NFR-PERF-001: Response Time
- **Requirement**: API endpoints respond within 2 seconds for 95% of requests
- **Status**: ✅ Implemented (with caching)

#### NFR-PERF-002: Concurrent Users
- **Requirement**: Support 100+ concurrent users
- **Status**: ✅ Implemented (Docker scaling ready)

#### NFR-PERF-003: Database Performance
- **Requirement**: Optimized queries with proper indexing
- **Status**: ✅ Implemented (Prisma ORM with indexes)

### 4.2 Scalability

#### NFR-SCALE-001: Horizontal Scaling
- **Requirement**: Support Docker container replication
- **Status**: ✅ Implemented (docker-compose.prod.yml with replicas)

#### NFR-SCALE-002: Database Scaling
- **Requirement**: Support read replicas
- **Status**: ⚠️ Infrastructure ready, not configured

### 4.3 Availability

#### NFR-AVAIL-001: Uptime
- **Requirement**: 99.5% uptime target
- **Status**: ✅ Implemented (health checks, restart policies)

#### NFR-AVAIL-002: Error Handling
- **Requirement**: Graceful error handling with user-friendly messages
- **Status**: ✅ Implemented (error boundaries, try-catch)

### 4.4 Usability

#### NFR-USAB-001: User Interface
- **Requirement**: Modern, responsive, intuitive UI
- **Status**: ✅ Implemented (Next.js, Tailwind CSS)

#### NFR-USAB-002: Browser Support
- **Requirement**: Support modern browsers (Chrome, Firefox, Safari, Edge)
- **Status**: ✅ Implemented

---

## 5. Technical Requirements

### 5.1 Frontend Technology Stack

- **Framework**: Next.js 16.0.0 (React 18)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: React Context API, useState, useEffect
- **HTTP Client**: Axios
- **Build Tool**: Next.js built-in (Turbopack)
- **Deployment**: Docker container

### 5.2 Backend Technology Stack

- **Framework**: Node.js 22, Express.js
- **Language**: JavaScript (ES6+)
- **Database**: PostgreSQL 15
- **ORM**: Prisma 5.22.0
- **Cache**: Redis 7
- **Authentication**: JWT (jsonwebtoken)
- **Security**: Helmet.js, bcryptjs, express-validator
- **File Upload**: express-fileupload
- **Logging**: Winston
- **Deployment**: Docker container

### 5.3 Infrastructure

- **Containerization**: Docker, Docker Compose
- **Reverse Proxy**: Nginx (optional)
- **Database**: PostgreSQL 15-alpine
- **Cache**: Redis 7-alpine
- **Deployment Target**: AWS (EC2, ECS, or similar)

### 5.4 Database Schema

- **Users**: Authentication, roles, permissions
- **FPTK**: Job requisitions
- **Candidates**: Candidate profiles
- **Applications**: Application tracking
- **Interviews**: Interview scheduling and feedback
- **Offers**: Offer management
- **Documents**: File storage metadata
- **MasterDivision**: Division master data
- **MasterOfficeLocation**: Office location master data
- **MenuAccess**: Menu visibility and permissions configuration

---

## 6. Security Requirements

### 6.1 Authentication Security

- ✅ JWT tokens with short expiration (15 minutes)
- ✅ Refresh token rotation
- ✅ Password hashing (bcrypt, 12 rounds)
- ✅ Account lockout (5 failed attempts)
- ✅ Rate limiting (20 login attempts per 15 minutes)

### 6.2 Authorization Security

- ✅ Role-based access control (RBAC)
- ✅ API-level authorization middleware
- ✅ UI-level menu visibility control
- ✅ Data filtering by role

### 6.3 Data Security

- ✅ AES-256 encryption for sensitive data (nationalId)
- ✅ HTTPS enforcement (HSTS headers)
- ✅ SQL injection prevention (Prisma ORM)
- ✅ XSS prevention (input sanitization)
- ✅ CORS configuration
- ✅ Security headers (Helmet.js)

### 6.4 Infrastructure Security

- ✅ Non-root Docker containers
- ✅ Environment variable management
- ✅ Database password protection
- ✅ Redis password authentication
- ✅ File upload validation

---

## 7. Integration Requirements

### 7.1 Current Integrations

- ✅ Database integration (PostgreSQL)
- ✅ Cache integration (Redis)
- ✅ File storage (local filesystem, S3-ready)

### 7.2 Future Integrations (Infrastructure Ready)

- ⚠️ Email service (SMTP configured, not implemented)
- ⚠️ SMS/WhatsApp (Twilio configured, not implemented)
- ⚠️ E-signature service (infrastructure ready)
- ⚠️ AWS S3 for file storage (configuration ready)

---

## 8. Deployment Requirements

### 8.1 Production Environment

- **Database**: PostgreSQL with credentials (your_db_user/your_secure_db_password)
- **Application**: Docker containers
- **Network**: Private network with load balancer
- **SSL/TLS**: HTTPS with valid certificates
- **Monitoring**: Health checks, logging

### 8.2 Deployment Steps

1. Set up AWS infrastructure (EC2/ECS)
2. Configure environment variables
3. Deploy database with production credentials
4. Run database migrations
5. Create initial admin user
6. Deploy application containers
7. Configure Nginx reverse proxy (optional)
8. Set up SSL certificates
9. Configure monitoring and logging

### 8.3 Environment Variables

See `backend/env.template` for complete list. Key variables:
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `JWT_SECRET`: 64+ character secret
- `JWT_REFRESH_SECRET`: 64+ character secret
- `ENCRYPTION_KEY`: Exactly 32 characters
- `CORS_ORIGIN`: Allowed frontend origins

---

## 9. Testing Requirements

### 9.1 Test Coverage

- ✅ Unit tests (backend services)
- ✅ Integration tests (API endpoints)
- ✅ Functional tests (user workflows)
- ✅ Security tests (penetration testing)
- ✅ Performance tests (load testing)

### 9.2 Test Scenarios

See `TEST_PLAN.md` and `COMPREHENSIVE_TEST_RESULTS.md` for detailed test scenarios.

---

## 10. Documentation Requirements

### 10.1 Technical Documentation

- ✅ API Documentation (`docs/API_DOCUMENTATION.md`)
- ✅ Architecture Documentation (`docs/ARCHITECTURE.md`)
- ✅ Functional Specifications (`docs/FUNCTIONAL_SPECS.md`)
- ✅ Deployment Guide (`docs/DEPLOYMENT.md`)

### 10.2 User Documentation

- ⚠️ User manual (to be created)
- ⚠️ Admin guide (to be created)

---

## 11. Maintenance & Support

### 11.1 Backup Requirements

- Database backups (daily)
- File upload backups (daily)
- Configuration backups (version controlled)

### 11.2 Update Process

- Database migrations via Prisma
- Container updates via Docker
- Zero-downtime deployment strategy

---

## 12. Compliance

### 12.1 Data Privacy

- ✅ GDPR-ready infrastructure
- ⚠️ Privacy policy (to be added)
- ⚠️ Data export functionality (infrastructure ready)
- ⚠️ Data deletion functionality (infrastructure ready)

### 12.2 Audit Logging

- ✅ User action logging (infrastructure ready)
- ⚠️ Comprehensive audit trail (to be enhanced)

---

## 13. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | October 2024 | Initial requirements |
| 2.0.0 | November 2025 | Production-ready update with all features |

---

**Document Status**: ✅ Production Ready
**Last Reviewed**: November 2025
**Next Review**: After production deployment

