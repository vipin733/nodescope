import type {
  Entry,
  ListOptions,
  PaginatedResult,
  StorageStats,
  EntryType,
} from '../types.js';
import type { StorageAdapter } from './adapter.js';
import { defaultEntryCounts } from './adapter.js';

interface MemoryStorageOptions {
  /** Maximum number of entries to keep */
  maxEntries?: number;
}

/**
 * In-memory storage adapter.
 * Fast but data is lost on restart.
 * Great for development and testing.
 */
export class MemoryStorage implements StorageAdapter {
  private entries: Map<string, Entry> = new Map();
  private entriesByBatch: Map<string, Set<string>> = new Map();
  private entriesByType: Map<EntryType, Set<string>> = new Map();
  private readonly maxEntries: number;

  constructor(options: MemoryStorageOptions = {}) {
    this.maxEntries = options.maxEntries ?? 1000;
  }

  async initialize(): Promise<void> {
    // Nothing to initialize for in-memory storage
  }

  async save(entry: Entry): Promise<void> {
    // Enforce max entries limit (LRU-style)
    if (this.entries.size >= this.maxEntries) {
      // Remove oldest entries (first 10%)
      const toRemove = Math.floor(this.maxEntries * 0.1);
      const iterator = this.entries.keys();
      for (let i = 0; i < toRemove; i++) {
        const oldestKey = iterator.next().value;
        if (oldestKey) {
          const oldEntry = this.entries.get(oldestKey);
          if (oldEntry) {
            this.removeFromIndexes(oldEntry);
          }
          this.entries.delete(oldestKey);
        }
      }
    }

    this.entries.set(entry.id, entry);
    this.addToIndexes(entry);
  }

  async saveBatch(entries: Entry[]): Promise<void> {
    for (const entry of entries) {
      await this.save(entry);
    }
  }

  async find(id: string): Promise<Entry | null> {
    return this.entries.get(id) ?? null;
  }

  async list(options: ListOptions = {}): Promise<PaginatedResult<Entry>> {
    const { type, batchId, tags, search, before, after, limit = 50, offset = 0 } = options;

    let results: Entry[] = [];

    // Start with type filter if specified
    if (type) {
      const typeIds = this.entriesByType.get(type);
      if (typeIds) {
        results = Array.from(typeIds)
          .map((id) => this.entries.get(id))
          .filter((e): e is Entry => e !== undefined);
      }
    } else if (batchId) {
      const batchIds = this.entriesByBatch.get(batchId);
      if (batchIds) {
        results = Array.from(batchIds)
          .map((id) => this.entries.get(id))
          .filter((e): e is Entry => e !== undefined);
      }
    } else {
      results = Array.from(this.entries.values());
    }

    // Apply additional filters
    if (tags && tags.length > 0) {
      results = results.filter((e) => tags.some((t) => e.tags.includes(t)));
    }

    if (search) {
      const searchLower = search.toLowerCase();
      results = results.filter((e) =>
        JSON.stringify(e.content).toLowerCase().includes(searchLower)
      );
    }

    if (before) {
      results = results.filter((e) => e.createdAt < before);
    }

    if (after) {
      results = results.filter((e) => e.createdAt > after);
    }

    // Sort by createdAt descending (newest first)
    results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = results.length;
    const paginatedResults = results.slice(offset, offset + limit);

    return {
      data: paginatedResults,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    };
  }

  async findByBatch(batchId: string): Promise<Entry[]> {
    const ids = this.entriesByBatch.get(batchId);
    if (!ids) return [];

    return Array.from(ids)
      .map((id) => this.entries.get(id))
      .filter((e): e is Entry => e !== undefined)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async prune(beforeDate: Date): Promise<number> {
    let pruned = 0;

    for (const [id, entry] of this.entries) {
      if (entry.createdAt < beforeDate) {
        this.removeFromIndexes(entry);
        this.entries.delete(id);
        pruned++;
      }
    }

    return pruned;
  }

  async clear(): Promise<void> {
    this.entries.clear();
    this.entriesByBatch.clear();
    this.entriesByType.clear();
  }

  async stats(): Promise<StorageStats> {
    const entriesByType = defaultEntryCounts();

    let oldestEntry: Date | undefined;
    let newestEntry: Date | undefined;

    for (const entry of this.entries.values()) {
      entriesByType[entry.type]++;

      if (!oldestEntry || entry.createdAt < oldestEntry) {
        oldestEntry = entry.createdAt;
      }
      if (!newestEntry || entry.createdAt > newestEntry) {
        newestEntry = entry.createdAt;
      }
    }

    return {
      totalEntries: this.entries.size,
      entriesByType,
      oldestEntry,
      newestEntry,
    };
  }

  async close(): Promise<void> {
    // Nothing to close for in-memory storage
  }

  private addToIndexes(entry: Entry): void {
    // Batch index
    if (!this.entriesByBatch.has(entry.batchId)) {
      this.entriesByBatch.set(entry.batchId, new Set());
    }
    this.entriesByBatch.get(entry.batchId)!.add(entry.id);

    // Type index
    if (!this.entriesByType.has(entry.type)) {
      this.entriesByType.set(entry.type, new Set());
    }
    this.entriesByType.get(entry.type)!.add(entry.id);
  }

  private removeFromIndexes(entry: Entry): void {
    this.entriesByBatch.get(entry.batchId)?.delete(entry.id);
    this.entriesByType.get(entry.type)?.delete(entry.id);
  }
}
