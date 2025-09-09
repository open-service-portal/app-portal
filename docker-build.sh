#!/bin/bash
set -e

# Configuration
REGISTRY="ghcr.io"
ORG="open-service-portal"
IMAGE_NAME="backstage"
BASE_TAG="dev-sqlite"

# Get git commit short SHA and date
GIT_SHA=$(git rev-parse --short HEAD)
DATE=$(date +%Y%m%d)

# Full image paths
IMAGE_BASE="${REGISTRY}/${ORG}/${IMAGE_NAME}"
IMAGE_SHA="${IMAGE_BASE}:${BASE_TAG}-${GIT_SHA}"
IMAGE_DATE="${IMAGE_BASE}:${BASE_TAG}-${DATE}"
IMAGE_LATEST="${IMAGE_BASE}:${BASE_TAG}-latest"

echo "🐳 Building Docker image..."
echo "=========================="
echo "Tags to be created:"
echo "  - ${IMAGE_SHA}"
echo "  - ${IMAGE_DATE}"
echo "  - ${IMAGE_LATEST}"
echo ""

# Check if backend is built
if [ ! -f "packages/backend/dist/bundle.tar.gz" ]; then
    echo "❌ Backend not built. Run ./build-backend.sh first!"
    exit 1
fi

# Build the Docker image for linux/amd64
echo "📦 Building image for linux/amd64..."
docker build . -f packages/backend/Dockerfile \
    --platform linux/amd64 \
    --tag ${IMAGE_SHA}

# Tag additional versions
echo "🏷️  Creating additional tags..."
docker tag ${IMAGE_SHA} ${IMAGE_DATE}
docker tag ${IMAGE_SHA} ${IMAGE_LATEST}

# Save the image tags to a file for the push script
echo "${IMAGE_SHA}" > .docker-tags
echo "${IMAGE_DATE}" >> .docker-tags
echo "${IMAGE_LATEST}" >> .docker-tags

echo ""
echo "✅ Docker image built and tagged!"
echo ""
echo "Tagged images:"
docker images --filter "reference=${IMAGE_BASE}:${BASE_TAG}-*" --format "  - {{.Repository}}:{{.Tag}}"
echo ""
echo "📝 Tags saved to .docker-tags for push script"
echo "🚀 To push: ./docker-push.sh"