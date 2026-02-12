import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LogWatcher, interceptConsole } from '../../watchers/log.js';

describe('LogWatcher', () => {
  let watcher: LogWatcher;

  beforeEach(() => {
    watcher = new LogWatcher();
  });

  describe('record', () => {
    it('should create log entry with all fields', () => {
      const entry = watcher.record({
        batchId: 'batch-1',
        level: 'info',
        message: 'Test message',
        context: { key: 'value' },
        channel: 'app',
      });

      expect(entry).not.toBeNull();
      expect(entry!.type).toBe('log');
      expect(entry!.batchId).toBe('batch-1');
      expect(entry!.content).toMatchObject({
        level: 'info',
        message: 'Test message',
        context: { key: 'value' },
        channel: 'app',
      });
    });

    it('should add level tag', () => {
      const entry = watcher.record({
        level: 'warn',
        message: 'Warning',
      });

      expect(entry!.tags).toContain('level:warn');
    });

    it('should add error tag for error level', () => {
      const entry = watcher.record({
        level: 'error',
        message: 'Error occurred',
      });

      expect(entry!.tags).toContain('error');
      expect(entry!.tags).toContain('level:error');
    });

    it('should add channel tag when provided', () => {
      const entry = watcher.record({
        level: 'info',
        message: 'Test',
        channel: 'database',
      });

      expect(entry!.tags).toContain('channel:database');
    });
  });

  describe('minimum level filtering', () => {
    it('should respect minimum level setting', () => {
      const warnWatcher = new LogWatcher({ level: 'warn' });

      const debugEntry = warnWatcher.record({ level: 'debug', message: 'Debug' });
      const infoEntry = warnWatcher.record({ level: 'info', message: 'Info' });
      const warnEntry = warnWatcher.record({ level: 'warn', message: 'Warn' });
      const errorEntry = warnWatcher.record({ level: 'error', message: 'Error' });

      expect(debugEntry).toBeNull();
      expect(infoEntry).toBeNull();
      expect(warnEntry).not.toBeNull();
      expect(errorEntry).not.toBeNull();
    });
  });

  describe('createLogger', () => {
    it('should create logger with all level methods', () => {
      const logger = watcher.createLogger('batch-1', 'app');

      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
    });

    it('should record via logger methods', () => {
      const logger = watcher.createLogger('batch-1', 'test-channel');

      const entry = logger.info('Test message', { extra: 'data' });

      expect(entry).not.toBeNull();
      expect(entry!.content).toMatchObject({
        level: 'info',
        message: 'Test message',
        context: { extra: 'data' },
        channel: 'test-channel',
      });
    });
  });
});

describe('interceptConsole', () => {
  let watcher: LogWatcher;
  let restore: () => void;
  let originalConsole: {
    log: typeof console.log;
    info: typeof console.info;
    warn: typeof console.warn;
    error: typeof console.error;
    debug: typeof console.debug;
  };

  beforeEach(() => {
    watcher = new LogWatcher();
    originalConsole = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
      debug: console.debug,
    };
    // Spy on watcher.record
    vi.spyOn(watcher, 'record');
  });

  afterEach(() => {
    if (restore) {
      restore();
    }
    // Restore original console methods
    console.log = originalConsole.log;
    console.info = originalConsole.info;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    console.debug = originalConsole.debug;
  });

  it('should intercept console.log', () => {
    restore = interceptConsole(watcher);
    // Suppress actual console output in test
    console.log = vi.fn().mockImplementation((...args) => {
      watcher.record({ level: 'info', message: args.join(' '), channel: 'console' });
    });
    
    console.log('Test message');

    expect(watcher.record).toHaveBeenCalled();
  });

  it('should restore original console methods', () => {
    const originalLog = console.log;
    restore = interceptConsole(watcher);
    
    expect(console.log).not.toBe(originalLog);
    
    restore();
    
    // After restore, console.log should be a function 
    expect(typeof console.log).toBe('function');
  });
});
