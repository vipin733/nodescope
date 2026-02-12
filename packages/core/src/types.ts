// ============================================================================
// NodeScope Core Types
// ============================================================================

/**
 * Entry types that NodeScope can capture and display
 */
export type EntryType =
  | 'request'
  | 'query'
  | 'cache'
  | 'log'
  | 'exception'
  | 'http_client'
  | 'event'
  | 'job'
  | 'schedule'
  | 'dump';

/**
 * Log levels for the log watcher
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Cache operations
 */
export type CacheOperation = 'get' | 'set' | 'delete' | 'hit' | 'miss' | 'flush';

/**
 * Job status
 */
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * HTTP methods
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

/**
 * Base entry that all captured data extends
 */
export interface Entry {
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

// ============================================================================
// Entry Content Types
// ============================================================================

export interface RequestEntryContent {
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

export interface QueryEntryContent {
  sql: string;
  bindings: unknown[];
  connection: string;
  database?: string;
  slow: boolean;
  rowCount?: number;
}

export interface CacheEntryContent {
  key: string;
  value?: unknown;
  operation: CacheOperation;
  driver: string;
  ttl?: number;
  tags?: string[];
}

export interface LogEntryContent {
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  channel?: string;
}

export interface ExceptionEntryContent {
  class: string;
  message: string;
  stack: string;
  file?: string;
  line?: number;
  context?: Record<string, unknown>;
  previous?: ExceptionEntryContent;
}

export interface HttpClientEntryContent {
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

export interface EventEntryContent {
  name: string;
  payload: unknown;
  listeners: string[];
  broadcast?: {
    channel: string;
    event: string;
  };
}

export interface JobEntryContent {
  name: string;
  queue: string;
  data: unknown;
  status: JobStatus;
  attempts: number;
  maxAttempts?: number;
  error?: string;
}

export interface ScheduleEntryContent {
  command: string;
  description?: string;
  expression: string;
  output?: string;
  exitCode?: number;
}

export interface DumpEntryContent {
  dump: unknown;
  file?: string;
  line?: number;
}

// ============================================================================
// Configuration Types
// ============================================================================

export type StorageDriver = 'memory' | 'sqlite' | 'postgresql' | 'mysql';

export interface WatcherConfig {
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

export interface RequestWatcherOptions {
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

export interface QueryWatcherOptions {
  enabled?: boolean;
  /** Threshold in ms to mark a query as slow */
  slowThreshold?: number;
}

export interface CacheWatcherOptions {
  enabled?: boolean;
}

export interface LogWatcherOptions {
  enabled?: boolean;
  /** Minimum log level to capture */
  level?: LogLevel;
}

export interface ExceptionWatcherOptions {
  enabled?: boolean;
}

export interface HttpClientWatcherOptions {
  enabled?: boolean;
  /** Maximum response body size to capture (in KB) */
  sizeLimit?: number;
}

export interface EventWatcherOptions {
  enabled?: boolean;
  /** Events to ignore */
  ignore?: string[];
}

export interface JobWatcherOptions {
  enabled?: boolean;
}

export interface ScheduleWatcherOptions {
  enabled?: boolean;
}

/**
 * Main NodeScope configuration
 */
export interface NodeScopeConfig {
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

// ============================================================================
// Storage Types
// ============================================================================

export interface ListOptions {
  type?: EntryType;
  batchId?: string;
  tags?: string[];
  search?: string;
  before?: Date;
  after?: Date;
  limit?: number;
  offset?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface StorageStats {
  totalEntries: number;
  entriesByType: Record<EntryType, number>;
  oldestEntry?: Date;
  newestEntry?: Date;
  storageSize?: number;
}
