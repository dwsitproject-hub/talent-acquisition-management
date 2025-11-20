# PowerShell script to deploy Talent Acquisition System to company network
# Usage: .\deploy-network.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Talent Acquisition System - Network Deployment" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if .env.network exists
if (-not (Test-Path ".env.network")) {
    Write-Host "ERROR: .env.network file not found!" -ForegroundColor Red
    Write-Host "Please copy env.network.template to .env.network and configure it." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Example:" -ForegroundColor Yellow
    Write-Host "  Copy-Item env.network.template .env.network" -ForegroundColor Gray
    Write-Host "  # Then edit .env.network with your settings" -ForegroundColor Gray
    exit 1
}

# Load environment variables
Write-Host "Loading environment variables from .env.network..." -ForegroundColor Green
$envVars = @{}
Get-Content .env.network | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
        $key = $matches[1].Trim()
        $value = $matches[2].Trim()
        $envVars[$key] = $value
    }
}

# First pass: set SERVER_HOST
if ($envVars.ContainsKey("SERVER_HOST")) {
    $serverHost = $envVars["SERVER_HOST"]
    [Environment]::SetEnvironmentVariable("SERVER_HOST", $serverHost, "Process")
}

# Second pass: substitute ${SERVER_HOST} in other variables and set them
foreach ($key in $envVars.Keys) {
    $value = $envVars[$key]
    # Replace ${SERVER_HOST} with actual value
    $value = $value -replace '\$\{SERVER_HOST\}', $serverHost
    [Environment]::SetEnvironmentVariable($key, $value, "Process")
}

# Check required variables
$requiredVars = @("SERVER_HOST", "POSTGRES_PASSWORD", "REDIS_PASSWORD", "JWT_SECRET", "JWT_REFRESH_SECRET", "ENCRYPTION_KEY")
$missingVars = @()

foreach ($var in $requiredVars) {
    if (-not [Environment]::GetEnvironmentVariable($var, "Process")) {
        $missingVars += $var
    }
}

if ($missingVars.Count -gt 0) {
    Write-Host "ERROR: Missing required environment variables:" -ForegroundColor Red
    foreach ($var in $missingVars) {
        Write-Host "  - $var" -ForegroundColor Yellow
    }
    exit 1
}

# Set derived variables
$serverHost = [Environment]::GetEnvironmentVariable("SERVER_HOST", "Process")
$httpPort = [Environment]::GetEnvironmentVariable("HTTP_PORT", "Process")
if (-not $httpPort) { $httpPort = "80" }

Write-Host "Server Host: $serverHost" -ForegroundColor Cyan
Write-Host "HTTP Port: $httpPort" -ForegroundColor Cyan
Write-Host ""

# Set FRONTEND_URL and CORS_ORIGIN if not already set
if (-not [Environment]::GetEnvironmentVariable("FRONTEND_URL", "Process")) {
    [Environment]::SetEnvironmentVariable("FRONTEND_URL", "http://$serverHost", "Process")
}
if (-not [Environment]::GetEnvironmentVariable("CANDIDATE_PORTAL_URL", "Process")) {
    [Environment]::SetEnvironmentVariable("CANDIDATE_PORTAL_URL", "http://$serverHost`:4002", "Process")
}
if (-not [Environment]::GetEnvironmentVariable("CORS_ORIGIN", "Process")) {
    [Environment]::SetEnvironmentVariable("CORS_ORIGIN", "http://$serverHost,http://$serverHost`:4001,http://$serverHost`:4002", "Process")
}
if (-not [Environment]::GetEnvironmentVariable("NEXT_PUBLIC_API_URL", "Process")) {
    [Environment]::SetEnvironmentVariable("NEXT_PUBLIC_API_URL", "http://$serverHost/api", "Process")
}

Write-Host "Configuration:" -ForegroundColor Green
Write-Host "  Frontend URL: $([Environment]::GetEnvironmentVariable('FRONTEND_URL', 'Process'))" -ForegroundColor Gray
Write-Host "  Candidate Portal URL: $([Environment]::GetEnvironmentVariable('CANDIDATE_PORTAL_URL', 'Process'))" -ForegroundColor Gray
Write-Host "  API URL: $([Environment]::GetEnvironmentVariable('NEXT_PUBLIC_API_URL', 'Process'))" -ForegroundColor Gray
Write-Host ""

# Confirm deployment
Write-Host "Ready to deploy. This will:" -ForegroundColor Yellow
Write-Host "  1. Stop existing containers (if any)" -ForegroundColor Gray
Write-Host "  2. Build Docker images" -ForegroundColor Gray
Write-Host "  3. Start all services" -ForegroundColor Gray
Write-Host "  4. Run database migrations" -ForegroundColor Gray
Write-Host ""
$confirm = Read-Host "Continue? (Y/N)"
if ($confirm -ne "Y" -and $confirm -ne "y") {
    Write-Host "Deployment cancelled." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "Stopping existing containers..." -ForegroundColor Green
docker-compose -f docker-compose.network.yml down

Write-Host ""
Write-Host "Building Docker images..." -ForegroundColor Green
docker-compose -f docker-compose.network.yml build --no-cache

Write-Host ""
Write-Host "Starting services..." -ForegroundColor Green
docker-compose -f docker-compose.network.yml up -d

Write-Host ""
Write-Host "Waiting for services to be ready..." -ForegroundColor Green
Start-Sleep -Seconds 10

Write-Host ""
Write-Host "Running database migrations..." -ForegroundColor Green
docker-compose -f docker-compose.network.yml exec -T backend npx prisma migrate deploy

Write-Host ""
Write-Host "Checking service status..." -ForegroundColor Green
docker-compose -f docker-compose.network.yml ps

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Deployment Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Access the application at:" -ForegroundColor Green
Write-Host "  Admin Dashboard: http://$serverHost" -ForegroundColor Cyan
Write-Host "  API: http://$serverHost/api" -ForegroundColor Cyan
Write-Host ""
Write-Host "To view logs:" -ForegroundColor Yellow
Write-Host "  docker-compose -f docker-compose.network.yml logs -f" -ForegroundColor Gray
Write-Host ""
Write-Host "To stop services:" -ForegroundColor Yellow
Write-Host "  docker-compose -f docker-compose.network.yml down" -ForegroundColor Gray
Write-Host ""

