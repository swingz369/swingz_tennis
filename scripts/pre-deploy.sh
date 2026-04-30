#!/bin/bash
# scripts/pre-deploy.sh
set -e

echo "🚀 Running Pre-Deployment Checks..."

# 1. Type Check
echo "🔍 TypeScript Type Check..."
npm run typecheck
if [ $? -ne 0 ]; then
  echo "❌ Type check failed!"
  exit 1
fi

# 2. Linting
echo "🔍 ESLint..."
npm run lint
if [ $? -ne 0 ]; then
  echo "❌ Linting failed!"
  exit 1
fi

# 3. Formatting
echo "🔍 Prettier..."
npm run format:check
if [ $? -ne 0 ]; then
  echo "❌ Formatting check failed!"
  exit 1
fi

# 4. Tests
echo "🧪 Running Tests..."
npm run test:unit
if [ $? -ne 0 ]; then
  echo "❌ Tests failed!"
  exit 1
fi

# 5. Build
echo "📦 Building..."
npm run build
if [ $? -ne 0 ]; then
  echo "❌ Build failed!"
  exit 1
fi

echo "✅ All checks passed! Ready to deploy."
