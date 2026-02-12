import { nanoid } from 'nanoid';
import type { Entry, EntryType } from '../types.js';

/**
 * Base class for all watchers.
 * Provides common functionality for creating entries.
 */
export abstract class BaseWatcher<TContent = unknown> {
  /** The type of entries this watcher creates */
  abstract readonly type: EntryType;

  /** Whether this watcher is enabled */
  enabled: boolean = true;

  /**
   * Create an entry from captured data
   */
  protected createEntry(
    content: TContent,
    options: {
      batchId?: string;
      tags?: string[];
      duration?: number;
      memoryUsage?: number;
    } = {}
  ): Entry {
    return {
      id: nanoid(),
      batchId: options.batchId ?? nanoid(),
      type: this.type,
      content: content as Record<string, unknown>,
      tags: options.tags ?? [],
      createdAt: new Date(),
      duration: options.duration,
      memoryUsage: options.memoryUsage,
    };
  }

  /**
   * Optional filter to exclude certain entries
   */
  filter?(entry: Entry): boolean;

  /**
   * Optional callback to add custom tags
   */
  tag?(entry: Entry): string[];
}

/**
 * Context passed through the request lifecycle
 */
export interface RequestContext {
  batchId: string;
  startTime: number;
  startMemory?: number;
}

/**
 * Create a new request context
 */
export function createRequestContext(): RequestContext {
  return {
    batchId: nanoid(),
    startTime: performance.now(),
    startMemory: process.memoryUsage?.()?.heapUsed,
  };
}

/**
 * Calculate duration from request context
 */
export function getDuration(ctx: RequestContext): number {
  return Math.round(performance.now() - ctx.startTime);
}

/**
 * Calculate memory delta from request context
 */
export function getMemoryDelta(ctx: RequestContext): number | undefined {
  if (ctx.startMemory === undefined) return undefined;
  const currentMemory = process.memoryUsage?.()?.heapUsed;
  if (currentMemory === undefined) return undefined;
  return currentMemory - ctx.startMemory;
}
