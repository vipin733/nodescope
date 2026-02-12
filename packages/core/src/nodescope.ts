import type {
  NodeScopeConfig,
  Entry,
  WatcherConfig,
  StorageDriver,
} from './types.js';
import { StorageAdapter, createStorageAdapter } from './storage/adapter.js';
import {
  RequestWatcher,
  QueryWatcher,
  CacheWatcher,
  LogWatcher,
  ExceptionWatcher,
  HttpClientWatcher,
  EventWatcher,
  JobWatcher,
  createRequestContext,
  setupGlobalErrorHandlers,
} from './watchers/index.js';
import { ApiHandler } from './server/api.js';
import { RealTimeServer } from './server/websocket.js';

const DEFAULT_CONFIG: Required<Omit<NodeScopeConfig, 'authorization' | 'filter' | 'tag'>> = {
  enabled: true,
  storage: 'memory',
  databaseUrl: undefined as any,
  dashboardPath: '/_nodescope',
  watchers: {
    request: true,
    query: true,
    cache: true,
    log: true,
    exception: true,
    httpClient: true,
    event: true,
    job: true,
  },
  realtime: true,
  pruneAfterHours: 24,
};

/**
 * Main NodeScope class
 */
export class NodeScope {
  private config: Required<Omit<NodeScopeConfig, 'authorization' | 'filter' | 'tag'>> & 
    Pick<NodeScopeConfig, 'authorization' | 'filter' | 'tag'>;
  
  private storage!: StorageAdapter;
  private apiHandler!: ApiHandler;
  private realTimeServer: RealTimeServer;
  private initialized = false;
  private cleanupFns: Array<() => void> = [];

  // Watchers
  readonly requestWatcher: RequestWatcher;
  readonly queryWatcher: QueryWatcher;
  readonly cacheWatcher: CacheWatcher;
  readonly logWatcher: LogWatcher;
  readonly exceptionWatcher: ExceptionWatcher;
  readonly httpClientWatcher: HttpClientWatcher;
  readonly eventWatcher: EventWatcher;
  readonly jobWatcher: JobWatcher;

  // Current request context (for middleware use)
  private currentBatchId?: string;

  constructor(config: NodeScopeConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config } as any;
    this.realTimeServer = new RealTimeServer();

    // Initialize watchers with config
    const wc = this.config.watchers;
    
    this.requestWatcher = new RequestWatcher(
      typeof wc.request === 'object' ? wc.request : {}
    );
    this.requestWatcher.enabled = wc.request !== false;

    this.queryWatcher = new QueryWatcher(
      typeof wc.query === 'object' ? wc.query : {}
    );
    this.queryWatcher.enabled = wc.query !== false;

    this.cacheWatcher = new CacheWatcher(
      typeof wc.cache === 'object' ? wc.cache : {}
    );
    this.cacheWatcher.enabled = wc.cache !== false;

    this.logWatcher = new LogWatcher(
      typeof wc.log === 'object' ? wc.log : {}
    );
    this.logWatcher.enabled = wc.log !== false;

    this.exceptionWatcher = new ExceptionWatcher(
      typeof wc.exception === 'object' ? wc.exception : {}
    );
    this.exceptionWatcher.enabled = wc.exception !== false;

    this.httpClientWatcher = new HttpClientWatcher(
      typeof wc.httpClient === 'object' ? wc.httpClient : {}
    );
    this.httpClientWatcher.enabled = wc.httpClient !== false;

    this.eventWatcher = new EventWatcher(
      typeof wc.event === 'object' ? wc.event : {}
    );
    this.eventWatcher.enabled = wc.event !== false;

    this.jobWatcher = new JobWatcher(
      typeof wc.job === 'object' ? wc.job : {}
    );
    this.jobWatcher.enabled = wc.job !== false;
  }

  /**
   * Initialize storage and start background processes
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Create storage
    this.storage = await createStorageAdapter(this.config.storage, {
      databaseUrl: this.config.databaseUrl,
    });
    await this.storage.initialize();

    // Create API handler
    this.apiHandler = new ApiHandler(this.storage);

    // Set up global error handlers
    if (this.exceptionWatcher.enabled) {
      const cleanup = setupGlobalErrorHandlers(
        this.exceptionWatcher,
        (entry) => this.recordEntry(entry)
      );
      this.cleanupFns.push(cleanup);
    }

    // Start real-time server heartbeat
    if (this.config.realtime) {
      this.realTimeServer.startHeartbeat();
    }

    // Set up pruning interval
    if (this.config.pruneAfterHours && this.config.pruneAfterHours > 0) {
      const pruneInterval = setInterval(async () => {
        const beforeDate = new Date(
          Date.now() - this.config.pruneAfterHours! * 60 * 60 * 1000
        );
        await this.storage.prune(beforeDate);
      }, 60 * 60 * 1000); // Prune every hour

      this.cleanupFns.push(() => clearInterval(pruneInterval));
    }

    this.initialized = true;
  }

  /**
   * Record an entry to storage and broadcast
   */
  async recordEntry(entry: Entry): Promise<void> {
    if (!this.config.enabled) return;

    // Apply custom filter
    if (this.config.filter && !this.config.filter(entry)) {
      return;
    }

    // Apply custom tags
    if (this.config.tag) {
      const customTags = this.config.tag(entry);
      entry.tags = [...entry.tags, ...customTags];
    }

    await this.storage.save(entry);

    if (this.config.realtime) {
      this.realTimeServer.broadcastEntry(entry);
    }
  }

  /**
   * Get the current batch ID
   */
  get batchId(): string | undefined {
    return this.currentBatchId;
  }

  /**
   * Create a new request context
   */
  createContext(): { batchId: string; startTime: number } {
    const ctx = createRequestContext();
    this.currentBatchId = ctx.batchId;
    return ctx;
  }

  /**
   * Get the dashboard path
   */
  get dashboardPath(): string {
    return this.config.dashboardPath;
  }

  /**
   * Get the API handler
   */
  get api(): ApiHandler {
    return this.apiHandler;
  }

  /**
   * Get the real-time server
   */
  get realtime(): RealTimeServer {
    return this.realTimeServer;
  }

  /**
   * Get storage adapter
   */
  getStorage(): StorageAdapter {
    return this.storage;
  }

  /**
   * Check if NodeScope is enabled
   */
  get isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Check authorization
   */
  async checkAuthorization(req: unknown): Promise<boolean> {
    if (!this.config.authorization) return true;
    return this.config.authorization(req);
  }

  /**
   * Cleanup and close connections
   */
  async close(): Promise<void> {
    this.realTimeServer.stopHeartbeat();
    
    for (const cleanup of this.cleanupFns) {
      cleanup();
    }
    this.cleanupFns = [];

    if (this.storage) {
      await this.storage.close();
    }
  }
}

// Singleton instance
let defaultInstance: NodeScope | null = null;

/**
 * Get or create the default NodeScope instance
 */
export function getNodeScope(): NodeScope {
  if (!defaultInstance) {
    defaultInstance = new NodeScope();
  }
  return defaultInstance;
}

/**
 * Initialize NodeScope with configuration
 */
export async function initNodeScope(config: NodeScopeConfig = {}): Promise<NodeScope> {
  defaultInstance = new NodeScope(config);
  await defaultInstance.initialize();
  return defaultInstance;
}
