#!/bin/sh
set -e

echo "Installing dependencies with pnpm..."
pnpm install --frozen-lockfile --ignore-scripts=false

echo "Hoisting argon2 native dependencies to top level..."
mkdir -p node_modules/node-gyp-build node_modules/node-addon-api node_modules/@phc

# Find and copy hoisted deps from pnpm virtual store
find node_modules/.pnpm -name "node-gyp-build" -type d 2>/dev/null | head -1 | xargs -I {} cp -r {}/. node_modules/node-gyp-build/ || true
find node_modules/.pnpm -name "node-addon-api" -type d 2>/dev/null | head -1 | xargs -I {} cp -r {}/. node_modules/node-addon-api/ || true
find node_modules/.pnpm -path "*/@phc/format*" -type d 2>/dev/null | head -1 | xargs -I {} cp -r {}/. node_modules/@phc/ || true

echo "Verifying hoisted dependencies..."
if [ -f "node_modules/node-gyp-build/package.json" ]; then
  echo "✓ node-gyp-build hoisted"
else
  echo "✗ node-gyp-build NOT hoisted - falling back to npm"
  npm install --no-save node-gyp-build node-addon-api
fi

echo "Dependencies ready"
