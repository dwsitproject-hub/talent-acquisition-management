# Comprehensive Test Scenario - KPN Talent Acquisition System

## Document Information
- **Version**: 2.0.0
- **Last Updated**: November 2025
- **Status**: Production Ready Testing
- **Test Coverage**: All modules and features

---

## Table of Contents
1. [Test Environment](#test-environment)
2. [Authentication & Authorization Tests](#authentication--authorization-tests)
3. [Dashboard Tests](#dashboard-tests)
4. [FPTK Management Tests](#fptk-management-tests)
5. [Candidate Management Tests](#candidate-management-tests)
6. [Application Management Tests](#application-management-tests)
7. [Interview Management Tests](#interview-management-tests)
8. [Master Data Management Tests](#master-data-management-tests)
9. [Team Management Tests](#team-management-tests)
10. [Reports Tests](#reports-tests)
11. [Summary by Position Tests](#summary-by-position-tests)
12. [Menu Access Management Tests](#menu-access-management-tests)
13. [Role-Based View Filtering Tests](#role-based-view-filtering-tests)
14. [Security Tests](#security-tests)
15. [Performance Tests](#performance-tests)
16. [Integration Tests](#integration-tests)

---

## Test Environment

### Prerequisites
- Production database with credentials: `your_db_user/your_secure_db_password`
- Production user: `admin@example.com` / `your-secure-admin-password`
- All services running (backend, frontend, database, Redis)
- Test data populated

### Test Users
1. **SUPER_ADMIN**: admin@example.com
2. **HIRING_MANAGER**: (create test user)
3. **Head of Division**: (create test user)
4. **HRBP**: (create test user with PT/Area/Area Detail)
5. **TA_HO**: (create test user)
6. **CANDIDATE**: (create test candidate)

---

## 1. Authentication & Authorization Tests

### Test AUTH-001: User Login
**Objective**: Verify user can login successfully
**Steps**:
1. Navigate to login page
2. Enter email: `admin@example.com`
3. Enter password: `your-secure-admin-password`
4. Click "Login"
**Expected**: User logged in, redirected to dashboard, JWT token stored
**Status**: ⬜ Not Tested

### Test AUTH-002: Invalid Credentials
**Objective**: Verify login fails with invalid credentials
**Steps**:
1. Enter invalid email
2. Enter invalid password
3. Click "Login"
**Expected**: Error message displayed, user not logged in
**Status**: ⬜ Not Tested

### Test AUTH-003: Account Lockout
**Objective**: Verify account locks after 5 failed attempts
**Steps**:
1. Attempt login 5 times with wrong password
2. Attempt login again
**Expected**: Account locked message, login disabled temporarily
**Status**: ⬜ Not Tested

### Test AUTH-004: Token Refresh
**Objective**: Verify access token refresh works
**Steps**:
1. Login successfully
2. Wait for token to expire (or simulate)
3. Make API request
**Expected**: Token automatically refreshed, request succeeds
**Status**: ⬜ Not Tested

### Test AUTH-005: Logout
**Objective**: Verify logout clears session
**Steps**:
1. Login successfully
2. Navigate to different pages
3. Click logout
**Expected**: User logged out, redirected to login, tokens cleared
**Status**: ⬜ Not Tested

---

## 2. Dashboard Tests

### Test DASH-001: Dashboard Load
**Objective**: Verify dashboard loads with all metrics
**Steps**:
1. Login as SUPER_ADMIN
2. Navigate to dashboard
**Expected**: All statistics displayed (candidates, positions, applications, interviews, hired, pending offers, SLA)
**Status**: ⬜ Not Tested

### Test DASH-002: Priority Filter
**Objective**: Verify priority filter works
**Steps**:
1. Select "P0" filter
2. Verify dashboard data updates
3. Select "P1" filter
4. Select "ALL" filter
**Expected**: Dashboard data filtered by priority correctly
**Status**: ⬜ Not Tested

### Test DASH-003: Interviews This Week
**Objective**: Verify "Interviews This Week" count and details
**Steps**:
1. Check "Interviews This Week" number
2. Click on the number
3. Verify detail modal shows correct interviews
**Expected**: Count matches actual interviews this week, detail modal shows correct data
**Status**: ⬜ Not Tested

### Test DASH-004: Hired This Month
**Objective**: Verify "Hired This Month" count and details
**Steps**:
1. Check "Hired This Month" number (from Position.Current Status = "Signing")
2. Click on the number
3. Verify detail modal shows correct positions
**Expected**: Count matches positions with status "Signing", detail modal shows correct data
**Status**: ⬜ Not Tested

### Test DASH-005: Pending Offers
**Objective**: Verify "Pending Offers" count and details
**Steps**:
1. Check "Pending Offers" number (from Position.Current Status = "Offering Process")
2. Click on the number
3. Verify detail modal shows correct positions
**Expected**: Count matches positions with status "Offering Process", detail modal shows correct data
**Status**: ⬜ Not Tested

### Test DASH-006: SLA by Location
**Objective**: Verify SLA calculation from FPTK Receive Date
**Steps**:
1. Check "SLA by Location" chart
2. Verify SLA calculated from FPTK Receive Date (not Request Date)
3. Click on a location
4. Verify detail modal shows correct positions
**Expected**: SLA calculated correctly, detail modal shows positions with FPTK Receive Date
**Status**: ⬜ Not Tested

### Test DASH-007: Role-Based Dashboard Filtering
**Objective**: Verify dashboard data filtered by role
**Steps**:
1. Login as HIRING_MANAGER
2. Verify dashboard shows only own positions
3. Login as Head of Division
4. Verify dashboard shows only division data
5. Login as HRBP
6. Verify dashboard shows only PT/Area/Area Detail data
**Expected**: Dashboard data correctly filtered by role
**Status**: ⬜ Not Tested

---

## 3. FPTK Management Tests

### Test FPTK-001: Create FPTK
**Objective**: Verify FPTK creation works
**Steps**:
1. Navigate to FPTK page
2. Click "Create Position"
3. Fill all required fields
4. Select Priority (P0, P1, or P2)
5. Select Priority by Month-Year
6. Select Hiring Manager from dropdown
7. Submit
**Expected**: FPTK created successfully, appears in list
**Status**: ⬜ Not Tested

### Test FPTK-002: Edit FPTK
**Objective**: Verify FPTK editing works
**Steps**:
1. Open existing FPTK
2. Click "Edit"
3. Update fields (PT, Area, Area Detail, Status, etc.)
4. Update Applied Candidates with Rejected/Withdrawn dates
5. Save
**Expected**: FPTK updated successfully, changes reflected
**Status**: ⬜ Not Tested

### Test FPTK-003: View FPTK
**Objective**: Verify FPTK view shows all details
**Steps**:
1. Open FPTK
2. Click "View"
3. Verify all fields displayed
4. Verify Applied Candidates list
5. Verify Interview Details (expandable)
6. Click candidate name
**Expected**: All details visible, interview details expandable, candidate modal opens
**Status**: ⬜ Not Tested

### Test FPTK-004: Interview Details Expand/Collapse
**Objective**: Verify interview details can be expanded/collapsed
**Steps**:
1. Open FPTK view
2. Find candidate with interviews
3. Click expand button
4. Verify interview details shown
5. Click collapse button
6. Verify interview details hidden
**Expected**: Interview details expand and collapse correctly
**Status**: ⬜ Not Tested

### Test FPTK-005: Rejected/Withdrawn Date Capture
**Objective**: Verify dates captured when status changes
**Steps**:
1. Edit FPTK
2. Change candidate status to "Rejected"
3. Verify "Rejected Date" field appears and is set
4. Change candidate status to "Withdrawn"
5. Verify "Withdrawn Date" field appears and is set
6. Save and view
**Expected**: Dates captured correctly, displayed in view
**Status**: ⬜ Not Tested

### Test FPTK-006: Excel Template Download
**Objective**: Verify Excel template can be downloaded
**Steps**:
1. Click "Download Template"
2. Verify file downloads
3. Open file
4. Verify template structure
**Expected**: Template downloads, has correct structure
**Status**: ⬜ Not Tested

### Test FPTK-007: Excel Upload
**Objective**: Verify Excel upload works
**Steps**:
1. Prepare Excel file with FPTK data
2. Click "Upload Excel"
3. Select file
4. Upload
5. Verify success/failed rows displayed
6. Download failed rows CSV if any
**Expected**: Valid rows imported, failed rows reported
**Status**: ⬜ Not Tested

### Test FPTK-008: Candidate Detail Modal
**Objective**: Verify candidate detail modal from position view
**Steps**:
1. Open FPTK view
2. Click on candidate name in Applied Candidates
3. Verify modal opens with full candidate details
4. Verify CV download available
5. Close modal
**Expected**: Modal opens, shows all details, CV downloadable, closes correctly
**Status**: ⬜ Not Tested

### Test FPTK-009: Role-Based FPTK Filtering
**Objective**: Verify FPTK list filtered by role
**Steps**:
1. Login as HIRING_MANAGER
2. Verify only own positions shown
3. Login as Head of Division
4. Verify only division positions shown
5. Login as HRBP
6. Verify only PT/Area/Area Detail positions shown
**Expected**: FPTK list correctly filtered by role
**Status**: ⬜ Not Tested

---

## 4. Candidate Management Tests

### Test CAND-001: Create Candidate
**Objective**: Verify candidate creation works
**Steps**:
1. Navigate to Candidates page
2. Click "Add Candidate"
3. Fill all required fields
4. Upload CV
5. Submit
**Expected**: Candidate created successfully, appears in list
**Status**: ⬜ Not Tested

### Test CAND-002: Edit Candidate
**Objective**: Verify candidate editing works
**Steps**:
1. Open existing candidate
2. Click "Edit"
3. Update fields
4. Save
**Expected**: Candidate updated successfully
**Status**: ⬜ Not Tested

### Test CAND-003: View Candidate
**Objective**: Verify candidate view shows all details
**Steps**:
1. Open candidate
2. Verify all information displayed
3. Verify CV downloadable
4. Verify documents list
**Expected**: All details visible, CV downloadable
**Status**: ⬜ Not Tested

### Test CAND-004: Search Candidates
**Objective**: Verify candidate search works
**Steps**:
1. Enter search term
2. Verify results filtered
3. Clear search
4. Verify all candidates shown
**Expected**: Search filters correctly
**Status**: ⬜ Not Tested

### Test CAND-005: Role-Based Candidate Filtering
**Objective**: Verify candidate list filtered by role
**Steps**:
1. Login as HIRING_MANAGER
2. Verify only candidates for own positions shown
3. Login as Head of Division
4. Verify only division candidates shown
5. Login as HRBP
6. Verify only PT/Area/Area Detail candidates shown
**Expected**: Candidate list correctly filtered by role
**Status**: ⬜ Not Tested

---

## 5. Application Management Tests

### Test APP-001: Application Status Update
**Objective**: Verify application status can be updated
**Steps**:
1. Open application
2. Update status
3. Verify status changed
4. Verify dates captured (rejected/withdrawn)
**Expected**: Status updated, dates captured correctly
**Status**: ⬜ Not Tested

### Test APP-002: Rejected Date Capture
**Objective**: Verify rejected date captured
**Steps**:
1. Change application status to "Rejected"
2. Verify rejectedAt date set
3. View application
4. Verify rejected date displayed
**Expected**: Rejected date captured and displayed
**Status**: ⬜ Not Tested

### Test APP-003: Withdrawn Date Capture
**Objective**: Verify withdrawn date captured
**Steps**:
1. Change application status to "Withdrawn"
2. Verify withdrawnAt date set
3. View application
4. Verify withdrawn date displayed
**Expected**: Withdrawn date captured and displayed
**Status**: ⬜ Not Tested

---

## 6. Interview Management Tests

### Test INT-001: Interview Details Display
**Objective**: Verify interview details displayed correctly
**Steps**:
1. Open FPTK with interviews
2. View Applied Candidates
3. Expand interview details
4. Verify interviewer name shown (from user or stored name)
5. Verify interview date shown
6. Verify interview type shown
**Expected**: All interview details displayed correctly
**Status**: ⬜ Not Tested

### Test INT-002: Interviewer Name Fallback
**Objective**: Verify interviewer name uses fallback
**Steps**:
1. Create interview with interviewer not in system
2. Enter interviewer name manually
3. Save
4. View interview
5. Verify name displayed
**Expected**: Manual interviewer name displayed correctly
**Status**: ⬜ Not Tested

---

## 7. Master Data Management Tests

### Test MASTER-001: Create Division
**Objective**: Verify division creation works
**Steps**:
1. Navigate to Master Division
2. Click "Add Division"
3. Fill fields (including Head of Division dropdown)
4. Submit
**Expected**: Division created successfully
**Status**: ⬜ Not Tested

### Test MASTER-002: Edit Division
**Objective**: Verify division editing works
**Steps**:
1. Open division
2. Click "Edit"
3. Update fields
4. Save
**Expected**: Division updated successfully
**Status**: ⬜ Not Tested

### Test MASTER-003: Create Office Location
**Objective**: Verify office location creation works
**Steps**:
1. Navigate to Master Office Location
2. Click "Add Location"
3. Fill PT, Area, Area Detail
4. Submit
**Expected**: Location created successfully
**Status**: ⬜ Not Tested

### Test MASTER-004: Edit Office Location
**Objective**: Verify office location editing works
**Steps**:
1. Open location
2. Click "Edit"
3. Update fields
4. Save
**Expected**: Location updated successfully
**Status**: ⬜ Not Tested

---

## 8. Team Management Tests

### Test TEAM-001: Create Team Member
**Objective**: Verify team member creation works
**Steps**:
1. Navigate to Team page
2. Click "Add Member"
3. Fill all fields
4. Select Role
5. If HRBP, fill PT, Area, Area Detail (mandatory)
6. Submit
**Expected**: Team member created successfully
**Status**: ⬜ Not Tested

### Test TEAM-002: HRBP Mandatory Fields
**Objective**: Verify PT/Area/Area Detail mandatory for HRBP
**Steps**:
1. Create team member
2. Select Role = "HRBP"
3. Try to submit without PT/Area/Area Detail
4. Verify validation error
5. Fill PT/Area/Area Detail
6. Submit
**Expected**: Validation prevents submission, works after filling fields
**Status**: ⬜ Not Tested

### Test TEAM-003: Cascading Dropdowns
**Objective**: Verify PT/Area/Area Detail cascading works
**Steps**:
1. Create team member with HRBP role
2. Select PT
3. Verify Area dropdown filtered by PT
4. Select Area
5. Verify Area Detail dropdown filtered by Area
**Expected**: Cascading dropdowns work correctly
**Status**: ⬜ Not Tested

### Test TEAM-004: Menu Access Management
**Objective**: Verify menu access can be configured
**Steps**:
1. Navigate to Team page
2. Scroll to Menu Access Management
3. Update visible roles for a menu
4. Update create roles for a menu
5. Update edit roles for a menu
6. Click "Save Access Rules"
7. Verify success message
8. Logout and login with different role
9. Verify menu visibility updated
**Expected**: Menu access saved, applied correctly
**Status**: ⬜ Not Tested

### Test TEAM-005: Edit Team Member
**Objective**: Verify team member editing works
**Steps**:
1. Open team member
2. Click "Edit"
3. Update fields (including PT/Area/Area Detail)
4. Save
**Expected**: Team member updated successfully
**Status**: ⬜ Not Tested

---

## 9. Reports Tests

### Test REPORT-001: Position Raw Data Report
**Objective**: Verify report generation works
**Steps**:
1. Navigate to Reports page
2. Select Priority filter (P0, P1, P2, or ALL)
3. Select Request Date range
4. Select Position Current Status
5. Click "Download CSV"
6. Verify file downloads
7. Open file and verify data
**Expected**: CSV downloaded with correct filtered data
**Status**: ⬜ Not Tested

### Test REPORT-002: Report Pagination
**Objective**: Verify report handles large datasets
**Steps**:
1. Generate report with many positions
2. Verify all data included (pagination handled)
3. Verify CSV complete
**Expected**: All data included in CSV
**Status**: ⬜ Not Tested

---

## 10. Summary by Position Tests

### Test SUMMARY-001: SLA Calculation
**Objective**: Verify SLA calculated from FPTK Receive Date
**Steps**:
1. Navigate to Summary by Position
2. Verify SLA calculated correctly
3. Verify uses FPTK Receive Date (not Request Date)
**Expected**: SLA calculated from FPTK Receive Date
**Status**: ⬜ Not Tested

### Test SUMMARY-002: Offer Declined Column Removed
**Objective**: Verify "Offer Declined" column not shown
**Steps**:
1. Navigate to Summary by Position
2. Verify "Offer Declined" column not present
3. Verify other status columns present
**Expected**: "Offer Declined" column removed
**Status**: ⬜ Not Tested

---

## 11. Menu Access Management Tests

### Test MENU-001: Menu Visibility Configuration
**Objective**: Verify menu visibility can be configured
**Steps**:
1. Login as SUPER_ADMIN
2. Navigate to Team > Menu Access Management
3. Update visible roles for Dashboard
4. Save
5. Logout
6. Login with role not in visible roles
7. Verify menu not visible
**Expected**: Menu visibility controlled correctly
**Status**: ⬜ Not Tested

### Test MENU-002: Create Permission Configuration
**Objective**: Verify create permissions can be configured
**Steps**:
1. Configure create roles for FPTK menu
2. Save
3. Login with role not in create roles
4. Verify "Create" button not visible/disabled
**Expected**: Create permissions enforced correctly
**Status**: ⬜ Not Tested

### Test MENU-003: Edit Permission Configuration
**Objective**: Verify edit permissions can be configured
**Steps**:
1. Configure edit roles for Candidates menu
2. Save
3. Login with role not in edit roles
4. Verify "Edit" button not visible/disabled
**Expected**: Edit permissions enforced correctly
**Status**: ⬜ Not Tested

---

## 12. Role-Based View Filtering Tests

### Test ROLE-001: Hiring Manager Filtering
**Objective**: Verify Hiring Manager sees only own positions
**Steps**:
1. Login as HIRING_MANAGER
2. Navigate to FPTK page
3. Verify only positions with matching Hiring Manager shown
4. Navigate to Candidates page
5. Verify only candidates for own positions shown
6. Navigate to Dashboard
7. Verify dashboard data filtered correctly
**Expected**: All views filtered by Hiring Manager
**Status**: ⬜ Not Tested

### Test ROLE-002: Head of Division Filtering
**Objective**: Verify Head of Division sees only division data
**Steps**:
1. Login as Head of Division
2. Navigate to FPTK page
3. Verify only positions with matching Division shown
4. Navigate to Candidates page
5. Verify only candidates with matching Division shown
6. Navigate to Dashboard
7. Verify dashboard data filtered correctly
**Expected**: All views filtered by Division
**Status**: ⬜ Not Tested

### Test ROLE-003: HRBP Filtering
**Objective**: Verify HRBP sees only PT/Area/Area Detail data
**Steps**:
1. Login as HRBP (with PT/Area/Area Detail configured)
2. Navigate to FPTK page
3. Verify only positions with matching PT/Area/Area Detail shown
4. Navigate to Candidates page
5. Verify only candidates with matching PT/Area/Area Detail shown
6. Navigate to Dashboard
7. Verify dashboard data filtered correctly
**Expected**: All views filtered by PT/Area/Area Detail
**Status**: ⬜ Not Tested

### Test ROLE-004: HRBP Missing Fields
**Objective**: Verify HRBP with missing fields sees no data
**Steps**:
1. Create HRBP user without PT/Area/Area Detail
2. Login
3. Verify no positions shown
4. Verify no candidates shown
5. Verify dashboard shows zeros
**Expected**: HRBP with missing fields sees no data
**Status**: ⬜ Not Tested

---

## 13. Security Tests

### Test SEC-001: SQL Injection
**Objective**: Verify SQL injection prevented
**Steps**:
1. Attempt SQL injection in search fields
2. Attempt SQL injection in login
3. Verify no SQL errors, data safe
**Expected**: SQL injection prevented
**Status**: ⬜ Not Tested

### Test SEC-002: XSS Prevention
**Objective**: Verify XSS prevented
**Steps**:
1. Enter XSS payload in text fields
2. Submit
3. View data
4. Verify payload not executed
**Expected**: XSS prevented
**Status**: ⬜ Not Tested

### Test SEC-003: CSRF Protection
**Objective**: Verify CSRF protection works
**Steps**:
1. Attempt cross-site request
2. Verify request blocked
**Expected**: CSRF prevented
**Status**: ⬜ Not Tested

### Test SEC-004: Authorization Bypass
**Objective**: Verify authorization cannot be bypassed
**Steps**:
1. Login as low-privilege user
2. Attempt to access admin endpoints directly
3. Verify access denied
**Expected**: Authorization enforced
**Status**: ⬜ Not Tested

### Test SEC-005: File Upload Security
**Objective**: Verify file upload security
**Steps**:
1. Attempt to upload executable file
2. Attempt to upload oversized file
3. Verify uploads blocked
4. Upload valid file
5. Verify file stored securely
**Expected**: File upload security enforced
**Status**: ⬜ Not Tested

---

## 14. Performance Tests

### Test PERF-001: Page Load Time
**Objective**: Verify pages load within acceptable time
**Steps**:
1. Measure dashboard load time
2. Measure FPTK list load time
3. Measure candidate list load time
4. Verify all under 2 seconds
**Expected**: All pages load within 2 seconds
**Status**: ⬜ Not Tested

### Test PERF-002: API Response Time
**Objective**: Verify API responses within acceptable time
**Steps**:
1. Measure API endpoint response times
2. Verify 95% under 2 seconds
**Expected**: API responses fast
**Status**: ⬜ Not Tested

### Test PERF-003: Concurrent Users
**Objective**: Verify system handles concurrent users
**Steps**:
1. Simulate 100 concurrent users
2. Verify system stable
3. Verify no errors
**Expected**: System handles concurrent load
**Status**: ⬜ Not Tested

---

## 15. Integration Tests

### Test INT-001: Database Integration
**Objective**: Verify database operations work
**Steps**:
1. Create data
2. Read data
3. Update data
4. Delete data
5. Verify all operations succeed
**Expected**: Database integration works
**Status**: ⬜ Not Tested

### Test INT-002: Redis Integration
**Objective**: Verify Redis caching works
**Steps**:
1. Make API request
2. Verify cached
3. Make same request
4. Verify served from cache
**Expected**: Redis caching works
**Status**: ⬜ Not Tested

### Test INT-003: File Storage Integration
**Objective**: Verify file storage works
**Steps**:
1. Upload file
2. Verify stored
3. Download file
4. Verify file correct
**Expected**: File storage works
**Status**: ⬜ Not Tested

---

## Test Execution Summary

### Test Status Legend
- ⬜ Not Tested
- 🟡 In Progress
- ✅ Passed
- ❌ Failed
- ⚠️ Blocked

### Overall Test Status
- **Total Test Cases**: 60+
- **Passed**: 0
- **Failed**: 0
- **Not Tested**: 60+
- **Coverage**: 0%

---

## Test Execution Instructions

1. **Setup Test Environment**: Follow PRODUCTION_SETUP.md
2. **Create Test Users**: Create users for each role
3. **Populate Test Data**: Create test FPTKs, candidates, applications
4. **Execute Tests**: Run each test case systematically
5. **Document Results**: Update status for each test
6. **Fix Issues**: Address any failed tests
7. **Re-test**: Re-run failed tests after fixes

---

**Last Updated**: November 2025
**Next Review**: After test execution

