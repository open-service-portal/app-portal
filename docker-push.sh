#!/bin/bash
set -e

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

echo "🚀 Building and pushing Backstage image (SQLite testing version)"
echo "================================================"
echo "Image tags:"
echo "  - ${IMAGE_SHA}"
echo "  - ${IMAGE_DATE}"
echo "  - ${IMAGE_LATEST}"
echo ""

# Check if already logged in to GitHub Container Registry
echo "🔐 Checking GitHub Container Registry login..."
if ! docker login ghcr.io > /dev/null 2>&1; then
    echo "Not logged in to ghcr.io"
    echo ""
    echo "📝 To login, you need a Personal Access Token (classic) with these scopes:"
    echo "   - read:packages"
    echo "   - write:packages"
    echo "   - delete:packages (optional, for cleanup)"
    echo ""
    echo "Create one at: https://github.com/settings/tokens"
    echo ""
    echo "Then login with:"
    echo "  echo \$GITHUB_TOKEN | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin"
    echo ""
    exit 1
else
    echo "✅ Already logged in to ghcr.io"
fi

# Push all tags
echo "📤 Pushing images to registry..."
docker push ${IMAGE_SHA}
docker push ${IMAGE_DATE}
docker push ${IMAGE_LATEST}

echo ""
echo "✅ Successfully pushed images!"
echo ""
echo "📝 To deploy to Kubernetes, use:"
echo "  ${IMAGE_SHA}"
echo ""
echo "Or in your Kubernetes manifest:"
echo "  image: ${IMAGE_SHA}"