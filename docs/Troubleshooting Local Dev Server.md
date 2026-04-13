# Troubleshooting Local Development Server

## "This site can't be reached" Error

If you're getting "This site can't be reached" when trying to access `http://localhost:4001`, try these steps:

### 1. Check if Server is Running

```powershell
# Check if port 4001 is in use
netstat -ano | findstr :4001

# Check for Node processes
Get-Process -Name node -ErrorAction SilentlyContinue
```

### 2. Start the Server Manually

Open a new terminal/PowerShell window and run:

```powershell
cd "D:\Cursor\Talent Acquisition Management - Production\frontend"
npm run dev
```

You should see output like:
```
▲ Next.js 16.1.6
- Local:        http://localhost:4001
- Ready in 2.3s
```

### 3. Check for Compilation Errors

If the server starts but shows errors, check:
- TypeScript compilation errors
- Missing dependencies
- Port conflicts

### 4. Common Issues

#### Port Already in Use
```powershell
# Find what's using port 4001
netstat -ano | findstr :4001

# Kill the process (replace PID with actual number)
taskkill /PID <PID> /F

# Or use a different port
npm run dev -- -p 4002
```

#### Missing Dependencies
```powershell
cd frontend
rm -r node_modules
rm package-lock.json
npm install
```

#### TypeScript Errors
```powershell
# Check for TypeScript errors
cd frontend
npx tsc --noEmit
```

#### Node Version Issues
```powershell
# Check Node version (should be 18+)
node --version

# If using nvm, switch to correct version
nvm use 22
```

### 5. Alternative: Use Different Port

If port 4001 is problematic:

```powershell
# Edit package.json, change:
"dev": "next dev -p 4002"

# Or run directly:
npx next dev -p 4002
```

### 6. Check Firewall

Windows Firewall might be blocking the connection:

```powershell
# Check firewall status
Get-NetFirewallProfile | Select-Object Name, Enabled

# Temporarily disable firewall for testing (not recommended for production)
Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled False
```

### 7. Verify Installation

```powershell
cd frontend

# Check Next.js is installed
npm list next

# Reinstall if needed
npm install next@^16.1.6
```

### 8. Clear Next.js Cache

```powershell
cd frontend
rm -r .next
npm run dev
```

### 9. Check Browser Console

Open browser DevTools (F12) and check:
- Network tab for failed requests
- Console tab for JavaScript errors
- Application tab for service worker issues

### 10. Try Different Browser

Sometimes browser extensions or settings can cause issues:
- Try incognito/private mode
- Try a different browser
- Clear browser cache

## Quick Diagnostic Commands

```powershell
# Full diagnostic
cd "D:\Cursor\Talent Acquisition Management - Production\frontend"
Write-Host "Node version:"; node --version
Write-Host "NPM version:"; npm --version
Write-Host "Next.js installed:"; npm list next
Write-Host "Port 4001 status:"; netstat -ano | findstr :4001
Write-Host "Starting server..."; npm run dev
```

## Still Not Working?

1. Check the terminal output for specific error messages
2. Look for red error text in the console
3. Check if antivirus is blocking Node.js
4. Try running as administrator
5. Check Windows Event Viewer for system errors

