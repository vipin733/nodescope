import { BaseWatcher } from './base.js';
import type { Entry, QueryEntryContent, QueryWatcherOptions } from '../types.js';

const DEFAULT_SLOW_THRESHOLD = 100; // ms

/**
 * Query watcher - captures database queries
 */
export class QueryWatcher extends BaseWatcher<QueryEntryContent> {
  readonly type = 'query' as const;
  
  private slowThreshold: number;

  constructor(options: QueryWatcherOptions = {}) {
    super();
    this.enabled = options.enabled ?? true;
    this.slowThreshold = options.slowThreshold ?? DEFAULT_SLOW_THRESHOLD;
  }

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
  }): Entry {
    const slow = data.duration > this.slowThreshold;

    const content: QueryEntryContent = {
      sql: data.sql,
      bindings: data.bindings ?? [],
      connection: data.connection ?? 'default',
      database: data.database,
      slow,
      rowCount: data.rowCount,
    };

    const tags: string[] = [];
    if (slow) {
      tags.push('slow');
    }
    
    // Extract query type from SQL
    const queryType = this.extractQueryType(data.sql);
    if (queryType) {
      tags.push(`query:${queryType}`);
    }

    return this.createEntry(content, {
      batchId: data.batchId,
      duration: data.duration,
      tags,
    });
  }

  private extractQueryType(sql: string): string | null {
    const normalized = sql.trim().toLowerCase();
    if (normalized.startsWith('select')) return 'select';
    if (normalized.startsWith('insert')) return 'insert';
    if (normalized.startsWith('update')) return 'update';
    if (normalized.startsWith('delete')) return 'delete';
    if (normalized.startsWith('create')) return 'create';
    if (normalized.startsWith('alter')) return 'alter';
    if (normalized.startsWith('drop')) return 'drop';
    return null;
  }
}

/**
 * Wrap a Prisma client to automatically track queries
 */
export function wrapPrisma<T extends object>(prisma: T, watcher: QueryWatcher, batchId?: string): T {
  // Prisma uses $on for query events when using the query event
  if ('$on' in prisma && typeof (prisma as any).$on === 'function') {
    (prisma as any).$on('query', (e: any) => {
      watcher.record({
        batchId,
        sql: e.query,
        bindings: e.params ? JSON.parse(e.params) : [],
        duration: e.duration,
      });
    });
  }
  return prisma;
}

/**
 * Create a query interceptor for raw database drivers
 */
export function createQueryInterceptor(watcher: QueryWatcher, batchId?: string) {
  return {
    /**
     * Wrap a query function to track its execution
     */
    wrap<TArgs extends unknown[], TResult>(
      queryFn: (...args: TArgs) => Promise<TResult>,
      getSql: (...args: TArgs) => string,
      getBindings?: (...args: TArgs) => unknown[]
    ): (...args: TArgs) => Promise<TResult> {
      return async (...args: TArgs): Promise<TResult> => {
        const startTime = performance.now();
        try {
          const result = await queryFn(...args);
          const duration = Math.round(performance.now() - startTime);
          
          watcher.record({
            batchId,
            sql: getSql(...args),
            bindings: getBindings?.(...args) ?? [],
            duration,
            rowCount: Array.isArray(result) ? result.length : undefined,
          });
          
          return result;
        } catch (error) {
          const duration = Math.round(performance.now() - startTime);
          
          watcher.record({
            batchId,
            sql: getSql(...args),
            bindings: getBindings?.(...args) ?? [],
            duration,
          });
          
          throw error;
        }
      };
    },
  };
}
