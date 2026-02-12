import { BaseWatcher } from './base.js';
import type { Entry, HttpClientEntryContent, HttpClientWatcherOptions, HttpMethod } from '../types.js';

const DEFAULT_SIZE_LIMIT = 64; // KB

/**
 * HTTP Client watcher - captures outgoing HTTP requests
 */
export class HttpClientWatcher extends BaseWatcher<HttpClientEntryContent> {
  readonly type = 'http_client' as const;
  
  private sizeLimit: number;

  constructor(options: HttpClientWatcherOptions = {}) {
    super();
    this.enabled = options.enabled ?? true;
    this.sizeLimit = options.sizeLimit ?? DEFAULT_SIZE_LIMIT;
  }

  /**
   * Record an outgoing HTTP request
   */
  record(data: {
    batchId?: string;
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: unknown;
    response: {
      status: number;
      headers: Record<string, string>;
      body?: unknown;
    };
    duration: number;
  }): Entry {
    const content: HttpClientEntryContent = {
      method: data.method.toUpperCase() as HttpMethod,
      url: data.url,
      headers: this.sanitizeHeaders(data.headers),
      body: this.truncateBody(data.body),
      response: {
        status: data.response.status,
        headers: data.response.headers,
        body: this.truncateBody(data.response.body),
        size: this.getBodySize(data.response.body),
      },
    };

    const tags = [
      `method:${content.method}`,
      `status:${content.response.status}`,
    ];

    if (content.response.status >= 400) {
      tags.push('error');
    }

    // Extract domain for tagging
    try {
      const url = new URL(data.url);
      tags.push(`host:${url.host}`);
    } catch {
      // Invalid URL, skip host tag
    }

    return this.createEntry(content, {
      batchId: data.batchId,
      duration: data.duration,
      tags,
    });
  }

  private sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
    const sanitized: Record<string, string> = {};
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'api-key'];
    
    for (const [key, value] of Object.entries(headers)) {
      if (sensitiveHeaders.includes(key.toLowerCase())) {
        sanitized[key] = '[HIDDEN]';
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }

  private truncateBody(body: unknown): unknown {
    if (body === undefined || body === null) return body;
    
    try {
      const serialized = JSON.stringify(body);
      const sizeKB = Buffer.byteLength(serialized, 'utf8') / 1024;
      
      if (sizeKB > this.sizeLimit) {
        return `[TRUNCATED - ${Math.round(sizeKB)}KB]`;
      }
      
      return body;
    } catch {
      return '[UNSERIALIZABLE]';
    }
  }

  private getBodySize(body: unknown): number | undefined {
    if (body === undefined || body === null) return undefined;
    try {
      return Buffer.byteLength(JSON.stringify(body), 'utf8');
    } catch {
      return undefined;
    }
  }
}

/**
 * Wrap the global fetch to track outgoing requests
 */
export function wrapFetch(watcher: HttpClientWatcher, batchIdFn?: () => string | undefined): typeof fetch {
  const originalFetch = globalThis.fetch;

  return async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const startTime = performance.now();
    
    // Extract request details
    const url = typeof input === 'string' 
      ? input 
      : input instanceof URL 
        ? input.toString() 
        : input.url;
    
    const method = init?.method || (typeof input === 'object' && 'method' in input ? input.method : 'GET');
    const headers = init?.headers 
      ? Object.fromEntries(
          init.headers instanceof Headers 
            ? init.headers.entries() 
            : Array.isArray(init.headers) 
              ? init.headers 
              : Object.entries(init.headers)
        )
      : {};
    
    let requestBody: unknown;
    if (init?.body) {
      try {
        requestBody = typeof init.body === 'string' ? JSON.parse(init.body) : init.body;
      } catch {
        requestBody = init.body;
      }
    }

    try {
      const response = await originalFetch(input, init);
      const duration = Math.round(performance.now() - startTime);

      // Clone response to read body
      const clonedResponse = response.clone();
      let responseBody: unknown;
      try {
        responseBody = await clonedResponse.json();
      } catch {
        try {
          responseBody = await clonedResponse.text();
        } catch {
          responseBody = undefined;
        }
      }

      watcher.record({
        batchId: batchIdFn?.(),
        method: method || 'GET',
        url,
        headers,
        body: requestBody,
        response: {
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
          body: responseBody,
        },
        duration,
      });

      return response;
    } catch (error) {
      const duration = Math.round(performance.now() - startTime);

      watcher.record({
        batchId: batchIdFn?.(),
        method: method || 'GET',
        url,
        headers,
        body: requestBody,
        response: {
          status: 0,
          headers: {},
          body: error instanceof Error ? error.message : String(error),
        },
        duration,
      });

      throw error;
    }
  };
}

/**
 * Install fetch wrapper globally
 */
export function interceptFetch(watcher: HttpClientWatcher, batchIdFn?: () => string | undefined): () => void {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = wrapFetch(watcher, batchIdFn);
  
  return () => {
    globalThis.fetch = originalFetch;
  };
}
