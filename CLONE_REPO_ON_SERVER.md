# Clone Repository on Deployment Server

## Problem
The server may not have SSH keys configured for GitHub, so SSH cloning can fail.

## Solution 1: Use Personal Access Token (HTTPS) - RECOMMENDED

**On the server:**

```bash
# Clone using HTTPS with Personal Access Token
git clone https://<GITHUB_USERNAME>:<YOUR_TOKEN>@github.com/<GITHUB_ORG>/talent-acquisition-management.git tas
```

**Replace `<GITHUB_USERNAME>`, `<GITHUB_ORG>`, and `<YOUR_TOKEN>` with your values.**

**If you don't have a token:**
1. Go to: https://github.com/settings/tokens
2. Click "Generate new token" → "Generate new token (classic)"
3. Name: `Production Server Clone`
4. Select scope: `repo` (full control of private repositories)
5. Generate and copy the token

**Example (replace placeholders):**
```bash
git clone https://<GITHUB_USERNAME>:<YOUR_TOKEN>@github.com/<GITHUB_ORG>/talent-acquisition-management.git tas
```

---

## Solution 2: Add Server's SSH Key to GitHub

**On the server, generate SSH key:**

```bash
ssh-keygen -t ed25519 -C "your_email@example.com"

# When prompted:
# - "Enter file in which to save the key": Press Enter (default: ~/.ssh/id_ed25519)
# - "Enter passphrase": Use a passphrase or press Enter
```

**Display the public key:**
```bash
cat ~/.ssh/id_ed25519.pub
```

**Copy the entire output** (starts with `ssh-ed25519`)

**Add to GitHub:**
1. Go to: https://github.com/settings/keys
2. Click "New SSH key"
3. Title: `Production Server`
4. Paste the public key
5. Save

**Test GitHub connection:**
```bash
ssh -T git@github.com
```

**Then clone:**
```bash
git clone git@github.com:<GITHUB_ORG>/talent-acquisition-management.git tas
```

---

## Solution 3: Use SSH Agent Forwarding (Advanced)

If you want to use your local SSH key from the server:

**On your local machine, enable SSH agent:**
```powershell
Start-Service ssh-agent
ssh-add $env:USERPROFILE\.ssh\id_ed25519
```

**Connect to server with agent forwarding:**
```powershell
ssh -A -p <SSH_PORT> <USER>@<SERVER_HOST>
```

**Then on server, clone:**
```bash
git clone git@github.com:<GITHUB_ORG>/talent-acquisition-management.git tas
```

---

## Recommended: Use Personal Access Token

**For production servers, HTTPS with a scoped token is often simpler:**

```bash
git clone https://<GITHUB_USERNAME>:<TOKEN>@github.com/<GITHUB_ORG>/talent-acquisition-management.git tas

cd tas
git pull https://<GITHUB_USERNAME>:<TOKEN>@github.com/<GITHUB_ORG>/talent-acquisition-management.git
```

**Or configure Git credential helper (store token securely on server):**
```bash
git clone https://github.com/<GITHUB_ORG>/talent-acquisition-management.git tas
cd tas
git config credential.helper store
git config user.name "Your Name"
git config user.email "your_email@example.com"
git pull
# Enter username and token when prompted
```

---

## Quick Fix

**On the server:**

```bash
git clone https://<GITHUB_USERNAME>:<YOUR_TOKEN>@github.com/<GITHUB_ORG>/talent-acquisition-management.git tas
cd tas
ls -la
```

**Security notes:**
- Use tokens with minimal scope and expiration
- Never commit tokens to the repository
- Rotate tokens if exposed
