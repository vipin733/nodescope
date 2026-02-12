import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryWatcher, createQueryInterceptor } from '../../watchers/query.js';

describe('QueryWatcher', () => {
  let watcher: QueryWatcher;

  beforeEach(() => {
    watcher = new QueryWatcher();
  });

  describe('record', () => {
    it('should create query entry', () => {
      const entry = watcher.record({
        batchId: 'batch-1',
        sql: 'SELECT * FROM users WHERE id = ?',
        bindings: [123],
        connection: 'mysql',
        database: 'app_db',
        duration: 15,
        rowCount: 1,
      });

      expect(entry.type).toBe('query');
      expect(entry.batchId).toBe('batch-1');
      expect(entry.duration).toBe(15);
      expect(entry.content).toMatchObject({
        sql: 'SELECT * FROM users WHERE id = ?',
        bindings: [123],
        connection: 'mysql',
        database: 'app_db',
        rowCount: 1,
      });
    });

    it('should use default connection when not specified', () => {
      const entry = watcher.record({
        sql: 'SELECT 1',
        duration: 1,
      });

      expect((entry.content as any).connection).toBe('default');
    });

    it('should mark slow queries', () => {
      const fastEntry = watcher.record({
        sql: 'SELECT 1',
        duration: 50,
      });

      const slowEntry = watcher.record({
        sql: 'SELECT * FROM large_table',
        duration: 150,
      });

      expect((fastEntry.content as any).slow).toBe(false);
      expect((slowEntry.content as any).slow).toBe(true);
      expect(slowEntry.tags).toContain('slow');
    });

    it('should respect custom slowThreshold', () => {
      const customWatcher = new QueryWatcher({ slowThreshold: 50 });

      const entry = customWatcher.record({
        sql: 'SELECT * FROM users',
        duration: 60,
      });

      expect((entry.content as any).slow).toBe(true);
      expect(entry.tags).toContain('slow');
    });

    it('should extract query type and add tag', () => {
      const selectEntry = watcher.record({ sql: 'SELECT * FROM users', duration: 10 });
      const insertEntry = watcher.record({ sql: 'INSERT INTO users (name) VALUES (?)', duration: 10 });
      const updateEntry = watcher.record({ sql: 'UPDATE users SET name = ?', duration: 10 });
      const deleteEntry = watcher.record({ sql: 'DELETE FROM users WHERE id = ?', duration: 10 });

      expect(selectEntry.tags).toContain('query:select');
      expect(insertEntry.tags).toContain('query:insert');
      expect(updateEntry.tags).toContain('query:update');
      expect(deleteEntry.tags).toContain('query:delete');
    });

    it('should handle DDL statements', () => {
      const createEntry = watcher.record({ sql: 'CREATE TABLE test (id INT)', duration: 100 });
      const alterEntry = watcher.record({ sql: 'ALTER TABLE test ADD COLUMN name VARCHAR(255)', duration: 100 });
      const dropEntry = watcher.record({ sql: 'DROP TABLE test', duration: 50 });

      expect(createEntry.tags).toContain('query:create');
      expect(alterEntry.tags).toContain('query:alter');
      expect(dropEntry.tags).toContain('query:drop');
    });

    it('should handle empty bindings', () => {
      const entry = watcher.record({
        sql: 'SELECT * FROM users',
        duration: 10,
      });

      expect((entry.content as any).bindings).toEqual([]);
    });
  });

  describe('enabled state', () => {
    it('should be enabled by default', () => {
      expect(watcher.enabled).toBe(true);
    });

    it('should respect enabled option', () => {
      const disabledWatcher = new QueryWatcher({ enabled: false });
      expect(disabledWatcher.enabled).toBe(false);
    });
  });
});

describe('createQueryInterceptor', () => {
  let watcher: QueryWatcher;

  beforeEach(() => {
    watcher = new QueryWatcher();
  });

  describe('wrap', () => {
    it('should wrap query function and record success', async () => {
      vi.spyOn(watcher, 'record');
      const interceptor = createQueryInterceptor(watcher, 'batch-1');

      const queryFn = vi.fn().mockResolvedValue([{ id: 1, name: 'Test' }]);
      const wrapped = interceptor.wrap(
        queryFn,
        (sql: string, params: unknown[]) => sql,
        (sql: string, params: unknown[]) => params
      );

      const result = await wrapped('SELECT * FROM users', []);

      expect(result).toEqual([{ id: 1, name: 'Test' }]);
      expect(watcher.record).toHaveBeenCalledWith(expect.objectContaining({
        batchId: 'batch-1',
        sql: 'SELECT * FROM users',
        bindings: [],
        rowCount: 1,
      }));
    });

    it('should record query even on error', async () => {
      vi.spyOn(watcher, 'record');
      const interceptor = createQueryInterceptor(watcher);

      const error = new Error('Query failed');
      const queryFn = vi.fn().mockRejectedValue(error);
      const wrapped = interceptor.wrap(queryFn, (sql) => sql);

      await expect(wrapped('SELECT * FROM bad_table')).rejects.toThrow('Query failed');

      expect(watcher.record).toHaveBeenCalledWith(expect.objectContaining({
        sql: 'SELECT * FROM bad_table',
      }));
    });

    it('should track duration', async () => {
      vi.spyOn(watcher, 'record');
      const interceptor = createQueryInterceptor(watcher);

      const queryFn = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return [];
      });
      const wrapped = interceptor.wrap(queryFn, () => 'SELECT 1');

      await wrapped();

      const recordCall = (watcher.record as any).mock.calls[0][0];
      expect(recordCall.duration).toBeGreaterThanOrEqual(40);
    });
  });
});
