// Main exports
export { NodeScope, getNodeScope, initNodeScope } from './nodescope.js';

// Types
export type {
  EntryType,
  LogLevel,
  CacheOperation,
  JobStatus,
  HttpMethod,
  Entry,
  RequestEntryContent,
  QueryEntryContent,
  CacheEntryContent,
  LogEntryContent,
  ExceptionEntryContent,
  HttpClientEntryContent,
  EventEntryContent,
  JobEntryContent,
  ScheduleEntryContent,
  DumpEntryContent,
  StorageDriver,
  WatcherConfig,
  RequestWatcherOptions,
  QueryWatcherOptions,
  CacheWatcherOptions,
  LogWatcherOptions,
  ExceptionWatcherOptions,
  HttpClientWatcherOptions,
  EventWatcherOptions,
  JobWatcherOptions,
  ScheduleWatcherOptions,
  NodeScopeConfig,
  ListOptions,
  PaginatedResult,
  StorageStats,
} from './types.js';

// Storage
export {
  StorageAdapter,
  createStorageAdapter,
  MemoryStorage,
  SQLiteStorage,
  PostgreSQLStorage,
  MySQLStorage,
} from './storage/index.js';

// Watchers
export {
  BaseWatcher,
  RequestContext,
  createRequestContext,
  getDuration,
  getMemoryDelta,
  RequestWatcher,
  QueryWatcher,
  wrapPrisma,
  createQueryInterceptor,
  CacheWatcher,
  createCacheWrapper,
  LogWatcher,
  interceptConsole,
  ExceptionWatcher,
  setupGlobalErrorHandlers,
  HttpClientWatcher,
  wrapFetch,
  interceptFetch,
  EventWatcher,
  TrackedEventEmitter,
  JobWatcher,
  wrapJobProcessor,
} from './watchers/index.js';

// Server
export { ApiHandler, RealTimeServer } from './server/index.js';

// Adapters
export {
  // Express
  createExpressMiddleware,
  mountExpressRoutes,
  attachWebSocket,
  // Hono
  createHonoMiddleware,
  nodescope,
  createHonoDashboardRoutes,
  // Fastify
  fastifyNodeScope,
  // NestJS
  NodeScopeModule,
  NodeScopeMiddleware,
  NodeScopeInterceptor,
  NodeScopeController,
  setupNodeScopeRoutes,
} from './adapters/index.js';

// Dashboard
export { getDashboardHtml } from './dashboard/index.js';
