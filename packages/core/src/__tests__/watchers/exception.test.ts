import { describe, it, expect, beforeEach } from 'vitest';
import { ExceptionWatcher } from '../../watchers/exception.js';

describe('ExceptionWatcher', () => {
  let watcher: ExceptionWatcher;

  beforeEach(() => {
    watcher = new ExceptionWatcher();
  });

  describe('record', () => {
    it('should create exception entry from Error', () => {
      const error = new Error('Test error message');
      
      const entry = watcher.record({
        batchId: 'batch-1',
        error,
      });

      expect(entry.type).toBe('exception');
      expect(entry.batchId).toBe('batch-1');
      expect(entry.content).toMatchObject({
        class: 'Error',
        message: 'Test error message',
      });
      expect((entry.content as any).stack).toBeDefined();
    });

    it('should handle custom error types', () => {
      class CustomError extends Error {
        constructor(message: string) {
          super(message);
          this.name = 'CustomError';
        }
      }

      const error = new CustomError('Custom error message');
      const entry = watcher.record({ error });

      expect(entry.content).toMatchObject({
        class: 'CustomError',
        message: 'Custom error message',
      });
    });

    it('should include error tag', () => {
      const entry = watcher.record({
        error: new Error('Test'),
      });

      expect(entry.tags).toContain('error');
    });

    it('should include class tag', () => {
      const entry = watcher.record({
        error: new TypeError('Type error'),
      });

      expect(entry.tags).toContain('class:TypeError');
    });

    it('should include context when provided', () => {
      const entry = watcher.record({
        error: new Error('Test'),
        context: { userId: '123', action: 'login' },
      });

      expect((entry.content as any).context).toEqual({
        userId: '123',
        action: 'login',
      });
    });

    it('should extract file and line from stack trace', () => {
      const error = new Error('Test error');
      const entry = watcher.record({ error });

      // The file and line should be extracted from the stack
      // (exact values depend on where this test runs)
      expect(typeof (entry.content as any).file).toBe('string');
    });

    it('should handle nested errors with cause', () => {
      const cause = new Error('Root cause');
      const error = new Error('Wrapper error', { cause });

      const entry = watcher.record({ error });

      expect((entry.content as any).previous).toBeDefined();
      expect((entry.content as any).previous.message).toBe('Root cause');
    });
  });

  describe('enabled state', () => {
    it('should be enabled by default', () => {
      expect(watcher.enabled).toBe(true);
    });

    it('should respect enabled option', () => {
      const disabledWatcher = new ExceptionWatcher({ enabled: false });
      expect(disabledWatcher.enabled).toBe(false);
    });
  });
});
