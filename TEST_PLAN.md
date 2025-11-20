# Comprehensive Test Plan - Talent Acquisition System

## Test Scope
- Dashboard
- Candidates
- Open Position (FPTK)
- Summary by Position
- Master Division
- Master Office Location
- Team

## Test Scenarios

### 1. Dashboard Page
#### Positive Test Cases
- [ ] View dashboard loads successfully
- [ ] All statistics display correctly
- [ ] Charts render properly
- [ ] Recent activity shows correctly
- [ ] Refresh button works

#### Negative Test Cases
- [ ] Dashboard loads with no data (empty state)
- [ ] API failure handled gracefully (falls back to localStorage)
- [ ] Network timeout handled

### 2. Candidates Page
#### Positive Test Cases - View
- [ ] Candidates list loads successfully
- [ ] Search functionality works
- [ ] Status filter works
- [ ] View candidate details
- [ ] Pagination works (if applicable)

#### Positive Test Cases - Insert
- [ ] Create new candidate with valid data
- [ ] All required fields validated
- [ ] Optional fields accepted
- [ ] File upload works (CV, form data)
- [ ] Success message displayed

#### Positive Test Cases - Edit
- [ ] Edit existing candidate
- [ ] Update all fields
- [ ] Changes saved successfully
- [ ] View updated data

#### Negative Test Cases
- [ ] Create candidate with missing required fields
- [ ] Create candidate with invalid email
- [ ] Create candidate with invalid phone
- [ ] Edit non-existent candidate
- [ ] Delete candidate (if applicable)
- [ ] API failure during create/edit
- [ ] Network timeout during operations

### 3. Open Position (FPTK) Page
#### Positive Test Cases - View
- [ ] FPTK list loads successfully
- [ ] Search functionality works
- [ ] Status filter works
- [ ] View FPTK details
- [ ] Download template works
- [ ] Upload results modal displays correctly

#### Positive Test Cases - Insert
- [ ] Create new FPTK with valid data
- [ ] All required fields validated
- [ ] Priority dropdown (P0, P1, P2) works
- [ ] Priority by Month-Year picker works
- [ ] Excel upload works
- [ ] Multiple FPTKs created from Excel
- [ ] Success message displayed

#### Positive Test Cases - Edit
- [ ] Edit existing FPTK
- [ ] Update all fields (PT, No FKTK, Status FKTK, etc.)
- [ ] Priority changes saved
- [ ] Priority by Month-Year changes saved
- [ ] Changes reflected in view
- [ ] Status update works

#### Positive Test Cases - Upload
- [ ] Upload valid Excel file
- [ ] Success rows displayed
- [ ] Failed rows displayed with errors
- [ ] Download failed rows CSV
- [ ] Redirect to list after upload

#### Negative Test Cases
- [ ] Create FPTK with missing required fields
- [ ] Create FPTK with invalid data
- [ ] Upload invalid Excel file
- [ ] Upload Excel with duplicate FPTK numbers
- [ ] Upload Excel with invalid status values
- [ ] Edit non-existent FPTK
- [ ] API failure during operations
- [ ] Network timeout

### 4. Summary by Position Page
#### Positive Test Cases - View
- [ ] Summary table loads successfully
- [ ] All columns display correctly
- [ ] Status counts calculated correctly
- [ ] SLA buckets calculated correctly
- [ ] Priority filter works
- [ ] Division filter works
- [ ] Sort by column headers works
- [ ] Sort ascending/descending works

#### Negative Test Cases
- [ ] Summary loads with no data
- [ ] Filter with no results
- [ ] API failure handled

### 5. Master Division Page
#### Positive Test Cases - View
- [ ] Divisions list loads successfully
- [ ] Search functionality works
- [ ] View division details

#### Positive Test Cases - Insert
- [ ] Create new division with valid data
- [ ] Unique constraint enforced (division + section)
- [ ] Success message displayed

#### Positive Test Cases - Edit
- [ ] Edit existing division
- [ ] Update all fields
- [ ] Changes saved successfully

#### Negative Test Cases
- [ ] Create division with missing required fields
- [ ] Create duplicate division+section
- [ ] Edit non-existent division
- [ ] Delete division (if applicable)
- [ ] API failure handled

### 6. Master Office Location Page
#### Positive Test Cases - View
- [ ] Office locations list loads successfully
- [ ] Search functionality works
- [ ] PT field displays correctly
- [ ] View location details

#### Positive Test Cases - Insert
- [ ] Create new location with valid data
- [ ] PT field works correctly
- [ ] Unique constraint enforced (PT + area + areaDetail)
- [ ] Success message displayed

#### Positive Test Cases - Edit
- [ ] Edit existing location
- [ ] Update PT field
- [ ] Update all fields
- [ ] Changes saved successfully

#### Negative Test Cases
- [ ] Create location with missing required fields
- [ ] Create duplicate PT+area+areaDetail
- [ ] Edit non-existent location
- [ ] Delete location (if applicable)
- [ ] API failure handled

### 7. Team Page
#### Positive Test Cases - View
- [ ] Team members list loads successfully
- [ ] Search functionality works
- [ ] View team member details

#### Positive Test Cases - Insert
- [ ] Create new team member with valid data
- [ ] Role assignment works
- [ ] Password creation works
- [ ] Success message displayed

#### Positive Test Cases - Edit
- [ ] Edit existing team member
- [ ] Update all fields
- [ ] Role changes saved
- [ ] Status toggle works
- [ ] Password reset works

#### Negative Test Cases
- [ ] Create team member with missing required fields
- [ ] Create team member with invalid email
- [ ] Create duplicate email
- [ ] Edit non-existent team member
- [ ] API failure handled

## Test Execution Notes
- All tests should be executed with authenticated user
- Test both with data and without data (empty state)
- Verify API integration (check network tab)
- Verify database persistence (check database after operations)
- Test error handling and user feedback
- Test loading states and UI responsiveness

