# Functional Specifications - KPN Talent Acquisition System

## Document Information
- **Version**: 1.0.0
- **Last Updated**: October 2024
- **Owner**: KPN Technology Team

---

## Table of Contents
1. [System Overview](#system-overview)
2. [User Roles & Permissions](#user-roles--permissions)
3. [Functional Requirements by Module](#functional-requirements-by-module)
4. [Business Rules](#business-rules)
5. [Workflow Specifications](#workflow-specifications)
6. [Integration Requirements](#integration-requirements)

---

## 1. System Overview

### 1.1 Purpose
The KPN Talent Acquisition System (TAS) is a comprehensive recruitment management platform designed to streamline the entire hiring process from job requisition to employee onboarding.

### 1.2 Scope
- **In Scope:**
  - FPTK (job requisition) management
  - Candidate sourcing and application management
  - Psychometric and technical testing
  - Interview scheduling and feedback collection
  - Document verification
  - Offer management with approval workflows
  - Medical check-up coordination
  - E-signature integration
  - Onboarding task management
  - Analytics and reporting
  - External candidate portal
  - Internal HR/TA dashboard

- **Out of Scope:**
  - FPTK approval workflow (handled by separate system)
  - Payroll integration
  - Performance management
  - Learning management

### 1.3 Key Objectives
1. Reduce time-to-hire by 30%
2. Improve candidate experience
3. Provide real-time visibility into recruitment pipeline
4. Enable data-driven hiring decisions
5. Ensure regulatory compliance (GDPR, local labor laws)

---

## 2. User Roles & Permissions

### 2.1 Role Definitions

| Role | Description | Primary Functions |
|------|-------------|-------------------|
| **Super Admin** | System administrator | Full system access, user management, configuration |
| **CHRO** | Chief Human Resources Officer | View-only access to all data, dashboards, analytics |
| **Department Head** | Department leader | Approve offers, view department applications |
| **HRBP** | HR Business Partner | Compliance review, offer validation, full pipeline visibility |
| **TA Team** | Talent Acquisition specialists | Manage pipeline, sourcing, screening, interviews |
| **Hiring Manager** | Requesting manager | Create FPTK, view applications, approve shortlists |
| **Interviewer** | Technical/functional interviewer | View assigned interviews, submit feedback |
| **Candidate** | Job applicant | Apply, upload documents, track application status |

### 2.2 Permission Matrix

| Feature | Super Admin | CHRO | Dept Head | HRBP | TA Team | Hiring Manager | Interviewer | Candidate |
|---------|-------------|------|-----------|------|---------|----------------|-------------|-----------|
| Create FPTK | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ |
| Publish FPTK | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| View all applications | ✅ | ✅ | 📋 Dept only | ✅ | ✅ | 📋 Own FPTK | ❌ | ❌ |
| Screen candidates | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Schedule interviews | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Submit interview feedback | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ |
| Create offer | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Approve offer (HRBP) | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Approve offer (Head) | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Verify documents | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| View dashboards | ✅ | ✅ | 📋 Dept only | ✅ | ✅ | 📋 Own FPTK | ❌ | ❌ |
| Apply for jobs | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| View own application | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

Legend: ✅ Full access | ❌ No access | 📋 Limited/filtered access

---

## 3. Functional Requirements by Module

### Module 1: FPTK Management

#### FR-FPTK-001: Create FPTK
**Actor**: Hiring Manager, TA Team  
**Precondition**: User is authenticated and authorized  
**Description**: Create a new job requisition (FPTK)

**Input Fields:**
- FPTK Number (unique, format: FPTK-YYYY-NNN)
- Position Title
- Department & Division
- Location
- Employment Type (Permanent/Contract/Intern)
- Level (Junior/Mid/Senior/Manager/Director)
- Number of Positions
- Minimum Education
- Minimum Experience (years)
- Required Skills (multi-select)
- Job Description (rich text)
- Responsibilities (rich text)
- Qualifications (rich text)
- Salary Range (min/max)
- Benefits
- Requested By
- Target Start Date

**Validation Rules:**
- FPTK Number must be unique
- Position Title required (max 200 characters)
- Number of Positions >= 1
- Salary Range: max >= min
- All required fields must be filled

**Success Criteria:**
- FPTK created with status "APPROVED"
- System generates UUID
- Audit log created

#### FR-FPTK-002: Publish FPTK
**Actor**: TA Team  
**Precondition**: FPTK status is APPROVED  
**Description**: Make job position visible on candidate portal

**Actions:**
- Set isPublished = true
- Set publishedAt = current timestamp
- Set status = OPEN
- Send notification to TA team
- Index job for search

**Success Criteria:**
- Job appears on candidate portal
- Search indexing completed
- Email notification sent

#### FR-FPTK-003: Update FPTK
**Actor**: Hiring Manager, TA Team  
**Precondition**: User has permission  
**Description**: Modify existing FPTK details

**Business Rules:**
- Cannot reduce numberOfPositions below filledPositions
- Cannot change FPTK Number
- Audit trail maintained for all changes

### Module 2: Candidate Management

#### FR-CAND-001: Candidate Registration
**Actor**: Candidate (external)  
**Precondition**: None  
**Description**: Self-service registration for candidates

**Input Fields:**
- Email (unique)
- Password (min 8 chars, must include uppercase, lowercase, number, special char)
- First Name
- Last Name
- Phone Number (optional)
- GDPR Consent (required)
- Marketing Consent (optional)

**Validation Rules:**
- Email format validation
- Email uniqueness check
- Password strength validation
- Phone number format validation (E.164)

**Success Criteria:**
- User account created with role CANDIDATE
- Candidate profile created
- Welcome email sent
- Redirect to profile completion

#### FR-CAND-002: Profile Management
**Actor**: Candidate  
**Precondition**: User is authenticated  
**Description**: Manage personal information and CV data

**Profile Sections:**
1. **Personal Information**
   - Date of Birth
   - Place of Birth
   - Gender
   - Marital Status
   - Current Address
   - National ID (encrypted)
   - Tax ID / NPWP (encrypted)
   - BPJS Numbers

2. **Professional Information**
   - Current Job Title
   - Current Company
   - Current Salary
   - Expected Salary
   - Notice Period
   - Available From
   - Skills (multi-select tags)
   - Languages

3. **Education**
   - Institution
   - Degree
   - Field of Study
   - Start/End Date
   - Grade/GPA
   - Location

4. **Work Experience**
   - Company
   - Job Title
   - Start/End Date
   - Is Current
   - Location
   - Responsibilities
   - Achievements
   - Salary (starting/ending)

5. **Certifications**
   - Name
   - Issuing Organization
   - Issue/Expiry Date
   - Credential ID
   - Credential URL

6. **References**
   - Name
   - Company
   - Position
   - Relationship
   - Email
   - Phone

**Data Security:**
- National ID encrypted at rest
- NPWP encrypted at rest
- Sensitive data masked in logs

### Module 3: Application Management (9-Stage Pipeline)

#### Stage 1: FPTK Upload & Sync
**Actor**: Candidate  
**Description**: Candidate submits application for published job

**Process:**
1. Candidate selects job from portal
2. System validates candidate profile completeness
3. Candidate confirms application submission
4. System creates Application record
5. Status = SUBMITTED, Stage = 1
6. System sends confirmation email
7. TA team receives notification

**Validation:**
- Candidate cannot apply twice for same position
- FPTK must be published and status = OPEN
- Candidate profile must be >= 70% complete

#### Stage 2: Candidate Sourcing & Screening
**Actor**: TA Team  
**Description**: Initial screening of applications

**Features:**
- AI-powered CV parsing
- Automated skill matching
- Duplicate candidate detection
- Screening checklist

**Actions:**
- TA reviews application
- AI match score displayed
- Decision: Shortlist or Reject
- If shortlisted: move to Stage 3
- If rejected: update status, send rejection email

**Business Rules:**
- Minimum match score threshold: 60%
- SLA: Screen within 3 business days

#### Stage 3: Psychometric & Technical Tests
**Actor**: TA Team (schedule), Candidate (take test)  
**Description**: Administer assessments

**Test Types:**
- Psychometric (personality, cognitive)
- Technical (coding, domain-specific)
- Language proficiency

**Process:**
1. TA schedules test
2. System sends test link to candidate
3. Candidate completes test
4. System records results
5. TA reviews results
6. Decision: Pass → Stage 4, Fail → Reject

**Integration:**
- External test providers (API integration)
- Test result storage
- Score normalization

**SLA:** Candidate has 7 days to complete test

#### Stage 4: User Interviews
**Actor**: TA Team, Interviewer, Candidate  
**Description**: Multi-round interview process

**Interview Types:**
- Phone Screen
- HR Interview
- Technical Interview
- Managerial Interview
- Panel Interview
- Final Interview

**Features:**
- Interview scheduling with calendar integration
- Automated email invitations
- Interview feedback forms
- Rating scales (1-5) for:
  - Technical Skills
  - Communication
  - Problem Solving
  - Culture Fit
  - Overall Rating
- Recommendation: Strongly Recommend, Recommend, Neutral, Not Recommend

**Process:**
1. TA schedules interview
2. System checks interviewer availability
3. Calendar invites sent
4. Reminders: 24h before, 1h before
5. Interview conducted
6. Interviewer submits feedback
7. Aggregate scores calculated
8. TA makes decision: Next round, Offer, or Reject

**Business Rules:**
- Minimum 2 interviewers required
- Average rating >= 3.5 to proceed
- All interviewers must submit feedback

**SLA:** Interview scheduled within 5 business days

#### Stage 5: Document Verification
**Actor**: HRBP, TA Team  
**Description**: Verify candidate documents

**Required Documents:**
- Resume/CV
- ID Card
- Diplomas
- Transcripts
- Certificates
- Reference Letters

**Verification Process:**
1. Candidate uploads documents
2. System virus scans files
3. HRBP/TA verifies authenticity
4. Status: Verified, Rejected, Pending
5. If rejected: request reupload
6. All documents verified → Stage 6

**Document Requirements:**
- Max file size: 10MB
- Allowed formats: PDF, JPG, PNG, DOC, DOCX
- Encryption: Files encrypted at rest

**SLA:** Verify within 2 business days

#### Stage 6: Offering & Negotiation
**Actor**: TA Team, HRBP, Department Head, Candidate  
**Description**: Multi-level offer approval workflow

**Offer Components:**
- Job Title
- Department
- Location
- Start Date
- Basic Salary
- Allowances (transport, meal, etc.)
- Bonus Structure
- Total Package
- Benefits
- Employment Type
- Contract Duration (if applicable)
- Probation Period
- Notice Period

**Approval Workflow:**
```
TA creates offer (Draft)
   ↓
HRBP reviews (compliance check)
   ↓
Department Head approves
   ↓
Offer sent to candidate
   ↓
Candidate responds: Accept / Reject / Negotiate
```

**Negotiation Handling:**
- Candidate can propose counter-offer
- TA/HRBP/Head review
- Accept counter or final offer
- Max 2 negotiation rounds

**Success:**
- Candidate accepts → Stage 7
- Candidate rejects → Application closed

**SLA:**
- HRBP review: 1 business day
- Head approval: 2 business days
- Offer valid for: 7 days

#### Stage 7: Medical Check-Up
**Actor**: TA Team, Candidate  
**Description**: Schedule and validate MCU

**Process:**
1. TA schedules MCU with provider
2. System sends MCU details to candidate
3. Candidate completes MCU
4. Provider submits report
5. HRBP validates report
6. Decision: Pass → Stage 8, Fail → Case-by-case

**MCU Components:**
- Physical examination
- Lab tests
- Vision/hearing tests
- Drug screening

**SLA:** Complete within 7 days

#### Stage 8: Signing Process
**Actor**: TA Team, Candidate  
**Description**: E-signature for offer letter and contract

**Documents to Sign:**
- Offer Letter
- Employment Contract
- Confidentiality Agreement
- Code of Conduct

**E-Signature Integration:**
- DocuSign / similar provider
- Email with signing link
- Track document status
- Store signed documents

**Process:**
1. System generates documents
2. E-sign invitation sent
3. Candidate signs electronically
4. System stores signed documents
5. All documents signed → Stage 9

**SLA:** Sign within 5 days

#### Stage 9: Onboarding
**Actor**: TA Team, HRBP, Hiring Manager, New Hire  
**Description**: Pre-joining and first-week onboarding

**Onboarding Checklist:**
- [ ] IT account creation
- [ ] Email setup
- [ ] System access provisioning
- [ ] Badge/ID card
- [ ] Desk/equipment setup
- [ ] Welcome kit preparation
- [ ] Orientation schedule
- [ ] Team introduction
- [ ] HR documentation
- [ ] Benefits enrollment
- [ ] Buddy assignment

**Process:**
1. Onboarding plan created
2. Tasks assigned with due dates
3. Automated reminders
4. Progress tracking
5. All tasks completed → Status = HIRED

**SLA:** Complete within first week

### Module 4: Interview Management

#### FR-INT-001: Schedule Interview
**Actor**: TA Team  
**Precondition**: Application in Stage 4  
**Description**: Schedule interview with candidate

**Input:**
- Application ID
- Interview Type
- Date & Time
- Duration (minutes)
- Location / Meeting Link
- Interviewer(s)
- Panel Members (for panel interviews)

**System Actions:**
- Check interviewer availability
- Send calendar invites
- Create interview record
- Update application status
- Send confirmation emails

#### FR-INT-002: Interview Feedback
**Actor**: Interviewer  
**Precondition**: Interview scheduled  
**Description**: Submit interview evaluation

**Feedback Form:**
- Technical Skills (1-5)
- Communication (1-5)
- Problem Solving (1-5)
- Culture Fit (1-5)
- Overall Rating (1-5)
- Strengths (text)
- Weaknesses (text)
- Recommendation (dropdown)
- Comments (text)

**Validation:**
- All ratings required
- Recommendation required

### Module 5: Offer Management

*(Covered in Stage 6 above)*

### Module 6: Document Management

#### FR-DOC-001: Upload Document
**Actor**: Candidate, TA Team  
**Security:**
- Virus scanning
- File type validation
- Size validation
- Encryption at rest

#### FR-DOC-002: Verify Document
**Actor**: HRBP, TA Team  
**Actions:**
- View document
- Mark as Verified/Rejected
- Add verification notes
- Request reupload if needed

### Module 7: Onboarding Management

*(Covered in Stage 9 above)*

### Module 8: Dashboard & Analytics

#### FR-DASH-001: Recruitment Funnel
**Display:**
- Visual funnel showing applications at each stage
- Conversion rates between stages
- Time spent at each stage

#### FR-DASH-002: Time-to-Hire Metrics
**Metrics:**
- Average time-to-hire (application to hired)
- Average time-to-fill (FPTK to hired)
- Time by stage
- Breakdown by department/position

#### FR-DASH-003: Source Effectiveness
**Analysis:**
- Applications by source (LinkedIn, Referral, etc.)
- Hire rate by source
- Quality score by source
- Cost per hire by source

#### FR-DASH-004: Recruiter Performance
**Metrics:**
- Applications processed
- Time to screen
- Offers made/accepted
- Positions filled

---

## 4. Business Rules

### BR-001: Application Withdrawal
- Candidate can withdraw application at any stage before HIRED
- Withdrawal is irreversible
- Reason is optional
- TA team notified

### BR-002: Application Reapplication
- Candidate can reapply for same position after 30 days
- No limit on different positions

### BR-003: SLA Breach Handling
- Stage 2 (Screening): 3 business days
- Stage 4 (Interview): 5 business days per round
- Stage 6 (Offer Approval): 3 business days
- Breached applications flagged in dashboard
- Automated escalation emails

### BR-004: Data Retention
- Application data: Retained for 2 years
- Candidate profiles: Retained while account active + 1 year
- Audit logs: Retained for 7 years
- Right to be forgotten: Candidate can request deletion

### BR-005: Duplicate Detection
- System checks email and national ID
- Flags potential duplicates for TA review
- TA can merge or mark as different

### BR-006: Offer Expiry
- Offers expire after 7 days
- Candidate can request extension (max 14 days)
- Expired offers automatically closed

### BR-007: Interview No-Show
- Candidate no-show: Application status updated
- TA can reschedule (max 1 reschedule)
- Multiple no-shows: Application rejected

---

## 5. Workflow Specifications

### Workflow 1: Standard Recruitment Flow
```
FPTK Created → Published → Application Received → Screening → Tests → 
Interviews → Document Verification → Offer → MCU → Contract Signing → 
Onboarding → Hired
```

**Happy Path Duration:** 30-45 days

### Workflow 2: Fast-Track Hiring
For critical positions:
- Skip psychometric tests
- Reduce interview rounds to 2
- Accelerated approvals
- Target: 14-21 days

### Workflow 3: Rejection Handling
At any stage:
1. TA/HRBP rejects application
2. Rejection reason selected from dropdown
3. Rejection email sent to candidate
4. Application status = REJECTED
5. Feedback stored for analytics

### Workflow 4: Offer Negotiation
```
Initial Offer Sent → Candidate Counter-Offers → TA/HRBP Review → 
Department Head Approves → Final Offer Sent → Candidate Accepts
```

**Max Iterations:** 2 rounds of negotiation

---

## 6. Integration Requirements

### INT-001: Email Service (SMTP)
- Purpose: Send automated emails
- Protocol: SMTP
- Use Cases: Notifications, invitations, confirmations

### INT-002: WhatsApp Notifications (Twilio)
- Purpose: Real-time candidate notifications
- Provider: Twilio
- Use Cases: Interview reminders, status updates

### INT-003: Calendar Integration
- Purpose: Interview scheduling
- Protocols: CalDAV, Google Calendar API, Outlook API
- Features: Create events, check availability, send invites

### INT-004: E-Signature Service
- Purpose: Digital contract signing
- Providers: DocuSign, Adobe Sign
- Features: Send documents, track status, store signed copies

### INT-005: Test Providers
- Purpose: Psychometric and technical assessments
- Providers: HackerRank, TestGorilla, etc.
- Integration: API-based test invitations and result retrieval

### INT-006: MCU Providers
- Purpose: Medical check-up scheduling
- Integration: API or manual process
- Data: Appointment details, results

### INT-007: AI/ML Service (Future)
- Purpose: CV parsing, candidate matching
- Features:
  - Resume parsing (extract structured data)
  - Job-candidate matching score
  - Time-to-fill prediction
  - Offer acceptance probability
  - Source effectiveness analysis

### INT-008: Storage (AWS S3 / MinIO)
- Purpose: File storage
- Use Cases: CVs, documents, photos
- Features: Encryption, access control, lifecycle policies

---

## 7. Non-Functional Requirements

### NFR-001: Performance
- API response time: < 200ms (p95)
- Page load time: < 2 seconds
- Support 1000+ concurrent users
- Database query time: < 50ms (p95)

### NFR-002: Security
- All data encrypted in transit (TLS 1.3)
- Sensitive data encrypted at rest (AES-256)
- RBAC enforced
- Audit logging for all sensitive operations
- Regular security audits

### NFR-003: Availability
- Uptime SLA: 99.9%
- Scheduled maintenance windows: < 4 hours/month
- Disaster recovery RTO: 1 hour
- Disaster recovery RPO: 5 minutes

### NFR-004: Scalability
- Horizontal scaling for application servers
- Database read replicas
- Caching layer (Redis)
- CDN for static assets

### NFR-005: Compliance
- GDPR compliant
- Local labor law compliant
- Data residency requirements met
- Right to be forgotten implemented

---

## Document Approval

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Product Owner | | | |
| Technical Lead | | | |
| HRBP Lead | | | |
| CHRO | | | |

---

**End of Functional Specifications Document**

