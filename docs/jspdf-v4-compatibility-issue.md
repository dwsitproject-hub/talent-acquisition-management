# jspdf v4 Compatibility Issue

## Problem

`jspdf-autotable@5.0.2` has a peer dependency on `jspdf@"^2 || ^3"`, which means it **does not support jspdf v4**.

When trying to upgrade jspdf to v4.0.0 to fix the critical vulnerability, npm fails with:
```
Could not resolve dependency:
peer jspdf@"^2 || ^3" from jspdf-autotable@5.0.2
```

## Current Status

- **jspdf**: v3.0.4 (latest v3, still has vulnerability but compatible with jspdf-autotable)
- **jspdf-autotable**: v5.0.2 (requires jspdf v2 or v3)
- **Vulnerability**: jspdf <=3.0.4 has Local File Inclusion/Path Traversal (critical)

## Options

### Option 1: Use --legacy-peer-deps (Risky)

Force install jspdf v4 despite peer dependency conflict:

```bash
cd /opt/tas-production/frontend
docker run --rm -v $(pwd):/app -w /app node:22-alpine npm install jspdf@^4.0.0 --legacy-peer-deps
```

**Risks:**
- jspdf-autotable may not work correctly with jspdf v4
- PDF generation may break
- Requires thorough testing

**Testing Required:**
- Test all PDF generation features
- Verify table rendering works
- Check for runtime errors

### Option 2: Wait for jspdf-autotable Update (Recommended)

Monitor for jspdf-autotable update that supports jspdf v4:
- Check: https://github.com/simonbengtsson/jspdf-autotable
- Subscribe to releases for v4 compatibility

**Current Workaround:**
- Keep jspdf at v3.0.4 (latest v3)
- Document the risk
- Add input validation to mitigate LFI vulnerability
- Monitor for updates

### Option 3: Replace jspdf-autotable (Major Refactor)

If jspdf-autotable doesn't support v4 soon, consider:
- Using jspdf v4's built-in table features (if available)
- Switching to alternative PDF library (pdfkit, pdfmake)
- Implementing custom table rendering

**Effort:** High - requires code changes

### Option 4: Accept Risk with Mitigations (Temporary)

Keep jspdf v3 but add security mitigations:

1. **Input Validation**: Validate all inputs before passing to jspdf
2. **File Path Sanitization**: Ensure no user-controlled file paths
3. **Sandboxing**: Run PDF generation in isolated environment
4. **Monitoring**: Watch for jspdf-autotable updates

## Recommended Approach

**Short-term (Now):**
1. Keep jspdf at v3.0.4 (compatible with jspdf-autotable)
2. Add input validation in PDF generation code
3. Document the risk
4. Monitor for jspdf-autotable v4 support

**Medium-term (When jspdf-autotable supports v4):**
1. Upgrade to jspdf v4
2. Test thoroughly
3. Deploy

**Long-term (If no support):**
1. Evaluate alternatives
2. Consider replacing jspdf-autotable
3. Plan migration

## Current Implementation

The code uses:
- `jsPDF` for PDF creation
- `jspdf-autotable` for table rendering

Files affected:
- `frontend/src/utils/pdfGenerator.ts`

## Mitigation Steps (While Waiting)

1. **Add Input Validation**:
   ```typescript
   // Validate all inputs before using in PDF
   function sanitizeInput(input: any): string {
     if (typeof input !== 'string') return '';
     // Remove path traversal attempts
     return input.replace(/\.\./g, '').replace(/[\/\\]/g, '');
   }
   ```

2. **Limit File Operations**:
   - Don't allow user-controlled file paths
   - Use only in-memory operations
   - Don't read files from user input

3. **Monitor for Updates**:
   ```bash
   # Check weekly for updates
   docker run --rm -v $(pwd):/app -w /app node:22-alpine npm outdated jspdf jspdf-autotable
   ```

## References

- jspdf v4 changelog: https://github.com/parallax/jsPDF/releases
- jspdf-autotable: https://github.com/simonbengtsson/jspdf-autotable
- jspdf vulnerability: https://github.com/advisories/GHSA-f8cm-6447-x5h2

