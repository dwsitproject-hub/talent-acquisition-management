# Investigation Findings and Recommendations

## Key Findings

### ✅ Current State: CLEAN
- **Container**: Created Feb 3 01:37:46 (recently rebuilt)
- **Processes**: Only 3 processes (normal - just `next-server` and system processes)
- **No suspicious processes**: Clean
- **Image**: Rebuilt Feb 3 09:37:14 (4 minutes before investigation)

### 🚨 Previous Compromise Evidence

**OOM Kills Timeline:**
- **Feb 1, 19:02**: `XXcgpCfE` killed (malware process)
- **Feb 2, 10:48**: OOM during `npm ci` (build process)
- **Feb 2, 13:33-13:38**: Multiple `DoC9cgKN` processes killed (malware)
- **Feb 2, 13:38**: `next-server` killed (legitimate process killed due to memory exhaustion)

**Pattern:**
1. Malware processes spawn (`XXcgpCfE`, `DoC9cgKN`)
2. Consume memory (563MB+ per process)
3. Trigger OOM killer
4. Container restarts
5. Cycle repeats

### 🔍 Attack Vector Analysis

**Most Likely: Compromised npm Package**

Evidence:
- OOM kills during `npm ci` (Feb 2, 10:48)
- Malware processes appear after container runs for a while
- Multiple vulnerabilities in dependencies (jspdf, xlsx)
- No evidence of host system compromise
- No suspicious SSH activity (all legitimate)

**Timeline:**
1. Container starts clean
2. After some time, malware process spawns
3. Memory consumption increases
4. OOM killer terminates malware
5. Container restarts (Docker restart policy)
6. Cycle repeats

### 📊 Vulnerabilities Found

1. **jspdf** (critical) - Local File Inclusion
2. **xlsx** (high) - Prototype Pollution, ReDoS
3. **js-yaml** (moderate) - Prototype Pollution

## Root Cause Hypothesis

**Most Likely**: Malicious code in an npm package that:
1. Executes after container starts
2. Spawns malware processes
3. Consumes memory
4. Gets killed by OOM
5. Re-infects after container restart

**Possible Packages:**
- Vulnerable packages (jspdf, xlsx) may have been exploited
- Or a compromised transitive dependency

## Recommendations

### Immediate Actions

1. **Keep Current Clean Container**
   - Current container is clean
   - Monitor closely for next 24-48 hours
   - Run health checks every 6 hours

2. **Audit All Dependencies**
   ```bash
   cd /opt/tas-production/frontend
   docker run --rm -v $(pwd):/app -w /app node:22-alpine npm audit
   docker run --rm -v $(pwd):/app -w /app node:22-alpine npm list --depth=10
   ```

3. **Review package-lock.json**
   - Check for suspicious packages
   - Verify all packages are from trusted sources
   - Consider using `npm ci --strict-peer-deps`

### Short-term (This Week)

1. **Replace Vulnerable Packages**
   - **xlsx**: Replace with `exceljs` (no vulnerabilities)
   - **jspdf**: Monitor for jspdf-autotable v4 support, or implement mitigations

2. **Implement Input Validation**
   - Validate all inputs before passing to jspdf
   - Limit file sizes
   - Sanitize file paths

3. **Increase Memory Limits**
   - Current: 1GB
   - Consider: 2GB (to prevent OOM kills from masking malware)

### Long-term (This Month)

1. **Dependency Security**
   - Set up automated dependency scanning
   - Use Dependabot or similar
   - Review all npm packages for suspicious activity

2. **Container Security Hardening**
   - Use read-only filesystem where possible
   - Limit container capabilities
   - Implement network policies
   - Use security scanning tools

3. **Monitoring and Alerting**
   - Set up alerts for:
     - High process count
     - Memory spikes
     - OOM kills
     - Suspicious processes

## Prevention Measures

### 1. Dependency Locking
```bash
# Always use package-lock.json
npm ci  # Not npm install

# Verify lock file integrity
npm ci --dry-run
```

### 2. Regular Security Audits
```bash
# Weekly audit
npm audit
npm audit fix  # Fix safe vulnerabilities

# Monthly deep audit
npm outdated
npm audit --audit-level=moderate
```

### 3. Container Monitoring
- Process count monitoring (alert if > 10)
- Memory usage monitoring (alert if > 80%)
- OOM kill detection
- Suspicious process detection

### 4. Build Security
- Use `--no-cache` for critical builds
- Scan images before deployment
- Verify image integrity
- Use multi-stage builds (already doing this ✅)

## Next Steps

1. **Monitor Current Container** (Next 24-48 hours)
   ```bash
   # Run every 6 hours
   ./scripts/daily-health-check.sh
   
   # Check for suspicious processes
   docker exec tas_frontend ps aux | wc -l  # Should stay < 10
   ```

2. **If Compromise Happens Again**
   - Capture evidence immediately
   - Check which npm package was updated
   - Review container logs around time of compromise
   - Check if specific API endpoint triggered it

3. **Replace xlsx Package** (Priority)
   - xlsx has no fix available
   - Replace with exceljs
   - Update code to use exceljs API

4. **Review jspdf Usage**
   - Ensure no user-controlled file paths
   - Validate all inputs
   - Consider alternative if jspdf-autotable doesn't support v4 soon

## Success Criteria

After implementing recommendations:
- ✅ No OOM kills
- ✅ Process count stays < 10
- ✅ No suspicious processes
- ✅ Memory usage stable
- ✅ No container restarts
- ✅ All vulnerabilities addressed or mitigated

