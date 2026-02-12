# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Planned features go here

### Changed
- Planned changes go here

### Fixed
- Planned fixes go here

## [0.2.0] - 2026-02-11

### Added
- **NestJS Support** 🎉
  - `NodeScopeModule` for dynamic module integration
  - `NodeScopeMiddleware` for request/response tracking
  - `NodeScopeInterceptor` as alternative to middleware
  - `NodeScopeController` for dashboard routes
  - `setupNodeScopeRoutes()` helper function
  - Support for both sync (`forRoot`) and async (`forRootAsync`) configuration
  - Full integration with NestJS dependency injection
  - Exception tracking with NestJS error handling
  - Complete NestJS example application in `examples/nestjs-app`

### Changed
- Updated README with comprehensive NestJS documentation
- Added `@nestjs/common` and `rxjs` as optional peer dependencies
- Updated build configuration to externalize NestJS and RxJS
- Enhanced keywords with `nestjs` for better npm discoverability

### Documentation
- Added NestJS quick start guide
- Added async configuration example with ConfigService
- Added interceptor usage example
- Documented both middleware and interceptor approaches

## [0.1.0] - 2026-02-11

### Added
- Initial release of @nodescope/core
- Request watcher for HTTP monitoring
- Query watcher for database query tracking
- Log watcher for application logs
- Exception watcher for error tracking
- Multiple storage backends: memory, SQLite, PostgreSQL, MySQL
- WebSocket support for real-time data streaming
- Express.js adapter and middleware
- Hono adapter and middleware
- Fastify adapter and plugin
- Comprehensive documentation and README
- TypeScript support with full type definitions
- ESM and CommonJS builds
- Unit tests with Vitest

### Features by Component

#### Core
- NodeScope class with flexible configuration
- Entry recording and retrieval system
- Storage abstraction layer
- WebSocket broadcasting

#### Adapters
- Express middleware with route mounting
- Hono middleware for Bun/Node
- Fastify plugin support

#### Storage
- In-memory storage with LRU eviction
- SQLite storage with persistence
- PostgreSQL storage with connection pooling
- MySQL storage with connection pooling

#### Watchers
- Request/Response tracking
- Database query monitoring
- Log capture and forwarding
- Exception tracking with stack traces

## Version Guidelines

We use [Semantic Versioning](https://semver.org/):

- **MAJOR** (x.0.0): Breaking changes that require user action
- **MINOR** (0.x.0): New features, backwards compatible
- **PATCH** (0.0.x): Bug fixes, backwards compatible

### Examples

- `0.1.0 -> 0.1.1`: Bug fix
- `0.1.0 -> 0.2.0`: New feature (e.g., Redis cache watcher)
- `0.1.0 -> 1.0.0`: Breaking change (e.g., API redesign)

## How to Update This File

When preparing a release:

1. Move items from `[Unreleased]` to a new version section
2. Add the release date in YYYY-MM-DD format
3. Update the version links at the bottom
4. Commit the changes with the version bump

## Links

- [npm package](https://www.npmjs.com/package/@nodescope/core)
- [GitHub repository](https://github.com/yourusername/nodescope)
- [Issues](https://github.com/yourusername/nodescope/issues)

[Unreleased]: https://github.com/yourusername/nodescope/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/yourusername/nodescope/releases/tag/v0.1.0
