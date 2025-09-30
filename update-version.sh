#!/bin/bash
# update-version.sh - Automatisches Versions-Update Script mit Docker Build

# Get current version or start with 1.0.0
if [ -f "VERSION" ]; then
    # Remove Windows line endings and whitespace
    CURRENT_VERSION=$(cat VERSION | tr -d '\r\n' | xargs)
else
    CURRENT_VERSION="1.0.0"
fi

echo "Current version: $CURRENT_VERSION"

# Parse version numbers with better error handling
if [[ ! $CURRENT_VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "Invalid version format: $CURRENT_VERSION"
    echo "Setting to 1.0.0"
    CURRENT_VERSION="1.0.0"
fi

IFS='.' read -r -a version_parts <<< "$CURRENT_VERSION"
major="${version_parts[0]}"
minor="${version_parts[1]}"
patch="${version_parts[2]}"

# Increment patch version
patch=$((patch + 1))
NEW_VERSION="$major.$minor.$patch"

echo "New version: $NEW_VERSION"

# Update VERSION file (ensure Unix line endings)
echo -n "$NEW_VERSION" > VERSION

# Update frontend version.js
cat > public/version.js << EOF
// Version configuration for cache busting
window.APP_VERSION = '$NEW_VERSION';
window.BUILD_DATE = '$(date -Iseconds)';

// Cache busting utility
window.versionedUrl = function(path) {
  const separator = path.includes('?') ? '&' : '?';
  return \`\${path}\${separator}v=\${window.APP_VERSION}\`;
};

console.log(\`🚀 Dickerchen v\${window.APP_VERSION} (\${window.BUILD_DATE})\`);
EOF

# Update backend version
sed -i "s/version: '[^']*'/version: '$NEW_VERSION'/" backend/server.js

# Update service worker version (NO 'v' prefix to match other versions)
sed -i "s/const VERSION = '[^']*'/const VERSION = '$NEW_VERSION'/" public/sw.js

# Build Docker images with version tags
echo "🐳 Building Docker images..."

# Validate version format for Docker
if [[ ! $NEW_VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "❌ Invalid version format for Docker: $NEW_VERSION"
    exit 1
fi

# Build with specific version tag
echo "Building dickerchen:$NEW_VERSION..."
if docker build -t "dickerchen:$NEW_VERSION" .; then
    echo "✅ Built dickerchen:$NEW_VERSION"
else
    echo "❌ Failed to build dickerchen:$NEW_VERSION"
    exit 1
fi

# Tag as latest
if docker tag "dickerchen:$NEW_VERSION" "dickerchen:latest"; then
    echo "✅ Tagged as dickerchen:latest"
else
    echo "❌ Failed to tag as latest"
    exit 1
fi

# Optional: Build for production with date stamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
if docker tag "dickerchen:$NEW_VERSION" "dickerchen:prod-$TIMESTAMP"; then
    echo "✅ Tagged as dickerchen:prod-$TIMESTAMP"
else
    echo "❌ Failed to tag as production"
fi

echo "✅ Updated all files to version $NEW_VERSION"
echo ""
echo "Files updated:"
echo "- VERSION"
echo "- public/version.js" 
echo "- backend/server.js"
echo "- public/sw.js"
echo ""
echo "Docker images created:"
echo "- dickerchen:$NEW_VERSION"
echo "- dickerchen:latest"
echo "- dickerchen:prod-$TIMESTAMP"
echo ""
echo "Ready to commit and deploy!"
echo ""
echo "Next steps:"
echo "1. git add . && git commit -m '🚀 Release v$NEW_VERSION'"
echo "2. git push"
echo "3. Deploy to TrueNAS: ./deploy-to-truenas.sh"
