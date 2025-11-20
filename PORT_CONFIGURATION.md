# Port Configuration

The KPN Talent Acquisition System uses the following ports:

## Default Ports

| Service | Port | URL |
|---------|------|-----|
| **Backend API** | 4000 | http://localhost:4000/api |
| **Admin Dashboard** | 4001 | http://localhost:4001 |
| **Candidate Portal** | 4002 | http://localhost:4002 |
| **PostgreSQL** | 5432 | localhost:5432 |
| **Redis** | 6379 | localhost:6379 |

## Accessing the System

### Development (Local)
```bash
# Backend API
curl http://localhost:4000/health

# Admin Dashboard
open http://localhost:4001

# Candidate Portal
open http://localhost:4002
```

### Docker Deployment
```bash
# Start all services
docker-compose up -d

# Services will be available at:
# - API: http://localhost:4000/api
# - Admin: http://localhost:4001
# - Careers: http://localhost:4002
```

## Port Configuration Files

The following files contain port configurations:

### Backend
- `backend/env.template` - PORT=4000
- `backend/src/server.js` - Default port 4000
- `backend/Dockerfile` - EXPOSE 4000

### Frontend Services
- `candidate-portal/package.json` - Port 4002 in dev/start scripts
- `candidate-portal/next.config.js` - API URL with port 4000
- `frontend/package.json` - Port 4001 (when created)

### Docker Configuration
- `docker-compose.yml`:
  - Backend: maps 4000:4000
  - Frontend: maps 4001:3000
  - Candidate Portal: maps 4002:3000
  
### Nginx Configuration
- `nginx/nginx.conf`:
  - Backend upstream: backend:4000
  - Frontend upstream: frontend:3000 (internal)
  - Candidate Portal upstream: candidate-portal:3000 (internal)

### Documentation
- `README.md`
- `GETTING_STARTED.md`
- `docs/API_DOCUMENTATION.md`
- `docs/DEPLOYMENT.md`
- `PROJECT_SUMMARY.md`

## Firewall Configuration

If deploying to a server, ensure these ports are open:

```bash
# For development/internal access
sudo ufw allow 4000/tcp  # Backend API
sudo ufw allow 4001/tcp  # Admin Dashboard
sudo ufw allow 4002/tcp  # Candidate Portal

# For production (with Nginx)
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
```

## Environment Variables

Make sure to update these in your `.env` file:

```env
# Backend
PORT=4000
API_BASE_URL=http://localhost:4000
FRONTEND_URL=http://localhost:4001
CANDIDATE_PORTAL_URL=http://localhost:4002

# CORS
CORS_ORIGIN=http://localhost:4001,http://localhost:4002
```

## Production URLs

In production with domain names:

```env
# Backend
API_BASE_URL=https://api.yourdomain.com
FRONTEND_URL=https://admin.yourdomain.com
CANDIDATE_PORTAL_URL=https://careers.yourdomain.com

# CORS
CORS_ORIGIN=https://admin.yourdomain.com,https://careers.yourdomain.com
```

## Troubleshooting

### Port Already in Use

If you get "port already in use" errors:

```bash
# Windows
netstat -ano | findstr :4000
netstat -ano | findstr :4001
netstat -ano | findstr :4002

# Linux/Mac
lsof -i :4000
lsof -i :4001
lsof -i :4002

# Kill the process
# Windows: taskkill /PID <PID> /F
# Linux/Mac: kill -9 <PID>
```

### Change Ports

To use different ports, update:

1. `backend/env.template` - Change PORT value
2. `docker-compose.yml` - Update port mappings
3. `candidate-portal/package.json` - Update dev/start scripts
4. `nginx/nginx.conf` - Update upstream configurations
5. All documentation files

---

**Last Updated:** October 2024  
**System Version:** 1.0.0

