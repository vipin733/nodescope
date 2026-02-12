import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JobWatcher, wrapJobProcessor } from '../../watchers/job.js';

describe('JobWatcher', () => {
  let watcher: JobWatcher;

  beforeEach(() => {
    watcher = new JobWatcher();
  });

  describe('record', () => {
    it('should create job entry', () => {
      const entry = watcher.record({
        batchId: 'batch-1',
        name: 'SendEmail',
        queue: 'emails',
        data: { to: 'user@example.com' },
        status: 'processing',
        attempts: 1,
        maxAttempts: 3,
      });

      expect(entry.type).toBe('job');
      expect(entry.batchId).toBe('batch-1');
      expect(entry.content).toMatchObject({
        name: 'SendEmail',
        queue: 'emails',
        data: { to: 'user@example.com' },
        status: 'processing',
        attempts: 1,
        maxAttempts: 3,
      });
    });

    it('should use default queue when not specified', () => {
      const entry = watcher.record({
        name: 'TestJob',
        status: 'pending',
      });

      expect((entry.content as any).queue).toBe('default');
    });

    it('should add status, queue and job tags', () => {
      const entry = watcher.record({
        name: 'ProcessOrder',
        queue: 'orders',
        status: 'completed',
      });

      expect(entry.tags).toContain('status:completed');
      expect(entry.tags).toContain('queue:orders');
      expect(entry.tags).toContain('job:ProcessOrder');
    });

    it('should add failed tag for failed jobs', () => {
      const entry = watcher.record({
        name: 'FailedJob',
        status: 'failed',
        error: 'Connection timeout',
      });

      expect(entry.tags).toContain('failed');
      expect((entry.content as any).error).toBe('Connection timeout');
    });

    it('should include duration when provided', () => {
      const entry = watcher.record({
        name: 'TestJob',
        status: 'completed',
        duration: 1500,
      });

      expect(entry.duration).toBe(1500);
    });
  });

  describe('createJobTracker', () => {
    it('should create tracker with start, complete, and fail methods', () => {
      const tracker = watcher.createJobTracker('TestJob');

      expect(typeof tracker.start).toBe('function');
      expect(typeof tracker.complete).toBe('function');
      expect(typeof tracker.fail).toBe('function');
    });

    it('should track processing status on start', () => {
      vi.spyOn(watcher, 'record');
      const tracker = watcher.createJobTracker('TestJob', { queue: 'test' });

      tracker.start();

      expect(watcher.record).toHaveBeenCalledWith(expect.objectContaining({
        name: 'TestJob',
        queue: 'test',
        status: 'processing',
        attempts: 1,
      }));
    });

    it('should track completion status', () => {
      vi.spyOn(watcher, 'record');
      const tracker = watcher.createJobTracker('TestJob');

      tracker.start();
      tracker.complete(500);

      expect(watcher.record).toHaveBeenLastCalledWith(expect.objectContaining({
        name: 'TestJob',
        status: 'completed',
        duration: 500,
      }));
    });

    it('should track failure status with error', () => {
      vi.spyOn(watcher, 'record');
      const tracker = watcher.createJobTracker('TestJob');

      tracker.start();
      tracker.fail(new Error('Test error'), 100);

      expect(watcher.record).toHaveBeenLastCalledWith(expect.objectContaining({
        name: 'TestJob',
        status: 'failed',
        error: 'Test error',
        duration: 100,
      }));
    });

    it('should increment attempts on multiple starts', () => {
      vi.spyOn(watcher, 'record');
      const tracker = watcher.createJobTracker('RetryJob');

      tracker.start();
      tracker.start();
      tracker.start();

      const calls = (watcher.record as any).mock.calls;
      expect(calls[0][0].attempts).toBe(1);
      expect(calls[1][0].attempts).toBe(2);
      expect(calls[2][0].attempts).toBe(3);
    });
  });

  describe('enabled state', () => {
    it('should be enabled by default', () => {
      expect(watcher.enabled).toBe(true);
    });

    it('should respect enabled option', () => {
      const disabledWatcher = new JobWatcher({ enabled: false });
      expect(disabledWatcher.enabled).toBe(false);
    });
  });
});

describe('wrapJobProcessor', () => {
  let watcher: JobWatcher;

  beforeEach(() => {
    watcher = new JobWatcher();
  });

  it('should wrap processor and track successful execution', async () => {
    vi.spyOn(watcher, 'record');
    
    const processor = vi.fn().mockResolvedValue('result');
    const wrapped = wrapJobProcessor(watcher, 'TestJob', processor);

    const result = await wrapped({ input: 'data' });

    expect(result).toBe('result');
    expect(processor).toHaveBeenCalledWith({ input: 'data' });
    
    // Should have recorded start and complete
    expect(watcher.record).toHaveBeenCalledTimes(2);
  });

  it('should track failed execution and rethrow error', async () => {
    vi.spyOn(watcher, 'record');
    
    const error = new Error('Process failed');
    const processor = vi.fn().mockRejectedValue(error);
    const wrapped = wrapJobProcessor(watcher, 'FailingJob', processor);

    await expect(wrapped({})).rejects.toThrow('Process failed');
    
    // Should have recorded start and fail
    expect(watcher.record).toHaveBeenCalledTimes(2);
  });
});
