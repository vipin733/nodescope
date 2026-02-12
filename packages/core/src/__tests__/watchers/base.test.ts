import { describe, it, expect, vi } from 'vitest';
import {
  createRequestContext,
  getDuration,
  getMemoryDelta,
  RequestContext,
} from '../../watchers/base.js';

describe('BaseWatcher utilities', () => {
  describe('createRequestContext', () => {
    it('should create context with batchId', () => {
      const ctx = createRequestContext();
      
      expect(ctx.batchId).toBeDefined();
      expect(typeof ctx.batchId).toBe('string');
      expect(ctx.batchId.length).toBeGreaterThan(0);
    });

    it('should create context with startTime', () => {
      const before = performance.now();
      const ctx = createRequestContext();
      const after = performance.now();
      
      expect(ctx.startTime).toBeGreaterThanOrEqual(before);
      expect(ctx.startTime).toBeLessThanOrEqual(after);
    });

    it('should create context with startMemory', () => {
      const ctx = createRequestContext();
      
      expect(ctx.startMemory).toBeDefined();
      expect(typeof ctx.startMemory).toBe('number');
    });

    it('should generate unique batchIds', () => {
      const ctx1 = createRequestContext();
      const ctx2 = createRequestContext();
      
      expect(ctx1.batchId).not.toBe(ctx2.batchId);
    });
  });

  describe('getDuration', () => {
    it('should calculate duration in milliseconds', async () => {
      const ctx = createRequestContext();
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const duration = getDuration(ctx);
      
      expect(duration).toBeGreaterThanOrEqual(40); // Allow some tolerance
      expect(duration).toBeLessThan(200);
    });

    it('should return rounded integer', () => {
      const ctx: RequestContext = {
        batchId: 'test',
        startTime: performance.now() - 10.7,
      };
      
      const duration = getDuration(ctx);
      
      expect(Number.isInteger(duration)).toBe(true);
    });
  });

  describe('getMemoryDelta', () => {
    it('should calculate memory delta', () => {
      const ctx: RequestContext = {
        batchId: 'test',
        startTime: performance.now(),
        startMemory: process.memoryUsage().heapUsed - 1000,
      };
      
      const delta = getMemoryDelta(ctx);
      
      expect(delta).toBeDefined();
      expect(typeof delta).toBe('number');
    });

    it('should return undefined when startMemory not set', () => {
      const ctx: RequestContext = {
        batchId: 'test',
        startTime: performance.now(),
        startMemory: undefined,
      };
      
      const delta = getMemoryDelta(ctx);
      
      expect(delta).toBeUndefined();
    });
  });
});
