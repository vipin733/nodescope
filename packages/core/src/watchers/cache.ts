import { BaseWatcher } from './base.js';
import type { Entry, CacheEntryContent, CacheWatcherOptions, CacheOperation } from '../types.js';

/**
 * Cache watcher - captures cache operations
 */
export class CacheWatcher extends BaseWatcher<CacheEntryContent> {
  readonly type = 'cache' as const;

  constructor(options: CacheWatcherOptions = {}) {
    super();
    this.enabled = options.enabled ?? true;
  }

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
  }): Entry {
    const content: CacheEntryContent = {
      key: data.key,
      value: this.truncateValue(data.value),
      operation: data.operation,
      driver: data.driver ?? 'unknown',
      ttl: data.ttl,
      tags: data.tags,
    };

    const entryTags: string[] = [`operation:${data.operation}`];
    if (data.operation === 'hit') {
      entryTags.push('hit');
    } else if (data.operation === 'miss') {
      entryTags.push('miss');
    }

    return this.createEntry(content, {
      batchId: data.batchId,
      duration: data.duration,
      tags: entryTags,
    });
  }

  private truncateValue(value: unknown): unknown {
    if (value === undefined || value === null) return value;
    
    try {
      const serialized = JSON.stringify(value);
      if (serialized.length > 1024) {
        return `[TRUNCATED - ${serialized.length} bytes]`;
      }
      return value;
    } catch {
      return '[UNSERIALIZABLE]';
    }
  }
}

/**
 * Create a wrapper around a cache client to track operations
 */
export function createCacheWrapper<T extends object>(
  cache: T,
  watcher: CacheWatcher,
  driver: string,
  batchId?: string
): T {
  const handler: ProxyHandler<T> = {
    get(target, prop) {
      const value = (target as any)[prop];
      
      if (typeof value !== 'function') {
        return value;
      }

      // Common cache method patterns
      const methodName = String(prop).toLowerCase();
      
      return async (...args: unknown[]) => {
        const startTime = performance.now();
        
        try {
          const result = await value.apply(target, args);
          const duration = Math.round(performance.now() - startTime);

          // Detect operation type and key
          let operation: CacheOperation = 'get';
          let key: string = '';
          let cacheValue: unknown;
          let ttl: number | undefined;

          if (methodName.includes('get') || methodName === 'fetch') {
            key = String(args[0] ?? '');
            operation = result !== null && result !== undefined ? 'hit' : 'miss';
            cacheValue = result;
          } else if (methodName.includes('set') || methodName === 'put') {
            key = String(args[0] ?? '');
            operation = 'set';
            cacheValue = args[1];
            ttl = typeof args[2] === 'number' ? args[2] : undefined;
          } else if (methodName.includes('del') || methodName === 'remove') {
            key = String(args[0] ?? '');
            operation = 'delete';
          } else if (methodName.includes('flush') || methodName === 'clear') {
            key = '*';
            operation = 'flush';
          }

          if (key) {
            watcher.record({
              batchId,
              key,
              value: cacheValue,
              operation,
              driver,
              ttl,
              duration,
            });
          }

          return result;
        } catch (error) {
          throw error;
        }
      };
    },
  };

  return new Proxy(cache, handler);
}
