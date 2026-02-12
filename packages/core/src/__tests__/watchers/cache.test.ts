import { describe, it, expect, beforeEach } from 'vitest';
import { CacheWatcher, createCacheWrapper } from '../../watchers/cache.js';

describe('CacheWatcher', () => {
  let watcher: CacheWatcher;

  beforeEach(() => {
    watcher = new CacheWatcher();
  });

  describe('record', () => {
    it('should create cache entry for get operation', () => {
      const entry = watcher.record({
        batchId: 'batch-1',
        key: 'user:123',
        operation: 'get',
        driver: 'redis',
      });

      expect(entry.type).toBe('cache');
      expect(entry.batchId).toBe('batch-1');
      expect(entry.content).toMatchObject({
        key: 'user:123',
        operation: 'get',
        driver: 'redis',
      });
    });

    it('should add operation tag', () => {
      const entry = watcher.record({
        key: 'key',
        operation: 'set',
        driver: 'memory',
      });

      expect(entry.tags).toContain('operation:set');
    });

    it('should add hit tag for hit operation', () => {
      const entry = watcher.record({
        key: 'key',
        operation: 'hit',
        driver: 'redis',
        value: { data: 'cached' },
      });

      expect(entry.tags).toContain('hit');
      expect(entry.tags).toContain('operation:hit');
    });

    it('should add miss tag for miss operation', () => {
      const entry = watcher.record({
        key: 'key',
        operation: 'miss',
        driver: 'redis',
      });

      expect(entry.tags).toContain('miss');
      expect(entry.tags).toContain('operation:miss');
    });

    it('should include TTL when provided', () => {
      const entry = watcher.record({
        key: 'key',
        value: 'value',
        operation: 'set',
        driver: 'redis',
        ttl: 3600,
      });

      expect(entry.content).toMatchObject({
        ttl: 3600,
      });
    });

    it('should truncate large values', () => {
      const largeValue = 'x'.repeat(2000);
      
      const entry = watcher.record({
        key: 'key',
        value: largeValue,
        operation: 'set',
        driver: 'memory',
      });

      expect((entry.content as any).value).toContain('TRUNCATED');
    });

    it('should handle unserializable values', () => {
      const circular: any = { a: 1 };
      circular.self = circular;

      const entry = watcher.record({
        key: 'key',
        value: circular,
        operation: 'set',
        driver: 'memory',
      });

      expect((entry.content as any).value).toBe('[UNSERIALIZABLE]');
    });

    it('should include duration when provided', () => {
      const entry = watcher.record({
        key: 'key',
        operation: 'get',
        driver: 'redis',
        duration: 5,
      });

      expect(entry.duration).toBe(5);
    });
  });
});

describe('createCacheWrapper', () => {
  let watcher: CacheWatcher;

  beforeEach(() => {
    watcher = new CacheWatcher();
  });

  it('should create proxy for cache object', () => {
    const mockCache = {
      get: async (key: string) => 'value',
      set: async (key: string, value: any) => true,
    };

    const wrapped = createCacheWrapper(mockCache, watcher, 'test-driver');

    expect(wrapped).toBeDefined();
    expect(typeof wrapped.get).toBe('function');
    expect(typeof wrapped.set).toBe('function');
  });

  it('should pass through non-function properties', () => {
    const mockCache = {
      name: 'test-cache',
      version: 1,
      get: async (key: string) => null,
    };

    const wrapped = createCacheWrapper(mockCache, watcher, 'test');

    expect(wrapped.name).toBe('test-cache');
    expect(wrapped.version).toBe(1);
  });
});
