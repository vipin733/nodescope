# Publishing @nodescope/core to npm

This guide will walk you through publishing the NodeScope package to npm.

## ✅ Pre-Publishing Checklist

- [x] README.md created with comprehensive documentation
- [x] package.json updated with all metadata (version 0.1.0)
- [x] LICENSE file added (MIT)
- [x] .npmignore configured
- [x] Build successful
- [x] Package verified with `npm pack --dry-run`

## 📋 Publishing Steps

### 1. Login to npm

If you haven't logged in yet, run:

```bash
npm login
```

You'll be prompted for:
- Username
- Password
- Email
- One-time password (if 2FA is enabled)

To verify you're logged in:

```bash
npm whoami
```

### 2. Check for Package Name Availability

Before publishing, verify that the package name is available:

```bash
npm view @nodescope/core
```

If you get a 404 error, the name is available! If the package exists, you'll need to either:
- Use a different package name
- Request access if you own the scope

### 3. Build the Package

Ensure the package is built (already done):

```bash
cd /Users/vipin/Documents/www/nodescope/packages/core
npm run build
```

### 4. Test the Package Locally (Optional)

You can test the package locally before publishing:

```bash
# Create a tarball
npm pack

# In another project, install from the tarball
npm install /path/to/nodescope-core-0.1.0.tgz
```

### 5. Publish to npm

**For first-time publishing:**

```bash
cd /Users/vipin/Documents/www/nodescope/packages/core

# If using a scoped package (@nodescope), make it public
npm publish --access public
```

**For subsequent updates:**

```bash
# Just publish normally
npm publish
```

### 6. Verify the Publication

After publishing, verify it's available:

```bash
npm view @nodescope/core
```

Check the npm website:
https://www.npmjs.com/package/@nodescope/core

## 🔄 Version Management

NodeScope follows [Semantic Versioning](https://semver.org/):

- **MAJOR** version (1.0.0): Breaking changes
- **MINOR** version (0.1.0): New features, backwards compatible
- **PATCH** version (0.0.1): Bug fixes, backwards compatible

### Update Version

Use npm's built-in version commands:

```bash
# For a patch release (0.1.0 -> 0.1.1)
npm version patch

# For a minor release (0.1.0 -> 0.2.0)
npm version minor

# For a major release (0.1.0 -> 1.0.0)
npm version major

# For a specific version
npm version 0.2.0
```

These commands will:
1. Update version in package.json
2. Create a git commit
3. Create a git tag

### Publishing Updates

After bumping the version:

```bash
# Build
npm run build

# Publish
npm publish

# Push the tag to git
git push --follow-tags
```

## 🏷️ Publishing with Tags

You can publish pre-release versions with tags:

```bash
# Update to pre-release version
npm version 0.2.0-beta.1

# Publish with beta tag
npm publish --tag beta

# Users install with: npm install @nodescope/core@beta
```

**Available tags:**
- `latest` (default)
- `beta`
- `alpha`
- `next`

## 📊 Post-Publishing Checklist

After publishing, complete these tasks:

- [ ] Add repository URL in package.json (update `yourusername` to your actual GitHub username)
- [ ] Create GitHub repository if not exists
- [ ] Push code to GitHub
- [ ] Add badges to README (npm version, downloads, license)
- [ ] Create GitHub release matching npm version
- [ ] Tweet/share about the release
- [ ] Update project documentation
- [ ] Monitor npm downloads at https://npmtrends.com/@nodescope/core

## 🚀 Quick Publish Command

For future releases, use this workflow:

```bash
# Navigate to package
cd /Users/vipin/Documents/www/nodescope/packages/core

# Ensure you're on main branch and up to date
git checkout main
git pull

# Update version (patch/minor/major)
npm version patch -m "Release v%s"

# Build
npm run build

# Publish
npm publish

# Push changes and tags
git push --follow-tags
```

## 🔐 Security Best Practices

1. **Enable 2FA**: Always enable two-factor authentication on npm
   ```bash
   npm profile enable-2fa auth-and-writes
   ```

2. **Use npm tokens**: For CI/CD, use automation tokens
   ```bash
   npm token create
   ```

3. **Audit dependencies**: Regularly check for vulnerabilities
   ```bash
   npm audit
   npm audit fix
   ```

## 📝 Current Package Information

- **Name**: @nodescope/core
- **Version**: 0.1.0
- **Size**: 53.3 kB (packed)
- **Unpacked Size**: 245.1 kB
- **Total Files**: 16

## 🆘 Troubleshooting

### "Package name already exists"
- Change the package name or request access to the scope
- Or publish under your own username: `@yourusername/nodescope`

### "You must be logged in"
```bash
npm login
npm whoami  # Verify login
```

### "403 Forbidden"
- Enable public access: `npm publish --access public`
- Verify you have permission for the scope

### "Package already published"
- Bump the version: `npm version patch`
- You cannot republish the same version

## 🔗 Useful Links

- [npm Documentation](https://docs.npmjs.com/)
- [Semantic Versioning](https://semver.org/)
- [npm Package Naming Guidelines](https://docs.npmjs.com/cli/v8/configuring-npm/package-json#name)
- [Scoped Packages](https://docs.npmjs.com/cli/v8/using-npm/scope)

---

**Ready to publish?** Run the commands in the "Publishing Steps" section above! 🚀
