# Quick start script for local network deployment
# This script loads the saved IP and starts the application

Write-Host "Starting Talent Acquisition System for local network access..." -ForegroundColor Cyan
Write-Host ""

# Load saved IP or find it
if (Test-Path ".local-ip") {
    $savedIP = Get-Content ".local-ip" -Raw
    $savedIP = $savedIP.Trim()
    Write-Host "Using saved IP: $savedIP" -ForegroundColor Green
    $env:MY_LOCAL_IP = $savedIP
} else {
    Write-Host "No saved IP found. Running setup..." -ForegroundColor Yellow
    & .\setup-local-network.ps1
    if (Test-Path ".local-ip") {
        $savedIP = Get-Content ".local-ip" -Raw
        $savedIP = $savedIP.Trim()
        $env:MY_LOCAL_IP = $savedIP
    } else {
        Write-Host "ERROR: Could not determine IP address" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "Starting Docker containers..." -ForegroundColor Green
docker-compose -f docker-compose.yml -f docker-compose.local-network.yml up -d

Write-Host ""
Write-Host "Waiting for services to start..." -ForegroundColor Green
Start-Sleep -Seconds 5

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Application Started!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Access URLs:" -ForegroundColor Yellow
Write-Host "  Admin Dashboard: http://$savedIP`:4001" -ForegroundColor Cyan
Write-Host "  Candidate Portal: http://$savedIP`:4002" -ForegroundColor Cyan
Write-Host "  API: http://$savedIP`:4000/api" -ForegroundColor Cyan
Write-Host ""
Write-Host "Share this URL with your team:" -ForegroundColor Yellow
Write-Host "  http://$savedIP`:4001" -ForegroundColor Green -BackgroundColor Black
Write-Host ""
Write-Host "To view logs:" -ForegroundColor Gray
Write-Host "  docker-compose -f docker-compose.yml -f docker-compose.local-network.yml logs -f" -ForegroundColor DarkGray
Write-Host ""
Write-Host "To stop:" -ForegroundColor Gray
Write-Host "  docker-compose -f docker-compose.yml -f docker-compose.local-network.yml down" -ForegroundColor DarkGray
Write-Host ""

