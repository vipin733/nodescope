# Release Process

This document outlines the release process for NodeScope.

## Versioning

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR** version (X.0.0): Breaking changes
- **MINOR** version (0.X.0): New features, backward compatible
- **PATCH** version (0.0.X): Bug fixes, backward compatible

## Release Workflow

### 1. Prepare Release Branch

```bash
# Ensure develop is up to date
git checkout develop
git pull origin develop

# Create release branch
git checkout -b release/vX.Y.Z
```

### 2. Update Version and Changelog

```bash
# Update version in package.json (packages/core)
cd packages/core
npm version major|minor|patch --no-git-tag-version

# Update CHANGELOG.md
# Add release date and version
# Organize changes into: Added, Changed, Fixed, Removed
```

**Example CHANGELOG entry:**
```markdown
## [0.3.0] - 2026-02-15

### Added
- Redis cache adapter
- Query builder integration

### Fixed
- WebSocket reconnection issue
```

### 3. Test the Release

```bash
# Build
npm run build

# Run all tests
npm test

# Test examples
cd examples/nestjs-app
npm install
npm run build
```

### 4. Commit Changes

```bash
git add .
git commit -m "chore: prepare release v0.3.0"
git push origin release/v0.3.0
```

### 5. Merge to Main

Create a PR from `release/v0.3.0` to `main`:

1. Review all changes
2. Ensure CI passes
3. Merge the PR (use "Create a merge commit")

### 6. Create GitHub Release

1. Go to **Releases** → **Draft a new release**
2. Click **Choose a tag** → Create new tag: `v0.3.0`
3. Target: `main` branch
4. Release title: `v0.3.0`
5. Description: Copy from CHANGELOG.md
6. Check **Set as the latest release**
7. Click **Publish release**

This will automatically trigger the `publish.yml` workflow to publish to npm.

### 7. Merge Back to Develop

```bash
git checkout develop
git merge main
git push origin develop
```

### 8. Verify Publication

Check that the package was published:

```bash
npm info @vipin733/nodescope
```

Verify the version and publish date.

## Hotfix Process

For urgent production fixes:

```bash
# Create hotfix from main
git checkout main
git pull origin main
git checkout -b hotfix/v0.2.1

# Make the fix
# Update version (patch)
# Update CHANGELOG

# Commit and test
git add .
git commit -m "fix: critical bug description"

# Merge to main
# Create release (follow steps 6-7 above)

# Merge to develop
git checkout develop
git merge hotfix/v0.2.1
git push origin develop
```

## Pre-release (Beta/RC)

For beta or release candidate versions:

```bash
# Update version with prerelease tag
npm version prerelease --preid=beta

# Example: 0.3.0-beta.0
```

When creating the GitHub release, check **Set as a pre-release**.

## Checklist

Before releasing, ensure:

- [ ] All tests pass
- [ ] Documentation is updated
- [ ] CHANGELOG.md is updated
- [ ] Version is bumped correctly
- [ ] Examples work with new version
- [ ] Breaking changes are clearly documented
- [ ] CI/CD pipeline is green

## Secrets Configuration

### NPM_TOKEN

The GitHub Actions workflow requires an npm token:

1. Generate token at npmjs.com → Access Tokens → Generate New Token
2. Type: **Automation**
3. Add to GitHub: Settings → Secrets and variables → Actions
4. Name: `NPM_TOKEN`
5. Paste token value

## Rollback

If a release has issues:

1. Publish a new patch version with the fix
2. **Do not** delete tags or unpublish from npm (breaks downstream)
3. Document the issue in CHANGELOG

## Questions?

Contact the maintainers or open an issue.
