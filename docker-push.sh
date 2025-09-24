#!/bin/bash
set -e

echo "🚀 Pushing Docker images to GitHub Container Registry"
echo "====================================================="
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

# Get tags from file
if [ ! -f ".docker-tags" ]; then
    echo "❌ No .docker-tags file found!"
    echo "   Run ./docker-build.sh first"
    exit 1
fi

echo "📋 Reading tags from .docker-tags file..."
TAGS_TO_PUSH=$(cat .docker-tags)

echo ""
echo "📤 Images to push:"
echo "$TAGS_TO_PUSH" | sed 's/^/  - /'
echo ""

# Push each image tag
echo "📤 Pushing images..."
for TAG in $TAGS_TO_PUSH; do
    echo "  Pushing: ${TAG}"
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

# Clean up temporary files
if [ -f ".docker-tags" ]; then
    rm .docker-tags
fi