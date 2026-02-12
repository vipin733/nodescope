import {
  defaultEntryCounts
} from "./chunk-OF6NKXP5.js";

// src/storage/memory.ts
var MemoryStorage = class {
  entries = /* @__PURE__ */ new Map();
  entriesByBatch = /* @__PURE__ */ new Map();
  entriesByType = /* @__PURE__ */ new Map();
  maxEntries;
  constructor(options = {}) {
    this.maxEntries = options.maxEntries ?? 1e3;
  }
  async initialize() {
  }
  async save(entry) {
    if (this.entries.size >= this.maxEntries) {
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
  async saveBatch(entries) {
    for (const entry of entries) {
      await this.save(entry);
    }
  }
  async find(id) {
    return this.entries.get(id) ?? null;
  }
  async list(options = {}) {
    const { type, batchId, tags, search, before, after, limit = 50, offset = 0 } = options;
    let results = [];
    if (type) {
      const typeIds = this.entriesByType.get(type);
      if (typeIds) {
        results = Array.from(typeIds).map((id) => this.entries.get(id)).filter((e) => e !== void 0);
      }
    } else if (batchId) {
      const batchIds = this.entriesByBatch.get(batchId);
      if (batchIds) {
        results = Array.from(batchIds).map((id) => this.entries.get(id)).filter((e) => e !== void 0);
      }
    } else {
      results = Array.from(this.entries.values());
    }
    if (tags && tags.length > 0) {
      results = results.filter((e) => tags.some((t) => e.tags.includes(t)));
    }
    if (search) {
      const searchLower = search.toLowerCase();
      results = results.filter(
        (e) => JSON.stringify(e.content).toLowerCase().includes(searchLower)
      );
    }
    if (before) {
      results = results.filter((e) => e.createdAt < before);
    }
    if (after) {
      results = results.filter((e) => e.createdAt > after);
    }
    results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const total = results.length;
    const paginatedResults = results.slice(offset, offset + limit);
    return {
      data: paginatedResults,
      total,
      limit,
      offset,
      hasMore: offset + limit < total
    };
  }
  async findByBatch(batchId) {
    const ids = this.entriesByBatch.get(batchId);
    if (!ids) return [];
    return Array.from(ids).map((id) => this.entries.get(id)).filter((e) => e !== void 0).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }
  async prune(beforeDate) {
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
  async clear() {
    this.entries.clear();
    this.entriesByBatch.clear();
    this.entriesByType.clear();
  }
  async stats() {
    const entriesByType = defaultEntryCounts();
    let oldestEntry;
    let newestEntry;
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
      newestEntry
    };
  }
  async close() {
  }
  addToIndexes(entry) {
    if (!this.entriesByBatch.has(entry.batchId)) {
      this.entriesByBatch.set(entry.batchId, /* @__PURE__ */ new Set());
    }
    this.entriesByBatch.get(entry.batchId).add(entry.id);
    if (!this.entriesByType.has(entry.type)) {
      this.entriesByType.set(entry.type, /* @__PURE__ */ new Set());
    }
    this.entriesByType.get(entry.type).add(entry.id);
  }
  removeFromIndexes(entry) {
    this.entriesByBatch.get(entry.batchId)?.delete(entry.id);
    this.entriesByType.get(entry.type)?.delete(entry.id);
  }
};

export {
  MemoryStorage
};
