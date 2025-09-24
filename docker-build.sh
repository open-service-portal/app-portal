#!/bin/bash
set -e

# Configuration
REGISTRY="ghcr.io"
ORG="open-service-portal"
IMAGE_NAME="app-portal"
BASE_TAG="dev-sqlite"

# Platform parameter - defaults to current platform if not specified
PLATFORM=${1:-$(docker version --format '{{.Server.Os}}/{{.Server.Arch}}')}
if [ -z "$PLATFORM" ]; then
    # Fallback to detecting platform manually
    PLATFORM="linux/$(uname -m | sed 's/x86_64/amd64/' | sed 's/aarch64/arm64/')"
fi

# Get git commit short SHA and datetime
GIT_SHA=$(git rev-parse --short HEAD)
DATETIME=$(date +%Y%m%d%H%M)

# Full image paths
IMAGE_BASE="${REGISTRY}/${ORG}/${IMAGE_NAME}"
IMAGE_SHA="${IMAGE_BASE}:${BASE_TAG}-${GIT_SHA}"
IMAGE_DATETIME="${IMAGE_BASE}:${BASE_TAG}-${DATETIME}"
IMAGE_LATEST="${IMAGE_BASE}:${BASE_TAG}-latest"

echo "🐳 Building Docker image..."
echo "=========================="
echo "Tags to be created:"
echo "  - ${IMAGE_SHA}"
echo "  - ${IMAGE_DATETIME}"
echo "  - ${IMAGE_LATEST}"
echo ""

# Check if backend is built
if [ ! -f "packages/backend/dist/bundle.tar.gz" ]; then
    echo "❌ Backend not built. Run ./build-backend.sh first!"
    exit 1
fi

# Build the Docker image for specified platform
echo "📦 Building image for ${PLATFORM}..."
docker build . -f packages/backend/Dockerfile \
    --platform ${PLATFORM} \
    --tag ${IMAGE_SHA}

# Tag additional versions
echo "🏷️  Creating additional tags..."
docker tag ${IMAGE_SHA} ${IMAGE_DATETIME}
docker tag ${IMAGE_SHA} ${IMAGE_LATEST}

# Save the image tags to a file for the push script
echo "${IMAGE_SHA}" > .docker-tags
echo "${IMAGE_DATETIME}" >> .docker-tags
echo "${IMAGE_LATEST}" >> .docker-tags

echo ""
echo "✅ Docker image built and tagged!"
echo ""
echo "Tagged images:"
docker images --filter "reference=${IMAGE_BASE}:${BASE_TAG}-*" --format "  - {{.Repository}}:{{.Tag}}"
echo ""
echo "📝 Tags saved to .docker-tags for push script"
echo "🚀 To push: ./docker-push.sh"