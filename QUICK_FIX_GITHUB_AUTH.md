# Quick Fix: GitHub Authentication for Deployment

## Problem
GitHub no longer accepts passwords for Git operations. You need a Personal Access Token or SSH keys.

## Solution 1: Personal Access Token (Fastest)

### Step 1: Create Token on GitHub
1. Go to: https://github.com/settings/tokens
2. Click **"Generate new token"** → **"Generate new token (classic)"**
3. Name: `Production Deploy`
4. Expiration: Choose 90 days or custom
5. Select scope: **`repo`** (full control of private repositories)
6. Click **"Generate token"**
7. **COPY THE TOKEN IMMEDIATELY** (you won't see it again!)

### Step 2: Use Token to Clone

On your deployment server:

```bash
git clone https://<GITHUB_USERNAME>:<YOUR_TOKEN>@github.com/<GITHUB_ORG>/talent-acquisition-management.git tas
```

### Step 3: Verify
```bash
cd tas
ls -la
```

---

## Solution 2: SSH Keys (Better for Production)

### Step 1: Generate SSH Key (if you don't have one)

**On your local machine (PowerShell):**
```powershell
ssh-keygen -t ed25519 -C "your_email@example.com"
```

### Step 2: Copy Public Key
```powershell
type $env:USERPROFILE\.ssh\id_ed25519.pub
```

### Step 3: Add to GitHub
1. Go to: https://github.com/settings/keys
2. Click **"New SSH key"**
3. Title: `Production Server`
4. Paste your public key
5. Click **"Add SSH key"**

### Step 4: Copy SSH Key to Deployment Server

**From your local machine:**
```powershell
ssh-copy-id -p <SSH_PORT> <USER>@<SERVER_HOST>
```

**Or manually:**
```powershell
type $env:USERPROFILE\.ssh\id_ed25519.pub
# SSH into server, add key to ~/.ssh/authorized_keys
ssh -p <SSH_PORT> <USER>@<SERVER_HOST>
mkdir -p ~/.ssh
nano ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
chmod 700 ~/.ssh
```

### Step 5: Clone Using SSH
```bash
git clone git@github.com:<GITHUB_ORG>/talent-acquisition-management.git tas
```

---

## Quick Command Reference

### Using Personal Access Token:
```bash
git clone https://<GITHUB_USERNAME>:<TOKEN>@github.com/<GITHUB_ORG>/talent-acquisition-management.git tas
cd tas
git pull https://<GITHUB_USERNAME>:<TOKEN>@github.com/<GITHUB_ORG>/talent-acquisition-management.git
```

### Using SSH:
```bash
git clone git@github.com:<GITHUB_ORG>/talent-acquisition-management.git tas
cd tas
git pull
```

---

## Troubleshooting

- **Authentication failed**: Verify token scope includes `repo` for private repositories
- **Permission denied (publickey)**: Ensure the server's SSH public key is added to GitHub
- **Token in URL logged in shell history**: Prefer `git credential helper` or SSH keys

**Never commit tokens or SSH private keys to the repository.**
