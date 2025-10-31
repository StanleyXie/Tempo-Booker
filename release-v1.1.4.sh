#!/bin/bash

# Tempo Booker v1.1.4 Release Script
# Run this script to publish the package to npm

set -e  # Exit on any error

echo "🚀 Tempo Booker v1.1.4 Release"
echo "=============================="
echo ""

# Check if logged in to npm
echo "📋 Step 1: Checking npm login status..."
if npm whoami > /dev/null 2>&1; then
    NPM_USER=$(npm whoami)
    echo "✅ Logged in as: $NPM_USER"
else
    echo "❌ Not logged in to npm"
    echo ""
    echo "Please run: npm login"
    echo "Then run this script again."
    exit 1
fi

echo ""
echo "📦 Step 2: Publishing to npm..."
echo "Package: tempo-booker@1.1.4"
echo "Size: 105.8 kB"
echo ""

# Ask for confirmation
read -p "Ready to publish? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Publish cancelled"
    exit 0
fi

# Check if 2FA is enabled
echo ""
echo "If you have 2FA enabled, you'll be prompted for your code..."
echo ""

# Publish to npm
if npm publish; then
    echo ""
    echo "✅ Successfully published tempo-booker@1.1.4 to npm!"
    echo ""

    # Push git changes
    echo "📤 Step 3: Pushing to GitHub..."
    if git push origin main --tags; then
        echo "✅ Successfully pushed to GitHub with tags"
    else
        echo "⚠️  Warning: Failed to push to GitHub. Run manually: git push origin main --tags"
    fi

    echo ""
    echo "🎉 Release Complete!"
    echo ""
    echo "Users can now install with:"
    echo "  npm install -g tempo-booker@1.1.4"
    echo ""
    echo "Or update existing installations:"
    echo "  npm update -g tempo-booker"
    echo ""

else
    echo ""
    echo "❌ Publish failed"
    echo "Check the error above and try again"
    exit 1
fi
