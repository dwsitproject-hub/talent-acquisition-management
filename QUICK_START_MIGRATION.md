# Quick Start - Migration & Testing

## Step 1: Export LocalStorage Data ✅

**Access the migration page:**
```
http://localhost:4001/migrate-localStorage
```

**Steps:**
1. Open the URL in your browser
2. The page will automatically export all localStorage data
3. Click "Download JSON File" button
4. Save the file as `localStorage-export.json`
5. Copy the file to: `backend/data/localStorage-export.json`

## Step 2: Run Migration Script

**Option A: Run locally (recommended)**

**For PowerShell:**
```powershell
cd backend
npm install
node scripts/migrateLocalStorageToDB.js
```

**For Bash/CMD:**
```bash
cd backend
npm install && node scripts/migrateLocalStorageToDB.js
```

**Option B: Run in Docker container**
```bash
docker-compose exec backend npm install bcrypt
docker-compose exec backend node scripts/migrateLocalStorageToDB.js
```

## Step 3: Verify Migration

Check database records:
```bash
docker-compose exec postgres psql -U tas_user -d tas_db -c "SELECT COUNT(*) FROM master_divisions; SELECT COUNT(*) FROM master_office_locations; SELECT COUNT(*) FROM fptk;"
```

## Step 4: Run Automated Tests

```bash
docker-compose exec backend node scripts/test-api.js
```

**Note:** Update test credentials in `backend/scripts/test-api.js` if needed:
```javascript
const TEST_USER = {
  email: 'admin@kpn.com',
  password: 'your-password'
};
```

## Step 5: Manual Testing

Follow the comprehensive test checklist in `COMPREHENSIVE_TEST_RESULTS.md`

---

## Troubleshooting

### Migration page shows 404
- **Solution:** Use `http://localhost:4001/migrate-localStorage` (no .html extension)
- **Alternative:** Restart frontend: `docker-compose restart frontend`

### Migration script fails with module not found
- **Solution:** Install dependencies: `cd backend && npm install`

### Test script fails authentication
- **Solution:** Verify admin credentials or update TEST_USER in test script

