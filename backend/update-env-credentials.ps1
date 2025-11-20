# PowerShell script to update .env file with correct credentials from docker-compose.yml
# Run this script from the backend directory

$envFile = ".env"
$templateFile = "env.template"

if (-not (Test-Path $envFile)) {
    Write-Host "Creating .env file from template..."
    Copy-Item $templateFile $envFile
}

Write-Host "Updating .env file with correct credentials from docker-compose.yml..."
Write-Host ""

# Read the current .env file
$envContent = Get-Content $envFile -Raw

# Update DATABASE_URL with correct password
$envContent = $envContent -replace 'DATABASE_URL=postgresql://tas_user:.*@localhost:5432/tas_db', 'DATABASE_URL=postgresql://tas_user:tas_secure_password_change_this@localhost:5432/tas_db?schema=public'

# Update REDIS_URL with correct password format
$envContent = $envContent -replace 'REDIS_URL=redis://.*@localhost:6379', 'REDIS_URL=redis://:redis_secure_password_change_this@localhost:6379'
$envContent = $envContent -replace 'REDIS_URL=redis://localhost:6379', 'REDIS_URL=redis://:redis_secure_password_change_this@localhost:6379'

# Update REDIS_PASSWORD
$envContent = $envContent -replace 'REDIS_PASSWORD=.*', 'REDIS_PASSWORD=redis_secure_password_change_this'

# Write back to file
$envContent | Set-Content $envFile -NoNewline

Write-Host "Updated DATABASE_URL: postgresql://tas_user:tas_secure_password_change_this@localhost:5432/tas_db?schema=public"
Write-Host "Updated REDIS_URL: redis://:redis_secure_password_change_this@localhost:6379"
Write-Host "Updated REDIS_PASSWORD: redis_secure_password_change_this"
Write-Host ""
Write-Host "Done! Your .env file has been updated with the correct credentials from docker-compose.yml"
Write-Host "Note: If you changed the passwords in docker-compose.yml, update them in .env accordingly"
