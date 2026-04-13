# xlsx to ExcelJS Migration

## Summary

Successfully replaced the vulnerable `xlsx` package with `exceljs` to address security vulnerabilities.

## Changes Made

### 1. Package Updates
- **Removed**: `xlsx@^0.18.5` (vulnerable, no fix available)
- **Removed**: `@types/xlsx@^0.0.35` (no longer needed)
- **Added**: `exceljs@^4.4.0` (secure, actively maintained)

### 2. Code Updates

#### `frontend/src/utils/excelParser.ts`
- Changed from `XLSX.read()` to `ExcelJS.Workbook().xlsx.load()`
- Updated date parsing to use ExcelJS date handling
- Changed from `FileReader.readAsBinaryString()` to `File.arrayBuffer()`
- Made function async/await

#### `frontend/src/utils/fptkExcelParser.ts`
- Changed from `XLSX.read()` to `ExcelJS.Workbook().xlsx.load()`
- Updated date parsing for `priorityByMonthYear` and `requestDate`
- Changed `generateFPTKTemplate()` from sync to async
- Updated Excel file generation to use ExcelJS API
- Changed file download to use Blob API

#### `frontend/src/app/fptk/page.tsx`
- Updated `handleDownloadTemplate()` to async/await

## Security Benefits

1. **Eliminates High Severity Vulnerabilities**:
   - Prototype Pollution (CVE-2024-24763)
   - Regular Expression Denial of Service (ReDoS) (CVE-2024-24764)

2. **No Fix Available for xlsx**:
   - xlsx package had no patches for these vulnerabilities
   - exceljs is actively maintained and secure

3. **Better API**:
   - ExcelJS has a more modern, promise-based API
   - Better TypeScript support
   - More features and better performance

## Deployment Steps

### On Server (ECS-App)

1. **Pull the latest code**:
   ```bash
   cd /opt/tas-production
   git pull origin SIT
   ```

2. **Rebuild frontend container**:
   ```bash
   docker compose -f docker-compose.frontend.yml -p tas-production --env-file .env.production build --no-cache frontend
   ```

3. **Restart frontend container**:
   ```bash
   docker compose -f docker-compose.frontend.yml -p tas-production --env-file .env.production up -d frontend
   ```

4. **Verify**:
   ```bash
   # Check container is running
   docker ps | grep tas_frontend
   
   # Check logs for errors
   docker logs tas_frontend --tail 50
   
   # Test HTTP endpoint
   curl -I http://localhost:8080
   ```

## Testing Checklist

After deployment, test:

- [ ] Upload candidate Excel file (should parse correctly)
- [ ] Upload FPTK Excel file (should parse correctly)
- [ ] Download FPTK template (should generate and download)
- [ ] Verify date parsing works correctly
- [ ] Verify all fields map correctly
- [ ] Check browser console for errors

## Rollback Plan

If issues occur:

1. **Revert the commit**:
   ```bash
   git revert 4fa8ed5
   git push origin SIT
   ```

2. **Rebuild with old package**:
   ```bash
   docker compose -f docker-compose.frontend.yml -p tas-production --env-file .env.production build --no-cache frontend
   docker compose -f docker-compose.frontend.yml -p tas-production --env-file .env.production up -d frontend
   ```

## Notes

- ExcelJS uses a different date serial format, but we've handled the conversion
- The API is async, so all Excel operations are now promise-based
- File downloads now use the Blob API instead of direct file writing
- All functionality should work the same from user perspective

## Related Issues

- Addresses security vulnerabilities identified in investigation
- Part of security hardening after container compromise incident
- Reduces attack surface by removing vulnerable dependencies

