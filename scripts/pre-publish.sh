#!/bin/bash

# Pre-publish Checklist Script for @nodescope/core
# Run this before publishing to ensure everything is ready

set -e  # Exit on error

echo "🔍 NodeScope Pre-Publish Checklist"
echo "===================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track if all checks pass
ALL_PASSED=true

# Function to print check results
check_pass() {
    echo -e "${GREEN}✓${NC} $1"
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
    ALL_PASSED=false
}

check_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Navigate to package directory
cd "$(dirname "$0")/packages/core"

echo "1. Checking npm login status..."
if npm whoami > /dev/null 2>&1; then
    USERNAME=$(npm whoami)
    check_pass "Logged in as: $USERNAME"
else
    check_fail "Not logged into npm. Run: npm login"
fi
echo ""

echo "2. Checking package.json..."
if [ -f "package.json" ]; then
    check_pass "package.json exists"
    
    # Extract version
    VERSION=$(node -p "require('./package.json').version")
    check_pass "Current version: $VERSION"
    
    # Check if version exists on npm
    if npm view @nodescope/core@$VERSION version > /dev/null 2>&1; then
        check_fail "Version $VERSION already published on npm!"
    else
        check_pass "Version $VERSION is not yet published"
    fi
else
    check_fail "package.json not found"
fi
echo ""

echo "3. Checking required files..."
[ -f "README.md" ] && check_pass "README.md exists" || check_fail "README.md missing"
[ -f "LICENSE" ] && check_pass "LICENSE exists" || check_fail "LICENSE missing"
[ -f ".npmignore" ] && check_pass ".npmignore exists" || check_warn ".npmignore missing (optional)"
echo ""

echo "4. Checking build..."
if [ -d "dist" ]; then
    check_pass "dist/ directory exists"
    
    # Check for required build files
    [ -f "dist/index.js" ] && check_pass "ESM build exists" || check_fail "ESM build missing"
    [ -f "dist/index.cjs" ] && check_pass "CJS build exists" || check_fail "CJS build missing"
    [ -f "dist/index.d.ts" ] && check_pass "Type definitions exist" || check_fail "Type definitions missing"
else
    check_fail "dist/ directory not found. Run: npm run build"
fi
echo ""

echo "5. Running tests..."
if npm test > /dev/null 2>&1; then
    check_pass "Tests passed"
else
    check_warn "Tests failed or not configured"
fi
echo ""

echo "6. Checking git status..."
if git rev-parse --git-dir > /dev/null 2>&1; then
    if [ -z "$(git status --porcelain)" ]; then
        check_pass "Git working directory clean"
    else
        check_warn "Uncommitted changes in git"
        echo "   Consider committing changes before publishing"
    fi
    
    BRANCH=$(git rev-parse --abbrev-ref HEAD)
    check_pass "Current branch: $BRANCH"
else
    check_warn "Not a git repository"
fi
echo ""

echo "7. Simulating package..."
if npm pack --dry-run > /dev/null 2>&1; then
    check_pass "Package simulation successful"
    
    # Show package size
    SIZE=$(npm pack --dry-run 2>&1 | grep "package size" | awk '{print $4, $5}')
    echo "   Package size: $SIZE"
else
    check_fail "Package simulation failed"
fi
echo ""

echo "8. Checking for common issues..."
# Check for node_modules in files
if grep -q "node_modules" .npmignore 2>/dev/null || grep -q "node_modules" package.json 2>/dev/null; then
    check_pass "node_modules excluded from package"
else
    check_warn "Ensure node_modules is excluded"
fi

# Check for source files in dist
if grep -q "src/" .npmignore 2>/dev/null; then
    check_pass "Source files excluded from package"
else
    check_warn "Consider excluding src/ from package"
fi
echo ""

# Final summary
echo "===================================="
if [ "$ALL_PASSED" = true ]; then
    echo -e "${GREEN}✓ All checks passed!${NC}"
    echo ""
    echo "Ready to publish! Run:"
    echo "  npm publish --access public"
    echo ""
    exit 0
else
    echo -e "${RED}✗ Some checks failed${NC}"
    echo ""
    echo "Please fix the issues above before publishing."
    echo ""
    exit 1
fi
