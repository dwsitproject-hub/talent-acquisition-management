# Deploy Dashboard Changes to Production

## Issue: Changes Not Reflecting After Git Pull and Docker Compose

If you've pulled the code and rebuilt containers but changes aren't showing, follow these steps:

## Frontend Server (ECS-App)

### 1. Pull Latest Code
```bash
cd /opt/tas-production
git pull origin SIT
```

### 2. Verify Code Changes
```bash
# Check if the files were updated
git log --oneline -5
git diff HEAD~1 frontend/src/app/page.tsx | head -20
```

### 3. Rebuild Frontend WITHOUT Cache
```bash
cd /opt/tas-production

# Stop containers
docker compose -f docker-compose.frontend.yml -p tas-production stop frontend

# Remove old image (optional but recommended)
docker rmi talentacquisitionmanagement-production-frontend:latest 2>/dev/null || true

# Rebuild WITHOUT cache to ensure fresh code
docker compose -f docker-compose.frontend.yml -p tas-production build --no-cache frontend

# Start with new image
docker compose -f docker-compose.frontend.yml -p tas-production up -d frontend
```

### 4. Verify Frontend is Running
```bash
docker logs tas_frontend --tail 50
# Should see Next.js server starting
```

### 5. Hard Refresh Browser
- Press **Ctrl+Shift+R** (or Cmd+Shift+R on Mac)
- Or open DevTools (F12) → Right-click refresh button → "Empty Cache and Hard Reload"

## Backend Server (ECS-DB)

### 1. Pull Latest Code
```bash
cd /opt/tas-production
git pull origin SIT
```

### 2. Verify Code Changes
```bash
# Check if dashboardService.js was updated
git log --oneline -5
git diff HEAD~1 backend/src/services/dashboardService.js | head -30
```

### 3. Rebuild Backend WITHOUT Cache
```bash
cd /opt/tas-production

# Stop backend container
docker compose -f docker-compose.network.yml -p tas-production stop backend

# Remove old image (optional but recommended)
docker rmi talentacquisitionmanagement-production-backend:latest 2>/dev/null || true

# Rebuild WITHOUT cache
docker compose -f docker-compose.network.yml -p tas-production build --no-cache backend

# Start with new image
docker compose -f docker-compose.network.yml -p tas-production up -d backend
```

### 4. Verify Backend is Running
```bash
docker logs tas_backend --tail 50
# Should see "Server running on port 4000"
# Check for any errors
```

### 5. Test API Endpoint
```bash
# From frontend server, test backend API
curl -H "Authorization: Bearer <your-token>" http://8.215.56.98:4000/api/dashboard/stats | jq '.data.closedPositions, .data.holdPositions'
# Should return numbers (not undefined)
```

## Troubleshooting

### If changes still don't appear:

1. **Check Git Branch**
   ```bash
   git branch
   # Should show: * SIT
   ```

2. **Verify Files Were Actually Updated**
   ```bash
   # Frontend
   grep -n "closedPositions" frontend/src/app/page.tsx
   grep -n "holdPositions" frontend/src/app/page.tsx
   
   # Backend
   grep -n "closedPositions" backend/src/services/dashboardService.js
   grep -n "holdPositions" backend/src/services/dashboardService.js
   ```

3. **Check Docker Image Timestamps**
   ```bash
   docker images | grep talentacquisitionmanagement-production
   # Check CREATED timestamp - should be recent
   ```

4. **Force Rebuild Everything**
   ```bash
   # Frontend server
   docker compose -f docker-compose.frontend.yml -p tas-production down
   docker compose -f docker-compose.frontend.yml -p tas-production build --no-cache
   docker compose -f docker-compose.frontend.yml -p tas-production up -d
   
   # Backend server
   docker compose -f docker-compose.network.yml -p tas-production down
   docker compose -f docker-compose.network.yml -p tas-production build --no-cache
   docker compose -f docker-compose.network.yml -p tas-production up -d
   ```

5. **Check Browser Cache**
   - Open DevTools (F12)
   - Go to Network tab
   - Check "Disable cache"
   - Hard refresh (Ctrl+Shift+R)

## Expected Result

After deployment, the dashboard should show:
- **Open Positions**: Count excluding Cancel, Hold, Signing, On Boarding
- **Closed Positions**: Count of Cancel, Signing, On Boarding (NEW)
- **Hold Positions**: Count of Hold status (NEW)

All three sections should be clickable and show detailed lists.

