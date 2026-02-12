import { BaseWatcher } from './base.js';
import type { Entry, JobEntryContent, JobWatcherOptions, JobStatus } from '../types.js';

/**
 * Job watcher - captures background job processing
 */
export class JobWatcher extends BaseWatcher<JobEntryContent> {
  readonly type = 'job' as const;

  constructor(options: JobWatcherOptions = {}) {
    super();
    this.enabled = options.enabled ?? true;
  }

  /**
   * Record a job
   */
  record(data: {
    batchId?: string;
    name: string;
    queue?: string;
    data?: unknown;
    status: JobStatus;
    attempts?: number;
    maxAttempts?: number;
    error?: string;
    duration?: number;
  }): Entry {
    const content: JobEntryContent = {
      name: data.name,
      queue: data.queue ?? 'default',
      data: data.data,
      status: data.status,
      attempts: data.attempts ?? 1,
      maxAttempts: data.maxAttempts,
      error: data.error,
    };

    const tags = [
      `status:${data.status}`,
      `queue:${content.queue}`,
      `job:${data.name}`,
    ];

    if (data.status === 'failed') {
      tags.push('failed');
    }

    return this.createEntry(content, {
      batchId: data.batchId,
      duration: data.duration,
      tags,
    });
  }

  /**
   * Create a job tracker that can be used to track job lifecycle
   */
  createJobTracker(
    name: string,
    options: {
      batchId?: string;
      queue?: string;
      data?: unknown;
      maxAttempts?: number;
    } = {}
  ) {
    let attempts = 0;
    const { batchId, queue, data, maxAttempts } = options;

    return {
      start: () => {
        attempts++;
        return this.record({
          batchId,
          name,
          queue,
          data,
          status: 'processing',
          attempts,
          maxAttempts,
        });
      },
      
      complete: (duration?: number) => {
        return this.record({
          batchId,
          name,
          queue,
          data,
          status: 'completed',
          attempts,
          maxAttempts,
          duration,
        });
      },
      
      fail: (error: Error | string, duration?: number) => {
        return this.record({
          batchId,
          name,
          queue,
          data,
          status: 'failed',
          attempts,
          maxAttempts,
          error: error instanceof Error ? error.message : error,
          duration,
        });
      },
    };
  }
}

/**
 * Wrap a job processor function to automatically track execution
 */
export function wrapJobProcessor<TData, TResult>(
  watcher: JobWatcher,
  name: string,
  processor: (data: TData) => Promise<TResult>,
  options: { queue?: string; maxAttempts?: number } = {}
): (data: TData) => Promise<TResult> {
  return async (data: TData): Promise<TResult> => {
    const tracker = watcher.createJobTracker(name, {
      queue: options.queue,
      data,
      maxAttempts: options.maxAttempts,
    });

    const startTime = performance.now();
    tracker.start();

    try {
      const result = await processor(data);
      const duration = Math.round(performance.now() - startTime);
      tracker.complete(duration);
      return result;
    } catch (error) {
      const duration = Math.round(performance.now() - startTime);
      tracker.fail(error instanceof Error ? error : String(error), duration);
      throw error;
    }
  };
}
