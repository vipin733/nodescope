import { BaseWatcher } from './base.js';
import type { Entry, LogEntryContent, LogWatcherOptions, LogLevel } from '../types.js';

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Log watcher - captures application logs
 */
export class LogWatcher extends BaseWatcher<LogEntryContent> {
  readonly type = 'log' as const;
  
  private minLevel: LogLevel;

  constructor(options: LogWatcherOptions = {}) {
    super();
    this.enabled = options.enabled ?? true;
    this.minLevel = options.level ?? 'debug';
  }

  /**
   * Record a log entry
   */
  record(data: {
    batchId?: string;
    level: LogLevel;
    message: string;
    context?: Record<string, unknown>;
    channel?: string;
  }): Entry | null {
    // Check minimum level
    if (LOG_LEVEL_PRIORITY[data.level] < LOG_LEVEL_PRIORITY[this.minLevel]) {
      return null;
    }

    const content: LogEntryContent = {
      level: data.level,
      message: data.message,
      context: data.context,
      channel: data.channel,
    };

    const tags = [`level:${data.level}`];
    if (data.level === 'error') {
      tags.push('error');
    }
    if (data.channel) {
      tags.push(`channel:${data.channel}`);
    }

    return this.createEntry(content, {
      batchId: data.batchId,
      tags,
    });
  }

  /**
   * Create a logger instance that automatically records to NodeScope
   */
  createLogger(batchId?: string, channel?: string) {
    return {
      debug: (message: string, context?: Record<string, unknown>) => {
        return this.record({ batchId, level: 'debug', message, context, channel });
      },
      info: (message: string, context?: Record<string, unknown>) => {
        return this.record({ batchId, level: 'info', message, context, channel });
      },
      warn: (message: string, context?: Record<string, unknown>) => {
        return this.record({ batchId, level: 'warn', message, context, channel });
      },
      error: (message: string, context?: Record<string, unknown>) => {
        return this.record({ batchId, level: 'error', message, context, channel });
      },
    };
  }
}

/**
 * Intercept console methods to capture logs
 */
export function interceptConsole(watcher: LogWatcher, batchIdFn?: () => string | undefined): () => void {
  const originalConsole = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
    debug: console.debug,
  };

  const createInterceptor = (level: LogLevel, original: typeof console.log) => {
    return (...args: unknown[]) => {
      // Call original
      original.apply(console, args);

      // Record to watcher
      const message = args
        .map((arg) => {
          if (typeof arg === 'string') return arg;
          try {
            return JSON.stringify(arg);
          } catch {
            return String(arg);
          }
        })
        .join(' ');

      watcher.record({
        batchId: batchIdFn?.(),
        level,
        message,
        channel: 'console',
      });
    };
  };

  console.log = createInterceptor('info', originalConsole.log);
  console.info = createInterceptor('info', originalConsole.info);
  console.warn = createInterceptor('warn', originalConsole.warn);
  console.error = createInterceptor('error', originalConsole.error);
  console.debug = createInterceptor('debug', originalConsole.debug);

  // Return restore function
  return () => {
    console.log = originalConsole.log;
    console.info = originalConsole.info;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    console.debug = originalConsole.debug;
  };
}
