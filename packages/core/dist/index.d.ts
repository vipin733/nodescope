import * as http from 'http';
import { RequestHandler } from 'express';
import { Hono, MiddlewareHandler } from 'hono';
import { ExecutionContext, CallHandler, NestMiddleware, DynamicModule } from '@nestjs/common';
import { Observable } from 'rxjs';

/**
 * Entry types that NodeScope can capture and display
 */
type EntryType = 'request' | 'query' | 'cache' | 'log' | 'exception' | 'http_client' | 'event' | 'job' | 'schedule' | 'dump';
/**
 * Log levels for the log watcher
 */
type LogLevel = 'debug' | 'info' | 'warn' | 'error';
/**
 * Cache operations
 */
type CacheOperation = 'get' | 'set' | 'delete' | 'hit' | 'miss' | 'flush';
/**
 * Job status
 */
type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';
/**
 * HTTP methods
 */
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
/**
 * Base entry that all captured data extends
 */
interface Entry {
    /** Unique identifier for this entry */
    id: string;
    /** Batch ID to group related entries (e.g., all entries from one request) */
    batchId: string;
    /** Type of entry */
    type: EntryType;
    /** Entry-specific content */
    content: Record<string, unknown>;
    /** Searchable tags */
    tags: string[];
    /** When this entry was created */
    createdAt: Date;
    /** Duration in milliseconds (if applicable) */
    duration?: number;
    /** Memory usage in bytes (if applicable) */
    memoryUsage?: number;
}
interface RequestEntryContent {
    method: HttpMethod;
    url: string;
    path: string;
    query: Record<string, string | string[]>;
    headers: Record<string, string>;
    body?: unknown;
    ip?: string;
    userAgent?: string;
    session?: Record<string, unknown>;
    response: {
        status: number;
        headers: Record<string, string>;
        body?: unknown;
        size?: number;
    };
    middleware?: string[];
    controllerAction?: string;
}
interface QueryEntryContent {
    sql: string;
    bindings: unknown[];
    connection: string;
    database?: string;
    slow: boolean;
    rowCount?: number;
}
interface CacheEntryContent {
    key: string;
    value?: unknown;
    operation: CacheOperation;
    driver: string;
    ttl?: number;
    tags?: string[];
}
interface LogEntryContent {
    level: LogLevel;
    message: string;
    context?: Record<string, unknown>;
    channel?: string;
}
interface ExceptionEntryContent {
    class: string;
    message: string;
    stack: string;
    file?: string;
    line?: number;
    context?: Record<string, unknown>;
    previous?: ExceptionEntryContent;
}
interface HttpClientEntryContent {
    method: HttpMethod;
    url: string;
    headers: Record<string, string>;
    body?: unknown;
    response: {
        status: number;
        headers: Record<string, string>;
        body?: unknown;
        size?: number;
    };
}
interface EventEntryContent {
    name: string;
    payload: unknown;
    listeners: string[];
    broadcast?: {
        channel: string;
        event: string;
    };
}
interface JobEntryContent {
    name: string;
    queue: string;
    data: unknown;
    status: JobStatus;
    attempts: number;
    maxAttempts?: number;
    error?: string;
}
interface ScheduleEntryContent {
    command: string;
    description?: string;
    expression: string;
    output?: string;
    exitCode?: number;
}
interface DumpEntryContent {
    dump: unknown;
    file?: string;
    line?: number;
}
type StorageDriver = 'memory' | 'sqlite' | 'postgresql' | 'mysql';
interface WatcherConfig {
    request?: boolean | RequestWatcherOptions;
    query?: boolean | QueryWatcherOptions;
    cache?: boolean | CacheWatcherOptions;
    log?: boolean | LogWatcherOptions;
    exception?: boolean | ExceptionWatcherOptions;
    httpClient?: boolean | HttpClientWatcherOptions;
    event?: boolean | EventWatcherOptions;
    job?: boolean | JobWatcherOptions;
    schedule?: boolean | ScheduleWatcherOptions;
    dump?: boolean;
}
interface RequestWatcherOptions {
    enabled?: boolean;
    /** Maximum response body size to capture (in KB) */
    sizeLimit?: number;
    /** Paths to ignore */
    ignorePaths?: string[];
    /** Whether to capture request body */
    captureBody?: boolean;
    /** Whether to capture response body */
    captureResponse?: boolean;
    /** Headers to hide from capture */
    hideHeaders?: string[];
}
interface QueryWatcherOptions {
    enabled?: boolean;
    /** Threshold in ms to mark a query as slow */
    slowThreshold?: number;
}
interface CacheWatcherOptions {
    enabled?: boolean;
}
interface LogWatcherOptions {
    enabled?: boolean;
    /** Minimum log level to capture */
    level?: LogLevel;
}
interface ExceptionWatcherOptions {
    enabled?: boolean;
}
interface HttpClientWatcherOptions {
    enabled?: boolean;
    /** Maximum response body size to capture (in KB) */
    sizeLimit?: number;
}
interface EventWatcherOptions {
    enabled?: boolean;
    /** Events to ignore */
    ignore?: string[];
}
interface JobWatcherOptions {
    enabled?: boolean;
}
interface ScheduleWatcherOptions {
    enabled?: boolean;
}
/**
 * Main NodeScope configuration
 */
interface NodeScopeConfig {
    /** Enable or disable NodeScope */
    enabled?: boolean;
    /** Storage driver to use */
    storage?: StorageDriver;
    /** Database connection URL (for sqlite, postgresql, mysql) */
    databaseUrl?: string;
    /** Path where the dashboard will be served */
    dashboardPath?: string;
    /** Watcher configurations */
    watchers?: WatcherConfig;
    /** Enable real-time WebSocket updates */
    realtime?: boolean;
    /** Prune entries older than this many hours */
    pruneAfterHours?: number;
    /** Custom authorization check for dashboard access */
    authorization?: (req: unknown) => boolean | Promise<boolean>;
    /** Callback to filter entries before recording */
    filter?: (entry: Entry) => boolean;
    /** Callback to add custom tags to entries */
    tag?: (entry: Entry) => string[];
}
interface ListOptions {
    type?: EntryType;
    batchId?: string;
    tags?: string[];
    search?: string;
    before?: Date;
    after?: Date;
    limit?: number;
    offset?: number;
}
interface PaginatedResult<T> {
    data: T[];
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
}
interface StorageStats {
    totalEntries: number;
    entriesByType: Record<EntryType, number>;
    oldestEntry?: Date;
    newestEntry?: Date;
    storageSize?: number;
}

/**
 * Abstract storage adapter interface.
 * All storage implementations must implement this interface.
 */
interface StorageAdapter {
    /** Initialize the storage (create tables, etc.) */
    initialize(): Promise<void>;
    /** Save a single entry */
    save(entry: Entry): Promise<void>;
    /** Save multiple entries in a batch */
    saveBatch(entries: Entry[]): Promise<void>;
    /** Find an entry by ID */
    find(id: string): Promise<Entry | null>;
    /** List entries with filtering and pagination */
    list(options?: ListOptions): Promise<PaginatedResult<Entry>>;
    /** Get entries by batch ID */
    findByBatch(batchId: string): Promise<Entry[]>;
    /** Prune entries older than the given date */
    prune(beforeDate: Date): Promise<number>;
    /** Clear all entries */
    clear(): Promise<void>;
    /** Get storage statistics */
    stats(): Promise<StorageStats>;
    /** Close connections (cleanup) */
    close(): Promise<void>;
}
/**
 * Create a storage adapter based on configuration
 */
declare function createStorageAdapter(driver: string, options?: {
    databaseUrl?: string;
}): Promise<StorageAdapter>;

/**
 * Base class for all watchers.
 * Provides common functionality for creating entries.
 */
declare abstract class BaseWatcher<TContent = unknown> {
    /** The type of entries this watcher creates */
    abstract readonly type: EntryType;
    /** Whether this watcher is enabled */
    enabled: boolean;
    /**
     * Create an entry from captured data
     */
    protected createEntry(content: TContent, options?: {
        batchId?: string;
        tags?: string[];
        duration?: number;
        memoryUsage?: number;
    }): Entry;
    /**
     * Optional filter to exclude certain entries
     */
    filter?(entry: Entry): boolean;
    /**
     * Optional callback to add custom tags
     */
    tag?(entry: Entry): string[];
}
/**
 * Context passed through the request lifecycle
 */
interface RequestContext {
    batchId: string;
    startTime: number;
    startMemory?: number;
}
/**
 * Create a new request context
 */
declare function createRequestContext(): RequestContext;
/**
 * Calculate duration from request context
 */
declare function getDuration(ctx: RequestContext): number;
/**
 * Calculate memory delta from request context
 */
declare function getMemoryDelta(ctx: RequestContext): number | undefined;

/**
 * Request watcher - captures HTTP requests and responses
 */
declare class RequestWatcher extends BaseWatcher<RequestEntryContent> {
    readonly type: "request";
    private options;
    constructor(options?: RequestWatcherOptions);
    /**
     * Record a request/response pair
     */
    record(data: {
        batchId: string;
        startTime: number;
        method: string;
        url: string;
        path: string;
        query: Record<string, string | string[]>;
        headers: Record<string, string>;
        body?: unknown;
        ip?: string;
        userAgent?: string;
        session?: Record<string, unknown>;
        response: {
            status: number;
            headers: Record<string, string>;
            body?: unknown;
        };
        middleware?: string[];
        controllerAction?: string;
    }): Entry | null;
    private filterHeaders;
    private truncateBody;
    private getBodySize;
    private generateTags;
}

/**
 * Query watcher - captures database queries
 */
declare class QueryWatcher extends BaseWatcher<QueryEntryContent> {
    readonly type: "query";
    private slowThreshold;
    constructor(options?: QueryWatcherOptions);
    /**
     * Record a database query
     */
    record(data: {
        batchId?: string;
        sql: string;
        bindings?: unknown[];
        connection?: string;
        database?: string;
        duration: number;
        rowCount?: number;
    }): Entry;
    private extractQueryType;
}
/**
 * Wrap a Prisma client to automatically track queries
 */
declare function wrapPrisma<T extends object>(prisma: T, watcher: QueryWatcher, batchId?: string): T;
/**
 * Create a query interceptor for raw database drivers
 */
declare function createQueryInterceptor(watcher: QueryWatcher, batchId?: string): {
    /**
     * Wrap a query function to track its execution
     */
    wrap<TArgs extends unknown[], TResult>(queryFn: (...args: TArgs) => Promise<TResult>, getSql: (...args: TArgs) => string, getBindings?: (...args: TArgs) => unknown[]): (...args: TArgs) => Promise<TResult>;
};

/**
 * Cache watcher - captures cache operations
 */
declare class CacheWatcher extends BaseWatcher<CacheEntryContent> {
    readonly type: "cache";
    constructor(options?: CacheWatcherOptions);
    /**
     * Record a cache operation
     */
    record(data: {
        batchId?: string;
        key: string;
        value?: unknown;
        operation: CacheOperation;
        driver?: string;
        ttl?: number;
        tags?: string[];
        duration?: number;
    }): Entry;
    private truncateValue;
}
/**
 * Create a wrapper around a cache client to track operations
 */
declare function createCacheWrapper<T extends object>(cache: T, watcher: CacheWatcher, driver: string, batchId?: string): T;

/**
 * Log watcher - captures application logs
 */
declare class LogWatcher extends BaseWatcher<LogEntryContent> {
    readonly type: "log";
    private minLevel;
    constructor(options?: LogWatcherOptions);
    /**
     * Record a log entry
     */
    record(data: {
        batchId?: string;
        level: LogLevel;
        message: string;
        context?: Record<string, unknown>;
        channel?: string;
    }): Entry | null;
    /**
     * Create a logger instance that automatically records to NodeScope
     */
    createLogger(batchId?: string, channel?: string): {
        debug: (message: string, context?: Record<string, unknown>) => Entry | null;
        info: (message: string, context?: Record<string, unknown>) => Entry | null;
        warn: (message: string, context?: Record<string, unknown>) => Entry | null;
        error: (message: string, context?: Record<string, unknown>) => Entry | null;
    };
}
/**
 * Intercept console methods to capture logs
 */
declare function interceptConsole(watcher: LogWatcher, batchIdFn?: () => string | undefined): () => void;

/**
 * Exception watcher - captures errors and exceptions
 */
declare class ExceptionWatcher extends BaseWatcher<ExceptionEntryContent> {
    readonly type: "exception";
    constructor(options?: ExceptionWatcherOptions);
    /**
     * Record an exception
     */
    record(data: {
        batchId?: string;
        error: Error;
        context?: Record<string, unknown>;
    }): Entry;
    private errorToContent;
    private extractLocation;
}
/**
 * Set up global error handlers to capture uncaught exceptions
 */
declare function setupGlobalErrorHandlers(watcher: ExceptionWatcher, onEntry: (entry: Entry) => void): () => void;

/**
 * HTTP Client watcher - captures outgoing HTTP requests
 */
declare class HttpClientWatcher extends BaseWatcher<HttpClientEntryContent> {
    readonly type: "http_client";
    private sizeLimit;
    constructor(options?: HttpClientWatcherOptions);
    /**
     * Record an outgoing HTTP request
     */
    record(data: {
        batchId?: string;
        method: string;
        url: string;
        headers: Record<string, string>;
        body?: unknown;
        response: {
            status: number;
            headers: Record<string, string>;
            body?: unknown;
        };
        duration: number;
    }): Entry;
    private sanitizeHeaders;
    private truncateBody;
    private getBodySize;
}
/**
 * Wrap the global fetch to track outgoing requests
 */
declare function wrapFetch(watcher: HttpClientWatcher, batchIdFn?: () => string | undefined): typeof fetch;
/**
 * Install fetch wrapper globally
 */
declare function interceptFetch(watcher: HttpClientWatcher, batchIdFn?: () => string | undefined): () => void;

/**
 * Event watcher - captures application events
 */
declare class EventWatcher extends BaseWatcher<EventEntryContent> {
    readonly type: "event";
    private ignorePatterns;
    constructor(options?: EventWatcherOptions);
    /**
     * Record an event
     */
    record(data: {
        batchId?: string;
        name: string;
        payload?: unknown;
        listeners?: string[];
        broadcast?: {
            channel: string;
            event: string;
        };
    }): Entry | null;
}
/**
 * Simple event emitter with NodeScope integration
 */
declare class TrackedEventEmitter {
    private listeners;
    private watcher;
    private batchIdFn?;
    constructor(watcher: EventWatcher, batchIdFn?: () => string | undefined);
    on(event: string, handler: Function, handlerName?: string): void;
    off(event: string, handler: Function): void;
    emit(event: string, payload?: unknown): void;
    listenerCount(event: string): number;
}

/**
 * Job watcher - captures background job processing
 */
declare class JobWatcher extends BaseWatcher<JobEntryContent> {
    readonly type: "job";
    constructor(options?: JobWatcherOptions);
    /**
     * Record a job
     */
    record(data: {
        batchId?: string;
        name: string;
        queue?: string;
        data?: unknown;
        status: JobStatus;
        attempts?: number;
        maxAttempts?: number;
        error?: string;
        duration?: number;
    }): Entry;
    /**
     * Create a job tracker that can be used to track job lifecycle
     */
    createJobTracker(name: string, options?: {
        batchId?: string;
        queue?: string;
        data?: unknown;
        maxAttempts?: number;
    }): {
        start: () => Entry;
        complete: (duration?: number) => Entry;
        fail: (error: Error | string, duration?: number) => Entry;
    };
}
/**
 * Wrap a job processor function to automatically track execution
 */
declare function wrapJobProcessor<TData, TResult>(watcher: JobWatcher, name: string, processor: (data: TData) => Promise<TResult>, options?: {
    queue?: string;
    maxAttempts?: number;
}): (data: TData) => Promise<TResult>;

interface ApiRequest {
    method: string;
    url: string;
    query: Record<string, string | string[] | undefined>;
    body?: unknown;
}
interface ApiResponse {
    status: number;
    body: unknown;
    headers?: Record<string, string>;
}
/**
 * API handler for the NodeScope dashboard
 */
declare class ApiHandler {
    private storage;
    constructor(storage: StorageAdapter);
    /**
     * Handle an API request
     */
    handle(req: ApiRequest): Promise<ApiResponse>;
    private listEntries;
    private getEntry;
    private getBatch;
    private getStats;
    private clearEntries;
    private pruneEntries;
}

interface WebSocketClient {
    send: (data: string) => void;
    readyState: number;
}
interface RealTimeServerOptions {
    heartbeatInterval?: number;
}
/**
 * WebSocket server for real-time updates
 */
declare class RealTimeServer {
    private clients;
    private heartbeatInterval?;
    private readonly heartbeatMs;
    constructor(options?: RealTimeServerOptions);
    /**
     * Handle a new WebSocket connection
     */
    handleConnection(ws: WebSocketClient): void;
    /**
     * Handle WebSocket disconnection
     */
    handleDisconnection(ws: WebSocketClient): void;
    /**
     * Broadcast a new entry to all connected clients
     */
    broadcastEntry(entry: Entry): void;
    /**
     * Broadcast stats update to all clients
     */
    broadcastStats(stats: Record<string, unknown>): void;
    /**
     * Start heartbeat to keep connections alive
     */
    startHeartbeat(): void;
    /**
     * Stop heartbeat
     */
    stopHeartbeat(): void;
    /**
     * Get number of connected clients
     */
    get clientCount(): number;
    private broadcast;
    private sendTo;
}

/**
 * Main NodeScope class
 */
declare class NodeScope {
    private config;
    private storage;
    private apiHandler;
    private realTimeServer;
    private initialized;
    private cleanupFns;
    readonly requestWatcher: RequestWatcher;
    readonly queryWatcher: QueryWatcher;
    readonly cacheWatcher: CacheWatcher;
    readonly logWatcher: LogWatcher;
    readonly exceptionWatcher: ExceptionWatcher;
    readonly httpClientWatcher: HttpClientWatcher;
    readonly eventWatcher: EventWatcher;
    readonly jobWatcher: JobWatcher;
    private currentBatchId?;
    constructor(config?: NodeScopeConfig);
    /**
     * Initialize storage and start background processes
     */
    initialize(): Promise<void>;
    /**
     * Record an entry to storage and broadcast
     */
    recordEntry(entry: Entry): Promise<void>;
    /**
     * Get the current batch ID
     */
    get batchId(): string | undefined;
    /**
     * Create a new request context
     */
    createContext(): {
        batchId: string;
        startTime: number;
    };
    /**
     * Get the dashboard path
     */
    get dashboardPath(): string;
    /**
     * Get the API handler
     */
    get api(): ApiHandler;
    /**
     * Get the real-time server
     */
    get realtime(): RealTimeServer;
    /**
     * Get storage adapter
     */
    getStorage(): StorageAdapter;
    /**
     * Check if NodeScope is enabled
     */
    get isEnabled(): boolean;
    /**
     * Check authorization
     */
    checkAuthorization(req: unknown): Promise<boolean>;
    /**
     * Cleanup and close connections
     */
    close(): Promise<void>;
}
/**
 * Get or create the default NodeScope instance
 */
declare function getNodeScope(): NodeScope;
/**
 * Initialize NodeScope with configuration
 */
declare function initNodeScope(config?: NodeScopeConfig): Promise<NodeScope>;

interface MemoryStorageOptions {
    /** Maximum number of entries to keep */
    maxEntries?: number;
}
/**
 * In-memory storage adapter.
 * Fast but data is lost on restart.
 * Great for development and testing.
 */
declare class MemoryStorage implements StorageAdapter {
    private entries;
    private entriesByBatch;
    private entriesByType;
    private readonly maxEntries;
    constructor(options?: MemoryStorageOptions);
    initialize(): Promise<void>;
    save(entry: Entry): Promise<void>;
    saveBatch(entries: Entry[]): Promise<void>;
    find(id: string): Promise<Entry | null>;
    list(options?: ListOptions): Promise<PaginatedResult<Entry>>;
    findByBatch(batchId: string): Promise<Entry[]>;
    prune(beforeDate: Date): Promise<number>;
    clear(): Promise<void>;
    stats(): Promise<StorageStats>;
    close(): Promise<void>;
    private addToIndexes;
    private removeFromIndexes;
}

/**
 * SQLite storage adapter.
 * Persistent storage using better-sqlite3.
 * Great for local development with persistence.
 */
declare class SQLiteStorage implements StorageAdapter {
    private db;
    private readonly dbPath;
    constructor(dbPath: string);
    initialize(): Promise<void>;
    save(entry: Entry): Promise<void>;
    saveBatch(entries: Entry[]): Promise<void>;
    find(id: string): Promise<Entry | null>;
    list(options?: ListOptions): Promise<PaginatedResult<Entry>>;
    findByBatch(batchId: string): Promise<Entry[]>;
    prune(beforeDate: Date): Promise<number>;
    clear(): Promise<void>;
    stats(): Promise<StorageStats>;
    close(): Promise<void>;
    private rowToEntry;
}

/**
 * PostgreSQL storage adapter.
 * Production-ready with connection pooling and JSONB support.
 */
declare class PostgreSQLStorage implements StorageAdapter {
    private pool;
    private readonly connectionString;
    constructor(connectionString: string);
    initialize(): Promise<void>;
    save(entry: Entry): Promise<void>;
    saveBatch(entries: Entry[]): Promise<void>;
    find(id: string): Promise<Entry | null>;
    list(options?: ListOptions): Promise<PaginatedResult<Entry>>;
    findByBatch(batchId: string): Promise<Entry[]>;
    prune(beforeDate: Date): Promise<number>;
    clear(): Promise<void>;
    stats(): Promise<StorageStats>;
    close(): Promise<void>;
    private rowToEntry;
}

/**
 * MySQL storage adapter.
 * Production-ready with connection pooling and JSON support.
 */
declare class MySQLStorage implements StorageAdapter {
    private pool;
    private readonly connectionString;
    constructor(connectionString: string);
    initialize(): Promise<void>;
    save(entry: Entry): Promise<void>;
    saveBatch(entries: Entry[]): Promise<void>;
    find(id: string): Promise<Entry | null>;
    list(options?: ListOptions): Promise<PaginatedResult<Entry>>;
    findByBatch(batchId: string): Promise<Entry[]>;
    prune(beforeDate: Date): Promise<number>;
    clear(): Promise<void>;
    stats(): Promise<StorageStats>;
    close(): Promise<void>;
    private rowToEntry;
}

declare module 'express' {
    interface Request {
        nodescope?: {
            batchId: string;
            startTime: number;
        };
    }
}
type ExpressApp = {
    use: (path: string | RequestHandler, ...handlers: RequestHandler[]) => void;
};
/**
 * Create Express middleware for NodeScope
 */
declare function createExpressMiddleware(nodescope: NodeScope): RequestHandler;
/**
 * Mount all NodeScope routes on an Express app
 */
declare function mountExpressRoutes(app: ExpressApp, nodescope: NodeScope): Promise<void>;
/**
 * Attach WebSocket handler to an HTTP server for real-time updates
 * Requires 'ws' package: npm install ws @types/ws
 */
declare function attachWebSocket(server: http.Server, nodescope: NodeScope, options?: {
    path?: string;
}): void;

declare module 'hono' {
    interface ContextVariableMap {
        nodescope: {
            batchId: string;
            startTime: number;
        };
    }
}
/**
 * Create Hono middleware for NodeScope
 */
declare function createHonoMiddleware(nodescope: NodeScope): MiddlewareHandler;
/**
 * Create Hono routes for NodeScope dashboard
 */
declare function createHonoDashboardRoutes(nodescope: NodeScope): Hono;
/**
 * Create a simple Hono middleware that sets up everything
 */
declare function nodescope(config?: NodeScopeConfig): MiddlewareHandler;

interface FastifyRequest {
    url: string;
    method: string;
    query: Record<string, unknown>;
    headers: Record<string, string>;
    body: unknown;
    ip: string;
    routeOptions?: {
        url?: string;
    };
    nodescope?: {
        batchId: string;
        startTime: number;
    };
}
interface FastifyReply {
    statusCode: number;
    getHeaders(): Record<string, string>;
    status(code: number): FastifyReply;
    type(contentType: string): FastifyReply;
    send(payload: unknown): FastifyReply;
}
interface FastifyInstance {
    addHook(name: string, handler: (...args: any[]) => Promise<void>): void;
    get(path: string, handler: (request: FastifyRequest, reply: FastifyReply) => Promise<FastifyReply>): void;
    all(path: string, handler: (request: FastifyRequest, reply: FastifyReply) => Promise<FastifyReply>): void;
    log: {
        error: (...args: any[]) => void;
    };
}
/**
 * Create Fastify plugin for NodeScope
 */
declare function fastifyNodeScope(fastify: FastifyInstance, options: {
    nodescope: NodeScope;
}): Promise<void>;

/**
 * NodeScope Middleware for NestJS
 * Tracks HTTP requests and responses
 *
 * This middleware must be provided by NodeScopeModule to ensure proper DI
 */
declare class NodeScopeMiddleware implements NestMiddleware {
    private readonly nodescope;
    constructor(nodescope: NodeScope);
    use(req: any, res: any, next: () => void): Promise<void>;
}
/**
 * NodeScope Interceptor for NestJS
 * Alternative to middleware, provides more NestJS-native integration
 */
declare class NodeScopeInterceptor {
    private readonly nodescope;
    constructor(nodescope: NodeScope);
    intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>>;
}
/**
 * NodeScope Controller for NestJS
 * Serves the dashboard and API endpoints
 */
declare class NodeScopeController {
    private readonly nodescope;
    constructor(nodescope: NodeScope);
    getDashboard(req: any, res: any): Promise<any>;
    handleApi(req: any, res: any): Promise<any>;
}
/**
 * NodeScope Module for NestJS
 * Dynamic module that provides NodeScope functionality
 */
declare class NodeScopeModule {
    /**
     * Create a dynamic NestJS module for NodeScope
     *
     * @example
     * ```typescript
     * import { Module } from '@nestjs/common';
     * import { NodeScopeModule } from '@vipin733/nodescope';
     *
     * @Module({
     *   imports: [
     *     NodeScopeModule.forRoot({
     *       storage: 'sqlite',
     *       dashboardPath: '/_debug',
     *     }),
     *   ],
     * })
     * export class AppModule {}
     * ```
     */
    static forRoot(config?: NodeScopeConfig): DynamicModule;
    /**
     * Create an async dynamic module
     * Useful when you need to inject other services
     *
     * @example
     * ```typescript
     * NodeScopeModule.forRootAsync({
     *   useFactory: (configService: ConfigService) => ({
     *     storage: configService.get('NODESCOPE_STORAGE'),
     *     dashboardPath: '/_debug',
     *     enabled: configService.get('NODE_ENV') === 'development',
     *   }),
     *   inject: [ConfigService],
     * })
     * ```
     */
    static forRootAsync(options: {
        useFactory: (...args: any[]) => NodeScopeConfig | Promise<NodeScopeConfig>;
        inject?: any[];
    }): DynamicModule;
}
/**
 * Helper function to configure NestJS routes for NodeScope dashboard
 * Use this in your main.ts to set up dashboard routes
 *
 * @example
 * ```typescript
 * import { setupNodeScopeRoutes } from '@vipin733/nodescope';
 *
 * async function bootstrap() {
 *   const app = await NestFactory.create(AppModule);
 *
 *   // Get NodeScope instance from app
 *   const nodescope = app.get('NODESCOPE_INSTANCE');
 *   await setupNodeScopeRoutes(app, nodescope);
 *
 *   await app.listen(3000);
 * }
 * ```
 */
declare function setupNodeScopeRoutes(app: any, nodescope: NodeScope): Promise<void>;

/**
 * Get the embedded dashboard HTML
 * This is a simple HTML page that loads the dashboard React app
 */
declare function getDashboardHtml(basePath: string): string;

export { ApiHandler, BaseWatcher, type CacheEntryContent, type CacheOperation, CacheWatcher, type CacheWatcherOptions, type DumpEntryContent, type Entry, type EntryType, type EventEntryContent, EventWatcher, type EventWatcherOptions, type ExceptionEntryContent, ExceptionWatcher, type ExceptionWatcherOptions, type HttpClientEntryContent, HttpClientWatcher, type HttpClientWatcherOptions, type HttpMethod, type JobEntryContent, type JobStatus, JobWatcher, type JobWatcherOptions, type ListOptions, type LogEntryContent, type LogLevel, LogWatcher, type LogWatcherOptions, MemoryStorage, MySQLStorage, NodeScope, type NodeScopeConfig, NodeScopeController, NodeScopeInterceptor, NodeScopeMiddleware, NodeScopeModule, type PaginatedResult, PostgreSQLStorage, type QueryEntryContent, QueryWatcher, type QueryWatcherOptions, RealTimeServer, type RequestContext, type RequestEntryContent, RequestWatcher, type RequestWatcherOptions, SQLiteStorage, type ScheduleEntryContent, type ScheduleWatcherOptions, type StorageAdapter, type StorageDriver, type StorageStats, TrackedEventEmitter, type WatcherConfig, attachWebSocket, createCacheWrapper, createExpressMiddleware, createHonoDashboardRoutes, createHonoMiddleware, createQueryInterceptor, createRequestContext, createStorageAdapter, fastifyNodeScope, getDashboardHtml, getDuration, getMemoryDelta, getNodeScope, initNodeScope, interceptConsole, interceptFetch, mountExpressRoutes, nodescope, setupGlobalErrorHandlers, setupNodeScopeRoutes, wrapFetch, wrapJobProcessor, wrapPrisma };
