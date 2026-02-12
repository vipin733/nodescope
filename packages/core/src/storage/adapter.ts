import type {
  Entry,
  ListOptions,
  PaginatedResult,
  StorageStats,
  EntryType,
} from '../types.js';

/**
 * Abstract storage adapter interface.
 * All storage implementations must implement this interface.
 */
export interface StorageAdapter {
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
export async function createStorageAdapter(
  driver: string,
  options?: { databaseUrl?: string }
): Promise<StorageAdapter> {
  switch (driver) {
    case 'memory':
      const { MemoryStorage } = await import('./memory.js');
      return new MemoryStorage();

    case 'sqlite':
      const { SQLiteStorage } = await import('./sqlite.js');
      return new SQLiteStorage(options?.databaseUrl || './nodescope.db');

    case 'postgresql':
      const { PostgreSQLStorage } = await import('./postgresql.js');
      if (!options?.databaseUrl) {
        throw new Error('PostgreSQL requires a databaseUrl');
      }
      return new PostgreSQLStorage(options.databaseUrl);

    case 'mysql':
      const { MySQLStorage } = await import('./mysql.js');
      if (!options?.databaseUrl) {
        throw new Error('MySQL requires a databaseUrl');
      }
      return new MySQLStorage(options.databaseUrl);

    default:
      throw new Error(`Unknown storage driver: ${driver}`);
  }
}

/**
 * Default entry type counts
 */
export function defaultEntryCounts(): Record<EntryType, number> {
  return {
    request: 0,
    query: 0,
    cache: 0,
    log: 0,
    exception: 0,
    http_client: 0,
    event: 0,
    job: 0,
    schedule: 0,
    dump: 0,
  };
}
