#!/bin/bash
# Script to run Backstage Docker image locally with environment from .envrc

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting Backstage Docker container...${NC}"

# Check if .envrc exists
if [ ! -f .envrc ]; then
    echo -e "${RED}Error: .envrc file not found!${NC}"
    echo "Please ensure you're in the app-portal directory and .envrc exists"
    exit 1
fi

# Source the environment variables
echo -e "${YELLOW}Loading environment from .envrc...${NC}"
source .envrc

# Check if required environment variables are set
if [ -z "$AUTH_GITHUB_CLIENT_ID" ] || [ -z "$AUTH_GITHUB_APP_PRIVATE_KEY_FILE" ]; then
    echo -e "${RED}Error: Required environment variables not set!${NC}"
    echo "Please check your .envrc file"
    exit 1
fi

# Check if private key file exists
if [ ! -f "$AUTH_GITHUB_APP_PRIVATE_KEY_FILE" ]; then
    echo -e "${RED}Error: Private key file not found at $AUTH_GITHUB_APP_PRIVATE_KEY_FILE${NC}"
    exit 1
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Error: Docker is not running!${NC}"
    echo "Please start Docker or Rancher Desktop"
    exit 1
fi

# Check if image exists
if ! docker image inspect backstage:latest > /dev/null 2>&1; then
    echo -e "${YELLOW}Warning: backstage:latest image not found${NC}"
    echo "Building image first with 'yarn build-image'..."
    yarn build:backend && yarn build-image
fi

echo -e "${GREEN}Starting container...${NC}"
echo "Frontend will be available at: http://localhost:3000"
echo "Backend API will be available at: http://localhost:7007"
echo ""
echo "Press Ctrl+C to stop the container"
echo ""

# Run the container
docker run -it --rm \
  --name backstage-local \
  -p 7007:7007 \
  -p 3000:3000 \
  -e NODE_ENV=development \
  -e APP_CONFIG_app_title="${APP_CONFIG_app_title}" \
  -e AUTH_GITHUB_CLIENT_ID="${AUTH_GITHUB_CLIENT_ID}" \
  -e AUTH_GITHUB_CLIENT_SECRET="${AUTH_GITHUB_CLIENT_SECRET}" \
  -e AUTH_GITHUB_APP_ID="${AUTH_GITHUB_APP_ID}" \
  -e AUTH_GITHUB_APP_INSTALLATION_ID="${AUTH_GITHUB_APP_INSTALLATION_ID}" \
  -e AUTH_GITHUB_APP_PRIVATE_KEY_FILE="/app/github-app-key.pem" \
  -e K8S_SERVICE_ACCOUNT_TOKEN="${K8S_SERVICE_ACCOUNT_TOKEN}" \
  -v "${AUTH_GITHUB_APP_PRIVATE_KEY_FILE}:/app/github-app-key.pem:ro" \
  backstage:latest