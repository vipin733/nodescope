import { BaseWatcher } from './base.js';
import type { Entry, EventEntryContent, EventWatcherOptions } from '../types.js';

/**
 * Event watcher - captures application events
 */
export class EventWatcher extends BaseWatcher<EventEntryContent> {
  readonly type = 'event' as const;
  
  private ignorePatterns: string[];

  constructor(options: EventWatcherOptions = {}) {
    super();
    this.enabled = options.enabled ?? true;
    this.ignorePatterns = options.ignore ?? [];
  }

  /**
   * Record an event
   */
  record(data: {
    batchId?: string;
    name: string;
    payload?: unknown;
    listeners?: string[];
    broadcast?: {
      channel: string;
      event: string;
    };
  }): Entry | null {
    // Check if event should be ignored
    if (this.ignorePatterns.some(pattern => data.name.includes(pattern))) {
      return null;
    }

    const content: EventEntryContent = {
      name: data.name,
      payload: data.payload,
      listeners: data.listeners ?? [],
      broadcast: data.broadcast,
    };

    const tags = [`event:${data.name}`];
    if (data.broadcast) {
      tags.push('broadcast');
      tags.push(`channel:${data.broadcast.channel}`);
    }

    return this.createEntry(content, {
      batchId: data.batchId,
      tags,
    });
  }
}

/**
 * Simple event emitter with NodeScope integration
 */
export class TrackedEventEmitter {
  private listeners: Map<string, Array<{ name: string; handler: Function }>> = new Map();
  private watcher: EventWatcher;
  private batchIdFn?: () => string | undefined;

  constructor(watcher: EventWatcher, batchIdFn?: () => string | undefined) {
    this.watcher = watcher;
    this.batchIdFn = batchIdFn;
  }

  on(event: string, handler: Function, handlerName?: string): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push({
      name: handlerName ?? (handler.name || 'anonymous'),
      handler,
    });
  }

  off(event: string, handler: Function): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      const index = handlers.findIndex(h => h.handler === handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  emit(event: string, payload?: unknown): void {
    const handlers = this.listeners.get(event) ?? [];
    const listenerNames = handlers.map(h => h.name);

    // Record the event
    this.watcher.record({
      batchId: this.batchIdFn?.(),
      name: event,
      payload,
      listeners: listenerNames,
    });

    // Call handlers
    for (const { handler } of handlers) {
      try {
        handler(payload);
      } catch (error) {
        console.error(`Error in event handler for ${event}:`, error);
      }
    }
  }

  listenerCount(event: string): number {
    return this.listeners.get(event)?.length ?? 0;
  }
}
