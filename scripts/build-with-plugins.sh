#!/bin/bash

# Build script for Backstage with internal plugins
# This script ensures correct build order to avoid circular dependency issues

set -e

echo "🔨 Building Backstage with internal plugins..."
echo ""

# Step 1: Clean previous builds (optional, uncomment if needed)
# echo "🧹 Cleaning previous builds..."
# yarn clean

# Step 2: Build internal plugins first
echo "📦 Building internal plugins..."
echo "  Building @internal/plugin-kubernetes-ingestor..."

# Compile TypeScript for the plugin first
yarn workspace @internal/plugin-kubernetes-ingestor tsc

# Then build the plugin
yarn workspace @internal/plugin-kubernetes-ingestor build

echo "✅ Plugin build complete"
echo ""

# Step 3: Run full TypeScript check
echo "🔍 Running TypeScript check..."
yarn tsc

echo "✅ TypeScript check complete"
echo ""

# Step 4: Build backend (which depends on the plugins)
echo "🚀 Building backend..."
yarn workspace backend build

echo "✅ Backend build complete"
echo ""

# Step 5: Optional - Build everything else
if [ "$1" == "--all" ]; then
  echo "🏗️  Building all packages..."
  yarn build:all
  echo "✅ Full build complete"
fi

echo ""
echo "✨ Build successful! Ready to start with 'yarn start'"