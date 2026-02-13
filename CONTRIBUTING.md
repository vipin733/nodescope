# Contributing to NodeScope

Thank you for your interest in contributing to NodeScope! This document provides guidelines and instructions for contributing.

## Development Setup

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/vipin733/nodescope.git
   cd nodescope
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the package**
   ```bash
   npm run build
   ```

4. **Run tests**
   ```bash
   npm test
   ```

## Branch Strategy

We follow a GitFlow-inspired branching model:

### Main Branches
- **`main`**: Production-ready code. Only accepts merges from `develop` or `hotfix/*` branches.
- **`develop`**: Integration branch for features. This is the default development branch.

### Supporting Branches
- **`feature/*`**: New features (e.g., `feature/add-redis-adapter`)
- **`bugfix/*`**: Bug fixes for the develop branch
- **`hotfix/*`**: Urgent fixes for production (branches from `main`)
- **`release/*`**: Release preparation (e.g., `release/v0.3.0`)

## Workflow

### Adding a New Feature

1. **Create a feature branch from `develop`**
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Write tests for new functionality
   - Update documentation
   - Follow the code style

3. **Commit your changes**
   We use [Conventional Commits](https://www.conventionalcommits.org/):
   ```bash
   git commit -m "feat: add Redis cache adapter"
   git commit -m "fix: resolve middleware context issue"
   git commit -m "docs: update NestJS integration guide"
   ```

   **Types:**
   - `feat`: New feature
   - `fix`: Bug fix
   - `docs`: Documentation changes
   - `style`: Code style changes (formatting, etc.)
   - `refactor`: Code refactoring
   - `test`: Adding or updating tests
   - `chore`: Build process or tool changes

4. **Push and create a Pull Request**
   ```bash
   git push origin feature/your-feature-name
   ```
   Then create a PR to `develop` on GitHub.

### Fixing a Bug

1. **For non-urgent bugs**, follow the feature workflow but use `bugfix/*`:
   ```bash
   git checkout -b bugfix/fix-description
   ```

2. **For urgent production bugs**, create a hotfix from `main`:
   ```bash
   git checkout main
   git checkout -b hotfix/critical-fix
   ```
   After fixing, merge to both `main` and `develop`.

## Pull Request Guidelines

- **Target**: PRs should target the `develop` branch (unless it's a hotfix)
- **Title**: Use conventional commit format (e.g., `feat: add PostgreSQL support`)
- **Description**: Clearly describe what changes were made and why
- **Tests**: Include tests for new features or bug fixes
- **Documentation**: Update README or docs if adding new features
- **Size**: Keep PRs focused and reasonably sized

### PR Checklist
- [ ] Code follows the project's style guidelines
- [ ] Tests pass locally (`npm test`)
- [ ] New tests added for new features
- [ ] Documentation updated
- [ ] Commit messages follow conventional commits
- [ ] No merge conflicts with target branch

## Code Style

- Use TypeScript for all code
- Follow existing code patterns
- Use meaningful variable and function names
- Add JSDoc comments for public APIs
- Keep functions small and focused

## Testing

- Write unit tests for new functionality
- Maintain or improve test coverage
- Test across supported Node.js versions (18, 20, 22)
- Include integration tests for adapters

Run tests:
```bash
npm test                    # Run all tests
npm run test:watch          # Watch mode
npm run test:coverage       # With coverage
```

## Documentation

- Update README.md for new features
- Add JSDoc comments for public APIs
- Update CHANGELOG.md following the existing format
- Include code examples in documentation

## Release Process

Releases are handled by maintainers:

1. Create a `release/*` branch from `develop`
2. Update version in `package.json`
3. Update CHANGELOG.md
4. Merge to `main` and tag
5. GitHub Actions automatically publishes to npm

## Questions?

- Open an issue for questions
- Check existing issues and PRs first
- Be respectful and constructive

Thank you for contributing! 🎉
