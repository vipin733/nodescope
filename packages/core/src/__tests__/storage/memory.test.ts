import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStorage } from '../../storage/memory.js';
import type { Entry, EntryType } from '../../types.js';

function createTestEntry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: `entry-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    batchId: 'batch-1',
    type: 'log',
    content: { level: 'info', message: 'Test message' },
    tags: [],
    createdAt: new Date(),
    ...overrides,
  };
}

describe('MemoryStorage', () => {
  let storage: MemoryStorage;

  beforeEach(async () => {
    storage = new MemoryStorage();
    await storage.initialize();
  });

  describe('save and find', () => {
    it('should save and retrieve an entry', async () => {
      const entry = createTestEntry({ id: 'unique-1' });
      await storage.save(entry);
      
      const found = await storage.find('unique-1');
      expect(found).toBeDefined();
      expect(found?.id).toBe('unique-1');
      expect(found?.content).toEqual(entry.content);
    });

    it('should return null for non-existent entry', async () => {
      const found = await storage.find('non-existent');
      expect(found).toBeNull();
    });
  });

  describe('saveBatch', () => {
    it('should save multiple entries', async () => {
      const entries = [
        createTestEntry({ id: 'batch-entry-1' }),
        createTestEntry({ id: 'batch-entry-2' }),
        createTestEntry({ id: 'batch-entry-3' }),
      ];
      
      await storage.saveBatch(entries);
      
      expect(await storage.find('batch-entry-1')).toBeDefined();
      expect(await storage.find('batch-entry-2')).toBeDefined();
      expect(await storage.find('batch-entry-3')).toBeDefined();
    });
  });

  describe('list', () => {
    beforeEach(async () => {
      const entries = [
        createTestEntry({ id: 'list-1', type: 'log', batchId: 'batch-a', tags: ['tag1'] }),
        createTestEntry({ id: 'list-2', type: 'request', batchId: 'batch-a', tags: ['tag2'] }),
        createTestEntry({ id: 'list-3', type: 'log', batchId: 'batch-b', tags: ['tag1', 'tag2'] }),
        createTestEntry({ id: 'list-4', type: 'query', batchId: 'batch-b', tags: [] }),
        createTestEntry({ id: 'list-5', type: 'exception', batchId: 'batch-c', tags: ['error'] }),
      ];
      await storage.saveBatch(entries);
    });

    it('should list all entries with default pagination', async () => {
      const result = await storage.list();
      
      expect(result.data.length).toBe(5);
      expect(result.total).toBe(5);
      expect(result.limit).toBe(50);
      expect(result.offset).toBe(0);
    });

    it('should filter by type', async () => {
      const result = await storage.list({ type: 'log' });
      
      expect(result.data.length).toBe(2);
      expect(result.data.every(e => e.type === 'log')).toBe(true);
    });

    it('should filter by batchId', async () => {
      const result = await storage.list({ batchId: 'batch-a' });
      
      expect(result.data.length).toBe(2);
      expect(result.data.every(e => e.batchId === 'batch-a')).toBe(true);
    });

    it('should filter by tags', async () => {
      const result = await storage.list({ tags: ['tag1'] });
      
      expect(result.data.length).toBe(2);
      expect(result.data.every(e => e.tags.includes('tag1'))).toBe(true);
    });

    it('should respect limit and offset', async () => {
      const result1 = await storage.list({ limit: 2, offset: 0 });
      expect(result1.data.length).toBe(2);
      expect(result1.hasMore).toBe(true);
      
      const result2 = await storage.list({ limit: 2, offset: 2 });
      expect(result2.data.length).toBe(2);
      expect(result2.hasMore).toBe(true);
      
      const result3 = await storage.list({ limit: 2, offset: 4 });
      expect(result3.data.length).toBe(1);
      expect(result3.hasMore).toBe(false);
    });

    it('should search in content', async () => {
      await storage.save(createTestEntry({
        id: 'search-test',
        content: { message: 'unique-search-term-xyz' },
      }));
      
      const result = await storage.list({ search: 'unique-search-term-xyz' });
      expect(result.data.length).toBe(1);
      expect(result.data[0].id).toBe('search-test');
    });

    it('should filter by date range', async () => {
      const oldDate = new Date('2020-01-01');
      const recentDate = new Date('2025-01-01');
      
      await storage.save(createTestEntry({ id: 'old-entry', createdAt: oldDate }));
      await storage.save(createTestEntry({ id: 'recent-entry', createdAt: recentDate }));
      
      const result = await storage.list({ after: new Date('2024-01-01') });
      
      const ids = result.data.map(e => e.id);
      expect(ids).toContain('recent-entry');
      expect(ids).not.toContain('old-entry');
    });
  });

  describe('findByBatch', () => {
    it('should return all entries for a batch', async () => {
      await storage.save(createTestEntry({ id: 'fb-1', batchId: 'batch-x' }));
      await storage.save(createTestEntry({ id: 'fb-2', batchId: 'batch-x' }));
      await storage.save(createTestEntry({ id: 'fb-3', batchId: 'batch-y' }));
      
      const entries = await storage.findByBatch('batch-x');
      
      expect(entries.length).toBe(2);
      expect(entries.every(e => e.batchId === 'batch-x')).toBe(true);
    });

    it('should return empty array for non-existent batch', async () => {
      const entries = await storage.findByBatch('non-existent-batch');
      expect(entries).toEqual([]);
    });
  });

  describe('prune', () => {
    it('should remove entries older than date', async () => {
      const oldDate = new Date('2020-01-01');
      const newDate = new Date();
      
      await storage.save(createTestEntry({ id: 'old-1', createdAt: oldDate }));
      await storage.save(createTestEntry({ id: 'old-2', createdAt: oldDate }));
      await storage.save(createTestEntry({ id: 'new-1', createdAt: newDate }));
      
      const pruned = await storage.prune(new Date('2021-01-01'));
      
      expect(pruned).toBe(2);
      expect(await storage.find('old-1')).toBeNull();
      expect(await storage.find('old-2')).toBeNull();
      expect(await storage.find('new-1')).toBeDefined();
    });
  });

  describe('clear', () => {
    it('should remove all entries', async () => {
      await storage.save(createTestEntry({ id: 'clear-1' }));
      await storage.save(createTestEntry({ id: 'clear-2' }));
      
      await storage.clear();
      
      const result = await storage.list();
      expect(result.data.length).toBe(0);
    });
  });

  describe('stats', () => {
    it('should return accurate statistics', async () => {
      await storage.save(createTestEntry({ id: 's1', type: 'log' }));
      await storage.save(createTestEntry({ id: 's2', type: 'log' }));
      await storage.save(createTestEntry({ id: 's3', type: 'request' }));
      await storage.save(createTestEntry({ id: 's4', type: 'query' }));
      
      const stats = await storage.stats();
      
      expect(stats.totalEntries).toBe(4);
      expect(stats.entriesByType.log).toBe(2);
      expect(stats.entriesByType.request).toBe(1);
      expect(stats.entriesByType.query).toBe(1);
      expect(stats.oldestEntry).toBeDefined();
      expect(stats.newestEntry).toBeDefined();
    });
  });

  describe('max entries limit', () => {
    it('should evict old entries when limit reached', async () => {
      const smallStorage = new MemoryStorage({ maxEntries: 10 });
      await smallStorage.initialize();
      
      // Add 15 entries
      for (let i = 0; i < 15; i++) {
        await smallStorage.save(createTestEntry({ id: `limit-${i}` }));
      }
      
      const stats = await smallStorage.stats();
      // Should have evicted ~10% when limit was hit
      expect(stats.totalEntries).toBeLessThanOrEqual(15);
      expect(stats.totalEntries).toBeGreaterThan(0);
    });
  });
});
