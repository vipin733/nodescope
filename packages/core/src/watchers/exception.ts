import { BaseWatcher } from './base.js';
import type { Entry, ExceptionEntryContent, ExceptionWatcherOptions } from '../types.js';

/**
 * Exception watcher - captures errors and exceptions
 */
export class ExceptionWatcher extends BaseWatcher<ExceptionEntryContent> {
  readonly type = 'exception' as const;

  constructor(options: ExceptionWatcherOptions = {}) {
    super();
    this.enabled = options.enabled ?? true;
  }

  /**
   * Record an exception
   */
  record(data: {
    batchId?: string;
    error: Error;
    context?: Record<string, unknown>;
  }): Entry {
    const content = this.errorToContent(data.error, data.context);

    const tags = ['error', `class:${content.class}`];
    
    return this.createEntry(content, {
      batchId: data.batchId,
      tags,
    });
  }

  private errorToContent(
    error: Error,
    context?: Record<string, unknown>
  ): ExceptionEntryContent {
    const { file, line } = this.extractLocation(error.stack);

    const content: ExceptionEntryContent = {
      class: error.name || 'Error',
      message: error.message,
      stack: error.stack || '',
      file,
      line,
      context,
    };

    // Handle nested errors (cause)
    if ('cause' in error && error.cause instanceof Error) {
      content.previous = this.errorToContent(error.cause);
    }

    return content;
  }

  private extractLocation(stack?: string): { file?: string; line?: number } {
    if (!stack) return {};

    // Try to parse the first stack frame
    const lines = stack.split('\n');
    for (const line of lines) {
      // Match patterns like "at Function.x (/path/to/file.js:10:5)"
      const match = line.match(/at\s+(?:.+?\s+)?\(?(.+?):(\d+):\d+\)?/);
      if (match) {
        return {
          file: match[1],
          line: parseInt(match[2], 10),
        };
      }
    }

    return {};
  }
}

/**
 * Set up global error handlers to capture uncaught exceptions
 */
export function setupGlobalErrorHandlers(
  watcher: ExceptionWatcher,
  onEntry: (entry: Entry) => void
): () => void {
  const handleUncaughtException = (error: Error) => {
    const entry = watcher.record({
      error,
      context: { uncaught: true, type: 'uncaughtException' },
    });
    onEntry(entry);
  };

  const handleUnhandledRejection = (reason: unknown) => {
    const error = reason instanceof Error 
      ? reason 
      : new Error(String(reason));
    
    const entry = watcher.record({
      error,
      context: { uncaught: true, type: 'unhandledRejection' },
    });
    onEntry(entry);
  };

  process.on('uncaughtException', handleUncaughtException);
  process.on('unhandledRejection', handleUnhandledRejection);

  // Return cleanup function
  return () => {
    process.removeListener('uncaughtException', handleUncaughtException);
    process.removeListener('unhandledRejection', handleUnhandledRejection);
  };
}
