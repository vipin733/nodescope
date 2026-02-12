import { BaseWatcher } from './base.js';
import type { Entry, RequestEntryContent, RequestWatcherOptions, HttpMethod } from '../types.js';

const DEFAULT_SIZE_LIMIT = 64; // KB
const DEFAULT_HIDE_HEADERS = ['authorization', 'cookie', 'set-cookie'];

/**
 * Request watcher - captures HTTP requests and responses
 */
export class RequestWatcher extends BaseWatcher<RequestEntryContent> {
  readonly type = 'request' as const;
  
  private options: Required<RequestWatcherOptions>;

  constructor(options: RequestWatcherOptions = {}) {
    super();
    this.enabled = options.enabled ?? true;
    this.options = {
      enabled: options.enabled ?? true,
      sizeLimit: options.sizeLimit ?? DEFAULT_SIZE_LIMIT,
      ignorePaths: options.ignorePaths ?? ['/_nodescope', '/favicon.ico'],
      captureBody: options.captureBody ?? true,
      captureResponse: options.captureResponse ?? true,
      hideHeaders: options.hideHeaders ?? DEFAULT_HIDE_HEADERS,
    };
  }

  /**
   * Record a request/response pair
   */
  record(data: {
    batchId: string;
    startTime: number;
    method: string;
    url: string;
    path: string;
    query: Record<string, string | string[]>;
    headers: Record<string, string>;
    body?: unknown;
    ip?: string;
    userAgent?: string;
    session?: Record<string, unknown>;
    response: {
      status: number;
      headers: Record<string, string>;
      body?: unknown;
    };
    middleware?: string[];
    controllerAction?: string;
  }): Entry | null {
    // Check if path should be ignored
    if (this.options.ignorePaths.some(p => data.path.startsWith(p))) {
      return null;
    }

    const duration = Math.round(performance.now() - data.startTime);

    // Filter headers
    const filteredHeaders = this.filterHeaders(data.headers);
    const filteredResponseHeaders = this.filterHeaders(data.response.headers);

    // Truncate bodies if needed
    const requestBody = this.options.captureBody 
      ? this.truncateBody(data.body) 
      : undefined;
    
    const responseBody = this.options.captureResponse 
      ? this.truncateBody(data.response.body) 
      : undefined;

    const content: RequestEntryContent = {
      method: data.method.toUpperCase() as HttpMethod,
      url: data.url,
      path: data.path,
      query: data.query,
      headers: filteredHeaders,
      body: requestBody,
      ip: data.ip,
      userAgent: data.userAgent,
      session: data.session,
      response: {
        status: data.response.status,
        headers: filteredResponseHeaders,
        body: responseBody,
        size: this.getBodySize(data.response.body),
      },
      middleware: data.middleware,
      controllerAction: data.controllerAction,
    };

    const entry = this.createEntry(content, {
      batchId: data.batchId,
      duration,
      tags: this.generateTags(content),
    });

    return entry;
  }

  private filterHeaders(headers: Record<string, string>): Record<string, string> {
    const filtered: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      if (this.options.hideHeaders.includes(key.toLowerCase())) {
        filtered[key] = '[HIDDEN]';
      } else {
        filtered[key] = value;
      }
    }
    return filtered;
  }

  private truncateBody(body: unknown): unknown {
    if (body === undefined || body === null) return body;
    
    const serialized = JSON.stringify(body);
    const sizeKB = Buffer.byteLength(serialized, 'utf8') / 1024;
    
    if (sizeKB > this.options.sizeLimit) {
      return `[TRUNCATED - ${Math.round(sizeKB)}KB exceeds ${this.options.sizeLimit}KB limit]`;
    }
    
    return body;
  }

  private getBodySize(body: unknown): number | undefined {
    if (body === undefined || body === null) return undefined;
    try {
      return Buffer.byteLength(JSON.stringify(body), 'utf8');
    } catch {
      return undefined;
    }
  }

  private generateTags(content: RequestEntryContent): string[] {
    const tags: string[] = [];
    
    tags.push(`method:${content.method}`);
    tags.push(`status:${content.response.status}`);
    
    if (content.response.status >= 400) {
      tags.push('error');
    }
    if (content.response.status >= 500) {
      tags.push('server-error');
    }
    
    return tags;
  }
}
