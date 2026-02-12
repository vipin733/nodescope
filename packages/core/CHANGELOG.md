# Changelog

All notable changes to this project will be documented in this file.

## [0.2.0] - 2026-02-12

### Added
- **NestJS Support**: Full integration with NestJS framework
  - `NodeScopeModule` with `forRoot()` and `forRootAsync()` configuration
  - `NodeScopeMiddleware` for request/response tracking
  - `NodeScopeInterceptor` as alternative to middleware
  - `NodeScopeController` for dashboard routes
  - `setupNodeScopeRoutes()` helper function
  - Real-time WebSocket updates for NestJS applications
  - Proper dependency injection support
  - Example NestJS application

### Changed
- Added `@nestjs/common` and `rxjs` as optional peer dependencies
- Updated build configuration to externalize NestJS dependencies
- Enhanced README with NestJS examples and documentation
- Improved middleware error handling

### Fixed
- Middleware dependency injection in NestJS
- WebSocket real-time broadcasting in NestJS
- Request context tracking in async callbacks

## [0.1.0] - 2026-02-01

### Added
- Initial release
- Support for Express, Hono, and Fastify
- Request/Response tracking
- Query monitoring
- Cache monitoring
- Log tracking
- Exception handling
- HTTP client tracking
- Event monitoring
- Job/background task monitoring
- Multiple storage adapters (Memory, SQLite, PostgreSQL, MySQL)
- Dashboard UI
- WebSocket real-time updates
- API for programmatic access
