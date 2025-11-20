# Migration and Comprehensive Testing Guide

## Step 1: Export LocalStorage Data

1. Open browser and navigate to: `http://localhost:4001/migrate-localStorage`
2. Click "Export All Data" button
3. Click "Download JSON File" to save the exported data
4. Copy the downloaded file to: `backend/data/localStorage-export.json`

## Step 2: Run Migration Script

**For PowerShell:**
```powershell
cd backend
npm install
node scripts/migrateLocalStorageToDB.js
```

**For Docker (if running in container):**
```powershell
docker-compose exec backend node scripts/migrateLocalStorageToDB.js
```

## Step 3: Create Missing Tables

The following tables need to be created:
- candidates
- applications
- interviews
- offers
- documents
- etc.

Run Prisma migrations to create all tables:

```bash
docker-compose exec backend npx prisma db push
```

Or create tables manually using SQL scripts.

## Step 4: Comprehensive Testing

### Manual Testing Checklist

For each page, test:

1. **View Operations**
   - Page loads successfully
   - Data displays correctly
   - Search/filter works
   - Sorting works
   - Pagination works (if applicable)

2. **Insert Operations**
   - Create with valid data
   - Required field validation
   - Optional fields accepted
   - Success message displayed
   - Data persists in database

3. **Edit Operations**
   - Edit existing record
   - Update all fields
   - Changes saved successfully
   - View updated data

4. **Delete Operations** (if applicable)
   - Delete record
   - Confirmation dialog
   - Record removed from database

5. **Negative Test Cases**
   - Missing required fields
   - Invalid data format
   - Duplicate entries
   - Non-existent record operations
   - API failure handling
   - Network timeout handling

### Automated Testing

Run the test suite (if available):

```bash
npm test
```

## Test Results Documentation

Document all test results in `TEST_EXECUTION.md`:
- ✅ Passed
- ❌ Failed
- ⏭️ Skipped
- ⚠️ Issues Found

## Next Steps

1. Complete Step 1-3 above
2. Execute comprehensive testing
3. Document all results
4. Fix any issues found
5. Re-test fixed issues

