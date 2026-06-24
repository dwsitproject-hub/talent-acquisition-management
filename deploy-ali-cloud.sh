#!/bin/bash
# AliCloud Deployment Script
# This script helps deploy to AliCloud production servers

set -e

echo "=========================================="
echo "AliCloud Production Deployment"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
GITHUB_USER="your-github-org"
GITHUB_REPO="talent-acquisition-management"
SERVER_IP="your.server.host"
FRONTEND_SSH_PORT="1818"
BACKEND_SSH_PORT="1819"
DEPLOY_DIR="/opt/tas"

echo -e "${YELLOW}GitHub Authentication Setup${NC}"
echo "GitHub no longer supports password authentication."
echo ""
echo "Choose authentication method:"
echo "1) Personal Access Token (PAT) - Quick setup"
echo "2) SSH Keys - Recommended for production"
echo ""
read -p "Enter choice (1 or 2): " auth_choice

if [ "$auth_choice" == "1" ]; then
    echo ""
    echo -e "${YELLOW}Using Personal Access Token${NC}"
    echo "1. Go to: https://github.com/settings/tokens"
    echo "2. Click 'Generate new token' -> 'Generate new token (classic)'"
    echo "3. Name: 'AliCloud Production Deploy'"
    echo "4. Select scope: 'repo' (full control)"
    echo "5. Generate and copy the token"
    echo ""
    read -p "Enter your Personal Access Token: " github_token
    GIT_URL="https://${GITHUB_USER}:${github_token}@github.com/${GITHUB_USER}/${GITHUB_REPO}.git"
elif [ "$auth_choice" == "2" ]; then
    echo ""
    echo -e "${YELLOW}Using SSH Keys${NC}"
    echo "Make sure you've added your SSH key to GitHub:"
    echo "https://github.com/settings/keys"
    echo ""
    read -p "Press Enter to continue..."
    GIT_URL="git@github.com:${GITHUB_USER}/${GITHUB_REPO}.git"
else
    echo -e "${RED}Invalid choice. Exiting.${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Which server are you deploying to?${NC}"
echo "1) Backend Server (SSH Port 1819) - PostgreSQL, Redis, Backend API"
echo "2) Frontend Server (SSH Port 1818) - NGINX, Frontend, Candidate Portal"
echo ""
read -p "Enter choice (1 or 2): " server_choice

if [ "$server_choice" == "1" ]; then
    SSH_PORT=$BACKEND_SSH_PORT
    SERVER_TYPE="backend"
elif [ "$server_choice" == "2" ]; then
    SSH_PORT=$FRONTEND_SSH_PORT
    SERVER_TYPE="frontend"
else
    echo -e "${RED}Invalid choice. Exiting.${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}Deploying to ${SERVER_TYPE} server (SSH Port ${SSH_PORT})...${NC}"
echo ""

# Create deployment script to run on remote server
cat > /tmp/deploy_remote.sh << 'DEPLOY_SCRIPT'
#!/bin/bash
set -e

DEPLOY_DIR="/opt/tas"
GIT_URL="$1"

echo "=========================================="
echo "Installing prerequisites..."
echo "=========================================="

# Update system
apt update && apt upgrade -y

# Install required packages
apt install -y ca-certificates curl gnupg git openssh-client

# Install Docker
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable --now docker
else
    echo "Docker already installed"
fi

# Install Docker Compose plugin
if [ ! -f /usr/lib/docker/cli-plugins/docker-compose ]; then
    echo "Installing Docker Compose..."
    mkdir -p /usr/lib/docker/cli-plugins
    curl -SL "https://github.com/docker/compose/releases/download/v2.31.0/docker-compose-linux-x86_64" -o /usr/lib/docker/cli-plugins/docker-compose
    chmod +x /usr/lib/docker/cli-plugins/docker-compose
else
    echo "Docker Compose already installed"
fi

echo ""
echo "=========================================="
echo "Cloning repository..."
echo "=========================================="

# Create directory if it doesn't exist
mkdir -p $(dirname $DEPLOY_DIR)

# Clone or update repository
if [ -d "$DEPLOY_DIR" ]; then
    echo "Repository exists, updating..."
    cd $DEPLOY_DIR
    git pull
else
    echo "Cloning repository..."
    git clone $GIT_URL $DEPLOY_DIR
    cd $DEPLOY_DIR
fi

echo ""
echo "=========================================="
echo "Setup complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Create .env file: cp env.network.template .env.${SERVER_TYPE}"
echo "2. Edit .env file with your configuration"
echo "3. Start services with docker compose"
echo ""
echo "For backend server:"
echo "  docker compose up -d postgres redis backend"
echo "  docker compose exec backend npx prisma migrate deploy"
echo ""
echo "For frontend server:"
echo "  docker compose up -d frontend candidate-portal nginx"
DEPLOY_SCRIPT

# Copy script to remote server and execute
echo "Connecting to server..."
ssh -p $SSH_PORT root@$SERVER_IP "bash -s" < /tmp/deploy_remote.sh "$GIT_URL"

echo ""
echo -e "${GREEN}Deployment script completed!${NC}"
echo ""
echo "SSH into the server to continue:"
echo "  ssh -p ${SSH_PORT} root@${SERVER_IP}"
echo "  cd ${DEPLOY_DIR}"
echo ""
echo "See ALICLOUD_DEPLOYMENT_GUIDE.md for detailed instructions."

