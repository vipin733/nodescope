import type { StorageAdapter } from '../storage/adapter.js';
import type { ListOptions, Entry, EntryType } from '../types.js';

interface ApiRequest {
  method: string;
  url: string;
  query: Record<string, string | string[] | undefined>;
  body?: unknown;
}

interface ApiResponse {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
}

/**
 * API handler for the NodeScope dashboard
 */
export class ApiHandler {
  constructor(private storage: StorageAdapter) {}

  /**
   * Handle an API request
   */
  async handle(req: ApiRequest): Promise<ApiResponse> {
    const path = new URL(req.url, 'http://localhost').pathname;

    try {
      // Route matching
      if (req.method === 'GET' && path === '/api/entries') {
        return this.listEntries(req);
      }

      if (req.method === 'GET' && path.match(/^\/api\/entries\/[^/]+$/)) {
        const id = path.split('/').pop()!;
        return this.getEntry(id);
      }

      if (req.method === 'GET' && path.match(/^\/api\/batch\/[^/]+$/)) {
        const batchId = path.split('/').pop()!;
        return this.getBatch(batchId);
      }

      if (req.method === 'GET' && path === '/api/stats') {
        return this.getStats();
      }

      if (req.method === 'DELETE' && path === '/api/entries') {
        return this.clearEntries();
      }

      if (req.method === 'POST' && path === '/api/prune') {
        return this.pruneEntries(req);
      }

      return {
        status: 404,
        body: { error: 'Not found' },
      };
    } catch (error) {
      console.error('NodeScope API error:', error);
      return {
        status: 500,
        body: { error: error instanceof Error ? error.message : 'Internal server error' },
      };
    }
  }

  private async listEntries(req: ApiRequest): Promise<ApiResponse> {
    const options: ListOptions = {};

    if (req.query.type) {
      options.type = String(req.query.type) as EntryType;
    }
    if (req.query.batchId) {
      options.batchId = String(req.query.batchId);
    }
    if (req.query.search) {
      options.search = String(req.query.search);
    }
    if (req.query.tags) {
      options.tags = Array.isArray(req.query.tags) 
        ? req.query.tags 
        : [String(req.query.tags)];
    }
    if (req.query.before) {
      options.before = new Date(String(req.query.before));
    }
    if (req.query.after) {
      options.after = new Date(String(req.query.after));
    }
    if (req.query.limit) {
      options.limit = parseInt(String(req.query.limit), 10);
    }
    if (req.query.offset) {
      options.offset = parseInt(String(req.query.offset), 10);
    }

    const result = await this.storage.list(options);

    return {
      status: 200,
      body: result,
    };
  }

  private async getEntry(id: string): Promise<ApiResponse> {
    const entry = await this.storage.find(id);

    if (!entry) {
      return {
        status: 404,
        body: { error: 'Entry not found' },
      };
    }

    return {
      status: 200,
      body: entry,
    };
  }

  private async getBatch(batchId: string): Promise<ApiResponse> {
    const entries = await this.storage.findByBatch(batchId);

    return {
      status: 200,
      body: { batchId, entries },
    };
  }

  private async getStats(): Promise<ApiResponse> {
    const stats = await this.storage.stats();

    return {
      status: 200,
      body: stats,
    };
  }

  private async clearEntries(): Promise<ApiResponse> {
    await this.storage.clear();

    return {
      status: 200,
      body: { success: true, message: 'All entries cleared' },
    };
  }

  private async pruneEntries(req: ApiRequest): Promise<ApiResponse> {
    const body = req.body as { hours?: number } | undefined;
    const hours = body?.hours ?? 24;
    const beforeDate = new Date(Date.now() - hours * 60 * 60 * 1000);

    const pruned = await this.storage.prune(beforeDate);

    return {
      status: 200,
      body: { success: true, pruned, message: `Pruned ${pruned} entries older than ${hours} hours` },
    };
  }
}
