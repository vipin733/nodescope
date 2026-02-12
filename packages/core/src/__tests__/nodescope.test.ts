import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NodeScope, getNodeScope, initNodeScope } from '../nodescope.js';
import type { Entry, NodeScopeConfig } from '../types.js';

describe('NodeScope', () => {
  let nodescope: NodeScope;

  afterEach(async () => {
    if (nodescope) {
      await nodescope.close();
    }
  });

  describe('constructor', () => {
    it('should create instance with default config', () => {
      nodescope = new NodeScope();
      
      expect(nodescope.isEnabled).toBe(true);
      expect(nodescope.dashboardPath).toBe('/_nodescope');
    });

    it('should create instance with custom config', () => {
      nodescope = new NodeScope({
        enabled: false,
        dashboardPath: '/_debug',
        storage: 'memory',
      });
      
      expect(nodescope.isEnabled).toBe(false);
      expect(nodescope.dashboardPath).toBe('/_debug');
    });

    it('should initialize all watchers', () => {
      nodescope = new NodeScope();
      
      expect(nodescope.requestWatcher).toBeDefined();
      expect(nodescope.queryWatcher).toBeDefined();
      expect(nodescope.cacheWatcher).toBeDefined();
      expect(nodescope.logWatcher).toBeDefined();
      expect(nodescope.exceptionWatcher).toBeDefined();
      expect(nodescope.httpClientWatcher).toBeDefined();
      expect(nodescope.eventWatcher).toBeDefined();
      expect(nodescope.jobWatcher).toBeDefined();
    });

    it('should disable specific watchers via config', () => {
      nodescope = new NodeScope({
        watchers: {
          request: false,
          query: false,
          log: true,
        },
      });
      
      expect(nodescope.requestWatcher.enabled).toBe(false);
      expect(nodescope.queryWatcher.enabled).toBe(false);
      expect(nodescope.logWatcher.enabled).toBe(true);
    });
  });

  describe('initialize', () => {
    it('should initialize storage and API handler', async () => {
      nodescope = new NodeScope({ storage: 'memory' });
      await nodescope.initialize();
      
      expect(nodescope.getStorage()).toBeDefined();
      expect(nodescope.api).toBeDefined();
    });

    it('should not initialize twice', async () => {
      nodescope = new NodeScope({ storage: 'memory' });
      await nodescope.initialize();
      const storage1 = nodescope.getStorage();
      
      await nodescope.initialize();
      const storage2 = nodescope.getStorage();
      
      expect(storage1).toBe(storage2);
    });
  });

  describe('createContext', () => {
    it('should create request context with batchId and startTime', () => {
      nodescope = new NodeScope();
      const ctx = nodescope.createContext();
      
      expect(ctx.batchId).toBeDefined();
      expect(typeof ctx.batchId).toBe('string');
      expect(ctx.startTime).toBeDefined();
      expect(typeof ctx.startTime).toBe('number');
    });

    it('should update current batchId', () => {
      nodescope = new NodeScope();
      const ctx = nodescope.createContext();
      
      expect(nodescope.batchId).toBe(ctx.batchId);
    });
  });

  describe('recordEntry', () => {
    it('should save entry to storage', async () => {
      nodescope = new NodeScope({ storage: 'memory' });
      await nodescope.initialize();
      
      const entry: Entry = {
        id: 'test-1',
        batchId: 'batch-1',
        type: 'log',
        content: { level: 'info', message: 'Test' },
        tags: [],
        createdAt: new Date(),
      };
      
      await nodescope.recordEntry(entry);
      
      const found = await nodescope.getStorage().find('test-1');
      expect(found).toBeDefined();
      expect(found?.id).toBe('test-1');
    });

    it('should not record when disabled', async () => {
      nodescope = new NodeScope({ storage: 'memory', enabled: false });
      await nodescope.initialize();
      
      const entry: Entry = {
        id: 'test-2',
        batchId: 'batch-1',
        type: 'log',
        content: { level: 'info', message: 'Test' },
        tags: [],
        createdAt: new Date(),
      };
      
      await nodescope.recordEntry(entry);
      
      const found = await nodescope.getStorage().find('test-2');
      expect(found).toBeNull();
    });

    it('should apply custom filter', async () => {
      nodescope = new NodeScope({
        storage: 'memory',
        filter: (entry) => entry.type !== 'log',
      });
      await nodescope.initialize();
      
      const entry: Entry = {
        id: 'test-3',
        batchId: 'batch-1',
        type: 'log',
        content: { level: 'info', message: 'Test' },
        tags: [],
        createdAt: new Date(),
      };
      
      await nodescope.recordEntry(entry);
      
      const found = await nodescope.getStorage().find('test-3');
      expect(found).toBeNull();
    });

    it('should apply custom tags', async () => {
      nodescope = new NodeScope({
        storage: 'memory',
        tag: () => ['custom-tag', 'another-tag'],
      });
      await nodescope.initialize();
      
      const entry: Entry = {
        id: 'test-4',
        batchId: 'batch-1',
        type: 'log',
        content: { level: 'info', message: 'Test' },
        tags: ['original'],
        createdAt: new Date(),
      };
      
      await nodescope.recordEntry(entry);
      
      const found = await nodescope.getStorage().find('test-4');
      expect(found?.tags).toContain('original');
      expect(found?.tags).toContain('custom-tag');
      expect(found?.tags).toContain('another-tag');
    });
  });

  describe('checkAuthorization', () => {
    it('should return true when no authorization configured', async () => {
      nodescope = new NodeScope();
      
      const result = await nodescope.checkAuthorization({});
      expect(result).toBe(true);
    });

    it('should use custom authorization callback', async () => {
      nodescope = new NodeScope({
        authorization: (req: any) => req.authorized === true,
      });
      
      const result1 = await nodescope.checkAuthorization({ authorized: true });
      expect(result1).toBe(true);
      
      const result2 = await nodescope.checkAuthorization({ authorized: false });
      expect(result2).toBe(false);
    });
  });
});

describe('Singleton functions', () => {
  it('getNodeScope should return same instance', () => {
    const instance1 = getNodeScope();
    const instance2 = getNodeScope();
    
    expect(instance1).toBe(instance2);
  });

  it('initNodeScope should initialize and return instance', async () => {
    const instance = await initNodeScope({ storage: 'memory' });
    
    expect(instance).toBeDefined();
    expect(instance.getStorage()).toBeDefined();
    
    await instance.close();
  });
});
