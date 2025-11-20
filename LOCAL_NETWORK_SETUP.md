# Local Network Setup Guide

This guide will help you host the Talent Acquisition System on your laptop and make it accessible to others on your local network (e.g., your office WiFi).

## Quick Start

### Step 1: Setup Local Network Access

Run the setup script to detect your laptop's IP address:

```powershell
.\setup-local-network.ps1
```

This script will:
- Automatically detect your laptop's local IP address
- Create Windows Firewall rules to allow incoming connections
- Save your IP address for future use

### Step 2: Start the Application

```powershell
.\start-local-network.ps1
```

Or manually:
```powershell
# Set your IP (replace with your actual IP)
$env:MY_LOCAL_IP="192.168.1.100"

# Start services
docker-compose -f docker-compose.yml -f docker-compose.local-network.yml up -d
```

### Step 3: Share the URL

Share this URL with your team:
```
http://YOUR_IP_ADDRESS:4001
```

Replace `YOUR_IP_ADDRESS` with the IP shown by the setup script (e.g., `http://192.168.1.100:4001`)

## Finding Your IP Address Manually

### Windows
```powershell
ipconfig
```
Look for "IPv4 Address" under your active network adapter (usually WiFi or Ethernet).

### Linux/Mac
```bash
ifconfig
# or
ip addr show
```

## Access URLs

Once running, the application will be accessible at:

- **Admin Dashboard:** `http://YOUR_IP:4001`
- **Candidate Portal:** `http://YOUR_IP:4002`
- **API:** `http://YOUR_IP:4000/api`

You can also access locally using `localhost`:
- **Admin Dashboard:** `http://localhost:4001`
- **Candidate Portal:** `http://localhost:4002`
- **API:** `http://localhost:4000/api`

## Firewall Configuration

### Windows Firewall

The setup script will automatically create firewall rules. If you need to do it manually:

```powershell
New-NetFirewallRule -DisplayName "TAS Backend API" -Direction Inbound -LocalPort 4000 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "TAS Frontend" -Direction Inbound -LocalPort 4001 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "TAS Candidate Portal" -Direction Inbound -LocalPort 4002 -Protocol TCP -Action Allow
```

Or use Windows Firewall GUI:
1. Open Windows Defender Firewall
2. Click "Advanced settings"
3. Click "Inbound Rules" → "New Rule"
4. Select "Port" → Next
5. Select "TCP" and enter port (4000, 4001, or 4002)
6. Allow the connection
7. Apply to all profiles
8. Name it (e.g., "TAS Frontend")

### Linux Firewall (UFW)

```bash
sudo ufw allow 4000/tcp
sudo ufw allow 4001/tcp
sudo ufw allow 4002/tcp
sudo ufw reload
```

## Common Commands

### Start Services
```powershell
.\start-local-network.ps1
```

### Stop Services
```powershell
docker-compose -f docker-compose.yml -f docker-compose.local-network.yml down
```

### View Logs
```powershell
docker-compose -f docker-compose.yml -f docker-compose.local-network.yml logs -f
```

### Restart Services
```powershell
docker-compose -f docker-compose.yml -f docker-compose.local-network.yml restart
```

### Check Status
```powershell
docker-compose -f docker-compose.yml -f docker-compose.local-network.yml ps
```

## Troubleshooting

### Others Cannot Access

1. **Check Firewall:**
   - Ensure Windows Firewall allows ports 4000, 4001, 4002
   - Check if antivirus is blocking connections

2. **Verify IP Address:**
   - Make sure you're sharing the correct IP address
   - IP should be on the same network (e.g., 192.168.1.x)
   - Run `ipconfig` again to confirm current IP

3. **Check Network:**
   - Ensure all devices are on the same network (same WiFi/router)
   - Some corporate networks may block device-to-device communication

4. **Verify Services are Running:**
   ```powershell
   docker-compose -f docker-compose.yml -f docker-compose.local-network.yml ps
   ```

5. **Test Locally First:**
   - Try accessing `http://localhost:4001` on your laptop
   - If that works, the issue is network/firewall related

### IP Address Changed

If your laptop's IP address changes (e.g., after reconnecting to WiFi):

1. Run setup again:
   ```powershell
   .\setup-local-network.ps1
   ```

2. Restart services:
   ```powershell
   .\start-local-network.ps1
   ```

3. Share the new IP address with your team

### Port Already in Use

If you get "port already in use" errors:

```powershell
# Check what's using the port
netstat -ano | findstr :4001

# Stop existing containers
docker-compose down
```

### CORS Errors

If you see CORS errors in the browser console:

1. Make sure `MY_LOCAL_IP` environment variable is set correctly
2. Restart the backend:
   ```powershell
   docker-compose -f docker-compose.yml -f docker-compose.local-network.yml restart backend
   ```

## Security Notes

⚠️ **Important Security Considerations:**

1. **Local Network Only:** This setup is for local network access only. Do not expose to the internet.

2. **Firewall:** Keep Windows Firewall enabled and only allow the specific ports needed.

3. **WiFi Security:** Ensure your WiFi network is password-protected.

4. **Access Control:** The application still requires login credentials. Make sure users have appropriate accounts.

5. **VPN:** If using VPN, others may need to connect to the same VPN to access.

## Switching Back to Local-Only

To switch back to local-only access (not accessible from network):

```powershell
# Stop network-enabled containers
docker-compose -f docker-compose.yml -f docker-compose.local-network.yml down

# Start normal containers
docker-compose up -d
```

## Tips

1. **Static IP (Optional):** To avoid IP changes, you can set a static IP on your laptop:
   - Windows: Network Settings → Change adapter options → Properties → IPv4 → Use static IP
   - This prevents the IP from changing when reconnecting to WiFi

2. **Bookmark the URL:** Save `http://YOUR_IP:4001` as a bookmark for easy access

3. **Share IP via Email/Slack:** Send the IP address to your team so they can bookmark it

4. **Monitor Resources:** Keep an eye on your laptop's CPU and memory usage when multiple users are accessing

---

**Last Updated:** November 2024  
**Version:** 1.0.0

