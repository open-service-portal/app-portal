#!/bin/bash
set -e

# Configuration
REGISTRY="ghcr.io"
ORG="open-service-portal"
IMAGE_NAME="backstage"
BASE_TAG="dev-sqlite"
IMAGE_BASE="${REGISTRY}/${ORG}/${IMAGE_NAME}"

echo "🚀 Pushing Docker images to GitHub Container Registry"
echo "===================================================="

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

# Try to get tags from file first, then from Docker
if [ -f ".docker-tags" ]; then
    echo "📋 Reading tags from .docker-tags file..."
    TAGS_TO_PUSH=$(cat .docker-tags)
else
    echo "🔍 Looking for tagged images in Docker..."
    # Get all images matching our pattern
    TAGS_TO_PUSH=$(docker images --filter "reference=${IMAGE_BASE}:${BASE_TAG}-*" --format "{{.Repository}}:{{.Tag}}" | head -3)
    
    if [ -z "$TAGS_TO_PUSH" ]; then
        echo "❌ No images found to push!"
        echo "   Run ./docker-build.sh first to build and tag images"
        exit 1
    fi
fi

echo ""
echo "📤 Images to push:"
echo "$TAGS_TO_PUSH" | sed 's/^/  - /'
echo ""

# Push each tag
for TAG in $TAGS_TO_PUSH; do
    echo "Pushing ${TAG}..."
    docker push ${TAG}
done

echo ""
echo "✅ Successfully pushed all images!"
echo ""
echo "📝 To deploy to Kubernetes, use one of these images:"
echo "$TAGS_TO_PUSH" | sed 's/^/  - /'

# Update .env.kubernetes if it exists
if [ -f ".env.kubernetes" ]; then
    echo ""
    echo "📝 Updating .env.kubernetes with latest image..."
    
    # Get the first (most recent) tag
    LATEST_IMAGE=$(echo "$TAGS_TO_PUSH" | head -1)
    
    # Update DOCKER_IMAGE in .env.kubernetes
    if grep -q "^export DOCKER_IMAGE=" .env.kubernetes; then
        # Update existing line
        sed -i.bak "s|^export DOCKER_IMAGE=.*|export DOCKER_IMAGE=${LATEST_IMAGE}|" .env.kubernetes
        rm .env.kubernetes.bak
        echo "✅ Updated DOCKER_IMAGE in .env.kubernetes to: ${LATEST_IMAGE}"
    else
        # Add if not present
        echo "export DOCKER_IMAGE=${LATEST_IMAGE}" >> .env.kubernetes
        echo "✅ Added DOCKER_IMAGE to .env.kubernetes: ${LATEST_IMAGE}"
    fi
fi

# Clean up tags file
if [ -f ".docker-tags" ]; then
    rm .docker-tags
fi