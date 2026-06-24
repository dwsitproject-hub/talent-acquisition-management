# API Documentation - KPN Talent Acquisition System

## Base URL
```
Development: http://localhost:4000/api
Production: https://api.yourdomain.com/api
```

## Authentication

All protected endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <access_token>
```

### Token Lifecycle
- **Access Token**: Expires in 15 minutes
- **Refresh Token**: Expires in 7 days (stored in httpOnly cookie)

---

## 1. Authentication Endpoints

### 1.1 Register Candidate
**POST** `/auth/register`

Register a new candidate account.

**Request Body:**
```json
{
  "email": "john.doe@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe",
  "phoneNumber": "+6281234567890"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "userId": "uuid",
    "email": "john.doe@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "candidateId": "uuid"
  }
}
```

### 1.2 Login
**POST** `/auth/login`

**Rate Limit:** 5 attempts per 15 minutes

**Request Body:**
```json
{
  "email": "john.doe@example.com",
  "password": "SecurePass123!"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "uuid",
      "email": "john.doe@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "CANDIDATE",
      "department": null
    }
  }
}
```

**Set-Cookie:** `refreshToken=<token>; HttpOnly; Secure; SameSite=Lax`

### 1.3 Refresh Token
**POST** `/auth/refresh`

Refresh access token using refresh token.

**Request:**
- Cookie: `refreshToken=<token>` (or in body)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Token refreshed",
  "data": {
    "accessToken": "new_access_token"
  }
}
```

### 1.4 Logout
**POST** `/auth/logout`

**Headers:** `Authorization: Bearer <token>`

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Logout successful"
}
```

### 1.5 Get Current User
**GET** `/auth/me`

**Headers:** `Authorization: Bearer <token>`

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "john.doe@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "CANDIDATE",
    "department": null,
    "isActive": true
  }
}
```

---

## 2. Candidate Endpoints

### 2.1 Get My Profile
**GET** `/candidates/me`

**Headers:** `Authorization: Bearer <token>`  
**Access:** Candidate only

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "user": {
      "email": "john.doe@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "phoneNumber": "+6281234567890"
    },
    "dateOfBirth": "1995-05-15",
    "currentJobTitle": "Software Engineer",
    "expectedSalary": 15000000,
    "skills": ["JavaScript", "React", "Node.js"],
    "educations": [...],
    "workExperiences": [...],
    "certifications": [...]
  }
}
```

### 2.2 Update Profile
**PUT** `/candidates/me`

**Headers:** `Authorization: Bearer <token>`  
**Access:** Candidate only

**Request Body:**
```json
{
  "dateOfBirth": "1995-05-15",
  "currentAddress": "Jakarta, Indonesia",
  "currentJobTitle": "Senior Software Engineer",
  "expectedSalary": 18000000,
  "skills": ["JavaScript", "TypeScript", "React", "Node.js"],
  "linkedinUrl": "https://linkedin.com/in/johndoe"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": { ... }
}
```

### 2.3 Add Education
**POST** `/candidates/me/education`

**Request Body:**
```json
{
  "institution": "University of Indonesia",
  "degree": "Bachelor",
  "fieldOfStudy": "Computer Science",
  "startDate": "2013-08-01",
  "endDate": "2017-07-01",
  "grade": "3.75",
  "location": "Jakarta"
}
```

### 2.4 Add Work Experience
**POST** `/candidates/me/experience`

**Request Body:**
```json
{
  "company": "Tech Company Inc.",
  "jobTitle": "Software Engineer",
  "startDate": "2017-08-01",
  "endDate": "2020-12-31",
  "isCurrent": false,
  "location": "Jakarta",
  "responsibilities": "Developed web applications...",
  "startingSalary": 8000000,
  "endingSalary": 12000000
}
```

### 2.5 Search Candidates (Internal)
**GET** `/candidates?page=1&limit=20&search=john&skills=JavaScript,React`

**Headers:** `Authorization: Bearer <token>`  
**Access:** TA_HO, HRBP, SUPER_ADMIN, CHRO

**Query Parameters:**
- `page` (integer): Page number (default: 1)
- `limit` (integer): Items per page (default: 20, max: 100)
- `search` (string): Search by name or email
- `skills` (string): Comma-separated skills
- `minScore` (number): Minimum AI match score

**Response (200 OK):**
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

---

## 3. FPTK (Job Requisition) Endpoints

### 3.1 Create FPTK
**POST** `/fptk`

**Headers:** `Authorization: Bearer <token>`  
**Access:** HIRING_MANAGER, TA_HO, SUPER_ADMIN

**Request Body:**
```json
{
  "fptkNumber": "FPTK-2024-001",
  "positionTitle": "Senior Software Engineer",
  "department": "Technology",
  "division": "Engineering",
  "location": "Jakarta",
  "employmentType": "Permanent",
  "level": "Senior",
  "numberOfPositions": 3,
  "minEducation": "Bachelor",
  "minExperience": 5,
  "requiredSkills": ["JavaScript", "React", "Node.js", "PostgreSQL"],
  "jobDescription": "We are looking for...",
  "responsibilities": "- Develop web applications\n- Mentor junior developers",
  "qualifications": "- 5+ years experience\n- Strong in JavaScript",
  "salaryRangeMin": 15000000,
  "salaryRangeMax": 25000000,
  "benefits": "Health insurance, annual bonus, etc.",
  "requestedBy": "John Manager",
  "targetStartDate": "2024-03-01"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "FPTK created successfully",
  "data": { ... }
}
```

### 3.2 Get Published Jobs (Public)
**GET** `/fptk/published?page=1&limit=20&department=Technology&location=Jakarta`

**Access:** Public (optional authentication)

**Query Parameters:**
- `page`, `limit`: Pagination
- `department`: Filter by department
- `location`: Filter by location
- `employmentType`: Permanent, Contract, Intern
- `search`: Search in title and description

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "fptkNumber": "FPTK-2024-001",
      "positionTitle": "Senior Software Engineer",
      "department": "Technology",
      "location": "Jakarta",
      "employmentType": "Permanent",
      "level": "Senior",
      "numberOfPositions": 3,
      "filledPositions": 0,
      "minEducation": "Bachelor",
      "minExperience": 5,
      "requiredSkills": ["JavaScript", "React", "Node.js"],
      "jobDescription": "...",
      "salaryRangeMin": 15000000,
      "salaryRangeMax": 25000000,
      "publishedAt": "2024-01-15T10:00:00Z"
    }
  ],
  "pagination": { ... }
}
```

### 3.3 Get All FPTKs (Internal)
**GET** `/fptk?page=1&status=OPEN&department=Technology`

**Headers:** `Authorization: Bearer <token>`  
**Access:** TA_HO, HRBP, SUPER_ADMIN, HIRING_MANAGER, CHRO, DEPARTMENT_HEAD

**Query Parameters:**
- `status`: DRAFT, APPROVED, OPEN, PARTIALLY_FILLED, FILLED, CANCELLED
- `department`: Filter by department
- `isPublished`: true/false
- `search`: Search by FPTK number or title

### 3.4 Get FPTK by ID
**GET** `/fptk/:id`

**Access:** Public if published, otherwise requires authentication

### 3.5 Update FPTK
**PUT** `/fptk/:id`

**Headers:** `Authorization: Bearer <token>`  
**Access:** HIRING_MANAGER, TA_HO, SUPER_ADMIN

### 3.6 Publish FPTK
**POST** `/fptk/:id/publish`

**Headers:** `Authorization: Bearer <token>`  
**Access:** TA_HO, SUPER_ADMIN

Makes the job position visible on the candidate portal.

### 3.7 Unpublish FPTK
**POST** `/fptk/:id/unpublish`

**Headers:** `Authorization: Bearer <token>`  
**Access:** TA_HO, SUPER_ADMIN

---

## 4. Application Endpoints

### 4.1 Create Application (Apply for Job)
**POST** `/applications`

**Headers:** `Authorization: Bearer <token>`  
**Access:** CANDIDATE

**Request Body:**
```json
{
  "fptkId": "uuid",
  "source": "LinkedIn",
  "referredBy": "Jane Smith"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Application submitted successfully",
  "data": {
    "id": "uuid",
    "applicationNumber": "APP-2024-00123",
    "candidateId": "uuid",
    "fptkId": "uuid",
    "status": "SUBMITTED",
    "currentStage": 1,
    "appliedAt": "2024-01-20T10:00:00Z"
  }
}
```

### 4.2 Get My Applications
**GET** `/applications/my?page=1&limit=20`

**Headers:** `Authorization: Bearer <token>`  
**Access:** CANDIDATE

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "applicationNumber": "APP-2024-00123",
      "status": "INTERVIEW_SCHEDULED",
      "currentStage": 4,
      "fptk": {
        "fptkNumber": "FPTK-2024-001",
        "positionTitle": "Senior Software Engineer",
        "department": "Technology",
        "location": "Jakarta"
      },
      "appliedAt": "2024-01-20T10:00:00Z",
      "_count": {
        "interviews": 2,
        "tests": 1
      }
    }
  ],
  "pagination": { ... }
}
```

### 4.3 Get All Applications (Internal)
**GET** `/applications?page=1&status=SCREENING&department=Technology`

**Headers:** `Authorization: Bearer <token>`  
**Access:** TA_HO, HRBP, SUPER_ADMIN, HIRING_MANAGER, CHRO, DEPARTMENT_HEAD

**Query Parameters:**
- `status`: Application status
- `fptkId`: Filter by job position
- `department`: Filter by department
- `currentStage`: 1-9
- `slaBreached`: true/false
- `search`: Search by candidate name/email/application number

### 4.4 Get Application by ID
**GET** `/applications/:id`

**Headers:** `Authorization: Bearer <token>`  
**Access:** Candidate (own application) or internal staff

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "applicationNumber": "APP-2024-00123",
    "status": "INTERVIEW_SCHEDULED",
    "currentStage": 4,
    "candidate": {
      "id": "uuid",
      "user": { ... },
      "educations": [...],
      "workExperiences": [...],
      "certifications": [...]
    },
    "fptk": { ... },
    "tests": [...],
    "interviews": [...],
    "documents": [...],
    "statusHistory": [...]
  }
}
```

### 4.5 Update Application Status
**PUT** `/applications/:id/status`

**Headers:** `Authorization: Bearer <token>`  
**Access:** TA_HO, HRBP, SUPER_ADMIN

**Request Body:**
```json
{
  "status": "SCREENING",
  "reason": "Moving to screening stage"
}
```

### 4.6 Shortlist Application
**POST** `/applications/:id/shortlist`

**Headers:** `Authorization: Bearer <token>`  
**Access:** TA_HO, SUPER_ADMIN

Moves application to the next stage automatically.

### 4.7 Reject Application
**POST** `/applications/:id/reject`

**Headers:** `Authorization: Bearer <token>`  
**Access:** TA_HO, HRBP, SUPER_ADMIN

**Request Body:**
```json
{
  "reason": "Not meeting minimum qualifications"
}
```

### 4.8 Withdraw Application
**POST** `/applications/:id/withdraw`

**Headers:** `Authorization: Bearer <token>`  
**Access:** CANDIDATE

Candidate withdraws their own application.

### 4.9 Get Application Statistics
**GET** `/applications/stats/overview?fptkId=uuid&department=Technology&dateFrom=2024-01-01&dateTo=2024-01-31`

**Headers:** `Authorization: Bearer <token>`  
**Access:** TA_HO, HRBP, SUPER_ADMIN, CHRO

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "total": 150,
    "byStatus": [
      { "status": "SUBMITTED", "_count": 30 },
      { "status": "SCREENING", "_count": 25 },
      { "status": "INTERVIEW_SCHEDULED", "_count": 20 }
    ],
    "byStage": [
      { "currentStage": 1, "_count": 30 },
      { "currentStage": 2, "_count": 25 }
    ],
    "slaBreached": 5
  }
}
```

---

## 5. Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Valid email is required",
      "value": "invalid-email"
    }
  ]
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "message": "Invalid or expired token"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "message": "Insufficient permissions"
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Resource not found"
}
```

### 409 Conflict
```json
{
  "success": false,
  "message": "Email already exists"
}
```

### 429 Too Many Requests
```json
{
  "success": false,
  "message": "Too many requests, please try again later"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Internal server error"
}
```

---

## 6. Rate Limits

| Endpoint Type | Rate Limit |
|--------------|------------|
| General API | 100 requests per 15 minutes |
| Login | 5 attempts per 15 minutes |
| Registration | 5 registrations per hour per IP |
| File Upload | 10 uploads per hour |
| Password Reset | 3 attempts per hour |
| AI Endpoints | 10 requests per hour |

---

## 7. Pagination

All list endpoints support pagination with the following query parameters:

- `page` (integer, default: 1): Page number
- `limit` (integer, default: 20, max: 100): Items per page

Response includes pagination metadata:
```json
{
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

---

## 8. File Upload

File uploads are accepted on specific endpoints with the following constraints:

- **Max file size**: 10MB
- **Allowed types**: pdf, doc, docx, jpg, jpeg, png, xls, xlsx
- **Multipart form data**: Use `multipart/form-data` content type

Example using cURL:
```bash
curl -X POST http://localhost:3000/api/documents/upload \
  -H "Authorization: Bearer <token>" \
  -F "file=@resume.pdf" \
  -F "documentType=RESUME"
```

---

## 9. Webhook Events (Future)

The system can send webhook notifications for the following events:

- Application status changes
- Interview scheduled/completed
- Offer sent/accepted
- Onboarding started/completed

Webhook payload format:
```json
{
  "event": "application.status_changed",
  "timestamp": "2024-01-20T10:00:00Z",
  "data": {
    "applicationId": "uuid",
    "oldStatus": "SCREENING",
    "newStatus": "INTERVIEW_SCHEDULED"
  }
}
```

---

## Contact & Support

For API support:
- Email: api-support@kpn.com
- Documentation: https://docs.tas.kpn.com
- Status Page: https://status.tas.kpn.com

