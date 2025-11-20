#!/bin/bash

# Script to rebuild Docker containers and test dashboard endpoint
# Usage: ./test-dashboard-docker.sh

set -e

echo "=========================================="
echo "Dashboard Docker Test & Rebuild Script"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}Error: docker-compose is not installed${NC}"
    exit 1
fi

echo -e "\n${YELLOW}[1] Stopping containers...${NC}"
docker-compose down

echo -e "\n${YELLOW}[2] Rebuilding backend container...${NC}"
docker-compose build --no-cache backend

echo -e "\n${YELLOW}[3] Starting containers...${NC}"
docker-compose up -d

echo -e "\n${YELLOW}[4] Waiting for backend to be ready...${NC}"
sleep 10

# Wait for backend health check
MAX_ATTEMPTS=30
ATTEMPT=0
while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    if curl -f http://localhost:4000/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Backend is ready${NC}"
        break
    fi
    ATTEMPT=$((ATTEMPT + 1))
    echo "Waiting for backend... ($ATTEMPT/$MAX_ATTEMPTS)"
    sleep 2
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    echo -e "${RED}Error: Backend did not become ready${NC}"
    echo "Checking logs..."
    docker-compose logs --tail=50 backend
    exit 1
fi

echo -e "\n${YELLOW}[5] Testing dashboard endpoint...${NC}"
cd backend
node scripts/test-dashboard.js http://localhost:4000

echo -e "\n${YELLOW}[6] Checking backend logs for dashboard queries...${NC}"
docker-compose logs --tail=100 backend | grep -i "dashboard" || echo "No dashboard logs found"

echo -e "\n${GREEN}=========================================="
echo "Test Complete"
echo "==========================================${NC}"

# Show instructions
echo -e "\n${YELLOW}Next steps:${NC}"
echo "1. Check the browser console for dashboard API responses"
echo "2. Verify the dashboard page shows chart data"
echo "3. If data is still empty, check:"
echo "   - Are there FPTKs in the database?"
echo "   - Do FPTKs have areaDetail/area and requestDate?"
echo "   - Check backend logs: docker-compose logs -f backend"

