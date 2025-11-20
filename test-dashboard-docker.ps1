# Script to rebuild Docker containers and test dashboard endpoint
# Usage: .\test-dashboard-docker.ps1

$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Dashboard Docker Test & Rebuild Script" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# Check if docker-compose is available
if (-not (Get-Command docker-compose -ErrorAction SilentlyContinue)) {
    Write-Host "Error: docker-compose is not installed" -ForegroundColor Red
    exit 1
}

Write-Host "`n[1] Stopping containers..." -ForegroundColor Yellow
docker-compose down

Write-Host "`n[2] Rebuilding backend container..." -ForegroundColor Yellow
docker-compose build --no-cache backend

Write-Host "`n[3] Starting containers..." -ForegroundColor Yellow
docker-compose up -d

Write-Host "`n[4] Waiting for backend to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Wait for backend health check
$MaxAttempts = 30
$Attempt = 0
$BackendReady = $false

while ($Attempt -lt $MaxAttempts) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:4000/health" -Method GET -TimeoutSec 2 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Host "✓ Backend is ready" -ForegroundColor Green
            $BackendReady = $true
            break
        }
    } catch {
        # Backend not ready yet
    }
    $Attempt++
    Write-Host "Waiting for backend... ($Attempt/$MaxAttempts)"
    Start-Sleep -Seconds 2
}

if (-not $BackendReady) {
    Write-Host "Error: Backend did not become ready" -ForegroundColor Red
    Write-Host "Checking logs..." -ForegroundColor Yellow
    docker-compose logs --tail=50 backend
    exit 1
}

Write-Host "`n[5] Testing dashboard endpoint..." -ForegroundColor Yellow
Set-Location backend
node scripts/test-dashboard.js http://localhost:4000
Set-Location ..

Write-Host "`n[6] Checking backend logs for dashboard queries..." -ForegroundColor Yellow
docker-compose logs --tail=100 backend | Select-String -Pattern "dashboard" -CaseSensitive:$false

Write-Host "`n==========================================" -ForegroundColor Green
Write-Host "Test Complete" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green

# Show instructions
Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "1. Check the browser console for dashboard API responses"
Write-Host "2. Verify the dashboard page shows chart data"
Write-Host "3. If data is still empty, check:"
Write-Host "   - Are there FPTKs in the database?"
Write-Host "   - Do FPTKs have areaDetail/area and requestDate?"
Write-Host "   - Check backend logs: docker-compose logs -f backend"

