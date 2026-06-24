# SSL Certificate Setup Guide - Detailed Instructions

## Overview

This guide explains how to obtain, prepare, and place SSL certificates for the Talent Acquisition System.

---

## Step 2: Place SSL Certificates - Detailed Explanation

### What are SSL Certificates?

SSL (Secure Sockets Layer) certificates are digital certificates that enable encrypted HTTPS connections between your web server and users' browsers. They contain:
- **Certificate**: Proves your domain's identity
- **Private Key**: Used to encrypt/decrypt data (must be kept secret)
- **Chain/Intermediate Certificates**: Links your certificate to a trusted Certificate Authority (CA)

---

## Part A: Obtaining SSL Certificates

You can get SSL certificates from several sources:

### Option 1: Commercial Certificate Authority (CA)

If you purchased a certificate from a provider like:
- **DigiCert**
- **GlobalSign**
- **Sectigo (formerly Comodo)**
- **GoDaddy SSL**
- **Namecheap SSL**

**What you'll receive:**
- Usually via email or download portal
- Files may be named differently (e.g., `yourdomain.crt`, `yourdomain.key`, `bundle.crt`)

**Typical file names from providers:**
- Certificate: `yourdomain.crt`, `certificate.crt`, `yourdomain.pem`
- Private Key: `yourdomain.key`, `private.key`, `yourdomain_private.key`
- Chain: `intermediate.crt`, `bundle.crt`, `chain.crt`, `ca-bundle.crt`

### Option 2: Let's Encrypt (Free)

If you're using Let's Encrypt (free certificates):

```bash
# Install Certbot
sudo apt update
sudo apt install certbot

# Generate certificate for your domain
sudo certbot certonly --standalone -d tas.example.com

# Certificates will be stored in:
# /etc/letsencrypt/live/tas.example.com/
#   - fullchain.pem (certificate + chain)
#   - privkey.pem (private key)
#   - cert.pem (certificate only)
#   - chain.pem (chain only)
```

**To copy Let's Encrypt certificates:**
```bash
# Copy to your project directory
sudo cp /etc/letsencrypt/live/tas.example.com/fullchain.pem /opt/tas-production/ssl/
sudo cp /etc/letsencrypt/live/tas.example.com/privkey.pem /opt/tas-production/ssl/

# Set permissions
sudo chmod 644 /opt/tas-production/ssl/fullchain.pem
sudo chmod 600 /opt/tas-production/ssl/privkey.pem
```

### Option 3: Self-Signed Certificate (Testing Only)

**⚠️ WARNING: Self-signed certificates are NOT recommended for production!**
They will show security warnings in browsers.

For testing purposes only:
```bash
# Generate self-signed certificate (valid for 365 days)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout privkey.pem \
  -out fullchain.pem \
  -subj "/CN=tas.example.com"
```

---

## Part B: Understanding Certificate Files

### Required Files

Your NGINX configuration expects these specific file names:

1. **`fullchain.pem`** - This is the **certificate + intermediate chain combined**
   - Contains: Your domain certificate + all intermediate certificates
   - Purpose: Complete certificate chain for browsers
   - Format: PEM (text format, starts with `-----BEGIN CERTIFICATE-----`)

2. **`privkey.pem`** - This is your **private key**
   - Contains: The private key that matches your certificate
   - Purpose: Used to decrypt data sent to your server
   - Format: PEM (text format, starts with `-----BEGIN PRIVATE KEY-----` or `-----BEGIN RSA PRIVATE KEY-----`)
   - **⚠️ SECURITY: This file must be kept secret and never shared!**

### Optional Files

- **`chain.pem`** - Intermediate certificates only (not needed if you have `fullchain.pem`)

---

## Part C: Identifying Your Certificate Files

### How to Identify Certificate Files

**Certificate files** usually:
- Have extensions: `.crt`, `.cer`, `.pem`, `.cert`
- Start with: `-----BEGIN CERTIFICATE-----`
- Contain your domain name in the filename
- Are provided by your CA

**Private key files** usually:
- Have extensions: `.key`, `.pem`
- Start with: `-----BEGIN PRIVATE KEY-----` or `-----BEGIN RSA PRIVATE KEY-----`
- May have "private" or "key" in the filename
- **⚠️ You should have generated this when you created the certificate request**

**Chain files** usually:
- Have extensions: `.crt`, `.pem`, `.bundle`
- May be named: `intermediate.crt`, `bundle.crt`, `chain.crt`, `ca-bundle.crt`
- Contain multiple certificates (intermediate CAs)

### Viewing Certificate Contents

To check what type of file you have:

```bash
# View certificate file
cat your-certificate-file.crt
# Should show: -----BEGIN CERTIFICATE-----
#              [base64 encoded data]
#              -----END CERTIFICATE-----

# View private key file
cat your-private-key.key
# Should show: -----BEGIN PRIVATE KEY----- or -----BEGIN RSA PRIVATE KEY-----
#              [base64 encoded data]
#              -----END PRIVATE KEY----- or -----END RSA PRIVATE KEY-----

# Check certificate details
openssl x509 -in your-certificate-file.crt -text -noout
# Shows: Issuer, Subject, Validity dates, etc.
```

---

## Part D: Preparing Certificate Files

### Scenario 1: You Have Separate Certificate and Chain Files

If your CA provided:
- `yourdomain.crt` (certificate)
- `intermediate.crt` or `bundle.crt` (chain)

**Combine them into `fullchain.pem`:**

```bash
# On your local machine or server
cat yourdomain.crt intermediate.crt > fullchain.pem

# Or if you have multiple intermediate files:
cat yourdomain.crt intermediate1.crt intermediate2.crt > fullchain.pem
```

**Order matters!** Certificate first, then intermediate(s):
```
[Your Domain Certificate]
[Intermediate Certificate 1]
[Intermediate Certificate 2]
[Root Certificate] (usually not needed)
```

### Scenario 2: You Have a Bundle File

If your CA provided a bundle file (e.g., `bundle.crt`), it might already be a fullchain:
```bash
# Check if it contains multiple certificates
grep -c "BEGIN CERTIFICATE" bundle.crt
# If output is 2 or more, it's already a fullchain

# If it's a fullchain, just rename it:
cp bundle.crt fullchain.pem
```

### Scenario 3: You Have Certificate in Different Format

**If you have `.pfx` or `.p12` (PKCS#12 format):**
```bash
# Extract certificate and key
openssl pkcs12 -in certificate.pfx -clcerts -nokeys -out fullchain.pem
openssl pkcs12 -in certificate.pfx -nocerts -nodes -out privkey.pem
```

**If you have `.der` format:**
```bash
# Convert to PEM
openssl x509 -inform DER -in certificate.der -out fullchain.pem
```

### Scenario 4: File Names Don't Match

**Rename files to match expected names:**

```bash
# Certificate file → fullchain.pem
cp yourdomain.crt fullchain.pem
# OR if you already combined certificate + chain:
cp combined-certificate-chain.pem fullchain.pem

# Private key → privkey.pem
cp yourdomain.key privkey.pem
# OR
cp private-key.key privkey.pem
```

---

## Part E: Transferring Files to Server

### Method 1: Using SCP (Secure Copy)

From your local machine:

```bash
# Transfer certificate files
scp -P 1818 fullchain.pem root@your.server.host:/opt/tas-production/ssl/
scp -P 1818 privkey.pem root@your.server.host:/opt/tas-production/ssl/

# If using a different SSH key:
scp -i ~/.ssh/your-key.pem -P 1818 fullchain.pem root@your.server.host:/opt/tas-production/ssl/
```

### Method 2: Using SFTP

```bash
# Connect via SFTP
sftp -P 1818 root@your.server.host

# Navigate to directory
cd /opt/tas-production/ssl

# Upload files
put fullchain.pem
put privkey.pem

# Exit
exit
```

### Method 3: Direct Upload via SSH

If you're already on the server:

```bash
# Create ssl directory if it doesn't exist
mkdir -p /opt/tas-production/ssl

# Use a text editor to paste certificate contents
nano /opt/tas-production/ssl/fullchain.pem
# Paste certificate content, save (Ctrl+X, Y, Enter)

nano /opt/tas-production/ssl/privkey.pem
# Paste private key content, save
```

### Method 4: Using WinSCP (Windows)

1. Open WinSCP
2. Connect to server: `root@your.server.host` on port `1818`
3. Navigate to `/opt/tas-production/ssl/`
4. Drag and drop `fullchain.pem` and `privkey.pem`

---

## Part F: Verifying Files on Server

After transferring files, verify they're correct:

```bash
# SSH into frontend server
ssh -p 1818 root@your.server.host

# Navigate to directory
cd /opt/tas-production/ssl

# List files
ls -la
# Should show:
# -rw-r--r-- 1 root root  fullchain.pem
# -rw------- 1 root root  privkey.pem

# Verify certificate file format
head -1 fullchain.pem
# Should output: -----BEGIN CERTIFICATE-----

# Verify private key file format
head -1 privkey.pem
# Should output: -----BEGIN PRIVATE KEY----- or -----BEGIN RSA PRIVATE KEY-----

# Check certificate details
openssl x509 -in fullchain.pem -text -noout | grep -E "(Subject:|Issuer:|Not Before|Not After)"
# Should show your domain and validity dates

# Verify certificate matches private key
openssl x509 -noout -modulus -in fullchain.pem | openssl md5
openssl rsa -noout -modulus -in privkey.pem | openssl md5
# Both commands should output the SAME hash
```

---

## Part G: Setting Correct Permissions

**⚠️ CRITICAL: File permissions are important for security!**

```bash
cd /opt/tas-production/ssl

# Certificate file: readable by nginx (644 = owner read/write, group/others read)
chmod 644 fullchain.pem

# Private key: only readable by owner (600 = owner read/write only)
chmod 600 privkey.pem

# Verify permissions
ls -la
# Should show:
# -rw-r--r-- 1 root root  fullchain.pem
# -rw------- 1 root root  privkey.pem
```

**Why these permissions?**
- `fullchain.pem` (644): NGINX needs to read it, but doesn't need to modify it
- `privkey.pem` (600): Only root can read it (most secure), NGINX will read it as root user in container

---

## Part H: Complete Step-by-Step Example

Here's a complete example assuming you received files from a commercial CA:

```bash
# 1. SSH into frontend server
ssh -p 1818 root@your.server.host

# 2. Navigate to project directory
cd /opt/tas-production

# 3. Create ssl directory (if it doesn't exist)
mkdir -p ssl

# 4. If you have certificate files on your local machine, transfer them:
# (Run this from your local machine)
scp -P 1818 tas_example_com.crt root@your.server.host:/tmp/
scp -P 1818 tas_example_com.key root@your.server.host:/tmp/
scp -P 1818 intermediate.crt root@your.server.host:/tmp/

# 5. Back on the server, combine certificate and chain
cd /opt/tas-production/ssl
cat /tmp/tas_example_com.crt /tmp/intermediate.crt > fullchain.pem

# 6. Copy private key
cp /tmp/tas_example_com.key privkey.pem

# 7. Set permissions
chmod 644 fullchain.pem
chmod 600 privkey.pem

# 8. Verify files
ls -la
head -1 fullchain.pem
head -1 privkey.pem

# 9. Clean up temporary files
rm /tmp/tas_example_com.crt /tmp/tas_example_com.key /tmp/intermediate.crt

# 10. Test NGINX configuration
docker compose -f docker-compose.frontend.yml -p tas-production exec nginx nginx -t

# 11. If test passes, restart NGINX
docker compose -f docker-compose.frontend.yml -p tas-production restart nginx
```

---

## Part I: Troubleshooting

### Error: "SSL certificate not found"

```bash
# Check if files exist
ls -la /opt/tas-production/ssl/

# Check if files are readable
cat /opt/tas-production/ssl/fullchain.pem
cat /opt/tas-production/ssl/privkey.pem

# Check NGINX can see them (inside container)
docker compose -f docker-compose.frontend.yml -p tas-production exec nginx ls -la /etc/nginx/ssl/
```

### Error: "SSL certificate and private key don't match"

```bash
# Verify they match
openssl x509 -noout -modulus -in /opt/tas-production/ssl/fullchain.pem | openssl md5
openssl rsa -noout -modulus -in /opt/tas-production/ssl/privkey.pem | openssl md5
# If hashes are different, you have the wrong key or certificate
```

### Error: "Certificate has expired"

```bash
# Check certificate expiration
openssl x509 -in /opt/tas-production/ssl/fullchain.pem -noout -dates
# Shows: notBefore and notAfter dates
```

### Error: "Permission denied"

```bash
# Fix permissions
chmod 644 /opt/tas-production/ssl/fullchain.pem
chmod 600 /opt/tas-production/ssl/privkey.pem

# Ensure nginx user can read (if needed)
chown root:root /opt/tas-production/ssl/fullchain.pem
chown root:root /opt/tas-production/ssl/privkey.pem
```

### Browser shows "Not Secure" or certificate warning

1. **Check certificate chain is complete:**
   ```bash
   openssl s_client -connect tas.example.com:8443 -servername tas.example.com
   # Look for "Verify return code: 0 (ok)" - if not 0, chain is incomplete
   ```

2. **Verify domain matches:**
   ```bash
   openssl x509 -in /opt/tas-production/ssl/fullchain.pem -noout -subject
   # Should show: CN=tas.example.com or similar
   ```

---

## Summary Checklist

- [ ] Obtained SSL certificate files from CA
- [ ] Identified certificate file and private key file
- [ ] Combined certificate + chain into `fullchain.pem` (if needed)
- [ ] Renamed files to `fullchain.pem` and `privkey.pem`
- [ ] Transferred files to `/opt/tas-production/ssl/` on server
- [ ] Set permissions: `chmod 644 fullchain.pem` and `chmod 600 privkey.pem`
- [ ] Verified certificate matches private key
- [ ] Verified certificate is not expired
- [ ] Tested NGINX configuration: `docker compose exec nginx nginx -t`
- [ ] Restarted NGINX container

---

**Next Step:** After placing certificates, proceed to Step 3: Update Environment Variables.

