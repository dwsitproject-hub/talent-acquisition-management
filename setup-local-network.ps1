# PowerShell script to setup Talent Acquisition System for local network access
# This allows others on your network to access the app from your laptop

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Local Network Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Find local IP address
Write-Host "Finding your local IP address..." -ForegroundColor Green

$ipAddresses = @()
$adapters = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { 
    $_.IPAddress -notlike "127.*" -and 
    $_.IPAddress -notlike "169.254.*" -and
    $_.PrefixOrigin -eq "Dhcp" -or $_.PrefixOrigin -eq "Manual"
} | Sort-Object IPAddress

if ($adapters.Count -eq 0) {
    Write-Host "Could not automatically detect IP address." -ForegroundColor Yellow
    Write-Host "Please enter your laptop's local IP address manually:" -ForegroundColor Yellow
    Write-Host "  (You can find it by running: ipconfig)" -ForegroundColor Gray
    $manualIP = Read-Host "Enter IP address (e.g., 192.168.1.100)"
    $selectedIP = $manualIP
} elseif ($adapters.Count -eq 1) {
    $selectedIP = $adapters[0].IPAddress
    Write-Host "Detected IP address: $selectedIP" -ForegroundColor Green
} else {
    Write-Host "Multiple network adapters found:" -ForegroundColor Yellow
    Write-Host ""
    $index = 1
    foreach ($adapter in $adapters) {
        $interface = Get-NetAdapter | Where-Object { $_.ifIndex -eq $adapter.InterfaceIndex }
        Write-Host "  [$index] $($adapter.IPAddress) - $($interface.Name)" -ForegroundColor Gray
        $ipAddresses += $adapter.IPAddress
        $index++
    }
    Write-Host ""
    $choice = Read-Host "Select IP address (1-$($adapters.Count))"
    if ($choice -match '^\d+$' -and [int]$choice -ge 1 -and [int]$choice -le $adapters.Count) {
        $selectedIP = $ipAddresses[[int]$choice - 1]
    } else {
        Write-Host "Invalid selection. Using first IP: $($ipAddresses[0])" -ForegroundColor Yellow
        $selectedIP = $ipAddresses[0]
    }
}

Write-Host ""
Write-Host "Using IP address: $selectedIP" -ForegroundColor Cyan
Write-Host ""

# Set environment variable for current session
$env:MY_LOCAL_IP = $selectedIP

# Display access information
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Access Information" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Your laptop IP: $selectedIP" -ForegroundColor Green
Write-Host ""
Write-Host "Others on your network can access:" -ForegroundColor Yellow
Write-Host "  Admin Dashboard: http://$selectedIP`:4001" -ForegroundColor Cyan
Write-Host "  Candidate Portal: http://$selectedIP`:4002" -ForegroundColor Cyan
Write-Host "  API: http://$selectedIP`:4000/api" -ForegroundColor Cyan
Write-Host ""
Write-Host "You can also access locally at:" -ForegroundColor Yellow
Write-Host "  Admin Dashboard: http://localhost:4001" -ForegroundColor Gray
Write-Host "  Candidate Portal: http://localhost:4002" -ForegroundColor Gray
Write-Host "  API: http://localhost:4000/api" -ForegroundColor Gray
Write-Host ""

# Check Windows Firewall
Write-Host "Checking Windows Firewall..." -ForegroundColor Green
$firewallRules = Get-NetFirewallRule | Where-Object { 
    $_.DisplayName -like "*TAS*" -or 
    $_.DisplayName -like "*Talent*" -or
    ($_.DisplayName -like "*Port 4000*" -or $_.DisplayName -like "*Port 4001*" -or $_.DisplayName -like "*Port 4002*")
}

if ($firewallRules.Count -eq 0) {
    Write-Host "No firewall rules found. Creating firewall rules..." -ForegroundColor Yellow
    
    $confirm = Read-Host "Allow incoming connections on ports 4000, 4001, 4002? (Y/N)"
    if ($confirm -eq "Y" -or $confirm -eq "y") {
        try {
            New-NetFirewallRule -DisplayName "TAS Backend API" -Direction Inbound -LocalPort 4000 -Protocol TCP -Action Allow -ErrorAction SilentlyContinue | Out-Null
            New-NetFirewallRule -DisplayName "TAS Frontend" -Direction Inbound -LocalPort 4001 -Protocol TCP -Action Allow -ErrorAction SilentlyContinue | Out-Null
            New-NetFirewallRule -DisplayName "TAS Candidate Portal" -Direction Inbound -LocalPort 4002 -Protocol TCP -Action Allow -ErrorAction SilentlyContinue | Out-Null
            Write-Host "Firewall rules created successfully!" -ForegroundColor Green
        } catch {
            Write-Host "Warning: Could not create firewall rules automatically." -ForegroundColor Yellow
            Write-Host "You may need to allow ports 4000, 4001, 4002 manually in Windows Firewall." -ForegroundColor Yellow
        }
    } else {
        Write-Host "Skipping firewall configuration." -ForegroundColor Yellow
        Write-Host "You may need to allow ports 4000, 4001, 4002 manually in Windows Firewall." -ForegroundColor Yellow
    }
} else {
    Write-Host "Firewall rules already exist." -ForegroundColor Green
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Next Steps" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Start/restart the application with:" -ForegroundColor Yellow
Write-Host "   docker-compose -f docker-compose.yml -f docker-compose.local-network.yml up -d" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Share these URLs with your team:" -ForegroundColor Yellow
Write-Host "   http://$selectedIP`:4001" -ForegroundColor Cyan
Write-Host ""
Write-Host "3. To stop:" -ForegroundColor Yellow
Write-Host "   docker-compose -f docker-compose.yml -f docker-compose.local-network.yml down" -ForegroundColor Gray
Write-Host ""

# Save IP to file for later use
$selectedIP | Out-File -FilePath ".local-ip" -Encoding ASCII -NoNewline
Write-Host "IP address saved to .local-ip file" -ForegroundColor Gray
Write-Host ""

