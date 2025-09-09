#!/bin/bash
set -e

echo "🔨 Building Backstage backend..."
echo "================================"

# Install dependencies
echo "📦 Installing dependencies..."
yarn install --immutable

# Run TypeScript compiler for type definitions
echo "📝 Compiling TypeScript..."
yarn tsc

# Build the backend
echo "🏗️  Building backend..."
yarn build:backend

echo ""
echo "✅ Backend build complete!"
echo "📦 Output: packages/backend/dist/"