#!/bin/bash
set -e

# TODO:
# split in yarn build, docker build, docker push

# Configuration
REGISTRY="ghcr.io"
ORG="open-service-portal"
IMAGE_NAME="backstage"
BASE_TAG="dev-sqlite"

# Get git commit short SHA
GIT_SHA=$(git rev-parse --short HEAD)
DATE=$(date +%Y%m%d)

# Full image paths
IMAGE_BASE="${REGISTRY}/${ORG}/${IMAGE_NAME}"
IMAGE_SHA="${IMAGE_BASE}:${BASE_TAG}-${GIT_SHA}"
IMAGE_DATE="${IMAGE_BASE}:${BASE_TAG}-${DATE}"
IMAGE_LATEST="${IMAGE_BASE}:${BASE_TAG}-latest"

echo "🚀 Building Backstage image"
echo "================================================"
echo "Image tags:"
echo "  - ${IMAGE_SHA}"
echo "  - ${IMAGE_DATE}"
echo "  - ${IMAGE_LATEST}"
echo ""

echo "🔨 Building Backstage for Docker..."

# Install dependencies
echo "📦 Installing dependencies..."
yarn install --immutable

# tsc outputs type definitions to dist-types/ in the repo root, which are then consumed by the build
yarn tsc

# Build the backend, which bundles it all up into the packages/backend/dist folder.
echo "🏗️ Building backend..."
yarn build:backend

# Build the image
echo "📦 Building Docker image..."
docker image build . -f packages/backend/Dockerfile --tag ${IMAGE_SHA}

# Tag additional versions
docker tag ${IMAGE_SHA} ${IMAGE_DATE}
docker tag ${IMAGE_SHA} ${IMAGE_LATEST}

echo "✅ Build complete!"
echo "🐳 Now run: docker-push.sh"