#!/bin/bash

# Deployment script for VanTribe Atlas Backend
# This script pulls the latest code from the stage branch and restarts the application

set -e  # Exit on any error

echo "🚀 VanTribe Atlas Backend Deployment Script"
echo "=============================================="

# Configuration
PROJECT_DIR="${PROJECT_DIR:-/home/$(whoami)/atlas-backend}"
BRANCH="${BRANCH:-stage}"
APP_NAME="${APP_NAME:-atlas-backend}"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Navigate to project directory
echo -e "${YELLOW}📂 Navigating to project directory: ${PROJECT_DIR}${NC}"
cd "${PROJECT_DIR}"

# Check if git repository exists
if [ ! -d ".git" ]; then
    echo -e "${RED}❌ Error: Not a git repository${NC}"
    exit 1
fi

# Stash any local changes
echo -e "${YELLOW}💾 Stashing local changes...${NC}"
git stash

# Fetch latest changes
echo -e "${YELLOW}🔄 Fetching latest changes from origin...${NC}"
git fetch origin "${BRANCH}"

# Checkout and pull the branch
echo -e "${YELLOW}🔀 Checking out ${BRANCH} branch...${NC}"
git checkout "${BRANCH}"
git pull origin "${BRANCH}"

# Show latest commit
echo -e "${GREEN}📝 Latest commit:${NC}"
git log -1 --oneline

# Install/update dependencies
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
npm install --production

# Run database migrations if needed (uncomment if you have migrations)
# echo -e "${YELLOW}🗄️  Running database migrations...${NC}"
# npm run migrate

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo -e "${RED}❌ PM2 is not installed. Installing PM2...${NC}"
    npm install -g pm2
fi

# Restart the application
echo -e "${YELLOW}🔄 Restarting application...${NC}"
if pm2 list | grep -q "${APP_NAME}"; then
    pm2 restart "${APP_NAME}"
    echo -e "${GREEN}✅ Application restarted${NC}"
else
    pm2 start src/server.js --name "${APP_NAME}"
    echo -e "${GREEN}✅ Application started${NC}"
fi

# Save PM2 configuration
pm2 save

# Show application status
echo -e "${GREEN}📊 Application status:${NC}"
pm2 status

# Show logs (last 20 lines)
echo -e "${GREEN}📋 Recent logs:${NC}"
pm2 logs "${APP_NAME}" --lines 20 --nostream

echo -e "${GREEN}=============================================="
echo -e "🎉 Deployment completed successfully!${NC}"
