#!/bin/bash

# VM Setup Script for CI/CD Pipeline
# Run this script on your GCP VM to complete the setup

set -e  # Exit on any error

echo "=========================================="
echo "   VanTribe Backend - VM Setup Script"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="/home/vibro_in/vanbackend"
SSH_KEY_PATH="/home/vibro_in/.ssh/gcp_deploy_key"

echo -e "${YELLOW}Step 1: Adding public key to authorized_keys${NC}"
if [ -f "${SSH_KEY_PATH}.pub" ]; then
    cat "${SSH_KEY_PATH}.pub" >> ~/.ssh/authorized_keys
    chmod 600 ~/.ssh/authorized_keys
    chmod 700 ~/.ssh
    echo -e "${GREEN}✓ Public key added to authorized_keys${NC}"
else
    echo -e "${RED}✗ Public key not found at ${SSH_KEY_PATH}.pub${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Step 2: Checking Node.js installation${NC}"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✓ Node.js is installed: ${NODE_VERSION}${NC}"
else
    echo -e "${YELLOW}Installing Node.js 20.x...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
    echo -e "${GREEN}✓ Node.js installed${NC}"
fi

echo ""
echo -e "${YELLOW}Step 3: Checking PM2 installation${NC}"
if command -v pm2 &> /dev/null; then
    PM2_VERSION=$(pm2 --version)
    echo -e "${GREEN}✓ PM2 is installed: ${PM2_VERSION}${NC}"
else
    echo -e "${YELLOW}Installing PM2...${NC}"
    sudo npm install -g pm2
    echo -e "${GREEN}✓ PM2 installed${NC}"
fi

echo ""
echo -e "${YELLOW}Step 4: Setting up project${NC}"
cd "${PROJECT_DIR}"
echo -e "Current directory: $(pwd)"

# Ensure on stage branch
git checkout stage
git pull origin stage
echo -e "${GREEN}✓ On stage branch and up to date${NC}"

# Install dependencies
echo -e "${YELLOW}Installing dependencies...${NC}"
npm install
echo -e "${GREEN}✓ Dependencies installed${NC}"

echo ""
echo -e "${YELLOW}Step 5: Checking .env file${NC}"
if [ -f ".env" ]; then
    echo -e "${GREEN}✓ .env file exists${NC}"
    echo "Current .env variables:"
    grep -v "^#" .env | grep -v "^$" | cut -d= -f1
else
    echo -e "${RED}✗ .env file not found${NC}"
    echo "Please create .env file with required variables"
    echo "Example:"
    echo "  PORT=8081"
    echo "  MONGODB_URI=your_mongodb_uri"
    echo "  JWT_SECRET=your_jwt_secret"
    echo "  NODE_ENV=production"
    exit 1
fi

echo ""
echo -e "${YELLOW}Step 6: Starting application with PM2${NC}"
if pm2 list | grep -q "atlas-backend"; then
    echo "Application already running, restarting..."
    pm2 restart atlas-backend
else
    echo "Starting application..."
    pm2 start src/server.js --name atlas-backend
fi
echo -e "${GREEN}✓ Application started${NC}"

echo ""
echo -e "${YELLOW}Step 7: Saving PM2 configuration${NC}"
pm2 save
echo -e "${GREEN}✓ PM2 configuration saved${NC}"

echo ""
echo -e "${YELLOW}Step 8: Setting up PM2 startup${NC}"
echo "Run the following command to enable PM2 on system startup:"
pm2 startup

echo ""
echo "=========================================="
echo -e "${GREEN}   Setup Complete! ✓${NC}"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Copy the private key for GitHub Secrets:"
echo "   cat ${SSH_KEY_PATH}"
echo ""
echo "2. Get your VM's external IP:"
echo "   curl ifconfig.me"
echo ""
echo "3. Add GitHub Secrets at:"
echo "   https://github.com/maisachinsharmahu/vanbackend/settings/secrets/actions"
echo ""
echo "4. Check application status:"
echo "   pm2 status"
echo "   pm2 logs atlas-backend"
echo ""
echo "5. Test the pipeline by pushing to stage branch"
echo ""
