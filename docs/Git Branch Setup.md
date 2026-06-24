# Git Branch Setup Guide

## Common Issue: "src refspec SIT does not match any"

This error occurs when:
1. You're not on the SIT branch
2. The SIT branch doesn't exist locally
3. You haven't committed anything yet

## Solution

### Check Current Branch

```bash
git branch
# Shows all local branches, * indicates current branch
```

### If SIT Branch Doesn't Exist Locally

```bash
# Option 1: Create and switch to SIT branch
git checkout -b SIT
git push -u origin SIT

# Option 2: Track existing remote SIT branch
git fetch origin
git checkout -b SIT origin/SIT
```

### If You're on a Different Branch

```bash
# Switch to SIT branch
git checkout SIT

# If SIT doesn't exist locally, create it from remote
git fetch origin
git checkout -b SIT origin/SIT
```

### If You Have Uncommitted Changes

```bash
# Check status
git status

# If you have changes, commit them first
git add .
git commit -m "Your commit message"
git push origin SIT
```

### Verify Remote Configuration

```bash
# Check remote URL
git remote -v

# Should show:
# origin  https://github.com/your-github-org/talent-acquisition-management.git (fetch)
# origin  https://github.com/your-github-org/talent-acquisition-management.git (push)
```

### Complete Setup (If Starting Fresh)

```bash
cd /opt/tas-production

# Check current branch
git branch

# If not on SIT, switch to it
git checkout SIT

# If SIT doesn't exist, create it
git checkout -b SIT

# Set upstream
git push -u origin SIT

# Now you can push normally
git push origin SIT
```

