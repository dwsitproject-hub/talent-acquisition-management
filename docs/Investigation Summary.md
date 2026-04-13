# Investigation Summary - Container Compromise

## Executive Summary

**Current Status**: ✅ Container is CLEAN (rebuilt Feb 3, 2026)

**Previous Compromise**: Malware processes (`XXcgpCfE`, `DoC9cgKN`) were active Feb 1-2, causing OOM kills and container restarts.

**Root Cause**: Most likely a compromised npm package that executes malicious code after container startup.

## Timeline of Events

### Feb 1, 19:02
- Malware process `XXcgpCfE` killed by OOM
- Consumed 563MB memory
- Container likely restarted

### Feb 2, 10:48
- OOM during `npm ci` (build process)
- Suggests malware may be in build dependencies

### Feb 2, 13:33-13:38
- Multiple `DoC9cgKN` processes killed
- Each consuming significant memory
- `next-server` (legitimate) also killed due to memory exhaustion

### Feb 3, 01:37
- Container rebuilt from clean source
- Currently clean (3 processes, no malware)

## Attack Vector: Compromised npm Package

**Evidence:**
1. OOM kill during `npm ci` suggests build-time infection
2. Malware spawns after container runs (not immediately)
3. Multiple obfuscated process names (`XXcgpCfE`, `DoC9cgKN`)
4. No evidence of host system compromise
5. Vulnerable packages present (jspdf, xlsx)

**Most Likely Scenario:**
- A compromised npm package (direct or transitive dependency)
- Executes malicious code after container starts
- Spawns malware processes
- Consumes memory until OOM kill
- Re-infects after container restart

## Vulnerable Packages Identified

1. **jspdf@3.0.4** (critical) - Local File Inclusion
2. **xlsx@0.18.5** (high) - Prototype Pollution, ReDoS (NO FIX)
3. **js-yaml** (moderate) - Prototype Pollution

## Immediate Recommendations

### 1. Replace xlsx (High Priority - No Fix Available)

```bash
cd /opt/tas-production/frontend

# Replace xlsx with exceljs
docker run --rm -v $(pwd):/app -w /app node:22-alpine sh -c "
  npm uninstall xlsx @types/xlsx
  npm install exceljs
"
```

Then update code in:
- `frontend/src/utils/excelParser.ts`
- `frontend/src/utils/fptkExcelParser.ts`

### 2. Monitor Current Container Closely

```bash
# Check every 6 hours
./scripts/daily-health-check.sh

# Watch process count
watch -n 60 'docker exec tas_frontend ps aux | wc -l'
```

### 3. Review All Dependencies

```bash
# Deep dependency tree
docker run --rm -v $(pwd):/app -w /app node:22-alpine npm list --depth=10 > dependency-tree.txt

# Check for suspicious packages
grep -iE "(suspicious|malware|trojan|backdoor)" dependency-tree.txt
```

### 4. Implement Stricter Security

- Use `npm ci --strict-peer-deps`
- Pin all dependency versions
- Regular security audits
- Consider using `npm audit --production` before builds

## Prevention Strategy

### Short-term (This Week)
1. ✅ Replace xlsx with exceljs
2. ✅ Monitor container closely
3. ✅ Review dependency tree
4. ✅ Implement input validation for jspdf

### Medium-term (This Month)
1. Upgrade jspdf to v4 when jspdf-autotable supports it
2. Set up automated dependency scanning
3. Implement container security hardening
4. Set up alerts for suspicious activity

### Long-term (Ongoing)
1. Regular security audits
2. Dependency updates with testing
3. Container scanning before deployment
4. Continuous monitoring

## Success Indicators

After implementing recommendations:
- ✅ No OOM kills
- ✅ Process count stable (< 10)
- ✅ No suspicious processes
- ✅ Memory usage stable
- ✅ No container restarts
- ✅ All critical vulnerabilities addressed

## Next Monitoring Steps

Run these commands every 6 hours for next 48 hours:

```bash
# Quick health check
docker exec tas_frontend ps aux | wc -l  # Should be < 10
docker exec tas_frontend ps aux | grep -E "(lrt|pkill|XX)" || echo "✅ Clean"
docker stats tas_frontend --no-stream --format "Memory: {{.MemPerc}}"
curl -I http://localhost:8080  # Should return 200
```

If process count increases or suspicious processes appear, run emergency response immediately.

